import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { summarizeCoverage, type CoverageSummary } from '@/lib/sources/coverage-summary';
import { createClient } from '@/lib/supabase/server';
import { DataReadError } from './errors';

const BATCH = 1000;

const companySchema = z.object({
  id: z.guid(),
  company_code: z.string(),
  slug: z.string(),
  priority_tier: z.enum(['baseline', 'pilot', 'next_wave', 'adjacent']),
  status: z.string(),
  markets: z.array(z.enum(['EG', 'KSA', 'UAE', 'OTHER'])),
  logo_path: z.string().nullable(),
});

const accountSchema = z.object({
  id: z.guid(),
  competitor_id: z.guid(),
  platform: z.enum([
    'vimeo',
    'instagram',
    'instagram_stories',
    'website',
    'website_work_page',
    'linkedin',
    'linkedin_employees',
    'youtube',
    'news',
  ]),
  status: z.enum(['active', 'paused', 'failing', 'invalid', 'disabled']),
  resolve_status: z.string(),
  last_success_at: z.string().nullable(),
  last_error: z.string().nullable(),
});

/**
 * Reads the minimal columns of every company and source visible to the user (keyset batches
 * by id, so the Data API row cap never truncates totals) and derives coverage from them.
 */
export const getCoverageSummary = cache(async (): Promise<CoverageSummary> => {
  const supabase = await createClient();

  const companiesRequest = (async () => {
    const rows: z.infer<typeof companySchema>[] = [];
    let after: string | null = null;
    for (;;) {
      let query = supabase
        .from('competitors')
        .select('id,company_code,slug,priority_tier,status,markets,logo_path')
        .order('id')
        .limit(BATCH);
      if (after) query = query.gt('id', after);
      const { data, error } = await query;
      if (error) throw new DataReadError('coverage.companies', error);
      const parsed = z.array(companySchema).safeParse(data);
      if (!parsed.success) throw new DataReadError('coverage.companies', { code: 'shape_mismatch' });
      rows.push(...parsed.data);
      if (parsed.data.length < BATCH) return rows;
      after = parsed.data.at(-1)!.id;
    }
  })();

  const accountsRequest = (async () => {
    const rows: z.infer<typeof accountSchema>[] = [];
    let after: string | null = null;
    for (;;) {
      let query = supabase
        .from('competitor_accounts')
        .select('id,competitor_id,platform,status,resolve_status,last_success_at,last_error')
        .order('id')
        .limit(BATCH);
      if (after) query = query.gt('id', after);
      const { data, error } = await query;
      if (error) throw new DataReadError('coverage.accounts', error);
      const parsed = z.array(accountSchema).safeParse(data);
      if (!parsed.success) throw new DataReadError('coverage.accounts', { code: 'shape_mismatch' });
      rows.push(...parsed.data);
      if (parsed.data.length < BATCH) return rows;
      after = parsed.data.at(-1)!.id;
    }
  })();

  const [companies, accounts] = await Promise.all([companiesRequest, accountsRequest]);
  return summarizeCoverage(companies, accounts);
});
