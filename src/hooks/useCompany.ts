import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BrandBriefing {
    completed_at?: string;
    brand_promise?: string;
    brand_personality?: string;
    visual_identity?: string;
    logo_usage?: string;
    tone_in_ads?: string;
    mandatory_elements?: string;
    forbidden_practices?: string;
    audience_perception?: string;
    reference_notes?: string;
}

export interface CompanyAiContext {
    business_description?: string;
    target_audience?: string;
    tone_of_voice?: string;
    key_offers?: string;
    dos_and_donts?: string;
    target_metrics?: { ctr_min?: number; cpc_max?: number; cpa_target?: number };
    extra_context?: string;
    brand_briefing?: BrandBriefing;
}

export const emptyBrandBriefing: BrandBriefing = {
    brand_promise: '',
    brand_personality: '',
    visual_identity: '',
    logo_usage: '',
    tone_in_ads: '',
    mandatory_elements: '',
    forbidden_practices: '',
    audience_perception: '',
    reference_notes: '',
};

export function isBrandBriefingComplete(briefing?: BrandBriefing | null): boolean {
    if (!briefing) return false;
    return !!(
        briefing.brand_promise?.trim() &&
        briefing.visual_identity?.trim() &&
        briefing.tone_in_ads?.trim()
    );
}

// Usando tipos compatíveis com schema Supabase
export interface Company {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    max_campaigns: number;
    max_integrations: number;
    max_users: number;
    created_at: string;
    ai_context: CompanyAiContext | null;
}

export interface UpdateCompanyInput {
    name?: string;
    logo_url?: string | null;
    ai_context?: CompanyAiContext | null;
}

export function useCompany() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['company', companyId],
        queryFn: async (): Promise<Company> => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('companies')
                .select('id, name, slug, logo_url, max_campaigns, max_integrations, max_users, created_at, ai_context')
                .eq('id', companyId)
                .single();

            if (error) throw error;
            return data as Company;
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useUpdateCompany() {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (updates: UpdateCompanyInput) => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('companies')
                .update(updates)
                .eq('id', companyId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company'] });
            toast({
                title: 'Empresa atualizada',
                description: 'As configurações foram salvas.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Erro ao atualizar',
                description: String(error),
                variant: 'destructive',
            });
        },
    });
}

export function useCompanyStats() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['company-stats', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const [campaigns, integrations, users, audits] = await Promise.all([
                supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
                supabase.from('integrations').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
                supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
                supabase.from('audits').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
            ]);

            return {
                totalCampaigns: campaigns.count || 0,
                activeIntegrations: integrations.count || 0,
                totalUsers: users.count || 0,
                totalAudits: audits.count || 0,
            };
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}
