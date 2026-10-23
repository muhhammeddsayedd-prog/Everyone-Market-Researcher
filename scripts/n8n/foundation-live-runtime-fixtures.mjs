import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFoundationLiveRuntime } from './foundation-live-runtime.mjs';

// Explicit network-free dependency for session protocol tests that isolate
// behavior after a successful baseline read. The real preflight transport and
// source comparisons have their own tests; this fixture charges all25 attempts.
export function syntheticBaselinePreflight({ admitManagementAttempt }) {
  assert.equal(typeof admitManagementAttempt, 'function');
  let read = false,
    closed = false;
  return {
    async read() {
      assert.equal(read, false);
      assert.equal(closed, false);
      read = true;
      for (let i = 0; i < 25; i++) admitManagementAttempt();
      return { verifiedWorkflows: 25 };
    },
    state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    close() {
      closed = true;
    },
  };
}

export function fixture({ fault } = {}) {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const transport = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const records = Object.keys(bindings.workflowRefs).map((key) =>
    JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
  );
  const setup = {
    version: 1,
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
    sourceCommitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticRuntimeOnly',
    audience: 'https://everyone-market-researcher-synthetic-live-adapter.vercel.app',
    environment: 'preview',
    readyState: 'READY',
    protection: 'all_except_custom_domains',
    protectionVerified: true,
    protectionTransportVerified: true,
    sqlAudienceBindingVerified: true,
  };
  const directory = mkdtempSync(join(tmpdir(), 'emr-live-runtime-test-'));
  let serial = 0;
  const workflows = new Map(
    records.map((r) => [
      r.id,
      {
        ...structuredClone(r.workflow),
        settings: { ...structuredClone(r.workflow.settings), ...(r.nativeReadonlySettings ?? {}) },
        id: r.id,
        versionId: r.versionId,
        active: false,
        activeVersionId: null,
        activeVersion: null,
        isArchived: false,
        pinData: {},
        shared: [{ projectId: bindings.projectId, role: 'workflow:owner' }],
        tags: r.workflow.tags.map((t) => ({ id: t.id, name: t.name })),
      },
    ]),
  );
  const calls = [];
  const credential = {
    id: 'EmrM03Machine19',
    name: 'M03 foundation machine [dev]',
    type: 'httpCustomAuth',
    createdAt: '2026-10-19T00:25:21.669Z',
    updatedAt: '2026-10-19T00:25:21.669Z',
  };
  const input = {
    bindings,
    transport,
    records,
    setup,
    managementKey: 'SYNTHETIC_MANAGEMENT_KEY',
    machineToken: 'M'.repeat(43),
    protectionBypass: 'SYNTHETIC_NEW_OWNED_BYPASS',
    deadlineAt: Date.now() + 3600000,
  };
  const send = async (method, path, body) => {
    calls.push({ method, path });
    if (fault) await fault({ method, path, body, workflows, calls });
    if (path.endsWith('/schema/httpCustomAuth'))
      return {
        status: 200,
        body: {
          properties: {
            json: {},
            allowedDomains: {},
            allowedHttpRequestDomains: {},
          },
        },
      };
    if (path === '/api/v1/credentials/EmrM03Machine19') {
      if (method === 'PATCH')
        credential.updatedAt = new Date(Date.UTC(2026, 9, 21, 0, 0, ++serial)).toISOString();
      return { status: 200, body: structuredClone(credential) };
    }
    const m = /^\/api\/v1\/workflows\/([^/?]+)(.*)$/.exec(path),
      w = workflows.get(m?.[1]);
    if (!w) throw Error('SYNTHETIC_ROUTE_REJECTED');
    if (method === 'PUT') {
      const settings = { ...w.settings, ...structuredClone(body.settings) };
      if (settings.errorWorkflow === 'DEFAULT') delete settings.errorWorkflow;
      Object.assign(w, structuredClone(body), { settings, versionId: 'synthetic-live-version-' + ++serial });
    } else if (method === 'POST' && m[2] === '/publish') {
      assert.equal(body.versionId, w.versionId);
      w.active = true;
      w.activeVersionId = w.versionId;
      w.activeVersion = {
        workflowId: w.id,
        versionId: w.versionId,
        nodes: structuredClone(w.nodes),
        connections: structuredClone(w.connections),
      };
    } else if (method === 'POST' && m[2] === '/unpublish') {
      w.active = false;
      w.activeVersionId = null;
      w.activeVersion = null;
    } else assert.equal(method, 'GET');
    return { status: 200, body: structuredClone(w) };
  };
  const dependencies = {
    directory,
    send,
    transportState: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    closeTransport() {},
  };
  const create = () => createFoundationLiveRuntime(input, dependencies);
  return {
    input,
    dependencies,
    create,
    directory,
    workflows,
    calls,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
