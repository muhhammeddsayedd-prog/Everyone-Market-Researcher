import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { foundationFunctionalBaselineVersions } from './foundation-runtime-plan.mjs';
import {
  createFoundationLiveSetup,
  createFoundationLiveSetupJournal,
  foundationLiveSetupScope,
  assertFoundationLiveDeployment,
  foundationLiveSetupRequestPlan,
} from './foundation-live-setup.mjs';

function functionalScope() {
  return {
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    windowId: '11111111-1111-4111-8111-111111111111',
    sourceCommitSha: sha,
    caps: { management: 2048, control: 3584, combined: 5312, vercel: 352 },
    carried: { management: 1661, control: 1464, combined: 3125, vercel: 288 },
    restoredBaselineVersions: foundationFunctionalBaselineVersions(),
  };
}
test('functional protected Preview retains288 charged requests,12 polls and18 shutdown requests', async () => {
  const scope = functionalScope();
  let attempts = 1661;
  const managementBudget = {
    admit() {
      attempts++;
    },
    snapshot() {
      return { attempts, maximum: 2048 };
    },
    attachTransport() {},
  };
  const f = fixture({
    functionalScope: scope,
    activeWindowId: scope.windowId,
    maximumRequests: 352,
    expectedMigrationCount: 15,
    managementBudget,
    fault: 'last_poll',
  });
  try {
    assert.equal(f.setup.snapshot().requestCount, 288);
    await f.setup.prepare();
    assert.equal(f.setup.snapshot().buildPollLimit, 12);
    const close = await f.setup.cleanup();
    assert.equal(close.state, 'setup_resources_removed');
    assert.equal(f.calls.length, 44);
    assert.equal(close.requestCount, 332);
    assert.equal(attempts, 1705);
    assert.equal(f.rows.filter((r) => r.event === 'setup_attempt')[0].ordinal, 289);
    assert.equal(f.rows.filter((r) => r.event === 'setup_attempt').at(-1).ordinal, 332);
    assert.equal(f.envs.length, 0);
    assert.deepEqual(f.bypass, {});
  } finally {
    f.setup.close();
  }
});
test('functional setup refuses scope drift, old windows and an unscoped352 journal before requests', () => {
  const scope = functionalScope();
  assert.throws(() =>
    createFoundationLiveSetupJournal({ sourceCommitSha: sha, maximumRequests: 352, durableAppend() {} }),
  );
  for (const edit of [
    (s) => {
      s.projectRef = 'hkiafqrcxaafdbcvjlzv';
    },
    (s) => {
      s.caps.vercel = 353;
    },
    (s) => {
      s.carried.vercel = 0;
    },
    (s) => {
      s.windowId = foundationLiveSetupScope.windowId;
    },
    (s) => {
      s.sourceCommitSha = 'b'.repeat(40);
    },
  ]) {
    const changed = structuredClone(scope);
    edit(changed);
    assert.throws(() =>
      fixture({
        functionalScope: changed,
        activeWindowId: changed.windowId,
        maximumRequests: 352,
        expectedMigrationCount: 15,
      }),
    );
  }
});

test('technical20 Vercel capacity304 retains254 charges and never grants an unbranded setup continuation', () => {
  const p = foundationLiveSetupRequestPlan(254, 304);
  assert.equal(p.buildPollLimit, 12);
  assert.equal(p.cleanupReserve, 18);
  assert.equal(254 + p.maximumNewPrepareRequests + p.cleanupReserve, 298);
  assert.throws(() =>
    fixture({ maximumRequests: 304, activeWindowId: 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a' }),
  );
  assert.throws(() => foundationLiveSetupRequestPlan(254, 305));
});

test('technical17 Vercel capacity256 is planning only and never a caller supplied setup grant', () => {
  const p = foundationLiveSetupRequestPlan(184, 256);
  assert.equal(p.buildPollLimit, 12);
  assert.equal(p.cleanupReserve, 18);
  assert.equal(184 + p.maximumNewPrepareRequests + p.cleanupReserve, 228);
  assert.throws(() =>
    fixture({ maximumRequests: 256, activeWindowId: 'edbc6d11-7c1f-43a7-b745-1ded06deb29f' }),
  );
  assert.throws(() => foundationLiveSetupRequestPlan(184, 257));
});

test('setup event capacity976 remains bounded independently of the approved256 request ceiling', () => {
  const capacity = 3 * 304 + 64;
  const events = Array.from({ length: capacity }, (_, at) => ({
    event: 'setup_verified',
    kind: 'deployment',
    at,
    deploymentId: 'dpl_SyntheticRowCapacity',
    audience: 'https://everyone-market-researcher-row-capacity.vercel.app',
  }));
  const build = (previousEvents) =>
    createFoundationLiveSetupJournal({
      sourceCommitSha: sha,
      maximumRequests: 256,
      durableAppend() {},
      previousEvents,
    });
  const loaded = build(events);
  assert.equal(loaded.rows.length, capacity);
  assert.throws(() => loaded.append(events[0]), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.throws(() => build([...events, events[0]]), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  const appended = build(events.slice(0, -1));
  appended.append(events.at(-1));
  assert.equal(appended.rows.length, capacity);
  assert.throws(() => appended.append(events[0]), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.throws(() => build([{ ...events[0], unexpected: true }]), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.throws(
    () => build([{ event: 'setup_attempt', ordinal: 257, kind: 'GET', at: epoch }]),
    /FOUNDATION_LIVE_SETUP_BLOCKED/,
  );
});

test('genuine19 retains all439 prior setup rows and219 requests through complete owned prepare and cleanup', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical16Settled: true,
    technical17PreReady: true,
    technical18Closed: true,
  });
  let budget, current;
  try {
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
      runtimeModule = await f.copy('foundation-live-runtime.mjs'),
      setupModule = await f.copy('foundation-live-setup.mjs'),
      previousText = readFileSync(f.paths.setup, 'utf8'),
      previousEvents = previousText.trimEnd().split('\n').map(JSON.parse);
    assert.equal(previousEvents.length, 439);
    assert.equal(previousEvents.filter((row) => row.event === 'setup_attempt').length, 219);
    assert.equal(resume.setupMaximum, 256);
    assert.equal(resume.aggregateManagementAttempts, 1023);
    budget = runtimeModule.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => resume.aggregateControlAttempts,
      },
    );
    current = fixture({
      fault: 'fifth_poll',
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents,
      activeWindowId: proof.windowId,
      maximumRequests: 256,
      expectedMigrationCount: 15,
      managementBudget: budget,
    });
    assert.equal(current.setup.snapshot().requestCount, 219);
    await current.setup.prepare();
    assert.equal(current.setup.snapshot().buildPollLimit, 5);
    const close = await current.setup.cleanup();
    assert.equal(close.state, 'setup_resources_removed');
    assert.equal(
      current.calls.filter((call) => call.method === 'POST' && call.path.includes('/env?')).length,
      7,
    );
    assert.equal(current.calls.filter((call) => call.method === 'DELETE').length, 7);
    assert.equal(current.calls.filter((call) => call.body?.generate).length, 1);
    assert.equal(current.calls.filter((call) => call.body?.revoke).length, 1);
    assert.ok(current.journal.rows.length > 500);
    assert.equal(current.journal.rows.length, 512);
    assert.equal(close.requestCount, 219 + current.calls.length);
    assert.equal(close.requestCount, 256);
    assert.equal(budget.snapshot().attempts, 1023 + current.calls.length);
    assert.deepEqual(current.bypass, {});
    assert.equal(current.envs.length, 0);
    assert.equal(readFileSync(f.paths.setup, 'utf8'), previousText);
  } finally {
    current?.setup.close();
    budget?.close();
    f.cleanup();
  }
});

test('genuine20 retains all510 prior setup rows and254 requests through complete owned prepare and cleanup', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical16Settled: true,
    technical17PreReady: true,
    technical18Closed: true,
    technical19Restored: true,
    technical20SourceSelected: true,
  });
  let budget, current;
  try {
    const proof = f.claim(f.admit()),
      resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
      runtimeModule = await f.copy('foundation-live-runtime.mjs'),
      setupModule = await f.copy('foundation-live-setup.mjs'),
      previousText = readFileSync(f.paths.setup, 'utf8'),
      previousEvents = previousText.trimEnd().split('\n').map(JSON.parse);
    assert.equal(previousEvents.length, 510);
    assert.equal(previousEvents.filter((row) => row.event === 'setup_attempt').length, 254);
    assert.equal(resume.setupMaximum, 304);
    assert.equal(resume.aggregateManagementAttempts, 1317);
    budget = runtimeModule.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => resume.aggregateControlAttempts,
      },
    );
    current = fixture({
      fault: 'last_poll',
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents,
      activeWindowId: proof.windowId,
      maximumRequests: 304,
      expectedMigrationCount: 15,
      managementBudget: budget,
    });
    assert.equal(current.setup.snapshot().requestCount, 254);
    await current.setup.prepare();
    assert.equal(current.setup.snapshot().buildPollLimit, 12);
    const close = await current.setup.cleanup();
    assert.equal(close.state, 'setup_resources_removed');
    assert.equal(
      current.calls.filter((call) => call.method === 'POST' && call.path.includes('/env?')).length,
      7,
    );
    assert.equal(current.calls.filter((call) => call.method === 'DELETE').length, 7);
    assert.equal(current.calls.filter((call) => call.body?.generate).length, 1);
    assert.equal(current.calls.filter((call) => call.body?.revoke).length, 1);
    assert.ok(current.journal.rows.length > 500);
    assert.equal(current.journal.rows.length, 590);
    assert.equal(close.requestCount, 254 + current.calls.length);
    assert.equal(close.requestCount, 298);
    assert.equal(budget.snapshot().attempts, 1317 + current.calls.length);
    assert.deepEqual(current.bypass, {});
    assert.equal(current.envs.length, 0);
    assert.equal(readFileSync(f.paths.setup, 'utf8'), previousText);
  } finally {
    current?.setup.close();
    budget?.close();
    f.cleanup();
  }
});

