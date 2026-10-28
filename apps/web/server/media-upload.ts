import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mediaUploadRequest, mediaSignedUpload } from '@emr/shared';
import { WorkerFailure } from './n8n-worker/errors';

const devSupabaseOrigin = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
const routePath = '/api/internal/media-upload-url';
const maxBodyBytes = 4096;

export interface MediaUploadConfig {
  supabaseUrl: string;
  secretKey: string;
  webhookSecret: string;
}
export type MediaUploadSigner = (
  path: string,
  config: MediaUploadConfig,
  signal: AbortSignal,
) => Promise<unknown>;

export function mediaUploadConfig(env: Record<string, string | undefined>): MediaUploadConfig {
  const webhookSecret = env.INTERNAL_WEBHOOK_SECRET;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (
    env.EMR_MEDIA_UPLOAD_ENABLED !== 'true' ||
    env.VERCEL_ENV === 'production' ||
    (env.NODE_ENV === 'production' && env.VERCEL_ENV !== 'preview') ||
    !webhookSecret ||
    !/^[!-~]{32,256}$/.test(webhookSecret) ||
    !secretKey ||
    !/^[!-~]{20,4096}$/.test(secretKey)
  )
    throw new WorkerFailure('unavailable', 503);
  let url: URL;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  } catch {
    throw new WorkerFailure('unavailable', 503);
  }
  if (
    url.origin !== devSupabaseOrigin ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new WorkerFailure('unavailable', 503);
  return { supabaseUrl: url.origin, secretKey, webhookSecret };
}

function authorize(request: Request, config: MediaUploadConfig) {
  const url = new URL(request.url);
  if (
    url.pathname !== routePath ||
    url.search ||
    request.headers.has('origin') ||
    request.headers.has('cookie')
  )
    throw new WorkerFailure('forbidden', 403);
  const supplied = createHash('sha256')
    .update(request.headers.get('x-emr-secret') ?? '')
    .digest();
  const expected = createHash('sha256').update(config.webhookSecret).digest();
  if (!timingSafeEqual(supplied, expected)) throw new WorkerFailure('unauthorized', 401);
}

async function readBody(request: Request, signal: AbortSignal): Promise<unknown> {
  if (request.headers.has('content-encoding')) throw new WorkerFailure('unsupported_encoding', 415);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? ''))
    throw new WorkerFailure('invalid_content_type', 415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > maxBodyBytes))
    throw new WorkerFailure('body_too_large', 413);
  if (!request.body) throw new WorkerFailure('invalid_request', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new WorkerFailure('unavailable', 503);
      const r = await reader.read();
      if (r.done) break;
      bytes += r.value.byteLength;
      if (bytes > maxBodyBytes) throw new WorkerFailure('body_too_large', 413);
      chunks.push(r.value);
    }
    if (length !== null && Number(length) !== bytes) throw new WorkerFailure('invalid_request', 400);
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown;
    } catch {
      throw new WorkerFailure('invalid_request', 400);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function signedCapability(value: unknown, path: string, config: MediaUploadConfig) {
  const parsed = mediaSignedUpload.safeParse(value);
  if (!parsed.success || parsed.data.path !== path) throw new WorkerFailure('storage_unavailable', 502);
  const result = parsed.data;
  const url = new URL(result.signedUrl);
  if (
    url.origin !== config.supabaseUrl ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== `/storage/v1/object/upload/sign/media/${path}` ||
    url.searchParams.size !== 1 ||
    url.searchParams.get('token') !== result.token
  )
    throw new WorkerFailure('storage_unavailable', 502);
  return result;
}

function response(value: unknown, status: number) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...(status === 405 ? { allow: 'POST' } : {}),
    },
  });
}

export function createMediaUploadHandler(dependencies: {
  environment: () => Record<string, string | undefined>;
  signUpload: MediaUploadSigner;
  deadlineMs?: number;
}) {
  return async (request: Request): Promise<Response> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, dependencies.deadlineMs ?? 8000);
    try {
      if (request.method !== 'POST') throw new WorkerFailure('method_not_allowed', 405);
      const config = mediaUploadConfig(dependencies.environment());
      authorize(request, config);
      if (controller.signal.aborted) throw new WorkerFailure('unavailable', 503);
      const parsed = mediaUploadRequest.safeParse(await readBody(request, controller.signal));
      if (!parsed.success) throw new WorkerFailure('invalid_request', 400);
      if (controller.signal.aborted) throw new WorkerFailure('unavailable', 503);
      const raw = await dependencies.signUpload(parsed.data.path, config, controller.signal);
      if (controller.signal.aborted) throw new WorkerFailure('unavailable', 503);
      return response(signedCapability(raw, parsed.data.path, config), 200);
    } catch (error) {
      const failure = controller.signal.aborted
        ? new WorkerFailure('unavailable', 503)
        : error instanceof WorkerFailure
          ? error
          : new WorkerFailure('storage_unavailable', 502);
      // No request, URL token, config, SDK error or native error enters logs/output.
      return response({ error: { code: failure.code } }, failure.status);
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
    }
  };
}
