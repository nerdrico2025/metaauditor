import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, AlertTriangle } from "lucide-react";

interface SyncStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  count?: number;
  total?: number;
  error?: string;
}

interface SyncLoadingModalProps {
  open: boolean;
  steps: SyncStep[];
  currentStep: number;
  totalItems?: number;
  syncedItems?: number;
  onClose?: () => void;
}

export function SyncLoadingModal({ 
  open, 
  steps, 
  currentStep, 
  totalItems = 0,
  syncedItems = 0,
  onClose 
}: SyncLoadingModalProps) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const hasErrors = steps.some(s => s.status === 'error');
  const isCompleted = completedSteps === totalSteps || hasErrors;
  const isRunning = !isCompleted && completedSteps > 0;
  
  // Calculate overall progress
  const stepProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const itemProgress = totalItems > 0 ? (syncedItems / totalItems) * 100 : 0;
  const overallProgress = Math.round((stepProgress + itemProgress) / 2);

  // Block closing if sync is running
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isCompleted) {
      // Don't allow closing during sync
      return;
    }
    if (!newOpen && isCompleted && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-lg" 
        data-testid="sync-loading-modal"
        onPointerDownOutside={(e) => !isCompleted && e.preventDefault()}
        onEscapeKeyDown={(e) => !isCompleted && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                Sincronização Concluída com Erros
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Sincronização Concluída
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Sincronizando Dados...
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCompleted 
              ? 'Todos os dados foram sincronizados.' 
              : `Progresso: ${completedSteps}/${totalSteps} etapas concluídas`}
          </DialogDescription>
        </DialogHeader>

        {!isCompleted && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium px-6 py-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span>Não recarregue a página até a finalização</span>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Progresso Geral</span>
              <span className="font-bold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" data-testid="sync-progress-bar" />
          </div>

          {/* Item Counter */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex flex-col">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total de Itens</span>
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {syncedItems} / {totalItems}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {Math.round((syncedItems / totalItems) * 100)}% sincronizado
                </div>
              </div>
            </div>
          )}

          {/* Steps List */}
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  step.status === 'loading' 
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 shadow-sm' 
                    : step.status === 'success'
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : step.status === 'error'
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
                data-testid={`sync-step-${index}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  )}
                  {step.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {step.name}
                    </p>
                    {step.count !== undefined && step.count > 0 && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        step.status === 'success'
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      }`}>
                        {step.count}
                      </span>
                    )}
                  </div>
                  
                  {/* Step-level progress */}
                  {step.total !== undefined && step.total > 0 && step.status === 'loading' && (
                    <div className="mt-2">
                      <Progress 
                        value={(step.count || 0) / step.total * 100} 
                        className="h-1.5"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {step.count || 0} / {step.total} itens
                      </p>
                    </div>
                  )}
                  
                  {step.status === 'loading' && !step.total && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Processando...
                    </p>
                  )}
                  {step.status === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {step.count ? `${step.count} ${step.count === 1 ? 'item sincronizado' : 'itens sincronizados'}` : 'Concluído'}
                    </p>
                  )}
                  {step.status === 'error' && step.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Button */}
          {isCompleted && (
            <div className="pt-4 border-t">
              <Button 
                onClick={onClose}
                className="w-full"
                variant={hasErrors ? "destructive" : "default"}
                data-testid="sync-modal-close-button"
              >
                {hasErrors ? 'Fechar e Revisar Erros' : 'Concluir'}
              </Button>
            </div>
          )}

          {/* Loading Message */}
          {isRunning && (
            <div className="pt-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A sincronização pode levar alguns minutos. Por favor, aguarde...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
