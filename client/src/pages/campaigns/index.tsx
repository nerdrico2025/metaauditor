import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Pagination } from "@/components/Pagination";
import { SyncLoadingModal } from "@/components/SyncLoadingModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BellRing, 
  Calendar, 
  DollarSign, 
  Search, 
  RefreshCw,
  AlertCircle,
  Layers,
  Image as ImageIcon,
  Facebook,
  ChevronRight
} from "lucide-react";
import { SiGoogle } from 'react-icons/si';
import { Link } from "wouter";
import type { Campaign } from "@shared/schema";

export default function Campaigns() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSteps, setSyncSteps] = useState<Array<{name: string; status: 'pending' | 'loading' | 'success' | 'error'; count?: number; error?: string}>>([]);
  const [currentSyncStep, setCurrentSyncStep] = useState(0);

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

  const { data: campaigns, isLoading: campaignsLoading, error } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ['/api/integrations'],
    enabled: isAuthenticated,
  });

  const { data: allAdSets = [] } = useQuery<any[]>({
    queryKey: ['/api/adsets'],
    enabled: isAuthenticated,
  });

  const { data: creativesData } = useQuery<any>({
    queryKey: ['/api/creatives'],
    enabled: isAuthenticated,
  });
  
  const allCreatives = creativesData?.creatives || [];

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      // Initialize sync steps - one for each integration
      const initialSteps = integrations.map(integration => ({
        name: `${integration.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}: ${integration.accountName || integration.accountId}`,
        status: 'pending' as const,
        count: 0,
      }));
      
      setSyncSteps(initialSteps);
      setCurrentSyncStep(0);
      setShowSyncModal(true);
      
      // Sync integrations one by one to track progress
      const results: any[] = [];
      for (let i = 0; i < integrations.length; i++) {
        const integration = integrations[i];
        
        // Update step to loading
        setSyncSteps(prev => prev.map((step, idx) => 
          idx === i ? { ...step, status: 'loading' as const } : step
        ));
        setCurrentSyncStep(i);
        
        try {
          const response = await fetch(`/api/integrations/${integration.id}/sync`, {
            method: 'POST',
            credentials: 'include',
          });
          
          const data = await response.json();
          
          if (response.ok) {
            const totalItems = (data.campaigns || 0) + (data.adSets || 0) + (data.creatives || 0);
            setSyncSteps(prev => prev.map((step, idx) => 
              idx === i ? { ...step, status: 'success' as const, count: totalItems } : step
            ));
            results.push({ status: 'fulfilled', value: data });
          } else {
            setSyncSteps(prev => prev.map((step, idx) => 
              idx === i ? { ...step, status: 'error' as const, error: data.error || 'Erro na sincronização' } : step
            ));
            results.push({ status: 'rejected', reason: new Error(data.error || 'Sync failed') });
          }
        } catch (error) {
          setSyncSteps(prev => prev.map((step, idx) => 
            idx === i ? { ...step, status: 'error' as const, error: 'Erro de conexão' } : step
          ));
          results.push({ status: 'rejected', reason: error });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adsets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      
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
      
      // Auto-close modal after 3 seconds
      setTimeout(() => setShowSyncModal(false), 3000);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível sincronizar as integrações",
        variant: "destructive",
      });
      setShowSyncModal(false);
    },
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
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
  }, [error, toast]);

  // Reset to page 1 when filters change - must be before early return
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, platformFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'inactive':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'meta') return <Facebook className="h-5 w-5 text-blue-600" />;
    if (platform === 'google') return <SiGoogle className="h-5 w-5 text-red-600" />;
    return <BellRing className="h-5 w-5 text-gray-600" />;
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'Meta Ads';
      case 'google':
        return 'Google Ads';
      default:
        return platform;
    }
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

  const getAdSetCount = (campaignId: string) => {
    if (!Array.isArray(allAdSets)) return 0;
    return allAdSets.filter((adSet: any) => adSet.campaignId === campaignId).length;
  };

  const getCreativeCount = (campaignId: string) => {
    if (!Array.isArray(allAdSets) || !Array.isArray(allCreatives)) return 0;
    const campaignAdSets = allAdSets.filter((adSet: any) => adSet.campaignId === campaignId);
    const adSetIds = campaignAdSets.map((adSet: any) => adSet.id);
    return allCreatives.filter((creative: any) => adSetIds.includes(creative.adSetId)).length;
  };

  const filteredCampaigns = campaigns?.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.externalId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || campaign.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesPlatform;
  }) || [];

  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCampaigns = filteredCampaigns.slice(startIndex, startIndex + itemsPerPage);

  const metaCampaigns = filteredCampaigns.filter(c => c.platform === 'meta');
  const googleCampaigns = filteredCampaigns.filter(c => c.platform === 'google');
  const activeCampaigns = filteredCampaigns.filter(c => c.status === 'active');

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <SyncLoadingModal 
        open={showSyncModal}
        steps={syncSteps}
        currentStep={currentSyncStep}
        onOpenChange={setShowSyncModal}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Campanhas" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Campanhas</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Gerencie suas campanhas publicitárias do Meta Ads e Google Ads
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
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-sync-all-campaigns"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncAllMutation.isPending ? 'Sincronizando...' : 'Sincronizar Tudo'}
                </Button>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Campanhas</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-campaigns">
                          {filteredCampaigns.length}
                        </p>
                      </div>
                      <BellRing className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Campanhas Meta Ads</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2" data-testid="stat-meta-campaigns">
                          {metaCampaigns.length}
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
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Campanhas Ativas</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2" data-testid="stat-active-campaigns">
                          {activeCampaigns.length}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-green-600 dark:bg-green-400"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          placeholder="Buscar por nome ou ID..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-white dark:bg-gray-800"
                          data-testid="input-search-campaigns"
                        />
                      </div>
                    </div>
                    
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-800" data-testid="select-platform-filter">
                        <SelectValue placeholder="Plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Plataformas</SelectItem>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px] bg-white dark:bg-gray-800" data-testid="select-status-filter">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                        <SelectItem value="inactive">Inativa</SelectItem>
                      </SelectContent>
                    </Select>

                    {(searchTerm || statusFilter !== "all" || platformFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setPlatformFilter("all");
                        }}
                        className="w-full sm:w-auto"
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
                  {campaignsLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="text-center py-12">
                      <BellRing className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {searchTerm || statusFilter !== "all" || platformFilter !== "all"
                          ? "Nenhuma campanha encontrada"
                          : "Nenhuma campanha sincronizada"
                        }
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {searchTerm || statusFilter !== "all" || platformFilter !== "all"
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
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Nome da Campanha</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Orçamento</TableHead>
                            <TableHead className="text-center">Ad Sets</TableHead>
                            <TableHead className="text-center">Anúncios</TableHead>
                            <TableHead>Criada em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCampaigns.map((campaign) => {
                            const adSetCount = getAdSetCount(campaign.id);
                            const creativeCount = getCreativeCount(campaign.id);
                            
                            return (
                              <TableRow key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`row-campaign-${campaign.id}`}>
                                <TableCell>
                                  {getPlatformIcon(campaign.platform)}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">{campaign.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500">ID: {campaign.externalId}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {getPlatformName(campaign.platform)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusBadgeVariant(campaign.status)}>
                                    {campaign.status === 'active' ? 'Ativa' : 
                                     campaign.status === 'paused' ? 'Pausada' : 'Inativa'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {campaign.budget ? (
                                    <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                      <DollarSign className="h-3 w-3" />
                                      <span>R$ {parseFloat(campaign.budget).toFixed(2)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="font-semibold"
                                    data-testid={`button-view-adsets-${campaign.id}`}
                                  >
                                    <Link href="/adsets">
                                      <Layers className="h-4 w-4 mr-1" />
                                      {adSetCount}
                                    </Link>
                                  </Button>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="font-semibold"
                                    data-testid={`button-view-creatives-${campaign.id}`}
                                  >
                                    <Link href="/creatives">
                                      <ImageIcon className="h-4 w-4 mr-1" />
                                      {creativeCount}
                                    </Link>
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {campaign.createdAt 
                                        ? new Date(campaign.createdAt).toLocaleDateString('pt-BR')
                                        : '-'
                                      }
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    data-testid={`button-details-${campaign.id}`}
                                  >
                                    <Link href={`/campaigns/${campaign.id}`}>
                                      <ChevronRight className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredCampaigns.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        itemName="campanhas"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
