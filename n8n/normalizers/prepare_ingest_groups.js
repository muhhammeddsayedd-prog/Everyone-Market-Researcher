// Pure pre-RPC boundary for SUB Ingest items; no network, SQL or SDK calls.
// Required/optional normalized fields mirror the existing M01 ingest RPC.
// Code adapters paste hasSensitiveUrlQuery from smoke_website_stub.js first.
// CommonJS imports the identical pure helper for local contract tests.
const ingestQueryScreen =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./smoke_website_stub.js').hasSensitiveUrlQuery
    : typeof hasSensitiveUrlQuery === 'function'
      ? hasSensitiveUrlQuery
      : null;
const ingestItemKeys = [
  'platform',
  'external_id',
  'actor',
  'item_type',
  'url',
  'published_at',
  'payload',
  'title',
  'caption',
  'hashtags',
  'mentions',
  'tagged_accounts',
  'duration_seconds',
  'thumbnail_url',
  'metrics',
  'credits_text',
  'media_urls',
];
const ingestPlatforms = [
  'vimeo',
  'instagram',
  'instagram_stories',
  'website_work_page',
  'linkedin',
  'youtube',
  'news',
];
const ingestItemTypes = [
  'video',
  'post',
  'reel',
  'carousel',
  'story',
  'project_page',
  'linkedin_post',
  'news_article',
  'award_entry',
];
const ingestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ingestRecord = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === '[object Object]';

function invalidIngestGroups() {
  throw new Error('Invalid ingest groups');
}

function ingestJson(value, seen = new Set(), depth = 0) {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if ((!Array.isArray(value) && !ingestRecord(value)) || seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((child) => ingestJson(child, seen, depth + 1));
  seen.delete(value);
  return valid;
}

function publicIngestUrl(input) {
  if (
    typeof input !== 'string' ||
    !input ||
    input.length > 8192 ||
    !/^https?:\/\/[^/?#]/i.test(input) ||
    /^https?:\/\/[^/?#]*@/i.test(input) ||
    /[\s\u0000-\u001f\u007f\\]/u.test(input)
  )
    return false;
  let url;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return false;
  if (!ingestQueryScreen || ingestQueryScreen(url)) return false;
  const labels = url.hostname.split('.');
  const suffix = labels[labels.length - 1];
  return (
    labels.length >= 2 &&
    !/^[\d.]+$/.test(url.hostname) &&
    ![
      'arpa',
      'example',
      'home',
      'internal',
      'invalid',
      'lan',
      'local',
      'localdomain',
      'localhost',
      'onion',
      'test',
    ].includes(suffix) &&
    /^[a-z][a-z\d-]*$/i.test(suffix) &&
    labels.every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  );
}

function validIngestDate(input) {
  if (input === null) return true;
  if (
    typeof input !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input) ||
    !Number.isFinite(Date.parse(input))
  )
    return false;
  const [year, month, day] = input.slice(0, 10).split('-').map(Number);
  const offset = /[+-](\d{2}):(\d{2})$/.exec(input);
  if (year < 1 || (offset && (+offset[1] > 14 || +offset[2] > 59 || (+offset[1] === 14 && +offset[2] !== 0))))
    return false;
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
  );
}

function validIngestItem(item) {
  if (!ingestRecord(item) || Object.keys(item).some((key) => !ingestItemKeys.includes(key))) return false;
  if (
    !['platform', 'external_id', 'actor', 'item_type', 'url', 'published_at', 'payload'].every((key) =>
      Object.hasOwn(item, key),
    )
  )
    return false;
  if (
    !['platform', 'external_id', 'actor', 'item_type', 'url'].every(
      (key) => typeof item[key] === 'string' && item[key].trim().length > 0,
    )
  )
    return false;
  if (
    !ingestPlatforms.includes(item.platform) ||
    !ingestItemTypes.includes(item.item_type) ||
    !publicIngestUrl(item.url) ||
    !ingestRecord(item.payload) ||
    !ingestJson(item.payload) ||
    !validIngestDate(item.published_at)
  )
    return false;
  if (
    !['title', 'caption', 'thumbnail_url', 'credits_text'].every(
      (key) => !Object.hasOwn(item, key) || item[key] === null || typeof item[key] === 'string',
    )
  )
    return false;
  if (typeof item.caption === 'string' && item.caption.length > 8000) return false;
  if (
    !['hashtags', 'mentions', 'tagged_accounts', 'media_urls'].every(
      (key) =>
        !Object.hasOwn(item, key) ||
        (Array.isArray(item[key]) && item[key].every((value) => typeof value === 'string')),
    )
  )
    return false;
  if (
    Object.hasOwn(item, 'duration_seconds') &&
    item.duration_seconds !== null &&
    (!Number.isSafeInteger(item.duration_seconds) ||
      item.duration_seconds < 0 ||
      item.duration_seconds > 2147483647)
  )
    return false;
  if (
    Object.hasOwn(item, 'metrics') &&
    (!ingestRecord(item.metrics) ||
      Object.entries(item.metrics).some(
        ([key, value]) =>
          !['views', 'plays', 'likes', 'comments', 'shares'].includes(key) ||
          (value !== null && (!Number.isSafeInteger(value) || value < 0)),
      ))
  )
    return false;
  return true;
}

function prepareIngestGroups(groups) {
  if (!Array.isArray(groups)) return invalidIngestGroups();
  const accountIds = new Set();
  return groups.map((group) => {
    if (
      !ingestRecord(group) ||
      Object.keys(group).some(
        (key) =>
          !['account_id', 'items', 'status', 'error', 'backfill_done', 'backfill_cursor'].includes(key),
      ) ||
      typeof group.account_id !== 'string' ||
      !ingestUuid.test(group.account_id) ||
      accountIds.has(group.account_id.toLowerCase()) ||
      !Array.isArray(group.items)
    )
      return invalidIngestGroups();
    accountIds.add(group.account_id.toLowerCase());
    const status = group.status ?? 'success';
    const error = group.error ?? null;
    const backfillDone = group.backfill_done ?? false;
    const cursor = group.backfill_cursor ?? null;
    if (
      !['success', 'failed', 'skipped'].includes(status) ||
      (error !== null && typeof error !== 'string') ||
      typeof backfillDone !== 'boolean' ||
      (cursor !== null && (!ingestRecord(cursor) || !ingestJson(cursor)))
    )
      return invalidIngestGroups();
    const accepted = [];
    const invalid = [];
    for (const item of group.items) {
      if (validIngestItem(item)) accepted.push(item);
      else invalid.push(item);
    }
    const dropped = group.items.length - accepted.length;
    const drift = dropped * 5 > group.items.length;
    // Fail closed before producing RPC batches for a drifted/failed account.
    const items = !drift && status === 'success' ? accepted : [];
    const batches = [];
    for (let index = 0; index < items.length; index += 500) batches.push(items.slice(index, index + 500));
    const sampleKeys = [
      ...new Set(
        invalid
          .filter(ingestRecord)
          .flatMap((item) => Object.keys(item).filter((key) => ingestItemKeys.includes(key))),
      ),
    ]
      .sort()
      .slice(0, 8);
    return {
      account_id: group.account_id,
      status: drift ? 'failed' : status,
      error: drift ? `contract_drift: ${sampleKeys.join(',') || 'no_known_fields'}` : error,
      items_seen: group.items.length,
      items_dropped: dropped,
      items,
      batches,
      backfill_done: !drift && status === 'success' && backfillDone,
      backfill_cursor: cursor,
    };
  });
}

if (typeof module !== 'undefined') module.exports = { prepareIngestGroups };
