import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkGatewayWriter } from './gw01-writer.mjs';
const preview = {
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_SyntheticOwnedDeployment123',
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  branch: 'm03-n8n-foundation',
};
const identity = {
  currentUser: 'n8n_writer',
  sessionUser: 'n8n_writer',
  database: 'postgres',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
};
const window = () => ({
  id: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  startsAt: null,
  expiresAt: null,
  closed: false,
  totalAdmitted: 0,
  boundAudience: null,
  boundCommitSha: null,
  boundDeploymentId: null,
});
function fixture(options = {}) {
  const calls = [];
  let closed = false;
  let bound = false,
    windowClosed = false;
  const client = {
    connect: async () => {},
    end: async () => {
      closed = true;
    },
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith('select current_user')) return { rows: [{ ...identity, ...options.identity }] };
      if (
        sql.startsWith('select 1 from ops.worker_gateway_') ||
        sql.startsWith('select ops.worker_gateway_response')
      ) {
        const e = Error('SYNTHETIC_PRIVATE_ERROR');
        e.code = options.denialCode ?? '42501';
        throw e;
      }
      if (sql.startsWith('select ops.worker_gateway_admit')) {
        const w = window();
        if (args[4] === 'bind') {
          bound = true;
          w.boundAudience = preview.audience;
          w.boundCommitSha = preview.commitSha;
          w.boundDeploymentId = preview.deploymentId;
        } else if (bound) {
          w.boundAudience = preview.audience;
          w.boundCommitSha = preview.commitSha;
          w.boundDeploymentId = preview.deploymentId;
        }
        if (args[4] === 'close') windowClosed = true;
        w.closed = windowClosed;
        return {
          rows: [
            {
              receipt: {
                state: w.closed ? 'closed' : 'admitted',
                code: w.closed ? 'window_closed' : null,
                result: null,
                window: w,
              },
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  return {
    client,
    calls,
    get closed() {
      return closed;
    },
  };
}
test('writer Verify proves actual restricted identity and four exact42501 boundaries using rollback-only checks', async () => {
  const f = fixture(),
    out = await checkGatewayWriter(
      { mode: 'Verify', password: 'SYNTHETIC_WRITER_PRIVATE', preview },
      () => f.client,
    );
  assert.equal(out.status, 'complete');
  assert.equal(out.authorizationDenials, 4);
  assert.equal(out.connectionClosed, true);
  assert.equal(f.closed, true);
  assert.equal(
    f.calls.some((c) => c.args?.[4] === 'admit'),
    false,
  );
  assert.equal(
    f.calls.some((c) => c.sql === 'rollback'),
    true,
  );
  assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_WRITER_PRIVATE/);
});
test('postgres plus SET ROLE cannot substitute actual writer principal', async () => {
  const f = fixture({ identity: { sessionUser: 'postgres' } }),
    out = await checkGatewayWriter(
      { mode: 'Verify', password: 'SYNTHETIC_WRITER_PRIVATE', preview },
      () => f.client,
    );
  assert.equal(out.status, 'stopped_reconcile');
  assert.equal(out.code, 'GW01_WRITER_IDENTITY');
  assert.equal(f.closed, true);
  assert.equal(f.calls.length, 1);
});
for (const denialCode of ['25006', '42P01', '57014'])
  test('writer denial ' + denialCode + ' is never accepted as authorization proof', async () => {
    const f = fixture({ denialCode }),
      out = await checkGatewayWriter(
        { mode: 'Verify', password: 'SYNTHETIC_WRITER_PRIVATE', preview },
        () => f.client,
      );
    assert.equal(out.status, 'stopped_reconcile');
    assert.equal(out.code, 'GW01_WRITER_AUTHORIZATION');
    assert.equal(out.authorizationDenials, 0);
    assert.equal(f.closed, true);
  });
test('Bind/Inspect use only prepared control paths and Close persistsfixedwindow withoutadmission orarbitraryRPC', async () => {
  for (const mode of ['Bind', 'Inspect', 'Close']) {
    const f = fixture(),
      out = await checkGatewayWriter({ mode, password: 'SYNTHETIC_WRITER_PRIVATE', preview }, () => f.client);
    assert.equal(out.status, 'complete');
    assert.ok(
      f.calls
        .filter((c) => c.args)
        .every((c) => c.args[0] === window().id && ['bind', 'inspect', 'close'].includes(c.args[4])),
    );
    assert.equal(out.window.startsAt, null);
    if (mode === 'Bind') assert.equal(out.window.boundAudience, preview.audience);
    if (mode === 'Close') assert.equal(out.window.closed, true);
  }
});
test('invalid target or extra administrator input rejects before connection construction', async () => {
  for (const input of [
    { mode: 'Inspect', password: 'SYNTHETIC', preview: { ...preview, branch: 'main' } },
    { mode: 'Inspect', password: 'SYNTHETIC', preview, admin: 'SYNTHETIC' },
  ]) {
    let called = false;
    const out = await checkGatewayWriter(input, () => {
      called = true;
    });
    assert.equal(out.status, 'stopped_reconcile');
    assert.equal(called, false);
  }
});
