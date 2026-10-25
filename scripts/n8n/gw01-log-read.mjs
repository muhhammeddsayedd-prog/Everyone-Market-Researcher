import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayLogArguments, scanGatewayLogs } from './gw01-gateway-logs.mjs';
import { createTrialCoordinator } from './gw01-trial.mjs';

const expectedPacket = Object.freeze({
  version: 1,
  windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  requestId: '80162039-6088-4011-bdf1-a2a7b5ec11cb',
  attemptId: '66233386-4962-44fe-b499-df973fde25c9',
  reservedAt: 1792313741664,
  finishedAt: 1792313742950,
  httpStatus: 503,
});
const placeholder = 'GW01_PUBLIC_LOG_READ_PLACEHOLDER_PROTECTION';
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((key) => keys.includes(key));
const fail = () => {
  throw Error('GW01_LOG_READ_INPUT');
};

/** Read-only reconciliation of one already-finished probe. snapshot() is the
 * existing complete journal validator; no coordinator write method is called. */
export function readLogReadContext(directory, packet, preview, config) {
  try {
    if (
      !exact(packet, Object.keys(expectedPacket)) ||
      Object.keys(expectedPacket).some((key) => packet[key] !== expectedPacket[key]) ||
      preview?.routeDisabledVerified !== false
    )
      fail();
    const since = new Date(packet.reservedAt - 5000).toISOString(),
      until = new Date(packet.finishedAt + 5000).toISOString();
    gatewayLogArguments({ preview, requestId: packet.requestId, since, until, protection: placeholder });
    const file = join(directory, 'gw01-trial.jsonl'),
      stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) fail();
    const before = readFileSync(file, 'utf8');
    createTrialCoordinator(directory, config).snapshot();
    if (readFileSync(file, 'utf8') !== before || !before.endsWith('\n')) fail();
    const events = before
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line));
    const reserved = events.filter((e) => e.type === 'reserved' && e.attemptId === packet.attemptId),
      finished = events.filter((e) => e.type === 'finished' && e.attemptId === packet.attemptId);
    if (reserved.length !== 1 || finished.length !== 1) fail();
    const r = reserved[0],
      f = finished[0];
    if (
      r.requestId !== packet.requestId ||
      r.at !== packet.reservedAt ||
      r.operation !== 'identity.read' ||
      r.kind !== 'preflight' ||
      r.audience !== preview.audience ||
      f.at !== packet.finishedAt ||
      f.seq <= r.seq ||
      f.outcome !== 'http' ||
      f.httpStatus !== 503 ||
      events.filter((e) => e.type === 'reserved' && e.requestId === packet.requestId).length !== 1
    )
      fail();
    return {
      preview: structuredClone(preview),
      requestId: packet.requestId,
      attemptId: packet.attemptId,
      since,
      until,
    };
  } catch {
    fail();
  }
}

export async function runLogRead(context, protection, dependencies = {}) {
  const out = {
    version: 1,
    status: 'unverified',
    code: 'GW01_LOG_READ_INPUT',
    requestId: expectedPacket.requestId,
    attemptId: expectedPacket.attemptId,
    since: new Date(expectedPacket.reservedAt - 5000).toISOString(),
    until: new Date(expectedPacket.finishedAt + 5000).toISOString(),
    gatewayRequests: 0,
    logCliInvocations: 0,
    logScan: null,
  };
  try {
    if (
      !exact(context, ['preview', 'requestId', 'attemptId', 'since', 'until']) ||
      context.requestId !== expectedPacket.requestId ||
      context.attemptId !== expectedPacket.attemptId ||
      context.since !== new Date(expectedPacket.reservedAt - 5000).toISOString() ||
      context.until !== new Date(expectedPacket.finishedAt + 5000).toISOString()
    )
      fail();
    const value = {
      preview: context.preview,
      requestId: context.requestId,
      since: context.since,
      until: context.until,
      protection,
    };
    gatewayLogArguments(value);
    out.logCliInvocations = 1;
    out.logScan = await scanGatewayLogs(value, dependencies);
    out.code = out.logScan.code;
    if (out.logScan.status === 'verified') out.status = 'verified';
  } catch {
    out.code = 'GW01_LOG_READ_INPUT';
  }
  // Scanner output is closed metadata, but retain a final private reflection
  // guard in this credential-bearing process. Never emit a caught error.
  if (typeof protection === 'string' && protection && JSON.stringify(out).includes(protection)) {
    out.status = 'unverified';
    out.code = 'GW01_LOG_READ_REFLECTION';
    out.logScan = null;
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out;
  try {
    if (process.argv.length !== 3 || !['--check-public', '--private-log-read'].includes(process.argv[2]))
      fail();
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 4096) fail();
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!exact(value, ['protection'])) fail();
    const json = (path) => {
      const s = lstatSync(path);
      if (!s.isFile() || s.isSymbolicLink() || s.size > 65536) fail();
      return JSON.parse(readFileSync(path, 'utf8'));
    };
    const context = readLogReadContext(
      resolve('scripts/n8n/out/gw01'),
      json('scripts/n8n/gw01-log-read-packet.json'),
      json('scripts/n8n/gw01-reviewed-preview.json'),
      json('scripts/n8n/gw01-trial-config.json'),
    );
    gatewayLogArguments({
      preview: context.preview,
      requestId: context.requestId,
      since: context.since,
      until: context.until,
      protection: value.protection,
    });
    if (process.argv[2] === '--check-public') {
      if (value.protection !== placeholder) fail();
      out = {
        version: 1,
        status: 'public_ready',
        gatewayRequests: 0,
        logCliInvocations: 0,
        privateRead: false,
      };
    } else out = await runLogRead(context, value.protection);
  } catch {
    out = { version: 1, status: 'unverified', code: 'GW01_LOG_READ_INPUT' };
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode = ['public_ready', 'verified'].includes(out.status) ? 0 : 1;
}
