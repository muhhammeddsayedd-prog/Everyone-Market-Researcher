import { Briefcase, Camera, Globe, Newspaper, SquarePlay, Video } from 'lucide-react';
import type { PlatformFamily } from '@/lib/view/sources';

// lucide-react ships no brand marks, so each platform uses a neutral glyph plus its label/colour.
const GLYPH = {
  vimeo: Video,
  instagram: Camera,
  website: Globe,
  linkedin: Briefcase,
  youtube: SquarePlay,
  news: Newspaper,
} as const;

export function PlatformGlyph({ family, className }: { family: PlatformFamily; className?: string }) {
  const Icon = GLYPH[family];
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className} />;
}
