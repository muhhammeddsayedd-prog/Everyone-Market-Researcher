import type { LogoInput } from './copy-logos';
import type { ResolutionAccount } from './database';
import type { SeedManifest, SeedPlan } from './model';

/** Only identities owned by this exact source plan may incur live requests or writes. */
export function scopedAccounts(
  rows: ResolutionAccount[],
  plan: SeedPlan,
  manifest: SeedManifest,
): ResolutionAccount[] {
  const allowed = new Map(
    plan.accounts.flatMap((desired) => {
      const receipt = manifest.accounts[desired.sourceKey];
      const competitor = manifest.competitors[desired.company_code];
      if (
        !receipt ||
        !competitor ||
        receipt.protectedFields.some((field) =>
          ['competitor_id', 'platform', 'handle', 'url'].includes(field),
        ) ||
        receipt.values.competitor_id !== competitor.id ||
        receipt.values.platform !== desired.platform ||
        receipt.values.handle !== desired.handle ||
        receipt.values.url !== desired.url
      )
        return [];
      return [[receipt.id, { desired, competitorId: competitor.id }] as const];
    }),
  );
  return rows.filter((row) => {
    const owned = allowed.get(row.id);
    return (
      owned !== undefined &&
      row.competitor_id === owned.competitorId &&
      row.company_code === owned.desired.company_code &&
      row.platform === owned.desired.platform &&
      row.handle === owned.desired.handle &&
      row.url === owned.desired.url
    );
  });
}
export function scopedLogos<T extends LogoInput & { company_code: string }>(
  rows: T[],
  plan: SeedPlan,
  manifest: SeedManifest,
): T[] {
  const desired = new Map(plan.competitors.map((row) => [row.company_code, row]));
  return rows.filter((row) => {
    const source = desired.get(row.company_code);
    const receipt = manifest.competitors[row.company_code];
    return (
      source !== undefined &&
      receipt !== undefined &&
      receipt.id === row.competitorId &&
      !receipt.protectedFields.some((field) => ['slug', 'logo_url'].includes(field)) &&
      source.slug === row.slug &&
      (source.logo_url ?? null) === row.sourceUrl &&
      receipt.values.slug === row.slug &&
      receipt.values.logo_url === row.sourceUrl
    );
  });
}
