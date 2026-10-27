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
  key: 'WF-00' | 'WF-10' | 'WF-11' | 'WF-19' | 'WF-90-M04';
  kind: 'native-json-blueprint';
  hostedAcceptance: false;
  runnableWorkflow: true;
  liveEnabled: false;
  definitionProfile?: 'inactive_native_staging';
  deferredErrorWorkflowId?: string;
  errorWorkflowBinding?:
    | { key: 'WF-90-M04'; state: 'unresolved'; reason: 'not_installed' }
    | { key: 'WF-90-M04'; state: 'bound'; id: string };
  workflow: NativeCollectorWorkflow;
  requiredRefs: { workflowKeys: string[]; credentialKeys: string[]; tagNames: string[] };
}
export const collectorCloudSource: string;
export function parseCollectorTransport(input: unknown): CollectorTransport;
export function buildNativeCollector(
  input: unknown,
  transport: unknown,
  kind: 'vimeo' | 'instagram',
  errorWorkflowId?: string,
): NativeCollectorGraph;
export interface CollectorSelection {
  mode: 'daily' | 'backfill';
  vimeo_account_ids: string[];
  instagram_account_ids: string[];
  max_pages: number;
  page_size: number;
  results_limit: number;
  max_actor_starts: number;
}
export function buildNativeOrchestrator(
  input: unknown,
  transport: unknown,
  selection: CollectorSelection,
  errorWorkflowId?: string,
): NativeCollectorGraph;
export function buildNativeCallback(
  input: unknown,
  transport: unknown,
  errorWorkflowId?: string,
): NativeCollectorGraph;
export function buildNativeErrorHandler(
  input: unknown,
  transport: unknown,
  workflowId?: string,
): NativeCollectorGraph;
export interface ManualCollectorEntry {
  triggerNodeName: 'Manual representative collection';
  inputNodeName: 'Fixed representative selection';
  input: {
    env: 'dev';
    mode: 'daily' | 'backfill';
    limit: number;
    max_pages: number;
    page_size: number;
    results_limit: number;
    max_actor_starts: number;
    account_ids: string[];
  };
}
export function withManualCollectorEntry(
  graph: NativeCollectorGraph,
  accountIds: readonly string[],
  bounds?: {
    mode: 'daily' | 'backfill';
    max_pages: number;
    page_size: number;
    results_limit: number;
    max_actor_starts: number;
  },
): NativeCollectorGraph & { manualEntry: ManualCollectorEntry };
export function withManualOrchestratorEntry(graph: NativeCollectorGraph): NativeCollectorGraph;
export function extendNativeCallback(
  input: unknown,
  transport: unknown,
  baseline: unknown,
): NativeCollectorGraph;
