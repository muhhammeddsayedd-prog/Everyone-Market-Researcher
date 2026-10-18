import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SeedRuntimeError } from './config';

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export async function readOptionalJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new SeedRuntimeError('M02_LOCAL_RECEIPT_INVALID');
  }
}
export async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temp, path);
}
/** Exclusive, durable admission. A failed/ambiguous batch deliberately never releases it. */
export async function acquireWriteGate(path: string, record: Record<string, string>) {
  const runId = randomUUID();
  try {
    await writeFile(
      path,
      JSON.stringify(
        { ...record, runId, outcome: 'unreconciled', startedAt: new Date().toISOString() },
        null,
        2,
      ) + '\n',
      { mode: 0o600, flag: 'wx' },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new SeedRuntimeError('M02_WRITE_RECONCILIATION_REQUIRED');
    throw new SeedRuntimeError('M02_WRITE_GATE_UNAVAILABLE');
  }
  return async () => {
    const current = (await readOptionalJson(path)) as { runId?: string } | undefined;
    if (current?.runId !== runId) throw new SeedRuntimeError('M02_WRITE_GATE_OWNERSHIP_CHANGED');
    await unlink(path);
  };
}
export async function completeWriteBatch(
  persistCompletion: () => Promise<void>,
  releaseGate?: () => Promise<void>,
) {
  await persistCompletion();
  await releaseGate?.();
}
export async function seedSourceFiles(root: string) {
  const paths = [
    'data/competitors.csv',
    'data/competitor_accounts.csv',
    'reference/taxonomies.json',
    'scripts/seed/overrides.csv',
  ];
  const values = await Promise.all(paths.map((path) => readFile(join(root, path), 'utf8')));
  return {
    competitorsCsv: values[0]!,
    accountsCsv: values[1]!,
    taxonomiesJson: values[2]!,
    overridesCsv: values[3]!,
    sourceSha256: sha256(JSON.stringify(values.map(sha256))),
  };
}
