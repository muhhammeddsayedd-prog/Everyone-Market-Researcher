import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkServerIdentity } from 'node:tls';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const host = 'aws-1-eu-central-1.pooler.supabase.com';
const caSha256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const pgPackageSha256 = 'b1e53333a3d0c2c47c49a5cb919d221135dc03145df740925b899bc2baacc435';
const sha = (value) => createHash('sha256').update(value).digest('hex');

// Exact selectors from the approved 27 October incremental packet. The six
// missing UUIDs are deliberately absent: only a fresh catalog result binds them.
export const incrementalSelectors = Object.freeze(
  [
    [
      'C000',
      'vimeo',
      'everyonefilms',
      'https://vimeo.com/everyonefilms',
      '985a57dd-7934-422d-9d18-4e8ca59fc197',
    ],
    [
      'C001',
      'vimeo',
      'goodpeoplefilms',
      'https://vimeo.com/goodpeoplefilms',
      '8fefa9a1-3637-43db-843d-97caa9afcc79',
    ],
    ['C130', 'vimeo', 'bigfootfilmseg', 'https://vimeo.com/bigfootfilmseg', null],
    ['C270', 'vimeo', 'thetalkiesproductionsleb', 'https://vimeo.com/thetalkiesproductionsleb', null],
    ['C226', 'vimeo', 'bigkahunafilms', 'https://vimeo.com/bigkahunafilms', null],
    [
      'C000',
      'instagram',
      'everyone.film',
      'https://www.instagram.com/everyone.film/',
      '962c9c7e-aa0f-46ae-911b-3265859e0577',
    ],
    [
      'C001',
      'instagram',
      'goodpeoplefilms',
      'https://www.instagram.com/goodpeoplefilms/',
      'bed82782-753f-4ba9-91ca-691ef36f75c6',
    ],
    ['C130', 'instagram', 'bigfootfilms', 'https://www.instagram.com/bigfootfilms/', null],
    ['C270', 'instagram', 'thetalkies', 'https://www.instagram.com/thetalkies/', null],
    ['C226', 'instagram', 'bigkahunafilms', 'https://www.instagram.com/bigkahunafilms/', null],
  ].map(([company_code, platform, handle, url, knownId]) =>
    Object.freeze({
      key: `${company_code}:${platform}:0`,
      company_code,
      platform,
      handle,
      url,
      knownId,
    }),
  ),
);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const hc01InstagramIds = Object.freeze({
  C000: '962c9c7e-aa0f-46ae-911b-3265859e0577',
  C001: 'bed82782-753f-4ba9-91ca-691ef36f75c6',
  C130: '46149fb9-8905-4b76-9834-4b38f668a2e2',
  C270: '2d42d451-ac9a-42ac-a879-8760d63c8108',
  C226: '3ca3befa-abe6-4540-a389-0cf16115c581',
});
const hc01Approval = '1cf8406c-1142-445e-a237-6d0fd7a67b22';
const hc01ApprovedAt = '2026-10-28T00:43:24Z';
function queryScope(options = {}) {
  if (!record(options) || !['incremental', 'hc01'].includes(options.scope ?? 'incremental'))
    throw Error('incremental_scope_blocked');
  return options.scope ?? 'incremental';
}
function validHc01Instagram(entry) {
  const a = entry.account;
  return (
    a.platform !== 'instagram' ||
    (a.id === hc01InstagramIds[entry.company_code] &&
      ['pending', 'running'].includes(a.backfill_status) &&
      typeof a.last_external_id === 'string' &&
      a.last_external_id.trim().length > 0 &&
      Number.isFinite(Date.parse(a.last_item_published_at)) &&
      Date.parse(a.last_item_published_at) <= Date.now())
  );
}
function incrementalHistory() {
  const previous = JSON.parse(
    readFileSync(new URL('./m03-foundation-forward-dev-migration-packet.json', import.meta.url), 'utf8'),
  );
  return [
    ...previous.baseline,
    ...previous.pending,
    {
      version: '20261026013910',
      name: 'm04_vimeo_account_resolution',
      historySha256: '9391ae1b1f029e2ea9aa93b812a80b46f9f5abd8fe6245c05da1703bfcf2b56c',
    },
    {
      version: '20261027092832',
      name: 'm04_collector_product_contracts',
      historySha256: '7f036a391743189b3e8031070aa4f18fbd893df7619aab92b02f6a5996b4db7f',
    },
  ].map(({ version, name, historySha256 }) => ({ version, name, historySha256 }));
}

