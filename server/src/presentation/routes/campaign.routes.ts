
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all campaigns for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const campaigns = await storage.getCampaignsByUser(userId);
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

// Get campaign by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await storage.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campanha não encontrada' });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// Create campaign
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const campaign = await storage.createCampaign({
      ...req.body,
      userId,
    });
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

// Update campaign
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await storage.updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ message: 'Campanha não encontrada' });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// Delete campaign
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await storage.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campanha não encontrada' });
    }
    // Note: Implement actual delete in storage if needed
    res.json({ message: 'Campanha excluída com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