// Scripted Vercel API boundaries only: no actual deployment, key or network.
const scope = foundationLiveSetupScope;
const sha = 'f'.repeat(40),
  epoch = Date.parse('2026-10-21T08:00:00.000Z');
const secret = {
  writerPassword: 'SYNTHETIC_SETUP_WRITER_ONLY',
  machineToken: 'M'.repeat(43),
  apifyReadToken: 'SYNTHETIC_SEPARATE_APIFY_READER',
  protectionBypass: 'N'.repeat(32),
};
// Exact PUBLIC84-row,44-request historical metadata journal captured after verified cleanup.
// It contains IDs/scope metadata only; no values, credentials, auth or network reads.
const cleanedLegacySetupJsonl = `{"event":"setup_attempt","ordinal":1,"kind":"GET","at":1792608136543}
{"event":"setup_attempt","ordinal":2,"kind":"GET","at":1792666486587}
{"event":"setup_attempt","ordinal":3,"kind":"GET","at":1792763737227}
{"event":"setup_attempt","ordinal":4,"kind":"GET","at":1792763739727}
{"event":"setup_intent","kind":"bypass","at":1792763742402}
{"event":"setup_attempt","ordinal":5,"kind":"PATCH","at":1792763742407}
{"event":"setup_ack","kind":"bypass","at":1792763745142}
{"event":"setup_attempt","ordinal":6,"kind":"PATCH","at":1792763745148}
{"event":"setup_attempt","ordinal":7,"kind":"GET","at":1792763763179}
{"event":"setup_cleanup_intent","kind":"bypass","at":1792763765746}
{"event":"setup_attempt","ordinal":8,"kind":"PATCH","at":1792763765751}
{"event":"setup_attempt","ordinal":9,"kind":"GET","at":1792763768220}
{"event":"setup_cleanup_absent","kind":"bypass","at":1792763770653}
{"event":"setup_attempt","ordinal":10,"kind":"GET","at":1792770385610}
{"event":"setup_attempt","ordinal":11,"kind":"GET","at":1792770388160}
{"event":"setup_intent","kind":"bypass","at":1792770390664}
{"event":"setup_attempt","ordinal":12,"kind":"PATCH","at":1792770390668}
{"event":"setup_ack","kind":"bypass","at":1792770393132}
{"event":"setup_attempt","ordinal":13,"kind":"GET","at":1792770393137}
{"event":"setup_verified","kind":"bypass","at":1792770395587,"createdAt":1792770393383,"soleOwnedDefaultVerified":true,"nonDefaultVerified":false,"observedDefaultFlag":"true"}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_ENABLED","at":1792770395589}
{"event":"setup_attempt","ordinal":14,"kind":"POST","at":1792770395592}
{"event":"setup_ack","kind":"environment","id":"BANdqedkjfktF2vy","key":"EMR_M03_FOUNDATION_ENABLED","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770399411,"updatedAt":1792770399411}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_WINDOW_ID","at":1792770399182}
{"event":"setup_attempt","ordinal":15,"kind":"POST","at":1792770399188}
{"event":"setup_ack","kind":"environment","id":"yhOy0BjVgrvMKBpr","key":"EMR_M03_FOUNDATION_WINDOW_ID","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770401946,"updatedAt":1792770401946}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_WRITER_PASSWORD","at":1792770401693}
{"event":"setup_attempt","ordinal":16,"kind":"POST","at":1792770401698}
{"event":"setup_ack","kind":"environment","id":"5kNmNA0oKiXnXDr7","key":"EMR_M03_FOUNDATION_WRITER_PASSWORD","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770404421,"updatedAt":1792770404421}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_APIFY_READ_TOKEN","at":1792770404170}
{"event":"setup_attempt","ordinal":17,"kind":"POST","at":1792770404175}
{"event":"setup_ack","kind":"environment","id":"sP6c78IvUkuh0q1y","key":"EMR_M03_FOUNDATION_APIFY_READ_TOKEN","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770406841,"updatedAt":1792770406841}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_TOKEN_SHA256","at":1792770406591}
{"event":"setup_attempt","ordinal":18,"kind":"POST","at":1792770406594}
{"event":"setup_ack","kind":"environment","id":"O63SRoiYRJSB3lR2","key":"EMR_M03_FOUNDATION_TOKEN_SHA256","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770409304,"updatedAt":1792770409304}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_AUDIENCE","at":1792770409067}
{"event":"setup_attempt","ordinal":19,"kind":"POST","at":1792770409070}
{"event":"setup_ack","kind":"environment","id":"EKbTlPeSsL7x7Jsg","key":"EMR_M03_FOUNDATION_AUDIENCE","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770411758,"updatedAt":1792770411758}
{"event":"setup_intent","kind":"environment","key":"EMR_M03_FOUNDATION_COMMIT_SHA","at":1792770411527}
{"event":"setup_attempt","ordinal":20,"kind":"POST","at":1792770411530}
{"event":"setup_ack","kind":"environment","id":"R6oLddAHm22ATdYK","key":"EMR_M03_FOUNDATION_COMMIT_SHA","type":"sensitive","target":["preview"],"gitBranch":"m03-n8n-foundation","comment":"M03 foundation temporary dev df4f29ec-e2dc-4d82-a276-62a4e695e6f9","createdAt":1792770415379,"updatedAt":1792770415379}
{"event":"setup_attempt","ordinal":21,"kind":"GET","at":1792770415160}
{"event":"setup_intent","kind":"deployment","at":1792770417614}
{"event":"setup_attempt","ordinal":22,"kind":"POST","at":1792770417617}
{"event":"setup_ack","kind":"deployment","deploymentId":"dpl_8gyW2MmNfAK4ARLKcKEWkbDxtuiv","audience":"https://everyone-market-researcher-eb5no2yxz-muhammed-abdelrahman.vercel.app","at":1792770422101}
{"event":"setup_attempt","ordinal":23,"kind":"GET","at":1792770422104}
{"event":"setup_attempt","ordinal":24,"kind":"GET","at":1792770439709}
{"event":"setup_attempt","ordinal":25,"kind":"GET","at":1792770457874}
{"event":"setup_attempt","ordinal":26,"kind":"GET","at":1792770460578}
{"event":"setup_verified","kind":"deployment","deploymentId":"dpl_8gyW2MmNfAK4ARLKcKEWkbDxtuiv","audience":"https://everyone-market-researcher-eb5no2yxz-muhammed-abdelrahman.vercel.app","at":1792770462994}
{"event":"setup_attempt","ordinal":27,"kind":"GET","at":1792770525975}
{"event":"setup_cleanup_intent","kind":"environment","id":"BANdqedkjfktF2vy","key":"EMR_M03_FOUNDATION_ENABLED","at":1792770528363}
{"event":"setup_attempt","ordinal":28,"kind":"DELETE","at":1792770528367}
{"event":"setup_attempt","ordinal":29,"kind":"GET","at":1792770530827}
{"event":"setup_cleanup_absent","kind":"environment","id":"BANdqedkjfktF2vy","key":"EMR_M03_FOUNDATION_ENABLED","at":1792770533351}
{"event":"setup_cleanup_intent","kind":"environment","id":"yhOy0BjVgrvMKBpr","key":"EMR_M03_FOUNDATION_WINDOW_ID","at":1792770533353}
{"event":"setup_attempt","ordinal":30,"kind":"DELETE","at":1792770533356}
{"event":"setup_attempt","ordinal":31,"kind":"GET","at":1792770535786}
{"event":"setup_cleanup_absent","kind":"environment","id":"yhOy0BjVgrvMKBpr","key":"EMR_M03_FOUNDATION_WINDOW_ID","at":1792770538178}
{"event":"setup_cleanup_intent","kind":"environment","id":"5kNmNA0oKiXnXDr7","key":"EMR_M03_FOUNDATION_WRITER_PASSWORD","at":1792770538180}
{"event":"setup_attempt","ordinal":32,"kind":"DELETE","at":1792770538184}
{"event":"setup_attempt","ordinal":33,"kind":"GET","at":1792770540500}
{"event":"setup_cleanup_absent","kind":"environment","id":"5kNmNA0oKiXnXDr7","key":"EMR_M03_FOUNDATION_WRITER_PASSWORD","at":1792770543030}
{"event":"setup_cleanup_intent","kind":"environment","id":"sP6c78IvUkuh0q1y","key":"EMR_M03_FOUNDATION_APIFY_READ_TOKEN","at":1792770543032}
{"event":"setup_attempt","ordinal":34,"kind":"DELETE","at":1792770543034}
{"event":"setup_attempt","ordinal":35,"kind":"GET","at":1792770545520}
{"event":"setup_cleanup_absent","kind":"environment","id":"sP6c78IvUkuh0q1y","key":"EMR_M03_FOUNDATION_APIFY_READ_TOKEN","at":1792770548253}
{"event":"setup_cleanup_intent","kind":"environment","id":"O63SRoiYRJSB3lR2","key":"EMR_M03_FOUNDATION_TOKEN_SHA256","at":1792770548255}
{"event":"setup_attempt","ordinal":36,"kind":"DELETE","at":1792770548258}
{"event":"setup_attempt","ordinal":37,"kind":"GET","at":1792770550647}
{"event":"setup_cleanup_absent","kind":"environment","id":"O63SRoiYRJSB3lR2","key":"EMR_M03_FOUNDATION_TOKEN_SHA256","at":1792770553036}
{"event":"setup_cleanup_intent","kind":"environment","id":"EKbTlPeSsL7x7Jsg","key":"EMR_M03_FOUNDATION_AUDIENCE","at":1792770553038}
{"event":"setup_attempt","ordinal":38,"kind":"DELETE","at":1792770553042}
{"event":"setup_attempt","ordinal":39,"kind":"GET","at":1792770555559}
{"event":"setup_cleanup_absent","kind":"environment","id":"EKbTlPeSsL7x7Jsg","key":"EMR_M03_FOUNDATION_AUDIENCE","at":1792770557941}
{"event":"setup_cleanup_intent","kind":"environment","id":"R6oLddAHm22ATdYK","key":"EMR_M03_FOUNDATION_COMMIT_SHA","at":1792770557943}
{"event":"setup_attempt","ordinal":40,"kind":"DELETE","at":1792770557946}
{"event":"setup_attempt","ordinal":41,"kind":"GET","at":1792770560330}
{"event":"setup_cleanup_absent","kind":"environment","id":"R6oLddAHm22ATdYK","key":"EMR_M03_FOUNDATION_COMMIT_SHA","at":1792770562866}
{"event":"setup_attempt","ordinal":42,"kind":"GET","at":1792770562869}
{"event":"setup_cleanup_intent","kind":"bypass","at":1792770565371}
{"event":"setup_attempt","ordinal":43,"kind":"PATCH","at":1792770565374}
{"event":"setup_attempt","ordinal":44,"kind":"GET","at":1792770567831}
{"event":"setup_cleanup_absent","kind":"bypass","at":1792770570170}
`;
const cleanedLegacySetupRows = cleanedLegacySetupJsonl.trimEnd().split('\n').map(JSON.parse);
const cleanedLegacySetupSha256 = '0cad48fd9550da762c0b629ee63364e4668f4829c3a89bd6f75ec2843d32f624';

