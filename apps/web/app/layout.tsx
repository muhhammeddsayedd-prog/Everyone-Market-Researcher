import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'everyone. Market Radar', template: '%s · everyone. Market Radar' },
  description: 'Internal market intelligence for everyone.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#000000', colorScheme: 'dark light' };

const brandFont = process.env.NEXT_PUBLIC_EMR_BRAND_FONT === '1';

// Applies the saved theme before first paint (no flash). Dark is the default.
const THEME_SCRIPT = `try{var t=localStorage.getItem('emr-theme');var d=document.documentElement;if(t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches)){d.dataset.theme='light';d.style.colorScheme='light'}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-brand-font={brandFont ? '1' : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {brandFont ? (
          <link
            rel="preload"
            href="/fonts/GeneralSans-Medium.woff2"
            as="font"
            type="font/woff2"
            crossOrigin=""
          />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
