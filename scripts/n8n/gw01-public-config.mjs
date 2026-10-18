import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectId = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId = 'team_gboXPxTevpCOZuaA8eY9PmR1',
  branch = 'm03-n8n-foundation';
const secretNames = ['EMR_WORKER_DB_PASSWORD', 'EMR_WORKER_GATEWAY_TOKEN_SHA256'];
const enabledName = 'EMR_WORKER_GATEWAY_ENABLED',
  windowId = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
const closingModes = ['Disable', 'Cleanup', 'ReconcileCleanup'];
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (code = 'INPUT') => {
  throw Error('GW01_PUBLIC_CONFIG_' + code);
};
const hash = (v) => createHash('sha256').update(v).digest('hex');
function milliseconds(value) {
  if (typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < 0) fail('OWNERSHIP');
  return value;
}
function packetCheck(p) {
  if (
    !exact(p, ['version', 'projectId', 'teamId', 'branch', 'sourceSha']) ||
    p.version !== 1 ||
    p.projectId !== projectId ||
    p.teamId !== teamId ||
    p.branch !== branch ||
    typeof p.sourceSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(p.sourceSha)
  )
    fail();
  return p;
}
export function publicConfigValues(packet) {
  packetCheck(packet);
  return {
    EMR_WORKER_GATEWAY_ENABLED: 'true',
    EMR_WORKER_GATEWAY_AUDIENCE: 'vercel-deployment',
    EMR_WORKER_GATEWAY_WINDOW_ID: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
    EMR_WORKER_GATEWAY_COMMIT_SHA: packet.sourceSha,
  };
}

/** Only the four known plain public values are accessed. Sensitive records are
 * examined for metadata only, even if an unexpected API response includes value. */
export function inspectPublicConfiguration(packet, project, list, phase = 'delivery') {
  const values = publicConfigValues(packet);
  if (!['delivery', 'closeout'].includes(phase)) fail();
  if (
    !object(project) ||
    project.id !== projectId ||
    project.accountId !== teamId ||
    project.autoExposeSystemEnvs !== true ||
    project.rootDirectory !== 'apps/web' ||
    project.framework !== 'nextjs' ||
    project.ssoProtection?.deploymentType !== 'all_except_custom_domains'
  )
    fail('PROJECT');
  if (
    !object(list) ||
    !Array.isArray(list.envs) ||
    list.envs.length > 1000 ||
    (list.pagination != null && (!object(list.pagination) || list.pagination.next != null))
  )
    fail('RESPONSE');
  const missing = [],
    metadata = {},
    states = {};
  for (const name of [...Object.keys(values), ...secretNames]) {
    const rows = list.envs.filter((r) => object(r) && r.key === name);
    if (rows.length > 1) fail('CONFLICT');
    if (!rows.length) {
      states[name] = 'absent';
      if (name in values) missing.push(name);
      continue;
    }
    const r = rows[0];
    if (
      !Array.isArray(r.target) ||
      r.target.length !== 1 ||
      r.target[0] !== 'preview' ||
      r.gitBranch !== branch ||
      r.configurationId != null ||
      (r.customEnvironmentIds != null &&
        (!Array.isArray(r.customEnvironmentIds) || r.customEnvironmentIds.length !== 0)) ||
      (r.system !== undefined && r.system !== false)
    )
      fail('CONFLICT');
    if (name in values) {
      if (
        r.type !== 'plain' ||
        typeof r.value !== 'string' ||
        (phase === 'closeout' && name === enabledName
          ? !['true', 'false'].includes(r.value)
          : r.value !== values[name])
      )
        fail('CONFLICT');
      if (phase === 'closeout' && name === enabledName) values[name] = r.value;
    } else if (r.type !== 'sensitive') fail('CONFLICT');
    if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(r.id)) fail('OWNERSHIP');
    metadata[name] = {
      key: name,
      id: r.id,
      createdAt: milliseconds(r.createdAt),
      type: r.type,
      target: ['preview'],
      gitBranch: branch,
    };
    states[name] = 'matching';
  }
  return {
    configuration: missing.length ? null : { target: 'preview', gitBranch: branch, values },
    autoExposeSystemEnvs: true,
    sensitiveMetadataVerified: secretNames.every((n) => states[n] === 'matching'),
    sensitiveMetadataAbsent: secretNames.every((n) => states[n] === 'absent'),
    missingPublic: missing,
    fingerprint: hash(JSON.stringify(states)),
    metadata,
  };
}

