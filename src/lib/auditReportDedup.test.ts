import { describe, it, expect } from 'vitest';
import { filterNarrativeAgainstRules } from './auditReportDedup';

describe('auditReportDedup', () => {
    const logoRuleFailed = {
        rule_id: '1',
        rule_name: 'Logo NIO',
        passed: false,
        reason: 'Logo ausente no criativo',
        severity: 'error',
    };

    it('remove weakness que repete regra de logo falha', () => {
        const result = filterNarrativeAgainstRules({
            strengths: [],
            weaknesses: ['Logo não visível no criativo', 'Paleta desalinhada'],
            suggestions: [],
            brandingResults: [logoRuleFailed],
            perfResults: [],
        });
        expect(result.weaknesses).toEqual(['Paleta desalinhada']);
    });

    it('remove strength sobre logo quando regra de logo existe', () => {
        const result = filterNarrativeAgainstRules({
            strengths: ['Logo presente no canto superior', 'Copy alinhada'],
            weaknesses: [],
            suggestions: [],
            brandingResults: [{
                rule_id: '2',
                rule_name: 'Logo NIO',
                passed: true,
                reason: 'Logo presente',
                severity: 'info',
            }],
            perfResults: [],
        });
        expect(result.strengths).toEqual(['Copy alinhada']);
    });

    it('remove item que repete reason de regra violada', () => {
        const result = filterNarrativeAgainstRules({
            strengths: [],
            weaknesses: ['Excesso de texto na imagem viola a política'],
            suggestions: [],
            brandingResults: [{
                rule_id: '3',
                rule_name: 'Texto máximo',
                passed: false,
                reason: 'Excesso de texto na imagem',
                severity: 'warning',
            }],
            perfResults: [],
        });
        expect(result.weaknesses).toEqual([]);
    });
});
