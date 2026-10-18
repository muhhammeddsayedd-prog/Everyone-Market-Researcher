import sharp from 'sharp';
import type { Sql, TransactionSql } from 'postgres';
import {
  accountUntouched,
  applyAccountPatch,
  readAccounts,
  commitLogoWithinTransaction,
  type AccountPatch,
  type ResolutionAccount,
} from './database';
import { prepareLogo, type PreparedLogo, type LogoRecord } from './copy-logos';
import type { SeedManifest, SeedPlan } from './model';
import type { ProdLogos, ProdPayload } from './prod-model';
import { SeedRuntimeError } from './config';
import { sha256 } from './files';
import { safeRequest, type SafeRequest } from './network';

export const prodEmptyNames = [
  'competitors',
  'accounts',
  'media_assets',
  'items',
  'raw_items',
  'website_pages',
  'employee_snapshots',
  'scrape_runs',
  'scrape_run_accounts',
  'apify_runs',
  'ai_extractions',
  'campaigns',
  'news_articles',
  'briefs',
  'logo_objects',
  'other_media_objects',
] as const;
export function assertEmptyProdState(rows: readonly { name: string; count: unknown }[]) {
  if (
    rows.length !== prodEmptyNames.length ||
    new Set(rows.map((row) => row.name)).size !== prodEmptyNames.length ||
    rows.some(
      (row) =>
        !prodEmptyNames.includes(row.name as (typeof prodEmptyNames)[number]) || String(row.count) !== '0',
    )
  )
    throw new SeedRuntimeError('M02_PROD_NOT_EMPTY');
}
export async function readProdState(sql: Sql | TransactionSql) {
  return sql<{ name: string; count: string }[]>`
    select 'competitors' as name,count(*)::text as count from app.competitors union all
    select 'accounts',count(*)::text from app.competitor_accounts union all
    select 'media_assets',count(*)::text from app.media_assets union all
    select 'items',count(*)::text from app.items union all
    select 'raw_items',count(*)::text from ingest.raw_items union all
    select 'website_pages',count(*)::text from app.website_pages union all
    select 'employee_snapshots',count(*)::text from app.employee_snapshots union all
    select 'scrape_runs',count(*)::text from ops.scrape_runs union all
    select 'scrape_run_accounts',count(*)::text from ops.scrape_run_accounts union all
    select 'apify_runs',count(*)::text from ops.apify_runs union all
    select 'ai_extractions',count(*)::text from ops.ai_extractions union all
    select 'campaigns',count(*)::text from app.campaigns union all
    select 'news_articles',count(*)::text from app.news_articles union all
    select 'briefs',count(*)::text from app.briefs union all
    select 'logo_objects',count(*)::text from storage.objects where bucket_id='media' and name like 'logos/%' union all
    select 'other_media_objects',count(*)::text from storage.objects where bucket_id='media' and name not like 'logos/%'`;
}

/** Only an exact fixed public dev Storage path is fetched; original competitor URLs are provenance. */
export async function readFrozenLogo(
  entry: ProdLogos['logos'][number],
  request: SafeRequest = safeRequest,
  signal?: AbortSignal,
): Promise<PreparedLogo> {
  try {
    const base = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
    if (!/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|webp)$/.test(entry.storagePath)) throw new Error();
    const response = await request(`${base}/storage/v1/object/public/media/${entry.storagePath}`, {
      allowedOrigins: [base],
      maxRedirects: 0,
      maxBytes: entry.byteLength,
      timeoutMs: 10000,
      signal,
    });
    if (
      response.status !== 200 ||
      response.body.byteLength !== entry.byteLength ||
      sha256(response.body) !== entry.sha256 ||
      (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() !== entry.mime
    )
      throw new Error();
    let prepared: PreparedLogo;
    if (entry.mime === 'image/svg+xml') prepared = await prepareLogo(response.body, entry.mime);
    else {
      const metadata = await sharp(response.body, {
        failOn: 'warning',
        limitInputPixels: 65536,
        animated: false,
      }).metadata();
      if (
        metadata.format !== 'webp' ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 256 ||
        metadata.height > 256
      )
        throw new Error();
      prepared = {
        bytes: Uint8Array.from(response.body),
        mime: entry.mime,
        ext: 'webp',
        width: metadata.width,
        height: metadata.height,
        sha256: entry.sha256,
      };
    }
    if (
      prepared.sha256 !== entry.sha256 ||
      prepared.width !== entry.width ||
      prepared.height !== entry.height
    )
      throw new Error();
    return prepared;
  } catch {
    throw new SeedRuntimeError('M02_PROD_FROZEN_LOGO_REJECTED');
  }
}

