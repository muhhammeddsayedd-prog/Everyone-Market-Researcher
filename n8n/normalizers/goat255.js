// Synthetic contracts cover this approved actor; no actor is started here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { vimeoHelpers: h } = require('./vimeoApi.js');
function normalizeGoat255Result(rawItems, ctx = {}) {
  const items = [],
    errors = [];
  for (const row of h.vimeoRows(rawItems)) {
    const matchKey = h.vimeoOwner(row?.ownerUrl);
    if (!h.vimeoRecord(row)) {
      errors.push({ error: 'vimeo_contract_drift', matchKey });
      continue;
    }
    if (row.error !== undefined) {
      errors.push({ error: 'vimeo_provider_error', matchKey });
      continue;
    }
    if (row.type !== 'video' || row.privacy !== 'anybody') continue;
    if (!matchKey) {
      errors.push({ error: 'vimeo_contract_drift', matchKey: '' });
      continue;
    }
    if (ctx.account?.handle && matchKey !== h.vimeoHandle(ctx.account.handle)) continue;
    const date = h.vimeoDate(
      typeof row.uploadDate === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.uploadDate)
        ? row.uploadDate.replace(' ', 'T') + 'Z'
        : row.uploadDate,
    );
    const item = h.vimeoItem(row, {
      id: String(row.id ?? ''),
      url: row.url,
      date,
      actor: 'goat255/vimeo-scraper',
      title: row.title,
      description: row.description,
      tags: Array.isArray(row.tags) ? row.tags : [],
      duration: row.duration,
      thumbnail: row.thumbnail,
      metrics: {},
      payload: h.vimeoPayload(row, [
        'type',
        'id',
        'url',
        'ownerName',
        'ownerUrl',
        'ownerId',
        'title',
        'description',
        'tags',
        'duration',
        'uploadDate',
        'privacy',
      ]),
    });
    if (!item) errors.push({ error: 'vimeo_contract_drift', matchKey });
    else if (h.vimeoInWindow(date, ctx)) items.push(item);
  }
  return { items, errors };
}
function normalizeGoat255(rawItems, ctx = {}) {
  return normalizeGoat255Result(rawItems, ctx).items;
}
if (typeof module !== 'undefined') module.exports = { normalizeGoat255, normalizeGoat255Result };
