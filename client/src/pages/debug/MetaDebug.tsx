import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    totalAdsFound: number;
    campaigns: Array<{
      campaignName: string;
      externalId: string;
      adsInDB: number;
      adsFromAPI: number;
      difference: number;
    }>;
  };
  note: string;
}

export default function MetaDebug() {
  const [integrationId, setIntegrationId] = useState<string>('');
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<DebugData>({
    queryKey: ['/api/integrations', integrationId, 'debug/count-ads'],
    enabled: shouldFetch && !!integrationId,
  });

  const handleCheck = () => {
    if (integrationId) {
      setShouldFetch(true);
    }
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
              Cole o ID da sua integração Meta Ads para verificar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <input
                type="text"
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                placeholder="Ex: cm123456789..."
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
        {data && (
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
                  {data.note} - Total encontrado: {data.apiSample.totalAdsFound} anúncios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.apiSample.campaigns.map((campaign) => (
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

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">No Banco</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                            {campaign.adsInDB}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Na API</p>
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
                    </div>
                  ))}
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
