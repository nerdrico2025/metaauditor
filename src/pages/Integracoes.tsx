import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyIntegrations, calculateDaysUntilExpiry, type IntegrationWithMetrics } from "@/hooks/useCompanyIntegrations";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { useToast } from "@/hooks/use-toast";
import { supabase, type Integration } from "@/integrations/supabase/client";
import { logActivity } from '@/lib/activityLog';
import { AssetSelectionModal } from '@/components/integrations/AssetSelectionModal';
import {
    Facebook,
    RefreshCw,
    Unlink,
    Trash2,
    Loader2,
    Search,
    AlertTriangle,
    Globe,
    Building2,
    ChevronDown,
    BrainCircuit,
    CheckCircle,
    ShieldCheck,
    Activity,
    Zap,
    Database,
    CloudDownload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FacebookOAuthButton } from "@/components/integrations/FacebookOAuthButton";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsNav } from '@/components/settings/SettingsNav';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import { META_SYNC_STEPS } from '@/components/common/syncLikeOverlayPresets';

type SyncResultRow = {
    integration_id?: string;
    status?: string;
    items_synced?: number;
    metrics_warnings?: string[];
};

function collectMetricsWarnings(results: SyncResultRow[] | undefined): string[] {
    if (!results?.length) return [];
    const warnings: string[] = [];
    for (const row of results) {
        if (Array.isArray(row.metrics_warnings)) {
            warnings.push(...row.metrics_warnings);
        }
    }
    return warnings;
}

function showMetricsWarningsToast(
    toastFn: ReturnType<typeof useToast>['toast'],
    warnings: string[],
) {
    if (warnings.length === 0) return;
    const preview = warnings.slice(0, 2).join(' · ');
    const extra = warnings.length > 2 ? ` (+${warnings.length - 2} avisos)` : '';
    toastFn({
        title: 'Avisos na sincronização de métricas',
        description: `${preview}${extra}`,
    });
}


