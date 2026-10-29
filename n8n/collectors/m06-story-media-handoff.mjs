import { code, booleanIf, execute, line, edge } from '../foundation/build-foundation.mjs';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';

/** A committed source result wakes only the dedicated story queue. This is a
 * finite product handoff, not a scheduler or retry controller. A failed native
 * child stops; its durable queue/worker receipt is reconciled before recovery. */
export function prepareM06StoryMediaHandoff(result, binding, maxBatches = null) {
  if (
    !binding ||
    Object.keys(binding).sort().join(',') !== 'audience,batchSize,environment,queue,workflowId' ||
    binding.environment !== 'dev' ||
    binding.queue !== 'stories' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(binding.workflowId ?? '') ||
    /(?:unbound|placeholder)/i.test(binding.workflowId) ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(binding.audience ?? '') ||
    /(?:unbound|placeholder)/i.test(binding.audience) ||
    !Number.isSafeInteger(binding.batchSize) ||
    binding.batchSize < 1 ||
    binding.batchSize > 5 ||
    (maxBatches !== null && maxBatches !== 6)
  )
    throw Error('M06_STORY_MEDIA_BINDING_REQUIRED');
  if (!result || result.state !== 'completed' || typeof result.updated !== 'boolean')
    throw Error('M06_STORY_MEDIA_RESULT_INVALID');
  if (!result.updated || result.media_dispatch === null || result.media_dispatch === undefined)
    return { action: 'done', batches: 0, itemsNew: 0 };
  const wake = result.media_dispatch;
  if (
    !wake ||
    Object.keys(wake).sort().join(',') !== 'items_new,queue' ||
    wake.queue !== 'stories' ||
    !Number.isSafeInteger(wake.items_new) ||
    wake.items_new < 1 ||
    wake.items_new > 1000
  )
    throw Error('M06_STORY_MEDIA_RESULT_INVALID');
  const totalBatches = Math.ceil(wake.items_new / binding.batchSize);
  return {
    action: 'execute',
    remaining: maxBatches === null ? totalBatches : Math.min(totalBatches, maxBatches),
    batches: 0,
    itemsNew: wake.items_new,
    ...(maxBatches === null ? {} : { deferredBatches: Math.max(0, totalBatches - maxBatches) }),
  };
}

export function advanceM06StoryMediaHandoff(state, receipt) {
  if (
    state?.action !== 'execute' ||
    !Number.isSafeInteger(state.remaining) ||
    state.remaining < 1 ||
    state.remaining > 1000 ||
    !receipt ||
    receipt.version !== 1 ||
    !/^[1-9][0-9]{0,19}$/.test(receipt.execution_id ?? '') ||
    receipt.state !== 'completed' ||
    receipt.held !== 0 ||
    receipt.retryable !== 0 ||
    receipt.reconciliation_required !== 0 ||
    receipt.infrastructure_cost_usd !== null ||
    !['claimed', 'processed', 'stored', 'skipped', 'expired'].every(
      (k) => Number.isSafeInteger(receipt[k]) && receipt[k] >= 0 && receipt[k] <= 50,
    ) ||
    receipt.processed !== receipt.claimed ||
    receipt.stored + receipt.skipped + receipt.expired !== receipt.processed
  )
    throw Error('M06_STORY_MEDIA_RECONCILIATION_REQUIRED');
  return {
    action: state.remaining === 1 || receipt.claimed === 0 ? 'done' : 'execute',
    remaining: state.remaining - 1,
    batches: state.batches + 1,
    itemsNew: state.itemsNew,
    ...(state.deferredBatches === undefined ? {} : { deferredBatches: state.deferredBatches }),
  };
}

// Supported Execute Workflow1.4 once/wait=true; ordinary Code/If loop. This
// fragment is tested locally but not installed into the historical WF-19 graph.
// The owned WF-31 binding must be read back against this exact Preview whose
// server configuration is EMR_MEDIA_QUEUE=stories before hosted activation.
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts
export function buildM06StoryMediaHandoff(inputBindings, binding, ready = true, maxBatches = null) {
  // An unbound inactive callback export may carry placeholders; its runtime
  // binding guard still rejects them before any child execution.
  if (ready) prepareM06StoryMediaHandoff({ state: 'completed', updated: false }, binding, maxBatches);
  const b = parseN8nBindings(inputBindings);
  b.workflowRefs['WF-31'] = { ...b.workflowRefs['WF-31'], id: binding.workflowId };
  const key = 'WF-19',
    prepare = code(
      key,
      'Prepare committed story media',
      prepareM06StoryMediaHandoff.toString() +
        '\nconst rows=$input.all();if(rows.length!==1||rows[0].binary)throw Error("M06_STORY_MEDIA_RESULT_INVALID");return[{json:prepareM06StoryMediaHandoff(rows[0].json,' +
        JSON.stringify(binding) +
        (maxBatches === null ? '' : ',' + JSON.stringify(maxBatches)) +
        ')}];',
      [0, 0],
    ),
    test = booleanIf(key, 'Stories media continuation?', '={{ $json.action === "execute" }}', [200, 0]),
    empty = code(
      key,
      'Prepare empty story media input',
      'const r=$input.all();if(r.length!==1||r[0].json?.action!=="execute")throw Error("M06_STORY_MEDIA_RESULT_INVALID");return[{json:{},pairedItem:{item:0}}];',
      [300, -100],
    ),
    child = execute(b, key, 'Process new story media', 'WF-31', [], {}, true, [400, -100]),
    advance = code(
      key,
      'Advance story media delivery',
      advanceM06StoryMediaHandoff.toString() +
        '\nconst rows=$input.all();if(rows.length!==1||rows[0].binary)throw Error("M06_STORY_MEDIA_RECONCILIATION_REQUIRED");return[{json:advanceM06StoryMediaHandoff($("Stories media continuation?").item.json,rows[0].json)}];',
      [600, -100],
    );
  child.retryOnFail = false;
  child.onError = 'stopWorkflow';
  // The child accepts passthrough, while its authenticated runtime accepts only
  // {}. Native ExecuteWorkflow1.4 requires omitting workflowInputs in this mode;
  // the preceding Code node supplies exactly that empty object.
  delete child.parameters.workflowInputs;
  return {
    state: 'local_native_fragment_only',
    entry: prepare.name,
    exit: { node: test.name, branch: 1 },
    nodes: [prepare, test, empty, child, advance],
    connections: {
      ...line(prepare.name, test.name),
      [test.name]: { main: [[edge(empty.name)], []] },
      ...line(empty.name, child.name),
      ...line(child.name, advance.name, test.name),
    },
  };
}
