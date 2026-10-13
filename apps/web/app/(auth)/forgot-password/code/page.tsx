import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resendResetCodeAction, verifyResetCodeAction } from '@/app/actions/auth';
import { CodeForm } from '@/components/auth/CodeForm';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { readCookie } from '@/lib/actions';

export const metadata: Metadata = { title: 'Enter your reset code', referrer: 'no-referrer' };

export default async function ResetCodePage() {
  let email: string | undefined;
  try {
    email = (JSON.parse((await readCookie('reset')) ?? '{}') as { email?: string }).email;
  } catch {
    email = undefined;
  }
  if (!email) redirect('/forgot-password');
  return (
    <AuthSplitLayout
      title="Enter your reset code"
      subtitle={
        <>
          We sent a 6-digit code to <strong className="break-all text-foreground">{email}</strong>. It expires in 5
          minutes.
        </>
      }
    >
      <CodeForm
        label="6-digit code"
        verifyAction={verifyResetCodeAction}
        resendAction={resendResetCodeAction}
        verifyLabel="Continue"
      />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="font-medium text-plum underline">
          Use a different email or a link instead
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
