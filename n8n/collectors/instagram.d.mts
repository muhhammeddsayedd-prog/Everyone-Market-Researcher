export interface InstagramBatch {
  actor: 'apify/instagram-scraper';
  platform: 'instagram';
  purpose: 'daily' | 'backfill';
  result_type: 'posts' | 'reels';
  account_ids: string[];
  input: {
    directUrls: string[];
    resultsType: 'posts' | 'reels';
    resultsLimit: number;
    onlyPostsNewerThan: string;
    skipPinnedPosts?: true;
    addParentData: false;
  };
}
export function buildInstagramBatches(
  accounts: Record<string, unknown>[],
  options: { mode: 'daily' | 'backfill'; result_type: 'posts' | 'reels'; now?: string },
): InstagramBatch[];
export function buildInstagramBackfillPasses(accounts: Record<string, unknown>[]): {
  posts: InstagramBatch[];
  reels: InstagramBatch[];
};
