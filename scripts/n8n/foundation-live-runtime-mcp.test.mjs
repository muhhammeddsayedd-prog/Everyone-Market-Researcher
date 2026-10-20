import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFoundationLiveMcpBridge } from './foundation-live-runtime-mcp.mjs';
const bindings = JSON.parse(readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)));
const workflowId = bindings.workflowRefs['WF-00'].id;

test('fixed MCP bridge emits only correlated owned details/start requests and accepts minimal private results', async () => {
  const frames = [];
  const b = createFoundationLiveMcpBridge({
    bindings,
    emit: (v) => {
      frames.push(v);
    },
    deadlineAt: Date.now() + 60000,
  });
  const details = b.port.details({ workflowId });
  assert.deepEqual(Object.keys(frames[0]).sort(), ['action', 'kind', 'nonce', 'workflowId']);
  assert.equal(frames[0].action, 'details');
  b.accept({
    kind: 'mcp_port_result',
    nonce: frames[0].nonce,
    action: 'details',
    workflowId,
    result: { id: workflowId, versionId: 'native-version', canExecute: true, scopes: ['workflow:execute'] },
  });
  assert.equal((await details).canExecute, true);
  const start = b.port.start({ workflowId, executionMode: 'manual' });
  assert.equal(frames[1].action, 'start');
  assert.equal(Object.hasOwn(frames[1], 'inputs'), false);
  b.accept({
    kind: 'mcp_port_result',
    nonce: frames[1].nonce,
    action: 'start',
    workflowId,
    result: { status: 'started', executionId: '123' },
  });
  assert.deepEqual(await start, { status: 'started', executionId: '123' });
  b.close();
});

test('unknown workflow, extra tool data and stale/foreign nonce cannot supply a native acknowledgement', async () => {
  const frames = [],
    b = createFoundationLiveMcpBridge({
      bindings,
      emit: (v) => {
        frames.push(v);
      },
      deadlineAt: Date.now() + 60000,
    });
  await assert.rejects(
    b.port.start({ workflowId: 'Foreign', executionMode: 'manual' }),
    /FOUNDATION_LIVE_MCP_BLOCKED/,
  );
  const pending = b.port.start({ workflowId, executionMode: 'manual' });
  pending.catch(() => {});
  assert.equal(
    b.accept({
      kind: 'mcp_port_result',
      nonce: 'a'.repeat(32),
      action: 'start',
      workflowId,
      result: { status: 'started', executionId: '999' },
    }),
    false,
  );
  assert.equal(
    b.accept({
      ...frames[0],
      kind: 'mcp_port_result',
      result: { status: 'started', executionId: '123', rawData: 'PRIVATE' },
    }),
    false,
  );
  b.close();
  await assert.rejects(pending, /FOUNDATION_LIVE_MCP_BLOCKED/);
});

test('unknown MCP tool completion fences bridge with no replacement request', async () => {
  const frames = [],
    b = createFoundationLiveMcpBridge(
      {
        bindings,
        emit: (v) => {
          frames.push(v);
        },
        deadlineAt: Date.now() + 60000,
      },
      { timeoutMs: 5 },
    );
  await assert.rejects(b.port.start({ workflowId, executionMode: 'manual' }), /FOUNDATION_LIVE_MCP_BLOCKED/);
  await assert.rejects(b.port.start({ workflowId, executionMode: 'manual' }), /FOUNDATION_LIVE_MCP_BLOCKED/);
  assert.equal(frames.length, 1);
  assert.equal(b.state().fenced, true);
  b.close();
});
