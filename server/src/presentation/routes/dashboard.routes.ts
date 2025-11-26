
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
    
    // Count non-compliant from audits
    const nonCompliantAudits = audits.filter(a => a.status === 'non_compliant' || a.status === 'nao_conforme').length;
    const lowPerformanceAudits = audits.filter(a => a.status === 'low_performance' || a.status === 'baixa_performance').length;
    
    res.json({
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active' || c.status === 'Em veiculação').length,
      creativesAnalyzed: creatives.length,
      totalAudits: audits.length,
      nonCompliant: nonCompliantAudits,
      lowPerformance: lowPerformanceAudits,
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

// Get problem creatives (creatives with non-compliant audits)
router.get('/problem-creatives', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const audits = await storage.getAuditsByUser(userId);
    const problemAudits = audits.filter(a => a.status === 'non_compliant' || a.status === 'nao_conforme');
    
    // Get creative details for problem audits
    const problemCreatives = await Promise.all(
      problemAudits.map(async (audit) => {
        const creative = await storage.getCreativeById(audit.creativeId);
        return creative ? { ...creative, audit } : null;
      })
    );
    
    res.json(problemCreatives.filter(Boolean));
  } catch (error) {
    next(error);
  }
});

export default router;
