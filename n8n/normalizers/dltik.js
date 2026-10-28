// Metadata-only output. Never copy download_* fields, private credentials or formats.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { vimeoHelpers: h } = require('./vimeoApi.js');
function normalizeDltikResult(rawItems, ctx = {}) {
  const items = [],
    errors = [];
  for (const row of h.vimeoRows(rawItems)) {
    const matchKey = h.vimeoOwner(row?.uploader_url);
    if (!h.vimeoRecord(row)) {
      errors.push({ error: 'vimeo_contract_drift', matchKey });
      continue;
    }
    if (row.error !== undefined) {
      errors.push({ error: 'vimeo_provider_error', matchKey });
      continue;
    }
    if (row.privacy !== 'public') continue;
    if (!matchKey) {
      errors.push({ error: 'vimeo_contract_drift', matchKey: '' });
      continue;
    }
    if (ctx.account?.handle && matchKey !== h.vimeoHandle(ctx.account.handle)) continue;
    const date = h.vimeoDate(
      typeof row.upload_date === 'string' && /^\d{8}$/.test(row.upload_date)
        ? `${row.upload_date.slice(0, 4)}-${row.upload_date.slice(4, 6)}-${row.upload_date.slice(6, 8)}T00:00:00Z`
        : null,
    );
    const item = h.vimeoItem(row, {
      id: String(row.id ?? ''),
      url: row.url,
      date,
      actor: 'dltik/vimeo-scraper',
      title: row.title,
      description: row.description,
      tags: Array.isArray(row.tags) ? row.tags : [],
      duration: row.duration,
      thumbnail: row.thumbnail,
      metrics: { views: h.vimeoCount(row.view_count), likes: h.vimeoCount(row.like_count) },
      payload: h.vimeoPayload(row, [
        'id',
        'url',
        'title',
        'duration',
        'view_count',
        'like_count',
        'uploader',
        'uploader_url',
        'upload_date',
        'privacy',
        'description',
        'tags',
      ]),
    });
    if (!item) errors.push({ error: 'vimeo_contract_drift', matchKey });
    else if (h.vimeoInWindow(date, ctx)) items.push(item);
  }
  return { items, errors };
}
function normalizeDltik(rawItems, ctx = {}) {
  return normalizeDltikResult(rawItems, ctx).items;
}
if (typeof module !== 'undefined') module.exports = { normalizeDltik, normalizeDltikResult };
