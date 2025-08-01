import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, Image, AlertTriangle, TrendingDown } from "lucide-react";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery<{
    activeCampaigns: number;
    creativesAnalyzed: number;
    nonCompliant: number;
    lowPerformance: number;
  }>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const cards = [
    {
      title: "Campanhas Ativas",
      value: metrics?.activeCampaigns || 0,
      icon: BellRing,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Criativos Analisados", 
      value: metrics?.creativesAnalyzed || 0,
      icon: Image,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Não Conformes",
      value: metrics?.nonCompliant || 0,
      icon: AlertTriangle,
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Baixa Performance",
      value: metrics?.lowPerformance || 0,
      icon: TrendingDown,
      bgColor: "bg-amber-100",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-white overflow-hidden shadow-sm border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    {card.title}
                  </dt>
                  <dd className="text-lg font-semibold text-slate-900">
                    {isLoading ? (
                      <Skeleton className="h-6 w-12" />
                    ) : (
                      card.value.toLocaleString()
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
