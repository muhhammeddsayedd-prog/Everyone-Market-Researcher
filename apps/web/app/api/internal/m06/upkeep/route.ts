import { createUpkeepHandler } from '../../../../../server/m06-upkeep';
import { upkeepDatabase } from '../../../../../server/m06-upkeep-database';
import { upkeepSourcePorts } from '../../../../../server/m06-upkeep-sources';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = createUpkeepHandler({
  environment: () => process.env,
  database: upkeepDatabase,
  sources: upkeepSourcePorts,
});
