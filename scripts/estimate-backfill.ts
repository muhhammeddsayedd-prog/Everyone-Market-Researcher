// Offline explicit-count estimate only. This neither establishes history
// coverage nor grants spending authority. Supply dated projected price-book
// rows; no credential, provider, network or database access occurs here.
import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';

const count = z.number().int().nonnegative().max(1_000_000);
const usd = z.number().nonnegative().max(1_000_000_000).nullable();
const rateSpecs = {
  website_cu: {
    provider: 'apify',
    sku: 'apify/website-content-crawler:cu',
    unit: 'compute unit',
    divisor: 1,
  },
  post_result: {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-posts:post',
    unit: '1k posts',
    divisor: 1000,
  },
  post_start: { provider: 'apify', sku: 'harvestapi/linkedin-company-posts:start', unit: 'run', divisor: 1 },
  post_empty: {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-posts:empty_query',
    unit: '1k queries',
    divisor: 1000,
  },
  employee_profile: {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-employees:short_profile',
    unit: '1k profiles',
    divisor: 1000,
  },
  employee_query: {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-employees:query_start',
    unit: '1k queries',
    divisor: 1000,
  },
  firecrawl: { provider: 'firecrawl', sku: 'credit', unit: 'credit', divisor: 1 },
} as const;
type RateKey = keyof typeof rateSpecs;

const priceRow = z
  .strictObject({
    provider: z.enum(['apify', 'firecrawl']),
    sku: z.string().min(1).max(200),
    unit: z.string().min(1).max(50),
    usd_per_unit: usd,
    valid_from: z.iso.date(),
  })
  .superRefine((row, ctx) => {
    const spec = Object.values(rateSpecs).find((s) => s.sku === row.sku);
    if (!spec || spec.provider !== row.provider || spec.unit !== row.unit)
      ctx.addIssue({ code: 'custom', message: 'unsupported price unit' });
  });
const planSchema = z
  .strictObject({
    website: z.strictObject({ primary_starts: count, adaptive_starts: count }),
    linkedin_posts: z.strictObject({
      planned_starts: count,
      results_per_start: count.max(1000),
      start_events: count,
      empty_query_events: count,
    }),
    linkedin_employees: z.strictObject({ planned_starts: count, profiles_per_start: count.max(200) }),
    recovery_actor_starts: count,
    firecrawl: z.strictObject({ planned_maps: count, recovery_maps: count }),
    youtube: z.strictObject({
      planned_quota_units: count,
      resolution_quota_units: count,
      recovery_quota_units: count,
    }),
  })
  .superRefine((plan, ctx) => {
    if (
      plan.website.adaptive_starts > plan.website.primary_starts ||
      plan.linkedin_posts.start_events > plan.linkedin_posts.planned_starts ||
      plan.linkedin_posts.empty_query_events > plan.linkedin_posts.planned_starts
    )
      ctx.addIssue({ code: 'custom', message: 'impossible event bound' });
  });
const inputSchema = z.strictObject({
  plan: planSchema,
  price_book: z
    .strictObject({ as_of: z.iso.date(), rows: z.array(priceRow).max(1000) })
    .superRefine((book, ctx) => {
      const keys = book.rows.map((r) => [r.provider, r.sku, r.valid_from].join(':'));
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({ code: 'custom', message: 'duplicate dated price' });
    }),
  provider_extras_usd: z.strictObject({ website_proxy: usd, website_storage: usd, website_transfer: usd }),
  infrastructure_usd: z.strictObject({ vercel: usd, n8n: usd, supabase: usd }),
});

/** Proposed M05 packet counts, not an approval or a prediction. The recovery
 * starts are ONE shared LinkedIn reserve, never two reserves per source. */
export const m05RepresentativePlan: z.input<typeof planSchema> = {
  website: { primary_starts: 2, adaptive_starts: 2 },
  linkedin_posts: { planned_starts: 4, results_per_start: 20, start_events: 4, empty_query_events: 4 },
  linkedin_employees: { planned_starts: 2, profiles_per_start: 20 },
  recovery_actor_starts: 2,
  firecrawl: { planned_maps: 4, recovery_maps: 2 },
  youtube: { planned_quota_units: 16, resolution_quota_units: 4, recovery_quota_units: 8 },
};

