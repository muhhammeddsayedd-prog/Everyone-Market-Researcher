// Four-field employee observation projection only; never send these through raw-item ingestion.
// The trusted caller supplies the registered INPUT, never callback-body ownership hints.
const employeeRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const employeeText = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
function employeeCompany(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  const match = /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/company\/([^/?#]+)\/?$/iu.exec(value);
  if (!match) return null;
  let slug;
  try {
    slug = decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return null;
  }
  return /^[\p{L}\p{N}._&+-]{1,160}$/u.test(slug) ? slug : null;
}
function employeePublicId(row) {
  const valid = (value) => typeof value === 'string' && /^[\p{L}\p{N}._-]{1,160}$/u.test(value);
  let fromUrl = null;
  if (row.linkedinUrl !== undefined) {
    if (typeof row.linkedinUrl !== 'string' || /[\s\\\u0000-\u001f\u007f]/u.test(row.linkedinUrl))
      return null;
    const match = /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/([^/?#]+)\/?$/iu.exec(
      row.linkedinUrl.split(/[?#]/, 1)[0],
    );
    try {
      fromUrl = match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
    if (!valid(fromUrl)) return null;
  }
  if (
    row.publicIdentifier !== undefined &&
    row.publicIdentifier !== null &&
    (!valid(row.publicIdentifier) ||
      (fromUrl && fromUrl.toLowerCase() !== row.publicIdentifier.toLowerCase()))
  )
    return null;
  const id = row.publicIdentifier ?? fromUrl;
  return valid(id) ? id.toLowerCase() : null;
}
function employeePerson(row, positionTitle) {
  if (!employeeRecord(row)) return null;
  const publicId = employeePublicId(row);
  if (!publicId) return null;
  const name = [employeeText(row.firstName, 100), employeeText(row.lastName, 100)].filter(Boolean).join(' ');
  if (!name) return null;
  return {
    public_id: publicId,
    name,
    title: employeeText(positionTitle || row.headline),
    location: employeeText(row.location?.linkedinText, 300),
  };
}
function employeePeople(people) {
  if (!Array.isArray(people) || people.length > 200) throw Error('linkedin_employee_snapshot_invalid');
  const ids = new Set();
  return people
    .map((person) => {
      if (
        !employeeRecord(person) ||
        Object.keys(person).sort().join(',') !== 'location,name,public_id,title' ||
        !/^[\p{L}\p{N}._-]{1,160}$/u.test(person.public_id ?? '') ||
        !person.name ||
        ['name', 'title', 'location'].some(
          (key) => typeof person[key] !== 'string' || person[key].length > 500,
        ) ||
        ids.has(person.public_id)
      )
        throw Error('linkedin_employee_snapshot_invalid');
      ids.add(person.public_id);
      return {
        public_id: person.public_id,
        name: person.name,
        title: person.title,
        location: person.location,
      };
    })
    .sort((a, b) => a.public_id.localeCompare(b.public_id));
}
function normalizeLinkedInEmployees(rows, ctx) {
  if (
    !Array.isArray(rows) ||
    rows.length > 10000 ||
    !employeeRecord(ctx) ||
    !Array.isArray(ctx.accounts) ||
    !Array.isArray(ctx.input?.companies) ||
    ctx.input.profileScraperMode !== 'Short ($4 per 1k)' ||
    ctx.input.companyBatchMode !== 'one_by_one' ||
    !Number.isSafeInteger(ctx.input.maxItemsPerCompany) ||
    ctx.input.maxItemsPerCompany < 1 ||
    ctx.input.maxItemsPerCompany > 200 ||
    !Number.isSafeInteger(ctx.input.maxItems) ||
    ctx.input.maxItems < 1
  )
    throw Error('linkedin_employee_context_invalid');
  const targets = ctx.input.companies.map(employeeCompany);
  if (targets.some((slug) => !slug) || new Set(targets).size !== targets.length)
    throw Error('linkedin_employee_context_invalid');
  const bySlug = new Map(),
    configuredCompanyIds = new Map();
  const ids = new Set();
  for (const account of ctx.accounts) {
    const slug = employeeCompany(account?.url),
      id = account?.id ?? account?.account_id;
    if (
      !slug ||
      !targets.includes(slug) ||
      account.platform !== 'linkedin_employees' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? '') ||
      ids.has(id) ||
      bySlug.has(slug) ||
      (account.external_id != null &&
        (typeof account.external_id !== 'string' ||
          !/^[1-9][0-9]{0,19}$/.test(account.external_id) ||
          configuredCompanyIds.has(account.external_id)))
    )
      throw Error('linkedin_employee_context_invalid');
    ids.add(id);
    bySlug.set(slug, { account_id: id, people: new Map(), errors: new Set(), observed: 0 });
    if (account.external_id != null) configuredCompanyIds.set(account.external_id, slug);
  }
  if (bySlug.size !== targets.length) throw Error('linkedin_employee_context_invalid');
  // Numeric company URLs require an already-resolved catalog identity. Never
  // infer this alias from a person's employer name or from the query alone.
  const positionCompany = (value) => {
    const key = employeeCompany(value);
    return configuredCompanyIds.get(key) ?? key;
  };
  let unmatched = 0;
  for (const row of rows) {
    // The retained public Short response uses currentPositions + linkedinUrl;
    // retain the earlier singular example, without inferring a foreign employer.
    const singular = Array.isArray(row?.currentPosition) ? row.currentPosition : null;
    const plural = Array.isArray(row?.currentPositions) ? row.currentPositions : null;
    const conflictingPositions = singular && plural && JSON.stringify(singular) !== JSON.stringify(plural);
    const sourcePositions = plural ?? singular ?? [];
    const positions = sourcePositions.filter((position) => position?.current !== false);
    const unsafePositionHint =
      sourcePositions.some((position) => position?.current === false) ||
      positions.some((position) => {
        const hint = position?.companyLinkedinUrl ?? position?.linkedinUrl;
        return hint !== undefined && !employeeCompany(hint);
      });
    const positionSlugs = positions
      .map((position) => positionCompany(position?.companyLinkedinUrl ?? position?.linkedinUrl))
      .filter(Boolean);
    const matches = [...new Set(positionSlugs.filter((slug) => bySlug.has(slug)))];
    // One attested company query proves query ownership only, not employment or a full roster.
    const slug =
      matches.length === 1
        ? matches[0]
        : matches.length === 0 && targets.length === 1 && positionSlugs.length === 0 && !unsafePositionHint
          ? targets[0]
          : null;
    if (!slug) {
      unmatched++;
      continue;
    }
    const group = bySlug.get(slug);
    group.observed++;
    if (
      conflictingPositions ||
      positions.some(
        (position) =>
          !employeeRecord(position) ||
          (position.current !== undefined && typeof position.current !== 'boolean'),
      )
    ) {
      group.errors.add('linkedin_employee_contract_drift');
      continue;
    }
    if (Object.hasOwn(row ?? {}, 'error')) {
      group.errors.add('linkedin_employee_source_error');
      continue;
    }
    const titles = [
      ...new Set(
        positions
          .filter(
            (position) => positionCompany(position?.companyLinkedinUrl ?? position?.linkedinUrl) === slug,
          )
          .map((position) => employeeText(position.title))
          .filter(Boolean),
      ),
    ];
    const person = employeePerson(row, titles.join('; '));
    if (!person) {
      group.errors.add('linkedin_employee_contract_drift');
      continue;
    }
    const previous = group.people.get(person.public_id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(person))
      group.errors.add('linkedin_employee_conflicting_profile');
    else group.people.set(person.public_id, person);
  }
  return {
    groups: [...bySlug.entries()].map(([slug, group]) => {
      const error =
        [...group.errors][0] ??
        (unmatched
          ? 'linkedin_employee_unmatched_source_rows'
          : group.observed > ctx.input.maxItemsPerCompany || rows.length > ctx.input.maxItems
            ? 'linkedin_employee_result_overflow'
            : null);
      return {
        account_id: group.account_id,
        matchKey: slug,
        status: error ? 'failed' : 'success',
        error,
        people: error
          ? []
          : [...group.people.values()].sort((a, b) => a.public_id.localeCompare(b.public_id)),
        coverage: {
          complete: false,
          capped: group.observed >= ctx.input.maxItemsPerCompany,
          observed_count: group.people.size,
          reason: 'bounded_company_query',
          membership_evidence: 'registered_company_query',
        },
      };
    }),
    unmatched_count: unmatched,
  };
}
function employeeSnapshotDelta(previous, current, coverage = {}) {
  const now = employeePeople(current),
    before = previous === null ? null : employeePeople(previous);
  if (coverage.previousComplete !== true || coverage.currentComplete !== true || !before)
    return { joined: [], left_company: [], comparison_complete: false };
  const currentIds = new Set(now.map((person) => person.public_id)),
    oldIds = new Set(before.map((person) => person.public_id));
  return {
    joined: now.filter((person) => !oldIds.has(person.public_id)),
    left_company: before.filter((person) => !currentIds.has(person.public_id)),
    comparison_complete: true,
  };
}
function employeeSnapshotReplay(existing, candidate) {
  if (
    !employeeRecord(existing) ||
    !employeeRecord(candidate) ||
    existing.account_id !== candidate.account_id ||
    existing.snapshot_date !== candidate.snapshot_date
  )
    throw Error('linkedin_employee_snapshot_identity_changed');
  const before = employeePeople(existing.people),
    after = employeePeople(candidate.people);
  const canonicalCoverage = (coverage) => {
    const allowed = [
      'complete',
      'capped',
      'observed_count',
      'reason',
      'membership_evidence',
      'start_page',
      'page_limit',
    ];
    if (
      !employeeRecord(coverage) ||
      typeof coverage.complete !== 'boolean' ||
      Object.keys(coverage).some(
        (key) => !allowed.includes(key) || !['string', 'number', 'boolean'].includes(typeof coverage[key]),
      )
    )
      throw Error('linkedin_employee_snapshot_invalid');
    return Object.fromEntries(Object.entries(coverage).sort(([a], [b]) => a.localeCompare(b)));
  };
  return {
    state:
      JSON.stringify(before) === JSON.stringify(after) &&
      JSON.stringify(canonicalCoverage(existing.coverage)) ===
        JSON.stringify(canonicalCoverage(candidate.coverage))
        ? 'replayed'
        : 'conflict',
    replace: false,
  };
}

if (typeof module !== 'undefined')
  module.exports = {
    normalizeLinkedInEmployees,
    prepareLinkedInEmployeeResults: normalizeLinkedInEmployees,
    employeeSnapshotDelta,
    employeeSnapshotReplay,
  };
