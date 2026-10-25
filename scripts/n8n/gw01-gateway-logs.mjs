import { spawn } from 'node:child_process';
import { join } from 'node:path';

const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const iso = (v) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(Date.parse(v)).toISOString() === v;
const reject = () => {
  throw Error('GW01_LOGS_INPUT');
};
export function gatewayLogArguments(value) {
  if (!exact(value, ['preview', 'requestId', 'since', 'until', 'protection'])) reject();
  const p = value.preview;
  if (
    !exact(p, [
      'version',
      'projectId',
      'teamId',
      'branch',
      'commitSha',
      'deploymentId',
      'audience',
      'target',
      'protection',
      'routeDisabledVerified',
    ]) ||
    p.version !== 1 ||
    p.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    p.teamId !== 'team_gboXPxTevpCOZuaA8eY9PmR1' ||
    p.branch !== 'm03-n8n-foundation' ||
    p.target !== 'preview' ||
    p.protection !== 'all_except_custom_domains' ||
    typeof p.routeDisabledVerified !== 'boolean' ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(p.deploymentId) ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(p.audience) ||
    !/^[a-f0-9]{40}$/.test(p.commitSha) ||
    typeof value.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(value.requestId) ||
    !iso(value.since) ||
    !iso(value.until) ||
    Date.parse(value.until) <= Date.parse(value.since) ||
    Date.parse(value.until) - Date.parse(value.since) > 120000 ||
    typeof value.protection !== 'string' ||
    !/^[A-Za-z0-9_-]{32,512}$/.test(value.protection)
  )
    reject();
  // Pinned56.5.0 uses direct JSONL RequestLog objects. Do not substitute the
  // newer webdocs' {type,data}/summary format or stream an implicit deployment.
  return [
    'logs',
    '--deployment',
    p.deploymentId,
    '--project',
    p.projectId,
    '--scope',
    'muhammed-abdelrahman',
    '--environment',
    'preview',
    '--since',
    value.since,
    '--until',
    value.until,
    '--limit',
    '100',
    '--json',
    '--non-interactive',
    '--no-color',
  ];
}
function runLogs(args, dependencies) {
  const start = dependencies.spawn ?? spawn;
  return new Promise((done) => {
    let child,
      closed = false,
      settled = false,
      code = null,
      size = 0,
      closeTimer;
    const chunks = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      let text = null;
      if (closed && code === null) {
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        } catch {
          code = 'GW01_LOGS_RESPONSE';
        }
      }
      for (const bytes of chunks) bytes.fill(0);
      done({ text, childClosed: closed, code: closed ? code : 'GW01_LOGS_CLOSE' });
    };
    const stop = (reason) => {
      if (code === null) code = reason;
      try {
        child?.kill('SIGKILL');
      } catch {}
      if (!closeTimer) closeTimer = setTimeout(finish, dependencies.closeTimeoutMs ?? 5000);
    };
    const timer = setTimeout(() => stop('GW01_LOGS_TIMEOUT'), dependencies.timeoutMs ?? 15000);
    try {
      const environment = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
          (k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]]),
        ),
      );
      environment.CI = '1';
      environment.VERCEL_TELEMETRY_DISABLED = '1';
      environment.NO_UPDATE_NOTIFIER = '1';
      // Use the sealed JS entry directly. vc.js can spawn an optional native
      // grandchild whose lifecycle would not be owned by this narrow scanner.
      const cli =
        dependencies.cliPath ?? join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/index.js');
      child = start(process.execPath, [cli, ...args], {
        env: environment,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      child.stdout.on('data', (chunk) => {
        if (settled || code !== null) return;
        size += chunk.length;
        if (size > 1048576) {
          stop('GW01_LOGS_TRUNCATED');
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      child.stdout.on('error', () => stop('GW01_LOGS_NATIVE'));
      child.on('error', () => stop('GW01_LOGS_NATIVE'));
      child.on('close', (native) => {
        closed = true;
        if (native !== 0 && code === null) code = 'GW01_LOGS_NATIVE';
        finish();
      });
    } catch {
      if (child === undefined) {
        closed = true;
        code = 'GW01_LOGS_NATIVE';
        finish();
      } else stop('GW01_LOGS_NATIVE');
    }
  });
}
/** Raw platform logs exist only in this bounded process. Captured metadata is
 * required; an empty query proves neither execution nor absence of capture. */
export async function scanGatewayLogs(value, dependencies = {}) {
  const out = {
    version: 1,
    status: 'unverified',
    code: null,
    capturedMatchingRequest: false,
    logsScanned: 0,
    publicAuthMarkerFound: false,
    requestBodyMarkerFound: false,
    ownBypassFound: false,
    truncated: false,
    childClosed: true,
    observedAt: null,
  };
  try {
    const args = gatewayLogArguments(value),
      read = await runLogs(args, dependencies);
    out.childClosed = read.childClosed;
    if (read.code !== null) {
      out.code = read.code;
      return out;
    }
    const text = read.text;
    out.publicAuthMarkerFound = text.includes('GW01_SYNTHETIC_AUTH_CANARY_ONLY');
    out.requestBodyMarkerFound = text.includes(value.requestId);
    out.ownBypassFound = text.includes(value.protection);
    const lines = text.trim() ? text.trim().split(/\r?\n/) : [];
    if (lines.length > 100) reject();
    // The pinned CLI stops at its limit without exposing pagination. Exactly
    // 100 records cannot establish that the full requested window was read.
    if (lines.length === 100) out.truncated = true;
    let decodedNodes = 0;
    const scanString = (entry) => {
      out.publicAuthMarkerFound ||= entry.includes('GW01_SYNTHETIC_AUTH_CANARY_ONLY');
      out.requestBodyMarkerFound ||= entry.includes(value.requestId);
      out.ownBypassFound ||= entry.includes(value.protection);
    };
    for (const line of lines) {
      const row = JSON.parse(line);
      if (row === null || typeof row !== 'object' || Array.isArray(row)) reject();
      out.logsScanned++;
      // JSON escapes can hide a marker from raw substring matching. Scan every
      // decoded key/string iteratively; unknown fields are not safe to ignore.
      const pending = [row];
      while (pending.length) {
        if (++decodedNodes > 100000) reject();
        const entry = pending.pop();
        if (typeof entry === 'string') scanString(entry);
        else if (entry !== null && typeof entry === 'object')
          for (const key of Object.keys(entry)) {
            scanString(key);
            pending.push(entry[key]);
          }
      }
      if (
        row.messageTruncated === true ||
        (Array.isArray(row.logs) && row.logs.some((log) => log?.messageTruncated === true))
      )
        out.truncated = true;
      if (
        row.deploymentId === value.preview.deploymentId &&
        row.projectId === value.preview.projectId &&
        row.domain === new URL(value.preview.audience).hostname &&
        row.environment === 'preview' &&
        row.requestMethod === 'POST' &&
        row.requestPath === '/api/internal/n8n/rpc' &&
        row.responseStatusCode === 503 &&
        Number.isSafeInteger(row.timestamp) &&
        row.timestamp >= Date.parse(value.since) &&
        row.timestamp <= Date.parse(value.until)
      ) {
        out.capturedMatchingRequest = true;
        out.observedAt = new Date(row.timestamp).toISOString();
      }
    }
    if (!out.capturedMatchingRequest) out.code = 'GW01_LOGS_NO_CAPTURE';
    else if (out.truncated) out.code = 'GW01_LOGS_TRUNCATED';
    else if (out.publicAuthMarkerFound || out.requestBodyMarkerFound || out.ownBypassFound)
      out.code = 'GW01_LOGS_REFLECTION';
    else out.status = 'verified';
  } catch {
    out.code = 'GW01_LOGS_RESPONSE';
  }
  return out;
}
