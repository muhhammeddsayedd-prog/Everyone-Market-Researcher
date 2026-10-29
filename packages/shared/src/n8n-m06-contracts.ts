import { z } from 'zod';

export const m06StoryActors = [
  'data-slayer/instagram-stories-scraper',
  'igview-owner/instagram-story-viewer',
  'louisdeconinck/instagram-story-details-scraper',
] as const;
export type M06StoryActor = (typeof m06StoryActors)[number];
const id = z.uuid();
const external = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const count = z.number().int().nonnegative();
const ids = z
  .array(id)
  .min(1)
  .max(100)
  .refine((a) => new Set(a).size === a.length);
const actor = z.enum(m06StoryActors);
const purpose = z.literal('daily');
const collectionMode = z.enum(['ingest', 'bakeoff']);
export const m06CampaignConflictEvent = z.object({
  id: external,
  type: z.literal('deployment.created'),
  createdAt: z.union([z.number().int().positive(), z.iso.datetime({ offset: true })]),
  payload: z.object({
    project: z.object({ id: z.literal('prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu') }),
    target: z.string().nullable(),
    deployment: z.object({ id: z.string().regex(/^dpl_[A-Za-z0-9]+$/) }),
  }),
});
const item = z.strictObject({
  platform: z.literal('instagram_stories'),
  external_id: external,
  actor,
  item_type: z.literal('story'),
  url: z.url(),
  published_at: z.iso.datetime({ offset: true }),
  title: z.null(),
  caption: z.string().max(8000),
  hashtags: z.array(z.string()),
  mentions: z.array(z.string()),
  tagged_accounts: z.array(z.string()).max(0),
  duration_seconds: count.nullable(),
  thumbnail_url: z.url().nullable(),
  metrics: z.strictObject({}),
  media_urls: z.array(z.url()).max(0),
  payload: z.json(),
});
const comparisonRow = z.strictObject({
  actor,
  account_id: id,
  story_key: z.string().min(1).max(200),
  raw_id: z.string().min(1).max(200),
  taken_at: z.iso.datetime({ offset: true }),
  has_thumbnail: z.boolean(),
  has_mentions: z.boolean(),
  has_link: z.boolean(),
});
export const m06StoryArgs = {
  'm06.campaign_tick': z.strictObject({
    campaign_id: id,
    execution_id: z.string().regex(/^[0-9]{1,15}$/),
  }),
  'm06.start': z.strictObject({
    workflow: z.literal('WF-12'),
    platform: z.literal('instagram_stories'),
    mode: purpose,
    env: z.literal('dev'),
    execution_id: z.string().regex(/^[0-9]{1,15}$/),
    collection_mode: collectionMode,
  }),
  'm06.claim': z.strictObject({
    run_id: id,
    platform: z.literal('instagram_stories'),
    mode: purpose,
    limit: count.min(1).max(100),
    account_ids: ids,
  }),
  'm06.launch': z
    .strictObject({
      run_id: id,
      launch_id: id,
      actor_id: actor,
      pass: z.literal('primary'),
      account_ids: ids,
      purpose,
      results_limit: count.min(1).max(1000),
      actor_input: z.strictObject({
        usernames: z
          .array(z.string().regex(/^[a-z0-9._]{1,30}$/))
          .min(1)
          .max(100)
          .refine((a) => new Set(a).size === a.length),
      }),
      collection_mode: collectionMode,
    })
    .refine(
      (v) =>
        v.actor_input.usernames.length === v.account_ids.length &&
        v.account_ids.length * v.results_limit <= 1000 &&
        (v.actor_id !== 'igview-owner/instagram-story-viewer' || v.account_ids.length <= 50) &&
        (v.collection_mode !== 'ingest' || v.actor_id === 'data-slayer/instagram-stories-scraper'),
    ),
  'm06.register': z.strictObject({
    run_id: id,
    launch_id: id,
    apify_run_id: external,
    actor_id: actor,
    pass: z.literal('primary'),
    account_ids: ids,
    purpose,
  }),
  'm06.close_registration': z.strictObject({ run_id: id }),
};
// Provider-read/settlement operations are server-only. A Machine caller cannot
// submit a fabricated source result, measured usage or comparison observation.
export const m06StoryInternalArgs = {
  'm06.campaign_conflict': z.strictObject({
    campaign_id: id,
    event_id: external,
    deployment_id: external,
    observed_at: z.iso.datetime({ offset: true }),
  }),
  'm06.lookup': z.strictObject({ apify_run_id: external }),
  'm06.classify': z.strictObject({ apify_run_id: external }),
  'm06.settle': z.strictObject({
    apify_run_id: external,
    status: z.enum(['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']),
    dataset_id: external.nullable(),
    usage_usd: z.number().finite().nonnegative().max(999999.999999),
    observed_at: z.iso.datetime({ offset: true }),
    groups: z
      .array(
        z.strictObject({
          account_id: id,
          status: z.enum(['success', 'failed']),
          error: z.string().max(500).nullable(),
          items: z.array(item).max(1000),
          bakeoff_rows: z.array(comparisonRow).max(1000),
          observation: z.enum(['stories', 'no_stories', 'error']),
          source_evidence: z.boolean(),
        }),
      )
      .min(1)
      .max(100),
  }),
};
