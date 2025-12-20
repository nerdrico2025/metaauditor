
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../../shared/services/storage.service.js';
import { MetaAdsService } from '../../infrastructure/services/MetaAdsService.js';
import { GoogleAdsService } from '../../infrastructure/services/GoogleAdsService.js';
import { objectStorageService } from '../../infrastructure/services/ObjectStorageService.js';
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

// Get stats for a specific integration (campaigns, adsets, creatives count)
router.get('/:id/stats', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const stats = await storage.getIntegrationStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Delete all sync history for user
router.delete('/sync-history/bulk/all', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    await storage.deleteAllSyncHistoryByUser(userId);
    res.json({ message: 'Todo o histórico de sincronização foi excluído com sucesso' });
  } catch (error) {
    next(error);
  }
});

// DEBUG: Get raw Meta API data for a specific ad
router.get('/debug/meta-ad/:adId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adId } = req.params;
    const { accountId } = req.query;
    const userId = (req as any).user?.userId;
    
    // Find integration with this account
    const integrations = await storage.getIntegrationsByUser(userId);
    const integration = integrations.find(i => 
      i.platform === 'meta' && 
      (accountId ? i.accountId === accountId : true)
    );
    
    if (!integration || !integration.accessToken) {
      return res.status(404).json({ error: 'Integração Meta não encontrada' });
    }
    
    // Fetch raw ad data from Meta API with ALL available fields
    const fields = [
      'id', 'name', 'status', 'effective_status',
      'creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id}',
      'adcreatives{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id}'
    ].join(',');
    
    const url = `https://graph.facebook.com/v21.0/${adId}?fields=${fields}&access_token=${integration.accessToken}`;
    const response = await fetch(url);
    const rawData = await response.json();
    
    // If there's an effective_object_story_id, fetch that too
    let storyData = null;
    const effectiveStoryId = rawData.creative?.effective_object_story_id;
    if (effectiveStoryId) {
      try {
        const storyUrl = `https://graph.facebook.com/v21.0/${effectiveStoryId}?fields=full_picture,picture,message,attachments{media,subattachments}&access_token=${integration.accessToken}`;
        const storyResponse = await fetch(storyUrl);
        storyData = await storyResponse.json();
      } catch (e) {
        storyData = { error: String(e) };
      }
    }
    
    // Also try fetching asset_feed_spec images if present
    let assetFeedImages: any[] = [];
    const assetFeedSpec = rawData.creative?.asset_feed_spec;
    if (assetFeedSpec?.images) {
      assetFeedImages = assetFeedSpec.images;
    }
    
    res.json({
      adId,
      rawData,
      storyData,
      assetFeedImages,
      extractedUrls: {
        image_url: rawData.creative?.image_url,
        thumbnail_url: rawData.creative?.thumbnail_url,
        story_full_picture: storyData?.full_picture,
        story_picture: storyData?.picture,
      }
    });
  } catch (error) {
    console.error('Debug Meta Ad error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Reset sync status for all user integrations (used when deleting all data)
router.post('/reset-sync', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    // Delete all sync history
    await storage.deleteAllSyncHistoryByUser(userId);
    
    // Reset lastSync and lastFullSync for all user integrations
    const integrations = await storage.getIntegrationsByUser(userId);
    for (const integration of integrations) {
      await storage.updateIntegration(integration.id, { 
        lastSync: null,
        lastFullSync: null 
      });
    }
    
    res.json({ message: 'Sincronização resetada com sucesso' });
  } catch (error) {
    next(error);
  }
});

// Create integration
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    let companyId = (req as any).user?.companyId;
    
    // If companyId is not in token, fetch from user record
    if (!companyId && userId) {
      const user = await storage.getUserById(userId);
      companyId = user?.companyId || null;
    }
    
    const integration = await storage.createIntegration({
      ...req.body,
      companyId,
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

// Create temporary token for SSE connection
router.post('/:id/sync-token', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userCompanyId = (req as any).user?.companyId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration || integration.companyId !== userCompanyId) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }
    
    // Create temporary token valid for 10 minutes
    const token = jwt.sign(
      { userId, integrationId: req.params.id, purpose: 'sse' },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '10m' }
    );
    
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

