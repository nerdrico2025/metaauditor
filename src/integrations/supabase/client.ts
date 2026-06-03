import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ejxlhstosdrryzrmfsbm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEwMDksImV4cCI6MjA4NTIzNzAwOX0.sMwRQmKi6VRYxsrRKJzWzum6zGM36f2ATqViYjHj-Ik';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
export type Notification = Tables<'notifications'>;

export type UserRole = Enums<'user_role'>;
export type CompanyStatus = Enums<'company_status'>;
export type SubscriptionPlan = Enums<'subscription_plan'>;
export type NotificationType = Enums<'notification_type'>;
