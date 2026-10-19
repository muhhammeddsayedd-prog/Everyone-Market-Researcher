import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const onlyWindows = { skip: process.platform !== 'win32' };
const windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
const publicEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]],
    ),
  );

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'emr-pending-machine-test-'));
  const repo = join(root, 'repo'),
    local = join(root, 'local');
  const helper = join(repo, 'scripts/n8n/windows/Get-M03FoundationPendingMachine.ps1');
  mkdirSync(dirname(helper), { recursive: true });
  writeFileSync(helper, readFileSync(resolve('scripts/n8n/windows/Get-M03FoundationPendingMachine.ps1')));
  const directory = join(local, 'Everyone-Market-Radar-Private/foundation', windowId);
  const journal = join(repo, 'scripts/n8n/out/foundation/binding-intents.jsonl');
  mkdirSync(directory, { recursive: true });
  mkdirSync(dirname(journal), { recursive: true });
  const header = { version: 1, windowId, kind: 'inactive_binding_intents' };
  writeFileSync(journal, JSON.stringify(header) + '\n');
  const file = join(directory, 'machine.dpapi'),
    metadata = join(directory, 'pending-runtime.json');
  const transition = join(directory, 'pending-runtime.credential-id-transition.jsonl');
  const meta = {
    version: 1,
    windowId,
    purpose: 'pending_inactive_m03_runtime_delivery',
    audience: 'https://everyone-market-researcher-public-fixture.vercel.app',
    sourceCommitSha: 'a'.repeat(40),
    credentialId: 'EmrFoundationMachine19',
    createdAt: '2026-10-18T23:00:00.0000000+00:00',
  };
  const ps = (script) => {
    const wrapper = join(root, 'synthetic-wrapper.ps1');
    writeFileSync(wrapper, "$ErrorActionPreference='Stop'; " + script);
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
      encoding: 'utf8',
      env: { ...publicEnvironment(), LOCALAPPDATA: local },
      timeout: 20000,
      windowsHide: true,
    });
  };
  const create = ps(
    `$s=ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_MACHINE_ONLY' -AsPlainText -Force; try { [IO.File]::WriteAllText(${literal(file)},(ConvertFrom-SecureString $s),[Text.Encoding]::ASCII) } finally {$s.Dispose()}`,
  );
  assert.equal(create.status, 0);
  writeFileSync(metadata, JSON.stringify(meta));
  const consume = (journalPath = journal) =>
    ps(
      `. ${literal(helper)}; $s=$null; try {$s=Get-M03FoundationPendingMachine -Audience ${literal(meta.audience)} -SourceCommitSha ${literal(meta.sourceCommitSha)} -BindingJournalPath ${literal(journalPath)}; if($s -isnot [Security.SecureString]){throw 'blocked'}; Write-Output 'SYNTHETIC_PENDING_REUSED'; exit 0} catch {Write-Output 'FOUNDATION_MACHINE_PRIVATE_STORE_BLOCKED'; exit 1} finally {if($null -ne $s){$s.Dispose()}}`,
    );
  try {
    return run({ root, repo, directory, journal, header, file, metadata, transition, meta, consume });
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-pending-machine-test-'));
    rmSync(root, { recursive: true, force: true });
  }
}

test(
  'known older credential ID transitions once with identical encrypted token and append-only identity receipt',
  onlyWindows,
  () =>
    fixture(({ consume, file, metadata, transition, meta }) => {
      const cipherBefore = readFileSync(file);
      const first = consume();
      assert.equal(first.status, 0);
      assert.equal(first.stdout.trim(), 'SYNTHETIC_PENDING_REUSED');
      assert.equal(Buffer.compare(readFileSync(file), cipherBefore), 0);
      const after = JSON.parse(readFileSync(metadata, 'utf8'));
      assert.deepEqual(after, { ...meta, credentialId: 'EmrM03Machine19' });
      const receiptBefore = readFileSync(transition);
      const rows = receiptBefore.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].event, 'credential_id_transition_intent');
      assert.deepEqual(rows[0].oldMetadata, meta);
      assert.equal(rows[1].event, 'credential_id_transition_committed');
      assert.equal(rows[1].credentialId, 'EmrM03Machine19');
      assert.equal(receiptBefore.includes('PUBLIC_SYNTHETIC_MACHINE_ONLY'), false);
      const second = consume();
      assert.equal(second.status, 0);
      assert.equal(Buffer.compare(readFileSync(file), cipherBefore), 0);
      assert.equal(Buffer.compare(readFileSync(transition), receiptBefore), 0);
    }),
);

