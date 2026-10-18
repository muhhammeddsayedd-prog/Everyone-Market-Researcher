import { notFound } from 'next/navigation';
import { MARKET_NAME, TIER_LABEL } from '@/components/ui/badges';
import { StatusPill } from '@/components/ui/status-pill';
import { KeyValue, UnavailablePanel } from '@/components/ui/states';
import { requireMember } from '@/lib/auth/viewer';
import { getCompanyProfile } from '@/lib/data/competitors';
import { formatCount, formatDate, formatDateTime } from '@/lib/view/format';
import { EXTERNAL_LINK_PROPS, safeExternalUrl } from '@/lib/view/safe-url';
import { ACCOUNT_STATUS_META, type AccountStatus } from '@/lib/view/sources';

type Props = { params: Promise<{ slug: string }> };

export default async function CompanyOverviewPage({ params }: Props) {
  await requireMember();
  const company = await getCompanyProfile((await params).slug);
  if (!company) notFound();

  const website = safeExternalUrl(company.website_url);
  const itemsRecorded = company.accounts.reduce((sum, account) => sum + account.items_count, 0);
  const lastSuccess = company.accounts
    .map((account) => account.last_success_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const statusCounts = new Map<AccountStatus, number>();
  for (const account of company.accounts)
    statusCounts.set(account.status, (statusCounts.get(account.status) ?? 0) + 1);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <section aria-labelledby="facts" className="lg:col-span-8">
        <h2 id="facts" className="type-h3">
          Key facts
        </h2>
        <KeyValue
          className="mt-4"
          items={[
            { label: 'Company code', value: <span className="tabular">{company.company_code}</span> },
            {
              label: 'Markets',
              value: company.markets.length ? company.markets.map((m) => MARKET_NAME[m]).join(', ') : '—',
            },
            { label: 'Headquarters', value: company.hq_country ? MARKET_NAME[company.hq_country] : '—' },
            { label: 'Tier', value: TIER_LABEL[company.priority_tier] },
            { label: 'Pilot rank', value: company.pilot_rank ?? '—' },
            { label: 'Tracking status', value: <span className="capitalize">{company.status}</span> },
            {
              label: 'Website',
              value: website ? (
                <a
                  href={website.href}
                  {...EXTERNAL_LINK_PROPS}
                  className="text-fg underline underline-offset-4"
                >
                  {website.host}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                '—'
              ),
            },
            {
              label: 'Logo',
              value: company.hasStoredLogo ? 'Stored copy of the public logo' : 'Initials (no stored logo)',
            },
            {
              label: 'Items recorded',
              value: itemsRecorded ? formatCount(itemsRecorded) : 'None collected yet',
            },
            {
              label: 'Last successful collection',
              value: lastSuccess ? formatDateTime(lastSuccess) : 'Not yet',
            },
            { label: 'Record updated', value: formatDate(company.updated_at) },
          ]}
        />
        {company.notes ? (
          <section aria-labelledby="notes" className="mt-8">
            <h2 id="notes" className="type-h3">
              Research notes
            </h2>
            <p className="mt-3 max-w-[72ch] whitespace-pre-line type-body-lg text-fg-secondary" dir="auto">
              {company.notes}
            </p>
          </section>
        ) : null}
        <UnavailablePanel
          className="mt-8"
          title="Activity, clients and formats"
          reason="Output charts, top clients and the comparison with everyone. need collected and published items. They appear here once collection runs for this company."
          dependency="stats_daily, app.feed_v and app.campaigns_v (M04–M08), shown in M10."
        />
      </section>

      <aside aria-labelledby="sources-summary" className="lg:col-span-4">
        <div className="rounded-md border border-border bg-surface-1 p-5">
          <h2 id="sources-summary" className="type-h3">
            Sources
          </h2>
          <p className="mt-1 type-body text-fg-muted">
            {formatCount(company.accounts.length)} source records for this company.
          </p>
          {company.accounts.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {[...statusCounts.entries()].map(([status, count]) => (
                <li key={status} className="flex items-center justify-between">
                  <StatusPill
                    tone={ACCOUNT_STATUS_META[status].tone}
                    label={ACCOUNT_STATUS_META[status].label}
                  />
                  <span className="type-body tabular text-fg-secondary">{formatCount(count)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-5 type-small text-fg-muted">Each source is listed in the Sources tab.</p>
        </div>
      </aside>
    </div>
  );
}
