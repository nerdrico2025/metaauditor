
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { MetaAdsService } from '../../infrastructure/services/MetaAdsService.js';
import { GoogleAdsService } from '../../infrastructure/services/GoogleAdsService.js';
import { nanoid } from 'nanoid';

const router = Router();
const metaAdsService = new MetaAdsService();
const googleAdsService = new GoogleAdsService();

// Get all integrations for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrations = await storage.getIntegrationsByUser(userId);
    res.json(integrations);
  } catch (error) {
    next(error);
  }
});

// Create integration
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integration = await storage.createIntegration({
      ...req.body,
      userId,
    });
    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
});

// Update integration
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integration = await storage.updateIntegration(req.params.id, req.body);
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }
    res.json(integration);
  } catch (error) {
    next(error);
  }
});

// Delete integration
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    await storage.deleteIntegration(req.params.id, userId);
    res.json({ message: 'Integração excluída com sucesso' });
  } catch (error) {
    next(error);
  }
});

// Sync integration data (campaigns and creatives)
router.post('/:id/sync', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.userId !== userId) {
      return res.status(403).json({ message: 'Sem permissão para acessar esta integração' });
    }

    // Get user to get companyId
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;

    let syncedCampaigns = 0;
    let syncedCreatives = 0;

    // Sync based on platform
    if (integration.platform === 'meta') {
      // Sync Meta Ads campaigns
      const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
      
      for (const campaign of campaigns) {
        await storage.createCampaign(campaign);
        syncedCampaigns++;

        // Sync creatives for each campaign
        const creatives = await metaAdsService.syncCreatives(
          integration,
          campaign.externalId,
          campaign.id,
          userId
        );

        for (const creative of creatives) {
          await storage.createCreative(creative);
          syncedCreatives++;
        }
      }
    } else if (integration.platform === 'google') {
      // Sync Google Ads campaigns
      const campaigns = await googleAdsService.syncCampaigns(integration, userId, companyId);
      
      for (const campaign of campaigns) {
        await storage.createCampaign(campaign);
        syncedCampaigns++;

        // Sync creatives for each campaign
        const creatives = await googleAdsService.syncCreatives(
          integration,
          campaign.externalId,
          campaign.id,
          userId
        );

        for (const creative of creatives) {
          await storage.createCreative(creative);
          syncedCreatives++;
        }
      }
    }

    // Update last sync timestamp
    await storage.updateIntegration(req.params.id, {
      lastSync: new Date(),
    });

    res.json({
      message: 'Sincronização concluída com sucesso',
      campaigns: syncedCampaigns,
      creatives: syncedCreatives,
    });
  } catch (error) {
    console.error('Error syncing integration:', error);
    next(error);
  }
});

// Validate integration token
router.post('/:id/validate', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.userId !== userId) {
      return res.status(403).json({ message: 'Sem permissão para acessar esta integração' });
    }

    if (!integration.accessToken) {
      return res.status(400).json({ message: 'Token de acesso não configurado' });
    }

    let valid = false;

    if (integration.platform === 'meta') {
      valid = await metaAdsService.validateToken(integration.accessToken);
    } else if (integration.platform === 'google') {
      valid = await googleAdsService.validateToken(integration.accessToken);
    }

    res.json({ valid });
  } catch (error) {
    next(error);
  }
});

// Get Meta ad accounts
router.get('/meta/accounts', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.query;
    
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ message: 'Access token é obrigatório' });
    }

    const accounts = await metaAdsService.getAdAccounts(accessToken);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

// Get Google Ads customer accounts
router.get('/google/accounts', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.query;
    
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ message: 'Access token é obrigatório' });
    }

    const accounts = await googleAdsService.getCustomerAccounts(accessToken);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

export default router;
