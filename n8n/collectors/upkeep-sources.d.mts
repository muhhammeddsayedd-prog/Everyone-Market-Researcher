export interface UpkeepSourceEntry {
  account_id: string;
  platform: string;
  external_id: string;
  published_at: string;
  metrics: Record<string, number>;
  observed_at: string;
}
export interface UpkeepSourceReceipt {
  account_id: string;
  platform: string;
  pass: string;
  requested_since: string;
  status: 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED_OUT';
  range_complete: boolean;
  source_exhausted: boolean;
  reached_since: boolean;
  hit_limit: boolean;
  next_cursor: string | null;
  pinned_included: boolean;
  entries: UpkeepSourceEntry[];
  observed_entries_validated: true;
  pages_observed: number;
  api_request_count?: number;
  reason: string | null;
  passes?: UpkeepSourceReceipt[];
}
export interface UpkeepSourceTarget {
  account_id: string;
  competitor_id: string;
  platform: 'vimeo' | 'youtube' | 'instagram' | 'linkedin';
  pass: string;
  since: string;
  metrics_since: string;
  known_external_ids: string[];
  url: string;
  handle: string;
  external_id?: string | null;
  uploads_playlist_id?: string | null;
  source_runs?: Record<string, { run_id: string; actor_id: string; build_id?: string | null }>;
  [key: string]: unknown;
}
export interface UpkeepSourcePorts {
  request?: (request: {
    source: 'vimeo' | 'youtube';
    method: 'GET';
    url: string;
    signal?: AbortSignal;
  }) => Promise<{
    status: number;
    body: unknown;
    headers?: Record<string, string>;
    redirected?: boolean;
    url?: string;
  }>;
  actorSnapshot?: (request: {
    actor: string;
    account_id: string;
    pass: string;
    since: string;
    run_id: string;
    actor_id: string;
    build_id?: string | null;
    signal?: AbortSignal;
  }) => Promise<unknown>;
}
export const UPKEEP_SOURCE_REFERENCES: Readonly<Record<string, string>>;
export function readUpkeepListing(
  target: UpkeepSourceTarget,
  ports: UpkeepSourcePorts,
  options: { now: string; maxPages?: number; maxItems?: number },
  signal?: AbortSignal,
): Promise<UpkeepSourceReceipt>;
