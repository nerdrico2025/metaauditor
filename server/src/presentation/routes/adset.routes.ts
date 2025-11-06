import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all ad sets for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const adSets = await storage.getAdSetsByUser(userId);
    res.json(adSets);
  } catch (error) {
    next(error);
  }
});

// Get ad sets by campaign
router.get('/campaign/:campaignId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSets = await storage.getAdSetsByCampaign(req.params.campaignId);
    res.json(adSets);
  } catch (error) {
    next(error);
  }
});

// Get ad set by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.getAdSetById(req.params.id);
    if (!adSet) {
      return res.status(404).json({ message: 'Ad set não encontrado' });
    }
    res.json(adSet);
  } catch (error) {
    next(error);
  }
});

// Create ad set
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const adSet = await storage.createAdSet({
      ...req.body,
      userId,
    });
    res.status(201).json(adSet);
  } catch (error) {
    next(error);
  }
});

// Update ad set
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.updateAdSet(req.params.id, req.body);
    if (!adSet) {
      return res.status(404).json({ message: 'Ad set não encontrado' });
    }
    res.json(adSet);
  } catch (error) {
    next(error);
  }
});

export default router;
