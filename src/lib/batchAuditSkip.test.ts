import { describe, expect, it } from 'vitest';
import { partitionCreativesForBatchAudit } from './batchAuditSkip';

describe('partitionCreativesForBatchAudit', () => {
    it('returns all ids when none were recently audited', () => {
        const result = partitionCreativesForBatchAudit(['a', 'b', 'c'], new Set());
        expect(result.toAudit).toEqual(['a', 'b', 'c']);
        expect(result.skippedRecent).toBe(0);
        expect(result.skippedInactiveCampaign).toBe(0);
    });

    it('skips ids with audit in the recent window', () => {
        const result = partitionCreativesForBatchAudit(
            ['a', 'b', 'c', 'b'],
            new Set(['b']),
        );
        expect(result.toAudit).toEqual(['a', 'c']);
        expect(result.skippedRecent).toBe(2);
    });

    it('skips all when every id was recently audited', () => {
        const result = partitionCreativesForBatchAudit(
            ['x', 'y'],
            new Set(['x', 'y']),
        );
        expect(result.toAudit).toEqual([]);
        expect(result.skippedRecent).toBe(2);
    });
});
