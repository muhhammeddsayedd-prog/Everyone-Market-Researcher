import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFileSync, existsSync, lstatSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';
import { syntheticStartupReplacement } from './foundation-live-startup-replacement-fixtures.mjs';
import { fixture as liveRuntimeFixture } from './foundation-live-runtime-fixtures.mjs';

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
    assert.equal(budget.snapshot().attempts, 102 + 134);
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
