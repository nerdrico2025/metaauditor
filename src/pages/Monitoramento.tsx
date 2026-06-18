import { useRecentAudits, useIssuesWithHighPriority } from '@/hooks/useAudits';
import { moduleToAuditFocus } from '@/lib/audit-focus';
import { useModule } from '@/contexts/ModuleContext';
import { getProxiedImageUrl } from '@/lib/utils';
import {
    TrendingUp,
    AlertTriangle,
    Check,
    RefreshCw,
    Award,
    FileCheck,
    Target,
    Activity,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/audits/AuditHistoryList';
import { CrossFocusStatusBadge } from '@/components/creatives/CrossFocusStatusBadge';
import { useCrossFocusStatusMap } from '@/hooks/useCrossFocusStatusMap';
import { useMemo } from 'react';

export default function Monitoramento() {
    const { module } = useModule();
    const auditFocus = moduleToAuditFocus(module);
    const { data: recentAudits } = useRecentAudits(10, auditFocus);
    const { data: highPriorityIssues } = useIssuesWithHighPriority(10, auditFocus);
    const navigate = useNavigate();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);

    const auditCreativeIds = useMemo(
        () => (recentAudits ?? []).map((a) => a.creative_id).filter((id): id is string => !!id),
        [recentAudits],
    );
    const { oppositeFocus: crossFocusOpposite, getStatus: getCrossFocusStatus } =
        useCrossFocusStatusMap(auditCreativeIds, module);

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-4 md:p-6 space-y-8 md:space-y-10"
        >
            <motion.div variants={item}>
                <SectionHeader
                    title="Monitoramento em Tempo Real"
                    description="Supervisão ativa de performance e conformidade do ecossistema"
                />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
                {/* Audit Performance Card */}
                <motion.div variants={item} className="rounded-2xl p-8 md:p-10 border border-border shadow-sm bg-card hover-lift transition-all flex flex-col overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.01] pointer-events-none">
                        <Award className="w-64 h-64 text-foreground" />
                    </div>
                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-bold text-foreground text-lg">Auditoria de Performance IA</h2>
                                <p className="text-xs font-medium text-muted-foreground mt-1">Últimas validações de conformidade</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-12 w-12 hover:bg-muted/50 rounded-2xl transition-all" onClick={() => navigate('/auditorias')}>
                            <ArrowRight className="w-6 h-6 text-muted-foreground hover:text-primary" />
                        </Button>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1">
                        {recentAudits && recentAudits.length > 0 ? (
                            recentAudits.map((audit) => (
                                <div
                                    key={audit.id}
                                    className="flex items-center justify-between p-5 rounded-[1.8rem] hover:bg-muted/50 border border-border bg-card transition-all group cursor-pointer"
                                    onClick={() => navigate(`/criativos/${audit.creative_id}`)}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-muted border border-border rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-700">
                                            {audit.creative?.image_url ? (
                                                <img
                                                    src={getProxiedImageUrl(audit.creative.image_url) || audit.creative.image_url}
                                                    alt=""
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`w-full h-full flex-col items-center justify-center gap-1 px-1 ${audit.creative?.image_url ? 'hidden' : 'flex'}`}>
                                                <Target className="w-4 h-4 text-muted-foreground opacity-20" />
                                                <span className="text-[6px] font-bold text-red-500 leading-tight text-center">Sem permissão</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{audit.creative?.name || 'ASSET_PROBE_' + audit.id.slice(0, 4)}</p>
                                            <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-2">
                                                <RefreshCw className="w-3 h-3 text-primary" />
                                                Verificado {formatDistanceToNow(new Date(audit.created_at), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <CrossFocusStatusBadge
                                            oppositeFocus={crossFocusOpposite}
                                            status={getCrossFocusStatus(audit.creative_id ?? '')}
                                        />
                                        <StatusBadge status={audit.status} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 text-center flex flex-col items-center flex-1 justify-center">
                                <Activity className="w-12 h-12 text-muted-foreground mb-6 opacity-10 animate-pulse" />
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.3em]">Aguardando Fluxo de Auditoria</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Risk Ecosystem Card */}
                <motion.div variants={item} className="rounded-2xl p-8 md:p-10 border border-border shadow-sm bg-card hover-lift transition-all flex flex-col overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.01] pointer-events-none">
                        <AlertTriangle className="w-64 h-64 text-foreground" />
                    </div>
                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500/10 rounded-2xl">
                                <FileCheck className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <h2 className="font-bold text-foreground text-lg">Saúde da Conta</h2>
                                <p className="text-xs font-medium text-muted-foreground mt-1">Monitoramento de conformidade e políticas</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1">
                        {highPriorityIssues && highPriorityIssues.length > 0 ? (
                            highPriorityIssues.map((issue) => (
                                <div
                                    key={issue.id}
                                    className="flex items-center justify-between p-6 rounded-[1.8rem] bg-rose-500/[0.03] border border-rose-500/10 hover:border-rose-500/40 transition-all group cursor-pointer shadow-sm"
                                    onClick={() => navigate(`/criativos/${issue.creative_id}`)}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:rotate-3 transition-transform duration-500">
                                            <AlertTriangle className="w-8 h-8 text-rose-500 group-hover:animate-bounce" />
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-foreground line-clamp-1">{issue.creative?.name || 'CONFORMITY_BREACH'}</p>
                                            <div className="flex items-center gap-2.5 mt-2">
                                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                                <p className="text-xs text-rose-500 font-bold line-clamp-1">
                                                    {(issue.issues && (issue.issues as any)[0]?.message)
                                                        ? (issue.issues as any)[0].message
                                                        : "Ação Imediata Necessária"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center w-20 h-20 rounded-[1.3rem] border-2 bg-rose-500/20 border-rose-500/30 text-rose-500 shadow-sm skew-x-[-2deg]">
                                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-60 mb-1">Estado</span>
                                        <span className="text-xs font-semibold tracking-widest">CRÍTICO</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 text-center flex flex-col items-center flex-1 justify-center">
                                <div className="w-20 h-20 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 flex items-center justify-center mb-8 shadow-sm">
                                    <Check className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h4 className="text-lg font-bold text-foreground tracking-tight">Conta 100% Segura</h4>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">Nenhuma violação ou risco detectado.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
