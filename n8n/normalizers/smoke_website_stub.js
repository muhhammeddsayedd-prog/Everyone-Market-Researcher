// M03 local smoke contract, not a captured actor receipt. No network or SDK use.
// Paste these functions into a Code node, then map normalizeSmokeWebsite over
// the verified callback dataset. Verify URL/crypto support in the actual runtime.
function invalidWebsiteRow() {
  throw new Error('contract_drift: invalid website crawler row');
}

function smokeBoundedText(input, limit) {
  const bounded = input.slice(0, limit);
  // Avoid producing invalid JSON Unicode when a truncation cuts an emoji pair.
  const last = bounded.charCodeAt(bounded.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? bounded.slice(0, -1) : bounded;
}

// Shared with prepare_ingest_groups.js. Paste this function before that Code
// node's source; local CommonJS tests import this same definition.
function hasSensitiveUrlQuery(url) {
  const credentialKeys = [
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'apikey',
    'clientsecret',
    'clientpassword',
    'accesskey',
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'auth',
    'authorization',
    'credential',
    'credentials',
    'signature',
    'sig',
    'key',
    'xgoogapikey',
    'xamzcredential',
    'xamzsignature',
    'xamzsecuritytoken',
  ];
  for (const rawKey of url.searchParams.keys()) {
    let key = rawKey;
    // URLSearchParams already decodes once. Permit at most two further levels,
    // then reject residual encoding rather than decode recursively forever.
    for (let pass = 0; pass < 2 && key.includes('%'); pass += 1) {
      try {
        key = decodeURIComponent(key);
      } catch {
        return true;
      }
    }
    if (key.includes('%') || credentialKeys.includes(key.toLowerCase().replace(/[-_]/g, ''))) return true;
  }
  return false;
}

function canonicalWebsiteUrl(input) {
  if (
    typeof input !== 'string' ||
    !input ||
    input.length > 8192 ||
    !/^https?:\/\/[^/?#]/i.test(input) ||
    /^https?:\/\/[^/?#]*@/i.test(input) ||
    /[\s\u0000-\u001f\u007f\\]/u.test(input)
  ) {
    return invalidWebsiteRow();
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    return invalidWebsiteRow();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    return invalidWebsiteRow();
  }
  // Reject obvious credential parameters before building the public snapshot.
  if (hasSensitiveUrlQuery(url)) return invalidWebsiteRow();
  const labels = url.hostname.split('.');
  const suffix = labels[labels.length - 1];
  // Lexical only: a request-making node must separately enforce public DNS and
  // redirects. Normalization itself never resolves or fetches the URL.
  const privateSuffixes = [
    'arpa',
    'example',
    'home',
    'internal',
    'invalid',
    'lan',
    'local',
    'localdomain',
    'localhost',
    'onion',
    'test',
  ];
  if (
    labels.length < 2 ||
    /^[\d.]+$/.test(url.hostname) ||
    privateSuffixes.includes(suffix) ||
    !/^[a-z][a-z\d-]*$/i.test(suffix) ||
    labels.some((label) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  ) {
    return invalidWebsiteRow();
  }
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  return url.href;
}

function normalizeSmokeWebsite(row) {
  if (
    !row ||
    typeof row !== 'object' ||
    Array.isArray(row) ||
    row.error !== undefined ||
    (row.markdown !== undefined && row.markdown !== null && typeof row.markdown !== 'string') ||
    (row.metadata !== undefined &&
      row.metadata !== null &&
      (typeof row.metadata !== 'object' || Array.isArray(row.metadata))) ||
    (row.metadata?.title !== undefined &&
      row.metadata?.title !== null &&
      typeof row.metadata.title !== 'string')
  ) {
    return invalidWebsiteRow();
  }
  // Identity follows the requested dataset URL, never a page-controlled
  // metadata.canonicalUrl pointing at another page or origin. Path case stays.
  const url = canonicalWebsiteUrl(row.url);
  for (const retainedUrl of [row.crawl?.loadedUrl, row.crawl?.referrerUrl, row.metadata?.canonicalUrl]) {
    if (retainedUrl !== undefined && retainedUrl !== null && retainedUrl !== '')
      canonicalWebsiteUrl(retainedUrl);
  }
  const title = row.metadata?.title ? smokeBoundedText(row.metadata.title, 2000) : null;
  const caption = smokeBoundedText(row.markdown || '', 8000);
  let hash;
  try {
    if (typeof require !== 'function') throw new Error('unavailable');
    // n8n Cloud exposes crypto via require inside its plain JavaScript Code node.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hash = require('crypto').createHash('sha256').update(url, 'utf8').digest('hex');
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('unavailable');
  } catch {
    throw new Error('sha256_unavailable');
  }
  return {
    json: {
      platform: 'website_work_page',
      external_id: hash.slice(0, 32),
      actor: 'apify/website-content-crawler',
      item_type: 'project_page',
      url,
      published_at: null,
      title,
      caption,
      metrics: {},
      // M03-only public snapshot: unknown actor request/header/cookie fields
      // never enter the ingest payload. Real capture evidence stays separate.
      payload: { url, markdown: caption, metadata: { title } },
    },
    matchKey: url,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { canonicalWebsiteUrl, hasSensitiveUrlQuery, normalizeSmokeWebsite };
}