export function buildIncrementalPreflightSql() {
  const values = incrementalSelectors
    .map((s) => '(' + [s.key, s.company_code, s.platform, s.handle, s.url].map(literal).join(',') + ')')
    .join(',\n');
  return `-- Read-only exact incremental catalog binding; no account or schema mutation.
with selectors(key,company_code,platform,handle,url) as (values ${values}),
matched as (select s.key,s.company_code,c.status as competitor_status,a.*
 from selectors s join app.competitors c on c.company_code=s.company_code
 join app.competitor_accounts a on a.competitor_id=c.id and a.platform::text=s.platform
 and a.handle_norm=s.handle and a.url=s.url)
select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),
 'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',
   encode(extensions.digest(array_to_string(statements,E'\\n'),'sha256'),'hex')) order by version),'[]'::jsonb)
   from supabase_migrations.schema_migrations),
 'selectorCounts',(select jsonb_agg(jsonb_build_object('key',s.key,'count',(select count(*) from matched m where m.key=s.key)) order by s.key) from selectors s),
 'accounts',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object(
   'account',to_jsonb(m)-'key'-'company_code'-'competitor_status') order by m.key),'[]'::jsonb) from matched m),
 'selectedCount',(select count(*) from matched),
 'selectedLiveClaims',(select count(*) from matched where locked_until>clock_timestamp()),
 'selectedRunningParents',(select coalesce(jsonb_agg(jsonb_build_object('run_id',r.id,'workflow',r.workflow,'execution_id',r.n8n_execution_id)),'[]'::jsonb)
   from ops.scrape_runs r where r.status='running' and exists(select 1 from matched m where m.last_run_id=r.id)),
 'selectedUnprocessedActors',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',r.apify_run_id,'run_id',r.run_id,'status',r.status)),'[]'::jsonb)
   from ops.apify_runs r where r.processed_at is null and exists(select 1 from matched m where m.id=any(r.account_ids))),
 'priceBook',(select coalesce(jsonb_agg(to_jsonb(p) order by p.provider,p.sku,p.valid_from),'[]'::jsonb) from ops.price_book p
   where p.provider='vimeo' or (p.provider='apify' and (p.sku like 'apify/instagram-scraper:%' or p.sku like 'goat255/vimeo-scraper%'))),
 'globalUnfinished',jsonb_build_object('liveClaims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
   'runningParents',(select count(*) from ops.scrape_runs where status='running'),
   'unprocessedActors',(select count(*) from ops.apify_runs where processed_at is null)),
 'm04ProductTablesPresent',to_regclass('ops.collector_runs') is not null and to_regclass('ops.collector_accounts') is not null and to_regclass('ops.collector_passes') is not null and to_regclass('ops.collector_launches') is not null,
 'baseline',jsonb_build_object('competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),
   'items',(select count(*) from app.items),'rawItems',(select count(*) from ingest.raw_items),
   'costRows',(select count(*) from ops.cost_ledger),'costUsd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger))) as incremental_preflight;\n`;
}

