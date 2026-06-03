import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyIntegrations, calculateDaysUntilExpiry } from '@/hooks/useCompanyIntegrations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FacebookOAuthButton } from '@/components/integrations/FacebookOAuthButton';
import {
    Facebook,
    Plus,
    Loader2,
    Link2,
    AlertTriangle,
    Check,
    XCircle,
} from 'lucide-react';

export function IntegrationsTab() {
    const { user } = useAuth();
    const { data: integrations, isLoading, refetch } = useCompanyIntegrations(user?.company_id);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const { t } = useTranslation(['integrations', 'common']);

    const metaIntegrations = integrations?.filter(i => i.platform === 'meta' && i.status !== 'disconnected') || [];

    const getStatusBadge = (integration: any) => {
        const daysUntilExpiry = calculateDaysUntilExpiry(integration.token_expires_at);
        const isExpired = daysUntilExpiry < 0;
        const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry < 7;

        if (isExpired) {
            return (
                <Badge variant="destructive" className="gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    {t('integrations:tokenExpired')}
                </Badge>
            );
        }

        if (isExpiringSoon) {
            return (
                <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    {t('integrations:expiresIn', { days: daysUntilExpiry })}
                </Badge>
            );
        }

        if (integration.status === 'active') {
            return (
                <Badge variant="default" className="gap-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <Check className="w-3 h-3" />
                    {t('integrations:active')}
                </Badge>
            );
        }

        return (
            <Badge variant="destructive" className="gap-1.5">
                <XCircle className="w-3 h-3" />
                {t('integrations:inactive')}
            </Badge>
        );
    };

    return (
        <div className="glass rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">{t('integrations:title')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('integrations:subtitle')}
                    </p>
                </div>
                <Button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-ch-orange hover:bg-ch-orange/90 text-black font-semibold"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('integrations:addIntegration')}
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                </div>
            ) : metaIntegrations.length > 0 ? (
                <div className="space-y-3">
                    {metaIntegrations.map((integration) => {
                        const permissions = integration.permissions as any;
                        console.log('🔍 Integration Permissions:', integration.account_name, permissions);
                        const bmName = permissions?.business_manager_name;
                        const bmId = permissions?.business_manager_id;
                        const currency = permissions?.currency || 'BRL';
                        const timezone = permissions?.timezone || 'America/Sao_Paulo';
                        const grantedPermissions = permissions?.granted_permissions || [];
                        const daysUntilExpiry = calculateDaysUntilExpiry(integration.token_expires_at);
                        const needsRenewal = daysUntilExpiry >= 0 && daysUntilExpiry < 7;

                        return (
                            <div
                                key={integration.id}
                                className="p-5 bg-muted rounded-lg border border-border hover:border-blue-500/30 transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                            <Facebook className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground">
                                                {integration.account_name || 'Meta Ads Account'}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                ID: act_{integration.account_id}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(integration)}
                                </div>

                                {/* DEBUG: Show raw permissions */}
                                <details className="mb-3 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                                    <summary className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider cursor-pointer">
                                        🐛 DEBUG: Raw Permissions Data
                                    </summary>
                                    <pre className="text-[9px] text-foreground mt-2 overflow-auto max-h-40 bg-muted/40 p-2 rounded">
                                        {JSON.stringify(permissions, null, 2)}
                                    </pre>
                                </details>

                                {/* Business Manager Info or Missing Info Warning */}
                                {bmName ? (
                                    <div className="mb-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                        <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
                                            {t('integrations:businessManager')}
                                        </p>
                                        <p className="text-sm font-medium text-foreground">{bmName}</p>
                                        {bmId && (
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                ID: {bmId}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2">
                                            ⚠️ {t('integrations:limitedInfo')}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            {t('integrations:limitedInfoDesc')}
                                        </p>
                                        {user && (
                                            <FacebookOAuthButton
                                                userId={user.id}
                                                companyId={user.company_id || ''}
                                                redirectUrl="/settings"
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-amber-500/30 hover:bg-amber-500/10 text-amber-500 text-xs"
                                                onSuccess={() => refetch()}
                                            >
                                                {t('integrations:reconnectUpdate')}
                                            </FacebookOAuthButton>
                                        )}
                                    </div>
                                )}

                                {/* Details Grid */}
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="p-2.5 bg-muted/40 rounded-lg border border-border">
                                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                            {t('integrations:currency')}
                                        </p>
                                        <p className="text-xs font-semibold text-foreground">
                                            {currency}
                                        </p>
                                    </div>
                                    <div className="col-span-2 p-2.5 bg-muted/40 rounded-lg border border-border">
                                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                            {t('integrations:timezone')}
                                        </p>
                                        <p className="text-xs font-semibold text-foreground truncate">
                                            {timezone.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                </div>

                                {/* Permissions */}
                                {grantedPermissions.length > 0 && (
                                    <div className="mb-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                        <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                                            {t('integrations:permissions')} ({grantedPermissions.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {grantedPermissions.slice(0, 5).map((perm: string) => (
                                                <span
                                                    key={perm}
                                                    className="text-[9px] font-medium text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                                                >
                                                    {perm.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                            {grantedPermissions.length > 5 && (
                                                <span className="text-[9px] font-medium text-muted-foreground px-2 py-0.5">
                                                    +{grantedPermissions.length - 5}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Token Expiry Warning */}
                                {needsRenewal && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg mb-3">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-amber-500">
                                                {t('integrations:tokenExpirySoon', { days: daysUntilExpiry, plural: daysUntilExpiry !== 1 ? 's' : '' })}
                                            </p>
                                        </div>
                                        {user && (
                                            <FacebookOAuthButton
                                                userId={user.id}
                                                companyId={user.company_id || ''}
                                                redirectUrl="/integracoes"
                                                variant="outline"
                                                size="sm"
                                                className="border-amber-500/30 hover:bg-amber-500/10 text-amber-500 text-xs"
                                                onSuccess={() => refetch()}
                                            >
                                                {t('common:renew')}
                                            </FacebookOAuthButton>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Link2 className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t('integrations:noIntegrations.title')}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        {t('integrations:noIntegrations.subtitle')}
                    </p>
                    <Button
                        onClick={() => setShowAddDialog(true)}
                        variant="outline"
                        className="border-border"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('integrations:noIntegrations.connect')}
                    </Button>
                </div>
            )}

            {/* Add Integration Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-muted border-border sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{t('integrations:dialog.title')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {t('integrations:dialog.subtitle')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        {/* Facebook Business Manager */}
                        <div className="p-4 bg-muted rounded-lg border border-border hover:border-blue-500/50 transition-colors">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Facebook className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Facebook Business Manager</p>
                                        <p className="text-sm text-muted-foreground">
                                            {t('integrations:dialog.facebookDesc')}
                                        </p>
                                    </div>
                                </div>
                                {user && (
                                    <FacebookOAuthButton
                                        userId={user.id}
                                        companyId={user.company_id || ''}
                                        redirectUrl="/integracoes"
                                        variant="outline"
                                        size="sm"
                                        onSuccess={() => {
                                            setShowAddDialog(false);
                                            refetch();
                                        }}
                                    >
                                        {t('common:connect')}
                                    </FacebookOAuthButton>
                                )}
                            </div>
                        </div>

                        {/* Placeholder para futuras integrações */}
                        <div className="p-4 bg-muted/40 rounded-lg border border-border opacity-50">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-500/10 rounded-lg">
                                        <div className="w-6 h-6 rounded bg-gray-500/20" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">{t('integrations:dialog.otherPlatforms')}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {t('integrations:dialog.otherPlatformsDesc')}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" disabled>
                                    {t('common:comingSoon')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
