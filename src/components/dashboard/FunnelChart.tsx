import { ArrowUpRight, MousePointer, Eye, Target, ArrowRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";

interface FunnelData {
    impressions: number;
    clicks: number;
    conversions: number;
}

interface FunnelChartProps {
    data: FunnelData;
}

export function FunnelChart({ data }: FunnelChartProps) {
    // Calculate rates
    const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
    const conversionRate = data.clicks > 0 ? (data.conversions / data.clicks) * 100 : 0;

    const chartData = [
        { name: "Impressões", value: data.impressions, fill: "url(#colorImpressions)" },
        { name: "Cliques", value: data.clicks, fill: "url(#colorClicks)" },
        { name: "Resultado", value: data.conversions, fill: "url(#colorConversions)" }
    ];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-xl shadow-lg">
                    <p className="font-semibold text-popover-foreground mb-1">{label}</p>
                    <p className="text-sm text-muted-foreground">
                        {payload[0].value.toLocaleString('pt-BR')} eventos
                    </p>
                </div>
            );
        }
        return null;
    };

    const StepCard = ({
        icon: Icon,
        label,
        value,
        color,
        subValue,
        subLabel,
        isLast = false
    }: any) => {
        const colorClasses = {
            blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
            violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
            emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        };

        const gradientBorders = {
            blue: "border-l-4 border-l-blue-500",
            violet: "border-l-4 border-l-violet-500",
            emerald: "border-l-4 border-l-emerald-500"
        };

        return (
            <div className="relative flex-1 min-w-0">
                <div className={`
                h-full flex flex-col items-center justify-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl border bg-card
                hover:bg-muted/50 transition-colors shadow-sm ${gradientBorders[color as keyof typeof gradientBorders]}
             `}>
                    <div className={`p-1.5 md:p-2 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`}>
                        <Icon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>

                    <div className="text-center w-full">
                        <p className="text-[9px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5 md:mb-1">{label}</p>
                        <p className="text-lg md:text-2xl font-bold text-foreground truncate" title={`${value}`}>
                            {value}
                        </p>
                    </div>

                    {subValue && (
                        <div className={`
                        px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[9px] md:text-[10px] font-semibold flex items-center gap-0.5 md:gap-1
                        ${colorClasses[color as keyof typeof colorClasses]} border
                    `}>
                            <ArrowUpRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {subValue} {subLabel}
                        </div>
                    )}
                </div>

                {/* Arrow separator - visible only on md+ screens and if not last */}
                {!isLast && (
                    <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/20">
                        <ArrowRight className="w-6 h-6" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col gap-3 md:gap-4">
            {/* Top Cards Row — always horizontal (row), scales down on mobile */}
            <div className="flex flex-row gap-2 md:gap-4 justify-between">
                <StepCard
                    icon={Eye}
                    label="Impressões"
                    value={data.impressions >= 1000000
                        ? `${(data.impressions / 1000000).toFixed(1)}M`
                        : data.impressions >= 1000
                            ? `${(data.impressions / 1000).toFixed(0)}k`
                            : data.impressions}
                    color="blue"
                />

                <StepCard
                    icon={MousePointer}
                    label="Cliques"
                    value={data.clicks.toLocaleString('pt-BR')}
                    color="violet"
                    subValue={`${ctr.toFixed(2)}%`}
                    subLabel="CTR"
                />

                <StepCard
                    icon={Target}
                    label="Resultado"
                    value={data.conversions.toLocaleString('pt-BR')}
                    color="emerald"
                    subValue={`${conversionRate.toFixed(2)}%`}
                    subLabel="Conv."
                    isLast
                />
            </div>

            {/* Bottom Chart Row */}
            <div className="h-[90px] md:h-[120px] w-full mt-auto opacity-80 hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                        barSize={12}
                    >
                        <defs>
                            <linearGradient id="colorImpressions" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="colorClicks" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="colorConversions" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            width={80}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} background={{ fill: 'hsl(var(--muted)/0.1)' }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
