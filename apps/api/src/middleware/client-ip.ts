import { isIP } from 'node:net';
import type { RequestHandler } from 'express';
import { BFF_KEY_HEADER, CLIENT_IP_HEADER } from '@styleme/contracts';
import { safeEqual } from '../utils/crypto';

export { BFF_KEY_HEADER, CLIENT_IP_HEADER };

/**
 * Browsers never call the API directly: every request comes from the Next.js server (BFF), so the
 * connecting address is the BFF's, not the user's. The BFF passes the user's IP in a header, which is
 * trusted only when the request also carries the shared BFF secret. Without it (e.g. someone calling
 * the API directly), the connecting address is used, so the header can't be spoofed to dodge limits.
 */
export function clientIp(bffSecret: string): RequestHandler {
  return (req, _res, next) => {
    const key = req.get(BFF_KEY_HEADER);
    const forwarded = req.get(CLIENT_IP_HEADER)?.trim();
    if (key && forwarded && isIP(forwarded) && safeEqual(key, bffSecret)) {
      req.clientIp = forwarded;
    } else {
      req.clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    }
    next();
  };
}
