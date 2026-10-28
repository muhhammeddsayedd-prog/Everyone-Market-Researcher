import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLinkedInPostBatches, buildLinkedInEmployeeBatches } from '../collectors/linkedin.mjs';

const require = createRequire(import.meta.url);
type Row = Record<string, unknown>;
type Person = { public_id: string; name: string; title: string; location: string };
const posts = require('./linkedinPosts.js') as {
  normalizeLinkedInPosts: (rows: unknown[]) => { items: { matchKey: string; json: Row }[]; errors: Row[] };
  prepareLinkedInPostResults: (
    rows: unknown[],
    ctx: unknown,
  ) => { groups: { items: Row[]; status: string; coverage: Row }[]; unmatched_count: number };
  linkedinHelpers: {
    linkedinCompany: (value: unknown) => { slug: string; url: string } | null;
    linkedinDate: (value: unknown) => string | null;
  };
};
const employees = require('./linkedinEmployees.js') as {
  normalizeLinkedInEmployees: (
    rows: unknown[],
    ctx: unknown,
  ) => { groups: { people: Person[]; status: string; coverage: Row }[]; unmatched_count: number };
  employeeSnapshotDelta: (previous: Person[] | null, current: Person[], coverage?: Row) => Row;
  employeeSnapshotReplay: (existing: unknown, candidate: unknown) => Row;
};
const fixture = (folder: string) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${folder}/synthetic-contract.json`, import.meta.url), 'utf8'),
  ) as { fixtureProvenance: { actualActorCapture: boolean }; rows: Row[] };
const postFixture = fixture('linkedin-company-posts'),
  employeeFixture = fixture('linkedin-company-employees');
const account = (
  index = 1,
  platform: 'linkedin' | 'linkedin_employees' = 'linkedin',
  slug = 'fixture-films',
) => ({
  id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  competitor_id: `80000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  platform,
  handle: slug,
  url: `https://www.linkedin.com/company/${slug}/`,
  last_item_published_at: '2026-10-24T10:00:00Z',
  backfill_cursor: null,
});
const postContext = { accounts: [account()], mode: 'daily', now: '2026-10-28T00:00:00Z', maxPosts: 50 };
const employeeContext = {
  accounts: [account(1, 'linkedin_employees')],
  input: {
    companies: ['https://www.linkedin.com/company/fixture-films/'],
    profileScraperMode: 'Short ($4 per 1k)',
    companyBatchMode: 'one_by_one',
    maxItems: 20,
    maxItemsPerCompany: 20,
  },
};

