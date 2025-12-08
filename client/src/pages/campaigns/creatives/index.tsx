import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Pagination } from "@/components/Pagination";
import { CreativeImage } from "./components/CreativeImage";
import CreativeAuditModal from "./components/CreativeAuditModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Search, 
  Eye, 
  X, 
  Image as ImageIcon,
  AlertCircle,
  Facebook,
  CheckCircle,
  XCircle,
  TrendingUp,
  MousePointer,
  BarChart3,
  ChevronRight,
  Sparkles,
  CheckSquare,
  Square,
  Shield,
  Palette,
  Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SiGoogle } from 'react-icons/si';
import { Link, useLocation } from "wouter";
import type { Creative, Campaign, Audit } from "@shared/schema";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  platform: string;
}

interface Policy {
  id: string;
  name: string;
  isDefault: boolean;
  scope: 'global' | 'campaign';
}

function CreativeAnalysisIndicator({ creativeId }: { creativeId: string }) {
  const { data: audits, isLoading } = useQuery<Audit[]>({
    queryKey: [`/api/creatives/${creativeId}/audits`],
  });

  if (isLoading) {
    return <Skeleton className="h-5 w-5 rounded-full mx-auto" />;
  }

  const hasAudit = audits && audits.length > 0;

  return (
    <div className="flex items-center justify-center" title={hasAudit ? "Criativo analisado" : "Não analisado"}>
      {hasAudit ? (
        <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
      ) : (
        <XCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
      )}
    </div>
  );
}

interface AnalyzeButtonProps {
  creativeId: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}

function AnalyzeButton({ creativeId, isAnalyzing, onAnalyze }: AnalyzeButtonProps) {
  const { data: audits, isLoading } = useQuery<Audit[]>({
    queryKey: [`/api/creatives/${creativeId}/audits`],
  });

  const hasAudit = audits && audits.length > 0;
  const label = isAnalyzing ? 'Analisando...' : (hasAudit ? 'Reanalisar' : 'Analisar');

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onAnalyze}
      disabled={isAnalyzing || isLoading}
      title={hasAudit ? "Refazer análise deste anúncio" : "Analisar este anúncio"}
      data-testid={`button-analyze-${creativeId}`}
      className="gap-1.5"
    >
      <Sparkles className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
      <span className="text-xs">{label}</span>
    </Button>
  );
}

