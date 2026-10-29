// igview output adapter. The pinned 29 October build exposes usernames[] input;
// output acceptance is qualified against retained build1.0.16 real output.
const igviewStories =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./_stories.js')
    : storiesToolkit;
const igviewStoryShape = {
  actor: 'igview-owner/instagram-story-viewer',
  owner: 'username',
  ids: ['storyId', 'story_id'],
  times: ['takenAt', 'takenAtISO', 'taken_at', 'taken_at_date'],
  maxAccounts: 50,
  caption: (r) => r.caption,
  isEmpty: (r) =>
    r.success === true &&
    r.mediaType === 'none' &&
    r.storiesCount === 0 &&
    r.takenAtFormatted === 'No active stories',
  mentions: (r) => [
    ...(Array.isArray(r.mentions) ? r.mentions : []),
    ...(Array.isArray(r.storyBloksStickers) ? r.storyBloksStickers.map((v) => v?.mentionUsername) : []),
  ],
  thumbnails: (r) => [
    r.imageUrl,
    r.image_thumbnail,
    r.image_url,
    ...(Array.isArray(r.allImages) ? r.allImages.map((v) => v?.url) : []),
  ],
  link: (r) => r.story_link_url,
  duration: (r) => r.video_duration,
};
function normalizeStoriesIgview(rows, ctx) {
  return igviewStories.normalizeStoryRows(rows, ctx, igviewStoryShape);
}
function prepareStoriesIgviewResults(rows, ctx) {
  return igviewStories.prepareStoryResults(rows, ctx, igviewStoryShape);
}
if (typeof module !== 'undefined') module.exports = { normalizeStoriesIgview, prepareStoriesIgviewResults };
