import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// General Sans cannot be committed to this public repository (ITF FFL); it is provisioned per
// environment. The app only references it when the file is present, so no request ever 404s.
const brandFontPresent = existsSync(
  fileURLToPath(new URL('./public/fonts/GeneralSans-Medium.woff2', import.meta.url)),
);

function supabaseOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

const imageSources = ["'self'", 'data:', supabaseOrigin()].filter(Boolean).join(' ');

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ['@emr/shared'],
  poweredByHeader: false,
  env: { NEXT_PUBLIC_EMR_BRAND_FONT: brandFontPresent ? '1' : '0' },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Remote images (stored logos) may come only from this project's Supabase origin.
          {
            key: 'Content-Security-Policy',
            value: `img-src ${imageSources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
