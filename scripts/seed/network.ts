import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

export type NetworkFailure =
  | 'unsafe_url'
  | 'unsafe_address'
  | 'unsafe_headers'
  | 'redirect_blocked'
  | 'too_many_redirects'
  | 'response_too_large'
  | 'timeout'
  | 'aborted'
  | 'network';

export class SafeNetworkError extends Error {
  constructor(readonly code: NetworkFailure) {
    super(code);
    this.name = 'SafeNetworkError';
  }
}

export interface NetworkResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
  url: string;
}
export interface RequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Readonly<Record<string, string>>;
  /** Explicit public competitor website origin for a bounded logo hotlink retry. */
  refererOrigin?: string;
  allowedOrigins?: readonly string[];
  sameDomainRedirects?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}
export interface PublicAddress {
  address: string;
  family: number;
}
export interface TransportRequest {
  url: URL;
  method: 'GET' | 'HEAD';
  headers: Readonly<Record<string, string>>;
  address: PublicAddress;
  maxBytes: number;
  signal: AbortSignal;
}
export interface NetworkDependencies {
  lookup: (hostname: string) => Promise<PublicAddress[]>;
  transport: (input: TransportRequest) => Promise<Omit<NetworkResponse, 'url'>>;
}
export type SafeRequest = (url: string, options?: RequestOptions) => Promise<NetworkResponse>;

/** Fail closed for special-use addresses, including all IPv4-in-IPv6 forms. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [first = '', second = ''] = address.toLowerCase().split(':');
  const a = Number.parseInt(first, 16);
  const b = second ? Number.parseInt(second, 16) : 0;
  // Only global unicast 2000::/3. Exclude special protocol, documentation and 6to4 ranges.
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) &&
    !(a === 0x3fff && b <= 0x0fff)
  );
}

function checkedUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeNetworkError('unsafe_url');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    hostname.length > 253 ||
    hostname.endsWith('.') ||
    /(?:^|\.)(?:localhost|local|internal|home|lan)$/.test(hostname) ||
    (!isIP(hostname) && (!hostname.includes('.') || !/^[a-z0-9.-]+$/i.test(hostname))) ||
    (isIP(hostname) && !isPublicAddress(hostname))
  )
    throw new SafeNetworkError('unsafe_url');
  url.hash = '';
  return url;
}

function requestHeaders(input: RequestOptions['headers'], refererOrigin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (refererOrigin !== undefined) {
    try {
      headers.referer = `${checkedUrl(refererOrigin).origin}/`;
    } catch {
      throw new SafeNetworkError('unsafe_headers');
    }
  }
  for (const [name, value] of Object.entries(input ?? {})) {
    const key = name.toLowerCase();
    if (
      !['accept', 'authorization', 'user-agent', 'x-goog-api-key', 'referer'].includes(key) ||
      !value ||
      value.length > 8192 ||
      /[\r\n\0]/.test(value)
    )
      throw new SafeNetworkError('unsafe_headers');
    if (key === 'referer') {
      try {
        const referrer = checkedUrl(value);
        if (!refererOrigin || referrer.origin !== checkedUrl(refererOrigin).origin)
          throw new SafeNetworkError('unsafe_headers');
        // Never transmit competitor paths, tracking data or embedded query values.
        headers[key] = `${referrer.origin}/`;
      } catch {
        throw new SafeNetworkError('unsafe_headers');
      }
    } else headers[key] = value;
  }
  return headers;
}

const responseHeaders = [
  'location',
  'content-type',
  'content-length',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
];

/** Native transport never performs another DNS lookup or follows a redirect. */
const nativeTransport: NetworkDependencies['transport'] = (input) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(
      input.url,
      {
        method: input.method,
        headers: input.headers,
        agent: false,
        family: input.address.family,
        lookup: (_host, _options, callback) => callback(null, input.address.address, input.address.family),
        signal: input.signal,
      },
      (response) => {
        const headers = new Headers();
        for (const name of responseHeaders) {
          const value = response.headers[name];
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        const status = response.statusCode ?? 0;
        if (input.method === 'HEAD' || (status >= 300 && status < 400)) {
          response.destroy();
          resolve({ status, headers, body: new Uint8Array() });
          return;
        }
        const length = Number(headers.get('content-length'));
        if (Number.isFinite(length) && length > input.maxBytes) {
          response.destroy();
          req.destroy();
          reject(new SafeNetworkError('response_too_large'));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > input.maxBytes) {
            response.destroy();
            req.destroy();
            reject(new SafeNetworkError('response_too_large'));
          } else chunks.push(chunk);
        });
        response.once('end', () => resolve({ status, headers, body: Buffer.concat(chunks) }));
        response.once('error', () => reject(new SafeNetworkError('network')));
        response.once('aborted', () => reject(new SafeNetworkError('network')));
      },
    );
    req.once('error', () => reject(new SafeNetworkError('network')));
    req.end();
  });

