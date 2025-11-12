import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, RefreshCw, CheckCircle2, AlertCircle, Info, ExternalLink, HelpCircle, Clock, Database } from 'lucide-react';
import { SiFacebook, SiGoogle } from 'react-icons/si';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Integration {
  id: string;
  platform: string;
  accountId: string | null;
  accountName: string | null;
  accountStatus: string | null;
  status: string;
  lastSync: Date | null;
  lastFullSync: Date | null;
  createdAt: Date;
}

interface SyncHistoryItem {
  id: string;
  integrationId: string;
  status: string;
  type: string;
  startedAt: Date;
  completedAt: Date | null;
  campaignsSynced: number;
  adSetsSynced: number;
  creativeSynced: number;
  errorMessage: string | null;
}

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [howToConnectOpen, setHowToConnectOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google'>('meta');
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [deleteAllData, setDeleteAllData] = useState(false);

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const { data: syncHistory = [] } = useQuery<SyncHistoryItem[]>({
    queryKey: ['/api/integrations/sync-history'],
    enabled: !!user,
  });

  const syncIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/integrations/${id}/sync`, { method: 'POST' });
      return { started: true };
    },
    onSuccess: () => {
      toast({ 
        title: '🔄 Sincronização iniciada!',
        description: 'O processo está rodando. Atualize a página em alguns minutos para ver os resultados.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao iniciar sincronização',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: string) => {
      const url = deleteAllData 
        ? `/api/integrations/${id}?deleteData=true`
        : `/api/integrations/${id}`;
      return apiRequest(url, { method: 'DELETE' });
    },
    onSuccess: () => {
      const message = deleteAllData
        ? '✓ Integração e todos os dados foram excluídos permanentemente'
        : '✓ Integração removida. Os dados foram preservados.';
      
      toast({ title: message });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      setDeleteDialogOpen(false);
      setIntegrationToDelete(null);
      setDeleteAllData(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao excluir integração',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleConnectMetaOAuth = async () => {
    try {
      setIsConnectingMeta(true);
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        'about:blank',
        'MetaOAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=0,scrollbars=1,status=0,resizable=1,location=1,menuBar=0`
      );
      
      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description: 'Por favor, permita popups para este site e tente novamente.',
          variant: 'destructive'
        });
        setIsConnectingMeta(false);
        return;
      }

      popup.document.write(`
        <html>
          <head><title>Conectando...</title></head>
          <body style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; background: #f5f5f5;">
            <div style="text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
              <h2 style="margin: 0; color: #333;">Conectando ao Meta...</h2>
              <p style="color: #666;">Aguarde um momento...</p>
            </div>
          </body>
        </html>
      `);

      const data = await apiRequest('/api/auth/meta/connect');
      
      if (data.authUrl) {
        popup.location.href = data.authUrl;

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'META_OAUTH_SUCCESS') {
            toast({
              title: 'Conectado com sucesso!',
              description: 'Sua conta Meta Ads foi conectada.',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
            setIsConnectingMeta(false);
            window.removeEventListener('message', handleMessage);
          } else if (event.data.type === 'META_OAUTH_ERROR') {
            toast({
              title: 'Erro ao conectar',
              description: event.data.message || 'Ocorreu um erro durante a autenticação',
              variant: 'destructive'
            });
            setIsConnectingMeta(false);
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnectingMeta(false);
            window.removeEventListener('message', handleMessage);
          }
        }, 1000);
      } else {
        popup.close();
        toast({
          title: 'Erro ao conectar',
          description: data.error || 'Não foi possível gerar a URL de autenticação',
          variant: 'destructive'
        });
        setIsConnectingMeta(false);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Erro ao iniciar processo de autenticação OAuth',
        variant: 'destructive'
      });
      setIsConnectingMeta(false);
    }
  };

  const formatDate = (date: Date | null | string | undefined) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (date: Date | null | string | undefined) => {
    if (!date) return 'Nunca';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const googleIntegrations = integrations.filter(i => i.platform === 'google');

  const HowToConnectModal = () => (
    <Dialog open={howToConnectOpen} onOpenChange={setHowToConnectOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedPlatform === 'meta' ? (
              <>
                <SiFacebook className="w-5 h-5 text-blue-600" />
                Como Conectar - Meta Ads
              </>
            ) : (
              <>
                <SiGoogle className="w-5 h-5 text-red-600" />
                Como Conectar - Google Ads
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Siga o passo-a-passo para conectar sua conta de anúncios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {selectedPlatform === 'meta' ? (
            <>
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  <strong>✨ Conexão 100% Automática via OAuth</strong><br />
                  Clique em "Conectar", faça login no Facebook e pronto! O sistema faz tudo automaticamente.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Clique em "Conectar com Meta"</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Uma janela será aberta automaticamente para autenticação
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Faça login no Facebook</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Use suas credenciais do Facebook Business Manager
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Autorize o acesso</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Permita que o Click Auditor acesse suas contas de anúncios
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Selecione suas contas</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Escolha quais contas de anúncios você deseja conectar
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">5</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Pronto!</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Suas campanhas serão sincronizadas automaticamente
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-900 dark:text-purple-100">
                  <strong>✅ Vantagens do OAuth:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Conexão segura sem expor tokens</li>
                    <li>Tokens renovados automaticamente (60 dias)</li>
                    <li>Selecione múltiplas contas de anúncios</li>
                    <li>Processo em menos de 1 minuto</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900 dark:text-amber-100">
                  <strong>⚠️ Google Ads requer configuração manual</strong><br />
                  O processo é mais técnico e pode levar alguns minutos.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">1</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Acesse o Google Cloud Console</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Crie ou selecione um projeto no Google Cloud
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Google Cloud Console
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">2</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Ative a Google Ads API</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No menu lateral: <strong>APIs e Serviços → Biblioteca</strong><br />
                      Pesquise por "Google Ads API" e ative
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">3</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Configure OAuth 2.0</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Navegue até: <strong>APIs e Serviços → Credenciais</strong><br />
                      Crie credenciais do tipo "ID do cliente OAuth 2.0"
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Gerenciar Credenciais
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">4</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Obtenha o Customer ID</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Acesse sua conta Google Ads e copie o Customer ID<br />
                      Formato: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">123-456-7890</code>
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Google Ads
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setHowToConnectOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const DeleteConfirmationDialog = () => (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover Integração</DialogTitle>
          <DialogDescription>
            Escolha como deseja remover esta integração
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>Apenas desconectar:</strong><br />
              Remove a conexão mas mantém todas as campanhas, ad sets e criativos já sincronizados.
            </AlertDescription>
          </Alert>

          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900 dark:text-red-100">
              <strong>Excluir todos os dados:</strong><br />
              Remove a conexão E exclui permanentemente todas as campanhas, ad sets, criativos, imagens e auditorias associadas.
            </AlertDescription>
          </Alert>

          <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => setDeleteAllData(!deleteAllData)}>
            <input
              type="checkbox"
              checked={deleteAllData}
              onChange={(e) => setDeleteAllData(e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-delete-all-data"
            />
            <Label className="cursor-pointer flex-1">
              <div className="font-semibold">Excluir todos os dados</div>
              <div className="text-sm text-gray-500">
                Esta ação é irreversível e apagará tudo relacionado a esta conta
              </div>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setDeleteDialogOpen(false);
            setIntegrationToDelete(null);
            setDeleteAllData(false);
          }}>
            Cancelar
          </Button>
          <Button
            variant={deleteAllData ? "destructive" : "default"}
            onClick={() => integrationToDelete && deleteIntegrationMutation.mutate(integrationToDelete.id)}
            disabled={deleteIntegrationMutation.isPending}
            data-testid="button-confirm-delete"
          >
            {deleteIntegrationMutation.isPending ? 'Removendo...' : deleteAllData ? 'Excluir Tudo' : 'Desconectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Conecte suas contas de anúncios para sincronizar campanhas e criativos automaticamente
                </p>
              </div>

              <Tabs defaultValue="meta" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="meta" className="flex items-center gap-2">
                    <SiFacebook className="w-4 h-4" />
                    Meta Ads
                  </TabsTrigger>
                  <TabsTrigger value="google" className="flex items-center gap-2">
                    <SiGoogle className="w-4 h-4" />
                    Google Ads
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="meta" className="space-y-6">
                  <Card>
                    <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                            <SiFacebook className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle>Meta Ads</CardTitle>
                            <CardDescription>Facebook & Instagram</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPlatform('meta');
                              setHowToConnectOpen(true);
                            }}
                            data-testid="button-how-to-connect-meta"
                          >
                            <HelpCircle className="w-4 h-4 mr-2" />
                            Como Conectar
                          </Button>
                          <Button 
                            onClick={handleConnectMetaOAuth} 
                            size="sm"
                            disabled={isConnectingMeta}
                            data-testid="button-connect-meta-oauth"
                          >
                            <SiFacebook className="w-4 h-4 mr-2" />
                            {isConnectingMeta ? 'Conectando...' : 'Conectar Conta'}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {metaIntegrations.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                            <SiFacebook className="w-8 h-8 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Nenhuma conta conectada
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Conecte sua conta Meta Ads para começar a sincronizar campanhas
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {metaIntegrations.map((integration) => {
                            const integrationHistory = syncHistory.filter(h => h.integrationId === integration.id).slice(0, 3);
                            
                            return (
                              <div key={integration.id} className="border rounded-lg p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {integration.accountName || 'Conta Meta Ads'}
                                      </h3>
                                      <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                                        {integration.status === 'active' ? (
                                          <>
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Ativa
                                          </>
                                        ) : (
                                          <>
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Inativa
                                          </>
                                        )}
                                      </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-500">Account ID:</span>
                                        <p className="font-mono text-gray-900 dark:text-white">{integration.accountId}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Última Sincronização:</span>
                                        <p className="text-gray-900 dark:text-white">{formatRelativeTime(integration.lastSync)}</p>
                                      </div>
                                      {integration.lastFullSync && (
                                        <div>
                                          <span className="text-gray-500">Última Sinc. Completa:</span>
                                          <p className="text-gray-900 dark:text-white">{formatRelativeTime(integration.lastFullSync)}</p>
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-gray-500">Conectada em:</span>
                                        <p className="text-gray-900 dark:text-white">{formatDate(integration.createdAt)}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => syncIntegrationMutation.mutate(integration.id)}
                                      disabled={syncIntegrationMutation.isPending}
                                      data-testid={`button-sync-${integration.id}`}
                                    >
                                      <RefreshCw className={`w-4 h-4 mr-2 ${syncIntegrationMutation.isPending ? 'animate-spin' : ''}`} />
                                      Sincronizar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setIntegrationToDelete(integration);
                                        setDeleteDialogOpen(true);
                                      }}
                                      data-testid={`button-delete-${integration.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Remover
                                    </Button>
                                  </div>
                                </div>

                                {integrationHistory.length > 0 && (
                                  <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Clock className="w-4 h-4 text-gray-500" />
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Histórico Recente
                                      </h4>
                                    </div>
                                    <div className="space-y-2">
                                      {integrationHistory.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 rounded p-3">
                                          <div className="flex items-center gap-3">
                                            <Badge variant={
                                              item.status === 'completed' ? 'default' :
                                              item.status === 'failed' ? 'destructive' :
                                              item.status === 'running' ? 'secondary' : 'outline'
                                            } className="text-xs">
                                              {item.type === 'full' ? 'Completa' : 'Incremental'}
                                            </Badge>
                                            <span className="text-gray-600 dark:text-gray-400">
                                              {formatDate(item.startedAt)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>{item.campaignsSynced} campanhas</span>
                                            <span>{item.adSetsSynced} ad sets</span>
                                            <span>{item.creativeSynced} ads</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="google" className="space-y-6">
                  <Card>
                    <CardHeader className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                            <SiGoogle className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle>Google Ads</CardTitle>
                            <CardDescription>Google Search & Display</CardDescription>
                          </div>
                        </div>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPlatform('google');
                            setHowToConnectOpen(true);
                          }}
                          data-testid="button-how-to-connect-google"
                        >
                          <HelpCircle className="w-4 h-4 mr-2" />
                          Como Conectar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <SiGoogle className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Google Ads em desenvolvimento
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                          A integração com Google Ads estará disponível em breve
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      <HowToConnectModal />
      <DeleteConfirmationDialog />
    </div>
  );
}
