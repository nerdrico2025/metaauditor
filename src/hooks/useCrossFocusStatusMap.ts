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
    type CrossFocusDisplayStatus,
} from '@/lib/crossFocusAudit';
import { resolveBrandingCheckStatus } from '@/lib/brandingRuleCheckStatus';
import { useCreativeRuleChecksBatch, type RuleCheckBatchItem } from '@/hooks/useCreativeRules';
import { usePerformanceCompliance } from '@/hooks/usePerformanceCompliance';

function buildStatusMap(
    creativeIds: string[],
    oppositeFocus: ReturnType<typeof oppositeAuditFocus>,
    auditByCreative: Map<string, string | null>,
    ruleChecksMap: Record<string, RuleCheckBatchItem> | undefined,
    perfByCreative: Map<string, 'approved' | 'rejected' | null> | undefined,
): Map<string, CrossFocusDisplayStatus> {
    const map = new Map<string, CrossFocusDisplayStatus>();

    for (const id of creativeIds) {
        const auditStatus = auditByCreative.get(id) ?? null;
        const ruleCheck = ruleChecksMap?.[id];
        const ruleCheckStatus = ruleCheck
            ? resolveBrandingCheckStatus(ruleCheck.overall_status, ruleCheck.failed_rules)
            : undefined;
        const perfCompliance = oppositeFocus === 'performance' ? perfByCreative?.get(id) : undefined;

        const status = resolveCrossFocusStatus({
            auditStatus,
            ruleCheckStatus: oppositeFocus === 'branding' ? ruleCheckStatus : undefined,
            perfCompliance,
        });

        if (status !== 'none') {
            map.set(id, status);
        }
    }

    return map;
}

export function useCrossFocusStatusMap(creativeIds: string[], currentModule: AppModule) {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;
    const currentFocus = moduleToAuditFocus(currentModule);
    const oppositeFocus = oppositeAuditFocus(currentFocus);
    const uniqueIds = useMemo(
        () => [...new Set(creativeIds.filter(Boolean))],
        [creativeIds],
    );

    const { data: ruleChecksMap } = useCreativeRuleChecksBatch(
        oppositeFocus === 'branding' ? uniqueIds : [],
    );
    const { data: performanceCompliance } = usePerformanceCompliance();

    const { data: oppositeAudits } = useQuery({
        queryKey: ['cross-focus-audits', companyId, oppositeFocus, uniqueIds],
        queryFn: async () => {
            if (!uniqueIds.length || !companyId) return new Map<string, string | null>();

            const { data, error } = await supabase
                .from('audits')
                .select('creative_id, status, created_at')
                .eq('company_id', companyId)
                .eq('audit_focus', oppositeFocus)
                .in('creative_id', uniqueIds)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const auditByCreative = new Map<string, string | null>();
            for (const row of data ?? []) {
                if (!row.creative_id || auditByCreative.has(row.creative_id)) continue;
                auditByCreative.set(row.creative_id, row.status);
            }
            return auditByCreative;
        },
        enabled: uniqueIds.length > 0 && !!companyId,
        staleTime: 2 * 60 * 1000,
    });

    const statusMap = useMemo(
        () =>
            buildStatusMap(
                uniqueIds,
                oppositeFocus,
                oppositeAudits ?? new Map(),
                ruleChecksMap,
                oppositeFocus === 'performance' ? performanceCompliance?.byCreative : undefined,
            ),
        [uniqueIds, oppositeFocus, oppositeAudits, ruleChecksMap, performanceCompliance?.byCreative],
    );

    const getLabel = (creativeId: string): string | null => {
        const status = statusMap.get(creativeId);
        if (!status) return null;
        return crossFocusStatusLabel(oppositeFocus, status);
    };

    return {
        oppositeFocus,
        statusMap,
        getLabel,
        getStatus: (creativeId: string) => statusMap.get(creativeId) ?? ('none' as const),
    };
}
