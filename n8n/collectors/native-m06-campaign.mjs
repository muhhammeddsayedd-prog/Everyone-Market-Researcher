// Finite product scheduling. SQL owns slot selection, claims and the final
// paid-start cutoff; these pure transitions only validate native receipts.
import { m06StoryRequestId, initializeM06Stories, nextM06StoryLaunch } from './native-m06-stories.mjs';
import { buildStoryBatches, storyRegistrationCompletion } from './stories.mjs';
export function validateM06CampaignPin(pin) {
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  if (
    !pin ||
    Object.keys(pin).sort().join(',') !== 'account_ids,campaign_id,end_date,start_date' ||
    !uuid(pin.campaign_id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pin.start_date ?? '') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pin.end_date ?? '') ||
    !Number.isFinite(Date.parse(pin.start_date)) ||
    new Date(Date.parse(pin.start_date)).toISOString().slice(0, 10) !== pin.start_date ||
    !Number.isFinite(Date.parse(pin.end_date)) ||
    new Date(Date.parse(pin.end_date)).toISOString().slice(0, 10) !== pin.end_date ||
    Date.parse(pin.end_date) - Date.parse(pin.start_date) !== 6 * 86400000 ||
    !Array.isArray(pin.account_ids) ||
    pin.account_ids.length !== 20 ||
    pin.account_ids.some((x) => !uuid(x)) ||
    new Set(pin.account_ids).size !== 20
  )
    throw Error('M06_CAMPAIGN_PIN_INVALID');
  return pin;
}

export function m06CampaignClock(now) {
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) throw Error('M06_CAMPAIGN_CLOCK_INVALID');
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function prepareM06CampaignTick(pin, executionId, now) {
  validateM06CampaignPin(pin);
  const clock = m06CampaignClock(now);
  const shutdownDay = new Date(Date.parse(pin.end_date) + 86400000).toISOString().slice(0, 10);
  if (clock.day > shutdownDay || (clock.day === shutdownDay && clock.hour >= 18))
    return { action: 'closed', campaign_id: pin.campaign_id, reason: 'campaign_cutoff' };
  if (clock.day < pin.start_date || clock.hour < 6 || clock.hour >= 18)
    return { action: 'idle', campaign_id: pin.campaign_id, reason: 'outside_observation_window' };
  return {
    action: 'gateway',
    request: {
      version: 1,
      requestId: m06StoryRequestId(executionId, 1),
      operation: 'm06.campaign_tick',
      args: { campaign_id: pin.campaign_id, execution_id: executionId },
    },
  };
}

export function verifyM06CampaignTick(response, prior, pin) {
  validateM06CampaignPin(pin);
  const body = response?.body,
    r = body?.result;
  if (
    response?.statusCode !== 200 ||
    body?.version !== 1 ||
    body.requestId !== prior?.request?.requestId ||
    body.operation !== 'm06.campaign_tick' ||
    typeof body.replayed !== 'boolean' ||
    !r ||
    typeof r !== 'object' ||
    Array.isArray(r) ||
    r.campaign_id !== pin.campaign_id
  )
    throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  const shapes = {
    launch: 'accounts,action,campaign_id,day,group_key,run_id,selection',
    recover: 'action,apify_run_id,campaign_id,registration_closed,run_id',
    media: 'action,campaign_id,max_batches',
    idle: 'action,campaign_id,reason',
    closed: 'action,campaign_id,reason',
    blocked: 'action,campaign_id,reason',
  };
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  if (!Object.hasOwn(shapes, r.action) || Object.keys(r).sort().join(',') !== shapes[r.action])
    throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  if (r.action === 'launch') {
    if (
      body.replayed ||
      !uuid(r.run_id) ||
      typeof r.day !== 'string' ||
      r.day < pin.start_date ||
      r.day > pin.end_date ||
      !/^[a-z0-9_-]{1,100}$/.test(r.group_key ?? '') ||
      !r.selection ||
      !Array.isArray(r.selection.account_ids) ||
      r.selection.account_ids.some((id) => !pin.account_ids.includes(id)) ||
      !Array.isArray(r.accounts) ||
      r.accounts.length !== r.selection.account_ids.length
    )
      throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  } else if (r.action === 'recover') {
    if (
      !uuid(r.run_id) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(r.apify_run_id ?? '') ||
      typeof r.registration_closed !== 'boolean'
    )
      throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  } else if (r.action === 'media') {
    if (r.max_batches !== 6) throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  } else if (!/^[a-z0-9_]{1,100}$/.test(r.reason ?? '')) throw Error('M06_CAMPAIGN_RECEIPT_INVALID');
  return r;
}

/** Continue the accepted collector after SQL atomically started/claimed the
 * campaign slot. There is no second start/claim and no actor replacement. */
export function initializeM06CampaignLaunch(tick, executionId, pin, now) {
  validateM06CampaignPin(pin);
  const clock = m06CampaignClock(now);
  if (
    tick?.action !== 'launch' ||
    tick.campaign_id !== pin.campaign_id ||
    tick.day !== clock.day ||
    clock.day < pin.start_date ||
    clock.day > pin.end_date ||
    clock.hour < 6 ||
    clock.hour >= 12 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tick.run_id ?? '')
  )
    throw Error('M06_CAMPAIGN_LAUNCH_INVALID');
  const selection = tick.selection;
  const state = initializeM06Stories(selection, executionId, now);
  if (
    selection.max_actor_starts !== 1 ||
    selection.account_ids.some((id) => !pin.account_ids.includes(id)) ||
    (selection.collection_mode === 'bakeoff' &&
      selection.actor_id === 'data-slayer/instagram-stories-scraper') ||
    (selection.collection_mode === 'ingest'
      ? selection.account_ids.length !== 20 || selection.results_limit !== 30
      : selection.account_ids.length !== 20 || selection.results_limit !== 50)
  )
    throw Error('M06_CAMPAIGN_LAUNCH_INVALID');
  state.runId = tick.run_id;
  state.batches = buildStoryBatches(tick.accounts, {
    actor_id: state.actorId,
    collection_mode: state.collectionMode,
    results_limit: state.resultsLimit,
  });
  if (
    state.batches.length !== 1 ||
    state.batches[0].account_ids.length !== selection.account_ids.length ||
    state.batches[0].account_ids.some((id) => !selection.account_ids.includes(id))
  )
    throw Error('M06_CAMPAIGN_LAUNCH_INVALID');
  return nextM06StoryLaunch(state);
}

export function prepareM06CampaignRecoveryClose(callback, tick, executionId) {
  if (
    !callback ||
    callback.accepted !== true ||
    callback.state !== 'completed' ||
    callback.apify_run_id !== tick.apify_run_id ||
    typeof callback.replayed !== 'boolean'
  )
    throw Error('M06_CAMPAIGN_RECOVERY_UNSETTLED');
  return tick.registration_closed
    ? { action: 'done', apify_run_id: tick.apify_run_id }
    : {
        action: 'gateway',
        request: {
          version: 1,
          requestId: m06StoryRequestId(executionId, 2),
          operation: 'm06.close_registration',
          args: { run_id: tick.run_id },
        },
      };
}

export function verifyM06CampaignRecoveryClose(response, prior) {
  const b = response?.body;
  if (
    response?.statusCode !== 200 ||
    b?.version !== 1 ||
    b.requestId !== prior?.request?.requestId ||
    b.operation !== 'm06.close_registration' ||
    typeof b.replayed !== 'boolean'
  )
    throw Error('M06_CAMPAIGN_RECOVERY_UNSETTLED');
  return storyRegistrationCompletion(b.result, prior.request.args.run_id);
}
