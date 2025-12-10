import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMetaAccount } from "@/contexts/MetaAccountContext";

interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export default function PerformanceChart() {
  const { selectedAccountId } = useMetaAccount();
  
  const { data: metrics, isLoading } = useQuery<DailyMetric[]>({
    queryKey: ["/api/dashboard/daily-metrics", { integrationId: selectedAccountId }],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const url = selectedAccountId 
        ? `/api/dashboard/daily-metrics?integrationId=${selectedAccountId}`
        : '/api/dashboard/daily-metrics';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao carregar métricas diárias');
      return res.json();
    },
  });

  const totalSpend = metrics?.reduce((sum, m) => sum + m.spend, 0) || 0;
  const totalImpressions = metrics?.reduce((sum, m) => sum + m.impressions, 0) || 0;
  const totalClicks = metrics?.reduce((sum, m) => sum + m.clicks, 0) || 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const maxSpend = Math.max(...(metrics?.map(m => m.spend) || [1]));

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

  return (
    <Card className="bg-white dark:bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200 bg-white dark:bg-white">
        <CardTitle className="text-lg font-medium text-slate-900">
          Performance dos Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-32" />
          </div>
        ) : metrics && metrics.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Gasto Total</p>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(totalSpend)}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Impressões</p>
                <p className="text-lg font-semibold text-purple-600">{formatNumber(totalImpressions)}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Cliques</p>
                <p className="text-lg font-semibold text-green-600">{formatNumber(totalClicks)}</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">CTR Médio</p>
                <p className="text-lg font-semibold text-orange-600">{avgCtr.toFixed(2)}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">Gastos por dia</p>
              <div className="flex items-end justify-between h-24 gap-1">
                {metrics.map((day, index) => {
                  const height = maxSpend > 0 ? (day.spend / maxSpend) * 100 : 0;
                  const date = new Date(day.date);
                  const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
                  
                  return (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${formatCurrency(day.spend)}`}
                      />
                      <span className="text-xs text-slate-400 mt-1 capitalize">{dayName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Minus className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Sem dados de performance</p>
            <p className="text-xs text-slate-500">Sincronize suas campanhas para ver as métricas</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
