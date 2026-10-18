import { describe, expect, it } from 'vitest';
import {
  canonicalUrl,
  normalizeInstagram,
  normalizeLinkedIn,
  normalizeVimeo,
  normalizeWebsite,
  normalizeYouTube,
} from './handles';

describe('account normalization: real competitor_accounts.csv URLs', () => {
  // These 38 inputs are copied from the public seed CSV, with explicit expected identities.
  it.each([
    ['https://www.instagram.com/everyone.film/', 'everyone.film'],
    ['https://www.instagram.com/admeproagency/', 'admeproagency'],
    ['https://www.instagram.com/alarabiacinema/', 'alarabiacinema'],
    ['https://www.instagram.com/armartsproduction/', 'armartsproduction'],
    ['https://www.instagram.com/aromastudios/', 'aromastudios'],
    ['https://www.instagram.com/cactus.m.agency', 'cactus.m.agency'],
  ])('normalizes Instagram %s', (input, handle) => {
    expect(normalizeInstagram(input)).toBe(handle);
  });

  it.each([
    ['https://vimeo.com/everyonefilms', 'everyonefilms'],
    ['https://vimeo.com/admepro', 'admepro'],
    ['https://vimeo.com/user163427911', 'user163427911'],
    ['https://vimeo.com/aromastudios', 'aromastudios'],
    ['https://vimeo.com/user116247614', 'user116247614'],
    ['https://vimeo.com/user16469187', 'user16469187'],
    ['https://vimeo.com/3dmediaproduction', '3dmediaproduction'],
    ['https://vimeo.com/1505studio', '1505studio'],
  ])('normalizes Vimeo %s', (input, handle) => {
    expect(normalizeVimeo(input)).toEqual({ kind: 'user', handle });
  });

  it.each([
    ['https://www.youtube.com/channel/UCihEH7Bk23zVkIYMCBqvjgQ', 'channel', 'UCihEH7Bk23zVkIYMCBqvjgQ'],
    ['https://www.youtube.com/user/AlarabiaCinema', 'user', 'alarabiacinema'],
    ['https://www.youtube.com/@ARMARTS', 'handle', 'armarts'],
    ['https://www.youtube.com/@ContentPlusProduction', 'handle', 'contentplusproduction'],
    ['https://www.youtube.com/@Egyptian-Production', 'handle', 'egyptian-production'],
    ['https://www.youtube.com/@essenceadverts', 'handle', 'essenceadverts'],
  ])('normalizes YouTube %s', (input, kind, value) => {
    expect(normalizeYouTube(input)).toEqual({ kind, value });
  });

  it.each([
    ['https://www.linkedin.com/company/everyonefilms/', 'everyonefilms'],
    ['https://www.linkedin.com/company/adme-pro', 'adme-pro'],
    ['https://www.linkedin.com/company/alcegypt', 'alcegypt'],
    ['https://www.linkedin.com/company/al-arabia-cinema', 'al-arabia-cinema'],
    ['https://www.linkedin.com/company/armarts', 'armarts'],
    ['https://www.linkedin.com/company/aroma-designs&solutions', 'aroma-designs&solutions'],
  ])('normalizes LinkedIn %s', (input, slug) => {
    expect(normalizeLinkedIn(input)).toEqual({ kind: 'company', slug });
  });

  it.each([
    ['https://everyone.film/', 'everyone.film'],
    ['https://admepro.com/', 'admepro.com'],
    ['https://alcegypt.net/', 'alcegypt.net'],
    ['https://www.alarabiacinema.com/', 'alarabiacinema.com'],
    ['https://www.armarts.com/', 'armarts.com'],
    ['https://www.aromastudios.com/', 'aromastudios.com'],
  ])('normalizes website %s', (input, domain) => {
    expect(normalizeWebsite(input)).toEqual({ domain, url: input });
  });

  it.each([
    'https://everyone.film/by-everyone',
    'https://admepro.com/portfolio/',
    'https://alcegypt.net/en/profiles-p/',
    'https://www.alarabiacinema.com/movies',
    'https://www.armarts.com/en/commercials',
    'https://www.aromastudios.com/catalog',
  ])('keeps work-page path and trailing slash in %s', (input) => {
    expect(canonicalUrl(input)).toBe(input);
  });
});

