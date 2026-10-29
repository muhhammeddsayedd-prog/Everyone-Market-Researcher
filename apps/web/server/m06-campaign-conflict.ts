import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { m06CampaignConflictEvent } from '@emr/shared';
import { collectorConfig, type CollectorDispatch } from './n8n-worker/collectors';

// A project-scoped provider webhook pauses this development campaign only.
// It has no Vercel management credential or ability to modify Production.
export function createCampaignConflictHandler(deps: {
  environment: () => Record<string, string | undefined>;
  dispatch: CollectorDispatch;
  now?: () => number;
}) {
  return async (request: Request) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const timer = setTimeout(() => controller.abort(), 8000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const env = deps.environment(),
        config = collectorConfig(env),
        url = new URL(request.url);
      const signature = request.headers.get('x-vercel-signature') ?? '';
      if (
        request.method !== 'POST' ||
        config.scope !== 'm06' ||
        !config.policy ||
        url.origin !== config.audience ||
        url.pathname !== '/api/internal/m06/production-conflict' ||
        [...url.searchParams.keys()].some((k) => k !== 'x-vercel-protection-bypass') ||
        !/^[a-f0-9]{40}$/.test(signature) ||
        !env.EMR_M06_CONFLICT_SECRET ||
        request.headers.has('cookie') ||
        request.headers.has('origin')
      )
        throw Error('denied');
      reader = request.body?.getReader();
      if (!reader) throw Error('denied');
      const parts: Uint8Array[] = [];
      let size = 0;
      const aborted = new Promise<never>((_, reject) => {
        if (controller.signal.aborted) reject(Error('timeout'));
        else controller.signal.addEventListener('abort', () => reject(Error('timeout')), { once: true });
      });
      while (true) {
        const row = await Promise.race([reader.read(), aborted]);
        if (row.done) break;
        size += row.value.length;
        if (size > 32768) throw Error('bound');
        parts.push(row.value);
      }
      const raw = Buffer.concat(parts);
      if (
        !timingSafeEqual(
          createHmac('sha1', env.EMR_M06_CONFLICT_SECRET).update(raw).digest(),
          Buffer.from(signature, 'hex'),
        )
      )
        throw Error('denied');
      const event = m06CampaignConflictEvent.parse(JSON.parse(raw.toString('utf8')));
      const at = typeof event.createdAt === 'number' ? event.createdAt : Date.parse(event.createdAt);
      const now = (deps.now ?? Date.now)();
      if (at > now + 30000 || at < now - 86400000) throw Error('stale');
      if (event.payload.target === 'production') {
        const receipt = await deps.dispatch(
          event.id,
          'm06.campaign_conflict',
          {
            campaign_id: config.policy.approval_id,
            event_id: event.id,
            deployment_id: event.payload.deployment.id,
            observed_at: new Date(at).toISOString(),
          },
          config,
          controller.signal,
        );
        if (
          typeof receipt.replayed !== 'boolean' ||
          !receipt.result ||
          typeof receipt.result !== 'object' ||
          !('paused' in receipt.result) ||
          receipt.result.paused !== true
        )
          throw Error('pause_unverified');
      }
      return Response.json(
        { accepted: true, production_conflict: event.payload.target === 'production' },
        { headers: { 'cache-control': 'no-store' } },
      );
    } catch {
      return Response.json({ rejected: true }, { status: 403, headers: { 'cache-control': 'no-store' } });
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', cancel);
      await reader?.cancel().catch(() => {});
    }
  };
}
