import { createHash } from 'node:crypto';
import { collectVimeoAccount } from './vimeo.mjs';
import ingestion from '../normalizers/prepare_ingest_groups.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function requestId(execution, operation, account = '', index = 0) {
  const h = createHash('sha256')
    .update(JSON.stringify(['emr-m04-vimeo', execution, operation, account, index]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Official API lifecycle, with fixed restricted gateway ports and native HTTP injected.
 * The gateway adapter MUST durably bind each requestId to its operation/arguments and
 * confirm its SQL receipt before returning. No automatic gateway retry is performed.
 * This module is not a public SQL/RPC proxy and does not open a dev authorization window.
 * Native workflow/gateway wiring remains separate from these local functional tests.
 */
export async function runVimeoCollector(input, deps) {
  if (
    !object(input) ||
    Object.keys(input).some((k) => !['env', 'mode', 'limit', 'executionId'].includes(k)) ||
    input.env !== 'dev' ||
    !['daily', 'backfill'].includes(input.mode) ||
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 10 ||
    typeof input.executionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(input.executionId) ||
    !object(deps) ||
    typeof deps.request !== 'function' ||
    typeof deps.wait !== 'function' ||
    typeof deps.now !== 'function' ||
    !object(deps.gateway) ||
    ['start', 'claim', 'resolve', 'ingest', 'report', 'cost', 'finish'].some(
      (k) => typeof deps.gateway[k] !== 'function',
    )
  )
    throw Error('vimeo_invalid_run_input');
  const now = deps.now();
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) throw Error('vimeo_invalid_run_input');
  const gateway = deps.gateway;
  let runId = null,
    stage = 'start',
    itemsNew = 0,
    apiRequests = 0;
  const accountResults = [],
    entries = [];
  try {
    const started = await gateway.start(
      { workflow: 'WF-10', platform: 'vimeo', mode: input.mode, env: 'dev', execution_id: input.executionId },
      requestId(input.executionId, 'start'),
    );
    if (!object(started) || typeof started.run_id !== 'string' || !uuid.test(started.run_id))
      throw Error('invalid_receipt');
    runId = started.run_id;
    stage = 'claim';
    const accounts = await gateway.claim(
      { platform: 'vimeo', limit: input.limit, run_id: runId, mode: input.mode },
      requestId(input.executionId, 'claim'),
    );
    if (
      !Array.isArray(accounts) ||
      accounts.length > input.limit ||
      accounts.some((a) => !object(a) || !uuid.test(a.account_id) || !uuid.test(a.competitor_id)) ||
      new Set(accounts.map((a) => a.account_id.toLowerCase())).size !== accounts.length
    )
      throw Error('invalid_receipt');
    for (const account of accounts) {
      stage = 'collect';
      const collected = await collectVimeoAccount(
        account,
        { mode: input.mode, now },
        { request: deps.request, wait: deps.wait },
      );
      apiRequests += collected.apiRequestCount;
      if (collected.resolvedExternalId !== null || (!account.external_id && collected.status === 'failed')) {
        stage = 'resolve';
        await gateway.resolve(
          {
            account_id: account.account_id,
            external_id: collected.resolvedExternalId,
            uploads_playlist_id: null,
          },
          requestId(input.executionId, 'resolve', account.account_id),
        );
      }
      const [group] = ingestion.prepareIngestGroups([
        {
          account_id: account.account_id,
          items: collected.normalizedItems,
          status: collected.status,
          error: collected.error,
          backfill_done: collected.backfillDone,
          backfill_cursor: collected.cursor,
        },
      ]);
      let inserted = 0;
      for (let index = 0; index < group.batches.length; index++) {
        stage = 'ingest';
        const batch = group.batches[index];
        const result = await gateway.ingest(
          { run_id: runId, account_id: account.account_id, items: batch },
          requestId(input.executionId, 'ingest', account.account_id, index),
        );
        if (
          !object(result) ||
          !Number.isSafeInteger(result.inserted) ||
          result.inserted < 0 ||
          result.inserted > batch.length ||
          !Number.isSafeInteger(result.duplicates) ||
          result.duplicates < 0 ||
          result.inserted + result.duplicates > batch.length
        )
          throw Error('invalid_receipt');
        inserted += result.inserted;
      }
      stage = 'report';
      await gateway.report(
        {
          run_id: runId,
          account_id: account.account_id,
          status: group.status,
          items_seen: group.items_seen,
          items_new: inserted,
          error: group.error,
          backfill_done: group.backfill_done,
          backfill_cursor: group.backfill_cursor,
        },
        requestId(input.executionId, 'report', account.account_id),
      );
      itemsNew += inserted;
      accountResults.push({
        account_id: account.account_id,
        status: group.status,
        error: group.error,
        complete: collected.complete === true,
        fallback: collected.fallback,
      });
      if (collected.apiRequestCount > 0)
        entries.push({
          provider: 'vimeo',
          category: 'scrape',
          quantity: collected.apiRequestCount,
          unit: 'call',
          cost_usd: 0,
          run_id: runId,
          competitor_id: account.competitor_id,
          platform: 'vimeo',
          meta: {
            actor: 'vimeo-api',
            account_id: account.account_id,
            cost_key: `vimeo:${runId}:${account.account_id}`,
          },
        });
    }
    if (entries.length) {
      stage = 'cost';
      await gateway.cost({ entries }, requestId(input.executionId, 'cost'));
    }
    const failures = accountResults.filter((a) => a.status === 'failed').length;
    const status = failures === 0 ? 'success' : failures === accountResults.length ? 'failed' : 'partial';
    stage = 'finish';
    await gateway.finish(
      { run_id: runId, status, error: failures ? 'vimeo_accounts_failed' : null },
      requestId(input.executionId, 'finish'),
    );
    return {
      state: 'completed',
      run_id: runId,
      status,
      items_new: itemsNew,
      api_requests: apiRequests,
      accounts: accountResults,
    };
  } catch {
    // Never transform a lost gateway receipt into a second run, paid start,
    // account failure, claim release or a guessed terminal status.
    return {
      state: 'reconciliation_required',
      run_id: runId,
      stage,
      items_new: itemsNew,
      api_requests: apiRequests,
      accounts: accountResults,
    };
  }
}
