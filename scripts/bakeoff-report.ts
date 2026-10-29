// Offline projection of qualified source observations, public-story rows and
// reconciled per-Apify-run costs. Manual fixtures and projected database readbacks
// stay separate evidence; this report performs no database, provider or email I/O.
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const actor = z.enum([
  'data-slayer/instagram-stories-scraper',
  'igview-owner/instagram-story-viewer',
  'louisdeconinck/instagram-story-details-scraper',
]);
const runId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const storyKey = z.string().min(1).max(160);
const inputSchema = z.strictObject({
  from_day: z.iso.date(),
  to_day: z.iso.date(),
  accounts: z.array(z.uuid()).min(1).max(100),
  actors: z.array(actor).min(1).max(3),
  observations: z
    .array(
      z.strictObject({
        day: z.iso.date(),
        actor,
        account_id: z.uuid(),
        apify_run_id: runId,
        status: z.enum(['success', 'no_stories', 'failed', 'excluded']),
        login_prompt: z.boolean(),
        story_keys: z.array(storyKey).max(1000),
        error_code: z
          .string()
          .regex(/^[a-z0-9_]{1,100}$/)
          .nullable()
          .optional(),
      }),
    )
    .max(10000),
  rows: z
    .array(
      z.strictObject({
        day: z.iso.date(),
        actor,
        account_id: z.uuid(),
        story_key: storyKey,
        raw_id: z.string().min(1).max(160),
        taken_at: z.iso.datetime({ offset: true }),
        has_thumbnail: z.boolean(),
        has_mentions: z.boolean(),
        has_link: z.boolean(),
        apify_run_id: runId,
      }),
    )
    .max(100000),
  costs: z
    .array(z.strictObject({ actor, apify_run_id: runId, usd: z.number().finite().nonnegative().nullable() }))
    .max(10000),
});
type Input = z.output<typeof inputSchema>;
type Actor = Input['actors'][number];
const invalid = () => Error('M06_BAKEOFF_INPUT_INVALID');
const key = (...parts: string[]) => JSON.stringify(parts);
const percent = (n: number, d: number) => (d === 0 ? null : Math.round((n * 10000) / d) / 100);
const round = (v: number) => {
  if (!Number.isFinite(v) || v < 0) throw invalid();
  return Number(v.toFixed(9));
};

/** Missing observations are evidence gaps, never synthetic no-stories records.
 * Coverage uses each observation's story membership; global unique story rows
 * alone cannot establish which accounts/days were actually observed. */
