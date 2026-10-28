import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mediaBatchInput, mediaBatchSummary } from '../../../packages/shared/src/media-contracts';
import { runMediaBatch, type MediaPorts } from '../../../n8n/media/worker';
import { createMediaThumbnail } from './media-thumbnail';
import { readMediaBody } from './media-upload';
import type { MediaDatabaseSession } from './media-database';
import { WorkerFailure } from './n8n-worker/errors';

export interface MediaProcessConfig {
  audience: string;
  writerPassword: string;
  webhookSecret: string;
  protectionBypass: string;
  batchSize: number;
}
export function mediaProcessConfig(env: Record<string, string | undefined>): MediaProcessConfig {
  const batchSize = env.EMR_MEDIA_BATCH_SIZE ?? '1';
  if (
    env.EMR_MEDIA_PROCESS_ENABLED !== 'true' ||
    env.EMR_MEDIA_UPLOAD_ENABLED !== 'true' ||
    env.VERCEL_ENV !== 'preview' ||
    env.VERCEL_PROJECT_ID !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    env.VERCEL_GIT_COMMIT_REF !== 'm06-collectors-stories-upkeep' ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
    env.VERCEL_GIT_COMMIT_SHA !== env.EMR_MEDIA_COMMIT_SHA ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? '') ||
    env.NEXT_PUBLIC_SUPABASE_URL !== 'https://zmotjsbzhzjvpelxvxlf.supabase.co' ||
    !/^[!-~]{32,256}$/.test(env.INTERNAL_WEBHOOK_SECRET ?? '') ||
    !/^[!-~]{16,4096}$/.test(env.EMR_MEDIA_PROTECTION_BYPASS ?? '') ||
    !env.EMR_MEDIA_WRITER_PASSWORD ||
    env.EMR_MEDIA_WRITER_PASSWORD.length > 4096 ||
    env.EMR_MEDIA_WRITER_PASSWORD.includes('\0') ||
    !/^[1-5]$/.test(batchSize)
  )
    throw new WorkerFailure('unavailable', 503);
  return {
    audience: 'https://' + env.VERCEL_URL,
    writerPassword: env.EMR_MEDIA_WRITER_PASSWORD,
    webhookSecret: env.INTERNAL_WEBHOOK_SECRET!,
    protectionBypass: env.EMR_MEDIA_PROTECTION_BYPASS!,
    batchSize: Number(batchSize),
  };
}
export type MediaHttpPorts = Pick<MediaPorts, 'download' | 'sign' | 'upload'> & {
  preflight(signal: AbortSignal): Promise<void>;
};
interface Dependencies {
  environment: () => Record<string, string | undefined>;
  open: (
    config: Pick<MediaProcessConfig, 'writerPassword' | 'batchSize'>,
    executionId: string,
    signal: AbortSignal,
    onLost: () => void,
  ) => Promise<MediaDatabaseSession>;
  transports: (
    config: Pick<MediaProcessConfig, 'audience' | 'webhookSecret' | 'protectionBypass'>,
  ) => MediaHttpPorts;
  deadlineMs?: number;
}
function response(value: unknown, status: number) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}
/** WF-31's concrete composition runs in Vercel Node, never an n8n Code node. */
export function createMediaProcessHandler(deps: Dependencies) {
  const deadline = deps.deadlineMs ?? 250000;
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 250000) throw Error('invalid_media_deadline');
  return async (request: Request): Promise<Response> => {
    const controller = new AbortController(),
      abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, deadline);
    let db: MediaDatabaseSession | undefined,
      output: Response = response({ error: { code: 'outcome_unknown' } }, 503);
    try {
      if (request.method !== 'POST') throw new WorkerFailure('method_not_allowed', 405);
      const config = mediaProcessConfig(deps.environment()),
        u = new URL(request.url);
      if (
        u.origin !== config.audience ||
        u.pathname !== '/api/internal/media/process' ||
        u.search ||
        request.headers.has('origin') ||
        request.headers.has('cookie')
      )
        throw new WorkerFailure('forbidden', 403);
      if (
        !timingSafeEqual(
          createHash('sha256')
            .update(request.headers.get('x-emr-secret') ?? '')
            .digest(),
          createHash('sha256').update(config.webhookSecret).digest(),
        )
      )
        throw new WorkerFailure('unauthorized', 401);
      const input = mediaBatchInput.safeParse(await readMediaBody(request, controller.signal));
      if (!input.success) throw new WorkerFailure('invalid_request', 400);
      controller.signal.throwIfAborted();
      const http = deps.transports({
        audience: config.audience,
        webhookSecret: config.webhookSecret,
        protectionBypass: config.protectionBypass,
      });
      // The signing route alone reads its Storage secret. HEAD verifies that
      // configuration/auth before claiming queue data or downloading any image.
      await http.preflight(controller.signal);
      controller.signal.throwIfAborted();
      db = await deps.open(
        { writerPassword: config.writerPassword, batchSize: config.batchSize },
        input.data.execution_id,
        controller.signal,
        abort,
      );
      const session = db,
        claim = await session.claim(controller.signal);
      if (claim.replayed && claim.state !== 'finished')
        throw new WorkerFailure('media_batch_reconciliation_required', 409);
      let summary;
      if (claim.replayed) summary = mediaBatchSummary.parse(claim.result);
      else {
        try {
          await runMediaBatch(
            {
              claim: async () => claim.messages,
              targets: session.targets,
              download: http.download,
              resize: (bytes, _options, signal) => createMediaThumbnail(bytes, signal),
              sign: http.sign,
              upload: http.upload,
              save: session.save,
              record: session.record,
              ack: session.ack,
            },
            { signal: controller.signal, deadlineMs: Math.min(220000, deadline) },
          );
        } catch {
          // All sibling I/O is already awaited by the worker. A durable finish
          // derives incomplete/reconciliation state; it cannot invent success.
          controller.signal.throwIfAborted();
        }
        summary = mediaBatchSummary.parse(await session.finish(controller.signal));
      }
      controller.signal.throwIfAborted();
      output = response(
        { version: 1, execution_id: input.data.execution_id, replayed: claim.replayed, ...summary },
        summary.state === 'reconciliation_required' ? 409 : 200,
      );
    } catch (error) {
      const e = controller.signal.aborted
        ? new WorkerFailure('outcome_unknown', 503)
        : error instanceof WorkerFailure
          ? error
          : new WorkerFailure('outcome_unknown', 503);
      output = response({ error: { code: e.code } }, e.status);
    } finally {
      try {
        await db?.close();
      } catch {
        output = response({ error: { code: 'outcome_unknown' } }, 503);
      }
      if (controller.signal.aborted) output = response({ error: { code: 'outcome_unknown' } }, 503);
      clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
      controller.abort();
    }
    return output;
  };
}
