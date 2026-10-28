// Pure public-metadata adapter; no HTTP, cookies, keys, downloads or database.
// Sources: developers.google.com/youtube/data/reference/rest/v3/videos
const youtubeRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const youtubeVideoId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v);
const youtubeChannelId = (v) => typeof v === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(v);
const youtubeText = (v) => (typeof v === 'string' ? v : '');
function youtubeTrim(v, max = 8000) {
  const value = youtubeText(v).slice(0, max),
    last = value.charCodeAt(value.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? value.slice(0, -1) : value;
}
function youtubeCount(v) {
  if (!(typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)))) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function youtubeDuration(v) {
  if (typeof v !== 'string') return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v);
  if (!m || !m.slice(1).some((x) => x !== undefined) || v.endsWith('T')) return null;
  const seconds = (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
function youtubeDate(v) {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  )
    return null;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number),
    [h, min, s] = v.slice(11, 19).split(':').map(Number),
    off = /[+-](\d{2}):(\d{2})$/.exec(v),
    date = new Date(v),
    cal = new Date(0);
  cal.setUTCFullYear(y, m - 1, d);
  return y > 0 &&
    h <= 23 &&
    min <= 59 &&
    s <= 59 &&
    (!off || (+off[1] <= 14 && +off[2] <= 59 && (+off[1] !== 14 || +off[2] === 0))) &&
    cal.getUTCFullYear() === y &&
    cal.getUTCMonth() === m - 1 &&
    cal.getUTCDate() === d &&
    Number.isFinite(date.valueOf())
    ? date.toISOString()
    : null;
}
function youtubeThumbnail(v) {
  // Projection only; any future fetcher still enforces public DNS/redirect rules.
  if (typeof v !== 'string' || /[\s\\\u0000-\u001f\u007f?#]/u.test(v)) return null;
  const m = /^https:\/\/(i(?:[0-9]+)?\.ytimg\.com|img\.youtube\.com)(\/[^?#]+)$/.exec(v);
  return m && !/%(?:2e|2f|5c|00)/i.test(m[2]) && !m[2].split('/').some((p) => p === '.' || p === '..')
    ? v
    : null;
}
function youtubeWindow(date, ctx) {
  const bounds = [ctx.cutoff, ctx.metricsCutoff].filter((v) => v !== undefined && v !== null);
  if (bounds.some((v) => !youtubeDate(v))) throw Error('youtube_invalid_context');
  return !bounds.length || Date.parse(date) >= Math.min(...bounds.map(Date.parse));
}
function youtubeBatches(items) {
  // The gateway caps the entire request at 1 MiB. Leave 1 KiB for its fixed
  // version/request UUID/operation and two UUID args, not only the items array.
  const maxBytes = 1048576 - 1024;
  const batches = [];
  let batch = [],
    bytes = 2;
  for (const item of items) {
    let size = 0;
    for (const char of JSON.stringify(item)) {
      const cp = char.codePointAt(0);
      size += cp <= 127 ? 1 : cp <= 2047 ? 2 : cp <= 65535 ? 3 : 4;
    }
    if (size > maxBytes - 2) throw Error('youtube_item_byte_bound');
    if (batch.length && (batch.length >= 100 || bytes + size + 1 > maxBytes)) {
      batches.push(batch);
      batch = [];
      bytes = 2;
    }
    batch.push(item);
    bytes += size + 1;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
function normalizeYoutubeApiResult(rawItems, ctx = {}) {
  if (!Array.isArray(rawItems) || rawItems.length > 10000 || !youtubeChannelId(ctx.account?.external_id))
    throw Error('youtube_invalid_context');
  const items = [],
    errors = [],
    skipped = [];
  const seen = new Set();
  for (const row of rawItems) {
    const fail = (error) => errors.push({ error, matchKey: ctx.account.external_id });
    if (!youtubeRecord(row) || row.error !== undefined || !youtubeVideoId(row.id) || seen.has(row.id)) {
      fail('youtube_contract_drift');
      continue;
    }
    seen.add(row.id);
    if (row.snippet?.channelId !== ctx.account.external_id) {
      fail('youtube_owner_mismatch');
      continue;
    }
    if (!youtubeRecord(row.status) || typeof row.status.privacyStatus !== 'string') {
      fail('youtube_contract_drift');
      continue;
    }
    if (row.status.privacyStatus !== 'public') {
      skipped.push({ id: row.id, reason: 'youtube_non_public' });
      continue;
    }
    const date = youtubeDate(row.snippet?.publishedAt);
    if (!date) {
      fail('youtube_invalid_date');
      continue;
    }
    if (!youtubeWindow(date, ctx)) continue;
    const caption = youtubeTrim(row.snippet.description),
      duration = youtubeDuration(row.contentDetails?.duration);
    const thumbnail = Object.values(row.snippet.thumbnails ?? {})
      .filter((t) => youtubeRecord(t) && youtubeThumbnail(t.url))
      .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0];
    const tags = [
      ...new Set(
        (Array.isArray(row.snippet.tags) ? row.snippet.tags : [])
          .filter((t) => typeof t === 'string')
          .map((t) => t.trim().replace(/^#/, '').toLowerCase())
          .filter(Boolean),
      ),
    ];
    const metrics = {
      views: youtubeCount(row.statistics?.viewCount),
      likes: youtubeCount(row.statistics?.likeCount),
      comments: youtubeCount(row.statistics?.commentCount),
    };
    // Preserve the project's <=60s rule, labelled as a heuristic. Public API
    // duration alone cannot establish YouTube's actual three-minute Shorts class.
    const short = duration !== null && duration <= 60;
    items.push({
      platform: 'youtube',
      external_id: row.id,
      actor: 'youtube-api',
      item_type: short ? 'reel' : 'video',
      url: `https://www.youtube.com/watch?v=${row.id}`,
      published_at: date,
      title: typeof row.snippet.title === 'string' ? row.snippet.title : null,
      caption,
      credits_text: youtubeTrim(caption, 1500),
      hashtags: tags,
      mentions: [
        ...new Set((caption.match(/@([A-Za-z0-9._]+)/g) ?? []).map((v) => v.slice(1).toLowerCase())),
      ],
      tagged_accounts: [],
      duration_seconds: duration,
      thumbnail_url: thumbnail?.url ?? null,
      metrics,
      media_urls: [],
      payload: {
        id: row.id,
        channel_id: row.snippet.channelId,
        published_at: date,
        title: typeof row.snippet.title === 'string' ? row.snippet.title : null,
        description: caption,
        tags,
        duration: typeof row.contentDetails?.duration === 'string' ? row.contentDetails.duration : null,
        privacy: 'public',
        metrics,
        shorts_classification: short ? 'duration_heuristic_unverified' : 'not_established',
      },
    });
  }
  return { items, errors, skipped };
}
function normalizeYoutubeApi(rawItems, ctx = {}) {
  return normalizeYoutubeApiResult(rawItems, ctx).items;
}
if (typeof module !== 'undefined')
  module.exports = {
    normalizeYoutubeApi,
    normalizeYoutubeApiResult,
    youtubeDuration,
    youtubeHelpers: {
      youtubeRecord,
      youtubeVideoId,
      youtubeChannelId,
      youtubeText,
      youtubeTrim,
      youtubeCount,
      youtubeDate,
      youtubeThumbnail,
      youtubeWindow,
      youtubeBatches,
    },
  };
