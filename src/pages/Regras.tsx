import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Search,
    MoreHorizontal,
    Trash2,
    Loader2,
    ShieldCheck,
    Shield,
    Video,
    Image,
    Layers,
    ChevronDown,
    X,
    CheckCircle2,
    Zap,
    TrendingDown,
    MousePointerClick,
    DollarSign,
    Eye,
    Clock,
    PauseCircle,
    Bell,
    Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreativeRules, CreateCreativeRuleData } from '@/hooks/useCreativeRules';
import CreativeRuleCheckModal from '@/components/integrations/CreativeRuleCheckModal';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import { ComplianceReportOverlay } from '@/components/branding/ComplianceReportOverlay';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import {
    BRANDING_STEPS,
    mapFractionToStepIndex,
    mapProgressRange,
} from '@/components/common/syncLikeOverlayPresets';
import { useBatchCreativeRuleCheck, BatchCheckResultItem } from '@/hooks/useBatchCreativeRuleCheck';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useModule } from '@/contexts/ModuleContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProxiedImageUrl } from '@/lib/utils';
import { InfoTip } from '@/components/ui/info-tip';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { useTranslation } from 'react-i18next';
import { usePerformanceRuleBreakdown } from '@/hooks/usePerformanceRuleBreakdown';
import { PerformanceRuleExpandPanel } from '@/components/regras/PerformanceRuleExpandPanel';

const RULE_TYPE_LABELS: Record<string, string> = {
    content: 'Conteúdo',
    visual: 'Visual',
    copy: 'Copy',
    structure: 'Estrutura',
};

const APPLIES_TO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    all: { label: 'Todos', icon: Layers, color: 'text-muted-foreground' },
    video: { label: 'Vídeo', icon: Video, color: 'text-indigo-400' },
    image: { label: 'Imagem', icon: Image, color: 'text-blue-400' },
    carousel: { label: 'Carrossel', icon: Layers, color: 'text-emerald-400' },
};

const CONFORMITY_BADGE: Record<string, string> = {
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const CONFORMITY_LABELS: Record<string, string> = {
    error: 'Pausar anúncio',
    warning: 'Notificar',
    info: 'Info',
};

// ─── Structured Rule Builder ─────────────────────────────────────────────────

interface VisualRuleSpec {
    logo_required: boolean;
    logo_position: string; // '' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    allowed_colors: string; // comma-separated
    prohibited_colors: string; // comma-separated
    text_overlay_allowed: boolean;
    text_overlay_max_percent: string; // '10' | '20' | '30' | ''
    human_face_required: boolean;
    min_resolution: string; // '' | '720' | '1080'
    required_format: string; // '' | '1:1' | '9:16' | '16:9' | '4:5'
}

interface ContentRuleSpec {
    required_words: string; // comma-separated
    prohibited_words: string; // comma-separated
    cta_required: boolean;
    cta_terms: string; // comma-separated (ex: "Compre agora, Saiba mais")
    offer_required: boolean;
    tone: string; // '' | 'formal' | 'informal' | 'urgente' | 'educativo'
    subtitle_required: boolean;
    max_text_length: string; // '' or number
    headline_required: boolean;
    social_proof_required: boolean;
}

const EMPTY_VISUAL_SPEC: VisualRuleSpec = {
    logo_required: false,
    logo_position: 'none',
    allowed_colors: '',
    prohibited_colors: '',
    text_overlay_allowed: true,
    text_overlay_max_percent: 'none',
    human_face_required: false,
    min_resolution: 'none',
    required_format: 'none',
};

const EMPTY_CONTENT_SPEC: ContentRuleSpec = {
    required_words: '',
    prohibited_words: '',
    cta_required: false,
    cta_terms: '',
    offer_required: false,
    tone: 'none',
    subtitle_required: false,
    max_text_length: '',
    headline_required: false,
    social_proof_required: false,
};

const LOGO_POSITIONS = [
    { value: 'none', label: 'Qualquer posição' },
    { value: 'top-left', label: 'Canto superior esquerdo' },
    { value: 'top-right', label: 'Canto superior direito' },
    { value: 'bottom-left', label: 'Canto inferior esquerdo' },
    { value: 'bottom-right', label: 'Canto inferior direito' },
    { value: 'center', label: 'Centro' },
];

const TONE_OPTIONS = [
    { value: 'none', label: 'Sem restrição' },
    { value: 'formal', label: 'Formal / Profissional' },
    { value: 'informal', label: 'Informal / Descontraído' },
    { value: 'urgente', label: 'Urgente / Escassez' },
    { value: 'educativo', label: 'Educativo / Informativo' },
];

const FORMAT_OPTIONS = [
    { value: 'none', label: 'Sem restrição' },
    { value: '1:1', label: '1:1 (Feed quadrado)' },
    { value: '9:16', label: '9:16 (Stories / Reels)' },
    { value: '16:9', label: '16:9 (Vídeo horizontal)' },
    { value: '4:5', label: '4:5 (Feed vertical)' },
];

function buildRuleDefinition(type: string, visualSpec: VisualRuleSpec, contentSpec: ContentRuleSpec): string {
    const parts: string[] = [];

    if (type === 'visual') {
        if (visualSpec.logo_required) {
            const pos = LOGO_POSITIONS.find(p => p.value === visualSpec.logo_position);
            parts.push(`OBRIGATÓRIO: Logo da marca deve estar visível${visualSpec.logo_position && visualSpec.logo_position !== 'none' ? ` no ${pos?.label?.toLowerCase() || visualSpec.logo_position}` : ''}.`);
        }
        if (visualSpec.allowed_colors) {
            parts.push(`CORES PERMITIDAS: Apenas as cores ${visualSpec.allowed_colors}. Outras cores não são aceitas.`);
        }
        if (visualSpec.prohibited_colors) {
            parts.push(`CORES PROIBIDAS: As cores ${visualSpec.prohibited_colors} NÃO podem aparecer no criativo.`);
        }
        if (!visualSpec.text_overlay_allowed) {
            parts.push('PROIBIDO: Nenhum texto sobreposto à imagem/vídeo.');
        } else if (visualSpec.text_overlay_max_percent && visualSpec.text_overlay_max_percent !== 'none') {
            parts.push(`LIMITE DE TEXTO: Texto sobre a imagem deve ocupar no máximo ${visualSpec.text_overlay_max_percent}% da área visual.`);
        }
        if (visualSpec.human_face_required) {
            parts.push('OBRIGATÓRIO: O criativo deve conter rosto humano visível.');
        }
        if (visualSpec.min_resolution && visualSpec.min_resolution !== 'none') {
            parts.push(`RESOLUÇÃO MÍNIMA: O criativo deve ter no mínimo ${visualSpec.min_resolution}p de resolução.`);
        }
        if (visualSpec.required_format && visualSpec.required_format !== 'none') {
            const fmt = FORMAT_OPTIONS.find(f => f.value === visualSpec.required_format);
            parts.push(`FORMATO OBRIGATÓRIO: O criativo deve estar na proporção ${fmt?.label || visualSpec.required_format}.`);
        }
    } else {
        if (contentSpec.required_words) {
            parts.push(`PALAVRAS OBRIGATÓRIAS: O criativo DEVE conter as seguintes palavras/termos: ${contentSpec.required_words}.`);
        }
        if (contentSpec.prohibited_words) {
            parts.push(`PALAVRAS PROIBIDAS: O criativo NÃO pode conter as seguintes palavras/termos: ${contentSpec.prohibited_words}.`);
        }
        if (contentSpec.cta_required) {
            if (contentSpec.cta_terms) {
                parts.push(`CTA OBRIGATÓRIO: O criativo deve ter um Call to Action usando um dos termos: ${contentSpec.cta_terms}. Pode estar no botão Meta, no texto principal do anúncio ou visível na imagem/vídeo (ex.: botão gráfico ou frase imperativa).`);
            } else {
                parts.push('CTA OBRIGATÓRIO: O criativo deve ter um Call to Action claro e visível. Pode estar no botão Meta, no texto do anúncio ou na arte (imagem/vídeo).');
            }
        }
        if (contentSpec.offer_required) {
            parts.push('OFERTA OBRIGATÓRIA: O criativo deve mencionar claramente uma oferta, desconto ou benefício.');
        }
        if (contentSpec.tone && contentSpec.tone !== 'none') {
            const toneLabel = TONE_OPTIONS.find(t => t.value === contentSpec.tone)?.label || contentSpec.tone;
            parts.push(`TOM DE VOZ: O criativo deve usar tom ${toneLabel.toLowerCase()}.`);
        }
        if (contentSpec.subtitle_required) {
            parts.push('LEGENDA OBRIGATÓRIA: Vídeos devem conter legendas/subtítulos visíveis.');
        }
        if (contentSpec.headline_required) {
            parts.push('HEADLINE OBRIGATÓRIA: O criativo deve ter uma headline (título) clara e objetiva. Em criativos de imagem, a headline pode estar dentro da arte; em vídeo, deve aparecer no texto/caption Meta abaixo do anúncio.');
        }
        if (contentSpec.social_proof_required) {
            parts.push('PROVA SOCIAL OBRIGATÓRIA: O criativo deve conter prova social (depoimento, números, selos).');
        }
        if (contentSpec.max_text_length) {
            parts.push(`LIMITE DE TEXTO: O texto principal do criativo deve ter no máximo ${contentSpec.max_text_length} caracteres.`);
        }
    }

    return parts.join('\n');
}

function parseRuleDefinition(type: string, definition: string): { visualSpec: VisualRuleSpec; contentSpec: ContentRuleSpec } {
    const visualSpec = { ...EMPTY_VISUAL_SPEC };
    const contentSpec = { ...EMPTY_CONTENT_SPEC };
    if (!definition) return { visualSpec, contentSpec };

    if (type === 'visual') {
        if (definition.includes('Logo da marca deve estar visível')) {
            visualSpec.logo_required = true;
            for (const pos of LOGO_POSITIONS) {
                if (pos.value !== 'none' && definition.toLowerCase().includes(pos.label.toLowerCase())) {
                    visualSpec.logo_position = pos.value;
                    break;
                }
            }
        }
        const allowedMatch = definition.match(/CORES PERMITIDAS:.*?cores\s+(.+?)\./);
        if (allowedMatch) visualSpec.allowed_colors = allowedMatch[1].replace('Outras cores não são aceitas', '').trim();
        const prohibitedMatch = definition.match(/CORES PROIBIDAS:.*?cores\s+(.+?)\s+NÃO/);
        if (prohibitedMatch) visualSpec.prohibited_colors = prohibitedMatch[1];
        if (definition.includes('Nenhum texto sobreposto')) visualSpec.text_overlay_allowed = false;
        const textMatch = definition.match(/máximo\s+(\d+)%\s+da área visual/);
        if (textMatch) visualSpec.text_overlay_max_percent = textMatch[1];
        if (definition.includes('rosto humano')) visualSpec.human_face_required = true;
        const resMatch = definition.match(/mínimo\s+(\d+)p/);
        if (resMatch) visualSpec.min_resolution = resMatch[1];
        for (const fmt of FORMAT_OPTIONS) {
            if (fmt.value !== 'none' && definition.includes(fmt.value)) { visualSpec.required_format = fmt.value; break; }
        }
    } else {
        const reqWordsMatch = definition.match(/PALAVRAS OBRIGATÓRIAS:.*?termos:\s+(.+?)\./);
        if (reqWordsMatch) contentSpec.required_words = reqWordsMatch[1];
        const prohWordsMatch = definition.match(/PALAVRAS PROIBIDAS:.*?termos:\s+(.+?)\./);
        if (prohWordsMatch) contentSpec.prohibited_words = prohWordsMatch[1];
        if (definition.includes('CTA OBRIGATÓRIO')) {
            contentSpec.cta_required = true;
            const ctaMatch = definition.match(/termos:\s+(.+?)\./);
            if (ctaMatch && definition.includes('CTA OBRIGATÓRIO')) contentSpec.cta_terms = ctaMatch[1];
        }
        if (definition.includes('OFERTA OBRIGATÓRIA')) contentSpec.offer_required = true;
        for (const t of TONE_OPTIONS) {
            if (t.value !== 'none' && definition.toLowerCase().includes(`tom ${t.label.toLowerCase()}`)) { contentSpec.tone = t.value; break; }
        }
        if (definition.includes('LEGENDA OBRIGATÓRIA')) contentSpec.subtitle_required = true;
        if (definition.includes('HEADLINE OBRIGATÓRIA')) contentSpec.headline_required = true;
        if (definition.includes('PROVA SOCIAL OBRIGATÓRIA')) contentSpec.social_proof_required = true;
        const maxTextMatch = definition.match(/máximo\s+(\d+)\s+caracteres/);
        if (maxTextMatch) contentSpec.max_text_length = maxTextMatch[1];
    }

    return { visualSpec, contentSpec };
}

// ─── Performance Rules ────────────────────────────────────────────────────────

interface PerformanceRule {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_conditions: { metric: string; operator: string; threshold: number; window_days: number };
    action_type: string;
    action_config: Record<string, unknown>;
    applies_to?: string | null;
    status: string;
    last_triggered_at: string | null;
    trigger_count: number;
    created_at: string;
}

function invalidatePerformanceQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    companyId: string | undefined,
) {
    if (!companyId) return;
    queryClient.invalidateQueries({ queryKey: ['performance-rules', companyId] });
    queryClient.invalidateQueries({ queryKey: ['performance-compliance', companyId] });
    queryClient.invalidateQueries({ queryKey: ['performance-rule-breakdown', companyId] });
}

