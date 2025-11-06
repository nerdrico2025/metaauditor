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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, RefreshCw, Facebook, FileSpreadsheet, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';

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
  dataSource?: string | null;
}

interface SyncStatus {
  recordCount: number;
  lastSyncBatch?: string;
  latestRecord?: string;
}

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao remover integração',
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

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const googleIntegrations = integrations.filter(i => i.platform === 'google');

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Conecte suas contas de anúncios e importe campanhas
                </p>
              </div>

              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Importante:</strong> Conecte suas contas Meta Ads e Google Ads para sincronizar automaticamente 
                  todas as campanhas, grupos de anúncios e anúncios via API oficial.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <Card className="border-2" data-testid="card-integration-meta">
                  <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Facebook className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Meta Ads</CardTitle>
                        <CardDescription>Facebook & Instagram</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {metaIntegrations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma integração configurada</p>
                        <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
                          <DialogTrigger asChild>
                            <Button data-testid="button-add-meta" className="w-full">
                              <Plus className="w-4 h-4 mr-2" />
                              Conectar Meta Ads
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Conectar Meta Ads API</DialogTitle>
                              <DialogDescription>
                                Configure sua integração com Facebook e Instagram Ads
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={metaForm.handleSubmit((data) => createMetaIntegrationMutation.mutate(data))}>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="meta-access-token">Access Token</Label>
                                  <Input
                                    id="meta-access-token"
                                    data-testid="input-meta-access-token"
                                    placeholder="EAABs..."
                                    {...metaForm.register('accessToken')}
                                  />
                                  {metaForm.formState.errors.accessToken && (
                                    <p className="text-sm text-red-500">{metaForm.formState.errors.accessToken.message}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="meta-account-id">Ad Account ID</Label>
                                  <Input
                                    id="meta-account-id"
                                    data-testid="input-meta-account-id"
                                    placeholder="act_123456789"
                                    {...metaForm.register('accountId')}
                                  />
                                  {metaForm.formState.errors.accountId && (
                                    <p className="text-sm text-red-500">{metaForm.formState.errors.accountId.message}</p>
                                  )}
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  data-testid="button-submit-meta"
                                  disabled={createMetaIntegrationMutation.isPending}
                                >
                                  {createMetaIntegrationMutation.isPending ? 'Criando...' : 'Criar Integração'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metaIntegrations.map((integration) => (
                          <div key={integration.id} className="p-4 border rounded-lg bg-white dark:bg-gray-800" data-testid={`integration-meta-${integration.id}`}>
                            <div className="flex items-center justify-between mb-2">
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
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              Conta: {integration.accountId || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                              Última sincronização: {formatDate(integration.lastSync)}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-sync-meta-${integration.id}`}
                                onClick={() => syncIntegrationMutation.mutate(integration.id)}
                                disabled={syncIntegrationMutation.isPending}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Sincronizar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`button-delete-meta-${integration.id}`}
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

                <Card className="border-2" data-testid="card-integration-google">
                  <CardHeader className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-950 dark:to-orange-900">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-sm">
                        <SiGoogle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Google Ads</CardTitle>
                        <CardDescription>Google Advertising</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {googleIntegrations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma integração configurada</p>
                        <Dialog open={googleDialogOpen} onOpenChange={setGoogleDialogOpen}>
                          <DialogTrigger asChild>
                            <Button data-testid="button-add-google" className="w-full">
                              <Plus className="w-4 h-4 mr-2" />
                              Conectar Google Ads
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Conectar Google Ads API</DialogTitle>
                              <DialogDescription>
                                Configure sua integração com Google Ads
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={googleForm.handleSubmit((data) => createGoogleIntegrationMutation.mutate(data))}>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="google-access-token">Access Token</Label>
                                  <Input
                                    id="google-access-token"
                                    data-testid="input-google-access-token"
                                    placeholder="ya29..."
                                    {...googleForm.register('accessToken')}
                                  />
                                  {googleForm.formState.errors.accessToken && (
                                    <p className="text-sm text-red-500">{googleForm.formState.errors.accessToken.message}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="google-account-id">Customer ID</Label>
                                  <Input
                                    id="google-account-id"
                                    data-testid="input-google-account-id"
                                    placeholder="123-456-7890"
                                    {...googleForm.register('accountId')}
                                  />
                                  {googleForm.formState.errors.accountId && (
                                    <p className="text-sm text-red-500">{googleForm.formState.errors.accountId.message}</p>
                                  )}
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  data-testid="button-submit-google"
                                  disabled={createGoogleIntegrationMutation.isPending}
                                >
                                  {createGoogleIntegrationMutation.isPending ? 'Criando...' : 'Criar Integração'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {googleIntegrations.map((integration) => (
                          <div key={integration.id} className="p-4 border rounded-lg bg-white dark:bg-gray-800" data-testid={`integration-google-${integration.id}`}>
                            <div className="flex items-center justify-between mb-2">
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
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              Conta: {integration.accountId || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                              Última sincronização: {formatDate(integration.lastSync)}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-sync-google-${integration.id}`}
                                onClick={() => syncIntegrationMutation.mutate(integration.id)}
                                disabled={syncIntegrationMutation.isPending}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Sincronizar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`button-delete-google-${integration.id}`}
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

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
