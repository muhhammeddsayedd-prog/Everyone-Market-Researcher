import { notFound } from 'next/navigation';
import { UnavailablePanel } from '@/components/ui/states';
import { requireMember } from '@/lib/auth/viewer';
import { getCompanyProfile } from '@/lib/data/competitors';
import { plannedTab } from '@/lib/directory/profile-tabs';

type Props = { params: Promise<{ slug: string; tab: string }> };

/** Profile tabs whose evidence has not been collected or processed yet. */
export default async function PlannedProfileTab({ params }: Props) {
  await requireMember();
  const { slug, tab } = await params;
  const section = plannedTab(tab);
  if (!section) notFound();
  const company = await getCompanyProfile(slug);
  if (!company) notFound();
  return (
    <UnavailablePanel
      title={`${section.label} for ${company.name}`}
      reason="Nothing is shown until these records exist. No sample data is used in their place."
      dependency={section.needs}
    />
  );
}
