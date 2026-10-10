import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm, ResetRequestForm } from '@/components/auth/forms';

// Served with Referrer-Policy: no-referrer and Cache-Control: no-store (next.config.ts). This page
// loads no third-party scripts, fonts, images or analytics.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <section className="space-y-3">
        <h2 className="text-base font-medium">I have a reset code or link</h2>
        <ResetPasswordForm />
      </section>
      <section className="space-y-3 border-t border-neutral-200 pt-6">
        <h2 className="text-base font-medium">I need a reset</h2>
        <p className="text-sm text-neutral-600">
          During the beta, contact the StyleMe team from your account&apos;s email address; once your request is
          verified you will get a single-use code. You always choose the new password yourself.
        </p>
        <ResetRequestForm />
      </section>
      <Link href="/login" className="text-sm underline">
        Back to log in
      </Link>
    </AuthCard>
  );
}
