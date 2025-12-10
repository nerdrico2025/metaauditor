import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all ad sets for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let adSets = await storage.getAdSetsByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      adSets = adSets.filter(a => campaignIds.has(a.campaignId));
    }
    
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
    let companyId = (req as any).user?.companyId;
    
    // If companyId is not in token, fetch from user record
    if (!companyId && userId) {
      const user = await storage.getUserById(userId);
      companyId = user?.companyId || null;
    }
    
    const adSet = await storage.createAdSet({
      ...req.body,
      userId,
      companyId,
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

// Delete all ad sets for user
router.delete('/bulk/all', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    await storage.deleteAllAdSetsByUser(userId);
    
    // Reset lastSync for all user integrations to force FULL sync next time
    const integrations = await storage.getIntegrationsByUser(userId);
    for (const integration of integrations) {
      await storage.updateIntegration(integration.id, { lastSync: null });
    }
    
    res.json({ message: 'Todos os grupos de anúncios foram excluídos com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
