import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverGatewayCredentials, gatewayCredentialIds, vercelEnvArguments } from './gw01-delivery.mjs';
const canary = 'SYNTHETIC_PRIVATE_GW01_CANARY';
const config = () => ({
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  privacyVerified: true,
});
function ports() {
  const calls = [],
    events = {};
  return {
    calls,
    events,
    ownership: {
      read: (key) => events[key] ?? null,
      begin: (key, event) => {
        assert.equal(events[key], undefined);
        events[key] = [event];
      },
      append: (key, event) => events[key].push(event),
    },
    management: async (method, path, body, key) => {
      calls.push({ method, path, body, key });
      if (path.endsWith('/schema/httpCustomAuth'))
        return {
          status: 200,
          body: { properties: { json: {}, allowedHttpRequestDomains: {}, allowedDomains: {} } },
        };
      if (method === 'GET') return { status: 404, body: {} };
      return {
        status: 200,
        body: { id: body.id, name: body.name, type: body.type, createdAt: '2026-10-18T12:00:00.000Z' },
      };
    },
    environment: async (name, value) => {
      calls.push({ name, value, args: vercelEnvArguments(name) });
      return { ok: true, childClosed: true, code: 'closed' };
    },
  };
}
test('synthetic canary credential uses supported fixed API endpoint/type/project and emits only metadata', async () => {
  const p = ports(),
    out = await deliverGatewayCredentials('Canary', { management: canary }, config(), p);
  assert.equal(out.credential.id, gatewayCredentialIds.canary);
  assert.equal(out.credential.type, 'httpCustomAuth');
  assert.doesNotMatch(JSON.stringify(out), new RegExp(canary));
  const post = p.calls.find((c) => c.method === 'POST');
  assert.equal(post.path, '/api/v1/credentials');
  assert.equal(post.body.projectId, 'pHvQjDmjxVZ3KQLT');
  assert.equal(post.body.data.allowedHttpRequestDomains, 'domains');
  assert.equal(post.body.data.allowedDomains, 'everyone-market-researcher-synthetic.vercel.app');
});
test('private values travel solely in native request headers/body orCLIstdin; no values/verifier in args or public result', async () => {
  const p = ports(),
    out = await deliverGatewayCredentials(
      'Runtime',
      {
        management: canary,
        writer: canary + 'writer',
        machine: canary + 'machine',
        protection: canary + 'bypass',
      },
      config(),
      p,
    );
  assert.doesNotMatch(JSON.stringify(out), new RegExp(canary));
  for (const c of p.calls.filter((c) => c.args)) {
    assert.doesNotMatch(JSON.stringify(c.args), new RegExp(canary));
    assert.ok(c.args.includes('preview'));
    assert.ok(c.args.includes('m03-n8n-foundation'));
    assert.ok(c.args.includes('--sensitive'));
    assert.ok(!c.args.includes('--force'));
  }
  assert.equal(p.calls.filter((c) => c.name).length, 2);
});
test('runtime delivery stops before private port calls without actual privacy gate or if administrator input is supplied', async () => {
  for (const [secrets, conf] of [
    [
      { management: canary, writer: canary, machine: canary, protection: canary },
      { ...config(), privacyVerified: false },
    ],
    [{ management: canary, writer: canary, machine: canary, protection: canary, admin: canary }, config()],
  ]) {
    const p = ports();
    await assert.rejects(
      deliverGatewayCredentials('Runtime', secrets, conf, p),
      /^Error: GW01_DELIVERY_REJECTED$/,
    );
    assert.equal(p.calls.length, 0);
  }
});
test('existing credential ID/unknown native result is reconciled without anotherPOST or silentreplacement', async () => {
  const p = ports(),
    original = p.management;
  p.management = async (...args) =>
    args[1].includes('/schema/')
      ? original(...args)
      : {
          status: 200,
          body: {
            id: gatewayCredentialIds.canary,
            name: 'M03 GW-01 privacy canary [dev]',
            type: 'httpCustomAuth',
          },
        };
  await assert.rejects(
    deliverGatewayCredentials('Canary', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_RECONCILE$/,
  );
});
test('reflected management key/body secret in credential metadata is rejected without emitting it', async () => {
  const p = ports(),
    original = p.management;
  p.management = async (...args) => {
    const r = await original(...args);
    if (args[0] === 'POST') r.body.id = canary;
    return r;
  };
  await assert.rejects(
    deliverGatewayCredentials('Canary', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
  );
});
test('Vercel scopedargumentconstructor cannot writeProduction/all-preview/callerselectedenv', () => {
  assert.throws(() => vercelEnvArguments('PRODUCTION_SECRET'), /^Error: GW01_DELIVERY_REJECTED$/);
  for (const name of ['EMR_WORKER_DB_PASSWORD', 'EMR_WORKER_GATEWAY_TOKEN_SHA256']) {
    const a = vercelEnvArguments(name);
    assert.equal(a[0], 'env');
    assert.equal(a[1], 'add');
    assert.equal(a[2], name);
    assert.equal(a[3], 'preview');
    assert.equal(a[4], 'm03-n8n-foundation');
    assert.ok(a.includes('prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu'));
  }
});
test('cleanup never deletes a matching collision without successful public creation provenance', async () => {
  const p = ports();
  p.management = async () => {
    throw Error('must not call');
  };
  const out = await deliverGatewayCredentials('Cleanup', { management: canary }, config(), p);
  assert.deepEqual(out.deletedCredentialIds, []);
  assert.equal(out.managementRequests, 0);
});
test('ambiguous create retains intent and GET-only reconciliation cannot adopt it or retry POST', async () => {
  const p = ports(),
    original = p.management;
  p.management = async (...args) => {
    if (args[0] === 'POST') throw Error('SYNTHETIC_PRIVATE_TRANSPORT_ERROR');
    return original(...args);
  };
  await assert.rejects(
    deliverGatewayCredentials('Canary', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_UNKNOWN$/,
  );
  assert.equal(p.events.canary.length, 1);
  const count = p.calls.length;
  await assert.rejects(
    deliverGatewayCredentials('Canary', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_RECONCILE$/,
  );
  assert.equal(p.calls.length, count);
  p.management = async (method, path) => {
    assert.equal(method, 'GET');
    assert.equal(path, '/api/v1/credentials/' + gatewayCredentialIds.canary);
    return {
      status: 200,
      body: {
        id: gatewayCredentialIds.canary,
        name: 'M03 GW-01 privacy canary [dev]',
        type: 'httpCustomAuth',
        createdAt: '2026-10-18T12:00:00.000Z',
      },
    };
  };
  const r = await deliverGatewayCredentials('ReconcileCanary', { management: canary }, config(), p);
  assert.equal(r.exists, true);
  assert.equal(r.ownershipVerified, false);
  assert.equal(r.projectReadbackVerified, false);
  assert.equal(r.automaticPostRetry, false);
  await assert.rejects(
    deliverGatewayCredentials('Cleanup', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_OWNERSHIP_UNVERIFIED$/,
  );
});
test('successful create receipt enables only same-createdAt cleanup; replacements are retained', async () => {
  const p = ports();
  const created = await deliverGatewayCredentials('Canary', { management: canary }, config(), p);
  assert.equal(p.events.canary.length, 2);
  const calls = [];
  p.management = async (method, path) => {
    calls.push({ method, path });
    return { status: 200, body: { ...created.credential, createdAt: '2026-10-18T13:00:00.000Z' } };
  };
  await assert.rejects(
    deliverGatewayCredentials('Cleanup', { management: canary }, config(), p),
    /^Error: GW01_DELIVERY_OWNERSHIP_UNVERIFIED$/,
  );
  assert.equal(
    calls.some((c) => c.method === 'DELETE'),
    false,
  );
  p.management = async (method, path) => {
    calls.push({ method, path });
    return { status: 200, body: created.credential };
  };
  const out = await deliverGatewayCredentials('Cleanup', { management: canary }, config(), p);
  assert.deepEqual(out.deletedCredentialIds, [gatewayCredentialIds.canary]);
  assert.deepEqual(p.events.canary[2], { kind: 'deleted' });
});
test('unknown native child cleanup blocks credential POST and does not claim Vercel delivery', async () => {
  const p = ports();
  p.environment = async () => ({ ok: false, childClosed: false, code: 'GW01_CHILD_CLEANUP_UNVERIFIED' });
  await assert.rejects(
    deliverGatewayCredentials(
      'Runtime',
      { management: canary, writer: canary + 'w', machine: canary + 'm', protection: canary + 'b' },
      config(),
      p,
    ),
    /^Error: GW01_CHILD_CLEANUP_UNVERIFIED$/,
  );
  assert.equal(
    p.calls.some((c) => c.method === 'POST'),
    false,
  );
});
