import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Pagination } from "@/components/Pagination";
import { CreativeImage } from "./components/CreativeImage";
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
  RefreshCw,
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
  Palette
} from "lucide-react";
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

function CreativeAuditButton({ creativeId, onViewAudit }: { creativeId: string; onViewAudit: (audit: Audit) => void }) {
  const { data: audits, isLoading } = useQuery<Audit[]>({
    queryKey: [`/api/creatives/${creativeId}/audits`],
  });

  if (isLoading || !audits || audits.length === 0) {
    return null;
  }

  const latestAudit = audits[audits.length - 1];

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onViewAudit(latestAudit)}
      title="Ver análise"
      data-testid={`button-view-audit-${creativeId}`}
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}

export default function Creatives() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [location] = useLocation();
  const [zoomedCreative, setZoomedCreative] = useState<Creative | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [adSetFilter, setAdSetFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);
  const [showPolicySelectionDialog, setShowPolicySelectionDialog] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [pendingAnalysisType, setPendingAnalysisType] = useState<'single' | 'selected' | 'all' | null>(null);
  const [pendingCreativeId, setPendingCreativeId] = useState<string | null>(null);
  const [viewingAudit, setViewingAudit] = useState<Audit | null>(null);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check for adSetId filter in URL params
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const adSetId = params.get('adSetId');
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
    queryKey: ["/api/creatives"],
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

  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ['/api/integrations'],
    enabled: isAuthenticated,
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['/api/policies'],
    enabled: isAuthenticated,
  });

  const analyzeCreativeMutation = useMutation({
    mutationFn: (creativeId: string) => 
      apiRequest(`/api/creatives/${creativeId}/analyze`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      toast({ 
        title: '✅ Análise concluída!',
        description: 'O criativo foi analisado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na análise',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const analyzeBatchMutation = useMutation({
    mutationFn: (creativeIds: string[]) => 
      apiRequest('/api/creatives/analyze-batch', { 
        method: 'POST',
        body: JSON.stringify({ creativeIds }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      const successCount = data.success?.length || 0;
      const failedCount = data.failed?.length || 0;
      toast({ 
        title: '✅ Análise em lote concluída!',
        description: `${successCount} anúncios analisados com sucesso. ${failedCount > 0 ? `${failedCount} falharam.` : ''}`,
      });
      setSelectedCreatives([]); // Clear selection
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na análise',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        integrations.map((integration) =>
          fetch(`/api/integrations/${integration.id}/sync`, {
            method: 'POST',
            credentials: 'include',
          }).then(res => res.json())
        )
      );
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/creatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/adsets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const successData = fulfilled.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
      
      const totalCampaigns = successData.reduce((sum, data: any) => sum + (data.campaigns || 0), 0);
      const totalAdSets = successData.reduce((sum, data: any) => sum + (data.adSets || 0), 0);
      const totalCreatives = successData.reduce((sum, data: any) => sum + (data.creatives || 0), 0);
      
      const parts = [];
      if (totalCampaigns) parts.push(`${totalCampaigns} campanhas`);
      if (totalAdSets) parts.push(`${totalAdSets} grupos de anúncios`);
      if (totalCreatives) parts.push(`${totalCreatives} anúncios`);
      
      toast({
        title: "Sincronização concluída!",
        description: parts.length > 0 ? parts.join(', ') + ' sincronizados.' : 'Sincronização concluída.',
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao sincronizar integrações",
        variant: "destructive",
      });
    },
  });

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
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'Ativo';
      case 'paused':
        return 'Pausado';
      case 'archived':
        return 'Arquivado';
      default:
        return status;
    }
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

  const getMostRecentSync = () => {
    if (!integrations.length) return null;
    const syncs = integrations
      .map(i => i.lastSync)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return syncs[0] || null;
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
    const matchesStatus = statusFilter === "all" || creative.status.toLowerCase() === statusFilter;
    const matchesCampaign = campaignFilter === "all" || creative.campaignId === campaignFilter;
    const matchesAdSet = adSetFilter === "all" || creative.adSetId === adSetFilter;
    const matchesPlatform = platformFilter === "all" || creative.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesCampaign && matchesAdSet && matchesPlatform;
  });

  const totalPages = Math.ceil(filteredCreatives.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCreatives = filteredCreatives.slice(startIndex, startIndex + itemsPerPage);

  const metaCreatives = filteredCreatives.filter(c => c.platform === 'meta');
  const activeCreatives = filteredCreatives.filter(c => c.status.toLowerCase() === 'active');
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
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      Anúncios (Creatives)
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                      Gerencie os anúncios das suas campanhas Meta Ads e Google Ads
                    </p>
                    {getMostRecentSync() && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Última sincronização: {formatDate(getMostRecentSync())}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => syncAllMutation.mutate()}
                    disabled={syncAllMutation.isPending || !integrations.length}
                    variant="outline"
                    data-testid="button-sync-all"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncAllMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
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

              {integrations.length === 0 && (
                <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-900 dark:text-blue-100">
                    Você ainda não conectou nenhuma conta de anúncios. Vá para{' '}
                    <Link href="/settings" className="font-semibold underline">Configurações</Link>
                    {' '}para conectar suas contas Meta Ads ou Google Ads.
                  </AlertDescription>
                </Alert>
              )}

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
                        <SelectItem value="all">Todos Ad Sets</SelectItem>
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
                      <SelectTrigger className="w-full lg:w-[150px] bg-white dark:bg-gray-800" data-testid="select-status-filter">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="archived">Arquivado</SelectItem>
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
                            <TableHead>Ad Set</TableHead>
                            <TableHead>Status</TableHead>
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
                                <div onClick={() => setZoomedCreative(creative)} className="cursor-pointer">
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAnalyzeSingle(creative.id)}
                                    disabled={analyzeCreativeMutation.isPending}
                                    title="Analisar este anúncio"
                                    data-testid={`button-analyze-${creative.id}`}
                                  >
                                    <Sparkles className={`h-4 w-4 ${analyzeCreativeMutation.isPending ? 'animate-spin' : ''}`} />
                                  </Button>
                                  <CreativeAuditButton creativeId={creative.id} onViewAudit={(audit) => {
                                    setViewingAudit(audit);
                                    setShowAuditDialog(true);
                                  }} />
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

      {/* Audit View Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Resultado da Análise Detalhada</DialogTitle>
            <DialogDescription>
              Análise completa de conformidade de marca e performance de métricas
            </DialogDescription>
          </DialogHeader>
          {viewingAudit && (
            <div className="space-y-6">
              {/* Scores Section */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Conformidade de Marca</p>
                      <p className="text-4xl font-bold text-primary">{viewingAudit.complianceScore}%</p>
                      <Badge className="mt-2" variant={viewingAudit.complianceScore >= 80 ? 'default' : 'destructive'}>
                        {viewingAudit.complianceScore >= 80 ? 'Aprovado' : 'Reprovado'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Performance de Métricas</p>
                      <p className="text-4xl font-bold text-primary">{viewingAudit.performanceScore}%</p>
                      <Badge className="mt-2" variant={viewingAudit.performanceScore >= 60 ? 'default' : 'destructive'}>
                        {viewingAudit.performanceScore >= 80 ? 'Alta' : viewingAudit.performanceScore >= 60 ? 'Média' : 'Baixa'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status Geral</p>
                      <div className="mt-3">
                        <Badge variant={viewingAudit.status === 'conforme' ? 'default' : 'destructive'}>
                          {viewingAudit.status === 'conforme' ? 'Conforme' :
                           viewingAudit.status === 'parcialmente_conforme' ? 'Parcial' :
                           'Não Conforme'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Compliance Details */}
              {viewingAudit.aiAnalysis?.compliance && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Análise de Conformidade de Marca
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        {viewingAudit.aiAnalysis.compliance.analysis?.logoCompliance ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-sm">Logo da Marca</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {viewingAudit.aiAnalysis.compliance.analysis?.colorCompliance ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-sm">Cores da Marca</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {viewingAudit.aiAnalysis.compliance.analysis?.textCompliance ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-sm">Texto e Palavras-chave</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {viewingAudit.aiAnalysis.compliance.analysis?.brandGuidelines ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-sm">Diretrizes da Marca</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Metrics */}
              {viewingAudit.aiAnalysis?.performance && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Análise de Métricas de Performance
                    </h3>
                    <div className="space-y-4">
                      {viewingAudit.aiAnalysis.performance.metrics?.ctrAnalysis && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                            <MousePointer className="h-4 w-4" />
                            CTR (Click-Through Rate)
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
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
                          <p className="text-sm text-gray-700 dark:text-gray-300">
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
                          <p className="text-sm text-gray-700 dark:text-gray-300">
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
                  </CardContent>
                </Card>
              )}

              {/* Issues Section */}
              {viewingAudit.issues && viewingAudit.issues.length > 0 && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardContent className="pt-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      Problemas Encontrados ({viewingAudit.issues.length})
                    </h3>
                    <ul className="space-y-2">
                      {viewingAudit.issues.map((issue: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations Section */}
              {viewingAudit.recommendations && viewingAudit.recommendations.length > 0 && (
                <Card className="border-green-200 dark:border-green-800">
                  <CardContent className="pt-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Sparkles className="h-5 w-5" />
                      Recomendações de Melhoria ({viewingAudit.recommendations.length})
                    </h3>
                    <ul className="space-y-2">
                      {viewingAudit.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Policy Used */}
              {viewingAudit.aiAnalysis?.policyUsed && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Política utilizada: <span className="font-semibold">{viewingAudit.aiAnalysis.policyUsed}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowAuditDialog(false)}>
                  Fechar
                </Button>
                <Button onClick={() => setShowAuditDialog(false)} className="bg-primary">
                  Entendido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {zoomedCreative && (
        <Dialog open={!!zoomedCreative} onOpenChange={() => setZoomedCreative(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={() => setZoomedCreative(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <CreativeImage 
                creative={zoomedCreative}
                className="w-full h-auto rounded-lg"
                size="large"
              />
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{zoomedCreative.name}</h3>
                {zoomedCreative.headline && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{zoomedCreative.headline}</p>
                )}
                {zoomedCreative.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{zoomedCreative.description}</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
