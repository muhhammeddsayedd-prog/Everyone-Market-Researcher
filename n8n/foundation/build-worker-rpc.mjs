import { node, nodeId, trigger, code, line } from './build-foundation.mjs';

/** This pure runtime carries no credential, URL, SQL or network primitive. */
export function createWorkerAdapterRuntime(expectedAudience = null) {
  const bad = () => {
    throw Error('GW01_ADAPTER_INPUT_INVALID');
  };
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const exact = (v, keys) =>
    object(v) && Object.keys(v).length === keys.length && Object.keys(v).every((k) => keys.includes(k));
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const count = (v) => Number.isSafeInteger(v) && v >= 0;
  const money = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 999999999;
  const platforms = [
    'vimeo',
    'instagram',
    'instagram_stories',
    'website',
    'website_work_page',
    'linkedin',
    'linkedin_employees',
    'youtube',
    'news',
  ];
  const providers = [
    'apify',
    'openai',
    'serpapi',
    'firecrawl',
    'vimeo',
    'youtube',
    'n8n',
    'supabase',
    'vercel',
    'email',
    'other',
  ];
  const nullableText = (v, max) => v === null || (typeof v === 'string' && v.length <= max);
  const date = (v) =>
    typeof v === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) &&
    Number.isFinite(Date.parse(v));
  const record = (v, keys, validate) =>
    object(v) && Object.entries(v).every(([k, n]) => keys.includes(k) && validate(n));
  function health(r) {
    return (
      exact(r, [
        'failing_accounts',
        'stale_accounts',
        'queues',
        'items_new_yesterday',
        'cost_yesterday',
        'budget',
        'month_to_date_usd',
        'forecast_month_usd',
        'workflow_errors_24h',
      ]) &&
      Array.isArray(r.failing_accounts) &&
      r.failing_accounts.length <= 2000 &&
      r.failing_accounts.every(
        (v) =>
          exact(v, [
            'account_id',
            'competitor',
            'platform',
            'handle',
            'last_error',
            'consecutive_failures',
          ]) &&
          uuid(v.account_id) &&
          typeof v.competitor === 'string' &&
          v.competitor.length <= 500 &&
          platforms.includes(v.platform) &&
          nullableText(v.handle, 500) &&
          (v.last_error === null ||
            (typeof v.last_error === 'string' && /^[A-Za-z0-9_:-]{1,120}$/.test(v.last_error))) &&
          count(v.consecutive_failures),
      ) &&
      Array.isArray(r.stale_accounts) &&
      r.stale_accounts.length <= 2000 &&
      r.stale_accounts.every(
        (v) =>
          exact(v, ['account_id', 'competitor', 'platform', 'handle', 'last_success_at']) &&
          uuid(v.account_id) &&
          typeof v.competitor === 'string' &&
          v.competitor.length <= 500 &&
          platforms.includes(v.platform) &&
          nullableText(v.handle, 500) &&
          (v.last_success_at === null || date(v.last_success_at)),
      ) &&
      exact(r.queues, ['ai_extract', 'embed', 'media']) &&
      Object.values(r.queues).every(count) &&
      record(r.items_new_yesterday, platforms, count) &&
      exact(r.cost_yesterday, ['total', 'by_provider']) &&
      money(r.cost_yesterday.total) &&
      record(r.cost_yesterday.by_provider, providers, money) &&
      exact(r.budget, ['daily_budget_usd', 'over_budget']) &&
      money(r.budget.daily_budget_usd) &&
      typeof r.budget.over_budget === 'boolean' &&
      money(r.month_to_date_usd) &&
      money(r.forecast_month_usd) &&
      object(r.workflow_errors_24h) &&
      Object.entries(r.workflow_errors_24h).every(([k, n]) => /^[A-Za-z0-9_-]{1,200}$/.test(k) && count(n))
    );
  }
  const operations = [
    'identity.read',
    'request.status',
    'settings.read',
    'prices.read',
    'health.read',
    'error.count',
    'error.log',
  ];
  function prepare(value) {
    if (
      !exact(value, ['requestId', 'reconcileRequestId', 'operation', 'args']) ||
      !uuid(value.requestId) ||
      !uuid(value.reconcileRequestId) ||
      value.requestId.toLowerCase() === value.reconcileRequestId.toLowerCase() ||
      !operations.includes(value.operation) ||
      !object(value.args)
    )
      bad();
    const a = value.args,
      op = value.operation;
    if (['identity.read', 'prices.read', 'health.read'].includes(op) && !exact(a, [])) bad();
    if (
      op === 'request.status' &&
      (!exact(a, ['targetRequestId']) ||
        !uuid(a.targetRequestId) ||
        a.targetRequestId.toLowerCase() === value.requestId.toLowerCase() ||
        a.targetRequestId.toLowerCase() === value.reconcileRequestId.toLowerCase())
    )
      bad();
    if (
      op === 'settings.read' &&
      (!exact(a, ['key']) ||
        !['daily_budget_usd', 'stories_twice_daily', 'stats_daily_enabled'].includes(a.key))
    )
      bad();
    if (
      op === 'error.count' &&
      (!exact(a, ['workflow', 'claimNotify']) ||
        a.workflow !== 'M03-GATEWAY-ACCEPTANCE-DEV' ||
        a.claimNotify !== false)
    )
      bad();
    if (
      op === 'error.log' &&
      (!exact(a, ['workflow', 'executionId', 'message', 'kind']) ||
        a.workflow !== 'M03-GATEWAY-ACCEPTANCE-DEV' ||
        !uuid(a.executionId) ||
        a.message !== 'gateway_acceptance' ||
        a.kind !== 'notify')
    )
      bad();
    return {
      request: { version: 1, requestId: value.requestId, operation: op, args: { ...a } },
      reconcileRequestId: value.reconcileRequestId,
      originalTargetRequestId: op === 'request.status' ? a.targetRequestId : value.requestId,
    };
  }
  function safeResult(op, r, args) {
    if (op === 'identity.read')
      return exact(r, ['currentUser', 'sessionUser', 'database', 'projectRef', 'connectionCount']) &&
        r.currentUser === 'n8n_writer' &&
        r.sessionUser === 'n8n_writer' &&
        r.database === 'postgres' &&
        r.projectRef === 'zmotjsbzhzjvpelxvxlf' &&
        count(r.connectionCount)
        ? { identityVerified: true, connectionCount: r.connectionCount }
        : null;
    if (op === 'settings.read')
      return exact(r, ['key', 'value']) &&
        ['daily_budget_usd', 'stories_twice_daily', 'stats_daily_enabled'].includes(r.key) &&
        (args.key === undefined || r.key === args.key) &&
        (r.key === 'daily_budget_usd' ? money(r.value) : typeof r.value === 'boolean')
        ? { settingVerified: true }
        : null;
    if (op === 'prices.read')
      return exact(r, ['prices']) &&
        object(r.prices) &&
        Object.keys(r.prices).length <= 100 &&
        Object.entries(r.prices).every(
          ([key, v]) =>
            /^[a-z0-9_~:/.-]{1,160}$/.test(key) &&
            exact(v, ['unit', 'usd']) &&
            typeof v.unit === 'string' &&
            v.unit.length <= 80 &&
            money(v.usd),
        )
        ? { priceCount: Object.keys(r.prices).length }
        : null;
    if (op === 'error.log')
      return exact(r, ['acknowledged']) && r.acknowledged === true ? { acknowledged: true } : null;
    if (op === 'error.count') return exact(r, ['count']) && count(r.count) ? { count: r.count } : null;
    if (op === 'health.read')
      return health(r)
        ? { failingAccountCount: r.failing_accounts.length, staleAccountCount: r.stale_accounts.length }
        : null;
    return null;
  }
  function result(response, prepared) {
    const valid = prepare({
      requestId: prepared?.request?.requestId,
      reconcileRequestId: prepared?.reconcileRequestId,
      operation: prepared?.request?.operation,
      args: prepared?.request?.args,
    });
    const unknown = () => ({
      requestId: valid.request.requestId,
      outcome: 'unknown',
      automaticRetry: false,
      reconciliation: {
        version: 1,
        requestId: valid.reconcileRequestId,
        operation: 'request.status',
        args: { targetRequestId: valid.originalTargetRequestId },
      },
    });
    if (!object(response) || !Number.isInteger(response.statusCode)) return unknown();
    const b = response.body;
    if (
      response.statusCode !== 200 ||
      !exact(b, ['version', 'requestId', 'outcome', 'result', 'window']) ||
      b.version !== 1 ||
      b.requestId !== valid.request.requestId ||
      b.outcome !== 'completed'
    )
      return unknown();
    const w = b.window;
    if (
      !exact(w, [
        'id',
        'startsAt',
        'expiresAt',
        'closed',
        'totalAdmitted',
        'boundAudience',
        'boundCommitSha',
        'boundDeploymentId',
      ]) ||
      w.id !== '76c2ad42-c094-4ba4-9a0b-566e19b97780' ||
      typeof w.closed !== 'boolean' ||
      !count(w.totalAdmitted) ||
      w.totalAdmitted > 100 ||
      !date(w.startsAt) ||
      !date(w.expiresAt) ||
      typeof w.boundAudience !== 'string' ||
      !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(w.boundAudience) ||
      (expectedAudience !== null && w.boundAudience !== expectedAudience) ||
      typeof w.boundCommitSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(w.boundCommitSha) ||
      typeof w.boundDeploymentId !== 'string' ||
      !/^dpl_[A-Za-z0-9]{1,80}$/.test(w.boundDeploymentId) ||
      Date.parse(w.expiresAt) - Date.parse(w.startsAt) !== 1800000
    )
      return unknown();
    let summary;
    if (valid.request.operation === 'request.status') {
      // Status result is authoritative for the original target. It never executes it.
      const matches = operations
        .filter((op) => op !== 'request.status')
        .map((op) => safeResult(op, b.result, {}))
        .filter((v) => v !== null);
      if (matches.length !== 1) return unknown();
      summary = matches[0];
    } else summary = safeResult(valid.request.operation, b.result, valid.request.args);
    if (summary === null || summary === undefined) return unknown();
    return {
      requestId: valid.request.requestId,
      targetRequestId: valid.originalTargetRequestId,
      outcome: 'completed',
      automaticRetry: false,
      ...summary,
      window: { ...w },
    };
  }
  return { prepare, classify: result };
}

