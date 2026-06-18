import { describe, expect, it } from 'vitest';
import {
    crossFocusCardMessage,
    crossFocusStatusLabel,
    oppositeAuditFocus,
    resolveCrossFocusStatus,
} from './crossFocusAudit';

describe('oppositeAuditFocus', () => {
    it('inverts performance and branding', () => {
        expect(oppositeAuditFocus('performance')).toBe('branding');
        expect(oppositeAuditFocus('branding')).toBe('performance');
    });
});

describe('resolveCrossFocusStatus', () => {
    it('prioritizes audit over rule check', () => {
        expect(
            resolveCrossFocusStatus({
                auditStatus: 'approved',
                ruleCheckStatus: 'rejected',
            }),
        ).toBe('approved');
    });

    it('falls back to branding rule check when no audit', () => {
        expect(
            resolveCrossFocusStatus({
                ruleCheckStatus: 'warning',
            }),
        ).toBe('warning');
    });

    it('falls back to performance compliance when no audit or branding check', () => {
        expect(
            resolveCrossFocusStatus({
                perfCompliance: 'rejected',
            }),
        ).toBe('rejected');
    });

    it('returns none when no signals', () => {
        expect(resolveCrossFocusStatus({})).toBe('none');
        expect(resolveCrossFocusStatus({ perfCompliance: null })).toBe('none');
        expect(resolveCrossFocusStatus({ ruleCheckStatus: 'pending' })).toBe('none');
    });
});

describe('crossFocusStatusLabel', () => {
    it('maps approved/rejected/warning labels', () => {
        expect(crossFocusStatusLabel('branding', 'approved')).toBe('Aprovado em Branding');
        expect(crossFocusStatusLabel('performance', 'rejected')).toBe('Reprovado em Performance');
        expect(crossFocusStatusLabel('branding', 'warning')).toBe('Com ressalvas em Branding');
        expect(crossFocusStatusLabel('branding', 'none')).toBeNull();
    });
});

describe('crossFocusCardMessage', () => {
    it('returns descriptive card copy', () => {
        expect(crossFocusCardMessage('branding', 'approved')).toContain('aprovado');
        expect(crossFocusCardMessage('performance', 'rejected')).toContain('reprovado');
    });
});
