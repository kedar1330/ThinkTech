import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginRequestSchema, type UserResponse } from '@styleme/contracts';
import { ApiError, apiRequest, decodeTokenClaims } from '@/lib/api/server';
import { SESSION_MAX_AGE_SECONDS, isSecureAuthUrl, sessionCookieName, sessionCookieOptions } from '@/lib/auth/cookies';
import { clientIpFrom } from '@/lib/auth/origin';

// Auth.js (D-06): the API access token lives only inside the encrypted session cookie and is read on
// the server. It is never put on the session object, which browser code could fetch.

export class RateLimitedSignin extends CredentialsSignin {
  code = 'rate_limited';
}

const secure = isSecureAuthUrl();

/** True if the API accepts `token` and it belongs to `userId`. */
async function isTokenForUser(token: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const me = await apiRequest<UserResponse>('/v1/auth/me', { token });
    return me.id === userId;
  } catch {
    return false;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  useSecureCookies: secure,
  cookies: {
    sessionToken: { name: sessionCookieName(secure), options: sessionCookieOptions(secure) },
  },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginRequestSchema.safeParse(credentials);
        if (!parsed.success) return null;
        try {
          const { accessToken } = await apiRequest<{ accessToken: string }>('/v1/auth/login', {
            method: 'POST',
            body: parsed.data,
            clientIp: clientIpFrom(request.headers),
          });
          const claims = decodeTokenClaims(accessToken);
          if (!claims) return null;
          return { id: claims.sub, accessToken, accessTokenExpires: claims.exp * 1000 };
        } catch (err) {
          if (err instanceof ApiError && err.code === 'RATE_LIMITED') throw new RateLimitedSignin();
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.accessToken) {
        token.sub = user.id;
        token.accessToken = user.accessToken;
        token.accessTokenExpires = user.accessTokenExpires;
      }
      // After a password change the server action passes the new API token. It is accepted only if
      // the API confirms it belongs to this same user, so a client-sent update can't swap identities.
      if (trigger === 'update') {
        const next = (session as { accessToken?: unknown } | undefined)?.accessToken;
        if (typeof next === 'string' && (await isTokenForUser(next, token.sub))) {
          token.accessToken = next;
          token.accessTokenExpires = (decodeTokenClaims(next)?.exp ?? 0) * 1000;
        }
      }
      // The session never outlives the API token (D-05): 7 days from login, not extended.
      if (!token.accessToken || !token.accessTokenExpires || Date.now() >= token.accessTokenExpires) return null;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // Logout (D-07): revoke the API session record before the cookie is cleared. If this fails the
    // cookie is still cleared and the record expires with its 7-day limit.
    async signOut(message) {
      const accessToken = 'token' in message ? message.token?.accessToken : undefined;
      if (!accessToken) return;
      try {
        await apiRequest('/v1/auth/logout', { method: 'POST', token: accessToken });
      } catch (err) {
        console.warn(
          JSON.stringify({ event: 'logout_revocation_failed', code: err instanceof ApiError ? err.code : 'unknown' }),
        );
      }
    },
  },
});
