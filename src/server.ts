import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import courseRoutes from './courses/routes';
import { errorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';
import { accessLogger, requestContext } from './middleware/request-context';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('x-powered-by', false);

// Assign a correlation id to every request and log each completed request.
app.use(requestContext);
app.use(accessLogger);

// Security headers: HSTS, X-Content-Type-Options, CSP, frame/SNI defenses, etc.
app.use(helmet());

// CORS: when CORS_ORIGINS is set (comma-separated), only those origins are
// allowed; otherwise reflect any origin (permissive local-dev default).
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));

// gzip/brotli response compression for bandwidth-sensitive mobile clients.
app.use(compression());

// Bound request bodies: the API accepts only small JSON payloads, so reject
// anything larger instead of buffering it into memory.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Per-IP rate limiting for API routes (env-tunable, disabled in tests so the
// suite is never throttled; health probes stay exempt).
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';
if (RATE_LIMIT_ENABLED) {
  app.use(
    '/api',
    createRateLimiter({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
      max: Number(process.env.RATE_LIMIT_MAX ?? 120),
      trustProxy: process.env.TRUST_PROXY === 'true',
    }),
  );
}

// Route index — discoverability aid for integrators and health checks.
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    name: 'Stellar Basic DAO Platform API',
    version: '1',
    endpoints: {
      learningPaths: '/api/courses/learning-paths',
      summary: '/api/courses/learning-paths/summary',
      byTrack: '/api/courses/learning-paths/track/:track',
      recommendation: '/api/courses/learning-paths/recommendation/:currentLevel',
      byId: '/api/courses/learning-paths/:id',
    },
    health: '/health',
  });
});

// Routes
app.use('/api/courses', courseRoutes);

// Health check — enriched with process diagnostics for load balancers and
// uptime monitors (status stays 'OK' so existing checks keep working).
app.get('/health', (_req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? 'development',
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id
  });
});

// Central error handler (see middleware/error-handler.ts).
app.use(errorHandler);

// Only start the HTTP server when this file is run directly (not when imported for tests)
// Jest automatically sets NODE_ENV=test, so this check prevents port binding during testing
if (process.env.NODE_ENV !== 'test') {
  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error(`Invalid PORT value: ${JSON.stringify(PORT)} (expected 1-65535).`);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📚 Learning paths API: http://localhost:${port}/api/courses/learning-paths`);
  });

  // Graceful shutdown: stop accepting new connections, drain in-flight
  // requests, then exit. A hard-kill timer prevents an indefinite hang if a
  // long-lived connection refuses to close.
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; draining connections and shutting down...`);

    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out; forcing exit.');
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close(() => {
      console.log('HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;