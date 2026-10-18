import { z } from 'zod';

export const collectorStubSpecs = [
  { key: 'WF-10', title: 'Vimeo collector', layer: 'collector', platform: 'vimeo' },
  { key: 'WF-11', title: 'Instagram posts/reels collector', layer: 'collector', platform: 'instagram' },
  { key: 'WF-12', title: 'Instagram stories collector', layer: 'collector', platform: 'instagram_stories' },
  { key: 'WF-13', title: 'YouTube collector', layer: 'collector', platform: 'youtube' },
  { key: 'WF-18', title: 'LinkedIn posts collector', layer: 'collector', platform: 'linkedin' },
  { key: 'WF-18b', title: 'LinkedIn employees', layer: 'collector', platform: 'linkedin_employees' },
  { key: 'WF-21', title: 'Websites collector', layer: 'collector', platform: 'website_work_page' },
  { key: 'WF-22', title: 'News', layer: 'collector', platform: 'news' },
  { key: 'WF-23', title: 'Awards and trade', layer: 'collector', platform: 'news' },
  { key: 'WF-30', title: 'AI extractor', layer: 'ai' },
  { key: 'WF-32', title: 'Campaign linker', layer: 'ai' },
  { key: 'WF-40', title: 'Removal check', layer: 'collector' },
  { key: 'WF-50', title: 'Weekly briefs', layer: 'ai' },
  { key: 'WF-70', title: 'Publish / revalidate', layer: 'ops' },
  { key: 'WF-80', title: 'Alerts', layer: 'ops' },
] as const;

export const foundationWorkflowNames = {
  ...Object.fromEntries(collectorStubSpecs.map((s) => [s.key, `${s.key} · ${s.title} [dev]`])),
  'WF-00': 'WF-00 · Orchestrator [dev]',
  'WF-19': 'WF-19 · Apify run callback [dev]',
  'WF-90': 'WF-90 · Error handler [dev]',
  'WF-91': 'WF-91 · Health & cost [dev]',
  'WF-99': 'WF-99 · Foundation smoke test [dev]',
  'SUB-START': 'SUB · Start run [dev]',
  'SUB-FINISH': 'SUB · Finish run [dev]',
  'SUB-INGEST': 'SUB · Ingest items [dev]',
  'SUB-COST': 'SUB · Log cost [dev]',
  'SUB-NOTIFY': 'SUB · Notify [dev]',
} as Readonly<Record<string, string>>;

export const foundationTagNames = [
  'env:dev',
  'layer:collector',
  'layer:ai',
  'layer:ops',
  'layer:sub',
  'platform:vimeo',
  'platform:instagram',
  'platform:instagram_stories',
  'platform:youtube',
  'platform:linkedin',
  'platform:linkedin_employees',
  'platform:website_work_page',
  'platform:news',
] as const;

export const alertKinds = [
  'daily_digest',
  'weekly_brief',
  'instant_launch',
  'budget',
  'failing_sources',
] as const;
const stubBaseInput = z.strictObject({
  mode: z
    .enum(['daily', 'backfill', 'weekly', 'manual', 'removal_check'])
    .nullish()
    .transform((v) => v ?? 'manual'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .nullish()
    .transform((v) => v ?? null),
  result_type: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .nullish()
    .transform((v) => v ?? null),
  env: z
    .literal('dev')
    .nullish()
    .transform(() => 'dev' as const),
});
export const healthInputSchema = stubBaseInput.extend({
  mode: z
    .enum(['daily', 'manual'])
    .nullish()
    .transform((value) => value ?? 'manual'),
});
export function parseHealthInput(input: unknown) {
  const result = healthInputSchema.safeParse(input);
  if (!result.success) throw new Error('EMR_N8N_INPUT_INVALID');
  return result.data;
}
export const collectorStubInputSchemas = {
  base: stubBaseInput,
  'WF-70': stubBaseInput.extend({
    tags: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
      .max(20)
      .nullish()
      .transform((v) => v ?? []),
  }),
  'WF-80': stubBaseInput.extend({
    kind: z
      .enum(alertKinds)
      .nullish()
      .transform((v) => v ?? null),
  }),
};
export function parseCollectorStubInput(key: string, input: unknown) {
  if (!collectorStubSpecs.some((s) => s.key === key)) throw new Error('EMR_N8N_INPUT_INVALID');
  const schema =
    key === 'WF-70'
      ? collectorStubInputSchemas['WF-70']
      : key === 'WF-80'
        ? collectorStubInputSchemas['WF-80']
        : collectorStubInputSchemas.base;
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('EMR_N8N_INPUT_INVALID');
  return result.data;
}

const reference = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  name: z.string().min(1).max(200),
});
const postgresReference = reference.extend({
  name: z.literal('Supabase Postgres · n8n_writer · dev'),
  type: z.literal('postgres'),
  environment: z.literal('dev'),
  projectRef: z.literal('zmotjsbzhzjvpelxvxlf'),
});

export const n8nBindingsSchema = z
  .strictObject({
    runtimeVersion: z.literal('2.43.5'),
    environment: z.literal('dev'),
    instanceUrl: z.literal('https://muhhammedsayed.app.n8n.cloud'),
    projectId: z.literal('pHvQjDmjxVZ3KQLT'),
    workflowRefs: z.record(z.string(), reference),
    tagRefs: z.partialRecord(z.enum(foundationTagNames), reference),
    credentials: z.strictObject({ postgres: postgresReference.optional() }).optional(),
  })
  .superRefine((value, ctx) => {
    const workflowIds = new Set<string>();
    const tagIds = new Set<string>();
    for (const [key, ref] of Object.entries(value.workflowRefs)) {
      if (foundationWorkflowNames[key] !== ref.name || workflowIds.has(ref.id))
        ctx.addIssue({ code: 'custom', message: 'invalid reference' });
      workflowIds.add(ref.id);
    }
    for (const [name, ref] of Object.entries(value.tagRefs)) {
      if (ref && (ref.name !== name || tagIds.has(ref.id)))
        ctx.addIssue({ code: 'custom', message: 'invalid reference' });
      if (ref) tagIds.add(ref.id);
    }
  });

export type N8nBindings = z.infer<typeof n8nBindingsSchema>;

// Manifest IDs/names must come from actual UI/API readback. Schema validation
// checks their shape and target; it does not establish their hosted existence.
export function parseN8nBindings(input: unknown): N8nBindings {
  const result = n8nBindingsSchema.safeParse(input);
  if (!result.success) throw new Error('EMR_N8N_BINDINGS_INVALID');
  return result.data;
}
