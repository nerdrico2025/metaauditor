
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

// Disable integration (keep data)
router.post('/:id/disable', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integration = await storage.disableIntegration(req.params.id, userId);
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }
    res.json({ message: 'Integração desconectada. Os dados foram mantidos.', integration });
  } catch (error) {
    next(error);
  }
});

// Delete integration
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const deleteData = req.query.deleteData !== 'false'; // Default true
    await storage.deleteIntegration(req.params.id, userId, deleteData);
    const message = deleteData 
      ? 'Integração e todos os dados foram excluídos' 
      : 'Integração excluída (dados mantidos)';
    res.json({ message });
  } catch (error) {
    next(error);
  }
});

// SSE endpoint for real-time sync progress
router.get('/:id/sync-stream', async (req: Request, res: Response) => {
  // For SSE, accept token from query parameter since EventSource can't send headers
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  
  let userId: string;
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
  
  const integration = await storage.getIntegrationById(req.params.id);
  
  if (!integration || integration.userId !== userId) {
    return res.status(404).json({ message: 'Integração não encontrada' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;

    let syncedCampaigns = 0;
    let syncedAdSets = 0;
    let syncedCreatives = 0;

    if (integration.platform === 'meta') {
      sendEvent('progress', { message: 'Buscando campanhas...' });
      
      const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
      sendEvent('progress', { message: `Encontradas ${campaigns.length} campanhas`, totalCampaigns: campaigns.length });
      
      for (let i = 0; i < campaigns.length; i++) {
        const campaign = campaigns[i];
        sendEvent('progress', {
          message: `Processando campanha ${i + 1}/${campaigns.length}: ${campaign.name}`,
          currentCampaign: i + 1,
          totalCampaigns: campaigns.length,
          campaignName: campaign.name
        });
        
        try {
          const existingCampaigns = await storage.getCampaignsByUser(userId);
          let dbCampaign = existingCampaigns.find(c => c.externalId === campaign.externalId);
          
          if (dbCampaign) {
            await storage.updateCampaign(dbCampaign.id, campaign);
          } else {
            dbCampaign = await storage.createCampaign(campaign);
          }
          syncedCampaigns++;
          
          if (!dbCampaign) continue;

          // Delay between campaigns (8 seconds)
          if (i < campaigns.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 8000));
          }

          const adSets = await metaAdsService.syncAdSets(integration, campaign.externalId, dbCampaign.id, userId);
          sendEvent('progress', { message: `  ↳ ${adSets.length} ad sets na campanha ${campaign.name}` });

          for (let j = 0; j < adSets.length; j++) {
            const adSet = adSets[j];
            
            try {
              const existingAdSets = await storage.getAdSetsByUser(userId);
              let dbAdSet = existingAdSets.find(a => a.externalId === adSet.externalId);
              
              if (dbAdSet) {
                await storage.updateAdSet(dbAdSet.id, adSet);
              } else {
                dbAdSet = await storage.createAdSet(adSet);
              }
              syncedAdSets++;
              
              if (!dbAdSet || !dbCampaign) continue;

              // Delay between ad sets (5 seconds)
              if (j < adSets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
              }

              const creatives = await metaAdsService.syncCreatives(integration, adSet.externalId, dbAdSet.id, dbCampaign.id, userId);

              for (const creative of creatives) {
                const existingCreatives = await storage.getCreativesByUser(userId);
                const existingCreative = existingCreatives.find(c => c.externalId === creative.externalId);
                
                if (existingCreative) {
                  await storage.updateCreative(existingCreative.id, creative);
                } else {
                  await storage.createCreative(creative);
                }
                syncedCreatives++;
              }
            } catch (error: any) {
              sendEvent('error', { message: `Erro no ad set ${adSet.name}: ${error.message}`, partial: true });
            }
          }
        } catch (error: any) {
          sendEvent('error', { message: `Erro na campanha ${campaign.name}: ${error.message}`, partial: true });
        }
      }
    }

    sendEvent('complete', {
      message: 'Sincronização concluída!',
      campaigns: syncedCampaigns,
      adSets: syncedAdSets,
      creatives: syncedCreatives
    });
    
    res.end();
  } catch (error: any) {
    sendEvent('error', { message: error.message });
    res.end();
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
    let syncedAdSets = 0;
    let syncedCreatives = 0;

    // Sync based on platform
    if (integration.platform === 'meta') {
      console.log('🚀 Starting Meta Ads sync with BATCH REQUESTS (optimized for rate limits)...');
      
      try {
        // Step 1: Sync Meta Ads campaigns
        const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
        console.log(`📊 Found ${campaigns.length} campaigns`);
        
        // Step 2: Save all campaigns to DB first
        const dbCampaignsMap = new Map<string, string>(); // externalId -> dbId
        for (const campaign of campaigns) {
          const existingCampaigns = await storage.getCampaignsByUser(userId);
          let dbCampaign = existingCampaigns.find(c => c.externalId === campaign.externalId);
          
          if (dbCampaign) {
            await storage.updateCampaign(dbCampaign.id, campaign);
            dbCampaignsMap.set(campaign.externalId, dbCampaign.id);
            console.log(`🔄 Campaign updated: ${campaign.name}`);
          } else {
            dbCampaign = await storage.createCampaign(campaign);
            dbCampaignsMap.set(campaign.externalId, dbCampaign!.id);
            console.log(`✅ Campaign created: ${campaign.name}`);
          }
          syncedCampaigns++;
        }

        // Step 3: Sync ALL ad sets using BATCH REQUEST (huge performance improvement!)
        const campaignParams = Array.from(dbCampaignsMap.entries()).map(([externalId, dbId]) => ({
          externalId,
          dbId
        }));
        
        console.log(`📦 Fetching ad sets for ALL ${campaignParams.length} campaigns in batch...`);
        const adSetsByCampaign = await metaAdsService.syncAllAdSetsBatch(
          integration,
          campaignParams,
          userId
        );

        // Step 4: Save ad sets and sync creatives
        for (const [campaignDbId, adSets] of adSetsByCampaign.entries()) {
          const campaign = campaigns.find(c => dbCampaignsMap.get(c.externalId) === campaignDbId);
          console.log(`\n  📋 Processing ${adSets.length} ad sets for campaign: ${campaign?.name || campaignDbId}`);

          for (const adSet of adSets) {
            try {
              // Save ad set
              const existingAdSets = await storage.getAdSetsByUser(userId);
              let dbAdSet = existingAdSets.find(a => a.externalId === adSet.externalId);
              
              if (dbAdSet) {
                await storage.updateAdSet(dbAdSet.id, adSet);
                console.log(`  🔄 Ad Set updated: ${adSet.name}`);
              } else {
                dbAdSet = await storage.createAdSet(adSet);
                console.log(`  ✅ Ad Set created: ${adSet.name}`);
              }
              syncedAdSets++;
              
              if (!dbAdSet) continue;

              // Sync creatives for this ad set (already optimized with batch insights!)
              const creatives = await metaAdsService.syncCreatives(
                integration,
                adSet.externalId,
                dbAdSet.id,
                campaignDbId,
                userId
              );
              console.log(`    🎨 Found ${creatives.length} ads in ad set ${adSet.name}`);

              // Save creatives
              for (const creative of creatives) {
                const existingCreatives = await storage.getCreativesByUser(userId);
                const existingCreative = existingCreatives.find(c => c.externalId === creative.externalId);
                
                if (existingCreative) {
                  await storage.updateCreative(existingCreative.id, creative);
                  console.log(`    🔄 Creative updated: ${creative.name}`);
                } else {
                  await storage.createCreative(creative);
                  console.log(`    ✅ Creative created: ${creative.name}`);
                }
                syncedCreatives++;
              }
            } catch (adSetError: any) {
              console.error(`❌ Error processing ad set ${adSet.name}:`, adSetError.message);
              continue;
            }
          }
        }
        
        console.log(`🎉 Meta sync completed with BATCH REQUESTS: ${syncedCampaigns} campaigns, ${syncedAdSets} ad sets, ${syncedCreatives} ads`);
      } catch (error: any) {
        console.error('❌ Error during sync, but returning partial results:', error.message);
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
      adSets: syncedAdSets,
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
