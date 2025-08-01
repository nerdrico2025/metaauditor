import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SiFacebook, SiGoogle } from "react-icons/si";

export default function IntegrationStatus() {
  const { data: integrations, isLoading } = useQuery<any[]>({
    queryKey: ["/api/integrations"],
  });

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Nunca sincronizado';
    
    const now = new Date();
    const syncDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `há ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `há ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `há ${diffInDays}d`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mr-1" />
            Reconectando
          </Badge>
        );
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'meta':
        return <SiFacebook className="text-blue-600" />;
      case 'google':
        return <SiGoogle className="text-red-600" />;
      default:
        return null;
    }
  };

  const getPlatformBg = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'bg-blue-100';
      case 'google':
        return 'bg-red-100';
      default:
        return 'bg-slate-100';
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'Meta Ads';
      case 'google':
        return 'Google Ads';
      default:
        return platform;
    }
  };

  // Default integrations to show even when no data
  const defaultIntegrations = [
    { platform: 'meta', status: 'inactive', lastSync: null },
    { platform: 'google', status: 'inactive', lastSync: null },
  ];

  const displayIntegrations = integrations && integrations.length > 0 
    ? integrations 
    : defaultIntegrations;

  return (
    <Card className="bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-medium text-slate-900">
          Status das Integrações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="ml-4 space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayIntegrations.map((integration: any, index: number) => (
              <div 
                key={integration.id || `default-${integration.platform}`} 
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center">
                  <div className={`w-10 h-10 ${getPlatformBg(integration.platform)} rounded-lg flex items-center justify-center`}>
                    {getPlatformIcon(integration.platform)}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-900">
                      {getPlatformName(integration.platform)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Última sinc: {formatLastSync(integration.lastSync)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {getStatusBadge(integration.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
