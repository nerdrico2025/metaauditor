import { CampaignWizardState } from "@/types/campaign-wizard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StepReviewProps {
    data: CampaignWizardState;
}

export default function StepReview({ data }: StepReviewProps) {

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-foreground">Revisão Final</h2>
                <p className="text-sm text-muted-foreground">Verifique todos os detalhes antes de publicar sua campanha.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Resumo da Campanha */}
                <div className="glass rounded-xl p-6 border border-border space-y-4">
                    <h3 className="text-lg font-medium text-purple-400">1. Campanha</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nome:</span>
                            <span className="text-foreground font-medium">{data.campaign.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Objetivo:</span>
                            <span className="text-foreground">{data.campaign.objective}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status Inicial:</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${data.campaign.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                {data.campaign.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Resumo do AdSet */}
                <div className="glass rounded-xl p-6 border border-border space-y-4">
                    <h3 className="text-lg font-medium text-blue-400">2. Conjunto de Anúncios</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nome:</span>
                            <span className="text-foreground font-medium">{data.adset.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Orçamento:</span>
                            <span className="text-foreground">
                                {data.adset.daily_budget ?
                                    `Diário: R$ ${(data.adset.daily_budget / 100).toFixed(2)}` :
                                    `Total: R$ ${(data.adset.lifetime_budget! / 100).toFixed(2)}`
                                }
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Início:</span>
                            <span className="text-foreground">
                                {data.adset.start_time ? format(new Date(data.adset.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Otimização:</span>
                            <span className="text-foreground">{data.adset.optimization_goal}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Targeting:</span>
                            <span className="text-foreground text-xs text-right max-w-[200px]">
                                BR, {data.adset.targeting.age_min}-{data.adset.targeting.age_max} anos
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumo do Anúncio */}
            <div className="glass rounded-xl p-6 border border-border space-y-4">
                <h3 className="text-lg font-medium text-pink-400">3. Anúncio (Criativo)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nome:</span>
                            <span className="text-foreground font-medium">{data.ad.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Página ID:</span>
                            <span className="text-foreground text-xs">{data.ad.creative.page_id || 'Não Selecionada'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">CTA:</span>
                            <span className="text-foreground">{data.ad.creative.call_to_action}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground p-2 bg-ch-bg/50 rounded">
                            <p className="font-semibold mb-1">Texto Principal Preview:</p>
                            <p className="line-clamp-2">{data.ad.creative.body}</p>
                        </div>
                    </div>

                    <div className="flex justify-center items-center h-full">
                        {data.ad.creative.image_url ? (
                            <div className="w-24 h-24 rounded overflow-hidden">
                                <img src={data.ad.creative.image_url} alt="Creative" className="object-cover w-full h-full" />
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">Sem imagem</div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
