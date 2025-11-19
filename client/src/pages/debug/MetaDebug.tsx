import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface DebugData {
  integration: {
    id: string;
    platform: string;
    accountName: string;
  };
  database: {
    totalCampaigns: number;
    totalAdSets: number;
    totalAds: number;
  };
  apiSample: {
    campaignsChecked: number;
    totalAdSetsFound: number;
    totalAdsFound: number;
    campaigns: Array<{
      campaignName: string;
      externalId: string;
      adSetsFromAPI: number;
      adsInDB: number;
      adsFromAPI: number;
      difference: number;
      error?: string;
    }>;
  };
  note: string;
}

interface Integration {
  id: string;
  platform: string;
  accountName: string | null;
  status: string;
}

export default function MetaDebug() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [integrationId, setIntegrationId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');

  const { data, isLoading, error, refetch } = useQuery<DebugData>({
    queryKey: integrationId ? [`/api/integrations/${integrationId}/debug/count-ads`] : ['disabled'],
    enabled: false, // Disabled by default, will trigger manually
  });

  const handleCheck = async () => {
    if (integrationId) {
      console.log('🔍 Fetching debug data for integration:', integrationId);
      await refetch();
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast({
      title: 'ID copiado!',
      description: 'Cole no campo acima e clique em Verificar',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectIntegration = (id: string) => {
    setIntegrationId(id);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            Debug: Meta Ads Sync
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Compare os dados no banco de dados com os dados da API do Meta
          </p>
        </div>

        {/* Integration ID Input */}
        <Card>
          <CardHeader>
            <CardTitle>ID da Integração</CardTitle>
            <CardDescription>
              Selecione uma integração abaixo ou cole o ID manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Available Integrations */}
            {metaIntegrations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Suas Integrações Meta:
                </h3>
                <div className="space-y-2">
                  {metaIntegrations.map((integration) => (
                    <div
                      key={integration.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        integrationId === integration.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => handleSelectIntegration(integration.id)}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {integration.accountName || 'Conta Meta'}
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {integration.id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyId(integration.id);
                        }}
                        data-testid={`button-copy-${integration.id}`}
                      >
                        {copiedId === integration.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                placeholder="Ou cole o ID manualmente..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                data-testid="input-integration-id"
              />
              <Button 
                onClick={handleCheck} 
                disabled={!integrationId || isLoading}
                data-testid="button-check"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao buscar dados: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Results */}
        {data && data.database && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Campanhas no Banco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                    {data.database.totalCampaigns}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Ad Sets no Banco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                    {data.database.totalAdSets}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Anúncios no Banco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                    {data.database.totalAds}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Sample */}
            <Card>
              <CardHeader>
                <CardTitle>Comparação com API do Meta</CardTitle>
                <CardDescription>
                  {data.note} - Total: {data.apiSample.totalAdSetsFound} ad sets, {data.apiSample.totalAdsFound} anúncios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.apiSample.campaigns.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Nenhuma campanha com anúncios encontrada
                    </p>
                  ) : (
                    data.apiSample.campaigns.map((campaign) => {
                      return (
                    <div
                      key={campaign.externalId}
                      className="border border-gray-200 dark:border-gray-800 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                            {campaign.campaignName}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {campaign.externalId}
                          </p>
                        </div>
                        {campaign.difference === 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Ad Sets (API)</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                            {campaign.adSetsFromAPI}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Ads no Banco</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                            {campaign.adsInDB}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Ads na API</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                            {campaign.adsFromAPI}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Diferença</p>
                          <p
                            className={`text-lg font-semibold ${
                              campaign.difference === 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {campaign.difference > 0 ? '+' : ''}
                            {campaign.difference}
                          </p>
                        </div>
                      </div>
                      {campaign.error && (
                        <p className="text-xs text-red-600 mt-2">Erro: {campaign.error}</p>
                      )}
                    </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Integration Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Integração</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">ID:</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-50">
                      {data.integration.id}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Plataforma:</dt>
                    <dd className="font-semibold text-gray-900 dark:text-gray-50">
                      {data.integration.platform}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Conta:</dt>
                    <dd className="font-semibold text-gray-900 dark:text-gray-50">
                      {data.integration.accountName}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