for (const [name, change] of [
  [
    'unknown credential ID',
    (f) => writeFileSync(f.metadata, JSON.stringify({ ...f.meta, credentialId: 'UnknownMachine' })),
  ],
  [
    'metadata with a foreign source binding',
    (f) => writeFileSync(f.metadata, JSON.stringify({ ...f.meta, sourceCommitSha: 'b'.repeat(40) })),
  ],
  [
    'metadata with extra fields',
    (f) => writeFileSync(f.metadata, JSON.stringify({ ...f.meta, extra: true })),
  ],
  ['partial private store', (f) => rmSync(f.metadata)],
  ['missing public journal', (f) => rmSync(f.journal)],
  [
    'a machine intent',
    (f) => writeFileSync(f.journal, JSON.stringify(f.header) + '\n{"event":"machine_intent"}\n'),
  ],
  [
    'a machine acknowledgement',
    (f) =>
      writeFileSync(
        f.journal,
        JSON.stringify(f.header) + '\n{"event":"machine_ack","credential":{"id":"EmrFoundationMachine19"}}\n',
      ),
  ],
  [
    'a malformed journal row',
    (f) =>
      writeFileSync(
        f.journal,
        JSON.stringify(f.header) + '\n{"event":"tag_intent","name":"env:dev","extra":true}\n',
      ),
  ],
  [
    'an incomplete transition receipt',
    (f) => writeFileSync(f.transition, '{"event":"credential_id_transition_intent"}\n'),
  ],
  [
    'a leftover metadata candidate',
    (f) => writeFileSync(join(f.directory, 'pending-runtime.credential-id-next.json'), '{}'),
  ],
  [
    'a leftover transition lock',
    (f) => writeFileSync(join(f.directory, 'pending-runtime.credential-id-transition.lock'), ''),
  ],
]) {
  test(`pending credential transition fails closed for ${name}`, onlyWindows, () =>
    fixture((f) => {
      change(f);
      const before = readFileSync(f.file),
        metaBefore = existsSync(f.metadata) ? readFileSync(f.metadata) : null;
      const result = f.consume();
      assert.equal(result.status, 1);
      assert.equal(result.stdout.trim(), 'FOUNDATION_MACHINE_PRIVATE_STORE_BLOCKED');
      assert.equal(result.stderr, '');
      assert.equal(Buffer.compare(readFileSync(f.file), before), 0);
      if (metaBefore) assert.equal(Buffer.compare(readFileSync(f.metadata), metaBefore), 0);
    }),
  );
}

test('current fixed ID reuses existing pending token without a synthetic transition', onlyWindows, () =>
  fixture(({ consume, file, metadata, transition, meta }) => {
    writeFileSync(metadata, JSON.stringify({ ...meta, credentialId: 'EmrM03Machine19' }));
    const before = readFileSync(file);
    assert.equal(consume().status, 0);
    assert.equal(Buffer.compare(readFileSync(file), before), 0);
    assert.equal(existsSync(transition), false);
  }),
);

test('new store uses the valid fixed ID and preserves generated ciphertext on reuse', onlyWindows, () =>
  fixture(({ consume, file, metadata, transition }) => {
    rmSync(file);
    rmSync(metadata);
    assert.equal(consume().status, 0);
    assert.equal(JSON.parse(readFileSync(metadata, 'utf8')).credentialId, 'EmrM03Machine19');
    const before = readFileSync(file);
    assert.equal(consume().status, 0);
    assert.equal(Buffer.compare(readFileSync(file), before), 0);
    assert.equal(existsSync(transition), false);
  }),
);

test('foreign no-machine journal cannot authorize the old identity transition', onlyWindows, () =>
  fixture(({ root, file, metadata, journal, consume }) => {
    const foreign = join(root, 'foreign-journal.jsonl');
    writeFileSync(foreign, readFileSync(journal));
    const cipherBefore = readFileSync(file),
      metaBefore = readFileSync(metadata);
    assert.equal(consume(foreign).status, 1);
    assert.equal(Buffer.compare(readFileSync(file), cipherBefore), 0);
    assert.equal(Buffer.compare(readFileSync(metadata), metaBefore), 0);
  }),
);

test('missing encrypted token with existing metadata never generates a replacement', onlyWindows, () =>
  fixture(({ file, metadata, consume }) => {
    const before = readFileSync(metadata);
    rmSync(file);
    assert.equal(consume().status, 1);
    assert.equal(existsSync(file), false);
    assert.equal(Buffer.compare(readFileSync(metadata), before), 0);
  }),
);

test('missing complete store after a machine intent never generates a new token', onlyWindows, () =>
  fixture(({ file, metadata, journal, header, consume }) => {
    rmSync(file);
    rmSync(metadata);
    writeFileSync(journal, JSON.stringify(header) + '\n{"event":"machine_intent"}\n');
    assert.equal(consume().status, 1);
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(metadata), false);
  }),
);

for (const [name, mutate] of [
  ['missing commit', (f, rows) => writeFileSync(f.transition, JSON.stringify(rows[0]) + '\n')],
  [
    'duplicate commit',
    (f, rows) => writeFileSync(f.transition, rows.concat(rows[1]).map(JSON.stringify).join('\n') + '\n'),
  ],
  ['old metadata regression', (f) => writeFileSync(f.metadata, JSON.stringify(f.meta))],
]) {
  test(`reused transition rejects ${name} without changing ciphertext`, onlyWindows, () =>
    fixture((f) => {
      assert.equal(f.consume().status, 0);
      const before = readFileSync(f.file);
      const rows = readFileSync(f.transition, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
      mutate(f, rows);
      assert.equal(f.consume().status, 1);
      assert.equal(Buffer.compare(readFileSync(f.file), before), 0);
    }),
  );
}

test('legacy tag-only journal with one unresolved intent permits the exact ID correction', onlyWindows, () =>
  fixture(({ journal, header, file, metadata, consume }) => {
    const rows = [header];
    for (const [index, name] of [
      'env:dev',
      'layer:collector',
      'layer:ai',
      'layer:ops',
      'layer:sub',
      'platform:vimeo',
      'platform:instagram',
    ].entries()) {
      rows.push(
        { event: 'tag_intent', name },
        { event: 'tag_ack', name, id: 'PUBLIC_TAG_' + index, created: true },
      );
    }
    rows.push({ event: 'tag_intent', name: 'platform:instagram_stories' });
    writeFileSync(journal, rows.map(JSON.stringify).join('\n') + '\n');
    const before = readFileSync(file);
    assert.equal(consume().status, 0);
    assert.equal(JSON.parse(readFileSync(metadata, 'utf8')).credentialId, 'EmrM03Machine19');
    assert.equal(Buffer.compare(readFileSync(file), before), 0);
  }),
);
