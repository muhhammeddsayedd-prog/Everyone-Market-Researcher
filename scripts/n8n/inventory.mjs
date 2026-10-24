import { lookup as osLookup } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync,
  openSync,
  fstatSync,
  lstatSync,
  writeSync,
  fsyncSync,
  closeSync,
  constants,
} from 'node:fs';
import { createHash } from 'node:crypto';

const host = 'muhhammedsayed.app.n8n.cloud';
const projectId = 'pHvQjDmjxVZ3KQLT';
const maxBytes = 4 * 1024 * 1024;
const runtimeReconciliationCheckpoint = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
  sha256: '226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983',
  management: 483,
  mainManagement: 472,
  control: 791,
  mainControl: 788,
  windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
  sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
});
const runtimeReconciliationPaths = Object.freeze({
  management: 'scripts/n8n/out/foundation/live/management.jsonl',
  control: 'scripts/n8n/out/foundation/live/control.jsonl',
  runtime: 'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl',
  provision:
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-13-owner-provision-attempt.json',
  claim: 'scripts/n8n/out/foundation/runtime-reconciliation-diagnostic-technical13-20261024.jsonl',
});
const publicDigest = (v) => createHash('sha256').update(v).digest('hex');
function readRuntimePublicFile(root, relative) {
  if (
    typeof relative !== 'string' ||
    /[:\x00]|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(relative) ||
    resolve(root, relative) !== join(root, relative)
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const path = join(root, relative);
  for (let cursor = path; ; cursor = dirname(cursor)) {
    if (lstatSync(cursor).isSymbolicLink()) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    if (dirname(cursor) === cursor) break;
  }
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152)
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}
export async function readRuntimeReconciliationContext(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  const root = resolve(repositoryRoot),
    cfg = runtimeReconciliationCheckpoint,
    text = readRuntimePublicFile(root, cfg.relative);
  if (publicDigest(text) !== cfg.sha256) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const receipt = JSON.parse(text),
    paths = runtimeReconciliationPaths,
    pinned = {};
  if (!record(receipt.pins) || Object.keys(receipt.pins).length !== 15)
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const [path, pin] of Object.entries(receipt.pins)) {
    if (
      !/^(?:scripts\/n8n\/out\/foundation\/live\/|scripts\/db\/out\/m03-foundation-project-verified-continuation-)/.test(
        path,
      ) ||
      typeof pin !== 'string' ||
      !/^[a-f0-9]{64}$/.test(pin)
    )
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    const value = readRuntimePublicFile(root, path),
      base = path === paths.management ? value.trimEnd().split('\n').slice(0, 473).join('\n') + '\n' : value;
    if (publicDigest(base) !== pin) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  for (const name of ['management', 'control', 'runtime', 'provision']) {
    const path = paths[name],
      value = readRuntimePublicFile(root, path),
      pin = receipt.pins?.[path];
    if (typeof pin !== 'string' || !/^[a-f0-9]{64}$/.test(pin)) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    if (name === 'management') {
      const lines = value.trimEnd().split('\n');
      if (
        lines.length < 473 ||
        lines.length > 476 ||
        publicDigest(lines.slice(0, 473).join('\n') + '\n') !== pin
      )
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      for (let i = 473; i < lines.length; i++)
        if (
          JSON.stringify(JSON.parse(lines[i])) !== JSON.stringify({ event: 'management_attempt', ordinal: i })
        )
          throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    } else if (publicDigest(value) !== pin) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    pinned[name] = value;
  }
  const m = pinned.management.trimEnd().split('\n').map(JSON.parse),
    c = pinned.control.trimEnd().split('\n').map(JSON.parse),
    rows = pinned.runtime.trimEnd().split('\n').map(JSON.parse),
    provision = JSON.parse(pinned.provision);
  if (
    m.slice(0, 473).filter((v) => v.event === 'management_attempt').length !== 472 ||
    c.filter((v) => v.event === 'control_request_intent').length !== 788 ||
    c.length !== 796 ||
    rows.length !== 38 ||
    receipt.usage.management !== 483 ||
    receipt.usage.control !== 791 ||
    receipt.usage.combined !== 1274 ||
    provision.windowId !== cfg.windowId ||
    provision.packet.commitSha !== cfg.sourceCommitSha ||
    provision.packet.audience !==
      'https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app' ||
    provision.packet.deploymentId !== 'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25'
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const { createFoundationRuntimePlan } = await import('./foundation-runtime-plan.mjs');
  const { createFoundationRuntimeJournal, foundationRuntimeState, runtimeGraphHash } =
    await import('./foundation-runtime-control.mjs');
  const bindings = JSON.parse(readRuntimePublicFile(root, 'n8n/foundation/bindings.dev.json')),
    transport = JSON.parse(readRuntimePublicFile(root, 'n8n/foundation/transport.dev.json'));
  const records = Object.keys(bindings.workflowRefs).map((k) =>
    JSON.parse(readRuntimePublicFile(root, 'n8n/workflows/' + k + '.json')),
  );
  const plan = createFoundationRuntimePlan({
    bindings,
    transport,
    records,
    activeWindowId: cfg.windowId,
    setup: {
      version: 1,
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
      sourceCommitSha: cfg.sourceCommitSha,
      deploymentId: provision.packet.deploymentId,
      audience: provision.packet.audience,
      environment: 'preview',
      readyState: 'READY',
      protection: 'all_except_custom_domains',
      protectionVerified: true,
      protectionTransportVerified: true,
      sqlAudienceBindingVerified: true,
    },
  });
  const journal = createFoundationRuntimeJournal(plan, rows.slice(1), () => {
      throw Error('RUNTIME_RECONCILIATION_READ_ONLY');
    }),
    state = foundationRuntimeState(plan, journal);
  if (
    state.requestCount !== 22 ||
    state.pending?.sequence !== 7 ||
    state.pending.action !== 'save' ||
    state.pending.key !== 'SUB-NOTIFY' ||
    state.restoreComplete ||
    state.setupComplete ||
    !state.machineRebound
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const expected = {};
  for (const key of ['SUB-NOTIFY', 'WF-90']) {
    const baseline = plan.baseline.find((b) => b.key === key),
      before = key === 'SUB-NOTIFY' ? state.pending.before : state.workflows[key];
    expected[key] = {
      id: baseline.id,
      tags: baseline.tags,
      baseline: {
        versionId: baseline.versionId,
        activeVersionId: null,
        graphHash: runtimeGraphHash(baseline.body),
        publishedHash: null,
      },
      before,
      target: key === 'SUB-NOTIFY' ? { ...state.pending.target, versionId: before.versionId } : before,
    };
  }
  return Object.freeze({
    root,
    receipt,
    plan,
    journal,
    state,
    expected,
    pinned,
    paths,
    managementAttempts: 483 + m.length - 473,
    controlAttempts: 791,
    combinedAttempts: 1274 + m.length - 473,
    receiptSha256: cfg.sha256,
  });
}
export async function openRuntimeReconciliationDiagnosticBudget(repositoryRoot) {
  const context = await readRuntimeReconciliationContext(repositoryRoot);
  if (context.managementAttempts !== 483 || 483 + 3 > 832 || 1274 + 3 > 2560)
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  let marker,
    management,
    closed = false,
    requests = 0;
  try {
    marker = openSync(
      join(context.root, context.paths.claim),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    const header =
      JSON.stringify({
        kind: 'm03_runtime_reconciliation_diagnostic',
        version: 1,
        technicalAttempt: 13,
        receiptSha256: context.receiptSha256,
        managementAttempts: 483,
        controlAttempts: 791,
        maximumRequests: 3,
        processId: process.pid,
        parentProcessId: process.ppid,
      }) + '\n';
    if (writeSync(marker, header, null, 'utf8') !== Buffer.byteLength(header)) throw Error();
    fsyncSync(marker);
    management = openSync(
      join(context.root, context.paths.management),
      constants.O_RDWR | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0),
    );
    if (readRuntimePublicFile(context.root, context.paths.management) !== context.pinned.management)
      throw Error();
  } catch {
    if (marker !== undefined) closeSync(marker);
    if (management !== undefined) closeSync(management);
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  return Object.freeze({
    context,
    admit() {
      if (closed || requests >= 3) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      const expected =
        context.pinned.management +
        Array.from(
          { length: requests },
          (_, i) => JSON.stringify({ event: 'management_attempt', ordinal: 473 + i }) + '\n',
        ).join('');
      const current = lstatSync(join(context.root, context.paths.management)),
        opened = fstatSync(management);
      if (
        current.isSymbolicLink() ||
        current.ino !== opened.ino ||
        current.dev !== opened.dev ||
        current.nlink !== 1 ||
        opened.nlink !== 1 ||
        readRuntimePublicFile(context.root, context.paths.management) !== expected
      )
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      const line = JSON.stringify({ event: 'management_attempt', ordinal: 473 + requests }) + '\n';
      requests++;
      if (writeSync(management, line, null, 'utf8') !== Buffer.byteLength(line))
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      fsyncSync(management);
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(management);
        closeSync(marker);
      }
    },
  });
}
const machineMetadataCheckpoint = Object.freeze({
  managementSha256: '96f1b856d23f4cd384014e715420b305dbf2f108c8ad2b446f9f8b036fc2b994',
  controlSha256: 'badae95523d4c57dd4370be827cfaf6c1da6c067913b703384a772646b5a18d1',
  mainManagement: 389,
  mainControl: 737,
  management: 400,
  control: 740,
});
export function openMachineMetadataDiagnosticBudget(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  const directory = join(repositoryRoot, 'scripts/n8n/out/foundation/live');
  let fd,
    used = false,
    closed = false;
  const read = (path, writable = false) => {
    for (let cursor = path; ; cursor = dirname(cursor)) {
      if (lstatSync(cursor).isSymbolicLink()) throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      if (dirname(cursor) === cursor) break;
    }
    const handle = openSync(
      path,
      (writable ? constants.O_RDWR | constants.O_APPEND : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0),
    );
    if (writable) fd = handle;
    try {
      const stat = fstatSync(handle);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152)
        throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      return readFileSync(handle, 'utf8');
    } finally {
      if (!writable) closeSync(handle);
    }
  };
  try {
    const management = read(join(directory, 'management.jsonl'), true),
      control = read(join(directory, 'control.jsonl'));
    const digest = (text) => createHash('sha256').update(text).digest('hex');
    if (
      digest(management) !== machineMetadataCheckpoint.managementSha256 ||
      digest(control) !== machineMetadataCheckpoint.controlSha256
    )
      throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
    const m = management.trimEnd().split('\n').map(JSON.parse),
      c = control.trimEnd().split('\n').map(JSON.parse);
    if (
      m.length !== 390 ||
      m.filter((r) => r.event === 'management_attempt').length !== machineMetadataCheckpoint.mainManagement ||
      c.length !== 744 ||
      c.filter((r) => r.event === 'control_request_intent').length !==
        machineMetadataCheckpoint.mainControl ||
      machineMetadataCheckpoint.management + 1 > 704 ||
      machineMetadataCheckpoint.management + machineMetadataCheckpoint.control + 1 > 2560
    )
      throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
  }
  return Object.freeze({
    admit() {
      if (closed || used) throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      used = true;
      const text = JSON.stringify({ event: 'management_attempt', ordinal: 390 }) + '\n';
      if (writeSync(fd, text, null, 'utf8') !== Buffer.byteLength(text))
        throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      fsyncSync(fd);
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
export const inventoryDiagnosticVersion = 1;
export const wf70DiscoveryReceiptSha256 = '258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66';
export function openWf70DiscoveryBudget(repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))) {
  const path = join(repositoryRoot, 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl');
  let cursor = path;
  while (true) {
    if (lstatSync(cursor).isSymbolicLink()) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const fd = openSync(path, constants.O_RDWR | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0));
  let requests = 0,
    closed = false;
  const append = (value) => {
    const text = JSON.stringify(value) + '\n';
    if (writeSync(fd, text, null, 'utf8') !== Buffer.byteLength(text))
      throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    fsyncSync(fd);
  };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const text = readFileSync(fd, 'utf8'),
      rows = text.trimEnd().split('\n');
    if (rows.length !== 1) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const header = JSON.parse(rows[0]);
    const keys = [
      'kind',
      'version',
      'receiptSha256',
      'managementAttempts',
      'controlAttempts',
      'combinedAttempts',
      'maximumRequests',
      'parentProcessId',
    ];
    if (
      !record(header) ||
      Object.keys(header).length !== keys.length ||
      keys.some((k) => !Object.hasOwn(header, k)) ||
      header.kind !== 'm03_wf70_discovery_budget' ||
      header.version !== 1 ||
      header.receiptSha256 !== wf70DiscoveryReceiptSha256 ||
      header.managementAttempts !== 152 ||
      header.controlAttempts !== 382 ||
      header.combinedAttempts !== 534 ||
      header.maximumRequests !== 4 ||
      header.parentProcessId !== process.ppid ||
      header.controlAttempts + 4 > 2048 ||
      header.combinedAttempts + 4 > 2560
    )
      throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    append({ event: 'diagnostic_child_claim', processId: process.pid });
  } catch {
    closeSync(fd);
    throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
  }
  return Object.freeze({
    admit(value) {
      if (
        closed ||
        value?.kind !== 'discovery' ||
        value.workflowId !== 'S6KDFsx5IjQRf6tm' ||
        Object.keys(value).length !== 2 ||
        requests >= 4
      )
        throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
      requests++;
      append({
        event: 'control_request_intent',
        ordinal: 382 + requests,
        diagnosticOrdinal: requests,
        kind: 'discovery',
        workflowKey: 'WF-70',
        at: new Date().toISOString(),
      });
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
function requestDiagnostic(resource, page) {
  return {
    resource,
    page,
    tcpConnected: null,
    tlsVerified: null,
    httpStatus: null,
    bodyRead: 'not_observed',
    jsonParsed: false,
    schemaValidated: false,
    socketClosed: false,
    failureStage: 'none',
    failureCode: 'none',
  };
}
function diagnosticFailure(diagnostic, stage, code) {
  if (diagnostic && diagnostic.failureStage === 'none') {
    diagnostic.failureStage = stage;
    diagnostic.failureCode = code;
  }
}
function safeTransportCode(error) {
  const codes = {
    ECONNREFUSED: 'connection_refused',
    ECONNRESET: 'connection_reset',
    ETIMEDOUT: 'timeout',
    ABORT_ERR: 'timeout',
    SELF_SIGNED_CERT_IN_CHAIN: 'tls_untrusted',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'tls_untrusted',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls_untrusted',
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls_untrusted',
    CERT_HAS_EXPIRED: 'tls_expired',
    ERR_TLS_CERT_ALTNAME_INVALID: 'tls_hostname',
  };
  return typeof error?.code === 'string' && Object.hasOwn(codes, error.code)
    ? codes[error.code]
    : 'network_failed';
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// Explicit owner-authorized IDs observed in the intended Personal project.
// Names/types must match readback; native credentials are never relabeled.
export const inventoryCredentialCandidates = Object.freeze(
  [
    {
      key: 'postgres',
      id: '3ZZtc9kMDcminv6w',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
    },
    { key: 'apify', id: 'EYmaOt0rd45ysq0J', name: 'Apify account', type: 'apifyApi' },
    { key: 'openai', id: 'e04LREfPBELWQQ9D', name: 'OpenAI account', type: 'openAiApi' },
    { key: 'vimeo', id: 'HeZBOZhFMeFYOC0N', name: 'Vimeo Token', type: 'httpHeaderAuth' },
    { key: 'youtube', id: 'ltvBSloVLGVeUjqV', name: 'YouTube Data API key', type: 'httpHeaderAuth' },
  ].map((value) => Object.freeze(value)),
);
const credentialTypes = {
  postgres: 'postgres',
  apify: 'apifyApi',
  openai: 'openAiApi',
  vimeo: 'httpHeaderAuth',
  youtube: 'httpHeaderAuth',
};
export const inventoryWorkflowNames = Object.freeze([
  'SUB · Start run [dev]',
  'SUB · Finish run [dev]',
  'SUB · Ingest items [dev]',
  'SUB · Log cost [dev]',
  'SUB · Notify [dev]',
  'WF-00 · Orchestrator [dev]',
  'WF-19 · Apify run callback [dev]',
  'WF-90 · Error handler [dev]',
  'WF-91 · Health & cost [dev]',
  'WF-99 · Foundation smoke test [dev]',
  'WF-10 · Vimeo collector [dev]',
  'WF-11 · Instagram posts/reels collector [dev]',
  'WF-12 · Instagram stories collector [dev]',
  'WF-13 · YouTube collector [dev]',
  'WF-18 · LinkedIn posts collector [dev]',
  'WF-18b · LinkedIn employees [dev]',
  'WF-21 · Websites collector [dev]',
  'WF-22 · News [dev]',
  'WF-23 · Awards and trade [dev]',
  'WF-30 · AI extractor [dev]',
  'WF-32 · Campaign linker [dev]',
  'WF-40 · Removal check [dev]',
  'WF-50 · Weekly briefs [dev]',
  'WF-70 · Publish / revalidate [dev]',
  'WF-80 · Alerts [dev]',
]);
const workflowNames = new Set(inventoryWorkflowNames);
const routes = {
  workflowList: ['GET', '/api/v1/workflows'],
  workflowRead: ['GET', '/api/v1/workflows/{workflowId}'],
  workflowCreate: ['POST', '/api/v1/workflows'],
  workflowUpdate: ['PUT', '/api/v1/workflows/{workflowId}'],
  workflowPublish: ['POST', '/api/v1/workflows/{workflowId}/publish'],
  workflowUnpublish: ['POST', '/api/v1/workflows/{workflowId}/unpublish'],
  credentialList: ['GET', '/api/v1/credentials'],
  credentialRead: ['GET', '/api/v1/credentials/{credentialId}'],
  credentialTest: ['POST', '/api/v1/credentials/{credentialId}/test'],
  projectList: ['GET', '/api/v1/projects'],
};
class InventoryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const reject = (code = 'response_rejected') => {
  throw new InventoryError(code);
};

// Same conservative public-address rules reviewed for the bounded M02 diagnostic.
function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [first = '', second = ''] = address.toLowerCase().split(':');
  const a = Number.parseInt(first, 16);
  const b = second ? Number.parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) &&
    !(a === 0x3fff && b <= 0x0fff)
  );
}
export function resolveInstance(signal, lookup = osLookup) {
  // The OS operation itself cannot be cancelled. The callback guard and the
  // existing overall deadline prevent late results from starting a request;
  // the bounded Windows consumer also owns the native process lifetime.
  return new Promise((done, fail) => {
    let settled = false;
    const finish = (error, addresses) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) fail(error);
      else done(addresses);
    };
    const abort = () => finish(new InventoryError('timeout'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    try {
      lookup(host, { all: true }, (error, addresses) => {
        if (error) {
          if (['ENODATA', 'ENOTFOUND'].includes(error.code)) finish(null, []);
          else finish(new InventoryError('network_failed'));
        } else finish(null, addresses);
      });
    } catch {
      finish(new InventoryError('network_failed'));
    }
  });
}
function validatedAddresses(addresses) {
  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.length > 100 ||
    addresses.some(
      (entry) => !record(entry) || entry.family !== isIP(entry.address) || !publicAddress(entry.address),
    )
  )
    reject('unsafe_dns');
  return addresses;
}
function nativeRequest(input, requestImpl = request) {
  const responseMaximum = input.maxBytes ?? maxBytes;
  if (!Number.isInteger(responseMaximum) || responseMaximum < 1 || responseMaximum > maxBytes)
    return Promise.reject(new InventoryError('body_too_large'));
  return new Promise((done, fail) => {
    const diagnostic = input.diagnostic;
    let settled = false;
    let abort;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        if (abort) input.signal.removeEventListener('abort', abort);
        done(value);
      }
    };
    const failed = (stage, code, bodyState) => {
      if (settled) return;
      settled = true;
      if (abort) input.signal.removeEventListener('abort', abort);
      if (diagnostic && bodyState) diagnostic.bodyRead = bodyState;
      diagnosticFailure(diagnostic, stage, code);
      fail(new InventoryError(code === 'body_too_large' ? 'body_too_large' : 'network_failed'));
    };
    const req = requestImpl(
      input.url,
      {
        method: 'GET',
        headers: input.headers,
        rejectUnauthorized: true,
        servername: host,
        agent: false,
        family: input.address.family,
        signal: input.signal,
        lookup: (_name, _options, callback) => callback(null, input.address.address, input.address.family),
      },
      (response) => {
        if (settled) {
          response.destroy();
          return;
        }
        const status = response.statusCode ?? 0;
        if (diagnostic) {
          diagnostic.httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
          diagnostic.bodyRead = 'reading';
        }
        if (status >= 300 && status < 400) {
          diagnosticFailure(diagnostic, 'status', 'redirect_refused');
          response.destroy();
          req.destroy();
          finish({ status, body: new Uint8Array() });
          return;
        }
        const declared =
          response.headers['content-length'] === undefined
            ? null
            : Number(response.headers['content-length']);
        if (
          declared !== null &&
          (!Number.isSafeInteger(declared) || declared < 0 || declared > responseMaximum)
        ) {
          failed(
            'body_read',
            declared > responseMaximum ? 'body_too_large' : 'body_failed',
            declared > responseMaximum ? 'too_large' : 'failed',
          );
          response.destroy();
          req.destroy();
          return;
        }
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > responseMaximum) {
            failed('body_read', 'body_too_large', 'too_large');
            response.destroy();
            req.destroy();
          } else chunks.push(chunk);
        });
        response.once('end', () => {
          if (response.complete === false || (declared !== null && size !== declared)) {
            failed('body_read', 'body_truncated', 'truncated');
            req.destroy();
            return;
          }
          if (!settled && diagnostic) diagnostic.bodyRead = 'complete';
          finish({ status, body: Buffer.concat(chunks) });
        });
        response.once('error', () => {
          failed('body_read', 'body_failed', 'failed');
          req.destroy();
        });
        response.once('aborted', () => {
          failed('body_read', 'body_aborted', 'aborted');
          req.destroy();
        });
      },
    );
    if (diagnostic || input.onTlsVerified || input.onSocketClosed) {
      req.once('socket', (socket) => {
        if (diagnostic) {
          diagnostic.tcpConnected = false;
          diagnostic.tlsVerified = false;
        }
        socket.once('connect', () => {
          if (!settled && diagnostic) diagnostic.tcpConnected = true;
        });
        socket.once('secureConnect', () => {
          const verified = socket.encrypted === true && socket.authorized === true;
          if (!settled && diagnostic) diagnostic.tlsVerified = verified;
          if (!settled) input.onTlsVerified?.(verified);
        });
        socket.once('close', () => {
          if (diagnostic) diagnostic.socketClosed = true;
          input.onSocketClosed?.();
        });
      });
    }
    req.once('error', (error) => {
      const code = safeTransportCode(error);
      const stage = code.startsWith('tls_')
        ? 'tls'
        : diagnostic?.httpStatus !== null && diagnostic?.httpStatus !== undefined
          ? 'body_read'
          : diagnostic?.tlsVerified
            ? 'status'
            : diagnostic?.tcpConnected
              ? 'tls'
              : 'connect';
      failed(stage, code, stage === 'body_read' ? (code === 'timeout' ? 'timed_out' : 'failed') : undefined);
      req.destroy();
    });
    abort = () => {
      const stage =
        diagnostic?.httpStatus !== null && diagnostic?.httpStatus !== undefined
          ? 'body_read'
          : diagnostic?.tlsVerified
            ? 'status'
            : diagnostic?.tcpConnected
              ? 'tls'
              : diagnostic?.tcpConnected === false
                ? 'connect'
                : 'unknown';
      failed(stage, 'timeout', stage === 'body_read' ? 'timed_out' : undefined);
      req.destroy();
    };
    input.signal.addEventListener('abort', abort, { once: true });
    if (input.signal.aborted) abort();
    else req.end();
  });
}

