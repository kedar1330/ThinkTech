import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AUTH_MESSAGES } from '@styleme/contracts';
import { AppError } from '../utils/errors';

// Google sign-in (D-88). The web server completes the OAuth authorization-code flow (with PKCE, state
// and nonce) and passes Google's ID token here. The API verifies it independently — signature against
// Google's published keys, issuer, audience (our client ID), expiry, nonce — and requires Google's
// `email_verified` claim. A client-supplied email is never trusted.

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

export type GoogleVerifier = (idToken: string, expectedNonce: string) => Promise<GoogleIdentity>;

const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export function googleVerifier(clientId: string): GoogleVerifier {
  const jwks = createRemoteJWKSet(GOOGLE_JWKS_URL);
  return async (idToken, expectedNonce) => {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, jwks, { issuer: GOOGLE_ISSUERS, audience: clientId }));
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Google sign-in could not be verified. Please try again.');
    }
    return identityFromClaims(payload, expectedNonce);
  };
}

/** Shared claim checks (also used by tests with locally signed tokens). */
export function identityFromClaims(payload: Record<string, unknown>, expectedNonce: string): GoogleIdentity {
  if (payload.nonce !== expectedNonce) {
    throw new AppError('UNAUTHENTICATED', 'Google sign-in could not be verified. Please try again.');
  }
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new AppError('UNAUTHENTICATED', 'Google sign-in could not be verified. Please try again.');
  }
  if (payload.email_verified !== true) throw new AppError('FORBIDDEN', AUTH_MESSAGES.googleNotVerified);
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
