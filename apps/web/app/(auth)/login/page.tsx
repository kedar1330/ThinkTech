import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/forms';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <AuthCard title="Log in">
      {expired ? (
        <p role="status" className="text-sm text-neutral-600">
          Your session has ended. Please log in again.
        </p>
      ) : null}
      <LoginForm />
      <div className="flex justify-between text-sm">
        <Link href="/reset-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/register" className="underline">
          Register
        </Link>
      </div>
    </AuthCard>
  );
}
