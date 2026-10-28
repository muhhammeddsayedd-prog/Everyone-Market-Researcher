// Pure bounded INPUT planning. Launch permits, provider calls and settlement belong to the gateway/callback.
import posts from '../normalizers/linkedinPosts.js';
const { linkedinAccounts, linkedinDate, linkedinCompany } = posts.linkedinHelpers;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function day(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(value) &&
    linkedinDate(value + 'T00:00:00Z')?.slice(0, 10) === value
  );
}
export const linkedinPlanningHelpers = Object.freeze({ object, day });

// Closing registration can race the last callback. Report the owned SQL result,
// rather than assuming that asynchronous collection is still pending.
export function linkedinRegistrationCompletion(receipt, runId) {
  if (
    !object(receipt) ||
    receipt.registration_closed !== true ||
    typeof receipt.finished_now !== 'boolean' ||
    !['completed', 'awaiting_callbacks'].includes(receipt.state)
  )
    throw Error('M05_LINKEDIN_RECEIPT_INVALID');
  if (receipt.state === 'awaiting_callbacks') {
    if (receipt.finished_now || receipt.summary !== null) throw Error('M05_LINKEDIN_RECEIPT_INVALID');
    return { state: 'awaiting_callbacks' };
  }
  if (
    !receipt.finished_now ||
    !object(receipt.summary) ||
    receipt.summary.run_id !== runId ||
    !['success', 'partial', 'failed'].includes(receipt.summary.status)
  )
    throw Error('M05_LINKEDIN_RECEIPT_INVALID');
  return { state: 'completed', status: receipt.summary.status };
}

export function buildLinkedInPostBatches(accounts, options) {
  if (
    !object(options) ||
    Object.keys(options).some((key) => !['mode', 'now', 'maxPosts'].includes(key)) ||
    !['daily', 'backfill'].includes(options.mode) ||
    !linkedinDate(options.now)
  )
    throw Error('linkedin_batch_context_invalid');
  const maxPosts = options.maxPosts ?? (options.mode === 'daily' ? 50 : 500);
  const now = linkedinDate(options.now);
  if (!Number.isSafeInteger(maxPosts) || maxPosts < 1 || maxPosts > 1000)
    throw Error('linkedin_results_bound_invalid');
  const rows = linkedinAccounts(accounts)
    .map((entry) => {
      const watermark = linkedinDate(
        entry.account.last_item_published_at ?? entry.account.watermark_published_at,
      );
      if (options.mode === 'daily' && (!watermark || watermark > now))
        throw Error('linkedin_daily_watermark_required');
      const cutoff =
        options.mode === 'backfill'
          ? '2024-01-01T00:00:00.000Z'
          : new Date(
              Math.max(Date.parse('2024-01-01T00:00:00Z'), Date.parse(watermark) - 86400000),
            ).toISOString();
      return { ...entry, date: cutoff.slice(0, 10) };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  const buckets = new Map();
  for (const entry of rows) {
    if (!buckets.has(entry.date)) buckets.set(entry.date, []);
    buckets.get(entry.date).push(entry);
  }
  const maximum = options.mode === 'daily' ? 50 : 10;
  const result = [];
  for (const [date, bucket] of buckets) {
    for (let index = 0; index < bucket.length; index += maximum) {
      const chunk = bucket.slice(index, index + maximum);
      result.push({
        actor: 'harvestapi/linkedin-company-posts',
        platform: 'linkedin',
        purpose: options.mode,
        result_type: 'posts',
        account_ids: chunk.map((entry) => entry.account.id),
        resultsLimit: maxPosts,
        input: {
          targetUrls: chunk.map((entry) => entry.account.url),
          postedLimitDate: date,
          maxPosts,
          includeReposts: true,
          includeQuotePosts: true,
          scrapeReactions: false,
          scrapeComments: false,
        },
        coverage: { complete: false, reason: 'bounded_latest_query', resume_supported: false },
      });
    }
  }
  return result;
}

export function buildLinkedInEmployeeBatches(accounts, options) {
  if (
    !object(options) ||
    Object.keys(options).some((key) => !['snapshotDate', 'maxItemsPerCompany', 'cursors'].includes(key)) ||
    !day(options.snapshotDate)
  )
    throw Error('linkedin_employee_context_invalid');
  const maximum = options.maxItemsPerCompany ?? 200;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    maximum > 200 ||
    (options.cursors !== undefined && !object(options.cursors))
  )
    throw Error('linkedin_employee_results_bound_invalid');
  const rows = linkedinAccounts(accounts, 'linkedin_employees').sort((a, b) => a.slug.localeCompare(b.slug));
  if (
    options.cursors &&
    Object.keys(options.cursors).some((id) => !rows.some((entry) => entry.account.id === id))
  )
    throw Error('linkedin_employee_cursor_invalid');
  return rows.map((entry) => {
    const cursor = options.cursors?.[entry.account.id];
    const startPage = cursor?.next_page ?? 1;
    const pages = Math.ceil(maximum / 25);
    if (
      cursor !== undefined &&
      (!object(cursor) ||
        Object.keys(cursor).sort().join(',') !== 'company_url,next_page,snapshot_date' ||
        linkedinCompany(cursor.company_url)?.slug !== entry.slug ||
        cursor.snapshot_date !== options.snapshotDate)
    )
      throw Error('linkedin_employee_cursor_invalid');
    if (!Number.isSafeInteger(startPage) || startPage < 1 || startPage + pages - 1 > 100)
      throw Error('linkedin_employee_cursor_invalid');
    return {
      actor: 'harvestapi/linkedin-company-employees',
      platform: 'linkedin_employees',
      purpose: 'weekly',
      result_type: 'employees',
      account_ids: [entry.account.id],
      snapshot_date: options.snapshotDate,
      resultsLimit: maximum,
      input: {
        companies: [entry.account.url],
        profileScraperMode: 'Short ($4 per 1k)',
        companyBatchMode: 'one_by_one',
        maxItems: maximum,
        maxItemsPerCompany: maximum,
        startPage,
        takePages: pages,
      },
      coverage: {
        complete: false,
        reason: 'bounded_company_query',
        start_page: startPage,
        page_limit: pages,
      },
    };
  });
}
