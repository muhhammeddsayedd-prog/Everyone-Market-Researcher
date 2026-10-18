/** In-house capability codes grouped for the profile (M10 T4). Unknown codes go to "Other". */
export type CapabilityGroup = 'pre_production' | 'shoot' | 'post' | 'distribution' | 'other';

export const CAPABILITY_GROUP_ORDER: CapabilityGroup[] = [
  'pre_production',
  'shoot',
  'post',
  'distribution',
  'other',
];

export const CAPABILITY_GROUP_LABEL: Record<CapabilityGroup, string> = {
  pre_production: 'Pre-production',
  shoot: 'Shoot',
  post: 'Post',
  distribution: 'Distribution',
  other: 'Other',
};

const GROUP_OF: Record<string, CapabilityGroup> = {
  creative_and_scriptwriting: 'pre_production',
  directors_roster: 'pre_production',
  line_production: 'pre_production',
  casting: 'pre_production',
  locations_and_permits: 'pre_production',
  set_design_and_art_dept: 'pre_production',
  camera_and_lighting_kit: 'shoot',
  studio_soundstage: 'shoot',
  drone_aerial: 'shoot',
  virtual_production_led: 'shoot',
  photography: 'shoot',
  live_streaming_broadcast: 'shoot',
  editing: 'post',
  colour_grading: 'post',
  vfx_cgi: 'post',
  '3d_and_animation': 'post',
  motion_graphics: 'post',
  sound_design_and_mix: 'post',
  music_composition: 'post',
  voice_over_dubbing: 'post',
  subtitling_and_localisation: 'post',
  ai_generation: 'post',
  social_media_management: 'distribution',
  media_buying_distribution: 'distribution',
  film_distribution: 'distribution',
  other: 'other',
};

/** Code recorded when the company's own site states no capabilities; shown as a note, not a chip. */
export const NOT_STATED_CODE = 'not_stated_on_own_site';

export function capabilityGroupOf(code: string): CapabilityGroup {
  return GROUP_OF[code] ?? 'other';
}

export function groupCapabilities(codes: readonly string[]): { group: CapabilityGroup; codes: string[] }[] {
  const buckets = new Map<CapabilityGroup, string[]>();
  for (const code of codes) {
    if (code === NOT_STATED_CODE) continue;
    const group = capabilityGroupOf(code);
    buckets.set(group, [...(buckets.get(group) ?? []), code]);
  }
  return CAPABILITY_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    codes: buckets.get(group)!,
  }));
}
