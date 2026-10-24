import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { inventoryDiagnosticVersion, runInventory } from './inventory.mjs';
import * as inventory from './inventory.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const key = 'synthetic-diagnostic-key-only';
async function snapshot31130Fixture() {
  const snapshot = {
    id: 'MzimjpsuyPuK7SKe',
    versionId: 'Synthetic31130Version',
    name: 'Synthetic owned graph',
    settings: { binaryMode: 'separate', availableInMCP: true },
    connections: {},
    nodes: [
      {
        name: 'Manual',
        type: 'n8n-nodes-base.manualTrigger',
        parameters: {},
        position: [0, 0],
        typeVersion: 1,
      },
      {
        name: 'Call Vimeo',
        type: 'n8n-nodes-base.executeWorkflow',
        parameters: { workflowId: '4JMHLDBSdgGxhPlk' },
        position: [100, 0],
        typeVersion: 1,
      },
    ],
  };
  const { foundationRuntimeObservedGraphHash } = await import('./foundation-runtime-checkpoint.mjs');
  return {
    dto: {
      ...execution31130Dto(),
      workflowData: snapshot,
      data: {
        resultData: {
          runData: {
            Manual: [{ data: { main: [[{ json: {} }]] } }],
            'Call Vimeo': [
              {
                metadata: { subExecution: { executionId: '31131', workflowId: '4JMHLDBSdgGxhPlk' } },
                data: { main: [[{ json: { private: 'SYNTHETIC_PRIVATE' } }]] },
              },
            ],
          },
        },
      },
    },
    context: {
      versionId: 'Synthetic31130Version',
      intentAt: 0,
      bodyHash: foundationRuntimeObservedGraphHash(snapshot, {
        key: 'WF-00',
        id: snapshot.id,
        nativeReadonlySettings: { binaryMode: 'separate' },
      }),
    },
  };
}
test('snapshot31130 projector checks the past graph and known child privately without emitting native receipts or payload', async () => {
  const f = await snapshot31130Fixture(),
    r = await inventory.projectExecution31130Snapshot(f.dto, f.context);
  assert.equal(r.fields.executedGraphMatches, true);
  assert.equal(r.fields.runDataNamesKnown, true);
  assert.equal(r.fields.observedChildLink, true);
  assert.deepEqual(r.childExecutionIds, ['31131']);
  assert.equal(r.nativeTreeSettlementProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|Synthetic owned graph|Call Vimeo|settings|bodyHash|workflowData|"resultData"/,
  );
});
test('snapshot31130 projector distinguishes redaction, pins, graph, names and child mismatches without disclosing values', async () => {
  for (const mode of ['graph', 'version', 'name', 'redacted', 'pin', 'child', 'parent']) {
    const f = await snapshot31130Fixture();
    if (mode === 'graph') f.dto.workflowData.name = 'SYNTHETIC_PRIVATE';
    if (mode === 'version') f.dto.workflowVersionId = 'SYNTHETIC_PRIVATE';
    if (mode === 'name') f.dto.data.resultData.runData.SYNTHETIC_PRIVATE = [];
    if (mode === 'redacted')
      f.dto.data.redactionInfo = { isRedacted: true, provisional: true, secret: 'SYNTHETIC_PRIVATE' };
    if (mode === 'pin')
      f.dto.data.resultData.pinData = { Manual: [{ json: { private: 'SYNTHETIC_PRIVATE' } }] };
    if (mode === 'child')
      f.dto.data.resultData.runData['Call Vimeo'][0].metadata.subExecution = {
        executionId: '99111',
        workflowId: 'SYNTHETIC_PRIVATE',
      };
    if (mode === 'parent')
      f.dto.data.parentExecution = { executionId: '99112', workflowId: 'SYNTHETIC_PRIVATE' };
    const r = await inventory.projectExecution31130Snapshot(f.dto, f.context);
    const key = {
      graph: 'executedGraphMatches',
      version: 'versionMatchesIntent',
      name: 'runDataNamesKnown',
      redacted: 'redactionPassesExistingReader',
      pin: 'pinsPassExistingReader',
      child: 'childLinksShape',
      parent: 'rootParentAbsent',
    }[mode];
    assert.equal(r.fields[key], false, mode);
    assert.equal(r.nativeTreeSettlementProven, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|99111|99112|Synthetic31130Version|Call Vimeo|bodyHash/,
    );
  }
});
test('snapshot31130 pin classification mirrors the existing sole-enabled-trigger rule without widening it', async () => {
  const f = await snapshot31130Fixture();
  f.dto.data.resultData.pinData = { Manual: [{ json: {} }] };
  assert.equal(
    (await inventory.projectExecution31130Snapshot(f.dto, f.context)).fields.pinsPassExistingReader,
    true,
  );
  f.dto.workflowData.nodes.push({
    name: 'Schedule',
    type: 'n8n-nodes-base.scheduleTrigger',
    parameters: {},
    position: [0, 100],
    typeVersion: 1,
  });
  assert.equal(
    (await inventory.projectExecution31130Snapshot(f.dto, f.context)).fields.pinsPassExistingReader,
    false,
  );
});
function native31130Fixture(dto, { unclosed = false, framing = false } = {}) {
  const calls = [];
  return {
    calls,
    options: {
      readContext: () => ({
        versionId: 'Synthetic31130Version',
        intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
      }),
      now: () => Date.parse('2026-10-24T16:01:00.000Z'),
      closeTimeoutMs: 10,
      nativeTransport: {
        timeoutMs: 1000,
        closeTimeoutMs: 5,
        resolveInstance: async () => [{ address: '1.1.1.1', family: 4 }],
        request(options, callback) {
          calls.push(options);
          const req = new EventEmitter(),
            socket = new EventEmitter();
          let res,
            closed = false;
          socket.encrypted = true;
          socket.authorized = true;
          socket.remoteAddress = '1.1.1.1';
          const close = () => {
            if (closed) return;
            closed = true;
            res?.destroy();
            req.emit('close');
            if (!unclosed) socket.emit('close');
          };
          req.destroy = close;
          socket.destroy = close;
          req.end = () =>
            queueMicrotask(() => {
              req.emit('socket', socket);
              socket.emit('secureConnect');
              res = new PassThrough();
              res.statusCode = 200;
              res.headers = {
                'content-type': 'application/json',
                ...(framing ? { 'content-encoding': 'SYNTHETIC_PRIVATE' } : {}),
              };
              res.complete = true;
              callback(res);
              if (!res.destroyed) res.end(Buffer.from(JSON.stringify(dto)));
              res.once('end', close);
            });
          return req;
        },
      },
    },
  };
}
test('native31130 diagnostic uses actual streaming native reader and transport for exactly one charged metadata GET', async () => {
  const f = native31130Fixture(execution31130Dto());
  let charges = 0,
    closed = false;
  const r = await inventory.runNativeExecution31130MetadataDiagnostic(key, {
    ...f.options,
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
  });
  assert.equal(r.status, 'native_metadata_verified');
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/api/v1/executions/31130?includeData=false');
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(f.calls[0].rejectUnauthorized, true);
  assert.equal(f.calls[0].agent, false);
  assert.equal(f.calls[0].headers['accept-encoding'], 'identity');
  assert.equal(r.metadata.versionMatchesIntent, true);
  assert.equal(r.readerMetadataVerified, true);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.controlReservationConservative, true);
  assert.equal(r.acceptanceProven, false);
  assert.equal(r.readerFailure, null);
  assert.doesNotMatch(
    JSON.stringify(r),
    /Synthetic31130Version|2026-10-24T16|synthetic-diagnostic-key|headers|workflowData|"resultData"/,
  );
});
test('snapshot31130 diagnostic streams exactly one full snapshot through the original native transport and remains forensic only', async () => {
  const snapshot = await snapshot31130Fixture(),
    f = native31130Fixture(snapshot.dto);
  let charges = 0,
    closed = false;
  const r = await inventory.runExecution31130SnapshotDiagnostic(key, {
    ...f.options,
    readContext: () => snapshot.context,
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
  });
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/api/v1/executions/31130?includeData=true');
  assert.equal(r.status, 'native_snapshot_classified');
  assert.equal(r.forensics.fields.executedGraphMatches, true);
  assert.deepEqual(r.forensics.childExecutionIds, ['31131']);
  assert.equal(r.readerMetadataVerified, false);
  assert.equal(r.readerState, null);
  assert.equal(r.forensics.nativeTreeSettlementProven, false);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.acceptanceProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|Synthetic owned graph|Call Vimeo|bodyHash|settings|workflowData|"resultData"/,
  );
});
test('native31130 diagnostic retains fixed native projection or transport failure and never requests full data', async () => {
  for (const mode of ['nullableVersion', 'differentVersion', 'framing', 'unclosed']) {
    const dto = execution31130Dto();
    if (mode === 'nullableVersion') dto.workflowVersionId = null;
    if (mode === 'differentVersion') dto.workflowVersionId = 'SYNTHETIC_PRIVATE';
    const f = native31130Fixture(dto, { framing: mode === 'framing', unclosed: mode === 'unclosed' });
    let charges = 0;
    const r = await inventory.runNativeExecution31130MetadataDiagnostic(key, {
      ...f.options,
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {},
      }),
    });
    assert.equal(charges, 1, mode);
    assert.equal(f.calls.length, 1, mode);
    assert.equal(r.status, 'native_metadata_failed', mode);
    assert.equal(r.acceptanceProven, false);
    if (mode === 'nullableVersion') assert.equal(r.readerFailure.code, 'METADATA');
    if (mode === 'differentVersion') {
      assert.equal(r.readerMetadataVerified, true);
      assert.equal(r.metadata.versionMatchesIntent, false);
    }
    if (mode === 'unclosed') assert.equal(r.networkCompletionVerified, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|headers|workflowData|"resultData"/,
    );
  }
});
const execution31130Dto = () => ({
  id: '31130',
  workflowId: 'MzimjpsuyPuK7SKe',
  workflowVersionId: 'Synthetic31130Version',
  mode: 'manual',
  status: 'success',
  finished: true,
  createdAt: '2026-10-24T16:00:00.000Z',
  startedAt: '2026-10-24T16:00:00.100Z',
  stoppedAt: '2026-10-24T16:00:02.047Z',
  waitTill: null,
});
test('execution31130 fixed classifier makes one charged metadata GET and emits only bounded predicates', async () => {
  let calls = 0,
    charges = 0,
    closed = false;
  const r = await inventory.runExecution31130MetadataDiagnostic(key, {
    readContext: () => ({
      versionId: 'Synthetic31130Version',
      intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
    }),
    now: () => Date.parse('2026-10-24T16:01:00.000Z'),
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
    transport: async (input) => {
      calls++;
      assert.equal(charges, 1);
      assert.equal(
        input.url.href,
        'https://muhhammedsayed.app.n8n.cloud/api/v1/executions/31130?includeData=false',
      );
      assert.equal(input.method, 'GET');
      assert.equal(input.maxBytes, 65536);
      assert.equal(input.rejectUnauthorized, true);
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      return {
        status: 200,
        body: Buffer.from(JSON.stringify({ ...execution31130Dto(), ignored: 'SYNTHETIC_PRIVATE' })),
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(r.status, 'execution_metadata_classified');
  assert.equal(r.fields.readerMetadataContractSatisfied, true);
  assert.equal(r.metadata.executionId, '31130');
  assert.equal(r.metadata.status, 'success');
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.acceptanceProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|workflowData|resultData|"data"/,
  );
});
test('execution31130 classifier reports nullable or missing native fields without accepting or exposing them', async () => {
  for (const mode of [
    'nullableVersion',
    'missingTimes',
    'foreign',
    'payload',
    'unknownStatus',
    'notObject',
  ]) {
    const dto = execution31130Dto();
    if (mode === 'nullableVersion') dto.workflowVersionId = null;
    if (mode === 'missingTimes') delete dto.createdAt;
    if (mode === 'foreign') dto.workflowId = 'SYNTHETIC_PRIVATE';
    if (mode === 'payload') dto.data = { token: 'SYNTHETIC_PRIVATE' };
    if (mode === 'unknownStatus') dto.status = 'SYNTHETIC_PRIVATE';
    const r = await inventory.runExecution31130MetadataDiagnostic(key, {
      readContext: () => ({
        versionId: 'Synthetic31130Version',
        intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
      }),
      now: () => Date.parse('2026-10-24T16:01:00.000Z'),
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({ admit() {}, close() {} }),
      transport: async (input) => {
        input.diagnostic.tlsVerified = true;
        input.onSocketClosed();
        return { status: 200, body: Buffer.from(JSON.stringify(mode === 'notObject' ? [] : dto)) };
      },
    });
    assert.equal(r.status, 'execution_metadata_classified', mode);
    assert.equal(r.fields.readerMetadataContractSatisfied, false, mode);
    if (mode === 'nullableVersion') assert.equal(r.fields.versionNull, true);
    if (mode === 'missingTimes') assert.equal(r.fields.createdAtPresent, false);
    if (mode === 'payload') assert.equal(r.fields.payloadAbsent, false);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|"data"/);
  }
});
test('execution31130 classifier preserves one charge and fixed failures for HTTP, framing, JSON and closure faults', async () => {
  for (const mode of ['http', 'json', 'oversize', 'tls', 'unclosed', 'throw']) {
    let calls = 0,
      charges = 0,
      closed = false;
    const r = await inventory.runExecution31130MetadataDiagnostic(key, {
      readContext: () => ({ versionId: 'Synthetic31130Version', intentAt: 0 }),
      closeTimeoutMs: 1,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {
          closed = true;
        },
      }),
      transport: async (input) => {
        calls++;
        input.diagnostic.tlsVerified = mode !== 'tls';
        if (mode !== 'unclosed') input.onSocketClosed();
        if (mode === 'throw') throw Error('SYNTHETIC_PRIVATE');
        return {
          status: mode === 'http' ? 403 : 200,
          body:
            mode === 'oversize'
              ? Buffer.alloc(65537)
              : Buffer.from(mode === 'json' ? 'SYNTHETIC_PRIVATE' : JSON.stringify(execution31130Dto())),
        };
      },
    });
    assert.equal(calls, 1, mode);
    assert.equal(charges, 1, mode);
    assert.equal(closed, true, mode);
    assert.notEqual(r.status, 'execution_metadata_classified', mode);
    assert.equal(r.fields, null, mode);
    assert.equal(r.metadata, null, mode);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|Synthetic31130Version|\/api\//);
  }
});
test('execution31130 public gate pins closed16 and durably charges825 once without rewriting prior journals', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-execution31130-budget-'));
  try {
    const receiptPath =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json',
      cleanupPath = 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json',
      receipt = JSON.parse(readFileSync(resolve(receiptPath), 'utf8')),
      cleanup = JSON.parse(readFileSync(resolve(cleanupPath), 'utf8')),
      digest = (text) => createHash('sha256').update(text).digest('hex'),
      put = (path, text) => {
        const file = join(root, path);
        mkdirSync(resolve(file, '..'), { recursive: true });
        writeFileSync(file, text);
        return file;
      },
      originals = {};
    for (const path of Object.keys(receipt.pins)) {
      const text = path.endsWith('/control.jsonl')
        ? JSON.stringify({
            event: 'native_start_ack',
            caseId: 'dispatch.vimeo',
            workflowKey: 'WF-00',
            workflowId: 'MzimjpsuyPuK7SKe',
            versionId: 'Synthetic31130Version',
            executionId: '31130',
            intentAt: '2026-10-24T16:00:00.000Z',
          }) + '\n'
        : path.endsWith('/runtime.technical-16.jsonl')
          ? [
              {
                event: 'intent',
                sequence: 37,
                action: 'save',
                key: 'WF-00',
                target: { graphHash: 'a'.repeat(64) },
              },
              {
                event: 'verified',
                sequence: 37,
                after: { versionId: 'Synthetic31130Version', graphHash: 'a'.repeat(64) },
              },
            ]
              .map(JSON.stringify)
              .join('\n') + '\n'
          : 'synthetic-public-pinned-bytes\n';
      put(path, text);
      receipt.pins[path] = digest(text);
      originals[path] = text;
    }
    const receiptText = JSON.stringify(receipt) + '\n';
    cleanup.attemptReceiptSha256 = digest(receiptText);
    const cleanupText = JSON.stringify(cleanup) + '\n';
    put(receiptPath, receiptText);
    put(cleanupPath, cleanupText);
    const source = readFileSync(resolve('scripts/n8n/inventory.mjs'), 'utf8')
      .replace('d6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb', digest(receiptText))
      .replace('49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57', digest(cleanupText));
    const module = await import(pathToFileURL(put('scripts/n8n/inventory.mjs', source)).href);
    const ready = module.checkExecution31130MetadataDiagnostic(root);
    assert.deepEqual(
      [
        ready.managementAttempts,
        ready.controlAttempts,
        ready.combinedAttempts,
        ready.maximumRequests,
        ready.privateRead,
        ready.networkRequests,
      ],
      [824, 955, 1779, 1, false, 0],
    );
    put(cleanupPath, cleanupText + ' ');
    assert.throws(() => module.checkExecution31130MetadataDiagnostic(root));
    put(cleanupPath, cleanupText);
    const budget = module.openExecution31130MetadataDiagnosticBudget(root);
    assert.throws(() => module.openExecution31130MetadataDiagnosticBudget(root));
    budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    assert.throws(() => module.checkExecution31130MetadataDiagnostic(root));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], { event: 'management_attempt', ordinal: 825 });
    const metadataPath =
        'milestones/M03-n8n-foundation/evidence/technical16-execution31130-metadata-readback-20261024.json',
      metadataReceipt = JSON.parse(readFileSync(resolve(metadataPath), 'utf8')),
      oldClaim = 'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl';
    metadataReceipt.originalAttemptSha256 = digest(receiptText);
    metadataReceipt.pins[oldClaim] = digest(readFileSync(join(root, oldClaim)));
    const metadataText = JSON.stringify(metadataReceipt) + '\n';
    put(metadataPath, metadataText);
    put(
      'scripts/n8n/inventory.mjs',
      source.replace(
        'ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470',
        digest(metadataText),
      ),
    );
    const native = await import(pathToFileURL(join(root, 'scripts/n8n/inventory.mjs')).href + '?native'),
      nativeReady = native.checkExecution31130MetadataDiagnostic(root, true),
      oldClaimText = readFileSync(join(root, oldClaim), 'utf8');
    assert.deepEqual(
      [nativeReady.managementAttempts, nativeReady.controlAttempts, nativeReady.combinedAttempts],
      [825, 955, 1780],
    );
    const nativeBudget = native.openExecution31130MetadataDiagnosticBudget(root, true);
    assert.throws(() => native.openExecution31130MetadataDiagnosticBudget(root, true));
    nativeBudget.admit();
    assert.throws(() => nativeBudget.admit());
    nativeBudget.close();
    const nativeRows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(nativeRows[0].managementAttempts, 825);
    assert.equal(nativeRows[0].controlAttempts, 955);
    assert.deepEqual(nativeRows.slice(1), [
      { event: 'management_attempt', ordinal: 826 },
      { event: 'native_read_control_reservation', ordinal: 956, additionalHttpRequest: false },
    ]);
    assert.throws(() => native.checkExecution31130MetadataDiagnostic(root, true));
    assert.equal(readFileSync(join(root, oldClaim), 'utf8'), oldClaimText);
    const nativePath =
        'milestones/M03-n8n-foundation/evidence/technical16-execution31130-native-metadata-readback-20261024.json',
      uiPath = 'milestones/M03-n8n-foundation/evidence/technical16-child-ui-readback-20261024.json',
      nativeReceipt = JSON.parse(readFileSync(resolve(nativePath), 'utf8')),
      ui = JSON.parse(readFileSync(resolve(uiPath), 'utf8')),
      nativeClaim = 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl',
      nativeClaimText = readFileSync(join(root, nativeClaim), 'utf8');
    nativeReceipt.originalAttemptSha256 = digest(receiptText);
    nativeReceipt.metadataReadbackSha256 = digest(metadataText);
    nativeReceipt.pins[nativeClaim] = digest(nativeClaimText);
    const nativeText = JSON.stringify(nativeReceipt) + '\n';
    put(nativePath, nativeText);
    ui.nativeMetadataReadbackSha256 = digest(nativeText);
    put(ui.screenshot.path, 'synthetic-public-child-image');
    ui.screenshot.sha256 = digest('synthetic-public-child-image');
    const uiText = JSON.stringify(ui) + '\n';
    put(uiPath, uiText);
    put(
      'scripts/n8n/inventory.mjs',
      source
        .replace('ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470', digest(metadataText))
        .replace('d82862ef3c23f9a4dc51b5a7b246c239890acdcda6df31d2a81c7101f21cd057', digest(nativeText))
        .replace('2c9100fd58caf7715838462de11337e8d06bcd691ab13b20b380413b6c3e4ba3', digest(uiText)),
    );
    const snapshot = await import(pathToFileURL(join(root, 'scripts/n8n/inventory.mjs')).href + '?snapshot'),
      snapshotReady = snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot');
    assert.deepEqual(
      [snapshotReady.managementAttempts, snapshotReady.controlAttempts, snapshotReady.combinedAttempts],
      [826, 957, 1783],
    );
    put(uiPath, uiText + ' ');
    assert.throws(() => snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot'));
    put(uiPath, uiText);
    const snapshotBudget = snapshot.openExecution31130MetadataDiagnosticBudget(root, 'snapshot');
    snapshotBudget.admit();
    snapshotBudget.close();
    assert.throws(() => snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot'));
    const snapshotRows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(snapshotRows.slice(1), [
      { event: 'management_attempt', ordinal: 827 },
      { event: 'native_read_control_reservation', ordinal: 958, additionalHttpRequest: false },
    ]);
    assert.equal(readFileSync(join(root, nativeClaim), 'utf8'), nativeClaimText);
    for (const [path, text] of Object.entries(originals))
      assert.equal(readFileSync(join(root, path), 'utf8'), text);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('WF00 execution diagnostic makes only three charged fixed GETs and never adopts an unretained run', async () => {
  const calls = [],
    charges = [];
  let budgetClosed = false;
  const r = await inventory.runWf00ExecutionDiagnostic(key, {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges.push(charges.length + 525);
      },
      close() {
        budgetClosed = true;
      },
    }),
    transport: async (input) => {
      calls.push(input);
      assert.equal(charges.length, calls.length);
      assert.equal(input.method, 'GET');
      assert.equal(input.url.hostname, 'muhhammedsayed.app.n8n.cloud');
      assert.equal(input.rejectUnauthorized, true);
      assert.equal(input.maxBytes, calls.length === 3 ? 524288 : 65536);
      input.diagnostic.tcpConnected = true;
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      return {
        status: 200,
        body: Buffer.from(
          JSON.stringify(
            calls.length === 3
              ? baselineFixture().dto
              : { data: [], nextCursor: null, ignored: 'SYNTHETIC_PRIVATE' },
          ),
        ),
      };
    },
  });
  assert.deepEqual(
    calls.map((c) => c.url.pathname + c.url.search),
    [
      '/api/v1/executions?workflowId=MzimjpsuyPuK7SKe&includeData=false&limit=2&status=running',
      '/api/v1/executions?workflowId=MzimjpsuyPuK7SKe&includeData=false&limit=2',
      '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
    ],
  );
  assert.deepEqual(charges, [525, 526, 527]);
  assert.equal(r.status, 'execution_metadata_observed');
  assert.equal(r.runningEmpty, true);
  assert.equal(r.runningPaginationComplete, true);
  assert.deepEqual(r.latest, []);
  assert.equal(r.unadmittedExecutionIdEstablished, false);
  assert.equal(r.savedWorkflowVerified, true);
  assert.equal(r.manualRetentionDisabled, true);
  assert.equal(r.allActiveExecutionsAbsentProven, false);
  assert.equal(r.authenticationVerified, true);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(budgetClosed, true);
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|"data"|resultData|workflowData/);
});

