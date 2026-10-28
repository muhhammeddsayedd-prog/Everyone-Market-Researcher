// Pure source plans. This module never requests a target/provider or starts an actor.
import website from '../normalizers/websiteContentCrawler.js';
const { canonicalOwnedWebsiteUrl, websiteAccountScope, ownsWebsiteUrl, isWebsiteProjectUrl } = website;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = () => {
  throw Error('website_source_contract_invalid');
};
export function websiteMapLimit(options) {
  if (!object(options) || !['daily', 'backfill'].includes(options.mode)) bad();
  const maximum = options.mode === 'daily' ? 500 : 2000;
  const limit = options.map_limit ?? maximum;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) bad();
  return limit;
}

export function websiteSourceOptions(value, mode) {
  if (value === undefined) return {};
  if (
    !object(value) ||
    Object.keys(value).some((k) => !['map_limit', 'max_new_urls_per_account'].includes(k))
  )
    bad();
  if (value.map_limit !== undefined) websiteMapLimit({ mode, map_limit: value.map_limit });
  if (
    value.max_new_urls_per_account !== undefined &&
    (!Number.isSafeInteger(value.max_new_urls_per_account) ||
      value.max_new_urls_per_account < 1 ||
      value.max_new_urls_per_account > 2000)
  )
    bad();
  return { ...value };
}

export function selectWebsitePending(mapped, pending, options) {
  // Fix the representative candidate window before intersecting the URL diff.
  // Repeating it cannot silently select the next deferred page after ingestion.
  const candidates = mapped.slice(0, options.max_new_urls_per_account ?? 2000);
  const fresh = new Set(pending);
  const urls = candidates.filter((url) => fresh.has(url));
  return {
    urls,
    coverage: options.max_new_urls_per_account === undefined ? 'observed_map_only' : 'candidate_subset',
    candidate_urls: candidates.length,
    candidate_url_list: candidates,
    pending_urls: fresh.size,
    selected_urls: urls.length,
    deferred_urls: fresh.size - urls.length,
    backfill_done: false,
  };
}

export function buildWebsiteMapRequest(account, options) {
  const scope = websiteAccountScope(account),
    limit = websiteMapLimit(options);
  return {
    method: 'POST',
    url: 'https://api.firecrawl.dev/v2/map',
    timeoutMs: 60000,
    body: websiteMapBody(scope.url, limit),
  };
}

export function websiteMapBody(url, limit) {
  return {
    url,
    limit,
    includeSubdomains: false,
    sitemap: 'include',
    ignoreQueryParameters: true,
    timeout: 60000,
  };
}

export function websiteCrawlerInput(urls, crawlerType) {
  return {
    startUrls: urls.map((url) => ({ url })),
    crawlerType,
    maxCrawlDepth: 0,
    maxCrawlPages: urls.length,
    maxResults: urls.length,
    useSitemaps: false,
    useLlmsTxt: false,
    respectRobotsTxtFile: true,
    ignoreHttpsErrors: false,
    maxSessionRotations: 0,
    maxRequestRetries: 1,
    requestTimeoutSecs: 60,
    maxConcurrency: 3,
    saveMarkdown: true,
    htmlTransformer: 'readableText',
    removeCookieWarnings: true,
    blockMedia: true,
    saveFiles: false,
    saveContentTypes: '',
    saveHtml: false,
    saveHtmlAsFile: false,
    saveScreenshots: false,
    summarize: false,
    signHttpRequests: false,
    proxyConfiguration: { useApifyProxy: true },
  };
}

export function parseWebsiteMapResponse(response, account, options) {
  websiteAccountScope(account);
  const limit = websiteMapLimit(options);
  if (
    !object(response) ||
    response.statusCode !== 200 ||
    !object(response.body) ||
    response.body.success !== true ||
    !Array.isArray(response.body.links) ||
    response.body.links.length > limit
  )
    bad();
  const urls = new Set();
  let filtered = 0;
  for (const entry of response.body.links) {
    if (!object(entry) || typeof entry.url !== 'string') bad();
    const canonical = canonicalOwnedWebsiteUrl(entry.url);
    if (ownsWebsiteUrl(canonical, account) && isWebsiteProjectUrl(canonical, account)) urls.add(canonical);
    else filtered++;
  }
  const mapCapped = response.body.links.length >= limit;
  return {
    urls: [...urls].sort(),
    discovered: response.body.links.length,
    filtered,
    mapCapped,
    emptyMap: response.body.links.length === 0,
    backfillDone: false,
    coverage: mapCapped ? 'partial' : 'observed_map_only',
  };
}

export function buildWebsiteCrawlerBatches(account, urls, options = {}) {
  const scope = websiteAccountScope(account);
  if (
    !Array.isArray(urls) ||
    urls.length > 2000 ||
    !['cheerio', 'playwright:adaptive'].includes(options.crawlerType ?? 'cheerio')
  )
    bad();
  const canonical = urls.map(canonicalOwnedWebsiteUrl);
  if (
    new Set(canonical).size !== canonical.length ||
    canonical.some((url) => !ownsWebsiteUrl(url, account) || !isWebsiteProjectUrl(url, account))
  )
    bad();
  const plans = [];
  for (let offset = 0; offset < canonical.length; offset += 200) {
    const batch = canonical.slice(offset, offset + 200);
    plans.push({
      actor: 'apify/website-content-crawler',
      platform: 'website_work_page',
      account_ids: [scope.id],
      urls: batch,
      crawler_type: options.crawlerType ?? 'cheerio',
      input: websiteCrawlerInput(batch, options.crawlerType ?? 'cheerio'),
    });
  }
  return plans;
}
