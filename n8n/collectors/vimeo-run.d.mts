import type { VimeoRequest } from './vimeo.mjs';
type Row = Record<string, unknown>;
type Call<I, O> = (input: I, requestId: string) => Promise<O>;
export interface VimeoGateway {
  start: Call<
    { workflow: 'WF-10'; platform: 'vimeo'; mode: 'daily' | 'backfill'; env: 'dev'; execution_id: string },
    { run_id: string }
  >;
  claim: Call<{ platform: 'vimeo'; limit: number; run_id: string; mode: 'daily' | 'backfill' }, Row[]>;
  resolve: Call<{ account_id: string; external_id: string | null; uploads_playlist_id: null }, void>;
  ingest: Call<
    { run_id: string; account_id: string; items: Row[] },
    { inserted: number; duplicates: number; metrics_updated?: number; new_item_ids?: string[] }
  >;
  report: Call<
    {
      run_id: string;
      account_id: string;
      status: 'success' | 'failed' | 'skipped';
      items_seen: number;
      items_new: number;
      error: string | null;
      backfill_done: boolean;
      backfill_cursor: Row | null;
    },
    void
  >;
  cost: Call<{ entries: Row[] }, void>;
  finish: Call<{ run_id: string; status: 'success' | 'partial' | 'failed'; error: string | null }, void>;
}
export function runVimeoCollector(
  input: unknown,
  deps: {
    gateway: VimeoGateway;
    request: (request: VimeoRequest) => Promise<unknown>;
    wait: (ms: number) => Promise<void>;
    now: () => string;
  },
): Promise<{
  state: 'completed' | 'reconciliation_required';
  run_id: string | null;
  status?: string;
  stage?: string;
  items_new: number;
  api_requests: number;
  accounts: Row[];
}>;
