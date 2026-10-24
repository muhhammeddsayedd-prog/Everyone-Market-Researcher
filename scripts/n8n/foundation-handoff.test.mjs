import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  cpSync,
  appendFileSync,
} from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const env = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
// Isolated public-record fixture: rewrite only public SHA pins in copied real
// modules. Production WeakMaps, validators and default cleanup ports are used;
// no context constructor or acceptance/closure validator is injected.
async function technical16CleanupFixture({
  unresolved = false,
  remainingMs = 60000,
  cleanupEntryRetry = true,
  liveFailedProcess = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'emr-technical16-cleanup-'));
  const put = (path, value) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    const bytes = Buffer.isBuffer(value)
      ? value
      : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
    writeFileSync(target, bytes);
    return createHash('sha256').update(bytes).digest('hex');
  };
  const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
  try {
    for (const match of readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').matchAll(
      /^  '([^']+)'/gm,
    ))
      put(match[1], readFileSync(match[1]));
    const pending = ['scripts/n8n/foundation-provision-cli.mjs'],
      seen = new Set();
    while (pending.length) {
      const relative = pending.shift();
      if (seen.has(relative)) continue;
      seen.add(relative);
      const text = readFileSync(relative, 'utf8');
      put(relative, text);
      for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
        if (!match[1].startsWith('.')) continue;
        let target = resolve(dirname(relative), match[1]);
        if (!existsSync(target) && existsSync(target + '.ts')) target += '.ts';
        pending.push(target.slice(resolve('.').length + 1).replaceAll('\\', '/'));
      }
    }
    for (const relative of [
      'package.json',
      'scripts/package.json',
      'packages/shared/package.json',
      'n8n/foundation/package.json',
      'n8n/foundation/bindings.dev.json',
      'n8n/foundation/transport.dev.json',
      'n8n/normalizers/smoke_website_stub.js',
      'n8n/normalizers/smoke_website_m03.js',
    ])
      put(relative, readFileSync(relative));
    const physical = join(root, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
    mkdirSync(dirname(physical), { recursive: true });
    cpSync(resolve('node_modules/.pnpm/zod@4.6.7/node_modules/zod'), physical, { recursive: true });
    const shared = join(root, 'packages/shared/node_modules');
    mkdirSync(shared, { recursive: true });
    symlinkSync(physical, join(shared, 'zod'), process.platform === 'win32' ? 'junction' : 'dir');
    const bindings = json('n8n/foundation/bindings.dev.json'),
      stagingTransport = json('n8n/foundation/transport.dev.json');
    const records = Object.keys(bindings.workflowRefs).map((key) => {
      const path = 'n8n/workflows/' + key + '.json';
      put(path, readFileSync(path));
      return json(path);
    });
    const [
      { materializeFoundationAcceptanceCase },
      { buildFoundationGatewayWorkflows },
      { graphBody },
      retention,
      checkpoint,
      { createFoundationRuntimeBaseline },
    ] = await Promise.all([
      import('../../n8n/foundation/materialize-acceptance-case.mjs'),
      import('../../n8n/foundation/build-foundation-gateway.mjs'),
      import('./foundation-bind.mjs'),
      import('./foundation-retention-proposal.mjs'),
      import('./foundation-runtime-checkpoint.mjs'),
      import('./foundation-runtime-plan.mjs'),
    ]);
    const evidence = 'milestones/M03-n8n-foundation/evidence/';
    const originalPath = evidence + 'dev-acceptance-technical16-reconciliation-20261024.json';
    const cleanupPath = evidence + 'dev-acceptance-technical16-cleanup-20261024.json';
    const custodyPath = evidence + 'technical16-postclose-custody-20261024.json';
    const dbPath = evidence + 'technical16-postclose-db-readback-20261024.json';
    const resolutionPath = evidence + 'technical16-executed-parameters-resolution-20261024.json';
    const original = json(originalPath),
      cleanup = json(cleanupPath),
      custody = json(custodyPath),
      db = json(dbPath),
      resolution = json(resolutionPath);
    const replacements = new Map();
    for (const document of [original, custody])
      for (const path of Object.keys(document.pins))
        put(path, path.endsWith('.png') ? Buffer.from([137, 80, 78, 71, 255, 0]) : '{}\n');
    const runtimeTransport = {
      credential: stagingTransport.credential,
      audience: db.rawResult.inspection.window.audience,
      windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
    };
    const policy = retention.createFoundationApprovedRetentionPolicy({ bindings, records });
    const rootBody = graphBody(
      materializeFoundationAcceptanceCase(bindings, runtimeTransport, 'dispatch.vimeo'),
    );
    rootBody.settings = retention.applyFoundationApprovedRetentionSettings(
      policy,
      'WF-00',
      rootBody.settings,
    );
    rootBody.settings.availableInMCP = true;
    for (const node of rootBody.nodes)
      if (
        node.type !== 'n8n-nodes-base.manualTrigger' &&
        (/Trigger$/.test(node.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.form'].includes(node.type))
      )
        node.disabled = true;
    const childBody = graphBody(
      buildFoundationGatewayWorkflows(bindings, runtimeTransport).find((graph) => graph.key === 'WF-10'),
    );
    childBody.settings = retention.applyFoundationApprovedRetentionSettings(
      policy,
      'WF-10',
      childBody.settings,
    );
    childBody.settings.availableInMCP = false;
    childBody.settings.errorWorkflow = bindings.workflowRefs['WF-90'].id;
    const rootVersion = 'SyntheticTechnical16Root',
      childVersion = 'SyntheticTechnical16Child';
    const instant = Date.parse('2026-10-24T16:33:00.000Z'),
      intent = instant - 60000;
    const runtimePath = 'scripts/n8n/out/foundation/live/runtime.technical-16.jsonl';
    put(
      runtimePath,
      [
        ['WF-10', 10, childVersion, childBody],
        ['WF-00', 37, rootVersion, rootBody],
      ]
        .flatMap(([key, sequence, versionId, body]) => {
          const graphHash = checkpoint.foundationRuntimeGraphHash(body);
          return [
            { event: 'intent', action: 'save', key, sequence, target: { graphHash } },
            { event: 'verified', sequence, after: { versionId, activeVersionId: null, graphHash } },
          ];
        })
        .map((value) => JSON.stringify(value))
        .join('\n') + '\n',
    );
    put(
      'scripts/n8n/out/foundation/live/control.jsonl',
      JSON.stringify({
        event: 'native_start_ack',
        caseId: 'dispatch.vimeo',
        workflowKey: 'WF-00',
        workflowId: bindings.workflowRefs['WF-00'].id,
        executionId: '31130',
        versionId: rootVersion,
        intentAt: new Date(intent).toISOString(),
      }) + '\n',
    );
    for (const document of [original, custody])
      for (const path of Object.keys(document.pins))
        document.pins[path] = createHash('sha256')
          .update(readFileSync(join(root, path)))
          .digest('hex');
    const oldOriginalSha = 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb';
    const newOriginalSha = put(originalPath, original);
    replacements.set(oldOriginalSha, newOriginalSha);
    for (const document of [cleanup, custody, db, resolution])
      if (document.originalAttemptSha256) document.originalAttemptSha256 = newOriginalSha;
    cleanup.attemptReceiptSha256 = newOriginalSha;
    replacements.set(
      '49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57',
      put(cleanupPath, cleanup),
    );
    replacements.set(
      'a0bf0dccf6bcf19027d1aba99601fe61a117fec8900128800d3bf3cfa63874cf',
      put(custodyPath, custody),
    );
    const dbLatest = 'scripts/db/out/m03-foundation-inspect-1b7b1987-ac32-4e3a-914c-9bda1b1b6d74-latest.json';
    db.pins[dbLatest] = put(dbLatest, db.rawResult);
    replacements.set('68f02df7aab0b468ff202ec99630207650fa503eda57b46f81a1166fad9ab222', put(dbPath, db));
    replacements.set(
      'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b',
      put(resolutionPath, resolution),
    );
    const failedPath = evidence + 'technical16-native-cleanup-attempt1-20261024.json';
    if (cleanupEntryRetry) {
      const failed = json(failedPath),
        claimPath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json',
        journalPath = 'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl',
        sealPath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json';
      const once = {
        kind: 'm03_technical16_cleanup_once',
        version: 1,
        resolutionSha256: replacements.get(
          'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b',
        ),
        executionIds: ['31131', '31130'],
        processId: liveFailedProcess ? process.pid : 2147483646,
        parentProcessId: 2147483647,
        usage: structuredClone(resolution.usage),
        maximumRequests: 158,
        maximumControlRequests: 158,
        at: '2026-10-24T18:23:02.321Z',
      };
      failed.cleanup.childProcessId = once.processId;
      failed.cleanup.parentProcessId = once.parentProcessId;
      failed.originalAttemptSha256 = newOriginalSha;
      failed.resolutionSha256 = once.resolutionSha256;
      failed.pins[claimPath] = put(claimPath, once);
      failed.pins[journalPath] = put(
        journalPath,
        JSON.stringify({
          event: 'technical16_cleanup_header',
          version: 1,
          resolutionSha256: once.resolutionSha256,
          originalAttemptSha256: newOriginalSha,
        }) + '\n',
      );
      const publicSources = [
        ...readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').matchAll(
          /^  '([^']+)'/gm,
        ),
      ].map((match) => match[1]);
      const historicalFilesFor = (count, fixed) => {
        const paths = [...new Set([...Object.keys(fixed), ...publicSources])]
          .filter((path) => !path.includes('/out/'))
          .slice(0, count);
        assert.equal(paths.length, count);
        return Object.assign(
          Object.fromEntries(
            paths.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
          ),
          fixed,
        );
      };
      const historicalFiles = historicalFilesFor(91, {
        'scripts/n8n/foundation-provision-cli.mjs':
          '70ccd4efafe4cbc2d25a723c527ec5fc883993eee21b67c65bee455f6c41905f',
        'scripts/n8n/foundation-native-reader.mjs':
          'fc7279cbf4568e1e0268328ca5641ab9be65742187aaaccad9a4cbfd2543abfc',
        'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1':
          '8ce86d0a26041f9ea446afce21bf9e64ef7399aa59515c924d6337a8759716c7',
      });
      assert.equal(Object.keys(historicalFiles).length, 91);
      failed.pins[sealPath] = put(sealPath, {
        version: 2,
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        files: historicalFiles,
      });
      replacements.set(
        '9aade5d3ae4c4a0a3aace8da74c38e3b0c9f1da672d7187c7ff1b14aeee9ca1b',
        failed.pins[sealPath],
      );
      put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
      replacements.set(
        '1e165ea75442200af05e57206c32cd0edc07c248571a1405ae8025e31588e66e',
        failed.pins[claimPath],
      );
      replacements.set(
        '4fccea19e19a162ca2d7b912c200a0cb1fc857b9ea54d4bdf5b6f97f76dd71d7',
        failed.pins[journalPath],
      );
      replacements.set(
        '4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960',
        put(failedPath, failed),
      );
      const secondPath = evidence + 'technical16-native-cleanup-attempt2-20261024.json',
        second = json(secondPath),
        secondOncePath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.json',
        secondJournalPath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.jsonl',
        secondResultPath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2-result.json',
        secondSealPath = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.provision-seal.json',
        oldArchive = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock';
      const secondOnce = {
        ...structuredClone(once),
        cleanupAttempt: 2,
        priorFailedAttemptSha256: replacements.get(
          '4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960',
        ),
        priorOnceSha256: failed.pins[claimPath],
        priorJournalSha256: failed.pins[journalPath],
        processId: 2147483644,
        parentProcessId: 2147483645,
      };
      second.cleanup.childProcessId = secondOnce.processId;
      second.cleanup.parentProcessId = secondOnce.parentProcessId;
      second.originalAttemptSha256 = newOriginalSha;
      second.resolutionSha256 = once.resolutionSha256;
      second.priorFailedAttemptSha256 = secondOnce.priorFailedAttemptSha256;
      const secondResult = Object.fromEntries(
        Object.entries(second.rawResult).filter(
          ([key]) =>
            ![
              'nativeExit',
              'childClosed',
              'credentialChildrenClosed',
              'parentLockDeleted',
              'privateRead',
              'persistentManagementRetained',
            ].includes(key),
        ),
      );
      const secondRows = [
        {
          event: 'technical16_cleanup_header',
          version: 1,
          resolutionSha256: once.resolutionSha256,
          originalAttemptSha256: newOriginalSha,
          cleanupAttempt: 2,
          priorFailedAttemptSha256: secondOnce.priorFailedAttemptSha256,
          priorOnceSha256: secondOnce.priorOnceSha256,
          priorJournalSha256: secondOnce.priorJournalSha256,
        },
        ...Array.from({ length: 4 }, (_, index) => ({
          event: 'technical16_http_intent',
          ordinal: index + 1,
          kind: index % 2 === 0 ? 'metadata' : 'full',
          workflowId: bindings.workflowRefs[index < 2 ? 'WF-00' : 'WF-10'].id,
          executionId: index < 2 ? '31130' : '31131',
          managementAttempts: 830 + index,
          controlAttempts: 961 + index,
          at: '2026-10-24T18:42:00.000Z',
        })),
      ];
      second.pins[secondOncePath] = put(secondOncePath, secondOnce);
      second.pins[secondJournalPath] = put(
        secondJournalPath,
        secondRows.map((row) => JSON.stringify(row)).join('\n') + '\n',
      );
      second.pins[secondResultPath] = put(secondResultPath, secondResult);
      second.pins[oldArchive] = put(oldArchive, 'emr-m03-foundation-live-runtime-v1\n');
      second.pins[secondSealPath] = put(secondSealPath, {
        version: 2,
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        files: historicalFilesFor(92, {
          'scripts/n8n/foundation-provision-cli.mjs':
            '5d6a8b8fa1fe4ab6ce2ae41c5958dc7813eb01a297281205101eb749b2e6580b',
          'scripts/n8n/foundation-native-reader.mjs':
            'fc7279cbf4568e1e0268328ca5641ab9be65742187aaaccad9a4cbfd2543abfc',
          'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1':
            '4a18acaa05614b9dc30c260166c9ddf424dee5012578218478ec54361f45c8bd',
        }),
      });
      for (const [before, path] of [
        ['86e74f0c574384e33c28721b345899476d198d49e91501c3f37d8a27f9361639', secondOncePath],
        ['bac9e865ea04c6f083dc836e2e71e0cd37a58dc542a5f03af7ed06767b66ee17', secondJournalPath],
        ['efa7b2812baf34f520eac9bea4337b5197bfc680244acaaabe6fcead8a55c137', secondResultPath],
        ['45a924660d94d87a5fc9eab45307c550a74288b6556873633c39b571c37b62be', secondSealPath],
      ])
        replacements.set(before, second.pins[path]);
      replacements.set(
        '5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57',
        put(secondPath, second),
      );
    } else if (existsSync(join(root, failedPath))) rmSync(join(root, failedPath));
    const cliPath = join(root, 'scripts/n8n/foundation-provision-cli.mjs');
    let cliText = readFileSync(cliPath, 'utf8');
    for (const [before, after] of replacements) cliText = cliText.replaceAll(before, after);
    const psPath = join(root, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1');
    let psText = readFileSync(psPath, 'utf8');
    for (const [before, after] of replacements) psText = psText.replaceAll(before, after);
    writeFileSync(psPath, psText);
    if (unresolved)
      cliText = cliText.replace(
        /executedBodyResolutionSha256: '[a-f0-9]{64}'/,
        'executedBodyResolutionSha256: null',
      );
    writeFileSync(cliPath, cliText);
    const cli = await import(pathToFileURL(cliPath).href);
    if (unresolved)
      return {
        root,
        cliPath,
        cli,
        close() {
          rmSync(root, { recursive: true, force: true });
        },
      };
    const context = await cli.checkTechnical16Cleanup(),
      source = cli.assertTechnical16CleanupContext(context);
    const readerModule = await import(
      pathToFileURL(join(root, 'scripts/n8n/foundation-native-reader.mjs')).href
    );
    const cleanupModule = await import(
      pathToFileURL(join(root, 'scripts/n8n/foundation-native-cleanup.mjs')).href
    );
    const { createFoundationControlJournal } = await import(
      pathToFileURL(join(root, 'scripts/n8n/foundation-control-state.mjs')).href
    );
    const metadata = new Map(),
      snapshots = new Map(),
      workflows = new Map(),
      deleted = new Set(),
      calls = [],
      events = [],
      charges = [];
    const iso = (n) => new Date(intent + n).toISOString();
    for (const [key, id, versionId, mode, body] of [
      ['WF-00', '31130', rootVersion, 'manual', rootBody],
      ['WF-10', '31131', childVersion, 'integrated', childBody],
    ]) {
      const row = {
        id,
        workflowId: bindings.workflowRefs[key].id,
        workflowVersionId: versionId,
        mode,
        status: 'success',
        createdAt: iso(key === 'WF-00' ? 0 : 100),
        startedAt: iso(key === 'WF-00' ? 10 : 110),
        stoppedAt: iso(key === 'WF-00' ? 1000 : 500),
        waitTill: null,
      };
      metadata.set(id, row);
      const snapshot = {
        ...structuredClone(row),
        workflowData: {
          id: row.workflowId,
          ...structuredClone(checkpoint.foundationRuntimeExecutionParameterCandidates(body).nativeDefaults),
        },
        data: { resultData: { runData: {}, pinData: {} } },
      };
      Object.assign(
        snapshot.workflowData.settings,
        records.find((record) => record.key === key).nativeReadonlySettings ?? {},
      );
      if (key === 'WF-00') {
        const node = body.nodes.find(
          (node) =>
            node.type === 'n8n-nodes-base.executeWorkflow' &&
            (node.parameters.workflowId?.value ?? node.parameters.workflowId) ===
              bindings.workflowRefs['WF-10'].id,
        );
        assert.ok(node);
        snapshot.data.resultData.runData[node.name] = [
          {
            metadata: {
              subExecution: { executionId: '31131', workflowId: bindings.workflowRefs['WF-10'].id },
            },
            data: { main: [[{ json: {} }]] },
          },
        ];
      } else
        snapshot.data.parentExecution = {
          executionId: '31130',
          workflowId: bindings.workflowRefs['WF-00'].id,
          shouldResume: false,
        };
      snapshots.set(id, snapshot);
    }
    for (const baseline of createFoundationRuntimeBaseline({ bindings, records }))
      workflows.set(baseline.id, {
        ...structuredClone(baseline.body),
        id: baseline.id,
        versionId: custody.restoration.restoredVersions[baseline.key],
        settings: { ...structuredClone(baseline.body.settings), ...(baseline.nativeReadonlySettings ?? {}) },
        active: false,
        activeVersionId: null,
        isArchived: false,
        pinData: {},
        shared: [{ projectId: bindings.projectId, role: 'workflow:owner' }],
        tags: structuredClone(baseline.tags),
      });
    let clock = instant,
      lostAck = false,
      extraCandidate = null,
      advanceDelete = false,
      advanceAfterReads = null;
    const clockNow = () => {
      if (advanceAfterReads === 0) {
        clock += 16000;
        advanceAfterReads = null;
      } else if (advanceAfterReads !== null) advanceAfterReads--;
      return clock;
    };
    const wire = (dto, status = 200) => ({
      status,
      body: (async function* () {
        yield Buffer.from(JSON.stringify(dto));
      })(),
      closed: Promise.resolve(),
    });
    const transport = {
      request: async ({ method, path }) => {
        calls.push({ method, path });
        const execution = /^\/api\/v1\/executions\/(\d+)(?:\?includeData=(false|true))?$/.exec(path);
        if (execution) {
          const id = execution[1];
          if (method === 'DELETE') {
            deleted.add(id);
            if (lostAck) throw Error('SYNTHETIC_PRIVATE_LOST_ACK');
            return wire({ ...metadata.get(id), id: Number(id) });
          }
          return deleted.has(id)
            ? wire({ message: 'not found' }, 404)
            : wire(execution[2] === 'true' ? snapshots.get(id) : metadata.get(id));
        }
        const workflow = /^\/api\/v1\/workflows\/([^?]+)/.exec(path);
        if (workflow) return wire(workflows.get(workflow[1]));
        const url = new URL('https://synthetic.invalid' + path);
        const id = url.searchParams.get('workflowId');
        return wire({
          data: url.searchParams.has('status')
            ? []
            : [...metadata.values()]
                .filter((row) => row.workflowId === id)
                .concat(extraCandidate?.workflowId === id ? [extraCandidate] : []),
          nextCursor: null,
        });
      },
    };
    const budget = cli.createTechnical16CleanupBudget({
      context,
      deadlineAt: instant + remainingMs,
      now: clockNow,
      append: (row) => {
        charges.push(row);
      },
    });
    const admit = (args) => {
      budget.admit(args);
      if (advanceDelete && args.kind === 'delete') clock += 16000;
    };
    const reader = readerModule.createFoundationNativeReader({
      bindings,
      transport,
      admitControlAttempt: admit,
      now: clockNow,
      deadlineAt: instant + remainingMs,
      sensitiveValues: ['SYNTHETIC_TECHNICAL16_PRIVATE_KEY'],
    });
    const journal = createFoundationControlJournal({
      durableAppend: (row) => {
        events.push(row);
      },
    });
    const cleanupPort = cleanupModule.createFoundationNativeCleanup({
      reader,
      transport,
      journal,
      admitControlAttempt: admit,
      now: clockNow,
      deadlineAt: instant + remainingMs,
    });
    return {
      root,
      cliPath,
      cli,
      context,
      source,
      readerModule,
      cleanupModule,
      reader,
      cleanup: cleanupPort,
      budget,
      calls,
      events,
      charges,
      metadata,
      snapshots,
      workflows,
      setLostAck() {
        lostAck = true;
      },
      setAdvanceDelete() {
        advanceDelete = true;
      },
      setClock(ms) {
        clock = instant + ms;
      },
      setAdvanceAfterReads(count) {
        advanceAfterReads = count;
      },
      setExtraCandidate(row) {
        extraCandidate = row;
      },
      instant,
      close() {
        assert.equal(dirname(root), tmpdir());
        assert.ok(basename(root).startsWith('emr-technical16-cleanup-'));
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

// Spawn the actual copied entry module rather than importing it first. A real
// PowerShell parent holds the required Windows file lock; only the copied HTTP
// transport is replaced with a finite, local DTO adapter.
function runTechnical16CleanupEntry(f, { qualificationOnly = false } = {}) {
  const put = (path, value) => writeFileSync(join(f.root, path), value);
  put(
    'technical16-entry-data.json',
    JSON.stringify({
      metadata: [...f.metadata],
      snapshots: [...f.snapshots],
      workflows: [...f.workflows],
    }),
  );
  put(
    'scripts/n8n/foundation-native-transport.mjs',
    `import {readFileSync,appendFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url), rows=JSON.parse(readFileSync(new URL('technical16-entry-data.json',root),'utf8'));
export function createFoundationNativeTransport({apiKey,authorizeExecution}){
 if(apiKey!=='SYNTHETIC_TECHNICAL16_PRIVATE_KEY')throw Error('SYNTHETIC_KEY_BLOCKED');
 const metadata=new Map(rows.metadata),snapshots=new Map(rows.snapshots),workflows=new Map(rows.workflows),deleted=new Set();let closed=false;
 const wire=(dto,status=200)=>({status,body:(async function*(){yield Buffer.from(JSON.stringify(dto));})(),closed:Promise.resolve()});
 return {request:async({method,path})=>{if(closed)throw Error('SYNTHETIC_CLOSED');appendFileSync(new URL('technical16-entry-calls.jsonl',root),JSON.stringify({method,path})+'\\n');
 const execution=/^\\/api\\/v1\\/executions\\/(\\d+)(?:\\?includeData=(false|true))?$/.exec(path);
 if(execution){const id=execution[1];if(!metadata.has(id)||!authorizeExecution({method,executionId:id}))throw Error('SYNTHETIC_SCOPE_BLOCKED');
 if(method==='DELETE'){deleted.add(id);return wire({...metadata.get(id),id:Number(id)});}
 if(method!=='GET')throw Error('SYNTHETIC_METHOD_BLOCKED');return deleted.has(id)?wire({message:'not found'},404):wire(execution[2]==='true'?snapshots.get(id):metadata.get(id));}
 const workflow=/^\\/api\\/v1\\/workflows\\/([^?]+)/.exec(path);if(method==='GET'&&workflow&&workflows.has(workflow[1]))return wire(workflows.get(workflow[1]));
 const url=new URL('https://synthetic.invalid'+path);if(method!=='GET'||url.pathname!=='/api/v1/executions'||!workflows.has(url.searchParams.get('workflowId')))throw Error('SYNTHETIC_SCOPE_BLOCKED');
 return wire({data:url.searchParams.has('status')?[]:[...metadata.values()].filter(row=>row.workflowId===url.searchParams.get('workflowId')),nextCursor:null});},
 close(){closed=true;appendFileSync(new URL('technical16-entry-closed',root),'closed');},state(){return {pendingRequests:0,unclosedResponses:0};}};
}
`,
  );
  const ps = (value) => "'" + value.replaceAll("'", "''") + "'";
  const coordinator = readFileSync(
      join(f.root, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1'),
      'utf8',
    ),
    publicFileFunctions = coordinator.slice(
      coordinator.indexOf('function Safe-File('),
      coordinator.indexOf('function Invoke-M03Technical13Public('),
    );
  mkdirSync(join(f.root, 'Temp'), { recursive: true });
  const runner = join(f.root, 'technical16-entry-parent.ps1');
  writeFileSync(
    runner,
    `$ErrorActionPreference='Stop'
${publicFileFunctions}
$root=${ps(f.root)}
$repo=$root
$lockPath=Join-Path $root 'Temp\\emr-m03-acceptance-parent.operation.lock'
$lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
$child=$null
try{
 $marker=[Text.Encoding]::UTF8.GetBytes((@{kind='m03_technical16_cleanup_parent';version=1;processId=$PID}|ConvertTo-Json -Compress))
 $lock.Write($marker,0,$marker.Length);$lock.Flush($true)
 Move-M03Technical16StaleLock
 $si=New-Object Diagnostics.ProcessStartInfo
 $si.FileName=${ps(process.execPath)};$si.Arguments='"'+${ps(f.cliPath)}+'" ${qualificationOnly ? 'CleanupTechnical16Diagnose' : 'CleanupTechnical16'}';$si.UseShellExecute=$false;$si.CreateNoWindow=$true
 $si.RedirectStandardInput=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
 $si.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','APPDATA','USERPROFILE')){ $v=[Environment]::GetEnvironmentVariable($name);if($null -ne $v){$si.EnvironmentVariables[$name]=$v} }
 $si.EnvironmentVariables['LOCALAPPDATA']=$root
 $child=New-Object Diagnostics.Process;$child.StartInfo=$si;[void]$child.Start()
 $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
 $child.StandardInput.Write((@{key='SYNTHETIC_TECHNICAL16_PRIVATE_KEY';expiresAt=[DateTime]::UtcNow.AddMinutes(5).ToString('o');purpose='m03_technical16_native_cleanup';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77'}|ConvertTo-Json -Compress));$child.StandardInput.Close()
 if(-not $child.WaitForExit(120000)){ $child.Kill();throw 'SYNTHETIC_CHILD_TIMEOUT' }
 $result=@{nativeExit=$child.ExitCode;stdout=$stdout.Result;stderr=$stderr.Result}
}finally{if($null -ne $child){$child.Dispose()};$lock.Dispose();Remove-Item -LiteralPath $lockPath -ErrorAction Stop}
$result.parentLockAbsent= -not (Test-Path -LiteralPath $lockPath)
$result|ConvertTo-Json -Compress
`,
  );
  const child = spawnSync('powershell.exe', ['-NoProfile', '-File', runner], {
    env: env(),
    encoding: 'utf8',
    timeout: 135000,
    windowsHide: true,
  });
  assert.equal(child.status, 0);
  assert.equal(child.stderr, '');
  return JSON.parse(child.stdout);
}

test(
  'technical16 actual cleanup ENTRY completes qualification, durable85calls, result and finally under a real held parent lock',
  { skip: process.platform !== 'win32' },
  async () => {
    const f = await technical16CleanupFixture();
    try {
      const child = runTechnical16CleanupEntry(f);
      assert.equal(child.nativeExit, 0);
      assert.equal(child.stderr, '');
      assert.equal(child.parentLockAbsent, true);
      assert.doesNotMatch(child.stdout, /SYNTHETIC_TECHNICAL16_PRIVATE_KEY/);
      const result = JSON.parse(child.stdout);
      assert.equal(result.status, 'native_cleanup_verified');
      assert.equal(result.networkCompletionVerified, true);
      assert.equal(result.originalPublicRecordsUnchanged, true);
      assert.equal(result.remoteWorkSettled, true);
      assert.equal(result.nativeAcceptanceProven, false);
      assert.equal(result.requestCount, 85);
      const output = join(f.root, 'scripts/n8n/out/foundation/');
      assert.deepEqual(
        JSON.parse(readFileSync(join(output, 'technical16-native-cleanup-attempt3-result.json'), 'utf8')),
        result,
      );
      const journal = readFileSync(join(output, 'technical16-native-cleanup-attempt3.jsonl'), 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse);
      assert.equal(journal.filter((row) => row.event === 'technical16_http_intent').length, 85);
      assert.deepEqual(
        journal.filter((row) => row.event === 'native_cleanup_result').map((row) => row.executionId),
        ['31131', '31130'],
      );
      assert.equal(existsSync(join(output, 'technical16-native-cleanup-attempt3.json')), true);
      assert.equal(existsSync(join(output, 'live/runtime.operation.lock')), false);
      assert.equal(existsSync(join(f.root, 'technical16-entry-closed')), true);
    } finally {
      f.close();
    }
  },
);

test(
  'technical16 actual cleanup ENTRY retains both failed claims and four charged reads using new ordinal3 files',
  { skip: process.platform !== 'win32' },
  async () => {
    const f = await technical16CleanupFixture({ cleanupEntryRetry: true });
    try {
      const output = join(f.root, 'scripts/n8n/out/foundation/'),
        originalOnce = readFileSync(join(output, 'technical16-native-cleanup-attempt.json')),
        originalJournal = readFileSync(join(output, 'technical16-native-cleanup.jsonl')),
        originalLock = readFileSync(join(output, 'live/runtime.operation.lock'));
      const child = runTechnical16CleanupEntry(f);
      assert.equal(child.nativeExit, 0);
      assert.equal(child.stderr, '');
      const result = JSON.parse(child.stdout);
      assert.equal(result.status, 'native_cleanup_verified');
      assert.equal(result.requestCount, 85);
      assert.equal(result.managementAttempts, 918);
      assert.equal(result.controlAttempts, 1049);
      assert.equal(result.nativeAcceptanceProven, false);
      assert.deepEqual(readFileSync(join(output, 'technical16-native-cleanup-attempt.json')), originalOnce);
      assert.deepEqual(readFileSync(join(output, 'technical16-native-cleanup.jsonl')), originalJournal);
      assert.deepEqual(
        readFileSync(join(output, 'technical16-native-cleanup-attempt2.runtime-lock')),
        originalLock,
      );
      const once3 = JSON.parse(
        readFileSync(join(output, 'technical16-native-cleanup-attempt3.json'), 'utf8'),
      );
      assert.equal(once3.cleanupAttempt, 3);
      assert.equal(once3.maximumRequests, 154);
      assert.equal(once3.usage.management, 833);
      const journal = readFileSync(join(output, 'technical16-native-cleanup-attempt3.jsonl'), 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse);
      assert.equal(journal[0].cleanupAttempt, 3);
      assert.equal(journal.filter((row) => row.event === 'technical16_http_intent').length, 85);
      assert.equal(existsSync(join(output, 'technical16-native-cleanup-attempt3-result.json')), true);
      assert.equal(existsSync(join(output, 'technical16-native-cleanup-result.json')), false);
      assert.equal(existsSync(join(output, 'live/runtime.operation.lock')), false);
    } finally {
      f.close();
    }
  },
);

test(
  'technical16 actual cleanup ENTRY with an unqualified parent link emits a closed residual result and zero DELETE',
  { skip: process.platform !== 'win32' },
  async () => {
    const f = await technical16CleanupFixture();
    try {
      f.snapshots.get('31131').data.parentExecution.executionId = '99999';
      const child = runTechnical16CleanupEntry(f);
      assert.equal(child.nativeExit, 1);
      assert.equal(child.stderr, '');
      assert.equal(child.parentLockAbsent, true);
      assert.doesNotMatch(child.stdout, /SYNTHETIC_TECHNICAL16_PRIVATE_KEY|99999/);
      const result = JSON.parse(child.stdout);
      assert.equal(result.status, 'cleanup_reconciliation_required');
      assert.equal(result.networkCompletionVerified, true);
      assert.equal(result.originalPublicRecordsUnchanged, true);
      assert.equal(result.qualifiedSideEffects, false);
      assert.equal(result.recordsDeleted, 0);
      const calls = readFileSync(join(f.root, 'technical16-entry-calls.jsonl'), 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse);
      assert.equal(calls.filter((row) => row.method === 'DELETE').length, 0);
      assert.equal(existsSync(join(f.root, 'technical16-entry-closed')), true);
      assert.equal(
        existsSync(
          join(f.root, 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3-result.json'),
        ),
        true,
      );
    } finally {
      f.close();
    }
  },
);

test('technical16 spent zero-intent recovery refuses missing or changed old artifacts before stdin or network', async () => {
  const f = await technical16CleanupFixture({ cleanupEntryRetry: true });
  try {
    const output = join(f.root, 'scripts/n8n/out/foundation/'),
      once = join(output, 'technical16-native-cleanup-attempt.json'),
      journal = join(output, 'technical16-native-cleanup.jsonl'),
      lock = join(output, 'live/runtime.operation.lock'),
      oldResult = join(output, 'technical16-native-cleanup-result.json'),
      archive = join(output, 'technical16-native-cleanup-attempt2.runtime-lock');
    const failedRecord = join(
      f.root,
      'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json',
    );
    const originals = new Map([once, journal, lock, failedRecord].map((path) => [path, readFileSync(path)]));
    const mutations = [
      () => rmSync(once),
      () => rmSync(journal),
      () => appendFileSync(journal, JSON.stringify({ event: 'technical16_http_intent', ordinal: 1 }) + '\n'),
      () => writeFileSync(lock, 'unknown runtime owner\n'),
      () => writeFileSync(oldResult, '{}\n'),
      () => writeFileSync(archive, originals.get(lock)),
      () => {
        for (const path of originals.keys()) rmSync(path);
      },
    ];
    for (const mutate of mutations) {
      mutate();
      const child = spawnSync(process.execPath, [f.cliPath, 'CleanupTechnical16'], {
        env: env(),
        encoding: 'utf8',
        input: 'SYNTHETIC_PRIVATE_MUST_NOT_BE_READ',
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(child.status, 1);
      assert.equal(child.stderr, '');
      const result = JSON.parse(child.stdout);
      assert.equal(result.status, 'technical16_cleanup_public_blocked');
      assert.equal(result.privateRead, false);
      assert.equal(result.networkRequests, 0);
      assert.doesNotMatch(child.stdout, /SYNTHETIC_PRIVATE/);
      assert.equal(existsSync(join(output, 'technical16-native-cleanup-attempt3.json')), false);
      for (const [path, bytes] of originals) writeFileSync(path, bytes);
      for (const path of [oldResult, archive]) if (existsSync(path)) rmSync(path);
    }
    for (const [path, bytes] of originals) assert.deepEqual(readFileSync(path), bytes);
    assert.equal(f.calls.length, 0);
  } finally {
    f.close();
  }
  await assert.rejects(
    technical16CleanupFixture({ cleanupEntryRetry: true, liveFailedProcess: true }),
    /FOUNDATION_CHILD_BLOCKED/,
  );
});

test('technical16 cleanup fixtures use tracked proof inputs when all real ignored output reads are forbidden', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-technical16-fixture-portability-'));
  try {
    const guard = join(root, 'deny-real-output.mjs'),
      ignored = ['scripts/n8n/out', 'scripts/db/out'].map((path) =>
        resolve(path).replaceAll('\\', '/').toLowerCase(),
      );
    writeFileSync(
      guard,
      `import fs from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {syncBuiltinESMExports} from 'node:module';
const original=fs.readFileSync,roots=${JSON.stringify(ignored)};
fs.readFileSync=function(path,...args){if(typeof path!=='number'){const p=resolve(path instanceof URL?fileURLToPath(path):String(path)).replaceAll('\\\\','/').toLowerCase();if(roots.some(root=>p===root||p.startsWith(root+'/')))throw Error('SYNTHETIC_REAL_IGNORED_OUTPUT_READ_BLOCKED');}return original.call(this,path,...args);};syncBuiltinESMExports();`,
    );
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(guard).href,
        '--test',
        '--test-name-pattern',
        'retains both failed claims|genuine public context',
        'scripts/n8n/foundation-handoff.test.mjs',
      ],
      { env: env(), encoding: 'utf8', timeout: 120000, windowsHide: true },
    );
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.doesNotMatch(child.stdout + child.stderr, /SYNTHETIC_REAL_IGNORED_OUTPUT_READ_BLOCKED/);
    assert.match(child.stdout, /genuine public context/);
    if (process.platform === 'win32') assert.match(child.stdout, /retains both failed claims/);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-technical16-fixture-portability-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('technical16 qualification-only identifies exact duplicate provenance with four reads and no cleanup authority', async () => {
  for (const variant of ['known', 'unknown_child', 'different_call']) {
    const f = await technical16CleanupFixture();
    try {
      const tasks = Object.values(f.snapshots.get('31130').data.resultData.runData).flat();
      const task = tasks.find((row) => row.metadata?.subExecution);
      if (variant === 'different_call') {
        Object.values(f.snapshots.get('31130').data.resultData.runData)
          .find((runs) => runs.includes(task))
          .push(structuredClone(task));
      } else {
        task.data.main[0][0].metadata = {
          subExecution: {
            ...structuredClone(task.metadata.subExecution),
            ...(variant === 'unknown_child' ? { executionId: '99999' } : {}),
          },
        };
      }
      const code =
        variant === 'known' ? 'CLEANUP_KNOWN_CHILD_PROVENANCE_DUPLICATE' : 'CLEANUP_UNKNOWN_CHILD_TREE';
      await assert.rejects(
        f.reader.qualifyTechnical16Cleanup({ context: f.context, qualificationOnly: true }),
        new RegExp('^Error: FOUNDATION_NATIVE_' + code + '$'),
      );
      assert.equal(f.reader.lastFailure().code, code);
      assert.doesNotMatch(JSON.stringify(f.reader.lastFailure()), /99999/);
      assert.equal(f.calls.length, 4);
      assert.equal(f.calls.filter((row) => row.method === 'DELETE').length, 0);
      assert.equal(f.events.length, 0);
    } finally {
      f.close();
    }
  }
});

test('technical16 qualification-only reports independent fixed parent and prefix predicates without scanning or deleting', async () => {
  for (const badParent of [false, true]) {
    const f = await technical16CleanupFixture();
    try {
      if (badParent) f.snapshots.get('31131').data.parentExecution.executionId = '99999';
      await assert.rejects(
        f.reader.qualifyTechnical16Cleanup({ context: f.context, qualificationOnly: true }),
        badParent
          ? /^Error: FOUNDATION_NATIVE_CLEANUP_CHILD_PARENT$/
          : /^Error: FOUNDATION_NATIVE_CLEANUP_PREFIX_CHECKED$/,
      );
      assert.equal(f.calls.length, 4);
      assert.equal(f.calls.filter((row) => row.method === 'DELETE').length, 0);
      assert.equal(f.events.length, 0);
    } finally {
      f.close();
    }
  }
});

test(
  'technical16 actual cleanup ENTRY diagnosis is bounded to four GETs and fixed codes without DELETE or qualification branding',
  { skip: process.platform !== 'win32' },
  async () => {
    const f = await technical16CleanupFixture();
    try {
      const task = Object.values(f.snapshots.get('31130').data.resultData.runData)
        .flat()
        .find((row) => row.metadata?.subExecution);
      task.data.main[0][0].metadata = { subExecution: structuredClone(task.metadata.subExecution) };
      const child = runTechnical16CleanupEntry(f, { qualificationOnly: true });
      assert.equal(child.nativeExit, 1);
      assert.equal(child.stderr, '');
      assert.equal(child.parentLockAbsent, true);
      const result = JSON.parse(child.stdout);
      assert.equal(result.status, 'cleanup_reconciliation_required');
      assert.equal(result.diagnosticCode, 'native_CLEANUP_KNOWN_CHILD_PROVENANCE_DUPLICATE');
      assert.equal(result.requestCount, 4);
      assert.equal(result.managementAttempts, 837);
      assert.equal(result.controlAttempts, 968);
      assert.equal(result.combinedAttempts, 1805);
      assert.equal(result.qualifiedSideEffects, false);
      assert.equal(result.recordsDeleted, 0);
      assert.equal(result.remoteWorkSettled, false);
      assert.equal(result.networkCompletionVerified, true);
      assert.equal(result.originalPublicRecordsUnchanged, true);
      const output = join(f.root, 'scripts/n8n/out/foundation/');
      const once = JSON.parse(readFileSync(join(output, 'technical16-native-cleanup-attempt3.json'), 'utf8'));
      assert.equal(once.cleanupAttempt, 3);
      assert.equal(once.maximumRequests, 4);
      assert.equal(once.qualificationOnly, true);
      const journal = readFileSync(join(output, 'technical16-native-cleanup-attempt3.jsonl'), 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse);
      assert.equal(journal.filter((row) => row.event === 'technical16_http_intent').length, 4);
      assert.equal(journal.filter((row) => row.event === 'native_cleanup_intent').length, 0);
      const calls = readFileSync(join(f.root, 'technical16-entry-calls.jsonl'), 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse);
      assert.equal(calls.length, 4);
      assert.equal(
        calls.every((row) => row.method === 'GET'),
        true,
      );
    } finally {
      f.close();
    }
  },
);

test('credential-free CheckOnly never reads stdin or invokes network; source stays distinct from GW-01', () => {
  const r = spawnSync(process.execPath, ['scripts/n8n/foundation-provision-cli.mjs', 'CheckOnly'], {
    encoding: 'utf8',
    env: env(),
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  const p = JSON.parse(r.stdout);
  assert.equal(p.privateRead, false);
  assert.equal(p.networkRequests, 0);
  assert.equal(p.maximumCreates, 25);
  assert.equal(p.finalBindingReady, existsSync('scripts/n8n/foundation-delivery-packet.json'));
  assert.equal(p.windowId, 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
});

test('technical13 restore CheckOnly is a separate public no-credential/no-network contract', () => {
  const r = spawnSync(
    process.execPath,
    ['scripts/n8n/foundation-provision-cli.mjs', 'RestoreTechnical13CheckOnly'],
    {
      encoding: 'utf8',
      env: env(),
      timeout: 10000,
      windowsHide: true,
      input: 'SYNTHETIC_PRIVATE_MUST_NOT_BE_READ',
    },
  );
  assert.equal(r.stderr, '');
  const result = JSON.parse(r.stdout);
  assert.equal(result.kind, 'm03_technical13_restoration_public');
  assert.equal(result.privateRead, false);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.maximumRequests, 40);
  assert.equal(result.maximumControlRequests, 50);
  assert.equal(result.executionCount, 0);
  assert.equal(result.actorStarts, 0);
  assert.doesNotMatch(r.stdout, /SYNTHETIC_PRIVATE/);
});

test('technical16 cleanup selectors refuse unresolved executed-body qualification before private input', async () => {
  const fixture = await technical16CleanupFixture({ unresolved: true });
  try {
    for (const mode of ['CleanupTechnical16CheckOnly', 'CleanupTechnical16']) {
      const result = spawnSync(process.execPath, [fixture.cliPath, mode], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
        input: 'SYNTHETIC_PRIVATE_MUST_NOT_BE_READ',
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), {
        kind: 'm03_technical16_cleanup_public',
        version: 1,
        status: 'technical16_cleanup_public_blocked',
        windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
        privateRead: false,
        networkRequests: 0,
        maximumRequests: 154,
        maximumControlRequests: 154,
        canonicalWorkflowCount: 25,
        maximumDrainRequests: 100,
        maximumNativeRecords: 2,
        executionCount: 0,
        actorStarts: 0,
        qualifiedSideEffects: false,
        cleanupQualificationReady: false,
      });
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    }
  } finally {
    fixture.close();
  }
});

test('technical16 cleanup scope keeps exact child-first targets and public resolution is not caller-overridable', async () => {
  const fixture = await technical16CleanupFixture({ unresolved: true });
  try {
    const { foundationTechnical16CleanupScope, checkTechnical16Cleanup } = fixture.cli;
    assert.ok(Object.isFrozen(foundationTechnical16CleanupScope));
    assert.ok(Object.isFrozen(foundationTechnical16CleanupScope.executionIds));
    assert.deepEqual(foundationTechnical16CleanupScope.executionIds, ['31131', '31130']);
    assert.equal(
      foundationTechnical16CleanupScope.sourceCommitSha,
      '5087d4d93d2f6ffdca0bc0096b365723005446fc',
    );
    assert.equal(foundationTechnical16CleanupScope.maximumRequests, 154);
    assert.equal(foundationTechnical16CleanupScope.maximumControlRequests, 154);
    await assert.rejects(
      () => checkTechnical16Cleanup({ resolutionPin: 'a'.repeat(64), qualifiedSideEffects: true }),
      { message: 'FOUNDATION_CHILD_BLOCKED' },
    );
  } finally {
    fixture.close();
  }
});

test('technical16 genuine public context composes fresh native qualification and child-first cleanup without live acceptance brands', async () => {
  const f = await technical16CleanupFixture();
  try {
    const qualification = await f.reader.qualifyTechnical16Cleanup({ context: f.context });
    assert.equal(
      f.readerModule.assertFoundationTechnical16CleanupQualification(qualification, { reader: f.reader }),
      qualification,
    );
    assert.equal(qualification.canonicalWorkflowsVerified, 25);
    assert.equal(qualification.inventoryComplete, true);
    assert.equal(qualification.acceptanceProven, false);
    assert.equal(qualification.liveClosureMinted, false);
    assert.throws(
      () => f.readerModule.assertFoundationNativeReceipt(qualification.records[0]),
      /FOUNDATION_NATIVE_RECEIPT_BRAND/,
    );
    const result = await f.cleanup.cleanupTechnical16({ qualification });
    assert.equal(result.status, 'native_records_deleted');
    assert.equal(result.nativeAcceptanceProven, false);
    assert.equal(result.liveClosureMinted, false);
    assert.deepEqual(
      f.calls.filter((call) => call.method === 'DELETE').map((call) => call.path),
      ['/api/v1/executions/31131', '/api/v1/executions/31130'],
    );
    assert.deepEqual(
      f.events
        .filter((row) => row.event === 'native_cleanup_result')
        .map((row) => [row.executionId, row.deleteAcknowledged, row.absenceVerified, row.residual]),
      [
        ['31131', true, true, false],
        ['31130', true, true, false],
      ],
    );
    assert.equal(f.calls.length, 85);
    assert.deepEqual(f.budget.state(), {
      requestCount: 85,
      controlRequestCount: 85,
      managementAttempts: 918,
      controlAttempts: 1049,
      combinedAttempts: 1967,
    });
    assert.equal(f.charges.length, 85);
    await assert.rejects(
      f.cleanup.cleanupTechnical16({ qualification }),
      /FOUNDATION_NATIVE_CLEANUP_BLOCKED/,
    );
    assert.equal(f.calls.filter((call) => call.method === 'DELETE').length, 2);
    // These are conservative durable admissions only, not additional HTTP.
    // Two diagnostics and the failed four-read attempt remain charged against160.
    while (f.budget.state().requestCount < 154)
      f.budget.admit({ kind: 'workflow', workflowId: f.source.baseline[0].id });
    assert.throws(
      () => f.budget.admit({ kind: 'workflow', workflowId: f.source.baseline[0].id }),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.deepEqual(f.budget.state(), {
      requestCount: 154,
      controlRequestCount: 154,
      managementAttempts: 987,
      controlAttempts: 1118,
      combinedAttempts: 2105,
    });
    assert.equal(f.calls.length, 85);
  } finally {
    f.close();
  }
});

test('technical16 genuine qualifier rejects changed source, parent links, unexplained records and canonical drift before any DELETE', async () => {
  const variants = [
    (f) => {
      f.snapshots.get('31130').workflowData.nodes[0].parameters.syntheticUnknown = true;
    },
    (f) => {
      delete f.snapshots.get('31131').data.parentExecution;
    },
    (f) => {
      f.setExtraCandidate({ ...f.metadata.get('31130'), id: '31132', status: 'waiting', stoppedAt: null });
    },
    (f) => {
      f.workflows.values().next().value.versionId = 'unrecognized-new-work';
    },
  ];
  for (const mutate of variants) {
    const f = await technical16CleanupFixture();
    try {
      mutate(f);
      await assert.rejects(f.reader.qualifyTechnical16Cleanup({ context: f.context }), /FOUNDATION_NATIVE_/);
      assert.equal(
        f.calls.some((call) => call.method !== 'GET'),
        false,
      );
      assert.equal(f.events.length, 0);
    } finally {
      f.close();
    }
  }
});

test('technical16 lost child DELETE acknowledgement remains ambiguous and cannot start the root DELETE or replay', async () => {
  const f = await technical16CleanupFixture();
  try {
    const qualification = await f.reader.qualifyTechnical16Cleanup({ context: f.context });
    f.setLostAck();
    const result = await f.cleanup.cleanupTechnical16({ qualification });
    assert.equal(result.status, 'cleanup_reconciliation_required');
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].state, 'cleanup_ambiguous');
    assert.equal(result.results[0].deleteAcknowledged, false);
    assert.equal(result.results[0].absenceVerified, true);
    assert.deepEqual(
      f.calls.filter((call) => call.method === 'DELETE').map((call) => call.path),
      ['/api/v1/executions/31131'],
    );
    await assert.rejects(
      f.cleanup.cleanupTechnical16({ qualification }),
      /FOUNDATION_NATIVE_CLEANUP_BLOCKED/,
    );
    assert.equal(f.calls.filter((call) => call.method === 'DELETE').length, 1);
  } finally {
    f.close();
  }
});

test('technical16 genuine qualification preserves binary pins and the35second pre-DELETE shutdown reserve', async () => {
  const short = await technical16CleanupFixture({ remainingMs: 34000 });
  try {
    const qualification = await short.reader.qualifyTechnical16Cleanup({ context: short.context });
    const residual = await short.cleanup.cleanupTechnical16({ qualification });
    assert.equal(residual.status, 'cleanup_reconciliation_required');
    assert.deepEqual(residual.results, []);
    assert.equal(
      short.calls.some((call) => call.method === 'DELETE'),
      false,
    );
    assert.equal(short.events.length, 0);
    short.setAdvanceAfterReads(2);
    assert.throws(
      () => short.readerModule.assertFoundationTechnical16CleanupQualification(qualification),
      /FOUNDATION_NATIVE_CLEANUP_QUALIFICATION/,
    );
  } finally {
    short.close();
  }
  const drift = await technical16CleanupFixture();
  try {
    const qualification = await drift.reader.qualifyTechnical16Cleanup({ context: drift.context });
    const original = JSON.parse(
      readFileSync(
        join(
          drift.root,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json',
        ),
      ),
    );
    const png = Object.keys(original.pins).find((path) => path.endsWith('.png'));
    appendFileSync(join(drift.root, png), Buffer.from([0]));
    await assert.rejects(
      drift.cleanup.cleanupTechnical16({ qualification }),
      /FOUNDATION_NATIVE_CLEANUP_BLOCKED/,
    );
    assert.equal(
      drift.calls.some((call) => call.method === 'DELETE'),
      false,
    );
  } finally {
    drift.close();
  }
});

test('technical16 durable admission cannot send a new DELETE after qualification freshness expires', async () => {
  const f = await technical16CleanupFixture();
  try {
    const qualification = await f.reader.qualifyTechnical16Cleanup({ context: f.context });
    f.setAdvanceDelete();
    const result = await f.cleanup.cleanupTechnical16({ qualification });
    assert.equal(result.status, 'cleanup_reconciliation_required');
    assert.equal(
      f.calls.some((call) => call.method === 'DELETE'),
      false,
    );
    assert.equal(f.events.filter((row) => row.event === 'native_cleanup_intent').length, 1);
    await assert.rejects(
      f.cleanup.cleanupTechnical16({ qualification }),
      /FOUNDATION_NATIVE_CLEANUP_BLOCKED/,
    );
  } finally {
    f.close();
  }
});

test(
  'technical16 native result and exact-case mode guards reject coerced or incomplete cleanup claims before acceptance',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const modeGuard = source.split(/\r?\n/).find((line) => line.includes('if($Mode -cnotin @('));
    assert.ok(modeGuard);
    const branch = source.slice(
      source.indexOf("if($Mode -ceq 'CleanupTechnical16'){"),
      source.indexOf('\nif($CheckOnly){'),
    );
    assert.match(branch, /WaitForExit\(310000\)/);
    assert.match(branch, /UtcNow\.AddMinutes\(5\)/);
    assert.doesNotMatch(branch, /machineSource|Kind Admin|Kind Writer|Kind Machine/);
    const start = branch.indexOf("  $receipt.diagnosticStage='result_contract'"),
      end = branch.indexOf(' }catch{', start);
    assert.ok(start >= 0 && end > start);
    const guard = branch.slice(start, end);
    const keys = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').match(
      /function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(keys);
    const valid = {
      kind: 'm03_technical16_native_cleanup',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
      sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
      status: 'native_cleanup_verified',
      requestCount: 85,
      controlRequestCount: 85,
      managementAttempts: 918,
      controlAttempts: 1049,
      combinedAttempts: 1967,
      canonicalWorkflowsVerified: 25,
      qualifiedSideEffects: true,
      recordsDeleted: 2,
      deleteAcknowledged: true,
      absenceVerified: true,
      remoteWorkSettled: true,
      networkCompletionVerified: true,
      originalPublicRecordsUnchanged: true,
      nativeAcceptanceProven: false,
      originalMaskedFirstFailureRecovered: false,
      executionCount: 0,
      actorStarts: 0,
      workflowWrites: 0,
      credentialWrites: 0,
      migrationOperations: 0,
      diagnosticStage: 'complete',
      diagnosticCode: 'none',
    };
    const cases = [
      valid,
      ...[
        { requestCount: '85' },
        { combinedAttempts: 1968 },
        { nativeAcceptanceProven: true },
        { recordsDeleted: 1 },
        { qualifiedSideEffects: false },
        { networkCompletionVerified: false },
        { canonicalWorkflowsVerified: 2 },
        {
          requestCount: 161,
          controlRequestCount: 161,
          managementAttempts: 990,
          controlAttempts: 1121,
          combinedAttempts: 2111,
        },
      ].map((change) => ({ ...valid, ...change })),
    ];
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical16-result-guard-'));
    try {
      const file = join(directory, 'guard.ps1');
      writeFileSync(
        file,
        "Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$QualificationOnly=$false;\n" +
          keys +
          "\n$expected=ConvertFrom-Json -InputObject '" +
          JSON.stringify(valid).replaceAll("'", "''") +
          "';$cases=ConvertFrom-Json -InputObject '" +
          JSON.stringify(cases).replaceAll("'", "''") +
          "';$out=@();foreach($result in $cases){$receipt=[ordered]@{};foreach($p in $expected.PSObject.Properties){$receipt[$p.Name]=$p.Value};$receipt.nativeExit=0;$exitCode=1;try{\n" +
          guard +
          "\nif($exitCode -ne 0){throw 'blocked'};$out+='accepted'}catch{$out+='rejected'}};$modeOut=@();foreach($Mode in @('CleanupTechnical16','cleanuptechnical16','CleanupTechnical16 ')){try{\n" +
          modeGuard +
          "\n$modeOut+='accepted'}catch{$modeOut+='rejected'}};[ordered]@{results=$out;modes=$modeOut}|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: env(),
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), {
        results: ['accepted', ...Array(8).fill('rejected')],
        modes: ['accepted', 'rejected', 'rejected'],
      });
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical16-result-guard-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'technical16 cleanup native public adapter clears inherited secrets and rejects authority or counter coercion',
  { skip: process.platform !== 'win32' },
  async () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    assert.match(source, /ValidateSet\([^\n]*'CleanupTechnical16'/);
    const publicFunction = source.match(/function Invoke-M03Technical13Public[\s\S]*?\n\}/)?.[0];
    const keys = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').match(
      /function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(publicFunction);
    assert.ok(keys);
    const valid = {
      kind: 'm03_technical16_cleanup_public',
      version: 1,
      status: 'technical16_cleanup_public_ready',
      windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
      privateRead: false,
      networkRequests: 0,
      maximumRequests: 154,
      maximumControlRequests: 154,
      canonicalWorkflowCount: 25,
      maximumDrainRequests: 100,
      maximumNativeRecords: 2,
      executionCount: 0,
      actorStarts: 0,
      qualifiedSideEffects: false,
      cleanupQualificationReady: true,
    };
    const fixture = await technical16CleanupFixture({ unresolved: true });
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical16-public-child-'));
    try {
      const variants = [
        valid,
        { ...valid, maximumRequests: '154' },
        { ...valid, qualifiedSideEffects: true },
        { ...valid, canonicalWorkflowCount: 2 },
        { ...valid, cleanupQualificationReady: false },
        { ...valid, extra: true },
      ];
      const paths = variants.map((dto, i) => {
        const path = join(directory, 'fake-' + i + '.cjs');
        writeFileSync(
          path,
          "if(process.argv[2]!=='CleanupTechnical16CheckOnly'||process.env.PGPASSWORD||process.env.UNRELATED_SECRET||process.env.NODE_OPTIONS)throw Error('SYNTHETIC_PRIVATE_ENV');process.stdout.write(" +
            JSON.stringify(JSON.stringify(dto)) +
            ');',
        );
        return path;
      });
      // Exercise the actual public child too: its unresolved pin must refuse
      // before the native wrapper can reach any private credential helper.
      paths.push(fixture.cliPath);
      const file = join(directory, 'native.ps1');
      writeFileSync(
        file,
        "Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';\n" +
          keys +
          '\n' +
          publicFunction +
          "\n$repo='" +
          directory.replaceAll("'", "''") +
          "';$paths=ConvertFrom-Json -InputObject '" +
          JSON.stringify(paths).replaceAll("'", "''") +
          "';$out=@();foreach($path in $paths){try{$null=Invoke-M03Technical13Public '" +
          process.execPath.replaceAll("'", "''") +
          "' $path 'CleanupTechnical16';$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: {
          ...env(),
          PGPASSWORD: 'SYNTHETIC_PRIVATE_PASSWORD',
          UNRELATED_SECRET: 'SYNTHETIC_PRIVATE_OTHER',
          NODE_OPTIONS: '--invalid-inherited-option',
        },
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), [
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
      ]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical16-public-child-'));
      rmSync(directory, { recursive: true, force: true });
      fixture.close();
    }
  },
);

test('technical13 real accounting keeps durable40/50 charges and rejects changed public prefixes', async () => {
  const { createTechnical13RestorationBudget } = await import('./foundation-provision-cli.mjs');
  const { createFoundationControlJournal } = await import('./foundation-control-state.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-accounting-'));
  try {
    const paths = Object.fromEntries(
      ['management', 'control', 'runtime'].map((name) => [name, join(directory, name + '.jsonl')]),
    );
    const pinned = {
      management: '{"event":"file_header"}\n',
      control: '{"event":"file_header"}\n',
      runtime: '{"event":"file_header"}\n',
    };
    for (const name of Object.keys(paths)) writeFileSync(paths[name], pinned[name]);
    const context = {
      managementAttempts: 486,
      controlAttempts: 791,
      pinned,
      plan: { baseline: [{ id: 'owned-workflow' }] },
    };
    const budget = createTechnical13RestorationBudget({
      context,
      deadlineAt: Date.now() + 60000,
      paths,
      appendManagement: (row) => appendFileSync(paths.management, JSON.stringify(row) + '\n'),
      appendControl: (row) => appendFileSync(paths.control, JSON.stringify(row) + '\n'),
    });
    const control = createFoundationControlJournal({
      previousEvents: [{ event: 'file_header' }],
      durableAppend: (row) => {
        budget.appendControl(row);
      },
    });
    assert.throws(
      () => budget.admitControl({ kind: 'full', workflowId: 'owned-workflow' }, (row) => control.append(row)),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.throws(
      () =>
        budget.admitControl({ kind: 'discovery', workflowId: 'unrelated-workflow' }, (row) =>
          control.append(row),
        ),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.equal(budget.state().controlRequestCount, 0);
    for (let i = 0; i < 40; i++) budget.admitManagement();
    assert.throws(() => budget.admitManagement(), /FOUNDATION_CHILD_BLOCKED/);
    for (let i = 0; i < 50; i++)
      budget.admitControl({ kind: 'discovery', workflowId: 'owned-workflow' }, (row) => control.append(row));
    assert.throws(
      () =>
        budget.admitControl({ kind: 'discovery', workflowId: 'owned-workflow' }, (row) =>
          control.append(row),
        ),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.deepEqual(budget.state(), {
      requestCount: 40,
      controlRequestCount: 50,
      managementAttempts: 526,
      controlAttempts: 841,
      combinedAttempts: 1367,
    });
    const management = readFileSync(paths.management, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const controls = readFileSync(paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    assert.equal(management.length, 41);
    assert.equal(management[1].ordinal, 476);
    assert.equal(management.at(-1).ordinal, 515);
    assert.equal(controls.length, 51);
    assert.equal(controls[1].ordinal, 789);
    assert.equal(controls.at(-1).ordinal, 838);
    budget.assertCurrent();
    assert.equal(readFileSync(paths.runtime, 'utf8'), pinned.runtime);
    appendFileSync(paths.management, '{"event":"unexpected_external_append"}\n');
    assert.throws(() => budget.assertCurrent(), /FOUNDATION_CHILD_BLOCKED/);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('emr-technical13-accounting-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('technical13 uncertain durable append stays charged and blocks another request', async () => {
  const { createTechnical13RestorationBudget } = await import('./foundation-provision-cli.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-uncertain-'));
  try {
    const paths = Object.fromEntries(
      ['management', 'control', 'runtime'].map((name) => [name, join(directory, name + '.jsonl')]),
    );
    const pinned = Object.fromEntries(Object.keys(paths).map((name) => [name, '{"event":"file_header"}\n']));
    for (const name of Object.keys(paths)) writeFileSync(paths[name], pinned[name]);
    const context = {
      managementAttempts: 486,
      controlAttempts: 791,
      pinned,
      plan: { baseline: [{ id: 'owned-workflow' }] },
    };
    const budget = createTechnical13RestorationBudget({
      context,
      deadlineAt: Date.now() + 60000,
      paths,
      appendManagement(row) {
        appendFileSync(paths.management, JSON.stringify(row) + '\n');
        throw Error('SYNTHETIC_PRIVATE_APPEND_ERROR');
      },
      appendControl() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
    });
    assert.throws(() => budget.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(budget.state().managementAttempts, 487);
    assert.equal(budget.state().requestCount, 1);
    assert.throws(() => budget.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(readFileSync(paths.management, 'utf8').trimEnd().split('\n').length, 2);
    assert.equal(budget.state().managementAttempts, 487);
    const expired = createTechnical13RestorationBudget({
      context: { ...context, pinned: { ...pinned, management: readFileSync(paths.management, 'utf8') } },
      deadlineAt: Date.now() - 1,
      paths,
      appendManagement() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
      appendControl() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
    });
    assert.throws(() => expired.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(expired.state().requestCount, 0);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('emr-technical13-uncertain-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'actual technical13 PowerShell result guard rejects coerced counters and incomplete cleanup',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const start = source.indexOf(
      "if($Mode -ceq 'RestoreTechnical13'){",
      source.indexOf("if($Mode -ceq 'ProtectWf00Backup')"),
    );
    assert.ok(start > 0);
    const branch = source.slice(start, source.indexOf("if($Mode -ceq 'RestoreWF00'){", start));
    const initial = branch.split(/\r?\n/).find((line) => line.startsWith(' $receipt=[ordered]@'));
    const guard = branch.slice(branch.indexOf("  $keys=@('kind'"), branch.indexOf(' }catch'));
    const keysFunction = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
    const match = keysFunction.match(/function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/);
    assert.ok(initial);
    assert.ok(guard.includes('restoration_verified'));
    assert.ok(match);
    const valid = {
      kind: 'm03_technical13_runtime_restoration',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
      status: 'restoration_verified',
      requestCount: 38,
      controlRequestCount: 50,
      managementAttempts: 524,
      controlAttempts: 841,
      combinedAttempts: 1365,
      baselineRestored: true,
      machineRestored: true,
      remoteWorkSettled: true,
      executionCount: 0,
      actorStarts: 0,
      originalAckUnknown: true,
      mutationReplayAllowed: false,
      oldRuntimeUnchanged: true,
      networkCompletionVerified: true,
    };
    const changes = [
      { managementAttempts: '524' },
      { controlAttempts: '841' },
      { combinedAttempts: '1365' },
      { requestCount: '38' },
      { controlRequestCount: 49, controlAttempts: 840, combinedAttempts: 1364 },
      { remoteWorkSettled: false },
      { machineRestored: false },
      { networkCompletionVerified: false },
      { oldRuntimeUnchanged: false },
      { mutationReplayAllowed: true },
      { originalAckUnknown: false },
      { executionCount: 1 },
      { actorStarts: 1 },
      { unexpected: 'SYNTHETIC_PRIVATE_FIELD' },
    ];
    const cases = [valid, ...changes.map((change) => ({ ...valid, ...change }))];
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-native-guard-'));
    try {
      const file = join(directory, 'guard.ps1');
      writeFileSync(
        file,
        match[0] +
          "\n$cases=ConvertFrom-Json -InputObject '" +
          JSON.stringify(cases).replaceAll("'", "''") +
          "';$out=@();foreach($result in $cases){try{" +
          initial +
          ';$receipt.nativeExit=0;$exitCode=1;' +
          guard +
          ";if($exitCode -ne 0){throw 'blocked'};$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), ['accepted', ...changes.map(() => 'rejected')]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE_FIELD/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-native-guard-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'technical13 native public child filters inherited credentials and bounds fixed stdout/stderr',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const publicFunction = source.match(/function Invoke-M03Technical13Public[\s\S]*?\n\}/)?.[0];
    const keys = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').match(
      /function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(publicFunction);
    assert.ok(keys);
    const valid = {
      kind: 'm03_technical13_restoration_public',
      version: 1,
      status: 'technical13_restore_public_ready',
      windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      privateRead: false,
      networkRequests: 0,
      maximumRequests: 40,
      maximumControlRequests: 50,
      executionCount: 0,
      actorStarts: 0,
    };
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-public-child-'));
    try {
      const modes = [{ ...valid }, { ...valid, networkRequests: '0' }, 'stderr', 'overflow', 'nonzero'];
      const paths = modes.map((mode, index) => {
        const path = join(directory, 'fake-' + index + '.cjs');
        const body =
          mode === 'stderr'
            ? "process.stderr.write('SYNTHETIC_PRIVATE_ERROR');"
            : mode === 'overflow'
              ? "process.stdout.write('X'.repeat(8192));"
              : mode === 'nonzero'
                ? 'process.exitCode=1;'
                : "if(process.env.PGPASSWORD||process.env.UNRELATED_SECRET||process.env.NODE_OPTIONS)throw Error('SYNTHETIC_PRIVATE_ENV');process.stdout.write(" +
                  JSON.stringify(JSON.stringify(mode)) +
                  ');';
        writeFileSync(path, body);
        return path;
      });
      const file = join(directory, 'native-public.ps1');
      writeFileSync(
        file,
        "Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';\n" +
          keys +
          '\n' +
          publicFunction +
          "\n$repo='" +
          directory.replaceAll("'", "''") +
          "';$paths=ConvertFrom-Json -InputObject '" +
          JSON.stringify(paths).replaceAll("'", "''") +
          "';$out=@();foreach($path in $paths){try{$result=Invoke-M03Technical13Public '" +
          process.execPath.replaceAll("'", "''") +
          "' $path;$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: {
          ...env(),
          PGPASSWORD: 'SYNTHETIC_PRIVATE_PASSWORD',
          UNRELATED_SECRET: 'SYNTHETIC_PRIVATE_OTHER',
          NODE_OPTIONS: '--invalid-inherited-option',
        },
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), [
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
      ]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-public-child-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('technical13 restoration composes the real adoption and restore ports without replaying the unknown settings PUT', async () => {
  const { fixture } = await import('./foundation-live-runtime-fixtures.mjs');
  const { createFoundationRuntimePlan } = await import('./foundation-runtime-plan.mjs');
  const runtime = await import('./foundation-runtime-control.mjs');
  const { prepareFoundationRuntimeMachinePatch } = await import('./foundation-runtime-machine.mjs');
  const { restoreTechnical13WithPorts } = await import('./foundation-provision-cli.mjs');
  const f = fixture();
  try {
    const plan = createFoundationRuntimePlan({
      ...f.input,
      activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
    });
    const source = runtime.createFoundationRuntimeJournal(plan, [], () => {});
    let lost = false,
      freshCalls = 0;
    const observedCalls = [];
    const send = async (method, path, body) => {
      observedCalls.push({ method, path, body: structuredClone(body) });
      const before = f.workflows.get('tiEhU3dXrMifOnTL')?.versionId;
      const response = await f.dependencies.send(method, path, body);
      if (
        !lost &&
        method === 'PUT' &&
        path.includes('/tiEhU3dXrMifOnTL?') &&
        body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv'
      ) {
        lost = true;
        f.workflows.get('tiEhU3dXrMifOnTL').versionId = before;
        throw Error('SYNTHETIC_PRIVATE_UNKNOWN_ACK');
      }
      return response;
    };
    const prepareMachinePatch = ({ audience, restore }) =>
      prepareFoundationRuntimeMachinePatch({
        audience,
        restore,
        machineToken: f.input.machineToken,
        ...(restore ? {} : { protectionBypass: f.input.protectionBypass }),
      });
    assert.equal(
      (
        await runtime.runFoundationRuntimeSetup(plan, {
          journal: source,
          send,
          prepareMachinePatch,
          admitManagementAttempt() {},
        })
      ).status,
      'reconciliation_required',
    );
    const old = source.rows
      .filter((row) => row.event !== 'request' || row.number > 25)
      .map((row) => {
        const copy = structuredClone(row);
        if (copy.event === 'request') copy.number -= 25;
        if (copy.event === 'intent' && copy.sequence === 7) copy.target.versionId = null;
        return copy;
      });
    const untouched = JSON.stringify(old),
      fresh = [];
    const journal = runtime.createFoundationRuntimeJournal(plan, old, (row) => {
      fresh.push(row);
    });
    assert.equal(lost, true);
    assert.equal(runtime.foundationRuntimeState(plan, journal).requestCount, 22);
    assert.equal(runtime.foundationRuntimeState(plan, journal).pending.sequence, 7);
    const start = observedCalls.length;
    const result = await restoreTechnical13WithPorts(plan, {
      journal,
      send,
      prepareMachinePatch,
      admitManagementAttempt() {
        if (++freshCalls > 40) throw Error('SYNTHETIC_LIMIT');
      },
    });
    assert.equal(result.adoption.originalAcknowledgementVerified, false);
    assert.equal(result.adoption.mutationReplayAllowed, false);
    assert.equal(result.adoption.requestCount, 23);
    assert.equal(result.adoption.status, 'settings_save_readback_verified_original_ack_unknown');
    assert.equal(result.restoration.status, 'exact_staging_restored_unpublished');
    assert.equal(freshCalls, 38);
    assert.equal(JSON.stringify(old), untouched);
    assert.equal(fresh[0].event, 'request');
    assert.equal(fresh[0].number, 23);
    const calls = observedCalls.slice(start);
    assert.equal(calls.filter((c) => c.method === 'PUT').length, 2);
    assert.equal(calls.filter((c) => c.method === 'PATCH').length, 1);
    assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
    assert.equal(
      calls.some((c) => /\/publish$/.test(c.path)),
      false,
    );
    assert.equal(
      calls.filter((c) => c.method === 'PUT' && c.body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv').length,
      0,
    );
    assert.equal(runtime.foundationRuntimeState(plan, journal).machineRebound, false);
  } finally {
    f.cleanup();
  }
});
test(
  'actual technical13 credential loop distinguishes ACL, framing and successful synthetic decryption',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const start = source.indexOf('  foreach($privateFile in @($source,$machineSource)){');
    const end = source.indexOf("  $receipt.diagnosticStage='child_configuration'", start);
    assert.ok(start > 0);
    assert.ok(end > start);
    const loop = source.slice(start, end);
    assert.equal(loop.includes('Set-M03DevPrivateAcl'), false, 'retained stores are not silently adopted');
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-credential-stage-'));
    try {
      const file = join(directory, 'stage.ps1');
      const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
      writeFileSync(
        file,
        "$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;. " +
          literal(resolve('scripts/n8n/windows/Dev-CredentialStore.ps1')) +
          ';$root=' +
          literal(directory) +
          ";$mgmt=Join-Path $root 'management';$legacy=Join-Path $root 'legacy-machine';[IO.Directory]::CreateDirectory($mgmt)|Out-Null;[IO.Directory]::CreateDirectory($legacy)|Out-Null;Set-M03DevPrivateAcl $mgmt $true;$source=Join-Path $mgmt 'management.dpapi';$machineSource=Join-Path $legacy 'machine.dpapi';$s=ConvertTo-SecureString 'SYNTHETIC_PRIVATE_ONLY' -AsPlainText -Force;try{$native=ConvertFrom-SecureString $s}finally{$s.Dispose()};[IO.File]::WriteAllText($source,$native,[Text.Encoding]::ASCII);Set-M03DevPrivateAcl $source $false;[IO.File]::WriteAllText($machineSource,'SYNTHETIC_PRIVATE_NOT_DPAPI',[Text.Encoding]::ASCII);$out=@();foreach($mode in @('directory_acl','file_acl','framing','success')){if($mode -ceq 'file_acl'){Set-M03DevPrivateAcl $legacy $true};if($mode -ceq 'framing'){Set-M03DevPrivateAcl $machineSource $false};if($mode -ceq 'success'){[IO.File]::WriteAllText($machineSource,$native,[Text.Encoding]::ASCII)};$receipt=[ordered]@{privateRead=$false;diagnosticStage='not_attempted';diagnosticCode='not_attempted'};$key=$null;$machine=$null;$secret=$null;$cipher=$null;$bstr=[IntPtr]::Zero;try{\n" +
          loop +
          "\n$receipt.diagnosticCode='none'}catch{$receipt.diagnosticCode='local_boundary_blocked'}finally{if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $cipher){[Array]::Clear($cipher,0,$cipher.Length)};$key=$null;$machine=$null;$value=$null};$out+=[pscustomobject]$receipt};$native=$null;$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), [
        {
          privateRead: true,
          diagnosticStage: 'machine_directory_acl',
          diagnosticCode: 'local_boundary_blocked',
        },
        { privateRead: true, diagnosticStage: 'machine_file_acl', diagnosticCode: 'local_boundary_blocked' },
        { privateRead: true, diagnosticStage: 'machine_framing', diagnosticCode: 'local_boundary_blocked' },
        { privateRead: true, diagnosticStage: 'machine_plaintext', diagnosticCode: 'none' },
      ]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-credential-stage-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('isolated All without a public delivery packet blocks before stdin/private read on every platform', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-absent-packet-test-'));
  try {
    const list = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
    const relatives = [...list.matchAll(/^  '([^']+)'/gm)].map((x) => x[1]);
    assert.equal(relatives.length, 93);
    assert.equal(new Set(relatives).size, 93);
    const seen = new Set(),
      pending = ['scripts/n8n/foundation-provision-cli.mjs'];
    while (pending.length) {
      const relative = pending.shift();
      if (seen.has(relative)) continue;
      seen.add(relative);
      assert.ok(relatives.includes(relative), 'seal must cover actual import ' + relative);
      for (const match of readFileSync(relative, 'utf8').matchAll(
        /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g,
      )) {
        if (!match[1].startsWith('.')) continue;
        let target = resolve(dirname(relative), match[1]);
        if (!existsSync(target) && existsSync(target + '.ts')) target += '.ts';
        assert.ok(existsSync(target));
        const imported = target.slice(resolve('.').length + 1).replaceAll('\\', '/');
        if (!seen.has(imported)) pending.push(imported);
      }
    }
    const bindings = JSON.parse(readFileSync('n8n/foundation/bindings.dev.json', 'utf8'));
    assert.equal(Object.keys(bindings.workflowRefs).length, 25);
    for (const key of Object.keys(bindings.workflowRefs))
      assert.ok(relatives.includes('n8n/workflows/' + key + '.json'));
    for (const relative of [
      'n8n/foundation/transport.dev.json',
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
      'milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json',
    ])
      assert.ok(relatives.includes(relative));
    for (const relative of relatives) {
      const target = join(root, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(relative));
    }
    const physical = join(root, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
    mkdirSync(dirname(physical), { recursive: true });
    cpSync(resolve('node_modules/.pnpm/zod@4.6.7/node_modules/zod'), physical, { recursive: true });
    const shared = join(root, 'packages/shared/node_modules');
    mkdirSync(shared, { recursive: true });
    symlinkSync(physical, join(shared, 'zod'), process.platform === 'win32' ? 'junction' : 'dir');
    const r = spawnSync(process.execPath, [join(root, 'scripts/n8n/foundation-provision-cli.mjs'), 'All'], {
      encoding: 'utf8',
      env: env(),
      cwd: root,
      input: 'PUBLIC_SYNTHETIC_NEVER_READ',
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '');
    const p = JSON.parse(r.stdout);
    assert.equal(p.privateReadAttempted, false);
    assert.equal(p.completionVerified, false);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-foundation-absent-packet-test-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('handoff and bounded consumer use only distinct purpose/paths; no key in argv or child environment', () => {
  const h = readFileSync('scripts/n8n/windows/New-M03FoundationHandoff.ps1', 'utf8'),
    c = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
  for (const source of [h, c]) {
    assert.ok(source.includes('emr-m03-foundation-management.dpapi'));
    assert.equal(source.includes('emr-m03-gw01-'), false);
    assert.equal(source.includes('PGPASSWORD'), false);
    assert.equal(source.includes('SUPABASE'), false);
  }
  assert.ok(c.includes('$child.StandardInput.Write'));
  assert.equal(c.includes("EnvironmentVariables['M03_N8N_API_KEY']"), false);
  assert.ok(c.includes('$child.Kill()'));
  assert.ok(c.includes('[IO.File]::Delete($handoff)'));
});
test(
  'actual PowerShell staging-success guard rejects incomplete or canonical-routing claims without private reads',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const statement = source
      .split(/\r?\n/)
      .find((line) =>
        line.includes("$Mode -ceq 'All' -and $result.status -ceq 'inactive_foundation_staged'"),
      );
    assert.ok(statement, 'exercise the actual consumer guard rather than a duplicate validator');
    const valid = {
      status: 'inactive_foundation_staged',
      verifiedWorkflows: 25,
      inactiveDefinitionsSaved: true,
      deferredErrorWorkflowCount: 24,
      persistedExports: 25,
      finalGraphsBound: false,
      errorRoutingAccepted: false,
    };
    const cases = [
      valid,
      ...[
        { verifiedWorkflows: 24 },
        { persistedExports: 24 },
        { deferredErrorWorkflowCount: 23 },
        { inactiveDefinitionsSaved: false },
        { finalGraphsBound: true },
        { errorRoutingAccepted: true },
      ].map((change) => ({ ...valid, ...change })),
    ];
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-stage-guard-'));
    try {
      const wrapper = join(root, 'public-guard.ps1');
      writeFileSync(
        wrapper,
        "$Mode='All';$cases=ConvertFrom-Json -InputObject '" +
          JSON.stringify(cases).replaceAll("'", "''") +
          "';$out=@();foreach($result in $cases){try{" +
          statement +
          ";$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), ['accepted', ...Array(6).fill('rejected')]);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-stage-guard-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
test(
  'Windows hidden-prompt helper creates only fake isolated DPAPI+lease and preserves a preexisting handoff',
  { skip: process.platform !== 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-handoff-test-'));
    mkdirSync(join(root, 'Temp'));
    try {
      const helper = resolve('scripts/n8n/windows/New-M03FoundationHandoff.ps1');
      const script =
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & '" +
        helper.replaceAll("'", "''") +
        "'; exit $LASTEXITCODE";
      const wrapper = join(root, 'public-synthetic-wrapper.ps1');
      writeFileSync(wrapper, script);
      const e = { ...env(), LOCALAPPDATA: root };
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: e,
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.ok(r.stdout.includes('M03_FOUNDATION_MANAGEMENT_READY'));
      assert.equal(r.stdout.includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      const file = join(root, 'Temp/emr-m03-foundation-management.dpapi'),
        lease = JSON.parse(
          readFileSync(join(root, 'Temp/emr-m03-foundation-management.lease.json'), 'utf8').replace(
            /^\uFEFF/,
            '',
          ),
        );
      assert.equal(existsSync(file), true);
      assert.equal(lease.purpose, 'm03_owned_inactive_provision');
      assert.equal(Date.parse(lease.expiresAt) - Date.parse(lease.createdAt), 7200000);
      const before = readFileSync(file),
        r2 = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
          encoding: 'utf8',
          env: e,
          timeout: 15000,
          windowsHide: true,
        });
      assert.equal(r2.status, 1);
      assert.equal(Buffer.compare(readFileSync(file), before) === 0, true);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-handoff-test-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
test(
  'Windows All child protocol consumes only fake Management and retains generated pending Machine store',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-protocol-test-')),
      repo = join(root, 'fixture-repo');
    mkdirSync(join(root, 'Temp'));
    mkdirSync(repo);
    try {
      const source = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
      const relatives = [...source.matchAll(/^  '([^']+)'/gm)].map((x) => x[1]);
      for (const relative of relatives) {
        const target = join(repo, relative);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(relative));
      }
      const fixtureJournal = join(repo, 'scripts/n8n/out/foundation/binding-intents.jsonl');
      mkdirSync(dirname(fixtureJournal), { recursive: true });
      writeFileSync(
        fixtureJournal,
        JSON.stringify({
          version: 1,
          windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
          kind: 'inactive_binding_intents',
        }) + '\n',
      );
      const cli = join(repo, 'scripts/n8n/foundation-provision-cli.mjs');
      writeFileSync(
        cli,
        `import{readFileSync}from'node:fs';const p=JSON.parse(readFileSync(0,'utf8'));if(p.key!=='PUBLIC_SYNTHETIC_NON_SECRET'||!/^[A-Za-z0-9_-]{43}$/.test(p.machine))process.exit(1);process.stdout.write(JSON.stringify({version:1,windowId:'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',host:'muhhammedsayed.app.n8n.cloud',projectId:'pHvQjDmjxVZ3KQLT',status:'inactive_foundation_staged',phase:'complete',requestCount:0,verifiedWorkflows:25,executionCount:0,credentialsCreated:1,gatewayWindowStarted:false,finalGraphsBound:false,inactiveDefinitionsSaved:true,deferredErrorWorkflowCount:24,errorRoutingAccepted:false,persistedExports:25,networkCompletionVerified:true,diagnostics:{lastMethod:'GET',lastResource:'owned_workflows',httpStatus:200,transportCode:'FOUNDATION_TRANSPORT_BODY',transportReason:'body_declared_limit'}})+'\\n');`,
      );
      const publicPacket = {
        version: 1,
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        audience: 'https://everyone-market-researcher-synthetic-preview.vercel.app',
        sourceCommitSha: 'a'.repeat(40),
        deploymentId: 'dpl_SYNTHETIC',
        environment: 'preview',
        activationAuthorized: false,
      };
      const packetBytes = JSON.stringify(publicPacket);
      writeFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), packetBytes);
      const physicalZod = join(repo, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
      mkdirSync(physicalZod, { recursive: true });
      writeFileSync(join(physicalZod, 'package.json'), '{"name":"zod","version":"4.6.7","type":"module"}');
      writeFileSync(join(physicalZod, 'index.js'), 'export const publicFixture=true;');
      const sharedModules = join(repo, 'packages/shared/node_modules');
      mkdirSync(sharedModules, { recursive: true });
      symlinkSync(physicalZod, join(sharedModules, 'zod'), 'junction');
      const reseal = () => {
        const r = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-File',
            join(repo, 'scripts/n8n/windows/New-M03FoundationPublicSeal.ps1'),
            '-ReplaceReviewedSeal',
          ],
          { encoding: 'utf8', env: env(), timeout: 20000, windowsHide: true },
        );
        assert.equal(r.status, 0, 'isolated public fixture seal');
      };
      reseal();
      const literal = (p) => "'" + p.replaceAll("'", "''") + "'",
        wrapper = join(root, 'protocol-wrapper.ps1');
      writeFileSync(
        wrapper,
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & " +
          literal(join(repo, 'scripts/n8n/windows/New-M03FoundationHandoff.ps1')) +
          '; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}; & ' +
          literal(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1')) +
          ' -Mode All; exit $LASTEXITCODE',
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: { ...env(), LOCALAPPDATA: root },
        timeout: 20000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stdout.includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      const receipt = JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.finalBindingReady, false);
      assert.equal(receipt.inactiveDefinitionsSaved, true);
      assert.equal(receipt.deferredErrorWorkflowCount, 24);
      assert.equal(receipt.errorRoutingAccepted, false);
      assert.deepEqual(receipt.diagnostics, {
        lastMethod: 'GET',
        lastResource: 'owned_workflows',
        httpStatus: 200,
        transportCode: 'FOUNDATION_TRANSPORT_BODY',
        transportReason: 'body_declared_limit',
      });
      assert.equal(JSON.stringify(receipt.diagnostics).includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.leaseDeleted, true);
      assert.equal(receipt.pendingMachineStoreRetained, true);
      assert.equal(existsSync(join(root, 'Temp/emr-m03-foundation-management.dpapi')), false);
      assert.equal(
        existsSync(
          join(
            root,
            'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi',
          ),
        ),
        true,
      );
      const stored = join(
          root,
          'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi',
        ),
        before = readFileSync(stored);
      const again = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: { ...env(), LOCALAPPDATA: root },
        timeout: 20000,
        windowsHide: true,
      });
      assert.equal(again.status, 0);
      assert.equal(Buffer.compare(readFileSync(stored), before) === 0, true);
      const invokeOnly = join(root, 'invoke-only.ps1');
      writeFileSync(
        invokeOnly,
        '& ' +
          literal(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1')) +
          ' -Mode All; exit $LASTEXITCODE',
      );
      const helperOnly = join(root, 'helper-only.ps1');
      writeFileSync(
        helperOnly,
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & " +
          literal(join(repo, 'scripts/n8n/windows/New-M03FoundationHandoff.ps1')) +
          '; exit $LASTEXITCODE',
      );
      const runFile = (file, args = []) =>
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file, ...args], {
          encoding: 'utf8',
          env: { ...env(), LOCALAPPDATA: root },
          timeout: 20000,
          windowsHide: true,
        });
      const ready = runFile(helperOnly);
      assert.equal(ready.status, 0);
      const leasePath = join(root, 'Temp/emr-m03-foundation-management.lease.json');
      const nearLease = JSON.parse(readFileSync(leasePath, 'utf8').replace(/^\uFEFF/, ''));
      const nearExpiry = Date.now() + 30000;
      nearLease.expiresAt = new Date(nearExpiry).toISOString();
      nearLease.createdAt = new Date(nearExpiry - 7200000).toISOString();
      writeFileSync(leasePath, JSON.stringify(nearLease));
      const near = runFile(invokeOnly);
      assert.equal(near.status, 1);
      const nearReceipt = JSON.parse(near.stdout.trim());
      assert.equal(nearReceipt.privateRead, false);
      assert.equal(nearReceipt.handoffDeleted, false);
      assert.equal(nearReceipt.operationLockAcquired, true);
      rmSync(join(root, 'Temp/emr-m03-foundation-management.dpapi'));
      rmSync(leasePath);
      for (const malformedPacket of [
        { ...publicPacket, activationAuthorized: 0 },
        { ...publicPacket, audience: [publicPacket.audience] },
        { ...publicPacket, version: true },
      ]) {
        writeFileSync(
          join(repo, 'scripts/n8n/foundation-delivery-packet.json'),
          JSON.stringify(malformedPacket),
        );
        reseal();
        const strict = runFile(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1'), [
          '-CheckOnly',
        ]);
        assert.equal(strict.status, 1);
        assert.equal(
          strict.stdout.trim(),
          'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.',
        );
      }
      writeFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), packetBytes);
      const childEntered = join(root, 'public-synthetic-child-entered');
      const childRelease = join(root, 'public-synthetic-child-release');
      writeFileSync(
        cli,
        readFileSync(cli, 'utf8')
          .replace('import{readFileSync}', 'import{readFileSync,writeFileSync,existsSync}')
          .replace(
            'const p=JSON.parse',
            `writeFileSync(${JSON.stringify(childEntered)},'PUBLIC_SYNTHETIC_CHILD_ENTERED');const until=Date.now()+30000;while(!existsSync(${JSON.stringify(childRelease)})&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);if(!existsSync(${JSON.stringify(childRelease)}))process.exit(2);const p=JSON.parse`,
          ),
      );
      reseal();
      assert.equal(runFile(helperOnly).status, 0);
      const launch = () =>
        new Promise((resolve) => {
          const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', invokeOnly], {
            env: { ...env(), LOCALAPPDATA: root },
            windowsHide: true,
          });
          let stdout = '',
            stderr = '';
          child.stdout.setEncoding('utf8');
          child.stderr.setEncoding('utf8');
          child.stdout.on('data', (b) => (stdout += b));
          child.stderr.on('data', (b) => (stderr += b));
          child.on('close', (status) => resolve({ status, stdout, stderr }));
        });
      const first = launch();
      for (let poll = 0; poll < 200 && !existsSync(childEntered); poll++)
        await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(existsSync(childEntered), true, 'first owned child is running while lock is held');
      let second;
      try {
        second = await launch();
      } finally {
        writeFileSync(childRelease, 'PUBLIC_SYNTHETIC_CHILD_RELEASE');
      }
      const concurrent = [await first, second];
      assert.deepEqual(concurrent.map((x) => x.status).sort(), [0, 1]);
      const blocked = concurrent.find((x) => x.status === 1);
      assert.equal(blocked.stderr, '');
      const blockedReceipt = JSON.parse(blocked.stdout.trim());
      assert.equal(blockedReceipt.operationLockAcquired, false);
      assert.equal(blockedReceipt.privateRead, false);
      assert.equal(blockedReceipt.handoffDeleted, false);
      assert.equal(Buffer.compare(readFileSync(stored), before) === 0, true);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-protocol-test-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
