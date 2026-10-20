import type { RequestHandler } from 'express';
import type { CatalogueCategoriesQuery, ClothingStylesQuery, CompareStylesQuery } from '@styleme/contracts';
import type { CatalogueService } from '../services/catalogue.service';
import { sendData } from '../utils/respond';

export class CatalogueController {
  constructor(private readonly service: CatalogueService) {}

  getCategories: RequestHandler = async (_req, res) => {
    const query = res.locals.query as CatalogueCategoriesQuery;
    const categories = await this.service.getCategories(query);
    sendData(res, categories);
  };

  getStyles: RequestHandler = async (_req, res) => {
    const query = res.locals.query as ClothingStylesQuery;
    const styles = await this.service.getStyles(query);
    sendData(res, styles);
  };

  getStyleById: RequestHandler = async (req, res) => {
    const styleId = String(req.params.styleId);
    const style = await this.service.getStyleById(styleId);
    sendData(res, style);
  };

  compareStyles: RequestHandler = async (_req, res) => {
    const query = res.locals.query as CompareStylesQuery;
    const ids = query.ids.split(',').map((id) => id.trim()).filter(Boolean);
    const styles = await this.service.compareStyles(ids);
    sendData(res, styles);
  };
}
