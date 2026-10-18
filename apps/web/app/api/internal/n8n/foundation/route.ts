import { createFoundationHandler } from '../../../../../server/n8n-worker/foundation';
import { dispatchFoundationWorkerDatabase } from '../../../../../server/n8n-worker/database';
import {
  boundedApifyJson,
  readFoundationDataset,
  readFoundationTerminal,
  readFoundationLaunch,
} from '../../../../../server/n8n-worker/apify-reader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const handler = createFoundationHandler({
  environment: () => process.env,
  dispatch: (input, config, signal) =>
    dispatchFoundationWorkerDatabase(input, config, signal, async (context, operation) => {
      const get = (path: string, token: string, maxBytes: number) =>
        boundedApifyJson(path, token, maxBytes, undefined, signal);
      if (operation === 'launch.reconcile') return readFoundationLaunch(context, config.apifyReadToken, get);
      return operation === 'apify.dataset.read'
        ? readFoundationDataset(context, config.apifyReadToken, get)
        : readFoundationTerminal(context, config.apifyReadToken, get);
    }),
  // Durable typed SQL receipts are the audit source. Never emit HTTP context.
  log: () => {},
});
export const POST = handler;
