import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppModule } from '@/contexts/ModuleContext';
import { moduleToAuditFocus } from '@/lib/audit-focus';
import {
    oppositeAuditFocus,
    resolveCrossFocusStatus,
    crossFocusStatusLabel,
    crossFocusCardMessage,
    type CrossFocusDisplayStatus,
} from '@/lib/crossFocusAudit';
import { resolveBrandingCheckStatus } from '@/lib/brandingRuleCheckStatus';
import type { BrandingCheckDisplayStatus } from '@/lib/brandingRuleCheckStatus';

export interface UseCrossFocusStatusInput {
    creativeId: string | null | undefined;
    currentModule: AppModule;
    brandingRuleCheckStatus?: BrandingCheckDisplayStatus;
    perfCompliance?: 'approved' | 'rejected' | null;
}

export function useCrossFocusStatus({
    creativeId,
    currentModule,
    brandingRuleCheckStatus,
    perfCompliance,
}: UseCrossFocusStatusInput) {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;
    const currentFocus = moduleToAuditFocus(currentModule);
    const oppositeFocus = oppositeAuditFocus(currentFocus);

    const { data: oppositeAudit } = useQuery({
        queryKey: ['cross-focus-audit', companyId, oppositeFocus, creativeId],
        queryFn: async () => {
            if (!creativeId || !companyId) return null;

            const { data, error } = await supabase
                .from('audits')
                .select('status, created_at')
                .eq('company_id', companyId)
                .eq('creative_id', creativeId)
                .eq('audit_focus', oppositeFocus)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!creativeId && !!companyId,
        staleTime: 2 * 60 * 1000,
    });

    const status: CrossFocusDisplayStatus = useMemo(() => {
        return resolveCrossFocusStatus({
            auditStatus: oppositeAudit?.status,
            ruleCheckStatus: oppositeFocus === 'branding' ? brandingRuleCheckStatus : undefined,
            perfCompliance: oppositeFocus === 'performance' ? perfCompliance : undefined,
        });
    }, [
        oppositeAudit?.status,
        oppositeFocus,
        brandingRuleCheckStatus,
        perfCompliance,
    ]);

    return {
        oppositeFocus,
        status,
        label: crossFocusStatusLabel(oppositeFocus, status),
        cardMessage: crossFocusCardMessage(oppositeFocus, status),
        analyzedAt: oppositeAudit?.created_at ?? null,
        hasSignal: status !== 'none',
    };
}
