import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CreativeAuditModal from "@/components/Modals/CreativeAuditModal";
import { Image, AlertTriangle, TrendingDown, Palette } from "lucide-react";
import type { Creative, Audit } from "@shared/schema";

type ProblemCreative = Creative & { audit: Audit };

export default function ProblemCreatives() {
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  
  const { data: problemCreatives, isLoading } = useQuery<ProblemCreative[]>({
    queryKey: ["/api/dashboard/problem-creatives"],
  });

  const getIssueIcon = (issueType: string) => {
    switch (issueType) {
      case 'compliance':
        return <AlertTriangle className="h-4 w-4 mr-1" />;
      case 'performance':
        return <TrendingDown className="h-4 w-4 mr-1" />;
      case 'brand':
        return <Palette className="h-4 w-4 mr-1" />;
      default:
        return <AlertTriangle className="h-4 w-4 mr-1" />;
    }
  };

  const getIssueBadgeColor = (status: string) => {
    switch (status) {
      case 'non_compliant':
        return 'bg-destructive text-destructive-foreground';
      case 'low_performance':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getIssueText = (status: string, issues: any[]) => {
    if (status === 'non_compliant') {
      // Don't show technical error messages to users
      const firstIssue = issues[0]?.description || '';
      
      // If it's a technical error, show a user-friendly message
      if (firstIssue.includes('Analysis failed') || firstIssue.includes('análise falhou') || firstIssue.includes('unable to process')) {
        return 'Requer revisão';
      }
      
      // For other compliance issues, show them normally
      return firstIssue || 'Não conforme';
    }
    if (status === 'low_performance') {
      return 'CTR baixo';
    }
    return 'Problema identificado';
  };

  return (
    <>
      <Card className="bg-card shadow-sm border border-border">
        <CardHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium text-foreground">
            Criativos com Problemas
          </CardTitle>
          <Button variant="link" className="text-primary hover:text-primary/80 text-sm font-medium p-0">
            Ver todos
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-3 border border-slate-200 rounded-lg">
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : problemCreatives && problemCreatives.length > 0 ? (
            <div className="space-y-4">
              {problemCreatives.map((item: ProblemCreative) => (
                <div 
                  key={item.id} 
                  className="flex items-center space-x-4 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCreative(item)}
                >
                  {/* Creative Preview */}
                  <div className="flex-shrink-0">
                    {item.imageUrl ? (
                      <img 
                        className="h-16 w-16 rounded-lg object-cover" 
                        src={item.imageUrl}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=400';
                        }}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Image className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Creative Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      Campanha: {item.campaign?.name || 'Campanha não identificada'}
                    </p>
                    <div className="flex items-center mt-1">
                      <Badge className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getIssueBadgeColor(item.audit.status)}`}>
                        {getIssueIcon(item.audit.status)}
                        {getIssueText(item.audit.status, item.audit.issues || [])}
                      </Badge>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="text-right">
                    <p className="text-sm text-slate-900 font-medium">
                      {item.impressions ? `${(item.impressions / 1000).toFixed(1)}K` : '0'}
                    </p>
                    <p className="text-xs text-slate-500">impressões</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Nenhum problema identificado</p>
              <p className="text-xs text-slate-500">Todos os criativos estão conformes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCreative && (
        <CreativeAuditModal 
          creative={selectedCreative}
          onClose={() => setSelectedCreative(null)}
        />
      )}
    </>
  );
}
