import { isDeepStrictEqual } from 'node:util';
import { createApifyRecoveryRuntime } from '../../packages/shared/src/n8n-apify-recovery.ts';
import { foundationSmokeInput } from '../../n8n/foundation/build-foundation-smoke.mjs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { assertFoundationNativeReceipt } from './foundation-native-reader.mjs';
import { freezeRuntimeValue } from './foundation-runtime-plan.mjs';

// Read-only, fixed schema and window. Parameters are ONLY the fixed window,
// reader-derived business request UUIDs and actual checked native execution IDs.
// A NULL original run/registry remains visible through LEFT JOIN and is rejected.
// No expiry filter hides an uncleared lease pointer or unfinished SQL request.
export const foundationSettlementQuery = `select jsonb_build_object(
  'window_id',$1::uuid,
  'window_exists',exists(select 1 from ops.foundation_gateway_rate_windows where window_id=$1::uuid),
  'observed_at',clock_timestamp(),
  'requests',coalesce((select jsonb_agg(jsonb_build_object(
    'request_id',q.request_id,'operation',q.operation,'state',q.state,
    'read_started',q.read_started,'completed_at',q.completed_at) order by q.request_id)
    from ops.foundation_gateway_requests q where q.window_id=$1::uuid and q.request_id=any($2::uuid[])),'[]'::jsonb),
  'leases',coalesce((select jsonb_agg(jsonb_build_object('slot',l.slot,'request_id',l.request_id,'expires_at',l.expires_at))
    from ops.foundation_gateway_leases l where l.window_id=$1::uuid and l.request_id is not null),'[]'::jsonb),
  'unsettled_requests',(select count(*) from ops.foundation_gateway_requests q where q.window_id=$1::uuid and (q.state='reserved' or q.completed_at is null)),
  'providers',coalesce((select jsonb_agg(jsonb_build_object(
    'execution_id',l.execution_id,'scrape_execution_id',r.n8n_execution_id,
    'run_status',r.status,'run_finished_at',r.finished_at,
    'terminal_cost_match',(select a.usage_usd=round((s->>'usage_usd')::numeric,6)
      from jsonb_array_elements($4::jsonb) s where s->>'apify_run_id'=l.apify_run_id),
    'launch',ops.get_apify_launch(l.launch_id),'registry',to_jsonb(a)) order by l.ordinal)
    from ops.apify_launch_admissions l join ops.scrape_runs r on r.id=l.run_id
    left join ops.apify_runs a on a.apify_run_id=l.apify_run_id
    where l.window_id=$1::uuid and (l.execution_id=any($3::text[]) or r.n8n_execution_id=any($3::text[]))),'[]'::jsonb)
) as settlement;`;
const legacyWindowId = foundationRuntimeCheckpoint.windowId;
const readers = new WeakSet(),
  proofs = new WeakSet(),
  originProofs = new WeakSet();
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const identifier = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid = (v) =>
  typeof v === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const time = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
class SettlementError extends Error {
  constructor(code) {
    super('FOUNDATION_SETTLEMENT_' + code);
  }
}
const failure = (code) => new SettlementError(code);
const fail = (code) => {
  throw failure(code);
};
function safeError(error) {
  return error instanceof SettlementError ? error : failure('UNCONFIRMED');
}
export function assertFoundationSettlementReader(reader) {
  if (!readers.has(reader)) fail('READER_BRAND');
  return reader;
}
export function assertFoundationSettlementReceipt(proof) {
  if (!proofs.has(proof)) fail('PROOF_BRAND');
  return proof;
}
export function assertFoundationProviderOrigins(proof) {
  if (!originProofs.has(proof)) fail('ORIGINS_BRAND');
  return proof;
}

