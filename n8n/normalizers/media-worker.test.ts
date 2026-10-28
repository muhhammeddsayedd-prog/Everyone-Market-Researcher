import { describe, it, expect, vi } from 'vitest';
import { runMediaBatch, devMediaStorageOrigin, type MediaPorts } from '../media/worker';

const id = '06000000-0000-4000-8000-000000000001';
const target = {
  item_id: id,
  competitor_slug: 'everyone',
  platform: 'instagram_stories',
  external_id: '123',
  thumbnail_source_url: 'https://scontent.cdninstagram.com/image.jpg?expires=123',
  has_thumbnail: false,
  thumbnail_locked: false,
  storage_path: 'everyone/instagram_stories/123/thumb.jpg',
};
const jpeg = new Uint8Array([255, 216, 10, 20, 255, 217]);
function fixture() {
  const events: string[] = [];
  const ports: MediaPorts = {
    claim: vi.fn(async () => [{ msg_id: '9223372036854775807', read_ct: 1, message: { item_id: id } }]),
    targets: vi.fn(async () => [target]),
    download: vi.fn(async () => ({
      status: 200,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    })),
    resize: vi.fn(async () => ({ bytes: jpeg, width: 1280, height: 720 })),
    sign: vi.fn(async (path) => ({
      path,
      token: 'synthetic-capability',
      signedUrl:
        devMediaStorageOrigin +
        '/storage/v1/object/upload/sign/media/' +
        path +
        '?token=synthetic-capability',
    })),
    upload: vi.fn(async () => {
      events.push('upload');
      return { status: 200 };
    }),
    save: vi.fn(async () => {
      events.push('save');
    }),
    record: vi.fn(async () => {
      events.push('record');
    }),
    ack: vi.fn(async () => {
      events.push('ack');
    }),
  };
  return { ports, events };
}
describe('M06 local media queue orchestration', () => {
  it('uploads immutable JPEG, saves metadata then records/acks; byte usage is unpriced', async () => {
    const { ports, events } = fixture();
    const result = await runMediaBatch(ports);
    expect(result.outcomes[0]).toMatchObject({ outcome: 'stored', bytes: 6, cost_usd: null });
    expect(events).toEqual(['upload', 'save', 'record', 'ack']);
    expect(ports.upload).toHaveBeenCalledWith(
      expect.any(String),
      jpeg,
      { contentType: 'image/jpeg', upsert: false },
      expect.any(AbortSignal),
    );
    expect(ports.resize).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      { width: 1280, withoutEnlargement: true, format: 'jpeg', quality: 80, maxInputPixels: 25000000 },
      expect.any(AbortSignal),
    );
  });
  it('groups duplicate queue messages by item without duplicate uploads', async () => {
    const { ports } = fixture();
    ports.claim = vi.fn(async () => [1, 2].map((n) => ({ msg_id: n, read_ct: 1, message: { item_id: id } })));
    const r = await runMediaBatch(ports);
    expect(r.claimed).toBe(2);
    expect(ports.upload).toHaveBeenCalledTimes(1);
    expect(ports.ack).toHaveBeenCalledWith(['1', '2'], expect.any(AbortSignal));
  });
  it.each(['has_thumbnail', 'thumbnail_locked', 'no_source', 'missing'])(
    'acks %s without fetching/signing',
    async (kind) => {
      const { ports } = fixture();
      ports.targets = vi.fn(async () =>
        kind === 'missing'
          ? []
          : [{ ...target, ...(kind === 'no_source' ? { thumbnail_source_url: null } : { [kind]: true }) }],
      );
      expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('skipped');
      expect(ports.download).not.toHaveBeenCalled();
      expect(ports.sign).not.toHaveBeenCalled();
      expect(ports.ack).toHaveBeenCalledTimes(1);
    },
  );
  it.each([403, 404, 410])('archives expired source HTTP%s without signing', async (status) => {
    const { ports } = fixture();
    ports.download = vi.fn(async () => ({ status, bytes: new Uint8Array(), contentType: '' }));
    expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('media_expired');
    expect(ports.sign).not.toHaveBeenCalled();
    expect(ports.ack).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500, 503])('leaves retryable source HTTP%s unacked', async (status) => {
    const { ports } = fixture();
    ports.download = vi.fn(async () => ({ status, bytes: new Uint8Array(), contentType: '' }));
    expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('retryable');
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('does not overwrite or accept an immutable object collision', async () => {
    const { ports } = fixture();
    ports.upload = vi.fn(async () => ({ status: 409 }));
    expect((await runMediaBatch(ports)).outcomes[0]).toMatchObject({
      outcome: 'reconciliation_required',
      code: 'immutable_object_exists',
    });
    expect(ports.save).not.toHaveBeenCalled();
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('preserves an acknowledged object when its metadata save fails', async () => {
    const { ports } = fixture();
    ports.save = vi.fn(async () => {
      throw Error('sensitive backend detail');
    });
    const r = await runMediaBatch(ports);
    expect(r.outcomes[0]).toMatchObject({ outcome: 'reconciliation_required', code: 'media_save_failed' });
    expect(JSON.stringify(r)).not.toContain('sensitive');
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('leaves a completed save retry safe when acknowledgement fails', async () => {
    const { ports } = fixture();
    ports.ack = vi.fn(async () => {
      throw Error('lost acknowledgement');
    });
    expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('reconciliation_required');
    expect(ports.upload).toHaveBeenCalledTimes(1);
  });
  it.each([
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'http://cdn.example.com/image.jpg',
    'https://cdn.example.com/movie.mp4',
    'https://u:p@cdn.example.com/x',
    'https://private.local/x',
  ])('rejects unsafe source %s before I/O', async (url) => {
    const { ports } = fixture();
    ports.targets = vi.fn(async () => [{ ...target, thumbnail_source_url: url }]);
    expect((await runMediaBatch(ports)).outcomes[0]?.code).toBe('unsafe_media_source');
    expect(ports.download).not.toHaveBeenCalled();
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('rejects a foreign signed upload capability before sending bytes', async () => {
    const { ports } = fixture();
    ports.sign = vi.fn(async (path) => ({
      path,
      token: 'fixture',
      signedUrl: 'https://attacker.example.com/?token=fixture',
    }));
    expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('reconciliation_required');
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('rejects video responses and malformed JPEG output', async () => {
    const a = fixture();
    a.ports.download = vi.fn(async () => ({
      status: 200,
      bytes: new Uint8Array([1]),
      contentType: 'video/mp4',
    }));
    await runMediaBatch(a.ports);
    expect(a.ports.resize).not.toHaveBeenCalled();
    expect(a.ports.ack).not.toHaveBeenCalled();
    const b = fixture();
    b.ports.resize = vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3, 4]), width: 1280, height: 720 }));
    await runMediaBatch(b.ports);
    expect(b.ports.sign).not.toHaveBeenCalled();
  });
  it('rejects malformed or duplicate claims before fetching context', async () => {
    const { ports } = fixture();
    ports.claim = vi.fn(async () => [
      { msg_id: '1', read_ct: 1, message: { item_id: id } },
      { msg_id: '1', read_ct: 1, message: { item_id: id } },
    ]);
    await expect(runMediaBatch(ports)).rejects.toThrow('duplicate_media_message');
    expect(ports.targets).not.toHaveBeenCalled();
  });
  it('rejects cancellation before claiming', async () => {
    const { ports } = fixture(),
      controller = new AbortController();
    controller.abort();
    await expect(runMediaBatch(ports, { signal: controller.signal })).rejects.toThrow();
    expect(ports.claim).not.toHaveBeenCalled();
  });
  it('does not blindly retry an upload whose response was lost', async () => {
    const { ports } = fixture();
    ports.upload = vi.fn(async () => {
      throw Error('uncertain transport');
    });
    expect((await runMediaBatch(ports)).outcomes[0]).toMatchObject({
      outcome: 'reconciliation_required',
      code: 'media_upload_failed',
    });
    expect(ports.upload).toHaveBeenCalledTimes(1);
    expect(ports.save).not.toHaveBeenCalled();
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('rejects duplicate signed token query parameters', async () => {
    const { ports } = fixture();
    ports.sign = vi.fn(async (path) => ({
      path,
      token: 'fixture',
      signedUrl:
        devMediaStorageOrigin +
        '/storage/v1/object/upload/sign/media/' +
        path +
        '?token=fixture&token=fixture',
    }));
    expect((await runMediaBatch(ports)).outcomes[0]?.outcome).toBe('reconciliation_required');
    expect(ports.upload).not.toHaveBeenCalled();
  });
  it('stops network retries after the bounded queue delivery count', async () => {
    const { ports } = fixture();
    ports.claim = vi.fn(async () => [{ msg_id: 1, read_ct: 4, message: { item_id: id } }]);
    expect((await runMediaBatch(ports)).outcomes[0]?.code).toBe('media_retry_exhausted');
    expect(ports.download).not.toHaveBeenCalled();
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('aborts and awaits a sibling when recording fails before returning failure', async () => {
    const { ports } = fixture(),
      other = '06000000-0000-4000-8000-000000000002';
    let siblingClosed = false;
    ports.claim = vi.fn(async () =>
      [id, other].map((item_id, i) => ({ msg_id: i + 1, read_ct: 1, message: { item_id } })),
    );
    ports.targets = vi.fn(async () => [
      target,
      {
        ...target,
        item_id: other,
        external_id: '456',
        storage_path: 'everyone/instagram_stories/456/thumb.jpg',
        thumbnail_source_url: 'https://scontent.cdninstagram.com/slow.jpg',
      },
    ]);
    ports.download = vi.fn(async (url, _options, signal) => {
      if (!url.includes('slow')) return { status: 200, bytes: new Uint8Array([1]), contentType: 'image/png' };
      return new Promise<never>((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            siblingClosed = true;
            reject(Error('aborted'));
          },
          { once: true },
        );
      });
    });
    ports.record = vi.fn(async () => {
      throw Error('private log failure');
    });
    await expect(runMediaBatch(ports)).rejects.toThrow('media_batch_failed');
    expect(siblingClosed).toBe(true);
    expect(ports.record).toHaveBeenCalledTimes(1);
    expect(ports.ack).not.toHaveBeenCalled();
  });
  it('acknowledges an already-saved thumbnail after exhausted ACK deliveries without more I/O', async () => {
    const { ports } = fixture();
    ports.claim = vi.fn(async () => [{ msg_id: '1', read_ct: 8, message: { item_id: id } }]);
    ports.targets = vi.fn(async () => [{ ...target, has_thumbnail: true }]);
    expect((await runMediaBatch(ports)).outcomes[0]).toMatchObject({
      outcome: 'skipped',
      code: 'already_stored',
    });
    expect(ports.download).not.toHaveBeenCalled();
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.save).not.toHaveBeenCalled();
    expect(ports.ack).toHaveBeenCalledWith(['1'], expect.any(AbortSignal));
  });
});
