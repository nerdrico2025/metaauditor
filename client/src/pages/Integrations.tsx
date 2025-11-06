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
import { Trash2, Plus, RefreshCw, Facebook, ExternalLink } from 'lucide-react';
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

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createIntegrationDialogOpen, setCreateIntegrationDialogOpen] = useState(false);

  // Fetch integrations
  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
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

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <ExternalLink className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações de Plataformas</h1>
                      <p className="text-gray-600 dark:text-gray-300">Configure integrações com Meta Ads e Google Ads para sincronizar campanhas e criativos</p>
                    </div>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Minhas Integrações</CardTitle>
                    <CardDescription>
                      Gerencie suas conexões com plataformas de anúncios
                    </CardDescription>
                  </div>
                  <Dialog open={createIntegrationDialogOpen} onOpenChange={setCreateIntegrationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-integration">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Integração
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Nova Integração</DialogTitle>
                        <DialogDescription>
                          Configure uma nova integração com Meta Ads ou Google Ads
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={createIntegrationForm.handleSubmit((data) => createIntegrationMutation.mutate(data))}>
                        <div className="space-y-4">
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
                            <AlertDescription>
                              <strong>Como obter suas credenciais:</strong>
                              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li><strong>Meta Ads:</strong> Acesse Meta Business Manager → Configurações → Integrações → Access Token</li>
                                <li><strong>Google Ads:</strong> Use OAuth 2.0 via Google Cloud Console</li>
                              </ul>
                            </AlertDescription>
                          </Alert>
                        </div>
                        <DialogFooter className="mt-6">
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {integrations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Nenhuma integração configurada. Adicione uma nova integração para começar a sincronizar dados.
                      </div>
                    ) : (
                      integrations.map((integration) => (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`integration-item-${integration.id}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {integration.platform === 'meta' ? (
                                <Facebook className="w-5 h-5 text-blue-600" />
                              ) : (
                                <SiGoogle className="w-5 h-5 text-red-600" />
                              )}
                              <p className="font-medium">
                                {integration.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                              </p>
                              <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                                {integration.status === 'active' ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Account ID: {integration.accountId}
                            </p>
                            <p className="text-xs text-gray-500">
                              Última sincronização: {formatDate(integration.lastSync)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => syncIntegrationMutation.mutate(integration.id)}
                              disabled={syncIntegrationMutation.isPending}
                              data-testid={`button-sync-integration-${integration.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncIntegrationMutation.isPending ? 'animate-spin' : ''}`} />
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
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
