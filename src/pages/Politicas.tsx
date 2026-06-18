import { useState } from 'react';
import { usePolicies, Policy, CreatePolicyInput } from '@/hooks/usePolicies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Shield,
    Plus,
    Search,
    MoreHorizontal,
    Edit2,
    Trash2,
    Copy,
    Loader2,
    FileText,
    Tag,
    Ban,
    CheckCircle,
    AlertTriangle,
    Globe,
    Target,
    Zap,
    Sparkles,
    ChevronRight,
    Award,
    Activity,
    ShieldCheck,
    Briefcase,
    DollarSign,
    TrendingUp,
    Calendar,
    Archive
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { statsGridCols } from '@/lib/responsiveGrids';
import { cn } from '@/lib/utils';

const POLICY_TEMPLATES: Partial<CreatePolicyInput>[] = [
    {
        name: 'Conformidade Básica',
        description: 'Política padrão para garantir integridade básica de anúncios',
        scope: 'global',
        prohibited_keywords: ['grátis', 'garantido', 'sem risco', 'milagre'],
        min_text_length: 10,
        max_text_length: 500,
        status: 'active',
    },
    {
        name: 'Performance Elite',
        description: 'Filtros rigorosos para ativos de alta conversão',
        scope: 'global',
        ctr_min: 1.5,
        ctr_target: 3.0,
        cpc_max: 5.0,
        cpc_target: 2.0,
        status: 'active',
    },
    {
        name: 'Identidade Premium',
        description: 'Diretrizes estritas de branding e estética visual',
        scope: 'global',
        requires_logo: true,
        requires_brand_colors: true,
        status: 'active',
    },
];

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
};

