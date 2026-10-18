import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadSeedInput, planSeed, mergeSeedFields, canReplaceAccountIdentity } from './seed-competitors';

const competitorsCsv = readFileSync(new URL('./fixtures/competitors.csv', import.meta.url), 'utf8');
const accountsCsv = readFileSync(new URL('./fixtures/accounts.csv', import.meta.url), 'utf8');
const taxonomiesJson = readFileSync(new URL('./fixtures/taxonomies.json', import.meta.url), 'utf8');
const input = (overridesCsv?: string) =>
  loadSeedInput({ competitorsCsv, accountsCsv, taxonomiesJson, overridesCsv });

describe('M02 seed planning', () => {
  it('maps five competitors and unknown capabilities without losing their source text', () => {
    const plan = planSeed(input());
    expect(plan.counts).toMatchObject({ inputCompetitors: 5, inputAccounts: 8, plannedAccounts: 11 });
    expect(plan.competitors[1]).toMatchObject({
      in_house: ['other'],
      notes: 'Note\nIn-house (other): Podcast studios',
    });
    expect(plan.counts.tiers).toEqual({ baseline: 1, pilot: 2, next_wave: 1, adjacent: 1 });
  });

  it('gates roots with work pages and derived snapshots deterministically', () => {
    const plan = planSeed(input());
    expect(plan.accounts.find((a) => a.sourceKey === 'C000:website:0')).toMatchObject({ status: 'paused' });
    expect(plan.accounts.find((a) => a.sourceKey === 'C002:website:0')).toMatchObject({ status: 'active' });
    expect(plan.accounts.find((a) => a.platform === 'linkedin_employees')).toMatchObject({
      cadence: '7 days',
      backfill_status: 'not_applicable',
      status: 'active',
    });
    expect(plan.accounts.find((a) => a.platform === 'youtube')).toMatchObject({
      handle: 'channel/UCihEH7Bk23zVkIYMCBqvjgQ',
      resolve_status: 'pending',
    });
    expect(plan.accounts.find((a) => a.company_code === 'C004')).toMatchObject({ status: 'paused' });
    expect(planSeed(input())).toEqual(plan);
  });

  it('applies replacement, invalid and add overrides before deriving/gating every run', () => {
    const csv = `company_id,platform,url,action
C001,instagram,https://www.instagram.com/fixed/,replace
C001,linkedin,,invalid
C003,website_work_page,https://nextwave.com/work,add`;
    const plan = planSeed(input(csv));
    expect(plan.accounts.find((a) => a.platform === 'instagram' && a.company_code === 'C001')?.handle).toBe(
      'fixed',
    );
    expect(
      plan.accounts.find((a) => a.platform === 'instagram_stories' && a.company_code === 'C001')?.handle,
    ).toBe('fixed');
    expect(
      plan.accounts
        .filter((a) => a.company_code === 'C001' && a.platform.startsWith('linkedin'))
        .every((a) => a.status === 'invalid'),
    ).toBe(true);
    expect(
      plan.accounts.find((a) => a.company_code === 'C003' && a.platform === 'website_work_page')?.status,
    ).toBe('paused');
    expect(planSeed(input(csv))).toEqual(plan);
  });

  it('reports cross-competitor collisions without taking ownership', () => {
    const plan = planSeed(
      input('company_id,platform,url,action\nC004,instagram,https://www.instagram.com/Pilot.One/,replace'),
    );
    expect(plan.issues.some((i) => i.code === 'duplicate_handle' && i.company_code === 'C004')).toBe(true);
    expect(plan.accounts.filter((a) => a.platform === 'instagram')).toHaveLength(1);
    expect(plan.counts.inputAccounts).toBe(8);
  });

  it('retains invalid source rows and their derived rows with explicit errors', () => {
    const plan = planSeed(
      loadSeedInput({
        competitorsCsv,
        accountsCsv: accountsCsv.replace(
          'https://www.instagram.com/Pilot.One/',
          'https://www.instagram.com/p/post-id/',
        ),
        taxonomiesJson,
      }),
    );
    expect(plan.issues.some((i) => i.code === 'invalid_url' && i.company_code === 'C001')).toBe(true);
    expect(
      plan.accounts
        .filter((a) => a.company_code === 'C001' && a.platform.startsWith('instagram'))
        .every((a) => a.status === 'invalid'),
    ).toBe(true);
    expect(plan.counts.plannedAccounts).toBe(11);
  });

  it('rejects unknown references, conflicting overrides and malformed CSV structure', () => {
    expect(() => planSeed(input('company_id,platform,url,action\nC999,instagram,@missing,add'))).toThrow(
      /unknown competitor/i,
    );
    expect(() =>
      planSeed(input('company_id,platform,url,action\nC001,instagram,@a,replace\nC001,instagram,@b,replace')),
    ).toThrow(/conflicting override/i);
    expect(() => loadSeedInput({ competitorsCsv: 'company_id\nC001', accountsCsv, taxonomiesJson })).toThrow(
      /CSV/,
    );
  });
  it('rejects credential-bearing public-source inputs without echoing them', () => {
    const attempt = () =>
      loadSeedInput({
        competitorsCsv,
        accountsCsv: accountsCsv.replace(
          'https://pilot-two.com/',
          'https://user:private-fixture-value@pilot-two.com/',
        ),
        taxonomiesJson,
      });
    expect(attempt).toThrow('Source data contains a credential-bearing URL');
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain('private-fixture-value');
    }
  });
  it.each([
    'not-a-url?api_key=testsentinel',
    'www.example.com/logo.svg?api_key=testsentinel',
    'www.example.com/logo.svg?api%5Fkey=testsentinel',
    'user:private-fixture@example.com/logo.svg',
    '@user:private-fixture@example.com/logo.svg',
  ])('rejects private data in schemeless or malformed source URLs: %s', (url) => {
    const attempt = () =>
      loadSeedInput({
        competitorsCsv,
        accountsCsv: accountsCsv.replace('https://pilot-two.com/', url),
        taxonomiesJson,
      });
    expect(attempt).toThrow('Source data contains a credential-bearing URL');
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toMatch(/testsentinel|private-fixture/);
    }
  });
  it('keeps all real source and derived row counts explicit after canonical normalization', () => {
    const plan = planSeed(
      loadSeedInput({
        competitorsCsv: readFileSync(new URL('../../data/competitors.csv', import.meta.url), 'utf8'),
        accountsCsv: readFileSync(new URL('../../data/competitor_accounts.csv', import.meta.url), 'utf8'),
        taxonomiesJson: readFileSync(new URL('../../reference/taxonomies.json', import.meta.url), 'utf8'),
      }),
    );
    expect(plan.counts.plannedCompetitors).toBe(285);
    expect(plan.counts.platforms).toEqual({
      website: 261,
      website_work_page: 199,
      instagram: 256,
      instagram_stories: 256,
      vimeo: 202,
      youtube: 128,
      linkedin: 226,
      linkedin_employees: 226,
    });
    expect(plan.counts.plannedAccounts).toBe(1754);
    expect(plan.issues.filter((issue) => issue.code === 'duplicate_handle')).toEqual([]);
  });
});

