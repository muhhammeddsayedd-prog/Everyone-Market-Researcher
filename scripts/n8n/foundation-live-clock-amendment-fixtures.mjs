// Explicit synthetic public IO; importing this module performs no reads/writes.
import { readFileSync, lstatSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  foundationClockAmendmentCheckpoint as c,
  verifyFoundationClockAmendment,
  admitFoundationClockAmendment,
  readFoundationClockAmendment,
  readClaimedFoundationClockAmendment,
  claimFoundationClockAmendment,
} from './foundation-live-clock-amendment.mjs';
import { foundationZeroSetupCheckpoint as old } from './foundation-live-zero-setup.mjs';

export function syntheticClockAmendment({ parentProcessId = process.ppid, durableDirectory } = {}) {
  const repo = fileURLToPath(new URL('../../', import.meta.url)),
    files = new Map(),
    directories = new Set();
  for (const relative of [c.approvalRelative, c.packetRelative, c.lateRelative, old.closureRelative])
    files.set(join(repo, relative), readFileSync(join(repo, relative), 'utf8'));
  const header =
    JSON.stringify({
      event: 'management_header',
      version: 1,
      sourceCommitSha: c.sourceCommitSha,
      deadlineAt: old.deadlineAt,
    }) + '\n';
  files.set(join(repo, old.managementRelative), header);
  const parentPath = join(process.env.LOCALAPPDATA, 'Temp', c.parentLockFilename);
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
    time = Date.parse('2026-10-21T13:10:00Z'),
    shortWrite = false,
    syncFail = false;
  const missing = () => {
    const e = Error('SYNTHETIC_ABSENT');
    e.code = 'ENOENT';
    throw e;
  };
  const io = {
    parentProcessId,
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
      if (files.has(path)) {
        const e = Error('SYNTHETIC_EXISTS');
        e.code = 'EEXIST';
        throw e;
      }
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
      if (syncFail) throw Error('SYNTHETIC_SYNC');
      if (fds.get(fd)?.disk) fsyncSync(fd);
    },
    closeSync(fd) {
      if (fds.get(fd)?.disk) closeSync(fd);
      fds.delete(fd);
    },
  };
  const now = () => time,
    paths = {
      management: join(repo, old.managementRelative),
      admission: join(repo, c.admissionRelative),
      claim: join(repo, c.claimRelative),
      parent: parentPath,
      control: join(repo, old.emptyRelatives[0]),
    };
  return {
    io,
    now,
    header,
    files,
    paths,
    checkpoint: c,
    setTime: (n) => {
      time = n;
    },
    setShortWrite: (v) => {
      shortWrite = v;
    },
    setSyncFailure: (v) => {
      syncFail = v;
    },
    check: () => verifyFoundationClockAmendment({ now }, io),
    admit: () => admitFoundationClockAmendment({ now }, io),
    read: () => readFoundationClockAmendment({ now }, io),
    readClaimed: () => readClaimedFoundationClockAmendment({ now }, io),
    claim: (p) => claimFoundationClockAmendment(p, { now }, io),
  };
}
