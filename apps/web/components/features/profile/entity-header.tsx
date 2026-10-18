import { ExternalLink } from 'lucide-react';
import { CategoryChip, CountryBadge, PlatformBadge, TierPill } from '@/components/ui/badges';
import { LogoTile } from '@/components/ui/logo-tile';
import type { CompanyProfile } from '@/lib/data/competitors';
import { EXTERNAL_LINK_PROPS, safeExternalUrl } from '@/lib/view/safe-url';
import { COLLECTION_TYPE_LABEL, PLATFORM_FAMILY } from '@/lib/view/sources';

/**
 * EntityHeader (COMPETITOR): logo, names, badges, categories and links that open the original
 * public sources. Each distinct source URL appears once; collection types sharing a profile
 * (posts + stories, posts + employees) link to the same original page.
 */
export function EntityHeader({
  company,
  categoryLabel,
}: {
  company: CompanyProfile;
  categoryLabel: (code: string) => string;
}) {
  const website = safeExternalUrl(company.website_url);
  const seen = new Set<string>();
  const sourceLinks = company.accounts.flatMap((account) => {
    const link = safeExternalUrl(account.url);
    const key = `${PLATFORM_FAMILY[account.platform]}|${link?.href ?? ''}`;
    if (!link || seen.has(key) || account.platform === 'website') return [];
    seen.add(key);
    return [{ account, link }];
  });

  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-start">
      <LogoTile src={company.logoSrc} name={company.name} size={96} />
      <div className="min-w-0 flex-1">
        <p className="type-micro text-fg-label">Competitor · {company.company_code}</p>
        <h1 className="mt-2 type-h1 text-balance break-words" dir="auto">
          {company.name}
        </h1>
        {company.name_ar ? (
          <p className="mt-1 type-h3 text-fg-secondary">
            <span lang="ar" dir="rtl">
              {company.name_ar}
            </span>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <TierPill tier={company.priority_tier} />
          {company.pilot_rank ? (
            <span className="inline-flex h-6 items-center rounded-full border border-border px-2.5 type-small text-fg-secondary tabular">
              Pilot rank {company.pilot_rank}
            </span>
          ) : null}
          {company.status !== 'active' ? (
            <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 type-small text-fg-muted capitalize">
              {company.status}
            </span>
          ) : null}
          {company.markets.map((market) => (
            <CountryBadge key={market} market={market} />
          ))}
        </div>
        {company.categories.length ? (
          <ul aria-label="Categories" className="mt-3 flex flex-wrap gap-1.5">
            {company.categories.map((code) => (
              <li key={code}>
                <CategoryChip label={categoryLabel(code)} />
              </li>
            ))}
          </ul>
        ) : null}
        <ul aria-label="Original sources" className="mt-4 flex flex-wrap items-center gap-2">
          {website ? (
            <li>
              <a
                href={website.href}
                {...EXTERNAL_LINK_PROPS}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-strong bg-surface-2 px-3 type-body text-fg motion-colors hover:bg-surface-3"
              >
                {website.host}
                <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-fg-muted" />
                <span className="sr-only">(opens the company website in a new tab)</span>
              </a>
            </li>
          ) : null}
          {sourceLinks.map(({ account, link }) => (
            <li key={account.id}>
              <a
                href={link.href}
                {...EXTERNAL_LINK_PROPS}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm px-1 motion-colors hover:bg-surface-2"
                title={`${COLLECTION_TYPE_LABEL[account.platform]} · ${link.host}`}
              >
                <PlatformBadge platform={account.platform} />
                <span className="sr-only">(opens the original profile in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
