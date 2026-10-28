// Fixed restricted-gateway lifecycle, following vimeo-run.mjs. No ambient network,
// SQL, credential lookup, workflow execution or actor start is permitted here.
import { createHash } from 'node:crypto';
import { collectYoutubeAccount, youtubeQuotaDay } from './youtube.mjs';
import normalizer from '../normalizers/youtubeApi.js';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uuid = (v) =>
  typeof v === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function requestId(execution, operation, account = '', index = 0) {
  const h = createHash('sha256')
    .update(JSON.stringify(['emr-m05-youtube', execution, operation, account, index]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function validQuota(receipt, day) {
  return (
    object(receipt) &&
    receipt.quota_day === day &&
    Number.isSafeInteger(receipt.used_units) &&
    receipt.used_units >= 0 &&
    receipt.used_units <= 8000 &&
    typeof receipt.permitted === 'boolean'
  );
}
export async function runYoutubeCollector(input, deps) {
  if (
    !object(input) ||
    Object.keys(input).some(
      (k) => !['env', 'mode', 'limit', 'executionId', 'accountIds', 'maxPages', 'pageSize'].includes(k),
    ) ||
    input.env !== 'dev' ||
    !['daily', 'backfill'].includes(input.mode) ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 10 ||
    typeof input.executionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(input.executionId) ||
    !Array.isArray(input.accountIds) ||
    input.accountIds.length !== input.limit ||
    input.accountIds.some((v) => !uuid(v)) ||
    new Set(input.accountIds).size !== input.accountIds.length ||
    typeof deps?.request !== 'function' ||
    typeof deps.now !== 'function' ||
    !object(deps.gateway) ||
    ['start', 'claim', 'quota', 'resolve', 'ingest', 'report', 'cost', 'finish'].some(
      (k) => typeof deps.gateway[k] !== 'function',
    )
  )
    throw Error('youtube_invalid_run_input');
  const now = deps.now(),
    day = youtubeQuotaDay(now),
    gateway = deps.gateway;
  let runId = null,
    stage = 'start',
    itemsNew = 0,
    apiRequests = 0,
    reservation = 0;
  const accountResults = [];
  try {
    const started = await gateway.start(
      {
        workflow: 'WF-13',
        platform: 'youtube',
        mode: input.mode,
        env: 'dev',
        execution_id: input.executionId,
      },
      requestId(input.executionId, 'start'),
    );
    if (!uuid(started?.run_id)) throw Error('invalid_receipt');
    runId = started.run_id;
    stage = 'claim';
    const accounts = await gateway.claim(
      {
        run_id: runId,
        platform: 'youtube',
        mode: input.mode,
        limit: input.limit,
        account_ids: input.accountIds,
      },
      requestId(input.executionId, 'claim'),
    );
    if (
      !Array.isArray(accounts) ||
      accounts.length > input.limit ||
      new Set(accounts.map((a) => a.account_id)).size !== accounts.length ||
      accounts.some(
        (a) =>
          !object(a) ||
          !uuid(a.account_id) ||
          !uuid(a.competitor_id) ||
          !input.accountIds.includes(a.account_id),
      )
    )
      throw Error('invalid_receipt');
    stage = 'quota';
    const initial = await gateway.quota(
      { quota_day: day, quantity: 0 },
      requestId(input.executionId, 'quota-read'),
    );
    if (!validQuota(initial, day)) throw Error('invalid_receipt');
    let remaining = 8000 - initial.used_units;
    for (const account of accounts) {
      stage = 'collect';
      const collected = await collectYoutubeAccount(
        account,
        {
          mode: input.mode,
          now,
          quotaRemaining: remaining,
          ...(input.maxPages === undefined ? {} : { maxPages: input.maxPages }),
          ...(input.pageSize === undefined ? {} : { pageSize: input.pageSize }),
        },
        {
          request: deps.request,
          reserveQuota: async () => {
            if (youtubeQuotaDay(deps.now()) !== day) return false;
            stage = 'quota-reserve';
            const value = await gateway.quota(
              { quota_day: day, quantity: 1 },
              requestId(input.executionId, 'quota-reserve', account.account_id, reservation++),
            );
            if (!validQuota(value, day)) throw Error('invalid_receipt');
            stage = 'collect';
            return value.permitted;
          },
        },
      );
      apiRequests += collected.apiRequestCount;
      remaining = Math.max(0, remaining - collected.quotaUnits);
      if (collected.error === 'youtube_quota_reconciliation_required')
        throw Error('quota_reconciliation_required');
      if (collected.resolvedExternalId && collected.resolvedUploadsPlaylistId) {
        stage = 'resolve';
        await gateway.resolve(
          {
            account_id: account.account_id,
            external_id: collected.resolvedExternalId,
            uploads_playlist_id: collected.resolvedUploadsPlaylistId,
          },
          requestId(input.executionId, 'resolve', account.account_id),
        );
      }
      // Log attempted API work before ingestion/reporting. Atomic reservations
      // bound the Pacific-day counter; this separate USD0 ledger is not summed
      // into that counter a second time. A lost receipt is reconciled, not retried.
      if (collected.quotaUnits) {
        stage = 'cost';
        await gateway.cost(
          {
            entries: [
              {
                provider: 'youtube',
                category: 'scrape',
                quantity: collected.quotaUnits,
                unit: 'quota_unit',
                cost_usd: 0,
                run_id: runId,
                competitor_id: account.competitor_id,
                platform: 'youtube',
                meta: {
                  actor: 'youtube-api',
                  account_id: account.account_id,
                  cost_key: `youtube:${runId}:${account.account_id}`,
                },
              },
            ],
          },
          requestId(input.executionId, 'cost', account.account_id),
        );
      }
      let inserted = 0;
      const batches = normalizer.youtubeHelpers.youtubeBatches(collected.normalizedItems);
      for (let offset = 0; offset < batches.length; offset++) {
        stage = 'ingest';
        const items = batches[offset];
        const receipt = await gateway.ingest(
          { run_id: runId, account_id: account.account_id, items },
          requestId(input.executionId, 'ingest', account.account_id, offset),
        );
        if (
          !object(receipt) ||
          !Number.isSafeInteger(receipt.inserted) ||
          receipt.inserted < 0 ||
          receipt.inserted > items.length ||
          !Number.isSafeInteger(receipt.duplicates) ||
          receipt.duplicates < 0 ||
          receipt.inserted + receipt.duplicates > items.length
        )
          throw Error('invalid_receipt');
        inserted += receipt.inserted;
      }
      stage = 'report';
      const status = collected.status === 'success' ? 'success' : 'failed';
      await gateway.report(
        {
          run_id: runId,
          account_id: account.account_id,
          status,
          items_seen: collected.normalizedItems.length,
          items_new: inserted,
          error: collected.error,
          backfill_done: collected.backfillDone,
          backfill_cursor: collected.cursor,
        },
        requestId(input.executionId, 'report', account.account_id),
      );
      itemsNew += inserted;
      accountResults.push({
        account_id: account.account_id,
        status: collected.status,
        error: collected.error,
        complete: collected.complete,
        backfill_done: collected.backfillDone,
        cursor: collected.cursor,
        unavailable_ids: collected.unavailableIds,
        quota_units: collected.quotaUnits,
        fallback: collected.fallback,
      });
    }
    const failed = accountResults.filter((a) => a.status === 'failed').length,
      partial = accountResults.some((a) => a.status === 'partial');
    const status =
      failed === accountResults.length && failed ? 'failed' : failed || partial ? 'partial' : 'success';
    stage = 'finish';
    const finished = await gateway.finish(
      { run_id: runId, status, error: status === 'success' ? null : 'youtube_accounts_incomplete' },
      requestId(input.executionId, 'finish'),
    );
    if (
      !object(finished) ||
      finished.state !== 'completed' ||
      !object(finished.summary) ||
      finished.summary.run_id !== runId ||
      !['success', 'partial', 'failed'].includes(finished.summary.status)
    )
      throw Error('invalid_receipt');
    return {
      state: 'completed',
      run_id: runId,
      status: finished.summary.status,
      items_new: itemsNew,
      api_requests: apiRequests,
      quota_units: apiRequests,
      quota_day: day,
      accounts: accountResults,
    };
  } catch {
    // Lost lifecycle/quota receipts must never create a second run, release a
    // claim or fabricate a terminal state. Caller reconciles exact owned IDs.
    return {
      state: 'reconciliation_required',
      run_id: runId,
      stage,
      items_new: itemsNew,
      api_requests: apiRequests,
      quota_units: apiRequests,
      quota_day: day,
      accounts: accountResults,
    };
  }
}
