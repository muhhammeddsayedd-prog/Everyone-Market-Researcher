import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
} from 'node:fs';
import { resolve, join, parse } from 'node:path';
import { foundationScope } from './foundation-provision.mjs';
import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
const blocked = () => {
  throw Error('FOUNDATION_EXPORT_BLOCKED');
};
function physical(path) {
  const absolute = resolve(path),
    root = parse(absolute).root;
  let cursor = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    cursor = join(cursor, part);
    let entry;
    try {
      entry = lstatSync(cursor);
    } catch (error) {
      if (error.code !== 'ENOENT') blocked();
    }
    if (entry?.isSymbolicLink()) blocked();
  }
  return absolute;
}
export function writeCompleteSync(fd, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : typeof value === 'string'
      ? Buffer.from(value, 'utf8')
      : blocked();
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isInteger(written) || written <= 0 || written > bytes.length - offset) blocked();
    offset += written;
  }
}
export function createOwnedStagingExportWriter(repositoryRoot, secrets) {
  if (!Array.isArray(secrets) || secrets.length !== 2 || secrets.some((x) => typeof x !== 'string' || !x))
    blocked();
  const repo = physical(repositoryRoot),
    directory = physical(join(repo, 'n8n/workflows'));
  return (record) => {
    if (
      !record ||
      !Object.hasOwn(foundationWorkflowNames, record.key) ||
      record.projectId !== foundationScope.projectId ||
      record.active !== false ||
      record.activeVersionId !== null ||
      record.definitionProfile !== 'inactive_native_staging' ||
      typeof record.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(record.id) ||
      typeof record.versionId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(record.versionId) ||
      !record.workflow ||
      record.workflow.name !== foundationWorkflowNames[record.key] ||
      !/^[a-f0-9]{64}$/.test(record.intendedSourceHash) ||
      !/^[a-f0-9]{64}$/.test(record.stagedSourceHash)
    )
      blocked();
    const value = {
      ...record,
      kind: 'actual_saved_inactive_foundation_staging',
      version: 1,
      windowId: foundationScope.windowId,
    };
    const text = JSON.stringify(value, null, 2) + '\n';
    if (Buffer.byteLength(text) > 524288 || secrets.some((secret) => text.includes(secret))) blocked();
    physical(directory);
    mkdirSync(directory, { recursive: true });
    physical(directory);
    const target = physical(join(directory, record.key + '.json')),
      temporary = physical(target + '.pending');
    const prior = existsSync(target) ? readFileSync(target) : null;
    if (prior) {
      if (prior.length > 524288) blocked();
      let old;
      try {
        old = JSON.parse(prior.toString('utf8'));
      } catch {
        blocked();
      }
      if (typeof old.versionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(old.versionId)) blocked();
      old.versionId = value.versionId;
      if (JSON.stringify(old) !== JSON.stringify(value)) blocked();
    }
    if (existsSync(temporary)) blocked();
    const fd = openSync(temporary, 'wx');
    const bytes = Buffer.from(text, 'utf8');
    try {
      writeCompleteSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    physical(target);
    physical(temporary);
    if (!readFileSync(temporary).equals(bytes)) blocked();
    if (prior) {
      if (!existsSync(target) || !readFileSync(target).equals(prior)) blocked();
    } else if (existsSync(target)) blocked();
    renameSync(temporary, target);
  };
}
