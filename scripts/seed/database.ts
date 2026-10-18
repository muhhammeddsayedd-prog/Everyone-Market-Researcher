import { z } from 'zod';
import type { Sql, TransactionSql } from 'postgres';
import type { Database, Json } from '@emr/shared';
import type { LogoAdapter, LogoInput, LogoRecord } from './copy-logos';

export type ResolutionAccount = Pick<
  Database['app']['Tables']['competitor_accounts']['Row'],
  | 'id'
  | 'competitor_id'
  | 'platform'
  | 'handle'
  | 'handle_norm'
  | 'url'
  | 'status'
  | 'resolve_status'
  | 'external_id'
  | 'uploads_playlist_id'
  | 'backfill_cursor'
  | 'backfill_status'
  | 'items_count'
  | 'last_error'
  | 'last_run_id'
  | 'last_success_at'
  | 'last_external_id'
  | 'last_item_published_at'
  | 'locked_until'
  | 'consecutive_failures'
> & {
  company_code: string;
  priority_tier: string;
  row_version: string;
  updated_at_text: string;
  has_collection: boolean;
  next_due_at_text: string;
  last_error_at_text: string | null;
};
type Connection = Sql | TransactionSql;

export async function readAccounts(sql: Connection): Promise<ResolutionAccount[]> {
  const rows =
    await sql`select a.id,a.competitor_id,a.platform,a.handle,a.handle_norm,a.url,a.status,a.resolve_status,
    a.external_id,a.uploads_playlist_id,a.backfill_cursor,a.backfill_status,a.items_count,a.last_error,
    a.last_run_id,a.last_success_at,a.last_external_id,a.last_item_published_at,a.locked_until,a.consecutive_failures,
    a.next_due_at::text as next_due_at_text,a.last_error_at::text as last_error_at_text,
    a.xmin::text as row_version,a.updated_at::text as updated_at_text,c.company_code,c.priority_tier,
    exists(select 1 from app.items i where i.account_id=a.id) or
    exists(select 1 from ingest.raw_items r where r.account_id=a.id) or
    exists(select 1 from app.website_pages w where w.account_id=a.id) or
    exists(select 1 from app.employee_snapshots e where e.account_id=a.id) or
    exists(select 1 from ops.scrape_run_accounts s where s.account_id=a.id) as has_collection
    from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    order by c.company_code,a.platform,a.handle_norm`;
  return rows as unknown as ResolutionAccount[];
}

const patchSchema = z.strictObject({
  resolve_status: z.enum(['resolved', 'failed', 'not_needed']).optional(),
  status: z.literal('invalid').optional(),
  external_id: z.string().min(1).optional(),
  uploads_playlist_id: z.string().min(1).optional(),
  backfill_cursor: z.object({ endpoint: z.enum(['channels', 'albums', 'groups']) }).optional(),
  last_error: z
    .string()
    .regex(/^[a-z0-9_]{1,80}$/)
    .nullable()
    .optional(),
  url: z.url().optional(),
});
export type AccountPatch = z.infer<typeof patchSchema>;
export function accountUntouched(row: ResolutionAccount): boolean {
  return (
    !row.has_collection &&
    !row.locked_until &&
    !row.last_run_id &&
    !row.last_success_at &&
    !row.last_external_id &&
    !row.last_item_published_at &&
    row.items_count === 0 &&
    ['pending', 'not_applicable'].includes(row.backfill_status)
  );
}

/** One atomic CAS; native row version also catches app edits which did not touch updated_at. */
export async function applyAccountPatch(
  sql: Connection,
  row: ResolutionAccount,
  input: AccountPatch,
): Promise<'updated' | 'unchanged' | 'preserved'> {
  const patch = patchSchema.parse(input);
  const keys = Object.keys(patch) as (keyof AccountPatch)[];
  if (!keys.length) return 'unchanged';
  if (keys.every((key) => JSON.stringify(row[key as keyof ResolutionAccount]) === JSON.stringify(patch[key])))
    return 'unchanged';
  const values = {
    ...patch,
    ...(patch.backfill_cursor ? { backfill_cursor: sql.json(patch.backfill_cursor as Json) } : {}),
  };
  const updated = await sql`update app.competitor_accounts set ${sql(values)},updated_at=clock_timestamp()
    where id=${row.id} and competitor_id=${row.competitor_id} and handle_norm=${row.handle_norm} and handle=${row.handle}
    and platform=${row.platform} and url=${row.url} and status=${row.status} and resolve_status=${row.resolve_status}
    and external_id is not distinct from ${row.external_id} and uploads_playlist_id is not distinct from ${row.uploads_playlist_id}
    and last_error is not distinct from ${row.last_error}
    and backfill_cursor is not distinct from ${row.backfill_cursor === null ? null : sql.json(row.backfill_cursor as Json)}
    and locked_until is not distinct from ${row.locked_until}::timestamptz and last_run_id is not distinct from ${row.last_run_id}::uuid
    and last_success_at is not distinct from ${row.last_success_at}::timestamptz
    and last_external_id is not distinct from ${row.last_external_id}
    and last_item_published_at is not distinct from ${row.last_item_published_at}::timestamptz
    and backfill_status=${row.backfill_status} and items_count=${row.items_count}
    and consecutive_failures=${row.consecutive_failures} and next_due_at=${row.next_due_at_text}::text::timestamptz
    and last_error_at is not distinct from ${row.last_error_at_text}::text::timestamptz
    and updated_at=${row.updated_at_text}::text::timestamptz and xmin::text=${row.row_version} returning id`;
  return updated.length === 1 ? 'updated' : 'preserved';
}