export function buildBakeoffReport(value: unknown) {
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) throw invalid();
  const input = parsed.data;
  const dates: string[] = [];
  for (let at = Date.parse(input.from_day); at <= Date.parse(input.to_day); at += 86400000) {
    if (dates.length >= 31) throw invalid();
    dates.push(new Date(at).toISOString().slice(0, 10));
  }
  if (
    !dates.length ||
    new Set(input.accounts).size !== input.accounts.length ||
    new Set(input.actors).size !== input.actors.length
  )
    throw invalid();
  const accounts = new Set(input.accounts),
    actors = new Set(input.actors),
    days = new Set(dates);
  const observations = new Map<string, Input['observations'][number]>();
  const runs = new Map<string, { actor: Actor; day: string }>();
  for (const o of input.observations) {
    if (
      !accounts.has(o.account_id) ||
      !actors.has(o.actor) ||
      !days.has(o.day) ||
      new Set(o.story_keys).size !== o.story_keys.length ||
      (o.status === 'success' ? o.story_keys.length === 0 : o.story_keys.length !== 0)
    )
      throw invalid();
    const run = runs.get(o.apify_run_id);
    if (run && (run.actor !== o.actor || run.day !== o.day)) throw invalid();
    runs.set(o.apify_run_id, { actor: o.actor, day: o.day });
    const id = key(o.actor, o.apify_run_id, o.account_id),
      previous = observations.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(o)) throw invalid();
    observations.set(id, o);
  }
  const rows = new Map<string, Input['rows'][number]>();
  for (const r of input.rows) {
    if (!accounts.has(r.account_id) || !actors.has(r.actor)) throw invalid();
    const id = key(r.actor, r.account_id, r.story_key),
      previous = rows.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(r)) throw invalid();
    rows.set(id, r);
  }
  const costs = new Map<string, number | null>();
  for (const c of input.costs) {
    const run = runs.get(c.apify_run_id);
    if (!run || run.actor !== c.actor) throw invalid();
    const id = key(c.actor, c.apify_run_id);
    if (costs.has(id) && costs.get(id) !== c.usd) throw invalid();
    costs.set(id, c.usd);
  }
  const accepted = [...observations.values()].filter(
    (o) => ['success', 'no_stories'].includes(o.status) && !o.login_prompt,
  );
  const union = new Set(accepted.flatMap((o) => o.story_keys.map((s) => key(o.account_id, s))));
  const expectedSlots = dates.length * input.accounts.length;
  const actorRows = input.actors.map((a) => {
    const seen = [...observations.values()].filter((o) => o.actor === a);
    const successful = accepted.filter((o) => o.actor === a);
    const observedSlots = new Set(successful.map((o) => key(o.day, o.account_id)));
    const found = new Set(successful.flatMap((o) => o.story_keys.map((s) => key(o.account_id, s))));
    const actorRunIds = new Set(seen.map((o) => o.apify_run_id));
    const failedRuns = new Set(
      seen
        .filter(
          (o) => ['failed', 'excluded'].includes(o.status) && o.error_code !== 'stories_no_account_evidence',
        )
        .map((o) => o.apify_run_id),
    );
    const missingEvidenceRuns = new Set(
      seen.filter((o) => o.error_code === 'stories_no_account_evidence').map((o) => o.apify_run_id),
    );
    const loginRuns = new Set(seen.filter((o) => o.login_prompt).map((o) => o.apify_run_id));
    const measurements = [...found].map((s) => {
      const [account, story] = JSON.parse(s) as [string, string];
      return rows.get(key(a, account, story));
    });
    const ambiguousKeys = [...found].filter((s) => {
      const [, story] = JSON.parse(s) as [string, string];
      return !/^[1-9][0-9]{0,29}$/.test(story);
    }).length;
    const missingMetadata = measurements.filter((r) => !r).length;
    const quotes = [...actorRunIds].map((r) => costs.get(key(a, r)));
    const knownUsd = round(quotes.reduce<number>((n, q) => n + (q ?? 0), 0));
    const unknownCosts = quotes.filter((q) => q === null || q === undefined).length;
    const completeCost = quotes.length > 0 && unknownCosts === 0 ? knownUsd : null;
    const rate = (field: 'has_thumbnail' | 'has_mentions' | 'has_link') =>
      missingMetadata ? null : percent(measurements.filter((r) => r?.[field]).length, found.size);
    return {
      actor: a,
      days_run: new Set(seen.map((o) => o.day)).size,
      runs: actorRunIds.size,
      runs_failed: failedRuns.size,
      runs_with_missing_evidence: missingEvidenceRuns.size,
      stories_found: found.size,
      union_stories: union.size,
      coverage_percent: percent(found.size, union.size),
      expected_account_days: expectedSlots,
      observed_account_days: observedSlots.size,
      missing_account_days: expectedSlots - observedSlots.size,
      explicit_no_stories: successful.filter((o) => o.status === 'no_stories').length,
      thumbnail_rate_percent: rate('has_thumbnail'),
      mentions_rate_percent: rate('has_mentions'),
      link_rate_percent: rate('has_link'),
      missing_story_metadata: missingMetadata,
      ambiguous_story_keys: ambiguousKeys,
      known_cost_usd: knownUsd,
      cost_usd: completeCost,
      unknown_cost_runs: unknownCosts,
      cost_per_1k_stories_usd:
        completeCost === null || !found.size ? null : round((completeCost * 1000) / found.size),
      login_cookie_prompts: loginRuns.size,
      excluded: loginRuns.size > 0 || seen.some((o) => o.status === 'excluded'),
    };
  });
  const eligible = actorRows.filter((r) => !r.excluded);
  const ready =
    dates.length >= 7 &&
    input.accounts.length >= 20 &&
    eligible.length >= 2 &&
    eligible.every(
      (r) => r.missing_account_days === 0 && r.missing_story_metadata === 0 && r.ambiguous_story_keys === 0,
    ) &&
    union.size > 0;
  let recommendation: Actor | null = null;
  let reason = ready ? 'cost_missing_for_coverage_tie' : 'comparison_evidence_incomplete';
  if (ready) {
    const bestCoverage = Math.max(...eligible.map((r) => r.coverage_percent ?? 0));
    const tied = eligible.filter((r) => bestCoverage - (r.coverage_percent ?? 0) <= 3);
    if (tied.length === 1) {
      recommendation = tied[0]!.actor;
      reason = 'highest_coverage';
    } else if (tied.every((r) => r.cost_usd !== null)) {
      recommendation = [...tied].sort(
        (a, b) => a.cost_usd! - b.cost_usd! || a.actor.localeCompare(b.actor),
      )[0]!.actor;
      reason = 'coverage_within_three_points_choose_cheapest';
    }
  }
  return {
    version: 1,
    from_day: input.from_day,
    to_day: input.to_day,
    days: dates.length,
    accounts: input.accounts.length,
    required_comparison_accounts: 20,
    union_stories: union.size,
    actors: actorRows,
    seven_day_evidence_complete: ready,
    recommendation,
    recommendation_reason: reason,
    owner_actor_selection_required: true,
    limitations: [
      'Observed public-story union is a comparison reference, not Instagram-wide completeness.',
      'Unknown charges remain unknown; infrastructure allocation is excluded.',
      'A successful no-stories observation proves only that account and capture time.',
      ...(input.accounts.length < 20
        ? [
            'Fewer than the specified20 pilot accounts were observed; this is not the full planned comparison.',
          ]
        : []),
      'Failed/source runs count rejected source observations; missing-account evidence is reported separately. Native provider states remain in source receipts.',
      ...(actorRows.some((r) => r.ambiguous_story_keys > 0)
        ? [
            'Account/minute fallback keys can collide or fail cross-actor matching; identity coverage remains ambiguous.',
          ]
        : []),
      ...(ready ? [] : ['Seven-day comparison or required source observations remain incomplete.']),
    ],
  };
}

