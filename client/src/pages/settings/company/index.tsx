import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Save, 
  CreditCard, 
  Users, 
  Target, 
  BarChart3,
  Calendar,
  Mail,
  Phone,
  Pencil,
  X
} from 'lucide-react';

const companySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório'),
  contactEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  billingEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  taxId: z.string().optional(),
});

type CompanyData = z.infer<typeof companySchema>;

interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  subscriptionPlan: 'free' | 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  maxUsers: number;
  maxCampaigns: number;
  maxAuditsPerMonth: number;
  contactEmail: string | null;
  contactPhone: string | null;
  billingEmail: string | null;
  taxId: string | null;
  createdAt: string;
  updatedAt: string;
}

const planNames: Record<string, string> = {
  free: 'Gratuito',
  starter: 'Starter',
  professional: 'Profissional',
  enterprise: 'Enterprise',
};

const statusNames: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  trial: 'Período de Teste',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function Company() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['/api/company'],
    enabled: isAuthenticated && !!user?.companyId,
  });

  const form = useForm<CompanyData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      contactEmail: '',
      contactPhone: '',
      billingEmail: '',
      taxId: '',
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        contactEmail: company.contactEmail || '',
        contactPhone: company.contactPhone || '',
        billingEmail: company.billingEmail || '',
        taxId: company.taxId || '',
      });
    }
  }, [company, form]);

  const updateCompanyMutation = useMutation({
    mutationFn: (data: CompanyData) => apiRequest('/api/company', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Dados da empresa atualizados com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/company'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao atualizar dados',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const onSubmit = (data: CompanyData) => {
    updateCompanyMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    if (company) {
      form.reset({
        name: company.name || '',
        contactEmail: company.contactEmail || '',
        contactPhone: company.contactPhone || '',
        billingEmail: company.billingEmail || '',
        taxId: company.taxId || '',
      });
    }
    setIsEditing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header title="Dados da Empresa" />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="py-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <Skeleton className="h-96" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.companyId) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header title="Dados da Empresa" />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="py-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Nenhuma empresa vinculada
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Sua conta não está vinculada a nenhuma empresa.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Dados da Empresa" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {company?.name || 'Minha Empresa'}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                      Gerencie as informações da sua empresa
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Plano Atual</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {planNames[company?.subscriptionPlan || 'free']}
                        </p>
                      </div>
                      <CreditCard className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                        <div className="mt-1">
                          <Badge className={statusColors[company?.status || 'trial']}>
                            {statusNames[company?.status || 'trial']}
                          </Badge>
                        </div>
                      </div>
                      <BarChart3 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Limite de Usuários</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {company?.maxUsers || 0}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Limite de Campanhas</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {company?.maxCampaigns || 0}
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Subscription Info */}
              <Card className="mb-6 bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Informações da Assinatura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Início da Assinatura</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatDate(company?.subscriptionStartDate || null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Válido Até</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatDate(company?.subscriptionEndDate || null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Auditorias/Mês</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {company?.maxAuditsPerMonth || 0} análises
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Company Data */}
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Dados Cadastrais
                      </CardTitle>
                      <CardDescription>
                        Informações da sua empresa
                      </CardDescription>
                    </div>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        data-testid="button-edit-company"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar Informações
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="name">Nome da Empresa *</Label>
                          <Input
                            id="name"
                            placeholder="Ex: Click Hero Marketing Digital"
                            data-testid="input-company-name"
                            {...form.register('name')}
                          />
                          {form.formState.errors.name && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {form.formState.errors.name.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="taxId" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            CNPJ
                          </Label>
                          <Input
                            id="taxId"
                            placeholder="00.000.000/0000-00"
                            data-testid="input-company-taxid"
                            {...form.register('taxId')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contactPhone" className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Telefone de Contato
                          </Label>
                          <Input
                            id="contactPhone"
                            placeholder="(00) 00000-0000"
                            data-testid="input-company-phone"
                            {...form.register('contactPhone')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contactEmail" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email de Contato
                          </Label>
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="contato@empresa.com"
                            data-testid="input-company-email"
                            {...form.register('contactEmail')}
                          />
                          {form.formState.errors.contactEmail && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {form.formState.errors.contactEmail.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="billingEmail" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Email de Faturamento
                          </Label>
                          <Input
                            id="billingEmail"
                            type="email"
                            placeholder="financeiro@empresa.com"
                            data-testid="input-company-billing-email"
                            {...form.register('billingEmail')}
                          />
                          {form.formState.errors.billingEmail && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {form.formState.errors.billingEmail.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                          data-testid="button-cancel-edit"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateCompanyMutation.isPending}
                          data-testid="button-save-company"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {updateCompanyMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Nome da Empresa</p>
                        <p className="text-lg text-gray-900 dark:text-white mt-1">
                          {company?.name || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          CNPJ
                        </p>
                        <p className="text-lg text-gray-900 dark:text-white mt-1">
                          {company?.taxId || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Telefone de Contato
                        </p>
                        <p className="text-lg text-gray-900 dark:text-white mt-1">
                          {company?.contactPhone || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email de Contato
                        </p>
                        <p className="text-lg text-gray-900 dark:text-white mt-1">
                          {company?.contactEmail || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Email de Faturamento
                        </p>
                        <p className="text-lg text-gray-900 dark:text-white mt-1">
                          {company?.billingEmail || '-'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card className="mt-6 bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Informações da Conta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ID da Empresa</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {company?.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Slug</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {company?.slug}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Criada em</p>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {formatDate(company?.createdAt || null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Última Atualização</p>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {formatDate(company?.updatedAt || null)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