describe('supported account forms', () => {
  it.each([
    '@EveryOne.Film',
    'instagram.com/EveryOne.Film/?hl=en#bio',
    'https://instagram.com/EveryOne.Film/?redirect=%2f%2e%2e%2f#tracking',
  ])('%s → Instagram handle', (input) => {
    expect(normalizeInstagram(input)).toBe('everyone.film');
  });

  it.each([
    ['https://vimeo.com/everyonefilms?fl=pp&fe=sh', 'user', 'everyonefilms'],
    ['http://www.vimeo.com/channels/BrandFilms/', 'channel', 'channels/brandfilms'],
    ['vimeo.com/showcase/123456', 'showcase', 'showcase/123456'],
    ['https://vimeo.com/groups/BrandFilms', 'group', 'groups/brandfilms'],
  ])('%s → Vimeo identity', (input, kind, handle) => {
    expect(normalizeVimeo(input)).toEqual({ kind, handle });
  });

  it.each([
    ['youtube.com/@FilmClinic/videos?view=0', 'handle', 'filmclinic'],
    ['https://www.youtube.com/user/telfaz11/featured', 'user', 'telfaz11'],
    ['https://youtube.com/c/iLikeAgency/videos', 'c', 'ilikeagency'],
    ['https://youtube.com/channel/UCihEH7Bk23zVkIYMCBqvjgQ/featured', 'channel', 'UCihEH7Bk23zVkIYMCBqvjgQ'],
    ['https://youtube.com/user/videos', 'user', 'videos'],
    ['https://youtube.com/c/featured', 'c', 'featured'],
  ])('%s → YouTube identity', (input, kind, value) => {
    expect(normalizeYouTube(input)).toEqual({ kind, value });
  });

  it.each([
    ['https://eg.linkedin.com/company/EveryOneFilms/?trk=public', 'company', 'everyonefilms'],
    ['https://www.linkedin.com/showcase/EveryOne-Films/', 'showcase', 'everyone-films'],
    ['https://uk.linkedin.com/school/Film-School', 'school', 'film-school'],
    ['https://www.linkedin.com/company/tr%C3%A8s-content/', 'company', 'très-content'],
    ['https://www.linkedin.com/company/content.plus', 'company', 'content.plus'],
  ])('%s → LinkedIn identity (reachability/policy is separate)', (input, kind, slug) => {
    expect(normalizeLinkedIn(input)).toEqual({ kind, slug });
  });

  it('canonicalizes the protocol/host and removes query and fragment without losing path case', () => {
    expect(canonicalUrl('  http://WWW.Example.com:80/Our-Work/?utm_source=ig#top  ')).toBe(
      'https://www.example.com/Our-Work/',
    );
  });

  it('normalizes a website domain separately from its canonical full-page URL', () => {
    expect(normalizeWebsite('WWW.Example.com/Our-Work?tracking=1')).toEqual({
      domain: 'example.com',
      url: 'https://www.example.com/Our-Work',
    });
  });

  it('is idempotent for an already canonical website URL', () => {
    const url = canonicalUrl('https://everyone.film/by-everyone?tracking=1');
    expect(canonicalUrl(url)).toBe(url);
  });
});

describe('unsafe or non-account inputs', () => {
  it.each([
    '',
    '   ',
    'ftp://example.com/work',
    'javascript:alert(1)',
    'file:///C:/private',
    'https://user:password@example.com/work',
    'https://localhost/work',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://[::1]/',
    'http://[2001:4860:4860::8888]/',
    'https://10.0.0.1/',
    'https://192.168.1.1/',
    'https://metadata.google.internal/',
    'https://example.local/',
    'https://example.test/',
    'https://example.com:8443/',
    'https://example.com\n.evil.com/',
    'https://example.com\\@evil.com/',
  ])('rejects unsafe URL %j', (input) => {
    expect(() => canonicalUrl(input)).toThrow(Error);
  });

  it.each([
    'https://instagram.com.evil.com/everyone.film/',
    'https://evilinstagram.com/everyone.film/',
    'https://instagram.com@evil.com/everyone.film/',
    'https://www.instagram.com/p/ABC/',
    'https://www.instagram.com/reels/ABC/',
    'https://www.instagram.com/reel/ABC/',
    'https://www.instagram.com/stories/everyone.film/',
    'https://www.instagram.com/p/../everyone.film/',
    'https://www.instagram.com/%2e%2e/everyone.film/',
    'https://www.instagram.com/everyone.film%2fp/ABC/',
    'https://www.instagram.com/everyone.film/tagged/',
    '@invalid handle',
    '@.',
    '@..',
    '@' + 'a'.repeat(31),
  ])('rejects invalid Instagram account %j', (input) => {
    expect(() => normalizeInstagram(input)).toThrow(Error);
  });

  it.each([
    'https://vimeo.com.evil.com/everyonefilms',
    'https://player.vimeo.com/video/123456',
    'https://vimeo.com/123456',
    'https://vimeo.com/everyonefilms/123456',
    'https://vimeo.com/channels/brand/123456',
    'https://vimeo.com/showcase/not-a-number',
    'https://vimeo.com/channels/',
  ])('rejects invalid Vimeo account %j', (input) => {
    expect(() => normalizeVimeo(input)).toThrow(Error);
  });

  it.each([
    'https://youtube.com.evil.com/@everyone',
    'https://youtu.be/ABC',
    'https://www.youtube.com/watch?v=ABC',
    'https://www.youtube.com/shorts/ABC',
    'https://www.youtube.com/playlist?list=UU123',
    'https://www.youtube.com/@everyone/videos/ABC',
    'https://www.youtube.com/channel/ucihEH7Bk23zVkIYMCBqvjgQ',
    'https://www.youtube.com/channel/UCshort',
    'https://www.youtube.com/user/',
  ])('rejects invalid YouTube account %j', (input) => {
    expect(() => normalizeYouTube(input)).toThrow(Error);
  });

  it.each([
    'https://linkedin.com.evil.com/company/everyonefilms',
    'https://evil.linkedin.com/company/everyonefilms',
    'https://www.linkedin.com/in/everyonefilms/',
    'https://www.linkedin.com/company/everyonefilms/posts/',
    'https://www.linkedin.com/company/everyone%2ffilms/',
    'https://www.linkedin.com/company/%00everyone/',
  ])('rejects invalid LinkedIn account %j', (input) => {
    expect(() => normalizeLinkedIn(input)).toThrow(Error);
  });
});