export function bindIncrementalAccounts(preflight, options = {}) {
  const scope = queryScope(options);
  const history = incrementalHistory();
  if (
    !record(preflight) ||
    preflight.current_user !== 'postgres' ||
    preflight.session_user !== 'postgres' ||
    preflight.database !== 'postgres' ||
    !Array.isArray(preflight.migrations) ||
    preflight.migrations.length !== (scope === 'hc01' ? 18 : 17) ||
    preflight.migrations.some(
      (row, index) =>
        !record(row) ||
        (index < 17
          ? ['version', 'name', 'historySha256'].some((key) => row[key] !== history[index][key])
          : row.version !== '20261027192743' ||
            row.name !== 'm04_recent_instagram_dev_eligibility' ||
            !/^[0-9a-f]{64}$/.test(row.historySha256 ?? '')),
    ) ||
    !Array.isArray(preflight.selectorCounts) ||
    preflight.selectorCounts.length !== 10 ||
    !Array.isArray(preflight.accounts) ||
    preflight.accounts.length !== 10 ||
    preflight.m04ProductTablesPresent !== true ||
    preflight.selectedCount !== 10 ||
    preflight.selectedLiveClaims !== 0 ||
    !Array.isArray(preflight.selectedRunningParents) ||
    preflight.selectedRunningParents.length ||
    !Array.isArray(preflight.selectedUnprocessedActors) ||
    preflight.selectedUnprocessedActors.length ||
    !record(preflight.globalUnfinished) ||
    ['liveClaims', 'runningParents', 'unprocessedActors'].some((key) => preflight.globalUnfinished[key] !== 0)
  )
    throw Error('incremental_preflight_blocked');
  const ids = new Set(),
    owners = new Map();
  const result = incrementalSelectors.map((selector) => {
    const counts = preflight.selectorCounts.filter((value) => value.key === selector.key);
    const rows = preflight.accounts.filter((value) => value.key === selector.key);
    if (counts.length !== 1 || counts[0].count !== 1 || rows.length !== 1)
      throw Error('incremental_selection_blocked');
    const entry = rows[0],
      account = entry.account;
    if (
      !record(account) ||
      !uuid.test(account.id ?? '') ||
      !uuid.test(account.competitor_id ?? '') ||
      ids.has(account.id) ||
      (selector.knownId && account.id !== selector.knownId) ||
      entry.company_code !== selector.company_code ||
      entry.competitor_status !== 'active' ||
      account.status !== 'active' ||
      account.platform !== selector.platform ||
      account.handle_norm !== selector.handle ||
      account.handle?.toLowerCase() !== selector.handle ||
      account.url !== selector.url ||
      account.backfill_from !== '2024-01-01' ||
      account.locked_until !== null ||
      typeof account.updated_at !== 'string' ||
      !Number.isFinite(Date.parse(account.updated_at)) ||
      (owners.has(selector.company_code) && owners.get(selector.company_code) !== account.competitor_id) ||
      (scope === 'hc01' && !validHc01Instagram(entry))
    )
      throw Error('incremental_selection_blocked');
    ids.add(account.id);
    owners.set(selector.company_code, account.competitor_id);
    return structuredClone(entry);
  });
  return result;
}

