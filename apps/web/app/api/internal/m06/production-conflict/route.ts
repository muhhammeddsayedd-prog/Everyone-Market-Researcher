import { createCampaignConflictHandler } from '../../../../../server/m06-campaign-conflict';
import { dispatchCollectorWorkerDatabase } from '../../../../../server/n8n-worker/collector-database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
export const POST = createCampaignConflictHandler({
  environment: () => process.env,
  dispatch: dispatchCollectorWorkerDatabase,
});
