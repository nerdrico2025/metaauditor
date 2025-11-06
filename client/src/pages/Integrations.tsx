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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, RefreshCw, Facebook, ExternalLink, FileSpreadsheet, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';

const createIntegrationSchema = z.object({
  platform: z.enum(['meta', 'google']),
  accessToken: z.string().min(1, 'Access token é obrigatório'),
  refreshToken: z.string().optional(),
  accountId: z.string().min(1, 'Account ID é obrigatório'),
});

type CreateIntegrationData = z.infer<typeof createIntegrationSchema>;

interface Integration {
  id: string;
  platform: string;
  accountId: string | null;
  status: string;
  lastSync: Date | null;
  createdAt: Date;
}

interface SyncStatus {
  recordCount: number;
  lastSyncBatch?: string;
  latestRecord?: string;
}

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createIntegrationDialogOpen, setCreateIntegrationDialogOpen] = useState(false);

  // Fetch integrations
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  // Fetch Google Sheets sync status
  const { data: sheetsSyncStatus, isLoading: sheetsLoading } = useQuery<{ data: { syncStatus: SyncStatus } }>({
    queryKey: ['/api/sync/status'],
    enabled: !!user,
  });

  // Create integration form
  const createIntegrationForm = useForm<CreateIntegrationData>({
    resolver: zodResolver(createIntegrationSchema),
  });

  // Mutations
  const createIntegrationMutation = useMutation({
    mutationFn: (data: CreateIntegrationData) => apiRequest('/api/integrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Integração criada com sucesso!' });
      setCreateIntegrationDialogOpen(false);
      createIntegrationForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar integração',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const syncIntegrationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/integrations/${id}/sync`, { method: 'POST' }),
    onSuccess: (data: any) => {
      toast({ 
        title: 'Sincronização concluída!',
        description: `${data.campaigns} campanhas e ${data.creatives} criativos sincronizados.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
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

  const syncSheetsMutation = useMutation({
    mutationFn: () => apiRequest('/api/sync-single-tab-now', { method: 'POST' }),
    onSuccess: (data: any) => {
      toast({
        title: 'Sincronização concluída!',
        description: `${data.totalInserted} registros importados com sucesso.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

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

  const getStatusIcon = (status: string) => {
    if (status === 'active') {
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    }
    return <AlertCircle className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                    <ExternalLink className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Configure conexões com plataformas de anúncios e importação de dados</p>
                  </div>
                </div>
              </div>

              {/* Google Sheets Integration */}
              <Card className="mb-6 border-2 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Google Sheets</CardTitle>
                        <CardDescription className="mt-1">
                          Importe dados de campanhas diretamente de planilhas Google
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={sheetsSyncStatus?.data?.syncStatus?.recordCount ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                      {sheetsSyncStatus?.data?.syncStatus?.recordCount ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Configurado</>
                      ) : (
                        <><Clock className="w-4 h-4 mr-1" /> Aguardando dados</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total de Registros</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {sheetsSyncStatus?.data?.syncStatus?.recordCount?.toLocaleString('pt-BR') || '0'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Último Lote</div>
                      <div className="text-sm font-mono text-gray-900 dark:text-white truncate">
                        {sheetsSyncStatus?.data?.syncStatus?.lastSyncBatch || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Última Sincronização</div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(sheetsSyncStatus?.data?.syncStatus?.latestRecord)}
                      </div>
                    </div>
                  </div>

                  <Alert className="mb-4">
                    <ExternalLink className="h-4 w-4" />
                    <AlertTitle>Planilha Configurada</AlertTitle>
                    <AlertDescription className="mt-2">
                      <a 
                        href="https://docs.google.com/spreadsheets/d/1mOPjhRhBUP60GzZm0NAuUSYGzlE1bDbi414iYtlwZkA/edit?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        Ver planilha no Google Sheets
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={() => syncSheetsMutation.mutate()}
                    disabled={syncSheetsMutation.isPending}
                    className="w-full"
                    size="lg"
                    data-testid="button-sync-sheets"
                  >
                    <RefreshCw className={`w-5 h-5 mr-2 ${syncSheetsMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncSheetsMutation.isPending ? 'Sincronizando...' : 'Sincronizar Dados Agora'}
                  </Button>
                </CardContent>
              </Card>

              <Separator className="my-8" />

              {/* Platform Integrations */}
              <Card className="border-2 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Integrações de Plataformas</CardTitle>
                      <CardDescription className="mt-1">
                        Conecte-se diretamente com Meta Ads e Google Ads para sincronizar campanhas e criativos
                      </CardDescription>
                    </div>
                    <Dialog open={createIntegrationDialogOpen} onOpenChange={setCreateIntegrationDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-create-integration" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Nova Integração
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Criar Nova Integração</DialogTitle>
                          <DialogDescription>
                            Configure uma nova integração com Meta Ads ou Google Ads
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={createIntegrationForm.handleSubmit((data) => createIntegrationMutation.mutate(data))}>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="platform">Plataforma</Label>
                              <Select onValueChange={(value) => createIntegrationForm.setValue('platform', value as 'meta' | 'google')}>
                                <SelectTrigger data-testid="select-platform">
                                  <SelectValue placeholder="Selecione a plataforma" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="meta">
                                    <div className="flex items-center gap-2">
                                      <Facebook className="w-4 h-4" />
                                      Meta Ads (Facebook/Instagram)
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="google">
                                    <div className="flex items-center gap-2">
                                      <SiGoogle className="w-4 h-4" />
                                      Google Ads
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {createIntegrationForm.formState.errors.platform && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  {createIntegrationForm.formState.errors.platform.message}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="accessToken">Access Token</Label>
                              <Input
                                id="accessToken"
                                type="password"
                                placeholder="Cole seu access token aqui"
                                data-testid="input-access-token"
                                {...createIntegrationForm.register('accessToken')}
                              />
                              {createIntegrationForm.formState.errors.accessToken && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  {createIntegrationForm.formState.errors.accessToken.message}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="refreshToken">Refresh Token (opcional)</Label>
                              <Input
                                id="refreshToken"
                                type="password"
                                placeholder="Cole seu refresh token aqui"
                                data-testid="input-refresh-token"
                                {...createIntegrationForm.register('refreshToken')}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="accountId">Account ID</Label>
                              <Input
                                id="accountId"
                                placeholder="Ex: act_123456789 (Meta) ou 123-456-7890 (Google)"
                                data-testid="input-account-id"
                                {...createIntegrationForm.register('accountId')}
                              />
                              {createIntegrationForm.formState.errors.accountId && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  {createIntegrationForm.formState.errors.accountId.message}
                                </p>
                              )}
                            </div>

                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Como obter suas credenciais</AlertTitle>
                              <AlertDescription className="text-xs mt-2">
                                <ul className="list-disc list-inside space-y-1">
                                  <li><strong>Meta Ads:</strong> Business Manager → Configurações → Access Token</li>
                                  <li><strong>Google Ads:</strong> Google Cloud Console → OAuth 2.0</li>
                                </ul>
                              </AlertDescription>
                            </Alert>
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCreateIntegrationDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="submit"
                              disabled={createIntegrationMutation.isPending}
                              data-testid="button-submit-create-integration"
                            >
                              {createIntegrationMutation.isPending ? 'Criando...' : 'Criar Integração'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {integrationsLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando integrações...</div>
                  ) : integrations.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ExternalLink className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Nenhuma integração configurada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Adicione uma nova integração para começar a sincronizar dados de campanhas
                      </p>
                      <Button onClick={() => setCreateIntegrationDialogOpen(true)} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Primeira Integração
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {integrations.map((integration) => (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between p-5 border-2 rounded-lg hover:border-primary/50 transition-colors bg-white dark:bg-gray-800"
                          data-testid={`integration-item-${integration.id}`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              integration.platform === 'meta' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-red-100 dark:bg-red-900'
                            }`}>
                              {integration.platform === 'meta' ? (
                                <Facebook className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <SiGoogle className="w-6 h-6 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {integration.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                                </h3>
                                {getStatusIcon(integration.status)}
                                <Badge variant={integration.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                  {integration.status === 'active' ? 'Ativa' : 'Inativa'}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Account ID: <span className="font-mono">{integration.accountId}</span>
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Última sincronização: {formatDate(integration.lastSync)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => syncIntegrationMutation.mutate(integration.id)}
                              disabled={syncIntegrationMutation.isPending}
                              data-testid={`button-sync-integration-${integration.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${syncIntegrationMutation.isPending ? 'animate-spin' : ''}`} />
                              Sincronizar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja remover esta integração?')) {
                                  deleteIntegrationMutation.mutate(integration.id);
                                }
                              }}
                              disabled={deleteIntegrationMutation.isPending}
                              data-testid={`button-delete-integration-${integration.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
