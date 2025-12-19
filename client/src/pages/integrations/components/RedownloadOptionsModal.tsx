import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Film, ImageOff, RefreshCw } from "lucide-react";

interface RedownloadOptionsModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: 'all' | 'missing') => void;
  isLoading?: boolean;
}

export function RedownloadOptionsModal({
  open,
  onClose,
  onSelect,
  isLoading = false
}: RedownloadOptionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Sincronizar Mídias
          </DialogTitle>
          <DialogDescription>
            Escolha quais criativos deseja sincronizar
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <button
            type="button"
            className="w-full text-left p-4 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => onSelect('missing')}
            disabled={isLoading}
            data-testid="button-redownload-missing"
          >
            <div className="flex items-center gap-2 mb-1">
              <ImageOff className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="font-medium">Apenas sem mídia</span>
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              Sincroniza apenas criativos que não possuem imagem ou vídeo. Mais rápido e econômico.
            </p>
          </button>

          <button
            type="button"
            className="w-full text-left p-4 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => onSelect('all')}
            disabled={isLoading}
            data-testid="button-redownload-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <span className="font-medium">Todos os criativos</span>
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              Sincroniza todos os criativos, mesmo os que já possuem mídia. Útil para atualizar formatos.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
