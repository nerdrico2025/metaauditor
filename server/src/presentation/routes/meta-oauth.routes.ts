
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

    // Build OAuth URL with ALL necessary scopes for Business Manager
    const redirectUri = settings.redirectUri || `${process.env.REPL_URL || 'http://localhost:5000'}/auth/meta/callback`;
    const scope = 'ads_management,ads_read,business_management,read_insights';
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    // Add config_id parameter to ensure we're requesting business assets
    const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${settings.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&auth_type=rerequest`;

    console.log('🔗 Meta OAuth URL generated with scopes:', scope);
    
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

    // Helper function to send result and close popup
    const sendResultAndClose = (success: boolean, message: string) => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Callback</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: '${success ? 'META_OAUTH_SUCCESS' : 'META_OAUTH_ERROR'}',
                  message: '${message}'
                }, '*');
                setTimeout(() => window.close(), 500);
              } else {
                window.location.href = '/?${success ? 'success' : 'error'}=${message}';
              }
            </script>
            <p style="text-align: center; font-family: sans-serif; margin-top: 50px;">
              ${success ? '✅ Conectado com sucesso!' : '❌ Erro na conexão'}
              <br><br>
              Esta janela será fechada automaticamente...
            </p>
          </body>
        </html>
      `;
      return res.send(html);
    };

    // Check for OAuth errors
    if (oauthError) {
      return sendResultAndClose(false, `OAuth error: ${oauthError}`);
    }

    if (!code || !state) {
      return sendResultAndClose(false, 'Código ou state ausente');
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { userId } = stateData;

    // Get platform settings
    const settings = await storage.getPlatformSettingsByPlatform('meta');
    
    if (!settings) {
      return sendResultAndClose(false, 'App Meta não configurado');
    }

    const redirectUri = settings.redirectUri || `${process.env.REPL_URL || 'http://localhost:5000'}/auth/meta/callback`;

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${settings.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${settings.appSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json() as TokenResponse;

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return sendResultAndClose(false, 'Falha ao trocar código por token');
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${settings.appId}&client_secret=${settings.appSecret}&fb_exchange_token=${shortLivedToken}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json() as TokenResponse;

    const accessToken = longLivedData.access_token || shortLivedToken;

    // Step 1: Get ONLY the Business Managers that were AUTHORIZED during OAuth
    const businessesUrl = `https://graph.facebook.com/v22.0/me/businesses?access_token=${accessToken}&fields=id,name,verification_status&limit=100`;
    const businessesResponse = await fetch(businessesUrl);
    const businessesData = await businessesResponse.json() as { data?: Array<{ id: string; name: string }> };

    console.log('🔐 Business Managers AUTHORIZED in OAuth:', businessesData.data?.length || 0);
    console.log('📋 Authorized Businesses:', businessesData.data?.map((b: any) => ({ id: b.id, name: b.name })));

    let allAdAccounts: any[] = [];
    
    if (businessesData.data && businessesData.data.length > 0) {
      // Step 2: Get ad accounts ONLY from AUTHORIZED Business Managers
      for (const business of businessesData.data) {
        console.log(`🔍 Fetching ad accounts from authorized BM: ${business.name} (${business.id})`);
        const bmAdAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/owned_ad_accounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const bmAdAccountsResponse = await fetch(bmAdAccountsUrl);
        const bmAdAccountsData = await bmAdAccountsResponse.json() as { data?: any[] };
        
        if (bmAdAccountsData.data && bmAdAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${bmAdAccountsData.data.length} ad accounts in authorized BM "${business.name}"`);
          // Tag each account with the BM name for display
          const accountsWithBM = bmAdAccountsData.data.map(acc => ({
            ...acc,
            business_name: business.name,
            business_id: business.id
          }));
          allAdAccounts.push(...accountsWithBM);
        } else {
          console.log(`  ⚠️ No ad accounts in BM "${business.name}"`);
        }
      }
    } else {
      // Fallback: if no Business Manager was authorized, try personal ad accounts
      console.log('⚠️ No Business Manager authorized, trying personal ad accounts...');
      const personalAccountsUrl = `https://graph.facebook.com/v22.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
      const personalAccountsResponse = await fetch(personalAccountsUrl);
      const personalAccountsData = await personalAccountsResponse.json() as AdAccountsResponse;
      
      if (personalAccountsData.data && personalAccountsData.data.length > 0) {
        allAdAccounts = personalAccountsData.data.map(acc => ({
          ...acc,
          business_name: 'Conta Pessoal',
          business_id: null
        }));
      }
    }

    // Remove duplicates (in case an account appears in multiple BMs)
    const uniqueAccounts = Array.from(
      new Map(allAdAccounts.map(acc => [acc.id, acc])).values()
    );

    const adAccountsData = { data: uniqueAccounts };

    console.log('📊 Total unique AUTHORIZED ad accounts found:', adAccountsData.data.length);
    console.log('📋 Authorized Ad Accounts:', adAccountsData.data.map((a: any) => ({ id: a.id, name: a.name, bm: a.business_name })));

    if (!adAccountsData.data || adAccountsData.data.length === 0) {
      console.error('❌ No ad accounts found in authorized Business Managers');
      return sendResultAndClose(false, 'Nenhuma conta encontrada nos Business Managers autorizados. Verifique se você tem contas de anúncios nos BMs que autorizou.');
    }

    // Get already connected accounts for this user
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const connectedAccountIds = existingIntegrations
      .filter(i => i.platform === 'meta')
      .map(i => i.accountId);
    
    console.log('🔗 Already connected account IDs:', connectedAccountIds);

    // Send accounts list and token back to parent window for selection
    const accountsForSelection = adAccountsData.data.map(acc => ({
      id: acc.id,
      name: acc.name,
      account_status: acc.account_status,
      business_id: acc.business_id || null,
      business_name: acc.business_name || 'Conta Pessoal',
      is_connected: connectedAccountIds.includes(acc.id)
    }));

    // Store OAuth data in memory for retrieval by the frontend
    const oauthSessionId = `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (global as any).pendingOAuthSessions = (global as any).pendingOAuthSessions || {};
    (global as any).pendingOAuthSessions[oauthSessionId] = {
      accessToken,
      accounts: accountsForSelection,
      userId,
      createdAt: Date.now()
    };
    
    // Clean up old sessions (older than 5 minutes)
    const now = Date.now();
    for (const key of Object.keys((global as any).pendingOAuthSessions)) {
      if (now - (global as any).pendingOAuthSessions[key].createdAt > 300000) {
        delete (global as any).pendingOAuthSessions[key];
      }
    }

    console.log(`📦 Created OAuth session: ${oauthSessionId} with ${accountsForSelection.length} accounts`);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Callback</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              text-align: center;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            .success-icon {
              width: 64px;
              height: 64px;
              background: #22c55e;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
            }
            .success-icon svg {
              width: 32px;
              height: 32px;
              fill: white;
            }
            h2 { color: #1a1a1a; margin: 0 0 8px; }
            p { color: #666; margin: 0; }
            .session-id { 
              font-family: monospace; 
              font-size: 10px; 
              color: #999; 
              margin-top: 20px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <h2>Autenticação concluída!</h2>
            <p>Encontramos ${accountsForSelection.length} conta(s) de anúncios.</p>
            <p style="margin-top: 10px; font-size: 14px;">Volte para a aba principal para selecionar as contas.</p>
            <p class="session-id">ID: ${oauthSessionId}</p>
          </div>
          <script>
            // Store session ID in localStorage for the main window to retrieve
            localStorage.setItem('meta_oauth_session', '${oauthSessionId}');
            
            // Try to notify opener window
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({
                  type: 'META_OAUTH_ACCOUNTS',
                  sessionId: '${oauthSessionId}'
                }, '*');
              } catch(e) {
                console.log('postMessage failed:', e);
              }
            }
            
            // Auto-close after a delay
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `;
    return res.send(html);
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Try to send error to popup
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'META_OAUTH_ERROR',
                message: 'Erro durante autenticação OAuth'
              }, '*');
              setTimeout(() => window.close(), 500);
            } else {
              window.location.href = '/?error=oauth_callback_failed';
            }
          </script>
          <p style="text-align: center; font-family: sans-serif; margin-top: 50px;">
            ❌ Erro na conexão
            <br><br>
            Esta janela será fechada automaticamente...
          </p>
        </body>
      </html>
    `;
    res.send(html);
  }
});

// Get OAuth session data
router.get('/oauth-session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const sessions = (global as any).pendingOAuthSessions || {};
    
    console.log(`📦 Fetching OAuth session: ${sessionId}`);
    console.log(`📦 Available sessions:`, Object.keys(sessions));
    
    if (!sessions[sessionId]) {
      console.log(`❌ Session not found: ${sessionId}`);
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    const sessionData = sessions[sessionId];
    console.log(`✅ Session found with ${sessionData.accounts?.length || 0} accounts`);
    
    // Delete session after retrieval (one-time use)
    delete sessions[sessionId];
    
    res.json({
      accessToken: sessionData.accessToken,
      accounts: sessionData.accounts,
      userId: sessionData.userId
    });
  } catch (error) {
    next(error);
  }
});

// Save selected account
router.post('/select-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessToken, accountId, accountName, accountStatus, businessId, businessName } = req.body;

    if (!userId || !accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's companyId from database
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;
    
    console.log(`📋 Processing integration for user ${userId} with companyId: ${companyId}, BM: ${businessName}`);

    // Check if THIS SPECIFIC account is already connected (by accountId)
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const existingAccountIntegration = existingIntegrations.find(
      i => i.platform === 'meta' && i.accountId === accountId
    );

    if (existingAccountIntegration) {
      // Same account already connected - just update the token
      console.log(`🔄 Updating existing integration for account ${accountId}`);
      await storage.updateIntegration(existingAccountIntegration.id, {
        accessToken,
        accountName,
        accountStatus,
        businessId: businessId || null,
        businessName: businessName || null,
        status: 'active',
      });
    } else {
      // Different account or no Meta integration yet - CREATE NEW
      console.log(`➕ Creating NEW integration for account ${accountId} - ${accountName} (BM: ${businessName})`);
      await storage.createIntegration({
        companyId,
        platform: 'meta',
        accessToken,
        accountId,
        accountName,
        accountStatus,
        businessId: businessId || null,
        businessName: businessName || null,
        status: 'active',
      });
    }

    console.log(`✅ Account selected and saved: ${accountId} - ${accountName} (companyId: ${companyId})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving selected account:', error);
    next(error);
  }
});

