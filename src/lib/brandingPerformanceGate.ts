import type { CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { crossFocusStatusLabel } from '@/lib/crossFocusAudit';

export interface BrandingGateCreativeItem {
    id: string;
    name?: string;
    status: CrossFocusDisplayStatus;
    label: string;
}

export interface BrandingGatePartition {
    approvedIds: string[];
    approved: BrandingGateCreativeItem[];
    blocked: BrandingGateCreativeItem[];
}

export function isBrandingApprovedForPerformance(status: CrossFocusDisplayStatus): boolean {
    return status === 'approved';
}

export function brandingGateStatusLabel(status: CrossFocusDisplayStatus): string {
    if (status === 'approved') return 'Aprovado';
    if (status === 'rejected') return 'Reprovado';
    if (status === 'warning') return 'Com ressalvas';
    return 'Não analisado';
}

export function partitionCreativesForPerformanceGate(
    creativeIds: string[],
    statusMap: Map<string, CrossFocusDisplayStatus>,
    nameById?: Map<string, string>,
): BrandingGatePartition {
    const approvedIds: string[] = [];
    const approved: BrandingGateCreativeItem[] = [];
    const blocked: BrandingGateCreativeItem[] = [];

    for (const id of creativeIds) {
        const status = statusMap.get(id) ?? 'none';
        const item: BrandingGateCreativeItem = {
            id,
            name: nameById?.get(id),
            status,
            label: crossFocusStatusLabel('branding', status) ?? brandingGateStatusLabel(status),
        };

        if (isBrandingApprovedForPerformance(status)) {
            approvedIds.push(id);
            approved.push(item);
        } else {
            blocked.push(item);
        }
    }

    return { approvedIds, approved, blocked };
}

export const BRANDING_GATE_BLOCK_MSG =
    'Este anúncio precisa estar aprovado em Branding antes de analisar Performance.';

export const BRANDING_GATE_BATCH_NONE_MSG =
    'Nenhum criativo elegível: todos estão reprovados, com ressalvas ou sem análise de Branding.';

export interface BrandingGateBannerCopy {
    title: string;
    description: string;
    ctaLabel: string;
}

export function isPerformanceBlockedByBranding(status: CrossFocusDisplayStatus): boolean {
    return !isBrandingApprovedForPerformance(status);
}

/** Copy for visible banner when Performance is blocked by Branding gate. */
export function brandingGateBannerCopy(status: CrossFocusDisplayStatus): BrandingGateBannerCopy | null {
    if (status === 'approved') return null;

    if (status === 'none') {
        return {
            title: 'Análise de Performance indisponível',
            description:
                'Este anúncio precisa ser aprovado em Branding antes da análise de Performance.',
            ctaLabel: 'Analisar em Branding',
        };
    }

    if (status === 'rejected') {
        return {
            title: 'Análise de Performance bloqueada',
            description:
                'Este anúncio foi reprovado em Branding. Revise e obtenha aprovação antes de analisar Performance.',
            ctaLabel: 'Revisar em Branding',
        };
    }

    if (status === 'warning') {
        return {
            title: 'Análise de Performance bloqueada',
            description:
                'Este anúncio tem ressalvas em Branding. Resolva as pendências antes de analisar Performance.',
            ctaLabel: 'Revisar em Branding',
        };
    }

    return null;
}

export function brandingGatePendingBadgeLabel(): string {
    return 'Branding pendente';
}

export type BrandingGateDecision =
    | { action: 'proceed'; approvedIds: string[] }
    | { action: 'dialog'; partition: BrandingGatePartition }
    | { action: 'block' };

export function decideBrandingGate(partition: BrandingGatePartition): BrandingGateDecision {
    if (partition.blocked.length === 0) {
        return { action: 'proceed', approvedIds: partition.approvedIds };
    }
    if (partition.approvedIds.length === 0) {
        return { action: 'block' };
    }
    return { action: 'dialog', partition };
}
