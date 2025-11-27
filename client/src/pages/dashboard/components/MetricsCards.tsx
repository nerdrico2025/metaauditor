import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, Image, CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

export default function MetricsCards() {
  const { t } = useTranslation();
  
  const { data: metrics, isLoading } = useQuery<{
    activeCampaigns: number;
    totalCreatives: number;
    compliant: number;
    nonCompliant: number;
  }>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const cards = [
    {
      title: t('dashboard.activeCampaigns'),
      value: metrics?.activeCampaigns || 0,
      icon: BellRing,
      bgColor: "bg-blue-500",
      iconColor: "text-white",
    },
    {
      title: t('dashboard.creatives'), 
      value: metrics?.totalCreatives || 0,
      icon: Image,
      bgColor: "bg-purple-500",
      iconColor: "text-white",
    },
    {
      title: "Em Conformidade",
      value: metrics?.compliant || 0,
      icon: CheckCircle,
      bgColor: "bg-green-500",
      iconColor: "text-white",
    },
    {
      title: "Não Conforme",
      value: metrics?.nonCompliant || 0,
      icon: XCircle,
      bgColor: "bg-red-500",
      iconColor: "text-white",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-white dark:bg-white overflow-hidden shadow-sm border border-slate-200">
          <CardContent className="p-5 bg-white dark:bg-white">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">
                    {card.title}
                  </dt>
                  <dd className="text-lg font-semibold text-foreground">
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
