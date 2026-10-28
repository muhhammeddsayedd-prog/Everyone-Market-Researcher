import { createHash } from 'node:crypto';
import {
  buildLinkedInPostBatches,
  buildLinkedInEmployeeBatches,
  linkedinRegistrationCompletion,
} from './linkedin.mjs';
import posts from '../normalizers/linkedinPosts.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requestId(execution, operation, index = 0) {
  const h = createHash('sha256')
    .update(JSON.stringify(['emr-m05-linkedin', execution, operation, index]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function cairoDate(now) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Fixed business ports only. A durable live-policy launch permit is mandatory.
 * Starts are asynchronous and never retried. Callback ingestion/cost/employee snapshots
 * belong to the maintained gateway path; dispatch is not collection completion.
 */
export async function runLinkedInCollector(input, deps) {
  if (
    !object(input) ||
    Object.keys(input).some(
      (key) =>
        ![
          'env',
          'mode',
          'kind',
          'limit',
          'executionId',
          'account_ids',
          'results_limit',
          'max_actor_starts',
        ].includes(key),
    ) ||
    input.env !== 'dev' ||
    !['posts', 'employees'].includes(input.kind) ||
    (input.kind === 'employees' ? input.mode !== 'weekly' : !['daily', 'backfill'].includes(input.mode)) ||
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 20 ||
    !Array.isArray(input.account_ids) ||
    input.account_ids.length !== input.limit ||
    input.account_ids.some((id) => !uuid.test(id ?? '')) ||
    new Set(input.account_ids).size !== input.account_ids.length ||
    !Number.isSafeInteger(input.results_limit) ||
    input.results_limit < 1 ||
    input.results_limit > (input.kind === 'employees' ? 200 : 1000) ||
    !Number.isSafeInteger(input.max_actor_starts) ||
    input.max_actor_starts < 1 ||
    input.max_actor_starts > 2147483647 ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(input.executionId ?? '') ||
    !object(deps) ||
    typeof deps.now !== 'function' ||
    typeof deps.startActor !== 'function' ||
    !object(deps.gateway) ||
    ['start', 'claim', 'launch', 'register', 'close_registration', 'finish'].some(
      (key) => typeof deps.gateway[key] !== 'function',
    )
  )
    throw Error('linkedin_invalid_run_input');
  const now = posts.linkedinHelpers.linkedinDate(deps.now());
  if (!now) throw Error('linkedin_invalid_run_input');
  const gateway = deps.gateway;
  const platform = input.kind === 'employees' ? 'linkedin_employees' : 'linkedin';
  const workflow = input.kind === 'employees' ? 'WF-18b' : 'WF-18';
  let runId = null,
    stage = 'start',
    confirmedStarts = 0,
    uncertainStart = false;
  const registered = [];
  try {
    const started = await gateway.start(
      { workflow, platform, mode: input.mode, env: 'dev', execution_id: input.executionId },
      requestId(input.executionId, 'start'),
    );
    if (!uuid.test(started?.run_id ?? '')) throw Error('invalid_receipt');
    runId = started.run_id;
    stage = 'claim';
    const accounts = await gateway.claim(
      { platform, limit: input.limit, run_id: runId, mode: input.mode, account_ids: input.account_ids },
      requestId(input.executionId, 'claim'),
    );
    if (
      !Array.isArray(accounts) ||
      accounts.length !== input.limit ||
      new Set(accounts.map((account) => account.id ?? account.account_id)).size !== accounts.length ||
      accounts.some((account) => !input.account_ids.includes(account.id ?? account.account_id))
    )
      throw Error('invalid_receipt');
    stage = 'plan';
    const batches =
      input.kind === 'employees'
        ? buildLinkedInEmployeeBatches(accounts, {
            snapshotDate: cairoDate(now),
            maxItemsPerCompany: input.results_limit,
          })
        : buildLinkedInPostBatches(accounts, { mode: input.mode, now, maxPosts: input.results_limit });
    if (batches.length > input.max_actor_starts) throw Error('linkedin_actor_limit');
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      const launchId = requestId(input.executionId, 'launch', index);
      stage = 'launch';
      const permit = await gateway.launch(
        {
          run_id: runId,
          launch_id: launchId,
          actor_id: batch.actor,
          pass: 'primary',
          purpose: input.mode,
          account_ids: batch.account_ids,
          results_limit: batch.resultsLimit,
          actor_input: batch.input,
          ...(batch.snapshot_date ? { snapshot_date: batch.snapshot_date } : {}),
        },
        launchId,
      );
      const d = permit?.descriptor;
      if (
        permit?.permit !== true ||
        permit.replayed !== false ||
        permit.launch_id !== launchId ||
        !object(d) ||
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
        throw Error('invalid_launch_receipt');
      stage = 'actor_start';
      uncertainStart = true;
      const response = await deps.startActor({
        actor_id: batch.actor,
        launch_id: launchId,
        input: structuredClone(batch.input),
        descriptor: structuredClone(d),
      });
      const actorRun = response?.body?.data;
      if (
        response?.statusCode !== 201 ||
        typeof actorRun?.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(actorRun.id)
      )
        throw Error('actor_start_unknown');
      confirmedStarts++;
      uncertainStart = false;
      stage = 'register';
      const receipt = await gateway.register(
        {
          run_id: runId,
          launch_id: launchId,
          apify_run_id: actorRun.id,
          actor_id: batch.actor,
          pass: 'primary',
          purpose: input.mode,
          account_ids: batch.account_ids,
        },
        requestId(input.executionId, 'register', index),
      );
      if (receipt?.registered !== true || receipt.run_id !== runId || receipt.apify_run_id !== actorRun.id)
        throw Error('invalid_receipt');
      registered.push(actorRun.id);
      // A known start is registered before an option mismatch stops later
      // starts. It remains reconcilable even when native execution data expires.
      if (!object(actorRun.options) || actorRun.options.maxTotalChargeUsd !== d.maxTotalChargeUsd) {
        stage = 'actor_cap_ack';
        throw Error('actor_cap_unverified');
      }
    }
    stage = 'close_registration';
    const closed = await gateway.close_registration(
      { run_id: runId },
      requestId(input.executionId, 'close_registration'),
    );
    return {
      ...linkedinRegistrationCompletion(closed, runId),
      run_id: runId,
      actor_starts: confirmedStarts,
      actor_run_ids: registered,
      registration_closed: true,
    };
  } catch {
    // Lost/ambiguous receipts cannot authorize another paid POST, release or guessed finish.
    return {
      state: 'reconciliation_required',
      run_id: runId,
      stage,
      actor_starts: confirmedStarts,
      actor_run_ids: registered,
      uncertain_start: uncertainStart,
    };
  }
}
