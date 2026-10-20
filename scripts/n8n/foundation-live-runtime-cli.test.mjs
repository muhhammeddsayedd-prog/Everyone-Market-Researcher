import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runFoundationLiveRuntimeCli,
  createFoundationLiveAcceptanceSession,
} from './foundation-live-runtime-cli.mjs';
import { fixture } from './foundation-live-runtime-fixtures.mjs';

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
  'graph_restore_failure',
  'identity_replayed',
  'identity_wrong_request',
  'identity_unstarted',
  'admin_abort_missing_descendants',
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
      aborts = 0;
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
        if (mode === 'sql_close_failure') throw Error('PRIVATE_UNKNOWN_CLOSE');
        adminClosed = true;
        return { state: 'closed' };
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
        if (spec.path.startsWith('/v9/projects/') && spec.method === 'GET')
          data = {
            id: projectId,
            accountId: teamId,
            rootDirectory: 'apps/web',
            nodeVersion: '24.x',
            framework: 'nextjs',
            link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
            ssoProtection: { deploymentType: 'all_except_custom_domains' },
            protectionBypass: structuredClone(bypass),
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
        createSetupTransport: () => setupTransport,
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
      assert.equal(closed.residual, mode !== 'normal');
      assert.equal(closed.baselineRestored, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(closed.environmentCleanupVerified, true);
      assert.equal(closed.windowClosed, mode !== 'sql_close_failure');
      assert.equal(closed.remoteWorkSettled, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(adminClosed, mode !== 'sql_close_failure');
      assert.equal(adminEnded, !['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(adminAborted, ['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(closed.adminChildClosed, mode !== 'admin_abort_missing_descendants');
      assert.equal(closed.childTransportsClosed, mode !== 'admin_abort_missing_descendants');
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
