import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, Calendar, DollarSign, BarChart3 } from "lucide-react";
import CampaignReportModal from "@/components/Modals/CampaignReportModal";
import CampaignCreativesModal from "@/components/Modals/CampaignCreativesModal";
import type { Campaign } from "@shared/schema";

export default function Campaigns() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<Campaign | null>(null);
  const [selectedCampaignForCreatives, setSelectedCampaignForCreatives] = useState<Campaign | null>(null);

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
        return '📘'; // Meta/Facebook icon placeholder
      case 'google':
        return '🔍'; // Google icon placeholder
      default:
        return '📊';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Campanhas" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {campaignsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="border-slate-200">
                      <CardHeader>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : campaigns && campaigns.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {campaigns.map((campaign: Campaign) => (
                    <Card key={campaign.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getPlatformIcon(campaign.platform)}</span>
                            <div>
                              <CardTitle className="text-lg font-semibold text-slate-900">
                                {campaign.name}
                              </CardTitle>
                              <p className="text-sm text-slate-500 capitalize">
                                {campaign.platform} Ads
                              </p>
                            </div>
                          </div>
                          <Badge variant={getStatusBadgeVariant(campaign.status)}>
                            {campaign.status === 'active' ? 'Ativa' : 
                             campaign.status === 'paused' ? 'Pausada' : 'Inativa'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {campaign.budget && (
                            <div className="flex items-center space-x-2 text-sm text-slate-600">
                              <DollarSign className="h-4 w-4" />
                              <span>Orçamento: R$ {parseFloat(campaign.budget).toFixed(2)}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2 text-sm text-slate-600">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Criada em {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-sm text-slate-600">
                            <BarChart3 className="h-4 w-4" />
                            <span>ID: {campaign.externalId}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setSelectedCampaignForCreatives(campaign)}
                            >
                              <BellRing className="h-4 w-4 mr-2" />
                              Ver Criativos
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setSelectedCampaignForReport(campaign)}
                            >
                              <BarChart3 className="h-4 w-4 mr-2" />
                              Relatório
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BellRing className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Nenhuma campanha encontrada
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Conecte suas contas Meta Ads ou Google Ads para começar a sincronizar campanhas.
                  </p>
                  <Button variant="outline">
                    Configurar Integrações
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Modals */}
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
    </div>
  );
}
