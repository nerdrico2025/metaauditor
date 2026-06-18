import { describe, it, expect } from 'vitest';
import {
    classifyLogoVerdict,
    dedupeRuleProblems,
    excludeLogoRulesFromSummary,
    filterContradictoryStrengths,
    strengthContradictsLogoRules,
} from './auditCoherence';

describe('auditCoherence', () => {
    const absentFailure = {
        rule_id: '2',
        rule_name: 'Logo NIO',
        passed: false,
        reason: 'Logo ausente no criativo',
        severity: 'error',
    };

    const okLogoRule = {
        rule_id: '3',
        rule_name: 'Logo NIO',
        passed: true,
        reason: 'Logo presente',
        severity: 'info',
    };

    it('remove strengths positivos sobre logo quando regra indica ausência', () => {
        const strengths = [
            'Logo presente e identificável',
            'Copy alinhada ao tom de marca',
        ];
        const filtered = filterContradictoryStrengths(strengths, [absentFailure]);
        expect(filtered).toEqual(['Copy alinhada ao tom de marca']);
    });

    it('mantém strengths sobre logo quando regra de logo passou', () => {
        const strengths = [
            'Logo visível no criativo',
            'Hierarquia visual clara',
        ];
        const filtered = filterContradictoryStrengths(strengths, [okLogoRule]);
        expect(filtered).toEqual(strengths);
    });

    it('classifica verdict absent quando regra de logo falhou', () => {
        const verdict = classifyLogoVerdict([absentFailure]);
        expect(verdict).toMatchObject({
            status: 'absent',
            label: 'Logo ausente',
            detail: 'Logo ausente no criativo',
        });
    });

    it('classifica verdict ok quando regra de logo passou', () => {
        const verdict = classifyLogoVerdict([okLogoRule]);
        expect(verdict).toMatchObject({ status: 'ok', label: 'Logo presente' });
    });

    it('dedupeRuleProblems remove duplicata Logo NIO entre seções', () => {
        const problems = [
            { id: 'issue-0', title: 'Headline genérica', severity: 'warning' as const },
            { id: 'brand-0', title: 'Logo NIO', detail: 'Logo ausente no criativo', severity: 'error' as const },
        ];
        const deduped = dedupeRuleProblems(problems, [absentFailure]);
        expect(deduped).toEqual([
            { id: 'issue-0', title: 'Headline genérica', severity: 'warning' },
        ]);
    });

    it('strengthContradictsLogoRules detecta elogio conflitante', () => {
        expect(
            strengthContradictsLogoRules(
                'Logo visível e presente no criativo',
                [absentFailure],
            ),
        ).toBe(true);
    });

    it('excludeLogoRulesFromSummary remove regras de logo', () => {
        const rows = [
            okLogoRule,
            { rule_id: '4', rule_name: 'Texto máximo', passed: false, reason: 'Excesso de texto', severity: 'warning' },
        ];
        expect(excludeLogoRulesFromSummary(rows)).toEqual([
            { rule_id: '4', rule_name: 'Texto máximo', passed: false, reason: 'Excesso de texto', severity: 'warning' },
        ]);
    });
});
