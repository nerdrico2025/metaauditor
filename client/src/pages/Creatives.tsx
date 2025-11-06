import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { CreativeImage } from "@/components/CreativeImage";
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
  ChevronRight
} from "lucide-react";
import { SiGoogle } from 'react-icons/si';
import { Link } from "wouter";
import type { Creative, Campaign, Audit } from "@shared/schema";

interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  platform: string;
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

export default function Creatives() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [zoomedCreative, setZoomedCreative] = useState<Creative | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [adSetFilter, setAdSetFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

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

  const { data: creatives = [], isLoading: creativesLoading } = useQuery<Creative[]>({
    queryKey: ["/api/creatives"],
    enabled: isAuthenticated,
  });

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
      if (totalAdSets) parts.push(`${totalAdSets} ad sets`);
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

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return 'Campanha Desconhecida';
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Campanha Desconhecida';
  };

  const getAdSetName = (adSetId: string | null) => {
    if (!adSetId) return 'Ad Set Desconhecido';
    const adSet = adSets.find(a => a.id === adSetId);
    return adSet?.name || 'Ad Set Desconhecido';
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

  const filteredCreatives = (creatives || []).filter((creative) => {
    const matchesSearch = creative.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.externalId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || creative.status.toLowerCase() === statusFilter;
    const matchesCampaign = campaignFilter === "all" || creative.campaignId === campaignFilter;
    const matchesAdSet = adSetFilter === "all" || creative.adSetId === adSetFilter;
    const matchesPlatform = platformFilter === "all" || creative.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesCampaign && matchesAdSet && matchesPlatform;
  });

  const metaCreatives = filteredCreatives.filter(c => c.platform === 'meta');
  const activeCreatives = filteredCreatives.filter(c => c.status.toLowerCase() === 'active');
  const totalImpressions = filteredCreatives.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = filteredCreatives.reduce((sum, c) => sum + (c.clicks || 0), 0);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Anúncios" />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="flex items-center justify-between mb-6">
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
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-sync-all"
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
                          {filteredCreatives.map((creative) => (
                            <TableRow 
                              key={creative.id} 
                              className="hover:bg-gray-50 dark:hover:bg-gray-900/50" 
                              data-testid={`row-creative-${creative.id}`}
                            >
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
                                {creative.ctr || '0'}%
                              </TableCell>
                              <TableCell className="text-center">
                                <CreativeAnalysisIndicator creativeId={creative.id} />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-details-${creative.id}`}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>

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
