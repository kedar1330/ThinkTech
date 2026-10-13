import { redirect } from 'next/navigation';

/** The old dashboard address; Personalized Home replaces it. */
export default function DashboardRedirect() {
  redirect('/home');
}
