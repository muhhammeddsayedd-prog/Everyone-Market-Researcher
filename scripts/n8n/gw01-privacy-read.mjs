const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const reject = () => {
  throw Error('GW01_DELIVERY_RESPONSE_REJECTED');
};
const literals = ['GW01_SYNTHETIC_AUTH_CANARY_ONLY', 'GW01_SYNTHETIC_BYPASS_CANARY_ONLY'];
const reflected = (v) =>
  typeof v === 'string'
    ? literals.some((s) => v.includes(s))
    : Array.isArray(v)
      ? v.some(reflected)
      : v && typeof v === 'object'
        ? Object.entries(v).some(([k, n]) => reflected(k) || reflected(n))
        : false;
export function privacyTarget(value) {
  if (
    !exact(value, ['workflowId', 'executionId', 'audience']) ||
    typeof value.workflowId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.workflowId) ||
    typeof value.executionId !== 'string' ||
    !/^[1-9][0-9]{0,31}$/.test(value.executionId) ||
    typeof value.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(value.audience)
  )
    reject();
  return { ...value };
}
export async function readGatewayPrivacy(value, management) {
  const target = privacyTarget(value),
    w = await management('GET', '/api/v1/workflows/' + target.workflowId, null);
  if (
    w.status !== 200 ||
    w.body?.id !== target.workflowId ||
    w.body?.name !== 'M03 gateway acceptance [dev]' ||
    w.body.active !== false ||
    reflected(w.body) ||
    !Array.isArray(w.body.nodes) ||
    w.body.nodes.length < 3 ||
    w.body.nodes.length > 10 ||
    !exact(w.body.pinData ?? {}, [])
  )
    reject();
  const settings = w.body.settings;
  if (
    settings?.saveDataErrorExecution !== 'none' ||
    settings.saveDataSuccessExecution !== 'none' ||
    settings.saveManualExecutions !== false ||
    settings.saveExecutionProgress !== false
  )
    reject();
  const http = w.body.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  if (
    http.length !== 1 ||
    http[0].name !== 'Call fixed dev worker' ||
    typeof http[0].id !== 'string' ||
    !http[0].id ||
    http[0].parameters?.method !== 'POST' ||
    http[0].parameters?.authentication !== 'genericCredentialType' ||
    http[0].parameters?.genericAuthType !== 'httpCustomAuth' ||
    http[0].parameters?.url !== target.audience + '/api/internal/n8n/rpc' ||
    http[0].retryOnFail !== false ||
    !exact(http[0].credentials, ['httpCustomAuth']) ||
    !exact(http[0].credentials.httpCustomAuth, ['id', 'name']) ||
    http[0].credentials.httpCustomAuth.id !== 'EmrGw01Canary18' ||
    http[0].credentials.httpCustomAuth.name !== 'M03 GW-01 privacy canary [dev]'
  )
    reject();
  for (const n of w.body.nodes) if (n !== http[0] && n.credentials !== undefined) reject();
  const e = await management('GET', '/api/v1/executions/' + target.executionId + '?includeData=true', null);
  // A404 proves neither execution nor redaction, even with retention disabled.
  if (e.status === 404)
    return {
      version: 1,
      status: 'execution_unavailable',
      workflowId: target.workflowId,
      executionId: target.executionId,
      exportCanaryVerified: true,
      executionCanaryVerified: false,
      privateDetailsWithheld: true,
    };
  if (
    e.status !== 200 ||
    e.body?.id !== target.executionId ||
    e.body.workflowId !== target.workflowId ||
    !['success', 'error', 'canceled', 'crashed'].includes(e.body.status) ||
    reflected(e.body) ||
    !e.body.data ||
    typeof e.body.data !== 'object' ||
    Array.isArray(e.body.data)
  )
    reject();
  const executed = e.body.workflowData;
  if (
    executed?.settings?.saveDataErrorExecution !== 'none' ||
    executed.settings.saveDataSuccessExecution !== 'none' ||
    executed.settings.saveManualExecutions !== false ||
    executed.settings.saveExecutionProgress !== false
  )
    reject();
  const executedHttp = Array.isArray(executed?.nodes)
    ? executed.nodes.filter((n) => n.id === http[0].id)
    : [];
  const canonical = (v) =>
    Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : v !== null && typeof v === 'object'
        ? '{' +
          Object.keys(v)
            .sort()
            .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
            .join(',') +
          '}'
        : JSON.stringify(v);
  const binding = (n) =>
    Object.fromEntries(
      ['id', 'name', 'type', 'typeVersion', 'parameters', 'credentials', 'retryOnFail', 'onError']
        .filter((k) => Object.hasOwn(n, k))
        .map((k) => [k, n[k]]),
    );
  if (
    executed?.id !== target.workflowId ||
    executedHttp.length !== 1 ||
    canonical(binding(executedHttp[0])) !== canonical(binding(http[0])) ||
    e.body.dataTooLargeToDisplay === true
  )
    reject();
  const tasks = e.body.data.resultData?.runData?.[http[0].name];
  if (!Array.isArray(tasks) || tasks.length !== 1) reject();
  const task = tasks[0],
    rows = task?.data?.main?.[0];
  if (
    !Number.isSafeInteger(task?.startTime) ||
    task.startTime < 0 ||
    typeof task.executionTime !== 'number' ||
    !Number.isFinite(task.executionTime) ||
    task.executionTime < 0 ||
    !Array.isArray(task.source) ||
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !Number.isInteger(rows[0]?.json?.statusCode) ||
    rows[0].json.statusCode < 100 ||
    rows[0].json.statusCode > 599
  )
    reject();
  return {
    version: 1,
    status: 'complete',
    workflowId: target.workflowId,
    executionId: target.executionId,
    exportCanaryVerified: true,
    executionCanaryVerified: true,
    privateDetailsWithheld: true,
  };
}