for (const profile of [640, 704, 832, 1024])
  test(`genuine${profile} profile replays every closed window and retains all setup requests before the fresh owned window`, async () => {
    const f = await syntheticProjectVerifiedContinuation({
      ...(profile === 1024
        ? { runtimeRestorationClosed: true, runtimeRestorationAllocation: true }
        : profile === 832
          ? { runtimePreparationClosed: true, runtimeMetadataAllocation: true }
          : profile === 704
            ? { catalogReadonly: true, catalogManagementAllocation: true }
            : { closedFixture: true }),
      historicalSetupEvents: cleanedLegacySetupRows,
    });
    let budget, current;
    try {
      const proof = f.claim(f.admit()),
        resume = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
        module = await f.copy('foundation-live-runtime.mjs'),
        setupModule = await f.copy('foundation-live-setup.mjs'),
        previousText = readFileSync(f.paths.setup, 'utf8'),
        previousEvents = previousText.trimEnd().split('\n').map(JSON.parse);
      const setupMaximum = profile === 1024 ? 224 : profile === 832 ? 176 : 132;
      const priorAttempts = profile === 1024 ? 149 : profile === 832 ? 114 : 79;
      const historical = [
        scope.windowId,
        '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        ...(profile >= 832 ? ['eda4fae1-1e19-47db-81b8-beac1a4ed883'] : []),
        ...(profile === 1024 ? ['3c46c791-e140-4eb9-890a-eecfa251f65e'] : []),
      ];
      assert.equal(resume.managementMaximum, profile);
      assert.equal(resume.setupMaximum, setupMaximum);
      assert.deepEqual(resume.historicalWindowIds, historical);
      assert.equal(Object.isFrozen(resume.historicalWindowIds), true);
      assert.equal(previousEvents.length, profile === 1024 ? 297 : profile === 832 ? 226 : 155);
      assert.equal(previousEvents.filter((v) => v.event === 'setup_attempt').length, priorAttempts);
      assert.deepEqual(
        [
          ...new Set(
            previousEvents
              .filter((v) => v.event === 'setup_ack' && v.kind === 'environment')
              .map((v) => v.comment),
          ),
        ].sort(),
        resume.historicalWindowIds.map((id) => 'M03 foundation temporary dev ' + id).sort(),
      );
      budget = module.createFoundationLiveManagementBudget(
        { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
          controlAttempts: () => resume.aggregateControlAttempts,
        },
      );
      current = fixture({
        setupModule,
        sourceSha: proof.sourceCommitSha,
        startsAt: proof.startsAt,
        projectVerifiedContinuationProof: proof,
        previousEvents,
        activeWindowId: proof.windowId,
        maximumRequests: setupMaximum,
        expectedMigrationCount: 15,
        managementBudget: budget,
      });
      assert.equal(budget.snapshot().attempts, resume.aggregateManagementAttempts);
      assert.equal(current.setup.snapshot().requestCount, priorAttempts);
      assert.equal(current.setup.snapshot().sharedMaximum, profile);
      await current.setup.prepare();
      const created = current.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?'));
      assert.equal(created.length, 7);
      assert.equal(
        created.every((c) => c.body.comment.endsWith(proof.windowId)),
        true,
      );
      const oldIds = new Set(
        previousEvents.filter((v) => v.event === 'setup_ack' && v.kind === 'environment').map((v) => v.id),
      );
      assert.equal((await current.setup.cleanup()).state, 'setup_resources_removed');
      const deleted = current.calls.filter((c) => c.method === 'DELETE');
      assert.equal(deleted.length, 7);
      assert.equal(
        deleted.some((c) => [...oldIds].some((id) => c.path.includes('/env/' + id + '?'))),
        false,
      );
      assert.equal(current.setup.snapshot().requestCount, priorAttempts + current.calls.length);
      assert.ok(current.setup.snapshot().requestCount <= setupMaximum);
      assert.equal(budget.snapshot().attempts, resume.aggregateManagementAttempts + current.calls.length);
      assert.equal(readFileSync(f.paths.setup, 'utf8'), previousText);
      assert.throws(() => fixture({ maximumRequests: setupMaximum, activeWindowId: proof.windowId }));
    } finally {
      current?.setup.close();
      budget?.close();
      f.cleanup();
    }
  });

