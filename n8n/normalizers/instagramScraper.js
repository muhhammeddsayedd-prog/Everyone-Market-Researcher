// Pure apify/instagram-scraper adapter. No network, SDK, secret or database access.
// The declarations can be composed directly in an n8n Cloud Code node.
const instagramRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const instagramHandle = (value) => {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
};
const instagramDate = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  const offset = /[+-](\d{2}):(\d{2})$/.exec(value);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  const parsed = new Date(value);
  if (
    year < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offset && (+offset[1] > 14 || +offset[2] > 59 || (+offset[1] === 14 && +offset[2] !== 0))) ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    !Number.isFinite(parsed.getTime())
  )
    return null;
  return parsed.toISOString();
};
function instagramCutoff(account, mode, now) {
  const reference = now === undefined ? null : instagramDate(now);
  if (now !== undefined && !reference) throw new Error('ig_reference_time_invalid');
  const floor = Date.parse('2024-01-01T00:00:00.000Z');
  if (mode === 'backfill') return new Date(floor).toISOString();
  const watermark = instagramDate(account.last_item_published_at);
  if (!watermark) throw new Error('ig_daily_watermark_required');
  const overlap = Date.parse(watermark) - 86400000;
  return new Date(
    Math.max(floor, Math.min(overlap, Date.parse(reference ?? watermark) - 30 * 86400000)),
  ).toISOString();
}
const instagramCount = (value, max = Number.MAX_SAFE_INTEGER) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim()) ||
    !['number', 'string'].includes(typeof value)
  )
    return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 && Number.isSafeInteger(Math.round(count)) && count <= max
    ? Math.round(count)
    : null;
};
const instagramError = (row) =>
  instagramRecord(row) && (Boolean(row.error) || Boolean(row.errorDescription) || row.isPrivate === true);
