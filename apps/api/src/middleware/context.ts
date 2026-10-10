import type { UserWithId } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The end user's IP address, used for per-IP rate limits (see client-ip.ts). */
      clientIp: string;
      /** Set by `authenticate` on protected routes. */
      auth?: { user: UserWithId; sid: string };
    }
  }
}

export {};
