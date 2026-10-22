import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import {
  closeSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  classifyFoundationVercelAuthMetadata,
  readFoundationVercelAuthMetadata,
  runFoundationVercelAuthPreflight,
} from './foundation-vercel-auth-preflight.mjs';

const fixedNow = Date.parse('2026-10-22T15:00:00.500Z');
const coverageMs = 75 * 60 * 1000;
const syntheticToken = 'SYNTHETIC_AUTH_CANARY_DO_NOT_EMIT';

function expectedMetadata(status, flags = {}) {
  return {
    kind: 'm03_vercel_saved_auth_metadata',
    status,
    metadataValid: false,
    unexpired: false,
    covers75Minutes: false,
    effectiveBackendEstablished: false,
    networkRequests: 0,
    authenticationAttempted: false,
    refreshAttempted: false,
    configWritten: false,
    ...flags,
  };
}

function assertMetadata(result, status, flags) {
  assert.deepEqual(result, expectedMetadata(status, flags));
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes(syntheticToken), false);
  return result;
}

function classify(auth) {
  return classifyFoundationVercelAuthMetadata(auth, { now: () => fixedNow });
}

async function withSyntheticAuth(run) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-vercel-auth-metadata-test-'));
  const owner = randomUUID();
  const marker = join(directory, '.test-owner');
  writeFileSync(marker, owner, { flag: 'wx' });
  const authPath = join(directory, 'synthetic-auth.json');
  try {
    return await run({ directory, authPath });
  } finally {
    const resolvedDirectory = realpathSync(directory);
    const relativeDirectory = relative(realpathSync(tmpdir()), resolvedDirectory);
    assert.equal(isAbsolute(relativeDirectory), false);
    assert.equal(relativeDirectory.startsWith('..'), false);
    assert.equal(basename(resolvedDirectory).startsWith('emr-vercel-auth-metadata-test-'), true);
    assert.equal(dirname(resolvedDirectory), realpathSync(tmpdir()));
    assert.equal(readFileSync(marker, 'utf8'), owner);
    rmSync(resolvedDirectory, { recursive: true });
  }
}

function writeSyntheticAuth(authPath, content = {}) {
  writeFileSync(
    authPath,
    JSON.stringify({
      token: syntheticToken,
      expiresAt: (fixedNow + coverageMs + 1000) / 1000,
      ...content,
    }),
    { flag: 'wx' },
  );
}

async function readSynthetic(authPath, deps = {}) {
  assert.equal(isAbsolute(authPath), true);
  return await readFoundationVercelAuthMetadata({ now: () => fixedNow }, { ...deps, authPath });
}

test('saved access-token metadata exposes only the frozen redacted DTO', () => {
  assertMetadata(
    classify({ token: syntheticToken, expiresAt: (fixedNow + coverageMs + 1000) / 1000 }),
    'metadata_covers_75_minutes',
    { metadataValid: true, unexpired: true, covers75Minutes: true },
  );
});

test('expiry uses epoch seconds and requires the full 75 minutes after the observation', () => {
  for (const expiresAt of [(fixedNow + coverageMs) / 1000, Math.ceil((fixedNow + coverageMs) / 1000)]) {
    assertMetadata(classify({ token: syntheticToken, expiresAt }), 'metadata_covers_75_minutes', {
      metadataValid: true,
      unexpired: true,
      covers75Minutes: true,
    });
  }
  assertMetadata(
    classify({ token: syntheticToken, expiresAt: Math.floor((fixedNow + coverageMs) / 1000) }),
    'saved_auth_insufficient_coverage',
    { metadataValid: true, unexpired: true },
  );
  assertMetadata(
    classify({ token: syntheticToken, expiresAt: (fixedNow + 1000) / 1000 }),
    'saved_auth_insufficient_coverage',
    { metadataValid: true, unexpired: true },
  );
});

