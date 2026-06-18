import { useState, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreativePerformance, TopCreative } from "@/hooks/useCreativePerformance";
import { supabase } from "@/integrations/supabase/client";
import {
    BarChart3,
    Lightbulb,
    Target,
    TrendingUp,
    MousePointer,
    Eye,
    Video,
    Image as ImageIcon,
    AlertTriangle,
    DollarSign
} from "lucide-react";

interface FormatAnalysisDrawerProps {
    format: 'video' | 'image';
    data: CreativePerformance & { count: number; performance_score: number };
    otherData: CreativePerformance & { count: number; performance_score: number };
    topCreatives: TopCreative[];
    children?: React.ReactNode;
}

export function FormatAnalysisDrawer({ format, data, otherData, topCreatives, children }: FormatAnalysisDrawerProps) {
    const isVideo = format === 'video';
    const title = isVideo ? 'Análise de Vídeos' : 'Análise de Imagens';
    const Icon = isVideo ? Video : ImageIcon;
    const colorClass = isVideo ? 'text-violet-500' : 'text-blue-500';

    const [narrative, setNarrative] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchNarrative = async () => {
            setLoading(true);
            setError(false);
            try {
                // Prepare data for the Edge Function
                const payload = {
                    format,
                    data,
                    otherData,
                    topCreatives
                };

                const { data: aiResponse, error } = await supabase.functions.invoke('format-analysis', {
                    body: payload
                });

                if (error) throw error;

                if (aiResponse?.insights && Array.isArray(aiResponse.insights)) {
                    setNarrative(aiResponse.insights);
                } else if (aiResponse?.insights) {
                    // Handle case where insights might be a single string (fallback)
                    setNarrative([String(aiResponse.insights)]);
                } else {
                    throw new Error('Invalid response format');
                }

            } catch (err) {
                console.error("Failed to fetch AI narrative:", err);
                setError(true);
                // Fallback to basic logic if AI fails
                setNarrative(generateFallbackNarrative());
            } finally {
                setLoading(false);
            }
        };

        if (data && otherData) {
            fetchNarrative();
        }
    }, [format, data.cpa, otherData.cpa]);

    // Fallback logic kept for robustness (Original logic)
    const generateFallbackNarrative = () => {
        const points = [];

        // 1. Efficiency Insight
        if (data.cpa > 0 && otherData.cpa > 0) {
            if (data.cpa < otherData.cpa) {
                const diff = ((otherData.cpa - data.cpa) / otherData.cpa) * 100;
                points.push(`Este formato está entregando conversões **${diff.toFixed(0)}% mais baratas** que o concorrente.`);
            } else {
                const diff = ((data.cpa - otherData.cpa) / data.cpa) * 100;
                points.push(`O custo por conversão está **${diff.toFixed(0)}% maior** neste formato.`);
            }
        }

        // 2. Engagement Insight
        if (data.ctr > 0 && otherData.ctr > 0) {
            if (data.ctr > otherData.ctr) {
                const diff = (data.ctr / otherData.ctr);
                points.push(`O engajamento (CTR) é **${diff.toFixed(1)}x superior**, indicando maior interesse do público.`);
            } else if (data.ctr < otherData.ctr) {
                points.push(`O engajamento é menor, sugerindo que os criativos podem estar fadigados ou menos atrativos no feed.`);
            }
        }

        // 3. Scale Insight
        if (data.conversions > otherData.conversions) {
            points.push(`É o formato dominante em volume, responsável por **${Math.round((data.conversions / (data.conversions + otherData.conversions)) * 100)}%** das conversões totais.`);
        }

        // Fallback
        if (points.length === 0) {
            points.push("Métricas insuficientes para gerar uma narrativa detalhada no momento.");
        }

        return points;
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                {children || <Button variant="outline" size="sm">Ver Análise</Button>}
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="pb-6 border-b">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2.5 rounded-xl bg-muted ${colorClass}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl font-bold">{title}</SheetTitle>
                            <SheetDescription>
                                Análise consolidada de <span className="font-semibold text-foreground">{data.count} criativos</span> em todas as campanhas.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="py-6 space-y-8">
                    {/* AI Narrative Section */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                <span>Diagnóstico da IA</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground">
                                Escopo: Conta Geral
                            </Badge>
                        </div>
                        <Card className="bg-muted/30 border-none shadow-none">
                            <CardContent className="p-4 space-y-3">
                                {loading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-[90%]" />
                                        <Skeleton className="h-4 w-[80%]" />
                                    </div>
                                ) : error && narrative.length <= 1 ? ( // Basic check if specialized AI failed
                                    <div className="space-y-3">
                                        <div className="text-xs text-amber-600/80 flex items-center gap-2">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span>IA indisponível. Exibindo análise básica:</span>
                                        </div>
                                        {narrative.map((point, idx) => (
                                            <div key={idx} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                                                <span dangerouslySetInnerHTML={{
                                                    __html: point.replace(/\*\*(.*?)\*\*/g, '<span class="text-foreground font-semibold">$1</span>')
                                                }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    narrative.map((point, idx) => (
                                        <div key={idx} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                                            <span dangerouslySetInnerHTML={{
                                                __html: point.replace(/\*\*(.*?)\*\*/g, '<span class="text-foreground font-semibold">$1</span>')
                                            }} />
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {/* Detailed Metrics Grid */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <BarChart3 className="w-4 h-4" />
                            <span>Métricas Detalhadas (Média Global)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <MetricCard label="CPM" value={data.cpm} format="currency" icon={Eye} />
                            <MetricCard label="CPC" value={data.cpc} format="currency" icon={MousePointer} />
                            <MetricCard label="CTR" value={data.ctr} format="percent" icon={TrendingUp} />
                            <MetricCard label="Custo / Conv." value={data.cpa} format="currency" icon={Target} highlight />
                        </div>
                    </section>

                    {/* Top Creatives Gallery */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <Target className="w-4 h-4" />
                            <span>Top 3 Criativos (Campeões da Conta)</span>
                        </div>

                        {topCreatives.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {topCreatives.map((creative) => {
                                    // Helper to format clean names
                                    const cleanName = (name: string) => {
                                        return name
                                            .replace(/[_-]/g, ' ') // Replace underscores/hyphens with spaces
                                            .replace(/\.(mp4|jpg|png|jpeg|mov|gif|webp)$/i, '') // Remove extensions
                                            .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
                                            .trim()
                                            .replace(/\b\w/g, c => c.toUpperCase()) // Title Case
                                            .replace(/^(Img|Video|Carrossel)\s+/i, ''); // Remove prefixes
                                    };

                                    return (
                                        <div key={creative.id} className="flex gap-4 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-all duration-300 group">
                                            {/* Media Preview Container */}
                                            <div className="w-24 h-24 rounded-lg bg-muted/50 flex-shrink-0 overflow-hidden relative border shadow-sm group-hover:shadow-md transition-all">
                                                {creative.imageUrl ? (
                                                    <img src={creative.imageUrl} alt={creative.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : creative.videoUrl ? (
                                                    <div className="w-full h-full relative">
                                                        <video
                                                            src={creative.videoUrl}
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            muted
                                                            playsInline
                                                            loop
                                                            onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => { })}
                                                            onMouseOut={e => {
                                                                const el = e.target as HTMLVideoElement;
                                                                el.pause();
                                                                el.currentTime = 0;
                                                            }}
                                                        />
                                                        {/* Play Button Overlay */}
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                                                                <Video className="w-3.5 h-3.5 text-white/90 fill-white/20" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                                                        <Icon className="w-8 h-8 text-muted-foreground/20 mb-1" />
                                                        <span className="text-[9px] text-muted-foreground/40 font-medium tracking-wide uppercase">Sem Preview</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Creative Details */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-foreground/90 truncate pr-2 group-hover:text-primary transition-colors">
                                                        {cleanName(creative.name)}
                                                    </h4>
                                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider font-mono">
                                                        {isVideo ? 'Formato: Reels (9:16)' : 'Formato: Feed (1:1)'}
                                                    </p>
                                                </div>

                                                <div className="flex items-end justify-between mt-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">Resultado</span>
                                                            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground/80">
                                                                <Target className="w-3 h-3 text-${colorClass.split('-')[1]}-500/70" />
                                                                {creative.conversions}
                                                            </div>
                                                        </div>
                                                        <div className="w-px h-6 bg-border/50" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">Gasto</span>
                                                            <div className="flex items-center gap-1 text-xs font-mono font-medium text-foreground/80">
                                                                {formatCurrency(creative.spend)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider mb-0.5">Custo / Conv.</span>
                                                        <Badge variant="outline" className={`font-mono text-xs px-2 py-0.5 border-${isVideo ? 'violet' : 'blue'}-500/20 bg-${isVideo ? 'violet' : 'blue'}-500/5 text-${isVideo ? 'violet' : 'blue'}-600 dark:text-${isVideo ? 'violet' : 'blue'}-400 hover:bg-${isVideo ? 'violet' : 'blue'}-500/10`}>
                                                            {formatCurrency(creative.spend / (creative.conversions || 1))}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
                                Nenhum criativo campeão identificado neste formato.
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function MetricCard({ label, value, format, icon: Icon, highlight = false }: { label: string, value: number, format: 'currency' | 'percent', icon: any, highlight?: boolean }) {
    const formatted = format === 'currency'
        ? formatCurrency(value)
        : `${value.toFixed(2)}%`;

    return (
        <div className={`p-3 rounded-lg border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'}`}>
            <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className={`text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
                {formatted}
            </div>
        </div>
    );
}
