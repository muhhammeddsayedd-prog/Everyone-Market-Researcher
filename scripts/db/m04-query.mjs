import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkServerIdentity } from 'node:tls';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const host = 'aws-1-eu-central-1.pooler.supabase.com';
const caSha256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const pgPackageSha256 = 'b1e53333a3d0c2c47c49a5cb919d221135dc03145df740925b899bc2baacc435';
const sha = (value) => createHash('sha256').update(value).digest('hex');

function regularFile(path, maximum) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximum)
    throw Error('query_input_blocked');
  for (let parent = dirname(absolute); ; parent = dirname(parent)) {
    const entry = lstatSync(parent);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error('query_input_blocked');
    if (parent === parse(parent).root) break;
  }
  return absolute;
}

export function strictAdminConfig(password, ca) {
  if (typeof password !== 'string' || !password || sha(ca) !== caSha256) throw Error('query_config_blocked');
  return {
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres.zmotjsbzhzjvpelxvxlf',
    password,
    application_name: 'emr-m04-admin-query',
    connectionTimeoutMillis: 5000,
    query_timeout: 28000,
    statement_timeout: 25000,
    ssl: { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: host, checkServerIdentity },
  };
}

// A text-only query uses pg's native simple protocol, including all transaction
// statements on this one connection. No spawned process, URL or host override.
export async function executeSimpleQuery(client, sql, timeoutMs = 30000) {
  let timer;
  let closed = false;
  let rows = [];
  let sqlstate = null;
  let status = 'query_failed';
  const ignorePrivateError = () => {};
  client.on('error', ignorePrivateError);
  try {
    const work = (async () => {
      await client.connect();
      const result = await client.query(sql);
      return (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.rows ?? []);
    })();
    const result = await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('query_deadline')), timeoutMs);
      }),
    ]);
    if (Buffer.byteLength(JSON.stringify(result)) > 1048576) throw Error('query_output_bound');
    rows = result;
    status = 'query_complete';
  } catch (error) {
    sqlstate = typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
  } finally {
    clearTimeout(timer);
    let closeTimer;
    try {
      closed = await Promise.race([
        Promise.resolve()
          .then(() => client.end())
          .then(
            () => true,
            () => false,
          ),
        new Promise((resolveClosed) => {
          closeTimer = setTimeout(() => resolveClosed(false), 3000);
        }),
      ]);
    } finally {
      clearTimeout(closeTimer);
      try {
        if (!closed) client.connection?.stream?.destroy();
      } catch {
        /* Fixed closure result below. */
      }
      client.password = undefined;
      if (client.connectionParameters) client.connectionParameters.password = undefined;
    }
  }
  if (!closed) return { status: 'query_closure_unverified', sqlstate, clientClosed: false, rows: [] };
  return { status, sqlstate, clientClosed: true, rows };
}

async function main(args) {
  let password;
  try {
    if (args.length !== 2 || !/^[a-f0-9]{64}$/.test(args[1])) throw Error('query_input_blocked');
    const sqlPath = regularFile(args[0], 140000);
    if (basename(sqlPath) !== 'reviewed.sql' || !/^emr-m04-db-[a-f0-9]{32}$/.test(basename(dirname(sqlPath))))
      throw Error('query_input_blocked');
    const sql = readFileSync(sqlPath);
    if (sha(sql) !== args[1] || /__M04_[A-Z0-9_]+__/.test(sql.toString('utf8')))
      throw Error('query_input_blocked');
    const packagePath = resolve(repo, 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/package.json');
    const packageBytes = readFileSync(packagePath);
    if (sha(packageBytes) !== pgPackageSha256 || JSON.parse(packageBytes).version !== '8.23.1')
      throw Error('query_driver_blocked');
    const ca = readFileSync(regularFile(resolve(repo, 'scripts/seed/certs/supabase-root-2021.crt'), 65536));
    password = process.env.PGPASSWORD;
    delete process.env.PGPASSWORD;
    const config = strictAdminConfig(password, ca);
    password = undefined;
    const { Client } = createRequire(import.meta.url)(dirname(packagePath));
    const client = new Client(config);
    config.password = undefined;
    return await executeSimpleQuery(client, sql.toString('utf8'));
  } catch {
    return { status: 'query_input_blocked', sqlstate: null, clientClosed: true, rows: [] };
  } finally {
    password = undefined;
    delete process.env.PGPASSWORD;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Controlled failures are structured protocol results. Native exit0 means the
  // protocol child completed; the PowerShell caller must verify status too.
  const result = await main(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
}
