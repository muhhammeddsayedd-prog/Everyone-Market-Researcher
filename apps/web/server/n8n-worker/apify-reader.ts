import 'server-only';
import { request, type RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { lookup as nativeLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { createApifyRecoveryRuntime, foundationSmokeInput } from '@emr/shared';

const reject = () => new Error('EMR_APIFY_RESPONSE_REJECTED');
type Transport = (options: RequestOptions, listener: (res: IncomingMessage) => void) => ClientRequest;
type Resolver = () => Promise<LookupAddress[]>;
// Same conservative address policy as the reviewed fixed GW-01 transport;
// unlike that closed trial, this reader creates no request/window authority.
export function publicApifyAddresses(rows: LookupAddress[]) {
  const publicAddress = (value: string) => {
    if (isIP(value) === 4) {
      const [a, b, c] = value.split('.').map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a! >= 224 ||
        (a === 100 && b! >= 64 && b! <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b! >= 16 && b! <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0 && [0, 2].includes(c!)) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113)
      );
    }
    if (isIP(value) !== 6 || value.includes('%') || value.includes('.')) return false;
    const [first = '', second = ''] = value.toLowerCase().split(':'),
      a = Number.parseInt(first, 16),
      b = second ? Number.parseInt(second, 16) : 0;
    return (
      a >= 0x2000 &&
      a <= 0x3fff &&
      a !== 0x2002 &&
      !(a === 0x2001 && (b <= 0x1ff || b === 0xdb8)) &&
      !(a === 0x3fff && b <= 0xfff)
    );
  };
  if (
    !Array.isArray(rows) ||
    rows.length === 0 ||
    rows.length > 100 ||
    rows.some((r) => !r || r.family !== isIP(r.address) || !publicAddress(r.address))
  )
    throw reject();
  return rows.find((r) => r.family === 4) ?? rows[0]!;
}
/** Fixed origin, streaming limit before concatenation/parsing, one request and no redirects. */
export async function boundedApifyJson(
  path: string,
  token: string,
  maxBytes: number,
  transport: Transport = request,
  signal?: AbortSignal,
  resolver: Resolver = () => nativeLookup('api.apify.com', { all: true }),
): Promise<unknown> {
  return boundedJson(path, token, maxBytes, transport, signal, resolver, false);
}
/** Fixed M04 terminal/dataset GETs reuse the same strict-TLS, public-DNS,
 * streaming-size and socket-closure implementation. Never accepts a URL/host.
 */
