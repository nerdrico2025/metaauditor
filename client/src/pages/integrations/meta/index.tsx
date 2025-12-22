import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
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
import { DeleteProgressModal } from '../components/DeleteProgressModal';
import { RedownloadProgressModal } from '../components/RedownloadProgressModal';
import { RedownloadOptionsModal } from '../components/RedownloadOptionsModal';
import { SyncLoadingModal } from '../components/SyncLoadingModal';
import { BulkSyncModal } from '../components/BulkSyncModal';

interface AccountSyncResult {
  id: string;
  name: string;
  status: 'pending' | 'syncing' | 'success' | 'error' | 'cancelled';
  campaigns?: number;
  adSets?: number;
  creatives?: number;
  duration?: number;
  error?: string;
}

interface AdAccount {
  id: string;
  name: string;
  accountStatus: number;
  account_status?: number;
  business_id?: string | null;
  business_name?: string;
  is_connected?: boolean;
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
  connectedByUserName: string | null;
  connectedByUserId: string | null;
  facebookUserId: string | null;
  facebookUserName: string | null;
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
  const [, setLocation] = useLocation();
  
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
  const [syncingAll, setSyncingAll] = useState(false);
  const [bulkSyncAccounts, setBulkSyncAccounts] = useState<AccountSyncResult[]>([]);
  const [bulkSyncCurrentIndex, setBulkSyncCurrentIndex] = useState(0);
  const [showBulkSyncModal, setShowBulkSyncModal] = useState(false);
  const [bulkSyncComplete, setBulkSyncComplete] = useState(false);
  const [bulkSyncCancelled, setBulkSyncCancelled] = useState(false);
  const [bulkSyncTotalDuration, setBulkSyncTotalDuration] = useState<number | undefined>();
  const cancelBulkSyncRef = useRef(false);
  const isBulkSyncRef = useRef(false);
  const currentEventSourceRef = useRef<EventSource | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedBusinessName, setSelectedBusinessName] = useState<string>('');
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthAccounts, setOauthAccounts] = useState<AdAccount[]>([]);
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const [oauthFacebookUserId, setOauthFacebookUserId] = useState<string | null>(null);
  const [oauthFacebookUserName, setOauthFacebookUserName] = useState<string | null>(null);
  const [showAccountSelectionModal, setShowAccountSelectionModal] = useState(false);
  const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null);
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSteps, setSyncSteps] = useState<Array<{name: string; status: 'pending' | 'loading' | 'success' | 'error'; count?: number; total?: number; error?: string}>>([]);
  const [currentSyncStep, setCurrentSyncStep] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [syncedItems, setSyncedItems] = useState(0);
  const [syncStartTime, setSyncStartTime] = useState<number | undefined>(undefined);
  const [syncEndTime, setSyncEndTime] = useState<number | undefined>(undefined);

  // Delete progress modal state
  const [showDeleteProgressModal, setShowDeleteProgressModal] = useState(false);
  const [deleteSteps, setDeleteSteps] = useState<Array<{name: string; status: 'pending' | 'loading' | 'success' | 'error'; error?: string}>>([]);
  const [deleteStartTime, setDeleteStartTime] = useState<number | undefined>(undefined);
  const [deleteEndTime, setDeleteEndTime] = useState<number | undefined>(undefined);
  
  // Re-download images state
  const [redownloadingImagesId, setRedownloadingImagesId] = useState<string | null>(null);
  const [showRedownloadModal, setShowRedownloadModal] = useState(false);
  const [redownloadSteps, setRedownloadSteps] = useState<Array<{name: string; status: 'pending' | 'loading' | 'success' | 'error'; message?: string}>>([]);
  const [redownloadProgress, setRedownloadProgress] = useState({ current: 0, total: 0 });
  const [redownloadCurrentCreative, setRedownloadCurrentCreative] = useState<string | undefined>();
  const [redownloadComplete, setRedownloadComplete] = useState(false);
  const [redownloadResult, setRedownloadResult] = useState<{deleted: number; updated: number; failed: number; noImage: number; total: number} | undefined>();
  const [redownloadStartTime, setRedownloadStartTime] = useState<number | undefined>();
  const [redownloadEndTime, setRedownloadEndTime] = useState<number | undefined>();
  
  // Redownload options modal state
  const [showRedownloadOptionsModal, setShowRedownloadOptionsModal] = useState(false);
  const [pendingRedownloadIntegrationId, setPendingRedownloadIntegrationId] = useState<string | null>(null);

  // Check for OAuth session in URL on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSessionId = params.get('oauth_session');
    
    if (oauthSessionId) {
      // Remove the parameter from URL
      setLocation('/integrations/meta', { replace: true });
      
      // Fetch the OAuth session data
      fetch(`/api/auth/meta/oauth-session/${oauthSessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.accounts && data.accessToken) {
            setOauthAccounts(data.accounts);
            setOauthToken(data.accessToken);
            setShowAccountSelectionModal(true);
          }
        })
        .catch(err => {
          console.error('Error fetching OAuth session:', err);
          toast({
            title: 'Erro',
            description: 'Sessão de autenticação expirada. Tente novamente.',
            variant: 'destructive'
          });
        });
    }
  }, []);

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
      
      // Only show the individual sync modal if NOT in bulk sync mode
      if (!isBulkSyncRef.current) {
        setShowSyncModal(true);
      }
      
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
          
          // Store in ref so we can close it if cancelled (works for both bulk and individual sync)
          currentEventSourceRef.current = eventSource;
          
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
          setSyncSteps(prev => {
            const newSteps = prev.map((step, idx) => {
              if (idx === stepIndex) {
                return {
                  ...step,
                  name: data.name,
                  status: 'loading' as const,
                  total: data.total || step.total
                };
              }
              return step;
            });
            
            // Update total items from all steps
            if (data.total) {
              const allTotal = newSteps.reduce((sum, s) => sum + (s.total || 0), 0);
              setTotalItems(allTotal);
            }
            
            return newSteps;
          });
          
          setCurrentSyncStep(stepIndex);
        });

        eventSource.addEventListener('progress', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          const stepIndex = data.step - 1;
          
          // Update progress for specific step
          setSyncSteps(prev => {
            const newSteps = prev.map((step, idx) => {
              if (idx === stepIndex) {
                return {
                  ...step,
                  count: data.current,
                  total: data.total,
                  status: 'loading' as const
                };
              }
              return step;
            });
            
            // Calculate and update total/synced items from all steps
            const allTotal = newSteps.reduce((sum, s) => sum + (s.total || 0), 0);
            const allSynced = newSteps.reduce((sum, s) => {
              if (s.status === 'success') return sum + (s.count || 0);
              if (s.status === 'loading') return sum + (s.count || 0);
              return sum;
            }, 0);
            
            setTotalItems(allTotal);
            setSyncedItems(allSynced);
            
            return newSteps;
          });
        });

        eventSource.addEventListener('step-complete', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          const stepIndex = data.step - 1;
          
          // Mark step as complete
          setSyncSteps(prev => {
            const newSteps = prev.map((step, idx) => {
              if (idx === stepIndex) {
                return {
                  ...step,
                  name: data.name,
                  status: 'success' as const,
                  count: data.count,
                  total: data.count
                };
              }
              return step;
            });
            
            // Recalculate totals from completed steps
            const allTotal = newSteps.reduce((sum, s) => sum + (s.total || s.count || 0), 0);
            const allSynced = newSteps.reduce((sum, s) => sum + (s.count || 0), 0);
            
            setTotalItems(allTotal);
            setSyncedItems(allSynced);
            
            return newSteps;
          });
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
            // Check if this is a cancellation
            if (cancelBulkSyncRef.current) {
              eventSource.close();
              currentEventSourceRef.current = null;
              reject(new Error('CANCELLED'));
              return;
            }
            
            // Only log and handle if we haven't already completed successfully
            if (!finalResult && !hasError) {
              console.error('❌ EventSource connection error:', error);
              
              // Add a small delay to check if we got a final result
              // This handles race conditions where complete fires just before the connection closes
              setTimeout(() => {
                if (!finalResult && !hasError) {
                  // Check again for cancellation
                  if (cancelBulkSyncRef.current) {
                    eventSource.close();
                    currentEventSourceRef.current = null;
                    reject(new Error('CANCELLED'));
                    return;
                  }
                  
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
              }, 500);
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

  const handleDeleteIntegration = async (id: string, deleteData: boolean) => {
    setDeleteDialogOpen(false);
    
    if (!deleteData) {
      // Simple disconnect - just remove integration without deleting data
      try {
        await apiRequest(`/api/integrations/${id}?deleteData=false`, { method: 'DELETE' });
        toast({ title: '✓ Integração removida. Os dados foram preservados.' });
        queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
        setIntegrationToDelete(null);
      } catch (error: any) {
        toast({ 
          title: 'Erro ao remover integração',
          description: error.message,
          variant: 'destructive'
        });
      }
      return;
    }
    
    // Delete with progress modal
    setShowDeleteProgressModal(true);
    setDeleteStartTime(Date.now());
    setDeleteEndTime(undefined);
    
    const accountName = integrationToDelete?.accountName || 'Conta';
    const steps = [
      { name: `Excluindo dados da conta ${accountName}`, status: 'pending' as const },
      { name: 'Removendo integração', status: 'pending' as const },
    ];
    setDeleteSteps(steps);

    try {
      // Step 1: Delete all data
      setDeleteSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      await apiRequest(`/api/integrations/${id}?deleteData=true`, { method: 'DELETE' });
      setDeleteSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success' } : s));

      // Step 2: Mark as complete
      setDeleteSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'loading' } : s));
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 300));
      setDeleteSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'success' } : s));

      setDeleteEndTime(Date.now());
      
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      setIntegrationToDelete(null);
    } catch (error: any) {
      setDeleteEndTime(Date.now());
      setDeleteSteps(prev => prev.map(s => 
        s.status === 'loading' ? { ...s, status: 'error', error: error.message || 'Erro desconhecido' } : s
      ));
      toast({ 
        title: 'Erro ao excluir integração',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Opens the options modal before starting redownload
  const handleRedownloadImages = (integrationId: string) => {
    setPendingRedownloadIntegrationId(integrationId);
    setShowRedownloadOptionsModal(true);
  };
  
  // Process the redownload based on user's choice
  const handleRedownloadOptionSelect = async (mode: 'all' | 'missing') => {
    const integrationId = pendingRedownloadIntegrationId;
    if (!integrationId) return;
    
    setShowRedownloadOptionsModal(false);
    setPendingRedownloadIntegrationId(null);
    
    setRedownloadingImagesId(integrationId);
    setShowRedownloadModal(true);
    setRedownloadComplete(false);
    setRedownloadResult(undefined);
    setRedownloadProgress({ current: 0, total: 0 });
    setRedownloadCurrentCreative(undefined);
    setRedownloadStartTime(Date.now());
    setRedownloadEndTime(undefined);
    
    // Different step labels based on mode
    const steps = mode === 'missing' 
      ? [
          { name: 'Verificando bucket', status: 'pending' as const },
          { name: 'Buscando criativos sem imagem', status: 'pending' as const },
          { name: 'Preparando download', status: 'pending' as const },
          { name: 'Baixando imagens em alta resolução', status: 'pending' as const },
        ]
      : [
          { name: 'Excluindo imagens do bucket', status: 'pending' as const },
          { name: 'Buscando criativos', status: 'pending' as const },
          { name: 'Limpando URLs antigas', status: 'pending' as const },
          { name: 'Baixando imagens em alta resolução', status: 'pending' as const },
        ];
    setRedownloadSteps(steps);

    try {
      const token = localStorage.getItem('auth_token');
      const onlyMissing = mode === 'missing' ? '&onlyMissing=true' : '';
      const eventSource = new EventSource(`/api/integrations/${integrationId}/redownload-images-stream?token=${token}${onlyMissing}`);

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        
        setRedownloadSteps(prev => {
          const newSteps = [...prev];
          const stepIndex = data.step === 'delete' ? 0 : data.step === 'fetch' ? 1 : data.step === 'clear' ? 2 : 3;
          newSteps[stepIndex] = { ...newSteps[stepIndex], status: data.status, message: data.message };
          return newSteps;
        });

        if (data.current !== undefined && data.total !== undefined) {
          setRedownloadProgress({ current: data.current, total: data.total });
        }
        if (data.creativeName) {
          setRedownloadCurrentCreative(data.creativeName);
        }
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        setRedownloadComplete(true);
        setRedownloadEndTime(Date.now());
        setRedownloadResult({
          deleted: data.deleted || 0,
          updated: data.updated || 0,
          failed: data.failed || 0,
          noImage: data.noImage || 0,
          total: data.total || 0
        });
        setRedownloadingImagesId(null);
        eventSource.close();
        
        // Invalidate queries to refresh the creatives
        queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      });

      eventSource.addEventListener('error', (event) => {
        console.error('SSE Error:', event);
        eventSource.close();
        setRedownloadingImagesId(null);
        setRedownloadComplete(true);
        setRedownloadEndTime(Date.now());
        toast({
          title: 'Erro ao re-baixar imagens',
          description: 'Ocorreu um erro durante o processo',
          variant: 'destructive'
        });
      });

    } catch (error: any) {
      toast({
        title: 'Erro ao re-baixar imagens',
        description: error.message,
        variant: 'destructive'
      });
      setRedownloadingImagesId(null);
      setShowRedownloadModal(false);
    }
  };
  
  const handleCloseRedownloadModal = () => {
    setShowRedownloadModal(false);
    setRedownloadComplete(false);
    setRedownloadResult(undefined);
    setRedownloadProgress({ current: 0, total: 0 });
    setRedownloadCurrentCreative(undefined);
  };

  const handleDeleteAllWithProgress = async () => {
    setDeleteAllDialogOpen(false);
    setShowDeleteProgressModal(true);
    setDeleteStartTime(Date.now());
    setDeleteEndTime(undefined);
    
    const steps = [
      { name: 'Excluindo Anúncios (Creatives)', status: 'pending' as const },
      { name: 'Excluindo Grupos de Anúncios', status: 'pending' as const },
      { name: 'Excluindo Campanhas', status: 'pending' as const },
      { name: 'Resetando Estado de Sincronização', status: 'pending' as const },
    ];
    setDeleteSteps(steps);

    try {
      // Step 1: Delete creatives
      setDeleteSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      await apiRequest('/api/creatives/bulk/all', { method: 'DELETE' });
      setDeleteSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success' } : s));

      // Step 2: Delete adsets
      setDeleteSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'loading' } : s));
      await apiRequest('/api/adsets/bulk/all', { method: 'DELETE' });
      setDeleteSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'success' } : s));

      // Step 3: Delete campaigns
      setDeleteSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'loading' } : s));
      await apiRequest('/api/campaigns/bulk/all', { method: 'DELETE' });
      setDeleteSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'success' } : s));

      // Step 4: Reset sync state
      setDeleteSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'loading' } : s));
      await apiRequest('/api/integrations/reset-sync', { method: 'POST' });
      setDeleteSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'success' } : s));

      setDeleteEndTime(Date.now());
      
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    } catch (error: any) {
      setDeleteEndTime(Date.now());
      setDeleteSteps(prev => prev.map(s => 
        s.status === 'loading' ? { ...s, status: 'error', error: error.message || 'Erro desconhecido' } : s
      ));
      toast({ 
        title: 'Erro ao excluir dados',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleCloseDeleteProgress = () => {
    setShowDeleteProgressModal(false);
    setDeleteSteps([]);
    setDeleteStartTime(undefined);
    setDeleteEndTime(undefined);
  };

  // Embedded Signup with Facebook SDK
  const handleEmbeddedSignup = async () => {
    try {
      setIsConnecting(true);
      
      // Get Meta config (appId and configId)
      const config = await apiRequest('/api/auth/meta/config');
      
      if (!config.configured || !config.appId || !config.configId) {
        toast({
          title: 'Configuração incompleta',
          description: 'O Meta Business Extension não está configurado.',
          variant: 'destructive'
        });
        setIsConnecting(false);
        return;
      }

      // Check if FB SDK script is loaded
      const FB = (window as any).FB;
      if (typeof FB === 'undefined') {
        toast({
          title: 'Erro',
          description: 'Facebook SDK não carregou. Tente recarregar a página.',
          variant: 'destructive'
        });
        setIsConnecting(false);
        return;
      }
      
      // Initialize FB SDK with correct appId from backend
      FB.init({
        appId: config.appId,
        cookie: true,
        xfbml: true,
        version: 'v22.0'
      });
      console.log('✅ Facebook SDK initialized with appId:', config.appId);
      
      // Launch embedded signup
      launchEmbeddedSignup(config);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao iniciar Embedded Signup',
        variant: 'destructive'
      });
      setIsConnecting(false);
    }
  };

  const launchEmbeddedSignup = (config: { appId: string; configId: string }) => {
    console.log('🚀 Launching Embedded Signup with config:', config.configId);
    
    (window as any).FB.login(
      function(response: any) {
        if (response.authResponse) {
          const code = response.authResponse.code;
          console.log('✅ Embedded Signup authorization received');
          
          // Use .then() instead of async/await for FB callback
          // Send the origin URL for redirect_uri validation (required for User Token type)
          apiRequest('/api/auth/meta/embedded-signup', {
            method: 'POST',
            body: JSON.stringify({ code, originUrl: window.location.origin })
          }).then((data: any) => {
            if (data.success && data.accounts) {
              console.log(`📊 Found ${data.accounts.length} accounts via Embedded Signup`);
              
              const connectedAccounts = data.accounts.filter((acc: AdAccount) => acc.is_connected);
              const newAccounts = data.accounts.filter((acc: AdAccount) => !acc.is_connected);
              
              // Update tokens for connected accounts using .then()
              const updatePromise = connectedAccounts.length > 0 
                ? apiRequest('/api/auth/meta/update-connected-tokens', {
                    method: 'POST',
                    body: JSON.stringify({
                      userId: user?.id,
                      accessToken: data.accessToken,
                      connectedAccountIds: connectedAccounts.map((acc: AdAccount) => acc.id),
                    }),
                  }).then((updateRes: any) => {
                    if (updateRes.updated > 0) {
                      toast({
                        title: 'Conexões atualizadas!',
                        description: `${updateRes.updated} conta(s) tiveram suas conexões renovadas.`,
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
                    }
                  }).catch((updateError: any) => {
                    console.error('Error updating connected tokens:', updateError);
                  })
                : Promise.resolve();
              
              updatePromise.then(() => {
                if (newAccounts.length > 0) {
                  setOauthAccounts(data.accounts);
                  setOauthToken(data.accessToken);
                  setOauthFacebookUserId(data.facebookUserId || null);
                  setOauthFacebookUserName(data.facebookUserName || null);
                  setShowAccountSelectionModal(true);
                } else if (connectedAccounts.length === 0) {
                  toast({
                    title: 'Nenhuma conta encontrada',
                    description: 'Não foram encontradas contas de anúncios acessíveis. Verifique suas permissões no Business Manager.',
                    variant: 'destructive'
                  });
                }
                setIsConnecting(false);
              });
            } else {
              toast({
                title: 'Erro',
                description: 'Não foi possível obter as contas de anúncios',
                variant: 'destructive'
              });
              setIsConnecting(false);
            }
          }).catch((error: any) => {
            toast({
              title: 'Erro ao processar autorização',
              description: error.message || 'Erro desconhecido',
              variant: 'destructive'
            });
            setIsConnecting(false);
          });
        } else {
          console.log('❌ User cancelled Embedded Signup or authorization failed');
          toast({
            title: 'Cancelado',
            description: 'A autorização foi cancelada',
          });
          setIsConnecting(false);
        }
      },
      {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        scope: 'ads_management,ads_read,business_management,read_insights'
      }
    );
  };

  const handleConnectOAuth = async () => {
    try {
      setIsConnecting(true);
      setShowOAuthModal(true);
      
      const data = await apiRequest('/api/auth/meta/connect');
      
      if (data.authUrl) {
        setOauthUrl(data.authUrl);
        
        // Open popup for Facebook OAuth
        const width = 520;
        const height = 650;
        const left = Math.round((window.screen.width - width) / 2);
        const top = Math.round((window.screen.height - height) / 2);
        
        const popup = window.open(
          data.authUrl,
          'MetaOAuth',
          `popup=yes,width=${width},height=${height},left=${left},top=${top},toolbar=no,scrollbars=yes,status=no,resizable=yes,location=yes,menubar=no`
        );
        
        // Function to fetch OAuth session data
        const fetchOAuthSession = async (sessionId: string) => {
          try {
            const res = await fetch(`/api/auth/meta/oauth-session/${sessionId}`);
            const data = await res.json();
            if (data.accounts && data.accessToken) {
              // Check if there are already connected accounts that need token update
              const connectedAccounts = data.accounts.filter((acc: AdAccount) => acc.is_connected);
              
              if (connectedAccounts.length > 0) {
                // Update tokens for all connected accounts automatically
                try {
                  const updateRes = await apiRequest('/api/auth/meta/update-connected-tokens', {
                    method: 'POST',
                    body: JSON.stringify({
                      userId: user?.id,
                      accessToken: data.accessToken,
                      connectedAccountIds: connectedAccounts.map((acc: AdAccount) => acc.id),
                    }),
                  });
                  
                  if (updateRes.updated > 0) {
                    toast({
                      title: 'Conexões atualizadas!',
                      description: `${updateRes.updated} conta(s) tiveram suas conexões renovadas.`,
                    });
                    queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/auth/meta/check-token'] });
                  }
                } catch (updateError) {
                  console.error('Error updating connected tokens:', updateError);
                }
              }
              
              // Check if there are new accounts to connect
              const newAccounts = data.accounts.filter((acc: AdAccount) => !acc.is_connected);
              
              if (newAccounts.length > 0) {
                // Show account selection modal for new accounts
                setOauthAccounts(data.accounts);
                setOauthToken(data.accessToken);
                setOauthFacebookUserId(data.facebookUserId || null);
                setOauthFacebookUserName(data.facebookUserName || null);
                setShowOAuthModal(false);
                setShowAccountSelectionModal(true);
              } else {
                // All accounts already connected, just close the modal
                setShowOAuthModal(false);
                setShowAccountSelectionModal(false);
              }
              
              setIsConnecting(false);
              localStorage.removeItem('meta_oauth_session');
            }
          } catch (err) {
            console.error('Error fetching OAuth session:', err);
          }
        };
        
        // Listen for OAuth callback message
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'META_OAUTH_ACCOUNTS' && event.data.sessionId) {
            fetchOAuthSession(event.data.sessionId);
            window.removeEventListener('message', handleMessage);
          } else if (event.data.type === 'META_OAUTH_SUCCESS') {
            toast({
              title: 'Conectado com sucesso!',
              description: 'Sua conta Meta Ads foi conectada.',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
            setShowOAuthModal(false);
            setShowAccountSelectionModal(false);
            setOauthUrl(null);
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
          } else if (event.data.type === 'META_OAUTH_ERROR') {
            toast({
              title: 'Erro ao conectar',
              description: event.data.message || 'Ocorreu um erro durante a autenticação',
              variant: 'destructive'
            });
            setShowOAuthModal(false);
            setOauthUrl(null);
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);
        
        // Check if popup was closed and look for session in localStorage
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            
            // Check localStorage for session ID (fallback when postMessage doesn't work)
            const sessionId = localStorage.getItem('meta_oauth_session');
            if (sessionId) {
              fetchOAuthSession(sessionId);
            } else {
              setShowOAuthModal(false);
              setOauthUrl(null);
              setIsConnecting(false);
            }
          }
        }, 500);
      } else {
        toast({
          title: 'Erro ao conectar',
          description: data.error || 'Não foi possível gerar a URL de autenticação',
          variant: 'destructive'
        });
        setShowOAuthModal(false);
        setIsConnecting(false);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Erro ao iniciar processo de autenticação OAuth',
        variant: 'destructive'
      });
      setShowOAuthModal(false);
      setIsConnecting(false);
    }
  };
  
  // Handle selecting an account from the OAuth modal
  const handleSelectOAuthAccount = async (account: AdAccount) => {
    if (account.is_connected) return;
    
    try {
      setConnectingAccountId(account.id);
      
      await apiRequest('/api/auth/meta/select-account', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id,
          accessToken: oauthToken,
          accountId: account.id,
          accountName: account.name,
          accountStatus: account.account_status === 1 ? 'ACTIVE' : 'DISABLED',
          businessId: account.business_id || null,
          businessName: account.business_name || null,
          facebookUserId: oauthFacebookUserId,
          facebookUserName: oauthFacebookUserName
        })
      });
      
      toast({
        title: 'Conta conectada!',
        description: `${account.name} foi conectada com sucesso.`,
      });
      
      // Mark account as connected in the list
      setOauthAccounts(prev => prev.map(acc => 
        acc.id === account.id ? { ...acc, is_connected: true } : acc
      ));
      
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar conta',
        description: error.message || 'Ocorreu um erro ao conectar a conta',
        variant: 'destructive'
      });
    } finally {
      setConnectingAccountId(null);
    }
  };
  
  const handleCloseOAuthModal = () => {
    setShowOAuthModal(false);
    setOauthUrl(null);
    setIsConnecting(false);
  };

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const hasExistingIntegration = metaIntegrations.length > 0;

  // Group integrations by Business Manager
  // With System User Token, accounts without businessId are grouped together as "Contas Conectadas"
  const groupedByBM: BusinessGroup[] = metaIntegrations.reduce((acc: BusinessGroup[], integration) => {
    // If no businessId, group all under "Contas Conectadas" (single card for all personal/system accounts)
    const hasRealBM = integration.businessId && integration.businessId !== 'personal';
    const bmId = hasRealBM ? integration.businessId : 'all_connected';
    const bmName = hasRealBM ? (integration.businessName || 'Business Manager') : 'Contas Conectadas';
    
    let group = acc.find(g => g.businessId === bmId);
    if (!group) {
      group = { businessId: bmId === 'all_connected' ? null : bmId, businessName: bmName, integrations: [] };
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

  const handleAddAccount = async (businessId?: string | null, businessName?: string) => {
    // With System User Token, each authorization is independent
    // So we always start a new Embedded Signup to add more accounts
    setSelectedBusinessId(businessId || null);
    setSelectedBusinessName(businessName || '');
    
    // Start new Embedded Signup to authorize more accounts
    handleEmbeddedSignup();
    return;
    
    // Legacy flow (kept for reference but not used with System User Token)
    if (hasExistingIntegration) {
      setLoadingAccounts(true);
      try {
        const url = businessId 
          ? `/api/auth/meta/ad-accounts?businessId=${businessId}` 
          : '/api/auth/meta/ad-accounts';
        const data = await apiRequest(url);
        
        if (data.tokenExpired || data.error) {
          toast({
            title: 'Conexão expirada',
            description: 'A conexão expirou. Por favor, reconecte ao Meta.',
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
      // First check which connections are inactive
      const tokenChecks = await Promise.all(
        metaIntegrations.map(async (integration) => {
          try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/auth/meta/check-token/${integration.id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) return { id: integration.id, name: integration.accountName, valid: false };
            const data = await res.json();
            return { id: integration.id, name: integration.accountName, valid: data.valid };
          } catch {
            return { id: integration.id, name: integration.accountName, valid: false };
          }
        })
      );
      
      const inactiveConnections = tokenChecks.filter(c => !c.valid);
      
      // If there are inactive connections, start OAuth to re-authenticate
      if (inactiveConnections.length > 0) {
        const inactiveNames = inactiveConnections.map(c => c.name || 'Conta sem nome').join(', ');
        toast({
          title: 'Conexões inativas detectadas',
          description: `${inactiveConnections.length} conta(s) precisam de nova autenticação: ${inactiveNames}. Abrindo autenticação...`,
        });
        setRenewingTokens(false);
        // Start OAuth to re-authenticate
        handleConnectOAuth();
        return;
      }
      
      // All connections are active, try to extend token validity
      const response = await apiRequest('/api/auth/meta/renew-all-tokens', { method: 'POST' });
      
      if (response.failed > 0) {
        toast({
          title: `${response.renewed} conexões renovadas`,
          description: `${response.failed} conexões expiraram e precisam de nova autenticação`,
          variant: 'destructive',
        });
        // Start OAuth for failed ones
        handleConnectOAuth();
      } else {
        toast({
          title: 'Conexões renovadas!',
          description: `${response.renewed} conexões renovadas com sucesso por mais 60 dias`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/meta/check-token'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao renovar conexões',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRenewingTokens(false);
    }
  };

  const handleSyncAll = async () => {
    if (metaIntegrations.length === 0) return;
    
    // First, check if all connections have valid tokens
    const tokenChecks = await Promise.all(
      metaIntegrations.map(async (integration) => {
        try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch(`/api/auth/meta/check-token/${integration.id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) return { id: integration.id, name: integration.accountName, valid: false };
          const data = await res.json();
          return { id: integration.id, name: integration.accountName, valid: data.valid };
        } catch {
          return { id: integration.id, name: integration.accountName, valid: false };
        }
      })
    );
    
    const inactiveConnections = tokenChecks.filter(c => !c.valid);
    
    if (inactiveConnections.length > 0) {
      const inactiveNames = inactiveConnections.map(c => c.name || 'Conta sem nome').join(', ');
      toast({
        title: 'Conexões inativas detectadas',
        description: `As seguintes contas estão com conexão inativa e precisam ser reconectadas: ${inactiveNames}. Clique em "Renovar Conexões" ou reconecte manualmente.`,
        variant: 'destructive',
      });
      return;
    }
    
    const startTime = Date.now();
    cancelBulkSyncRef.current = false;
    isBulkSyncRef.current = true; // Mark that we're in bulk sync mode
    
    const initialAccounts: AccountSyncResult[] = metaIntegrations.map(i => ({
      id: i.id,
      name: i.accountName || 'Conta de Anúncios',
      status: 'pending' as const,
    }));
    
    setBulkSyncAccounts(initialAccounts);
    setBulkSyncCurrentIndex(0);
    setBulkSyncComplete(false);
    setBulkSyncCancelled(false);
    setBulkSyncTotalDuration(undefined);
    setSyncingAll(true);
    setShowBulkSyncModal(true);
    
    let cancelled = false;
    
    for (let i = 0; i < metaIntegrations.length; i++) {
      if (cancelled || cancelBulkSyncRef.current) {
        setBulkSyncAccounts(prev => prev.map((acc, idx) => 
          idx >= i ? { ...acc, status: 'cancelled' as const } : acc
        ));
        cancelled = true;
        break;
      }
      
      const integration = metaIntegrations[i];
      const accountStartTime = Date.now();
      
      setBulkSyncCurrentIndex(i);
      setBulkSyncAccounts(prev => prev.map((acc, idx) => 
        idx === i ? { ...acc, status: 'syncing' as const } : acc
      ));
      
      try {
        const result = await syncMutation.mutateAsync(integration.id) as any;
        
        if (cancelBulkSyncRef.current) {
          cancelled = true;
          setBulkSyncAccounts(prev => prev.map((acc, idx) => 
            idx >= i ? { ...acc, status: 'cancelled' as const } : acc
          ));
          break;
        }
        
        const accountDuration = Date.now() - accountStartTime;
        
        setBulkSyncAccounts(prev => prev.map((acc, idx) => 
          idx === i ? { 
            ...acc, 
            status: 'success' as const,
            campaigns: result?.data?.campaigns || 0,
            adSets: result?.data?.adSets || 0,
            creatives: result?.data?.creatives || 0,
            duration: accountDuration,
          } : acc
        ));
      } catch (error: any) {
        // Check if this is a cancellation (either from ref or from error message)
        if (cancelBulkSyncRef.current || error.message === 'CANCELLED') {
          cancelled = true;
          const accountDuration = Date.now() - accountStartTime;
          setBulkSyncAccounts(prev => prev.map((acc, idx) => 
            idx === i ? { ...acc, status: 'cancelled' as const, duration: accountDuration } :
            idx > i ? { ...acc, status: 'cancelled' as const } : acc
          ));
          break;
        }
        
        setBulkSyncAccounts(prev => prev.map((acc, idx) => 
          idx === i ? { 
            ...acc, 
            status: 'error' as const,
            error: error.message || 'Erro desconhecido',
            duration: Date.now() - accountStartTime,
          } : acc
        ));
      }
    }
    
    const totalDuration = Date.now() - startTime;
    setBulkSyncTotalDuration(totalDuration);
    setBulkSyncComplete(true);
    setBulkSyncCancelled(cancelled);
    setSyncingAll(false);
    isBulkSyncRef.current = false; // Reset bulk sync mode
  };

  const handleCancelBulkSync = () => {
    cancelBulkSyncRef.current = true;
    
    // Close the active EventSource connection immediately
    if (currentEventSourceRef.current) {
      currentEventSourceRef.current.close();
      currentEventSourceRef.current = null;
    }
    
    isBulkSyncRef.current = false; // Reset bulk sync mode when cancelling
  };

  const handleCloseBulkSyncModal = () => {
    setShowBulkSyncModal(false);
    setBulkSyncAccounts([]);
    setBulkSyncCurrentIndex(0);
    setBulkSyncComplete(false);
    setBulkSyncCancelled(false);
    setBulkSyncTotalDuration(undefined);
    isBulkSyncRef.current = false; // Ensure bulk sync mode is reset
  };

  const handleCancelIndividualSync = () => {
    // Close the active EventSource connection
    if (currentEventSourceRef.current) {
      currentEventSourceRef.current.close();
      currentEventSourceRef.current = null;
    }
    setShowSyncModal(false);
    toast({
      title: 'Sincronização cancelada',
      description: 'A sincronização foi interrompida.',
    });
  };

  // Wrapper function for single sync with token validation
  const handleSyncSingle = async (integration: Integration) => {
    try {
      // Check if connection has valid token
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/auth/meta/check-token/${integration.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        toast({
          title: 'Erro ao verificar conexão',
          description: 'Não foi possível verificar o status da conexão.',
          variant: 'destructive',
        });
        return;
      }
      
      const data = await res.json();
      
      if (!data.valid) {
        toast({
          title: 'Conexão inativa',
          description: `A conta "${integration.accountName || 'Conta de Anúncios'}" está com a conexão inativa. Clique em "Reconectar" para renovar a conexão.`,
          variant: 'destructive',
        });
        return;
      }
      
      // Token is valid, proceed with sync
      syncMutation.mutate(integration.id);
    } catch (error) {
      toast({
        title: 'Erro ao verificar conexão',
        description: 'Ocorreu um erro ao verificar o status da conexão.',
        variant: 'destructive',
      });
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
        onCancel={handleCancelIndividualSync}
      />
      
      <BulkSyncModal
        open={showBulkSyncModal}
        accounts={bulkSyncAccounts}
        currentIndex={bulkSyncCurrentIndex}
        totalAccounts={bulkSyncAccounts.length}
        isComplete={bulkSyncComplete}
        isCancelled={bulkSyncCancelled}
        totalDuration={bulkSyncTotalDuration}
        currentSyncSteps={syncSteps}
        onCancel={handleCancelBulkSync}
        onClose={handleCloseBulkSyncModal}
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
                        onClick={handleEmbeddedSignup} 
                        size="sm"
                        disabled={isConnecting}
                        data-testid="button-connect-meta-embedded"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {isConnecting ? 'Conectando...' : 'Adicionar Integração'}
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
                                  onClick={handleSyncAll}
                                  disabled={syncingAll || syncMutation.isPending}
                                  data-testid={`button-sync-all-${group.businessId}`}
                                >
                                  {syncingAll ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  Sincronizar Tudo
                                </Button>
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
                                  Renovar Conexões
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddAccount(group.businessId, group.businessName)}
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
                                    onSync={() => handleSyncSingle(integration)}
                                    onDelete={() => {
                                      setIntegrationToDelete(integration);
                                      setDeleteDialogOpen(true);
                                    }}
                                    onRenewToken={handleConnectOAuth}
                                    onRedownloadImages={() => handleRedownloadImages(integration.id)}
                                    isSyncing={syncMutation.isPending}
                                    isRedownloadingImages={redownloadingImagesId === integration.id}
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
            handleDeleteIntegration(integrationToDelete.id, deleteAllData);
          }
        }}
        isDeleting={false}
      />

      <DeleteAllDataDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        onConfirm={handleDeleteAllWithProgress}
        isDeleting={false}
        dataType="Dados Meta"
        count={campaigns.length + adSets.length + creatives.length}
      />

      <DeleteProgressModal
        open={showDeleteProgressModal}
        steps={deleteSteps}
        startTime={deleteStartTime}
        endTime={deleteEndTime}
        onClose={handleCloseDeleteProgress}
      />

      <RedownloadOptionsModal
        open={showRedownloadOptionsModal}
        onClose={() => {
          setShowRedownloadOptionsModal(false);
          setPendingRedownloadIntegrationId(null);
        }}
        onSelect={handleRedownloadOptionSelect}
      />

      <RedownloadProgressModal
        open={showRedownloadModal}
        onClose={handleCloseRedownloadModal}
        steps={redownloadSteps}
        currentCreative={redownloadCurrentCreative}
        downloadProgress={redownloadProgress}
        isComplete={redownloadComplete}
        result={redownloadResult}
        startTime={redownloadStartTime}
        endTime={redownloadEndTime}
      />

      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Adicionar Conta de Anúncios
              {selectedBusinessName && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  - {selectedBusinessName}
                </span>
              )}
            </DialogTitle>
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

      {/* OAuth Status Modal */}
      <Dialog open={showOAuthModal} onOpenChange={(open) => !open && handleCloseOAuthModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiFacebook className="w-5 h-5 text-blue-600" />
              Conectando ao Meta
            </DialogTitle>
            <DialogDescription>
              Complete a autenticação na janela que foi aberta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <SiFacebook className="w-8 h-8 text-blue-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uma janela foi aberta para autenticação.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Após autorizar, esta janela será atualizada automaticamente.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleCloseOAuthModal}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Selection Modal after OAuth */}
      <Dialog open={showAccountSelectionModal} onOpenChange={(open) => !open && setShowAccountSelectionModal(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiFacebook className="w-5 h-5 text-blue-600" />
              Gerenciar Contas de Anúncios
            </DialogTitle>
            <DialogDescription>
              Encontramos {oauthAccounts.length} conta(s) nos Business Managers autorizados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto py-2">
            {(() => {
              // Separate connected and new accounts
              const connectedAccounts = oauthAccounts.filter(acc => acc.is_connected);
              const newAccounts = oauthAccounts.filter(acc => !acc.is_connected);
              
              // Group new accounts by Business Manager
              const groupedNewAccounts = newAccounts.reduce((acc, account) => {
                const bmName = account.business_name || 'Conta Pessoal';
                if (!acc[bmName]) {
                  acc[bmName] = [];
                }
                acc[bmName].push(account);
                return acc;
              }, {} as Record<string, AdAccount[]>);

              return (
                <>
                  {/* Connected accounts section */}
                  {connectedAccounts.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Contas Já Conectadas ({connectedAccounts.length})
                      </h4>
                      <p className="text-xs text-green-700 dark:text-green-400 mb-3">
                        Os tokens dessas contas foram renovados automaticamente.
                      </p>
                      <div className="space-y-2">
                        {connectedAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500 font-mono">{account.id}</span>
                                  <span className="text-xs text-gray-500">{account.business_name || 'Conta Pessoal'}</span>
                                </div>
                              </div>
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                Token Renovado
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New accounts section */}
                  {newAccounts.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Novas Contas Disponíveis ({newAccounts.length})
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                        Clique em uma conta para adicioná-la ao sistema.
                      </p>
                      {Object.entries(groupedNewAccounts).map(([bmName, accounts]) => (
                        <div key={bmName} className="mb-3 last:mb-0">
                          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                            🏢 {bmName}
                          </h5>
                          <div className="space-y-2">
                            {accounts.map((account) => (
                              <button
                                key={account.id}
                                onClick={() => handleSelectOAuthAccount(account)}
                                disabled={connectingAccountId === account.id}
                                className={`w-full p-3 rounded-lg bg-white dark:bg-gray-900 border text-left flex items-center justify-between transition-colors ${
                                  connectingAccountId === account.id
                                    ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/50'
                                    : 'border-blue-200 dark:border-blue-700 hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer'
                                }`}
                              >
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 font-mono">{account.id}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      account.account_status === 1 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                    }`}>
                                      {account.account_status === 1 ? 'Ativa' : 'Desativada'}
                                    </span>
                                  </div>
                                </div>
                                {connectingAccountId === account.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                ) : (
                                  <Plus className="w-5 h-5 text-blue-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No accounts message */}
                  {connectedAccounts.length === 0 && newAccounts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma conta de anúncios encontrada nos Business Managers autorizados.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowAccountSelectionModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
