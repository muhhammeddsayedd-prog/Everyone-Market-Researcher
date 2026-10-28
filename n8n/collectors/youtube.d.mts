import type { z } from 'zod';
import type { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';
export type YoutubeItem = z.infer<(typeof m05Args)['m05.ingest']>['items'][number];
export interface YoutubeAccount {
  account_id: string;
  competitor_id: string;
  url: string;
  handle?: string;
  external_id?: string | null;
  uploads_playlist_id?: string | null;
  backfill_from?: string;
  backfill_cursor?: unknown;
  watermark_published_at?: string | null;
  watermark_external_id?: string | null;
  last_item_published_at?: string | null;
  last_external_id?: string | null;
}
export interface YoutubeCursor {
  channel_id: string;
  playlist_id: string;
  page_token: string;
  page_size: number;
}
export interface YoutubeConfig {
  mode: 'daily' | 'backfill';
  now: string;
  quotaRemaining: number;
  maxPages?: number;
  pageSize?: number;
}
export interface YoutubeHttp {
  request(input: { method: 'GET'; url: string }): Promise<{ status: number; body: unknown }>;
}
export interface YoutubeAccountResult {
  status: 'success' | 'partial' | 'failed';
  error: string | null;
  normalizedItems: YoutubeItem[];
  apiRequestCount: number;
  quotaUnits: number;
  quotaUnitsConservative: true;
  complete: boolean;
  backfillDone: boolean;
  cursor: YoutubeCursor | null;
  resolvedExternalId: string | null;
  resolvedUploadsPlaylistId: string | null;
  unavailableIds: string[];
  fallback: { actor: 'streamers/youtube-scraper'; blocked: true; reason: string };
}
export function youtubeQuotaDay(now: string): string;
export function youtubeEndpoint(account: YoutubeAccount): {
  channelId: string | null;
  playlistId: string | null;
  resolve: { id: string } | { forHandle: string } | { forUsername: string } | null;
};
export function planYoutubeFallback(): YoutubeAccountResult['fallback'];
export function collectYoutubeAccount(
  account: YoutubeAccount,
  config: YoutubeConfig,
  deps: YoutubeHttp & { reserveQuota?: () => Promise<boolean> },
): Promise<YoutubeAccountResult>;
