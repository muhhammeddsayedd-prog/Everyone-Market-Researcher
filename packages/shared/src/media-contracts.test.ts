import { describe, expect, it } from 'vitest';
import {
  mediaQueueMessage,
  mediaStoragePath,
  mediaTarget,
  mediaThumbnailPath,
  mediaBatchInput,
  mediaBatchSummary,
} from './media-contracts';

describe('M06 thumbnail contracts', () => {
  it('accepts only a native execution identity, never caller-selected targets or source URLs', () => {
    expect(mediaBatchInput.safeParse({ execution_id: '310001' }).success).toBe(true);
    for (const input of [
      { execution_id: '0' },
      { execution_id: '1'.repeat(21) },
      { execution_id: '310001', url: 'https://attacker.example/x' },
      { execution_id: '310001', batch_size: 50 },
    ])
      expect(mediaBatchInput.safeParse(input).success).toBe(false);
  });
  it('keeps held work and unknown charges distinct from successful completion', () => {
    const base = {
      state: 'completed',
      claimed: 0,
      processed: 0,
      held: 0,
      stored: 0,
      skipped: 0,
      expired: 0,
      retryable: 0,
      reconciliation_required: 0,
      bytes: 0,
      infrastructure_cost_usd: null,
    };
    expect(mediaBatchSummary.safeParse(base).success).toBe(true);
    expect(
      mediaBatchSummary.safeParse({ ...base, state: 'reconciliation_required', claimed: 1, held: 1 }).success,
    ).toBe(true);
    for (const changed of [
      { claimed: 1 },
      { infrastructure_cost_usd: 0 },
      { claimed: 51 },
      { claimed: 1, processed: 1, retryable: 1 },
    ])
      expect(mediaBatchSummary.safeParse({ ...base, ...changed }).success).toBe(false);
  });
  it('derives one canonical thumbnail key from trusted item identity', () => {
    expect(
      mediaThumbnailPath({
        competitor_slug: 'everyone',
        platform: 'instagram_stories',
        external_id: '123_456',
      }),
    ).toBe('everyone/instagram_stories/123_456/thumb.jpg');
  });
  it.each([
    '../instagram/1/thumb.jpg',
    '/everyone/instagram/1/thumb.jpg',
    'everyone/instagram/../thumb.jpg',
    'everyone/instagram/./thumb.jpg',
    'everyone/instagram/a..b/thumb.jpg',
    'everyone/instagram/a%2fb/thumb.jpg',
    'everyone/instagram/1/frame-01.jpg',
    'everyone/news/1/thumb.jpg',
    'everyone/instagram/1/thumb.jpg?x=1',
  ])('rejects noncanonical or out-of-slice key %s', (path) => {
    expect(mediaStoragePath.safeParse(path).success).toBe(false);
  });
  it('preserves bigint queue IDs without numeric coercion', () => {
    expect(
      mediaQueueMessage.parse({
        msg_id: '9223372036854775807',
        read_ct: 1,
        message: { item_id: '06000000-0000-4000-8000-000000000001' },
      }).msg_id,
    ).toBe('9223372036854775807');
    expect(
      mediaQueueMessage.safeParse({
        msg_id: 9007199254740992,
        read_ct: 1,
        message: { item_id: '06000000-0000-4000-8000-000000000001' },
      }).success,
    ).toBe(false);
  });
  it('rejects a target whose path belongs to another item', () => {
    expect(
      mediaTarget.safeParse({
        item_id: '06000000-0000-4000-8000-000000000001',
        competitor_slug: 'everyone',
        platform: 'vimeo',
        external_id: '123',
        thumbnail_source_url: null,
        has_thumbnail: false,
        thumbnail_locked: false,
        storage_path: 'other/vimeo/123/thumb.jpg',
      }).success,
    ).toBe(false);
  });
});
