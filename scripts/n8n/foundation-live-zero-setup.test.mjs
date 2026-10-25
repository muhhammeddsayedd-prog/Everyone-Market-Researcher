import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyFoundationLiveZeroSetup,
  assertFoundationLiveZeroSetupProof,
  foundationZeroSetupCheckpoint as c,
} from './foundation-live-zero-setup.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
function fixture() {
  const files = new Map([
      [resolve(repo, c.closureRelative), readFileSync(join(repo, c.closureRelative), 'utf8')],
      [
        resolve(repo, c.managementRelative),
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: c.sourceCommitSha,
          deadlineAt: c.deadlineAt,
        }) + '\n',
      ],
    ]),
    links = new Set();
  const known = new Set(
    [c.closureRelative, c.managementRelative, ...c.emptyRelatives, ...c.absentRelatives].map((p) =>
      resolve(repo, p),
    ),
  );
  const deps = {
    readFileSync(path) {
      if (!files.has(path)) throw Object.assign(Error('fixture_missing'), { code: 'ENOENT' });
      return files.get(path);
    },
    lstatSync(path) {
      if (known.has(path) && !files.has(path))
        throw Object.assign(Error('fixture_missing'), { code: 'ENOENT' });
      return {
        isSymbolicLink: () => links.has(path),
        isFile: () => files.has(path),
        size: files.has(path) ? Buffer.byteLength(files.get(path)) : 0,
      };
    },
  };
  const verify = (now = () => c.deadlineAt - 1800000) => verifyFoundationLiveZeroSetup({ now }, deps);
  return { files, links, deps, verify, path: (relative) => resolve(repo, relative) };
}
test('only exact closed zero-effect checkpoint mints a real original-clock brand without writing', () => {
  const f = fixture(),
    before = [...f.files];
  const p = f.verify();
  assert.equal(assertFoundationLiveZeroSetupProof(p), p);
  assert.equal(p.deadlineAt, c.deadlineAt);
  assert.equal(p.stopNewAt, c.deadlineAt - 600000);
  assert.equal(p.hardDeadlineAt, c.deadlineAt + 600000);
  assert.deepEqual([...f.files], before);
  assert.throws(() => assertFoundationLiveZeroSetupProof({ ...p }), /M03_ZERO_SETUP_BLOCKED/);
  assert.throws(
    () =>
      verifyFoundationLiveZeroSetup({ now: () => c.deadlineAt - 1800000, deadlineAt: c.deadlineAt }, f.deps),
    /M03_ZERO_SETUP_BLOCKED/,
  );
  for (const relative of c.emptyRelatives) f.files.set(f.path(relative), '');
  assert.equal(f.verify().deadlineAt, c.deadlineAt);
});
test('physical closure provenance missing or modified cannot be replaced by zero counters', () => {
  const f = fixture();
  f.files.delete(f.path(c.closureRelative));
  assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
  const g = fixture();
  const receipt = JSON.parse(g.files.get(g.path(c.closureRelative)));
  receipt.nodeClosed = false;
  g.files.set(g.path(c.closureRelative), JSON.stringify(receipt));
  assert.throws(() => g.verify(), /M03_ZERO_SETUP_BLOCKED/);
});
test('any attempt, malformed header, alternate source or fresh deadline blocks continuation', () => {
  for (const change of [
    (h) => ({ ...h, deadlineAt: h.deadlineAt + 1 }),
    (h) => ({ ...h, sourceCommitSha: 'a'.repeat(40) }),
    (h) => ({ ...h, extra: true }),
  ]) {
    const f = fixture(),
      path = f.path(c.managementRelative);
    f.files.set(path, JSON.stringify(change(JSON.parse(f.files.get(path)))) + '\n');
    assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
  }
  const f = fixture(),
    path = f.path(c.managementRelative);
  f.files.set(path, f.files.get(path) + JSON.stringify({ event: 'management_attempt', ordinal: 1 }) + '\n');
  assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
  const g = fixture();
  g.files.set(g.path(c.managementRelative), g.files.get(g.path(c.managementRelative)).trimEnd());
  assert.throws(() => g.verify(), /M03_ZERO_SETUP_BLOCKED/);
});
test('any native/setup/preflight/runtime event or database side-effect artifact blocks continuation', () => {
  for (const relative of [...c.emptyRelatives, ...c.absentRelatives]) {
    const f = fixture();
    f.files.set(f.path(relative), '{}\n');
    assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
  }
});
test('linked input/ancestor, wrong file kind and crossing original minute50 all fail closed', () => {
  const f = fixture();
  f.links.add(f.path(c.managementRelative));
  assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
  const g = fixture();
  g.links.add(resolve(repo, 'scripts'));
  assert.throws(() => g.verify(), /M03_ZERO_SETUP_BLOCKED/);
  const h = fixture();
  h.deps.lstatSync = () => ({ isSymbolicLink: () => false, isFile: () => false, size: 0 });
  assert.throws(() => h.verify(), /M03_ZERO_SETUP_BLOCKED/);
  for (const now of [
    () => c.deadlineAt - 3600001,
    () => c.deadlineAt - 600000,
    () => c.deadlineAt,
    () => NaN,
  ])
    assert.throws(() => fixture().verify(now), /M03_ZERO_SETUP_BLOCKED/);
});
test('changed second management read is not an adoptable checkpoint', () => {
  const f = fixture(),
    read = f.deps.readFileSync;
  let count = 0;
  f.deps.readFileSync = (path, ...args) => {
    const text = read(path, ...args);
    return path === f.path(c.managementRelative) && ++count > 1 ? text + '{}\n' : text;
  };
  assert.throws(() => f.verify(), /M03_ZERO_SETUP_BLOCKED/);
});
