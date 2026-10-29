// Source-derived WF-40 listing evidence. Transport/authentication belongs to the
// existing server-only adapters. No caller-supplied `complete` value is read.
import vimeo from '../normalizers/vimeoApi.js';
import youtube from '../normalizers/youtubeApi.js';
import instagram from '../normalizers/instagramScraper.js';
import linkedin from '../normalizers/linkedinPosts.js';
import { vimeoEndpoint, VIMEO_FIELDS } from './vimeo.mjs';
import { youtubeEndpoint } from './youtube.mjs';

export const UPKEEP_SOURCE_REFERENCES = Object.freeze({
  vimeo: 'https://developer.vimeo.com/api/reference/videos',
  youtube: 'https://developers.google.com/youtube/v3/docs/playlistItems/list',
  youtubeVideos: 'https://developers.google.com/youtube/v3/docs/videos/list',
  instagram: 'https://apify.com/apify/instagram-scraper/input-schema',
  linkedin: 'https://apify.com/harvestapi/linkedin-company-posts/input-schema',
  paidLimitation:
    'The approved dated/capped actor outputs do not document authoritative source exhaustion. Dataset EOF and fewer rows than the result cap do not prove source EOF.',
});

const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uuid = (v) =>
  typeof v === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const external = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(v);
const token = (v) =>
  typeof v === 'string' && v.length > 0 && v.length <= 2048 && !/[\s\\\x00-\x1f\x7f]/u.test(v);
const iso = instagram.instagramDate;
const fail = (code) => {
  throw Error(code);
};
const allowedErrors =
  /^M06_UPKEEP_(?:CANCELLED|SOURCE_[A-Z_]+|PAGINATION_[A-Z_]+|OWNER_MISMATCH|OUTPUT_LIMIT|PAID_[A-Z_]+)$/;
const sanitizeError = (e) => (allowedErrors.test(e?.message ?? '') ? e.message : 'M06_UPKEEP_SOURCE_FAILED');
const checkAbort = (signal) => {
  if (signal?.aborted) fail('M06_UPKEEP_CANCELLED');
};

function context(target, options) {
  if (
    !record(target) ||
    !uuid(target.account_id) ||
    !uuid(target.competitor_id) ||
    !['vimeo', 'youtube', 'instagram', 'linkedin'].includes(target.platform) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(target.since ?? '') ||
    !iso(target.since + 'T00:00:00Z') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(target.metrics_since ?? '') ||
    !iso(target.metrics_since + 'T00:00:00Z') ||
    target.metrics_since < target.since ||
    !record(options) ||
    !iso(options.now) ||
    Date.parse(target.metrics_since + 'T00:00:00Z') > Date.parse(options.now)
  )
    fail('M06_UPKEEP_SOURCE_CONTEXT_INVALID');
  const maxPages = options.maxPages ?? 10,
    maxItems = options.maxItems ?? 5000;
  if (
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 50 ||
    !Number.isSafeInteger(maxItems) ||
    maxItems < 1 ||
    maxItems > 10000
  )
    fail('M06_UPKEEP_SOURCE_CONTEXT_INVALID');
  const allowedPasses = {
    vimeo: ['videos'],
    youtube: ['videos'],
    instagram: ['posts_and_reels'],
    linkedin: ['posts'],
  };
  if (!allowedPasses[target.platform].includes(target.pass)) fail('M06_UPKEEP_SOURCE_CONTEXT_INVALID');
  return { maxPages, maxItems, now: iso(options.now), cutoff: target.since + 'T00:00:00.000Z' };
}

function base(target) {
  return {
    account_id: target.account_id,
    platform: target.platform,
    pass: target.pass ?? (['vimeo', 'youtube'].includes(target.platform) ? 'videos' : 'posts'),
    requested_since: target.since,
    status: 'SUCCEEDED',
    range_complete: false,
    source_exhausted: false,
    reached_since: false,
    hit_limit: false,
    next_cursor: null,
    pinned_included: target.platform !== 'instagram',
    entries: [],
    observed_entries_validated: true,
    pages_observed: 0,
    reason: null,
  };
}

