import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiFacebook, SiGoogle } from 'react-icons/si';

interface Integration {
  id: string;
  platform: string;
  accountId: string | null;
  accountName: string | null;
  status: string;
}

export default function Integrations() {
  const { user } = useAuth();

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const metaIntegrations = integrations.filter(i => i.platform === 'meta');
  const googleIntegrations = integrations.filter(i => i.platform === 'google');

  const platforms = [
    {
      id: 'meta',
      name: 'Meta Ads',
      description: 'Facebook & Instagram',
      icon: SiFacebook,
      iconColor: 'bg-blue-600',
      gradient: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
      link: '/integrations/meta',
      connectedCount: metaIntegrations.length,
      status: metaIntegrations.length > 0 ? 'connected' : 'available',
    },
    {
      id: 'google',
      name: 'Google Ads',
      description: 'Google Search & Display',
      icon: SiGoogle,
      iconColor: 'bg-red-600',
      gradient: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
      link: '/integrations/google',
      connectedCount: googleIntegrations.length,
      status: 'soon',
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Conecte suas contas de anúncios para sincronizar campanhas e criativos automaticamente
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {platforms.map((platform) => {
                  const Icon = platform.icon;
                  
                  return (
                    <Card key={platform.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className={`bg-gradient-to-br ${platform.gradient}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 ${platform.iconColor} rounded-xl flex items-center justify-center`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <CardTitle>{platform.name}</CardTitle>
                              <CardDescription className="text-gray-700 dark:text-gray-300">
                                {platform.description}
                              </CardDescription>
                            </div>
                          </div>
                          {platform.status === 'connected' && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {platform.connectedCount} {platform.connectedCount === 1 ? 'conta' : 'contas'}
                            </Badge>
                          )}
                          {platform.status === 'soon' && (
                            <Badge variant="secondary">
                              Em breve
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {platform.status === 'connected' && 
                            `Você tem ${platform.connectedCount} ${platform.connectedCount === 1 ? 'conta conectada' : 'contas conectadas'}. Gerencie suas integrações e sincronize dados.`
                          }
                          {platform.status === 'available' && 
                            'Conecte sua conta de anúncios para começar a sincronizar campanhas e analisar criativos automaticamente.'
                          }
                          {platform.status === 'soon' && 
                            'Esta integração estará disponível em breve. Aguarde novidades!'
                          }
                        </p>
                        <Button 
                          asChild 
                          className="w-full"
                          disabled={platform.status === 'soon'}
                          variant={platform.status === 'connected' ? 'default' : 'outline'}
                        >
                          <Link href={platform.link}>
                            {platform.status === 'connected' ? 'Gerenciar' : 'Conectar'}
                            {platform.status !== 'soon' && <ArrowRight className="w-4 h-4 ml-2" />}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Stats */}
              {integrations.length > 0 && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">Total de Contas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {integrations.length}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">Contas Ativas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {integrations.filter(i => i.status === 'active').length}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">Plataformas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {new Set(integrations.map(i => i.platform)).size}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
