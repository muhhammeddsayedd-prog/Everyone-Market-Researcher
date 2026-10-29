import assert from 'node:assert/strict';
import test from 'node:test';
import { projectUpkeepHealth } from './upkeep-health.mjs';

// Synthetic SQL-result contracts, not a live health read or email receipt.
const legacy = () => ({
  failing_accounts: [],
  stale_accounts: [],
  queues: { ai_extract: 0, embed: 0, media: 267 },
  items_new_yesterday: {},
  cost_yesterday: { total: 0, by_provider: {} },
  budget: { daily_budget_usd: 25, over_budget: false },
  month_to_date_usd: 0,
  forecast_month_usd: 0,
  workflow_errors_24h: {},
});
const current = () => ({ ...legacy(), zero_item_streaks: [], story_capture_gap: null, media_missing_24h: 1 });
test('maintained health projection consumes full M06 contract without claiming mail or story queue depth', () => {
  const projected = projectUpkeepHealth(current());
  assert.equal(projected.version, 'm06');
  assert.equal(projected.media_missing_24h, 1);
  assert.equal(projected.m06_signals_observed, true);
  assert.equal(projected.story_capture_gap, null);
  assert.equal(projected.story_queue_depth, null);
  assert.equal(projected.queue_depths.media, 267);
  assert.equal(projected.sent, false);
  assert.equal(projected.notification_mode, 'local_only');
});
test('absent legacy metrics remain unknown rather than silently filled with zero', () => {
  const p = projectUpkeepHealth(legacy());
  assert.equal(p.version, 'legacy');
  assert.equal(p.m06_signals_observed, false);
  for (const k of ['zero_item_streaks', 'story_capture_gap', 'media_missing_24h']) assert.equal(p[k], null);
});
test('real zero capture gap is distinct from missing observations', () => {
  assert.equal(projectUpkeepHealth({ ...current(), story_capture_gap: 0 }).story_capture_gap, 0);
  assert.equal(projectUpkeepHealth({ ...current(), story_capture_gap: 1 }).story_capture_gap, 1);
});
test('shared validator rejects partial upgrades, arbitrary diagnostics and invalid counts', () => {
  const partial = current();
  delete partial.media_missing_24h;
  for (const invalid of [
    partial,
    { ...current(), story_capture_gap: 2 },
    { ...current(), media_missing_24h: -1 },
    { ...current(), raw_error: 'synthetic-private-detail' },
  ]) {
    assert.throws(() => projectUpkeepHealth(invalid), /^Error: M06_UPKEEP_HEALTH_INVALID$/);
  }
});
