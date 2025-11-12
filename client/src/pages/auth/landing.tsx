import { useState, useEffect } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginFormComponent({ 
  error, 
  setError, 
  showPassword, 
  setShowPassword, 
  login, 
  setLocation,
  isLoading 
}: {
  error: string | null;
  setError: (error: string | null) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  setLocation: (path: string) => void;
  isLoading: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.email, data.password);
      // Don't redirect here - let the useEffect in Landing handle it
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-click-hero-orange mx-auto"></div>
        <p className="mt-2 text-click-hero-dark-gray">Verificando...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="email" className="text-click-hero-black">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          className="border-click-hero-white-2 focus:border-click-hero-orange"
          data-testid="input-email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-click-hero-black">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Digite sua senha"
            className="border-click-hero-white-2 focus:border-click-hero-orange pr-10"
            data-testid="input-password"
            {...register('password')}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            data-testid="button-toggle-password"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-click-hero-dark-gray" />
            ) : (
              <Eye className="h-4 w-4 text-click-hero-dark-gray" />
            )}
          </Button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-click-hero-orange hover:bg-click-hero-orange/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        disabled={isSubmitting}
        data-testid="button-login"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Acessando...
          </div>
        ) : (
          'ACESSAR'
        )}
      </Button>

      <p className="text-center text-click-hero-dark-gray text-sm mt-4">
        Use: rafael@clickhero.com.br / X@drez13
      </p>
    </form>
  );
}

export default function Landing() {
  const [location, setLocation] = useLocation();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading && user) {
      // Redirect based on role
      if (user.role === 'super_admin') {
        setLocation('/super-admin');
      } else {
        setLocation('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, user, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-click-hero-white-2 to-click-hero-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-click-hero-orange mx-auto"></div>
          <p className="mt-2 text-click-hero-dark-gray">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is authenticated (redirect happening)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-click-hero-white-2 to-click-hero-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-click-hero-orange mx-auto"></div>
          <p className="mt-2 text-click-hero-dark-gray">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-click-hero-white-2 to-click-hero-white flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-bold text-click-hero-black">
              Click Auditor
            </h1>
            <p className="text-xl text-click-hero-dark-gray">
              Auditoria automática de criativos para Meta e Google Ads com IA avançada
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">🤖 Análise com IA</h3>
                <p className="text-click-hero-dark-gray">
                  Análise automática de conformidade e performance usando inteligência artificial
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">🔗 Integrações</h3>
                <p className="text-click-hero-dark-gray">
                  Conecte-se facilmente com Meta Business e Google Ads
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">📊 Relatórios</h3>
                <p className="text-click-hero-dark-gray">
                  Relatórios detalhados e dashboards em tempo real
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">⚡ Automação</h3>
                <p className="text-click-hero-dark-gray">
                  Ações automáticas para otimizar suas campanhas
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md space-y-6">
            <div className="bg-click-hero-white p-8 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-click-hero-black mb-6 text-center">
                Acesse a ferramenta
              </h2>
              
              {isAuthenticated ? (
                <div className="text-center">
                  <p className="text-click-hero-dark-gray mb-4">Você já está logado!</p>
                  <Button
                    onClick={() => setLocation('/dashboard')}
                    className="w-full bg-click-hero-orange hover:bg-click-hero-orange/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    IR PARA DASHBOARD
                  </Button>
                </div>
              ) : (
                <LoginFormComponent 
                  error={error}
                  setError={setError}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  login={login}
                  setLocation={setLocation}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}