// Canonical helpers from docs/N8N_WORKFLOWS.md §7. Keep plain JavaScript for n8n.
const lc = (s) => (s || '').toString().trim().toLowerCase();
const noAt = (s) => lc(s).replace(/^@+/, '');
const iso = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d) ? null : d.toISOString();
};
const tags = (text) => [
  ...new Set(((text || '').match(/#([\p{L}\p{N}_]+)/gu) || []).map((t) => lc(t.slice(1)))),
];
const ats = (text) => [...new Set(((text || '').match(/@([A-Za-z0-9._]+)/g) || []).map((t) => noAt(t)))];
const int = (v) =>
  v === null || v === undefined || v === '' || Number(v) < 0 ? null : Math.round(Number(v));
const isoDur = (s) => {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || '');
  if (!m) return null;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
};
const hms = (s) => {
  if (!s) return null;
  const p = s.split(':').map(Number);
  return p.reduce((a, n) => a * 60 + n, 0);
};
const trim8k = (s) => (s || '').slice(0, 8000);

if (typeof module !== 'undefined') {
  module.exports = { lc, noAt, iso, tags, ats, int, isoDur, hms, trim8k };
}
