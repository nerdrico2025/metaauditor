import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ChipsInput } from './settings/components/ChipsInput';
import { Building2, Plus, Edit, Trash2, Users, DollarSign, Settings as SettingsIcon, Eye, EyeOff, Facebook } from 'lucide-react';
import SuperAdminSidebar from '@/components/Layout/SuperAdminSidebar';
import Header from '@/components/Layout/Header';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Schemas
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

const adminUserCreateSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['super_admin', 'company_admin']),
  companyId: z.string().optional(),
  isActive: z.boolean().default(true),
});

const adminUserUpdateSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  email: z.string().email('Email inválido'),
  role: z.enum(['super_admin', 'company_admin']),
  companyId: z.string().optional(),
  isActive: z.boolean().default(true),
});

const platformSettingsSchema = z.object({
  appId: z.string().min(1, 'App ID é obrigatório'),
  appSecret: z.string().min(1, 'App Secret é obrigatório'),
});

type PlanData = z.infer<typeof planSchema>;
type CompanyData = z.infer<typeof companySchema>;
type AdminUserCreateData = z.infer<typeof adminUserCreateSchema>;
type AdminUserUpdateData = z.infer<typeof adminUserUpdateSchema>;
type PlatformSettingsData = z.infer<typeof platformSettingsSchema>;

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

interface AdminUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  companyId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  companyName?: string | null;
}

interface PlatformSettings {
  appId: string;
  appSecret: string;
  isConfigured: boolean;
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('companies');
  const [showAppSecret, setShowAppSecret] = useState(false);