function addEntries(receipt, items, target, observedAt, maxItems, now) {
  const seen = new Map(receipt.entries.map((r) => [r.external_id, r]));
  for (const item of items) {
    if (
      item.platform !== target.platform ||
      !external(item.external_id) ||
      !iso(item.published_at) ||
      Date.parse(item.published_at) > Date.parse(now) ||
      !record(item.metrics)
    )
      fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
    const metrics = Object.fromEntries(Object.entries(item.metrics).filter(([, v]) => v !== null));
    if (
      Object.entries(metrics).some(
        ([k, v]) => !/^[a-z][a-z0-9_]{0,49}$/.test(k) || !Number.isSafeInteger(v) || v < 0,
      )
    )
      fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
    const row = {
      account_id: target.account_id,
      platform: target.platform,
      external_id: item.external_id,
      published_at: iso(item.published_at),
      metrics,
      observed_at: observedAt,
    };
    const prior = seen.get(row.external_id);
    if (prior && prior.published_at !== row.published_at) fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
    seen.set(row.external_id, row);
  }
  if (seen.size > maxItems) fail('M06_UPKEEP_OUTPUT_LIMIT');
  receipt.entries = [...seen.values()];
}

async function request(ports, source, url, signal, receipt) {
  checkAbort(signal);
  const u = new URL(url),
    origin = source === 'vimeo' ? 'https://api.vimeo.com' : 'https://www.googleapis.com';
  if (u.origin !== origin || u.username || u.password || u.hash) fail('M06_UPKEEP_SOURCE_URL_INVALID');
  let response;
  try {
    receipt.api_request_count++;
    response = await ports.request({ source, method: 'GET', url: u.href, signal });
  } catch {
    checkAbort(signal);
    fail('M06_UPKEEP_SOURCE_TRANSPORT_FAILED');
  }
  checkAbort(signal);
  // A redirect is never accepted as another authenticated source response.
  if (
    !record(response) ||
    response.status !== 200 ||
    response.redirected === true ||
    (response.url !== undefined && response.url !== u.href) ||
    !record(response.body)
  )
    fail('M06_UPKEEP_SOURCE_HTTP_FAILED');
  return response.body;
}

function vimeoNext(value, endpoint, current) {
  if (value === null) return null;
  if (!token(value)) fail('M06_UPKEEP_PAGINATION_INVALID');
  const u = new URL(value, 'https://api.vimeo.com');
  if (
    u.origin !== 'https://api.vimeo.com' ||
    u.pathname !== endpoint + '/videos' ||
    u.username ||
    u.password ||
    u.hash ||
    [...u.searchParams.keys()].some(
      (k) =>
        !['page', 'per_page', 'sort', 'direction', 'fields'].includes(k) ||
        u.searchParams.getAll(k).length !== 1,
    ) ||
    Number(u.searchParams.get('page')) !== current + 1 ||
    (u.searchParams.has('per_page') && u.searchParams.get('per_page') !== '100') ||
    (u.searchParams.has('sort') && u.searchParams.get('sort') !== 'date') ||
    (u.searchParams.has('direction') && u.searchParams.get('direction') !== 'desc')
  )
    fail('M06_UPKEEP_PAGINATION_INVALID');
  return u.href;
}

async function readVimeo(target, ports, settings, signal) {
  const receipt = base(target),
    endpoint = vimeoEndpoint(target);
  receipt.api_request_count = 0;
  if (!endpoint.resourcePath || endpoint.resolvePath) fail('M06_UPKEEP_SOURCE_IDENTITY_UNRESOLVED');
  let pageNumber = 1;
  const idsSeen = new Set();
  const urlFor = (n) =>
    'https://api.vimeo.com' +
    endpoint.resourcePath +
    '/videos?' +
    new URLSearchParams({
      sort: 'date',
      direction: 'desc',
      per_page: '100',
      page: String(n),
      fields: VIMEO_FIELDS + ',user.uri',
    });
  try {
    while (receipt.pages_observed < settings.maxPages) {
      const body = await request(ports, 'vimeo', urlFor(pageNumber), signal, receipt);
      if (
        !Array.isArray(body.data) ||
        body.data.length > 100 ||
        !record(body.paging) ||
        !Object.hasOwn(body.paging, 'next') ||
        (body.page !== undefined && body.page !== pageNumber) ||
        (body.per_page !== undefined && body.per_page !== 100)
      )
        fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
      const dates = body.data.map((r) => iso(r?.release_time ?? r?.created_time));
      if (dates.some((d) => !d)) fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
      const pageIds = new Set();
      for (let n = 0; n < dates.length; n++) {
        const identity = /^\/videos\/(\d+)$/.exec(body.data[n]?.uri ?? '')?.[1];
        if (!identity) fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
        if (idsSeen.has(identity) || pageIds.has(identity)) fail('M06_UPKEEP_PAGINATION_REPEATED_ID');
        pageIds.add(identity);
        if (
          endpoint.kind === 'users' &&
          body.data[n].user?.uri !== undefined &&
          body.data[n].user.uri !== endpoint.resourcePath
        )
          fail('M06_UPKEEP_OWNER_MISMATCH');
      }
      const normalized = vimeo.normalizeVimeoApiResult(body.data, {
        account: target,
        cutoff: settings.cutoff,
      });
      if (normalized.errors.length) fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
      const next = vimeoNext(body.paging.next, endpoint.resourcePath, pageNumber);
      if (next !== null && !body.data.length) fail('M06_UPKEEP_PAGINATION_EMPTY_NONTERMINAL');
      addEntries(receipt, normalized.items, target, settings.now, settings.maxItems, settings.now);
      for (const identity of pageIds) idsSeen.add(identity);
      receipt.pages_observed++;
      receipt.next_cursor = next;
      receipt.source_exhausted = next === null;
      // `sort=date` has endpoint-specific semantics; release_time is not a
      // proof that later pages are older. Date crossing is diagnostic only.
      receipt.reached_since ||= dates.some((date) => Date.parse(date) < Date.parse(settings.cutoff));
      if (receipt.source_exhausted) {
        receipt.range_complete = true;
        return receipt;
      }
      pageNumber++;
    }
    receipt.hit_limit = true;
    receipt.reason = 'page_limit';
  } catch (e) {
    receipt.status = 'FAILED';
    receipt.reason = sanitizeError(e);
  }
  return receipt;
}

