import { useState } from 'react';
import { useCompany, useUpdateCompany, useCompanyStats } from '@/hooks/useCompany';
import { useCompanyIntegrations, getIntegrationStatus } from '@/hooks/useCompanyIntegrations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FacebookOAuthButton } from '@/components/integrations/FacebookOAuthButton';
import { SettingsNav } from '@/components/settings/SettingsNav';
import {
    Building2,
    Users,
    Megaphone,
    Link2,
    FileCheck,
    Loader2,
    Save,
    Facebook,
    Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { statsGridCols } from '@/lib/responsiveGrids';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';

export default function Empresa() {
    const { user } = useAuth();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const { data: company, isLoading } = useCompany();
    const { data: stats } = useCompanyStats();
    const { data: integrations, isLoading: isLoadingIntegrations } = useCompanyIntegrations(user?.company_id);
    const updateCompany = useUpdateCompany();

    const [form, setForm] = useState<{
        name: string;
    } | null>(null);
    const [showIntegrationsDialog, setShowIntegrationsDialog] = useState(false);

    const hasChanges = form !== null;

    const handleEdit = () => {
        if (company) {
            setForm({
                name: company.name || '',
            });
        }
    };

    const handleSave = async () => {
        if (!form) return;
        await updateCompany.mutateAsync(form);
        setForm(null);
    };

    const handleCancel = () => {
        setForm(null);
    };

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
            </div>
        );
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={container} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
            <motion.div variants={item} className="flex flex-col gap-4">
                <SectionHeader
                    title="Empresa"
                    description="Configure as informações da sua empresa"
                    actions={
                        !hasChanges ? (
                            <Button onClick={handleEdit} variant="outline" className="border-border rounded-xl">
                                Editar
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button onClick={handleCancel} variant="outline" className="border-border rounded-xl">
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={updateCompany.isPending}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                                >
                                    {updateCompany.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Salvar
                                </Button>
                            </div>
                        )
                    }
                />
                <SettingsNav />
            </motion.div>

            <motion.div variants={item} className="rounded-2xl p-6 bg-card border border-border shadow-sm hover-lift transition-all">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-ch-orange/10">
                        <Building2 className="w-6 h-6 text-ch-orange" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Plano Atual</p>
                        <p className="text-xl font-bold text-ch-orange">Plano Básico</p>
                    </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
                    <div>
                        <p className="text-sm text-muted-foreground">Campanhas</p>
                        <p className="text-lg font-semibold text-foreground">
                            {stats?.totalCampaigns || 0} / {company?.max_campaigns || 10}
                        </p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-ch-orange transition-all"
                                style={{ width: `${Math.min(100, ((stats?.totalCampaigns || 0) / (company?.max_campaigns || 10)) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Integrações</p>
                        <p className="text-lg font-semibold text-foreground">
                            {stats?.activeIntegrations || 0} / {company?.max_integrations || 2}
                        </p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${Math.min(100, ((stats?.activeIntegrations || 0) / (company?.max_integrations || 2)) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Usuários</p>
                        <p className="text-lg font-semibold text-foreground">
                            {stats?.totalUsers || 0} / {company?.max_users || 6}
                        </p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 transition-all"
                                style={{ width: `${Math.min(100, ((stats?.totalUsers || 0) / (company?.max_users || 6)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Company Info */}
            <motion.div variants={item} className="rounded-xl p-6 space-y-6 bg-card border border-border shadow-sm">
                <h2 className="font-semibold text-foreground">Informações da Empresa</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Nome da Empresa</label>
                        {hasChanges ? (
                            <Input
                                value={form?.name || ''}
                                onChange={(e) => setForm(f => f && { ...f, name: e.target.value })}
                                className="bg-muted/50 border-border"
                            />
                        ) : (
                            <p className="text-foreground font-medium">{company?.name || '-'}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Slug</label>
                        <p className="text-foreground">{company?.slug || '-'}</p>
                    </div>
                </div>
            </motion.div>

            {/* Integrations Section */}
            <motion.div variants={item} className="rounded-2xl p-6 bg-card border border-border shadow-sm hover-lift transition-all">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="font-semibold text-foreground">Integrações Conectadas</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gerencie as integrações da sua empresa
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowIntegrationsDialog(true)}
                        className="bg-ch-orange hover:bg-ch-orange/90"
                        size="sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar
                    </Button>
                </div>

                {isLoadingIntegrations ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                    </div>
                ) : integrations && integrations.length > 0 ? (
                    <div className="space-y-2">
                        {integrations.map((integration) => {
                            const statusInfo = getIntegrationStatus(integration);
                            const bmName = (integration.permissions as any)?.business_manager_name;

                            return (
                                <div
                                    key={integration.id}
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <Facebook className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-foreground">
                                                {integration.account_name || 'Meta Ads'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {bmName ? `BM: ${bmName}` : `ID: ${integration.account_id}`}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={statusInfo.variant as any}>
                                        {statusInfo.label}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Link2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma integração conectada</p>
                        <Button
                            onClick={() => setShowIntegrationsDialog(true)}
                            variant="outline"
                            className="mt-4 border-border"
                            size="sm"
                        >
                            Conectar primeira integração
                        </Button>
                    </div>
                )}
            </motion.div>

            {/* Stats */}
            <motion.div variants={item} className={cn('grid gap-3', statsGridCols[4])}>
                <div className="rounded-xl p-4 bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-ch-orange/10 rounded-lg">
                            <Megaphone className="w-4 h-4 text-ch-orange" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-foreground">{stats?.totalCampaigns || 0}</p>
                            <p className="text-xs text-muted-foreground">Campanhas</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl p-4 bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Link2 className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-foreground">{stats?.activeIntegrations || 0}</p>
                            <p className="text-xs text-muted-foreground">Integrações</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl p-4 bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Users className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-foreground">{stats?.totalUsers || 0}</p>
                            <p className="text-xs text-muted-foreground">Usuários</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl p-4 bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <FileCheck className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-foreground">{stats?.totalAudits || 0}</p>
                            <p className="text-xs text-muted-foreground">Auditorias</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Integrations Dialog */}
            <Dialog open={showIntegrationsDialog} onOpenChange={setShowIntegrationsDialog}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Adicionar Integração</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Conecte sua conta para começar a gerenciar campanhas
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Facebook className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground text-sm">Facebook Business Manager</p>
                                        <p className="text-xs text-muted-foreground">
                                            Gerencie campanhas, criativos e métricas
                                        </p>
                                    </div>
                                </div>
                                {user && (
                                    <FacebookOAuthButton
                                        userId={user.id}
                                        companyId={user.company_id || ''}
                                        redirectUrl="/empresa"
                                        variant="outline"
                                        size="sm"
                                        onSuccess={() => setShowIntegrationsDialog(false)}
                                    >
                                        Conectar
                                    </FacebookOAuthButton>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
