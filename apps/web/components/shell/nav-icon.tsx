import {
  Activity,
  BookOpen,
  Building,
  Coins,
  FileText,
  Gauge,
  GitCompare,
  Globe,
  Layers,
  ListTree,
  Megaphone,
  Newspaper,
  Rows3,
  Search,
  Settings,
  SquareCheck,
  Tag,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react';
import type { NavIcon as NavIconName } from '@/lib/nav/registry';

const ICONS = {
  pulse: Activity,
  feed: Rows3,
  campaigns: Layers,
  briefs: FileText,
  news: Newspaper,
  competitors: Building,
  coverage: Gauge,
  brands: Tag,
  agencies: Megaphone,
  people: Users,
  markets: Globe,
  compare: GitCompare,
  review: SquareCheck,
  search: Search,
  pipeline: Workflow,
  costs: Coins,
  users: UserCog,
  taxonomies: ListTree,
  docs: BookOpen,
  settings: Settings,
} as const;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className ?? 'size-4'} />;
}
