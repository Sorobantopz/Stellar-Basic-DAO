import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { tap } from 'rxjs/operators';
  import { MetricsService } from './metrics.service';
  import { Request } from 'express';
  
  @Injectable()
  export class MetricsInterceptor implements NestInterceptor {
    constructor(private metricsService: MetricsService) {}
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const start = Date.now();
      const req = context.switchToHttp().getRequest<Request>();
      const method = req.method;
      // Prefer the route template (e.g. /users/:id) — unmatched requests
      // (404s, scanners) have no route, so normalize their raw path into a
      // bounded label instead of letting arbitrary URLs explode metric
      // cardinality.
      const route = req.route?.path || normalizeUnmatchedPath(req.path);
  
      return next.handle().pipe(
        tap({
          next: () => {
            const res = context.switchToHttp().getResponse();
            const duration = (Date.now() - start) / 1000;
            this.metricsService.recordRequestDuration(
              method,
              route,
              res.statusCode,
              duration,
            );
          },
          error: (err) => {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.recordRequestDuration(
              method,
              route,
              err.status || 500,
              duration,
            );
          },
        }),
      );
    }
  }

/**
 * Collapse an unmatched request path into a bounded metric label.
 *
 * Route templates are unknown for requests that hit no handler, so the raw
 * path could be anything ("GET /a", "/a/b/c", base64 blobs, fuzzers).
 * Digit runs are folded to ":num" and the result is truncated so the
 * `route` label cannot grow without bound in Prometheus.
 */
export function normalizeUnmatchedPath(rawPath: string): string {
  const collapsed = rawPath
    .replace(/\d+/g, ":num")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .slice(0, 64);
  return collapsed || "unmatched";
}