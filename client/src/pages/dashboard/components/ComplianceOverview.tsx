import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useMetaAccount } from "@/contexts/MetaAccountContext";

interface ComplianceStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  complianceRate: number;
}

export default function ComplianceOverview() {
  const { selectedAccountId } = useMetaAccount();
  
  const { data: stats, isLoading } = useQuery<ComplianceStats>({
    queryKey: ["/api/dashboard/compliance-stats", { integrationId: selectedAccountId }],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const url = selectedAccountId 
        ? `/api/dashboard/compliance-stats?integrationId=${selectedAccountId}`
        : '/api/dashboard/compliance-stats';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao carregar estatísticas de conformidade');
      return res.json();
    },
  });

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceBg = (rate: number) => {
    if (rate >= 90) return 'bg-green-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="bg-white dark:bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200 bg-white dark:bg-white">
        <CardTitle className="text-lg font-medium text-slate-900">
          Visão Geral de Conformidade
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-full mx-auto" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
        ) : stats ? (
          <>
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke={stats.complianceRate >= 90 ? '#22c55e' : stats.complianceRate >= 70 ? '#eab308' : '#ef4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${stats.complianceRate * 3.01} 301`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${getComplianceColor(stats.complianceRate)}`}>
                    {stats.complianceRate.toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-500">Conforme</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {stats.total} criativos analisados
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-semibold text-green-600">{stats.compliant}</p>
                <p className="text-xs text-slate-500">Conformes</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-semibold text-red-600">{stats.nonCompliant}</p>
                <p className="text-xs text-slate-500">Não Conformes</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <Clock className="h-5 w-5 text-slate-600 mx-auto mb-1" />
                <p className="text-lg font-semibold text-slate-600">{stats.pending}</p>
                <p className="text-xs text-slate-500">Pendentes</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Sem dados de conformidade</p>
            <p className="text-xs text-slate-500">Execute análises de IA para ver os resultados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
