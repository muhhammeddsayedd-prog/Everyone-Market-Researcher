import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('an isolated child without LOCALAPPDATA retains the production guard while synthetic claimed runtime uses a restored test scope', () => {
  const fixtureURL = new URL('./foundation-live-clock-amendment-fixtures.mjs', import.meta.url).href,
    clockURL = new URL('./foundation-live-clock-amendment.mjs', import.meta.url).href,
    runtimeURL = new URL('./foundation-live-runtime-cli.mjs', import.meta.url).href;
  const script = `
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {syntheticClockAmendment,withSyntheticLocalAppData} from ${JSON.stringify(fixtureURL)};
import {admitFoundationClockAmendment,readClaimedFoundationClockAmendment,assertFoundationLiveClockAmendmentProof} from ${JSON.stringify(clockURL)};
import {createFoundationLiveAcceptanceSession} from ${JSON.stringify(runtimeURL)};
assert.equal(Object.hasOwn(process.env,'LOCALAPPDATA'),false,'imports do not mutate the environment');
const clock=syntheticClockAmendment();
assert.equal(Object.hasOwn(process.env,'LOCALAPPDATA'),false,'fixture construction does not mutate the environment');
assert.throws(()=>admitFoundationClockAmendment({now:clock.now},clock.io),/M03_CLOCK_AMENDMENT_BLOCKED/);
assert.equal(clock.files.has(clock.paths.admission),false);
assert.throws(()=>withSyntheticLocalAppData(()=>{throw Error('SYNTHETIC_SCOPE_FAILURE');}),/SYNTHETIC_SCOPE_FAILURE/);
assert.equal(Object.hasOwn(process.env,'LOCALAPPDATA'),false,'exception restores absent variable');
const proof=clock.claim(clock.admit());
assert.equal(assertFoundationLiveClockAmendmentProof(proof,{claimed:true}),proof);
assert.equal(Object.hasOwn(process.env,'LOCALAPPDATA'),false,'real proof calls restore absent variable');
assert.throws(()=>readClaimedFoundationClockAmendment({now:clock.now},clock.io),/M03_CLOCK_AMENDMENT_BLOCKED/);
process.env.LOCALAPPDATA='SYNTHETIC_EXISTING_VALUE';
withSyntheticLocalAppData(()=>assert.equal(process.env.LOCALAPPDATA,'SYNTHETIC_OVERRIDE'),'SYNTHETIC_OVERRIDE');
assert.equal(process.env.LOCALAPPDATA,'SYNTHETIC_EXISTING_VALUE');
delete process.env.LOCALAPPDATA;
const directory=mkdtempSync(join(tmpdir(),'emr-clock-portability-'));
let session;
try {
  writeFileSync(join(directory,'management.jsonl'),clock.header);
  session=createFoundationLiveAcceptanceSession({
    kind:'m03_acceptance_private_input',version:1,approvedHead:proof.sourceCommitSha,
    approvedPacketSha256:'009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
    sourceCommitSha:proof.sourceCommitSha,managementKey:'SYNTHETIC_PORTABLE_MANAGEMENT',
    writerPassword:'SYNTHETIC_PORTABLE_WRITER',apifyReadToken:'SYNTHETIC_PORTABLE_READER',
    machineToken:'M'.repeat(43),protectionBypass:'B'.repeat(32),leaseExpiry:clock.now()+7200000
  },()=>{}, {clockAmendmentProof:proof,now:clock.now,storage:{directory}});
  assert.equal(session.deadlineAt,proof.deadlineAt);
  const state=await session.command({kind:'m03_acceptance_command',id:'portable_state',command:'state'});
  assert.equal(state.status,'not_prepared');
  assert.equal(state.managementAttempts,0);
  assert.equal(state.controlAttempts,0);
  assert.equal(state.nativeExecutions,0);
  const closed=await session.close();
  assert.equal(closed.childTransportsClosed,true);
  assert.equal(closed.adminChildClosed,true);
  assert.equal(readFileSync(join(directory,'management.jsonl'),'utf8'),clock.header);
  assert.equal(Object.hasOwn(process.env,'LOCALAPPDATA'),false);
  process.stdout.write('SYNTHETIC_UNSET_ENV_RUNTIME_PASS\\n');
} finally {
  await session?.close();
  rmSync(directory,{recursive:true,force:true});
}
`;
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '--eval', script],
    {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 131072,
      env: { SystemRoot: process.env.SystemRoot ?? '', WINDIR: process.env.WINDIR ?? '' },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'SYNTHETIC_UNSET_ENV_RUNTIME_PASS\n');
});
