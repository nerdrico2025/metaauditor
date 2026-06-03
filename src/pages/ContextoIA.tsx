import { useEffect, useState } from 'react';
import { useCompany, useUpdateCompany, emptyBrandBriefing, isBrandBriefingComplete, type CompanyAiContext, type BrandBriefing } from '@/hooks/useCompany';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, Sparkles, Info, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

const emptyCtx: CompanyAiContext = {
    business_description: '',
    target_audience: '',
    tone_of_voice: '',
    key_offers: '',
    dos_and_donts: '',
    target_metrics: { ctr_min: undefined, cpc_max: undefined, cpa_target: undefined },
    extra_context: '',
    brand_briefing: { ...emptyBrandBriefing },
};

const BRIEFING_FIELDS: { key: keyof BrandBriefing; label: string; rows?: number; placeholder?: string }[] = [
    { key: 'brand_promise', label: 'Promessa de marca', placeholder: 'O que a marca representa...' },
    { key: 'brand_personality', label: 'Personalidade da marca', placeholder: 'Ex.: confiável, jovem, premium' },
    { key: 'visual_identity', label: 'Identidade visual', rows: 3, placeholder: 'Cores, tipografia, estilo visual...' },
    { key: 'logo_usage', label: 'Uso de logo / elementos visuais', placeholder: 'Posicionamento, tamanho mínimo...' },
    { key: 'tone_in_ads', label: 'Tom de voz em anúncios', placeholder: 'Como falar nos criativos...' },
    { key: 'mandatory_elements', label: 'Elementos obrigatórios', rows: 3, placeholder: 'O que sempre deve aparecer...' },
    { key: 'forbidden_practices', label: 'Práticas proibidas', rows: 3, placeholder: 'O que nunca pode aparecer...' },
    { key: 'audience_perception', label: 'Percepção desejada pelo público', placeholder: 'Como o público deve ver a marca...' },
    { key: 'reference_notes', label: 'Referências / o que evitar parecer', rows: 2, placeholder: 'Marcas de referência ou a evitar...' },
];

function cleanBriefing(briefing: BrandBriefing): BrandBriefing | undefined {
    const out: BrandBriefing = {};
    for (const { key } of BRIEFING_FIELDS) {
        const val = briefing[key]?.trim();
        if (val) (out as Record<string, string>)[key] = val;
    }
    if (Object.keys(out).length === 0) return undefined;
    if (isBrandBriefingComplete(out)) {
        out.completed_at = new Date().toISOString();
    }
    return out;
}