export function createFoundationSettlementReader({
  readGateway,
  readProvider,
  transportSnapshot,
  now,
  pause,
  deadlineAt,
  windowId = legacyWindowId,
} = {}) {
  if (
    ![legacyWindowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc'].includes(windowId) ||
    [readGateway, readProvider, transportSnapshot, now, pause].some((fn) => typeof fn !== 'function') ||
    !Number.isSafeInteger(deadlineAt)
  )
    fail('CONFIG');
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) fail('CLOCK');
    return value;
  };
  const remaining = () => {
    const value = deadlineAt - clock();
    if (value <= 0) fail('DEADLINE');
    return value;
  };
  remaining();
  let busy = false,
    pendingPorts = 0;
  const transportClear = () => {
    if (pendingPorts !== 0) fail('PORT_PENDING');
    const s = transportSnapshot();
    if (s && typeof s.then === 'function') {
      Promise.resolve(s).catch(() => {});
      fail('TRANSPORT');
    }
    if (
      !object(s) ||
      ['pendingRequests', 'unclosedResponses', 'pendingProviderRequests', 'pendingGatewayRequests'].some(
        (k) => s[k] !== 0,
      )
    )
      fail('TRANSPORT');
  };
  async function bounded(port, args, milliseconds = 15000) {
    remaining();
    const controller = new AbortController(),
      timeout = Math.min(milliseconds, remaining());
    let timer, abort;
    const stop = new Promise((_, reject) => {
      abort = () => reject(failure('DEADLINE'));
      controller.signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => controller.abort(), timeout);
    });
    pendingPorts++;
    const work = Promise.resolve()
      .then(() => {
        remaining();
        return port({ ...args, signal: controller.signal });
      })
      .finally(() => {
        pendingPorts--;
      });
    try {
      return await Promise.race([work, stop]);
    } catch (e) {
      throw safeError(e);
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', abort);
      controller.abort();
    }
  }
  function snapshot(value, expected, nativeById, started, originsOnly = false, costsChecked = false) {
    if (
      !exact(value, [
        'window_id',
        'window_exists',
        'observed_at',
        'requests',
        'leases',
        'unsettled_requests',
        'providers',
      ]) ||
      value.window_id !== windowId ||
      value.window_exists !== true ||
      !time(value.observed_at) ||
      Date.parse(value.observed_at) < started - 30000 ||
      Date.parse(value.observed_at) > clock() + 30000 ||
      !Array.isArray(value.requests) ||
      value.requests.length !== expected.size ||
      !Array.isArray(value.leases) ||
      value.leases.length !== 0 ||
      value.unsettled_requests !== 0 ||
      !Array.isArray(value.providers) ||
      value.providers.length > 2
    )
      fail('GATEWAY');
    const seen = new Set();
    for (const r of value.requests) {
      if (
        !exact(r, ['request_id', 'operation', 'state', 'read_started', 'completed_at']) ||
        seen.has(r.request_id) ||
        !expected.has(r.request_id) ||
        expected.get(r.request_id) !== r.operation ||
        !['completed', 'rejected'].includes(r.state) ||
        typeof r.read_started !== 'boolean' ||
        !time(r.completed_at) ||
        Date.parse(r.completed_at) > clock() + 30000 ||
        (r.state === 'rejected' && r.read_started)
      )
        fail('GATEWAY');
      seen.add(r.request_id);
    }
    const recovery = createApifyRecoveryRuntime(),
      providers = [],
      originals = new Set();
    for (const p of value.providers) {
      if (
        !exact(p, [
          'execution_id',
          'scrape_execution_id',
          'run_status',
          'run_finished_at',
          'terminal_cost_match',
          'launch',
          'registry',
        ]) ||
        !nativeById.has(p.execution_id) ||
        !nativeById.has(p.scrape_execution_id) ||
        p.scrape_execution_id === p.execution_id ||
        !['running', 'success', 'partial', 'failed'].includes(p.run_status) ||
        (!originsOnly && (p.run_status === 'running' || !time(p.run_finished_at))) ||
        (costsChecked ? p.terminal_cost_match !== true : p.terminal_cost_match !== null)
      )
        fail('REGISTRY');
      const parent = nativeById.get(p.execution_id),
        start = nativeById.get(p.scrape_execution_id);
      // SUB-START records its own native execution ID in scrape_runs. The
      // launch admission records the WF-99 parent's ID. They must be distinct
      // and joined by actual reciprocal native linkage, never made equal.
      if (
        parent.key !== 'WF-99' ||
        start.key !== 'SUB-START' ||
        start.mode !== 'integrated' ||
        start.nativeParent?.executionId !== parent.executionId ||
        start.nativeParent?.workflowId !== parent.workflowId ||
        !parent.nativeChildren.some(
          (c) =>
            c.executionId === start.executionId && c.workflowId === start.workflowId && c.key === 'SUB-START',
        )
      )
        fail('REGISTRY');
      const l = p.launch,
        raw = p.registry;
      if (
        !object(l) ||
        l.window_id !== windowId ||
        !uuid(l.launch_id) ||
        l.execution_id !== p.execution_id ||
        l.actor_id !== 'aYG0l9s7dbB7j3gbS' ||
        l.actor_build !== '0.3.99' ||
        !isDeepStrictEqual(l.input, foundationSmokeInput) ||
        l.memory_mb !== 1024 ||
        l.timeout_seconds !== 300 ||
        !Number.isFinite(l.max_total_charge_usd) ||
        l.max_total_charge_usd <= 0 ||
        l.max_total_charge_usd > 1 ||
        !time(l.post_intent_at) ||
        !time(l.reconciled_at) ||
        !object(raw) ||
        !identifier(l.apify_run_id) ||
        l.apify_run_id !== raw.apify_run_id ||
        originals.has(l.apify_run_id)
      )
        fail('REGISTRY');
      const r = recovery.registry(raw, l.apify_run_id),
        saved = recovery.savedReplay(raw, l.apify_run_id);
      if (
        r.run_id !== l.run_id ||
        r.account_ids[0] !== l.account_id ||
        (!originsOnly && (r.processed_at === null || saved === null))
      )
        fail('REGISTRY');
      originals.add(r.apify_run_id);
      providers.push({
        executionId: p.execution_id,
        launch: structuredClone(l),
        registry: structuredClone(raw),
      });
    }
    return providers;
  }
  async function terminal(provider) {
    const r = await bounded(readProvider, { apifyRunId: provider.registry.apify_run_id });
    if (
      !exact(r, ['body', 'transport']) ||
      !exact(r.transport, ['requests', 'retries', 'socketsClosed', 'runBytesMax']) ||
      r.transport.requests !== 1 ||
      r.transport.retries !== 0 ||
      r.transport.socketsClosed !== true ||
      r.transport.runBytesMax !== 65536 ||
      !object(r.body) ||
      !object(r.body.data)
    )
      fail('PROVIDER');
    const d = r.body.data,
      l = provider.launch;
    if (
      d.id !== l.apify_run_id ||
      d.actId !== 'aYG0l9s7dbB7j3gbS' ||
      d.buildId !== 'BdKJRCYsnmlzPfH3n' ||
      d.buildNumber !== '0.3.99' ||
      !time(d.startedAt) ||
      Date.parse(d.startedAt) < Date.parse(l.post_intent_at) - 5000 ||
      Date.parse(d.startedAt) > Date.parse(l.post_intent_at) + 300000 ||
      d.options?.memoryMbytes !== 1024 ||
      d.options?.timeoutSecs !== 300 ||
      d.options?.maxTotalChargeUsd !== l.max_total_charge_usd
    )
      fail('PROVIDER');
    const t = createApifyRecoveryRuntime().projectTerminal(r.body, provider.registry);
    if (
      Date.parse(t.finishedAt) > clock() + 30000 ||
      t.status !== provider.registry.status ||
      t.datasetId !== provider.registry.dataset_id
    )
      fail('PROVIDER');
    return t;
  }
  function checkedNative(caseId, receipts) {
    if (pendingPorts !== 0) fail('PORT_PENDING');
    const started = clock();
    remaining();
    if (
      typeof caseId !== 'string' ||
      !/^[a-zA-Z0-9_.-]{1,100}$/.test(caseId) ||
      !Array.isArray(receipts) ||
      receipts.length < 1 ||
      receipts.length > 120
    )
      fail('ARGS');
    const ids = new Set(),
      nativeById = new Map(),
      expected = new Map();
    for (const value of receipts) {
      const r = assertFoundationNativeReceipt(value);
      if (
        ids.has(r.executionId) ||
        !['success', 'error'].includes(r.status) ||
        r.waitTill !== null ||
        r.privacyChecked !== true ||
        r.transportClosed !== true ||
        !time(r.observedAt) ||
        Date.parse(r.observedAt) < deadlineAt - 3600000 ||
        Date.parse(r.observedAt) > started + 30000 ||
        !Array.isArray(r.nativeGatewayRequests)
      )
        fail('NATIVE');
      ids.add(r.executionId);
      nativeById.set(r.executionId, r);
      for (const q of r.nativeGatewayRequests) {
        if (
          !exact(q, ['requestId', 'operation']) ||
          !uuid(q.requestId) ||
          typeof q.operation !== 'string' ||
          expected.has(q.requestId)
        )
          fail('NATIVE');
        expected.set(q.requestId, q.operation);
      }
    }
    if (expected.size > 256) fail('NATIVE');
    return {
      started,
      ids,
      expected,
      nativeById,
      args: { query: foundationSettlementQuery, params: [windowId, [...expected.keys()], [...ids], '[]'] },
    };
  }
  const origins = (providers, receipts) =>
    providers.map((p) => {
      if (receipts.find((r) => r.executionId === p.executionId)?.key !== 'WF-99') fail('REGISTRY');
      return {
        apifyRunId: p.registry.apify_run_id,
        nativeExecutionId: p.executionId,
        runId: p.registry.run_id,
        accountId: p.registry.account_ids[0],
      };
    });
  const reader = Object.freeze({
    async originals({ caseId, receipts } = {}) {
      if (busy) fail('BUSY');
      busy = true;
      try {
        const { started, ids, expected, nativeById, args } = checkedNative(caseId, receipts);
        const actual = snapshot(await bounded(readGateway, args), expected, nativeById, started, true);
        const proof = freezeRuntimeValue({
          kind: 'foundation_provider_origins',
          caseId,
          windowId,
          executionIds: [...ids],
          providerOrigins: origins(actual, receipts),
          observedAt: new Date(clock()).toISOString(),
          settlementProven: false,
        });
        originProofs.add(proof);
        return proof;
      } catch (e) {
        throw safeError(e);
      } finally {
        busy = false;
      }
    },
    async settle({ caseId, receipts, providerRuns } = {}) {
      if (busy) fail('BUSY');
      busy = true;
      try {
        const { started, ids, expected, nativeById, args } = checkedNative(caseId, receipts);
        if (
          !Array.isArray(providerRuns) ||
          providerRuns.length > 2 ||
          providerRuns.some((x) => !identifier(x)) ||
          new Set(providerRuns).size !== providerRuns.length
        )
          fail('ARGS');
        transportClear();
        const first = snapshot(await bounded(readGateway, args), expected, nativeById, started);
        if (!isDeepStrictEqual(first.map((p) => p.registry.apify_run_id).sort(), [...providerRuns].sort()))
          fail('REGISTRY');
        const recovery = createApifyRecoveryRuntime(),
          providerTerminals = [],
          terminalCosts = [];
        for (const provider of first) {
          const a = await terminal(provider),
            firstAt = clock();
          if (remaining() <= 10000) fail('DEADLINE');
          await bounded(({ signal }) => pause(10000, signal), {}, Math.min(15000, remaining()));
          if (clock() - firstAt < 10000) fail('PROVIDER');
          const b = await terminal(provider);
          const settledTerminal = recovery.settle(a, b, clock() - firstAt);
          terminalCosts.push({
            apify_run_id: settledTerminal.apifyRunId,
            usage_usd: settledTerminal.usageTotalUsd,
          });
          providerTerminals.push({
            apifyRunId: settledTerminal.apifyRunId,
            status: settledTerminal.status,
            wireStatus: settledTerminal.wireStatus,
            finishedAt: settledTerminal.finishedAt,
            costUsd: String(settledTerminal.usageTotalUsd),
          });
        }
        const finalArgs = { ...args, params: [...args.params.slice(0, 3), JSON.stringify(terminalCosts)] };
        const final = snapshot(
          await bounded(readGateway, finalArgs),
          expected,
          nativeById,
          started,
          false,
          true,
        );
        if (!isDeepStrictEqual(first, final)) fail('REGISTRY_CHANGED');
        transportClear();
        remaining();
        const proof = freezeRuntimeValue({
          kind: 'foundation_settlement_receipt',
          caseId,
          windowId,
          executionIds: [...ids],
          gatewayRequestIds: [...expected.keys()],
          providerRunIds: first.map((p) => p.registry.apify_run_id),
          providerOrigins: origins(first, receipts),
          providerTerminals,
          costParityVerified: true,
          startedAt: new Date(started).toISOString(),
          observedAt: new Date(clock()).toISOString(),
          transportSettled: true,
        });
        proofs.add(proof);
        return proof;
      } catch (e) {
        throw safeError(e);
      } finally {
        busy = false;
      }
    },
    state() {
      return Object.freeze({ pendingPortCalls: pendingPorts, busy });
    },
  });
  readers.add(reader);
  return reader;
}
