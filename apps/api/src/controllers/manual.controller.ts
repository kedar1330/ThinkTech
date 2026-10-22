import type { RequestHandler } from 'express';
import type { ManualService } from '../services/manual.service';
import { sendData } from '../utils/respond';

export class ManualController {
  constructor(private readonly manualService: ManualService) {}

  list: RequestHandler = async (_req, res) => {
    const steps = await this.manualService.listSteps();
    sendData(res, { steps });
  };
}