export async function readLogoInputs(
  sql: Connection,
): Promise<(LogoInput & { company_code: string; websiteUrl: string | null })[]> {
  const rows =
    await sql`select id as "competitorId",slug,logo_url as "sourceUrl",logo_path as "currentLogoPath",website_url as "websiteUrl",company_code
    from app.competitors order by company_code`;
  return rows as unknown as (LogoInput & { company_code: string; websiteUrl: string | null })[];
}

export class LogoDatabaseError extends Error {
  constructor(readonly code: 'logo_cas_conflict' | 'asset_collision' | 'invalid_logo_record') {
    super(code);
    this.name = 'LogoDatabaseError';
  }
}

/** DB metadata commits atomically after a create-only Storage upload; no asset is deleted or reassigned. */
export async function commitLogoWithinTransaction(tx: TransactionSql, record: LogoRecord): Promise<void> {
  const [competitor] =
    await tx`select id,slug,logo_url,logo_path from app.competitors where id=${record.competitorId} for update`;
  if (
    !competitor ||
    competitor.logo_path !== record.expectedLogoPath ||
    competitor.logo_url !== record.sourceUrl
  )
    throw new LogoDatabaseError('logo_cas_conflict');
  if (
    record.kind !== 'logo' ||
    ![`logos/${competitor.slug}.svg`, `logos/${competitor.slug}.webp`].includes(record.storagePath) ||
    !/^[a-f0-9]{64}$/.test(record.sha256)
  )
    throw new LogoDatabaseError('invalid_logo_record');
  const [asset] =
    await tx`select id,item_id,competitor_id,kind,source_url,width,height from app.media_assets where storage_path=${record.storagePath} for update`;
  if (
    asset &&
    (asset.item_id !== null ||
      asset.competitor_id !== record.competitorId ||
      asset.kind !== 'logo' ||
      asset.source_url !== record.sourceUrl)
  )
    throw new LogoDatabaseError('asset_collision');
  if (!asset) {
    const inserted =
      await tx`insert into app.media_assets(competitor_id,kind,storage_path,source_url,width,height)
      values(${record.competitorId},'logo',${record.storagePath},${record.sourceUrl},${record.width},${record.height})
      on conflict(storage_path) do nothing returning id`;
    if (inserted.length !== 1) throw new LogoDatabaseError('asset_collision');
  } else if (asset.width !== record.width || asset.height !== record.height) {
    await tx`update app.media_assets set width=${record.width},height=${record.height} where id=${asset.id}`;
  }
  if (competitor.logo_path !== record.storagePath)
    await tx`update app.competitors set logo_path=${record.storagePath} where id=${record.competitorId}`;
}

export function createLogoDatabaseAdapter(
  sql: Sql,
  storage: Pick<LogoAdapter, 'readStored' | 'upload' | 'request'>,
): LogoAdapter {
  return {
    ...storage,
    readAsset: (path) => readLogoAsset(sql, path),
    async commit(record) {
      await sql.begin((tx) => commitLogoWithinTransaction(tx, record));
    },
  };
}

export async function readLogoAsset(
  sql: Connection,
  path: string,
): Promise<Awaited<ReturnType<LogoAdapter['readAsset']>>> {
  const [asset] =
    await sql`select competitor_id,item_id,kind,source_url from app.media_assets where storage_path=${path}`;
  return asset
    ? {
        competitorId: String(asset.competitor_id ?? ''),
        itemId: asset.item_id as string | null,
        kind: String(asset.kind),
        sourceUrl: asset.source_url as string | null,
      }
    : null;
}
