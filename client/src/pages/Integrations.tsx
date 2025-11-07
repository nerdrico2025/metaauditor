
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
    mutationFn: (id: string) => apiRequest(`/api/integrations/${id}/sync`, { method: 'POST' }),
    onSuccess: (data: any) => {
      const parts = [];
      if (data.campaigns) parts.push(`${data.campaigns} campanhas`);
      if (data.adSets) parts.push(`${data.adSets} ad sets`);
      if (data.creatives) parts.push(`${data.creatives} anúncios`);
      
      toast({ 
        title: 'Sincronização concluída!',
        description: parts.join(', ') + ' sincronizados.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Integração removida com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao remover integração',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleConnectMetaOAuth = async () => {
    try {
      setIsConnectingMeta(true);
      const response = await fetch('/api/auth/meta/connect');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({
          title: 'Erro ao conectar',
          description: data.error || 'Não foi possível gerar a URL de autenticação',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao conectar',
        description: 'Erro ao iniciar processo de autenticação OAuth',
        variant: 'destructive'
      });
    } finally {
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
          <strong>✨ Recomendado: Use o botão "Conectar com OAuth"</strong><br />
          Conexão automática e segura em 1 clique, sem precisar copiar tokens manualmente!
        </AlertDescription>
      </Alert>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          <strong>Conexão Manual</strong> - Use apenas se preferir configurar manualmente ou para troubleshooting
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Acesse o Meta Business Manager</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Vá para <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">business.facebook.com</code>
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Business Manager
              </a>
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Obtenha o Account ID</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Navegue até: <strong>Configurações → Contas de Anúncio</strong><br />
              Copie o ID da sua conta (formato: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">act_123456789</code>)
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Gere um Access Token</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Acesse o Graph API Explorer para gerar um token de acesso
            </p>
            <div className="space-y-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Graph API Explorer
                </a>
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Selecione as permissões: <strong>ads_read, ads_management</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">(Opcional) Gere um Token de Longa Duração</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Tokens padrão expiram em 1-2 horas. Para produção, converta para token de longa duração (60 dias)
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Documentação
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
            <li>Mantenha suas credenciais seguras e nunca as compartilhe</li>
            <li>Tokens têm validade limitada - use tokens de longa duração</li>
            <li>Teste a conexão após configurar</li>
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
                            <div className="flex gap-2">
                              <Button 
                                onClick={handleConnectMetaOAuth} 
                                size="sm"
                                disabled={isConnectingMeta}
                                data-testid="button-connect-meta-oauth"
                              >
                                <SiFacebook className="w-4 h-4 mr-2" />
                                {isConnectingMeta ? 'Conectando...' : 'Conectar com OAuth'}
                              </Button>
                              <Button 
                                onClick={() => setMetaDialogOpen(true)} 
                                size="sm" 
                                variant="outline"
                                data-testid="button-connect-meta-manual"
                              >
                                Manual
                              </Button>
                            </div>
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
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Account ID:</span>
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
                                      if (confirm('Tem certeza? Isso removerá todas as campanhas vinculadas.')) {
                                        deleteIntegrationMutation.mutate(integration.id);
                                      }
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
                                      if (confirm('Tem certeza? Isso removerá todas as campanhas vinculadas.')) {
                                        deleteIntegrationMutation.mutate(integration.id);
                                      }
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

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
