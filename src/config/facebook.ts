/**
 * Facebook OAuth Configuration
 *
 * PRODUÇÃO: Configure VITE_META_APP_ID e VITE_SUPABASE_URL nas variáveis de ambiente.
 * DESENVOLVIMENTO: Use o arquivo .env local
 */

import { requireEnv } from '@/lib/env';

const META_APP_ID_FROM_ENV = import.meta.env.VITE_META_APP_ID;

export const FACEBOOK_CONFIG = {
  appId:
    META_APP_ID_FROM_ENV && META_APP_ID_FROM_ENV !== 'your_facebook_app_id_here'
      ? META_APP_ID_FROM_ENV
      : '',

  getRedirectUri: () => {
    const url = requireEnv('VITE_SUPABASE_URL');
    return `${url}/functions/v1/meta-oauth-callback`;
  },

  scope: [
    'ads_read',
    'ads_management',
    'business_management',
    'pages_read_engagement',
    'leads_retrieval',
    'email',
    'public_profile',
  ],

  isConfigured: () => {
    const appId = FACEBOOK_CONFIG.appId;
    return appId.length > 0 && appId !== 'your_facebook_app_id_here';
  },
};

if (import.meta.env.DEV) {
  console.log('Facebook Config:', {
    appIdConfigured: !!FACEBOOK_CONFIG.appId,
    redirectUri: FACEBOOK_CONFIG.getRedirectUri(),
    isConfigured: FACEBOOK_CONFIG.isConfigured(),
  });
}
