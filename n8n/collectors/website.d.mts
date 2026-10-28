export interface WebsiteMapRequest {
  method: 'POST';
  url: 'https://api.firecrawl.dev/v2/map';
  timeoutMs: number;
  body: {
    url: string;
    limit: number;
    includeSubdomains: false;
    sitemap: 'include';
    ignoreQueryParameters: true;
    timeout: number;
  };
}
export interface WebsiteCrawlerBatch {
  actor: 'apify/website-content-crawler';
  platform: 'website_work_page';
  account_ids: string[];
  urls: string[];
  crawler_type: 'cheerio' | 'playwright:adaptive';
  input: Record<string, unknown>;
}
export interface WebsiteSourceOptions {
  map_limit?: number;
  max_new_urls_per_account?: number;
}
export function websiteMapLimit(options: unknown): number;
export function websiteSourceOptions(value: unknown, mode: unknown): WebsiteSourceOptions;
export function selectWebsitePending(
  mapped: string[],
  pending: string[],
  options: WebsiteSourceOptions,
): {
  urls: string[];
  coverage: 'observed_map_only' | 'candidate_subset';
  candidate_urls: number;
  candidate_url_list: string[];
  pending_urls: number;
  selected_urls: number;
  deferred_urls: number;
  backfill_done: false;
};
export function buildWebsiteMapRequest(account: unknown, options: unknown): WebsiteMapRequest;
export function websiteMapBody(url: string, limit: number): WebsiteMapRequest['body'];
export function websiteCrawlerInput(
  urls: string[],
  crawlerType: 'cheerio' | 'playwright:adaptive',
): Record<string, unknown>;
export function parseWebsiteMapResponse(
  response: unknown,
  account: unknown,
  options: unknown,
): {
  urls: string[];
  discovered: number;
  filtered: number;
  mapCapped: boolean;
  emptyMap: boolean;
  backfillDone: false;
  coverage: 'partial' | 'observed_map_only';
};
export function buildWebsiteCrawlerBatches(
  account: unknown,
  urls: string[],
  options?: { crawlerType?: 'cheerio' | 'playwright:adaptive' },
): WebsiteCrawlerBatch[];
