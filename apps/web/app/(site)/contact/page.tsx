import type { Metadata } from 'next';
import { ProsePage } from '@/components/site/ProsePage';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <ProsePage eyebrow="Contact" title="Get in touch">
      <p>
        StyleMe is in a closed beta. Beta members can reply to their invitation email to reach the team with questions,
        feedback or data requests.
      </p>
      <p>A public support address will be published here before StyleMe opens to everyone.</p>
      <p>
        To delete your account and data yourself, sign in and open Settings → Delete account. Deletion is immediate and
        permanent.
      </p>
    </ProsePage>
  );
}
