import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Fonts are bundled with the app (app/fonts, SIL Open Font License) instead of fetched from Google:
// builds and dev servers don't depend on fonts.googleapis.com, and visitors never contact Google.
const inter = localFont({
  src: [{ path: './fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
});
const playfair = localFont({
  src: [
    { path: './fonts/playfair-display-latin-wght-normal.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/playfair-display-latin-wght-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'StyleMe — Discover the Style That Is You', template: '%s · StyleMe' },
  description:
    'Personal styling for India: a style profile, your colours and fit, and outfit ideas within your budget — each with a reason.',
};

export const viewport: Viewport = { themeColor: '#4a1f45' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
