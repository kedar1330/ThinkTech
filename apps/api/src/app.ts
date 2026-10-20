import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config/env';
import { AppearanceController } from './controllers/appearance.controller';
import { AuthController } from './controllers/auth.controller';
import { PaletteController } from './controllers/palette.controller';
import { ProfileController } from './controllers/profile.controller';
import { RecommendationsController } from './controllers/recommendations.controller';
import { ShortlistController } from './controllers/shortlist.controller';
import type { Database } from './db';
import { authenticate, requirePasswordSet } from './middleware/authenticate';
import { clientIp } from './middleware/client-ip';
import './middleware/context';
import { errorHandler, notFound } from './middleware/error-handler';
import { createAuthRateLimits } from './middleware/rate-limit';
import { appearanceRoutes } from './routes/appearance.routes';
import { authRoutes } from './routes/auth.routes';
import { paletteRoutes } from './routes/palette.routes';
import { profileRoutes } from './routes/profile.routes';
import { recommendationsRoutes } from './routes/recommendations.routes';
import { shortlistRoutes } from './routes/shortlist.routes';
import { AppearanceService } from './services/appearance.service';
import { AccountService } from './services/account.service';
import { AuthService } from './services/auth.service';
import type { GoogleVerifier } from './services/google';
import type { EmailSender, SmsSender } from './services/messaging';
import type { StyleLibrary } from './services/engine';
import { OnboardingService } from './services/onboarding.service';
import { PaletteService } from './services/palette.service';
import { ProfileService } from './services/profile.service';
import { RecommendationsService } from './services/recommendations.service';
import { ShortlistService } from './services/shortlist.service';
import { SHIPPED_LIBRARY, loadStyleLibrary } from './style-rules';
import { sendError } from './utils/respond';
import pkg from '../package.json' with { type: 'json' };

export interface AppDeps {
  config: Config;
  db: Database;
  logger: Logger;
  emailSender: EmailSender;
  /** Null when no SMS provider is available (phone verification then reports PROVIDER_NOT_CONFIGURED). */
  smsSender?: SmsSender | null;
  /** Null when Google sign-in isn't configured (GOOGLE_CLIENT_ID unset). */
  googleVerifier?: GoogleVerifier | null;
  /** Approved style library (D-110). Defaults to the shipped JSON library; tests pass fixture libraries. */
  styleLibrary?: StyleLibrary;
}

export interface App {
  app: Express;
  authService: AuthService;
  accountService: AccountService;
}

export function createApp({
  config,
  db,
  logger,
  emailSender,
  smsSender = null,
  googleVerifier = null,
  styleLibrary = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: config.APP_ENV }),
}: AppDeps): App {
  const app = express();
  app.disable('x-powered-by');
  // Staging and production run behind one platform proxy (Render), so req.ip comes from it.
  if (config.APP_ENV !== 'local') app.set('trust proxy', 1);

  app.use(helmet());
  // Browsers never call the API directly; CORS allows only the environment's web origin (D-37).
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: '16kb' }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // Only method, path (no query string) and status — never headers or bodies (D-17).
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(clientIp(config.BFF_SHARED_SECRET));

  app.get('/health', (_req, res) => {
    res.json({
      status: config.MAINTENANCE_MODE ? 'maintenance' : 'ok',
      version: pkg.version,
      time: new Date().toISOString(),
    });
  });

  // Maintenance mode (D-85): every /v1 endpoint is unavailable during a restore.
  app.use('/v1', (_req, res, next) => {
    if (config.MAINTENANCE_MODE) {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'StyleMe is temporarily unavailable');
      return;
    }
    next();
  });

  const authService = new AuthService({
    config,
    models: db.models,
    main: db.main,
    email: emailSender,
    logger,
    google: googleVerifier,
  });
  const accountService = new AccountService(config, db.models, authService, smsSender, logger);
  const requireAuth = authenticate(db.models, authService.sessions);
  const withPassword = [requireAuth, requirePasswordSet];
  const controller = new AuthController(authService, accountService, new OnboardingService(db.models));
  app.use('/v1', authRoutes(controller, requireAuth, withPassword, createAuthRateLimits()));
  const profileService = new ProfileService(db.models);
  const appearanceService = new AppearanceService(db.models);
  app.use('/v1', profileRoutes(new ProfileController(profileService), withPassword));
  app.use('/v1', appearanceRoutes(new AppearanceController(appearanceService), withPassword));
  const recommendations = new RecommendationsService(db.models, styleLibrary, profileService, appearanceService);
  app.use('/v1', recommendationsRoutes(new RecommendationsController(recommendations), withPassword));
  const palettes = new PaletteService(styleLibrary, profileService, appearanceService);
  app.use('/v1', paletteRoutes(new PaletteController(palettes), withPassword));
  app.use('/v1', shortlistRoutes(new ShortlistController(new ShortlistService(db.models)), withPassword));

  app.use(notFound);
  app.use(errorHandler);
  return { app, authService, accountService };
}
