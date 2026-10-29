import 'server-only';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { upkeepAccountIds, upkeepTargets, upkeepStatus } from '@emr/shared';
import { readBody } from './n8n-worker/dispatcher';
import { WorkerFailure } from './n8n-worker/errors';
import {
  upkeepRequest,
  upkeepAccountResult,
  type UpkeepDispatch,
  type UpkeepTarget,
} from './m06-upkeep-contracts';
import { evaluateRemovalListing } from '../../../n8n/collectors/upkeep.mjs';
import { projectUpkeepHealth } from '../../../n8n/collectors/upkeep-health.mjs';
import {
  readUpkeepListing,
  type UpkeepSourceTarget,
  type UpkeepSourcePorts,
} from '../../../n8n/collectors/upkeep-sources.mjs';

export function upkeepConfig(env: Record<string, string | undefined>) {
  let accountIds: string[];
  try {
    accountIds = upkeepAccountIds.parse(JSON.parse(env.EMR_UPKEEP_ACCOUNT_IDS ?? ''));
  } catch {
    throw new WorkerFailure('unavailable', 503);
  }
  if (
    new Set(accountIds).size !== accountIds.length ||
    env.EMR_UPKEEP_ENABLED !== 'true' ||
    env.VERCEL_ENV !== 'preview' ||
    env.VERCEL_GIT_COMMIT_REF !== 'm06-upkeep-local' ||
    env.VERCEL_PROJECT_ID !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
    env.EMR_UPKEEP_COMMIT_SHA !== env.VERCEL_GIT_COMMIT_SHA ||
    !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? '') ||
    !/^[a-f0-9]{64}$/.test(env.EMR_UPKEEP_TOKEN_SHA256 ?? '') ||
    !env.EMR_UPKEEP_WRITER_PASSWORD
  )
    throw new WorkerFailure('unavailable', 503);
  return {
    audience: 'https://' + env.VERCEL_URL,
    accountIds,
    verifier: env.EMR_UPKEEP_TOKEN_SHA256!,
    password: env.EMR_UPKEEP_WRITER_PASSWORD,
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const escape = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function renderUpkeepHealth(health: unknown) {
  const projection = projectUpkeepHealth(health);
  const display = (v: number | null) => (v === null ? 'Unknown' : String(v));
  const lines = [
    'M06 development health — local rendering; no email sent',
    `Failing accounts: ${projection.failing_accounts}`,
    `Stale accounts: ${projection.stale_accounts}`,
    `Zero-item streaks: ${display(projection.zero_item_streaks)}`,
    `Story discovery gap: ${display(projection.story_capture_gap)}`,
    `Media missing within 24 hours: ${display(projection.media_missing_24h)}`,
    'Dedicated story queue depth: Unknown',
    `Over daily alert budget: ${projection.over_budget ? 'Yes' : 'No'}`,
  ];
  return {
    health,
    projection,
    rendered: {
      subject: 'Market Radar development health',
      text: lines.join('\n'),
      html: '<p>' + lines.map(escape).join('<br>') + '</p>',
    },
    sent: false as const,
    delivery: 'local_only' as const,
  };
}
export function createUpkeepHandler(deps: {
  environment: () => Record<string, string | undefined>;
  database: (password: string) => UpkeepDispatch;
  sources: (environment: Record<string, string | undefined>) => UpkeepSourcePorts;
  now?: () => string;
}) {
  return async (request: Request) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, 50000);
    let requestId: string | null = null;
    try {
      const env = deps.environment(),
        config = upkeepConfig(env),
        url = new URL(request.url);
      if (
        request.method !== 'POST' ||
        url.origin !== config.audience ||
        url.pathname !== '/api/internal/m06/upkeep' ||
        url.search ||
        request.headers.has('cookie') ||
        request.headers.has('origin')
      )
        throw new WorkerFailure('forbidden', 403);
      const auth = request.headers.get('authorization') ?? '';
      if (
        !/^Bearer [A-Za-z0-9_-]{32,256}$/.test(auth) ||
        !timingSafeEqual(
          createHash('sha256').update(auth.slice(7)).digest(),
          Buffer.from(config.verifier, 'hex'),
        )
      )
        throw new WorkerFailure('unauthorized', 401);
      const parsed = upkeepRequest.safeParse(await readBody(request, controller.signal));
      if (!parsed.success) throw new WorkerFailure('invalid_request', 400);
      const input = parsed.data;
      requestId = input.requestId;
      const dispatch = deps.database(config.password);
      let result: unknown,
        replayed = false;
      const status = async (id: string) =>
        upkeepStatus.parse(await dispatch('status', { request_id: id }, controller.signal));
      const targets = async (platform: string): Promise<UpkeepTarget[]> => {
        const raw = await dispatch(
          'targets',
          { platform, window_days: ['instagram', 'linkedin'].includes(platform) ? 30 : 90 },
          controller.signal,
        );
        if (!Array.isArray(raw) || raw.length > 5000) throw new WorkerFailure('reconciliation_required', 503);
        return upkeepTargets
          .parse(
            raw.filter(
              (t) =>
                object(t) && typeof t.account_id === 'string' && config.accountIds.includes(t.account_id),
            ),
          )
          .sort((a, b) => a.account_id.localeCompare(b.account_id));
      };
      if (input.operation === 'targets') {
        const all = (await targets(input.args.platform)).filter(
          (t) => !input.args.after || t.account_id > input.args.after,
        );
        const selected = all.slice(0, input.args.limit);
        result = {
          targets: selected,
          next_account_id: all.length > selected.length ? selected.at(-1)!.account_id : null,
        };
      } else if (input.operation === 'request.status') {
        const found = await status(input.args.request_id);
        if (found.state === 'completed') {
          const known = upkeepAccountResult.safeParse(found.result);
          if (
            found.operation !== 'apply_observation' ||
            !known.success ||
            !config.accountIds.includes(known.data.account_id)
          )
            throw new WorkerFailure('forbidden', 403);
        }
        result = found;
      } else if (input.operation === 'health.read') {
        result = renderUpkeepHealth(await dispatch('health', {}, controller.signal));
      } else {
        if (!config.accountIds.includes(input.args.account_id)) throw new WorkerFailure('forbidden', 403);
        const prior = await status(input.requestId);
        if (prior.state === 'completed') {
          const saved = upkeepAccountResult.parse(prior.result);
          if (
            prior.operation !== 'apply_observation' ||
            saved.account_id !== input.args.account_id ||
            saved.platform !== input.args.platform ||
            saved.since !== input.args.since ||
            saved.metrics_since !== input.args.metrics_since
          )
            throw new WorkerFailure('reconciliation_required', 503);
          result = saved;
          replayed = true;
        } else {
          const target = (await targets(input.args.platform)).find(
            (t) => t.account_id === input.args.account_id,
          );
          if (
            !target ||
            target.since !== input.args.since ||
            target.metrics_since !== input.args.metrics_since
          )
            throw new WorkerFailure('target_changed', 409);
          const sourceTarget: UpkeepSourceTarget = {
            ...target,
            handle: target.handle ?? '',
            pass:
              target.platform === 'instagram'
                ? 'posts_and_reels'
                : target.platform === 'linkedin'
                  ? 'posts'
                  : 'videos',
            source_runs: target.source_runs as UpkeepSourceTarget['source_runs'],
          };
          const now = (deps.now ?? (() => new Date().toISOString()))();
          const ports = deps.sources(env);
          const sourcePorts: UpkeepSourcePorts = {
            ...ports,
            request: ports.request
              ? async (sourceRequest) => {
                  if (sourceRequest.source === 'youtube') {
                    const quotaDay = new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'America/Los_Angeles',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date(now));
                    const quota = await dispatch(
                      'quota',
                      { request_id: randomUUID(), quota_day: quotaDay },
                      controller.signal,
                    );
                    if (!object(quota) || !object(quota.result) || quota.result.permitted !== true)
                      throw new WorkerFailure('youtube_quota_unavailable', 503);
                  }
                  return ports.request!(sourceRequest);
                }
              : undefined,
          };
          const receipt = await readUpkeepListing(
            sourceTarget,
            sourcePorts,
            { now, maxPages: 10, maxItems: 5000 },
            controller.signal,
          );
          const plan = evaluateRemovalListing(sourceTarget, receipt);
          const eligibleMetrics = new Set(plan.metrics_external_ids);
          const rows = receipt.entries
            .filter((e) => eligibleMetrics.has(e.external_id))
            .map((e) => ({ external_id: e.external_id, metrics: e.metrics, observed_at: e.observed_at }));
          if (controller.signal.aborted) throw new WorkerFailure('cancelled', 503);
          const applied = await dispatch(
            'apply',
            {
              request_id: input.requestId,
              account_id: target.account_id,
              since: target.since,
              metrics_since: target.metrics_since,
              rows,
              seen_external_ids: plan.mark_removed_args?.p_seen_external_ids ?? null,
              skip_reason: plan.eligible ? null : plan.reason,
              observed_before: target.observed_before,
            },
            controller.signal,
          );
          if (!object(applied) || typeof applied.replayed !== 'boolean')
            throw new WorkerFailure('outcome_unknown', 503);
          result = upkeepAccountResult.parse(applied.result);
          replayed = applied.replayed;
        }
      }
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      return Response.json(
        { version: 1, requestId, operation: input.operation, replayed, result },
        { headers: { 'cache-control': 'no-store' } },
      );
    } catch (error) {
      const known = error instanceof WorkerFailure;
      return Response.json(
        { requestId, error: { code: known ? error.code : 'reconciliation_required' } },
        { status: known ? error.status : 503, headers: { 'cache-control': 'no-store' } },
      );
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abort);
    }
  };
}
