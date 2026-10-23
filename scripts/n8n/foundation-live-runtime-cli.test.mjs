import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runFoundationLiveRuntimeCli,
  createFoundationLiveAcceptanceSession,
  projectFoundationBaselineDiagnostic,
} from './foundation-live-runtime-cli.mjs';
import * as liveSql from './foundation-live-runtime-cli.mjs';
import { fixture } from './foundation-live-runtime-fixtures.mjs';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';

const privatePacket = () => ({
  kind: 'm03_acceptance_private_input',
  version: 1,
  approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
  sourceCommitSha: 'a'.repeat(40),
  managementKey: 'SYNTHETIC_PRIVATE_MANAGEMENT',
  writerPassword: 'SYNTHETIC_PRIVATE_WRITER',
  apifyReadToken: 'SYNTHETIC_PRIVATE_APIFY_READ',
  machineToken: 'M'.repeat(43),
  protectionBypass: 'B'.repeat(32),
  leaseExpiry: Date.now() + 7200000,
});

const replaySnapshot = () => ({
  items: 1,
  rawSnapshots: 1,
  aiExtractQueue: 1,
  embedQueue: 1,
  mediaQueue: 0,
  costEntries: 1,
  itemsSha256: 'a'.repeat(64),
  rawSnapshotsSha256: 'b'.repeat(64),
  queuesSha256: 'c'.repeat(64),
  costsSha256: 'd'.repeat(64),
});
test('strict replay parity validates exactly six counts/four hashes and ignores property order', () => {
  const before = replaySnapshot(),
    after = Object.fromEntries(Object.entries(before).reverse());
  assert.equal(liveSql.verifyFoundationLiveReplaySnapshots(before, after), true);
  const malformed = [
    undefined,
    null,
    {},
    [],
    { ...before, extra: true },
    { ...before, items: -1 },
    { ...before, items: 0.5 },
    { ...before, items: Number.MAX_SAFE_INTEGER + 1 },
    { ...before, items: NaN },
    { ...before, items: '1' },
    { ...before, itemsSha256: 'A'.repeat(64) },
    { ...before, costsSha256: 'd'.repeat(63) },
  ];
  const missing = { ...before };
  delete missing.items;
  malformed.push(missing);
  const symbol = { ...before, [Symbol('SYNTHETIC_PRIVATE_FIELD')]: true };
  malformed.push(symbol);
  const accessor = { ...before };
  Object.defineProperty(accessor, 'items', {
    enumerable: true,
    get() {
      throw Error('SYNTHETIC_PRIVATE_SQL');
    },
  });
  malformed.push(accessor);
  for (const bad of malformed) {
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(bad, bad),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(before, bad),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
  }
  for (const change of [{ items: 2 }, { costsSha256: 'e'.repeat(64) }])
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(before, { ...before, ...change }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
});
function callbackSqlFixture(options = {}) {
  const {
    caseId = 'callback.equal_replay',
    readFault,
    cleanup = true,
    cleanupFault = false,
    nativeState = 'native_settled',
  } = options;
  const before = Object.hasOwn(options, 'before') ? options.before : replaySnapshot(),
    after = Object.hasOwn(options, 'after') ? options.after : replaySnapshot();
  const calls = [],
    events = [];
  let reads = 0;
  return {
    calls,
    events,
    run: () =>
      liveSql.verifyFoundationLiveCallbackSqlCase({
        caseId,
        async readSnapshot() {
          calls.push('read' + reads);
          if (readFault === reads++) throw Error('SYNTHETIC_PRIVATE_SQL');
          return reads === 1 ? before : after;
        },
        async start() {
          calls.push('native');
          return { state: nativeState, caseId, executionIds: ['123', '124'] };
        },
        async cleanup() {
          calls.push('cleanup');
          if (cleanupFault) throw Error('SYNTHETIC_PRIVATE_CLEANUP');
          return cleanup;
        },
        append(event) {
          calls.push('append');
          events.push(event);
        },
        now: () => Date.parse('2026-10-23T12:00:00Z'),
      }),
  };
}
test('callback and concurrent-pair parity read before start/after settlement and clean exact native records', async () => {
  for (const caseId of [
    'callback.unknown',
    'callback.equal_replay',
    'callback.concurrent_pair',
    'callback.recovery_drill',
  ]) {
    const f = callbackSqlFixture({
        caseId,
        after: Object.fromEntries(Object.entries(replaySnapshot()).reverse()),
      }),
      r = await f.run();
    assert.equal(r.status, 'native_settled_and_cleaned');
    assert.equal(r.residual, false);
    assert.deepEqual(f.calls, ['read0', 'native', 'read1', 'append', 'cleanup']);
    assert.deepEqual(f.events, [
      {
        event: 'callback_replay_sql_parity_verified',
        caseId,
        countsUnchanged: true,
        hashesUnchanged: true,
        at: '2026-10-23T12:00:00.000Z',
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(r) + JSON.stringify(f.events),
      /SYNTHETIC_PRIVATE|Sha256|aaaa|bbbb|cccc|dddd/,
    );
  }
});
test('undefined/malformed/failed pre-callback SQL prevents every native start', async () => {
  for (const options of [{ before: undefined }, { before: {} }, { readFault: 0 }]) {
    const f = callbackSqlFixture(options);
    await assert.rejects(f.run(), /FOUNDATION_LIVE_CHILD_BLOCKED/);
    assert.deepEqual(f.calls, ['read0']);
    assert.deepEqual(f.events, []);
  }
  for (const caseId of ['callback.not_owned', 'callback.concurrent_a', 'callback.concurrent_b', undefined]) {
    let queries = 0;
    await assert.rejects(
      liveSql.verifyFoundationLiveCallbackSqlCase({
        caseId,
        readSnapshot() {
          queries++;
          return replaySnapshot();
        },
        start() {
          throw Error('UNEXPECTED_START');
        },
        cleanup() {
          throw Error('UNEXPECTED_CLEANUP');
        },
        append() {
          throw Error('UNEXPECTED_APPEND');
        },
      }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
    assert.equal(queries, 0);
  }
});
test('changed/malformed/failed post-callback SQL still cleans and reports unresolved SQL without parity evidence', async () => {
  for (const options of [
    { after: { ...replaySnapshot(), items: 2 } },
    { after: {} },
    { readFault: 1 },
    { after: { ...replaySnapshot(), costsSha256: 'e'.repeat(64) }, cleanup: false },
  ]) {
    const f = callbackSqlFixture(options),
      r = await f.run();
    assert.equal(r.status, 'sql_acceptance_unresolved');
    assert.equal(r.residual, true);
    assert.deepEqual(f.calls, ['read0', 'native', 'read1', 'cleanup']);
    assert.deepEqual(f.events, []);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE/);
  }
});
test('successful SQL cannot conceal native or cleanup failure', async () => {
  for (const options of [{ cleanup: false }, { cleanupFault: true }]) {
    const f = callbackSqlFixture(options),
      r = await f.run();
    assert.equal(r.status, 'cleanup_unresolved');
    assert.equal(r.residual, true);
    assert.equal(f.events.length, 1);
  }
  const f = callbackSqlFixture({ nativeState: 'native_unresolved' }),
    r = await f.run();
  assert.equal(r.status, 'native_unresolved');
  assert.equal(r.residual, true);
  assert.deepEqual(f.calls, ['read0', 'native']);
  assert.deepEqual(f.events, []);
});

test('baseline diagnostic projection exposes only fixed codes and component booleans', () => {
  const diagnostic = {
    version: 1,
    workflowKey: 'WF-00',
    failedChecks: ['version_mismatch'],
    components: { nameEqual: true, nodesEqual: true, connectionsEqual: true, settingsEqual: true },
  };
  assert.deepEqual(projectFoundationBaselineDiagnostic({ diagnostics: () => diagnostic }), {
    baselineWorkflowKey: 'WF-00',
    baselineFailureCodes: ['version_mismatch'],
    baselineNameEqual: true,
    baselineNodesEqual: true,
    baselineConnectionsEqual: true,
    baselineSettingsEqual: true,
  });
  for (const value of [
    null,
    { ...diagnostic, raw: 'PRIVATE_DIAGNOSTIC_CANARY' },
    { ...diagnostic, workflowKey: 'PRIVATE_DIAGNOSTIC_CANARY' },
    { ...diagnostic, failedChecks: ['PRIVATE_DIAGNOSTIC_CANARY'] },
    { ...diagnostic, components: { ...diagnostic.components, nameEqual: 'PRIVATE_DIAGNOSTIC_CANARY' } },
  ])
    assert.deepEqual(projectFoundationBaselineDiagnostic({ diagnostics: () => value }), {});
  assert.deepEqual(
    projectFoundationBaselineDiagnostic({
      diagnostics() {
        throw Error('PRIVATE_DIAGNOSTIC_CANARY');
      },
    }),
    {},
  );
});

test('effectful continuation reaches the actual session constructor with retained counters and diagnostic, without starting a child', async () => {
  const f = await syntheticProjectVerifiedContinuation({ effectful: true });
  let session;
  try {
    const proof = f.claim(f.admit());
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    for (const name of ['bindings.dev.json', 'transport.dev.json'])
      f.put(
        'n8n/foundation/' + name,
        readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url), 'utf8'),
      );
    for (const key of Object.keys(bindings.workflowRefs))
      f.put(
        'n8n/workflows/' + key + '.json',
        readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url), 'utf8'),
      );
    const copied = await f.copy('foundation-live-runtime-cli.mjs');
    session = f.scoped(() =>
      copied.createFoundationLiveAcceptanceSession(
        {
          ...privatePacket(),
          sourceCommitSha: proof.sourceCommitSha,
          leaseExpiry: f.now() + 7200000,
        },
        () => {},
        {
          now: f.now,
          projectVerifiedContinuationProof: proof,
          startAdmin() {
            throw Error('UNEXPECTED_CHILD');
          },
        },
      ),
    );
    const result = await session.command({
      kind: 'm03_acceptance_command',
      id: 'retained',
      command: 'state',
    });
    assert.equal(result.managementAttempts, 13);
    assert.equal(result.controlAttempts, 251);
    assert.equal(result.nativeExecutions, 0);
    assert.equal(result.status, 'not_prepared');
  } finally {
    if (session) await session.close();
    f.cleanup();
  }
});

