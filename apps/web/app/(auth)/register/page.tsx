import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/forms';

export default function RegisterPage() {
  return (
    <AuthCard title="Create your account">
      <p className="text-sm text-neutral-600">
        StyleMe is in a closed beta: registration works only for invited email addresses.
      </p>
      <RegisterForm />
      <p className="text-sm">
        Already registered?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
