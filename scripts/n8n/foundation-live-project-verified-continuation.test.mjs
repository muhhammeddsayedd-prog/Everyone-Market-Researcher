import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';
import { syntheticStartupReplacement } from './foundation-live-startup-replacement-fixtures.mjs';
import { fixture as liveRuntimeFixture } from './foundation-live-runtime-fixtures.mjs';

test('typed preReady17 permits only sibling18 with unchanged charges and preserved false historical closure flags', async () => {
  const f = await syntheticProjectVerifiedContinuation({ technical17PreReady: true });
  let management;
  try {
    const oldStem = join(
        f.directory,
        'scripts/n8n/out/foundation/live/project-verified-continuation-' +
          f.checkpoint.segmentId +
          '.technical-17',
      ),
      original = ['.json', '.runtime-claim.json', '.closed.json'].map((suffix) =>
        readFileSync(oldStem + suffix, 'utf8'),
      );
    assert.equal(JSON.parse(original[2]).credentialChildrenClosed, false);
    assert.equal(JSON.parse(original[2]).closureVerified, false);
    assert.equal(f.check().managementAttempts, 963);
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.technicalAttemptOrdinal, 18);
    assert.equal(resume.runtimeFilename, 'runtime.technical-18.jsonl');
    assert.equal(resume.aggregateManagementAttempts, 963);
    assert.equal(resume.aggregateControlAttempts, 1094);
    const runtime = await f.copy('foundation-live-runtime.mjs'),
      core = await f.copy('foundation-control-state.mjs');
    let control;
    management = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => control?.snapshot().attempts ?? 1094,
      },
    );
    const journal = core.createFoundationControlJournal({
      previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      durableAppend: (row) => {
        appendFileSync(f.paths.control, JSON.stringify(row) + '\n');
      },
    });
    control = core.createFoundationControlBudget({
      journal,
      now: f.now,
      deadlineAt: proof.deadlineAt,
      projectVerifiedContinuationProof: proof,
      managementAttempts: () => management.snapshot().attempts,
    });
    assert.equal(management.snapshot().attempts, 963);
    assert.equal(management.snapshot().maximum, 1408);
    assert.equal(control.snapshot().attempts, 1094);
    assert.equal(control.snapshot().maximum, 3456);
    assert.deepEqual(
      f.scoped(() => f.module.foundationProjectVerifiedContinuationRequestCaps(proof)),
      { management: 1408, control: 3456, combined: 4864 },
    );
    assert.equal(resume.setupMaximum, 256);
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    for (let i = 0; i < 25; i++) management.admit();
    for (let i = 0; i < 51; i++) control.admit({ kind: 'discovery', workflowId: 'MzimjpsuyPuK7SKe' });
    assert.equal(f.readClaimed().windowId, proof.windowId);
    f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof));
    assert.deepEqual(
      ['.json', '.runtime-claim.json', '.closed.json'].map((suffix) =>
        readFileSync(oldStem + suffix, 'utf8'),
      ),
      original,
    );
    writeFileSync(
      f.paths.control,
      readFileSync(f.paths.control, 'utf8').replace('"ordinal":949', '"ordinal":948'),
    );
    assert.throws(() =>
      f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
    );
  } finally {
    management?.close();
    f.cleanup();
  }
});

