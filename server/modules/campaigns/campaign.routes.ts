
import { Router } from 'express';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignRepository } from './campaign.repository';
import { authenticate } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validation.middleware';
import { insertCampaignSchema } from '@shared/schema';

const router = Router();

// Dependency Injection
const campaignRepository = new CampaignRepository();
const campaignService = new CampaignService(campaignRepository);
const campaignController = new CampaignController(campaignService);

// Routes
router.get('/', authenticate, campaignController.getAll);
router.get('/:id', authenticate, campaignController.getById);
router.post('/', authenticate, validate(insertCampaignSchema), campaignController.create);
router.put('/:id', authenticate, campaignController.update);
router.delete('/:id', authenticate, campaignController.delete);

export default router;
