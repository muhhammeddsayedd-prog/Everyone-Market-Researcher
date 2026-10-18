import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { SafeNetworkError, safeRequest, type NetworkResponse, type SafeRequest } from './network';

export interface VimeoInput {
  kind: 'user' | 'channel' | 'showcase' | 'group';
  handle: string;
}
export interface YouTubeInput {
  kind: 'handle' | 'channel' | 'user' | 'c';
  value: string;
}
export interface ResolutionPatch {
  resolve_status: 'resolved' | 'failed';
  status?: 'invalid';
  external_id?: string;
  uploads_playlist_id?: string;
  backfill_cursor?: { endpoint: 'channels' | 'albums' | 'groups' };
  last_error: string | null;
}
export interface ProviderDependencies {
  request?: SafeRequest;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
  maxWaitMs?: number;
  /** Default four total attempts; bounded continuations can allow exactly one. */
  youtubeMaxAttempts?: number;
  onYouTubeBadResponse?: (shape: YouTubeBadResponseShape) => void;
}

export type YouTubeBadResponseReason =
  'invalid_schema' | 'missing_items_without_zero' | 'contradictory_count' | 'channel_mismatch';
export interface YouTubeBadResponseShape {
  reason: YouTubeBadResponseReason;
  httpStatus: 200;
  jsonParsed: boolean;
  totalResults: number | null;
  itemCount: number | null;
  topLevelObject: boolean;
  pageInfoPresent: boolean;
  itemsPresent: boolean;
  itemsArray: boolean;
  idString: boolean;
  idMatchesCurrentPattern: boolean;
  contentDetailsObject: boolean;
  relatedPlaylistsObject: boolean;
  uploadsPresent: boolean;
  uploadsString: boolean;
  uploadsMatchesCurrentPattern: boolean;
  unexpectedTopLevelFields: boolean;
  unexpectedItemFields: boolean;
  unexpectedContentDetailsFields: boolean;
  unexpectedRelatedPlaylistFields: boolean;
}

const userAgent = 'everyone-market-radar-seed/0.1 (public account resolution)';
const youtubeResponse = z.strictObject({
  pageInfo: z.strictObject({ totalResults: z.number().int().nonnegative().max(1_000_000) }).optional(),
  items: z
    .array(
      z.strictObject({
        id: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
        contentDetails: z.strictObject({
          relatedPlaylists: z.strictObject({
            uploads: z.string().regex(/^UU[A-Za-z0-9_-]{22}$/),
          }),
        }),
      }),
    )
    .max(1)
    .optional(),
});
const youtubeError = z.object({
  error: z.object({ errors: z.array(z.object({ reason: z.string() })).optional() }),
});
const vimeoUserResponse = z.strictObject({
  uri: z.string().regex(/^\/users\/\d+$/),
  name: z.string().min(1),
  link: z.url(),
});
const vimeoResourceResponse = z.strictObject({ uri: z.string(), name: z.string().min(1) });

function fail(last_error: string, invalid = false): ResolutionPatch {
  return { resolve_status: 'failed', last_error, ...(invalid ? { status: 'invalid' as const } : {}) };
}

function json(response: NetworkResponse): unknown {
  // Request byte limits apply before parsing; schema validation must still pass.
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
  } catch {
    return undefined;
  }
}

function networkCode(error: unknown): string {
  return error instanceof SafeNetworkError ? error.code : 'network';
}

function tokenValid(token: string): boolean {
  return token.length > 0 && token.length <= 8192 && !/[\s\0]/.test(token);
}

