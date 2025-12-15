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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const buildQueryUrl = () => {
    let url = '/api/dashboard/daily-metrics';
    const params = new URLSearchParams();
    
    if (selectedAccountId) {
      params.set('integrationId', selectedAccountId);
    }
    
    if (period === 'custom' && dateRange?.from && dateRange?.to) {
      params.set('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      params.set('endDate', format(dateRange.to, 'yyyy-MM-dd'));
    } else if (typeof period === 'number') {
      params.set('period', period.toString());
    }
    
    return params.toString() ? `${url}?${params.toString()}` : url;
  };
  
  const { data: metrics, isLoading } = useQuery<DailyMetric[]>({
    queryKey: ["/api/dashboard/daily-metrics", { integrationId: selectedAccountId, period, dateRange }],
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
    if (period === 'custom' && dateRange?.from && dateRange?.to) {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })} (${days}d)`;
    }
    return periodLabels[period as number] || '7 dias';
  };

  const handlePeriodChange = (newPeriod: PeriodOption) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setDateRange(undefined);
      setShowCalendar(false);
    } else {
      setShowCalendar(true);
    }
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setShowCalendar(false);
    }
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
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
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
                <div className="p-3 border-b">
                  <p className="text-sm font-medium text-slate-700">Selecione o período</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        <>Selecione a data final</>
                      )
                    ) : (
                      <>Clique na data inicial</>
                    )}
                  </p>
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateSelect}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={(date: Date) => date > new Date()}
                  defaultMonth={new Date(new Date().setMonth(new Date().getMonth() - 1))}
                />
                <div className="p-3 border-t flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateRange(undefined);
                      setShowCalendar(false);
                      setPeriod(7);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dateRange?.from || !dateRange?.to}
                    onClick={() => setShowCalendar(false)}
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
