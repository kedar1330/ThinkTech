import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Google OAuth on the web server (D-88): authorization-code flow with PKCE, a random `state` (CSRF)
// and `nonce` (replay) kept in a short-lived HttpOnly cookie. The client secret never leaves the
// server. The resulting ID token is sent to the API, which verifies it independently.

export type GoogleIntent = 'signup' | 'login';

export interface OAuthState {
  state: string;
  verifier: string;
  nonce: string;
  intent: GoogleIntent;
  remember: boolean;
  terms: boolean;
  marketing: boolean;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_URL);
}

function b64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

export function newOAuthState(
  intent: GoogleIntent,
  options: { remember: boolean; terms: boolean; marketing: boolean },
): OAuthState {
  return {
    state: b64url(randomBytes(32)),
    verifier: b64url(randomBytes(48)),
    nonce: b64url(randomBytes(32)),
    intent,
    ...options,
  };
}

export function redirectUri(): string {
  const base = (process.env.AUTH_URL ?? '').replace(/\/+$/, '');
  return `${base}/api/oauth/google/callback`;
}

export function authorizationUrl(s: OAuthState): string {
  const challenge = b64url(createHash('sha256').update(s.verifier).digest());
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: s.state,
    nonce: s.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseOAuthCookie(value: string | undefined): OAuthState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as OAuthState;
    return typeof parsed.state === 'string' && typeof parsed.verifier === 'string' && typeof parsed.nonce === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function encodeOAuthCookie(s: OAuthState): string {
  return Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
}

export function statesMatch(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Exchanges the authorization code for Google's ID token (server to server, with the client secret). */
export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim().replace(/^["']|["']$/g, '');
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim().replace(/^["']|["']$/g, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Google exchangeCode failed:', res.status, errText);
    let reason = `google_${res.status}`;
    try {
      const parsed = JSON.parse(errText) as { error?: string; error_description?: string };
      if (parsed.error) reason += `_${parsed.error}`;
      if (parsed.error_description) reason += `_${parsed.error_description}`;
    } catch {
      if (errText) reason += `_${errText.slice(0, 50)}`;
    }
    throw new Error(reason.replace(/\s+/g, '_').slice(0, 80));
  }
  const json = (await res.json()) as { id_token?: unknown };
  if (typeof json.id_token !== 'string') {
    throw new Error('missing_id_token_in_google_response');
  }
  return json.id_token;
}
