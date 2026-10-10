import Link from 'next/link';
import { AccountNav } from '@/components/auth/AccountNav';
import { requireUser } from '@/lib/auth/session';

export default async function DashboardPage() {
  const { user } = await requireUser();
  return (
    <>
      <AccountNav name={user.name} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-neutral-600">Your style profile and looks arrive in the next milestones.</p>
        <Link href="/profile" className="text-sm underline">
          Manage your account
        </Link>
      </main>
    </>
  );
}
