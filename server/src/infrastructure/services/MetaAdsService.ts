
import type { Integration, InsertCampaign, InsertCreative } from '../../shared/schema.js';
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
  objective: string;
}

interface MetaAd {
  id: string;
  name: string;
  creative: {
    id: string;
    name: string;
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
  ctr?: string;
  cpc?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

export class MetaAdsService {
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = 'https://graph.facebook.com';

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
   * Sync campaigns from Meta Ads
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
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${integration.accountId}/campaigns?fields=id,name,status,objective&access_token=${integration.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Meta API error: ${response.statusText}`);
      }

      const data = await response.json();
      const campaigns: MetaCampaign[] = data.data || [];

      return campaigns.map((campaign) => ({
        id: nanoid(),
        companyId,
        userId,
        integrationId: integration.id,
        externalId: campaign.id,
        name: campaign.name,
        platform: 'meta',
        status: campaign.status.toLowerCase(),
        budget: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('Error syncing Meta campaigns:', error);
      throw error;
    }
  }

  /**
   * Sync creatives (ads) from Meta Ads
   */
  async syncCreatives(
    integration: Integration,
    campaignExternalId: string,
    campaignId: string,
    userId: string
  ): Promise<InsertCreative[]> {
    if (!integration.accessToken) {
      throw new Error('Missing access token');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${campaignExternalId}/ads?fields=id,name,creative{id,name,image_url,video_url,title,body,call_to_action_type},status&access_token=${integration.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Meta API error: ${response.statusText}`);
      }

      const data = await response.json();
      const ads: MetaAd[] = data.data || [];

      // Get insights for each ad and download images
      const creativesWithMetrics = await Promise.all(
        ads.map(async (ad) => {
          const insights = await this.getAdInsights(integration.accessToken!, ad.id);
          
          // Download and store image permanently if it exists
          let permanentImageUrl: string | null = null;
          if (ad.creative.image_url) {
            console.log(`🖼️  Downloading image for Meta ad ${ad.id}...`);
            permanentImageUrl = await imageStorageService.downloadAndSaveImage(ad.creative.image_url);
          }
          
          return {
            id: nanoid(),
            userId,
            campaignId,
            externalId: ad.id,
            name: ad.name,
            type: ad.creative.video_url ? 'video' : 'image',
            imageUrl: permanentImageUrl || ad.creative.image_url || null,
            videoUrl: ad.creative.video_url || null,
            text: ad.creative.body || null,
            headline: ad.creative.title || null,
            description: null,
            callToAction: ad.creative.call_to_action_type || null,
            status: ad.status.toLowerCase(),
            impressions: parseInt(insights.impressions || '0'),
            clicks: parseInt(insights.clicks || '0'),
            conversions: this.getConversions(insights),
            ctr: insights.ctr || '0',
            cpc: insights.cpc || '0',
            createdAt: new Date(),
            updatedAt: new Date(),
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
   * Get ad insights (metrics)
   */
  private async getAdInsights(
    accessToken: string,
    adId: string
  ): Promise<MetaAdInsights> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${adId}/insights?fields=impressions,clicks,ctr,cpc,actions&access_token=${accessToken}`
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      return data.data?.[0] || {};
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
