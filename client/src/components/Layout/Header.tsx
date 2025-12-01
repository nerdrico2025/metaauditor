import { useState, useEffect } from 'react';
import { Menu } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut, Key, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; email: string }) => 
      apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Perfil atualizado com sucesso!' });
      setIsProfileOpen(false);
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
    mutationFn: (data: { currentPassword: string; newPassword: string }) => 
      apiRequest('/api/users/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Senha alterada com sucesso!' });
      setIsPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleLogout = () => {
    logout();
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({
        title: 'Preencha todos os campos',
        variant: 'destructive'
      });
      return;
    }
    updateProfileMutation.mutate({ firstName, lastName, email });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Preencha todos os campos');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleOpenProfile = () => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setIsProfileOpen(true);
  };

  const handleOpenPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setIsPasswordOpen(true);
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.name) {
      return user.name;
    }
    return user?.email || 'Usuário';
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-white shadow-sm border-b border-slate-200">
        <button className="px-4 border-r border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden">
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 px-4 flex justify-between sm:px-6 lg:px-8">
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          </div>

          <div className="ml-4 flex items-center md:ml-6 space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenProfile} data-testid="menu-profile">
                  <User className="w-4 h-4 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenPassword} data-testid="menu-change-password">
                  <Key className="w-4 h-4 mr-2" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Meu Perfil</DialogTitle>
            <DialogDescription>
              Atualize suas informações pessoais
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  placeholder="Seu nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-profile-firstname"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-profile-lastname"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-profile-email"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsProfileOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua senha atual e a nova senha
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsPasswordOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                <Key className="w-4 h-4 mr-2" />
                {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
