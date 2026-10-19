import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationTagNames } from '../../packages/shared/src/n8n-bindings.ts';
import { memoryJournal, parseLedger } from './foundation-provision.mjs';
import { foundationAllowedRequest } from './foundation-management-transport.mjs';
import { createBindingJournal, machineBody } from './foundation-bind.mjs';
import { runAllProvision, foundationAllMaximum } from './foundation-all.mjs';
const packet = {
  version: 1,
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  audience: 'https://everyone-market-researcher-synthetic-preview.vercel.app',
  sourceCommitSha: 'a'.repeat(40),
  deploymentId: 'dpl_SYNTHETIC',
  environment: 'preview',
  activationAuthorized: false,
};
const secrets = { management: 'SYNTHETIC_TEST_MANAGEMENT_KEY', machine: 'm'.repeat(43) };
const base = JSON.parse(readFileSync('n8n/foundation/bindings.dev.json', 'utf8'));
function fixture() {
  const workflows = [],
    tags = [],
    calls = [];
  let credential = null;
  const ports = {
    shellJournal: memoryJournal(),
    bindingJournal: createBindingJournal(),
    tagNames: foundationTagNames,
    context: {
      machineBody: machineBody(packet, secrets.machine),
      knownTagIds: new Set(),
      workflowBodies: new Map(),
      workflowTagBodies: new Map(),
    },
    send: async (m, p, b) => {
      assert.equal(
        foundationAllowedRequest(
          m,
          p,
          b,
          (id) => [...parseLedger(ports.shellJournal.rows).values()].some((s) => s.id === id),
          ports.context,
        ),
        true,
      );
      calls.push({ m, p });
      if (p === '/api/v1/projects?limit=100')
        return { status: 200, body: { data: [{ id: 'pHvQjDmjxVZ3KQLT', type: 'personal' }] } };
      if (m === 'GET' && p.startsWith('/api/v1/workflows?'))
        return { status: 200, body: { data: workflows, nextCursor: null } };
      if (m === 'POST' && p === '/api/v1/workflows') {
        const r = {
          ...structuredClone(b),
          id: 'Owned' + workflows.length,
          versionId: 'Version1',
          active: false,
          activeVersionId: null,
          isArchived: false,
          shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
          tags: [],
          pinData: {},
        };
        workflows.push(r);
        return { status: 200, body: r };
      }
      if (p.startsWith('/api/v1/tags?')) return { status: 200, body: { data: tags, nextCursor: null } };
      if (p === '/api/v1/tags' && m === 'POST') {
        const r = { id: 'Tag' + tags.length, name: b.name };
        tags.push(r);
        return { status: 200, body: r };
      }
      if (p.startsWith('/api/v1/tags/'))
        return { status: 200, body: tags.find((t) => p.endsWith('/' + t.id)) };
      if (p === '/api/v1/credentials/schema/httpCustomAuth')
        return {
          status: 200,
          body: { properties: { json: {}, allowedHttpRequestDomains: {}, allowedDomains: {} } },
        };
      if (p === '/api/v1/credentials/EmrFoundationMachine19')
        return { status: credential ? 200 : 404, body: credential ?? {} };
      if (p === '/api/v1/credentials' && m === 'POST') {
        credential = { id: b.id, name: b.name, type: b.type, createdAt: '2026-10-19T00:00:00.000Z' };
        return { status: 200, body: credential };
      }
      const match = /^\/api\/v1\/workflows\/([^/]+)(\/tags)?$/.exec(p);
      if (!match) assert.fail('unknown fixed API path');
      const w = workflows.find((x) => x.id === match[1]);
      assert.ok(w);
      if (m === 'PUT') {
        if (match[2]) w.tags = b.map((t) => tags.find((x) => x.id === t.id));
        else Object.assign(w, structuredClone(b));
        return { status: 200, body: w };
      }
      assert.equal(m, 'GET');
      return { status: 200, body: w };
    },
  };
  return { ports, calls, workflows };
}
test('one finite full delivery creates25 shells/13tags/one owned credential and saves25 inactive full graphs', async (t) => {
  const f = fixture(),
    r = await runAllProvision(secrets, packet, base, f.ports);
  assert.equal(r.status, 'inactive_foundation_verified');
  assert.equal(r.workflows.length, 25);
  assert.equal(r.requestCount, 183);
  const graphListBytes = Buffer.byteLength(JSON.stringify({ data: f.workflows, nextCursor: null }));
  t.diagnostic(
    'Local25GraphListBytes=' + graphListBytes + '; fixedTransportCap=524288; reservedMetadataMargin=32768',
  );
  assert.ok(
    graphListBytes + 32768 < 524288,
    '25 locally generated graphs leave at least32KiB for extra server metadata',
  );
  assert.ok(
    f.calls
      .filter((x) => x.p.startsWith('/api/v1/workflows?'))
      .every((x) => new URL('https://public.invalid' + x.p).searchParams.get('name') === '[dev]'),
  );
  assert.ok(r.requestCount <= foundationAllMaximum.requests);
  assert.equal(r.executionCount, 0);
  assert.equal(r.gatewayWindowStarted, false);
  assert.equal(r.finalGraphsBound, true);
  assert.equal(f.calls.filter((x) => x.m === 'POST' && x.p === '/api/v1/workflows').length, 25);
  assert.equal(f.calls.filter((x) => x.m === 'POST' && x.p === '/api/v1/tags').length, 13);
  assert.equal(f.calls.filter((x) => x.m === 'POST' && x.p === '/api/v1/credentials').length, 1);
  assert.equal(f.calls.filter((x) => x.m === 'PUT').length, 50);
  assert.equal(JSON.stringify(r).includes(secrets.management), false);
  assert.equal(JSON.stringify(r).includes(secrets.machine), false);
  assert.ok(r.workflows.every((x) => x.active === false && x.activeVersionId === null));
  assert.ok(r.workflows.every((x) => x.workflow.nodes.every((n) => n.type !== 'n8n-nodes-base.postgres')));
});
test('completed delivery resumes from real refs with no POST or PUT and fresh saved readback', async () => {
  const f = fixture();
  assert.equal(
    (await runAllProvision(secrets, packet, base, f.ports)).status,
    'inactive_foundation_verified',
  );
  f.calls.length = 0;
  const r = await runAllProvision(secrets, packet, base, f.ports);
  assert.equal(r.status, 'inactive_foundation_verified');
  assert.ok(f.calls.every((x) => x.m === 'GET'));
});
test('changed owned graph is blocked before overwrite or activation', async () => {
  const f = fixture();
  assert.equal(
    (await runAllProvision(secrets, packet, base, f.ports)).status,
    'inactive_foundation_verified',
  );
  f.calls.length = 0;
  f.workflows[0].settings.saveManualExecutions = true;
  const r = await runAllProvision(secrets, packet, base, f.ports);
  assert.equal(r.status, 'blocked');
  assert.ok(f.calls.every((x) => x.m === 'GET'));
});
