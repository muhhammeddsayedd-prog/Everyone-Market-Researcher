import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareFoundationRuntimeMachinePatch,
  assertFoundationRuntimeMachinePatch,
} from './foundation-runtime-machine.mjs';
const audience = 'https://everyone-market-researcher-synthetic-runtime-only.vercel.app';
const machineToken = 'SYNTHETIC_MACHINE_ONLY_12345678901234567890';
const protectionBypass = 'SYNTHETIC_NEW_PROTECTION_ONLY_12345';
test('one owned prepared PATCH retains known pending bearer and adds only the new private bypass header', () => {
  assert.equal(machineToken.length, 43);
  const p = prepareFoundationRuntimeMachinePatch({
    audience,
    restore: false,
    machineToken,
    protectionBypass,
  });
  assert.equal(assertFoundationRuntimeMachinePatch(p, { audience, restore: false }), p);
  assert.deepEqual(JSON.parse(p.data.json), {
    headers: { Authorization: 'Bearer ' + machineToken, 'x-vercel-protection-bypass': protectionBypass },
  });
  assert.equal(p.data.allowedDomains, new URL(audience).hostname);
  assert.equal(Object.isFrozen(p.data), true);
  assert.throws(() => assertFoundationRuntimeMachinePatch(structuredClone(p), { audience, restore: false }));
});
test('shutdown uses the same pending bearer and removes the temporary bypass without reading saved credential data', () => {
  const p = prepareFoundationRuntimeMachinePatch({ audience, restore: true, machineToken });
  assert.deepEqual(JSON.parse(p.data.json), { headers: { Authorization: 'Bearer ' + machineToken } });
  assert.equal(assertFoundationRuntimeMachinePatch(p, { audience, restore: true }), p);
  assert.throws(() => assertFoundationRuntimeMachinePatch(p, { audience, restore: false }));
});
test('unapproved hosts, absent or malformed private inputs, extra headers and restore bypass fail with fixed error', () => {
  for (const change of [
    (v) => {
      v.audience = 'https://unrelated.example';
    },
    (v) => {
      delete v.protectionBypass;
    },
    (v) => {
      v.protectionBypass = 'has\r\nheaders';
    },
    (v) => {
      v.machineToken = 'not-the-existing-format';
    },
    (v) => {
      v.headers = { Cookie: 'SYNTHETIC' };
    },
    (v) => {
      v.restore = true;
    },
  ]) {
    const v = { audience, restore: false, machineToken, protectionBypass };
    change(v);
    assert.throws(
      () => prepareFoundationRuntimeMachinePatch(v),
      /^Error: FOUNDATION_RUNTIME_MACHINE_BLOCKED$/,
    );
  }
});
