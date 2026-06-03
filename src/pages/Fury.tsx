import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Undo2,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    MousePointerClick,
    Wallet,
    Loader2,
    Shield,
    Power,
    PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFuryActions, FuryAction } from '@/hooks/useFuryActions';
import { useFuryTemplates, FuryTemplate } from '@/hooks/useFuryTemplates';
import { formatCurrency } from '@/lib/utils';

const ICON_MAP: Record<string, any> = {
    RefreshCw,
    TrendingDown,
    TrendingUp,
    MousePointerClick,
    Wallet,
};

const SEVERITY_STYLES: Record<string, string> = {
    critical: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
};

const ACTION_LABELS: Record<string, string> = {
    pause: 'Pausou',
    activate: 'Ativou',
    update_budget: 'Alterou budget',
    notify: 'Alerta',
    flag_review: 'Sinalizado',
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    executed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Executado' },
    undone: { icon: Undo2, color: 'text-amber-500', label: 'Desfeito' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Falhou' },
    pending_approval: { icon: Clock, color: 'text-blue-500', label: 'Pendente' },
};

function canUndo(action: FuryAction): boolean {
    if (action.status !== 'executed') return false;
    if (!action.undo_deadline) return false;
    return new Date(action.undo_deadline) > new Date();
}

function timeRemaining(deadline: string): string {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return 'expirado';
    const mins = Math.ceil(ms / 60000);
    return `${mins}min restantes`;
}

function formatMetric(metric: string | null, value: number | null): string {
    if (!metric || value == null) return '';
    switch (metric) {
        case 'ctr': return `CTR ${value.toFixed(2)}%`;
        case 'cpc': return `CPC ${formatCurrency(value)}`;
        case 'cpa': return `CPA ${formatCurrency(value)}`;
        case 'cpm': return `CPM ${formatCurrency(value)}`;
        case 'frequency': return `Freq ${value.toFixed(1)}`;
        case 'spend': return `Gasto ${formatCurrency(value)}`;
        case 'budget_usage_pct': return `Budget ${value.toFixed(0)}%`;
        default: return `${metric} ${value}`;
    }
}

export default function Fury() {
    const { actions, stats, isLoading, undo, isUndoing } = useFuryActions();
    const { templates, isLoading: templatesLoading, install, uninstall, isInstalling } = useFuryTemplates();
    const [activeTab, setActiveTab] = useState('feed');

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">FURY</h1>
                        <p className="text-xs text-muted-foreground">Motor de Otimizacao Automatica</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 tabular-nums">
                        <Zap className="w-3 h-3" /> {stats.totalToday} hoje
                    </Badge>
                    {stats.undoneToday > 0 && (
                        <Badge variant="secondary" className="gap-1 tabular-nums">
                            <Undo2 className="w-3 h-3" /> {stats.undoneToday} undos
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Executadas', value: stats.executedToday, icon: CheckCircle2, color: 'text-emerald-500' },
                    { label: 'Desfeitas', value: stats.undoneToday, icon: Undo2, color: 'text-amber-500' },
                    { label: 'Falharam', value: stats.failedToday, icon: XCircle, color: 'text-red-500' },
                    { label: 'Pendentes', value: stats.pendingApproval, icon: AlertTriangle, color: 'text-blue-500' },
                ].map(s => (
                    <Card key={s.label} className="border-border/50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <s.icon className={`w-5 h-5 ${s.color}`} />
                            <div>
                                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{s.label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 w-64">
                    <TabsTrigger value="feed">Feed de Acoes</TabsTrigger>
                    <TabsTrigger value="templates">Regras FURY</TabsTrigger>
                </TabsList>

                {/* Feed tab */}
                <TabsContent value="feed" className="mt-4 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : actions.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="p-12 flex flex-col items-center text-center">
                                <Zap className="w-10 h-10 text-muted-foreground/50 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">Nenhuma acao registrada</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    Ative regras na aba "Regras FURY" para comecar
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <AnimatePresence>
                            {actions.map((action, idx) => (
                                <FuryActionCard
                                    key={action.id}
                                    action={action}
                                    onUndo={() => undo(action.id)}
                                    isUndoing={isUndoing}
                                    index={idx}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </TabsContent>

                {/* Templates tab */}
                <TabsContent value="templates" className="mt-4 space-y-3">
                    {templatesLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        templates.map(tpl => (
                            <FuryTemplateCard
                                key={tpl.id}
                                template={tpl}
                                onInstall={() => install({ templateId: tpl.id })}
                                onUninstall={() => uninstall(tpl.id)}
                                isInstalling={isInstalling}
                            />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function FuryActionCard({ action, onUndo, isUndoing, index }: { action: FuryAction; onUndo: () => void; isUndoing: boolean; index: number }) {
    const statusCfg = STATUS_CONFIG[action.status] || STATUS_CONFIG.executed;
    const StatusIcon = statusCfg.icon;
    const showUndo = canUndo(action);
    const time = new Date(action.executed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(action.executed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
        >
            <Card className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${statusCfg.color}`} />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">
                                        {ACTION_LABELS[action.action_type] || action.action_type}
                                    </span>
                                    <Badge variant="outline" className="text-[9px] uppercase">
                                        {action.entity_type}
                                    </Badge>
                                    <span className="text-sm text-foreground font-semibold truncate">
                                        "{action.entity_name || action.entity_id}"
                                    </span>
                                </div>
                                {action.trigger_metric && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatMetric(action.trigger_metric, action.trigger_value)}
                                        {action.trigger_threshold != null && (
                                            <span className="text-muted-foreground/70">
                                                {' '}(limite: {action.trigger_threshold})
                                            </span>
                                        )}
                                        {action.trigger_window_days && action.trigger_window_days > 1 && (
                                            <span className="text-muted-foreground/70">
                                                {' '}| janela {action.trigger_window_days}d
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                                <p className="text-xs font-medium tabular-nums">{time}</p>
                                <p className="text-[10px] text-muted-foreground">{date}</p>
                            </div>
                            {showUndo && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onUndo}
                                    disabled={isUndoing}
                                    className="text-xs gap-1"
                                >
                                    {isUndoing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                                    Desfazer
                                    <span className="text-muted-foreground text-[9px]">
                                        ({timeRemaining(action.undo_deadline!)})
                                    </span>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function FuryTemplateCard({ template, onInstall, onUninstall, isInstalling }: {
    template: FuryTemplate;
    onInstall: () => void;
    onUninstall: () => void;
    isInstalling: boolean;
}) {
    const IconComp = ICON_MAP[template.icon || ''] || Shield;
    const severityStyle = SEVERITY_STYLES[template.severity] || SEVERITY_STYLES.info;

    return (
        <Card className={`border ${severityStyle} transition-colors`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                            <IconComp className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm">{template.name}</h3>
                                <Badge variant="outline" className="text-[9px] uppercase">
                                    {template.applies_to}
                                </Badge>
                                <Badge
                                    variant={template.severity === 'critical' ? 'destructive' : 'secondary'}
                                    className="text-[9px] uppercase"
                                >
                                    {template.action_type === 'pause' ? 'Pausa auto' : template.action_type === 'notify' ? 'Alerta' : 'Revisao'}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {template.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                                <span>Metrica: {template.trigger_conditions?.metric}</span>
                                <span>Threshold: {template.trigger_conditions?.threshold}</span>
                                <span>Janela: {template.trigger_conditions?.window_days}d</span>
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                        {template.installed ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onUninstall}
                                disabled={isInstalling}
                                className="gap-1 text-xs"
                            >
                                <PowerOff className="w-3 h-3" />
                                Desativar
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={onInstall}
                                disabled={isInstalling}
                                className="gap-1 text-xs bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                {isInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                                Ativar
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
