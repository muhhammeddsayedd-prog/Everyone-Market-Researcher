import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { atomicJson } from './files';
import { buildReport, type ReportSnapshot } from './report';
import type { SeedIssue } from './model';

const projectRef = 'zmotjsbzhzjvpelxvxlf';
const source = 'dev_scoped_supabase_mcp_readback';
const envelopeSchema = z.strictObject({
  environment: z.literal('dev'),
  projectRef: z.literal(projectRef),
  source: z.literal(source),
  observedAt: z.iso.datetime({ offset: true }),
  snapshot: z.unknown(),
  issues: z.array(z.unknown()).length(3),
});
export function validateMcpReportEnvelope(input: unknown) {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) throw new Error('M02_MCP_REPORT_ENVELOPE_REJECTED');
  return {
    ...parsed.data,
    snapshot: parsed.data.snapshot as ReportSnapshot,
    issues: parsed.data.issues as SeedIssue[],
  };
}

/** Local rendering only. The owner process supplies the curated dev MCP snapshot separately. */
async function main() {
  const credentialNames = [
    'PGPASSWORD',
    'PGPASSFILE',
    'DATABASE_URL',
    'SEED_DATABASE_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_DB_PASSWORD',
    'SUPABASE_ACCESS_TOKEN',
    'VIMEO_TOKEN',
    'YOUTUBE_API_KEY',
    'N8N_WRITER_URL',
    'API_AGENT_URL',
  ];
  if (credentialNames.some((name) => Object.hasOwn(process.env, name)))
    throw new Error('M02_MCP_REPORT_CREDENTIAL_ENV_PRESENT');
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const out = join(root, 'scripts/seed/out');
  const input = await readFile(join(out, 'dev-mcp-snapshot.json'), 'utf8');
  const envelope = validateMcpReportEnvelope(JSON.parse(input));
  const report = buildReport(envelope.snapshot, {
    environment: 'dev',
    target: projectRef,
    observedAt: envelope.observedAt,
    issues: envelope.issues,
  });
  const renderedAt = new Date().toISOString();
  const markdownName = `report-mcp-recovery-${renderedAt.replaceAll(':', '-')}.md`;
  await writeFile(join(out, markdownName), report.summaryMarkdown, { mode: 0o600 });
  await writeFile(join(out, 'unresolved.csv'), report.unresolvedCsv, { mode: 0o600 });
  await atomicJson(join(out, 'dev-report.json'), {
    observedAt: envelope.observedAt,
    renderedAt,
    environment: 'dev',
    projectRef,
    source,
    counts: report.counts,
    reviewItems: report.reviewItems,
  });
  await atomicJson(join(out, 'dev-report-recovery.json'), {
    environment: 'dev',
    projectRef,
    source,
    operation: 'local_report_recovery',
    snapshotObservedAt: envelope.observedAt,
    renderedAt,
    inputFile: 'scripts/seed/out/dev-mcp-snapshot.json',
    inputSha256: createHash('sha256').update(input).digest('hex'),
    nativeCompletion: 'success',
    databaseConnectionAttempted: false,
    providerCallsMade: false,
    storageOperationsTaken: false,
    seedReplayed: false,
    originalBatchReceiptModified: false,
    runnerSealModified: false,
    pendingMarkersModified: false,
    outputs: [
      `scripts/seed/out/${markdownName}`,
      'scripts/seed/out/unresolved.csv',
      'scripts/seed/out/dev-report.json',
    ],
    counts: report.counts,
  });
  process.stdout.write(
    JSON.stringify({
      operation: 'local_report_recovery',
      environment: 'dev',
      projectRef,
      nativeCompletion: 'success',
      competitors: report.counts.competitors,
      accounts: report.counts.accounts,
      reviewItems: report.counts.reviewItems,
    }) + '\n',
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => {
    console.error('M02_MCP_REPORT_RECOVERY_FAILED_RAW_ERROR_WITHHELD');
    process.exitCode = 1;
  });
}
