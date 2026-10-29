import { createExtractionHandler } from '../../../../../server/m07-extraction';
import { extractionDatabase } from '../../../../../server/m07-extraction-database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = createExtractionHandler({ environment: () => process.env, database: extractionDatabase });
