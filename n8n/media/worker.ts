import { isIP } from 'node:net';
import {
  mediaQueueMessage,
  mediaTarget,
  mediaSignedUpload,
  type MediaTarget,
  type MediaSignedUpload,
} from '../../packages/shared/src/media-contracts';

export const devMediaStorageOrigin = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
const maxDownloadBytes = 5 * 1024 * 1024;
const maxThumbnailBytes = 2 * 1024 * 1024;
export type MediaOutcome = {
  item_id: string;
  msg_ids: string[];
  outcome: 'stored' | 'skipped' | 'media_expired' | 'retryable' | 'reconciliation_required';
  code: string;
  bytes: number;
  cost_usd: null;
};
export interface MediaPorts {
  claim(
    options: { queue: 'media'; count: 50; visibilitySeconds: 600 },
    signal: AbortSignal,
  ): Promise<unknown[]>;
  targets(itemIds: string[], signal: AbortSignal): Promise<unknown[]>;
  /** Adapter must reject non-public DNS/IPs, redirects, non-image headers and oversized bodies before reading them. */
  download(
    url: string,
    options: {
      maxBytes: number;
      timeoutMs: 20000;
      redirect: 'error';
      accept: 'image/jpeg,image/png,image/webp';
    },
    signal: AbortSignal,
  ): Promise<{ status: number; bytes: Uint8Array; contentType: string }>;
  resize(
    bytes: Uint8Array,
    options: { width: 1280; withoutEnlargement: true; format: 'jpeg'; quality: 80; maxInputPixels: 25000000 },
    signal: AbortSignal,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }>;
  sign(path: string, signal: AbortSignal): Promise<MediaSignedUpload>;
  upload(
    url: string,
    bytes: Uint8Array,
    options: { contentType: 'image/jpeg'; upsert: false },
    signal: AbortSignal,
  ): Promise<{ status: number }>;
  save(
    asset: {
      item_id: string;
      kind: 'thumbnail';
      path: string;
      source_url: string;
      width: number;
      height: number;
    },
    signal: AbortSignal,
  ): Promise<void>;
  record(outcome: MediaOutcome, signal: AbortSignal): Promise<void>;
  ack(messageIds: string[], signal: AbortSignal): Promise<void>;
}

function imageSource(value: string): boolean {
  try {
    const u = new URL(value),
      labels = u.hostname.split('.'),
      suffix = labels.at(-1) ?? '';
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      !isIP(u.hostname.replace(/^\[|\]$/g, '')) &&
      labels.length >= 2 &&
      ![
        'local',
        'internal',
        'localhost',
        'test',
        'invalid',
        'example',
        'onion',
        'lan',
        'home',
        'arpa',
      ].includes(suffix) &&
      labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) &&
      !/\.(?:mp4|mov|m3u8|webm|mp3|wav)(?:$|\/)/i.test(u.pathname) &&
      !/[\s\\\u0000-\u001f\u007f]/.test(value)
    );
  } catch {
    return false;
  }
}
function signedTarget(value: unknown, target: MediaTarget): MediaSignedUpload {
  const signed = mediaSignedUpload.parse(value),
    url = new URL(signed.signedUrl);
  const path = '/storage/v1/object/upload/sign/media/' + target.storage_path;
  if (
    signed.path !== target.storage_path ||
    url.origin !== devMediaStorageOrigin ||
    url.pathname !== path ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.get('token') !== signed.token ||
    url.searchParams.size !== 1 ||
    [...url.searchParams.keys()].some((k) => k !== 'token')
  )
    throw Error('invalid_upload_target');
  return signed;
}

