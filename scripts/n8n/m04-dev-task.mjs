// Fixed M04 product operations. Native workflows perform collection; this file
// only reuses existing TLS transports for the approved setup and readbacks.
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { m05RunPolicy } from '../../packages/shared/src/n8n-collector-contracts.ts';
import { parseFoundationPacket } from './foundation-bind.mjs';
import { privateJsonTransport } from './foundation-live-runtime-transport.mjs';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { readFoundationVercelAuthMetadata } from './foundation-vercel-auth-preflight.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu';
const team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const branch = 'm04-collectors-vimeo-instagram';
const usage = resolve(root, 'milestones/M04-collectors-vimeo-instagram/evidence/live-usage-20261027.jsonl');
const m05Evidence = 'milestones/M05-collectors-web-youtube-linkedin/evidence';
export const m05SubsetAccounts = Object.freeze(
  [
    ['df405b78-eb07-4347-af97-6b62522bab8f', 'C173', 'youtube', 'https://www.youtube.com/@aflamproductions'],
    ['3dbf4ea2-3eae-4369-89cb-85df8fcd2e03', 'C186', 'youtube', 'https://www.youtube.com/@hekka_sa'],
    [
      '21e51070-6857-4dbd-873d-3a9feba72831',
      'C000',
      'linkedin',
      'https://www.linkedin.com/company/everyonefilms/',
    ],
    [
      '22db994a-8b44-4a57-996a-60c80cd7a640',
      'C001',
      'linkedin',
      'https://www.linkedin.com/company/goodpeoplefilms',
    ],
    [
      '258f2013-1ca6-4794-830c-6f49efbea0b2',
      'C000',
      'linkedin_employees',
      'https://www.linkedin.com/company/everyonefilms/',
    ],
  ].map(([id, company_code, platform, url]) => Object.freeze({ id, company_code, platform, url })),
);
export function initializeM05Subset(state, receipt, head, now = Date.now()) {
  if (Object.keys(state).length) {
    if (state.scope !== 'm05-subset' || !/^[a-f0-9-]{36}$/.test(state.approvalId ?? ''))
      fail('M05_SUBSET_STATE_REQUIRED');
    return;
  }
  const snapshot = receipt?.queryResult?.[0]?.m05_subset;
  const timestamp = Date.parse(receipt?.observedAt);
  if (
    receipt?.status !== 'reviewed_query_complete' ||
    receipt.environment !== 'dev' ||
    receipt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    receipt.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
    receipt.port !== 5432 ||
    receipt.authenticationVerified !== true ||
    receipt.childrenClosed !== true ||
    receipt.databaseClientClosed !== true ||
    !Number.isFinite(timestamp) ||
    timestamp > now + 30000 ||
    now - timestamp > 3600000 ||
    !/^[a-f0-9]{40}$/.test(head ?? '') ||
    snapshot?.current_user !== 'postgres' ||
    snapshot.session_user !== 'postgres' ||
    snapshot.database !== 'postgres' ||
    snapshot.selectedLiveClaims !== 0 ||
    snapshot.selectedRunningParents !== 0 ||
    snapshot.selectedUnprocessedActors !== 0 ||
    !Array.isArray(snapshot.accounts) ||
    snapshot.accounts.length !== 5
  )
    fail('M05_SUBSET_DATABASE_SNAPSHOT_REQUIRED');
  for (const expected of m05SubsetAccounts) {
    const rows = snapshot.accounts.filter((a) => a.id === expected.id);
    const account = rows[0];
    if (
      rows.length !== 1 ||
      Object.entries(expected).some(([key, value]) =>
        key === 'url'
          ? typeof account.url !== 'string' || account.url.replace(/\/$/, '') !== value.replace(/\/$/, '')
          : account[key] !== value,
      ) ||
      !['active', 'failing'].includes(account.status) ||
      account.competitor_status !== 'active' ||
      account.locked_until !== null
    )
      fail('M05_SUBSET_ACCOUNT_IDENTITY_REQUIRED');
  }
  state.scope = 'm05-subset';
  state.approvalId = randomUUID();
  state.sourceHead = head;
  state.accountSnapshot = structuredClone(snapshot.accounts);
  state.machineBaseline = {
    audience: parseFoundationPacket(
      JSON.parse(readFileSync(resolve(root, 'scripts/n8n/foundation-delivery-packet.json'), 'utf8')),
    ).audience,
  };
  state.selection = Object.fromEntries(
    ['youtube', 'linkedin', 'linkedin_employees'].map((platform) => [
      platform,
      m05SubsetAccounts.filter((a) => a.platform === platform).map((a) => a.id),
    ]),
  );
  state.accountIds = m05SubsetAccounts.map((a) => a.id);
  state.collectorSelections = {
    'WF-13': {
      env: 'dev',
      mode: 'backfill',
      account_ids: state.selection.youtube,
      max_pages: 2,
      page_size: 50,
    },
    'WF-18': {
      env: 'dev',
      mode: 'backfill',
      account_ids: state.selection.linkedin,
      results_limit: 20,
      max_actor_starts: 2,
    },
    'WF-18b': {
      env: 'dev',
      mode: 'weekly',
      account_ids: state.selection.linkedin_employees,
      results_limit: 20,
      max_actor_starts: 1,
    },
  };
}
// Independent M05 accounting. Historical M04 allowance and ledger stay closed.
export function chargeM05Request(
  category,
  operation,
  ledger = resolve(root, m05Evidence, 'live-usage-20261028.jsonl'),
) {
  if (!['n8n', 'vercel', 'provider', 'gateway', 'callback', 'database'].includes(category))
    fail('M05_CATEGORY_INVALID');
  const rows = readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const latest = [...rows].reverse().find((r) => r.totals)?.totals;
  if (
    !latest ||
    !['management', 'control', 'combined', 'vercel'].every(
      (k) => Number.isSafeInteger(latest[k]) && latest[k] >= 0,
    ) ||
    latest.management + latest.control !== latest.combined ||
    latest.vercel > latest.management
  )
    fail('M05_LEDGER_INVALID');
  const totals = { ...latest };
  totals[category === 'n8n' || category === 'vercel' ? 'management' : 'control']++;
  totals.combined++;
  if (category === 'vercel') totals.vercel++;
  appendFileSync(
    ledger,
    JSON.stringify({
      at: new Date().toISOString(),
      event: 'request_intent',
      category,
      operation,
      scope: 'm05-subset',
      totals,
    }) + '\n',
  );
}
const fail = (code) => {
  throw Error(code);
};
export function validOperation(task, phase) {
  return (
    {
      Inventory: ['default'],
      ProviderMetadata: ['default'],
      Setup: ['project', 'prepare', 'configure', 'poll', 'cleanup'],
      Stage: ['stage', 'publish', 'machine', 'readback', 'cohort'],
      Observe: ['default'],
      Probe: ['default', 'replay', 'unknown', 'malformed'],
      Restore: ['native'],
    }[task]?.includes(phase) === true
  );
}
// Bind this one representative replay to its already-completed public database
// receipt. This never discovers a run, starts an actor, or accepts a caller ID.
export function bindOwnedInstagramReplay(state, receipt, approval) {
  const reject = () => fail('M04_OWNED_CALLBACK_RECEIPT_REQUIRED');
  const parentId = 'd0c86952-df68-48ff-8f41-132500e2e90b',
    executionId = '31159';
  const approvalId = '3f3aed72-4f14-4cc4-aefe-4999038efe27';
  const selected = state.selection?.instagram;
  const sameAccounts = (ids) =>
    Array.isArray(ids) &&
    ids.length === 2 &&
    new Set(ids).size === 2 &&
    [...ids].sort().every((id, index) => id === [...selected].sort()[index]);
  const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const money = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || !Number.isSafeInteger(Math.round(v * 1e9)))
      reject();
    return Math.round(v * 1e9);
  };
  if (
    !Array.isArray(selected) ||
    selected.length !== 2 ||
    new Set(selected).size !== 2 ||
    selected.some((id) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) ||
    approval?.approval_id !== approvalId ||
    approval.environment !== 'dev' ||
    approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    receipt?.version !== 1 ||
    receipt.phase !== 'Query' ||
    receipt.environment !== 'dev' ||
    receipt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    receipt.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
    receipt.port !== 5432 ||
    receipt.status !== 'reviewed_query_complete' ||
    receipt.authenticationVerified !== true ||
    receipt.childrenClosed !== true ||
    receipt.databaseClientClosed !== true ||
    receipt.lastNativeExit !== 0 ||
    !Array.isArray(receipt.queryResult) ||
    receipt.queryResult.length !== 1
  )
    reject();
  const data = receipt.queryResult[0]?.collector_assertions;
  if (
    !data ||
    data.selectedLiveClaims !== 0 ||
    data.selectedUnprocessedActors !== 0 ||
    !['runs', 'accounts', 'launches', 'actorRuns', 'costs', 'accountResults'].every((key) =>
      Array.isArray(data[key]),
    )
  )
    reject();
  const parents = data.runs.filter((r) => r.id === parentId);
  const parent = parents[0];
  if (
    parents.length !== 1 ||
    parent.env !== 'dev' ||
    parent.workflow !== 'WF-11' ||
    parent.platform !== 'instagram' ||
    parent.mode !== 'backfill' ||
    parent.n8n_execution_id !== executionId ||
    parent.status !== 'success' ||
    parent.error !== null ||
    !date(parent.finished_at) ||
    parent.accounts_total !== 2 ||
    parent.accounts_ok !== 2 ||
    parent.accounts_failed !== 0
  )
    reject();
  const accounts = data.accounts.filter((a) => selected.includes(a.id));
  if (
    !sameAccounts(accounts.map((a) => a.id)) ||
    accounts.some((a) => a.platform !== 'instagram' || a.last_run_id !== parentId || a.locked_until !== null)
  )
    reject();
  const launches = data.launches.filter((l) => l.run_id === parentId);
  const actors = data.actorRuns.filter((a) => a.run_id === parentId);
  const costs = data.costs.filter((c) => c.run_id === parentId);
  const results = data.accountResults.filter((r) => r.run_id === parentId);
  if (
    launches.length !== 2 ||
    actors.length !== 2 ||
    costs.length !== 4 ||
    results.length !== 2 ||
    new Set(launches.map((l) => l.pass)).size !== 2 ||
    launches.some((l) => !['posts', 'reels'].includes(l.pass)) ||
    new Set(launches.map((l) => l.apify_run_id)).size !== 2 ||
    new Set(costs.map((c) => c.cost_key)).size !== 4 ||
    !sameAccounts(results.map((r) => r.account_id)) ||
    results.some((r) => r.status !== 'success' || r.error !== null || !date(r.finished_at))
  )
    reject();
  for (const launch of launches) {
    const matches = actors.filter((a) => a.apify_run_id === launch.apify_run_id),
      actor = matches[0];
    const entries = costs.filter((c) => c.apify_run_id === launch.apify_run_id);
    if (
      matches.length !== 1 ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(launch.apify_run_id ?? '') ||
      launch.approval_id !== approvalId ||
      launch.actor_id !== 'apify/instagram-scraper' ||
      launch.purpose !== 'backfill' ||
      !sameAccounts(launch.account_ids) ||
      launch.results_limit !== 5 ||
      launch.dataset_complete !== true ||
      !Number.isSafeInteger(launch.next_offset) ||
      launch.next_offset < 0 ||
      launch.next_offset > 10 ||
      launch.max_actor_usd !== approval.ceilings?.perActorUsd ||
      launch.max_total_usd !== approval.ceilings?.actorUsd ||
      launch.max_actor_starts !== approval.ceilings?.actorStarts ||
      actor.actor_id !== 'apify/instagram-scraper' ||
      actor.purpose !== 'backfill' ||
      !sameAccounts(actor.account_ids) ||
      actor.status !== 'SUCCEEDED' ||
      !date(actor.finished_at) ||
      !date(actor.processed_at) ||
      entries.length !== 2 ||
      entries.some(
        (c) =>
          c.provider !== 'apify' ||
          c.platform !== 'instagram' ||
          c.category !== 'scrape' ||
          c.unit !== 'result' ||
          !Number.isSafeInteger(c.quantity) ||
          c.quantity < 0 ||
          c.quantity > 5,
      ) ||
      !selected.every(
        (id) => entries.filter((c) => c.cost_key === 'apify:' + actor.apify_run_id + ':' + id).length === 1,
      ) ||
      entries.reduce((sum, c) => sum + money(c.cost_usd), 0) !== money(actor.usage_usd) ||
      money(actor.usage_usd) > money(launch.max_actor_usd)
    )
      reject();
  }
  if (
    costs.reduce((sum, c) => sum + money(c.cost_usd), 0) !== money(parent.cost_usd) ||
    costs.reduce((sum, c) => sum + c.quantity, 0) !== parent.items_seen ||
    results.reduce((sum, r) => sum + r.items_seen, 0) !== parent.items_seen ||
    results.reduce((sum, r) => sum + r.items_new, 0) !== parent.items_new
  )
    reject();
  const replayRunId = launches.find((l) => l.pass === 'posts').apify_run_id;
  if (state.functional?.replayRunId && state.functional.replayRunId !== replayRunId) reject();
  state.functional = { ...state.functional, replayRunId, parentRunId: parentId, executionId, approvalId };
  return replayRunId;
}
export function checkM04IncrementalCharge(totals, categoryCount, category, scope = 'incremental') {
  if (
    !['management', 'control', 'combined', 'vercel'].every(
      (key) => Number.isSafeInteger(totals[key]) && totals[key] >= 0,
    ) ||
    !Number.isSafeInteger(categoryCount) ||
    categoryCount < 0 ||
    totals.management + totals.control !== totals.combined ||
    totals.vercel > totals.management
  )
    fail('M04_LEDGER_INVALID');
  const limits =
    scope === 'hc01'
      ? { management: 482, control: 3151, combined: 3633, vercel: 138 }
      : { management: 296, control: 1446, combined: 1742, vercel: 100 };
  if (Object.keys(limits).some((key) => totals[key] > limits[key])) fail('M04_ALLOWANCE_EXHAUSTED');
  if (
    categoryCount >=
    ((scope === 'hc01'
      ? { n8n: 344, vercel: 138, provider: 1568, gateway: 1166, callback: 316, database: 101 }
      : { n8n: 196, vercel: 100, provider: 646, gateway: 613, callback: 126, database: 61 })[category] ?? 0)
  )
    fail('M04_CATEGORY_EXHAUSTED');
}
export function chargeM04Request(category, operation, scope) {
  const rows = readFileSync(usage, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const latest = [...rows].reverse().find((r) => r.totals || r.management !== undefined);
  const totals = { ...(latest?.totals ?? latest) };
  for (const key of Object.keys(totals))
    if (
      !['management', 'control', 'combined', 'vercel', 'nativeActions', 'actorStarts', 'actorUsd'].includes(
        key,
      )
    )
      delete totals[key];
  if (category === 'n8n' || category === 'vercel') totals.management++;
  else totals.control++;
  totals.combined++;
  if (category === 'vercel') totals.vercel++;
  if (
    !['incremental', 'hc01'].includes(scope) &&
    (totals.management > 160 || totals.control > 472 || totals.combined > 632 || totals.vercel > 64)
  )
    fail('M04_ALLOWANCE_EXHAUSTED');
  const categoryCount = rows
    .filter(
      (r) =>
        r.event === 'request_intent' &&
        (r.category === category || (category === 'n8n' && r.category === 'n8n_management')),
    )
    .reduce((count, row) => count + (row.charged ?? 1), 0);
  if (['incremental', 'hc01'].includes(scope))
    checkM04IncrementalCharge(totals, categoryCount, category, scope);
  else if (
    categoryCount >=
    ({ n8n: 96, vercel: 64, provider: 256, gateway: 128, callback: 56, database: 32 }[category] ?? 0)
  )
    fail('M04_CATEGORY_EXHAUSTED');
  appendFileSync(
    usage,
    JSON.stringify({
      at: new Date().toISOString(),
      event: 'request_intent',
      category,
      operation,
      ...(scope ? { scope } : {}),
      totals,
    }) + '\n',
  );
}
function result(category, operation, status) {
  appendFileSync(
    usage,
    JSON.stringify({ at: new Date().toISOString(), event: 'request_result', category, operation, status }) +
      '\n',
  );
}
export async function runTask(input, dependencies = {}) {
  if (!validOperation(input?.task, input?.phase ?? 'default')) fail('M04_TASK_INVALID');
  const { task, secrets = {} } = input,
    phase = input.phase ?? 'default';
  const state = structuredClone(input.state ?? {}),
    transports = [];
  const m05 = input.scope === 'm05-subset';
  if (input.scope !== undefined && !['incremental', 'hc01', 'm05-subset'].includes(input.scope))
    fail('M04_SCOPE_INVALID');
  if (m05) {
    if (input.cohort !== undefined || phase === 'cohort' || phase === 'malformed')
      fail('M05_SUBSET_SCOPE_INVALID');
    if (!Object.keys(state).length) {
      const receipt =
        dependencies.baseline ??
        JSON.parse(readFileSync(resolve(root, m05Evidence, 'live-subset-baseline-20261028.json'), 'utf8'));
      const env = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] ? [[key, process.env[key]]] : [],
        ),
      );
      const head =
        dependencies.head ??
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          env,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 5000,
        }).trim();
      initializeM05Subset(state, receipt, head, (dependencies.now ?? Date.now)());
    } else initializeM05Subset(state);
    if (
      task === 'Inventory' &&
      !state.native?.inventoryComplete &&
      !state.native?.pending &&
      !state.deployment
    ) {
      const env = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] ? [[key, process.env[key]]] : [],
        ),
      );
      state.sourceHead =
        dependencies.head ??
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          env,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 5000,
        }).trim();
      const observation =
        dependencies.machineAudience ??
        JSON.parse(
          readFileSync(resolve(root, m05Evidence, 'live-subset-machine-audience-20261028.json'), 'utf8'),
        );
      if (
        observation.credentialId !== 'EmrM03Machine19' ||
        observation.projectId !== 'pHvQjDmjxVZ3KQLT' ||
        observation.allowedDomains !== new URL(state.machineBaseline.audience).hostname ||
        observation.secretRead !== false ||
        observation.mutations !== 0 ||
        !Number.isFinite(Date.parse(observation.recordedAt))
      )
        fail('M05_MACHINE_AUDIENCE_OBSERVATION_REQUIRED');
      state.machineBaseline.observation = observation;
    }
  }
  if (input.scope === 'hc01') {
    const approval = JSON.parse(
      readFileSync(
        resolve(root, 'milestones/M04-collectors-vimeo-instagram/evidence/hc01-dev-approval-20261028.json'),
        'utf8',
      ),
    );
    if (
      (state.scope !== undefined && state.scope !== 'hc01') ||
      approval.approval_id !== '1cf8406c-1142-445e-a237-6d0fd7a67b22' ||
      approval.reviewedHead !== 'bb0cd01d3a6ee239540e73b1d366f86e46b17d42' ||
      approval.environment !== 'dev' ||
      approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      approval.ceilings?.actorStarts !== 22 ||
      approval.ceilings?.actorUsd !== 22 ||
      approval.cumulative?.combined !== 3633 ||
      (state.approvalId && state.approvalId !== approval.approval_id) ||
      (input.cohort !== undefined && (task !== 'Stage' || phase !== 'cohort')) ||
      (task === 'Probe' && phase !== 'default')
    )
      fail('M04_HC01_APPROVAL_REQUIRED');
    state.scope = 'hc01';
    state.approvalId = approval.approval_id;
    if (input.cohort !== undefined) state.cohort = structuredClone(input.cohort);
  }
  if (input.scope === 'incremental') {
    if (state.scope !== undefined && state.scope !== 'incremental') fail('M04_SCOPE_INVALID');
    if (input.cohort !== undefined && (task !== 'Stage' || phase !== 'cohort')) fail('M04_SCOPE_INVALID');
    const approval = JSON.parse(
      readFileSync(
        resolve(
          root,
          'milestones/M04-collectors-vimeo-instagram/evidence/incremental-dev-approval-20261027.json',
        ),
        'utf8',
      ),
    );
    if (
      approval.reviewedHead !== '2c450f40557e7582525d96b5dd63bba2338baa0d' ||
      approval.approval_id !== '123e88b6-5920-4e54-832a-ad6d87c22675' ||
      approval.environment !== 'dev' ||
      approval.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      approval.ceilings?.actorStarts !== 8 ||
      approval.ceilings.actorUsd !== 8 ||
      approval.cumulative?.combined !== 1742 ||
      (state.approvalId && state.approvalId !== approval.approval_id)
    )
      fail('M04_INCREMENTAL_APPROVAL_REQUIRED');
    state.scope = 'incremental';
    state.approvalId = approval.approval_id;
    if (input.cohort !== undefined) state.cohort = structuredClone(input.cohort);
  } else if (!m05 && input.scope !== 'hc01' && (state.scope !== undefined || input.cohort !== undefined))
    fail('M04_SCOPE_INVALID');
  if ((phase === 'cohort' || phase === 'malformed') && !['incremental', 'hc01'].includes(state.scope))
    fail('M04_SCOPE_INVALID');
  if (phase === 'replay' && state.scope === 'incremental') fail('M04_SCOPE_INVALID');
  const now = dependencies.now ?? Date.now;
  const admit =
    dependencies.charge ??
    ((category, operation) =>
      m05 ? chargeM05Request(category, operation) : chargeM04Request(category, operation, state.scope));
  const record =
    dependencies.result ??
    (m05
      ? (category, operation, status) =>
          appendFileSync(
            resolve(root, m05Evidence, 'live-usage-20261028.jsonl'),
            JSON.stringify({
              at: new Date().toISOString(),
              event: 'request_result',
              category,
              operation,
              status,
            }) + '\n',
          )
      : result);
  const deadlineAt = now() + 100000;
  let receipt = { status: 'completed', task, phase, observedAt: new Date(now()).toISOString() };
  const sendJson = (host, apiKey, api, category, extraHeaders = {}) => {
    let permitted;
    const t = (dependencies.jsonTransport ?? privateJsonTransport)(
      {
        host,
        apiKey,
        sensitiveValues: Object.values(secrets).filter((v) => typeof v === 'string'),
        deadlineAt,
        maxBytes: 2097152,
        api,
        extraHeaders,
        statuses: [200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 500],
        allowed: (m, p, b) => permitted?.method === m && permitted?.path === p && permitted?.body === b,
      },
      {
        ...(host !== 'muhhammedsayed.app.n8n.cloud'
          ? { resolveInstance: () => lookup(host, { all: true }) }
          : {}),
        ...dependencies.transport,
      },
    );
    transports.push(t);
    return async (method, path, body = null) => {
      permitted = { method, path, body };
      admit(category, method + ' ' + path);
      const r = await t.send(method, path, body);
      record(category, method + ' ' + path, r.status);
      return r;
    };
  };
  try {
    if (task === 'Inventory' || task === 'Stage' || task === 'Restore') {
      const { runNativeTask } = await import('./m04-native-tasks.mjs');
      const send = sendJson('muhhammedsayed.app.n8n.cloud', secrets.management, 'n8n', 'n8n');
      const native = await runNativeTask({
        phase: task === 'Inventory' ? 'inventory' : task === 'Restore' ? 'restore' : phase,
        state,
        send,
        bindings: JSON.parse(readFileSync(resolve(root, 'n8n/foundation/bindings.dev.json'), 'utf8')),
        repo: root,
        machineToken: secrets.machine,
      });
      receipt = { ...receipt, ...native.public };
    } else if (task === 'Observe') {
      const send = sendJson('muhhammedsayed.app.n8n.cloud', secrets.management, 'n8n', 'n8n');
      const ids = m05
        ? ['F7S8Llr0ZSaSuw4T', 'VbJn4mLYm0sGy1X2', 'h6lUXSGN5sV2jxuQ', 'TsqSMa5MlO3QBLkt']
        : ['4JMHLDBSdgGxhPlk', 'Oq19AMI9C3B1wbo9', 'TsqSMa5MlO3QBLkt'];
      if (['incremental', 'hc01'].includes(state.scope)) ids.unshift('MzimjpsuyPuK7SKe');
      const executions = [];
      for (const id of ids) {
        const r = await send('GET', '/api/v1/executions?workflowId=' + id + '&limit=3&includeData=false');
        if (r.status !== 200 || !Array.isArray(r.body?.data)) fail('M04_EXECUTION_METADATA_UNAVAILABLE');
        for (const e of r.body.data) {
          if (e.workflowId !== id || !/^[0-9]+$/.test(String(e.id))) fail('M04_EXECUTION_IDENTITY_MISMATCH');
          executions.push({
            id: String(e.id),
            workflowId: id,
            status: e.status,
            finished: e.finished,
            mode: e.mode,
            startedAt: e.startedAt,
            stoppedAt: e.stoppedAt,
          });
        }
      }
      state.executions = executions;
      receipt.executions = executions;
      receipt.limitation = 'Native metadata alone does not prove callback/database completion.';
    } else if (task === 'ProviderMetadata') {
      if (state.provider) fail('M04_PROVIDER_ALREADY_RECORDED');
      const authenticated = sendJson('api.apify.com', secrets.apifyRead, 'apify', 'provider');
      const publicRead = sendJson('api.apify.com', 'public-metadata-only', 'no_machine', 'provider');
      const identity = await authenticated('GET', '/v2/users/me');
      if (identity.status !== 200 || !/^[A-Za-z0-9]{1,64}$/.test(identity.body?.data?.id ?? ''))
        fail('M04_APIFY_OWNER_READ_UNAVAILABLE');
      if (m05) {
        const candidate = { owner_id: identity.body.data.id, actors: {} };
        for (const name of ['harvestapi/linkedin-company-posts', 'harvestapi/linkedin-company-employees']) {
          const actor = await publicRead('GET', '/v2/actors/' + name.replace('/', '~'));
          const a = actor.body?.data,
            buildId = a?.taggedBuilds?.latest?.buildId;
          if (
            actor.status !== 200 ||
            a?.username !== 'harvestapi' ||
            a?.name !== name.split('/')[1] ||
            !/^[A-Za-z0-9]{1,64}$/.test(a?.id ?? '') ||
            !/^[A-Za-z0-9]{1,64}$/.test(buildId ?? '')
          )
            fail('M05_ACTOR_METADATA_UNAVAILABLE');
          const build = await publicRead('GET', '/v2/actors/' + a.id + '/builds/' + buildId);
          if (
            build.status !== 200 ||
            build.body?.data?.status !== 'SUCCEEDED' ||
            !/^\d+\.\d+\.\d+$/.test(build.body?.data?.buildNumber ?? '')
          )
            fail('M05_BUILD_METADATA_UNAVAILABLE');
          const schema = await publicRead(
            'GET',
            '/v2/actors/' + a.id + '/builds/' + buildId + '/openapi.json',
          );
          const properties = schema.body?.components?.schemas?.inputSchema?.properties;
          if (schema.status !== 200 || !properties) fail('M05_BUILD_SCHEMA_UNAVAILABLE');
          const pricing = a.pricingInfos ?? a.pricingInfo ?? null;
          if (
            !(Array.isArray(pricing) ? pricing : [pricing]).some((p) => p?.pricingModel === 'PAY_PER_EVENT')
          )
            fail('M05_PPE_PRICING_CONTRACT_REQUIRED');
          candidate.actors[name] = {
            actorId: a.id,
            buildId,
            build: build.body.data.buildNumber,
            pricing,
            inputProperties: properties,
          };
        }
        const policy = m05RunPolicy.parse({
          approval_id: state.approvalId,
          max_actor_starts: 8,
          max_actor_usd: 1,
          max_total_usd: 8,
          max_results_per_profile: 20,
          actors: Object.fromEntries(
            Object.entries(candidate.actors).map(([name, a]) => [
              name,
              {
                actorId: a.actorId,
                buildId: a.buildId,
                build: a.build,
                owner_id: candidate.owner_id,
                billingModel: 'PPE',
              },
            ]),
          ),
        });
        state.provider = candidate;
        state.livePolicy = policy;
        receipt.provider = state.provider;
        receipt.websiteExcluded =
          !Object.hasOwn(state.livePolicy.actors, 'apify/website-content-crawler') &&
          state.accountIds.every(
            (id) => !state.accountSnapshot.find((a) => a.id === id).platform.startsWith('website'),
          );
      } else {
        state.provider = { owner_id: identity.body.data.id };
        const actor = await publicRead('GET', '/v2/actors/apify~instagram-scraper');
        if (
          actor.status !== 200 ||
          actor.body?.data?.username !== 'apify' ||
          actor.body?.data?.name !== 'instagram-scraper'
        )
          fail('M04_ACTOR_METADATA_UNAVAILABLE');
        const a = actor.body.data,
          buildId = state.scope === 'hc01' ? 'yvA3PQRWe95APBdIh' : a.taggedBuilds?.latest?.buildId;
        if (!/^[A-Za-z0-9]{1,64}$/.test(a.id ?? '') || !/^[A-Za-z0-9]{1,64}$/.test(buildId ?? ''))
          fail('M04_BUILD_METADATA_UNAVAILABLE');
        const build = await publicRead('GET', '/v2/actors/' + a.id + '/builds/' + buildId);
        if (
          build.status !== 200 ||
          build.body?.data?.status !== 'SUCCEEDED' ||
          !/^\d+\.\d+\.\d+$/.test(build.body?.data?.buildNumber ?? '')
        )
          fail('M04_BUILD_METADATA_UNAVAILABLE');
        const openapi = await publicRead(
          'GET',
          '/v2/actors/' + a.id + '/builds/' + buildId + '/openapi.json',
        );
        if (openapi.status !== 200) fail('M04_BUILD_SCHEMA_UNAVAILABLE');
        const schema = openapi.body?.components?.schemas?.inputSchema;
        if (!schema?.properties) fail('M04_BUILD_SCHEMA_UNAVAILABLE');
        Object.assign(state.provider, {
          actorId: a.id,
          buildId,
          build: build.body.data.buildNumber,
          pricing: a.pricingInfos ?? a.pricingInfo ?? null,
          inputSchema: schema,
        });
        receipt.provider = state.provider;
      }
    } else if (task === 'Probe') {
      const audience = state.deployment?.audience;
      if (
        !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience ?? '') ||
        (phase !== 'default' && !state.native?.published)
      )
        fail('M04_PROBE_SETUP_REQUIRED');
      if (phase === 'default') {
        const host = new URL(audience).hostname,
          endpoint = '/api/internal/n8n/collectors';
        const notification = {
          version: 1,
          requestId: randomUUID(),
          operation: 'callback.classify',
          args: { apify_run_id: 'M04Unknown' + randomUUID().replaceAll('-', '') },
        };
        const bypass = { 'x-vercel-protection-bypass': state.protectionBypass };
        const goodSend = sendJson(host, secrets.machine, 'gateway', 'gateway', bypass);
        const tests = [
          ['restricted_identity', goodSend, notification, 200],
          [
            'missing_machine',
            sendJson(host, 'public-probe-only', 'no_machine', 'gateway', bypass),
            notification,
            401,
          ],
          [
            'cookie_rejected',
            sendJson(host, secrets.machine, 'gateway', 'gateway', { ...bypass, cookie: 'm04_probe=1' }),
            notification,
            403,
          ],
          [
            'arbitrary_operation_rejected',
            goodSend,
            { ...notification, requestId: randomUUID(), operation: 'sql' },
            400,
          ],
          [
            'unselected_account_rejected',
            goodSend,
            {
              version: 1,
              requestId: randomUUID(),
              operation: m05 ? 'm05.resolve' : 'resolve',
              args: {
                account_id: '00000000-0000-4000-8000-000000000004',
                external_id: null,
                uploads_playlist_id: null,
              },
            },
            403,
          ],
        ];
        if (m05)
          tests.push([
            'website_actor_rejected',
            goodSend,
            {
              version: 1,
              requestId: randomUUID(),
              operation: 'm05.launch',
              args: {
                run_id: randomUUID(),
                launch_id: randomUUID(),
                actor_id: 'apify/website-content-crawler',
                pass: 'primary',
                account_ids: [state.selection.linkedin[0]],
                purpose: 'backfill',
                results_limit: 1,
                actor_input: {},
                urls: ['https://everyone.film/'],
                crawler_type: 'cheerio',
              },
            },
            403,
          ]);
        receipt.probes = [];
        for (const [name, send, body, status] of ['incremental', 'hc01'].includes(state.scope)
          ? tests.slice(0, 2)
          : tests) {
          const r = await send('POST', endpoint, body);
          const expectedCode = {
            missing_machine: 'unauthorized',
            cookie_rejected: 'forbidden',
            arbitrary_operation_rejected: 'invalid_request',
            unselected_account_rejected: 'account_not_permitted',
            website_actor_rejected: 'actor_start_not_authorized',
          }[name];
          receipt.probes.push({
            name,
            status: r.status,
            ...(expectedCode
              ? { errorCode: r.body?.error?.code }
              : {
                  version: r.body?.version,
                  requestId: r.body?.requestId,
                  operation: r.body?.operation,
                  replayed: r.body?.replayed,
                }),
          });
          if (
            r.status !== status ||
            (name === 'restricted_identity' &&
              (r.body?.result?.scope !== 'unknown' ||
                r.body?.version !== 1 ||
                r.body?.requestId !== body.requestId ||
                r.body?.operation !== body.operation ||
                typeof r.body?.replayed !== 'boolean')) ||
            (expectedCode && r.body?.error?.code !== expectedCode)
          )
            fail('M04_ACCESS_ASSERTION_FAILED');
        }
        state.accessVerified = true;
      } else if (phase === 'malformed') {
        if (state.native?.errorHandler?.current?.active !== true) fail('M04_ERROR_WORKFLOW_NOT_PUBLISHED');
        const send = sendJson(
          'muhhammedsayed.app.n8n.cloud',
          'public-callback-probe',
          'no_machine',
          'callback',
        );
        admit('gateway', 'WF-90-M04 bounded automatic error log');
        const r = await send('POST', '/webhook/emr-apify-callback', { eventType: 'M04.INVALID.CALLBACK' });
        if (r.status !== 500) fail('M04_AUTOMATIC_ERROR_PROBE_UNCONFIRMED');
        receipt.callback = {
          phase,
          status: r.status,
          providerCalls: 0,
          limitation: 'Automatic error delivery requires exact native execution and database audit readback.',
        };
      } else {
        // Only a terminal owned-run ID projected by the reviewed DB assertion
        // may supply a replay. Unknown-run deliberately uses a new fake ID.
        const run =
          phase === 'replay' && m05
            ? state.functional?.replayRunId
            : phase === 'replay'
              ? bindOwnedInstagramReplay(
                  state,
                  JSON.parse(
                    readFileSync(
                      resolve(
                        root,
                        'milestones/M04-collectors-vimeo-instagram/evidence/live-instagram-first-assertions-20261027.json',
                      ),
                      'utf8',
                    ),
                  ),
                  JSON.parse(
                    readFileSync(
                      resolve(
                        root,
                        'milestones/M04-collectors-vimeo-instagram/evidence/live-test-approval-20261027.json',
                      ),
                      'utf8',
                    ),
                  ),
                )
              : 'M04Unknown' + randomUUID().replaceAll('-', '');
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(run ?? '')) fail('M04_OWNED_CALLBACK_ID_REQUIRED');
        const send = sendJson(
          'muhhammedsayed.app.n8n.cloud',
          'public-callback-probe',
          'no_machine',
          'callback',
        );
        // Incoming delivery and outgoing WF-19 calls are distinct. Retain this
        // reviewed nested bound even if the incoming response is ambiguous.
        for (const operation of phase === 'replay'
          ? ['callback.classify', 'callback.process']
          : ['callback.classify'])
          admit('gateway', 'WF-19 ' + phase + ' nested bound ' + operation);
        const r = await send('POST', '/webhook/emr-apify-callback', {
          eventType: 'ACTOR.RUN.SUCCEEDED',
          resource: { id: run },
        });
        if (
          r.status !== (phase === 'replay' ? 200 : 403) ||
          (phase === 'replay' ? r.body?.replayed !== true : r.body?.rejected !== true)
        )
          fail('M04_CALLBACK_ASSERTION_FAILED');
        receipt.callback = {
          phase,
          apifyRunId: run,
          status: r.status,
          replayed: r.body.replayed ?? false,
          rejected: r.body.rejected ?? false,
        };
      }
    } else if (task === 'Setup' && phase === 'prepare') {
      const { runVercelTask } = await import('./m04-vercel-tasks.mjs');
      const prepared = await runVercelTask({
        phase,
        state,
        secrets,
        repo: root,
        send: () => fail('M04_PREPARE_NETWORK_FORBIDDEN'),
      });
      receipt = { ...receipt, ...prepared.public };
      if (state.scope === 'incremental' && prepared.public.status === 'completed') {
        state.orchestratorSelection = {
          mode: 'backfill',
          vimeo_account_ids: state.accountSnapshot
            .filter((a) => a.platform === 'vimeo' && ['C130', 'C270', 'C226'].includes(a.company_code))
            .map((a) => a.id),
          instagram_account_ids: [...state.selection.instagram],
          max_pages: 2,
          page_size: 20,
          results_limit: 50,
          max_actor_starts: 2,
        };
      }
    } else if (task === 'Setup') {
      const meta = readFoundationVercelAuthMetadata();
      if (
        (['project', 'configure'].includes(phase) && meta.covers75Minutes !== true) ||
        meta.unexpired !== true
      )
        fail('M04_VERCEL_SESSION_COVERAGE_REQUIRED');
      const t = createFoundationLiveSetupCliTransport({
        authorizeRequest: () => true,
        now,
        deadlineAt,
        nodeExecutable: process.execPath,
        cliPath: resolve(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js'),
        noRetryPreloadPath: resolve(root, 'scripts/n8n/foundation-live-setup-no-retry.mjs'),
        workingDirectory: root,
      });
      transports.push(t);
      const send = async (method, path, body) => {
        admit('vercel', method + ' ' + path);
        const r = await t.request({
          method,
          path,
          ...(body === undefined ? {} : { body }),
          signal: AbortSignal.timeout(25000),
        });
        record('vercel', method + ' ' + path, r.status);
        return r;
      };
      if (phase !== 'project') {
        const { runVercelTask } = await import('./m04-vercel-tasks.mjs');
        const setup = await runVercelTask({ phase, state, secrets, repo: root, send });
        receipt = { ...receipt, ...setup.public };
      } else {
        const p = await send('GET', `/v9/projects/${project}?teamId=${team}`);
        const e = await send('GET', `/v10/projects/${project}/env?decrypt=false&teamId=${team}`);
        if (p.status !== 200 || p.data?.id !== project || e.status !== 200 || !Array.isArray(e.data?.envs))
          fail('M04_VERCEL_PROJECT_READ_FAILED');
        const names = [
          'ENABLED',
          'COMMIT_SHA',
          'WRITER_PASSWORD',
          'TOKEN_SHA256',
          'APIFY_READ_TOKEN',
          'ACCOUNT_IDS',
          'LIVE_POLICY',
        ].map((v) => 'EMR_COLLECTORS_' + v);
        const conflicts = e.data.envs.filter(
          (x) =>
            names.includes(x.key) &&
            (x.gitBranch === (m05 ? 'm05-collectors-web-youtube-linkedin' : branch) || !x.gitBranch),
        );
        const bypassCount = Object.keys(p.data.protectionBypass ?? {}).length;
        state.vercelBaseline = { project: p.data, environments: e.data.envs };
        if (m05) state.projectBaseline = p.data;
        receipt.vercel = {
          projectId: p.data.id,
          name: p.data.name,
          protection: p.data.ssoProtection,
          existingBypassCount: bypassCount,
          environmentConflicts: conflicts.map((x) => ({
            id: x.id,
            key: x.key,
            target: x.target,
            gitBranch: x.gitBranch,
          })),
        };
        if (bypassCount || conflicts.length) fail('M04_EXISTING_OWNERSHIP_CONFLICT');
      }
    } else fail('M04_PHASE_NOT_IMPLEMENTED');
  } catch (error) {
    receipt = {
      ...receipt,
      status: 'blocked',
      code: /^M0[45]_[A-Z0-9_]+$/.test(error?.message ?? '')
        ? error.message
        : 'M04_TRANSPORT_OR_CONTRACT_FAILURE',
    };
  } finally {
    for (const t of transports) {
      try {
        const closed = await t.close();
        const remaining = t.state?.();
        if (closed === false || remaining?.pendingRequests > 0 || remaining?.unclosedResponses > 0)
          fail('M04_TRANSPORT_CLOSE_FAILED');
      } catch {
        receipt.status = 'blocked';
        receipt.code = 'M04_TRANSPORT_CLOSE_FAILED';
      }
    }
  }
  return { public: receipt, private: state };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let chunks = [],
    size = 0;
  try {
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 8388608) fail('M04_INPUT_TOO_LARGE');
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    chunks = [];
    process.stdout.write(JSON.stringify(await runTask(input)));
  } catch {
    process.stdout.write(JSON.stringify({ public: { status: 'blocked', code: 'M04_TASK_INPUT_FAILURE' } }));
    process.exitCode = 1;
  }
}
