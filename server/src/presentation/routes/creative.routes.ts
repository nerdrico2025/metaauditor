
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all creatives for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creatives = await storage.getCreativesByUser(userId);
    res.json(creatives);
  } catch (error) {
    next(error);
  }
});

// Get creatives by campaign
router.get('/campaign/:campaignId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatives = await storage.getCreativesByCampaign(req.params.campaignId);
    res.json(creatives);
  } catch (error) {
    next(error);
  }
});

// Get creative by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creative = await storage.getCreativeById(req.params.id);
    if (!creative) {
      return res.status(404).json({ message: 'Criativo não encontrado' });
    }
    res.json(creative);
  } catch (error) {
    next(error);
  }
});

// Create creative
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creative = await storage.createCreative({
      ...req.body,
      userId,
    });
    res.status(201).json(creative);
  } catch (error) {
    next(error);
  }
});

// Update creative
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creative = await storage.updateCreative(req.params.id, req.body);
    if (!creative) {
      return res.status(404).json({ message: 'Criativo não encontrado' });
    }
    res.json(creative);
  } catch (error) {
    next(error);
  }
});

export default router;
