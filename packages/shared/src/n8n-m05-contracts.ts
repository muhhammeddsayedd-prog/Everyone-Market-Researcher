import { z } from 'zod';

const id = z.uuid();
const external = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const ids = z
  .array(id)
  .min(1)
  .max(20)
  .refine((v) => new Set(v).size === v.length);
const count = z.number().int().nonnegative();
export const m05Actors = [
  'apify/website-content-crawler',
  'harvestapi/linkedin-company-posts',
  'harvestapi/linkedin-company-employees',
] as const;
export const m05Platforms = [
  'website_work_page',
  'website',
  'youtube',
  'linkedin',
  'linkedin_employees',
] as const;
export const m05WorkflowIds = {
  'WF-00': 'MzimjpsuyPuK7SKe',
  'WF-13': 'F7S8Llr0ZSaSuw4T',
  'WF-18': 'VbJn4mLYm0sGy1X2',
  'WF-18b': 'h6lUXSGN5sV2jxuQ',
  'WF-21': '02yefa9uEPYwmM3N',
  'WF-19': 'TsqSMa5MlO3QBLkt',
} as const;
export const m05ExecutionErrorArgs = z
  .strictObject({
    workflow_id: z.enum(Object.values(m05WorkflowIds)),
    execution_id: z.string().regex(/^(?:[0-9]{1,15}|handler-[0-9]{1,15})$/),
    error_code: z.enum(['workflow_failed', 'callback_retryable']),
  })
  .refine(
    (v) =>
      v.error_code !== 'callback_retryable' ||
      (v.workflow_id === m05WorkflowIds['WF-19'] && !v.execution_id.startsWith('handler-')),
  );
const mode = z.enum(['daily', 'backfill', 'weekly']);
const person = z.strictObject({
  public_id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  title: z.string().max(500).nullable(),
  location: z.string().max(300).nullable(),
});
const coverage = z.strictObject({
  complete: z.boolean(),
  reason: z.string().max(100),
  capped: z.boolean().optional(),
  observed_count: count.optional(),
  membership_evidence: z.literal('registered_company_query').optional(),
});
const item = z
  .strictObject({
    platform: z.enum(['website_work_page', 'youtube', 'linkedin']),
    external_id: external,
    actor: z.enum(['youtube-api', 'streamers/youtube-scraper', ...m05Actors]),
    item_type: z.enum(['project_page', 'video', 'reel', 'linkedin_post']),
    url: z.url(),
    published_at: z.iso.datetime({ offset: true }).nullable(),
    title: z.string().nullable(),
    caption: z.string().max(8000),
    credits_text: z.string().max(1500).optional(),
    hashtags: z.array(z.string()),
    mentions: z.array(z.string()),
    tagged_accounts: z.array(z.string()),
    duration_seconds: count.nullable(),
    thumbnail_url: z.url().nullable(),
    metrics: z.record(z.string(), count.nullable()),
    media_urls: z.array(z.url()).max(100),
    payload: z.json(),
  })
  .refine((v) => v.published_at !== null || v.platform === 'website_work_page');
const launch = z
  .strictObject({
    run_id: id,
    launch_id: id,
    actor_id: z.enum(m05Actors),
    pass: z.literal('primary'),
    account_ids: ids,
    purpose: mode,
    results_limit: count.min(1).max(1000),
    actor_input: z.record(z.string(), z.json()),
    urls: z.array(z.url()).max(200).optional(),
    crawler_type: z.enum(['cheerio', 'playwright:adaptive']).optional(),
    snapshot_date: z.iso.date().optional(),
    retry_of: id.optional(),
  })
  .refine((v) => v.actor_id === 'harvestapi/linkedin-company-posts' || v.results_limit <= 200)
  .refine((v) =>
    v.actor_id === 'apify/website-content-crawler'
      ? v.account_ids.length === 1 && !!v.urls?.length && !!v.crawler_type
      : v.actor_id !== 'harvestapi/linkedin-company-employees' ||
        (v.account_ids.length === 1 && !!v.snapshot_date),
  );
export const m05Args = {
  'm05.execution.error': m05ExecutionErrorArgs,
  'm05.start': z.strictObject({
    workflow: z.enum(['WF-21', 'WF-13', 'WF-18', 'WF-18b']),
    platform: z.enum(m05Platforms),
    mode,
    env: z.literal('dev'),
    execution_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  }),
  'm05.claim': z.strictObject({
    run_id: id,
    platform: z.enum(m05Platforms),
    mode,
    limit: count.min(1).max(20),
    account_ids: ids,
  }),
  'm05.resolve': z.strictObject({
    account_id: id,
    external_id: external.nullable(),
    uploads_playlist_id: external.nullable(),
  }),
  'm05.ingest': z.strictObject({ run_id: id, account_id: id, items: z.array(item).max(500) }),
  'm05.report': z.strictObject({
    run_id: id,
    account_id: id,
    status: z.enum(['success', 'failed', 'skipped']),
    items_seen: count,
    items_new: count,
    error: z.string().max(500).nullable(),
    backfill_done: z.boolean(),
    backfill_cursor: z.json().nullable(),
  }),
  'm05.finish': z.strictObject({
    run_id: id,
    status: z.enum(['success', 'partial', 'failed']),
    error: z.string().max(500).nullable(),
  }),
  'm05.diff': z.strictObject({ run_id: id, account_id: id, urls: z.array(z.url()).max(1000) }),
  'm05.quota': z.strictObject({ quota_day: z.iso.date(), quantity: z.union([z.literal(0), z.literal(1)]) }),
  'm05.cost': z.strictObject({
    entries: z
      .array(
        z.strictObject({
          provider: z.enum(['youtube', 'firecrawl']),
          category: z.literal('scrape'),
          quantity: count,
          unit: z.enum(['quota_unit', 'credit']),
          cost_usd: z.number().nonnegative(),
          run_id: id,
          competitor_id: id,
          platform: z.enum(m05Platforms),
          meta: z.strictObject({ actor: z.string().max(100), account_id: id, cost_key: z.string().max(256) }),
        }),
      )
      .max(100),
  }),
  'm05.launch': launch,
  'm05.register': z.strictObject({
    run_id: id,
    launch_id: id,
    apify_run_id: external,
    actor_id: z.enum(m05Actors),
    pass: z.literal('primary'),
    account_ids: ids,
    purpose: mode,
  }),
  'm05.close_registration': z.strictObject({ run_id: id }),
  // These shapes are also used by the server-side callback. Native callers cannot
  // submit arbitrary SQL, employee profiles or provider costs via callback.process.
  'm05.snapshot': z.strictObject({
    run_id: id,
    account_id: id,
    snapshot_date: z.iso.date(),
    people: z.array(person).max(200),
    coverage,
  }),
};