export default function Politicas() {
    const { policies, isLoading, createPolicy, updatePolicy, deletePolicy } = usePolicies();
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
    const [form, setForm] = useState<Partial<CreatePolicyInput>>({
        name: '',
        description: '',
        scope: 'global',
        status: 'active',
        prohibited_keywords: [],
        required_keywords: [],
    });

    const filteredPolicies = policies.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!form.name) return;

        if (editingPolicy) {
            await updatePolicy.mutateAsync({ id: editingPolicy.id, ...form });
        } else {
            await createPolicy.mutateAsync(form as CreatePolicyInput);
        }
        handleCloseDialog();
    };

    const handleEdit = (policy: Policy) => {
        setEditingPolicy(policy);
        setForm({
            name: policy.name,
            description: policy.description || '',
            scope: policy.scope as any || 'global',
            status: policy.status as any || 'active',
            required_keywords: policy.required_keywords || [],
            prohibited_keywords: policy.prohibited_keywords || [],
            required_phrases: policy.required_phrases || [],
            prohibited_phrases: policy.prohibited_phrases || [],
            min_text_length: policy.min_text_length || undefined,
            max_text_length: policy.max_text_length || undefined,
            requires_logo: policy.requires_logo || false,
            requires_brand_colors: policy.requires_brand_colors || false,
            ctr_min: policy.ctr_min || undefined,
            ctr_target: policy.ctr_target || undefined,
            cpc_max: policy.cpc_max || undefined,
            cpc_target: policy.cpc_target || undefined,
        });
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingPolicy(null);
        setForm({
            name: '',
            description: '',
            scope: 'global',
            status: 'active',
            prohibited_keywords: [],
            required_keywords: [],
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta política?')) {
            await deletePolicy.mutateAsync(id);
        }
    };

    const handleUseTemplate = (template: Partial<CreatePolicyInput>) => {
        setForm({ ...form, ...template });
    };

    const getStatusBadge = (status: string | null) => {
        const config: Record<string, { label: string, color: string }> = {
            active: { label: 'Manual Ativo', color: 'emerald-500' },
            draft: { label: 'Rascunho Técnico', color: 'amber-500' },
            archived: { label: 'Legado', color: 'ch-text-dimmed' },
        };
        const cfg = config[status || 'draft'] || config.draft;
        return (
            <span className={`text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-${cfg.color}/10 text-${cfg.color} border border-${cfg.color}/20`}>
                {cfg.label}
            </span>
        );
    };

    const getScopeBadge = (scope: string | null) => {
        return scope === 'campaign' ? (
            <span className="text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-1.5 border border-blue-500/20">
                <Target className="w-3 h-3" />
                Campanha
            </span>
        ) : (
            <span className="text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 flex items-center gap-1.5 border border-purple-500/20">
                <Globe className="w-3 h-3" />
                Global
            </span>
        );
    };

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={container}
            className="p-6 space-y-8"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <ShieldCheck className="w-4 h-4 text-ch-orange" />
                        <span className="text-[10px] font-semibold text-ch-orange uppercase tracking-wide">Central de Segurança</span>
                    </div>
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight uppercase">Políticas de Compliance</h1>
                    <p className="text-muted-foreground font-medium mt-1">Defina o código de conduta para automação de criativos.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleCloseDialog()}>
                    <DialogTrigger asChild>
                        <Button className="bg-ch-white hover:bg-ch-orange text-black font-semibold uppercase tracking-widest rounded-xl transition-all h-12 px-8 shadow-xl group">
                            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                            Criar Protocolo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border p-0 rounded-[2.5rem] shadow-[0_0_100px_rgba(242,106,33,0.1)]">
                        <DialogHeader className="sr-only">
                            <DialogTitle>
                                {editingPolicy ? 'Refinar Protocolo' : 'Novo Protocolo IA'}
                            </DialogTitle>
                            <DialogDescription>
                                Configuração de regras de negócio e políticas de criativos para a empresa.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-8 border-b border-border bg-muted/20 flex items-center justify-between sticky top-0 backdrop-blur-3xl z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-ch-orange/10 rounded-xl">
                                    <ShieldCheck className="w-5 h-5 text-ch-orange" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-foreground uppercase tracking-tight">
                                        {editingPolicy ? 'Refinar Protocolo' : 'Novo Protocolo IA'}
                                    </h2>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Configuração de Regras de Negócio</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={handleCloseDialog}>Fechar</Button>
                        </div>

                        <div className="p-10 space-y-10">
                            {/* Templates Quick Select */}
                            {!editingPolicy && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3 h-3 text-ch-orange" />
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acelerar com Presets IA</Label>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {POLICY_TEMPLATES.map((template, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                onClick={() => handleUseTemplate(template)}
                                                className="bg-muted/60 border-border h-12 rounded-xl px-5 text-[10px] font-semibold uppercase tracking-widest hover:border-ch-orange/50 hover:text-ch-orange transition-all group"
                                            >
                                                <Copy className="w-3.5 h-3.5 mr-2 group-hover:scale-110 transition-transform" />
                                                {template.name}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Core Identity */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ml-1">Identificação do Protocolo</Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="EX: POLÍTICA BRANDING 2024"
                                        className="bg-muted/60 border-border h-16 rounded-2xl text-foreground font-semibold uppercase tracking-widest px-6 focus:border-ch-orange/50 transition-all placeholder:opacity-20"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ml-1">Escopo de Aplicação</Label>
                                    <Select
                                        value={form.scope}
                                        onValueChange={(v) => setForm({ ...form, scope: v as any })}
                                    >
                                        <SelectTrigger className="bg-muted/60 border-border h-16 rounded-2xl text-foreground font-semibold uppercase tracking-widest px-6 focus:border-ch-orange/50 transition-all">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border uppercase font-semibold text-[10px] tracking-widest">
                                            <SelectItem value="global" className="tracking-widest">Infraestrutura Global</SelectItem>
                                            <SelectItem value="campaign" className="tracking-widest">Específico p/ Campanha</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-4">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ml-1">Descrição Executiva</Label>
                                    <Textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="DESCREVA O OBJETIVO ANALÍTICO DESTA REGRA..."
                                        className="bg-muted/60 border-border rounded-2xl text-foreground font-medium p-6 focus:border-ch-orange/50 transition-all placeholder:opacity-20 min-h-[100px]"
                                    />
                                </div>
                            </div>

                            {/* Lexical Rules */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Tag className="w-5 h-5 text-ch-orange" />
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Lexicografia & Proibições</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4 group">
                                        <Label className="text-[9px] font-semibold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle className="w-3 h-3" /> Termos Obrigatórios
                                        </Label>
                                        <Textarea
                                            value={(form.required_keywords || []).join(', ')}
                                            onChange={(e) => setForm({
                                                ...form,
                                                required_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                            })}
                                            placeholder="MARCA, OFERTA, PRODUTO"
                                            className="bg-emerald-500/[0.02] border-border rounded-2xl text-foreground font-bold p-5 focus:border-emerald-500/30 transition-all uppercase text-xs"
                                        />
                                    </div>
                                    <div className="space-y-4 group">
                                        <Label className="text-[9px] font-semibold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                            <Ban className="w-3 h-3" /> Gatilhos Proibidos
                                        </Label>
                                        <Textarea
                                            value={(form.prohibited_keywords || []).join(', ')}
                                            onChange={(e) => setForm({
                                                ...form,
                                                prohibited_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                            })}
                                            placeholder="GRÁTIS, MILAGRE, GARANTIDO"
                                            className="bg-rose-500/[0.02] border-border rounded-2xl text-foreground font-bold p-5 focus:border-rose-500/30 transition-all uppercase text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Thresholds & KPIs */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Activity className="w-5 h-5 text-ch-orange" />
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Limites & KPIs de Performance</h3>
                                </div>
                                <div className={cn('grid gap-4 xl:gap-6', statsGridCols[4])}>
                                    {[
                                        { label: 'CTR MÍNIMO (%)', key: 'ctr_min', icon: Target },
                                        { label: 'CTR ALVO (%)', key: 'ctr_target', icon: TrendingUp },
                                        { label: 'CPC MÁXIMO (R$)', key: 'cpc_max', icon: DollarSign },
                                        { label: 'CPC ALVO (R$)', key: 'cpc_target', icon: Zap },
                                    ].map((field) => (
                                        <div key={field.key} className="space-y-3">
                                            <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{field.label}</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={(form[field.key as keyof CreatePolicyInput] as any)?.toString() || ''}
                                                    onChange={(e) => setForm({ ...form, [field.key]: parseFloat(e.target.value) || undefined })}
                                                    className="bg-muted/60 border-border h-12 rounded-xl pl-4 pr-4 font-semibold text-sm text-foreground text-center"
                                                    placeholder="0.0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Aesthetics Switching */}
                            <div className="bg-muted/20 border border-border p-8 rounded-[2rem] space-y-6">
                                <div className="flex items-center gap-3">
                                    <Briefcase className="w-5 h-5 text-ch-orange" />
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Validação Visual de Marca</h3>
                                </div>
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="flex items-center gap-4 bg-muted/50 p-5 rounded-2xl border border-border flex-1">
                                        <Switch
                                            checked={form.requires_logo}
                                            onCheckedChange={(checked) => setForm({ ...form, requires_logo: checked })}
                                            className="data-[state=checked]:bg-ch-orange"
                                        />
                                        <div>
                                            <Label className="text-[11px] font-semibold text-foreground uppercase tracking-widest">Exigir Logotipo</Label>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Scanner de visão computacional ativo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-muted/50 p-5 rounded-2xl border border-border flex-1">
                                        <Switch
                                            checked={form.requires_brand_colors}
                                            onCheckedChange={(checked) => setForm({ ...form, requires_brand_colors: checked })}
                                            className="data-[state=checked]:bg-ch-orange"
                                        />
                                        <div>
                                            <Label className="text-[11px] font-semibold text-foreground uppercase tracking-widest">Cromatismo da Marca</Label>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Validação de paleta hex via IA</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dialog Actions */}
                            <div className="flex justify-end gap-4 pt-4">
                                <Button variant="outline" onClick={handleCloseDialog} className="bg-transparent border-border h-16 rounded-2xl px-8 font-semibold uppercase text-[11px] tracking-widest hover:bg-muted transition-all">
                                    Descartar
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!form.name || createPolicy.isPending || updatePolicy.isPending}
                                    className="bg-ch-white hover:bg-ch-orange text-black font-semibold uppercase tracking-widest rounded-2xl h-16 px-10 shadow-xl shadow-white/5 transition-all"
                                >
                                    {(createPolicy.isPending || updatePolicy.isPending) ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        editingPolicy ? 'Atualizar Protocolo' : 'Publicar Protocolo'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Biblioteca de Regras', value: policies.length, icon: Shield, color: 'ch-orange' },
                    { label: 'Sistemas Operantes', value: policies.filter(p => p.status === 'active').length, icon: CheckCircle, color: 'emerald-500' },
                    { label: 'Em Desenvolvimento', value: policies.filter(p => p.status === 'draft').length, icon: AlertTriangle, color: 'amber-500' },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={item} whileHover={{ y: -3 }} className="glass-card rounded-3xl p-6 shadow-xl group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`p-2.5 bg-${stat.color}/10 rounded-xl`}>
                                <stat.icon className={`w-5 h-5 text-${stat.color}`} />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className="text-3xl font-semibold text-foreground tracking-tighter tabular-nums group-hover:text-ch-orange transition-colors">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Global Search Interface */}
            <motion.div variants={item} className="glass-card rounded-3xl p-4 relative overflow-hidden group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-ch-orange transition-colors" />
                <Input
                    placeholder="PESQUISAR NOS MANUAIS DE COMPLIANCE..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-14 bg-transparent border-none text-[11px] font-semibold uppercase tracking-wider h-14 focus-visible:ring-0 placeholder:opacity-20"
                />
            </motion.div>

            {/* Policies Architecture List */}
            {isLoading ? (
                <div className="p-24 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-ch-orange opacity-40" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Descriptografando manuais...</span>
                </div>
            ) : filteredPolicies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPolicies.map((policy) => (
                        <motion.div
                            key={policy.id}
                            variants={item}
                            whileHover={{ y: -5 }}
                            className="glass-premium rounded-[2.5rem] p-8 space-y-8 border-border shadow-2xl relative overflow-hidden group hover:bg-card transition-all duration-500"
                        >
                            <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none group-hover:opacity-[0.06] transition-opacity">
                                <Shield className="w-32 h-32" />
                            </div>

                            <div className="flex items-start justify-between relative z-10">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h3 className="text-lg font-semibold text-foreground uppercase tracking-tight group-hover:text-ch-orange transition-colors truncate">{policy.name}</h3>
                                    <p className="text-[10px] font-medium text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                                        {policy.description || 'ESTE PROTOCOLO NÃO POSSUI UMA DESCRIÇÃO TÉCNICA DEFINIDA.'}
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-muted/20 border border-border rounded-xl hover:text-ch-orange">
                                            <MoreHorizontal className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-card border-border w-48 font-semibold uppercase text-[10px] tracking-widest">
                                        <DropdownMenuItem onClick={() => handleEdit(policy)} className="py-3 cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-3 text-blue-400" /> Editar Regra
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(policy.id)}
                                            className="py-3 text-rose-500 focus:text-rose-500 cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4 mr-3" /> Excluir Regra
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex flex-wrap gap-2.5 relative z-10">
                                {getStatusBadge(policy.status)}
                                {getScopeBadge(policy.scope)}
                                {policy.is_default && (
                                    <span className="text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-ch-orange/10 text-ch-orange border border-ch-orange/20 animate-pulse">
                                        Núcleo
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 relative z-10 bg-muted/20 p-5 rounded-3xl border border-border shadow-inner">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className={`w-3.5 h-3.5 ${(policy.required_keywords?.length ?? 0) > 0 ? 'text-emerald-500' : 'text-muted-foreground opacity-30'}`} />
                                        <span className={`text-[10px] font-semibold uppercase tracking-tight ${(policy.required_keywords?.length ?? 0) > 0 ? 'text-foreground' : 'text-muted-foreground opacity-30'}`}>
                                            {policy.required_keywords?.length || 0} REQUISITOS
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Ban className={`w-3.5 h-3.5 ${(policy.prohibited_keywords?.length ?? 0) > 0 ? 'text-rose-500' : 'text-muted-foreground opacity-30'}`} />
                                        <span className={`text-[10px] font-semibold uppercase tracking-tight ${(policy.prohibited_keywords?.length ?? 0) > 0 ? 'text-foreground' : 'text-muted-foreground opacity-30'}`}>
                                            {policy.prohibited_keywords?.length || 0} BLOQUEIOS
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4 border-l border-border pl-4">
                                    <div className="flex items-center gap-2">
                                        <Target className={`w-3.5 h-3.5 ${policy.ctr_min ? 'text-ch-orange' : 'text-muted-foreground opacity-30'}`} />
                                        <span className={`text-[10px] font-semibold uppercase tracking-tight ${policy.ctr_min ? 'text-foreground' : 'text-muted-foreground opacity-30'}`}>
                                            CTR {policy.ctr_min}%+
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className={`w-3.5 h-3.5 ${policy.cpc_max ? 'text-blue-400' : 'text-muted-foreground opacity-30'}`} />
                                        <span className={`text-[10px] font-semibold uppercase tracking-tight ${policy.cpc_max ? 'text-foreground' : 'text-muted-foreground opacity-30'}`}>
                                            CPC R${policy.cpc_max}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-[9px] font-semibold text-muted-foreground pt-4 border-t border-border flex items-center gap-2 uppercase tracking-widest relative z-10">
                                <Activity className="w-3 h-3" /> IMPLEMENTADO EM {format(new Date(policy.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="glass-premium rounded-[3rem] p-24 text-center border-border shadow-2xl">
                    <div className="w-24 h-24 bg-ch-orange/5 border border-ch-orange/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                        <Shield className="w-10 h-10 text-ch-orange animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground uppercase tracking-tight mb-3">Ausência de Proteção</h3>
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto mb-8">Sua infraestrutura de compliance está vazia. Crie sua primeira política para blindar seus anúncios.</p>
                    <Button onClick={() => setIsDialogOpen(true)} className="bg-ch-orange hover:bg-ch-orange-hover text-black font-semibold uppercase text-[11px] tracking-widest h-14 px-10 rounded-[1.5rem] shadow-xl shadow-ch-orange/20 transition-all">
                        Implementar Protocolo Alfa
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
