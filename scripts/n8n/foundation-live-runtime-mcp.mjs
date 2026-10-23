import { randomBytes } from 'node:crypto';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';

const fail = () => Error('FOUNDATION_LIVE_MCP_BLOCKED');
const exact = (v, keys) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const nativeId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const executionId = (v) => typeof v === 'string' && /^[1-9][0-9]{0,19}$/.test(v);

// This fixed external port is NOT a REST /run endpoint. The parent executor
// invokes only the existing installed MCP tool, privately projects its result,
// and returns the nonce-correlated fields below without showing raw tool data.
export function createFoundationLiveMcpBridge(
  { bindings, emit, deadlineAt, now = Date.now },
  dependencies = {},
) {
  const pins = foundationRuntimeCheckpoint.workflows;
  if (
    typeof emit !== 'function' ||
    typeof now !== 'function' ||
    !Number.isFinite(deadlineAt) ||
    deadlineAt <= now() ||
    !bindings?.workflowRefs ||
    Object.keys(bindings.workflowRefs).length !== 25 ||
    Object.keys(pins).some((k) => bindings.workflowRefs[k]?.id !== pins[k].id)
  )
    throw fail();
  const owned = new Set(Object.values(pins).map((v) => v.id));
  const timeoutMs = Math.min(dependencies.timeoutMs ?? 15000, 15000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw fail();
  let pending = null,
    fenced = false,
    closed = false;
  const fence = () => {
    fenced = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(fail());
      pending = null;
    }
  };
  const call = async (action, args) => {
    if (
      closed ||
      fenced ||
      pending ||
      now() >= deadlineAt ||
      !exact(args, action === 'start' ? ['workflowId', 'executionMode'] : ['workflowId']) ||
      !owned.has(args.workflowId) ||
      (action === 'discover' && args.workflowId !== pins['WF-00'].id) ||
      (action === 'start' && args.executionMode !== 'manual')
    )
      throw fail();
    const nonce = randomBytes(16).toString('hex');
    const response = new Promise((resolve, reject) => {
      pending = {
        action,
        nonce,
        workflowId: args.workflowId,
        resolve,
        reject,
        timer: setTimeout(fence, Math.min(timeoutMs, deadlineAt - now())),
      };
    });
    response.catch(() => {});
    try {
      if (
        emit(Object.freeze({ kind: 'mcp_port_request', nonce, action, workflowId: args.workflowId })) !==
        undefined
      )
        fence();
    } catch {
      fence();
    }
    return response;
  };
  return Object.freeze({
    port: Object.freeze({
      discover: (args) => call('discover', args),
      details: (args) => call('details', args),
      start: (args) => call('start', args),
    }),
    accept(message) {
      if (
        closed ||
        fenced ||
        !pending ||
        now() >= deadlineAt ||
        !exact(message, ['kind', 'nonce', 'action', 'workflowId', 'result']) ||
        message.kind !== 'mcp_port_result' ||
        message.nonce !== pending.nonce ||
        message.action !== pending.action ||
        message.workflowId !== pending.workflowId
      )
        return false;
      const r = message.result;
      if (r === null) {
        fence();
        return true;
      }
      const valid =
        message.action === 'start'
          ? exact(r, ['status', 'executionId']) && r.status === 'started' && executionId(r.executionId)
          : message.action === 'discover'
            ? exact(r, ['id', 'name', 'active', 'availableInMCP']) &&
              r.id === pins['WF-00'].id &&
              r.name === bindings.workflowRefs['WF-00'].name &&
              r.active === false &&
              r.availableInMCP === false
            : exact(r, ['id', 'versionId', 'canExecute', 'scopes']) &&
              r.id === pending.workflowId &&
              nativeId(r.versionId) &&
              typeof r.canExecute === 'boolean' &&
              Array.isArray(r.scopes) &&
              r.scopes.length <= 64 &&
              r.scopes.every((v) => typeof v === 'string' && /^[a-zA-Z0-9:_*-]{1,80}$/.test(v));
      if (!valid) return false;
      const done = pending;
      pending = null;
      clearTimeout(done.timer);
      done.resolve(Object.freeze(structuredClone(r)));
      return true;
    },
    state: () => Object.freeze({ pending: pending !== null, fenced, closed }),
    close() {
      closed = true;
      fence();
    },
  });
}
