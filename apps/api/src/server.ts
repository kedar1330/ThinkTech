import { createApp } from './app';
import { loadConfig, type Config } from './config/env';
import { connectDatabase, type Database } from './db';
import { createLogger } from './logger';
import { geminiAssistantProvider } from './integrations/ai/assistant-client';
import { geminiDesignProvider } from './integrations/ai/design-client';
import {
  cloudflareOutfitImageProvider,
  compositeOutfitImageProvider,
  pollinationsImageProvider,
  type OutfitImageProvider,
} from './integrations/ai/image-client';
import { serperShoppingProvider } from './integrations/shopping/serper-client';
import { falTryOnRenderer, openSourceTryOnRenderer } from './integrations/tryon/fal-client';
import { pollinationsImageEditor } from './integrations/image/image-edit-client';
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
  // AI outfit images: Cloudflare primary, Pollinations backup when configured.
  const outfitProviders: OutfitImageProvider[] = [];
  if (config.OUTFIT_IMAGES_ENABLED && config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_API_TOKEN) {
    outfitProviders.push(
      cloudflareOutfitImageProvider(
        config.CLOUDFLARE_ACCOUNT_ID,
        config.CLOUDFLARE_API_TOKEN,
        config.CLOUDFLARE_IMAGE_MODEL,
      ),
    );
  }
  if (config.OUTFIT_IMAGES_ENABLED && config.CLOUDFLARE_ACCOUNT_ID_2 && config.CLOUDFLARE_API_TOKEN_2) {
    outfitProviders.push(
      cloudflareOutfitImageProvider(
        config.CLOUDFLARE_ACCOUNT_ID_2,
        config.CLOUDFLARE_API_TOKEN_2,
        config.CLOUDFLARE_IMAGE_MODEL,
      ),
    );
  }
  if (config.OUTFIT_IMAGES_ENABLED && config.POLLINATIONS_API_KEY) {
    outfitProviders.push(pollinationsImageProvider(config.POLLINATIONS_API_KEY, config.POLLINATIONS_IMAGE_MODEL));
  }
  const outfitImageProvider = outfitProviders.length > 0 ? compositeOutfitImageProvider(outfitProviders, log) : null;
  // Price ranges (#118): live whenever a Serper.dev key is set, and only locally until the founder approves
  // showing store prices (D-77); elsewhere the key is ignored and the tabs say prices are unavailable.
  const shoppingProvider =
    config.SERPER_API_KEY && config.APP_ENV === 'local' ? serperShoppingProvider(config.SERPER_API_KEY) : null;
  // Design Studio (D-134): live whenever a Gemini key is set, unless DESIGN_STUDIO_ENABLED=false. Each image service
  // joins the failover chain when its key is set (Cloudflare first, then Pollinations).
  const designAnalysisProvider =
    config.DESIGN_STUDIO_ENABLED && config.GEMINI_API_KEY
      ? geminiDesignProvider(config.GEMINI_API_KEY, config.GEMINI_VISION_MODEL)
      : null;
  // Style Assistant (D-136): Gemini plans and words replies whenever a key is set, unless STYLE_ASSISTANT_AI_ENABLED=false;
  // without it the assistant uses its keyword matcher and fixed wording.
  const assistantProvider =
    config.STYLE_ASSISTANT_AI_ENABLED && config.GEMINI_API_KEY
      ? geminiAssistantProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL ?? config.GEMINI_VISION_MODEL)
      : null;
  const imageGenerators: ImageGenerator[] = [];
  if (config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_API_TOKEN)
    imageGenerators.push(
      cloudflareGenerator(config.CLOUDFLARE_ACCOUNT_ID, config.CLOUDFLARE_API_TOKEN, config.CLOUDFLARE_IMAGE_MODEL),
    );
  if (config.CLOUDFLARE_ACCOUNT_ID_2 && config.CLOUDFLARE_API_TOKEN_2)
    imageGenerators.push(
      cloudflareGenerator(config.CLOUDFLARE_ACCOUNT_ID_2, config.CLOUDFLARE_API_TOKEN_2, config.CLOUDFLARE_IMAGE_MODEL),
    );
  if (config.POLLINATIONS_API_KEY)
    imageGenerators.push(pollinationsGenerator(config.POLLINATIONS_API_KEY, config.POLLINATIONS_IMAGE_MODEL));
  // Cartoon avatar drape (D-138): Pollinations image editing whenever its key is set, unless DRAPE_ENABLED=false.
  const imageEditor =
    config.DRAPE_ENABLED && config.POLLINATIONS_API_KEY
      ? pollinationsImageEditor(config.POLLINATIONS_API_KEY, config.DRAPE_MODELS)
      : null;
  // 3D Virtual Try-On (D-137, Pillar 1): live whenever TRIPOSR_URL or FAL_KEY is set, unless TRY_ON_ENABLED=false.
  const tryOnRenderer =
    config.TRY_ON_ENABLED && (config.TRIPOSR_URL || config.FAL_KEY)
      ? config.TRIPOSR_URL
        ? openSourceTryOnRenderer(config.TRIPOSR_URL)
        : falTryOnRenderer(config.FAL_KEY!, { tryOn: config.FAL_TRY_ON_MODEL, model3d: config.FAL_3D_MODEL })
      : null;

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
    assistantProvider,
    tryOnRenderer,
    imageEditor,
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
      styleAssistantAi: Boolean(assistantProvider),
      tryOn: Boolean(tryOnRenderer),
      drape: (Boolean(imageEditor) || imageGenerators.length > 0) && config.DRAPE_ENABLED,
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
