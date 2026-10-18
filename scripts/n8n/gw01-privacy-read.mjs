const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
export const privacyFailureStages = Object.freeze([
  'target',
  'current_workflow_http',
  'current_workflow_identity',
  'current_workflow_state',
  'current_workflow_shape',
  'current_workflow_canary_reflection',
  'current_settings',
  'current_http_node',
  'current_credential',
  'current_other_credentials',
  'execution_http',
  'execution_envelope',
  'execution_status',
  'execution_canary_reflection',
  'execution_data',
  'executed_settings',
  'executed_snapshot_workflow_id',
  'executed_snapshot_http_id_count',
  'executed_snapshot_name',
  'executed_snapshot_type',
  'executed_snapshot_type_version',
  'executed_snapshot_parameters',
  'executed_snapshot_credentials',
  'executed_snapshot_retry_on_fail',
  'executed_snapshot_on_error',
  'executed_graph_match',
  'native_http_task',
  'native_http_status',
  'management_reflection',
]);
export const safePrivacyStage = (error) =>
  privacyFailureStages.includes(error?.privacyStage) ? error.privacyStage : null;
export const privacyParameterPaths = Object.freeze([
  'method',
  'url',
  'authentication',
  'genericAuthType',
  'sendBody',
  'specifyBody',
  'jsonBody',
  'options.allowUnauthorizedCerts',
  'options.redirect.redirect.followRedirects',
  'options.response.response.fullResponse',
  'options.response.response.neverError',
  'options.response.response.responseFormat',
  'options.timeout',
  'options.sendCredentialsOnCrossOriginRedirect',
  'parameters_other',
]);
// n8n@2.43.5 declared defaults, diagnostic only. Array/collection contents are
// opaque fixed containers; no runtime header/query name or index is a path ID.
export const privacyNativeSchema = Object.freeze({
  manual: { type: 'n8n-nodes-base.manualTrigger', defaults: { notice: '' } },
  http: {
    type: 'n8n-nodes-base.httpRequest',
    defaults: {
      curlImport: '',
      method: 'GET',
      url: '',
      authentication: 'none',
      nodeCredentialType: '',
      googleApiWarning: '',
      genericAuthType: '',
      provideSslCertificates: false,
      provideSslCertificatesNotice: '',
      sslCertificate: '',
      sendQuery: false,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: '', value: '' }] },
      jsonQuery: '',
      sendHeaders: false,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: '', value: '' }] },
      jsonHeaders: '',
      sendBody: false,
      contentType: 'json',
      specifyBody: 'keypair',
      bodyParameters: { parameters: [{ name: '', value: '' }] },
      jsonBody: '',
      body: '',
      inputDataFieldName: '',
      rawContentType: '',
      'options.batching': { batch: {} },
      'options.allowUnauthorizedCerts': false,
      'options.queryParameterArrays': 'brackets',
      'options.lowercaseHeaders': true,
      'options.redirect': { redirect: {} },
      'options.response': { response: {} },
      'options.pagination': { pagination: {} },
      'options.proxy': '',
      'options.timeout': 10000,
      'options.sendCredentialsOnCrossOriginRedirect': false,
      'options.webdavMethods': false,
      infoMessage: '',
      optimizeResponse: false,
      responseType: 'json',
      dataField: '',
      fieldsToInclude: 'all',
      fields: '',
      cssSelector: 'body',
      onlyContent: false,
      elementsToOmit: '',
      truncateResponse: false,
      maxLength: 1000,
    },
  },
  receipt: {
    type: 'n8n-nodes-base.set',
    defaults: {
      mode: 'manual',
      duplicateItem: false,
      duplicateCount: 0,
      duplicateWarning: '',
      jsonOutput: '{\n  "my_field_1": "value",\n  "my_field_2": 1\n}\n',
      fields: {},
      assignments: {},
      include: 'all',
      includeOtherFields: false,
      includeFields: '',
      excludeFields: '',
      options: {},
      'options.includeBinary': true,
      'options.stripBinary': true,
      'options.ignoreConversionErrors': false,
      'options.dotNotation': true,
    },
  },
});
const nativeSchemaValid = (value) =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((row, index) => {
    const node = Object.keys(privacyNativeSchema)[index],
      paths = Object.keys(privacyNativeSchema[node].defaults);
    return (
      exact(row, ['node', 'identityMatched', 'differences', 'unclassifiedDifference']) &&
      row.node === node &&
      typeof row.identityMatched === 'boolean' &&
      typeof row.unclassifiedDifference === 'boolean' &&
      Array.isArray(row.differences) &&
      row.differences.length <= paths.length &&
      new Set(row.differences.map((d) => d?.path)).size === row.differences.length &&
      row.differences.every(
        (d) =>
          exact(d, [
            'path',
            'currentPresent',
            'executedPresent',
            'currentDefaultEqual',
            'executedDefaultEqual',
          ]) &&
          paths.includes(d.path) &&
          typeof d.currentPresent === 'boolean' &&
          typeof d.executedPresent === 'boolean' &&
          (d.currentPresent ? typeof d.currentDefaultEqual === 'boolean' : d.currentDefaultEqual === null) &&
          (d.executedPresent ? typeof d.executedDefaultEqual === 'boolean' : d.executedDefaultEqual === null),
      )
    );
  });
