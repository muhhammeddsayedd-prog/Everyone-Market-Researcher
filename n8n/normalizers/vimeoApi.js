// Pure Vimeo public-metadata normalization. No HTTP, credentials, or database access.
// A Code-node adapter must supply these same helpers rather than require a new package.
const vimeoRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const vimeoText = (v) => (typeof v === 'string' ? v : '');
const vimeoHandle = (v) => vimeoText(v).trim().replace(/^@+/, '').toLowerCase();
const vimeoCount = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n)) ? Math.round(n) : null;
};
function vimeoDate(v) {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  )
    return null;
  const date = new Date(v);
  const calendar = new Date(0);
  const [year, month, day] = v.slice(0, 10).split('-').map(Number);
  const [hour, minute, second] = v.slice(11, 19).split(':').map(Number);
  const offset = /[+-](\d{2}):(\d{2})$/.exec(v);
  calendar.setUTCFullYear(year, month - 1, day);
  return Number.isFinite(date.valueOf()) &&
    year > 0 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    (!offset || (+offset[1] <= 14 && +offset[2] <= 59 && (+offset[1] !== 14 || +offset[2] === 0))) &&
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
    ? date.toISOString()
    : null;
}
function vimeoUrl(value, image = false) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  // Known public hosts only. Lexical projection also works in n8n Cloud Code,
  // where URL and package imports are unavailable. Encoded separators and dot
  // segments are rejected rather than letting a different parser rewrite them.
  const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?$/.exec(value);
  if (!match) return null;
  const hosts = image ? ['i.vimeocdn.com', 'secure-b.vimeocdn.com'] : ['vimeo.com', 'www.vimeo.com'];
  const host = match[1].toLowerCase(),
    path = match[2] || '/';
  if (
    !hosts.includes(host) ||
    /%(?:2e|2f|5c|00)/i.test(path) ||
    path.split('/').some((p) => p === '.' || p === '..')
  )
    return null;
  return 'https://' + host + path;
}
function vimeoOwner(url) {
  const canonical = vimeoUrl(url);
  return canonical
    ? vimeoHandle(
        canonical
          .replace(/^https:\/\/[^/]+/, '')
          .split('/')
          .filter(Boolean)
          .pop(),
      )
    : '';
}
function vimeoTrim(value) {
  const text = vimeoText(value).slice(0, 8000);
  const last = text.charCodeAt(text.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? text.slice(0, -1) : text;
}
function vimeoInWindow(date, ctx) {
  const bounds = [ctx.cutoff, ctx.metricsCutoff].filter((v) => v !== undefined && v !== null);
  if (!bounds.length) return true;
  if (bounds.some((v) => !vimeoDate(v))) throw new Error('vimeo_invalid_context');
  return date !== null && Date.parse(date) >= Math.min(...bounds.map(Date.parse));
}
function vimeoItem(
  raw,
  { id, url, date, actor, title, description, tags, duration, thumbnail, metrics, payload },
) {
  if (!/^\d+$/.test(id) || !vimeoUrl(url) || !date) return null;
  const caption = vimeoTrim(description);
  const item = {
    platform: 'vimeo',
    external_id: id,
    actor,
    item_type: 'video',
    url: vimeoUrl(url),
    published_at: date,
    title: typeof title === 'string' ? title : null,
    caption,
    credits_text: caption,
    hashtags: [...new Set(tags.map(vimeoHandle).filter(Boolean))],
    mentions: [...new Set((caption.match(/@([A-Za-z0-9._]+)/g) || []).map(vimeoHandle))],
    tagged_accounts: [],
    duration_seconds: vimeoCount(duration),
    thumbnail_url: vimeoUrl(thumbnail, true),
    metrics,
    media_urls: [],
    payload,
  };
  // Reject hostile identity disagreement rather than storing the public URL of another video.
  const parts = item.url
    .replace(/^https:\/\/[^/]+/, '')
    .split('/')
    .filter(Boolean);
  return parts[parts.length - 1] === id && vimeoRecord(raw) ? item : null;
}
function vimeoRows(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length > 10000) throw new Error('vimeo_invalid_rows');
  return rawItems;
}
function vimeoPayload(row, allowed) {
  // Metadata-only projection: never retain files, downloads, auth, cookies or arbitrary nested fields.
  const payload = {};
  for (const key of allowed) {
    const value = row[key];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      payload[key] = value;
    else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) payload[key] = [...value];
  }
  return payload;
}
function normalizeVimeoApiResult(rawItems, ctx = {}) {
  const items = [],
    errors = [];
  const matchKey = vimeoHandle(ctx.account?.handle);
  for (const row of vimeoRows(rawItems)) {
    const fail = (error) => errors.push({ error, matchKey });
    if (!vimeoRecord(row)) {
      fail('vimeo_contract_drift');
      continue;
    }
    if (row.error !== undefined) {
      fail('vimeo_provider_error');
      continue;
    }
    if (row.privacy?.view !== 'anybody') continue;
    const id = typeof row.uri === 'string' && /^\/videos\/\d+$/.test(row.uri) ? row.uri.slice(8) : '';
    const date = vimeoDate(row.release_time ?? row.created_time);
    const sizes = Array.isArray(row.pictures?.sizes) ? row.pictures.sizes : [];
    const thumbnail = sizes
      .filter(
        (s) =>
          vimeoRecord(s) &&
          Number.isFinite(s.width) &&
          s.width > 0 &&
          s.width <= 1280 &&
          vimeoUrl(s.link, true),
      )
      .sort((a, b) => b.width - a.width)[0]?.link;
    const payload = vimeoPayload(row, [
      'uri',
      'link',
      'name',
      'description',
      'release_time',
      'created_time',
      'duration',
    ]);
    payload.privacy = { view: 'anybody' };
    const item = vimeoItem(row, {
      id,
      url: row.link,
      date,
      actor: 'vimeo-api',
      title: row.name,
      description: row.description,
      tags: Array.isArray(row.tags) ? row.tags.map((t) => t?.name) : [],
      duration: row.duration,
      thumbnail,
      metrics: {
        plays: vimeoCount(row.stats?.plays),
        likes: vimeoCount(row.metadata?.connections?.likes?.total),
        comments: vimeoCount(row.metadata?.connections?.comments?.total),
      },
      payload,
    });
    if (!item) {
      fail('vimeo_contract_drift');
      continue;
    }
    if (vimeoInWindow(date, ctx)) items.push(item);
  }
  return { items, errors };
}
function normalizeVimeoApi(rawItems, ctx = {}) {
  return normalizeVimeoApiResult(rawItems, ctx).items;
}

if (typeof module !== 'undefined')
  module.exports = {
    normalizeVimeoApi,
    normalizeVimeoApiResult,
    vimeoHelpers: {
      vimeoRecord,
      vimeoText,
      vimeoHandle,
      vimeoCount,
      vimeoDate,
      vimeoUrl,
      vimeoOwner,
      vimeoInWindow,
      vimeoItem,
      vimeoRows,
      vimeoPayload,
    },
  };
