
import type { Integration, InsertCampaign, InsertCreative } from '../../shared/schema.js';
import { nanoid } from 'nanoid';
import { imageStorageService } from './ImageStorageService.js';

interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
}

interface GoogleAdsAd {
  id: string;
  name: string;
  type: string;
  finalUrls: string[];
  responsiveSearchAd?: {
    headlines: Array<{ text: string }>;
    descriptions: Array<{ text: string }>;
  };
  imageAd?: {
    imageUrl: string;
    name: string;
  };
  videoAd?: {
    video: {
      youtubeVideoId: string;
    };
  };
  status: string;
}

interface GoogleAdsMetrics {
  impressions: string;
  clicks: string;
  ctr: string;
  averageCpc: string;
  conversions: string;
}

export class GoogleAdsService {
  private readonly apiVersion = 'v15';
  private readonly baseUrl = 'https://googleads.googleapis.com';

  /**
   * Get customer accounts for the connected Google Ads user
   */
  async getCustomerAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/customers:listAccessibleCustomers`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Google Ads API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.resourceNames || [];
    } catch (error) {
      console.error('Error fetching Google Ads accounts:', error);
      throw error;
    }
  }

  /**
   * Sync campaigns from Google Ads
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
      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
      `;

      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/customers/${integration.accountId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Ads API error: ${response.statusText}`);
      }

      const data = await response.json();
      const campaigns = data.results || [];

      return campaigns.map((result: any) => ({
        id: nanoid(),
        companyId,
        userId,
        integrationId: integration.id,
        externalId: result.campaign.id,
        name: result.campaign.name,
        platform: 'google',
        status: this.mapGoogleStatus(result.campaign.status),
        budget: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('Error syncing Google Ads campaigns:', error);
      throw error;
    }
  }

  /**
   * Sync creatives (ads) from Google Ads
   */
  async syncCreatives(
    integration: Integration,
    campaignExternalId: string,
    campaignId: string,
    userId: string
  ): Promise<InsertCreative[]> {
    if (!integration.accessToken || !integration.accountId) {
      throw new Error('Missing access token or account ID');
    }

    try {
      const query = `
        SELECT 
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.ad.type,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.ad.image_ad.image_url,
          ad_group_ad.ad.video_ad.video.youtube_video_id,
          ad_group_ad.status,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions
        FROM ad_group_ad
        WHERE campaign.id = ${campaignExternalId}
          AND ad_group_ad.status != 'REMOVED'
      `;

      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/customers/${integration.accountId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Ads API error: ${response.statusText}`);
      }

      const data = await response.json();
      const ads = data.results || [];

      // Process ads and download images
      return await Promise.all(ads.map(async (result: any) => {
        const ad = result.adGroupAd.ad;
        const metrics = result.metrics || {};

        // Determine ad type and extract content
        let type = 'text';
        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        let headline: string | null = null;
        let text: string | null = null;

        if (ad.responsiveSearchAd) {
          type = 'text';
          headline = ad.responsiveSearchAd.headlines?.[0]?.text || null;
          text = ad.responsiveSearchAd.descriptions?.[0]?.text || null;
        } else if (ad.imageAd) {
          type = 'image';
          imageUrl = ad.imageAd.imageUrl || null;
          
          // Download and store image permanently if it exists
          if (imageUrl) {
            console.log(`🖼️  Downloading image for Google ad ${ad.id}...`);
            const permanentUrl = await imageStorageService.downloadAndSaveImage(imageUrl);
            imageUrl = permanentUrl || imageUrl;
          }
        } else if (ad.videoAd) {
          type = 'video';
          videoUrl = `https://www.youtube.com/watch?v=${ad.videoAd.video.youtubeVideoId}`;
        }

        return {
          id: nanoid(),
          userId,
          campaignId,
          externalId: ad.id,
          name: ad.name || `Ad ${ad.id}`,
          type,
          imageUrl,
          videoUrl,
          text,
          headline,
          description: null,
          callToAction: null,
          status: this.mapGoogleStatus(result.adGroupAd.status),
          impressions: parseInt(metrics.impressions || '0'),
          clicks: parseInt(metrics.clicks || '0'),
          conversions: parseInt(metrics.conversions || '0'),
          ctr: metrics.ctr || '0',
          cpc: this.formatMicros(metrics.averageCpc),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }));
    } catch (error) {
      console.error('Error syncing Google Ads creatives:', error);
      throw error;
    }
  }

  /**
   * Map Google Ads status to internal status
   */
  private mapGoogleStatus(googleStatus: string): string {
    const statusMap: Record<string, string> = {
      'ENABLED': 'active',
      'PAUSED': 'paused',
      'REMOVED': 'archived',
      'UNKNOWN': 'unknown',
    };
    return statusMap[googleStatus] || 'unknown';
  }

  /**
   * Format micros (Google Ads uses micros for currency)
   */
  private formatMicros(micros: string | number): string {
    const value = typeof micros === 'string' ? parseFloat(micros) : micros;
    return (value / 1000000).toFixed(2);
  }

  /**
   * Validate Google Ads access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + accessToken
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh Google OAuth token
   */
  async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh Google token');
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      throw error;
    }
  }
}
