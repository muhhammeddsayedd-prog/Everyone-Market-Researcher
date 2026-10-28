import { describe, expect, it } from 'vitest';
import { gatewayBusinessResult } from './n8n-worker-contracts';

const legacy = () => ({
  failing_accounts: [],
  stale_accounts: [],
  queues: { ai_extract: 0, embed: 0, media: 2 },
  items_new_yesterday: {},
  cost_yesterday: { total: 0, by_provider: {} },
  budget: { daily_budget_usd: 25, over_budget: false },
  month_to_date_usd: 0,
  forecast_month_usd: 0,
  workflow_errors_24h: {},
});
const extended = () => ({
  ...legacy(),
  zero_item_streaks: [
    {
      account_id: '10000000-0000-4000-8000-000000000021',
      competitor: 'Synthetic company',
      platform: 'vimeo',
      handle: null,
      last_success_at: null,
    },
  ],
  story_capture_gap: null,
  media_missing_24h: 1,
});

describe('versioned M06 health results through the restricted gateway', () => {
  it('retains exact legacy results and complete new results', () => {
    expect(gatewayBusinessResult(legacy(), 'health.read')).toBe(true);
    expect(gatewayBusinessResult(extended(), 'health.read')).toBe(true);
    for (const gap of [0, 0.25, 1])
      expect(gatewayBusinessResult({ ...extended(), story_capture_gap: gap }, 'health.read')).toBe(true);
  });

  it.each(['zero_item_streaks', 'story_capture_gap', 'media_missing_24h'])(
    'rejects an incomplete M06 result missing %s',
    (key) => {
      const result: Record<string, unknown> = extended();
      delete result[key];
      expect(gatewayBusinessResult(result, 'health.read')).toBe(false);
    },
  );

  it.each([-1, 1.01, Infinity, NaN, '0', undefined])('rejects invalid gap %s', (gap) => {
    expect(gatewayBusinessResult({ ...extended(), story_capture_gap: gap }, 'health.read')).toBe(false);
  });

  it.each([-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '1'])(
    'rejects invalid missing-media count %s',
    (count) => {
      expect(gatewayBusinessResult({ ...extended(), media_missing_24h: count }, 'health.read')).toBe(false);
    },
  );

  it('rejects unknown fields and unbounded or malformed accounts', () => {
    expect(gatewayBusinessResult({ ...extended(), internal_token: 'synthetic' }, 'health.read')).toBe(false);
    expect(gatewayBusinessResult({ ...extended(), zero_item_streaks: [null] }, 'health.read')).toBe(false);
    expect(
      gatewayBusinessResult(
        { ...extended(), zero_item_streaks: Array(2001).fill(extended().zero_item_streaks[0]) },
        'health.read',
      ),
    ).toBe(false);
    const row = { ...extended().zero_item_streaks[0], last_success_at: 'not-a-date' };
    expect(gatewayBusinessResult({ ...extended(), zero_item_streaks: [row] }, 'health.read')).toBe(false);
  });

  it('checks real calendar dates rather than Date.parse normalization', () => {
    for (const value of ['2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '2026-01-01T24:00:00Z']) {
      const row = { ...extended().zero_item_streaks[0], last_success_at: value };
      expect(gatewayBusinessResult({ ...extended(), zero_item_streaks: [row] }, 'health.read')).toBe(false);
    }
    const row = { ...extended().zero_item_streaks[0], last_success_at: '2024-02-29T23:59:59+02:00' };
    expect(gatewayBusinessResult({ ...extended(), zero_item_streaks: [row] }, 'health.read')).toBe(true);
  });
});
