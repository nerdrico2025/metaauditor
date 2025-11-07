import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash, Shield, TrendingUp, Palette, Globe, Target } from "lucide-react";
import { ChipsInput } from "@/components/ChipsInput";

interface Policy {
  id: string;
  name: string;
  description?: string;
  scope: 'global' | 'campaign';
  campaignIds?: string[];
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  brandGuidelines?: string;
  requiredKeywords?: string[];
  prohibitedKeywords?: string[];
  requiredPhrases?: string[];
  prohibitedPhrases?: string[];
  minTextLength?: number;
  maxTextLength?: number;
  requiresLogo?: boolean;
  requiresBrandColors?: boolean;
  ctrMin?: string;
  ctrTarget?: string;
  cpcMax?: string;
  cpcTarget?: string;
  conversionsMin?: number;
  conversionsTarget?: number;
  status: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
}

const policyFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  scope: z.enum(['global', 'campaign']),
  campaignIds: z.array(z.string()).optional(),
  
  // Brand Config
  brandName: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  brandGuidelines: z.string().optional(),
  
  // Content Criteria
  requiredKeywords: z.array(z.string()).optional(),
  prohibitedKeywords: z.array(z.string()).optional(),
  requiresLogo: z.boolean().optional(),
  requiresBrandColors: z.boolean().optional(),
  
  // Performance Thresholds
  ctrMin: z.string().optional(),
  ctrTarget: z.string().optional(),
  cpcMax: z.string().optional(),
  cpcTarget: z.string().optional(),
  conversionsMin: z.coerce.number().optional(),
  conversionsTarget: z.coerce.number().optional(),
  
  isDefault: z.boolean().optional(),
});

type PolicyFormData = z.infer<typeof policyFormSchema>;

