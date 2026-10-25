// M03-only exact-page adapter. Cloud Code2 does not expose a usable URL parser
// on the observed instance. This adapter adds no parser, dependency or fallback.
// Paste the shared helper declarations before this factory, then bind all three
// explicitly. The general canonicalWebsiteUrl contract remains separate.
function createM03SmokeWebsiteNormalizer(validateRow, buildSnapshot, invalidRow) {
  if (
    typeof validateRow !== 'function' ||
    typeof buildSnapshot !== 'function' ||
    typeof invalidRow !== 'function'
  ) {
    throw new Error('smoke_adapter_helpers_unavailable');
  }

  return function normalizeM03SmokeWebsite(row) {
    validateRow(row);
    const requestedUrl = 'https://everyone.film/about-everyone';
    if (row.url !== requestedUrl) return invalidRow();

    const associatedUrls = ['https://everyone.film', 'https://everyone.film/', requestedUrl];
    for (const associatedUrl of [row.crawl?.loadedUrl, row.crawl?.referrerUrl, row.metadata?.canonicalUrl]) {
      if (
        associatedUrl !== undefined &&
        associatedUrl !== null &&
        associatedUrl !== '' &&
        !associatedUrls.includes(associatedUrl)
      ) {
        return invalidRow();
      }
    }

    return buildSnapshot(row, requestedUrl);
  };
}

if (typeof module !== 'undefined') {
  // Local CommonJS adapter only. Cloud composition uses function declarations,
  // not this relative import, and requires only the already supported crypto.
  const {
    validateSmokeWebsiteRow,
    buildSmokeWebsiteSnapshot,
    invalidWebsiteRow,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require('./smoke_website_stub.js');
  module.exports = {
    createM03SmokeWebsiteNormalizer,
    normalizeM03SmokeWebsite: createM03SmokeWebsiteNormalizer(
      validateSmokeWebsiteRow,
      buildSmokeWebsiteSnapshot,
      invalidWebsiteRow,
    ),
  };
}
