import { ButtonLink } from '@/components/ui/button';
import { UnavailablePanel } from '@/components/ui/states';
import type { PageEntry } from '@/lib/nav/registry';
import { PageHeader } from './page-header';

/** A specified page that is not connected yet: names its milestone and what it waits for. */
export function ComingSoon({ page }: { page: PageEntry }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={`Planned · ${page.milestone}`} title={page.label} />
      <UnavailablePanel
        title={`${page.label} isn't connected yet`}
        reason="This page shows nothing until the records it depends on exist. No sample data is shown in its place."
        dependency={page.needs}
      />
      <div>
        <ButtonLink href="/competitors" variant="secondary">
          Browse competitors
        </ButtonLink>
      </div>
    </div>
  );
}
