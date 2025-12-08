
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
    
    // Count compliant and non-compliant from audits
    // conforme = fully compliant
    // parcialmente_conforme or nao_conforme = non-compliant (has issues)
    const compliantAudits = audits.filter(a => a.status === 'conforme').length;
    const nonCompliantAudits = audits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    ).length;
    
    res.json({
      activeCampaigns: campaigns.filter(c => c.status === 'Ativo' || c.status === 'active' || c.status === 'Em veiculação').length,
      totalCreatives: creatives.length,
      compliant: compliantAudits,
      nonCompliant: nonCompliantAudits,
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
