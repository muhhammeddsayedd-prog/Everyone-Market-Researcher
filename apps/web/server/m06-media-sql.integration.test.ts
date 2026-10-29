// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { readdirSync } from 'node:fs';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { createMediaThumbnail } from './media-thumbnail';
import { runMediaBatch, devMediaStorageOrigin, type MediaPorts } from '../../../n8n/media/worker';
import { createMediaProcessHandler, type MediaProcessConfig } from './media-process';
import { createMediaHttpPorts } from './media-http';
import { createMediaUploadHandler, createMediaUploadReadinessHandler } from './media-upload';
import { createSupabaseMediaSigner } from './media-upload-storage';
import { openMediaDatabaseSession } from './media-database';
import type { WorkerClient, WorkerPool } from './n8n-worker/database';
const require = createRequire(import.meta.url);
const stories = require('../../../n8n/normalizers/storiesDataSlayer.js');
const { buildNativeMedia } = require('../../../n8n/media/build-native-media.mjs');

// Only the fixed public local fixture. No hosted target, env URL or stored secret is accepted.
describe.skipIf(process.env.EMR_M06_LOCAL_SQL_TEST !== 'true')(
  'M06 real local story-to-thumbnail contracts',
  () => {
    it('normalizes, ingests, drains, converts, signs/uploads with a mock, saves and acknowledges idempotently', async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 60322,
        user: 'supabase_admin',
        password: 'postgres',
        database: 'postgres',
        ssl: false,
        connectionTimeoutMillis: 3000,
      });
      await c.connect();
      const baseline = `select (select count(*) from app.items) items,(select count(*) from ingest.raw_items) raw,
      (select count(*) from app.media_assets) media,(select count(*) from app.competitors) companies,
      (select count(*) from ops.scrape_runs) runs,(select count(*) from ops.cost_ledger) costs,
      (select md5(string_agg(version::text,',' order by version)) from supabase_migrations.schema_migrations) history,
      to_regprocedure('ops.get_media_targets(uuid[])')::text m06`;
      const before = (await c.query(baseline)).rows[0];
      try {
        await c.query('begin');
        for (const [fn, file] of [
          ['ops.set_account_external_id(uuid,text,text)', '20261026013910_m04_vimeo_account_resolution.sql'],
          ['ops.collector_execute(uuid,text,jsonb)', '20261027092832_m04_collector_product_contracts.sql'],
          [
            'ops.claim_recent_instagram_accounts(uuid,uuid[],text[])',
            '20261027192743_m04_recent_instagram_dev_eligibility.sql',
          ],
          ['ops.m05_execute(uuid,text,jsonb)', '20261028020745_m05_web_youtube_linkedin.sql'],
          ['ops.get_media_targets(uuid[])', '20261028190835_m06_media_contracts.sql'],
        ] as const) {
          if (file.includes('recent_instagram')) {
            const found = (
              await c.query(
                "select 1 from supabase_migrations.schema_migrations where version='20261027192743'",
              )
            ).rowCount;
            if (found) continue;
          } else if ((await c.query('select to_regprocedure($1) f', [fn])).rows[0].f) continue;
          await c.query(
            readFileSync(new URL('../../../supabase/migrations/' + file, import.meta.url), 'utf8'),
          );
        }
        const competitor = randomUUID(),
          account = randomUUID();
        await c.query(
          "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,'TESTM06LOCAL','m06-synthetic','M06 synthetic local','pilot','active')",
          [competitor],
        );
        const run = (
          await c.query(
            "select ops.start_run('WF-12','instagram_stories','daily','dev','m06-local-synthetic') id",
          )
        ).rows[0].id;
        await c.query(
          "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status,last_run_id,locked_until) values($1,$2,'instagram_stories','synthetic_studio','https://www.instagram.com/synthetic_studio/','active','not_applicable',$3,now()+interval '15 minutes')",
          [account, competitor, run],
        );
        const f = JSON.parse(
          readFileSync(
            new URL(
              '../../../n8n/normalizers/fixtures/instagram-stories-data-slayer/synthetic-contract.json',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        const prepared = stories.prepareStoriesDataSlayerResults([f.rows[0]], {
          accounts: [
            {
              id: account,
              competitor_id: competitor,
              platform: 'instagram_stories',
              handle: 'synthetic_studio',
            },
          ],
          now: '2026-10-28T12:00:00Z',
        });
        expect(prepared.groups[0].status).toBe('success');
        await c.query('set local role n8n_writer');
        const ingest = () =>
          c.query('select ingest.upsert_raw_items($1,$2,$3::jsonb) r', [
            run,
            account,
            JSON.stringify(prepared.groups[0].items),
          ]);
        const initial = (await ingest()).rows[0].r;
        expect(initial.inserted).toBe(1);
        const item = initial.new_item_ids[0];
        const png = await sharp({ create: { width: 2560, height: 720, channels: 3, background: '#abcdef' } })
          .png()
          .toBuffer();
        const events: string[] = [];
        let uploadedBytes = 0;
        const ports: MediaPorts = {
          claim: async () =>
            (await c.query("select * from ops.claim_queue_batch('media',50,600)")).rows.filter(
              (r) => r.message.item_id === item,
            ),
          targets: async (ids) =>
            (await c.query('select ops.get_media_targets($1::uuid[]) r', [ids])).rows[0].r,
          download: async () => ({ status: 200, contentType: 'image/png', bytes: png }),
          resize: async (bytes, _options, signal) => createMediaThumbnail(bytes, signal),
          sign: async (path) => ({
            path,
            token: 'local-synthetic-only',
            signedUrl:
              devMediaStorageOrigin +
              '/storage/v1/object/upload/sign/media/' +
              path +
              '?token=local-synthetic-only',
          }),
          upload: async (_url, bytes, options) => {
            expect(options.upsert).toBe(false);
            expect((await sharp(bytes).metadata()).format).toBe('jpeg');
            uploadedBytes = bytes.byteLength;
            events.push('mock-upload');
            return { status: 200 };
          },
          save: async (asset) => {
            await c.query('select ops.save_media_asset($1,$2,$3,$4,$5,$6)', [
              asset.item_id,
              asset.kind,
              asset.path,
              asset.source_url,
              asset.width,
              asset.height,
            ]);
            events.push('actual-save');
          },
          record: async (o) => {
            expect(o.cost_usd).toBeNull();
            events.push('record');
          },
          ack: async (ids) => {
            await c.query("select ops.ack_queue('media',$1::bigint[])", [ids]);
            events.push('actual-ack');
          },
        };
        expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('stored');
        expect(events).toEqual(['mock-upload', 'actual-save', 'record', 'actual-ack']);
        expect(uploadedBytes).toBeGreaterThan(0);
        expect((await ingest()).rows[0].r.inserted).toBe(0);
        await c.query('reset role');
        const saved = (
          await c.query(
            'select i.thumbnail_path,i.ai_status,m.width,m.height,(select count(*) from app.media_assets where item_id=i.id)::int assets from app.items i join app.media_assets m on m.item_id=i.id where i.id=$1',
            [item],
          )
        ).rows[0];
        expect(saved).toMatchObject({
          thumbnail_path: 'm06-synthetic/instagram_stories/3773069825095106469/thumb.jpg',
          width: 1280,
          height: 360,
          assets: 1,
          ai_status: 'pending',
        });
        expect(
          (await c.query("select count(*)::int n from pgmq.q_media where message->>'item_id'=$1", [item]))
            .rows[0].n,
        ).toBe(0);
        expect(
          (
            await c.query("select count(*)::int n from pgmq.q_ai_extract where message->>'item_id'=$1", [
              item,
            ])
          ).rows[0].n,
        ).toBe(1);
      } finally {
        await c.query('rollback');
        try {
          expect((await c.query(baseline)).rows[0]).toEqual(before);
        } finally {
          await c.end();
        }
      }
    }, 30000);
  },
);