const incrementalApproval = '123e88b6-5920-4e54-832a-ad6d87c22675';
const incrementalApprovedAt = '2026-10-27T15:24:25.740Z';
function selectedEntry(entry, options = {}) {
  const scope = queryScope(options);
  const selector = incrementalSelectors.find((s) => s.key === entry?.key),
    a = entry?.account;
  if (
    !selector ||
    !record(a) ||
    !uuid.test(a.id ?? '') ||
    !uuid.test(a.competitor_id ?? '') ||
    (selector.knownId && selector.knownId !== a.id) ||
    entry.company_code !== selector.company_code ||
    a.platform !== selector.platform ||
    a.handle_norm !== selector.handle ||
    a.url !== selector.url ||
    a.locked_until !== null ||
    !['pending', 'running', 'done', 'not_applicable'].includes(a.backfill_status) ||
    typeof a.next_due_at !== 'string' ||
    !Number.isFinite(Date.parse(a.next_due_at)) ||
    (scope === 'hc01' && !validHc01Instagram(entry))
  )
    throw Error('incremental_selection_blocked');
  return selector;
}
function sqlJson(value) {
  const json = JSON.stringify(value),
    delimiter = '$m04_' + sha(json).slice(0, 16) + '$';
  if (json.includes(delimiter) || json.length > 90000) throw Error('incremental_snapshot_blocked');
  return delimiter + json + delimiter + '::jsonb';
}
function operationalSql(changes, label, options = {}) {
  const scope = queryScope(options);
  const approval = scope === 'hc01' ? hc01Approval : incrementalApproval;
  const approvedAt = scope === 'hc01' ? hc01ApprovedAt : incrementalApprovedAt;
  if (
    !changes.length ||
    changes.length > 10 ||
    new Set(changes.map((e) => e.account.id)).size !== changes.length
  )
    throw Error('incremental_snapshot_blocked');
  for (const entry of changes) {
    selectedEntry(entry, options);
    if (
      scope === 'hc01' &&
      ((entry.account.platform !== 'instagram' && entry.key !== 'C000:vimeo:0') ||
        !record(entry.selection) ||
        Object.keys(entry.selection).some((key) => !['next_due_at', 'backfill_cursor'].includes(key)) ||
        (Object.hasOwn(entry.selection, 'backfill_cursor') &&
          (entry.key !== 'C000:vimeo:0' || entry.accepted_vimeo_parent !== true)))
    )
      throw Error('incremental_snapshot_blocked');
    if (
      entry.owner &&
      (!uuid.test(entry.owner.run_id ?? '') || !/^\d{1,15}$/.test(entry.owner.execution_id ?? ''))
    )
      throw Error('incremental_owner_blocked');
  }
  return `-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=${sqlJson(changes)}; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 ${
   scope === 'hc01'
     ? `if exists(select 1 from app.competitor_accounts where locked_until>clock_timestamp())
  or exists(select 1 from ops.scrape_runs where status='running')
  or exists(select 1 from ops.apify_runs where processed_at is null) then
  raise exception using errcode='55000',message='M04 HC01 global unfinished work changed';
 end if;`
     : ''
 }
 perform 1 from ops.scrape_runs where id in (select coalesce(x->'owner'->>'run_id',x->'account'->>'last_run_id')::uuid from jsonb_array_elements(entries) x) order by id for update;
 perform 1 from app.competitors where id in (select (x->'account'->>'competitor_id')::uuid from jsonb_array_elements(entries) x) order by id for share;
 for e in select x from jsonb_array_elements(entries) x order by x->'account'->>'id' loop
  select * into a from app.competitor_accounts where id=(e->'account'->>'id')::uuid for update;
  if not found or to_jsonb(a) is distinct from e->'account' or a.locked_until is not null
   or not exists(select 1 from app.competitors c where c.id=a.competitor_id and c.company_code=e->>'company_code' and c.status='active')
   or exists(select 1 from ops.collector_accounts ca join ops.scrape_runs p on p.id=ca.run_id where ca.account_id=a.id and p.status='running')
   or exists(select 1 from ops.apify_runs p where p.processed_at is null and a.id=any(p.account_ids)) then
   raise exception using errcode='55000',message='M04 incremental account snapshot or unfinished work changed';
  end if;
  if e ? 'setup_account' and (to_jsonb(a) is distinct from e->'setup_account'
   or a.last_run_id is distinct from (e->>'baseline_run_id')::uuid) then
   raise exception using errcode='55000',message='M04 incremental unstarted setup ownership changed';
  end if;
  if e ? 'owner' then
   select * into r from ops.scrape_runs where id=(e->'owner'->>'run_id')::uuid;
   if not found or r.env<>'dev' or r.started_at<${literal(approvedAt)}::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>${literal(approval)}::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  ${
    scope === 'hc01'
      ? `if e ? 'accepted_vimeo_parent' then
   select * into r from ops.scrape_runs where id='74fae456-a34c-4460-a5ea-6ab66ecec431'::uuid;
   if not found or r.env<>'dev' or r.workflow<>'WF-10' or r.platform<>'vimeo' or r.mode<>'backfill'
    or r.status<>'success' or r.finished_at is null or r.n8n_execution_id<>'31176' or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id and status='success')
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id)
    or exists(select 1 from ops.apify_runs where run_id=r.id) then
    raise exception using errcode='55000',message='M04 HC01 accepted Vimeo parent ownership or closure changed';
   end if;
  end if;`
      : ''
  }
  update app.competitor_accounts set
   ${scope === 'hc01' ? '' : "backfill_status=coalesce((e->'selection'->>'backfill_status')::app.backfill_status,a.backfill_status),"}
   ${scope === 'hc01' && !changes.some((entry) => Object.hasOwn(entry.selection, 'backfill_cursor')) ? '' : "backfill_cursor=case when e->'selection' ? 'backfill_cursor' then nullif(e->'selection'->'backfill_cursor','null'::jsonb) else a.backfill_cursor end,"}
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation',${literal(label)},'preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements(${sqlJson(changes)}) x))) as incremental_operational;\n`;
}

