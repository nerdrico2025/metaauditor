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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Facebook, Bot, Save } from 'lucide-react';

const platformSettingsSchema = z.object({
  appId: z.string().min(1, 'App ID é obrigatório'),
  appSecret: z.string().min(1, 'App Secret é obrigatório'),
  redirectUri: z.string().optional(),
});

const aiSettingsSchema = z.object({
  model: z.string().min(1, 'Modelo é obrigatório'),
  maxTokens: z.number().int().min(100).max(8000),
  temperature: z.string().optional(),
  complianceSystemPrompt: z.string().optional(),
  complianceUserPromptTemplate: z.string().optional(),
  performanceSystemPrompt: z.string().optional(),
  performanceUserPromptTemplate: z.string().optional(),
});

type PlatformSettingsData = z.infer<typeof platformSettingsSchema>;
type AiSettingsData = z.infer<typeof aiSettingsSchema>;

interface PlatformSettings {
  appId: string;
  appSecret: string;
  redirectUri: string;
  isConfigured: boolean;
}

interface AiSettings {
  model: string;
  maxTokens: number;
  temperature: string;
  complianceSystemPrompt: string | null;
  complianceUserPromptTemplate: string | null;
  performanceSystemPrompt: string | null;
  performanceUserPromptTemplate: string | null;
}

const DEFAULT_COMPLIANCE_SYSTEM_PROMPT = `Você é um especialista em conformidade de marca. Analise criativos publicitários para problemas de conformidade e forneça recomendações acionáveis. SEMPRE responda em Português-BR. Quando uma imagem for fornecida, analise-a visualmente e seja PRECISO sobre o que você vê - nunca invente informações que não estão na imagem.`;

const DEFAULT_PERFORMANCE_SYSTEM_PROMPT = `Você é um analista de performance de marketing digital. Analise métricas de performance de anúncios e forneça recomendações de otimização acionáveis. SEMPRE responda em Português-BR.`;

