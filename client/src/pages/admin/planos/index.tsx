import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '../layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ChipsInput } from '../../settings/components/ChipsInput';
import { DollarSign, Plus, Edit, Trash2 } from 'lucide-react';

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Apenas minúsculas, números e hífens'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  billingCycle: z.enum(['monthly', 'yearly']),
  maxUsers: z.coerce.number().int().positive('Deve ser positivo'),
  maxCampaigns: z.coerce.number().int().positive('Deve ser positivo'),
  maxAuditsPerMonth: z.coerce.number().int().positive('Deve ser positivo'),
  maxIntegrations: z.coerce.number().int().positive('Deve ser positivo').default(2),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

type PlanData = z.infer<typeof planSchema>;

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  billingCycle: string;
  maxUsers: number;
  maxCampaigns: number;
  maxAuditsPerMonth: number;
  maxIntegrations: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
}

export default function AdminPlanos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['/api/admin/plans'],
    enabled: user?.role === 'super_admin',
  });

  const planForm = useForm<PlanData>({
    resolver: zodResolver(planSchema) as any,
    defaultValues: {
      billingCycle: 'monthly',
      maxIntegrations: 2,
      features: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (planDialog.plan) {
      planForm.reset({
        name: planDialog.plan.name,
        slug: planDialog.plan.slug,
        description: planDialog.plan.description || '',
        price: Number(planDialog.plan.price),
        billingCycle: planDialog.plan.billingCycle as 'monthly' | 'yearly',
        maxUsers: planDialog.plan.maxUsers,
        maxCampaigns: planDialog.plan.maxCampaigns,
        maxAuditsPerMonth: planDialog.plan.maxAuditsPerMonth,
        maxIntegrations: planDialog.plan.maxIntegrations,
        features: planDialog.plan.features || [],
        isActive: planDialog.plan.isActive,
      });
    } else {
      planForm.reset({
        billingCycle: 'monthly',
        maxIntegrations: 2,
        features: [],
        isActive: true,
      });
    }
  }, [planDialog, planForm]);

  const createPlanMutation = useMutation({
    mutationFn: (data: PlanData) => apiRequest('/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Plano criado com sucesso!' });
      setPlanDialog({ open: false, plan: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar plano', description: error.message, variant: 'destructive' });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlanData }) => 
      apiRequest(`/api/admin/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Plano atualizado com sucesso!' });
      setPlanDialog({ open: false, plan: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar plano', description: error.message, variant: 'destructive' });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Plano removido com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover plano', description: error.message, variant: 'destructive' });
    },
  });

  const handleDelete = () => {
    deletePlanMutation.mutate(deleteDialog.id);
    setDeleteDialog({ open: false, id: '', name: '' });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  return (
    <AdminLayout title="Planos" description="Configure os planos de assinatura">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Planos de Assinatura</h2>
          <Button onClick={() => setPlanDialog({ open: true, plan: null })} data-testid="button-create-plan">
            <Plus className="w-4 h-4 mr-2" />
            Criar Novo Plano
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Nenhum plano cadastrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Campanhas</TableHead>
                    <TableHead>Auditorias/mês</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell className="font-medium" data-testid={`text-plan-name-${plan.id}`}>
                        {plan.name}
                      </TableCell>
                      <TableCell data-testid={`text-plan-description-${plan.id}`}>
                        {plan.description || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-plan-price-${plan.id}`}>
                        {formatCurrency(plan.price)}
                        <span className="text-xs text-gray-500">
                          /{plan.billingCycle === 'monthly' ? 'mês' : 'ano'}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-plan-users-${plan.id}`}>
                        {plan.maxUsers}
                      </TableCell>
                      <TableCell data-testid={`text-plan-campaigns-${plan.id}`}>
                        {plan.maxCampaigns}
                      </TableCell>
                      <TableCell data-testid={`text-plan-audits-${plan.id}`}>
                        {plan.maxAuditsPerMonth}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={plan.isActive ? 'default' : 'secondary'}
                          data-testid={`badge-plan-status-${plan.id}`}
                        >
                          {plan.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPlanDialog({ open: true, plan })}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialog({ 
                              open: true, 
                              id: plan.id, 
                              name: plan.name 
                            })}
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

      <Dialog open={planDialog.open} onOpenChange={(open) => setPlanDialog({ open, plan: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-plan">
          <DialogHeader>
            <DialogTitle>{planDialog.plan ? 'Editar Plano' : 'Criar Novo Plano'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes do plano de assinatura
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={planForm.handleSubmit((data) => {
            if (planDialog.plan) {
              updatePlanMutation.mutate({ id: planDialog.plan.id, data });
            } else {
              createPlanMutation.mutate(data);
            }
          })}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Nome</Label>
                  <Input id="plan-name" {...planForm.register('name')} data-testid="input-plan-name" />
                  {planForm.formState.errors.name && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-slug">Slug</Label>
                  <Input id="plan-slug" {...planForm.register('slug')} data-testid="input-plan-slug" />
                  {planForm.formState.errors.slug && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.slug.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-description">Descrição</Label>
                <Input id="plan-description" {...planForm.register('description')} data-testid="input-plan-description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-price">Preço (R$)</Label>
                  <Input 
                    id="plan-price" 
                    type="number" 
                    step="0.01"
                    {...planForm.register('price')} 
                    data-testid="input-plan-price" 
                  />
                  {planForm.formState.errors.price && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.price.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-billing">Ciclo de Cobrança</Label>
                  <Select 
                    onValueChange={(value) => planForm.setValue('billingCycle', value as 'monthly' | 'yearly')}
                    defaultValue={planForm.getValues('billingCycle')}
                  >
                    <SelectTrigger id="plan-billing" data-testid="select-billing-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-max-users">Máx. Usuários</Label>
                  <Input 
                    id="plan-max-users" 
                    type="number" 
                    {...planForm.register('maxUsers')} 
                    data-testid="input-plan-max-users" 
                  />
                  {planForm.formState.errors.maxUsers && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.maxUsers.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-max-campaigns">Máx. Campanhas</Label>
                  <Input 
                    id="plan-max-campaigns" 
                    type="number" 
                    {...planForm.register('maxCampaigns')} 
                    data-testid="input-plan-max-campaigns" 
                  />
                  {planForm.formState.errors.maxCampaigns && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.maxCampaigns.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-max-audits">Máx. Auditorias/mês</Label>
                  <Input 
                    id="plan-max-audits" 
                    type="number" 
                    {...planForm.register('maxAuditsPerMonth')} 
                    data-testid="input-plan-max-audits" 
                  />
                  {planForm.formState.errors.maxAuditsPerMonth && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.maxAuditsPerMonth.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-max-integrations">Máx. Integrações</Label>
                  <Input 
                    id="plan-max-integrations" 
                    type="number" 
                    {...planForm.register('maxIntegrations')} 
                    data-testid="input-plan-max-integrations" 
                  />
                  {planForm.formState.errors.maxIntegrations && (
                    <p className="text-sm text-red-600">{planForm.formState.errors.maxIntegrations.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Features</Label>
                <ChipsInput
                  value={planForm.watch('features') || []}
                  onChange={(value) => planForm.setValue('features', value)}
                  placeholder="Digite uma feature e pressione Enter"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="plan-is-active"
                  checked={planForm.watch('isActive')}
                  onCheckedChange={(checked) => planForm.setValue('isActive', checked)}
                  data-testid="switch-plan-active"
                />
                <Label htmlFor="plan-is-active">Plano Ativo</Label>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPlanDialog({ open: false, plan: null })}
                data-testid="button-cancel-plan"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                data-testid="button-save-plan"
              >
                {(createPlanMutation.isPending || updatePlanMutation.isPending) 
                  ? 'Salvando...' 
                  : planDialog.plan ? 'Atualizar' : 'Criar'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteDialog.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
