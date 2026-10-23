import type { RequestHandler } from 'express';
import type { ChatDesignRequest, ChatMessageRequest } from '@styleme/contracts';
import type { StyleAssistantService } from '../services/style-assistant.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request reads or changes only the authenticated user's own conversations. */
export class StyleAssistantController {
  constructor(private readonly assistant: StyleAssistantService) {}

  overview: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.assistant.overview(req.auth.user._id));
  };

  send: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.assistant.send(req.auth.user._id, req.body as ChatMessageRequest));
  };

  design: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.assistant.design(req.auth.user._id, req.body as ChatDesignRequest), 201);
  };

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.assistant.get(req.auth.user._id, String(req.params.id)));
  };

  remove: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.assistant.remove(req.auth.user._id, String(req.params.id));
    sendData(res, { deleted: true });
  };

  removeAll: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.assistant.removeAll(req.auth.user._id);
    sendData(res, { deleted: true });
  };
}
