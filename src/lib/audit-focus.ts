import type { AppModule } from '@/contexts/ModuleContext';

export type AuditFocus = 'performance' | 'branding';

export function moduleToAuditFocus(module: AppModule): AuditFocus {
    return module === 'branding' ? 'branding' : 'performance';
}

export function resolveAuditFocus(
    audit?: {
        audit_focus?: string | null;
        ai_analysis?: { audit_focus?: string } | null;
    } | null,
): AuditFocus {
    const raw = audit?.audit_focus ?? audit?.ai_analysis?.audit_focus;
    return raw === 'branding' ? 'branding' : 'performance';
}

export function auditFocusLabel(focus: AuditFocus): string {
    return focus === 'branding' ? 'Auditoria de Branding' : 'Auditoria de Performance';
}

export function primaryAuditScore(
    audit: {
        compliance_score?: number | null;
        performance_score?: number | null;
        score?: number | null;
    },
    focus: AuditFocus,
): number {
    if (focus === 'branding') {
        return audit.compliance_score ?? audit.score ?? 0;
    }
    return audit.performance_score ?? audit.compliance_score ?? audit.score ?? 0;
}

type AuditWithFocus = {
    creative_id: string | null;
    created_at: string;
    audit_focus?: string | null;
    audit_level?: string | null;
    campaign_id?: string | null;
    ad_set_id?: string | null;
    ai_analysis?: { audit_focus?: string } | null;
};

export function filterAuditsByFocus<T extends AuditWithFocus>(
    audits: T[],
    focus: AuditFocus,
): T[] {
    return audits.filter((a) => resolveAuditFocus(a) === focus);
}

/** Latest audit per creative within a focus (or across all focuses when omitted). */
export function dedupeLatestAudits<T extends AuditWithFocus>(
    audits: T[],
    focus?: AuditFocus,
): T[] {
    const pool = focus ? filterAuditsByFocus(audits, focus) : audits;
    const latestByKey = new Map<string, T>();

    for (const audit of pool) {
        const key = focus
            ? (audit.creative_id ?? '')
            : `${audit.creative_id}:${resolveAuditFocus(audit)}`;
        if (!key) continue;
        const existing = latestByKey.get(key);
        if (!existing || new Date(audit.created_at) > new Date(existing.created_at)) {
            latestByKey.set(key, audit);
        }
    }

    return Array.from(latestByKey.values());
}

function entityAuditKey(audit: AuditWithFocus): string | null {
    const level = audit.audit_level ?? 'creative';
    if (level === 'campaign' && audit.campaign_id) return `campaign:${audit.campaign_id}`;
    if (level === 'ad_set' && audit.ad_set_id) return `ad_set:${audit.ad_set_id}`;
    return null;
}

/** Latest audit per campaign or ad set (performance entity audits). */
export function dedupeLatestEntityAudits<T extends AuditWithFocus>(audits: T[]): T[] {
    const latestByKey = new Map<string, T>();

    for (const audit of audits) {
        const key = entityAuditKey(audit);
        if (!key) continue;
        const existing = latestByKey.get(key);
        if (!existing || new Date(audit.created_at) > new Date(existing.created_at)) {
            latestByKey.set(key, audit);
        }
    }

    return Array.from(latestByKey.values());
}
