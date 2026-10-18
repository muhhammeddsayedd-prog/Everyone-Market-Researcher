/**
 * Smoke and test fixtures that must never count as business data.
 *
 * The schema has no fixture column yet (requested from the backend track). Until it does,
 * the project's existing fixture identities are: company code C999, used by the dev smoke
 * record (`emr-smoke-test`, M03) and the local CI seed (`test-house`).
 */
export const FIXTURE_COMPANY_CODES = ['C999'] as const;
export const FIXTURE_SLUGS = ['emr-smoke-test', 'test-house'] as const;

export function isFixtureCompany(row: { company_code: string; slug: string }): boolean {
  return (
    (FIXTURE_COMPANY_CODES as readonly string[]).includes(row.company_code) ||
    (FIXTURE_SLUGS as readonly string[]).includes(row.slug)
  );
}

type FilterableQuery<Q> = {
  not(column: string, operator: string, value: string): Q;
};

/** Applies the fixture exclusion to a PostgREST query on app.competitors. */
export function excludeFixtures<Q extends FilterableQuery<Q>>(query: Q): Q {
  return query
    .not('company_code', 'in', `(${FIXTURE_COMPANY_CODES.join(',')})`)
    .not('slug', 'in', `(${FIXTURE_SLUGS.join(',')})`);
}