const nativeAudience = 'https://everyone-market-researcher-m06-native-synthetic.vercel.app';
const nativeSecret = 'synthetic-media-internal-secret-for-local-sql-only';
const nativeBypass = 'synthetic-protection-bypass-for-local-sql-only';
const nativeStorageKey = 'synthetic-storage-secret-for-sdk-mock-only';
const nativeEnvironment = {
  EMR_MEDIA_PROCESS_ENABLED: 'true',
  EMR_MEDIA_UPLOAD_ENABLED: 'true',
  EMR_MEDIA_BATCH_SIZE: '1',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_GIT_COMMIT_REF: 'm06-collectors-stories-upkeep',
  VERCEL_URL: new URL(nativeAudience).hostname,
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  EMR_MEDIA_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_syntheticM06localSQL',
  NEXT_PUBLIC_SUPABASE_URL: devMediaStorageOrigin,
  INTERNAL_WEBHOOK_SECRET: nativeSecret,
  EMR_MEDIA_WRITER_PASSWORD: 'synthetic-writer-not-used-by-local-fixture',
  EMR_MEDIA_PROTECTION_BYPASS: nativeBypass,
  SUPABASE_SECRET_KEY: nativeStorageKey,
};

type NativeMediaCase =
  | 'success'
  | 'immutable_conflict'
  | 'uncertain_put'
  | 'capability_mismatch'
  | 'unsafe_dns'
  | 'oversized_image';
