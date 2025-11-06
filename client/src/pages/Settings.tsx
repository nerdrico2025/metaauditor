import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit, Eye, EyeOff, Shield, User } from 'lucide-react';

// Form schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  email: z.string().email('Email inválido'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  role: z.enum(['company_admin', 'operador', 'super_admin']),
});

const updateUserSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  firstName: z.string().min(1, 'Nome é obrigatório').optional(),
  lastName: z.string().min(1, 'Sobrenome é obrigatório').optional(),
  role: z.enum(['administrador', 'operador']).optional(),
});

type UpdateProfileData = z.infer<typeof updateProfileSchema>;
type ChangePasswordData = z.infer<typeof changePasswordSchema>;
type CreateUserData = z.infer<typeof createUserSchema>;
type UpdateUserData = z.infer<typeof updateUserSchema>;

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'company_admin' | 'operador' | 'super_admin';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | null;
}

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });

  // Fetch current user profile
  const { data: profile } = useQuery<User>({
    queryKey: ['/api/profile'],
    enabled: !!user,
  });

  // Fetch all users (admin only)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
  });

  // Profile update form
  const profileForm = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
  });

  // Password change form
  const passwordForm = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
  });

  // Create user form
  const createUserForm = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  });

  // Update user form
  const updateUserForm = useForm<UpdateUserData>({
    resolver: zodResolver(updateUserSchema),
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => apiRequest('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Perfil atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordData) => apiRequest('/api/profile/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Senha alterada com sucesso!' });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserData) => apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Usuário criado com sucesso!' });
      setCreateUserDialogOpen(false);
      createUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) => 
      apiRequest(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Usuário atualizado com sucesso!' });
      setEditUserDialog({ open: false, user: null });
      updateUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao atualizar usuário',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Usuário removido com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao remover usuário',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Set form defaults when profile data loads
  if (profile && profile.firstName !== undefined && !profileForm.getValues().firstName) {
    profileForm.reset({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
    });
  }

  // Set form defaults when editing user
  if (editUserDialog.user && editUserDialog.open && !updateUserForm.getValues().email) {
    updateUserForm.reset({
      firstName: editUserDialog.user.firstName || '',
      lastName: editUserDialog.user.lastName || '',
      email: editUserDialog.user.email,
      role: editUserDialog.user.role,
    });
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isMasterUser = (userEmail: string) => userEmail === 'rafael@clickhero.com.br';

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-600 dark:text-gray-300">Gerencie seu perfil e configurações da conta</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" data-testid="tab-users">
              <Shield className="w-4 h-4 mr-2" />
              Gestão de Usuários
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome</Label>
                    <Input
                      id="firstName"
                      data-testid="input-first-name"
                      {...profileForm.register('firstName')}
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {profileForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome</Label>
                    <Input
                      id="lastName"
                      data-testid="input-last-name"
                      {...profileForm.register('lastName')}
                    />
                    {profileForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {profileForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    {...profileForm.register('email')}
                  />
                  {profileForm.formState.errors.email && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {profileForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={user?.role === 'company_admin' || user?.role === 'super_admin' ? 'default' : 'secondary'}>
                    {user?.role === 'company_admin' ? 'Administrador' : user?.role === 'super_admin' ? 'Super Admin' : 'Operador'}
                  </Badge>
                  {isMasterUser(user?.email || '') && (
                    <Badge variant="outline">Usuário Master</Badge>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-update-profile"
                >
                  {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Mantenha sua conta segura com uma senha forte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? 'text' : 'password'}
                      data-testid="input-current-password"
                      {...passwordForm.register('currentPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      data-testid="input-new-password"
                      {...passwordForm.register('newPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      data-testid="input-confirm-password"
                      {...passwordForm.register('confirmPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gestão de Usuários</CardTitle>
                  <CardDescription>
                    Gerencie usuários do sistema, roles e permissões
                  </CardDescription>
                </div>
                <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-user">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Usuário</DialogTitle>
                      <DialogDescription>
                        Preencha os dados do novo usuário
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="createFirstName">Nome</Label>
                            <Input
                              id="createFirstName"
                              data-testid="input-create-first-name"
                              {...createUserForm.register('firstName')}
                            />
                            {createUserForm.formState.errors.firstName && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {createUserForm.formState.errors.firstName.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="createLastName">Sobrenome</Label>
                            <Input
                              id="createLastName"
                              data-testid="input-create-last-name"
                              {...createUserForm.register('lastName')}
                            />
                            {createUserForm.formState.errors.lastName && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {createUserForm.formState.errors.lastName.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="createEmail">Email</Label>
                          <Input
                            id="createEmail"
                            type="email"
                            data-testid="input-create-email"
                            {...createUserForm.register('email')}
                          />
                          {createUserForm.formState.errors.email && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {createUserForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="createPassword">Senha</Label>
                          <Input
                            id="createPassword"
                            type="password"
                            data-testid="input-create-password"
                            {...createUserForm.register('password')}
                          />
                          {createUserForm.formState.errors.password && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {createUserForm.formState.errors.password.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="createRole">Nível de Acesso</Label>
                          <Select onValueChange={(value) => createUserForm.setValue('role', value as 'company_admin' | 'operador' | 'super_admin')}>
                            <SelectTrigger data-testid="select-create-role">
                              <SelectValue placeholder="Selecione o nível" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operador">Operador</SelectItem>
                              <SelectItem value="company_admin">Administrador</SelectItem>
                              {user?.role === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                            </SelectContent>
                          </Select>
                          {createUserForm.formState.errors.role && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {createUserForm.formState.errors.role.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateUserDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createUserMutation.isPending}
                          data-testid="button-submit-create-user"
                        >
                          {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((userItem) => (
                    <div
                      key={userItem.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`user-item-${userItem.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {userItem.firstName} {userItem.lastName}
                          </p>
                          <Badge variant={userItem.role === 'company_admin' || userItem.role === 'super_admin' ? 'default' : 'secondary'}>
                            {userItem.role === 'company_admin' ? 'Admin' : userItem.role === 'super_admin' ? 'Super Admin' : 'Operador'}
                          </Badge>
                          {isMasterUser(userItem.email) && (
                            <Badge variant="outline">Master</Badge>
                          )}
                          {!userItem.isActive && (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{userItem.email}</p>
                        <p className="text-xs text-gray-500">
                          Último acesso: {formatDate(userItem.lastLoginAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditUserDialog({ open: true, user: userItem })}
                          disabled={isMasterUser(userItem.email)}
                          data-testid={`button-edit-user-${userItem.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja remover este usuário?')) {
                              deleteUserMutation.mutate(userItem.id);
                            }
                          }}
                          disabled={
                            isMasterUser(userItem.email) || 
                            userItem.id === user?.id ||
                            deleteUserMutation.isPending
                          }
                          data-testid={`button-delete-user-${userItem.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog 
              open={editUserDialog.open} 
              onOpenChange={(open) => setEditUserDialog({ open, user: null })}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Usuário</DialogTitle>
                  <DialogDescription>
                    Altere os dados do usuário selecionado
                  </DialogDescription>
                </DialogHeader>
                {editUserDialog.user && (
                  <form onSubmit={updateUserForm.handleSubmit((data) => 
                    updateUserMutation.mutate({ id: editUserDialog.user!.id, data })
                  )}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="updateFirstName">Nome</Label>
                          <Input
                            id="updateFirstName"
                            data-testid="input-update-first-name"
                            {...updateUserForm.register('firstName')}
                          />
                          {updateUserForm.formState.errors.firstName && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {updateUserForm.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="updateLastName">Sobrenome</Label>
                          <Input
                            id="updateLastName"
                            data-testid="input-update-last-name"
                            {...updateUserForm.register('lastName')}
                          />
                          {updateUserForm.formState.errors.lastName && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {updateUserForm.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="updateEmail">Email</Label>
                        <Input
                          id="updateEmail"
                          type="email"
                          data-testid="input-update-email"
                          {...updateUserForm.register('email')}
                        />
                        {updateUserForm.formState.errors.email && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {updateUserForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="updateRole">Nível de Acesso</Label>
                        <Select 
                          defaultValue={editUserDialog.user.role}
                          onValueChange={(value) => updateUserForm.setValue('role', value as 'company_admin' | 'operador' | 'super_admin')}
                          disabled={isMasterUser(editUserDialog.user.email)}
                        >
                          <SelectTrigger data-testid="select-update-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="company_admin">Administrador</SelectItem>
                            {user?.role === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                          </SelectContent>
                        </Select>
                        {isMasterUser(editUserDialog.user.email) && (
                          <p className="text-sm text-gray-500">
                            O nível do usuário master não pode ser alterado
                          </p>
                        )}
                        {updateUserForm.formState.errors.role && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {updateUserForm.formState.errors.role.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditUserDialog({ open: false, user: null })}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateUserMutation.isPending}
                        data-testid="button-submit-update-user"
                      >
                        {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}