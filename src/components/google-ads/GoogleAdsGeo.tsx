import { motion } from 'framer-motion';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MapPin,
    TrendingUp,
    DollarSign,
    Globe,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    AlertCircle
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsGeo() {
    const { geoPerformance, isLoading } = useGoogleAds();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-xl bg-white/5" />
                    <Skeleton className="h-32 rounded-xl bg-white/5" />
                    <Skeleton className="h-32 rounded-xl bg-white/5" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-[300px] rounded-3xl bg-white/5" />
                    <Skeleton className="h-[300px] rounded-3xl bg-white/5" />
                </div>
            </div>
        );
    }

    if (!geoPerformance?.length) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 glass-card rounded-3xl">
                <div className="p-4 bg-white/5 rounded-full">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-foreground uppercase">Aguardando Dados Geográficos</h3>
                    <p className="text-sm text-muted-foreground">Os dados estão sendo processados.</p>
                </div>
            </div>
        );
    }

    // Sort by clicks to get top performers
    const sortedGeo = [...(geoPerformance || [])].sort((a, b) => b.clicks - a.clicks);

    // Process data for charts
    const topCities = sortedGeo.slice(0, 10).map(geo => ({
        name: geo.city_name || geo.region_name,
        clicks: geo.clicks,
        cost: geo.cost_micros / 1000000,
        cpc: (geo.cost_micros / 1000000) / (geo.clicks || 1)
    }));

    const regionDataObj = sortedGeo.reduce((acc, curr) => {
        const region = curr.region_name || 'Desconhecido';
        if (!acc[region]) acc[region] = 0;
        acc[region] += curr.clicks;
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(regionDataObj).map(([name, value]) => ({ name, value }));
    const COLORS = ['#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];

    // Stats
    const totalCities = sortedGeo.length;
    const topCityName = topCities[0]?.name || '-';
    // Format large numbers with 'k'
    const formatNumber = (num: number) => {
        if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
        return num.toString();
    };
    const topCityClicks = formatNumber(topCities[0]?.clicks || 0);

    // Calculate best CPC (lowest > 0)
    const bestCpcGeo = sortedGeo.filter(g => g.clicks > 0).sort((a, b) => (a.cost_micros / a.clicks) - (b.cost_micros / b.clicks))[0];
    const bestCpcValue = bestCpcGeo ? ((bestCpcGeo.cost_micros / 1000000) / bestCpcGeo.clicks).toFixed(2) : '0.00';
    const bestCpcCity = bestCpcGeo?.city_name || '-';

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Top Cidade (Volume)</CardTitle>
                        <MapPin className="w-4 h-4 text-ch-orange" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">{topCityName}</div>
                        <p className="text-[10px] text-ch-orange font-bold mt-1 flex items-center">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            {topCityClicks} cliques
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Melhor Eficiência (CPC)</CardTitle>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">R$ {bestCpcValue}</div>
                        <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center">
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                            {bestCpcCity}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cobertura Geográfica</CardTitle>
                        <Globe className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">{totalCities}</div>
                        <p className="text-[10px] text-blue-500 font-bold mt-1">Cidades/Regiões Ativas</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={item} className="glass-card rounded-3xl p-6">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight mb-6 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Top 10 Cidades por Cliques
                    </h3>
                    <div className="h-[300px] w-full">
                        {topCities.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topCities} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                                        itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="clicks" name="Cliques" radius={[0, 4, 4, 0]} barSize={20} fill="#F97316" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Sem dados suficientes</div>
                        )}
                    </div>
                </motion.div>

                <motion.div variants={item} className="glass-card rounded-3xl p-6">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight mb-6 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Distribuição por Região
                    </h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                                    />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '10px', color: '#999' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Sem dados suficientes</div>
                        )}
                    </div>
                </motion.div>
            </div>

            <motion.div variants={item} className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-ch-orange" />
                        <div>
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Detalhamento por Unidade</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">Dados brutos de performance</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-bold tracking-widest border-border hover:bg-muted gap-2">
                        <Download className="w-3 h-3" />
                        Exportar CSV
                    </Button>
                </div>


                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                                <th className="py-3 px-4">Localidade</th>
                                <th className="py-3 px-4 text-right">Cliques</th>
                                <th className="py-3 px-4 text-right">Impressões</th>
                                <th className="py-3 px-4 text-right">Custo</th>
                                <th className="py-3 px-4 text-right">CPC Médio</th>
                                <th className="py-3 px-4 text-right">Conv.</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-medium text-foreground/80">
                            {geoPerformance?.map((geo, i) => (
                                <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors">
                                    <td className="py-3 px-4 font-bold text-white">{geo.city_name || geo.region_name} <span className="text-muted-foreground font-normal text-[10px] ml-1">({geo.region_name})</span></td>
                                    <td className="py-3 px-4 text-right">{geo.clicks}</td>
                                    <td className="py-3 px-4 text-right">{geo.impressions}</td>
                                    <td className="py-3 px-4 text-right">R$ {(geo.cost_micros / 1000000).toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right text-emerald-400">R$ {((geo.cost_micros / 1000000) / (geo.clicks || 1)).toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right">{geo.conversions}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