test('new132 profile still rejects a current response using a closed38b scope comment', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    closedFixture: true,
    historicalSetupEvents: cleanedLegacySetupRows,
  });
  let budget, current;
  try {
    const proof = f.claim(f.admit()),
      module = await f.copy('foundation-live-runtime.mjs'),
      setupModule = await f.copy('foundation-live-setup.mjs');
    budget = module.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => 486,
      },
    );
    current = fixture({
      fault: 'closed_forward_env_comment',
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
      activeWindowId: proof.windowId,
      maximumRequests: 132,
      expectedMigrationCount: 15,
      managementBudget: budget,
    });
    await assert.rejects(current.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(current.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?')).length, 1);
    assert.equal(
      current.calls.some((c) => c.method === 'DELETE'),
      false,
    );
  } finally {
    current?.setup.close();
    budget?.close();
    f.cleanup();
  }
});

test('a genuine132 fresh-window proof cannot select either permanently closed SQL window', async () => {
  for (const activeWindowId of [scope.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc']) {
    const f = await syntheticProjectVerifiedContinuation({
      closedFixture: true,
      historicalSetupEvents: cleanedLegacySetupRows,
    });
    let budget;
    try {
      const proof = f.claim(f.admit()),
        module = await f.copy('foundation-live-runtime.mjs'),
        setupModule = await f.copy('foundation-live-setup.mjs');
      budget = module.createFoundationLiveManagementBudget(
        { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
          controlAttempts: () => 486,
        },
      );
      assert.throws(
        () =>
          fixture({
            setupModule,
            sourceSha: proof.sourceCommitSha,
            startsAt: proof.startsAt,
            projectVerifiedContinuationProof: proof,
            previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
            activeWindowId,
            maximumRequests: 132,
            expectedMigrationCount: 15,
            managementBudget: budget,
          }),
        /FOUNDATION_LIVE_SETUP_BLOCKED/,
      );
      assert.equal(budget.snapshot().attempts, 237);
    } finally {
      budget?.close();
      f.cleanup();
    }
  }
});

test('genuine576 constructor replays all84 fully cleaned legacy rows before creating only the new38b Preview entries', async () => {
  assert.equal(createHash('sha256').update(cleanedLegacySetupJsonl).digest('hex'), cleanedLegacySetupSha256);
  assert.equal(cleanedLegacySetupRows.length, 84);
  assert.equal(cleanedLegacySetupRows.filter((row) => row.event === 'setup_attempt').length, 44);
  const f = await syntheticProjectVerifiedContinuation({
    managementAllocation: true,
    historicalSetupEvents: cleanedLegacySetupRows,
  });
  let budget, current;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs'),
      setupModule = await f.copy('foundation-live-setup.mjs');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => 384,
      },
    );
    while (budget.snapshot().attempts < 177) budget.admit();
    const before = readFileSync(f.paths.setup, 'utf8');
    assert.equal(before, cleanedLegacySetupJsonl);
    current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents: cleanedLegacySetupRows,
      activeWindowId: proof.windowId,
      maximumRequests: 88,
      expectedMigrationCount: 15,
      managementBudget: budget,
    });
    assert.equal(current.calls.length, 0);
    assert.equal(current.setup.snapshot().requestCount, 44);
    assert.deepEqual(current.setup.snapshot().unresolved, []);
    await current.setup.prepare();
    const created = current.calls.filter((call) => call.method === 'POST' && call.path.includes('/env?'));
    assert.equal(created.length, 7);
    assert.equal(
      created.every((call) => call.body.comment.endsWith(proof.windowId)),
      true,
    );
    assert.equal((await current.setup.cleanup()).state, 'setup_resources_removed');
    const oldIds = new Set(
      cleanedLegacySetupRows
        .filter((row) => row.event === 'setup_ack' && row.kind === 'environment')
        .map((row) => row.id),
    );
    const deleted = current.calls.filter((call) => call.method === 'DELETE');
    assert.equal(deleted.length, 7);
    assert.equal(
      deleted.some((call) => [...oldIds].some((id) => call.path.includes('/env/' + id + '?'))),
      false,
    );
    assert.equal(current.setup.snapshot().requestCount, 44 + current.calls.length);
    assert.equal(current.setup.snapshot().requestCount <= 88, true);
    assert.equal(readFileSync(f.paths.setup, 'utf8'), before);
  } finally {
    current?.setup.close();
    budget?.close();
    f.cleanup();
  }
});