function acceptedHc01VimeoCursor(entry) {
  const receipt = (file) => {
    const saved = JSON.parse(
      readFileSync(
        new URL('../../milestones/M04-collectors-vimeo-instagram/evidence/' + file, import.meta.url),
        'utf8',
      ),
    );
    if (
      saved.status !== 'reviewed_query_complete' ||
      saved.environment !== 'dev' ||
      saved.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      saved.databaseClientClosed !== true ||
      saved.lastNativeExit !== 0
    )
      throw Error('incremental_accepted_cursor_blocked');
    return saved;
  };
  const saved = receipt('incremental-vimeo-pair-settled-20261027.json').queryResult?.[0]
    ?.incremental_assertions;
  const final = receipt('incremental-final-readback-20261027.json').queryResult?.[0]?.incremental_preflight;
  const prior = saved?.accounts?.find((a) => a.id === entry.account.id);
  const restored = final?.accounts?.find((e) => e.key === entry.key)?.account;
  const run = saved?.runs?.find(
    (r) =>
      r.id === '74fae456-a34c-4460-a5ea-6ab66ecec431' &&
      r.n8n_execution_id === '31176' &&
      r.env === 'dev' &&
      r.workflow === 'WF-10' &&
      r.platform === 'vimeo' &&
      r.mode === 'backfill' &&
      r.status === 'success' &&
      Number.isFinite(Date.parse(r.finished_at)),
  );
  const expectedCursor = (cursor) =>
    record(cursor) &&
    Object.keys(cursor).length === 4 &&
    cursor.page === 4 &&
    cursor.page_size === 5 &&
    cursor.endpoint === 'users' &&
    cursor.resourcePath === '/users/157330576';
  if (
    !run ||
    prior?.last_run_id !== run.id ||
    !expectedCursor(prior?.backfill_cursor) ||
    restored?.last_run_id !== run.id ||
    restored.external_id !== '157330576' ||
    entry.account.last_run_id !== run.id ||
    entry.account.external_id !== '157330576' ||
    !['pending', 'running'].includes(entry.account.backfill_status) ||
    (entry.account.backfill_cursor !== null && !expectedCursor(entry.account.backfill_cursor))
  )
    throw Error('incremental_accepted_cursor_blocked');
  return structuredClone(prior.backfill_cursor);
}

