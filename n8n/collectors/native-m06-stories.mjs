// Serializable WF-12 transitions. Native HTTP nodes perform all network I/O.
import { buildStoryBatches, storyRegistrationCompletion } from './stories.mjs';
export function m06StoryRequestId(execution, sequence) {
  if (
    !/^[0-9]{1,15}$/.test(execution) ||
    Number(execution) >= 2 ** 48 ||
    !Number.isSafeInteger(Number(execution)) ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 4095
  )
    throw Error('M06_STORIES_EXECUTION_INVALID');
  return `c06c0000-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(execution).toString(16).padStart(12, '0')}`;
}
export function m06StoryGateway(state, operation, args) {
  state.sequence++;
  state.action = 'gateway';
  state.request = {
    version: 1,
    requestId: m06StoryRequestId(state.executionId, state.sequence),
    operation: 'm06.' + operation,
    args,
  };
  return state;
}
export function initializeM06Stories(input, executionId, now) {
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const actors = [
    'data-slayer/instagram-stories-scraper',
    'igview-owner/instagram-story-viewer',
    'louisdeconinck/instagram-story-details-scraper',
  ];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 7 ||
    Object.keys(input).some(
      (k) =>
        ![
          'env',
          'mode',
          'actor_id',
          'collection_mode',
          'account_ids',
          'results_limit',
          'max_actor_starts',
        ].includes(k),
    ) ||
    input.env !== 'dev' ||
    input.mode !== 'daily' ||
    !actors.includes(input.actor_id) ||
    !['ingest', 'bakeoff'].includes(input.collection_mode) ||
    (input.collection_mode === 'ingest' && input.actor_id !== 'data-slayer/instagram-stories-scraper') ||
    !Array.isArray(input.account_ids) ||
    input.account_ids.length < 1 ||
    input.account_ids.length > 100 ||
    input.account_ids.some((id) => !uuid(id)) ||
    new Set(input.account_ids).size !== input.account_ids.length ||
    !Number.isSafeInteger(input.results_limit) ||
    input.results_limit < 1 ||
    input.results_limit > 1000 ||
    !Number.isSafeInteger(input.max_actor_starts) ||
    input.max_actor_starts < 1 ||
    input.max_actor_starts > 2147483647 ||
    typeof now !== 'string' ||
    !Number.isFinite(Date.parse(now))
  )
    throw Error('M06_STORIES_INPUT_INVALID');
  const state = {
    executionId,
    now,
    accountIds: input.account_ids,
    actorId: input.actor_id,
    collectionMode: input.collection_mode,
    resultsLimit: input.results_limit,
    maxActorStarts: input.max_actor_starts,
    sequence: 0,
    batchIndex: 0,
    actorIds: [],
    actorStarts: 0,
  };
  return m06StoryGateway(state, 'start', {
    workflow: 'WF-12',
    platform: 'instagram_stories',
    mode: 'daily',
    env: 'dev',
    execution_id: executionId,
    collection_mode: state.collectionMode,
  });
}
export function nextM06StoryLaunch(state) {
  if (state.batchIndex >= state.batches.length)
    return m06StoryGateway(state, 'close_registration', { run_id: state.runId });
  const batch = state.batches[state.batchIndex];
  state.launchId = m06StoryRequestId(state.executionId, state.sequence + 1);
  return m06StoryGateway(state, 'launch', {
    run_id: state.runId,
    launch_id: state.launchId,
    actor_id: batch.actor,
    pass: 'primary',
    account_ids: batch.account_ids,
    purpose: 'daily',
    results_limit: batch.resultsLimit,
    actor_input: batch.input,
    collection_mode: batch.collection_mode,
  });
}
export function advanceM06StoryGateway(state, response) {
  const body = response?.body;
  if (
    response?.statusCode !== 200 ||
    body?.version !== 1 ||
    body.requestId !== state.request.requestId ||
    body.operation !== state.request.operation ||
    typeof body.replayed !== 'boolean' ||
    !Object.hasOwn(body, 'result')
  )
    throw Error('M06_STORIES_GATEWAY_RECONCILIATION_REQUIRED');
  const result = body.result,
    operation = state.request.operation;
  if (operation === 'm06.start') {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result?.run_id ?? '')
    )
      throw Error('M06_STORIES_RECEIPT_INVALID');
    state.runId = result.run_id;
    return m06StoryGateway(state, 'claim', {
      run_id: state.runId,
      platform: 'instagram_stories',
      mode: 'daily',
      limit: state.accountIds.length,
      account_ids: state.accountIds,
    });
  }
  if (operation === 'm06.claim') {
    if (
      !Array.isArray(result) ||
      result.length !== state.accountIds.length ||
      new Set(result.map((a) => a?.account_id ?? a?.id)).size !== result.length ||
      result.some((a) => !state.accountIds.includes(a?.account_id ?? a?.id))
    )
      throw Error('M06_STORIES_CLAIM_INVALID');
    state.batches = buildStoryBatches(result, {
      actor_id: state.actorId,
      collection_mode: state.collectionMode,
      results_limit: state.resultsLimit,
    });
    if (state.batches.length > state.maxActorStarts) throw Error('M06_STORIES_OPERATIONAL_START_BOUND');
    return nextM06StoryLaunch(state);
  }
  if (operation === 'm06.launch') {
    if (!result || result.launch_id !== state.launchId || typeof result.permit !== 'boolean')
      throw Error('M06_STORIES_LAUNCH_RECONCILIATION_REQUIRED');
    if (result.permit === false) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(result.apify_run_id ?? ''))
        throw Error('M06_STORIES_LAUNCH_RECONCILIATION_REQUIRED');
      state.startedActorId = result.apify_run_id;
      // A known ID only reconciles identity. It does not establish that the
      // previous native launch acknowledged its authentic build/options.
      // Preserve registration, then stop for authoritative reconciliation.
      state.actorAcknowledged = false;
      const batch = state.batches[state.batchIndex];
      return m06StoryGateway(state, 'register', {
        run_id: state.runId,
        launch_id: state.launchId,
        apify_run_id: state.startedActorId,
        actor_id: batch.actor,
        pass: 'primary',
        account_ids: batch.account_ids,
        purpose: 'daily',
      });
    }
    const d = result.descriptor,
      batch = state.batches[state.batchIndex];
    if (
      body.replayed ||
      result.replayed !== false ||
      !d ||
      typeof d !== 'object' ||
      Array.isArray(d) ||
      Object.keys(d).length !== 10 ||
      Object.keys(d).some(
        (k) =>
          ![
            'billingModel',
            'actorPath',
            'actorId',
            'ownerId',
            'build',
            'buildId',
            'maxTotalChargeUsd',
            'maxOutputItems',
            'memory',
            'timeout',
          ].includes(k),
      ) ||
      !['PPE', 'PPU'].includes(d.billingModel) ||
      d.actorPath !== batch.actor.replace('/', '~') ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(d.actorId ?? '') ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(d.ownerId ?? '') ||
      !/^\d+\.\d+\.\d+$/.test(d.build ?? '') ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(d.buildId ?? '') ||
      typeof d.maxTotalChargeUsd !== 'number' ||
      !Number.isFinite(d.maxTotalChargeUsd) ||
      d.maxTotalChargeUsd <= 0 ||
      d.maxOutputItems !== batch.account_ids.length * batch.resultsLimit ||
      !Number.isSafeInteger(d.memory) ||
      d.memory < 128 ||
      d.memory > 32768 ||
      (d.memory & (d.memory - 1)) !== 0 ||
      !Number.isSafeInteger(d.timeout) ||
      d.timeout < 30 ||
      d.timeout > 600
    )
      throw Error('M06_STORIES_LAUNCH_RECONCILIATION_REQUIRED');
    state.launchDescriptor = d;
    state.action = 'apify';
    return state;
  }
  if (operation === 'm06.register') {
    if (
      result?.registered !== true ||
      result.run_id !== state.runId ||
      result.apify_run_id !== state.startedActorId
    )
      throw Error('M06_STORIES_REGISTER_RECONCILIATION_REQUIRED');
    if (!state.actorAcknowledged) throw Error('M06_STORIES_PROVIDER_OPTIONS_RECONCILIATION_REQUIRED');
    if (!state.actorIds.includes(state.startedActorId)) state.actorIds.push(state.startedActorId);
    state.batchIndex++;
    return nextM06StoryLaunch(state);
  }
  if (operation === 'm06.close_registration') {
    const completion = storyRegistrationCompletion(result, state.runId);
    state.action = 'done';
    state.result = {
      ...completion,
      run_id: state.runId,
      actor_starts: state.actorStarts,
      actor_run_ids: state.actorIds,
      registration_closed: true,
      collection_mode: state.collectionMode,
    };
    return state;
  }
  throw Error('M06_STORIES_OPERATION_INVALID');
}
export function advanceM06StoryActor(state, response) {
  const data = response?.body?.data,
    id = data?.id;
  if (
    state.action !== 'apify' ||
    response?.statusCode !== 201 ||
    typeof id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
    state.actorIds.includes(id)
  )
    throw Error('M06_STORIES_START_RECONCILIATION_REQUIRED');
  state.startedActorId = id;
  state.actorStarts++;
  const d = state.launchDescriptor;
  // Save any known provider ID before refusing further starts on changed caps,
  // build or identity. A lost/invalid start is never replaced automatically.
  state.actorAcknowledged =
    data.actId === d.actorId &&
    data.userId === d.ownerId &&
    data.buildId === d.buildId &&
    data.buildNumber === d.build &&
    data.options?.maxTotalChargeUsd === d.maxTotalChargeUsd &&
    data.options?.memoryMbytes === d.memory &&
    data.options?.timeoutSecs === d.timeout;
  const batch = state.batches[state.batchIndex];
  return m06StoryGateway(state, 'register', {
    run_id: state.runId,
    launch_id: state.launchId,
    apify_run_id: id,
    actor_id: batch.actor,
    pass: 'primary',
    account_ids: batch.account_ids,
    purpose: 'daily',
  });
}
