// Raw IG media projection described by checked-in research; real capture pending.
const louisStories =
  typeof module !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./_stories.js')
    : storiesToolkit;
const louisStoryShape = {
  actor: 'louisdeconinck/instagram-story-details-scraper',
  owner: 'user',
  ids: ['pk', 'id'],
  times: ['taken_at', 'taken_at_date'],
  maxAccounts: 100,
  caption: (r) => (typeof r.caption === 'string' ? r.caption : r.caption?.text),
  mentions: (r) => (Array.isArray(r.reel_mentions) ? r.reel_mentions : []),
  thumbnails: (r) =>
    (Array.isArray(r.image_versions2?.candidates) ? r.image_versions2.candidates : []).map((x) => x?.url),
  link: (r) => r.story_link_url,
  duration: (r) => r.video_duration,
};
function normalizeStoriesLouisdeconinck(rows, ctx) {
  return louisStories.normalizeStoryRows(rows, ctx, louisStoryShape);
}
function prepareStoriesLouisdeconinckResults(rows, ctx) {
  return louisStories.prepareStoryResults(rows, ctx, louisStoryShape);
}
if (typeof module !== 'undefined')
  module.exports = { normalizeStoriesLouisdeconinck, prepareStoriesLouisdeconinckResults };