test('expired metadata and refresh-only data never trigger refresh or claim coverage', () => {
  assertMetadata(
    classify({ token: syntheticToken, refreshToken: syntheticToken, expiresAt: fixedNow / 1000 - 1 }),
    'saved_auth_expired',
    { metadataValid: true },
  );
  assertMetadata(classify({ refreshToken: syntheticToken }), 'saved_auth_missing');
  assertMetadata(classify({}), 'saved_auth_missing');
  assertMetadata(classify(undefined), 'saved_auth_missing');
  assertMetadata(classify({ token: '' }), 'saved_auth_missing');
});

test('optional missing expiry remains explicitly unknown despite the CLI legacy-valid rule', () => {
  assertMetadata(classify({ token: syntheticToken }), 'saved_auth_expiry_unavailable', {
    metadataValid: true,
  });
});

test('malformed recognized metadata is refused without serializing the input', () => {
  for (const auth of [
    null,
    [],
    syntheticToken,
    { token: 42 },
    { token: true },
    { token: syntheticToken, expiresAt: null },
    { token: syntheticToken, expiresAt: String(fixedNow / 1000 + 5000) },
    { token: syntheticToken, expiresAt: Number.NaN },
    { token: syntheticToken, expiresAt: Number.POSITIVE_INFINITY },
  ]) {
    assertMetadata(classify(auth), 'saved_auth_invalid');
  }
});

test('unrelated persisted fields never establish backend selection or remote authentication', () => {
  assertMetadata(
    classify({
      token: syntheticToken,
      expiresAt: (fixedNow + coverageMs + 1000) / 1000,
      userId: 'synthetic-user',
      refreshToken: syntheticToken,
      unrelated: { value: syntheticToken },
    }),
    'metadata_covers_75_minutes',
    { metadataValid: true, unexpired: true, covers75Minutes: true },
  );
});

test('the synthetic reader returns only metadata and leaves all owned files unchanged', async () => {
  await withSyntheticAuth(async ({ directory, authPath }) => {
    writeSyntheticAuth(authPath, { refreshToken: syntheticToken });
    const originalBytes = readFileSync(authPath);
    const originalLeaves = readdirSync(directory).sort();
    assertMetadata(await readSynthetic(authPath), 'metadata_covers_75_minutes', {
      metadataValid: true,
      unexpired: true,
      covers75Minutes: true,
    });
    assert.deepEqual(readFileSync(authPath), originalBytes);
    assert.deepEqual(readdirSync(directory).sort(), originalLeaves);
  });
});

test('a missing synthetic leaf returns a fixed missing result without keyring fallback', async () => {
  await withSyntheticAuth(async ({ directory, authPath }) => {
    assertMetadata(await readSynthetic(authPath), 'saved_auth_missing');
    assert.deepEqual(readdirSync(directory), ['.test-owner']);
  });
});

test('the synthetic reader accepts the installed CLI leading-BOM JSON convention', async () => {
  await withSyntheticAuth(async ({ authPath }) => {
    writeFileSync(
      authPath,
      '\uFEFF' +
        JSON.stringify({
          token: syntheticToken,
          expiresAt: (fixedNow + coverageMs + 1000) / 1000,
        }),
      { flag: 'wx' },
    );
    assertMetadata(await readSynthetic(authPath), 'metadata_covers_75_minutes', {
      metadataValid: true,
      unexpired: true,
      covers75Minutes: true,
    });
  });
});

test('malformed JSON and invalid UTF-8 produce fixed invalid metadata without source excerpts', async () => {
  for (const content of [
    Buffer.from('{"token":"' + syntheticToken + '"'),
    Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d]),
  ]) {
    await withSyntheticAuth(async ({ authPath }) => {
      writeFileSync(authPath, content, { flag: 'wx' });
      assertMetadata(await readSynthetic(authPath), 'saved_auth_invalid');
    });
  }
});

test('the reader refuses over-64-KiB synthetic leaves before parsing them', async () => {
  await withSyntheticAuth(async ({ authPath }) => {
    writeFileSync(authPath, Buffer.alloc(65537, 0x20), { flag: 'wx' });
    assertMetadata(await readSynthetic(authPath), 'path_blocked');
  });
});

