import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ChevronRight,
    Megaphone,
    Target,
    Users,
    DollarSign,
    Rocket,
    CheckCircle2,
    Briefcase,
    Layout,
    PenTool,
    Wand2,
    Sparkles,
    Zap,
    BrainCircuit,
    MousePointer,
    MessageCircle,
    Smartphone,
    Globe,
    Image as ImageIcon
} from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useCompanyIntegrations } from '@/hooks/useCompanyIntegrations';

const steps = [
    { id: 'objective', label: 'Objetivo', icon: Target },
    { id: 'setup', label: 'Configuração', icon: CheckCircle2 },
    { id: 'audience', label: 'Público', icon: Users },
    { id: 'budget', label: 'Orçamento', icon: DollarSign },
    { id: 'creative', label: 'Anúncio', icon: Sparkles },
    { id: 'review', label: 'Revisão', icon: Rocket },
];

const objectives = [
    { id: 'OUTCOME_SALES', label: 'Vendas', description: 'Encontre pessoas propensas a comprar seus produtos ou serviços.', icon: DollarSign, color: 'ch-blue' },
    { id: 'OUTCOME_LEADS', label: 'Cadastros', description: 'Gere leads para seu negócio ou marca.', icon: Users, color: 'ch-blue' },
    { id: 'OUTCOME_TRAFFIC', label: 'Tráfego', description: 'Direcione pessoas para um destino, como seu site ou app.', icon: MousePointer, color: 'ch-blue' },
    { id: 'OUTCOME_AWARENESS', label: 'Reconhecimento', description: 'Mostre seus anúncios para quem tem maior probabilidade de lembrá-los.', icon: Megaphone, color: 'ch-orange' },
    { id: 'OUTCOME_ENGAGEMENT', label: 'Engajamento', description: 'Obtenha mais mensagens, visualizações de vídeo ou engajamento com a publicação.', icon: MessageCircle, color: 'ch-orange' },
    { id: 'OUTCOME_APP_PROMOTION', label: 'Promoção de App', description: 'Encontre novas pessoas para instalar seu aplicativo e continuar usando-o.', icon: Smartphone, color: 'ch-blue' },
];

