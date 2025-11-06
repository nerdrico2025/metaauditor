
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get dashboard metrics
router.get('/metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    const campaigns = await storage.getCampaignsByUser(userId);
    const creatives = await storage.getCreativesByUser(userId);
    const audits = await storage.getAuditsByUser(userId);
    
    res.json({
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalCreatives: creatives.length,
      totalAudits: audits.length,
      problemCreatives: creatives.filter(c => c.complianceStatus === 'nao_conforme').length,
    });
  } catch (error) {
    next(error);
  }
});

// Get recent audits
router.get('/recent-audits', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const audits = await storage.getRecentAudits(userId, 10);
    res.json(audits);
  } catch (error) {
    next(error);
  }
});

// Get problem creatives
router.get('/problem-creatives', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creatives = await storage.getCreativesByUser(userId);
    const problemCreatives = creatives.filter(c => c.complianceStatus === 'nao_conforme');
    res.json(problemCreatives);
  } catch (error) {
    next(error);
  }
});

export default router;
