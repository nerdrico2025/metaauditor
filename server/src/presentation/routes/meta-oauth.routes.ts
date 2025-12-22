
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { db } from '../../infrastructure/database';
import { oauthSessions } from '../../../drizzle/schema';
import { eq, lt, sql } from 'drizzle-orm';

const router = Router();

// Ensure oauth_sessions table exists on startup
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id UUID NOT NULL,
        access_token TEXT NOT NULL,
        accounts JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);
    console.log('✅ oauth_sessions table ensured');
  } catch (error) {
    console.error('❌ Error ensuring oauth_sessions table:', error);
  }
})();

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

// Get Meta app configuration for frontend (Embedded Signup)
router.get('/config', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await storage.getPlatformSettingsByPlatform('meta');
    
    if (!settings || !settings.isConfigured) {
      return res.status(400).json({
        error: 'Meta app not configured',
        configured: false
      });
    }

    // Return only public info needed for Embedded Signup (not the secret!)
    res.json({
      configured: true,
      appId: settings.appId,
      configId: process.env.META_CONFIG_ID || null
    });
  } catch (error) {
    next(error);
  }
});

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
    
    // Log token info for debugging (first 20 chars only for security)
    console.log(`🔑 New OAuth token obtained: ${accessToken.substring(0, 20)}...`);
    console.log(`👤 ClickAuditor userId making request: ${userId}`);
    
    // Get Facebook user info to confirm identity
    const fbUserUrl = `https://graph.facebook.com/v22.0/me?access_token=${accessToken}&fields=id,name,email`;
    const fbUserResponse = await fetch(fbUserUrl);
    const fbUserData = await fbUserResponse.json() as { id?: string; name?: string; email?: string; error?: any };
    
    if (fbUserData.error) {
      console.error('❌ Error getting Facebook user info:', fbUserData.error);
    } else {
      console.log(`👤 Facebook user authenticated: ${fbUserData.name} (ID: ${fbUserData.id}, Email: ${fbUserData.email || 'not provided'})`);
    }

    // Step 1: Get ONLY the Business Managers that were AUTHORIZED during OAuth
    const businessesUrl = `https://graph.facebook.com/v22.0/me/businesses?access_token=${accessToken}&fields=id,name,verification_status&limit=100`;
    const businessesResponse = await fetch(businessesUrl);
    const businessesData = await businessesResponse.json() as { data?: Array<{ id: string; name: string }> };

    console.log('🔐 Business Managers AUTHORIZED in OAuth:', businessesData.data?.length || 0);
    console.log('📋 Authorized Businesses:', businessesData.data?.map((b: any) => ({ id: b.id, name: b.name })));

    let allAdAccounts: any[] = [];
    
    if (businessesData.data && businessesData.data.length > 0) {
      // Step 2: Get ad accounts ONLY from AUTHORIZED Business Managers
      // Fetch BOTH owned accounts AND client/agency accounts
      for (const business of businessesData.data) {
        console.log(`🔍 Fetching ad accounts from authorized BM: ${business.name} (${business.id})`);
        
        // Fetch owned ad accounts (contas próprias do BM)
        const ownedAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/owned_ad_accounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const ownedAccountsResponse = await fetch(ownedAccountsUrl);
        const ownedAccountsData = await ownedAccountsResponse.json() as { data?: any[], error?: any };
        
        // Log full response for debugging
        console.log(`  📊 owned_ad_accounts response:`, JSON.stringify(ownedAccountsData));
        
        if (ownedAccountsData.error) {
          console.log(`  ⚠️ Error fetching owned_ad_accounts: ${ownedAccountsData.error.message}`);
        } else if (ownedAccountsData.data && ownedAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${ownedAccountsData.data.length} OWNED ad accounts in BM "${business.name}"`);
          const accountsWithBM = ownedAccountsData.data.map(acc => ({
            ...acc,
            business_name: business.name,
            business_id: business.id
          }));
          allAdAccounts.push(...accountsWithBM);
        } else {
          console.log(`  ⚠️ owned_ad_accounts returned empty array or no data`);
        }
        
        // Fetch client ad accounts (contas de clientes/agência)
        const clientAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/client_ad_accounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const clientAccountsResponse = await fetch(clientAccountsUrl);
        const clientAccountsData = await clientAccountsResponse.json() as { data?: any[], error?: any };
        
        if (clientAccountsData.error) {
          console.log(`  ⚠️ Error fetching client_ad_accounts: ${clientAccountsData.error.message}`);
        } else if (clientAccountsData.data && clientAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${clientAccountsData.data.length} CLIENT ad accounts in BM "${business.name}"`);
          const clientAccountsWithBM = clientAccountsData.data.map(acc => ({
            ...acc,
            business_name: `${business.name} (Cliente)`,
            business_id: business.id
          }));
          allAdAccounts.push(...clientAccountsWithBM);
        }
        
        // Try fetching ad accounts accessible by this user in the BM via different edges
        // Method 1: Get all ad accounts the business has access to (adaccounts edge)
        const bmAllAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/adaccounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const bmAllAccountsResponse = await fetch(bmAllAccountsUrl);
        const bmAllAccountsData = await bmAllAccountsResponse.json() as { data?: any[], error?: any };
        
        if (bmAllAccountsData.error) {
          console.log(`  ⚠️ Error fetching BM adaccounts: ${bmAllAccountsData.error.message}`);
        } else if (bmAllAccountsData.data && bmAllAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${bmAllAccountsData.data.length} ad accounts via BM adaccounts edge "${business.name}"`);
          const bmAllAccountsWithBM = bmAllAccountsData.data.map(acc => ({
            ...acc,
            business_name: business.name,
            business_id: business.id
          }));
          allAdAccounts.push(...bmAllAccountsWithBM);
        }
        
        const totalFound = (ownedAccountsData.data?.length || 0) + (clientAccountsData.data?.length || 0) + (bmAllAccountsData.data?.length || 0);
        if (totalFound === 0) {
          console.log(`  ⚠️ No ad accounts found in BM "${business.name}" via any edge`);
        }
      }
    }
    
    // ALWAYS also fetch personal ad accounts (me/adaccounts) as additional source
    // This catches accounts that the user has direct access to but aren't in a BM
    console.log('🔍 Also fetching personal ad accounts (me/adaccounts)...');
    const personalAccountsUrl = `https://graph.facebook.com/v22.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
    const personalAccountsResponse = await fetch(personalAccountsUrl);
    const personalAccountsData = await personalAccountsResponse.json() as AdAccountsResponse;
    
    if (personalAccountsData.data && personalAccountsData.data.length > 0) {
      console.log(`  ✅ Found ${personalAccountsData.data.length} personal ad accounts`);
      const personalAccounts = personalAccountsData.data.map(acc => ({
        ...acc,
        business_name: 'Conta Pessoal',
        business_id: null
      }));
      allAdAccounts.push(...personalAccounts);
    } else {
      console.log('  ⚠️ No personal ad accounts found');
    }

    // Remove duplicates (in case an account appears in multiple BMs)
    const uniqueAccounts = Array.from(
      new Map(allAdAccounts.map(acc => [acc.id, acc])).values()
    );

    const adAccountsData = { data: uniqueAccounts };

    console.log('📊 Total unique AUTHORIZED ad accounts found:', adAccountsData.data.length);
    console.log('📋 Authorized Ad Accounts:', adAccountsData.data.map((a: any) => ({ id: a.id, name: a.name, bm: a.business_name })));

    if (!adAccountsData.data || adAccountsData.data.length === 0) {
      console.error('❌ No ad accounts found - user has no access to any ad accounts');
      console.error('   This Facebook user needs to be added as admin/analyst to an ad account in Business Manager');
      return sendResultAndClose(false, 'Nenhuma conta de anúncios encontrada. Este usuário do Facebook precisa ter acesso a contas de anúncios no Business Manager. Peça ao administrador do BM para adicionar você como analista ou admin de uma conta.');
    }

    // Get already connected accounts for this user
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    // Normalize IDs: remove 'act_' prefix for consistent comparison
    const connectedAccountIds = existingIntegrations
      .filter(i => i.platform === 'meta')
      .map(i => i.accountId?.replace(/^act_/, '') || '');
    
    console.log('🔗 Already connected account IDs (normalized):', connectedAccountIds);

    // Send accounts list and token back to parent window for selection
    const accountsForSelection = adAccountsData.data.map(acc => {
      // Normalize incoming ID for comparison
      const normalizedId = acc.id?.replace(/^act_/, '') || '';
      const isConnected = connectedAccountIds.includes(normalizedId);
      return {
        id: acc.id,
        name: acc.name,
        account_status: acc.account_status,
        business_id: acc.business_id || null,
        business_name: acc.business_name || 'Conta Pessoal',
        is_connected: isConnected
      };
    });

    // Store OAuth data in database for retrieval by the frontend (works across workers)
    const oauthSessionId = `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    
    try {
      // Clean up old sessions (older than 5 minutes)
      await db.delete(oauthSessions).where(lt(oauthSessions.expiresAt, new Date()));
      console.log(`🧹 Cleaned up old OAuth sessions`);
      
      // Store new session in database (including Facebook user info)
      const insertResult = await db.insert(oauthSessions).values({
        id: oauthSessionId,
        userId,
        accessToken,
        accounts: accountsForSelection,
        facebookUserId: fbUserData.id || null,
        facebookUserName: fbUserData.name || null,
        expiresAt,
      }).returning();
      
      console.log(`📦 Created OAuth session in DB: ${oauthSessionId} with ${accountsForSelection.length} accounts`);
      console.log(`📦 Insert result:`, JSON.stringify(insertResult));
      
      // Verify the session was saved
      const verifySession = await db.select().from(oauthSessions).where(eq(oauthSessions.id, oauthSessionId));
      console.log(`📦 Verified session exists:`, verifySession.length > 0);
    } catch (dbError) {
      console.error(`❌ Database error saving OAuth session:`, dbError);
      // Continue anyway - the session will be passed via URL params as fallback
    }
    
    // In production, redirect directly to the integrations page with session ID
    // This avoids issues with popup communication across multiple workers
    const baseUrl = process.env.REPL_URL || process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'http://localhost:5000';
    
    // Check if this is a popup or direct navigation
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
            .loader {
              border: 3px solid #f3f3f3;
              border-top: 3px solid #667eea;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              animation: spin 1s linear infinite;
              margin: 20px auto 0;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
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
            <p style="margin-top: 10px; font-size: 14px;">Redirecionando...</p>
            <div class="loader"></div>
          </div>
          <script>
            // Store session ID in localStorage as backup
            localStorage.setItem('meta_oauth_session', '${oauthSessionId}');
            
            // First try to communicate with opener (for popup mode)
            let handled = false;
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({
                  type: 'META_OAUTH_ACCOUNTS',
                  sessionId: '${oauthSessionId}'
                }, '*');
                handled = true;
                // Close popup after brief delay
                setTimeout(() => window.close(), 1000);
              } catch(e) {
                console.log('postMessage failed:', e);
              }
            }
            
            // If not handled by popup, redirect directly (for production or when popup fails)
            if (!handled) {
              setTimeout(() => {
                window.location.href = '/integrations/meta?oauth_session=${oauthSessionId}';
              }, 1500);
            }
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
    
    console.log(`📦 Fetching OAuth session from database: ${sessionId}`);
    
    // Fetch session from database
    const sessions = await db.select().from(oauthSessions).where(eq(oauthSessions.id, sessionId));
    
    if (sessions.length === 0) {
      console.log(`❌ Session not found in database: ${sessionId}`);
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    const sessionData = sessions[0];
    
    // Check if session is expired
    if (new Date(sessionData.expiresAt) < new Date()) {
      console.log(`❌ Session expired: ${sessionId}`);
      await db.delete(oauthSessions).where(eq(oauthSessions.id, sessionId));
      return res.status(404).json({ error: 'Session expired' });
    }
    
    console.log(`✅ Session found with ${(sessionData.accounts as any[])?.length || 0} accounts`);
    
    // Delete session after retrieval (one-time use)
    await db.delete(oauthSessions).where(eq(oauthSessions.id, sessionId));
    
    res.json({
      accessToken: sessionData.accessToken,
      accounts: sessionData.accounts,
      userId: sessionData.userId,
      facebookUserId: sessionData.facebookUserId,
      facebookUserName: sessionData.facebookUserName
    });
  } catch (error) {
    next(error);
  }
});

// Handle Embedded Signup callback (exchange code for token and get accounts)
router.post('/embedded-signup', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log(`🔐 Processing Embedded Signup for user ${userId}`);

    // Get platform settings
    const settings = await storage.getPlatformSettingsByPlatform('meta');
    
    if (!settings || !settings.isConfigured) {
      return res.status(400).json({ error: 'Meta app not configured' });
    }

    // For Embedded Signup with FB.login using config_id, NO redirect_uri is needed
    // The code is exchanged directly without redirect_uri parameter
    console.log(`📍 Attempting Embedded Signup token exchange (no redirect_uri)`);

    // Exchange code for access token WITHOUT redirect_uri for Embedded Signup
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${settings.appId}&client_secret=${settings.appSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json() as TokenResponse;

    if (tokenData.error || !tokenData.access_token) {
      console.error('❌ Failed to exchange code for token:', tokenData);
      return res.status(400).json({ error: 'Failed to exchange code for access token' });
    }

    const shortLivedToken = tokenData.access_token;
    console.log('🔑 Embedded Signup token obtained');

    // Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${settings.appId}&client_secret=${settings.appSecret}&fb_exchange_token=${shortLivedToken}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json() as TokenResponse;

    const accessToken = longLivedData.access_token || shortLivedToken;
    console.log('🔑 Long-lived token obtained for Embedded Signup');

    // Get Facebook user info
    const fbUserUrl = `https://graph.facebook.com/v22.0/me?access_token=${accessToken}&fields=id,name,email`;
    const fbUserResponse = await fetch(fbUserUrl);
    const fbUserData = await fbUserResponse.json() as { id?: string; name?: string; email?: string; error?: any };
    
    console.log(`👤 Facebook user (Embedded): ${fbUserData.name} (ID: ${fbUserData.id})`);

    // Fetch Business Managers and Ad Accounts
    const businessesUrl = `https://graph.facebook.com/v22.0/me/businesses?access_token=${accessToken}&fields=id,name,verification_status&limit=100`;
    const businessesResponse = await fetch(businessesUrl);
    const businessesData = await businessesResponse.json() as { data?: Array<{ id: string; name: string }> };

    console.log('🔐 Business Managers found (Embedded):', businessesData.data?.length || 0);

    let allAdAccounts: any[] = [];
    
    if (businessesData.data && businessesData.data.length > 0) {
      for (const business of businessesData.data) {
        console.log(`🔍 Fetching accounts from BM: ${business.name} (${business.id})`);
        
        // Fetch owned ad accounts
        const ownedAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/owned_ad_accounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const ownedAccountsResponse = await fetch(ownedAccountsUrl);
        const ownedAccountsData = await ownedAccountsResponse.json() as { data?: any[], error?: any };
        
        if (ownedAccountsData.data && ownedAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${ownedAccountsData.data.length} OWNED accounts`);
          const accountsWithBM = ownedAccountsData.data.map(acc => ({
            ...acc,
            business_name: business.name,
            business_id: business.id
          }));
          allAdAccounts.push(...accountsWithBM);
        } else if (ownedAccountsData.error) {
          console.log(`  ⚠️ Error fetching owned_ad_accounts: ${ownedAccountsData.error.message}`);
        }
        
        // Fetch client ad accounts
        const clientAccountsUrl = `https://graph.facebook.com/v22.0/${business.id}/client_ad_accounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
        const clientAccountsResponse = await fetch(clientAccountsUrl);
        const clientAccountsData = await clientAccountsResponse.json() as { data?: any[], error?: any };
        
        if (clientAccountsData.data && clientAccountsData.data.length > 0) {
          console.log(`  ✅ Found ${clientAccountsData.data.length} CLIENT accounts`);
          const clientAccountsWithBM = clientAccountsData.data.map(acc => ({
            ...acc,
            business_name: `${business.name} (Cliente)`,
            business_id: business.id
          }));
          allAdAccounts.push(...clientAccountsWithBM);
        }
      }
    }

    // Also fetch personal ad accounts
    const personalAccountsUrl = `https://graph.facebook.com/v22.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_status&limit=500`;
    const personalResponse = await fetch(personalAccountsUrl);
    const personalData = await personalResponse.json() as { data?: any[] };
    
    if (personalData.data && personalData.data.length > 0) {
      console.log(`  ✅ Found ${personalData.data.length} personal accounts`);
      const personalWithType = personalData.data.map(acc => ({
        ...acc,
        business_name: 'Conta Pessoal',
        business_id: null
      }));
      allAdAccounts.push(...personalWithType);
    }

    // Remove duplicates
    const uniqueAccounts = new Map();
    allAdAccounts.forEach(acc => {
      const accountId = acc.id.replace('act_', '');
      if (!uniqueAccounts.has(accountId)) {
        uniqueAccounts.set(accountId, acc);
      }
    });
    
    const accountsForSelection = Array.from(uniqueAccounts.values()).map(acc => ({
      id: acc.id.replace('act_', ''),
      name: acc.name,
      account_status: acc.account_status,
      business_name: acc.business_name,
      business_id: acc.business_id
    }));

    console.log(`📊 Total unique accounts found (Embedded): ${accountsForSelection.length}`);

    // Check which accounts are already connected
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const connectedAccountIds = existingIntegrations
      .filter(i => i.platform === 'meta')
      .map(i => i.accountId);

    const accountsWithConnectionStatus = accountsForSelection.map(acc => ({
      ...acc,
      is_connected: connectedAccountIds.includes(acc.id)
    }));

    res.json({
      success: true,
      accessToken,
      accounts: accountsWithConnectionStatus,
      facebookUserId: fbUserData.id,
      facebookUserName: fbUserData.name,
      businessCount: businessesData.data?.length || 0
    });
  } catch (error) {
    console.error('❌ Embedded Signup error:', error);
    next(error);
  }
});

