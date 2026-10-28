import { describe, expect, it } from 'vitest';
import { mediaQueueMessage, mediaStoragePath, mediaTarget, mediaThumbnailPath } from './media-contracts';

describe('M06 thumbnail contracts', () => {
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
