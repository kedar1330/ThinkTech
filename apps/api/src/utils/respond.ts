import type { Response } from 'express';
import type { ErrorCode, WarningCode } from '@styleme/contracts';

export function sendData<T>(res: Response, data: T, status = 200, warnings?: WarningCode[]): void {
  res.status(status).json(warnings?.length ? { success: true, data, warnings } : { success: true, data });
}

export function sendError(res: Response, status: number, code: ErrorCode, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}
