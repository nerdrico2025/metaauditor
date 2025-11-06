import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
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
import { Search, Filter, RefreshCw, Target } from "lucide-react";

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
}

export default function AdSets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // Redirect to home if not authenticated
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

  const { data: adSets, isLoading: adSetsLoading } = useQuery<AdSet[]>({
    queryKey: ["/api/adsets"],
    enabled: isAuthenticated,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  // Mutation to sync all integrations
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
      queryClient.invalidateQueries({ queryKey: ["/api/adsets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      toast({
        title: "Sincronização concluída!",
        description: `${successCount} integração(ões) sincronizada(s) com sucesso.`,
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

  // Filter ad sets
  const filteredAdSets = adSets?.filter((adSet) => {
    const matchesSearch = adSet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adSet.externalId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || adSet.status === statusFilter;
    const matchesCampaign = campaignFilter === "all" || adSet.campaignId === campaignFilter;
    const matchesPlatform = platformFilter === "all" || adSet.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesCampaign && matchesPlatform;
  }) || [];

  // Helper function to get campaign name
  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Unknown Campaign';
  };

  // Get unique platforms
  const platforms = Array.from(new Set(adSets?.map(a => a.platform) || []));

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Format number
  const formatNumber = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  // Get status badge variant
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Ad Sets (Grupos de Anúncios)
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Visualize e gerencie os grupos de anúncios das suas campanhas
                </p>
              </div>
              <Button
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                data-testid="button-sync-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                {syncAllMutation.isPending ? 'Sincronizando...' : 'Sincronizar Tudo'}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Ad Sets
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {filteredAdSets.length}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Ativos
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {filteredAdSets.filter(a => a.status === 'ACTIVE').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Pausados
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {filteredAdSets.filter(a => a.status === 'PAUSED').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Gasto
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(filteredAdSets.reduce((sum, a) => sum + (a.spend || 0), 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por nome ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>

                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger data-testid="select-campaign-filter">
                      <SelectValue placeholder="Todas as Campanhas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Campanhas</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status-filter">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="PAUSED">Pausado</SelectItem>
                      <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger data-testid="select-platform-filter">
                      <SelectValue placeholder="Todas as Plataformas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Plataformas</SelectItem>
                      {platforms.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Ad Sets Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Orçamento</TableHead>
                      <TableHead>Impressões</TableHead>
                      <TableHead>Cliques</TableHead>
                      <TableHead>Gasto</TableHead>
                      <TableHead>Conversões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adSetsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredAdSets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Nenhum ad set encontrado. Sincronize suas integrações para importar dados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAdSets.map((adSet) => (
                        <TableRow key={adSet.id} data-testid={`row-adset-${adSet.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="font-medium">{adSet.name}</p>
                              <p className="text-xs text-gray-500">ID: {adSet.externalId}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{getCampaignName(adSet.campaignId)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(adSet.status)}>
                              {adSet.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {adSet.platform === 'meta' ? 'Meta' : adSet.platform}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(adSet.budget)}</TableCell>
                          <TableCell>{formatNumber(adSet.impressions)}</TableCell>
                          <TableCell>{formatNumber(adSet.clicks)}</TableCell>
                          <TableCell>{formatCurrency(adSet.spend)}</TableCell>
                          <TableCell>{formatNumber(adSet.conversions)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
