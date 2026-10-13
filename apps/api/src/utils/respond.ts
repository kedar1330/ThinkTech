import type { Response } from 'express';
import type { ErrorCode, WarningCode } from '@styleme/contracts';

export function sendData<T>(res: Response, data: T, status = 200, warnings?: WarningCode[]): void {
  res.status(status).json(warnings?.length ? { success: true, data, warnings } : { success: true, data });
}

export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  retryAfterSeconds?: number,
): void {
  if (retryAfterSeconds) res.setHeader('Retry-After', String(retryAfterSeconds));
  res
    .status(status)
    .json({ success: false, error: retryAfterSeconds ? { code, message, retryAfterSeconds } : { code, message } });
}
