import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import * as runtime from './foundation-live-runtime.mjs';
import { assertFoundationLiveSetupTransport } from './foundation-live-setup-transport.mjs';
import { assertFoundationRemainingSetupResume } from './foundation-live-remaining-continuation.mjs';
import { assertFoundationStartupReplacementSetupResume } from './foundation-live-startup-replacement.mjs';
import {
  assertFoundationProjectVerifiedContinuationSetupResume,
  foundationProjectVerifiedContinuationResumeCheckpoint,
  foundationProjectVerifiedContinuationRequestCaps,
  foundationProjectVerifiedSetupJournalMaximumRows,
  foundationProjectVerifiedTechnical17Runtime,
  foundationProjectVerifiedTechnical20Runtime,
} from './foundation-live-project-verified-continuation.mjs';

// Only the approved dev project's seven temporary branch entries and one new
// sole/default bypass are mutable under the 23 October named M03 exception.
// Native workflow/API/SQL work is elsewhere; no GW-01 token/scope is reused.
export const foundationLiveSetupScope = Object.freeze({
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  branch: 'm03-n8n-foundation',
  org: 'muhhammeddsayedd-prog',
  repo: 'Everyone-Market-Researcher',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
});
const S = foundationLiveSetupScope,
  maximum = 50,
  cleanupReserve = 18;