/** Campaign snapshots are already restricted by registered slot/run identity in
 * SQL. Recheck the report boundary here so old fixtures/accepted observations
 * cannot silently count as campaign days. Missing media remains in denominator. */
export function buildCampaignBakeoffReport(value: unknown) {
  const snapshot = z
    .object({
      campaign_id: z.uuid(),
      from_day: z.iso.date(),
      to_day: z.iso.date(),
      run_ids: z.array(z.uuid()).max(10000),
      actor_run_ids: z.array(runId).max(10000),
      thumbnail_items: z
        .array(
          z.object({
            item_id: z.uuid(),
            apify_run_id: runId,
            eligible: z.boolean(),
            first_seen_at: z.iso.datetime({ offset: true }),
            published_at: z.iso.datetime({ offset: true }),
            stored_at: z.iso.datetime({ offset: true }).nullable(),
          }),
        )
        .max(100000),
    })
    .parse(value);
  const raw = value as Record<string, unknown>;
  const reportInput = Object.fromEntries(Object.keys(inputSchema.shape).map((k) => [k, raw[k]]));
  const report = inputSchema.parse(reportInput);
  if (
    Date.parse(snapshot.to_day) - Date.parse(snapshot.from_day) !== 6 * 86400000 ||
    new Set(snapshot.run_ids).size !== snapshot.run_ids.length
  )
    throw invalid();
  // Snapshot run_ids are product parent UUIDs; provider IDs are taken from the
  // authoritative observations. Every media row must belong to those sources.
  const observed = new Set(report.observations.map((o) => o.apify_run_id));
  if (
    report.observations.some((o) => !snapshot.actor_run_ids.includes(o.apify_run_id)) ||
    report.rows.some((r) => !observed.has(r.apify_run_id)) ||
    report.costs.some((c) => !observed.has(c.apify_run_id)) ||
    snapshot.thumbnail_items.some((i) => !observed.has(i.apify_run_id))
  )
    throw invalid();
  const items = new Map<string, (typeof snapshot.thumbnail_items)[number]>();
  for (const item of snapshot.thumbnail_items) {
    const prior = items.get(item.item_id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(item)) throw invalid();
    items.set(item.item_id, item);
  }
  const eligible = [...items.values()].filter((i) => i.eligible);
  const missing = eligible.filter((i) => i.stored_at === null).length;
  const late = eligible.filter(
    (i) => i.stored_at !== null && Date.parse(i.stored_at) > Date.parse(i.first_seen_at) + 6 * 3600000,
  ).length;
  const timely = eligible.length - missing - late;
  return {
    campaign_id: snapshot.campaign_id,
    run_ids: snapshot.run_ids,
    comparison: buildBakeoffReport(report),
    thumbnails: {
      eligible_captured_stories: eligible.length,
      timely,
      missing,
      late,
      failed: missing + late,
      timely_percent: percent(timely, eligible.length),
      ineligible_no_source: items.size - eligible.length,
    },
    discovery_lag_seconds: eligible.map((i) => ({
      item_id: i.item_id,
      seconds: (Date.parse(i.first_seen_at) - Date.parse(i.published_at)) / 1000,
    })),
    final_actor_and_cadence_decision: 'MA-16 owner decision',
  };
}