test('WF00 execution metadata limits, permission failures and uncertain sockets stop without retry or payload output', async () => {
  for (const mode of ['http', 'foreign', 'payload', 'duplicate', 'too-large', 'unclosed']) {
    let calls = 0,
      charges = 0,
      closed = false;
    const r = await inventory.runWf00ExecutionDiagnostic(key, {
      closeTimeoutMs: 1,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {
          closed = true;
        },
      }),
      transport: async (input) => {
        calls++;
        input.diagnostic.tcpConnected = true;
        input.diagnostic.tlsVerified = true;
        if (mode !== 'unclosed') input.onSocketClosed();
        const row = {
          id: '12345',
          workflowId: 'MzimjpsuyPuK7SKe',
          mode: 'manual',
          status: 'running',
          startedAt: '2026-10-24T15:41:07.249Z',
          stoppedAt: null,
        };
        if (mode === 'foreign') row.workflowId = 'SYNTHETIC_FOREIGN';
        if (mode === 'payload') row.data = { secret: 'SYNTHETIC_PRIVATE' };
        return {
          status: mode === 'http' ? 403 : 200,
          body:
            mode === 'too-large'
              ? Buffer.alloc(65537)
              : Buffer.from(
                  JSON.stringify({
                    data: mode === 'unclosed' ? [] : mode === 'duplicate' ? [row, row] : [row],
                    nextCursor: null,
                    unknown: 'SYNTHETIC_PRIVATE',
                  }),
                ),
        };
      },
    });
    assert.equal(calls, 1, mode);
    assert.equal(charges, 1, mode);
    assert.equal(closed, true, mode);
    assert.notEqual(r.status, 'execution_metadata_observed', mode);
    assert.equal(r.unadmittedExecutionIdEstablished, false);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|SYNTHETIC_FOREIGN|resultData|"data"/);
  }
});

