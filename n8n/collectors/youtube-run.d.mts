import type { z } from 'zod';
import type { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';
import type { YoutubeAccount, YoutubeHttp, YoutubeAccountResult } from './youtube.mjs';
type Args<K extends keyof typeof m05Args> = z.infer<(typeof m05Args)[K]>;
type Port<K extends keyof typeof m05Args, R> = (args: Args<K>, requestId: string) => Promise<R>;
export interface YoutubeGateway {
  start: Port<'m05.start', { run_id: string }>;
  claim: Port<'m05.claim', YoutubeAccount[]>;
  quota: Port<'m05.quota', { quota_day: string; used_units: number; permitted: boolean }>;
  resolve: Port<'m05.resolve', unknown>;
  ingest: Port<'m05.ingest', { inserted: number; duplicates: number }>;
  report: Port<'m05.report', unknown>;
  cost: Port<'m05.cost', unknown>;
  finish: Port<'m05.finish', unknown>;
}
export function runYoutubeCollector(
  input: {
    env: 'dev';
    mode: 'daily' | 'backfill';
    limit: number;
    executionId: string;
    accountIds: string[];
    maxPages?: number;
    pageSize?: number;
  },
  deps: YoutubeHttp & { now: () => string; gateway: YoutubeGateway },
): Promise<{
  state: 'completed' | 'reconciliation_required';
  run_id: string | null;
  stage?: string;
  status?: 'success' | 'partial' | 'failed';
  items_new: number;
  api_requests: number;
  quota_units: number;
  quota_day: string;
  accounts: Array<{
    account_id: string;
    status: YoutubeAccountResult['status'];
    error: string | null;
    complete: boolean;
    backfill_done: boolean;
    cursor: YoutubeAccountResult['cursor'];
    unavailable_ids: string[];
    quota_units: number;
    fallback: YoutubeAccountResult['fallback'];
  }>;
}>;
