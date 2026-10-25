import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSeedInput, planSeed } from '../../../../../scripts/seed/seed-competitors';
import CompetitorPreviewPage from '../../../app/dev/competitors/page';
import { CompetitorDirectory } from './competitor-directory';
import { competitorFixtures, fixtureCompanyCodes } from './competitor-directory.fixtures';
import { selectCompetitors } from './competitor-directory.model';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('LOCAL_PREVIEW_NOT_FOUND');
  },
}));

afterEach(() => vi.unstubAllEnvs());

describe('local competitor directory', () => {
  it('contains exactly the approved catalog subset, normalized by the existing seed planner', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../');
    const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
    const planned = planSeed(
      loadSeedInput({
        competitorsCsv: read('data/competitors.csv'),
        accountsCsv: read('data/competitor_accounts.csv'),
        taxonomiesJson: read('reference/taxonomies.json'),
        overridesCsv: read('scripts/seed/overrides.csv'),
      }),
    );
    expect(competitorFixtures.map((row) => row.company_code)).toEqual(fixtureCompanyCodes);
    expect(competitorFixtures).toHaveLength(12);
    for (const fixture of competitorFixtures) {
      const source = planned.competitors.find((row) => row.company_code === fixture.company_code)!;
      for (const key of Object.keys(fixture) as (keyof typeof fixture)[]) {
        expect(fixture[key]).toEqual(key === 'name_ar' ? null : source[key as keyof typeof source]);
      }
    }
  });

  it('pins the baseline only among matches and orders remaining names with a stable code tie-break', () => {
    const all = selectCompetitors(competitorFixtures, {});
    expect(all[0]!.company_code).toBe('C000');
    expect(all[1]!.name).toBe('Admepro Advertising Agency');
    expect(selectCompetitors(competitorFixtures, { tier: 'pilot' }).some((r) => r.is_baseline)).toBe(false);
    const row = competitorFixtures[1]!;
    expect(
      selectCompetitors(
        [
          { ...row, company_code: 'C999' },
          { ...row, company_code: 'C111' },
        ],
        {},
      ).map((r) => r.company_code),
    ).toEqual(['C111', 'C999']);
  });

  it('shows fixture provenance and applies combined filters with a useful empty/reset state', () => {
    render(<CompetitorDirectory competitors={competitorFixtures} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Competitors' })).toBeVisible();
    expect(screen.getByText(/17 October 2026/)).toBeVisible();
    expect(screen.getByText(/No live data/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('12 of 12 fixture records');
    fireEvent.change(screen.getByRole('combobox', { name: 'Market' }), { target: { value: 'UAE' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tier' }), { target: { value: 'pilot' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name' }), {
      target: { value: 'wonderful' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 of 12 fixture records');
    expect(screen.getByRole('heading', { name: 'Wonderful Productions' })).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'sound_and_music' },
    });
    expect(screen.getByRole('heading', { name: 'No matching competitors' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getByRole('status')).toHaveTextContent('12 of 12 fixture records');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('changes presentation without clearing filters and exposes semantic list rows', () => {
    render(<CompetitorDirectory competitors={competitorFixtures} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Tier' }), { target: { value: 'next_wave' } });
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('3 of 12 fixture records');
    expect(
      within(screen.getByRole('list', { name: 'Competitor results' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.queryByText(/items in|last post|healthy|up to date/i)).not.toBeInTheDocument();
  });

  it('keeps long names and Arabic names available without inventing missing information', () => {
    render(<CompetitorDirectory competitors={[{ ...competitorFixtures[1]!, name_ar: 'شركة إنتاج' }]} />);
    expect(screen.getByText('شركة إنتاج')).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('شركة إنتاج')).toHaveAttribute('lang', 'ar');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText(/last post|account health|campaigns/i)).not.toBeInTheDocument();
  });

  it.each([undefined, 'preview', 'production'])(
    'returns404 in a production build regardless of Vercel mode %s',
    async (mode) => {
      vi.stubEnv('NODE_ENV', 'production');
      if (mode) vi.stubEnv('VERCEL_ENV', mode);
      else vi.stubEnv('VERCEL_ENV', undefined);
      await expect(CompetitorPreviewPage()).rejects.toThrow('LOCAL_PREVIEW_NOT_FOUND');
    },
  );
});
