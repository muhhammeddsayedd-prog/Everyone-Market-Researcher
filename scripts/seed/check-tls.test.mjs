import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { approvedCaPin, probePoolerTls } from './check-tls.mjs';

class Socket extends EventEmitter {
  closed = false;
  writes = [];
  destroyCalls = 0;
  destroy() {
    if (this.closed) return;
    this.destroyCalls++;
    this.destroyOrder?.push(this.label);
    if (this.neverClose) return;
    const close = () => {
      this.closed = true;
      this.emit('close');
      if (this.ownedSocket) {
        this.ownedSocket.closed = true;
        this.ownedSocket.emit('close');
      }
    };
    if (this.closeDelay) setTimeout(close, this.closeDelay);
    else setImmediate(close);
  }
  write(bytes) {
    this.writes.push(Buffer.from(bytes));
    this.emit('data', Buffer.from(this.response ?? 'S'));
  }
}
function fixture({ response = 'S', errorCode, connected = true } = {}) {
  const plain = new Socket();
  plain.response = response;
  const secure = new Socket();
  const destroyOrder = [];
  plain.label = 'plain';
  plain.destroyOrder = destroyOrder;
  secure.label = 'secure';
  secure.destroyOrder = destroyOrder;
  secure.ownedSocket = plain;
  secure.authorized = true;
  const calls = [];
  return {
    plain,
    secure,
    calls,
    destroyOrder,
    dependencies: {
      tcpConnect(options) {
        calls.push({ type: 'tcp', options });
        if (connected) queueMicrotask(() => plain.emit('connect'));
        return plain;
      },
      tlsConnect(options) {
        calls.push({ type: 'tls', options });
        queueMicrotask(() =>
          errorCode
            ? secure.emit('error', { code: errorCode, message: 'raw-private-sentinel' })
            : secure.emit('secureConnect'),
        );
        return secure;
      },
      timeoutMs: 20,
      cleanupTimeoutMs: 30,
    },
  };
}

test('sends only the eight-byte SSLRequest and performs strict TLS to the fixed dev pooler', async () => {
  const state = fixture();
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.status, 'verified');
  assert.equal(result.authenticationAttempted, false);
  assert.equal(result.startupMessageSent, false);
  assert.equal(result.socketsClosed, true);
  assert.equal(state.plain.writes.length, 1);
  assert.equal(state.plain.writes[0].readUInt32BE(0), 8);
  assert.equal(state.plain.writes[0].readUInt32BE(4), 80877103);
  assert.deepEqual(state.calls[0].options, {
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    family: 4,
  });
  assert.equal(state.calls[1].options.rejectUnauthorized, true);
  assert.equal(state.calls[1].options.servername, 'aws-1-eu-central-1.pooler.supabase.com');
});
test('classifies certificate trust failure without echoing raw errors or certificate contents', async () => {
  const state = fixture({ errorCode: 'SELF_SIGNED_CERT_IN_CHAIN' });
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.status, 'failed');
  assert.equal(result.phase, 'tls_handshake');
  assert.equal(result.code, 'SELF_SIGNED_CERT_IN_CHAIN');
  assert.equal(result.socketsClosed, true);
  assert.equal(JSON.stringify(result).includes('raw-private-sentinel'), false);
});
test('passes a provided public CA only to this scoped strict TLS connection', async () => {
  const state = fixture();
  const result = await probePoolerTls({ ...state.dependencies, ca: 'test-only-public-ca' });
  assert.equal(result.status, 'verified');
  assert.equal(state.calls[1].options.ca, 'test-only-public-ca');
  assert.equal(state.calls[1].options.rejectUnauthorized, true);
  assert.equal(state.calls[1].options.servername, 'aws-1-eu-central-1.pooler.supabase.com');
});
test('redacts an unknown native error code', async () => {
  const state = fixture({ errorCode: 'raw-private-sentinel' });
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.code, 'TLS_ERROR');
  assert.equal(JSON.stringify(result).includes('raw-private-sentinel'), false);
});
test('never falls back to plaintext when SSL is refused', async () => {
  const state = fixture({ response: 'N' });
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.code, 'SSL_NOT_SUPPORTED');
  assert.equal(result.phase, 'ssl_request');
  assert.equal(state.calls.length, 1);
  assert.equal(state.plain.writes.length, 1);
});
test('bounds an unresponsive connection and closes its socket', async () => {
  const state = fixture({ connected: false });
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.code, 'TIMEOUT');
  assert.equal(result.phase, 'tcp_connect');
  assert.equal(result.socketsClosed, true);
});
test('closes the owning TLS wrapper first instead of destroying its live underlying TCP handle', async () => {
  const state = fixture();
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.socketsClosed, true);
  assert.deepEqual(state.destroyOrder, ['secure']);
  assert.equal(state.plain.destroyCalls, 0);
  assert.equal(state.secure.destroyCalls, 1);
});
test('waits for the delayed owning TLS close event before reporting cleanup complete', async () => {
  const state = fixture();
  state.secure.closeDelay = 10;
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.socketsClosed, true);
  assert.equal(state.secure.closed, true);
  assert.equal(state.plain.destroyCalls, 0);
});
test('requires only the actual TLS owner close, even if the detached raw object emits no close event', async () => {
  const state = fixture();
  state.secure.ownedSocket = undefined;
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.socketsClosed, true);
  assert.equal(state.plain.destroyCalls, 0);
});
test('bounds cleanup when the owner never confirms close without destroying the wrapped raw socket', async () => {
  const state = fixture();
  state.secure.neverClose = true;
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.socketsClosed, false);
  assert.equal(result.code, 'TLS_CLEANUP_INCOMPLETE');
  assert.equal(state.plain.destroyCalls, 0);
  assert.equal(state.secure.destroyCalls, 1);
});
test('destroys only the raw socket when tls.connect throws before producing a wrapper', async () => {
  const state = fixture();
  state.dependencies.tlsConnect = () => {
    throw new Error('raw-private-sentinel');
  };
  const result = await probePoolerTls(state.dependencies);
  assert.equal(result.code, 'TLS_ERROR');
  assert.equal(result.socketsClosed, true);
  assert.equal(state.plain.destroyCalls, 1);
  assert.equal(state.secure.destroyCalls, 0);
  assert.equal(JSON.stringify(result).includes('raw-private-sentinel'), false);
});
test('rejects pending or wrong-target public CA pins before any certificate read', () => {
  const metadata = {
    version: 1,
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    sourceUrl: 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',
    sha256: 'a'.repeat(64),
  };
  assert.equal(approvedCaPin(metadata).sha256, metadata.sha256);
  for (const value of [
    { ...metadata, sha256: null },
    { ...metadata, sha256: 'invalid' },
    { ...metadata, projectRef: 'hkiafqrcxaafdbcvjlzv' },
    { ...metadata, host: 'example.com' },
    { ...metadata, sourceUrl: 'https://example.com/untrusted.crt' },
    { ...metadata, extra: true },
  ])
    assert.throws(() => approvedCaPin(value), /PUBLIC_CA_PIN_PENDING_OR_INVALID/);
});
