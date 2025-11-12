import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { SiFacebook, SiGoogle } from 'react-icons/si';

interface HowToConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: 'meta' | 'google';
}

export function HowToConnectModal({ open, onOpenChange, platform }: HowToConnectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platform === 'meta' ? (
              <>
                <SiFacebook className="w-5 h-5 text-blue-600" />
                Como Conectar - Meta Ads
              </>
            ) : (
              <>
                <SiGoogle className="w-5 h-5 text-red-600" />
                Como Conectar - Google Ads
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Siga o passo-a-passo para conectar sua conta de anúncios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {platform === 'meta' ? <MetaInstructions /> : <GoogleInstructions />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaInstructions() {
  return (
    <>
      <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900 dark:text-green-100">
          <strong>✨ Conexão 100% Automática via OAuth</strong><br />
          Clique em "Conectar", faça login no Facebook e pronto! O sistema faz tudo automaticamente.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <StepItem number={1} title="Clique em 'Conectar com Meta'">
          Uma janela será aberta automaticamente para autenticação
        </StepItem>

        <StepItem number={2} title="Faça login no Facebook">
          Use suas credenciais do Facebook Business Manager
        </StepItem>

        <StepItem number={3} title="Autorize o acesso">
          Permita que o Click Auditor acesse suas contas de anúncios
        </StepItem>

        <StepItem number={4} title="Selecione suas contas">
          Escolha quais contas de anúncios você deseja conectar
        </StepItem>

        <StepItem number={5} title="Pronto!">
          Suas campanhas serão sincronizadas automaticamente
        </StepItem>
      </div>

      <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200">
        <CheckCircle2 className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-purple-900 dark:text-purple-100">
          <strong>✅ Vantagens do OAuth:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Conexão segura sem expor tokens</li>
            <li>Tokens renovados automaticamente (60 dias)</li>
            <li>Selecione múltiplas contas de anúncios</li>
            <li>Processo em menos de 1 minuto</li>
          </ul>
        </AlertDescription>
      </Alert>
    </>
  );
}

function GoogleInstructions() {
  return (
    <>
      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>⚠️ Google Ads requer configuração manual</strong><br />
          O processo é mais técnico e pode levar alguns minutos.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <GoogleStep
          number={1}
          title="Acesse o Google Cloud Console"
          description="Crie ou selecione um projeto no Google Cloud"
          link="https://console.cloud.google.com"
          linkText="Abrir Google Cloud Console"
        />

        <GoogleStep
          number={2}
          title="Ative a Google Ads API"
          description="No menu lateral: APIs e Serviços → Biblioteca. Pesquise por 'Google Ads API' e ative"
        />

        <GoogleStep
          number={3}
          title="Configure OAuth 2.0"
          description="Navegue até: APIs e Serviços → Credenciais. Crie credenciais do tipo 'ID do cliente OAuth 2.0'"
          link="https://console.cloud.google.com/apis/credentials"
          linkText="Gerenciar Credenciais"
        />

        <GoogleStep
          number={4}
          title="Obtenha o Customer ID"
          description="Acesse sua conta Google Ads e copie o Customer ID. Formato: 123-456-7890"
          link="https://ads.google.com"
          linkText="Abrir Google Ads"
        />
      </div>
    </>
  );
}

interface StepItemProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function StepItem({ number, title, children }: StepItemProps) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{children}</p>
      </div>
    </div>
  );
}

interface GoogleStepProps {
  number: number;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}

function GoogleStep({ number, title, description, link, linkText }: GoogleStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{description}</p>
        {link && linkText && (
          <Button variant="outline" size="sm" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              {linkText}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