const METRIC_OPTIONS = [
    { value: 'ctr', label: 'CTR', unit: '%', icon: MousePointerClick, color: 'text-blue-400' },
    { value: 'cpc', label: 'CPC', unit: 'R$', icon: DollarSign, color: 'text-emerald-400' },
    { value: 'impressions', label: 'Impressões', unit: '', icon: Eye, color: 'text-purple-400' },
    { value: 'clicks', label: 'Cliques', unit: '', icon: MousePointerClick, color: 'text-indigo-400' },
    { value: 'conversions', label: 'Resultado', unit: '', icon: TrendingDown, color: 'text-rose-400' },
    { value: 'spend', label: 'Gasto Total', unit: 'R$', icon: DollarSign, color: 'text-amber-400' },
];

const OPERATOR_OPTIONS = [
    { value: 'lt', label: 'menor que (<)' },
    { value: 'lte', label: 'menor ou igual (≤)' },
    { value: 'gt', label: 'maior que (>)' },
    { value: 'gte', label: 'maior ou igual (≥)' },
];

const WINDOW_OPTIONS = [
    { value: 1, label: '1 dia' },
    { value: 3, label: '3 dias' },
    { value: 7, label: '7 dias' },
    { value: 14, label: '14 dias' },
    { value: 30, label: '30 dias' },
];

const ACTION_OPTIONS = [
    { value: 'pause_campaign', label: 'Pausar campanha', icon: PauseCircle, color: 'text-red-400' },
    { value: 'notify', label: 'Enviar notificação', icon: Bell, color: 'text-amber-400' },
];

function usePerformanceRules() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ['performance-rules', companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as PerformanceRule[];
        },
        enabled: !!companyId,
    });

    const createRule = useMutation({
        mutationFn: async (payload: Omit<PerformanceRule, 'id' | 'company_id' | 'last_triggered_at' | 'trigger_count' | 'created_at'>) => {
            if (!companyId) throw new Error('No company ID');
            const { error } = await supabase.from('automation_rules').insert({
                company_id: companyId,
                ...payload,
                status: 'active',
            });
            if (error) throw error;
        },
        onSuccess: () => {
            invalidatePerformanceQueries(queryClient, companyId);
            toast.success('Regra de performance criada!');
        },
        onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });

    const toggleRule = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const newStatus = status === 'active' ? 'paused' : 'active';
            const { error } = await supabase.from('automation_rules').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            return newStatus;
        },
        onSuccess: (s) => {
            invalidatePerformanceQueries(queryClient, companyId);
            toast.success(s === 'active' ? 'Regra ativada' : 'Regra pausada');
        },
    });

    const updateRule = useMutation({
        mutationFn: async ({ id, ...payload }: { id: string } & Partial<Omit<PerformanceRule, 'id' | 'company_id' | 'last_triggered_at' | 'trigger_count' | 'created_at'>>) => {
            if (!companyId) throw new Error('No company ID');
            const { error } = await supabase.from('automation_rules').update(payload).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidatePerformanceQueries(queryClient, companyId);
            toast.success('Regra de performance atualizada!');
        },
        onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });

    const deleteRule = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('automation_rules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidatePerformanceQueries(queryClient, companyId);
            toast.success('Regra excluída');
        },
    });

    return { rules, isLoading, createRule, updateRule, toggleRule, deleteRule };
}

