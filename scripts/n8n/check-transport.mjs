import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { diagnosticEnvironment } from './check-dns.mjs';
import { probePublicInventoryTransport } from './inventory.mjs';

const ownPath = fileURLToPath(import.meta.url);
const failed = () => ({ httpStatus: null, tlsVerified: false, socketClosed: false });
const valid = (value) =>
  value &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === 'httpStatus,socketClosed,tlsVerified' &&
  (value.httpStatus === null ||
    (Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599)) &&
  typeof value.tlsVerified === 'boolean' &&
  typeof value.socketClosed === 'boolean';

// Public fixed-route proof only. The native child receives the same OS-only
// environment as inventory, with NO API key or other credential added.
if (process.argv[1] && resolve(process.argv[1]) === resolve(ownPath)) {
  if (process.argv.length === 3 && process.argv[2] === '--transport-child') {
    const result = await probePublicInventoryTransport();
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.httpStatus !== null && result.tlsVerified && result.socketClosed ? 0 : 1;
  } else if (process.argv.length !== 2) {
    process.stdout.write(JSON.stringify(failed()) + '\n');
    process.exitCode = 1;
  } else {
    const child = spawnSync(process.execPath, [ownPath, '--transport-child'], {
      env: diagnosticEnvironment(process.env),
      windowsHide: true,
      timeout: 20_000,
      killSignal: 'SIGKILL',
      maxBuffer: 8192,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let result = null;
    try {
      result = JSON.parse(child.stdout);
    } catch {
      /* No raw output/error. */
    }
    if (child.error || !valid(result)) result = failed();
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode =
      child.status === 0 && result.httpStatus !== null && result.tlsVerified && result.socketClosed ? 0 : 1;
  }
}
