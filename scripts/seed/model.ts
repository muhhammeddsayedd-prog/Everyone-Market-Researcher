import { z } from 'zod';
import type { Database } from '@emr/shared';

export const primaryPlatforms = [
  'website',
  'website_work_page',
  'instagram',
  'vimeo',
  'youtube',
  'linkedin',
] as const;
export type PrimaryPlatform = (typeof primaryPlatforms)[number];
export type Platform = PrimaryPlatform | 'instagram_stories' | 'linkedin_employees';
export type CompetitorSeed = Pick<
  Database['app']['Tables']['competitors']['Insert'],
  | 'company_code'
  | 'slug'
  | 'name'
  | 'markets'
  | 'hq_country'
  | 'categories'
  | 'in_house'
  | 'logo_url'
  | 'website_url'
  | 'priority_tier'
  | 'pilot_rank'
  | 'is_baseline'
  | 'status'
  | 'notes'
  | 'source_sheet_row'
>;
export type AccountSeed = {
  sourceKey: string;
  company_code: string;
  platform: Platform;
  handle: string;
  url: string;
  cadence: '1 day' | '7 days';
  status: 'active' | 'paused' | 'invalid';
  resolve_status: 'pending' | 'not_needed' | 'failed';
  backfill_from: '2024-01-01';
  backfill_status: 'pending' | 'not_applicable';
  /** Explicit owner override; permits a guarded identity correction before any collection. */
  ownerReplaced: boolean;
};

export type SeedIssue = {
  code: string;
  company_code: string;
  platform?: Platform;
  url?: string;
  detail: string;
};
export type SeedPlan = {
  competitors: CompetitorSeed[];
  accounts: AccountSeed[];
  issues: SeedIssue[];
  counts: {
    inputCompetitors: number;
    inputAccounts: number;
    plannedCompetitors: number;
    plannedAccounts: number;
    tiers: Record<string, number>;
    platforms: Record<string, number>;
    statuses: Record<string, number>;
  };
};

export const competitorCsvSchema = z.object({
  company_id: z.string().regex(/^C\d{3}$/),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  markets: z.string().min(1),
  hq_country_guess: z.string(),
  is_baseline: z.enum(['true', 'false']),
  pilot_rank: z.string(),
  priority_tier: z.string(),
  categories: z.string(),
  in_house_capabilities: z.string(),
  logo_url: z.string(),
  website: z.string(),
  notes: z.string(),
  sheet_row: z.string(),
});
export const accountCsvSchema = z.object({
  company_id: z.string().regex(/^C\d{3}$/),
  competitor_slug: z.string().min(1),
  platform: z.enum(primaryPlatforms),
  url: z.string().min(1),
  handle: z.string().min(1),
  tracked: z.enum(['true', 'false']),
  pilot: z.enum(['true', 'false']),
});
export const overrideCsvSchema = z.object({
  company_id: z.string().regex(/^C\d{3}$/),
  platform: z.enum(primaryPlatforms),
  url: z.string(),
  action: z.enum(['replace', 'invalid', 'add']),
});
export const taxonomySchema = z.object({
  competitor_category: z.array(z.object({ code: z.string(), label_en: z.string() })),
  in_house_capability: z.array(z.object({ code: z.string(), label_en: z.string() })),
});
export type SeedInput = {
  competitors: z.infer<typeof competitorCsvSchema>[];
  accounts: z.infer<typeof accountCsvSchema>[];
  overrides: z.infer<typeof overrideCsvSchema>[];
  taxonomies: z.infer<typeof taxonomySchema>;
};

const valueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]);
export const seedManifestSchema = z.object({
  version: z.literal(1),
  target: z
    .string()
    .min(1)
    .refine((s) => !s.includes('://') && !s.includes('@'), 'Target must be a non-secret identity, not a URL'),
  competitors: z.record(
    z.string(),
    z.object({
      id: z.string().uuid(),
      values: z.record(z.string(), valueSchema),
      protectedFields: z.array(z.string()).default([]),
    }),
  ),
  accounts: z.record(
    z.string(),
    z.object({
      id: z.string().uuid(),
      values: z.record(z.string(), valueSchema),
      protectedFields: z.array(z.string()).default([]),
    }),
  ),
});
export type SeedManifest = z.infer<typeof seedManifestSchema>;
export type SeedStats = {
  competitorsInserted: number;
  competitorsUpdated: number;
  accountsInserted: number;
  accountsUpdated: number;
};

export function emptySeedManifest(target: string): SeedManifest {
  return seedManifestSchema.parse({ version: 1, target, competitors: {}, accounts: {} });
}
