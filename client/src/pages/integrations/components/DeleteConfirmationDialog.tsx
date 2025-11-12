import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertCircle } from 'lucide-react';

interface Integration {
  id: string;
  platform: string;
  accountName: string | null;
}

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: Integration | null;
  onConfirm: (deleteAllData: boolean) => void;
  isDeleting: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  integration,
  onConfirm,
  isDeleting
}: DeleteConfirmationDialogProps) {
  const [deleteAllData, setDeleteAllData] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setDeleteAllData(false);
  };

  const handleConfirm = () => {
    onConfirm(deleteAllData);
    setDeleteAllData(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover Integração</DialogTitle>
          <DialogDescription>
            Escolha como deseja remover esta integração
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>Apenas desconectar:</strong><br />
              Remove a conexão mas mantém todas as campanhas, ad sets e criativos já sincronizados.
            </AlertDescription>
          </Alert>

          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900 dark:text-red-100">
              <strong>Excluir todos os dados:</strong><br />
              Remove a conexão E exclui permanentemente todas as campanhas, ad sets, criativos, imagens e auditorias associadas.
            </AlertDescription>
          </Alert>

          <div 
            className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => setDeleteAllData(!deleteAllData)}
          >
            <input
              type="checkbox"
              checked={deleteAllData}
              onChange={(e) => setDeleteAllData(e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-delete-all-data"
            />
            <Label className="cursor-pointer flex-1">
              <div className="font-semibold">Excluir todos os dados</div>
              <div className="text-sm text-gray-500">
                Esta ação é irreversível e apagará tudo relacionado a esta conta
              </div>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant={deleteAllData ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="button-confirm-delete"
          >
            {isDeleting ? 'Removendo...' : deleteAllData ? 'Excluir Tudo' : 'Desconectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
