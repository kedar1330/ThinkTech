import type { RequestHandler } from 'express';
import {
  clothingPreferenceSchema,
  garmentTypeIdSchema,
  type DesignFeaturesQuery,
  type SaveDesignSelectionRequest,
  type UpdateDesignPreferencesRequest,
} from '@styleme/contracts';
import { z } from 'zod';
import type { DesignService } from '../services/design.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

const deleteSelectionQuery = z.object({ department: clothingPreferenceSchema.optional() });

/** HTTP only: every request is scoped to the authenticated user's own preferences and selections. */
export class DesignController {
  constructor(private readonly design: DesignService) {}

  private user(req: Parameters<RequestHandler>[0]) {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    return req.auth.user._id;
  }

  taxonomy: RequestHandler = async (req, res) => {
    const query = res.locals.query as { department?: 'women' | 'men' };
    sendData(res, await this.design.taxonomy(this.user(req), query.department));
  };

  features: RequestHandler = async (req, res) => {
    sendData(res, await this.design.features(this.user(req), res.locals.query as DesignFeaturesQuery));
  };

  getPreferences: RequestHandler = async (req, res) => {
    sendData(res, await this.design.getPreferences(this.user(req)));
  };

  updatePreferences: RequestHandler = async (req, res) => {
    sendData(res, await this.design.updatePreferences(this.user(req), req.body as UpdateDesignPreferencesRequest));
  };

  listSelections: RequestHandler = async (req, res) => {
    sendData(res, await this.design.listSelections(this.user(req)));
  };

  saveSelection: RequestHandler = async (req, res) => {
    sendData(res, await this.design.saveSelection(this.user(req), req.body as SaveDesignSelectionRequest));
  };

  deleteSelection: RequestHandler = async (req, res) => {
    const garmentType = garmentTypeIdSchema.safeParse(req.params.garmentType);
    const query = deleteSelectionQuery.safeParse(req.query);
    if (!garmentType.success || !query.success) throw new AppError('INVALID_REQUEST');
    await this.design.deleteSelection(this.user(req), garmentType.data, query.data.department);
    sendData(res, { deleted: true });
  };
}
