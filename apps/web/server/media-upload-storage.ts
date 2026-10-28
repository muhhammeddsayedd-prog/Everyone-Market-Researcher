import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { mediaStoragePath } from '@emr/shared';
import { mediaUploadConfig, type MediaUploadConfig, type MediaUploadSigner } from './media-upload';

const maxResponseBytes = 8192;

async function boundedResponse(response: Response, signal: AbortSignal): Promise<Response> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > maxResponseBytes)) {
    await response.body?.cancel().catch(() => {});
    throw new Error('storage_unavailable');
  }
  if (!response.body) throw new Error('storage_unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error('storage_unavailable');
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxResponseBytes) throw new Error('storage_unavailable');
      chunks.push(part.value);
    }
    if (length !== null && Number(length) !== bytes) throw new Error('storage_unavailable');
    return new Response(Buffer.concat(chunks), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function revalidateConfig(config: MediaUploadConfig) {
  return mediaUploadConfig({
    EMR_MEDIA_UPLOAD_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
    SUPABASE_SECRET_KEY: config.secretKey,
    INTERNAL_WEBHOOK_SECRET: config.webhookSecret,
  });
}

/** Only the signing request uses the Supabase secret. This never uploads media. */
export function createSupabaseMediaSigner(
  options: { fetch?: typeof globalThis.fetch } = {},
): MediaUploadSigner {
  return async (path, inputConfig, signal) => {
    const parsed = mediaStoragePath.safeParse(path);
    if (!parsed.success || signal.aborted) throw new Error('storage_unavailable');
    const config = revalidateConfig(inputConfig);
    const expected = `${config.supabaseUrl}/storage/v1/object/upload/sign/media/${parsed.data}`;
    const client = createClient(config.supabaseUrl, config.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (url, init) => {
          const requested = url instanceof Request ? url.url : String(url);
          if (requested !== expected || init?.method !== 'POST' || signal.aborted)
            throw new Error('storage_unavailable');
          const result = await (options.fetch ?? globalThis.fetch)(url, {
            ...init,
            signal,
            redirect: 'error',
          });
          return boundedResponse(result, signal);
        },
      },
    });
    // Immutable object creation protects existing human/concurrent assets.
    // The queue worker must reconcile 409; it may not overwrite/retry blindly.
    const result = await client.storage.from('media').createSignedUploadUrl(parsed.data, { upsert: false });
    if (result.error || !result.data || signal.aborted) throw new Error('storage_unavailable');
    return result.data;
  };
}