describe('seed field ownership', () => {
  it('changes only previously seed-owned fields and preserves later human edits', () => {
    const result = mergeSeedFields(
      { name: 'Owner correction', notes: 'old', logo_path: 'logos/copied.webp' },
      { name: 'seed name', notes: 'old' },
      { name: 'new seed name', notes: 'new' },
    );
    expect(result.patch).toEqual({ notes: 'new' });
    expect(result.preserved).toEqual(['name']);
  });
  it('does not adopt untracked existing records or update identical values', () => {
    expect(mergeSeedFields({ name: 'same' }, undefined, { name: 'same' }).patch).toEqual({});
    expect(mergeSeedFields({ name: 'same' }, undefined, { name: 'same' }).preserved).toEqual(['name']);
    expect(mergeSeedFields({ name: 'same' }, { name: 'same' }, { name: 'same' }).patch).toEqual({});
  });
  it('keeps human fields protected even when a later CSV happens to match them', () => {
    expect(
      mergeSeedFields(
        { name: 'new human value' },
        { name: 'new human value' },
        { name: 'another seed value' },
        ['name'],
      ).patch,
    ).toEqual({});
  });
  it('permits only explicit untouched owner identity replacement', () => {
    const values = { handle: 'old', platform: 'vimeo', url: 'https://vimeo.com/old' };
    const receipt = { id: '00000000-0000-4000-8000-000000000001', values, protectedFields: [] };
    const current = { ...values, items_count: 0, consecutive_failures: 0, backfill_status: 'pending' };
    expect(canReplaceAccountIdentity(current, receipt, true)).toBe(true);
    expect(canReplaceAccountIdentity(current, receipt, false)).toBe(false);
    for (const evidence of [
      { has_collection: true },
      { backfill_cursor: { page: 2 } },
      { locked_until: new Date() },
      { items_count: 1 },
      { backfill_status: 'done' },
      { handle: 'human-edit' },
    ]) {
      expect(canReplaceAccountIdentity({ ...current, ...evidence }, receipt, true)).toBe(false);
    }
  });
});
