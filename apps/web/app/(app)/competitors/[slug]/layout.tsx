import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { EntityHeader } from '@/components/features/profile/entity-header';
import { BackToList, ProfileTabs } from '@/components/features/profile/profile-nav';
import { requireMember } from '@/lib/auth/viewer';
import { getCompanyProfile } from '@/lib/data/competitors';
import { getTaxonomyLabels, labelFor } from '@/lib/data/taxonomy';

type Props = { children: ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const company = await getCompanyProfile((await params).slug);
  return { title: company?.name ?? 'Not found' };
}

export default async function CompanyLayout({ children, params }: Props) {
  await requireMember();
  const { slug } = await params;
  const [company, taxonomy] = await Promise.all([getCompanyProfile(slug), getTaxonomyLabels()]);
  if (!company) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-9" />}>
        <BackToList />
      </Suspense>
      <EntityHeader company={company} categoryLabel={(code) => labelFor(taxonomy.categories, code)} />
      <Suspense fallback={<div className="h-11 border-b border-border" />}>
        <ProfileTabs slug={company.slug} />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
