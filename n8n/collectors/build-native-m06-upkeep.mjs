import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  trigger,
  code,
  node,
  booleanIf,
  settings,
  tags,
  line,
  edge,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';

// Serializable native transitions only. The authenticated Node route owns source
// I/O, coverage derivation, SQL and health validation/rendering. Cloud Code never
// imports server-only modules or accepts caller-authored listing proof.
export function upkeepNativeObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function upkeepNativeUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}
export function upkeepNativeExact(v, fields) {
  return upkeepNativeObject(v) && Object.keys(v).sort().join(',') === [...fields].sort().join(',');
}
export function upkeepNativeDay(v) {
  return (
    typeof v === 'string' &&
    /^2\d{3}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + 'T00:00:00Z')) &&
    new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
  );
}
export function upkeepNativeCount(v) {
  return Number.isSafeInteger(v) && v >= 0 && v <= 100000;
}
export function upkeepNativeReason(v) {
  return v === null || (typeof v === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(v));
}
export function upkeepNativeRequestId(execution, sequence, health = false) {
  if (
    !/^[0-9]{1,15}$/.test(execution) ||
    !Number.isSafeInteger(Number(execution)) ||
    Number(execution) >= 2 ** 48 ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 4095
  )
    throw Error('M06_UPKEEP_EXECUTION_INVALID');
  return `${health ? 'c0691000' : 'c0640000'}-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(execution).toString(16).padStart(12, '0')}`;
}
export function upkeepNativeRequest(state, operation, args) {
  state.sequence++;
  state.request = {
    version: 1,
    requestId: upkeepNativeRequestId(state.executionId, state.sequence),
    operation,
    args,
  };
  return state;
}
export function initializeM06Upkeep(input, executionId) {
  if (
    !upkeepNativeObject(input) ||
    Object.keys(input).some((k) => !['env', 'platform', 'after'].includes(k)) ||
    input.env !== 'dev' ||
    !['vimeo', 'youtube', 'instagram', 'linkedin'].includes(input.platform) ||
    (input.after !== undefined && input.after !== null && !upkeepNativeUuid(input.after))
  )
    throw Error('M06_UPKEEP_INPUT_INVALID');
  const state = {
    executionId,
    platform: input.platform,
    sequence: 0,
    targets: [],
    index: 0,
    outcomes: [],
    next_account_id: null,
    action: 'request',
  };
  return upkeepNativeRequest(state, 'targets', {
    platform: input.platform,
    ...(input.after ? { after: input.after } : {}),
    limit: 20,
  });
}
export function upkeepNativeEnvelope(response, prior) {
  const b = response?.body;
  return (
    response?.statusCode === 200 &&
    upkeepNativeExact(b, ['version', 'requestId', 'operation', 'replayed', 'result']) &&
    b.version === 1 &&
    b.requestId === prior.request.requestId &&
    b.operation === prior.request.operation &&
    typeof b.replayed === 'boolean'
  );
}
export function upkeepNativeAccountResult(result, target) {
  if (
    !upkeepNativeExact(result, [
      'account_id',
      'platform',
      'since',
      'metrics_since',
      'metrics_updated',
      'eligible',
      'reason',
      'removal',
    ]) ||
    result.account_id !== target.account_id ||
    result.platform !== target.platform ||
    result.since !== target.since ||
    result.metrics_since !== target.metrics_since ||
    !upkeepNativeCount(result.metrics_updated) ||
    typeof result.eligible !== 'boolean' ||
    !upkeepNativeReason(result.reason) ||
    (result.eligible ? result.reason !== null : result.reason === null)
  )
    throw Error('M06_UPKEEP_ACCOUNT_RECEIPT_INVALID');
  if (result.removal === null) {
    if (result.eligible) throw Error('M06_UPKEEP_ACCOUNT_RECEIPT_INVALID');
  } else if (
    !result.eligible ||
    !upkeepNativeExact(result.removal, ['removed', 'restored', 'skipped']) ||
    !upkeepNativeCount(result.removal.removed) ||
    !upkeepNativeCount(result.removal.restored) ||
    !upkeepNativeReason(result.removal.skipped)
  )
    throw Error('M06_UPKEEP_ACCOUNT_RECEIPT_INVALID');
  return result;
}
export function upkeepNativeNextAccount(state) {
  if (state.index >= state.targets.length) {
    state.action = 'done';
    state.result = {
      platform: state.platform,
      processed: state.outcomes.length,
      next_account_id: state.next_account_id,
      outcomes: state.outcomes,
    };
    return state;
  }
  state.action = 'request';
  return upkeepNativeRequest(state, 'account.process', state.targets[state.index]);
}
export function advanceM06Upkeep(state, response) {
  if (
    !upkeepNativeObject(state) ||
    !['request', 'reconcile'].includes(state.action) ||
    !upkeepNativeObject(state.request)
  )
    throw Error('M06_UPKEEP_STATE_INVALID');
  const operation = state.request.operation;
  const validEnvelope = upkeepNativeEnvelope(response, state);
  if (operation === 'targets') {
    const r = validEnvelope ? response.body.result : null;
    if (
      !upkeepNativeExact(r, ['targets', 'next_account_id']) ||
      !Array.isArray(r.targets) ||
      r.targets.length > 20 ||
      !(r.next_account_id === null || upkeepNativeUuid(r.next_account_id)) ||
      new Set(r.targets.map((t) => t?.account_id)).size !== r.targets.length ||
      r.targets.some(
        (t) =>
          !upkeepNativeObject(t) ||
          !upkeepNativeUuid(t.account_id) ||
          t.platform !== state.platform ||
          !upkeepNativeDay(t.since) ||
          !upkeepNativeDay(t.metrics_since) ||
          t.metrics_since < t.since,
      ) ||
      (r.next_account_id !== null &&
        (r.targets.length !== 20 || r.targets.at(-1).account_id !== r.next_account_id))
    )
      throw Error('M06_UPKEEP_TARGETS_INVALID');
    // Do not carry source URLs, raw rows or supplied coverage through Cloud state.
    state.targets = r.targets.map((t) => ({
      account_id: t.account_id,
      platform: t.platform,
      since: t.since,
      metrics_since: t.metrics_since,
    }));
    state.next_account_id = r.next_account_id;
    return upkeepNativeNextAccount(state);
  }
  const target = state.targets[state.index];
  if (!target) throw Error('M06_UPKEEP_STATE_INVALID');
  if (operation === 'account.process') {
    let result = null;
    if (validEnvelope) {
      try {
        result = upkeepNativeAccountResult(response.body.result, target);
      } catch {
        /* reconcile known ID */
      }
    }
    if (result === null) {
      state.uncertainRequestId = state.request.requestId;
      state.action = 'reconcile';
      return upkeepNativeRequest(state, 'request.status', { request_id: state.uncertainRequestId });
    }
    state.outcomes.push({ ...result, request_id: state.request.requestId, verified_by: 'direct' });
  } else if (operation === 'request.status') {
    const r = validEnvelope ? response.body.result : null;
    if (
      !upkeepNativeExact(r, ['state', 'operation', 'result']) ||
      r.state !== 'completed' ||
      r.operation !== 'apply_observation'
    )
      throw Error('M06_UPKEEP_RECONCILIATION_REQUIRED');
    let result;
    try {
      result = upkeepNativeAccountResult(r.result, target);
    } catch {
      throw Error('M06_UPKEEP_RECONCILIATION_REQUIRED');
    }
    state.outcomes.push({ ...result, request_id: state.uncertainRequestId, verified_by: 'status' });
    delete state.uncertainRequestId;
  } else throw Error('M06_UPKEEP_STATE_INVALID');
  state.index++;
  return upkeepNativeNextAccount(state);
}
export function initializeM06UpkeepHealth(input, executionId) {
  if (!upkeepNativeExact(input, ['env']) || input.env !== 'dev')
    throw Error('M06_UPKEEP_HEALTH_INPUT_INVALID');
  return {
    request: {
      version: 1,
      requestId: upkeepNativeRequestId(executionId, 1, true),
      operation: 'health.read',
      args: {},
    },
  };
}
export function verifyM06UpkeepHealth(response, prior) {
  const r = response?.body?.result;
  const bad = () => {
    throw Error('M06_UPKEEP_HEALTH_RECEIPT_INVALID');
  };
  if (
    !upkeepNativeEnvelope(response, prior) ||
    !upkeepNativeExact(r, ['health', 'projection', 'rendered', 'sent', 'delivery']) ||
    !upkeepNativeObject(r.health) ||
    r.sent !== false ||
    r.delivery !== 'local_only'
  )
    bad();
  const p = r.projection;
  if (
    !upkeepNativeExact(p, [
      'version',
      'failing_accounts',
      'stale_accounts',
      'queue_depths',
      'story_queue_depth',
      'zero_item_streaks',
      'story_capture_gap',
      'media_missing_24h',
      'm06_signals_observed',
      'over_budget',
      'notification_mode',
      'sent',
    ]) ||
    !['m06', 'legacy'].includes(p.version) ||
    !upkeepNativeCount(p.failing_accounts) ||
    !upkeepNativeCount(p.stale_accounts) ||
    !upkeepNativeExact(p.queue_depths, ['ai_extract', 'embed', 'media']) ||
    !Object.values(p.queue_depths).every(upkeepNativeCount) ||
    ![p.story_queue_depth, p.zero_item_streaks, p.media_missing_24h].every(
      (v) => v === null || upkeepNativeCount(v),
    ) ||
    !(
      p.story_capture_gap === null ||
      (typeof p.story_capture_gap === 'number' &&
        Number.isFinite(p.story_capture_gap) &&
        p.story_capture_gap >= 0 &&
        p.story_capture_gap <= 1)
    ) ||
    typeof p.m06_signals_observed !== 'boolean' ||
    typeof p.over_budget !== 'boolean' ||
    p.notification_mode !== 'local_only' ||
    p.sent !== false
  )
    bad();
  if (
    !upkeepNativeExact(r.rendered, ['subject', 'text', 'html']) ||
    !Object.entries(r.rendered).every(
      ([key, v]) => typeof v === 'string' && v.length >= 1 && v.length <= (key === 'subject' ? 160 : 65536),
    )
  )
    bad();
  // Raw health is validated by the maintained server/shared contract. It is not
  // rendered in Cloud or forwarded to a notification provider.
  return { projection: p, rendered: r.rendered, sent: false, delivery: 'local_only' };
}

