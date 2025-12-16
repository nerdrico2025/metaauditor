import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Clock, X } from 'lucide-react';

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

interface SyncStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  count?: number;
  total?: number;
}

interface BulkSyncModalProps {
  open: boolean;
  accounts: AccountSyncResult[];
  currentIndex: number;
  totalAccounts: number;
  isComplete: boolean;
  isCancelled: boolean;
  totalDuration?: number;
  currentSyncSteps?: SyncStep[];
  onCancel: () => void;
  onClose: () => void;
}

export function BulkSyncModal({
  open,
  accounts,
  currentIndex,
  totalAccounts,
  isComplete,
  isCancelled,
  totalDuration,
  currentSyncSteps = [],
  onCancel,
  onClose,
}: BulkSyncModalProps) {
  const progress = totalAccounts > 0 ? ((currentIndex + (isComplete ? 1 : 0)) / totalAccounts) * 100 : 0;
  
  const successCount = accounts.filter(a => a.status === 'success').length;
  const errorCount = accounts.filter(a => a.status === 'error').length;
  const cancelledCount = accounts.filter(a => a.status === 'cancelled').length;
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const currentAccount = accounts[currentIndex];

  if (!open) return null;
  
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {isComplete 
                ? (isCancelled ? 'Sincronização Cancelada' : 'Sincronização Concluída') 
                : 'Sincronizando Contas'}
            </span>
            {isComplete && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isComplete && currentAccount && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Sincronizando conta {currentIndex + 1} de {totalAccounts}
                  </p>
                  <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                    {currentAccount.name}
                  </p>
                </div>
              </div>
              
              {/* Current sync steps */}
              {currentSyncSteps.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {currentSyncSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        step.status === 'success' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                          : step.status === 'loading'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                      {step.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{step.name}</span>
                      {step.count !== undefined && step.count > 0 && (
                        <span className="font-bold">({step.count})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Progresso</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {isComplete && totalDuration && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <Clock className="w-4 h-4" />
              <span>Tempo total: <strong>{formatDuration(totalDuration)}</strong></span>
            </div>
          )}

          {isComplete && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successCount} sucesso</span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  <span>{errorCount} erro{errorCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {cancelledCount > 0 && (
                <div className="flex items-center gap-1 text-gray-500">
                  <X className="w-4 h-4" />
                  <span>{cancelledCount} cancelada{cancelledCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isComplete ? 'Relatório por conta:' : 'Contas:'}
            </p>
            {accounts.map((account, index) => (
              <div 
                key={account.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  account.status === 'syncing' 
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' 
                    : account.status === 'success'
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : account.status === 'error'
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                    : account.status === 'cancelled'
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {account.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  {account.status === 'syncing' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {account.status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                  {account.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  {account.status === 'cancelled' && (
                    <X className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {account.name}
                    </p>
                    {account.status === 'success' && (
                      <p className="text-xs text-gray-500">
                        {account.campaigns || 0} campanhas, {account.adSets || 0} grupos, {account.creatives || 0} anúncios
                        {account.duration && ` • ${formatDuration(account.duration)}`}
                      </p>
                    )}
                    {account.status === 'error' && account.error && (
                      <p className="text-xs text-red-600">{account.error}</p>
                    )}
                    {account.status === 'cancelled' && (
                      <p className="text-xs text-gray-500">Cancelada</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {!isComplete ? (
              <Button 
                variant="destructive" 
                onClick={onCancel}
                data-testid="button-cancel-bulk-sync"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar Sincronização
              </Button>
            ) : (
              <Button onClick={onClose} data-testid="button-close-bulk-sync">
                Fechar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