test('directories and hard-linked synthetic credential leaves are refused', async () => {
  await withSyntheticAuth(async ({ directory, authPath }) => {
    const directoryLeaf = join(directory, 'directory-leaf');
    mkdirSync(directoryLeaf);
    assertMetadata(await readSynthetic(directoryLeaf), 'path_blocked');
    writeSyntheticAuth(authPath);
    const linkedPath = join(directory, 'synthetic-hard-link.json');
    linkSync(authPath, linkedPath);
    assertMetadata(await readSynthetic(authPath), 'path_blocked');
    assertMetadata(await readSynthetic(linkedPath), 'path_blocked');
  });
});

test('a synthetic directory symlink anywhere in the ancestry is refused', async () => {
  await withSyntheticAuth(async ({ directory }) => {
    const realDirectory = join(directory, 'real-fixture');
    const linkedDirectory = join(directory, 'linked-fixture');
    mkdirSync(realDirectory);
    writeSyntheticAuth(join(realDirectory, 'synthetic-auth.json'));
    symlinkSync(realDirectory, linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir');
    assertMetadata(await readSynthetic(join(linkedDirectory, 'synthetic-auth.json')), 'path_blocked');
  });
});

test('an opened synthetic leaf with changed identity is refused before reading', async () => {
  await withSyntheticAuth(async ({ authPath }) => {
    writeSyntheticAuth(authPath);
    let readCalls = 0;
    let closeCalls = 0;
    assertMetadata(
      await readSynthetic(authPath, {
        io: {
          lstatSync,
          openSync,
          fstatSync(descriptor) {
            const stat = fstatSync(descriptor);
            return { ...stat, ino: stat.ino + 1, isFile: () => true };
          },
          readSync(...args) {
            readCalls += 1;
            return readSync(...args);
          },
          closeSync(descriptor) {
            closeCalls += 1;
            return closeSync(descriptor);
          },
        },
      }),
      'path_blocked',
    );
    assert.equal(readCalls, 0);
    assert.equal(closeCalls, 1);
  });
});

test('read errors remain redacted and close the owned synthetic descriptor', async () => {
  await withSyntheticAuth(async ({ authPath }) => {
    writeSyntheticAuth(authPath);
    let closeCalls = 0;
    assertMetadata(
      await readSynthetic(authPath, {
        io: {
          readSync() {
            throw new Error(syntheticToken);
          },
          closeSync(descriptor) {
            closeCalls += 1;
            return closeSync(descriptor);
          },
        },
      }),
      'path_blocked',
    );
    assert.equal(closeCalls, 1);
  });
});

class SyntheticChild extends EventEmitter {
  killCalls = 0;
  kill() {
    this.killCalls += 1;
    queueMicrotask(() => this.emit('close', null, 'SIGTERM'));
    return true;
  }
  get stdout() {
    throw new Error(syntheticToken);
  }
  get stderr() {
    throw new Error(syntheticToken);
  }
}

function startSyntheticPreflight(onSpawn) {
  const child = new SyntheticChild();
  let invocation;
  const promise = runFoundationVercelAuthPreflight({
    fork(...args) {
      invocation = args;
      if (onSpawn) queueMicrotask(() => onSpawn(child));
      return child;
    },
    verifyPublicInputs: () => true,
    timeoutMs: 50,
  });
  return { child, promise, invocation };
}

function assertParentReceipt(result, status, flags = {}, childClosed = true) {
  assert.deepEqual(result, { ...expectedMetadata(status, flags), childClosed });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes(syntheticToken), false);
}