export const m06UpkeepCloudSource = [
  upkeepNativeObject,
  upkeepNativeUuid,
  upkeepNativeExact,
  upkeepNativeDay,
  upkeepNativeCount,
  upkeepNativeReason,
  upkeepNativeRequestId,
  upkeepNativeRequest,
  initializeM06Upkeep,
  upkeepNativeEnvelope,
  upkeepNativeAccountResult,
  upkeepNativeNextAccount,
  advanceM06Upkeep,
  initializeM06UpkeepHealth,
  verifyM06UpkeepHealth,
]
  .map((f) => f.toString())
  .join('\n\n');
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0]?.json||typeof rows[0].json!=='object'||Array.isArray(rows[0].json)||rows[0].binary)throw Error('M06_UPKEEP_INPUT_INVALID');const j=rows[0].json;\n";

function nativeDefinition(input, transport, ready, health, manualInput) {
  const b = parseN8nBindings(input),
    c = ready ? parseCollectorTransport(transport) : transport;
  const key = health ? 'WF-91-M06-HEALTH' : 'WF-40-M06-UPKEEP';
  const privacy = settings(b, 'WF-12');
  delete privacy.errorWorkflow;
  Object.assign(privacy, {
    executionTimeout: health ? 60 : 2400,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
    availableInMCP: false,
  });
  const call = trigger(key, []);
  call.parameters = { inputSource: 'passthrough' };
  const guard = ready ? '' : "throw Error('M06_UPKEEP_BINDING_REQUIRED');\n";
  const http = (name, position) => {
    const n = nativeM05Http(
      c,
      key,
      name,
      'gateway',
      c.audience + '/api/internal/m06/upkeep',
      '={{ $json.request }}',
      position,
    );
    n.parameters.options.timeout = health ? 25000 : 60000;
    return n;
  };
  const nodes = health
    ? [
        call,
        code(
          key,
          'Prepare maintained health read',
          guard +
            one +
            m06UpkeepCloudSource +
            '\nreturn[{json:initializeM06UpkeepHealth(j,String($execution.id))}];',
          [250, 0],
        ),
        http('Read maintained M06 health', [500, 0]),
        code(
          key,
          'Verify local health delivery',
          one +
            m06UpkeepCloudSource +
            "\nreturn[{json:verifyM06UpkeepHealth(j,$('Prepare maintained health read').item.json)}];",
          [750, 0],
        ),
      ]
    : [
        call,
        code(
          key,
          'Initialize upkeep page',
          guard +
            one +
            m06UpkeepCloudSource +
            '\nreturn[{json:initializeM06Upkeep(j,String($execution.id))}];',
          [250, 0],
        ),
        booleanIf(
          key,
          'Upkeep request required?',
          '={{ ["request","reconcile"].includes($json.action) }}',
          [500, 0],
        ),
        code(key, 'Prepare upkeep HTTP', one + 'return[{json:j}];', [750, -150]),
        http('Execute restricted upkeep request', [1000, -150]),
        code(
          key,
          'Advance upkeep receipt',
          one +
            m06UpkeepCloudSource +
            "\nreturn[{json:advanceM06Upkeep($('Prepare upkeep HTTP').item.json,j)}];",
          [1250, -150],
        ),
        code(
          key,
          'Return upkeep page',
          one +
            "if(j.action!=='done'||!j.result)throw Error('M06_UPKEEP_RECONCILIATION_REQUIRED');return[{json:j.result}];",
          [750, 200],
        ),
      ];
  const spec = {
    key,
    kind: 'native-json-blueprint',
    runnableWorkflow: true,
    liveEnabled: false,
    hostedAcceptance: false,
    definitionProfile: 'inactive_native_staging',
    bindingManifest: { ready, environment: 'dev', audience: c.audience, credential: { ...c.credential } },
    boundary: {
      sourceProof: 'derived_by_authenticated_server_adapter_only',
      accountPageLimit: 20,
      accountProcessing: 'serial',
      uncertainWrite: 'one_status_read_original_id_never_blind_mutation_retry',
      notifications: 'local_render_only_no_email',
      scheduled: false,
    },
    workflow: {
      name: health
        ? 'WF-91-M06 · Maintained health read [dev]'
        : 'WF-40-M06 · Removal and metrics upkeep [dev]',
      active: false,
      nodes,
      settings: privacy,
      tags: tags(b, ['env:dev', 'layer:collector']),
      pinData: {},
      connections: health
        ? line(
            'When called',
            'Prepare maintained health read',
            'Read maintained M06 health',
            'Verify local health delivery',
          )
        : {
            ...line('When called', 'Initialize upkeep page', 'Upkeep request required?'),
            'Upkeep request required?': {
              main: [[edge('Prepare upkeep HTTP')], [edge('Return upkeep page')]],
            },
            ...line(
              'Prepare upkeep HTTP',
              'Execute restricted upkeep request',
              'Advance upkeep receipt',
              'Upkeep request required?',
            ),
          },
    },
  };
  // An owned manual verification may seed only the same validated dev input as
  // the subworkflow entry. The initializer still uses the actual execution ID;
  // this adds neither scheduling nor a caller-supplied identity/replay override.
  if (manualInput !== undefined) {
    if (health) initializeM06UpkeepHealth(manualInput, '1');
    else initializeM06Upkeep(manualInput, '1');
    const triggerNodeName = health ? 'Manual M06 health read' : 'Manual M06 upkeep',
      inputNodeName = health ? 'Fixed M06 health input' : 'Fixed M06 upkeep input';
    spec.workflow.nodes.push(
      node(key, triggerNodeName, 'manualTrigger', {}, [0, 200]),
      code(key, inputNodeName, 'return [{json:' + JSON.stringify(manualInput) + '}];', [250, 200]),
    );
    Object.assign(
      spec.workflow.connections,
      line(
        triggerNodeName,
        inputNodeName,
        health ? 'Prepare maintained health read' : 'Initialize upkeep page',
      ),
    );
    spec.manualEntry = { triggerNodeName, inputNodeName, input: structuredClone(manualInput) };
  }
  return spec;
}
export function buildNativeM06Upkeep(input, transport, manualInput) {
  return nativeDefinition(input, transport, true, false, manualInput);
}
export function buildNativeM06Health(input, transport, manualInput) {
  return nativeDefinition(input, transport, true, true, manualInput);
}
function unboundTransport() {
  return {
    audience: 'https://everyone-market-researcher-unbound.vercel.app',
    credential: { id: 'UNBOUND_M06_UPKEEP_AUTH', name: 'UNBOUND M06 upkeep dev', type: 'httpCustomAuth' },
  };
}
export function buildUnboundNativeM06Upkeep(input) {
  return nativeDefinition(input, unboundTransport(), false, false);
}
export function buildUnboundNativeM06Health(input) {
  return nativeDefinition(input, unboundTransport(), false, true);
}
