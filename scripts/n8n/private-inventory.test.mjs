import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { inventoryWorkflowNames, inventoryCredentialCandidates } from './inventory.mjs';
import { diagnoseFoundationRuntimeBaselineVariants } from './foundation-runtime-checkpoint.mjs';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots = [];
const osEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
function fixture(mode = 'success') {
  const baselineMode = mode.startsWith('baseline');
  const discoveryMode = mode.startsWith('wf70');
  const machineMode = mode.startsWith('machine');
  const runtimeMode = mode.startsWith('runtime');
  const wf00Mode = mode.startsWith('wf00');
  const execution31130Mode = mode.startsWith('execution31130');
  const native31130Mode = mode.startsWith('native31130');
  const category31130Mode = mode.startsWith('category31130');
  const snapshot31130Mode = mode.startsWith('snapshot31130') || category31130Mode;
  const persistentMode =
    baselineMode ||
    discoveryMode ||
    machineMode ||
    runtimeMode ||
    wf00Mode ||
    execution31130Mode ||
    native31130Mode ||
    snapshot31130Mode;
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-n8n-fixture-'));
  roots.push(root);
  const put = (path, value) => {
    const file = join(root, path);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, value);
    return file;
  };
  const creator = put(
    'scripts/n8n/windows/New-M03N8nApiHandoff.ps1',
    readFileSync(resolve('scripts/n8n/windows/New-M03N8nApiHandoff.ps1'), 'utf8').replace(
      "Read-Host 'n8n API key for the verified muhhammedsayed instance' -AsSecureString",
      "ConvertTo-SecureString 'synthetic-n8n-key-for-test-only' -AsPlainText -Force",
    ),
  );
  let consumerSource = readFileSync(
    resolve('scripts/n8n/windows/Invoke-M03N8nInventory.ps1'),
    'utf8',
  ).replace('$childTimeoutMs = 75000', '$childTimeoutMs = 500');
  // This isolated credential/consumer contract test substitutes ONLY the
  // independent public source/budget proof. It does not claim real public
  // reconciliation/closure evidence; the native reader/CLI tests cover those
  // own strict contracts separately, with synthetic DNS/HTTPS and no network.
  if (discoveryMode)
    consumerSource = consumerSource.replace(
      'if($Wf70DiscoveryDiagnostic){$node=Assert-Wf70DiscoveryPublic}',
      'if($Wf70DiscoveryDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (runtimeMode)
    consumerSource = consumerSource.replace(
      'if($RuntimeReconciliationDiagnostic){$node=Assert-RuntimeReconciliationPublic}',
      'if($RuntimeReconciliationDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (wf00Mode)
    consumerSource = consumerSource.replace(
      'if($Wf00ExecutionDiagnostic){$node=Assert-RuntimeReconciliationPublic $true}',
      'if($Wf00ExecutionDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (execution31130Mode)
    consumerSource = consumerSource.replace(
      'if($Execution31130MetadataDiagnostic){$node=Assert-RuntimeReconciliationPublic $false $true}',
      mode === 'execution31130PublicBlocked'
        ? "if($Execution31130MetadataDiagnostic){[IO.File]::WriteAllText((Join-Path $repo 'public-gate.txt'),'reached');throw 'SYNTHETIC_PRIVATE_PUBLIC_ERROR'}"
        : 'if($Execution31130MetadataDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (mode === 'execution31130PublicBlocked')
    consumerSource = consumerSource.replace(
      '  $privateRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA)',
      "  [IO.File]::WriteAllText((Join-Path $repo 'private-sentinel.txt'),'reached');throw 'SYNTHETIC_PRIVATE_SENTINEL'",
    );
  if (native31130Mode)
    consumerSource = consumerSource.replace(
      'if($Execution31130NativeMetadataDiagnostic){$node=Assert-RuntimeReconciliationPublic $false $false $true}',
      mode === 'native31130PublicBlocked'
        ? "if($Execution31130NativeMetadataDiagnostic){[IO.File]::WriteAllText((Join-Path $repo 'public-gate.txt'),'reached');throw 'SYNTHETIC_PRIVATE_PUBLIC_ERROR'}"
        : 'if($Execution31130NativeMetadataDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (mode === 'native31130PublicBlocked')
    consumerSource = consumerSource.replace(
      '  $privateRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA)',
      "  [IO.File]::WriteAllText((Join-Path $repo 'private-sentinel.txt'),'reached');throw 'SYNTHETIC_PRIVATE_SENTINEL'",
    );
  if (category31130Mode)
    consumerSource = consumerSource.replace(
      'if($Execution31130CategoryDiagnostic){$node=Assert-RuntimeReconciliationPublic $false $false $false $false $true}',
      mode === 'category31130PublicBlocked'
        ? "if($Execution31130CategoryDiagnostic){[IO.File]::WriteAllText((Join-Path $repo 'public-gate.txt'),'reached');throw 'SYNTHETIC_PRIVATE_PUBLIC_ERROR'}"
        : 'if($Execution31130CategoryDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  else if (snapshot31130Mode)
    consumerSource = consumerSource.replace(
      'if($Execution31130SnapshotDiagnostic){$node=Assert-RuntimeReconciliationPublic $false $false $false $true}',
      mode === 'snapshot31130PublicBlocked'
        ? "if($Execution31130SnapshotDiagnostic){[IO.File]::WriteAllText((Join-Path $repo 'public-gate.txt'),'reached');throw 'SYNTHETIC_PRIVATE_PUBLIC_ERROR'}"
        : 'if($Execution31130SnapshotDiagnostic){$node=(Get-Command node.exe -CommandType Application).Source}',
    );
  if (mode === 'snapshot31130PublicBlocked' || mode === 'category31130PublicBlocked')
    consumerSource = consumerSource.replace(
      '  $privateRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA)',
      "  [IO.File]::WriteAllText((Join-Path $repo 'private-sentinel.txt'),'reached');throw 'SYNTHETIC_PRIVATE_SENTINEL'",
    );
  if (mode === 'baselineUnknownClose')
    consumerSource = consumerSource.replace('$closed = $child.WaitForExit(5000)', '$closed = $false');
  if (mode === 'failedStart')
    consumerSource = consumerSource.replace(
      '$node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source',
      "$node = Join-Path $repo 'synthetic-missing-node.exe'",
    );
  const consumer = put('scripts/n8n/windows/Invoke-M03N8nInventory.ps1', consumerSource);
  const result = {
    version: 1,
    environment: 'dev',
    host: 'muhhammedsayed.app.n8n.cloud',
    projectId: 'pHvQjDmjxVZ3KQLT',
    status: 'complete',
    requestCount: 4,
    authenticationVerified: true,
    projectVerified: true,
    diagnostics: {
      version: 1,
      dns: 'complete',
      requests: ['discover', 'projects', 'workflows', 'credentials'].map((resource) => ({
        resource,
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
      })),
    },
    manualExecutionSupportedByReviewedPublicApi: false,
    capabilities: Object.fromEntries(
      [
        'workflowList',
        'workflowRead',
        'workflowCreate',
        'workflowUpdate',
        'workflowPublish',
        'workflowUnpublish',
        'credentialList',
        'credentialRead',
        'credentialTest',
        'projectList',
      ].map((k) => [k, true]),
    ),
    resources: Object.fromEntries(
      ['projects', 'workflows', 'credentials'].map((k) => [
        k,
        { status: 'complete', httpStatus: 200, count: 0, unknownCount: 0, known: [] },
      ]),
    ),
  };
  result.resources.projects = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [{ id: 'pHvQjDmjxVZ3KQLT', type: 'personal' }],
  };
  result.resources.credentials = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [
      Object.fromEntries(
        Object.entries(inventoryCredentialCandidates.find((c) => c.key === 'postgres')).filter(
          ([k]) => k !== 'key',
        ),
      ),
    ],
  };
  result.resources.workflows = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [{ name: 'WF-00 · Orchestrator [dev]', id: 'syntheticWorkflow1', active: false, archived: false }],
  };
  if (mode === 'all25')
    result.resources.workflows = {
      status: 'complete',
      httpStatus: 200,
      count: 25,
      unknownCount: 0,
      known: inventoryWorkflowNames.map((name, i) => ({
        name,
        id: `syntheticWorkflow${i}`,
        active: false,
        archived: false,
      })),
    };
  if (['nativeProviders', 'wrongNativeType', 'wrongCandidateName', 'wrongCandidateId'].includes(mode)) {
    result.resources.credentials = {
      status: 'complete',
      httpStatus: 200,
      count: 5,
      unknownCount: 0,
      known: inventoryCredentialCandidates.map(({ id, name, type }) => ({ id, name, type })),
    };
    const apify = result.resources.credentials.known.find((c) => c.type === 'apifyApi');
    if (mode === 'wrongNativeType') apify.type = 'httpHeaderAuth';
    if (mode === 'wrongCandidateName') apify.name = 'Apify API';
    if (mode === 'wrongCandidateId') apify.id = 'unapprovedSyntheticId';
  }
  if (mode === 'reflectedKey') result.resources.credentials.known[0].id = 'synthetic-n8n-key-for-test-only';
  if (mode === 'unsafeDiagnostics')
    result.diagnostics.requests[2].failureCode = 'synthetic-private-diagnostic-code';
  if (mode === 'workflowBodyFailure') {
    result.status = 'network_failed';
    result.requestCount = 3;
    result.projectVerified = false;
    result.diagnostics.requests = result.diagnostics.requests.slice(0, 3);
    Object.assign(result.diagnostics.requests[2], {
      bodyRead: 'aborted',
      jsonParsed: false,
      schemaValidated: false,
      failureStage: 'body_read',
      failureCode: 'body_aborted',
    });
    result.resources.workflows = {
      status: 'not_attempted',
      httpStatus: null,
      count: 0,
      unknownCount: 0,
      known: [],
    };
    result.resources.credentials = {
      status: 'not_attempted',
      httpStatus: null,
      count: 0,
      unknownCount: 0,
      known: [],
    };
  }
  if (baselineMode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      status: mode === 'baselineMismatch' ? 'baseline_mismatch' : 'matching_baseline',
      requestCount: 1,
      authenticationVerified: true,
      projectVerified: true,
      workflowKey: 'WF-00',
      baseline: {
        version: 1,
        workflowKey: 'WF-00',
        failedChecks: mode === 'baselineMismatch' ? ['version_mismatch'] : [],
        components: { nameEqual: true, nodesEqual: true, connectionsEqual: true, settingsEqual: true },
      },
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: [
          {
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
          },
        ],
      },
    });
    const record = JSON.parse(readFileSync(resolve('n8n/workflows/WF-00.json'), 'utf8'));
    const baseline = { key: 'WF-00', body: record.workflow };
    result.forensics = structuredClone(diagnoseFoundationRuntimeBaselineVariants(record.workflow, baseline));
    if (mode === 'baselineUnsafe') result.baseline.private = 'synthetic-private-value';
    if (mode === 'baselineUnsafeForensics')
      result.forensics.nodeCategories.parametersEqual = 'synthetic-private-value';
  }
  if (discoveryMode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      workflowKey: 'WF-70',
      status: 'discovery_complete',
      transportAdapter: 'inventory_bounded_get_adapter',
      requestCount: 2,
      maximumRequests: 4,
      authenticationVerified: true,
      paginationComplete: true,
      candidateCount: 0,
      adoptionProven: false,
      drainProven: false,
      readerFailure: null,
      networkCompletionVerified: true,
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: Array.from({ length: 2 }, () => ({
          resource: 'executions',
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
        })),
      },
    });
    if (mode === 'wf70Unsafe')
      result.readerFailure = {
        version: 1,
        workflowKey: 'WF-70',
        operation: 'discovery',
        stage: 'projection',
        classification: 'contract',
        code: 'SYNTHETIC_PRIVATE_CODE',
        httpStatus: 200,
      };
    if (mode === 'wf70Http') {
      result.status = 'discovery_failed';
      result.requestCount = 1;
      result.paginationComplete = false;
      result.candidateCount = null;
      result.authenticationVerified = false;
      result.diagnostics.requests = result.diagnostics.requests.slice(0, 1);
      Object.assign(result.diagnostics.requests[0], {
        httpStatus: 429,
        schemaValidated: false,
        failureStage: 'status',
        failureCode: 'http_failed',
      });
      result.readerFailure = {
        version: 1,
        workflowKey: 'WF-70',
        operation: 'discovery',
        stage: 'http_status',
        classification: 'http',
        code: 'DISCOVERY',
        httpStatus: 429,
      };
    }
  }
  if (machineMode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      credentialId: 'EmrM03Machine19',
      expectedCreatedAt: '2026-10-19T00:25:21.669Z',
      status: mode === 'machineHttp' ? 'http_failed' : 'metadata_observed',
      requestCount: 1,
      httpStatus: mode === 'machineHttp' ? 405 : 200,
      authenticationVerified: mode !== 'machineHttp',
      networkCompletionVerified: true,
      metadata:
        mode === 'machineHttp'
          ? null
          : {
              objectShape: true,
              dataPresent: false,
              idMatches: true,
              nameMatches: true,
              typeMatches: true,
              createdAtMatches: true,
              updatedAtValid: true,
              flagsCompatible: true,
              resolverCompatible: true,
              updatedAtMatchesCreatedAt: false,
            },
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: [
          {
            resource: 'credentials',
            page: 1,
            tcpConnected: true,
            tlsVerified: true,
            httpStatus: mode === 'machineHttp' ? 405 : 200,
            bodyRead: mode === 'machineHttp' ? 'not_observed' : 'complete',
            jsonParsed: mode !== 'machineHttp',
            schemaValidated: mode !== 'machineHttp',
            socketClosed: true,
            failureStage: mode === 'machineHttp' ? 'status' : 'none',
            failureCode: mode === 'machineHttp' ? 'http_failed' : 'none',
          },
        ],
      },
    });
    if (mode === 'machineUnsafe') result.metadata.data = 'synthetic-private-value';
    if (mode === 'machineBadBool') result.metadata.idMatches = 'synthetic-private-value';
  }
  if (runtimeMode) {
    const metadata = Object.fromEntries(
      [
        'objectShape',
        'dataPresent',
        'idMatches',
        'nameMatches',
        'typeMatches',
        'createdAtMatches',
        'updatedAtMatchesJournal',
        'flagsCompatible',
        'resolverCompatible',
      ].map((k) => [k, k !== 'dataPresent']),
    );
    const workflow = Object.fromEntries(
      [
        'objectShape',
        'idMatches',
        'archiveStateMatches',
        'ownerProjectMatches',
        'tagsMatchBaseline',
        'pinnedDataAbsent',
        'baselineGraphEqual',
        'beforeGraphEqual',
        'targetGraphEqual',
        'versionMatchesBaseline',
        'versionMatchesBefore',
        'versionMatchesTarget',
        'publicationMatchesBaseline',
        'publicationMatchesBefore',
        'publicationMatchesTarget',
      ].map((k) => [k, true]),
    );
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      technicalAttempt: 13,
      sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
      windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      status: mode === 'runtimeHttp' ? 'http_failed' : 'readback_observed',
      requestCount: mode === 'runtimeHttp' ? 2 : 3,
      authenticationVerified: mode !== 'runtimeHttp',
      networkCompletionVerified: true,
      metadata,
      workflows: {
        'SUB-NOTIFY': mode === 'runtimeHttp' ? null : { ...workflow },
        'WF-90': mode === 'runtimeHttp' ? null : { ...workflow },
      },
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: Array.from({ length: mode === 'runtimeHttp' ? 2 : 3 }, (_, i) => ({
          resource: i === 0 ? 'credentials' : 'workflows',
          page: i === 2 ? 2 : 1,
          tcpConnected: true,
          tlsVerified: true,
          httpStatus: mode === 'runtimeHttp' && i === 1 ? 403 : 200,
          bodyRead: mode === 'runtimeHttp' && i === 1 ? 'not_observed' : 'complete',
          jsonParsed: !(mode === 'runtimeHttp' && i === 1),
          schemaValidated: !(mode === 'runtimeHttp' && i === 1),
          socketClosed: true,
          failureStage: mode === 'runtimeHttp' && i === 1 ? 'status' : 'none',
          failureCode: mode === 'runtimeHttp' && i === 1 ? 'http_failed' : 'none',
        })),
      },
    });
    if (mode === 'runtimeUnsafe') result.workflows['SUB-NOTIFY'].privateValue = 'synthetic-private-value';
    if (mode === 'runtimeBadBool') result.metadata.updatedAtMatchesJournal = 'synthetic-private-value';
  }
  if (wf00Mode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      workflowKey: 'WF-00',
      status: 'execution_metadata_observed',
      requestCount: 3,
      maximumRequests: 3,
      authenticationVerified: true,
      networkCompletionVerified: true,
      runningEmpty: true,
      runningPaginationComplete: true,
      latest: [],
      latestPaginationComplete: true,
      unadmittedExecutionIdEstablished: false,
      allActiveExecutionsAbsentProven: false,
      savedWorkflowVerified: true,
      manualRetentionDisabled: true,
      baseline: {
        versionMatches: true,
        definitionMatches: true,
        settingsMatch: true,
        ownershipMatches: true,
        inactive: true,
      },
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: ['executions', 'executions', 'workflows'].map((resource, i) => ({
          resource,
          page: i === 1 ? 2 : 1,
          tcpConnected: true,
          tlsVerified: true,
          httpStatus: 200,
          bodyRead: 'complete',
          jsonParsed: true,
          schemaValidated: true,
          socketClosed: true,
          failureStage: 'none',
          failureCode: 'none',
        })),
      },
    });
    if (mode === 'wf00Unsafe') result.latest = [{ privateValue: 'SYNTHETIC_PRIVATE' }];
    if (mode === 'wf00BadBool') result.manualRetentionDisabled = 'SYNTHETIC_PRIVATE';
  }
  if (execution31130Mode) {
    for (const k of Object.keys(result)) delete result[k];
    const fieldNames = [
      'objectShape',
      'idPresent',
      'idString',
      'idMatches',
      'workflowIdPresent',
      'workflowIdString',
      'workflowIdMatches',
      'modePresent',
      'modeKnown',
      'modeManual',
      'statusPresent',
      'statusKnown',
      'versionPresent',
      'versionNull',
      'versionIdentifier',
      'versionMatchesBinding',
      'createdAtPresent',
      'createdAtString',
      'createdAtCanonical',
      'createdAtWithinIntent',
      'timestampsNotFuture',
      'startedAtPresent',
      'startedAtNull',
      'startedAtCanonical',
      'stoppedAtPresent',
      'stoppedAtNull',
      'stoppedAtCanonical',
      'waitTillPresent',
      'waitTillNull',
      'waitTillCanonical',
      'terminalTimestampsOrdered',
      'terminalWaitNull',
      'payloadAbsent',
      'sizeFlagPresent',
      'sizeFlagBoolean',
      'sizeFlagSafe',
      'finishedPresent',
      'finishedBoolean',
      'readerMetadataContractSatisfied',
    ];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      technicalAttempt: 16,
      status: 'execution_metadata_classified',
      requestCount: 1,
      maximumRequests: 1,
      httpStatus: 200,
      authenticationVerified: true,
      networkCompletionVerified: true,
      acceptanceProven: false,
      metadata: { executionId: '31130', workflowId: 'MzimjpsuyPuK7SKe', mode: 'manual', status: 'success' },
      fields: Object.fromEntries(
        fieldNames.map((k) => [
          k,
          ![
            'versionNull',
            'startedAtNull',
            'stoppedAtNull',
            'waitTillCanonical',
            'sizeFlagPresent',
            'sizeFlagBoolean',
          ].includes(k),
        ]),
      ),
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: [
          {
            resource: 'executions',
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
          },
        ],
      },
    });
    if (mode === 'execution31130Unsafe') result.fields.raw = 'SYNTHETIC_PRIVATE';
    if (mode === 'execution31130BadBool') result.fields.idMatches = 'SYNTHETIC_PRIVATE';
    if (mode === 'execution31130WrongId') result.metadata.executionId = 'SYNTHETIC_PRIVATE';
  }
  if (native31130Mode || snapshot31130Mode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      technicalAttempt: 16,
      status: 'native_metadata_verified',
      requestCount: 1,
      maximumRequests: 1,
      httpStatus: 200,
      tlsVerified: true,
      readerMetadataVerified: true,
      networkCompletionVerified: true,
      controlReservationConservative: true,
      acceptanceProven: false,
      metadata: {
        executionId: '31130',
        workflowId: 'MzimjpsuyPuK7SKe',
        mode: 'manual',
        status: 'success',
        versionMatchesIntent: true,
      },
      readerFailure: null,
      transportFailureCode: null,
      readerState: { requests: 1, pendingRequests: 0, unclosedResponses: 0, busy: false },
      transportState: { pendingRequests: 0, unclosedResponses: 0 },
    });
    if (mode === 'native31130Unsafe') result.raw = 'SYNTHETIC_PRIVATE';
    if (mode === 'native31130BadBool') result.tlsVerified = 'SYNTHETIC_PRIVATE';
    if (mode === 'native31130WrongCounter') result.readerState.pendingRequests = '0';
    if (mode === 'native31130Failure') {
      result.status = 'native_metadata_failed';
      result.readerMetadataVerified = false;
      result.metadata = null;
      result.readerFailure = {
        version: 1,
        workflowKey: 'WF-00',
        operation: 'metadata',
        stage: 'projection',
        classification: 'contract',
        code: 'METADATA',
        httpStatus: 200,
      };
    }
  }
  if (snapshot31130Mode) {
    result.status = 'native_snapshot_classified';
    result.readerMetadataVerified = false;
    result.readerState = null;
    result.snapshotStage = 'complete';
    const fields = [
      'objectShape',
      'dataObject',
      'resultDataObject',
      'idMatches',
      'workflowMatches',
      'versionMatchesIntent',
      'snapshotObject',
      'snapshotIdMatches',
      'snapshotVersionMatches',
      'graphComputable',
      'executedGraphMatches',
      'nodesShape',
      'runDataShape',
      'runDataNamesKnown',
      'pinsPresent',
      'pinsNull',
      'pinsObject',
      'pinsEmpty',
      'pinsSingleEmptyManual',
      'pinsPassExistingReader',
      'redactionPresent',
      'redactionPassesExistingReader',
      'rootParentAbsent',
      'manualOutputEmptyJson',
      'executeRunsShape',
      'childLinksShape',
      'observedChildLink',
      'unexpectedChildLink',
    ];
    result.forensics = {
      fields: Object.fromEntries(
        fields.map((k) => [
          k,
          ![
            'pinsPresent',
            'pinsNull',
            'pinsObject',
            'pinsEmpty',
            'pinsSingleEmptyManual',
            'redactionPresent',
            'unexpectedChildLink',
          ].includes(k),
        ]),
      ),
      childExecutionIds: ['31131'],
      nativeTreeSettlementProven: false,
    };
    if (category31130Mode) {
      const bools = (keys) => Object.fromEntries(keys.map((k) => [k, true]));
      result.forensics.categories = {
        components: bools(['nameEqual', 'nodesEqual', 'connectionsEqual', 'settingsEqual']),
        nodes: bools(['indexExact', 'idSetEqual', 'idOrderEqual', 'idAlignedExact']),
        nodeFields: bools([
          'id',
          'name',
          'type',
          'typeVersion',
          'parameters',
          'position',
          'disabled',
          'credentials',
          'extendsCredential',
          'retryOnFail',
          'maxTries',
          'waitBetweenTries',
          'onError',
          'continueOnFail',
          'alwaysOutputData',
          'executeOnce',
          'notes',
          'notesInFlow',
          'webhookId',
        ]),
        settings: Object.fromEntries(
          [
            'executionOrder',
            'timezone',
            'executionTimeout',
            'callerPolicy',
            'callerIds',
            'availableInMCP',
            'saveDataErrorExecution',
            'saveDataSuccessExecution',
            'saveManualExecutions',
            'saveExecutionProgress',
            'errorWorkflow',
            'timeSavedPerExecution',
            'executionConcurrency',
            'binaryMode',
          ].map((k) => [k, bools(['equal', 'expectedPresent', 'observedPresent'])]),
        ),
        settingsUnknownKeyPresent: false,
        nodeUnknownKeyPresent: false,
        nodeCategories: bools([
          'identityEqual',
          'parametersEqual',
          'credentialsEqual',
          'behaviorEqual',
          'layoutEqual',
          'annotationsEqual',
        ]),
        settingsCategories: bools([
          'retentionEqual',
          'mcpVisibilityEqual',
          'errorRoutingEqual',
          'otherEqual',
        ]),
        normalizationCandidates: bools([
          'nodesEqualAfterKnownFalseDefaults',
          'graphEqualAfterNodeOrderAlignment',
          'graphEqualAfterLayoutOmitted',
          'graphEqualAfterNativeBinaryModeOmitted',
          'settingsEqualAfterDefaultErrorWorkflowOmitted',
          'graphEqualAfterDefaultErrorWorkflowOmitted',
        ]),
      };
      if (mode === 'category31130Unsafe')
        result.forensics.categories.nodeFields.SYNTHETIC_PRIVATE = 'SYNTHETIC_PRIVATE';
      if (mode === 'category31130BadBool')
        result.forensics.categories.settings.binaryMode.observedPresent = 'SYNTHETIC_PRIVATE';
      if (mode === 'category31130Failure') {
        result.status = 'native_snapshot_failed';
        result.snapshotStage = 'parse';
        result.forensics = null;
        result.metadata = null;
      }
    }
    if (mode === 'snapshot31130Unsafe') result.forensics.raw = 'SYNTHETIC_PRIVATE';
    if (mode === 'snapshot31130BadBool') result.forensics.fields.executedGraphMatches = 'SYNTHETIC_PRIVATE';
    if (mode === 'snapshot31130ForeignChild') result.forensics.childExecutionIds = ['99111'];
    if (mode === 'snapshot31130Failure') {
      result.status = 'native_snapshot_failed';
      result.snapshotStage = 'parse';
      result.forensics = null;
      result.metadata = null;
    }
  }
  const code = `import {writeFileSync} from 'node:fs';
 const good=${category31130Mode ? "process.argv[2]==='--execution-31130-category-diagnostic'&&" : snapshot31130Mode ? "process.argv[2]==='--execution-31130-snapshot-diagnostic'&&" : ''}${native31130Mode ? "process.argv[2]==='--execution-31130-native-metadata-diagnostic'&&" : ''}${execution31130Mode ? "process.argv[2]==='--execution-31130-metadata-diagnostic'&&" : ''}${wf00Mode ? "process.argv[2]==='--wf00-execution-diagnostic'&&" : ''}process.env.M03_N8N_API_KEY==='synthetic-n8n-key-for-test-only'&&!process.env.PGPASSWORD&&!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.NODE_OPTIONS${baselineMode ? "&&process.argv.length===3&&process.argv[2]==='--workflow-baseline-diagnostic'" : discoveryMode ? "&&process.argv.length===3&&process.argv[2]==='--wf70-discovery-diagnostic'" : machineMode ? "&&process.argv.length===3&&process.argv[2]==='--machine-metadata-diagnostic'" : runtimeMode ? "&&process.argv.length===3&&process.argv[2]==='--runtime-reconciliation-diagnostic'" : ''};
 writeFileSync(new URL('./called.txt',import.meta.url),good?'only-n8n-key':'wrong-env');
 delete process.env.M03_N8N_API_KEY;
 console.error('synthetic-private-stderr-must-stay-hidden');
 ${['timeout', 'baselineTimeout', 'baselineUnknownClose', 'machineTimeout', 'runtimeTimeout'].includes(mode) ? 'await new Promise(r=>setTimeout(r,10000));' : ''}
 console.log(${mode === 'badJson' ? "'synthetic-private-stdout-must-stay-hidden'" : mode === 'unsafeSchema' ? JSON.stringify(JSON.stringify({ ...result, privateSecret: 'synthetic-private-value' })) : JSON.stringify(JSON.stringify(result))});
 ${mode === 'failure' ? 'process.exitCode=7;' : ['workflowBodyFailure', 'wf70Http', 'machineHttp', 'runtimeHttp', 'native31130Failure', 'snapshot31130Failure', 'category31130Failure'].includes(mode) ? 'process.exitCode=1;' : ''}`;
  put('scripts/n8n/inventory.mjs', code);
  const paths = [
    'scripts/n8n/windows/New-M03N8nApiHandoff.ps1',
    'scripts/n8n/windows/Invoke-M03N8nInventory.ps1',
    'scripts/n8n/inventory.mjs',
  ];
  const seal = {
    version: 1,
    host: 'muhhammedsayed.app.n8n.cloud',
    projectId: 'pHvQjDmjxVZ3KQLT',
    files: Object.fromEntries(
      paths.map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(join(root, p)))
          .digest('hex'),
      ]),
    ),
  };
  if (persistentMode) {
    const baselineFiles = [
      'scripts/n8n/foundation-runtime-checkpoint.mjs',
      'n8n/workflows/WF-00.json',
      'scripts/n8n/windows/Dev-CredentialStore.ps1',
    ];
    for (const path of baselineFiles) put(path, readFileSync(resolve(path)));
    seal.baselineFiles = Object.fromEntries(
      baselineFiles.map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(join(root, p)))
          .digest('hex'),
      ]),
    );
  }
  if (runtimeMode) {
    const p =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json';
    put(p, readFileSync(resolve(p)));
    seal.runtimeFiles = {
      [p]: createHash('sha256')
        .update(readFileSync(join(root, p)))
        .digest('hex'),
    };
  }
  put('scripts/n8n/m03-inventory-seal.json', JSON.stringify(seal));
  mkdirSync(join(root, 'private/Temp'), { recursive: true });
  const runFile = (file, args = []) =>
    spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', file, ...args], {
      env: {
        ...osEnv(),
        LOCALAPPDATA: join(root, 'private'),
        PGPASSWORD: 'unrelated-db-secret',
        SUPABASE_ACCESS_TOKEN: 'unrelated-api-secret',
        NODE_OPTIONS: '--no-warnings',
      },
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
  assert.equal(runFile(creator).status, 0);
  if (persistentMode) {
    const initialize = put(
      'synthetic-initialize.ps1',
      String.raw`
. (Join-Path $PSScriptRoot 'scripts/n8n/windows/Dev-CredentialStore.ps1')
$null=Initialize-M03DevPrivateDirectory
$spec=Get-M03DevCredentialSpec Management
$bytes=[IO.File]::ReadAllBytes((Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-n8n-api-key.dpapi'))
Write-M03DevPrivateFile $spec.Source $bytes
$store=Join-Path (Get-M03DevCredentialRoot) 'store.operation.lock'
$s=[IO.File]::Open($store,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$s.Dispose();Set-M03DevPrivateAcl $store $false
[IO.File]::Delete((Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-n8n-api-key.dpapi'))
`,
    );
    assert.equal(runFile(initialize).status, 0);
  }
  return {
    root,
    put,
    creator,
    consumer,
    handoff: join(root, 'private/Temp/emr-m03-n8n-api-key.dpapi'),
    run: (check = false) =>
      runFile(consumer, [
        ...(check ? ['-CheckOnly'] : []),
        ...(baselineMode ? ['-WorkflowBaselineDiagnostic'] : []),
        ...(machineMode ? ['-MachineMetadataDiagnostic'] : []),
        ...(runtimeMode ? ['-RuntimeReconciliationDiagnostic'] : []),
        ...(discoveryMode ? ['-Wf70DiscoveryDiagnostic'] : []),
        ...(wf00Mode ? ['-Wf00ExecutionDiagnostic'] : []),
        ...(execution31130Mode ? ['-Execution31130MetadataDiagnostic'] : []),
        ...(native31130Mode ? ['-Execution31130NativeMetadataDiagnostic'] : []),
        ...(category31130Mode
          ? ['-Execution31130CategoryDiagnostic']
          : snapshot31130Mode
            ? ['-Execution31130SnapshotDiagnostic']
            : []),
      ]),
  };
}
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
describe(
  'M03 n8n bounded private inventory consumer, isolated synthetic Windows DPAPI only',
  { skip: process.platform !== 'win32' },
  () => {
    it('category31130 native Management child validates fixed comparisons and preserves its encrypted original', () => {
      for (const mode of [
        'category31130Success',
        'category31130Unsafe',
        'category31130BadBool',
        'category31130Failure',
      ]) {
        const f = fixture(mode),
          check = f.run(true);
        assert.equal(check.status, 0, check.stdout + check.stderr);
        assert.match(check.stdout, /EXECUTION_31130_CATEGORY_CHECK_ONLY_READY/);
        const original = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(original),
          r = f.run();
        assert.equal(r.status, mode === 'category31130Success' ? 0 : 1, r.stderr);
        assert.doesNotMatch(
          r.stdout + r.stderr,
          /SYNTHETIC_PRIVATE|synthetic-private|synthetic-n8n-key|unrelated-/,
        );
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(original), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        if (mode === 'category31130Success')
          assert.equal(receipt.inventory.forensics.categories.nodeFields.parameters, true);
        else if (mode === 'category31130Failure') assert.equal(receipt.inventory.snapshotStage, 'parse');
        else assert.equal(receipt.inventory, null);
      }
    });
    it('Runtime andWF00 reconciliation actual native public gate bounds its child and denies changed counters or private output before any credential path', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-runtime-public-'));
      roots.push(root);
      const put = (p, text) => {
        const path = join(root, p);
        mkdirSync(resolve(path, '..'), { recursive: true });
        writeFileSync(path, text);
        return path;
      };
      const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
      const node = process.execPath;
      const module = put(
        'scripts/n8n/windows/Acceptance-PublicRuntime.ps1',
        `function Assert-M03AcceptancePublicSeal($Root,$Seal){return ${quote(node)}}`,
      );
      const hash = createHash('sha256').update(readFileSync(module)).digest('hex');
      put(
        'scripts/n8n/foundation-acceptance-seal.json',
        JSON.stringify({ files: { 'scripts/n8n/windows/Acceptance-PublicRuntime.ps1': hash } }),
      );
      const result = {
        kind: 'm03_runtime_reconciliation_check',
        status: 'ready',
        technicalAttempt: 13,
        sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
        windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
        managementAttempts: 483,
        controlAttempts: 791,
        combinedAttempts: 1274,
        maximumRequests: 3,
        privateRead: false,
        networkRequests: 0,
      };
      for (const publicMode of [
        'runtime',
        'wf00',
        'execution31130',
        'native31130',
        'snapshot31130',
        'category31130',
      ]) {
        const wf00Mode = publicMode === 'wf00',
          execution31130Mode = publicMode === 'execution31130',
          native31130Mode = publicMode === 'native31130',
          snapshot31130Mode = publicMode === 'snapshot31130',
          category31130Mode = publicMode === 'category31130';
        for (const mode of ['ready', 'stale', 'stringCounter', 'private', 'extra', 'overflow', 'stderr']) {
          const dto = structuredClone(result);
          if (wf00Mode)
            Object.assign(dto, {
              kind: 'm03_wf00_execution_check',
              technicalAttempt: 15,
              sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
              windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
              managementAttempts: 524,
              controlAttempts: 846,
              combinedAttempts: 1370,
            });
          if (execution31130Mode)
            Object.assign(dto, {
              kind: 'm03_execution_31130_metadata_check',
              technicalAttempt: 16,
              sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
              windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
              managementAttempts: 824,
              controlAttempts: 955,
              combinedAttempts: 1779,
              maximumRequests: 1,
            });
          if (native31130Mode)
            Object.assign(dto, {
              kind: 'm03_execution_31130_native_metadata_check',
              technicalAttempt: 16,
              sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
              windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
              managementAttempts: 825,
              controlAttempts: 955,
              combinedAttempts: 1780,
              maximumRequests: 1,
            });
          if (snapshot31130Mode)
            Object.assign(dto, {
              kind: 'm03_execution_31130_snapshot_check',
              technicalAttempt: 16,
              sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
              windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
              managementAttempts: 826,
              controlAttempts: 957,
              combinedAttempts: 1783,
              maximumRequests: 1,
            });
          if (category31130Mode)
            Object.assign(dto, {
              kind: 'm03_execution_31130_category_check',
              technicalAttempt: 16,
              sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
              windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
              managementAttempts: 827,
              controlAttempts: 958,
              combinedAttempts: 1785,
              maximumRequests: 1,
            });
          if (mode === 'stale') dto.managementAttempts--;
          if (mode === 'stringCounter') dto.controlAttempts = String(dto.controlAttempts);
          if (mode === 'private') dto.privateRead = true;
          if (mode === 'extra') dto.raw = 'SYNTHETIC_PRIVATE_VALUE';
          put(
            'scripts/n8n/inventory.mjs',
            `if(process.argv[2]!==${JSON.stringify(category31130Mode ? '--execution-31130-category-check-only' : snapshot31130Mode ? '--execution-31130-snapshot-check-only' : native31130Mode ? '--execution-31130-native-metadata-check-only' : execution31130Mode ? '--execution-31130-metadata-check-only' : wf00Mode ? '--wf00-execution-check-only' : '--runtime-reconciliation-check-only')}||process.env.M03_N8N_API_KEY||process.env.PGPASSWORD||process.env.SUPABASE_ACCESS_TOKEN||process.env.NODE_OPTIONS)process.exit(7);${mode === 'stderr' ? "console.error('SYNTHETIC_PRIVATE_STDERR');" : ''}console.log(${JSON.stringify(mode === 'overflow' ? 'X'.repeat(5000) : JSON.stringify(dto))});`,
          );
          const script = put(
            'public.ps1',
            `$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$repo=${quote(root)};$source=${quote(resolve('scripts/n8n/windows/Invoke-M03N8nInventory.ps1'))}
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'PARSE_FAILED'}
foreach($name in @('Assert-Keys','Assert-RuntimeReconciliationPublic')){$found=@($ast.FindAll({param($v)$v -is [Management.Automation.Language.FunctionDefinitionAst] -and $v.Name -ceq $name},$true));if($found.Count -ne 1){throw 'MISSING_FUNCTION'};Invoke-Expression $found[0].Extent.Text}
function Confined-File($Root,$Relative){return Join-Path $Root $Relative}
try{$value=Assert-RuntimeReconciliationPublic ${wf00Mode ? '$true' : '$false'} ${execution31130Mode ? '$true' : '$false'} ${native31130Mode ? '$true' : '$false'} ${snapshot31130Mode ? '$true' : '$false'} ${category31130Mode ? '$true' : '$false'};if($value -cne ${quote(node)}){throw 'WRONG_NODE'};Write-Output 'PUBLIC_READY'}catch{Write-Output 'PUBLIC_BLOCKED'}
`,
          );
          const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
            env: {
              ...osEnv(),
              M03_N8N_API_KEY: 'SYNTHETIC_PRIVATE_KEY',
              PGPASSWORD: 'SYNTHETIC_PRIVATE_DATABASE',
              SUPABASE_ACCESS_TOKEN: 'SYNTHETIC_PRIVATE_TOKEN',
              NODE_OPTIONS: '--no-warnings',
            },
            encoding: 'utf8',
            windowsHide: true,
            timeout: 10000,
          });
          assert.equal(r.status, 0, r.stderr);
          assert.equal(r.stdout.trim(), mode === 'ready' ? 'PUBLIC_READY' : 'PUBLIC_BLOCKED');
          assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_PRIVATE/);
        }
      }
    });
    it('snapshot31130 native Management child exposes only fixed forensic predicates and retains its encrypted original', () => {
      for (const mode of [
        'snapshot31130Success',
        'snapshot31130Unsafe',
        'snapshot31130BadBool',
        'snapshot31130ForeignChild',
        'snapshot31130Failure',
      ]) {
        const f = fixture(mode),
          check = f.run(true);
        assert.equal(check.status, 0, check.stderr);
        assert.match(check.stdout, /EXECUTION_31130_SNAPSHOT_CHECK_ONLY_READY/);
        const original = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(original),
          r = f.run();
        assert.equal(r.status, mode === 'snapshot31130Success' ? 0 : 1, r.stderr);
        assert.doesNotMatch(
          r.stdout + r.stderr,
          /SYNTHETIC_PRIVATE|99111|synthetic-private|synthetic-n8n-key|unrelated-/,
        );
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(original), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        if (mode === 'snapshot31130Success')
          assert.deepEqual(receipt.inventory.forensics.childExecutionIds, ['31131']);
        else if (mode === 'snapshot31130Failure') assert.equal(receipt.inventory.snapshotStage, 'parse');
        else assert.equal(receipt.inventory, null);
      }
    });
    it('native31130 native Management child validates fixed failure metadata and rejects unsafe output', () => {
      for (const mode of [
        'native31130Success',
        'native31130Unsafe',
        'native31130BadBool',
        'native31130WrongCounter',
        'native31130Failure',
      ]) {
        const f = fixture(mode),
          check = f.run(true);
        assert.equal(check.status, 0, check.stderr);
        assert.match(check.stdout, /EXECUTION_31130_NATIVE_METADATA_CHECK_ONLY_READY/);
        const original = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(original);
        const r = f.run();
        assert.equal(r.status, mode === 'native31130Success' ? 0 : 1, r.stderr);
        assert.doesNotMatch(
          r.stdout + r.stderr,
          /SYNTHETIC_PRIVATE|synthetic-private|synthetic-n8n-key|unrelated-/,
        );
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(original), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        if (mode === 'native31130Success') assert.equal(receipt.inventory.status, 'native_metadata_verified');
        else if (mode === 'native31130Failure')
          assert.equal(receipt.inventory.readerFailure.code, 'METADATA');
        else assert.equal(receipt.inventory, null);
      }
    });
    it('execution31130 public refusal stops the whole native consumer before its private-path sentinel', () => {
      for (const mode of [
        'execution31130PublicBlocked',
        'native31130PublicBlocked',
        'snapshot31130PublicBlocked',
        'category31130PublicBlocked',
      ]) {
        const f = fixture(mode);
        for (const check of [true, false]) {
          const r = f.run(check);
          assert.equal(r.status, 1, r.stderr);
          assert.match(r.stdout, /N8N_PREFLIGHT_BLOCKED/);
          assert.equal(readFileSync(join(f.root, 'public-gate.txt'), 'utf8'), 'reached');
          assert.equal(existsSync(join(f.root, 'private-sentinel.txt')), false);
          assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
          assert.equal(existsSync(f.handoff), false);
          assert.equal(
            existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
            false,
          );
          assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_PRIVATE/);
        }
      }
    });
    it('execution31130 fixed mode preserves Management and rejects unsafe metadata without private output', () => {
      for (const mode of [
        'execution31130Success',
        'execution31130Unsafe',
        'execution31130BadBool',
        'execution31130WrongId',
      ]) {
        const f = fixture(mode),
          check = f.run(true);
        assert.equal(check.status, 0, check.stderr);
        assert.match(check.stdout, /EXECUTION_31130_METADATA_CHECK_ONLY_READY/);
        assert.equal(existsSync(f.handoff), false);
        const original = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(original);
        const run = f.run();
        assert.equal(run.status, mode === 'execution31130Success' ? 0 : 1, run.stderr);
        assert.doesNotMatch(
          run.stdout + run.stderr,
          /SYNTHETIC_PRIVATE|synthetic-private|synthetic-n8n-key|unrelated-/,
        );
        const receipt = JSON.parse(run.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(original), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        if (mode === 'execution31130Success')
          assert.equal(receipt.inventory.status, 'execution_metadata_classified');
        else assert.equal(receipt.inventory, null);
      }
    });
    it('WF00 fixed read-only mode preserves the persistent Management original, closes children and rejects unsafe output', () => {
      for (const mode of ['wf00Success', 'wf00Unsafe', 'wf00BadBool']) {
        const f = fixture(mode),
          check = f.run(true);
        assert.equal(check.status, 0, check.stderr);
        assert.match(check.stdout, /WF00_EXECUTION_CHECK_ONLY_READY/);
        assert.equal(existsSync(f.handoff), false);
        const original = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(original);
        const run = f.run();
        assert.equal(run.status, mode === 'wf00Success' ? 0 : 1, run.stderr);
        assert.doesNotMatch(
          run.stdout + run.stderr,
          /SYNTHETIC_PRIVATE|synthetic-private|synthetic-n8n-key|unrelated-db-secret|unrelated-api-secret/,
        );
        const receipt = JSON.parse(run.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.equal(existsSync(f.handoff), false);
        assert.deepEqual(readFileSync(original), before);
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        if (mode === 'wf00Success') assert.equal(receipt.inventory.savedWorkflowVerified, true);
        else assert.equal(receipt.inventory, null);
      }
    });
    it('WF70 native public gate binds cumulative snapshots before any credential path and refuses a reused fence', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-wf70-public-'));
      roots.push(root);
      const put = (relative, text) => {
        const path = join(root, relative);
        mkdirSync(resolve(path, '..'), { recursive: true });
        writeFileSync(path, text);
        return path;
      };
      const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
      const snapshots = {};
      for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
        const path = 'scripts/n8n/out/foundation/live/' + name + '.jsonl';
        put(path, 'synthetic-public-snapshot\n');
        snapshots[name] = { path, sha256: hash('synthetic-public-snapshot\n') };
      }
      const closedPath = 'scripts/n8n/out/foundation/live/synthetic-technical6.closed.json';
      put(closedPath, 'synthetic-public-closed\n');
      const actual = {
        usage: { management: 152, control: 382, combined: 534 },
        actualCleanup: {
          bothProcessesDead: true,
          parentLockAbsent: true,
          persistentOriginalsUntouched: true,
        },
        actualPublicJournals: snapshots,
        immutableTechnicalRecords: {
          closed: { path: closedPath, sha256: hash('synthetic-public-closed\n') },
        },
      };
      const text = JSON.stringify(actual);
      put(
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json',
        text,
      );
      const stub = `function Assert-M03AcceptancePublicSeal([string]$Root,$Seal){return 'synthetic-reviewed-node.exe'}\n`;
      put('scripts/n8n/windows/Acceptance-PublicRuntime.ps1', stub);
      put(
        'scripts/n8n/foundation-acceptance-seal.json',
        JSON.stringify({ files: { 'scripts/n8n/windows/Acceptance-PublicRuntime.ps1': hash(stub) } }),
      );
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03N8nInventory.ps1'), 'utf8');
      const confined = source.slice(
        source.indexOf('function Confined-File'),
        source.indexOf('function Validate-Diagnostics'),
      );
      let helper = source.slice(
        source.indexOf('function Assert-Wf70DiscoveryPublic'),
        source.indexOf('function Validate-Inventory'),
      );
      // Replace ONLY the immutable receipt pin for this isolated synthetic
      // public fixture; actual source must retain its reviewed258a6c7 pin.
      assert.match(helper, /258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66/);
      helper = helper.replace('258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66', hash(text));
      const script = put(
        'public.ps1',
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo='${root.replaceAll("'", "''")}'
${confined}
${helper}
if((Assert-Wf70DiscoveryPublic) -cne 'synthetic-reviewed-node.exe'){throw 'blocked'}
$path=Join-Path $repo 'scripts/n8n/out/foundation/live/control.jsonl'
[IO.File]::WriteAllText($path,'changed');$blocked=$false;try{$null=Assert-Wf70DiscoveryPublic}catch{$blocked=$true};if(-not $blocked){throw 'blocked'}
[IO.File]::WriteAllText($path,"synthetic-public-snapshot\`n")
New-Wf70DiscoveryBudget
$blocked=$false;try{$null=Assert-Wf70DiscoveryPublic}catch{$blocked=$true};if(-not $blocked){throw 'blocked'}
$blocked=$false;try{New-Wf70DiscoveryBudget}catch{$blocked=$true};if(-not $blocked){throw 'blocked'}
$header=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl')))
if($header.managementAttempts -ne 152 -or $header.controlAttempts -ne 382 -or $header.combinedAttempts -ne 534 -or $header.maximumRequests -ne 4){throw 'blocked'}
Write-Output 'WF70_PUBLIC_GATE_PASS'
`,
      );
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
        env: osEnv(),
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'WF70_PUBLIC_GATE_PASS');
    });
    it('WF70 native projection refuses arbitrary fields, unknown classifications and non-numeric HTTP status', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-wf70-schema-'));
      roots.push(root);
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03N8nInventory.ps1'), 'utf8');
      const keys = source.slice(
        source.indexOf('function Assert-Keys'),
        source.indexOf('function Confined-File'),
      );
      const diagnostics = source.slice(
        source.indexOf('function Validate-Diagnostics'),
        source.indexOf('function Assert-Wf70DiscoveryPublic'),
      );
      const failure = {
        version: 1,
        workflowKey: 'WF-70',
        operation: 'discovery',
        stage: 'projection',
        classification: 'contract',
        code: 'METADATA',
        httpStatus: 200,
      };
      const valid = {
        version: 1,
        environment: 'dev',
        host: 'muhhammedsayed.app.n8n.cloud',
        projectId: 'pHvQjDmjxVZ3KQLT',
        workflowKey: 'WF-70',
        status: 'discovery_failed',
        transportAdapter: 'inventory_bounded_get_adapter',
        requestCount: 1,
        maximumRequests: 4,
        authenticationVerified: true,
        paginationComplete: false,
        candidateCount: null,
        adoptionProven: false,
        drainProven: false,
        readerFailure: failure,
        networkCompletionVerified: true,
        diagnostics: {
          version: 1,
          dns: 'complete',
          requests: [
            {
              resource: 'executions',
              page: 1,
              tcpConnected: true,
              tlsVerified: true,
              httpStatus: 200,
              bodyRead: 'complete',
              jsonParsed: true,
              schemaValidated: false,
              socketClosed: true,
              failureStage: 'schema',
              failureCode: 'invalid_schema',
            },
          ],
        },
      };
      const cases = [valid];
      for (const update of [
        { httpStatus: '200' },
        { stage: 'SYNTHETIC_PRIVATE_STAGE' },
        { classification: 'SYNTHETIC_PRIVATE_CLASS' },
        { workflowKey: 'WF-00' },
        { operation: 'metadata' },
        { code: 'SYNTHETIC_PRIVATE_CODE' },
        { message: 'SYNTHETIC_PRIVATE_MESSAGE' },
      ])
        cases.push({ ...valid, readerFailure: { ...failure, ...update } });
      for (const update of [
        { maximumRequests: 5 },
        { requestCount: 5 },
        { adoptionProven: true },
        { drainProven: true },
        { candidateCount: '0' },
        { extra: 'SYNTHETIC_PRIVATE_FIELD' },
      ])
        cases.push({ ...valid, ...update });
      const script = join(root, 'schema.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
$fixedHost='muhhammedsayed.app.n8n.cloud';$projectId='pHvQjDmjxVZ3KQLT'
${keys}
${diagnostics}
$cases=ConvertFrom-Json -InputObject '${JSON.stringify(cases).replaceAll("'", "''")}'
$out=@();foreach($value in $cases){try{Validate-Wf70Discovery $value;$out+=$true}catch{$out+=$false}};$out|ConvertTo-Json -Compress
`,
      );
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
        env: osEnv(),
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), [true, ...Array(cases.length - 1).fill(false)]);
      assert.doesNotMatch(r.stdout, /SYNTHETIC_PRIVATE/);
    });
    it('WF70 CheckOnly returns before any persistent metadata, budget journal or child', () => {
      const f = fixture('wf70Success'),
        r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /WF70_CHECK_ONLY_READY/);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(
        existsSync(join(f.root, 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl')),
        false,
      );
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), false);
    });
    for (const mode of ['wf70Success', 'wf70Http', 'wf70Unsafe'])
      it(`WF70 same consumer ${mode} isolates persistent Management and preserves one-use public budget`, () => {
        const f = fixture(mode);
        mkdirSync(join(f.root, 'scripts/n8n/out/foundation'), { recursive: true });
        const persistent = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(persistent);
        const r = f.run();
        assert.equal(r.status, mode === 'wf70Success' ? 0 : 1, r.stdout + r.stderr);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(persistent), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
        const header = JSON.parse(
          readFileSync(
            join(f.root, 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl'),
            'utf8',
          ),
        );
        assert.equal(header.managementAttempts, 152);
        assert.equal(header.controlAttempts, 382);
        assert.equal(header.combinedAttempts, 534);
        assert.equal(header.maximumRequests, 4);
        assert.equal(receipt.inventory === null, mode === 'wf70Unsafe');
        if (mode === 'wf70Http') assert.equal(receipt.inventory.readerFailure.httpStatus, 429);
        assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_PRIVATE|synthetic-n8n-key|unrelated-/);
        const repeated = f.run();
        assert.equal(repeated.status, 1);
        assert.match(repeated.stdout, /HANDOFF_PATH_BLOCKED/);
      });
    it('baseline CheckOnly validates public sources without materializing persistent credentials or a coordinator lock', () => {
      const f = fixture('baselineSuccess'),
        r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /BASELINE_CHECK_ONLY_READY/);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('Machine CheckOnly validates only public sources with no runtime copy, lock or child', () => {
      const f = fixture('machineSuccess'),
        r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /MACHINE_METADATA_CHECK_ONLY_READY/);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('Runtime reconciliation CheckOnly stops before credential initialization or a private child', () => {
      const f = fixture('runtimeSuccess'),
        r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /RUNTIME_RECONCILIATION_CHECK_ONLY_READY/);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    for (const mode of ['runtimeSuccess', 'runtimeHttp', 'runtimeUnsafe', 'runtimeBadBool', 'runtimeTimeout'])
      it(`Runtime reconciliation native consumer ${mode} preserves persistent Management and closes scoped children`, () => {
        const f = fixture(mode),
          persistent = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(persistent),
          r = f.run();
        assert.equal(r.status, mode === 'runtimeSuccess' ? 0 : 1, r.stdout + r.stderr);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(persistent), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
        if (['runtimeUnsafe', 'runtimeBadBool', 'runtimeTimeout'].includes(mode))
          assert.equal(receipt.inventory, null);
      });
    for (const mode of ['machineSuccess', 'machineHttp', 'machineUnsafe', 'machineBadBool', 'machineTimeout'])
      it(`Machine metadata consumer ${mode} retains persistent Management and suppresses all unreviewed output`, () => {
        const f = fixture(mode),
          persistent = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(persistent),
          r = f.run();
        assert.equal(r.status, mode === 'machineSuccess' ? 0 : 1, r.stdout + r.stderr);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.deepEqual(readFileSync(persistent), before);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
        if (mode === 'machineHttp') assert.equal(receipt.inventory.httpStatus, 405);
        if (['machineUnsafe', 'machineBadBool', 'machineTimeout'].includes(mode))
          assert.equal(receipt.inventory, null);
      });
    for (const mode of [
      'baselineSuccess',
      'baselineMismatch',
      'baselineUnsafe',
      'baselineTimeout',
      'baselineUnsafeForensics',
    ])
      it(`baseline one-GET consumer ${mode} uses only persistent Management and removes disposable state`, () => {
        const f = fixture(mode),
          persistent = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(persistent),
          r = f.run();
        assert.equal(
          r.status,
          ['baselineSuccess', 'baselineMismatch'].includes(mode) ? 0 : 1,
          r.stdout + r.stderr,
        );
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        assert.deepEqual(readFileSync(persistent), before);
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
        if (mode === 'baselineMismatch')
          assert.deepEqual(receipt.inventory.baseline.failedChecks, ['version_mismatch']);
        if (mode === 'baselineUnsafe' || mode === 'baselineTimeout' || mode === 'baselineUnsafeForensics')
          assert.equal(receipt.inventory, null);
      });
    it('baseline diagnostic refuses an existing acceptance mutex before materialization or a native child', () => {
      const f = fixture('baselineSuccess');
      const mutex = join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock');
      writeFileSync(mutex, 'synthetic-foreign-operation');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(readFileSync(mutex, 'utf8'), 'synthetic-foreign-operation');
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('unknown native closure retains disposable ciphertext and shared mutex rather than allowing overlapping admission', () => {
      const f = fixture('baselineUnknownClose'),
        r = f.run();
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.childClosed, false);
      assert.equal(receipt.handoffDeleted, false);
      assert.equal(existsSync(f.handoff), true);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), true);
      const again = f.run();
      assert.equal(again.status, 1);
      assert.match(again.stdout, /HANDOFF_PATH_BLOCKED/);
      assert.doesNotMatch(
        r.stdout + r.stderr + again.stdout + again.stderr,
        /synthetic-private|unrelated-|synthetic-n8n-key/,
      );
    });
    it('checks fixed public seals and presence without decrypting or launching inventory', () => {
      const f = fixture();
      const r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /CHECK_ONLY_READY/);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
      assert.ok(existsSync(f.handoff));
    });
    it('does not overwrite an existing new handoff', () => {
      const f = fixture();
      const before = readFileSync(f.handoff);
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', f.creator], {
        env: { ...osEnv(), LOCALAPPDATA: join(f.root, 'private') },
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(r.status, 1);
      assert.deepEqual(readFileSync(f.handoff), before);
    });
    it('rejects a changed source before private read', () => {
      const f = fixture();
      f.put('scripts/n8n/inventory.mjs', 'modified');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.ok(existsSync(f.handoff));
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('gives the child only its key, suppresses stderr, validates safe JSON and deletes consumed DPAPI', () => {
      const f = fixture();
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
      assert.equal(existsSync(f.handoff), false);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.inventory.status, 'complete');
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
    });
    it('accepts all25 exact canonical names through the actual Windows parser', () => {
      const f = fixture('all25');
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(JSON.parse(r.stdout).inventory.resources.workflows.known.length, 25);
    });
    it('preserves safe completed auth/project stages and a bounded workflow body-failure diagnostic', () => {
      const f = fixture('workflowBodyFailure');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = JSON.parse(r.stdout.trim());
      assert.equal(receipt.status, 'inventory_failed');
      assert.equal(receipt.inventory.authenticationVerified, true);
      assert.equal(receipt.inventory.resources.projects.httpStatus, 200);
      assert.equal(receipt.inventory.diagnostics.requests[2].failureCode, 'body_aborted');
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
    });
    it('rejects non-allowlisted diagnostic text without exposing it and still deletes consumed credentials', () => {
      const f = fixture('unsafeDiagnostics');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = JSON.parse(r.stdout.trim());
      assert.equal(receipt.inventory, null);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private/);
    });
    it('accepts allfive exact authorized credential ID/name/type triples including native Apify and OpenAI', () => {
      const f = fixture('nativeProviders'),
        r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.inventory.resources.credentials.known.length, 5);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
    });
    for (const mode of [
      'badJson',
      'unsafeSchema',
      'failure',
      'timeout',
      'reflectedKey',
      'failedStart',
      'wrongNativeType',
      'wrongCandidateName',
      'wrongCandidateId',
    ])
      it(`suppresses ${mode} child output, closes it and cleans consumed credentials`, () => {
        const f = fixture(mode);
        const r = f.run();
        assert.equal(r.status, 1);
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|synthetic-n8n-key|unrelated-/);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.equal(receipt.inventory, null);
        assert.equal(existsSync(f.handoff), false);
      });
  },
);
