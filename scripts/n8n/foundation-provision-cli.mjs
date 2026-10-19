import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  lstatSync,
  existsSync,
} from 'node:fs';
import { dirname, resolve, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foundationScope, parseLedger, runShellProvision } from './foundation-provision.mjs';
import { foundationManagementTransport } from './foundation-management-transport.mjs';
import { parseFoundationPacket, createBindingJournal, machineBody } from './foundation-bind.mjs';
import { runAllProvision } from './foundation-all.mjs';
import { foundationTagNames } from '../../packages/shared/src/n8n-bindings.ts';
import { createOwnedStagingExportWriter, writeCompleteSync } from './foundation-export.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(repo, 'scripts/n8n/out/foundation'),
  journalPath = join(out, 'owned-shells.jsonl');
const fail = () => {
  throw Error('FOUNDATION_CHILD_BLOCKED');
};
function noLinks(path) {
  const absolute = resolve(path),
    root = parse(absolute).root;
  let cursor = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail();
  }
  return absolute;
}
function readJournal() {
  noLinks(journalPath);
  if (!existsSync(journalPath)) return [];
  if (lstatSync(journalPath).size > 65536) fail();
  const text = readFileSync(journalPath, 'utf8');
  if (!text.endsWith('\n')) fail();
  const rows = text
    .trimEnd()
    .split('\n')
    .map((x) => JSON.parse(x));
  const head = rows.shift();
  if (
    !head ||
    Object.keys(head).sort().join(',') !== 'version,windowId' ||
    head.version !== 1 ||
    head.windowId !== foundationScope.windowId
  )
    fail();
  parseLedger(rows);
  return rows;
}
function journal() {
  const rows = readJournal();
  noLinks(out);
  mkdirSync(out, { recursive: true });
  noLinks(out);
  if (!existsSync(journalPath)) {
    const fd = openSync(journalPath, 'wx');
    try {
      writeCompleteSync(fd, JSON.stringify({ version: 1, windowId: foundationScope.windowId }) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  return {
    rows,
    append(row) {
      parseLedger([...rows, row]);
      noLinks(journalPath);
      const fd = openSync(journalPath, 'a');
      try {
        writeCompleteSync(fd, JSON.stringify(row) + '\n');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      rows.push(structuredClone(row));
    },
  };
}
function packet() {
  const target = noLinks(join(repo, 'scripts/n8n/foundation-delivery-packet.json'));
  if (!existsSync(target)) return null;
  if (lstatSync(target).size > 4096) fail();
  return parseFoundationPacket(JSON.parse(readFileSync(target, 'utf8')));
}
function bindingJournal() {
  const path = noLinks(join(out, 'binding-intents.jsonl'));
  let rows = [];
  if (existsSync(path)) {
    if (lstatSync(path).size > 131072) fail();
    const text = readFileSync(path, 'utf8');
    if (!text.endsWith('\n')) fail();
    rows = text
      .trimEnd()
      .split('\n')
      .map((x) => JSON.parse(x));
    const head = rows.shift();
    if (
      !head ||
      Object.keys(head).sort().join(',') !== 'kind,version,windowId' ||
      head.version !== 1 ||
      head.windowId !== foundationScope.windowId ||
      head.kind !== 'inactive_binding_intents'
    )
      fail();
  }
  if (!existsSync(path)) {
    const fd = openSync(path, 'wx');
    try {
      writeCompleteSync(
        fd,
        JSON.stringify({ version: 1, windowId: foundationScope.windowId, kind: 'inactive_binding_intents' }) +
          '\n',
      );
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  return createBindingJournal(rows, (row) => {
    noLinks(path);
    const fd = openSync(path, 'a');
    try {
      writeCompleteSync(fd, JSON.stringify(row) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  });
}
async function input(requireMachine = false) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const b of process.stdin) {
      bytes += b.length;
      if (bytes > 8192) {
        b.fill(0);
        fail();
      }
      chunks.push(b);
    }
    const p = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !p ||
      Object.keys(p).sort().join(',') !==
        (requireMachine ? 'expiresAt,key,machine,purpose,windowId' : 'expiresAt,key,purpose,windowId') ||
      p.purpose !== 'm03_owned_inactive_provision' ||
      p.windowId !== foundationScope.windowId
    )
      fail();
    const expiry = Date.parse(p.expiresAt),
      now = Date.now();
    if (
      typeof p.expiresAt !== 'string' ||
      !Number.isFinite(expiry) ||
      expiry < now + 2460000 ||
      expiry > now + 7200000
    )
      fail();
    return { key: p.key, machine: p.machine, deadlineMs: expiry };
  } finally {
    for (const b of chunks) b.fill(0);
  }
}
const report = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let key = null,
  machine = null,
  privateReadAttempted = false;
try {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['CheckOnly', 'Shells', 'Reconcile', 'All'].includes(mode)) fail();
  readJournal();
  const publicPacket = packet();
  if (mode === 'All' && !publicPacket) fail();
  if (mode === 'CheckOnly')
    report({
      status: 'foundation_shell_check_only_ready',
      version: 1,
      windowId: foundationScope.windowId,
      privateRead: false,
      networkRequests: 0,
      maximumRequests: 53,
      maximumCreates: 25,
      finalBindingReady: publicPacket !== null,
      fullProvisionMaximumRequests: 185,
      fullProvisionSourcePrepared: true,
    });
  else {
    const owned = journal();
    privateReadAttempted = true;
    const privateInput = await input(mode === 'All');
    key = privateInput.key;
    machine = privateInput.machine;
    privateInput.key = null;
    privateInput.machine = null;
    const context =
      mode === 'All'
        ? {
            machineBody: machineBody(publicPacket, machine),
            knownTagIds: new Set(),
            workflowBodies: new Map(),
            workflowTagBodies: new Map(),
          }
        : null;
    const send = foundationManagementTransport({
      ownsWorkflow: (id) => [...parseLedger(owned.rows).values()].some((s) => s.id === id),
      binding: context,
      deadlineMs: privateInput.deadlineMs,
    });
    const result =
      mode === 'All'
        ? await runAllProvision(
            { management: key, machine },
            publicPacket,
            JSON.parse(readFileSync(noLinks(join(repo, 'n8n/foundation/bindings.dev.json')), 'utf8')),
            {
              shellJournal: owned,
              bindingJournal: bindingJournal(),
              send,
              context,
              tagNames: foundationTagNames,
              onVerified: createOwnedStagingExportWriter(repo, [key, machine]),
            },
          )
        : await runShellProvision(key, owned, send, { reconcileOnly: mode === 'Reconcile' });
    if (JSON.stringify(result).includes(key) || (machine && JSON.stringify(result).includes(machine))) fail();
    key = null;
    machine = null;
    noLinks(out);
    writeFileSync(
      join(out, mode === 'All' ? 'inactive-foundation-receipt.json' : 'shell-provision-receipt.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    if (result.status === 'shells_verified') {
      const directory = noLinks(join(repo, 'n8n/workflows/foundation-shells'));
      mkdirSync(directory, { recursive: true });
      noLinks(directory);
      for (const shell of result.shells) {
        const target = noLinks(join(directory, shell.key + '.json'));
        writeFileSync(
          target,
          JSON.stringify({ kind: 'actual_saved_inactive_shell', ...shell }, null, 2) + '\n',
        );
      }
    }
    if (result.status === 'inactive_foundation_staged') {
      writeFileSync(
        noLinks(join(repo, 'n8n/foundation/bindings.dev.json')),
        JSON.stringify(result.bindings, null, 2) + '\n',
      );
      writeFileSync(
        noLinks(join(repo, 'n8n/foundation/transport.dev.json')),
        JSON.stringify(
          {
            kind: 'actual_saved_inactive_staging_transport_binding',
            ...result.transport,
            activationAuthorized: false,
          },
          null,
          2,
        ) + '\n',
      );
    }
    report({
      version: 1,
      windowId: foundationScope.windowId,
      host: foundationScope.host,
      projectId: foundationScope.projectId,
      status: result.status,
      phase: result.phase ?? 'shells',
      requestCount: result.requestCount,
      verifiedWorkflows: (result.workflows ?? result.shells).length,
      executionCount: 0,
      credentialsCreated: result.credentialsCreated,
      gatewayWindowStarted: false,
      finalGraphsBound: result.finalGraphsBound,
      inactiveDefinitionsSaved: result.inactiveDefinitionsSaved ?? false,
      deferredErrorWorkflowCount: result.deferredErrorWorkflowCount ?? 0,
      errorRoutingAccepted: false,
      persistedExports: result.persistedExports ?? 0,
      networkCompletionVerified: result.networkCompletionVerified,
      diagnostics: result.diagnostics ?? null,
    });
    process.exitCode = ['shells_verified', 'reconciliation_complete', 'inactive_foundation_staged'].includes(
      result.status,
    )
      ? 0
      : 1;
  }
} catch {
  key = null;
  machine = null;
  report({ status: 'foundation_child_blocked', completionVerified: false, privateReadAttempted });
  process.exitCode = 1;
}
