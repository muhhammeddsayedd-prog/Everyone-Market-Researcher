// Complete isolated synthetic authority fixture. Never imports or reads actual journals.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const digest = (text) => createHash('sha256').update(text).digest('hex');
export async function syntheticStartupReplacement({ approved = true, cleanupFault } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-startup-synthetic-'));
  const put = (path, text) => {
    const p = join(directory, path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    return p;
  };
  const snapshot = JSON.parse(
    readFileSync(
      join(
        sourceRoot,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json',
      ),
      'utf8',
    ),
  );
  const cleanedLeaves = [
    'emr-m03-acceptance-management.dpapi',
    'emr-m03-acceptance-management.lease.json',
    'emr-m03-acceptance-writer.dpapi',
    'emr-m03-acceptance-writer.lease.json',
    'emr-m03-acceptance-apifyread.dpapi',
    'emr-m03-acceptance-apifyread.lease.json',
    'emr-m03-acceptance-protection-bypass.dpapi',
    'emr-m03-acceptance-parent.operation.lock',
    'runtime.operation.lock',
  ];
  for (const path of Object.keys(snapshot.preserved)) {
    let record = { syntheticPublicRecord: path };
    if (path.endsWith('dev-acceptance-postcheck-attempt-20261021.json'))
      record = { clock: { parentProcessId: 123456, runtimeProcessId: 123457 } };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.intent.json'))
      record = {
        kind: 'm03_remaining_exact_temporary_cleanup_intent',
        version: 1,
        segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
        createdAtUtc: '2026-10-21T23:26:01.000Z',
        targets: cleanedLeaves,
        projectedProcessSnapshot: [],
        privateContentsRead: false,
        networkRequests: 0,
        childProcessesStarted: 0,
        unknownOrphanClosureProven: false,
      };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.result.json'))
      record = {
        kind: 'm03_remaining_exact_temporary_cleanup_result',
        version: 1,
        segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
        status: 'exact_nine_leaves_removed',
        deleted: cleanedLeaves,
        observedAtUtc: '2026-10-21T23:26:05.000Z',
        privateContentsRead: false,
        networkRequests: 0,
        childProcessesStarted: 0,
        adminPairPreserved: true,
        machineAndAdmissionsPreserved: true,
        unknownOrphanClosureProven: false,
        fullD: false,
      };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.result.json')) {
      if (cleanupFault === 'overclaimed-orphans') record.unknownOrphanClosureProven = true;
      if (cleanupFault === 'incomplete-leaves') record.deleted = cleanedLeaves.slice(1);
      if (cleanupFault === 'private-read') record.privateContentsRead = true;
    }
    const text = JSON.stringify(record) + '\n';
    put(path, text);
    snapshot.preserved[path] = digest(text);
  }
  const header = {
    event: 'management_header',
    version: 1,
    sourceCommitSha: snapshot.applicationSource,
    deadlineAt: snapshot.originalDeadlineAt,
  };
  const management =
    JSON.stringify(header) + '\n' + JSON.stringify({ event: 'management_attempt', ordinal: 1 }) + '\n';
  const control = Array.from({ length: 150 }, (_, i) => ({
    event: 'control_request_intent',
    ordinal: i + 1,
    kind: 'discovery',
    at: '2026-10-21T18:40:52.488Z',
  }))
    .map((r) => JSON.stringify(r) + '\n')
    .join('');
  const setup = JSON.stringify({ event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 }) + '\n';
  for (const [name, text] of Object.entries({ management, control, setup })) {
    put(snapshot.journals[name].path, text);
    snapshot.journals[name].sha256 = digest(text);
  }
  const checkpointText = JSON.stringify(snapshot) + '\n';
  const checkpointPath =
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json';
  const packetPath =
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-packet-20261022.md';
  const packetText = 'Explicit synthetic proposed acceptance packet only.\n';
  put(checkpointPath, checkpointText);
  put(packetPath, packetText);
  const approval = {
    kind: 'm03_startup_replacement_approval',
    version: 1,
    segmentId: snapshot.proposedSegmentId,
    applicationSource: snapshot.applicationSource,
    originalWindowId: snapshot.windowId,
    ownerReply: 'SYNTHETIC TEST ONLY',
    recordedAtUtc: '2026-10-22T00:00:00.000Z',
    reviewedPacketRelative: packetPath,
    reviewedPacketSha256: digest(packetText),
    checkpointRelative: checkpointPath,
    checkpointSha256: digest(checkpointText),
    singleSegmentNoAutomaticRenewal: true,
    preserveHistoricalHeadersAndCounters: true,
    noMigrationReplay: true,
    caps: {
      durationMinutes: 60,
      stopNewWorkMinute: 50,
      physicalCloseMinute: 70,
      leaseCoverageMinute: 75,
      runtimeManagement: 512,
      control: 2048,
      combined: 2560,
      nativeExecutions: 120,
      gatewayAttempts: 256,
      providerGetAttempts: 32,
      actorStarts: 2,
      requestedUsdEachActor: 1,
      actorReserveUsd: 2,
      uniquePublishedDependencies: 7,
      publicationActions: 8,
    },
  };
  const approvalText = JSON.stringify(approval) + '\n';
  if (approved)
    put(
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-approval-20261022.json',
      approvalText,
    );
  let source = readFileSync(join(sourceRoot, 'scripts/n8n/foundation-live-startup-replacement.mjs'), 'utf8');
  source = source
    .replace(
      /approvalSha256: (?:null|'[a-f0-9]{64}')/,
      `approvalSha256: ${approved ? JSON.stringify(digest(approvalText)) : 'null'}`,
    )
    .replace(/packetSha256: (?:null|'[a-f0-9]{64}')/, `packetSha256: '${digest(packetText)}'`)
    .replace(/checkpointSha256: (?:null|'[a-f0-9]{64}')/, `checkpointSha256: '${digest(checkpointText)}'`);
  const modulePath = put('scripts/n8n/foundation-live-startup-replacement.mjs', source);
  const module = await import(pathToFileURL(modulePath).href);
  const localAppData = join(directory, 'synthetic-localappdata');
  put(
    'synthetic-localappdata/Temp/' + module.foundationStartupReplacementCheckpoint.parentLockFilename,
    JSON.stringify({
      kind: 'm03_clock_admission_parent',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      processId: process.ppid,
    }) + '\n',
  );
  let time = Date.parse('2026-10-22T01:00:00.000Z');
  const now = () => time,
    io = { processAlive: () => false };
  const scoped = (run) => {
    const existed = Object.hasOwn(process.env, 'LOCALAPPDATA'),
      prior = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = localAppData;
    try {
      return run();
    } finally {
      if (existed) process.env.LOCALAPPDATA = prior;
      else delete process.env.LOCALAPPDATA;
    }
  };
  const copied = new Map();
  const copy = (name) => {
    if (copied.has(name)) return copied.get(name);
    const loading = (async () => {
      const relativePath =
        name === 'foundation-admin-client.mjs' ? 'scripts/db/' + name : 'scripts/n8n/' + name;
      const sourcePath = join(sourceRoot, relativePath);
      let text = readFileSync(sourcePath, 'utf8');
      for (const [match, relative] of [...text.matchAll(/from '(\.\.?\/[^']+)'/g)]) {
        const base = relative.split('/').at(-1);
        let url;
        if (base === 'foundation-live-startup-replacement.mjs') url = pathToFileURL(modulePath).href;
        else if (
          [
            'foundation-live-runtime.mjs',
            'foundation-control-state.mjs',
            'foundation-live-setup.mjs',
          ].includes(base)
        ) {
          await copy(base);
          url = pathToFileURL(join(directory, 'scripts/n8n', base)).href;
        } else url = pathToFileURL(join(dirname(sourcePath), relative)).href;
        text = text.replaceAll(match, `from '${url}'`);
      }
      return import(pathToFileURL(put(relativePath, text)).href);
    })();
    copied.set(name, loading);
    return loading;
  };
  return {
    directory,
    module,
    snapshot,
    checkpoint: module.foundationStartupReplacementCheckpoint,
    now,
    io,
    put,
    localAppData,
    scoped,
    copy,
    paths: {
      management: join(directory, snapshot.journals.management.path),
      control: join(directory, snapshot.journals.control.path),
      setup: join(directory, snapshot.journals.setup.path),
      admission: join(directory, module.foundationStartupReplacementCheckpoint.admissionRelative),
      claim: join(directory, module.foundationStartupReplacementCheckpoint.claimRelative),
    },
    setTime: (t) => {
      time = t;
    },
    check: () => scoped(() => module.verifyFoundationStartupReplacement({ now }, io)),
    admit: () => scoped(() => module.admitFoundationStartupReplacement({ now }, io)),
    read: () => scoped(() => module.readFoundationStartupReplacement({ now }, io)),
    readClaimed: () => scoped(() => module.readClaimedFoundationStartupReplacement({ now }, io)),
    claim: (p) => scoped(() => module.claimFoundationStartupReplacement(p, { now }, io)),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
