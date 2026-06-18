import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  capabilities?: string[];
}

// Normaliza account_id: extrai o ID numérico seja de account_id ou id (act_xxx)
function normalizeAccountId(acc: any): string {
  if (acc.account_id) return String(acc.account_id);
  if (acc.id?.startsWith('act_')) return acc.id.replace('act_', '');
  return String(acc.id || '');
}

// Classifica o tipo de conta com base nas capabilities e no nome
function classifyAccountType(account: MetaAdAccount): 'ads_account' | 'whatsapp_clicks' | 'disparo' | 'read_only' | 'other' {
  const name = account.name?.toLowerCase() || '';
  const caps = account.capabilities || [];

  if (name.includes('(read-only)') || name.includes('(read only)') || name.includes('read-only')) {
    return 'read_only';
  }
  if (
    caps.includes('WHATSAPP_CLICK_TO_CHAT') ||
    name.includes('whatsapp') ||
    name.includes('whats') ||
    name.includes('atendimento')
  ) {
    return 'whatsapp_clicks';
  }
  if (name.includes('disparo') || name.includes('dispara')) {
    return 'disparo';
  }
  if (
    caps.includes('AD_SERVING_TO_USER_WITH_NO_FACEBOOK_LINKAGE') ||
    caps.includes('ADS_MANAGEMENT_THIRDPARTY') ||
    caps.includes('AD_CREATION') ||
    caps.length > 0
  ) {
    return 'ads_account';
  }
  return 'other';
}

