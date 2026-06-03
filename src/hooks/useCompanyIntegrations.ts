import { useQuery } from "@tanstack/react-query";
import { supabase, type Integration } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/lib/supabasePaginate";

export interface IntegrationMetrics {
  campaignsCount: number;
  creativesCount: number;
  totalSpend: number;
}

export type IntegrationWithMetrics = Integration & { metrics?: IntegrationMetrics };

export function useCompanyIntegrations(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['company-integrations', companyId],
    queryFn: async () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      const { data: integrations, error: intError } = await supabase
        .from('integrations')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false });

      if (intError) throw intError;

      const filteredIntegrations = integrations || [];

      const campaigns = await fetchAllPaginated<{ id: string; integration_id: string | null; spend: number | null }>(() =>
        supabase
          .from('campaigns')
          .select('id, integration_id, spend')
          .eq('company_id', companyId),
      );

      const creatives = await fetchAllPaginated<{ campaign_id: string | null }>(() =>
        supabase
          .from('creatives')
          .select('campaign_id')
          .eq('company_id', companyId),
      );

      const campaignsByIntegration = new Map<string, typeof campaigns>();
      for (const campaign of campaigns) {
        if (!campaign.integration_id) continue;
        const list = campaignsByIntegration.get(campaign.integration_id) ?? [];
        list.push(campaign);
        campaignsByIntegration.set(campaign.integration_id, list);
      }

      const creativeCountByCampaign = new Map<string, number>();
      for (const creative of creatives) {
        if (!creative.campaign_id) continue;
        creativeCountByCampaign.set(
          creative.campaign_id,
          (creativeCountByCampaign.get(creative.campaign_id) ?? 0) + 1,
        );
      }

      const integrationsWithMetrics = filteredIntegrations.map((integration) => {
        if (integration.status === 'disconnected') {
          return {
            ...integration,
            metrics: { campaignsCount: 0, creativesCount: 0, totalSpend: 0 },
          };
        }

        const integrationCampaigns = campaignsByIntegration.get(integration.id) ?? [];
        const creativesCount = integrationCampaigns.reduce(
          (sum, c) => sum + (creativeCountByCampaign.get(c.id) ?? 0),
          0,
        );
        const totalSpend = integrationCampaigns.reduce(
          (sum, c) => sum + (Number(c.spend) || 0),
          0,
        );

        return {
          ...integration,
          metrics: {
            campaignsCount: integrationCampaigns.length,
            creativesCount,
            totalSpend,
          },
        };
      });

      return integrationsWithMetrics as IntegrationWithMetrics[];
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}

// Hook para calcular dias até expiração do token
export function calculateDaysUntilExpiry(tokenExpiresAt: string | null): number {
  if (!tokenExpiresAt) return -1;

  const now = new Date();
  const expiryDate = new Date(tokenExpiresAt);
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// Hook para verificar status da integração
export function getIntegrationStatus(integration: Integration): {
  status: 'connected' | 'expiring' | 'expired' | 'disconnected';
  label: string;
  variant: 'default' | 'warning' | 'destructive' | 'secondary';
} {
  if (integration.status === 'inactive' || integration.status === 'disconnected') {
    return {
      status: 'disconnected',
      label: 'Desconectado',
      variant: 'destructive',
    };
  }

  const daysUntilExpiry = calculateDaysUntilExpiry(integration.token_expires_at);

  if (daysUntilExpiry < 0) {
    return {
      status: 'expired',
      label: 'Token Expirado',
      variant: 'destructive',
    };
  }

  if (daysUntilExpiry < 7) {
    return {
      status: 'expiring',
      label: `Expira em ${daysUntilExpiry} dia${daysUntilExpiry === 1 ? '' : 's'}`,
      variant: 'secondary',
    };
  }

  return {
    status: 'connected',
    label: 'Conectado',
    variant: 'default',
  };
}
