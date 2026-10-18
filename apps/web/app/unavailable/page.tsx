import type { Metadata } from 'next';
import { Wordmark } from '@/components/brand/wordmark';

export const metadata: Metadata = { title: 'Unavailable' };

/**
 * Served (with HTTP 503 from the proxy) whenever required configuration is missing or invalid.
 * The app fails closed: no sign-in, no data and no partial pages without valid configuration.
 */
export default function UnavailablePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col justify-center gap-6 px-4"
    >
      <Wordmark width={120} />
      <h1 className="type-h2">Market Radar isn&apos;t available here.</h1>
      <p className="type-body-lg text-fg-secondary">
        This deployment is missing its sign-in and data configuration, so nothing is served. Ask the project
        owner to check the environment settings.
      </p>
    </main>
  );
}
