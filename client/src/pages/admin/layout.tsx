import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import SuperAdminSidebar from '@/components/Layout/SuperAdminSidebar';
import Header from '@/components/Layout/Header';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive'
      });
      setLocation('/dashboard');
    }
  }, [user, setLocation, toast]);

  if (user?.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Super Admin" />
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
                {description && (
                  <p className="text-gray-600 dark:text-gray-300">{description}</p>
                )}
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