export async function boundedCollectorApifyJson(
  path: string,
  token: string,
  maxBytes: number,
  transport: Transport = request,
  signal?: AbortSignal,
  resolver: Resolver = () => nativeLookup('api.apify.com', { all: true }),
): Promise<unknown> {
  return boundedJson(path, token, maxBytes, transport, signal, resolver, true);
}
async function boundedJson(
  path: string,
  token: string,
  maxBytes: number,
  transport: Transport,
  signal: AbortSignal | undefined,
  resolver: Resolver,
  collector: boolean,
): Promise<unknown> {
  const collectorPath =
    /^\/v2\/(?:actor-runs\/[A-Za-z0-9_-]{1,128}|key-value-stores\/[A-Za-z0-9_-]{1,128}\/records\/INPUT|datasets\/[A-Za-z0-9_-]{1,128}\/items\?format=json&offset=(?:0|[1-9][0-9]{0,4})&limit=500&skipHidden=true)$/.test(
      path,
    );
  if (
    !(collector
      ? collectorPath
      : /^\/v2\/(?:actor-runs\/[A-Za-z0-9_-]{1,128}|key-value-stores\/[A-Za-z0-9_-]{1,128}\/records\/INPUT|datasets\/[A-Za-z0-9_-]{1,128}\/items\?format=json&offset=0&limit=2&skipHidden=true&fields=url%2Cmarkdown%2Cmetadata%2Ccrawl%2Cerror)$/.test(
          path,
        )) ||
    typeof token !== 'string' ||
    token.length < 1 ||
    /[\r\n]/.test(token) ||
    !(collector ? [65536, 4194304] : [4096, 65536, 262144, 64]).includes(maxBytes)
  )
    throw new Error('EMR_APIFY_READER_INPUT_INVALID');
  if (signal?.aborted) throw reject();
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const overall = setTimeout(abort, 15000);
  let cancelDns: (() => void) | undefined;
  try {
    const address = publicApifyAddresses(
      await Promise.race([
        resolver(),
        new Promise<never>((_resolve, rejectDns) => {
          cancelDns = () => rejectDns(reject());
          controller.signal.addEventListener('abort', cancelDns, { once: true });
        }),
      ]),
    );
    if (controller.signal.aborted) throw reject();
    return await new Promise((resolve, rejectPromise) => {
      let result: unknown,
        response: IncomingMessage | undefined,
        failure = false,
        ended = false,
        socketClosed = false,
        settled = false;
      let req: ClientRequest;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled || !socketClosed) return;
        settled = true;
        clearTimeout(deadline);
        controller.signal.removeEventListener('abort', stop);
        if (failure || !ended) rejectPromise(reject());
        else resolve(result);
      };
      const stop = () => {
        failure = true;
        response?.destroy();
        req?.destroy();
        finish();
      };
      try {
        req = transport(
          {
            protocol: 'https:',
            hostname: 'api.apify.com',
            servername: 'api.apify.com',
            port: 443,
            method: 'GET',
            path,
            agent: false,
            family: address.family,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            lookup: (_host, _options, callback) => callback(null, address.address, address.family),
            headers: {
              authorization: 'Bearer ' + token,
              accept: 'application/json',
              'accept-encoding': 'identity',
              connection: 'close',
            },
          },
          (res) => {
            response = res;
            const length = res.headers['content-length'],
              encoding = res.headers['content-encoding'];
            const validLength =
              length === undefined ||
              (/^(0|[1-9][0-9]*)$/.test(length) &&
                Number.isSafeInteger(Number(length)) &&
                Number(length) <= maxBytes);
            if (
              res.statusCode !== 200 ||
              !validLength ||
              (length !== undefined && res.headers['transfer-encoding'] !== undefined) ||
              (encoding !== undefined && encoding !== 'identity') ||
              !/^application\/json(?:\s*;|$)/i.test(String(res.headers['content-type'] ?? ''))
            ) {
              stop();
              return;
            }
            const parts: Buffer[] = [];
            let bytes = 0;
            res.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > maxBytes) {
                stop();
                return;
              }
              parts.push(chunk);
            });
            res.once('aborted', stop);
            res.once('error', stop);
            res.once('end', () => {
              if (!res.complete || (length !== undefined && Number(length) !== bytes)) {
                stop();
                return;
              }
              try {
                result = JSON.parse(
                  new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts, bytes)),
                );
                ended = true;
              } catch {
                failure = true;
              }
              req.destroy();
              finish();
            });
            res.once('close', () => {
              if (!ended) stop();
            });
          },
        );
        req.once('socket', (socket) => {
          socket.once('close', () => {
            socketClosed = true;
            finish();
          });
        });
        req.once('error', () => {
          failure = true;
          if (!req.socket) {
            socketClosed = true;
          }
          finish();
        });
        controller.signal.addEventListener('abort', stop, { once: true });
        deadline = setTimeout(stop, 15000);
        req.setTimeout(15000, stop);
        req.end();
      } catch {
        failure = true;
        socketClosed = true;
        finish();
      }
    });
  } catch {
    throw reject();
  } finally {
    clearTimeout(overall);
    signal?.removeEventListener('abort', abort);
    if (cancelDns) controller.signal.removeEventListener('abort', cancelDns);
  }
}