/** No ownership or operational/human divergence may be adopted by a frozen import. */
export function frozenAccountPatch(
  row: ResolutionAccount,
  entry: ProdPayload['accounts'][number],
  ownedId: string,
): AccountPatch {
  if (
    row.id !== ownedId ||
    row.company_code !== entry.company_code ||
    row.platform !== entry.platform ||
    row.handle !== entry.handle ||
    row.handle_norm !== entry.handle.toLowerCase() ||
    row.status !== entry.status ||
    ![entry.sourceUrl, entry.url].includes(row.url) ||
    !accountUntouched(row) ||
    (row.external_id !== null && row.external_id !== entry.external_id) ||
    (row.uploads_playlist_id !== null && row.uploads_playlist_id !== entry.uploads_playlist_id) ||
    (row.last_error !== null && row.last_error !== entry.last_error) ||
    (row.backfill_cursor !== null &&
      JSON.stringify(row.backfill_cursor) !== JSON.stringify(entry.backfill_cursor))
  )
    throw new SeedRuntimeError('M02_PROD_OWNERSHIP_CHANGED');
  return {
    resolve_status: entry.resolve_status,
    url: entry.url,
    last_error: entry.last_error,
    ...(entry.external_id ? { external_id: entry.external_id } : {}),
    ...(entry.uploads_playlist_id ? { uploads_playlist_id: entry.uploads_playlist_id } : {}),
    ...(entry.backfill_cursor ? { backfill_cursor: entry.backfill_cursor } : {}),
  };
}
export async function applyFrozenAccounts(
  sql: Sql | TransactionSql,
  payload: ProdPayload,
  manifest: SeedManifest,
) {
  const rows = await readAccounts(sql);
  if (rows.length !== 1754) throw new SeedRuntimeError('M02_PROD_ACCOUNT_POPULATION_CHANGED');
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result = { updated: 0, unchanged: 0 };
  for (const entry of payload.accounts) {
    const id = manifest.accounts[entry.sourceKey]?.id;
    const row = id ? byId.get(id) : undefined;
    if (!id || !row) throw new SeedRuntimeError('M02_PROD_ACCOUNT_OWNERSHIP_MISSING');
    const state = await applyAccountPatch(sql, row, frozenAccountPatch(row, entry, id));
    if (state === 'preserved') throw new SeedRuntimeError('M02_PROD_ACCOUNT_CAS_CONFLICT');
    result[state]++;
  }
  return result;
}
export function assertFrozenAccounts(
  rows: ResolutionAccount[],
  payload: ProdPayload,
  manifest: SeedManifest,
) {
  if (rows.length !== payload.accounts.length) throw new SeedRuntimeError('M02_PROD_FINAL_ACCOUNT_MISMATCH');
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const entry of payload.accounts) {
    const id = manifest.accounts[entry.sourceKey]?.id;
    const row = id ? byId.get(id) : undefined;
    if (!row || !id) throw new SeedRuntimeError('M02_PROD_FINAL_ACCOUNT_MISMATCH');
    assertFrozenAccount(row, entry, id);
  }
}
export function assertFrozenAccount(
  row: ResolutionAccount,
  entry: ProdPayload['accounts'][number],
  ownedId: string,
) {
  frozenAccountPatch(row, entry, ownedId);
  for (const key of [
    'url',
    'status',
    'resolve_status',
    'external_id',
    'uploads_playlist_id',
    'backfill_cursor',
    'last_error',
  ] as const)
    if (JSON.stringify(row[key]) !== JSON.stringify(entry[key]))
      throw new SeedRuntimeError('M02_PROD_FINAL_ACCOUNT_MISMATCH');
}
/** The competitor lock also blocks concurrent FK inserts before the absence check. */
export async function commitFreshProdLogo(tx: TransactionSql, record: LogoRecord) {
  const owner = await tx`select id from app.competitors where id=${record.competitorId} for update`;
  if (owner.length !== 1) throw new SeedRuntimeError('M02_PROD_LOGO_OWNERSHIP_MISSING');
  const existing = await tx`select id from app.media_assets where storage_path=${record.storagePath}`;
  if (existing.length) throw new SeedRuntimeError('M02_PROD_LOGO_METADATA_COLLISION');
  await commitLogoWithinTransaction(tx, record);
}
export async function verifyFinalProdConfiguration(
  tx: TransactionSql,
  plan: SeedPlan,
  payload: ProdPayload,
  manifest: SeedManifest,
  logos: ProdLogos,
) {
  assertFrozenAccounts(await readAccounts(tx), payload, manifest);
  const competitors =
    await tx`select id,company_code,slug,name,markets,hq_country,categories,in_house,logo_url,logo_path,website_url,priority_tier,pilot_rank,is_baseline,status,notes,source_sheet_row from app.competitors order by company_code`;
  if (competitors.length !== 285) throw new SeedRuntimeError('M02_PROD_FINAL_COMPETITOR_MISMATCH');
  const logoByCode = new Map(logos.logos.map((row) => [row.company_code, row]));
  for (const expected of plan.competitors) {
    const actual = competitors.find((row) => row.company_code === expected.company_code);
    if (
      !actual ||
      actual.id !== manifest.competitors[expected.company_code]?.id ||
      actual.logo_path !== (logoByCode.get(expected.company_code)?.storagePath ?? null)
    )
      throw new SeedRuntimeError('M02_PROD_FINAL_COMPETITOR_MISMATCH');
    for (const [key, value] of Object.entries(expected))
      if (JSON.stringify(actual[key] ?? null) !== JSON.stringify(value ?? null))
        throw new SeedRuntimeError('M02_PROD_FINAL_COMPETITOR_MISMATCH');
  }
  const defaults = await tx`select count(*)::integer as violations from app.competitor_accounts
    where items_count<>0 or consecutive_failures<>0 or locked_until is not null or last_run_id is not null
      or last_success_at is not null or last_external_id is not null or last_item_published_at is not null
      or last_error_at is not null or next_due_at<>created_at or backfill_from<>date '2024-01-01'
      or cadence<>case when platform='linkedin_employees' then interval '7 days' else interval '1 day' end
      or backfill_status::text<>case when platform in ('instagram_stories','linkedin_employees') then 'not_applicable' else 'pending' end`;
  if (defaults[0]?.violations !== 0) throw new SeedRuntimeError('M02_PROD_OPERATIONAL_DEFAULTS_CHANGED');
  const assets =
    await tx`select id,competitor_id,item_id,kind,storage_path,source_url,width,height from app.media_assets order by storage_path`;
  const objects =
    await tx`select name,metadata->>'size' as bytes,metadata->>'mimetype' as mime from storage.objects where bucket_id='media' order by name`;
  if (assets.length !== 257 || objects.length !== 257)
    throw new SeedRuntimeError('M02_PROD_FINAL_LOGOS_REJECTED');
  for (const expected of logos.logos) {
    const asset = assets.find((row) => row.storage_path === expected.storagePath);
    const object = objects.find((row) => row.name === expected.storagePath);
    if (
      !asset ||
      asset.competitor_id !== manifest.competitors[expected.company_code]?.id ||
      asset.item_id !== null ||
      asset.kind !== 'logo' ||
      asset.source_url !== expected.sourceUrl ||
      asset.width !== expected.width ||
      asset.height !== expected.height ||
      object?.bytes !== String(expected.byteLength) ||
      object.mime !== expected.mime
    )
      throw new SeedRuntimeError('M02_PROD_FINAL_LOGO_METADATA_MISMATCH');
  }
  return { competitors, assets, objects, operationalDefaultViolations: 0 };
}
