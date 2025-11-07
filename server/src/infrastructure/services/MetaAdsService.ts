
import type { Integration, InsertCampaign, InsertCreative, InsertAdSet } from '../../shared/schema.js';
import { nanoid } from 'nanoid';

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
    image_hash?: string;
    image_url?: string;
    video_url?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
  };
  status: string;
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
  private readonly apiVersion = 'v21.0';
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly requestDelay = 2000; // 2s delay between page requests
  private readonly campaignDelay = 8000; // 8s delay between campaigns
  private readonly adSetDelay = 5000; // 5s delay between ad sets
  private readonly maxRetries = 5; // More retries with longer waits
  private progressCallback?: SyncProgressCallback;

  setProgressCallback(callback: SyncProgressCallback) {
    this.progressCallback = callback;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
          const waitTime = Math.pow(2, retryCount) * 3000; // Exponential backoff: 3s, 6s, 12s, 24s, 48s
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

      const data = await response.json();
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

      const data = await response.json();
      return data.name || 'Unknown Account';
    } catch (error) {
      console.error('Error fetching account name:', error);
      return 'Unknown Account';
    }
  }

  /**
   * Helper method to fetch all pages from Meta API with throttling and retry
   */
  private async fetchAllPages<T>(url: string): Promise<T[]> {
    const allData: T[] = [];
    let nextUrl: string | null = url;
    let pageCount = 0;

    console.log(`🔍 Starting pagination from URL: ${url.substring(0, 100)}...`);

    while (nextUrl) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}...`);
      
      // Use fetchWithRetry instead of direct fetch
      const data: any = await this.fetchWithRetry(nextUrl);
      const pageData = data.data || [];
      allData.push(...pageData);
      
      console.log(`  ✅ Page ${pageCount}: fetched ${pageData.length} items (total so far: ${allData.length})`);
      console.log(`  📋 Paging info:`, {
        hasNext: !!data.paging?.next,
        hasPrevious: !!data.paging?.previous,
        cursors: data.paging?.cursors
      });
      
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
   * Sync campaigns from Meta Ads (with pagination)
   */
  async syncCampaigns(
    integration: Integration,
    userId: string,
    companyId: string | null
  ): Promise<InsertCampaign[]> {
    if (!integration.accessToken || !integration.accountId) {
      throw new Error('Missing access token or account ID');
    }

    try {
      // Get account name
      const accountName = await this.getAccountName(integration.accessToken, integration.accountId);
      
      const url = `${this.baseUrl}/${this.apiVersion}/${integration.accountId}/campaigns?fields=id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget&limit=100&access_token=${integration.accessToken}`;
      
      console.log(`🚀 Fetching campaigns from account: ${integration.accountId}`);
      const campaigns = await this.fetchAllPages<MetaCampaign>(url);
      
      console.log(`✅ Fetched ${campaigns.length} campaigns total from Meta API`);

      return campaigns.map((campaign) => ({
        companyId,
        userId,
        integrationId: integration.id,
        externalId: campaign.id,
        name: campaign.name,
        platform: 'meta',
        status: campaign.status.toLowerCase(),
        account: accountName,
        objective: campaign.objective,
        budget: null,
      }));
    } catch (error) {
      console.error('Error syncing Meta campaigns:', error);
      throw error;
    }
  }

  /**
   * Sync ad sets (Grupos de Anúncios) from a campaign (with pagination)
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

      return adSets.map((adSet) => ({
        userId,
        campaignId,
        externalId: adSet.id,
        name: adSet.name,
        status: adSet.status.toLowerCase(),
        dailyBudget: adSet.daily_budget ? (parseFloat(adSet.daily_budget) / 100).toString() : null,
        lifetimeBudget: adSet.lifetime_budget ? (parseFloat(adSet.lifetime_budget) / 100).toString() : null,
        bidStrategy: adSet.bid_strategy || null,
        targeting: adSet.targeting || null,
        startTime: adSet.start_time ? new Date(adSet.start_time) : null,
        endTime: adSet.end_time ? new Date(adSet.end_time) : null,
      }));
    } catch (error) {
      console.error('Error syncing Meta ad sets:', error);
      throw error;
    }
  }

  /**
   * Sync creatives (ads) from an Ad Set (with pagination)
   */
  async syncCreatives(
    integration: Integration,
    adSetExternalId: string,
    adSetId: string,
    campaignId: string,
    userId: string
  ): Promise<InsertCreative[]> {
    if (!integration.accessToken) {
      throw new Error('Missing access token');
    }

    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${adSetExternalId}/ads?fields=id,name,status,creative{id,name,image_hash,image_url,body,title,call_to_action_type}&limit=100&access_token=${integration.accessToken}`;
      const ads = await this.fetchAllPages<MetaAd>(url);

      // Get insights for each ad and permanent image URLs
      const creativesWithMetrics = await Promise.all(
        ads.map(async (ad) => {
          const insights = await this.getAdInsights(integration.accessToken!, ad.id);
          
          // Get permanent image URL from image_hash
          let imageUrl = ad.creative?.image_url || null;
          if (ad.creative?.image_hash && integration.accountId) {
            try {
              const permanentUrl = await this.getImagePermalinkFromHash(
                integration.accessToken!,
                integration.accountId,
                ad.creative.image_hash
              );
              if (permanentUrl) {
                imageUrl = permanentUrl;
                console.log(`🖼️  Got permanent URL for ad ${ad.id}`);
              }
            } catch (error) {
              console.log(`⚠️  Could not get permanent URL for hash ${ad.creative.image_hash}, using temporary URL`);
            }
          }
          
          return {
            userId,
            campaignId,
            adSetId,
            externalId: ad.id,
            name: ad.name,
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
   * Get permanent image URL from image hash
   */
  private async getImagePermalinkFromHash(
    accessToken: string,
    accountId: string,
    imageHash: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/act_${accountId}/adimages?fields=permalink_url&hashes=["${imageHash}"]&access_token=${accessToken}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data?.[0]?.permalink_url || null;
    } catch (error) {
      console.error(`Error getting permalink for hash ${imageHash}:`, error);
      return null;
    }
  }

  /**
   * Get ad insights (metrics)
   */
  private async getAdInsights(
    accessToken: string,
    adId: string
  ): Promise<MetaAdInsights> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${adId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&access_token=${accessToken}`
      );

      if (!response.ok) {
        console.log(`⚠️  Failed to get insights for ad ${adId}: ${response.statusText}`);
        return {};
      }

      const data = await response.json();
      const insights = data.data?.[0] || {};
      
      console.log(`📊 Ad ${adId} insights:`, {
        impressions: insights.impressions || '0',
        clicks: insights.clicks || '0',
        spend: insights.spend || '0',
        ctr: insights.ctr || '0',
        cpc: insights.cpc || '0',
        actions: insights.actions?.length || 0
      });
      
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

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing Meta token:', error);
      throw error;
    }
  }
}
