import { randomBytes } from 'node:crypto';
import { assertFoundationSettlementReceipt } from './foundation-native-settlement.mjs';

const wires = new WeakMap(),
  factories = new WeakSet();
const unknownId = 'M03AcceptanceUnknown0001';
export const foundationUnknownCallbackQuery = `select jsonb_build_object(
  'apify_run_id','M03AcceptanceUnknown0001',
  'registry_absent',not exists(select 1 from ops.apify_runs where apify_run_id='M03AcceptanceUnknown0001'),
  'launch_absent',not exists(select 1 from ops.apify_launch_admissions where apify_run_id='M03AcceptanceUnknown0001'),
  'observed_at',clock_timestamp()) as unknown_callback;`;
export const foundationCallbackCaseIds = Object.freeze([
  'callback.unknown',
  'callback.equal_replay',
  'callback.concurrent_a',
  'callback.concurrent_b',
  'callback.recovery_drill',
]);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const fail = () => {
  throw Error('FOUNDATION_CALLBACK_CASE_BLOCKED');
};
const events = Object.freeze({
  SUCCEEDED: 'ACTOR.RUN.SUCCEEDED',
  FAILED: 'ACTOR.RUN.FAILED',
  TIMED_OUT: 'ACTOR.RUN.TIMED_OUT',
  ABORTED: 'ACTOR.RUN.ABORTED',
});
function freeze(v) {
  if (v && typeof v === 'object') {
    for (const c of Object.values(v)) freeze(c);
    Object.freeze(v);
  }
  return v;
}
export function assertFoundationCallbackCases(factory) {
  if (!factories.has(factory)) fail();
  return factory;
}
export function assertFoundationCallbackCase(wire) {
  if (!wires.has(wire)) fail();
  return wire;
}
// This one-shot fence is acquired BEFORE DNS. Unknown delivery is never a
// license to re-POST. The controller's durable batch ledger owns crash recovery.
export function consumeFoundationCallbackCase(wire) {
  const s = wires.get(wire);
  if (!s || s.consumed) fail();
  s.consumed = true;
  if (s.now() >= s.expiresAt) fail();
  return { traceparent: wire.traceparent, body: JSON.stringify(wire.body) };
}
export function createFoundationCallbackCases({ readUnknown, now, deadlineAt } = {}) {
  if (typeof readUnknown !== 'function' || typeof now !== 'function' || !Number.isSafeInteger(deadlineAt))
    fail();
  const clock = () => {
    const t = now();
    if (!Number.isSafeInteger(t) || t < 0 || t >= deadlineAt) fail();
    return t;
  };
  clock();
  const prepared = new Set();
  let busy = false,
    pending = 0;
  const factory = Object.freeze({
    async prepare(input) {
      if (
        busy ||
        pending ||
        !object(input) ||
        !foundationCallbackCaseIds.includes(input.caseId) ||
        prepared.has(input.caseId)
      )
        fail();
      const unknown = input.caseId === 'callback.unknown';
      if (!exact(input, unknown ? ['caseId'] : ['caseId', 'settlementReceipt'])) fail();
      busy = true;
      try {
        const started = clock();
        let apifyRunId, eventType;
        if (unknown) {
          const controller = new AbortController();
          let timer;
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(
              () => {
                controller.abort();
                reject(Error('FOUNDATION_CALLBACK_CASE_BLOCKED'));
              },
              Math.min(15000, deadlineAt - started),
            );
          });
          pending++;
          const work = Promise.resolve()
            .then(() => {
              clock();
              return readUnknown({
                query: foundationUnknownCallbackQuery,
                params: [],
                signal: controller.signal,
              });
            })
            .finally(() => {
              pending--;
            });
          let result;
          try {
            result = await Promise.race([work, timeout]);
          } finally {
            clearTimeout(timer);
            controller.abort();
          }
          if (
            !exact(result, ['apify_run_id', 'registry_absent', 'launch_absent', 'observed_at']) ||
            result.apify_run_id !== unknownId ||
            result.registry_absent !== true ||
            result.launch_absent !== true ||
            typeof result.observed_at !== 'string' ||
            !Number.isFinite(Date.parse(result.observed_at)) ||
            Date.parse(result.observed_at) < started - 15000 ||
            Date.parse(result.observed_at) > clock() + 30000
          )
            fail();
          apifyRunId = unknownId;
          eventType = events.SUCCEEDED;
        } else {
          const proof = assertFoundationSettlementReceipt(input.settlementReceipt);
          if (
            proof.caseId !== 'smoke.first' ||
            proof.costParityVerified !== true ||
            proof.providerRunIds.length !== 1 ||
            proof.providerOrigins.length !== 1 ||
            proof.providerTerminals.length !== 1
          )
            fail();
          const original = proof.providerOrigins[0],
            terminal = proof.providerTerminals[0];
          if (
            original.apifyRunId !== proof.providerRunIds[0] ||
            terminal.apifyRunId !== original.apifyRunId ||
            !events[terminal.status] ||
            !proof.executionIds.includes(original.nativeExecutionId)
          )
            fail();
          apifyRunId = original.apifyRunId;
          eventType = events[terminal.status];
        }
        const traceparent =
          '00-' + randomBytes(16).toString('hex') + '-' + randomBytes(8).toString('hex') + '-01';
        const wire = freeze({
          kind: 'foundation_callback_case',
          caseId: input.caseId,
          traceparent,
          body: { eventType, resource: { id: apifyRunId } },
          expectedApifyRunId: apifyRunId,
          expectedEventType: eventType,
          acknowledgementMode:
            input.caseId === 'callback.recovery_drill' ? 'withhold_after_private_check' : 'normal',
          source: 'fixed_unknown_sql_absence_or_processed_original_settlement',
          strongerRecoveryProven: false,
        });
        wires.set(wire, { consumed: false, now: clock, expiresAt: Math.min(deadlineAt, clock() + 15000) });
        prepared.add(input.caseId);
        return wire;
      } catch {
        fail();
      } finally {
        busy = false;
      }
    },
    state() {
      return Object.freeze({ preparedCases: prepared.size, pendingQueries: pending, busy });
    },
  });
  factories.add(factory);
  return factory;
}
