import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

interface AppError extends Error {
  status?: number;
  code?: number | string;
}

export const errorHandler: ErrorRequestHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(err);

  if (err.code === 11000) {
    res.status(409).json({ error: 'Already completed for this date' });
    return;
  }

  const status = err.status ?? 500;

  // Only surface messages for known operational errors (those with an explicit
  // status). For unexpected 5xx errors return a generic message so internal
  // details (stack traces, DB errors) are never leaked to clients.
  const message = err.status ? (err.message ?? 'Error') : 'Internal server error';

  res.status(status).json({ error: message });
};