function youTubeBadResponseShape(body: unknown, reason: YouTubeBadResponseReason): YouTubeBadResponseShape {
  const record = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const own = (value: Record<string, unknown> | undefined, key: string) =>
    value !== undefined && Object.hasOwn(value, key);
  const extras = (value: Record<string, unknown> | undefined, allowed: string[]) =>
    value !== undefined && Object.keys(value).some((key) => !allowed.includes(key));
  const top = record(body);
  const page = record(top?.pageInfo);
  const items = Array.isArray(top?.items) ? (top.items as unknown[]) : undefined;
  const first = record(items?.[0]);
  const content = record(first?.contentDetails);
  const related = record(content?.relatedPlaylists);
  const total = page?.totalResults;
  const validTotal =
    typeof total === 'number' && Number.isSafeInteger(total) && total >= 0 && total <= 1_000_000;
  return {
    reason,
    httpStatus: 200,
    jsonParsed: body !== undefined,
    totalResults: validTotal ? total : null,
    itemCount: items?.length ?? null,
    topLevelObject: top !== undefined,
    pageInfoPresent: own(top, 'pageInfo'),
    itemsPresent: own(top, 'items'),
    itemsArray: items !== undefined,
    idString: typeof first?.id === 'string',
    idMatchesCurrentPattern: typeof first?.id === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(first.id),
    contentDetailsObject: content !== undefined,
    relatedPlaylistsObject: related !== undefined,
    uploadsPresent: own(related, 'uploads'),
    uploadsString: typeof related?.uploads === 'string',
    uploadsMatchesCurrentPattern:
      typeof related?.uploads === 'string' && /^UU[A-Za-z0-9_-]{22}$/.test(related.uploads),
    unexpectedTopLevelFields: extras(top, ['pageInfo', 'items']),
    unexpectedItemFields: extras(first, ['id', 'contentDetails']),
    unexpectedContentDetailsFields: extras(content, ['relatedPlaylists']),
    unexpectedRelatedPlaylistFields: extras(related, ['uploads']),
  };
}

class Limit {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly maximum: number) {}
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active += 1;
    try {
      return await action();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}

