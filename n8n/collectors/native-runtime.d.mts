export interface NativeCollectorRequest {
  version: 1;
  requestId: string;
  operation: string;
  args: Record<string, unknown>;
}
export interface NativeCollectorAccount {
  account_id: string;
  competitor_id: string;
  handle: string;
  url: string;
  external_id?: string | null;
  [key: string]: unknown;
}
export interface NativeActorBatch {
  actor: string;
  result_type: 'posts' | 'reels' | 'primary';
  account_ids: string[];
  input: Record<string, unknown>;
  resultsLimit?: number;
}
export interface NativeCollectorState {
  kind: 'vimeo' | 'instagram';
  action: 'gateway' | 'vimeo' | 'apify' | 'wait' | 'done';
  executionId: string;
  now: string;
  mode: 'daily' | 'backfill';
  limit: number;
  maxPages: number;
  pageSize: number;
  resultsLimit: number;
  maxActorStarts: number;
  sequence: number;
  request: NativeCollectorRequest;
  runId?: string;
  accounts: NativeCollectorAccount[];
  accountIndex: number;
  actorStarts: number;
  batches?: NativeActorBatch[];
  batchIndex?: number;
  providerUrl?: string;
  waitSeconds?: number;
  summary?: unknown;
  [key: string]: unknown;
}
export type InstagramBatchPlanner = (
  accounts: NativeCollectorAccount[],
  options: { mode: 'daily' | 'backfill'; result_type: 'posts' | 'reels'; now?: string },
) => NativeActorBatch[];
export type VimeoPageNormalizer = (
  rows: unknown[],
  context: Record<string, unknown>,
) => { items: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>> };
export function collectorRequestId(executionId: string, sequence: number): string;
export function collectorGateway(
  state: NativeCollectorState,
  operation: string,
  args: Record<string, unknown>,
): NativeCollectorState;
export function initializeCollector(
  input: unknown,
  kind: 'vimeo' | 'instagram',
  executionId: string,
  now: string,
): NativeCollectorState;
export function collectorReceipt(
  state: NativeCollectorState,
  response: unknown,
): { replayed: boolean; result: unknown };
export function advanceCollectorGateway(
  state: NativeCollectorState,
  response: unknown,
  planInstagram: InstagramBatchPlanner,
): NativeCollectorState;
export function advanceVimeoNative(
  state: NativeCollectorState,
  response: unknown,
  normalize: VimeoPageNormalizer,
): NativeCollectorState;
export function advanceInstagramNative(state: NativeCollectorState, response: unknown): NativeCollectorState;
export function vimeoNativeAccount(state: NativeCollectorState): NativeCollectorState;
export function vimeoNativeCursorValid(current: Record<string, unknown>, mode: string): boolean;
export function vimeoNativeRequest(state: NativeCollectorState): NativeCollectorState;
export function vimeoNativeReport(state: NativeCollectorState): NativeCollectorState;
export function vimeoNativeFallback(state: NativeCollectorState, reason: string): NativeCollectorState;
export function nextInstagramLaunch(state: NativeCollectorState): NativeCollectorState;
