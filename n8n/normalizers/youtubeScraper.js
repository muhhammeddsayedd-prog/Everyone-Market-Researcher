// Pure local contract for the approved actor. No capture/launch is enabled.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- This directory is deliberately CommonJS; reuse the pure API adapter without a package or runtime I/O.
const youtubeApiAdapter = typeof require === 'function' ? require('./youtubeApi.js') : null;
function normalizeYoutubeScraperResult(rows, ctx = {}) {
  if (!youtubeApiAdapter || !Array.isArray(rows) || rows.length > 10000)
    throw Error('youtube_invalid_context');
  const { youtubeHelpers: h, normalizeYoutubeApiResult } = youtubeApiAdapter;
  const items = [],
    errors = [],
    skipped = [];
  for (const row of rows) {
    if (!h.youtubeRecord(row) || row.error !== undefined) {
      errors.push({ error: 'youtube_actor_error', matchKey: ctx.account?.external_id ?? '' });
      continue;
    }
    if (row.isPrivate === true || (row.privacyStatus !== undefined && row.privacyStatus !== 'public')) {
      skipped.push({ id: row.id, reason: 'youtube_non_public' });
      continue;
    }
    if (
      !h.youtubeVideoId(row.id) ||
      row.channelId !== ctx.account?.external_id ||
      !['video', 'shorts'].includes(row.type) ||
      ![
        'https://www.youtube.com/watch?v=' + row.id,
        'https://www.youtube.com/shorts/' + row.id,
        'https://youtu.be/' + row.id,
      ].includes(row.url)
    ) {
      errors.push({ error: 'youtube_owner_or_identity_mismatch', matchKey: ctx.account?.external_id ?? '' });
      continue;
    }
    let duration = null;
    if (typeof row.duration === 'string' && /^\d{1,3}:\d{2}:\d{2}$/.test(row.duration)) {
      const [hh, mm, ss] = row.duration.split(':').map(Number);
      if (mm < 60 && ss < 60) duration = hh * 3600 + mm * 60 + ss;
    }
    const normalized = normalizeYoutubeApiResult(
      [
        {
          id: row.id,
          snippet: {
            channelId: row.channelId,
            publishedAt: row.date,
            title: row.title,
            description: row.text,
            tags: row.hashtags,
            thumbnails: { high: { url: row.thumbnailUrl } },
          },
          contentDetails: { duration: duration === null ? null : `PT${duration}S` },
          statistics: { viewCount: row.viewCount, likeCount: row.likes, commentCount: row.commentsCount },
          status: { privacyStatus: 'public' },
        },
      ],
      ctx,
    );
    for (const item of normalized.items) {
      item.actor = 'streamers/youtube-scraper';
      item.item_type = row.type === 'shorts' ? 'reel' : 'video';
      item.payload.shorts_classification = 'actor_type';
      items.push(item);
    }
    errors.push(...normalized.errors);
    skipped.push(...normalized.skipped);
  }
  return { items, errors, skipped };
}
if (typeof module !== 'undefined') module.exports = { normalizeYoutubeScraperResult };
