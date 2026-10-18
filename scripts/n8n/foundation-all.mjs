import { foundationScope, shellSpecs, parseLedger, runShellProvision } from './foundation-provision.mjs';
import {
  parseFoundationPacket,
  provisionTags,
  provisionMachine,
  bindOwnedGraphs,
  graphBody,
  machineBody,
} from './foundation-bind.mjs';
import { buildFoundationGatewayWorkflows } from '../../n8n/foundation/build-foundation-gateway.mjs';
const fail = () => {
  throw Error('FOUNDATION_ALL_BLOCKED');
};
export const foundationAllMaximum = Object.freeze({
  requests: 185,
  shellCreates: 25,
  tagCreates: 13,
  credentialCreates: 1,
  graphPuts: 25,
  tagPuts: 25,
  executions: 0,
});
export async function runAllProvision(secrets, packet, baseBindings, ports) {
  parseFoundationPacket(packet);
  if (
    !secrets ||
    Object.keys(secrets).sort().join(',') !== 'machine,management' ||
    typeof secrets.management !== 'string' ||
    !secrets.management ||
    secrets.management.length > 4096 ||
    /[^\x21-\x7e]/.test(secrets.management)
  )
    fail();
  const credentialBody = machineBody(packet, secrets.machine);
  const receipt = {
    version: 1,
    windowId: foundationScope.windowId,
    environment: 'dev',
    host: foundationScope.host,
    projectId: foundationScope.projectId,
    status: 'blocked',
    phase: 'shells',
    requestCount: 0,
    maximumRequests: 185,
    workflows: [],
    bindings: null,
    transport: null,
    executionCount: 0,
    credentialsCreated: 0,
    gatewayWindowStarted: false,
    finalGraphsBound: false,
    networkCompletionVerified: false,
    diagnostics: { lastMethod: null, lastResource: null, httpStatus: null, transportCode: null },
  };
  const context = ports.context;
  if (
    !context ||
    !(context.knownTagIds instanceof Set) ||
    !(context.workflowBodies instanceof Map) ||
    !(context.workflowTagBodies instanceof Map) ||
    JSON.stringify(context.machineBody) !== JSON.stringify(credentialBody)
  )
    fail();
  const send = async (m, p, b = null) => {
    if (++receipt.requestCount > 185) fail();
    receipt.diagnostics = {
      lastMethod: m,
      lastResource: p.includes('/credentials/schema/')
        ? 'credential_schema'
        : p.startsWith('/api/v1/credentials')
          ? 'owned_credential'
          : p.startsWith('/api/v1/tags')
            ? 'tags'
            : p.startsWith('/api/v1/projects')
              ? 'projects'
              : 'owned_workflows',
      httpStatus: null,
      transportCode: null,
    };
    let r;
    try {
      r = await ports.send(m, p, b, secrets.management);
    } catch (error) {
      receipt.diagnostics.transportCode =
        typeof error?.message === 'string' &&
        /^FOUNDATION_(?:TRANSPORT_(?:DNS|CLOSE|TLS|STATUS|BODY|PARSE|DEADLINE)|REQUEST_REJECTED)$/.test(
          error.message,
        )
          ? error.message
          : 'unclassified';
      throw Error('FOUNDATION_REQUEST_FAILED');
    }
    if (Number.isInteger(r?.status) && r.status >= 100 && r.status <= 599)
      receipt.diagnostics.httpStatus = r.status;
    const candidates =
      m === 'GET' && p.startsWith('/api/v1/tags?')
        ? r.body?.data
        : m === 'POST' && p === '/api/v1/tags'
          ? [r.body]
          : [];
    if (Array.isArray(candidates))
      for (const x of candidates)
        if (
          x &&
          typeof x.id === 'string' &&
          /^[A-Za-z0-9_-]{1,128}$/.test(x.id) &&
          typeof x.name === 'string' &&
          ports.tagNames.includes(x.name) &&
          !x.id.includes(secrets.management) &&
          !x.id.includes(secrets.machine)
        )
          context.knownTagIds.add(x.id);
    return r;
  };
  try {
    let states = parseLedger(ports.shellJournal.rows);
    if (states.size !== 25 || [...states.values()].some((x) => !x.verified)) {
      const shells = await runShellProvision(secrets.management, ports.shellJournal, send);
      if (shells.status !== 'shells_verified') fail();
      states = parseLedger(ports.shellJournal.rows);
    } else {
      const p = await send('GET', '/api/v1/projects?limit=100');
      if (
        p.status !== 200 ||
        !Array.isArray(p.body?.data) ||
        !p.body.data.some((x) => x.id === foundationScope.projectId && x.type === 'personal')
      )
        fail();
    }
    const workflowRefs = Object.fromEntries(
      shellSpecs.map((s) => {
        const row = states.get(s.key);
        if (!row?.verified || !row.id) fail();
        return [s.key, { id: row.id, name: s.name }];
      }),
    );
    receipt.phase = 'tags';
    const tagRefs = await provisionTags(ports.bindingJournal, send);
    if (
      JSON.stringify(tagRefs).includes(secrets.management) ||
      JSON.stringify(tagRefs).includes(secrets.machine)
    )
      fail();
    receipt.phase = 'machine';
    const credential = await provisionMachine(packet, secrets.machine, ports.bindingJournal, send);
    receipt.credentialsCreated = ports.bindingJournal.rows.some((x) => x.event === 'machine_intent') ? 1 : 0;
    const bindings = { ...structuredClone(baseBindings), workflowRefs, tagRefs };
    const transport = {
      audience: packet.audience,
      windowId: packet.windowId,
      credential: { id: credential.id, name: credential.name, type: credential.type },
    };
    const graphs = (ports.buildGraphs ?? buildFoundationGatewayWorkflows)(bindings, transport, {
      launchEnabled: false,
    });
    if (
      !Array.isArray(graphs) ||
      graphs.length !== 25 ||
      graphs.some((g) => !Object.hasOwn(workflowRefs, g.key))
    )
      fail();
    for (const g of graphs) {
      const id = workflowRefs[g.key].id,
        body = graphBody(g);
      if (Buffer.byteLength(JSON.stringify(body)) > 480000) fail();
      context.workflowBodies.set(id, body);
      context.workflowTagBodies.set(
        id,
        g.workflow.tags.map((x) => ({ id: x.id })),
      );
    }
    receipt.phase = 'binding';
    receipt.workflows = await bindOwnedGraphs(graphs, workflowRefs, ports.bindingJournal, send);
    receipt.bindings = bindings;
    receipt.transport = transport;
    receipt.finalGraphsBound = true;
    receipt.networkCompletionVerified = true;
    receipt.status = 'inactive_foundation_verified';
    receipt.phase = 'complete';
  } catch {
    // A fixed phase, durable intent and typed safe projections preserve ambiguity.
    // Never return a native error, raw response, credential body or input secret.
  }
  if (
    JSON.stringify(receipt).includes(secrets.management) ||
    JSON.stringify(receipt).includes(secrets.machine)
  )
    fail();
  return receipt;
}