test('pinned historical environment replay refuses unmatched, unknown, reordered or unverified deletion records', async () => {
  for (const fault of ['id', 'key', 'unknown', 'intent', 'delete', 'readback', 'order']) {
    const rows = structuredClone(cleanedLegacySetupRows),
      absent = rows.findIndex((row) => row.event === 'setup_cleanup_absent' && row.kind === 'environment'),
      intent = rows.findIndex((row) => row.event === 'setup_cleanup_intent' && row.kind === 'environment');
    if (fault === 'id') rows[absent].id += '_UNOWNED';
    if (fault === 'key') rows[absent].key = 'EMR_M03_FOUNDATION_WINDOW_ID';
    if (fault === 'unknown') rows[absent].event = 'setup_cleanup_unknown';
    if (fault === 'intent') rows[intent].event = 'setup_cleanup_unknown';
    if (fault === 'delete') rows[intent + 1].kind = 'GET';
    if (fault === 'readback') rows[intent + 2].kind = 'PATCH';
    if (fault === 'order') [rows[intent], rows[absent]] = [rows[absent], rows[intent]];
    const f = await syntheticProjectVerifiedContinuation({
      managementAllocation: true,
      historicalSetupEvents: rows,
    });
    let budget;
    try {
      const proof = f.claim(f.admit()),
        runtime = await f.copy('foundation-live-runtime.mjs'),
        setupModule = await f.copy('foundation-live-setup.mjs');
      budget = runtime.createFoundationLiveManagementBudget(
        { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
          controlAttempts: () => 384,
        },
      );
      assert.throws(
        () =>
          fixture({
            setupModule,
            sourceSha: proof.sourceCommitSha,
            startsAt: proof.startsAt,
            projectVerifiedContinuationProof: proof,
            previousEvents: rows,
            activeWindowId: proof.windowId,
            maximumRequests: 88,
            expectedMigrationCount: 15,
            managementBudget: budget,
          }),
        /FOUNDATION_LIVE_SETUP_BLOCKED/,
      );
      assert.equal(budget.snapshot().attempts, 152);
    } finally {
      budget?.close();
      f.cleanup();
    }
  }
});

test('new38b environment responses cannot reuse legacy scope metadata or old deleted resource IDs', async () => {
  for (const fault of ['legacy_env_comment', 'reused_env_id']) {
    const f = await syntheticProjectVerifiedContinuation({
      managementAllocation: true,
      historicalSetupEvents: cleanedLegacySetupRows,
    });
    let budget, current;
    try {
      const proof = f.claim(f.admit()),
        runtime = await f.copy('foundation-live-runtime.mjs'),
        setupModule = await f.copy('foundation-live-setup.mjs');
      budget = runtime.createFoundationLiveManagementBudget(
        { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
          controlAttempts: () => 384,
        },
      );
      current = fixture({
        fault,
        setupModule,
        sourceSha: proof.sourceCommitSha,
        startsAt: proof.startsAt,
        projectVerifiedContinuationProof: proof,
        previousEvents: cleanedLegacySetupRows,
        activeWindowId: proof.windowId,
        maximumRequests: 88,
        expectedMigrationCount: 15,
        managementBudget: budget,
      });
      await assert.rejects(current.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
      assert.equal(
        current.calls.filter((call) => call.method === 'POST' && call.path.includes('/env?')).length,
        1,
      );
      assert.equal(
        current.calls.some((call) => call.method === 'DELETE'),
        false,
      );
      assert.equal(
        current.setup.snapshot().unresolved.some((value) => value.startsWith('create:')),
        true,
      );
    } finally {
      current?.setup.close();
      budget?.close();
      f.cleanup();
    }
  }
});

test('setup request plan carries all prior attempts and preserves eighteen cleanup requests before any write', () => {
  for (const [used, polls] of [
    [0, 12],
    [9, 9],
    [17, 1],
    [18, 0],
    [50, 0],
  ]) {
    const p = foundationLiveSetupRequestPlan(used);
    assert.equal(p.buildPollLimit, polls);
    assert.equal(p.cleanupReserve, 18);
    if (polls) assert.ok(used + p.maximumNewPrepareRequests + p.cleanupReserve <= 50);
  }
  for (const invalid of [-1, 51, 1.5, '9']) assert.throws(() => foundationLiveSetupRequestPlan(invalid));
  assert.equal(foundationLiveSetupRequestPlan(44).buildPollLimit, 0);
  const proposed = foundationLiveSetupRequestPlan(44, 88);
  assert.equal(proposed.buildPollLimit, 12);
  assert.equal(44 + proposed.maximumNewPrepareRequests + proposed.cleanupReserve, 88);
  const current = foundationLiveSetupRequestPlan(79, 132);
  assert.equal(current.buildPollLimit, 12);
  assert.equal(current.cleanupReserve, 18);
  assert.equal(79 + current.maximumNewPrepareRequests + current.cleanupReserve, 123);
  const restored = foundationLiveSetupRequestPlan(149, 224);
  assert.equal(restored.buildPollLimit, 12);
  assert.equal(restored.cleanupReserve, 18);
  assert.equal(149 + restored.maximumNewPrepareRequests + restored.cleanupReserve, 193);
  assert.throws(() => foundationLiveSetupRequestPlan(149, 225));
});

test('setup reserves the second Machine read before any request at the shared one-request boundary', async () => {
  const ready = fixture({ managementInitialAttempts: 190 });
  try {
    await ready.setup.prepare();
    assert.equal(ready.calls.length > 0, true);
    assert.equal((await ready.setup.cleanup()).state, 'setup_resources_removed');
  } finally {
    ready.setup.close();
  }
  const blocked = fixture({ managementInitialAttempts: 191 });
  try {
    await assert.rejects(blocked.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(blocked.calls.length, 0);
    assert.equal(blocked.attempts(), 191);
  } finally {
    blocked.setup.close();
  }
});

test('isolated approved cumulative88 fixture uses fresh window in exactly seven Preview entries and preserves44 spent requests', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  try {
    const proof = f.claim(f.admit()),
      setupModule = await f.copy('foundation-live-setup.mjs');
    const current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
      activeWindowId: proof.windowId,
      maximumRequests: 88,
      expectedMigrationCount: 15,
    });
    assert.equal(current.setup.snapshot().requestCount, 44);
    await current.setup.prepare();
    const entries = current.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?'));
    assert.equal(entries.length, 7);
    assert.equal(
      entries.find((c) => c.body.key === 'EMR_M03_FOUNDATION_WINDOW_ID').body.value,
      proof.windowId,
    );
    assert.equal(
      entries.every((c) => c.body.comment.endsWith(proof.windowId)),
      true,
    );
    await current.setup.cleanup();
    assert.equal(current.setup.snapshot().requestCount, 44 + current.calls.length);
    assert.ok(current.setup.snapshot().requestCount <= 88);
    assert.deepEqual(current.bypass, {});
    assert.throws(() => fixture({ maximumRequests: 88 }));
  } finally {
    f.cleanup();
  }
});

