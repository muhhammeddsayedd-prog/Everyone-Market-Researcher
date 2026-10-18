import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// GET-only metadata projection. Official schemas: https://vercel.com/openapi.json
// /v7/deployments and owner variant /v13/deployments/{idOrUrl}. No env field is read.
const projectId = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId = 'team_gboXPxTevpCOZuaA8eY9PmR1',
  branch = 'm03-n8n-foundation';
const fail = (code) => {
  throw Error('GW01_PREVIEW_' + code);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && Object.keys(v).every((k) => keys.includes(k));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function checkPacket(p) {
  if (
    !exact(p, ['version', 'projectId', 'teamId', 'branch', 'sourceSha']) ||
    p.version !== 1 ||
    p.projectId !== projectId ||
    p.teamId !== teamId ||
    p.branch !== branch ||
    typeof p.sourceSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(p.sourceSha)
  )
    fail('INPUT');
}
export function previewArguments(packet, kind, id = null) {
  checkPacket(packet);
  if (
    !['project', 'list', 'deployment'].includes(kind) ||
    (kind === 'deployment' && (typeof id !== 'string' || !/^dpl_[A-Za-z0-9]{16,80}$/.test(id))) ||
    (kind !== 'deployment' && id !== null)
  )
    fail('INPUT');
  const path =
    kind === 'project'
      ? `/v9/projects/${projectId}?teamId=${teamId}`
      : kind === 'list'
        ? `/v7/deployments?projectId=${projectId}&teamId=${teamId}&target=preview&branch=${branch}&sha=${packet.sourceSha}&state=READY&limit=20`
        : `/v13/deployments/${id}?teamId=${teamId}&withGitRepoInfo=true`;
  return [
    'api',
    path,
    '--method',
    'GET',
    '--scope',
    'muhammed-abdelrahman',
    '--raw',
    '--non-interactive',
    '--no-color',
  ];
}
function checkProject(p) {
  if (
    !object(p) ||
    p.id !== projectId ||
    p.accountId !== teamId ||
    p.autoExposeSystemEnvs !== true ||
    p.rootDirectory !== 'apps/web' ||
    p.framework !== 'nextjs' ||
    p.ssoProtection?.deploymentType !== 'all_except_custom_domains'
  )
    fail('PROJECT');
}
function checkRow(p, row) {
  // v7 documents projectSettings as optional and has no includeProjectSettings
  // query flag. Contradictory present settings still fail. The fresh project
  // must prove root/framework; the v13 immutable resource must prove framework.
  if (
    !object(row) ||
    typeof row.uid !== 'string' ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(row.uid) ||
    typeof row.url !== 'string' ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(row.url) ||
    row.projectId !== projectId ||
    row.readyState !== 'READY' ||
    row.target !== null ||
    row.customEnvironment != null ||
    !Number.isSafeInteger(row.createdAt) ||
    row.createdAt < 0 ||
    row.meta?.githubCommitSha !== p.sourceSha ||
    row.meta?.githubCommitRef !== branch ||
    (Object.hasOwn(row, 'projectSettings') &&
      (!object(row.projectSettings) ||
        (Object.hasOwn(row.projectSettings, 'framework') && row.projectSettings.framework !== 'nextjs') ||
        (Object.hasOwn(row.projectSettings, 'rootDirectory') &&
          row.projectSettings.rootDirectory !== 'apps/web')))
  )
    fail('SELECTION');
}
function selectionDiagnostic(packet, list) {
  const bounded = object(list) && Array.isArray(list.deployments),
    rows = bounded ? list.deployments.slice(0, 20) : [],
    has = (value, key) => object(value) && Object.hasOwn(value, key);
  return {
    selectionCount: bounded ? Math.min(list.deployments.length, 20) : null,
    selectionCountExact: bounded && list.deployments.length <= 20,
    paginationComplete:
      object(list) &&
      object(list.pagination) &&
      Object.hasOwn(list.pagination, 'next') &&
      list.pagination.next == null,
    rows: rows.map((row) => ({
      rowObject: object(row),
      idPresent: has(row, 'uid'),
      idValid: object(row) && typeof row.uid === 'string' && /^dpl_[A-Za-z0-9]{16,80}$/.test(row.uid),
      urlPresent: has(row, 'url'),
      urlValid:
        object(row) &&
        typeof row.url === 'string' &&
        /^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(row.url),
      projectPresent: has(row, 'projectId'),
      projectMatches: object(row) && row.projectId === projectId,
      readyStatePresent: has(row, 'readyState'),
      readyStateMatches: object(row) && row.readyState === 'READY',
      targetPresent: has(row, 'target'),
      previewTarget: object(row) && row.target === null,
      customEnvironmentAbsent: object(row) && row.customEnvironment == null,
      createdAtPresent: has(row, 'createdAt'),
      createdAtValid: object(row) && Number.isSafeInteger(row.createdAt) && row.createdAt >= 0,
      shaPresent: object(row) && has(row.meta, 'githubCommitSha'),
      shaMatches: object(row) && row.meta?.githubCommitSha === packet.sourceSha,
      branchPresent: object(row) && has(row.meta, 'githubCommitRef'),
      branchMatches: object(row) && row.meta?.githubCommitRef === branch,
      frameworkPresent: object(row) && has(row.projectSettings, 'framework'),
      frameworkMatches: object(row) && row.projectSettings?.framework === 'nextjs',
      rootDirectoryPresent: object(row) && has(row.projectSettings, 'rootDirectory'),
      rootDirectoryMatches: object(row) && row.projectSettings?.rootDirectory === 'apps/web',
    })),
  };
}
class SelectionFailure extends Error {
  constructor(packet, list) {
    super('GW01_PREVIEW_SELECTION');
    this.selectionDiagnostic = selectionDiagnostic(packet, list);
  }
}
function refMode(packet, resource) {
  // Manual targeted deployments accept a commit as the Git reference:
  // https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference
  // Exact branch metadata and both independent SHA fields remain required.
  return resource?.gitSource?.ref === branch
    ? 'branch'
    : resource?.gitSource?.ref === packet.sourceSha
      ? 'exact_sha'
      : 'other';
}
function resourceDiagnostic(packet, row, resource, now) {
  const isObject = object(resource),
    has = (value, key) => object(value) && Object.hasOwn(value, key),
    mode = refMode(packet, resource);
  return {
    resourceObject: isObject,
    idMatches: isObject && resource.id === row.uid,
    urlMatches: isObject && resource.url === row.url,
    projectMatches: isObject && resource.projectId === projectId,
    ownerMatches: isObject && resource.ownerId === teamId,
    teamMatches: isObject && resource.team?.id === teamId,
    readyStateMatches: isObject && resource.readyState === 'READY',
    previewTarget: isObject && resource.target === null,
    customEnvironmentAbsent: isObject && resource.customEnvironment == null,
    createdAtMatches: isObject && resource.createdAt === row.createdAt,
    shaMatches: isObject && resource.meta?.githubCommitSha === packet.sourceSha,
    branchMatches: isObject && resource.meta?.githubCommitRef === branch,
    gitSourceTypeMatches: isObject && resource.gitSource?.type === 'github',
    gitSourceShaMatches: isObject && resource.gitSource?.sha === packet.sourceSha,
    gitSourceRefMode: mode,
    gitSourceRefAccepted: mode !== 'other',
    projectSettingsPresent: isObject && has(resource, 'projectSettings'),
    frameworkPresent: isObject && has(resource.projectSettings, 'framework'),
    frameworkMatches: isObject && resource.projectSettings?.framework === 'nextjs',
    rootDirectoryPresent: isObject && has(resource.projectSettings, 'rootDirectory'),
    rootDirectoryMatches: isObject && resource.projectSettings?.rootDirectory === 'apps/web',
    observedTimeValid: isObject && Number.isSafeInteger(now) && now >= resource.createdAt,
  };
}
class ResourceFailure extends Error {
  constructor(packet, row, resource, now) {
    super('GW01_PREVIEW_RESOURCE');
    this.resourceDiagnostic = resourceDiagnostic(packet, row, resource, now);
  }
}
export function previewFailure(error) {
  return {
    version: 1,
    status: 'unverified',
    code: /^GW01_PREVIEW_(INPUT|PROJECT|SELECTION|RESOURCE|NATIVE|CLOSE|PREFLIGHT)$/.test(
      error?.message ?? '',
    )
      ? error.message
      : 'GW01_PREVIEW_REJECTED',
    ...(error instanceof SelectionFailure ? { selectionDiagnostic: error.selectionDiagnostic } : {}),
    ...(error instanceof ResourceFailure ? { resourceDiagnostic: error.resourceDiagnostic } : {}),
  };
}
export async function runPreviewRead(packet, ports) {
  checkPacket(packet);
  if (!object(ports) || typeof ports.get !== 'function' || typeof ports.clock !== 'function') fail('INPUT');
  const project = await ports.get('project');
  checkProject(project);
  const list = await ports.get('list');
  if (
    !object(list) ||
    !Array.isArray(list.deployments) ||
    list.deployments.length !== 1 ||
    !object(list.pagination) ||
    !Object.hasOwn(list.pagination, 'next') ||
    list.pagination.next != null
  )
    throw new SelectionFailure(packet, list);
  const row = list.deployments[0];
  try {
    checkRow(packet, row);
  } catch {
    throw new SelectionFailure(packet, list);
  }
  const d = await ports.get('deployment', row.uid),
    now = ports.clock();
  if (
    !object(d) ||
    d.id !== row.uid ||
    d.url !== row.url ||
    d.projectId !== projectId ||
    d.ownerId !== teamId ||
    d.team?.id !== teamId ||
    d.readyState !== 'READY' ||
    d.target !== null ||
    d.customEnvironment != null ||
    d.createdAt !== row.createdAt ||
    d.meta?.githubCommitSha !== packet.sourceSha ||
    d.meta?.githubCommitRef !== branch ||
    d.gitSource?.type !== 'github' ||
    d.gitSource?.sha !== packet.sourceSha ||
    refMode(packet, d) === 'other' ||
    d.projectSettings?.framework !== 'nextjs' ||
    (object(d.projectSettings) &&
      Object.hasOwn(d.projectSettings, 'rootDirectory') &&
      d.projectSettings.rootDirectory !== 'apps/web')
  )
    throw new ResourceFailure(packet, row, d, now);
  if (!Number.isSafeInteger(now) || now < d.createdAt) throw new ResourceFailure(packet, row, d, now);
  return {
    version: 1,
    status: 'verified',
    kind: 'vercel_preview_metadata',
    nativeExit: 0,
    nativeGetCommands: 3,
    privateFieldsProjected: false,
    ownedChildrenClosed: true,
    teamId,
    environment: 'preview',
    readyState: 'READY',
    target: {
      audience: 'https://' + row.url,
      commitSha: packet.sourceSha,
      deploymentId: row.uid,
      projectId,
      branch,
    },
    createdAt: new Date(row.createdAt).toISOString(),
    observedAt: new Date(now).toISOString(),
    framework: 'nextjs',
    frameworkProof: 'fresh_project_and_deployment_resource',
    rootDirectory: 'apps/web',
    rootDirectoryProof: 'fresh_project_setting',
    listProjectSettingsPresent: Object.hasOwn(row, 'projectSettings'),
    gitSourceRefMode: refMode(packet, d),
    protection: 'all_except_custom_domains',
    autoExposeSystemEnvs: true,
    systemEnvironmentProof: 'fresh_project_setting',
  };
}
export function nativePreviewGet(cli, packet, kind, id = null, dependencies = {}) {
  const args = previewArguments(packet, kind, id);
  return new Promise((done, rejected) => {
    let child,
      closed = false,
      failed = false,
      settled = false,
      size = 0,
      closeTimer;
    const chunks = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      let value;
      try {
        if (!closed || failed) fail('NATIVE');
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!object(value) || value.error) fail('NATIVE');
      } catch {
        failed = true;
      }
      for (const bytes of chunks) bytes.fill(0);
      if (failed) rejected(Error(closed ? 'GW01_PREVIEW_NATIVE' : 'GW01_PREVIEW_CLOSE'));
      else done(value);
    };
    const stop = () => {
      failed = true;
      try {
        child?.kill('SIGKILL');
      } catch {}
      if (!closeTimer) closeTimer = setTimeout(finish, dependencies.closeMs ?? 5000);
    };
    const timer = setTimeout(stop, dependencies.timeoutMs ?? 15000);
    try {
      const env = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
          (k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]]),
        ),
      );
      Object.assign(env, { VERCEL_TELEMETRY_DISABLED: '1', NO_UPDATE_NOTIFIER: '1', CI: '1' });
      child = (dependencies.spawn ?? spawn)(
        process.execPath,
        ['--import', new URL('./gw01-vercel-no-retry.mjs', import.meta.url).href, cli, ...args],
        { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true },
      );
      child.stdout.on('data', (chunk) => {
        if (settled || failed) return;
        size += chunk.length;
        if (size > 2097152) {
          stop();
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      child.stdout.on('error', stop);
      child.on('error', stop);
      child.on('close', (code) => {
        closed = true;
        failed ||= code !== 0;
        finish();
      });
      child.stdin.on('error', stop);
      child.stdin.end();
    } catch {
      if (child === undefined) {
        closed = true;
        failed = true;
        finish();
      } else stop();
    }
  });
}
function physical(path, directory = false) {
  const file = resolve(path);
  for (let cursor = file; ; cursor = dirname(cursor)) {
    const s = lstatSync(cursor);
    if (
      s.isSymbolicLink() ||
      (cursor === file ? (directory ? !s.isDirectory() : !s.isFile() || s.size > 5242880) : !s.isDirectory())
    )
      fail('PREFLIGHT');
    if (dirname(cursor) === cursor) break;
  }
  return file;
}
function json(path) {
  return JSON.parse(readFileSync(physical(path), 'utf8'));
}
function preflight(root) {
  const files = [
    'scripts/n8n/gw01-preview-read.mjs',
    'scripts/n8n/gw01-preview-read-packet.json',
    'scripts/n8n/gw01-vercel-no-retry.mjs',
    'scripts/n8n/gw01-gateway-seal.json',
  ];
  const seal = json(join(root, 'scripts/n8n/gw01-preview-read-seal.json'));
  if (!exact(seal, ['version', 'files']) || seal.version !== 1 || !exact(seal.files, files))
    fail('PREFLIGHT');
  for (const file of files)
    if (
      typeof seal.files[file] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(seal.files[file]) ||
      digest(readFileSync(physical(join(root, file)))) !== seal.files[file]
    )
      fail('PREFLIGHT');
  const packet = json(join(root, 'scripts/n8n/gw01-preview-read-packet.json'));
  checkPacket(packet);
  const prior = json(join(root, 'scripts/n8n/gw01-gateway-seal.json')),
    runtime = physical(join(process.env.APPDATA ?? '', 'npm/node_modules/vercel'), true);
  if (
    !exact(prior, ['version', 'files', 'vercelFiles']) ||
    prior.version !== 1 ||
    !object(prior.files) ||
    !object(prior.vercelFiles) ||
    json(join(runtime, 'package.json')).version !== '56.5.0'
  )
    fail('PREFLIGHT');
  const required = ['package.json'],
    pending = [physical(join(runtime, 'dist'), true)];
  let count = 0;
  while (pending.length)
    for (const entry of readdirSync(pending.pop(), { withFileTypes: true })) {
      if (++count > 10000) fail('PREFLIGHT');
      const file = join(entry.parentPath, entry.name),
        s = lstatSync(file);
      if (s.isSymbolicLink()) fail('PREFLIGHT');
      if (s.isDirectory()) pending.push(file);
      else if (/\.(js|mjs|cjs|json|wasm)$/.test(entry.name)) {
        required.push(file.slice(runtime.length + 1).replaceAll('\\', '/'));
        if (required.length > 2000) fail('PREFLIGHT');
      }
    }
  if (!required.includes('dist/index.js') || !exact(prior.vercelFiles, required)) fail('PREFLIGHT');
  for (const file of required)
    if (
      typeof prior.vercelFiles[file] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(prior.vercelFiles[file]) ||
      digest(readFileSync(physical(join(runtime, file)))) !== prior.vercelFiles[file]
    )
      fail('PREFLIGHT');
  return { packet, cli: join(runtime, 'dist/index.js') };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out;
  try {
    if (process.argv.length !== 3 || !['CheckOnly', 'Read'].includes(process.argv[2])) fail('INPUT');
    const { packet, cli } = preflight(resolve('.'));
    out =
      process.argv[2] === 'CheckOnly'
        ? { version: 1, status: 'check_only_ready', networkRequests: 0, privateValuesRead: false }
        : await runPreviewRead(packet, {
            clock: () => Date.now(),
            get: (kind, id) => nativePreviewGet(cli, packet, kind, id ?? null),
          });
  } catch (error) {
    out = previewFailure(error);
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode = ['verified', 'check_only_ready'].includes(out.status) ? 0 : 1;
}
