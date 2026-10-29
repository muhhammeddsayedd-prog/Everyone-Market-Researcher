// Public story INPUT planning only. The authenticated gateway owns launch permits,
// registration and settlement; this module performs no network or database I/O.
export const storyActors = Object.freeze({
  'data-slayer/instagram-stories-scraper': { maxAccounts: 100 },
  'igview-owner/instagram-story-viewer': { maxAccounts: 50 },
  'louisdeconinck/instagram-story-details-scraper': { maxAccounts: 100 },
});

export function validateStoryAccounts(accounts) {
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  if (!Array.isArray(accounts) || accounts.length > 100 || !accounts.length)
    throw Error('M06_STORIES_ACCOUNTS_INVALID');
  const ids = new Set(),
    handles = new Set();
  return accounts.map((account) => {
    if (!account || typeof account !== 'object' || Array.isArray(account))
      throw Error('M06_STORIES_ACCOUNTS_INVALID');
    const id = account.account_id ?? account.id;
    const handle = account.handle_norm ?? account.handle;
    if (
      !uuid(id) ||
      !uuid(account.competitor_id) ||
      (account.id && account.account_id && account.id !== account.account_id) ||
      account.platform !== 'instagram_stories' ||
      typeof handle !== 'string' ||
      !/^[a-z0-9._]{1,30}$/.test(handle) ||
      (account.handle !== undefined && account.handle !== handle) ||
      (account.url !== undefined && account.url !== `https://www.instagram.com/${handle}/`) ||
      (account.backfill_status !== undefined && account.backfill_status !== 'not_applicable') ||
      ids.has(id) ||
      handles.has(handle)
    )
      throw Error('M06_STORIES_ACCOUNTS_INVALID');
    ids.add(id);
    handles.add(handle);
    return { ...account, id, handle };
  });
}

/** Current official INPUT pages document usernames:string[] for all three
 * approved actors. maxItems is a separate provider/API execution option, not
 * an invented actor INPUT or proof that source history was exhausted. */
export function buildStoryBatches(accounts, options) {
  const actors = {
    'data-slayer/instagram-stories-scraper': 100,
    'igview-owner/instagram-story-viewer': 50,
    'louisdeconinck/instagram-story-details-scraper': 100,
  };
  if (
    !options ||
    Object.keys(options).some((k) => !['actor_id', 'collection_mode', 'results_limit'].includes(k)) ||
    !Object.hasOwn(actors, options.actor_id) ||
    !['ingest', 'bakeoff'].includes(options.collection_mode) ||
    (options.collection_mode === 'ingest' && options.actor_id !== 'data-slayer/instagram-stories-scraper') ||
    !Number.isSafeInteger(options.results_limit) ||
    options.results_limit < 1 ||
    options.results_limit > 1000
  )
    throw Error('M06_STORIES_PLAN_INVALID');
  const rows = validateStoryAccounts(accounts).sort((a, b) => a.handle.localeCompare(b.handle)),
    result = [];
  const chunkSize = Math.min(actors[options.actor_id], Math.floor(1000 / options.results_limit));
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    result.push({
      actor: options.actor_id,
      platform: 'instagram_stories',
      purpose: 'daily',
      pass: 'primary',
      collection_mode: options.collection_mode,
      account_ids: chunk.map((a) => a.id),
      resultsLimit: options.results_limit,
      input: { usernames: chunk.map((a) => a.handle) },
      coverage: { complete: false, reason: 'ephemeral_point_in_time_observation' },
    });
  }
  return result;
}

export function storyRegistrationCompletion(receipt, runId) {
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    receipt.registration_closed !== true ||
    typeof receipt.finished_now !== 'boolean' ||
    !['completed', 'awaiting_callbacks'].includes(receipt.state)
  )
    throw Error('M06_STORIES_REGISTRATION_INVALID');
  if (receipt.state === 'awaiting_callbacks') {
    if (receipt.finished_now || receipt.summary !== null) throw Error('M06_STORIES_REGISTRATION_INVALID');
    return { state: 'awaiting_callbacks' };
  }
  if (
    !receipt.finished_now ||
    !receipt.summary ||
    receipt.summary.run_id !== runId ||
    !['success', 'partial', 'failed'].includes(receipt.summary.status)
  )
    throw Error('M06_STORIES_REGISTRATION_INVALID');
  return { state: 'completed', status: receipt.summary.status };
}