test('the mocked bounded child returns valid metadata only after actual close', async () => {
  const { child, promise, invocation } = startSyntheticPreflight();
  const flags = { metadataValid: true, unexpired: true, covers75Minutes: true };
  child.emit('message', expectedMetadata('metadata_covers_75_minutes', flags));
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  child.emit('close', 0, null);
  assertParentReceipt(await promise, 'metadata_covers_75_minutes', flags);
  assert.equal(child.killCalls, 0);
  assert.deepEqual(invocation[1], ['--metadata-child']);
  assert.deepEqual(invocation[2].execArgv, []);
  assert.deepEqual(invocation[2].stdio, ['ignore', 'ignore', 'ignore', 'ipc']);
  assert.equal(invocation[2].windowsHide, true);
  assert.deepEqual(
    Object.keys(invocation[2].env).filter(
      (name) => !['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA'].includes(name),
    ),
    [],
  );
  for (const denied of [
    'NODE_OPTIONS',
    'VERCEL_TOKEN',
    'VERCEL_TOKEN_STORAGE',
    'VERCEL_TEST_KEYRING_UNAVAILABLE',
    'XDG_DATA_HOME',
    'XDG_DATA_DIRS',
  ]) {
    assert.equal(Object.hasOwn(invocation[2].env, denied), false);
  }
});

test('extra, missing and incoherent IPC metadata are rejected without leaking canary values', async () => {
  const valid = expectedMetadata('metadata_covers_75_minutes', {
    metadataValid: true,
    unexpired: true,
    covers75Minutes: true,
  });
  const omitted = { ...valid };
  delete omitted.configWritten;
  for (const message of [
    { ...valid, unexpected: syntheticToken },
    omitted,
    { ...valid, metadataValid: false },
    { ...valid, unexpired: false },
    { ...valid, status: 'saved_auth_missing' },
    { ...valid, status: syntheticToken },
  ]) {
    const { child, promise } = startSyntheticPreflight((mockChild) => {
      mockChild.emit('message', message);
    });
    assertParentReceipt(await promise, 'child_failed');
    assert.equal(child.killCalls, 1);
  }
});

test('duplicate child messages cannot substitute a second metadata receipt', async () => {
  const { child, promise } = startSyntheticPreflight((mockChild) => {
    const message = expectedMetadata('saved_auth_missing');
    mockChild.emit('message', message);
    mockChild.emit('message', { ...message, unexpected: syntheticToken });
  });
  assertParentReceipt(await promise, 'child_failed');
  assert.equal(child.killCalls, 1);
});

test('native failure, child errors and closure without a receipt return fixed failure metadata', async () => {
  for (const scenario of ['native-failure', 'signal', 'error', 'no-receipt']) {
    const { promise } = startSyntheticPreflight((mockChild) => {
      if (scenario !== 'no-receipt') {
        mockChild.emit('message', expectedMetadata('saved_auth_missing'));
      }
      if (scenario === 'error') mockChild.emit('error', new Error(syntheticToken));
      else if (scenario === 'signal') mockChild.emit('close', null, 'SIGTERM');
      else mockChild.emit('close', scenario === 'native-failure' ? 2 : 0, null);
    });
    assertParentReceipt(await promise, 'child_failed');
  }
});

test('a silent mocked child times out and is killed before the fixed failure is returned', async () => {
  const { child, promise } = startSyntheticPreflight();
  assertParentReceipt(await promise, 'child_failed');
  assert.equal(child.killCalls, 1);
});

test('public-gate rejection and fork exceptions are fixed redacted results without a child read', async () => {
  let forkCalls = 0;
  for (const verifyPublicInputs of [
    () => false,
    () => {
      throw new Error(syntheticToken);
    },
  ]) {
    const result = await runFoundationVercelAuthPreflight({
      verifyPublicInputs,
      fork() {
        forkCalls += 1;
        throw new Error(syntheticToken);
      },
      timeoutMs: 50,
    });
    assertParentReceipt(result, 'public_inputs_blocked');
  }
  assert.equal(forkCalls, 0);
  assertParentReceipt(
    await runFoundationVercelAuthPreflight({
      verifyPublicInputs: () => true,
      fork() {
        throw new Error(syntheticToken);
      },
      timeoutMs: 50,
    }),
    'child_failed',
  );
});
