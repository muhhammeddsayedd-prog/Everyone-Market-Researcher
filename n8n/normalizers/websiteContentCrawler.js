// Local product adapter; source examples are not captured-provider acceptance.
// Normalization never fetches URLs. Requesting ports must enforce public DNS,
// strict TLS and redirect policy independently of these lexical checks.
// CommonJS is the existing normalizer/server callback contract.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const websiteCommon = require('./smoke_website_stub.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { instagramDate } = require('./instagramScraper.js');
const websiteObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const websiteUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const websiteBad = () => {
  throw Error('website_contract_invalid');
};

function canonicalOwnedWebsiteUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /%(?:2f|5c|2e)/i.test(value)) websiteBad();
  const url = websiteCommon.canonicalWebsiteUrl(value);
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
  return parsed.href;
}

function websiteAccountScope(account) {
  if (
    !websiteObject(account) ||
    !websiteUuid.test(account.account_id ?? account.id ?? '') ||
    !websiteUuid.test(account.competitor_id ?? '') ||
    !['website', 'website_work_page'].includes(account.platform)
  )
    websiteBad();
  const canonical = canonicalOwnedWebsiteUrl(account.url);
  const url = new URL(canonical);
  return {
    id: account.account_id ?? account.id,
    competitor_id: account.competitor_id,
    platform: account.platform,
    url: canonical,
    origin: url.origin,
    pathname: url.pathname,
  };
}

function ownsWebsiteUrl(value, account) {
  const scope = websiteAccountScope(account),
    url = new URL(canonicalOwnedWebsiteUrl(value));
  return (
    url.origin === scope.origin &&
    (scope.platform === 'website' ||
      scope.pathname === '/' ||
      url.pathname === scope.pathname ||
      url.pathname.startsWith(scope.pathname + '/'))
  );
}

const excludedWebsitePath =
  /(?:^|\/)(?:tag|tags|category|categories|page|wp-json|feed|privacy|terms|contact|careers|about|team|cookie|404)(?:\/|$)/i;
const websiteAsset =
  /\.(?:jpe?g|png|gif|webp|svg|ico|pdf|docx?|xlsx?|pptx?|zip|mp[34]|mov|avi|wav|woff2?|css|js|json|xml)(?:$|\/)/i;

function isWebsiteProjectUrl(value, account) {
  const scope = websiteAccountScope(account),
    canonical = canonicalOwnedWebsiteUrl(value),
    url = new URL(canonical);
  if (
    !ownsWebsiteUrl(canonical, account) ||
    excludedWebsitePath.test(url.pathname) ||
    websiteAsset.test(url.pathname)
  )
    return false;
  if (scope.platform === 'website_work_page' && scope.pathname !== '/')
    return url.pathname !== scope.pathname;
  return /(?:^|\/)(?:work|works|projects?[^/]*|portfolio|case-stud[^/]*|films|campaigns|clients|news|blog)(?:\/)[^/]+/i.test(
    url.pathname,
  );
}

function websiteDate(value) {
  if (typeof value !== 'string') return null;
  return instagramDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00Z' : value);
}

function websitePublished(row, body, now) {
  const m = row.metadata ?? {},
    candidates = [];
  for (const entry of Array.isArray(m.openGraph) ? m.openGraph.slice(0, 64) : [])
    if (websiteObject(entry) && entry.property === 'article:published_time')
      candidates.push(['open_graph', entry.content]);
  candidates.push(['metadata', m.datePublished], ['metadata', m.publishedTime]);
  const jsonLd = [m.jsonLd, row.jsonLd];
  const html = typeof row.html === 'string' ? row.html.slice(0, 2097152) : '';
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (jsonLd.length >= 6 || match[1].length > 65536) break;
    try {
      jsonLd.push(JSON.parse(match[1]));
    } catch {
      /* Unknown date remains null. */
    }
  }
  const readDate = (value, depth = 0) => {
    if (depth > 3 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 20)) readDate(entry, depth + 1);
      return;
    }
    if (typeof value.datePublished === 'string') candidates.push(['json_ld', value.datePublished]);
    if (value['@graph']) readDate(value['@graph'], depth + 1);
  };
  jsonLd.forEach((value) => readDate(value));
  const nearTitle = body
    .slice(0, 500)
    .match(/(?:^|\n)\s*(?:(?:published|posted|date|release date)\s*:?\s*)?(20\d{2}-\d{2}-\d{2})(?:\s|$)/i);
  if (nearTitle) candidates.push(['near_title', nearTitle[1]]);
  const reference = now === undefined ? null : websiteDate(now);
  if (now !== undefined && reference === null) websiteBad();
  for (const [source, value] of candidates) {
    const date = websiteDate(value);
    if (date && (reference === null || date <= reference)) return { date, source };
  }
  return { date: null, source: 'unknown' };
}

