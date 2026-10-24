import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkServerIdentity } from 'node:tls';

const windowId = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
const projectRef = 'zmotjsbzhzjvpelxvxlf';
const fail = (code) => {
  throw Error(code);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && Object.keys(v).every((k) => keys.includes(k));
const iso = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/.test(v) &&
  Number.isFinite(Date.parse(v));
const codes = new Set([
  'GW01_WRITER_INPUT',
  'GW01_WRITER_IDENTITY',
  'GW01_WRITER_AUTHORIZATION',
  'GW01_WRITER_CONTROL',
  'GW01_WRITER_CONNECTION',
  'GW01_WRITER_CLEANUP',
]);
export function writerPreview(v) {
  if (
    !exact(v, ['audience', 'commitSha', 'deploymentId', 'projectId', 'branch']) ||
    v.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    v.branch !== 'm03-n8n-foundation' ||
    typeof v.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v.audience) ||
    typeof v.commitSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(v.commitSha) ||
    typeof v.deploymentId !== 'string' ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(v.deploymentId)
  )
    fail('GW01_WRITER_INPUT');
  return { ...v };
}
function controlWindow(raw) {
  if (
    !exact(raw, ['state', 'code', 'result', 'window']) ||
    !['admitted', 'closed', 'conflict'].includes(raw.state) ||
    ![null, 'window_closed', 'window_expired', 'args_conflict'].includes(raw.code) ||
    raw.result !== null
  )
    fail('GW01_WRITER_CONTROL');
  const w = raw.window;
  if (
    !exact(w, [
      'id',
      'startsAt',
      'expiresAt',
      'closed',
      'totalAdmitted',
      'boundAudience',
      'boundCommitSha',
      'boundDeploymentId',
    ]) ||
    w.id !== windowId ||
    typeof w.closed !== 'boolean' ||
    !Number.isInteger(w.totalAdmitted) ||
    w.totalAdmitted < 0 ||
    w.totalAdmitted > 100 ||
    (w.startsAt === null) !== (w.expiresAt === null) ||
    (w.startsAt !== null &&
      (!iso(w.startsAt) || !iso(w.expiresAt) || Date.parse(w.expiresAt) - Date.parse(w.startsAt) !== 1800000))
  )
    fail('GW01_WRITER_CONTROL');
  if (w.boundAudience === null) {
    if (w.boundCommitSha !== null || w.boundDeploymentId !== null) fail('GW01_WRITER_CONTROL');
  } else
    writerPreview({
      audience: w.boundAudience,
      commitSha: w.boundCommitSha,
      deploymentId: w.boundDeploymentId,
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
    });
  return { ...w };
}
const denySql = [
  'select 1 from ops.worker_gateway_rate_windows limit 0',
  'select 1 from ops.worker_gateway_requests limit 0',
  'select 1 from ops.worker_gateway_leases limit 0',
  "select ops.worker_gateway_response('76c2ad42-c094-4ba4-9a0b-566e19b97780'::uuid,'admitted',null,null)",
];
export async function checkGatewayWriter(input, createClient = nativeWriterClient) {
  const out = {
    version: 1,
    status: 'stopped_reconcile',
    mode: ['Verify', 'Inspect', 'Bind', 'Close'].includes(input?.mode) ? input.mode : null,
    code: null,
    identity: null,
    authorizationDenials: 0,
    window: null,
    connectionClosed: true,
  };
  let client,
    transaction = false,
    phase = 'GW01_WRITER_INPUT';
  try {
    if (
      !exact(input, ['mode', 'password', 'preview']) ||
      !['Verify', 'Inspect', 'Bind', 'Close'].includes(input.mode) ||
      typeof input.password !== 'string' ||
      input.password.length < 1 ||
      input.password.length > 4096 ||
      /[\x00-\x1f\x7f]/.test(input.password)
    )
      fail(phase);
    const preview = writerPreview(input.preview);
    phase = 'GW01_WRITER_CONNECTION';
    client = createClient(input.password);
    if (typeof client.on === 'function') client.on('error', () => {});
    out.connectionClosed = false;
    await client.connect();
    phase = 'GW01_WRITER_IDENTITY';
    const identity = (
      await client.query(
        'select current_user as "currentUser",session_user as "sessionUser",current_database() as database,\'zmotjsbzhzjvpelxvxlf\'::text as "projectRef"',
      )
    ).rows;
    if (
      !Array.isArray(identity) ||
      identity.length !== 1 ||
      !exact(identity[0], ['currentUser', 'sessionUser', 'database', 'projectRef']) ||
      identity[0].currentUser !== 'n8n_writer' ||
      identity[0].sessionUser !== 'n8n_writer' ||
      identity[0].database !== 'postgres' ||
      identity[0].projectRef !== projectRef
    )
      fail(phase);
    out.identity = identity[0];
    if (input.mode === 'Verify') {
      phase = 'GW01_WRITER_AUTHORIZATION';
      await client.query('begin');
      transaction = true;
      for (const sql of denySql) {
        await client.query('savepoint gw01_boundary');
        let denied = false;
        try {
          await client.query(sql);
        } catch (error) {
          denied = error?.code === '42501';
        }
        await client.query('rollback to savepoint gw01_boundary');
        if (!denied) fail(phase);
        out.authorizationDenials++;
      }
      await client.query('rollback');
      transaction = false;
    }
    phase = 'GW01_WRITER_CONTROL';
    async function control(mode, args) {
      const r = await client.query(
        'select ops.worker_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::text) as receipt',
        [windowId, randomUUID(), 'identity.read', JSON.stringify(args), mode],
      );
      if (!Array.isArray(r.rows) || r.rows.length !== 1 || !exact(r.rows[0], ['receipt'])) fail(phase);
      return { receipt: r.rows[0].receipt, window: controlWindow(r.rows[0].receipt) };
    }
    let state = await control('inspect', {});
    if (input.mode === 'Bind') {
      if (state.window.closed || state.window.startsAt !== null) fail(phase);
      state = await control('bind', {
        audience: preview.audience,
        commitSha: preview.commitSha,
        deploymentId: preview.deploymentId,
      });
      if (
        state.receipt.state !== 'admitted' ||
        state.window.startsAt !== null ||
        state.window.boundAudience !== preview.audience ||
        state.window.boundCommitSha !== preview.commitSha ||
        state.window.boundDeploymentId !== preview.deploymentId
      )
        fail(phase);
      const readback = await control('inspect', {});
      if (JSON.stringify(readback.window) !== JSON.stringify(state.window)) fail(phase);
      state = readback;
    } else if (input.mode === 'Close') {
      state = await control('close', {});
      if (state.receipt.state !== 'closed' || state.window.closed !== true) fail(phase);
      const readback = await control('inspect', {});
      if (readback.window.closed !== true) fail(phase);
      state = readback;
    }
    out.window = state.window;
    out.status = 'complete';
  } catch (error) {
    out.code = codes.has(error?.message) ? error.message : phase;
  } finally {
    input = null;
    if (client) {
      if (transaction)
        try {
          await client.query('rollback');
        } catch {
          out.status = 'stopped_reconcile';
          out.code = 'GW01_WRITER_CLEANUP';
        }
      try {
        await client.end();
        out.connectionClosed = true;
      } catch {
        out.status = 'stopped_reconcile';
        out.code = 'GW01_WRITER_CLEANUP';
      }
    }
  }
  return out;
}
export function nativeWriterClient(password) {
  const require = createRequire(resolve('apps/web/package.json'));
  if (require('pg/package.json').version !== '8.23.1') fail('GW01_WRITER_INPUT');
  const ca = readFileSync(resolve('scripts/seed/certs/supabase-root-2021.crt'));
  if (
    createHash('sha256').update(ca).digest('hex') !==
    '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
  )
    fail('GW01_WRITER_INPUT');
  const { Client } = require('pg');
  return new Client({
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'n8n_writer.zmotjsbzhzjvpelxvxlf',
    password,
    ssl: {
      ca: ca.toString('ascii'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      checkServerIdentity,
      servername: 'aws-1-eu-central-1.pooler.supabase.com',
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 8000,
    query_timeout: 10000,
    application_name: 'emr_m03_gw01_dev_control',
    keepAlive: false,
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out;
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--private-writer') fail('GW01_WRITER_INPUT');
    const chunks = [];
    let size = 0;
    for await (const c of process.stdin) {
      size += c.length;
      if (size > 16384) fail('GW01_WRITER_INPUT');
      chunks.push(c);
    }
    out = await checkGatewayWriter(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    out = { version: 1, status: 'stopped_reconcile', code: 'GW01_WRITER_INPUT', connectionClosed: true };
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode = out.status === 'complete' && out.connectionClosed ? 0 : 1;
}
