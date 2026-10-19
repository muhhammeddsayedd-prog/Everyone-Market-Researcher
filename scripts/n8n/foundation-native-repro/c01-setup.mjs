/* eslint-disable no-console -- Opt-in synthetic local CLI; no hosted or real credential values. */
if (!process.argv.includes('--isolated-local')) throw Error('C01_ISOLATED_LOCAL_REQUIRED');
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname);
if (!root.endsWith('.c01-repro.local')) throw Error('C01_ROOT');
const name = 'emr-m03-c01-repro-20261019';
const network = name + '-network';
const image = 'n8nio/n8n:2.43.5';
function docker(args, okay = false) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  if (!okay && r.status !== 0) throw Error('C01_DOCKER_' + args[0]);
  return { code: r.status, text: r.stdout?.trim() ?? '' };
}
if (
  docker(['container', 'inspect', name, '--format', '{{.Id}}'], true).code === 0 ||
  docker(['network', 'inspect', network, '--format', '{{.Id}}'], true).code === 0 ||
  existsSync(resolve(root, 'manifest.json'))
)
  throw Error('C01_OWNERSHIP_EXISTS');
const imageId = docker(['image', 'inspect', image, '--format', '{{.Id}}']).text;
const labels = JSON.parse(docker(['image', 'inspect', image, '--format', '{{json .Config.Labels}}']).text);
if (labels['org.opencontainers.image.version'] !== '2.43.5') throw Error('C01_VERSION');
mkdirSync(resolve(root, 'state'), { recursive: true });
const manifest = {
  owner: 'emr-m03-c01-repro-20261019',
  name,
  network,
  image,
  imageId,
  version: '2.43.5',
  base: 'http://127.0.0.1:56794',
  memory: '1g',
  cpus: '1',
  pids: 256,
  outboundNetwork: false,
  createdAt: new Date().toISOString(),
};
writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
docker(['network', 'create', '--internal', '--label', 'com.emr.owner=' + name, network]);
docker([
  'run',
  '-d',
  '--name',
  name,
  '--label',
  'com.emr.owner=' + name,
  '--network',
  network,
  '--cpus',
  '1',
  '--memory',
  '1g',
  '--pids-limit',
  '256',
  '-p',
  '127.0.0.1:56794:5678',
  '--mount',
  'type=bind,source=' + resolve(root, 'state') + ',target=/home/node/.n8n',
  '--mount',
  'type=bind,source=' + root + ',target=/c01-repro,readonly',
  '-e',
  'N8N_DIAGNOSTICS_ENABLED=false',
  '-e',
  'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
  '-e',
  'N8N_TEMPLATES_ENABLED=false',
  '-e',
  'N8N_PERSONALIZATION_ENABLED=false',
  '-e',
  'N8N_COMMUNITY_PACKAGES_ENABLED=false',
  '-e',
  'N8N_SECURE_COOKIE=false',
  '-e',
  'N8N_LOG_LEVEL=error',
  '-e',
  'GENERIC_TIMEZONE=UTC',
  '-e',
  'TZ=UTC',
  imageId,
]);
console.log(JSON.stringify({ status: 'LOCAL_C01_CREATED', ...manifest }));
