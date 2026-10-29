// Qualified against retained public build0.0.10 output. The exact string media
// ID is authoritative; its numeric pk alias can already be lossy JSON data.
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
function louisExactStoryRows(rows) {
  let ignoredUnsafeAlias = false;
  if (!Array.isArray(rows) || rows.length > 10000) return { rows, ignoredUnsafeAlias };
  return {
    rows: rows.map((row) => {
      if (
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        typeof row.pk === 'number' &&
        !Number.isSafeInteger(row.pk) &&
        typeof row.id === 'string'
      ) {
        const exact = /^([1-9][0-9]{0,29})(?:_[1-9][0-9]{0,29})?$/.exec(row.id);
        if (exact && Number(exact[1]) === row.pk) {
          // Do not recover, stringify or persist the rounded number. Preserve the
          // original row, and let the existing ID parser validate its exact string.
          const copy = { ...row };
          delete copy.pk;
          ignoredUnsafeAlias = true;
          return copy;
        }
      }
      return row;
    }),
    ignoredUnsafeAlias,
  };
}
function normalizeStoriesLouisdeconinck(rows, ctx) {
  const input = louisExactStoryRows(rows);
  const result = louisStories.normalizeStoryRows(input.rows, ctx, louisStoryShape);
  if (input.ignoredUnsafeAlias) result.limitations = ['unsafe_numeric_pk_alias_ignored_for_exact_string_id'];
  return result;
}
function prepareStoriesLouisdeconinckResults(rows, ctx) {
  const input = louisExactStoryRows(rows);
  const result = louisStories.prepareStoryResults(input.rows, ctx, louisStoryShape);
  if (input.ignoredUnsafeAlias)
    result.limitations.push('unsafe_numeric_pk_alias_ignored_for_exact_string_id');
  return result;
}
if (typeof module !== 'undefined')
  module.exports = { normalizeStoriesLouisdeconinck, prepareStoriesLouisdeconinckResults };
