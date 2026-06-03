import { motion } from 'framer-motion';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Trophy, TrendingUp, Users } from 'lucide-react';

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsInsights() {
    const { auctionInsights, isLoading } = useGoogleAds();

    if (isLoading) return <div className="p-10 text-center text-muted-foreground">Carregando insights de leilão...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-card border-border md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-ch-blue" /> Domínio do Leilão
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">
                            {auctionInsights?.[0]?.impression_share}%
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Sua parcela de impressões</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" /> Concorrência Direta
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 overflow-x-auto pb-2">
                            {auctionInsights?.slice(1, 4).map((comp, i) => (
                                <div key={i} className="flex items-center gap-2 min-w-[150px]">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground uppercase">
                                        {comp.domain.substring(0, 2)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground truncate max-w-[100px]">{comp.domain}</p>
                                        <p className="text-[9px] font-bold text-ch-orange">{comp.overlap_rate}% Sobreposição</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <motion.div variants={item} className="glass-card rounded-3xl p-6 bg-card">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Análise de Competitividade</h3>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={auctionInsights as any[]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <YAxis dataKey="domain" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={120} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--popover-foreground)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, paddingTop: '20px' }} />
                            <Bar dataKey="impression_share" name="Parcela de Impressões" fill="#4285F4" radius={[0, 4, 4, 0]} barSize={20} />
                            <Bar dataKey="overlap_rate" name="Taxa de Sobreposição" fill="#F26922" radius={[0, 4, 4, 0]} barSize={20} />
                            <Bar dataKey="position_above_rate" name="Posição Superior" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    );
}