const StepCreativeContent = ({ formData, updateNestedData, updateFormData, integrationId }: any) => {
    const { data: pages, isLoading } = useQuery({
        queryKey: ['meta-pages', integrationId],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('meta-list-pages', {
                body: { integration_id: integrationId }
            });
            if (error) throw error;
            return data.pages;
        },
        enabled: !!integrationId
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Página do Facebook</Label>
                    <Select
                        value={formData.ad.creative.page_id}
                        onValueChange={(v) => updateNestedData('ad', 'creative', 'page_id', v)}
                    >
                        <SelectTrigger className="h-14 bg-background border-input rounded-xl focus:border-ch-orange transition-colors">
                            <SelectValue placeholder={isLoading ? "Carregando páginas..." : "Selecione a página"} />
                        </SelectTrigger>
                        <SelectContent>
                            {pages?.map((page: any) => (
                                <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-4">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">URL da Imagem</Label>
                    <Input
                        value={formData.ad.creative.image_url}
                        onChange={(e) => updateNestedData('ad', 'creative', 'image_url', e.target.value)}
                        placeholder="https://exemplo.com/imagem.jpg"
                        className="h-14 bg-background border-input rounded-xl focus:border-ch-orange transition-colors"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título do Anúncio</Label>
                    <Input
                        value={formData.ad.creative.title}
                        onChange={(e) => updateNestedData('ad', 'creative', 'title', e.target.value)}
                        placeholder="Ex: Oferta Especial de Verão"
                        className="h-14 bg-background border-input rounded-xl focus:border-ch-orange transition-colors font-bold"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Texto Principal</Label>
                    <textarea
                        value={formData.ad.creative.body}
                        onChange={(e) => updateNestedData('ad', 'creative', 'body', e.target.value)}
                        placeholder="Descreva sua oferta em detalhes..."
                        className="w-full min-h-[120px] p-4 bg-background border border-input rounded-xl focus:border-ch-orange focus:ring-1 focus:ring-ch-orange outline-none transition-all placeholder:text-muted-foreground/50 font-sans"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Link de Destino</Label>
                        <Input
                            value={formData.ad.creative.link_url}
                            onChange={(e) => updateNestedData('ad', 'creative', 'link_url', e.target.value)}
                            placeholder="https://seu-site.com"
                            className="h-12 bg-background border-input rounded-xl focus:border-ch-orange transition-colors"
                        />
                    </div>
                    <div className="space-y-4">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Botão (CTA)</Label>
                        <Select
                            value={formData.ad.creative.call_to_action}
                            onValueChange={(v) => updateNestedData('ad', 'creative', 'call_to_action', v)}
                        >
                            <SelectTrigger className="h-12 bg-background border-input rounded-xl focus:border-ch-orange transition-colors">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LEARN_MORE">Saiba Mais</SelectItem>
                                <SelectItem value="SHOP_NOW">Comprar Agora</SelectItem>
                                <SelectItem value="SIGN_UP">Cadastrar-se</SelectItem>
                                <SelectItem value="CONTACT_US">Fale Conosco</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="lg:sticky lg:top-8">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 block">Prévia do Anúncio (Feed)</Label>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-[400px] mx-auto text-black">
                    <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div>
                            <p className="font-bold text-sm">{pages?.find((p: any) => p.id === formData.ad.creative.page_id)?.name || 'Sua Página'}</p>
                            <p className="text-[10px] text-gray-500">Patrocinado · <Globe className="w-2.5 h-2.5 inline" /></p>
                        </div>
                    </div>
                    <div className="px-4 pb-3">
                        <p className="text-sm line-clamp-3">{formData.ad.creative.body || 'Seu texto principal aparecerá aqui...'}</p>
                    </div>
                    {formData.ad.creative.image_url ? (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                            <img src={formData.ad.creative.image_url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-gray-300" />
                        </div>
                    )}
                    <div className="p-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                        <div className="flex-1 min-w-0 pr-4">
                            <p className="text-xs text-gray-500 uppercase truncate">{formData.ad.creative.link_url ? new URL(formData.ad.creative.link_url).hostname : 'link.com'}</p>
                            <p className="font-bold text-base truncate">{formData.ad.creative.title || 'Seu título impactante'}</p>
                        </div>
                        <Button className="bg-[#ebedf0] hover:bg-[#dadde1] text-black rounded-md px-4 py-1.5 h-auto font-semibold text-sm shadow-none">
                            {formData.ad.creative.call_to_action === 'LEARN_MORE' ? 'Saiba mais' :
                                formData.ad.creative.call_to_action === 'SHOP_NOW' ? 'Comprar' :
                                    formData.ad.creative.call_to_action === 'SIGN_UP' ? 'Cadastrar' : 'Falar Conosco'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default function NovaCampanha() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(0);
    const { data: integrations } = useCompanyIntegrations(user?.company_id);
    const [integrationId, setIntegrationId] = useState('');

    const [formData, setFormData] = useState({
        campaign: {
            name: '',
            objective: '',
            status: 'PAUSED',
            special_ad_categories: [] as string[],
        },
        adset: {
            name: '',
            daily_budget: '',
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'REACH',
            start_time: new Date().toISOString(),
            targeting: {
                geo_locations: { countries: ['BR'] },
                age_min: 18,
                age_max: 65,
                genders: [] as number[],
            },
        },
        ad: {
            name: '',
            creative: {
                title: '',
                body: '',
                image_url: '',
                link_url: '',
                call_to_action: 'LEARN_MORE',
                page_id: '',
            },
        },
    });

    const createCampaign = useMutation({
        mutationFn: async () => {
            if (!user?.company_id) throw new Error('User company not found');
            if (!integrationId) throw new Error('Please select an ad account');

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const payload = {
                integration_id: integrationId,
                campaign: formData.campaign,
                adset: {
                    ...formData.adset,
                    daily_budget: Math.round(parseFloat(formData.adset.daily_budget || '0') * 100),
                },
                ad: formData.ad,
            };

            const response = await fetch(`${supabaseUrl}/functions/v1/meta-create-campaign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to create campaign');
            }

            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            toast.success('Campanha lançada com sucesso via Neural Engine!');
            navigate('/campanhas');
        },
        onError: (error) => {
            toast.error(`Erro ao lançar campanha: ${error.message}`);
        },
    });

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            createCampaign.mutate();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const updateFormData = (section: 'campaign' | 'adset' | 'ad', field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const updateNestedData = (section: 'adset' | 'ad', subfield: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [subfield]: {
                    ...prev[section][subfield],
                    [field]: value
                }
            }
        }));
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {objectives.map((obj) => (
                                <div
                                    key={obj.id}
                                    onClick={() => updateFormData('campaign', 'objective', obj.id)}
                                    className={`relative p-8 rounded-3xl border cursor-pointer transition-all hover:scale-[1.02] group overflow-hidden ${formData.campaign.objective === obj.id
                                        ? `border-${obj.color} bg-${obj.color}/10`
                                        : 'border-border bg-card hover:border-ch-orange/30 hover:bg-muted/50'
                                        }`}
                                >
                                    <div className="flex flex-col h-full relative z-10">
                                        <div className={`p-6 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110 duration-500 shadow-sm ${formData.campaign.objective === obj.id
                                            ? `bg-${obj.color} text-white`
                                            : `bg-muted text-${obj.color}`
                                            }`}>
                                            <obj.icon className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground mb-2">{obj.label}</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{obj.description}</p>
                                    </div>

                                    {/* Glass Overlay for unselected cards */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Selection Indicator */}
                                    {formData.campaign.objective === obj.id && (
                                        <div className={`absolute top-6 right-6 text-${obj.color}`}>
                                            <CheckCircle2 className="w-6 h-6 fill-current" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="space-y-4">
                            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Conta de Anúncios</Label>
                            <Select value={integrationId} onValueChange={setIntegrationId}>
                                <SelectTrigger className="h-14 bg-background border-input text-foreground rounded-xl focus:border-ch-orange transition-colors">
                                    <SelectValue placeholder="Selecione a conta Meta ADS" />
                                </SelectTrigger>
                                <SelectContent>
                                    {integrations?.map((int) => (
                                        <SelectItem key={int.id} value={int.id}>
                                            {int.account_name} ({int.account_id})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Nome da Campanha</Label>
                            <Input
                                value={formData.campaign.name}
                                onChange={(e) => updateFormData('campaign', 'name', e.target.value)}
                                placeholder="Ex: Campanha de Vendas - Verão 2024"
                                className="h-14 bg-background border-input text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:border-ch-orange transition-colors text-lg font-medium"
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Status Inicial</Label>
                            <Select value={formData.campaign.status} onValueChange={(v) => updateFormData('campaign', 'status', v)}>
                                <SelectTrigger className="h-14 bg-background border-input text-foreground rounded-xl focus:border-ch-orange transition-colors">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Ativa (Veiculação imediata)</SelectItem>
                                    <SelectItem value="PAUSED">Pausada (Rascunho)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-ch-orange/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border shadow-sm">
                                <Users className="w-10 h-10 text-ch-orange" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Definição Neural de Público</h3>
                            <p className="text-muted-foreground mt-2">Personalize quem deve ser impactado pelos seus anúncios.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Idade Mínima</Label>
                                <Input
                                    type="number"
                                    min={18}
                                    max={65}
                                    value={formData.adset.targeting.age_min}
                                    onChange={(e) => updateNestedData('adset', 'targeting', 'age_min', parseInt(e.target.value))}
                                    className="h-12 bg-background border-input rounded-xl focus:border-ch-orange transition-colors font-bold text-center"
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Idade Máxima</Label>
                                <Input
                                    type="number"
                                    min={18}
                                    max={65}
                                    value={formData.adset.targeting.age_max}
                                    onChange={(e) => updateNestedData('adset', 'targeting', 'age_max', parseInt(e.target.value))}
                                    className="h-12 bg-background border-input rounded-xl focus:border-ch-orange transition-colors font-bold text-center"
                                />
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-card border border-border space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Localização Foco</Label>
                            <p className="font-bold text-foreground flex items-center gap-2">
                                <Zap className="w-4 h-4 text-ch-orange fill-current" /> Brasil (Otimização Geo-Neural)
                            </p>
                            <p className="text-xs text-muted-foreground italic">A IA do Click Auditor ajustará as sub-regiões automaticamente para menor CPA.</p>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto">
                        <div className="space-y-8">
                            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block text-center">Orçamento Diário Sugerido</Label>
                            <div className="relative group max-w-md mx-auto">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground group-focus-within:text-ch-orange transition-colors">R$</span>
                                <Input
                                    type="number"
                                    value={formData.adset.daily_budget}
                                    onChange={(e) => updateFormData('adset', 'daily_budget', e.target.value)}
                                    placeholder="0,00"
                                    className="pl-16 h-20 text-5xl font-bold text-center bg-transparent border-0 border-b-2 border-border rounded-none focus:border-ch-orange focus:ring-0 transition-all placeholder:text-muted/20"
                                />
                            </div>
                            <div className="p-4 rounded-xl bg-accent/5 border border-border text-center space-y-1 shadow-sm">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alcance Estimado pela IA</p>
                                <p className="text-lg font-bold text-emerald-500">1.2k - 3.5k <span className="text-sm font-semibold text-muted-foreground/60">pessoas/dia</span></p>
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return <StepCreativeContent formData={formData} updateNestedData={updateNestedData} updateFormData={updateFormData} integrationId={integrationId} />;

            case 5:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="bg-card p-10 rounded-3xl border border-border shadow-sm space-y-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <BrainCircuit className="w-32 h-32 text-ch-orange" />
                            </div>

                            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border shadow-sm">
                                <Rocket className="w-10 h-10 text-emerald-400" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-foreground">Pronto para Lançar?</h3>
                                <p className="text-muted-foreground font-medium">Sua estratégia neural foi validada e está pronta.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 text-left bg-muted/50 p-8 rounded-3xl border border-border">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Campanha</span>
                                    <p className="text-foreground font-semibold text-lg truncate">{formData.campaign.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Objetivo</span>
                                    <p className="text-foreground font-semibold text-lg">{objectives.find(o => o.id === formData.campaign.objective)?.label || formData.campaign.objective}</p>
                                </div>
                                <div className="space-y-1 col-span-2 pt-4 border-t border-border">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Investimento Diário Planejado</span>
                                    <p className="text-emerald-500 font-bold text-3xl">
                                        {formatCurrency(Number(formData.adset.daily_budget))}
                                        <span className="text-sm font-bold text-muted-foreground/60 ml-2">/ dia</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen p-6 pb-20 flex flex-col max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-12">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/campanhas')}
                    className="hover:bg-accent/50 rounded-xl"
                >
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Nova Campanha Neural</h1>
                    <p className="text-xs text-muted-foreground font-medium mt-1">Configure sua estratégia de aquisição</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex justify-between items-center mb-16 relative px-10">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-border -z-10" />

                {/* Active Progress Bar */}
                <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-ch-orange -z-10 transition-all duration-500"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-3 bg-background px-6 relative z-10 transition-colors duration-500">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    borderColor: isActive || isCompleted ? '#cf6f03' : 'hsl(var(--border))',
                                    backgroundColor: isActive ? '#cf6f03' : 'hsl(var(--background))'
                                }}
                                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${isCompleted ? 'text-ch-orange' : isActive ? 'text-background shadow-sm' : 'text-muted-foreground/40'
                                    }`}
                            >
                                <step.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                            </motion.div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground/60'
                                }`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
                {renderStepContent()}
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center mt-12 pt-8 border-t border-border">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="h-12 px-8 rounded-xl font-bold uppercase text-[10px] tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-30 transition-all border border-transparent hover:border-border"
                >
                    Voltar
                </Button>

                <Button
                    onClick={handleNext}
                    disabled={
                        (currentStep === 0 && !formData.campaign.objective) ||
                        (currentStep === 1 && (!formData.campaign.name || !integrationId)) ||
                        (currentStep === 3 && !formData.adset.daily_budget) ||
                        (currentStep === 4 && (!formData.ad.creative.page_id || !formData.ad.creative.image_url)) ||
                        createCampaign.isPending
                    }
                    className="h-12 px-10 bg-ch-orange text-white hover:bg-ch-orange/90 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                    {createCampaign.isPending ? (
                        <span className="flex items-center gap-2">
                            <Zap className="w-4 h-4 animate-spin" /> Processando
                        </span>
                    ) : currentStep === steps.length - 1 ? (
                        <span className="flex items-center gap-2">
                            Lançar Campanha <Rocket className="w-4 h-4" />
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            Continuar <ChevronRight className="w-4 h-4" />
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
}
