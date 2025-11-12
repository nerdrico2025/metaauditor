import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

interface SyncStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  count?: number;
  error?: string;
}

interface SyncLoadingModalProps {
  open: boolean;
  steps: SyncStep[];
  currentStep: number;
  onOpenChange?: (open: boolean) => void;
}

export function SyncLoadingModal({ open, steps, currentStep, onOpenChange }: SyncLoadingModalProps) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const hasErrors = steps.some(s => s.status === 'error');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="sync-loading-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                Sincronização Concluída com Erros
              </>
            ) : completedSteps === totalSteps ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Sincronização Concluída
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Sincronizando...
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {completedSteps === totalSteps 
              ? 'Todos os dados foram sincronizados com sucesso.' 
              : `Sincronizando dados das integrações (${completedSteps}/${totalSteps})...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Progresso Geral</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" data-testid="sync-progress-bar" />
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                data-testid={`sync-step-${index}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {step.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {step.name}
                    </p>
                    {step.count !== undefined && step.count > 0 && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        {step.count}
                      </span>
                    )}
                  </div>
                  
                  {step.status === 'loading' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Sincronizando...
                    </p>
                  )}
                  {step.status === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {step.count ? `${step.count} ${step.count === 1 ? 'item sincronizado' : 'itens sincronizados'}` : 'Concluído'}
                    </p>
                  )}
                  {step.status === 'error' && step.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
