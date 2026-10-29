export function projectUpkeepHealth(value: unknown): {
  version: string;
  failing_accounts: number;
  stale_accounts: number;
  queue_depths: Record<string, number>;
  story_queue_depth: null;
  zero_item_streaks: number | null;
  story_capture_gap: number | null;
  media_missing_24h: number | null;
  m06_signals_observed: boolean;
  over_budget: boolean;
  notification_mode: string;
  sent: false;
};
