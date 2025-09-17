import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertTriangle, Pause, Clock } from "lucide-react";
import { useTranslation } from 'react-i18next';

export default function RecentAudits() {
  const { t } = useTranslation();
  
  const { data: audits, isLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-audits"],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case 'non_compliant':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'low_performance':
        return <Pause className="h-5 w-5 text-primary" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-primary text-primary-foreground';
      case 'non_compliant':
        return 'bg-destructive text-destructive-foreground';
      case 'low_performance':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'compliant':
        return t('creatives.compliant');
      case 'non_compliant':
        return t('creatives.nonCompliant');
      case 'low_performance':
        return t('reports.low');
      default:
        return t('creatives.pending');
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const auditDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - auditDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d atrás`;
  };

  return (
    <Card className="bg-white shadow-sm border border-slate-200">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-medium text-slate-900">
          {t('dashboard.recentAudits')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : audits && audits.length > 0 ? (
          <div className="flow-root">
            <ul className="-mb-8">
              {audits.map((audit: any, index: number) => (
                <li key={audit.id}>
                  <div className={`relative ${index < audits.length - 1 ? 'pb-8' : ''}`}>
                    {index < audits.length - 1 && (
                      <span 
                        className="absolute top-8 left-4 -ml-px h-full w-0.5 bg-slate-200" 
                        aria-hidden="true" 
                      />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full ${getStatusBg(audit.status)} flex items-center justify-center ring-8 ring-white`}>
                          {getStatusIcon(audit.status)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-sm text-slate-600">
                            {t('creatives.title')} <span className="font-medium text-slate-900">{audit.creative?.name || t('common.noDataAvailable')}</span> - {getStatusText(audit.status)}
                          </p>
                          {audit.issues && audit.issues.length > 0 && (
                            <p className="text-xs text-slate-500">
                              {audit.issues[0]?.description || t('aiAnalysis.analysisComplete')}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm whitespace-nowrap text-slate-500">
                          <time>{formatTimeAgo(audit.createdAt)}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-6">
            <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">{t('dashboard.noRecentAudits')}</p>
            <p className="text-xs text-slate-500">Execute uma sincronização para ver as auditorias</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
