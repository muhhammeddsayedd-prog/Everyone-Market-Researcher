import { createEmbeddingHandler } from '../../../../../server/m07-embeddings';
import { embeddingDatabase } from '../../../../../server/m07-embeddings-database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = createEmbeddingHandler({ environment: () => process.env, database: embeddingDatabase });
