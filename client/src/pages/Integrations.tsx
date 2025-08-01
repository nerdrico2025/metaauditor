import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import IntegrationModal from "@/components/Modals/IntegrationModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ExternalLink,
  Zap
} from "lucide-react";
import { SiFacebook, SiGoogle } from "react-icons/si";
import type { Integration } from "@shared/schema";

export default function Integrations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const { data: integrations, isLoading: integrationsLoading, error } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    enabled: isAuthenticated,
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("POST", `/api/integrations/${integrationId}/sync`);
    },
    onSuccess: () => {
      toast({
        title: "Sincronização Iniciada",
        description: "A sincronização dos dados foi iniciada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
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
        description: "Falha ao iniciar sincronização",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/integrations/${integrationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Integração removida com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
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
        title: "Erro",
        description: "Falha ao remover integração",
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

  const handleCreateIntegration = () => {
    setSelectedIntegration(null);
    setIsModalOpen(true);
  };

  const handleEditIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsModalOpen(true);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'meta':
        return <SiFacebook className="h-6 w-6 text-blue-600" />;
      case 'google':
        return <SiGoogle className="h-6 w-6 text-red-600" />;
      default:
        return <Settings className="h-6 w-6 text-slate-400" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'Meta Ads Manager';
      case 'google':
        return 'Google Ads';
      default:
        return platform;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            <Clock className="w-3 h-3 mr-1" />
            Inativo
          </Badge>
        );
      default:
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            Reconectando
          </Badge>
        );
    }
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Nunca sincronizado';
    
    const now = new Date();
    const syncDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `há ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `há ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `há ${diffInDays}d`;
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações de Anúncios" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Contas de Anúncios</h1>
                <p className="text-slate-600 mt-1">
                  Conecte suas contas Meta e Google Ads para análise automática de criativos
                </p>
              </div>
              <Button 
                onClick={handleCreateIntegration}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Conectar Conta
              </Button>
            </div>

            {/* Instructions Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Zap className="h-5 w-5" />
                  Como Conectar suas Contas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
                  <div>
                    <h4 className="font-medium mb-2">Meta Ads Manager:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Acesse o Meta Business Manager</li>
                      <li>Gere um token de acesso com permissões de leitura</li>
                      <li>Copie o Access Token e Account ID</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Google Ads:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Configure OAuth 2.0 no Google Cloud Console</li>
                      <li>Autorize acesso à API do Google Ads</li>
                      <li>Use Client ID, Client Secret e Customer ID</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integrations List */}
            {integrationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : integrations && integrations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration) => (
                  <Card key={integration.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getPlatformIcon(integration.platform)}
                          <div>
                            <CardTitle className="text-lg">
                              {getPlatformName(integration.platform)}
                            </CardTitle>
                            <p className="text-sm text-slate-500">
                              {integration.accountId ? `ID: ${integration.accountId}` : 'Conta conectada'}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(integration.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Última sincronização:</span>
                          <br />
                          {formatLastSync(integration.lastSync ? integration.lastSync.toString() : null)}
                        </div>
                        
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Conectado em:</span>
                          <br />
                          {integration.createdAt ? new Date(integration.createdAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
                        </div>

                        <div className="flex space-x-2 pt-2 border-t border-slate-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncMutation.mutate(integration.id)}
                            disabled={syncMutation.isPending}
                            className="flex-1"
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            Sincronizar
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditIntegration(integration)}
                            className="flex-1"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Integração</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover a integração com {getPlatformName(integration.platform)}? 
                                  Esta ação não pode ser desfeita e você perderá acesso aos dados desta conta.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(integration.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <ExternalLink className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Nenhuma conta conectada
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Conecte suas contas Meta e Google Ads para começar a analisar seus criativos automaticamente.
                  </p>
                  <Button 
                    onClick={handleCreateIntegration}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Conectar Primeira Conta
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {isModalOpen && (
        <IntegrationModal
          integration={selectedIntegration}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}