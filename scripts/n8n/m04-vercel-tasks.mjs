// The approved M04 or scoped M05 dev Preview. Network and accounting come from the
// coordinator's existing native Vercel CLI transport; this file starts no run.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { collectorPolicy, m05RunPolicy } from '../../packages/shared/src/n8n-collector-contracts.ts';
import { parseFoundationPacket } from './foundation-bind.mjs';

const project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const branch = 'm04-collectors-vimeo-instagram',
  org = 'muhhammeddsayedd-prog',
  repository = 'Everyone-Market-Researcher';
const evidence = 'milestones/M04-collectors-vimeo-instagram/evidence';
const envKeys = [
  'ENABLED',
  'COMMIT_SHA',
  'WRITER_PASSWORD',
  'TOKEN_SHA256',
  'APIFY_READ_TOKEN',
  'ACCOUNT_IDS',
  'LIVE_POLICY',
].map((key) => 'EMR_COLLECTORS_' + key);
const paths = {
  project: `/v9/projects/${project}?teamId=${team}`,
  env: `/v10/projects/${project}/env?decrypt=false&teamId=${team}`,
  createEnv: `/v10/projects/${project}/env?teamId=${team}`,
  bypass: `/v1/projects/${project}/protection-bypass?teamId=${team}`,
  deploy: `/v13/deployments?forceNew=1&teamId=${team}`,
  productionBuilds: `/v6/deployments?projectId=${project}&target=production&state=QUEUED,INITIALIZING,BUILDING&limit=100&teamId=${team}`,
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const subset = (state) => state.scope === 'm05-subset';
const branchFor = (state) => (subset(state) ? 'm05-collectors-web-youtube-linkedin' : branch);
const fail = (code = 'RECONCILIATION_REQUIRED') => {
  throw Error('M04_VERCEL_' + code);
};
const read = (repo, name) => JSON.parse(readFileSync(join(repo, evidence, name), 'utf8'));
function currentHead(repo) {
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
      process.env[key] ? [[key, process.env[key]]] : [],
    ),
  );
  const value = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    env,
    windowsHide: true,
    timeout: 5000,
    encoding: 'utf8',
  }).trim();
  if (!/^[a-f0-9]{40}$/.test(value)) fail('SOURCE');
  return value;
}
function projectRecord(dto) {
  if (
    !object(dto) ||
    dto.id !== project ||
    dto.accountId !== team ||
    dto.rootDirectory !== 'apps/web' ||
    dto.nodeVersion !== '24.x' ||
    dto.framework !== 'nextjs' ||
    dto.link?.type !== 'github' ||
    dto.link.org !== org ||
    dto.link.repo !== repository ||
    dto.ssoProtection?.deploymentType !== 'all_except_custom_domains' ||
    !object(dto.protectionBypass)
  )
    fail('PROJECT');
  return dto;
}
function environmentRows(dto) {
  if (!object(dto) || !Array.isArray(dto.envs) || dto.envs.length > 1000 || dto.pagination?.next)
    fail('ENVIRONMENT');
  return dto.envs;
}
function conflicts(rows, selectedBranch = branch) {
  return rows.filter(
    (row) => envKeys.includes(row.key) && (!row.gitBranch || row.gitBranch === selectedBranch),
  );
}
function environmentMetadata(row, comment, selectedBranch = branch) {
  if (
    !object(row) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.id ?? '') ||
    !envKeys.includes(row.key) ||
    row.type !== 'sensitive' ||
    row.gitBranch !== selectedBranch ||
    !isDeepStrictEqual(row.target, ['preview']) ||
    row.comment !== comment ||
    !Number.isFinite(row.createdAt) ||
    !Number.isFinite(row.updatedAt) ||
    row.decrypted === true
  )
    fail('ENVIRONMENT');
  const { id, key, type, target, gitBranch, createdAt, updatedAt } = row;
  return { id, key, type, target, gitBranch, comment, createdAt, updatedAt };
}
function bypassRecord(dto, state, requireDefault = true, partialPatch = false) {
  // Protection PATCH returns its map, not a full Project DTO. The subsequent
  // exact Project GET independently verifies account, repo and protection.
  if (partialPatch) {
    if (!object(dto) || !object(dto.protectionBypass)) fail('BYPASS');
  } else projectRecord(dto);
  const entries = Object.keys(dto.protectionBypass),
    row = dto.protectionBypass[state.protectionBypass];
  if (
    entries.length !== 1 ||
    entries[0] !== state.protectionBypass ||
    !object(row) ||
    row.scope !== 'automation-bypass' ||
    row.note !== state.vercelSetup.comment ||
    !Number.isFinite(row.createdAt) ||
    (requireDefault && Object.hasOwn(row, 'isEnvVar') && row.isEnvVar !== true) ||
    (state.vercelSetup.bypassCreatedAt !== undefined && state.vercelSetup.bypassCreatedAt !== row.createdAt)
  )
    fail('BYPASS');
  return row;
}
function deploymentRecord(dto, state) {
  const selectedBranch = branchFor(state);
  if (
    !object(dto) ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(dto.id ?? '') ||
    dto.projectId !== project ||
    dto.target !== null ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(dto.url ?? '') ||
    dto.meta?.githubCommitSha !== state.sourceHead ||
    dto.meta?.githubCommitRef !== selectedBranch ||
    !Number.isFinite(dto.createdAt) ||
    dto.createdAt < state.vercelSetup.deploymentIntentAt - 30000 ||
    !['QUEUED', 'INITIALIZING', 'BUILDING', 'READY', 'ERROR', 'CANCELED'].includes(dto.readyState)
  )
    fail('DEPLOYMENT');
  return {
    id: dto.id,
    audience: 'https://' + dto.url,
    readyState: dto.readyState,
    sourceHead: state.sourceHead,
    branch: selectedBranch,
    projectId: project,
  };
}
const m05Selection = {
  youtube: ['df405b78-eb07-4347-af97-6b62522bab8f', '3dbf4ea2-3eae-4369-89cb-85df8fcd2e03'],
  linkedin: ['21e51070-6857-4dbd-873d-3a9feba72831', '22db994a-8b44-4a57-996a-60c80cd7a640'],
  linkedin_employees: ['258f2013-1ca6-4794-830c-6f49efbea0b2'],
};
const m05Accounts = [
  ['youtube', 'C173', 'https://www.youtube.com/@aflamproductions'],
  ['youtube', 'C186', 'https://www.youtube.com/@hekka_sa'],
  ['linkedin', 'C000', 'https://www.linkedin.com/company/everyonefilms/'],
  ['linkedin', 'C001', 'https://www.linkedin.com/company/goodpeoplefilms/'],
  ['linkedin_employees', 'C000', 'https://www.linkedin.com/company/everyonefilms/'],
];
const m05ActorProperties = {
  'harvestapi/linkedin-company-posts': [
    'targetUrls',
    'postedLimitDate',
    'maxPosts',
    'includeReposts',
    'includeQuotePosts',
    'scrapeReactions',
    'scrapeComments',
  ],
  'harvestapi/linkedin-company-employees': [
    'companies',
    'profileScraperMode',
    'companyBatchMode',
    'maxItems',
    'maxItemsPerCompany',
    'startPage',
    'takePages',
  ],
};
function validateM05Subset(state) {
  if (!isDeepStrictEqual(state.selection, m05Selection)) fail('ACCOUNT_SELECTION');
  const ids = Object.values(m05Selection).flat();
  if (!Array.isArray(state.accountSnapshot) || state.accountSnapshot.length !== ids.length)
    fail('DATABASE_SNAPSHOT');
  for (const [index, id] of ids.entries()) {
    const matches = state.accountSnapshot.filter((account) => account.id === id);
    const account = matches[0],
      [platform, company, url] = m05Accounts[index];
    if (
      matches.length !== 1 ||
      account.platform !== platform ||
      account.company_code !== company ||
      account.url !== url ||
      !['active', 'failing'].includes(account.status) ||
      account.competitor_status !== 'active' ||
      !['pending', 'running', 'done', 'not_applicable'].includes(account.backfill_status) ||
      (account.locked_until !== null &&
        (!Number.isFinite(Date.parse(account.locked_until)) || Date.parse(account.locked_until) > Date.now()))
    )
      fail('ACCOUNT_SELECTION');
  }
  const policy = m05RunPolicy.parse(state.livePolicy);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      state.approvalId ?? '',
    ) ||
    policy.approval_id !== state.approvalId ||
    policy.website_urls_per_account !== undefined ||
    !isDeepStrictEqual(Object.keys(policy.actors).sort(), Object.keys(m05ActorProperties).sort()) ||
    !object(state.provider) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(state.provider.owner_id ?? '') ||
    !object(state.provider.actors) ||
    !isDeepStrictEqual(Object.keys(state.provider.actors).sort(), Object.keys(m05ActorProperties).sort())
  )
    fail('POLICY');
  for (const [key, required] of Object.entries(m05ActorProperties)) {
    const pin = policy.actors[key],
      provider = state.provider.actors[key];
    const properties = Array.isArray(provider?.inputProperties)
      ? provider.inputProperties
      : Object.keys(provider?.inputProperties ?? {});
    if (
      !object(provider) ||
      pin.owner_id !== state.provider.owner_id ||
      !['actorId', 'buildId', 'build'].every((field) => pin[field] === provider[field]) ||
      !required.every((field) => properties.includes(field)) ||
      !(Array.isArray(provider.pricing)
        ? provider.pricing.length > 0
        : object(provider.pricing) && Object.keys(provider.pricing).length > 0)
    )
      fail('PROVIDER_PIN');
  }
  return policy;
}
function prepareM05Subset(state, repo) {
  if (state.sourceHead !== currentHead(repo)) fail('SOURCE');
  const policy = validateM05Subset(state);
  const baseline = projectRecord(state.projectBaseline);
  if (Object.keys(baseline.protectionBypass).length) fail('OWNERSHIP_CONFLICT');
  const machine = state.native?.machine;
  if (
    state.native?.inventoryComplete !== true ||
    machine?.rebound === true ||
    machine?.pending ||
    machine?.baseline?.id !== 'EmrM03Machine19' ||
    machine.baseline.type !== 'httpCustomAuth' ||
    !Number.isFinite(Date.parse(machine.baseline.updatedAt)) ||
    !['id', 'name', 'type', 'createdAt', 'updatedAt'].every(
      (key) => machine.baseline[key] === machine.current?.[key],
    ) ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(
      state.machineBaseline?.audience ?? '',
    )
  )
    fail('MACHINE_BASELINE');
  if (!state.protectionBypass) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    state.protectionBypass = Array.from({ length: 32 }, () => alphabet[randomInt(alphabet.length)]).join('');
  }
  if (!/^[A-Za-z0-9]{32}$/.test(state.protectionBypass)) fail('BYPASS');
  state.vercelSetup ??= {
    prepared: true,
    pending: null,
    environments: [],
    bypassOwned: false,
    polls: 0,
    approvalId: policy.approval_id,
    branch: branchFor(state),
    comment: 'M05 YouTube LinkedIn subset temporary dev ' + policy.approval_id,
  };
  return {
    sourceHead: state.sourceHead,
    selection: structuredClone(state.selection),
    actorBuilds: Object.fromEntries(Object.entries(policy.actors).map(([key, pin]) => [key, pin.build])),
    snapshotObservedAt: state.accountSnapshotObservedAt ?? null,
  };
}
function prepare(state, repo, readEvidence) {
  if (state.vercelSetup?.configured || state.vercelSetup?.pending) fail();
  if (subset(state)) return prepareM05Subset(state, repo);
  const hc01 = state.scope === 'hc01';
  const incremental = hc01 || state.scope === 'incremental';
  const approval = readEvidence(
    repo,
    hc01
      ? 'hc01-dev-approval-20261028.json'
      : incremental
        ? 'incremental-dev-approval-20261027.json'
        : 'live-test-approval-20261027.json',
  );
  const starts = hc01 ? 22 : incremental ? 8 : 4,
    results = hc01 ? 30 : incremental ? 50 : 5;
  const approvedAt = hc01 ? approval.recordedAt : approval.approvedAt;
  if (
    approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    approval.environment !== 'dev' ||
    approval.ceilings?.actorStarts !== starts ||
    approval.ceilings.actorUsd !== starts ||
    approval.ceilings.perActorUsd !== 1 ||
    (incremental &&
      (approval.approval_kind !== (hc01 ? 'hc01' : 'incremental') ||
        approval.ceilings.resultsPerProfile !== results ||
        approval.reviewedHead !==
          (hc01 ? 'bb0cd01d3a6ee239540e73b1d366f86e46b17d42' : '2c450f40557e7582525d96b5dd63bba2338baa0d') ||
        (hc01 && approval.approval_id !== '1cf8406c-1142-445e-a237-6d0fd7a67b22') ||
        !Number.isFinite(Date.parse(approvedAt))))
  )
    fail('APPROVAL');
  const receipt = readEvidence(
    repo,
    hc01
      ? 'hc01-db-preflight-20261028.json'
      : incremental
        ? 'incremental-db-preflight-20261027.json'
        : 'live-db-preflight-after-path-fix-20261027.json',
  );
  const snapshot = incremental ? receipt.queryResult?.[0]?.incremental_preflight : receipt.preflight;
  if (
    receipt.status !== (incremental ? 'reviewed_query_complete' : 'preflight_verified') ||
    receipt.environment !== 'dev' ||
    receipt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    receipt.authenticationVerified !== true ||
    receipt.childrenClosed !== true ||
    receipt.lastNativeExit !== 0 ||
    (incremental &&
      (receipt.phase !== 'Query' ||
        receipt.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
        receipt.port !== 5432 ||
        receipt.databaseClientClosed !== true ||
        !Array.isArray(receipt.queryResult) ||
        receipt.queryResult.length !== 1 ||
        !Number.isFinite(Date.parse(receipt.observedAt)) ||
        Date.parse(receipt.observedAt) < Date.parse(approvedAt) ||
        Date.parse(receipt.observedAt) > Date.now() + 30000)) ||
    !object(snapshot) ||
    snapshot.current_user !== 'postgres' ||
    snapshot.session_user !== 'postgres' ||
    snapshot.database !== 'postgres' ||
    snapshot.selectedCount !== (incremental ? 10 : 4) ||
    snapshot.selectedLiveClaims !== 0 ||
    !Array.isArray(snapshot.accounts) ||
    snapshot.accounts.length !== (incremental ? 10 : 4) ||
    !Array.isArray(snapshot.selectedRunningParents) ||
    snapshot.selectedRunningParents.length ||
    !Array.isArray(snapshot.selectedUnprocessedActors) ||
    snapshot.selectedUnprocessedActors.length
  )
    fail('DATABASE_SNAPSHOT');
  if (hc01) {
    const historical = readEvidence(repo, 'incremental-final-readback-20261027.json').queryResult?.[0]
      ?.incremental_preflight?.migrations;
    const actual = snapshot.migrations;
    if (
      !Array.isArray(historical) ||
      historical.length !== 17 ||
      !Array.isArray(actual) ||
      actual.length !== 18 ||
      historical.some((row, index) =>
        ['version', 'name', 'historySha256'].some((k) => row[k] !== actual[index]?.[k]),
      ) ||
      actual[17].version !== '20261027192743' ||
      actual[17].name !== 'm04_recent_instagram_dev_eligibility' ||
      !/^[a-f0-9]{64}$/.test(actual[17].historySha256 ?? '')
    )
      fail('DATABASE_SNAPSHOT');
  }
  const expected = {
    'C000:vimeo': 'everyonefilms',
    'C001:vimeo': 'goodpeoplefilms',
    'C000:instagram': 'everyone.film',
    'C001:instagram': 'goodpeoplefilms',
    ...(incremental
      ? {
          'C130:vimeo': 'bigfootfilmseg',
          'C270:vimeo': 'thetalkiesproductionsleb',
          'C226:vimeo': 'bigkahunafilms',
          'C130:instagram': 'bigfootfilms',
          'C270:instagram': 'thetalkies',
          'C226:instagram': 'bigkahunafilms',
        }
      : {}),
  };
  const seen = new Set(),
    seenIds = new Set();
  for (const account of snapshot.accounts) {
    const key = account.company_code + ':' + account.platform;
    if (
      !Object.hasOwn(expected, key) ||
      expected[key] !== account.handle ||
      seen.has(key) ||
      seenIds.has(account.id) ||
      !/^[a-f0-9-]{36}$/.test(account.id ?? '') ||
      account.status !== 'active' ||
      account.competitor_status !== 'active' ||
      (incremental
        ? !['pending', 'running', 'done', 'not_applicable'].includes(account.backfill_status)
        : account.backfill_status !== 'pending') ||
      account.backfill_from !== '2024-01-01' ||
      account.locked_until !== null ||
      (incremental &&
        account.url !==
          (account.platform === 'vimeo'
            ? 'https://vimeo.com/' + expected[key]
            : 'https://www.instagram.com/' + expected[key] + '/'))
    )
      fail('ACCOUNT_SELECTION');
    seen.add(key);
    seenIds.add(account.id);
  }
  const providerReceipt = readEvidence(
      repo,
      hc01
        ? 'hc01-provider-preflight-20261028.json'
        : incremental
          ? 'incremental-provider-preflight-20261027.json'
          : 'live-provider-preflight-20261027.json',
    ),
    provider = providerReceipt.provider;
  if (
    providerReceipt.status !== 'completed' ||
    !object(provider) ||
    !object(provider.inputSchema?.properties) ||
    (incremental &&
      (!Number.isFinite(Date.parse(providerReceipt.observedAt)) ||
        Date.parse(providerReceipt.observedAt) < Date.parse(approvedAt) ||
        Date.parse(providerReceipt.observedAt) > Date.now() + 30000))
  )
    fail('PROVIDER_PIN');
  for (const key of ['owner_id', 'actorId', 'build', 'buildId'])
    if (state.provider?.[key] !== provider[key]) fail('PROVIDER_PIN');
  if (
    hc01 &&
    (provider.actorId !== 'shu8hvrXbJbY3Eb9W' ||
      provider.build !== '0.0.831' ||
      provider.buildId !== 'yvA3PQRWe95APBdIh')
  )
    fail('PROVIDER_PIN');
  if (
    provider.inputSchema.properties.searchType?.default !== 'hashtag' ||
    provider.inputSchema.properties.addParentData?.default !== false
  )
    fail('INPUT_DEFAULTS');
  const prices = provider.pricing
    .filter((row) => Number.isFinite(Date.parse(row.startedAt)) && Date.parse(row.startedAt) <= Date.now())
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const price = prices.at(-1),
    scalePrice =
      price?.pricingPerEvent?.actorChargeEvents?.result?.eventTieredPricingUsd?.SILVER?.tieredEventPriceUsd;
  const book = snapshot.priceBook
    .filter((row) => row.provider === 'apify' && row.sku === 'apify/instagram-scraper:result')
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
    .at(-1);
  if (
    price?.pricingModel !== 'PAY_PER_EVENT' ||
    !Number.isFinite(price.minimalMaxTotalChargeUsd) ||
    price.minimalMaxTotalChargeUsd > 1 ||
    price.minimalMaxTotalChargeUsd < 0 ||
    scalePrice !== 0.0019 ||
    book?.unit !== '1k results' ||
    book.usd_per_unit !== scalePrice * 1000
  )
    fail('PRICE');
  const pending = JSON.parse(
    readFileSync(
      join(
        process.env.LOCALAPPDATA,
        'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/pending-runtime.json',
      ),
      'utf8',
    ),
  );
  const originalMachine = parseFoundationPacket(
    JSON.parse(readFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), 'utf8')),
  );
  if (
    !isDeepStrictEqual(
      Object.keys(pending).sort(),
      ['version', 'windowId', 'purpose', 'audience', 'sourceCommitSha', 'credentialId', 'createdAt'].sort(),
    ) ||
    pending.version !== originalMachine.version ||
    pending.windowId !== originalMachine.windowId ||
    pending.audience !== originalMachine.audience ||
    pending.sourceCommitSha !== originalMachine.sourceCommitSha ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,7}(?:Z|\+00:00)$/.test(pending.createdAt ?? '') ||
    !Number.isFinite(Date.parse(pending.createdAt)) ||
    Date.parse(pending.createdAt) > Date.now() ||
    pending.credentialId !== 'EmrM03Machine19' ||
    pending.purpose !== 'pending_inactive_m03_runtime_delivery' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(pending.audience ?? '') ||
    (incremental
      ? state.native?.inventoryComplete !== true ||
        state.native.machine.rebound === true ||
        state.native.machine.pending ||
        state.native.machine.baseline?.id !== 'EmrM03Machine19' ||
        state.native.machine.baseline.type !== 'httpCustomAuth' ||
        !Number.isFinite(Date.parse(state.native.machine.baseline.updatedAt)) ||
        !['id', 'name', 'type', 'createdAt', 'updatedAt'].every(
          (key) => state.native.machine.baseline[key] === state.native.machine.current?.[key],
        )
      : state.native?.machine?.baseline?.updatedAt !== '2026-10-25T21:06:39.771Z')
  )
    fail('MACHINE_BASELINE');
  state.machineBaseline = { audience: pending.audience };
  state.sourceHead = currentHead(repo);
  state.accountSnapshot = structuredClone(snapshot.accounts);
  state.selection = Object.fromEntries(
    ['vimeo', 'instagram'].map((platform) => [
      platform,
      snapshot.accounts
        .filter((a) => a.platform === platform)
        .sort((a, b) => a.company_code.localeCompare(b.company_code))
        .map((a) => a.id),
    ]),
  );
  if (hc01) {
    const expectedIds = {
      C000: '962c9c7e-aa0f-46ae-911b-3265859e0577',
      C001: 'bed82782-753f-4ba9-91ca-691ef36f75c6',
      C130: '46149fb9-8905-4b76-9834-4b38f668a2e2',
      C270: '2d42d451-ac9a-42ac-a879-8760d63c8108',
      C226: '3ca3befa-abe6-4540-a389-0cf16115c581',
    };
    for (const a of snapshot.accounts.filter((a) => a.platform === 'instagram')) {
      if (
        a.id !== expectedIds[a.company_code] ||
        !['pending', 'running'].includes(a.backfill_status) ||
        !Number.isFinite(Date.parse(a.last_item_published_at)) ||
        Date.parse(a.last_item_published_at) > Date.now() ||
        typeof a.last_external_id !== 'string' ||
        !a.last_external_id
      )
        fail('ACCOUNT_SELECTION');
    }
    state.selection.vimeo = ['985a57dd-7934-422d-9d18-4e8ca59fc197'];
  }
  state.livePolicy = collectorPolicy.parse({
    approval_id: approval.approval_id,
    max_actor_starts: starts,
    max_actor_usd: 1,
    max_total_usd: starts,
    max_results_per_profile: results,
    actors: {
      'apify/instagram-scraper': {
        owner_id: provider.owner_id,
        actorId: provider.actorId,
        build: provider.build,
        buildId: provider.buildId,
        inputDefaults: { searchType: 'hashtag', addParentData: false },
      },
    },
  });
  if (!state.protectionBypass) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    state.protectionBypass = Array.from({ length: 32 }, () => alphabet[randomInt(alphabet.length)]).join('');
  }
  if (!/^[A-Za-z0-9]{32}$/.test(state.protectionBypass)) fail('BYPASS');
  state.vercelSetup ??= {
    prepared: true,
    pending: null,
    environments: [],
    bypassOwned: false,
    polls: 0,
    approvalId: approval.approval_id,
    comment:
      'M04 ' +
      (hc01 ? 'HC01' : incremental ? 'incremental' : 'representative') +
      ' temporary dev ' +
      approval.approval_id,
  };
  return {
    sourceHead: state.sourceHead,
    selection: state.selection,
    actorBuild: provider.build,
    minimumActorLimitUsd: price.minimalMaxTotalChargeUsd,
    snapshotObservedAt: receipt.observedAt,
  };
}

