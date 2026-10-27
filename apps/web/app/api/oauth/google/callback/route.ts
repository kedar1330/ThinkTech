import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { GoogleAuthResponse } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { cookieName } from '@/lib/auth/cookies';
import { exchangeCode, parseOAuthCookie, statesMatch } from '@/lib/auth/google';
import { clientIpFrom } from '@/lib/auth/origin';
import { pathForStep, setSession } from '@/lib/auth/session';

// Google redirects here (D-88). The state cookie is single-use; the ID token goes to the API, which
// verifies it and links or creates the account. Errors return to the page the user came from.

const ERROR_PARAM: Partial<Record<string, string>> = {
  GOOGLE_ACCOUNT_EXISTS: 'exists',
  GOOGLE_NO_ACCOUNT: 'no_account',
  NOT_INVITED: 'not_invited',
  ACCOUNT_LOCKED: 'locked',
  PROVIDER_NOT_CONFIGURED: 'unavailable',
  FORBIDDEN: 'forbidden',
};

export async function GET(request: NextRequest) {
  const store = await cookies();
  const saved = parseOAuthCookie(store.get(cookieName('oauth'))?.value);
  store.delete(cookieName('oauth'));

  const params = request.nextUrl.searchParams;
  const back = (reason: string, intent = saved?.intent ?? 'login', detail?: string) => {
    const url = new URL(intent === 'signup' ? '/register' : '/login', request.nextUrl.origin);
    url.searchParams.set('google', reason);
    if (detail) url.searchParams.set('detail', detail);
    return NextResponse.redirect(url);
  };

  if (!saved || !statesMatch(saved.state, params.get('state'))) {
    console.error('Google OAuth state mismatch or missing cookie:', {
      hasSaved: Boolean(saved),
      receivedState: params.get('state'),
    });
    return back('failed', undefined, !saved ? 'missing_cookie' : 'state_mismatch');
  }
  if (params.get('error')) {
    console.error('Google OAuth error returned from Google:', params.get('error'));
    return back(
      params.get('error') === 'access_denied' ? 'cancelled' : 'failed',
      undefined,
      String(params.get('error')),
    );
  }
  const code = params.get('code');
  if (!code) {
    console.error('Google OAuth missing authorization code');
    return back('failed', undefined, 'missing_code');
  }

  let exchangeErr: string | null = null;
  const idToken = await exchangeCode(code, saved.verifier).catch((err) => {
    exchangeErr = err instanceof Error ? err.message : String(err);
    console.error('Google exchangeCode error:', err);
    return null;
  });
  if (!idToken) return back('failed', undefined, exchangeErr ? `exchange_${exchangeErr}` : 'exchange_failed');

  try {
    const result = await apiRequest<GoogleAuthResponse>('/v1/auth/google', {
      method: 'POST',
      body: {
        idToken,
        nonce: saved.nonce,
        intent: saved.intent,
        rememberMe: saved.remember,
        acceptTerms: saved.terms,
        marketingOptIn: saved.marketing,
      },
      clientIp: clientIpFrom(request.headers),
    });
    await setSession(result.accessToken, saved.remember);
    return NextResponse.redirect(new URL(pathForStep(result.onboardingStep), request.nextUrl.origin));
  } catch (err) {
    console.error('Google /v1/auth/google error:', err);
    const detail =
      err instanceof ApiError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : 'api_error';
    return back(err instanceof ApiError ? (ERROR_PARAM[err.code] ?? 'failed') : 'failed', saved.intent, detail);
  }
}
