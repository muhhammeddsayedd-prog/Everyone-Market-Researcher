export interface CollectorTransport {
  audience: string;
  credential: { id: string; name: 'M03 foundation machine [dev]'; type: 'httpCustomAuth' };
}
export interface NativeCollectorNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  parameters: { jsCode?: string; [key: string]: unknown };
  position: number[];
  [key: string]: unknown;
}
export interface NativeCollectorWorkflow {
  name: string;
  active: false;
  nodes: NativeCollectorNode[];
  connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>;
  settings: Record<string, unknown>;
  tags: Array<{ id: string; name: string }>;
  pinData: Record<string, never>;
}
export interface NativeCollectorGraph {
  key: 'WF-10' | 'WF-11' | 'WF-19';
  kind: 'native-json-blueprint';
  hostedAcceptance: false;
  runnableWorkflow: true;
  liveEnabled: false;
  definitionProfile?: 'inactive_native_staging';
  deferredErrorWorkflowId?: string;
  workflow: NativeCollectorWorkflow;
  requiredRefs: { workflowKeys: string[]; credentialKeys: string[]; tagNames: string[] };
}
export const collectorCloudSource: string;
export function parseCollectorTransport(input: unknown): CollectorTransport;
export function buildNativeCollector(
  input: unknown,
  transport: unknown,
  kind: 'vimeo' | 'instagram',
): NativeCollectorGraph;
export interface ManualCollectorEntry {
  triggerNodeName: 'Manual representative collection';
  inputNodeName: 'Fixed representative selection';
  input: {
    env: 'dev';
    mode: 'backfill';
    limit: 2;
    max_pages: 1;
    page_size: 5;
    results_limit: 5;
    max_actor_starts: 2;
    account_ids: [string, string];
  };
}
export function withManualCollectorEntry(
  graph: NativeCollectorGraph,
  accountIds: readonly [string, string],
): NativeCollectorGraph & { manualEntry: ManualCollectorEntry };
export function extendNativeCallback(
  input: unknown,
  transport: unknown,
  baseline: unknown,
): NativeCollectorGraph;