export async function runVercelTask({ phase, state, secrets = {}, repo, send, readEvidence = read }) {
  const selectedBranch = branchFor(state),
    m05 = subset(state);
  const receipt = { status: 'completed', code: null, phase, requestCount: 0 };
  const request = async (method, path, value) => {
    receipt.requestCount++;
    const r = await send(method, path, value);
    if (!object(r) || ![200, 201, 204].includes(r.status) || r.closed === false) fail();
    return r.data;
  };
  const checkProductionBuilds = async () => {
    const data = await request('GET', paths.productionBuilds);
    if (
      !object(data) ||
      !Array.isArray(data.deployments) ||
      data.deployments.length > 100 ||
      data.pagination?.next ||
      data.deployments.some(
        (d) =>
          !object(d) ||
          !/^dpl_[A-Za-z0-9]{1,80}$/.test(d.uid ?? d.id ?? '') ||
          !['QUEUED', 'INITIALIZING', 'BUILDING'].includes(d.readyState ?? d.state) ||
          (d.projectId !== undefined && d.projectId !== project) ||
          (d.target !== undefined && d.target !== 'production'),
      )
    )
      fail('PRODUCTION_METADATA');
    const builds = data.deployments.map((d) => ({ id: d.uid ?? d.id, state: d.readyState ?? d.state }));
    if (builds.length) {
      receipt.productionBuildConflict = builds;
      fail('PRODUCTION_BUILD_CONFLICT');
    }
  };
  try {
    if (phase === 'prepare') receipt.prepared = prepare(state, repo, readEvidence);
    else {
      const v = state.vercelSetup;
      if (!v?.prepared) fail('PREPARE_REQUIRED');
      if (v.branch !== undefined && v.branch !== selectedBranch) fail('SOURCE');
      if (phase === 'configure') {
        const resumeKnownBypass = v.pending?.action === 'bypass.create';
        if (
          (v.pending && !resumeKnownBypass) ||
          v.configured ||
          v.environments.length ||
          v.bypassOwned ||
          state.deployment
        )
          fail();
        if (state.sourceHead !== currentHead(repo)) fail('SOURCE');
        if (!/^[A-Za-z0-9_-]{43}$/.test(secrets.machine ?? '') || !secrets.writer || !secrets.apifyRead)
          fail('INPUT');
        const policy = m05 ? validateM05Subset(state) : collectorPolicy.parse(state.livePolicy);
        const hc01 = state.scope === 'hc01';
        const incremental = hc01 || state.scope === 'incremental';
        if (
          policy.approval_id !== v.approvalId ||
          (!m05 &&
            (policy.max_actor_starts !== (hc01 ? 22 : incremental ? 8 : 4) ||
              policy.max_actor_usd !== 1 ||
              policy.max_total_usd !== (hc01 ? 22 : incremental ? 8 : 4) ||
              policy.max_results_per_profile !== (hc01 ? 30 : incremental ? 50 : 5) ||
              !isDeepStrictEqual(Object.keys(policy.actors), ['apify/instagram-scraper']) ||
              !isDeepStrictEqual(policy.actors['apify/instagram-scraper'].inputDefaults, {
                searchType: 'hashtag',
                addParentData: false,
              })))
        )
          fail('POLICY');
        const baseline = projectRecord(await request('GET', paths.project));
        const rows = environmentRows(await request('GET', paths.env));
        if (conflicts(rows, selectedBranch).length) fail('OWNERSHIP_CONFLICT');
        if (incremental || m05) await checkProductionBuilds();
        if (resumeKnownBypass) {
          // Resume the one recorded creation, never issue a replacement PATCH.
          // A private secret known before the attempt plus exact note/time and
          // a fresh sole/default map identifies this already-created resource.
          const owned = bypassRecord(baseline, state);
          if (!Number.isFinite(v.pending.at) || Math.abs(owned.createdAt - v.pending.at) > 30000)
            fail('BYPASS');
          v.bypassCreatedAt = owned.createdAt;
          v.bypassOwned = true;
          v.bypassRecoveredByPrivateIdentity = true;
          v.pending = null;
        } else {
          if (Object.keys(baseline.protectionBypass).length) fail('OWNERSHIP_CONFLICT');
          v.pending = { action: 'bypass.create', at: Date.now() };
          const p = await request('PATCH', paths.bypass, {
            generate: { secret: state.protectionBypass, note: v.comment },
          });
          const owned = bypassRecord(p, state, false, true);
          v.bypassCreatedAt = owned.createdAt;
          v.bypassOwned = true;
          v.pending = null;
          bypassRecord(p, state, true, true);
          bypassRecord(await request('GET', paths.project), state);
        }
        const values = [
          'true',
          state.sourceHead,
          secrets.writer,
          createHash('sha256').update(secrets.machine).digest('hex'),
          secrets.apifyRead,
          JSON.stringify(
            m05
              ? Object.values(state.selection).flat()
              : [...state.selection.vimeo, ...state.selection.instagram],
          ),
          JSON.stringify(state.livePolicy),
        ];
        for (const [index, key] of envKeys.entries()) {
          v.pending = { action: 'environment.create', key, at: Date.now() };
          const r = await request('POST', paths.createEnv, {
            key,
            value: values[index],
            type: 'sensitive',
            target: ['preview'],
            gitBranch: selectedBranch,
            comment: v.comment,
          });
          if (!object(r) || !Array.isArray(r.failed) || r.failed.length) fail('ENVIRONMENT');
          const meta = environmentMetadata(r.created, v.comment, selectedBranch);
          if (meta.key !== key || v.environments.some((e) => e.id === meta.id)) fail('ENVIRONMENT');
          v.environments.push(meta);
          v.pending = null;
        }
        const saved = environmentRows(await request('GET', paths.env));
        for (const expected of v.environments)
          if (
            !isDeepStrictEqual(
              environmentMetadata(
                saved.find((row) => row.id === expected.id),
                v.comment,
                selectedBranch,
              ),
              expected,
            )
          )
            fail('ENVIRONMENT_DRIFT');
        v.deploymentIntentAt = Date.now();
        v.pending = { action: 'deployment.create', at: v.deploymentIntentAt };
        const deployment = await request('POST', paths.deploy, {
          name: 'everyone-market-researcher',
          project,
          gitSource: { type: 'github', org, repo: repository, ref: selectedBranch, sha: state.sourceHead },
          meta: { [m05 ? 'emrM05Approval' : 'emrM04Approval']: state.livePolicy.approval_id },
        });
        state.deployment = deploymentRecord(deployment, state);
        v.pending = null;
        v.configured = true;
        receipt.deployment = state.deployment;
      } else if (phase === 'poll') {
        if (
          !v.configured ||
          v.pending ||
          !state.deployment ||
          v.polls >= 12 ||
          (['incremental', 'hc01', 'm05-subset'].includes(state.scope) && v.ready)
        )
          fail('POLL_LIMIT');
        v.polls++;
        const d = deploymentRecord(
          await request('GET', `/v13/deployments/${state.deployment.id}?teamId=${team}`),
          state,
        );
        if (d.id !== state.deployment.id || d.audience !== state.deployment.audience) fail('DEPLOYMENT');
        state.deployment = d;
        if (d.readyState === 'READY') {
          bypassRecord(await request('GET', paths.project), state);
          v.ready = true;
        } else if (!['QUEUED', 'INITIALIZING', 'BUILDING'].includes(d.readyState))
          fail('DEPLOYMENT_TERMINAL_FAILURE');
        receipt.deployment = d;
        receipt.ready = v.ready === true;
        receipt.polls = v.polls;
      } else if (phase === 'cleanup') {
        // Unknown creates remain recorded; never adopt an unidentified env or
        // replay a create. Independent acknowledged resources can be removed.
        let rows = [],
          environmentError,
          productionError;
        if (['incremental', 'hc01', 'm05-subset'].includes(state.scope)) {
          try {
            await checkProductionBuilds();
          } catch (error) {
            productionError = error;
          }
        }
        try {
          rows = environmentRows(await request('GET', paths.env));
          for (const expected of v.environments) {
            if (expected.absenceVerified) continue;
            const actual = rows.find((row) => row.id === expected.id);
            if (!actual) {
              expected.absenceVerified = true;
              continue;
            }
            const original = Object.fromEntries(
              Object.entries(expected).filter(
                ([key]) => !['absenceVerified', 'deleteAttempted'].includes(key),
              ),
            );
            if (
              !isDeepStrictEqual(environmentMetadata(actual, v.comment, selectedBranch), original) ||
              expected.deleteAttempted
            )
              fail('ENVIRONMENT_DRIFT');
            expected.deleteAttempted = true;
            await request('DELETE', `/v9/projects/${project}/env/${expected.id}?teamId=${team}`);
            rows = environmentRows(await request('GET', paths.env));
            if (rows.some((row) => row.id === expected.id)) fail('ENVIRONMENT');
            expected.absenceVerified = true;
          }
        } catch (error) {
          environmentError = error;
        }
        if (v.bypassOwned || v.pending?.action === 'bypass.create') {
          const p = projectRecord(await request('GET', paths.project));
          if (v.pending?.action === 'bypass.create') {
            // The unpredictable secret was privately persisted before its sole
            // creation attempt. Exact secret/note/time readback identifies our
            // resource for revocation, never for another create attempt.
            if (Object.hasOwn(p.protectionBypass, state.protectionBypass)) {
              const own = bypassRecord(p, state, false);
              if (own.createdAt < v.pending.at - 30000 || own.createdAt > Date.now() + 30000) fail('BYPASS');
              v.bypassCreatedAt = own.createdAt;
              v.bypassOwned = true;
              v.bypassRecoveredByPrivateIdentity = true;
            } else if (Object.keys(p.protectionBypass).length) fail('BYPASS');
            v.pending = null;
          }
          if (!Object.hasOwn(p.protectionBypass, state.protectionBypass) && v.bypassRevokeAttempted) {
            v.bypassOwned = false;
            v.bypassAbsenceVerified = true;
          } else if (v.bypassOwned) {
            bypassRecord(p, state, false);
            if (v.bypassRevokeAttempted) fail();
            v.bypassRevokeAttempted = true;
            await request('PATCH', paths.bypass, {
              revoke: { secret: state.protectionBypass, regenerate: false },
            });
            const after = projectRecord(await request('GET', paths.project));
            if (Object.keys(after.protectionBypass).length) fail('BYPASS');
            v.bypassOwned = false;
            v.bypassAbsenceVerified = true;
          }
        }
        if (environmentError) throw environmentError;
        if (conflicts(rows, selectedBranch).length || v.pending) fail('UNRESOLVED_EFFECT');
        v.cleanupComplete = true;
        receipt.cleanupComplete = true;
        receipt.protectedDeploymentRetained = state.deployment?.id ?? null;
        if (productionError) throw productionError;
      } else fail('PHASE');
    }
  } catch (error) {
    receipt.status = 'blocked';
    receipt.code = /^M04_VERCEL_[A-Z_]+$/.test(error?.message ?? '')
      ? error.message
      : 'M04_VERCEL_CONTRACT_FAILURE';
  }
  receipt.pendingMutation = Boolean(state.vercelSetup?.pending);
  return { public: receipt };
}
