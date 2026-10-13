import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/respond';

export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Not found');
};

/** Standard envelope; never exposes stack traces, secrets, database details or internals (FR-X-02). */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err.status, err.code, err.message, err.retryAfterSeconds);
    return;
  }
  // Malformed JSON or an oversized body from express.json().
  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    sendError(res, 400, 'INVALID_REQUEST', 'Invalid request data');
    return;
  }
  const name = (err as { name?: string }).name ?? '';
  if (/^Mongo(Network|ServerSelection)Error$/.test(name) || name === 'MongooseServerSelectionError') {
    req.log?.error({ event: 'database_unavailable', errName: name });
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'StyleMe is temporarily unavailable');
    return;
  }
  req.log?.error({ event: 'unhandled_error', errName: name, errMessage: (err as Error).message });
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
