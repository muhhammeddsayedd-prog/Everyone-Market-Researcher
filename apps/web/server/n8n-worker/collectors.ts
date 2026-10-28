import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  collectorRequest,
  collectorPolicy,
  collectorAccountIds,
  type CollectorPolicy,
  type CollectorRequest,
} from '@emr/shared';
import { readBody, response } from './dispatcher';
import { WorkerFailure } from './errors';
import ingestion from '../../../../n8n/normalizers/prepare_ingest_groups.js';

export interface CollectorConfig {
  scope?: 'm04' | 'm05';
  audience: string;
  password: string;
  verifier: string;
  commitSha: string;
  deploymentId: string;
  apifyReadToken: string;
  accountIds: string[];
  policy: CollectorPolicy | null;
}
export function collectorConfig(env: Record<string, string | undefined>): CollectorConfig {
  let accountIds: string[],
    policy: CollectorPolicy | null = null;
  try {
    accountIds = collectorAccountIds.parse(JSON.parse(env.EMR_COLLECTORS_ACCOUNT_IDS ?? ''));
    if (env.EMR_COLLECTORS_LIVE_POLICY)
      policy = collectorPolicy.parse(JSON.parse(env.EMR_COLLECTORS_LIVE_POLICY));
  } catch {
    throw new WorkerFailure('unavailable', 503);
  }
  if (
    env.EMR_COLLECTORS_ENABLED !== 'true' ||
    env.VERCEL_ENV !== 'preview' ||
    !['m04-collectors-vimeo-instagram', 'm05-collectors-web-youtube-linkedin'].includes(
      env.VERCEL_GIT_COMMIT_REF ?? '',
    ) ||
    env.VERCEL_PROJECT_ID !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
    !env.EMR_COLLECTORS_WRITER_PASSWORD ||
    !env.EMR_COLLECTORS_APIFY_READ_TOKEN ||
    !/^[a-f0-9]{64}$/.test(env.EMR_COLLECTORS_TOKEN_SHA256 ?? '') ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
    env.VERCEL_GIT_COMMIT_SHA !== env.EMR_COLLECTORS_COMMIT_SHA ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? '')
  )
    throw new WorkerFailure('unavailable', 503);
  return {
    scope: env.VERCEL_GIT_COMMIT_REF === 'm05-collectors-web-youtube-linkedin' ? 'm05' : 'm04',
    audience: 'https://' + env.VERCEL_URL,
    password: env.EMR_COLLECTORS_WRITER_PASSWORD,
    verifier: env.EMR_COLLECTORS_TOKEN_SHA256!,
    commitSha: env.VERCEL_GIT_COMMIT_SHA!,
    deploymentId: env.VERCEL_DEPLOYMENT_ID!,
    apifyReadToken: env.EMR_COLLECTORS_APIFY_READ_TOKEN,
    accountIds,
    policy,
  };
}
export type CollectorDispatch = (
  requestId: string,
  operation: string,
  args: Record<string, unknown>,
  config: CollectorConfig,
  signal: AbortSignal,
) => Promise<{ replayed: boolean; result: unknown }>;
interface Dependencies {
  environment: () => Record<string, string | undefined>;
  dispatch: CollectorDispatch;
  processCallback: (
    input: CollectorRequest,
    config: CollectorConfig,
    signal: AbortSignal,
  ) => Promise<unknown>;
  deadlineMs?: number;
}
export function createCollectorHandler(deps: Dependencies) {
  return async (request: Request) => {
    const controller = new AbortController(),
      abort = () => controller.abort();
    const timer = setTimeout(abort, deps.deadlineMs ?? 55000);
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    let requestId: string | null = null;
    try {
      const config = collectorConfig(deps.environment());
      const url = new URL(request.url);
      if (
        url.origin !== config.audience ||
        url.pathname !== '/api/internal/n8n/collectors' ||
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
      if (request.method !== 'POST') throw new WorkerFailure('method_not_allowed', 405);
      let input: CollectorRequest;
      try {
        input = collectorRequest(await readBody(request, controller.signal));
      } catch (e) {
        if (e instanceof WorkerFailure) throw e;
        throw new WorkerFailure('invalid_request', 400);
      }
      requestId = input.requestId;
      if (input.operation.startsWith('m05.') && config.scope !== 'm05')
        throw new WorkerFailure('forbidden', 403);
      if (
        config.scope === 'm05' &&
        !input.operation.startsWith('m05.') &&
        !['callback.classify', 'callback.process', 'request.status'].includes(input.operation)
      )
        throw new WorkerFailure('forbidden', 403);
      const selected = input.args.account_ids;
      if (Array.isArray(selected) && selected.some((v) => !config.accountIds.includes(String(v))))
        throw new WorkerFailure('account_not_permitted', 403);
      if (typeof input.args.account_id === 'string' && !config.accountIds.includes(input.args.account_id))
        throw new WorkerFailure('account_not_permitted', 403);
      if (
        ['cost', 'm05.cost'].includes(input.operation) &&
        (input.args.entries as Array<{ meta: { account_id: string } }>).some(
          (e) => !config.accountIds.includes(e.meta.account_id),
        )
      )
        throw new WorkerFailure('account_not_permitted', 403);
      if (['ingest', 'm05.ingest'].includes(input.operation)) {
        const groups = ingestion.prepareIngestGroups([
          { account_id: input.args.account_id, items: input.args.items },
        ]);
        if (
          !Array.isArray(groups) ||
          !groups[0] ||
          groups[0].status !== 'success' ||
          groups[0].items_dropped !== 0
        )
          throw new WorkerFailure('invalid_request', 400);
      }
      if (input.operation === 'claim' && input.args.platform === 'vimeo' && Number(input.args.limit) > 10)
        throw new WorkerFailure('invalid_request', 400);
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      let receipt: { replayed: boolean; result: unknown };
      if (input.operation === 'callback.process') {
        const result = await deps.processCallback(input, config, controller.signal);
        receipt = {
          replayed:
            result !== null && typeof result === 'object' && 'updated' in result && result.updated === false,
          result,
        };
      } else {
        const args = { ...input.args };
        let op: string = input.operation;
        if (op === 'launch' || op === 'm05.launch') {
          const p = config.policy,
            actor = String(args.actor_id) as keyof NonNullable<CollectorConfig['policy']>['actors'];
          if (!p || !p.actors[actor] || Number(args.results_limit) > p.max_results_per_profile)
            throw new WorkerFailure('actor_start_not_authorized', 403);
          if (
            op === 'm05.launch' &&
            actor === 'apify/website-content-crawler' &&
            (p.actors[actor]?.billingModel !== 'PPU' || !p.website_urls_per_account)
          )
            throw new WorkerFailure('actor_billing_contract_required', 403);
          if (
            op === 'm05.launch' &&
            actor.startsWith('harvestapi/') &&
            p.actors[actor]?.billingModel === 'PPU'
          )
            throw new WorkerFailure('actor_billing_contract_required', 403);
          Object.assign(args, {
            approval_id: p.approval_id,
            max_actor_starts: p.max_actor_starts,
            max_actor_usd: p.max_actor_usd,
            max_total_usd: p.max_total_usd,
            ...(op === 'm05.launch' && actor === 'apify/website-content-crawler'
              ? { max_website_urls_per_account: p.website_urls_per_account }
              : {}),
          });
        }
        if (op === 'request.status') op = 'status';
        if (op === 'callback.classify') op = 'classify';
        receipt = await deps.dispatch(input.requestId, op, args, config, controller.signal);
        if (
          ['launch', 'm05.launch'].includes(input.operation) &&
          receipt.result &&
          typeof receipt.result === 'object'
        ) {
          const a = String(args.actor_id) as keyof NonNullable<CollectorConfig['policy']>['actors'];
          const build = config.policy!.actors[a]!;
          receipt = {
            ...receipt,
            result: {
              ...receipt.result,
              descriptor: {
                billingModel: build.billingModel ?? 'PPE',
                actorPath: a.replace('/', '~'),
                build: build.build,
                maxTotalChargeUsd: config.policy!.max_actor_usd,
                maxItems: (args.account_ids as unknown[]).length * Number(args.results_limit),
                timeout: 600,
                memory: 1024,
              },
            },
          };
        }
      }
      if (
        controller.signal.aborted ||
        typeof receipt.replayed !== 'boolean' ||
        !Object.hasOwn(receipt, 'result')
      )
        throw new WorkerFailure('outcome_unknown', 503);
      const output = { version: 1, requestId, operation: input.operation, ...receipt };
      if (Buffer.byteLength(JSON.stringify(output)) > 524288)
        throw new WorkerFailure('result_too_large', 503);
      return response(output, 200);
    } catch (error) {
      const e = error instanceof WorkerFailure ? error : new WorkerFailure('outcome_unknown', 503);
      return response({ requestId, error: { code: e.code } }, e.status);
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
    }
  };
}