type ObservedRequest = { options: RequestOptions; body?: Buffer; closed: boolean };

/** Only external DNS/HTTPS/Storage boundaries are mocked. The signing handlers,
 * pinned SDK request construction, processing route and actual codec are real.
 */
async function nativeHttpFixture(mode: NativeMediaCase) {
  const png = await sharp({ create: { width: 2560, height: 720, channels: 3, background: '#abc123' } })
    .png()
    .toBuffer();
  const calls: ObservedRequest[] = [],
    uploads: Buffer[] = [];
  const sdkFetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const expected = devMediaStorageOrigin + '/storage/v1/object/upload/sign/media/';
    expect(String(url).startsWith(expected)).toBe(true);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    const headers = new Headers(init?.headers);
    expect(headers.get('apikey')).toBe(nativeStorageKey);
    expect(headers.get('authorization')).toBe('Bearer ' + nativeStorageKey);
    expect(headers.get('x-upsert')).toBeNull();
    const path = String(url).slice(expected.length);
    return Response.json({
      url:
        '/object/upload/sign/media/' +
        path +
        '?token=synthetic-native-capability' +
        (mode === 'capability_mismatch' ? '&extra=forbidden' : ''),
    });
  });
  const head = createMediaUploadReadinessHandler(() => nativeEnvironment);
  const sign = createMediaUploadHandler({
    environment: () => nativeEnvironment,
    signUpload: createSupabaseMediaSigner({ fetch: sdkFetch }),
  });
  const transport = (options: RequestOptions, listener: (res: IncomingMessage) => void): ClientRequest => {
    const req = new EventEmitter(),
      res = new EventEmitter(),
      socket = new EventEmitter();
    const observed: ObservedRequest = { options, closed: false };
    calls.push(observed);
    let destroyed = false,
      responseDestroyed = false;
    const serverAbort = new AbortController();
    Object.assign(res, {
      complete: false,
      destroy: () => {
        if (!responseDestroyed) {
          responseDestroyed = true;
          res.emit('close');
        }
      },
    });
    Object.assign(req, {
      socket,
      setTimeout: () => req,
      destroy: () => {
        if (destroyed) return req;
        destroyed = true;
        serverAbort.abort();
        (res as unknown as IncomingMessage).destroy();
        queueMicrotask(() => {
          observed.closed = true;
          socket.emit('close');
          req.emit('close');
        });
        return req;
      },
      end: (body?: Uint8Array) => {
        observed.body = body ? Buffer.from(body) : undefined;
        queueMicrotask(() => {
          req.emit('socket', socket);
          void (async () => {
            if (destroyed) return;
            const host = String(options.hostname),
              method = options.method ?? 'GET',
              path = String(options.path);
            let reply: Response;
            if (host === new URL(nativeAudience).hostname) {
              expect(path).toBe('/api/internal/media-upload-url');
              const request = new Request(nativeAudience + path, {
                method,
                headers: options.headers as Record<string, string>,
                ...(method === 'POST' ? { body: observed.body?.toString('utf8') } : {}),
                signal: serverAbort.signal,
              });
              reply = method === 'HEAD' ? await head(request) : await sign(request);
            } else if (method === 'GET') {
              expect(new Headers(options.headers as Record<string, string>).has('x-emr-secret')).toBe(false);
              reply = new Response(png, {
                headers: {
                  'content-type': 'image/png',
                  ...(mode === 'oversized_image' ? { 'content-length': String(5 * 1024 * 1024 + 1) } : {}),
                },
              });
            } else {
              expect(host).toBe(new URL(devMediaStorageOrigin).hostname);
              expect(method).toBe('PUT');
              const headers = new Headers(options.headers as Record<string, string>);
              expect(headers.get('x-upsert')).toBeNull();
              expect(headers.get('apikey')).toBeNull();
              expect(headers.get('authorization')).toBeNull();
              expect(headers.has('x-emr-secret')).toBe(false);
              expect(headers.get('content-type')).toBe('image/jpeg');
              expect(observed.body).toBeDefined();
              uploads.push(Buffer.from(observed.body!));
              expect(await sharp(observed.body!).metadata()).toMatchObject({
                format: 'jpeg',
                width: 1280,
                height: 360,
              });
              if (mode === 'uncertain_put') {
                req.emit('error', Error('synthetic lost response after sending JPEG'));
                (req as unknown as ClientRequest).destroy();
                return;
              }
              reply = Response.json(
                mode === 'immutable_conflict' ? { error: 'already exists' } : { Key: 'synthetic-object' },
                { status: mode === 'immutable_conflict' ? 409 : 200 },
              );
            }
            if (destroyed) return;
            Object.assign(res, {
              statusCode: reply.status,
              headers: Object.fromEntries(reply.headers.entries()),
            });
            const responseBytes = Buffer.from(await reply.arrayBuffer());
            listener(res as unknown as IncomingMessage);
            if (responseDestroyed || destroyed) return;
            if (responseBytes.length) res.emit('data', responseBytes);
            if (responseDestroyed || destroyed) return;
            Object.assign(res, { complete: true });
            res.emit('end');
            res.emit('close');
          })().catch((error) => {
            req.emit('error', error);
            (req as unknown as ClientRequest).destroy();
          });
        });
        return req;
      },
    });
    return req as unknown as ClientRequest;
  };
  return {
    calls,
    uploads,
    sdkFetch,
    ports: (config: Pick<MediaProcessConfig, 'audience' | 'webhookSecret' | 'protectionBypass'>) =>
      createMediaHttpPorts({
        previewOrigin: config.audience,
        webhookSecret: config.webhookSecret,
        protectionBypass: config.protectionBypass,
        transport,
        resolver: async (host) => [
          {
            address:
              mode === 'unsafe_dns' && host !== new URL(nativeAudience).hostname ? '127.0.0.1' : '8.8.8.8',
            family: 4,
          },
        ],
      }),
  };
}

