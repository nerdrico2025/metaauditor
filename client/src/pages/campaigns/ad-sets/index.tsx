import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Pagination } from "@/components/Pagination";
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
  Search, 
  Target, 
  DollarSign, 
  TrendingUp,
  Users,
  Image as ImageIcon,
  AlertCircle,
  Layers,
  ChevronRight,
  Facebook
} from "lucide-react";
import { SiGoogle } from 'react-icons/si';
import { Link, useLocation } from "wouter";

interface AdSet {
  id: string;
  name: string;
  externalId: string;
  campaignId: string;
  status: string;
  budget: number | null;
  bidStrategy: string | null;
  targetingAge: string | null;
  targetingGender: string | null;
  targetingLocations: string[] | null;
  targetingInterests: string[] | null;
  platform: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  conversions: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Campaign {
  id: string;
  name: string;
  externalId: string;
  platform: string;
  status: string;
}

export default function AdSets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [, setLocation] = useLocation();

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

  const { data: adSets, isLoading: adSetsLoading } = useQuery<AdSet[]>({
    queryKey: ["/api/adsets"],
    enabled: isAuthenticated,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const { data: creativesData } = useQuery<any>({
    queryKey: ['/api/creatives?limit=10000'],
    enabled: isAuthenticated,
  });
  
  const allCreatives = creativesData?.creatives || [];

  // Reset to page 1 when filters change - must be before early return
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, campaignFilter, platformFilter]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const filteredAdSets = adSets?.filter((adSet) => {
    const matchesSearch = adSet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adSet.externalId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || adSet.status === statusFilter;
    const matchesCampaign = campaignFilter === "all" || adSet.campaignId === campaignFilter;
    const matchesPlatform = platformFilter === "all" || adSet.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesCampaign && matchesPlatform;
  }) || [];

  const totalPages = Math.ceil(filteredAdSets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAdSets = filteredAdSets.slice(startIndex, startIndex + itemsPerPage);

  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Campanha Desconhecida';
  };

  const getCreativeCount = (adSetId: string) => {
    if (!Array.isArray(allCreatives)) return 0;
    return allCreatives.filter((creative: any) => creative.adSetId === adSetId).length;
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'meta') return <Facebook className="h-5 w-5 text-blue-600" />;
    if (platform === 'google') return <SiGoogle className="h-5 w-5 text-red-600" />;
    return <Target className="h-5 w-5 text-gray-600" />;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-BR').format(value);
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

  const metaAdSets = filteredAdSets.filter(a => a.platform === 'meta');
  const activeAdSets = filteredAdSets.filter(a => a.status.toLowerCase() === 'active');
  const totalSpend = filteredAdSets.reduce((sum, adSet) => sum + (adSet.spend || 0), 0);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Grupos de Anúncios" />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Grupos de Anúncios
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Gerencie os grupos de anúncios das suas campanhas Meta Ads e Google Ads
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Grupos</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-adsets">
                          {filteredAdSets.length}
                        </p>
                      </div>
                      <Layers className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Grupos Meta Ads</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2" data-testid="stat-meta-adsets">
                          {metaAdSets.length}
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
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Grupos Ativos</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2" data-testid="stat-active-adsets">
                          {activeAdSets.length}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-green-600 dark:bg-green-400"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Investimento Total</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2" data-testid="stat-total-spend">
                          {formatCurrency(totalSpend)}
                        </p>
                      </div>
                      <DollarSign className="h-10 w-10 text-orange-500" />
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
                          data-testid="input-search-adsets"
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

                    {(searchTerm || statusFilter !== "all" || campaignFilter !== "all" || platformFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setCampaignFilter("all");
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
                  {adSetsLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredAdSets.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {searchTerm || statusFilter !== "all" || campaignFilter !== "all" || platformFilter !== "all"
                          ? "Nenhum ad set encontrado"
                          : "Nenhum ad set sincronizado"
                        }
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {searchTerm || statusFilter !== "all" || campaignFilter !== "all" || platformFilter !== "all"
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
                            <TableHead>Nome do Grupo</TableHead>
                            <TableHead>Campanha</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Orçamento</TableHead>
                            <TableHead>Impressões</TableHead>
                            <TableHead>Cliques</TableHead>
                            <TableHead>Investimento</TableHead>
                            <TableHead className="text-center">Anúncios</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAdSets.map((adSet) => {
                            const creativeCount = getCreativeCount(adSet.id);
                            
                            return (
                              <TableRow key={adSet.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`row-adset-${adSet.id}`}>
                                <TableCell>
                                  {getPlatformIcon(adSet.platform)}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">{adSet.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500">ID: {adSet.externalId}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {getCampaignName(adSet.campaignId)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusBadgeVariant(adSet.status)}>
                                    {adSet.status === 'active' ? 'Ativo' : 
                                     adSet.status === 'paused' ? 'Pausado' : 
                                     adSet.status === 'archived' ? 'Arquivado' : adSet.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {adSet.budget ? (
                                    <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                      <DollarSign className="h-3 w-3" />
                                      <span>{formatCurrency(adSet.budget)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {formatNumber(adSet.impressions)}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {formatNumber(adSet.clicks)}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {formatCurrency(adSet.spend)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold text-gray-600 dark:text-gray-400">
                                    {creativeCount}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const params = new URLSearchParams();
                                      params.set('adSetId', adSet.id);
                                      setLocation(`/creatives?${params.toString()}`);
                                    }}
                                    data-testid={`button-view-ads-${adSet.id}`}
                                  >
                                    Ver Anúncios
                                    <ChevronRight className="h-4 w-4 ml-1" />
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
                        totalItems={filteredAdSets.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        itemName="ad sets"
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
