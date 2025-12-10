
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get dashboard metrics
router.get('/metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let campaigns = await storage.getCampaignsByUser(userId);
    let creatives = await storage.getCreativesByUser(userId);
    let audits = await storage.getAuditsByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      campaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(creatives.map(c => c.id));
      audits = audits.filter(a => creativeIds.has(a.creativeId));
    }
    
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
    const integrationId = req.query.integrationId as string | undefined;
    
    let audits = await storage.getRecentAudits(userId, 50); // Get more initially for filtering
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      
      const creatives = await storage.getCreativesByUser(userId);
      const filteredCreatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(filteredCreatives.map(c => c.id));
      
      audits = audits.filter(a => creativeIds.has(a.creativeId));
    }
    
    res.json(audits.slice(0, 10)); // Return only 10 after filtering
  } catch (error) {
    next(error);
  }
});

// Get problem creatives (creatives with non-compliant audits)
router.get('/problem-creatives', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let audits = await storage.getAuditsByUser(userId);
    let problemAudits = audits.filter(a => a.status === 'non_compliant' || a.status === 'nao_conforme');
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      
      const creatives = await storage.getCreativesByUser(userId);
      const filteredCreatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(filteredCreatives.map(c => c.id));
      
      problemAudits = problemAudits.filter(a => creativeIds.has(a.creativeId));
    }
    
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