const instagramStrings = (values, transform) => [
  ...new Set((Array.isArray(values) ? values : []).map(transform).filter(Boolean)),
];
function instagramThumbnail(value) {
  // Lexical projection only, compatible with Cloud Code without URL/imports.
  // A media-fetch consumer must still validate public DNS and disallow redirects;
  // this adapter never fetches and raw payload URLs are not a fetch allowlist.
  if (typeof value !== 'string' || value.length > 8192 || /[\s\\\u0000-\u001f\u007f#]/u.test(value))
    return null;
  const match = /^https:\/\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?$/.exec(value);
  if (!match) return null;
  const host = match[1].toLowerCase();
  if (
    host.length > 253 ||
    !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    !['cdninstagram.com', 'fbcdn.net'].some((base) => host === base || host.endsWith('.' + base))
  )
    return null;
  const credentialKeys = [
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'apikey',
    'clientsecret',
    'clientpassword',
    'accesskey',
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'auth',
    'authorization',
    'credential',
    'credentials',
    'signature',
    'sig',
    'key',
    'xgoogapikey',
    'xamzcredential',
    'xamzsignature',
    'xamzsecuritytoken',
  ];
  for (const parameter of (match[2] ?? '').split('&')) {
    let key = parameter.split('=')[0].replace(/\+/g, ' ');
    for (let pass = 0; pass < 3 && key.includes('%'); pass++) {
      try {
        key = decodeURIComponent(key);
      } catch {
        return null;
      }
    }
    if (key.includes('%') || credentialKeys.includes(key.toLowerCase().replace(/[-_]/g, ''))) return null;
  }
  return value;
}
const instagramProfileKey = (row) => {
  const owner = instagramHandle(row?.ownerUsername ?? row?.username);
  if (owner) return owner;
  // Profile URL fallback is only for provider error rows, never to infer content ownership.
  if (!instagramError(row)) return null;
  const match = /^https:\/\/(?:www\.)?instagram\.com\/([a-z0-9._]{1,30})\/(?:reels\/)?$/i.exec(
    row.inputUrl ?? row.url ?? '',
  );
  return match ? instagramHandle(match[1]) : null;
};

function validateInstagramAccounts(accounts) {
  if (!Array.isArray(accounts)) throw new Error('ig_accounts_invalid');
  const ids = new Set();
  const handles = new Set();
  return accounts.map((input) => {
    const account = instagramRecord(input)
      ? {
          ...input,
          id: input.account_id ?? input.id,
          last_item_published_at: input.watermark_published_at ?? input.last_item_published_at,
        }
      : input;
    const handle = instagramHandle(account?.handle_norm ?? account?.handle);
    if (
      !instagramRecord(account) ||
      (input.account_id !== undefined && input.id !== undefined && input.account_id !== input.id) ||
      typeof account.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.id) ||
      !handle ||
      (account.platform !== undefined && account.platform !== 'instagram') ||
      ids.has(account.id.toLowerCase()) ||
      handles.has(handle)
    )
      throw new Error('ig_accounts_invalid');
    ids.add(account.id.toLowerCase());
    handles.add(handle);
    return { account, handle };
  });
}

/** (rawItems, {result_type?}) -> normalized[]; errors/ownership belong to the result adapter. */
function normalizeInstagramScraper(rawItems, ctx = {}) {
  if (
    !Array.isArray(rawItems) ||
    !instagramRecord(ctx) ||
    !['posts', 'reels'].includes(ctx.result_type ?? 'posts')
  )
    throw new Error('ig_normalizer_context_invalid');
  const out = [];
  for (const row of rawItems) {
    if (
      !instagramRecord(row) ||
      instagramError(row) ||
      !['Image', 'Video', 'Sidecar'].includes(row.type) ||
      typeof row.shortCode !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(row.shortCode) ||
      !instagramHandle(row.ownerUsername) ||
      (row.caption !== undefined && row.caption !== null && typeof row.caption !== 'string')
    )
      continue;
    const publishedAt = instagramDate(row.timestamp);
    if (!publishedAt) continue;
    const caption = (row.caption ?? '').slice(0, 8000);
    const itemType =
      row.type === 'Sidecar'
        ? 'carousel'
        : row.type === 'Image'
          ? 'post'
          : row.productType === 'clips' || ctx.result_type === 'reels'
            ? 'reel'
            : 'video';
    const hashtags = instagramStrings(
      [...(Array.isArray(row.hashtags) ? row.hashtags : []), ...(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])],
      (value) =>
        typeof value === 'string' && /^#?[\p{L}\p{N}_]+$/u.test(value)
          ? value.replace(/^#/, '').toLowerCase()
          : null,
    );
    const mentions = instagramStrings(
      [...(Array.isArray(row.mentions) ? row.mentions : []), ...(caption.match(/@[A-Za-z0-9._]+/g) ?? [])],
      instagramHandle,
    );
    const tagged = [
      ...(Array.isArray(row.taggedUsers) ? row.taggedUsers : []),
      ...(Array.isArray(row.coauthorProducers) ? row.coauthorProducers : []),
    ];
    const candidateThumbnail = row.displayUrl || (Array.isArray(row.images) ? row.images[0] : null);
    const thumbnail = instagramThumbnail(candidateThumbnail);
    out.push({
      platform: 'instagram',
      external_id: row.shortCode,
      actor: 'apify/instagram-scraper',
      item_type: itemType,
      // A stable permalink avoids a posts/reels pass producing different canonical URLs.
      url: `https://www.instagram.com/p/${row.shortCode}/`,
      published_at: publishedAt,
      title: null,
      caption,
      hashtags,
      mentions,
      tagged_accounts: instagramStrings(tagged, (user) => instagramHandle(user?.username)),
      duration_seconds: instagramCount(row.videoDuration, 2147483647),
      thumbnail_url: thumbnail,
      metrics: {
        likes: instagramCount(row.likesCount),
        comments: instagramCount(row.commentsCount),
        views: instagramCount(row.videoViewCount ?? row.videoPlayCount ?? row.igPlayCount),
        shares: instagramCount(row.reshareCount ?? row.sharesCount),
      },
      media_urls: [],
      payload: row,
    });
  }
  return out;
}

/**
 * Separates account failures and unmatched owners from ingest groups. No RPC or schedule mutation.
 * ctx: {accounts:[{id,handle|handle_norm,last_item_published_at?,consecutive_failures?}],
 *       mode:'daily'|'backfill', result_type:'posts'|'reels', resultsLimit:integer}.
 * The caller passes `secondary` as p_secondary to the reviewed reporting RPC; it is not an item field.
 */
function prepareInstagramResults(rawItems, ctx) {
  if (
    !Array.isArray(rawItems) ||
    !instagramRecord(ctx) ||
    !['daily', 'backfill'].includes(ctx.mode) ||
    !['posts', 'reels'].includes(ctx.result_type) ||
    !Number.isSafeInteger(ctx.resultsLimit) ||
    ctx.resultsLimit < 1 ||
    ctx.resultsLimit > 3000
  )
    throw new Error('ig_result_context_invalid');
  const accounts = validateInstagramAccounts(ctx.accounts);
  const byHandle = new Map(accounts.map(({ account, handle }) => [handle, { account, handle, rows: [] }]));
  const unmatched = { count: 0, owner_usernames: [] };
  for (const row of rawItems) {
    const key = instagramProfileKey(row);
    const group = byHandle.get(key);
    if (group) group.rows.push(row);
    else {
      unmatched.count += 1;
      if (key && !unmatched.owner_usernames.includes(key) && unmatched.owner_usernames.length < 5)
        unmatched.owner_usernames.push(key);
    }
  }
  const dropped = { invalid: 0, older_than_cutoff: 0, pinned_before_watermark: 0 };
  const errors = [];
  const groups = [...byHandle.values()].map(({ account, handle, rows }) => {
    const watermark = instagramDate(account.last_item_published_at);
    if (ctx.mode === 'daily' && !watermark) throw new Error('ig_daily_watermark_required');
    const cutoff = instagramCutoff(account, ctx.mode, ctx.now);
    const items = [];
    const sourceDates = [];
    const unpinnedDates = [];
    let error = rows.length === 0 ? 'ig_no_account_evidence' : null;
    let invalidationRequired = false;
    for (const row of rows) {
      if (instagramError(row)) {
        const privateOrLogin =
          row.isPrivate === true ||
          /private|login|challenge|checkpoint/i.test(
            `${typeof row.error === 'string' ? row.error : ''} ${typeof row.errorDescription === 'string' ? row.errorDescription : ''}`,
          );
        error = privateOrLogin ? 'ig_private_or_login' : (error ?? 'ig_source_error');
        invalidationRequired =
          invalidationRequired ||
          (privateOrLogin &&
            Number.isSafeInteger(account.consecutive_failures) &&
            account.consecutive_failures >= 2);
        continue;
      }
      const [item] = normalizeInstagramScraper([row], { result_type: ctx.result_type });
      if (!item) {
        dropped.invalid += 1;
        error = error ?? 'ig_contract_drift';
        continue;
      }
      sourceDates.push(item.published_at);
      if (row.isPinned !== true) unpinnedDates.push(item.published_at);
      if (ctx.mode === 'daily' && row.isPinned === true && item.published_at < watermark) {
        dropped.pinned_before_watermark += 1;
        continue;
      }
      if (item.published_at < cutoff) {
        dropped.older_than_cutoff += 1;
        continue;
      }
      items.push(item);
    }
    const oldest = sourceDates.length ? [...sourceDates].sort()[0] : null;
    const oldestUnpinned = unpinnedDates.length ? [...unpinnedDates].sort()[0] : null;
    const complete =
      !error &&
      ctx.mode === 'backfill' &&
      ctx.result_type === 'posts' &&
      (sourceDates.length < ctx.resultsLimit || (oldestUnpinned !== null && oldestUnpinned <= cutoff));
    if (error)
      errors.push({
        account_id: account.id,
        matchKey: handle,
        error,
        invalidation_required: invalidationRequired,
      });
    const checkpoint = account.backfill_cursor;
    const passCursor =
      instagramRecord(checkpoint) && Object.hasOwn(checkpoint, ctx.result_type)
        ? checkpoint[ctx.result_type]
        : checkpoint;
    const priorWaves = passCursor?.full_waves;
    const fullWaves =
      sourceDates.length >= ctx.resultsLimit
        ? (Number.isSafeInteger(priorWaves) && priorWaves >= 0 ? priorWaves : 0) + 1
        : 0;
    return {
      account_id: account.id,
      status: error ? 'failed' : 'success',
      error,
      items: error ? [] : items,
      backfill_done: complete,
      backfill_cursor:
        !error && ctx.mode === 'backfill' && !complete && oldest
          ? {
              oldest_seen: oldest,
              full_waves: fullWaves,
              results_limit: ctx.resultsLimit,
              history_state:
                sourceDates.length >= ctx.resultsLimit && ctx.resultsLimit === 3000
                  ? 'limit_exhausted'
                  : 'incomplete',
              strategy: 'latest_limit_escalation',
              resume_supported: false,
            }
          : null,
    };
  });
  return {
    groups,
    errors,
    unmatched,
    dropped,
    secondary: ctx.result_type === 'reels',
    // A normalized page cannot establish complete daily metrics coverage.
    // The callback/parent owns dataset EOF and source-cap accounting.
    coverage_complete: false,
    limitations: [
      ...(ctx.mode === 'backfill' && ctx.result_type === 'reels'
        ? ['reels_backfill_exhaustion_unverified']
        : []),
      ...(ctx.mode === 'backfill' && groups.some((g) => g.backfill_cursor)
        ? ['historical_cursor_unsupported']
        : []),
      ...(ctx.mode === 'backfill' &&
      groups.some((g) => g.backfill_cursor?.history_state === 'limit_exhausted')
        ? ['historical_results_limit_exhausted']
        : []),
      ...(ctx.mode === 'daily' && ctx.now === undefined ? ['daily_metrics_horizon_not_supplied'] : []),
      ...(ctx.mode === 'daily' && [...byHandle.values()].some((g) => g.rows.length >= ctx.resultsLimit)
        ? ['daily_results_limit_reached']
        : []),
    ],
  };
}

if (typeof module !== 'undefined')
  module.exports = {
    normalizeInstagramScraper,
    prepareInstagramResults,
    validateInstagramAccounts,
    instagramDate,
    instagramCutoff,
  };
