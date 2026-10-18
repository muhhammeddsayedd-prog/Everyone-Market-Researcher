import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  admitYouTubeContinuation,
  assertYouTubeContinuationScope,
  youtubeContinuationBudget,
} from './youtube-continuation';

const vimeo = Array.from({ length: 202 }, () => ({ platform: 'vimeo', resolve_status: 'resolved' }));
const youtube = Array.from({ length: 128 }, () => ({ platform: 'youtube', resolve_status: 'pending' }));
describe('one bounded YouTube continuation', () => {
  it('preserves all completed Vimeo resolutions before allowing a YouTube continuation', () => {
    expect(() => assertYouTubeContinuationScope([...vimeo, ...youtube])).not.toThrow();
    expect(() => assertYouTubeContinuationScope([...vimeo.slice(1), ...youtube])).toThrow(
      'M02_YOUTUBE_CONTINUATION_SCOPE_REJECTED',
    );
    expect(() =>
      assertYouTubeContinuationScope([
        { platform: 'vimeo', resolve_status: 'pending' },
        ...vimeo.slice(1),
        ...youtube,
      ]),
    ).toThrow('M02_YOUTUBE_CONTINUATION_SCOPE_REJECTED');
    expect(() => assertYouTubeContinuationScope([...vimeo, ...youtube, ...youtube.slice(0, 1)])).toThrow(
      'M02_YOUTUBE_CONTINUATION_SCOPE_REJECTED',
    );
  });
  it('keeps the conservative combined ceilings inside the approved packet', () => {
    const policy = youtubeContinuationBudget;
    expect(policy.priorYouTubeRequestCeiling + policy.maximumAdditionalRequests).toBe(
      policy.cumulativeYouTubeRequestCeiling,
    );
    expect(policy.cumulativeYouTubeRequestCeiling).toBeLessThanOrEqual(policy.approvedYouTubeRequestCeiling);
    expect(policy.priorAllProviderRequestCeiling + policy.maximumAdditionalRequests).toBe(
      policy.cumulativeAllProviderRequestCeiling,
    );
    expect(policy.cumulativeAllProviderRequestCeiling).toBeLessThanOrEqual(
      policy.approvedAllProviderRequestCeiling,
    );
  });
  it('retains exclusive admission across subsequent attempts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-yt-admission-'));
    const path = join(directory, 'admission.json');
    try {
      await admitYouTubeContinuation(path, 'a'.repeat(64));
      await expect(admitYouTubeContinuation(path, 'a'.repeat(64))).rejects.toThrow(
        'M02_YOUTUBE_CONTINUATION_ADMISSION_FAILED',
      );
    } finally {
      await rm(path, { force: true });
      await rmdir(directory);
    }
  });
});
