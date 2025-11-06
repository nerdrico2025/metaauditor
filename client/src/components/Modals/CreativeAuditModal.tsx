import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Eye, CheckCircle, AlertTriangle, BarChart3, Image as ImageIcon } from "lucide-react";
import { CreativeImage } from "@/components/CreativeImage";
import type { Creative, Audit } from "@shared/schema";

// Interfaces for better typing of JSON fields
interface AuditIssue {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface AuditRecommendation {
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

interface AuditCheckItem {
  category: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  details?: string;
}

// Extended Audit type with properly typed JSON fields
interface ExtendedAudit extends Omit<Audit, 'issues' | 'recommendations' | 'aiAnalysis'> {
  issues?: AuditIssue[];
  recommendations?: AuditRecommendation[];
  aiAnalysis?: {
    checks: AuditCheckItem[];
    summary: string;
  };
}

interface CreativeAuditModalProps {
  creative: Creative;
  onClose: () => void;
  autoAnalyze?: boolean;
}

export default function CreativeAuditModal({ creative, onClose, autoAnalyze = false }: CreativeAuditModalProps) {
  const { toast } = useToast();
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [imageZoomed, setImageZoomed] = useState(false);

  // Fetch audit data for this creative
  const { data: audits, isLoading: auditsLoading } = useQuery<ExtendedAudit[]>({
    queryKey: [`/api/creatives/${creative.id}/audits`],
  });

  // Get the latest audit
  const latestAudit = audits && audits.length > 0 ? audits[0] : null;


  // Create audit analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/creatives/${creative.id}/analyze`);
      return response;
    },
    onSuccess: (newAudit) => {
      toast({
        title: "Análise Concluída",
        description: "Criativo analisado com sucesso",
      });
      // Update the audit data immediately with the fresh analysis result
      queryClient.setQueryData([`/api/creatives/${creative.id}/audits`], [newAudit]);
      queryClient.invalidateQueries({ queryKey: [`/api/creatives/${creative.id}/audits`] });
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
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        toast({
          title: "Criativo não encontrado",
          description: "Este criativo pode ter sido removido ou não está disponível para análise.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro na Análise",
          description: "Falha ao analisar criativo. Tente novamente.",
          variant: "destructive",
        });
      }
    },
  });

  // Execute actions mutation
  const executeActionsMutation = useMutation({
    mutationFn: async () => {
      if (!latestAudit) throw new Error("No audit found");
      
      const promises = selectedActions.map(action => 
        apiRequest("POST", "/api/audit-actions", {
          auditId: latestAudit.id,
          action,
        })
      );
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Ações Executadas",
        description: "Ações aplicadas com sucesso",
      });
      setSelectedActions([]);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
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
        title: "Erro nas Ações",
        description: "Falha ao executar ações",
        variant: "destructive",
      });
    },
  });

  // Delete audit mutation for reanalysis
  const deleteAuditMutation = useMutation({
    mutationFn: async () => {
      if (!latestAudit) throw new Error("No audit found");
      
      const response = await apiRequest("DELETE", `/api/audits/${latestAudit.id}`);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate audits query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/creatives", creative.id, "audits"] });
    },
    onError: (error) => {
      console.error("Error deleting audit:", error);
      toast({
        title: "Erro ao Deletar Análise",
        description: "Falha ao deletar análise anterior",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const handleReanalyze = async () => {
    if (!latestAudit) return;
    
    try {
      // First delete the existing audit
      await deleteAuditMutation.mutateAsync();
      
      // Then create a new analysis
      analyzeMutation.mutate();
      
      toast({
        title: "Reprocessando Análise",
        description: "Análise anterior removida. Iniciando nova análise...",
      });
    } catch (error) {
      console.error("Error during reanalysis:", error);
      toast({
        title: "Erro na Reprocessamento",
        description: "Falha ao refazer análise",
        variant: "destructive",
      });
    }
  };

  // Auto-analyze when modal opens if autoAnalyze is true
  useEffect(() => {
    if (autoAnalyze && !latestAudit && !analyzeMutation.isPending) {
      analyzeMutation.mutate();
    }
  }, [autoAnalyze, latestAudit, analyzeMutation]);

  const handleExecuteActions = () => {
    if (selectedActions.length === 0) {
      toast({
        title: "Nenhuma Ação Selecionada",
        description: "Selecione pelo menos uma ação para executar",
        variant: "destructive",
      });
      return;
    }
    executeActionsMutation.mutate();
  };

  const handleActionChange = (action: string, checked: boolean) => {
    if (checked) {
      setSelectedActions([...selectedActions, action]);
    } else {
      setSelectedActions(selectedActions.filter(a => a !== action));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'non_compliant':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'low_performance':
        return <BarChart3 className="h-5 w-5 text-amber-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'border-green-200 bg-green-50';
      case 'non_compliant':
        return 'border-red-200 bg-red-50';
      case 'low_performance':
        return 'border-amber-200 bg-amber-50';
      default:
        return 'border-slate-200 bg-slate-50';
    }
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-lg font-medium text-slate-900">
                  {creative.name}
                </DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {creative.campaignId ? `Campaign ID: ${creative.campaignId}` : 'Origem: Google Sheets'}
                </p>
                {(creative as any).campaignName && (
                  <p className="text-xs text-slate-400">
                    Campanha: {(creative as any).campaignName}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Creative Preview */}
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="relative cursor-pointer" onClick={() => setImageZoomed(true)}>
                  <CreativeImage 
                    creative={creative}
                    className="w-full h-auto rounded-lg hover:opacity-90 transition-opacity"
                    size="large"
                  />
                </div>
              </div>

              {/* Creative Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Impressões</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {creative.impressions?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">CTR</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {creative.ctr || '0'}%
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Cliques</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {creative.clicks || 0}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Conversões</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {creative.conversions || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Audit Results */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-900">Resultados da Auditoria</h4>
                  <div className="flex gap-2">
                    {latestAudit && (
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement report generation
                          toast({
                            title: "Relatório",
                            description: "Funcionalidade em desenvolvimento",
                          });
                        }}
                      >
                        Ver Relatório
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      onClick={handleAnalyze}
                      disabled={analyzeMutation.isPending || !!latestAudit}
                    >
                      {analyzeMutation.isPending ? 'Analisando...' : 'Analisar'}
                    </Button>
                  </div>
                </div>

                {auditsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : latestAudit ? (
                  <div className="space-y-4">
                    {/* Real Audit Scores */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-500">Score de Conformidade</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {latestAudit.complianceScore ? Number(latestAudit.complianceScore).toFixed(1) : '0.0'}/100
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-500">Score de Performance</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {latestAudit.performanceScore ? Number(latestAudit.performanceScore).toFixed(1) : '0.0'}/100
                        </p>
                      </div>
                    </div>

                    {/* Audit Status */}
                    <div className={`border rounded-lg p-3 ${getStatusColor(latestAudit.status)}`}>
                      <div className="flex items-start">
                        {getStatusIcon(latestAudit.status)}
                        <div className="ml-2">
                          <p className="text-sm font-medium text-slate-800">
                            {latestAudit.status === 'compliant' ? 'Criativo Conforme' : 
                             latestAudit.status === 'non_compliant' ? 'Não Conforme' : 
                             latestAudit.status === 'low_performance' ? 'Performance Baixa' : 'Status Desconhecido'}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            {latestAudit.aiAnalysis?.summary || 
                             (latestAudit.issues && Array.isArray(latestAudit.issues) && latestAudit.issues.length > 0 ? 
                              `${latestAudit.issues.length} problema(s) identificado(s)` : 
                              'Nenhum problema identificado na auditoria')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Audit Issues */}
                    {latestAudit.issues && Array.isArray(latestAudit.issues) && latestAudit.issues.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-slate-900">Problemas Identificados</h5>
                        {latestAudit.issues.map((issue, index) => (
                          <div key={index} className={`border rounded-lg p-3 ${getStatusColor(issue.severity || 'medium')}`}>
                            <div className="flex items-start">
                              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {issue.type || 'Problema Identificado'}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {issue.description || 'Descrição não disponível'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Audit Checklist */}
                    <div>
                      <h5 className="text-sm font-medium text-slate-900 mb-2">Verificações Realizadas</h5>
                      <div className="space-y-2">
                        {latestAudit.aiAnalysis && latestAudit.aiAnalysis.checks ? (
                          latestAudit.aiAnalysis.checks.map((check, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center">
                                {check.status === 'passed' ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                ) : check.status === 'warning' ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mr-2" />
                                )}
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{check.category}</p>
                                  <p className="text-xs text-slate-500">{check.description}</p>
                                </div>
                              </div>
                              <Badge variant={check.status === 'passed' ? 'default' : check.status === 'warning' ? 'secondary' : 'destructive'}>
                                {check.status === 'passed' ? 'OK' : check.status === 'warning' ? 'Atenção' : 'Erro'}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          // Default checklist if aiAnalysis doesn't have checks
                          <>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                <div>
                                  <p className="text-xs font-medium text-slate-700">Conformidade da marca</p>
                                  <p className="text-xs text-slate-500">Verificação de logo e cores da marca</p>
                                </div>
                              </div>
                              <Badge variant="default">OK</Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                <div>
                                  <p className="text-xs font-medium text-slate-700">Conteúdo textual</p>
                                  <p className="text-xs text-slate-500">Análise do texto e call-to-action</p>
                                </div>
                              </div>
                              <Badge variant="default">OK</Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                <div>
                                  <p className="text-xs font-medium text-slate-700">Performance</p>
                                  <p className="text-xs text-slate-500">Métricas de CTR e conversão</p>
                                </div>
                              </div>
                              <Badge variant="default">OK</Badge>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-slate-200 rounded-lg">
                    <Eye className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Nenhuma auditoria disponível</p>
                    <p className="text-xs text-slate-500">Clique em "Analisar" para auditar este criativo</p>
                  </div>
                )}
              </div>

              {/* Recommended Actions */}
              {latestAudit && latestAudit.recommendations && Array.isArray(latestAudit.recommendations) && latestAudit.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Ações Recomendadas</h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <Checkbox 
                        checked={selectedActions.includes('pause')}
                        onCheckedChange={(checked) => handleActionChange('pause', checked as boolean)}
                      />
                      <span className="ml-2 text-sm text-slate-700">Pausar criativo</span>
                    </label>
                    <label className="flex items-center">
                      <Checkbox 
                        checked={selectedActions.includes('flag_review')}
                        onCheckedChange={(checked) => handleActionChange('flag_review', checked as boolean)}
                      />
                      <span className="ml-2 text-sm text-slate-700">Marcar para revisão manual</span>
                    </label>
                    <label className="flex items-center">
                      <Checkbox 
                        checked={selectedActions.includes('request_correction')}
                        onCheckedChange={(checked) => handleActionChange('request_correction', checked as boolean)}
                      />
                      <span className="ml-2 text-sm text-slate-700">Solicitar correção</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row-reverse space-x-reverse space-x-3 pt-6 border-t border-slate-200">
            <Button 
              onClick={handleExecuteActions}
              disabled={executeActionsMutation.isPending || selectedActions.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {executeActionsMutation.isPending ? 'Executando...' : 'Executar Ações'}
            </Button>
            {latestAudit && (
              <Button 
                onClick={handleReanalyze}
                disabled={analyzeMutation.isPending}
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {analyzeMutation.isPending ? 'Reprocessando...' : 'Refazer Análise'}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Modal */}
      {imageZoomed && (
        <Dialog open={imageZoomed} onOpenChange={setImageZoomed}>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0">
            <div className="relative bg-black">
              <CreativeImage 
                creative={creative}
                className="w-full h-auto max-h-[90vh] object-contain"
                size="large"
              />
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-4 right-4"
                onClick={() => setImageZoomed(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
