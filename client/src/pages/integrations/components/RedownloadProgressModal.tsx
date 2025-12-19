import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, ImageIcon, Trash2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RedownloadStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
  count?: number;
  current?: number;
  total?: number;
}

interface RedownloadProgressModalProps {
  open: boolean;
  onClose: () => void;
  steps: RedownloadStep[];
  currentCreative?: string;
  downloadProgress: { current: number; total: number };
  isComplete: boolean;
  result?: {
    deleted: number;
    updated: number;
    failed: number;
    noImage: number;
    total: number;
  };
  startTime?: number;
  endTime?: number;
}

export function RedownloadProgressModal({
  open,
  onClose,
  steps,
  currentCreative,
  downloadProgress,
  isComplete,
  result,
  startTime,
  endTime
}: RedownloadProgressModalProps) {
  const getStepIcon = (status: 'pending' | 'loading' | 'success' | 'error', stepName: string) => {
    if (status === 'loading') {
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (status === 'success') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (status === 'error') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    
    if (stepName.includes('Excluindo')) return <Trash2 className="w-5 h-5 text-gray-400" />;
    if (stepName.includes('Buscando')) return <Search className="w-5 h-5 text-gray-400" />;
    return <ImageIcon className="w-5 h-5 text-gray-400" />;
  };

  const progressPercent = downloadProgress.total > 0 
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100) 
    : 0;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const duration = startTime && endTime ? endTime - startTime : startTime ? Date.now() - startTime : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Re-download de Imagens
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              {getStepIcon(step.status, step.name)}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-gray-400' : ''}`}>
                  {step.name}
                </p>
                {step.message && (
                  <p className="text-xs text-muted-foreground truncate">{step.message}</p>
                )}
              </div>
            </div>
          ))}

          {downloadProgress.total > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progresso: {downloadProgress.current} de {downloadProgress.total}</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {currentCreative && (
                <p className="text-xs text-muted-foreground truncate">
                  Baixando: {currentCreative}
                </p>
              )}
            </div>
          )}

          {isComplete && result && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Resultado:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Excluídas do bucket:</span>
                  <span>{result.deleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizadas:</span>
                  <span className="text-green-600">{result.updated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sem imagem:</span>
                  <span className="text-yellow-600">{result.noImage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Falhas:</span>
                  <span className="text-red-600">{result.failed}</span>
                </div>
              </div>
              {duration > 0 && (
                <p className="text-xs text-muted-foreground pt-2">
                  Tempo total: {formatDuration(duration)}
                </p>
              )}
            </div>
          )}
        </div>

        {isComplete && (
          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="button-close-redownload-modal">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
