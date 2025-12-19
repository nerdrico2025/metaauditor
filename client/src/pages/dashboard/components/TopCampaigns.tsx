import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";
import { useMetaAccount } from "@/contexts/MetaAccountContext";

interface TopCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  platform: string;
}

export default function TopCampaigns() {
  const [, setLocation] = useLocation();
  const { selectedAccountId } = useMetaAccount();
  
  const { data: campaigns, isLoading } = useQuery<TopCampaign[]>({
    queryKey: ["/api/dashboard/top-campaigns", { integrationId: selectedAccountId }],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const url = selectedAccountId 
        ? `/api/dashboard/top-campaigns?integrationId=${selectedAccountId}`
        : '/api/dashboard/top-campaigns';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao carregar top campanhas');
      return res.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const maxSpend = Math.max(...(campaigns?.map(c => c.spend) || [1]));

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'ativo' || statusLower === 'active') {
      return <Badge className="bg-green-100 text-green-800 text-xs">Ativo</Badge>;
    }
    if (statusLower === 'pausado' || statusLower === 'paused') {
      return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pausado</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-800 text-xs">{status}</Badge>;
  };

  return (
    <Card className="bg-white dark:bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200 bg-white dark:bg-white flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium text-slate-900">
          Top Campanhas por Gasto
        </CardTitle>
        <Button 
          variant="link" 
          className="text-primary hover:text-primary/80 text-sm font-medium p-0"
          onClick={() => setLocation("/campaigns")}
          data-testid="button-view-all-campaigns"
        >
          Ver todas
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-2 w-full" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign, index) => {
              const spendPercentage = maxSpend > 0 ? (campaign.spend / maxSpend) * 100 : 0;
              
              return (
                <div 
                  key={campaign.id} 
                  className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setLocation("/campaigns")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-400">#{index + 1}</span>
                      <p className="text-sm font-medium text-slate-900 truncate">{campaign.name}</p>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 ml-2">
                      {formatCurrency(campaign.spend)}
                    </p>
                  </div>
                  
                  <Progress value={spendPercentage} className="h-1.5 mb-2" />
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>{formatNumber(campaign.impressions)} impressões</span>
                      <span>{formatNumber(campaign.clicks)} cliques</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {campaign.ctr >= 1 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={campaign.ctr >= 1 ? 'text-green-600' : 'text-red-600'}>
                        {campaign.ctr.toFixed(2)}% CTR
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Nenhuma campanha encontrada</p>
            <p className="text-xs text-slate-500">Conecte suas contas para ver as campanhas</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
