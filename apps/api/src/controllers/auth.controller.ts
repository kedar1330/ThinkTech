import type { Request, RequestHandler } from 'express';
import type {
  ChangePasswordRequest,
  DeleteAccountRequest,
  LoginRequest,
  RegisterRequest,
  ResetConfirmRequest,
  ResetRequestRequest,
} from '@styleme/contracts';
import { toUserResponse, type AuthService } from '../services/auth.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

function requireAuth(req: Request) {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  return req.auth;
}

/** HTTP only: reads validated input, calls the service, writes the envelope. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register: RequestHandler = async (req, res) => {
    sendData(res, await this.auth.register(req.body as RegisterRequest), 201);
  };

  login: RequestHandler = async (req, res) => {
    sendData(res, { accessToken: await this.auth.login(req.body as LoginRequest) });
  };

  me: RequestHandler = async (req, res) => {
    sendData(res, toUserResponse(requireAuth(req).user));
  };

  logout: RequestHandler = async (req, res) => {
    await this.auth.logout(requireAuth(req).sid);
    sendData(res, { loggedOut: true });
  };

  changePassword: RequestHandler = async (req, res) => {
    const accessToken = await this.auth.changePassword(requireAuth(req).user, req.body as ChangePasswordRequest);
    sendData(res, { accessToken });
  };

  confirmReset: RequestHandler = async (req, res) => {
    await this.auth.confirmPasswordReset(req.body as ResetConfirmRequest);
    sendData(res, { reset: true });
  };

  requestReset: RequestHandler = async (req, res) => {
    await this.auth.requestPasswordReset((req.body as ResetRequestRequest).email);
    sendData(res, { accepted: true }, 202);
  };

  deleteAccount: RequestHandler = async (req, res) => {
    await this.auth.deleteOwnAccount(requireAuth(req).user, (req.body as DeleteAccountRequest).password);
    sendData(res, { deleted: true });
  };
}