  // Dialog states
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; company: Company | null }>({ open: false, company: null });
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string; name: string }>({ 
    open: false, type: '', id: '', name: '' 
  });

  // Redirect if not super_admin
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive'
      });
      setLocation('/dashboard');
    }
  }, [user, setLocation, toast]);

  // Queries
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['/api/admin/plans'],
    enabled: user?.role === 'super_admin',
  });

  const { data: companiesResponse, isLoading: companiesLoading } = useQuery<{ data: Company[]; total: number; page: number; limit: number; totalPages: number }>({
    queryKey: ['/api/admin/companies'],
    enabled: user?.role === 'super_admin',
  });
  const companies = companiesResponse?.data || [];

  const { data: usersResponse, isLoading: usersLoading } = useQuery<{ data: AdminUser[]; total: number; page: number; limit: number; totalPages: number }>({
    queryKey: ['/api/admin/admin-users'],
    enabled: user?.role === 'super_admin',
  });
  const adminUsers = usersResponse?.data || [];

  const { data: platformSettings } = useQuery<PlatformSettings>({
    queryKey: ['/api/platform-settings/meta'],
    enabled: user?.role === 'super_admin',
  });

  // Forms
  const planForm = useForm<PlanData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      billingCycle: 'monthly',
      maxIntegrations: 2,
      features: [],
      isActive: true,
    },
  });

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

  const userForm = useForm<AdminUserCreateData | AdminUserUpdateData>({
    resolver: zodResolver(userDialog.user ? adminUserUpdateSchema : adminUserCreateSchema),
    defaultValues: {
      isActive: true,
    },
  });

  const platformForm = useForm<PlatformSettingsData>({
    resolver: zodResolver(platformSettingsSchema),
  });

  // Set form defaults when editing
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

  useEffect(() => {
    if (userDialog.user) {
      userForm.reset({
        firstName: userDialog.user.firstName || '',
        lastName: userDialog.user.lastName || '',
        email: userDialog.user.email,
        role: userDialog.user.role as 'super_admin' | 'company_admin',
        companyId: userDialog.user.companyId || undefined,
        isActive: userDialog.user.isActive,
      });
    } else {
      userForm.reset({
        isActive: true,
      });
    }
  }, [userDialog, userForm]);

  useEffect(() => {
    if (platformSettings) {
      platformForm.reset({
        appId: platformSettings.appId || '',
        appSecret: platformSettings.appSecret || '',
      });
    }
  }, [platformSettings, platformForm]);

  // Mutations - Plans
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

  // Mutations - Companies
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

  // Mutations - Admin Users
  const createUserMutation = useMutation({
    mutationFn: (data: AdminUserCreateData) => apiRequest('/api/admin/admin-users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Usuário criado com sucesso!' });
      setUserDialog({ open: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admin-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserUpdateData }) => 
      apiRequest(`/api/admin/admin-users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Usuário atualizado com sucesso!' });
      setUserDialog({ open: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admin-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar usuário', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/admin-users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Usuário removido com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admin-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover usuário', description: error.message, variant: 'destructive' });
    },
  });

  // Mutations - Platform Settings
  const savePlatformSettingsMutation = useMutation({
    mutationFn: (data: PlatformSettingsData) => apiRequest('/api/platform-settings', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'meta',
        ...data,
      }),
    }),
    onSuccess: () => {
      toast({ title: 'Configurações salvas com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/platform-settings/meta'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
    },
  });

  // Handlers
  const handleDelete = () => {
    if (deleteDialog.type === 'plan') {
      deletePlanMutation.mutate(deleteDialog.id);
    } else if (deleteDialog.type === 'company') {
      deleteCompanyMutation.mutate(deleteDialog.id);
    } else if (deleteDialog.type === 'user') {
      deleteUserMutation.mutate(deleteDialog.id);
    }
    setDeleteDialog({ open: false, type: '', id: '', name: '' });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  if (user?.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <SuperAdminSidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Super Admin" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin</h1>
                <p className="text-gray-600 dark:text-gray-300">Gerencie empresas, planos, usuários e configurações da plataforma</p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="companies" data-testid="tab-companies">
                    <Building2 className="w-4 h-4 mr-2" />
                    Empresas
                  </TabsTrigger>
                  <TabsTrigger value="plans" data-testid="tab-plans">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Planos
                  </TabsTrigger>
                  <TabsTrigger value="users" data-testid="tab-users">
                    <Users className="w-4 h-4 mr-2" />
                    Usuários Admin
                  </TabsTrigger>
                  <TabsTrigger value="settings" data-testid="tab-settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Configurações
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: EMPRESAS */}
                <TabsContent value="companies" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Empresas</h2>
                    <Button onClick={() => setCompanyDialog({ open: true, company: null })} data-testid="button-create-company">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Nova Empresa
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      {companiesLoading ? (
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
                                        type: 'company', 
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
                </TabsContent>

                {/* TAB 2: PLANOS */}
                <TabsContent value="plans" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Planos de Assinatura</h2>
                    <Button onClick={() => setPlanDialog({ open: true, plan: null })} data-testid="button-create-plan">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Novo Plano
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      {plansLoading ? (
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
                                        type: 'plan', 
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
                </TabsContent>

                {/* TAB 3: USUÁRIOS ADMIN */}
                <TabsContent value="users" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Usuários Administrativos</h2>
                    <Button onClick={() => setUserDialog({ open: true, user: null })} data-testid="button-create-user">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Novo Administrador
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      {usersLoading ? (
                        <div className="p-6 space-y-3">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ) : adminUsers.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600">Nenhum usuário cadastrado</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Empresa</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Último Login</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminUsers.map((adminUser) => (
                              <TableRow key={adminUser.id} data-testid={`row-user-${adminUser.id}`}>
                                <TableCell className="font-medium" data-testid={`text-user-name-${adminUser.id}`}>
                                  {adminUser.firstName} {adminUser.lastName}
                                </TableCell>
                                <TableCell data-testid={`text-user-email-${adminUser.id}`}>
                                  {adminUser.email}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" data-testid={`badge-role-${adminUser.id}`}>
                                    {adminUser.role}
                                  </Badge>
                                </TableCell>
                                <TableCell data-testid={`text-user-company-${adminUser.id}`}>
                                  {adminUser.companyName || '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={adminUser.isActive ? 'default' : 'secondary'}
                                    data-testid={`badge-user-status-${adminUser.id}`}
                                  >
                                    {adminUser.isActive ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </TableCell>
                                <TableCell data-testid={`text-user-login-${adminUser.id}`}>
                                  {formatDate(adminUser.lastLoginAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setUserDialog({ open: true, user: adminUser })}
                                      data-testid={`button-edit-user-${adminUser.id}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => setDeleteDialog({ 
                                        open: true, 
                                        type: 'user', 
                                        id: adminUser.id, 
                                        name: `${adminUser.firstName} ${adminUser.lastName}` 
                                      })}
                                      data-testid={`button-delete-user-${adminUser.id}`}
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
                </TabsContent>

                {/* TAB 4: CONFIGURAÇÕES DA PLATAFORMA */}
                <TabsContent value="settings" className="space-y-4">
                  <h2 className="text-2xl font-bold">Configurações da Plataforma</h2>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Facebook className="w-5 h-5" />
                        Configurações Meta OAuth
                      </CardTitle>
                      <CardDescription>
                        Configure as credenciais do aplicativo Meta para habilitar OAuth
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={platformForm.handleSubmit((data) => savePlatformSettingsMutation.mutate(data))}>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="appId">App ID</Label>
                            <Input
                              id="appId"
                              {...platformForm.register('appId')}
                              placeholder="Digite o App ID do Meta"
                              data-testid="input-app-id"
                            />
                            {platformForm.formState.errors.appId && (
                              <p className="text-sm text-red-600">
                                {platformForm.formState.errors.appId.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="appSecret">App Secret</Label>
                            <div className="relative">
                              <Input
                                id="appSecret"
                                type={showAppSecret ? 'text' : 'password'}
                                {...platformForm.register('appSecret')}
                                placeholder="Digite o App Secret do Meta"
                                data-testid="input-app-secret"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowAppSecret(!showAppSecret)}
                                data-testid="button-toggle-secret"
                              >
                                {showAppSecret ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            {platformForm.formState.errors.appSecret && (
                              <p className="text-sm text-red-600">
                                {platformForm.formState.errors.appSecret.message}
                              </p>
                            )}
                          </div>

                          {platformSettings?.isConfigured && (
                            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
                              <div className="flex">
                                <div className="ml-3">
                                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Configurações ativas
                                  </h3>
                                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                    <p>As configurações do Meta OAuth estão configuradas e prontas para uso.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <Button 
                            type="submit" 
                            disabled={savePlatformSettingsMutation.isPending}
                            data-testid="button-save-platform-settings"
                          >
                            {savePlatformSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL: PLANO */}
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

      {/* MODAL: EMPRESA */}
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

      {/* MODAL: USUÁRIO ADMIN */}
      <Dialog open={userDialog.open} onOpenChange={(open) => setUserDialog({ open, user: null })}>
        <DialogContent className="max-w-2xl" data-testid="dialog-user">
          <DialogHeader>
            <DialogTitle>{userDialog.user ? 'Editar Usuário' : 'Criar Novo Administrador'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes do usuário administrativo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={userForm.handleSubmit((data) => {
            if (userDialog.user) {
              updateUserMutation.mutate({ id: userDialog.user.id, data: data as AdminUserUpdateData });
            } else {
              createUserMutation.mutate(data as AdminUserCreateData);
            }
          })}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-first-name">Nome</Label>
                  <Input id="user-first-name" {...userForm.register('firstName')} data-testid="input-user-first-name" />
                  {userForm.formState.errors.firstName && (
                    <p className="text-sm text-red-600">{userForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-last-name">Sobrenome</Label>
                  <Input id="user-last-name" {...userForm.register('lastName')} data-testid="input-user-last-name" />
                  {userForm.formState.errors.lastName && (
                    <p className="text-sm text-red-600">{userForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input 
                  id="user-email" 
                  type="email" 
                  {...userForm.register('email')} 
                  data-testid="input-user-email" 
                />
                {userForm.formState.errors.email && (
                  <p className="text-sm text-red-600">{userForm.formState.errors.email.message}</p>
                )}
              </div>

              {!userDialog.user && (
                <div className="space-y-2">
                  <Label htmlFor="user-password">Senha</Label>
                  <Input 
                    id="user-password" 
                    type="password" 
                    {...userForm.register('password' as any)} 
                    data-testid="input-user-password" 
                  />
                  {userForm.formState.errors.password && (
                    <p className="text-sm text-red-600">{userForm.formState.errors.password.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select 
                  onValueChange={(value) => userForm.setValue('role', value as 'super_admin' | 'company_admin')}
                  defaultValue={userForm.getValues('role')}
                >
                  <SelectTrigger id="user-role" data-testid="select-user-role">
                    <SelectValue placeholder="Selecione o role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userForm.watch('role') === 'company_admin' && (
                <div className="space-y-2">
                  <Label htmlFor="user-company">Empresa</Label>
                  <Select 
                    onValueChange={(value) => userForm.setValue('companyId', value)}
                    defaultValue={userForm.getValues('companyId')}
                  >
                    <SelectTrigger id="user-company" data-testid="select-user-company">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="user-is-active"
                  checked={userForm.watch('isActive')}
                  onCheckedChange={(checked) => userForm.setValue('isActive', checked)}
                  data-testid="switch-user-active"
                />
                <Label htmlFor="user-is-active">Usuário Ativo</Label>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setUserDialog({ open: false, user: null })}
                data-testid="button-cancel-user"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                {(createUserMutation.isPending || updateUserMutation.isPending) 
                  ? 'Salvando...' 
                  : userDialog.user ? 'Atualizar' : 'Criar'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
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
    </div>
  );
}
