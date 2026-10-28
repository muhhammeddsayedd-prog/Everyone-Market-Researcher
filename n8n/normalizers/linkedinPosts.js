// Public harvestapi company-post projection. No I/O or credential handling.
// Unknown repost ownership/media shapes fail closed rather than borrowing a profile author.
const liRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const liUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function linkedinCompany(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  const match = /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/company\/([^/?#]+)\/?$/iu.exec(value);
  if (!match) return null;
  let slug;
  try {
    slug = decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return null;
  }
  if (!/^[\p{L}\p{N}._&+-]{1,160}$/u.test(slug)) return null;
  return { slug, url: `https://www.linkedin.com/company/${encodeURIComponent(slug)}/` };
}
function linkedinDate(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 946684800000 || value > 4102444800000) return null;
    return new Date(value).toISOString();
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  )
    return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  const offset = /[+-](\d\d):(\d\d)$/.exec(value);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  const parsed = new Date(value);
  if (
    year < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    (offset && (+offset[1] > 14 || +offset[2] > 59 || (+offset[1] === 14 && +offset[2] !== 0))) ||
    !Number.isFinite(parsed.getTime())
  )
    return null;
  return parsed.toISOString();
}
function linkedinAccounts(accounts, platform = 'linkedin') {
  if (
    !Array.isArray(accounts) ||
    accounts.length > 100 ||
    !['linkedin', 'linkedin_employees'].includes(platform)
  )
    throw Error('linkedin_accounts_invalid');
  const ids = new Set(),
    companies = new Set();
  return accounts.map((account) => {
    const id = account?.id ?? account?.account_id;
    const company = linkedinCompany(account?.url);
    if (
      !liRecord(account) ||
      !liUuid.test(id ?? '') ||
      (account.id && account.account_id && account.id !== account.account_id) ||
      !liUuid.test(account.competitor_id ?? '') ||
      account.platform !== platform ||
      !company ||
      (account.handle_norm ?? account.handle)?.toLowerCase() !== company.slug ||
      ids.has(id) ||
      companies.has(company.slug)
    )
      throw Error('linkedin_accounts_invalid');
    ids.add(id);
    companies.add(company.slug);
    return { account: { ...account, id }, ...company };
  });
}
const linkedinCount = (value) => {
  if (
    !['number', 'string'].includes(typeof value) ||
    value === '' ||
    (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value))
  )
    return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 && Number.isSafeInteger(Math.round(count))
    ? Math.round(count)
    : null;
};
function linkedinOwner(row) {
  if (!liRecord(row?.author) || (row.author.type && row.author.type !== 'company')) return null;
  const fromUrl = linkedinCompany(row.author.linkedinUrl);
  const fromName =
    typeof row.author.universalName === 'string' ? row.author.universalName.toLowerCase() : null;
  if (fromUrl && fromName && fromUrl.slug !== fromName) return null;
  return (
    fromUrl?.slug ??
    (row.author.type === 'company' && /^[\p{L}\p{N}._&+-]{1,160}$/u.test(fromName ?? '') ? fromName : null)
  );
}
function linkedinPostUrl(value, id) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f\u007f]/u.test(value))
    return null;
  const base = value.split(/[?#]/, 1)[0];
  if (!/^https:\/\/(?:www\.)?linkedin\.com\/(?:posts\/|feed\/update\/)/i.test(base)) return null;
  const found = /(?:activity-|urn:li:(?:activity|share|ugcPost):)(\d{8,30})(?:[-/]|$)/.exec(base);
  return found?.[1] === id ? base.replace('https://linkedin.com/', 'https://www.linkedin.com/') : null;
}
function linkedinSourceError(row) {
  if (!liRecord(row) || !Object.hasOwn(row, 'error')) return null;
  return /login|cookie|private|challenge|captcha/i.test(typeof row.error === 'string' ? row.error : '')
    ? 'linkedin_private_or_login'
    : 'linkedin_source_error';
}
function normalizeLinkedInPosts(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) throw Error('linkedin_rows_invalid');
  const items = [],
    errors = [];
  for (const row of rows) {
    const matchKey = linkedinOwner(row);
    const fail = (error) => errors.push({ error, matchKey });
    const sourceError = linkedinSourceError(row);
    if (sourceError) {
      fail(sourceError);
      continue;
    }
    if (!liRecord(row) || row.type !== 'post' || !matchKey) {
      fail('linkedin_owner_unverified');
      continue;
    }
    // No public company repost example currently establishes the outer owner/id contract.
    // Do not guess that the original author's post belongs to a requested company.
    if (
      row.isRepost === true ||
      row.isQuotePost === true ||
      row.repostedPost ||
      row.quotedPost ||
      row.repostedBy ||
      row.resharedPost
    ) {
      fail('linkedin_repost_shape_unverified');
      continue;
    }
    if (
      Object.keys(row).some(
        (key) =>
          ![
            'type',
            'id',
            'linkedinUrl',
            'author',
            'postedAt',
            'content',
            'engagement',
            'postImages',
            'document',
            'socialContent',
          ].includes(key),
      )
    ) {
      fail('linkedin_post_shape_unverified');
      continue;
    }
    const id = typeof row.id === 'string' && /^\d{8,30}$/.test(row.id) ? row.id : null;
    const url = id && linkedinPostUrl(row.linkedinUrl ?? row.socialContent?.shareUrl, id);
    const date = linkedinDate(row.postedAt?.date) ?? linkedinDate(row.postedAt?.timestamp);
    if (!id || !url || !date || typeof row.content !== 'string') {
      fail('linkedin_contract_drift');
      continue;
    }
    const reactions = Array.isArray(row.engagement?.reactions) ? row.engagement.reactions : [];
    const counts = reactions.map((reaction) => linkedinCount(reaction?.count));
    const total =
      counts.length && counts.every((count) => count !== null)
        ? linkedinCount(counts.reduce((sum, count) => sum + count, 0))
        : null;
    const content = row.content.slice(0, 8000);
    items.push({
      matchKey,
      json: {
        platform: 'linkedin',
        external_id: id,
        actor: 'harvestapi/linkedin-company-posts',
        item_type: 'linkedin_post',
        url,
        published_at: date,
        title: null,
        caption: content,
        hashtags: [
          ...new Set((content.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase())),
        ],
        mentions: [],
        tagged_accounts: [],
        thumbnail_url: null,
        duration_seconds: null,
        media_urls: [],
        metrics: {
          likes: linkedinCount(row.engagement?.likes) ?? total,
          comments: linkedinCount(row.engagement?.comments),
          shares: linkedinCount(row.engagement?.shares),
        },
        // Privacy/source projection, not an untouched rich profile/media object.
        payload: { id, content, company_slug: matchKey },
      },
    });
  }
  return { items, errors };
}
function prepareLinkedInPostResults(rows, ctx) {
  if (
    !liRecord(ctx) ||
    !['daily', 'backfill'].includes(ctx.mode) ||
    !linkedinDate(ctx.now) ||
    !Number.isSafeInteger(ctx.maxPosts) ||
    ctx.maxPosts < 1 ||
    ctx.maxPosts > 1000
  )
    throw Error('linkedin_result_context_invalid');
  const accounts = linkedinAccounts(ctx.accounts);
  const now = linkedinDate(ctx.now);
  const result = normalizeLinkedInPosts(rows);
  const known = new Set(accounts.map((entry) => entry.slug));
  const unmatched =
    result.items.filter((item) => !known.has(item.matchKey)).length +
    result.errors.filter((error) => !known.has(error.matchKey)).length;
  const groups = accounts.map(({ account, slug }) => {
    const owned = result.items.filter((item) => item.matchKey === slug);
    const invalid = result.errors.filter((error) => error.matchKey === slug);
    const watermark = linkedinDate(account.last_item_published_at ?? account.watermark_published_at);
    if (ctx.mode === 'daily' && !watermark) throw Error('linkedin_daily_watermark_required');
    const cutoff =
      ctx.mode === 'backfill'
        ? '2024-01-01T00:00:00.000Z'
        : new Date(
            Math.max(Date.parse('2024-01-01T00:00:00Z'), Date.parse(watermark) - 86400000),
          ).toISOString();
    const saturated = owned.length + invalid.length >= ctx.maxPosts;
    const error =
      invalid[0]?.error ??
      (unmatched
        ? 'linkedin_unmatched_source_rows'
        : owned.some((item) => item.json.published_at > now)
          ? 'linkedin_future_post'
          : saturated
            ? 'linkedin_recent_results_cap'
            : null);
    return {
      account_id: account.id,
      status: error ? 'failed' : 'success',
      error,
      items: error
        ? []
        : owned
            .filter((item) => item.json.published_at >= cutoff && item.json.published_at <= now)
            .map((item) => item.json),
      backfill_done: false,
      backfill_cursor:
        ctx.mode === 'backfill'
          ? {
              strategy: 'bounded_latest',
              source_stop_verified: false,
              max_posts: ctx.maxPosts,
              resume_supported: false,
            }
          : (account.backfill_cursor ?? null),
      coverage: {
        complete: false,
        capped: saturated,
        reason: saturated ? 'result_cap' : 'source_exhaustion_unverified',
      },
    };
  });
  return { groups, errors: result.errors, unmatched_count: unmatched, coverage_complete: false };
}

if (typeof module !== 'undefined')
  module.exports = {
    normalizeLinkedInPosts,
    prepareLinkedInPostResults,
    linkedinHelpers: { linkedinCompany, linkedinDate, linkedinAccounts, linkedinOwner },
  };
