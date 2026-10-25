// Explicit synthetic public IO. Importing this module reads/mutates nothing.
import { readFileSync, lstatSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  foundationPostcheckContinuationCheckpoint as c,
  verifyFoundationPostcheckContinuation,
  admitFoundationPostcheckContinuation,
  readFoundationPostcheckContinuation,
  readClaimedFoundationPostcheckContinuation,
  claimFoundationPostcheckContinuation,
} from './foundation-live-postcheck-continuation.mjs';
import { foundationZeroSetupCheckpoint as old } from './foundation-live-zero-setup.mjs';
import {
  syntheticLocalAppDataPath,
  withSyntheticLocalAppData,
} from './foundation-live-clock-amendment-fixtures.mjs';

export function syntheticPostcheckContinuation({ parentProcessId = process.ppid, durableDirectory } = {}) {
  const repo = fileURLToPath(new URL('../../', import.meta.url)),
    evidence = 'milestones/M03-n8n-foundation/evidence/',
    files = new Map(),
    directories = new Set(),
    localAppData = syntheticLocalAppDataPath();
  for (const name of [
    'dev-acceptance-postcheck-approval-20261021.json',
    'dev-acceptance-postcheck-checkpoint-20261021.json',
    'dev-acceptance-postcheck-continuation-20261021.md',
    'dev-acceptance-amended-attempt-20261021.json',
    'dev-acceptance-clock-approval-20261021.json',
    'dev-acceptance-clock-amendment-20261021.md',
    'dev-acceptance-late-delivery-20261021.json',
    'dev-acceptance-zero-setup-20261021.json',
  ])
    files.set(join(repo, evidence, name), readFileSync(join(repo, evidence, name), 'utf8'));
  const snapshot = JSON.parse(
    files.get(join(repo, evidence, 'dev-acceptance-postcheck-checkpoint-20261021.json')),
  );
  for (const [relative, record] of Object.entries(snapshot.retainedFiles))
    files.set(
      join(repo, relative),
      record.text ??
        gunzipSync(
          readFileSync(join(repo, 'scripts/n8n/fixtures/foundation-hosted-types-20261021.ts.gz')),
        ).toString('utf8'),
    );
  const parentPath = join(localAppData, 'Temp', c.parentLockFilename);
  files.set(
    parentPath,
    JSON.stringify({
      kind: 'm03_clock_admission_parent',
      version: 1,
      segmentId: c.segmentId,
      processId: parentProcessId,
    }) + '\n',
  );
  const fixed = [
    ...files.keys(),
    ...old.emptyRelatives.map((p) => join(repo, p)),
    ...old.absentRelatives.map((p) => join(repo, p)),
    join(repo, c.admissionRelative),
    join(repo, c.claimRelative),
  ];
  for (const leaf of fixed)
    for (let p = dirname(leaf); ; p = dirname(p)) {
      directories.add(p);
      if (dirname(p) === p) break;
    }
  const disk = new Map(
    durableDirectory
      ? [
          [join(repo, c.admissionRelative), join(durableDirectory, 'admission.json')],
          [join(repo, c.claimRelative), join(durableDirectory, 'claim.json')],
        ]
      : [],
  );
  const fds = new Map();
  let serial = 100000,
    time = Date.parse('2026-10-21T15:00:00Z'),
    shortWrite = false;
  const missing = () => {
    throw Object.assign(Error('SYNTHETIC_ABSENT'), { code: 'ENOENT' });
  };
  const io = {
    parentProcessId,
    processAlive: () => false,
    readFileSync(path) {
      path = resolve(path);
      if (disk.has(path)) return readFileSync(disk.get(path), 'utf8');
      if (!files.has(path)) return missing();
      return files.get(path);
    },
    lstatSync(path) {
      path = resolve(path);
      if (disk.has(path)) return lstatSync(disk.get(path));
      if (files.has(path))
        return {
          isFile: () => true,
          isSymbolicLink: () => false,
          size: Buffer.byteLength(files.get(path)),
          nlink: 1,
        };
      if (directories.has(path)) return { isFile: () => false, isSymbolicLink: () => false };
      return missing();
    },
    openSync(path, flags) {
      path = resolve(path);
      if (![join(repo, c.admissionRelative), join(repo, c.claimRelative)].includes(path) || flags !== 'wx')
        throw Error('SYNTHETIC_WRITE_SCOPE');
      if (disk.has(path)) {
        const fd = openSync(disk.get(path), 'wx');
        fds.set(fd, { disk: true });
        return fd;
      }
      if (files.has(path)) throw Object.assign(Error('SYNTHETIC_EXISTS'), { code: 'EEXIST' });
      files.set(path, '');
      const fd = ++serial;
      fds.set(fd, { path });
      return fd;
    },
    writeSync(fd, bytes, offset, length) {
      const f = fds.get(fd);
      if (!f) throw Error('SYNTHETIC_FD');
      if (shortWrite) return 0;
      if (f.disk) return writeSync(fd, bytes, offset, length);
      files.set(f.path, files.get(f.path) + bytes.subarray(offset, offset + length).toString());
      return length;
    },
    fsyncSync(fd) {
      if (fds.get(fd)?.disk) fsyncSync(fd);
    },
    closeSync(fd) {
      if (fds.get(fd)?.disk) closeSync(fd);
      fds.delete(fd);
    },
  };
  const now = () => time,
    withLocalAppData = (run) => withSyntheticLocalAppData(run, localAppData),
    paths = {
      management: join(repo, old.managementRelative),
      control: join(repo, 'scripts/n8n/out/foundation/live/control.jsonl'),
      admission: join(repo, c.admissionRelative),
      claim: join(repo, c.claimRelative),
      parent: parentPath,
    };
  return {
    io,
    now,
    files,
    paths,
    localAppData,
    withLocalAppData,
    checkpoint: c,
    snapshot,
    header: files.get(paths.management),
    controlPrefix: files.get(paths.control),
    setTime: (n) => {
      time = n;
    },
    setShortWrite: (v) => {
      shortWrite = v;
    },
    check: () => withLocalAppData(() => verifyFoundationPostcheckContinuation({ now }, io)),
    admit: () => withLocalAppData(() => admitFoundationPostcheckContinuation({ now }, io)),
    read: () => withLocalAppData(() => readFoundationPostcheckContinuation({ now }, io)),
    readClaimed: () => withLocalAppData(() => readClaimedFoundationPostcheckContinuation({ now }, io)),
    claim: (p) => withLocalAppData(() => claimFoundationPostcheckContinuation(p, { now }, io)),
  };
}