// These snapshots are compared as one boolean, so a failing test never prints
// queue/audit contents or operational hashes. PostgreSQL sequences may advance
// across rollback; no sequence value is claimed restored by this fixture.
const nativeBaselineSql = `select jsonb_build_object(
  'items',(select count(*) from app.items),'raw',(select count(*) from ingest.raw_items),
  'assets',(select count(*) from app.media_assets),'companies',(select count(*) from app.competitors),
  'accounts',(select count(*) from app.competitor_accounts),'runs',(select count(*) from ops.scrape_runs),
  'costs',(select count(*) from ops.cost_ledger),'audit',(select md5(coalesce(string_agg(to_jsonb(a)::text,',' order by a.id),'')) from ops.audit_log a),
  'queue',(select md5(coalesce(string_agg(to_jsonb(q)::text,',' order by q.msg_id),'')) from pgmq.q_media q),
  'ai',(select md5(coalesce(string_agg(to_jsonb(q)::text,',' order by q.msg_id),'')) from pgmq.q_ai_extract q),
  'history',(select md5(string_agg(version::text,',' order by version)) from supabase_migrations.schema_migrations),
  'media_rpc',to_regprocedure('ops.get_media_targets(uuid[])')::text,
  'claim_rpc',to_regprocedure('ops.claim_media_batch(text,integer)')::text,
  'roles',(select jsonb_agg(jsonb_build_object('role',r.rolname,'set',coalesce(m.set_option,false),'inherit',coalesce(m.inherit_option,false)) order by r.rolname)
    from pg_roles r left join pg_auth_members m on m.roleid=r.oid and m.member=(select oid from pg_roles where rolname='postgres')
    where r.rolname in ('n8n_writer','api_agent'))
) snapshot`;

