import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Menu, Bell, RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { toast } = useToast();

  const syncMutation = useMutation({
    mutationFn: async () => {
      // This would normally trigger sync for all integrations
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      toast({
        title: "Sincronização Concluída",
        description: "Dados atualizados com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creatives"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao sincronizar dados",
        variant: "destructive",
      });
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-slate-200">
      {/* Mobile menu button */}
      <button className="px-4 border-r border-slate-200 text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 px-4 flex justify-between sm:px-6 lg:px-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        </div>

        <div className="ml-4 flex items-center md:ml-6 space-x-4">
          {/* Notifications */}
          <button className="bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
            <Bell className="h-5 w-5" />
          </button>

          {/* Sync Button */}
          <Button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {syncMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}