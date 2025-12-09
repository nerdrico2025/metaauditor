import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  onlyAnalyzed: boolean;
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
    filters.onlyAnalyzed || 
    filters.complianceFilter !== "all" || 
    filters.ctrFilter !== "all" || 
    filters.impressionsFilter !== "all" || 
    filters.clicksFilter !== "all";

  return (
    <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-6">
        {/* First row - Basic filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Buscar por nome ou ID..."
                value={filters.searchTerm}
                onChange={(e) => onFilterChange("searchTerm", e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800"
                data-testid="input-search-creatives"
              />
            </div>
          </div>
          
          <Select value={filters.campaignFilter} onValueChange={(v) => onFilterChange("campaignFilter", v)}>
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

          <Select value={filters.adSetFilter} onValueChange={(v) => onFilterChange("adSetFilter", v)}>
            <SelectTrigger className="w-full lg:w-[220px] bg-white dark:bg-gray-800" data-testid="select-adset-filter">
              <SelectValue placeholder="Todos Ad Sets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Grupos de Campanha</SelectItem>
              {adSets.map((adSet) => (
                <SelectItem key={adSet.id} value={adSet.id}>
                  {adSet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.platformFilter} onValueChange={(v) => onFilterChange("platformFilter", v)}>
            <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-platform-filter">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Plataformas</SelectItem>
              <SelectItem value="meta">Meta Ads</SelectItem>
              <SelectItem value="google">Google Ads</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.statusFilter} onValueChange={(v) => onFilterChange("statusFilter", v)}>
            <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-status-filter">
              <SelectValue placeholder="Veiculação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Veiculações</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Não está em veiculação">Não está em veiculação</SelectItem>
              <SelectItem value="Campanha Desativada">Campanha Desativada</SelectItem>
              <SelectItem value="Grupo Desativado">Grupo Desativado</SelectItem>
              <SelectItem value="Arquivado">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Second row - Analysis and Metrics filters */}
        <div className="flex flex-col lg:flex-row gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Only Analyzed Switch */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <Switch
              id="only-analyzed"
              checked={filters.onlyAnalyzed}
              onCheckedChange={(v) => onFilterChange("onlyAnalyzed", v)}
              data-testid="switch-only-analyzed"
            />
            <Label htmlFor="only-analyzed" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
              Apenas Analisados
            </Label>
          </div>

          {/* Compliance Filter */}
          <Select value={filters.complianceFilter} onValueChange={(v) => onFilterChange("complianceFilter", v)}>
            <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-compliance-filter">
              <SelectValue placeholder="Conformidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Conformidade</SelectItem>
              <SelectItem value="conforme">Conforme</SelectItem>
              <SelectItem value="nao_conforme">Não Conforme</SelectItem>
            </SelectContent>
          </Select>

          {/* CTR Filter */}
          <Select value={filters.ctrFilter} onValueChange={(v) => onFilterChange("ctrFilter", v)}>
            <SelectTrigger className="w-full lg:w-[160px] bg-white dark:bg-gray-800" data-testid="select-ctr-filter">
              <SelectValue placeholder="CTR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">CTR</SelectItem>
              <SelectItem value="low">Baixo (&lt;1%)</SelectItem>
              <SelectItem value="medium">Médio (1-3%)</SelectItem>
              <SelectItem value="high">Alto (&gt;3%)</SelectItem>
            </SelectContent>
          </Select>

          {/* Impressions Filter */}
          <Select value={filters.impressionsFilter} onValueChange={(v) => onFilterChange("impressionsFilter", v)}>
            <SelectTrigger className="w-full lg:w-[180px] bg-white dark:bg-gray-800" data-testid="select-impressions-filter">
              <SelectValue placeholder="Impressões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Impressões</SelectItem>
              <SelectItem value="low">Baixo (&lt;1k)</SelectItem>
              <SelectItem value="medium">Médio (1k-10k)</SelectItem>
              <SelectItem value="high">Alto (&gt;10k)</SelectItem>
            </SelectContent>
          </Select>

          {/* Clicks Filter */}
          <Select value={filters.clicksFilter} onValueChange={(v) => onFilterChange("clicksFilter", v)}>
            <SelectTrigger className="w-full lg:w-[160px] bg-white dark:bg-gray-800" data-testid="select-clicks-filter">
              <SelectValue placeholder="Cliques" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cliques</SelectItem>
              <SelectItem value="low">Baixo (&lt;50)</SelectItem>
              <SelectItem value="medium">Médio (50-500)</SelectItem>
              <SelectItem value="high">Alto (&gt;500)</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear All Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="w-full lg:w-auto"
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
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
    filters.onlyAnalyzed || 
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
  onlyAnalyzed: false,
  complianceFilter: "all",
  ctrFilter: "all",
  impressionsFilter: "all",
  clicksFilter: "all",
};
