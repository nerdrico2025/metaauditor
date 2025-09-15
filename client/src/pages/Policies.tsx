import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChipsInput } from "@/components/ChipsInput";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Palette, Shield, Save, Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { SettingsDTO } from "@shared/schema";

// Brand Policies form schema (removed fontFamily as per requirements)
const brandPoliciesSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB").optional().or(z.literal("")),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB").optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB").optional().or(z.literal("")),
  visualGuidelines: z.string().optional().or(z.literal("")),
  autoApproval: z.boolean(),
  pauseOnViolation: z.boolean(),
  sendForReview: z.boolean(),
  autoFixMinor: z.boolean(),
});

// Validation Criteria form schema (simplified - removed character limits and required phrases)
const validationCriteriaSchema = z.object({
  requiredKeywords: z.array(z.string()),
  forbiddenTerms: z.array(z.string()),
  requireLogo: z.boolean(),
  requireBrandColors: z.boolean(),
});

type BrandPoliciesFormData = z.infer<typeof brandPoliciesSchema>;
type ValidationCriteriaFormData = z.infer<typeof validationCriteriaSchema>;

export default function Policies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("brand-policies");

  // Brand Policies form
  const brandForm = useForm<BrandPoliciesFormData>({
    resolver: zodResolver(brandPoliciesSchema),
    defaultValues: {
      logoUrl: "",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      visualGuidelines: "",
      autoApproval: false,
      pauseOnViolation: false,
      sendForReview: false,
      autoFixMinor: false,
    },
  });

  // Validation Criteria form (simplified - removed character limits and required phrases)
  const criteriaForm = useForm<ValidationCriteriaFormData>({
    resolver: zodResolver(validationCriteriaSchema),
    defaultValues: {
      requiredKeywords: [],
      forbiddenTerms: [],
      requireLogo: false,
      requireBrandColors: false,
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

  // Get policies settings
  const { data: settings, isLoading: settingsLoading, error } = useQuery<SettingsDTO>({
    queryKey: ["/api/policies/settings"],
    enabled: isAuthenticated,
  });

  // Load data into forms when settings are fetched
  useEffect(() => {
    if (settings) {
      // Load brand policies form (removed fontFamily)
      brandForm.reset({
        logoUrl: settings.brand.logoUrl || "",
        primaryColor: settings.brand.primaryColor || "",
        secondaryColor: settings.brand.secondaryColor || "",
        accentColor: settings.brand.accentColor || "",
        visualGuidelines: settings.brand.visualGuidelines || "",
        autoApproval: settings.brandPolicies.autoApproval,
        pauseOnViolation: settings.brandPolicies.autoActions.pauseOnViolation,
        sendForReview: settings.brandPolicies.autoActions.sendForReview,
        autoFixMinor: settings.brandPolicies.autoActions.autoFixMinor,
      });

      // Load validation criteria form (removed character limits and required phrases)
      criteriaForm.reset({
        requiredKeywords: settings.validationCriteria.requiredKeywords,
        forbiddenTerms: settings.validationCriteria.forbiddenTerms,
        requireLogo: settings.validationCriteria.brandRequirements.requireLogo,
        requireBrandColors: settings.validationCriteria.brandRequirements.requireBrandColors,
      });
    }
  }, [settings, brandForm, criteriaForm]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: SettingsDTO) => {
      const response = await apiRequest("PUT", "/api/policies/settings", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policies/settings"] });
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
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Handle logo upload
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
        brandForm.setValue("logoUrl", logoUrl);
        toast({
          title: "Sucesso",
          description: "Logo enviado com sucesso!",
        });
      }
    }
  };

  // Submit brand policies
  const onSubmitBrandPolicies = (data: BrandPoliciesFormData) => {
    if (!settings) return;

    const updatedSettings: SettingsDTO = {
      brand: {
        logoUrl: data.logoUrl || null,
        primaryColor: data.primaryColor || null,
        secondaryColor: data.secondaryColor || null,
        accentColor: data.accentColor || null,
        visualGuidelines: data.visualGuidelines || null,
      },
      brandPolicies: {
        autoApproval: data.autoApproval,
        autoActions: {
          pauseOnViolation: data.pauseOnViolation,
          sendForReview: data.sendForReview,
          autoFixMinor: data.autoFixMinor,
        },
      },
      validationCriteria: settings.validationCriteria, // Keep existing validation criteria
      performanceBenchmarks: settings.performanceBenchmarks || {
        ctrMin: null,
        ctrTarget: null,
        cpcMax: null,
        cpcTarget: null,
        conversionsMin: null,
        conversionsTarget: null,
      },
    };

    updateMutation.mutate(updatedSettings);
  };

  // Submit validation criteria
  const onSubmitValidationCriteria = (data: ValidationCriteriaFormData) => {
    if (!settings) return;

    const updatedSettings: SettingsDTO = {
      brand: settings.brand, // Keep existing brand settings
      brandPolicies: settings.brandPolicies, // Keep existing brand policies
      validationCriteria: {
        requiredKeywords: data.requiredKeywords,
        forbiddenTerms: data.forbiddenTerms,
        brandRequirements: {
          requireLogo: data.requireLogo,
          requireBrandColors: data.requireBrandColors,
        },
      },
      performanceBenchmarks: settings.performanceBenchmarks || {
        ctrMin: null,
        ctrTarget: null,
        cpcMax: null,
        cpcTarget: null,
        conversionsMin: null,
        conversionsTarget: null,
      },
    };

    updateMutation.mutate(updatedSettings);
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
        <Header title="Políticas de Validação" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900">Políticas de Validação</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Configure políticas de marca e critérios de validação para auditorias automáticas
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="settings-tabs">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="brand-policies" data-testid="tab-brand-policies">
                    <Palette className="w-4 h-4 mr-2" />
                    Políticas de Marca
                  </TabsTrigger>
                  <TabsTrigger value="validation-criteria" data-testid="tab-validation-criteria">
                    <Shield className="w-4 h-4 mr-2" />
                    Critérios de Validação
                  </TabsTrigger>
                </TabsList>

                {/* Brand Policies Tab */}
                <TabsContent value="brand-policies">
                  <Card data-testid="card-brand-policies">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Palette className="w-5 h-5 mr-2" />
                        Políticas de Marca
                      </CardTitle>
                      <CardDescription>
                        Configure identidade visual, cores, tipografia e ações automáticas da marca
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {settingsLoading ? (
                        <div className="space-y-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : (
                        <form onSubmit={brandForm.handleSubmit(onSubmitBrandPolicies)} className="space-y-6">
                          {/* Logo Section */}
                          <div>
                            <Label className="text-base font-medium">Logo da Marca</Label>
                            <div className="mt-2 flex gap-2">
                              <Input
                                {...brandForm.register("logoUrl")}
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
                            {brandForm.watch("logoUrl") && (
                              <div className="mt-2">
                                <img 
                                  src={brandForm.watch("logoUrl")} 
                                  alt="Preview do logo" 
                                  className="w-16 h-16 object-contain border border-slate-300 rounded"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            {brandForm.formState.errors.logoUrl && (
                              <p className="text-sm text-red-500 mt-1">{brandForm.formState.errors.logoUrl.message}</p>
                            )}
                          </div>

                          {/* Colors Section */}
                          <div>
                            <Label className="text-base font-medium">Paleta de Cores</Label>
                            <div className="mt-2 grid grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="primaryColor">Cor Primária</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    id="primaryColor"
                                    type="color"
                                    {...brandForm.register("primaryColor")}
                                    className="w-12 h-10 p-1"
                                    data-testid="input-primary-color"
                                  />
                                  <Input
                                    value={brandForm.watch("primaryColor") || ""}
                                    onChange={(e) => brandForm.setValue("primaryColor", e.target.value)}
                                    placeholder="#FF0000"
                                    className="flex-1"
                                    data-testid="input-primary-color-text"
                                  />
                                </div>
                                {brandForm.formState.errors.primaryColor && (
                                  <p className="text-sm text-red-500 mt-1">{brandForm.formState.errors.primaryColor.message}</p>
                                )}
                              </div>
                              
                              <div>
                                <Label htmlFor="secondaryColor">Cor Secundária</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    id="secondaryColor"
                                    type="color"
                                    {...brandForm.register("secondaryColor")}
                                    className="w-12 h-10 p-1"
                                    data-testid="input-secondary-color"
                                  />
                                  <Input
                                    value={brandForm.watch("secondaryColor") || ""}
                                    onChange={(e) => brandForm.setValue("secondaryColor", e.target.value)}
                                    placeholder="#00FF00"
                                    className="flex-1"
                                    data-testid="input-secondary-color-text"
                                  />
                                </div>
                                {brandForm.formState.errors.secondaryColor && (
                                  <p className="text-sm text-red-500 mt-1">{brandForm.formState.errors.secondaryColor.message}</p>
                                )}
                              </div>
                              
                              <div>
                                <Label htmlFor="accentColor">Cor de Destaque</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    id="accentColor"
                                    type="color"
                                    {...brandForm.register("accentColor")}
                                    className="w-12 h-10 p-1"
                                    data-testid="input-accent-color"
                                  />
                                  <Input
                                    value={brandForm.watch("accentColor") || ""}
                                    onChange={(e) => brandForm.setValue("accentColor", e.target.value)}
                                    placeholder="#0000FF"
                                    className="flex-1"
                                    data-testid="input-accent-color-text"
                                  />
                                </div>
                                {brandForm.formState.errors.accentColor && (
                                  <p className="text-sm text-red-500 mt-1">{brandForm.formState.errors.accentColor.message}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Typography */}
                          <div>
                            <Label htmlFor="fontFamily">Tipografia</Label>
                            <Select onValueChange={(value) => brandForm.setValue("fontFamily", value)}>
                              <SelectTrigger data-testid="select-font-family">
                                <SelectValue placeholder="Selecione a fonte da marca" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                                <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                                <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                                <SelectItem value="Roboto, sans-serif">Roboto</SelectItem>
                                <SelectItem value="Open Sans, sans-serif">Open Sans</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Visual Guidelines */}
                          <div>
                            <Label htmlFor="visualGuidelines">Diretrizes Visuais</Label>
                            <Textarea
                              id="visualGuidelines"
                              {...brandForm.register("visualGuidelines")}
                              placeholder="Descreva as diretrizes visuais da sua marca..."
                              className="min-h-24 mt-1"
                              data-testid="textarea-visual-guidelines"
                            />
                            <div className="text-xs text-slate-500 mt-1">
                              {brandForm.watch("visualGuidelines")?.length || 0} caracteres
                            </div>
                          </div>

                          <Separator />

                          {/* Auto Actions */}
                          <div>
                            <Label className="text-base font-medium">Ações Automáticas</Label>
                            <div className="mt-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="autoApproval">Aprovação Automática</Label>
                                  <p className="text-sm text-slate-600">Aprovar automaticamente criativos que atendem aos critérios</p>
                                </div>
                                <Switch 
                                  id="autoApproval"
                                  checked={brandForm.watch("autoApproval")}
                                  onCheckedChange={(checked) => brandForm.setValue("autoApproval", checked)}
                                  data-testid="switch-auto-approval"
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="pauseOnViolation">Pausar em Violações</Label>
                                  <p className="text-sm text-slate-600">Pausar criativos que violam políticas</p>
                                </div>
                                <Switch 
                                  id="pauseOnViolation"
                                  checked={brandForm.watch("pauseOnViolation")}
                                  onCheckedChange={(checked) => brandForm.setValue("pauseOnViolation", checked)}
                                  data-testid="switch-pause-on-violation"
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="sendForReview">Enviar para Revisão</Label>
                                  <p className="text-sm text-slate-600">Enviar criativos problemáticos para revisão manual</p>
                                </div>
                                <Switch 
                                  id="sendForReview"
                                  checked={brandForm.watch("sendForReview")}
                                  onCheckedChange={(checked) => brandForm.setValue("sendForReview", checked)}
                                  data-testid="switch-send-for-review"
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="autoFixMinor">Corrigir Automaticamente</Label>
                                  <p className="text-sm text-slate-600">Aplicar correções menores automaticamente</p>
                                </div>
                                <Switch 
                                  id="autoFixMinor"
                                  checked={brandForm.watch("autoFixMinor")}
                                  onCheckedChange={(checked) => brandForm.setValue("autoFixMinor", checked)}
                                  data-testid="switch-auto-fix-minor"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button 
                              type="submit" 
                              disabled={updateMutation.isPending}
                              data-testid="button-save-brand-policies"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {updateMutation.isPending ? "Salvando..." : "Salvar Políticas de Marca"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Validation Criteria Tab */}
                <TabsContent value="validation-criteria">
                  <Card data-testid="card-validation-criteria">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        Critérios de Validação
                      </CardTitle>
                      <CardDescription>
                        Configure regras de conformidade e validação de conteúdo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {settingsLoading ? (
                        <div className="space-y-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : (
                        <form onSubmit={criteriaForm.handleSubmit(onSubmitValidationCriteria)} className="space-y-6">
                          {/* Keywords and Terms */}
                          <div className="space-y-4">
                            <div>
                              <Label className="text-base font-medium">Palavras-chave Obrigatórias</Label>
                              <p className="text-sm text-slate-600 mb-2">
                                Palavras que devem estar presentes nos criativos
                              </p>
                              <ChipsInput
                                value={criteriaForm.watch("requiredKeywords")}
                                onChange={(keywords) => criteriaForm.setValue("requiredKeywords", keywords)}
                                placeholder="Digite uma palavra-chave e pressione Enter"
                                data-testid="chips-required-keywords"
                              />
                            </div>

                            <div>
                              <Label className="text-base font-medium">Termos Proibidos</Label>
                              <p className="text-sm text-slate-600 mb-2">
                                Palavras ou termos que não devem aparecer nos criativos
                              </p>
                              <ChipsInput
                                value={criteriaForm.watch("forbiddenTerms")}
                                onChange={(terms) => criteriaForm.setValue("forbiddenTerms", terms)}
                                placeholder="Digite um termo proibido e pressione Enter"
                                data-testid="chips-forbidden-terms"
                              />
                            </div>

                            <div>
                              <Label className="text-base font-medium">Frases Obrigatórias</Label>
                              <p className="text-sm text-slate-600 mb-2">
                                Frases específicas que devem aparecer nos criativos
                              </p>
                              <ChipsInput
                                value={criteriaForm.watch("requiredPhrases")}
                                onChange={(phrases) => criteriaForm.setValue("requiredPhrases", phrases)}
                                placeholder="Digite uma frase obrigatória e pressione Enter"
                                data-testid="chips-required-phrases"
                              />
                            </div>
                          </div>

                          <Separator />

                          {/* Character Limits */}
                          <div>
                            <Label className="text-base font-medium">Limites de Caracteres</Label>
                            <div className="mt-2 grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="charLimitsMin">Mínimo</Label>
                                <Input
                                  id="charLimitsMin"
                                  type="number"
                                  {...criteriaForm.register("charLimitsMin")}
                                  placeholder="Ex: 10"
                                  data-testid="input-char-limits-min"
                                />
                                {criteriaForm.formState.errors.charLimitsMin && (
                                  <p className="text-sm text-red-500 mt-1">{criteriaForm.formState.errors.charLimitsMin.message}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="charLimitsMax">Máximo</Label>
                                <Input
                                  id="charLimitsMax"
                                  type="number"
                                  {...criteriaForm.register("charLimitsMax")}
                                  placeholder="Ex: 280"
                                  data-testid="input-char-limits-max"
                                />
                                {criteriaForm.formState.errors.charLimitsMax && (
                                  <p className="text-sm text-red-500 mt-1">{criteriaForm.formState.errors.charLimitsMax.message}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* Brand Requirements */}
                          <div>
                            <Label className="text-base font-medium">Requisitos de Marca</Label>
                            <div className="mt-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="requireLogo">Exigir Logo</Label>
                                  <p className="text-sm text-slate-600">Criativos devem conter o logo da marca</p>
                                </div>
                                <Switch 
                                  id="requireLogo"
                                  checked={criteriaForm.watch("requireLogo")}
                                  onCheckedChange={(checked) => criteriaForm.setValue("requireLogo", checked)}
                                  data-testid="switch-require-logo"
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor="requireBrandColors">Exigir Cores da Marca</Label>
                                  <p className="text-sm text-slate-600">Criativos devem usar as cores da marca</p>
                                </div>
                                <Switch 
                                  id="requireBrandColors"
                                  checked={criteriaForm.watch("requireBrandColors")}
                                  onCheckedChange={(checked) => criteriaForm.setValue("requireBrandColors", checked)}
                                  data-testid="switch-require-brand-colors"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button 
                              type="submit" 
                              disabled={updateMutation.isPending}
                              data-testid="button-save-validation-criteria"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {updateMutation.isPending ? "Salvando..." : "Salvar Critérios de Validação"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}