export default function Policies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      scope: "global",
      campaignIds: [],
      brandName: "",
      logoUrl: "",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      brandGuidelines: "",
      requiredKeywords: [],
      prohibitedKeywords: [],
      requiresLogo: false,
      requiresBrandColors: false,
      ctrMin: "",
      ctrTarget: "",
      cpcMax: "",
      cpcTarget: "",
      conversionsMin: undefined,
      conversionsTarget: undefined,
      isDefault: false,
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: policies = [], isLoading: policiesLoading } = useQuery<Policy[]>({
    queryKey: ['/api/policies'],
    enabled: isAuthenticated,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (data: PolicyFormData) => 
      apiRequest('/api/policies', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies'] });
      toast({ title: '✅ Política criada com sucesso!' });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Erro ao criar política', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PolicyFormData }) => 
      apiRequest(`/api/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies'] });
      toast({ title: '✅ Política atualizada com sucesso!' });
      setDialogOpen(false);
      setEditingPolicy(null);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar política', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies'] });
      toast({ title: '✅ Política excluída com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir política', variant: 'destructive' });
    },
  });

  const handleCreateNew = () => {
    setEditingPolicy(null);
    form.reset();
    setDialogOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    form.reset({
      name: policy.name,
      description: policy.description || "",
      scope: policy.scope,
      campaignIds: policy.campaignIds || [],
      brandName: policy.brandName || "",
      logoUrl: policy.logoUrl || "",
      primaryColor: policy.primaryColor || "",
      secondaryColor: policy.secondaryColor || "",
      accentColor: policy.accentColor || "",
      brandGuidelines: policy.brandGuidelines || "",
      requiredKeywords: policy.requiredKeywords || [],
      prohibitedKeywords: policy.prohibitedKeywords || [],
      requiresLogo: policy.requiresLogo || false,
      requiresBrandColors: policy.requiresBrandColors || false,
      ctrMin: policy.ctrMin || "",
      ctrTarget: policy.ctrTarget || "",
      cpcMax: policy.cpcMax || "",
      cpcTarget: policy.cpcTarget || "",
      conversionsMin: policy.conversionsMin,
      conversionsTarget: policy.conversionsTarget,
      isDefault: policy.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (data: PolicyFormData) => {
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta política?')) {
      deleteMutation.mutate(id);
    }
  };

  const scope = form.watch('scope');

  if (isLoading || policiesLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Políticas de Validação
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Configure regras de conformidade, critérios de conteúdo e métricas de performance
                  </p>
                </div>
                <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90" data-testid="button-create-policy">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Política
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Políticas Configuradas</CardTitle>
                  <CardDescription>
                    Gerencie múltiplas políticas e associe-as a campanhas específicas ou aplique globalmente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policies.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Nenhuma política configurada ainda
                      </p>
                      <Button onClick={handleCreateNew} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar primeira política
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Escopo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Padrão</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policies.map((policy) => (
                          <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">{policy.name}</div>
                                {policy.description && (
                                  <div className="text-sm text-gray-500">{policy.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={policy.scope === 'global' ? 'default' : 'secondary'}>
                                {policy.scope === 'global' ? (
                                  <><Globe className="h-3 w-3 mr-1" /> Global</>
                                ) : (
                                  <><Target className="h-3 w-3 mr-1" /> Campanhas ({policy.campaignIds?.length || 0})</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                                {policy.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {policy.isDefault && <Badge variant="outline">Padrão</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(policy)}
                                  data-testid={`button-edit-${policy.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(policy.id)}
                                  data-testid={`button-delete-${policy.id}`}
                                >
                                  <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Editar Política' : 'Nova Política de Validação'}</DialogTitle>
            <DialogDescription>
              Configure regras de marca, critérios de conteúdo e métricas de performance
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Informações Básicas
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Política *</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Política Padrão de Marca"
                    {...form.register('name')} 
                    data-testid="input-policy-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope">Escopo de Aplicação</Label>
                  <Select value={scope} onValueChange={(value) => form.setValue('scope', value as 'global' | 'campaign')}>
                    <SelectTrigger data-testid="select-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Global (Todos os anúncios)
                        </div>
                      </SelectItem>
                      <SelectItem value="campaign">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Campanhas Específicas
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva o objetivo desta política..."
                  {...form.register('description')} 
                  data-testid="input-description"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={form.watch('isDefault')}
                  onCheckedChange={(checked) => form.setValue('isDefault', checked)}
                  data-testid="switch-is-default"
                />
                <Label htmlFor="isDefault">Definir como política padrão</Label>
              </div>
            </div>

            {/* Brand Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Configuração de Marca
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Nome da Marca</Label>
                  <Input 
                    id="brandName" 
                    placeholder="Ex: Click Hero"
                    {...form.register('brandName')} 
                    data-testid="input-brand-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL do Logo</Label>
                  <Input 
                    id="logoUrl" 
                    type="url"
                    placeholder="https://..."
                    {...form.register('logoUrl')} 
                    data-testid="input-logo-url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Cor Primária</Label>
                  <Input 
                    id="primaryColor" 
                    type="color"
                    {...form.register('primaryColor')} 
                    data-testid="input-primary-color"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Cor Secundária</Label>
                  <Input 
                    id="secondaryColor" 
                    type="color"
                    {...form.register('secondaryColor')} 
                    data-testid="input-secondary-color"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandGuidelines">Diretrizes de Marca</Label>
                <Textarea 
                  id="brandGuidelines" 
                  placeholder="Descreva as diretrizes da marca..."
                  {...form.register('brandGuidelines')} 
                  rows={3}
                  data-testid="input-brand-guidelines"
                />
              </div>
            </div>

            {/* Content Criteria */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">Critérios de Conteúdo</h3>
              
              <div className="space-y-2">
                <Label>Palavras-chave Obrigatórias</Label>
                <ChipsInput
                  value={form.watch('requiredKeywords') || []}
                  onChange={(value) => form.setValue('requiredKeywords', value)}
                  placeholder="Digite e pressione Enter"
                  data-testid="input-required-keywords"
                />
              </div>

              <div className="space-y-2">
                <Label>Palavras Proibidas</Label>
                <ChipsInput
                  value={form.watch('prohibitedKeywords') || []}
                  onChange={(value) => form.setValue('prohibitedKeywords', value)}
                  placeholder="Digite e pressione Enter"
                  data-testid="input-prohibited-keywords"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresLogo"
                    checked={form.watch('requiresLogo')}
                    onCheckedChange={(checked) => form.setValue('requiresLogo', checked)}
                    data-testid="switch-requires-logo"
                  />
                  <Label htmlFor="requiresLogo">Exige Logo</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresBrandColors"
                    checked={form.watch('requiresBrandColors')}
                    onCheckedChange={(checked) => form.setValue('requiresBrandColors', checked)}
                    data-testid="switch-requires-brand-colors"
                  />
                  <Label htmlFor="requiresBrandColors">Exige Cores da Marca</Label>
                </div>
              </div>
            </div>

            {/* Performance Thresholds */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Métricas de Performance
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ctrMin">CTR Mínimo (%)</Label>
                  <Input 
                    id="ctrMin" 
                    type="number"
                    step="0.001"
                    placeholder="Ex: 1.5"
                    {...form.register('ctrMin')} 
                    data-testid="input-ctr-min"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ctrTarget">CTR Alvo (%)</Label>
                  <Input 
                    id="ctrTarget" 
                    type="number"
                    step="0.001"
                    placeholder="Ex: 3.0"
                    {...form.register('ctrTarget')} 
                    data-testid="input-ctr-target"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpcMax">CPC Máximo ($)</Label>
                  <Input 
                    id="cpcMax" 
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2.50"
                    {...form.register('cpcMax')} 
                    data-testid="input-cpc-max"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpcTarget">CPC Alvo ($)</Label>
                  <Input 
                    id="cpcTarget" 
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1.50"
                    {...form.register('cpcTarget')} 
                    data-testid="input-cpc-target"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conversionsMin">Conversões Mínimas</Label>
                  <Input 
                    id="conversionsMin" 
                    type="number"
                    placeholder="Ex: 10"
                    {...form.register('conversionsMin')} 
                    data-testid="input-conversions-min"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conversionsTarget">Conversões Alvo</Label>
                  <Input 
                    id="conversionsTarget" 
                    type="number"
                    placeholder="Ex: 50"
                    {...form.register('conversionsTarget')} 
                    data-testid="input-conversions-target"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-policy"
              >
                {editingPolicy ? 'Atualizar Política' : 'Criar Política'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
