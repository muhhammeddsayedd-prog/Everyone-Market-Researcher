import 'server-only';
import { request, type RequestOptions } from 'node:https';
import { lookup } from 'node:dns/promises';
import { checkServerIdentity } from 'node:tls';
import { isIP } from 'node:net';
import type { LookupAddress } from 'node:dns';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { mediaSignedUpload, mediaStoragePath } from '@emr/shared';
import { publicApifyAddresses } from './n8n-worker/apify-reader';
import { devMediaStorageOrigin, type MediaPorts } from '../../../n8n/media/worker';

export type MediaHttpsTransport = (
  options: RequestOptions,
  listener: (response: IncomingMessage) => void,
) => ClientRequest;
export type MediaAddressResolver = (hostname: string) => Promise<LookupAddress[]>;
export type MediaHttpPorts = Pick<MediaPorts, 'download' | 'sign' | 'upload'> & {
  preflight(signal: AbortSignal): Promise<void>;
};
export interface MediaHttpOptions {
  previewOrigin: string;
  webhookSecret: string;
  protectionBypass: string;
  transport?: MediaHttpsTransport;
  resolver?: MediaAddressResolver;
}
const rejected = () => Error('EMR_MEDIA_HTTP_REJECTED');
const maxImage = 5 * 1024 * 1024;
const maxJpeg = 2 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function publicUrl(value: string): URL {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\\\u0000-\u001f\u007f]/.test(value))
    throw rejected();
  const url = new URL(value),
    labels = url.hostname.split('.');
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    ['local', 'internal', 'localhost', 'test', 'invalid', 'example', 'onion', 'lan', 'home', 'arpa'].includes(
      labels.at(-1) ?? '',
    )
  )
    throw rejected();
  return url;
}

/** One native HTTPS request. Reuses the reviewed conservative address policy;
 * resolved addresses are pinned while TLS still authenticates the source host.
 * Raw native errors, credential headers and response bodies never escape. */
async function boundedRequest(
  url: URL,
  method: 'GET' | 'POST' | 'PUT' | 'HEAD',
  headers: Record<string, string>,
  body: Buffer | undefined,
  mode: 'image' | 'json' | 'status' | 'head',
  maxBytes: number,
  timeoutMs: number,
  signal: AbortSignal,
  transport: MediaHttpsTransport,
  resolver: MediaAddressResolver,
): Promise<{ status: number; bytes: Uint8Array; contentType: string }> {
  if (signal.aborted) throw rejected();
  const controller = new AbortController(),
    abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal.addEventListener('abort', abort, { once: true });
  let cancelDns: (() => void) | undefined;
  try {
    const address = publicApifyAddresses(
      await Promise.race([
        resolver(url.hostname),
        new Promise<never>((_resolve, reject) => {
          cancelDns = () => reject(rejected());
          controller.signal.addEventListener('abort', cancelDns, { once: true });
        }),
      ]),
    );
    if (controller.signal.aborted) throw rejected();
    return await new Promise((resolve, reject) => {
      let req: ClientRequest | undefined, res: IncomingMessage | undefined;
      let reqClosed = false,
        socketSeen = false,
        socketClosed = false,
        failed = false,
        ended = false,
        settled = false;
      let result: { status: number; bytes: Uint8Array; contentType: string } | undefined;
      const finish = () => {
        if (settled || !reqClosed || (socketSeen && !socketClosed)) return;
        settled = true;
        controller.signal.removeEventListener('abort', stop);
        if (failed || !ended || !result) reject(rejected());
        else resolve(result);
      };
      const stop = () => {
        failed = true;
        res?.destroy();
        req?.destroy();
        finish();
      };
      try {
        req = transport(
          {
            protocol: 'https:',
            hostname: url.hostname,
            servername: url.hostname,
            port: 443,
            method,
            path: url.pathname + url.search,
            agent: false,
            family: address.family,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            checkServerIdentity,
            maxHeaderSize: 8192,
            lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
            headers: { 'accept-encoding': 'identity', connection: 'close', ...headers },
          },
          (response) => {
            res = response;
            response.once('aborted', stop);
            response.once('error', stop);
            response.once('close', () => {
              if (!ended) stop();
            });
            const status = response.statusCode ?? 0;
            if (status < 200 || status > 599 || (status >= 300 && status < 400)) {
              stop();
              return;
            }
            if (mode === 'image' && status !== 200) {
              result = { status, bytes: new Uint8Array(), contentType: '' };
              ended = true;
              req?.destroy();
              return;
            }
            const length = response.headers['content-length'],
              encoding = response.headers['content-encoding'];
            const mime =
              String(response.headers['content-type'] ?? '')
                .split(';')[0]
                ?.trim()
                .toLowerCase() ?? '';
            const validLength =
              length === undefined ||
              (/^(0|[1-9][0-9]*)$/.test(length) &&
                Number.isSafeInteger(Number(length)) &&
                Number(length) <= maxBytes);
            if (
              !validLength ||
              (length !== undefined && response.headers['transfer-encoding'] !== undefined) ||
              (encoding !== undefined && encoding !== 'identity') ||
              (mode === 'image' && !imageTypes.has(mime)) ||
              (mode === 'json' && (status !== 200 || mime !== 'application/json')) ||
              (mode === 'head' &&
                (status !== 204 ||
                  (length !== undefined && length !== '0') ||
                  response.headers['transfer-encoding'] !== undefined))
            ) {
              stop();
              return;
            }
            const parts: Buffer[] = [];
            let size = 0;
            response.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > maxBytes) {
                stop();
                return;
              }
              parts.push(chunk);
            });
            response.once('end', () => {
              if (
                !response.complete ||
                (length !== undefined && Number(length) !== size) ||
                (mode === 'image' && size === 0)
              ) {
                stop();
                return;
              }
              result = { status, bytes: new Uint8Array(Buffer.concat(parts, size)), contentType: mime };
              ended = true;
              req?.destroy();
              finish();
            });
          },
        );
        req.once('socket', (socket) => {
          socketSeen = true;
          socket.once('close', () => {
            socketClosed = true;
            finish();
          });
        });
        req.once('close', () => {
          reqClosed = true;
          finish();
        });
        req.once('error', stop);
        controller.signal.addEventListener('abort', stop, { once: true });
        req.setTimeout(timeoutMs, stop);
        req.end(body);
      } catch {
        failed = true;
        if (req) stop();
        else {
          reqClosed = true;
          finish();
        }
      }
    });
  } catch {
    throw rejected();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (cancelDns) controller.signal.removeEventListener('abort', cancelDns);
  }
}

