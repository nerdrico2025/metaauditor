import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eye, CheckCircle, AlertTriangle, BarChart3, Palette, Sparkles, ChevronRight, Shield, TrendingUp, MousePointer, XCircle, ArrowRight, Target, Loader2, FileText, PenLine, Image, Type, RefreshCw, Play, LayoutGrid, ChevronLeft, Video, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { CreativeImage } from "./CreativeImage";

interface Creative {
  id: string;
  name: string;
  type?: string;
  creativeFormat?: 'image' | 'video' | 'carousel' | null;
  text?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  carouselImages?: string[] | null;
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

// Individual carousel image analysis type
interface CarouselImageAnalysis {
  imageIndex: number;
  textContent: string;
  colorsFound: string[];
  hasLogo: boolean;
  logoPosition: string | null;
  compliance: {
    logoCompliance: boolean;
    colorCompliance: boolean;
    issues: string[];
  };
  visualDescription: string;
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
        carouselImageAnalysis?: CarouselImageAnalysis[];
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
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [policyChoice, setPolicyChoice] = useState<'same' | 'different'>('same');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  // Get carousel images array
  const carouselImages = creative.carouselImages || [];
  const isCarousel = creative.creativeFormat === 'carousel' && carouselImages.length > 1;
  const isVideo = creative.creativeFormat === 'video';
  
  // Navigate carousel
  const nextImage = () => {
    if (carouselIndex < carouselImages.length - 1) {
      setCarouselIndex(carouselIndex + 1);
    }
  };
  
  const prevImage = () => {
    if (carouselIndex > 0) {
      setCarouselIndex(carouselIndex - 1);
    }
  };

  // Fetch audit data for this creative
  const { data: audits, isLoading: auditsLoading } = useQuery<ExtendedAudit[]>({
    queryKey: [`/api/creatives/${creative.id}/audits`],
  });
  
