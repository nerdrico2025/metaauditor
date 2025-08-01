import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import PolicyModal from "@/components/Modals/PolicyModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Plus, Edit2, Trash2, CheckCircle, BarChart3 } from "lucide-react";
import type { Policy } from "@shared/schema";

export default function Policies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const { data: policies, isLoading: policiesLoading, error } = useQuery<Policy[]>({
    queryKey: ["/api/policies"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (policyId: string) => {
      await apiRequest("DELETE", `/api/policies/${policyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Política excluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
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
        description: "Falha ao excluir política",
        variant: "destructive",
      });
    },
  });

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

  const handleCreatePolicy = () => {
    setSelectedPolicy(null);
    setIsModalOpen(true);
  };

  const handleEditPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsModalOpen(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    deleteMutation.mutate(policyId);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Políticas" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Políticas de Validação</h2>
                  <p className="text-slate-600">Gerencie critérios de conformidade e performance</p>
                </div>
                <Button onClick={handleCreatePolicy} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Política
                </Button>
              </div>

              {policiesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="border-slate-200">
                      <CardHeader>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <div className="flex justify-between">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : policies && policies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {policies.map((policy: Policy) => (
                    <Card key={policy.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-semibold text-slate-900">
                              {policy.name}
                            </CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                              {policy.description}
                            </p>
                          </div>
                          <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                            {policy.status === 'active' ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Policy Rules Preview */}
                          <div>
                            <h4 className="text-sm font-medium text-slate-900 mb-2">Regras de Conformidade</h4>
                            <div className="space-y-1">
                              {policy.rules && typeof policy.rules === 'object' && Object.keys(policy.rules).length > 0 ? (
                                Object.entries(policy.rules as Record<string, any>).slice(0, 3).map(([key, value]) => (
                                  <div key={key} className="flex items-center text-xs text-slate-600">
                                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                                    <span className="capitalize">{key.replace('_', ' ')}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-slate-500">Nenhuma regra configurada</div>
                              )}
                            </div>
                          </div>

                          {/* Performance Thresholds Preview */}
                          <div>
                            <h4 className="text-sm font-medium text-slate-900 mb-2">Critérios de Performance</h4>
                            <div className="space-y-1">
                              {policy.performanceThresholds && typeof policy.performanceThresholds === 'object' ? (
                                Object.entries(policy.performanceThresholds as Record<string, any>).slice(0, 3).map(([key, value]) => (
                                  <div key={key} className="flex items-center text-xs text-slate-600">
                                    <BarChart3 className="h-3 w-3 text-blue-500 mr-2" />
                                    <span className="capitalize">{key.replace('_', ' ')}: {value}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-slate-500">Nenhum critério configurado</div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                          <div className="text-xs text-slate-500">
                            {policy.isDefault && (
                              <Badge variant="outline" className="text-xs">Padrão</Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            Atualizada em {policy.updatedAt ? new Date(policy.updatedAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
                          </div>
                        </div>

                        <div className="flex space-x-2 mt-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleEditPolicy(policy)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Política</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a política "{policy.name}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePolicy(policy.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Nenhuma política encontrada
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Crie sua primeira política de validação para começar a auditar criativos.
                  </p>
                  <Button onClick={handleCreatePolicy} className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Política
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <PolicyModal
          policy={selectedPolicy}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
