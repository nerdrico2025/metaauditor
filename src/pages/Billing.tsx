import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    CreditCard,
    Check,
    Loader2,
    Zap,
    Crown,
    Building2,
    Users,
    Megaphone,
    FileCheck,
    Sparkles,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
    id: string;
    name: string;
    price: number;
    features: string[];
    limits: {
        campaigns: number;
        creatives: number;
        users: number;
        ai_requests: number;
    };
    popular?: boolean;
}

const PLANS: Plan[] = [
    {
        id: 'starter',
        name: 'Starter',
        price: 97,
        features: [
            'Até 5 campanhas',
            'Até 50 criativos',
            'Até 2 usuários',
            '100 requisições IA/mês',
            'Relatórios básicos',
        ],
        limits: { campaigns: 5, creatives: 50, users: 2, ai_requests: 100 },
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 297,
        features: [
            'Até 20 campanhas',
            'Até 200 criativos',
            'Até 5 usuários',
            '500 requisições IA/mês',
            'Relatórios avançados',
            'Automações',
            'Suporte prioritário',
        ],
        limits: { campaigns: 20, creatives: 200, users: 5, ai_requests: 500 },
        popular: true,
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 597,
        features: [
            'Campanhas ilimitadas',
            'Criativos ilimitados',
            'Usuários ilimitados',
            'Requisições IA ilimitadas',
            'Relatórios personalizados',
            'API access',
            'Onboarding dedicado',
            'SLA garantido',
        ],
        limits: { campaigns: -1, creatives: -1, users: -1, ai_requests: -1 },
    },
];

export default function Billing() {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const { data: currentPlan } = useQuery({
        queryKey: ['current-plan', companyId],
        queryFn: async () => {
            if (!companyId) return null;
            const { data, error } = await supabase
                .from('companies')
                .select('plan, plan_expires_at')
                .eq('id', companyId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!companyId,
    });

    const subscribeToPlan = useMutation({
        mutationFn: async (planId: string) => {
            // In real implementation, this would redirect to Stripe Checkout
            // For now, we'll simulate the upgrade
            const { error } = await supabase
                .from('companies')
                .update({
                    plan: planId,
                    plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .eq('id', companyId);
            if (error) throw error;
            return planId;
        },
        onSuccess: (planId) => {
            toast.success(`Plano ${PLANS.find(p => p.id === planId)?.name} ativado!`);
        },
        onError: (error) => {
            toast.error(`Erro ao atualizar plano: ${error.message}`);
        },
    });

    const handleSubscribe = (planId: string) => {
        setSelectedPlan(planId);
        subscribeToPlan.mutate(planId);
    };

    const getFeatureIcon = (feature: string) => {
        if (feature.includes('campanha')) return Megaphone;
        if (feature.includes('criativo')) return Megaphone;
        if (feature.includes('usuário')) return Users;
        if (feature.includes('IA')) return Sparkles;
        if (feature.includes('Relatório')) return FileCheck;
        return Check;
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-ch-white mb-2">Planos e Faturamento</h1>
                <p className="text-ch-text-muted">
                    Escolha o plano ideal para o seu negócio.
                </p>
            </div>

            {/* Current Plan */}
            {currentPlan?.plan && (
                <div className="glass rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-ch-orange/20 rounded-lg">
                            <Crown className="w-6 h-6 text-ch-orange" />
                        </div>
                        <div>
                            <p className="text-ch-text-muted text-sm">Plano Atual</p>
                            <p className="text-xl font-bold text-ch-white capitalize">{currentPlan.plan}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                    const isCurrentPlan = currentPlan?.plan === plan.id;

                    return (
                        <div
                            key={plan.id}
                            className={`glass rounded-xl p-6 relative ${plan.popular ? 'ring-2 ring-ch-orange' : ''
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="px-3 py-1 bg-ch-orange text-white text-xs font-medium rounded-full">
                                        Mais Popular
                                    </span>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-ch-white">{plan.name}</h3>
                                <div className="mt-2">
                                    <span className="text-3xl font-bold text-ch-white">R$ {plan.price}</span>
                                    <span className="text-ch-text-muted">/mês</span>
                                </div>
                            </div>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, idx) => {
                                    const Icon = getFeatureIcon(feature);
                                    return (
                                        <li key={idx} className="flex items-center gap-2 text-sm text-ch-text-muted">
                                            <Icon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    );
                                })}
                            </ul>

                            <Button
                                onClick={() => handleSubscribe(plan.id)}
                                disabled={isCurrentPlan || subscribeToPlan.isPending}
                                className={`w-full ${plan.popular
                                        ? 'bg-ch-orange hover:bg-ch-orange/90'
                                        : 'bg-ch-dark-gray hover:bg-ch-gray border border-ch-dark-gray'
                                    }`}
                            >
                                {subscribeToPlan.isPending && selectedPlan === plan.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {isCurrentPlan ? 'Plano Atual' : 'Assinar'}
                            </Button>
                        </div>
                    );
                })}
            </div>

            {/* FAQ */}
            <div className="mt-12 glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-ch-white mb-4">Perguntas Frequentes</h3>
                <div className="space-y-4">
                    <div>
                        <p className="font-medium text-ch-white">Como funciona o pagamento?</p>
                        <p className="text-sm text-ch-text-muted mt-1">
                            O pagamento é feito mensalmente via cartão de crédito. Você pode cancelar a qualquer momento.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-ch-white">Posso mudar de plano?</p>
                        <p className="text-sm text-ch-text-muted mt-1">
                            Sim, você pode fazer upgrade ou downgrade a qualquer momento. A diferença será calculada proporcionalmente.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-ch-white">O que acontece se eu exceder os limites?</p>
                        <p className="text-sm text-ch-text-muted mt-1">
                            Você receberá uma notificação e poderá fazer upgrade do plano para continuar usando.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
