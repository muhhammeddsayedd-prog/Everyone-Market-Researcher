import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { createMediaProcessHandler } from '../../../../../server/media-process';
import { openMediaDatabaseSession } from '../../../../../server/media-database';
import { createMediaHttpPorts } from '../../../../../server/media-http';
import { databaseConfig } from '../../../../../server/n8n-worker/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
let pool: Pool | undefined;
export const POST = createMediaProcessHandler({
  environment: () => process.env,
  transports: (c) =>
    createMediaHttpPorts({
      previewOrigin: c.audience,
      webhookSecret: c.webhookSecret,
      protectionBypass: c.protectionBypass,
    }),
  open: async (config, executionId, signal, onLost) => {
    if (!pool) {
      const ca = readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt'));
      pool = new Pool({
        ...databaseConfig(config.writerPassword, ca),
        application_name: 'emr-m06-media-dev',
      });
      pool.on('error', () => {});
      pool.on('connect', (client) => client.on('error', () => {}));
      attachDatabasePool(pool);
    }
    return openMediaDatabaseSession(
      { connect: async () => (await pool!.connect()) as PoolClient },
      executionId,
      signal,
      onLost,
      config.batchSize,
    );
  },
});
