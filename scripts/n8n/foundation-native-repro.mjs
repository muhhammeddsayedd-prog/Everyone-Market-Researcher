/* eslint-disable no-console -- Source preparation CLI. */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Source preparation only. No Docker, authentication, HTTP or execution here.
// The isolated runtime commands are explicit in foundation-native-repro.md.
if (process.argv.length !== 3 || process.argv[2] !== '--isolated-local') {
  throw Error('C01_REPRO_REQUIRES_EXPLICIT_ISOLATED_LOCAL');
}
const repo = resolve(import.meta.dirname, '../..');
const source = resolve(import.meta.dirname, 'foundation-native-repro');
const destination = resolve(repo, '.c01-repro.local/replay.c01-repro.local');
if (!existsSync(resolve(repo, 'milestones/M03-n8n-foundation/MILESTONE.md')) || existsSync(destination)) {
  throw Error('C01_REPRO_DESTINATION_EXISTS_OR_WRONG_PROJECT');
}
mkdirSync(destination, { recursive: true });
for (const file of ['c01-setup.mjs', 'c01-repro.mjs', 'c01-inspect-db.mjs', 'c01-auto-probe.mjs']) {
  copyFileSync(resolve(source, file), resolve(destination, file));
}
console.log(
  JSON.stringify({
    status: 'C01_REPRO_SOURCE_PREPARED',
    directory: destination,
    runtimeStarted: false,
    hostedActions: 0,
    instructionFile: 'scripts/n8n/foundation-native-repro.md',
  }),
);