test('public CLI CheckOnly reads no handoff, launches nothing and does not claim a verified MCP port', async () => {
  const output = new PassThrough();
  let text = '';
  output.on('data', (b) => {
    text += b;
  });
  const code = await runFoundationLiveRuntimeCli({ output, args: ['CheckOnly'] });
  const r = JSON.parse(text);
  assert.equal(code, 0);
  assert.equal(r.privateRead, false);
  assert.equal(r.networkCalls, 0);
  assert.equal(r.actualMcpPortVerified, false);
  assert.equal(r.controlMaximum, 2048);
  assert.equal(r.managementMaximum, 512);
});

test('persistent private input followed by fixed state/close uses no credentials outside child and no hosted calls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-protocol-test-'));
  const input = new PassThrough(),
    output = new PassThrough(),
    packet = privatePacket();
  let text = '',
    buffer = '',
    started = 0;
  output.on('data', (b) => {
    text += b;
    buffer += b;
    while (buffer.includes('\n')) {
      const at = buffer.indexOf('\n'),
        r = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      if (r.kind === 'm03_acceptance_ready')
        input.write(
          JSON.stringify({ kind: 'm03_acceptance_command', id: 'status1', command: 'state' }) + '\n',
        );
      if (r.kind === 'm03_acceptance_result')
        input.write(
          JSON.stringify({ kind: 'm03_acceptance_command', id: 'close1', command: 'close' }) + '\n',
        );
    }
  });
  try {
    const running = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: {
        storage: { directory },
        startAdmin() {
          started++;
          throw Error('UNEXPECTED');
        },
      },
    });
    input.write(JSON.stringify(packet) + '\n');
    assert.equal(await running, 0);
    assert.equal(started, 0);
    for (const k of ['managementKey', 'writerPassword', 'apifyReadToken', 'machineToken', 'protectionBypass'])
      assert.equal(text.includes(packet[k]), false);
    const frames = text.trim().split('\n').map(JSON.parse);
    assert.equal(frames.at(-1).kind, 'm03_acceptance_closed');
    assert.equal(frames.at(-1).residual, false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
  } finally {
    input.destroy();
    output.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unapproved first DTO and arbitrary public command fail closed without echoing input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-reject-test-'));
  try {
    const input = new PassThrough(),
      output = new PassThrough();
    let text = '';
    output.on('data', (b) => {
      text += b;
    });
    const run = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: { storage: { directory } },
    });
    const packet = privatePacket();
    packet.approvedHead = 'f'.repeat(40);
    input.write(JSON.stringify(packet) + '\n');
    assert.equal(await run, 1);
    assert.equal(text.includes(packet.writerPassword), false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
    input.destroy();
    output.destroy();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fixed minute50 admission stop closes the same persistent child without a new action window', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-stop-test-'));
  const input = new PassThrough(),
    output = new PassThrough();
  let text = '',
    delay;
  output.on('data', (b) => {
    text += b;
  });
  try {
    const running = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: {
        storage: { directory },
        setStopTimer(fn, ms) {
          delay = ms;
          setImmediate(fn);
          return undefined;
        },
      },
    });
    input.write(JSON.stringify(privatePacket()) + '\n');
    assert.equal(await running, 0);
    assert.ok(delay > 2999000 && delay <= 3000000);
    const rows = text.trim().split('\n').map(JSON.parse);
    assert.equal(rows.at(-1).kind, 'm03_acceptance_closed');
    assert.equal(rows.at(-1).childTransportsClosed, true);
    assert.equal(rows.at(-1).nativeExecutions, 0);
    assert.equal(rows.at(-1).residual, false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
  } finally {
    input.destroy();
    output.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const mode of [
  'normal',
  'sql_close_failure',
  'writer_close_unknown_ack',
  'writer_close_unknown_native_end',
  'graph_restore_failure',
  'identity_replayed',
  'identity_wrong_request',
  'identity_unstarted',
  'admin_abort_missing_descendants',
  'setup_expired',
  'setup_http',
  'setup_contract',
  'setup_unknown_diagnostics',
  'setup_throwing_diagnostics',
  'setup_missing_diagnostics',
  'setup_malformed_diagnostics',
  'setup_foreign_bypass',
])
  test('same-child exact route / independent shutdown: ' + mode, async () => {
    let restoreFault = false;
    const f = fixture({
        fault({ method, path }) {
          if (restoreFault && method === 'POST' && path.endsWith('/unpublish'))
            throw Error('SYNTHETIC_UNKNOWN_RESTORE');
        },
      }),
      packet = privatePacket();
    const rows = [],
      envs = [],
      wire = [],
      bypass = {};
    let adminClosed = false,
      adminEnded = false,
      adminAborted = false,
      aborts = 0,
      writerCloseCalls = 0;
    const finalAdminReceipt = () => ({
      childrenClosed: true,
      handoffDeleted: true,
      leaseDeleted: true,
      scratchDeleted: true,
    });
    const projectId = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      teamId = 'team_gboXPxTevpCOZuaA8eY9PmR1';
    const audience = 'https://everyone-market-researcher-synthetic-session.vercel.app';
    const admin = {
      postcheck: async () => ({ ready: true, projectRef: 'zmotjsbzhzjvpelxvxlf', migrationCount: 14 }),
      fixture: async () => ({
        result: 'M03_SMOKE_FIXTURE_READY',
        company_code: 'C999',
        competitor_id: '11111111-1111-4111-a111-111111111111',
        account_id: '22222222-2222-4222-a222-222222222222',
        platform: 'website_work_page',
        url: 'https://everyone.film/about-everyone',
        competitor_status: 'active',
        account_status: 'active',
      }),
      preflight: async () => ({
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        dailyBudgetUsd: 25,
        statsDailyEnabled: false,
        errorCount24h: 0,
        notificationCooldownClear: true,
        priceBook: { 'apify/website-content-crawler': { unit: 'compute unit', usd: 0.3 } },
      }),
      provision: async () => ({
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        boundAudience: audience,
        boundCommitSha: packet.sourceCommitSha,
        boundDeploymentId: 'dpl_SyntheticSession',
        started: false,
        closed: false,
        totalAdmitted: 0,
        approvalCount: 1,
      }),
      close: async () => {
        assert.equal(writerCloseCalls, 1, 'restricted Writer precedes independent Admin readback');
        if (mode === 'sql_close_failure') throw Error('PRIVATE_UNKNOWN_CLOSE');
        adminClosed = true;
        return { state: 'closed', window: { id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9', closed: true } };
      },
      archive: async () => ({ result: 'M03_SMOKE_FIXTURE_ARCHIVED' }),
      end: async () => {
        if (!adminClosed || mode === 'admin_abort_missing_descendants') throw Error('PRIVATE_END_REFUSED');
        adminEnded = true;
        return { nativeExit: 0, childClosed: true, receipt: finalAdminReceipt() };
      },
      abort: async () => {
        adminAborted = true;
        aborts++;
        return {
          nativeExit: 1,
          childClosed: true,
          receipt: mode === 'admin_abort_missing_descendants' && aborts === 1 ? null : finalAdminReceipt(),
        };
      },
      state: () => ({ requestPending: false }),
    };
    const nativeTransport = {
      request: async ({ path }) => {
        wire.push(path);
        return {
          status: 200,
          body: (async function* () {
            yield Buffer.from(JSON.stringify({ data: [], nextCursor: null }));
          })(),
          closed: Promise.resolve(),
        };
      },
      close() {},
      state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    };
    const setupTransport = {
      async request(spec) {
        let data,
          status = 200;
        if (mode.startsWith('setup_')) {
          assert.equal(spec.method, 'GET');
          assert.equal(spec.path, '/v9/projects/' + projectId + '?teamId=' + teamId);
          if (!['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode))
            throw Error('SYNTHETIC_PRIVATE_TRANSPORT_FAILURE');
          if (mode === 'setup_http')
            return { status: 401, data: { error: packet.writerPassword }, closed: true };
        }
        if (spec.path.startsWith('/v9/projects/') && spec.method === 'GET')
          data = {
            id: projectId,
            accountId: teamId,
            rootDirectory: 'apps/web',
            nodeVersion: mode === 'setup_contract' ? '20.x' : '24.x',
            framework: 'nextjs',
            link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
            ssoProtection: { deploymentType: 'all_except_custom_domains' },
            protectionBypass:
              mode === 'setup_foreign_bypass'
                ? { SYNTHETIC_UNRELATED: { scope: 'automation-bypass', isEnvVar: true } }
                : structuredClone(bypass),
          };
        else if (spec.path.includes('/protection-bypass')) {
          const b = spec.body;
          if (b.generate)
            bypass[b.generate.secret] = {
              scope: 'automation-bypass',
              note: b.generate.note,
              isEnvVar: false,
              createdAt: Date.now(),
            };
          if (b.revoke) delete bypass[b.revoke.secret];
          data = { protectionBypass: structuredClone(bypass) };
        } else if (spec.path.includes('/env') && spec.method === 'GET')
          data = { envs: structuredClone(envs), pagination: { next: null } };
        else if (spec.path.includes('/env') && spec.method === 'POST') {
          const b = spec.body;
          const row = {
            id: 'env' + envs.length,
            key: b.key,
            type: b.type,
            target: b.target,
            gitBranch: b.gitBranch,
            comment: b.comment,
            createdAt: 1,
            updatedAt: 1,
          };
          envs.push(row);
          data = { created: row, failed: [] };
        } else if (spec.path.includes('/env/') && spec.method === 'DELETE') {
          envs.splice(
            envs.findIndex((e) => spec.path.includes('/' + e.id + '?')),
            1,
          );
          status = 204;
          data = null;
        } else if (spec.path.startsWith('/v13/deployments'))
          data = {
            id: 'dpl_SyntheticSession',
            projectId,
            target: null,
            url: new URL(audience).host,
            meta: { githubCommitSha: packet.sourceCommitSha, githubCommitRef: 'm03-n8n-foundation' },
            readyState: 'READY',
            createdAt: Date.now(),
          };
        else throw Error('SYNTHETIC_ROUTE_UNSUPPORTED');
        return { status, data, closed: true };
      },
      diagnostics() {
        if (mode === 'setup_throwing_diagnostics') throw Error(packet.writerPassword);
        if (mode === 'setup_missing_diagnostics') return undefined;
        return {
          stage: ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode)
            ? 'completed'
            : 'native_exit',
          code:
            mode === 'setup_unknown_diagnostics'
              ? packet.writerPassword
              : mode === 'setup_expired'
                ? 'saved_auth_expired'
                : 'unknown',
          httpStatus:
            mode === 'setup_malformed_diagnostics'
              ? '200'
              : mode === 'setup_http'
                ? 401
                : ['setup_contract', 'setup_foreign_bypass'].includes(mode)
                  ? 200
                  : null,
          nativeExit: ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode) ? 0 : 1,
          childStarted: true,
          childClosed: true,
          aborted: false,
          stdoutBytes: 1048576,
          stderrBytes: 65536,
          path: 'https://private.invalid/' + packet.writerPassword,
          error: packet.writerPassword,
        };
      },
      state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
      close() {},
    };
    const session = createFoundationLiveAcceptanceSession(
      packet,
      (r) => {
        rows.push(r);
      },
      {
        storage: { directory: f.directory },
        startAdmin: async () => admin,
        createNativeTransport: () => nativeTransport,
        createWriterCloser: (args) => {
          assert.equal(args.password, packet.writerPassword);
          assert.equal(args.sourceCommitSha, packet.sourceCommitSha);
          assert.equal(args.audience, audience);
          assert.equal(args.deploymentId, 'dpl_SyntheticSession');
          return {
            async closeWindow() {
              writerCloseCalls++;
              if (mode === 'writer_close_unknown_ack') throw Error('SYNTHETIC_PRIVATE_WRITER_ACK');
              return { closeVerified: true, connectionClosed: true };
            },
            state: () => ({
              pendingRequests: 0,
              unclosedResponses: mode === 'writer_close_unknown_native_end' ? 1 : 0,
            }),
            close() {},
          };
        },
        createSetupTransport: () => setupTransport,
        // Post-setup unit behavior is isolated behind explicit factory ports.
        // This stub is not a successful real-component/provider setup receipt.
        ...(mode.startsWith('setup_')
          ? {}
          : {
              createSetup: () => ({
                async prepare() {
                  envs.push(...Array.from({ length: 7 }, (_, i) => ({ id: 'synthetic_completed_env_' + i })));
                  return {
                    version: 1,
                    projectId,
                    branch: 'm03-n8n-foundation',
                    sourceCommitSha: packet.sourceCommitSha,
                    deploymentId: 'dpl_SyntheticSession',
                    audience,
                    environment: 'preview',
                    readyState: 'READY',
                    protection: 'all_except_custom_domains',
                    protectionVerified: true,
                    protectionTransportVerified: false,
                    sqlAudienceBindingVerified: false,
                  };
                },
                async cleanup() {
                  envs.length = 0;
                  return { state: 'setup_resources_removed' };
                },
                close() {},
              }),
              assertDeployment: (proof) => proof,
            }),
        setup: { transportValidator: (t) => t },
        runtime: f.dependencies,
        createGatewayProbe: ({ admitGatewayAttempt }) => ({
          async identity({ unauthorized = false } = {}) {
            const requestId = unauthorized
              ? '33333333-3333-4333-a333-333333333333'
              : '44444444-4444-4444-a444-444444444444';
            admitGatewayAttempt({ requestId, unauthorized });
            assert.equal(
              readFileSync(join(f.directory, 'preflight.jsonl'), 'utf8').includes(requestId),
              true,
            );
            if (unauthorized) return { status: 401, body: { error: 'unauthorized' } };
            const probeAt = Date.now();
            return {
              status: 200,
              body: {
                version: 1,
                requestId:
                  mode === 'identity_wrong_request' ? '55555555-5555-4555-a555-555555555555' : requestId,
                outcome: 'completed',
                operation: 'identity.read',
                replayed: mode === 'identity_replayed',
                result: {
                  currentUser: 'n8n_writer',
                  sessionUser: 'n8n_writer',
                  database: 'postgres',
                  projectRef: 'zmotjsbzhzjvpelxvxlf',
                  connectionCount: 1,
                },
                window: {
                  id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
                  startsAt: mode === 'identity_unstarted' ? null : new Date(probeAt - 1000).toISOString(),
                  expiresAt: mode === 'identity_unstarted' ? null : new Date(probeAt + 3599000).toISOString(),
                  totalAdmitted: 1,
                  closed: false,
                  boundAudience: audience,
                  boundCommitSha: packet.sourceCommitSha,
                  boundDeploymentId: 'dpl_SyntheticSession',
                },
              },
            };
          },
          close() {},
          state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
        }),
      },
    );
    try {
      const prepared = await session.command({
        kind: 'm03_acceptance_command',
        id: 'prepare1',
        command: 'prepare',
      });
      if (mode.startsWith('setup_')) {
        assert.equal(prepared.status, 'blocked');
        assert.equal(prepared.residual, true);
        assert.equal(prepared.nativeExecutions, 0);
        assert.equal(prepared.controlAttempts, 50);
        const diagnosticRows = readFileSync(join(f.directory, 'preflight.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map(JSON.parse);
        assert.equal(diagnosticRows.length, 1);
        const receipt = diagnosticRows[0];
        assert.deepEqual(
          Object.keys(receipt).sort(),
          [
            'event',
            'at',
            'stage',
            'code',
            'httpStatus',
            'nativeExit',
            'childStarted',
            'childClosed',
            'aborted',
          ].sort(),
        );
        assert.equal(receipt.event, 'setup_failure_diagnostic');
        assert.ok(Number.isFinite(Date.parse(receipt.at)));
        const unknown = [
          'setup_throwing_diagnostics',
          'setup_missing_diagnostics',
          'setup_malformed_diagnostics',
        ].includes(mode);
        assert.equal(
          receipt.stage,
          unknown
            ? 'unknown'
            : ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode)
              ? 'completed'
              : 'native_exit',
        );
        assert.equal(receipt.code, mode === 'setup_expired' ? 'saved_auth_expired' : 'unknown');
        assert.equal(
          receipt.httpStatus,
          mode === 'setup_http'
            ? 401
            : ['setup_contract', 'setup_foreign_bypass'].includes(mode)
              ? 200
              : null,
        );
        assert.equal(
          receipt.nativeExit,
          unknown ? null : ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode) ? 0 : 1,
        );
        assert.equal(receipt.childStarted, !unknown);
        assert.equal(receipt.childClosed, !unknown);
        assert.equal(receipt.aborted, false);
        const publicJson = JSON.stringify({ prepared, rows, diagnosticRows });
        for (const key of [
          'managementKey',
          'writerPassword',
          'apifyReadToken',
          'machineToken',
          'protectionBypass',
        ])
          assert.equal(publicJson.includes(packet[key]), false);
        assert.equal(publicJson.includes('SYNTHETIC_PRIVATE_TRANSPORT_FAILURE'), false);
        const stopped = await session.close();
        assert.equal(stopped.residual, true);
        assert.equal(stopped.environmentCleanupVerified, true);
        assert.equal(stopped.adminChildClosed, true);
        assert.equal(f.calls.length, 0);
        assert.equal(envs.length, 0);
        assert.equal(Object.keys(bypass).length, 0);
        return;
      }
      const identityFailure = mode.startsWith('identity_');
      assert.equal(prepared.status, identityFailure ? 'blocked' : 'dev_runtime_prepared');
      assert.equal(prepared.nativeExecutions, 0);
      assert.equal(prepared.controlAttempts, 50);
      assert.equal(prepared.domainProofReady, false);
      assert.equal(rows.length, 0);
      assert.equal(wire.length, 50);
      assert.equal(envs.length, 7);
      restoreFault = mode === 'graph_restore_failure';
      const closed = await session.close();
      assert.equal(closed.residual, !['normal', 'writer_close_unknown_ack'].includes(mode));
      assert.equal(closed.baselineRestored, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(closed.environmentCleanupVerified, true);
      assert.equal(closed.windowClosed, mode !== 'sql_close_failure');
      assert.equal(closed.remoteWorkSettled, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(adminClosed, mode !== 'sql_close_failure');
      assert.equal(adminEnded, !['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(adminAborted, ['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(closed.adminChildClosed, mode !== 'admin_abort_missing_descendants');
      assert.equal(
        closed.childTransportsClosed,
        !['admin_abort_missing_descendants', 'writer_close_unknown_native_end'].includes(mode),
      );
      assert.equal(writerCloseCalls, 1);
      assert.equal(envs.length, 0);
      assert.equal(Object.keys(bypass).length, 0);
      assert.equal(wire.length, closed.baselineRestored ? 100 : 50);
      assert.equal(f.calls.filter((c) => c.path.endsWith('/publish')).length, identityFailure ? 0 : 8);
      const before = f.calls.length;
      if (mode === 'admin_abort_missing_descendants') {
        assert.equal(existsSync(join(f.directory, 'runtime.operation.lock')), true);
        const settled = await session.close();
        assert.equal(settled.adminChildClosed, true);
        assert.equal(settled.childTransportsClosed, true);
        assert.equal(settled.residual, true);
        assert.equal(existsSync(join(f.directory, 'runtime.operation.lock')), false);
      } else assert.deepEqual(await session.close(), closed);
      assert.equal(f.calls.length, before);
    } finally {
      try {
        await session.close();
      } catch {}
      f.cleanup();
    }
  });