// Save selected account
router.post('/select-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessToken, accountId, accountName, accountStatus, businessId, businessName, facebookUserId, facebookUserName } = req.body;

    if (!userId || !accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's companyId from database
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;
    
    console.log(`📋 Processing integration for user ${userId} with companyId: ${companyId}, BM: ${businessName}`);
    console.log(`👤 Facebook user: ${facebookUserName} (${facebookUserId})`);

    // Check if THIS SPECIFIC account is already connected (by accountId)
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const existingAccountIntegration = existingIntegrations.find(
      i => i.platform === 'meta' && i.accountId === accountId
    );

    // Get user name for display
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : null;

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
        connectedByUserId: userId,
        connectedByUserName: userName,
        facebookUserId: facebookUserId || null,
        facebookUserName: facebookUserName || null,
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
        connectedByUserId: userId,
        connectedByUserName: userName,
        facebookUserId: facebookUserId || null,
        facebookUserName: facebookUserName || null,
      });
    }

    console.log(`✅ Account selected and saved: ${accountId} - ${accountName} (companyId: ${companyId})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving selected account:', error);
    next(error);
  }
});

// Update tokens for all already-connected accounts after OAuth re-authentication
router.post('/update-connected-tokens', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessToken, connectedAccountIds } = req.body;

    if (!userId || !accessToken || !connectedAccountIds || !Array.isArray(connectedAccountIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🔄 Updating tokens for ${connectedAccountIds.length} connected accounts`);

    // Get user details for tracking who renewed the connection
    const user = await storage.getUserById(userId);
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : null;

    // Get all user's integrations
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const metaIntegrations = existingIntegrations.filter(i => i.platform === 'meta');

    let updated = 0;
    for (const integration of metaIntegrations) {
      // Normalize accountId for comparison (remove 'act_' prefix if present)
      const normalizedIntegrationAccountId = integration.accountId?.replace(/^act_/, '');
      const isConnected = connectedAccountIds.some(id => {
        const normalizedId = id.replace(/^act_/, '');
        return normalizedId === normalizedIntegrationAccountId;
      });

      if (isConnected) {
        console.log(`  ✅ Updating token for account: ${integration.accountName} (${integration.accountId})`);
        await storage.updateIntegration(integration.id, {
          accessToken,
          status: 'active',
          connectedByUserId: userId,
          connectedByUserName: userName,
        });
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} integration tokens`);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating connected tokens:', error);
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
    const data = await response.json() as { data?: { is_valid: boolean; expires_at?: number; scopes?: string[]; app_id?: string; user_id?: string }; error?: { message: string } };
    
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