// Credential-free, fixed-route transport proof. This does not call runInventory
// or establish API authentication. Normal keyed-reader routes/counts are intact.
export async function probePublicInventoryTransport(dependencies = {}) {
  const controller = new AbortController();
  const result = { httpStatus: null, tlsVerified: false, socketClosed: false };
  const deadlineMs =
    Number.isInteger(dependencies.timeoutMs) && dependencies.timeoutMs > 0 && dependencies.timeoutMs <= 10_000
      ? dependencies.timeoutMs
      : 10_000;
  const closeMs =
    Number.isInteger(dependencies.closeTimeoutMs) &&
    dependencies.closeTimeoutMs > 0 &&
    dependencies.closeTimeoutMs <= 5000
      ? dependencies.closeTimeoutMs
      : 5000;
  let requestIssued = false;
  let resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    requestIssued = true;
    const response = await nativeRequest(
      {
        url: new URL(`https://${host}/api/v1/discover`),
        headers: {
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-public-transport-check/1',
        },
        address: addresses[0],
        signal: controller.signal,
        onTlsVerified: (verified) => {
          result.tlsVerified = verified;
        },
        onSocketClosed: () => {
          result.socketClosed = true;
          resolveClosed();
        },
      },
      dependencies.request ?? request,
    );
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599)
      result.httpStatus = response.status;
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch {
    /* Fixed booleans/null only; no body, headers or raw errors. */
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (requestIssued && !result.socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, closeMs);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
    }
  }
  return result;
}
function listPage(value) {
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 100 ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === 'string' && /^[A-Za-z0-9_+=/-]{1,2048}$/.test(value.nextCursor))
    )
  )
    reject();
  return value;
}
function inspectCapabilities(value, capabilities) {
  if (
    !record(value) ||
    !record(value.data) ||
    !record(value.data.resources) ||
    Object.keys(value.data.resources).length > 200
  )
    reject();
  const found = new Set();
  for (const resource of Object.values(value.data.resources)) {
    if (
      !record(resource) ||
      !Array.isArray(resource.endpoints) ||
      resource.endpoints.length > 1000 ||
      !Array.isArray(resource.operations)
    )
      reject();
    for (const endpoint of resource.endpoints) {
      if (
        !record(endpoint) ||
        !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(endpoint.method) ||
        typeof endpoint.path !== 'string' ||
        endpoint.path.length > 512 ||
        typeof endpoint.operationId !== 'string'
      )
        reject();
      found.add(`${endpoint.method} ${endpoint.path}`);
    }
  }
  for (const [name, [method, path]] of Object.entries(routes))
    capabilities[name] = found.has(`${method} ${path}`);
}
function projectBound(row, resource) {
  return (
    Array.isArray(row.shared) &&
    row.shared.some(
      (entry) =>
        record(entry) &&
        (resource === 'credentials' ? entry.id === projectId : entry.projectId === projectId),
    )
  );
}
function projectRows(resource, rows, seen, candidates) {
  const known = [];
  let unknownCount = 0;
  for (const row of rows) {
    if (!record(row) || !id(row.id) || typeof row.name !== 'string' || row.name.length > 512) reject();
    if (resource === 'projects') {
      if (!['personal', 'team'].includes(row.type)) reject();
      if (row.id === projectId) {
        if (row.type !== 'personal' || seen.has(row.id)) reject();
        seen.add(row.id);
        known.push({ id: projectId, type: 'personal' });
      } else unknownCount++;
    } else if (resource === 'credentials') {
      if (typeof row.type !== 'string' || row.type.length > 128) reject();
      const candidate = candidates.get(row.id);
      if (!candidate) {
        unknownCount++;
        continue;
      }
      if (
        row.name !== candidate.name ||
        row.type !== candidate.type ||
        !projectBound(row, resource) ||
        seen.has(row.id)
      )
        reject();
      seen.add(row.id);
      known.push({ name: row.name, id: row.id, type: row.type });
    } else {
      if (typeof row.active !== 'boolean' || typeof row.isArchived !== 'boolean') reject();
      if (!workflowNames.has(row.name)) {
        unknownCount++;
        continue;
      }
      if (!projectBound(row, resource) || seen.has(row.name)) reject();
      seen.add(row.name);
      known.push({ name: row.name, id: row.id, active: row.active, archived: row.isArchived });
    }
  }
  return { known, unknownCount };
}

