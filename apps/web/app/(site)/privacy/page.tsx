import type { Metadata } from 'next';
import { LEGAL_VERSIONS } from '@styleme/contracts';
import { ProsePage } from '@/components/site/ProsePage';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy Policy" updated={LEGAL_VERSIONS.privacy} draft>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your full name, email address, city and — only if you add one — a mobile number.</li>
        <li>Your password, stored only as a one-way hash. We cannot read it.</li>
        <li>
          If you use Google: your Google account ID, name and verified email address. We never receive your Google
          password.
        </li>
        <li>
          Your style profile: department, sizes, fit, colours, coverage, comfort, fabrics, styles, occasions and budget.
        </li>
        <li>Optional appearance signals you choose to share: skin-tone range, undertone and proportions.</li>
        <li>
          Records of the Terms and Privacy Policy versions you accepted and your marketing-email choice, with dates.
        </li>
        <li>Security records: active sessions and failed sign-in attempts, used to protect your account.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run your account, verify your email address and keep your account secure.</li>
        <li>To personalise StyleMe for you. Appearance signals are used only while you keep them switched on.</li>
        <li>
          To send service emails (verification codes, password and email-change notices). Marketing emails only if you
          opt in.
        </li>
      </ul>
      <p>We do not sell your data and we do not ask for photos.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile, details and marketing choice at any time in Settings.</li>
        <li>Delete appearance signals at any time.</li>
        <li>
          Delete your account from Settings. Deletion is immediate and permanent. We keep only a keyed fingerprint of
          your email address so that a deleted account is never brought back by restoring a backup.
        </li>
      </ul>
      <h2>Cookies</h2>
      <p>
        StyleMe uses only essential cookies: one that keeps you signed in, and short-lived ones that protect sign-up,
        Google sign-in and password reset. They cannot be read by page scripts. With &ldquo;Remember me&rdquo; the
        sign-in cookie lasts 30 days; otherwise it ends when you close your browser.
      </p>
      <h2>Contact</h2>
      <p>See the Contact page for how to reach the StyleMe team about your data.</p>
    </ProsePage>
  );
}
