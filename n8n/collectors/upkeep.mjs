// Local WF-40 product policy. This module performs no collection, database,
// provider or notification I/O. A source adapter must first authenticate and
// normalize the listing; a successful provider run alone is not coverage proof.
import instagram from '../normalizers/instagramScraper.js';
import linkedin from '../normalizers/linkedinPosts.js';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const external = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(v);
const date = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  instagram.instagramDate(v + 'T00:00:00Z')?.slice(0, 10) === v;
const platforms = ['vimeo', 'youtube', 'instagram', 'linkedin'];
const passes = { vimeo: ['videos'], youtube: ['videos'], instagram: ['posts', 'reels'], linkedin: ['posts'] };
const fail = (code) => {
  throw Error(code);
};
const utcDayBefore = (now, days) => new Date(Date.parse(now) - days * 86400000).toISOString().slice(0, 10);

/** Existing M04/M05 duplicate-upsert paths refresh observed metrics. Free daily
 * collection keeps its30-day overlap; paid listing/metrics is weekly, avoiding
 * an extra paid30-day collection every day. No account watermark is changed. */
export function planUpkeepWindow(platform, now, options = {}) {
  if (!platforms.includes(platform)) fail('M06_UPKEEP_PLATFORM_UNSUPPORTED');
  if (
    !instagram.instagramDate(now) ||
    !object(options) ||
    Object.keys(options).some((k) => !['freeDays', 'paidDays'].includes(k))
  )
    fail('M06_UPKEEP_CONTEXT_INVALID');
  const freeDays = options.freeDays ?? 90,
    paidDays = options.paidDays ?? 30;
  if (![freeDays, paidDays].every((v) => Number.isSafeInteger(v) && v >= 1 && v <= 365))
    fail('M06_UPKEEP_CONTEXT_INVALID');
  const paid = ['instagram', 'linkedin'].includes(platform);
  return {
    platform,
    removal_since: utcDayBefore(now, paid ? paidDays : freeDays),
    metrics_since: utcDayBefore(now, paid ? paidDays : 30),
    metrics_cadence: paid ? 'weekly' : 'daily',
    removal_cadence: 'weekly',
  };
}

/** Supported existing actor contracts, with a weekly listing date rather than
 * a changed source watermark. The finite result limit is not a completeness
 * assertion. Instagram posts must include pinned content for absence checks. */
export function planPaidRemovalBatches(accounts, options) {
  if (
    !object(options) ||
    Object.keys(options).some((k) => !['platform', 'pass', 'now', 'resultsLimit', 'paidDays'].includes(k)) ||
    !['instagram', 'linkedin'].includes(options.platform) ||
    !passes[options.platform].includes(options.pass) ||
    !Number.isSafeInteger(options.resultsLimit) ||
    options.resultsLimit < 1 ||
    options.resultsLimit > (options.platform === 'instagram' ? 3000 : 1000)
  )
    fail('M06_UPKEEP_CONTEXT_INVALID');
  const window = planUpkeepWindow(options.platform, options.now, { paidDays: options.paidDays ?? 30 });
  let rows;
  if (options.platform === 'instagram') {
    rows = instagram.validateInstagramAccounts(accounts).map(({ account, handle }) => {
      if (
        account.platform !== 'instagram' ||
        !uuid(account.competitor_id) ||
        account.url !== `https://www.instagram.com/${handle}/`
      )
        fail('M06_UPKEEP_CONTEXT_INVALID');
      return { id: account.id ?? account.account_id, handle, url: account.url };
    });
  } else {
    rows = linkedin.linkedinHelpers
      .linkedinAccounts(accounts)
      .map(({ account, slug }) => ({ id: account.id ?? account.account_id, handle: slug, url: account.url }));
  }
  if (
    !rows.length ||
    rows.length > 100 ||
    rows.some((r) => !uuid(r.id)) ||
    new Set(rows.map((r) => r.id)).size !== rows.length
  )
    fail('M06_UPKEEP_CONTEXT_INVALID');
  rows.sort((a, b) => a.handle.localeCompare(b.handle));
  const result = [];
  // Keep existing paid backfill-sized groups; this is not a parallel launch or
  // actor-start decision. The runtime must register and reconcile each group.
  for (let at = 0; at < rows.length; at += 10) {
    const chunk = rows.slice(at, at + 10);
    result.push({
      actor:
        options.platform === 'instagram' ? 'apify/instagram-scraper' : 'harvestapi/linkedin-company-posts',
      platform: options.platform,
      purpose: 'removal_check',
      pass: options.pass,
      account_ids: chunk.map((r) => r.id),
      since: window.removal_since,
      metrics_since: window.metrics_since,
      input:
        options.platform === 'instagram'
          ? {
              directUrls: chunk.map((r) => r.url),
              resultsType: options.pass,
              resultsLimit: options.resultsLimit,
              onlyPostsNewerThan: window.removal_since,
              ...(options.pass === 'posts' ? { skipPinnedPosts: false } : {}),
              addParentData: false,
            }
          : {
              targetUrls: chunk.map((r) => r.url),
              postedLimitDate: window.removal_since,
              maxPosts: options.resultsLimit,
              includeReposts: true,
              includeQuotePosts: true,
              scrapeReactions: false,
              scrapeComments: false,
            },
      coverage: { complete: false, reason: 'listing_not_observed' },
    });
  }
  return result;
}

