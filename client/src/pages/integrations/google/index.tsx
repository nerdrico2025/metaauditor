import { useState } from 'react';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { HowToConnectModal } from '../components/HowToConnectModal';

export default function GoogleIntegrations() {
  const [howToConnectOpen, setHowToConnectOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Google Ads - Integrações" />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <Card>
                <CardHeader className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                        <SiGoogle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle>Google Ads</CardTitle>
                        <CardDescription>Google Search & Display</CardDescription>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setHowToConnectOpen(true)}
                      data-testid="button-how-to-connect-google"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Como Conectar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <SiGoogle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Google Ads em desenvolvimento
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      A integração com Google Ads estará disponível em breve
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <HowToConnectModal 
        open={howToConnectOpen} 
        onOpenChange={setHowToConnectOpen}
        platform="google"
      />
    </div>
  );
}
