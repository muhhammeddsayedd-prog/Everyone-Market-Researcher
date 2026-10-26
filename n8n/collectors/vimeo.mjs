// Official Vimeo API collector. Transport is injected; this module owns no secret,
// database connection, actor start, workflow execution or lifecycle RPC.
import vimeo from '../normalizers/vimeoApi.js';
const { normalizeVimeoApiResult, vimeoHelpers: h } = vimeo;
export const VIMEO_FIELDS =
  'uri,link,name,description,release_time,created_time,duration,privacy.view,pictures.sizes,tags,stats.plays,metadata.connections.likes.total,metadata.connections.comments.total';
const DAY = 86400000;
const segment = /^[A-Za-z0-9_-]+$/;
const failure = (code) => {
  throw new Error(code);
};

export function vimeoEndpoint(account) {
  if (!h.vimeoRecord(account) || typeof account.url !== 'string') return failure('vimeo_invalid_account');
  const publicUrl = h.vimeoUrl(account.url);
  if (!publicUrl) return failure('vimeo_invalid_account');
  const parts = new URL(publicUrl).pathname.split('/').filter(Boolean);
  if (parts.some((p) => !segment.test(p))) return failure('vimeo_invalid_account');
  if (parts.length === 2 && ['channels', 'groups'].includes(parts[0])) {
    return {
      kind: parts[0],
      resourcePath: `/${parts[0]}/${parts[1]}`,
      externalId: parts[1],
      resolvePath: null,
    };
  }
  if (parts.length === 2 && parts[0] === 'showcase' && /^\d+$/.test(parts[1])) {
    // The official API scopes albums to their owner; never guess /albums/{id}.
    const resourcePath = account.backfill_cursor?.resourcePath;
    if (
      typeof resourcePath !== 'string' ||
      !new RegExp(`^/users/[0-9]+/albums/${parts[1]}$`).test(resourcePath)
    )
      return failure('vimeo_showcase_owner_required');
    return { kind: 'albums', resourcePath, externalId: parts[1], resolvePath: null };
  }
  if (parts.length !== 1 || /^\d+$/.test(parts[0])) return failure('vimeo_invalid_account');
  if (account.external_id !== null && account.external_id !== undefined && account.external_id !== '') {
    if (typeof account.external_id !== 'string' || !/^\d+$/.test(account.external_id))
      return failure('vimeo_invalid_account');
    return {
      kind: 'users',
      resourcePath: `/users/${account.external_id}`,
      externalId: account.external_id,
      resolvePath: null,
    };
  }
  return { kind: 'users', resourcePath: null, externalId: null, resolvePath: `/users/${parts[0]}` };
}