/** Four fixed GET-only endpoint families; dependencies are local, non-network test adapters. */
export async function runInventory(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    status: 'complete',
    requestCount: 0,
    authenticationVerified: false,
    projectVerified: false,
    capabilities: Object.fromEntries(Object.keys(routes).map((name) => [name, false])),
    manualExecutionSupportedByReviewedPublicApi: false,
    diagnostics: { version: inventoryDiagnosticVersion, dns: 'not_attempted', requests: [] },
    resources: Object.fromEntries(
      ['projects', 'workflows', 'credentials'].map((name) => [
        name,
        { status: 'not_attempted', httpStatus: null, count: 0, unknownCount: 0, known: [] },
      ]),
    ),
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  // Tests may supply synthetic candidates alongside synthetic transport. The
  // sealed CLI entry point accepts no arguments and always uses the fixed list.
  const supplied = dependencies.credentialCandidates ?? inventoryCredentialCandidates;
  const candidates = new Map(),
    services = new Set();
  if (!Array.isArray(supplied) || supplied.length > 5) {
    result.status = 'invalid_options';
    return result;
  }
  for (const candidate of supplied) {
    if (
      !record(candidate) ||
      Object.keys(candidate).length !== 4 ||
      !['key', 'id', 'name', 'type'].every((k) => Object.hasOwn(candidate, k)) ||
      !Object.hasOwn(credentialTypes, candidate.key) ||
      candidate.type !== credentialTypes[candidate.key] ||
      !id(candidate.id) ||
      typeof candidate.name !== 'string' ||
      candidate.name.length < 1 ||
      candidate.name.length > 200 ||
      /[\x00-\x1f\x7f]/.test(candidate.name) ||
      candidates.has(candidate.id) ||
      services.has(candidate.key)
    ) {
      result.status = 'invalid_options';
      return result;
    }
    candidates.set(candidate.id, candidate);
    services.add(candidate.key);
  }
  const timeoutMs = dependencies.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const get = async (resource, cursor) => {
      const url = new URL(`https://${host}/api/v1/${resource}`);
      if (resource !== 'discover') url.searchParams.set('limit', '100');
      if (resource === 'workflows') {
        url.searchParams.set('projectId', projectId);
        url.searchParams.set('excludePinnedData', 'true');
      }
      if (cursor) url.searchParams.set('cursor', cursor);
      const diagnostic = requestDiagnostic(
        resource,
        1 + result.diagnostics.requests.filter((row) => row.resource === resource).length,
      );
      result.diagnostics.requests.push(diagnostic);
      result.requestCount++;
      const transport = dependencies.request
        ? (input) => nativeRequest(input, dependencies.request)
        : (dependencies.transport ?? nativeRequest);
      const response = await transport({
        url,
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-read-only-inventory/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes,
        rejectUnauthorized: true,
        servername: host,
        diagnostic,
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      diagnostic.httpStatus = response.status;
      if (response.status >= 300 && response.status < 400) {
        diagnosticFailure(diagnostic, 'status', 'redirect_refused');
        reject('redirect_refused');
      }
      if (response.status === 401) {
        diagnosticFailure(diagnostic, 'status', 'unauthorized');
        reject('unauthorized');
      }
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > maxBytes) {
        diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
        diagnostic.bodyRead = 'too_large';
        reject('body_too_large');
      }
      diagnostic.bodyRead = 'complete';
      if (response.status !== 200) {
        diagnosticFailure(diagnostic, 'status', 'http_failed');
        return { status: response.status, value: null, diagnostic };
      }
      let value;
      try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
        diagnostic.jsonParsed = true;
      } catch {
        diagnosticFailure(diagnostic, 'parse', 'invalid_json');
        reject();
      }
      // Fail closed if a response reflects this request's private key into an
      // ID, cursor, name or nested field. Do not redact, hash or report the value.
      const pending = [value];
      let visited = 0;
      while (pending.length) {
        if (++visited > 100_000) reject();
        const item = pending.pop();
        if (typeof item === 'string' && item.includes(key)) {
          diagnosticFailure(diagnostic, 'schema', 'confidentiality_rejected');
          reject('confidentiality_rejected');
        }
        if (Array.isArray(item)) pending.push(...item);
        else if (record(item)) pending.push(...Object.values(item));
      }
      result.authenticationVerified = true;
      return { status: response.status, value, diagnostic };
    };
    const discovered = await get('discover');
    if (discovered.status !== 200) reject('http_failed');
    inspectCapabilities(discovered.value, result.capabilities);
    discovered.diagnostic.schemaValidated = true;
    for (const resource of ['projects', 'workflows', 'credentials']) {
      const section = result.resources[resource];
      const seen = new Set();
      const cursors = new Set();
      let cursor;
      try {
        for (let page = 0; page < 2; page++) {
          const response = await get(resource, cursor);
          section.httpStatus = response.status;
          if (response.status !== 200) {
            section.status = response.status === 403 ? 'forbidden' : 'http_failed';
            break;
          }
          const value = listPage(response.value);
          const projected = projectRows(resource, value.data, seen, candidates);
          if (value.nextCursor !== null && cursors.has(value.nextCursor)) reject();
          response.diagnostic.schemaValidated = true;
          section.count += value.data.length;
          section.known.push(...projected.known);
          section.unknownCount += projected.unknownCount;
          if (value.nextCursor === null) {
            section.status = 'complete';
            break;
          }
          cursors.add(value.nextCursor);
          cursor = value.nextCursor;
          section.status = 'page_limit';
        }
      } catch (error) {
        const last = result.diagnostics.requests.at(-1);
        if (last?.failureStage === 'none')
          diagnosticFailure(
            last,
            last.jsonParsed ? 'schema' : 'unknown',
            last.jsonParsed ? 'invalid_schema' : 'network_failed',
          );
        if (
          [
            'redirect_refused',
            'unauthorized',
            'timeout',
            'network_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        )
          throw error;
        section.status = 'response_rejected';
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
      }
    }
    result.projectVerified =
      result.resources.projects.status === 'complete' && result.resources.projects.known.length === 1;
    result.status = Object.values(result.resources).every((section) => section.status === 'complete')
      ? 'complete'
      : 'partial';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none') {
      const stage =
        last.httpStatus !== null && last.bodyRead !== 'complete'
          ? 'body_read'
          : last.jsonParsed
            ? 'schema'
            : last.tlsVerified
              ? 'status'
              : last.tcpConnected
                ? 'tls'
                : last.tcpConnected === false
                  ? 'connect'
                  : 'unknown';
      diagnosticFailure(
        last,
        stage,
        timedOut ? 'timeout' : stage === 'schema' ? 'invalid_schema' : 'network_failed',
      );
      if (timedOut && last.bodyRead === 'reading') last.bodyRead = 'timed_out';
    }
    result.status = timedOut
      ? 'timeout'
      : [
            'unsafe_dns',
            'timeout',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    if (result.status === 'confidentiality_rejected') {
      result.projectVerified = false;
      for (const section of Object.values(result.resources)) {
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
        section.status = 'response_rejected';
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
  }
  return result;
}

export async function projectRuntimeReconciliationWorkflow(dto, expected) {
  const { foundationRuntimeGraphHash, foundationRuntimePublishedHash } =
    await import('./foundation-runtime-checkpoint.mjs');
  const shape = record(dto),
    sortedTags = (v) =>
      Array.isArray(v)
        ? v.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => String(a.id).localeCompare(String(b.id)))
        : null;
  let observedHash = null;
  try {
    if (shape) observedHash = foundationRuntimeGraphHash(dto);
  } catch {
    /* Only fixed comparisons leave this reader. */
  }
  const publicationMatches = (state) => {
    if (
      !shape ||
      dto.active !== (state.activeVersionId !== null) ||
      dto.activeVersionId !== state.activeVersionId
    )
      return false;
    if (state.activeVersionId === null) return true;
    try {
      return (
        record(dto.activeVersion) &&
        dto.activeVersion.workflowId === expected.id &&
        dto.activeVersion.versionId === state.activeVersionId &&
        foundationRuntimePublishedHash(dto.activeVersion) === state.publishedHash
      );
    } catch {
      return false;
    }
  };
  return {
    objectShape: shape,
    idMatches: shape && dto.id === expected.id,
    archiveStateMatches: shape && dto.isArchived === false,
    ownerProjectMatches:
      shape &&
      Array.isArray(dto.shared) &&
      dto.shared.some((s) => s.projectId === projectId && s.role === 'workflow:owner'),
    tagsMatchBaseline:
      shape && JSON.stringify(sortedTags(dto.tags)) === JSON.stringify(sortedTags(expected.tags)),
    pinnedDataAbsent:
      shape &&
      (dto.pinData === undefined ||
        dto.pinData === null ||
        (record(dto.pinData) && Object.keys(dto.pinData).length === 0)),
    baselineGraphEqual: observedHash !== null && observedHash === expected.baseline.graphHash,
    beforeGraphEqual: observedHash !== null && observedHash === expected.before.graphHash,
    targetGraphEqual: observedHash !== null && observedHash === expected.target.graphHash,
    versionMatchesBaseline: shape && dto.versionId === expected.baseline.versionId,
    versionMatchesBefore: shape && dto.versionId === expected.before.versionId,
    versionMatchesTarget: shape && dto.versionId === expected.target.versionId,
    publicationMatchesBaseline: publicationMatches(expected.baseline),
    publicationMatchesBefore: publicationMatches(expected.before),
    publicationMatchesTarget: publicationMatches(expected.target),
  };
}
export async function checkRuntimeReconciliationDiagnostic(repositoryRoot) {
  const context = await readRuntimeReconciliationContext(repositoryRoot);
  if (context.managementAttempts !== 483) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  try {
    lstatSync(join(context.root, context.paths.claim));
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  } catch (error) {
    if (error.code !== 'ENOENT') throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  return Object.freeze({
    kind: 'm03_runtime_reconciliation_check',
    status: 'ready',
    technicalAttempt: 13,
    sourceCommitSha: runtimeReconciliationCheckpoint.sourceCommitSha,
    windowId: runtimeReconciliationCheckpoint.windowId,
    managementAttempts: 483,
    controlAttempts: 791,
    combinedAttempts: 1274,
    maximumRequests: 3,
    privateRead: false,
    networkRequests: 0,
  });
}
export async function runRuntimeReconciliationDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    technicalAttempt: 13,
    sourceCommitSha: runtimeReconciliationCheckpoint.sourceCommitSha,
    windowId: runtimeReconciliationCheckpoint.windowId,
    status: 'not_attempted',
    requestCount: 0,
    authenticationVerified: false,
    networkCompletionVerified: false,
    metadata: null,
    workflows: { 'SUB-NOTIFY': null, 'WF-90': null },
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 60000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let budget;
  try {
    budget = await (dependencies.openBudget ?? openRuntimeReconciliationDiagnosticBudget)();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController(),
    sockets = [];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const routes = [
      ['Machine', 'credentials', '/api/v1/credentials/EmrM03Machine19', 1, 65536],
      ['SUB-NOTIFY', 'workflows', '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true', 1, 524288],
      ['WF-90', 'workflows', '/api/v1/workflows/S9NHRkKFUIiXX2wv?excludePinnedData=true', 2, 524288],
    ];
    for (const [name, resource, path, page, limit] of routes) {
      if (controller.signal.aborted) reject('timeout');
      try {
        const value = budget.admit();
        if (value !== undefined) {
          if (value?.then) Promise.resolve(value).catch(() => {});
          throw Error();
        }
      } catch {
        reject('budget_blocked');
      }
      const diagnostic = requestDiagnostic(resource, page);
      result.diagnostics.requests.push(diagnostic);
      result.requestCount++;
      let resolveClosed;
      const closed = new Promise((done) => {
        resolveClosed = done;
      });
      sockets.push({ closed, diagnostic });
      const transport = dependencies.request
        ? (input) => nativeRequest(input, dependencies.request)
        : (dependencies.transport ?? nativeRequest);
      const response = await transport({
        url: new URL('https://' + host + path),
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-runtime-reconciliation/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes: limit,
        rejectUnauthorized: true,
        servername: host,
        diagnostic,
        onSocketClosed() {
          diagnostic.socketClosed = true;
          resolveClosed();
        },
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      diagnostic.httpStatus = response.status;
      if (response.status !== 200) {
        const code =
          response.status === 401
            ? 'unauthorized'
            : response.status >= 300 && response.status < 400
              ? 'redirect_refused'
              : 'http_failed';
        diagnosticFailure(diagnostic, 'status', code);
        reject(code);
      }
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > limit) {
        diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
        reject('body_too_large');
      }
      diagnostic.bodyRead = 'complete';
      let dto;
      try {
        dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
        diagnostic.jsonParsed = true;
      } catch {
        diagnosticFailure(diagnostic, 'parse', 'invalid_json');
        reject();
      }
      if (name === 'Machine') {
        const shape = record(dto),
          expected = budget.context.plan.machine;
        // Presence is checked without reading, traversing or stringifying data.
        result.metadata = {
          objectShape: shape,
          dataPresent: shape && Object.hasOwn(dto, 'data'),
          idMatches: shape && dto.id === 'EmrM03Machine19',
          nameMatches: shape && dto.name === expected.name,
          typeMatches: shape && dto.type === 'httpCustomAuth',
          createdAtMatches: shape && dto.createdAt === expected.createdAt,
          updatedAtMatchesJournal:
            shape &&
            typeof dto.updatedAt === 'string' &&
            dto.updatedAt === budget.context.state.machineUpdatedAt,
          flagsCompatible:
            shape &&
            ['isManaged', 'isGlobal', 'isResolvable'].every((k) => dto[k] === undefined || dto[k] === false),
          resolverCompatible: shape && (dto.resolverId === undefined || dto.resolverId === null),
        };
      } else
        result.workflows[name] = await projectRuntimeReconciliationWorkflow(
          dto,
          budget.context.expected[name],
        );
      dto = null;
      diagnostic.schemaValidated = true;
      if (!diagnostic.socketClosed) {
        let closing;
        await Promise.race([
          closed,
          new Promise((done) => {
            closing = setTimeout(done, closeTimeoutMs);
          }),
        ]);
        clearTimeout(closing);
        if (!diagnostic.socketClosed) reject('network_failed');
      }
    }
    result.authenticationVerified = result.diagnostics.requests.every(
      (v) => v.httpStatus === 200 && v.tlsVerified === true,
    );
    result.status = 'readback_observed';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'response_rejected';
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    let closing;
    await Promise.race([
      Promise.all(sockets.map((v) => v.closed)),
      new Promise((done) => {
        closing = setTimeout(done, closeTimeoutMs);
      }),
    ]);
    clearTimeout(closing);
    result.networkCompletionVerified = sockets.every((v) => v.diagnostic.socketClosed);
    if (!result.networkCompletionVerified) result.status = 'network_failed';
    budget.close();
  }
  return result;
}
// Schema/profile validation is not mutation authority. A restoration consumer
// must separately pin the actual owner-recorded readback and current ledgers.
export function assertRuntimeReconciliationReadback(value) {
  const exact = (v, keys) =>
    record(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
  const bools = (v, keys) => exact(v, keys) && keys.every((k) => typeof v[k] === 'boolean');
  const metadataKeys = [
    'objectShape',
    'dataPresent',
    'idMatches',
    'nameMatches',
    'typeMatches',
    'createdAtMatches',
    'updatedAtMatchesJournal',
    'flagsCompatible',
    'resolverCompatible',
  ];
  const workflowKeys = [
    'objectShape',
    'idMatches',
    'archiveStateMatches',
    'ownerProjectMatches',
    'tagsMatchBaseline',
    'pinnedDataAbsent',
    'baselineGraphEqual',
    'beforeGraphEqual',
    'targetGraphEqual',
    'versionMatchesBaseline',
    'versionMatchesBefore',
    'versionMatchesTarget',
    'publicationMatchesBaseline',
    'publicationMatchesBefore',
    'publicationMatchesTarget',
  ];
  if (
    !exact(value, [
      'version',
      'environment',
      'host',
      'projectId',
      'technicalAttempt',
      'sourceCommitSha',
      'windowId',
      'status',
      'requestCount',
      'authenticationVerified',
      'networkCompletionVerified',
      'metadata',
      'workflows',
      'diagnostics',
    ]) ||
    value.version !== 1 ||
    value.environment !== 'dev' ||
    value.host !== host ||
    value.projectId !== projectId ||
    value.technicalAttempt !== 13 ||
    value.sourceCommitSha !== runtimeReconciliationCheckpoint.sourceCommitSha ||
    value.windowId !== runtimeReconciliationCheckpoint.windowId ||
    value.status !== 'readback_observed' ||
    value.requestCount !== 3 ||
    value.authenticationVerified !== true ||
    value.networkCompletionVerified !== true ||
    !bools(value.metadata, metadataKeys) ||
    value.metadata.dataPresent ||
    metadataKeys.filter((k) => k !== 'dataPresent').some((k) => value.metadata[k] !== true) ||
    !exact(value.workflows, ['SUB-NOTIFY', 'WF-90'])
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const key of ['SUB-NOTIFY', 'WF-90']) {
    const w = value.workflows[key];
    if (
      !bools(w, workflowKeys) ||
      [
        'objectShape',
        'idMatches',
        'archiveStateMatches',
        'ownerProjectMatches',
        'tagsMatchBaseline',
        'pinnedDataAbsent',
        'targetGraphEqual',
        'versionMatchesTarget',
        'publicationMatchesTarget',
      ].some((k) => w[k] !== true)
    )
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  if (
    !exact(value.diagnostics, ['version', 'dns', 'requests']) ||
    value.diagnostics.version !== 1 ||
    value.diagnostics.dns !== 'complete' ||
    !Array.isArray(value.diagnostics.requests) ||
    value.diagnostics.requests.length !== 3
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const [i, d] of value.diagnostics.requests.entries()) {
    const expected = {
      resource: i === 0 ? 'credentials' : 'workflows',
      page: i === 2 ? 2 : 1,
      tcpConnected: true,
      tlsVerified: true,
      httpStatus: 200,
      bodyRead: 'complete',
      jsonParsed: true,
      schemaValidated: true,
      socketClosed: true,
      failureStage: 'none',
      failureCode: 'none',
    };
    if (!exact(d, Object.keys(expected)) || Object.entries(expected).some(([k, v]) => d[k] !== v))
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
}

// Exactly one owned workflow GET. This diagnostic neither creates a runtime
// plan nor admits a window, reads credentials/variables, saves or adopts a graph.
export async function runMachineMetadataDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    credentialId: 'EmrM03Machine19',
    expectedCreatedAt: '2026-10-19T00:25:21.669Z',
    status: 'not_attempted',
    requestCount: 0,
    httpStatus: null,
    authenticationVerified: false,
    networkCompletionVerified: false,
    metadata: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let budget;
  try {
    if (dependencies.admitManagementAttempt === undefined) budget = openMachineMetadataDiagnosticBudget();
    else if (typeof dependencies.admitManagementAttempt !== 'function') throw Error();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false,
    requestIssued = false,
    resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    try {
      const answer = (dependencies.admitManagementAttempt ?? (() => budget.admit()))();
      if (answer !== undefined) {
        if (answer?.then) Promise.resolve(answer).catch(() => {});
        throw Error();
      }
    } catch {
      reject('budget_blocked');
    }
    const diagnostic = requestDiagnostic('credentials', 1);
    result.diagnostics.requests.push(diagnostic);
    result.requestCount = 1;
    requestIssued = true;
    const transport = dependencies.request
      ? (input) => nativeRequest(input, dependencies.request)
      : (dependencies.transport ?? nativeRequest);
    const response = await transport({
      url: new URL(`https://${host}/api/v1/credentials/EmrM03Machine19`),
      method: 'GET',
      headers: {
        'x-n8n-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-m03-machine-metadata/1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes: 65536,
      rejectUnauthorized: true,
      servername: host,
      diagnostic,
      onSocketClosed() {
        diagnostic.socketClosed = true;
        resolveClosed();
      },
    });
    if (controller.signal.aborted) reject('timeout');
    if (
      !record(response) ||
      !Number.isInteger(response.status) ||
      response.status < 100 ||
      response.status > 599
    )
      reject();
    result.httpStatus = diagnostic.httpStatus = response.status;
    if (response.status !== 200) {
      const code =
        response.status === 401
          ? 'unauthorized'
          : response.status >= 300 && response.status < 400
            ? 'redirect_refused'
            : 'http_failed';
      diagnosticFailure(diagnostic, 'status', code);
      reject(code);
    }
    result.authenticationVerified = true;
    if (!(response.body instanceof Uint8Array) || response.body.byteLength > 65536) {
      diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
      reject('body_too_large');
    }
    diagnostic.bodyRead = 'complete';
    let dto;
    try {
      dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      diagnostic.jsonParsed = true;
    } catch {
      diagnosticFailure(diagnostic, 'parse', 'invalid_json');
      reject();
    }
    // Never traverse, read or stringify dto.data. Only fixed public predicates
    // escape this child; no response values, descriptions or unknown timestamps.
    const shape = record(dto),
      updatedAt = shape ? dto.updatedAt : undefined;
    result.metadata = {
      objectShape: shape,
      dataPresent: shape && Object.hasOwn(dto, 'data'),
      idMatches: shape && dto.id === result.credentialId,
      nameMatches: shape && dto.name === 'M03 foundation machine [dev]',
      typeMatches: shape && dto.type === 'httpCustomAuth',
      createdAtMatches: shape && dto.createdAt === result.expectedCreatedAt,
      updatedAtValid: typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt)),
      flagsCompatible:
        shape &&
        ['isManaged', 'isGlobal', 'isResolvable'].every((k) => dto[k] === undefined || dto[k] === false),
      resolverCompatible: shape && (dto.resolverId === undefined || dto.resolverId === null),
      updatedAtMatchesCreatedAt: shape && dto.updatedAt === result.expectedCreatedAt,
    };
    diagnostic.schemaValidated = shape;
    result.status = 'metadata_observed';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.httpStatus !== null && last?.httpStatus !== undefined) result.httpStatus = last.httpStatus;
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    result.metadata = null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    if (requestIssued && !result.diagnostics.requests[0].socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, closeTimeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
    }
    result.networkCompletionVerified = requestIssued && result.diagnostics.requests[0].socketClosed;
    if (requestIssued && !result.networkCompletionVerified) {
      result.status = 'network_failed';
      result.metadata = null;
    }
    budget?.close();
  }
  return result;
}

export async function runWorkflowBaselineDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    status: 'not_attempted',
    requestCount: 0,
    authenticationVerified: false,
    projectVerified: false,
    workflowKey: 'WF-00',
    baseline: null,
    forensics: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  let baseline, diagnoseFoundationRuntimeBaseline, diagnoseFoundationRuntimeBaselineVariants;
  try {
    const checkpoint = await import('./foundation-runtime-checkpoint.mjs');
    const { foundationRuntimeCheckpoint } = checkpoint;
    diagnoseFoundationRuntimeBaseline = checkpoint.diagnoseFoundationRuntimeBaseline;
    diagnoseFoundationRuntimeBaselineVariants = checkpoint.diagnoseFoundationRuntimeBaselineVariants;
    const pinned = foundationRuntimeCheckpoint.workflows['WF-00'];
    const record = JSON.parse(
      readFileSync(new URL('../../n8n/workflows/WF-00.json', import.meta.url), 'utf8'),
    );
    if (
      record.key !== 'WF-00' ||
      record.id !== pinned.id ||
      record.versionId !== pinned.versionId ||
      record.projectId !== projectId ||
      createHash('sha256').update(JSON.stringify(record)).digest('hex') !== pinned.recordHash
    )
      reject();
    baseline = {
      key: 'WF-00',
      id: pinned.id,
      versionId: pinned.versionId,
      body: {
        name: record.workflow.name,
        nodes: record.workflow.nodes,
        connections: record.workflow.connections,
        settings: record.workflow.settings,
      },
      tags: record.workflow.tags,
      ...(Object.hasOwn(record, 'nativeReadonlySettings')
        ? { nativeReadonlySettings: record.nativeReadonlySettings }
        : {}),
    };
    if (diagnoseFoundationRuntimeBaseline(null, baseline, projectId).failedChecks.includes('expected_shape'))
      reject();
  } catch {
    result.status = 'response_rejected';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false,
    requestIssued = false,
    resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const diagnostic = requestDiagnostic('workflows', 1);
    result.diagnostics.requests.push(diagnostic);
    result.requestCount = 1;
    requestIssued = true;
    const transport = dependencies.request
      ? (input) => nativeRequest(input, dependencies.request)
      : (dependencies.transport ?? nativeRequest);
    const response = await transport({
      url: new URL(`https://${host}/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true`),
      method: 'GET',
      headers: {
        'x-n8n-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-m03-baseline-read-only/1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes,
      rejectUnauthorized: true,
      servername: host,
      diagnostic,
      onSocketClosed: resolveClosed,
    });
    if (controller.signal.aborted) reject('timeout');
    if (
      !record(response) ||
      !Number.isInteger(response.status) ||
      response.status < 100 ||
      response.status > 599
    )
      reject();
    diagnostic.httpStatus = response.status;
    if (response.status !== 200) {
      const code =
        response.status >= 300 && response.status < 400
          ? 'redirect_refused'
          : response.status === 401
            ? 'unauthorized'
            : 'http_failed';
      diagnosticFailure(diagnostic, 'status', code);
      reject(code);
    }
    if (!(response.body instanceof Uint8Array) || response.body.byteLength > maxBytes) {
      diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
      reject('body_too_large');
    }
    diagnostic.bodyRead = 'complete';
    let dto;
    try {
      dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      diagnostic.jsonParsed = true;
    } catch {
      diagnosticFailure(diagnostic, 'parse', 'invalid_json');
      reject();
    }
    const pending = [dto];
    let visited = 0;
    while (pending.length) {
      if (++visited > 100000) reject();
      const value = pending.pop();
      if (typeof value === 'string' && value.includes(key)) {
        diagnosticFailure(diagnostic, 'schema', 'confidentiality_rejected');
        reject('confidentiality_rejected');
      }
      if (Array.isArray(value)) pending.push(...value);
      else if (record(value)) pending.push(...Object.values(value));
    }
    result.authenticationVerified = true;
    result.baseline = diagnoseFoundationRuntimeBaseline(dto, baseline, projectId);
    result.forensics = diagnoseFoundationRuntimeBaselineVariants(dto, baseline);
    result.projectVerified =
      !result.baseline.failedChecks.includes('owner_project') &&
      !result.baseline.failedChecks.includes('dto_shape');
    diagnostic.schemaValidated = !result.baseline.failedChecks.includes('dto_shape');
    result.status = result.baseline.failedChecks.length === 0 ? 'matching_baseline' : 'baseline_mismatch';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'unsafe_dns',
            'timeout',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    result.baseline = null;
    result.forensics = null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    if (requestIssued && !result.diagnostics.requests[0].socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, 5000);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
      if (!result.diagnostics.requests[0].socketClosed) {
        result.status = 'network_failed';
        result.baseline = null;
        result.forensics = null;
      }
    }
  }
  return result;
}

// Fixed metadata-only diagnostic: the bounded inventory GET transport supplies
// bytes and actual socket closure to the SAME strict native discovery reader.
// This explicitly is an adapter, not identical native-wire transport evidence.
export async function runWf70DiscoveryDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    workflowKey: 'WF-70',
    status: 'discovery_failed',
    transportAdapter: 'inventory_bounded_get_adapter',
    requestCount: 0,
    maximumRequests: 4,
    authenticationVerified: false,
    paginationComplete: false,
    candidateCount: null,
    adoptionProven: false,
    drainProven: false,
    readerFailure: null,
    networkCompletionVerified: false,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length < 8 || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 60000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    result.status = 'invalid_options';
    return result;
  }
  let reader, ownedBudget;
  const controller = new AbortController(),
    sockets = [],
    requests = new Set(),
    deadlineAt = Date.now() + timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { createFoundationNativeReader } = await import('./foundation-native-reader.mjs');
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
    );
    const admit = dependencies.admitControlAttempt ?? (ownedBudget = openWf70DiscoveryBudget()).admit;
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(
      await Promise.race([
        (dependencies.lookup ?? resolveInstance)(controller.signal),
        new Promise((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new InventoryError('timeout')), {
            once: true,
          }),
        ),
      ]),
    );
    if (controller.signal.aborted) throw new InventoryError('timeout');
    result.diagnostics.dns = 'complete';
    reader = createFoundationNativeReader({
      bindings,
      deadlineAt,
      sensitiveValues: [key],
      admitControlAttempt(value) {
        if (controller.signal.aborted || Date.now() >= deadlineAt || result.requestCount >= 4)
          throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
        result.requestCount++;
        const written = admit(value);
        if (written !== undefined) {
          if (written?.then) Promise.resolve(written).catch(() => {});
          throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
        }
      },
      transport: {
        async request({ method, path, signal }) {
          if (
            method !== 'GET' ||
            !/^\/api\/v1\/executions\?workflowId=S6KDFsx5IjQRf6tm&includeData=false&limit=120(?:&status=running)?(?:&cursor=[^\s#]+)?$/.test(
              path,
            )
          )
            throw Error('WF70_DIAGNOSTIC_ROUTE_BLOCKED');
          const diagnostic = requestDiagnostic('executions', path.includes('&cursor=') ? 2 : 1);
          result.diagnostics.requests.push(diagnostic);
          let done;
          const closure = {
            closed: false,
            promise: new Promise((resolveClosed) => {
              done = resolveClosed;
            }),
          };
          sockets.push(closure);
          const input = {
            url: new URL('https://' + host + path),
            method: 'GET',
            headers: {
              'x-n8n-api-key': key,
              accept: 'application/json',
              'user-agent': 'everyone-market-radar-m03-wf70-read-only/1',
            },
            address: addresses[0],
            signal: AbortSignal.any([signal, controller.signal]),
            maxBytes,
            rejectUnauthorized: true,
            servername: host,
            diagnostic,
            onSocketClosed() {
              diagnostic.socketClosed = true;
              closure.closed = true;
              done();
            },
          };
          const response = await (
            dependencies.transport ??
            ((input) =>
              nativeRequest(input, (...args) => {
                const req = (dependencies.request ?? request)(...args);
                requests.add(req);
                return req;
              }))
          )(input);
          if (
            !record(response) ||
            !Number.isInteger(response.status) ||
            response.status < 100 ||
            response.status > 599 ||
            !(response.body instanceof Uint8Array) ||
            response.body.byteLength > maxBytes
          )
            throw Error('WF70_DIAGNOSTIC_RESPONSE_BLOCKED');
          diagnostic.httpStatus = response.status;
          diagnostic.bodyRead = 'complete';
          if (response.status === 200) result.authenticationVerified = true;
          const bytes = response.body;
          return {
            status: response.status,
            headers: {},
            body: (async function* () {
              yield bytes;
            })(),
            closed: closure.promise,
            abort() {
              for (const req of requests) {
                try {
                  req.destroy();
                } catch {}
              }
            },
          };
        },
      },
    });
    const candidates = await reader.discover({ workflowKey: 'WF-70', baselineIds: [] });
    result.paginationComplete = candidates.paginationComplete === true;
    result.candidateCount = candidates.candidates.length;
    result.status = 'discovery_complete';
    for (const diagnostic of result.diagnostics.requests) {
      diagnostic.jsonParsed = true;
      diagnostic.schemaValidated = true;
    }
  } catch {
    result.readerFailure = reader?.lastFailure() ?? null;
    if (result.diagnostics.dns === 'resolving')
      result.diagnostics.dns = controller.signal.aborted ? 'timeout' : 'failed';
    const diagnostic = result.diagnostics.requests.at(-1);
    if (diagnostic && diagnostic.failureStage === 'none') {
      const failure = result.readerFailure;
      if (failure?.httpStatus !== null && failure?.httpStatus !== undefined)
        diagnostic.httpStatus = failure.httpStatus;
      if (['projection', 'http_status'].includes(failure?.stage)) {
        diagnostic.jsonParsed = true;
        diagnosticFailure(
          diagnostic,
          failure.stage === 'http_status' ? 'status' : 'schema',
          failure.stage === 'http_status' ? 'http_failed' : 'invalid_schema',
        );
      } else
        diagnosticFailure(
          diagnostic,
          failure?.stage === 'parse' ? 'parse' : 'unknown',
          failure?.stage === 'parse'
            ? 'invalid_json'
            : controller.signal.aborted
              ? 'timeout'
              : 'network_failed',
        );
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    for (const req of requests) {
      try {
        req.destroy();
      } catch {}
    }
    let closeTimer;
    await Promise.race([
      Promise.allSettled(sockets.map((s) => s.promise)),
      new Promise((done) => {
        closeTimer = setTimeout(done, 1000);
      }),
    ]);
    clearTimeout(closeTimer);
    result.networkCompletionVerified =
      sockets.every((s) => s.closed) &&
      (reader?.state().pendingRequests ?? 0) === 0 &&
      (reader?.state().unclosedResponses ?? 0) === 0;
    if (!result.networkCompletionVerified) result.status = 'discovery_failed';
    ownedBudget?.close();
    key = null;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key =
    process.argv[2] === '--runtime-reconciliation-check-only' ? undefined : process.env.M03_N8N_API_KEY;
  delete process.env.M03_N8N_API_KEY;
  if (!(
    process.argv.length === 2 ||
    (process.argv.length === 3 &&
      [
        '--workflow-baseline-diagnostic',
        '--wf70-discovery-diagnostic',
        '--machine-metadata-diagnostic',
        '--runtime-reconciliation-check-only',
        '--runtime-reconciliation-diagnostic',
      ].includes(process.argv[2]))
  )) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'argument_rejected' }) + '\n');
    process.exitCode = 1;
  } else if (
    ['--runtime-reconciliation-check-only', '--runtime-reconciliation-diagnostic'].includes(process.argv[2])
  ) {
    setImmediate(() => {
      const check = process.argv[2] === '--runtime-reconciliation-check-only';
      (check ? checkRuntimeReconciliationDiagnostic() : runRuntimeReconciliationDiagnostic(key)).then(
        (result) => {
          process.stdout.write(JSON.stringify(result) + '\n');
          process.exitCode = (check ? result.status === 'ready' : result.status === 'readback_observed')
            ? 0
            : 1;
        },
        () => {
          process.stdout.write(
            JSON.stringify(
              check
                ? {
                    kind: 'm03_runtime_reconciliation_check',
                    status: 'blocked',
                    privateRead: false,
                    networkRequests: 0,
                  }
                : { version: 1, status: 'diagnostic_failed' },
            ) + '\n',
          );
          process.exitCode = 1;
        },
      );
    });
  } else if (process.argv[2] === '--machine-metadata-diagnostic') {
    const result = await runMachineMetadataDiagnostic(key);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'metadata_observed' ? 0 : 1;
  } else if (process.argv[2] === '--wf70-discovery-diagnostic') {
    // The reader's runtime-control dependency imports resolveInstance above.
    // Schedule only this new mode after module evaluation, avoiding a circular
    // top-level-await wait without changing the existing inventory entry paths.
    setImmediate(() =>
      runWf70DiscoveryDiagnostic(key).then(
        (result) => {
          process.stdout.write(JSON.stringify(result) + '\n');
          process.exitCode = result.status === 'discovery_complete' ? 0 : 1;
        },
        () => {
          process.stdout.write(JSON.stringify({ version: 1, status: 'diagnostic_failed' }) + '\n');
          process.exitCode = 1;
        },
      ),
    );
  } else {
    const result =
      process.argv.length === 3 ? await runWorkflowBaselineDiagnostic(key) : await runInventory(key);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = ['complete', 'partial', 'matching_baseline', 'baseline_mismatch'].includes(
      result.status,
    )
      ? 0
      : 1;
  }
}