function websiteMediaUrls(text) {
  const found = new Set();
  for (const match of text.matchAll(/https:\/\/[^\s<>"')\]]+/g)) {
    try {
      const value = match[0].replaceAll('&amp;', '&'),
        url = new URL(value);
      // Validate public lexical form and reject credential queries before any
      // projection. No URL here is a download instruction or fetch permission.
      websiteCommon.canonicalWebsiteUrl(value);
      const host = url.hostname.toLowerCase();
      const vimeo = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)
        ? url.pathname.match(/^\/(?:video\/)?([0-9]{1,20})\/?$/)?.[1]
        : null;
      const youtube =
        host === 'youtu.be'
          ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
          : ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(host)
            ? url.pathname === '/watch'
              ? url.searchParams.get('v')
              : url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
            : null;
      if (vimeo) found.add('https://vimeo.com/' + vimeo);
      if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube))
        found.add('https://www.youtube.com/watch?v=' + youtube);
    } catch {
      /* Drop unsafe/unrelated media references; never fetch them. */
    }
    if (found.size >= 50) break;
  }
  return [...found];
}

function websiteContext(ctx) {
  if (
    !websiteObject(ctx) ||
    !['daily', 'backfill'].includes(ctx.mode) ||
    !['cheerio', 'playwright:adaptive'].includes(ctx.crawlerType) ||
    ![0, 1].includes(ctx.retryAttempt) ||
    !Array.isArray(ctx.requestedUrls) ||
    ctx.requestedUrls.length < 1 ||
    ctx.requestedUrls.length > 200
  )
    websiteBad();
  websiteAccountScope(ctx.account);
  const requested = ctx.requestedUrls.map(canonicalOwnedWebsiteUrl);
  if (
    new Set(requested).size !== requested.length ||
    requested.some((url) => !ownsWebsiteUrl(url, ctx.account))
  )
    websiteBad();
  if (ctx.now !== undefined && websiteDate(ctx.now) === null) websiteBad();
  return requested;
}