function configFor(account, config) {
  if (!h.vimeoRecord(config) || !['daily', 'backfill'].includes(config.mode))
    return failure('vimeo_invalid_config');
  const now = h.vimeoDate(config.now);
  const from = account.backfill_from ?? '2024-01-01';
  if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return failure('vimeo_invalid_config');
  const floor = h.vimeoDate(from + 'T00:00:00Z');
  if (!now || !floor) return failure('vimeo_invalid_config');
  const watermarkValue = account.watermark_published_at ?? account.last_item_published_at;
  const watermark = watermarkValue ? h.vimeoDate(watermarkValue) : null;
  if (watermarkValue && !watermark) return failure('vimeo_invalid_config');
  const cutoff =
    config.mode === 'daily' && watermark
      ? new Date(Math.max(Date.parse(floor), Date.parse(watermark) - DAY)).toISOString()
      : floor;
  // Refresh current metrics through the existing duplicate-upsert path, including
  // known IDs. Stopping at the watermark ID would suppress the required overlap.
  const metricsCutoff =
    config.mode === 'daily' && watermark
      ? new Date(Math.max(Date.parse(floor), Date.parse(now) - 30 * DAY)).toISOString()
      : cutoff;
  const page = config.mode === 'backfill' ? (account.backfill_cursor?.page ?? 1) : 1;
  const maxPages = config.maxPages ?? (config.mode === 'daily' ? 3 : 50);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > (config.mode === 'daily' ? 3 : 50)
  )
    return failure('vimeo_invalid_config');
  return { mode: config.mode, cutoff, metricsCutoff, floor, now, page, maxPages };
}
function validateCursor(account, endpoint, settings) {
  const cursor = account.backfill_cursor;
  if (settings.mode !== 'backfill' || cursor === null || cursor === undefined) return;
  if (
    !h.vimeoRecord(cursor) ||
    (cursor.endpoint !== undefined && cursor.endpoint !== endpoint.kind) ||
    (cursor.resourcePath !== undefined && cursor.resourcePath !== endpoint.resourcePath) ||
    (settings.page > 1 &&
      (cursor.endpoint !== endpoint.kind || cursor.resourcePath !== endpoint.resourcePath))
  )
    return failure('vimeo_invalid_cursor');
}
function listUrl(resourcePath, page) {
  const url = new URL(`https://api.vimeo.com${resourcePath}/videos`);
  url.search = new URLSearchParams({
    sort: 'date',
    direction: 'desc',
    per_page: '100',
    page: String(page),
    fields: VIMEO_FIELDS,
  }).toString();
  return url.href;
}
function nextPage(value, resourcePath, page) {
  if (value === null) return null;
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/u.test(value))
    return failure('vimeo_invalid_pagination');
  const u = new URL(value, 'https://api.vimeo.com');
  if (
    u.origin !== 'https://api.vimeo.com' ||
    u.pathname !== `${resourcePath}/videos` ||
    u.username ||
    u.password ||
    u.hash ||
    [...u.searchParams.keys()].some(
      (key) => !['page', 'per_page', 'sort', 'direction', 'fields'].includes(key),
    ) ||
    [...u.searchParams.keys()].some((key) => u.searchParams.getAll(key).length !== 1)
  )
    return failure('vimeo_invalid_pagination');
  const n = Number(u.searchParams.get('page'));
  if (!Number.isSafeInteger(n) || n !== page + 1) return failure('vimeo_invalid_pagination');
  return n;
}
function header(headers, key) {
  const found = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === key);
  return found?.[1];
}
function fallback(endpoint, mode, code) {
  if (![401, 403, 404].includes(code)) return null;
  // Proposal only: no M04 live/paid batch is approved, and an API failure does
  // not authorize bypassing access restrictions. No actor starts here.
  return {
    actor:
      endpoint?.kind === 'users' && mode === 'daily'
        ? 'goat255/vimeo-scraper'
        : endpoint?.kind !== 'users'
          ? 'dltik/vimeo-scraper'
          : null,
    blocked: true,
    reason: 'fallback_not_enabled_in_first_slice',
    coverage:
      endpoint?.kind === 'users' && mode === 'backfill' ? 'goat255_latest_60_not_backfill' : 'not_verified',
  };
}

/** deps.request({method,url}) -> {status,headers,body}; deps.wait(ms).
 * request must use the existing native Vimeo credential, strict TLS, no redirects,
 * a response-size limit and a bounded request timeout. Exceptions are redacted.
 * Caller runs SUB lifecycle and restricted gateway RPCs, never direct SQL here.
 */
