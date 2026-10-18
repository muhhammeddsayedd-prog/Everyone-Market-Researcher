import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const GW01_WINDOW_ID = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
const uuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const operations = [
  'identity.read',
  'request.status',
  'settings.read',
  'prices.read',
  'health.read',
  'error.count',
  'error.log',
];
const fail = (code) => {
  throw Error(code);
};
const exact = (v, keys) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const iso = (v) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(Date.parse(v)).toISOString() === v;
function directory(path) {
  let cursor = resolve(path);
  for (;;) {
    const s = lstatSync(cursor);
    if (!s.isDirectory() || s.isSymbolicLink()) fail('GW01_PATH_REJECTED');
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolve(path);
}

/** Durable public accounting only. No credential, body, hash or raw error enters
 * this journal. A crashed reservation/lock is retained for reconciliation. This
 * coordinator does not replace the independently persisted server admission. */
export function createTrialCoordinator(path, config, clock = () => Date.now()) {
  const root = directory(path),
    file = join(root, 'gw01-trial.jsonl'),
    lock = join(root, 'gw01-trial.lock');
  if (
    !exact(config, ['windowId', 'audiences']) ||
    config.windowId !== GW01_WINDOW_ID ||
    !Array.isArray(config.audiences) ||
    config.audiences.length < 1 ||
    config.audiences.length > 10 ||
    new Set(config.audiences).size !== config.audiences.length
  )
    fail('GW01_INPUT_REJECTED');
  const audiences = config.audiences.map((v) => {
    let u;
    try {
      u = new URL(v);
    } catch {
      fail('GW01_INPUT_REJECTED');
    }
    if (
      u.protocol !== 'https:' ||
      u.origin !== v ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.startsWith('everyone-market-researcher-') ||
      !u.hostname.endsWith('.vercel.app')
    )
      fail('GW01_INPUT_REJECTED');
    return v;
  });
  const now = () => {
    const n = clock();
    if (!Number.isSafeInteger(n) || n < 0) fail('GW01_CLOCK_REJECTED');
    return n;
  };
  function deployment(v) {
    if (
      !exact(v, ['audience', 'commitSha', 'deploymentId', 'projectId', 'branch']) ||
      v.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
      v.branch !== 'm03-n8n-foundation' ||
      typeof v.commitSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(v.commitSha) ||
      typeof v.deploymentId !== 'string' ||
      !/^dpl_[A-Za-z0-9]{16,80}$/.test(v.deploymentId)
    )
      fail('GW01_INPUT_REJECTED');
    let u;
    try {
      u = new URL(v.audience);
    } catch {
      fail('GW01_INPUT_REJECTED');
    }
    if (
      u.protocol !== 'https:' ||
      u.origin !== v.audience ||
      u.port ||
      u.username ||
      u.password ||
      !u.hostname.startsWith('everyone-market-researcher-') ||
      !u.hostname.endsWith('.vercel.app')
    )
      fail('GW01_INPUT_REJECTED');
    return { ...v };
  }
  function locked(fn) {
    let fd;
    try {
      fd = openSync(lock, 'wx', 0o600);
    } catch {
      fail('GW01_LOCKED_RECONCILE');
    }
    try {
      return fn();
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
  function load() {
    let text;
    try {
      const s = lstatSync(file);
      if (!s.isFile() || s.isSymbolicLink() || s.size > 1048576) fail('x');
      text = readFileSync(file, 'utf8');
    } catch {
      fail('GW01_STATE_REJECTED');
    }
    if (!text.endsWith('\n')) fail('GW01_STATE_REJECTED');
    let events;
    try {
      events = text
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
    } catch {
      fail('GW01_STATE_REJECTED');
    }
    const first = events[0];
    if (
      !exact(first, ['seq', 'type', 'windowId', 'audiences']) ||
      first.seq !== 0 ||
      first.type !== 'prepared' ||
      first.windowId !== GW01_WINDOW_ID ||
      JSON.stringify(first.audiences) !== JSON.stringify(audiences)
    )
      fail('GW01_STATE_REJECTED');
    let startedAt = null,
      expiresAt = null,
      closed = false,
      bound = false,
      databaseStartedAt = null,
      databaseExpiresAt = null,
      attempts = 0,
      lastAt = 0;
    const inFlight = new Map(),
      ids = new Set(),
      rejected = new Set(),
      deployments = new Map(),
      targets = new Set(audiences);
    for (let index = 1; index < events.length; index++) {
      const e = events[index];
      if (!e || e.seq !== index || !Number.isSafeInteger(e.at) || e.at < lastAt) fail('GW01_STATE_REJECTED');
      lastAt = e.at;
      if (e.type === 'deployment') {
        if (
          !exact(e, ['seq', 'type', 'at', 'target']) ||
          (startedAt !== null && !closed) ||
          targets.has(e.target?.audience) ||
          targets.size >= 10
        )
          fail('GW01_STATE_REJECTED');
        const target = deployment(e.target);
        targets.add(target.audience);
        deployments.set(target.audience, target);
      } else if (e.type === 'started') {
        if (!exact(e, ['seq', 'type', 'at']) || startedAt !== null || closed || inFlight.size !== 0)
          fail('GW01_STATE_REJECTED');
        startedAt = new Date(e.at).toISOString();
        expiresAt = new Date(e.at + 1800000).toISOString();
      } else if (e.type === 'bound') {
        if (
          !exact(e, ['seq', 'type', 'at', 'startsAt', 'expiresAt']) ||
          startedAt === null ||
          bound ||
          !iso(e.startsAt) ||
          !iso(e.expiresAt) ||
          Date.parse(e.expiresAt) - Date.parse(e.startsAt) !== 1800000 ||
          Date.parse(e.startsAt) < Date.parse(startedAt) - 30000 ||
          Date.parse(e.startsAt) > e.at + 5000 ||
          Date.parse(e.expiresAt) > Date.parse(expiresAt) + 30000
        )
          fail('GW01_STATE_REJECTED');
        databaseStartedAt = e.startsAt;
        databaseExpiresAt = e.expiresAt;
        expiresAt = new Date(Math.min(Date.parse(expiresAt), Date.parse(e.expiresAt))).toISOString();
        bound = true;
      } else if (e.type === 'reserved') {
        if (
          !exact(e, ['seq', 'type', 'at', 'attemptId', 'requestId', 'operation', 'audience', 'kind']) ||
          (startedAt === null && !(e.kind === 'preflight' || (closed && e.kind === 'shutdown'))) ||
          (startedAt !== null && e.at >= Date.parse(expiresAt)) ||
          !uuid(e.attemptId) ||
          !uuid(e.requestId) ||
          ids.has(e.attemptId) ||
          !operations.includes(e.operation) ||
          !targets.has(e.audience) ||
          !['ordinary', 'denial', 'status', 'shutdown', 'preflight'].includes(e.kind) ||
          (e.kind === 'preflight' && e.operation !== 'identity.read') ||
          inFlight.size >= 2 ||
          attempts >= 100 ||
          (attempts >= 85 && !['status', 'shutdown'].includes(e.kind)) ||
          (closed && e.kind !== 'shutdown')
        )
          fail('GW01_STATE_REJECTED');
        attempts++;
        ids.add(e.attemptId);
        inFlight.set(e.attemptId, e);
      } else if (e.type === 'finished') {
        if (
          !exact(e, ['seq', 'type', 'at', 'attemptId', 'outcome', 'httpStatus']) ||
          !inFlight.has(e.attemptId) ||
          !['http', 'unknown', 'cancelled'].includes(e.outcome) ||
          !(
            e.httpStatus === null ||
            (Number.isInteger(e.httpStatus) && e.httpStatus >= 100 && e.httpStatus <= 599)
          ) ||
          (e.outcome === 'http') !== (e.httpStatus !== null)
        )
          fail('GW01_STATE_REJECTED');
        const attempt = inFlight.get(e.attemptId);
        if (attempt.kind === 'shutdown' && [401, 403, 410].includes(e.httpStatus))
          rejected.add(attempt.audience);
        inFlight.delete(e.attemptId);
      } else if (e.type === 'closed') {
        if (!exact(e, ['seq', 'type', 'at']) || closed) fail('GW01_STATE_REJECTED');
        closed = true;
      } else fail('GW01_STATE_REJECTED');
    }
    return {
      events,
      lastAt,
      startedAt,
      expiresAt,
      bound,
      databaseStartedAt,
      databaseExpiresAt,
      closed,
      attempts,
      inFlight,
      verifiedRejectedAudiences: [...rejected],
      audiences: [...targets],
      deployments,
    };
  }
  function append(state, event) {
    const at = now();
    if (at < state.lastAt) fail('GW01_CLOCK_REJECTED');
    const e = { seq: state.events.length, ...event, at };
    const fd = openSync(file, 'a');
    try {
      writeSync(fd, JSON.stringify(e) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return e;
  }
  function snapshot() {
    const s = load();
    return {
      windowId: GW01_WINDOW_ID,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      authoritativeWindowBound: s.bound,
      databaseStartedAt: s.databaseStartedAt,
      databaseExpiresAt: s.databaseExpiresAt,
      closed: s.closed,
      attempts: s.attempts,
      inFlight: s.inFlight.size,
      remaining: 100 - s.attempts,
      verifiedRejectedAudiences: s.verifiedRejectedAudiences,
      unverifiedAudiences: s.audiences.filter((a) => !s.verifiedRejectedAudiences.includes(a)),
    };
  }
  function prepare() {
    return locked(() => {
      let fd;
      try {
        fd = openSync(file, 'wx', 0o600);
      } catch {
        fail('GW01_ALREADY_PREPARED');
      }
      try {
        writeSync(
          fd,
          JSON.stringify({ seq: 0, type: 'prepared', windowId: GW01_WINDOW_ID, audiences }) + '\n',
        );
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      return snapshot();
    });
  }
  function start() {
    return locked(() => {
      const s = load();
      if (s.startedAt !== null) fail('GW01_ALREADY_STARTED');
      if (s.closed) fail('GW01_CLOSED');
      if (s.inFlight.size !== 0) fail('GW01_IN_FLIGHT');
      append(s, { type: 'started' });
      return snapshot();
    });
  }
  function bindDatabaseWindow(value) {
    return locked(() => {
      const s = load();
      if (s.bound) fail('GW01_WINDOW_ALREADY_BOUND');
      if (
        !exact(value, ['windowId', 'startedAt', 'expiresAt']) ||
        value.windowId !== GW01_WINDOW_ID ||
        !iso(value.startedAt) ||
        !iso(value.expiresAt) ||
        Date.parse(value.expiresAt) - Date.parse(value.startedAt) !== 1800000 ||
        s.startedAt === null ||
        Date.parse(value.startedAt) < Date.parse(s.startedAt) - 30000 ||
        Date.parse(value.startedAt) > now() + 5000 ||
        Date.parse(value.expiresAt) > Date.parse(s.expiresAt) + 30000
      )
        fail('GW01_WINDOW_REJECTED');
      append(s, { type: 'bound', startsAt: value.startedAt, expiresAt: value.expiresAt });
      return snapshot();
    });
  }
  function reserve(value) {
    return locked(() => {
      if (
        !exact(value, ['requestId', 'operation', 'audience', 'kind']) ||
        !uuid(value.requestId) ||
        !operations.includes(value.operation) ||
        !['ordinary', 'denial', 'status', 'shutdown', 'preflight'].includes(value.kind) ||
        (value.kind === 'preflight' && value.operation !== 'identity.read')
      )
        fail('GW01_INPUT_REJECTED');
      const s = load();
      if (!s.audiences.includes(value.audience)) fail('GW01_INPUT_REJECTED');
      if (s.startedAt === null && !(value.kind === 'preflight' || (s.closed && value.kind === 'shutdown')))
        fail('GW01_NOT_STARTED');
      if (s.startedAt !== null && now() >= Date.parse(s.expiresAt)) fail('GW01_EXPIRED');
      if (s.attempts >= 100) fail('GW01_ATTEMPT_LIMIT');
      if (s.closed && value.kind !== 'shutdown') fail('GW01_CLOSED');
      if (s.attempts >= 85 && !['status', 'shutdown'].includes(value.kind)) fail('GW01_CLOSURE_RESERVE');
      if (s.inFlight.size >= 2) fail('GW01_PARALLEL_LIMIT');
      return append(s, { type: 'reserved', attemptId: randomUUID(), ...value });
    });
  }
  function finish(attemptId, result) {
    return locked(() => {
      if (
        !uuid(attemptId) ||
        !exact(result, ['outcome', 'httpStatus']) ||
        !['http', 'unknown', 'cancelled'].includes(result.outcome) ||
        !(
          result.httpStatus === null ||
          (Number.isInteger(result.httpStatus) && result.httpStatus >= 100 && result.httpStatus <= 599)
        ) ||
        (result.outcome === 'http') !== (result.httpStatus !== null)
      )
        fail('GW01_INPUT_REJECTED');
      const s = load();
      if (!s.inFlight.has(attemptId)) fail('GW01_ATTEMPT_UNKNOWN');
      append(s, { type: 'finished', attemptId, ...result });
      return snapshot();
    });
  }
  function close() {
    return locked(() => {
      const s = load();
      if (!s.closed) append(s, { type: 'closed' });
      return snapshot();
    });
  }
  function registerDeployment(value) {
    return locked(() => {
      const target = deployment(value),
        s = load();
      if (s.startedAt !== null && !s.closed) fail('GW01_TARGET_PHASE_REJECTED');
      if (s.audiences.includes(target.audience) || s.audiences.length >= 10)
        fail('GW01_TARGET_PHASE_REJECTED');
      append(s, { type: 'deployment', target });
      return snapshot();
    });
  }
  function assertDeployment(value, initialBinding) {
    const target = deployment(value),
      s = load(),
      expected = audiences.includes(target.audience)
        ? deployment(initialBinding)
        : s.deployments.get(target.audience);
    if (
      !expected ||
      !['audience', 'commitSha', 'deploymentId', 'projectId', 'branch'].every(
        (key) => target[key] === expected[key],
      )
    )
      fail('GW01_DEPLOYMENT_REJECTED');
    return true;
  }
  async function attempt(value, send) {
    if (typeof send !== 'function') fail('GW01_INPUT_REJECTED');
    const reservation = reserve(value);
    let response;
    try {
      response = await send();
      if (!response || !Number.isInteger(response.status) || response.status < 100 || response.status > 599)
        fail('GW01_TRANSPORT_UNKNOWN');
    } catch {
      finish(reservation.attemptId, { outcome: 'unknown', httpStatus: null });
      fail('GW01_TRANSPORT_UNKNOWN');
    }
    finish(reservation.attemptId, { outcome: 'http', httpStatus: response.status });
    return response;
  }
  return {
    prepare,
    start,
    bindDatabaseWindow,
    reserve,
    finish,
    close,
    snapshot,
    attempt,
    registerDeployment,
    assertDeployment,
  };
}
