import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { getAccessToken } from '@/lib/auth/session';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // A cookie check only (no API call): it just switches "Log In / Sign Up" to "My StyleMe".
  const signedIn = Boolean(await getAccessToken());
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
