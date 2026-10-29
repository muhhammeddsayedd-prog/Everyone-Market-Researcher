import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildBakeoffReport,
  renderBakeoffMarkdown,
  buildCampaignBakeoffReport,
  renderCampaignBakeoffMarkdown,
} from './bakeoff-report';

const actors = ['data-slayer/instagram-stories-scraper', 'igview-owner/instagram-story-viewer'] as const;
const account = '90000000-0000-4000-8000-000000000001';
type Actor = (typeof actors)[number];
const observation = (
  actor: Actor,
  day: string,
  story_keys = ['123'],
  run = actor === actors[0] ? 'runA' : 'runB',
) => ({
  actor,
  day,
  account_id: account,
  apify_run_id: run,
  status: story_keys.length ? 'success' : 'no_stories',
  login_prompt: false,
  story_keys,
});
const story = (actor: Actor, day = '2026-10-29', story_key = '123') => ({
  actor,
  day,
  account_id: account,
  story_key,
  raw_id: story_key,
  taken_at: `${day}T01:00:00Z`,
  has_thumbnail: true,
  has_mentions: false,
  has_link: true,
  apify_run_id: actor === actors[0] ? 'runA' : 'runB',
});
function sample() {
  return {
    from_day: '2026-10-29',
    to_day: '2026-10-29',
    accounts: [account],
    actors: [...actors],
    observations: [
      observation(actors[0], '2026-10-29'),
      observation(actors[1], '2026-10-29', ['123', '456']),
    ],
    rows: [story(actors[0]), story(actors[1]), story(actors[1], '2026-10-29', '456')],
    costs: [
      { actor: actors[0], apify_run_id: 'runA', usd: 0.01 },
      { actor: actors[1], apify_run_id: 'runB', usd: 0.02 },
    ],
  };
}

describe('campaign-specific delivery denominator', () => {
  function campaign() {
    return {
      ...sample(),
      campaign_id: account,
      run_ids: [account],
      actor_run_ids: ['runA', 'runB'],
      to_day: '2026-11-04',
      thumbnail_items: [
        {
          item_id: '90000000-0000-4000-8000-000000000002',
          apify_run_id: 'runA',
          eligible: true,
          first_seen_at: '2026-10-29T06:00:00Z',
          published_at: '2026-10-29T04:00:00Z',
          stored_at: '2026-10-29T07:00:00Z',
        },
        {
          item_id: '90000000-0000-4000-8000-000000000003',
          apify_run_id: 'runA',
          eligible: true,
          first_seen_at: '2026-10-29T06:00:00Z',
          published_at: '2026-10-29T04:00:00Z',
          stored_at: null,
        },
        {
          item_id: '90000000-0000-4000-8000-000000000004',
          apify_run_id: 'runA',
          eligible: true,
          first_seen_at: '2026-10-29T06:00:00Z',
          published_at: '2026-10-29T04:00:00Z',
          stored_at: '2026-10-29T12:00:01Z',
        },
      ],
    };
  }
  it('counts missing and late media as failures without an inner-join denominator', () => {
    const r = buildCampaignBakeoffReport(campaign());
    expect(r.thumbnails).toMatchObject({
      eligible_captured_stories: 3,
      timely: 1,
      missing: 1,
      late: 1,
      failed: 2,
      timely_percent: 33.33,
    });
    expect(r.discovery_lag_seconds.map((i) => i.seconds)).toEqual([7200, 7200, 7200]);
    expect(renderCampaignBakeoffMarkdown(campaign())).toContain('Missing media remains in the denominator');
  });
  it('does not turn earlier fixture runs into campaign observations', () => {
    expect(() => buildCampaignBakeoffReport({ ...campaign(), actor_run_ids: ['unrelated'] })).toThrow();
    expect(() => buildCampaignBakeoffReport({ ...campaign(), to_day: '2026-11-05' })).toThrow();
  });
});

