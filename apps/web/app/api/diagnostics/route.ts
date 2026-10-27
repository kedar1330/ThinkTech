import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiBaseUrl = process.env.API_BASE_URL || null;
  const authUrl = process.env.AUTH_URL || null;
  const hasGoogleClientId = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasGoogleClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasBffSecret = Boolean(process.env.BFF_SHARED_SECRET);

  let backendReachable = false;
  let backendHealth: unknown = null;
  let backendHealthError: string | null = null;

  if (apiBaseUrl) {
    try {
      const res = await fetch(`${apiBaseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      backendReachable = res.ok;
      backendHealth = await res.json().catch(() => null);
    } catch (err) {
      backendHealthError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    apiBaseUrl,
    backendReachable,
    backendHealth,
    backendHealthError,
    authUrl,
    hasGoogleClientId,
    hasGoogleClientSecret,
    hasBffSecret,
  });
}
