export function runWebsiteCollector(
  input: unknown,
  deps: unknown,
): Promise<{
  state: 'awaiting_callbacks' | 'completed' | 'reconciliation_required';
  run_id: string | null;
  map_requests: number;
  actor_starts: number;
  stage?: string;
  status?: 'success' | 'partial' | 'failed';
  launches?: { launch_id: string; apify_run_id: string; account_id: string; cap_acknowledged: boolean }[];
  accounts: { account_id: string; status: string; error: string | null; items_new: number }[];
  coverage?: 'observed_map_only' | 'candidate_subset';
  coverage_records?: {
    account_id: string;
    candidate_urls: number;
    candidate_url_list: string[];
    pending_urls: number;
    selected_urls: number;
    deferred_urls: number;
    backfill_done: false;
    map_capped: boolean;
  }[];
  unclaimed_account_ids?: string[];
}>;
