import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { loadProdInputs, assertNoProdRunState } from './prod-inputs';
import { prodDatabaseConfig, prodMigrationVersions, prodTarget } from './prod-model';
import { atomicJson, acquireWriteGate, completeWriteBatch, sha256 as sha256Bytes } from './files';
import { seedWithinTransaction } from './seed-competitors';
import {
  applyFrozenAccounts,
  assertEmptyProdState,
  assertFrozenAccounts,
  verifyFinalProdConfiguration,
  commitFreshProdLogo,
  readFrozenLogo,
  readProdState,
} from './prod-operations';
import { readAccounts } from './database';
import { storageHooks } from './storage';
import { prodUploadFetch, prodPublicRead } from './prod-storage';
import type { PreparedLogo } from './copy-logos';
import { buildReport, type ReportSnapshot } from './report';
import { SeedRuntimeError } from './config';
import { databaseFailure } from './database-failure';

declare const EMR_REPO_ROOT: string | undefined;
const root =
  typeof EMR_REPO_ROOT === 'undefined'
    ? join(dirname(fileURLToPath(import.meta.url)), '../..')
    : EMR_REPO_ROOT;
const out = join(root, 'scripts/seed/out');
const signal = AbortSignal.timeout(25 * 60 * 1000);
const receipt: {
  environment: 'prod';
  projectRef: string;
  runId: string;
  observedAt: string;
  databaseAuthentication: string;
  stages: Array<{ name: string; status: string; result?: unknown; code?: string }>;
  nativeCompletion: string;
} = {
  environment: 'prod',
  projectRef: prodTarget.ref,
  runId: randomUUID(),
  observedAt: new Date().toISOString(),
  databaseAuthentication: 'not_attempted',
  stages: [],
  nativeCompletion: 'in_progress',
};
const save = () => atomicJson(join(out, 'prod-latest.json'), receipt);
async function stage<T>(
  name: string,
  run: () => Promise<T>,
  summarize: (value: T) => unknown = (value) => value,
) {
  const entry: { name: string; status: string; result?: unknown; code?: string } = {
    name,
    status: 'running',
  };
  receipt.stages.push(entry);
  await save();
  try {
    const value = await run();
    entry.status = 'completed';
    entry.result = summarize(value);
    await save();
    return value;
  } catch (error) {
    entry.status = 'blocked';
    entry.code = error instanceof SeedRuntimeError ? error.code : 'M02_PROD_STAGE_FAILED';
    await save();
    throw error;
  }
}
async function snapshot(sql: Sql): Promise<ReportSnapshot> {
  return sql.begin('read only', async (tx) => {
    const competitors =
      await tx`select id,company_code,slug,name,priority_tier,is_baseline,pilot_rank,logo_url,logo_path from app.competitors order by company_code`;
    const accounts =
      await tx`select id,competitor_id,platform,handle,handle_norm,url,status,resolve_status,external_id,uploads_playlist_id,backfill_status,backfill_from::text,cadence::text,last_error from app.competitor_accounts order by competitor_id,platform,handle_norm`;
    const mediaAssets =
      await tx`select id,competitor_id,kind,storage_path,source_url from app.media_assets where kind='logo' order by id`;
    return { competitors, accounts, mediaAssets } as unknown as ReportSnapshot;
  });
}
async function main() {
  const action = process.argv[2];
  if (process.argv.length !== 3 || !['preflight', 'apply'].includes(action ?? ''))
    throw new SeedRuntimeError('M02_PROD_COMMAND_REJECTED');
  if (
    action === 'preflight' &&
    Object.keys(process.env).some(
      (name) =>
        /^(?:PG.*|SUPABASE_.*|.*DATABASE_URL|VIMEO_TOKEN|YOUTUBE_API_KEY|N8N_WRITER_URL|API_AGENT_URL)$/.test(
          name,
        ) && process.env[name],
    )
  )
    throw new SeedRuntimeError('M02_PROD_PREFLIGHT_REQUIRES_CREDENTIAL_FREE_PROCESS');
  const input = await loadProdInputs(root, action === 'apply');
  const assertionsSql = await readFile(join(root, 'scripts/assert/m02_counts.sql'), 'utf8');
  await assertNoProdRunState(out);
  if (action === 'preflight') {
    process.stdout.write(
      JSON.stringify({
        status: 'verified',
        environment: 'prod',
        projectRef: prodTarget.ref,
        approved: input.packet.approved,
      }) + '\n',
    );
    return;
  }
  const options = prodDatabaseConfig(process.env, input.ca);
  const storageKey = process.env.SUPABASE_SECRET_KEY!;
  for (const key of [
    'PGPASSWORD',
    'SEED_DATABASE_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_URL',
    'VIMEO_TOKEN',
    'YOUTUBE_API_KEY',
  ])
    delete process.env[key];
  await mkdir(out, { recursive: true });
  const sql = postgres(options);
  let release: (() => Promise<void>) | undefined;
  try {
    await stage('database_identity', async () => {
      receipt.databaseAuthentication = 'connection_attempted_identity_unverified';
      await save();
      let identity;
      try {
        [identity] = await sql`select current_user,session_user,current_database() as database`;
      } catch (error) {
        const failure = databaseFailure(error);
        receipt.databaseAuthentication = failure.authentication;
        throw new SeedRuntimeError(failure.code);
      }
      if (
        identity?.current_user !== 'postgres' ||
        identity.session_user !== 'postgres' ||
        identity.database !== 'postgres'
      )
        throw new SeedRuntimeError('M02_PROD_DATABASE_IDENTITY_REJECTED');
      receipt.databaseAuthentication = 'postgres_authenticated_to_verified_prod_pooler';
      const migrations =
        await sql`select version from supabase_migrations.schema_migrations order by version`;
      if (JSON.stringify(migrations.map((row) => row.version)) !== JSON.stringify(prodMigrationVersions))
        throw new SeedRuntimeError('M02_PROD_MIGRATION_BASELINE_MISMATCH');
      return {
        current_user: 'postgres',
        session_user: 'postgres',
        database: 'postgres',
        originalMigrations: 7,
      };
    });
    await stage('empty_production_preflight', async () => {
      const state = await readProdState(sql);
      assertEmptyProdState(state);
      const bucket = await sql`select public from storage.buckets where id='media'`;
      if (bucket.length !== 1 || bucket[0]!.public !== true)
        throw new SeedRuntimeError('M02_PROD_MEDIA_BUCKET_REJECTED');
      return { counts: state, mediaBucketPublic: true };
    });
    release = await acquireWriteGate(join(out, 'prod-write-pending.json'), {
      target: prodTarget.identity,
      action: 'frozen-seed',
      sourceSha256: input.sources.sourceSha256,
      payloadSha256: input.packet.payloadSha256,
    });
    try {
      await writeFile(
        join(out, 'prod-seed-admission.json'),
        JSON.stringify(
          {
            version: 1,
            target: prodTarget.identity,
            runId: receipt.runId,
            sourceSha256: input.sources.sourceSha256,
            payloadSha256: input.packet.payloadSha256,
            logoManifestSha256: input.packet.logoManifestSha256,
            startedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    } catch {
      throw new SeedRuntimeError('M02_PROD_ADMISSION_UNAVAILABLE');
    }
    const prepared = await stage(
      'frozen_dev_public_logos',
      async () => {
        const logos = new Map<string, PreparedLogo>();
        let bytes = 0;
        for (const entry of input.logos.logos) {
          if (signal.aborted) throw new SeedRuntimeError('M02_PROD_TIMEOUT');
          const result = await readFrozenLogo(entry, undefined, signal);
          logos.set(entry.company_code, result);
          bytes += result.bytes.byteLength;
        }
        if (logos.size !== 257 || bytes !== 1560325)
          throw new SeedRuntimeError('M02_PROD_LOGO_BUDGET_MISMATCH');
        return { logos, bytes };
      },
      (value) => ({ verifiedObjects: value.logos.size, verifiedBytes: value.bytes }),
    );
    const first = await stage(
      'seed_and_frozen_configuration',
      async () => {
        const result = await sql.begin(async (tx) => {
          await tx`lock table app.competitors,app.competitor_accounts,app.media_assets,app.items,ingest.raw_items,app.website_pages,app.employee_snapshots,ops.scrape_run_accounts in share row exclusive mode`;
          assertEmptyProdState(await readProdState(tx));
          const seed = await seedWithinTransaction(tx, input.plan, { target: prodTarget.identity });
          if (
            seed.stats.competitorsInserted !== 285 ||
            seed.stats.accountsInserted !== 1754 ||
            seed.stats.competitorsUpdated !== 0 ||
            seed.stats.accountsUpdated !== 0
          )
            throw new SeedRuntimeError('M02_PROD_FIRST_SEED_MISMATCH');
          const frozen = await applyFrozenAccounts(tx, input.payload, seed.manifest);
          return { ...seed, frozen };
        });
        await atomicJson(join(out, 'prod-seed-manifest.json'), result.manifest);
        return result;
      },
      (value) => ({ stats: value.stats, frozen: value.frozen, issues: value.issues.length }),
    );
    await stage('second_seed_noop', async () => {
      const second = await sql.begin(async (tx) => {
        await tx`lock table app.competitors,app.competitor_accounts in share row exclusive mode`;
        assertFrozenAccounts(await readAccounts(tx), input.payload, first.manifest);
        const seed = await seedWithinTransaction(tx, input.plan, {
          target: prodTarget.identity,
          manifest: first.manifest,
        });
        if (Object.values(seed.stats).some((value) => value !== 0))
          throw new SeedRuntimeError('M02_PROD_SECOND_SEED_NOT_NOOP');
        const frozen = await applyFrozenAccounts(tx, input.payload, seed.manifest);
        if (frozen.updated !== 0) throw new SeedRuntimeError('M02_PROD_SECOND_FROZEN_IMPORT_NOT_NOOP');
        return { ...seed, frozen };
      });
      await atomicJson(join(out, 'prod-seed-manifest.json'), second.manifest);
      return { stats: second.stats, frozen: second.frozen };
    });
    await stage('production_logos', async () => {
      const base = `https://${prodTarget.ref}.supabase.co`;
      const client = createClient(base, storageKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: prodUploadFetch(input.logos, signal) },
      });
      const hooks = storageHooks(client, base, { signal, maxUploadBytes: 1560325 });
      const manifest: {
        version: 1;
        target: string;
        logos: Record<string, { storagePath: string; sourceUrl: string | null; sha256: string }>;
      } = { version: 1, target: prodTarget.identity, logos: {} };
      const readPublic = prodPublicRead(input.logos, signal);
      const hashes: Array<{ company_code: string; path: string; sha256: string; bytes: number }> = [];
      for (const entry of input.logos.logos) {
        if (signal.aborted) throw new SeedRuntimeError('M02_PROD_TIMEOUT');
        const competitorId = first.manifest.competitors[entry.company_code]?.id;
        const bytes = prepared.logos.get(entry.company_code);
        if (!competitorId || !bytes) throw new SeedRuntimeError('M02_PROD_LOGO_OWNERSHIP_MISSING');
        if ((await hooks.upload(entry.storagePath, bytes)) !== 'created')
          throw new SeedRuntimeError('M02_PROD_LOGO_COLLISION');
        const stored = await readPublic(entry.storagePath);
        if (stored.byteLength !== entry.byteLength || sha256Bytes(stored) !== entry.sha256)
          throw new SeedRuntimeError('M02_PROD_PUBLIC_LOGO_MISMATCH');
        await sql.begin((tx) =>
          commitFreshProdLogo(tx, {
            competitorId,
            kind: 'logo',
            storagePath: entry.storagePath,
            sourceUrl: entry.sourceUrl,
            sha256: entry.sha256,
            expectedLogoPath: null,
            width: entry.width,
            height: entry.height,
          }),
        );
        manifest.logos[competitorId] = {
          storagePath: entry.storagePath,
          sourceUrl: entry.sourceUrl,
          sha256: entry.sha256,
        };
        await atomicJson(join(out, 'prod-logo-manifest.json'), manifest);
        hashes.push({
          company_code: entry.company_code,
          path: entry.storagePath,
          sha256: entry.sha256,
          bytes: entry.byteLength,
        });
      }
      if (hooks.uploadedBytes() !== 1560325 || hashes.length !== 257)
        throw new SeedRuntimeError('M02_PROD_LOGO_BUDGET_MISMATCH');
      return { uploadedBytes: hooks.uploadedBytes(), publicByteHashes: hashes };
    });
    await stage('reviewed_read_only_assertions', async () => {
      const assertions = await sql.begin('read only', (tx) => tx.unsafe(assertionsSql));
      if (assertions.length === 0 || assertions.some((row) => row.passed === false))
        throw new SeedRuntimeError('M02_PROD_SQL_ACCEPTANCE_FAILED');
      await atomicJson(join(out, 'prod-count-assertions.json'), {
        environment: 'prod',
        projectRef: prodTarget.ref,
        observedAt: new Date().toISOString(),
        assertions,
      });
      return { assertions };
    });
    await stage('final_report_and_parity', async () => {
      const exact = await sql.begin('isolation level repeatable read read only', (tx) =>
        verifyFinalProdConfiguration(tx, input.plan, input.payload, first.manifest, input.logos),
      );
      const actual = await snapshot(sql);
      const report = buildReport(actual, {
        environment: 'prod',
        target: prodTarget.ref,
        issues: input.plan.issues,
      });
      const counts = report.counts;
      if (
        counts.competitors !== 285 ||
        counts.accounts !== 1754 ||
        counts.logos.sourceCopied !== 256 ||
        counts.logos.baselineCopied !== 1 ||
        counts.logos.mediaMetadataMissing !== 0 ||
        counts.duplicateKeys !== 0 ||
        counts.resolution.vimeo.resolved !== 202 ||
        counts.resolution.youtube.resolved !== 121 ||
        counts.resolution.youtube.pending !== 0
      )
        throw new SeedRuntimeError('M02_PROD_FINAL_COUNTS_REJECTED');
      const state = await readProdState(sql);
      for (const row of state)
        if (
          !['competitors', 'accounts', 'media_assets', 'logo_objects'].includes(row.name) &&
          row.count !== '0'
        )
          throw new SeedRuntimeError('M02_PROD_UNEXPECTED_COLLECTION');
      if (
        state.find((row) => row.name === 'logo_objects')?.count !== '257' ||
        state.find((row) => row.name === 'media_assets')?.count !== '257'
      )
        throw new SeedRuntimeError('M02_PROD_FINAL_LOGOS_REJECTED');
      for (const entry of input.logos.logos) {
        const competitor = actual.competitors.find((row) => row.company_code === entry.company_code);
        const asset = actual.mediaAssets.find((row) => row.storage_path === entry.storagePath);
        if (
          !competitor ||
          competitor.id !== first.manifest.competitors[entry.company_code]?.id ||
          competitor.logo_path !== entry.storagePath ||
          asset?.competitor_id !== competitor.id ||
          asset.source_url !== entry.sourceUrl
        )
          throw new SeedRuntimeError('M02_PROD_FINAL_LOGO_OWNER_MISMATCH');
      }
      await atomicJson(join(out, 'prod-report.json'), {
        environment: 'prod',
        projectRef: prodTarget.ref,
        observedAt: new Date().toISOString(),
        counts,
        reviewItems: report.reviewItems,
      });
      await atomicJson(join(out, 'prod-final-public-snapshot.json'), {
        environment: 'prod',
        projectRef: prodTarget.ref,
        observedAt: new Date().toISOString(),
        snapshot: actual,
        exactConfiguration: exact,
      });
      await writeFile(join(out, 'prod-unresolved.csv'), report.unresolvedCsv, { mode: 0o600 });
      await writeFile(join(out, 'prod-report.md'), report.summaryMarkdown, { mode: 0o600 });
      return {
        counts,
        state,
        rawPilotYouTube: { resolved: 10, total: 11 },
        eligiblePilotYouTube: { resolved: 10, total: 10 },
        advisors: 'separate_hosted_readback_required',
      };
    });
    return release;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
// A fixed error code is the only console failure output. Database and Storage errors are withheld.
const archive = () =>
  writeFile(join(out, `prod-receipt-${receipt.runId}.json`), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
try {
  const release = await main();
  if (process.argv[2] === 'apply') {
    receipt.nativeCompletion = 'success';
    await completeWriteBatch(async () => {
      await save();
      await archive();
    }, release);
  }
} catch (error) {
  const code = error instanceof SeedRuntimeError ? error.code : 'M02_PROD_FAILED_RAW_ERROR_WITHHELD';
  process.stderr.write(code + '\n');
  process.exitCode = 1;
  if (process.argv[2] === 'apply' && receipt.stages.length > 0) {
    receipt.nativeCompletion = 'failed';
    try {
      await save();
      await archive();
    } catch {
      process.stderr.write('M02_PROD_RECEIPT_WRITE_FAILED\n');
    }
  }
}