export function renderBakeoffMarkdown(value: unknown): string {
  const report = buildBakeoffReport(value);
  const cell = (n: number | null) => (n === null ? 'unknown' : String(n));
  return [
    `# Stories comparison ${report.from_day} to ${report.to_day}`,
    '',
    '| Actor | Days | Failed runs | Stories | Coverage % | Thumbnails % | Mentions % | Links % | USD | USD / 1k | Login/cookie prompts | Missing account-days |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...report.actors.map(
      (r) =>
        `| ${r.actor} | ${r.days_run} | ${r.runs_failed} | ${r.stories_found} | ${cell(r.coverage_percent)} | ${cell(r.thumbnail_rate_percent)} | ${cell(r.mentions_rate_percent)} | ${cell(r.link_rate_percent)} | ${cell(r.cost_usd)} | ${cell(r.cost_per_1k_stories_usd)} | ${r.login_cookie_prompts} | ${r.missing_account_days} |`,
    ),
    '',
    `Advisory recommendation: ${report.recommendation ?? 'pending'} (${report.recommendation_reason}). MA-16 remains the owner decision.`,
    '',
    ...report.limitations.map((l) => `- ${l}`),
    '',
  ].join('\n');
}

export function renderCampaignBakeoffMarkdown(value: unknown): string {
  const report = buildCampaignBakeoffReport(value);
  const raw = value as Record<string, unknown>;
  const input = Object.fromEntries(Object.keys(inputSchema.shape).map((k) => [k, raw[k]]));
  return (
    renderBakeoffMarkdown(input) +
    [
      `Campaign: ${report.campaign_id}. Parent run IDs: ${report.run_ids.join(', ') || 'none yet'}.`,
      '',
      `Eligible captured stories: ${report.thumbnails.eligible_captured_stories}; timely within six hours: ${report.thumbnails.timely}; missing: ${report.thumbnails.missing}; late: ${report.thumbnails.late}; failed: ${report.thumbnails.failed}.`,
      'Missing media remains in the denominator. Source discovery lag is reported separately from post-ingestion thumbnail delivery. Earlier fixture/accepted observation runs are excluded.',
      'The actor/cadence recommendation is advisory; MA-16 remains the owner decision.',
      '',
    ].join('\n')
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw invalid();
    const path = resolve(process.argv[2]!);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 5 * 1024 * 1024)
      throw invalid();
    const input: unknown = JSON.parse(readFileSync(path, 'utf8'));
    process.stdout.write(
      input && typeof input === 'object' && 'campaign_id' in input
        ? renderCampaignBakeoffMarkdown(input)
        : renderBakeoffMarkdown(input),
    );
  } catch {
    process.stderr.write('M06_BAKEOFF_INPUT_INVALID\n');
    process.exitCode = 1;
  }
}