// SSE endpoint for real-time sync progress
router.get('/:id/sync-stream', async (req: Request, res: Response) => {
  // Validate SSE token from query parameter
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  
  let userId: string;
  let integrationId: string;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    if (decoded.purpose !== 'sse' || decoded.integrationId !== req.params.id) {
      return res.status(401).json({ message: 'Token inválido' });
    }
    
    userId = decoded.userId;
    integrationId = decoded.integrationId;
  } catch (error) {
    return res.status(401).json({ message: 'Token expirado ou inválido' });
  }
  
  const integration = await storage.getIntegrationById(integrationId);
  const user = await storage.getUserById(userId);
  
  if (!integration || integration.companyId !== user?.companyId) {
    return res.status(404).json({ message: 'Integração não encontrada' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Track if client disconnected
  let clientDisconnected = false;
  
  res.on('close', () => {
    console.log('🔴 Client disconnected - cancelling sync');
    clientDisconnected = true;
  });

  const sendEvent = (event: string, data: any) => {
    if (clientDisconnected) return;
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // Client may have disconnected
      clientDisconnected = true;
    }
  };
  
  // Helper to check if we should stop processing
  const shouldStop = () => clientDisconnected;

  try {
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;

    let syncedCampaigns = 0;
    let syncedAdSets = 0;
    let syncedCreatives = 0;

    if (integration.platform === 'meta') {
      // Check for last successful sync for incremental mode
      const lastSync = await storage.getLastSuccessfulSync(integration.id);
      const isIncremental = !!lastSync?.completedAt;
      const sinceDateForApi = lastSync?.completedAt;
      
      // Create sync history record
      const syncHistoryRecord = await storage.createSyncHistory({
        integrationId: integration.id,
        userId,
        status: 'running',
        type: isIncremental ? 'incremental' : 'full',
        metadata: { platform: 'meta', isIncremental, sinceDateForApi: sinceDateForApi?.toISOString() }
      });
      
      const syncModeMessage = isIncremental 
        ? `Sincronização incremental - buscando apenas alterações desde ${sinceDateForApi?.toLocaleDateString('pt-BR')}`
        : 'Primeira sincronização - buscando todos os dados da conta';
      
      sendEvent('start', { 
        message: 'Iniciando sincronização...',
        note: syncModeMessage
      });

      try {
        // ===============================
        // STEP 1: Sync Campaigns
        // ===============================
        if (shouldStop()) {
          sendEvent('cancelled', { message: 'Sincronização cancelada pelo usuário' });
          await storage.updateSyncHistory(syncHistoryRecord.id, { status: 'cancelled', completedAt: new Date() });
          return res.end();
        }
        
        sendEvent('step', { 
          step: 1, 
          totalSteps: 3,
          name: isIncremental ? 'Buscando campanhas atualizadas...' : 'Buscando campanhas...',
          description: isIncremental 
            ? 'Carregando apenas campanhas modificadas desde a última sincronização'
            : 'Carregando todas as campanhas da sua conta Meta Ads'
        });
        
        // Use incremental sync when we have a previous sync timestamp
        const campaigns = await metaAdsService.syncCampaigns(integration, userId, companyId, sinceDateForApi);
        
        if (shouldStop()) {
          sendEvent('cancelled', { message: 'Sincronização cancelada pelo usuário' });
          await storage.updateSyncHistory(syncHistoryRecord.id, { status: 'cancelled', completedAt: new Date() });
          return res.end();
        }
        
        sendEvent('step', { 
          step: 1, 
          totalSteps: 3,
          name: 'Salvando campanhas',
          description: `Encontramos ${campaigns.length} campanhas. Salvando no banco de dados...`
        });
        
        // Save campaigns using batch upsert (MUCH faster)
        const existingCampaigns = await storage.getCampaignsByUser(userId);
        const campaignMap = await storage.batchUpsertCampaigns(campaigns, existingCampaigns);
        syncedCampaigns = campaigns.length;
        
        sendEvent('progress', {
          step: 1,
          current: campaigns.length,
          total: campaigns.length,
          message: `Campanhas salvas: ${campaigns.length}`
        });
        
        // NOTE: We no longer delete campaigns not in list to preserve audits and historical data
        // Users can manually delete campaigns if needed
        
        sendEvent('step-complete', { 
          step: 1,
          name: 'Campanhas sincronizadas',
          count: syncedCampaigns
        });

        // ===============================
        // STEP 2: Sync Ad Sets
        // ===============================
        if (shouldStop()) {
          sendEvent('cancelled', { message: 'Sincronização cancelada pelo usuário' });
          await storage.updateSyncHistory(syncHistoryRecord.id, { status: 'cancelled', completedAt: new Date() });
          return res.end();
        }
        
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
        
        if (shouldStop()) {
          sendEvent('cancelled', { message: 'Sincronização cancelada pelo usuário' });
          await storage.updateSyncHistory(syncHistoryRecord.id, { status: 'cancelled', completedAt: new Date() });
          return res.end();
        }
        
        sendEvent('step', { 
          step: 2, 
          totalSteps: 3,
          name: 'Salvando grupos de anúncios',
          description: `Encontramos ${adSets.length} grupos de anúncios. Salvando no banco de dados...`
        });
        
        // Save ad sets using batch upsert (MUCH faster)
        const existingAdSets = await storage.getAdSetsByUser(userId);
        const adSetMap = await storage.batchUpsertAdSets(adSets, existingAdSets);
        syncedAdSets = adSets.length;
        
        sendEvent('progress', {
          step: 2,
          current: adSets.length,
          total: adSets.length,
          message: `Grupos de anúncios salvos: ${adSets.length}`
        });
        
        // NOTE: We no longer delete ad sets not in list to preserve audits and historical data
        // Users can manually delete ad sets if needed
        
        sendEvent('step-complete', { 
          step: 2,
          name: 'Grupos de anúncios sincronizados',
          count: syncedAdSets
        });

        // ===============================
        // STEP 3: Sync Ads (Creatives)
        // ===============================
        if (shouldStop()) {
          sendEvent('cancelled', { message: 'Sincronização cancelada pelo usuário' });
          await storage.updateSyncHistory(syncHistoryRecord.id, { status: 'cancelled', completedAt: new Date() });
          return res.end();
        }
        
        sendEvent('step', { 
          step: 3, 
          totalSteps: 3,
          name: 'Buscando anúncios...',
          description: 'Carregando todos os anúncios e suas imagens da sua conta'
        });
        
        // Get existing creatives to skip re-downloading images that already exist
        const existingCreatives = await storage.getCreativesByUser(userId);
        const existingCreativesMap = new Map<string, string | null>();
        for (const creative of existingCreatives) {
          if (creative.externalId) {
            existingCreativesMap.set(creative.externalId, creative.imageUrl);
          }
        }
        console.log(`📦 Found ${existingCreativesMap.size} existing creatives (will skip re-downloading their images)`);
        
        // Sync ads with real-time progress updates during API pagination
        const ads = await metaAdsService.syncAllAdsFromAccount(
          integration,
          userId,
          companyId,
          integration.id,
          adSetMap,
          (current: number, message?: string) => {
            // Send progress during API fetch (before total count is known)
            sendEvent('progress', {
              step: 3,
              current,
              total: current, // Total unknown during fetch, so show current as total
              message: message || `Carregando anúncios da API: ${current} encontrados...`
            });
          },
          existingCreativesMap // Pass existing creatives to skip re-downloading images
        );
        
        console.log(`🎯 About to save ${ads.length} ads to database...`);
        
        sendEvent('step', { 
          step: 3, 
          totalSteps: 3,
          name: 'Salvando anúncios',
          description: `Encontramos ${ads.length} anúncios. Salvando no banco de dados...`
        });
        
        // Save creatives using batch upsert (MUCH faster)
        console.log(`🎯 Calling batchUpsertCreatives with ${ads.length} ads and ${existingCreatives.length} existing...`);
        syncedCreatives = await storage.batchUpsertCreatives(ads, existingCreatives);
        console.log(`✅ batchUpsertCreatives completed: ${syncedCreatives} creatives saved`);
        
        sendEvent('progress', {
          step: 3,
          current: ads.length,
          total: ads.length,
          message: `Anúncios salvos: ${ads.length}`
        });
        
        // NOTE: We no longer delete creatives not in list to preserve audits and historical data
        // Users can manually delete creatives if needed
        
        sendEvent('step-complete', { 
          step: 3,
          name: 'Anúncios sincronizados',
          count: syncedCreatives
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
    const userCompanyId = (req as any).user?.companyId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.companyId !== userCompanyId) {
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
        
        // NOTE: We no longer delete campaigns not in list to preserve audits and historical data

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
        
        // NOTE: We no longer delete ad sets not in list to preserve audits and historical data

        // ===============================
        // STEP 3: Sync ALL Ads (from account)
        // ===============================
        console.log(`\n🎨 STEP 3: Syncing ALL ads from entire account...`);
        const ads = await metaAdsService.syncAllAdsFromAccount(
          integration,
          userId,
          companyId,
          integration.id,
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
        
        // NOTE: We no longer delete creatives not in list to preserve audits and historical data
        
        console.log(`\n🎉 Meta sync completed successfully!`);
        console.log(`   📊 Campaigns: ${syncedCampaigns} synced`);
        console.log(`   📦 Ad Sets: ${syncedAdSets} synced`);
        console.log(`   🎨 Ads: ${syncedCreatives} synced`);
        
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
    const userCompanyId = (req as any).user?.companyId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.companyId !== userCompanyId) {
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
          const apiUrl = `https://graph.facebook.com/v22.0/${campaign.externalId}/adsets?fields=id,name&limit=100&access_token=${integration.accessToken}`;
          const response = await fetch(apiUrl);
          const data = await response.json() as any;
          
          const adSetsFromAPI = data.data || [];
          let campaignAdsFromAPI = 0;
          totalAdSetsFromAPI += adSetsFromAPI.length;
          
          console.log(`  ↳ Found ${adSetsFromAPI.length} ad sets`);

          for (const apiAdSet of adSetsFromAPI) {
            const adsUrl = `https://graph.facebook.com/v22.0/${apiAdSet.id}/ads?fields=id&limit=1000&access_token=${integration.accessToken}`;
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
    const userCompanyId = (req as any).user?.companyId;
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.companyId !== userCompanyId) {
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

// Re-download images in high resolution for an integration (SSE with progress)
// Accepts query param: onlyMissing=true to only sync creatives without images
router.get('/:id/redownload-images-stream', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userCompanyId = (req as any).user?.companyId;
    const onlyMissing = req.query.onlyMissing === 'true';
    const integration = await storage.getIntegrationById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integração não encontrada' });
    }

    if (integration.companyId !== userCompanyId) {
      return res.status(403).json({ message: 'Sem permissão para acessar esta integração' });
    }

    if (!integration.accessToken) {
      return res.status(400).json({ message: 'Token de acesso não configurado' });
    }

    if (integration.platform !== 'meta') {
      return res.status(400).json({ message: 'Apenas integrações Meta suportam re-download de imagens' });
    }

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let deletedCount = 0;
    const allLogs: string[] = [];
    
    // Create sync history record for this media sync
    const userId = (req as any).user?.id || 'unknown';
    const syncRecord = await storage.createSyncHistory({
      integrationId: integration.id,
      companyId: userCompanyId,
      userId,
      status: 'running',
      type: 'media_sync',
      metadata: { onlyMissing }
    });
    
    const addLog = (msg: string) => {
      const timestamp = new Date().toISOString();
      allLogs.push(`[${timestamp}] ${msg}`);
    };
    
    addLog(`Starting media sync for integration ${integration.id} (onlyMissing=${onlyMissing})`);
    
    // Step 1: Delete images from Object Storage (only if syncing all)
    if (!onlyMissing) {
      sendEvent('progress', { step: 'delete', status: 'loading', message: 'Excluindo imagens do bucket...' });
      console.log(`🗑️  Deleting all images from Object Storage for integration ${integration.id}...`);
      deletedCount = await objectStorageService.deleteIntegrationFolder(userCompanyId, integration.id);
      console.log(`🗑️  Deleted ${deletedCount} images from Object Storage`);
      sendEvent('progress', { step: 'delete', status: 'success', message: `${deletedCount} imagens excluídas do bucket`, count: deletedCount });
    } else {
      sendEvent('progress', { step: 'delete', status: 'success', message: 'Pulando exclusão (modo apenas sem imagem)' });
    }

    // Step 2: Get creatives for this integration
    sendEvent('progress', { step: 'fetch', status: 'loading', message: 'Buscando criativos...' });
    let allCreatives = await storage.getCreativesByIntegration(integration.id);
    
    // Filter to only creatives without images if onlyMissing is true
    if (onlyMissing) {
      allCreatives = allCreatives.filter(c => 
        !c.imageUrl || c.imageUrl === '' || c.imageUrl === 'VIDEO_NO_THUMBNAIL'
      );
      console.log(`📋 Filtered to ${allCreatives.length} creatives without images`);
    }
    
    if (allCreatives.length === 0) {
      const message = onlyMissing 
        ? 'Todos os criativos já possuem imagem. Nenhuma sincronização necessária.'
        : `Excluídas ${deletedCount} imagens do bucket. Nenhum criativo encontrado para re-baixar.`;
      sendEvent('complete', { 
        message,
        deleted: deletedCount,
        updated: 0,
        failed: 0,
        noImage: 0
      });
      res.end();
      return;
    }

    const modeLabel = onlyMissing ? '(apenas sem imagem)' : '';
    sendEvent('progress', { step: 'fetch', status: 'success', message: `${allCreatives.length} criativos encontrados ${modeLabel}`, count: allCreatives.length });

    // Step 3: Clear imageUrl from creatives (only for the ones we're processing)
    if (!onlyMissing) {
      sendEvent('progress', { step: 'clear', status: 'loading', message: 'Limpando URLs antigas...' });
      for (const creative of allCreatives) {
        await storage.updateCreative(creative.id, { imageUrl: null });
      }
      sendEvent('progress', { step: 'clear', status: 'success', message: 'URLs limpas' });
    } else {
      sendEvent('progress', { step: 'clear', status: 'success', message: 'Pulando limpeza (modo apenas sem imagem)' });
    }

    // Step 4: Re-download all images with progress
    sendEvent('progress', { step: 'download', status: 'loading', message: 'Baixando imagens em alta resolução...', current: 0, total: allCreatives.length });
    
    let updated = 0;
    let failed = 0;
    let noImage = 0;

    for (let i = 0; i < allCreatives.length; i++) {
      const creative = allCreatives[i];
      
      sendEvent('progress', { 
        step: 'download', 
        status: 'loading', 
        message: `Baixando: ${creative.name}`, 
        current: i + 1, 
        total: allCreatives.length,
        creativeName: creative.name
      });

      try {
        // Use the single creative download method
        const result = await metaAdsService.redownloadImagesHighRes(
          integration,
          [{ id: creative.id, externalId: creative.externalId || '', name: creative.name, imageUrl: null }],
          userCompanyId
        );
        
        updated += result.updated;
        failed += result.failed;
        noImage += result.noImage;
        
        // Collect detailed logs from each creative
        if (result.detailedLog) {
          allLogs.push(result.detailedLog);
        }
      } catch (error: any) {
        const errorMsg = `❌ Error downloading image for ${creative.name}: ${error.message}`;
        console.error(errorMsg);
        addLog(errorMsg);
        failed++;
      }
    }

    sendEvent('progress', { 
      step: 'download', 
      status: 'success', 
      message: `Download concluído: ${updated} atualizadas`, 
      current: allCreatives.length, 
      total: allCreatives.length 
    });

    // Add final summary to logs
    addLog(`\n📊 FINAL SUMMARY: deleted=${deletedCount}, updated=${updated}, failed=${failed}, noImage=${noImage}, total=${allCreatives.length}`);
    
    // Save detailed logs to sync history
    const finalStatus = failed > 0 ? 'partial' : 'completed';
    await storage.updateSyncHistory(syncRecord.id, {
      status: finalStatus,
      completedAt: new Date(),
      creativeSynced: updated,
      detailedLog: allLogs.join('\n'),
      metadata: { 
        onlyMissing,
        deleted: deletedCount,
        updated,
        failed,
        noImage,
        total: allCreatives.length
      }
    });
    
    sendEvent('complete', {
      message: `Re-download concluído: ${deletedCount} excluídas do bucket, ${updated} atualizadas, ${failed} falhas, ${noImage} sem imagem disponível`,
      deleted: deletedCount,
      updated,
      failed,
      noImage,
      total: allCreatives.length,
      syncHistoryId: syncRecord.id
    });

    res.end();
  } catch (error: any) {
    console.error('❌ Error in redownload-images-stream:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
});

export default router;
