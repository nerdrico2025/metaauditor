import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import type { Campaign } from "@shared/schema";

interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  platform: string;
}

export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  campaignFilter: string;
  adSetFilter: string;
  platformFilter: string;
  analysisFilter: string;
  complianceFilter: string;
  ctrFilter: string;
  impressionsFilter: string;
  clicksFilter: string;
}

interface CreativeFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilters: () => void;
  campaigns: Campaign[];
  adSets: AdSet[];
}

export function CreativeFilters({
  filters,
  onFilterChange,
  onClearFilters,
  campaigns,
  adSets,
}: CreativeFiltersProps) {
  const hasActiveFilters = 
    filters.searchTerm || 
    filters.statusFilter !== "all" || 
    filters.campaignFilter !== "all" || 
    filters.adSetFilter !== "all" || 
    filters.platformFilter !== "all" || 
    filters.analysisFilter !== "all" || 
    filters.complianceFilter !== "all" || 
    filters.ctrFilter !== "all" || 
    filters.impressionsFilter !== "all" || 
    filters.clicksFilter !== "all";

  return (
    <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-6">
        {/* First row - Basic filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Search */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Nome ou ID..."
                value={filters.searchTerm}
                onChange={(e) => onFilterChange("searchTerm", e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800"
                data-testid="input-search-creatives"
              />
            </div>
          </div>
          
          {/* Campaign */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Campanha</Label>
            <Select value={filters.campaignFilter} onValueChange={(v) => onFilterChange("campaignFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-campaign-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ad Set */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Grupo de Anúncios</Label>
            <Select value={filters.adSetFilter} onValueChange={(v) => onFilterChange("adSetFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-adset-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {adSets.map((adSet) => (
                  <SelectItem key={adSet.id} value={adSet.id}>
                    {adSet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Plataforma</Label>
            <Select value={filters.platformFilter} onValueChange={(v) => onFilterChange("platformFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-platform-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Veiculação</Label>
            <Select value={filters.statusFilter} onValueChange={(v) => onFilterChange("statusFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-status-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Não está em veiculação">Pausado</SelectItem>
                <SelectItem value="Campanha Desativada">Camp. Desativada</SelectItem>
                <SelectItem value="Grupo Desativado">Grupo Desativado</SelectItem>
                <SelectItem value="Arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Second row - Analysis and Metrics filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Analysis Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Análise</Label>
            <Select value={filters.analysisFilter} onValueChange={(v) => onFilterChange("analysisFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-analysis-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="not_analyzed">Não Analisados</SelectItem>
                <SelectItem value="analyzed">Analisados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Compliance Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Conformidade</Label>
            <Select value={filters.complianceFilter} onValueChange={(v) => onFilterChange("complianceFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-compliance-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="conforme">Conforme</SelectItem>
                <SelectItem value="nao_conforme">Não Conforme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CTR Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">CTR</Label>
            <Select value={filters.ctrFilter} onValueChange={(v) => onFilterChange("ctrFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-ctr-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">&lt;1% (Baixo)</SelectItem>
                <SelectItem value="medium">1-3% (Médio)</SelectItem>
                <SelectItem value="high">&gt;3% (Alto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Impressions Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Impressões</Label>
            <Select value={filters.impressionsFilter} onValueChange={(v) => onFilterChange("impressionsFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-impressions-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">&lt;1k (Baixo)</SelectItem>
                <SelectItem value="medium">1k-10k (Médio)</SelectItem>
                <SelectItem value="high">&gt;10k (Alto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clicks Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Cliques</Label>
            <Select value={filters.clicksFilter} onValueChange={(v) => onFilterChange("clicksFilter", v)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800" data-testid="select-clicks-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">&lt;50 (Baixo)</SelectItem>
                <SelectItem value="medium">50-500 (Médio)</SelectItem>
                <SelectItem value="high">&gt;500 (Alto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear All Filters */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 invisible">Ações</Label>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="w-full h-10"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar Filtros
              </Button>
            ) : (
              <div className="h-10" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.searchTerm !== "" || 
    filters.statusFilter !== "all" || 
    filters.campaignFilter !== "all" || 
    filters.adSetFilter !== "all" || 
    filters.platformFilter !== "all" || 
    filters.analysisFilter !== "all" || 
    filters.complianceFilter !== "all" || 
    filters.ctrFilter !== "all" || 
    filters.impressionsFilter !== "all" || 
    filters.clicksFilter !== "all"
  );
}

export const defaultFilters: FilterState = {
  searchTerm: "",
  statusFilter: "all",
  campaignFilter: "all",
  adSetFilter: "all",
  platformFilter: "all",
  analysisFilter: "all",
  complianceFilter: "all",
  ctrFilter: "all",
  impressionsFilter: "all",
  clicksFilter: "all",
};
