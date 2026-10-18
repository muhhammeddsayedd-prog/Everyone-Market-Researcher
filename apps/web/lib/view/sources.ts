import type { Database } from '@emr/shared';

export type Platform = Database['app']['Enums']['platform'];
export type AccountStatus = Database['app']['Enums']['account_status'];
export type BackfillStatus = Database['app']['Enums']['backfill_status'];
export type ResolveStatus = 'pending' | 'resolved' | 'failed' | 'not_needed';

/** Platform families share one public profile; each member is a separate collection type. */
export type PlatformFamily = 'vimeo' | 'instagram' | 'website' | 'linkedin' | 'youtube' | 'news';

export const PLATFORM_FAMILY: Record<Platform, PlatformFamily> = {
  vimeo: 'vimeo',
  instagram: 'instagram',
  instagram_stories: 'instagram',
  website: 'website',
  website_work_page: 'website',
  linkedin: 'linkedin',
  linkedin_employees: 'linkedin',
  youtube: 'youtube',
  news: 'news',
};

/** The five platform dots shown in the directory, in DESIGN order. */
export const HEALTH_FAMILIES: PlatformFamily[] = ['vimeo', 'instagram', 'website', 'linkedin', 'youtube'];

export const FAMILY_LABEL: Record<PlatformFamily, string> = {
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  website: 'Website',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  news: 'News',
};

export const COLLECTION_TYPE_LABEL: Record<Platform, string> = {
  vimeo: 'Vimeo videos',
  instagram: 'Instagram posts',
  instagram_stories: 'Instagram stories',
  website: 'Website',
  website_work_page: 'Website work page',
  linkedin: 'LinkedIn posts',
  linkedin_employees: 'LinkedIn employees',
  youtube: 'YouTube videos',
  news: 'News',
};

export type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'info';

/** DESIGN.md §3.3 is authoritative: active/failing/paused/invalid = success/danger/muted/warning. */
export const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  failing: { label: 'Failing', tone: 'danger' },
  paused: { label: 'Paused', tone: 'muted' },
  invalid: { label: 'Invalid', tone: 'warning' },
  disabled: { label: 'Disabled', tone: 'muted' },
};

export const RESOLVE_STATUS_META: Record<ResolveStatus, { label: string; tone: Tone }> = {
  resolved: { label: 'Resolved', tone: 'success' },
  not_needed: { label: 'Not required', tone: 'muted' },
  pending: { label: 'Pending', tone: 'info' },
  failed: { label: 'Failed', tone: 'warning' },
};

export const BACKFILL_LABEL: Record<BackfillStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  not_applicable: 'Not applicable',
};

export function resolveStatusOf(value: string): ResolveStatus {
  return value === 'resolved' || value === 'failed' || value === 'not_needed' ? value : 'pending';
}

/** Recorded error codes translated to plain English; unknown text is shown as recorded. */
export function describeSourceError(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === 'yt_not_found') return 'YouTube channel not found';
  if (code === 'yt_custom_url_unresolved') return 'Custom YouTube URL could not be resolved';
  const unreachable = /^unreachable_(network|timeout|([1-5]\d{2}))$/.exec(code);
  if (unreachable) {
    if (unreachable[1] === 'network') return 'Website unreachable (network)';
    if (unreachable[1] === 'timeout') return 'Website unreachable (timeout)';
    return `Website unreachable (HTTP ${unreachable[1]})`;
  }
  return code;
}

/** Five-dot health for one family: the worst status among its collection types. */
const SEVERITY: Record<AccountStatus, number> = { failing: 4, invalid: 3, active: 2, paused: 1, disabled: 0 };

export type FamilyHealth = { family: PlatformFamily; status: AccountStatus | null };

export function familyHealth(accounts: { platform: Platform; status: AccountStatus }[]): FamilyHealth[] {
  return HEALTH_FAMILIES.map((family) => {
    let worst: AccountStatus | null = null;
    for (const account of accounts) {
      if (PLATFORM_FAMILY[account.platform] !== family) continue;
      if (worst === null || SEVERITY[account.status] > SEVERITY[worst]) worst = account.status;
    }
    return { family, status: worst };
  });
}
