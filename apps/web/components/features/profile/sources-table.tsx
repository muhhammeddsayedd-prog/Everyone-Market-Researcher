import { ExternalLink } from 'lucide-react';
import { PlatformBadge } from '@/components/ui/badges';
import { StatusPill } from '@/components/ui/status-pill';
import type { SourceAccount } from '@/lib/data/competitors';
import { isReviewedYouTubeExclusion } from '@/lib/data/exclusions';
import { formatCount, formatDateTime, formatRelative } from '@/lib/view/format';
import { EXTERNAL_LINK_PROPS, safeExternalUrl } from '@/lib/view/safe-url';
import {
  ACCOUNT_STATUS_META,
  BACKFILL_LABEL,
  COLLECTION_TYPE_LABEL,
  describeSourceError,
  FAMILY_LABEL,
  PLATFORM_FAMILY,
  RESOLVE_STATUS_META,
  resolveStatusOf,
  type PlatformFamily,
} from '@/lib/view/sources';

const FAMILY_ORDER: PlatformFamily[] = ['vimeo', 'instagram', 'website', 'linkedin', 'youtube', 'news'];

function SourceLink({ account }: { account: SourceAccount }) {
  const link = safeExternalUrl(account.url);
  if (!link) return <span className="text-fg-muted">{account.handle} (link unavailable)</span>;
  return (
    <a
      href={link.href}
      {...EXTERNAL_LINK_PROPS}
      className="inline-flex max-w-full items-center gap-1 rounded-sm text-fg underline-offset-4 hover:underline"
    >
      <span className="truncate" dir="auto">
        {account.handle}
      </span>
      <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-fg-muted" />
      <span className="sr-only">
        (opens the original {COLLECTION_TYPE_LABEL[account.platform]} source in a new tab)
      </span>
    </a>
  );
}

function Evidence({ account }: { account: SourceAccount }) {
  if (account.last_success_at)
    return (
      <span title={formatDateTime(account.last_success_at)} className="whitespace-nowrap text-fg-secondary">
        Collected {formatRelative(account.last_success_at)}
      </span>
    );
  return <span className="text-fg-muted">Not collected yet</span>;
}

function ErrorNote({ account, companyCode }: { account: SourceAccount; companyCode: string }) {
  const description = describeSourceError(account.last_error);
  const reviewed = isReviewedYouTubeExclusion(companyCode, account.platform, account.status);
  if (!description && !reviewed) return <span className="text-fg-muted">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {description ? (
        <span className="line-clamp-2 text-fg-secondary" title={account.last_error ?? undefined} dir="auto">
          {description}
        </span>
      ) : null}
      {reviewed ? <span className="type-small text-fg-muted">Reviewed exclusion (D-27): skipped</span> : null}
      {account.last_error_at ? (
        <span className="type-small text-fg-muted">{formatDateTime(account.last_error_at)}</span>
      ) : null}
    </span>
  );
}

/**
 * Every recorded source for one company, grouped by platform. Configuration (status),
 * resolution, eligibility and observed collection are separate columns; collection types
 * that share one public profile are listed together under their platform.
 */
export function SourcesTable({ accounts, companyCode }: { accounts: SourceAccount[]; companyCode: string }) {
  const groups = FAMILY_ORDER.map((family) => ({
    family,
    rows: accounts.filter((account) => PLATFORM_FAMILY[account.platform] === family),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ family, rows }) => {
        const shared = new Set(rows.map((row) => row.url)).size < rows.length;
        return (
          <section key={family} aria-labelledby={`sources-${family}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`sources-${family}`} className="type-h3">
                {FAMILY_LABEL[family]}
              </h2>
              {shared ? (
                <p className="type-small text-fg-muted">
                  Collection types below share the same public profile; each is scheduled and reported
                  separately.
                </p>
              ) : null}
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-label={`${FAMILY_LABEL[family]} sources (scrollable)`}
              className="scroll-fade relative mt-3 hidden overflow-x-auto rounded-md border border-border lg:block"
            >
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <caption className="sr-only">{FAMILY_LABEL[family]} sources</caption>
                <thead className="bg-surface-2">
                  <tr className="type-micro text-fg-label">
                    <th scope="col" className="px-4 py-3">
                      Collection type
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Source
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Resolution
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Collection
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Last error
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Failures
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Items
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Backfill
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Next due
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface-1 type-small">
                  {rows.map((account) => {
                    const status = ACCOUNT_STATUS_META[account.status];
                    const resolution = RESOLVE_STATUS_META[resolveStatusOf(account.resolve_status)];
                    return (
                      <tr key={account.id} className="border-t border-border align-top">
                        <th scope="row" className="px-4 py-3 font-medium">
                          <PlatformBadge
                            platform={account.platform}
                            label={COLLECTION_TYPE_LABEL[account.platform]}
                          />
                        </th>
                        <td className="max-w-[240px] px-4 py-3">
                          <SourceLink account={account} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={status.tone} label={status.label} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={resolution.tone} label={resolution.label} />
                        </td>
                        <td className="px-4 py-3">
                          <Evidence account={account} />
                        </td>
                        <td className="min-w-[200px] max-w-[260px] px-4 py-3">
                          <ErrorNote account={account} companyCode={companyCode} />
                        </td>
                        <td className="px-4 py-3 text-right tabular text-fg-secondary">
                          {formatCount(account.consecutive_failures)}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-fg-secondary">
                          {formatCount(account.items_count)}
                        </td>
                        <td className="px-4 py-3 text-fg-secondary">
                          {BACKFILL_LABEL[account.backfill_status]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg-secondary">
                          {account.status === 'active' ? formatDateTime(account.next_due_at) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="mt-3 flex flex-col gap-2 lg:hidden">
              {rows.map((account) => {
                const status = ACCOUNT_STATUS_META[account.status];
                const resolution = RESOLVE_STATUS_META[resolveStatusOf(account.resolve_status)];
                return (
                  <li key={account.id} className="rounded-md border border-border bg-surface-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <PlatformBadge
                        platform={account.platform}
                        label={COLLECTION_TYPE_LABEL[account.platform]}
                      />
                      <StatusPill tone={status.tone} label={status.label} />
                    </div>
                    <div className="mt-3 type-body">
                      <SourceLink account={account} />
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 type-small">
                      <dt className="type-micro text-fg-label">Resolution</dt>
                      <dd>
                        <StatusPill tone={resolution.tone} label={resolution.label} />
                      </dd>
                      <dt className="type-micro text-fg-label">Collection</dt>
                      <dd>
                        <Evidence account={account} />
                      </dd>
                      <dt className="type-micro text-fg-label">Last error</dt>
                      <dd className="min-w-0">
                        <ErrorNote account={account} companyCode={companyCode} />
                      </dd>
                      <dt className="type-micro text-fg-label">Failures</dt>
                      <dd className="tabular text-fg-secondary">
                        {formatCount(account.consecutive_failures)}
                      </dd>
                      <dt className="type-micro text-fg-label">Items</dt>
                      <dd className="tabular text-fg-secondary">{formatCount(account.items_count)}</dd>
                      <dt className="type-micro text-fg-label">Backfill</dt>
                      <dd className="text-fg-secondary">{BACKFILL_LABEL[account.backfill_status]}</dd>
                      <dt className="type-micro text-fg-label">Next due</dt>
                      <dd className="text-fg-secondary">
                        {account.status === 'active' ? formatDateTime(account.next_due_at) : '—'}
                      </dd>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
