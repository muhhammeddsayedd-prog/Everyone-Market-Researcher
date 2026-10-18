import { notFound } from 'next/navigation';
import { SourcesTable } from '@/components/features/profile/sources-table';
import { EmptyState } from '@/components/ui/states';
import { requireMember } from '@/lib/auth/viewer';
import { getCompanyProfile } from '@/lib/data/competitors';

type Props = { params: Promise<{ slug: string }> };

export default async function CompanySourcesPage({ params }: Props) {
  await requireMember();
  const company = await getCompanyProfile((await params).slug);
  if (!company) notFound();

  if (company.accounts.length === 0)
    return (
      <EmptyState
        title="No sources recorded for this company."
        hint="A missing source is not evidence that the company has no account; it was not supplied or verified."
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[72ch] type-body text-fg-muted">
        Status is the recorded configuration. Resolution says whether the account identity is confirmed.
        Collection shows only successes actually observed. Paused and invalid sources are not collected.
      </p>
      <SourcesTable accounts={company.accounts} companyCode={company.company_code} />
    </div>
  );
}
