// Official public YouTube API driver. Injected transport owns the existing native
// Header Auth credential, strict TLS, fixed host, no redirects and byte/time bounds.
// No API key, actor start, database connection or ambient fetch lives here.
import normalizer from '../normalizers/youtubeApi.js';
const { normalizeYoutubeApiResult, youtubeHelpers: h } = normalizer;
const DAY = 86400000;
// Use the opaque ID returned by contentDetails.relatedPlaylists.uploads. The
// public contract does not guarantee a UU prefix or equality to a channel suffix.
const playlistId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const token = (v) =>
  typeof v === 'string' && v.length > 0 && v.length <= 2048 && !/[\u0000-\u0020\u007f]/u.test(v);
const fail = (code) => {
  throw Error(code);
};

// Google quotas reset at midnight Pacific, including daylight saving time.
// https://developers.google.com/youtube/data/determine_quota_cost
export function youtubeQuotaDay(now) {
  if (!h.youtubeDate(now)) fail('youtube_invalid_config');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const value = Object.fromEntries(
    parts.filter((p) => ['year', 'month', 'day'].includes(p.type)).map((p) => [p.type, p.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}
export function youtubeEndpoint(account) {
  if (
    !h.youtubeRecord(account) ||
    typeof account.url !== 'string' ||
    /[\s\\\u0000-\u001f\u007f]/u.test(account.url)
  )
    fail('youtube_invalid_account');
  let url;
  try {
    url = new URL(account.url);
  } catch {
    fail('youtube_invalid_account');
  }
  if (
    url.protocol !== 'https:' ||
    !['youtube.com', 'www.youtube.com'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    /%(?:2e|2f|5c|00)/i.test(url.pathname)
  )
    fail('youtube_invalid_account');
  const parts = url.pathname.split('/').filter(Boolean);
  if (!(
    (parts.length === 1 && /^@?[A-Za-z0-9._-]{1,100}$/.test(parts[0])) ||
    (parts.length === 2 &&
      ['channel', 'user', 'c'].includes(parts[0]) &&
      /^[A-Za-z0-9._-]{1,100}$/.test(parts[1]))
  ))
    fail('youtube_invalid_account');
  const external = account.external_id || null,
    uploads = account.uploads_playlist_id || null;
  if ((external !== null && !h.youtubeChannelId(external)) || (uploads !== null && !playlistId(uploads)))
    fail('youtube_invalid_account');
  if (
    parts.length === 2 &&
    parts[0] === 'channel' &&
    (!h.youtubeChannelId(parts[1]) || (external && external !== parts[1]))
  )
    fail('youtube_invalid_account');
  if (external && uploads) return { channelId: external, playlistId: uploads, resolve: null };
  if (external) return { channelId: external, playlistId: null, resolve: { id: external } };
  if (uploads) fail('youtube_invalid_account');
  if (parts.length === 2 && parts[0] === 'channel' && h.youtubeChannelId(parts[1]))
    return { channelId: parts[1], playlistId: null, resolve: { id: parts[1] } };
  if (parts.length === 1 && /^@[A-Za-z0-9._-]{1,100}$/.test(parts[0]))
    return { channelId: null, playlistId: null, resolve: { forHandle: parts[0] } };
  if (parts.length === 2 && parts[0] === 'user' && /^[A-Za-z0-9._-]{1,100}$/.test(parts[1]))
    return { channelId: null, playlistId: null, resolve: { forUsername: parts[1] } };
  if (parts.length === 2 && parts[0] === 'c') fail('youtube_unresolved_legacy_url');
  fail('youtube_invalid_account');
}
function apiUrl(resource, args) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + resource);
  url.search = new URLSearchParams(args).toString();
  return url.href;
}
export function planYoutubeFallback() {
  return {
    actor: 'streamers/youtube-scraper',
    blocked: true,
    reason: 'm05_fallback_unverified_and_live_scope_not_authorized',
  };
}
function settingsFor(account, config) {
  if (!h.youtubeRecord(config) || !['daily', 'backfill'].includes(config.mode) || !h.youtubeDate(config.now))
    fail('youtube_invalid_config');
  const from = account.backfill_from ?? '2024-01-01';
  if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from)) fail('youtube_invalid_config');
  const floor = h.youtubeDate(from + 'T00:00:00Z'),
    now = h.youtubeDate(config.now);
  const rawWatermark = account.watermark_published_at ?? account.last_item_published_at;
  const watermark = rawWatermark ? h.youtubeDate(rawWatermark) : null;
  if (!floor || (rawWatermark && !watermark) || (watermark && Date.parse(watermark) > Date.parse(now)))
    fail('youtube_invalid_config');
  const maxPages = config.maxPages ?? (config.mode === 'daily' ? 2 : 40),
    pageSize = config.pageSize ?? 50,
    budget = config.quotaRemaining;
  if (
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > (config.mode === 'daily' ? 2 : 40) ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    !Number.isSafeInteger(budget) ||
    budget < 0 ||
    budget > 8000
  )
    fail('youtube_invalid_config');
  const cutoff =
    config.mode === 'daily' && watermark
      ? new Date(Math.max(Date.parse(floor), Date.parse(watermark) - DAY)).toISOString()
      : floor;
  const metricsCutoff =
    config.mode === 'daily'
      ? new Date(Math.max(Date.parse(floor), Date.parse(now) - 30 * DAY)).toISOString()
      : floor;
  return { mode: config.mode, now, floor, cutoff, metricsCutoff, maxPages, pageSize, budget };
}
function resumeToken(account, endpoint, settings) {
  const cursor = settings.mode === 'backfill' ? account.backfill_cursor : null;
  if (cursor === undefined || cursor === null) return null;
  if (
    !h.youtubeRecord(cursor) ||
    Object.keys(cursor).some((k) => !['channel_id', 'playlist_id', 'page_token', 'page_size'].includes(k)) ||
    cursor.channel_id !== endpoint.channelId ||
    cursor.playlist_id !== endpoint.playlistId ||
    cursor.page_size !== settings.pageSize ||
    !token(cursor.page_token)
  )
    fail('youtube_invalid_cursor');
  return cursor.page_token;
}

