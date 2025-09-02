import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image,
  Video,
  Type,
  Eye,
  MousePointer,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  X,
  BarChart3,
} from "lucide-react";
import type { Campaign, Creative } from "@shared/schema";
import CreativeAuditModal from "./CreativeAuditModal";

interface CampaignCreativesModalProps {
  campaign: Campaign;
  onClose: () => void;
}

export default function CampaignCreativesModal({
  campaign,
  onClose,
}: CampaignCreativesModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  const { data: creatives, isLoading, error } = useQuery<Creative[]>({
    queryKey: [`/api/campaigns/${campaign.id}/creatives`],
  });

  // Filter creatives based on search and filters
  const filteredCreatives = creatives?.filter((creative) => {
    const matchesSearch = creative.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.headline?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || creative.status === statusFilter;
    const matchesType = typeFilter === "all" || creative.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  const getCreativeTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'carousel':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

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

  const getPerformanceBadge = (ctr: string) => {
    const ctrValue = parseFloat(ctr || "0");
    if (ctrValue > 2) return { variant: "default" as const, label: "Alto", icon: TrendingUp };
    if (ctrValue >= 1) return { variant: "secondary" as const, label: "Médio", icon: TrendingUp };
    return { variant: "destructive" as const, label: "Baixo", icon: TrendingDown };
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  Criativos da Campanha
                </DialogTitle>
                <DialogDescription className="text-slate-600 mt-1">
                  {campaign.name} • {campaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar criativos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="max-h-[60vh]">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border-slate-200">
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full mb-4" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <Image className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Erro ao carregar criativos
                </h3>
                <p className="text-slate-600">
                  Não foi possível carregar os criativos da campanha. Tente novamente.
                </p>
              </div>
            ) : filteredCreatives.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Nenhum criativo encontrado
                </h3>
                <p className="text-slate-600">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all" 
                    ? "Tente ajustar os filtros de busca." 
                    : "Esta campanha ainda não possui criativos cadastrados."
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCreatives.map((creative) => {
                  const performance = getPerformanceBadge(creative.ctr || "0");
                  const PerformanceIcon = performance.icon;
                  
                  return (
                    <Card 
                      key={creative.id} 
                      className="border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedCreative(creative)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            {getCreativeTypeIcon(creative.type)}
                            <CardTitle className="text-sm font-semibold text-slate-900 truncate">
                              {creative.name}
                            </CardTitle>
                          </div>
                          <Badge variant={getStatusBadgeVariant(creative.status)} className="ml-2">
                            {creative.status === 'active' ? 'Ativo' : 
                             creative.status === 'paused' ? 'Pausado' : 'Inativo'}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        {/* Creative Preview */}
                        {creative.imageUrl ? (
                          <div className="mb-4">
                            <img 
                              src={creative.imageUrl} 
                              alt={creative.name}
                              className="w-full h-32 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=400';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mb-4 h-32 bg-slate-100 rounded-lg flex items-center justify-center">
                            {getCreativeTypeIcon(creative.type)}
                          </div>
                        )}

                        {/* Creative Text Preview */}
                        {(creative.headline || creative.text) && (
                          <div className="mb-4 space-y-1">
                            {creative.headline && (
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {creative.headline}
                              </p>
                            )}
                            {creative.text && (
                              <p className="text-xs text-slate-600 line-clamp-2">
                                {creative.text}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="flex items-center justify-center mb-1">
                              <Eye className="h-3 w-3 text-slate-400 mr-1" />
                            </div>
                            <p className="text-xs text-slate-600">Impressões</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {(creative.impressions || 0).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          
                          <div>
                            <div className="flex items-center justify-center mb-1">
                              <MousePointer className="h-3 w-3 text-slate-400 mr-1" />
                            </div>
                            <p className="text-xs text-slate-600">Cliques</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {(creative.clicks || 0).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* Performance Badge */}
                        <div className="flex justify-center mt-3">
                          <Badge 
                            variant={performance.variant} 
                            className="inline-flex items-center text-xs"
                          >
                            <PerformanceIcon className="h-3 w-3 mr-1" />
                            CTR {performance.label}: {parseFloat(creative.ctr || "0").toFixed(2)}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Summary Stats */}
          {!isLoading && !error && filteredCreatives.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="text-center text-sm text-slate-600">
                Exibindo <span className="font-semibold">{filteredCreatives.length}</span> de{' '}
                <span className="font-semibold">{creatives?.length || 0}</span> criativos
                {(searchTerm || statusFilter !== "all" || typeFilter !== "all") && (
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 p-0 h-auto"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Creative Audit Modal */}
      {selectedCreative && (
        <CreativeAuditModal 
          creative={selectedCreative}
          onClose={() => setSelectedCreative(null)}
        />
      )}
    </>
  );
}