/** Runtime-scoped capabilities are single-use. A failed/uncertain PUT must be
 * reconciled by the existing worker/SQL path, never retried by this adapter. */
export function createMediaHttpPorts(options: MediaHttpOptions): MediaHttpPorts {
  let origin: URL;
  try {
    origin = publicUrl(options.previewOrigin);
    if (
      origin.origin !== options.previewOrigin ||
      !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(origin.hostname) ||
      typeof options.webhookSecret !== 'string' ||
      !/^[!-~]{32,256}$/.test(options.webhookSecret) ||
      typeof options.protectionBypass !== 'string' ||
      !/^[!-~]{16,4096}$/.test(options.protectionBypass)
    )
      throw rejected();
  } catch {
    throw Error('EMR_MEDIA_HTTP_BINDING_INVALID');
  }
  const signingUrl = new URL('/api/internal/media-upload-url', origin);
  const headers = {
    'x-emr-secret': options.webhookSecret,
    'x-vercel-protection-bypass': options.protectionBypass,
  };
  const transport = options.transport ?? request;
  const resolver = options.resolver ?? ((hostname) => lookup(hostname, { all: true }));
  const capabilities = new Set<string>();
  return {
    async preflight(signal) {
      await boundedRequest(
        signingUrl,
        'HEAD',
        headers,
        undefined,
        'head',
        0,
        8000,
        signal,
        transport,
        resolver,
      );
    },
    async download(value, input, signal) {
      try {
        if (
          !Number.isSafeInteger(input.maxBytes) ||
          input.maxBytes < 1 ||
          input.maxBytes > maxImage ||
          input.timeoutMs !== 20000 ||
          input.redirect !== 'error' ||
          input.accept !== 'image/jpeg,image/png,image/webp'
        )
          throw rejected();
        const url = publicUrl(value);
        if (/\.(?:mp4|mov|m3u8|webm|mp3|wav)(?:$|\/)/i.test(url.pathname)) throw rejected();
        return await boundedRequest(
          url,
          'GET',
          { accept: input.accept, 'user-agent': 'Mozilla/5.0 (compatible; EveryoneMarketRadar/1.0)' },
          undefined,
          'image',
          input.maxBytes,
          20000,
          signal,
          transport,
          resolver,
        );
      } catch {
        throw rejected();
      }
    },
    async sign(path, signal) {
      try {
        const parsedPath = mediaStoragePath.parse(path);
        if (capabilities.size >= 50) throw rejected();
        const body = Buffer.from(JSON.stringify({ path: parsedPath }));
        const response = await boundedRequest(
          signingUrl,
          'POST',
          { ...headers, 'content-type': 'application/json', 'content-length': String(body.length) },
          body,
          'json',
          8192,
          8000,
          signal,
          transport,
          resolver,
        );
        const cap = mediaSignedUpload.parse(
          JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.bytes)),
        );
        const url = publicUrl(cap.signedUrl);
        if (
          cap.path !== parsedPath ||
          url.origin !== devMediaStorageOrigin ||
          url.pathname !== `/storage/v1/object/upload/sign/media/${parsedPath}` ||
          url.searchParams.size !== 1 ||
          url.searchParams.get('token') !== cap.token
        )
          throw rejected();
        capabilities.add(cap.signedUrl);
        return cap;
      } catch {
        throw rejected();
      }
    },
    async upload(value, bytes, input, signal) {
      try {
        if (!capabilities.delete(value)) throw rejected();
        const url = publicUrl(value);
        if (
          url.origin !== devMediaStorageOrigin ||
          input.upsert !== false ||
          input.contentType !== 'image/jpeg' ||
          !(bytes instanceof Uint8Array) ||
          bytes.length < 4 ||
          bytes.length > maxJpeg ||
          bytes[0] !== 255 ||
          bytes[1] !== 216 ||
          bytes.at(-2) !== 255 ||
          bytes.at(-1) !== 217
        )
          throw rejected();
        const body = Buffer.from(bytes);
        const response = await boundedRequest(
          url,
          'PUT',
          { 'content-type': 'image/jpeg', 'content-length': String(body.length) },
          body,
          'status',
          8192,
          20000,
          signal,
          transport,
          resolver,
        );
        return { status: response.status };
      } catch {
        throw rejected();
      }
    },
  };
}
