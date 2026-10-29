import { createCollectorHandler } from '../../../../../server/n8n-worker/collectors';
import { dispatchCollectorWorkerDatabase } from '../../../../../server/n8n-worker/collector-database';
import { createCollectorCallback } from '../../../../../server/n8n-worker/collector-callback';
import { boundedCollectorApifyJson } from '../../../../../server/n8n-worker/apify-reader';
import { createM06StoriesAdmission } from '../../../../../server/n8n-worker/m06-stories-callback';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const processCallback = createCollectorCallback({
  dispatch: dispatchCollectorWorkerDatabase,
  get: (path, token, maxBytes, signal) => boundedCollectorApifyJson(path, token, maxBytes, undefined, signal),
});
export const POST = createCollectorHandler({
  environment: () => process.env,
  dispatch: dispatchCollectorWorkerDatabase,
  processCallback,
  admitCallback: createM06StoriesAdmission({ dispatch: dispatchCollectorWorkerDatabase }),
});
