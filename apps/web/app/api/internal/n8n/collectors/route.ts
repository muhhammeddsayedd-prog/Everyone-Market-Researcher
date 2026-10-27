import { createCollectorHandler } from '../../../../../server/n8n-worker/collectors';
import { dispatchCollectorWorkerDatabase } from '../../../../../server/n8n-worker/collector-database';
import { createCollectorCallback } from '../../../../../server/n8n-worker/collector-callback';
import { boundedCollectorApifyJson } from '../../../../../server/n8n-worker/apify-reader';
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
});
