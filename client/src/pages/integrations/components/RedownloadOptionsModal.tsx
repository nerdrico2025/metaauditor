import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageIcon, ImageOff, Images } from "lucide-react";

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
            <ImageIcon className="w-5 h-5" />
            Re-download de Imagens
          </DialogTitle>
          <DialogDescription>
            Escolha quais criativos deseja sincronizar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-start gap-2"
            onClick={() => onSelect('missing')}
            disabled={isLoading}
            data-testid="button-redownload-missing"
          >
            <div className="flex items-center gap-2">
              <ImageOff className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Apenas sem imagem</span>
            </div>
            <span className="text-xs text-muted-foreground text-left">
              Sincroniza apenas criativos que não possuem imagem ou vídeo. Mais rápido e econômico.
            </span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-start gap-2"
            onClick={() => onSelect('all')}
            disabled={isLoading}
            data-testid="button-redownload-all"
          >
            <div className="flex items-center gap-2">
              <Images className="w-5 h-5 text-blue-500" />
              <span className="font-medium">Todos os criativos</span>
            </div>
            <span className="text-xs text-muted-foreground text-left">
              Sincroniza todos os criativos, mesmo os que já possuem imagem. Útil para atualizar formatos.
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
