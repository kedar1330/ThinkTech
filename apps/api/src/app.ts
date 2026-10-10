import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config/env';
import { AuthController } from './controllers/auth.controller';
import type { Database } from './db';
import { authenticate } from './middleware/authenticate';
import { clientIp } from './middleware/client-ip';
import './middleware/context';
import { errorHandler, notFound } from './middleware/error-handler';
import { createAuthRateLimits } from './middleware/rate-limit';
import { authRoutes } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import { noEmailProvider, type EmailSender } from './services/email';
import { sendError } from './utils/respond';
import pkg from '../package.json' with { type: 'json' };

export interface AppDeps {
  config: Config;
  db: Database;
  logger: Logger;
  emailSender?: EmailSender;
}

export interface App {
  app: Express;
  authService: AuthService;
}

export function createApp({ config, db, logger, emailSender = noEmailProvider }: AppDeps): App {
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

  const authService = new AuthService(config, db.models, db.main, emailSender, logger);
  const requireAuth = authenticate(db.models, authService.sessions);
  app.use('/v1', authRoutes(new AuthController(authService), requireAuth, createAuthRateLimits()));

  app.use(notFound);
  app.use(errorHandler);
  return { app, authService };
}
