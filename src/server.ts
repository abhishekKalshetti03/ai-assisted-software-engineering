import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  const startMessage = config.isProduction
    ? JSON.stringify({ level: 'info', message: `Server listening on port ${config.port}`, port: config.port, env: config.nodeEnv, timestamp: new Date().toISOString() })
    : `Server listening on port ${config.port} [${config.nodeEnv}]`;
  console.log(startMessage);
});

// Graceful shutdown — finish in-flight requests before exiting
function shutdown(signal: string): void {
  const message = config.isProduction
    ? JSON.stringify({ level: 'info', message: `${signal} received, shutting down gracefully`, timestamp: new Date().toISOString() })
    : `${signal} received, shutting down gracefully`;
  console.log(message);

  server.close(() => {
    console.log(config.isProduction
      ? JSON.stringify({ level: 'info', message: 'Server closed', timestamp: new Date().toISOString() })
      : 'Server closed');
    process.exit(0);
  });

  // Force exit if connections hang beyond 10 s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
