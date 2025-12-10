import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Palette, Upload, Edit2, Trash2, Plus, Image } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { BrandConfiguration } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

const brandConfigSchema = z.object({
  brandName: z.string().min(1, "Nome da marca é obrigatório"),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor primária deve estar no formato #RRGGBB").optional().or(z.literal("")),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor secundária deve estar no formato #RRGGBB").optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor de destaque deve estar no formato #RRGGBB").optional().or(z.literal("")),
  fontFamily: z.string().optional(),
  brandGuidelines: z.string().optional(),
  logoUrl: z.string().optional(),
});

type BrandConfigFormData = z.infer<typeof brandConfigSchema>;

export default function BrandSettings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedConfig, setSelectedConfig] = useState<BrandConfiguration | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<BrandConfigFormData>({
    resolver: zodResolver(brandConfigSchema),
    defaultValues: {
      brandName: "",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      fontFamily: "",
      brandGuidelines: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: brandConfigurations, isLoading: configurationsLoading, error } = useQuery<BrandConfiguration[]>({
    queryKey: ["/api/brand-configurations"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: BrandConfigFormData) => {
      const response = await apiRequest("POST", "/api/brand-configurations", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configuração de marca criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brand-configurations"] });
      setIsEditing(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao criar configuração de marca",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: BrandConfigFormData & { id: string }) => {
      const response = await apiRequest("PUT", `/api/brand-configurations/${data.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configuração de marca atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brand-configurations"] });
      setIsEditing(false);
      setSelectedConfig(null);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao atualizar configuração de marca",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/brand-configurations/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configuração de marca excluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brand-configurations"] });
      setSelectedConfig(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao excluir configuração de marca",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (config: BrandConfiguration) => {
    setSelectedConfig(config);
    setIsEditing(true);
    form.reset({
      brandName: config.brandName,
      primaryColor: config.primaryColor || "",
      secondaryColor: config.secondaryColor || "",
      accentColor: config.accentColor || "",
      fontFamily: config.fontFamily || "",
      brandGuidelines: config.brandGuidelines || "",
      logoUrl: config.logoUrl || "",
    });
  };

  const handleLogoUpload = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {
        fileType: "image/png"
      });
      const data = await response.json();
      return {
        method: data.method as "PUT",
        url: data.url
      };
    } catch (error) {
      console.error("Error getting upload URL:", error);
      toast({
        title: "Erro",
        description: "Falha ao obter URL de upload",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (result: { successful: Array<{ uploadURL: string }> }) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const logoUrl = uploadedFile.uploadURL;
      
      if (logoUrl) {
        form.setValue("logoUrl", logoUrl);
        toast({
          title: "Sucesso",
          description: "Logo enviado com sucesso!",
        });
      }
    }
  };

  const onSubmit = (data: BrandConfigFormData) => {
    if (selectedConfig) {
      updateMutation.mutate({ ...data, id: selectedConfig.id });
    } else {
      createMutation.mutate(data);
    }
  };

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Configuração de Marca" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Configuração de Marca</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Configure logomarca, cores e diretrizes visuais da sua marca
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setIsEditing(true);
                    setSelectedConfig(null);
                    form.reset();
                  }}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-new-brand"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Configuração
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                {isEditing && (
                  <Card className="border-slate-200" data-testid="card-brand-form">
                    <CardHeader>
                      <CardTitle className="flex items-center text-slate-900">
                        <Palette className="h-5 w-5 mr-2" />
                        {selectedConfig ? 'Editar Configuração' : 'Nova Configuração'}
                      </CardTitle>
                      <CardDescription>
                        {selectedConfig ? 'Modifique' : 'Defina'} as características visuais da sua marca
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                          <Label htmlFor="brandName">Nome da Marca</Label>
                          <Input
                            id="brandName"
                            {...form.register("brandName")}
                            placeholder="Ex: Minha Empresa"
                            data-testid="input-brand-name"
                          />
                          {form.formState.errors.brandName && (
                            <p className="text-sm text-red-500 mt-1">{form.formState.errors.brandName.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="primaryColor">Cor Primária</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="primaryColor"
                                type="color"
                                {...form.register("primaryColor")}
                                className="w-12 h-10 p-1"
                                data-testid="input-primary-color"
                              />
                              <Input
                                {...form.register("primaryColor")}
                                placeholder="#FF0000"
                                className="flex-1"
                              />
                            </div>
                            {form.formState.errors.primaryColor && (
                              <p className="text-sm text-red-500 mt-1">{form.formState.errors.primaryColor.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <Label htmlFor="secondaryColor">Cor Secundária</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="secondaryColor"
                                type="color"
                                {...form.register("secondaryColor")}
                                className="w-12 h-10 p-1"
                                data-testid="input-secondary-color"
                              />
                              <Input
                                {...form.register("secondaryColor")}
                                placeholder="#00FF00"
                                className="flex-1"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="accentColor">Cor de Destaque</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="accentColor"
                                type="color"
                                {...form.register("accentColor")}
                                className="w-12 h-10 p-1"
                                data-testid="input-accent-color"
                              />
                              <Input
                                {...form.register("accentColor")}
                                placeholder="#0000FF"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="fontFamily">Fonte da Marca</Label>
                          <Input
                            id="fontFamily"
                            {...form.register("fontFamily")}
                            placeholder="Ex: Arial, Helvetica, sans-serif"
                            data-testid="input-font-family"
                          />
                        </div>

                        <div>
                          <Label htmlFor="logoUrl">URL do Logo</Label>
                          <div className="flex gap-2">
                            <Input
                              id="logoUrl"
                              {...form.register("logoUrl")}
                              placeholder="https://exemplo.com/logo.png"
                              className="flex-1"
                              data-testid="input-logo-url"
                            />
                            <ObjectUploader
                              maxNumberOfFiles={1}
                              maxFileSize={5242880} // 5MB
                              onGetUploadParameters={handleLogoUpload}
                              onComplete={handleUploadComplete}
                              buttonClassName="h-10 px-3"
                            >
                              <Upload className="h-4 w-4" />
                            </ObjectUploader>
                          </div>
                          {form.watch("logoUrl") && (
                            <div className="mt-2">
                              <img 
                                src={form.watch("logoUrl")} 
                                alt="Preview do logo" 
                                className="w-16 h-16 object-contain border border-slate-300 rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setIsEditing(false);
                              setSelectedConfig(null);
                              form.reset();
                            }}
                            data-testid="button-cancel-brand"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createMutation.isPending || updateMutation.isPending}
                            data-testid="button-save-brand"
                          >
                            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 
                             selectedConfig ? 'Atualizar' : 'Criar'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* List */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">Configurações Existentes</h2>
                  
                  {configurationsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i} className="border-slate-200">
                          <CardContent className="p-4">
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-3" />
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-16" />
                              <Skeleton className="h-8 w-16" />
                              <Skeleton className="h-8 w-16" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : brandConfigurations && brandConfigurations.length > 0 ? (
                    <div className="space-y-3">
                      {brandConfigurations.map((config) => (
                        <Card key={config.id} className="border-slate-200 hover:shadow-md transition-shadow" data-testid={`card-brand-${config.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {config.logoUrl && (
                                    <img 
                                      src={config.logoUrl} 
                                      alt={config.brandName}
                                      className="w-8 h-8 object-contain rounded"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <h3 className="font-semibold text-slate-900">{config.brandName}</h3>
                                  {config.isActive && (
                                    <Badge variant="default">Ativo</Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  {config.primaryColor && (
                                    <div className="flex items-center gap-1">
                                      <div 
                                        className="w-4 h-4 rounded border border-slate-300" 
                                        style={{ backgroundColor: config.primaryColor }}
                                      />
                                      <span className="text-xs text-slate-600">Primária</span>
                                    </div>
                                  )}
                                  {config.secondaryColor && (
                                    <div className="flex items-center gap-1">
                                      <div 
                                        className="w-4 h-4 rounded border border-slate-300" 
                                        style={{ backgroundColor: config.secondaryColor }}
                                      />
                                      <span className="text-xs text-slate-600">Secundária</span>
                                    </div>
                                  )}
                                  {config.accentColor && (
                                    <div className="flex items-center gap-1">
                                      <div 
                                        className="w-4 h-4 rounded border border-slate-300" 
                                        style={{ backgroundColor: config.accentColor }}
                                      />
                                      <span className="text-xs text-slate-600">Destaque</span>
                                    </div>
                                  )}
                                </div>

                                {config.fontFamily && (
                                  <p className="text-xs text-slate-500" style={{ fontFamily: config.fontFamily }}>
                                    Fonte: {config.fontFamily}
                                  </p>
                                )}
                              </div>

                              <div className="flex space-x-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(config)}
                                  data-testid={`button-edit-brand-${config.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(config.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-brand-${config.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-slate-200">
                      <CardContent className="text-center py-8">
                        <Image className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-2">
                          Nenhuma configuração de marca
                        </h3>
                        <p className="text-slate-600 mb-4">
                          Configure sua marca para usar nas validações de conformidade
                        </p>
                        <Button 
                          onClick={() => {
                            setIsEditing(true);
                            setSelectedConfig(null);
                            form.reset();
                          }}
                          data-testid="button-create-first-brand"
                        >
                          Criar Primeira Configuração
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}