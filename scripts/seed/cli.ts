import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { databaseConfig, parseCommand, SeedRuntimeError } from './config';
import { loadSeedInput, planSeed, seedCompetitors } from './seed-competitors';
import { seedManifestSchema, type SeedIssue } from './model';
import {
  acquireWriteGate,
  atomicJson,
  completeWriteBatch,
  readOptionalJson,
  seedSourceFiles,
  sha256,
} from './files';
import { assertDevBatchPacket } from './batch-packet';
import { buildReport, type ReportSnapshot } from './report';
import { createLogoDatabaseAdapter, readAccounts, readLogoInputs } from './database';
import { checkAccounts, probeProviders, resolveAccounts } from './resolve-accounts';
import { copyLogo, LogoError, type LogoOwnership } from './copy-logos';
import { restrictedStorageFetch, storageHooks } from './storage';
import { scopedAccounts, scopedLogos } from './scope';
import { databaseFailure } from './database-failure';
import { validateDevCa } from './database-ca';
import { createProviderResolvers, type YouTubeBadResponseShape } from './providers';
import { assertYouTubeContinuationScope, youtubeContinuationBudget } from './youtube-continuation';
import {
  admitProviderBudgetAction,
  approvedOriginalRunId,
  assertProviderBudgetAction,
  providerBudgetEvidencePaths,
} from './provider-budget';

declare const EMR_REPO_ROOT: string | undefined;
const root =
  typeof EMR_REPO_ROOT === 'undefined'
    ? join(dirname(fileURLToPath(import.meta.url)), '../..')
    : EMR_REPO_ROOT;
