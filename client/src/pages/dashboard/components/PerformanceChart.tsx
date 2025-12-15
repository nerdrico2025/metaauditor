import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Minus, CalendarIcon } from "lucide-react";
import { useMetaAccount } from "@/contexts/MetaAccountContext";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

type PeriodOption = 7 | 14 | 30 | 60 | 90 | 'custom';
type DateMode = 'single' | 'range';

const periodLabels: Record<number, string> = {
  7: '7 dias',
  14: '14 dias',
  30: '30 dias',
  60: '60 dias',
  90: '90 dias',
};

export default function PerformanceChart() {
  const { selectedAccountId } = useMetaAccount();
  const [period, setPeriod] = useState<PeriodOption>(7);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Applied values (used for query)
  const [appliedDateMode, setAppliedDateMode] = useState<DateMode>('range');
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(undefined);
  const [appliedSingleDate, setAppliedSingleDate] = useState<Date | undefined>(undefined);
  
  // Temporary values (used in calendar picker before applying)
  const [tempDateMode, setTempDateMode] = useState<DateMode>('range');
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [tempSingleDate, setTempSingleDate] = useState<Date | undefined>(undefined);
  
  const buildQueryUrl = () => {
    let url = '/api/dashboard/daily-metrics';
    const params = new URLSearchParams();
    
    if (selectedAccountId) {
      params.set('integrationId', selectedAccountId);
    }
    
    if (period === 'custom') {
      if (appliedDateMode === 'single' && appliedSingleDate) {
        params.set('startDate', format(appliedSingleDate, 'yyyy-MM-dd'));
        params.set('endDate', format(appliedSingleDate, 'yyyy-MM-dd'));
      } else if (appliedDateMode === 'range' && appliedDateRange?.from && appliedDateRange?.to) {
        params.set('startDate', format(appliedDateRange.from, 'yyyy-MM-dd'));
        params.set('endDate', format(appliedDateRange.to, 'yyyy-MM-dd'));
      }
    } else if (typeof period === 'number') {
      params.set('period', period.toString());
    }
    
    return params.toString() ? `${url}?${params.toString()}` : url;
  };
  
  const { data: metrics, isLoading } = useQuery<DailyMetric[]>({
    queryKey: ["/api/dashboard/daily-metrics", { integrationId: selectedAccountId, period, appliedDateRange, appliedSingleDate, appliedDateMode }],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const url = buildQueryUrl();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao carregar métricas diárias');
      return res.json();
    },
  });

  const totalSpend = metrics?.reduce((sum, m) => sum + m.spend, 0) || 0;
  const totalImpressions = metrics?.reduce((sum, m) => sum + m.impressions, 0) || 0;
  const totalClicks = metrics?.reduce((sum, m) => sum + m.clicks, 0) || 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const maxSpend = Math.max(...(metrics?.map(m => m.spend) || [1]));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const getPeriodLabel = () => {
    if (period === 'custom') {
      if (appliedDateMode === 'single' && appliedSingleDate) {
        return format(appliedSingleDate, 'dd/MM/yyyy', { locale: ptBR });
      }
      if (appliedDateMode === 'range' && appliedDateRange?.from && appliedDateRange?.to) {
        const days = differenceInDays(appliedDateRange.to, appliedDateRange.from) + 1;
        return `${format(appliedDateRange.from, 'dd/MM', { locale: ptBR })} - ${format(appliedDateRange.to, 'dd/MM', { locale: ptBR })} (${days}d)`;
      }
    }
    return periodLabels[period as number] || '7 dias';
  };

  const handlePeriodChange = (newPeriod: PeriodOption) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setAppliedDateRange(undefined);
      setAppliedSingleDate(undefined);
      setShowCalendar(false);
    } else {
      // Initialize temp values from applied values
      setTempDateMode(appliedDateMode);
      setTempDateRange(appliedDateRange);
      setTempSingleDate(appliedSingleDate);
      setShowCalendar(true);
    }
  };

  const handleCalendarOpen = (open: boolean) => {
    if (open) {
      // Reset temp values when opening
      setTempDateMode(appliedDateMode);
      setTempDateRange(appliedDateRange);
      setTempSingleDate(appliedSingleDate);
    }
    setShowCalendar(open);
  };

  const handleModeChange = (mode: DateMode) => {
    setTempDateMode(mode);
    setTempDateRange(undefined);
    setTempSingleDate(undefined);
  };

  const handleApply = () => {
    setAppliedDateMode(tempDateMode);
    setAppliedDateRange(tempDateRange);
    setAppliedSingleDate(tempSingleDate);
    setPeriod('custom');
    setShowCalendar(false);
  };

  const handleCancel = () => {
    setTempDateMode(appliedDateMode);
    setTempDateRange(appliedDateRange);
    setTempSingleDate(appliedSingleDate);
    setShowCalendar(false);
    if (!appliedDateRange && !appliedSingleDate) {
      setPeriod(7);
    }
  };

  const canApply = () => {
    if (tempDateMode === 'single') return !!tempSingleDate;
    return tempDateRange?.from && tempDateRange?.to;
  };

  const getInstructions = () => {
    if (tempDateMode === 'single') {
      return tempSingleDate 
        ? format(tempSingleDate, "dd/MM/yyyy", { locale: ptBR })
        : "Clique em uma data";
    }
    if (tempDateRange?.from) {
      return tempDateRange.to 
        ? `${format(tempDateRange.from, "dd/MM/yyyy", { locale: ptBR })} até ${format(tempDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
        : "Agora selecione a data final";
    }
    return "Clique na data inicial";
  };

  return (
    <Card className="bg-white dark:bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200 bg-white dark:bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-lg font-medium text-slate-900">
            Performance - {getPeriodLabel()}
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {[7, 14, 30, 60, 90].map((days) => (
              <Button
                key={days}
                variant={period === days ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handlePeriodChange(days as PeriodOption)}
                data-testid={`period-${days}d`}
              >
                {days}d
              </Button>
            ))}
            <Popover open={showCalendar} onOpenChange={handleCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={period === 'custom' ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => handlePeriodChange('custom')}
                  data-testid="period-custom"
                >
                  <CalendarIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">Período</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
                <div className="p-3 border-b space-y-3">
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        tempDateMode === 'single' 
                          ? 'bg-white shadow-sm text-slate-900 font-medium' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => handleModeChange('single')}
                    >
                      Data específica
                    </button>
                    <button
                      className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        tempDateMode === 'range' 
                          ? 'bg-white shadow-sm text-slate-900 font-medium' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => handleModeChange('range')}
                    >
                      Intervalo de datas
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {getInstructions()}
                  </p>
                </div>
                
                {tempDateMode === 'single' ? (
                  <Calendar
                    mode="single"
                    selected={tempSingleDate}
                    onSelect={setTempSingleDate}
                    locale={ptBR}
                    disabled={(date: Date) => date > new Date()}
                  />
                ) : (
                  <Calendar
                    mode="range"
                    selected={tempDateRange}
                    onSelect={setTempDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    disabled={(date: Date) => date > new Date()}
                    defaultMonth={new Date(new Date().setMonth(new Date().getMonth() - 1))}
                  />
                )}
                
                <div className="p-3 border-t flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canApply()}
                    onClick={handleApply}
                  >
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-32" />
          </div>
        ) : metrics && metrics.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Investimento Total</p>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(totalSpend)}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Impressões</p>
                <p className="text-lg font-semibold text-purple-600">{formatNumber(totalImpressions)}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Cliques</p>
                <p className="text-lg font-semibold text-green-600">{formatNumber(totalClicks)}</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">CTR Médio</p>
                <p className="text-lg font-semibold text-orange-600">{avgCtr.toFixed(2)}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">Investimento por dia</p>
              <div className="flex items-end justify-between h-24 gap-1">
                {metrics.map((day, index) => {
                  const height = maxSpend > 0 ? (day.spend / maxSpend) * 100 : 0;
                  const date = new Date(day.date);
                  const dayLabel = metrics.length <= 14 
                    ? date.toLocaleDateString('pt-BR', { weekday: 'short' })
                    : date.toLocaleDateString('pt-BR', { day: '2-digit' });
                  
                  return (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${format(date, 'dd/MM/yyyy')}: ${formatCurrency(day.spend)}`}
                      />
                      {metrics.length <= 31 && (
                        <span className="text-xs text-slate-400 mt-1 capitalize truncate w-full text-center">
                          {dayLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Minus className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Sem dados de performance</p>
            <p className="text-xs text-slate-500">Sincronize suas campanhas para ver as métricas</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
