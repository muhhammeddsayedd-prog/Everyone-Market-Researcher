// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
vi.mock('server-only', () => ({}));
import { createCollectorHandler } from './collectors';
import { dispatchCollectorDatabase } from './collector-database';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { m05YoutubeCloudSource } from '../../../../n8n/collectors/build-native-m05.mjs';

// Fixed public local fixture only. Everything, including the pending migration,
// rolls back; this is neither hosted authentication nor real provider evidence.
describe.skipIf(process.env.EMR_M05_LOCAL_SQL_TEST !== 'true')('M05 local restricted contracts', () => {
  it('connects exact dev claims, source ownership, snapshots, replay, quota and async barrier', async () => {
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
    const before = (
      await c.query(
        'select (select count(*) from app.items) items,(select count(*) from app.competitors) companies,(select count(*) from ops.scrape_runs) runs',
      )
    ).rows[0];
    try {
      await c.query('begin');
      for (const [fn, file] of [
        ['ops.set_account_external_id(uuid,text,text)', '20261026013910_m04_vimeo_account_resolution.sql'],
        ['ops.collector_execute(uuid,text,jsonb)', '20261027092832_m04_collector_product_contracts.sql'],
      ])
        if (!(await c.query('select to_regprocedure($1) f', [fn])).rows[0].f)
          await c.query(
            readFileSync(new URL('../../../../supabase/migrations/' + file, import.meta.url), 'utf8'),
          );
      if (!(await c.query("select to_regprocedure('ops.m05_execute(uuid,text,jsonb)') f")).rows[0].f)
        await c.query(
          readFileSync(
            new URL(
              '../../../../supabase/migrations/20261028020745_m05_web_youtube_linkedin.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
      const company = randomUUID(),
        yt = randomUUID(),
        web = randomUUID(),
        employees = randomUUID(),
        li = randomUUID();
      await c.query(
        "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,'TESTM05','m05-local','M05 local synthetic','pilot','active')",
        [company],
      );
      for (const [id, platform, url] of [
        [yt, 'youtube', 'https://www.youtube.com/@m05local'],
        [web, 'website_work_page', 'https://m05.example.com/work'],
        [employees, 'linkedin_employees', 'https://www.linkedin.com/company/m05local'],
        [li, 'linkedin', 'https://www.linkedin.com/company/m05local'],
      ])
        await c.query(
          "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status,next_due_at) values($1,$2,$3::app.platform,'m05local',$4,'active',$5::app.backfill_status,'2000-01-01')",
          [id, company, platform, url, platform === 'linkedin_employees' ? 'not_applicable' : 'pending'],
        );
      const direct = async (op: string, args: Record<string, unknown>, requestId: string = randomUUID()) =>
        (
          await c.query('select ops.m05_execute($1,$2,$3) receipt', [
            requestId,
            'm05.' + op,
            JSON.stringify(args),
          ])
        ).rows[0].receipt;
      const denied = async (sql: string, args: unknown[], code: string) => {
        await c.query('savepoint denied');
        try {
          await c.query(sql, args);
          throw Error('expected denial');
        } catch (e) {
          expect((e as { code?: string }).code).toBe(code);
        } finally {
          await c.query('rollback to denied');
        }
      };
      const start = async (workflow: string, platform: string, mode: string) =>
        (await direct('start', { workflow, platform, mode, env: 'dev', execution_id: randomUUID() })).result
          .run_id as string;
      const claim = async (run_id: string, platform: string, mode: string, account: string) =>
        direct('claim', { run_id, platform, mode, limit: 1, account_ids: [account] });
      const yr = await start('WF-13', 'youtube', 'backfill');
      await claim(yr, 'youtube', 'backfill', yt);
      await direct('resolve', {
        account_id: yt,
        external_id: 'UCabcdefghijklmnopqrstuv',
        uploads_playlist_id: 'UUactualFromChannels',
      });
      expect(
        (await c.query('select uploads_playlist_id from app.competitor_accounts where id=$1', [yt])).rows[0]
          .uploads_playlist_id,
      ).toBe('UUactualFromChannels');
      await denied(
        'select ops.m05_execute($1,$2,$3)',
        [
          randomUUID(),
          'm05.resolve',
          JSON.stringify({
            account_id: li,
            external_id: 'UCabcdefghijklmnopqrstuv',
            uploads_playlist_id: 'wrong',
          }),
        ],
        '42501',
      );
      const day = (
        await c.query(
          "select (clock_timestamp() at time zone 'America/Los_Angeles')::date::text as quota_date",
        )
      ).rows[0].quota_date;
      expect((await direct('quota', { quota_day: day, quantity: 1 })).result).toMatchObject({
        permitted: true,
        used_units: 1,
      });
      await c.query('update ops.m05_quota set used_units=8000');
      expect((await direct('quota', { quota_day: day, quantity: 1 })).result).toMatchObject({
        permitted: false,
        used_units: 8000,
      });
      const item = {
        platform: 'youtube',
        external_id: 'abcdefghijk',
        actor: 'youtube-api',
        item_type: 'video',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        published_at: '2026-10-01T00:00:00Z',
        title: 'Local synthetic',
        caption: '',
        hashtags: [],
        mentions: [],
        tagged_accounts: [],
        duration_seconds: 120,
        thumbnail_url: null,
        metrics: { views: 10 },
        media_urls: [],
        payload: { fixture: true },
      };
      const key = randomUUID(),
        args = { run_id: yr, account_id: yt, items: [item] };
      expect((await direct('ingest', args, key)).result.inserted).toBe(1);
      expect((await direct('ingest', args, key)).replayed).toBe(true);
      await denied(
        'select ops.m05_execute($1,$2,$3)',
        [key, 'm05.ingest', JSON.stringify({ ...args, items: [] })],
        '55000',
      );
      const apiCost = {
        entries: [
          {
            provider: 'youtube',
            category: 'scrape',
            quantity: 2,
            unit: 'quota_unit',
            cost_usd: 0,
            run_id: yr,
            competitor_id: company,
            platform: 'youtube',
            meta: { actor: 'youtube-api', account_id: yt, cost_key: 'youtube:' + yr + ':' + yt },
          },
        ],
      };
      expect((await direct('cost', apiCost)).result.inserted).toBe(1);
      expect((await direct('cost', apiCost)).result.inserted).toBe(0);
      await direct('report', {
        run_id: yr,
        account_id: yt,
        status: 'success',
        items_seen: 1,
        items_new: 1,
        error: null,
        backfill_done: true,
        backfill_cursor: null,
      });
      await direct('finish', { run_id: yr, status: 'success', error: null });
      const wr = await start('WF-21', 'website_work_page', 'backfill');
      await claim(wr, 'website_work_page', 'backfill', web);
      const mapCost = {
        entries: [
          {
            provider: 'firecrawl',
            category: 'scrape',
            quantity: 1,
            unit: 'credit',
            cost_usd: 0.00083,
            run_id: wr,
            competitor_id: company,
            platform: 'website_work_page',
            meta: { actor: 'firecrawl-map', account_id: web, cost_key: 'firecrawl:' + wr + ':' + web },
          },
        ],
      };
      expect((await direct('cost', mapCost)).result.inserted).toBe(1);
      expect((await direct('cost', mapCost)).result.inserted).toBe(0);
      expect(
        (await direct('diff', { run_id: wr, account_id: web, urls: ['https://m05.example.com/work/film'] }))
          .result,
      ).toEqual(['https://m05.example.com/work/film']);
      await denied(
        'select ops.mark_website_page($1,$2,$3)',
        ['https://m05.example.com/work/film', 'crawled', randomUUID()],
        '42501',
      );
      const er = await start('WF-18b', 'linkedin_employees', 'weekly');
      await claim(er, 'linkedin_employees', 'weekly', employees);
      await c.query("update ops.scrape_runs set started_at=started_at-interval '1 day' where id=$1", [er]);
      const today = (
        await c.query(
          "select (started_at at time zone 'Africa/Cairo')::date::text as quota_date from ops.scrape_runs where id=$1",
          [er],
        )
      ).rows[0].quota_date;
      const people = [
          { public_id: 'person-synthetic', name: 'Person 1', title: 'Director', location: 'Cairo' },
        ],
        coverage = { complete: false, reason: 'bounded_query' };
      await c.query(
        'insert into app.employee_snapshots(competitor_id,account_id,snapshot_date,headcount_listed,people,coverage) values($1,$2,$3::date-1,1,\'[{"public_id":"prior-person","name":"Person 0","title":"Producer","location":"Cairo"}]\',$4)',
        [company, employees, today, coverage],
      );
      await c.query(
        "insert into app.people(name,slug,primary_role,linkedin_public_id,status) values('Human corrected name','m05-human-preserved','Founder','person-synthetic','confirmed')",
      );
      const snap = { run_id: er, account_id: employees, snapshot_date: today, people, coverage };
      expect((await direct('snapshot', snap)).result).toMatchObject({
        headcount: 1,
        joined_count: 0,
        left_count: 0,
        replayed: false,
      });
      expect((await direct('snapshot', snap)).result.replayed).toBe(true);
      await denied(
        'select ops.save_employee_snapshot($1,$2,$3,$4)',
        [employees, today, JSON.stringify([{ ...people[0], email: 'forbidden' }]), JSON.stringify(coverage)],
        '22023',
      );
      await denied(
        'select ops.save_employee_snapshot($1,$2,$3,$4)',
        [employees, today, JSON.stringify([{ ...people[0], name: 'changed' }]), JSON.stringify(coverage)],
        '55000',
      );
      await denied(
        'select ops.save_employee_snapshot($1,$2,$3,$4)',
        [
          employees,
          today,
          JSON.stringify(people),
          JSON.stringify({ complete: true, reason: 'invented_complete' }),
        ],
        '22023',
      );
      await denied(
        'select ops.save_employee_snapshot($1,$2,$3,$4)',
        [
          employees,
          today,
          JSON.stringify(people),
          JSON.stringify({ ...coverage, capped: { email: 'forbidden' } }),
        ],
        '22023',
      );
      expect(
        (
          await c.query(
            'select people,coverage,left_company,joined from app.employee_snapshots where account_id=$1 and snapshot_date=$2',
            [employees, today],
          )
        ).rows[0],
      ).toEqual({ people, coverage, left_company: [], joined: [] });
      expect(
        (
          await c.query(
            "select name,primary_role,status from app.people where linkedin_public_id='person-synthetic'",
          )
        ).rows[0],
      ).toEqual({ name: 'Human corrected name', primary_role: 'Founder', status: 'confirmed' });
      // Pending intents, even without a provider response, hold both the parent
      // and claim; registration cannot be silently closed after ambiguous POST.
      const launch_id = randomUUID(),
        approval_id = randomUUID();
      const actorInput = {
        startUrls: [{ url: 'https://m05.example.com/work/film' }],
        crawlerType: 'cheerio',
        maxCrawlDepth: 0,
        maxCrawlPages: 1,
        maxResults: 1,
        useSitemaps: false,
        useLlmsTxt: false,
        respectRobotsTxtFile: true,
        ignoreHttpsErrors: false,
        maxSessionRotations: 0,
        maxRequestRetries: 1,
        requestTimeoutSecs: 60,
        maxConcurrency: 3,
        saveMarkdown: true,
        htmlTransformer: 'readableText',
        removeCookieWarnings: true,
        blockMedia: true,
        saveFiles: false,
        saveContentTypes: '',
        saveHtml: false,
        saveHtmlAsFile: false,
        saveScreenshots: false,
        summarize: false,
        signHttpRequests: false,
        proxyConfiguration: { useApifyProxy: true },
      };
      const launchArgs = {
        run_id: wr,
        launch_id,
        actor_id: 'apify/website-content-crawler',
        pass: 'primary',
        account_ids: [web],
        purpose: 'backfill',
        results_limit: 1,
        actor_input: actorInput,
        urls: ['https://m05.example.com/work/film'],
        crawler_type: 'cheerio',
        approval_id,
        max_actor_starts: 2,
        max_actor_usd: 1,
        max_total_usd: 2,
        max_website_urls_per_account: 1,
      };
      for (const actor_input of [
        {
          ...actorInput,
          startUrls: [{ url: 'https://m05.example.com/work/film', headers: { authorization: 'forbidden' } }],
        },
        { ...actorInput, ignoreHttpsErrors: true },
        { ...actorInput, saveContentTypes: 'video/mp4' },
        { ...actorInput, proxyConfiguration: { useApifyProxy: true, password: 'forbidden' } },
      ])
        await denied(
          'select ops.m05_execute($1,$2,$3)',
          [randomUUID(), 'm05.launch', JSON.stringify({ ...launchArgs, actor_input })],
          '42501',
        );
      const ei = {
        companies: ['https://www.linkedin.com/company/m05local'],
        profileScraperMode: 'Short ($4 per 1k)',
        companyBatchMode: 'one_by_one',
        maxItems: 20,
        maxItemsPerCompany: 20,
        startPage: 1,
        takePages: 1,
      };
      const employeeLaunch = {
        run_id: er,
        launch_id: randomUUID(),
        actor_id: 'harvestapi/linkedin-company-employees',
        pass: 'primary',
        account_ids: [employees],
        purpose: 'weekly',
        results_limit: 20,
        actor_input: ei,
        snapshot_date: today,
        approval_id: randomUUID(),
        max_actor_starts: 2,
        max_actor_usd: 1,
        max_total_usd: 2,
      };
      for (const actor_input of [
        { ...ei, profileScraperMode: null },
        { ...ei, profileScraperMode: 'Full ($8 per 1k)' },
      ])
        await denied(
          'select ops.m05_execute($1,$2,$3)',
          [randomUUID(), 'm05.launch', JSON.stringify({ ...employeeLaunch, actor_input })],
          '22023',
        );
      await direct('launch', employeeLaunch);
      await direct('register', {
        run_id: er,
        launch_id: employeeLaunch.launch_id,
        actor_id: employeeLaunch.actor_id,
        pass: 'primary',
        account_ids: [employees],
        purpose: 'weekly',
        apify_run_id: 'm05employeeconflict',
      });
      const conflict = {
        apify_run_id: 'm05employeeconflict',
        status: 'SUCCEEDED',
        dataset_id: 'm05employees',
        usage_usd: 0.02,
        groups: [
          {
            account_id: employees,
            status: 'success',
            people: [{ ...people[0], name: 'New source observation' }],
            coverage,
            backfill_cursor: null,
          },
        ],
      };
      expect((await direct('settle', conflict)).result.groups[0].error).toBe('employee_snapshot_conflict');
      expect((await direct('settle', conflict)).result.updated).toBe(false);
      await direct('close_registration', { run_id: er });
      expect(
        (
          await c.query(
            'select people from app.employee_snapshots where account_id=$1 and snapshot_date=$2',
            [employees, today],
          )
        ).rows[0].people,
      ).toEqual(people);
      expect(
        (
          await c.query(
            "select sum(cost_usd)::float8 usd from ops.cost_ledger where meta->>'apify_run_id'='m05employeeconflict'",
          )
        ).rows[0].usd,
      ).toBe(0.02);
      expect((await direct('launch', launchArgs)).result.permit).toBe(true);
      expect((await direct('launch', launchArgs)).result.permit).toBe(false);
      await denied(
        'select ops.m05_execute($1,$2,$3)',
        [randomUUID(), 'm05.close_registration', JSON.stringify({ run_id: wr })],
        '55000',
      );
      await direct('register', {
        run_id: wr,
        launch_id,
        actor_id: launchArgs.actor_id,
        pass: 'primary',
        account_ids: [web],
        purpose: 'backfill',
        apify_run_id: 'm05localactor',
      });
      expect((await direct('close_registration', { run_id: wr })).result.state).toBe('awaiting_callbacks');
      expect(
        (
          await c.query('select locked_until is not null held from app.competitor_accounts where id=$1', [
            web,
          ])
        ).rows[0].held,
      ).toBe(true);
      const url = 'https://m05.example.com/work/film';
      const wi = {
        ...item,
        platform: 'website_work_page',
        external_id: createHash('sha256').update(url).digest('hex').slice(0, 32),
        actor: 'apify/website-content-crawler',
        item_type: 'project_page',
        url,
        published_at: null,
        payload: { fixture: true, backfill: true },
      };
      const settle = {
        apify_run_id: 'm05localactor',
        status: 'SUCCEEDED',
        dataset_id: 'm05dataset',
        usage_usd: 0.012,
        groups: [
          {
            account_id: web,
            status: 'success',
            items: [wi],
            pages: [{ url, status: 'crawled' }],
            retry_urls: [],
            backfill_cursor: null,
          },
        ],
      };
      const thin = {
        ...settle,
        groups: [
          {
            account_id: web,
            status: 'success',
            items: [],
            pages: [{ url, status: 'thin' }],
            retry_urls: [url],
            backfill_cursor: null,
          },
        ],
      };
      expect((await direct('settle', thin)).result.updated).toBe(true);
      expect((await c.query('select status from ops.scrape_runs where id=$1', [wr])).rows[0].status).toBe(
        'running',
      );
      expect(
        (
          await c.query('select locked_until is not null held from app.competitor_accounts where id=$1', [
            web,
          ])
        ).rows[0].held,
      ).toBe(true);
      const retry_id = randomUUID(),
        retryArgs = {
          ...launchArgs,
          launch_id: retry_id,
          retry_of: launch_id,
          crawler_type: 'playwright:adaptive',
          actor_input: { ...actorInput, crawlerType: 'playwright:adaptive' },
        };
      expect((await direct('launch', retryArgs)).result.permit).toBe(true);
      await direct('register', {
        run_id: wr,
        launch_id: retry_id,
        actor_id: launchArgs.actor_id,
        pass: 'primary',
        account_ids: [web],
        purpose: 'backfill',
        apify_run_id: 'm05localretry',
      });
      const retrySettlement = {
        ...settle,
        apify_run_id: 'm05localretry',
        dataset_id: 'm05retrydataset',
        usage_usd: 0.013,
      };
      expect((await direct('settle', retrySettlement)).result.updated).toBe(true);
      expect((await direct('settle', thin)).result.updated).toBe(false);
      expect((await direct('settle', retrySettlement)).result.updated).toBe(false);
      expect(
        (await c.query('select status,item_id is not null linked from app.website_pages where url=$1', [url]))
          .rows[0],
      ).toEqual({ status: 'crawled', linked: true });
      expect((await c.query('select status from ops.scrape_runs where id=$1', [wr])).rows[0].status).toBe(
        'success',
      );
      expect(
        (
          await c.query(
            "select count(*)::int n,sum(cost_usd)::float8 usd from ops.cost_ledger where meta->>'apify_run_id'='m05localactor'",
          )
        ).rows[0],
      ).toEqual({ n: 1, usd: 0.012 });
      expect(
        (
          await c.query(
            "select count(*)::int n from ops.collector_passes where run_id=$1 and status='pending'",
            [wr],
          )
        ).rows[0].n,
      ).toBe(0);
      await c.query('set local role n8n_writer');
      await denied('select * from ops.m05_jobs', [], '42501');
      await c.query('reset role');
      await c.query('set local role api_agent');
      await denied(
        'select ops.m05_execute($1,$2,$3)',
        [randomUUID(), 'm05.quota', JSON.stringify({ quota_day: day, quantity: 0 })],
        '42501',
      );
      await c.query('reset role');
      expect(
        (
          await c.query(
            "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('m05_jobs','m05_quota') and c.relrowsecurity",
          )
        ).rows[0].n,
      ).toBe(2);
      // Actual HTTP handler → fixed SQL adapter under the simulated restricted
      // local identity. No service/admin credential enters the app interface.
      const token = 'local-m05-synthetic-machine-token-12345',
        origin = 'https://everyone-market-researcher-local.vercel.app';
      const environment = {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'm05-collectors-web-youtube-linkedin',
        VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
        VERCEL_URL: new URL(origin).host,
        VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
        EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
        VERCEL_DEPLOYMENT_ID: 'dpl_local',
        EMR_COLLECTORS_ENABLED: 'true',
        EMR_COLLECTORS_WRITER_PASSWORD: 'synthetic',
        EMR_COLLECTORS_APIFY_READ_TOKEN: 'synthetic',
        EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
        EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify([yt, web, employees, li]),
      };
      const handler = createCollectorHandler({
        environment: () => environment,
        dispatch: async (requestId, operation, args) => {
          // SQL transport contract itself has independent identity tests. This
          // transaction adapter avoids committing the rollback-only fixture.
          return direct(operation.replace('m05.', ''), args, requestId);
        },
        processCallback: async () => {
          throw Error('not invoked');
        },
      });
      const response = await handler(
        new Request(origin + '/api/internal/n8n/collectors', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
          body: JSON.stringify({
            version: 1,
            requestId: randomUUID(),
            operation: 'm05.quota',
            args: { quota_day: day, quantity: 0 },
          }),
        }),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).result.used_units).toBe(8000);
      // Execute the serialized Cloud Code functions with documented synthetic
      // Google HTTP responses and the ACTUAL typed HTTP → SQL business path.
      // Reset only this transaction's synthetic quota/due fixture, never a live
      // counter. Final rollback verifies the original local database unchanged.
      await c.query('update ops.m05_quota set used_units=0');
      await c.query("update app.competitor_accounts set next_due_at='2000-01-01' where id=$1", [yt]);
      type State = {
        action: string;
        request: Record<string, unknown>;
        http: { kind: string };
        result?: { run_id: string; status: string; items_new: number };
      };
      const rt = runInNewContext(
        m05YoutubeCloudSource + '\n({initializeM05Youtube,advanceM05YoutubeGateway,advanceM05YoutubeHttp})',
        {},
        { timeout: 1000 },
      ) as {
        initializeM05Youtube: (selection: unknown, id: string, now: string) => State;
        advanceM05YoutubeGateway: (state: State, response: unknown) => State;
        advanceM05YoutubeHttp: (state: State, response: unknown) => State;
      };
      const channel = 'UCabcdefghijklmnopqrstuv';
      let native = rt.initializeM05Youtube(
        { env: 'dev', mode: 'daily', account_ids: [yt], max_pages: 2, page_size: 50 },
        '280000000001',
        new Date().toISOString(),
      );
      let providerCalls = 0;
      for (let i = 0; native.action !== 'done' && i < 60; i++) {
        if (native.action === 'gateway') {
          const r = await handler(
            new Request(origin + '/api/internal/n8n/collectors', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
              body: JSON.stringify(native.request),
            }),
          );
          expect(r.status).toBe(200);
          native = rt.advanceM05YoutubeGateway(native, { statusCode: r.status, body: await r.json() });
        } else {
          expect(native.action).toBe('youtube');
          providerCalls++;
          const body =
            native.http.kind === 'list'
              ? {
                  items: [
                    {
                      snippet: { videoOwnerChannelId: channel },
                      contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-10-01T00:00:00Z' },
                    },
                  ],
                }
              : {
                  items: [
                    {
                      id: 'abcdefghijk',
                      snippet: {
                        channelId: channel,
                        publishedAt: '2026-10-01T00:00:00Z',
                        title: 'Local synthetic',
                        description: 'Local synthetic',
                      },
                      contentDetails: { duration: 'PT2M' },
                      statistics: { viewCount: '11' },
                      status: { privacyStatus: 'public', uploadStatus: 'processed' },
                    },
                  ],
                };
          native = rt.advanceM05YoutubeHttp(native, { statusCode: 200, body });
        }
      }
      expect(native.action).toBe('done');
      expect(native.result?.status).toBe('success');
      expect(providerCalls).toBe(2);
      expect(
        (await c.query('select status,items_new from ops.scrape_runs where id=$1', [native.result!.run_id]))
          .rows[0],
      ).toEqual({ status: 'success', items_new: 0 });
      expect(
        (await c.query('select metrics from app.items where account_id=$1', [yt])).rows[0].metrics.views,
      ).toBe(11);
      expect(
        (await c.query('select used_units from ops.m05_quota where quota_day=$1', [day])).rows[0].used_units,
      ).toBe(2);
      expect(typeof dispatchCollectorDatabase).toBe('function');
    } finally {
      await c.query('rollback');
      expect(
        (
          await c.query(
            'select (select count(*) from app.items) items,(select count(*) from app.competitors) companies,(select count(*) from ops.scrape_runs) runs',
          )
        ).rows[0],
      ).toEqual(before);
      await c.end();
    }
  });
});
