import { NextFunction, Request, Response } from 'express';

/**
 * Central error handler.
 *
 * Responsibilities:
 * - Map body-parser failures to proper client errors (400 malformed JSON,
 *   413 payload too large) instead of 500s.
 * - Never leak internal error messages or stack traces to clients.
 * - Log full detail server-side, correlated by request id.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // body-parser / express.json failures carry a `type` and `status`.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Request body is not valid JSON',
      requestId: req.id,
    });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'Payload Too Large',
      message: 'Request body exceeds the allowed size',
      requestId: req.id,
    });
    return;
  }

  // Unexpected internal error — log everything, expose nothing.
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'unhandled error',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: {
        name: err?.name ?? 'Error',
        message: err?.message ?? 'Unknown error',
        stack: err?.stack ?? undefined,
      },
    }),
  );
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId: req.id,
  });
}
