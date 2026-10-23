import { createApp } from './app';
import { loadConfig, type Config } from './config/env';
import { connectDatabase, type Database } from './db';
import { createLogger } from './logger';
import { geminiDesignProvider } from './integrations/ai/design-client';
import { pollinationsImageProvider } from './integrations/ai/image-client';
import { serperShoppingProvider } from './integrations/shopping/serper-client';
import { geminiVisionProvider } from './integrations/ai/vision-client';
import { cloudflareGenerator, pollinationsGenerator, type ImageGenerator } from './integrations/image/image-client';
import { geminiWordingProvider } from './integrations/ai/wording-client';
import { googleVerifier } from './services/google';
import { createEmailSender, createSmsSender } from './services/messaging';
import { assertNoFixtureDocuments } from './startup/fixture-check';
import { SHIPPED_LIBRARY, loadStyleLibrary } from './style-rules';
import type { Logger } from 'pino';

const logger = createLogger();

export interface StartServerDeps {
  config?: Config;
  logger?: Logger;
  db?: Database;
  listen?: boolean;
}

export async function startServer(deps: StartServerDeps = {}) {
  const config = deps.config ?? loadConfig();
  const log = deps.logger ?? logger;
  // Email is required for registration and recovery: without SMTP the API runs only locally, where
  // messages go to the dev outbox (D-84). Throws outside local development when unconfigured.
  const emailSender = createEmailSender(config, log);
  const smsSender = createSmsSender(config, log);
  const google = config.GOOGLE_CLIENT_ID ? googleVerifier(config.GOOGLE_CLIENT_ID) : null;
  // Optional AI wording (D-67): off by default; loadConfig requires the key and model when it is on.
  const wordingProvider = config.AI_WORDING_ENABLED
    ? geminiWordingProvider(config.GEMINI_API_KEY!, config.GEMINI_MODEL!)
    : null;
  // Photo analysis (D-129): live whenever a Gemini key is set, unless PHOTO_ANALYSIS_ENABLED=false.
  const photoAnalysisProvider =
    config.PHOTO_ANALYSIS_ENABLED && config.GEMINI_API_KEY
      ? geminiVisionProvider(config.GEMINI_API_KEY, config.GEMINI_VISION_MODEL)
      : null;
  // AI outfit images: off by default; loadConfig allows them only locally and requires the key when on.
  const outfitImageProvider = config.OUTFIT_IMAGES_ENABLED
    ? pollinationsImageProvider(config.POLLINATIONS_API_KEY!, config.POLLINATIONS_IMAGE_MODEL)
    : null;
  // Price ranges (#118): live whenever a Serper.dev key is set, and only locally until the founder approves
  // showing store prices (D-77); elsewhere the key is ignored and the tabs say prices are unavailable.
  const shoppingProvider =
    config.SERPER_API_KEY && config.APP_ENV === 'local' ? serperShoppingProvider(config.SERPER_API_KEY) : null;
  // Design Studio (D-134): live whenever a Gemini key is set, unless DESIGN_STUDIO_ENABLED=false. Each image service
  // joins the failover chain when its key is set (Pollinations first, then Cloudflare).
  const designAnalysisProvider =
    config.DESIGN_STUDIO_ENABLED && config.GEMINI_API_KEY
      ? geminiDesignProvider(config.GEMINI_API_KEY, config.GEMINI_VISION_MODEL)
      : null;
  const imageGenerators: ImageGenerator[] = [];
  if (config.POLLINATIONS_API_KEY)
    imageGenerators.push(pollinationsGenerator(config.POLLINATIONS_API_KEY, config.POLLINATIONS_IMAGE_MODEL));
  if (config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_API_TOKEN)
    imageGenerators.push(
      cloudflareGenerator(config.CLOUDFLARE_ACCOUNT_ID, config.CLOUDFLARE_API_TOKEN, config.CLOUDFLARE_IMAGE_MODEL),
    );

  // Validate, lint and index the style knowledge base before anything else; an invalid library
  // stops the API (FR-STY-03). The look generator receives this library.
  const styleLibrary = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: config.APP_ENV });
  log.info({ event: 'style_library_loaded', ...styleLibrary.counts });
  const db = deps.db ?? (await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI));

  try {
    // Fixture safeguard (issue #52, D-78, T-30): refuse to start in production if any fixture document exists.
    await assertNoFixtureDocuments(db, config, log);
  } catch (err) {
    if (!deps.db) {
      await db.close();
    }
    throw err;
  }

  const { app, authService, accountService } = createApp({
    config,
    db,
    logger: log,
    emailSender,
    smsSender,
    googleVerifier: google,
    styleLibrary,
    wordingProvider,
    photoAnalysisProvider,
    outfitImageProvider,
    shoppingProvider,
    designAnalysisProvider,
    imageGenerators,
  });

  if (deps.listen === false) {
    return { app, db, config, logger: log, styleLibrary, authService, accountService };
  }

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    log.info({
      event: 'api_started',
      port: config.PORT,
      appEnv: config.APP_ENV,
      email: emailSender.kind,
      sms: smsSender?.kind ?? 'none',
      google: Boolean(google),
      aiWording: config.AI_WORDING_ENABLED,
      photoAnalysis: Boolean(photoAnalysisProvider),
      outfitImages: Boolean(outfitImageProvider),
      priceRanges: Boolean(shoppingProvider),
      designStudio: Boolean(designAnalysisProvider),
      designImages: imageGenerators.map((g) => g.name),
    });
  });

  const shutdown = () => {
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, app, db, config, logger: log, styleLibrary, authService, accountService };
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js') ||
    process.argv[1].endsWith('src\\server.ts') ||
    process.argv[1].endsWith('src/server.ts'));

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer().catch((err: unknown) => {
    logger.fatal({ event: 'api_start_failed', reason: err instanceof Error ? err.message : 'unknown' });
    process.exit(1);
  });
}
