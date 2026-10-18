import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DataReadError } from './errors';

export type TaxonomyTerm = { code: string; label: string; labelAr: string | null; active: boolean };
export type TaxonomyLabels = {
  categories: TaxonomyTerm[];
  capabilities: TaxonomyTerm[];
};

const termSchema = z.object({
  taxonomy: z.string(),
  code: z.string(),
  label_en: z.string(),
  label_ar: z.string().nullable(),
  active: z.boolean(),
});

/** Category and in-house capability labels, in the curated sort order. */
export const getTaxonomyLabels = cache(async (): Promise<TaxonomyLabels> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('taxonomy_terms')
    .select('taxonomy,code,label_en,label_ar,active')
    .in('taxonomy', ['competitor_category', 'in_house_capability'])
    .order('sort', { ascending: true });
  if (error) throw new DataReadError('taxonomy', error);
  const parsed = z.array(termSchema).safeParse(data);
  if (!parsed.success) throw new DataReadError('taxonomy', { code: 'shape_mismatch' });
  const toTerm = (row: z.infer<typeof termSchema>): TaxonomyTerm => ({
    code: row.code,
    label: row.label_en,
    labelAr: row.label_ar,
    active: row.active,
  });
  return {
    categories: parsed.data.filter((row) => row.taxonomy === 'competitor_category').map(toTerm),
    capabilities: parsed.data.filter((row) => row.taxonomy === 'in_house_capability').map(toTerm),
  };
});

/** Label for a code, or the code itself when the term is unknown (never hidden). */
export function labelFor(terms: TaxonomyTerm[], code: string): string {
  return terms.find((term) => term.code === code)?.label ?? code;
}
