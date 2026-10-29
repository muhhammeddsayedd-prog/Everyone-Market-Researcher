import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createMediaProcessHandler } from './media-process';
import { createMediaUploadReadinessHandler } from './media-upload';

const audience = 'https://everyone-market-researcher-local-test.vercel.app';
const secret = 'synthetic-internal-secret-32-characters';
const environment = {
  EMR_MEDIA_PROCESS_ENABLED: 'true',
  EMR_MEDIA_UPLOAD_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_GIT_COMMIT_REF: 'm06-collectors-stories-upkeep',
  VERCEL_URL: new URL(audience).hostname,
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  EMR_MEDIA_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  NEXT_PUBLIC_SUPABASE_URL: 'https://zmotjsbzhzjvpelxvxlf.supabase.co',
  INTERNAL_WEBHOOK_SECRET: secret,
  EMR_MEDIA_WRITER_PASSWORD: 'synthetic-writer-only',
  EMR_MEDIA_PROTECTION_BYPASS: 'synthetic-bypass-only',
};
const summary = {
  state: 'completed' as const,
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
function fixture(overrides: Record<string, string | undefined> = {}) {
  const db = {
    claim: vi.fn(async () => ({ replayed: false, state: 'running' as const, messages: [], held_count: 0 })),
    targets: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    record: vi.fn(async () => {}),
    ack: vi.fn(async () => {}),
    finish: vi.fn(async () => summary),
    close: vi.fn(async () => {}),
  };
  const http = { preflight: vi.fn(async () => {}), download: vi.fn(), sign: vi.fn(), upload: vi.fn() };
  const open = vi.fn(async () => db),
    transports = vi.fn(() => http);
  const handler = createMediaProcessHandler({
    environment: () => ({ ...environment, ...overrides }),
    open,
    transports,
  });
  return { db, http, open, transports, handler };
}
function req(
  body: unknown = { execution_id: '61001' },
  headers: Record<string, string> = {},
  url = audience + '/api/internal/media/process',
) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-emr-secret': secret, ...headers },
    body: JSON.stringify(body),
  });
}
describe('M06 deployed media endpoint composition', () => {
  it('preflights signing configuration before opening writer or claiming; closes after durable finish', async () => {
    const t = fixture(),
      events: string[] = [];
    t.http.preflight.mockImplementation(async () => {
      events.push('preflight');
    });
    t.open.mockImplementation(async () => {
      events.push('open');
      return t.db;
    });
    t.db.close.mockImplementation(async () => {
      events.push('close');
    });
    const r = await t.handler(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ version: 1, execution_id: '61001', replayed: false, ...summary });
    expect(events).toEqual(['preflight', 'open', 'close']);
    expect(t.transports).toHaveBeenCalledWith({
      audience,
      webhookSecret: secret,
      protectionBypass: environment.EMR_MEDIA_PROTECTION_BYPASS,
    });
    expect(t.open).toHaveBeenCalledWith(
      { writerPassword: environment.EMR_MEDIA_WRITER_PASSWORD, batchSize: 1, lane: 'media' },
      '61001',
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(t.db.finish).toHaveBeenCalledOnce();
  });
  it.each([
    { EMR_MEDIA_PROCESS_ENABLED: undefined },
    { VERCEL_ENV: 'production' },
    { VERCEL_GIT_COMMIT_REF: 'm05-collectors-web-youtube-linkedin' },
    { EMR_MEDIA_WRITER_PASSWORD: undefined },
    { INTERNAL_WEBHOOK_SECRET: undefined },
    { EMR_MEDIA_PROTECTION_BYPASS: undefined },
    { EMR_MEDIA_COMMIT_SHA: 'b'.repeat(40) },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://hkiafqrcxaafdbcvjlzv.supabase.co' },
    { EMR_MEDIA_BATCH_SIZE: '0' },
    { EMR_MEDIA_BATCH_SIZE: '6' },
    { EMR_MEDIA_QUEUE: 'arbitrary' },
  ])('missing/wrong binding fails before any I/O %o', async (changes) => {
    const t = fixture(changes);
    expect((await t.handler(req())).status).toBe(503);
    expect(t.transports).not.toHaveBeenCalled();
    expect(t.open).not.toHaveBeenCalled();
  });
  it('selects stories only from server configuration, never from request data', async () => {
    const t = fixture({ EMR_MEDIA_QUEUE: 'stories' });
    expect((await t.handler(req())).status).toBe(200);
    expect(t.open).toHaveBeenCalledWith(
      { writerPassword: environment.EMR_MEDIA_WRITER_PASSWORD, batchSize: 1, lane: 'stories' },
      '61001',
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect((await t.handler(req({ execution_id: '61002', lane: 'media' }))).status).toBe(400);
  });
  it.each([{ 'x-emr-secret': 'wrong' }, { cookie: 'session=x' }, { origin: audience }] as Record<
    string,
    string
  >[])('rejects forged/browser auth before I/O', async (headers) => {
    const t = fixture();
    expect((await t.handler(req(undefined, headers))).status).toBeGreaterThanOrEqual(400);
    expect(t.transports).not.toHaveBeenCalled();
    expect(t.open).not.toHaveBeenCalled();
  });
  it.each([
    { execution_id: '0' },
    { execution_id: 'x' },
    { execution_id: '61001', item_ids: ['foreign'] },
    { execution_id: '61001', url: 'https://attacker.example/x' },
  ])('cannot choose targets or transport', async (body) => {
    const t = fixture();
    expect((await t.handler(req(body))).status).toBe(400);
    expect(t.open).not.toHaveBeenCalled();
    expect(t.transports).not.toHaveBeenCalled();
  });
  it('remote missing signer configuration stops before writer/queue I/O and does not leak errors', async () => {
    const t = fixture();
    t.http.preflight.mockRejectedValue(Error('synthetic-sensitive-detail'));
    const r = await t.handler(req());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('synthetic-sensitive');
    expect(t.open).not.toHaveBeenCalled();
  });
  it('finished same-execution replay never enters image or queue processing again', async () => {
    const t = fixture();
    t.db.claim.mockResolvedValue({
      replayed: true,
      state: 'finished',
      messages: [],
      held_count: 0,
      result: summary,
    } as never);
    const r = await t.handler(req());
    expect(r.status).toBe(200);
    expect((await r.json()).replayed).toBe(true);
    expect(t.db.targets).not.toHaveBeenCalled();
    expect(t.http.download).not.toHaveBeenCalled();
    expect(t.db.finish).not.toHaveBeenCalled();
    expect(t.db.close).toHaveBeenCalledOnce();
  });
  it('an uncertain prior claim does not start or replay an upload', async () => {
    const t = fixture();
    t.db.claim.mockResolvedValue({
      replayed: true,
      state: 'reconciliation_required',
      messages: [],
      held_count: 0,
      result: null,
    } as never);
    expect((await t.handler(req())).status).toBe(409);
    expect(t.http.download).not.toHaveBeenCalled();
    expect(t.db.targets).not.toHaveBeenCalled();
    expect(t.db.close).toHaveBeenCalledOnce();
  });
  it('withholds success until database closure is confirmed', async () => {
    const t = fixture();
    t.db.close.mockRejectedValue(Error('private-driver-detail'));
    const r = await t.handler(req());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('private-driver');
  });
  it('awaits cancelled source I/O before closing the writer and returning', async () => {
    const t = fixture();
    let transportClosed = false;
    t.db.claim.mockResolvedValue({
      replayed: false,
      state: 'running',
      held_count: 0,
      messages: [{ msg_id: '1', read_ct: 1, message: { item_id: '06000000-0000-4000-8000-000000000001' } }],
    } as never);
    t.db.targets.mockResolvedValue([
      {
        item_id: '06000000-0000-4000-8000-000000000001',
        competitor_slug: 'everyone',
        platform: 'vimeo',
        external_id: '123',
        thumbnail_source_url: 'https://i.vimeocdn.com/local.jpg',
        has_thumbnail: false,
        thumbnail_locked: false,
        storage_path: 'everyone/vimeo/123/thumb.jpg',
      },
    ] as never);
    const controller = new AbortController();
    t.http.download.mockImplementation(
      async (_url, _options, signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () =>
              setTimeout(() => {
                transportClosed = true;
                reject(Error('private-native-error'));
              }, 5),
            { once: true },
          );
          controller.abort();
        }),
    );
    t.db.close.mockImplementation(async () => {
      expect(transportClosed).toBe(true);
    });
    const r = await t.handler(
      new Request(audience + '/api/internal/media/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-emr-secret': secret },
        body: JSON.stringify({ execution_id: '61001' }),
        signal: controller.signal,
      }),
    );
    expect(r.status).toBe(503);
    expect(t.db.close).toHaveBeenCalledOnce();
    expect(t.db.ack).not.toHaveBeenCalled();
    expect(await r.text()).not.toContain('private-native');
  });
  it('authenticated HEAD readiness uses signing configuration without a capability or Storage call', async () => {
    const head = createMediaUploadReadinessHandler(() => ({
      ...environment,
      SUPABASE_SECRET_KEY: 'synthetic-secret-storage-only',
    }));
    const r = await head(
      new Request(audience + '/api/internal/media-upload-url', {
        method: 'HEAD',
        headers: { 'x-emr-secret': secret },
      }),
    );
    expect(r.status).toBe(204);
    expect(await r.text()).toBe('');
    expect(
      (await head(new Request(audience + '/api/internal/media-upload-url', { method: 'HEAD' }))).status,
    ).toBe(401);
    expect(
      (
        await createMediaUploadReadinessHandler(() => environment)(
          new Request(audience + '/api/internal/media-upload-url', {
            method: 'HEAD',
            headers: { 'x-emr-secret': secret },
          }),
        )
      ).status,
    ).toBe(503);
  });
});
