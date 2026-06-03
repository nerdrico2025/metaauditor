/**
 * Facebook OAuth Configuration
 *
 * Esta configuração permite usar variáveis de ambiente do Lovable
 * ou fallback para valores configurados diretamente (menos seguro).
 *
 * PRODUÇÃO: Configure VITE_META_APP_ID nas Environment Variables do Lovable
 * DESENVOLVIMENTO: Use o arquivo .env local
 */

// Tenta pegar do ambiente (Lovable ou .env)
const META_APP_ID_FROM_ENV = import.meta.env.VITE_META_APP_ID;

// Fallback: Configure aqui temporariamente se o Lovable não suportar env vars
// ATENÇÃO: Isso expõe o App ID no código (não é ideal, mas funciona)
const META_APP_ID_FALLBACK = "1314312457392291";

export const FACEBOOK_CONFIG = {
  // Usa env var se disponível, senão usa fallback
  appId: META_APP_ID_FROM_ENV && META_APP_ID_FROM_ENV !== 'your_facebook_app_id_here'
    ? META_APP_ID_FROM_ENV
    : META_APP_ID_FALLBACK,

  // URL de redirect (sempre aponta pro Supabase Edge Function)
  getRedirectUri: () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ejxlhstosdrryzrmfsbm.supabase.co';
    return `${supabaseUrl}/functions/v1/meta-oauth-callback`;
  },

  // Permissões solicitadas ao Facebook
  // Apenas permissões aprovadas pela Meta + ads_read (pendente de novo screencast)
  scope: [
    'ads_read',              // CRÍTICA - Requer novo screencast para aprovação
    'ads_management',        // ✅ Aprovada - Gerenciar anúncios
    'business_management',   // ✅ Aprovada - Gerenciar ativos comerciais
    'pages_read_engagement', // ✅ Aprovada - Ler engajamento de páginas
    'leads_retrieval',       // ✅ Aprovada - Recuperar leads
    'email',                 // ✅ Aprovada - Email do usuário
    'public_profile'         // ✅ Aprovada - Perfil público
  ],

  // Verifica se está configurado corretamente
  isConfigured: () => {
    const appId = FACEBOOK_CONFIG.appId;
    return appId && appId !== 'your_facebook_app_id_here' && appId.length > 0;
  }
};

// Log de debug (sempre ativo para facilitar troubleshooting)
console.log('🔧 Facebook Config:', {
  appId: FACEBOOK_CONFIG.appId,
  redirectUri: FACEBOOK_CONFIG.getRedirectUri(),
  isConfigured: FACEBOOK_CONFIG.isConfigured(),
  source: META_APP_ID_FROM_ENV ? 'environment' : 'fallback',
  supabaseUrlSource: import.meta.env.VITE_SUPABASE_URL ? 'environment' : 'fallback'
});
