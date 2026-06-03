import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    RefreshCw,
    Loader2,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    Bot,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useCreativeRuleCheck, CreativeRuleCheckResult } from '@/hooks/useCreativeRules';
import { CreativeCompliancePreview } from '@/components/branding/CreativeCompliancePreview';
import { toast } from 'sonner';
import { springPop } from '@/lib/motion-presets';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    creativeId: string;
    creativeName: string;
    imageUrl?: string | null;
    externalId?: string | null;
    queueIndex?: number;
    queueTotal?: number;
    onPrev?: () => void;
    onNext?: () => void;
    ruleIds?: string[];
    /** When true, runs check automatically on open if no cached result */
    autoRun?: boolean;
}

const STATUS_CONFIG = {
    approved: {
        label: 'Aprovado',
        icon: ShieldCheck,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        badgeClass: 'bg-emerald-500 text-white',
    },
    warning: {
        label: 'Com Alertas',
        icon: ShieldAlert,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
        badgeClass: 'bg-amber-500 text-black',
    },
    rejected: {
        label: 'Reprovado',
        icon: ShieldX,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        badgeClass: 'bg-red-500 text-white',
    },
};

const SEVERITY_CONFIG = {
    error: { color: 'text-red-400', icon: XCircle },
    warning: { color: 'text-amber-400', icon: AlertTriangle },
    info: { color: 'text-blue-400', icon: Info },
};

const RULE_TYPE_LABELS: Record<string, string> = {
    content: 'Conteúdo',
    structure: 'Estrutura',
    copy: 'Copy',
    visual: 'Visual',
};

