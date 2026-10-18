import { ComingSoon } from '@/components/features/coming-soon';
import { requireMember } from '@/lib/auth/viewer';
import { pageForPath } from '@/lib/nav/registry';

export default async function PulsePage() {
  await requireMember();
  return <ComingSoon page={pageForPath('/')!} />;
}
