import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createOwnedStagingExportWriter } from './foundation-export.mjs';
import { writeCompleteSync } from './foundation-export.mjs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const secrets = ['PUBLIC_SYNTHETIC_MANAGEMENT', 'PUBLIC_SYNTHETIC_MACHINE'];
const sample = () => ({
  key: 'WF-10',
  id: 'Owned1',
  versionId: 'Version1',
  active: false,
  activeVersionId: null,
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflow: { name: 'WF-10 · Vimeo collector [dev]', nodes: [], connections: {}, settings: {} },
  definitionProfile: 'inactive_native_staging',
  deferredErrorWorkflowId: 'OwnedError90',
  intendedSourceHash: 'a'.repeat(64),
  stagedSourceHash: 'b'.repeat(64),
  canonicalParity: false,
});
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-export-unit-'));
  try {
    return run(root);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-foundation-export-unit-'));
    rmSync(root, { recursive: true, force: true });
  }
}
test('checked actual staging export is complete before return and known same-source version refresh is allowed', () =>
  fixture((root) => {
    const write = createOwnedStagingExportWriter(root, secrets),
      record = sample();
    write(record);
    const path = join(root, 'n8n/workflows/WF-10.json'),
      saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.kind, 'actual_saved_inactive_foundation_staging');
    assert.equal(saved.windowId, 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
    assert.equal(saved.canonicalParity, false);
    assert.equal(existsSync(path + '.pending'), false);
    write({ ...record, versionId: 'Version2' });
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).versionId, 'Version2');
  }));
test('secret reflection is blocked before directory or per-record persistence', () =>
  fixture((root) => {
    const record = sample();
    record.workflow.settings.unexpected = secrets[0];
    assert.throws(
      () => createOwnedStagingExportWriter(root, secrets)(record),
      /^Error: FOUNDATION_EXPORT_BLOCKED$/,
    );
    assert.equal(existsSync(join(root, 'n8n')), false);
  }));
test('unknown existing export and owned-source drift are never overwritten', () =>
  fixture((root) => {
    const directory = join(root, 'n8n/workflows');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'WF-10.json');
    writeFileSync(path, 'PUBLIC_UNRELATED_EXPORT');
    assert.throws(() => createOwnedStagingExportWriter(root, secrets)(sample()));
    assert.equal(readFileSync(path, 'utf8'), 'PUBLIC_UNRELATED_EXPORT');
    rmSync(path);
    const write = createOwnedStagingExportWriter(root, secrets);
    write(sample());
    const prior = readFileSync(path);
    assert.throws(() => write({ ...sample(), intendedSourceHash: 'c'.repeat(64) }));
    assert.equal(readFileSync(path).equals(prior), true);
  }));
test('an unknown pending export is preserved and blocks another attempt', () =>
  fixture((root) => {
    const directory = join(root, 'n8n/workflows');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'WF-10.json.pending');
    writeFileSync(path, 'PUBLIC_UNKNOWN_PENDING');
    assert.throws(() => createOwnedStagingExportWriter(root, secrets)(sample()));
    assert.equal(readFileSync(path, 'utf8'), 'PUBLIC_UNKNOWN_PENDING');
    assert.equal(existsSync(join(directory, 'WF-10.json')), false);
  }));
test('native short writes complete every export byte before publication and every journal byte before acknowledgement', () =>
  fixture((root) => {
    const original = fs.writeSync;
    try {
      fs.writeSync = (fd, buffer, offset, length) => original(fd, buffer, offset, Math.min(length, 7));
      syncBuiltinESMExports();
      createOwnedStagingExportWriter(root, secrets)(sample());
      assert.equal(JSON.parse(readFileSync(join(root, 'n8n/workflows/WF-10.json'), 'utf8')).id, 'Owned1');
      const journal = join(root, 'public-journal.jsonl'),
        fd = fs.openSync(journal, 'wx');
      try {
        writeCompleteSync(fd, '{"version":1}\n');
        writeCompleteSync(fd, '{"event":"intent","key":"WF-10"}\n');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse), [
        { version: 1 },
        { event: 'intent', key: 'WF-10' },
      ]);
    } finally {
      fs.writeSync = original;
      syncBuiltinESMExports();
    }
  }));
test('zero-progress native writes cannot publish or acknowledge complete journal data', () =>
  fixture((root) => {
    const original = fs.writeSync;
    try {
      fs.writeSync = () => 0;
      syncBuiltinESMExports();
      assert.throws(() => createOwnedStagingExportWriter(root, secrets)(sample()));
      assert.equal(existsSync(join(root, 'n8n/workflows/WF-10.json')), false);
      const fd = fs.openSync(join(root, 'public-journal.jsonl'), 'wx');
      try {
        assert.throws(() => writeCompleteSync(fd, 'PUBLIC_INTENT'));
      } finally {
        fs.closeSync(fd);
      }
    } finally {
      fs.writeSync = original;
      syncBuiltinESMExports();
    }
  }));
test('dangling public export entries are rejected and preserved without following them', (t) =>
  fixture((root) => {
    const directory = join(root, 'n8n/workflows');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'WF-10.json');
    try {
      fs.symlinkSync(
        join(root, 'missing-public-target'),
        path,
        process.platform === 'win32' ? 'junction' : 'file',
      );
    } catch (error) {
      if (error.code === 'EPERM') {
        t.skip('OS does not allow synthetic symlink creation');
        return;
      }
      throw error;
    }
    assert.equal(existsSync(path), false);
    assert.equal(fs.lstatSync(path).isSymbolicLink(), true);
    assert.throws(() => createOwnedStagingExportWriter(root, secrets)(sample()));
    assert.equal(fs.lstatSync(path).isSymbolicLink(), true);
  }));
