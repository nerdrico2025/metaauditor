import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertIntegrationSchema } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Info } from "lucide-react";
import { SiFacebook, SiGoogle } from "react-icons/si";
import type { Integration } from "@shared/schema";

interface IntegrationModalProps {
  integration: Integration | null;
  onClose: () => void;
}

const formSchema = insertIntegrationSchema.omit({ userId: true }).extend({
  platform: z.enum(['meta', 'google']),
  accessToken: z.string().min(1, "Access Token é obrigatório"),
  accountId: z.string().min(1, "Account ID é obrigatório"),
  refreshToken: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function IntegrationModal({ integration, onClose }: IntegrationModalProps) {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<string>(integration?.platform || '');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: integration?.platform || undefined,
      accessToken: integration?.accessToken || '',
      refreshToken: integration?.refreshToken || '',
      accountId: integration?.accountId || '',
      status: integration?.status || 'active',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (integration) {
        return await apiRequest("PUT", `/api/integrations/${integration.id}`, data);
      } else {
        return await apiRequest("POST", "/api/integrations", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: integration ? "Integração atualizada com sucesso" : "Integração criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Não autorizado",
          description: "Você está desconectado. Redirecionando para login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: integration ? "Falha ao atualizar integração" : "Falha ao criar integração",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'meta':
        return <SiFacebook className="h-5 w-5 text-blue-600" />;
      case 'google':
        return <SiGoogle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'Meta Ads Manager';
      case 'google':
        return 'Google Ads';
      default:
        return platform;
    }
  };

  const getInstructions = (platform: string) => {
    switch (platform) {
      case 'meta':
        return {
          steps: [
            'Acesse o Meta Business Manager (business.facebook.com)',
            'Vá para Configurações > Contas de Anúncio',
            'Selecione sua conta e copie o Account ID',
            'Acesse o Graph API Explorer para gerar um Access Token',
            'Selecione as permissões: ads_read, ads_management',
          ],
          accessTokenHelp: 'Token gerado no Graph API Explorer com permissões de ads_read',
          accountIdHelp: 'ID da sua conta de anúncios (ex: act_123456789)',
          refreshTokenHelp: 'Token de longa duração (opcional mas recomendado)',
          docsUrl: 'https://developers.facebook.com/docs/marketing-api/get-started',
        };
      case 'google':
        return {
          steps: [
            'Acesse o Google Cloud Console (console.cloud.google.com)',
            'Crie um projeto e ative a Google Ads API',
            'Configure OAuth 2.0 e crie credenciais',
            'Autorize o acesso à sua conta Google Ads',
            'Copie as credenciais geradas',
          ],
          accessTokenHelp: 'Access Token obtido através do OAuth 2.0',
          accountIdHelp: 'Customer ID da sua conta Google Ads (ex: 123-456-7890)',
          refreshTokenHelp: 'Refresh Token para renovar o acesso automaticamente',
          docsUrl: 'https://developers.google.com/google-ads/api/docs/get-started',
        };
      default:
        return null;
    }
  };

  const instructions = selectedPlatform ? getInstructions(selectedPlatform) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedPlatform && getPlatformIcon(selectedPlatform)}
            {integration ? `Editar Integração` : `Conectar Conta de Anúncios`}
            {selectedPlatform && (
              <Badge variant="outline" className="ml-2">
                {getPlatformName(selectedPlatform)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {integration 
              ? "Atualize as credenciais da sua integração"
              : "Conecte sua conta de anúncios para análise automática de criativos"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plataforma de Anúncios</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedPlatform(value);
                        }} 
                        defaultValue={field.value}
                        disabled={!!integration}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a plataforma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="meta">
                            <div className="flex items-center gap-2">
                              <SiFacebook className="h-4 w-4 text-blue-600" />
                              Meta Ads Manager
                            </div>
                          </SelectItem>
                          <SelectItem value="google">
                            <div className="flex items-center gap-2">
                              <SiGoogle className="h-4 w-4 text-red-600" />
                              Google Ads
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Cole seu Access Token aqui..."
                          className="min-h-[80px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      {instructions && (
                        <FormDescription>
                          {instructions.accessTokenHelp}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account ID</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: act_123456789 ou 123-456-7890" {...field} />
                      </FormControl>
                      {instructions && (
                        <FormDescription>
                          {instructions.accountIdHelp}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="refreshToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refresh Token (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Cole seu Refresh Token aqui..."
                          className="min-h-[60px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      {instructions && (
                        <FormDescription>
                          {instructions.refreshTokenHelp}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {integration ? "Atualizando..." : "Conectando..."}
                      </>
                    ) : (
                      integration ? "Atualizar" : "Conectar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>

          {/* Instructions Section */}
          {instructions && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-blue-800">
                    Como obter as credenciais
                  </h4>
                </div>
                
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                  {instructions.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>

                <div className="mt-4 pt-3 border-t border-blue-200">
                  <a
                    href={instructions.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Documentação oficial
                  </a>
                </div>
              </div>

              {selectedPlatform === 'meta' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-2">⚠️ Importante</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Tokens têm validade limitada (1-2 horas)</li>
                    <li>• Use tokens de longa duração para produção</li>
                    <li>• Mantenha as credenciais seguras</li>
                    <li>• Teste a conexão após configurar</li>
                  </ul>
                </div>
              )}

              {selectedPlatform === 'google' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-2">⚠️ Importante</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Configure OAuth 2.0 corretamente</li>
                    <li>• Ative a Google Ads API no projeto</li>
                    <li>• Customer ID deve estar ativo</li>
                    <li>• Refresh Token é essencial para automação</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}