const nativeDependencies: NetworkDependencies = {
  lookup: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  transport: nativeTransport,
};

function boundedNumber(value: number | undefined, fallback: number, max: number): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < 1 || result > max) throw new SafeNetworkError('unsafe_url');
  return result;
}

/** DNS, connect, response and all redirect hops share one elapsed-time budget. */
export async function safeRequest(
  input: string,
  options: RequestOptions = {},
  dependencies: NetworkDependencies = nativeDependencies,
): Promise<NetworkResponse> {
  const initial = checkedUrl(input);
  const headers = requestHeaders(options.headers, options.refererOrigin);
  const allowed = options.allowedOrigins ?? [initial.origin];
  if (!allowed.includes(initial.origin)) throw new SafeNetworkError('unsafe_url');
  const hasCredential = 'authorization' in headers || 'x-goog-api-key' in headers;
  if (hasCredential && (!options.allowedOrigins || options.sameDomainRedirects))
    throw new SafeNetworkError('unsafe_headers');
  const timeoutMs = boundedNumber(options.timeoutMs, 10_000, 60_000);
  const maxBytes = boundedNumber(options.maxBytes, 5 * 1024 * 1024, 5 * 1024 * 1024);
  const maxRedirects = options.maxRedirects ?? 5;
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 5)
    throw new SafeNetworkError('unsafe_url');
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const signal = controller.signal;
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abortListener = () => reject(new SafeNetworkError(timedOut ? 'timeout' : 'aborted'));
    signal.addEventListener('abort', abortListener, { once: true });
    if (signal.aborted) abortListener();
  });
  const operation = async (): Promise<NetworkResponse> => {
    let url = initial;
    let currentHeaders = headers;
    for (let hop = 0; ; hop += 1) {
      if (signal.aborted) throw new SafeNetworkError(timedOut ? 'timeout' : 'aborted');
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await dependencies.lookup(hostname);
      if (signal.aborted) throw new SafeNetworkError(timedOut ? 'timeout' : 'aborted');
      if (
        addresses.length === 0 ||
        addresses.some((entry) => entry.family !== isIP(entry.address) || !isPublicAddress(entry.address))
      )
        throw new SafeNetworkError('unsafe_address');
      const address = addresses[0]!;
      const response = await dependencies.transport({
        url,
        method: options.method ?? 'GET',
        headers: currentHeaders,
        address,
        maxBytes,
        signal,
      });
      if (response.body.byteLength > maxBytes) throw new SafeNetworkError('response_too_large');
      if (![301, 302, 303, 307, 308].includes(response.status)) return { ...response, url: url.href };
      const location = response.headers.get('location');
      if (!location) throw new SafeNetworkError('redirect_blocked');
      let next: URL;
      try {
        next = checkedUrl(new URL(location, url).href);
      } catch {
        throw new SafeNetworkError('redirect_blocked');
      }
      const sameWebsite =
        options.sameDomainRedirects &&
        next.hostname.replace(/^www\./, '') === initial.hostname.replace(/^www\./, '');
      if (
        (!allowed.includes(next.origin) && !sameWebsite) ||
        (hasCredential && next.origin !== initial.origin)
      )
        throw new SafeNetworkError('redirect_blocked');
      if (hop >= maxRedirects) throw new SafeNetworkError('too_many_redirects');
      if (next.origin !== url.origin && 'referer' in currentHeaders) {
        currentHeaders = { ...currentHeaders };
        delete currentHeaders.referer;
      }
      url = next;
    }
  };
  try {
    return await Promise.race([operation(), aborted]);
  } catch (error) {
    if (signal.aborted) throw new SafeNetworkError(timedOut ? 'timeout' : 'aborted');
    if (error instanceof SafeNetworkError) throw error;
    throw new SafeNetworkError('network');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
    if (abortListener) signal.removeEventListener('abort', abortListener);
  }
}
