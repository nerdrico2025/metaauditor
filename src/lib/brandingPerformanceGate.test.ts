import { describe, expect, it } from 'vitest';
import {
    BRANDING_GATE_BATCH_NONE_MSG,
    BRANDING_GATE_BLOCK_MSG,
    brandingGateBannerCopy,
    brandingGatePendingBadgeLabel,
    decideBrandingGate,
    isBrandingApprovedForPerformance,
    isPerformanceBlockedByBranding,
    partitionCreativesForPerformanceGate,
} from './brandingPerformanceGate';
import type { CrossFocusDisplayStatus } from './crossFocusAudit';

describe('isBrandingApprovedForPerformance', () => {
    it('allows only approved status', () => {
        expect(isBrandingApprovedForPerformance('approved')).toBe(true);
        expect(isBrandingApprovedForPerformance('rejected')).toBe(false);
        expect(isBrandingApprovedForPerformance('warning')).toBe(false);
        expect(isBrandingApprovedForPerformance('none')).toBe(false);
    });
});

describe('partitionCreativesForPerformanceGate', () => {
    const statusMap = new Map<string, CrossFocusDisplayStatus>([
        ['a', 'approved'],
        ['b', 'rejected'],
        ['c', 'warning'],
        ['d', 'none'],
    ]);

    it('partitions approved vs blocked', () => {
        const result = partitionCreativesForPerformanceGate(['a', 'b', 'c', 'd'], statusMap);
        expect(result.approvedIds).toEqual(['a']);
        expect(result.approved).toHaveLength(1);
        expect(result.blocked).toHaveLength(3);
        expect(result.blocked.map((x) => x.id)).toEqual(['b', 'c', 'd']);
    });

    it('returns all approved when every creative is approved', () => {
        const allApproved = new Map<string, CrossFocusDisplayStatus>([
            ['x', 'approved'],
            ['y', 'approved'],
        ]);
        const result = partitionCreativesForPerformanceGate(['x', 'y'], allApproved);
        expect(result.approvedIds).toEqual(['x', 'y']);
        expect(result.blocked).toHaveLength(0);
    });

    it('returns all blocked when none approved', () => {
        const result = partitionCreativesForPerformanceGate(['b', 'c'], statusMap);
        expect(result.approvedIds).toEqual([]);
        expect(result.blocked).toHaveLength(2);
    });

    it('handles empty list', () => {
        const result = partitionCreativesForPerformanceGate([], statusMap);
        expect(result.approvedIds).toEqual([]);
        expect(result.blocked).toEqual([]);
    });

    it('includes names when provided', () => {
        const names = new Map([['a', 'Ad A']]);
        const result = partitionCreativesForPerformanceGate(['a'], statusMap, names);
        expect(result.approved[0]?.name).toBe('Ad A');
    });
});

describe('decideBrandingGate', () => {
    it('auto-proceeds when all approved', () => {
        const partition = partitionCreativesForPerformanceGate(
            ['a'],
            new Map([['a', 'approved']]),
        );
        expect(decideBrandingGate(partition)).toEqual({
            action: 'proceed',
            approvedIds: ['a'],
        });
    });

    it('blocks when none approved', () => {
        const partition = partitionCreativesForPerformanceGate(
            ['b'],
            new Map([['b', 'rejected']]),
        );
        expect(decideBrandingGate(partition)).toEqual({ action: 'block' });
    });

    it('opens dialog on mixed set', () => {
        const partition = partitionCreativesForPerformanceGate(
            ['a', 'b'],
            new Map([
                ['a', 'approved'],
                ['b', 'rejected'],
            ]),
        );
        const decision = decideBrandingGate(partition);
        expect(decision.action).toBe('dialog');
        if (decision.action === 'dialog') {
            expect(decision.partition.approvedIds).toEqual(['a']);
            expect(decision.partition.blocked).toHaveLength(1);
        }
    });
});

describe('gate messages', () => {
    it('exports user-facing block messages', () => {
        expect(BRANDING_GATE_BLOCK_MSG).toContain('Branding');
        expect(BRANDING_GATE_BATCH_NONE_MSG).toContain('Nenhum criativo elegível');
    });
});

describe('brandingGateBannerCopy', () => {
    it('returns null for approved status', () => {
        expect(brandingGateBannerCopy('approved')).toBeNull();
    });

    it('returns banner copy for none, rejected, and warning', () => {
        expect(brandingGateBannerCopy('none')?.title).toContain('indisponível');
        expect(brandingGateBannerCopy('rejected')?.ctaLabel).toContain('Revisar');
        expect(brandingGateBannerCopy('warning')?.description).toContain('ressalvas');
    });
});

describe('isPerformanceBlockedByBranding', () => {
    it('blocks all non-approved statuses', () => {
        expect(isPerformanceBlockedByBranding('approved')).toBe(false);
        expect(isPerformanceBlockedByBranding('none')).toBe(true);
        expect(isPerformanceBlockedByBranding('rejected')).toBe(true);
        expect(isPerformanceBlockedByBranding('warning')).toBe(true);
    });
});

describe('brandingGatePendingBadgeLabel', () => {
    it('returns pending label', () => {
        expect(brandingGatePendingBadgeLabel()).toBe('Branding pendente');
    });
});
