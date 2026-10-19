import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors';

/** Replaces `req.body` with the parsed value, or rejects with INVALID_REQUEST (no field details leak). */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) throw new AppError('INVALID_REQUEST');
    req.body = result.data;
    next();
  };
}

/** Puts the parsed query in `res.locals.query` (Express 5's `req.query` is read-only), or rejects with INVALID_REQUEST. */
export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) throw new AppError('INVALID_REQUEST');
    res.locals.query = result.data;
    next();
  };
}