/** One resolver instance per batch shares Vimeo concurrency and cooldown state. */
export function createProviderResolvers(dependencies: ProviderDependencies = {}) {
  const request = dependencies.request ?? safeRequest;
  const now = dependencies.now ?? Date.now;
  const sleep =
    dependencies.sleep ?? ((ms: number, signal?: AbortSignal) => delay(ms, undefined, { signal }));
  const signal = dependencies.signal;
  const maxWaitMs = dependencies.maxWaitMs ?? 120_000;
  if (!Number.isInteger(maxWaitMs) || maxWaitMs < 0 || maxWaitMs > 300_000)
    throw new Error('invalid_wait_budget');
  const youtubeMaxAttempts = dependencies.youtubeMaxAttempts ?? 4;
  if (!Number.isInteger(youtubeMaxAttempts) || youtubeMaxAttempts < 1 || youtubeMaxAttempts > 4)
    throw new Error('invalid_youtube_attempt_budget');
  const vimeoLimit = new Limit(2);
  let vimeoBlockedUntil = 0;

  function badYouTubeResponse(body: unknown, reason: YouTubeBadResponseReason): ResolutionPatch {
    // The callback gets a closed shape, never payload values, IDs, URLs or errors.
    try {
      dependencies.onYouTubeBadResponse?.(youTubeBadResponseShape(body, reason));
    } catch {
      /* Diagnostics cannot change the account outcome or expose callback errors. */
    }
    return fail('yt_bad_response');
  }

  async function wait(ms: number): Promise<boolean> {
    if (!Number.isFinite(ms) || ms < 0 || ms > maxWaitMs || signal?.aborted) return false;
    let remaining = ms;
    while (remaining > 0) {
      const chunk = Math.min(60_000, remaining);
      try {
        await sleep(chunk, signal);
      } catch {
        return false;
      }
      if (signal?.aborted) return false;
      remaining -= chunk;
    }
    return true;
  }

  function resetAt(response: NetworkResponse, fallback: number): number {
    const reset = response.headers.get('x-ratelimit-reset');
    const parsed = reset ? Date.parse(reset) : Number.NaN;
    return Number.isFinite(parsed) ? Math.max(now(), parsed) : now() + fallback;
  }

  async function resolveVimeo(input: VimeoInput, token: string): Promise<ResolutionPatch> {
    if (!tokenValid(token)) return fail('vimeo_missing_token');
    if (!['user', 'channel', 'showcase', 'group'].includes(input.kind))
      return fail('vimeo_invalid_format', true);
    const endpoint = { user: 'users', channel: 'channels', showcase: 'albums', group: 'groups' }[input.kind];
    const prefix = { user: '', channel: 'channels/', showcase: 'showcase/', group: 'groups/' }[input.kind];
    const resource =
      prefix && input.handle.startsWith(prefix) ? input.handle.slice(prefix.length) : input.handle;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(resource) || (input.kind === 'showcase' && !/^\d+$/.test(resource)))
      return fail('vimeo_invalid_format', true);
    // Public profile URLs spell numeric users as user123; the API uses the numeric ID.
    const handle = input.kind === 'user' && /^user\d+$/.test(resource) ? resource.slice(4) : resource;
    const url = new URL(`https://api.vimeo.com/${endpoint}/${encodeURIComponent(handle)}`);
    url.searchParams.set('fields', input.kind === 'user' ? 'uri,name,link' : 'uri,name');
    return vimeoLimit.run(async () => {
      const started = now();
      for (let attempt = 0; attempt <= 3; attempt += 1) {
        if (signal?.aborted) return fail('vimeo_aborted');
        const pause = Math.max(0, vimeoBlockedUntil - now());
        if (now() - started + pause > maxWaitMs || !(await wait(pause)))
          return fail(signal?.aborted ? 'vimeo_aborted' : 'vimeo_rate_limit_deferred');
        let response: NetworkResponse;
        try {
          response = await request(url.href, {
            allowedOrigins: ['https://api.vimeo.com'],
            maxRedirects: 0,
            timeoutMs: 10_000,
            maxBytes: 512 * 1024,
            signal,
            headers: {
              authorization: `bearer ${token}`,
              accept: 'application/vnd.vimeo.*+json;version=3.4',
              'user-agent': userAgent,
            },
          });
        } catch (error) {
          const code = networkCode(error);
          if (attempt < 3 && ['network', 'timeout'].includes(code)) {
            if (!(await wait(1_000 * (attempt + 1)))) return fail('vimeo_aborted');
            continue;
          }
          return fail(`vimeo_${code}`);
        }
        const remainingValue = response.headers.get('x-ratelimit-remaining');
        const remaining = remainingValue === null ? Number.NaN : Number(remainingValue);
        if (Number.isFinite(remaining) && remaining < 10)
          vimeoBlockedUntil = Math.max(vimeoBlockedUntil, resetAt(response, 60_000));
        if (response.status === 429) {
          vimeoBlockedUntil = Math.max(vimeoBlockedUntil, now() + 60_000, resetAt(response, 60_000));
          if (attempt < 3) continue;
          return fail('vimeo_rate_limited');
        }
        if (response.status >= 500 && response.status <= 599 && attempt < 3) {
          if (!(await wait(1_000 * (attempt + 1)))) return fail('vimeo_aborted');
          continue;
        }
        if (response.status === 404) return fail('vimeo_404', true);
        if (response.status === 401) return fail('vimeo_auth');
        if (response.status === 403) return fail('vimeo_forbidden');
        if (response.status !== 200) return fail(`vimeo_http_${response.status}`);
        const body = json(response);
        if (input.kind === 'user') {
          const parsed = vimeoUserResponse.safeParse(body);
          if (!parsed.success) return fail('vimeo_bad_response');
          const id = parsed.data.uri.split('/').at(-1)!;
          if (/^\d+$/.test(handle) && id !== handle) return fail('vimeo_bad_response');
          return { resolve_status: 'resolved', external_id: id, last_error: null };
        }
        const parsed = vimeoResourceResponse.safeParse(body);
        const pattern =
          input.kind === 'showcase'
            ? /^(?:\/users\/\d+)?\/albums\/([A-Za-z0-9_-]+)$/
            : new RegExp(`^/${endpoint}/([A-Za-z0-9_-]+)$`);
        const id = parsed.success ? pattern.exec(parsed.data.uri)?.[1] : undefined;
        if (!id) return fail('vimeo_bad_response');
        return {
          resolve_status: 'resolved',
          external_id: id,
          backfill_cursor: { endpoint: endpoint as 'channels' | 'albums' | 'groups' },
          last_error: null,
        };
      }
      return fail('vimeo_rate_limited');
    });
  }

  async function resolveYouTube(input: YouTubeInput, key: string): Promise<ResolutionPatch> {
    if (!tokenValid(key)) return fail('yt_missing_key');
    if (
      !['handle', 'channel', 'user', 'c'].includes(input.kind) ||
      !/^[\p{L}\p{M}\p{N}_.@-]{1,100}$/u.test(input.value) ||
      (input.kind === 'channel' && !/^UC[A-Za-z0-9_-]{22}$/.test(input.value))
    )
      return fail('yt_invalid_format', true);
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'id,contentDetails,snippet');
    url.searchParams.set(
      'fields',
      'pageInfo(totalResults),items(id,contentDetails/relatedPlaylists/uploads)',
    );
    const filter = input.kind === 'channel' ? 'id' : input.kind === 'user' ? 'forUsername' : 'forHandle';
    url.searchParams.set(filter, filter === 'forHandle' ? `@${input.value.replace(/^@/, '')}` : input.value);
    for (let attempt = 0; attempt < youtubeMaxAttempts; attempt += 1) {
      if (signal?.aborted) return fail('yt_aborted');
      let response: NetworkResponse;
      try {
        response = await request(url.href, {
          allowedOrigins: ['https://www.googleapis.com'],
          maxRedirects: 0,
          timeoutMs: 10_000,
          maxBytes: 512 * 1024,
          signal,
          headers: { 'x-goog-api-key': key, accept: 'application/json', 'user-agent': userAgent },
        });
      } catch (error) {
        const code = networkCode(error);
        if (attempt + 1 < youtubeMaxAttempts && ['network', 'timeout'].includes(code)) {
          if (!(await wait(1_000 * (attempt + 1)))) return fail('yt_aborted');
          continue;
        }
        return fail(`yt_${code}`);
      }
      if (
        (response.status === 429 || (response.status >= 500 && response.status <= 599)) &&
        attempt + 1 < youtubeMaxAttempts
      ) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
        const retryMs = Number.isFinite(seconds) ? Math.max(1_000, seconds * 1_000) : 1_000 * (attempt + 1);
        if (!(await wait(retryMs))) return fail(signal?.aborted ? 'yt_aborted' : 'yt_rate_limit_deferred');
        continue;
      }
      if (response.status === 404) return fail('yt_404', true);
      if (response.status === 401) return fail('yt_auth');
      if (response.status === 403) {
        const error = youtubeError.safeParse(json(response));
        const quota =
          error.success &&
          error.data.error.errors?.some(({ reason }) =>
            ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(reason),
          );
        return fail(quota ? 'yt_quota' : 'yt_forbidden');
      }
      if (response.status === 429) return fail('yt_rate_limited');
      if (response.status !== 200) return fail(`yt_http_${response.status}`);
      const body = json(response);
      const parsed = youtubeResponse.safeParse(body);
      if (!parsed.success) return badYouTubeResponse(body, 'invalid_schema');
      const totalResults = parsed.data.pageInfo?.totalResults;
      const items = parsed.data.items;
      // Missing projection fields are not an empty success without explicit zero evidence.
      if (items === undefined && totalResults !== 0)
        return badYouTubeResponse(body, 'missing_items_without_zero');
      if (items !== undefined && totalResults !== undefined && totalResults !== items.length)
        return badYouTubeResponse(body, 'contradictory_count');
      const channel = items?.[0];
      if (!channel) return fail(input.kind === 'c' ? 'yt_custom_url_unresolved' : 'yt_not_found', true);
      if (input.kind === 'channel' && channel.id !== input.value)
        return badYouTubeResponse(body, 'channel_mismatch');
      return {
        resolve_status: 'resolved',
        external_id: channel.id,
        uploads_playlist_id: channel.contentDetails.relatedPlaylists.uploads,
        last_error: null,
      };
    }
    return fail('yt_rate_limited');
  }
  return { resolveVimeo, resolveYouTube };
}

