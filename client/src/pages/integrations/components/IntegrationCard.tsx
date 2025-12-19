import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, RefreshCw, Trash2, Clock, ShieldCheck, ShieldX, Calendar, BarChart3, ImageIcon } from 'lucide-react';

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
  connectedByUserName: string | null;
}

interface TokenInfo {
  valid: boolean;
  expiresAt?: string | null;
  scopes?: string[];
  error?: string;
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

interface IntegrationCardProps {
  integration: Integration;
  syncHistory: SyncHistoryItem[];
  onSync: () => void;
  onDelete: () => void;
  onRenewToken?: () => void;
  onRedownloadImages?: () => void;
  isSyncing: boolean;
  isRedownloadingImages?: boolean;
}

interface IntegrationStats {
  campaigns: number;
  adSets: number;
  creatives: number;
}

export function IntegrationCard({
  integration,
  syncHistory,
  onSync,
  onDelete,
  onRenewToken,
  onRedownloadImages,
  isSyncing,
  isRedownloadingImages = false
}: IntegrationCardProps) {
  const { data: tokenInfo, isLoading: tokenLoading } = useQuery<TokenInfo>({
    queryKey: ['/api/auth/meta/check-token', integration.id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/auth/meta/check-token/${integration.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao verificar token');
      return res.json();
    },
    enabled: integration.platform === 'meta',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: stats, isLoading: statsLoading } = useQuery<IntegrationStats>({
    queryKey: ['/api/integrations', integration.id, 'stats'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/integrations/${integration.id}/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao buscar estatísticas');
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds - refresh more often during syncs
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

  const recentHistory = syncHistory.slice(0, 3);

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3 justify-between">
            <div className="flex gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {integration.accountName || 'Conta de Anúncios'}
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
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing || isRedownloadingImages}
                data-testid={`button-sync-${integration.id}`}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
              {onRedownloadImages && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRedownloadImages}
                  disabled={isSyncing || isRedownloadingImages}
                  data-testid={`button-redownload-${integration.id}`}
                  title="Re-baixar imagens em alta resolução para criativos sem imagem ou com baixa qualidade"
                >
                  <ImageIcon className={`w-4 h-4 mr-2 ${isRedownloadingImages ? 'animate-pulse' : ''}`} />
                  {isRedownloadingImages ? 'Baixando...' : 'Re-baixar Imagens'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                data-testid={`button-delete-${integration.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            </div>
          </div>
          
          {/* Stats row - prominently displayed */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dados Sincronizados</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-5 w-64" />
            ) : stats && (stats.campaigns > 0 || stats.adSets > 0 || stats.creatives > 0) ? (
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.campaigns} campanhas, {stats.adSets} grupos de anúncios e {stats.creatives} anúncios
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum dado sincronizado ainda. Clique em "Sincronizar" para importar os dados.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-900 font-semibold">Account ID:</span>
              <p className="font-mono text-gray-900 dark:text-white text-xs">{integration.accountId}</p>
            </div>
            <div>
              <span className="text-gray-900 font-semibold">Última Sincronização:</span>
              <p className="text-gray-900 dark:text-white">{formatRelativeTime(integration.lastFullSync || integration.lastSync)}</p>
            </div>
            <div>
              <span className="text-gray-900 font-semibold">Conectada em:</span>
              <p className="text-gray-900 dark:text-white">{formatDate(integration.createdAt)}</p>
            </div>
            <div>
              <span className="text-gray-900 font-semibold">Conectado por:</span>
              <p className="text-gray-900 dark:text-white">{integration.connectedByUserName || '-'}</p>
            </div>
            <div>
              <span className="text-gray-900 font-semibold">Status da Conexão:</span>
              {tokenLoading ? (
                <Skeleton className="h-5 w-20 mt-1" />
              ) : tokenInfo?.valid ? (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ativa</span>
                  {tokenInfo.expiresAt && (
                    <span className="text-xs text-gray-500 ml-1">
                      (até {formatDate(tokenInfo.expiresAt)})
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <ShieldX className="w-4 h-4" />
                    <span>Inativa</span>
                  </div>
                  {onRenewToken && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-xs text-blue-600"
                      onClick={onRenewToken}
                    >
                      Reconectar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {recentHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Histórico Recente
            </h4>
          </div>
          <div className="space-y-2">
            {recentHistory.map((item) => (
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
}
