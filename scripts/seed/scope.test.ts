import { describe, expect, it } from 'vitest';
import { scopedAccounts, scopedLogos } from './scope';
import { emptySeedManifest, type SeedPlan } from './model';
import type { ResolutionAccount } from './database';

const id = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const desired = {
  sourceKey: 'C000:vimeo:0',
  company_code: 'C000',
  platform: 'vimeo',
  handle: 'everyonefilms',
  url: 'https://vimeo.com/everyonefilms',
};
const plan = {
  competitors: [{ company_code: 'C000', slug: 'everyone-films', logo_url: null }],
  accounts: [desired],
} as unknown as SeedPlan;
const manifest = emptySeedManifest('supabase:zmotjsbzhzjvpelxvxlf:postgres');
manifest.competitors.C000 = {
  id,
  values: { company_code: 'C000', slug: 'everyone-films', logo_url: null },
  protectedFields: [],
};
manifest.accounts[desired.sourceKey] = {
  id: accountId,
  values: { competitor_id: id, platform: 'vimeo', handle: desired.handle, url: desired.url },
  protectedFields: [],
};
const row = {
  id: accountId,
  competitor_id: id,
  company_code: 'C000',
  platform: 'vimeo',
  handle: desired.handle,
  url: desired.url,
} as ResolutionAccount;
describe('live work stays within approved managed source identities', () => {
  it('excludes additional unmanaged accounts from all provider/network batches', () => {
    const extra = { ...row, id: '33333333-3333-4333-8333-333333333333', handle: 'unreviewed' };
    expect(scopedAccounts([row, extra], plan, manifest)).toEqual([row]);
  });
  it('preserves human identity edits and refuses missing ownership', () => {
    expect(scopedAccounts([{ ...row, handle: 'changed' }], plan, manifest)).toEqual([]);
    expect(scopedAccounts([row], plan, emptySeedManifest(manifest.target))).toEqual([]);
    const protectedManifest = structuredClone(manifest);
    protectedManifest.accounts[desired.sourceKey]!.protectedFields = ['url'];
    expect(scopedAccounts([row], plan, protectedManifest)).toEqual([]);
  });
  it('excludes unreviewed competitor logos and source edits before downloading', () => {
    const logo = {
      competitorId: id,
      company_code: 'C000',
      slug: 'everyone-films',
      sourceUrl: null,
      currentLogoPath: null,
    };
    expect(
      scopedLogos(
        [logo, { ...logo, competitorId: '33333333-3333-4333-8333-333333333333', company_code: 'C001' }],
        plan,
        manifest,
      ),
    ).toEqual([logo]);
    expect(
      scopedLogos([{ ...logo, sourceUrl: 'https://unreviewed.example/logo.png' }], plan, manifest),
    ).toEqual([]);
  });
});
