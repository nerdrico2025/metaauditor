export interface BrandingRuleRowLike {
    rule_id?: string;
    rule_name: string;
    passed: boolean;
    reason: string;
    severity?: string;
}

export interface AuditProblemLike {
    id: string;
    title: string;
    detail?: string;
    severity: 'error' | 'warning' | 'info';
}

export type LogoVerdictStatus = 'ok' | 'absent' | 'unknown';

export interface LogoVerdict {
    status: LogoVerdictStatus;
    label: string;
    detail?: string;
    ruleName?: string;
}

function ruleText(row: BrandingRuleRowLike): string {
    return `${row.rule_name} ${row.reason}`.toLowerCase();
}

export function isLogoRuleRow(row: BrandingRuleRowLike): boolean {
    const text = ruleText(row);
    return text.includes('logo') || text.includes('marca');
}

export function classifyLogoVerdict(rows: BrandingRuleRowLike[]): LogoVerdict | null {
    const logoRows = rows.filter(isLogoRuleRow);
    if (logoRows.length === 0) return null;

    const failed = logoRows.filter(r => !r.passed);
    if (failed.length === 0) {
        return { status: 'ok', label: 'Logo presente' };
    }

    const primary = failed[0];
    return {
        status: 'absent',
        label: 'Logo ausente',
        detail: primary.reason,
        ruleName: primary.rule_name,
    };
}

export function strengthClaimsLogoPositive(strength: string): boolean {
    const lower = strength.toLowerCase();
    if (!lower.includes('logo') && !lower.includes('marca')) return false;

    const negativeSignals = [
        'ausente', 'não presente', 'nao presente', 'sem logo', 'faltando',
        'não visível', 'nao visivel', 'ilegível', 'ilegivel', 'pequeno',
        'incorreto', 'incorreta', 'fora do', 'problema', 'viola',
    ];
    if (negativeSignals.some(s => lower.includes(s))) return false;

    const positiveSignals = [
        'presente', 'visível', 'visivel', 'identificável', 'identificavel',
        'detectado', 'encontrado', 'corretamente', 'posicionado', 'legível', 'legivel',
        'conforme', 'adequado', 'ajuda na identificação', 'ajuda na identificacao',
    ];
    return positiveSignals.some(s => lower.includes(s));
}

export function strengthContradictsLogoRules(
    strength: string,
    failedLogoRows: BrandingRuleRowLike[],
): boolean {
    if (failedLogoRows.length === 0) return false;
    return strengthClaimsLogoPositive(strength);
}

export function filterContradictoryStrengths(
    strengths: string[],
    brandingResults: BrandingRuleRowLike[],
): string[] {
    const failedLogoRows = brandingResults.filter(r => !r.passed && isLogoRuleRow(r));
    if (failedLogoRows.length === 0) return strengths;

    return strengths.filter(s => !strengthContradictsLogoRules(s, failedLogoRows));
}

export function dedupeRuleProblems(
    problems: AuditProblemLike[],
    brandingResults: BrandingRuleRowLike[],
): AuditProblemLike[] {
    const violatedRuleNames = new Set(
        brandingResults.filter(r => !r.passed).map(r => r.rule_name.toLowerCase()),
    );

    if (violatedRuleNames.size === 0) return problems;

    return problems.filter(p => !violatedRuleNames.has(p.title.toLowerCase()));
}

export function excludeLogoRulesFromSummary<T extends BrandingRuleRowLike>(rows: T[]): T[] {
    return rows.filter(r => !isLogoRuleRow(r));
}
