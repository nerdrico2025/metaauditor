
import type { Response } from 'express';
import type { AuthRequest } from '../../auth';
import { asyncHandler } from '../../core/errors/errorHandler';
import { CreativeService } from './creative.service';
import type { InsertCreative } from '@shared/schema';

export class CreativeController {
  constructor(private creativeService: CreativeService) {}

  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const creatives = await this.creativeService.getCreativesByUser(req.user!.id);

    res.json({
      status: 'success',
      data: creatives
    });
  });

  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const creative = await this.creativeService.getCreativeById(req.params.id);

    res.json({
      status: 'success',
      data: creative
    });
  });

  getByCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
    const creatives = await this.creativeService.getCreativesByCampaign(req.params.campaignId);

    res.json({
      status: 'success',
      data: creatives
    });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: InsertCreative = {
      ...req.body,
      userId: req.user!.id,
    };

    const creative = await this.creativeService.createCreative(data);

    res.status(201).json({
      status: 'success',
      data: creative
    });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const creative = await this.creativeService.updateCreative(req.params.id, req.body);

    res.json({
      status: 'success',
      data: creative
    });
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    await this.creativeService.deleteCreative(req.params.id);

    res.json({
      status: 'success',
      message: 'Criativo removido com sucesso'
    });
  });
}
