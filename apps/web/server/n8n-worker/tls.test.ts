// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { connect, createServer } from 'node:tls';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { strictTlsOptions } from './database';
let dir: string;
const openssl =
  process.platform === 'win32' && existsSync('C:/Program Files/Git/usr/bin/openssl.exe')
    ? 'C:/Program Files/Git/usr/bin/openssl.exe'
    : 'openssl';
function command(...args: string[]) {
  try {
    execFileSync(openssl, args, { cwd: dir, stdio: 'ignore', timeout: 20000 });
  } catch {
    throw new Error('GW01_SYNTHETIC_CERTIFICATE_FIXTURE_FAILED');
  }
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'emr-gw01-tls-'));
  command(
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-subj',
    '/CN=GW01 fixture root',
    '-keyout',
    'root.key',
    '-out',
    'root.pem',
  );
  command(
    'req',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-subj',
    '/CN=localhost',
    '-keyout',
    'leaf.key',
    '-out',
    'leaf.csr',
  );
  writeFileSync(join(dir, 'san.cnf'), 'subjectAltName=DNS:localhost\nbasicConstraints=CA:FALSE\n');
  command(
    'x509',
    '-req',
    '-in',
    'leaf.csr',
    '-CA',
    'root.pem',
    '-CAkey',
    'root.key',
    '-CAcreateserial',
    '-days',
    '1',
    '-extfile',
    'san.cnf',
    '-out',
    'valid.pem',
  );
  writeFileSync(join(dir, 'index.txt'), '');
  writeFileSync(join(dir, 'serial'), '1000\n');
  writeFileSync(
    join(dir, 'expire.cnf'),
    '[ca]\ndefault_ca=fixture\n[fixture]\ndatabase=index.txt\nserial=serial\nnew_certs_dir=.\ncertificate=root.pem\nprivate_key=root.key\ndefault_md=sha256\npolicy=policy\nx509_extensions=leaf\n[policy]\ncommonName=supplied\n[leaf]\nsubjectAltName=DNS:localhost\nbasicConstraints=CA:FALSE\n',
  );
  command(
    'ca',
    '-config',
    'expire.cnf',
    '-batch',
    '-notext',
    '-in',
    'leaf.csr',
    '-out',
    'expired.pem',
    '-startdate',
    '20200101000000Z',
    '-enddate',
    '20200102000000Z',
  );
  command(
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost',
    '-keyout',
    'other.key',
    '-out',
    'other.pem',
  );
}, 30000);
afterAll(() => {
  if (!dir) return;
  const resolved = realpathSync(dir),
    root = realpathSync(tmpdir());
  if (!resolved.startsWith(root + sep) || !basename(resolved).startsWith('emr-gw01-tls-'))
    throw new Error('GW01_FIXTURE_CLEANUP_BOUNDARY');
  rmSync(resolved, { recursive: true, force: true });
});
async function handshake(cert: string, key: string, ca: string, hostname = 'localhost'): Promise<string> {
  const server = createServer({ cert: readFileSync(join(dir, cert)), key: readFileSync(join(dir, key)) });
  server.on('tlsClientError', () => {});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('GW01_FIXTURE_LISTEN');
  try {
    return await new Promise<string>((resolve) => {
      const socket = connect({
        host: '127.0.0.1',
        port: address.port,
        ...strictTlsOptions(readFileSync(join(dir, ca)), hostname),
      });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve('fixture_timeout');
      }, 3000);
      const done = (result: string) => {
        clearTimeout(timer);
        socket.destroy();
        resolve(result);
      };
      socket.once('secureConnect', () => done(socket.authorized ? 'verified' : 'unauthorized'));
      socket.once('error', (error: NodeJS.ErrnoException) => done(error.code ?? 'unclassified'));
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
it('accepts a correct CA and hostname with a real isolated TLS handshake', async () =>
  expect(await handshake('valid.pem', 'leaf.key', 'root.pem')).toBe('verified'));
it('rejects an unrelated CA with a certificate-chain failure', async () =>
  expect(await handshake('valid.pem', 'leaf.key', 'other.pem')).toMatch(
    /UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_GET_ISSUER_CERT_LOCALLY/,
  ));
it('rejects a wrong hostname despite a trusted valid chain', async () =>
  expect(await handshake('valid.pem', 'leaf.key', 'root.pem', 'wrong.invalid')).toBe(
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ));
it('rejects an expired signed certificate', async () =>
  expect(await handshake('expired.pem', 'leaf.key', 'root.pem')).toBe('CERT_HAS_EXPIRED'));
it('rejects a self-signed untrusted endpoint', async () =>
  expect(await handshake('other.pem', 'other.key', 'root.pem')).toBe('DEPTH_ZERO_SELF_SIGNED_CERT'));