export async function collectVimeoAccount(account, config, deps) {
  if (typeof deps?.request !== 'function' || typeof deps?.wait !== 'function')
    return failure('vimeo_invalid_dependencies');
  let endpoint, settings;
  let page = 1,
    apiRequestCount = 0,
    waitedMs = 0,
    pages = 0;
  const normalizedItems = [];
  let previousDate = Infinity;
  let resolvedExternalId = null;
  let resolvedHeaders;
  const result = (status, error = null, extra = {}) => ({
    status,
    error,
    normalizedItems: status === 'success' ? normalizedItems : [],
    apiRequestCount,
    backfillDone: false,
    cursor: null,
    fallback: null,
    resolvedExternalId,
    ...extra,
  });
  const wait = async (ms) => {
    if (!Number.isFinite(ms) || ms < 0 || waitedMs + ms > 600000) return failure('vimeo_rate_limited');
    waitedMs += ms;
    if (ms) await deps.wait(ms);
  };
  const respectRate = async (headers) => {
    const remaining = header(headers, 'x-ratelimit-remaining');
    if (remaining === undefined) return;
    if (!/^\d+$/.test(String(remaining))) return failure('vimeo_invalid_response');
    if (Number(remaining) >= 10) return;
    const reset = h.vimeoDate(header(headers, 'x-ratelimit-reset'));
    if (!reset) return failure('vimeo_rate_limited');
    await wait(Math.max(0, Date.parse(reset) - Date.parse(settings.now) - waitedMs));
  };
  const request = async (url) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response;
      apiRequestCount++;
      try {
        response = await deps.request({ method: 'GET', url });
      } catch {
        return failure('vimeo_transport_failed');
      }
      if (
        !h.vimeoRecord(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        return failure('vimeo_invalid_response');
      if (response.status !== 429) return response;
      if (attempt === 3) return failure('vimeo_rate_limited');
      await wait(60000);
    }
  };
  try {
    endpoint = vimeoEndpoint(account);
    settings = configFor(account, config);
    page = settings.page;
    if (endpoint.resolvePath) {
      const resolved = await request(`https://api.vimeo.com${endpoint.resolvePath}?fields=uri,name,link`);
      if (resolved.status !== 200)
        return result('failed', `vimeo_api_${resolved.status}`, {
          fallback: fallback(endpoint, settings.mode, resolved.status),
        });
      if (!/^\/users\/\d+$/.test(resolved.body?.uri || '')) return failure('vimeo_invalid_resolution');
      endpoint = {
        ...endpoint,
        externalId: resolved.body.uri.slice(7),
        resourcePath: resolved.body.uri,
        resolvePath: null,
      };
      resolvedExternalId = endpoint.externalId;
      resolvedHeaders = resolved.headers;
    }
    // Bind resumed pages to the freshly resolved or saved collection identity.
    // An old cursor must never silently skip the first pages of another owner.
    validateCursor(account, endpoint, settings);
    if (resolvedHeaders) await respectRate(resolvedHeaders);
    while (pages < settings.maxPages) {
      const response = await request(listUrl(endpoint.resourcePath, page));
      if (response.status !== 200)
        return result('failed', `vimeo_api_${response.status}`, {
          fallback: fallback(endpoint, settings.mode, response.status),
        });
      const body = response.body;
      if (
        !h.vimeoRecord(body) ||
        !Array.isArray(body.data) ||
        body.data.length > 100 ||
        !h.vimeoRecord(body.paging) ||
        !Object.hasOwn(body.paging, 'next')
      )
        return failure('vimeo_invalid_response');
      pages++;
      const dates = body.data.map((row) => h.vimeoDate(row?.release_time ?? row?.created_time));
      if (dates.some((date) => !date)) return failure('vimeo_contract_drift');
      for (const date of dates) {
        const time = Date.parse(date);
        if (time > previousDate) return failure('vimeo_unsorted_page');
        previousDate = time;
      }
      const normalized = normalizeVimeoApiResult(body.data, { account, ...settings });
      if (normalized.errors.length) return failure('vimeo_contract_drift');
      normalizedItems.push(...normalized.items);
      const next = nextPage(body.paging.next, endpoint.resourcePath, page);
      const reachedCutoff =
        dates.length > 0 &&
        Date.parse(dates[dates.length - 1]) <
          Math.min(Date.parse(settings.cutoff), Date.parse(settings.metricsCutoff));
      if (next === null || reachedCutoff)
        return result('success', null, { backfillDone: settings.mode === 'backfill', complete: true });
      if (!dates.length) return failure('vimeo_invalid_pagination');
      const cursor = { endpoint: endpoint.kind, resourcePath: endpoint.resourcePath, page: next };
      if (pages === settings.maxPages) return result('success', null, { cursor, complete: false });
      await respectRate(response.headers);
      page = next;
    }
    return failure('vimeo_invalid_response');
  } catch (error) {
    const allowed = [
      'vimeo_invalid_account',
      'vimeo_showcase_owner_required',
      'vimeo_invalid_config',
      'vimeo_invalid_cursor',
      'vimeo_rate_limited',
      'vimeo_transport_failed',
      'vimeo_invalid_response',
      'vimeo_invalid_resolution',
      'vimeo_invalid_pagination',
      'vimeo_contract_drift',
      'vimeo_unsorted_page',
    ];
    return result('failed', allowed.includes(error?.message) ? error.message : 'vimeo_collection_failed');
  }
}
