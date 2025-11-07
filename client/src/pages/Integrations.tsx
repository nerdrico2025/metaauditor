
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, RefreshCw, CheckCircle2, AlertCircle, Info, ExternalLink, Copy, Check } from 'lucide-react';
import { SiFacebook, SiGoogle } from 'react-icons/si';
import { Textarea } from '@/components/ui/textarea';

const metaIntegrationSchema = z.object({
  accessToken: z.string().min(1, 'Access token é obrigatório'),
  refreshToken: z.string().optional(),
  accountId: z.string().min(1, 'Account ID é obrigatório'),
});

const googleIntegrationSchema = z.object({
  accessToken: z.string().min(1, 'Access token é obrigatório'),
  refreshToken: z.string().optional(),
  accountId: z.string().min(1, 'Customer ID é obrigatório'),
});

type MetaIntegrationData = z.infer<typeof metaIntegrationSchema>;
type GoogleIntegrationData = z.infer<typeof googleIntegrationSchema>;

interface Integration {
  id: string;
  platform: string;
  accountId: string | null;
  accountName: string | null;
  accountStatus: string | null;
  status: string;
  lastSync: Date | null;
  createdAt: Date;
}

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    message: 'Iniciando sincronização...',
    campaigns: 0,
    adSets: 0,
    creatives: 0,
    hasError: false,
    errorMessage: '',
    isInProgress: false,
    currentProgress: ''
  });
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const metaForm = useForm<MetaIntegrationData>({
    resolver: zodResolver(metaIntegrationSchema),
  });

  const googleForm = useForm<GoogleIntegrationData>({
    resolver: zodResolver(googleIntegrationSchema),
  });

  const createMetaIntegrationMutation = useMutation({
    mutationFn: (data: MetaIntegrationData) => apiRequest('/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ ...data, platform: 'meta' }),
    }),
    onSuccess: () => {
      toast({ title: 'Integração Meta Ads criada com sucesso!' });
      setMetaDialogOpen(false);
      metaForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar integração Meta Ads',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const createGoogleIntegrationMutation = useMutation({
    mutationFn: (data: GoogleIntegrationData) => apiRequest('/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ ...data, platform: 'google' }),
    }),
    onSuccess: () => {
      toast({ title: 'Integração Google Ads criada com sucesso!' });
      setGoogleDialogOpen(false);
      googleForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar integração Google Ads',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const syncIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      // Store current sync ID for retry
      setCurrentSyncId(id);
      
      // Open sync modal
      setSyncModalOpen(true);
      setSyncStatus({
        message: 'Conectando à plataforma de anúncios...',
        campaigns: 0,
        adSets: 0,
        creatives: 0,
        hasError: false,
        errorMessage: ''
      });

      try {
        // Start sync
        const result = await apiRequest(`/api/integrations/${id}/sync`, { method: 'POST' });
        
        // Update final status
        setSyncStatus({
          message: 'Sincronização concluída com sucesso!',
          campaigns: result.campaigns || 0,
          adSets: result.adSets || 0,
          creatives: result.creatives || 0,
          hasError: false,
          errorMessage: ''
        });

        return result;
      } catch (error: any) {
        // Even on error, try to get partial results from error response
        const partialData = error.data || {};
        
        setSyncStatus({
          message: 'Sincronização parcial - alguns dados foram sincronizados',
          campaigns: partialData.campaigns || 0,
          adSets: partialData.adSets || 0,
          creatives: partialData.creatives || 0,
          hasError: true,
          errorMessage: 'Limite de requisições da API atingido. Aguarde alguns minutos e tente novamente para continuar.'
        });
        
        throw error;
      }
    },
    onSuccess: (data: any) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
        
        const parts = [];
        if (data.campaigns) parts.push(`${data.campaigns} campanhas`);
        if (data.adSets) parts.push(`${data.adSets} ad sets`);
        if (data.creatives) parts.push(`${data.creatives} anúncios`);
        
        toast({ 
          title: '✅ Sincronização concluída!',
          description: parts.join(', ') + ' sincronizados.'
        });
        
        setSyncModalOpen(false);
        setCurrentSyncId(null);
      }, 2000); // Keep modal open for 2s to show success
    },
    onError: (error: any) => {
      // Don't close modal on error - show partial results and retry option
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
  });

  const disableIntegrationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/integrations/${id}/disable`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✓ Integração desconectada. Os dados foram mantidos.' });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao desconectar integração',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/integrations/${id}?deleteData=true`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: '✓ Integração e todos os dados foram excluídos' });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      setDeleteDialogOpen(false);
      setIntegrationToDelete(null);
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
      
      // CRITICAL: Open popup IMMEDIATELY (synchronously) to avoid browser blocking
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      // Open blank popup window instantly
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

      // Show loading message in popup while fetching auth URL
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

      // Now fetch the auth URL asynchronously and redirect popup
      const data = await apiRequest('/api/auth/meta/connect');
      
      if (data.authUrl) {
        // Redirect popup to actual OAuth URL
        popup.location.href = data.authUrl;

        // Listen for messages from popup
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

        // Check if popup was closed manually
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

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const googleIntegrations = integrations.filter(i => i.platform === 'google');

  const MetaSetupGuide = () => (
    <div className="space-y-6">
      <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900 dark:text-green-100">
          <strong>✨ Conexão 100% Automática via OAuth</strong><br />
          Clique em "Conectar", faça login no Facebook e pronto! O sistema faz tudo automaticamente.
        </AlertDescription>
      </Alert>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          <strong>Como funciona:</strong><br />
          1. Clique no botão "Conectar"<br />
          2. Você será redirecionado para o Facebook<br />
          3. Faça login e autorize o acesso<br />
          4. Selecione suas contas de anúncios<br />
          5. Pronto! Suas campanhas serão sincronizadas automaticamente
        </AlertDescription>
      </Alert>

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
    </div>
  );

  const GoogleSetupGuide = () => (
    <div className="space-y-6">
      <Alert className="bg-red-50 dark:bg-red-950 border-red-200">
        <Info className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-900 dark:text-red-100">
          Siga o passo-a-passo abaixo para conectar sua conta Google Ads
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

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">5</div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Autorize e obtenha tokens</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Use o OAuth Playground para autorizar o acesso e obter:<br />
              • Access Token (obrigatório)<br />
              • Refresh Token (recomendado para automação)
            </p>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                OAuth 2.0 Playground
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>⚠️ Importante:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Configure corretamente o OAuth 2.0 antes de prosseguir</li>
            <li>O Refresh Token é essencial para manter a integração ativa</li>
            <li>Verifique se a Google Ads API está ativada no projeto</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Status da Integração Meta */}
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
                          {metaIntegrations.length === 0 && (
                            <Button 
                              onClick={handleConnectMetaOAuth} 
                              size="sm"
                              disabled={isConnectingMeta}
                              data-testid="button-connect-meta-oauth"
                            >
                              <SiFacebook className="w-4 h-4 mr-2" />
                              {isConnectingMeta ? 'Conectando...' : 'Conectar'}
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {metaIntegrations.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 mb-4">
                              Nenhuma conta conectada
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              Conecte sua conta Meta Ads para começar a sincronizar campanhas
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {metaIntegrations.map((integration) => (
                              <div key={integration.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                                    {integration.status === 'active' ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Conectada
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Inativa
                                      </>
                                    )}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-1">
                                  {integration.accountName && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-500">Conta:</span>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {integration.accountName}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Account ID:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">
                                      {integration.accountId}
                                    </span>
                                  </div>
                                  {integration.accountStatus && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-500">Status:</span>
                                      <span className={`font-medium ${integration.accountStatus === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                                        {integration.accountStatus === 'ACTIVE' ? '✓ Ativa' : '⚠ Desativada'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Última Sinc:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {formatDate(integration.lastSync)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Criada em:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {formatDate(integration.createdAt)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => syncIntegrationMutation.mutate(integration.id)}
                                    disabled={syncIntegrationMutation.isPending}
                                    className="flex-1"
                                  >
                                    <RefreshCw className={`w-3 h-3 mr-1 ${syncIntegrationMutation.isPending ? 'animate-spin' : ''}`} />
                                    Sincronizar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setIntegrationToDelete(integration);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Guia de Configuração Meta */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Como Conectar</CardTitle>
                        <CardDescription>
                          Siga o passo-a-passo para conectar sua conta Meta Ads
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MetaSetupGuide />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="google" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Status da Integração Google */}
                    <Card>
                      <CardHeader className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-950 dark:to-orange-900">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                              <SiGoogle className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <CardTitle>Google Ads</CardTitle>
                              <CardDescription>Google Advertising</CardDescription>
                            </div>
                          </div>
                          {googleIntegrations.length === 0 && (
                            <Button onClick={() => setGoogleDialogOpen(true)} size="sm">
                              Conectar
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {googleIntegrations.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 mb-4">
                              Nenhuma conta conectada
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              Conecte sua conta Google Ads para começar a sincronizar campanhas
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {googleIntegrations.map((integration) => (
                              <div key={integration.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                                    {integration.status === 'active' ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Conectada
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Inativa
                                      </>
                                    )}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Customer ID:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">
                                      {integration.accountId}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Última Sinc:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {formatDate(integration.lastSync)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Criada em:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {formatDate(integration.createdAt)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => syncIntegrationMutation.mutate(integration.id)}
                                    disabled={syncIntegrationMutation.isPending}
                                    className="flex-1"
                                  >
                                    <RefreshCw className={`w-3 h-3 mr-1 ${syncIntegrationMutation.isPending ? 'animate-spin' : ''}`} />
                                    Sincronizar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setIntegrationToDelete(integration);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Guia de Configuração Google */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Como Conectar</CardTitle>
                        <CardDescription>
                          Siga o passo-a-passo para conectar sua conta Google Ads
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <GoogleSetupGuide />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Modal Meta */}
              <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Conectar Meta Ads</DialogTitle>
                    <DialogDescription>
                      Preencha as credenciais da sua conta Meta Ads
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={metaForm.handleSubmit((data) => createMetaIntegrationMutation.mutate(data))}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="meta-access-token">Access Token *</Label>
                        <Textarea
                          id="meta-access-token"
                          placeholder="Cole seu Access Token aqui..."
                          className="font-mono text-sm min-h-[100px]"
                          {...metaForm.register('accessToken')}
                        />
                        {metaForm.formState.errors.accessToken && (
                          <p className="text-sm text-red-500">{metaForm.formState.errors.accessToken.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meta-account-id">Ad Account ID *</Label>
                        <Input
                          id="meta-account-id"
                          placeholder="act_123456789"
                          {...metaForm.register('accountId')}
                        />
                        {metaForm.formState.errors.accountId && (
                          <p className="text-sm text-red-500">{metaForm.formState.errors.accountId.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meta-refresh-token">Refresh Token (Opcional)</Label>
                        <Textarea
                          id="meta-refresh-token"
                          placeholder="Cole seu Refresh Token aqui..."
                          className="font-mono text-sm min-h-[80px]"
                          {...metaForm.register('refreshToken')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setMetaDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createMetaIntegrationMutation.isPending}>
                        {createMetaIntegrationMutation.isPending ? 'Conectando...' : 'Conectar'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Modal Google */}
              <Dialog open={googleDialogOpen} onOpenChange={setGoogleDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Conectar Google Ads</DialogTitle>
                    <DialogDescription>
                      Preencha as credenciais da sua conta Google Ads
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={googleForm.handleSubmit((data) => createGoogleIntegrationMutation.mutate(data))}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="google-access-token">Access Token *</Label>
                        <Textarea
                          id="google-access-token"
                          placeholder="Cole seu Access Token aqui..."
                          className="font-mono text-sm min-h-[100px]"
                          {...googleForm.register('accessToken')}
                        />
                        {googleForm.formState.errors.accessToken && (
                          <p className="text-sm text-red-500">{googleForm.formState.errors.accessToken.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="google-account-id">Customer ID *</Label>
                        <Input
                          id="google-account-id"
                          placeholder="123-456-7890"
                          {...googleForm.register('accountId')}
                        />
                        {googleForm.formState.errors.accountId && (
                          <p className="text-sm text-red-500">{googleForm.formState.errors.accountId.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="google-refresh-token">Refresh Token (Recomendado)</Label>
                        <Textarea
                          id="google-refresh-token"
                          placeholder="Cole seu Refresh Token aqui..."
                          className="font-mono text-sm min-h-[80px]"
                          {...googleForm.register('refreshToken')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setGoogleDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createGoogleIntegrationMutation.isPending}>
                        {createGoogleIntegrationMutation.isPending ? 'Conectando...' : 'Conectar'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Modal de Sincronização */}
              <Dialog open={syncModalOpen} onOpenChange={(open) => {
                // Prevent closing during sync
                if (!syncStatus.isInProgress) {
                  setSyncModalOpen(open);
                }
              }}>
                <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {syncStatus.isInProgress ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                          Sincronizando...
                        </>
                      ) : syncStatus.hasError ? (
                        <>
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                          Sincronização Parcial
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          Sincronização Concluída
                        </>
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      {syncStatus.message}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-6 space-y-4">
                    {syncStatus.isInProgress ? (
                      <>
                        <div className="flex items-center justify-center">
                          <div className="relative">
                            <div className="w-24 h-24 border-4 border-gray-200 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
                          </div>
                        </div>
                        
                        <div className="space-y-3 text-center">
                          {syncStatus.currentProgress && (
                            <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3 border border-blue-200">
                              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                {syncStatus.currentProgress}
                              </p>
                            </div>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Sincronizando campanhas, ad sets e anúncios em tempo real
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Aguardando 8s entre campanhas e 5s entre ad sets para evitar limite de taxa
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center border border-green-200">
                            <div className="text-2xl font-bold text-green-600">{syncStatus.campaigns}</div>
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1">Campanhas</div>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">{syncStatus.adSets}</div>
                            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Ad Sets</div>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 text-center border border-purple-200">
                            <div className="text-2xl font-bold text-purple-600">{syncStatus.creatives}</div>
                            <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">Anúncios</div>
                          </div>
                        </div>

                        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-900 dark:text-blue-100 text-sm">
                            <strong>Aguarde...</strong> Não feche esta janela durante a sincronização.
                          </AlertDescription>
                        </Alert>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 text-center border border-green-200">
                            <div className="text-3xl font-bold text-green-600">{syncStatus.campaigns}</div>
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1">Campanhas</div>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-center border border-blue-200">
                            <div className="text-3xl font-bold text-blue-600">{syncStatus.adSets}</div>
                            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Ad Sets</div>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 text-center border border-purple-200">
                            <div className="text-3xl font-bold text-purple-600">{syncStatus.creatives}</div>
                            <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">Anúncios</div>
                          </div>
                        </div>

                        {syncStatus.hasError ? (
                          <>
                            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="text-amber-900 dark:text-amber-100 text-sm">
                                <strong>Atenção:</strong> {syncStatus.errorMessage}
                              </AlertDescription>
                            </Alert>
                            
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => currentSyncId && syncIntegrationMutation.mutate(currentSyncId)} 
                                className="flex-1"
                                variant="default"
                                disabled={syncIntegrationMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Continuar Sincronização
                              </Button>
                              <Button 
                                onClick={() => {
                                  setSyncModalOpen(false);
                                  setCurrentSyncId(null);
                                }} 
                                variant="outline"
                              >
                                Fechar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-900 dark:text-green-100 text-sm">
                              Todos os dados foram sincronizados com sucesso!
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Modal de Confirmação de Exclusão */}
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      O que deseja fazer?
                    </DialogTitle>
                    <DialogDescription>
                      Você está removendo a integração: <strong>{integrationToDelete?.accountName || 'Conta'}</strong>
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4 space-y-4">
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900 dark:text-blue-100 text-sm">
                        <strong>Desconectar:</strong> Mantém todas as campanhas, ad sets e anúncios já sincronizados. Você pode reconectar depois.
                      </AlertDescription>
                    </Alert>

                    <Alert className="bg-red-50 dark:bg-red-950 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-900 dark:text-red-100 text-sm">
                        <strong>Excluir tudo:</strong> Remove a integração e TODOS os dados (campanhas, ad sets, anúncios). Ação permanente!
                      </AlertDescription>
                    </Alert>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setDeleteDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => integrationToDelete && disableIntegrationMutation.mutate(integrationToDelete.id)}
                      disabled={disableIntegrationMutation.isPending || deleteIntegrationMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {disableIntegrationMutation.isPending ? 'Desconectando...' : 'Desconectar (manter dados)'}
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => integrationToDelete && deleteIntegrationMutation.mutate(integrationToDelete.id)}
                      disabled={disableIntegrationMutation.isPending || deleteIntegrationMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {deleteIntegrationMutation.isPending ? 'Excluindo...' : 'Excluir tudo'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
