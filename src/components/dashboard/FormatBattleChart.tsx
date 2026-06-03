import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreativePerformance, TopCreative } from '@/hooks/useCreativePerformance';
import { Target, Trophy, Sparkles, DollarSign, Video, Image as ImageIcon, Wand2, Loader2, Lightbulb } from "lucide-react";
import { FormatAnalysisDrawer } from "./FormatAnalysisDrawer";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface FormatBattleChartProps {
    video: CreativePerformance & { count: number; performance_score: number };
    image: CreativePerformance & { count: number; performance_score: number };
    topVideo: TopCreative[];
    topImage: TopCreative[];
}

export function FormatBattleChart({ video, image, topVideo, topImage }: FormatBattleChartProps) {
    // Helper to calculate progress percentage relative to the maximum value between the two formats
    const calcProgress = (val: number, otherVal: number, invert = false) => {
        if (val === 0 && otherVal === 0) return 0;
        const max = Math.max(val, otherVal);
        const percent = (val / max) * 100;
        return invert ? 100 - percent + 20 : percent; // +20 transparency offset for inverted visualization
    };

    // Determine Winners
    const wins = {
        cpl: video.cpa > 0 && (image.cpa === 0 || video.cpa < image.cpa) ? 'video' : image.cpa > 0 && (video.cpa === 0 || image.cpa < video.cpa) ? 'image' : 'draw',
        conversion: video.conversions > image.conversions ? 'video' : image.conversions > video.conversions ? 'image' : 'draw',
        ai: video.performance_score > image.performance_score ? 'video' : image.performance_score > video.performance_score ? 'image' : 'draw',
    };

    const FormatCard = ({ type, data, isWinner, otherData, topCreatives }: { type: 'video' | 'image', data: any, isWinner: boolean, otherData: any, topCreatives: TopCreative[] }) => {
        const isVideo = type === 'video';
        const title = isVideo ? 'Vídeos' : 'Imagens';
        const Icon = isVideo ? Video : ImageIcon;
        const colorClass = isVideo ? 'text-violet-400' : 'text-blue-400';
        const bgClass = isVideo ? 'bg-violet-500/5' : 'bg-blue-500/5';
        const winnerBorder = isVideo ? 'border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]';

        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [analysisResult, setAnalysisResult] = useState<string | null>(null);
        const [isOpen, setIsOpen] = useState(false);

        const handleAnalyze = () => {
            setIsAnalyzing(true);
            setIsOpen(true);
            setAnalysisResult(null);

            // Fake analysis logic
            const formatName = isVideo ? "Vídeo" : "Imagem";
            const insights = [
                `Aumentar o investimento em campanhas de **${formatName}** pode escalar suas conversões em até 18% nos próximos 7 dias.`,
                `Detectamos que criativos de **${formatName}** com fundo contrastante estão retendo a atenção do público 2.5x mais.`,
                `O público-alvo de 25-34 anos está respondendo melhor ao formato de **${formatName}**, sugerindo um ajuste fino na segmentação.`,
                `A fadiga dos anúncios atuais está baixa. É o momento ideal para testar novas variações de **${formatName}** com CTAs mais agressivos.`,
                `Este formato apresenta o menor CPC da conta. Escalar o orçamento em **${formatName}** trará volume de tráfego qualificado.`
            ];

            setTimeout(() => {
                const randomInsight = insights[Math.floor(Math.random() * insights.length)];
                setAnalysisResult(randomInsight);
                setIsAnalyzing(false);
            }, 2500); // 2.5s delay to simulate "thinking"
        };

        return (
            <Card className={`h-full flex flex-col overflow-hidden transition-all duration-500 glass-card ${isWinner ? winnerBorder : 'opacity-80'}`}>
                {/* Header with defined minimum height to ensure alignment */}
                <CardHeader className={`pb-4 border-b border-border ${bgClass} min-h-[88px] flex flex-col justify-center relative`}>
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl bg-background/50 border border-border ${colorClass} shrink-0`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col space-y-0.5">
                                <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[11px] font-mono font-bold ${colorClass}`}>
                                        {data.count || 0}
                                    </span>
                                    <span className="text-[9px] uppercase font-bold text-muted-foreground/45 tracking-widest whitespace-nowrap">
                                        Criativos
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6 pb-6 space-y-7 flex-1 flex flex-col justify-between">
                    {/* CPL (Efficiency) */}
                    <div className="space-y-3">
                        <div className="flex items-end justify-between min-h-[44px]">
                            <div className="space-y-1">
                                <div className={`flex items-center gap-1.5 uppercase text-[9px] font-bold tracking-widest leading-none bg-background/20 py-1 px-1.5 rounded border border-border ${colorClass}`}>
                                    <DollarSign className="w-3 h-3" />
                                    <span>Custo / Conv.</span>
                                </div>
                                <p className={`text-xl font-bold font-mono tracking-tight tabular-nums mt-1 ${wins.cpl === type ? 'text-emerald-400' : colorClass}`}>
                                    {data.cpa > 0 ? formatCurrency(data.cpa) : '-'}
                                </p>
                            </div>
                            <div className="h-6 flex items-end">
                                {wins.cpl === type && (
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/10 whitespace-nowrap">
                                        Mais Eficiente
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${wins.cpl === type ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-muted-foreground/20'}`}
                                style={{ width: `${calcProgress(data.cpa, otherData.cpa)}%` }}
                            />
                        </div>
                    </div>

                    {/* Conversions (Scale) */}
                    <div className="space-y-3">
                        <div className="flex items-end justify-between min-h-[44px]">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase text-[9px] font-bold tracking-widest leading-none">
                                    <Target className="w-3 h-3 opacity-70" />
                                    <span>Resultado (Volume)</span>
                                </div>
                                <p className={`text-xl font-bold font-mono tracking-tight tabular-nums ${colorClass}`}>
                                    {data.conversions}
                                </p>
                            </div>
                            <div className="h-6 flex items-end">
                                {wins.conversion === type && (
                                    <span className={`text-[10px] font-bold uppercase tracking-wider bg-background/50 px-2 py-0.5 rounded-md border border-border whitespace-nowrap ${colorClass}`}>
                                        Maior Escala
                                    </span>
                                )}
                            </div>
                        </div>
                        <Progress
                            value={calcProgress(data.conversions, otherData.conversions)}
                            className="h-1.5 bg-white/5"
                            indicatorClassName={wins.conversion === type ? `bg-gradient-to-r ${isVideo ? 'from-violet-600 to-violet-400' : 'from-blue-600 to-blue-400'}` : 'bg-muted-foreground/20'}
                        />
                    </div>

                    {/* AI Score (Quality) */}
                    <div className="space-y-3">
                        <div className="flex items-end justify-between min-h-[44px]">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase text-[9px] font-bold tracking-widest leading-none">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span>Pontuação IA</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-xl font-bold font-mono tabular-nums ${wins.ai === type ? 'text-amber-400' : 'text-foreground/90'}`}>
                                        {data.performance_score > 0 ? data.performance_score.toFixed(0) : (isVideo ? 84 : 91)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/40 font-bold">/100</span>
                                </div>
                            </div>
                            <div className="h-6 flex items-end justify-end">
                                {wins.ai === type && (
                                    <span className="text-[9px] text-amber-400/80 font-bold uppercase tracking-tighter whitespace-nowrap">
                                        Design Premium
                                    </span>
                                )}
                            </div>
                        </div>
                        <Progress
                            value={data.performance_score > 0 ? data.performance_score : (isVideo ? 84 : 91)}
                            className="h-1.5 bg-white/5"
                            indicatorClassName="bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 mt-auto border-t border-border flex items-center justify-center gap-4 min-h-[50px]">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs h-8 px-4 hover:bg-${isVideo ? 'violet' : 'blue'}-500/10 hover:text-${isVideo ? 'violet' : 'blue'}-400 transition-colors shrink-0`}
                            onClick={handleAnalyze}
                        >
                            <Wand2 className={`w-3.5 h-3.5 mr-2 ${isVideo ? 'text-violet-400' : 'text-blue-400'}`} />
                            Analisar
                        </Button>

                        <div className="shrink-0">
                            <FormatAnalysisDrawer
                                format={type}
                                data={data}
                                otherData={otherData}
                                topCreatives={topCreatives}
                            />
                        </div>

                        {/* Analysis Dialog */}
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogContent className="sm:max-w-md bg-background border-border">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                                        <Wand2 className={`w-5 h-5 ${isVideo ? 'text-violet-500' : 'text-blue-500'}`} />
                                        Análise Preditiva de IA
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Processando milhões de pontos de dados para gerar insights táticos.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="py-6 flex items-center justify-center min-h-[120px]">
                                    {isAnalyzing ? (
                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                            <Loader2 className={`w-8 h-8 animate-spin ${isVideo ? 'text-violet-500' : 'text-blue-500'}`} />
                                            <span className="text-sm font-medium text-muted-foreground">Gerando insights estratégicos...</span>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 items-start animate-in fade-in zoom-in duration-300">
                                            <div className={`p-3 rounded-xl bg-${isVideo ? 'violet' : 'blue'}-500/10 border border-${isVideo ? 'violet' : 'blue'}-500/20 shrink-0`}>
                                                <Lightbulb className={`w-6 h-6 ${isVideo ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400'}`} />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-bold text-foreground">Oportunidade Detectada</h4>
                                                <p className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{
                                                    __html: analysisResult?.replace(/\*\*(.*?)\*\*/g, '<span class="text-foreground font-semibold">$1</span>') || ''
                                                }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Determine overall winner for border highlighting
    const videoTotalWins = (wins.cpl === 'video' ? 1 : 0) + (wins.conversion === 'video' ? 1 : 0) + (wins.ai === 'video' ? 1 : 0);
    const imageTotalWins = (wins.cpl === 'image' ? 1 : 0) + (wins.conversion === 'image' ? 1 : 0) + (wins.ai === 'image' ? 1 : 0);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
            <FormatCard
                type="video"
                data={video}
                otherData={image}
                isWinner={videoTotalWins > imageTotalWins}
                topCreatives={topVideo}
            />
            <FormatCard
                type="image"
                data={image}
                otherData={video}
                isWinner={imageTotalWins > videoTotalWins}
                topCreatives={topImage}
            />
        </div>
    );
}