export function buildIncrementalSetupSql(bound, cohort, options = {}) {
  const scope = queryScope(options);
  if (scope === 'hc01') {
    if (!Array.isArray(bound) || bound.length !== 10 || new Set(bound.map((e) => e.key)).size !== 10)
      throw Error('incremental_snapshot_blocked');
    bound.forEach((entry) => selectedEntry(entry, options));
    const keys =
      cohort === 'first-instagram'
        ? ['C000:instagram:0']
        : cohort === 'remaining-instagram'
          ? incrementalSelectors
              .filter((s) => s.platform === 'instagram' && s.company_code !== 'C000')
              .map((s) => s.key)
          : cohort === 'vimeo-continuation'
            ? ['C000:vimeo:0']
            : null;
    if (!keys) throw Error('incremental_cohort_blocked');
    const changes = keys.map((key) => {
      const entry = bound.find((e) => e.key === key);
      if (!entry || entry.account.status !== 'active') throw Error('incremental_selection_blocked');
      return {
        key,
        company_code: entry.company_code,
        account: entry.account,
        ...(cohort === 'vimeo-continuation' ? { accepted_vimeo_parent: true } : {}),
        selection: cohort === 'vimeo-continuation' ? { backfill_cursor: acceptedHc01VimeoCursor(entry) } : {},
      };
    });
    return operationalSql(changes, 'hc01-setup-' + cohort, options);
  }
  const keys =
    cohort === 'new-vimeo'
      ? incrementalSelectors.filter((s) => s.platform === 'vimeo' && !s.knownId).map((s) => s.key)
      : cohort === 'instagram-history'
        ? incrementalSelectors.filter((s) => s.platform === 'instagram').map((s) => s.key)
        : cohort === 'accepted-vimeo'
          ? ['C000:vimeo:0', 'C001:vimeo:0']
          : null;
  if (!keys || !Array.isArray(bound)) throw Error('incremental_cohort_blocked');
  const changes = keys.map((key) => {
    const matches = bound.filter((e) => e.key === key);
    if (matches.length !== 1 || matches[0].account.status !== 'active')
      throw Error('incremental_selection_blocked');
    const entry = matches[0];
    selectedEntry(entry);
    let cursor = null;
    if (cohort === 'accepted-vimeo') {
      // Actual first sample recorded page2; the approved packet explicitly
      // binds its historical page width5. Never reuse this page at width20.
      const saved = JSON.parse(
        readFileSync(
          new URL(
            '../../milestones/M04-collectors-vimeo-instagram/evidence/live-vimeo-first-assertions-20261027.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const source = saved.queryResult?.[0]?.collector_assertions;
      const prior = source?.accounts?.find((a) => a.id === entry.account.id);
      const run = source?.runs?.find(
        (r) =>
          r.id === 'f77352da-6efb-4d33-bacb-2e2f8826dd37' &&
          r.n8n_execution_id === '31158' &&
          r.status === 'success' &&
          r.env === 'dev' &&
          r.mode === 'backfill',
      );
      if (
        !run ||
        prior?.last_run_id !== run.id ||
        prior.backfill_cursor?.page !== 2 ||
        prior.backfill_cursor?.endpoint !== 'users' ||
        prior.backfill_cursor?.resourcePath !== '/users/' + entry.account.external_id
      )
        throw Error('incremental_accepted_cursor_blocked');
      cursor = { ...prior.backfill_cursor, page_size: 5 };
    }
    return {
      key,
      company_code: entry.company_code,
      account: entry.account,
      selection: { backfill_status: 'pending', backfill_cursor: cursor },
    };
  });
  return operationalSql(changes, 'setup-' + cohort);
}

export function buildIncrementalResumeSql(entry, owner, mode, options = {}) {
  const scope = queryScope(options);
  const selector = selectedEntry(entry, options),
    a = entry.account;
  if (!['vimeo-cursor', 'daily-due'].includes(mode) || a.status !== 'active')
    throw Error('incremental_resume_blocked');
  if (scope === 'hc01' && mode !== 'daily-due') throw Error('incremental_resume_blocked');
  if (
    mode === 'vimeo-cursor' &&
    (selector.platform !== 'vimeo' ||
      selector.knownId ||
      a.backfill_status !== 'running' ||
      !Number.isSafeInteger(a.backfill_cursor?.page) ||
      a.backfill_cursor.page < 2 ||
      a.backfill_cursor.page_size !== 20 ||
      a.backfill_cursor.endpoint !== 'users' ||
      a.backfill_cursor.resourcePath !== '/users/' + a.external_id)
  )
    throw Error('incremental_resume_blocked');
  if (
    mode === 'daily-due' &&
    (scope === 'hc01'
      ? selector.platform !== 'instagram' || !validHc01Instagram(entry)
      : !['done', 'not_applicable'].includes(a.backfill_status) ||
        !Number.isFinite(Date.parse(a.last_item_published_at)))
  )
    throw Error('incremental_daily_ineligible');
  if (!owner) throw Error('incremental_owner_blocked');
  return operationalSql(
    [{ key: entry.key, company_code: entry.company_code, account: a, owner, selection: {} }],
    mode,
    options,
  );
}

export function buildIncrementalRestoreSql(baseline, finalEntries, options = {}) {
  const scope = queryScope(options);
  if (!Array.isArray(baseline) || !Array.isArray(finalEntries)) throw Error('incremental_snapshot_blocked');
  const changes = finalEntries.map((current) => {
    const originals = baseline.filter((e) => e.key === current.key && e.account.id === current.account?.id);
    if (originals.length !== 1) throw Error('incremental_owner_blocked');
    const original = originals[0];
    selectedEntry(original, options);
    selectedEntry(current, options);
    if (
      !current.owner &&
      (!record(current.setup_account) ||
        current.setup_account.id !== current.account.id ||
        current.account.last_run_id !== original.account.last_run_id)
    )
      throw Error('incremental_owner_blocked');
    return {
      key: current.key,
      company_code: current.company_code,
      account: current.account,
      owner: current.owner,
      ...(!current.owner
        ? { setup_account: current.setup_account, baseline_run_id: original.account.last_run_id }
        : {}),
      selection: {
        ...(scope === 'hc01'
          ? {}
          : {
              backfill_status: original.account.backfill_status,
              backfill_cursor: original.account.backfill_cursor,
            }),
        next_due_at: original.account.next_due_at,
      },
    };
  });
  return operationalSql(changes, 'restore-operational-selection', options);
}

export function buildIncrementalAssertionsSql(bound, parents = [], options = {}) {
  const scope = queryScope(options);
  const approval = scope === 'hc01' ? hc01Approval : incrementalApproval;
  if (
    !Array.isArray(bound) ||
    bound.length !== 10 ||
    !Array.isArray(parents) ||
    parents.length > 8 ||
    new Set(parents.map((p) => p.run_id)).size !== parents.length ||
    parents.some((p) => !uuid.test(p.run_id ?? '') || !/^\d{1,15}$/.test(p.execution_id ?? ''))
  )
    throw Error('incremental_owner_blocked');
  bound.forEach((entry) => selectedEntry(entry, options));
  const ids = bound.map((e) => e.account.id);
  if (new Set(ids).size !== 10) throw Error('incremental_selection_blocked');
  return `-- Read-only owned parent, account, metrics, queue and actual-cost projection.
with parents as (select (x->>'run_id')::uuid run_id,x->>'execution_id' execution_id from jsonb_array_elements(${sqlJson(parents)}) x),
selected as (select * from app.competitor_accounts where id in (select x::uuid from jsonb_array_elements_text(${sqlJson(ids)}) x)),
items as (select i.id,i.account_id,i.platform,i.external_id,i.status,i.ai_status,i.duplicate_of,i.published_at,i.metrics,i.metrics_updated_at,i.locked_fields,i.last_extraction_id,i.created_at
 from app.items i where i.account_id in (select id from selected))
select jsonb_build_object('accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from selected a),
 'runs',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('expected_execution_id',p.execution_id) order by r.started_at),'[]'::jsonb) from ops.scrape_runs r join parents p on p.run_id=r.id),
 'accountResults',(select coalesce(jsonb_agg(to_jsonb(a) order by a.run_id,a.account_id),'[]'::jsonb) from ops.scrape_run_accounts a where run_id in (select run_id from parents)),
 'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from items i),
 'rawItems',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'account_id',r.account_id,'run_id',r.run_id,'actor',r.actor,'external_id',r.external_id,'fetched_at',r.fetched_at) order by r.id),'[]'::jsonb)
   from ingest.raw_items r where r.account_id in (select id from selected)),
 'costs',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'provider',c.provider,'quantity',c.quantity,'cost_usd',c.cost_usd,'run_id',c.run_id,'apify_run_id',c.meta->>'apify_run_id') order by c.id),'[]'::jsonb)
   from ops.cost_ledger c where c.run_id in (select run_id from parents)),
 'actorRuns',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',a.apify_run_id,'run_id',a.run_id,'actor_id',a.actor_id,'account_ids',a.account_ids,'status',a.status,'usage_usd',a.usage_usd,'processed_at',a.processed_at) order by a.apify_run_id),'[]'::jsonb)
   from ops.apify_runs a where a.run_id in (select run_id from parents)),
 'launches',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb) from ops.collector_launches l where l.approval_id=${literal(approval)}::uuid),
 'passes',(select coalesce(jsonb_agg(to_jsonb(p) order by p.run_id,p.account_id,p.pass),'[]'::jsonb) from ops.collector_passes p where p.run_id in (select run_id from parents)),
 'collectorRuns',(select coalesce(jsonb_agg(to_jsonb(r) order by r.run_id),'[]'::jsonb) from ops.collector_runs r where r.run_id in (select run_id from parents)),
 'aiQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',(select count(*) from pgmq.q_ai_extract q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
 'mediaQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',(select count(*) from pgmq.q_media q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
 'duplicateExternalIds',(select count(*) from (select platform,external_id from items group by platform,external_id having count(*)>1) d),
 'selectedLiveClaims',(select count(*) from selected where locked_until is not null),
 'selectedRunningParents',(select count(*) from ops.scrape_runs r where r.id in (select run_id from parents) and r.status='running'),
 'selectedUnprocessedActors',(select count(*) from ops.apify_runs a where a.processed_at is null and exists(select 1 from selected s where s.id=any(a.account_ids)))) as incremental_assertions;\n`;
}

export function buildIncrementalObservationSql(bound, options = {}) {
  const scope = queryScope(options);
  const approvalId = scope === 'hc01' ? hc01Approval : incrementalApproval;
  const approval = JSON.parse(
    readFileSync(
      new URL(
        '../../milestones/M04-collectors-vimeo-instagram/evidence/' +
          (scope === 'hc01' ? 'hc01-dev-approval-20261028.json' : 'incremental-dev-approval-20261027.json'),
        import.meta.url,
      ),
      'utf8',
    ),
  );
  if (
    approval.approval_id !== approvalId ||
    approval.environment !== 'dev' ||
    approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    !Number.isFinite(Date.parse(scope === 'hc01' ? approval.recordedAt : approval.approvedAt))
  )
    throw Error('incremental_owner_blocked');
  const exact = buildIncrementalAssertionsSql(bound, [], options);
  // Discovery is a readback, never a restoration ownership permit. The owner
  // must correlate returned native execution IDs to the actual clicked runs.
  const discovery = `parents as (select r.id run_id,r.n8n_execution_id execution_id from ops.scrape_runs r
 where r.env='dev' and r.workflow in ('WF-10','WF-11') and r.started_at>=${literal(scope === 'hc01' ? approval.recordedAt : approval.approvedAt)}::timestamptz
 and (exists(select 1 from ops.collector_launches l where l.run_id=r.id and l.approval_id=${literal(approvalId)}::uuid)
 or (r.workflow='WF-10' and exists(select 1 from ops.collector_accounts ca where ca.run_id=r.id)
 and not exists(select 1 from ops.collector_accounts ca where ca.run_id=r.id and ca.account_id not in
 (select x::uuid from jsonb_array_elements_text(${sqlJson(bound.map((e) => e.account.id))}) x))))),`;
  return exact.replace(
    /parents as \(select \(x->>'run_id'\)[\s\S]*?\),\nselected as /,
    discovery + '\nselected as ',
  );
}

function regularFile(path, maximum) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximum)
    throw Error('query_input_blocked');
  for (let parent = dirname(absolute); ; parent = dirname(parent)) {
    const entry = lstatSync(parent);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error('query_input_blocked');
    if (parent === parse(parent).root) break;
  }
  return absolute;
}

export function strictAdminConfig(password, ca) {
  if (typeof password !== 'string' || !password || sha(ca) !== caSha256) throw Error('query_config_blocked');
  return {
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres.zmotjsbzhzjvpelxvxlf',
    password,
    application_name: 'emr-m04-admin-query',
    connectionTimeoutMillis: 5000,
    query_timeout: 28000,
    statement_timeout: 25000,
    ssl: { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: host, checkServerIdentity },
  };
}

// A text-only query uses pg's native simple protocol, including all transaction
// statements on this one connection. No spawned process, URL or host override.
export async function executeSimpleQuery(client, sql, timeoutMs = 30000) {
  let timer;
  let closed = false;
  let rows = [];
  let sqlstate = null;
  let status = 'query_failed';
  const ignorePrivateError = () => {};
  client.on('error', ignorePrivateError);
  try {
    const work = (async () => {
      await client.connect();
      const result = await client.query(sql);
      return (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.rows ?? []);
    })();
    const result = await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('query_deadline')), timeoutMs);
      }),
    ]);
    if (Buffer.byteLength(JSON.stringify(result)) > 1048576) throw Error('query_output_bound');
    rows = result;
    status = 'query_complete';
  } catch (error) {
    sqlstate = typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
  } finally {
    clearTimeout(timer);
    let closeTimer;
    try {
      closed = await Promise.race([
        Promise.resolve()
          .then(() => client.end())
          .then(
            () => true,
            () => false,
          ),
        new Promise((resolveClosed) => {
          closeTimer = setTimeout(() => resolveClosed(false), 3000);
        }),
      ]);
    } finally {
      clearTimeout(closeTimer);
      try {
        if (!closed) client.connection?.stream?.destroy();
      } catch {
        /* Fixed closure result below. */
      }
      client.password = undefined;
      if (client.connectionParameters) client.connectionParameters.password = undefined;
    }
  }
  if (!closed) return { status: 'query_closure_unverified', sqlstate, clientClosed: false, rows: [] };
  return { status, sqlstate, clientClosed: true, rows };
}

