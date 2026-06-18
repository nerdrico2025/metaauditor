export type BrandingComplianceStatus = 'approved' | 'rejected' | null;

export type BrandingComplianceFilterStatus = 'approved' | 'rejected' | 'pending';

/** IDs whose latest branding status matches the filter pill. */
export function creativeIdsForComplianceStatus(
    byCreative: Map<string, BrandingComplianceStatus>,
    status: BrandingComplianceFilterStatus,
): string[] {
    const ids: string[] = [];
    for (const [id, s] of byCreative) {
        if (status === 'approved' && s === 'approved') ids.push(id);
        else if (status === 'rejected' && s === 'rejected') ids.push(id);
        else if (status === 'pending' && s === null) ids.push(id);
    }
    return ids;
}

export function countByComplianceStatus(
    byCreative: Map<string, BrandingComplianceStatus>,
): { approved: number; rejected: number; pending: number; total: number } {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    for (const s of byCreative.values()) {
        if (s === 'approved') approved++;
        else if (s === 'rejected') rejected++;
        else pending++;
    }
    return { approved, rejected, pending, total: byCreative.size };
}
