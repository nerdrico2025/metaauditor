import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Zap,
    Plus,
    Play,
    Pause,
    Trash2,
    Settings2,
    TrendingDown,
    AlertTriangle,
    DollarSign,
    Edit2,
    Loader2,
    MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutomationRule {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_conditions: Record<string, number | string>;
    action_type: string;
    action_config: Record<string, unknown>;
    status: string;
    last_triggered_at: string | null;
    trigger_count: number;
    created_at: string;
}

const TRIGGER_TYPES = [
    { value: 'ctr_drop', label: 'Queda de CTR', icon: TrendingDown },
    { value: 'cpc_increase', label: 'Aumento de CPC', icon: DollarSign },
    { value: 'spend_limit', label: 'Limite de Gasto', icon: DollarSign },
    { value: 'performance_alert', label: 'Alerta de Performance', icon: AlertTriangle },
];

const ACTION_TYPES = [
    { value: 'pause_campaign', label: 'Pausar Campanha' },
    { value: 'notify', label: 'Enviar Notificação' },
    { value: 'adjust_budget', label: 'Ajustar Orçamento' },
];

export default function AutomationRules() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [form, setForm] = useState({
        name: '',
        description: '',
        trigger_type: 'ctr_drop',
        threshold: '',
        action_type: 'notify',
    });

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ['automation-rules', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');
            const { data, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as AutomationRule[];
        },
        enabled: !!companyId,
    });

    const createRule = useMutation({
        mutationFn: async () => {
            if (!companyId) throw new Error('No company ID');
            const { error } = await supabase.from('automation_rules').insert({
                company_id: companyId,
                name: form.name,
                description: form.description || null,
                trigger_type: form.trigger_type,
                trigger_conditions: { threshold: parseFloat(form.threshold) || 0 },
                action_type: form.action_type,
                action_config: {},
                status: 'active',
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra criada com sucesso');
            handleCloseDialog();
        },
        onError: (error) => {
            toast.error(`Erro ao criar regra: ${error.message}`);
        },
    });

    const updateRule = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { error } = await supabase
                .from('automation_rules')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra atualizada');
        },
    });

    const deleteRule = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('automation_rules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra excluída');
        },
    });

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingRule(null);
        setForm({
            name: '',
            description: '',
            trigger_type: 'ctr_drop',
            threshold: '',
            action_type: 'notify',
        });
    };

    const handleSubmit = () => {
        if (!form.name) return;
        createRule.mutate();
    };

    const getTriggerIcon = (triggerType: string) => {
        const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
        return trigger?.icon || Settings2;
    };

    return (
        <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ch-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-ch-orange" />
                    Regras de Automação
                </h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-ch-orange hover:bg-ch-orange/90">
                            <Plus className="w-4 h-4 mr-1" />
                            Nova Regra
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-ch-gray border-ch-dark-gray">
                        <DialogHeader>
                            <DialogTitle className="text-ch-white">Nova Regra de Automação</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Nome *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ex: Pausar se CPC > R$5"
                                    className="bg-ch-dark-gray border-ch-dark-gray"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Descreva o objetivo da regra..."
                                    className="bg-ch-dark-gray border-ch-dark-gray"
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Gatilho</Label>
                                    <Select
                                        value={form.trigger_type}
                                        onValueChange={(v) => setForm({ ...form, trigger_type: v })}
                                    >
                                        <SelectTrigger className="bg-ch-dark-gray border-ch-dark-gray">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRIGGER_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Limite</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={form.threshold}
                                        onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                                        placeholder="Ex: 5.00"
                                        className="bg-ch-dark-gray border-ch-dark-gray"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Ação</Label>
                                <Select
                                    value={form.action_type}
                                    onValueChange={(v) => setForm({ ...form, action_type: v })}
                                >
                                    <SelectTrigger className="bg-ch-dark-gray border-ch-dark-gray">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACTION_TYPES.map(a => (
                                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={handleCloseDialog} className="border-ch-dark-gray">
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!form.name || createRule.isPending}
                                    className="bg-ch-orange hover:bg-ch-orange/90"
                                >
                                    {createRule.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Criar
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                </div>
            ) : rules.length > 0 ? (
                <div className="space-y-2">
                    {rules.map((rule) => {
                        const TriggerIcon = getTriggerIcon(rule.trigger_type);
                        const triggerLabel = TRIGGER_TYPES.find(t => t.value === rule.trigger_type)?.label;
                        const actionLabel = ACTION_TYPES.find(a => a.value === rule.action_type)?.label;

                        return (
                            <div
                                key={rule.id}
                                className={`bg-ch-dark-gray rounded-lg p-4 flex items-center gap-4 ${rule.status !== 'active' ? 'opacity-60' : ''
                                    }`}
                            >
                                <div className="p-2 bg-ch-gray rounded-lg">
                                    <TriggerIcon className="w-4 h-4 text-ch-orange" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-ch-white truncate">{rule.name}</p>
                                    <p className="text-xs text-ch-text-dimmed">
                                        {triggerLabel} → {actionLabel}
                                        {rule.trigger_count > 0 && ` · ${rule.trigger_count}x ativada`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={rule.status === 'active'}
                                        onCheckedChange={(checked) => updateRule.mutate({
                                            id: rule.id,
                                            status: checked ? 'active' : 'paused',
                                        })}
                                    />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => deleteRule.mutate(rule.id)}
                                                className="text-red-500 focus:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Zap className="w-12 h-12 text-ch-text-dimmed mx-auto mb-4" />
                    <p className="text-ch-text-muted">Nenhuma regra configurada.</p>
                    <p className="text-sm text-ch-text-dimmed mt-1">
                        Crie regras para automatizar ações.
                    </p>
                </div>
            )}
        </div>
    );
}