// Helper: fetch JSON with timeout
async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Helper: fetch ALL pages from a paginated Meta API endpoint
async function fetchAllPages(url: string, accessToken: string, maxPages = 10): Promise<any[]> {
  let allData: any[] = [];
  let nextUrl: string | null = url.includes('access_token=') ? url : `${url}&access_token=${accessToken}`;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const result = await fetchJson(nextUrl);
    const items = result.data || [];
    allData = allData.concat(items);

    // Check for next page
    nextUrl = result.paging?.next || null;
    page++;
  }

  return allData;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const buildRedirectResponse = (success: boolean, errorMsg: string | null = null, accountsCount: number = 0, redirectUrl?: string) => {
    if (!redirectUrl) {
      return new Response(JSON.stringify({ success, error: errorMsg, accounts: accountsCount }), {
        status: success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const url = new URL(redirectUrl);
    url.searchParams.set("source", "meta_oauth");
    url.searchParams.set("success", String(success));
    if (errorMsg) url.searchParams.set("error", encodeURIComponent(errorMsg));
    url.searchParams.set("accounts", String(accountsCount));
    const target = url.toString();
    // Manual 302 redirect (Response.redirect() causes 502 on Supabase Edge)
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": target }
    });
  };

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return buildRedirectResponse(false, errorDescription || error);
    }

    if (!code || !state) {
      return buildRedirectResponse(false, "Faltando parâmetro code ou state na requisição.");
    }

    let stateData: { user_id: string; company_id: string; redirect_url: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return buildRedirectResponse(false, "Parâmetro state inválido.");
    }

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("Meta App credentials not configured");
      return buildRedirectResponse(false, "Aplicativo Meta não configurado no servidor.", 0, stateData?.redirect_url);
    }

    // Step 1: Exchange code for short-lived token
    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`;

    console.log("Exchanging code for token...");
    const tokenData = await fetchJson(tokenUrl) as MetaTokenResponse;

    if (!tokenData.access_token) {
      console.error("Failed to exchange code for token:", JSON.stringify(tokenData));
      return buildRedirectResponse(false, "Falha ao obter token de acesso da Meta.", 0, stateData?.redirect_url);
    }

    // Step 2: Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;
    const longLivedData = await fetchJson(longLivedUrl) as MetaTokenResponse;

    const accessToken = longLivedData.access_token || tokenData.access_token;
    const expiresIn = longLivedData.expires_in || tokenData.expires_in;

    console.log("Token OK, expires_in:", expiresIn);

    // Step 3: Fetch user info, permissions, and ad accounts IN PARALLEL
    // Request business{id,name} directly on each ad account — most reliable BM source
    const [meData, permissionsData, adAccountsRaw] = await Promise.all([
      fetchJson(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`),
      fetchJson(`https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`),
      fetchAllPages(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name,capabilities,business{id,name}&limit=200&access_token=${accessToken}`, accessToken),
    ]);

    const facebookUserId = meData.id;
    const facebookUserName = meData.name;
    const grantedPermissions = permissionsData.data
      ?.filter((p: any) => p.status === 'granted')
      .map((p: any) => p.permission) || [];

    // Normalize all account IDs and extract BM info directly from each account
    const adAccounts: any[] = adAccountsRaw.map((acc: any) => ({
      ...acc,
      account_id: normalizeAccountId(acc),
    }));

    console.log(`User: ${facebookUserName} (${facebookUserId}), Ad Accounts: ${adAccounts.length}`);

    // Build BM map from the business field on each account (primary source)
    const accountToBmMap = new Map<string, { bm_id: string; bm_name: string }>();
    for (const acc of adAccounts) {
      if (acc.business?.id && acc.business?.name) {
        accountToBmMap.set(acc.account_id, { bm_id: acc.business.id, bm_name: acc.business.name });
      }
    }
    console.log(`Direct BM mapping: ${accountToBmMap.size}/${adAccounts.length} accounts have a BM`);

    // Step 4: Also fetch BMs list + their owned/client accounts to catch
    // accounts not in me/adaccounts and as fallback BM mapping
    const businesses = await fetchAllPages(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=100&access_token=${accessToken}`, accessToken
    );
    console.log(`BMs from me/businesses: ${businesses.length}`);

    const bmAdAccountsMap = new Map<string, any>();

    if (businesses.length > 0) {
      const bmResults = await Promise.allSettled(
        businesses.map(async (bm: any) => {
          const [ownedAccounts, clientAccounts] = await Promise.all([
            fetchAllPages(`https://graph.facebook.com/v21.0/${bm.id}/owned_ad_accounts?fields=id,name,account_id,account_status,currency,timezone_name,capabilities&limit=200&access_token=${accessToken}`, accessToken),
            fetchAllPages(`https://graph.facebook.com/v21.0/${bm.id}/client_ad_accounts?fields=id,name,account_id,account_status,currency,timezone_name,capabilities&limit=200&access_token=${accessToken}`, accessToken),
          ]);
          return { bm_id: bm.id, bm_name: bm.name, accounts: [...ownedAccounts, ...clientAccounts] };
        })
      );

      for (const result of bmResults) {
        if (result.status === 'fulfilled') {
          for (const acc of result.value.accounts) {
            const nid = normalizeAccountId(acc);
            if (!nid) continue;
            acc.account_id = nid;
            // Fallback BM mapping for accounts without business field
            if (!accountToBmMap.has(nid)) {
              accountToBmMap.set(nid, { bm_id: result.value.bm_id, bm_name: result.value.bm_name });
            }
            // Store for merge (accounts not in me/adaccounts)
            if (!bmAdAccountsMap.has(nid) && acc.name) {
              bmAdAccountsMap.set(nid, acc);
            }
          }
        }
      }
      console.log(`After BM fallback: ${accountToBmMap.size} accounts mapped`);
    }

    // Merge: add BM-only accounts that weren't in me/adaccounts
    const meAccountIds = new Set(adAccounts.map((a: any) => a.account_id));
    let bmOnlyCount = 0;
    for (const [accountId, account] of bmAdAccountsMap) {
      if (!meAccountIds.has(accountId)) {
        adAccounts.push(account);
        bmOnlyCount++;
      }
    }
    if (bmOnlyCount > 0) {
      console.log(`Added ${bmOnlyCount} BM-only accounts. Total: ${adAccounts.length}`);
    }

    // Step 5: Initialize Supabase and save
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const tokenExpiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString();

    // Fetch existing integrations to preserve is_monitored on reconnect
    const { data: existingIntegrations } = await supabase
      .from("integrations")
      .select("account_id, is_monitored")
      .eq("company_id", stateData.company_id)
      .eq("platform", "meta");
    const existingMonitored = new Map<string, boolean>();
    for (const ei of existingIntegrations || []) {
      existingMonitored.set(ei.account_id, ei.is_monitored === true);
    }

    // Build all integration rows — preserve is_monitored for existing accounts
    const integrationRows = adAccounts.map(account => {
      const normalizedId = normalizeAccountId(account);
      const accountBm = accountToBmMap.get(normalizedId);
      const wasMonitored = existingMonitored.get(account.account_id) || false;
      return {
        company_id: stateData.company_id,
        user_id: stateData.user_id,
        platform: "meta",
        account_id: account.account_id,
        account_name: account.name,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        status: account.account_status === 1 ? "active" : "inactive",
        is_monitored: wasMonitored,
        permissions: {
          currency: account.currency,
          timezone: account.timezone_name,
          account_status: account.account_status,
          business_manager_id: accountBm?.bm_id || null,
          business_manager_name: accountBm?.bm_name || null,
          facebook_user_id: facebookUserId,
          facebook_user_name: facebookUserName,
          granted_permissions: grantedPermissions,
          capabilities: account.capabilities || [],
          account_type: classifyAccountType(account)
        }
      };
    });

    // Batch upsert (all at once instead of one-by-one)
    let savedCount = 0;
    if (integrationRows.length > 0) {
      // Upsert in chunks of 50 to avoid payload limits
      const chunkSize = 50;
      for (let i = 0; i < integrationRows.length; i += chunkSize) {
        const chunk = integrationRows.slice(i, i + chunkSize);
        const { data, error: upsertError } = await supabase
          .from("integrations")
          .upsert(chunk, { onConflict: "company_id,account_id", ignoreDuplicates: false })
          .select("id");

        if (upsertError) {
          console.error("Upsert error (chunk", i, "):", upsertError);
        } else {
          savedCount += data?.length || 0;
        }
      }
    }

    console.log(`Saved ${savedCount}/${adAccounts.length} integrations`);

    // Save OAuth session (non-blocking, don't fail if this errors)
    try {
      await supabase.from("oauth_sessions").insert({
        id: crypto.randomUUID(),
        user_id: stateData.user_id,
        access_token: accessToken,
        accounts: adAccounts.map(a => ({ id: a.account_id, name: a.name })),
        expires_at: tokenExpiresAt
      });
    } catch (sessionErr) {
      console.error("Failed to save oauth_session (non-critical):", sessionErr);
    }

    if (savedCount === 0 && adAccounts.length > 0) {
      console.error("CRITICAL: Found accounts but saved none");
      return buildRedirectResponse(false, "Erro ao salvar informações no banco de dados.", 0, stateData?.redirect_url);
    }

    return buildRedirectResponse(true, null, savedCount, stateData?.redirect_url);

  } catch (error) {
    console.error("Unexpected error:", error);
    let redirectUrl: string | undefined;
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get("state");
      if (state) redirectUrl = JSON.parse(atob(state))?.redirect_url;
    } catch { /* ignore */ }
    return buildRedirectResponse(false, "Erro interno não esperado no servidor.", 0, redirectUrl);
  }
});