function youtubeUrl(resource, parameters) {
  return 'https://www.googleapis.com/youtube/v3/' + resource + '?' + new URLSearchParams(parameters);
}

async function readYoutube(target, ports, settings, signal) {
  const receipt = base(target),
    endpoint = youtubeEndpoint(target);
  receipt.api_request_count = 0;
  // Identity and uploads playlist were resolved in M02/M05. Upkeep does not
  // silently replace these stored identities or spend search API quota.
  if (endpoint.resolve || !endpoint.channelId || !endpoint.playlistId)
    fail('M06_UPKEEP_SOURCE_IDENTITY_UNRESOLVED');
  const pageTokens = new Set(),
    idsSeen = new Set();
  let cursor = null;
  try {
    while (receipt.pages_observed < settings.maxPages) {
      const body = await request(
        ports,
        'youtube',
        youtubeUrl('playlistItems', {
          part: 'snippet,contentDetails,status',
          playlistId: endpoint.playlistId,
          maxResults: '50',
          ...(cursor ? { pageToken: cursor } : {}),
        }),
        signal,
        receipt,
      );
      if (
        !Array.isArray(body.items) ||
        body.items.length > 50 ||
        (body.nextPageToken !== undefined && !token(body.nextPageToken))
      )
        fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
      const ids = [];
      for (const row of body.items) {
        const id = row?.contentDetails?.videoId;
        if (
          !youtube.youtubeHelpers.youtubeVideoId(id) ||
          row.snippet?.videoOwnerChannelId !== endpoint.channelId
        )
          fail('M06_UPKEEP_OWNER_MISMATCH');
        if (idsSeen.has(id) || ids.includes(id)) fail('M06_UPKEEP_PAGINATION_REPEATED_ID');
        ids.push(id);
      }
      if (!ids.length && body.nextPageToken) fail('M06_UPKEEP_PAGINATION_EMPTY_NONTERMINAL');
      let unavailable = false;
      if (ids.length) {
        const details = await request(
          ports,
          'youtube',
          youtubeUrl('videos', {
            part: 'snippet,statistics,contentDetails,status',
            id: ids.join(','),
          }),
          signal,
          receipt,
        );
        if (
          !Array.isArray(details.items) ||
          details.items.length > ids.length ||
          details.items.some((r) => !ids.includes(r?.id)) ||
          new Set(details.items.map((r) => r.id)).size !== details.items.length
        )
          fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
        const normalized = youtube.normalizeYoutubeApiResult(details.items, {
          account: target,
          cutoff: settings.cutoff,
        });
        if (normalized.errors.length) fail('M06_UPKEEP_SOURCE_CONTRACT_DRIFT');
        unavailable = normalized.skipped.length > 0 || details.items.length !== ids.length;
        addEntries(receipt, normalized.items, target, settings.now, settings.maxItems, settings.now);
      }
      ids.forEach((id) => idsSeen.add(id));
      receipt.pages_observed++;
      const next = body.nextPageToken ?? null;
      if (next && pageTokens.has(next)) fail('M06_UPKEEP_PAGINATION_CYCLE');
      if (next) pageTokens.add(next);
      cursor = next;
      receipt.next_cursor = next;
      if (unavailable) {
        receipt.reason = 'unavailable_video';
        return receipt;
      }
      if (next === null) {
        receipt.source_exhausted = true;
        receipt.range_complete = true;
        return receipt;
      }
    }
    receipt.hit_limit = true;
    receipt.reason = 'page_limit';
  } catch (e) {
    receipt.status = 'FAILED';
    receipt.reason = sanitizeError(e);
  }
  return receipt;
}

