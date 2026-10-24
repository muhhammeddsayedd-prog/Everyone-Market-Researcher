import { createWorkerHandler } from '../../../../../server/n8n-worker/dispatcher';
import { dispatchWorkerDatabase } from '../../../../../server/n8n-worker/database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const POST = createWorkerHandler({
  environment: () => process.env,
  dispatch: dispatchWorkerDatabase,
  log: () => {},
});