test('genuine approved576 Management capacity permits setup at202 charged requests while default512 still refuses before a request', async () => {
  const historical = fixture({ managementInitialAttempts: 202 });
  await assert.rejects(historical.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(historical.calls.length, 0);
  assert.equal(historical.attempts(), 202);
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  let budget, current;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs'),
      setupModule = await f.copy('foundation-live-setup.mjs');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => 384,
      },
    );
    while (budget.snapshot().attempts < 202) budget.admit();
    current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
      activeWindowId: proof.windowId,
      maximumRequests: 88,
      expectedMigrationCount: 15,
      managementBudget: budget,
    });
    assert.equal(budget.snapshot().maximum, 576);
    assert.equal(budget.snapshot().attempts, 202);
    assert.equal(current.setup.snapshot().requestCount, 44);
    await current.setup.prepare();
    await current.setup.cleanup();
    assert.equal(budget.snapshot().attempts, 202 + current.calls.length);
    assert.equal(current.setup.snapshot().requestCount, 44 + current.calls.length);
    assert.ok(current.setup.snapshot().requestCount <= 88);
    assert.equal(current.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?')).length, 7);
    assert.deepEqual(current.bypass, {});
  } finally {
    if (current) await current.setup.cleanup();
    budget?.close();
    f.cleanup();
  }
});
test('sole/default journal receipts reject non-default relabeling and arbitrary default-state values', () => {
  const row = {
    event: 'setup_verified',
    kind: 'bypass',
    at: epoch,
    createdAt: epoch,
    soleOwnedDefaultVerified: true,
    nonDefaultVerified: false,
    observedDefaultFlag: 'omitted',
  };
  const build = (value) =>
    createFoundationLiveSetupJournal({ sourceCommitSha: sha, durableAppend() {}, previousEvents: [value] });
  assert.equal(build(row).rows[0].observedDefaultFlag, 'omitted');
  for (const value of [
    { ...row, soleOwnedDefaultVerified: false },
    { ...row, nonDefaultVerified: true },
    { ...row, observedDefaultFlag: 'false' },
    { ...row, observedDefaultFlag: 'SYNTHETIC_PRIVATE' },
    { ...row, createdAt: 'SYNTHETIC_PRIVATE' },
  ])
    assert.throws(() => build(value), /FOUNDATION_LIVE_SETUP_BLOCKED/);
});
test('trusted cleaned effectful resume carries nine requests, resets only the old revoke fence and revokes the new owned default once', async () => {
  const f = await syntheticProjectVerifiedContinuation({ effectful: true });
  try {
    const proof = f.claim(f.admit());
    const setupModule = await f.copy('foundation-live-setup.mjs');
    const previousEvents = readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents,
      fault: 'omitted_default',
    });
    assert.equal(current.setup.snapshot().requestCount, 9);
    await current.setup.prepare();
    assert.equal(current.setup.snapshot().buildPollLimit, 9);
    assert.equal(current.setup.snapshot().soleOwnedDefaultVerified, true);
    const close = await current.setup.cleanup();
    assert.equal(close.state, 'setup_resources_removed');
    assert.equal(current.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(current.calls.filter((c) => c.body?.revoke).length, 1);
    assert.equal(
      current.calls.some((c) => c.body?.update),
      false,
    );
    assert.equal(current.setup.snapshot().requestCount, 9 + current.calls.length);
    assert.ok(current.setup.snapshot().requestCount <= 50);
    assert.deepEqual(current.bypass, {});
  } finally {
    f.cleanup();
  }
});
function fixture({
  fault,
  previousEvents = [],
  persist = () => {},
  setupModule,
  sourceSha = sha,
  startsAt = epoch,
  projectVerifiedContinuationProof,
  activeWindowId = scope.windowId,
  maximumRequests = 50,
  expectedMigrationCount = 14,
  managementBudget,
  managementInitialAttempts = 0,
  functionalScope,
} = {}) {
  const calls = [],
    rows = [],
    envs = [],
    bypass = {},
    project = {
      id: scope.projectId,
      name: 'everyone-market-researcher',
      accountId: scope.teamId,
      rootDirectory: 'apps/web',
      nodeVersion: '24.x',
      framework: 'nextjs',
      link: { type: 'github', org: scope.org, repo: scope.repo },
      ssoProtection: { deploymentType: 'all_except_custom_domains' },
      protectionBypass: bypass,
    };
  const deployment = {
    id: 'dpl_SyntheticFoundationLive21',
    projectId: scope.projectId,
    url: 'everyone-market-researcher-synthetic21.vercel.app',
    target: null,
    readyState: 'READY',
    createdAt: fault === 'old_deployment' ? startsAt - 60000 : startsAt,
    meta: { githubCommitSha: sourceSha, githubCommitRef: scope.branch },
  };
  let clock = startsAt,
    attempts = managementInitialAttempts,
    readyReads = 0,
    polls = 0;
  const budget = managementBudget ?? {
    admit() {
      attempts++;
    },
    snapshot() {
      return { attempts, maximum: 512 };
    },
    attachTransport() {},
  };
  const journal = (setupModule?.createFoundationLiveSetupJournal ?? createFoundationLiveSetupJournal)({
    sourceCommitSha: sourceSha,
    maximumRequests,
    previousEvents,
    ...(functionalScope ? { functionalScope } : {}),
    durableAppend(row) {
      persist(row);
      rows.push(row);
    },
  });
  const transport = {
    state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    close: () => true,
    async request(spec) {
      calls.push(JSON.parse(JSON.stringify({ method: spec.method, path: spec.path, body: spec.body })));
      if (fault === 'lost_env_ack' && spec.method === 'POST' && spec.path.includes('/env?'))
        throw Error(secret.writerPassword);
      if (spec.method === 'GET' && spec.path.startsWith('/v9/projects/'))
        return { status: 200, data: structuredClone(project), closed: true };
      if (spec.path.includes('/protection-bypass?')) {
        if (spec.body.generate)
          bypass[spec.body.generate.secret] = {
            scope: 'automation-bypass',
            createdAt: clock,
            note: spec.body.generate.note,
            ...(fault === 'omitted_default'
              ? {}
              : {
                  isEnvVar:
                    fault === 'false_default'
                      ? false
                      : fault === 'invalid_default'
                        ? 'SYNTHETIC_PRIVATE_FLAG'
                        : true,
                }),
          };
        if (spec.body.update && spec.body.update.isEnvVar === false && Object.keys(bypass).length === 1)
          return { status: 400, data: { error: 'SOLE_DEFAULT_REQUIRED' }, closed: true };
        if (spec.body.revoke) delete bypass[spec.body.revoke.secret];
        if (spec.body.generate && fault === 'lost_bypass_ack') throw Error(secret.protectionBypass);
        if (spec.body.generate && fault === 'foreign_after_create')
          bypass.UNRELATED = {
            scope: 'automation-bypass',
            isEnvVar: true,
            createdAt: clock,
            note: 'Other owner',
          };
        return { status: 200, data: { protectionBypass: structuredClone(bypass) }, closed: true };
      }
      if (spec.method === 'GET' && spec.path.includes('/env?'))
        return { status: 200, data: { envs: structuredClone(envs) }, closed: true };
      if (spec.method === 'POST' && spec.path.includes('/env?')) {
        const item = {
          ...spec.body,
          id: 'env_native_' + (envs.length + 1),
          createdAt: clock,
          updatedAt: clock,
          decrypted: false,
        };
        if (fault === 'legacy_env_comment') item.comment = 'M03 foundation temporary dev ' + scope.windowId;
        if (fault === 'closed_forward_env_comment')
          item.comment = 'M03 foundation temporary dev 38b3708d-61b0-41d2-8170-5ed91c66b4dc';
        if (fault === 'reused_env_id')
          item.id = cleanedLegacySetupRows.find(
            (row) => row.event === 'setup_ack' && row.kind === 'environment',
          ).id;
        envs.push(item);
        return { status: 200, data: { created: structuredClone(item), failed: [] }, closed: true };
      }
      if (spec.method === 'DELETE') {
        const id = spec.path.split('/env/')[1].split('?')[0];
        envs.splice(
          envs.findIndex((e) => e.id === id),
          1,
        );
        if (fault === 'lost_delete_ack') throw Error('synthetic unknown DELETE');
        return { status: 200, data: {}, closed: true };
      }
      if (spec.method === 'POST' && spec.path.startsWith('/v13/deployments?'))
        return { status: 200, data: structuredClone(deployment), closed: true };
      if (spec.method === 'GET' && spec.path.startsWith('/v13/deployments/')) {
        polls++;
        if (fault === 'wrong_sha')
          return {
            status: 200,
            data: { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'a'.repeat(40) } },
            closed: true,
          };
        return {
          status: 200,
          data: {
            ...structuredClone(deployment),
            readyState:
              (fault === 'last_poll' && polls < 12) || (fault === 'fifth_poll' && polls < 5)
                ? 'BUILDING'
                : 'READY',
          },
          closed: fault !== 'unclosed',
        };
      }
      throw Error('unexpected scripted route');
    },
  };
  const setup = (setupModule?.createFoundationLiveSetup ?? createFoundationLiveSetup)(
    {
      sourceCommitSha: sourceSha,
      ...(functionalScope ? { functionalScope } : {}),
      activeWindowId,
      transport,
      journal,
      managementBudget: budget,
      sensitive: secret,
      now: () => clock,
      deadlineAt: projectVerifiedContinuationProof?.deadlineAt ?? startsAt + 3600000,
      ...(projectVerifiedContinuationProof ? { projectVerifiedContinuationProof } : {}),
      pause: async (ms) => {
        clock += ms;
      },
      verifyDevReady: async () => {
        readyReads++;
        return { projectRef: scope.projectRef, migrationCount: expectedMigrationCount, ready: true };
      },
    },
    {
      transportValidator: (t) => assert.equal(t, transport),
      ...(managementBudget ? {} : { managementBudgetValidator: (b) => assert.equal(b, budget) }),
    },
  );
  return {
    setup,
    calls,
    rows,
    envs,
    bypass,
    project,
    journal,
    transport,
    budget,
    attempts: () => attempts,
    readyReads: () => readyReads,
  };
}
// Hypothetical acknowledged resource journal for independent cleanup tests.
// This is not a successful empty-baseline prepare or a hosted receipt.
function acknowledgedCleanupFixture(fault, priorAttempts = 0) {
  const keys = [
    'ENABLED',
    'WINDOW_ID',
    'WRITER_PASSWORD',
    'APIFY_READ_TOKEN',
    'TOKEN_SHA256',
    'AUDIENCE',
    'COMMIT_SHA',
  ];
  const envs = keys.map((key, i) => ({
    key: 'EMR_M03_FOUNDATION_' + key,
    id: 'env_historical_' + i,
    type: 'sensitive',
    target: ['preview'],
    gitBranch: scope.branch,
    comment: 'M03 foundation temporary dev ' + scope.windowId,
    createdAt: epoch,
    updatedAt: epoch,
  }));
  const previousEvents = [
    ...Array.from({ length: priorAttempts }, (_, i) => ({
      event: 'setup_attempt',
      ordinal: i + 1,
      kind: 'GET',
      at: epoch,
    })),
    { event: 'setup_ack', kind: 'bypass', at: epoch },
    ...envs.map((row) => ({ event: 'setup_ack', kind: 'environment', ...row })),
  ];
  const f = fixture({ fault, previousEvents });
  f.envs.push(...structuredClone(envs));
  f.bypass[secret.protectionBypass] = {
    scope: 'automation-bypass',
    createdAt: epoch,
    note: 'M03 foundation temporary dev ' + scope.windowId,
    isEnvVar: true,
  };
  return f;
}
for (const fault of [undefined, 'omitted_default'])
  test(
    'approved sole/default exception prepares one owned bypass without updating any default: ' +
      (fault ?? 'explicit_true'),
    async () => {
      const f = fixture({ fault });
      const proof = await f.setup.prepare();
      assert.equal(f.readyReads(), 1);
      assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, true);
      assert.equal(f.setup.snapshot().nonDefaultVerified, false);
      assert.equal(f.setup.snapshot().deploymentReady, true);
      assert.equal(f.envs.length, 7);
      assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
      assert.equal(f.calls.filter((c) => c.body?.update).length, 0);
      assert.equal(assertFoundationLiveDeployment(proof), proof);
      const observed = f.rows.find((r) => r.event === 'setup_verified' && r.kind === 'bypass');
      assert.equal(observed.soleOwnedDefaultVerified, true);
      assert.equal(observed.nonDefaultVerified, false);
      assert.equal(observed.observedDefaultFlag, fault === 'omitted_default' ? 'omitted' : 'true');
      assert.equal(f.attempts(), f.calls.length);
      assert.throws(() => assertFoundationLiveDeployment({ version: 1 }));
      const publicText = JSON.stringify({ snapshot: f.setup.snapshot(), rows: f.rows });
      for (const value of Object.values(secret)) assert.equal(publicText.includes(value), false);
      const closed = await f.setup.cleanup();
      assert.equal(closed.state, 'setup_resources_removed');
      assert.equal(f.envs.length, 0);
      assert.deepEqual(f.bypass, {});
      assert.equal(closed.deploymentSnapshotsErased, false);
      assert.equal(f.attempts(), f.calls.length);
    },
  );