// Check token validity
router.get('/check-token/:integrationId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationId } = req.params;
    const integration = await storage.getIntegrationById(integrationId);
    
    if (!integration || !integration.accessToken) {
      return res.json({ valid: false, error: 'No token found' });
    }

    // Call Meta API to check token validity
    const debugUrl = `https://graph.facebook.com/v22.0/debug_token?input_token=${integration.accessToken}&access_token=${integration.accessToken}`;
    
    const response = await fetch(debugUrl);
    const data = await response.json();
    
    if (data.data) {
      const tokenData = data.data;
      const isValid = tokenData.is_valid;
      const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null;
      const scopes = tokenData.scopes || [];
      
      return res.json({
        valid: isValid,
        expiresAt,
        scopes,
        appId: tokenData.app_id,
        userId: tokenData.user_id,
      });
    }
    
    return res.json({ valid: false, error: data.error?.message || 'Unknown error' });
  } catch (error: any) {
    console.error('Error checking token:', error);
    return res.json({ valid: false, error: error.message });
  }
});

// Get available ad accounts using existing valid token
router.get('/ad-accounts', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { businessId } = req.query;
    
    // Find any existing Meta integration with a valid token
    const integrations = await storage.getIntegrationsByUser(userId);
    
    // If businessId provided, find integration from that BM; otherwise use any valid token
    let metaIntegration;
    if (businessId) {
      metaIntegration = integrations.find(i => i.platform === 'meta' && i.accessToken && i.businessId === businessId);
    }
    if (!metaIntegration) {
      metaIntegration = integrations.find(i => i.platform === 'meta' && i.accessToken);
    }
    
    if (!metaIntegration || !metaIntegration.accessToken) {
      return res.status(404).json({ error: 'No valid Meta token found. Please connect an account first.' });
    }

    const accessToken = metaIntegration.accessToken;
    
    let accounts: { id: string; name: string; accountStatus: number }[] = [];
    
    // If businessId provided, fetch accounts from that specific BM
    if (businessId) {
      const bmAccountsUrl = `https://graph.facebook.com/v22.0/${businessId}/owned_ad_accounts?fields=id,name,account_status&access_token=${accessToken}&limit=100`;
      const bmResponse = await fetch(bmAccountsUrl);
      const bmData = await bmResponse.json() as AdAccountsResponse;
      
      if (bmData.data) {
        accounts = bmData.data.map(acc => ({
          id: acc.id.replace('act_', ''),
          name: acc.name,
          accountStatus: acc.account_status,
        }));
      }
    } else {
      // Fetch all ad accounts the user has access to
      const accountsUrl = `https://graph.facebook.com/v22.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`;
      const response = await fetch(accountsUrl);
      const data = await response.json() as AdAccountsResponse;

      if (data.error) {
        return res.status(400).json({ error: data.error, tokenExpired: true });
      }

      accounts = (data.data || []).map(acc => ({
        id: acc.id.replace('act_', ''),
        name: acc.name,
        accountStatus: acc.account_status,
      }));
    }

    // Get already connected account IDs (remove act_ prefix for comparison)
    const connectedAccountIds = integrations
      .filter(i => i.platform === 'meta')
      .map(i => i.accountId?.replace('act_', '') || '');

    res.json({ 
      accounts,
      connectedAccountIds,
      tokenValid: true,
    });
  } catch (error: any) {
    console.error('Error fetching ad accounts:', error);
    next(error);
  }
});