export default function ContextoIA() {
    const { data: company, isLoading } = useCompany();
    const updateCompany = useUpdateCompany();
    const [form, setForm] = useState<CompanyAiContext>(emptyCtx);

    useEffect(() => {
        if (company?.ai_context) {
            setForm({
                ...emptyCtx,
                ...company.ai_context,
                target_metrics: { ...emptyCtx.target_metrics, ...company.ai_context.target_metrics },
                brand_briefing: {
                    ...emptyBrandBriefing,
                    ...company.ai_context.brand_briefing,
                },
            });
        }
    }, [company?.ai_context]);

    const updateBriefingField = (key: keyof BrandBriefing, value: string) => {
        setForm(prev => ({
            ...prev,
            brand_briefing: { ...emptyBrandBriefing, ...prev.brand_briefing, [key]: value },
        }));
    };

    const handleSave = async () => {
        const cleaned: CompanyAiContext = {};
        if (form.business_description?.trim()) cleaned.business_description = form.business_description.trim();
        if (form.target_audience?.trim()) cleaned.target_audience = form.target_audience.trim();
        if (form.tone_of_voice?.trim()) cleaned.tone_of_voice = form.tone_of_voice.trim();
        if (form.key_offers?.trim()) cleaned.key_offers = form.key_offers.trim();
        if (form.dos_and_donts?.trim()) cleaned.dos_and_donts = form.dos_and_donts.trim();
        if (form.extra_context?.trim()) cleaned.extra_context = form.extra_context.trim();
        const tm = form.target_metrics || {};
        const tmClean: Record<string, number> = {};
        if (typeof tm.ctr_min === 'number' && !Number.isNaN(tm.ctr_min)) tmClean.ctr_min = tm.ctr_min;
        if (typeof tm.cpc_max === 'number' && !Number.isNaN(tm.cpc_max)) tmClean.cpc_max = tm.cpc_max;
        if (typeof tm.cpa_target === 'number' && !Number.isNaN(tm.cpa_target)) tmClean.cpa_target = tm.cpa_target;
        if (Object.keys(tmClean).length > 0) cleaned.target_metrics = tmClean;

        const briefing = cleanBriefing(form.brand_briefing ?? {});
        if (briefing) cleaned.brand_briefing = briefing;

        try {
            await updateCompany.mutateAsync({
                ai_context: Object.keys(cleaned).length > 0 ? cleaned : null,
            });
            toast.success('Contexto da IA salvo. Próximas análises já vão usar.');
        } catch {
            toast.error('Erro ao salvar contexto.');
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-ch-orange" /></div>;
    }

    return (
        <motion.div initial="hidden" animate="show" variants={container} className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <motion.div variants={item}>
                <SettingsNav />
            </motion.div>

            <motion.div variants={item} className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-ch-orange/10">
                    <Sparkles className="w-5 h-5 text-ch-orange" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Contexto da IA</h1>
                    <p className="text-xs text-muted-foreground">Personalize o que a IA sabe sobre seu negócio. Quanto mais específico, menos genéricas as recomendações.</p>
                </div>
            </motion.div>

            <motion.div variants={item}>
                <Card className="bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20">
                    <CardContent className="pt-4 flex gap-3">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                            Esses dados são injetados no prompt de toda análise/diagnóstico de IA. Use linguagem direta e descreva como você descreveria a um colega novo no time.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={item}>
                <Card>
                    <CardContent className="pt-6 space-y-5">
                        <div className="space-y-2">
                            <Label>Sobre o negócio</Label>
                            <Textarea rows={3} placeholder="Ex.: Provedora de internet fibra B2C atendendo cidades do interior de São Paulo, foco em famílias..."
                                value={form.business_description || ''}
                                onChange={(e) => setForm({ ...form, business_description: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Público-alvo</Label>
                            <Textarea rows={2} placeholder="Ex.: Famílias 25-55 anos, classe C/B, regiões periféricas, decisores domésticos."
                                value={form.target_audience || ''}
                                onChange={(e) => setForm({ ...form, target_audience: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Tom de voz</Label>
                            <Textarea rows={2} placeholder="Ex.: Direto, próximo, sem jargão técnico. Evite tom institucional ou frio."
                                value={form.tone_of_voice || ''}
                                onChange={(e) => setForm({ ...form, tone_of_voice: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Ofertas / produtos principais</Label>
                            <Textarea rows={3} placeholder="Ex.: Plano 600MB R$89, 1GB R$129. Instalação grátis. Wi-Fi 6 incluso. Roteador prime opcional."
                                value={form.key_offers || ''}
                                onChange={(e) => setForm({ ...form, key_offers: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Diretrizes obrigatórias (do/don't)</Label>
                            <Textarea rows={3} placeholder={"Ex.:\nNÃO prometer velocidade específica em criativos\nSEMPRE incluir 'sujeito à viabilidade'\nNÃO usar imagens com tarifas mascaradas"}
                                value={form.dos_and_donts || ''}
                                onChange={(e) => setForm({ ...form, dos_and_donts: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Metas de performance</Label>
                            <p className="text-[11px] text-muted-foreground">Use seus benchmarks atuais — a IA vai comparar contra estes valores em vez de usar médias genéricas de mercado.</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-[11px] text-muted-foreground">CTR mínimo (%)</Label>
                                    <Input type="number" step="0.1" placeholder="1.5"
                                        value={form.target_metrics?.ctr_min ?? ''}
                                        onChange={(e) => setForm({ ...form, target_metrics: { ...form.target_metrics, ctr_min: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                                </div>
                                <div>
                                    <Label className="text-[11px] text-muted-foreground">CPC máximo (R$)</Label>
                                    <Input type="number" step="0.01" placeholder="1.80"
                                        value={form.target_metrics?.cpc_max ?? ''}
                                        onChange={(e) => setForm({ ...form, target_metrics: { ...form.target_metrics, cpc_max: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                                </div>
                                <div>
                                    <Label className="text-[11px] text-muted-foreground">CPA alvo (R$)</Label>
                                    <Input type="number" step="0.01" placeholder="30"
                                        value={form.target_metrics?.cpa_target ?? ''}
                                        onChange={(e) => setForm({ ...form, target_metrics: { ...form.target_metrics, cpa_target: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Contexto extra</Label>
                            <Textarea rows={3} placeholder="Ex.: Concorrentes principais: Vivo, Claro. Diferencial: atendimento local 24h. Sazonalidade alta em janeiro/julho..."
                                value={form.extra_context || ''}
                                onChange={(e) => setForm({ ...form, extra_context: e.target.value })} />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={item}>
                <Card>
                    <CardContent className="pt-6 space-y-5">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <div>
                                <h2 className="text-base font-semibold">Briefing de marca</h2>
                                <p className="text-[11px] text-muted-foreground">Usado na Análise de Branding do dashboard para avaliar conformidade visual e de copy.</p>
                            </div>
                        </div>

                        {BRIEFING_FIELDS.map(({ key, label, rows, placeholder }) => (
                            <div key={key} className="space-y-2">
                                <Label>{label}</Label>
                                <Textarea
                                    rows={rows ?? 2}
                                    placeholder={placeholder}
                                    value={form.brand_briefing?.[key] || ''}
                                    onChange={(e) => updateBriefingField(key, e.target.value)}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={item} className="flex justify-end">
                <Button onClick={handleSave} disabled={updateCompany.isPending} className="bg-ch-orange hover:bg-ch-orange/90 text-black">
                    {updateCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar contexto
                </Button>
            </motion.div>
        </motion.div>
    );
}
