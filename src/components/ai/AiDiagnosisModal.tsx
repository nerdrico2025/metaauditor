import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Zap, Sparkles, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { springPop } from '@/lib/motion-presets';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AuditResult {
    compliance_score?: number;
    quality_score?: number;
    performance_score?: number;
    policy_compliance_score?: number;
    ai_analysis?: {
        quality_score?: number;
        features?: string[];
        strengths?: string[];
        weaknesses?: string[];
        suggestions?: string[];
        tone_analysis?: string;
        policy_warnings?: string[];
    };
    issues?: Array<{
        type: string;
        severity: string;
        message: string;
    }>;
}

interface AiDiagnosisModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: AuditResult | null;
    isLoading: boolean;
    onReanalyze?: () => void;
    title?: string;
}

export function AiDiagnosisModal({ isOpen, onClose, data, isLoading, onReanalyze, title = "Diagnóstico IA" }: AiDiagnosisModalProps) {
    const reduced = useReducedMotion();
    const score = data?.compliance_score || data?.ai_analysis?.quality_score || 0;
    const policyScore = data?.policy_compliance_score || 100;

    // Determine status color/text
    const getStatus = (s: number) => {
        if (s >= 80) return { color: 'text-ch-blue', bg: 'bg-ch-blue', label: 'EXCELENTE' };
        if (s >= 50) return { color: 'text-amber-500', bg: 'bg-amber-500', label: 'ATENÇÃO' };
        return { color: 'text-ch-orange', bg: 'bg-ch-orange', label: 'CRÍTICO' };
    };

    const status = getStatus(score);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-popover border-border p-0 overflow-hidden shadow-elevated">
                <motion.div
                    initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduced ? { duration: 0 } : springPop}
                >
                <DialogHeader className="p-6 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold uppercase tracking-tight text-foreground">{title}</DialogTitle>
                            <DialogDescription className="text-muted-foreground uppercase text-xs tracking-widest font-bold mt-1">
                                Análise Neural de Performance e Compliance
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <div className="p-8 space-y-8">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-6">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-border rounded-full animate-[spin_3s_linear_infinite]" />
                                    <div className="w-20 h-20 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full absolute top-0 left-0 animate-[spin_1s_ease-in-out_infinite]" />
                                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-foreground opacity-50 animate-pulse" />
                                </div>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Processando Diagnóstico...</p>
                            </div>
                        ) : data ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                {/* Scores */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 rounded-3xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                                        <div className={`absolute inset-0 opacity-[0.03] ${status.bg}`} />
                                        <span className={`text-6xl font-semibold ${status.color} tabular-nums tracking-tighter mb-2`}>{score}</span>
                                        <span className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-muted/50 ${status.color}`}>Score de Qualidade</span>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                                        <div className={`absolute inset-0 opacity-[0.03] ${getStatus(policyScore).bg}`} />
                                        <span className={`text-6xl font-semibold ${getStatus(policyScore).color} tabular-nums tracking-tighter mb-2`}>{policyScore}%</span>
                                        <span className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-muted/50 text-muted-foreground">Compliance Code</span>
                                    </div>
                                </div>

                                {/* AI Strengths */}
                                {data.ai_analysis?.strengths && data.ai_analysis.strengths.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-ch-blue">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <h4 className="text-xs font-semibold uppercase tracking-widest">Pontos Fortes Detectados</h4>
                                        </div>
                                        <div className="grid gap-2">
                                            {data.ai_analysis.strengths.map((item, i) => (
                                                <div key={i} className="p-3 rounded-lg bg-ch-blue/5 border border-ch-blue/10 text-ch-blue/80 text-sm font-medium">
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI Weaknesses */}
                                {data.ai_analysis?.weaknesses && data.ai_analysis.weaknesses.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-ch-orange">
                                            <AlertTriangle className="w-4 h-4" />
                                            <h4 className="text-xs font-semibold uppercase tracking-widest">Pontos de Atenção</h4>
                                        </div>
                                        <div className="grid gap-2">
                                            {data.ai_analysis.weaknesses.map((item, i) => (
                                                <div key={i} className="p-3 rounded-lg bg-ch-orange/5 border border-ch-orange/10 text-ch-orange/80 text-sm font-medium">
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Policy Warnings */}
                                {data.ai_analysis?.policy_warnings && data.ai_analysis.policy_warnings.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-ch-orange">
                                            <ShieldCheck className="w-4 h-4" />
                                            <h4 className="text-xs font-semibold uppercase tracking-widest">Alertas de Política (Risco de Bloqueio)</h4>
                                        </div>
                                        <div className="grid gap-2">
                                            {data.ai_analysis.policy_warnings.map((item, i) => (
                                                <div key={i} className="p-3 rounded-lg bg-ch-orange/5 border border-ch-orange/10 text-ch-orange/80 text-sm font-medium">
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Optimization Suggestions */}
                                {data.ai_analysis?.suggestions && data.ai_analysis.suggestions.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Zap className="w-4 h-4" />
                                            <h4 className="text-xs font-semibold uppercase tracking-widest">Plano de Otimização Sugerido</h4>
                                        </div>
                                        <div className="grid gap-2">
                                            {data.ai_analysis.suggestions.map((item, i) => (
                                                <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border/50 text-foreground text-sm leading-relaxed flex gap-3 group hover:border-primary/30 transition-colors">
                                                    <span className="text-primary font-semibold text-xs mt-0.5">{i + 1}.</span>
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </motion.div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground uppercase text-xs font-bold tracking-widest">
                                Nenhuma análise disponível. Execute o diagnóstico.
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-6 border-t border-border/50 bg-muted/30 flex justify-end gap-3 px-6">
                    <Button variant="outline" onClick={onClose} className="h-12 px-6 rounded-xl border-border hover:bg-muted text-xs font-bold uppercase tracking-widest">
                        Fechar
                    </Button>
                    {onReanalyze && (
                        <Button
                            onClick={onReanalyze}
                            disabled={isLoading}
                            className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold uppercase tracking-widest shadow-lg shadow-primary/20"
                        >
                            {isLoading ? 'Processando...' : 'Rodar Novo Diagnóstico'}
                        </Button>
                    )}
                </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}
