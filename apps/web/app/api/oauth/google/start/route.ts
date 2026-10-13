import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { OAUTH_MAX_AGE_SECONDS, cookieName, cookieOptions } from '@/lib/auth/cookies';
import { authorizationUrl, encodeOAuthCookie, googleConfigured, newOAuthState } from '@/lib/auth/google';

// Starts Google sign-up or login (D-88). Sign-up needs the Terms and Privacy Policy accepted first.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const intent = params.get('intent') === 'signup' ? 'signup' : 'login';
  const back = new URL(intent === 'signup' ? '/register' : '/login', request.nextUrl.origin);

  if (!googleConfigured()) {
    back.searchParams.set('google', 'unavailable');
    return NextResponse.redirect(back);
  }
  const terms = params.get('terms') === '1';
  if (intent === 'signup' && !terms) {
    back.searchParams.set('google', 'terms');
    return NextResponse.redirect(back);
  }

  const state = newOAuthState(intent, {
    remember: params.get('remember') === '1',
    terms,
    marketing: params.get('marketing') === '1',
  });
  (await cookies()).set(cookieName('oauth'), encodeOAuthCookie(state), cookieOptions(OAUTH_MAX_AGE_SECONDS));
  return NextResponse.redirect(authorizationUrl(state));
}
