import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Ad {
  id: string;
  name: string;
  status: "ativo" | "pausado" | "finalizado";
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversions: number;
  trend: "up" | "down" | "neutral";
}

const ads: Ad[] = [
  { id: "1", name: "Campanha Black Friday 2025", status: "ativo", spend: "R$ 2.450", impressions: "45.2K", clicks: "3.1K", ctr: "6.86%", cpc: "R$ 0.79", conversions: 187, trend: "up" },
  { id: "2", name: "Remarketing - Carrinho Abandonado", status: "ativo", spend: "R$ 1.820", impressions: "28.7K", clicks: "2.4K", ctr: "8.36%", cpc: "R$ 0.76", conversions: 142, trend: "up" },
  { id: "3", name: "Lookalike - Compradores VIP", status: "ativo", spend: "R$ 3.100", impressions: "62.1K", clicks: "4.2K", ctr: "6.76%", cpc: "R$ 0.74", conversions: 203, trend: "neutral" },
  { id: "4", name: "Vídeo - Lançamento Produto X", status: "pausado", spend: "R$ 890", impressions: "18.3K", clicks: "1.1K", ctr: "6.01%", cpc: "R$ 0.81", conversions: 54, trend: "down" },
  { id: "5", name: "Stories - Promoção Verão", status: "finalizado", spend: "R$ 1.560", impressions: "34.8K", clicks: "2.8K", ctr: "8.05%", cpc: "R$ 0.56", conversions: 165, trend: "up" },
];

const statusStyles: Record<Ad["status"], string> = {
  ativo: "bg-success/15 text-success border-success/30",
  pausado: "bg-warning/15 text-warning border-warning/30",
  finalizado: "bg-muted text-muted-foreground border-border",
};

const TrendIcon = ({ trend }: { trend: Ad["trend"] }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const AdsTable = () => {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-6 pb-4">
        <h3 className="text-lg font-semibold text-foreground">Seus Anúncios</h3>
        <p className="text-sm text-muted-foreground">Gerencie e analise a performance dos seus anúncios</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-border">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Anúncio</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Gasto</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Impressões</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliques</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">CTR</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">CPC</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Conv.</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Trend</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad.id} className="border-t border-border transition-colors hover:bg-secondary/50">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{ad.name}</td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className={statusStyles[ad.status]}>
                    {ad.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right text-sm text-foreground">{ad.spend}</td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">{ad.impressions}</td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">{ad.clicks}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-primary">{ad.ctr}</td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">{ad.cpc}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-foreground">{ad.conversions}</td>
                <td className="px-6 py-4 text-center"><TrendIcon trend={ad.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdsTable;
