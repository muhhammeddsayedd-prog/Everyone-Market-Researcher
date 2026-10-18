/**
 * D-27 (owner decision, 18 Oct 2026): these seven reviewed YouTube sources are skipped and
 * retained as invalid/failed with their observed reasons. Only these exact identities are
 * exempt; any other invalid source still needs review.
 */
export const REVIEWED_YOUTUBE_EXCLUSIONS = ['C102', 'C142', 'C218', 'C231', 'C233', 'C245', 'C283'] as const;

export function isReviewedYouTubeExclusion(companyCode: string, platform: string, status: string): boolean {
  return (
    platform === 'youtube' &&
    status === 'invalid' &&
    (REVIEWED_YOUTUBE_EXCLUSIONS as readonly string[]).includes(companyCode)
  );
}