export default function Integracoes() {
    const { user } = useAuth();
    // D2 (briefing #10): manual sync exposed only to platform admins.
    const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';
    const { toast } = useToast();
    const { data: integrations, isLoading, refetch: fetchIntegrations } = useCompanyIntegrations(user?.company_id);
    const { data: company } = useCompany();
    const maxMonitoredAccounts = company?.max_integrations ?? 15;
    const queryClient = useQueryClient();
    const [syncing, setSyncing] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'active' | 'disconnected' | 'error'>('todos');
    const [expandedBMs, setExpandedBMs] = useState<Set<string>>(new Set());

    // Sync overlay state
    const [isSyncOverlayVisible, setIsSyncOverlayVisible] = useState(false);
    const [syncStepLabel, setSyncStepLabel] = useState('');
    const [syncStepIndex, setSyncStepIndex] = useState(0);
    const [syncTotalSteps, setSyncTotalSteps] = useState(0);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncFinished, setSyncFinished] = useState(false);

    // Detecta retorno do OAuth e atualiza a lista
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('source') === 'meta_oauth') {
            void logActivity({
                eventType: 'action',
                action: 'integration.connect',
                path: '/integracoes',
                metadata: { platform: 'meta' },
            });
            // Limpa os query params da URL sem reload
            window.history.replaceState({}, '', window.location.pathname);
            fetchIntegrations();
        }
    }, []);

    // Asset Selection Modal state
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);

    // Lista base: apenas contas com account_id
    const integrationsList: IntegrationWithMetrics[] = (integrations || []).filter(i => !!i.account_id);

    // Helper para obter o tipo de conta
    const getAccountType = (i: IntegrationWithMetrics): string =>
        (i.permissions as any)?.account_type || 'ads_account';

    // Helper para detectar contas non-ads pelo nome (fallback para contas classificadas antes do fix)
    const isNonAdsAccount = (i: IntegrationWithMetrics): boolean => {
        const name = (i.account_name || '').toLowerCase();
        const type = getAccountType(i);
        return type !== 'ads_account' ||
            name.includes('(read-only)') ||
            name.includes('(read only)') ||
            name.includes('atendimento') ||
            name.includes('whatsapp') ||
            name.includes('disparo');
    };

    // Separação: só contas de anúncio reais
    const adsAccounts = integrationsList.filter(i => !isNonAdsAccount(i));

    // Filter logic: aplica busca e status apenas nas contas de anúncio principais
    const filteredIntegrations = adsAccounts.filter(i => {
        const matchesSearch = (i.account_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (i.account_id?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'todos' ? true : i.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Grouping for the main list (Back to BM grouping for better org)
    const groupedIntegrations = filteredIntegrations.reduce((acc, integration) => {
        const bmId = (integration.permissions as any)?.business_manager_id || 'no-bm';
        const bmName = (integration.permissions as any)?.business_manager_name || 'Sem Business Manager';
        if (!acc[bmId]) {
            acc[bmId] = { id: bmId, name: bmName, integrations: [] };
        }
        acc[bmId].integrations.push(integration);
        return acc;
    }, {} as Record<string, { id: string; name: string; integrations: IntegrationWithMetrics[] }>);

    const bmListForDisplay = Object.values(groupedIntegrations);

    // Helper: garante token válido antes de invocar edge function
    const invokeWithAuth = async (fn: string, body: object) => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        return supabase.functions.invoke(fn, {
            body,
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
    };

    // Dispara todas as automações pós-sync (silenciosas, best-effort)
    const triggerPostSyncAutomations = async () => {
        try {
            // 1. Auditoria de compliance (policies)
            const auditPromise = invokeWithAuth('audit-batch', { limit: 50, audit_focus: 'performance' }).then(({ error }) => {
                if (!error) {
                    queryClient.invalidateQueries({ queryKey: ['recent-audits'] });
                    queryClient.invalidateQueries({ queryKey: ['high-priority-issues'] });
                    queryClient.invalidateQueries({ queryKey: ['audits'] });
                }
            }).catch(() => {});

            // 2. Verificação de regras criativas (creative_rules)
            const rulesCheckPromise = invokeWithAuth('check-creative-rules-batch', { limit: 30 }).then(({ error }) => {
                if (!error) {
                    queryClient.invalidateQueries({ queryKey: ['creative-rule-checks-batch'] });
                    queryClient.invalidateQueries({ queryKey: ['creative-rule-check'] });
                }
            }).catch(() => {});

            // 3. Avaliação de regras de performance (automation_rules)
            const perfRulesPromise = invokeWithAuth('evaluate-performance-rules', {}).then(({ error, data }) => {
                if (!error) {
                    queryClient.invalidateQueries({ queryKey: ['performance-compliance'] });
                    queryClient.invalidateQueries({ queryKey: ['performance-rule-breakdown'] });
                    queryClient.invalidateQueries({ queryKey: ['performance-rules'] });
                }
                if (!error && data?.triggers_fired > 0) {
                    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
                    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
                    toast({
                        title: 'Regras de performance executadas',
                        description: `${data.triggers_fired} regra(s) disparada(s) automaticamente.`,
                    });
                }
            }).catch(() => {});

            await Promise.allSettled([auditPromise, rulesCheckPromise, perfRulesPromise]);
        } catch {
            // Automações pós-sync são best-effort, não bloqueiam o fluxo
        }
    };

    const handleToggleMonitored = async (integrationId: string, currentValue: boolean) => {
        const newValue = !currentValue;

        if (newValue) {
            const monitoredCount = (integrations ?? []).filter(
                (i) => i.platform === 'meta' && i.is_monitored === true && i.id !== integrationId,
            ).length;
            if (monitoredCount >= maxMonitoredAccounts) {
                toast({
                    title: 'Limite de contas atingido',
                    description: `Sua equipe pode monitorar no máximo ${maxMonitoredAccounts} contas de anúncio. Desative uma conta antes de ativar outra.`,
                    variant: 'destructive',
                });
                return;
            }
        }

        // Optimistic update — instant UI response
        queryClient.setQueryData(['company-integrations', user?.company_id], (old: IntegrationWithMetrics[] | undefined) =>
            old?.map(i => i.id === integrationId ? { ...i, is_monitored: newValue } : i)
        );
        try {
            const { error } = await supabase
                .from('integrations')
                .update({ is_monitored: newValue })
                .eq('id', integrationId);
            if (error) throw error;
            // Invalidate creatives/campaigns caches so they reflect the new monitored state
            queryClient.invalidateQueries({ queryKey: ['creatives'] });
            queryClient.invalidateQueries({ queryKey: ['creatives-count'] });
            queryClient.invalidateQueries({ queryKey: ['top-creatives'] });
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        } catch (err: unknown) {
            // Revert on error
            queryClient.setQueryData(['company-integrations', user?.company_id], (old: IntegrationWithMetrics[] | undefined) =>
                old?.map(i => i.id === integrationId ? { ...i, is_monitored: currentValue } : i)
            );
            const msg = err instanceof Error ? err.message : String(err);
            const isLimit = msg.includes('Limite de') || msg.includes('monitoradas');
            toast({
                title: isLimit ? 'Limite de contas atingido' : 'Erro ao atualizar',
                description: isLimit
                    ? `Máximo de ${maxMonitoredAccounts} contas monitoradas por organização.`
                    : 'Não foi possível alterar o monitoramento.',
                variant: 'destructive',
            });
        }
    };

    // Overlay animation runner — polls DB for real sync progress
    const runSyncWithOverlay = async (syncFn: () => Promise<void>, integrationIds: string[]) => {
        setIsSyncOverlayVisible(true);
        setSyncFinished(false);
        setSyncProgress(0);

        const totalAccounts = integrationIds.length;
        const steps = [
            { label: "Diagnosticando volume de dados", subtitle: `${totalAccounts} conta${totalAccounts > 1 ? 's' : ''} selecionada${totalAccounts > 1 ? 's' : ''}` },
            { label: "Conectando à API do Meta", subtitle: "Autenticando credenciais" },
            { label: "Sincronizando campanhas e conjuntos", subtitle: "Importando hierarquia de ads" },
            { label: "Importando criativos e métricas", subtitle: "Baixando dados de performance" },
            { label: "Auditando compliance e regras", subtitle: "Verificando políticas ativas" },
            { label: "Finalizando sincronização", subtitle: "Aguardando confirmação do servidor" },
        ];
        setSyncTotalSteps(steps.length);
        setSyncStepIndex(0);

        // Record sync start time for DB polling
        const syncStartTime = new Date().toISOString();
        let syncDone = false;
        let currentProgress = 0;

        // Safety timeout: force syncDone after 120s to prevent infinite overlay
        const safetyTimeout = setTimeout(() => { syncDone = true; }, 120_000);

        // Start the actual sync — runs in background
        const syncPromise = syncFn()
            .then(() => { syncDone = true; })
            .catch(() => { syncDone = true; });

        // Helper: interruptible sleep that exits early when syncDone
        const sleepUntil = async (ms: number) => {
            const start = Date.now();
            while (Date.now() - start < ms && !syncDone) {
                await new Promise(r => setTimeout(r, 200));
            }
        };

        // --- Phase 1: Diagnostic (0% → 15%) — fixed 3s ---
        setSyncStepLabel(steps[0].label);
        const diagStart = Date.now();
        while (Date.now() - diagStart < 3000 && !syncDone) {
            const elapsed = Date.now() - diagStart;
            currentProgress = Math.round((elapsed / 3000) * 15);
            setSyncProgress(currentProgress);
            await new Promise(r => setTimeout(r, 200));
        }

        // --- Phase 2: Real progress via DB polling (15% → 90%) ---
        if (!syncDone) {
            setSyncStepIndex(1);
            setSyncStepLabel(steps[1].label);
            currentProgress = 15;
            let lastSyncedCount = 0;

            while (!syncDone) {
                // Poll the DB: count integrations whose last_sync_at was updated after we started
                try {
                    const { data } = await supabase
                        .from('integrations')
                        .select('id')
                        .in('id', integrationIds)
                        .gt('last_sync_at', syncStartTime);

                    const syncedCount = data?.length || 0;

                    if (syncedCount > lastSyncedCount) {
                        lastSyncedCount = syncedCount;
                        // Map real progress: synced/total → 15%-90% range
                        const realTarget = 15 + Math.round((syncedCount / totalAccounts) * 75);
                        currentProgress = Math.max(currentProgress, Math.min(realTarget, 90));

                        // Update step label based on how far along we are
                        const fraction = syncedCount / totalAccounts;
                        if (fraction >= 0.8) {
                            setSyncStepIndex(4);
                            setSyncStepLabel(steps[4].label);
                        } else if (fraction >= 0.4) {
                            setSyncStepIndex(3);
                            setSyncStepLabel(steps[3].label);
                        } else {
                            setSyncStepIndex(2);
                            setSyncStepLabel(steps[2].label);
                        }
                    } else {
                        // No new accounts synced — creep progress slowly (+1% max, capped at 90%)
                        currentProgress = Math.min(currentProgress + 1, 90);
                    }
                } catch {
                    // DB poll failed — just creep slowly
                    currentProgress = Math.min(currentProgress + 1, 90);
                }

                setSyncProgress(currentProgress);
                // Interruptible sleep — checks syncDone every 200ms instead of blocking 4s
                await sleepUntil(2000);
            }
        }

        clearTimeout(safetyTimeout);

        // --- Phase 3: Done — animate to 100% ---
        setSyncStepIndex(steps.length - 1);
        setSyncStepLabel("Concluído!");

        // Smooth animation from current to 100%
        for (let p = Math.max(currentProgress, 90); p <= 100; p += 2) {
            setSyncProgress(p);
            await new Promise(r => setTimeout(r, 80));
        }
        setSyncProgress(100);
        setSyncFinished(true);
        await new Promise(r => setTimeout(r, 800));

        // Wait for sync promise to fully settle (should already be done)
        await syncPromise;

        // Cleanup
        setIsSyncOverlayVisible(false);
        setSyncStepLabel('');
        setSyncStepIndex(0);
        setSyncProgress(0);
        setSyncFinished(false);
    };

    // Shared batch sync helper — processes IDs in groups of 3 to avoid Edge Function timeout
    const SYNC_BATCH_SIZE = 3;

    const runBatchSync = async (ids: string[], syncingKey: string, toastTitle: string) => {
        setSyncing(syncingKey);
        let syncSuccess = false;

        await runSyncWithOverlay(async () => {
            let totalSuccess = 0;
            let totalItems = 0;
            let lastError: string | null = null;
            const allMetricsWarnings: string[] = [];

            for (let idx = 0; idx < ids.length; idx += SYNC_BATCH_SIZE) {
                const batch = ids.slice(idx, idx + SYNC_BATCH_SIZE);
                try {
                    // Fase 1: entidades (campanhas/adsets/ads/cache de imagens)
                    const { data, error } = await invokeWithAuth('sync-meta-data', {
                        integration_id: batch, sync_type: 'full'
                    });
                    if (error) throw error;

                    totalSuccess += data?.results?.filter((r: any) => r.status === 'success' || r.status === 'completed_with_errors' || r.status === 'completed_no_data').length || 0;
                    totalItems += data?.results?.reduce((acc: number, r: any) => acc + (r.items_synced || 0), 0) || 0;

                    // Fase 2: métricas (insights) — invocação separada pra cada batch ter
                    // seu próprio orçamento de ~150s e não bater WORKER_RESOURCE_LIMIT.
                    const idsForMetrics = (data?.results || [])
                        .filter((r: any) => r.status !== 'error' && r.status !== 'skipped_special_account')
                        .map((r: any) => r.integration_id);
                    if (idsForMetrics.length > 0) {
                        const { data: mData, error: mError } = await invokeWithAuth('sync-meta-data', {
                            integration_id: idsForMetrics, sync_type: 'metrics_only'
                        });
                        if (mError) {
                            lastError = mError.message || 'Erro ao sincronizar métricas';
                        } else {
                            totalItems += mData?.results?.reduce((acc: number, r: any) => acc + (r.items_synced || 0), 0) || 0;
                            allMetricsWarnings.push(...collectMetricsWarnings(mData?.results));
                        }
                    }
                } catch (err: any) {
                    lastError = err.message || 'Erro desconhecido';
                    // Continue with remaining batches instead of aborting
                }
            }

            if (totalSuccess > 0) {
                void logActivity({
                    eventType: 'action',
                    action: 'sync.meta',
                    metadata: { integration_ids: ids, scope: syncingKey },
                });
                triggerPostSyncAutomations();
                syncSuccess = true;
            }

            if (lastError && totalSuccess < ids.length) {
                toast({
                    title: totalSuccess > 0 ? 'Sincronização parcial' : 'Erro na sincronização',
                    description: totalSuccess > 0
                        ? `${totalSuccess} de ${ids.length} contas sincronizadas. ${totalItems} itens. Algumas contas falharam.`
                        : lastError,
                    variant: totalSuccess > 0 ? 'default' : 'destructive',
                });
            } else {
                toast({
                    title: toastTitle,
                    description: `${totalSuccess} de ${ids.length} contas sincronizadas. ${totalItems} itens atualizados.`,
                });
            }

            showMetricsWarningsToast(toast, allMetricsWarnings);

            setSyncing(null);
        }, ids);

        if (syncSuccess) {
            window.location.reload();
        }
    };

    const handleSyncAll = async () => {
        const monitored = adsAccounts.filter(i => i.is_monitored === true);
        if (monitored.length === 0) {
            toast({ title: 'Nenhuma conta selecionada', description: 'Ative o monitoramento em pelo menos uma conta para sincronizar.', variant: 'destructive' });
            return;
        }
        await runBatchSync(monitored.map(i => i.id), 'all-sync', 'Sincronização geral concluída');
    };

    const handleSync = async (integrationId: string) => {
        setSyncing(integrationId);
        let syncSuccess = false;

        await runSyncWithOverlay(async () => {
            try {
                console.log(`[Sync] Triggering individual sync for ${integrationId}`);

                // Fase 1: entidades
                const { data, error } = await invokeWithAuth('sync-meta-data', {
                    integration_id: integrationId, sync_type: 'full'
                });

                if (error) {
                    console.error('Edge Function error:', error);
                    throw error;
                }

                let itemsSynced = data.results?.[0]?.items_synced || 0;
                const status = data.results?.[0]?.status;
                const metricsWarnings: string[] = [];

                // Fase 2: métricas (insights) — invocação separada, orçamento próprio
                if (status !== 'error' && status !== 'skipped_special_account') {
                    try {
                        const { data: mData, error: mError } = await invokeWithAuth('sync-meta-data', {
                            integration_id: integrationId, sync_type: 'metrics_only'
                        });
                        if (mError) {
                            console.error('Metrics sync error:', mError);
                        } else {
                            itemsSynced += mData?.results?.[0]?.items_synced || 0;
                            metricsWarnings.push(...collectMetricsWarnings(mData?.results));
                        }
                    } catch (mErr) {
                        console.error('Metrics phase failed:', mErr);
                    }
                }

                toast({
                    title: status === 'error' ? 'Erro na Sincronização' : 'Sincronização concluída',
                    description: status === 'error'
                        ? `Falha: ${data.results?.[0]?.error || 'Erro desconhecido'}`
                        : `${itemsSynced} itens sincronizados com sucesso.`,
                    variant: status === 'error' ? 'destructive' : 'default'
                });

                showMetricsWarningsToast(toast, metricsWarnings);

                triggerPostSyncAutomations();
                if (status !== 'error') {
                    void logActivity({
                        eventType: 'action',
                        action: 'sync.meta',
                        resourceType: 'integration',
                        resourceId: integrationId,
                    });
                    syncSuccess = true;
                } else {
                    fetchIntegrations();
                }
            } catch (error: any) {
                console.error('Sync error details:', error);
                toast({
                    title: 'Erro na sincronização',
                    description: error.message || 'Não foi possível completar a sincronização.',
                    variant: 'destructive',
                });
            } finally {
                setSyncing(null);
            }
        }, [integrationId]);

        // Reload AFTER overlay is fully dismissed
        if (syncSuccess) {
            window.location.reload();
        }
    };

    const handleSyncBM = async (bmIntegrations: IntegrationWithMetrics[]) => {
        const monitoredOnly = bmIntegrations.filter(i => i.is_monitored === true);
        if (monitoredOnly.length === 0) {
            toast({ title: 'Nenhuma conta selecionada', description: 'Ative o monitoramento em pelo menos uma conta para sincronizar.', variant: 'destructive' });
            return;
        }
        await runBatchSync(monitoredOnly.map(i => i.id), 'bm-sync', 'Sincronização concluída');
    };

    const handleDisconnect = async (integrationId: string) => {
        if (!confirm('Tem certeza que deseja desconectar esta conta?')) return;
        try {
            const { error } = await supabase.from('integrations').update({ status: 'disconnected' }).eq('id', integrationId);
            if (error) throw error;
            void logActivity({
                eventType: 'action',
                action: 'integration.disconnect',
                resourceType: 'integration',
                resourceId: integrationId,
            });
            toast({ title: 'Conta desconectada', description: 'A integração foi removida com sucesso.' });
            fetchIntegrations();
        } catch (error) {
            toast({ title: 'Erro ao desconectar', description: 'Falha ao remover integração.', variant: 'destructive' });
        }
    };

    const handleRemoveAccount = async (integrationId: string, accountName: string) => {
        if (!confirm(`ATENÇÃO: Isso vai remover permanentemente a conta "${accountName}" e TODOS os dados associados (campanhas, conjuntos, criativos, métricas). Esta ação não pode ser desfeita. Deseja continuar?`)) return;

        setRemoving(integrationId);
        try {
            // Tentativa primária via Edge Function (caso já tenha sido deployada na nuvem)
            const edgeResult = await supabase.functions.invoke('remove-integration', {
                body: { integration_id: integrationId }
            });

            // Se a função não existir, der 404, ou erro, usar o fallback manual:
            if (edgeResult.error) {
                console.warn("Edge function falhou, tentando remoção manual em cascata...", edgeResult.error);

                // 1. Buscar as campanhas atreladas
                const { data: camps } = await supabase.from('campaigns').select('id').eq('integration_id', integrationId);
                const campIds = camps?.map(c => c.id) || [];

                if (campIds.length > 0) {
                    // Excluir as "child tables" primeiro para não violar Foreign Key (criativos, ad sets, métricas)
                    await supabase.from('creative_tags').delete().in('creative_id', (await supabase.from('creatives').select('id').in('campaign_id', campIds)).data?.map(c => c.id) || []);
                    await supabase.from('creatives').delete().in('campaign_id', campIds);
                    await supabase.from('ad_sets').delete().in('campaign_id', campIds);
                    await supabase.from('campaign_metrics').delete().in('campaign_id', campIds);
                    await supabase.from('campaign_tags').delete().in('campaign_id', campIds);
                }

                // Excluir campanhas
                await supabase.from('campaigns').delete().eq('integration_id', integrationId);
                // Excluir histórico de sincronização
                await supabase.from('sync_history').delete().eq('integration_id', integrationId);

                // Finalmente deletar a integração
                const { error: deleteError } = await supabase.from('integrations').delete().eq('id', integrationId);
                if (deleteError) throw deleteError;
            }

            toast({
                title: 'Conta removida',
                description: `A conta "${accountName}" e todos os dados associados foram removidos permanentemente.`,
            });

            fetchIntegrations();
        } catch (error) {
            console.error('Remove account error:', error);
            // Em caso de falha severa que a interface não consegue deletar (por ex. RLS restrita), no mínimo desconectar para esconder na dashboard
            await supabase.from('integrations').update({ status: 'disconnected' }).eq('id', integrationId);
            toast({
                title: 'Desconectada por Erro de Exclusão',
                description: 'A conta não pôde ser excluída do banco permanentemente, mas foi desativada e todo o conteúdo ocultado.',
                variant: 'destructive',
            });
            fetchIntegrations();
        } finally {
            setRemoving(null);
        }
    };

    const handleDisconnectPlatform = async (platform: string) => {
        if (!confirm(`Tem certeza que deseja desconectar TODAS as contas do ${platform === 'meta' ? 'Facebook' : platform}? Isso removerá o acesso e todos os dados de todas as contas vinculadas a esta plataforma.`)) return;

        try {
            // Fetch all integrations for this platform
            const { data: platformIntegrations } = await supabase
                .from('integrations')
                .select('id')
                .eq('company_id', user?.company_id)
                .eq('platform', platform);

            const integrationIds = platformIntegrations?.map(i => i.id) || [];

            if (integrationIds.length > 0) {
                // 1. Fetch related campaigns
                const { data: camps } = await supabase.from('campaigns').select('id').in('integration_id', integrationIds);
                const campIds = camps?.map(c => c.id) || [];

                if (campIds.length > 0) {
                    // Cascade delete for campaigns' children
                    await supabase.from('creative_tags').delete().in('creative_id', (await supabase.from('creatives').select('id').in('campaign_id', campIds)).data?.map(c => c.id) || []);
                    await supabase.from('creatives').delete().in('campaign_id', campIds);
                    await supabase.from('ad_sets').delete().in('campaign_id', campIds);
                    await supabase.from('campaign_metrics').delete().in('campaign_id', campIds);
                    await supabase.from('campaign_tags').delete().in('campaign_id', campIds);
                }

                // Delete campaigns and auth/sync history
                await supabase.from('campaigns').delete().in('integration_id', integrationIds);
                await supabase.from('sync_history').delete().in('integration_id', integrationIds);

                // Delete the integrations themselves
                const { error } = await supabase
                    .from('integrations')
                    .delete()
                    .in('id', integrationIds);

                if (error) throw error;
            }

            toast({
                title: 'Plataforma Desconectada e Limpa',
                description: 'Todas as conexões e os dados do Facebook foram removidos permanentemente.'
            });
            fetchIntegrations();
        } catch (error) {
            console.error('Error disconnecting platform:', error);

            // Fallback soft-disconnect
            await supabase
                .from('integrations')
                .update({ status: 'disconnected' })
                .eq('company_id', user?.company_id)
                .eq('platform', platform);

            toast({
                title: 'Desconectado com Erros',
                description: 'Plataforma desconectada, porém houve erros ao limpar dados permanentemente.',
                variant: 'destructive'
            });
            fetchIntegrations();
        }
    };

    const getTokenBadge = (integration: Integration) => {
        const daysUntilExpiry = calculateDaysUntilExpiry(integration.token_expires_at);
        if (daysUntilExpiry < 0) return (
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3" /> Token Expirado
            </span>
        );
        if (daysUntilExpiry < 7) return (
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3" /> Expira em {daysUntilExpiry}d
            </span>
        );
        return null; // Token OK, não precisa mostrar nada
    };

    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);

    const monitoredTotal = adsAccounts.filter(i => i.is_monitored === true).length;
    const atMonitorLimit = monitoredTotal >= maxMonitoredAccounts;

    return (
        <>
                <motion.div initial="hidden" animate="visible" variants={container} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
                    <motion.div variants={item} className="flex flex-col gap-4">
                        <SectionHeader
                            title="Integrações"
                            description="Conecte contas Meta, ative monitoramento e sincronize dados de campanhas."
                            actions={
                                user ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <FacebookOAuthButton
                                            userId={user.id}
                                            companyId={user.company_id || ''}
                                            redirectUrl="/integracoes"
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-10 px-5 text-sm transition-all"
                                            onSuccess={() => {
                                                fetchIntegrations();
                                                toast({ title: 'Contas conectadas!', description: 'Ative e sincronize as contas desejadas.' });
                                            }}
                                        >
                                            <Facebook className="w-4 h-4 mr-2" />
                                            {integrationsList.length > 0 ? 'Adicionar Conta' : 'Conectar Meta'}
                                        </FacebookOAuthButton>

                                        {isAdmin && (
                                        <InfoTip title="Sincronizar (Admin)" hint="Dispara manualmente a sincronização das contas Meta ativas. Só admin vê — o sistema também roda sozinho a cada 3 horas.">
                                        <Button
                                            onClick={handleSyncAll}
                                            disabled={!!syncing || !adsAccounts.some(i => i.is_monitored === true)}
                                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-10 px-5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {syncing === 'all-sync' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                            Sincronizar (Admin)
                                        </Button>
                                        </InfoTip>
                                        )}

                                        {integrationsList.some(i => i.platform === 'meta' && i.status !== 'disconnected') && (
                                            <InfoTip title="Desconectar" hint="Remove a conexão de todas as contas Meta. Os dados já sincronizados continuam, mas a sincronização para até reconectar.">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDisconnectPlatform('meta')}
                                                className="h-10 px-4 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl text-sm font-medium"
                                    >
                                        <Unlink className="w-4 h-4 mr-2" />
                                        Desconectar
                                    </Button>
                                    </InfoTip>
                                )}
                                    </div>
                                ) : null
                            }
                        />
                        <SettingsNav />
                    </motion.div>

                    {integrationsList.length > 0 && (
                        <motion.p variants={item} className="text-sm text-muted-foreground">
                            Contas monitoradas pela equipe:{' '}
                            <span className={atMonitorLimit ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-foreground'}>
                                {monitoredTotal} / {maxMonitoredAccounts}
                            </span>
                            {atMonitorLimit && (
                                <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    Limite atingido. Desative uma conta para ativar outra.
                                </span>
                            )}
                        </motion.p>
                    )}

                    {/* Compact Filters */}
                    <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar conta..."
                                className="pl-10 bg-muted/40 border-border focus:border-ch-orange/30 text-foreground placeholder:text-muted-foreground/40 h-9 rounded-lg text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                            {['todos', 'active', 'disconnected'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status as any)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === status
                                        ? 'bg-foreground text-background shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {status === 'todos' ? 'Todos' : status === 'active' ? 'Ativos' : 'Inativos'}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* BM List */}
                    {isLoading ? (
                        <motion.div variants={item} className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-ch-orange/50" />
                        </motion.div>
                    ) : filteredIntegrations.length > 0 ? (
                        <motion.div variants={item} className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {bmListForDisplay.map((bm) => {
                                    const isBMExpanded = expandedBMs.has(bm.id);
                                    const monitoredCount = bm.integrations.filter(i => i.is_monitored === true).length;
                                    const totalCampaigns = bm.integrations.reduce((acc, i) => acc + (i.metrics?.campaignsCount || 0), 0);
                                    const totalCreatives = bm.integrations.reduce((acc, i) => acc + (i.metrics?.creativesCount || 0), 0);
                                    const totalSpend = bm.integrations.reduce((acc, i) => acc + (i.metrics?.totalSpend || 0), 0);

                                    return (
                                        <motion.div key={bm.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                            className="rounded-xl overflow-hidden bg-card border border-border shadow-sm"
                                        >
                                            {/* BM Header */}
                                            <div
                                                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                                                onClick={() => {
                                                    const next = new Set(expandedBMs);
                                                    if (next.has(bm.id)) next.delete(bm.id);
                                                    else next.add(bm.id);
                                                    setExpandedBMs(next);
                                                }}
                                            >
                                                <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />

                                                <div className="min-w-0 flex-1">
                                                    <span className="font-bold text-sm text-foreground truncate block">{bm.name}</span>
                                                </div>

                                                <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{bm.integrations.length} conta{bm.integrations.length !== 1 ? 's' : ''}</span>
                                                    {monitoredCount > 0 && <span className="text-ch-orange font-semibold">{monitoredCount} ativa{monitoredCount !== 1 ? 's' : ''}</span>}
                                                    {totalCampaigns > 0 && (
                                                        <>
                                                            <span className="w-px h-3 bg-border" />
                                                            <span className="font-semibold text-foreground">{totalCampaigns}</span> camp.
                                                            <span className="font-semibold text-foreground">{totalCreatives}</span> criat.
                                                            {totalSpend > 0 && <span className="font-semibold text-ch-orange">R$ {new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(totalSpend)}</span>}
                                                        </>
                                                    )}
                                                </div>

                                                <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${isBMExpanded ? 'rotate-180' : ''}`} />
                                            </div>

                                            {/* Accounts list */}
                                            <AnimatePresence>
                                                {isBMExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="border-t border-border">
                                                            {bm.integrations.map((integration, idx) => (
                                                                <div
                                                                    key={integration.id}
                                                                    className={`flex items-center gap-3 px-4 py-2.5 transition-all ${idx !== bm.integrations.length - 1 ? 'border-b border-border' : ''} ${integration.is_monitored === true ? 'hover:bg-muted/15' : 'opacity-40'}`}
                                                                >
                                                                    <Switch
                                                                        checked={integration.is_monitored === true}
                                                                        disabled={!integration.is_monitored && atMonitorLimit}
                                                                        onCheckedChange={() => handleToggleMonitored(integration.id, integration.is_monitored === true)}
                                                                        className="data-[state=checked]:bg-ch-orange scale-90"
                                                                    />

                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold text-sm text-foreground truncate leading-tight">{integration.account_name}</p>
                                                                        <p className="text-[11px] text-muted-foreground/50 font-mono">act_{integration.account_id}</p>
                                                                    </div>

                                                                    {/* Metrics or status */}
                                                                    {(integration.metrics?.campaignsCount || 0) > 0 ? (
                                                                        <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-muted-foreground">
                                                                            <span><span className="font-bold text-foreground">{integration.metrics?.campaignsCount}</span> camp.</span>
                                                                            <span><span className="font-bold text-foreground">{integration.metrics?.creativesCount || 0}</span> criat.</span>
                                                                            {(integration.metrics?.totalSpend || 0) > 0 && (
                                                                                <span className="font-bold text-foreground">R$ {new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(integration.metrics.totalSpend)}</span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="hidden sm:block text-[11px] text-muted-foreground/30">Pendente</span>
                                                                    )}

                                                                    {getTokenBadge(integration as any)}

                                                                    <div className="flex items-center gap-0.5">
                                                                        <button
                                                                            onClick={() => handleRemoveAccount(integration.id, integration.account_name || 'Conta')}
                                                                            disabled={removing === integration.id}
                                                                            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                                                                            title="Remover"
                                                                        >
                                                                            {removing === integration.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div variants={item} className="text-center py-16">
                            <Search className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
                            <button onClick={() => { setSearchTerm(''); setFilterStatus('todos'); }} className="text-xs text-ch-orange hover:underline mt-2">Limpar filtros</button>
                        </motion.div>
                    )}

                </motion.div>

            {
                selectedIntegrationId && (
                    <AssetSelectionModal
                        isOpen={assetModalOpen}
                        onClose={() => {
                            setAssetModalOpen(false);
                            setSelectedIntegrationId(null);
                        }}
                        integrationId={selectedIntegrationId}
                    />
                )
            }

            <SyncLikeOverlay
                open={isSyncOverlayVisible}
                progress={syncProgress}
                title="Sincronizando com Meta Ads"
                subtitle="Importando dados das suas contas de anúncio"
                steps={META_SYNC_STEPS}
                currentStepIndex={syncStepIndex}
                currentStepDetail={syncStepLabel}
                theme="meta"
                footerText="A sincronização pode levar alguns minutos dependendo do volume de dados"
            />
        </>
    );
}
