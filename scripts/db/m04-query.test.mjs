import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { executeSimpleQuery, strictAdminConfig } from './m04-query.mjs';

class FakeClient extends EventEmitter {
  password = 'synthetic-only';
  connectionParameters = { password: 'synthetic-only' };
  ended = false;
  async connect() {}
  async query(text) {
    assert.equal(typeof text, 'string');
    assert.match(text, /begin;/);
    return [
      { command: 'BEGIN', rows: [] },
      { command: 'SELECT', rows: [{ proof: true }] },
      { command: 'COMMIT', rows: [] },
    ];
  }
  async end() {
    this.ended = true;
  }
}

test('dev Admin config fixes target and strict certificate identity independently of URLs', () => {
  const ca = readFileSync(resolve('scripts/seed/certs/supabase-root-2021.crt'));
  const config = strictAdminConfig('synthetic-only', ca);
  assert.equal(config.host, 'aws-1-eu-central-1.pooler.supabase.com');
  assert.equal(config.port, 5432);
  assert.equal(config.user, 'postgres.zmotjsbzhzjvpelxvxlf');
  assert.equal(config.database, 'postgres');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, config.host);
  assert.equal(config.ssl.minVersion, 'TLSv1.2');
  assert.equal(typeof config.ssl.checkServerIdentity, 'function');
  assert.throws(
    () => strictAdminConfig('synthetic-only', Buffer.from('untrusted CA')),
    /query_config_blocked/,
  );
});

test('one native simple-protocol call flattens only result rows and closes its client', async () => {
  const client = new FakeClient();
  const result = await executeSimpleQuery(client, 'begin; do $$begin null;end$$;select true proof;commit;');
  assert.deepEqual(result, {
    status: 'query_complete',
    sqlstate: null,
    clientClosed: true,
    rows: [{ proof: true }],
  });
  assert.equal(client.ended, true);
  assert.equal(client.password, undefined);
  assert.equal(client.connectionParameters.password, undefined);
});

test('authorization failure exposes only SQLSTATE and never its raw credential-bearing error', async () => {
  const client = new FakeClient();
  client.query = async () => {
    throw Object.assign(Error('postgresql://private-password@private-host secret-token'), { code: '42501' });
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;');
  assert.deepEqual(result, { status: 'query_failed', sqlstate: '42501', clientClosed: true, rows: [] });
  assert.equal(client.ended, true);
  assert.doesNotMatch(JSON.stringify(result), /private-password|private-host|secret-token/);
});

test('network error details are suppressed and failed client closes', async () => {
  const client = new FakeClient();
  client.connect = async () => {
    throw Object.assign(Error('secret connection diagnostic'), { code: 'ECONNREFUSED' });
  };
  assert.deepEqual(await executeSimpleQuery(client, 'begin;select 1;commit;'), {
    status: 'query_failed',
    sqlstate: null,
    clientClosed: true,
    rows: [],
  });
  assert.equal(client.ended, true);
});

test('query deadline ends the client without retrying SQL', async () => {
  const client = new FakeClient();
  let queries = 0;
  client.query = async () => {
    queries++;
    return await new Promise(() => {});
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;', 20);
  assert.equal(queries, 1);
  assert.equal(client.ended, true);
  assert.equal(result.status, 'query_failed');
  assert.equal(result.clientClosed, true);
});

test('unverified socket closure is reported rather than claimed complete', async () => {
  const client = new FakeClient();
  let destroyed = false;
  client.end = async () => await new Promise(() => {});
  client.connection = {
    stream: {
      destroy() {
        destroyed = true;
      },
    },
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;');
  assert.equal(result.status, 'query_closure_unverified');
  assert.equal(result.clientClosed, false);
  assert.equal(destroyed, true);
  assert.deepEqual(result.rows, []);
});

test(
  'actual public local PostgreSQL accepts the native multi-statement transaction',
  { skip: process.env.EMR_M04_QUERY_LOCAL_TEST !== 'true' },
  async () => {
    // This public local default is never loaded from the persistent dev store.
    const { Client } = createRequire(import.meta.url)(
      resolve('node_modules/.pnpm/pg@8.23.1/node_modules/pg'),
    );
    const client = new Client({
      host: '127.0.0.1',
      port: 60322,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
      connectionTimeoutMillis: 3000,
      application_name: 'emr-m04-public-local-contract',
    });
    const result = await executeSimpleQuery(
      client,
      `begin;
set local lock_timeout='5s';set local statement_timeout='25s';
do $m04_identity$ begin
 if current_user<>'postgres' or session_user<>'postgres' or current_database()<>'postgres' then
  raise exception using errcode='42501',message='Local owner identity required';
 end if;
end $m04_identity$;
select current_user::text as current_user,session_user::text as session_user,current_database()::text as database,true as transaction_contract;
rollback;`,
    );
    assert.deepEqual(result, {
      status: 'query_complete',
      sqlstate: null,
      clientClosed: true,
      rows: [
        {
          current_user: 'postgres',
          session_user: 'postgres',
          database: 'postgres',
          transaction_contract: true,
        },
      ],
    });
  },
);
