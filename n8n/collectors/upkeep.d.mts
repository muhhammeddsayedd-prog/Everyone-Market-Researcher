export interface RemovalPlan {
  eligible: boolean;
  reason: string | null;
  metrics_external_ids: string[];
  mark_removed_args: null | { p_account_id: string; p_seen_external_ids: string[]; p_since: string };
}
export function evaluateRemovalListing(target: unknown, receipt: unknown): RemovalPlan;
export function planUpkeepWindow(
  platform: string,
  now: string,
  options?: { freeDays?: number; paidDays?: number },
): Record<string, unknown>;
export function planPaidRemovalBatches(accounts: unknown[], options: unknown): unknown[];
export function runRemovalAccount(
  target: unknown,
  receipt: unknown,
  deps: unknown,
  signal?: AbortSignal,
): Promise<unknown>;
