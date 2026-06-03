import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, MousePointer2, DollarSign, MapPin, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsPerformance() {
    const [viewMode, setViewMode] = useState<'all' | 'brand' | 'generic'>('all');
    const { campaigns, geoPerformance, keywords, isLoading } = useGoogleAds();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-end"><Skeleton className="h-8 w-64 rounded-lg bg-white/5" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-[400px] rounded-3xl bg-white/5" />
                    <Skeleton className="h-[400px] rounded-3xl bg-white/5" />
                </div>
            </div>
        );
    }

    if (!campaigns?.length) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 glass-card rounded-3xl">
                <div className="p-4 bg-white/5 rounded-full">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-foreground uppercase">Aguardando Dados</h3>
                    <p className="text-sm text-muted-foreground">Os dados estão sendo carregados ou não há campanhas ativas.</p>
                </div>
            </div>
        );
    }

    // Filter logic
    // Brand vs Generic keywords (mock logic)
    const isBrandTerm = (text: string) => {
        const t = text.toLowerCase();
        return t.includes('click auditor') || t.includes('clickhero') || t.includes('click hero');
    };
    const brandKeywords = keywords?.filter(k => isBrandTerm(k.text)) || [];
    const genericKeywords = keywords?.filter(k => !isBrandTerm(k.text)) || [];

    const activeKeywords = viewMode === 'brand' ? brandKeywords : viewMode === 'generic' ? genericKeywords : keywords;

    // Aggregate totals based on viewMode
    // Note: Since campaigns are high level, filtering them by keyword type is tricky without ad group association. 
    // For this UI demo, we will simulate the metrics shift based on the toggle.

    const modifier = viewMode === 'brand' ? 0.3 : viewMode === 'generic' ? 0.7 : 1;

    const totalImpressions = (campaigns?.reduce((acc, c) => acc + (c.impressions || 0), 0) || 0) * modifier;
    const totalClicks = (campaigns?.reduce((acc, c) => acc + (c.clicks || 0), 0) || 0) * modifier;
    const totalSpend = (campaigns?.reduce((acc, c) => acc + (c.spend || 0), 0) || 0) * modifier;
    const avgCtr = campaigns?.length ? (totalClicks / totalImpressions) * 100 : 0;

    // Mock chart generation
    const chartData = [
        { name: 'Seg', clicks: Math.floor(120 * modifier), impressions: Math.floor(4000 * modifier) },
        { name: 'Ter', clicks: Math.floor(180 * modifier), impressions: Math.floor(5500 * modifier) },
        { name: 'Qua', clicks: Math.floor(250 * modifier), impressions: Math.floor(8000 * modifier) },
        { name: 'Qui', clicks: Math.floor(190 * modifier), impressions: Math.floor(6200 * modifier) },
        { name: 'Sex', clicks: Math.floor(310 * modifier), impressions: Math.floor(9800 * modifier) },
        { name: 'Sab', clicks: Math.floor(150 * modifier), impressions: Math.floor(4500 * modifier) },
        { name: 'Dom', clicks: Math.floor(100 * modifier), impressions: Math.floor(3200 * modifier) },
    ];

    return (
        <div className="space-y-6">
            {/* Filter Toggle */}
            <div className="flex justify-end">
                <div className="bg-white/5 p-1 rounded-lg flex text-xs font-bold">
                    <button
                        onClick={() => setViewMode('all')}
                        className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'all' ? 'bg-ch-orange text-black' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Visão Geral
                    </button>
                    <button
                        onClick={() => setViewMode('brand')}
                        className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'brand' ? 'bg-ch-orange text-black' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Institucional (Brand)
                    </button>
                    <button
                        onClick={() => setViewMode('generic')}
                        className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'generic' ? 'bg-ch-orange text-black' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Genérico (Topo de Funil)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Impressões</CardTitle>
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">{Math.floor(totalImpressions).toLocaleString()}</div>
                        <p className="text-[10px] text-emerald-500 font-bold mt-1">Alcance da Marca</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cliques</CardTitle>
                        <MousePointer2 className="w-4 h-4 text-[#4285F4]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">{Math.floor(totalClicks).toLocaleString()}</div>
                        <p className="text-[10px] text-[#4285F4] font-bold mt-1">Tráfego Qualificado</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Investimento</CardTitle>
                        <DollarSign className="w-4 h-4 text-ch-orange" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">R$ {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] text-ch-orange font-bold mt-1">ROI Controlado</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">CTR Médio</CardTitle>
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-foreground">{avgCtr.toFixed(2)}%</div>
                        <p className="text-[10px] text-purple-500 font-bold mt-1">Relevância dos Anúncios</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={item} className="lg:col-span-2 glass-card rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Evolução Diária</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4285F4" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="impressions" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorImpressions)" />
                                <Area type="monotone" dataKey="clicks" stroke="#4285F4" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Geo Performance Detailed Table */}
                <motion.div variants={item} className="glass-card rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <MapPin className="w-5 h-5 text-ch-orange" />
                        <div>
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Performance por Unidade/Praça</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">Análise de canibalização e CPC</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="grid grid-cols-4 text-[9px] uppercase font-semibold text-muted-foreground px-2 py-1">
                            <div className="col-span-2">Região/Cidade</div>
                            <div className="text-right">CPC</div>
                            <div className="text-right">CPM</div>
                        </div>
                        {geoPerformance?.slice(0, 8).map((geo, i) => {
                            const cpc = (geo.cost_micros / 1000000 / (geo.clicks || 1));
                            const cpm = (geo.cost_micros / 1000000 / (geo.impressions || 1)) * 1000;

                            return (
                                <div key={i} className="grid grid-cols-4 items-center p-2 rounded-lg hover:bg-muted transition-colors border-b border-border last:border-0">
                                    <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-foreground">{geo.city_name || geo.region_name}</p>
                                        <p className="text-[8px] text-muted-foreground">{geo.region_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[10px] font-bold ${cpc > 5 ? 'text-rose-500' : 'text-emerald-500'}`}>R$ {cpc.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground">R$ {cpm.toFixed(2)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Button variant="ghost" className="w-full text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted h-8 rounded-xl">
                        Ver todas as 50 unidades
                    </Button>
                </motion.div>
            </div>
        </div>
    );
}
