
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface AdAccountsResponse {
  data?: Array<{
    id: string;
    name: string;
    account_status: number;
  }>;
  error?: string;
}

// Initiate Meta OAuth flow
router.get('/connect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    // Get platform settings
    const settings = await storage.getPlatformSettingsByPlatform('meta');
    
    if (!settings || !settings.isConfigured) {
      return res.status(400).json({
        error: 'Meta app not configured',
        message: 'Por favor, configure o aplicativo Meta nas Configurações Globais primeiro.'
      });
    }

    // Build OAuth URL
    const redirectUri = settings.redirectUri || `${process.env.REPL_URL || 'http://localhost:5000'}/auth/meta/callback`;
    const scope = 'ads_management,ads_read,business_management';
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${settings.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;

    // Return the URL to frontend
    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

// Handle Meta OAuth callback
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      return res.redirect(`/?error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect('/?error=missing_code_or_state');
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { userId } = stateData;

    // Get platform settings
    const settings = await storage.getPlatformSettingsByPlatform('meta');
    
    if (!settings) {
      return res.redirect('/?error=meta_app_not_configured');
    }

    const redirectUri = settings.redirectUri || `${process.env.REPL_URL || 'http://localhost:5000'}/auth/meta/callback`;

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${settings.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${settings.appSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json() as TokenResponse;

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect('/?error=token_exchange_failed');
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${settings.appId}&client_secret=${settings.appSecret}&fb_exchange_token=${shortLivedToken}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json() as TokenResponse;

    const accessToken = longLivedData.access_token || shortLivedToken;

    // Get ad accounts for this user
    const adAccountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_status`;
    const adAccountsResponse = await fetch(adAccountsUrl);
    const adAccountsData = await adAccountsResponse.json() as AdAccountsResponse;

    if (!adAccountsData.data || adAccountsData.data.length === 0) {
      return res.redirect('/?error=no_ad_accounts');
    }

    // Store accounts in session/temp storage for selection
    // For now, auto-select the first account
    const firstAccount = adAccountsData.data[0];

    // Create or update integration
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const metaIntegration = existingIntegrations.find(i => i.platform === 'meta');

    if (metaIntegration) {
      await storage.updateIntegration(metaIntegration.id, {
        accessToken,
        accountId: firstAccount.id,
        status: 'active',
      });
    } else {
      await storage.createIntegration({
        userId,
        platform: 'meta',
        accessToken,
        accountId: firstAccount.id,
        status: 'active',
      });
    }

    // Redirect to integrations page with success message
    res.redirect('/?tab=integrations&success=meta_connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=oauth_callback_failed');
  }
});

export default router;
