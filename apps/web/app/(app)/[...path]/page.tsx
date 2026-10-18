import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComingSoon } from '@/components/features/coming-soon';
import { roleAtLeast } from '@/lib/auth/roles';
import { requireMember } from '@/lib/auth/viewer';
import { pageForPath } from '@/lib/nav/registry';

type Props = { params: Promise<{ path: string[] }> };

function lookup(segments: string[]) {
  return pageForPath(`/${segments.map((segment) => decodeURIComponent(segment)).join('/')}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = lookup((await params).path);
  return { title: page?.label ?? 'Not found' };
}

/** Specified-but-unconnected pages. Unknown paths and pages above the member's role are 404s. */
export default async function PlannedPage({ params }: Props) {
  const member = await requireMember();
  const page = lookup((await params).path);
  if (!page || page.state !== 'planned') notFound();
  if (page.minRole && !roleAtLeast(member.role, page.minRole)) notFound();
  return <ComingSoon page={page} />;
}