test('preReady17 refuses coherently repinned false qualifications, rewritten closure, new outputs and missing history', async () => {
  for (const fault of [
    'raw-closure',
    'raw-wrapper',
    'frame-extra',
    'qualification',
    'usage',
    'claim',
    'cleanup',
    'runtime-output',
    'admin-output',
    'missing',
    'changed',
    'missing-claim',
    'missing-all',
    'live-parent',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      technical17PreReady: true,
      technical17PreReadyFault: fault,
    });
    try {
      const receipt = join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical17-preready-reconciliation-20261025.json',
      );
      if (fault === 'missing') unlinkSync(receipt);
      if (fault === 'changed') appendFileSync(receipt, ' ');
      if (fault === 'missing-claim')
        unlinkSync(
          join(
            f.directory,
            'scripts/n8n/out/foundation/live/project-verified-continuation-' +
              f.checkpoint.segmentId +
              '.technical-17.runtime-claim.json',
          ),
        );
      if (fault === 'missing-all') {
        unlinkSync(receipt);
        for (const suffix of ['.json', '.runtime-claim.json', '.closed.json'])
          unlinkSync(
            join(
              f.directory,
              'scripts/n8n/out/foundation/live/project-verified-continuation-' +
                f.checkpoint.segmentId +
                '.technical-17' +
                suffix,
            ),
          );
      }
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91092;
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, fault);
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, fault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 derives all charged cleanup usage and full25 restored versions only from separately settled16', async () => {
  for (const n of [85, 90]) {
    const f = await syntheticProjectVerifiedContinuation({
      technical16Settled: true,
      technical16CleanupRequests: n,
    });
    try {
      assert.deepEqual(
        Object.fromEntries(
          Object.entries(f.check()).filter(([key]) =>
            ['managementMaximum', 'managementAttempts', 'controlAttempts', 'combinedAttempts'].includes(key),
          ),
        ),
        {
          managementMaximum: 1408,
          managementAttempts: 878 + n,
          controlAttempts: 1009 + n,
          combinedAttempts: 1887 + 2 * n,
        },
      );
      const proof = f.claim(f.admit()),
        resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
      assert.equal(resume.technicalAttemptOrdinal, 17);
      assert.equal(resume.mainManagementAttempts, 810);
      assert.equal(resume.mainControlAttempts, 949);
      assert.equal(proof.carriedManagementAttempts, 68 + n);
      assert.equal(proof.carriedControlAttempts, 60 + n);
      assert.equal(resume.setupAttempts, 184);
      assert.equal(resume.setupMaximum, 256);
      assert.equal(resume.legacySqlAdmitted, 9);
      assert.equal(resume.historicalWindowIds.length, 5);
      assert.equal(resume.settledNativeControlRows, 964);
      assert.deepEqual(
        f.scoped(() => f.module.foundationProjectVerifiedContinuationRequestCaps(proof)),
        { management: 1408, control: 3456, combined: 4864 },
      );
      assert.deepEqual(
        f.scoped(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(proof)),
        { nativeExecutions: 3, gatewayHttpAttempts: 2 },
      );
      assert.equal(
        Object.keys(
          f.scoped(() => f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof)),
        ).length,
        25,
      );
      assert.throws(() => f.module.foundationProjectVerifiedContinuationRequestCaps({ ...proof }));
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 retains every raw retry charge while validating the unchanged logical cleanup operations', async () => {
  for (const kind of ['metadata', 'full', 'workflow', 'discovery']) {
    const f = await syntheticProjectVerifiedContinuation({
      technical16Settled: true,
      technical16CleanupRequests: 86,
      technical16CleanupRetry: kind,
    });
    try {
      assert.equal(f.check().managementAttempts, 964);
      const proof = f.claim(f.admit()),
        resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
      assert.equal(proof.carriedManagementAttempts, 154);
      assert.equal(proof.carriedControlAttempts, 146);
      assert.equal(resume.aggregateManagementAttempts, 964);
      assert.equal(resume.aggregateControlAttempts, 1095);
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 rejects coherently repinned malformed retry links rather than discounting their raw charges', async () => {
  for (const technical16Fault of [
    'retry-string',
    'retry-zero',
    'retry-future',
    'retry-skip',
    'retry-kind',
    'retry-workflow',
    'retry-execution',
    'retry-delete',
    'retry-absence',
    'retry-non-http',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      technical16Settled: true,
      technical16CleanupRequests: 86,
      technical16CleanupRetry: 'metadata',
      technical16Fault,
    });
    try {
      assert.throws(() => f.check(), technical16Fault);
      assert.throws(() => f.admit(), technical16Fault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 rejects a retry chain even when all logical cleanup counts and raw charges remain coherent', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical16Settled: true,
    technical16CleanupRequests: 87,
    technical16CleanupRetry: 'metadata',
    technical16Fault: 'retry-chain',
  });
  try {
    assert.throws(() => f.check());
    assert.throws(() => f.admit());
  } finally {
    f.cleanup();
  }
});

test('technical17 accepts the remaining109 request ceiling and refuses110 without resetting the spent cleanup chain', async () => {
  for (const n of [109, 110]) {
    const f = await syntheticProjectVerifiedContinuation({
      technical16Settled: true,
      technical16CleanupRequests: n,
    });
    try {
      if (n === 109) {
        assert.equal(f.check().managementAttempts, 987);
        assert.equal(f.check().controlAttempts, 1118);
      } else assert.throws(() => f.check());
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 rejects rewritten failed closure, native resets, substituted versions, missing ACKs and broadened caps', async () => {
  for (const technical16Fault of [
    'raw-closure',
    'native-reset',
    'version',
    'ack',
    'counter',
    'acceptance',
    'archive',
    'caps',
    'spent-closure',
    'spent-counter',
    'prior-chain',
    'typed-closure',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ technical16Settled: true, technical16Fault });
    try {
      assert.throws(() => f.check(), technical16Fault);
      assert.throws(() => f.admit(), technical16Fault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 requires the actual final source graph and unpublished state as well as custody version equality', async () => {
  for (const technical16Fault of ['final-graph', 'final-published']) {
    const f = await syntheticProjectVerifiedContinuation({ technical16Settled: true, technical16Fault });
    try {
      assert.throws(() => f.check(), technical16Fault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical17 preserves every charged forensic claim instead of deriving a reset from the latest receipt alone', async () => {
  const f = await syntheticProjectVerifiedContinuation({ technical16Settled: true });
  try {
    const path = join(
      f.directory,
      'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl',
    );
    unlinkSync(path);
    assert.throws(() => f.check(), 'the spent825 claim remains required after829 and cleanup');
  } finally {
    f.cleanup();
  }
});

test('technical17 ReadClaimed preserves the immutable16 prefix while retaining sequential25M51C preflight charges', async () => {
  const f = await syntheticProjectVerifiedContinuation({ technical16Settled: true });
  try {
    const proof = f.claim(f.admit()),
      previousManagement = readFileSync(f.paths.management, 'utf8'),
      previousControl = readFileSync(f.paths.control, 'utf8');
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    appendFileSync(
      f.paths.management,
      Array.from(
        { length: 25 },
        (_, i) => JSON.stringify({ event: 'management_attempt', ordinal: 811 + i }) + '\n',
      ).join(''),
    );
    appendFileSync(
      f.paths.control,
      Array.from(
        { length: 51 },
        (_, i) =>
          JSON.stringify({
            event: 'control_request_intent',
            ordinal: 950 + i,
            kind: 'discovery',
            workflowId: 'MzimjpsuyPuK7SKe',
            at: new Date(proof.startsAt + 1000).toISOString(),
          }) + '\n',
      ).join(''),
    );
    assert.equal(f.readClaimed().windowId, 'edbc6d11-7c1f-43a7-b745-1ded06deb29f');
    assert.doesNotThrow(() =>
      f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
    );
    writeFileSync(
      f.paths.control,
      previousControl.replace('"ordinal":949', '"ordinal":948') +
        readFileSync(f.paths.control, 'utf8').slice(previousControl.length),
    );
    assert.throws(() => f.readClaimed());
    writeFileSync(f.paths.management, previousManagement);
  } finally {
    f.cleanup();
  }
});

test('technical17 allocation stays unavailable until actual16 settlement and archive are independently pinned', async () => {
  const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
  try {
    assert.deepEqual(f.module.foundationProjectVerifiedTechnical17Runtime, {
      windowId: 'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
      sourceCommitSha: 'effa3de9e1fee6c3f3c08fc347a5e3175db14c80',
      sourceCi: 40116191618,
      allFiveCiJobsPassed: true,
      vercelPassed: true,
      setupMaximum: 256,
      proposedSetupMaximum: 256,
    });
    assert.equal(f.check().managementMaximum, 1024, 'historical proof retains its original cap');
    const actual16 =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json';
    f.put(actual16, '{}\n');
    assert.throws(() => f.check(), 'a later actual attempt cannot fall back to sibling16 authority');
    unlinkSync(join(f.directory, actual16));
    const proof = f.claim(f.admit());
    assert.deepEqual(
      f.scoped(() => f.module.foundationProjectVerifiedContinuationRequestCaps(proof)),
      {
        management: 1024,
        control: 2048,
        combined: 2560,
      },
    );
    assert.throws(() =>
      f.module.foundationProjectVerifiedContinuationRequestCaps({
        ...proof,
        managementMaximum: 1408,
        controlMaximum: 3456,
        combinedMaximum: 4864,
      }),
    );
    for (const proof of [{}, { managementMaximum: 1408, controlMaximum: 3456, combinedMaximum: 4864 }])
      assert.throws(() => f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof));
  } finally {
    f.cleanup();
  }
});

test('reconciled unadmitted WF00 carries527/846 and native1 without changing journals or SQL admissions before sibling16', async () => {
  const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
  try {
    const paths = ['management', 'control', 'setup', 'preflight', 'runtime', 'runtime.technical-13'].map(
      (name) => join(f.directory, 'scripts/n8n/out/foundation/live/' + name + '.jsonl'),
    );
    const original = paths.map((path) => readFileSync(path, 'utf8'));
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(f.check()).filter(([key]) =>
          ['managementMaximum', 'managementAttempts', 'controlAttempts', 'combinedAttempts'].includes(key),
        ),
      ),
      { managementMaximum: 1024, managementAttempts: 527, controlAttempts: 846, combinedAttempts: 1373 },
    );
    const admitted = f.admit();
    assert.throws(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(admitted));
    const proof = f.claim(admitted),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.technicalAttemptOrdinal, 16);
    assert.equal(resume.mainManagementAttempts, 513);
    assert.equal(resume.aggregateManagementAttempts, 527);
    assert.equal(resume.mainControlAttempts, 840);
    assert.equal(resume.aggregateControlAttempts, 846);
    assert.equal(resume.legacySqlAdmitted, 7);
    assert.deepEqual(
      f.scoped(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(proof)),
      { nativeExecutions: 1, gatewayHttpAttempts: 2 },
    );
    assert.throws(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage({ ...proof }));
    for (const [index, path] of paths.entries()) assert.equal(readFileSync(path, 'utf8'), original[index]);
  } finally {
    f.cleanup();
  }
});

test('unadmitted WF00 reconciliation refuses missing or contradictory proof, counters and cleanup', async () => {
  for (const unadmittedWf00Fault of [
    'native-reset',
    'control-reset',
    'db-active',
    'db-actor',
    'api-running',
    'api-overclaim',
    'api-baseline',
    'api-reset',
    'diagnostic-reset',
    'cleanup',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      unadmittedWf00Reconciled: true,
      unadmittedWf00Fault,
    });
    try {
      assert.throws(() => f.check(), unadmittedWf00Fault);
      assert.throws(() => f.admit(), unadmittedWf00Fault);
    } finally {
      f.cleanup();
    }
  }
  for (const fault of ['missing-db', 'missing-api', 'missing-checkpoint', 'purpose-tail', 'live-api']) {
    const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
    try {
      if (fault.startsWith('missing-'))
        unlinkSync(
          join(
            f.directory,
            'milestones/M03-n8n-foundation/evidence/' +
              {
                'missing-db': 'wf00-unadmitted-db-readback-20261024.json',
                'missing-api': 'wf00-unadmitted-api-readback-20261024.json',
                'missing-checkpoint': 'wf00-unadmitted-manual-checkpoint-20261024.json',
              }[fault],
          ),
        );
      if (fault === 'purpose-tail')
        appendFileSync(
          join(f.directory, 'scripts/n8n/out/foundation/wf00-execution-diagnostic-20261024.jsonl'),
          '{"event":"management_attempt","ordinal":528}\n',
        );
      if (fault === 'live-api') f.io.processAlive = (pid) => pid === 7612;
      assert.throws(() => f.check(), fault);
      assert.throws(() => f.admit(), fault);
    } finally {
      f.cleanup();
    }
  }
});

test('unadmitted WF00 claimed carry validates immutable pins while permitting the existing legitimate25M51C tail', async () => {
  const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
  try {
    const proof = f.claim(f.admit());
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    f.io.processAlive = (pid) => [process.pid, process.ppid].includes(pid);
    for (let ordinal = 514; ordinal <= 538; ordinal++)
      appendFileSync(f.paths.management, JSON.stringify({ event: 'management_attempt', ordinal }) + '\n');
    for (let ordinal = 841; ordinal <= 891; ordinal++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({
          event: 'control_request_intent',
          ordinal,
          kind: 'discovery',
          workflowId: 'MzimjpsuyPuK7SKe',
          at: new Date(f.now()).toISOString(),
        }) + '\n',
      );
    assert.deepEqual(
      f.scoped(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(proof)),
      { nativeExecutions: 1, gatewayHttpAttempts: 2 },
    );
    f.scoped(() => f.module.readClaimedFoundationProjectVerifiedContinuation({ now: f.now }, f.io));
    appendFileSync(
      join(f.directory, 'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-api-readback-20261024.json'),
      ' ',
    );
    assert.throws(() => f.scoped(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(proof)));
  } finally {
    f.cleanup();
  }
});

test('historical technical15 with no unadmitted event retains524/843 and zero native carry', async () => {
  const f = await syntheticProjectVerifiedContinuation({ restoredBrowserRetryDiscovery: true });
  try {
    assert.equal(f.check().managementAttempts, 524);
    assert.equal(f.check().controlAttempts, 843);
    const proof = f.claim(f.admit());
    assert.deepEqual(
      f.scoped(() => f.module.foundationProjectVerifiedContinuationUnadmittedUsage(proof)),
      { nativeExecutions: 0, gatewayHttpAttempts: 0 },
    );
  } finally {
    f.cleanup();
  }
});

test('only complete absence of the optional unadmitted event permits the historical no-event profile', async () => {
  const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
  try {
    for (const name of ['manual-checkpoint', 'db-readback', 'api-readback', 'cleanup'])
      unlinkSync(
        join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-' + name + '-20261024.json',
        ),
      );
    assert.throws(() => f.check(), 'an orphan one-use diagnostic remains a charged event');
    unlinkSync(join(f.directory, 'scripts/n8n/out/foundation/wf00-execution-diagnostic-20261024.jsonl'));
    assert.equal(f.check().managementAttempts, 524);
    assert.equal(f.check().controlAttempts, 843);
  } finally {
    f.cleanup();
  }
});

test('closed technical15 browser timeout preserves both failed discoveries and524/843 charges before sibling16', async () => {
  const f = await syntheticProjectVerifiedContinuation({ restoredBrowserRetryDiscovery: true });
  try {
    const immutable = [14, 15].map((ordinal) => {
      const path = `scripts/n8n/out/foundation/live/project-verified-continuation-${f.snapshot.proposedSegmentId}.technical-${ordinal}.closed.json`;
      return [path, readFileSync(join(f.directory, path), 'utf8')];
    });
    const ready = f.check();
    assert.deepEqual(
      [ready.managementMaximum, ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [1024, 524, 843, 1367],
    );
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.technicalAttemptOrdinal, 16);
    assert.equal(resume.runtimeFilename, 'runtime.technical-16.jsonl');
    assert.equal(resume.mainControlAttempts, 840);
    assert.equal(resume.historicalWindowIds.length, 4);
    assert.equal(resume.historicalWindowIds.includes(proof.windowId), false);
    assert.equal(resume.legacySqlAdmitted, 7);
    assert.equal(proof.windowId, '4c602549-2c42-4ec3-9328-714d7cb66a77');
    assert.equal(proof.sourceCommitSha, '5087d4d93d2f6ffdca0bc0096b365723005446fc');
    assert.deepEqual(
      Object.keys(f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof)).sort(),
      ['SUB-NOTIFY', 'WF-90'],
    );
    for (const [path, before] of immutable) {
      assert.equal(JSON.parse(before).closureVerified, false);
      assert.equal(readFileSync(join(f.directory, path), 'utf8'), before);
    }
  } finally {
    f.cleanup();
  }
});

test('technical15 timeout recovery rejects repinned effects, source changes, altered discovery and incomplete cleanup', async () => {
  for (const restoredBrowserRetryDiscoveryFault of [
    'execution',
    'write',
    'admin',
    'usage',
    'raw-closure',
    'window',
    'control-kind',
    'control-workflow',
    'frame',
    'cleanup',
    'late-response',
    'source',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      restoredBrowserRetryDiscovery: true,
      restoredBrowserRetryDiscoveryFault,
    });
    try {
      assert.throws(() => f.check(), undefined, restoredBrowserRetryDiscoveryFault);
      assert.throws(() => f.admit(), undefined, restoredBrowserRetryDiscoveryFault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical15 timeout recovery requires both closed predecessors, absent outputs and immutable closure proofs', async () => {
  const f = await syntheticProjectVerifiedContinuation({ restoredBrowserRetryDiscovery: true });
  try {
    const receiptPaths = [14, 15].flatMap((ordinal) => [
        `milestones/M03-n8n-foundation/evidence/dev-acceptance-technical${ordinal}-reconciliation-20261024.json`,
        `milestones/M03-n8n-foundation/evidence/dev-acceptance-technical${ordinal}-cleanup-20261024.json`,
      ]),
      receipt = JSON.parse(readFileSync(join(f.directory, receiptPaths[2]), 'utf8'));
    for (const path of receiptPaths) {
      const before = readFileSync(join(f.directory, path), 'utf8');
      unlinkSync(join(f.directory, path));
      assert.throws(() => f.check());
      f.put(path, before);
    }
    for (const path of [
      ...receipt.absentOutputs,
      receipt.absentOutputs[0].replace('-attempt.json', '-unprovisioned-archive-attempt.json'),
    ]) {
      const absolute = f.put(path, '{}\n');
      assert.throws(() => f.check());
      unlinkSync(absolute);
    }
    for (const pid of [receipt.attempt.parentProcessId, receipt.attempt.runtimeProcessId]) {
      f.io.processAlive = (candidate) => candidate === pid;
      assert.throws(() => f.check());
    }
    f.io.processAlive = () => false;
    const proof = f.claim(f.admit());
    for (const path of [
      ...receiptPaths,
      ...Object.keys(receipt.pins).filter((path) => path.includes('technical-15')),
    ]) {
      const before = readFileSync(join(f.directory, path), 'utf8');
      writeFileSync(join(f.directory, path), before + '\n');
      assert.throws(() => f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof));
      writeFileSync(join(f.directory, path), before);
    }
    assert.deepEqual(
      Object.keys(f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof)).sort(),
      ['SUB-NOTIFY', 'WF-90'],
    );
  } finally {
    f.cleanup();
  }
});

test('closed technical14 browser-only failure preserves524/842 charges, unused fifth SQL window and restored versions before sibling15', async () => {
  const f = await syntheticProjectVerifiedContinuation({ restoredBrowserDiscovery: true });
  try {
    const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${f.snapshot.proposedSegmentId}.technical-14`,
      closedBefore = readFileSync(join(f.directory, base + '.closed.json'), 'utf8'),
      oldRuntime = readFileSync(
        join(f.directory, 'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl'),
        'utf8',
      );
    const ready = f.check();
    assert.deepEqual(
      [ready.managementMaximum, ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [1024, 524, 842, 1366],
    );
    assert.equal(ready.windowId, '4c602549-2c42-4ec3-9328-714d7cb66a77');
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
      versions = f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof);
    assert.equal(resume.technicalAttemptOrdinal, 15);
    assert.deepEqual(
      [
        resume.mainManagementAttempts,
        resume.mainControlAttempts,
        resume.setupRows,
        resume.setupAttempts,
        resume.preflightRows,
        resume.gatewayPreflightAttempts,
      ],
      [513, 839, 297, 149, 16, 6],
    );
    assert.equal(resume.runtimeFilename, 'runtime.technical-15.jsonl');
    assert.equal(resume.historicalWindowIds.length, 4);
    assert.equal(
      resume.historicalWindowIds.includes(proof.windowId),
      false,
      'browser failure did not provision or close the fifth SQL window',
    );
    assert.equal(resume.legacySqlAdmitted, 7);
    assert.deepEqual(Object.keys(versions).sort(), ['SUB-NOTIFY', 'WF-90']);
    assert.equal(JSON.parse(closedBefore).closureVerified, false);
    assert.equal(readFileSync(join(f.directory, base + '.closed.json'), 'utf8'), closedBefore);
    assert.equal(
      readFileSync(join(f.directory, 'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl'), 'utf8'),
      oldRuntime,
    );
  } finally {
    f.cleanup();
  }
});

test('technical14 browser recovery rejects repinned effects, altered discovery, rewritten raw closure and incomplete separate cleanup', async () => {
  for (const restoredBrowserDiscoveryFault of [
    'execution',
    'write',
    'admin',
    'usage',
    'raw-closure',
    'window',
    'control-kind',
    'control-workflow',
    'frame',
    'cleanup',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      restoredBrowserDiscovery: true,
      restoredBrowserDiscoveryFault,
    });
    try {
      assert.throws(() => f.check(), undefined, restoredBrowserDiscoveryFault);
      assert.throws(() => f.admit(), undefined, restoredBrowserDiscoveryFault);
    } finally {
      f.cleanup();
    }
  }
});

test('technical14 recovery requires both immutable receipts, dead owners and no Admin, fixture or runtime output', async () => {
  const f = await syntheticProjectVerifiedContinuation({ restoredBrowserDiscovery: true });
  try {
    const relative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-reconciliation-20261024.json',
      cleanupRelative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-cleanup-20261024.json',
      receipt = JSON.parse(readFileSync(join(f.directory, relative), 'utf8'));
    for (const path of [relative, cleanupRelative]) {
      const absolute = join(f.directory, path),
        before = readFileSync(absolute, 'utf8');
      unlinkSync(absolute);
      assert.throws(() => f.check());
      f.put(path, before);
    }
    for (const path of [
      ...receipt.absentOutputs,
      receipt.absentOutputs[0].replace('-attempt.json', '-unprovisioned-archive-attempt.json'),
    ]) {
      const absolute = f.put(path, '{}\n');
      assert.throws(() => f.check());
      unlinkSync(absolute);
    }
    f.io.processAlive = (pid) => pid === receipt.attempt.runtimeProcessId;
    assert.throws(() => f.check());
    f.io.processAlive = () => false;
    const proof = f.claim(f.admit());
    for (const path of [
      relative,
      cleanupRelative,
      ...Object.keys(receipt.pins).filter((path) => path.includes('technical-14')),
    ]) {
      const absolute = join(f.directory, path),
        before = readFileSync(absolute, 'utf8');
      writeFileSync(absolute, before + '\n');
      assert.throws(() => f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof));
      writeFileSync(absolute, before);
    }
    assert.deepEqual(
      Object.keys(f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof)).sort(),
      ['SUB-NOTIFY', 'WF-90'],
    );
  } finally {
    f.cleanup();
  }
});

test('technical15 and16 ReadClaimed permit only sequential new25Management51Control charges above both pinned discovery prefixes', async () => {
  for (const restoredBrowserRetryDiscovery of [false, true]) {
    const f = await syntheticProjectVerifiedContinuation({
      restoredBrowserDiscovery: true,
      restoredBrowserRetryDiscovery,
    });
    try {
      const proof = f.claim(f.admit()),
        beforeManagement = readFileSync(f.paths.management, 'utf8'),
        beforeControl = readFileSync(f.paths.control, 'utf8');
      f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
      f.io.processAlive = (pid) => [process.pid, process.ppid].includes(pid);
      for (let i = 0; i < 25; i++)
        appendFileSync(
          f.paths.management,
          JSON.stringify({ event: 'management_attempt', ordinal: 514 + i }) + '\n',
        );
      for (let i = 0; i < 51; i++)
        appendFileSync(
          f.paths.control,
          JSON.stringify({
            event: 'control_request_intent',
            ordinal: (restoredBrowserRetryDiscovery ? 841 : 840) + i,
            kind: 'discovery',
            workflowId: 'MzimjpsuyPuK7SKe',
            at: new Date(f.now()).toISOString(),
          }) + '\n',
        );
      const current = f.readClaimed();
      assert.equal(current.windowId, proof.windowId);
      assert.equal(current.sourceCommitSha, proof.sourceCommitSha);
      assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(beforeManagement), true);
      assert.equal(readFileSync(f.paths.control, 'utf8').startsWith(beforeControl), true);
      assert.throws(() => f.check(), 'a fresh admission must not reuse the current sibling tail');
      for (const path of [f.paths.management, f.paths.control]) {
        const before = readFileSync(path, 'utf8'),
          rows = before.trimEnd().split('\n').map(JSON.parse);
        rows.at(-1).ordinal--;
        writeFileSync(path, rows.map(JSON.stringify).join('\n') + '\n');
        assert.throws(() => f.readClaimed());
        writeFileSync(path, before);
      }
      const control = readFileSync(f.paths.control, 'utf8');
      for (const index of restoredBrowserRetryDiscovery ? [846, 847] : [846]) {
        const rows = control.trimEnd().split('\n').map(JSON.parse);
        rows[index].workflowId = 'SYNTHETIC_FOREIGN';
        writeFileSync(f.paths.control, rows.map(JSON.stringify).join('\n') + '\n');
        assert.throws(() => f.readClaimed(), 'neither pinned failed discovery can be reattributed');
        writeFileSync(f.paths.control, control);
      }
      assert.equal(f.readClaimed().windowId, proof.windowId);
    } finally {
      f.cleanup();
    }
  }
});

test('approved1024 post-restoration profile preserves524/841 charges and derives only two restored baseline versions', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    runtimeRestorationClosed: true,
    runtimeRestorationAllocation: true,
  });
  try {
    const prior = 'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl',
      old = readFileSync(join(f.directory, prior), 'utf8');
    const ready = f.check();
    assert.deepEqual(
      [ready.managementMaximum, ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [1024, 524, 841, 1365],
    );
    assert.equal(ready.sourceCommitSha, '5087d4d93d2f6ffdca0bc0096b365723005446fc');
    assert.equal(ready.windowId, '4c602549-2c42-4ec3-9328-714d7cb66a77');
    assert.equal(ready.privateRead, false);
    assert.equal(ready.networkRequests, 0);
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
      versions = f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof);
    assert.deepEqual(
      [
        resume.technicalAttemptOrdinal,
        resume.setupRows,
        resume.setupAttempts,
        resume.setupMaximum,
        resume.preflightRows,
        resume.gatewayPreflightAttempts,
      ],
      [14, 297, 149, 224, 16, 6],
    );
    assert.deepEqual(
      [
        resume.mainManagementAttempts,
        resume.aggregateManagementAttempts,
        resume.mainControlAttempts,
        resume.aggregateControlAttempts,
      ],
      [513, 524, 838, 841],
    );
    assert.equal(
      resume.legacySqlAdmitted,
      7,
      'only the restored four-window profile carries all seven historical SQL admissions',
    );
    assert.equal(resume.historicalWindowIds.length, 4);
    assert.equal(resume.runtimeFilename, 'runtime.technical-14.jsonl');
    assert.deepEqual(Object.keys(versions).sort(), ['SUB-NOTIFY', 'WF-90']);
    assert.equal(Object.isFrozen(versions), true);
    assert.equal(new Set(Object.values(versions)).size, 2);
    assert.equal(readFileSync(join(f.directory, prior), 'utf8'), old);
    assert.throws(() =>
      f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(Object.freeze({ ...proof })),
    );
    const managementBefore = readFileSync(f.paths.management, 'utf8');
    appendFileSync(f.paths.management, JSON.stringify({ event: 'management_attempt', ordinal: 514 }) + '\n');
    assert.deepEqual(f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof), versions);
    assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(managementBefore), true);
  } finally {
    f.cleanup();
  }
});

test('post-restoration caps remain unavailable without exact allocation or verified source delivery', async () => {
  for (const options of [
    { runtimeRestorationClosed: true },
    { runtimeRestorationClosed: true, runtimeRestorationAllocation: true, runtimeSourceUnverified: true },
  ]) {
    const f = await syntheticProjectVerifiedContinuation(options);
    try {
      const result = f.check();
      assert.equal(
        result.status,
        options.runtimeSourceUnverified ? 'application_source_unselected' : 'setup_cap_insufficient',
      );
      assert.deepEqual(
        [result.managementAttempts, result.controlAttempts, result.combinedAttempts, result.setupAttempts],
        [524, 841, 1365, 149],
      );
      assert.equal(result.setupMaximum, options.runtimeSourceUnverified ? 224 : 176);
      assert.equal(result.proposedSetupMaximum, 224);
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});

test('post-restoration ReadClaimed keeps immutable closed prefixes after the real25Management51Control baseline charges', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    runtimeRestorationClosed: true,
    runtimeRestorationAllocation: true,
  });
  try {
    const proof = f.claim(f.admit()),
      management = readFileSync(f.paths.management, 'utf8'),
      control = readFileSync(f.paths.control, 'utf8');
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    f.io.processAlive = (pid) => [process.pid, process.ppid].includes(pid);
    for (let i = 0; i < 25; i++)
      appendFileSync(
        f.paths.management,
        JSON.stringify({ event: 'management_attempt', ordinal: 514 + i }) + '\n',
      );
    for (let i = 0; i < 51; i++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({
          event: 'control_request_intent',
          ordinal: 839 + i,
          kind: 'discovery',
          workflowId: 'MzimjpsuyPuK7SKe',
          at: new Date(f.now()).toISOString(),
        }) + '\n',
      );
    const read = f.readClaimed();
    assert.equal(read.sourceCommitSha, proof.sourceCommitSha);
    assert.equal(read.windowId, proof.windowId);
    assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(management), true);
    assert.equal(readFileSync(f.paths.control, 'utf8').startsWith(control), true);
    assert.throws(() => f.check(), 'initial readiness may not consume charged current-attempt tails');
    for (const path of [f.paths.management, f.paths.control]) {
      const before = readFileSync(path, 'utf8'),
        rows = before.trimEnd().split('\n').map(JSON.parse);
      rows.at(-1).ordinal--;
      writeFileSync(path, rows.map(JSON.stringify).join('\n') + '\n');
      assert.throws(() => f.readClaimed());
      writeFileSync(path, before);
    }
    assert.equal(f.readClaimed().windowId, proof.windowId);
  } finally {
    f.cleanup();
  }
});

test('post-restoration recovery rejects unknown acknowledgement replay, false cleanup, reset charges and malformed native versions', async () => {
  for (const runtimeRestorationFault of [
    'raw-closure',
    'readback',
    'recovery-version',
    'recovery-replay',
    'settlement',
    'usage',
    'archive',
    'cleanup',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      runtimeRestorationClosed: true,
      runtimeRestorationAllocation: true,
      runtimeRestorationFault,
    });
    try {
      assert.throws(() => f.check(), undefined, runtimeRestorationFault);
      assert.throws(() => f.admit(), undefined, runtimeRestorationFault);
    } finally {
      f.cleanup();
    }
  }
});

test('post-restoration allocation rejects repinned cap, usage, actor, production and closed-window changes', async () => {
  for (const runtimeRestorationAllocationFault of [
    'maximum',
    'vercel',
    'usage',
    'actor',
    'boundary',
    'window',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      runtimeRestorationClosed: true,
      runtimeRestorationAllocation: true,
      runtimeRestorationAllocationFault,
    });
    try {
      assert.throws(() => f.check(), undefined, runtimeRestorationAllocationFault);
      assert.throws(() => f.admit(), undefined, runtimeRestorationAllocationFault);
    } finally {
      f.cleanup();
    }
  }
});

test('claimed restored baseline carry stays pinned to immutable old13 and49-row recovery while historical proofs return null', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    runtimeRestorationClosed: true,
    runtimeRestorationAllocation: true,
  });
  try {
    const proof = f.claim(f.admit());
    for (const relative of [
      'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl',
      'scripts/n8n/out/foundation/runtime-technical13-restoration.jsonl',
      'scripts/n8n/out/foundation/runtime-technical13-restoration-attempt.json',
      'scripts/n8n/out/foundation/runtime-technical13-restoration-result.json',
      'milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json',
      'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-restoration-approval-20261024.json',
    ]) {
      const path = join(f.directory, relative),
        before = readFileSync(path, 'utf8');
      appendFileSync(path, ' ');
      assert.throws(
        () => f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof),
        undefined,
        relative,
      );
      writeFileSync(path, before);
    }
    assert.equal(
      Object.keys(f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof)).length,
      2,
    );
  } finally {
    f.cleanup();
  }
  const historical = await syntheticProjectVerifiedContinuation();
  try {
    assert.equal(
      historical.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(
        historical.claim(historical.admit()),
      ),
      null,
    );
  } finally {
    historical.cleanup();
  }
});

test('closed technical12 and the separate one-GET diagnostic retain every charge before new allocation', async () => {
  const f = await syntheticProjectVerifiedContinuation({ runtimePreparationClosed: true });
  try {
    const before = [f.paths.management, f.paths.control, f.paths.setup].map((p) => readFileSync(p, 'utf8'));
    const r = f.check();
    assert.deepEqual(
      [
        r.status,
        r.managementAttempts,
        r.controlAttempts,
        r.combinedAttempts,
        r.setupAttempts,
        r.setupMaximum,
        r.proposedSetupMaximum,
      ],
      ['setup_cap_insufficient', 401, 740, 1141, 114, 132, 176],
    );
    assert.equal(r.windowId, '3c46c791-e140-4eb9-890a-eecfa251f65e');
    assert.equal(r.gatewayPreflightAttempts, 4);
    assert.throws(() => f.admit());
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-13.json')), false);
    assert.deepEqual(
      [f.paths.management, f.paths.control, f.paths.setup].map((p) => readFileSync(p, 'utf8')),
      before,
    );
  } finally {
    f.cleanup();
  }
});

test('approved832/176 continuation claims only next13 with a fresh fourth window and complete history', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    runtimePreparationClosed: true,
    runtimeMetadataAllocation: true,
  });
  try {
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.deepEqual(
      [ready.managementMaximum, ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [832, 401, 740, 1141],
    );
    const historical = f.paths.admission.replace(/\.json$/, '.technical-12.json'),
      before = readFileSync(historical, 'utf8');
    const p = f.claim(f.admit()),
      c = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(p);
    assert.equal(p.sourceCommitSha, '7b1837201ac7925591577a1517d7288936ca3464');
    assert.equal(p.windowId, '3c46c791-e140-4eb9-890a-eecfa251f65e');
    assert.deepEqual(
      [
        c.technicalAttemptOrdinal,
        c.mainManagementAttempts,
        c.aggregateManagementAttempts,
        c.managementMaximum,
        c.mainControlAttempts,
        c.aggregateControlAttempts,
        c.setupRows,
        c.setupAttempts,
        c.setupMaximum,
        c.preflightRows,
        c.gatewayPreflightAttempts,
      ],
      [13, 390, 401, 832, 737, 740, 226, 114, 176, 11, 4],
    );
    assert.deepEqual(c.historicalWindowIds, [
      'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      'eda4fae1-1e19-47db-81b8-beac1a4ed883',
    ]);
    assert.equal(readFileSync(historical, 'utf8'), before);
    f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p);
    appendFileSync(
      join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-metadata-approval-20261024.json',
      ),
      ' ',
    );
    assert.throws(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p));
  } finally {
    f.cleanup();
  }
});

test('technical12 closure, no-replay, runtime read-only, real fixture audit and diagnostic charges are required', async () => {
  for (const fault of [
    'closure',
    'actor',
    'replay',
    'runtime-write',
    'audit',
    'diagnostic-charge',
    'diagnostic-tls',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      runtimePreparationClosed: true,
      runtimeMetadataAllocation: true,
      runtimePreparationFault: fault,
    });
    try {
      assert.throws(() => f.check(), undefined, fault);
      assert.throws(() => f.admit(), undefined, fault);
    } finally {
      f.cleanup();
    }
  }
});

test('832 allocation preserves all other limits and requires verified immutable application delivery', async () => {
  for (const fault of ['maximum', 'vercel', 'usage', 'actor', 'boundary', 'window']) {
    const f = await syntheticProjectVerifiedContinuation({
      runtimePreparationClosed: true,
      runtimeMetadataAllocation: true,
      runtimeMetadataAllocationFault: fault,
    });
    try {
      assert.throws(() => f.check(), undefined, fault);
    } finally {
      f.cleanup();
    }
  }
  const f = await syntheticProjectVerifiedContinuation({
    runtimePreparationClosed: true,
    runtimeMetadataAllocation: true,
    runtimeSourceUnverified: true,
  });
  try {
    assert.equal(f.check().status, 'application_source_unselected');
    assert.throws(() => f.admit());
  } finally {
    f.cleanup();
  }
});

test('current readiness reserves the second Machine read without changing historical allocation claims', async () => {
  const source = readFileSync(
    new URL('./foundation-live-project-verified-continuation.mjs', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('function currentReadiness(x) {');
  const end = source.indexOf('function blockedReadiness(', start);
  assert.ok(start > 0 && end > start);
  // Isolate the actual production capacity reducer. This test module supplies
  // only source-known prerequisite stubs and cannot mint an admission/proof.
  const { currentReadiness } = await import(
    'data:text/javascript,' +
      encodeURIComponent(`
    const assertSetupAllocationApproval=()=>{};
    const activeRuntime=()=>({setupMaximum:132,sourceCommitSha:'${'a'.repeat(40)}',sourceCi:1,allFiveCiJobsPassed:true,vercelPassed:true});
    const caps={runtimeManagement:512},c={sourceCommitSha:'${'f'.repeat(40)}'};
    const positive=value=>Number.isSafeInteger(value)&&value>0;
    ${source.slice(start, end)}
    export {currentReadiness};
  `)
  );
  const recovery = {
    closedWindow: true,
    setupAttempts: 79,
    managementMaximum: 704,
    carriedManagementAttempts: 11,
  };
  assert.equal(currentReadiness({ recovery: { ...recovery, mainManagementAttempts: 316 } }), null);
  assert.equal(
    currentReadiness({ recovery: { ...recovery, mainManagementAttempts: 317 } }),
    'management_cap_insufficient',
  );
});

test('the retained old50 setup-cap regression preserves all usage and still blocks fresh admission', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true });
  try {
    const snapshots = [
      f.paths.admission,
      f.paths.claim,
      f.paths.management,
      f.paths.control,
      f.paths.setup,
    ].map((path) => readFileSync(path, 'utf8'));
    const r = f.check();
    assert.equal(r.status, 'setup_cap_insufficient');
    assert.equal(r.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc');
    assert.equal(r.managementAttempts, 102);
    assert.equal(r.controlAttempts, 301);
    assert.equal(r.combinedAttempts, 403);
    assert.equal(r.gatewayPreflightAttempts, 2);
    assert.equal(r.setupAttempts, 44);
    assert.equal(r.setupMaximum, 50);
    assert.equal(r.minimumNewSetupRequests, 32);
    assert.equal(r.proposedSetupMaximum, 88);
    assert.equal(r.privateRead, false);
    assert.equal(
      f.scoped(() => f.module.reconcileFoundationProjectVerifiedContinuation({ now: f.now }, f.io)).status,
      'setup_cap_insufficient',
    );
    assert.throws(() => f.admit());
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-3.json')), false);
    for (const [i, path] of [
      f.paths.admission,
      f.paths.claim,
      f.paths.management,
      f.paths.control,
      f.paths.setup,
    ].entries())
      assert.equal(readFileSync(path, 'utf8'), snapshots[i]);
  } finally {
    f.cleanup();
  }
});

test('closed-window reconciliation rejects false archive, writer identity, usage, historical success and missing independent readback', async () => {
  for (const closedFault of ['archive', 'writer', 'usage', 'historical-closure', 'readback']) {
    const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, closedFault });
    try {
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});

test('cumulative88 requires the exact owner allocation and cannot reset44 used or increase any global allowance', async () => {
  for (const allocationFault of ['owner', 'used', 'maximum', 'reset', 'global', 'budget', 'prior-usage']) {
    const f = await syntheticProjectVerifiedContinuation({
      closedWindow: true,
      proposedBudgetApproved: true,
      allocationFault,
    });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-3.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('missing or changed cumulative88 approval blocks before private metadata and cannot acquire a runtime claim', async () => {
  for (const fault of ['missing', 'byte-drift', 'after-admission']) {
    const f = await syntheticProjectVerifiedContinuation({
      closedWindow: true,
      proposedBudgetApproved: true,
    });
    let privateCalls = 0;
    try {
      assert.equal(f.check().kind, 'project_verified_continuation_ready');
      const proof = fault === 'after-admission' ? f.admit() : null;
      const path = join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/remaining-control-allocation-approval-20261023.json',
      );
      if (fault === 'byte-drift') appendFileSync(path, ' ');
      else unlinkSync(path);
      f.io.lstatSync = (p) => {
        if (/(?:\.dpapi|\.lease\.json)$/.test(String(p))) privateCalls++;
        return lstatSync(p);
      };
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => (proof ? f.claim(proof) : f.admit()), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(privateCalls, 0);
      assert.equal(
        existsSync(f.paths.admission.replace(/\.json$/, '.technical-3.runtime-claim.json')),
        false,
      );
    } finally {
      f.cleanup();
    }
  }
});

test('WF-00 carried usage requires the preserved failed prefix, one acknowledged PUT and verified physical closure', async () => {
  for (const restoreFault of [
    'closure',
    'child',
    'ack',
    'quota-reset',
    'prefix',
    'extra-request',
    'duplicate-put',
    'unknown-setting',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, restoreFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-3.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('WF-00 restore journal is immutable and cannot be truncated, edited or extended after pinned reconciliation', async () => {
  for (const fault of ['missing', 'truncated', 'edited', 'extended']) {
    const f = await syntheticProjectVerifiedContinuation({ closedWindow: true });
    try {
      const path = join(f.directory, 'scripts/n8n/out/foundation/wf00-restore-20261023.jsonl'),
        text = readFileSync(path, 'utf8');
      if (fault === 'missing') unlinkSync(path);
      if (fault === 'truncated') writeFileSync(path, text.split('\n').slice(0, 2).join('\n') + '\n');
      if (fault === 'edited') writeFileSync(path, text.replace('"number":3', '"number":30'));
      if (fault === 'extended') appendFileSync(path, '{}\n');
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});

test('isolated approved-budget fixture claims only fresh window/source and preserves legacy headers/cumulative usage', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  let budget;
  try {
    const legacy = readFileSync(f.paths.management, 'utf8');
    const p = f.claim(f.admit());
    assert.equal(p.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc');
    assert.equal(p.sourceCommitSha, 'a5e746736893d5040e93032ae740a0878f748837');
    assert.equal(p.carriedManagementAttempts, 10);
    assert.equal(p.carriedControlAttempts, 1);
    const resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(p);
    assert.equal(resume.aggregateManagementAttempts, 102);
    assert.equal(resume.aggregateControlAttempts, 301);
    assert.equal(resume.gatewayPreflightAttempts, 2);
    assert.equal(resume.legacySqlAdmitted, 2);
    assert.equal(resume.runtimeFilename, 'runtime.technical-3.jsonl');
    assert.equal(resume.setupMaximum, 88);
    const m = await f.copy('foundation-live-runtime.mjs');
    budget = m.createFoundationLiveManagementBudget(
      { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
      { directory: dirname(f.paths.management), now: f.now, projectVerifiedContinuationProof: p },
    );
    assert.equal(budget.snapshot().attempts, 102);
    budget.admit();
    assert.equal(budget.snapshot().attempts, 103);
    assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(legacy), true);
    assert.equal(
      JSON.parse(legacy.split('\n')[0]).sourceCommitSha,
      'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
    );
    assert.throws(() => f.admit());
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('claimed fresh-window read preserves closed journal prefixes while accepting charged baseline discovery appends', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  try {
    const proof = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    const managementBefore = readFileSync(f.paths.management, 'utf8');
    const controlBefore = readFileSync(f.paths.control, 'utf8');
    for (let i = 0; i < 25; i++)
      appendFileSync(
        f.paths.management,
        JSON.stringify({ event: 'management_attempt', ordinal: 93 + i }) + '\n',
      );
    for (let i = 0; i < 50; i++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({ event: 'control_request_intent', ordinal: 301 + i, kind: 'discovery' }) + '\n',
      );
    const current = f.readClaimed();
    assert.equal(current.sourceCommitSha, proof.sourceCommitSha);
    assert.equal(current.windowId, proof.windowId);
    assert.equal(current.carriedManagementAttempts, 10);
    assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(managementBefore), true);
    assert.equal(readFileSync(f.paths.control, 'utf8').startsWith(controlBefore), true);
    for (const [path, text] of [
      [f.paths.management, managementBefore],
      [f.paths.control, controlBefore],
    ]) {
      const currentText = readFileSync(path, 'utf8');
      const rows = currentText.trimEnd().split('\n').map(JSON.parse);
      rows[1].ordinal = 999;
      writeFileSync(path, rows.map(JSON.stringify).join('\n') + '\n');
      assert.throws(() => f.readClaimed(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      writeFileSync(path, currentText);
      assert.equal(readFileSync(path, 'utf8').startsWith(text), true);
    }
    assert.equal(f.readClaimed().windowId, proof.windowId);
  } finally {
    f.cleanup();
  }
});

test('claimed closed-window journal prefix changes and immutable historical runtime changes remain blocked', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  try {
    f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
      const path = join(f.directory, 'scripts/n8n/out/foundation/live', name + '.jsonl');
      const text = readFileSync(path, 'utf8');
      writeFileSync(path, text.replace('{', '{ '));
      assert.throws(() => f.readClaimed(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      writeFileSync(path, text);
    }
    const oldRuntime = join(f.directory, 'scripts/n8n/out/foundation/live/runtime.jsonl');
    const before = readFileSync(oldRuntime, 'utf8');
    appendFileSync(oldRuntime, '{}\n');
    assert.throws(() => f.readClaimed(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    writeFileSync(oldRuntime, before);
    assert.equal(f.readClaimed().carriedManagementAttempts, 10);
  } finally {
    f.cleanup();
  }
});

test('closed read-only technical3 admits only an immutable technical4 and retains all127/351 charges and false historical closure', async () => {
  const f = await syntheticProjectVerifiedContinuation({ readonlyPrepare: true });
  try {
    const base = f.paths.admission.slice(0, -5);
    const preserved = [
      '.technical-3.json',
      '.technical-3.runtime-claim.json',
      '.technical-3.closed.json',
    ].map((suffix) => [base + suffix, readFileSync(base + suffix, 'utf8')]);
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const proof = f.claim(f.admit());
    const current = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(current.technicalAttemptOrdinal, 4);
    assert.equal(current.runtimeFilename, 'runtime.technical-4.jsonl');
    assert.equal(current.mainManagementAttempts, 117);
    assert.equal(current.aggregateManagementAttempts, 127);
    assert.equal(current.mainControlAttempts, 350);
    assert.equal(current.aggregateControlAttempts, 351);
    assert.equal(current.setupAttempts, 44);
    assert.equal(current.setupMaximum, 88);
    assert.equal(current.gatewayPreflightAttempts, 2);
    assert.equal(current.legacySqlAdmitted, 2);
    assert.equal(existsSync(base + '.technical-4.json'), true);
    assert.equal(existsSync(base + '.technical-4.runtime-claim.json'), true);
    for (const [path, text] of preserved) assert.equal(readFileSync(path, 'utf8'), text);
    const closed = JSON.parse(preserved[2][1]);
    assert.equal(closed.closureVerified, false);
    assert.equal(closed.bypassHandoffDeleted, false);
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    assert.equal(f.readClaimed().carriedManagementAttempts, 10);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
  } finally {
    f.cleanup();
  }
});

test('read-only technical3 recovery rejects changed usage, effects, cleanup and rewritten closure assertions', async () => {
  for (const readonlyPrepareFault of ['usage', 'side-effect', 'actor', 'cleanup', 'closure-rewritten']) {
    const f = await syntheticProjectVerifiedContinuation({ readonlyPrepare: true, readonlyPrepareFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-4.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('read-only technical3 recovery requires immutable receipts, prefixes, closed owners and no new side-effect intent', async () => {
  for (const fault of [
    'receipt',
    'attempt',
    'admission',
    'claim',
    'closed',
    'management',
    'control',
    'live-owner',
    'new-intent',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ readonlyPrepare: true });
    try {
      const base = f.paths.admission.slice(0, -5);
      const paths = {
        receipt: join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical3-reconciliation-20261023.json',
        ),
        attempt: join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical3-attempt-20261023.json',
        ),
        admission: base + '.technical-3.json',
        claim: base + '.technical-3.runtime-claim.json',
        closed: base + '.technical-3.closed.json',
        management: f.paths.management,
        control: f.paths.control,
      };
      if (Object.hasOwn(paths, fault)) {
        const text = readFileSync(paths[fault], 'utf8');
        writeFileSync(paths[fault], text.replace('{', '{ '));
      }
      if (fault === 'live-owner') f.io.processAlive = (pid) => pid === 91001;
      if (fault === 'new-intent')
        f.put(
          'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-4-owner-provision-attempt.json',
          '{}\n',
        );
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(base + '.technical-4.json'), false);
    } finally {
      f.cleanup();
    }
  }
});

test('read-only technical3 recovery refuses every prior DB output or runtime journal collision', async () => {
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
    'runtime',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ readonlyPrepare: true });
    try {
      const path =
        suffix === 'runtime'
          ? 'scripts/n8n/out/foundation/live/runtime.technical-3.jsonl'
          : 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-3-' +
            suffix +
            '.json';
      f.put(path, '{}\n');
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-4.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('failed native discovery technical4 admits only technical5 with127/352 charges and unchanged false closure records', async () => {
  const f = await syntheticProjectVerifiedContinuation({ nativeDiscovery: true });
  try {
    const base = f.paths.admission.slice(0, -5);
    const preserved = [3, 4].flatMap((ordinal) =>
      ['.json', '.runtime-claim.json', '.closed.json'].map((suffix) => {
        const path = base + '.technical-' + ordinal + suffix;
        return [path, readFileSync(path, 'utf8')];
      }),
    );
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const proof = f.claim(f.admit());
    const current = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(current.technicalAttemptOrdinal, 5);
    assert.equal(current.runtimeFilename, 'runtime.technical-5.jsonl');
    assert.equal(current.mainManagementAttempts, 117);
    assert.equal(current.aggregateManagementAttempts, 127);
    assert.equal(current.mainControlAttempts, 351);
    assert.equal(current.aggregateControlAttempts, 352);
    assert.equal(current.setupAttempts, 44);
    assert.equal(current.setupMaximum, 88);
    assert.equal(current.gatewayPreflightAttempts, 2);
    for (const [path, text] of preserved) assert.equal(readFileSync(path, 'utf8'), text);
    const closed = JSON.parse(readFileSync(base + '.technical-4.closed.json', 'utf8'));
    assert.equal(closed.closureVerified, false);
    assert.equal(closed.bypassHandoffDeleted, false);
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    assert.equal(f.readClaimed().windowId, proof.windowId);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
  } finally {
    f.cleanup();
  }
});

test('native discovery technical4 cannot hide an execution, foreign workflow, writes, actor, cleanup failure or counter reset', async () => {
  for (const nativeDiscoveryFault of ['execution', 'foreign', 'usage', 'write', 'actor', 'cleanup']) {
    const f = await syntheticProjectVerifiedContinuation({ nativeDiscovery: true, nativeDiscoveryFault });
    try {
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-5.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('native discovery technical4 requires immutable receipts, records, control prefix, dead owners and absent prior side-effect outputs', async () => {
  const collisions = [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
    'runtime',
  ];
  for (const fault of [
    'receipt',
    'admission',
    'claim',
    'closed',
    'control',
    'live-parent',
    'live-runtime',
    ...collisions,
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ nativeDiscovery: true });
    try {
      const base = f.paths.admission.slice(0, -5);
      const paths = {
        receipt: join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical4-reconciliation-20261023.json',
        ),
        admission: base + '.technical-4.json',
        claim: base + '.technical-4.runtime-claim.json',
        closed: base + '.technical-4.closed.json',
        control: f.paths.control,
      };
      if (Object.hasOwn(paths, fault))
        writeFileSync(paths[fault], readFileSync(paths[fault], 'utf8').replace('{', '{ '));
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91003;
      if (fault === 'live-runtime') f.io.processAlive = (pid) => pid === 91004;
      if (collisions.includes(fault))
        f.put(
          fault === 'runtime'
            ? 'scripts/n8n/out/foundation/live/runtime.technical-4.jsonl'
            : 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-4-' +
                fault +
                '.json',
          '{}\n',
        );
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(base + '.technical-5.json'), false);
    } finally {
      f.cleanup();
    }
  }
});

test('repeated early discovery failures preserve attempts4and5 and admit only technical6 with127/353 charged', async () => {
  const f = await syntheticProjectVerifiedContinuation({ nativeBrowserDiscovery: true });
  try {
    const base = f.paths.admission.slice(0, -5);
    const preserved = [3, 4, 5].flatMap((ordinal) =>
      ['.json', '.runtime-claim.json', '.closed.json'].map((suffix) => {
        const path = base + '.technical-' + ordinal + suffix;
        return [path, readFileSync(path, 'utf8')];
      }),
    );
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const proof = f.claim(f.admit());
    const current = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(current.technicalAttemptOrdinal, 6);
    assert.equal(current.runtimeFilename, 'runtime.technical-6.jsonl');
    assert.equal(current.mainManagementAttempts, 117);
    assert.equal(current.aggregateManagementAttempts, 127);
    assert.equal(current.mainControlAttempts, 352);
    assert.equal(current.aggregateControlAttempts, 353);
    assert.equal(current.setupAttempts, 44);
    assert.equal(current.setupMaximum, 88);
    for (const [path, text] of preserved) assert.equal(readFileSync(path, 'utf8'), text);
    for (const ordinal of [4, 5]) {
      const closed = JSON.parse(readFileSync(base + '.technical-' + ordinal + '.closed.json', 'utf8'));
      assert.equal(closed.closureVerified, false);
      assert.equal(closed.bypassHandoffDeleted, false);
    }
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    assert.equal(f.readClaimed().windowId, proof.windowId);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
  } finally {
    f.cleanup();
  }
});

test('browser discovery reconciliation rejects effects, unknown completion, missing cleanup and counter reset', async () => {
  for (const nativeBrowserDiscoveryFault of [
    'execution',
    'foreign',
    'usage',
    'write',
    'actor',
    'cleanup',
    'unknown-completion',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      nativeBrowserDiscovery: true,
      nativeBrowserDiscoveryFault,
    });
    try {
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-6.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('browser discovery reconciliation requires both immutable early failures, dead owners and no prior5 side-effect outputs', async () => {
  const collisions = [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
    'runtime',
  ];
  for (const fault of [
    'receipt',
    'prior-receipt',
    'admission',
    'claim',
    'closed',
    'control',
    'live-parent',
    'live-runtime',
    ...collisions,
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ nativeBrowserDiscovery: true });
    try {
      const base = f.paths.admission.slice(0, -5);
      const paths = {
        receipt: join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical5-reconciliation-20261023.json',
        ),
        'prior-receipt': join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical4-reconciliation-20261023.json',
        ),
        admission: base + '.technical-5.json',
        claim: base + '.technical-5.runtime-claim.json',
        closed: base + '.technical-5.closed.json',
        control: f.paths.control,
      };
      if (Object.hasOwn(paths, fault))
        writeFileSync(paths[fault], readFileSync(paths[fault], 'utf8').replace('{', '{ '));
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91005;
      if (fault === 'live-runtime') f.io.processAlive = (pid) => pid === 91006;
      if (collisions.includes(fault))
        f.put(
          fault === 'runtime'
            ? 'scripts/n8n/out/foundation/live/runtime.technical-5.jsonl'
            : 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-5-' +
                fault +
                '.json',
          '{}\n',
        );
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(base + '.technical-6.json'), false);
    } finally {
      f.cleanup();
    }
  }
});

test('closed technical6 preserves152/382 raw history and current152/384 charges but blocks528/512 before new admission or private metadata', async () => {
  const f = await syntheticProjectVerifiedContinuation({ baselineDiscovery: true });
  try {
    const base = f.paths.admission.slice(0, -5);
    const preserved = [4, 5, 6].flatMap((ordinal) =>
      ['.json', '.runtime-claim.json', '.closed.json'].map((suffix) => {
        const path = base + '.technical-' + ordinal + suffix;
        return [path, readFileSync(path, 'utf8')];
      }),
    );
    const result = f.check();
    assert.equal(result.kind, 'project_verified_continuation_blocked');
    assert.equal(result.status, 'management_cap_insufficient');
    assert.equal(result.managementAttempts, 152);
    assert.equal(result.controlAttempts, 384);
    assert.equal(result.combinedAttempts, 536);
    assert.equal(result.setupAttempts, 44);
    assert.equal(result.setupMaximum, 88);
    assert.equal(result.privateRead, false);
    assert.equal(result.networkRequests, 0);
    let privateMetadataReads = 0;
    for (const [key, fallback] of [
      ['lstatSync', lstatSync],
      ['readFileSync', readFileSync],
      ['openSync', openSync],
    ]) {
      const original = f.io[key] ?? fallback;
      f.io[key] = (...args) => {
        if (/\.dpapi|\.lease\.json|secrets[\\/]dev/.test(String(args[0]))) {
          privateMetadataReads++;
          throw Error('SYNTHETIC_PRIVATE_METADATA_FORBIDDEN');
        }
        return original(...args);
      };
    }
    assert.equal(f.check().status, 'management_cap_insufficient');
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.equal(privateMetadataReads, 0);
    assert.equal(existsSync(base + '.technical-7.json'), false);
    assert.equal(existsSync(base + '.technical-7.runtime-claim.json'), false);
    for (const [path, text] of preserved) assert.equal(readFileSync(path, 'utf8'), text);
    const closed = JSON.parse(readFileSync(base + '.technical-6.closed.json', 'utf8'));
    assert.equal(closed.closureVerified, false);
    assert.equal(closed.bypassHandoffDeleted, false);
    assert.equal(
      JSON.parse(
        readFileSync(
          join(
            f.directory,
            'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json',
          ),
          'utf8',
        ),
      ).usage.control,
      382,
    );
  } finally {
    f.cleanup();
  }
});

test('technical6 recovery refuses writes, unknown completion, false baseline counts, missing cleanup and usage resets', async () => {
  for (const baselineDiscoveryFault of [
    'usage',
    'write',
    'actor',
    'cleanup',
    'unknown-completion',
    'baseline-count',
    'foreign',
    'unknown-row',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ baselineDiscovery: true, baselineDiscoveryFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('technical6 recovery requires pinned records and all journal prefixes, dead owners, free locks and every prior6 output absent', async () => {
  const collisions = [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
    'runtime',
  ];
  for (const fault of [
    'receipt',
    'admission',
    'claim',
    'closed',
    'management',
    'control',
    'setup',
    'preflight',
    'historical-runtime',
    'live-parent',
    'live-runtime',
    'live-lock',
    ...collisions,
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ baselineDiscovery: true });
    try {
      const base = f.paths.admission.slice(0, -5),
        paths = {
          receipt: join(
            f.directory,
            'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json',
          ),
          admission: base + '.technical-6.json',
          claim: base + '.technical-6.runtime-claim.json',
          closed: base + '.technical-6.closed.json',
          management: f.paths.management,
          control: f.paths.control,
          setup: f.paths.setup,
          preflight: join(f.directory, 'scripts/n8n/out/foundation/live/preflight.jsonl'),
          'historical-runtime': join(f.directory, 'scripts/n8n/out/foundation/live/runtime.jsonl'),
        };
      if (Object.hasOwn(paths, fault))
        writeFileSync(paths[fault], readFileSync(paths[fault], 'utf8').replace('{', '{ '));
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91007;
      if (fault === 'live-runtime') f.io.processAlive = (pid) => pid === 91008;
      if (fault === 'live-lock')
        f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'SYNTHETIC_ACTIVE_LOCK\n');
      if (collisions.includes(fault))
        f.put(
          fault === 'runtime'
            ? 'scripts/n8n/out/foundation/live/runtime.technical-6.jsonl'
            : 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-6-' +
                fault +
                '.json',
          '{}\n',
        );
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(base + '.technical-7.json'), false);
    } finally {
      f.cleanup();
    }
  }
});

test('closed WF70 two-read diagnostic adds only2 carried controls and keeps152/384/536 blocked before admission', async () => {
  const f = await syntheticProjectVerifiedContinuation({ wf70Readback: true });
  try {
    const live = [f.paths.management, f.paths.control, f.paths.setup].map((p) => [
      p,
      readFileSync(p, 'utf8'),
    ]);
    const result = f.check();
    assert.equal(result.status, 'management_cap_insufficient');
    assert.equal(result.managementAttempts, 152);
    assert.equal(result.controlAttempts, 384);
    assert.equal(result.combinedAttempts, 536);
    assert.equal(result.setupAttempts, 44);
    assert.equal(result.setupMaximum, 88);
    assert.equal(result.privateRead, false);
    assert.equal(result.networkRequests, 0);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.json')), false);
    for (const [p, t] of live) assert.equal(readFileSync(p, 'utf8'), t);
  } finally {
    f.cleanup();
  }
});

test('WF70 diagnostic carry refuses changed scope, effects, unknown closure, reset charges, malformed requests and extra journal suffixes', async () => {
  for (const wf70ReadbackFault of [
    'usage',
    'write',
    'cleanup',
    'unknown-completion',
    'http',
    'scope',
    'ordinal',
    'suffix',
    'unknown-row',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ wf70Readback: true, wf70ReadbackFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('WF70 diagnostic requires immutable complete receipt/journal and dead claim owners; orphan journal cannot be ignored', async () => {
  for (const fault of [
    'receipt',
    'journal',
    'missing-receipt',
    'missing-journal',
    'missing-both',
    'live-parent',
    'live-child',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ wf70Readback: true });
    try {
      const paths = {
        receipt: join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-wf70-readback-20261024.json',
        ),
        journal: join(f.directory, 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl'),
      };
      if (fault === 'receipt' || fault === 'journal')
        writeFileSync(paths[fault], readFileSync(paths[fault], 'utf8') + '\n');
      if (fault === 'missing-receipt') unlinkSync(paths.receipt);
      if (fault === 'missing-journal') unlinkSync(paths.journal);
      if (fault === 'missing-both') {
        unlinkSync(paths.receipt);
        unlinkSync(paths.journal);
      }
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91009;
      if (fault === 'live-child') f.io.processAlive = (pid) => pid === 91010;
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    } finally {
      f.cleanup();
    }
  }
});

test('exact approved576 profile claims technical7 with152/384 retained and every historical512 authority unchanged', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  try {
    const base = f.paths.admission.slice(0, -5),
      retained = [f.paths.management, f.paths.control, base + '.technical-6.closed.json'].map((p) => [
        p,
        readFileSync(p, 'utf8'),
      ]);
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.equal(ready.managementMaximum, 576);
    assert.equal(ready.managementAttempts, 152);
    assert.equal(ready.controlAttempts, 384);
    assert.equal(ready.combinedAttempts, 536);
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.managementMaximum, 576);
    assert.equal(resume.mainManagementAttempts, 142);
    assert.equal(resume.aggregateManagementAttempts, 152);
    assert.equal(resume.mainControlAttempts, 381);
    assert.equal(resume.aggregateControlAttempts, 384);
    assert.equal(resume.technicalAttemptOrdinal, 7);
    assert.equal(proof.carriedControlAttempts, 3);
    const original = JSON.parse(
      readFileSync(
        join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approval-20261022.json',
        ),
        'utf8',
      ),
    );
    assert.equal(original.caps.runtimeManagement, 512);
    assert.equal(original.caps.control, 2048);
    assert.equal(original.caps.combined, 2560);
    for (const [p, t] of retained) assert.equal(readFileSync(p, 'utf8'), t);
  } finally {
    f.cleanup();
  }
});

test('approved management allocation cannot resetusage, widenanothercap, changeownerreply orgrantnewspending', async () => {
  for (const managementAllocationFault of [
    'usage',
    'maximum',
    'combined',
    'reset',
    'actor',
    'spend',
    'reply',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      managementAllocation: true,
      managementAllocationFault,
    });
    try {
      assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.json')), false);
    } finally {
      f.cleanup();
    }
  }
});

test('management576 requires pinnedapprovalandpacket throughclaim and every laterprefixcheck', async () => {
  for (const fault of ['missing', 'changed', 'packet', 'after-claim']) {
    const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
    try {
      const path = join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/' +
          (fault === 'packet'
            ? 'remaining-management-allocation-20261024.md'
            : 'remaining-management-allocation-approval-20261024.json'),
      );
      const proof = fault === 'after-claim' ? f.claim(f.admit()) : null;
      if (fault === 'missing' || fault === 'after-claim') unlinkSync(path);
      else writeFileSync(path, readFileSync(path, 'utf8') + '\n');
      if (proof)
        assert.throws(
          () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
          /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
        );
      else assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    } finally {
      f.cleanup();
    }
  }
});

test('closed technical7 preserves177/435/612 and exact read-only Admin evidence before technical8', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedPreparation: true });
  try {
    const rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const before = readFileSync(f.paths.admission.replace(/\.json$/, '.technical-7.closed.json'), 'utf8');
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.equal(ready.managementMaximum, 576);
    assert.equal(ready.managementAttempts, 177);
    assert.equal(ready.controlAttempts, 435);
    assert.equal(ready.combinedAttempts, 612);
    const p = f.claim(f.admit()),
      r = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(p);
    assert.equal(r.technicalAttemptOrdinal, 8);
    assert.equal(r.mainManagementAttempts, 167);
    assert.equal(r.mainControlAttempts, 432);
    assert.equal(r.aggregateControlAttempts, 435);
    assert.equal(rows.length, 434);
    assert.equal(p.carriedManagementAttempts, 10);
    assert.equal(p.carriedControlAttempts, 3);
    assert.equal(
      readFileSync(f.paths.admission.replace(/\.json$/, '.technical-7.closed.json'), 'utf8'),
      before,
    );
    assert.equal(JSON.parse(before).closureVerified, false);
  } finally {
    f.cleanup();
  }
});
test('technical7 recovery denies unknown work, Admin replay, usage reset and incomplete cleanup', async () => {
  for (const closedPreparationFault of [
    'unknown-completion',
    'admin',
    'usage',
    'write',
    'cleanup',
    'fresh-window',
    'unknown-row',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ closedPreparation: true, closedPreparationFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    } finally {
      f.cleanup();
    }
  }
});
test('technical7 recovery pins every record and refuses missing evidence, live owners and mutation outputs', async () => {
  for (const fault of [
    'receipt',
    'admission',
    'claim',
    'closed',
    'attempt',
    'latest',
    'types',
    'management',
    'control',
    'setup',
    'preflight',
    'runtime',
    'missing-receipt',
    'live-parent',
    'live-child',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
    'new-runtime',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ closedPreparation: true });
    try {
      const base = f.paths.admission.slice(0, -5) + '.technical-7',
        db =
          'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-7';
      const receipt = join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical7-reconciliation-20261024.json',
      );
      const r = JSON.parse(readFileSync(receipt, 'utf8'));
      const paths = {
        receipt,
        admission: base + '.json',
        claim: base + '.runtime-claim.json',
        closed: base + '.closed.json',
        attempt: join(f.directory, r.administrativeResult.attemptPath),
        latest: join(f.directory, r.administrativeResult.receiptPath),
        types: join(f.directory, r.administrativeResult.generatedTypePath),
        management: f.paths.management,
        control: f.paths.control,
        setup: f.paths.setup,
        preflight: join(f.directory, 'scripts/n8n/out/foundation/live/preflight.jsonl'),
        runtime: join(f.directory, 'scripts/n8n/out/foundation/live/runtime.jsonl'),
      };
      if (paths[fault]) writeFileSync(paths[fault], readFileSync(paths[fault], 'utf8') + '\n');
      if (fault === 'missing-receipt') unlinkSync(receipt);
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91011;
      if (fault === 'live-child') f.io.processAlive = (pid) => pid === 91012;
      if (
        ['owner-provision-attempt', 'reactivation-attempt', 'unprovisioned-archive-attempt'].includes(fault)
      )
        f.put(db + '-' + fault + '.json', '{}\n');
      if (fault === 'new-runtime') f.put('scripts/n8n/out/foundation/live/runtime.technical-7.jsonl', '{}\n');
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    } finally {
      f.cleanup();
    }
  }
});
test('technical7 immutable Admin and type evidence remains pinned after claim while legitimate journals append', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedPreparation: true });
  try {
    const p = f.claim(f.admit());
    const lines = readFileSync(f.paths.management, 'utf8');
    writeFileSync(
      f.paths.management,
      lines + JSON.stringify({ event: 'management_attempt', ordinal: 168 }) + '\n',
    );
    const prior = readFileSync(f.paths.control, 'utf8');
    writeFileSync(
      f.paths.control,
      prior +
        JSON.stringify({
          event: 'control_request_intent',
          ordinal: 433,
          kind: 'discovery',
          workflowId: 'MzimjpsuyPuK7SKe',
          at: new Date(f.now()).toISOString(),
        }) +
        '\n',
    );
    const setup = readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse);
    f.scoped(() =>
      f.module.assertFoundationProjectVerifiedContinuationSetupResume(p, {
        sourceCommitSha: p.sourceCommitSha,
        deadlineAt: p.deadlineAt,
        previousEvents: setup,
      }),
    );
    const path = join(
      f.directory,
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical7-reconciliation-20261024.json',
    );
    const r = JSON.parse(readFileSync(path, 'utf8'));
    const type = join(f.directory, r.administrativeResult.generatedTypePath);
    writeFileSync(type, readFileSync(type, 'utf8') + '\n');
    assert.throws(
      () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p)),
      /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
    );
  } finally {
    f.cleanup();
  }
});
test('closed technical8 preserves237/486/723 and both closed SQL rows before the one fresh logical window', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedFixture: true });
  try {
    const previous = readFileSync(f.paths.admission.replace(/\.json$/, '.technical-8.closed.json'), 'utf8');
    const environmentAcks = readFileSync(f.paths.setup, 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse)
      .slice(84)
      .filter((row) => row.event === 'setup_ack' && row.kind === 'environment');
    assert.equal(environmentAcks.length, 7);
    assert.ok(
      environmentAcks.every(
        (row) =>
          !Object.hasOwn(row, 'at') &&
          Number.isSafeInteger(row.createdAt) &&
          Number.isSafeInteger(row.updatedAt),
      ),
    );
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.equal(ready.managementMaximum, 640);
    assert.equal(ready.managementAttempts, 237);
    assert.equal(ready.controlAttempts, 486);
    assert.equal(ready.combinedAttempts, 723);
    const p = f.claim(f.admit());
    const r = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(p);
    assert.equal(r.technicalAttemptOrdinal, 9);
    assert.equal(p.windowId, 'eda4fae1-1e19-47db-81b8-beac1a4ed883');
    assert.equal(r.mainManagementAttempts, 227);
    assert.equal(r.mainControlAttempts, 483);
    assert.equal(r.aggregateManagementAttempts, 237);
    assert.equal(r.aggregateControlAttempts, 486);
    assert.equal(r.setupRows, 155);
    assert.equal(r.setupAttempts, 79);
    assert.equal(r.setupMaximum, 132);
    assert.equal(r.legacySqlAdmitted, 3);
    assert.deepEqual(r.historicalWindowIds, [
      'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
    ]);
    assert.equal(readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').length, 486);
    assert.equal(
      readFileSync(f.paths.admission.replace(/\.json$/, '.technical-8.closed.json'), 'utf8'),
      previous,
    );
    assert.equal(JSON.parse(previous).closureVerified, false);
  } finally {
    f.cleanup();
  }
});
test('technical9 pre-private closure carries263/537/800 without rewriting residual flags before technical10', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedFixture: true, preprivateAdmin: true });
  try {
    const closedPath = f.paths.admission.replace(/\.json$/, '.technical-9.closed.json');
    const previous = readFileSync(closedPath, 'utf8');
    const ready = f.check();
    assert.equal(ready.managementAttempts, 263);
    assert.equal(ready.controlAttempts, 537);
    assert.equal(ready.combinedAttempts, 800);
    const proof = f.claim(f.admit());
    const resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.technicalAttemptOrdinal, 10);
    assert.equal(resume.mainManagementAttempts, 252);
    assert.equal(resume.mainControlAttempts, 534);
    assert.equal(proof.carriedManagementAttempts, 11);
    assert.equal(proof.carriedControlAttempts, 3);
    assert.equal(proof.windowId, 'eda4fae1-1e19-47db-81b8-beac1a4ed883');
    assert.equal(resume.aggregateManagementAttempts + 376, 639);
    assert.equal(resume.setupRows, 155);
    assert.equal(resume.setupAttempts, 79);
    assert.equal(readFileSync(closedPath, 'utf8'), previous);
    assert.equal(JSON.parse(previous).closureVerified, false);
  } finally {
    f.cleanup();
  }
});
test('closed technical10 retains288/588/876 and reports664 over640 without another admission', async () => {
  const f = await syntheticProjectVerifiedContinuation({ preprivateAdmin: true, catalogReadonly: true });
  try {
    const ready = f.check();
    assert.equal(ready.status, 'management_cap_insufficient');
    assert.equal(ready.managementAttempts, 288);
    assert.equal(ready.controlAttempts, 588);
    assert.equal(ready.combinedAttempts, 876);
    assert.equal(ready.setupAttempts, 79);
    assert.equal(ready.managementAttempts + 376, 664);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-11.json')), false);
    const closed = JSON.parse(
      readFileSync(f.paths.admission.replace(/\.json$/, '.technical-10.closed.json'), 'utf8'),
    );
    assert.equal(closed.closureVerified, false);
  } finally {
    f.cleanup();
  }
});
test('approved704 allocation preserves technical10 and all charged usage while admitting only the next technical sibling', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    catalogReadonly: true,
    catalogManagementAllocation: true,
  });
  try {
    const closedPath = f.paths.admission.replace(/\.json$/, '.technical-10.closed.json');
    const closedBefore = readFileSync(closedPath, 'utf8');
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.equal(ready.managementMaximum, 704);
    assert.equal(ready.managementAttempts, 288);
    assert.equal(ready.controlAttempts, 588);
    assert.equal(ready.combinedAttempts, 876);
    const proof = f.claim(f.admit());
    const resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.managementMaximum, 704);
    assert.equal(resume.technicalAttemptOrdinal, 11);
    assert.equal(resume.aggregateManagementAttempts, 288);
    assert.equal(resume.aggregateControlAttempts, 588);
    assert.equal(resume.setupAttempts, 79);
    assert.equal(resume.setupMaximum, 132);
    assert.equal(readFileSync(closedPath, 'utf8'), closedBefore);
    f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof));
    for (const relative of [
      'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json',
      'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md',
    ]) {
      const original = readFileSync(join(f.directory, relative), 'utf8');
      f.put(relative, original + ' ');
      assert.throws(
        () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
        /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
      );
      f.put(relative, original);
    }
  } finally {
    f.cleanup();
  }
});
test('704 approval rejects altered scope, charge resets, extra authority and allocation before technical10 reconciliation', async () => {
  for (const catalogManagementAllocationFault of [
    'reply',
    'source',
    'usage',
    'maximum',
    'vercel',
    'combined',
    'reset',
    'actor',
    'boundary',
    'extra',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({
      catalogReadonly: true,
      catalogManagementAllocation: true,
      catalogManagementAllocationFault,
    });
    try {
      assert.throws(
        () => f.check(),
        /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
        catalogManagementAllocationFault,
      );
    } finally {
      f.cleanup();
    }
  }
  const f = await syntheticProjectVerifiedContinuation({ catalogManagementAllocation: true });
  try {
    assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
  } finally {
    f.cleanup();
  }
});
test('technical11 preserves raw incomplete closure flags and313/639/952 before only technical12 after independent physical cleanup', async () => {
  const f = await syntheticProjectVerifiedContinuation({ adminAdmissionReadonly: true });
  try {
    const closedPath = f.paths.admission.replace(/\.json$/, '.technical-11.closed.json');
    const closedBefore = readFileSync(closedPath, 'utf8');
    const ready = f.check();
    assert.equal(ready.kind, 'project_verified_continuation_ready');
    assert.equal(ready.managementMaximum, 704);
    assert.equal(ready.managementAttempts, 313);
    assert.equal(ready.controlAttempts, 639);
    assert.equal(ready.combinedAttempts, 952);
    const proof = f.claim(f.admit());
    const resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(resume.technicalAttemptOrdinal, 12);
    assert.equal(resume.aggregateManagementAttempts, 313);
    assert.equal(resume.aggregateControlAttempts, 639);
    assert.equal(resume.setupAttempts, 79);
    assert.equal(resume.managementMaximum, 704);
    assert.equal(readFileSync(closedPath, 'utf8'), closedBefore);
    assert.equal(JSON.parse(closedBefore).credentialChildrenClosed, false);
    assert.equal(JSON.parse(closedBefore).closureVerified, false);
    f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof));
    const path =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json';
    f.put(path, readFileSync(join(f.directory, path), 'utf8') + ' ');
    assert.throws(
      () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
      /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
    );
  } finally {
    f.cleanup();
  }
});
test('technical11 rejects authentication claims, unknown work, rewritten rawflags, omitted cleanup, counter resets and orphan Admin artifacts', async () => {
  for (const adminAdmissionReadonlyFault of ['start', 'auth', 'spawn', 'cleanup', 'usage', 'raw', 'code']) {
    const f = await syntheticProjectVerifiedContinuation({
      adminAdmissionReadonly: true,
      adminAdmissionReadonlyFault,
    });
    try {
      assert.throws(
        () => f.check(),
        /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
        adminAdmissionReadonlyFault,
      );
    } finally {
      f.cleanup();
    }
  }
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'unprovisioned-archive-attempt',
    'reactivation-attempt',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ adminAdmissionReadonly: true });
    try {
      f.put(
        `scripts/db/out/m03-foundation-project-verified-continuation-${f.checkpoint.segmentId}-technical-11-${suffix}.json`,
        '{}\n',
      );
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    } finally {
      f.cleanup();
    }
  }
});
test('technical10 readonly recovery refuses writes, incomplete closure, catalog success rewrites and counter resets', async () => {
  for (const catalogReadonlyFault of [
    'start',
    'auth',
    'push',
    'cleanup',
    'vacancy',
    'window',
    'catalog',
    'usage',
    'raw',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ catalogReadonly: true, catalogReadonlyFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, catalogReadonlyFault);
    } finally {
      f.cleanup();
    }
  }
});
test('technical10 public/Admin evidence stays immutable and a retained provisioning intent refuses reconciliation', async () => {
  const f = await syntheticProjectVerifiedContinuation({ catalogReadonly: true });
  try {
    const path = `scripts/db/out/m03-foundation-project-verified-continuation-${f.checkpoint.segmentId}-technical-10-latest.json`;
    const original = readFileSync(join(f.directory, path), 'utf8');
    f.put(path, original + ' ');
    assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    f.put(path, original);
    f.put(path.replace('-latest.json', '-owner-provision-attempt.json'), '{}\n');
    assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
  } finally {
    f.cleanup();
  }
});
test('technical9 pre-private recovery refuses writes, authentication ambiguity, missing cleanup and omitted diagnostic charges', async () => {
  for (const preprivateAdminFault of [
    'start',
    'auth',
    'cleanup',
    'diagnostic',
    'usage',
    'raw',
    'child',
    'setup',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ preprivateAdmin: true, preprivateAdminFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, preprivateAdminFault);
    } finally {
      f.cleanup();
    }
  }
});
test('technical9 immutable raw outputs remain pinned after claim and no live predecessor is accepted', async () => {
  const f = await syntheticProjectVerifiedContinuation({ preprivateAdmin: true });
  try {
    const proof = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === 91015;
    assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    f.io.processAlive = () => false;
    const path =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json';
    f.put(path, readFileSync(join(f.directory, path), 'utf8') + ' ');
    assert.throws(
      () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(proof)),
      /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
    );
  } finally {
    f.cleanup();
  }
});
test('technical8 recovery refuses unknown effects, resets, incomplete close and missing actual state', async () => {
  for (const closedFixtureFault of [
    'unknown-completion',
    'admin',
    'usage',
    'cleanup',
    'actor',
    'mutation',
    'window-open',
    'audit',
    'vacancy',
    'writer-close',
    'unknown-row',
    'ack-timestamp',
    'ack-extra-at',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ closedFixture: true, closedFixtureFault });
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, closedFixtureFault);
    } finally {
      f.cleanup();
    }
  }
});
test('technical8 mandatory receipt and every immutable output stay pinned with no fallback or live owner', async () => {
  for (const fault of [
    'receipt',
    'missing-receipt',
    'admission',
    'runtimeClaim',
    'closed',
    'attempt',
    'latest',
    'provision',
    'reactivation',
    'types',
    'management',
    'control',
    'setup',
    'preflight',
    'runtime',
    'live-parent',
    'live-child',
    'archive',
    'new-runtime',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ closedFixture: true });
    try {
      const relative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json';
      const r = JSON.parse(readFileSync(join(f.directory, relative), 'utf8'));
      const paths = { receipt: join(f.directory, relative) };
      for (const key of ['admission', 'runtimeClaim', 'closed'])
        paths[key] = join(f.directory, r.immutableTechnicalRecords[key].path);
      for (const [i, key] of ['attempt', 'latest', 'provision', 'reactivation', 'types'].entries())
        paths[key] = join(f.directory, r.administrativeResult.pins[i].path);
      for (const key of ['management', 'control', 'setup', 'preflight', 'runtime'])
        paths[key] = join(f.directory, r.actualPublicJournals[key].path);
      if (paths[fault]) appendFileSync(paths[fault], '\n');
      if (fault === 'missing-receipt') unlinkSync(paths.receipt);
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 91013;
      if (fault === 'live-child') f.io.processAlive = (pid) => pid === 91014;
      if (fault === 'archive')
        f.put(
          'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-8-unprovisioned-archive-attempt.json',
          '{}\n',
        );
      if (fault === 'new-runtime') f.put('scripts/n8n/out/foundation/live/runtime.technical-8.jsonl', '{}\n');
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/, fault);
    } finally {
      f.cleanup();
    }
  }
});
test('technical8 immutable state remains pinned after claim while cumulative journals may append', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedFixture: true });
  try {
    const p = f.claim(f.admit());
    appendFileSync(f.paths.management, JSON.stringify({ event: 'management_attempt', ordinal: 228 }) + '\n');
    appendFileSync(
      f.paths.control,
      JSON.stringify({
        event: 'control_request_intent',
        ordinal: 484,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(f.now()).toISOString(),
      }) + '\n',
    );
    f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p));
    const r = JSON.parse(
      readFileSync(
        join(
          f.directory,
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json',
        ),
        'utf8',
      ),
    );
    appendFileSync(join(f.directory, r.administrativeResult.pins[4].path), '\n');
    assert.throws(
      () => f.scoped(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p)),
      /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
    );
  } finally {
    f.cleanup();
  }
});
test('fresh logical plan uses an immutable runtime sibling while original runtime and global journals remain historical', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true }),
    live = liveRuntimeFixture();
  let budget, runtime;
  try {
    const p = f.claim(f.admit()),
      m = await f.copy('foundation-live-runtime.mjs'),
      control = await f.copy('foundation-control-state.mjs');
    const oldRuntime = join(f.directory, 'scripts/n8n/out/foundation/live/runtime.jsonl'),
      before = readFileSync(oldRuntime, 'utf8');
    budget = m.createFoundationLiveManagementBudget(
      { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
      { directory: dirname(f.paths.management), now: f.now, projectVerifiedContinuationProof: p },
    );
    const journal = control.createFoundationControlJournal({
      previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      durableAppend() {},
    });
    const controlBudget = control.createFoundationControlBudget({
      journal,
      now: f.now,
      deadlineAt: p.deadlineAt,
      projectVerifiedContinuationProof: p,
    });
    runtime = m.createFoundationLiveRuntime(
      {
        ...live.input,
        activeWindowId: p.windowId,
        setup: { ...live.input.setup, sourceCommitSha: p.sourceCommitSha },
        deadlineAt: p.deadlineAt,
      },
      { ...live.dependencies, managementBudget: budget, controlJournal: journal, controlBudget, now: f.now },
    );
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    assert.equal(readFileSync(oldRuntime, 'utf8'), before);
    assert.equal(existsSync(join(dirname(oldRuntime), 'runtime.technical-3.jsonl')), true);
    assert.equal(controlBudget.snapshot().attempts, 301);
    assert.equal(budget.snapshot().attempts, 102 + 135);
  } finally {
    runtime?.close();
    budget?.close();
    live.cleanup();
    f.cleanup();
  }
});

test('project-verified continuation public preapproval is non-authoritative and never creates an admission', async () => {
  const f = await syntheticProjectVerifiedContinuation({ approved: false });
  try {
    const result = f.check();
    assert.equal(result.kind, 'project_verified_continuation_approval_required');
    assert.equal(result.status, 'approval_required');
    assert.equal(result.privateRead, false);
    assert.equal(result.networkRequests, 0);
    assert.equal(Object.keys(result).length, 8);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(result));
    assert.equal(existsSync(f.paths.admission), false);
    assert.equal(existsSync(f.paths.claim), false);
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation preapproval does not inspect any credential-named path metadata', async () => {
  const f = await syntheticProjectVerifiedContinuation({ approved: false });
  let privateMetadataCalls = 0;
  try {
    f.io.lstatSync = (path) => {
      if (/(?:\.dpapi|\.lease\.json)$/.test(String(path))) {
        privateMetadataCalls++;
        throw Error('SYNTHETIC_PRIVATE_PATH_METADATA_BLOCKED');
      }
      return lstatSync(path);
    };
    assert.equal(f.check().status, 'approval_required');
    assert.throws(() => f.admit());
    assert.equal(privateMetadataCalls, 0);
  } finally {
    f.cleanup();
  }
});

test('separately approved synthetic project-verified continuation has its own one-use claimed proof and unchanged clock caps', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const beforeControl = readFileSync(f.paths.control, 'utf8');
    assert.equal(beforeControl.trimEnd().split('\n').length, 200);
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    assert.equal(Object.keys(f.check()).length, 6);
    const p = f.admit();
    assert.equal(p.kind, 'foundation_project_verified_continuation');
    assert.equal(p.deadlineAt - p.startsAt, 3600000);
    assert.equal(p.stopNewAt - p.startsAt, 3000000);
    assert.equal(p.hardDeadlineAt - p.startsAt, 4200000);
    assert.equal(p.carriedManagementAttempts, 4);
    assert.equal(p.carriedControlAttempts, 1);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true }));
    const claimed = f.claim(p);
    assert.equal(
      f.module.assertFoundationLiveProjectVerifiedContinuationProof(claimed, { claimed: true }),
      claimed,
    );
    assert.throws(() =>
      f.module.assertFoundationLiveProjectVerifiedContinuationProof({ ...claimed }, { claimed: true }),
    );
    assert.throws(() => f.admit());
    assert.throws(() => f.claim(p));
    assert.equal(readFileSync(f.paths.control, 'utf8'), beforeControl);
    f.setTime(p.stopNewAt);
    assert.throws(() => f.read());
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation and spent remaining proofs cannot cross their distinct WeakMap authority brands', async () => {
  const current = await syntheticProjectVerifiedContinuation();
  const spent = await syntheticRemainingContinuation();
  try {
    const currentProof = current.claim(current.admit());
    const oldProof = spent.claim(spent.admit());
    assert.throws(() =>
      current.module.assertFoundationLiveProjectVerifiedContinuationProof(oldProof, { claimed: true }),
    );
    assert.throws(() =>
      spent.module.assertFoundationLiveRemainingContinuationProof(currentProof, { claimed: true }),
    );
  } finally {
    current.cleanup();
    spent.cleanup();
  }
});

test('the project-verified continuation raw200-row control checkpoint cannot be normalized, edited or extended before admission/claim', async () => {
  for (const fault of ['byte-drift', 'ordinal', 'extra', 'claim-drift']) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      const p = fault === 'claim-drift' ? f.admit() : null;
      const text = readFileSync(f.paths.control, 'utf8');
      if (fault === 'extra')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 201, kind: 'discovery' }) + '\n',
        );
      else
        writeFileSync(
          f.paths.control,
          fault === 'ordinal' ? text.replace('"ordinal":200', '"ordinal":199') : text.replace('{', '{ '),
        );
      assert.throws(() => (p === null ? f.admit() : f.claim(p)));
    } finally {
      f.cleanup();
    }
  }
});

test('project-verified continuation ReadClaimed requires live owners/lock and preserves legitimate appended50 baseline rows', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const p = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    assert.throws(() => f.readClaimed());
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    for (let ordinal = 201; ordinal <= 250; ordinal++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({ event: 'control_request_intent', ordinal, kind: 'discovery' }) + '\n',
      );
    const q = f.readClaimed();
    assert.equal(q.segmentId, p.segmentId);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(q, { claimed: true }));
    f.io.processAlive = () => false;
    assert.throws(() => f.readClaimed());
    f.io.processAlive = () => true;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'FOREIGN\n');
    assert.throws(() => f.readClaimed());
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation partial claim/admission and foreign prior provision intent are irreversible denials', async () => {
  for (const fault of ['partial-admission', 'partial-claim', 'e803-provision', 'new-state']) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      let p;
      if (fault === 'partial-claim') p = f.admit();
      if (fault.startsWith('partial')) f.io.writeSync = () => 0;
      if (fault === 'e803-provision')
        f.put(
          'scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json',
          '{}\n',
        );
      if (fault === 'new-state')
        f.put(
          `scripts/db/out/m03-foundation-project-verified-continuation-${f.checkpoint.segmentId}-attempt.json`,
          '{}\n',
        );
      assert.throws(() => (p ? f.claim(p) : f.admit()));
      if (fault.startsWith('partial')) {
        delete f.io.writeSync;
        assert.equal(existsSync(p ? f.paths.claim : f.paths.admission), true);
        assert.throws(() => (p ? f.claim(p) : f.admit()));
      }
    } finally {
      f.cleanup();
    }
  }
});

test('pinned historical cleanup must retain nine exact leaves and explicit unknown orphan state', async () => {
  for (const cleanupFault of ['overclaimed-orphans', 'incomplete-leaves', 'private-read']) {
    const f = await syntheticProjectVerifiedContinuation({ cleanupFault });
    try {
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('live retired e803 roots and a foreign canonical public parent cannot admit a replacement', async () => {
  for (const fault of [
    'parent-live',
    'runtime-live',
    'startup-parent-live',
    'startup-runtime-live',
    'foreign-parent',
  ]) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      if (fault === 'parent-live') f.io.processAlive = (pid) => pid === 5468;
      if (fault === 'runtime-live') f.io.processAlive = (pid) => pid === 35920;
      if (fault === 'startup-parent-live') f.io.processAlive = (pid) => pid === 44408;
      if (fault === 'startup-runtime-live') f.io.processAlive = (pid) => pid === 60040;
      if (fault === 'foreign-parent')
        f.put(
          'synthetic-localappdata/Temp/' + f.checkpoint.parentLockFilename,
          JSON.stringify({
            kind: 'm03_clock_admission_parent',
            version: 1,
            segmentId: f.checkpoint.segmentId,
            processId: process.ppid + 1,
          }) + '\n',
        );
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('repinned current archive/wrapper or positive project receipt failures cannot be nominally accepted', async () => {
  for (const options of [
    { priorFault: 'archive' },
    { priorFault: 'wrapper' },
    { projectFault: 'extra-get' },
    { projectFault: 'predicate' },
  ]) {
    const f = await syntheticProjectVerifiedContinuation(options);
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('missing captured current wrapper receipt blocks before any new clock, and old startup brands cannot cross', async () => {
  const current = await syntheticProjectVerifiedContinuation();
  const spent = await syntheticStartupReplacement();
  try {
    const p = current.claim(current.admit()),
      old = spent.claim(spent.admit());
    assert.throws(() =>
      current.module.assertFoundationLiveProjectVerifiedContinuationProof(old, { claimed: true }),
    );
    assert.throws(() => spent.module.assertFoundationLiveStartupReplacementProof(p, { claimed: true }));
  } finally {
    current.cleanup();
    spent.cleanup();
  }
  const f = await syntheticProjectVerifiedContinuation();
  try {
    unlinkSync(
      join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json',
      ),
    );
    assert.throws(() => f.check());
    assert.throws(() => f.admit());
    assert.equal(existsSync(f.paths.admission), false);
  } finally {
    f.cleanup();
  }
});

test('only the genuine current project-verified claim permits exact200-row control and the two historical setup GETs', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const p = f.claim(f.admit()),
      rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const control = { deadlineAt: p.deadlineAt, previousEvents: rows };
    assert.equal(f.module.assertFoundationProjectVerifiedContinuationControlResume(p, control), p);
    assert.throws(() => f.module.assertFoundationProjectVerifiedContinuationControlResume({ ...p }, control));
    assert.throws(() =>
      f.module.assertFoundationProjectVerifiedContinuationControlResume(p, {
        ...control,
        previousEvents: rows.slice(1),
      }),
    );
    const setup = {
      sourceCommitSha: p.sourceCommitSha,
      deadlineAt: p.deadlineAt,
      previousEvents: [
        { event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 },
        { event: 'setup_attempt', ordinal: 2, kind: 'GET', at: 1792666486587 },
      ],
    };
    assert.equal(f.module.assertFoundationProjectVerifiedContinuationSetupResume(p, setup), p);
    assert.throws(() =>
      f.module.assertFoundationProjectVerifiedContinuationSetupResume(p, {
        ...setup,
        previousEvents: [{ ...setup.previousEvents[0], kind: 'POST' }],
      }),
    );
    const original = readFileSync(f.paths.management, 'utf8');
    writeFileSync(f.paths.management, original.replace('{"event"', '{ "event"'));
    assert.throws(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p));
  } finally {
    f.cleanup();
  }
});

test('new project-verified authority has an independent segment and preserved outside carries', async () => {
  const mod = await import('./foundation-live-project-verified-continuation.mjs');
  const c = mod.foundationProjectVerifiedContinuationCheckpoint;
  assert.equal(c.segmentId, '20275b22-b7fe-4737-a9a4-c50c2feadb74');
  assert.equal(c.carriedManagementAttempts, 4);
  assert.equal(c.carriedControlAttempts, 1);
  assert.throws(() =>
    mod.assertFoundationLiveProjectVerifiedContinuationProof(
      Object.freeze({ kind: 'foundation_project_verified_continuation' }),
    ),
  );
});

test('synthetic project-verified public readiness and genuine claim preserve all counters', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const proof = f.claim(f.admit());
    assert.equal(proof.carriedManagementAttempts, 4);
    assert.equal(
      f.module.assertFoundationLiveProjectVerifiedContinuationProof(proof, { claimed: true }),
      proof,
    );
  } finally {
    f.cleanup();
  }
});

test('standing M03 authority permits a fresh technical attempt after proven no-effect closure, preserving its spent admission and claim', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const first = f.claim(f.admit());
    const admission = readFileSync(f.paths.admission, 'utf8');
    const claim = readFileSync(f.paths.claim, 'utf8');
    f.setTime(first.hardDeadlineAt + 1000);
    f.put(
      f.checkpoint.admissionRelative.replace(/\.json$/, '.closed.json'),
      JSON.stringify({
        kind: 'm03_project_verified_technical_closed',
        version: 1,
        admissionSha256: (await import('node:crypto')).createHash('sha256').update(admission).digest('hex'),
        parentProcessId: process.ppid,
        runtimeProcessId: process.pid,
        closedAt: first.hardDeadlineAt,
        childClosed: true,
        credentialChildrenClosed: true,
        emergencyShutdown: false,
        pendingMachinePreserved: true,
        nativeExit: 0,
        bypassHandoffDeleted: true,
        closureVerified: true,
      }) + '\n',
    );
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const second = f.admit();
    assert.equal(second.startsAt, f.now());
    assert.equal(second.deadlineAt - second.startsAt, 3600000);
    assert.equal(second.carriedManagementAttempts, 4);
    assert.equal(second.carriedControlAttempts, 1);
    assert.equal(readFileSync(f.paths.admission, 'utf8'), admission);
    assert.equal(readFileSync(f.paths.claim, 'utf8'), claim);
    assert.equal(f.claim(second).startsAt, second.startsAt);
    assert.equal(f.read().startsAt, second.startsAt);
  } finally {
    f.cleanup();
  }
});

test('technical retry requires reconciliation for missing closure, live children, effects, mutation intents and changed counters', async () => {
  for (const fault of [
    'missing-close',
    'unclosed',
    'live-child',
    'effect',
    'counter',
    'missing-native-exit',
    'emergency',
    'orphan-technical-claim',
    'orphan-technical-close',
    'runtime-journal',
  ]) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      const p = f.claim(f.admit());
      const admission = readFileSync(f.paths.admission, 'utf8');
      f.setTime(p.hardDeadlineAt + 1000);
      if (fault !== 'missing-close')
        f.put(
          f.checkpoint.admissionRelative.replace(/\.json$/, '.closed.json'),
          JSON.stringify({
            kind: 'm03_project_verified_technical_closed',
            version: 1,
            admissionSha256: (await import('node:crypto'))
              .createHash('sha256')
              .update(admission)
              .digest('hex'),
            parentProcessId: process.ppid,
            runtimeProcessId: process.pid,
            closedAt: p.hardDeadlineAt,
            childClosed: fault !== 'unclosed',
            credentialChildrenClosed: true,
            emergencyShutdown: fault === 'emergency',
            pendingMachinePreserved: true,
            nativeExit: fault === 'missing-native-exit' ? null : 0,
            bypassHandoffDeleted: true,
            closureVerified: true,
          }) + '\n',
        );
      if (fault === 'live-child') f.io.processAlive = (pid) => pid === process.pid;
      if (fault === 'effect')
        f.put(
          `scripts/db/out/m03-foundation-project-verified-continuation-${p.segmentId}-attempt.json`,
          '{}\n',
        );
      if (fault === 'counter')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 201, kind: 'discovery' }) + '\n',
        );
      if (fault.startsWith('orphan-technical-'))
        f.put(
          f.checkpoint.admissionRelative.replace(
            /\.json$/,
            fault.endsWith('claim') ? '.technical-2.runtime-claim.json' : '.technical-2.closed.json',
          ),
          '{}\n',
        );
      if (fault === 'runtime-journal') f.put('scripts/n8n/out/foundation/live/runtime.jsonl', '{}\n');
      assert.equal(
        f.module.reconcileFoundationProjectVerifiedContinuation({ now: f.now }, f.io).status,
        'reconciliation_required',
      );
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});

test('pinned CLOSED effectful attempt permits a distinct immutable technical sibling with all actual counters retained', async () => {
  const f = await syntheticProjectVerifiedContinuation({ effectful: true });
  let budget;
  try {
    const original = [
      f.paths.admission,
      f.paths.claim,
      f.paths.admission.replace(/\.json$/, '.closed.json'),
    ].map((path) => readFileSync(path, 'utf8'));
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    assert.equal(
      f.scoped(() => f.module.reconcileFoundationProjectVerifiedContinuation({ now: f.now }, f.io)).status,
      'ready_reconciled_effects',
    );
    const p = f.claim(f.admit());
    assert.deepEqual(f.module.foundationProjectVerifiedContinuationResumeCheckpoint(p), {
      mainManagementAttempts: 9,
      aggregateManagementAttempts: 13,
      managementMaximum: 512,
      mainControlAttempts: 250,
      aggregateControlAttempts: 251,
      setupRows: 13,
      setupAttempts: 9,
      preflightRows: 1,
      technicalAttemptOrdinal: 2,
    });
    assert.throws(() => f.module.foundationProjectVerifiedContinuationResumeCheckpoint({ ...p }));
    for (const [i, path] of [
      f.paths.admission,
      f.paths.claim,
      f.paths.admission.replace(/\.json$/, '.closed.json'),
    ].entries())
      assert.equal(readFileSync(path, 'utf8'), original[i]);
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-2.json')), true);
    const management = await f.copy('foundation-live-runtime.mjs');
    budget = management.createFoundationLiveManagementBudget(
      { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
      { directory: dirname(f.paths.management), now: f.now, projectVerifiedContinuationProof: p },
    );
    assert.equal(budget.snapshot().attempts, 13);
    budget.admit();
    assert.equal(budget.snapshot().attempts, 14);
    const control = await f.copy('foundation-control-state.mjs');
    const journal = control.createFoundationControlJournal({
      previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      durableAppend: () => {},
    });
    const controlBudget = control.createFoundationControlBudget({
      journal,
      deadlineAt: p.deadlineAt,
      now: f.now,
      projectVerifiedContinuationProof: p,
    });
    assert.equal(controlBudget.snapshot().attempts, 251);
    controlBudget.admit({ kind: 'discovery' });
    assert.equal(controlBudget.snapshot().attempts, 252);
    assert.throws(() => f.admit());
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('effectful recovery requires pinned truthful closure, zero actor/workflow work, archive and independently approved scope', async () => {
  for (const effectFault of ['archive', 'actor', 'children', 'bypass', 'sql-window']) {
    const f = await syntheticProjectVerifiedContinuation({ effectful: true, effectFault });
    try {
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
  for (const fault of [
    'missing-approval',
    'changed-proposal',
    'live-parent',
    'live-runtime',
    'unknown-db-intent',
    'orphan-technical',
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ effectful: true });
    try {
      if (fault === 'missing-approval')
        unlinkSync(
          join(
            f.directory,
            'milestones/M03-n8n-foundation/evidence/sole-bypass-scope-approval-20261023.json',
          ),
        );
      if (fault === 'changed-proposal')
        f.put('milestones/M03-n8n-foundation/evidence/sole-bypass-scope-decision-20261023.md', 'CHANGED\n');
      if (fault === 'live-parent') f.io.processAlive = (pid) => pid === 30232;
      if (fault === 'live-runtime') f.io.processAlive = (pid) => pid === 63592;
      if (fault === 'unknown-db-intent')
        f.put(
          `scripts/db/out/m03-foundation-project-verified-continuation-${f.checkpoint.segmentId}-owner-provision-attempt.json`,
          '{}\n',
        );
      if (fault === 'orphan-technical')
        f.put(f.checkpoint.admissionRelative.replace(/\.json$/, '.technical-2.runtime-claim.json'), '{}\n');
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});

test('effectful raw journal and preflight prefixes cannot be edited, normalized or extended before admission', async () => {
  for (const name of ['management', 'control', 'setup', 'preflight'])
    for (const extension of [false, true]) {
      const f = await syntheticProjectVerifiedContinuation({ effectful: true });
      try {
        const path = join(f.directory, 'scripts/n8n/out/foundation/live/' + name + '.jsonl');
        const text = readFileSync(path, 'utf8');
        writeFileSync(path, extension ? text + '{}\n' : text.replace('{', '{ '));
        assert.throws(() => f.check());
        assert.throws(() => f.admit());
      } finally {
        f.cleanup();
      }
    }
});
