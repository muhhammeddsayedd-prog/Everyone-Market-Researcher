import 'server-only';
import { request as nativeRequest, type RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { upkeepSourcePins } from '@emr/shared';
import { publicApifyAddresses } from './n8n-worker/apify-reader';
import type { UpkeepSourcePorts } from '../../../n8n/collectors/upkeep-sources.mjs';

type Source = 'vimeo' | 'youtube' | 'apify';
type Transport = (options: RequestOptions, listener: (response: IncomingMessage) => void) => ClientRequest;
type Resolver = (hostname: string) => Promise<LookupAddress[]>;
const reject = () => new Error('M06_UPKEEP_SOURCE_TRANSPORT_BLOCKED');
const hosts = { vimeo: 'api.vimeo.com', youtube: 'www.googleapis.com', apify: 'api.apify.com' };
/** Reuse the existing conservative public resolved-address policy, native TLS,
 * bounded streaming and cancellation. GET only; no redirect or paid-start path. */
export async function readUpkeepSourceJson(
  source: Source,
  address: string,
  env: Record<string, string | undefined>,
  signal?: AbortSignal,
  transport: Transport = nativeRequest,
  resolver: Resolver = (hostname) => lookup(hostname, { all: true }),
) {
  const url = new URL(address),
    host = hosts[source];
  if (
    !host ||
    url.protocol !== 'https:' ||
    url.hostname !== host ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.has('key') ||
    url.searchParams.has('token') ||
    !(source === 'vimeo'
      ? /^\/(?:users|channels|groups)\/[A-Za-z0-9_-]+(?:\/albums\/\d+)?\/videos$/.test(url.pathname)
      : source === 'youtube'
        ? /^\/youtube\/v3\/(?:playlistItems|videos)$/.test(url.pathname)
        : /^\/v2\/(?:actor-runs\/[A-Za-z0-9_-]+|key-value-stores\/[A-Za-z0-9_-]+\/records\/INPUT|datasets\/[A-Za-z0-9_-]+(?:\/items)?)$/.test(
            url.pathname,
          ))
  )
    throw reject();
  const token =
    env[
      source === 'vimeo'
        ? 'EMR_UPKEEP_VIMEO_TOKEN'
        : source === 'youtube'
          ? 'EMR_UPKEEP_YOUTUBE_API_KEY'
          : 'EMR_UPKEEP_APIFY_READ_TOKEN'
    ];
  if (!token || /[\r\n]/.test(token)) throw new Error('M06_UPKEEP_SOURCE_BINDING_REQUIRED');
  if (source === 'youtube') url.searchParams.set('key', token);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 8000);
  let req: ClientRequest | undefined, response: IncomingMessage | undefined;
  try {
    if (controller.signal.aborted) throw reject();
    const aborted = new Promise<never>((_, fail) => {
      if (controller.signal.aborted) fail(reject());
      else
        controller.signal.addEventListener(
          'abort',
          () => {
            response?.destroy();
            req?.destroy();
            fail(reject());
          },
          { once: true },
        );
    });
    const resolved = publicApifyAddresses(await Promise.race([resolver(host), aborted]));
    if (controller.signal.aborted) throw reject();
    return await Promise.race([
      new Promise<{ status: number; body: unknown; headers: Record<string, string> }>((resolve, fail) => {
        const parts: Buffer[] = [];
        let size = 0,
          complete = false,
          requestClosed = false,
          responseClosed = false;
        let result: { status: number; body: unknown; headers: Record<string, string> } | undefined;
        const finish = () => {
          if (!requestClosed || !responseClosed) return;
          if (complete && result) resolve(result);
          else fail(reject());
        };
        req = transport(
          {
            hostname: host,
            servername: host,
            port: 443,
            protocol: 'https:',
            path: url.pathname + url.search,
            method: 'GET',
            agent: false,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            family: resolved.family,
            lookup: (_h, _o, cb) => cb(null, resolved.address, resolved.family),
            headers: {
              ...(source === 'youtube' ? {} : { authorization: 'Bearer ' + token }),
              accept: 'application/json',
              'accept-encoding': 'identity',
              connection: 'close',
            },
          },
          (res) => {
            response = res;
            res.on('error', () => {
              req?.destroy();
            });
            res.on('close', () => {
              responseClosed = true;
              finish();
            });
            res.on('data', (part: Buffer) => {
              size += part.length;
              if (size > 2097152) {
                res.destroy();
                req?.destroy();
              } else parts.push(part);
            });
            res.on('end', () => {
              try {
                if (
                  !res.complete ||
                  !res.statusCode ||
                  (res.statusCode >= 300 && res.statusCode < 400) ||
                  res.headers['content-encoding'] ||
                  res.headers.location
                )
                  throw reject();
                result = {
                  status: res.statusCode,
                  body: JSON.parse(Buffer.concat(parts).toString('utf8')),
                  headers: {},
                };
                complete = true;
              } catch {
                req?.destroy();
              }
              finish();
            });
          },
        );
        req.on('error', () => {
          response?.destroy();
        });
        req.on('close', () => {
          requestClosed = true;
          if (!response) responseClosed = true;
          finish();
        });
        req.end();
      }),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    response?.destroy();
    req?.destroy();
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function upkeepSourcePorts(env: Record<string, string | undefined>): UpkeepSourcePorts {
  return {
    request: (input) => readUpkeepSourceJson(input.source, input.url, env, input.signal),
    actorSnapshot: async (input) => {
      const pins = upkeepSourcePins.parse(JSON.parse(env.EMR_UPKEEP_SOURCE_PINS ?? '{}'));
      const pin = pins[input.actor];
      if (!pin) throw new Error('M06_UPKEEP_SOURCE_PIN_REQUIRED');
      const get = async (path: string) => {
        const response = await readUpkeepSourceJson(
          'apify',
          'https://api.apify.com' + path,
          env,
          input.signal,
        );
        if (response.status !== 200) throw reject();
        return response.body;
      };
      const runBody = await get('/v2/actor-runs/' + input.run_id);
      const run = record(runBody) && record(runBody.data) ? runBody.data : null;
      if (
        !run ||
        run.id !== input.run_id ||
        run.actId !== pin.actor_id ||
        run.buildId !== pin.build_id ||
        run.status !== 'SUCCEEDED' ||
        typeof run.defaultDatasetId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(run.defaultDatasetId) ||
        typeof run.defaultKeyValueStoreId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(run.defaultKeyValueStoreId)
      )
        throw reject();
      const actualInput = await get('/v2/key-value-stores/' + run.defaultKeyValueStoreId + '/records/INPUT');
      const dataBody = await get('/v2/datasets/' + run.defaultDatasetId);
      const data = record(dataBody) && record(dataBody.data) ? dataBody.data : null;
      if (
        !data ||
        data.id !== run.defaultDatasetId ||
        !Number.isSafeInteger(data.itemCount) ||
        Number(data.itemCount) < 0 ||
        Number(data.itemCount) > 5000
      )
        throw reject();
      const items: unknown[] = [];
      for (let offset = 0; offset < Number(data.itemCount); offset += 500) {
        const page = await get(
          '/v2/datasets/' +
            run.defaultDatasetId +
            '/items?format=json&offset=' +
            offset +
            '&limit=500&skipHidden=true',
        );
        if (!Array.isArray(page) || page.length !== Math.min(500, Number(data.itemCount) - offset))
          throw reject();
        items.push(...page);
      }
      return {
        run,
        input: actualInput,
        dataset: { id: data.id, itemCount: data.itemCount, offset: 0, limit: 5000, items },
        verified_actor: pin,
      };
    },
  };
}
