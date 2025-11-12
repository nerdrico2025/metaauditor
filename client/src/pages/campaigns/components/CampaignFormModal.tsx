
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Campaign, Integration } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface CampaignFormModalProps {
  campaign?: Campaign | null;
  onClose: () => void;
}

export default function CampaignFormModal({
  campaign,
  onClose,
}: CampaignFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!campaign;

  const [formData, setFormData] = useState({
    name: campaign?.name || "",
    externalId: campaign?.externalId || "",
    platform: campaign?.platform || "meta",
    status: campaign?.status || "active",
    budget: campaign?.budget || "",
    integrationId: campaign?.integrationId || "",
  });

  // Fetch integrations for the dropdown
  const { data: integrations } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  // Filter integrations by selected platform
  const filteredIntegrations = integrations?.filter(
    (int) => int.platform === formData.platform
  );

  // Auto-select first integration when platform changes
  useEffect(() => {
    if (filteredIntegrations && filteredIntegrations.length > 0 && !isEdit) {
      setFormData((prev) => ({
        ...prev,
        integrationId: filteredIntegrations[0].id,
      }));
    }
  }, [formData.platform, filteredIntegrations, isEdit]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? `/api/campaigns/${campaign.id}`
        : "/api/campaigns";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao salvar campanha");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Sucesso",
        description: isEdit
          ? "Campanha atualizada com sucesso"
          : "Campanha criada com sucesso",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da campanha é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.externalId.trim()) {
      toast({
        title: "Erro",
        description: "ID externo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.integrationId) {
      toast({
        title: "Erro",
        description: "Selecione uma integração",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {isEdit ? "Editar Campanha" : "Nova Campanha"}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {isEdit
              ? "Atualize as informações da campanha"
              : "Preencha os dados para criar uma nova campanha"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Platform */}
            <div className="space-y-2">
              <Label htmlFor="platform" className="text-sm font-medium text-slate-700">
                Plataforma *
              </Label>
              <Select
                value={formData.platform}
                onValueChange={(value) =>
                  setFormData({ ...formData, platform: value, integrationId: "" })
                }
                disabled={isEdit}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Integration */}
            <div className="space-y-2">
              <Label htmlFor="integration" className="text-sm font-medium text-slate-700">
                Integração *
              </Label>
              <Select
                value={formData.integrationId}
                onValueChange={(value) =>
                  setFormData({ ...formData, integrationId: value })
                }
                disabled={isEdit}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  {filteredIntegrations?.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {integration.accountId || integration.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                Nome da Campanha *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Campanha Black Friday 2025"
                className="bg-white border-slate-300"
              />
            </div>

            {/* External ID */}
            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-sm font-medium text-slate-700">
                ID Externo *
              </Label>
              <Input
                id="externalId"
                value={formData.externalId}
                onChange={(e) =>
                  setFormData({ ...formData, externalId: e.target.value })
                }
                placeholder="Ex: 123456789"
                className="bg-white border-slate-300"
                disabled={isEdit}
              />
              <p className="text-xs text-slate-500">
                ID da campanha na plataforma {formData.platform === "meta" ? "Meta Ads" : "Google Ads"}
              </p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium text-slate-700">
                Status *
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label htmlFor="budget" className="text-sm font-medium text-slate-700">
                Orçamento (R$)
              </Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0"
                value={formData.budget}
                onChange={(e) =>
                  setFormData({ ...formData, budget: e.target.value })
                }
                placeholder="0.00"
                className="bg-white border-slate-300"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="border-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                "Salvar Alterações"
              ) : (
                "Criar Campanha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
