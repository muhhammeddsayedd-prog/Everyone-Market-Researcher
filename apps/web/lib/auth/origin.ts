/**
 * The origin Google should return to after sign-in. It must be the host the user started
 * from, because the PKCE verifier cookie lives there (a Vercel deployment URL and the branch
 * alias are different hosts). Only the configured site, Vercel preview hosts and local hosts
 * are accepted; Supabase's redirect allow-list remains the final gate.
 */
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

export function authOrigin(siteUrl: string, host: string | null, proto: string | null): string {
  if (!host || !HOST.test(host)) return siteUrl;
  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const site = new URL(siteUrl);
  const trusted = local || hostname === site.hostname || hostname.endsWith('.vercel.app');
  if (!trusted) return siteUrl;
  const scheme = local && proto === 'http' ? 'http' : 'https';
  return `${scheme}://${host.toLowerCase()}`;
}