async function main(args) {
  let password;
  try {
    if (args.length !== 2 || !/^[a-f0-9]{64}$/.test(args[1])) throw Error('query_input_blocked');
    const sqlPath = regularFile(args[0], 140000);
    if (basename(sqlPath) !== 'reviewed.sql' || !/^emr-m04-db-[a-f0-9]{32}$/.test(basename(dirname(sqlPath))))
      throw Error('query_input_blocked');
    const sql = readFileSync(sqlPath);
    if (sha(sql) !== args[1] || /__M04_[A-Z0-9_]+__/.test(sql.toString('utf8')))
      throw Error('query_input_blocked');
    const packagePath = resolve(repo, 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/package.json');
    const packageBytes = readFileSync(packagePath);
    if (sha(packageBytes) !== pgPackageSha256 || JSON.parse(packageBytes).version !== '8.23.1')
      throw Error('query_driver_blocked');
    const ca = readFileSync(regularFile(resolve(repo, 'scripts/seed/certs/supabase-root-2021.crt'), 65536));
    password = process.env.PGPASSWORD;
    delete process.env.PGPASSWORD;
    const config = strictAdminConfig(password, ca);
    password = undefined;
    const { Client } = createRequire(import.meta.url)(dirname(packagePath));
    const client = new Client(config);
    config.password = undefined;
    return await executeSimpleQuery(client, sql.toString('utf8'));
  } catch {
    return { status: 'query_input_blocked', sqlstate: null, clientClosed: true, rows: [] };
  } finally {
    password = undefined;
    delete process.env.PGPASSWORD;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Controlled failures are structured protocol results. Native exit0 means the
  // protocol child completed; the PowerShell caller must verify status too.
  const result = await main(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
}