test('WF00 retained metadata is a bounded candidate and cursors never create extra requests or execution authority', async () => {
  let calls = 0,
    charges = 0;
  const r = await inventory.runWf00ExecutionDiagnostic(key, {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {},
    }),
    transport: async (input) => {
      calls++;
      input.diagnostic.tcpConnected = true;
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      const row = {
        id: '12345',
        workflowId: 'MzimjpsuyPuK7SKe',
        mode: 'manual',
        status: 'error',
        startedAt: '2026-10-24T15:41:07.249Z',
        stoppedAt: '2026-10-24T15:41:09.628Z',
        unknown: 'SYNTHETIC_PRIVATE',
      };
      return {
        status: 200,
        body: Buffer.from(
          JSON.stringify(
            calls === 3
              ? baselineFixture((dto) => {
                  dto.versionId = 'ChangedVersion';
                }).dto
              : { data: calls === 1 ? [] : [row], nextCursor: 'SYNTHETIC_OPAQUE_CURSOR' },
          ),
        ),
      };
    },
  });
  assert.equal(calls, 3);
  assert.equal(charges, 3);
  assert.equal(r.status, 'execution_metadata_observed');
  assert.equal(r.runningEmpty, false);
  assert.equal(r.runningPaginationComplete, false);
  assert.equal(r.latestPaginationComplete, false);
  assert.equal(r.latest[0].executionId, '12345');
  assert.equal(r.latest[0].withinObservedInterval, true);
  assert.equal(r.unadmittedExecutionIdEstablished, false);
  assert.equal(r.allActiveExecutionsAbsentProven, false);
  assert.equal(r.savedWorkflowVerified, false);
  assert.equal(r.baseline.versionMatches, false);
  assert.equal(r.manualRetentionDisabled, true);
  assert.doesNotMatch(JSON.stringify(r), /ChangedVersion|SYNTHETIC_PRIVATE|SYNTHETIC_OPAQUE_CURSOR/);
});

