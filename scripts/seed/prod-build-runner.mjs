import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
const root = join(directory, '../..');
const out = join(directory, 'out');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function buildProdRunner(runtimeRoot = root, outputDirectory = out) {
  if (
    Object.keys(process.env).some(
      (name) =>
        /^(?:PG.*|SUPABASE_.*|.*DATABASE_URL|N8N_WRITER_URL|API_AGENT_URL|VIMEO_TOKEN|YOUTUBE_API_KEY)$/.test(
          name,
        ) && process.env[name],
    )
  )
    throw new Error('M02_PROD_BUILD_REQUIRES_CREDENTIAL_FREE_PROCESS');
  await mkdir(outputDirectory, { recursive: true });
  await build({
    entryPoints: [join(directory, 'prod-cli.ts')],
    outfile: join(outputDirectory, 'prod-runner.mjs'),
    platform: 'node',
    format: 'esm',
    target: 'node24',
    bundle: true,
    external: ['postgres', 'sharp', 'csv-parse/sync', 'zod', '@supabase/supabase-js'],
    define: { EMR_REPO_ROOT: JSON.stringify(runtimeRoot) },
    logLevel: 'silent',
  });
  const files = {};
  async function sealDirectory(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (['out', 'node_modules'].includes(entry.name)) continue;
      const absolute = join(path, entry.name);
      if (entry.isDirectory()) await sealDirectory(absolute);
      else if (
        !entry.name.includes('.test.') &&
        !entry.name.includes('.integration.') &&
        /\.(?:ts|mjs|ps1)$/.test(entry.name)
      )
        files[relative(root, absolute).replaceAll('\\', '/')] = digest(await readFile(absolute));
    }
  }
  await sealDirectory(directory);
  await sealDirectory(join(root, 'packages/shared/src'));
  for (const path of [
    'scripts/package.json',
    'pnpm-lock.yaml',
    'scripts/seed/dev-batch-packet.json',
    'data/competitors.csv',
    'data/competitor_accounts.csv',
    'reference/taxonomies.json',
    'scripts/seed/overrides.csv',
    'assets/brand/everyone-logotype.svg',
    'scripts/seed/certs/supabase-root-2021.crt',
    'scripts/seed/certs/supabase-root-2021.json',
    'scripts/seed/prod-ca.json',
    'scripts/seed/prod-seed-packet.json',
    'scripts/seed/prod-payload.json',
    'scripts/seed/prod-logo-manifest.json',
    'scripts/assert/m02_counts.sql',
  ])
    files[path] = digest(await readFile(join(runtimeRoot, path)));
  await writeFile(
    join(outputDirectory, 'prod-runner-seal.json'),
    JSON.stringify(
      { version: 1, runnerSha256: digest(await readFile(join(outputDirectory, 'prod-runner.mjs'))), files },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  return {
    runnerPath: join(outputDirectory, 'prod-runner.mjs'),
    sealPath: join(outputDirectory, 'prod-runner-seal.json'),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await buildProdRunner();
    process.stdout.write(
      'M02 production plain-Node runner built and source-sealed. No credentials loaded.\n',
    );
  } catch {
    console.error('M02_PROD_BUILD_FAILED_CREDENTIAL_FREE_PROCESS_REQUIRED');
    process.exitCode = 1;
  }
}
