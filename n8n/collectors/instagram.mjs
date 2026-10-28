// Pure input planning only. The existing async start/callback pipeline owns network and cost effects.
import instagram from '../normalizers/instagramScraper.js';

const { validateInstagramAccounts, instagramDate, instagramCutoff } = instagram;

/** Claimed account rows only; a daily reels caller obtains these from the secondary-pass RPC. */
export function buildInstagramBatches(accounts, options) {
  if (
    !options ||
    !['daily', 'backfill'].includes(options.mode) ||
    !['posts', 'reels'].includes(options.result_type)
  )
    throw new Error('ig_batch_context_invalid');
  if (options.now !== undefined && !instagramDate(options.now)) throw new Error('ig_reference_time_invalid');
  const validated = validateInstagramAccounts(accounts).map(({ account, handle }) => {
    // The joint posts/reels report stores both checkpoints in one account row.
    // Resume this pass's checkpoint, while accepting the legacy flat cursor.
    const cursor = account.backfill_cursor;
    account = {
      ...account,
      backfill_cursor:
        cursor && Object.hasOwn(cursor, options.result_type) ? cursor[options.result_type] : cursor,
    };
    if (options.mode === 'backfill' && account.backfill_cursor?.history_state === 'limit_exhausted')
      throw new Error('ig_backfill_history_unsupported');
    const watermark = instagramDate(account.last_item_published_at);
    if (options.mode === 'daily' && !watermark) throw new Error('ig_daily_watermark_required');
    const waves = account.backfill_cursor?.full_waves;
    const resultsLimit =
      options.mode === 'daily' ? 30 : Number.isSafeInteger(waves) && waves >= 3 ? 3000 : 1500;
    return {
      account,
      handle,
      watermark,
      resultsLimit,
      // A watermark-derived input is stable across launch/callback midnight.
      date: instagramCutoff(account, options.mode).slice(0, 10),
    };
  });
  validated.sort(
    (a, b) => (a.watermark ?? '').localeCompare(b.watermark ?? '') || a.handle.localeCompare(b.handle),
  );
  const chunkSize = options.mode === 'daily' ? 50 : 10;
  const buckets = new Map();
  for (const account of validated) {
    const key = `${account.date}:${account.resultsLimit}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(account);
  }
  const batches = [];
  for (const bucket of buckets.values()) {
    for (let index = 0; index < bucket.length; index += chunkSize) {
      const chunk = bucket.slice(index, index + chunkSize);
      batches.push({
        actor: 'apify/instagram-scraper',
        platform: 'instagram',
        purpose: options.mode,
        result_type: options.result_type,
        account_ids: chunk.map(({ account }) => account.id),
        input: {
          directUrls: chunk.map(({ handle }) => `https://www.instagram.com/${handle}/`),
          resultsType: options.result_type,
          resultsLimit: chunk[0].resultsLimit,
          onlyPostsNewerThan: chunk[0].date,
          // Apify currently documents this option for posts only. Reels are filtered after retrieval.
          ...(options.result_type === 'posts' ? { skipPinnedPosts: true } : {}),
          addParentData: false,
        },
      });
    }
  }
  return batches;
}

/** Both passes use the exact same claim set; this function never re-claims or re-schedules accounts. */
export function buildInstagramBackfillPasses(claimedAccounts) {
  return {
    posts: buildInstagramBatches(claimedAccounts, { mode: 'backfill', result_type: 'posts' }),
    reels: buildInstagramBatches(claimedAccounts, { mode: 'backfill', result_type: 'reels' }),
  };
}
