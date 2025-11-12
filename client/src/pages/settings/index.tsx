import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2, Palette, FileCheck } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();

  const settingsPages = [
    {
      id: 'brand',
      name: 'Configurações de Marca',
      description: 'Defina cores, logos e diretrizes da sua marca',
      icon: Palette,
      iconColor: 'bg-purple-600',
      gradient: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
      link: '/settings/brand',
    },
    {
      id: 'content',
      name: 'Critérios de Conteúdo',
      description: 'Configure palavras proibidas e termos obrigatórios',
      icon: FileCheck,
      iconColor: 'bg-blue-600',
      gradient: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
      link: '/settings/content-criteria',
    },
    {
      id: 'company',
      name: 'Configurações da Empresa',
      description: 'Gerencie informações e usuários da empresa',
      icon: Building2,
      iconColor: 'bg-green-600',
      gradient: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
      link: '/settings/company',
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Configurações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Personalize as configurações da sua conta e empresa
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {settingsPages.map((page) => {
                  const Icon = page.icon;
                  
                  return (
                    <Card key={page.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className={`bg-gradient-to-br ${page.gradient}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 ${page.iconColor} rounded-xl flex items-center justify-center`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{page.name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <CardDescription className="mb-4 text-sm">
                          {page.description}
                        </CardDescription>
                        <Button asChild className="w-full" variant="outline">
                          <Link href={page.link}>
                            Acessar
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
