import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const proofs = new WeakSet();
export const foundationZeroSetupCheckpoint = Object.freeze({
  sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  deadlineAt: 1792584023481,
  closureRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-zero-setup-20261021.json',
  closureSha256: '6af79fc35a6e71fb323ca262092cfe015fd26a3422f5ce43b140f92caba1a28d',
  managementRelative: 'scripts/n8n/out/foundation/live/management.jsonl',
  emptyRelatives: Object.freeze(
    ['control', 'preflight', 'setup', 'runtime'].map(
      (k) => 'scripts/n8n/out/foundation/live/' + k + '.jsonl',
    ),
  ),
  absentRelatives: Object.freeze([
    'scripts/n8n/out/foundation/live/runtime.operation.lock',
    'scripts/db/out/m03-foundation-dev-migration-attempt.json',
    'scripts/db/out/m03-foundation-owner-provision-attempt.json',
    'scripts/db/out/m03-foundation-dev-migration-latest.json',
    'scripts/db/out/m03-foundation-hosted-db.types.ts',
  ]),
});
const fail = () => {
  throw Error('M03_ZERO_SETUP_BLOCKED');
};
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));

// This is only the one historically verified, physically closed, zero-effect
// checkpoint. It cannot adopt another journal, source, execution or clock.
// The optional read-only IO ports are explicit synthetic-test dependencies;
// the actual public entry and CLI never replace them.
export function verifyFoundationLiveZeroSetup(options = {}, dependencies = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((k) => k !== 'now') ||
    !dependencies ||
    typeof dependencies !== 'object' ||
    Array.isArray(dependencies)
  )
    fail();
  const now = options.now ?? Date.now;
  if (
    typeof now !== 'function' ||
    Object.keys(dependencies).some((k) => !['readFileSync', 'lstatSync'].includes(k))
  )
    fail();
  const read = dependencies.readFileSync ?? readFileSync,
    stat = dependencies.lstatSync ?? lstatSync;
  if (
    typeof read !== 'function' ||
    typeof stat !== 'function' ||
    !Number.isFinite(now()) ||
    now() < foundationZeroSetupCheckpoint.deadlineAt - 3600000 ||
    now() >= foundationZeroSetupCheckpoint.deadlineAt - 600000
  )
    fail();
  const physical = (path, optional = false) => {
    let leaf;
    for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
      try {
        const s = stat(cursor);
        if (s.isSymbolicLink()) fail();
        if (cursor === resolve(path)) leaf = s;
      } catch (error) {
        if (error?.code !== 'ENOENT') fail();
        if (cursor === resolve(path) && !optional) fail();
      }
      if (dirname(cursor) === cursor) break;
    }
    return leaf;
  };
  const file = (relative, optional = false) => {
    const path = join(repo, relative),
      s = physical(path, optional);
    if (!s) return null;
    if (!s.isFile() || !Number.isSafeInteger(s.size) || s.size > 131072) fail();
    const text = read(path, 'utf8');
    if (typeof text !== 'string' || Buffer.byteLength(text) !== s.size) fail();
    return text;
  };
  try {
    const c = foundationZeroSetupCheckpoint;
    const closed = file(c.closureRelative);
    if (createHash('sha256').update(closed).digest('hex') !== c.closureSha256) fail();
    const expected = {
      kind: 'm03_zero_setup_physical_closure',
      version: 1,
      sourceCommitSha: c.sourceCommitSha,
      windowId: c.windowId,
      deadlineAt: c.deadlineAt,
      wrapperNativeExit: 1,
      nodeClosed: true,
      wrapperClosed: true,
      credentialChildrenClosed: true,
      consumedRuntimeHandoffsDeleted: true,
      administratorStarted: false,
      managementAttempts: 0,
      controlAttempts: 0,
      nativeExecutions: 0,
      gatewayPreflightAttempts: 0,
      providerDirectAttempts: 0,
    };
    const actual = JSON.parse(closed);
    if (!exact(actual, Object.keys(expected)) || Object.keys(expected).some((k) => actual[k] !== expected[k]))
      fail();
    const text = file(c.managementRelative);
    if (!text.endsWith('\n') || text.slice(0, -1).includes('\n')) fail();
    const h = JSON.parse(text.slice(0, -1));
    if (
      !exact(h, ['event', 'version', 'sourceCommitSha', 'deadlineAt']) ||
      h.event !== 'management_header' ||
      h.version !== 1 ||
      h.sourceCommitSha !== c.sourceCommitSha ||
      h.deadlineAt !== c.deadlineAt
    )
      fail();
    for (const relative of c.emptyRelatives) {
      const text = file(relative, true);
      if (text !== null && text !== '') fail();
    }
    for (const relative of c.absentRelatives) {
      if (physical(join(repo, relative), true)) fail();
    }
    if (file(c.managementRelative) !== text || now() >= c.deadlineAt - 600000) fail();
    const proof = Object.freeze({
      kind: 'foundation_zero_setup_resume',
      sourceCommitSha: c.sourceCommitSha,
      windowId: c.windowId,
      deadlineAt: c.deadlineAt,
      stopNewAt: c.deadlineAt - 600000,
      hardDeadlineAt: c.deadlineAt + 600000,
    });
    proofs.add(proof);
    return proof;
  } catch {
    fail();
  }
}
export function assertFoundationLiveZeroSetupProof(proof) {
  if (!proofs.has(proof) || !Object.isFrozen(proof)) fail();
  return proof;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'CheckOnly') fail();
    const p = verifyFoundationLiveZeroSetup();
    process.stdout.write(
      JSON.stringify({
        kind: 'zero_setup_ready',
        deadlineAt: p.deadlineAt,
        sourceCommitSha: p.sourceCommitSha,
        windowId: p.windowId,
        privateRead: false,
        networkRequests: 0,
      }) + '\n',
    );
  } catch {
    process.stdout.write('{"kind":"zero_setup_blocked","privateRead":false,"networkRequests":0}\n');
    process.exitCode = 1;
  }
}
