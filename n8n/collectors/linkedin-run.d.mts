type Row = Record<string, unknown>;
type Call = (input: Row, requestId: string) => Promise<unknown>;
export interface LinkedInGateway {
  start: Call;
  claim: Call;
  launch: Call;
  register: Call;
  close_registration: Call;
  finish: Call;
}
export function runLinkedInCollector(
  input: unknown,
  deps: {
    gateway: LinkedInGateway;
    now: () => string;
    startActor: (request: {
      actor_id: string;
      launch_id: string;
      input: Row;
      descriptor: Row;
    }) => Promise<unknown>;
  },
): Promise<{
  state: 'completed' | 'awaiting_callbacks' | 'reconciliation_required';
  status?: 'success' | 'partial' | 'failed';
  run_id: string | null;
  stage?: string;
  actor_starts: number;
  actor_run_ids: string[];
  registration_closed?: boolean;
  uncertain_start?: boolean;
}>;
