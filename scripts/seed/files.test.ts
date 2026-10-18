import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireWriteGate, completeWriteBatch } from './files';

const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
describe('durable seed write admission and reconciliation', () => {
  it('retains admission after completed writes when completion persistence fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-m02-gate-'));
    directories.push(directory);
    const path = join(directory, 'pending.json');
    const release = await acquireWriteGate(path, { action: 'resolve', target: 'dev' });
    await expect(
      completeWriteBatch(async () => {
        throw new Error('test-only-write-failure');
      }, release),
    ).rejects.toThrow('test-only-write-failure');
    await expect(acquireWriteGate(path, { action: 'resolve', target: 'dev' })).rejects.toThrow(
      'M02_WRITE_RECONCILIATION_REQUIRED',
    );
  });
  it('admits exactly one concurrent writer and preserves the blocked receipt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-m02-gate-'));
    directories.push(directory);
    const path = join(directory, 'pending.json');
    const outcomes = await Promise.allSettled([
      acquireWriteGate(path, { action: 'seed', target: 'dev' }),
      acquireWriteGate(path, { action: 'seed', target: 'dev' }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const gate = outcomes.find((result) => result.status === 'fulfilled');
    expect(JSON.parse(await readFile(path, 'utf8')).outcome).toBe('unreconciled');
    if (gate?.status === 'fulfilled') await gate.value();
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('leaves an unreconciled operation in place rather than replaying it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-m02-gate-'));
    directories.push(directory);
    const path = join(directory, 'pending.json');
    await acquireWriteGate(path, { action: 'logos', target: 'dev' });
    const original = await readFile(path, 'utf8');
    await expect(acquireWriteGate(path, { action: 'logos', target: 'dev' })).rejects.toThrow(
      'M02_WRITE_RECONCILIATION_REQUIRED',
    );
    expect(await readFile(path, 'utf8')).toBe(original);
  });
  it('refuses to remove a marker which no longer belongs to this child', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-m02-gate-'));
    directories.push(directory);
    const path = join(directory, 'pending.json');
    const release = await acquireWriteGate(path, { action: 'websites', target: 'dev' });
    await writeFile(path, '{"runId":"different"}');
    await expect(release()).rejects.toThrow('M02_WRITE_GATE_OWNERSHIP_CHANGED');
    expect(await readFile(path, 'utf8')).toBe('{"runId":"different"}');
  });
});
