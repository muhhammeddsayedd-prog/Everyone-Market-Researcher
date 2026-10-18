import { notFound } from 'next/navigation';
import { CategoryChip } from '@/components/ui/badges';
import { EmptyState } from '@/components/ui/states';
import { requireMember } from '@/lib/auth/viewer';
import { getCompanyProfile } from '@/lib/data/competitors';
import { getTaxonomyLabels, labelFor } from '@/lib/data/taxonomy';
import { CAPABILITY_GROUP_LABEL, groupCapabilities, NOT_STATED_CODE } from '@/lib/taxonomy/groups';

type Props = { params: Promise<{ slug: string }> };

export default async function CompanyCapabilitiesPage({ params }: Props) {
  await requireMember();
  const [company, taxonomy] = await Promise.all([
    getCompanyProfile((await params).slug),
    getTaxonomyLabels(),
  ]);
  if (!company) notFound();

  const groups = groupCapabilities(company.in_house);
  const notStated = company.in_house.includes(NOT_STATED_CODE);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="in-house">
        <h2 id="in-house" className="type-h3">
          In-house capabilities
        </h2>
        {groups.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={notStated ? 'Not stated on the company’s own site.' : 'No in-house capabilities recorded.'}
            hint="Values come from the research sheet; nothing is inferred."
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map(({ group, codes }) => (
              <div key={group} className="rounded-md border border-border bg-surface-1 p-5">
                <h3 className="type-micro text-fg-label">{CAPABILITY_GROUP_LABEL[group]}</h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {codes.map((code) => (
                    <li key={code}>
                      <CategoryChip label={labelFor(taxonomy.capabilities, code)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="categories">
        <h2 id="categories" className="type-h3">
          Categories
        </h2>
        {company.categories.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {company.categories.map((code) => (
              <li key={code}>
                <CategoryChip label={labelFor(taxonomy.categories, code)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 type-body text-fg-muted">—</p>
        )}
      </section>

      {company.notes ? (
        <section aria-labelledby="sheet-notes">
          <h2 id="sheet-notes" className="type-h3">
            Notes from the research sheet
          </h2>
          <p className="mt-3 max-w-[72ch] whitespace-pre-line type-body-lg text-fg-secondary" dir="auto">
            {company.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
