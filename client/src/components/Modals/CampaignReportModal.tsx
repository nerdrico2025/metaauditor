import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  Calendar,
  Download,
  X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { Campaign, CampaignMetrics } from "@shared/schema";

interface CampaignReportModalProps {
  campaign: Campaign;
  onClose: () => void;
}

interface CampaignReportData {
  campaign: Campaign;
  metrics: CampaignMetrics[];
}

export default function CampaignReportModal({
  campaign,
  onClose,
}: CampaignReportModalProps) {
  const { data: reportData, isLoading, error } = useQuery<CampaignReportData>({
    queryKey: [`/api/campaigns/${campaign.id}/metrics`],
  });

  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Calculate aggregated metrics
  const aggregatedMetrics = reportData?.metrics.reduce(
    (acc, metric) => ({
      totalImpressions: acc.totalImpressions + (metric.impressoes || 0),
      totalClicks: acc.totalClicks + (metric.cliques || 0),
      totalInvestment: acc.totalInvestment + parseFloat(metric.investimento || '0'),
      totalConversations: acc.totalConversations + (metric.conversasIniciadas || 0),
      avgCPM: (acc.avgCPM + parseFloat(metric.cpm || '0')) / 2,
      avgCPC: (acc.avgCPC + parseFloat(metric.cpc || '0')) / 2,
      avgCostPerConversation: (acc.avgCostPerConversation + parseFloat(metric.custoConversa || '0')) / 2,
    }),
    {
      totalImpressions: 0,
      totalClicks: 0,
      totalInvestment: 0,
      totalConversations: 0,
      avgCPM: 0,
      avgCPC: 0,
      avgCostPerConversation: 0,
    }
  ) || {
    totalImpressions: 0,
    totalClicks: 0,
    totalInvestment: 0,
    totalConversations: 0,
    avgCPM: 0,
    avgCPC: 0,
    avgCostPerConversation: 0,
  };

  const ctr = aggregatedMetrics.totalImpressions > 0 
    ? (aggregatedMetrics.totalClicks / aggregatedMetrics.totalImpressions) * 100 
    : 0;

  // Prepare chart data - group by date
  const chartData = reportData?.metrics
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .map(metric => ({
      date: new Date(metric.data).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      }),
      impressions: metric.impressoes || 0,
      clicks: metric.cliques || 0,
      investment: parseFloat(metric.investimento || '0'),
      conversations: metric.conversasIniciadas || 0,
    })) || [];

  // Performance indicators (simplified for deployment)
  const getPerformanceLabel = () => {
    if (ctr > 2) return { label: 'Alto', color: 'text-green-600' };
    if (ctr >= 1) return { label: 'Médio', color: 'text-yellow-600' };
    return { label: 'Baixo', color: 'text-red-600' };
  };
  
  const performance = getPerformanceLabel();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Relatório da Campanha
              </DialogTitle>
              <DialogDescription className="text-slate-600 mt-1">
                {campaign.name} • {campaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Erro ao carregar relatório
              </h3>
              <p className="text-slate-600">
                Não foi possível carregar os dados da campanha. Tente novamente.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex justify-center space-x-2">
                {(['7d', '30d', '90d'] as const).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : '90 dias'}
                  </Button>
                ))}
              </div>

              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Impressões</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {aggregatedMetrics.totalImpressions.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Eye className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Cliques</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {aggregatedMetrics.totalClicks.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <MousePointer className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">CTR</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {ctr.toFixed(2)}%
                        </p>
                        <div className="flex items-center mt-1">
                          {ctr > 2 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                          )}
                          <Badge variant={ctr > 2 ? "default" : "destructive"} className="text-xs">
                            {ctr > 2 ? "Alto" : ctr >= 1 ? "Médio" : "Baixo"}
                          </Badge>
                        </div>
                      </div>
                      <Target className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Investimento</p>
                        <p className="text-2xl font-bold text-slate-900">
                          R$ {aggregatedMetrics.totalInvestment.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Performance ao Longo do Tempo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Line 
                            type="monotone" 
                            dataKey="impressions" 
                            stroke="#cf6f03" 
                            strokeWidth={2}
                            name="Impressões"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="clicks" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            name="Cliques"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Investment Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Investimento e Conversações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Bar dataKey="investment" fill="#cf6f03" name="Investimento (R$)" />
                          <Bar dataKey="conversations" fill="#10b981" name="Conversações" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">CPM Médio</p>
                      <p className="text-xl font-bold text-slate-900">
                        R$ {aggregatedMetrics.avgCPM.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">CPC Médio</p>
                      <p className="text-xl font-bold text-slate-900">
                        R$ {aggregatedMetrics.avgCPC.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">Conversações</p>
                      <p className="text-xl font-bold text-slate-900">
                        {aggregatedMetrics.totalConversations}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Insights da Campanha</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ctr > 2 && (
                      <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-900">Performance Excelente</p>
                          <p className="text-sm text-green-700">
                            Sua campanha está com CTR de {ctr.toFixed(2)}%, muito acima da média do mercado.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {ctr < 1 && (
                      <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-900">Performance Baixa</p>
                          <p className="text-sm text-red-700">
                            CTR de {ctr.toFixed(2)}% está abaixo do ideal. Considere revisar os criativos.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Investimento Total</p>
                        <p className="text-sm text-blue-700">
                          R$ {aggregatedMetrics.totalInvestment.toFixed(2)} investidos com {aggregatedMetrics.totalConversations} conversações iniciadas.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}