import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    accessToken?: string;
    accessTokenExpires?: number;
  }
  interface Session {
    // Only ever sent *to* unstable_update after a password change; the session callback never sets it,
    // so it is never exposed to the browser.
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
  }
}