export default function Creatives() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [location] = useLocation();
  
  // Parse URL params for initial filter values
  const getInitialFilters = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return {
        campaignId: params.get('campaignId') || 'all',
        adSetId: params.get('adSetId') || 'all',
      };
    }
    return { campaignId: 'all', adSetId: 'all' };
  };
  
  const initialFilters = getInitialFilters();
  
  const [selectedCreativeForModal, setSelectedCreativeForModal] = useState<Creative | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState(initialFilters.campaignId);
  const [adSetFilter, setAdSetFilter] = useState(initialFilters.adSetId);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);
  const [showPolicySelectionDialog, setShowPolicySelectionDialog] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [pendingAnalysisType, setPendingAnalysisType] = useState<'single' | 'selected' | 'all' | null>(null);
  const [pendingCreativeId, setPendingCreativeId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [analyzingCreativeId, setAnalyzingCreativeId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Batch analysis progress state
  const [batchAnalysisProgress, setBatchAnalysisProgress] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    currentCreativeName: string;
    successCount: number;
    failedCount: number;
    failedCreatives: { name: string; error: string }[];
  }>({
    isRunning: false,
    current: 0,
    total: 0,
    currentCreativeName: '',
    successCount: 0,
    failedCount: 0,
    failedCreatives: [],
  });

  // Update filters when URL changes (e.g., navigation from other pages)
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const campaignId = params.get('campaignId');
    const adSetId = params.get('adSetId');
    
    if (campaignId) {
      setCampaignFilter(campaignId);
    }
    if (adSetId) {
      setAdSetFilter(adSetId);
    }
  }, [location]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Não autenticado",
        description: "Redirecionando para login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: creativesResponse, isLoading: creativesLoading } = useQuery<{ creatives: Creative[], pagination: any }>({
    queryKey: ["/api/creatives?limit=10000"],
    enabled: isAuthenticated,
  });

  const creatives = creativesResponse?.creatives || [];

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const { data: adSets = [] } = useQuery<AdSet[]>({
    queryKey: ["/api/adsets"],
    enabled: isAuthenticated,
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['/api/policies'],
    enabled: isAuthenticated,
  });

  const analyzeCreativeMutation = useMutation({
    mutationFn: (creativeId: string) => {
      setAnalyzingCreativeId(creativeId);
      return apiRequest(`/api/creatives/${creativeId}/analyze`, { method: 'POST' });
    },
    onSuccess: (data, creativeId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      queryClient.invalidateQueries({ queryKey: [`/api/creatives/${creativeId}/audits`] });
      setAnalyzingCreativeId(null);
      toast({ 
        title: '✅ Análise concluída!',
        description: 'O criativo foi analisado com sucesso.',
      });
    },
    onError: (error: Error) => {
      setAnalyzingCreativeId(null);
      toast({
        title: 'Erro na análise',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Sequential batch analysis function with progress tracking
  const runBatchAnalysis = async (creativeIds: string[]) => {
    const creativesToAnalyze = creativeIds.map(id => {
      const creative = creatives.find(c => c.id === id);
      return { id, name: creative?.name || 'Criativo desconhecido' };
    });

    setBatchAnalysisProgress({
      isRunning: true,
      current: 0,
      total: creativesToAnalyze.length,
      currentCreativeName: '',
      successCount: 0,
      failedCount: 0,
      failedCreatives: [],
    });

    let successCount = 0;
    let failedCount = 0;
    const failedCreatives: { name: string; error: string }[] = [];

    for (let i = 0; i < creativesToAnalyze.length; i++) {
      const { id, name } = creativesToAnalyze[i];
      
      setBatchAnalysisProgress(prev => ({
        ...prev,
        current: i + 1,
        currentCreativeName: name,
      }));

      try {
        await apiRequest(`/api/creatives/${id}/analyze`, { method: 'POST' });
        successCount++;
        queryClient.invalidateQueries({ queryKey: [`/api/creatives/${id}/audits`] });
      } catch (error: any) {
        failedCount++;
        failedCreatives.push({ name, error: error.message || 'Erro desconhecido' });
      }

      setBatchAnalysisProgress(prev => ({
        ...prev,
        successCount,
        failedCount,
        failedCreatives,
      }));
    }

    // Final update
    setBatchAnalysisProgress(prev => ({
      ...prev,
      isRunning: false,
    }));

    queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
    setSelectedCreatives([]);

    toast({ 
      title: '✅ Análise em lote concluída!',
      description: `${successCount} anúncios analisados com sucesso.${failedCount > 0 ? ` ${failedCount} falharam.` : ''}`,
    });
  };

  // Keep mutation for backwards compatibility with isPending checks
  const analyzeBatchMutation = {
    isPending: batchAnalysisProgress.isRunning,
    mutate: runBatchAnalysis,
  };

  // Reset to page 1 when filters change - must be before early return
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, campaignFilter, adSetFilter, platformFilter]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return 'Campanha Desconhecida';
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Campanha Desconhecida';
  };

  const getAdSetName = (adSetId: string | null) => {
    if (!adSetId) return 'Grupo Desconhecido';
    const adSet = adSets.find(a => a.id === adSetId);
    return adSet?.name || 'Grupo Desconhecido';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Ativo':
        return 'default';
      case 'Não está em veiculação':
      case 'Campanha Desativada':
      case 'Grupo Desativado':
        return 'secondary';
      case 'Arquivado':
      case 'Excluído':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    // Status já vem traduzido do backend
    return status;
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'meta') return <Facebook className="h-5 w-5 text-blue-600" />;
    if (platform === 'google') return <SiGoogle className="h-5 w-5 text-red-600" />;
    return <ImageIcon className="h-5 w-5 text-gray-600" />;
  };

  const formatDate = (date: Date | null | string | undefined) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleSelectAll = () => {
    if (selectedCreatives.length === filteredCreatives.length) {
      setSelectedCreatives([]);
    } else {
      setSelectedCreatives(filteredCreatives.map(c => c.id));
    }
  };

  const toggleSelectCreative = (id: string) => {
    setSelectedCreatives(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const checkPolicyBeforeAnalysis = (type: 'single' | 'selected' | 'all', creativeId?: string) => {
    const hasDefaultPolicy = policies.some(p => p.isDefault && p.scope === 'global');
    
    if (!hasDefaultPolicy) {
      setPendingAnalysisType(type);
      setPendingCreativeId(creativeId || null);
      setShowPolicySelectionDialog(true);
      return false;
    }
    return true;
  };

  const handleAnalyzeSelected = () => {
    if (selectedCreatives.length === 0) {
      toast({
        title: 'Nenhum anúncio selecionado',
        description: 'Selecione pelo menos um anúncio para analisar.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!checkPolicyBeforeAnalysis('selected')) return;
    analyzeBatchMutation.mutate(selectedCreatives);
  };

  const handleAnalyzeAll = () => {
    const allIds = filteredCreatives.map(c => c.id);
    if (allIds.length === 0) {
      toast({
        title: 'Nenhum anúncio disponível',
        description: 'Não há anúncios para analisar.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!checkPolicyBeforeAnalysis('all')) return;
    analyzeBatchMutation.mutate(allIds);
  };

  const handleAnalyzeSingle = (creativeId: string) => {
    if (!checkPolicyBeforeAnalysis('single', creativeId)) return;
    analyzeCreativeMutation.mutate(creativeId);
  };

  const proceedWithSelectedPolicy = () => {
    if (!selectedPolicyId) {
      toast({
        title: 'Selecione uma política',
        description: 'Escolha uma política para continuar com a análise.',
        variant: 'destructive',
      });
      return;
    }

    setShowPolicySelectionDialog(false);
    
    if (pendingAnalysisType === 'single' && pendingCreativeId) {
      analyzeCreativeMutation.mutate(pendingCreativeId);
    } else if (pendingAnalysisType === 'selected') {
      analyzeBatchMutation.mutate(selectedCreatives);
    } else if (pendingAnalysisType === 'all') {
      const allIds = filteredCreatives.map(c => c.id);
      analyzeBatchMutation.mutate(allIds);
    }
    
    setPendingAnalysisType(null);
    setPendingCreativeId(null);
    setSelectedPolicyId(null);
  };

  const filteredCreatives = creatives.filter((creative) => {
    const matchesSearch = creative.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.externalId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || creative.status === statusFilter;
    const matchesCampaign = campaignFilter === "all" || creative.campaignId === campaignFilter;
    const matchesAdSet = adSetFilter === "all" || creative.adSetId === adSetFilter;
    const matchesPlatform = platformFilter === "all" || creative.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesCampaign && matchesAdSet && matchesPlatform;
  }).sort((a, b) => {
    // Active creatives first
    const aIsActive = a.status === 'Ativo' ? 0 : 1;
    const bIsActive = b.status === 'Ativo' ? 0 : 1;
    if (aIsActive !== bIsActive) return aIsActive - bIsActive;
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.ceil(filteredCreatives.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCreatives = filteredCreatives.slice(startIndex, startIndex + itemsPerPage);

  const metaCreatives = creatives.filter(c => c.platform === 'meta');
  const activeCreatives = filteredCreatives.filter(c => c.status === 'Ativo');
  const totalImpressions = filteredCreatives.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = filteredCreatives.reduce((sum, c) => sum + (c.clicks || 0), 0);

  const formatCTR = (ctr: number | string | null | undefined): string => {
    if (ctr === null || ctr === undefined) return '0';
    const numCtr = typeof ctr === 'string' ? parseFloat(ctr) : ctr;
    if (isNaN(numCtr)) return '0';
    return numCtr.toFixed(2);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Anúncios" />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="mb-6">
                <div className="mb-4">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Anúncios
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Gerencie os anúncios das suas campanhas Meta Ads e Google Ads
                  </p>
                </div>

                {selectedCreatives.length > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex-1 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {selectedCreatives.length} anúncio{selectedCreatives.length !== 1 ? 's' : ''} selecionado{selectedCreatives.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Button
                      onClick={handleAnalyzeSelected}
                      disabled={analyzeBatchMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-analyze-selected"
                    >
                      <Sparkles className={`h-4 w-4 mr-2 ${analyzeBatchMutation.isPending ? 'animate-spin' : ''}`} />
                      {analyzeBatchMutation.isPending ? 'Analisando...' : `Analisar ${selectedCreatives.length > 1 ? 'Selecionados' : 'Selecionado'}`}
                    </Button>
                    <Button
                      onClick={() => setSelectedCreatives([])}
                      variant="ghost"
                      size="sm"
                      data-testid="button-clear-selection"
                    >
                      Limpar seleção
                    </Button>
                  </div>
                )}

                {filteredCreatives.length > 0 && selectedCreatives.length === 0 && (
                  <Button
                    onClick={handleAnalyzeAll}
                    disabled={analyzeBatchMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-analyze-all"
                  >
                    <Sparkles className={`h-4 w-4 mr-2 ${analyzeBatchMutation.isPending ? 'animate-spin' : ''}`} />
                    {analyzeBatchMutation.isPending ? 'Analisando...' : `Analisar Todos (${filteredCreatives.length})`}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Anúncios</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-creatives">
                          {filteredCreatives.length}
                        </p>
                      </div>
                      <ImageIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Anúncios Meta Ads</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2" data-testid="stat-meta-creatives">
                          {metaCreatives.length}
                        </p>
                      </div>
                      <Facebook className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Impressões Totais</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-impressions">
                          {totalImpressions.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <TrendingUp className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cliques Totais</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-clicks">
                          {totalClicks.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <MousePointer className="h-10 w-10 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          placeholder="Buscar por nome ou ID..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-white dark:bg-gray-800"
                          data-testid="input-search-creatives"
                        />
                      </div>
                    </div>
                    
                    <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                      <SelectTrigger className="w-full lg:w-[220px] bg-white dark:bg-gray-800" data-testid="select-campaign-filter">
                        <SelectValue placeholder="Todas Campanhas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Campanhas</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={adSetFilter} onValueChange={setAdSetFilter}>
                      <SelectTrigger className="w-full lg:w-[220px] bg-white dark:bg-gray-800" data-testid="select-adset-filter">
                        <SelectValue placeholder="Todos Ad Sets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Grupos de Campanha</SelectItem>
                        {adSets.map((adSet) => (
                          <SelectItem key={adSet.id} value={adSet.id}>
                            {adSet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-platform-filter">
                        <SelectValue placeholder="Plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Plataformas</SelectItem>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-status-filter">
                        <SelectValue placeholder="Veiculação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Veiculações</SelectItem>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Não está em veiculação">Não está em veiculação</SelectItem>
                        <SelectItem value="Campanha Desativada">Campanha Desativada</SelectItem>
                        <SelectItem value="Grupo Desativado">Grupo Desativado</SelectItem>
                        <SelectItem value="Arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>

                    {(searchTerm || statusFilter !== "all" || campaignFilter !== "all" || adSetFilter !== "all" || platformFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setCampaignFilter("all");
                          setAdSetFilter("all");
                          setPlatformFilter("all");
                        }}
                        className="w-full lg:w-auto"
                        data-testid="button-clear-filters"
                      >
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-0">
                  {creativesLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : filteredCreatives.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {searchTerm || statusFilter !== "all" || campaignFilter !== "all" || adSetFilter !== "all" || platformFilter !== "all"
                          ? "Nenhum anúncio encontrado"
                          : "Nenhum anúncio sincronizado"
                        }
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {searchTerm || statusFilter !== "all" || campaignFilter !== "all" || adSetFilter !== "all" || platformFilter !== "all"
                          ? "Tente ajustar os filtros de busca."
                          : "Conecte suas contas Meta Ads ou Google Ads e clique em 'Sincronizar Tudo'."
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-900">
                            <TableHead className="w-[50px]">
                              <button
                                onClick={toggleSelectAll}
                                className="flex items-center justify-center w-5 h-5"
                                data-testid="checkbox-select-all"
                              >
                                {selectedCreatives.length === filteredCreatives.length && filteredCreatives.length > 0 ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-gray-400" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Nome do Anúncio</TableHead>
                            <TableHead>Campanha</TableHead>
                            <TableHead>Grupo de Anúncios</TableHead>
                            <TableHead>Veiculação</TableHead>
                            <TableHead className="text-right">Impressões</TableHead>
                            <TableHead className="text-right">Cliques</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-center">Analisado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCreatives.map((creative) => (
                            <TableRow 
                              key={creative.id} 
                              className="hover:bg-gray-50 dark:hover:bg-gray-900/50" 
                              data-testid={`row-creative-${creative.id}`}
                            >
                              <TableCell>
                                <button
                                  onClick={() => toggleSelectCreative(creative.id)}
                                  className="flex items-center justify-center w-5 h-5"
                                  data-testid={`checkbox-select-${creative.id}`}
                                >
                                  {selectedCreatives.includes(creative.id) ? (
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Square className="h-5 w-5 text-gray-400" />
                                  )}
                                </button>
                              </TableCell>
                              <TableCell>
                                <div onClick={() => setSelectedCreativeForModal(creative)} className="cursor-pointer">
                                  <CreativeImage 
                                    creative={creative}
                                    className="w-20 h-20 object-cover rounded-lg hover:opacity-80 transition-opacity border border-gray-200 dark:border-gray-700"
                                    size="small"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                {getPlatformIcon(creative.platform)}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white max-w-xs truncate">{creative.name}</div>
                                  {creative.headline && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500 max-w-xs truncate mt-1">
                                      {creative.headline}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">ID: {creative.externalId}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {getCampaignName(creative.campaignId)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {getAdSetName(creative.adSetId)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusBadgeVariant(creative.status)}>
                                  {getStatusLabel(creative.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-600 dark:text-gray-400">
                                {creative.impressions?.toLocaleString('pt-BR') || 0}
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-600 dark:text-gray-400">
                                {creative.clicks?.toLocaleString('pt-BR') || 0}
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-600 dark:text-gray-400">
                                {formatCTR(creative.ctr)}%
                              </TableCell>
                              <TableCell className="text-center">
                                <CreativeAnalysisIndicator creativeId={creative.id} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <AnalyzeButton
                                    creativeId={creative.id}
                                    isAnalyzing={analyzingCreativeId === creative.id}
                                    onAnalyze={() => handleAnalyzeSingle(creative.id)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedCreativeForModal(creative)}
                                    title="Ver detalhes do anúncio"
                                    data-testid={`button-view-creative-${creative.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredCreatives.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        itemName="anúncios"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>

      {/* Policy Selection Dialog */}
      <Dialog open={showPolicySelectionDialog} onOpenChange={setShowPolicySelectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Política para Análise</DialogTitle>
            <DialogDescription>
              Nenhuma política padrão definida. Por favor, selecione uma política para usar na análise dos anúncios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedPolicyId || ''} onValueChange={setSelectedPolicyId}>
              <SelectTrigger data-testid="select-policy">
                <SelectValue placeholder="Escolha uma política..." />
              </SelectTrigger>
              <SelectContent>
                {policies.filter(p => p.scope === 'global').map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.name} {policy.isDefault ? '(Padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPolicySelectionDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={proceedWithSelectedPolicy} data-testid="button-confirm-policy">
                Continuar com Análise
              </Button>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Dica: Você pode definir uma política padrão em{' '}
              <Link href="/policies" className="text-primary underline">Políticas</Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Creative Audit Modal - Unified modal for viewing creative details and audit */}
      {selectedCreativeForModal && (
        <CreativeAuditModal
          creative={selectedCreativeForModal}
          onClose={() => setSelectedCreativeForModal(null)}
        />
      )}

      {/* Batch Analysis Progress Modal */}
      <Dialog open={batchAnalysisProgress.isRunning || (batchAnalysisProgress.current > 0 && batchAnalysisProgress.current === batchAnalysisProgress.total)} onOpenChange={(open) => {
        if (!open && !batchAnalysisProgress.isRunning) {
          setBatchAnalysisProgress({
            isRunning: false,
            current: 0,
            total: 0,
            currentCreativeName: '',
            successCount: 0,
            failedCount: 0,
            failedCreatives: [],
          });
        }
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => batchAnalysisProgress.isRunning && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {batchAnalysisProgress.isRunning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Analisando Criativos
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Análise Concluída
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {batchAnalysisProgress.isRunning 
                ? 'A análise está em andamento. Por favor, aguarde...'
                : 'A análise em lote foi finalizada.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Progresso</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {batchAnalysisProgress.current} de {batchAnalysisProgress.total}
                </span>
              </div>
              <Progress 
                value={(batchAnalysisProgress.current / batchAnalysisProgress.total) * 100} 
                className="h-3"
              />
            </div>

            {/* Current Creative */}
            {batchAnalysisProgress.isRunning && batchAnalysisProgress.currentCreativeName && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Analisando agora:
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 truncate">
                      {batchAnalysisProgress.currentCreativeName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-300">Sucesso</p>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                      {batchAnalysisProgress.successCount}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-xs text-red-700 dark:text-red-300">Falhas</p>
                    <p className="text-lg font-bold text-red-900 dark:text-red-100">
                      {batchAnalysisProgress.failedCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Failed Creatives List */}
            {batchAnalysisProgress.failedCreatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Criativos com falha:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {batchAnalysisProgress.failedCreatives.map((failed, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-950 rounded">
                      <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-red-900 dark:text-red-100 truncate">{failed.name}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">{failed.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!batchAnalysisProgress.isRunning && (
            <div className="flex justify-end">
              <Button onClick={() => setBatchAnalysisProgress({
                isRunning: false,
                current: 0,
                total: 0,
                currentCreativeName: '',
                successCount: 0,
                failedCount: 0,
                failedCreatives: [],
              })}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
