import { createApp } from './app';
import { loadConfig } from './config/env';
import { connectDatabase } from './db';
import { createLogger } from './logger';

const logger = createLogger();

async function main() {
  const config = loadConfig();
  if (config.PASSWORD_RESET_EMAIL_ENABLED) {
    // No email provider exists until HC-2 (D-84); refuse to start rather than fail silently.
    throw new Error('PASSWORD_RESET_EMAIL_ENABLED is true but no email provider is configured (HC-2, D-84)');
  }
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  const { app } = createApp({ config, db, logger });
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info({ event: 'api_started', port: config.PORT, appEnv: config.APP_ENV });
  });

  const shutdown = () => {
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  logger.fatal({ event: 'api_start_failed', reason: err instanceof Error ? err.message : 'unknown' });
  process.exit(1);
});
