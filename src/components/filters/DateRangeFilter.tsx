import { Calendar, Info } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useDateFilter, DatePreset } from '@/contexts/DateFilterContext';

interface Props {
    className?: string;
}

export function DateRangeFilter({ className }: Props) {
    const { preset, setPreset, customRange, setCustomRange } = useDateFilter();

    return (
        <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Sobre o período"
                        >
                            <Info className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                        Os números podem divergir levemente do Gerenciador da Meta porque:
                        <ul className="mt-1 list-disc pl-4 space-y-0.5">
                            <li>O período termina <b>ontem</b> — a Meta não fecha o dia em curso.</li>
                            <li>Anúncios <b>arquivados</b> não entram nos relatórios; só ativos e pausados.</li>
                            <li>Sincronizamos os últimos <b>90 dias</b> da Meta.</li>
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {preset !== 'custom' ? (
                <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
                    <SelectTrigger className="h-8 w-[170px] text-xs border-border rounded-lg">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <SelectValue />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1d">Ontem</SelectItem>
                        <SelectItem value="7d">Últimos 7 dias</SelectItem>
                        <SelectItem value="15d">Últimos 15 dias</SelectItem>
                        <SelectItem value="30d">Últimos 30 dias</SelectItem>
                        <SelectItem value="60d">Últimos 60 dias</SelectItem>
                        <SelectItem value="90d">Últimos 90 dias</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                </Select>
            ) : (
                <div className="flex items-center gap-1">
                    <DatePickerWithRange
                        className="border-none shadow-none"
                        date={customRange}
                        onDateChange={setCustomRange}
                    />
                    <button
                        onClick={() => setPreset('30d')}
                        className="text-xs text-muted-foreground hover:text-foreground px-1"
                        aria-label="Limpar filtro de data"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}