function RuleResultRow({ result }: { result: CreativeRuleCheckResult }) {
    const severityConf = SEVERITY_CONFIG[result.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
    const PassIcon = result.passed ? CheckCircle2 : severityConf.icon;
    const iconColor = result.passed ? 'text-emerald-400' : severityConf.color;

    return (
        <div className={`flex gap-3 p-3 rounded-xl border transition-colors ${
            result.passed
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : result.severity === 'error'
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
        }`}>
            <PassIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-foreground">{result.rule_name}</span>
                    {result.rule_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                            {RULE_TYPE_LABELS[result.rule_type] || result.rule_type}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.reason}</p>
            </div>
        </div>
    );
}

export default function CreativeRuleCheckModal({
    isOpen,
    onClose,
    creativeId,
    creativeName,
    imageUrl,
    externalId,
    queueIndex,
    queueTotal,
    onPrev,
    onNext,
    ruleIds,
    autoRun = false,
}: Props) {
    const reduced = useReducedMotion();
    const { lastCheck, isLoading, runCheck } = useCreativeRuleCheck(creativeId);
    const [isRunning, setIsRunning] = useState(false);
    const autoRunTriggered = useRef(false);

    const handleRunCheck = async (force = true) => {
        setIsRunning(true);
        try {
            const hasFilter = ruleIds && ruleIds.length > 0;
            await runCheck.mutateAsync(
                hasFilter
                    ? { creative_id: creativeId, rule_ids: ruleIds, force }
                    : { creative_id: creativeId, force },
            );
            toast.success('Verificação concluída!');
        } catch {
            // error already handled in hook
        } finally {
            setIsRunning(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            autoRunTriggered.current = false;
            return;
        }
        if (!autoRun || autoRunTriggered.current || isLoading) return;
        if (lastCheck || isRunning) return;

        autoRunTriggered.current = true;
        void handleRunCheck(true);
    }, [isOpen, autoRun, isLoading, lastCheck, creativeId]);

    const statusConf = lastCheck ? STATUS_CONFIG[lastCheck.overall_status] : null;
    const StatusIcon = statusConf?.icon || ShieldCheck;

    const passedCount = lastCheck?.results.filter(r => r.passed).length ?? 0;
    const totalCount = lastCheck?.results.length ?? 0;
    const failedResults = lastCheck?.results.filter(r => !r.passed) ?? [];
    const passedResults = lastCheck?.results.filter(r => r.passed) ?? [];
    const previewFailedRules = failedResults.map(r => ({
        rule_name: r.rule_name,
        severity: r.severity,
        reason: r.reason,
    }));
    const previewStatus = lastCheck?.overall_status ?? 'pending';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
                <motion.div
                    initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduced ? { duration: 0 } : springPop}
                    className="flex flex-col flex-1 min-h-0 overflow-hidden p-6"
                >
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-ch-orange/10 rounded-xl">
                            <Bot className="w-5 h-5 text-ch-orange" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-lg font-bold">Verificação de Regras</DialogTitle>
                            <DialogDescription className="text-xs truncate max-w-sm">
                                {creativeName}
                            </DialogDescription>
                        </div>
                        {queueTotal && queueTotal > 1 && (
                            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onPrev}
                                    disabled={!onPrev}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full whitespace-nowrap">
                                    {(queueIndex ?? 0) + 1} / {queueTotal}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onNext}
                                    disabled={!onNext}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {(imageUrl || lastCheck) && (
                    <div className="flex-shrink-0 max-w-[200px] mx-auto mb-2">
                        <CreativeCompliancePreview
                            imageUrl={imageUrl}
                            externalId={externalId}
                            name={creativeName}
                            status={previewStatus}
                            failedRules={previewFailedRules}
                            size="md"
                            aspectClassName="aspect-[4/5] w-full"
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* No check yet */}
                    {!isLoading && !lastCheck && !isRunning && (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                            <div className="p-6 bg-muted rounded-full">
                                <ShieldCheck className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">Nenhuma verificação realizada</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Clique em "Verificar Agora" para a IA analisar este criativo contra as regras ativas.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Running animation */}
                    {(isRunning || (isLoading && !lastCheck)) && (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                            <div className="relative">
                                <div className="p-6 bg-ch-orange/10 rounded-full">
                                    <Bot className="w-10 h-10 text-ch-orange animate-pulse" />
                                </div>
                                <div className="absolute inset-0 rounded-full border-2 border-ch-orange/30 animate-ping" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">Analisando criativo...</p>
                                <p className="text-sm text-muted-foreground">A IA está verificando cada regra</p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {lastCheck && !isRunning && (
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                {/* Status header */}
                                <div className={`flex items-center gap-4 p-4 rounded-2xl border ${statusConf?.bg}`}>
                                    <StatusIcon className={`w-8 h-8 flex-shrink-0 ${statusConf?.color}`} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-semibold text-foreground text-lg">{statusConf?.label}</span>
                                            <Badge className={`text-xs font-semibold ${statusConf?.badgeClass}`}>
                                                {lastCheck.overall_score}%
                                            </Badge>
                                        </div>
                                        <Progress value={lastCheck.overall_score} className="h-2 mb-2" />
                                        <p className="text-xs text-muted-foreground">
                                            {passedCount} de {totalCount} regras aprovadas •{' '}
                                            {new Date(lastCheck.checked_at).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>

                                {/* AI Summary */}
                                {lastCheck.ai_summary && (
                                    <div className="flex gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                                        <Bot className="w-4 h-4 text-ch-orange flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-muted-foreground italic">{lastCheck.ai_summary}</p>
                                    </div>
                                )}

                                {/* Failed rules */}
                                {failedResults.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                                            Não atende ({failedResults.length})
                                        </p>
                                        {failedResults.map((r) => (
                                            <RuleResultRow key={r.rule_id} result={r} />
                                        ))}
                                    </div>
                                )}

                                {/* Passed rules */}
                                {passedResults.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            Aprovado ({passedResults.length})
                                        </p>
                                        {passedResults.map((r) => (
                                            <RuleResultRow key={r.rule_id} result={r} />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t border-border">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                    <Button
                        onClick={() => void handleRunCheck(true)}
                        disabled={isRunning}
                        className="bg-ch-orange hover:bg-ch-orange-hover text-black font-semibold uppercase tracking-widest"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {lastCheck ? 'Re-verificar' : 'Verificar Agora'}
                            </>
                        )}
                    </Button>
                </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}