export function publicConfigApiArguments(method, kind, id = null) {
  if (!(
    (method === 'GET' && ['project', 'envs'].includes(kind)) ||
    (method === 'POST' && kind === 'envs') ||
    (['PATCH', 'DELETE'].includes(method) &&
      kind === 'entry' &&
      typeof id === 'string' &&
      /^[A-Za-z0-9_-]{1,128}$/.test(id))
  ))
    fail();
  const path =
    kind === 'project'
      ? `/v9/projects/${projectId}?teamId=${teamId}`
      : `/${kind === 'entry' ? 'v9' : 'v10'}/projects/${projectId}/env${kind === 'entry' ? '/' + id : ''}?teamId=${teamId}` +
        (method === 'GET' ? '&decrypt=false' : '');
  return [
    'api',
    path,
    '--method',
    method,
    ...(['POST', 'PATCH'].includes(method)
      ? ['--input', '-', '--yes']
      : method === 'DELETE'
        ? ['--yes']
        : []),
    '--scope',
    'muhammed-abdelrahman',
    '--raw',
    '--non-interactive',
    '--no-color',
  ];
}
const endpoint = (kind) => publicConfigApiArguments('GET', kind)[1];
async function inspect(packet, ports, phase = 'delivery') {
  let p, e;
  try {
    p = await ports.request('GET', endpoint('project'), null);
    e = await ports.request('GET', endpoint('envs'), null);
  } catch (error) {
    fail(error?.message === 'GW01_PUBLIC_CONFIG_CLOSE' ? 'CLOSE' : 'NATIVE');
  }
  return inspectPublicConfiguration(packet, p, e, phase);
}
const iso = (v) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(Date.parse(v)).toISOString() === v;
function proofCheck(proof) {
  if (
    !exact(proof, ['version', 'environmentReceipt', 'environmentLedger', 'writerCloseReceipt']) ||
    proof.version !== 1
  )
    fail('OWNERSHIP');
}
function environmentProof(proof) {
  proofCheck(proof);
  const r = proof.environmentReceipt,
    l = proof.environmentLedger;
  if (
    !exact(r, [
      'version',
      'mode',
      'status',
      'code',
      'privacyStage',
      'privacyParameterDiagnostic',
      'privateRead',
      'rootChildClosed',
      'nativeExit',
      'handoffsRetained',
      'delivery',
    ]) ||
    r.version !== 1 ||
    r.mode !== 'Environment' ||
    r.status !== 'complete' ||
    r.code !== null ||
    r.privacyStage !== null ||
    r.privacyParameterDiagnostic !== null ||
    r.privateRead !== true ||
    r.rootChildClosed !== true ||
    r.nativeExit !== 0 ||
    typeof r.handoffsRetained !== 'boolean' ||
    !exact(r.delivery, [
      'version',
      'status',
      'mode',
      'managementRequests',
      'vercelCommands',
      'branch',
      'previewOnly',
    ]) ||
    r.delivery.version !== 1 ||
    r.delivery.status !== 'complete' ||
    r.delivery.mode !== 'Environment' ||
    r.delivery.managementRequests !== 0 ||
    r.delivery.vercelCommands !== 2 ||
    r.delivery.branch !== branch ||
    r.delivery.previewOnly !== true
  )
    fail('OWNERSHIP');
  if (
    !Array.isArray(l) ||
    l.length !== 3 ||
    !exact(l[0], ['version', 'kind', 'windowId', 'projectId', 'branch', 'createdAt']) ||
    l[0].version !== 1 ||
    l[0].kind !== 'environment_intent' ||
    l[0].windowId !== windowId ||
    l[0].projectId !== projectId ||
    l[0].branch !== branch ||
    !iso(l[0].createdAt) ||
    !secretNames.every(
      (name, i) =>
        exact(l[i + 1], ['kind', 'name']) &&
        l[i + 1].kind === 'environment_delivered' &&
        l[i + 1].name === name,
    )
  )
    fail('OWNERSHIP');
  return { at: Date.parse(l[0].createdAt), fingerprint: hash(JSON.stringify({ receipt: r, ledger: l })) };
}
function closedProof(proof) {
  proofCheck(proof);
  const r = proof.writerCloseReceipt,
    s = r?.result,
    w = s?.window;
  if (
    !exact(r, [
      'version',
      'mode',
      'status',
      'privateRead',
      'rootChildClosed',
      'handoffRetained',
      'nativeExit',
      'result',
    ]) ||
    r.version !== 1 ||
    r.mode !== 'Close' ||
    r.status !== 'complete' ||
    r.privateRead !== true ||
    r.rootChildClosed !== true ||
    r.nativeExit !== 0 ||
    typeof r.handoffRetained !== 'boolean' ||
    !exact(s, [
      'version',
      'status',
      'mode',
      'code',
      'identity',
      'authorizationDenials',
      'window',
      'connectionClosed',
    ]) ||
    s.version !== 1 ||
    s.status !== 'complete' ||
    s.mode !== 'Close' ||
    s.code !== null ||
    s.connectionClosed !== true ||
    !Number.isInteger(s.authorizationDenials) ||
    s.authorizationDenials < 0 ||
    s.authorizationDenials > 4 ||
    !exact(s.identity, ['currentUser', 'sessionUser', 'database', 'projectRef']) ||
    s.identity.currentUser !== 'n8n_writer' ||
    s.identity.sessionUser !== 'n8n_writer' ||
    s.identity.database !== 'postgres' ||
    s.identity.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    !exact(w, [
      'id',
      'startsAt',
      'expiresAt',
      'closed',
      'totalAdmitted',
      'boundAudience',
      'boundCommitSha',
      'boundDeploymentId',
    ]) ||
    w.id !== windowId ||
    w.closed !== true ||
    !Number.isInteger(w.totalAdmitted) ||
    w.totalAdmitted < 0 ||
    w.totalAdmitted > 100
  )
    fail('CLOSED');
  if (
    (w.startsAt === null) !== (w.expiresAt === null) ||
    (w.startsAt !== null && (!iso(w.startsAt) || !iso(w.expiresAt)))
  )
    fail('CLOSED');
  if (
    w.boundAudience === null
      ? w.boundCommitSha !== null || w.boundDeploymentId !== null
      : !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(w.boundAudience) ||
        !/^[a-f0-9]{40}$/.test(w.boundCommitSha) ||
        !/^dpl_[A-Za-z0-9]{16,80}$/.test(w.boundDeploymentId)
  )
    fail('CLOSED');
}
function sameMetadata(a, b) {
  return (
    object(a) &&
    object(b) &&
    ['key', 'id', 'createdAt', 'type', 'gitBranch'].every((key) => a[key] === b[key]) &&
    JSON.stringify(a.target) === JSON.stringify(b.target)
  );
}
async function closeConfiguration(mode, packet, ports, events, binding) {
  closedProof(ports.proof);
  const own = events?.filter((e) => e.kind === 'public_created' && e.metadata?.key === enabledName);
  if (!own || own.length !== 1) fail('OWNERSHIP');
  const get = () => inspect(packet, ports, 'closeout');
  let current = await get();
  if (!sameMetadata(own[0].metadata, current.metadata[enabledName])) fail('OWNERSHIP');
  const ownedSecrets = events.filter((e) => e.kind === 'environment_owned');
  if (ownedSecrets.length > 1) fail('OWNERSHIP');
  if (
    ownedSecrets.length &&
    ownedSecrets[0].environmentFingerprint !== environmentProof(ports.proof).fingerprint
  )
    fail('OWNERSHIP');
  for (const name of secretNames)
    if (
      current.metadata[name] &&
      (!ownedSecrets.length || !sameMetadata(ownedSecrets[0].metadata[name], current.metadata[name]))
    )
      fail('OWNERSHIP');
  const append = (event) => {
    const e = { ...event, binding, at: ports.clock() };
    ports.store.append(e);
    events.push(e);
  };
  const has = (kind, name) => events.some((e) => e.kind === kind && (name === undefined || e.key === name));
  const enabled = current.configuration?.values[enabledName];
  if (mode === 'ReconcileCleanup') {
    if (enabled === 'false' && has('disable_intent') && !has('disabled')) append({ kind: 'disabled' });
    for (const name of secretNames)
      if (has('delete_intent', name) && !current.metadata[name] && !has('deleted', name))
        append({ kind: 'deleted', key: name });
  } else if (mode === 'Disable') {
    if (has('disable_intent') || enabled !== 'true') fail('RECONCILE');
    append({ kind: 'disable_intent' });
    try {
      await ports.request('PATCH', publicConfigApiArguments('PATCH', 'entry', own[0].metadata.id)[1], {
        value: 'false',
      });
    } catch (error) {
      fail(error?.message === 'GW01_PUBLIC_CONFIG_CLOSE' ? 'CLOSE' : 'NATIVE');
    }
    current = await get();
    if (
      !sameMetadata(own[0].metadata, current.metadata[enabledName]) ||
      current.configuration?.values[enabledName] !== 'false'
    )
      fail('RECONCILE');
    append({ kind: 'disabled' });
  } else {
    if (enabled !== 'false' || !has('disabled')) fail('RECONCILE');
    for (const name of secretNames) {
      if (has('delete_intent', name) && !has('deleted', name)) fail('RECONCILE');
      current = await get();
      if (
        !sameMetadata(own[0].metadata, current.metadata[enabledName]) ||
        current.configuration?.values[enabledName] !== 'false'
      )
        fail('OWNERSHIP');
      for (const key of secretNames)
        if (
          current.metadata[key] &&
          (!ownedSecrets.length || !sameMetadata(ownedSecrets[0].metadata[key], current.metadata[key]))
        )
          fail('OWNERSHIP');
      const row = current.metadata[name];
      if (!row) {
        if (ownedSecrets.length && !has('deleted', name)) fail('OWNERSHIP');
        continue;
      }
      if (!ownedSecrets.length || !sameMetadata(ownedSecrets[0].metadata[name], row) || has('deleted', name))
        fail('OWNERSHIP');
      append({ kind: 'delete_intent', key: name });
      try {
        await ports.request('DELETE', publicConfigApiArguments('DELETE', 'entry', row.id)[1], null);
      } catch (error) {
        fail(error?.message === 'GW01_PUBLIC_CONFIG_CLOSE' ? 'CLOSE' : 'NATIVE');
      }
      current = await get();
      if (current.metadata[name]) fail('RECONCILE');
      append({ kind: 'deleted', key: name });
    }
  }
  const allAbsent = secretNames.every((name) => !current.metadata[name]),
    disabled = current.configuration?.values[enabledName] === 'false';
  return {
    version: 1,
    status: disabled && allAbsent ? 'cleanup_complete' : disabled ? 'disabled' : 'cleanup_pending',
    sourceSha: packet.sourceSha,
    enabledDisabled: disabled,
    sensitiveEntriesAbsent: allAbsent,
    observedAt: new Date(ports.clock()).toISOString(),
  };
}
export async function runPublicConfiguration(mode, packet, ports) {
  packetCheck(packet);
  if (
    !['Plan', 'Apply', 'Reconcile', 'Verify', ...closingModes].includes(mode) ||
    !object(ports) ||
    typeof ports.request !== 'function' ||
    typeof ports.clock !== 'function' ||
    !object(ports.store)
  )
    fail();
  const now = ports.clock();
  if (!Number.isSafeInteger(now) || now < 0) fail();
  const events = ports.store.read(),
    binding = hash(JSON.stringify(packet));
  if (
    events !== null &&
    (!Array.isArray(events) || events.length > 24 || !events.every((e) => object(e) && e.binding === binding))
  )
    fail('RECONCILE');
  if (closingModes.includes(mode)) return closeConfiguration(mode, packet, ports, events, binding);
  const envProof = mode === 'Verify' ? environmentProof(ports.proof) : null;
  if (mode === 'Plan' && events !== null) fail('RECONCILE');
  if (
    mode === 'Apply' &&
    (!events ||
      events.length !== 1 ||
      events[0].kind !== 'plan' ||
      !Number.isSafeInteger(events[0].at) ||
      now < events[0].at ||
      now - events[0].at > 1200000)
  )
    fail('RECONCILE');
  if (mode === 'Reconcile' && (!events || !events.some((e) => e.kind === 'apply_intent'))) fail('RECONCILE');
  const before = await inspect(packet, ports);
  if (['Plan', 'Apply'].includes(mode) && !before.sensitiveMetadataAbsent) fail('CONFLICT');
  if (['Plan', 'Apply'].includes(mode) && !before.missingPublic.includes(enabledName)) fail('CONFLICT');
  if (mode === 'Plan') {
    ports.store.append({
      kind: 'plan',
      binding,
      at: now,
      fingerprint: before.fingerprint,
      sensitiveMetadataAbsent: true,
    });
    return {
      version: 1,
      status: 'planned',
      sourceSha: packet.sourceSha,
      missingPublic: before.missingPublic,
      sensitiveMetadataVerified: before.sensitiveMetadataVerified,
      sensitiveMetadataAbsent: before.sensitiveMetadataAbsent,
      autoExposeSystemEnvs: true,
      observedAt: new Date(now).toISOString(),
    };
  }
  let created = 0,
    current = before;
  if (mode === 'Apply') {
    if (events[0].fingerprint !== before.fingerprint) fail('DRIFT');
    const admissionTime = ports.clock();
    if (!Number.isSafeInteger(admissionTime) || admissionTime < now || admissionTime - events[0].at > 1200000)
      fail('RECONCILE');
    ports.store.append({
      kind: 'apply_intent',
      binding,
      at: admissionTime,
      missingPublic: before.missingPublic,
    });
    const values = publicConfigValues(packet);
    for (const name of before.missingPublic) {
      // Intent is durable before the first POST. A lost response requires only
      // GET reconciliation; Apply can never resume/replay this batch.
      let result;
      try {
        result = await ports.request('POST', publicConfigApiArguments('POST', 'envs')[1], {
          type: 'plain',
          key: name,
          value: values[name],
          target: ['preview'],
          gitBranch: branch,
        });
      } catch (error) {
        fail(error?.message === 'GW01_PUBLIC_CONFIG_CLOSE' ? 'CLOSE' : 'NATIVE');
      }
      if (
        !object(result) ||
        result.error ||
        (result.failed !== undefined && (!Array.isArray(result.failed) || result.failed.length !== 0)) ||
        !object(result.created) ||
        result.created.key !== name
      )
        fail('NATIVE');
      const createdMetadata = inspectPublicConfiguration(
        packet,
        {
          id: projectId,
          accountId: teamId,
          autoExposeSystemEnvs: true,
          rootDirectory: 'apps/web',
          framework: 'nextjs',
          ssoProtection: { deploymentType: 'all_except_custom_domains' },
        },
        { envs: [result.created] },
      ).metadata[name];
      if (
        createdMetadata.createdAt < admissionTime - 5000 ||
        createdMetadata.createdAt > ports.clock() + 5000
      )
        fail('OWNERSHIP');
      ports.store.append({ kind: 'public_created', binding, at: ports.clock(), metadata: createdMetadata });
      created++;
    }
    current = await inspect(packet, ports);
    if (current.missingPublic.length || !current.sensitiveMetadataAbsent) fail('RECONCILE');
    ports.store.append({ kind: 'complete', binding, at: ports.clock() });
  }
  if (mode === 'Verify' && (!current.sensitiveMetadataVerified || current.missingPublic.length))
    fail('RECONCILE');
  if (mode === 'Verify') {
    if (
      !events?.some((e) => e.kind === 'plan' && e.sensitiveMetadataAbsent === true) ||
      !events.some((e) => e.kind === 'complete')
    )
      fail('OWNERSHIP');
    const metadata = Object.fromEntries(secretNames.map((name) => [name, current.metadata[name]]));
    if (
      secretNames.some(
        (name) =>
          metadata[name].createdAt < envProof.at - 5000 ||
          metadata[name].createdAt > envProof.at + 95000 ||
          metadata[name].createdAt > ports.clock() + 5000,
      )
    )
      fail('OWNERSHIP');
    const existing = events.filter((e) => e.kind === 'environment_owned');
    if (
      existing.length > 1 ||
      (existing.length === 1 &&
        (existing[0].environmentFingerprint !== envProof.fingerprint ||
          secretNames.some((name) => !sameMetadata(existing[0].metadata[name], metadata[name]))))
    )
      fail('OWNERSHIP');
    if (!existing.length)
      ports.store.append({
        kind: 'environment_owned',
        binding,
        at: ports.clock(),
        provenance: 'recovered_get_after_native_environment',
        environmentFingerprint: envProof.fingerprint,
        metadata,
      });
  }
  const status = current.missingPublic.length
    ? 'incomplete'
    : current.sensitiveMetadataVerified
      ? 'verified'
      : 'public_ready';
  return {
    version: 1,
    status,
    projectId,
    teamId,
    sourceSha: packet.sourceSha,
    configuration: current.configuration,
    autoExposeSystemEnvs: true,
    sensitiveMetadataVerified: current.sensitiveMetadataVerified,
    sensitiveMetadataAbsent: current.sensitiveMetadataAbsent,
    missingPublic: current.missingPublic,
    createdControls: created,
    observedAt: new Date(ports.clock()).toISOString(),
  };
}

const osEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
export function nativePublicConfigRequest(cli, method, path, body, dependencies = {}) {
  const entryId =
    ['PATCH', 'DELETE'].includes(method) && typeof path === 'string'
      ? path.split('/env/')[1]?.split('?')[0]
      : null;
  const kind =
    path === endpoint('project')
      ? 'project'
      : entryId && path === publicConfigApiArguments(method, 'entry', entryId)[1]
        ? 'entry'
        : path === publicConfigApiArguments(method, 'envs')[1]
          ? 'envs'
          : null;
  if (kind === null) fail();
  const args = publicConfigApiArguments(method, kind, entryId);
  if (method === 'PATCH' && (!exact(body, ['value']) || body.value !== 'false')) fail();
  if (method === 'DELETE' && body !== null) fail();
  if (
    method === 'POST' &&
    (!exact(body, ['type', 'key', 'value', 'target', 'gitBranch']) ||
      body.type !== 'plain' ||
      !Object.keys(
        publicConfigValues({ version: 1, projectId, teamId, branch, sourceSha: 'a'.repeat(40) }),
      ).includes(body.key) ||
      body.gitBranch !== branch ||
      !Array.isArray(body.target) ||
      body.target.length !== 1 ||
      body.target[0] !== 'preview' ||
      typeof body.value !== 'string' ||
      body.value.length > 100)
  )
    fail();
  if (method === 'POST') {
    const known = publicConfigValues({ version: 1, projectId, teamId, branch, sourceSha: 'a'.repeat(40) });
    if (
      body.key === 'EMR_WORKER_GATEWAY_COMMIT_SHA'
        ? !/^[a-f0-9]{40}$/.test(body.value)
        : body.value !== known[body.key]
    )
      fail();
  }
  return new Promise((done, reject) => {
    let child,
      closed = false,
      settled = false,
      failed = false,
      closeTimer,
      size = 0;
    const chunks = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      let value;
      try {
        if (!closed || failed) fail('NATIVE');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        value = method === 'DELETE' && !text.trim() ? { deleted: true } : JSON.parse(text);
        if (!object(value) || value.error) fail('NATIVE');
      } catch {
        failed = true;
      }
      for (const bytes of chunks) bytes.fill(0);
      if (failed) reject(Error(closed ? 'GW01_PUBLIC_CONFIG_NATIVE' : 'GW01_PUBLIC_CONFIG_CLOSE'));
      else done(value);
    };
    const stop = () => {
      failed = true;
      try {
        child?.kill('SIGKILL');
      } catch {}
      if (!closeTimer) closeTimer = setTimeout(finish, dependencies.closeTimeoutMs ?? 5000);
    };
    const timer = setTimeout(stop, dependencies.timeoutMs ?? 15000);
    try {
      const env = osEnvironment();
      env.VERCEL_TELEMETRY_DISABLED = '1';
      env.NO_UPDATE_NOTIFIER = '1';
      env.CI = '1';
      child = (dependencies.spawn ?? spawn)(
        process.execPath,
        ['--import', new URL('./gw01-vercel-no-retry.mjs', import.meta.url).href, cli, ...args],
        {
          env,
          stdio: ['pipe', 'pipe', 'ignore'],
          windowsHide: true,
        },
      );
      child.stdout.on('data', (chunk) => {
        if (settled || failed) return;
        size += chunk.length;
        if (size > 1048576) {
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
      child.stdin.end(['POST', 'PATCH'].includes(method) ? JSON.stringify(body) : undefined);
    } catch {
      if (child === undefined) {
        closed = true;
        failed = true;
        finish();
      } else stop();
    }
  });
}

function safePath(path) {
  let cursor = resolve(path);
  for (;;) {
    if (lstatSync(cursor).isSymbolicLink()) fail('PREFLIGHT');
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolve(path);
}
function json(path, max = 524288) {
  const p = safePath(path),
    s = lstatSync(p);
  if (!s.isFile() || s.size > max) fail('PREFLIGHT');
  return JSON.parse(readFileSync(p, 'utf8'));
}
function storeAt(root) {
  const file = join(safePath(root), 'gw01-public-config.jsonl');
  return {
    read: () => {
      try {
        lstatSync(file);
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
      }
      const s = lstatSync(safePath(file));
      if (!s.isFile() || s.size > 16384) fail('PREFLIGHT');
      const text = readFileSync(file, 'utf8');
      if (!text.endsWith('\n')) fail('PREFLIGHT');
      return text
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
    },
    append: (event) => {
      let exists = true;
      try {
        lstatSync(file);
      } catch (error) {
        if (error?.code === 'ENOENT') exists = false;
        else throw error;
      }
      if (exists) safePath(file);
      const fd = openSync(file, exists ? 'a' : 'wx', 0o600);
      try {
        writeSync(fd, JSON.stringify(event) + '\n');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    },
  };
}
function publicPreflight(root, mode) {
  const files = [
    'scripts/n8n/gw01-public-config.mjs',
    'scripts/n8n/gw01-vercel-no-retry.mjs',
    'scripts/n8n/gw01-public-config-packet.json',
    'scripts/n8n/gw01-cloud-privacy.json',
    'scripts/n8n/gw01-gateway-seal.json',
  ];
  const seal = json(join(root, 'scripts/n8n/gw01-public-config-seal.json'));
  const proofPath = 'scripts/n8n/gw01-public-config-proof.json';
  if (
    mode === 'Verify' ||
    closingModes.includes(mode) ||
    (mode === 'CheckOnly' && object(seal.files) && Object.hasOwn(seal.files, proofPath))
  )
    files.push(proofPath);
  if (!exact(seal, ['version', 'files']) || seal.version !== 1 || !exact(seal.files, files))
    fail('PREFLIGHT');
  for (const name of files)
    if (
      typeof seal.files[name] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(seal.files[name]) ||
      hash(readFileSync(safePath(join(root, name)))) !== seal.files[name]
    )
      fail('PREFLIGHT');
  const packet = packetCheck(json(join(root, 'scripts/n8n/gw01-public-config-packet.json'))),
    cloud = json(join(root, 'scripts/n8n/gw01-cloud-privacy.json'));
  const proof = files.includes(proofPath) ? json(join(root, proofPath)) : null;
  if (proof !== null) proofCheck(proof);
  if (
    cloud.version !== 1 ||
    cloud.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    cloud.instanceHost !== 'muhhammedsayed.app.n8n.cloud' ||
    ![
      'passed',
      'credentialCanaryVerified',
      'executionCanaryVerified',
      'exportCanaryVerified',
      'logCanaryVerified',
    ].every((k) => cloud[k] === true)
  )
    fail('PREFLIGHT');
  const prior = json(join(root, 'scripts/n8n/gw01-gateway-seal.json')),
    runtime = safePath(join(process.env.APPDATA ?? '', 'npm/node_modules/vercel'));
  if (
    prior.version !== 1 ||
    !object(prior.vercelFiles) ||
    json(join(runtime, 'package.json')).version !== '56.5.0'
  )
    fail('PREFLIGHT');
  const runtimeFiles = ['package.json'],
    pending = [safePath(join(runtime, 'dist'))];
  let count = 0;
  while (pending.length)
    for (const name of readdirSync(pending.pop(), { withFileTypes: true })) {
      if (++count > 10000) fail('PREFLIGHT');
      const path = join(name.parentPath, name.name),
        s = lstatSync(path);
      if (s.isSymbolicLink()) fail('PREFLIGHT');
      if (s.isDirectory()) pending.push(path);
      else if (/\.(js|mjs|cjs|json|wasm)$/.test(name.name)) {
        runtimeFiles.push(path.slice(runtime.length + 1).replaceAll('\\', '/'));
        if (runtimeFiles.length > 2000) fail('PREFLIGHT');
      }
    }
  if (!runtimeFiles.includes('dist/index.js') || !exact(prior.vercelFiles, runtimeFiles)) fail('PREFLIGHT');
  for (const name of runtimeFiles)
    if (
      typeof prior.vercelFiles[name] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(prior.vercelFiles[name]) ||
      hash(readFileSync(safePath(join(runtime, name)))) !== prior.vercelFiles[name]
    )
      fail('PREFLIGHT');
  return { packet, cli: join(runtime, 'dist/index.js'), proof };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out, lock, lockFile;
  try {
    if (
      process.argv.length !== 3 ||
      !['CheckOnly', 'Plan', 'Apply', 'Reconcile', 'Verify', ...closingModes].includes(process.argv[2])
    )
      fail();
    const root = safePath(resolve('.')),
      ready = publicPreflight(root, process.argv[2]);
    if (process.argv[2] === 'CheckOnly')
      out = { version: 1, status: 'check_only_ready', privateRead: false, networkRequests: 0 };
    else {
      const directory = safePath(join(root, 'scripts/n8n/out/gw01'));
      lockFile = join(directory, 'gw01-public-config.lock');
      try {
        lock = openSync(lockFile, 'wx', 0o600);
      } catch {
        fail('RECONCILE');
      }
      out = await runPublicConfiguration(process.argv[2], ready.packet, {
        clock: () => Date.now(),
        store: storeAt(directory),
        proof: ready.proof,
        request: (method, path, body) => nativePublicConfigRequest(ready.cli, method, path, body),
      });
    }
  } catch (error) {
    out = {
      version: 1,
      status: 'stopped_reconcile',
      code: /^GW01_PUBLIC_CONFIG_(INPUT|PROJECT|RESPONSE|CONFLICT|NATIVE|CLOSE|RECONCILE|DRIFT|PREFLIGHT|OWNERSHIP|CLOSED)$/.test(
        error?.message ?? '',
      )
        ? error.message
        : 'GW01_PUBLIC_CONFIG_REJECTED',
    };
  } finally {
    if (lock !== undefined) {
      try {
        closeSync(lock);
        unlinkSync(lockFile);
      } catch {
        out = { version: 1, status: 'stopped_reconcile', code: 'GW01_PUBLIC_CONFIG_CLEANUP' };
      }
    }
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode = [
    'check_only_ready',
    'planned',
    'public_ready',
    'verified',
    'disabled',
    'cleanup_complete',
  ].includes(out.status)
    ? 0
    : 1;
}
