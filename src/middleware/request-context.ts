import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id assigned to this request (echoed as X-Request-Id). */
      id: string;
    }
  }
}

const INCOMING_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Assigns every request a correlation id.
 *
 * A caller-supplied `X-Request-Id` is honored when it looks like a sane
 * opaque token (so distributed tracing can thread ids through proxies);
 * otherwise a fresh UUIDv4 is generated. The id is echoed on the response
 * and later used by the access logger and error handler, letting operators
 * join a client request to server logs without guesswork.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.get('x-request-id');
  const id =
    incoming && INCOMING_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Minimal structured access logger.
 *
 * Emits one line per completed request with the correlation id, method,
 * path, status, and duration so traffic can be traced end to end. Errors
 * are logged separately by the error handler with the same id.
 */
export function accessLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'request completed',
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  });
  next();
}
