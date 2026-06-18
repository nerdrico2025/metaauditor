import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from './types';

export const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY');

// Tipado como `any` propositalmente: os tipos gerados em `./types` estão desatualizados
// em relação ao schema real (faltam tabelas como creative_rules, account_period_reach
// e colunas como is_monitored, sync_preferences, ai_context). Isso evita uma cascata
// de "Argument of type 'X' is not assignable to parameter of type 'never'".
// Os type aliases (Company, Campaign, etc) continuam funcionando via `Tables<...>`.
export const supabase: any = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
    Database['public']['Enums'][T];

// Convenience type exports
export type Company = Tables<'companies'>;
export type User = Tables<'users'>;
export type Campaign = Tables<'campaigns'>;
export type AdSet = Tables<'ad_sets'>;
export type Creative = Tables<'creatives'>;
export type Audit = Tables<'audits'>;
export type Policy = Tables<'policies'>;
export type Integration = Tables<'integrations'>;
/** Integration row safe for browser — excludes OAuth tokens. */
export type IntegrationClient = Omit<Integration, 'access_token' | 'refresh_token'>;
export type Notification = Tables<'notifications'>;

export type UserRole = Enums<'user_role'>;
export type CompanyStatus = Enums<'company_status'>;
export type SubscriptionPlan = Enums<'subscription_plan'>;
export type NotificationType = Enums<'notification_type'>;
