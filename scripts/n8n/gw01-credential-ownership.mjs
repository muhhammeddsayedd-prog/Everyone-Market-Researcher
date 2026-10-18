import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ids = { canary: 'EmrGw01Canary18', machine: 'EmrGw01Machine18' };
const names = { canary: 'M03 GW-01 privacy canary [dev]', machine: 'M03 GW-01 machine [dev]' };
const reject = () => {
  throw Error('GW01_DELIVERY_OWNERSHIP_UNVERIFIED');
};
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const iso = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
export function assertCredentialMetadata(raw, key) {
  if (
    !Object.hasOwn(ids, key) ||
    raw === null ||
    typeof raw !== 'object' ||
    raw.id !== ids[key] ||
    raw.name !== names[key] ||
    raw.type !== 'httpCustomAuth' ||
    Object.hasOwn(raw, 'data') ||
    !iso(raw.createdAt)
  )
    reject();
  return { id: raw.id, name: raw.name, type: raw.type, createdAt: raw.createdAt };
}
export function readCredentialProvenance(ownership, key, audience) {
  const events = ownership.read(key);
  if (!Array.isArray(events) || events.length < 1 || events.length > 3) reject();
  const intent = events[0];
  if (
    !exact(intent, [
      'version',
      'kind',
      'windowId',
      'projectId',
      'audience',
      'id',
      'name',
      'type',
      'createdAt',
    ]) ||
    intent.version !== 1 ||
    intent.kind !== 'intent' ||
    intent.windowId !== '76c2ad42-c094-4ba4-9a0b-566e19b97780' ||
    intent.projectId !== 'pHvQjDmjxVZ3KQLT' ||
    (audience !== undefined && intent.audience !== audience) ||
    typeof intent.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(intent.audience) ||
    intent.id !== ids[key] ||
    intent.name !== names[key] ||
    intent.type !== 'httpCustomAuth' ||
    !iso(intent.createdAt)
  )
    reject();
  const created = events[1];
  if (
    created !== undefined &&
    (!exact(created, ['kind', 'credential']) ||
      created.kind !== 'created' ||
      !exact(created.credential, ['id', 'name', 'type', 'createdAt']) ||
      assertCredentialMetadata(created.credential, key).id !== intent.id)
  )
    reject();
  if (events[2] !== undefined && (!exact(events[2], ['kind']) || events[2].kind !== 'deleted')) reject();
  return { intent, created, deleted: events.length === 3 };
}
export function credentialOwnership(root) {
  const directory = resolve(root, 'scripts/n8n/out');
  function path(key) {
    if (!Object.hasOwn(ids, key) && key !== 'environment') reject();
    for (let p = directory; ; p = dirname(p)) {
      if (existsSync(p) && lstatSync(p).isSymbolicLink()) reject();
      if (dirname(p) === p) break;
    }
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const target = join(
      directory,
      key === 'environment' ? 'gw01-environment-delivery.jsonl' : `gw01-credential-${ids[key]}.jsonl`,
    );
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) reject();
    return target;
  }
  const read = (key) => {
    const target = path(key);
    if (!existsSync(target)) return null;
    if (lstatSync(target).size > 8192) reject();
    try {
      return readFileSync(target, 'utf8')
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
    } catch {
      reject();
    }
  };
  function append(key, event, initial = false) {
    const fd = openSync(path(key), initial ? 'wx' : 'a');
    try {
      writeSync(fd, JSON.stringify(event) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  return { read, begin: (key, event) => append(key, event, true), append };
}
