
import type { Integration, InsertCampaign, InsertCreative, InsertAdSet } from '../../shared/schema.js';
import { nanoid } from 'nanoid';
import { imageStorageService } from './ImageStorageService.js';

interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective: string;
  account_id?: string;
  created_time?: string;
  updated_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  targeting?: any;
  start_time?: string;
  end_time?: string;
}

interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  creative: {
    id: string;
    name: string;
    image_url?: string;
    thumbnail_url?: string;
    video_url?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
    effective_object_story_id?: string;
  };
  status: string;
  effective_status?: string;
}

interface MetaAdInsights {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

export interface SyncProgressCallback {
  (event: 'campaigns' | 'adsets' | 'ads', current: number, total: number, itemName?: string): void;
}

export class MetaAdsService {
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly apiVersion = 'v22.0'; // Meta Graph API version (January 2025)
  
  // PRODUCTION MODE: Faster delays since app is approved
  // Meta Graph API allows ~200 calls/user/hour in production mode
  private readonly requestDelay = 300; // 300ms delay between page requests
  private readonly campaignDelay = 500; // 500ms delay between campaigns
  private readonly adSetDelay = 300; // 300ms delay between ad sets
  private readonly maxRetries = 3; // Fewer retries needed in production
  private readonly batchDelay = 300; // 300ms delay between batch requests
  private progressCallback?: SyncProgressCallback;

  setProgressCallback(callback: SyncProgressCallback) {
    this.progressCallback = callback;
  }

  /**
   * Translate Meta API status to Portuguese delivery status (veiculação)
   * Uses effective_status which shows real delivery state considering campaign hierarchy
   */
  private translateMetaStatus(effectiveStatus: string): string {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'Ativo',
      'PAUSED': 'Não está em veiculação',
      'CAMPAIGN_PAUSED': 'Campanha Desativada',
      'ADSET_PAUSED': 'Grupo Desativado',
      'ARCHIVED': 'Arquivado',
      'DELETED': 'Excluído',
      'PENDING_REVIEW': 'Em revisão',
      'DISAPPROVED': 'Reprovado',
      'PREAPPROVED': 'Pré-aprovado',
      'PENDING_BILLING_INFO': 'Pendente informações de cobrança',
      'WITH_ISSUES': 'Com problemas',
    };
    
    const upperStatus = effectiveStatus?.toUpperCase();
    return statusMap[upperStatus] || effectiveStatus || 'Desconhecido';
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch image URL from asset_feed_spec hash via Meta API
   * Dynamic Creative ads store images as hashes, not URLs
   * We need to query /{ad_account_id}/adimages?hashes=[hash]&fields=url to get the actual URL
   */
  private async getImageUrlFromHash(accessToken: string, accountId: string, imageHash: string): Promise<string | null> {
    try {
      const encodedHashes = encodeURIComponent(JSON.stringify([imageHash]));
      const url = `${this.baseUrl}/${this.apiVersion}/${accountId}/adimages?hashes=${encodedHashes}&fields=hash,url&access_token=${accessToken}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`⚠️  Failed to fetch image hash ${imageHash}: ${response.status}`);
        return null;
      }
      
      const data = await response.json() as { data: Array<{ hash: string; url: string }> };
      if (data.data && data.data.length > 0) {
        return data.data[0].url;
      }
      return null;
    } catch (error) {
      console.warn(`⚠️  Error fetching image from hash ${imageHash}:`, error);
      return null;
    }
  }

  /**
   * Fetch asset_feed_spec for a creative to get image hashes (for Dynamic Creative ads)
   */
  private async getCreativeAssetFeedSpec(accessToken: string, creativeId: string): Promise<{ images?: Array<{ hash: string }> } | null> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${creativeId}?fields=asset_feed_spec&access_token=${accessToken}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json() as { asset_feed_spec?: { images?: Array<{ hash: string }> } };
      return data.asset_feed_spec || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Execute batch request to Meta API (up to 50 requests in one call)
   * This significantly reduces rate limiting issues
   */
  private async batchRequest<T = any>(
    accessToken: string,
    requests: Array<{ method: string; relative_url: string }>
  ): Promise<T[]> {
    if (requests.length === 0) {
      return [];
    }

    // PRODUCTION MODE: Use full 50 batch size (max allowed by Meta API)
    const BATCH_SIZE = 50;
    const results: T[] = [];

    // Split into chunks of 50
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Executing batch request ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(requests.length/BATCH_SIZE)} with ${batch.length} sub-requests`);

      try {
        const response = await fetch(
          `${this.baseUrl}/${this.apiVersion}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: accessToken,
              batch: batch,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Batch request failed: ${response.statusText}`);
        }

        const batchResults: any = await response.json();
        
        // Parse each result
        for (const result of batchResults) {
          if (result.code === 200) {
            const body = JSON.parse(result.body);
            results.push(body);
          } else {
            // Check if it's a rate limit error
            let isRateLimit = false;
            try {
              const errorBody = JSON.parse(result.body);
              if (errorBody.error && (errorBody.error.code === 17 || errorBody.error.code === 4 || errorBody.error.code === 80004)) {
                isRateLimit = true;
                console.warn(`⏱️  Rate limit detected in batch request (code ${errorBody.error.code}). This is normal with large ad accounts. The system will continue with available data.`);
              }
            } catch (e) {
              // Ignore parse errors
            }
            
            if (!isRateLimit) {
              console.warn(`⚠️  Sub-request failed with code ${result.code}:`, result.body);
            }
            results.push(null as any);
          }
        }

        // Longer delay between batch requests to avoid rate limits
        if (i + BATCH_SIZE < requests.length) {
          console.log(`⏸️  Waiting ${this.batchDelay/1000} seconds before next batch to avoid rate limits...`);
          await this.sleep(this.batchDelay);
        }
      } catch (error) {
        console.error('Batch request error:', error);
        throw error;
      }
    }

