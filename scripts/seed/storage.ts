import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogoAdapter } from './copy-logos';
import { SeedRuntimeError } from './config';
import { safeRequest, type SafeRequest } from './network';

/** SDK keys may be custom headers; never follow a redirect which could forward them. */
export function restrictedStorageFetch(
  baseUrl: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    let url: URL;
    try {
      url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
    } catch {
      throw new SeedRuntimeError('M02_STORAGE_REQUEST_REJECTED');
    }
    if (
      url.origin !== baseUrl ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/storage\/v1\/object\/media\/logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|webp)$/.test(url.pathname) ||
      (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() !== 'POST'
    ) {
      throw new SeedRuntimeError('M02_STORAGE_REQUEST_REJECTED');
    }
    return request(input, {
      ...init,
      redirect: 'error',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
  };
}

/** Create-only uploads. Storage errors never leave this module with provider details. */
export function storageHooks(
  client: SupabaseClient,
  baseUrl: string,
  options: {
    request?: SafeRequest;
    signal?: AbortSignal;
    maxUploadBytes?: number;
  } = {},
) {
  let uploadedBytes = 0;
  const hooks: Pick<LogoAdapter, 'readStored' | 'upload'> = {
    async readStored(path) {
      if (!/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|webp)$/.test(path))
        throw new SeedRuntimeError('M02_STORAGE_PATH_REJECTED');
      const response = await (options.request ?? safeRequest)(
        `${baseUrl}/storage/v1/object/public/media/${path}`,
        {
          allowedOrigins: [baseUrl],
          maxRedirects: 0,
          maxBytes: 5 * 1024 * 1024,
          signal: options.signal,
        },
      );
      if (response.status === 404) return null;
      if (response.status === 400) {
        try {
          const body = JSON.parse(new TextDecoder().decode(response.body)) as {
            statusCode?: string | number;
            error?: string;
          };
          if (String(body.statusCode) === '404' && body.error === 'not_found') return null;
        } catch {
          /* An arbitrary 400 is not evidence that an object is absent. */
        }
      }
      if (response.status !== 200) throw new SeedRuntimeError('M02_PUBLIC_STORAGE_READ_FAILED');
      return response.body;
    },
    async upload(path, prepared) {
      if (!/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|webp)$/.test(path))
        throw new SeedRuntimeError('M02_STORAGE_PATH_REJECTED');
      if (uploadedBytes + prepared.bytes.byteLength > (options.maxUploadBytes ?? 20 * 1024 * 1024))
        throw new SeedRuntimeError('M02_LOGO_BYTE_BUDGET_REACHED');
      const result = await client.storage
        .from('media')
        .upload(path, prepared.bytes, { contentType: prepared.mime, cacheControl: '3600', upsert: false });
      if (result.error) {
        const error = result.error as { statusCode?: string | number; error?: string };
        // Duplicate never establishes ownership: copyLogo must read back and compare actual bytes.
        if (
          String(error.statusCode) === '409' ||
          (String(error.statusCode) === '400' && error.error === 'Duplicate')
        )
          return 'exists';
        throw new SeedRuntimeError('M02_STORAGE_UPLOAD_FAILED');
      }
      uploadedBytes += prepared.bytes.byteLength;
      return 'created';
    },
  };
  return { ...hooks, uploadedBytes: () => uploadedBytes };
}
