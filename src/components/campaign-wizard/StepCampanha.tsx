import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignStepData } from "@/types/campaign-wizard";

interface StepCampanhaProps {
    data: CampaignStepData;
    updateData: (data: Partial<CampaignStepData>) => void;
    integrationId: string;
    setIntegrationId: (id: string) => void;
    integrations: any[];
}

export default function StepCampanha({
    data,
    updateData,
    integrationId,
    setIntegrationId,
    integrations
}: StepCampanhaProps) {

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-ch-white">Definições da Campanha</h2>
                <p className="text-sm text-ch-text-muted">Selecione a conta de anúncio e o objetivo principal.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Conta de Anúncios */}
                <div className="space-y-2">
                    <Label htmlFor="integration">Conta de Anúncios</Label>
                    <Select value={integrationId} onValueChange={setIntegrationId}>
                        <SelectTrigger id="integration" className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                            <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                        <SelectContent>
                            {integrations.length === 0 ? (
                                <SelectItem value="none" disabled>Nenhuma conta ativa encontrada</SelectItem>
                            ) : (
                                integrations.map((int) => (
                                    <SelectItem key={int.id} value={int.id}>
                                        {int.account_name} ({int.account_id})
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Nome da Campanha */}
                <div className="space-y-2">
                    <Label htmlFor="name">Nome da Campanha</Label>
                    <Input
                        id="name"
                        value={data.name}
                        onChange={(e) => updateData({ name: e.target.value })}
                        className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                        placeholder="Ex: Campanha Conversão Vendas"
                    />
                </div>

                {/* Objetivo */}
                <div className="space-y-2">
                    <Label htmlFor="objective">Objetivo</Label>
                    <Select value={data.objective} onValueChange={(v) => updateData({ objective: v })}>
                        <SelectTrigger id="objective" className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                            <SelectValue placeholder="Selecione o objetivo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="OUTCOME_SALES">Vendas (Sales)</SelectItem>
                            <SelectItem value="OUTCOME_LEADS">Leads (Cadastros)</SelectItem>
                            <SelectItem value="OUTCOME_TRAFFIC">Tráfego (Traffic)</SelectItem>
                            <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento (Engagement)</SelectItem>
                            <SelectItem value="OUTCOME_AWARENESS">Reconhecimento (Awareness)</SelectItem>
                            <SelectItem value="OUTCOME_APP_PROMOTION">App Promotion</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-ch-text-dimmed">Selecione o objetivo que melhor se aplica ao seu negócio.</p>
                </div>

                {/* Status Inicial */}
                <div className="space-y-2">
                    <Label htmlFor="status">Status Inicial</Label>
                    <Select value={data.status} onValueChange={(v) => updateData({ status: v as 'ACTIVE' | 'PAUSED' })}>
                        <SelectTrigger id="status" className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ACTIVE">Ativa (Publicar imediatamente)</SelectItem>
                            <SelectItem value="PAUSED">Pausada (Rascunho)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