type Reader = (path: string, token: string, maxBytes: number) => Promise<unknown>;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (object(v))
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(v);
};
// Immutable public build inputSchema, GET 2026-10-18T23:32:44.826Z:
// https://api.apify.com/v2/actor-builds/BdKJRCYsnmlzPfH3n
// Platform defaults apply to API starts too:
// https://docs.apify.com/actors/development/actor-definition/input-schema/specification/v1
export const pinnedInputDefaults: Readonly<Record<string, unknown>> = Object.freeze({
  crawlerType: 'playwright:firefox',
  includeUrlGlobs: [],
  excludeUrlGlobs: [],
  maxCrawlDepth: 20,
  maxCrawlPages: 9999999,
  useSitemaps: false,
  onlyCrawlPagesModifiedSince: '',
  useLlmsTxt: false,
  respectRobotsTxtFile: false,
  keepUrlFragments: false,
  ignoreCanonicalUrl: false,
  proxyConfiguration: { useApifyProxy: true },
  customHttpHeaders: {},
  signHttpRequests: false,
  initialConcurrency: 0,
  maxConcurrency: 200,
  requestTimeoutSecs: 60,
  minFileDownloadSpeedKBps: 128,
  maxRequestRetries: 3,
  maxSessionRotations: 10,
  ignoreHttpsErrors: false,
  dynamicContentWaitSecs: 10,
  waitForSelector: '',
  softWaitForSelector: '',
  maxScrollHeightPixels: 5000,
  removeCookieWarnings: true,
  blockMedia: false,
  expandIframes: true,
  clickElementsCssSelector: '[aria-expanded="false"]',
  pageFunction: '',
  keepElementsCssSelector: '',
  removeElementsCssSelector:
    'nav, footer, script, style, noscript, svg, img[src^=\'data:\'],\n[role="alert"],\n[role="banner"],\n[role="dialog"],\n[role="alertdialog"],\n[role="region"][aria-label*="skip" i],\n[aria-modal="true"]',
  htmlTransformer: 'readableText',
  readableTextCharThreshold: 100,
  aggressivePrune: false,
  debugMode: false,
  debugLog: false,
  storeSkippedUrls: false,
  saveHtml: false,
  saveHtmlAsFile: false,
  saveMarkdown: true,
  summarize: false,
  saveFiles: false,
  saveScreenshots: false,
  maxResults: 9999999,
  clientSideMinChangePercentage: 15,
  renderingTypeDetectionPercentage: 10,
  reuseStoredDetectionResults: false,
});
export function projectFoundationInput(input: unknown) {
  const bad = () => {
    throw new Error('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
  };
  if (!object(input)) return bad();
  for (const [key, value] of Object.entries(foundationSmokeInput))
    if (!Object.hasOwn(input, key) || canonical(input[key]) !== canonical(value)) return bad();
  for (const key of Object.keys(input))
    if (
      !Object.hasOwn(foundationSmokeInput, key) &&
      (!Object.hasOwn(pinnedInputDefaults, key) ||
        canonical(input[key]) !== canonical(pinnedInputDefaults[key]))
    )
      return bad();
  return structuredClone(foundationSmokeInput);
}
/** Server-owned admission + original ID hint; authenticated metadata owns all registration fields. */
export async function readFoundationLaunch(context: unknown, token: string, get: Reader = boundedApifyJson) {
  const bad = () => {
    throw new Error('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
  };
  if (
    !object(context) ||
    !object(context.launch) ||
    typeof context.apify_run_id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(context.apify_run_id)
  )
    return bad();
  const saved = context.launch;
  if (
    saved.actor_id !== 'aYG0l9s7dbB7j3gbS' ||
    saved.actor_build !== '0.3.99' ||
    (saved.apify_run_id !== null && saved.apify_run_id !== context.apify_run_id) ||
    !object(saved.input) ||
    canonical(saved.input) !== canonical(foundationSmokeInput) ||
    typeof saved.post_intent_at !== 'string' ||
    !Number.isFinite(Date.parse(saved.post_intent_at))
  )
    return bad();
  const response = await get('/v2/actor-runs/' + context.apify_run_id, token, 65536);
  if (!object(response) || !object(response.data)) return bad();
  const d = response.data,
    options = object(d.options) ? d.options : {};
  if (
    d.id !== context.apify_run_id ||
    d.actId !== 'aYG0l9s7dbB7j3gbS' ||
    d.buildNumber !== '0.3.99' ||
    d.buildId !== 'BdKJRCYsnmlzPfH3n' ||
    typeof d.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(d.startedAt)) ||
    Date.parse(d.startedAt) < Date.parse(saved.post_intent_at) - 5000 ||
    Date.parse(d.startedAt) > Date.parse(saved.post_intent_at) + 300000 ||
    options.memoryMbytes !== 1024 ||
    options.timeoutSecs !== 300 ||
    options.maxTotalChargeUsd !== saved.max_total_charge_usd ||
    typeof d.defaultKeyValueStoreId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(d.defaultKeyValueStoreId)
  )
    return bad();
  const input = await get('/v2/key-value-stores/' + d.defaultKeyValueStoreId + '/records/INPUT', token, 4096);
  const projected = projectFoundationInput(input);
  return {
    launch: {
      launch_id: saved.launch_id,
      apify_run_id: d.id,
      actor_id: d.actId,
      actor_build: d.buildNumber,
      started_at: d.startedAt,
      input: projected,
    },
    transport: { requests: 2, retries: 0, socketsClosed: true, runBytesMax: 65536, inputBytesMax: 4096 },
  };
}
export async function readFoundationTerminal(
  registry: unknown,
  token: string,
  get: Reader = boundedApifyJson,
) {
  const runtime = createApifyRecoveryRuntime();
  if (!object(registry)) throw new Error('EMR_APIFY_READER_INPUT_INVALID');
  const registered = runtime.registry(registry, registry.apify_run_id);
  if (registered.processed_at !== null) throw new Error('EMR_APIFY_READER_INPUT_INVALID');
  const metadata = await get('/v2/actor-runs/' + registered.apify_run_id, token, 65536);
  if (
    !object(metadata) ||
    !object(metadata.data) ||
    metadata.data.buildId !== 'BdKJRCYsnmlzPfH3n' ||
    metadata.data.buildNumber !== '0.3.99'
  )
    throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');
  return {
    terminal: runtime.projectTerminal(metadata, registered),
    transport: { runBytesMax: 65536, requests: 1, retries: 0, socketsClosed: true },
  };
}
/** Input is the server's registered row, never a caller-supplied dataset id or URL. */
export async function readFoundationDataset(
  registry: unknown,
  token: string,
  get: Reader = boundedApifyJson,
) {
  const runtime = createApifyRecoveryRuntime();
  if (!object(registry)) throw new Error('EMR_APIFY_READER_INPUT_INVALID');
  const registered = runtime.registry(registry, registry.apify_run_id);
  if (registered.processed_at !== null) throw new Error('EMR_APIFY_READER_INPUT_INVALID');
  const metadata = await get('/v2/actor-runs/' + registered.apify_run_id, token, 65536);
  if (
    !object(metadata) ||
    !object(metadata.data) ||
    metadata.data.buildId !== 'BdKJRCYsnmlzPfH3n' ||
    metadata.data.buildNumber !== '0.3.99'
  )
    throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');
  const terminal = runtime.projectTerminal(metadata, registered);
  if (terminal.status !== 'SUCCEEDED' || terminal.datasetId === null)
    throw new Error('EMR_APIFY_DATASET_INVALID');
  const data = await get(
    '/v2/datasets/' +
      terminal.datasetId +
      '/items?format=json&offset=0&limit=2&skipHidden=true&fields=url%2Cmarkdown%2Cmetadata%2Ccrawl%2Cerror',
    token,
    262144,
  );
  const page = 'https://everyone.film/about-everyone',
    associated = ['https://everyone.film', 'https://everyone.film/', page];
  if (!Array.isArray(data) || data.length !== 1) throw new Error('EMR_APIFY_DATASET_INVALID');
  const row: unknown = data[0];
  if (
    !object(row) ||
    row.url !== page ||
    row.error !== undefined ||
    typeof row.markdown !== 'string' ||
    (row.metadata != null && !object(row.metadata)) ||
    (row.crawl != null && !object(row.crawl))
  )
    throw new Error('EMR_APIFY_DATASET_INVALID');
  const metadataRow = object(row.metadata) ? row.metadata : {},
    crawl = object(row.crawl) ? row.crawl : {};
  if (metadataRow.title != null && typeof metadataRow.title !== 'string')
    throw new Error('EMR_APIFY_DATASET_INVALID');
  for (const url of [metadataRow.canonicalUrl, crawl.loadedUrl, crawl.referrerUrl])
    if (url !== undefined && url !== null && url !== '' && !associated.includes(url as string))
      throw new Error('EMR_APIFY_DATASET_INVALID');
  const bounded = (v: string, n: number) => {
    const text = v.slice(0, n),
      last = text.charCodeAt(text.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? text.slice(0, -1) : text;
  };
  return {
    terminal,
    rows: [
      {
        url: page,
        markdown: bounded(row.markdown, 8000),
        metadata: {
          title:
            typeof metadataRow.title === 'string' && metadataRow.title !== ''
              ? bounded(metadataRow.title, 2000)
              : null,
        },
      },
    ],
    transport: { runBytesMax: 65536, datasetBytesMax: 262144, requests: 2, retries: 0, socketsClosed: true },
  };
}
