import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import { themeBootScript } from '@/lib/theme';
import { CompactHeader } from './compact-header';
import { MainNav, ThemeControls } from './shell';
import './globals.css';

/* The Civic Ledger faces, self-hosted (see app/fonts/README.md); variable, so one file each. */
const publicSans = localFont({
  src: './fonts/public-sans-variable.woff2',
  weight: '100 900',
  variable: '--font-public-sans',
  display: 'swap',
});
const newsreader = localFont({
  src: './fonts/newsreader-variable.woff2',
  weight: '200 800',
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mail Desk',
  description: 'Envelopes, postage and stamps for outgoing mail',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="neutral"
      className={`${publicSans.variable} ${newsreader.variable}`}
      style={
        {
          '--font-sans': 'var(--font-public-sans)',
          '--font-display': 'var(--font-newsreader)',
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <div className="shell">
          <aside className="sidebar" data-slot="app-sidebar">
            <Link href="/" className="brand">
              <img src="/branding/mgb-logo-160.png" alt="" width={40} height={40} />
              <span>
                <span className="brand-name">Mail Desk</span>
                <span className="brand-sub">Mines and Geosciences Bureau</span>
              </span>
            </Link>
            <MainNav />
            <ThemeControls />
          </aside>
          <main>
            <CompactHeader />
            <div className="page">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
