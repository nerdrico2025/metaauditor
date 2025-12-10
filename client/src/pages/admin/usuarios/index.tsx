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
import { Users, Plus, Edit, Trash2 } from 'lucide-react';

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

type AdminUserCreateData = z.infer<typeof adminUserCreateSchema>;
type AdminUserUpdateData = z.infer<typeof adminUserUpdateSchema>;

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

interface Company {
  id: string;
  name: string;
}

export default function AdminUsuarios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });

  const { data: usersResponse, isLoading } = useQuery<{ data: AdminUser[]; total: number; page: number; limit: number; totalPages: number }>({
    queryKey: ['/api/admin/admin-users'],
    enabled: user?.role === 'super_admin',
  });
  const adminUsers = usersResponse?.data || [];

  const { data: companiesResponse } = useQuery<{ data: Company[] }>({
    queryKey: ['/api/admin/companies'],
    enabled: user?.role === 'super_admin',
  });
  const companies = companiesResponse?.data || [];

  const userForm = useForm<AdminUserCreateData | AdminUserUpdateData>({
    resolver: zodResolver(userDialog.user ? adminUserUpdateSchema : adminUserCreateSchema),
    defaultValues: {
      isActive: true,
    },
  });

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

  const handleDelete = () => {
    deleteUserMutation.mutate(deleteDialog.id);
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
    <AdminLayout title="Usuários Admin" description="Gerencie os administradores da plataforma">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Usuários Administrativos</h2>
          <Button onClick={() => setUserDialog({ open: true, user: null })} data-testid="button-create-user">
            <Plus className="w-4 h-4 mr-2" />
            Criar Novo Administrador
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
      </div>

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
