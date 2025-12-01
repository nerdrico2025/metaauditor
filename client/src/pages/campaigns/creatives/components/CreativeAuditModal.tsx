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
import { Eye, CheckCircle, AlertTriangle, BarChart3, Image as ImageIcon, Palette, Sparkles, ChevronRight, Shield, TrendingUp, MousePointer, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CreativeImage } from "./CreativeImage";
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
    compliance?: {
      analysis?: {
        logoCompliance?: boolean;
        colorCompliance?: boolean;
        textCompliance?: boolean;
        brandGuidelines?: boolean;
      };
    };
    performance?: {
      metrics?: {
        ctrAnalysis?: string;
        conversionAnalysis?: string;
        costEfficiency?: string;
      };
      performance?: 'high' | 'medium' | 'low';
    };
  };
  complianceScore?: number;
  performanceScore?: number;
  status?: 'conforme' | 'parcialmente_conforme' | 'não_conforme';
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
  const [viewingAudit, setViewingAudit] = useState<ExtendedAudit | null>(null); // State to hold the latest audit

  // Fetch audit data for this creative
  const { data: audits, isLoading: auditsLoading } = useQuery<ExtendedAudit[]>({
    queryKey: [`/api/creatives/${creative.id}/audits`],
  });

  // Update viewingAudit when audits data changes
  useEffect(() => {
    if (audits && audits.length > 0) {
      setViewingAudit(audits[0]);
    }
  }, [audits]);

  // Fetch campaign name if campaignId exists
  const { data: campaign } = useQuery<any>({
    queryKey: [`/api/campaigns/${creative.campaignId}`],
    enabled: !!creative.campaignId,
  });

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
      setViewingAudit(newAudit); // Update viewingAudit state
      // Invalidate all related queries to update the UI
      queryClient.invalidateQueries({ queryKey: [`/api/creatives/${creative.id}/audits`] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
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
      if (!viewingAudit) throw new Error("No audit found");

      const promises = selectedActions.map(action => 
        apiRequest("POST", "/api/audit-actions", {
          auditId: viewingAudit.id,
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
      if (!viewingAudit) throw new Error("No audit found");

      const response = await apiRequest("DELETE", `/api/audits/${viewingAudit.id}`);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate audits query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/creatives", creative.id, "audits"] });
      setViewingAudit(null); // Clear viewingAudit state after deletion
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
    if (!viewingAudit) return;

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
    if (autoAnalyze && !viewingAudit && !analyzeMutation.isPending && !auditsLoading) {
      analyzeMutation.mutate();
    }
  }, [autoAnalyze, viewingAudit, analyzeMutation, auditsLoading]);

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
            <div>
              <DialogTitle className="text-lg font-medium text-slate-900">
                {creative.name}
              </DialogTitle>
              {campaign && (
                <p className="mt-1 text-sm text-slate-500">
                  Campanha: {campaign.name}
                </p>
              )}
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
                    {viewingAudit && (
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
                      disabled={analyzeMutation.isPending || !!viewingAudit}
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
                ) : viewingAudit ? (
                  <div className="space-y-6">
                    {/* KPIs Principais - Destaque Máximo */}
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-xl p-6 border-2 border-primary/20">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center">
                        📊 Principais Indicadores de Performance
                      </h3>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-lg border-2 border-primary/30 hover:border-primary/60 transition-colors">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 mb-4">
                            <Shield className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                            Conformidade de Marca
                          </p>
                          <p className="text-6xl font-extrabold text-primary mb-3 leading-none">
                            {viewingAudit.complianceScore}
                            <span className="text-3xl">%</span>
                          </p>
                          <Badge className="text-sm px-4 py-1.5 font-semibold" variant={viewingAudit.complianceScore >= 80 ? 'default' : 'destructive'}>
                            {viewingAudit.complianceScore >= 80 ? '✓ Aprovado' : '✗ Reprovado'}
                          </Badge>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-lg border-2 border-primary/30 hover:border-primary/60 transition-colors">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 mb-4">
                            <TrendingUp className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                            Performance
                          </p>
                          <p className="text-6xl font-extrabold text-primary mb-3 leading-none">
                            {viewingAudit.performanceScore}
                            <span className="text-3xl">%</span>
                          </p>
                          <Badge className="text-sm px-4 py-1.5 font-semibold" variant={viewingAudit.performanceScore >= 60 ? 'default' : 'destructive'}>
                            {viewingAudit.performanceScore >= 80 ? '🔥 Alta' : viewingAudit.performanceScore >= 60 ? '📈 Média' : '📉 Baixa'}
                          </Badge>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-lg border-2 border-primary/30 hover:border-primary/60 transition-colors">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 mb-4">
                            <CheckCircle className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                            Status Geral
                          </p>
                          <div className="h-24 flex items-center justify-center">
                            <Badge className="text-lg px-6 py-3 font-bold" variant={viewingAudit.status === 'conforme' ? 'default' : 'destructive'}>
                              {viewingAudit.status === 'conforme' ? '✓ Conforme' :
                               viewingAudit.status === 'parcialmente_conforme' ? '⚠ Parcial' :
                               '✗ Não Conforme'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento da IA - Accordion Expansível */}
                    {(viewingAudit.aiAnalysis?.compliance || viewingAudit.aiAnalysis?.performance) && (
                      <Card>
                        <CardContent className="pt-6">
                          <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer list-none">
                              <h3 className="font-bold text-lg flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Detalhamento da Análise IA
                              </h3>
                              <ChevronRight className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-90" />
                            </summary>

                            <div className="mt-6 space-y-6">
                              {/* Compliance Details */}
                              {viewingAudit.aiAnalysis?.compliance && (
                                <div>
                                  <h4 className="font-semibold text-md mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <Palette className="h-4 w-4" />
                                    Conformidade de Marca
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      {viewingAudit.aiAnalysis.compliance.analysis?.logoCompliance ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span className="text-sm">Logo da Marca</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      {viewingAudit.aiAnalysis.compliance.analysis?.colorCompliance ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span className="text-sm">Cores da Marca</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      {viewingAudit.aiAnalysis.compliance.analysis?.textCompliance ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span className="text-sm">Texto e Palavras-chave</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      {viewingAudit.aiAnalysis.compliance.analysis?.brandGuidelines ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span className="text-sm">Diretrizes da Marca</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Performance Metrics */}
                              {viewingAudit.aiAnalysis?.performance && (
                                <div>
                                  <h4 className="font-semibold text-md mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <BarChart3 className="h-4 w-4" />
                                    Métricas de Performance
                                  </h4>
                                  <div className="space-y-3">
                                    {viewingAudit.aiAnalysis.performance.metrics?.ctrAnalysis && (
                                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                        <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                                          <MousePointer className="h-4 w-4" />
                                          CTR (Click-Through Rate)
                                        </p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                          {viewingAudit.aiAnalysis.performance.metrics.ctrAnalysis}
                                        </p>
                                      </div>
                                    )}
                                    {viewingAudit.aiAnalysis.performance.metrics?.conversionAnalysis && (
                                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                        <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4" />
                                          Conversões
                                        </p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                          {viewingAudit.aiAnalysis.performance.metrics.conversionAnalysis}
                                        </p>
                                      </div>
                                    )}
                                    {viewingAudit.aiAnalysis.performance.metrics?.costEfficiency && (
                                      <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                        <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                                          <BarChart3 className="h-4 w-4" />
                                          Custo e Eficiência
                                        </p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                          {viewingAudit.aiAnalysis.performance.metrics.costEfficiency}
                                        </p>
                                      </div>
                                    )}
                                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                      <p className="font-semibold text-sm mb-1">Classificação de Performance</p>
                                      <Badge variant={
                                        viewingAudit.aiAnalysis.performance.performance === 'high' ? 'default' :
                                        viewingAudit.aiAnalysis.performance.performance === 'medium' ? 'secondary' :
                                        'destructive'
                                      }>
                                        {viewingAudit.aiAnalysis.performance.performance === 'high' ? 'Alta Performance' :
                                         viewingAudit.aiAnalysis.performance.performance === 'medium' ? 'Performance Média' :
                                         'Baixa Performance'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        </CardContent>
                      </Card>
                    )}
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
              {viewingAudit && viewingAudit.recommendations && Array.isArray(viewingAudit.recommendations) && viewingAudit.recommendations.length > 0 && (
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
            {viewingAudit && (
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
          <DialogContent className="max-w-6xl max-h-[90vh] p-2" hideCloseButton={false}>
            <div className="bg-black rounded-lg overflow-hidden">
              <CreativeImage 
                creative={creative}
                className="w-full h-auto max-h-[85vh] object-contain"
                size="large"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}