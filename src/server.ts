import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import courseRoutes from './courses/routes';
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

app.use(cors());

// gzip/brotli response compression for bandwidth-sensitive mobile clients.
app.use(compression());

// Bound request bodies: the API accepts only small JSON payloads, so reject
// anything larger instead of buffering it into memory.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
app.use('/api/courses', courseRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong'
  });
});

// Only start the HTTP server when this file is run directly (not when imported for tests)
// Jest automatically sets NODE_ENV=test, so this check prevents port binding during testing
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(Number(PORT), () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Learning paths API: http://localhost:${PORT}/api/courses/learning-paths`);
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