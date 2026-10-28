// Serializable transitions only. Actual I/O runs in pinned native HTTP nodes.
import posts from '../normalizers/linkedinPosts.js';
import {
  buildLinkedInPostBatches,
  buildLinkedInEmployeeBatches,
  linkedinRegistrationCompletion,
} from './linkedin.mjs';
import { m05RequestId, m05Gateway } from './native-m05-runtime.mjs';
const { linkedinDate } = posts.linkedinHelpers;
const liRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function m05LinkedInCaptureDate(now) {
  if (!linkedinDate(now)) throw Error('M05_LINKEDIN_INPUT_INVALID');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function initializeM05LinkedIn(input, kind, executionId, now) {
  const uuid = (value) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (
    !liRecord(input) ||
    Object.keys(input).some(
      (key) => !['env', 'mode', 'account_ids', 'results_limit', 'max_actor_starts'].includes(key),
    ) ||
    input.env !== 'dev' ||
    !['posts', 'employees'].includes(kind) ||
    (kind === 'employees' ? input.mode !== 'weekly' : !['daily', 'backfill'].includes(input.mode)) ||
    !Array.isArray(input.account_ids) ||
    input.account_ids.length < 1 ||
    input.account_ids.length > 20 ||
    input.account_ids.some((id) => !uuid(id)) ||
    new Set(input.account_ids).size !== input.account_ids.length ||
    !Number.isSafeInteger(input.results_limit) ||
    input.results_limit < 1 ||
    input.results_limit > (kind === 'employees' ? 200 : 1000) ||
    !Number.isSafeInteger(input.max_actor_starts) ||
    input.max_actor_starts < 1 ||
    input.max_actor_starts > 2147483647 ||
    !linkedinDate(now)
  )
    throw Error('M05_LINKEDIN_INPUT_INVALID');
  const state = {
    kind,
    now: linkedinDate(now),
    executionId,
    mode: input.mode,
    platform: kind === 'employees' ? 'linkedin_employees' : 'linkedin',
    accountIds: input.account_ids,
    resultsLimit: input.results_limit,
    maxActorStarts: input.max_actor_starts,
    sequence: 0,
    batchIndex: 0,
    actorIds: [],
  };
  return m05Gateway(state, 'start', {
    workflow: kind === 'employees' ? 'WF-18b' : 'WF-18',
    platform: state.platform,
    env: 'dev',
    mode: state.mode,
    execution_id: executionId,
  });
}
export function m05LinkedInLaunch(state) {
  if (state.batchIndex >= state.batches.length)
    return m05Gateway(state, 'close_registration', { run_id: state.runId });
  const batch = state.batches[state.batchIndex];
  state.launchId = m05RequestId(state.executionId, state.sequence + 1);
  return m05Gateway(state, 'launch', {
    run_id: state.runId,
    launch_id: state.launchId,
    actor_id: batch.actor,
    pass: 'primary',
    purpose: state.mode,
    account_ids: batch.account_ids,
    results_limit: batch.resultsLimit,
    actor_input: batch.input,
    ...(batch.snapshot_date ? { snapshot_date: batch.snapshot_date } : {}),
  });
}
export function advanceM05LinkedInGateway(state, response) {
  const body = response?.body;
  if (
    response?.statusCode !== 200 ||
    body?.version !== 1 ||
    body.requestId !== state.request.requestId ||
    body.operation !== state.request.operation ||
    typeof body.replayed !== 'boolean' ||
    !Object.hasOwn(body, 'result')
  )
    throw Error('M05_LINKEDIN_GATEWAY_RECONCILIATION_REQUIRED');
  const result = body.result,
    operation = state.request.operation;
  if (operation === 'm05.start') {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result?.run_id ?? '')
    )
      throw Error('M05_LINKEDIN_RECEIPT_INVALID');
    state.runId = result.run_id;
    state.snapshotDate = result.snapshot_date ?? m05LinkedInCaptureDate(state.now);
    return m05Gateway(state, 'claim', {
      run_id: state.runId,
      platform: state.platform,
      mode: state.mode,
      limit: state.accountIds.length,
      account_ids: state.accountIds,
    });
  }
  if (operation === 'm05.claim') {
    if (
      !Array.isArray(result) ||
      result.length !== state.accountIds.length ||
      new Set(result.map((account) => account?.account_id ?? account?.id)).size !== result.length ||
      result.some(
        (account) => !liRecord(account) || !state.accountIds.includes(account.account_id ?? account.id),
      )
    )
      throw Error('M05_LINKEDIN_RECEIPT_INVALID');
    state.batches =
      state.kind === 'employees'
        ? buildLinkedInEmployeeBatches(result, {
            snapshotDate: state.snapshotDate,
            maxItemsPerCompany: state.resultsLimit,
          })
        : buildLinkedInPostBatches(result, {
            mode: state.mode,
            now: state.now,
            maxPosts: state.resultsLimit,
          });
    if (state.batches.length > state.maxActorStarts) throw Error('M05_LINKEDIN_ACTOR_LIMIT');
    return m05LinkedInLaunch(state);
  }
  if (operation === 'm05.launch') {
    const batch = state.batches[state.batchIndex],
      d = result?.descriptor;
    if (
      body.replayed ||
      result?.replayed !== false ||
      result.permit !== true ||
      result.launch_id !== state.launchId ||
      !liRecord(d) ||
      Object.keys(d).some(
        (key) =>
          ![
            'billingModel',
            'actorPath',
            'build',
            'maxTotalChargeUsd',
            'maxItems',
            'memory',
            'timeout',
          ].includes(key),
      ) ||
      d.billingModel !== 'PPE' ||
      d.actorPath !== batch.actor.replace('/', '~') ||
      !/^[A-Za-z0-9._-]{1,128}$/.test(d.build ?? '') ||
      d.build === 'latest' ||
      !Number.isFinite(d.maxTotalChargeUsd) ||
      d.maxTotalChargeUsd <= 0 ||
      !Number.isSafeInteger(d.maxItems) ||
      d.maxItems < 1 ||
      d.maxItems !== batch.account_ids.length * batch.resultsLimit ||
      d.memory !== 1024 ||
      d.timeout !== 600
    )
      throw Error('M05_LINKEDIN_LAUNCH_RECONCILIATION_REQUIRED');
    state.launchDescriptor = d;
    state.action = 'apify';
    return state;
  }
  if (operation === 'm05.register') {
    if (
      result?.registered !== true ||
      result.run_id !== state.runId ||
      result.apify_run_id !== state.startedActorId
    )
      throw Error('M05_LINKEDIN_RECEIPT_INVALID');
    state.actorIds.push(state.startedActorId);
    if (state.actorCapAcknowledged !== true) throw Error('M05_LINKEDIN_CAP_ACK_RECONCILIATION_REQUIRED');
    state.batchIndex++;
    return m05LinkedInLaunch(state);
  }
  if (operation === 'm05.close_registration') {
    const completion = linkedinRegistrationCompletion(result, state.runId);
    state.action = 'done';
    state.result = {
      ...completion,
      run_id: state.runId,
      actor_starts: state.actorIds.length,
      actor_run_ids: state.actorIds,
      registration_closed: true,
    };
    return state;
  }
  throw Error('M05_LINKEDIN_OPERATION_INVALID');
}
export function advanceM05LinkedInActor(state, response) {
  const id = response?.body?.data?.id;
  if (
    state.action !== 'apify' ||
    response?.statusCode !== 201 ||
    typeof id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id ?? '') ||
    state.actorIds.includes(id)
  )
    throw Error('M05_LINKEDIN_ACTOR_START_RECONCILIATION_REQUIRED');
  state.startedActorId = id;
  state.actorCapAcknowledged =
    liRecord(response.body.data.options) &&
    response.body.data.options.maxTotalChargeUsd === state.launchDescriptor.maxTotalChargeUsd;
  const batch = state.batches[state.batchIndex];
  return m05Gateway(state, 'register', {
    run_id: state.runId,
    launch_id: state.launchId,
    apify_run_id: id,
    actor_id: batch.actor,
    pass: 'primary',
    purpose: state.mode,
    account_ids: batch.account_ids,
  });
}
