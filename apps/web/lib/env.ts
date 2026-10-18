import { z } from 'zod';

/**
 * Public configuration the app needs before it can serve any authenticated page.
 * Only publishable values live here; server secrets are never read by the web app.
 * NEXT_PUBLIC_* names must be referenced literally so Next.js can inline them.
 */
const publicEnvSchema = z.object({
  supabaseUrl: z.url({ protocol: /^https?$/ }),
  // A secret key in this slot would leak to browsers, so only publishable keys pass.
  supabasePublishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{8,}$/),
  siteUrl: z.url({ protocol: /^https?$/ }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type PublicEnvResult = { ok: true; env: PublicEnv } | { ok: false; missing: string[] };

const FIELD_NAMES: Record<keyof PublicEnv, string> = {
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  supabasePublishableKey: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  siteUrl: 'NEXT_PUBLIC_SITE_URL',
};

export function parsePublicEnv(raw: Record<keyof PublicEnv, string | undefined>): PublicEnvResult {
  const parsed = publicEnvSchema.safeParse({
    supabaseUrl: raw.supabaseUrl?.trim().replace(/\/+$/, ''),
    supabasePublishableKey: raw.supabasePublishableKey?.trim(),
    siteUrl: raw.siteUrl?.trim().replace(/\/+$/, ''),
  });
  if (parsed.success) return { ok: true, env: parsed.data };
  const missing = [
    ...new Set(parsed.error.issues.map((issue) => FIELD_NAMES[issue.path[0] as keyof PublicEnv])),
  ];
  return { ok: false, missing };
}

export function readPublicEnv(): PublicEnvResult {
  return parsePublicEnv({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export class ConfigurationUnavailableError extends Error {
  constructor() {
    super('Market Radar configuration is unavailable');
    this.name = 'ConfigurationUnavailableError';
  }
}

/** Throws (fails closed) when the app is not configured. */
export function requirePublicEnv(): PublicEnv {
  const result = readPublicEnv();
  if (!result.ok) throw new ConfigurationUnavailableError();
  return result.env;
}

/** True when the app reads a local Supabase stack (test data, never business data). */
export function isLocalSupabase(env: PublicEnv): boolean {
  const host = new URL(env.supabaseUrl).hostname;
  return host === '127.0.0.1' || host === 'localhost';
}
