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
import { Eye, CheckCircle, AlertTriangle, BarChart3, Palette, Sparkles, ChevronRight, Shield, TrendingUp, MousePointer, XCircle, ArrowRight, Target, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CreativeImage } from "./CreativeImage";

interface Creative {
  id: string;
  name: string;
  type?: string;
  text?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  campaignId?: string;
  adSetId?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: string;
  cpc?: string;
  companyId?: string;
}

interface Policy {
  id: string;
  name: string;
  ctrMin?: number | null;
  ctrTarget?: number | null;
  cpcMax?: number | null;
  cpcTarget?: number | null;
  conversionsMin?: number | null;
  conversionsTarget?: number | null;
  companyId?: string;
}

interface Audit {
  id: string;
  creativeId: string;
  policyId?: string | null;
  complianceScore?: number | null;
  performanceScore?: number | null;
  status?: string | null;
  issues?: unknown;
  recommendations?: unknown;
  aiAnalysis?: unknown;
}

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
  const [viewingAudit, setViewingAudit] = useState<ExtendedAudit | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

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

  // Fetch policy used in the audit for comparison
  const { data: policy } = useQuery<Policy>({
    queryKey: [`/api/policies/${viewingAudit?.policyId}`],
    enabled: !!viewingAudit?.policyId,
  });

  // Create audit analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/creatives/${creative.id}/analyze`);
      return response;
    },
    onSuccess: (newAudit) => {
      setIsReanalyzing(false);
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
      setIsReanalyzing(false);
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
      return await apiRequest("DELETE", `/api/audits/${viewingAudit.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/creatives/${creative.id}/audits`] });
      setViewingAudit(null);
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
    setIsReanalyzing(true);
    
    try {
      // Try to delete existing audit if it exists
      if (viewingAudit) {
        try {
          await deleteAuditMutation.mutateAsync();
        } catch (deleteError: any) {
          // If 404, audit already deleted - proceed with new analysis
          if (!deleteError?.status || deleteError.status !== 404) {
            console.error("Error deleting audit:", deleteError);
          }
        }
      }
      
      // Clear local state
      setViewingAudit(null);

      // Create new analysis
      analyzeMutation.mutate();
    } catch (error) {
      setIsReanalyzing(false);
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

          {/* Loading State during Re-analysis */}
          {isReanalyzing ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-slate-900">Analisando criativo...</p>
              <p className="text-sm text-slate-500">A IA está processando a imagem e verificando conformidade</p>
            </div>
          ) : (
          <>
          <div className="space-y-6">
            {/* LINHA 1: Imagem + Métricas | Texto do Anúncio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna 1: Imagem e Métricas */}
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

                {/* Métricas do Criativo */}
                <div className="grid grid-cols-2 gap-3">
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

              {/* Coluna 2: Texto do Anúncio */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4 h-fit">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Texto do Anúncio
                </h4>
                
                {creative.headline ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Título</p>
                    <p className="text-sm font-medium text-slate-900">{creative.headline}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Título</p>
                    <p className="text-sm text-slate-400 italic">Não disponível</p>
                  </div>
                )}
                
                {creative.text ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Texto Principal</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{creative.text}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Texto Principal</p>
                    <p className="text-sm text-slate-400 italic">Não disponível</p>
                  </div>
                )}
                
                {creative.description ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Descrição</p>
                    <p className="text-sm text-slate-600">{creative.description}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Descrição</p>
                    <p className="text-sm text-slate-400 italic">Não disponível</p>
                  </div>
                )}
                
                {creative.callToAction ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Chamada para Ação</p>
                    <Badge variant="outline" className="text-xs">{creative.callToAction}</Badge>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Chamada para Ação</p>
                    <p className="text-sm text-slate-400 italic">Não disponível</p>
                  </div>
                )}
              </div>
            </div>

            {/* LINHA 2: Resultados da Auditoria */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Resultados da Auditoria
                </h3>
                {policy && (
                  <Badge variant="outline" className="text-xs">
                    Política: {policy.name}
                  </Badge>
                )}
              </div>
              
              {auditsLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : viewingAudit ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna 1: Principais Indicadores (formato linha) */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-xl p-4 border-2 border-primary/20">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Principais Indicadores
                    </h4>
                    <div className="space-y-2">
                      {/* Conformidade */}
                      <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border border-primary/20">
                        <div className="text-left flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Conformidade</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {viewingAudit.complianceScore ?? 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="text-xs" variant={(viewingAudit.complianceScore ?? 0) >= 80 ? 'default' : 'destructive'}>
                            {(viewingAudit.complianceScore ?? 0) >= 80 ? 'Aprovado' : 'Reprovado'}
                          </Badge>
                        </div>
                      </div>

                      {/* Performance */}
                      <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border border-primary/20">
                        <div className="text-left flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {viewingAudit.performanceScore ?? 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="text-xs" variant={(viewingAudit.performanceScore ?? 0) >= 60 ? 'default' : 'destructive'}>
                            {(viewingAudit.performanceScore ?? 0) >= 80 ? 'Alta' : (viewingAudit.performanceScore ?? 0) >= 60 ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border border-primary/20">
                        <div className="text-left flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</p>
                        </div>
                        <div className="text-center col-span-2 flex justify-end">
                          <Badge className="text-xs" variant={viewingAudit.status === 'conforme' ? 'default' : 'destructive'}>
                            {viewingAudit.status === 'conforme' ? 'Conforme' :
                             viewingAudit.status === 'parcialmente_conforme' ? 'Parcial' :
                             'Não Conforme'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Comparação Encontrado vs Política */}
                  {policy ? (
                    <div className="bg-amber-50/50 dark:bg-amber-950/30 rounded-xl p-4 border-2 border-amber-200 dark:border-amber-800">
                      <h4 className="font-bold text-base flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300">
                        <Target className="h-5 w-5" />
                        Comparação: Encontrado vs Política
                      </h4>
                      
                      <div className="space-y-2">
                        {/* CTR Comparison */}
                        <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-left">
                            <p className="text-[10px] font-medium text-gray-500">CTR</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {creative.ctr || '0'}%
                            </p>
                          </div>
                          <div className="text-center flex justify-center">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-medium text-gray-500">
                              Meta: {policy.ctrMin ? `≥${policy.ctrMin}%` : 'N/D'}
                            </p>
                            <Badge 
                              variant={
                                policy.ctrMin && parseFloat(creative.ctr || '0') >= policy.ctrMin 
                                  ? 'default' 
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {policy.ctrMin && parseFloat(creative.ctr || '0') >= policy.ctrMin 
                                ? '✓ Atingiu' 
                                : '✗ Abaixo'}
                            </Badge>
                          </div>
                        </div>

                        {/* CPC Comparison */}
                        <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-left">
                            <p className="text-[10px] font-medium text-gray-500">CPC</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              R$ {creative.cpc || '0'}
                            </p>
                          </div>
                          <div className="text-center flex justify-center">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-medium text-gray-500">
                              Meta: {policy.cpcMax ? `≤R$${policy.cpcMax}` : 'N/D'}
                            </p>
                            <Badge 
                              variant={
                                policy.cpcMax && parseFloat(creative.cpc || '999') <= policy.cpcMax 
                                  ? 'default' 
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {policy.cpcMax && parseFloat(creative.cpc || '999') <= policy.cpcMax 
                                ? '✓ Dentro' 
                                : '✗ Acima'}
                            </Badge>
                          </div>
                        </div>

                        {/* Conversions Comparison */}
                        <div className="grid grid-cols-3 gap-2 items-center p-2 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-left">
                            <p className="text-[10px] font-medium text-gray-500">Conversões</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {creative.conversions || 0}
                            </p>
                          </div>
                          <div className="text-center flex justify-center">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-medium text-gray-500">
                              Meta: {policy.conversionsMin ? `≥${policy.conversionsMin}` : 'N/D'}
                            </p>
                            <Badge 
                              variant={
                                policy.conversionsMin && (creative.conversions || 0) >= policy.conversionsMin 
                                  ? 'default' 
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {policy.conversionsMin && (creative.conversions || 0) >= policy.conversionsMin 
                                ? '✓ Atingiu' 
                                : '✗ Abaixo'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg p-6 flex items-center justify-center">
                      <p className="text-sm text-slate-500">Nenhuma política associada</p>
                    </div>
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
          </div>

          {/* Detalhamento da IA - Full Width Row */}
          {viewingAudit && (viewingAudit.aiAnalysis?.compliance || viewingAudit.aiAnalysis?.performance) && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <details className="group" open>
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Detalhamento da Análise IA
                    </h3>
                    <ChevronRight className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-90" />
                  </summary>

                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Compliance Details */}
                    {viewingAudit.aiAnalysis?.compliance && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-md flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Palette className="h-4 w-4" />
                          Conformidade de Marca
                        </h4>
                        
                        {/* Logo da Marca */}
                        <div className={`p-3 rounded-lg border ${viewingAudit.aiAnalysis.compliance.analysis?.logoCompliance ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {viewingAudit.aiAnalysis.compliance.analysis?.logoCompliance ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm font-semibold">Logo da Marca</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {viewingAudit.aiAnalysis.compliance.analysis?.logoJustification || 
                              (viewingAudit.aiAnalysis.compliance.analysis?.logoCompliance 
                                ? 'Logo identificado conforme a política.' 
                                : 'Logo não identificado ou não conforme.')}
                          </p>
                        </div>

                        {/* Cores da Marca */}
                        <div className={`p-3 rounded-lg border ${viewingAudit.aiAnalysis.compliance.analysis?.colorCompliance ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {viewingAudit.aiAnalysis.compliance.analysis?.colorCompliance ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm font-semibold">Cores da Marca</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {viewingAudit.aiAnalysis.compliance.analysis?.colorJustification || 
                              (viewingAudit.aiAnalysis.compliance.analysis?.colorCompliance 
                                ? 'Cores da marca identificadas corretamente.' 
                                : 'Cores não correspondem à paleta da marca.')}
                          </p>
                        </div>

                        {/* Texto e Palavras-chave - Separado */}
                        <div className={`p-3 rounded-lg border ${viewingAudit.aiAnalysis.compliance.analysis?.textCompliance ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {viewingAudit.aiAnalysis.compliance.analysis?.textCompliance ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm font-semibold">Texto e Palavras-chave</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            {viewingAudit.aiAnalysis.compliance.analysis?.textJustification || 'Análise de texto realizada.'}
                          </p>
                          
                          {/* Detalhamento de Palavras-chave */}
                          {viewingAudit.aiAnalysis.compliance.analysis?.keywordAnalysis && (
                            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              {/* Palavras Obrigatórias Encontradas */}
                              {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsFound?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase mb-1">
                                    Palavras Obrigatórias Encontradas
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsFound.map((keyword: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300">
                                        ✓ {keyword}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Palavras Obrigatórias Ausentes */}
                              {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsMissing?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase mb-1">
                                    Palavras Obrigatórias Ausentes
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsMissing.map((keyword: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-300">
                                        ✗ {keyword}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Palavras Proibidas Encontradas */}
                              {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.prohibitedKeywordsFound?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase mb-1">
                                    Palavras Proibidas Encontradas
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.prohibitedKeywordsFound.map((keyword: string, idx: number) => (
                                      <Badge key={idx} variant="destructive" className="text-[10px]">
                                        ⚠ {keyword}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Nenhuma palavra proibida */}
                              {viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.prohibitedKeywordsFound?.length === 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                    Palavras Proibidas
                                  </p>
                                  <p className="text-[10px] text-green-600">Nenhuma palavra proibida encontrada</p>
                                </div>
                              )}
                            </div>
                          )}
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
          </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {viewingAudit && (
              <Button 
                onClick={handleReanalyze}
                disabled={analyzeMutation.isPending || deleteAuditMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {(analyzeMutation.isPending || deleteAuditMutation.isPending) ? 'Reprocessando...' : 'Refazer Análise'}
              </Button>
            )}
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