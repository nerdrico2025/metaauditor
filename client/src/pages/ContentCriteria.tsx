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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Edit2, Trash2, AlertCircle, CheckCircle, X } from "lucide-react";
import type { ContentCriteria } from "@shared/schema";

const contentCriteriaSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  requiredKeywords: z.array(z.string()).default([]),
  prohibitedKeywords: z.array(z.string()).default([]),
  requiredPhrases: z.array(z.string()).default([]),
  prohibitedPhrases: z.array(z.string()).default([]),
  minTextLength: z.number().min(0).optional(),
  maxTextLength: z.number().min(1).optional(),
  requiresLogo: z.boolean().default(false),
  requiresBrandColors: z.boolean().default(false),
});

type ContentCriteriaFormData = z.infer<typeof contentCriteriaSchema>;

export default function ContentCriteria() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCriteria, setSelectedCriteria] = useState<ContentCriteria | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados para listas de palavras/frases
  const [newRequiredKeyword, setNewRequiredKeyword] = useState("");
  const [newProhibitedKeyword, setNewProhibitedKeyword] = useState("");
  const [newRequiredPhrase, setNewRequiredPhrase] = useState("");
  const [newProhibitedPhrase, setNewProhibitedPhrase] = useState("");

  const form = useForm<ContentCriteriaFormData>({
    resolver: zodResolver(contentCriteriaSchema),
    defaultValues: {
      name: "",
      description: "",
      requiredKeywords: [],
      prohibitedKeywords: [],
      requiredPhrases: [],
      prohibitedPhrases: [],
      minTextLength: undefined,
      maxTextLength: undefined,
      requiresLogo: false,
      requiresBrandColors: false,
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

  const { data: contentCriteria, isLoading: criteriaLoading, error } = useQuery<ContentCriteria[]>({
    queryKey: ["/api/content-criteria"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContentCriteriaFormData) => {
      const response = await apiRequest("POST", "/api/content-criteria", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Critério de conteúdo criado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-criteria"] });
      setIsEditing(false);
      form.reset();
      clearKeywordInputs();
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
        description: "Falha ao criar critério de conteúdo",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContentCriteriaFormData & { id: string }) => {
      const response = await apiRequest("PUT", `/api/content-criteria/${data.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Critério de conteúdo atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-criteria"] });
      setIsEditing(false);
      setSelectedCriteria(null);
      form.reset();
      clearKeywordInputs();
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
        description: "Falha ao atualizar critério de conteúdo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/content-criteria/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Critério de conteúdo excluído com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-criteria"] });
      setSelectedCriteria(null);
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
        description: "Falha ao excluir critério de conteúdo",
        variant: "destructive",
      });
    },
  });

  const clearKeywordInputs = () => {
    setNewRequiredKeyword("");
    setNewProhibitedKeyword("");
    setNewRequiredPhrase("");
    setNewProhibitedPhrase("");
  };

  const handleEdit = (criteria: ContentCriteria) => {
    setSelectedCriteria(criteria);
    setIsEditing(true);
    form.reset({
      name: criteria.name,
      description: criteria.description || "",
      requiredKeywords: Array.isArray(criteria.requiredKeywords) ? criteria.requiredKeywords as string[] : [],
      prohibitedKeywords: Array.isArray(criteria.prohibitedKeywords) ? criteria.prohibitedKeywords as string[] : [],
      requiredPhrases: Array.isArray(criteria.requiredPhrases) ? criteria.requiredPhrases as string[] : [],
      prohibitedPhrases: Array.isArray(criteria.prohibitedPhrases) ? criteria.prohibitedPhrases as string[] : [],
      minTextLength: criteria.minTextLength || undefined,
      maxTextLength: criteria.maxTextLength || undefined,
      requiresLogo: criteria.requiresLogo || false,
      requiresBrandColors: criteria.requiresBrandColors || false,
    });
  };

  const addKeyword = (type: 'required' | 'prohibited', value: string, isPhrase: boolean = false) => {
    if (!value.trim()) return;
    
    const fieldName = isPhrase 
      ? (type === 'required' ? 'requiredPhrases' : 'prohibitedPhrases')
      : (type === 'required' ? 'requiredKeywords' : 'prohibitedKeywords');
    
    const currentValues = form.getValues(fieldName) as string[];
    form.setValue(fieldName, [...currentValues, value.trim()]);
    
    // Clear input
    if (isPhrase) {
      if (type === 'required') setNewRequiredPhrase("");
      else setNewProhibitedPhrase("");
    } else {
      if (type === 'required') setNewRequiredKeyword("");
      else setNewProhibitedKeyword("");
    }
  };

  const removeKeyword = (type: 'required' | 'prohibited', index: number, isPhrase: boolean = false) => {
    const fieldName = isPhrase 
      ? (type === 'required' ? 'requiredPhrases' : 'prohibitedPhrases')
      : (type === 'required' ? 'requiredKeywords' : 'prohibitedKeywords');
    
    const currentValues = form.getValues(fieldName) as string[];
    form.setValue(fieldName, currentValues.filter((_, i) => i !== index));
  };

  const onSubmit = (data: ContentCriteriaFormData) => {
    if (selectedCriteria) {
      updateMutation.mutate({ ...data, id: selectedCriteria.id });
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
        <Header title="Critérios de Conteúdo" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Critérios de Conteúdo</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Configure regras para validação de textos, palavras-chave e requisitos visuais
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setIsEditing(true);
                    setSelectedCriteria(null);
                    form.reset();
                    clearKeywordInputs();
                  }}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-new-criteria"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Critério
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                {isEditing && (
                  <Card className="border-slate-200" data-testid="card-criteria-form">
                    <CardHeader>
                      <CardTitle className="flex items-center text-slate-900">
                        <FileText className="h-5 w-5 mr-2" />
                        {selectedCriteria ? 'Editar Critério' : 'Novo Critério'}
                      </CardTitle>
                      <CardDescription>
                        {selectedCriteria ? 'Modifique' : 'Defina'} as regras de validação de conteúdo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div>
                          <Label htmlFor="name">Nome do Critério</Label>
                          <Input
                            id="name"
                            {...form.register("name")}
                            placeholder="Ex: Validação de Posts Facebook"
                            data-testid="input-criteria-name"
                          />
                          {form.formState.errors.name && (
                            <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Textarea
                            id="description"
                            {...form.register("description")}
                            placeholder="Descreva quando usar este critério..."
                            data-testid="textarea-criteria-description"
                          />
                        </div>

                        <Separator />

                        {/* Palavras-chave Obrigatórias */}
                        <div>
                          <Label>Palavras-chave Obrigatórias</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={newRequiredKeyword}
                              onChange={(e) => setNewRequiredKeyword(e.target.value)}
                              placeholder="Adicionar palavra obrigatória"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addKeyword('required', newRequiredKeyword);
                                }
                              }}
                              data-testid="input-required-keyword"
                            />
                            <Button
                              type="button"
                              onClick={() => addKeyword('required', newRequiredKeyword)}
                              data-testid="button-add-required-keyword"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {form.watch("requiredKeywords")?.map((keyword, index) => (
                              <Badge key={index} variant="default" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {keyword}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => removeKeyword('required', index)}
                                  data-testid={`button-remove-required-keyword-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Palavras-chave Proibidas */}
                        <div>
                          <Label>Palavras-chave Proibidas</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={newProhibitedKeyword}
                              onChange={(e) => setNewProhibitedKeyword(e.target.value)}
                              placeholder="Adicionar palavra proibida"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addKeyword('prohibited', newProhibitedKeyword);
                                }
                              }}
                              data-testid="input-prohibited-keyword"
                            />
                            <Button
                              type="button"
                              onClick={() => addKeyword('prohibited', newProhibitedKeyword)}
                              data-testid="button-add-prohibited-keyword"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {form.watch("prohibitedKeywords")?.map((keyword, index) => (
                              <Badge key={index} variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {keyword}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => removeKeyword('prohibited', index)}
                                  data-testid={`button-remove-prohibited-keyword-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Frases Obrigatórias */}
                        <div>
                          <Label>Frases Obrigatórias</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={newRequiredPhrase}
                              onChange={(e) => setNewRequiredPhrase(e.target.value)}
                              placeholder="Adicionar frase obrigatória"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addKeyword('required', newRequiredPhrase, true);
                                }
                              }}
                              data-testid="input-required-phrase"
                            />
                            <Button
                              type="button"
                              onClick={() => addKeyword('required', newRequiredPhrase, true)}
                              data-testid="button-add-required-phrase"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {form.watch("requiredPhrases")?.map((phrase, index) => (
                              <Badge key={index} variant="default" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {phrase}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => removeKeyword('required', index, true)}
                                  data-testid={`button-remove-required-phrase-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Frases Proibidas */}
                        <div>
                          <Label>Frases Proibidas</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={newProhibitedPhrase}
                              onChange={(e) => setNewProhibitedPhrase(e.target.value)}
                              placeholder="Adicionar frase proibida"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addKeyword('prohibited', newProhibitedPhrase, true);
                                }
                              }}
                              data-testid="input-prohibited-phrase"
                            />
                            <Button
                              type="button"
                              onClick={() => addKeyword('prohibited', newProhibitedPhrase, true)}
                              data-testid="button-add-prohibited-phrase"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {form.watch("prohibitedPhrases")?.map((phrase, index) => (
                              <Badge key={index} variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {phrase}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => removeKeyword('prohibited', index, true)}
                                  data-testid={`button-remove-prohibited-phrase-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Configurações de Texto */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="minTextLength">Tamanho Mínimo do Texto</Label>
                            <Input
                              id="minTextLength"
                              type="number"
                              min="0"
                              {...form.register("minTextLength", { valueAsNumber: true })}
                              placeholder="Ex: 10"
                              data-testid="input-min-text-length"
                            />
                          </div>
                          <div>
                            <Label htmlFor="maxTextLength">Tamanho Máximo do Texto</Label>
                            <Input
                              id="maxTextLength"
                              type="number"
                              min="1"
                              {...form.register("maxTextLength", { valueAsNumber: true })}
                              placeholder="Ex: 280"
                              data-testid="input-max-text-length"
                            />
                          </div>
                        </div>

                        {/* Requisitos Visuais */}
                        <div className="space-y-4">
                          <Label>Requisitos Visuais</Label>
                          
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="requiresLogo"
                              checked={form.watch("requiresLogo")}
                              onCheckedChange={(checked) => form.setValue("requiresLogo", checked)}
                              data-testid="switch-requires-logo"
                            />
                            <Label htmlFor="requiresLogo">Exigir Logomarca</Label>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="requiresBrandColors"
                              checked={form.watch("requiresBrandColors")}
                              onCheckedChange={(checked) => form.setValue("requiresBrandColors", checked)}
                              data-testid="switch-requires-brand-colors"
                            />
                            <Label htmlFor="requiresBrandColors">Exigir Cores da Marca</Label>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setIsEditing(false);
                              setSelectedCriteria(null);
                              form.reset();
                              clearKeywordInputs();
                            }}
                            data-testid="button-cancel-criteria"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createMutation.isPending || updateMutation.isPending}
                            data-testid="button-save-criteria"
                          >
                            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 
                             selectedCriteria ? 'Atualizar' : 'Criar'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* List */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">Critérios Existentes</h2>
                  
                  {criteriaLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i} className="border-slate-200">
                          <CardContent className="p-4">
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-3" />
                            <div className="flex gap-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-16" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : contentCriteria && contentCriteria.length > 0 ? (
                    <div className="space-y-3">
                      {contentCriteria.map((criteria) => (
                        <Card key={criteria.id} className="border-slate-200 hover:shadow-md transition-shadow" data-testid={`card-criteria-${criteria.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-slate-900">{criteria.name}</h3>
                                  {criteria.isActive && (
                                    <Badge variant="default">Ativo</Badge>
                                  )}
                                </div>
                                
                                {criteria.description && (
                                  <p className="text-sm text-slate-600 mb-3">
                                    {criteria.description}
                                  </p>
                                )}

                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  {/* Palavras obrigatórias */}
                                  {criteria.requiredKeywords && Array.isArray(criteria.requiredKeywords) && (criteria.requiredKeywords as string[]).length > 0 && (
                                    <div>
                                      <Label className="text-xs font-medium text-green-700">Palavras Obrigatórias:</Label>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {(criteria.requiredKeywords as string[]).slice(0, 3).map((keyword, i) => (
                                          <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-800">
                                            {keyword}
                                          </Badge>
                                        ))}
                                        {(criteria.requiredKeywords as string[]).length > 3 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{(criteria.requiredKeywords as string[]).length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Palavras proibidas */}
                                  {criteria.prohibitedKeywords && Array.isArray(criteria.prohibitedKeywords) && (criteria.prohibitedKeywords as string[]).length > 0 && (
                                    <div>
                                      <Label className="text-xs font-medium text-red-700">Palavras Proibidas:</Label>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {(criteria.prohibitedKeywords as string[]).slice(0, 3).map((keyword, i) => (
                                          <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-800">
                                            {keyword}
                                          </Badge>
                                        ))}
                                        {(criteria.prohibitedKeywords as string[]).length > 3 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{(criteria.prohibitedKeywords as string[]).length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Configurações adicionais */}
                                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                  {criteria.minTextLength && (
                                    <span>Mín: {criteria.minTextLength} chars</span>
                                  )}
                                  {criteria.maxTextLength && (
                                    <span>Máx: {criteria.maxTextLength} chars</span>
                                  )}
                                  {criteria.requiresLogo && (
                                    <Badge variant="outline" className="text-xs">Logo obrigatório</Badge>
                                  )}
                                  {criteria.requiresBrandColors && (
                                    <Badge variant="outline" className="text-xs">Cores obrigatórias</Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex space-x-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(criteria)}
                                  data-testid={`button-edit-criteria-${criteria.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(criteria.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-criteria-${criteria.id}`}
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
                        <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-2">
                          Nenhum critério de conteúdo
                        </h3>
                        <p className="text-slate-600 mb-4">
                          Configure critérios para validação de textos e conteúdo
                        </p>
                        <Button 
                          onClick={() => {
                            setIsEditing(true);
                            setSelectedCriteria(null);
                            form.reset();
                            clearKeywordInputs();
                          }}
                          data-testid="button-create-first-criteria"
                        >
                          Criar Primeiro Critério
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