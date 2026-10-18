/** Competitor profile tabs as URL segments (DESIGN.md §8.9). Planned tabs name their dependency. */
export type ProfileTab = {
  segment: string;
  label: string;
  state: 'live' | 'planned';
  needs?: string;
};

export const PROFILE_TABS: ProfileTab[] = [
  { segment: '', label: 'Overview', state: 'live' },
  { segment: 'accounts', label: 'Sources', state: 'live' },
  { segment: 'capabilities', label: 'In-house', state: 'live' },
  {
    segment: 'campaigns',
    label: 'Campaigns',
    state: 'planned',
    needs: 'Campaign linking output in app.campaigns_v (M08, shown in M10).',
  },
  {
    segment: 'posts',
    label: 'Posts',
    state: 'planned',
    needs: 'Collected and AI-published items in app.feed_v (M04–M08).',
  },
  {
    segment: 'clients',
    label: 'Clients',
    state: 'planned',
    needs: 'Brands extracted from this company’s items (M05–M06).',
  },
  {
    segment: 'agencies',
    label: 'Agencies',
    state: 'planned',
    needs: 'Agencies extracted from this company’s items (M05–M06).',
  },
  { segment: 'people', label: 'People', state: 'planned', needs: 'Item credits (M07).' },
  {
    segment: 'team',
    label: 'Team',
    state: 'planned',
    needs: 'Weekly LinkedIn employee snapshots (M05).',
  },
  { segment: 'news', label: 'News', state: 'planned', needs: 'Weekly news and awards collection (M07).' },
];

export function plannedTab(segment: string): ProfileTab | undefined {
  return PROFILE_TABS.find((tab) => tab.segment === segment && tab.state === 'planned');
}
