export type LinkedInAccount = {
  id?: string;
  account_id?: string;
  competitor_id: string;
  platform: 'linkedin' | 'linkedin_employees';
  handle: string;
  handle_norm?: string;
  url: string;
  last_item_published_at?: string | null;
  watermark_published_at?: string | null;
  backfill_cursor?: Record<string, unknown> | null;
};
export interface LinkedInBatch {
  actor: 'harvestapi/linkedin-company-posts' | 'harvestapi/linkedin-company-employees';
  platform: 'linkedin' | 'linkedin_employees';
  purpose: 'daily' | 'backfill' | 'weekly';
  result_type: 'posts' | 'employees';
  account_ids: string[];
  input: Record<string, unknown>;
  resultsLimit: number;
  snapshot_date?: string;
  coverage: Record<string, unknown>;
}
export function buildLinkedInPostBatches(accounts: LinkedInAccount[], options: unknown): LinkedInBatch[];
export function buildLinkedInEmployeeBatches(accounts: LinkedInAccount[], options: unknown): LinkedInBatch[];
export function linkedinRegistrationCompletion(
  receipt: unknown,
  runId: string,
): { state: 'awaiting_callbacks' } | { state: 'completed'; status: 'success' | 'partial' | 'failed' };
export const linkedinPlanningHelpers: {
  object: (value: unknown) => boolean;
  day: (value: unknown) => boolean;
};
