import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { ModuleSwitchTransition } from './ModuleSwitchTransition';
import { useAuth } from '@/contexts/AuthContext';
import { IntegrationFilterProvider } from '@/contexts/IntegrationFilterContext';
import { DateFilterProvider } from '@/contexts/DateFilterContext';
import { Loader2, Menu } from 'lucide-react';
import AIChatPanel from '@/components/AIChatPanel';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { RouteErrorBoundary } from './RouteErrorBoundary';

interface AppLayoutProps {
    requireAuth?: boolean;
}

export function AppLayout({ requireAuth = true }: AppLayoutProps) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { t } = useTranslation(['sidebar']);
    const reduced = useReducedMotion();
    const { pageTransition } = motionVariants(reduced);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-ch-orange animate-spin" />
                    <div className="flex flex-col items-center">
                        <span className="text-foreground font-medium">Click Auditor</span>
                        <span className="text-muted-foreground text-xs">{t('sidebar:syncEcosystem')}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (requireAuth && !user) {
        console.log('[AppLayout] No user found, redirecting to login');
        return <Navigate to="/login" replace />;
    }

    const adminPaths = ['/settings', '/integracoes', '/empresa', '/usuarios', '/preferencias', '/contexto'];
    const internalAdminPaths = ['/fury'];
    if (user?.role === 'operador' && adminPaths.some(p => location.pathname.startsWith(p))) {
        return <Navigate to="/dashboard" replace />;
    }
    const isAppAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';
    if (!isAppAdmin && internalAdminPaths.some(p => location.pathname.startsWith(p))) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <IntegrationFilterProvider>
            <DateFilterProvider>
            <div className="flex h-screen overflow-hidden bg-background">
                <ModuleSwitchTransition />
                <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden relative pb-20 md:pb-24">
                    <div className="md:hidden flex items-center h-16 px-4 border-b border-border bg-background sticky top-0 z-30">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            aria-label="Ir para visão geral"
                            className="ml-4 font-bold text-foreground hover:text-primary transition-colors"
                        >
                            Click Auditor
                        </button>
                    </div>

                    <motion.div
                        key={location.pathname}
                        className="w-full max-w-full min-w-0"
                        initial={reduced ? false : 'hidden'}
                        animate="visible"
                        variants={pageTransition}
                    >
                        <RouteErrorBoundary key={location.pathname}>
                            <Outlet />
                        </RouteErrorBoundary>
                    </motion.div>
                </main>
                <AIChatPanel />
            </div>
            </DateFilterProvider>
        </IntegrationFilterProvider>
    );
}

export function AuthLayout() {
    const { user, loading } = useAuth();
    const { t } = useTranslation(['common']);
    const location = useLocation();
    const reduced = useReducedMotion();
    const { pageTransition } = motionVariants(reduced);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-ch-orange animate-spin" />
                    <span className="text-muted-foreground text-sm">{t('common:loading')}</span>
                </div>
            </div>
        );
    }

    const isLogin = location.pathname === '/login';

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    if (isLogin) {
        return <Outlet />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                className="w-full max-w-md"
                initial="hidden"
                animate="visible"
                variants={pageTransition}
            >
                <Outlet />
            </motion.div>
        </div>
    );
}