// ─────────────────────────────────────────────────────────────────────────────

type CreativeItem = { id: string; name: string; type: string; image_url: string | null; video_url: string | null; external_id?: string | null };

function CreativePickerModal({
    isOpen, onClose, creatives, selectedIds, onToggle, onConfirm,
}: {
    isOpen: boolean; onClose: () => void; creatives: CreativeItem[];
    selectedIds: Set<string>; onToggle: (id: string) => void; onConfirm: () => void;
}) {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const filtered = useMemo(() => creatives.filter(c => {
        const matchesSearch = !search || (c.name || '').toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || c.type === typeFilter;
        return matchesSearch && matchesType;
    }), [creatives, search, typeFilter]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-ch-orange" /> Selecionar Criativos
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                        Escolha um ou mais criativos para verificar contra as regras ativas.
                    </DialogDescription>
                </div>

                <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0 bg-muted/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar criativo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-8 text-sm bg-background"
                            autoFocus
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {(['all', 'video', 'image', 'carousel'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${typeFilter === t ? 'bg-ch-orange text-black' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                            >
                                {t === 'all' ? 'Todos' : t === 'video' ? 'Vídeo' : t === 'image' ? 'Imagem' : 'Carrossel'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                            <Search className="w-8 h-8 opacity-30" />
                            <p className="text-sm font-medium">Nenhum criativo encontrado</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {filtered.map(c => {
                                const isSelected = selectedIds.has(c.id);
                                const thumb = getProxiedImageUrl(c.image_url) || c.video_url;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => onToggle(c.id)}
                                        className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all duration-200 ${isSelected ? 'border-ch-orange ring-2 ring-ch-orange/40 shadow-sm' : 'border-border hover:border-ch-orange/40 hover:shadow-md'}`}
                                    >
                                        <div className="aspect-[4/3] w-full bg-muted relative overflow-hidden flex items-center justify-center">
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt={c.name}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    onError={e => {
                                                        const img = e.target as HTMLImageElement;
                                                        img.style.display = 'none';
                                                        // Show sibling fallback
                                                        const fallback = img.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`flex flex-col items-center justify-center gap-1 text-muted-foreground/30 px-2 ${thumb ? 'hidden' : ''}`}>
                                                {c.type === 'video' ? <Video className="w-5 h-5" /> : <Image className="w-5 h-5" />}
                                                <span className="text-[7px] font-bold text-red-500 leading-tight text-center">Sem permissão</span>
                                            </div>
                                            <div className="absolute top-1.5 left-1.5">
                                                <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${c.type === 'video' ? 'bg-indigo-500/80 text-white' : 'bg-blue-500/80 text-white'}`}>
                                                    {c.type === 'video' ? 'Vídeo' : c.type === 'carousel' ? 'Carrossel' : 'Imagem'}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-ch-orange/20 flex items-center justify-center">
                                                    <div className="bg-ch-orange rounded-full p-1"><CheckCircle2 className="w-5 h-5 text-black" /></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2.5 bg-card border-t border-border">
                                            <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">{c.name || c.id}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-muted/50">
                    <p className="text-xs text-muted-foreground">
                        {selectedIds.size > 0
                            ? <span className="text-ch-orange font-bold">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
                            : `${filtered.length} criativo${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`
                        }
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                        <Button
                            size="sm"
                            onClick={() => { onConfirm(); onClose(); }}
                            disabled={selectedIds.size === 0}
                            className="bg-ch-orange text-black font-bold"
                        >
                            Confirmar ({selectedIds.size})
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Regras() {
    const { t } = useTranslation('rules');
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const { module } = useModule();
    const showBranding = module !== 'performance'; // null + branding mostram criativo
    const showPerformance = module !== 'branding'; // null + performance mostram performance
    const reduced = useReducedMotion();
    const { staggerContainer, fadeUp } = motionVariants(reduced);
    const companyId = user?.company?.id ?? user?.company_id ?? undefined;
    const { rules, isLoading, createRule, updateRule, deleteRule, toggleRule } = useCreativeRules();
    const { rules: perfRules, isLoading: perfLoading, createRule: createPerfRule, updateRule: updatePerfRule, toggleRule: togglePerfRule, deleteRule: deletePerfRule } = usePerformanceRules();
    const { getBreakdownForRule, isLoading: breakdownLoading } = usePerformanceRuleBreakdown();
    const [search, setSearch] = useState('');
    const [expandedPerfRuleId, setExpandedPerfRuleId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isPerfCreateOpen, setIsPerfCreateOpen] = useState(false);
    const [perfForm, setPerfForm] = useState({
        name: '',
        description: '',
        metric: 'ctr',
        operator: 'lt',
        threshold: '',
        window_days: 7,
        action_type: 'pause_campaign',
    });
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isRuleSelectorOpen, setIsRuleSelectorOpen] = useState(false);
    const [activeRuleIds, setActiveRuleIds] = useState<string[]>([]);
    const [checkModal, setCheckModal] = useState<{ creativeId: string; creativeName: string; imageUrl?: string | null; externalId?: string | null } | null>(null);
    const [selectedCreativeIds, setSelectedCreativeIds] = useState<Set<string>>(new Set());
    const [complianceOverlayOpen, setComplianceOverlayOpen] = useState(false);
    const [complianceOverlayItems, setComplianceOverlayItems] = useState<BatchCheckResultItem[]>([]);
    const [complianceApprovedCount, setComplianceApprovedCount] = useState(0);
    const { runBatch, isRunning: isBatchRunning } = useBatchCreativeRuleCheck();
    const [batchOverlayOpen, setBatchOverlayOpen] = useState(false);
    const [batchOverlayProgress, setBatchOverlayProgress] = useState(0);
    const [batchOverlayFinished, setBatchOverlayFinished] = useState(false);
    const [batchStepIndex, setBatchStepIndex] = useState(0);
    const [batchStepDetail, setBatchStepDetail] = useState('');
    const [batchOverlayTotal, setBatchOverlayTotal] = useState(0);
    const [batchOverlayCurrent, setBatchOverlayCurrent] = useState(0);
    const [typeTab, setTypeTab] = useState<string>('all');
    const [editingCreativeRuleId, setEditingCreativeRuleId] = useState<string | null>(null);
    const [editingPerfRuleId, setEditingPerfRuleId] = useState<string | null>(null);
    const legacyPerfRulesMigrated = useRef(false);

    const queryClient = useQueryClient();
    const { data: creatives } = useQuery({
        queryKey: ['creatives-list-for-rules', companyId, effectiveIds],
        queryFn: async () => {
            if (!companyId) return [];

            // Get campaigns from selected integrations
            let campaignQuery = supabase
                .from('campaigns')
                .select('id')
                .eq('company_id', companyId)
                .or('status.eq.active,status.eq.ACTIVE');
            if (effectiveIds.length > 0) {
                campaignQuery = campaignQuery.in('integration_id', effectiveIds);
            }
            const { data: campaigns } = await campaignQuery;
            const campaignIds = campaigns?.map(c => c.id) || [];
            if (campaignIds.length === 0) return [];

            const { data } = await supabase
                .from('creatives')
                .select('id, name, type, image_url, video_url, external_id')
                .eq('company_id', companyId)
                .in('campaign_id', campaignIds)
                .order('name')
                .limit(200);
            return (data || []) as CreativeItem[];
        },
        enabled: !!companyId,
    });

    // Auto-cache Facebook images to Supabase Storage (runs once per session)
    const cacheTriggered = useRef(false);
    useEffect(() => {
        if (!companyId || !creatives || cacheTriggered.current) return;
        const supabaseHost = import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || '';
        const hasUncached = creatives.some(c =>
            c.image_url && !c.image_url.includes(supabaseHost)
        );
        if (!hasUncached) return;
        cacheTriggered.current = true;
        supabase.functions.invoke('cache-creative-images', {
            body: { company_id: companyId, limit: 50 },
        }).then(() => {
            // Refetch creatives after caching to get updated URLs
            queryClient.invalidateQueries({ queryKey: ['creatives-list-for-rules', companyId] });
        }).catch(() => {});
    }, [companyId, creatives, queryClient]);

    // Regras legadas criadas com applies_to=campaign passam a valer só para criativos
    useEffect(() => {
        if (!companyId || perfLoading || legacyPerfRulesMigrated.current) return;
        const legacy = perfRules.filter(
            r => r.trigger_type === 'metric_threshold'
                && r.applies_to
                && r.applies_to !== 'ad'
                && r.applies_to !== 'all',
        );
        legacyPerfRulesMigrated.current = true;
        if (legacy.length === 0) return;

        void Promise.all(
            legacy.map(r =>
                supabase.from('automation_rules').update({ applies_to: 'ad' }).eq('id', r.id),
            ),
        ).then(() => {
            invalidatePerformanceQueries(queryClient, companyId);
        }).catch(() => {});
    }, [companyId, perfLoading, perfRules, queryClient]);

    const [formData, setFormData] = useState<Partial<CreateCreativeRuleData>>({
        name: '',
        description: '',
        rule_type: 'content',
        rule_definition: '',
        applies_to: 'all',
        severity: 'warning',
        is_active: true,
        logo_url: null,
    });
    const [visualSpec, setVisualSpec] = useState<VisualRuleSpec>({ ...EMPTY_VISUAL_SPEC });
    const [contentSpec, setContentSpec] = useState<ContentRuleSpec>({ ...EMPTY_CONTENT_SPEC });
    const [logoUploading, setLogoUploading] = useState(false);

    const resetCreativeForm = () => {
        setFormData({
            name: '',
            description: '',
            rule_type: 'content',
            rule_definition: '',
            applies_to: 'all',
            severity: 'warning',
            is_active: true,
            logo_url: null,
        });
        setVisualSpec({ ...EMPTY_VISUAL_SPEC });
        setContentSpec({ ...EMPTY_CONTENT_SPEC });
        setEditingCreativeRuleId(null);
    };

    const handleLogoUpload = async (file: File) => {
        if (!companyId) {
            toast.error('Empresa não identificada. Recarregue a página.');
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast.error('Selecione um arquivo de imagem.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('A imagem deve ter no máximo 5 MB.');
            return;
        }
        setLogoUploading(true);
        try {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
            const path = `${companyId}/logos/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('rule-assets').upload(path, file, {
                cacheControl: '3600',
                contentType: file.type,
            });
            if (upErr) throw upErr;
            const { data: pub } = supabase.storage.from('rule-assets').getPublicUrl(path);
            setFormData(f => ({ ...f, logo_url: pub.publicUrl }));
            toast.success('Logo enviado.');
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : 'Falha ao enviar o logo.';
            toast.error(message);
        } finally {
            setLogoUploading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name) return;
        const ruleDef = buildRuleDefinition(formData.rule_type || 'content', visualSpec, contentSpec);
        if (!ruleDef) {
            toast.error('Ative pelo menos um critério na regra (ex.: logo, palavras, CTA).');
            return;
        }
        // Only include logo_url in the payload when set — keeps inserts working in environments
        // where the 20260529 migration (adds creative_rules.logo_url) hasn't been applied yet.
        const { logo_url, ...rest } = formData;
        const payload = {
            ...rest,
            description: formData.description?.trim() ? formData.description : null,
            rule_definition: ruleDef,
            ...(logo_url ? { logo_url } : {}),
        } as CreateCreativeRuleData;
        try {
            if (editingCreativeRuleId) {
                await updateRule.mutateAsync({ id: editingCreativeRuleId, ...payload });
            } else {
                await createRule.mutateAsync(payload);
            }
            setIsCreateOpen(false);
            resetCreativeForm();
        } catch (error) {
            console.error(error);
        }
    };

    // Auto-generate description from specs for display
    const currentRuleDef = buildRuleDefinition(formData.rule_type || 'content', visualSpec, contentSpec);
    const hasAnySpec = currentRuleDef.length > 0;

    const handleEditCreativeRule = (rule: typeof filteredRules[0]) => {
        setEditingCreativeRuleId(rule.id);
        const parsed = parseRuleDefinition(rule.rule_type, rule.rule_definition);
        setVisualSpec(parsed.visualSpec);
        setContentSpec(parsed.contentSpec);
        setFormData({
            name: rule.name,
            description: rule.description || '',
            rule_type: rule.rule_type,
            rule_definition: rule.rule_definition,
            applies_to: rule.applies_to,
            severity: rule.severity,
            is_active: rule.is_active,
            logo_url: rule.logo_url ?? null,
        });
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta regra?')) {
            await deleteRule.mutateAsync(id);
        }
    };

    const handleToggleCreative = (id: string) => {
        setSelectedCreativeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleOpenCheck = () => {
        if (selectedCreativeIds.size === 0) return;
        setIsRuleSelectorOpen(true);
    };

    const startCheckWithRules = async (ruleIds: string[]) => {
        const queue = (creatives || []).filter(c => selectedCreativeIds.has(c.id));
        if (queue.length === 0) return;
        setActiveRuleIds(ruleIds);
        setBatchOverlayOpen(true);
        setBatchOverlayFinished(false);
        setBatchOverlayProgress(0);
        setBatchStepIndex(0);
        setBatchStepDetail('Preparando verificação...');
        setBatchOverlayTotal(queue.length);
        setBatchOverlayCurrent(0);

        try {
            const bootstrapStart = Date.now();
            while (Date.now() - bootstrapStart < 1500) {
                setBatchOverlayProgress(Math.round(((Date.now() - bootstrapStart) / 1500) * 10));
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const { results, nonCompliant } = await runBatch({
                creatives: queue.map(c => ({
                    id: c.id,
                    name: c.name,
                    image_url: c.image_url,
                    external_id: c.external_id ?? null,
                })),
                ruleIds,
                onProgress: (p) => {
                    setBatchOverlayCurrent(p.current);
                    setBatchOverlayTotal(p.total);
                    setBatchOverlayProgress(mapProgressRange(p.current, p.total, 10, 90));
                    setBatchStepIndex(mapFractionToStepIndex(p.current / p.total, BRANDING_STEPS.length));
                    setBatchStepDetail(`${p.creativeName} (${p.current}/${p.total})`);
                },
            });

            setBatchOverlayFinished(true);
            setBatchStepIndex(BRANDING_STEPS.length - 1);
            setBatchStepDetail('Concluído!');
            for (let p = 90; p <= 100; p += 2) {
                setBatchOverlayProgress(p);
                await new Promise((resolve) => setTimeout(resolve, 80));
            }
            await new Promise((resolve) => setTimeout(resolve, 800));

            setComplianceApprovedCount(results.length - nonCompliant.length);
            setComplianceOverlayItems(nonCompliant);

            if (nonCompliant.length > 0) {
                setComplianceOverlayOpen(true);
            } else {
                toast.success('Todos os criativos estão em conformidade!');
            }
        } catch {
            // toast handled in hook
        } finally {
            setBatchOverlayOpen(false);
            setBatchOverlayFinished(false);
            setBatchOverlayProgress(0);
            setBatchStepIndex(0);
            setBatchStepDetail('');
        }
    };

    const resetPerfForm = () => {
        setPerfForm({ name: '', description: '', metric: 'ctr', operator: 'lt', threshold: '', window_days: 7, action_type: 'pause_campaign' });
        setEditingPerfRuleId(null);
    };

    const handleCreatePerfRule = async () => {
        if (!perfForm.name || !perfForm.threshold) return;
        const payload = {
            name: perfForm.name,
            description: perfForm.description || null,
            trigger_type: 'metric_threshold',
            trigger_conditions: {
                metric: perfForm.metric,
                operator: perfForm.operator,
                threshold: parseFloat(perfForm.threshold),
                window_days: perfForm.window_days,
            },
            action_type: perfForm.action_type,
            action_config: {},
            applies_to: 'ad',
            status: 'active',
        };
        if (editingPerfRuleId) {
            await updatePerfRule.mutateAsync({ id: editingPerfRuleId, ...payload });
        } else {
            await createPerfRule.mutateAsync(payload);
        }
        setIsPerfCreateOpen(false);
        resetPerfForm();
    };

    const handleEditPerfRule = (rule: PerformanceRule) => {
        setEditingPerfRuleId(rule.id);
        const conds = rule.trigger_conditions;
        setPerfForm({
            name: rule.name,
            description: rule.description || '',
            metric: conds?.metric || 'ctr',
            operator: conds?.operator || 'lt',
            threshold: String(conds?.threshold ?? ''),
            window_days: conds?.window_days || 7,
            action_type: rule.action_type || 'pause_campaign',
        });
        setIsPerfCreateOpen(true);
    };

    const selectedCreatives = (creatives || []).filter(c => selectedCreativeIds.has(c.id));
    const filteredRules = rules?.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) &&
        (typeTab === 'all' || r.applies_to === typeTab)
    ) || [];

    const filteredPerfRules = perfRules.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="p-4 md:p-8 space-y-6 md:space-y-8"
        >
            <motion.div variants={fadeUp}>
                <SectionHeader
                    title={
                        module === 'branding' ? 'Regras de Branding'
                            : module === 'performance' ? 'Regras de Performance'
                            : 'Regras'
                    }
                    description={
                        module === 'performance'
                            ? 'Defina limites de métricas para pausar ou notificar campanhas automaticamente.'
                            : 'Defina o que seus criativos devem ter. A IA verifica cada criativo contra as regras e mostra o resultado.'
                    }
                    size="large"
                    actions={
                        <DropdownMenu>
                            <InfoTip title="Nova regra" hint="Cria uma regra de Criativo (o que a IA verifica no anúncio) ou de Performance (pausar/avisar quando uma métrica sai do esperado).">
                              <DropdownMenuTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 md:px-8 h-11 rounded-xl shadow-sm transition-all">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Nova Regra
                                    <ChevronDown className="w-4 h-4 ml-2" />
                                </Button>
                              </DropdownMenuTrigger>
                            </InfoTip>
                            <DropdownMenuContent align="end" className="w-64">
                                {showBranding && (
                                    <DropdownMenuItem onClick={() => { resetCreativeForm(); setIsCreateOpen(true); }} className="flex items-center gap-3 p-3 cursor-pointer">
                                        <div className="p-2 rounded-lg bg-ch-orange/10">
                                            <Shield className="w-4 h-4 text-ch-orange" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Regra de Criativo</p>
                                            <p className="text-[10px] text-muted-foreground">O que a IA deve verificar no criativo</p>
                                        </div>
                                    </DropdownMenuItem>
                                )}
                                {showBranding && showPerformance && <DropdownMenuSeparator />}
                                {showPerformance && (
                                    <DropdownMenuItem onClick={() => setIsPerfCreateOpen(true)} className="flex items-center gap-3 p-3 cursor-pointer">
                                        <div className="p-2 rounded-lg bg-ch-orange/10">
                                            <Zap className="w-4 h-4 text-ch-orange" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Regra de Performance</p>
                                            <p className="text-[10px] text-muted-foreground">Pausar ou notificar por métrica</p>
                                        </div>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    }
                />
            </motion.div>

            {/* Search bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-muted/50 border border-border p-4 rounded-[1.5rem]">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="BUSCAR REGRAS..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-14 bg-transparent border-none text-xs font-bold uppercase tracking-widest h-12"
                    />
                </div>
            </div>

            {/* Verify creative panel */}
            {showBranding && (creatives?.length ?? 0) > 0 && (
                <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-ch-orange/10 border border-ch-orange/30 rounded-2xl">
                    <div className="flex-1 space-y-1 w-full">
                        <Label className="text-xs font-semibold uppercase tracking-widest text-ch-orange flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verificar Criativos com a IA
                        </Label>
                        <button
                            onClick={() => setIsPickerOpen(true)}
                            className="w-full flex items-center gap-3 h-12 px-3 rounded-lg border border-border bg-background hover:border-ch-orange/50 transition-all text-left group"
                        >
                            {selectedCreatives.length > 0 ? (
                                <>
                                    {/* Thumbnails empilhados */}
                                    <div className="flex -space-x-2 flex-shrink-0">
                                        {selectedCreatives.slice(0, 4).map((c, i) => (
                                            <div key={c.id} className="w-8 h-8 rounded-md overflow-hidden bg-muted border-2 border-background flex-shrink-0" style={{ zIndex: 4 - i }}>
                                                {(c.image_url || c.video_url) ? (
                                                    <img
                                                        src={getProxiedImageUrl(c.image_url) || c.video_url || ''}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        onError={e => {
                                                            const img = e.target as HTMLImageElement;
                                                            img.style.display = 'none';
                                                            const fallback = img.nextElementSibling as HTMLElement;
                                                            if (fallback) fallback.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`w-full h-full items-center justify-center bg-red-500/5 ${(c.image_url || c.video_url) ? 'hidden' : 'flex'}`}>
                                                    {c.type === 'video' ? <Video className="w-3 h-3 text-red-400" /> : <Image className="w-3 h-3 text-red-400" />}
                                                </div>
                                            </div>
                                        ))}
                                        {selectedCreatives.length > 4 && (
                                            <div className="w-8 h-8 rounded-md bg-muted border-2 border-background flex items-center justify-center flex-shrink-0 z-0">
                                                <span className="text-[9px] font-semibold text-muted-foreground">+{selectedCreatives.length - 4}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {selectedCreatives.length} criativo{selectedCreatives.length !== 1 ? 's' : ''} selecionado{selectedCreatives.length !== 1 ? 's' : ''}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Clique para alterar a seleção</p>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); setSelectedCreativeIds(new Set()); }} className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                        <Shield className="w-4 h-4 text-muted-foreground/50" />
                                    </div>
                                    <span className="text-sm text-muted-foreground flex-1">Clique para selecionar criativos...</span>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                </>
                            )}
                        </button>
                    </div>
                    <InfoTip title="Verificar com a IA" hint="Roda a auditoria de branding nos criativos selecionados, conferindo cada um contra as regras escolhidas.">
                    <Button
                        onClick={handleOpenCheck}
                        disabled={selectedCreativeIds.size === 0}
                        className="bg-ch-orange hover:bg-ch-orange-hover text-black font-semibold uppercase tracking-widest h-12 px-6"
                    >
                        <ShieldCheck className="w-4 h-4 mr-2" /> Verificar {selectedCreativeIds.size > 1 ? `(${selectedCreativeIds.size})` : ''}
                    </Button>
                    </InfoTip>
                </div>
            )}

            {/* ─── Performance Rules Section ─────────────────────────────────────── */}
            {showPerformance && (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-ch-orange" />
                    <div>
                        <h2 className="text-xl font-semibold text-foreground uppercase tracking-tight">Regras de Performance</h2>
                        <p className="text-xs text-muted-foreground font-medium">Pausar campanha ou notificar quando uma métrica não atingir o mínimo esperado.</p>
                    </div>
                </div>

                {perfLoading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-ch-orange" /></div>
                ) : filteredPerfRules.length > 0 ? (
                    <div className="grid gap-3">
                        {filteredPerfRules.map((rule) => {
                            const conds = rule.trigger_conditions;
                            const metricMeta = METRIC_OPTIONS.find(m => m.value === conds?.metric);
                            const MetricIcon = metricMeta?.icon || Zap;
                            const opLabel = OPERATOR_OPTIONS.find(o => o.value === conds?.operator)?.label || conds?.operator;
                            const actionMeta = ACTION_OPTIONS.find(a => a.value === rule.action_type);
                            const ActionIcon = actionMeta?.icon || Bell;
                            const isActive = rule.status === 'active';
                            const isExpanded = expandedPerfRuleId === rule.id;
                            const panelId = `perf-rule-panel-${rule.id}`;
                            const breakdown = getBreakdownForRule(rule);
                            const showCounts = !breakdownLoading;

                            return (
                                <motion.div
                                    key={rule.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`group bg-card border rounded-2xl p-5 transition-all shadow-sm ${isActive ? 'border-border hover:border-ch-orange/30' : 'border-border/40 opacity-60'} ${isExpanded ? 'ring-1 ring-ch-orange/20' : 'hover-lift'}`}
                                >
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={isExpanded}
                                        aria-controls={panelId}
                                        onClick={() => setExpandedPerfRuleId(isExpanded ? null : rule.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setExpandedPerfRuleId(isExpanded ? null : rule.id);
                                            }
                                        }}
                                        className="flex items-center gap-4 cursor-pointer"
                                    >
                                        <div className={`p-3 rounded-xl ${isActive ? 'bg-ch-orange/10' : 'bg-muted'}`}>
                                            <Zap className={`w-5 h-5 ${isActive ? 'text-ch-orange' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h4 className="font-bold text-foreground group-hover:text-ch-orange transition-colors">{rule.name}</h4>
                                                {!isActive && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Pausada</span>}
                                                {showCounts && (
                                                    <span className="text-[10px] font-medium text-muted-foreground">
                                                        {breakdown.counts.compliant} ok · {breakdown.counts.violating} fora
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mb-1">{t('performance.expandHint')}</p>
                                            {conds?.metric && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-lg text-xs font-medium">
                                                        <MetricIcon className={`w-3.5 h-3.5 ${metricMeta?.color || 'text-muted-foreground'}`} />
                                                        <span className="font-bold">{metricMeta?.label || conds.metric}</span>
                                                        <span className="text-muted-foreground">{opLabel}</span>
                                                        <span className="font-semibold text-foreground">
                                                            {metricMeta?.unit === 'R$' ? `R$ ${conds.threshold}` : metricMeta?.unit === '%' ? `${conds.threshold}%` : conds.threshold}
                                                        </span>
                                                        <span className="text-muted-foreground">em</span>
                                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                                        <span>{conds.window_days}d</span>
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">→</span>
                                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${rule.action_type === 'pause_campaign' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                        <ActionIcon className="w-3.5 h-3.5" />
                                                        {actionMeta?.label}
                                                    </div>
                                                    {rule.trigger_count > 0 && (
                                                        <span className="text-[10px] text-muted-foreground">· ativada {rule.trigger_count}x</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <ChevronDown
                                            className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-ch-orange' : ''}`}
                                        />
                                        <div
                                            className="flex items-center gap-2 flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Ativa</span>
                                                <Switch
                                                    checked={isActive}
                                                    onCheckedChange={() => togglePerfRule.mutate({ id: rule.id, status: rule.status })}
                                                />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-muted">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground">Ações</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleEditPerfRule(rule)}>
                                                        <Pencil className="w-4 h-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => deletePerfRule.mutate(rule.id)} className="text-red-500 focus:text-red-500">
                                                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <PerformanceRuleExpandPanel
                                                key={rule.id}
                                                rule={rule}
                                                breakdown={breakdown}
                                                isLoading={breakdownLoading}
                                                panelId={panelId}
                                            />
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : perfRules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-2xl gap-3 bg-muted/50">
                        <Zap className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-sm font-bold text-muted-foreground">Nenhuma regra de performance ainda</p>
                        <p className="text-xs text-muted-foreground max-w-xs text-center">Crie uma regra para pausar automaticamente campanhas que não atingem uma métrica esperada.</p>
                    </div>
                ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma regra encontrada para &quot;{search}&quot;.
                    </div>
                )}
            </div>
            )}

            {/* Divider + Type Filter */}
            {showBranding && (
            <>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-widest">
                        <Shield className="w-3.5 h-3.5" /> Regras de Qualidade de Criativo
                    </div>
                    <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {([
                        { value: 'all',      label: 'Todos',      icon: Layers },
                        { value: 'video',    label: 'Vídeo',      icon: Video  },
                        { value: 'image',    label: 'Imagem',     icon: Image  },
                        { value: 'carousel', label: 'Carrossel',  icon: Layers },
                    ] as const).map(({ value, label, icon: Icon }) => {
                        const count = value === 'all'
                            ? (rules?.length ?? 0)
                            : (rules?.filter(r => r.applies_to === value).length ?? 0);
                        const isActive = typeTab === value;
                        return (
                            <button
                                key={value}
                                onClick={() => setTypeTab(value)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    isActive
                                        ? 'bg-ch-orange/10 text-ch-orange border-ch-orange/30 shadow-sm'
                                        : 'bg-muted text-muted-foreground border-border hover:text-foreground hover:border-border/80'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                    isActive ? 'bg-ch-orange/20 text-ch-orange' : 'bg-background text-muted-foreground'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Rules list */}
            {isLoading ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-ch-orange" />
                </div>
            ) : filteredRules.length > 0 ? (
                <div className="grid gap-4">
                    <AnimatePresence>
                        {filteredRules.map((rule) => {
                            const appliesToConf = APPLIES_TO_CONFIG[rule.applies_to] || APPLIES_TO_CONFIG.all;
                            const AppliesToIcon = appliesToConf.icon;
                            return (
                                <motion.div
                                    key={rule.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="group bg-card border border-border rounded-2xl p-6 hover:border-ch-orange/30 transition-all shadow-sm hover-lift"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className={`p-3 rounded-xl ${rule.is_active ? 'bg-ch-orange/10 text-ch-orange' : 'bg-muted text-muted-foreground'}`}>
                                                <Shield className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center flex-wrap gap-2 mb-1">
                                                    <h3 className="text-lg font-bold text-foreground group-hover:text-ch-orange transition-colors">
                                                        {rule.name}
                                                    </h3>
                                                    <Badge variant="outline" className={`text-[10px] font-bold border ${CONFORMITY_BADGE[rule.severity]}`}>
                                                        {rule.severity === 'error' ? 'Pausar anúncio' : 'Notificar'}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] font-medium">
                                                        {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                                                    </Badge>
                                                    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase ${appliesToConf.color}`}>
                                                        <AppliesToIcon className="w-3 h-3" />
                                                        {appliesToConf.label}
                                                    </div>
                                                </div>
                                                {rule.description && (
                                                    <p className="text-xs text-muted-foreground font-medium mt-1">{rule.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 self-end md:self-center">
                                            <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg border border-border">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Ativa</span>
                                                <Switch
                                                    checked={rule.is_active}
                                                    onCheckedChange={() => toggleRule.mutate({ id: rule.id, is_active: rule.is_active })}
                                                />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg hover:bg-muted">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 font-medium">
                                                    <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground">Ações</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleEditCreativeRule(rule)}>
                                                        <Pencil className="w-4 h-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(rule.id)}
                                                        className="text-red-500 focus:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="p-6 bg-muted rounded-full">
                        {typeTab === 'video' ? <Video className="w-12 h-12 text-muted-foreground/50" /> :
                         typeTab === 'image' ? <Image className="w-12 h-12 text-muted-foreground/50" /> :
                         typeTab === 'carousel' ? <Layers className="w-12 h-12 text-muted-foreground/50" /> :
                         <Shield className="w-12 h-12 text-muted-foreground/50" />}
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-foreground">
                            {typeTab === 'all'
                                ? 'Sem regras de criativo'
                                : `Nenhuma regra para ${APPLIES_TO_CONFIG[typeTab]?.label || typeTab}`}
                        </h3>
                        <p className="text-muted-foreground max-w-sm">
                            {typeTab === 'all'
                                ? <>Crie regras para definir o que seus criativos devem ter.<br />Ex: "Vídeo obrigatoriamente com legenda", "CTA obrigatório".</>
                                : `Crie uma regra específica para ${APPLIES_TO_CONFIG[typeTab]?.label || typeTab} clicando em "Nova Regra".`}
                        </p>
                    </div>
                    {typeTab !== 'all' && (
                        <Button onClick={() => { resetCreativeForm(); setIsCreateOpen(true); }} variant="outline" size="sm">
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar regra para {APPLIES_TO_CONFIG[typeTab]?.label}
                        </Button>
                    )}
                </div>
            )}
            </>
            )}
            {/* /showBranding */}

            {/* Creative Picker Modal */}
            <CreativePickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                creatives={creatives || []}
                selectedIds={selectedCreativeIds}
                onToggle={handleToggleCreative}
                onConfirm={() => setIsPickerOpen(false)}
            />

            {/* Create Rule Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreativeForm(); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                    <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Shield className="w-5 h-5 text-ch-orange" /> {editingCreativeRuleId ? 'Editar Regra' : 'Nova Regra de Criativo'}
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-1">
                            Configure exatamente o que pode e o que não pode no criativo.
                        </DialogDescription>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Nome + Tipo + Aplica-se a */}
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome da Regra <span className="text-red-400">*</span></Label>
                                <Input
                                    placeholder="Ex: Padrão visual do banner"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="h-11"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipo</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { value: 'content', label: 'Conteúdo', icon: Layers },
                                            { value: 'visual', label: 'Visual', icon: Image },
                                        ] as const).map(t => (
                                            <button
                                                key={t.value}
                                                onClick={() => setFormData({ ...formData, rule_type: t.value })}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${formData.rule_type === t.value ? 'border-ch-orange bg-ch-orange/10 text-ch-orange' : 'border-border bg-muted/50 text-muted-foreground hover:border-ch-orange/40 hover:text-foreground'}`}
                                            >
                                                <t.icon className="w-4 h-4" />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aplica-se a</Label>
                                    <Select
                                        value={formData.applies_to}
                                        onValueChange={v => setFormData({ ...formData, applies_to: v as CreateCreativeRuleData['applies_to'] })}
                                    >
                                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os criativos</SelectItem>
                                            <SelectItem value="video">Apenas Vídeos</SelectItem>
                                            <SelectItem value="image">Apenas Imagens</SelectItem>
                                            <SelectItem value="carousel">Apenas Carrossel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* ─── VISUAL BUILDER ─── */}
                        {formData.rule_type === 'visual' && (
                            <div className="space-y-4 p-4 rounded-2xl border border-border bg-muted/50">
                                <p className="text-xs font-semibold uppercase tracking-widest text-ch-orange flex items-center gap-2">
                                    <Image className="w-3.5 h-3.5" /> Elementos Visuais
                                </p>

                                {/* Logo */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Logo obrigatório</p>
                                        <p className="text-[10px] text-muted-foreground">O logo da marca deve aparecer no criativo</p>
                                    </div>
                                    <Switch checked={visualSpec.logo_required} onCheckedChange={v => setVisualSpec({ ...visualSpec, logo_required: v })} />
                                </div>
                                {visualSpec.logo_required && (
                                    <div className="pl-4 grid gap-3">
                                        <div className="grid gap-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Posição do logo</Label>
                                            <Select value={visualSpec.logo_position} onValueChange={v => setVisualSpec({ ...visualSpec, logo_position: v })}>
                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Qualquer posição" /></SelectTrigger>
                                                <SelectContent>
                                                    {LOGO_POSITIONS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Imagem do logo (referência)</Label>
                                            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-background">
                                                {formData.logo_url ? (
                                                    <>
                                                        <img
                                                            src={formData.logo_url}
                                                            alt="Logo"
                                                            className="w-14 h-14 rounded-md object-contain bg-muted/50 border border-border"
                                                            onError={() => {
                                                                toast.error('Não foi possível carregar a prévia do logo. Verifique o upload.');
                                                            }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-foreground truncate">Logo carregado</p>
                                                            <p className="text-[10px] text-muted-foreground">A IA usará esta imagem como referência.</p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setFormData(f => ({ ...f, logo_url: null }))}
                                                            className="h-8 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5 mr-1" /> Remover
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                                            <Image className="w-5 h-5 text-muted-foreground/40" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-foreground">Subir logo do cliente</p>
                                                            <p className="text-[10px] text-muted-foreground">PNG ou JPG, até 5 MB.</p>
                                                        </div>
                                                        <label className="inline-flex">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                disabled={logoUploading}
                                                                onChange={e => {
                                                                    const file = e.target.files?.[0];
                                                                    e.target.value = '';
                                                                    if (file) void handleLogoUpload(file);
                                                                }}
                                                            />
                                                            <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold cursor-pointer transition-colors ${logoUploading ? 'bg-muted text-muted-foreground' : 'bg-ch-orange/10 text-ch-orange hover:bg-ch-orange/20'}`}>
                                                                {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                                {logoUploading ? 'Enviando...' : 'Selecionar'}
                                                            </span>
                                                        </label>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Cores */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-emerald-500">Cores permitidas</Label>
                                        <Input
                                            placeholder="azul, branco, preto"
                                            value={visualSpec.allowed_colors}
                                            onChange={e => setVisualSpec({ ...visualSpec, allowed_colors: e.target.value })}
                                            className="h-9 text-xs"
                                        />
                                        <p className="text-[9px] text-muted-foreground">Separe por vírgula</p>
                                    </div>
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-red-400">Cores proibidas</Label>
                                        <Input
                                            placeholder="vermelho, rosa"
                                            value={visualSpec.prohibited_colors}
                                            onChange={e => setVisualSpec({ ...visualSpec, prohibited_colors: e.target.value })}
                                            className="h-9 text-xs"
                                        />
                                        <p className="text-[9px] text-muted-foreground">Separe por vírgula</p>
                                    </div>
                                </div>

                                {/* Texto sobre imagem */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Texto sobre imagem</p>
                                        <p className="text-[10px] text-muted-foreground">Permitir texto sobreposto ao visual</p>
                                    </div>
                                    <Switch checked={visualSpec.text_overlay_allowed} onCheckedChange={v => setVisualSpec({ ...visualSpec, text_overlay_allowed: v })} />
                                </div>
                                {visualSpec.text_overlay_allowed && (
                                    <div className="pl-4 grid gap-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Máximo de texto sobre a imagem</Label>
                                        <Select value={visualSpec.text_overlay_max_percent} onValueChange={v => setVisualSpec({ ...visualSpec, text_overlay_max_percent: v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sem limite" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">Sem limite</SelectItem>
                                                <SelectItem value="10" className="text-xs">Máximo 10%</SelectItem>
                                                <SelectItem value="20" className="text-xs">Máximo 20% (recomendado Meta)</SelectItem>
                                                <SelectItem value="30" className="text-xs">Máximo 30%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Rosto humano */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Rosto humano obrigatório</p>
                                        <p className="text-[10px] text-muted-foreground">O criativo deve ter um rosto visível</p>
                                    </div>
                                    <Switch checked={visualSpec.human_face_required} onCheckedChange={v => setVisualSpec({ ...visualSpec, human_face_required: v })} />
                                </div>

                                {/* Resolução + Formato */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Resolução mínima</Label>
                                        <Select value={visualSpec.min_resolution} onValueChange={v => setVisualSpec({ ...visualSpec, min_resolution: v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sem restrição" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">Sem restrição</SelectItem>
                                                <SelectItem value="720" className="text-xs">720p (HD)</SelectItem>
                                                <SelectItem value="1080" className="text-xs">1080p (Full HD)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Formato obrigatório</Label>
                                        <Select value={visualSpec.required_format} onValueChange={v => setVisualSpec({ ...visualSpec, required_format: v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sem restrição" /></SelectTrigger>
                                            <SelectContent>
                                                {FORMAT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── CONTENT BUILDER ─── */}
                        {formData.rule_type === 'content' && (
                            <div className="space-y-4 p-4 rounded-2xl border border-border bg-muted/50">
                                <p className="text-xs font-semibold uppercase tracking-widest text-ch-orange flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" /> Elementos de Conteúdo
                                </p>

                                {/* Palavras */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-emerald-500">Palavras obrigatórias</Label>
                                        <Input
                                            placeholder="oferta, grátis, desconto"
                                            value={contentSpec.required_words}
                                            onChange={e => setContentSpec({ ...contentSpec, required_words: e.target.value })}
                                            className="h-9 text-xs"
                                        />
                                        <p className="text-[9px] text-muted-foreground">Separe por vírgula</p>
                                    </div>
                                    <div className="grid gap-2 p-3 rounded-xl border border-border bg-background">
                                        <Label className="text-[10px] font-bold uppercase text-red-400">Palavras proibidas</Label>
                                        <Input
                                            placeholder="garantido, milagre"
                                            value={contentSpec.prohibited_words}
                                            onChange={e => setContentSpec({ ...contentSpec, prohibited_words: e.target.value })}
                                            className="h-9 text-xs"
                                        />
                                        <p className="text-[9px] text-muted-foreground">Separe por vírgula</p>
                                    </div>
                                </div>

                                {/* CTA */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">CTA obrigatório</p>
                                        <p className="text-[10px] text-muted-foreground">Call to Action visível no criativo</p>
                                    </div>
                                    <Switch checked={contentSpec.cta_required} onCheckedChange={v => setContentSpec({ ...contentSpec, cta_required: v })} />
                                </div>
                                {contentSpec.cta_required && (
                                    <div className="pl-4 grid gap-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Termos de CTA aceitos (opcional)</Label>
                                        <Input
                                            placeholder="Compre agora, Saiba mais, Cadastre-se"
                                            value={contentSpec.cta_terms}
                                            onChange={e => setContentSpec({ ...contentSpec, cta_terms: e.target.value })}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                )}

                                {/* Oferta */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Menção de oferta/desconto</p>
                                        <p className="text-[10px] text-muted-foreground">Obrigar menção de oferta ou benefício</p>
                                    </div>
                                    <Switch checked={contentSpec.offer_required} onCheckedChange={v => setContentSpec({ ...contentSpec, offer_required: v })} />
                                </div>

                                {/* Headline */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Headline obrigatória</p>
                                        <p className="text-[10px] text-muted-foreground">Título claro e objetivo</p>
                                    </div>
                                    <Switch checked={contentSpec.headline_required} onCheckedChange={v => setContentSpec({ ...contentSpec, headline_required: v })} />
                                </div>

                                {/* Prova Social */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Prova social obrigatória</p>
                                        <p className="text-[10px] text-muted-foreground">Depoimento, números ou selos</p>
                                    </div>
                                    <Switch checked={contentSpec.social_proof_required} onCheckedChange={v => setContentSpec({ ...contentSpec, social_proof_required: v })} />
                                </div>

                                {/* Legenda em vídeo */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Legenda em vídeo</p>
                                        <p className="text-[10px] text-muted-foreground">Subtítulos obrigatórios em vídeos</p>
                                    </div>
                                    <Switch checked={contentSpec.subtitle_required} onCheckedChange={v => setContentSpec({ ...contentSpec, subtitle_required: v })} />
                                </div>

                            </div>
                        )}

                        {/* Preview da regra gerada */}
                        {hasAnySpec && (
                            <div className="p-3 rounded-xl bg-muted/50 border border-border">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Resumo da regra (o que a IA vai verificar)</p>
                                <div className="text-xs text-foreground/80 space-y-1">
                                    {currentRuleDef.split('\n').map((line, i) => (
                                        <p key={i} className="flex items-start gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-ch-orange mt-0.5 flex-shrink-0" />
                                            <span>{line}</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ação quando fora de conformidade */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Se estiver fora de conformidade</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setFormData({ ...formData, severity: 'error' })}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${formData.severity === 'error' ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30' : 'border-border bg-muted/50 hover:border-red-500/40'}`}
                                >
                                    <PauseCircle className={`w-5 h-5 flex-shrink-0 ${formData.severity === 'error' ? 'text-red-400' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className={`text-sm font-bold ${formData.severity === 'error' ? 'text-red-400' : 'text-foreground'}`}>Pausar anúncio</p>
                                        <p className="text-[10px] text-muted-foreground">Para o anúncio automaticamente</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, severity: 'warning' })}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${formData.severity === 'warning' ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30' : 'border-border bg-muted/50 hover:border-amber-500/40'}`}
                                >
                                    <Bell className={`w-5 h-5 flex-shrink-0 ${formData.severity === 'warning' ? 'text-amber-400' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className={`text-sm font-bold ${formData.severity === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>Apenas notificar</p>
                                        <p className="text-[10px] text-muted-foreground">Avisa mas não pausa</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-muted/50">
                        <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreativeForm(); }}>Cancelar</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={(createRule.isPending || updateRule.isPending) || !formData.name || !hasAnySpec}
                            className="bg-ch-orange text-black font-bold px-6"
                        >
                            {(createRule.isPending || updateRule.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {editingCreativeRuleId ? 'Salvar Alterações' : 'Criar Regra'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Performance Rule Create Dialog */}
            <Dialog open={isPerfCreateOpen} onOpenChange={(open) => { setIsPerfCreateOpen(open); if (!open) resetPerfForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-ch-orange" /> {editingPerfRuleId ? 'Editar Regra de Performance' : 'Nova Regra de Performance'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPerfRuleId
                                ? 'Altere os campos desejados e salve as mudanças.'
                                : 'Configure quando uma métrica não atingir o mínimo esperado em um período, e o que deve acontecer.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nome da Regra <span className="text-red-400">*</span></Label>
                            <Input
                                placeholder="Ex: Pausar se CTR baixar muito"
                                value={perfForm.name}
                                onChange={e => setPerfForm({ ...perfForm, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Descrição (opcional)</Label>
                            <Input
                                placeholder="Contexto adicional"
                                value={perfForm.description}
                                onChange={e => setPerfForm({ ...perfForm, description: e.target.value })}
                            />
                        </div>

                        {/* Condition builder */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Condição</Label>
                            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Métrica</Label>
                                        <Select value={perfForm.metric} onValueChange={v => setPerfForm({ ...perfForm, metric: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {METRIC_OPTIONS.map(m => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        <span className="flex items-center gap-2">
                                                            <m.icon className={`w-3.5 h-3.5 ${m.color}`} /> {m.label}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Operador</Label>
                                        <Select value={perfForm.operator} onValueChange={v => setPerfForm({ ...perfForm, operator: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {OPERATOR_OPTIONS.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">
                                            Valor limite {METRIC_OPTIONS.find(m => m.value === perfForm.metric)?.unit ? `(${METRIC_OPTIONS.find(m => m.value === perfForm.metric)?.unit})` : ''}
                                        </Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Ex: 1.5"
                                            value={perfForm.threshold}
                                            onChange={e => setPerfForm({ ...perfForm, threshold: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Janela de tempo</Label>
                                        <Select value={String(perfForm.window_days)} onValueChange={v => setPerfForm({ ...perfForm, window_days: Number(v) })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {WINDOW_OPTIONS.map(w => (
                                                    <SelectItem key={w.value} value={String(w.value)}>
                                                        <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {w.label}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {/* Preview */}
                                {perfForm.threshold && (
                                    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground">
                                        Se <span className="font-bold text-foreground">{METRIC_OPTIONS.find(m => m.value === perfForm.metric)?.label}</span>{' '}
                                        {OPERATOR_OPTIONS.find(o => o.value === perfForm.operator)?.label}{' '}
                                        <span className="font-bold text-foreground">
                                            {METRIC_OPTIONS.find(m => m.value === perfForm.metric)?.unit === 'R$' ? `R$ ${perfForm.threshold}` : METRIC_OPTIONS.find(m => m.value === perfForm.metric)?.unit === '%' ? `${perfForm.threshold}%` : perfForm.threshold}
                                        </span>{' '}
                                        nos últimos <span className="font-bold text-foreground">{perfForm.window_days} dias</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action */}
                        <div className="grid gap-2">
                            <Label>Ação a executar</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {ACTION_OPTIONS.map(a => (
                                    <button
                                        key={a.value}
                                        onClick={() => setPerfForm({ ...perfForm, action_type: a.value })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${perfForm.action_type === a.value ? 'border-ch-orange bg-ch-orange/10' : 'border-border bg-muted/50 hover:border-ch-orange/40'}`}
                                    >
                                        <a.icon className={`w-5 h-5 flex-shrink-0 ${perfForm.action_type === a.value ? 'text-ch-orange' : a.color}`} />
                                        <span className={`text-sm font-bold ${perfForm.action_type === a.value ? 'text-ch-orange' : 'text-foreground'}`}>{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsPerfCreateOpen(false); resetPerfForm(); }}>Cancelar</Button>
                        <Button
                            onClick={handleCreatePerfRule}
                            disabled={(createPerfRule.isPending || updatePerfRule.isPending) || !perfForm.name || !perfForm.threshold}
                            className="bg-ch-orange text-black font-bold"
                        >
                            {(createPerfRule.isPending || updatePerfRule.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                            {editingPerfRuleId ? 'Salvar Alterações' : 'Criar Regra'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rule selector (B5): step in front of the check modal */}
            <SelectRuleDialog
                isOpen={isRuleSelectorOpen}
                onClose={() => setIsRuleSelectorOpen(false)}
                onConfirm={startCheckWithRules}
                title={selectedCreativeIds.size > 1
                    ? `Quais regras aplicar a estes ${selectedCreativeIds.size} criativos?`
                    : 'Quais regras aplicar a este criativo?'}
            />

            <SyncLikeOverlay
                open={batchOverlayOpen || isBatchRunning}
                progress={batchOverlayProgress}
                title="Verificando criativos com IA"
                subtitle={
                    batchOverlayTotal > 0
                        ? `Verificando ${batchOverlayCurrent} de ${batchOverlayTotal} criativos selecionados`
                        : 'Preparando verificação de conformidade'
                }
                steps={BRANDING_STEPS}
                currentStepIndex={batchStepIndex}
                currentStepDetail={batchStepDetail}
                theme="branding"
                finished={batchOverlayFinished}
                finishedTitle="Verificação concluída"
                footerText="A verificação pode levar alguns minutos dependendo do volume de criativos"
                footerFinishedText="Resultados prontos para revisão"
            />

            <ComplianceReportOverlay
                open={complianceOverlayOpen}
                onClose={() => setComplianceOverlayOpen(false)}
                items={complianceOverlayItems}
                approvedCount={complianceApprovedCount}
            />

            {/* Creative Rule Check Modal (drill-down) */}
            {checkModal && (
                <CreativeRuleCheckModal
                    isOpen={!!checkModal}
                    onClose={() => setCheckModal(null)}
                    creativeId={checkModal.creativeId}
                    creativeName={checkModal.creativeName}
                    imageUrl={checkModal.imageUrl}
                    externalId={checkModal.externalId}
                    ruleIds={activeRuleIds}
                    autoRun
                />
            )}
        </motion.div>
    );
}