test('WF00 diagnostic one-use journal durably charges three reads without rewriting the six prior ledgers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf00-metadata-budget-'));
  try {
    const checkpointPath =
        'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-checkpoint-20261024.json',
      checkpoint = JSON.parse(readFileSync(resolve(checkpointPath), 'utf8')),
      put = (path, text) => {
        const absolute = join(root, path);
        mkdirSync(resolve(absolute, '..'), { recursive: true });
        writeFileSync(absolute, text);
        return absolute;
      },
      digest = (text) => createHash('sha256').update(text).digest('hex'),
      originals = {};
    for (const path of Object.keys(checkpoint.pins)) {
      const text = JSON.stringify({ kind: 'synthetic_public_ledger', path }) + '\n';
      put(path, text);
      originals[path] = text;
      checkpoint.pins[path] = digest(text);
    }
    const text = JSON.stringify(checkpoint) + '\n';
    put(checkpointPath, text);
    const source = readFileSync(resolve('scripts/n8n/inventory.mjs'), 'utf8').replace(
        '9c49750496d602781903de09459d729c6a3061b433a78cfea6aabdb4d796e99f',
        digest(text),
      ),
      path = put('scripts/n8n/inventory.mjs', source),
      module = await import(pathToFileURL(path).href),
      ready = module.checkWf00ExecutionDiagnostic(root);
    assert.equal(ready.privateRead, false);
    assert.equal(ready.networkRequests, 0);
    assert.deepEqual(
      [ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [524, 846, 1370],
    );
    const budget = module.openWf00ExecutionDiagnosticBudget(root);
    assert.throws(() => module.openWf00ExecutionDiagnosticBudget(root));
    for (let i = 0; i < 3; i++) budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    assert.throws(() => module.checkWf00ExecutionDiagnostic(root));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/wf00-execution-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.slice(1).map((v) => v.ordinal),
      [525, 526, 527],
    );
    for (const [path, before] of Object.entries(originals))
      assert.equal(readFileSync(join(root, path), 'utf8'), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime residual workflow projection compares only known graph/version/publication profiles', async () => {
  const graph = { name: 'Synthetic owned workflow', nodes: [], connections: {}, settings: {} };
  const { foundationRuntimeGraphHash } = await import('./foundation-runtime-checkpoint.mjs');
  const state = {
    versionId: 'KnownVersion13',
    activeVersionId: null,
    graphHash: foundationRuntimeGraphHash(graph),
    publishedHash: null,
  };
  const expected = {
    id: 'tiEhU3dXrMifOnTL',
    tags: [],
    before: state,
    target: state,
    baseline: { ...state, versionId: 'KnownBaseline' },
  };
  const dto = {
    ...graph,
    id: expected.id,
    versionId: state.versionId,
    active: false,
    activeVersionId: null,
    isArchived: false,
    tags: [],
    shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
    pinData: {},
    privateUnknown: 'SYNTHETIC_PRIVATE_VALUE',
  };
  const result = await inventory.projectRuntimeReconciliationWorkflow(dto, expected);
  assert.equal(result.beforeGraphEqual, true);
  assert.equal(result.targetGraphEqual, true);
  assert.equal(result.versionMatchesBefore, true);
  assert.equal(result.versionMatchesTarget, true);
  assert.equal(result.versionMatchesBaseline, false);
  assert.equal(result.publicationMatchesTarget, true);
  assert.ok(Object.values(result).every((v) => typeof v === 'boolean'));
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC|KnownVersion|tiEh|privateUnknown/);
  const changed = await inventory.projectRuntimeReconciliationWorkflow(
    { ...dto, versionId: 'UnknownPrivateVersion', settings: { unknown: true } },
    expected,
  );
  assert.equal(changed.targetGraphEqual, false);
  assert.equal(changed.versionMatchesTarget, false);
});
function runtimeResidualFixture({ status = 200, failAt = 0, unclosedAt = 0, data = false } = {}) {
  const graph = { name: 'Synthetic owned workflow', nodes: [], connections: {}, settings: {} };
  return import('./foundation-runtime-checkpoint.mjs').then(({ foundationRuntimeGraphHash }) => {
    const base = {
      versionId: 'KnownBefore',
      activeVersionId: null,
      graphHash: foundationRuntimeGraphHash(graph),
      publishedHash: null,
    };
    const expected = Object.fromEntries(
      [
        ['SUB-NOTIFY', 'tiEhU3dXrMifOnTL'],
        ['WF-90', 'S9NHRkKFUIiXX2wv'],
      ].map(([key, id]) => [key, { id, tags: [], baseline: base, before: base, target: base }]),
    );
    const machine = {
      id: 'EmrM03Machine19',
      name: 'M03 foundation machine [dev]',
      createdAt: '2026-10-19T00:25:21.669Z',
      type: 'httpCustomAuth',
      updatedAt: '2026-10-24T00:00:00.000Z',
      ...(data ? { data: { secret: 'SYNTHETIC_PRIVATE_RESPONSE' } } : {}),
    };
    const calls = [],
      charges = [];
    let closed = false;
    return {
      calls,
      charges,
      closed: () => closed,
      dependencies: {
        timeoutMs: 1000,
        closeTimeoutMs: 1,
        lookup: async () => [{ address: '1.1.1.1', family: 4 }],
        openBudget: async () => ({
          context: { plan: { machine }, state: { machineUpdatedAt: machine.updatedAt }, expected },
          admit() {
            charges.push(charges.length + 484);
          },
          close() {
            closed = true;
          },
        }),
        transport: async (input) => {
          calls.push(input);
          assert.equal(charges.length, calls.length);
          assert.equal(input.method, 'GET');
          assert.equal(input.url.hostname, 'muhhammedsayed.app.n8n.cloud');
          assert.equal(input.rejectUnauthorized, true);
          const d = input.diagnostic;
          d.tcpConnected = true;
          d.tlsVerified = true;
          if (calls.length !== unclosedAt) input.onSocketClosed();
          const which = input.url.pathname.split('/').at(-1);
          const dto =
            which === 'EmrM03Machine19'
              ? machine
              : {
                  ...graph,
                  id: which,
                  versionId: 'KnownBefore',
                  active: false,
                  activeVersionId: null,
                  isArchived: false,
                  tags: [],
                  shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
                  pinData: {},
                  privateValue: 'SYNTHETIC_PRIVATE_RESPONSE',
                };
          return { status: calls.length === failAt ? status : 200, body: Buffer.from(JSON.stringify(dto)) };
        },
      },
    };
  });
}
test('runtime residual diagnostic issues only3 charged fixed GETs and exposes boolean comparisons', async () => {
  const f = await runtimeResidualFixture(),
    r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'readback_observed');
  assert.equal(r.requestCount, 3);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(f.closed(), true);
  assert.deepEqual(f.charges, [484, 485, 486]);
  assert.deepEqual(
    f.calls.map((v) => v.url.pathname + v.url.search),
    [
      '/api/v1/credentials/EmrM03Machine19',
      '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true',
      '/api/v1/workflows/S9NHRkKFUIiXX2wv?excludePinnedData=true',
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|KnownBefore|2026-10-24T|"data"|"nodes"|"settings"|versionId|sha256/,
  );
  assert.doesNotThrow(() => inventory.assertRuntimeReconciliationReadback(r));
  for (const mutate of [
    (v) => (v.metadata.updatedAtMatchesJournal = false),
    (v) => (v.metadata.dataPresent = true),
    (v) => (v.workflows['SUB-NOTIFY'].targetGraphEqual = false),
    (v) => (v.workflows['WF-90'].publicationMatchesTarget = false),
    (v) => (v.diagnostics.requests[2].tlsVerified = false),
    (v) => (v.privateSecret = 'SYNTHETIC_PRIVATE_VALUE'),
  ]) {
    const copy = structuredClone(r);
    mutate(copy);
    assert.throws(
      () => inventory.assertRuntimeReconciliationReadback(copy),
      /RUNTIME_RECONCILIATION_BLOCKED/,
    );
  }
});
test('runtime residual failures stop without retry and preserve exact charged requests and closure flags', async () => {
  for (const options of [{ failAt: 2, status: 429 }, { unclosedAt: 2 }]) {
    const f = await runtimeResidualFixture(options),
      r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.charges, [484, 485]);
    assert.equal(r.status, options.failAt ? 'http_failed' : 'network_failed');
    assert.equal(r.networkCompletionVerified, Boolean(options.failAt));
    assert.equal(f.closed(), true);
    assert.throws(() => inventory.assertRuntimeReconciliationReadback(r));
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|KnownBefore/);
  }
  const f = await runtimeResidualFixture({ data: true }),
    r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
  assert.equal(r.metadata.dataPresent, true);
  assert.throws(() => inventory.assertRuntimeReconciliationReadback(r));
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE_RESPONSE/);
});
test('runtime residual budget writes483to486 once, keeps the old prefix and refuses repeated admission', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-residual-budget-'));
  try {
    const relative = 'management.jsonl',
      path = join(root, relative),
      original = JSON.stringify({ event: 'header' }) + '\n';
    writeFileSync(path, original);
    const context = {
      root,
      receiptSha256: 'a'.repeat(64),
      managementAttempts: 483,
      paths: { management: relative, claim: 'claim.jsonl' },
      pinned: { management: original },
    };
    // Only the independently tested public-context proof is substituted here;
    // the real exclusive marker, synchronous debit, fsync and one-use guard run.
    const text = readFileSync(new URL('./inventory.mjs', import.meta.url), 'utf8').replace(
      /const context\s*=\s*await readRuntimeReconciliationContext\(repositoryRoot\);/,
      `const context=${JSON.stringify(context)};`,
    );
    const entry = join(root, 'inventory.mjs');
    writeFileSync(entry, text);
    const module = await import(pathToFileURL(entry).href);
    const budget = await module.openRuntimeReconciliationDiagnosticBudget(root);
    for (let i = 0; i < 3; i++) budget.admit();
    assert.throws(() => budget.admit(), /RUNTIME_RECONCILIATION_BLOCKED/);
    budget.close();
    assert.equal(
      readFileSync(path, 'utf8'),
      original +
        [473, 474, 475]
          .map((ordinal) => JSON.stringify({ event: 'management_attempt', ordinal }) + '\n')
          .join(''),
    );
    await assert.rejects(
      module.openRuntimeReconciliationDiagnosticBudget(root),
      /RUNTIME_RECONCILIATION_BLOCKED/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
function wf70Fixture(options = {}) {
  const calls = [],
    charges = [];
  return {
    calls,
    charges,
    dependencies: {
      timeoutMs: 1000,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      admitControlAttempt(value) {
        charges.push(value);
      },
      transport: async (input) => {
        calls.push(input.url.toString());
        assert.equal(charges.length, calls.length);
        assert.equal(input.method, 'GET');
        assert.equal(input.rejectUnauthorized, true);
        assert.equal(input.url.searchParams.get('includeData'), 'false');
        assert.equal(input.url.searchParams.get('workflowId'), 'S6KDFsx5IjQRf6tm');
        const diagnostic = input.diagnostic;
        diagnostic.tcpConnected = true;
        diagnostic.tlsVerified = true;
        diagnostic.socketClosed = true;
        input.onSocketClosed();
        const dto = options.dto?.(calls.length) ?? { data: [], nextCursor: null };
        return { status: options.status ?? 200, body: Buffer.from(JSON.stringify(dto)) };
      },
    },
  };
}
test('fixed WF70 discovery uses the same strict reader through an explicit bounded GET adapter and charges before every call', async () => {
  const f = wf70Fixture(),
    r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'discovery_complete');
  assert.equal(r.requestCount, 2);
  assert.equal(r.transportAdapter, 'inventory_bounded_get_adapter');
  assert.equal(r.paginationComplete, true);
  assert.equal(r.candidateCount, 0);
  assert.equal(r.adoptionProven, false);
  assert.equal(r.drainProven, false);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.readerFailure, null);
  assert.equal(f.charges.length, 2);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1], f.calls[0] + '&status=running');
  assert.doesNotMatch(
    JSON.stringify(r),
    /synthetic-diagnostic-key|executionId|cursor|parameters|workflowData|\/api\//,
  );
});
test('WF70 diagnostic retains HTTP/schema failure and page cap without leaking response values or retrying', async () => {
  for (const options of [
    { status: 429, dto: () => ({ message: 'SYNTHETIC_PRIVATE_UPSTREAM' }) },
    {
      dto: () => ({
        data: [
          {
            id: '101',
            workflowId: 'S6KDFsx5IjQRf6tm',
            mode: 'SYNTHETIC_PRIVATE_MODE',
            status: 'running',
            startedAt: null,
            stoppedAt: null,
            waitTill: null,
          },
        ],
        nextCursor: null,
      }),
    },
    { dto: () => ({ data: [], nextCursor: 'SYNTHETIC_PRIVATE_CURSOR' }) },
  ]) {
    const f = wf70Fixture(options),
      r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
    assert.equal(r.status, 'discovery_failed');
    assert.equal(r.paginationComplete, false);
    assert.equal(r.candidateCount, null);
    assert.equal(r.networkCompletionVerified, true);
    assert.ok(r.requestCount <= 2);
    assert.equal(f.calls.length, r.requestCount);
    assert.equal(r.readerFailure.workflowKey, 'WF-70');
    assert.equal(r.readerFailure.httpStatus, options.status ?? 200);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|synthetic-diagnostic-key|\/api\//);
  }
  const f = wf70Fixture({
    dto: (n) => ({ data: [], nextCursor: n % 2 === 1 ? 'SYNTHETIC_PRIVATE_CURSOR' : null }),
  });
  const r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'discovery_complete');
  assert.equal(r.requestCount, 4);
  assert.equal(f.charges.length, 4);
});

