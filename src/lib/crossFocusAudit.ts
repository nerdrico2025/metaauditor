import type { AuditFocus } from '@/lib/audit-focus';
import type { BrandingCheckDisplayStatus } from '@/lib/brandingRuleCheckStatus';

export type CrossFocusDisplayStatus = 'approved' | 'rejected' | 'warning' | 'none';

export function oppositeAuditFocus(focus: AuditFocus): AuditFocus {
    return focus === 'branding' ? 'performance' : 'branding';
}

function mapAuditStatus(status: string | null | undefined): CrossFocusDisplayStatus {
    const normalized = status?.toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'warning') return 'warning';
    return 'none';
}

function mapBrandingCheckStatus(status: BrandingCheckDisplayStatus | undefined): CrossFocusDisplayStatus {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    if (status === 'warning') return 'warning';
    return 'none';
}

function mapPerfCompliance(status: 'approved' | 'rejected' | null | undefined): CrossFocusDisplayStatus {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'none';
}

export interface ResolveCrossFocusStatusInput {
    auditStatus?: string | null;
    ruleCheckStatus?: BrandingCheckDisplayStatus;
    perfCompliance?: 'approved' | 'rejected' | null;
}

/** Audit IA takes priority over rule checks / compliance maps. */
export function resolveCrossFocusStatus(input: ResolveCrossFocusStatusInput): CrossFocusDisplayStatus {
    const fromAudit = mapAuditStatus(input.auditStatus);
    if (fromAudit !== 'none') return fromAudit;

    const fromBranding = mapBrandingCheckStatus(input.ruleCheckStatus);
    if (fromBranding !== 'none') return fromBranding;

    return mapPerfCompliance(input.perfCompliance);
}

const SECTOR_LABEL: Record<AuditFocus, string> = {
    branding: 'Branding',
    performance: 'Performance',
};

export function crossFocusStatusLabel(
    oppositeFocus: AuditFocus,
    status: CrossFocusDisplayStatus,
): string | null {
    if (status === 'none') return null;
    const sector = SECTOR_LABEL[oppositeFocus];
    if (status === 'approved') return `Aprovado em ${sector}`;
    if (status === 'rejected') return `Reprovado em ${sector}`;
    if (status === 'warning') return `Com ressalvas em ${sector}`;
    return null;
}

export function crossFocusCardMessage(
    oppositeFocus: AuditFocus,
    status: CrossFocusDisplayStatus,
): string | null {
    if (status === 'none') return null;
    const sector = SECTOR_LABEL[oppositeFocus];
    if (status === 'approved') {
        return `Este anúncio foi aprovado no setor de ${sector}.`;
    }
    if (status === 'rejected') {
        return `Este anúncio foi reprovado no setor de ${sector}.`;
    }
    if (status === 'warning') {
        return `Este anúncio tem ressalvas no setor de ${sector}.`;
    }
    return null;
}