/** Local product orchestration. Native Cloud/DNS/image/storage adapters are a separate live gate. */
export async function runMediaBatch(
  ports: MediaPorts,
  options: { signal?: AbortSignal; deadlineMs?: number } = {},
) {
  const deadlineMs = options.deadlineMs ?? 240000;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 240000)
    throw Error('invalid_media_deadline');
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), deadlineMs);
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const outcomes: MediaOutcome[] = [];
  try {
    signal.throwIfAborted();
    const raw = await ports.claim({ queue: 'media', count: 50, visibilitySeconds: 600 }, signal);
    if (!Array.isArray(raw) || raw.length > 50) throw Error('invalid_media_claim');
    const messages = raw.map((m) => mediaQueueMessage.parse(m));
    if (new Set(messages.map((m) => m.msg_id)).size !== messages.length)
      throw Error('duplicate_media_message');
    if (!messages.length) return { outcomes, claimed: 0 };
    const grouped = new Map<string, string[]>();
    for (const m of messages)
      grouped.set(m.message.item_id, [...(grouped.get(m.message.item_id) ?? []), m.msg_id]);
    const rawTargets = await ports.targets([...grouped.keys()], signal);
    if (!Array.isArray(rawTargets) || rawTargets.length > grouped.size) throw Error('invalid_media_targets');
    const targets = rawTargets.map((t) => mediaTarget.parse(t));
    if (
      new Set(targets.map((t) => t.item_id)).size !== targets.length ||
      targets.some((t) => !grouped.has(t.item_id))
    )
      throw Error('foreign_media_target');
    const process = async ([item_id, msg_ids]: [string, string[]]) => {
      const target = targets.find((t) => t.item_id === item_id);
      let outcome: MediaOutcome = {
        item_id,
        msg_ids,
        outcome: 'retryable',
        code: 'media_transport_failed',
        bytes: 0,
        cost_usd: null,
      };
      let stage = 'download';
      const finish = async (ack: boolean) => {
        signal.throwIfAborted();
        stage = 'record';
        await ports.record(outcome, signal);
        signal.throwIfAborted();
        stage = 'ack';
        if (ack) await ports.ack(msg_ids, signal);
        outcomes.push(outcome);
      };
      try {
        signal.throwIfAborted();
        if (!target || target.has_thumbnail || target.thumbnail_locked || !target.thumbnail_source_url) {
          outcome = {
            ...outcome,
            outcome: 'skipped',
            code: !target
              ? 'missing_target'
              : target.thumbnail_locked
                ? 'human_locked'
                : target.has_thumbnail
                  ? 'already_stored'
                  : 'no_source',
          };
          await finish(true);
          return;
        }
        if (messages.some((m) => msg_ids.includes(m.msg_id) && m.read_ct > 3)) {
          outcome = { ...outcome, outcome: 'reconciliation_required', code: 'media_retry_exhausted' };
          await finish(false);
          return;
        }
        if (!imageSource(target.thumbnail_source_url)) {
          outcome = { ...outcome, outcome: 'reconciliation_required', code: 'unsafe_media_source' };
          await finish(false);
          return;
        }
        const input = await ports.download(
          target.thumbnail_source_url,
          {
            maxBytes: maxDownloadBytes,
            timeoutMs: 20000,
            redirect: 'error',
            accept: 'image/jpeg,image/png,image/webp',
          },
          signal,
        );
        signal.throwIfAborted();
        if ([403, 404, 410].includes(input.status)) {
          outcome = { ...outcome, outcome: 'media_expired', code: 'source_expired' };
          await finish(true);
          return;
        }
        if (input.status !== 200) {
          await finish(false);
          return;
        }
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(input.contentType) ||
          !(input.bytes instanceof Uint8Array) ||
          input.bytes.byteLength < 1 ||
          input.bytes.byteLength > maxDownloadBytes
        )
          throw Error('invalid_image');
        stage = 'resize';
        const jpeg = await ports.resize(
          input.bytes,
          { width: 1280, withoutEnlargement: true, format: 'jpeg', quality: 80, maxInputPixels: 25000000 },
          signal,
        );
        signal.throwIfAborted();
        if (
          !(jpeg.bytes instanceof Uint8Array) ||
          jpeg.bytes.byteLength < 4 ||
          jpeg.bytes.byteLength > maxThumbnailBytes ||
          jpeg.bytes[0] !== 255 ||
          jpeg.bytes[1] !== 216 ||
          jpeg.bytes.at(-2) !== 255 ||
          jpeg.bytes.at(-1) !== 217 ||
          !Number.isSafeInteger(jpeg.width) ||
          jpeg.width < 1 ||
          jpeg.width > 1280 ||
          !Number.isSafeInteger(jpeg.height) ||
          jpeg.height < 1 ||
          jpeg.height > 16384
        )
          throw Error('invalid_thumbnail');
        stage = 'sign';
        const signed = signedTarget(await ports.sign(target.storage_path, signal), target);
        stage = 'upload';
        signal.throwIfAborted();
        // Payload bytes offered to PUT, not an assertion of wire delivery,
        // object persistence or billable usage when the response is uncertain.
        outcome.bytes = jpeg.bytes.byteLength;
        const uploaded = await ports.upload(
          signed.signedUrl,
          jpeg.bytes,
          { contentType: 'image/jpeg', upsert: false },
          signal,
        );
        signal.throwIfAborted();
        if (uploaded.status === 409) {
          outcome = { ...outcome, outcome: 'reconciliation_required', code: 'immutable_object_exists' };
          await finish(false);
          return;
        }
        if (![200, 201].includes(uploaded.status)) {
          outcome = { ...outcome, outcome: 'reconciliation_required', code: 'media_upload_failed' };
          await finish(false);
          return;
        }
        outcome.bytes = jpeg.bytes.byteLength;
        stage = 'save';
        await ports.save(
          {
            item_id,
            kind: 'thumbnail',
            path: target.storage_path,
            source_url: target.thumbnail_source_url,
            width: jpeg.width,
            height: jpeg.height,
          },
          signal,
        );
        signal.throwIfAborted();
        outcome = { ...outcome, outcome: 'stored', code: 'thumbnail_saved', bytes: jpeg.bytes.byteLength };
        stage = 'ack';
        await finish(true);
      } catch {
        if (signal.aborted) return;
        if (stage === 'record') throw Error('media_record_failed');
        outcome = {
          ...outcome,
          outcome: ['sign', 'upload', 'save', 'ack'].includes(stage)
            ? 'reconciliation_required'
            : 'retryable',
          code: 'media_' + stage + '_failed',
        };
        // A failed record/ack must not turn into a success or start another upload.
        await ports.record(outcome, signal);
        outcomes.push(outcome);
      }
    };
    const groups = [...grouped.entries()];
    for (let index = 0; index < groups.length; index += 5) {
      signal.throwIfAborted();
      const completed = await Promise.allSettled(
        groups.slice(index, index + 5).map((group) =>
          process(group).catch(() => {
            controller.abort();
            throw Error('media_batch_failed');
          }),
        ),
      );
      if (completed.some((result) => result.status === 'rejected')) throw Error('media_batch_failed');
    }
    signal.throwIfAborted();
    return { outcomes, claimed: messages.length };
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
