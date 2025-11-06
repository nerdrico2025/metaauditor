import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import CreativeAuditModal from "@/components/Modals/CreativeAuditModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Eye, BarChart3, ChevronLeft, ChevronRight, Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";
import type { Creative, Campaign, Audit } from "@shared/schema";

// Component to show if creative has been analyzed
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
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-slate-300" />
      )}
    </div>
  );
}

interface PaginatedResponse {
  creatives: Creative[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Creatives() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [selectedCreativeForAnalysis, setSelectedCreativeForAnalysis] = useState<Creative | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 50;

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

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
    ...(searchTerm && { search: searchTerm }),
  });

  const { data, isLoading: creativesLoading, error } = useQuery<PaginatedResponse>({
    queryKey: [`/api/creatives?${queryParams.toString()}`],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
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
  }, [error, toast]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, campaignFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const creatives = data?.creatives || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

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

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId || !campaigns) return 'N/A';
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'N/A';
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < pagination.totalPages) setPage(page + 1);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Criativos" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar criativos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-creatives"
                  />
                </div>
                
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="w-full sm:w-64" data-testid="select-campaign-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Campanhas</SelectItem>
                    {campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {creativesLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : creatives.length > 0 ? (
                <>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Conv.</TableHead>
                          <TableHead className="text-center">Análise</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creatives.map((creative) => (
                          <TableRow key={creative.id} data-testid={`row-creative-${creative.id}`}>
                            <TableCell>
                              {creative.imageUrl && !creative.imageUrl.includes('placeholder') ? (
                                <img 
                                  src={creative.imageUrl} 
                                  alt={creative.name}
                                  className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setSelectedCreative(creative)}
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/80?text=IMG';
                                  }}
                                />
                              ) : (
                                <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-slate-400" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="max-w-xs">
                                <div className="truncate mb-1">{creative.name}</div>
                                <Badge variant={getStatusBadgeVariant(creative.status)} className="text-xs">
                                  {creative.status === 'active' ? 'Ativo' : 
                                   creative.status === 'paused' ? 'Pausado' : 'Inativo'}
                                </Badge>
                                {creative.headline && (
                                  <div className="text-xs text-slate-500 truncate mt-1">{creative.headline}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">
                                {getCampaignName(creative.campaignId)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {creative.impressions?.toLocaleString() || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {creative.clicks?.toLocaleString() || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {creative.ctr || '0'}%
                            </TableCell>
                            <TableCell className="text-right">
                              {creative.conversions || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <CreativeAnalysisIndicator creativeId={creative.id} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedCreative(creative)}
                                  data-testid={`button-view-${creative.id}`}
                                  title="Ver detalhes"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedCreativeForAnalysis(creative)}
                                  data-testid={`button-analyze-${creative.id}`}
                                  title="Analisar criativo"
                                >
                                  <BarChart3 className="h-4 w-4 mr-1" />
                                  Analisar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, pagination.total)} de {pagination.total} criativos
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      
                      <div className="text-sm text-slate-600">
                        Página {page} de {pagination.totalPages}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={page === pagination.totalPages}
                        data-testid="button-next-page"
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {searchTerm || statusFilter !== 'all' || campaignFilter !== 'all'
                      ? 'Nenhum criativo encontrado'
                      : 'Nenhum criativo disponível'
                    }
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {searchTerm || statusFilter !== 'all' || campaignFilter !== 'all'
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Sincronize suas campanhas para começar a ver os criativos.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedCreative && (
        <CreativeAuditModal 
          creative={selectedCreative}
          onClose={() => setSelectedCreative(null)}
        />
      )}

      {selectedCreativeForAnalysis && (
        <CreativeAuditModal 
          creative={selectedCreativeForAnalysis}
          onClose={() => setSelectedCreativeForAnalysis(null)}
          autoAnalyze={true}
        />
      )}
    </div>
  );
}