/** New owned trial workflow only. Existing foundation/native builders unchanged. */
export function buildWorkerRpcAdapter(config) {
  const fail = () => {
    throw Error('GW01_ADAPTER_CONFIG_INVALID');
  };
  if (!config || Object.keys(config).some((k) => !['audience', 'credential', 'manualInput'].includes(k)))
    fail();
  let origin;
  try {
    origin = new URL(config.audience);
  } catch {
    fail();
  }
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== config.audience ||
    !origin.hostname.startsWith('everyone-market-researcher-') ||
    !origin.hostname.endsWith('.vercel.app') ||
    origin.username ||
    origin.password ||
    origin.port
  )
    fail();
  const c = config.credential;
  if (
    !c ||
    Object.keys(c).length !== 3 ||
    !['id', 'name', 'type'].every((k) => Object.hasOwn(c, k)) ||
    typeof c.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(c.id) ||
    !['M03 GW-01 machine [dev]', 'M03 GW-01 privacy canary [dev]'].includes(c.name) ||
    c.type !== 'httpCustomAuth'
  )
    fail();
  const r = createWorkerAdapterRuntime();
  if (config.manualInput !== undefined) r.prepare(config.manualInput);
  const key = 'GW01',
    factory = `const adapter=(${createWorkerAdapterRuntime.toString()})(${JSON.stringify(origin.origin)});\n`;
  const prep =
    factory +
    `const rows=$input.all();if(rows.length!==1)throw Error('GW01_ADAPTER_INPUT_INVALID');const source=Object.keys(rows[0].json).length?rows[0].json:${JSON.stringify(config.manualInput ?? null)};return[{json:adapter.prepare(source)}];`;
  const classify =
    factory +
    `const rows=$input.all();const response=rows.length===1?rows[0].json:{};return[{json:adapter.classify(response,$('Prepare fixed worker request').first().json)}];`;
  const nodes = [
    node(key, 'Manual trial invocation', 'manualTrigger', {}, [0, 160]),
    trigger(key, [
      ['requestId', 'string'],
      ['reconcileRequestId', 'string'],
      ['operation', 'string'],
      ['args', 'object'],
    ]),
    code(key, 'Prepare fixed worker request', prep, [240, 0]),
    {
      ...node(
        key,
        'Call fixed dev worker',
        'httpRequest',
        {
          method: 'POST',
          url: origin.origin + '/api/internal/n8n/rpc',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpCustomAuth',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ $json.request }}',
          sendHeaders: false,
          sendQuery: false,
          options: {
            timeout: 25000,
            allowUnauthorizedCerts: false,
            redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
            sendCredentialsOnCrossOriginRedirect: false,
            response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
          },
        },
        [480, 0],
      ),
      credentials: { httpCustomAuth: { id: c.id, name: c.name } },
      retryOnFail: false,
      onError: 'continueRegularOutput',
    },
    code(key, 'Project fixed worker receipt', classify, [720, 0]),
  ];
  return {
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    providerCalls: 0,
    networkAttemptsPerInvocation: 1,
    requiresCoordinatedReservation: true,
    workflow: {
      name: 'M03 gateway acceptance [dev]',
      active: false,
      nodes,
      connections: {
        ...line(
          'When called',
          'Prepare fixed worker request',
          'Call fixed dev worker',
          'Project fixed worker receipt',
        ),
        'Manual trial invocation': {
          main: [[{ node: 'Prepare fixed worker request', type: 'main', index: 0 }]],
        },
      },
      settings: {
        executionOrder: 'v1',
        timezone: 'Africa/Cairo',
        executionTimeout: 30,
        saveDataErrorExecution: 'none',
        saveDataSuccessExecution: 'none',
        saveManualExecutions: false,
        saveExecutionProgress: false,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
      },
      pinData: {},
    },
    binding: { credentialType: 'httpCustomAuth', credentialId: c.id, audience: origin.origin },
    sourceNodeId: nodeId(key, 'Call fixed dev worker'),
  };
}
