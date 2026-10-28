// Shared pure M06 source projection. Paste _common.js before this file in a
// Cloud Code node. No I/O, provider start, callback or scheduling lives here.
const storyCommon =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./_common.js')
    : { tags, ats, trim8k };
const storyRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const storyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function storyHandle(v) {
  if (typeof v !== 'string') return null;
  const handle = v.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}
function storyDate(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^[0-9]{9,13}$/.test(value))) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 946684800 || n > 4102444800000) return null;
    const ms = n < 100000000000 ? n * 1000 : n;
    return ms >= 946684800000 && ms <= 4102444800000 ? new Date(ms).toISOString() : null;
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  )
    return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  const offset = /[+-](\d\d):(\d\d)$/.exec(value),
    calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  const parsed = Date.parse(value);
  if (
    year < 2000 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    (offset && (+offset[1] > 14 || +offset[2] > 59 || (+offset[1] === 14 && +offset[2] !== 0))) ||
    !Number.isFinite(parsed)
  )
    return null;
  return new Date(parsed).toISOString();
}
function storyPublicUrl(value, thumbnail = false) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\\\u0000-\u001f\u007f#]/u.test(value))
    return null;
  const match = /^https:\/\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?$/.exec(value);
  if (!match) return null;
  const host = match[1].toLowerCase(),
    labels = host.split('.'),
    suffix = labels.at(-1);
  if (
    host.length > 253 ||
    labels.length < 2 ||
    !labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) ||
    !/^[a-z][a-z0-9-]*$/.test(suffix) ||
    [
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
    ].includes(suffix) ||
    (thumbnail &&
      !['cdninstagram.com', 'fbcdn.net'].some((base) => host === base || host.endsWith('.' + base)))
  )
    return null;
  for (const parameter of (match[2] ?? '').split('&')) {
    let key = parameter.split('=')[0].replace(/\+/g, ' ');
    for (let i = 0; i < 3 && key.includes('%'); i++) {
      try {
        key = decodeURIComponent(key);
      } catch {
        return null;
      }
    }
    if (
      key.includes('%') ||
      /^(?:accesstoken|refreshtoken|idtoken|apikey|clientsecret|clientpassword|password|passwd|pwd|secret|token|auth|authorization|credential|credentials|signature|sig|key|xgoogapikey|xamzcredential|xamzsignature|xamzsecuritytoken)$/.test(
        key.toLowerCase().replace(/[-_]/g, ''),
      )
    )
      return null;
  }
  return value;
}
function storyOwner(row, field) {
  if (!storyRecord(row)) return null;
  const primary = field === 'user' ? row.user?.username : row[field];
  if (!storyHandle(primary)) return null;
  const values = [primary];
  for (const value of [row.creator_username, row.username, row.user?.username, row.user_info?.username])
    if (value !== undefined && value !== null) values.push(value);
  const names = values.filter((v) => v !== undefined && v !== null).map(storyHandle);
  return names.length && names.every((v) => v && v === names[0]) ? names[0] : null;
}
function storyPrivateMarkers(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value !== 'object') return false;
  if (depth > 12 || seen.has(value)) return true;
  seen.add(value);
  const bad = Object.entries(value).some(
    ([key, v]) =>
      /^(?:cookies?|initialcookies|authorization|password|access_?token|api_?key|client_?secret)$/i.test(
        key,
      ) || storyPrivateMarkers(v, seen, depth + 1),
  );
  seen.delete(value);
  return bad;
}
function storySourceError(row) {
  if (!storyRecord(row)) return 'stories_contract_drift';
  const text = [row.error, row.errorDescription, row.status, row.message]
    .filter((v) => typeof v === 'string')
    .join(' ');
  if (
    row.isPrivate === true ||
    row.is_private === true ||
    row.user?.is_private === true ||
    row.user_info?.is_private === true ||
    /login|cookie|challenge|checkpoint|captcha|private|authentication|auth_required/i.test(text) ||
    storyPrivateMarkers(row)
  )
    return 'stories_private_or_login';
  return row.error ||
    row.errorDescription ||
    (row.status != null &&
      (typeof row.status !== 'string' ||
        !/^(?:success|ok|no_stories|no stories|no_active_stories)$/i.test(row.status)))
    ? 'stories_source_error'
    : null;
}
function storyIdentity(row, fields) {
  const parts = [],
    raw = [];
  for (const key of fields) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) return null;
    if (!['string', 'number'].includes(typeof value)) return null;
    const s = String(value),
      match = /^([1-9][0-9]{0,29})(?:_[1-9][0-9]{0,29})?$/.exec(s);
    if (!match) return null;
    parts.push(match[1]);
    raw.push(s);
  }
  if (parts.length)
    return parts.every((p) => p === parts[0])
      ? { external_id: parts[0], story_key: parts[0], raw_id: raw[0] }
      : null;
  if (typeof row.code === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(row.code))
    return { external_id: row.code, story_key: null, raw_id: row.code };
  return null;
}
function storyReference(ctx) {
  const now = storyRecord(ctx) ? storyDate(ctx.now) : null;
  if (!now) throw Error('stories_context_invalid');
  return now;
}
function normalizeStoryRows(rows, ctx, shape) {
  const reference = storyReference(ctx);
  if (!Array.isArray(rows) || rows.length > 10000) throw Error('stories_rows_invalid');
  const items = [],
    summaries = [],
    errors = [];
  for (const row of rows) {
    const owner = storyOwner(row, shape.owner),
      fail = (error) => errors.push({ matchKey: owner, error });
    const sourceError = storySourceError(row);
    if (sourceError) {
      fail(sourceError);
      continue;
    }
    if (!owner) {
      fail('stories_owner_unverified');
      continue;
    }
    const id = storyIdentity(row, shape.ids);
    const noIds =
      shape.ids.every((k) => row[k] === undefined || row[k] === null || row[k] === '') && !row.code;
    if (
      noIds &&
      /^(?:no_stories|no stories|no_active_stories)$/i.test(row.status ?? '') &&
      row.stories_count === 0
    ) {
      summaries.push({ matchKey: owner });
      continue;
    }
    if (!id) {
      fail('stories_identity_invalid');
      continue;
    }
    if (row.stories_count === 0 && /no.*stor/i.test(row.status ?? '')) {
      fail('stories_summary_conflict');
      continue;
    }
    const timestamps = shape.times
      .filter((k) => row[k] !== undefined && row[k] !== null)
      .map((k) => storyDate(row[k]));
    const publishedAt = timestamps[0];
    if (!publishedAt || timestamps.some((t) => !t || t !== publishedAt) || publishedAt > reference) {
      fail('stories_time_invalid');
      continue;
    }
    if (
      row.expiring_at != null &&
      (!storyDate(row.expiring_at) || storyDate(row.expiring_at) < publishedAt)
    ) {
      fail('stories_time_invalid');
      continue;
    }
    const permalink = row.story_permalink;
    if (permalink != null && permalink !== `https://www.instagram.com/stories/${owner}/${id.external_id}/`) {
      fail('stories_permalink_owner_mismatch');
      continue;
    }
    const value = shape.caption(row);
    if (value !== undefined && value !== null && typeof value !== 'string') {
      fail('stories_contract_drift');
      continue;
    }
    const caption = storyCommon.trim8k(value ?? '');
    const mentions = [
      ...new Set([
        ...storyCommon.ats(caption),
        ...shape
          .mentions(row)
          .map((v) => storyHandle(typeof v === 'string' ? v : v?.username))
          .filter(Boolean),
      ]),
    ];
    const candidates = shape.thumbnails(row),
      thumbnail = candidates.map((v) => storyPublicUrl(v, true)).find(Boolean) ?? null;
    const link = storyPublicUrl(shape.link(row));
    const duration = shape.duration(row),
      durationSeconds =
        typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 2147483647
          ? Math.round(duration)
          : null;
    // Only public story fields enter raw ingest. Full actor user/profile objects,
    // private fields and video download URLs are intentionally not persisted.
    const payload = {
      story_id: id.external_id,
      creator_username: owner,
      taken_at: publishedAt,
      caption,
      thumbnail_url: thumbnail,
      mentions,
      story_link_url: link,
    };
    items.push({
      matchKey: owner,
      story_key: id.story_key,
      raw_id: id.raw_id,
      json: {
        platform: 'instagram_stories',
        external_id: id.external_id,
        actor: shape.actor,
        item_type: 'story',
        url: `https://www.instagram.com/stories/${owner}/${id.external_id}/`,
        published_at: publishedAt,
        title: null,
        caption,
        hashtags: storyCommon.tags(caption),
        mentions,
        tagged_accounts: [],
        duration_seconds: durationSeconds,
        thumbnail_url: thumbnail,
        metrics: {},
        media_urls: [],
        payload,
      },
    });
  }
  return { items, summaries, errors };
}
function prepareStoryResults(rows, ctx, shape) {
  const reference = storyReference(ctx);
  if (!Array.isArray(ctx.accounts) || ctx.accounts.length < 1 || ctx.accounts.length > shape.maxAccounts)
    throw Error('stories_accounts_invalid');
  const ids = new Set(),
    handles = new Set();
  const accounts = ctx.accounts.map((a) => {
    const rawId = a?.account_id ?? a?.id,
      id = typeof rawId === 'string' ? rawId.toLowerCase() : null,
      handle = storyHandle(a?.handle_norm ?? a?.handle);
    const profile =
      a?.url == null ? null : /^https:\/\/(?:www\.)?instagram\.com\/([a-z0-9._]{1,30})\/?$/i.exec(a.url);
    if (
      !storyRecord(a) ||
      !storyUuid.test(id ?? '') ||
      (a.id && a.account_id && a.id !== a.account_id) ||
      typeof a.competitor_id !== 'string' ||
      !storyUuid.test(a.competitor_id) ||
      (a.handle !== undefined && storyHandle(a.handle) !== handle) ||
      (a.url != null && (!profile || profile[1].toLowerCase() !== handle)) ||
      a.platform !== 'instagram_stories' ||
      !handle ||
      ids.has(id) ||
      handles.has(handle)
    )
      throw Error('stories_accounts_invalid');
    ids.add(id);
    handles.add(handle);
    return { id, handle };
  });
  const parsed = normalizeStoryRows(rows, { now: reference }, shape),
    allRows = [...parsed.items, ...parsed.summaries, ...parsed.errors];
  const unmatched = allRows.filter((r) => !handles.has(r.matchKey)).length,
    errors = [],
    limitations = [];
  const groups = accounts.map((a) => {
    const found = parsed.items.filter((r) => r.matchKey === a.handle),
      summaries = parsed.summaries.filter((r) => r.matchKey === a.handle),
      failures = parsed.errors.filter((r) => r.matchKey === a.handle);
    let error = unmatched
      ? 'stories_unmatched_owner'
      : (failures[0]?.error ?? (found.length || summaries.length ? null : 'stories_no_account_evidence'));
    if (found.length && summaries.length) error = error ?? 'stories_summary_conflict';
    const unique = new Map();
    for (const r of found) {
      if (
        unique.has(r.json.external_id) &&
        JSON.stringify(unique.get(r.json.external_id).json) !== JSON.stringify(r.json)
      )
        error = error ?? 'stories_duplicate_conflict';
      else unique.set(r.json.external_id, r);
    }
    const valid = [...unique.values()];
    if (
      valid.some((r) => r.story_key === null) &&
      !limitations.includes('story_key_minute_fallback_collision_possible')
    )
      limitations.push('story_key_minute_fallback_collision_possible');
    if (error) errors.push({ account_id: a.id, matchKey: a.handle, error });
    return {
      account_id: a.id,
      status: error ? 'failed' : 'success',
      error,
      items: error ? [] : valid.map((r) => r.json),
      // Comparison projection only. Registered callback/run metadata must supply
      // capture day and owned Apify ID before any future save_bakeoff_rows RPC.
      bakeoff_rows: error
        ? []
        : valid.map((r) => ({
            actor: shape.actor,
            account_id: a.id,
            story_key: r.story_key ?? `${a.id}:${Math.floor(Date.parse(r.json.published_at) / 60000)}`,
            raw_id: r.raw_id,
            taken_at: r.json.published_at,
            has_thumbnail: r.json.thumbnail_url !== null,
            has_mentions: r.json.mentions.length > 0,
            has_link: r.json.payload.story_link_url !== null,
          })),
    };
  });
  return { groups, errors, unmatched_count: unmatched, coverage_complete: false, limitations };
}
const storiesToolkit = { normalizeStoryRows, prepareStoryResults };
if (typeof module !== 'undefined') module.exports = storiesToolkit;
