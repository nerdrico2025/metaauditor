import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

interface DeleteAllDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
  dataType: string;
  count: number;
}

export function DeleteAllDataDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  dataType,
  count,
}: DeleteAllDataDialogProps) {
  const [confirmChecked, setConfirmChecked] = useState(false);

  const handleClose = () => {
    setConfirmChecked(false);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    setConfirmChecked(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Excluir Todos os {dataType}?
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível e irá excluir permanentemente <strong>{count}</strong> {dataType.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-900 dark:text-red-100 font-medium">
              ⚠️ Atenção: Esta ação não pode ser desfeita!
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-2">
              Todos os {dataType.toLowerCase()} serão permanentemente removidos do sistema.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm-delete"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
            />
            <label
              htmlFor="confirm-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Eu entendo que esta ação é irreversível
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmChecked || isDeleting}
            data-testid="button-confirm-delete-all"
          >
            {isDeleting ? 'Excluindo...' : `Excluir ${count} ${dataType}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
