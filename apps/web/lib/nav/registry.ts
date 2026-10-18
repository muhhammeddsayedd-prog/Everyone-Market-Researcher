import { roleAtLeast, type MemberRole } from '@/lib/auth/roles';

/**
 * Every specified page, its owning milestone and what it still needs. Pages that are not
 * connected render a ComingSoon page naming that dependency instead of a fake interface.
 * This is the in-app page/dependency map; apps/web/README.md mirrors it.
 */
export type NavGroup = 'radar' | 'market' | 'work' | 'admin' | 'footer';

export type NavIcon =
  | 'pulse'
  | 'feed'
  | 'campaigns'
  | 'briefs'
  | 'news'
  | 'competitors'
  | 'coverage'
  | 'brands'
  | 'agencies'
  | 'people'
  | 'markets'
  | 'compare'
  | 'review'
  | 'search'
  | 'pipeline'
  | 'costs'
  | 'users'
  | 'taxonomies'
  | 'docs'
  | 'settings';

export type PageEntry = {
  path: string;
  label: string;
  group: NavGroup;
  icon: NavIcon;
  milestone: string;
  /** 'live' pages read real records; 'planned' pages show what they wait for. */
  state: 'live' | 'planned';
  needs?: string;
  minRole?: MemberRole;
  inNav?: boolean;
};

export const PAGES: PageEntry[] = [
  {
    path: '/',
    label: 'Pulse',
    group: 'radar',
    icon: 'pulse',
    milestone: 'M09',
    state: 'planned',
    needs: 'Published items and stats_daily from the pilot collection (M04–M08).',
  },
  {
    path: '/feed',
    label: 'Feed',
    group: 'radar',
    icon: 'feed',
    milestone: 'M09',
    state: 'planned',
    needs: 'Collected and AI-published items in app.feed_v (M04–M08).',
  },
  {
    path: '/campaigns',
    label: 'Campaigns',
    group: 'radar',
    icon: 'campaigns',
    milestone: 'M10',
    state: 'planned',
    needs: 'Campaign linking output in app.campaigns_v (M08).',
  },
  {
    path: '/briefs',
    label: 'Briefs',
    group: 'radar',
    icon: 'briefs',
    milestone: 'M12',
    state: 'planned',
    needs: 'Weekly briefs generated after pilot days (M12).',
  },
  {
    path: '/news',
    label: 'News',
    group: 'radar',
    icon: 'news',
    milestone: 'M10',
    state: 'planned',
    needs: 'Weekly news and awards collection (M07).',
  },
  {
    path: '/competitors',
    label: 'Competitors',
    group: 'market',
    icon: 'competitors',
    milestone: 'M10',
    state: 'live',
  },
  {
    path: '/coverage',
    label: 'Coverage',
    group: 'market',
    icon: 'coverage',
    milestone: 'M10',
    state: 'live',
  },
  {
    path: '/brands',
    label: 'Brands',
    group: 'market',
    icon: 'brands',
    milestone: 'M10',
    state: 'planned',
    needs: 'Brand organisations extracted from items (M05–M06).',
  },
  {
    path: '/agencies',
    label: 'Agencies',
    group: 'market',
    icon: 'agencies',
    milestone: 'M10',
    state: 'planned',
    needs: 'Agency organisations extracted from items (M05–M06).',
  },
  {
    path: '/people',
    label: 'People',
    group: 'market',
    icon: 'people',
    milestone: 'M10',
    state: 'planned',
    needs: 'Item credits (M07).',
  },
  {
    path: '/markets',
    label: 'Markets',
    group: 'market',
    icon: 'markets',
    milestone: 'M10',
    state: 'planned',
    needs: 'stats_daily and published items by market (M04–M08).',
  },
  {
    path: '/compare',
    label: 'Compare',
    group: 'market',
    icon: 'compare',
    milestone: 'M10',
    state: 'planned',
    needs: 'Activity stats per competitor (stats_daily, M04–M08) and the M10 competitor overview view.',
  },
  {
    path: '/review',
    label: 'Review',
    group: 'work',
    icon: 'review',
    milestone: 'M11',
    state: 'planned',
    needs: 'Review tasks and the review_resolve mutation contract (M06, M11).',
    minRole: 'analyst',
  },
  {
    path: '/search',
    label: 'Search',
    group: 'work',
    icon: 'search',
    milestone: 'M11',
    state: 'planned',
    needs: 'Hybrid search with server-side embeddings (M11). Company name search works in Competitors now.',
    inNav: false,
  },
  {
    path: '/admin/competitors',
    label: 'Competitors',
    group: 'admin',
    icon: 'competitors',
    milestone: 'M11',
    state: 'planned',
    needs: 'admin_upsert_competitor and onboarding trigger contracts (M11).',
    minRole: 'admin',
  },
  {
    path: '/admin/taxonomies',
    label: 'Taxonomies',
    group: 'admin',
    icon: 'taxonomies',
    milestone: 'M11',
    state: 'planned',
    needs: 'Taxonomy admin mutations (M11).',
    minRole: 'admin',
  },
  {
    path: '/admin/pipeline',
    label: 'Pipeline',
    group: 'admin',
    icon: 'pipeline',
    milestone: 'M11',
    state: 'planned',
    needs: 'app.pipeline_summary and run history from the n8n foundation (M03–M04).',
    minRole: 'admin',
  },
  {
    path: '/admin/costs',
    label: 'Costs',
    group: 'admin',
    icon: 'costs',
    milestone: 'M11',
    state: 'planned',
    needs: 'app.costs_summary over the cost ledger (M03+).',
    minRole: 'admin',
  },
  {
    path: '/admin/users',
    label: 'Users & keys',
    group: 'admin',
    icon: 'users',
    milestone: 'M11',
    state: 'planned',
    needs: 'admin_invite_member and API key contracts (M11, M14).',
    minRole: 'admin',
  },
  {
    path: '/docs/api',
    label: 'API docs',
    group: 'footer',
    icon: 'docs',
    milestone: 'M14',
    state: 'planned',
    needs: 'The REST API and MCP server (M14).',
  },
  {
    path: '/settings',
    label: 'Settings',
    group: 'footer',
    icon: 'settings',
    milestone: 'M11',
    state: 'planned',
    needs: 'Alert rules and saved views (M11, M13).',
  },
];

export const GROUP_LABEL: Record<NavGroup, string> = {
  radar: 'Radar',
  market: 'Market',
  work: 'Work',
  admin: 'Admin',
  footer: '',
};

export function pageForPath(path: string): PageEntry | undefined {
  return PAGES.find((page) => page.path === path);
}

/** Navigation visible to a role. Server routes enforce the same rule (404 otherwise). */
export function navFor(role: MemberRole): PageEntry[] {
  return PAGES.filter((page) => page.inNav !== false && (!page.minRole || roleAtLeast(role, page.minRole)));
}
