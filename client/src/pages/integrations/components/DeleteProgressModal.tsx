import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, Clock, Trash2 } from "lucide-react";

interface DeleteStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

interface DeleteProgressModalProps {
  open: boolean;
  steps: DeleteStep[];
  startTime?: number;
  endTime?: number;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function DeleteProgressModal({ 
  open, 
  steps, 
  startTime,
  endTime,
  onClose,
}: DeleteProgressModalProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const hasErrors = steps.some(s => s.status === 'error');
  const isLoading = steps.some(s => s.status === 'loading');
  const isCompleted = totalSteps > 0 && (completedSteps === totalSteps || hasErrors);
  
  useEffect(() => {
    if (!startTime || isCompleted) {
      return;
    }
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, isCompleted]);
  
  const finalTime = endTime && startTime 
    ? Math.floor((endTime - startTime) / 1000) 
    : elapsedSeconds;
  
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isCompleted) {
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
        data-testid="delete-progress-modal"
        onPointerDownOutside={(e) => !isCompleted && e.preventDefault()}
        onEscapeKeyDown={(e) => !isCompleted && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                Exclusão Concluída com Erros
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Exclusão Concluída
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-red-500" />
                Excluindo Dados...
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCompleted 
              ? 'Todos os dados foram excluídos.' 
              : `Progresso: ${completedSteps}/${totalSteps} etapas concluídas`}
          </DialogDescription>
        </DialogHeader>

        {startTime && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 rounded-lg border border-red-200 dark:border-red-800">
            <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex flex-col items-center">
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                {isCompleted ? 'Tempo Total' : 'Tempo Decorrido'}
              </span>
              <span className="text-2xl font-bold text-red-700 dark:text-red-300 tabular-nums">
                {formatTime(finalTime)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Progresso Geral</span>
              <span className="font-bold text-red-600">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" data-testid="delete-progress-bar" />
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  step.status === 'loading' 
                    ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 shadow-sm' 
                    : step.status === 'success'
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : step.status === 'error'
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
                data-testid={`delete-step-${index}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-red-600 dark:text-red-400" />
                  )}
                  {step.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  {step.status === 'pending' && (
                    <Trash2 className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {step.name}
                  </p>
                  {step.status === 'loading' && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                      Excluindo...
                    </p>
                  )}
                  {step.status === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                      ✓ Excluído com sucesso
                    </p>
                  )}
                  {step.status === 'error' && step.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                      ✗ {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isCompleted && (
            <div className="pt-4 border-t">
              <Button 
                onClick={onClose}
                className="w-full"
                variant={hasErrors ? "destructive" : "default"}
                data-testid="delete-modal-close-button"
              >
                {hasErrors ? 'Fechar e Revisar Erros' : 'Concluir'}
              </Button>
            </div>
          )}

          {!isCompleted && (
            <div className="pt-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Aguarde, excluindo dados...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
