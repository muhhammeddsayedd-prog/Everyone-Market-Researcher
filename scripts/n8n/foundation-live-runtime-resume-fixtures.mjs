// Synthetic read-only ports for the real fixed proof constructor. No test
// registration, private path read, key, network or live journal access.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  foundationZeroSetupCheckpoint,
  verifyFoundationLiveZeroSetup,
} from './foundation-live-zero-setup.mjs';

export function syntheticZeroSetup(now = foundationZeroSetupCheckpoint.deadlineAt - 3000000) {
  const c = foundationZeroSetupCheckpoint,
    repo = fileURLToPath(new URL('../../', import.meta.url));
  const header =
    JSON.stringify({
      event: 'management_header',
      version: 1,
      sourceCommitSha: c.sourceCommitSha,
      deadlineAt: c.deadlineAt,
    }) + '\n';
  const closurePath = join(repo, c.closureRelative),
    managementPath = join(repo, c.managementRelative);
  const files = new Map([
    [closurePath, readFileSync(closurePath, 'utf8')],
    [managementPath, header],
  ]);
  const all = [
    closurePath,
    managementPath,
    ...c.emptyRelatives.map((p) => join(repo, p)),
    ...c.absentRelatives.map((p) => join(repo, p)),
  ];
  const directories = new Set();
  for (const leaf of all)
    for (let p = dirname(leaf); ; p = dirname(p)) {
      directories.add(p);
      if (dirname(p) === p) break;
    }
  const absent = () => {
    const e = Error('SYNTHETIC_ABSENT');
    e.code = 'ENOENT';
    throw e;
  };
  const io = {
    readFileSync(path) {
      const value = files.get(resolve(path));
      if (value === undefined) return absent();
      return value;
    },
    lstatSync(path) {
      path = resolve(path);
      if (files.has(path))
        return { isSymbolicLink: () => false, isFile: () => true, size: Buffer.byteLength(files.get(path)) };
      if (directories.has(path)) return { isSymbolicLink: () => false, isFile: () => false };
      return absent();
    },
  };
  const clock = () => now;
  const verify = () => verifyFoundationLiveZeroSetup({ now: clock }, io);
  return { proof: verify(), verify, header, checkpoint: c, now: clock };
}