describe('offline story comparison report', () => {
  it('reports the actual three manual captures without inventing Louis empty observations or a seven-day recommendation', () => {
    const input = JSON.parse(
      readFileSync(
        new URL(
          '../milestones/M06-collectors-stories-upkeep/evidence/story-manual-comparison-input-20261029.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const r = buildBakeoffReport(input);
    expect(r).toMatchObject({
      days: 1,
      accounts: 3,
      union_stories: 12,
      seven_day_evidence_complete: false,
      recommendation: null,
    });
    expect(r.actors.map((a) => [a.stories_found, a.missing_account_days, a.runs_failed, a.cost_usd])).toEqual(
      [
        [12, 0, 0, 0.03088],
        [12, 0, 0, 0.19],
        [12, 2, 0, 0.109],
      ],
    );
    expect(r.actors.reduce((sum, a) => sum + (a.cost_usd ?? 0), 0)).toBe(0.32988);
    expect(input.observations).toHaveLength(7);
    expect(input.rows).toHaveLength(36);
    expect(input.costs).toHaveLength(3);
  });
  it('uses per-account story union, real costs and observed metadata without claiming seven days', () => {
    const r = buildBakeoffReport(sample());
    expect(r.union_stories).toBe(2);
    expect(r.actors[0]).toMatchObject({
      stories_found: 1,
      coverage_percent: 50,
      thumbnail_rate_percent: 100,
      mentions_rate_percent: 0,
      link_rate_percent: 100,
      cost_usd: 0.01,
      cost_per_1k_stories_usd: 10,
    });
    expect(r.actors[1]).toMatchObject({ stories_found: 2, coverage_percent: 100, cost_usd: 0.02 });
    expect(r.seven_day_evidence_complete).toBe(false);
    expect(r.recommendation).toBeNull();
    expect(r.owner_actor_selection_required).toBe(true);
  });
  it('never treats a provider failure or missing account observation as no stories', () => {
    const x = sample();
    x.observations = [{ ...observation(actors[0], '2026-10-29', []), status: 'failed' }];
    x.rows = [];
    x.costs = x.costs.slice(0, 1);
    const r = buildBakeoffReport(x);
    expect(r.actors[0]).toMatchObject({
      runs_failed: 1,
      missing_account_days: 1,
      explicit_no_stories: 0,
      stories_found: 0,
    });
    expect(r.actors[1]).toMatchObject({ days_run: 0, runs: 0, missing_account_days: 1, cost_usd: null });
    expect(r.actors.every((a) => a.coverage_percent === null)).toBe(true);
  });
  it('accepts attributable explicit no-stories observation with known paid start but no invented story denominator', () => {
    const x = sample();
    x.observations = actors.map((a) => observation(a, '2026-10-29', []));
    x.rows = [];
    const r = buildBakeoffReport(x);
    expect(r.actors[0]).toMatchObject({
      observed_account_days: 1,
      explicit_no_stories: 1,
      stories_found: 0,
      cost_usd: 0.01,
      cost_per_1k_stories_usd: null,
      thumbnail_rate_percent: null,
    });
    expect(r.seven_day_evidence_complete).toBe(false);
  });
  it('charges a shared multi-account run once and rejects inconsistent duplicate run costs', () => {
    const x = sample();
    const second = '90000000-0000-4000-8000-000000000002';
    x.accounts.push(second);
    x.observations.push({ ...observation(actors[0], '2026-10-29'), account_id: second });
    x.rows.push({ ...story(actors[0]), account_id: second });
    x.costs.push({ ...x.costs[0]! });
    expect(buildBakeoffReport(x).actors[0]).toMatchObject({ stories_found: 2, runs: 1, cost_usd: 0.01 });
    x.costs.push({ ...x.costs[0]!, usd: 0.03 });
    expect(() => buildBakeoffReport(x)).toThrow('M06_BAKEOFF_INPUT_INVALID');
  });
  it('keeps missing or unreconciled costs null instead of reporting a free run', () => {
    const x = sample();
    x.costs = x.costs.slice(0, 1);
    expect(buildBakeoffReport(x).actors[1]).toMatchObject({
      cost_usd: null,
      unknown_cost_runs: 1,
      known_cost_usd: 0,
      cost_per_1k_stories_usd: null,
    });
    const unknown = { ...sample(), costs: [{ actor: actors[0], apify_run_id: 'runA', usd: null }] };
    expect(buildBakeoffReport(unknown).actors[0]!.cost_usd).toBeNull();
  });
  it('keeps absent account evidence distinct from provider/source failure and explicit empty evidence', () => {
    const x = sample();
    x.observations[0] = { ...observation(actors[0], '2026-10-29', []), status: 'failed' };
    const projected = {
      ...x,
      observations: [{ ...x.observations[0], error_code: 'stories_no_account_evidence' }, x.observations[1]],
    };
    expect(buildBakeoffReport(projected).actors[0]).toMatchObject({
      runs_failed: 0,
      runs_with_missing_evidence: 1,
      explicit_no_stories: 0,
      missing_account_days: 1,
    });
  });
  it('takes day membership from observations rather than first-seen global story rows', () => {
    const x = sample();
    x.to_day = '2026-10-30';
    x.observations.push({ ...observation(actors[0], '2026-10-30', ['123'], 'runA2') });
    x.costs.push({ actor: actors[0], apify_run_id: 'runA2', usd: 0.01 });
    const r = buildBakeoffReport(x);
    expect(r.actors[0]).toMatchObject({
      days_run: 2,
      observed_account_days: 2,
      stories_found: 1,
      runs: 2,
      cost_usd: 0.02,
    });
    expect(r.actors[1]!.missing_account_days).toBe(1);
  });
  it('does not turn absent row metadata into a zero feature rate', () => {
    const x = sample();
    x.rows = x.rows.slice(0, 1);
    expect(buildBakeoffReport(x).actors[1]).toMatchObject({
      missing_story_metadata: 2,
      thumbnail_rate_percent: null,
      mentions_rate_percent: null,
      link_rate_percent: null,
    });
  });
  it('preserves login exclusion and never recommends that actor', () => {
    const x = sample();
    x.observations[0] = {
      ...observation(actors[0], '2026-10-29', []),
      status: 'excluded',
      login_prompt: true,
    };
    x.rows = x.rows.filter((r) => r.actor !== actors[0]);
    const r = buildBakeoffReport(x);
    expect(r.actors[0]).toMatchObject({
      excluded: true,
      login_cookie_prompts: 1,
      runs_failed: 1,
      stories_found: 0,
    });
    expect(r.recommendation).toBeNull();
  });
  it('rejects malformed ownership, contradictory summaries, costs and duplicate identities safely', () => {
    const bad = [
      { ...sample(), accounts: [account, account] },
      { ...sample(), from_day: '2026-02-30' },
      { ...sample(), to_day: '2026-10-28' },
      { ...sample(), observations: [{ ...observation(actors[0], '2026-10-29'), status: 'no_stories' }] },
      {
        ...sample(),
        observations: [
          { ...observation(actors[0], '2026-10-29'), account_id: '90000000-0000-4000-8000-000000000003' },
        ],
      },
      { ...sample(), costs: [{ actor: actors[0], apify_run_id: 'foreign', usd: 1 }] },
      { ...sample(), costs: [{ actor: actors[0], apify_run_id: 'runA', usd: Infinity }] },
    ];
    for (const x of bad) expect(() => buildBakeoffReport(x)).toThrow('M06_BAKEOFF_INPUT_INVALID');
  });
  it('only recommends after seven days for the specified20 accounts and a measurable public-story union', () => {
    const x = sample();
    x.to_day = '2026-11-04';
    x.observations = [];
    x.costs = [];
    x.accounts = Array.from(
      { length: 20 },
      (_, i) => `90000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    );
    x.rows = [];
    for (const a of actors)
      for (const [i, accountId] of x.accounts.entries())
        x.rows.push({ ...story(a, x.from_day, String(1000 + i)), account_id: accountId });
    for (let n = 0; n < 7; n++) {
      const day = new Date(Date.parse(x.from_day) + n * 86400000).toISOString().slice(0, 10);
      for (const a of actors) {
        const id = `run${a === actors[0] ? 'A' : 'B'}${n}`;
        for (const [i, accountId] of x.accounts.entries())
          x.observations.push({ ...observation(a, day, [String(1000 + i)], id), account_id: accountId });
        x.costs.push({ actor: a, apify_run_id: id, usd: a === actors[0] ? 0.01 : 0.02 });
      }
    }
    const r = buildBakeoffReport(x);
    expect(r.seven_day_evidence_complete).toBe(true);
    expect(r.recommendation).toBe(actors[0]);
    expect(r.recommendation_reason).toBe('coverage_within_three_points_choose_cheapest');
    const subset = x.accounts.slice(0, 3);
    const small = {
      ...x,
      accounts: subset,
      observations: x.observations.filter((o) => subset.includes(o.account_id)),
      rows: x.rows.filter((row) => subset.includes(row.account_id)),
    };
    expect(buildBakeoffReport(small)).toMatchObject({
      seven_day_evidence_complete: false,
      recommendation: null,
    });
    x.costs = x.costs.filter((c) => c.actor === actors[0]);
    expect(buildBakeoffReport(x).recommendation).toBeNull();
  });
  it('renders the requested comparison columns and labels pending selection and unknowns', () => {
    const text = renderBakeoffMarkdown({ ...sample(), costs: [] });
    expect(text).toContain('USD / 1k');
    expect(text).toContain('unknown');
    expect(text).toContain('MA-16 remains the owner decision');
    expect(text).toContain('Seven-day comparison');
  });
  it('does not claim comparable identity coverage for collision-prone account/minute fallback keys', () => {
    const x = sample();
    const fallback = `${account}:29887260`;
    x.observations[0]!.story_keys = [fallback];
    x.rows[0]!.story_key = fallback;
    const r = buildBakeoffReport(x);
    expect(r.actors[0]!.ambiguous_story_keys).toBe(1);
    expect(r.seven_day_evidence_complete).toBe(false);
    expect(r.recommendation).toBeNull();
    expect(r.limitations.some((l) => l.includes('fallback keys can collide'))).toBe(true);
  });
});
