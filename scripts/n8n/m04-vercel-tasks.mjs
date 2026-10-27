// The approved M04 Preview only. All network and accounting are supplied by the
// coordinator's existing native Vercel CLI transport; this file starts no run.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { collectorPolicy } from '../../packages/shared/src/n8n-collector-contracts.ts';
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
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
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
function conflicts(rows) {
  return rows.filter((row) => envKeys.includes(row.key) && (!row.gitBranch || row.gitBranch === branch));
}
function environmentMetadata(row, comment) {
  if (
    !object(row) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.id ?? '') ||
    !envKeys.includes(row.key) ||
    row.type !== 'sensitive' ||
    row.gitBranch !== branch ||
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
function bypassRecord(dto, state, requireDefault = true) {
  projectRecord(dto);
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
  if (
    !object(dto) ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(dto.id ?? '') ||
    dto.projectId !== project ||
    dto.target !== null ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(dto.url ?? '') ||
    dto.meta?.githubCommitSha !== state.sourceHead ||
    dto.meta?.githubCommitRef !== branch ||
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
    branch,
    projectId: project,
  };
}
function prepare(state, repo) {
  if (state.vercelSetup?.configured || state.vercelSetup?.pending) fail();
  const receipt = read(repo, 'live-db-preflight-after-path-fix-20261027.json'),
    snapshot = receipt.preflight;
  if (
    receipt.status !== 'preflight_verified' ||
    receipt.environment !== 'dev' ||
    receipt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    receipt.authenticationVerified !== true ||
    receipt.childrenClosed !== true ||
    receipt.lastNativeExit !== 0 ||
    !object(snapshot) ||
    snapshot.current_user !== 'postgres' ||
    snapshot.session_user !== 'postgres' ||
    snapshot.database !== 'postgres' ||
    snapshot.selectedCount !== 4 ||
    snapshot.selectedLiveClaims !== 0 ||
    !Array.isArray(snapshot.accounts) ||
    snapshot.accounts.length !== 4 ||
    !Array.isArray(snapshot.selectedRunningParents) ||
    snapshot.selectedRunningParents.length ||
    !Array.isArray(snapshot.selectedUnprocessedActors) ||
    snapshot.selectedUnprocessedActors.length
  )
    fail('DATABASE_SNAPSHOT');
  const expected = {
    'C000:vimeo': 'everyonefilms',
    'C001:vimeo': 'goodpeoplefilms',
    'C000:instagram': 'everyone.film',
    'C001:instagram': 'goodpeoplefilms',
  };
  const seen = new Set();
  for (const account of snapshot.accounts) {
    const key = account.company_code + ':' + account.platform;
    if (
      !Object.hasOwn(expected, key) ||
      expected[key] !== account.handle ||
      seen.has(key) ||
      !/^[a-f0-9-]{36}$/.test(account.id ?? '') ||
      account.status !== 'active' ||
      account.competitor_status !== 'active' ||
      account.backfill_status !== 'pending' ||
      account.backfill_from !== '2024-01-01' ||
      account.locked_until !== null
    )
      fail('ACCOUNT_SELECTION');
    seen.add(key);
  }
  const providerReceipt = read(repo, 'live-provider-preflight-20261027.json'),
    provider = providerReceipt.provider;
  if (
    providerReceipt.status !== 'completed' ||
    !object(provider) ||
    !object(provider.inputSchema?.properties)
  )
    fail('PROVIDER_PIN');
  for (const key of ['owner_id', 'actorId', 'build', 'buildId'])
    if (state.provider?.[key] !== provider[key]) fail('PROVIDER_PIN');
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
  const approval = read(repo, 'live-test-approval-20261027.json');
  if (
    approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    approval.environment !== 'dev' ||
    approval.ceilings?.actorStarts !== 4 ||
    approval.ceilings.actorUsd !== 4 ||
    approval.ceilings.perActorUsd !== 1
  )
    fail('APPROVAL');
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
    state.native?.machine?.baseline?.updatedAt !== '2026-10-25T21:06:39.771Z'
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
  state.livePolicy = collectorPolicy.parse({
    approval_id: approval.approval_id,
    max_actor_starts: 4,
    max_actor_usd: 1,
    max_total_usd: 4,
    max_results_per_profile: 5,
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
    comment: 'M04 representative temporary dev ' + approval.approval_id,
  };
  return {
    sourceHead: state.sourceHead,
    selection: state.selection,
    actorBuild: provider.build,
    minimumActorLimitUsd: price.minimalMaxTotalChargeUsd,
    snapshotObservedAt: receipt.observedAt,
  };
}

export async function runVercelTask({ phase, state, secrets = {}, repo, send }) {
  const receipt = { status: 'completed', code: null, phase, requestCount: 0 };
  const request = async (method, path, value) => {
    receipt.requestCount++;
    const r = await send(method, path, value);
    if (!object(r) || ![200, 201, 204].includes(r.status) || r.closed === false) fail();
    return r.data;
  };
  try {
    if (phase === 'prepare') receipt.prepared = prepare(state, repo);
    else {
      const v = state.vercelSetup;
      if (!v?.prepared) fail('PREPARE_REQUIRED');
      if (phase === 'configure') {
        if (v.pending || v.configured || v.environments.length || v.bypassOwned || state.deployment) fail();
        if (state.sourceHead !== currentHead(repo)) fail('SOURCE');
        if (!/^[A-Za-z0-9_-]{43}$/.test(secrets.machine ?? '') || !secrets.writer || !secrets.apifyRead)
          fail('INPUT');
        const policy = collectorPolicy.parse(state.livePolicy);
        if (
          policy.approval_id !== v.approvalId ||
          policy.max_actor_starts !== 4 ||
          policy.max_actor_usd !== 1 ||
          policy.max_total_usd !== 4 ||
          policy.max_results_per_profile !== 5 ||
          !isDeepStrictEqual(Object.keys(policy.actors), ['apify/instagram-scraper']) ||
          !isDeepStrictEqual(policy.actors['apify/instagram-scraper'].inputDefaults, {
            searchType: 'hashtag',
            addParentData: false,
          })
        )
          fail('POLICY');
        const baseline = projectRecord(await request('GET', paths.project));
        const rows = environmentRows(await request('GET', paths.env));
        if (Object.keys(baseline.protectionBypass).length || conflicts(rows).length)
          fail('OWNERSHIP_CONFLICT');
        v.pending = { action: 'bypass.create', at: Date.now() };
        let p = await request('PATCH', paths.bypass, {
          generate: { secret: state.protectionBypass, note: v.comment },
        });
        const owned = bypassRecord(p, state, false);
        v.bypassCreatedAt = owned.createdAt;
        v.bypassOwned = true;
        v.pending = null;
        bypassRecord(p, state);
        p = await request('GET', paths.project);
        bypassRecord(p, state);
        const values = [
          'true',
          state.sourceHead,
          secrets.writer,
          createHash('sha256').update(secrets.machine).digest('hex'),
          secrets.apifyRead,
          JSON.stringify([...state.selection.vimeo, ...state.selection.instagram]),
          JSON.stringify(state.livePolicy),
        ];
        for (const [index, key] of envKeys.entries()) {
          v.pending = { action: 'environment.create', key, at: Date.now() };
          const r = await request('POST', paths.createEnv, {
            key,
            value: values[index],
            type: 'sensitive',
            target: ['preview'],
            gitBranch: branch,
            comment: v.comment,
          });
          if (!object(r) || !Array.isArray(r.failed) || r.failed.length) fail('ENVIRONMENT');
          const meta = environmentMetadata(r.created, v.comment);
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
          gitSource: { type: 'github', org, repo: repository, ref: branch, sha: state.sourceHead },
          meta: { emrM04Approval: state.livePolicy.approval_id },
        });
        state.deployment = deploymentRecord(deployment, state);
        v.pending = null;
        v.configured = true;
        receipt.deployment = state.deployment;
      } else if (phase === 'poll') {
        if (!v.configured || v.pending || !state.deployment || v.polls >= 12) fail('POLL_LIMIT');
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
          environmentError;
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
              !isDeepStrictEqual(environmentMetadata(actual, v.comment), original) ||
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
        if (conflicts(rows).length || v.pending) fail('UNRESOLVED_EFFECT');
        v.cleanupComplete = true;
        receipt.cleanupComplete = true;
        receipt.protectedDeploymentRetained = state.deployment?.id ?? null;
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
