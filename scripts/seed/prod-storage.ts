import type { ProdLogos } from './prod-model';
import { prodTarget } from './prod-model';
import { restrictedStorageFetch } from './storage';
import { safeRequest, type SafeRequest } from './network';
import { sha256 } from './files';
import { SeedRuntimeError } from './config';

/** The pinned SDK may never retry an upload or send a different path/body/MIME. */
export function prodUploadFetch(
  logos: ProdLogos,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): typeof fetch {
  const base = `https://${prodTarget.ref}.supabase.co`;
  const byPath = new Map(logos.logos.map((row) => [`/storage/v1/object/media/${row.storagePath}`, row]));
  const attempted = new Set<string>();
  const restricted = restrictedStorageFetch(base, signal, request);
  return async (input, init) => {
    let url: URL;
    try {
      url = new URL(input instanceof Request ? input.url : input.toString());
    } catch {
      throw new SeedRuntimeError('M02_PROD_UPLOAD_REJECTED');
    }
    const entry = byPath.get(url.pathname);
    const body = init?.body;
    const headers = new Headers(init?.headers);
    if (
      url.origin !== base ||
      !entry ||
      attempted.has(entry.storagePath) ||
      attempted.size >= 257 ||
      !(body instanceof Uint8Array) ||
      body.byteLength !== entry.byteLength ||
      sha256(body) !== entry.sha256 ||
      headers.get('content-type') !== entry.mime
    )
      throw new SeedRuntimeError('M02_PROD_UPLOAD_REJECTED');
    attempted.add(entry.storagePath);
    return restricted(input, init);
  };
}
/** One exact-size public read per uploaded manifest path; no redirects or retries. */
export function prodPublicRead(logos: ProdLogos, signal: AbortSignal, request: SafeRequest = safeRequest) {
  const base = `https://${prodTarget.ref}.supabase.co`;
  const byPath = new Map(logos.logos.map((row) => [row.storagePath, row]));
  const attempted = new Set<string>();
  return async (path: string) => {
    const entry = byPath.get(path);
    if (!entry || attempted.has(path) || attempted.size >= 257)
      throw new SeedRuntimeError('M02_PROD_PUBLIC_READ_REJECTED');
    attempted.add(path);
    const result = await request(`${base}/storage/v1/object/public/media/${path}`, {
      allowedOrigins: [base],
      maxRedirects: 0,
      maxBytes: entry.byteLength,
      timeoutMs: 10000,
      signal,
    });
    if (
      result.status !== 200 ||
      result.body.byteLength !== entry.byteLength ||
      sha256(result.body) !== entry.sha256 ||
      (result.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() !== entry.mime
    )
      throw new SeedRuntimeError('M02_PROD_PUBLIC_READ_REJECTED');
    return result.body;
  };
}
