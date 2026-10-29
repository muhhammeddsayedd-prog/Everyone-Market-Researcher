import 'server-only';
import type { M07EmbeddingDispatch, M07EmbeddingDbOperation } from '@emr/shared';
import type { WorkerPool } from './n8n-worker/database';
import { dispatchM07Statement, m07RestrictedPool } from './m07-extraction-database';
export function dispatchEmbeddingDatabase(
  pool: WorkerPool,
  operation: M07EmbeddingDbOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
) {
  const statements = {
    claim: {
      sql: 'select ops.m07_claim_embed($1::uuid,$2::int,600,$3::jsonb) as receipt',
      values: [
        args.owner_id,
        args.limit,
        args.allowed_entities == null ? null : JSON.stringify(args.allowed_entities),
      ],
    },
    prepare: {
      sql: 'select ops.m07_prepare_embed($1::uuid,$2::uuid,$3::text,$4::int,$5::text,$6::jsonb) as receipt',
      values: [
        args.batch_id,
        args.owner_id,
        args.model,
        1536,
        args.input_version,
        JSON.stringify(args.settings),
      ],
    },
    dispatch: {
      sql: 'select ops.m07_dispatch_embed($1::uuid,$2::uuid,$3::text) as receipt',
      values: [args.batch_id, args.owner_id, args.request_hash],
    },
    settle: {
      sql: 'select ops.m07_settle_embed($1::uuid,$2::uuid,$3::jsonb,$4::text,$5::text) as receipt',
      values: [
        args.batch_id,
        args.owner_id,
        JSON.stringify(args.provider_response),
        args.accounting_mode,
        args.request_hash,
      ],
    },
    unknown: {
      sql: 'select ops.m07_unknown_embed($1::uuid,$2::uuid,$3::text) as receipt',
      values: [args.batch_id, args.owner_id, args.request_hash],
    },
    status: {
      sql: 'select ops.m07_embed_status($1::uuid,$2::uuid) as receipt',
      values: [args.batch_id, args.owner_id],
    },
    ack: {
      sql: 'select ops.m07_ack_embed($1::uuid,$2::uuid) as receipt',
      values: [args.batch_id, args.owner_id],
    },
  };
  return dispatchM07Statement(pool, statements[operation], signal);
}
export function embeddingDatabase(
  connection: string,
  profile: 'local' | 'dev' = 'local',
): M07EmbeddingDispatch {
  return (operation, args, signal) =>
    dispatchEmbeddingDatabase(m07RestrictedPool(connection, profile), operation, args, signal);
}