const defaultResolvers = createProviderResolvers();
export const resolveVimeo = defaultResolvers.resolveVimeo;
export const resolveYouTube = defaultResolvers.resolveYouTube;

export function validateInstagram(handle: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(handle);
}
export function validateLinkedIn(input: { kind: string; slug: string }): boolean {
  return (
    ['company', 'showcase'].includes(input.kind) &&
    /^[\p{L}\p{N}][\p{L}\p{M}\p{N}._&-]{0,99}$/u.test(input.slug)
  );
}

export interface WebsiteCheck {
  resolve_status: 'not_needed';
  last_error: string | null;
  url?: string;
}
/** Orchestration limits website concurrency to five; no social reachability calls. */
export async function checkWebsite(
  url: string,
  dependencies: Pick<ProviderDependencies, 'request' | 'signal'> = {},
): Promise<WebsiteCheck> {
  const request = dependencies.request ?? safeRequest;
  const options = {
    sameDomainRedirects: true,
    timeoutMs: 10_000,
    maxBytes: 256 * 1024,
    signal: dependencies.signal,
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; EveryoneMarketRadar/0.1; public website reachability)',
      accept: 'text/html,*/*;q=0.8',
    },
  };
  try {
    let response = await request(url, { ...options, method: 'HEAD' });
    if ([405, 501].includes(response.status)) response = await request(url, { ...options, method: 'GET' });
    return response.status >= 200 && response.status < 400
      ? { resolve_status: 'not_needed', last_error: null, url: response.url }
      : { resolve_status: 'not_needed', last_error: `unreachable_${response.status}` };
  } catch (error) {
    return { resolve_status: 'not_needed', last_error: `unreachable_${networkCode(error)}` };
  }
}
