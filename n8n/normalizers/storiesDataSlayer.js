// data-slayer adapter qualified against retained public build1.0.32 output.
const dataSlayerStories =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./_stories.js')
    : storiesToolkit;
const dataSlayerStoryShape = {
  actor: 'data-slayer/instagram-stories-scraper',
  owner: 'creator_username',
  summaryOwner: 'username',
  ids: ['id'],
  times: ['taken_at_ts', 'taken_at_date'],
  maxAccounts: 100,
  caption: (r) => r.caption_text,
  mentions: (r) => (Array.isArray(r.reel_mentions) ? r.reel_mentions : []),
  thumbnails: (r) => [
    r.thumbnail_url,
    ...(Array.isArray(r.image_versions) ? r.image_versions.map((x) => x?.url) : []),
    ...(Array.isArray(r.image_versions?.items) ? r.image_versions.items.map((x) => x?.url) : []),
  ],
  link: (r) => r.story_link_url,
  duration: (r) => r.video_duration,
};
function normalizeStoriesDataSlayer(rows, ctx) {
  return dataSlayerStories.normalizeStoryRows(rows, ctx, dataSlayerStoryShape);
}
function prepareStoriesDataSlayerResults(rows, ctx) {
  return dataSlayerStories.prepareStoryResults(rows, ctx, dataSlayerStoryShape);
}
if (typeof module !== 'undefined')
  module.exports = { normalizeStoriesDataSlayer, prepareStoriesDataSlayerResults };
