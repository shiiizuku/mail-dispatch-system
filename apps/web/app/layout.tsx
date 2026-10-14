import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mail Desk',
  description: 'Envelopes, postage and stamps for outgoing mail',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="brand">Mail Desk</span>
          <nav aria-label="Main">
            <Link href="/">Letters</Link>
            <Link href="/stamps">Stamps &amp; settings</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
