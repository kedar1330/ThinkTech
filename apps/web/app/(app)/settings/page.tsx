import type { Metadata } from 'next';
import {
  DeleteAccountForm,
  DetailsForm,
  EmailChangeForm,
  PasswordChangeForm,
  PhoneForm,
} from '@/components/app/SettingsForms';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Settings' };

const SECTIONS = [
  { id: 'details', label: 'Details' },
  { id: 'email', label: 'Email' },
  { id: 'password', label: 'Password' },
  { id: 'phone', label: 'Phone' },
  { id: 'delete', label: 'Delete account' },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ emailChanged?: string; phoneVerified?: string }>;
}) {
  const { user } = await requireOnboarded();
  const { emailChanged, phoneVerified } = await searchParams;
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-display text-4xl text-primary">Settings</h1>
        <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-plum/50"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {emailChanged && (
        <Alert tone="success">
          Your email address is now {user.email}. We let your previous address know about the change.
        </Alert>
      )}
      {phoneVerified && <Alert tone="success">Your phone number is verified.</Alert>}
      <Section id="details" title="Your details">
        <DetailsForm user={user} />
      </Section>
      <Section id="email" title="Email address">
        <EmailChangeForm user={user} />
      </Section>
      <Section id="password" title="Password">
        <PasswordChangeForm />
      </Section>
      <Section id="phone" title="Phone number">
        <PhoneForm user={user} />
      </Section>
      <Section id="delete" title="Delete account" danger>
        <DeleteAccountForm />
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  danger,
  children,
}: {
  id: string;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={`scroll-mt-20 space-y-5 ${danger ? 'border-destructive/30' : ''}`}>
      <h2 className={`font-display text-2xl ${danger ? 'text-destructive' : 'text-primary'}`}>{title}</h2>
      {children}
    </Card>
  );
}
