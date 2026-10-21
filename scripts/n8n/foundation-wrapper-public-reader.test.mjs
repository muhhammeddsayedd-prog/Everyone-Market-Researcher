import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFoundationWrapperPublicReader } from './foundation-wrapper-public-reader.mjs';

const wrapper = {
  kind: 'm03_acceptance_wrapper_closed',
  childClosed: true,
  credentialChildrenClosed: false,
  emergencyShutdown: false,
  nativeExit: 1,
  handoffsDeleted: false,
  bypassHandoffDeleted: false,
  pendingMachinePreserved: true,
  privateRead: true,
  code: 'M03_ACCEPTANCE_BLOCKED',
};
test('source closure does not discard the later wrapper receipt across split/coalesced output', () => {
  for (const split of [1, 97, 100000]) {
    const acks = [];
    const reader = createFoundationWrapperPublicReader({ acknowledge: (v) => acks.push(v) });
    const rows = [
      {
        kind: 'm03_acceptance_transport_ready',
        nonce: 'a'.repeat(32),
        privateRead: false,
        networkRequests: 0,
      },
      { kind: 'm03_acceptance_ready', status: 'private_child_ready' },
      { kind: 'm03_acceptance_result', status: 'blocked' },
      { kind: 'm03_acceptance_closed', status: 'residual', adminChildClosed: false },
      wrapper,
    ];
    const text = rows.map((r) => JSON.stringify(r) + '\r\n').join('');
    for (let at = 0; at < text.length; at += split) reader.push(text.slice(at, at + split));
    assert.deepEqual(reader.drain(), rows);
    assert.equal(reader.state().blocked, false);
    assert.equal(reader.state().wrapperReceipt.credentialChildrenClosed, false);
    assert.deepEqual(acks, [{ kind: 'm03_acceptance_transport_ack', nonce: 'a'.repeat(32) }]);
    assert.equal(reader.state().partialLine, false);
  }
});
test('a wrapper failure before transport admission is retained without sending an acknowledgement', () => {
  const reader = createFoundationWrapperPublicReader({
    acknowledge() {
      assert.fail('No transport admitted');
    },
  });
  reader.push(JSON.stringify({ ...wrapper, privateRead: false, nativeExit: null }) + '\n');
  assert.equal(reader.drain().length, 1);
  assert.equal(reader.state().acknowledged, false);
});
test('malformed, oversized or trailing frames fail with a fixed error and do not fabricate missing closure', () => {
  for (const text of [
    'SYNTHETIC_PRIVATE_RAW_ERROR\n',
    'x'.repeat(65537),
    '{"kind":"unknown"}\n',
    JSON.stringify({ ...wrapper, code: 'SYNTHETIC_PRIVATE_ERROR' }) + '\n',
  ]) {
    const reader = createFoundationWrapperPublicReader();
    assert.throws(() => reader.push(text), { message: 'M03_PUBLIC_SUPERVISOR_PROTOCOL_BLOCKED' });
    assert.equal(reader.state().blocked, true);
    assert.equal(reader.state().wrapperReceipt, null);
  }
  const reader = createFoundationWrapperPublicReader();
  reader.push(JSON.stringify(wrapper) + '\n');
  assert.throws(() => reader.push(JSON.stringify(wrapper) + '\n'), /PROTOCOL_BLOCKED/);
  assert.deepEqual(reader.state().wrapperReceipt, wrapper);
});
