import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import CreativeAuditModal from "@/components/Modals/CreativeAuditModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Search, Filter, Eye, BarChart3 } from "lucide-react";
import type { Creative } from "@shared/schema";
import { CreativeImage } from "@/components/CreativeImage";

export default function Creatives() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [selectedCreativeForAnalysis, setSelectedCreativeForAnalysis] = useState<Creative | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const { data: creatives, isLoading: creativesLoading, error } = useQuery<Creative[]>({
    queryKey: ["/api/creatives"],
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

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'image':
        return 'bg-blue-100 text-blue-800';
      case 'video':
        return 'bg-purple-100 text-purple-800';
      case 'carousel':
        return 'bg-green-100 text-green-800';
      case 'text':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const filteredCreatives = creatives?.filter((creative: Creative) => {
    const matchesSearch = creative.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.headline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creative.text?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || creative.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Criativos" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Filters */}
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar criativos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(9)].map((_, i) => (
                    <Card key={i} className="border-slate-200">
                      <CardContent className="p-4">
                        <Skeleton className="h-32 w-full mb-4 rounded" />
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2 mb-3" />
                        <div className="flex justify-between">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredCreatives.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCreatives.map((creative: Creative) => (
                    <Card key={creative.id} className="border-slate-200 hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        {/* Creative Preview */}
                        <div className="relative mb-4">
                          <CreativeImage creative={creative} />
                          <div className="absolute top-2 right-2">
                            <Badge className={`text-xs ${getTypeBadgeColor(creative.type)}`}>
                              {creative.type}
                            </Badge>
                          </div>
                        </div>

                        {/* Creative Info */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {creative.name}
                          </h3>
                          
                          {creative.headline && (
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {creative.headline}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <Badge variant={getStatusBadgeVariant(creative.status)}>
                              {creative.status === 'active' ? 'Ativo' : 
                               creative.status === 'paused' ? 'Pausado' : 'Inativo'}
                            </Badge>
                            
                            <div className="text-sm text-slate-500">
                              {creative.impressions?.toLocaleString() || 0} impressões
                            </div>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                            <div>
                              <span className="block font-medium">CTR</span>
                              <span>{creative.ctr || '0'}%</span>
                            </div>
                            <div>
                              <span className="block font-medium">Cliques</span>
                              <span>{creative.clicks || 0}</span>
                            </div>
                            <div>
                              <span className="block font-medium">Conv.</span>
                              <span>{creative.conversions || 0}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2 pt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setSelectedCreative(creative)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setSelectedCreativeForAnalysis(creative)}
                              data-testid={`button-analyze-${creative.id}`}
                            >
                              <BarChart3 className="h-4 w-4 mr-1" />
                              Analisar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Image className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Nenhum criativo encontrado'
                      : 'Nenhum criativo disponível'
                    }
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {searchTerm || statusFilter !== 'all'
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
