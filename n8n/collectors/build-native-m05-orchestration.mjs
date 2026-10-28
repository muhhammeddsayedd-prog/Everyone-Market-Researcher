import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { m05WorkflowIds } from '../../packages/shared/src/n8n-m05-contracts.ts';
import { buildNativeErrorHandler } from './build-native-collectors.mjs';
import { trigger, code, execute, line, ref, tags, settings } from '../foundation/build-foundation.mjs';

/** Existing log-only handler pattern; no notifications, guessed parent failure,
 * claim release, hidden payload or closed M03 dependency. Publication is gated. */
export function buildM05ErrorHandler(input, transport) {
  const b = parseN8nBindings(input),
    graph = buildNativeErrorHandler(b, transport);
  const old = Object.fromEntries(['WF-00', 'WF-10', 'WF-11', 'WF-19'].map((k) => [ref(b, k).id, k]));
  const sources = Object.fromEntries(Object.entries(m05WorkflowIds).map(([key, id]) => [id, key]));
  for (const n of graph.workflow.nodes)
    if (n.parameters.jsCode)
      n.parameters.jsCode = n.parameters.jsCode
        .replace(JSON.stringify(old), JSON.stringify(sources))
        .replaceAll("'execution.error'", "'m05.execution.error'");
  return {
    ...graph,
    key: 'WF-90-M05',
    errorWorkflowBinding: { state: 'unresolved', reason: 'M05_handler_not_installed' },
    workflow: { ...graph.workflow, name: 'WF-90-M05 · Collector error handler [dev]' },
    limitations: [
      'Local log-only definition; supported automatic Error Trigger publication/binding is live-gated.',
    ],
  };
}

/** Child definitions carry their own exact selectors. Callers cannot substitute
 * accounts, source parameters, environment or workflow IDs at the orchestrator. */
export function buildM05Orchestrator(input, children) {
  const b = parseN8nBindings(input),
    key = 'WF-00',
    keys = ['WF-21', 'WF-13', 'WF-18', 'WF-18b'];
  if (
    !Array.isArray(children) ||
    children.length !== 4 ||
    new Set(children.map((g) => g?.key)).size !== 4 ||
    keys.some(
      (k) =>
        !children.some((g) => g.key === k && g.hostedAcceptance === false && g.workflow?.active === false),
    )
  )
    throw Error('M05_CHILD_DEFINITION_INVALID');
  for (const target of keys)
    if (ref(b, target).id !== m05WorkflowIds[target]) throw Error('M05_WORKFLOW_BINDING_INVALID');
  const ready = children.every((g) => g.runnableWorkflow === true);
  const nodes = [trigger(key, [['env', 'string']])],
    names = ['When called'];
  if (!ready) {
    nodes.push(code(key, 'M05 binding required', "throw Error('M05_CHILD_BINDING_REQUIRED');", [200, 0]));
    names.push('M05 binding required');
  } else {
    for (const [i, target] of keys.entries()) {
      const call = 'Dispatch ' + target,
        check = 'Check ' + target + ' dispatch';
      nodes.push(
        execute(b, key, call, target, [['env', 'string']], { env: 'dev' }, true, [200 + i * 400, 0]),
        code(
          key,
          check,
          "const r=$input.first().json;if(!r||r.state==='reconciliation_required'||r.status==='failed'||r.reconciliation_required===true)throw Error('M05_CHILD_RECONCILIATION_REQUIRED');return[{json:r}];",
          [400 + i * 400, 0],
        ),
      );
      names.push(call, check);
    }
    nodes.push(
      code(
        key,
        'Return M05 dispatch',
        `return[{json:{env:'dev',dispatch_complete:true,collection_complete:false,children:[${keys.map((k) => "$('Dispatch " + k + "').first().json").join(',')}]}}];`,
        [2000, 0],
      ),
    );
    names.push('Return M05 dispatch');
  }
  const config = settings(b, key);
  delete config.errorWorkflow;
  Object.assign(config, {
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  });
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: ready,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    fixtureProvenance: {
      kind: 'synthetic_local_contract',
      actualProviderCapture: false,
      actualNativeSave: false,
    },
    requiredRefs: { workflowKeys: keys, credentialKeys: [], tagNames: ['env:dev', 'layer:ops'] },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      connections: line(...names),
      settings: config,
      tags: tags(b, ['env:dev', 'layer:ops']),
      pinData: {},
    },
    limitations: [
      'Dispatch is not callback/database completion. All four child selectors and the log-only handler need approved dev staging/readback.',
    ],
  };
}
