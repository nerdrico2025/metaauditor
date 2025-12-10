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
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';

const companySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Apenas minúsculas, números e hífens'),
  contactEmail: z.string().email('Email inválido'),
  taxId: z.string().optional(),
  subscriptionPlan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'suspended', 'trial', 'cancelled']),
  maxUsers: z.coerce.number().int().positive('Deve ser positivo'),
  maxCampaigns: z.coerce.number().int().positive('Deve ser positivo'),
  maxAuditsPerMonth: z.coerce.number().int().positive('Deve ser positivo'),
});

type CompanyData = z.infer<typeof companySchema>;

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string;
  contactEmail: string | null;
  taxId: string | null;
  currentUsers: number;
  maxUsers: number;
  currentCampaigns: number;
  maxCampaigns: number;
  auditsThisMonth: number;
  maxAuditsPerMonth: number;
  createdAt: Date;
}

export default function AdminEmpresas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; company: Company | null }>({ open: false, company: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });

  const { data: companiesResponse, isLoading } = useQuery<{ data: Company[]; total: number; page: number; limit: number; totalPages: number }>({
    queryKey: ['/api/admin/companies'],
    enabled: user?.role === 'super_admin',
  });
  const companies = companiesResponse?.data || [];

  const companyForm = useForm<CompanyData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      subscriptionPlan: 'free',
      status: 'trial',
      maxUsers: 5,
      maxCampaigns: 10,
      maxAuditsPerMonth: 100,
    },
  });

  useEffect(() => {
    if (companyDialog.company) {
      companyForm.reset({
        name: companyDialog.company.name,
        slug: companyDialog.company.slug,
        contactEmail: companyDialog.company.contactEmail || '',
        taxId: companyDialog.company.taxId || '',
        subscriptionPlan: companyDialog.company.subscriptionPlan as any,
        status: companyDialog.company.status as any,
        maxUsers: companyDialog.company.maxUsers,
        maxCampaigns: companyDialog.company.maxCampaigns,
        maxAuditsPerMonth: companyDialog.company.maxAuditsPerMonth,
      });
    } else {
      companyForm.reset({
        subscriptionPlan: 'free',
        status: 'trial',
        maxUsers: 5,
        maxCampaigns: 10,
        maxAuditsPerMonth: 100,
      });
    }
  }, [companyDialog, companyForm]);

  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyData) => apiRequest('/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Empresa criada com sucesso!' });
      setCompanyDialog({ open: false, company: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar empresa', description: error.message, variant: 'destructive' });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyData }) => 
      apiRequest(`/api/admin/companies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Empresa atualizada com sucesso!' });
      setCompanyDialog({ open: false, company: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar empresa', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Empresa removida com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover empresa', description: error.message, variant: 'destructive' });
    },
  });

  const handleDelete = () => {
    deleteCompanyMutation.mutate(deleteDialog.id);
    setDeleteDialog({ open: false, id: '', name: '' });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <AdminLayout title="Empresas" description="Gerencie as empresas da plataforma">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Empresas</h2>
          <Button onClick={() => setCompanyDialog({ open: true, company: null })} data-testid="button-create-company">
            <Plus className="w-4 h-4 mr-2" />
            Criar Nova Empresa
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
            ) : companies.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Nenhuma empresa cadastrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Campanhas</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                      <TableCell className="font-medium" data-testid={`text-company-name-${company.id}`}>
                        {company.name}
                      </TableCell>
                      <TableCell data-testid={`text-company-slug-${company.id}`}>/{company.slug}</TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-plan-${company.id}`}>
                          {company.subscriptionPlan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={company.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`badge-status-${company.id}`}
                        >
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-users-${company.id}`}>
                        {company.currentUsers}/{company.maxUsers}
                      </TableCell>
                      <TableCell data-testid={`text-campaigns-${company.id}`}>
                        {company.currentCampaigns}/{company.maxCampaigns}
                      </TableCell>
                      <TableCell data-testid={`text-email-${company.id}`}>
                        {company.contactEmail || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-created-${company.id}`}>
                        {formatDate(company.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompanyDialog({ open: true, company })}
                            data-testid={`button-edit-company-${company.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialog({ 
                              open: true, 
                              id: company.id, 
                              name: company.name 
                            })}
                            data-testid={`button-delete-company-${company.id}`}
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

      <Dialog open={companyDialog.open} onOpenChange={(open) => setCompanyDialog({ open, company: null })}>
        <DialogContent className="max-w-3xl" data-testid="dialog-company">
          <DialogHeader>
            <DialogTitle>{companyDialog.company ? 'Editar Empresa' : 'Criar Nova Empresa'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes da empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={companyForm.handleSubmit((data) => {
            if (companyDialog.company) {
              updateCompanyMutation.mutate({ id: companyDialog.company.id, data });
            } else {
              createCompanyMutation.mutate(data);
            }
          })}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nome</Label>
                  <Input id="company-name" {...companyForm.register('name')} data-testid="input-company-name" />
                  {companyForm.formState.errors.name && (
                    <p className="text-sm text-red-600">{companyForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-slug">Slug</Label>
                  <Input id="company-slug" {...companyForm.register('slug')} data-testid="input-company-slug" />
                  {companyForm.formState.errors.slug && (
                    <p className="text-sm text-red-600">{companyForm.formState.errors.slug.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email de Contato</Label>
                  <Input 
                    id="company-email" 
                    type="email" 
                    {...companyForm.register('contactEmail')} 
                    data-testid="input-company-email" 
                  />
                  {companyForm.formState.errors.contactEmail && (
                    <p className="text-sm text-red-600">{companyForm.formState.errors.contactEmail.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-tax-id">CNPJ</Label>
                  <Input id="company-tax-id" {...companyForm.register('taxId')} data-testid="input-company-tax-id" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-plan">Plano</Label>
                  <Select 
                    onValueChange={(value) => companyForm.setValue('subscriptionPlan', value as any)}
                    defaultValue={companyForm.getValues('subscriptionPlan')}
                  >
                    <SelectTrigger id="company-plan" data-testid="select-company-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-status">Status</Label>
                  <Select 
                    onValueChange={(value) => companyForm.setValue('status', value as any)}
                    defaultValue={companyForm.getValues('status')}
                  >
                    <SelectTrigger id="company-status" data-testid="select-company-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-max-users">Máx. Usuários</Label>
                  <Input 
                    id="company-max-users" 
                    type="number" 
                    {...companyForm.register('maxUsers')} 
                    data-testid="input-company-max-users" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-max-campaigns">Máx. Campanhas</Label>
                  <Input 
                    id="company-max-campaigns" 
                    type="number" 
                    {...companyForm.register('maxCampaigns')} 
                    data-testid="input-company-max-campaigns" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-max-audits">Máx. Auditorias/mês</Label>
                  <Input 
                    id="company-max-audits" 
                    type="number" 
                    {...companyForm.register('maxAuditsPerMonth')} 
                    data-testid="input-company-max-audits" 
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCompanyDialog({ open: false, company: null })}
                data-testid="button-cancel-company"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                data-testid="button-save-company"
              >
                {(createCompanyMutation.isPending || updateCompanyMutation.isPending) 
                  ? 'Salvando...' 
                  : companyDialog.company ? 'Atualizar' : 'Criar'
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