    console.log(`✅ Batch request completed: ${results.filter(r => r !== null).length}/${requests.length} successful`);
    return results.filter(r => r !== null);
  }

  /**
   * Fetch with retry logic for rate limits
   */
  private async fetchWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      const response = await fetch(url);
      const data: any = await response.json();

      // Check for rate limit error
      if (data.error) {
        const errorCode = data.error.code;
        const errorSubcode = data.error.error_subcode;
        
        // Rate limit errors: code 17, 4, 80004
        if ((errorCode === 17 || errorCode === 4 || errorCode === 80004) && retryCount < this.maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff: 5s, 10s, 20s, 40s, 80s
          console.log(`⏱️ Rate limit hit, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${this.maxRetries}...`);
          await this.sleep(waitTime);
          return this.fetchWithRetry(url, retryCount + 1);
        }

        // Other errors or max retries reached
        throw new Error(`Meta API error: ${data.error.message}`);
      }

      return data;
    } catch (error) {
      if (retryCount < this.maxRetries && error instanceof Error && error.message.includes('fetch')) {
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`⏱️ Network error, retrying in ${waitTime/1000}s...`);
        await this.sleep(waitTime);
        return this.fetchWithRetry(url, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Get ad accounts for the connected Meta user
   */
  async getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Meta API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Meta ad accounts:', error);
      throw error;
    }
  }

  /**
   * Get account name by ID
   */
  async getAccountName(accessToken: string, accountId: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${accountId}?fields=name&access_token=${accessToken}`
      );
      
      if (!response.ok) {
        return 'Unknown Account';
      }

      const data: any = await response.json();
      return data.name || 'Unknown Account';
    } catch (error) {
      console.error('Error fetching account name:', error);
      return 'Unknown Account';
    }
  }

  /**
   * Helper method to fetch all pages from Meta API with throttling and retry
   */
  private async fetchAllPages<T>(
    url: string, 
    progressCallback?: (current: number, message?: string) => void
  ): Promise<T[]> {
    const allData: T[] = [];
    let nextUrl: string | null = url;
    let pageCount = 0;

    console.log(`🔍 Starting pagination from URL: ${url.substring(0, 100)}...`);

    while (nextUrl) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}...`);
      
      // Use fetchWithRetry instead of direct fetch
      const data = await this.fetchWithRetry(nextUrl);
      const pageData = data.data || [];
      allData.push(...pageData);
      
      console.log(`  ✅ Page ${pageCount}: fetched ${pageData.length} items (total so far: ${allData.length})`);
      console.log(`  📋 Paging info:`, {
        hasNext: !!data.paging?.next,
        hasPrevious: !!data.paging?.previous,
        cursors: data.paging?.cursors
      });
      
      // Call progress callback if provided
      if (progressCallback) {
        progressCallback(allData.length, `Carregando anúncios da API: ${allData.length} encontrados (página ${pageCount})...`);
      }
      
      // Check if there's a next page
      nextUrl = data.paging?.next || null;
      
      if (nextUrl) {
        console.log(`  ➡️  Next page URL exists, waiting ${this.requestDelay}ms before next request...`);
        await this.sleep(this.requestDelay); // Throttle requests
      } else {
        console.log(`  🏁 No more pages, pagination complete`);
      }
    }

    console.log(`✅ Pagination finished: ${pageCount} pages, ${allData.length} total items`);
    return allData;
  }

  /**
   * Sync campaigns from Meta Ads (with pagination and optional incremental sync)
   * @param since - Only fetch campaigns updated after this timestamp (incremental sync)
   */
  async syncCampaigns(
    integration: Integration,
    userId: string,
    companyId: string | null,
    since?: Date
  ): Promise<InsertCampaign[]> {
    if (!integration.accessToken || !integration.accountId) {
      throw new Error('Missing access token or account ID');
    }

    try {
      // Get account name
      const accountName = await this.getAccountName(integration.accessToken, integration.accountId);
      
      // Build URL with optional filtering
      let url = `${this.baseUrl}/${this.apiVersion}/${integration.accountId}/campaigns?fields=id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget&limit=100&access_token=${integration.accessToken}`;
      
      // Add filtering for incremental sync
      if (since) {
        const sinceTimestamp = Math.floor(since.getTime() / 1000);
        url += `&filtering=[{"field":"updated_time","operator":"GREATER_THAN","value":${sinceTimestamp}}]`;
        console.log(`🔄 Fetching campaigns updated since ${since.toISOString()} (incremental sync)`);
      } else {
        console.log(`🚀 Fetching ALL campaigns (full sync)`);
      }
      
      const campaigns = await this.fetchAllPages<MetaCampaign>(url);
      
      console.log(`✅ Fetched ${campaigns.length} campaigns from Meta API`);

      return campaigns.map((campaign) => {
        // Use daily_budget or lifetime_budget (convert from cents to dollars)
        let budget = null;
        if (campaign.daily_budget) {
          budget = (parseFloat(campaign.daily_budget) / 100).toString();
        } else if (campaign.lifetime_budget) {
          budget = (parseFloat(campaign.lifetime_budget) / 100).toString();
        }
        
        // Use effective_status for accurate delivery status (veiculação)
        const status = this.translateMetaStatus(campaign.effective_status || campaign.status);
        
        return {
          companyId,
          userId,
          integrationId: integration.id,
          externalId: campaign.id,
          name: campaign.name,
          platform: 'meta',
          status,
          account: accountName,
          objective: campaign.objective,
          budget,
          apiCreatedAt: campaign.created_time ? new Date(campaign.created_time) : null,
        };
      });
    } catch (error) {
      console.error('Error syncing Meta campaigns:', error);
      throw error;
    }
  }

  /**
   * Sync ALL ad sets from the entire Meta Ad Account (RECOMMENDED METHOD)
   * This is more reliable than fetching per-campaign because:
   * - Captures all ad sets in one API call (faster, less rate limiting)
   * - Doesn't miss ad sets from paused/archived campaigns
   * - Returns 100% of ad sets regardless of campaign status
   */
  async syncAllAdSetsFromAccount(
    integration: Integration,
    userId: string,
    companyId: string | null,
    campaignMap: Map<string, string> // Map of externalCampaignId -> dbCampaignId
  ): Promise<InsertAdSet[]> {
    if (!integration.accessToken || !integration.accountId) {
      throw new Error('Missing access token or account ID');
    }

    try {
      console.log(`🎯 Fetching ALL ad sets from Meta account ${integration.accountId}...`);
      
      // Fetch ALL ad sets from the entire account in one call
      // CRITICAL: Keep fields minimal to avoid "too much data" error from Meta API
      // Removed: targeting (very large object), bid_strategy (not essential)
      const url = `${this.baseUrl}/${this.apiVersion}/${integration.accountId}/adsets?fields=id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,start_time,end_time&limit=100&access_token=${integration.accessToken}`;
      const adSets = await this.fetchAllPages<MetaAdSet>(url);
      
      console.log(`✅ Found ${adSets.length} total ad sets from Meta API`);

      // Fetch insights for all ad sets (includes spend, impressions, clicks)
      const adSetIds = adSets.map(as => as.id);
      const insightsMap = await this.getAdSetInsightsBatch(integration.accessToken!, adSetIds);

      // Map ad sets to database format and link to campaigns
      const insertAdSets: InsertAdSet[] = [];
      let skippedCount = 0;

      for (const adSet of adSets) {
        // Find the database campaign ID from the map
        const campaignId = campaignMap.get(adSet.campaign_id);
        
        if (!campaignId) {
          console.warn(`⚠️  Ad set ${adSet.id} (${adSet.name}) belongs to campaign ${adSet.campaign_id} which is not in our database - skipping`);
          skippedCount++;
          continue;
        }

        const insights = insightsMap.get(adSet.id) || {};
        
        insertAdSets.push({
          companyId,
          userId,
          campaignId,
          externalId: adSet.id,
          name: adSet.name,
          platform: 'meta',
          status: this.translateMetaStatus(adSet.effective_status || adSet.status),
          dailyBudget: adSet.daily_budget ? (parseFloat(adSet.daily_budget) / 100).toString() : null,
          lifetimeBudget: adSet.lifetime_budget ? (parseFloat(adSet.lifetime_budget) / 100).toString() : null,
          bidStrategy: null, // Not fetched to reduce API payload
          targeting: null, // Not fetched to reduce API payload (targeting is very large)
          startTime: adSet.start_time ? new Date(adSet.start_time) : null,
          endTime: adSet.end_time ? new Date(adSet.end_time) : null,
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          spend: insights.spend || '0',
        });
      }

      console.log(`✅ Mapped ${insertAdSets.length} ad sets to database format (skipped ${skippedCount} orphaned ad sets)`);
      return insertAdSets;
    } catch (error) {
      console.error('Error syncing ad sets from account:', error);
      throw error;
    }
  }

  /**
   * Sync ad sets for multiple campaigns using batch requests (OPTIMIZED)
   * @deprecated Use syncAllAdSetsFromAccount for better performance and reliability
   * This replaces calling syncAdSets() in a loop
   */
  async syncAllAdSetsBatch(
    integration: Integration,
    campaigns: Array<{ externalId: string; dbId: string }>,
    userId: string,
    companyId: string | null
  ): Promise<Map<string, InsertAdSet[]>> {
    if (!integration.accessToken) {
      throw new Error('Missing access token');
    }

    console.log(`📦 Fetching ad sets for ${campaigns.length} campaigns using batch requests...`);

    // Create batch requests for all campaigns
    const requests = campaigns.map(campaign => ({
      method: 'GET',
      relative_url: `${campaign.externalId}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,targeting,start_time,end_time&limit=100`
    }));

    try {
      const results = await this.batchRequest<any>(integration.accessToken, requests);
      const adSetsByCampaign = new Map<string, InsertAdSet[]>();
      
      // Collect all ad set IDs for batch insights fetch
      const allAdSetIds: string[] = [];
      const adSetMap = new Map<string, { campaign: any; adSet: MetaAdSet }>();
      
      results.forEach((result, index) => {
        const campaign = campaigns[index];
        const adSets = result?.data || [];
        
        adSets.forEach((adSet: MetaAdSet) => {
          allAdSetIds.push(adSet.id);
          adSetMap.set(adSet.id, { campaign, adSet });
        });
      });

      // Fetch insights for all ad sets in batch
      const insightsMap = await this.getAdSetInsightsBatch(integration.accessToken, allAdSetIds);

      // Build final ad sets with metrics
      adSetMap.forEach((data, adSetId) => {
        const { campaign, adSet } = data;
        const insights = insightsMap.get(adSetId) || {};
        
        const insertAdSet: InsertAdSet = {
          companyId,
          userId,
          campaignId: campaign.dbId,
          externalId: adSet.id,
          name: adSet.name,
          platform: 'meta',
          status: this.translateMetaStatus(adSet.effective_status || adSet.status),
          dailyBudget: adSet.daily_budget ? (parseFloat(adSet.daily_budget) / 100).toString() : null,
          lifetimeBudget: adSet.lifetime_budget ? (parseFloat(adSet.lifetime_budget) / 100).toString() : null,
          bidStrategy: adSet.bid_strategy || null,
          targeting: adSet.targeting || null,
          startTime: adSet.start_time ? new Date(adSet.start_time) : null,
          endTime: adSet.end_time ? new Date(adSet.end_time) : null,
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          spend: insights.spend || '0',
        };
        
        const existing = adSetsByCampaign.get(campaign.dbId) || [];
        existing.push(insertAdSet);
        adSetsByCampaign.set(campaign.dbId, existing);
      });

      console.log(`✅ Fetched ad sets with metrics for ${adSetsByCampaign.size} campaigns`);
      return adSetsByCampaign;
    } catch (error) {
      console.error('Error syncing ad sets in batch:', error);
      throw error;
    }
  }

  /**
   * Sync ad sets (Grupos de Anúncios) from a single campaign (with pagination)
   * @deprecated Use syncAllAdSetsBatch for better performance when syncing multiple campaigns
   */
  async syncAdSets(
    integration: Integration,
    campaignExternalId: string,
    campaignId: string,
    userId: string
  ): Promise<InsertAdSet[]> {
    if (!integration.accessToken) {
      throw new Error('Missing access token');
    }

    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${campaignExternalId}/adsets?fields=id,name,status,daily_budget,lifetime_budget,bid_strategy,targeting,start_time,end_time&limit=100&access_token=${integration.accessToken}`;
      const adSets = await this.fetchAllPages<MetaAdSet>(url);

      // Fetch insights for all ad sets
      const adSetIds = adSets.map(as => as.id);
      const insightsMap = await this.getAdSetInsightsBatch(integration.accessToken!, adSetIds);

      return adSets.map((adSet) => {
        const insights = insightsMap.get(adSet.id) || {};
        
        return {
          companyId: null,
          userId,
          campaignId,
          externalId: adSet.id,
          name: adSet.name,
          platform: 'meta',
          status: adSet.status.toLowerCase(),
          dailyBudget: adSet.daily_budget ? (parseFloat(adSet.daily_budget) / 100).toString() : null,
          lifetimeBudget: adSet.lifetime_budget ? (parseFloat(adSet.lifetime_budget) / 100).toString() : null,
          bidStrategy: adSet.bid_strategy || null,
          targeting: adSet.targeting || null,
          startTime: adSet.start_time ? new Date(adSet.start_time) : null,
          endTime: adSet.end_time ? new Date(adSet.end_time) : null,
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          spend: insights.spend || '0',
        };
      });
    } catch (error) {
      console.error('Error syncing Meta ad sets:', error);
      throw error;
    }
  }

  /**
   * Sync ALL ads (creatives) from the entire Meta Ad Account (RECOMMENDED METHOD)
   * This is more reliable than fetching per-ad-set because:
   * - Captures all ads in one API call (faster, less rate limiting)
   * - Doesn't miss ads from paused/archived ad sets
   * - Returns 100% of ads regardless of ad set status
   * 
   * @param existingCreativesMap - Map of externalId -> existing imageUrl to skip re-downloading images
   */
  async syncAllAdsFromAccount(
    integration: Integration,
    userId: string,
    companyId: string | null,
    integrationId: string,
    adSetMap: Map<string, { dbId: string; campaignId: string }>, // Map of externalAdSetId -> { dbAdSetId, dbCampaignId }
    progressCallback?: (current: number, message?: string) => void,
    existingCreativesMap?: Map<string, string | null> // Map of externalId -> existing imageUrl (to skip re-download)
  ): Promise<InsertCreative[]> {
    if (!integration.accessToken || !integration.accountId) {
      throw new Error('Missing access token or account ID');
    }

    try {
      console.log(`🎯 Fetching ALL ads from Meta account ${integration.accountId}...`);
      
      // Fetch ALL ads from the entire account in one call
      // CRITICAL: Keep fields minimal to avoid "too much data" error from Meta API
      // Note: thumbnail_url is used when image_url is not available (Dynamic Creative, carousel, etc.)
      // effective_object_story_id allows us to fetch thumbnails for DCO ads
      const url = `${this.baseUrl}/${this.apiVersion}/${integration.accountId}/ads?fields=id,name,status,effective_status,adset_id,creative{id,image_url,thumbnail_url,body,title,effective_object_story_id}&limit=100&access_token=${integration.accessToken}`;
      const ads = await this.fetchAllPages<MetaAd>(url, progressCallback);
      
      console.log(`✅ Found ${ads.length} total ads from Meta API`);

      // Get insights for ALL ads in ONE batch request
      const adIds = ads.map(ad => ad.id);
      const insightsMap = await this.getAdInsightsBatch(integration.accessToken!, adIds);

      // Download images and map insights
      const insertCreatives: InsertCreative[] = [];
      let skippedCount = 0;

      for (const ad of ads) {
        // Find the database ad set ID and campaign ID from the map
        const adSetInfo = adSetMap.get(ad.adset_id);
        
        if (!adSetInfo) {
          console.warn(`⚠️  Ad ${ad.id} (${ad.name}) belongs to ad set ${ad.adset_id} which is not in our database - skipping`);
          skippedCount++;
          continue;
        }

        const insights = insightsMap.get(ad.id) || {};
        
        // Check if creative already exists with a valid image (skip re-download)
        const existingImageUrl = existingCreativesMap?.get(ad.id);
        let imageUrl: string | null = null;
        
        if (existingImageUrl && existingImageUrl.startsWith('/objects/')) {
          // Creative already has a valid Object Storage image - skip download
          imageUrl = existingImageUrl;
          console.log(`⏭️  Skipping image download for ad ${ad.id} (already exists: ${existingImageUrl})`);
        } else {
          // Try image_url first, fallback to thumbnail_url (for Dynamic Creative, carousel, etc.)
          let sourceImageUrl = ad.creative?.image_url || ad.creative?.thumbnail_url;
          
          // If no direct image, try to get thumbnail from effective_object_story_id (for DCO ads)
          if (!sourceImageUrl && ad.creative?.effective_object_story_id && ad.creative?.id) {
            console.log(`🔍 Ad ${ad.id} has no direct image, trying to fetch from creative ${ad.creative.id}...`);
            try {
              const creativeUrl = `${this.baseUrl}/${this.apiVersion}/${ad.creative.id}?fields=thumbnail_url,image_url&access_token=${integration.accessToken}`;
              const creativeResponse = await fetch(creativeUrl);
              if (creativeResponse.ok) {
                const creativeData = await creativeResponse.json() as { image_url?: string; thumbnail_url?: string };
                sourceImageUrl = creativeData.image_url || creativeData.thumbnail_url;
                if (sourceImageUrl) {
                  console.log(`✅ Found image from creative endpoint: ${sourceImageUrl.substring(0, 50)}...`);
                }
              }
            } catch (e) {
              console.warn(`⚠️  Failed to fetch creative ${ad.creative.id}:`, e);
            }
          }
          
          // If still no image, try asset_feed_spec for Dynamic Creative ads (images stored as hashes)
          if (!sourceImageUrl && ad.creative?.id && integration.accessToken && integration.accountId) {
            console.log(`🔍 Ad ${ad.id} still has no image, checking asset_feed_spec for Dynamic Creative...`);
            try {
              const assetFeedSpec = await this.getCreativeAssetFeedSpec(integration.accessToken, ad.creative.id);
              if (assetFeedSpec?.images && assetFeedSpec.images.length > 0) {
                const firstImageHash = assetFeedSpec.images[0].hash;
                console.log(`🔑 Found image hash in asset_feed_spec: ${firstImageHash}`);
                const imageUrlFromHash = await this.getImageUrlFromHash(integration.accessToken, integration.accountId, firstImageHash);
                if (imageUrlFromHash) {
                  sourceImageUrl = imageUrlFromHash;
                  console.log(`✅ Found image URL from hash: ${imageUrlFromHash.substring(0, 60)}...`);
                }
              }
            } catch (e) {
              console.warn(`⚠️  Failed to fetch asset_feed_spec for creative ${ad.creative.id}:`, e);
            }
          }
          
          if (sourceImageUrl && companyId && integrationId) {
            // Download and save new image to Object Storage
            console.log(`🖼️  Downloading image for ad ${ad.id} from ${ad.creative?.image_url ? 'image_url' : 'thumbnail_url/creative'}...`);
            const objectUrl = await imageStorageService.downloadAndSaveImage(sourceImageUrl, companyId, integrationId, adSetInfo.dbId);
            if (objectUrl) {
              imageUrl = objectUrl;
              console.log(`✅ Image saved to Object Storage: ${objectUrl}`);
            }
          }
        }
        
        insertCreatives.push({
          companyId,
          userId,
          campaignId: adSetInfo.campaignId,
          adSetId: adSetInfo.dbId,
          externalId: ad.id,
          name: ad.name,
          platform: 'meta',
          type: 'image',
          imageUrl,
          videoUrl: null,
          text: ad.creative?.body || null,
          headline: ad.creative?.title || null,
          description: null,
          callToAction: ad.creative?.call_to_action_type || null,
          status: this.translateMetaStatus(ad.effective_status || ad.status),
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          conversions: this.getConversions(insights),
          ctr: insights.ctr || '0',
          cpc: insights.cpc || '0',
        });
      }

      console.log(`✅ Mapped ${insertCreatives.length} ads to database format (skipped ${skippedCount} orphaned ads)`);
      return insertCreatives;
    } catch (error) {
      console.error('Error syncing ads from account:', error);
      throw error;
    }
  }

  /**
   * Sync creatives (ads) from an Ad Set (with pagination)
   * @deprecated Use syncAllAdsFromAccount for better performance and reliability
   */
  async syncCreatives(
    integration: Integration,
    adSetExternalId: string,
    adSetId: string,
    campaignId: string,
    userId: string,
    companyId: string | null = null,
    integrationId: string | null = null
  ): Promise<InsertCreative[]> {
    if (!integration.accessToken) {
      throw new Error('Missing access token');
    }

    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${adSetExternalId}/ads?fields=id,name,status,creative{id,name,image_url,thumbnail_url,body,title,call_to_action_type}&limit=100&access_token=${integration.accessToken}`;
      const ads = await this.fetchAllPages<MetaAd>(url);

      // Get insights for ALL ads in ONE batch request instead of individual calls
      const adIds = ads.map(ad => ad.id);
      const insightsMap = await this.getAdInsightsBatch(integration.accessToken!, adIds);

      // Download images and map insights
      const creativesWithMetrics = await Promise.all(
        ads.map(async (ad) => {
          const insights = insightsMap.get(ad.id) || {};
          
          // Download and save image to Object Storage
          // Try image_url first, fallback to thumbnail_url (for Dynamic Creative, carousel, etc.)
          let imageUrl = ad.creative?.image_url || ad.creative?.thumbnail_url || null;
          if (imageUrl && companyId && integrationId) {
            console.log(`🖼️  Downloading image for ad ${ad.id} from ${ad.creative?.image_url ? 'image_url' : 'thumbnail_url'}...`);
            const objectUrl = await imageStorageService.downloadAndSaveImage(imageUrl, companyId, integrationId, adSetId);
            if (objectUrl) {
              imageUrl = objectUrl;
              console.log(`✅ Image saved to Object Storage: ${objectUrl}`);
            }
          }
          
          return {
            companyId,
            userId,
            campaignId,
            adSetId,
            externalId: ad.id,
            name: ad.name,
            platform: 'meta',
            type: 'image', // Default to image, video support can be added later
            imageUrl,
            videoUrl: null,
            text: ad.creative?.body || null,
            headline: ad.creative?.title || null,
            description: null,
            callToAction: ad.creative?.call_to_action_type || null,
            status: ad.status.toLowerCase(),
            impressions: parseInt(insights.impressions || '0'),
            clicks: parseInt(insights.clicks || '0'),
            conversions: this.getConversions(insights),
            ctr: insights.ctr || '0',
            cpc: insights.cpc || '0',
          };
        })
      );

      return creativesWithMetrics;
    } catch (error) {
      console.error('Error syncing Meta creatives:', error);
      throw error;
    }
  }

  /**
   * Get ad set insights (metrics) for multiple ad sets using batch request
   */
  private async getAdSetInsightsBatch(
    accessToken: string,
    adSetIds: string[]
  ): Promise<Map<string, MetaAdInsights>> {
    if (adSetIds.length === 0) {
      return new Map();
    }

    console.log(`📊 Fetching insights for ${adSetIds.length} ad sets using batch requests...`);

    // Create batch requests for all ad sets with date range
    const requests = adSetIds.map(adSetId => ({
      method: 'GET',
      relative_url: `${adSetId}/insights?fields=impressions,clicks,spend&date_preset=maximum`
    }));

    try {
      const results = await this.batchRequest<any>(accessToken, requests);
      const insightsMap = new Map<string, MetaAdInsights>();

      // Map results back to ad set IDs
      results.forEach((result, index) => {
        const adSetId = adSetIds[index];
        if (result && result.data && result.data.length > 0) {
          insightsMap.set(adSetId, result.data[0]);
        } else {
          insightsMap.set(adSetId, {});
        }
      });

      console.log(`✅ Successfully fetched insights for ${insightsMap.size}/${adSetIds.length} ad sets`);
      return insightsMap;
    } catch (error) {
      console.error('Error fetching batch ad set insights:', error);
      return new Map();
    }
  }

  /**
   * Get ad insights (metrics) for multiple ads using batch request
   * This is MUCH more efficient than calling getAdInsights for each ad
   */
  private async getAdInsightsBatch(
    accessToken: string,
    adIds: string[]
  ): Promise<Map<string, MetaAdInsights>> {
    if (adIds.length === 0) {
      return new Map();
    }

    console.log(`📊 Fetching insights for ${adIds.length} ads using batch requests...`);

    // Create batch requests for all ads with date range
    const requests = adIds.map(adId => ({
      method: 'GET',
      relative_url: `${adId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&date_preset=maximum`
    }));

    try {
      const results = await this.batchRequest<any>(accessToken, requests);
      const insightsMap = new Map<string, MetaAdInsights>();

      // Map results back to ad IDs
      results.forEach((result, index) => {
        const adId = adIds[index];
        if (result && result.data && result.data.length > 0) {
          insightsMap.set(adId, result.data[0]);
        } else {
          insightsMap.set(adId, {});
        }
      });

      console.log(`✅ Successfully fetched insights for ${insightsMap.size}/${adIds.length} ads`);
      return insightsMap;
    } catch (error) {
      console.error('Error fetching batch ad insights:', error);
      return new Map();
    }
  }

  /**
   * Get ad insights (metrics) - legacy method for single ad
   * @deprecated Use getAdInsightsBatch for better performance
   */
  private async getAdInsights(
    accessToken: string,
    adId: string
  ): Promise<MetaAdInsights> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${adId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&date_preset=maximum&access_token=${accessToken}`
      );

      if (!response.ok) {
        console.log(`⚠️  Failed to get insights for ad ${adId}: ${response.statusText}`);
        return {};
      }

      const data: any = await response.json();
      const insights = data.data?.[0] || {};
      
      return insights;
    } catch (error) {
      console.error('Error fetching ad insights:', error);
      return {};
    }
  }

  /**
   * Extract conversions from insights
   */
  private getConversions(insights: MetaAdInsights): number {
    if (!insights.actions) return 0;
    
    const conversionAction = insights.actions.find(
      (action) => action.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    
    return conversionAction ? parseInt(conversionAction.value) : 0;
  }

  /**
   * Validate Meta access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/me?access_token=${accessToken}`
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh Meta access token (Meta tokens are long-lived, typically 60 days)
   */
  async refreshToken(
    accessToken: string,
    appId: string,
    appSecret: string
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
      );

      if (!response.ok) {
        throw new Error('Failed to refresh Meta token');
      }

      const data: any = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing Meta token:', error);
      throw error;
    }
  }
}
