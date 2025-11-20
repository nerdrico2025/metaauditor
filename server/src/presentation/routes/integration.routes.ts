
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

// Get sync history for user
router.get('/sync-history', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const history = await storage.getSyncHistoryByUser(userId);
    res.json(history);
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
  // For SSE, we need to authenticate using Replit Auth headers
  // EventSource cannot send custom Authorization headers
  const replitUserId = req.headers['x-replit-user-id'] as string;
  
  if (!replitUserId) {
    return res.status(401).json({ message: 'Não autenticado' });
  }
  
  const integration = await storage.getIntegrationById(req.params.id);
  
  if (!integration || integration.userId !== replitUserId) {
    return res.status(404).json({ message: 'Integração não encontrada' });
  }
  
  const userId = replitUserId;

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
      // Create sync history record
      const syncHistoryRecord = await storage.createSyncHistory({
        integrationId: integration.id,
        userId,
        status: 'running',
        type: 'full',
        metadata: { platform: 'meta' }
      });
      
      sendEvent('start', { 
        message: 'Iniciando sincronização...',
        note: 'A primeira sincronização pode levar alguns minutos dependendo da quantidade de anúncios na sua conta.'
      });

      try {
        // ===============================
        // STEP 1: Sync Campaigns
        // ===============================
        sendEvent('step', { 
          step: 1, 
          totalSteps: 3,
          name: 'Buscando campanhas...',
          description: 'Carregando todas as campanhas da sua conta Meta Ads'
        });
        
        const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
        
        sendEvent('step', { 
          step: 1, 
          totalSteps: 3,
          name: 'Salvando campanhas',
          description: `Encontramos ${campaigns.length} campanhas. Salvando no banco de dados...`
        });
        
        // Save campaigns and build map
        const campaignMap = new Map<string, string>();
        const existingCampaigns = await storage.getCampaignsByUser(userId);
        
        for (let i = 0; i < campaigns.length; i++) {
          const campaign = campaigns[i];
          let dbCampaign = existingCampaigns.find(c => c.externalId === campaign.externalId);
          
          if (dbCampaign) {
            await storage.updateCampaign(dbCampaign.id, campaign);
            campaignMap.set(campaign.externalId, dbCampaign.id);
          } else {
            dbCampaign = await storage.createCampaign(campaign);
            campaignMap.set(campaign.externalId, dbCampaign!.id);
          }
          syncedCampaigns++;
          
          // Send progress update every 10 campaigns
          if ((i + 1) % 10 === 0 || i === campaigns.length - 1) {
            sendEvent('progress', {
              step: 1,
              current: i + 1,
              total: campaigns.length,
              message: `Salvando campanhas: ${i + 1} de ${campaigns.length}`
            });
          }
        }
        
        // Clean up obsolete campaigns
        const campaignExternalIds = campaigns.map(c => c.externalId);
        const deletedCampaigns = await storage.deleteCampaignsNotInList(userId, campaignExternalIds);
        
        sendEvent('step-complete', { 
          step: 1,
          name: 'Campanhas sincronizadas',
          count: syncedCampaigns,
          deleted: deletedCampaigns
        });

        // ===============================
        // STEP 2: Sync Ad Sets
        // ===============================
        sendEvent('step', { 
          step: 2, 
          totalSteps: 3,
          name: 'Buscando grupos de anúncios...',
          description: 'Carregando todos os grupos de anúncios (ad sets) da sua conta'
        });
        
        const adSets = await metaAdsService.syncAllAdSetsFromAccount(
          integration,
          userId,
          companyId,
          campaignMap
        );
        
        sendEvent('step', { 
          step: 2, 
          totalSteps: 3,
          name: 'Salvando grupos de anúncios',
          description: `Encontramos ${adSets.length} grupos de anúncios. Salvando no banco de dados...`
        });
        
        // Save ad sets and build map
        const adSetMap = new Map<string, { dbId: string; campaignId: string }>();
        const existingAdSets = await storage.getAdSetsByUser(userId);
        
        for (let i = 0; i < adSets.length; i++) {
          const adSet = adSets[i];
          let dbAdSet = existingAdSets.find(a => a.externalId === adSet.externalId);
          
          if (dbAdSet) {
            await storage.updateAdSet(dbAdSet.id, adSet);
            adSetMap.set(adSet.externalId, { dbId: dbAdSet.id, campaignId: adSet.campaignId });
          } else {
            dbAdSet = await storage.createAdSet(adSet);
            adSetMap.set(adSet.externalId, { dbId: dbAdSet!.id, campaignId: adSet.campaignId });
          }
          syncedAdSets++;
          
          // Send progress update every 10 ad sets
          if ((i + 1) % 10 === 0 || i === adSets.length - 1) {
            sendEvent('progress', {
              step: 2,
              current: i + 1,
              total: adSets.length,
              message: `Salvando grupos de anúncios: ${i + 1} de ${adSets.length}`
            });
          }
        }
        
        // Clean up obsolete ad sets
        const adSetExternalIds = adSets.map(a => a.externalId);
        const deletedAdSets = await storage.deleteAdSetsNotInList(userId, adSetExternalIds);
        
        sendEvent('step-complete', { 
          step: 2,
          name: 'Grupos de anúncios sincronizados',
          count: syncedAdSets,
          deleted: deletedAdSets
        });

        // ===============================
        // STEP 3: Sync Ads (Creatives)
        // ===============================
        sendEvent('step', { 
          step: 3, 
          totalSteps: 3,
          name: 'Buscando anúncios...',
          description: 'Carregando todos os anúncios e suas imagens da sua conta'
        });
        
        const ads = await metaAdsService.syncAllAdsFromAccount(
          integration,
          userId,
          companyId,
          adSetMap
        );
        
        sendEvent('step', { 
          step: 3, 
          totalSteps: 3,
          name: 'Salvando anúncios',
          description: `Encontramos ${ads.length} anúncios. Baixando imagens e salvando...`
        });
        
        // Save creatives
        const existingCreatives = await storage.getCreativesByUser(userId);
        
        for (let i = 0; i < ads.length; i++) {
          const creative = ads[i];
          const existingCreative = existingCreatives.find(c => c.externalId === creative.externalId);
          
          if (existingCreative) {
            await storage.updateCreative(existingCreative.id, creative);
          } else {
            await storage.createCreative(creative);
          }
          syncedCreatives++;
          
          // Send progress update every 50 ads (ads can be many!)
          if ((i + 1) % 50 === 0 || i === ads.length - 1) {
            sendEvent('progress', {
              step: 3,
              current: i + 1,
              total: ads.length,
              message: `Salvando anúncios: ${i + 1} de ${ads.length}`
            });
          }
        }
        
        // Clean up obsolete creatives
        const creativeExternalIds = ads.map(a => a.externalId);
        const deletedCreatives = await storage.deleteCreativesNotInList(userId, creativeExternalIds);
        
        sendEvent('step-complete', { 
          step: 3,
          name: 'Anúncios sincronizados',
          count: syncedCreatives,
          deleted: deletedCreatives
        });

        // Update sync history with success
        await storage.updateSyncHistory(syncHistoryRecord.id, {
          status: 'completed',
          completedAt: new Date(),
          campaignsSynced: syncedCampaigns,
          adSetsSynced: syncedAdSets,
          creativeSynced: syncedCreatives
        });
        
        // Update integration's lastFullSync
        await storage.updateIntegration(integration.id, {
          lastFullSync: new Date()
        });

        sendEvent('complete', {
          message: 'Sincronização concluída com sucesso!',
          campaigns: syncedCampaigns,
          adSets: syncedAdSets,
          creatives: syncedCreatives
        });
      } catch (error: any) {
        console.error('❌ Error during sync:', error.message);
        
        // Update sync history with error
        await storage.updateSyncHistory(syncHistoryRecord.id, {
          status: syncedCampaigns > 0 ? 'partial' : 'failed',
          completedAt: new Date(),
          campaignsSynced: syncedCampaigns,
          adSetsSynced: syncedAdSets,
          creativeSynced: syncedCreatives,
          errorMessage: error.message
        });
        
        sendEvent('error', { message: error.message });
      }
    }
    
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
      // Create sync history record
      const syncHistoryRecord = await storage.createSyncHistory({
        integrationId: integration.id,
        userId,
        status: 'running',
        type: 'full',
        metadata: { platform: 'meta' }
      });
      
      console.log(`🚀 Starting Meta Ads OPTIMIZED sync - fetching from ACCOUNT level...`);
      
      try {
        // ===============================
        // STEP 1: Sync ALL Campaigns
        // ===============================
        console.log(`\n📊 STEP 1: Syncing campaigns...`);
        const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId);
        console.log(`✅ Found ${campaigns.length} campaigns from Meta API`);
        
        // Save all campaigns to DB and build campaign map
        const campaignMap = new Map<string, string>(); // externalId -> dbId
        const existingCampaigns = await storage.getCampaignsByUser(userId);
        
        for (const campaign of campaigns) {
          let dbCampaign = existingCampaigns.find(c => c.externalId === campaign.externalId);
          
          if (dbCampaign) {
            await storage.updateCampaign(dbCampaign.id, campaign);
            campaignMap.set(campaign.externalId, dbCampaign.id);
          } else {
            dbCampaign = await storage.createCampaign(campaign);
            campaignMap.set(campaign.externalId, dbCampaign!.id);
          }
          syncedCampaigns++;
        }
        
        // Clean up obsolete campaigns
        const campaignExternalIds = campaigns.map(c => c.externalId);
        const deletedCampaigns = await storage.deleteCampaignsNotInList(userId, campaignExternalIds);
        if (deletedCampaigns > 0) {
          console.log(`🗑️  Removed ${deletedCampaigns} obsolete campaigns from database`);
        }

        // ===============================
        // STEP 2: Sync ALL Ad Sets (from account)
        // ===============================
        console.log(`\n📦 STEP 2: Syncing ALL ad sets from entire account...`);
        const adSets = await metaAdsService.syncAllAdSetsFromAccount(
          integration,
          userId,
          companyId,
          campaignMap
        );
        console.log(`✅ Found ${adSets.length} ad sets from Meta API`);
        
        // Save all ad sets to DB and build ad set map
        const adSetMap = new Map<string, { dbId: string; campaignId: string }>(); // externalId -> { dbId, campaignId }
        const existingAdSets = await storage.getAdSetsByUser(userId);
        
        for (const adSet of adSets) {
          let dbAdSet = existingAdSets.find(a => a.externalId === adSet.externalId);
          
          if (dbAdSet) {
            await storage.updateAdSet(dbAdSet.id, adSet);
            adSetMap.set(adSet.externalId, { dbId: dbAdSet.id, campaignId: adSet.campaignId });
          } else {
            dbAdSet = await storage.createAdSet(adSet);
            adSetMap.set(adSet.externalId, { dbId: dbAdSet!.id, campaignId: adSet.campaignId });
          }
          syncedAdSets++;
        }
        
        // Clean up obsolete ad sets
        const adSetExternalIds = adSets.map(a => a.externalId);
        const deletedAdSets = await storage.deleteAdSetsNotInList(userId, adSetExternalIds);
        if (deletedAdSets > 0) {
          console.log(`🗑️  Removed ${deletedAdSets} obsolete ad sets from database`);
        }

        // ===============================
        // STEP 3: Sync ALL Ads (from account)
        // ===============================
        console.log(`\n🎨 STEP 3: Syncing ALL ads from entire account...`);
        const ads = await metaAdsService.syncAllAdsFromAccount(
          integration,
          userId,
          companyId,
          adSetMap
        );
        console.log(`✅ Found ${ads.length} ads from Meta API`);
        
        // Save all ads to DB
        const existingCreatives = await storage.getCreativesByUser(userId);
        
        for (const creative of ads) {
          const existingCreative = existingCreatives.find(c => c.externalId === creative.externalId);
          
          if (existingCreative) {
            await storage.updateCreative(existingCreative.id, creative);
          } else {
            await storage.createCreative(creative);
          }
          syncedCreatives++;
        }
        
        // Clean up obsolete creatives
        const creativeExternalIds = ads.map(a => a.externalId);
        const deletedCreatives = await storage.deleteCreativesNotInList(userId, creativeExternalIds);
        if (deletedCreatives > 0) {
          console.log(`🗑️  Removed ${deletedCreatives} obsolete ads from database`);
        }
        
        console.log(`\n🎉 Meta sync completed successfully!`);
        console.log(`   📊 Campaigns: ${syncedCampaigns} synced (${deletedCampaigns} deleted)`);
        console.log(`   📦 Ad Sets: ${syncedAdSets} synced (${deletedAdSets} deleted)`);
        console.log(`   🎨 Ads: ${syncedCreatives} synced (${deletedCreatives} deleted)`);
        
        // Update sync history with success
        await storage.updateSyncHistory(syncHistoryRecord.id, {
          status: 'completed',
          completedAt: new Date(),
          campaignsSynced: syncedCampaigns,
          adSetsSynced: syncedAdSets,
          creativeSynced: syncedCreatives
        });
        
        // Update integration's lastFullSync
        await storage.updateIntegration(integration.id, {
          lastFullSync: new Date()
        });
      } catch (error: any) {
        console.error('❌ Error during sync:', error.message);
        
        // Update sync history with error/partial status
        await storage.updateSyncHistory(syncHistoryRecord.id, {
          status: syncedCampaigns > 0 ? 'partial' : 'failed',
          completedAt: new Date(),
          campaignsSynced: syncedCampaigns,
          adSetsSynced: syncedAdSets,
          creativeSynced: syncedCreatives,
          errorMessage: error.message
        });
        
        throw error; // Re-throw to be caught by outer catch
      }
    } else if (integration.platform === 'google') {
      // Sync Google Ads campaigns
      const campaigns = await googleAdsService.syncCampaigns(integration, userId, companyId);
      
      for (const campaign of campaigns) {
        const dbCampaign = await storage.createCampaign(campaign);
        syncedCampaigns++;

        if (!dbCampaign) continue;

        // Sync creatives for each campaign
        const creatives = await googleAdsService.syncCreatives(
          integration,
          campaign.externalId,
          dbCampaign.id,
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

// Debug endpoint: Count ads in database vs Meta API
router.get('/:id/debug/count-ads', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.userId !== userId) {
      return res.status(403).json({ message: 'Sem permissão para acessar esta integração' });
    }

    // Get all campaigns from this integration
    const campaigns = await storage.getCampaignsByUser(userId);
    const metaCampaigns = campaigns.filter(c => c.platform === 'meta' && c.integrationId === integration.id);

    let totalAdsInDB = 0;
    const campaignDetails = [];

    for (const campaign of metaCampaigns) {
      // Get ad sets for this campaign
      const adSets = await storage.getAdSetsByCampaign(campaign.id);
      
      let campaignAdCount = 0;
      const adSetDetails = [];

      for (const adSet of adSets) {
        // Count creatives for this ad set
        const creatives = await storage.getCreativesByUser(userId);
        const adSetCreatives = creatives.filter(c => c.adSetId === adSet.id);
        
        campaignAdCount += adSetCreatives.length;
        totalAdsInDB += adSetCreatives.length;

        adSetDetails.push({
          id: adSet.id,
          name: adSet.name,
          externalId: adSet.externalId,
          adsInDB: adSetCreatives.length,
          status: adSet.status
        });
      }

      campaignDetails.push({
        id: campaign.id,
        name: campaign.name,
        externalId: campaign.externalId,
        adSetsCount: adSets.length,
        adsInDB: campaignAdCount,
        status: campaign.status,
        adSets: adSetDetails
      });
    }

    // Now fetch from Meta API to compare (test ALL campaigns)
    let totalAdsFromAPI = 0;
    let totalAdSetsFromAPI = 0;
    const apiComparison = [];

    if (integration.platform === 'meta' && integration.accessToken) {
      console.log(`📊 Testing ALL ${metaCampaigns.length} campaigns from Meta API...`);
      
      for (let i = 0; i < metaCampaigns.length; i++) {
        const campaign = metaCampaigns[i];
        console.log(`[${i+1}/${metaCampaigns.length}] Testing campaign: ${campaign.name}`);
        
        try {
          const apiUrl = `https://graph.facebook.com/v21.0/${campaign.externalId}/adsets?fields=id,name&limit=100&access_token=${integration.accessToken}`;
          const response = await fetch(apiUrl);
          const data = await response.json() as any;
          
          const adSetsFromAPI = data.data || [];
          let campaignAdsFromAPI = 0;
          totalAdSetsFromAPI += adSetsFromAPI.length;
          
          console.log(`  ↳ Found ${adSetsFromAPI.length} ad sets`);

          for (const apiAdSet of adSetsFromAPI) {
            const adsUrl = `https://graph.facebook.com/v21.0/${apiAdSet.id}/ads?fields=id&limit=1000&access_token=${integration.accessToken}`;
            const adsResponse = await fetch(adsUrl);
            const adsData = await adsResponse.json() as any;
            
            const adsCount = adsData.data?.length || 0;
            campaignAdsFromAPI += adsCount;
            totalAdsFromAPI += adsCount;
            
            if (adsCount > 0) {
              console.log(`    ↳ Ad Set "${apiAdSet.name}": ${adsCount} ads`);
            }
          }

          const dbCampaign = campaignDetails.find(c => c.externalId === campaign.externalId);
          
          apiComparison.push({
            campaignName: campaign.name,
            externalId: campaign.externalId,
            adSetsFromAPI: adSetsFromAPI.length,
            adsInDB: dbCampaign?.adsInDB || 0,
            adsFromAPI: campaignAdsFromAPI,
            difference: campaignAdsFromAPI - (dbCampaign?.adsInDB || 0)
          });
        } catch (error: any) {
          console.error(`❌ Error fetching API data for campaign ${campaign.name}:`, error);
          apiComparison.push({
            campaignName: campaign.name,
            externalId: campaign.externalId,
            adSetsFromAPI: 0,
            adsInDB: 0,
            adsFromAPI: 0,
            difference: 0,
            error: error.message
          });
        }
      }
      
      console.log(`✅ API Check Complete: ${totalAdSetsFromAPI} ad sets, ${totalAdsFromAPI} ads`);
    }

    return res.json({
      integration: {
        id: integration.id,
        platform: integration.platform,
        accountName: integration.accountName
      },
      database: {
        totalCampaigns: metaCampaigns.length,
        totalAdSets: campaignDetails.reduce((sum, c) => sum + c.adSetsCount, 0),
        totalAds: totalAdsInDB
      },
      apiSample: {
        campaignsChecked: apiComparison.length,
        totalAdSetsFound: totalAdSetsFromAPI,
        totalAdsFound: totalAdsFromAPI,
        campaigns: apiComparison.filter(c => c.adsFromAPI > 0 || c.adsInDB > 0) // Only show campaigns with ads
      },
      note: `Tested ALL ${apiComparison.length} campaigns from your Meta account`
    });
  } catch (error: any) {
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