const fail = () => {
  throw Error('FOUNDATION_LIVE_SETUP_BLOCKED');
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && isDeepStrictEqual(Object.keys(v).sort(), [...keys].sort());
const freeze = (v) => {
  if (v && typeof v === 'object') {
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  }
  return v;
};
export function foundationLiveSetupRequestPlan(previousAttempts, maximumRequests = maximum) {
  if (
    ![50, 88, 132, 176, 224, 256, 304].includes(maximumRequests) ||
    !Number.isInteger(previousAttempts) ||
    previousAttempts < 0 ||
    previousAttempts > maximumRequests
  )
    fail();
  // Fourteen fixed preparation requests include the final protected-project
  // readback. All eighteen restoration requests remain reserved separately.
  const buildPollLimit = Math.max(0, Math.min(12, maximumRequests - previousAttempts - 14 - cleanupReserve));
  return freeze({
    previousAttempts,
    buildPollLimit,
    maximumNewPrepareRequests: 14 + buildPollLimit,
    cleanupReserve,
    maximumRequests,
  });
}
const sync = (fn, value) => {
  let result;
  try {
    result = fn(value);
  } catch {
    fail();
  }
  if (result !== undefined) {
    if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
    fail();
  }
};
const journals = new WeakSet(),
  deployments = new WeakSet(),
  resumedProofs = new WeakSet();
const eventKeys = new Set([
  'event',
  'kind',
  'key',
  'id',
  'ordinal',
  'at',
  'createdAt',
  'updatedAt',
  'gitBranch',
  'type',
  'target',
  'comment',
  'deploymentId',
  'audience',
  'state',
  'unresolved',
  'sourceCommitSha',
  'soleOwnedDefaultVerified',
  'nonDefaultVerified',
  'observedDefaultFlag',
]);
const envKeys = Object.freeze([
  'EMR_M03_FOUNDATION_ENABLED',
  'EMR_M03_FOUNDATION_WINDOW_ID',
  'EMR_M03_FOUNDATION_WRITER_PASSWORD',
  'EMR_M03_FOUNDATION_APIFY_READ_TOKEN',
  'EMR_M03_FOUNDATION_TOKEN_SHA256',
  'EMR_M03_FOUNDATION_AUDIENCE',
  'EMR_M03_FOUNDATION_COMMIT_SHA',
]);
export function createFoundationLiveSetupJournal({
  sourceCommitSha,
  durableAppend,
  previousEvents = [],
  maximumRequests = maximum,
}) {
  if (
    ![50, 88, 132, 176, 224, 256, 304].includes(maximumRequests) ||
    !/^[a-f0-9]{40}$/.test(sourceCommitSha) ||
    typeof durableAppend !== 'function' ||
    !Array.isArray(previousEvents) ||
    previousEvents.length > foundationProjectVerifiedSetupJournalMaximumRows
  )
    fail();
  const rows = [];
  let failed = false,
    ordinal = 0;
  const check = (row) => {
    if (
      !object(row) ||
      Object.keys(row).some((k) => !eventKeys.has(k)) ||
      typeof row.event !== 'string' ||
      !/^setup_(?:attempt|intent|ack|verified|unknown|cleanup_intent|cleanup_ack|cleanup_absent|cleanup_unknown)$/.test(
        row.event,
      ) ||
      JSON.stringify(row).length > 8192
    )
      fail();
    const meta = ['id', 'key', 'type', 'target', 'gitBranch', 'comment', 'createdAt', 'updatedAt'];
    const common = ['event', 'kind', 'at'];
    const expected =
      row.event === 'setup_attempt'
        ? ['event', 'ordinal', 'kind', 'at']
        : row.event === 'setup_ack' && row.kind === 'environment'
          ? ['event', 'kind', ...meta]
          : ['setup_ack', 'setup_verified'].includes(row.event) && row.kind === 'deployment'
            ? [...common, 'deploymentId', 'audience']
            : row.event === 'setup_verified' && row.kind === 'bypass'
              ? [
                  ...common,
                  'createdAt',
                  'soleOwnedDefaultVerified',
                  'nonDefaultVerified',
                  'observedDefaultFlag',
                ]
              : row.event === 'setup_intent' && row.kind === 'environment'
                ? [...common, 'key']
                : row.event.startsWith('setup_cleanup_') && row.kind === 'environment'
                  ? [...common, 'id', 'key']
                  : common;
    if (
      !exact(row, expected) ||
      !['environment', 'bypass', 'deployment', 'GET', 'POST', 'PATCH', 'DELETE'].includes(row.kind)
    )
      fail();
    if (row.event === 'setup_attempt') {
      if (
        row.ordinal !== ordinal + 1 ||
        row.ordinal > maximumRequests ||
        !['GET', 'POST', 'PATCH', 'DELETE'].includes(row.kind)
      )
        fail();
      ordinal++;
    } else if (!['environment', 'bypass', 'deployment'].includes(row.kind)) fail();
    if (Object.hasOwn(row, 'at') && (!Number.isSafeInteger(row.at) || row.at < 0)) fail();
    if (Object.hasOwn(row, 'key') && !envKeys.includes(row.key)) fail();
    if (
      row.event === 'setup_verified' &&
      row.kind === 'bypass' &&
      (row.soleOwnedDefaultVerified !== true ||
        row.nonDefaultVerified !== false ||
        !['true', 'omitted'].includes(row.observedDefaultFlag) ||
        !Number.isFinite(row.createdAt))
    )
      fail();
    if (Object.hasOwn(row, 'id') && (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id)))
      fail();
    if (
      Object.hasOwn(row, 'type') &&
      (row.type !== 'sensitive' ||
        row.gitBranch !== S.branch ||
        !isDeepStrictEqual(row.target, ['preview']) ||
        ![
          'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
          '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
          'eda4fae1-1e19-47db-81b8-beac1a4ed883',
          '3c46c791-e140-4eb9-890a-eecfa251f65e',
          '4c602549-2c42-4ec3-9328-714d7cb66a77',
          foundationProjectVerifiedTechnical17Runtime.windowId,
          foundationProjectVerifiedTechnical20Runtime.windowId,
        ].some((id) => row.comment === 'M03 foundation temporary dev ' + id) ||
        !Number.isFinite(row.createdAt) ||
        !Number.isFinite(row.updatedAt))
    )
      fail();
    if (
      Object.hasOwn(row, 'deploymentId') &&
      (!/^dpl_[A-Za-z0-9]{1,80}$/.test(row.deploymentId) ||
        !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(row.audience))
    )
      fail();
    return freeze(structuredClone(row));
  };
  for (const row of previousEvents) rows.push(check(row));
  const journal = Object.freeze({
    sourceCommitSha,
    maximumRequests,
    get rows() {
      return Object.freeze([...rows]);
    },
    append(row) {
      if (failed || rows.length >= foundationProjectVerifiedSetupJournalMaximumRows) fail();
      const copy = check(row);
      try {
        sync(durableAppend, copy);
        rows.push(copy);
      } catch {
        failed = true;
        fail();
      }
    },
  });
  journals.add(journal);
  return journal;
}
export function assertFoundationLiveDeployment(value) {
  if (!deployments.has(value)) fail();
  return value;
}
export function createFoundationLiveSetup(input, dependencies = {}) {
  const { sourceCommitSha, transport, journal, managementBudget, verifyDevReady } = input;
  const activeWindowId = input.activeWindowId ?? S.windowId;
  if (
    ![
      S.windowId,
      '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      'eda4fae1-1e19-47db-81b8-beac1a4ed883',
      '3c46c791-e140-4eb9-890a-eecfa251f65e',
      '4c602549-2c42-4ec3-9328-714d7cb66a77',
      foundationProjectVerifiedTechnical17Runtime.windowId,
      foundationProjectVerifiedTechnical20Runtime.windowId,
    ].includes(activeWindowId)
  )
    fail();
  const now = input.now ?? Date.now,
    pause = input.pause;
  if (
    !/^[a-f0-9]{40}$/.test(sourceCommitSha) ||
    !journals.has(journal) ||
    journal.sourceCommitSha !== sourceCommitSha ||
    typeof now !== 'function' ||
    typeof pause !== 'function' ||
    typeof verifyDevReady !== 'function' ||
    !Number.isFinite(input.deadlineAt) ||
    input.deadlineAt <= now() ||
    input.deadlineAt > now() + 3600000
  )
    fail();
  (dependencies.transportValidator ?? assertFoundationLiveSetupTransport)(transport);
  (dependencies.managementBudgetValidator ?? runtime.assertFoundationLiveManagementBudget)(managementBudget, {
    sourceCommitSha,
    deadlineAt: input.deadlineAt,
  });
  if (typeof managementBudget.attachTransport !== 'function') fail();
  managementBudget.attachTransport(transport);
  if (!exact(input.sensitive, ['writerPassword', 'machineToken', 'apifyReadToken', 'protectionBypass']))
    fail();
  let sensitive = { ...input.sensitive };
  if (
    typeof sensitive.writerPassword !== 'string' ||
    !sensitive.writerPassword ||
    sensitive.writerPassword.length > 4096 ||
    typeof sensitive.apifyReadToken !== 'string' ||
    !sensitive.apifyReadToken ||
    sensitive.apifyReadToken.length > 4096 ||
    !/^[A-Za-z0-9_-]{43}$/.test(sensitive.machineToken) ||
    !/^[A-Za-z0-9]{32}$/.test(sensitive.protectionBypass)
  )
    fail();
  const tokenVerifier = createHash('sha256').update(sensitive.machineToken).digest('hex');
  const denied = [...Object.values(sensitive), tokenVerifier];
  const comment = 'M03 foundation temporary dev ' + activeWindowId;
  const projectPath = '/v9/projects/' + S.projectId + '?teamId=' + S.teamId;
  const envPath = '/v10/projects/' + S.projectId + '/env?decrypt=false&teamId=' + S.teamId;
  const createEnvPath = '/v10/projects/' + S.projectId + '/env?teamId=' + S.teamId;
  const bypassPath = '/v1/projects/' + S.projectId + '/protection-bypass?teamId=' + S.teamId;
  const deployPath = '/v13/deployments?forceNew=1&teamId=' + S.teamId;
  const originals = [],
    unresolved = new Set(),
    deleteAttempted = new Set(),
    seenEnvironmentIds = new Set(),
    environmentCleanup = new Map();
  let pendingEnvironmentCleanup = null;
  if (
    [
      input.remainingContinuationProof,
      input.startupReplacementProof,
      input.projectVerifiedContinuationProof,
    ].filter((p) => p !== undefined).length > 1
  )
    fail();
  const resumeProof =
    input.projectVerifiedContinuationProof ??
    input.startupReplacementProof ??
    input.remainingContinuationProof;
  const resumeAssert =
    input.projectVerifiedContinuationProof !== undefined
      ? assertFoundationProjectVerifiedContinuationSetupResume
      : input.startupReplacementProof === undefined
        ? assertFoundationRemainingSetupResume
        : assertFoundationStartupReplacementSetupResume;
  const resumed =
    resumeProof === undefined
      ? false
      : !!resumeAssert(resumeProof, {
          sourceCommitSha,
          deadlineAt: input.deadlineAt,
          previousEvents: journal.rows,
        });
  if (resumed) {
    if (resumedProofs.has(resumeProof)) fail();
    resumedProofs.add(resumeProof);
  }
  const resumeCheckpoint =
    input.projectVerifiedContinuationProof === undefined
      ? null
      : foundationProjectVerifiedContinuationResumeCheckpoint(input.projectVerifiedContinuationProof);
  const requestMaximum = resumeCheckpoint?.setupMaximum ?? maximum;
  const legacyMetadataReplay =
    resumed && resumeCheckpoint?.closedWindow === true && activeWindowId !== S.windowId;
  const historicalWindowIds = legacyMetadataReplay
    ? (resumeCheckpoint.historicalWindowIds ?? Object.freeze([S.windowId]))
    : Object.freeze([]);
  const expectedHistoricalWindowIds =
    activeWindowId === foundationProjectVerifiedTechnical20Runtime.windowId
      ? [
          S.windowId,
          '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
          'eda4fae1-1e19-47db-81b8-beac1a4ed883',
          '3c46c791-e140-4eb9-890a-eecfa251f65e',
          '4c602549-2c42-4ec3-9328-714d7cb66a77',
          foundationProjectVerifiedTechnical17Runtime.windowId,
        ]
      : activeWindowId === foundationProjectVerifiedTechnical17Runtime.windowId
        ? [
            S.windowId,
            '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
            'eda4fae1-1e19-47db-81b8-beac1a4ed883',
            '3c46c791-e140-4eb9-890a-eecfa251f65e',
            '4c602549-2c42-4ec3-9328-714d7cb66a77',
          ]
        : activeWindowId === '4c602549-2c42-4ec3-9328-714d7cb66a77'
          ? [
              S.windowId,
              '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
              'eda4fae1-1e19-47db-81b8-beac1a4ed883',
              '3c46c791-e140-4eb9-890a-eecfa251f65e',
            ]
          : activeWindowId === '3c46c791-e140-4eb9-890a-eecfa251f65e'
            ? [S.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc', 'eda4fae1-1e19-47db-81b8-beac1a4ed883']
            : activeWindowId === 'eda4fae1-1e19-47db-81b8-beac1a4ed883'
              ? [S.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc']
              : [S.windowId];
  if (
    journal.maximumRequests !== requestMaximum ||
    (activeWindowId !== S.windowId && !resumeCheckpoint?.closedWindow) ||
    (resumeCheckpoint?.closedWindow && resumeCheckpoint.activeWindowId !== activeWindowId) ||
    (requestMaximum === 132 &&
      (![640, 704].includes(resumeCheckpoint?.managementMaximum) ||
        activeWindowId !== 'eda4fae1-1e19-47db-81b8-beac1a4ed883')) ||
    (requestMaximum === 176 &&
      (resumeCheckpoint?.managementMaximum !== 832 ||
        activeWindowId !== '3c46c791-e140-4eb9-890a-eecfa251f65e')) ||
    (resumeCheckpoint?.managementMaximum === 832 && requestMaximum !== 176) ||
    (requestMaximum === 224 &&
      (resumeCheckpoint?.managementMaximum !== 1024 ||
        activeWindowId !== '4c602549-2c42-4ec3-9328-714d7cb66a77')) ||
    (resumeCheckpoint?.managementMaximum === 1024 && requestMaximum !== 224) ||
    (requestMaximum === 256 &&
      (resumeCheckpoint?.managementMaximum !== 1408 ||
        activeWindowId !== foundationProjectVerifiedTechnical17Runtime.windowId ||
        sourceCommitSha !== foundationProjectVerifiedTechnical17Runtime.sourceCommitSha ||
        foundationProjectVerifiedContinuationRequestCaps(input.projectVerifiedContinuationProof).control !==
          3456)) ||
    (resumeCheckpoint?.managementMaximum === 1408 && requestMaximum !== 256) ||
    (requestMaximum === 304 &&
      (resumeCheckpoint?.managementMaximum !== 1728 ||
        activeWindowId !== foundationProjectVerifiedTechnical20Runtime.windowId ||
        sourceCommitSha !== foundationProjectVerifiedTechnical20Runtime.sourceCommitSha ||
        foundationProjectVerifiedContinuationRequestCaps(input.projectVerifiedContinuationProof).control !==
          3584 ||
        foundationProjectVerifiedContinuationRequestCaps(input.projectVerifiedContinuationProof).combined !==
          5312)) ||
    (resumeCheckpoint?.managementMaximum === 1728 && requestMaximum !== 304) ||
    (legacyMetadataReplay &&
      (!Array.isArray(historicalWindowIds) ||
        !Object.isFrozen(historicalWindowIds) ||
        !isDeepStrictEqual(historicalWindowIds, expectedHistoricalWindowIds)))
  )
    fail();
  let started = journal.rows.length > 0 && !resumed,
    busy = false,
    closed = false,
    failed = false,
    stopping = false,
    attempts = journal.rows.filter((r) => r.event === 'setup_attempt').length;
  let nextRequest = null,
    bypassOwned = false,
    bypassRevokeAttempted = false,
    proof = null,
    deploymentIntentAt = null,
    prerequisiteCode = null,
    bypassIntentAt = null,
    ownedBypassCreatedAt = null,
    soleOwnedDefaultVerified = false,
    buildPollLimit = 0;
  const safe = (row) => {
    const text = JSON.stringify(row);
    if (denied.some((s) => text.includes(s))) fail();
    return row;
  };
  const emit = (row) => journal.append(safe(row));
  function deadline() {
    if (closed || !sensitive || now() >= input.deadlineAt) fail();
  }
  async function request(method, path, body, cleanup = false) {
    deadline();
    if (attempts >= requestMaximum || (!cleanup && attempts >= requestMaximum - cleanupReserve)) fail();
    const signal = AbortSignal.timeout(Math.max(1, Math.min(20000, input.deadlineAt - now())));
    const spec = { method, path, signal, ...(body === undefined ? {} : { body }) };
    sync(managementBudget.admit, { host: 'api.vercel.com', method, path });
    emit({ event: 'setup_attempt', ordinal: ++attempts, kind: method, at: now() });
    nextRequest = spec;
    try {
      const response = await transport.request(spec);
      if (!response || response.closed !== true || !Number.isInteger(response.status)) fail();
      return response;
    } catch {
      fail();
    } finally {
      nextRequest = null;
    }
  }
  function project(dto, own = false, cleanup = false) {
    if (
      !object(dto) ||
      dto.id !== S.projectId ||
      dto.accountId !== S.teamId ||
      dto.rootDirectory !== 'apps/web' ||
      dto.nodeVersion !== '24.x' ||
      dto.framework !== 'nextjs' ||
      dto.link?.type !== 'github' ||
      dto.link.org !== S.org ||
      dto.link.repo !== S.repo ||
      dto.ssoProtection?.deploymentType !== 'all_except_custom_domains'
    )
      fail();
    const map = dto.protectionBypass;
    if (!object(map)) fail();
    const keys = Object.keys(map);
    if (own) {
      if (keys.length !== 1 || keys[0] !== sensitive.protectionBypass) fail();
      checkBypass(map[sensitive.protectionBypass], cleanup);
    } else if (keys.length !== 0) fail();
  }
  function checkBypass(row, cleanup = false) {
    if (
      !object(row) ||
      row.scope !== 'automation-bypass' ||
      row.note !== comment ||
      (Object.hasOwn(row, 'isEnvVar') &&
        (cleanup ? typeof row.isEnvVar !== 'boolean' : row.isEnvVar !== true)) ||
      !Number.isFinite(row.createdAt) ||
      (ownedBypassCreatedAt !== null && row.createdAt !== ownedBypassCreatedAt)
    )
      fail();
  }
  function metadata(row, historical = false) {
    if (
      !object(row) ||
      typeof row.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
      !envKeys.includes(row.key) ||
      row.type !== 'sensitive' ||
      !isDeepStrictEqual(row.target, ['preview']) ||
      row.gitBranch !== S.branch ||
      (row.comment !== comment &&
        !(
          historical &&
          legacyMetadataReplay &&
          historicalWindowIds.some((id) => row.comment === 'M03 foundation temporary dev ' + id)
        )) ||
      !Number.isFinite(row.createdAt) ||
      !Number.isFinite(row.updatedAt) ||
      row.decrypted === true
    )
      fail();
    return {
      id: row.id,
      key: row.key,
      type: row.type,
      target: ['preview'],
      gitBranch: row.gitBranch,
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
  function list(dto) {
    if (!object(dto) || !Array.isArray(dto.envs) || dto.envs.length > 1000 || dto.pagination?.next) fail();
    return dto.envs;
  }
  async function envs(cleanup = false) {
    const r = await request('GET', envPath, undefined, cleanup);
    if (r.status !== 200) fail();
    return list(r.data);
  }
  function deployment(dto) {
    if (
      !object(dto) ||
      !/^dpl_[A-Za-z0-9]{1,80}$/.test(dto.id) ||
      dto.projectId !== S.projectId ||
      dto.target !== null ||
      typeof dto.url !== 'string' ||
      !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(dto.url) ||
      dto.meta?.githubCommitSha !== sourceCommitSha ||
      dto.meta?.githubCommitRef !== S.branch ||
      !Number.isFinite(dto.createdAt) ||
      deploymentIntentAt === null ||
      dto.createdAt < deploymentIntentAt - 30000 ||
      dto.createdAt > now() + 30000
    )
      fail();
    return { deploymentId: dto.id, audience: 'https://' + dto.url, readyState: dto.readyState };
  }
  // Replay only allowlisted durable provenance. A create without its ACK remains
  // unknown; a DELETE without verified absence is never submitted again.
  for (const row of journal.rows) {
    safe(row);
    if (row.event === 'setup_attempt' && pendingEnvironmentCleanup !== null) {
      const cleanup = environmentCleanup.get(pendingEnvironmentCleanup);
      if (row.kind === 'DELETE') {
        if (cleanup.deleted) fail();
        cleanup.deleted = true;
      } else if (row.kind === 'GET' && cleanup.deleted) cleanup.readback = true;
    } else if (row.event === 'setup_intent') {
      unresolved.add(row.kind === 'environment' ? 'create:' + row.key : row.kind + '_create');
    } else if (row.event === 'setup_ack') {
      unresolved.delete(row.kind === 'environment' ? 'create:' + row.key : row.kind + '_create');
      if (row.kind === 'environment') {
        const item = metadata(row, true);
        if (seenEnvironmentIds.has(item.id) || originals.some((e) => e.key === item.key)) fail();
        seenEnvironmentIds.add(item.id);
        originals.push(item);
      } else if (row.kind === 'bypass') bypassOwned = true;
    } else if (row.event === 'setup_verified' && row.kind === 'bypass') {
      if (!bypassOwned) fail();
      ownedBypassCreatedAt = row.createdAt;
      soleOwnedDefaultVerified = true;
    } else if (row.event === 'setup_cleanup_intent' || row.event === 'setup_cleanup_unknown') {
      if (row.kind === 'environment') {
        const item = originals.find((e) => e.id === row.id && e.key === row.key);
        if (!item) fail();
        if (row.event === 'setup_cleanup_intent') {
          if (pendingEnvironmentCleanup !== null || environmentCleanup.has(row.id)) fail();
          environmentCleanup.set(row.id, { key: row.key, deleted: false, readback: false });
          pendingEnvironmentCleanup = row.id;
        } else if (pendingEnvironmentCleanup === row.id) pendingEnvironmentCleanup = null;
        deleteAttempted.add(row.id);
        unresolved.add('delete:' + row.id);
      } else if (row.kind === 'bypass') {
        bypassRevokeAttempted = true;
        unresolved.add('bypass_revoke');
      }
    } else if (row.event === 'setup_cleanup_absent') {
      if (row.kind === 'environment') {
        const index = originals.findIndex((e) => e.id === row.id && e.key === row.key),
          cleanup = environmentCleanup.get(row.id);
        if (
          index < 0 ||
          pendingEnvironmentCleanup !== row.id ||
          cleanup?.key !== row.key ||
          cleanup.deleted !== true ||
          cleanup.readback !== true
        )
          fail();
        originals.splice(index, 1);
        environmentCleanup.delete(row.id);
        pendingEnvironmentCleanup = null;
        deleteAttempted.add(row.id);
        unresolved.delete('delete:' + row.id);
      } else if (row.kind === 'bypass') {
        bypassRevokeAttempted = true;
        bypassOwned = false;
        unresolved.delete('bypass_revoke');
      }
    }
  }
  if (resumed) {
    // The branded resume assertion above pins the fully revoked prior bypass
    // and exact journals. Its historical revoke fence must not suppress the
    // one new owned entry's cleanup; no unresolved/active resource is adopted.
    if (unresolved.size || bypassOwned || originals.length) fail();
    bypassRevokeAttempted = false;
    ownedBypassCreatedAt = null;
    soleOwnedDefaultVerified = false;
  }
  const exclusive = async (fn) => {
    if (busy || closed) fail();
    busy = true;
    try {
      return await fn();
    } catch {
      failed = true;
      fail();
    } finally {
      busy = false;
    }
  };
  return Object.freeze({
    authorizeRequest(spec) {
      return spec === nextRequest;
    },
    prepare() {
      return exclusive(async () => {
        if (started || failed || stopping) fail();
        started = true;
        buildPollLimit = foundationLiveSetupRequestPlan(attempts, requestMaximum).buildPollLimit;
        if (buildPollLimit < 1) fail();
        const sharedBudget = managementBudget.snapshot(),
          sharedAttempts = sharedBudget.attempts,
          sharedMaximum = sharedBudget.maximum ?? 512;
        if (
          ![512, 576, 640, 704, 832, 1024, 1408, 1728].includes(sharedMaximum) ||
          (sharedMaximum !== 512 && resumeCheckpoint?.managementMaximum !== sharedMaximum) ||
          !Number.isInteger(sharedAttempts) ||
          sharedAttempts < 0 ||
          sharedAttempts + 45 + 135 + 142 > sharedMaximum
        )
          fail();
        const ready = await verifyDevReady();
        if (
          !object(ready) ||
          ready.projectRef !== S.projectRef ||
          ready.migrationCount !== (activeWindowId === S.windowId ? 14 : 15) ||
          ready.ready !== true
        )
          fail();
        // verifyDevReady is the trusted actual subprocess/postcheck port, not a
        // caller boolean. Shape validation here does not manufacture DB evidence.
        let r = await request('GET', projectPath);
        if (r.status !== 200) fail();
        project(r.data);
        // The approved 23 October exception permits exactly one newly owned
        // default. The verified empty map above forbids adopting or modifying
        // another entry; generation never changes default-selection flags.
        if ((await envs()).some((e) => envKeys.includes(e.key))) fail();
        bypassIntentAt = now();
        emit({ event: 'setup_intent', kind: 'bypass', at: now() });
        unresolved.add('bypass_create');
        r = await request('PATCH', bypassPath, {
          generate: { secret: sensitive.protectionBypass, note: comment },
        });
        if (
          r.status !== 200 ||
          !object(r.data.protectionBypass) ||
          Object.keys(r.data.protectionBypass).length !== 1 ||
          !object(r.data.protectionBypass[sensitive.protectionBypass]) ||
          r.data.protectionBypass[sensitive.protectionBypass].note !== comment
        )
          fail();
        // The API treats omitted isEnvVar as default. Keep that distinction in
        // the public receipt; never normalize it into a non-default claim.
        // Establish ownership independently of acceptance. An explicit false
        // default fails preparation below, but its acknowledged owned entry
        // must remain eligible for exact cleanup rather than be orphaned.
        checkBypass(r.data.protectionBypass?.[sensitive.protectionBypass], true);
        ownedBypassCreatedAt = r.data.protectionBypass[sensitive.protectionBypass].createdAt;
        if (ownedBypassCreatedAt < bypassIntentAt - 30000 || ownedBypassCreatedAt > now() + 30000) fail();
        bypassOwned = true;
        unresolved.delete('bypass_create');
        emit({ event: 'setup_ack', kind: 'bypass', at: now() });
        checkBypass(r.data.protectionBypass[sensitive.protectionBypass]);
        r = await request('GET', projectPath);
        if (r.status !== 200) fail();
        project(r.data, true);
        soleOwnedDefaultVerified = true;
        emit({
          event: 'setup_verified',
          kind: 'bypass',
          at: now(),
          createdAt: ownedBypassCreatedAt,
          soleOwnedDefaultVerified: true,
          nonDefaultVerified: false,
          observedDefaultFlag: Object.hasOwn(r.data.protectionBypass[sensitive.protectionBypass], 'isEnvVar')
            ? 'true'
            : 'omitted',
        });
        const values = [
          'true',
          activeWindowId,
          sensitive.writerPassword,
          sensitive.apifyReadToken,
          tokenVerifier,
          'vercel-deployment',
          sourceCommitSha,
        ];
        for (let i = 0; i < envKeys.length; i++) {
          const key = envKeys[i];
          emit({ event: 'setup_intent', kind: 'environment', key, at: now() });
          unresolved.add('create:' + key);
          r = await request('POST', createEnvPath, {
            key,
            value: values[i],
            type: 'sensitive',
            target: ['preview'],
            gitBranch: S.branch,
            comment,
          });
          if (
            ![200, 201].includes(r.status) ||
            !object(r.data) ||
            !Array.isArray(r.data.failed) ||
            r.data.failed.length
          )
            fail();
          const item = metadata(r.data.created);
          if (item.key !== key || seenEnvironmentIds.has(item.id)) fail();
          seenEnvironmentIds.add(item.id);
          originals.push(item);
          unresolved.delete('create:' + key);
          emit({ event: 'setup_ack', kind: 'environment', ...item });
        }
        const saved = await envs();
        for (const expected of originals) {
          const matches = saved.filter((e) => e.id === expected.id);
          if (matches.length !== 1 || !isDeepStrictEqual(metadata(matches[0]), expected)) fail();
        }
        deploymentIntentAt = now();
        emit({ event: 'setup_intent', kind: 'deployment', at: deploymentIntentAt });
        unresolved.add('deployment_create');
        r = await request('POST', deployPath, {
          name: 'everyone-market-researcher',
          project: S.projectId,
          gitSource: { type: 'github', org: S.org, repo: S.repo, ref: S.branch, sha: sourceCommitSha },
          meta: { emrM03Window: activeWindowId },
        });
        if (![200, 201].includes(r.status)) fail();
        let current = deployment(r.data);
        unresolved.delete('deployment_create');
        emit({
          event: 'setup_ack',
          kind: 'deployment',
          deploymentId: current.deploymentId,
          audience: current.audience,
          at: now(),
        });
        for (let i = 0; i < buildPollLimit; i++) {
          r = await request('GET', '/v13/deployments/' + current.deploymentId + '?teamId=' + S.teamId);
          if (r.status !== 200) fail();
          const actual = deployment(r.data);
          if (actual.deploymentId !== current.deploymentId || actual.audience !== current.audience) fail();
          current = actual;
          if (current.readyState === 'READY') break;
          if (
            !['QUEUED', 'INITIALIZING', 'BUILDING'].includes(current.readyState) ||
            i === buildPollLimit - 1
          )
            fail();
          await pause(15000);
          deadline();
        }
        r = await request('GET', projectPath);
        if (r.status !== 200) fail();
        project(r.data, true);
        proof = freeze(
          safe({
            version: 1,
            projectId: S.projectId,
            branch: S.branch,
            sourceCommitSha,
            deploymentId: current.deploymentId,
            audience: current.audience,
            environment: 'preview',
            readyState: 'READY',
            protection: 'all_except_custom_domains',
            protectionVerified: true,
            protectionTransportVerified: false,
            sqlAudienceBindingVerified: false,
          }),
        );
        emit({
          event: 'setup_verified',
          kind: 'deployment',
          deploymentId: proof.deploymentId,
          audience: proof.audience,
          at: now(),
        });
        deployments.add(proof);
        return proof;
      });
    },
    cleanup() {
      return exclusive(async () => {
        stopping = true;
        let currentEnvRows;
        if (originals.some((e) => !deleteAttempted.has(e.id))) {
          try {
            currentEnvRows = await envs(true);
          } catch {
            for (const expected of originals) unresolved.add('delete:' + expected.id);
          }
        }
        for (const expected of originals) {
          if (deleteAttempted.has(expected.id)) continue;
          try {
            if (!currentEnvRows) fail();
            const matches = currentEnvRows.filter((e) => e.id === expected.id);
            if (matches.length !== 1 || !isDeepStrictEqual(metadata(matches[0]), expected)) fail();
            emit({
              event: 'setup_cleanup_intent',
              kind: 'environment',
              id: expected.id,
              key: expected.key,
              at: now(),
            });
            deleteAttempted.add(expected.id);
            unresolved.add('delete:' + expected.id);
            let acknowledged = false;
            try {
              const r = await request(
                'DELETE',
                '/v9/projects/' + S.projectId + '/env/' + expected.id + '?teamId=' + S.teamId,
                undefined,
                true,
              );
              acknowledged = r.status === 200 || r.status === 204;
            } catch {}
            currentEnvRows = await envs(true);
            const absent = !currentEnvRows.some((e) => e.id === expected.id);
            if (!acknowledged || !absent) fail();
            unresolved.delete('delete:' + expected.id);
            emit({
              event: 'setup_cleanup_absent',
              kind: 'environment',
              id: expected.id,
              key: expected.key,
              at: now(),
            });
          } catch {
            unresolved.add('delete:' + expected.id);
            emit({
              event: 'setup_cleanup_unknown',
              kind: 'environment',
              id: expected.id,
              key: expected.key,
              at: now(),
            });
          }
        }
        if (bypassOwned && !bypassRevokeAttempted) {
          try {
            let r = await request('GET', projectPath, undefined, true);
            if (r.status !== 200) fail();
            project(r.data, true, true);
            emit({ event: 'setup_cleanup_intent', kind: 'bypass', at: now() });
            bypassRevokeAttempted = true;
            unresolved.add('bypass_revoke');
            r = await request(
              'PATCH',
              bypassPath,
              { revoke: { secret: sensitive.protectionBypass, regenerate: false } },
              true,
            );
            if (r.status !== 200) fail();
            r = await request('GET', projectPath, undefined, true);
            if (r.status !== 200) fail();
            project(r.data);
            unresolved.delete('bypass_revoke');
            bypassOwned = false;
            emit({ event: 'setup_cleanup_absent', kind: 'bypass', at: now() });
          } catch {
            unresolved.add('bypass_revoke');
            emit({ event: 'setup_cleanup_unknown', kind: 'bypass', at: now() });
          }
        }
        return freeze(
          safe({
            state: unresolved.size ? 'setup_cleanup_incomplete' : 'setup_resources_removed',
            unresolved: [...unresolved],
            deploymentSnapshotsErased: false,
            requestCount: attempts,
          }),
        );
      });
    },
    runtimeSecrets() {
      deadline();
      if (!proof || failed || stopping) fail();
      return Object.freeze({
        machineToken: sensitive.machineToken,
        protectionBypass: sensitive.protectionBypass,
      });
    },
    snapshot() {
      return freeze({
        requestCount: attempts,
        maximumRequests: requestMaximum,
        sharedMaximum: managementBudget.snapshot().maximum ?? 512,
        deploymentReady: proof !== null,
        unresolved: [...unresolved],
        busy,
        closed,
        prerequisiteCode,
        soleOwnedDefaultVerified,
        nonDefaultVerified: false,
        buildPollLimit,
      });
    },
    close() {
      if (busy) fail();
      closed = true;
      sensitive = null;
      denied.fill('');
    },
  });
}