export function safePrivacyParameterDiagnostic(error) {
  const d = error?.privacyParameterDiagnostic;
  if (
    safePrivacyStage(error) !== 'executed_snapshot_parameters' ||
    !exact(d, ['paths', 'jsonBodyTextDifferent', 'jsonBodySemanticEqual', 'nativeSchema']) ||
    !Array.isArray(d.paths) ||
    d.paths.length < 1 ||
    d.paths.length > privacyParameterPaths.length ||
    new Set(d.paths).size !== d.paths.length ||
    d.paths.some((p) => !privacyParameterPaths.includes(p)) ||
    typeof d.jsonBodyTextDifferent !== 'boolean' ||
    (d.jsonBodySemanticEqual !== null && typeof d.jsonBodySemanticEqual !== 'boolean') ||
    !nativeSchemaValid(d.nativeSchema)
  )
    return null;
  return {
    paths: [...d.paths],
    jsonBodyTextDifferent: d.jsonBodyTextDifferent,
    jsonBodySemanticEqual: d.jsonBodySemanticEqual,
    nativeSchema: structuredClone(d.nativeSchema),
  };
}
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
// Only observed root additions plus the source-defined text/file output field.
// This clones both representations; every existing key/value remains exact.
function runtimeRepresentation(node) {
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!object(node)) return node;
  const defaults =
    node.type === 'n8n-nodes-base.manualTrigger' && node.typeVersion === 1
      ? { notice: '' }
      : node.type === 'n8n-nodes-base.httpRequest' && node.typeVersion === 4.5
        ? {
            curlImport: '',
            provideSslCertificates: false,
            sendQuery: false,
            sendHeaders: false,
            ...(node.parameters?.sendBody === true ? { contentType: 'json' } : {}),
            infoMessage: '',
          }
        : node.type === 'n8n-nodes-base.set' && node.typeVersion === 3.4
          ? {
              mode: 'manual',
              ...(!Object.hasOwn(node.parameters ?? {}, 'mode') || node.parameters?.mode === 'manual'
                ? { duplicateItem: false, includeOtherFields: false }
                : {}),
            }
          : null;
  if (defaults === null || !object(node.parameters)) return node;
  const parameters = { ...node.parameters };
  for (const [key, value] of Object.entries(defaults))
    if (!Object.hasOwn(parameters, key)) parameters[key] = value;
  const response = parameters.options?.response?.response;
  if (
    node.type === 'n8n-nodes-base.httpRequest' &&
    node.typeVersion === 4.5 &&
    object(parameters.options) &&
    object(parameters.options.response) &&
    object(response) &&
    ['text', 'file'].includes(response.responseFormat) &&
    !Object.hasOwn(response, 'outputPropertyName')
  )
    parameters.options = {
      ...parameters.options,
      response: { ...parameters.options.response, response: { ...response, outputPropertyName: 'data' } },
    };
  return { ...node, parameters };
}
const at = (v, parts) => {
  for (const p of parts) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, p)) return { present: false };
    v = v[p];
  }
  return { present: true, value: v };
};
function unknownPaths(v, known) {
  const tree = {};
  for (const path of known) {
    const parts = path.split('.');
    let t = tree;
    for (const p of parts.slice(0, -1)) {
      if (t[p] === true) {
        t = null;
        break;
      }
      t = t[p] ??= {};
    }
    if (t !== null) t[parts.at(-1)] = true;
  }
  const unknown = (v, t) => {
    if (t === true) return undefined;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    const out = Object.create(null);
    for (const k of Object.keys(v)) {
      const value = Object.hasOwn(t, k) ? unknown(v[k], t[k]) : v[k];
      if (value !== undefined) out[k] = value;
    }
    return Object.keys(out).length ? out : undefined;
  };
  return unknown(v, tree);
}
function nativeSchemaDiagnostic(currentNodes, executedNodes) {
  return Object.entries(privacyNativeSchema).map(([node, schema]) => {
    const c = currentNodes.filter((n) => n?.type === schema.type),
      e =
        Array.isArray(executedNodes) && c.length === 1
          ? executedNodes.filter((n) => n?.id === c[0].id && n?.type === schema.type)
          : [];
    if (c.length !== 1 || e.length !== 1 || typeof c[0].id !== 'string')
      return { node, identityMatched: false, differences: [], unclassifiedDifference: true };
    const a = c[0].parameters,
      b = e[0].parameters,
      known = Object.keys(schema.defaults),
      differences = [];
    for (const path of known) {
      const left = at(a, path.split('.')),
        right = at(b, path.split('.'));
      if (canonical(left) !== canonical(right))
        differences.push({
          path,
          currentPresent: left.present,
          executedPresent: right.present,
          currentDefaultEqual: left.present
            ? canonical(left.value) === canonical(schema.defaults[path])
            : null,
          executedDefaultEqual: right.present
            ? canonical(right.value) === canonical(schema.defaults[path])
            : null,
        });
    }
    return {
      node,
      identityMatched: true,
      differences,
      unclassifiedDifference: canonical(unknownPaths(a, known)) !== canonical(unknownPaths(b, known)),
    };
  });
}
function parameterDiagnostic(current, executed, currentNodes, executedNodes) {
  const known = privacyParameterPaths.slice(0, -1);
  const paths = known.filter(
    (path) => canonical(at(current, path.split('.'))) !== canonical(at(executed, path.split('.'))),
  );
  if (
    canonical(unknownPaths(current, known)) !== canonical(unknownPaths(executed, known)) ||
    paths.length === 0
  )
    paths.push('parameters_other');
  const a = at(current, ['jsonBody']).value,
    b = at(executed, ['jsonBody']).value;
  let jsonBodySemanticEqual = null;
  if (typeof a === 'string' && typeof b === 'string') {
    try {
      jsonBodySemanticEqual = canonical(JSON.parse(a)) === canonical(JSON.parse(b));
    } catch {
      /* An unparsable body stays unverified; no text is retained. */
    }
  }
  return {
    paths,
    jsonBodyTextDifferent: typeof a === 'string' && typeof b === 'string' && a !== b,
    jsonBodySemanticEqual,
    nativeSchema: nativeSchemaDiagnostic(currentNodes, executedNodes),
  };
}
const reject = (stage, diagnostic = null) => {
  const error = Error('GW01_DELIVERY_RESPONSE_REJECTED');
  error.privacyStage = privacyFailureStages.includes(stage) ? stage : 'target';
  if (diagnostic !== null) error.privacyParameterDiagnostic = diagnostic;
  throw error;
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
    reject('target');
  return { ...value };
}
export async function readGatewayPrivacy(value, management) {
  return readPrivacy(value, management, false);
}
export async function readRetainedGatewayCanary(value, management) {
  return readPrivacy(value, management, true);
}
async function readPrivacy(value, management, retainedSyntheticCanary) {
  async function read(path, stage) {
    try {
      return await management('GET', path, null);
    } catch (error) {
      if (error !== null && typeof error === 'object') {
        if (safePrivacyStage(error) === null) error.privacyStage = stage;
        throw error;
      }
      reject(stage);
    }
  }
  const target = privacyTarget(value),
    w = await read('/api/v1/workflows/' + target.workflowId, 'current_workflow_http');
  if (w?.status !== 200) reject('current_workflow_http');
  if (w.body?.id !== target.workflowId || w.body?.name !== 'M03 gateway acceptance [dev]')
    reject('current_workflow_identity');
  if (w.body.active !== false) reject('current_workflow_state');
  if (reflected(w.body)) reject('current_workflow_canary_reflection');
  if (
    !Array.isArray(w.body.nodes) ||
    w.body.nodes.some((n) => n === null || typeof n !== 'object' || Array.isArray(n)) ||
    w.body.nodes.length < 3 ||
    w.body.nodes.length > 10 ||
    !exact(w.body.pinData ?? {}, [])
  )
    reject('current_workflow_shape');
  const settings = w.body.settings;
  if (
    settings?.saveDataErrorExecution !== 'none' ||
    settings.saveDataSuccessExecution !== 'none' ||
    settings.saveManualExecutions !== false ||
    settings.saveExecutionProgress !== false
  )
    reject('current_settings');
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
    http[0].retryOnFail !== false
  )
    reject('current_http_node');
  if (
    !exact(http[0].credentials, ['httpCustomAuth']) ||
    !exact(http[0].credentials.httpCustomAuth, ['id', 'name']) ||
    http[0].credentials.httpCustomAuth.id !== 'EmrGw01Canary18' ||
    http[0].credentials.httpCustomAuth.name !== 'M03 GW-01 privacy canary [dev]'
  )
    reject('current_credential');
  for (const n of w.body.nodes)
    if (n !== http[0] && n.credentials !== undefined) reject('current_other_credentials');
  const e = await read('/api/v1/executions/' + target.executionId + '?includeData=true', 'execution_http');
  // A404 proves neither execution nor redaction, even with retention disabled.
  if (e?.status === 404)
    return {
      version: 1,
      status: 'execution_unavailable',
      workflowId: target.workflowId,
      executionId: target.executionId,
      exportCanaryVerified: true,
      executionCanaryVerified: false,
      httpStatusCode: null,
      privateDetailsWithheld: true,
    };
  if (e?.status !== 200) reject('execution_http');
  if (e.body?.id !== target.executionId || e.body.workflowId !== target.workflowId)
    reject('execution_envelope');
  if (!['success', 'error', 'canceled', 'crashed'].includes(e.body.status)) reject('execution_status');
  if (reflected(e.body)) reject('execution_canary_reflection');
  if (
    !e.body.data ||
    typeof e.body.data !== 'object' ||
    Array.isArray(e.body.data) ||
    e.body.dataTooLargeToDisplay === true
  )
    reject('execution_data');
  const executed = e.body.workflowData;
  if (
    executed?.settings?.saveDataErrorExecution !== (retainedSyntheticCanary ? 'all' : 'none') ||
    executed.settings.saveDataSuccessExecution !== (retainedSyntheticCanary ? 'all' : 'none') ||
    executed.settings.saveManualExecutions !== retainedSyntheticCanary ||
    executed.settings.saveExecutionProgress !== false
  )
    reject('executed_settings');
  const executedHttp = Array.isArray(executed?.nodes)
    ? executed.nodes.filter((n) => n !== null && typeof n === 'object' && n.id === http[0].id)
    : [];
  if (executed?.id !== target.workflowId) reject('executed_snapshot_workflow_id');
  if (executedHttp.length !== 1 || !Object.hasOwn(executedHttp[0], 'id'))
    reject('executed_snapshot_http_id_count');
  const expectedHttp = runtimeRepresentation(http[0]),
    representedHttp = runtimeRepresentation(executedHttp[0]);
  for (const [key, stage] of [
    ['name', 'executed_snapshot_name'],
    ['type', 'executed_snapshot_type'],
    ['typeVersion', 'executed_snapshot_type_version'],
    ['parameters', 'executed_snapshot_parameters'],
    ['credentials', 'executed_snapshot_credentials'],
    ['retryOnFail', 'executed_snapshot_retry_on_fail'],
    ['onError', 'executed_snapshot_on_error'],
  ])
    if (
      Object.hasOwn(executedHttp[0], key) !== Object.hasOwn(http[0], key) ||
      canonical(representedHttp[key]) !== canonical(expectedHttp[key])
    )
      reject(
        stage,
        key === 'parameters'
          ? parameterDiagnostic(http[0][key], executedHttp[0][key], w.body.nodes, executed.nodes)
          : null,
      );
  if (
    canonical(executed.nodes.map(runtimeRepresentation)) !==
      canonical(w.body.nodes.map(runtimeRepresentation)) ||
    canonical(executed.connections ?? {}) !== canonical(w.body.connections ?? {})
  )
    reject('executed_graph_match');
  const tasks = e.body.data.resultData?.runData?.[http[0].name];
  if (!Array.isArray(tasks) || tasks.length !== 1) reject('native_http_task');
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
    rows.length !== 1
  )
    reject('native_http_task');
  if (
    !Number.isInteger(rows[0]?.json?.statusCode) ||
    rows[0].json.statusCode < 100 ||
    rows[0].json.statusCode > 599
  )
    reject('native_http_status');
  return {
    version: 1,
    status: 'complete',
    workflowId: target.workflowId,
    executionId: target.executionId,
    exportCanaryVerified: true,
    executionCanaryVerified: true,
    httpStatusCode: rows[0].json.statusCode,
    privateDetailsWithheld: true,
  };
}
