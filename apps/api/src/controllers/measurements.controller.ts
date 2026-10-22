import type { RequestHandler } from 'express';
import type { UpdateMeasurementsRequest } from '@styleme/contracts';
import type { MeasurementsService } from '../services/measurements.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request reads or changes only the authenticated user's own measurements. */
export class MeasurementsController {
  constructor(private readonly measurements: MeasurementsService) {}

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.measurements.get(req.auth.user._id));
  };

  update: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.measurements.update(req.auth.user._id, req.body as UpdateMeasurementsRequest));
  };
}
