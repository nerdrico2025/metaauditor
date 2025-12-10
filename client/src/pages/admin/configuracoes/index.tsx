import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '../layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Facebook } from 'lucide-react';

const platformSettingsSchema = z.object({
  appId: z.string().min(1, 'App ID é obrigatório'),
  appSecret: z.string().min(1, 'App Secret é obrigatório'),
});

type PlatformSettingsData = z.infer<typeof platformSettingsSchema>;

interface PlatformSettings {
  appId: string;
  appSecret: string;
  isConfigured: boolean;
}

export default function AdminConfiguracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAppSecret, setShowAppSecret] = useState(false);

  const { data: platformSettings } = useQuery<PlatformSettings>({
    queryKey: ['/api/platform-settings/meta'],
    enabled: user?.role === 'super_admin',
  });

  const platformForm = useForm<PlatformSettingsData>({
    resolver: zodResolver(platformSettingsSchema) as any,
  });

  useEffect(() => {
    if (platformSettings) {
      platformForm.reset({
        appId: platformSettings.appId || '',
        appSecret: platformSettings.appSecret || '',
      });
    }
  }, [platformSettings, platformForm]);

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

  return (
    <AdminLayout title="Configurações Globais" description="Configure integrações e parâmetros da plataforma">
      <div className="space-y-4">
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
      </div>
    </AdminLayout>
  );
}
