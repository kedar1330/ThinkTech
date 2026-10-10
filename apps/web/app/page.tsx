import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccessToken } from '@/lib/auth/session';

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await getAccessToken()) redirect('/dashboard');
  const { deleted } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">StyleMe</h1>
      <p className="text-neutral-600">
        Personal styling for the occasion, in colours and cuts that suit your preferences.
      </p>
      {deleted ? (
        <p role="status" className="text-sm text-green-700">
          Your account has been deleted.
        </p>
      ) : null}
      <p className="text-sm text-neutral-600">StyleMe is in a closed beta. Registration is by invitation.</p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Log in
        </Link>
        <Link href="/register" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium">
          Register
        </Link>
      </div>
    </main>
  );
}
