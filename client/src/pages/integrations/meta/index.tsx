import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Trash2, Plus, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { SiFacebook } from 'react-icons/si';
import { HowToConnectModal } from '../components/HowToConnectModal';
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog';
import { IntegrationCard } from '../components/IntegrationCard';
import { DeleteAllDataDialog } from '../components/DeleteAllDataDialog';
import { SyncLoadingModal } from '../components/SyncLoadingModal';

interface AdAccount {
  id: string;
  name: string;
  accountStatus: number;
}

interface Integration {
  id: string;
  platform: string;
  accountId: string | null;
  accountName: string | null;
  accountStatus: string | null;
  businessId: string | null;
  businessName: string | null;
  status: string;
  lastSync: Date | null;
  lastFullSync: Date | null;
  createdAt: Date;
}

interface BusinessGroup {
  businessId: string | null;
  businessName: string;
  integrations: Integration[];
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

export default function MetaIntegrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [howToConnectOpen, setHowToConnectOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<AdAccount[]>([]);
  const [connectedAccountIds, setConnectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [renewingTokens, setRenewingTokens] = useState(false);
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSteps, setSyncSteps] = useState<Array<{name: string; status: 'pending' | 'loading' | 'success' | 'error'; count?: number; total?: number; error?: string}>>([]);
  const [currentSyncStep, setCurrentSyncStep] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [syncedItems, setSyncedItems] = useState(0);
  const [syncStartTime, setSyncStartTime] = useState<number | undefined>(undefined);
  const [syncEndTime, setSyncEndTime] = useState<number | undefined>(undefined);

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const { data: syncHistory = [] } = useQuery<SyncHistoryItem[]>({
    queryKey: ['/api/integrations/sync-history'],
    enabled: !!user,
  });

  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!user,
  });

  const { data: adSets = [] } = useQuery<any[]>({
    queryKey: ['/api/adsets'],
    enabled: !!user,
  });

  const { data: creativesData } = useQuery<{ creatives: any[] }>({
    queryKey: ['/api/creatives?limit=10000'],
    enabled: !!user,
  });
  const creatives = creativesData?.creatives || [];

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const integration = integrations.find(i => i.id === id);
      if (!integration) throw new Error('Integração não encontrada');
      
      // Initialize sync modal with 3 steps
      const initialSteps = [
        { name: 'Campanhas', status: 'pending' as const, count: 0, total: 0 },
        { name: 'Grupos de Anúncios', status: 'pending' as const, count: 0, total: 0 },
        { name: 'Anúncios', status: 'pending' as const, count: 0, total: 0 },
      ];
      
      setSyncSteps(initialSteps);
      setCurrentSyncStep(0);
      setSyncedItems(0);
      setTotalItems(0);
      setSyncStartTime(Date.now());
      setSyncEndTime(undefined);
      setShowSyncModal(true);
      
      return new Promise(async (resolve, reject) => {
        try {
          // Get temporary SSE token
          const tokenResponse = await apiRequest(`/api/integrations/${id}/sync-token`, { 
            method: 'POST' 
          });
          
          if (!tokenResponse.token) {
            throw new Error('Não foi possível obter token de sincronização');
          }
          
          // Connect to SSE endpoint with token
          const eventSource = new EventSource(`/api/integrations/${id}/sync-stream?token=${tokenResponse.token}`);
          
          let finalResult: any = null;
          let hasError = false;

        eventSource.addEventListener('start', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          console.log('🚀 Sync started:', data.message);
          
          // Show initial note about first sync
          if (data.note) {
            toast({
              title: '📌 Primeira sincronização',
              description: data.note,
              duration: 8000,
            });
          }
        });

        eventSource.addEventListener('step', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          const stepIndex = data.step - 1;
          
          // Update step status and description
          setSyncSteps(prev => prev.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                name: data.name,
                status: 'loading' as const,
                total: data.total || step.total
              };
            }
            return step;
          }));
          
          setCurrentSyncStep(stepIndex);
        });

        eventSource.addEventListener('progress', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          const stepIndex = data.step - 1;
          
          // Update progress for specific step
          setSyncSteps(prev => prev.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                count: data.current,
                total: data.total,
                status: 'loading' as const
              };
            }
            return step;
          }));
        });

        eventSource.addEventListener('step-complete', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          const stepIndex = data.step - 1;
          
          // Mark step as complete
          setSyncSteps(prev => prev.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                name: data.name,
                status: 'success' as const,
                count: data.count
              };
            }
            return step;
          }));
          
          // Update both total and synced items when step completes
          setTotalItems(prev => prev + data.count);
          setSyncedItems(prev => prev + data.count);
        });

        eventSource.addEventListener('complete', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          console.log('✅ Sync completed:', data);
          
          setSyncEndTime(Date.now());
          finalResult = data;
          eventSource.close();
          resolve({ success: true, data });
        });

        eventSource.addEventListener('error', (e: MessageEvent) => {
          // Check if there's data to parse (custom SSE error event)
          if (e.data) {
            try {
              const data = JSON.parse(e.data);
              console.error('❌ Sync error:', data.message);
              
              hasError = true;
              
              // Mark current step as error
              setSyncSteps(prev => prev.map((step, idx) => {
                if (idx === currentSyncStep) {
                  return {
                    ...step,
                    status: 'error' as const,
                    error: data.message
                  };
                }
                return step;
              }));
              
              eventSource.close();
              reject(new Error(data.message));
            } catch (parseError) {
              console.error('❌ Error parsing SSE error data:', parseError);
              hasError = true;
              eventSource.close();
              reject(new Error('Erro ao processar resposta do servidor'));
            }
          }
        });

          eventSource.onerror = (error) => {
            console.error('❌ EventSource connection error:', error);
            if (!hasError && !finalResult) {
              // Mark current step as error
              setSyncSteps(prev => prev.map((step, idx) => {
                if (idx === currentSyncStep) {
                  return {
                    ...step,
                    status: 'error' as const,
                    error: 'Conexão perdida com o servidor. Tente novamente.'
                  };
                }
                return step;
              }));
              
              eventSource.close();
              reject(new Error('Conexão perdida com o servidor. Verifique sua internet e tente novamente.'));
            }
          };
        } catch (error: any) {
          // Error getting token or setting up EventSource
          console.error('❌ Error setting up sync:', error);
          setSyncSteps(prev => prev.map((step, idx) => {
            if (idx === 0) {
              return {
                ...step,
                status: 'error' as const,
                error: error.message || 'Erro ao iniciar sincronização'
              };
            }
            return step;
          }));
          reject(error);
        }
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      
      const parts = [];
      if (result?.data?.campaigns) parts.push(`${result.data.campaigns} campanhas`);
      if (result?.data?.adSets) parts.push(`${result.data.adSets} grupos de anúncios`);
      if (result?.data?.creatives) parts.push(`${result.data.creatives} anúncios`);
      
      toast({ 
        title: '✅ Sincronização concluída!',
        description: parts.length > 0 ? parts.join(', ') + ' sincronizados.' : 'Sincronização concluída.',
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao sincronizar',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteData }: { id: string; deleteData: boolean }) => {
      const url = `/api/integrations/${id}?deleteData=${deleteData}`;
      return apiRequest(url, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      const message = variables.deleteData
        ? '✓ Integração e todos os dados foram excluídos permanentemente'
        : '✓ Integração removida. Os dados foram preservados.';
      
      toast({ title: message });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
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

  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        apiRequest('/api/campaigns/bulk/all', { method: 'DELETE' }),
        apiRequest('/api/adsets/bulk/all', { method: 'DELETE' }),
        apiRequest('/api/creatives/bulk/all', { method: 'DELETE' }),
        apiRequest('/api/integrations/reset-sync', { method: 'POST' }),
      ]);
    },
    onSuccess: () => {
      toast({ 
        title: '✓ Todos os dados foram excluídos',
        description: `${campaigns.length} campanhas, ${adSets.length} grupos de anúncios e ${creatives.length} anúncios foram removidos permanentemente.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setDeleteAllDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao excluir dados',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleConnectOAuth = async () => {
    try {
      setIsConnecting(true);
      
      const width = 520;
      const height = 650;
      const left = Math.round((window.screen.width - width) / 2);
      const top = Math.round((window.screen.height - height) / 2);
      
      // Force popup mode with specific window features
      const popup = window.open(
        'about:blank',
        'MetaOAuth',
        `popup=yes,width=${width},height=${height},left=${left},top=${top},toolbar=no,scrollbars=yes,status=no,resizable=yes,location=yes,menubar=no`
      );
      
      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description: 'Por favor, permita popups para este site e tente novamente.',
          variant: 'destructive'
        });
        setIsConnecting(false);
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
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
          } else if (event.data.type === 'META_OAUTH_ERROR') {
            toast({
              title: 'Erro ao conectar',
              description: event.data.message || 'Ocorreu um erro durante a autenticação',
              variant: 'destructive'
            });
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(false);
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
        setIsConnecting(false);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Erro ao iniciar processo de autenticação OAuth',
        variant: 'destructive'
      });
      setIsConnecting(false);
    }
  };

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const hasExistingIntegration = metaIntegrations.length > 0;

  // Group integrations by Business Manager
  const groupedByBM: BusinessGroup[] = metaIntegrations.reduce((acc: BusinessGroup[], integration) => {
    const bmId = integration.businessId || 'personal';
    const bmName = integration.businessName || 'Conta Pessoal';
    
    let group = acc.find(g => g.businessId === bmId);
    if (!group) {
      group = { businessId: bmId === 'personal' ? null : bmId, businessName: bmName, integrations: [] };
      acc.push(group);
    }
    group.integrations.push(integration);
    return acc;
  }, []);

  const addAccountMutation = useMutation({
    mutationFn: async (account: AdAccount) => {
      return apiRequest('/api/auth/meta/add-account', {
        method: 'POST',
        body: JSON.stringify({
          accountId: account.id,
          accountName: account.name,
          accountStatus: account.accountStatus,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Conta adicionada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setShowAddAccountModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao adicionar conta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddAccount = async () => {
    if (hasExistingIntegration) {
      setLoadingAccounts(true);
      try {
        const data = await apiRequest('/api/auth/meta/ad-accounts');
        
        if (data.tokenExpired || data.error) {
          toast({
            title: 'Token expirado',
            description: 'O token expirou. Por favor, reconecte ao Meta.',
            variant: 'destructive',
          });
          handleConnectOAuth();
          return;
        }
        
        setAvailableAccounts(data.accounts || []);
        setConnectedAccountIds(data.connectedAccountIds || []);
        setShowAddAccountModal(true);
      } catch (error: any) {
        toast({
          title: 'Erro ao buscar contas',
          description: error.message,
          variant: 'destructive',
        });
        handleConnectOAuth();
      } finally {
        setLoadingAccounts(false);
      }
    } else {
      handleConnectOAuth();
    }
  };

  const handleRenewAllTokens = async () => {
    setRenewingTokens(true);
    try {
      const response = await apiRequest('/api/auth/meta/renew-all-tokens', { method: 'POST' });
      
      if (response.failed > 0) {
        toast({
          title: `${response.renewed} tokens renovados`,
          description: `${response.failed} tokens expiraram e precisam de nova autenticação`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Tokens renovados!',
          description: `${response.renewed} tokens renovados com sucesso por mais 60 dias`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/meta/check-token'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao renovar tokens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRenewingTokens(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <SyncLoadingModal 
        open={showSyncModal}
        steps={syncSteps}
        currentStep={currentSyncStep}
        totalItems={totalItems}
        syncedItems={syncedItems}
        startTime={syncStartTime}
        endTime={syncEndTime}
        onClose={() => setShowSyncModal(false)}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Meta Ads - Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
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
                        onClick={() => setHowToConnectOpen(true)}
                        data-testid="button-how-to-connect-meta"
                      >
                        <HelpCircle className="w-4 h-4 mr-2" />
                        Como Conectar
                      </Button>
                      <Button 
                        onClick={handleConnectOAuth} 
                        size="sm"
                        disabled={isConnecting}
                        data-testid="button-connect-meta-oauth"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {isConnecting ? 'Conectando...' : 'Adicionar BM'}
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
                    <>
                      <div className="space-y-6">
                        {groupedByBM.map((group) => (
                          <div key={group.businessId || 'personal'} className="border rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                  <SiFacebook className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white">
                                    {group.businessName}
                                  </h3>
                                  {group.businessId && (
                                    <p className="text-xs text-gray-500 font-mono">{group.businessId}</p>
                                  )}
                                </div>
                                <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                  {group.integrations.length} conta{group.integrations.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRenewAllTokens}
                                  disabled={renewingTokens}
                                  data-testid={`button-renew-tokens-${group.businessId}`}
                                >
                                  {renewingTokens ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  Renovar Tokens
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={handleAddAccount}
                                  disabled={loadingAccounts}
                                  data-testid={`button-add-account-${group.businessId}`}
                                >
                                  {loadingAccounts ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  Adicionar Conta
                                </Button>
                              </div>
                            </div>
                            <div className="p-4 space-y-3">
                              {group.integrations.map((integration) => {
                                const integrationHistory = syncHistory.filter(h => h.integrationId === integration.id);
                                
                                return (
                                  <IntegrationCard
                                    key={integration.id}
                                    integration={integration}
                                    syncHistory={integrationHistory}
                                    onSync={() => syncMutation.mutate(integration.id)}
                                    onDelete={() => {
                                      setIntegrationToDelete(integration);
                                      setDeleteDialogOpen(true);
                                    }}
                                    onRenewToken={handleConnectOAuth}
                                    isSyncing={syncMutation.isPending}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {(campaigns.length > 0 || adSets.length > 0 || creatives.length > 0) && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Zona de Perigo
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {campaigns.length} campanhas, {adSets.length} grupos de anúncios e {creatives.length} anúncios sincronizados
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteAllDialogOpen(true)}
                              data-testid="button-delete-all-meta-data"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir Todos os Dados
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <HowToConnectModal 
        open={howToConnectOpen} 
        onOpenChange={setHowToConnectOpen}
        platform="meta"
      />
      
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        integration={integrationToDelete}
        onConfirm={(deleteAllData) => {
          if (integrationToDelete) {
            deleteMutation.mutate({ 
              id: integrationToDelete.id, 
              deleteData: deleteAllData 
            });
          }
        }}
        isDeleting={deleteMutation.isPending}
      />

      <DeleteAllDataDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        onConfirm={() => deleteAllDataMutation.mutate()}
        isDeleting={deleteAllDataMutation.isPending}
        dataType="Dados Meta"
        count={campaigns.length + adSets.length + creatives.length}
      />

      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Conta de Anúncios</DialogTitle>
            <DialogDescription>
              Selecione uma conta de anúncios para conectar. As contas já conectadas estão desabilitadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableAccounts.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nenhuma conta disponível encontrada.</p>
            ) : (
              availableAccounts.map((account) => {
                const isConnected = connectedAccountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    onClick={() => !isConnected && addAccountMutation.mutate(account)}
                    disabled={isConnected || addAccountMutation.isPending}
                    className={`w-full p-4 rounded-lg border text-left flex items-center justify-between transition-colors ${
                      isConnected 
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
                        : 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{account.id}</p>
                    </div>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Conectada
                      </span>
                    ) : addAccountMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddAccountModal(false)}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={handleConnectOAuth}>
              <SiFacebook className="w-4 h-4 mr-2" />
              Nova Autenticação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
