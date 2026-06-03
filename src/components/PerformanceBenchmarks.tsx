import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Target,
    DollarSign,
    MousePointer,
    Eye,
    BarChart3,
    Loader2
} from 'lucide-react';

interface Benchmark {
    metric: string;
    label: string;
    value: number;
    benchmark: number;
    unit: string;
    isPercentage?: boolean;
    higherIsBetter?: boolean;
}

const INDUSTRY_BENCHMARKS = {
    ctr: 0.9, // 0.9% average CTR for Facebook ads
    cpc: 1.72, // $1.72 average CPC
    cpm: 11.54, // $11.54 average CPM
    conversion_rate: 9.21, // 9.21% average conversion rate
};

export default function PerformanceBenchmarks() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    const { data: metrics, isLoading } = useQuery({
        queryKey: ['performance-benchmarks', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const data = await fetchAllPaginated<any>(() =>
                supabase
                    .from('campaign_metrics')
                    .select('impressions, clicks, spend, conversions')
                    .eq('company_id', companyId)
            );

            // Aggregate metrics
            const totals = data.reduce(
                (acc, m) => ({
                    impressions: acc.impressions + (m.impressions || 0),
                    clicks: acc.clicks + (m.clicks || 0),
                    spend: acc.spend + (Number(m.spend) || 0),
                    conversions: acc.conversions + (m.conversions || 0),
                }),
                { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
            );

            return {
                ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
                cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
                cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
                conversion_rate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
            };
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });

    const benchmarks: Benchmark[] = [
        {
            metric: 'ctr',
            label: 'CTR',
            value: metrics?.ctr || 0,
            benchmark: INDUSTRY_BENCHMARKS.ctr,
            unit: '%',
            isPercentage: true,
            higherIsBetter: true,
        },
        {
            metric: 'cpc',
            label: 'CPC',
            value: metrics?.cpc || 0,
            benchmark: INDUSTRY_BENCHMARKS.cpc,
            unit: 'R$',
            higherIsBetter: false,
        },
        {
            metric: 'cpm',
            label: 'CPM',
            value: metrics?.cpm || 0,
            benchmark: INDUSTRY_BENCHMARKS.cpm,
            unit: 'R$',
            higherIsBetter: false,
        },
        {
            metric: 'conversion_rate',
            label: 'Taxa de Conversão',
            value: metrics?.conversion_rate || 0,
            benchmark: INDUSTRY_BENCHMARKS.conversion_rate,
            unit: '%',
            isPercentage: true,
            higherIsBetter: true,
        },
    ];

    const getPerformanceStatus = (benchmark: Benchmark) => {
        if (benchmark.value === 0) return { status: 'neutral', color: 'text-muted-foreground', icon: Minus };

        const percentDiff = ((benchmark.value - benchmark.benchmark) / benchmark.benchmark) * 100;
        const isGood = benchmark.higherIsBetter ? percentDiff > 0 : percentDiff < 0;

        if (Math.abs(percentDiff) < 10) {
            return { status: 'neutral', color: 'text-yellow-500', icon: Minus };
        }

        if (isGood) {
            return { status: 'good', color: 'text-green-500', icon: TrendingUp };
        }

        return { status: 'bad', color: 'text-red-500', icon: TrendingDown };
    };

    const formatValue = (benchmark: Benchmark) => {
        if (benchmark.isPercentage) {
            return `${benchmark.value.toFixed(2)}%`;
        }
        return `R$ ${benchmark.value.toFixed(2)}`;
    };

    const getIcon = (metric: string) => {
        switch (metric) {
            case 'ctr':
                return MousePointer;
            case 'cpc':
                return DollarSign;
            case 'cpm':
                return Eye;
            case 'conversion_rate':
                return Target;
            default:
                return BarChart3;
        }
    };

    if (isLoading) {
        return (
            <div className="glass rounded-xl p-6 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
            </div>
        );
    }

    return (
        <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-ch-orange" />
                    Benchmarks de Performance
                </h3>
                <span className="text-xs text-muted-foreground">vs. média do mercado</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {benchmarks.map((benchmark) => {
                    const status = getPerformanceStatus(benchmark);
                    const Icon = getIcon(benchmark.metric);
                    const StatusIcon = status.icon;

                    return (
                        <div key={benchmark.metric} className="bg-muted rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <StatusIcon className={`w-4 h-4 ${status.color}`} />
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                {formatValue(benchmark)}
                            </p>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">{benchmark.label}</p>
                                <p className="text-xs text-muted-foreground">
                                    Benchmark: {benchmark.isPercentage ? `${benchmark.benchmark}%` : `R$ ${benchmark.benchmark.toFixed(2)}`}
                                </p>
                            </div>
                            <div className="w-full bg-ch-gray rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full ${status.status === 'good'
                                            ? 'bg-green-500'
                                            : status.status === 'bad'
                                                ? 'bg-red-500'
                                                : 'bg-yellow-500'
                                        }`}
                                    style={{
                                        width: `${Math.min(100, Math.max(10, (benchmark.value / benchmark.benchmark) * 50))}%`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