/** request({method,url}) returns {status,body}; never attaches secrets itself.
 * reserveQuota, when supplied, is awaited BEFORE every HTTP attempt. The connected
 * run adapter requires this atomic database port; direct unit tests use only the
 * explicit local quotaRemaining bound. No read or paid-start retry occurs here.
 */
export async function collectYoutubeAccount(account, config, deps) {
  if (typeof deps?.request !== 'function') fail('youtube_invalid_dependencies');
  let apiRequestCount = 0,
    pages = 0,
    endpoint,
    settings,
    currentToken = null,
    resolvedExternalId = null,
    resolvedUploadsPlaylistId = null;
  const items = [],
    unavailableIds = [],
    seenTokens = new Set(),
    seenIds = new Set();
  const cursor = () =>
    endpoint && settings
      ? {
          channel_id: endpoint.channelId,
          playlist_id: endpoint.playlistId,
          page_token: currentToken,
          page_size: settings.pageSize,
        }
      : null;
  const result = (status, error = null, extra = {}) => ({
    status,
    error,
    normalizedItems: status === 'success' || status === 'partial' ? items : [],
    apiRequestCount,
    quotaUnits: apiRequestCount,
    quotaUnitsConservative: true,
    complete: false,
    backfillDone: false,
    cursor: currentToken ? cursor() : null,
    resolvedExternalId,
    resolvedUploadsPlaylistId,
    unavailableIds,
    fallback: planYoutubeFallback(),
    ...extra,
  });
  const request = async (url) => {
    if (apiRequestCount >= settings.budget) fail('youtube_quota_guard');
    if (deps.reserveQuota) {
      let permitted;
      try {
        permitted = await deps.reserveQuota();
      } catch {
        fail('youtube_quota_reconciliation_required');
      }
      if (permitted !== true) fail('youtube_quota_guard');
    }
    apiRequestCount++;
    let r;
    try {
      r = await deps.request({ method: 'GET', url });
    } catch {
      fail('youtube_transport_failed');
    }
    if (!h.youtubeRecord(r) || !Number.isInteger(r.status) || r.status < 100 || r.status > 599)
      fail('youtube_invalid_response');
    if (r.status !== 200) {
      const reason = r.body?.error?.errors?.[0]?.reason;
      fail(
        r.status === 403 && reason === 'quotaExceeded'
          ? 'youtube_quota_exceeded'
          : r.status === 429
            ? 'youtube_rate_limited'
            : `youtube_api_${r.status}`,
      );
    }
    if (!h.youtubeRecord(r.body)) fail('youtube_invalid_response');
    return r.body;
  };
  try {
    endpoint = youtubeEndpoint(account);
    settings = settingsFor(account, config);
    if (endpoint.resolve) {
      const resolved = await request(
        apiUrl('channels', {
          part: 'id,contentDetails',
          ...endpoint.resolve,
          fields: 'items(id,contentDetails/relatedPlaylists/uploads)',
        }),
      );
      if (!Array.isArray(resolved.items) || resolved.items.length !== 1)
        fail('youtube_resolution_unavailable');
      const row = resolved.items[0],
        uploads = row?.contentDetails?.relatedPlaylists?.uploads;
      if (
        !h.youtubeChannelId(row?.id) ||
        !playlistId(uploads) ||
        (endpoint.channelId && endpoint.channelId !== row.id)
      )
        fail('youtube_owner_mismatch');
      endpoint = { channelId: row.id, playlistId: uploads, resolve: null };
      resolvedExternalId = row.id;
      resolvedUploadsPlaylistId = uploads;
    }
    currentToken = resumeToken(account, endpoint, settings);
    if (currentToken) seenTokens.add(currentToken);
    while (pages < settings.maxPages) {
      const page = await request(
        apiUrl('playlistItems', {
          part: 'snippet,contentDetails,status',
          playlistId: endpoint.playlistId,
          maxResults: String(settings.pageSize),
          ...(currentToken ? { pageToken: currentToken } : {}),
          fields:
            'nextPageToken,items(snippet/videoOwnerChannelId,contentDetails(videoId,videoPublishedAt),status/privacyStatus)',
        }),
      );
      if (
        !Array.isArray(page.items) ||
        page.items.length > settings.pageSize ||
        (page.nextPageToken !== undefined && !token(page.nextPageToken))
      )
        fail('youtube_invalid_response');
      const ids = [];
      for (const row of page.items) {
        const id = row?.contentDetails?.videoId;
        if (!h.youtubeVideoId(id) || row.snippet?.videoOwnerChannelId !== endpoint.channelId)
          fail('youtube_owner_mismatch');
        if (ids.includes(id) || seenIds.has(id)) fail('youtube_repeated_video_id');
        ids.push(id);
      }
      if (!ids.length && page.nextPageToken) fail('youtube_empty_nonterminal_page');
      if (ids.length) {
        const body = await request(
          apiUrl('videos', {
            part: 'snippet,statistics,contentDetails,status',
            id: ids.join(','),
            fields:
              'items(id,snippet(channelId,publishedAt,title,description,tags,thumbnails),statistics(viewCount,likeCount,commentCount),contentDetails/duration,status/privacyStatus)',
          }),
        );
        if (
          !Array.isArray(body.items) ||
          body.items.length > ids.length ||
          body.items.some((v) => !ids.includes(v?.id)) ||
          new Set(body.items.map((v) => v.id)).size !== body.items.length
        )
          fail('youtube_invalid_response');
        const normalized = normalizeYoutubeApiResult(body.items, {
          account: { ...account, external_id: endpoint.channelId },
          cutoff: settings.cutoff,
          metricsCutoff: settings.metricsCutoff,
        });
        if (normalized.errors.length) fail('youtube_contract_drift');
        unavailableIds.push(
          ...ids.filter((id) => !body.items.some((v) => v.id === id)),
          ...normalized.skipped.map((v) => v.id),
        );
        items.push(...normalized.items);
        ids.forEach((id) => seenIds.add(id));
      }
      pages++;
      const next = page.nextPageToken ?? null;
      if (next && seenTokens.has(next)) fail('youtube_repeated_page_token');
      currentToken = next;
      if (next) seenTokens.add(next);
      if (!next)
        return unavailableIds.length
          ? result('partial', 'youtube_videos_unavailable', { cursor: null })
          : result('success', null, {
              complete: true,
              backfillDone: settings.mode === 'backfill',
              cursor: null,
            });
    }
    return result('partial', 'youtube_page_cap');
  } catch (error) {
    const code =
      typeof error?.message === 'string' &&
      /^youtube_(?:quota_guard|quota_reconciliation_required|quota_exceeded|transport_failed|rate_limited|invalid_account|invalid_config|invalid_cursor|invalid_response|resolution_unavailable|unresolved_legacy_url|owner_mismatch|repeated_video_id|empty_nonterminal_page|contract_drift|repeated_page_token|api_[1-5][0-9]{2})$/.test(
        error.message,
      )
        ? error.message
        : 'youtube_collection_failed';
    return result(code === 'youtube_quota_guard' ? 'partial' : 'failed', code);
  }
}
