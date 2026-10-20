import { createApp } from './app';
import { loadConfig } from './config/env';
import { connectDatabase } from './db';
import { createLogger } from './logger';
import { geminiWordingProvider } from './integrations/ai/wording-client';
import { googleVerifier } from './services/google';
import { createEmailSender, createSmsSender } from './services/messaging';
import { SHIPPED_LIBRARY, loadStyleLibrary } from './style-rules';

const logger = createLogger();

async function main() {
  const config = loadConfig();
  // Email is required for registration and recovery: without SMTP the API runs only locally, where
  // messages go to the dev outbox (D-84). Throws outside local development when unconfigured.
  const emailSender = createEmailSender(config, logger);
  const smsSender = createSmsSender(config, logger);
  const google = config.GOOGLE_CLIENT_ID ? googleVerifier(config.GOOGLE_CLIENT_ID) : null;
  // Optional AI wording (D-67): off by default; loadConfig requires the key and model when it is on.
  const wordingProvider = config.AI_WORDING_ENABLED
    ? geminiWordingProvider(config.GEMINI_API_KEY!, config.GEMINI_MODEL!)
    : null;

  // Validate, lint and index the style knowledge base before anything else; an invalid library
  // stops the API (FR-STY-03). The look generator receives this library.
  const styleLibrary = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: config.APP_ENV });
  logger.info({ event: 'style_library_loaded', ...styleLibrary.counts });
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  const { app } = createApp({
    config,
    db,
    logger,
    emailSender,
    smsSender,
    googleVerifier: google,
    styleLibrary,
    wordingProvider,
  });
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info({
      event: 'api_started',
      port: config.PORT,
      appEnv: config.APP_ENV,
      email: emailSender.kind,
      sms: smsSender?.kind ?? 'none',
      google: Boolean(google),
      aiWording: config.AI_WORDING_ENABLED,
    });
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
