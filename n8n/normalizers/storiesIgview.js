// igview output adapter. Singular-vs-array launch INPUT remains a live boundary.
const igviewStories =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./_stories.js')
    : storiesToolkit;
const igviewStoryShape = {
  actor: 'igview-owner/instagram-story-viewer',
  owner: 'username',
  ids: ['story_id'],
  times: ['taken_at', 'taken_at_date'],
  maxAccounts: 50,
  caption: (r) => r.caption,
  mentions: (r) => (Array.isArray(r.mentions) ? r.mentions : []),
  thumbnails: (r) => [r.image_thumbnail, r.image_url],
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
