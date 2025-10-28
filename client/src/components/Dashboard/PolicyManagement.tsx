import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PolicyModal from "@/components/Modals/PolicyModal";
import { Settings, Plus, CheckCircle, BarChart3 } from "lucide-react";
import { useTranslation } from 'react-i18next';
import type { Policy } from "@shared/schema";

export default function PolicyManagement() {
  const { t } = useTranslation();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: policies, isLoading } = useQuery<Policy[]>({
    queryKey: ["/api/policies"],
  });

  const handleCreatePolicy = () => {
    setSelectedPolicy(null);
    setIsModalOpen(true);
  };

  const handleEditPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsModalOpen(true);
  };

  const formatLastUpdated = (date: string) => {
    const now = new Date();
    const updated = new Date(date);
    const diffInDays = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Hoje';
    if (diffInDays === 1) return 'Ontem';
    if (diffInDays < 7) return `${diffInDays} dias atrás`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} semanas atrás`;
    return `${Math.floor(diffInDays / 30)} meses atrás`;
  };

  return (
    <>
      <Card className="bg-white shadow-sm border border-slate-200">
        <CardHeader className="px-6 py-4 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium text-slate-900">
            {t('dashboard.policyManagement')}
          </CardTitle>
          <Button
            onClick={handleCreatePolicy}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('policies.create')}
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full mb-3" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-4/6" />
                    <Skeleton className="h-3 w-3/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : policies && policies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {policies.slice(0, 4).map((policy: Policy) => (
                <div
                  key={policy.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => handleEditPolicy(policy)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-medium text-slate-900">
                      {policy.name}
                    </h4>
                    <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                      {policy.status === 'active' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">
                    {policy.description || 'Sem descrição'}
                  </p>

                  <div className="space-y-2">
                    {/* Show compliance rules */}
                    {policy.rules && typeof policy.rules === 'object' && Object.keys(policy.rules).length > 0 ? (
                      Object.entries(policy.rules as Record<string, any>).slice(0, 2).map(([key, value]) => (
                        <div key={key} className="flex items-center text-xs text-slate-600">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                          <span className="capitalize">{key.replace('_', ' ')}</span>
                        </div>
                      ))
                    ) : null}

                    {/* Show performance thresholds */}
                    {policy.performanceThresholds && typeof policy.performanceThresholds === 'object' ? (
                      Object.entries(policy.performanceThresholds as Record<string, any>).slice(0, 1).map(([key, value]) => (
                        <div key={key} className="flex items-center text-xs text-slate-600">
                          <BarChart3 className="h-3 w-3 text-blue-500 mr-2" />
                          <span className="capitalize">{key.replace('_', ' ')}: {value}</span>
                        </div>
                      ))
                    ) : null}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-xs text-slate-500">
                    <span>Política {policy.isDefault ? 'padrão' : 'personalizada'}</span>
                    <span>Atualizada {policy.updatedAt ? formatLastUpdated(policy.updatedAt.toString()) : 'nunca'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Settings className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-2">{t('policies.noBrandConfig')}</p>
              <p className="text-xs text-slate-500 mb-4">
                {t('policies.noBrandConfigDescription')}
              </p>
              <Button
                onClick={handleCreatePolicy}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('policies.createFirstConfig')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <PolicyModal
          policy={selectedPolicy}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}