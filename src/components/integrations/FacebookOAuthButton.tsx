import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Facebook } from "lucide-react";
import { FACEBOOK_CONFIG } from "@/config/facebook";

interface FacebookOAuthButtonProps {
  userId: string;
  companyId: string;
  redirectUrl?: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "sm" | "default" | "lg" | "icon";
  onSuccess?: (sessionId: string) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function FacebookOAuthButton({
  userId,
  companyId,
  redirectUrl,
  variant = "default",
  size = "default",
  onSuccess,
  onError,
  children,
  className,
}: FacebookOAuthButtonProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  // Popup context: quando o edge function redireciona de volta para esta página no popup
  useEffect(() => {
    if (window.opener && window.location.search.includes('source=meta_oauth')) {
      const searchParams = new URLSearchParams(window.location.search);
      window.opener.postMessage({
        type: 'facebook_oauth_callback',
        success: searchParams.get('success') === 'true',
        error: searchParams.get('error'),
        session_id: searchParams.get('session_id'),
      }, '*');
      window.close();
    }
  }, []);

  // Janela principal: escuta mensagem do popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, success, error, session_id } = event.data;

      if (type === 'facebook_oauth_callback') {
        setIsConnecting(false);

        if (success) {
          if (onSuccess) onSuccess(session_id || '');
        } else if (error) {
          const errorMessage = decodeURIComponent(error);
          toast({
            title: "Erro na conexão",
            description: errorMessage,
            variant: "destructive",
          });
          if (onError) onError(errorMessage);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast, onSuccess, onError]);


  const handleConnectMeta = () => {
    // Usa configuração centralizada
    if (!FACEBOOK_CONFIG.isConfigured()) {
      toast({
        title: "Configuração pendente",
        description: "O App ID do Facebook ainda não foi configurado. Verifique o arquivo src/config/facebook.ts",
        variant: "destructive",
      });
      console.error("Facebook não configurado. App ID:", FACEBOOK_CONFIG.appId);
      return;
    }

    setIsConnecting(true);

    const redirectUri = FACEBOOK_CONFIG.getRedirectUri();

    // Garantir que a redirect_url seja sempre absoluta
    let finalRedirectUrl = redirectUrl || window.location.pathname;
    if (finalRedirectUrl.startsWith('/')) {
      finalRedirectUrl = window.location.origin + finalRedirectUrl;
    }

    const state = btoa(JSON.stringify({
      user_id: userId,
      company_id: companyId,
      redirect_url: finalRedirectUrl,
    }));

    const scope = FACEBOOK_CONFIG.scope.join(',');

    const oauthUrl =
      `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${FACEBOOK_CONFIG.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&state=${state}` +
      `&response_type=code`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      oauthUrl,
      'facebook_oauth',
      `width=${width},height=${height},top=${top},left=${left},status=yes,scrollbars=yes`
    );

    // Checar se o popup foi fechado manualmente pelo usuário
    const timer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(timer);
        setIsConnecting(false);
      }
    }, 1000);
  };

  return (
    <Button
      onClick={handleConnectMeta}
      disabled={isConnecting}
      variant={variant}
      size={size}
      className={className}
    >
      <Facebook className="mr-2 h-4 w-4" />
      {isConnecting ? "Conectando..." : children || "Conectar Facebook"}
    </Button>
  );
}
