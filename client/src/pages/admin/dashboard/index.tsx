import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, CreditCard, BarChart3 } from 'lucide-react';

interface Company {
  id: string;
  auditsThisMonth: number;
}

interface Plan {
  id: string;
  isActive: boolean;
}

interface AdminUser {
  id: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: companiesResponse, isLoading: companiesLoading } = useQuery<{ data: Company[]; total: number }>({
    queryKey: ['/api/admin/companies'],
    enabled: user?.role === 'super_admin',
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['/api/admin/plans'],
    enabled: user?.role === 'super_admin',
  });

  const { data: usersResponse, isLoading: usersLoading } = useQuery<{ data: AdminUser[]; total: number }>({
    queryKey: ['/api/admin/admin-users'],
    enabled: user?.role === 'super_admin',
  });

  const totalCompanies = companiesResponse?.total || 0;
  const totalUsers = usersResponse?.total || 0;
  const activePlans = plans.filter(p => p.isActive).length;
  const totalAuditsThisMonth = (companiesResponse?.data || []).reduce((sum, c) => sum + (c.auditsThisMonth || 0), 0);

  const isLoading = companiesLoading || plansLoading || usersLoading;

  return (
    <AdminLayout title="Dashboard" description="Visão geral da plataforma">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-companies">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-companies">{totalCompanies}</div>
            )}
            <p className="text-xs text-muted-foreground">Empresas cadastradas</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Admin</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</div>
            )}
            <p className="text-xs text-muted-foreground">Administradores ativos</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-plans">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-active-plans">{activePlans}</div>
            )}
            <p className="text-xs text-muted-foreground">Planos disponíveis</p>
          </CardContent>
        </Card>

        <Card data-testid="card-audits-month">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auditorias do Mês</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-audits-month">{totalAuditsThisMonth}</div>
            )}
            <p className="text-xs text-muted-foreground">Auditorias realizadas</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