export default function AdminConfiguracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAppSecret, setShowAppSecret] = useState(false);

  const { data: platformSettings } = useQuery<PlatformSettings>({
    queryKey: ['/api/platform-settings/meta'],
    enabled: user?.role === 'super_admin',
  });

  const { data: aiSettings } = useQuery<AiSettings>({
    queryKey: ['/api/ai-settings'],
    enabled: user?.role === 'super_admin',
  });

  const platformForm = useForm<PlatformSettingsData>({
    resolver: zodResolver(platformSettingsSchema) as any,
  });

  const aiForm = useForm<AiSettingsData>({
    resolver: zodResolver(aiSettingsSchema) as any,
    defaultValues: {
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: '0.7',
    },
  });

  useEffect(() => {
    if (platformSettings) {
      platformForm.reset({
        appId: platformSettings.appId || '',
        appSecret: platformSettings.appSecret || '',
        redirectUri: platformSettings.redirectUri || 'https://app.clickauditor.com.br/api/auth/meta/callback',
      });
    }
  }, [platformSettings, platformForm]);

  useEffect(() => {
    if (aiSettings) {
      aiForm.reset({
        model: aiSettings.model || 'gpt-4o',
        maxTokens: aiSettings.maxTokens || 1500,
        temperature: aiSettings.temperature || '0.7',
        complianceSystemPrompt: aiSettings.complianceSystemPrompt || '',
        complianceUserPromptTemplate: aiSettings.complianceUserPromptTemplate || '',
        performanceSystemPrompt: aiSettings.performanceSystemPrompt || '',
        performanceUserPromptTemplate: aiSettings.performanceUserPromptTemplate || '',
      });
    }
  }, [aiSettings, aiForm]);

  const savePlatformSettingsMutation = useMutation({
    mutationFn: (data: PlatformSettingsData) => apiRequest('/api/platform-settings', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'meta',
        ...data,
      }),
    }),
    onSuccess: () => {
      toast({ title: 'Configurações Meta salvas com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/platform-settings/meta'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
    },
  });

  const saveAiSettingsMutation = useMutation({
    mutationFn: (data: AiSettingsData) => apiRequest('/api/ai-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: 'Configurações de IA salvas com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-settings'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar configurações de IA', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <AdminLayout title="Configurações Globais" description="Configure integrações e parâmetros da plataforma">
      <Tabs defaultValue="meta" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meta" className="flex items-center gap-2">
            <Facebook className="w-4 h-4" />
            Meta OAuth
          </TabsTrigger>
          <TabsTrigger value="openai" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            OpenAI / IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta">
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

                  <div className="space-y-2">
                    <Label htmlFor="redirectUri">URL de Redirecionamento (Callback)</Label>
                    <Input
                      id="redirectUri"
                      {...platformForm.register('redirectUri')}
                      placeholder="https://app.clickauditor.com.br/api/auth/meta/callback"
                      data-testid="input-redirect-uri"
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure esta URL nas configurações do seu app Meta em "Valid OAuth Redirect URIs"
                    </p>
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
                    <Save className="w-4 h-4 mr-2" />
                    {savePlatformSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações Meta'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openai">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Configurações do Modelo OpenAI
                </CardTitle>
                <CardDescription>
                  Configure o modelo, tokens e temperatura para as análises de IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={aiForm.handleSubmit((data) => saveAiSettingsMutation.mutate(data))}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="model">Modelo</Label>
                        <Select
                          value={aiForm.watch('model')}
                          onValueChange={(value) => aiForm.setValue('model', value)}
                        >
                          <SelectTrigger data-testid="select-ai-model">
                            <SelectValue placeholder="Selecione o modelo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Mais rápido)</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          GPT-4o é recomendado para análise de imagens
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxTokens">Max Tokens</Label>
                        <Input
                          id="maxTokens"
                          type="number"
                          {...aiForm.register('maxTokens', { valueAsNumber: true })}
                          placeholder="1500"
                          data-testid="input-max-tokens"
                        />
                        <p className="text-xs text-muted-foreground">
                          Limite de tokens na resposta (100-8000)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="temperature">Temperatura</Label>
                        <Select
                          value={aiForm.watch('temperature') || '0.7'}
                          onValueChange={(value) => aiForm.setValue('temperature', value)}
                        >
                          <SelectTrigger data-testid="select-temperature">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.0">0.0 - Determinístico</SelectItem>
                            <SelectItem value="0.3">0.3 - Conservador</SelectItem>
                            <SelectItem value="0.5">0.5 - Balanceado</SelectItem>
                            <SelectItem value="0.7">0.7 - Padrão</SelectItem>
                            <SelectItem value="1.0">1.0 - Criativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Controla a criatividade das respostas
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium mb-4">Prompts de Análise de Compliance</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="complianceSystemPrompt">System Prompt (Compliance)</Label>
                          <Textarea
                            id="complianceSystemPrompt"
                            {...aiForm.register('complianceSystemPrompt')}
                            placeholder={DEFAULT_COMPLIANCE_SYSTEM_PROMPT}
                            rows={4}
                            data-testid="textarea-compliance-system-prompt"
                          />
                          <p className="text-xs text-muted-foreground">
                            Instruções gerais para o modelo sobre como analisar compliance. Deixe vazio para usar o padrão.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="complianceUserPromptTemplate">Template do Prompt de Usuário (Compliance)</Label>
                          <Textarea
                            id="complianceUserPromptTemplate"
                            {...aiForm.register('complianceUserPromptTemplate')}
                            placeholder="Template com variáveis como {{creative_name}}, {{creative_text}}, {{brand_requirements}}, etc."
                            rows={6}
                            data-testid="textarea-compliance-user-prompt"
                          />
                          <p className="text-xs text-muted-foreground">
                            Template do prompt enviado para análise. Deixe vazio para usar o padrão.
                            Variáveis disponíveis: {"{{creative_name}}"}, {"{{creative_text}}"}, {"{{brand_requirements}}"}, {"{{content_requirements}}"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium mb-4">Prompts de Análise de Performance</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="performanceSystemPrompt">System Prompt (Performance)</Label>
                          <Textarea
                            id="performanceSystemPrompt"
                            {...aiForm.register('performanceSystemPrompt')}
                            placeholder={DEFAULT_PERFORMANCE_SYSTEM_PROMPT}
                            rows={4}
                            data-testid="textarea-performance-system-prompt"
                          />
                          <p className="text-xs text-muted-foreground">
                            Instruções gerais para o modelo sobre como analisar performance. Deixe vazio para usar o padrão.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="performanceUserPromptTemplate">Template do Prompt de Usuário (Performance)</Label>
                          <Textarea
                            id="performanceUserPromptTemplate"
                            {...aiForm.register('performanceUserPromptTemplate')}
                            placeholder="Template com variáveis como {{impressions}}, {{clicks}}, {{ctr}}, {{benchmarks}}, etc."
                            rows={6}
                            data-testid="textarea-performance-user-prompt"
                          />
                          <p className="text-xs text-muted-foreground">
                            Template do prompt enviado para análise. Deixe vazio para usar o padrão.
                            Variáveis disponíveis: {"{{impressions}}"}, {"{{clicks}}"}, {"{{ctr}}"}, {"{{cpc}}"}, {"{{benchmarks}}"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={saveAiSettingsMutation.isPending}
                      data-testid="button-save-ai-settings"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saveAiSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações de IA'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
