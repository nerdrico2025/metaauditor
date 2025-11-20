import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Trash2, Bug } from 'lucide-react';
import { SiFacebook } from 'react-icons/si';
import { HowToConnectModal } from '../components/HowToConnectModal';
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog';
import { IntegrationCard } from '../components/IntegrationCard';
import { DeleteAllDataDialog } from '../components/DeleteAllDataDialog';
import { SyncLoadingModal } from '../components/SyncLoadingModal';

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

export default function MetaIntegrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [howToConnectOpen, setHowToConnectOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  
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
      const url = deleteData 
        ? `/api/integrations/${id}?deleteData=true`
        : `/api/integrations/${id}`;
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
                      <Link href="/debug/meta">
                        <Button 
                          variant="outline"
                          size="sm"
                          data-testid="button-debug-meta"
                        >
                          <Bug className="w-4 h-4 mr-2" />
                          Debug
                        </Button>
                      </Link>
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
                        <SiFacebook className="w-4 h-4 mr-2" />
                        {isConnecting ? 'Conectando...' : 'Conectar Conta'}
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
                      <div className="space-y-4">
                        {metaIntegrations.map((integration) => {
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
                              isSyncing={syncMutation.isPending}
                            />
                          );
                        })}
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
    </div>
  );
}