function normalizeWebsitePage(row, ctx) {
  const requested = websiteContext(ctx);
  let url;
  try {
    url = canonicalOwnedWebsiteUrl(row?.url);
  } catch {
    return {
      outcome: 'failed',
      url: null,
      item: null,
      error: 'website_result_url_invalid',
      retryable: false,
    };
  }
  if (!requested.includes(url)) websiteBad();
  const failed = (error) => ({ outcome: 'failed', url, item: null, error, retryable: false });
  if (
    !websiteObject(row) ||
    (row.metadata != null && !websiteObject(row.metadata)) ||
    (row.crawl != null && !websiteObject(row.crawl))
  )
    return failed('website_contract_drift');
  const m = row.metadata ?? {},
    crawl = row.crawl ?? {};
  try {
    for (const associated of [m.canonicalUrl, crawl.loadedUrl])
      if (associated != null && associated !== '' && canonicalOwnedWebsiteUrl(associated) !== url)
        return failed('website_ownership_drift');
  } catch {
    return failed('website_ownership_drift');
  }
  const status = crawl.httpStatusCode ?? crawl.statusCode ?? m.statusCode;
  if (
    status !== undefined &&
    (!Number.isInteger(status) || status < 200 || (status >= 300 && status !== 304))
  )
    return failed('website_http_failed');
  if (row.error || row.isBlocked === true) return failed('website_source_failed');
  const body = row.markdown ?? row.text ?? '';
  if (typeof body !== 'string' || body.length > 2097152 || (m.title != null && typeof m.title !== 'string'))
    return failed('website_contract_drift');
  const challengeText =
    body.slice(0, 2000) + '\n' + (typeof row.html === 'string' ? row.html.slice(0, 16384) : '');
  if (
    /captcha|verify (?:that )?you are human|sign in to continue|login required|cf-chl-|type\s*=\s*["']?password/i.test(
      challengeText,
    )
  )
    return failed('website_private_or_blocked');
  const title = websiteCommon.smokeBoundedText((m.title ?? '').split(/\s[|–-]\s/)[0], 2000) || null;
  if (
    !isWebsiteProjectUrl(url, ctx.account) ||
    /^(?:privacy(?: policy)?|terms(?: of use)?|contact(?: us)?|careers|about(?: us)?|our team|cookie policy|404)$/i.test(
      title ?? '',
    )
  )
    return { outcome: 'ignored', url, item: null, error: null, retryable: false };
  if (body.trim().length < 300)
    return {
      outcome: ctx.crawlerType === 'cheerio' && ctx.retryAttempt === 0 ? 'thin' : 'failed',
      url,
      item: null,
      error: 'website_thin_content',
      retryable: ctx.crawlerType === 'cheerio' && ctx.retryAttempt === 0,
    };
  if (
    !/\b(?:credits|director|client|agency|production|campaign|film|commercial|project)\b|إخراج|إنتاج|انتاج|عميل|حملة|فيلم/i.test(
      body,
    )
  )
    return { outcome: 'ignored', url, item: null, error: null, retryable: false };
  const published = websitePublished(row, body, ctx.now),
    caption = websiteCommon.smokeBoundedText(body, 8000);
  const creditSection =
    body.match(/(?:^|\n)\s*#*\s*(?:credits|director|client|agency)\b[\s\S]{0,1500}/i)?.[0] ?? null;
  const thumbnail = Array.isArray(m.openGraph)
    ? m.openGraph.find((v) => websiteObject(v) && v.property === 'og:image')?.content
    : null;
  let thumbnailUrl = null;
  if (typeof thumbnail === 'string') {
    try {
      const raw = new URL(thumbnail, url).href;
      websiteCommon.canonicalWebsiteUrl(raw);
      if (raw.startsWith('https://')) thumbnailUrl = raw;
    } catch {
      /* Unsafe thumbnail is omitted. */
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const hash = require('crypto').createHash('sha256').update(url, 'utf8').digest('hex').slice(0, 32);
  const item = {
    platform: 'website_work_page',
    external_id: hash,
    actor: 'apify/website-content-crawler',
    item_type: 'project_page',
    url,
    published_at: published.date,
    title,
    caption,
    ...(creditSection ? { credits_text: creditSection } : {}),
    hashtags: [],
    mentions: [],
    tagged_accounts: [],
    duration_seconds: null,
    thumbnail_url: thumbnailUrl,
    metrics: {},
    media_urls: websiteMediaUrls(
      caption + ' ' + (typeof row.html === 'string' ? row.html.slice(0, 2097152) : ''),
    ),
    payload: {
      url,
      markdown: caption,
      metadata: { title },
      backfill: ctx.mode === 'backfill',
      date_provenance: published.source,
    },
  };
  return { outcome: 'crawled', url, item, error: null, retryable: false };
}

function prepareWebsiteResults(rows, ctx) {
  if (!Array.isArray(rows) || rows.length > 200) websiteBad();
  const requested = websiteContext(ctx);
  const byUrl = new Map();
  for (const row of rows) {
    const outcome = normalizeWebsitePage(row, ctx);
    if (outcome.url === null || byUrl.has(outcome.url)) websiteBad();
    byUrl.set(outcome.url, outcome);
  }
  const outcomes = requested.map((url) => {
    return (
      byUrl.get(url) ?? {
        outcome: 'failed',
        url,
        item: null,
        error: 'website_result_missing',
        retryable: false,
      }
    );
  });
  const retryUrls = outcomes.filter((o) => o.retryable).map((o) => o.url);
  const items = outcomes.filter((o) => o.outcome === 'crawled').map((o) => o.item);
  // A thin primary page is pending, not success evidence: the SQL settlement
  // barrier holds the claim until the single reviewed adaptive retry settles.
  // Valid pages survive a sibling failure; the account result remains failed.
  const group = {
    account_id: websiteAccountScope(ctx.account).id,
    status: outcomes.some((o) => o.outcome === 'failed') ? 'failed' : 'success',
    items,
    pages: outcomes.map((o) => ({ url: o.url, status: o.outcome })),
    retry_urls: retryUrls,
    backfill_cursor: ctx.account.backfill_cursor ?? null,
  };
  return {
    outcomes,
    items,
    retryUrls,
    group,
    complete: retryUrls.length === 0 && outcomes.every((o) => ['crawled', 'ignored'].includes(o.outcome)),
    coverage: 'requested_urls_only',
  };
}

module.exports = {
  canonicalOwnedWebsiteUrl,
  websiteAccountScope,
  ownsWebsiteUrl,
  isWebsiteProjectUrl,
  normalizeWebsitePage,
  prepareWebsiteResults,
};