  // Fetch available policies
  const { data: policies } = useQuery<Policy[]>({
    queryKey: ['/api/policies'],
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
    mutationFn: async (policyId?: string | null) => {
      const body = policyId ? { policyId } : undefined;
      const response = await apiRequest("POST", `/api/creatives/${creative.id}/analyze`, body);
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
    analyzeMutation.mutate(undefined);
  };

  // Opens the policy choice dialog before reanalyzing
  const handleReanalyze = () => {
    // Initialize with the current audit's policy
    setPolicyChoice('same');
    setSelectedPolicyId(viewingAudit?.policyId || null);
    setShowPolicyDialog(true);
  };

  // Confirms and executes the reanalysis with chosen policy
  const handleConfirmReanalyze = async () => {
    setShowPolicyDialog(false);
    setIsReanalyzing(true);
    
    const policyIdToUse = policyChoice === 'same' 
      ? viewingAudit?.policyId 
      : selectedPolicyId;
    
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

      // Create new analysis with the chosen policy
      analyzeMutation.mutate(policyIdToUse);
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
      analyzeMutation.mutate(undefined);
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
                  {/* Format Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={isVideo ? "default" : isCarousel ? "secondary" : "outline"} className={`text-xs ${
                      isVideo ? 'bg-purple-500 text-white' : isCarousel ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {isVideo ? (
                        <><Play className="h-3 w-3 mr-1" />Vídeo</>
                      ) : isCarousel ? (
                        <><LayoutGrid className="h-3 w-3 mr-1" />Carrossel ({carouselImages.length} imagens)</>
                      ) : (
                        <><Image className="h-3 w-3 mr-1" />Imagem</>
                      )}
                    </Badge>
                  </div>
                  
                  {/* Image/Video/Carousel Display */}
                  <div className="relative">
                    {isCarousel ? (
                      <div className="cursor-pointer" onClick={() => setImageZoomed(true)}>
                        <img 
                          src={carouselImages[carouselIndex]} 
                          alt={`${creative.name} - imagem ${carouselIndex + 1}`}
                          className="w-full h-auto rounded-lg hover:opacity-90 transition-opacity"
                        />
                        {/* Carousel Navigation */}
                        <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                          <button 
                            onClick={(e) => { e.stopPropagation(); prevImage(); }}
                            disabled={carouselIndex === 0}
                            className={`pointer-events-auto ml-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors ${
                              carouselIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); nextImage(); }}
                            disabled={carouselIndex === carouselImages.length - 1}
                            className={`pointer-events-auto mr-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors ${
                              carouselIndex === carouselImages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                        {/* Carousel Indicators */}
                        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5">
                          {carouselImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setCarouselIndex(idx); }}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                idx === carouselIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/70'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : isVideo && creative.videoUrl ? (
                      <video 
                        src={creative.videoUrl}
                        controls
                        className="w-full h-auto rounded-lg"
                        poster={creative.imageUrl && creative.imageUrl !== 'VIDEO_NO_THUMBNAIL' ? creative.imageUrl : undefined}
                      >
                        Seu navegador não suporta a reprodução de vídeo.
                      </video>
                    ) : (
                      <div className="cursor-pointer" onClick={() => setImageZoomed(true)}>
                        <CreativeImage 
                          creative={creative}
                          className="w-full h-auto rounded-lg hover:opacity-90 transition-opacity"
                          size="large"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Carousel Thumbnails */}
                  {isCarousel && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {carouselImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCarouselIndex(idx)}
                          className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                            idx === carouselIndex ? 'border-primary' : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <img 
                            src={img} 
                            alt={`Miniatura ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
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

          {/* Video Analysis Warning */}
          {isVideo && (
            <Alert className="mt-4 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800">
              <Video className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-700 dark:text-purple-300">
                <strong>Análise de vídeo:</strong> Atualmente a análise visual com IA está disponível apenas para imagens e textos. 
                A análise de vídeos será implementada em breve.
              </AlertDescription>
            </Alert>
          )}

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
                    {/* ANÁLISE DA IMAGEM */}
                    {viewingAudit.aiAnalysis?.compliance && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-md flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Image className="h-4 w-4" />
                          Análise da Imagem
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

                        {/* Palavras Obrigatórias na Imagem */}
                        {viewingAudit.aiAnalysis.compliance.analysis?.keywordAnalysis && (
                          (() => {
                            const allFound = viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsFound || [];
                            const imageKeywords = allFound.filter((item: any) => {
                              const source = typeof item === 'string' ? null : item.source;
                              return source === 'imagem' || source === 'ambos';
                            });
                            
                            if (imageKeywords.length === 0) return null;
                            
                            return (
                              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-semibold">Palavras Obrigatórias</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {imageKeywords.map((item: any, idx: number) => {
                                    const keyword = typeof item === 'string' ? item : item.keyword;
                                    return (
                                      <Badge key={idx} variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        {keyword}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Palavras Proibidas na Imagem */}
                        {viewingAudit.aiAnalysis.compliance.analysis?.keywordAnalysis && (
                          (() => {
                            const allProhibited = viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.prohibitedKeywordsFound || [];
                            const imageProhibited = allProhibited.filter((item: any) => {
                              const source = typeof item === 'string' ? null : item.source;
                              return source === 'imagem' || source === 'ambos';
                            });
                            
                            const noneFound = imageProhibited.length === 0;
                            
                            return (
                              <div className={`p-3 rounded-lg border ${noneFound ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {noneFound ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  )}
                                  <span className="text-sm font-semibold">Palavras Proibidas</span>
                                </div>
                                {noneFound ? (
                                  <p className="text-xs text-green-600">Nenhuma palavra proibida encontrada na imagem</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {imageProhibited.map((item: any, idx: number) => {
                                      const keyword = typeof item === 'string' ? item : item.keyword;
                                      return (
                                        <Badge key={idx} variant="destructive" className="text-[10px] flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          {keyword}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}

                        {/* ANÁLISE INDIVIDUAL DE CADA IMAGEM DO CARROSSEL */}
                        {isCarousel && viewingAudit.aiAnalysis.compliance.analysis?.carouselImageAnalysis && 
                         viewingAudit.aiAnalysis.compliance.analysis.carouselImageAnalysis.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <h5 className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-3">
                              <LayoutGrid className="h-4 w-4" />
                              Análise Individual por Imagem ({viewingAudit.aiAnalysis.compliance.analysis.carouselImageAnalysis.length} imagens)
                            </h5>
                            <div className="space-y-3">
                              {viewingAudit.aiAnalysis.compliance.analysis.carouselImageAnalysis.map((imgAnalysis, idx) => (
                                <div key={idx} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                      Imagem {imgAnalysis.imageIndex || idx + 1}
                                    </span>
                                    <div className="flex gap-1">
                                      <Badge 
                                        variant={imgAnalysis.compliance?.logoCompliance ? 'default' : 'destructive'}
                                        className="text-[10px]"
                                      >
                                        {imgAnalysis.compliance?.logoCompliance ? '✓ Logo' : '✗ Logo'}
                                      </Badge>
                                      <Badge 
                                        variant={imgAnalysis.compliance?.colorCompliance ? 'default' : 'destructive'}
                                        className="text-[10px]"
                                      >
                                        {imgAnalysis.compliance?.colorCompliance ? '✓ Cores' : '✗ Cores'}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {imgAnalysis.visualDescription && (
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-2">
                                      {imgAnalysis.visualDescription}
                                    </p>
                                  )}
                                  
                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    {imgAnalysis.textContent && (
                                      <div>
                                        <span className="font-semibold text-slate-500">Texto:</span>
                                        <span className="ml-1 text-slate-700 dark:text-slate-300">{imgAnalysis.textContent}</span>
                                      </div>
                                    )}
                                    {imgAnalysis.hasLogo && imgAnalysis.logoPosition && (
                                      <div>
                                        <span className="font-semibold text-slate-500">Logo:</span>
                                        <span className="ml-1 text-slate-700 dark:text-slate-300">{imgAnalysis.logoPosition}</span>
                                      </div>
                                    )}
                                    {imgAnalysis.colorsFound && imgAnalysis.colorsFound.length > 0 && (
                                      <div className="col-span-2 flex items-center gap-1">
                                        <span className="font-semibold text-slate-500">Cores:</span>
                                        {imgAnalysis.colorsFound.slice(0, 5).map((color, colorIdx) => (
                                          <div 
                                            key={colorIdx} 
                                            className="w-4 h-4 rounded border border-slate-300" 
                                            style={{ backgroundColor: color }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {imgAnalysis.compliance?.issues && imgAnalysis.compliance.issues.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                      <span className="text-[10px] font-semibold text-red-600">Problemas:</span>
                                      <ul className="text-[10px] text-red-600 list-disc list-inside">
                                        {imgAnalysis.compliance.issues.map((issue, issueIdx) => (
                                          <li key={issueIdx}>{issue}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ANÁLISE DO TEXTO */}
                    {viewingAudit.aiAnalysis?.compliance && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-md flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <FileText className="h-4 w-4" />
                          Análise do Texto
                        </h4>
                        
                        {/* Palavras Obrigatórias no Texto */}
                        {viewingAudit.aiAnalysis.compliance.analysis?.keywordAnalysis && (
                          (() => {
                            const allFound = viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsFound || [];
                            const missing = viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.requiredKeywordsMissing || [];
                            const textKeywords = allFound.filter((item: any) => {
                              const source = typeof item === 'string' ? null : item.source;
                              return source === 'texto' || source === 'ambos';
                            });
                            
                            const hasAny = textKeywords.length > 0 || missing.length > 0;
                            const allCompliant = missing.length === 0 && textKeywords.length > 0;
                            
                            if (!hasAny) return null;
                            
                            return (
                              <div className={`p-3 rounded-lg border ${allCompliant ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {allCompliant ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-sm font-semibold">Palavras Obrigatórias</span>
                                </div>
                                <div className="space-y-2">
                                  {textKeywords.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase mb-1">
                                        Encontradas
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {textKeywords.map((item: any, idx: number) => {
                                          const keyword = typeof item === 'string' ? item : item.keyword;
                                          return (
                                            <Badge key={idx} variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
                                              <CheckCircle className="h-3 w-3" />
                                              {keyword}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {missing.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase mb-1">
                                        Ausentes
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {missing.map((keyword: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-300">
                                            ✗ {keyword}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Palavras Proibidas no Texto */}
                        {viewingAudit.aiAnalysis.compliance.analysis?.keywordAnalysis && (
                          (() => {
                            const allProhibited = viewingAudit.aiAnalysis.compliance.analysis.keywordAnalysis.prohibitedKeywordsFound || [];
                            const textProhibited = allProhibited.filter((item: any) => {
                              const source = typeof item === 'string' ? null : item.source;
                              return source === 'texto' || source === 'ambos';
                            });
                            
                            const noneFound = textProhibited.length === 0;
                            
                            return (
                              <div className={`p-3 rounded-lg border ${noneFound ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {noneFound ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  )}
                                  <span className="text-sm font-semibold">Palavras Proibidas</span>
                                </div>
                                {noneFound ? (
                                  <p className="text-xs text-green-600">Nenhuma palavra proibida encontrada no texto</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {textProhibited.map((item: any, idx: number) => {
                                      const keyword = typeof item === 'string' ? item : item.keyword;
                                      return (
                                        <Badge key={idx} variant="destructive" className="text-[10px] flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          {keyword}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}

                        {/* Copywriting Analysis */}
                        {viewingAudit.aiAnalysis.compliance.analysis?.copywritingAnalysis && (
                          <div className="p-3 rounded-lg border bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <PenLine className="h-4 w-4 text-indigo-600" />
                                <span className="text-sm font-semibold">Análise de Copywriting</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] bg-indigo-100 text-indigo-800 border-indigo-300">
                                Score: {viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.score}/100
                              </Badge>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div>
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300">Clareza</p>
                                <p className="text-gray-600 dark:text-gray-400">{viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.clarity}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300">Persuasão</p>
                                <p className="text-gray-600 dark:text-gray-400">{viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.persuasion}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300">Call to Action</p>
                                <p className="text-gray-600 dark:text-gray-400">{viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.callToAction}</p>
                              </div>
                              {viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.suggestions?.length > 0 && (
                                <div>
                                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">Sugestões de Melhoria</p>
                                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                                    {viewingAudit.aiAnalysis.compliance.analysis.copywritingAnalysis.suggestions.map((suggestion: string, idx: number) => (
                                      <li key={idx}>{suggestion}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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

      {/* Policy Choice Dialog for Reanalysis */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Refazer Análise
            </DialogTitle>
            <DialogDescription>
              Escolha qual política usar para a nova análise do criativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup 
              value={policyChoice} 
              onValueChange={(value: string) => setPolicyChoice(value as 'same' | 'different')}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="same" id="same-policy" className="mt-0.5" />
                <Label htmlFor="same-policy" className="cursor-pointer flex-1">
                  <p className="font-medium text-slate-900">Manter mesma política</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {policy?.name || 'Política padrão'}
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="different" id="different-policy" className="mt-0.5" />
                <Label htmlFor="different-policy" className="cursor-pointer flex-1">
                  <p className="font-medium text-slate-900">Usar política diferente</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Selecione outra política de análise
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {policyChoice === 'different' && (
              <div className="space-y-2 pt-2">
                <Label>Selecionar política</Label>
                <Select 
                  value={selectedPolicyId || ''} 
                  onValueChange={setSelectedPolicyId}
                >
                  <SelectTrigger data-testid="select-policy">
                    <SelectValue placeholder="Escolha uma política..." />
                  </SelectTrigger>
                  <SelectContent>
                    {policies?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.id === viewingAudit?.policyId && '(atual)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPolicyDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmReanalyze}
              disabled={policyChoice === 'different' && !selectedPolicyId}
              className="bg-primary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refazer Análise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}