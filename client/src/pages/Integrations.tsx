import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ExternalLink,
  Database,
  Zap,
  FileSpreadsheet
} from "lucide-react";

interface SyncStatus {
  recordCount: number;
  lastSyncBatch?: string;
  latestRecord?: string;
}

interface SyncResult {
  success: boolean;
  totalDownloaded: number;
  totalProcessed: number;
  totalInserted: number;
  completionPercentage: number;
}

export default function Integrations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você está desconectado. Redirecionando para login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: syncStatus, isLoading: statusLoading, error } = useQuery<{ data: { syncStatus: SyncStatus } }>({
    queryKey: ["/api/sync/status"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/sync-single-tab-now");
    },
    onSuccess: (data: SyncResult) => {
      toast({
        title: "Sincronização Concluída",
        description: `${data.totalInserted} registros foram importados com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-metrics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Não autorizado",
          description: "Você está desconectado. Redirecionando para login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao sincronizar dados da planilha",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Não autorizado",
        description: "Você está desconectado. Redirecionando para login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca sincronizado';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadge = (recordCount: number) => {
    if (recordCount > 0) {
      return (
        <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
          <CheckCircle className="w-3 h-3 mr-1" />
          Conectado
        </Badge>
      );
    } else {
      return (
        <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
          <Clock className="w-3 h-3 mr-1" />
          Aguardando dados
        </Badge>
      );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Fonte de Dados" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Fonte de Dados Reais</h1>
                <p className="text-slate-600 mt-1">
                  Dados importados diretamente da planilha oficial do Meta Ads
                </p>
              </div>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sincronizar Agora
              </Button>
            </div>

            {/* Information Card */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Zap className="h-5 w-5" />
                  Dados 100% Reais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-green-700">
                  <p className="mb-3">
                    Esta aplicação está configurada para trabalhar exclusivamente com dados reais 
                    do Meta Ads, importados diretamente da planilha oficial. Nenhum dado de teste 
                    ou simulação é utilizado.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Fonte dos Dados:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Planilha Google Sheets oficial</li>
                        <li>Dados reais de campanhas Meta Ads</li>
                        <li>Sincronização automática disponível</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Métricas Disponíveis:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Impressões, cliques e investimento</li>
                        <li>CPM, CPC e conversas iniciadas</li>
                        <li>Performance por campanha e anúncio</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Source Status */}
            {statusLoading ? (
              <Card>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ) : (
              <Card className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-lg">
                          Google Sheets - Meta Ads
                        </CardTitle>
                        <p className="text-sm text-slate-500">
                          Planilha oficial com dados reais de campanhas
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(syncStatus?.data?.syncStatus?.recordCount || 0)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Total de Registros:</span>
                        <div className="text-xl font-bold text-primary mt-1">
                          {syncStatus?.data?.syncStatus?.recordCount || 0}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Último Lote:</span>
                        <div className="text-sm font-mono mt-1">
                          {syncStatus?.data?.syncStatus?.lastSyncBatch || 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Último Registro:</span>
                        <div className="text-sm mt-1">
                          {formatDate(syncStatus?.data?.syncStatus?.latestRecord)}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                        <ExternalLink className="h-4 w-4" />
                        <span>Planilha fonte disponível em:</span>
                      </div>
                      <a 
                        href="https://docs.google.com/spreadsheets/d/1mOPjhRhBUP60GzZm0NAuUSYGzlE1bDbi414iYtlwZkA/edit?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 text-sm font-medium"
                      >
                        Ver planilha no Google Sheets →
                      </a>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <Button
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isPending}
                        className="w-full"
                        variant="outline"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Dados'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Note about API integrations */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  Integrações por API Desabilitadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-700">
                  As integrações diretas com Meta e Google Ads via API estão temporariamente 
                  desabilitadas. O sistema está configurado para trabalhar exclusivamente 
                  com dados reais importados da planilha oficial, garantindo total 
                  transparência e autenticidade dos dados exibidos.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}