/* eslint-disable no-console -- Opt-in synthetic local CLI; no hosted or real credential values. */
if (
  !process.argv.includes('--isolated-local') ||
  !process.argv.includes('--inside') ||
  process.argv.slice(2).some((x) => !['--isolated-local', '--inside', '--policy-only'].includes(x))
)
  throw Error('C01_ISOLATED_LOCAL_REQUIRED');
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
const root = import.meta.dirname;
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json')));
if (manifest.owner !== 'emr-m03-c01-repro-20261019' || manifest.base !== 'http://127.0.0.1:56794')
  throw Error('C01_MANIFEST');
const inside = process.argv.includes('--inside');
const base = inside ? 'http://127.0.0.1:5678' : manifest.base;
const runId = 'valid-' + new Date().toISOString().replaceAll(/[:.]/g, '-');
const receipts = inside ? '/home/node/.n8n/c01-receipts/' + runId : resolve(root, 'receipts', runId);
mkdirSync(receipts, { recursive: true });
const all = [],
  ownGraphs = new Map();
let cookie = '',
  apiKey = '';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function save(name, value) {
  writeFileSync(resolve(receipts, name + '.json'), JSON.stringify(value, null, 2));
}
async function request(path, { method = 'GET', body, publicApi = false, allow = [200] } = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) throw Error('C01_PATH');
  const headers = { 'content-type': 'application/json' };
  if (publicApi) headers['X-N8N-API-KEY'] = apiKey;
  else if (cookie) headers.cookie = cookie;
  const response = await fetch(base + path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  const setCookie = response.headers.getSetCookie();
  if (setCookie.length) cookie = setCookie.map((x) => x.split(';')[0]).join('; ');
  const text = await response.text();
  if (text.length > 4 * 1024 * 1024) throw Error('C01_BODY_CAP');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!allow.includes(response.status)) {
    save('last-local-http-failure', { path, method, status: response.status, data });
    throw Error('C01_HTTP_' + response.status + '_' + path.split('?')[0]);
  }
  return { status: response.status, data };
}
function node(name, type, parameters, extra = {}) {
  return {
    id: randomUUID(),
    name,
    type: 'n8n-nodes-base.' + type,
    typeVersion:
      type === 'executeWorkflow' ? 1.4 : type === 'executeWorkflowTrigger' ? 1.3 : type === 'code' ? 2 : 1,
    position: [0, 0],
    parameters,
    ...extra,
  };
}
function chain(nodes) {
  return Object.fromEntries(
    nodes
      .slice(0, -1)
      .map((n, i) => [n.name, { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] }]),
  );
}
const none = {
  saveManualExecutions: false,
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'none',
  saveExecutionProgress: false,
};
const retainedManual = { ...none, saveManualExecutions: true };
const allRetained = {
  ...none,
  saveManualExecutions: true,
  saveDataSuccessExecution: 'all',
  saveDataErrorExecution: 'all',
};
async function create(name, nodes, settings, connections = chain(nodes)) {
  const body = {
    name: 'C01 synthetic ' + name,
    nodes,
    connections,
    settings: { executionOrder: 'v1', timezone: 'UTC', ...settings },
  };
  const { data } = await request('/api/v1/workflows', {
    method: 'POST',
    publicApi: true,
    body,
    allow: [200, 201],
  });
  if (!data?.id || !data.versionId) throw Error('C01_CREATE');
  ownGraphs.set(data.id, {
    id: data.id,
    versionId: data.versionId,
    name: body.name,
    settings: body.settings,
  });
  save('workflow-' + data.id, data);
  return data;
}
async function child(
  name,
  { failure = false, waitSeconds = 0, waitWebhook = false, settings = none, timeout } = {},
) {
  const nodes = [node('When called', 'executeWorkflowTrigger', { inputSource: 'passthrough' })];
  if (waitWebhook) {
    nodes.push(
      node('Before native webhook wait', 'code', {
        jsCode:
          "return [{json:{resumeUrl:$execution.resumeUrl,transientPayload:'C01_WAITING_PAYLOAD_SENTINEL'}}];",
      }),
    );
    nodes.push(
      node(
        'Native webhook wait',
        'wait',
        { resume: 'webhook', httpMethod: 'GET', responseMode: 'onReceived', options: {} },
        { typeVersion: 1.1, webhookId: randomUUID() },
      ),
    );
  }
  if (waitSeconds)
    nodes.push(
      node(
        'Synthetic child wait',
        'wait',
        { resume: 'timeInterval', amount: waitSeconds, unit: 'seconds' },
        { typeVersion: 1.1, webhookId: randomUUID() },
      ),
    );
  nodes.push(
    node('Synthetic provider fixture', 'code', {
      jsCode: failure
        ? "throw new Error('C01_THROWN_FAILURE_SENTINEL');"
        : "return [{json:{providerPayload:'C01_CHILD_OUTPUT_SENTINEL',childExecutionId:$execution.id}}];",
    }),
  );
  return create(name, nodes, { ...settings, ...(timeout ? { executionTimeout: timeout } : {}) });
}
async function parent(name, target, { settings = none, wait = true, continueError = false } = {}) {
  const nodes = [
    node('Manual fixture', 'manualTrigger', {}),
    node(
      'Call fixed synthetic child',
      'executeWorkflow',
      {
        source: 'database',
        mode: 'once',
        workflowId: { __rl: true, mode: 'id', value: target.id },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {},
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: false,
        },
        options: { waitForSubWorkflow: wait },
      },
      continueError ? { onError: 'continueRegularOutput' } : {},
    ),
    node('Safe final checkpoint', 'code', {
      jsCode: 'return [{json:{safe:true,checkpointOnly:true,rootExecutionId:$execution.id}}];',
    }),
  ];
  return create(name, nodes, settings);
}
async function manual(graph) {
  const { data } = await request('/rest/workflows/' + graph.id + '/run', {
    method: 'POST',
    body: { triggerToStartFrom: { name: 'Manual fixture' } },
  });
  const result = data?.data ?? data;
  if (!/^\d+$/.test(String(result?.executionId))) throw Error('C01_RUN');
  return String(result.executionId);
}
function inspect(graphs) {
  const r = spawnSync(
    inside ? 'node' : 'docker',
    [
      ...(inside ? [] : ['exec', manifest.name, 'node']),
      '/c01-repro/c01-inspect-db.mjs',
      '--isolated-local',
      ...graphs.map((g) => 'workflow:' + g.id),
    ],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    save('last-local-inspect-failure', { status: r.status, stderr: r.stderr });
    throw Error('C01_INSPECT');
  }
  return JSON.parse(r.stdout);
}
async function publicMetadata(id, includeData = false) {
  return request('/api/v1/executions/' + id + '?includeData=' + includeData, {
    publicApi: true,
    allow: [200, 404],
  });
}
async function finish(name, rootGraph, childGraph, executionId, timeoutMs = 15000) {
  const began = Date.now();
  let snapshot;
  do {
    await delay(200);
    snapshot = inspect([rootGraph, childGraph]);
    const active = snapshot.entities.some(
      (e) => !e.deletedAt && ['new', 'running', 'waiting'].includes(e.status),
    );
    if (!active) break;
  } while (Date.now() - began < timeoutMs);
  const metadata = await publicMetadata(executionId),
    raw = await publicMetadata(executionId, true);
  save(name, {
    source: 'actual-local-n8n-2.43.5',
    mode: 'local internal REST manual, not Cloud control proof',
    root: ownGraphs.get(rootGraph.id),
    child: ownGraphs.get(childGraph.id),
    executionId,
    metadata,
    raw,
    snapshot,
  });
  const rootData = snapshot.data.find((r) => String(r.executionId) === executionId)?.decodedData;
  // Exclude workflowData/source code: its fixture string literals are not
  // evidence that a node output or error was retained at runtime.
  const text = JSON.stringify(rootData?.resultData ?? null);
  const result = {
    name,
    executionId,
    publicStatus: metadata.status,
    rootStatus: snapshot.entities.find((e) => String(e.id) === executionId)?.status ?? null,
    entities: snapshot.entities.map((e) => ({ ...e })),
    childOutputStored: text.includes('C01_CHILD_OUTPUT_SENTINEL'),
    failureStored: text.includes('C01_THROWN_FAILURE_SENTINEL'),
    finalCheckpointStored: text.includes('checkpointOnly'),
    runtimeDataDecoded: rootData !== undefined,
    dataRows: snapshot.data.length,
    rawPublicStatus: raw.status,
  };
  all.push(result);
  console.log(JSON.stringify(result));
  return { ...result, snapshot };
}
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + '/healthz', { signal: AbortSignal.timeout(2000) })).status === 200) break;
    } catch {
      /* own startup only */
    }
    if (i === 79) throw Error('C01_STARTUP');
    await delay(1000);
  }
  const setup = await request('/rest/owner/setup', {
    method: 'POST',
    body: {
      email: 'c01-repro@example.invalid',
      password: 'C01_SYNTHETIC_ONLY_2026',
      firstName: 'C01',
      lastName: 'Synthetic',
    },
    allow: [200, 400],
  });
  if (setup.status === 400)
    await request('/rest/login', {
      method: 'POST',
      body: { emailOrLdapLoginId: 'c01-repro@example.invalid', password: 'C01_SYNTHETIC_ONLY_2026' },
    });
  const availableResponse = await request('/rest/api-keys/scopes');
  const availableScopes = availableResponse.data?.data ?? availableResponse.data;
  save('local-supported-api-scopes', availableScopes);
  const allowedScopes = [
    'workflow:create',
    'workflow:read',
    'workflow:list',
    'workflow:update',
    'workflow:publish',
    'workflow:unpublish',
    'workflow:activate',
    'workflow:deactivate',
    'execution:read',
    'execution:list',
  ];
  const available = Array.isArray(availableScopes)
    ? availableScopes.map((x) => (typeof x === 'string' ? x : (x.value ?? x.name)))
    : [];
  const scopes = allowedScopes.filter((s) => available.includes(s));
  if (!scopes.includes('workflow:create') || !scopes.includes('execution:read')) throw Error('C01_SCOPES');
  const key = await request('/rest/api-keys', {
    method: 'POST',
    body: { label: 'C01 synthetic ' + randomUUID(), scopes, expiresAt: null },
  });
  apiKey = (key.data?.data ?? key.data)?.rawApiKey;
  if (!apiKey) throw Error('C01_SYNTHETIC_KEY');
  if (process.argv.includes('--policy-only')) {
    const cs = await child('proposal retained successful child', { settings: allRetained });
    const ps = await parent('proposal retained successful parent', cs, { settings: retainedManual });
    await finish('proposal-success-pair', ps, cs, await manual(ps));
    const ce = await child('proposal retained failed child', { settings: allRetained, failure: true });
    const pe = await parent('proposal retained failed parent', ce, { settings: retainedManual });
    await finish('proposal-error-pair', pe, ce, await manual(pe));
    const cw = await child('proposal retained wait child', { settings: allRetained, waitWebhook: true });
    const pw = await parent('proposal retained wait parent', cw, { settings: retainedManual });
    const waitId = await manual(pw);
    let waiting;
    for (let i = 0; i < 25; i++) {
      await delay(200);
      waiting = inspect([pw, cw]);
      if (waiting.entities.some((e) => e.workflowId === cw.id && e.status === 'waiting')) break;
    }
    const waitingChild = waiting.entities.find((e) => e.workflowId === cw.id && e.status === 'waiting');
    const wd = waiting.data.find((d) => String(d.executionId) === String(waitingChild?.id))?.decodedData;
    const nativeUrl =
      wd?.resultData?.runData?.['Before native webhook wait']?.[0]?.data?.main?.[0]?.[0]?.json?.resumeUrl;
    if (!nativeUrl) throw Error('C01_POLICY_WAIT');
    const resume = new URL(nativeUrl);
    if (
      !['localhost', '127.0.0.1'].includes(resume.hostname) ||
      resume.port !== '5678' ||
      !/^\/webhook-waiting\/\d+$/.test(resume.pathname)
    )
      throw Error('C01_RESUME_ORIGIN');
    save('proposal-waiting-intermediate', {
      executionId: waitId,
      snapshot: waiting,
      metadata: await publicMetadata(waitId, true),
    });
    await request(resume.pathname + resume.search);
    await finish('proposal-wait-resume-pair', pw, cw, waitId);
    const handler = await create(
      'proposal automatic Error Trigger handler',
      [
        node('Native Error Trigger', 'errorTrigger', {}),
        node('Safe handler checkpoint', 'code', {
          jsCode: 'return [{json:{safe:true,checkpointOnly:true,handlerExecutionId:$execution.id}}];',
        }),
      ],
      allRetained,
    );
    await request('/api/v1/workflows/' + handler.id + '/publish', {
      method: 'POST',
      publicApi: true,
      body: { versionId: handler.versionId },
    });
    const path = 'c01-auto-error-' + randomUUID();
    const automatic = await create(
      'proposal automatic webhook failure',
      [
        node(
          'Native webhook',
          'webhook',
          { httpMethod: 'POST', path, responseMode: 'onReceived', options: {} },
          { typeVersion: 2.1, webhookId: randomUUID() },
        ),
        node('Synthetic automatic failure', 'code', {
          jsCode: "throw new Error('C01_AUTOMATIC_FAILURE_SENTINEL');",
        }),
      ],
      { ...allRetained, saveManualExecutions: false, errorWorkflow: handler.id },
    );
    await request('/api/v1/workflows/' + automatic.id + '/publish', {
      method: 'POST',
      publicApi: true,
      body: { versionId: automatic.versionId },
    });
    await request('/webhook/' + path, { method: 'POST', body: { synthetic: true } });
    await delay(500);
    const auto = inspect([automatic, handler]);
    const autoId = auto.entities.find((e) => e.workflowId === automatic.id)?.id;
    if (!autoId) throw Error('C01_AUTO_ROOT');
    await finish('proposal-automatic-error-child', automatic, handler, String(autoId));
    save('summary', {
      manifest,
      runId,
      graphs: [...ownGraphs.values()],
      cases: all,
      hostedAcceptance: false,
      credentials: 'synthetic only, never printed or exported',
    });
    console.log(
      JSON.stringify({
        status: 'C01_LOCAL_POLICY_CASES_COMPLETE',
        runId,
        cases: all.length,
        hostedAcceptance: false,
      }),
    );
    process.exit(0);
  }
  const c1 = await child('none child', { waitSeconds: 1 });
  const p1 = await parent('none parent', c1);
  const id1 = await manual(p1);
  save('none-inflight', {
    executionId: id1,
    snapshot: inspect([p1, c1]),
    metadata: await publicMetadata(id1),
  });
  await finish('none-success', p1, c1, id1);
  const c2 = await child('retained-wrapper child none');
  const p2 = await parent('retained manual wrapper', c2, { settings: retainedManual });
  const id2 = await manual(p2);
  await finish('manual-retention-output', p2, c2, id2);
  const c3 = await child('failure child none', { failure: true });
  const p3 = await parent('retained sanitized wrapper catches error', c3, {
    settings: retainedManual,
    continueError: true,
  });
  const id3 = await manual(p3);
  await finish('manual-retention-caught-failure', p3, c3, id3);
  const p4 = await parent('retained uncaught failure', c3, { settings: retainedManual });
  const id4 = await manual(p4);
  await finish('manual-retention-uncaught-failure', p4, c3, id4);
  const c5 = await child('detached child retained synthetic', { waitSeconds: 4, settings: allRetained });
  const p5 = await parent('detached retained wrapper', c5, { settings: retainedManual, wait: false });
  const id5 = await manual(p5);
  await delay(500);
  save('detached-intermediate', {
    executionId: id5,
    snapshot: inspect([p5, c5]),
    metadata: await publicMetadata(id5, true),
  });
  await finish('detached-final', p5, c5, id5);
  const c6 = await child('timeout retained synthetic', {
    waitSeconds: 10,
    settings: allRetained,
    timeout: 1,
  });
  const p6 = await parent('timeout retained wrapper', c6, {
    settings: { ...retainedManual, executionTimeout: 1 },
  });
  const id6 = await manual(p6);
  await finish('timeout-final', p6, c6, id6, 15000);
  const repeated = await manual(p2);
  if (repeated === id2) throw Error('C01_NATIVE_ID_REUSED');
  await finish('same-workflow-second-native-id', p2, c2, repeated);
  save('reused-id', {
    firstId: id2,
    secondId: repeated,
    different: id2 !== repeated,
    oldMetadata: await publicMetadata(id2),
    newMetadata: await publicMetadata(repeated),
  });
  const cw = await child('none child native wait resume', { waitWebhook: true });
  const pw = await parent('retained parent native wait resume', cw, { settings: retainedManual });
  const waitId = await manual(pw);
  let waiting;
  for (let i = 0; i < 25; i++) {
    await delay(200);
    waiting = inspect([pw, cw]);
    if (waiting.entities.some((e) => e.workflowId === cw.id && e.status === 'waiting')) break;
  }
  const waitChild = waiting.entities.find((e) => e.workflowId === cw.id && e.status === 'waiting');
  if (!waitChild) throw Error('C01_WAIT_UNOBSERVED');
  const childData = waiting.data.find((d) => String(d.executionId) === String(waitChild.id))?.decodedData;
  const resumeUrl =
    childData?.resultData?.runData?.['Before native webhook wait']?.[0]?.data?.main?.[0]?.[0]?.json
      ?.resumeUrl;
  if (typeof resumeUrl !== 'string') throw Error('C01_RESUME_URL');
  const resume = new URL(resumeUrl);
  if (
    !['localhost', '127.0.0.1'].includes(resume.hostname) ||
    resume.port !== '5678' ||
    !/^\/webhook-waiting\/\d+$/.test(resume.pathname)
  )
    throw Error('C01_RESUME_ORIGIN');
  save('waiting-intermediate', {
    executionId: waitId,
    snapshot: waiting,
    metadata: await publicMetadata(waitId, true),
  });
  await request(resume.pathname + resume.search);
  await finish('wait-resume-final', pw, cw, waitId, 15000);
  save('summary', {
    manifest,
    graphs: [...ownGraphs.values()],
    cases: all,
    hostedAcceptance: false,
    credentials: 'synthetic only, never printed or exported',
  });
  console.log(
    JSON.stringify({
      status: 'C01_LOCAL_INITIAL_CASES_COMPLETE',
      runId,
      cases: all.length,
      hostedAcceptance: false,
    }),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      status: 'C01_LOCAL_BLOCKED',
      fixedError: /^C01_[A-Za-z0-9_/.-]+$/.test(e.message) ? e.message : 'C01_UNCLASSIFIED',
      casesCompleted: all.length,
    }),
  );
  process.exitCode = 1;
}
