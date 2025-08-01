import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Trash2 } from "lucide-react";
import type { Policy } from "@shared/schema";

const policySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  isDefault: z.boolean().default(false),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface PolicyModalProps {
  policy: Policy | null;
  onClose: () => void;
}

export default function PolicyModal({ policy, onClose }: PolicyModalProps) {
  const { toast } = useToast();
  const [complianceRules, setComplianceRules] = useState<Record<string, any>>(
    policy?.rules as Record<string, any> || {
      requireLogo: true,
      brandColors: true,
      textCompliance: true,
    }
  );
  const [performanceThresholds, setPerformanceThresholds] = useState<Record<string, any>>(
    policy?.performanceThresholds as Record<string, any> || {
      minCTR: 0.8,
      maxCPC: 5.0,
      minConversions: 1,
    }
  );

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      name: policy?.name || "",
      description: policy?.description || "",
      status: policy?.status === 'active' ? 'active' : 'inactive',
      isDefault: policy?.isDefault || false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PolicyFormData & { rules: any; performanceThresholds: any }) => {
      const response = await apiRequest("POST", "/api/policies", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Política Criada",
        description: "Nova política criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao criar política",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PolicyFormData & { rules: any; performanceThresholds: any }) => {
      const response = await apiRequest("PUT", `/api/policies/${policy!.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Política Atualizada",
        description: "Política atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao atualizar política",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PolicyFormData) => {
    const policyData = {
      ...data,
      rules: complianceRules,
      performanceThresholds,
    };

    if (policy) {
      updateMutation.mutate(policyData);
    } else {
      createMutation.mutate(policyData);
    }
  };

  const updateComplianceRule = (key: string, value: any) => {
    setComplianceRules(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updatePerformanceThreshold = (key: string, value: any) => {
    setPerformanceThresholds(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="text-lg font-medium text-slate-900">
              {policy ? 'Editar Política' : 'Nova Política'}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">Informações Básicas</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Política</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Black Friday 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o propósito desta política..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormLabel>Política Ativa</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value === 'active'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'active' : 'inactive')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormLabel>Política Padrão</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Compliance Rules */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">Regras de Conformidade</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Logomarca Obrigatória</p>
                    <p className="text-xs text-slate-500">Verificar presença da logomarca nos criativos</p>
                  </div>
                  <Switch
                    checked={complianceRules.requireLogo}
                    onCheckedChange={(checked) => updateComplianceRule('requireLogo', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Cores da Marca</p>
                    <p className="text-xs text-slate-500">Validar uso das cores da identidade visual</p>
                  </div>
                  <Switch
                    checked={complianceRules.brandColors}
                    onCheckedChange={(checked) => updateComplianceRule('brandColors', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Conformidade de Texto</p>
                    <p className="text-xs text-slate-500">Verificar textos proibidos ou obrigatórios</p>
                  </div>
                  <Switch
                    checked={complianceRules.textCompliance}
                    onCheckedChange={(checked) => updateComplianceRule('textCompliance', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Performance Thresholds */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">Critérios de Performance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CTR Mínimo (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={performanceThresholds.minCTR}
                    onChange={(e) => updatePerformanceThreshold('minCTR', parseFloat(e.target.value))}
                    placeholder="0.8"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CPC Máximo (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={performanceThresholds.maxCPC}
                    onChange={(e) => updatePerformanceThreshold('maxCPC', parseFloat(e.target.value))}
                    placeholder="5.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Conversões Mínimas
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={performanceThresholds.minConversions}
                    onChange={(e) => updatePerformanceThreshold('minConversions', parseInt(e.target.value))}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row-reverse space-x-reverse space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="submit"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {isLoading ? 'Salvando...' : policy ? 'Atualizar Política' : 'Criar Política'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
