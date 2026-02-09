import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdSetStepData } from "@/types/campaign-wizard";
import { format } from "date-fns";

interface StepAdSetProps {
    data: AdSetStepData;
    updateData: (data: Partial<AdSetStepData>) => void;
}

export default function StepAdSet({ data, updateData }: StepAdSetProps) {

    const handleBudgetChange = (amount: string) => {
        // Convert float to cents integer
        const val = parseFloat(amount.replace(',', '.'));
        if (!isNaN(val)) {
            updateData({ daily_budget: Math.round(val * 100) });
        }
    };

    const currentBudget = data.daily_budget ? (data.daily_budget / 100).toFixed(2) : '0.00';

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-ch-white">Conjunto de Anúncios</h2>
                <p className="text-sm text-ch-text-muted">Defina quem verá seus anúncios e quanto você quer gastar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome do AdSet */}
                <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label htmlFor="adset-name">Nome do Conjunto</Label>
                    <Input
                        id="adset-name"
                        value={data.name}
                        onChange={(e) => updateData({ name: e.target.value })}
                        className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                    />
                </div>

                {/* Orçamento Diário */}
                <div className="space-y-2">
                    <Label htmlFor="budget">Orçamento Diário (R$)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-text-muted">R$</span>
                        <Input
                            id="budget"
                            type="number"
                            step="0.01"
                            min="1.00"
                            defaultValue={currentBudget}
                            onBlur={(e) => handleBudgetChange(e.target.value)}
                            className="pl-10 bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                        />
                    </div>
                    <p className="text-xs text-ch-text-dimmed">Valor mínimo recomendado: R$ 6,00</p>
                </div>

                {/* Otimização */}
                <div className="space-y-2">
                    <Label htmlFor="optimization">Meta de Otimização</Label>
                    <Select value={data.optimization_goal} onValueChange={(v) => updateData({ optimization_goal: v as any })}>
                        <SelectTrigger id="optimization" className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="REACH">Alcance</SelectItem>
                            <SelectItem value="IMPRESSIONS">Impressões</SelectItem>
                            <SelectItem value="LINK_CLICKS">Cliques no Link</SelectItem>
                            <SelectItem value="OFFSITE_CONVERSIONS">Conversões</SelectItem>
                            <SelectItem value="LANDING_PAGE_VIEWS">Visualização da Página</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Evento de Cobrança */}
                <div className="space-y-2">
                    <Label htmlFor="billing">Evento de Cobrança</Label>
                    <Select value={data.billing_event} onValueChange={(v) => updateData({ billing_event: v as any })}>
                        <SelectTrigger id="billing" className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                            <SelectValue placeholder="Quando você é cobrado?" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="IMPRESSIONS">Impressões (CPM)</SelectItem>
                            <SelectItem value="LINK_CLICKS">Cliques (CPC) - Se disponível</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Data de Início */}
                <div className="space-y-2">
                    <Label htmlFor="start-date">Início da Veiculação</Label>
                    <Input
                        id="start-date"
                        type="datetime-local"
                        // Simple approach for string date input
                        value={data.start_time ? data.start_time.slice(0, 16) : ''}
                        onChange={(e) => updateData({ start_time: new Date(e.target.value).toISOString() })}
                        className="bg-ch-dark-gray border-ch-dark-gray text-ch-white w-full block"
                    />
                </div>

                {/* Targeting Simplificado */}
                <div className="col-span-1 md:col-span-2 space-y-4 p-4 border border-ch-dark-gray rounded-lg bg-ch-bg/50">
                    <h3 className="text-md font-medium text-ch-white">Público Alvo (Targeting)</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Idade Mínima</Label>
                            <Input
                                type="number"
                                min="13" max="65"
                                value={data.targeting.age_min}
                                onChange={(e) => updateData({
                                    targeting: { ...data.targeting, age_min: parseInt(e.target.value) }
                                })}
                                className="bg-ch-dark-gray border-ch-dark-gray"
                            />
                        </div>
                        <div>
                            <Label>Idade Máxima</Label>
                            <Input
                                type="number"
                                min="13" max="65"
                                value={data.targeting.age_max}
                                onChange={(e) => updateData({
                                    targeting: { ...data.targeting, age_max: parseInt(e.target.value) }
                                })}
                                className="bg-ch-dark-gray border-ch-dark-gray"
                            />
                        </div>
                    </div>

                    {/* País fixo BR por enquanto */}
                    <div>
                        <Label>Localização</Label>
                        <div className="p-2 bg-ch-dark-gray rounded text-sm text-ch-text-muted mt-1">
                            Brasil (País) - {data.targeting.geo_locations.countries.join(', ')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
