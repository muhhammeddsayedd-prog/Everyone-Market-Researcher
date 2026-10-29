// Maintained M06 read-result integration. Reuse the actual shared validator;
// never weaken the historical WF-91 exact-shape/source guard or send an email.
import { gatewayBusinessResult } from '../../packages/shared/src/n8n-worker-contracts.ts';

export function projectUpkeepHealth(value) {
  if (!gatewayBusinessResult(value, 'health.read')) throw Error('M06_UPKEEP_HEALTH_INVALID');
  const extended = Object.hasOwn(value, 'zero_item_streaks');
  return {
    version: extended ? 'm06' : 'legacy',
    failing_accounts: value.failing_accounts.length,
    stale_accounts: value.stale_accounts.length,
    queue_depths: { ...value.queues },
    // Legacy queue totals do not observe the separate story queue. Do not label
    // generic media depth as complete story-media operational coverage.
    story_queue_depth: null,
    zero_item_streaks: extended ? value.zero_item_streaks.length : null,
    story_capture_gap: extended ? value.story_capture_gap : null,
    media_missing_24h: extended ? value.media_missing_24h : null,
    m06_signals_observed: extended,
    over_budget: value.budget.over_budget,
    notification_mode: 'local_only',
    sent: false,
  };
}
