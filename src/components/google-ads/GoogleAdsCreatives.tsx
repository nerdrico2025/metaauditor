
import { motion } from 'framer-motion';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Image as ImageIcon,
    Video as VideoIcon,
    Type as TextIcon,
    Sparkles,
    Zap,
    BrainCircuit,
    Play,
    TrendingUp,
    Lightbulb
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsAICreatives() {
    const { ads, isLoading } = useGoogleAds();

    if (isLoading) return <div className="p-10 text-center text-muted-foreground">Processando análise de IA...</div>;

    // Simulate AI Analysis Data
    // In a real app, this would come from a backend processing video content
    const aiInsights = [
        {
            pattern: "Vídeo com Dança/Movimento",
            type: "Alta Retenção",
            score: 92,
            impact: "+45% em Conversão",
            description: "Anúncios que iniciam com movimento coreografado nos primeiros 3s retêm 2x mais usuários.",
            recommendation: "Replicar formato 'Dança' para campanhas de Topo de Funil."
        },
        {
            pattern: "Depoimento (User Generated Content)",
            type: "Prova Social",
            score: 88,
            impact: "+30% em CTR",
            description: "Vídeos estilo selfie com depoimento real geram maior confiança imediata.",
            recommendation: "Solicitar mais 3 vídeos de clientes reais para teste A/B."
        },
        {
            pattern: "Humor / Meme",
            type: "Engajamento",
            score: 75,
            impact: "+15% Compartilhamentos",
            description: "Uso de humor conecta com audiência mais jovem, mas conversão direta é menor.",
            recommendation: "Usar para brand awareness, mas evitar para conversão direta."
        }
    ];

    const bestPerformingAd = ads?.find(a => a.creative_category === 'VIDEO') || ads?.[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <BrainCircuit className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground uppercase tracking-tight">Análise Criativa (IA)</h2>
                    <p className="text-sm text-muted-foreground">Identificação automática de padrões visuais e correlação com performance.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patterns Detected */}
                <motion.div variants={item} className="lg:col-span-2 space-y-4">
                    {aiInsights.map((insight, i) => (
                        <div key={i} className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Badge className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/50 uppercase tracking-wider text-[10px]">
                                            {insight.type}
                                        </Badge>
                                        <span className="text-emerald-400 text-xs font-bold flex items-center">
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            {insight.impact}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">{insight.pattern}</h3>
                                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                        {insight.description}
                                    </p>

                                    <div className="bg-muted/20 border border-border rounded-xl p-3 flex items-start gap-3">
                                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">Recomendação da IA</p>
                                            <p className="text-xs text-foreground font-medium">{insight.recommendation}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-32 bg-muted rounded-xl p-4 flex flex-col items-center justify-center border border-border">
                                    <div className="text-3xl font-semibold text-foreground mb-1">{insight.score}</div>
                                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center">Score de Potencial</div>
                                    <div className="w-full h-1 bg-border rounded-full mt-3 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${insight.score}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Example of Best Pattern */}
                <motion.div variants={item} className="glass-card rounded-3xl p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Exemplo Prático Detectado</h3>
                    </div>

                    <div className="flex-1 bg-muted/50 rounded-xl border border-border relative group overflow-hidden mb-4">
                        {/* Mock User Video Placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-12 h-12 text-white opacity-50 group-hover:opacity-100 transition-all transform group-hover:scale-110" />
                        </div>
                        <img
                            src="https://placehold.co/400x600/1e1e1e/333333?text=Video+Frame+Analysis"
                            alt="Video Analysis"
                            className="w-full h-full object-cover opacity-60"
                        />

                        {/* AI Overlays */}
                        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-2 py-1 rounded border border-purple-500/50 text-[10px] font-bold text-purple-300 flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3" />
                            Padrão: Dança (98%)
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Análise do vídeo <span className="text-foreground font-bold">"{bestPerformingAd?.headlines?.[0] || 'Anúncio #492'}"</span>
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/20 p-2 rounded border border-border">
                                <p className="text-[9px] text-muted-foreground uppercase">Retenção 3s</p>
                                <p className="text-sm font-bold text-emerald-400">High</p>
                            </div>
                            <div className="bg-muted/20 p-2 rounded border border-border">
                                <p className="text-[9px] text-muted-foreground uppercase">Audio</p>
                                <p className="text-sm font-bold text-foreground">Upbeat</p>
                            </div>
                        </div>

                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-8 text-xs uppercase tracking-wider">
                            Ver Análise Frame-a-Frame
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
