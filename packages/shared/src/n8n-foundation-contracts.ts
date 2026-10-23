import { z } from 'zod';
import { foundationWorkflowNames } from './n8n-bindings';
import { gatewayIdentity, gatewayBusinessResult } from './n8n-worker-contracts';

// Source contract only: this UUID creates no hosted window or launch authority.
export const foundationWindowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
// Source-known compatibility only; SQL owner registration and cumulative caps
// remain required. Adding an ID here never opens or reopens a database window.
export const foundationWindowIds = [foundationWindowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc'] as const;
const knownWindow = z.enum(foundationWindowIds);
const id = z.uuid(),
  empty = z.strictObject({});
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const money = z.number().nonnegative().max(999999.999999);
const timestamp = z.iso.datetime({ offset: true });
const workflow = z.string().refine((v) => Object.hasOwn(foundationWorkflowNames, v));
const platform = z.enum([
  'vimeo',
  'instagram',
  'instagram_stories',
  'website',
  'website_work_page',
  'linkedin',
  'linkedin_employees',
  'youtube',
  'news',
]);
const message = z.enum([
  'workflow_failed',
  'callback_retryable',
  'apify_failed',
  'notify_threshold_reached',
  'unexpected_error',
]);
const actor = z.literal('aYG0l9s7dbB7j3gbS');
// Public metadata GET, 18 Oct 23:24 UTC: immutable successful build 0.3.99.
const build = z.literal('0.3.99');
const status = z.enum(['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']);
export const foundationSmokeInput = {
  startUrls: [{ url: 'https://everyone.film/about-everyone' }],
  crawlerType: 'cheerio',
  maxCrawlDepth: 0,
  maxCrawlPages: 1,
  saveMarkdown: true,
  proxyConfiguration: { useApifyProxy: true },
  saveFiles: false,
  saveContentTypes: '',
  summarize: false,
  useSitemaps: false,
  useLlmsTxt: false,
  maxRequestRetries: 0,
  maxSessionRotations: 0,
  maxResults: 1,
  maxConcurrency: 1,
  ignoreHttpsErrors: false,
  respectRobotsTxtFile: true,
} as const;
const smokeInput = z.strictObject({
  startUrls: z.array(z.strictObject({ url: z.literal('https://everyone.film/about-everyone') })).length(1),
  crawlerType: z.literal('cheerio'),
  maxCrawlDepth: z.literal(0),
  maxCrawlPages: z.literal(1),
  saveMarkdown: z.literal(true),
  proxyConfiguration: z.strictObject({ useApifyProxy: z.literal(true) }),
  saveFiles: z.literal(false),
  saveContentTypes: z.literal(''),
  summarize: z.literal(false),
  useSitemaps: z.literal(false),
  useLlmsTxt: z.literal(false),
  maxRequestRetries: z.literal(0),
  maxSessionRotations: z.literal(0),
  maxResults: z.literal(1),
  maxConcurrency: z.literal(1),
  ignoreHttpsErrors: z.literal(false),
  respectRobotsTxtFile: z.literal(true),
});
const launch = z.strictObject({
  window_id: knownWindow,
  launch_id: id,
  run_id: id,
  account_id: id,
  execution_id: identifier,
  actor_id: actor,
  actor_build: build,
  input: smokeInput,
  memory_mb: z.literal(1024),
  timeout_seconds: z.literal(300),
  max_total_charge_usd: z.number().positive().max(1),
});
const row = z.strictObject({
  url: z.literal('https://everyone.film/about-everyone'),
  markdown: z.string().max(8000),
  metadata: z.strictObject({ title: z.string().max(2000).nullable() }),
});
const rawItem = z.strictObject({
  platform: z.literal('website_work_page'),
  external_id: z.string().regex(/^[a-f0-9]{32}$/),
  actor: z.literal('apify/website-content-crawler'),
  item_type: z.literal('project_page'),
  url: z.literal('https://everyone.film/about-everyone'),
  published_at: z.null(),
  title: z.string().max(2000).nullable(),
  caption: z.string().max(8000),
  metrics: empty,
  payload: row,
});
const group = z.strictObject({
  account_id: id,
  items: z.array(rawItem).max(1),
  normalizer_version: z.literal('smoke_website_stub.v1'),
});
const entry = z
  .strictObject({
    provider: z.literal('apify'),
    category: z.literal('scrape'),
    quantity: z.number().int().min(0).max(1),
    unit: z.literal('result'),
    // Equal replay of measured cost must remain possible even if a provider's
    // later accounting exceeds the requested cap; that event stops new starts.
    cost_usd: money,
    run_id: id,
    competitor_id: id,
    platform: z.literal('website_work_page'),
    item_id: z.null().optional(),
    day: z.null().optional(),
    meta: z.strictObject({
      actor: z.literal('apify/website-content-crawler'),
      apify_run_id: identifier,
      account_id: id,
      cost_key: z.string().regex(/^[A-Za-z0-9_.:/-]{1,256}$/),
    }),
  })
  .refine((v) => v.meta.cost_key === 'apify:' + v.meta.apify_run_id + ':' + v.meta.account_id);
const rejection = z.enum([
  'unregistered',
  'actor_mismatch',
  'registry_mismatch',
  'unsettled',
  'unsupported_input',
  'registration_race',
  'metadata_unavailable',
]);
const args = {
  'identity.read': empty,
  'request.status': z.strictObject({ targetRequestId: id }),
  'run.start': z.strictObject({
    workflow,
    platform: platform.nullable(),
    mode: z.enum(['daily', 'backfill', 'weekly', 'manual', 'removal_check']),
    env: z.literal('dev'),
    executionId: identifier,
  }),
  'run.finish': z.strictObject({
    runId: id,
    status: z.enum(['success', 'partial', 'failed']),
    error: message.nullable(),
    apifyRunId: identifier.nullable(),
  }),
  'apify.read': z.strictObject({ apifyRunId: identifier }),
  'apify.completion.read': z.strictObject({ apifyRunId: identifier, runId: id }),
  'apify.terminal.read': z.strictObject({ apifyRunId: identifier }),
  'apify.dataset.read': z.strictObject({ apifyRunId: identifier }),
  'apify.process': z.strictObject({
    apifyRunId: identifier,
    status,
    datasetId: identifier.nullable(),
    usageUsd: money,
    groups: z.array(group).length(1),
  }),
  'cost.log': z.strictObject({ entries: z.array(entry).max(2) }),
  'settings.read': z.strictObject({
    key: z.enum(['daily_budget_usd', 'stories_twice_daily', 'stats_daily_enabled']),
  }),
  'prices.read': empty,
  'error.log': z.strictObject({
    entry: z.strictObject({
      kind: z.enum(['error', 'notify']),
      workflow,
      execution_id: identifier,
      node: z.enum(['Workflow', 'Trigger activation', 'Notify', 'Unknown schedule slot']),
      message,
    }),
  }),
  'error.count': z.strictObject({ workflow, claimNotify: z.boolean() }),
  'health.guard': empty,
  'health.read': empty,
  'fees.accrue': z.strictObject({ day: z.iso.date() }),
  'callback.reject': z.strictObject({ executionId: identifier, apifyRunId: identifier, reason: rejection }),
  'launch.authorize': z.strictObject({ launch }),
  'launch.read': z.strictObject({ launchId: id }),
  'launch.reconcile': z.strictObject({ launchId: id, apifyRunId: identifier }),
} as const;
export type FoundationOperation = keyof typeof args;
export const foundationOperations = Object.keys(args) as FoundationOperation[];
export interface FoundationRequest {
  version: 1;
  requestId: string;
  operation: FoundationOperation;
  args: Record<string, unknown>;
}
const envelope = z.strictObject({
  version: z.literal(1),
  requestId: id,
  operation: z.enum(foundationOperations as [FoundationOperation, ...FoundationOperation[]]),
  args: z.unknown(),
});
export function foundationRequest(value: unknown): FoundationRequest {
  const p = envelope.safeParse(value);
  if (!p.success) throw Error('invalid_request');
  const a = args[p.data.operation].safeParse(p.data.args);
  if (!a.success) throw Error('invalid_request');
  const parsed = { ...p.data, args: a.data as Record<string, unknown> };
  if (
    parsed.operation === 'request.status' &&
    String(parsed.args.targetRequestId).toLowerCase() === parsed.requestId.toLowerCase()
  )
    throw Error('invalid_request');
  return parsed;
}
const summary = z.strictObject({
  run_id: id,
  status: z.enum(['success', 'partial', 'failed']),
  accounts_total: count,
  accounts_ok: count,
  accounts_failed: count,
  items_seen: count,
  items_new: count,
  cost_usd: money,
});
const completion = z.strictObject({
  updated: z.boolean(),
  finished_now: z.boolean(),
  apify_run_id: identifier,
  run_id: id,
  account_ids: z.array(id).length(1),
  status,
  dataset_id: identifier.nullable(),
  cost_usd: money,
  groups_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  normalizer_version: z.literal('smoke_website_stub.v1'),
  cost_keys: z.array(z.string().regex(/^apify:[A-Za-z0-9_-]{1,128}:[a-f0-9-]{36}$/)).length(1),
  items_seen: z.number().int().min(0).max(1),
  items_new: z.number().int().min(0).max(1),
  new_item_ids: z.array(id).max(1),
  accounts_ok: z.number().int().min(0).max(1),
  accounts_failed: z.number().int().min(0).max(1),
  run_summary: summary,
});
const registry = z.strictObject({
  apify_run_id: identifier,
  actor_id: z.enum(['apify/website-content-crawler', 'aYG0l9s7dbB7j3gbS']),
  run_id: id,
  account_ids: z.array(id).length(1),
  purpose: z.literal('daily'),
  status: z.enum(['RUNNING', 'READY', ...status.options]),
  dataset_id: identifier.nullable(),
  usage_usd: money.nullable(),
  started_at: timestamp,
  finished_at: timestamp.nullable(),
  processed_at: timestamp.nullable(),
  processing_result: completion.nullable(),
});
const launchReceipt = launch.omit({}).extend({
  ordinal: z.number().int().min(1).max(2),
  post_intent_at: timestamp,
  apify_run_id: identifier.nullable(),
  reconciled_at: timestamp.nullable(),
});
export const foundationTerminal = z
  .strictObject({
    apifyRunId: identifier,
    parentRunId: id,
    accountId: id,
    actorId: actor,
    wireStatus: z.enum(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']),
    status,
    datasetId: identifier.nullable(),
    usageTotalUsd: money,
    finishedAt: timestamp,
  })
  .refine((v) => v.status === (v.wireStatus === 'TIMED-OUT' ? 'TIMED_OUT' : v.wireStatus));
const readTransport = z.strictObject({
  runBytesMax: z.literal(65536),
  requests: z.literal(1),
  retries: z.literal(0),
  socketsClosed: z.literal(true),
});
const datasetTransport = z.strictObject({
  runBytesMax: z.literal(65536),
  datasetBytesMax: z.literal(262144),
  requests: z.literal(2),
  retries: z.literal(0),
  socketsClosed: z.literal(true),
});
// Reuse the existing closed health/price validator rather than accepting free JSON.
function trialResult(operation: 'health.read' | 'prices.read' | 'settings.read') {
  return z.unknown().refine((result) => gatewayBusinessResult(result, operation));
}
const resultSchemas: Record<Exclude<FoundationOperation, 'request.status'>, z.ZodType> = {
  'identity.read': gatewayIdentity,
  'run.start': z.strictObject({ run_id: id }),
  'run.finish': z.strictObject({ r: summary, durable: completion.nullable() }),
  'apify.read': z.strictObject({ registered: registry.nullable() }),
  'apify.completion.read': z.strictObject({ registered: registry.nullable(), pending: count }),
  'apify.terminal.read': z.strictObject({ terminal: foundationTerminal, transport: readTransport }),
  'apify.dataset.read': z.strictObject({
    terminal: foundationTerminal,
    rows: z.array(row).length(1),
    transport: datasetTransport,
  }),
  'apify.process': z.strictObject({ r: completion }),
  'cost.log': z.strictObject({ inserted: count }),
  'settings.read': trialResult('settings.read'),
  'prices.read': trialResult('prices.read'),
  'error.log': z.strictObject({ logged: z.null() }),
  'error.count': z.strictObject({ error_count: count }),
  'health.guard': z.strictObject({ stats_daily_enabled: z.literal(false), cairo_yesterday: z.iso.date() }),
  'health.read': z.strictObject({ h: trialResult('health.read'), cairo_yesterday: z.iso.date() }),
  'fees.accrue': z.strictObject({ accrued: count }),
  'callback.reject': z.strictObject({ recorded: z.boolean(), action: z.literal('apify_callback_rejected') }),
  'launch.authorize': z.strictObject({
    authorized: z.boolean(),
    reason: z.enum(['first_post_only', 'reconciliation_required']),
    launch: launchReceipt,
  }),
  'launch.read': z.strictObject({ launch: launchReceipt.nullable() }),
  'launch.reconcile': z.strictObject({ registered: z.literal(true), launch: launchReceipt }),
};
const windowSchema = z
  .strictObject({
    id: knownWindow,
    startsAt: timestamp.nullable(),
    expiresAt: timestamp.nullable(),
    closed: z.boolean(),
    totalAdmitted: z.number().int().min(0).max(256),
    boundAudience: z.url(),
    boundCommitSha: z.string().regex(/^[a-f0-9]{40}$/),
    boundDeploymentId: z.string().regex(/^dpl_[A-Za-z0-9]{1,80}$/),
  })
  .refine(
    (v) =>
      (v.startsAt === null) === (v.expiresAt === null) &&
      (!v.startsAt ||
        (Date.parse(v.expiresAt!) > Date.parse(v.startsAt) &&
          Date.parse(v.expiresAt!) - Date.parse(v.startsAt) <= 3600000)),
  );
const receiptSchema = z.strictObject({
  state: z.enum([
    'admitted',
    'completed',
    'in_flight',
    'conflict',
    'limited',
    'closed',
    'rejected',
    'reconciliation_required',
    'absent',
  ]),
  code: z
    .enum([
      'operation_not_permitted',
      'window_closed',
      'window_expired',
      'rate_limited',
      'request_limit',
      'concurrency_limit',
      'args_conflict',
      'execution_failed',
      'reconciliation_required',
      'not_found',
    ])
    .nullable(),
  result: z.unknown(),
  window: windowSchema,
  replayed: z.boolean(),
  operation: z.enum(foundationOperations as [FoundationOperation, ...FoundationOperation[]]),
});
export type FoundationReceipt = z.infer<typeof receiptSchema>;
export function foundationReceipt(value: unknown, operation: FoundationOperation): FoundationReceipt {
  const p = receiptSchema.safeParse(value);
  if (!p.success) throw Error('invalid_result');
  const r = p.data;
  if (operation === 'request.status') {
    const admissionDenied =
      r.operation === 'request.status' && ['closed', 'limited', 'rejected'].includes(r.state);
    if ((!r.replayed && !admissionDenied) || (r.state === 'completed' && r.operation === 'request.status'))
      throw Error('invalid_result');
  } else if (r.operation !== operation) throw Error('invalid_result');
  if (r.state === 'completed') {
    const schema = resultSchemas[r.operation as Exclude<FoundationOperation, 'request.status'>];
    if (!schema?.safeParse(r.result).success) throw Error('invalid_result');
  } else if (r.result !== null) throw Error('invalid_result');
  return r;
}
