import { z } from 'zod';
import type { Options } from 'postgres';
import type { SeedPlan } from './model';
import { SeedRuntimeError } from './config';

export const prodTarget = {
  ref: 'hkiafqrcxaafdbcvjlzv',
  host: 'aws-1-eu-central-1.pooler.supabase.com',
  identity: 'supabase:hkiafqrcxaafdbcvjlzv:postgres',
} as const;
export const prodExcludedYouTube = ['C102', 'C142', 'C218', 'C231', 'C233', 'C245', 'C283'] as const;
export const prodMigrationVersions = [
  '20261017172928',
  '20261017172931',
  '20261017172934',
  '20261017172937',
  '20261017172940',
  '20261017172943',
  '20261017172945',
] as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const nullableText = z.string().min(1).max(8192).nullable();
const accountSchema = z.strictObject({
  sourceKey: z.string().min(1).max(200),
  company_code: z.string().regex(/^C\d{3}$/),
  platform: z.enum([
    'website',
    'website_work_page',
    'instagram',
    'instagram_stories',
    'linkedin',
    'linkedin_employees',
    'vimeo',
    'youtube',
  ]),
  sourceHandle: z.string().min(1).max(8192),
  sourceUrl: z.string().min(1).max(8192),
  handle: z.string().min(1).max(8192),
  url: z.string().min(1).max(8192),
  status: z.enum(['active', 'paused', 'invalid']),
  resolve_status: z.enum(['resolved', 'failed', 'not_needed']),
  external_id: nullableText,
  uploads_playlist_id: nullableText,
  backfill_cursor: z.strictObject({ endpoint: z.enum(['channels', 'albums', 'groups']) }).nullable(),
  last_error: z
    .string()
    .regex(/^[a-z0-9_]{1,80}$/)
    .nullable(),
});
export const prodPayloadSchema = z.strictObject({
  version: z.literal(1),
  sourceProjectRef: z.literal('zmotjsbzhzjvpelxvxlf'),
  observedAt: z.iso.datetime({ offset: true }),
  sourceSha256: hash,
  accounts: z.array(accountSchema).length(1754),
});
export type ProdPayload = z.infer<typeof prodPayloadSchema>;
export const prodLogoManifestSchema = z.strictObject({
  version: z.literal(1),
  sourceProjectRef: z.literal('zmotjsbzhzjvpelxvxlf'),
  logos: z
    .array(
      z.strictObject({
        company_code: z.string().regex(/^C\d{3}$/),
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        storagePath: z.string().regex(/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|svg)$/),
        sourceUrl: nullableText,
        mime: z.enum(['image/webp', 'image/svg+xml']),
        width: z.number().int().positive().nullable(),
        height: z.number().int().positive().nullable(),
        byteLength: z
          .number()
          .int()
          .positive()
          .max(5 * 1024 * 1024),
        sha256: hash,
      }),
    )
    .length(257),
});
export type ProdLogos = z.infer<typeof prodLogoManifestSchema>;
const prodPacketSchema = z.strictObject({
  version: z.literal(1),
  target: z.literal(prodTarget.ref),
  approved: z.boolean(),
  approvalReference: z.string().trim().min(1).nullable(),
  sourceSha256: hash,
  payloadSha256: hash,
  logoManifestSha256: hash,
  baselineSvgSha256: hash,
  limits: z.strictObject({
    competitors: z.literal(285),
    accounts: z.literal(1754),
    logos: z.literal(257),
    uploadedBytes: z.literal(1560325),
    devPublicGets: z.literal(257),
    prodPublicGets: z.literal(257),
    storageUploads: z.literal(257),
  }),
  expectedIncrementalUsd: z.literal(0),
  paidProviderCalls: z.literal(0),
  externalProviderCalls: z.literal(0),
});
export type ProdPacket = z.infer<typeof prodPacketSchema>;
function reject(code = 'M02_PROD_PAYLOAD_REJECTED'): never {
  throw new SeedRuntimeError(code);
}
function publicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
    for (const original of url.searchParams.keys()) {
      let key = original;
      for (let attempt = 0; attempt < 3; attempt++) {
        const decoded = decodeURIComponent(key.replaceAll('+', ' '));
        if (decoded === key) break;
        key = decoded;
      }
      if (
        /^(?:key|apikey|accesstoken|token|password|secret|clientsecret|authorization)$/.test(
          key.toLowerCase().replace(/[^a-z0-9]/g, ''),
        )
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
export function assertProdPacket(
  value: unknown,
  hashes: { source: string; payload: string; logos: string; baseline: string },
  requireApproval = true,
): ProdPacket {
  const parsed = prodPacketSchema.safeParse(value);
  if (!parsed.success) reject('M02_PROD_PACKET_REJECTED');
  const packet = parsed.data;
  if (packet.approved !== (packet.approvalReference !== null))
    reject('M02_PROD_PACKET_APPROVAL_REFERENCE_REJECTED');
  if (requireApproval && (!packet.approved || !packet.approvalReference)) reject('M02_PROD_APPROVAL_PENDING');
  if (
    packet.sourceSha256 !== hashes.source ||
    packet.payloadSha256 !== hashes.payload ||
    packet.logoManifestSha256 !== hashes.logos ||
    packet.baselineSvgSha256 !== hashes.baseline
  )
    reject('M02_PROD_PACKET_HASH_MISMATCH');
  return packet;
}
export function assertProdPayload(value: unknown, plan: SeedPlan, sourceSha256: string): ProdPayload {
  const parsed = prodPayloadSchema.safeParse(value);
  if (!parsed.success) reject();
  const result = parsed.data;
  if (
    result.sourceSha256 !== sourceSha256 ||
    plan.competitors.length !== 285 ||
    plan.accounts.length !== 1754
  )
    reject();
  const expected = new Map(plan.accounts.map((row) => [row.sourceKey, row]));
  const seen = new Set<string>();
  const excluded: string[] = [];
  let vimeo = 0,
    youtube = 0,
    pilotYoutube = 0,
    websiteFlags = 0;
  const pilot = new Set(
    plan.competitors
      .filter((row) => row.priority_tier === 'pilot' || row.is_baseline)
      .map((row) => row.company_code),
  );
  for (const row of result.accounts) {
    const source = expected.get(row.sourceKey);
    if (!source || seen.has(row.sourceKey)) reject();
    seen.add(row.sourceKey);
    if (
      row.company_code !== source.company_code ||
      row.platform !== source.platform ||
      row.sourceHandle !== source.handle ||
      row.sourceUrl !== source.url ||
      row.handle !== source.handle ||
      row.status !== source.status ||
      !publicUrl(row.url)
    )
      reject();
    const website = ['website', 'website_work_page'].includes(row.platform);
    if (
      row.url !== source.url &&
      (!website ||
        new URL(row.url).hostname.replace(/^www\./, '') !==
          new URL(source.url).hostname.replace(/^www\./, ''))
    )
      reject();
    if (row.platform === 'vimeo') {
      if (
        row.resolve_status !== 'resolved' ||
        !/^[1-9]\d*$/.test(row.external_id ?? '') ||
        row.uploads_playlist_id !== null ||
        row.last_error !== null
      )
        reject();
      vimeo++;
    } else if (row.platform === 'youtube') {
      if (row.status === 'invalid') {
        if (
          row.resolve_status !== 'failed' ||
          row.external_id !== null ||
          row.uploads_playlist_id !== null ||
          row.backfill_cursor !== null ||
          !([null, 'yt_not_found', 'yt_custom_url_unresolved'] as Array<string | null>).includes(
            row.last_error,
          )
        )
          reject();
        excluded.push(row.company_code);
      } else {
        if (
          row.resolve_status !== 'resolved' ||
          !/^UC[\w-]{22}$/.test(row.external_id ?? '') ||
          (row.sourceHandle.startsWith('channel/') && row.external_id !== row.sourceHandle.slice(8)) ||
          row.uploads_playlist_id !== `UU${row.external_id!.slice(2)}` ||
          row.backfill_cursor !== null ||
          row.last_error !== null
        )
          reject();
        youtube++;
        if (pilot.has(row.company_code)) pilotYoutube++;
      }
    } else {
      if (
        row.resolve_status !== 'not_needed' ||
        row.external_id !== null ||
        row.uploads_playlist_id !== null ||
        row.backfill_cursor !== null
      )
        reject();
      if (row.last_error !== null) {
        if (!website || !/^unreachable_(?:network|timeout|[1-5]\d{2})$/.test(row.last_error)) reject();
        websiteFlags++;
      }
    }
  }
  if (
    vimeo !== 202 ||
    youtube !== 121 ||
    pilotYoutube !== 10 ||
    excluded.sort().join(',') !== prodExcludedYouTube.join(',') ||
    websiteFlags !== 23
  )
    reject();
  return result;
}
export function assertProdLogos(value: unknown, plan: SeedPlan): ProdLogos {
  const parsed = prodLogoManifestSchema.safeParse(value);
  if (!parsed.success) reject('M02_PROD_LOGOS_REJECTED');
  const result = parsed.data;
  const byCode = new Map(plan.competitors.map((row) => [row.company_code, row]));
  const codes = new Set<string>();
  const paths = new Set<string>();
  let bytes = 0;
  for (const row of result.logos) {
    const source = byCode.get(row.company_code);
    const ext = row.mime === 'image/webp' ? 'webp' : 'svg';
    if (
      !source ||
      codes.has(row.company_code) ||
      paths.has(row.storagePath) ||
      source.slug !== row.slug ||
      row.sourceUrl !== (source.logo_url ?? null) ||
      row.storagePath !== `logos/${row.slug}.${ext}` ||
      (row.sourceUrl !== null && !publicUrl(row.sourceUrl)) ||
      (row.mime === 'image/webp' && (!row.width || !row.height || row.width > 256 || row.height > 256))
    )
      reject('M02_PROD_LOGOS_REJECTED');
    codes.add(row.company_code);
    paths.add(row.storagePath);
    bytes += row.byteLength;
  }
  if (
    bytes !== 1560325 ||
    !codes.has('C000') ||
    result.logos.filter((row) => row.sourceUrl !== null).length !== 256
  )
    reject('M02_PROD_LOGOS_REJECTED');
  return result;
}
export function prodDatabaseConfig(
  env: Record<string, string | undefined>,
  ca: string,
): Options<Record<string, never>> {
  let url: URL;
  try {
    url = new URL(env.SEED_DATABASE_URL ?? '');
  } catch {
    return reject('M02_PROD_DATABASE_TARGET_REJECTED');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== prodTarget.host ||
    url.port !== '5432' ||
    url.username !== `postgres.${prodTarget.ref}` ||
    url.password ||
    url.pathname !== '/postgres' ||
    url.hash ||
    url.search !== '?sslmode=require'
  )
    reject('M02_PROD_DATABASE_TARGET_REJECTED');
  if (!env.PGPASSWORD || !env.SUPABASE_SECRET_KEY) reject('M02_PROD_CREDENTIAL_MISSING');
  return {
    host: prodTarget.host,
    port: 5432,
    username: `postgres.${prodTarget.ref}`,
    database: 'postgres',
    password: env.PGPASSWORD,
    ssl: { ca, rejectUnauthorized: true, servername: prodTarget.host, minVersion: 'TLSv1.2' },
    max: 1,
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 10,
    max_lifetime: 1800,
    connection: { application_name: 'emr-m02-owner-prod-seed', statement_timeout: 30000, lock_timeout: 5000 },
    onnotice: () => {},
    debug: false,
  };
}
