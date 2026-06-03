import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, MousePointer, Wallet, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BudgetPulseProps {
    spend: number;
    budget: number;
    cpm?: number;
    cpc?: number;
}

export function BudgetPulse({ spend, budget, cpm = 0, cpc = 0 }: BudgetPulseProps) {
    const safeBudget = budget > 0 ? budget : 1;
    const percentage = (spend / safeBudget) * 100;
    const isOverBudget = spend > budget;
    const remaining = Math.max(budget - spend, 0);

    return (
        <Card className={`shadow-sm border-l-4 ${isOverBudget ? 'border-l-destructive' : 'border-l-ch-orange'} flex flex-col glass-card`}>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                    <Wallet className={`w-3.5 h-3.5 ${isOverBudget ? 'text-destructive' : 'text-ch-orange'}`} />
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
                        Ritmo de Gastos
                    </CardTitle>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                        {formatCurrency(spend)}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">
                        de {formatCurrency(Math.round(budget))}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 flex flex-col pt-0">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Progress
                            value={Math.min(percentage, 100)}
                            className="h-2 bg-white/5"
                            indicatorClassName={isOverBudget ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]" : percentage > 90 ? "bg-amber-500" : "bg-ch-orange"}
                        />
                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tight opacity-70">
                            <span className={isOverBudget ? "text-destructive" : ""}>
                                {percentage.toFixed(1)}% Consumido
                            </span>
                            <span>
                                {isOverBudget
                                    ? `Excedido em ${formatCurrency(spend - budget)}`
                                    : `Restam ${formatCurrency(remaining)}`
                                }
                            </span>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 p-4 border rounded-2xl ${isOverBudget
                            ? "bg-destructive/10 border-destructive/20"
                            : "bg-muted/30 border-border"
                        }`}>
                        <div className={`p-2 rounded-xl ${isOverBudget
                                ? "bg-destructive/20 text-destructive"
                                : percentage > 90
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-500"
                            }`}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <p className={`text-sm font-medium leading-tight ${isOverBudget ? "text-destructive-foreground font-bold" : "text-foreground/90"}`}>
                            {isOverBudget ? "Alerta: Orçamento estourado!" :
                                percentage > 90 ? "Atenção: Orçamento próximo do fim." :
                                    percentage < 30 ? "Ritmo de gastos saudável." :
                                        "Ritmo de gastos dentro do esperado."}
                        </p>
                    </div>
                </div>

                {/* Extra Metrics Section */}
                <div className="mt-auto grid grid-cols-2 gap-4 pt-6 border-t border-border">
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground/60">
                            <Target className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">CPM Médio</span>
                        </div>
                        <p className="text-xl font-bold text-foreground tabular-nums">
                            {formatCurrency(cpm)}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground/60">
                            <MousePointer className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">CPC Médio</span>
                        </div>
                        <p className="text-xl font-bold text-foreground tabular-nums">
                            {formatCurrency(cpc)}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
