// Fixed M04 product operations. Native workflows perform collection; this file
// only reuses existing TLS transports for the approved setup and readbacks.
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { privateJsonTransport } from './foundation-live-runtime-transport.mjs';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { readFoundationVercelAuthMetadata } from './foundation-vercel-auth-preflight.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu';
const team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const branch = 'm04-collectors-vimeo-instagram';
const usage = resolve(root, 'milestones/M04-collectors-vimeo-instagram/evidence/live-usage-20261027.jsonl');
const fail = (code) => {
  throw Error(code);
};
export function validOperation(task, phase) {
  return (
    {
      Inventory: ['default'],
      ProviderMetadata: ['default'],
      Setup: ['project', 'prepare', 'configure', 'poll', 'cleanup'],
      Stage: ['stage', 'publish', 'machine'],
      Observe: ['default'],
      Probe: ['default', 'replay', 'unknown'],
      Restore: ['native'],
    }[task]?.includes(phase) === true
  );
}
function charge(category, operation) {
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
  if (totals.management > 160 || totals.control > 472 || totals.combined > 632 || totals.vercel > 64)
    fail('M04_ALLOWANCE_EXHAUSTED');
  const categoryCount = rows
    .filter(
      (r) =>
        r.event === 'request_intent' &&
        (r.category === category || (category === 'n8n' && r.category === 'n8n_management')),
    )
    .reduce((count, row) => count + (row.charged ?? 1), 0);
  if (
    categoryCount >=
    ({ n8n: 96, vercel: 64, provider: 256, gateway: 128, callback: 56, database: 32 }[category] ?? 0)
  )
    fail('M04_CATEGORY_EXHAUSTED');
  appendFileSync(
    usage,
    JSON.stringify({ at: new Date().toISOString(), event: 'request_intent', category, operation, totals }) +
      '\n',
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
  const now = dependencies.now ?? Date.now;
  const admit = dependencies.charge ?? charge;
  const record = dependencies.result ?? result;
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
        statuses: [200, 201, 202, 204, 400, 401, 403, 404, 409, 422],
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
      const ids = ['4JMHLDBSdgGxhPlk', 'Oq19AMI9C3B1wbo9', 'TsqSMa5MlO3QBLkt'];
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
      state.provider = { owner_id: identity.body.data.id };
      const actor = await publicRead('GET', '/v2/actors/apify~instagram-scraper');
      if (
        actor.status !== 200 ||
        actor.body?.data?.username !== 'apify' ||
        actor.body?.data?.name !== 'instagram-scraper'
      )
        fail('M04_ACTOR_METADATA_UNAVAILABLE');
      const a = actor.body.data,
        buildId = a.taggedBuilds?.latest?.buildId;
      if (!/^[A-Za-z0-9]{1,64}$/.test(a.id ?? '') || !/^[A-Za-z0-9]{1,64}$/.test(buildId ?? ''))
        fail('M04_BUILD_METADATA_UNAVAILABLE');
      const build = await publicRead('GET', '/v2/actors/' + a.id + '/builds/' + buildId);
      if (
        build.status !== 200 ||
        build.body?.data?.status !== 'SUCCEEDED' ||
        !/^\d+\.\d+\.\d+$/.test(build.body?.data?.buildNumber ?? '')
      )
        fail('M04_BUILD_METADATA_UNAVAILABLE');
      const openapi = await publicRead('GET', '/v2/actors/' + a.id + '/builds/' + buildId + '/openapi.json');
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
    } else if (task === 'Probe') {
      const audience = state.deployment?.audience;
      if (
        !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience ?? '') ||
        !state.native?.published
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
              operation: 'resolve',
              args: {
                account_id: '00000000-0000-4000-8000-000000000004',
                external_id: null,
                uploads_playlist_id: null,
              },
            },
            403,
          ],
        ];
        receipt.probes = [];
        for (const [name, send, body, status] of tests) {
          const r = await send('POST', endpoint, body);
          receipt.probes.push({ name, status: r.status });
          if (r.status !== status || (name === 'restricted_identity' && r.body?.result?.scope !== 'unknown'))
            fail('M04_ACCESS_ASSERTION_FAILED');
        }
        state.accessVerified = true;
      } else {
        // Only a terminal owned-run ID projected by the reviewed DB assertion
        // may supply a replay. Unknown-run deliberately uses a new fake ID.
        const run =
          phase === 'replay'
            ? state.functional?.replayRunId
            : 'M04Unknown' + randomUUID().replaceAll('-', '');
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(run ?? '')) fail('M04_OWNED_CALLBACK_ID_REQUIRED');
        const send = sendJson(
          'muhhammedsayed.app.n8n.cloud',
          'public-callback-probe',
          'no_machine',
          'callback',
        );
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
          (x) => names.includes(x.key) && (x.gitBranch === branch || !x.gitBranch),
        );
        const bypassCount = Object.keys(p.data.protectionBypass ?? {}).length;
        state.vercelBaseline = { project: p.data, environments: e.data.envs };
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
      code: /^M04_[A-Z0-9_]+$/.test(error?.message ?? '')
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
