import type { DirectoryFixture } from './competitor-directory.fixtures';

export type DirectoryFilters = Readonly<{
  query?: string;
  market?: DirectoryFixture['markets'][number];
  tier?: DirectoryFixture['priority_tier'];
  category?: string;
}>;

const byName = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function selectCompetitors(records: readonly DirectoryFixture[], filters: DirectoryFilters) {
  const query = filters.query?.trim().normalize('NFKC').toLocaleLowerCase('en') ?? '';
  return records
    .filter(
      (record) =>
        (!query ||
          `${record.name} ${record.name_ar ?? ''}`
            .normalize('NFKC')
            .toLocaleLowerCase('en')
            .includes(query)) &&
        (!filters.market || record.markets.includes(filters.market)) &&
        (!filters.tier || record.priority_tier === filters.tier) &&
        (!filters.category || record.categories.includes(filters.category)),
    )
    .sort(
      (a, b) =>
        Number(b.is_baseline) - Number(a.is_baseline) ||
        byName.compare(a.name, b.name) ||
        a.company_code.localeCompare(b.company_code),
    );
}
