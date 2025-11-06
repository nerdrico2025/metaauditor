
import type { Response } from 'express';
import type { AuthRequest } from '../../auth';
import { asyncHandler } from '../../core/errors/errorHandler';
import { CampaignService } from './campaign.service';
import type { InsertCampaign } from '@shared/schema';

export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaigns = await this.campaignService.getCampaignsByUser(req.user!.id);

    res.json({
      status: 'success',
      data: campaigns
    });
  });

  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaign = await this.campaignService.getCampaignById(req.params.id);

    res.json({
      status: 'success',
      data: campaign
    });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: InsertCampaign = {
      ...req.body,
      userId: req.user!.id,
    };

    const campaign = await this.campaignService.createCampaign(data);

    res.status(201).json({
      status: 'success',
      data: campaign
    });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaign = await this.campaignService.updateCampaign(req.params.id, req.body);

    res.json({
      status: 'success',
      data: campaign
    });
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    await this.campaignService.deleteCampaign(req.params.id);

    res.json({
      status: 'success',
      message: 'Campanha removida com sucesso'
    });
  });
}
