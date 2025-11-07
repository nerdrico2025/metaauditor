
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
    let syncedAdSets = 0;
    let syncedCreatives = 0;

    // Sync based on platform
    if (integration.platform === 'meta') {
      console.log('🚀 Starting Meta Ads sync with full hierarchy...');
      
      try {
        // Sync Meta Ads campaigns
        const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
        console.log(`📊 Found ${campaigns.length} campaigns`);
        
        for (let i = 0; i < campaigns.length; i++) {
          const campaign = campaigns[i];
          console.log(`\n📌 Processing campaign ${i + 1}/${campaigns.length}: ${campaign.name}`);
          
          try {
            // Check if campaign exists by externalId
            const existingCampaigns = await storage.getCampaignsByUser(userId);
            let dbCampaign = existingCampaigns.find(c => c.externalId === campaign.externalId);
            
            if (dbCampaign) {
              // Update existing campaign
              await storage.updateCampaign(dbCampaign.id, campaign);
              console.log(`🔄 Campaign updated: ${campaign.name}`);
            } else {
              // Create new campaign
              dbCampaign = await storage.createCampaign(campaign);
              console.log(`✅ Campaign created: ${campaign.name}`);
            }
            syncedCampaigns++;
            
            if (!dbCampaign) continue;

            // Add longer delay between campaigns to avoid rate limit
            if (i > 0 && i % 3 === 0) {
              console.log(`⏱️  Processed ${i} campaigns, pausing 5s to avoid rate limit...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Sync ad sets for each campaign
            const adSets = await metaAdsService.syncAdSets(
              integration,
              campaign.externalId,
              dbCampaign.id,
              userId
            );
            console.log(`  📋 Found ${adSets.length} ad sets in campaign ${campaign.name}`);

            for (let j = 0; j < adSets.length; j++) {
              const adSet = adSets[j];
              console.log(`  📌 Processing ad set ${j + 1}/${adSets.length}: ${adSet.name}`);
              
              try {
                // Check if ad set exists by externalId
                const existingAdSets = await storage.getAdSetsByUser(userId);
                let dbAdSet = existingAdSets.find(a => a.externalId === adSet.externalId);
                
                if (dbAdSet) {
                  // Update existing ad set
                  await storage.updateAdSet(dbAdSet.id, adSet);
                  console.log(`  🔄 Ad Set updated: ${adSet.name}`);
                } else {
                  // Create new ad set
                  dbAdSet = await storage.createAdSet(adSet);
                  console.log(`  ✅ Ad Set created: ${adSet.name}`);
                }
                syncedAdSets++;
                
                if (!dbAdSet || !dbCampaign) continue;

                // Add delay between ad sets
                if (j > 0 && j % 2 === 0) {
                  console.log(`  ⏱️  Pausing 3s between ad sets...`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // Sync creatives for each ad set
                const creatives = await metaAdsService.syncCreatives(
                  integration,
                  adSet.externalId,
                  dbAdSet.id,
                  dbCampaign.id,
                  userId
                );
                console.log(`    🎨 Found ${creatives.length} ads in ad set ${adSet.name}`);

                for (let k = 0; k < creatives.length; k++) {
                  const creative = creatives[k];
                  console.log(`    📌 Processing ad ${k + 1}/${creatives.length}: ${creative.name}`);
                  
                  // Check if creative exists by externalId
                  const existingCreatives = await storage.getCreativesByUser(userId);
                  const existingCreative = existingCreatives.find(c => c.externalId === creative.externalId);
                  
                  if (existingCreative) {
                    // Update existing creative
                    await storage.updateCreative(existingCreative.id, creative);
                    console.log(`    🔄 Creative updated: ${creative.name}`);
                  } else {
                    // Create new creative
                    await storage.createCreative(creative);
                    console.log(`    ✅ Creative created: ${creative.name}`);
                  }
                  syncedCreatives++;
                }
              } catch (adSetError: any) {
                console.error(`❌ Error processing ad set ${adSet.name}:`, adSetError.message);
                // Continue with next ad set instead of failing completely
                continue;
              }
            }
          } catch (campaignError: any) {
            console.error(`❌ Error processing campaign ${campaign.name}:`, campaignError.message);
            // Continue with next campaign instead of failing completely
            continue;
          }
        }
        
        console.log(`🎉 Meta sync completed: ${syncedCampaigns} campaigns, ${syncedAdSets} ad sets, ${syncedCreatives} ads`);
      } catch (error: any) {
        console.error('❌ Error during sync, but returning partial results:', error.message);
        // Return partial results instead of throwing
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
