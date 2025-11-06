
import { useEffect, useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, Calendar, DollarSign, BarChart3, Search, Eye, Edit, Trash2, Filter, Plus } from "lucide-react";
import type { Campaign } from "@shared/schema";

// Lazy load modals to reduce chunk size
const CampaignReportModal = lazy(() => import("@/components/Modals/CampaignReportModal"));
const CampaignCreativesModal = lazy(() => import("@/components/Modals/CampaignCreativesModal"));
const CampaignFormModal = lazy(() => import("@/components/Modals/CampaignFormModal"));

export default function Campaigns() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<Campaign | null>(null);
  const [selectedCampaignForCreatives, setSelectedCampaignForCreatives] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const { data: campaigns, isLoading: campaignsLoading, error } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  // Fetch integrations to show last sync time
  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ['/api/integrations'],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Sucesso",
        description: "Campanha excluída com sucesso",
      });
      setCampaignToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a campanha",
        variant: "destructive",
      });
    },
  });

  // Mutation to sync all integrations
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
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      toast({
        title: "Sincronização concluída!",
        description: `${successCount} integração(ões) sincronizada(s) com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível sincronizar as integrações",
        variant: "destructive",
      });
    },
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
    switch (platform) {
      case 'meta':
        return '📘';
      case 'google':
        return '🔍';
      default:
        return '📊';
    }
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

  const getCampaignOrigin = (campaign: Campaign) => {
    // Check if campaign integration is google_sheets
    const integration = integrations.find(i => i.id === campaign.integrationId);
    if (integration?.platform === 'google_sheets') {
      return {
        name: 'Planilha Google',
        icon: '📊',
        variant: 'outline' as const
      };
    }
    
    // Otherwise it's direct API integration
    if (campaign.platform === 'meta') {
      return {
        name: 'API Meta Ads',
        icon: '📘',
        variant: 'default' as const
      };
    } else if (campaign.platform === 'google') {
      return {
        name: 'API Google Ads',
        icon: '🔍',
        variant: 'secondary' as const
      };
    }
    
    return {
      name: 'Desconhecida',
      icon: '❓',
      variant: 'outline' as const
    };
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

  // Filter campaigns
  const filteredCampaigns = campaigns?.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.externalId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || campaign.platform === platformFilter;
    
    return matchesSearch && matchesStatus && matchesPlatform;
  }) || [];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Campanhas" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header com botão de sincronizar */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Campanhas</h2>
                  {getMostRecentSync() && (
                    <p className="text-sm text-slate-600 mt-1">
                      Última sincronização: {formatDate(getMostRecentSync())}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => syncAllMutation.mutate()}
                    disabled={syncAllMutation.isPending || !integrations.length}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-sync-all-campaigns"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncAllMutation.isPending ? 'Sincronizando...' : 'Sincronizar Todas'}
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <Card className="mb-6 bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Buscar por nome ou ID..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-white"
                        />
                      </div>
                    </div>
                    
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] bg-white">
                        <SelectValue placeholder="Plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Plataformas</SelectItem>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px] bg-white">
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
                        className="w-full sm:w-auto bg-white"
                      >
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="bg-white border-slate-200">
                <CardContent className="p-0">
                  {campaignsLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="text-center py-12">
                      <BellRing className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {searchTerm || statusFilter !== "all" || platformFilter !== "all"
                          ? "Nenhuma campanha encontrada"
                          : "Nenhuma campanha cadastrada"
                        }
                      </h3>
                      <p className="text-slate-600 mb-6">
                        {searchTerm || statusFilter !== "all" || platformFilter !== "all"
                          ? "Tente ajustar os filtros de busca."
                          : "Conecte suas contas Meta Ads ou Google Ads para começar a sincronizar campanhas."
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Nome da Campanha</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Orçamento</TableHead>
                            <TableHead>Criada em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCampaigns.map((campaign) => (
                            <TableRow key={campaign.id} className="hover:bg-slate-50">
                              <TableCell>
                                <span className="text-2xl">{getPlatformIcon(campaign.platform)}</span>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-slate-900">{campaign.name}</div>
                                  <div className="text-sm text-slate-500">ID: {campaign.externalId}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-slate-600">
                                  {getPlatformName(campaign.platform)}
                                </span>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const origin = getCampaignOrigin(campaign);
                                  return (
                                    <Badge variant={origin.variant} className="flex items-center gap-1 w-fit">
                                      <span>{origin.icon}</span>
                                      <span>{origin.name}</span>
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusBadgeVariant(campaign.status)}>
                                  {campaign.status === 'active' ? 'Ativa' : 
                                   campaign.status === 'paused' ? 'Pausada' : 'Inativa'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {campaign.budget ? (
                                  <div className="flex items-center space-x-1 text-sm text-slate-600">
                                    <DollarSign className="h-3 w-3" />
                                    <span>R$ {parseFloat(campaign.budget).toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-1 text-sm text-slate-600">
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
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedCampaignForCreatives(campaign)}
                                    title="Ver Criativos"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedCampaignForReport(campaign)}
                                    title="Ver Relatório"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCampaignToEdit(campaign)}
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCampaignToDelete(campaign)}
                                    title="Excluir"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Summary */}
                  {!campaignsLoading && filteredCampaigns.length > 0 && (
                    <div className="border-t border-slate-200 px-6 py-4">
                      <div className="text-sm text-slate-600">
                        Exibindo <span className="font-semibold">{filteredCampaigns.length}</span> de{' '}
                        <span className="font-semibold">{campaigns?.length || 0}</span> campanhas
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
      
      {/* Modals */}
      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>}>
        {selectedCampaignForReport && (
          <CampaignReportModal 
            campaign={selectedCampaignForReport}
            onClose={() => setSelectedCampaignForReport(null)}
          />
        )}
        
        {selectedCampaignForCreatives && (
          <CampaignCreativesModal 
            campaign={selectedCampaignForCreatives}
            onClose={() => setSelectedCampaignForCreatives(null)}
          />
        )}

        {(isCreatingCampaign || campaignToEdit) && (
          <CampaignFormModal
            campaign={campaignToEdit}
            onClose={() => {
              setIsCreatingCampaign(false);
              setCampaignToEdit(null);
            }}
          />
        )}
      </Suspense>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha "<strong>{campaignToDelete?.name}</strong>"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => campaignToDelete && deleteMutation.mutate(campaignToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
