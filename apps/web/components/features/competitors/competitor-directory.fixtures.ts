import type { Database } from '@emr/shared';

export type DirectoryFixture = Readonly<
  Pick<
    Database['app']['Tables']['competitors']['Row'],
    | 'company_code'
    | 'slug'
    | 'name'
    | 'name_ar'
    | 'markets'
    | 'hq_country'
    | 'categories'
    | 'in_house'
    | 'priority_tier'
    | 'pilot_rank'
    | 'is_baseline'
  >
>;

// Frozen public catalog subset from data/competitors.csv, 17 October 2026.
// Taxonomy normalization is checked against the existing M02 seed planner.
// No operational state, collected activity, external assets or database IDs.
export const fixtureCompanyCodes = [
  'C000',
  'C001',
  'C130',
  'C150',
  'C283',
  'C020',
  'C039',
  'C019',
  'C016',
  'C032',
  'C037',
  'C034',
] as const;

export const competitorFixtures = [
  {
    company_code: 'C000',
    slug: 'everyone-films',
    name: 'Everyone Films',
    name_ar: null,
    markets: ['EG', 'KSA', 'UAE'],
    hq_country: 'EG',
    categories: ['production', 'ai_production', 'post_production'],
    in_house: [],
    priority_tier: 'baseline',
    pilot_rank: null,
    is_baseline: true,
  },
  {
    company_code: 'C001',
    slug: 'good-people',
    name: 'Good People',
    name_ar: null,
    markets: ['EG', 'UAE'],
    hq_country: 'EG',
    categories: ['production', 'production_services'],
    in_house: ['directors_roster', 'line_production'],
    priority_tier: 'pilot',
    pilot_rank: 1,
    is_baseline: false,
  },
  {
    company_code: 'C130',
    slug: 'bigfoot-films',
    name: 'Bigfoot Films',
    name_ar: null,
    markets: ['EG', 'KSA', 'UAE'],
    hq_country: 'EG',
    categories: ['production', 'film_and_tv'],
    in_house: ['not_stated_on_own_site'],
    priority_tier: 'pilot',
    pilot_rank: 2,
    is_baseline: false,
  },
  {
    company_code: 'C150',
    slug: 'lobster-films',
    name: 'Lobster Films',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['production', 'production_services', 'film_and_tv', 'post_production', 'vfx_cgi'],
    in_house: ['line_production', 'creative_and_scriptwriting'],
    priority_tier: 'pilot',
    pilot_rank: 6,
    is_baseline: false,
  },
  {
    company_code: 'C283',
    slug: 'wonderful-productions',
    name: 'Wonderful Productions',
    name_ar: null,
    markets: ['UAE', 'KSA'],
    hq_country: 'UAE',
    categories: ['production', 'production_services'],
    in_house: ['locations_and_permits', 'line_production', 'casting'],
    priority_tier: 'pilot',
    pilot_rank: 47,
    is_baseline: false,
  },
  {
    company_code: 'C020',
    slug: 'age-language',
    name: 'Age Language',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['production'],
    in_house: ['other'],
    priority_tier: 'next_wave',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C039',
    slug: 'al-arabia-cinema',
    name: 'Al Arabia Cinema',
    name_ar: null,
    markets: ['EG', 'UAE', 'KSA'],
    hq_country: 'EG',
    categories: ['film_and_tv'],
    in_house: ['film_distribution', 'other'],
    priority_tier: 'next_wave',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C019',
    slug: 'cairo-news-company',
    name: 'Cairo News Company',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['production_services', 'film_and_tv'],
    in_house: ['not_stated_on_own_site'],
    priority_tier: 'next_wave',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C016',
    slug: 'admepro-advertising-agency',
    name: 'Admepro Advertising Agency',
    name_ar: null,
    markets: ['EG', 'UAE', 'KSA'],
    hq_country: 'EG',
    categories: [
      'creative_agency',
      'digital_and_social',
      'production',
      'ai_production',
      'photography',
      'animation_motion',
    ],
    in_house: ['creative_and_scriptwriting', 'social_media_management', 'media_buying_distribution'],
    priority_tier: 'adjacent',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C032',
    slug: 'blue-studio-for-voice-over-and-dubbing',
    name: 'Blue Studio for Voice Over & Dubbing',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['sound_and_music'],
    in_house: ['not_stated_on_own_site'],
    priority_tier: 'adjacent',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C037',
    slug: 'cactus-marketing-agency',
    name: 'Cactus Marketing Agency',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['digital_and_social', 'creative_agency', 'production'],
    in_house: ['creative_and_scriptwriting', 'social_media_management'],
    priority_tier: 'adjacent',
    pilot_rank: null,
    is_baseline: false,
  },
  {
    company_code: 'C034',
    slug: 'dma-agency',
    name: 'DMA Agency',
    name_ar: null,
    markets: ['EG'],
    hq_country: 'EG',
    categories: ['creative_agency', 'digital_and_social', 'animation_motion'],
    in_house: [
      'creative_and_scriptwriting',
      'motion_graphics',
      'social_media_management',
      'media_buying_distribution',
    ],
    priority_tier: 'adjacent',
    pilot_rank: null,
    is_baseline: false,
  },
] satisfies readonly DirectoryFixture[];

export const tierLabels = {
  baseline: 'Baseline',
  pilot: 'Pilot',
  next_wave: 'Next wave',
  adjacent: 'Adjacent',
} as const;
export const marketLabels = {
  EG: 'Egypt',
  KSA: 'Saudi Arabia',
  UAE: 'United Arab Emirates',
  OTHER: 'Other',
} as const;
export const categoryLabels: Readonly<Record<string, string>> = {
  production: 'Production',
  film_and_tv: 'Film & TV',
  post_production: 'Post-production',
  vfx_cgi: 'VFX / CGI',
  animation_motion: 'Animation / Motion',
  photography: 'Photography',
  digital_and_social: 'Digital & Social',
  production_services: 'Production services',
  events_and_experiential: 'Events & Experiential',
  creative_agency: 'Creative agency',
  equipment_and_studio_rental: 'Equipment & Studio rental',
  ai_production: 'AI production',
  sound_and_music: 'Sound & Music',
};