async function connectedSqlFixture(
  run: (fixture: {
    c: Client;
    item: string;
    pool: WorkerPool;
    releaseCount: () => number;
    genericQueueBefore?: string;
  }) => Promise<void>,
  lane: 'media' | 'stories' = 'media',
) {
  const c = new Client({
    host: '127.0.0.1',
    port: 60322,
    user: 'supabase_admin',
    password: 'postgres',
    database: 'postgres',
    ssl: false,
    connectionTimeoutMillis: 3000,
  });
  await c.connect();
  const before = (await c.query(nativeBaselineSql)).rows[0].snapshot;
  let releaseCount = 0,
    activeSavepoint: string | undefined,
    savepointNumber = 0;
  try {
    await c.query('begin');
    await c.query("set local lock_timeout='3s';set local statement_timeout='10s'");
    const applied = new Set(
      (await c.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version),
    );
    const directory = new URL('../../../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(directory)
      .filter((file) => /^\d{14}_.+\.sql$/.test(file))
      .sort()) {
      if (applied.has(file.slice(0, 14))) continue;
      await c.query(readFileSync(new URL(file, directory), 'utf8'));
    }
    const competitor = randomUUID(),
      account = randomUUID();
    await c.query(
      "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,'TESTM06NATIVE','m06-native-synthetic','M06 native synthetic','pilot','active')",
      [competitor],
    );
    const runId = (
      await c.query(
        "select ops.start_run($1,$2::app.platform,'daily','dev','m06-native-local-synthetic') id",
        [lane === 'stories' ? 'WF-12' : 'WF-10', lane === 'stories' ? 'instagram_stories' : 'vimeo'],
      )
    ).rows[0].id;
    await c.query(
      "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status,last_run_id,locked_until) values($1,$2,$4::app.platform,'synthetic_studio','https://www.instagram.com/synthetic_studio/','active','not_applicable',$3,now()+interval '15 minutes')",
      [account, competitor, runId, lane === 'stories' ? 'instagram_stories' : 'vimeo'],
    );
    const f = JSON.parse(
      readFileSync(
        new URL(
          '../../../n8n/normalizers/fixtures/instagram-stories-data-slayer/synthetic-contract.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const prepared = stories.prepareStoriesDataSlayerResults([f.rows[0]], {
      accounts: [
        { id: account, competitor_id: competitor, platform: 'instagram_stories', handle: 'synthetic_studio' },
      ],
      now: '2026-10-28T12:00:00Z',
    });
    let genericQueueBefore: string | undefined;
    if (lane === 'stories') {
      const backlogItem = randomUUID();
      await c.query(
        "insert into app.items(id,competitor_id,platform,item_type,external_id,url) values($1,$2,'vimeo','video','synthetic-backlog','https://vimeo.com/220099')",
        [backlogItem, competitor],
      );
      await c.query(
        "select pgmq.send_batch('media',array(select jsonb_build_object('item_id',$1::text) from generate_series(1,267)))",
        [backlogItem],
      );
      genericQueueBefore = (
        await c.query('select md5(jsonb_agg(to_jsonb(q) order by msg_id)::text) digest from pgmq.q_media q')
      ).rows[0].digest;
    }
    const selectedItems = prepared.groups[0].items.map((item: Record<string, unknown>) =>
      lane === 'stories'
        ? item
        : {
            ...item,
            platform: 'vimeo',
            actor: 'vimeo-api',
            item_type: 'video',
            url: 'https://vimeo.com/' + item.external_id,
          },
    );
    await c.query('set local role n8n_writer');
    const ingest = (
      await c.query('select ingest.upsert_raw_items($1,$2,$3::jsonb) r', [
        runId,
        account,
        JSON.stringify(selectedItems),
      ])
    ).rows[0].r;
    expect(ingest.inserted).toBe(1);
    const item = String(ingest.new_item_ids[0]);
    await c.query('reset role');
    if (lane === 'media') {
      // Generic transport-negative fixtures isolate one message inside rollback.
      // The new story profile NEVER changes generic visibility or FIFO order.
      await c.query(
        "update pgmq.q_media set vt=now()+interval '1 day' where message->>'item_id' is distinct from $1",
        [item],
      );
    }
    await c.query('set session authorization n8n_writer');
    const pool: WorkerPool = {
      connect: async () =>
        ({
          query: async (sql: string, values?: unknown[]) => {
            if (sql === 'begin') {
              if (activeSavepoint) throw Error('overlapping media test transactions');
              activeSavepoint = 'm06_rpc_' + ++savepointNumber;
              return c.query('savepoint ' + activeSavepoint);
            }
            if (sql === 'commit') {
              if (!activeSavepoint) throw Error('missing media test transaction');
              const savepoint = activeSavepoint;
              activeSavepoint = undefined;
              return c.query('release savepoint ' + savepoint);
            }
            if (sql === 'rollback') {
              if (!activeSavepoint) throw Error('missing media test rollback');
              const savepoint = activeSavepoint;
              activeSavepoint = undefined;
              await c.query('rollback to savepoint ' + savepoint);
              return c.query('release savepoint ' + savepoint);
            }
            return c.query(sql, values);
          },
          release: () => {
            releaseCount++;
          },
          // Ordinary close releases this simulated pool client. An unexpected end
          // cannot pretend physical closure while the outer rollback remains open.
          end: async () => {
            throw Error('unexpected physical end of owned SQL test fixture');
          },
          on: (event: 'error', listener: (error: unknown) => void) => c.on(event, listener),
          off: (event: 'error', listener: (error: unknown) => void) => c.off(event, listener),
        }) as WorkerClient,
    };
    await run({ c, item, pool, releaseCount: () => releaseCount, genericQueueBefore });
    expect(
      (
        await c.query(
          "select count(*)::int n from pg_locks where locktype='advisory' and pid=pg_backend_pid() and classid=73106 and objid=31 and objsubid=2",
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    try {
      await c.query('rollback');
      await c.query('reset session authorization');
      const same = (
        await c.query('select snapshot=$1::jsonb as unchanged from (' + nativeBaselineSql + ') baseline', [
          JSON.stringify(before),
        ])
      ).rows[0].unchanged;
      expect(same, 'original local row/queue/audit/role/history snapshot restored').toBe(true);
    } finally {
      await c.end();
    }
  }
}

function nativeExecution(handler: (request: Request) => Promise<Response>, executionId: string) {
  const definition = buildNativeMedia({
    audience: nativeAudience,
    credential: {
      id: 'SyntheticMediaCredential',
      name: 'Synthetic media only',
      type: 'httpCustomAuth',
      environment: 'dev',
    },
  });
  const nodes = definition.workflow.nodes;
  const preflight = nodes.find((n: { name: string }) => n.name === 'Validate media binding');
  const http = nodes.find((n: { name: string }) => n.name === 'Process media batch');
  const verify = nodes.find((n: { name: string }) => n.name === 'Verify media receipt');
  const prepared = runInNewContext(
    '(function(){' + preflight.parameters.jsCode + '\n})()',
    {
      $input: { all: () => [{ json: {} }] },
      $execution: { id: executionId },
      require: undefined,
      URL: undefined,
      process: undefined,
    },
    { timeout: 1000 },
  )[0].json;
  const evaluate = (expression: string) =>
    runInNewContext('(' + expression.slice(3, -2) + ')', { $json: prepared }, { timeout: 1000 });
  expect(http.credentials.httpCustomAuth.id).toBe('SyntheticMediaCredential');
  expect(http.parameters.options.allowUnauthorizedCerts).toBe(false);
  return async () => {
    // The native credential layer supplies these private synthetic headers;
    // the generated Code node never receives credential values.
    const response = await handler(
      new Request(evaluate(http.parameters.url), {
        method: http.parameters.method,
        headers: {
          'content-type': 'application/json',
          'x-emr-secret': nativeSecret,
          'x-vercel-protection-bypass': nativeBypass,
        },
        body: JSON.stringify(evaluate(http.parameters.jsonBody)),
      }),
    );
    const body = await response.json();
    const runVerifier = () =>
      runInNewContext(
        '(function(){' + verify.parameters.jsCode + '\n})()',
        {
          $input: { all: () => [{ json: { statusCode: response.status, body } }] },
          $: () => ({ first: () => ({ json: prepared }) }),
          require: undefined,
          URL: undefined,
          process: undefined,
        },
        { timeout: 1000 },
      );
    if (response.status === 200) expect(runVerifier()[0].json).toEqual(body);
    else expect(runVerifier).toThrow(/M06_MEDIA_/);
    return { response, body };
  };
}

describe.skipIf(process.env.EMR_M06_LOCAL_SQL_TEST !== 'true')(
  'M06 generated WF-31 to real local SQL/codec with boundary HTTP mocks',
  () => {
    it('processes newly ingested story media immediately without draining or changing 267 generic backlog deliveries', async () => {
      await connectedSqlFixture(async ({ c, item, pool, genericQueueBefore }) => {
        const http = await nativeHttpFixture('success');
        const handler = createMediaProcessHandler({
          environment: () => ({ ...nativeEnvironment, EMR_MEDIA_QUEUE: 'stories' }),
          transports: http.ports,
          open: (config, executionId, signal, onLost) =>
            openMediaDatabaseSession(pool, executionId, signal, onLost, config.batchSize, config.lane),
        });
        const execute = nativeExecution(handler, '94001');
        const initial = await execute();
        expect(initial.response.status).toBe(200);
        expect(initial.body).toMatchObject({ state: 'completed', claimed: 1, stored: 1, replayed: false });
        expect(http.uploads).toHaveLength(1);
        const jpeg = await sharp(http.uploads[0]).metadata();
        expect(jpeg).toMatchObject({ format: 'jpeg', width: 1280, height: 360 });
        expect((await execute()).body).toMatchObject({ replayed: true, stored: 1, state: 'completed' });
        expect(http.uploads).toHaveLength(1);
        expect(http.sdkFetch).toHaveBeenCalledTimes(1);
        await c.query('reset session authorization');
        expect(
          (
            await c.query(
              'select md5(jsonb_agg(to_jsonb(q) order by msg_id)::text) digest from pgmq.q_media q',
            )
          ).rows[0].digest,
        ).toBe(genericQueueBefore);
        expect(
          (
            await c.query("select count(*)::int n from pgmq.q_media_stories where message->>'item_id'=$1", [
              item,
            ])
          ).rows[0].n,
        ).toBe(0);
        expect(
          (
            await c.query("select count(*)::int n from pgmq.a_media_stories where message->>'item_id'=$1", [
              item,
            ])
          ).rows[0].n,
        ).toBe(1);
        expect(
          (await c.query('select thumbnail_path from app.items where id=$1', [item])).rows[0].thumbnail_path,
        ).toBe('m06-native-synthetic/instagram_stories/3773069825095106469/thumb.jpg');
        expect(
          (
            await c.query(
              "select count(*)::int n from ops.audit_log where action='story_media_outcome' and entity_id=$1",
              ['94001:' + item],
            )
          ).rows[0].n,
        ).toBe(1);
        expect(http.calls.every((call) => call.closed)).toBe(true);
      }, 'stories');
    }, 30000);
    it('stores once, replays the native execution and acknowledges a new already-stored message without another upload', async () => {
      await connectedSqlFixture(async ({ c, item, pool, releaseCount }) => {
        const http = await nativeHttpFixture('success');
        const handler = createMediaProcessHandler({
          environment: () => nativeEnvironment,
          transports: http.ports,
          open: (config, executionId, signal, onLost) =>
            openMediaDatabaseSession(pool, executionId, signal, onLost, config.batchSize),
        });
        const first = nativeExecution(handler, '92001');
        const initial = await first();
        expect(initial.response.status).toBe(200);
        expect(initial.body).toMatchObject({
          state: 'completed',
          claimed: 1,
          stored: 1,
          processed: 1,
          replayed: false,
          infrastructure_cost_usd: null,
        });
        expect(http.uploads).toHaveLength(1);
        expect(http.sdkFetch).toHaveBeenCalledTimes(1);
        expect(http.calls.filter((call) => call.options.method === 'GET')).toHaveLength(1);
        const replay = await first();
        expect(replay.body).toMatchObject({ replayed: true, state: 'completed', stored: 1 });
        expect(http.uploads).toHaveLength(1);
        expect(http.sdkFetch).toHaveBeenCalledTimes(1);
        await c.query('reset session authorization');
        const saved = (
          await c.query(
            'select i.thumbnail_path,i.ai_status,m.width,m.height,(select count(*) from app.media_assets where item_id=i.id)::int assets from app.items i join app.media_assets m on m.item_id=i.id where i.id=$1',
            [item],
          )
        ).rows[0];
        expect(saved).toMatchObject({
          thumbnail_path: 'm06-native-synthetic/vimeo/3773069825095106469/thumb.jpg',
          width: 1280,
          height: 360,
          assets: 1,
          ai_status: 'pending',
        });
        expect(
          (await c.query("select count(*)::int n from pgmq.q_media where message->>'item_id'=$1", [item]))
            .rows[0].n,
        ).toBe(0);
        expect(
          (
            await c.query(
              "select count(*)::int n from ops.audit_log where action='media_outcome' and entity_id=$1",
              ['92001:' + item],
            )
          ).rows[0].n,
        ).toBe(1);
        const nextId = (
          await c.query("select pgmq.send('media',jsonb_build_object('item_id',$1::text)) id", [item])
        ).rows[0].id;
        await c.query('set session authorization n8n_writer');
        expect((await first()).body.replayed).toBe(true);
        await c.query('reset session authorization');
        expect(
          (await c.query('select read_ct from pgmq.q_media where msg_id=$1', [nextId])).rows[0].read_ct,
        ).toBe(0);
        await c.query('set session authorization n8n_writer');
        const skipped = await nativeExecution(handler, '92002')();
        expect(skipped.body).toMatchObject({ state: 'completed', stored: 0, skipped: 1, bytes: 0 });
        expect(http.uploads).toHaveLength(1);
        expect(http.sdkFetch).toHaveBeenCalledTimes(1);
        expect(http.calls.filter((call) => call.options.method === 'GET')).toHaveLength(1);
        expect(http.calls.every((call) => call.closed)).toBe(true);
        expect(releaseCount()).toBe(4);
        await c.query('reset session authorization');
        expect(
          (await c.query('select count(*)::int n from pgmq.q_media where msg_id=$1', [nextId])).rows[0].n,
        ).toBe(0);
        expect(
          (
            await c.query("select count(*)::int n from pgmq.q_ai_extract where message->>'item_id'=$1", [
              item,
            ])
          ).rows[0].n,
        ).toBe(1);
        const usage = (
          await c.query(
            "select sum((after->>'bytes')::int)::int bytes,bool_and(after->'cost_usd'='null'::jsonb) unknown from ops.audit_log where action='media_outcome' and entity_id in($1,$2)",
            ['92001:' + item, '92002:' + item],
          )
        ).rows[0];
        expect(usage).toEqual({ bytes: http.uploads[0]!.length, unknown: true });
        expect(
          (await c.query('select count(*)::int n from ops.cost_ledger where item_id=$1', [item])).rows[0].n,
        ).toBe(0);
      });
    }, 30000);

    it.each<NativeMediaCase>([
      'immutable_conflict',
      'uncertain_put',
      'capability_mismatch',
      'unsafe_dns',
      'oversized_image',
    ])(
      'persists actual SQL outcome and leaves the queue unacknowledged for %s',
      async (mode) => {
        await connectedSqlFixture(async ({ c, item, pool }) => {
          const http = await nativeHttpFixture(mode);
          const handler = createMediaProcessHandler({
            environment: () => nativeEnvironment,
            transports: http.ports,
            open: (config, executionId, signal, onLost) =>
              openMediaDatabaseSession(pool, executionId, signal, onLost, config.batchSize),
          });
          const result = await nativeExecution(handler, '93001')();
          const reconciliation = ['immutable_conflict', 'uncertain_put', 'capability_mismatch'].includes(
            mode,
          );
          expect(result.response.status).toBe(reconciliation ? 409 : 200);
          expect(result.body).toMatchObject({
            state: reconciliation ? 'reconciliation_required' : 'partial',
            claimed: 1,
            processed: 1,
            stored: 0,
            infrastructure_cost_usd: null,
          });
          await c.query('reset session authorization');
          const outcome = (
            await c.query(
              "select after from ops.audit_log where action='media_outcome' and entity_id=$1 order by id desc limit 1",
              ['93001:' + item],
            )
          ).rows[0].after;
          expect(outcome.outcome).toBe(reconciliation ? 'reconciliation_required' : 'retryable');
          expect(outcome.cost_usd).toBeNull();
          expect(outcome.code).toBe(
            mode === 'immutable_conflict'
              ? 'immutable_object_exists'
              : mode === 'uncertain_put'
                ? 'media_upload_failed'
                : mode === 'capability_mismatch'
                  ? 'media_sign_failed'
                  : 'media_download_failed',
          );
          expect(
            (await c.query("select count(*)::int n from pgmq.q_media where message->>'item_id'=$1", [item]))
              .rows[0].n,
          ).toBe(1);
          expect(
            (await c.query('select count(*)::int n from app.media_assets where item_id=$1', [item])).rows[0]
              .n,
          ).toBe(0);
          expect(
            (await c.query('select thumbnail_path from app.items where id=$1', [item])).rows[0]
              .thumbnail_path,
          ).toBeNull();
          expect(
            (await c.query('select count(*)::int n from ops.cost_ledger where item_id=$1', [item])).rows[0].n,
          ).toBe(0);
          if (reconciliation) {
            // Simulated visibility expiry, not a real ten-minute observation.
            await c.query(
              "update pgmq.q_media set vt=clock_timestamp()-interval '1s' where message->>'item_id'=$1",
              [item],
            );
            const beforeGets = http.calls.filter((call) => call.options.method === 'GET').length,
              beforePuts = http.uploads.length,
              beforeRequests = http.calls.length,
              beforeSigns = http.sdkFetch.mock.calls.length;
            await c.query('set session authorization n8n_writer');
            const held = await nativeExecution(handler, '93002')();
            expect(held.response.status).toBe(409);
            expect(held.body).toMatchObject({ state: 'reconciliation_required', held: 1, processed: 0 });
            expect(http.calls.filter((call) => call.options.method === 'GET')).toHaveLength(beforeGets);
            expect(http.uploads).toHaveLength(beforePuts);
            expect(http.sdkFetch).toHaveBeenCalledTimes(beforeSigns);
            expect(http.calls.slice(beforeRequests).every((call) => call.options.method === 'HEAD')).toBe(
              true,
            );
          }
          expect(http.calls.every((call) => call.closed)).toBe(true);
        });
      },
      30000,
    );
  },
);
