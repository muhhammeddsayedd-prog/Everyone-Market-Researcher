// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { createMediaThumbnail } from './media-thumbnail';
import { runMediaBatch, devMediaStorageOrigin, type MediaPorts } from '../../../n8n/media/worker';
const require = createRequire(import.meta.url);
const stories = require('../../../n8n/normalizers/storiesDataSlayer.js');

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