describe('LinkedIn source contracts — synthetic local fixtures, not provider capture', () => {
  it('labels all source fixtures honestly', () => {
    expect(postFixture.fixtureProvenance.actualActorCapture).toBe(false);
    expect(employeeFixture.fixtureProvenance.actualActorCapture).toBe(false);
  });
  it('normalizes authored company posts, dates, Arabic hashtags and zero metrics without rich author payload', () => {
    const result = posts.normalizeLinkedInPosts(postFixture.rows.slice(0, 2));
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({
      matchKey: 'fixture-films',
      json: {
        platform: 'linkedin',
        item_type: 'linkedin_post',
        hashtags: ['cinema', 'سينما'],
        metrics: { likes: 0, comments: 2, shares: 1 },
        payload: { company_slug: 'fixture-films' },
      },
    });
    expect(result.items[1]?.json).toMatchObject({ metrics: { likes: 5, comments: 0, shares: null } });
    expect(JSON.stringify(result.items)).not.toContain('avatar');
  });
  it('does not assign a profile original/repost to the requested company', () => {
    expect(posts.prepareLinkedInPostResults(postFixture.rows, postContext)).toMatchObject({
      unmatched_count: 1,
      groups: [{ status: 'failed', items: [] }],
    });
    const inventedRepost = { ...postFixture.rows[0], isRepost: true };
    expect(posts.normalizeLinkedInPosts([inventedRepost])).toMatchObject({
      items: [],
      errors: [{ error: 'linkedin_repost_shape_unverified' }],
    });
  });
  it('accepts and discards observed inert metadata from a labelled shape-derived synthetic post', () => {
    // Only keys/types derive from the retained provider observation; all values
    // are synthetic. This is not a copied post, person, image or actor INPUT.
    const shaped = {
      ...postFixture.rows[0],
      entityId: 'discarded-entity',
      header: { text: null },
      query: { targetUrl: account().url, page: '1', sessionId: 'discarded-session', sortBy: 'recent' },
      shareLinkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1111111111111111111',
      shareUrn: 'discarded-share-urn',
      contentAttributes: [{ start: 0, length: 3, type: 'company', textLink: 'discarded-rich-link' }],
      reactionIds: ['discarded-reaction'],
      commentIds: ['discarded-comment'],
      postVideo: { thumbnailUrl: 'discarded-thumbnail', videoUrl: 'discarded-video' },
    };
    const plain = posts.normalizeLinkedInPosts(postFixture.rows.slice(0, 1));
    const result = posts.normalizeLinkedInPosts([shaped]);
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual(plain.items);
    for (const value of ['discarded-', 'sessionId', 'contentAttributes', 'reactionIds', 'postVideo'])
      expect(JSON.stringify(result.items)).not.toContain(value);
    expect(result.items[0]?.json).toMatchObject({
      thumbnail_url: null,
      duration_seconds: null,
      media_urls: [],
    });
  });
  it('requires query ownership to agree with the author and registered company mapping', () => {
    const foreign = {
      ...postFixture.rows[0],
      query: { targetUrl: account(2, 'linkedin', 'another-films').url },
    };
    expect(posts.normalizeLinkedInPosts([foreign])).toMatchObject({
      items: [],
      errors: [{ error: 'linkedin_query_owner_mismatch' }],
    });
    const sameForeignOwner = {
      ...postFixture.rows[0],
      author: {
        type: 'company',
        universalName: 'another-films',
        linkedinUrl: account(2, 'linkedin', 'another-films').url,
      },
      query: { targetUrl: account(2, 'linkedin', 'another-films').url },
    };
    expect(posts.prepareLinkedInPostResults([sameForeignOwner], postContext)).toMatchObject({
      unmatched_count: 1,
      groups: [{ status: 'failed', items: [] }],
    });
  });
  it('keeps nonempty headers, ambiguous reposts, private targets and unknown extra metadata blocked', () => {
    for (const patch of [
      { header: { text: 'A synthetic company reposted this' } },
      { header: { text: null, owner: { type: 'company' } } },
      { isRepost: true },
      { unknownProviderExtension: 'discarded-is-not-authorization' },
      { query: { targetUrl: 'https://www.linkedin.com/in/synthetic-profile/' } },
      { query: { targetUrl: account().url, unverifiedTarget: account().url } },
    ])
      expect(posts.normalizeLinkedInPosts([{ ...postFixture.rows[0], ...patch }]).items).toEqual([]);
  });
  it('rejects spoofed URLs, mismatched activity IDs, impossible dates and conflicting company ownership', () => {
    for (const input of [
      'https://linkedin.com.evil.test/company/fixture-films/',
      'https://owner@linkedin.com/company/fixture-films/',
      'https://www.linkedin.com/company/fixture%2ffilms/',
      'https://www.linkedin.com/in/fixture-films/',
      'https://127.0.0.1/company/a/',
    ])
      expect(posts.linkedinHelpers.linkedinCompany(input)).toBeNull();
    for (const date of ['2026-02-30T12:00:00Z', '2026-10-25T24:00:00Z', '2026-10-25T12:00:00+15:00'])
      expect(posts.linkedinHelpers.linkedinDate(date)).toBeNull();
    expect(
      posts.normalizeLinkedInPosts([
        {
          ...postFixture.rows[0],
          linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:9999999999999999999/',
        },
      ]).items,
    ).toEqual([]);
    expect(
      posts.normalizeLinkedInPosts([
        {
          ...postFixture.rows[0],
          author: { type: 'company', universalName: 'another', linkedinUrl: account().url },
        },
      ]).items,
    ).toEqual([]);
  });
  it('keeps bounded history incomplete and fails saturated recent coverage', () => {
    expect(
      posts.prepareLinkedInPostResults(postFixture.rows.slice(0, 1), { ...postContext, mode: 'backfill' }),
    ).toMatchObject({ groups: [{ backfill_done: false, coverage: { complete: false } }] });
    expect(
      posts.prepareLinkedInPostResults(postFixture.rows.slice(0, 1), { ...postContext, maxPosts: 1 }),
    ).toMatchObject({ groups: [{ status: 'failed', coverage: { capped: true } }] });
    expect(
      posts.prepareLinkedInPostResults(postFixture.rows.slice(0, 1), {
        ...postContext,
        now: '2026-10-24T20:00:00-03:00',
      }),
    ).toMatchObject({ groups: [{ status: 'failed', error: 'linkedin_future_post' }] });
  });
  it('projects exactly four employee fields and treats singleton context as partial query evidence', () => {
    const result = employees.normalizeLinkedInEmployees(employeeFixture.rows, employeeContext);
    expect(result.groups[0]?.people).toEqual([
      { public_id: 'fixture-person-1', name: 'Person 1', title: 'Director', location: 'Cairo' },
      { public_id: 'fixture-person-2', name: 'Person 2', title: 'Producer', location: 'Riyadh' },
    ]);
    expect(result.groups[0]?.coverage).toMatchObject({
      complete: false,
      membership_evidence: 'registered_company_query',
    });
    for (const person of result.groups[0]?.people ?? [])
      expect(Object.keys(person).sort()).toEqual(['location', 'name', 'public_id', 'title']);
    expect(JSON.stringify(result)).not.toMatch(/photo|email|about|skills|experience|fixture@example/);
  });
  it('projects the retained plural-position/public-URL field shape without retaining rich profile data', () => {
    // Values are synthetic; keys/types derive from the bounded real Short read.
    const shaped = {
      id: 'private-actor-id-ignored',
      linkedinUrl: 'https://www.linkedin.com/in/fixture-person-1/',
      firstName: 'Person',
      lastName: '1',
      location: { linkedinText: 'Cairo' },
      currentPositions: [
        {
          current: true,
          companyLinkedinUrl: employeeContext.input.companies[0],
          title: 'Director',
          description: 'discard-description',
          companyName: 'Not identity',
        },
      ],
      summary: 'discard-summary',
      pictureUrl: 'https://example.invalid/discard-picture',
      email: 'discard-email',
      premium: true,
      openProfile: true,
    };
    const result = employees.normalizeLinkedInEmployees([shaped], employeeContext);
    expect(result.groups[0]).toMatchObject({
      status: 'success',
      people: [{ public_id: 'fixture-person-1', name: 'Person 1', title: 'Director', location: 'Cairo' }],
      coverage: { complete: false, membership_evidence: 'registered_company_query' },
    });
    expect(JSON.stringify(result)).not.toMatch(/private-actor|discard|premium|openProfile|companyName/);
  });
  it('does not infer public identity or employment from a private ID, former role, hostile URL or conflicting aliases', () => {
    const source = {
      linkedinUrl: 'https://www.linkedin.com/in/fixture-person-1/',
      firstName: 'Person',
      lastName: '1',
      currentPositions: [
        { current: true, companyLinkedinUrl: employeeContext.input.companies[0], title: 'Director' },
      ],
    };
    for (const change of [
      { linkedinUrl: 'https://linkedin.com.evil.invalid/in/fixture-person-1/' },
      { linkedinUrl: 'https://owner@linkedin.com/in/fixture-person-1/' },
      { linkedinUrl: 'https://www.linkedin.com/in/fixture%2fperson/' },
      { publicIdentifier: 'foreign-person' },
      { linkedinUrl: undefined, id: 'private-actor-id' },
      { currentPositions: [{ current: false, companyLinkedinUrl: employeeContext.input.companies[0] }] },
      {
        currentPositions: [
          { current: true, companyLinkedinUrl: 'https://www.linkedin.com/company/foreign/' },
        ],
      },
      {
        currentPositions: [
          { current: true, companyLinkedinUrl: 'https://linkedin.com.evil.invalid/company/fixture-films/' },
        ],
      },
      { currentPosition: [{ companyLinkedinUrl: 'https://www.linkedin.com/company/foreign/' }] },
    ]) {
      const result = employees.normalizeLinkedInEmployees([{ ...source, ...change }], employeeContext);
      expect(result.groups[0]?.people).toEqual([]);
      expect(result.groups[0]?.status).toBe('failed');
    }
  });
  it('matches numeric company URLs only to an explicitly resolved catalog ID', () => {
    const row = {
      linkedinUrl: 'https://www.linkedin.com/in/fixture-person-1/',
      firstName: 'Person',
      lastName: '1',
      currentPositions: [
        { current: true, companyLinkedinUrl: 'https://www.linkedin.com/company/12345678', title: 'Director' },
      ],
    };
    const resolved = {
      ...employeeContext,
      accounts: [{ ...employeeContext.accounts[0], external_id: '12345678' }],
    };
    expect(employees.normalizeLinkedInEmployees([row], resolved)).toMatchObject({
      groups: [
        {
          status: 'success',
          people: [{ public_id: 'fixture-person-1', title: 'Director' }],
          coverage: { complete: false },
        },
      ],
    });
    for (const ctx of [
      employeeContext,
      { ...resolved, accounts: [{ ...resolved.accounts[0], external_id: '99999999' }] },
    ]) {
      expect(employees.normalizeLinkedInEmployees([row], ctx)).toMatchObject({
        unmatched_count: 1,
        groups: [{ status: 'failed', people: [] }],
      });
    }
    expect(() =>
      employees.normalizeLinkedInEmployees([row], {
        ...resolved,
        accounts: [{ ...resolved.accounts[0], external_id: 'unverified-name' }],
      }),
    ).toThrow(/context_invalid/);
  });
  it('never uses fuzzy company names or guesses a mixed-query target; rejects Full mode', () => {
    const another = account(2, 'linkedin_employees', 'another-films');
    const mixed = {
      accounts: [...employeeContext.accounts, another],
      input: {
        ...employeeContext.input,
        companies: [...employeeContext.input.companies, another.url],
        maxItems: 40,
      },
    };
    expect(employees.normalizeLinkedInEmployees([employeeFixture.rows[0]], mixed)).toMatchObject({
      unmatched_count: 1,
      groups: [{ status: 'failed' }, { status: 'failed' }],
    });
    expect(
      employees.normalizeLinkedInEmployees(
        [{ ...employeeFixture.rows[0], currentPosition: [{ companyLinkedinUrl: another.url }] }],
        employeeContext,
      ),
    ).toMatchObject({ unmatched_count: 1 });
    expect(() =>
      employees.normalizeLinkedInEmployees([], {
        ...employeeContext,
        input: { ...employeeContext.input, profileScraperMode: 'Full ($8 per 1k)' },
      }),
    ).toThrow(/context_invalid/);
  });
  it('does not infer departures/joins from partial samples; exact same-date replay cannot replace observations', () => {
    const people =
      employees.normalizeLinkedInEmployees(employeeFixture.rows, employeeContext).groups[0]?.people ?? [];
    expect(
      employees.employeeSnapshotDelta(people, people.slice(0, 1), {
        previousComplete: true,
        currentComplete: false,
      }),
    ).toEqual({ joined: [], left_company: [], comparison_complete: false });
    expect(
      employees.employeeSnapshotDelta(people, people.slice(0, 1), {
        previousComplete: true,
        currentComplete: true,
      }),
    ).toMatchObject({ left_company: [people[1]], comparison_complete: true });
    const before = {
      account_id: account().id,
      snapshot_date: '2026-10-28',
      people,
      coverage: { complete: false },
    };
    expect(employees.employeeSnapshotReplay(before, { ...before, people: [...people].reverse() })).toEqual({
      state: 'replayed',
      replace: false,
    });
    expect(employees.employeeSnapshotReplay(before, { ...before, people: people.slice(0, 1) })).toEqual({
      state: 'conflict',
      replace: false,
    });
    expect(
      employees.employeeSnapshotReplay(
        { ...before, coverage: { complete: false, reason: 'bounded' } },
        { ...before, coverage: { reason: 'bounded', complete: false } },
      ),
    ).toEqual({ state: 'replayed', replace: false });
    expect(
      employees.normalizeLinkedInEmployees(employeeFixture.rows, {
        ...employeeContext,
        input: { ...employeeContext.input, maxItems: 1, maxItemsPerCompany: 1 },
      }),
    ).toMatchObject({
      groups: [{ status: 'failed', error: 'linkedin_employee_result_overflow', people: [] }],
    });
  });
  it('constructs finite public-only post batches with actual date buckets and inclusive cutoff inputs', () => {
    const batches = buildLinkedInPostBatches(
      [
        account(),
        { ...account(2, 'linkedin', 'another-films'), last_item_published_at: '2026-10-20T10:00:00Z' },
      ],
      { mode: 'daily', now: postContext.now, maxPosts: 50 },
    );
    expect(batches.map((batch) => batch.input.postedLimitDate).sort()).toEqual(['2026-10-19', '2026-10-23']);
    expect(batches[0]?.input).toMatchObject({
      includeReposts: true,
      includeQuotePosts: true,
      scrapeReactions: false,
      scrapeComments: false,
      maxPosts: 50,
    });
    expect(() =>
      buildLinkedInPostBatches([account()], { mode: 'backfill', now: postContext.now, maxPosts: 0 }),
    ).toThrow();
    expect(() =>
      buildLinkedInPostBatches([account()], { mode: 'daily', now: postContext.now, cookies: [] }),
    ).toThrow();
  });
  it('constructs bounded singleton Short employee queries and binds resume pages to company/capture date', () => {
    const people = [account(1, 'linkedin_employees'), account(2, 'linkedin_employees', 'another-films')];
    const batches = buildLinkedInEmployeeBatches(people, {
      snapshotDate: '2026-10-28',
      maxItemsPerCompany: 20,
    });
    expect(batches).toHaveLength(2);
    expect(batches[0]?.input).toMatchObject({
      profileScraperMode: 'Short ($4 per 1k)',
      companyBatchMode: 'one_by_one',
      maxItems: 20,
      maxItemsPerCompany: 20,
      startPage: 1,
      takePages: 1,
    });
    expect(batches[0]?.snapshot_date).toBe('2026-10-28');
    const cursors = {
      [people[0]!.id]: { company_url: people[0]!.url, snapshot_date: '2026-10-27', next_page: 2 },
    };
    expect(() =>
      buildLinkedInEmployeeBatches(people, { snapshotDate: '2026-10-28', maxItemsPerCompany: 20, cursors }),
    ).toThrow(/cursor/);
  });
});