/** Receipt is an internal verified-source contract, never an arbitrary webhook
 * body. The maintained gateway must construct it from authoritative run/INPUT/
 * listing evidence before permitting a future restricted removal RPC. */
function evaluateListingPart(target, receipt, allowEmpty = false) {
  const invalid = () => fail('M06_UPKEEP_LISTING_INVALID');
  if (
    !object(target) ||
    !uuid(target.account_id) ||
    !platforms.includes(target.platform) ||
    !passes[target.platform].includes(target.pass) ||
    !date(target.since) ||
    !date(target.metrics_since) ||
    target.metrics_since < target.since ||
    !Array.isArray(target.known_external_ids) ||
    target.known_external_ids.length > 100000 ||
    target.known_external_ids.some((v) => !external(v)) ||
    new Set(target.known_external_ids).size !== target.known_external_ids.length
  )
    invalid();
  if (
    !object(receipt) ||
    receipt.account_id !== target.account_id ||
    receipt.platform !== target.platform ||
    receipt.pass !== target.pass ||
    receipt.requested_since !== target.since ||
    !['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(receipt.status) ||
    !['range_complete', 'source_exhausted', 'reached_since', 'hit_limit', 'pinned_included'].every(
      (k) => typeof receipt[k] === 'boolean',
    ) ||
    !(
      receipt.next_cursor === null ||
      (typeof receipt.next_cursor === 'string' &&
        receipt.next_cursor.length > 0 &&
        receipt.next_cursor.length <= 2048)
    ) ||
    !Array.isArray(receipt.entries) ||
    receipt.entries.length > 100000
  )
    invalid();
  const entries = new Map();
  for (const r of receipt.entries) {
    if (
      !object(r) ||
      r.account_id !== target.account_id ||
      r.platform !== target.platform ||
      !external(r.external_id) ||
      !instagram.instagramDate(r.published_at)
    )
      invalid();
    const prior = entries.get(r.external_id);
    if (prior && prior.published_at !== r.published_at) invalid();
    entries.set(r.external_id, r);
  }
  const seen = [...entries.keys()].sort();
  const metrics =
    receipt.status === 'SUCCEEDED' || receipt.observed_entries_validated === true
      ? [...entries.values()]
          .filter((r) => Date.parse(r.published_at) >= Date.parse(target.metrics_since + 'T00:00:00Z'))
          .map((r) => r.external_id)
          .sort()
      : [];
  const skip = (reason) => ({
    eligible: false,
    reason,
    metrics_external_ids: metrics,
    mark_removed_args: null,
  });
  if (receipt.status !== 'SUCCEEDED') return skip('source_run_not_successful');
  if (!seen.length && !allowEmpty) return skip('empty_listing');
  if (receipt.hit_limit && seen.length < target.known_external_ids.length / 2)
    return skip('suspect_partial_listing');
  if (target.platform === 'instagram' && target.pass === 'posts' && !receipt.pinned_included)
    return skip('pinned_posts_not_covered');
  if (
    !receipt.range_complete ||
    (!receipt.source_exhausted && !receipt.reached_since) ||
    receipt.hit_limit ||
    receipt.next_cursor !== null
  )
    return skip('range_not_covered');
  return {
    eligible: true,
    reason: null,
    metrics_external_ids: metrics,
    mark_removed_args: { p_account_id: target.account_id, p_seen_external_ids: seen, p_since: target.since },
  };
}

/** Instagram passes share the same account row. Account-level absence is only
 * meaningful after BOTH owned listings covered the requested date range. A
 * posts-only success may update metrics, but cannot remove another pass's work. */
export function evaluateRemovalListing(target, receipt) {
  if (target?.platform !== 'instagram' || target.pass !== 'posts_and_reels') {
    const part = evaluateListingPart(target, receipt);
    return target.platform === 'instagram' && part.eligible
      ? { ...part, eligible: false, reason: 'instagram_other_pass_pending', mark_removed_args: null }
      : part;
  }
  if (
    !object(receipt) ||
    receipt.account_id !== target.account_id ||
    receipt.platform !== 'instagram' ||
    receipt.pass !== 'posts_and_reels' ||
    receipt.requested_since !== target.since ||
    !Array.isArray(receipt.passes) ||
    receipt.passes.length !== 2 ||
    new Set(receipt.passes.map((r) => r?.pass)).size !== 2 ||
    receipt.passes.some((r) => !['posts', 'reels'].includes(r?.pass))
  )
    fail('M06_UPKEEP_LISTING_INVALID');
  const parts = ['posts', 'reels'].map((pass) => {
    const source = receipt.passes.find((r) => r.pass === pass);
    return { pass, source, plan: evaluateListingPart({ ...target, pass }, source, true) };
  });
  const metrics = [...new Set(parts.flatMap((p) => p.plan.metrics_external_ids))].sort();
  const incomplete = parts.find((p) => !p.plan.eligible);
  if (incomplete)
    return {
      eligible: false,
      reason: 'instagram_' + incomplete.pass + '_' + incomplete.plan.reason,
      metrics_external_ids: metrics,
      mark_removed_args: null,
    };
  return evaluateListingPart(
    { ...target, pass: 'posts' },
    {
      ...parts[0].source,
      entries: parts.flatMap((p) => p.source.entries),
    },
  );
}

/** Local coordinator only; the concrete restricted removal RPC/gateway and
 * source coverage adapters are still pending. No export claims this is a hosted
 * runnable WF-40. Ports must retain human locks and normal upsert idempotency. */
export async function runRemovalAccount(target, receipt, deps, signal) {
  const plan = evaluateRemovalListing(target, receipt);
  if (!object(deps) || typeof deps.refreshMetrics !== 'function' || typeof deps.markRemoved !== 'function')
    fail('M06_UPKEEP_BINDING_REQUIRED');
  const check = () => {
    if (signal?.aborted) fail('M06_UPKEEP_CANCELLED');
  };
  check();
  let updated = 0;
  if (plan.metrics_external_ids.length) {
    let metrics;
    try {
      metrics = await deps.refreshMetrics(plan.metrics_external_ids, {
        account_id: target.account_id,
        signal,
      });
    } catch {
      // The source/runtime must reconcile any known write; never expose a
      // transport error or issue another mutation after an uncertain result.
      fail('M06_UPKEEP_METRICS_RECONCILIATION_REQUIRED');
    }
    if (
      !object(metrics) ||
      !Number.isSafeInteger(metrics.updated) ||
      metrics.updated < 0 ||
      metrics.updated > plan.metrics_external_ids.length
    )
      fail('M06_UPKEEP_METRICS_RECONCILIATION_REQUIRED');
    updated = metrics.updated;
  }
  check();
  if (!plan.eligible) return { ...plan, metrics_updated: updated, removal: null };
  let mutation;
  try {
    mutation = await deps.markRemoved(plan.mark_removed_args, { signal });
  } catch {
    fail('M06_UPKEEP_REMOVAL_RECONCILIATION_REQUIRED');
  }
  if (
    !object(mutation) ||
    !['removed', 'restored'].every((k) => Number.isSafeInteger(mutation[k]) && mutation[k] >= 0)
  )
    fail('M06_UPKEEP_REMOVAL_RECONCILIATION_REQUIRED');
  return {
    ...plan,
    metrics_updated: updated,
    removal: { removed: mutation.removed, restored: mutation.restored },
  };
}
