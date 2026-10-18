import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build before loading any private credential. The resulting owner runner is plain Node JS.
const directory = dirname(fileURLToPath(import.meta.url));
const root = join(directory, '../..');
const out = join(directory, 'out');
const credentialName =
  /^(?:PG.*|SUPABASE_.*|.*DATABASE_URL|N8N_WRITER_URL|API_AGENT_URL|VIMEO_TOKEN|YOUTUBE_API_KEY)$/;
if (Object.keys(process.env).some((name) => credentialName.test(name) && process.env[name])) {
  console.error('M02_BUILD_REQUIRES_CREDENTIAL_FREE_PROCESS');
  process.exit(1);
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
await build({
  entryPoints: [join(directory, 'cli.ts')],
  outfile: join(out, 'runner.mjs'),
  platform: 'node',
  format: 'esm',
  target: 'node24',
  bundle: true,
  external: ['postgres', 'sharp', 'csv-parse/sync', 'zod', '@supabase/supabase-js'],
  define: { EMR_REPO_ROOT: JSON.stringify(root) },
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
    ) {
      files[relative(root, absolute).replaceAll('\\', '/')] = digest(await readFile(absolute));
    }
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
])
  files[path] = digest(await readFile(join(root, path)));
await writeFile(
  join(out, 'runner-seal.json'),
  JSON.stringify(
    { version: 1, runnerSha256: digest(await readFile(join(out, 'runner.mjs'))), files },
    null,
    2,
  ) + '\n',
  { mode: 0o600 },
);
process.stdout.write('M02 plain-Node runner built and source-sealed. No credentials loaded.\n');