type Quote = number | null;
type Price = z.output<typeof priceRow> | null;
function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
    throw Error('M05_ESTIMATE_INPUT_INVALID');
  if (value === 0) return 0;
  // Upward micro-USD quote rounding, removing only floating multiplication noise.
  return Math.ceil(value * 1_000_000 - 0.0000001) / 1_000_000;
}
function knownSum(values: Quote[]): number {
  const micro = values.reduce<number>((sum, v) => sum + (v === null ? 0 : Math.round(v * 1_000_000)), 0);
  if (!Number.isSafeInteger(micro) || micro > 1_000_000_000_000_000)
    throw Error('M05_ESTIMATE_INPUT_INVALID');
  return micro / 1_000_000;
}
function completeSum(values: Quote[]): Quote {
  return values.includes(null) ? null : knownSum(values);
}
function charge(quantity: number, price: Price, divisor: number): Quote {
  if (quantity === 0) return 0; // No operation is distinct from a claimed free rate.
  return price?.usd_per_unit == null ? null : roundUsd((quantity / divisor) * price.usd_per_unit);
}

export function estimateM05Backfill(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw Error('M05_ESTIMATE_INPUT_INVALID');
  const {
    plan,
    price_book: book,
    provider_extras_usd: extras,
    infrastructure_usd: infrastructure,
  } = parsed.data;
  const price = (key: RateKey): Price => {
    const spec = rateSpecs[key];
    return (
      book.rows
        .filter((r) => r.provider === spec.provider && r.sku === spec.sku && r.valid_from <= book.as_of)
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] ?? null
    );
  };
  const line = (id: string, key: RateKey, planned: number, maximum = planned) => {
    const p = price(key),
      spec = rateSpecs[key];
    return {
      id,
      provider: spec.provider,
      sku: spec.sku,
      unit: spec.unit,
      planned_quantity: planned,
      maximum_quantity: maximum,
      rate_usd_per_unit: p?.usd_per_unit ?? null,
      rate_valid_from: p?.valid_from ?? null,
      planned_usd: charge(planned, p, spec.divisor),
      maximum_usd: charge(maximum, p, spec.divisor),
    };
  };
  const postResults = plan.linkedin_posts.planned_starts * plan.linkedin_posts.results_per_start;
  const employeeProfiles =
    plan.linkedin_employees.planned_starts * plan.linkedin_employees.profiles_per_start;
  const plannedCu = plan.website.primary_starts / 6; // 1024MiB ×600s =one sixth GB-hour/CU.
  const adaptiveCu = plan.website.adaptive_starts / 6;
  const maximumCredits = plan.firecrawl.planned_maps + plan.firecrawl.recovery_maps;
  const maximumQuota =
    plan.youtube.planned_quota_units +
    plan.youtube.resolution_quota_units +
    plan.youtube.recovery_quota_units;
  const lineItems = [
    line('website_primary_compute', 'website_cu', plannedCu),
    line('website_adaptive_compute', 'website_cu', 0, adaptiveCu),
    line('linkedin_post_results', 'post_result', postResults),
    line('linkedin_post_start_events', 'post_start', plan.linkedin_posts.start_events),
    line('linkedin_post_empty_queries', 'post_empty', plan.linkedin_posts.empty_query_events),
    line('linkedin_employee_profiles', 'employee_profile', employeeProfiles),
    line('linkedin_employee_queries', 'employee_query', plan.linkedin_employees.planned_starts),
    line('firecrawl_maps', 'firecrawl', plan.firecrawl.planned_maps, maximumCredits),
    {
      id: 'youtube_quota',
      provider: 'youtube',
      sku: 'official-data-api',
      unit: 'quota unit',
      planned_quantity: plan.youtube.planned_quota_units,
      maximum_quantity: maximumQuota,
      rate_usd_per_unit: 0,
      rate_valid_from: null,
      planned_usd: 0,
      maximum_usd: 0,
    },
  ];
  const recoveryStarts = plan.recovery_actor_starts;
  const recoveryPosts = completeSum([
    charge(recoveryStarts * plan.linkedin_posts.results_per_start, price('post_result'), 1000),
    charge(recoveryStarts, price('post_start'), 1),
    charge(recoveryStarts, price('post_empty'), 1000),
  ]);
  const recoveryEmployees = completeSum([
    charge(recoveryStarts * plan.linkedin_employees.profiles_per_start, price('employee_profile'), 1000),
    charge(recoveryStarts, price('employee_query'), 1000),
  ]);
  // These are mutually exclusive allocations of the SAME recovery starts.
  const recoveryCost =
    recoveryPosts === null || recoveryEmployees === null ? null : Math.max(recoveryPosts, recoveryEmployees);
  const plannedCosts = lineItems.map((x) => x.planned_usd);
  const maximumCosts = [...lineItems.map((x) => x.maximum_usd), recoveryCost];
  const maximumBase = completeSum(maximumCosts);
  const providerTotal = completeSum([maximumBase, ...Object.values(extras)]);
  const infrastructureTotal = completeSum(Object.values(infrastructure));
  const unknownComponents = [
    ...lineItems.filter((x) => x.maximum_usd === null).map((x) => x.id),
    ...(recoveryCost === null ? ['linkedin_shared_recovery'] : []),
    ...Object.entries(extras)
      .filter(([, value]) => value === null)
      .map(([key]) => key),
  ];
  return {
    currency: 'USD',
    quote_kind: 'conservative_event_upper_bound_not_measured_usage',
    history_coverage: 'not_established_by_estimate',
    spending_authority: false,
    price_book_as_of: book.as_of,
    actors: {
      target:
        plan.website.primary_starts +
        plan.linkedin_posts.planned_starts +
        plan.linkedin_employees.planned_starts,
      conditional_adaptive: plan.website.adaptive_starts,
      recovery: recoveryStarts,
      maximum:
        plan.website.primary_starts +
        plan.website.adaptive_starts +
        plan.linkedin_posts.planned_starts +
        plan.linkedin_employees.planned_starts +
        recoveryStarts,
    },
    source_usage: {
      website: {
        memory_mib: 1024,
        timeout_seconds: 600,
        planned_compute_units: plannedCu,
        maximum_compute_units: plannedCu + adaptiveCu,
      },
      firecrawl: { planned_credits: plan.firecrawl.planned_maps, maximum_credits: maximumCredits },
      youtube: { planned_quota_units: plan.youtube.planned_quota_units, maximum_quota_units: maximumQuota },
      linkedin_posts: {
        planned_result_events: postResults,
        planned_start_events: plan.linkedin_posts.start_events,
        possible_empty_query_events: plan.linkedin_posts.empty_query_events,
      },
      linkedin_employees: {
        planned_profile_events: employeeProfiles,
        planned_company_queries: plan.linkedin_employees.planned_starts,
      },
    },
    line_items: lineItems,
    recovery: {
      actor_starts: recoveryStarts,
      linkedin_posts_usd: recoveryPosts,
      linkedin_employees_usd: recoveryEmployees,
      maximum_usd: recoveryCost,
      quote_source:
        recoveryStarts === 0
          ? 'not_used'
          : recoveryCost === null
            ? 'unknown'
            : recoveryEmployees! >= recoveryPosts!
              ? 'linkedin_employees'
              : 'linkedin_posts',
    },
    providers: {
      planned_known_base_usd: knownSum(plannedCosts),
      maximum_known_base_usd: knownSum(maximumCosts),
      planned_base_usd: completeSum(plannedCosts),
      maximum_base_usd: maximumBase,
      maximum_total_usd: providerTotal,
      extra_charges_usd: extras,
      unknown_components: unknownComponents,
    },
    infrastructure: {
      charges_usd: infrastructure,
      known_subtotal_usd: knownSum(Object.values(infrastructure)),
      total_usd: infrastructureTotal,
      unknown_components: Object.entries(infrastructure)
        .filter(([, value]) => value === null)
        .map(([key]) => key),
    },
    combined_maximum_usd: completeSum([providerTotal, infrastructureTotal]),
    limitations: [
      'Counts are supplied explicitly; capped latest pages do not establish full January2024 coverage.',
      'Empty-query events are conservative planning alternatives, not claimed observed billed events.',
      'Website resource ceilings quote compute only; the separate all-model maxTotalChargeUsd API cap requires native acknowledgment and does not replace measured usage.',
      'Dated supplied rates are not a fresh hosted price-book or account-plan verification.',
      'Infrastructure and provider extras are separate; unknown charges remain unknown.',
    ],
  };
}

// Native Node24: node scripts/estimate-backfill.ts <non-secret-input.json>
// Importing the pure function never reads a file or performs any I/O.
if (import.meta.main) {
  try {
    if (process.argv.length !== 3 || !process.argv[2]) throw Error('invalid');
    const path = process.argv[2],
      stat = statSync(path);
    if (!stat.isFile() || stat.size > 1_048_576) throw Error('invalid');
    process.stdout.write(
      JSON.stringify(estimateM05Backfill(JSON.parse(readFileSync(path, 'utf8'))), null, 2) + '\n',
    );
  } catch {
    process.stderr.write('M05_ESTIMATE_INPUT_INVALID\n');
    process.exitCode = 2;
  }
}
