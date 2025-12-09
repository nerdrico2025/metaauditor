
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

    // Store access token and accounts for user to select
    // Send accounts list back to popup for selection
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Selecione a Conta</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h2 {
              margin: 0 0 8px 0;
              font-size: 20px;
              color: #1a1a1a;
            }
            p {
              margin: 0 0 20px 0;
              color: #666;
              font-size: 14px;
            }
            .account-list {
              max-height: 400px;
              overflow-y: auto;
            }
            .account-item {
              border: 2px solid #e0e0e0;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 12px;
              cursor: pointer;
              transition: all 0.2s;
            }
            .account-item:hover {
              border-color: #1877f2;
              background: #f0f8ff;
            }
            .account-name {
              font-weight: 600;
              font-size: 16px;
              color: #1a1a1a;
              margin-bottom: 4px;
            }
            .account-id {
              font-size: 13px;
              color: #666;
              font-family: monospace;
            }
            .account-bm {
              font-size: 12px;
              color: #1877f2;
              margin-top: 4px;
              font-weight: 500;
            }
            .account-status {
              display: inline-block;
              margin-top: 8px;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
            }
            .status-active {
              background: #e7f5e7;
              color: #2e7d32;
            }
            .status-disabled {
              background: #fff3e0;
              color: #e65100;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🎯 Selecione a Conta de Anúncios</h2>
            <p><strong>✅ Contas dos Business Managers Autorizados</strong><br>
            Encontramos ${adAccountsData.data.length} conta(s) de anúncios nos BMs que você autorizou. Selecione qual deseja conectar:</p>
            <div class="account-list">
              ${adAccountsData.data.map(account => `
                <div class="account-item" onclick="selectAccount('${account.id}', '${account.name.replace(/'/g, "\\'")}', ${account.account_status})">
                  <div class="account-name">${account.name}</div>
                  <div class="account-id">${account.id}</div>
                  ${account.business_name ? `<div class="account-bm">🏢 ${account.business_name}</div>` : ''}
                  <span class="account-status ${account.account_status === 1 ? 'status-active' : 'status-disabled'}">
                    ${account.account_status === 1 ? '✓ Ativa' : '⚠ Desativada'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
          <script>
            async function selectAccount(accountId, accountName, accountStatus) {
              try {
                const response = await fetch('/api/auth/meta/select-account', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: '${userId}',
                    accessToken: '${accessToken}',
                    accountId,
                    accountName,
                    accountStatus: accountStatus === 1 ? 'ACTIVE' : 'DISABLED'
                  })
                });
                
                if (response.ok) {
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'META_OAUTH_SUCCESS',
                      message: 'Conta conectada: ' + accountName
                    }, '*');
                  }
                  setTimeout(() => window.close(), 500);
                } else {
                  alert('Erro ao conectar conta');
                }
              } catch (error) {
                alert('Erro ao conectar conta: ' + error.message);
              }
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

// Save selected account
router.post('/select-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessToken, accountId, accountName, accountStatus } = req.body;

    if (!userId || !accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's companyId from database
    const user = await storage.getUserById(userId);
    const companyId = user?.companyId || null;
    
    console.log(`📋 Creating integration for user ${userId} with companyId: ${companyId}`);

    // Create or update integration
    const existingIntegrations = await storage.getIntegrationsByUser(userId);
    const metaIntegration = existingIntegrations.find(i => i.platform === 'meta');

    if (metaIntegration) {
      await storage.updateIntegration(metaIntegration.id, {
        accessToken,
        accountId,
        accountName,
        accountStatus,
        status: 'active',
      });
    } else {
      await storage.createIntegration({
        companyId,
        platform: 'meta',
        accessToken,
        accountId,
        accountName,
        accountStatus,
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

export default router;
