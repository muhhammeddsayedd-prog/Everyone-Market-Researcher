import { writeFile } from 'node:fs/promises';
import { SeedRuntimeError } from './config';

export const youtubeContinuationBudget = {
  youtubeMaximumAttempts: 1,
  maximumAccounts: 128,
  maximumAdditionalRequests: 129,
  priorYouTubeRequestCeiling: 284,
  cumulativeYouTubeRequestCeiling: 413,
  approvedYouTubeRequestCeiling: 516,
  priorAllProviderRequestCeiling: 1096,
  cumulativeAllProviderRequestCeiling: 1225,
  approvedAllProviderRequestCeiling: 1328,
  expectedIncrementalUsd: 0,
} as const;

/** This continuation can read YouTube only; the completed Vimeo batch is preserved. */
export function assertYouTubeContinuationScope(
  rows: readonly { platform: string; resolve_status: string }[],
) {
  const vimeo = rows.filter((row) => row.platform === 'vimeo');
  const youtube = rows.filter((row) => row.platform === 'youtube');
  if (
    vimeo.length !== 202 ||
    vimeo.some((row) => row.resolve_status !== 'resolved') ||
    youtube.length !== 128
  )
    throw new SeedRuntimeError('M02_YOUTUBE_CONTINUATION_SCOPE_REJECTED');
}

/** Retained after success/failure: another live attempt needs a new budget review. */
export async function admitYouTubeContinuation(path: string, sourceSha256: string) {
  try {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        sourceSha256,
        admittedAt: new Date().toISOString(),
        ...youtubeContinuationBudget,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  } catch {
    throw new SeedRuntimeError('M02_YOUTUBE_CONTINUATION_ADMISSION_FAILED');
  }
}