const out = join(root, 'scripts/seed/out');
const signal = AbortSignal.timeout(40 * 60 * 1_000);
type Stage = { name: string; status: 'running' | 'completed' | 'blocked'; code?: string; result?: unknown };
const receipt: {
  environment: 'dev';
  projectRef: string;
  observedAt: string;
  action: string;
  databaseAuthentication: string;
  stages: Stage[];
  nativeCompletion: string;
} = {
  environment: 'dev',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  observedAt: new Date().toISOString(),
  action: 'unparsed',
  databaseAuthentication: 'not_attempted',
  stages: [],
  nativeCompletion: 'in_progress',
};
const saveReceipt = () => atomicJson(join(out, 'dev-latest.json'), receipt);
async function stage<T>(name: string, run: () => Promise<T>, blocked?: (value: T) => boolean): Promise<T> {
  const entry: Stage = { name, status: 'running' };
  receipt.stages.push(entry);
  await saveReceipt();
  try {
    const value = await run();
    entry.status = blocked?.(value) ? 'blocked' : 'completed';
    if (entry.status === 'blocked') entry.code = 'M02_REQUIRED_CONFIGURATION_PENDING';
    entry.result = value;
    await saveReceipt();
    return value;
  } catch (error) {
    entry.status = 'blocked';
    entry.code = error instanceof SeedRuntimeError ? error.code : `M02_${name.toUpperCase()}_FAILED`;
    await saveReceipt();
    throw error;
  }
}
async function snapshot(sql: Sql): Promise<ReportSnapshot> {
  // No auth rows, settings secrets or arbitrary error text are exported.
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
const logoManifestSchema = z.object({
  version: z.literal(1),
  target: z.string(),
  logos: z.record(
    z.string().uuid(),
    z.object({
      storagePath: z.string(),
      sourceUrl: z.string().nullable(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});

async function main() {
  await mkdir(out, { recursive: true });
  const command = parseCommand(process.argv.slice(2));
  receipt.action = command.action;
  const sources = await seedSourceFiles(root);
  const plan = planSeed(loadSeedInput(sources));
  if (command.action === 'plan') {
    await atomicJson(join(out, 'plan.json'), {
      environment: 'local-plan-only',
      sourceSha256: sources.sourceSha256,
      counts: plan.counts,
      issues: plan.issues,
    });
    process.stdout.write(
      JSON.stringify({ mode: 'local-plan-only', counts: plan.counts, issues: plan.issues.length }) + '\n',
    );
    return;
  }
  if (command.action !== 'report')
    assertDevBatchPacket(
      await readOptionalJson(join(root, 'scripts/seed/dev-batch-packet.json')),
      sources.sourceSha256,
      sha256(await readFile(join(root, 'assets/brand/everyone-logotype.svg'))),
      {
        competitors: plan.competitors.length,
        accounts: plan.accounts.length,
        vimeoAccounts: plan.counts.platforms.vimeo ?? 0,
        youtubeAccounts: plan.counts.platforms.youtube ?? 0,
        websiteAccounts:
          (plan.counts.platforms.website ?? 0) + (plan.counts.platforms.website_work_page ?? 0),
        remoteLogos: plan.competitors.filter((row) => row.logo_url).length,
      },
    );
  // Capture the prior manifest at entry. A missing recovery record must never
  // reopen the already spent initial budget or repeat successful stages.
  const initialAdmissionPath = join(out, 'dev-initial-provider-admission.json');
  const continuationAdmissionPath = join(out, 'dev-youtube-continuation-admission.json');
  const budgetContext = {
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    target: 'supabase:zmotjsbzhzjvpelxvxlf:postgres',
    sourceSha256: sources.sourceSha256,
    seedManifestPresent: (await readOptionalJson(join(out, 'dev-seed-manifest.json'))) !== undefined,
    initialAdmission: await readOptionalJson(initialAdmissionPath),
    originalRunId: approvedOriginalRunId,
    ...(command.action === 'resolve'
      ? {
          recoveryProof: {
            readbackEvidenceSha256: sha256(
              await readFile(join(root, providerBudgetEvidencePaths.readbackEvidence)),
            ),
            originalReceiptArchiveSha256: sha256(
              await readFile(join(root, providerBudgetEvidencePaths.originalReceiptArchive)),
            ),
          },
        }
      : {}),
  };
  const budgetMode = assertProviderBudgetAction(command.action, budgetContext);
  const admissionOptions = {
    initialAdmissionPath,
    continuationAdmissionPath,
    runId: randomUUID(),
  };
  const ca = validateDevCa(
    await readFile(join(root, 'scripts/seed/certs/supabase-root-2021.crt')),
    await readOptionalJson(join(root, 'scripts/seed/certs/supabase-root-2021.json')),
  );
  const config = databaseConfig(command.target, process.env, ca);
  // Credentials are never retained in process.env or passed to another executable.
  const credentials = { vimeoToken: process.env.VIMEO_TOKEN, youtubeApiKey: process.env.YOUTUBE_API_KEY };
  let storageKey = process.env.SUPABASE_SECRET_KEY;
  const storageUrl = process.env.SUPABASE_URL;
  for (const name of [
    'PGPASSWORD',
    'SEED_DATABASE_URL',
    'VIMEO_TOKEN',
    'YOUTUBE_API_KEY',
    'SUPABASE_SECRET_KEY',
  ])
    delete process.env[name];
  const sql = postgres(config.options);
  let issues: SeedIssue[] = [...plan.issues];
  try {
    await stage('database_identity', async () => {
      receipt.databaseAuthentication = 'connection_attempted_identity_unverified';
      await saveReceipt();
      const identity = await (async () => {
        try {
          return (await sql`select current_user,session_user,current_database() as database`)[0];
        } catch (error) {
          const failure = databaseFailure(error);
          receipt.databaseAuthentication = failure.authentication;
          throw new SeedRuntimeError(failure.code);
        }
      })();
      if (
        identity?.current_user !== 'postgres' ||
        identity.session_user !== 'postgres' ||
        identity.database !== 'postgres'
      )
        throw new SeedRuntimeError('M02_DATABASE_IDENTITY_REJECTED');
      receipt.databaseAuthentication = 'postgres_authenticated_to_verified_dev_pooler';
      const rows = await sql`select version from supabase_migrations.schema_migrations order by version`;
      if (
        JSON.stringify(rows.map((row) => row.version)) !==
        JSON.stringify([
          '20261017172928',
          '20261017172931',
          '20261017172934',
          '20261017172937',
          '20261017172940',
          '20261017172943',
          '20261017172945',
        ])
      )
        throw new SeedRuntimeError('M02_MIGRATION_BASELINE_MISMATCH');
      return {
        current_user: 'postgres',
        session_user: 'postgres',
        database: 'postgres',
        originalMigrations: 7,
      };
    });
    const release = command.apply
      ? await acquireWriteGate(join(out, 'dev-write-pending.json'), {
          target: config.target,
          action: command.action,
          sourceSha256: sources.sourceSha256,
        })
      : undefined;
    if (budgetMode === 'initial_provider')
      await admitProviderBudgetAction(command.action, budgetContext, admissionOptions);
    const seed = async () => {
      const pending = join(out, 'dev-seed-pending.json');
      if (await readOptionalJson(pending)) throw new SeedRuntimeError('M02_SEED_RECONCILIATION_REQUIRED');
      const manifestPath = join(out, 'dev-seed-manifest.json');
      const old = await readOptionalJson(manifestPath);
      const manifest = old === undefined ? undefined : seedManifestSchema.parse(old);
      await atomicJson(pending, {
        target: config.target,
        sourceSha256: sources.sourceSha256,
        startedAt: new Date().toISOString(),
        outcome: 'unreconciled',
      });
      const first = await seedCompetitors(sql, plan, { target: config.target, manifest });
      await atomicJson(manifestPath, first.manifest);
      const second = await seedCompetitors(sql, plan, { target: config.target, manifest: first.manifest });
      await atomicJson(manifestPath, second.manifest);
      if (Object.values(second.stats).some((value) => value !== 0))
        throw new SeedRuntimeError('M02_SECOND_SEED_NOT_NOOP');
      issues = second.issues;
      await unlink(pending);
      return {
        sourceSha256: sources.sourceSha256,
        first: first.stats,
        second: second.stats,
        issues: second.issues.length,
      };
    };
    if (['seed', 'accept-dev'].includes(command.action)) await stage('seed_and_idempotency', seed);
    const ownership = async () => {
      const value = await readOptionalJson(join(out, 'dev-seed-manifest.json'));
      if (value === undefined) throw new SeedRuntimeError('M02_SEED_OWNERSHIP_RECEIPT_REQUIRED');
      const manifest = seedManifestSchema.parse(value);
      if (manifest.target !== config.target) throw new SeedRuntimeError('M02_SEED_OWNERSHIP_TARGET_MISMATCH');
      return manifest;
    };
    const managedAccounts = async () => scopedAccounts(await readAccounts(sql), plan, await ownership());
    if (command.action === 'probe')
      await stage(
        'provider_probes',
        () => readAccounts(sql).then((rows) => probeProviders(rows, credentials, { signal })),
        (result) =>
          [result.vimeo, result.youtube].some((entry) => ['missing', 'blocked'].includes(entry.status)),
      );
    if (['resolve', 'accept-dev'].includes(command.action))
      await stage(
        'resolution',
        async () => {
          const rows = await managedAccounts();
          const continuation = command.action === 'resolve';
          if (continuation) {
            assertYouTubeContinuationScope(rows);
            await admitProviderBudgetAction(command.action, budgetContext, admissionOptions);
          }
          const badResponseShapes: YouTubeBadResponseShape[] = [];
          const maximumAttempts = continuation ? youtubeContinuationBudget.youtubeMaximumAttempts : 4;
          const resolvers = createProviderResolvers({
            signal,
            youtubeMaxAttempts: maximumAttempts,
            onYouTubeBadResponse: (shape) => {
              if (badResponseShapes.length < 4) badResponseShapes.push(shape);
            },
          });
          const result = await resolveAccounts(sql, rows, credentials, { signal, resolvers });
          return { ...result, youtubeMaximumAttempts: maximumAttempts, badResponseShapes };
        },
        (result) => result.blocked.length > 0,
      );
    if (['websites', 'accept-dev'].includes(command.action))
      await stage('website_and_format_checks', () =>
        managedAccounts().then((rows) => checkAccounts(sql, rows, { signal })),
      );
    if (['logos', 'accept-dev'].includes(command.action)) {
      await stage(
        'logos',
        async () => {
          if (!storageKey) return { status: 'missing' as const, code: 'M02_DEV_STORAGE_CREDENTIAL_MISSING' };
          if (storageUrl !== `https://${config.ref}.supabase.co`)
            throw new SeedRuntimeError('M02_DEV_STORAGE_TARGET_REJECTED');
          const client = createClient(storageUrl, storageKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: restrictedStorageFetch(storageUrl, signal) },
          });
          storageKey = undefined;
          const path = join(out, 'dev-logo-manifest.json');
          const old = await readOptionalJson(path);
          const manifest =
            old === undefined
              ? { version: 1 as const, target: config.target, logos: {} as Record<string, LogoOwnership> }
              : logoManifestSchema.parse(old);
          if (manifest.target !== config.target)
            throw new SeedRuntimeError('M02_LOGO_MANIFEST_TARGET_MISMATCH');
          const hooks = storageHooks(client, storageUrl, { signal });
          const adapter = createLogoDatabaseAdapter(sql, hooks);
          const counts = { copied: 0, recovered: 0, unchanged: 0, skipped: 0, failed: 0, uploadedBytes: 0 };
          const failures: Array<{ company_code: string; code: string }> = [];
          for (const input of scopedLogos(await readLogoInputs(sql), plan, await ownership())) {
            if (signal.aborted) throw new SeedRuntimeError('M02_BATCH_TIMEOUT');
            let result;
            try {
              result = await copyLogo(
                {
                  ...input,
                  ...(input.company_code === 'C000' && !input.sourceUrl
                    ? { baselineBytes: await readFile(join(root, 'assets/brand/everyone-logotype.svg')) }
                    : {}),
                },
                adapter,
                manifest.logos[input.competitorId],
              );
            } catch (error) {
              // An adapter exception may follow a successful write. Keep the durable gate and reconcile.
              if (!(error instanceof LogoError) || error.code === 'adapter_failed')
                throw new SeedRuntimeError('M02_LOGO_RECONCILIATION_REQUIRED');
              counts.failed++;
              failures.push({ company_code: input.company_code, code: error.code });
              continue;
            }
            counts[result.status]++;
            if (result.ownership) {
              manifest.logos[input.competitorId] = result.ownership;
              await atomicJson(path, manifest);
            }
            if (result.reason && result.reason !== 'missing_source')
              failures.push({ company_code: input.company_code, code: result.reason });
          }
          counts.uploadedBytes = hooks.uploadedBytes();
          return {
            counts,
            failures,
            publicByteHashVerified: counts.copied + counts.recovered + counts.unchanged,
          };
        },
        (result) => 'status' in result && result.status === 'missing',
      );
    }
    await stage('report', async () => {
      const report = buildReport(await snapshot(sql), { environment: 'dev', target: config.ref, issues });
      const stamp = new Date().toISOString().replaceAll(':', '-');
      await writeFile(join(out, `report-${stamp}.md`), report.summaryMarkdown, { mode: 0o600 });
      await writeFile(join(out, 'unresolved.csv'), report.unresolvedCsv, { mode: 0o600 });
      await atomicJson(join(out, 'dev-report.json'), {
        observedAt: new Date().toISOString(),
        environment: 'dev',
        projectRef: config.ref,
        counts: report.counts,
        reviewItems: report.reviewItems,
      });
      return report.counts;
    });
    return release;
  } catch (error) {
    if ((error as { code?: string }).code === '28P01')
      receipt.databaseAuthentication = 'authentication_rejected';
    throw error;
  } finally {
    // Do not manually reserve a connection or start end() before a transaction has completed.
    await sql.end({ timeout: 5 });
  }
}

try {
  const release = await main();
  receipt.nativeCompletion = receipt.stages.some((stage) => stage.status === 'blocked')
    ? 'completed_with_blockers'
    : 'success';
  if (receipt.action !== 'plan' && receipt.action !== 'unparsed')
    await completeWriteBatch(async () => {
      await saveReceipt();
      await atomicJson(join(out, `receipt-${new Date().toISOString().replaceAll(':', '-')}.json`), receipt);
    }, release);
} catch (error) {
  receipt.nativeCompletion = 'failed';
  const code = error instanceof SeedRuntimeError ? error.code : 'M02_OPERATION_FAILED_RAW_ERROR_WITHHELD';
  console.error(code);
  process.exitCode = 1;
  if (receipt.action !== 'plan' && receipt.action !== 'unparsed') {
    try {
      await saveReceipt();
      await atomicJson(join(out, `receipt-${new Date().toISOString().replaceAll(':', '-')}.json`), receipt);
    } catch {
      console.error('M02_RECEIPT_WRITE_FAILED');
      process.exitCode = 1;
    }
  }
}
