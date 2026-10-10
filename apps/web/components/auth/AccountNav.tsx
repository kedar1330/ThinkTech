import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

export function AccountNav({ name }: { name: string }) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
      <Link href="/dashboard" className="font-semibold">
        StyleMe
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <span className="hidden text-neutral-600 sm:inline">{name}</span>
        <Link href="/profile" className="underline">
          Account
        </Link>
        <form action={logoutAction}>
          <button className="underline">Log out</button>
        </form>
      </nav>
    </header>
  );
}