function paidRunReference(target, pass) {
  const ref = target.source_runs?.[pass];
  const actor =
    target.platform === 'instagram' ? 'apify/instagram-scraper' : 'harvestapi/linkedin-company-posts';
  if (
    !record(ref) ||
    !external(ref.run_id) ||
    !(external(ref.actor_id) || ref.actor_id === actor) ||
    (ref.build_id != null && !external(ref.build_id))
  )
    fail('M06_UPKEEP_PAID_REFERENCE_REQUIRED');
  return ref;
}

async function readPaidPart(target, pass, ports, settings, signal) {
  const receipt = base({ ...target, pass }),
    ref = paidRunReference(target, pass);
  checkAbort(signal);
  let snapshot;
  try {
    snapshot = await ports.actorSnapshot({
      actor:
        target.platform === 'instagram' ? 'apify/instagram-scraper' : 'harvestapi/linkedin-company-posts',
      account_id: target.account_id,
      pass,
      since: target.since,
      ...ref,
      signal,
    });
  } catch {
    checkAbort(signal);
    fail('M06_UPKEEP_PAID_READ_FAILED');
  }
  checkAbort(signal);
  const run = snapshot?.run,
    input = snapshot?.input,
    dataset = snapshot?.dataset,
    verified = snapshot?.verified_actor;
  if (
    !record(verified) ||
    !external(verified.actor_id) ||
    !external(verified.build_id) ||
    !record(run) ||
    run.id !== ref.run_id ||
    run.actId !== verified.actor_id ||
    run.buildId !== verified.build_id ||
    (external(ref.actor_id) && run.actId !== ref.actor_id) ||
    (ref.build_id != null && run.buildId !== ref.build_id) ||
    !external(run.defaultDatasetId) ||
    !iso(run.finishedAt) ||
    Date.parse(run.finishedAt) > Date.parse(settings.now) ||
    !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'].includes(run.status) ||
    !record(input) ||
    Object.keys(input).some((k) => /cookie|login|password|session|token|authorization/i.test(k)) ||
    !record(dataset) ||
    dataset.id !== run.defaultDatasetId ||
    dataset.offset !== 0 ||
    !Number.isSafeInteger(dataset.itemCount) ||
    dataset.itemCount < 0 ||
    !Number.isSafeInteger(dataset.limit) ||
    dataset.limit < 1 ||
    dataset.limit > settings.maxItems ||
    !Array.isArray(dataset.items) ||
    dataset.items.length > dataset.limit ||
    dataset.items.length > dataset.itemCount
  )
    fail('M06_UPKEEP_PAID_CONTRACT_INVALID');
  const urls = target.platform === 'instagram' ? input.directUrls : input.targetUrls;
  const cap = target.platform === 'instagram' ? input.resultsLimit : input.maxPosts;
  if (
    !Array.isArray(urls) ||
    urls.length < 1 ||
    urls.length > 100 ||
    urls.filter((url) => url === target.url).length !== 1 ||
    new Set(urls).size !== urls.length ||
    urls.some((url) =>
      target.platform === 'instagram'
        ? typeof url !== 'string' || !/^https:\/\/www\.instagram\.com\/[a-z0-9._]{1,30}\/$/i.test(url)
        : !linkedin.linkedinHelpers.linkedinCompany(url),
    ) ||
    !Number.isSafeInteger(cap) ||
    cap < 1 ||
    cap > (target.platform === 'instagram' ? 3000 : 1000) ||
    (target.platform === 'instagram' && (input.resultsType !== pass || input.addParentData !== false)) ||
    (target.platform === 'linkedin' && (input.scrapeComments !== false || input.scrapeReactions !== false))
  )
    fail('M06_UPKEEP_PAID_INPUT_MISMATCH');
  receipt.status = run.status;
  receipt.pinned_included =
    target.platform !== 'instagram' || pass === 'reels' || input.skipPinnedPosts === false;
  receipt.hit_limit = dataset.items.length < dataset.itemCount;
  receipt.next_cursor = dataset.items.length < dataset.itemCount ? String(dataset.items.length) : null;
  receipt.pages_observed = 1;
  receipt.reason = 'paid_source_exhaustion_unverified';
  if (run.status !== 'SUCCEEDED') return receipt;
  let items;
  if (target.platform === 'instagram') {
    instagram.validateInstagramAccounts([{ ...target, id: target.account_id }]);
    const selectedOwner = target.handle.toLowerCase();
    // The registered profile output may include collaboration posts owned by a
    // different profile. Their authentic INPUT URL establishes why they were in
    // this dataset, never ownership of their content or metrics. Ignore them
    // only with exact INPUT attribution; provider errors are still failures.
    if (
      dataset.items.some(
        (r) =>
          !record(r) ||
          typeof r.ownerUsername !== 'string' ||
          !/^[a-z0-9._]{1,30}$/i.test(r.ownerUsername) ||
          Boolean(r.error) ||
          Boolean(r.errorDescription) ||
          r.isPrivate === true ||
          (r.inputUrl !== undefined && !urls.includes(r.inputUrl)) ||
          (r.ownerUsername.toLowerCase() !== selectedOwner && !urls.includes(r.inputUrl)),
      )
    )
      fail('M06_UPKEEP_PAID_SOURCE_INVALID');
    const owned = dataset.items.filter((r) => r.ownerUsername.toLowerCase() === selectedOwner);
    if (dataset.items.length > 0 && owned.length === 0) fail('M06_UPKEEP_PAID_SOURCE_INVALID');
    items = instagram.normalizeInstagramScraper(owned, { result_type: pass });
    if (items.length !== owned.length) fail('M06_UPKEEP_PAID_SOURCE_INVALID');
    receipt.hit_limit ||= owned.length >= cap;
  } else {
    const [account] = linkedin.linkedinHelpers.linkedinAccounts([{ ...target, id: target.account_id }]);
    const prepared = linkedin.normalizeLinkedInPosts(dataset.items);
    const companies = new Set(urls.map((url) => linkedin.linkedinHelpers.linkedinCompany(url).slug));
    if (prepared.errors.length || prepared.items.some((item) => !companies.has(item.matchKey)))
      fail('M06_UPKEEP_PAID_SOURCE_INVALID');
    items = prepared.items.filter((r) => r.matchKey === account.slug).map((r) => r.json);
    receipt.hit_limit ||= items.length >= cap;
  }
  addEntries(
    receipt,
    items.filter((i) => Date.parse(i.published_at) >= Date.parse(settings.cutoff)),
    target,
    iso(run.finishedAt),
    settings.maxItems,
    settings.now,
  );
  return receipt;
}

