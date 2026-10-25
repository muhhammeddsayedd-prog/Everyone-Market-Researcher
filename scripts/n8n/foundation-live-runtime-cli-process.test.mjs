import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticZeroSetup } from './foundation-live-runtime-resume-fixtures.mjs';

// Actual Node/pipe lifecycle, using only synthetic values and an isolated
// journal. Keeping the parent pipe open catches a return-value-only false pass.
async function physicalClose({ rejected = false, resume = false, missingHeader = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-physical-test-'));
  const entry = new URL('./foundation-live-runtime-cli.mjs', import.meta.url).href;
  const z = resume ? syntheticZeroSetup() : null;
  if (resume && !missingHeader) writeFileSync(join(directory, 'management.jsonl'), z.header);
  const fixtureModule = new URL('./foundation-live-runtime-resume-fixtures.mjs', import.meta.url).href;
  const script = `import {runFoundationLiveRuntimeCli} from ${JSON.stringify(entry)};
${resume ? `import {syntheticZeroSetup} from ${JSON.stringify(fixtureModule)};const z=syntheticZeroSetup();` : ''}
runFoundationLiveRuntimeCli({args:[${JSON.stringify(resume ? 'SessionResumeZeroSetup' : 'Session')}],dependencies:{storage:{directory:${JSON.stringify(directory)}},${resume ? "now:z.now,verifyZeroSetup:z.verify,setStopTimer(fn,ms){console.log(JSON.stringify({kind:'synthetic_timer',delay:ms}));return setTimeout(fn,ms);}," : ''}}})
.then(code=>{process.exitCode=code;},()=>{process.exitCode=1;});`;
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '--eval', script],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { SystemRoot: process.env.SystemRoot ?? '', WINDIR: process.env.WINDIR ?? '' },
    },
  );
  let buffer = '',
    stderrBytes = 0,
    closeFrame = null,
    readyFrame = null,
    observedTimer = null,
    actualExit = null,
    timer;
  const closed = new Promise((done) =>
    child.once('close', (code, signal) => {
      actualExit = { code, signal };
      done(actualExit);
    }),
  );
  child.stderr.on('data', (b) => {
    stderrBytes += b.length;
  });
  child.stdout.on('data', (b) => {
    buffer += b;
    while (buffer.includes('\n')) {
      const at = buffer.indexOf('\n'),
        line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      if (r.kind === 'm03_acceptance_ready') {
        readyFrame = r;
        child.stdin.write(
          JSON.stringify({
            kind: 'm03_acceptance_command',
            id: 'physical_close',
            command: 'close',
          }) + '\n',
        );
      }
      if (r.kind === 'm03_acceptance_closed') closeFrame = r;
      if (r.kind === 'synthetic_timer') observedTimer = r.delay;
    }
  });
  try {
    child.stdin.write(
      JSON.stringify({
        kind: 'm03_acceptance_private_input',
        version: 1,
        approvedHead: rejected ? 'f'.repeat(40) : 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
        sourceCommitSha: resume ? z.checkpoint.sourceCommitSha : 'a'.repeat(40),
        managementKey: 'SYNTHETIC_MANAGEMENT_ONLY',
        writerPassword: 'SYNTHETIC_WRITER_ONLY',
        apifyReadToken: 'SYNTHETIC_READ_ONLY',
        machineToken: 'M'.repeat(43),
        protectionBypass: 'B'.repeat(32),
        leaseExpiry: (resume ? z.now() : Date.now()) + 7200000,
      }) + '\n',
    );
    await Promise.race([
      closed,
      new Promise((done) => {
        timer = setTimeout(done, 5000);
      }),
    ]);
    assert.ok(closeFrame, 'expected fixed close projection');
    assert.ok(actualExit, 'actual Node and its pipes must close while parent stdin remains open');
    assert.equal(actualExit.code, rejected || missingHeader ? 1 : 0);
    assert.equal(actualExit.signal, null);
    assert.equal(stderrBytes, 0);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
    assert.equal(closeFrame.residual, rejected || missingHeader);
    if (resume) {
      if (missingHeader) assert.equal(existsSync(join(directory, 'management.jsonl')), false);
      else assert.equal(readFileSync(join(directory, 'management.jsonl'), 'utf8'), z.header);
      for (const name of ['control', 'preflight', 'setup', 'runtime'])
        assert.equal(existsSync(join(directory, name + '.jsonl')), false);
      if (!missingHeader) {
        assert.equal(readyFrame.deadlineAt, z.checkpoint.deadlineAt);
        assert.equal(observedTimer, z.checkpoint.deadlineAt - z.now() - 600000);
      }
    }
  } finally {
    clearTimeout(timer);
    if (!actualExit) {
      // RED cleanup owns only this synthetic child, never a live coordinator.
      child.stdin.end();
      await Promise.race([closed, new Promise((done) => setTimeout(done, 500))]);
      if (!actualExit) {
        child.kill();
        await closed;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

test('actual Node close releases owned stdin and exits with the parent pipe still open', () =>
  physicalClose());
test('actual Node rejected first packet also releases stdin and exits without parent EOF', () =>
  physicalClose({ rejected: true }));
test('actual Node explicit zero-setup mode retains the original header/clock and exits without resetting journals', () =>
  physicalClose({ resume: true }));
test('actual Node zero-setup mode cannot create a missing original management header', () =>
  physicalClose({ resume: true, missingHeader: true }));
