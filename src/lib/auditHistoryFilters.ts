import type { Audit } from '@/hooks/useAudits';
import type { HistoryEntryKind } from '@/components/audits/AuditHistoryList';

export type HistoryStatusFilter = 'all' | 'approved' | 'rejected' | 'pending';

export interface HistoryFilterEntry {
    audit: Audit;
    kind: HistoryEntryKind;
}

export function normalizeAuditStatus(status: string | null | undefined): 'approved' | 'rejected' | 'pending' {
    if (status === 'approved' || status === 'rejected') return status;
    return 'pending';
}

export function matchesStatusFilter(
    audit: Audit,
    statusFilter: HistoryStatusFilter,
): boolean {
    if (statusFilter === 'all') return true;
    return normalizeAuditStatus(audit.status) === statusFilter;
}

export function matchesSearchFilter(entryName: string, searchQuery: string): boolean {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return entryName.toLowerCase().includes(q);
}

export function countByAuditStatus(entries: HistoryFilterEntry[]): {
    approved: number;
    rejected: number;
    pending: number;
    total: number;
} {
    let approved = 0;
    let rejected = 0;
    let pending = 0;

    for (const entry of entries) {
        const status = normalizeAuditStatus(entry.audit.status);
        if (status === 'approved') approved++;
        else if (status === 'rejected') rejected++;
        else pending++;
    }

    return { approved, rejected, pending, total: entries.length };
}

export function resolvePolicyIdForBatch(
    selectedPolicyId: string,
    defaultPolicyId: string | null,
): string | undefined {
    if (selectedPolicyId === 'default') {
        return defaultPolicyId ?? undefined;
    }
    if (selectedPolicyId === 'all') return undefined;
    return selectedPolicyId;
}
