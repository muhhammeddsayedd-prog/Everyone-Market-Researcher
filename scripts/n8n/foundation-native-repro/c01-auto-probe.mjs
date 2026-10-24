/* eslint-disable no-console -- Opt-in synthetic local CLI; no hosted or real credential values. */
if (
  !process.argv.includes('--isolated-local') ||
  !process.argv.includes('--inside') ||
  process.argv.slice(2).some((x) => !['--isolated-local', '--inside'].includes(x))
)
  throw Error('C01_ISOLATED_LOCAL_REQUIRED');
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const base = '/home/node/.n8n/c01-receipts';
const run = readdirSync(base)
  .filter((s) => s.startsWith('valid-'))
  .sort()
  .at(-1);
const directory = resolve(base, run);
const graphs = readdirSync(directory)
  .filter((n) => n.startsWith('workflow-'))
  .map((n) => JSON.parse(readFileSync(resolve(directory, n))));
const parent = graphs.find((g) => g.name === 'C01 synthetic proposal automatic webhook failure');
const child = graphs.find((g) => g.name === 'C01 synthetic proposal automatic Error Trigger handler');
if (!parent?.id || !child?.id) throw Error('C01_AUTO_OWNERSHIP');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const saved = db
  .prepare('select id,name,activeVersionId from workflow_entity where id in (?,?)')
  .all(parent.id, child.id);
if (
  saved.length !== 2 ||
  saved.some((g) => g.activeVersionId !== (g.id === parent.id ? parent.versionId : child.versionId))
)
  throw Error('C01_AUTO_NOT_PUBLISHED');
db.close();
const path = parent.nodes.find((n) => n.type === 'n8n-nodes-base.webhook')?.parameters.path;
if (!/^c01-auto-error-[a-f0-9-]{36}$/.test(path)) throw Error('C01_AUTO_PATH');
function inspect() {
  const r = spawnSync(
    'node',
    ['/c01-repro/c01-inspect-db.mjs', '--isolated-local', 'workflow:' + parent.id, 'workflow:' + child.id],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status !== 0) throw Error('C01_AUTO_INSPECT');
  return JSON.parse(r.stdout);
}
const before = inspect();
if (before.entities.length) throw Error('C01_AUTO_PRIOR_EXECUTION');
const response = await fetch('http://127.0.0.1:5678/webhook/' + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ synthetic: true }),
  signal: AbortSignal.timeout(10000),
  redirect: 'error',
});
if (response.status !== 200) throw Error('C01_AUTO_HTTP_' + response.status);
await response.arrayBuffer();
let after;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 300));
  after = inspect();
  if (
    after.entities.length === 2 &&
    after.entities.every((e) => ['success', 'error'].includes(e.status) && e.stoppedAt)
  )
    break;
}
writeFileSync(
  resolve(directory, 'proposal-automatic-error-child.json'),
  JSON.stringify(
    {
      source: 'actual local public webhook plus isolated native SQLite, not Cloud proof',
      parent: { id: parent.id, versionId: parent.versionId },
      child: { id: child.id, versionId: child.versionId },
      before,
      snapshot: after,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    status: 'C01_LOCAL_AUTO_OBSERVED',
    entities: after.entities,
    rawSyntheticPayloadsPrinted: false,
  }),
);