test('existing owned-key environment or another bypass blocks before every mutation', async () => {
  for (const kind of ['env', 'bypass']) {
    const f = fixture();
    if (kind === 'env')
      f.envs.push({
        key: 'EMR_M03_FOUNDATION_ENABLED',
        id: 'foreign',
        gitBranch: scope.branch,
        target: ['preview'],
      });
    else f.bypass.foreign = { scope: 'automation-bypass', isEnvVar: true };
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  }
});
test('sole/default exception never adopts another existing entry or an ambiguous missing bypass map', async () => {
  for (const flag of ['true', 'omitted', 'false', 'missing_map']) {
    const f = fixture();
    if (flag === 'missing_map') delete f.project.protectionBypass;
    else
      f.bypass.UNRELATED = {
        scope: 'automation-bypass',
        ...(flag === 'omitted' ? {} : { isEnvVar: flag === 'true' }),
      };
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
    assert.equal(
      f.rows.some((r) => r.event === 'setup_intent'),
      false,
    );
  }
});
test('explicit false or non-boolean generated default never produces a default receipt or environment/deployment mutation', async () => {
  for (const fault of ['false_default', 'invalid_default']) {
    const f = fixture({ fault });
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(f.calls.filter((c) => c.body?.update).length, 0);
    assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
    assert.equal(
      f.rows.some((r) => r.event === 'setup_verified' && r.kind === 'bypass'),
      false,
    );
    assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
  }
});
test('acknowledged owned false-default generation fails acceptance but revokes exactly once with verified empty readback', async () => {
  const f = fixture({ fault: 'false_default' });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(
    f.rows.some((r) => r.event === 'setup_ack' && r.kind === 'bypass'),
    true,
  );
  assert.equal(
    f.rows.some((r) => r.event === 'setup_verified' && r.kind === 'bypass'),
    false,
  );
  assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
  assert.equal(f.setup.snapshot().nonDefaultVerified, false);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  const cleaned = await f.setup.cleanup();
  assert.equal(cleaned.state, 'setup_resources_removed');
  assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
  assert.equal(f.calls.filter((c) => c.body?.revoke).length, 1);
  assert.equal(
    f.calls.some((c) => c.body?.update),
    false,
  );
  assert.deepEqual(f.bypass, {});
  const after = f.calls.length;
  assert.equal((await f.setup.cleanup()).state, 'setup_resources_removed');
  assert.equal(f.calls.length, after);
});
test('lost generation ACK or an unexpected extra entry remains ambiguous without another create or blind revoke', async () => {
  for (const fault of ['lost_bypass_ack', 'foreign_after_create']) {
    const f = fixture({ fault });
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    const before = f.calls.length;
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.length, before);
    const cleaned = await f.setup.cleanup();
    assert.equal(cleaned.state, 'setup_cleanup_incomplete');
    assert.deepEqual(cleaned.unresolved, ['bypass_create']);
    assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(
      f.calls.some((c) => c.body?.update || c.body?.revoke),
      false,
    );
    assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
    assert.equal(JSON.stringify(f.rows).includes(secret.protectionBypass), false);
  }
});
test('ambiguous create is never replayed; known resources can still clean up without raw errors', async () => {
  const f = fixture({
    previousEvents: [
      { event: 'setup_intent', kind: 'environment', key: 'EMR_M03_FOUNDATION_ENABLED', at: epoch },
    ],
  });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  const count = f.calls.length;
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.length, count);
  const closed = await f.setup.cleanup();
  assert.equal(closed.state, 'setup_cleanup_incomplete');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  assert.equal(JSON.stringify(f.rows).includes(secret.writerPassword), false);
});
test('project identity, runtime and protection drift cannot be mislabeled as the non-default prerequisite', async () => {
  for (const fault of ['repository', 'node', 'protection']) {
    const f = fixture();
    if (fault === 'repository') f.project.link.repo = 'ForeignProject';
    if (fault === 'node') f.project.nodeVersion = '20.x';
    if (fault === 'protection') f.project.ssoProtection.deploymentType = 'none';
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.setup.snapshot().deploymentReady, false);
    assert.equal(f.setup.snapshot().prerequisiteCode, null);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  }
});
test('scripted documented provider semantics retain the first default when an update tries to unset the sole default', async () => {
  const f = fixture();
  const path = '/v1/projects/' + scope.projectId + '/protection-bypass?teamId=' + scope.teamId;
  const generated = await f.transport.request({
    method: 'PATCH',
    path,
    body: { generate: { secret: secret.protectionBypass, note: 'synthetic' } },
  });
  assert.equal(generated.status, 200);
  assert.equal(generated.data.protectionBypass[secret.protectionBypass].isEnvVar, true);
  const update = await f.transport.request({
    method: 'PATCH',
    path,
    body: { update: { secret: secret.protectionBypass, isEnvVar: false, note: 'synthetic' } },
  });
  assert.equal(update.status, 400);
  assert.equal(f.bypass[secret.protectionBypass].isEnvVar, true);
});
test('durable intent failure, parallel callers, replay journals and missing readiness prevent extra writes', async () => {
  const f = fixture({
    persist(row) {
      if (row.event === 'setup_intent') throw Error('synthetic disk error');
    },
  });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  const g = fixture();
  const first = g.setup.prepare();
  await assert.rejects(g.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  await first;
  const prior = fixture({ previousEvents: g.rows });
  await assert.rejects(prior.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(prior.calls.length, 0);
});
test('a lost DELETE acknowledgement plus absence remains ambiguous and is never retried', async () => {
  const f = acknowledgedCleanupFixture('lost_delete_ack');
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_cleanup_incomplete');
  assert.equal(result.unresolved.length, 7);
  const count = f.calls.filter((c) => c.method === 'DELETE').length;
  await f.setup.cleanup();
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, count);
});
test('historical acknowledged cleanup retains all eighteen reserved requests within the same fifty-request subcap', async () => {
  const f = acknowledgedCleanupFixture(undefined, 32);
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_resources_removed');
  assert.equal(f.calls.length, 18);
  assert.equal(f.attempts(), 18);
  assert.equal(f.setup.snapshot().requestCount, 50);
  assert.equal(f.setup.snapshot().maximumRequests, 50);
});
test('a new bounded child reconstructs only acknowledged resource cleanup and never pretends an old prepared batch is empty', async () => {
  const old = acknowledgedCleanupFixture();
  const resumed = fixture({ previousEvents: old.journal.rows });
  resumed.envs.push(...structuredClone(old.envs));
  Object.assign(resumed.bypass, structuredClone(old.bypass));
  const result = await resumed.setup.cleanup();
  assert.equal(result.state, 'setup_resources_removed');
  assert.equal(resumed.envs.length, 0);
  assert.deepEqual(resumed.bypass, {});
  assert.equal(resumed.calls.filter((c) => c.method === 'DELETE').length, 7);
  assert.equal(
    resumed.calls.some((c) => c.method === 'POST'),
    false,
  );
});
test('shutdown permanently closes setup admission even when no resource was created', async () => {
  const f = fixture();
  assert.equal((await f.setup.cleanup()).state, 'setup_resources_removed');
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.length, 0);
});
