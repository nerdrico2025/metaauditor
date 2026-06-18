import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { HistoryStatusFilter } from '@/lib/auditHistoryFilters';

type HistoryScope = 'all' | 'creative' | 'campaign' | 'ad_set';

interface CampaignOption {
    id: string;
    name: string;
}

interface PerformanceHistoryFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    historyScope: HistoryScope;
    onHistoryScopeChange: (value: HistoryScope) => void;
    historyStatusFilter: HistoryStatusFilter;
    onHistoryStatusFilterChange: (value: HistoryStatusFilter) => void;
    historyCampaignId: string;
    onHistoryCampaignIdChange: (value: string) => void;
    historyCampaignOptions: CampaignOption[];
    statusCounts: {
        approved: number;
        rejected: number;
        pending: number;
        total: number;
    };
}

const STATUS_PILLS = [
    { v: 'all' as const, label: 'Todos', cls: '' },
    { v: 'approved' as const, label: 'Aprovados', cls: 'data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-500 data-[active=true]:border-emerald-500/30' },
    { v: 'rejected' as const, label: 'Reprovados', cls: 'data-[active=true]:bg-red-500/15 data-[active=true]:text-red-500 data-[active=true]:border-red-500/30' },
    { v: 'pending' as const, label: 'Pendentes', cls: 'data-[active=true]:bg-muted data-[active=true]:text-muted-foreground' },
];

function pillLabel(
    v: HistoryStatusFilter,
    base: string,
    statusCounts: PerformanceHistoryFiltersProps['statusCounts'],
): string {
    const n =
        v === 'all' ? statusCounts.total
            : v === 'approved' ? statusCounts.approved
                : v === 'rejected' ? statusCounts.rejected
                    : statusCounts.pending;
    return `${base} (${n})`;
}

export function PerformanceHistoryFilters({
    search,
    onSearchChange,
    historyScope,
    onHistoryScopeChange,
    historyStatusFilter,
    onHistoryStatusFilterChange,
    historyCampaignId,
    onHistoryCampaignIdChange,
    historyCampaignOptions,
    statusCounts,
}: PerformanceHistoryFiltersProps) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Localizar análise por nome..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 h-11 bg-card border-border rounded-xl"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <Select value={historyScope} onValueChange={(v) => onHistoryScopeChange(v as HistoryScope)}>
                    <SelectTrigger className="h-11 bg-card border-border rounded-xl text-xs font-medium">
                        <SelectValue placeholder="Escopo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        <SelectItem value="all" className="text-xs font-medium">Todos</SelectItem>
                        <SelectItem value="creative" className="text-xs font-medium">Anúncios</SelectItem>
                        <SelectItem value="campaign" className="text-xs font-medium">Campanhas</SelectItem>
                        <SelectItem value="ad_set" className="text-xs font-medium">Conjuntos</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {historyScope === 'campaign' && historyCampaignOptions.length > 0 && (
                <Select value={historyCampaignId} onValueChange={onHistoryCampaignIdChange}>
                    <SelectTrigger className="h-11 w-full md:w-72 bg-card border-border rounded-xl text-xs font-medium">
                        <SelectValue placeholder="Campanha" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        <SelectItem value="all" className="text-xs font-medium">
                            Todas as campanhas
                        </SelectItem>
                        {historyCampaignOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            <div className="flex items-center gap-2 flex-wrap">
                {STATUS_PILLS.map((opt) => {
                    const active = historyStatusFilter === opt.v;
                    return (
                        <button
                            key={opt.v}
                            type="button"
                            data-active={active}
                            onClick={() => onHistoryStatusFilterChange(opt.v)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                active
                                    ? 'bg-ch-orange/10 text-ch-orange border-ch-orange/30'
                                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground',
                                opt.cls,
                            )}
                        >
                            {pillLabel(opt.v, opt.label, statusCounts)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
