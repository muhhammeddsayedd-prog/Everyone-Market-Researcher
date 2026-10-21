import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticClockAmendment } from './foundation-live-clock-amendment-fixtures.mjs';

test('two actual Node children cannot consume one admitted segment even after first zero-effect close removes its lock', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-clock-children-')),
    records = join(directory, 'records'),
    runtime = join(directory, 'runtime');
  mkdirSync(records);
  mkdirSync(runtime);
  const f = syntheticClockAmendment({ parentProcessId: process.pid, durableDirectory: records });
  f.admit();
  writeFileSync(join(runtime, 'management.jsonl'), f.header);
  const cli = new URL('./foundation-live-runtime-cli.mjs', import.meta.url).href,
    fixtureURL = new URL('./foundation-live-clock-amendment-fixtures.mjs', import.meta.url).href;
  const script = `import {runFoundationLiveRuntimeCli} from ${JSON.stringify(cli)};import {syntheticClockAmendment} from ${JSON.stringify(fixtureURL)};
const f=syntheticClockAmendment({parentProcessId:process.ppid,durableDirectory:${JSON.stringify(records)}});
runFoundationLiveRuntimeCli({args:['SessionClockAmendment'],dependencies:{storage:{directory:${JSON.stringify(runtime)}},now:f.now,readClockAmendment:f.read,claimClockAmendment:f.claim}}).then(code=>{process.exitCode=code;},()=>{process.exitCode=1;});`;
  const packet = {
    kind: 'm03_acceptance_private_input',
    version: 1,
    approvedHead: f.checkpoint.sourceCommitSha,
    approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
    sourceCommitSha: f.checkpoint.sourceCommitSha,
    managementKey: 'SYNTHETIC_CLOCK_MANAGEMENT',
    writerPassword: 'SYNTHETIC_CLOCK_WRITER',
    apifyReadToken: 'SYNTHETIC_CLOCK_READER',
    machineToken: 'M'.repeat(43),
    protectionBypass: 'B'.repeat(32),
    leaseExpiry: f.now() + 7200000,
  };
  async function run() {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '--eval', script],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          SystemRoot: process.env.SystemRoot ?? '',
          WINDIR: process.env.WINDIR ?? '',
          LOCALAPPDATA: process.env.LOCALAPPDATA,
        },
      },
    );
    let buffer = '',
      exit = null,
      closedFrame,
      ready = false,
      errors = 0,
      timer;
    const ended = new Promise((done) =>
      child.once('close', (code, signal) => {
        exit = { code, signal };
        done();
      }),
    );
    child.stderr.on('data', (b) => {
      errors += b.length;
    });
    child.stdout.on('data', (b) => {
      buffer += b;
      while (buffer.includes('\n')) {
        const at = buffer.indexOf('\n'),
          line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        const r = JSON.parse(line);
        if (r.kind === 'm03_acceptance_ready') {
          ready = true;
          assert.equal(r.deadlineAt, f.now() + 3600000);
          child.stdin.write('{"kind":"m03_acceptance_command","id":"close","command":"close"}\n');
        }
        if (r.kind === 'm03_acceptance_closed') closedFrame = r;
      }
    });
    try {
      child.stdin.write(JSON.stringify(packet) + '\n');
      await Promise.race([
        ended,
        new Promise((done) => {
          timer = setTimeout(done, 5000);
        }),
      ]);
      assert.ok(exit, 'actual child closes without parent EOF');
      assert.equal(errors, 0);
      return { ...exit, closedFrame, ready };
    } finally {
      clearTimeout(timer);
      if (!exit) {
        child.stdin.end();
        await Promise.race([ended, new Promise((done) => setTimeout(done, 500))]);
        if (!exit) {
          child.kill();
          await ended;
        }
      }
    }
  }
  try {
    const admission = readFileSync(join(records, 'admission.json'), 'utf8');
    const first = await run();
    assert.equal(first.code, 0);
    assert.equal(first.ready, true);
    assert.equal(first.closedFrame.residual, false);
    assert.equal(existsSync(join(runtime, 'runtime.operation.lock')), false);
    const claim = readFileSync(join(records, 'claim.json'), 'utf8');
    const second = await run();
    assert.equal(second.code, 1);
    assert.equal(second.ready, false);
    assert.equal(second.closedFrame.status, 'blocked');
    assert.equal(readFileSync(join(records, 'admission.json'), 'utf8'), admission);
    assert.equal(readFileSync(join(records, 'claim.json'), 'utf8'), claim);
    assert.equal(readFileSync(join(runtime, 'management.jsonl'), 'utf8'), f.header);
    for (const key of ['control', 'preflight', 'runtime', 'setup'])
      assert.equal(existsSync(join(runtime, key + '.jsonl')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