test('WF70 budget journal is one-use, preserves baseline counters and durably debits no more than four controls', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf70-budget-'));
  try {
    const directory = join(root, 'scripts/n8n/out/foundation');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'wf70-discovery-diagnostic-20261024.jsonl');
    const header = {
      kind: 'm03_wf70_discovery_budget',
      version: 1,
      receiptSha256: inventory.wf70DiscoveryReceiptSha256,
      managementAttempts: 152,
      controlAttempts: 382,
      combinedAttempts: 534,
      maximumRequests: 4,
      parentProcessId: process.ppid,
    };
    writeFileSync(path, JSON.stringify(header) + '\n');
    const budget = inventory.openWf70DiscoveryBudget(root);
    try {
      for (let i = 0; i < 4; i++) budget.admit({ kind: 'discovery', workflowId: 'S6KDFsx5IjQRf6tm' });
      assert.throws(
        () => budget.admit({ kind: 'discovery', workflowId: 'S6KDFsx5IjQRf6tm' }),
        /WF70_DIAGNOSTIC_BUDGET_BLOCKED/,
      );
    } finally {
      budget.close();
    }
    const rows = readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows[0], header);
    assert.equal(rows[1].event, 'diagnostic_child_claim');
    assert.deepEqual(
      rows.slice(2).map((r) => r.ordinal),
      [383, 384, 385, 386],
    );
    assert.throws(() => inventory.openWf70DiscoveryBudget(root), /WF70_DIAGNOSTIC_BUDGET_BLOCKED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actual native31130 CLI completes the native transport inventory import cycle and charges one streamed metadata GET', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-native31130-cli-'));
  try {
    const full = await snapshot31130Fixture();
    for (const snapshotMode of [false, true]) {
      const put = (relative, text) => {
          const path = join(root, relative);
          mkdirSync(resolve(path, '..'), { recursive: true });
          writeFileSync(path, text);
          return path;
        },
        instant = Date.now() - 2000,
        dto = {
          ...execution31130Dto(),
          createdAt: new Date(instant).toISOString(),
          startedAt: new Date(instant + 100).toISOString(),
          stoppedAt: new Date(instant + 1100).toISOString(),
        },
        original = readFileSync(new URL('./inventory.mjs', import.meta.url), 'utf8'),
        start = original.indexOf('function readNativeExecution31130Context('),
        end = original.indexOf('export function checkExecution31130MetadataDiagnostic', start);
      assert.ok(start > 0 && end > start);
      // Only the public qualification is synthetic here; separate tests exercise
      // its actual immutable receipt/prefix checks. Keep real CLI, journal,
      // native reader, streaming native transport and circular import topology.
      const source =
          original.slice(0, start) +
          `function readNativeExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {root,versionId:'Synthetic31130Version',intentAt:${instant}};}function readSnapshotExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {...readNativeExecution31130Context(root),bodyHash:${JSON.stringify(full.context.bodyHash)}};}\n` +
          original.slice(end),
        entry = put('scripts/n8n/inventory.mjs', source),
        entryUrl = pathToFileURL(entry).href,
        actualTransport = pathToFileURL(resolve('scripts/n8n/foundation-native-transport.mjs')).href,
        actualReader = pathToFileURL(resolve('scripts/n8n/foundation-native-reader.mjs')).href;
      put(
        'n8n/foundation/bindings.dev.json',
        readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
      );
      mkdirSync(join(root, 'scripts/n8n/out/foundation'), { recursive: true });
      const dns = put(
          'dns.mjs',
          `export function lookup(_host,_options,done){done(null,[{address:'1.1.1.1',family:4}]);}`,
        ),
        https = put(
          'https.mjs',
          `import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {appendFileSync} from 'node:fs';
export function request(options,callback){if(options.method!=='GET'||options.hostname!=='muhhammedsayed.app.n8n.cloud'||options.path!==${JSON.stringify('/api/v1/executions/31130?includeData=' + String(snapshotMode))}||options.rejectUnauthorized!==true||options.agent!==false||options.headers['accept-encoding']!=='identity')throw Error('SYNTHETIC_ROUTE_BLOCKED');appendFileSync(new URL('./calls${snapshotMode ? 'snapshot' : 'native'}.txt',import.meta.url),'fixed-get\\n');const req=new EventEmitter(),socket=new EventEmitter();socket.encrypted=true;socket.authorized=true;socket.remoteAddress='1.1.1.1';let res,closed=false;const close=()=>{if(closed)return;closed=true;res?.destroy();req.emit('close');socket.emit('close');};req.destroy=close;socket.destroy=close;req.end=()=>queueMicrotask(()=>{req.emit('socket',socket);socket.emit('secureConnect');res=new PassThrough();res.statusCode=200;res.headers={'content-type':'application/json'};res.complete=true;callback(res);if(!res.destroyed)res.end(Buffer.from(${JSON.stringify(JSON.stringify(snapshotMode ? full.dto : dto))}));res.once('end',close);});return req;}`,
        ),
        preload = put(
          'preload.mjs',
          `import {registerHooks} from 'node:module';registerHooks({resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-native-reader.mjs')return {url:${JSON.stringify(actualReader)},shortCircuit:true};if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-native-transport.mjs')return {url:${JSON.stringify(actualTransport)},shortCircuit:true};if(specifier==='./inventory.mjs'&&context.parentURL?.includes('/scripts/n8n/'))return {url:${JSON.stringify(entryUrl)},shortCircuit:true};if(specifier==='node:dns')return {url:${JSON.stringify(pathToFileURL(dns).href)},shortCircuit:true};if(specifier==='node:https')return {url:${JSON.stringify(pathToFileURL(https).href)},shortCircuit:true};return next(specifier,context);}});`,
        ),
        env = Object.fromEntries(
          ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
            .filter((k) => process.env[k] !== undefined)
            .map((k) => [k, process.env[k]]),
        ),
        r = spawnSync(
          process.execPath,
          [
            '--import',
            pathToFileURL(preload).href,
            entry,
            snapshotMode
              ? '--execution-31130-snapshot-diagnostic'
              : '--execution-31130-native-metadata-diagnostic',
          ],
          { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', windowsHide: true, timeout: 10000 },
        );
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stderr, '');
      const result = JSON.parse(r.stdout);
      assert.equal(result.status, snapshotMode ? 'native_snapshot_classified' : 'native_metadata_verified');
      assert.equal(result.networkCompletionVerified, true);
      assert.equal(result.metadata.versionMatchesIntent, true);
      assert.equal(
        readFileSync(join(root, snapshotMode ? 'callssnapshot.txt' : 'callsnative.txt'), 'utf8'),
        'fixed-get\n',
      );
      const rows = readFileSync(
        join(
          root,
          snapshotMode
            ? 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl'
            : 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl',
        ),
        'utf8',
      )
        .trim()
        .split('\n')
        .map(JSON.parse);
      assert.deepEqual(rows.slice(1), [
        { event: 'management_attempt', ordinal: snapshotMode ? 827 : 826 },
        {
          event: 'native_read_control_reservation',
          ordinal: snapshotMode ? 958 : 956,
          additionalHttpRequest: false,
        },
      ]);
      assert.doesNotMatch(
        r.stdout,
        /SYNTHETIC_PRIVATE|Synthetic31130Version|synthetic-diagnostic-key|headers|workflowData|"resultData"/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actual diagnostic CLI completes its circular reader imports with synthetic DNS/HTTPS only and records exact charged GETs', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf70-cli-'));
  try {
    const put = (relative, text) => {
      const path = join(root, relative);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, text);
      return path;
    };
    const entry = put('scripts/n8n/inventory.mjs', readFileSync(new URL('./inventory.mjs', import.meta.url)));
    put(
      'n8n/foundation/bindings.dev.json',
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    const journal = put(
      'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl',
      JSON.stringify({
        kind: 'm03_wf70_discovery_budget',
        version: 1,
        receiptSha256: inventory.wf70DiscoveryReceiptSha256,
        managementAttempts: 152,
        controlAttempts: 382,
        combinedAttempts: 534,
        maximumRequests: 4,
        parentProcessId: process.pid,
      }) + '\n',
    );
    const dns = put(
      'dns.mjs',
      `export function lookup(_host,_options,done){done(null,[{address:'1.1.1.1',family:4}]);}`,
    );
    const https = put(
      'https.mjs',
      `import {EventEmitter} from 'node:events';
export function request(url,options,callback){if(options.method!=='GET'||url.hostname!=='muhhammedsayed.app.n8n.cloud'||url.pathname!=='/api/v1/executions'||url.searchParams.get('workflowId')!=='S6KDFsx5IjQRf6tm'||url.searchParams.get('includeData')!=='false')throw Error('SYNTHETIC_ROUTE_BLOCKED');const req=new EventEmitter(),socket=new EventEmitter();socket.encrypted=true;socket.authorized=true;let closed=false;const close=()=>{if(!closed){closed=true;socket.emit('close');}};req.destroy=close;req.end=()=>setImmediate(()=>{req.emit('socket',socket);socket.emit('connect');socket.emit('secureConnect');const response=new EventEmitter();const body=Buffer.from(JSON.stringify({data:[],nextCursor:null}));response.statusCode=200;response.headers={'content-length':String(body.length)};response.complete=true;response.destroy=close;callback(response);response.emit('data',body);response.emit('end');close();});return req;}`,
    );
    const copyUrl = pathToFileURL(entry).href,
      actualReader = pathToFileURL(resolve('scripts/n8n/foundation-native-reader.mjs')).href;
    const preload = put(
      'preload.mjs',
      `import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='./foundation-native-reader.mjs')return {url:${JSON.stringify(actualReader)},shortCircuit:true};if(specifier==='./inventory.mjs'&&context.parentURL?.includes('/scripts/n8n/'))return {url:${JSON.stringify(copyUrl)},shortCircuit:true};if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='node:dns')return {url:${JSON.stringify(pathToFileURL(dns).href)},shortCircuit:true};if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='node:https')return {url:${JSON.stringify(pathToFileURL(https).href)},shortCircuit:true};return next(specifier,context);}});`,
    );
    const env = Object.fromEntries(
      ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
        .filter((k) => process.env[k] !== undefined)
        .map((k) => [k, process.env[k]]),
    );
    const r = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(preload).href, entry, '--wf70-discovery-diagnostic'],
      { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', windowsHide: true, timeout: 10000 },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    const dto = JSON.parse(r.stdout);
    assert.equal(dto.status, 'discovery_complete');
    assert.equal(dto.requestCount, 2);
    assert.equal(dto.networkCompletionVerified, true);
    const rows = readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(
      rows.slice(2).map((r) => r.ordinal),
      [383, 384],
    );
    assert.doesNotMatch(r.stdout, /synthetic-diagnostic-key|x-n8n|executionId|SYNTHETIC/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
const projectId = 'pHvQjDmjxVZ3KQLT';
const payloads = {
  discover: { data: { scopes: [], resources: {}, filters: {}, specUrl: '/api/v1/openapi.yml' } },
  projects: {
    data: [{ id: projectId, name: 'synthetic-private-project-name', type: 'personal' }],
    nextCursor: null,
  },
  workflows: {
    data: [
      {
        id: 'syntheticWorkflow',
        name: 'WF-00 · Orchestrator [dev]',
        active: false,
        isArchived: false,
        shared: [{ projectId, role: 'workflow:owner' }],
      },
    ],
    nextCursor: null,
  },
  credentials: { data: [], nextCursor: null },
};
function fixture(mode = 'success') {
  const state = { requests: 0, closed: 0, options: [] };
  const request = (url, options, callback) => {
    state.requests++;
    state.options.push(options);
    const resource = url.pathname.split('/').at(-1);
    const fault = resource === 'workflows' ? mode : 'success';
    const req = new EventEmitter(),
      socket = new EventEmitter();
    socket.encrypted = true;
    socket.authorized = true;
    let closed = false;
    const close = () => {
      if (!closed) {
        closed = true;
        state.closed++;
        socket.emit('close');
      }
    };
    req.destroy = () => {
      close();
    };
    options.signal.addEventListener('abort', close, { once: true });
    req.end = () => {
      req.emit('socket', socket);
      setImmediate(() => {
        if (fault === 'connect') {
          req.emit('error', Object.assign(new Error('synthetic-private-network'), { code: 'ECONNREFUSED' }));
          close();
          return;
        }
        socket.emit('connect');
        if (['tls', 'tlsExpired', 'tlsHostname'].includes(fault)) {
          req.emit(
            'error',
            Object.assign(new Error('synthetic-private-TLS'), {
              code:
                fault === 'tlsExpired'
                  ? 'CERT_HAS_EXPIRED'
                  : fault === 'tlsHostname'
                    ? 'ERR_TLS_CERT_ALTNAME_INVALID'
                    : 'SELF_SIGNED_CERT_IN_CHAIN',
            }),
          );
          close();
          return;
        }
        socket.emit('secureConnect');
        if (fault === 'status') {
          req.emit('error', Object.assign(new Error('synthetic-private-status'), { code: 'ECONNRESET' }));
          close();
          return;
        }
        const response = new EventEmitter();
        const body =
          fault === 'parse'
            ? Buffer.from('synthetic-private-invalid-json')
            : Buffer.from(
                JSON.stringify(
                  fault === 'schema'
                    ? { data: 'synthetic-private-shape', nextCursor: null }
                    : payloads[resource],
                ),
              );
        response.statusCode = fault === 'http403' ? 403 : 200;
        response.headers = { 'content-length': String(body.length + (fault === 'truncated' ? 1 : 0)) };
        response.destroy = close;
        callback(response);
        response.emit('data', body);
        if (fault === 'bodyAbort') {
          response.emit('aborted');
          close();
          return;
        }
        if (fault === 'bodyTimeout') return;
        response.emit('end');
        close();
      });
    };
    return req;
  };
  const dependencies = {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request,
    // A regression that stops honoring the synthetic native adapter must never
    // fall back to real HTTPS during a local test.
    transport: async () => {
      throw new Error('synthetic-adapter-not-selected');
    },
    timeoutMs: mode === 'bodyTimeout' ? 30 : 1000,
  };
  return { state, dependencies };
}
test('workflow-list diagnostic records only observed safe stages with strict TLS and bounded closed requests', async () => {
  assert.equal(inventoryDiagnosticVersion, 1);
  const f = fixture();
  const result = await runInventory(key, f.dependencies);
  assert.equal(result.status, 'complete');
  assert.equal(result.diagnostics.dns, 'complete');
  assert.equal(result.diagnostics.requests.length, 4);
  const workflow = result.diagnostics.requests[2];
  assert.deepEqual(workflow, {
    resource: 'workflows',
    page: 1,
    tcpConnected: true,
    tlsVerified: true,
    httpStatus: 200,
    bodyRead: 'complete',
    jsonParsed: true,
    schemaValidated: true,
    socketClosed: true,
    failureStage: 'none',
    failureCode: 'none',
  });
  assert.equal(f.state.closed, 4);
  for (const options of f.state.options) {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'muhhammedsayed.app.n8n.cloud');
  }
});
for (const [mode, stage, code] of [
  ['connect', 'connect', 'connection_refused'],
  ['tls', 'tls', 'tls_untrusted'],
  ['tlsExpired', 'tls', 'tls_expired'],
  ['tlsHostname', 'tls', 'tls_hostname'],
  ['status', 'status', 'connection_reset'],
  ['bodyAbort', 'body_read', 'body_aborted'],
  ['truncated', 'body_read', 'body_truncated'],
  ['parse', 'parse', 'invalid_json'],
  ['schema', 'schema', 'invalid_schema'],
  ['http403', 'status', 'http_failed'],
  ['bodyTimeout', 'body_read', 'timeout'],
])
  test(`workflow-list ${mode} retains successful auth/project stages and fixed failure classification`, async () => {
    const f = fixture(mode);
    const result = await runInventory(key, f.dependencies);
    assert.equal(result.authenticationVerified, true);
    assert.equal(result.resources.projects.status, 'complete');
    assert.equal(result.resources.projects.httpStatus, 200);
    const workflow = result.diagnostics.requests[2];
    assert.equal(workflow.resource, 'workflows');
    assert.equal(workflow.failureStage, stage);
    assert.equal(workflow.failureCode, code);
    assert.equal(workflow.schemaValidated, false);
    assert.equal(f.state.closed, f.state.requests);
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic-private|synthetic-diagnostic-key|content-length|headers|stack/,
    );
  });
test('unknown injected transport failure remains unknown instead of inventing TLS/status/body proof', async () => {
  const result = await runInventory(key, {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async () => {
      throw new Error('synthetic-private-unknown');
    },
  });
  assert.equal(result.status, 'network_failed');
  assert.equal(result.diagnostics.requests[0].failureStage, 'unknown');
  assert.equal(result.diagnostics.requests[0].tlsVerified, null);
  assert.equal(result.diagnostics.requests[0].httpStatus, null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
});
test('DNS failure stops before requests and retains no invented transport proof', async () => {
  let requests = 0;
  const result = await runInventory(key, {
    lookup: async () => {
      throw new Error('synthetic-private-dns');
    },
    transport: async () => {
      requests++;
    },
  });
  assert.equal(result.diagnostics.dns, 'failed');
  assert.deepEqual(result.diagnostics.requests, []);
  assert.equal(result.requestCount, 0);
  assert.equal(requests, 0);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
});

function baselineFixture(change = () => {}, status = 200) {
  const record = JSON.parse(readFileSync(new URL('../../n8n/workflows/WF-00.json', import.meta.url), 'utf8'));
  const dto = {
    ...structuredClone(record.workflow),
    settings: { ...structuredClone(record.workflow.settings), ...(record.nativeReadonlySettings ?? {}) },
    id: record.id,
    versionId: record.versionId,
    active: false,
    activeVersionId: null,
    isArchived: false,
    shared: [{ projectId, role: 'workflow:owner' }],
    pinData: {},
  };
  change(dto);
  const calls = [];
  return {
    dto,
    calls,
    dependencies: {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request(url, options, callback) {
        calls.push({ url: url.href, options });
        const req = new EventEmitter(),
          socket = new EventEmitter();
        socket.encrypted = true;
        socket.authorized = true;
        let closed = false;
        const close = () => {
          if (!closed) {
            closed = true;
            socket.emit('close');
          }
        };
        req.destroy = close;
        options.signal.addEventListener('abort', close, { once: true });
        req.end = () => {
          req.emit('socket', socket);
          setImmediate(() => {
            socket.emit('connect');
            socket.emit('secureConnect');
            const response = new EventEmitter(),
              body = Buffer.from(JSON.stringify(dto));
            response.statusCode = status;
            response.headers = { 'content-length': String(body.length) };
            response.destroy = close;
            callback(response);
            response.emit('data', body);
            response.emit('end');
            close();
          });
        };
        return req;
      },
      timeoutMs: 1000,
    },
  };
}
test('one owned baseline diagnostic performs exactly one strict GET and projects matching booleans only', async () => {
  const f = baselineFixture();
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'matching_baseline');
  assert.equal(result.requestCount, 1);
  assert.equal(result.authenticationVerified, true);
  assert.equal(result.projectVerified, true);
  assert.equal(result.diagnostics.requests[0].socketClosed, true);
  assert.deepEqual(result.baseline.failedChecks, []);
  assert.equal(f.calls.length, 1);
  assert.equal(
    f.calls[0].url,
    'https://muhhammedsayed.app.n8n.cloud/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
  );
  assert.equal(f.calls[0].options.method, 'GET');
  assert.equal(f.calls[0].options.rejectUnauthorized, true);
  assert.doesNotMatch(
    JSON.stringify(result),
    /"nodes":|"parameters":|"connections":|"settings":|headers|synthetic-diagnostic-key|sha256|versionId/,
  );
});
test('one baseline diagnostic reports all safe mismatch codes, never supplied private values', async () => {
  const f = baselineFixture((dto) => {
    dto.versionId = 'SYNTHETIC_PRIVATE_VERSION';
    dto.settings.private = 'SYNTHETIC_PRIVATE_VALUE';
    dto.name = 'SYNTHETIC_PRIVATE_NAME';
  });
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'baseline_mismatch');
  assert.deepEqual(result.baseline.failedChecks, ['version_mismatch', 'graph_name', 'graph_settings']);
  assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|versionId|sha256|"parameters":/);
});
test('baseline diagnostic refuses reflected key and HTTP denial without retry or DTO export', async () => {
  for (const [change, status, expected] of [
    [
      (dto) => {
        dto.meta = { secret: key };
      },
      200,
      'confidentiality_rejected',
    ],
    [() => {}, 403, 'http_failed'],
  ]) {
    const f = baselineFixture(change, status),
      result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
    assert.equal(result.status, expected);
    assert.equal(result.baseline, null);
    assert.equal(f.calls.length, 1);
    assert.equal(result.diagnostics.requests[0].socketClosed, true);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-diagnostic-key|secret|parameters|versionId/);
  }
});

test('one GET forensics can recognize a reviewed graph variant without claiming pinned baseline or edit provenance', async () => {
  const f = baselineFixture((dto) => {
    delete dto.settings.binaryMode;
    dto.versionId = 'SYNTHETIC_PRIVATE_NEW_VERSION';
    for (const n of dto.nodes) if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
    dto.settings.availableInMCP = true;
    dto.settings.saveManualExecutions = true;
  });
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'baseline_mismatch');
  assert.deepEqual(result.baseline.failedChecks, ['version_mismatch', 'graph_nodes', 'graph_settings']);
  assert.equal(result.forensics.knownVariants.stagedC01ManualGraphEqual, true);
  assert.equal(result.forensics.nodeCategories.parametersEqual, true);
  assert.equal(result.forensics.nodeCategories.behaviorEqual, false);
  assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|provenance|"parameters":|versionId/);
});