/** The request port receives only adapter-built official URLs. actorSnapshot is
 * a READ of an already known registered run/build/INPUT/dataset, never a start.
 * Failed later pages retain already validated observations for metrics only.
 * Callers MUST NOT turn those entries into removal proof when status is FAILED.
 */
export async function readUpkeepListing(target, ports, options = {}, signal) {
  const settings = context(target, options);
  if (
    !record(ports) ||
    (['vimeo', 'youtube'].includes(target.platform)
      ? typeof ports.request !== 'function'
      : typeof ports.actorSnapshot !== 'function')
  )
    fail('M06_UPKEEP_SOURCE_BINDING_REQUIRED');
  checkAbort(signal);
  if (target.platform === 'vimeo') return readVimeo(target, ports, settings, signal);
  if (target.platform === 'youtube') return readYoutube(target, ports, settings, signal);
  if (target.platform === 'instagram') {
    if (target.pass !== 'posts_and_reels') fail('M06_UPKEEP_PAID_PASS_INVALID');
    const parts = [];
    for (const pass of ['posts', 'reels']) {
      try {
        parts.push(await readPaidPart(target, pass, ports, settings, signal));
      } catch (e) {
        checkAbort(signal);
        parts.push({ ...base({ ...target, pass }), status: 'FAILED', reason: sanitizeError(e) });
      }
    }
    const receipt = base(target);
    receipt.passes = parts;
    receipt.status = parts.every((p) => p.status === 'SUCCEEDED') ? 'SUCCEEDED' : 'FAILED';
    const entries = new Map();
    for (const entry of parts.flatMap((p) => p.entries)) {
      const previous = entries.get(entry.external_id);
      if (previous && previous.published_at !== entry.published_at) fail('M06_UPKEEP_PAID_SOURCE_INVALID');
      if (!previous || previous.observed_at <= entry.observed_at) entries.set(entry.external_id, entry);
    }
    receipt.entries = [...entries.values()];
    receipt.reason = 'paid_source_exhaustion_unverified';
    return receipt;
  }
  if (target.pass !== 'posts') fail('M06_UPKEEP_PAID_PASS_INVALID');
  return readPaidPart(target, 'posts', ports, settings, signal);
}
