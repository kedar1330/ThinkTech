import type { Metadata } from 'next';
import { LEGAL_VERSIONS } from '@styleme/contracts';
import { ProsePage } from '@/components/site/ProsePage';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of Service" updated={LEGAL_VERSIONS.terms} draft>
      <h2>About StyleMe</h2>
      <p>
        StyleMe is a personal styling guide. It does not sell clothing. Suggestions are for inspiration; sizes and
        availability always depend on the brand and store you buy from.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>You must give accurate details and verify your email address before using your account.</li>
        <li>Keep your password private. You are responsible for activity under your account.</li>
        <li>During the closed beta, accounts are available by invitation only.</li>
      </ul>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access other people&rsquo;s accounts or interfere with the service.</li>
        <li>Do not use automated tools to create accounts or overload the service.</li>
      </ul>
      <h2>Beta features</h2>
      <p>
        Features marked &ldquo;Coming soon&rdquo; are not yet available. Features may change during the beta, and we
        will tell you about significant changes.
      </p>
      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings; deletion is immediate and permanent. We may suspend
        accounts that break these terms.
      </p>
    </ProsePage>
  );
}
