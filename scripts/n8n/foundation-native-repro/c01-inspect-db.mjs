/* eslint-disable no-console -- Opt-in synthetic local CLI; no hosted or real credential values. */
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
if (!process.argv.includes('--isolated-local')) throw Error('C01_ISOLATED_LOCAL_REQUIRED');
const requested = process.argv.slice(2).filter((x) => x !== '--isolated-local');
if (
  !requested.length ||
  requested.length > 64 ||
  requested.some((x) => !/^workflow:[A-Za-z0-9_-]{1,128}$/.test(x))
)
  throw Error('C01_IDS');
const manifest = JSON.parse(readFileSync('/c01-repro/manifest.json', 'utf8'));
if (manifest.owner !== 'emr-m03-c01-repro-20261019' || manifest.version !== '2.43.5')
  throw Error('C01_LOCAL_SYNTHETIC_DATABASE_ONLY');
const { parse } = createRequire('/usr/local/lib/node_modules/n8n/package.json')('flatted');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const placeholders = requested.map(() => '?').join(',');
const ids = requested.map((x) => x.slice(9));
const entities = db
  .prepare(
    `select id,workflowId,workflowVersionId,mode,status,finished,startedAt,stoppedAt,deletedAt,waitTill from execution_entity where workflowId in (${placeholders})`,
  )
  .all(...ids);
const data = db
  .prepare(
    `select executionId,data,workflowData from execution_data where executionId in (select id from execution_entity where workflowId in (${placeholders}))`,
  )
  .all(...ids);
for (const row of data) row.decodedData = parse(row.data);
console.log(JSON.stringify({ entities, data }));
db.close();