// Renew all tokens for Meta integrations
router.post('/renew-all-tokens', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrations = await storage.getIntegrationsByUser(userId);
    const metaIntegrations = integrations.filter(i => i.platform === 'meta');

    if (metaIntegrations.length === 0) {
      return res.status(400).json({ error: 'Nenhuma integração Meta encontrada' });
    }

    const settings = await storage.getPlatformSettingsByPlatform('meta');
    if (!settings) {
      return res.status(400).json({ error: 'App Meta não configurado' });
    }

    let renewed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const integration of metaIntegrations) {
      if (!integration.accessToken) {
        results.push({ id: integration.id, accountName: integration.accountName, success: false, error: 'Sem token' });
        failed++;
        continue;
      }

      try {
        // Exchange current token for new long-lived token
        const longLivedUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${settings.appId}&client_secret=${settings.appSecret}&fb_exchange_token=${integration.accessToken}`;
        
        const response = await fetch(longLivedUrl);
        const data = await response.json() as TokenResponse;

        if (data.access_token) {
          // Update integration with new token
          await storage.updateIntegration(integration.id, {
            accessToken: data.access_token,
            status: 'active',
          });
          renewed++;
          results.push({ id: integration.id, accountName: integration.accountName, success: true });
          console.log(`✅ Token renovado para ${integration.accountName}`);
        } else {
          failed++;
          results.push({ id: integration.id, accountName: integration.accountName, success: false, error: 'Token expirado - reautenticação necessária' });
          console.log(`❌ Falha ao renovar token para ${integration.accountName}:`, data);
        }
      } catch (err: any) {
        failed++;
        results.push({ id: integration.id, accountName: integration.accountName, success: false, error: err.message });
      }
    }

    res.json({ 
      renewed, 
      failed,
      total: metaIntegrations.length,
      results,
      message: failed > 0 
        ? `${renewed} tokens renovados. ${failed} falharam - esses precisam de reautenticação.`
        : `${renewed} tokens renovados com sucesso!`
    });
  } catch (error: any) {
    console.error('Error renewing tokens:', error);
    next(error);
  }
});

// Add account using existing token
router.post('/add-account', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { accountId, accountName, accountStatus, businessId, businessName } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Get user's company
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;

    // Find existing Meta integration to get the token
    const integrations = await storage.getIntegrationsByUser(userId);
    const metaIntegration = integrations.find(i => i.platform === 'meta' && i.accessToken);

    if (!metaIntegration || !metaIntegration.accessToken) {
      return res.status(400).json({ error: 'No valid token found. Please reconnect to Meta.' });
    }

    // Check if this specific account is already connected
    const existingAccount = integrations.find(i => i.platform === 'meta' && i.accountId === accountId);
    if (existingAccount) {
      return res.status(400).json({ error: 'This account is already connected.' });
    }

    // Create new integration with existing token
    await storage.createIntegration({
      companyId,
      platform: 'meta',
      accessToken: metaIntegration.accessToken,
      accountId,
      accountName,
      accountStatus: String(accountStatus),
      businessId: businessId || metaIntegration.businessId || null,
      businessName: businessName || metaIntegration.businessName || null,
      status: 'active',
    });

    console.log(`✅ Added new account ${accountId} - ${accountName} using existing token`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding account:', error);
    next(error);
  }
});

export default router;
