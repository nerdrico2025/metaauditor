import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, RefreshCw, Trash2, Clock } from 'lucide-react';

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

interface IntegrationCardProps {
  integration: Integration;
  syncHistory: SyncHistoryItem[];
  onSync: () => void;
  onDelete: () => void;
  isSyncing: boolean;
}

export function IntegrationCard({
  integration,
  syncHistory,
  onSync,
  onDelete,
  isSyncing
}: IntegrationCardProps) {
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
          <div className="flex items-center gap-3 mb-3">
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
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account ID:</span>
              <p className="font-mono text-gray-900 dark:text-white">{integration.accountId}</p>
            </div>
            <div>
              <span className="text-gray-500">Última Sincronização:</span>
              <p className="text-gray-900 dark:text-white">{formatRelativeTime(integration.lastSync)}</p>
            </div>
            {integration.lastFullSync && (
              <div>
                <span className="text-gray-500">Última Sinc. Completa:</span>
                <p className="text-gray-900 dark:text-white">{formatRelativeTime(integration.lastFullSync)}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Conectada em:</span>
              <p className="text-gray-900 dark:text-white">{formatDate(integration.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            data-testid={`button-sync-${integration.id}`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
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
