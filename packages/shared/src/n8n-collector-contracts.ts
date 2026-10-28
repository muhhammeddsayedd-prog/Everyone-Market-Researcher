import { z } from 'zod';
import { m05Args, m05Actors } from './n8n-m05-contracts';

const id = z.uuid(),
  count = z.number().int().nonnegative();
const external = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const collectorActors = [
  'apify/instagram-scraper',
  'goat255/vimeo-scraper',
  'dltik/vimeo-scraper',
  ...m05Actors,
] as const;
const actor = z.enum(collectorActors),
  mode = z.enum(['daily', 'backfill']);
const accounts = z
  .array(id)
  .min(1)
  .max(100)
  .refine((a) => new Set(a).size === a.length);
export const collectorAccountIds = accounts;
// Fixed dev workflow identities, not caller-provided workflow names or run IDs.
export const collectorWorkflowIds = {
  'WF-00': 'MzimjpsuyPuK7SKe',
  'WF-10': '4JMHLDBSdgGxhPlk',
  'WF-11': 'Oq19AMI9C3B1wbo9',
  'WF-19': 'TsqSMa5MlO3QBLkt',
} as const;
export const collectorExecutionErrorArgs = z
  .strictObject({
    workflow_id: z.enum(Object.values(collectorWorkflowIds)),
    execution_id: z.string().regex(/^(?:[0-9]{1,15}|handler-[0-9]{1,15})$/),
    error_code: z.enum(['workflow_failed', 'callback_retryable']),
  })
  .refine(
    (v) =>
      v.error_code !== 'callback_retryable' ||
      (v.workflow_id === collectorWorkflowIds['WF-19'] && !v.execution_id.startsWith('handler-')),
  );
const json = z.json();
const item = z.strictObject({
  platform: z.enum(['vimeo', 'instagram']),
  external_id: external,
  actor: z.enum(['vimeo-api', ...collectorActors]),
  item_type: z.enum(['video', 'post', 'reel', 'carousel']),
  url: z.url(),
  published_at: z.iso.datetime({ offset: true }),
  title: z.string().nullable(),
  caption: z.string().max(8000),
  credits_text: z.string().max(8000).optional(),
  hashtags: z.array(z.string()),
  mentions: z.array(z.string()),
  tagged_accounts: z.array(z.string()),
  duration_seconds: z.number().nonnegative().nullable(),
  thumbnail_url: z.url().nullable(),
  metrics: z.record(z.string(), z.number().nonnegative().nullable()),
  media_urls: z.array(z.url()).max(0),
  payload: json,
});
const launch = z
  .strictObject({
    run_id: id,
    launch_id: id,
    actor_id: actor,
    pass: z.enum(['primary', 'posts', 'reels']),
    account_ids: accounts,
    purpose: mode,
    results_limit: count.min(1).max(3000),
  })
  .refine((v) =>
    v.actor_id === 'apify/instagram-scraper'
      ? v.account_ids.length <= (v.purpose === 'daily' ? 50 : 10) &&
        v.results_limit <= (v.purpose === 'daily' ? 30 : 3000)
      : v.account_ids.length === 1 &&
        v.pass === 'primary' &&
        (v.actor_id === 'goat255/vimeo-scraper'
          ? v.purpose === 'daily' && v.results_limit <= 60
          : v.results_limit <= (v.purpose === 'daily' ? 50 : 1000)),
  );
export const collectorArgs = {
  ...m05Args,
  start: z
    .strictObject({
      workflow: z.enum(['WF-10', 'WF-11']),
      platform: z.enum(['vimeo', 'instagram']),
      mode,
      env: z.literal('dev'),
      execution_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    })
    .refine((v) => (v.workflow === 'WF-10') === (v.platform === 'vimeo')),
  claim: z.strictObject({
    run_id: id,
    platform: z.enum(['vimeo', 'instagram']),
    mode,
    limit: count.min(1).max(100),
    account_ids: accounts,
  }),
  resolve: z.strictObject({
    account_id: id,
    external_id: external.nullable(),
    uploads_playlist_id: external.nullable(),
  }),
  ingest: z.strictObject({ run_id: id, account_id: id, items: z.array(item).max(500) }),
  report: z.strictObject({
    run_id: id,
    account_id: id,
    status: z.enum(['success', 'failed', 'skipped']),
    items_seen: count,
    items_new: count,
    error: z.string().max(500).nullable(),
    backfill_done: z.boolean(),
    backfill_cursor: json.nullable(),
  }),
  cost: z.strictObject({
    entries: z
      .array(
        z.strictObject({
          provider: z.literal('vimeo'),
          category: z.literal('scrape'),
          quantity: count,
          unit: z.literal('call'),
          cost_usd: z.literal(0),
          run_id: id,
          competitor_id: id,
          platform: z.literal('vimeo'),
          meta: z.strictObject({
            actor: z.literal('vimeo-api'),
            account_id: id,
            cost_key: z.string().max(256),
          }),
        }),
      )
      .max(100),
  }),
  finish: z.strictObject({
    run_id: id,
    status: z.enum(['success', 'partial', 'failed']),
    error: z.string().max(500).nullable(),
  }),
  launch,
  register: z.strictObject({
    run_id: id,
    launch_id: id,
    apify_run_id: external,
    actor_id: actor,
    pass: z.enum(['primary', 'posts', 'reels']),
    account_ids: accounts,
    purpose: mode,
  }),
  close_registration: z.strictObject({ run_id: id }),
  'request.status': z.strictObject({ request_id: id }),
  'callback.classify': z.strictObject({ apify_run_id: external }),
  'callback.process': z.strictObject({ apify_run_id: external }),
  'execution.error': collectorExecutionErrorArgs,
};
export type CollectorOperation = keyof typeof collectorArgs;
export type CollectorRequest = {
  version: 1;
  requestId: string;
  operation: CollectorOperation;
  args: Record<string, unknown>;
};
export function collectorRequest(value: unknown): CollectorRequest {
  const header = z
    .strictObject({
      version: z.literal(1),
      requestId: id,
      operation: z.enum(Object.keys(collectorArgs) as [CollectorOperation, ...CollectorOperation[]]),
      args: z.unknown(),
    })
    .parse(value);
  return { ...header, args: collectorArgs[header.operation].parse(header.args) };
}
export const collectorBuild = z.strictObject({
  billingModel: z.enum(['PPE', 'PPU']).optional(),
  owner_id: external,
  actorId: external,
  build: z.string().regex(/^\d+\.\d+\.\d+$/),
  buildId: external,
  inputDefaults: z.record(z.string(), z.json()).optional(),
});
export const collectorPolicy = z
  .strictObject({
    approval_id: id,
    website_urls_per_account: count.min(1).max(2000).optional(),
    max_actor_starts: count.min(1).max(40),
    max_actor_usd: z.number().positive().max(10),
    max_total_usd: z.number().positive().max(100),
    max_results_per_profile: count.min(1).max(3000),
    actors: z.partialRecord(actor, collectorBuild),
  })
  .refine((p) => p.max_actor_usd <= p.max_total_usd);
export type CollectorPolicy = z.infer<typeof collectorPolicy>;
