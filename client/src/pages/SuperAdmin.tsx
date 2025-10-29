
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Edit, Trash2, Users, TrendingUp, Calendar } from 'lucide-react';
import SuperAdminSidebar from '@/components/Layout/SuperAdminSidebar';
import Header from '@/components/Layout/Header';

const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Apenas minúsculas, números e hífens'),
  contactEmail: z.string().email('Email inválido'),
  subscriptionPlan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  maxUsers: z.coerce.number().int().positive(),
  maxCampaigns: z.coerce.number().int().positive(),
  maxAuditsPerMonth: z.coerce.number().int().positive(),
});

type CreateCompanyData = z.infer<typeof createCompanySchema>;

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string;
  currentUsers: number;
  maxUsers: number;
  currentCampaigns: number;
  maxCampaigns: number;
  auditsThisMonth: number;
  maxAuditsPerMonth: number;
  createdAt: Date;
  trialEndsAt: Date | null;
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Verificar se é super admin
  if (user?.role !== 'super_admin') {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas super administradores podem acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const form = useForm<CreateCompanyData>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      subscriptionPlan: 'free',
      maxUsers: 5,
      maxCampaigns: 10,
      maxAuditsPerMonth: 100,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCompanyData) => apiRequest('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Empresa criada com sucesso!' });
      setCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar empresa',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Empresa removida com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao remover empresa',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trial: 'secondary',
      suspended: 'destructive',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-yellow-100 text-yellow-800',
    };
    return <Badge className={colors[plan] || ''}>{plan}</Badge>;
  };

  return (
    <div className="flex h-screen bg-background">
      <SuperAdminSidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Gestão de Empresas" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestão de empresas (tenants)</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Empresa</DialogTitle>
              <DialogDescription>
                Configure uma nova empresa no sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Empresa</Label>
                    <Input id="name" {...form.register('name')} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <Input id="slug" {...form.register('slug')} placeholder="minha-empresa" />
                    {form.formState.errors.slug && (
                      <p className="text-sm text-red-600">{form.formState.errors.slug.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email de Contato</Label>
                  <Input id="contactEmail" type="email" {...form.register('contactEmail')} />
                  {form.formState.errors.contactEmail && (
                    <p className="text-sm text-red-600">{form.formState.errors.contactEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscriptionPlan">Plano</Label>
                  <Select onValueChange={(value) => form.setValue('subscriptionPlan', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxUsers">Máx. Usuários</Label>
                    <Input id="maxUsers" type="number" {...form.register('maxUsers')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxCampaigns">Máx. Campanhas</Label>
                    <Input id="maxCampaigns" type="number" {...form.register('maxCampaigns')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAuditsPerMonth">Máx. Auditorias/mês</Label>
                    <Input id="maxAuditsPerMonth" type="number" {...form.register('maxAuditsPerMonth')} />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Empresa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p>Carregando empresas...</p>
            </CardContent>
          </Card>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Nenhuma empresa cadastrada</h3>
              <p className="text-gray-600 mb-4">Crie a primeira empresa para começar</p>
            </CardContent>
          </Card>
        ) : (
          companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {company.name}
                    </CardTitle>
                    <CardDescription>
                      /{company.slug}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(company.status)}
                    {getPlanBadge(company.subscriptionPlan)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {company.currentUsers}/{company.maxUsers} usuários
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {company.currentCampaigns}/{company.maxCampaigns} campanhas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {company.auditsThisMonth}/{company.maxAuditsPerMonth} auditorias
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Criada em: {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                    {company.trialEndsAt && ` • Trial até: ${new Date(company.trialEndsAt).toLocaleDateString('pt-BR')}`}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja remover ${company.name}?`)) {
                          deleteMutation.mutate(company.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
