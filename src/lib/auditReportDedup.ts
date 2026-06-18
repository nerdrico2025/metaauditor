import { isLogoRuleRow, type BrandingRuleRowLike } from './auditCoherence';

interface PerfRowLike {
    rule_name: string;
    passed: boolean;
    reason: string;
}

export interface NarrativeDedupInput {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    toneAnalysis?: string;
    brandingResults: BrandingRuleRowLike[];
    perfResults: PerfRowLike[];
}

export interface NarrativeDedupOutput {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    toneAnalysis?: string;
}

function normalizeText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function textsOverlap(a: string, b: string): boolean {
    const na = normalizeText(a);
    const nb = normalizeText(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const minLen = Math.min(na.length, nb.length);
    if (minLen >= 15) {
        const slice = na.slice(0, Math.min(40, na.length));
        if (nb.includes(slice)) return true;
    }
    return false;
}

function hasLogoRuleRow(rows: BrandingRuleRowLike[]): boolean {
    return rows.some(isLogoRuleRow);
}

function mentionsLogo(text: string): boolean {
    const lower = normalizeText(text);
    return lower.includes('logo') || lower.includes('marca');
}

function buildRuleReferenceTexts(
    brandingResults: BrandingRuleRowLike[],
    perfResults: PerfRowLike[],
): string[] {
    const refs: string[] = [];
    for (const r of brandingResults) {
        refs.push(r.rule_name, r.reason, `${r.rule_name}: ${r.reason}`);
        if (!r.passed) refs.push(r.rule_name);
    }
    for (const r of perfResults.filter(p => !p.passed)) {
        refs.push(r.rule_name, r.reason, `${r.rule_name}: ${r.reason}`);
    }
    return refs.filter(Boolean);
}

function isDuplicateOfRules(item: string, ruleRefs: string[]): boolean {
    return ruleRefs.some(ref => textsOverlap(item, ref));
}

function filterStringList(
    items: string[],
    ruleRefs: string[],
    skipLogoMentions: boolean,
): string[] {
    return items.filter(item => {
        if (skipLogoMentions && mentionsLogo(item)) return false;
        return !isDuplicateOfRules(item, ruleRefs);
    });
}

function filterToneAnalysis(
    toneAnalysis: string | undefined,
    ruleRefs: string[],
    skipLogoMentions: boolean,
): string | undefined {
    if (!toneAnalysis?.trim()) return toneAnalysis;
    if (skipLogoMentions && mentionsLogo(toneAnalysis)) {
        return undefined;
    }
    const duplicatesRule = ruleRefs.some(ref => textsOverlap(toneAnalysis, ref));
    return duplicatesRule ? undefined : toneAnalysis;
}

export function filterNarrativeAgainstRules(input: NarrativeDedupInput): NarrativeDedupOutput {
    const ruleRefs = buildRuleReferenceTexts(input.brandingResults, input.perfResults);
    const skipLogoMentions = hasLogoRuleRow(input.brandingResults);

    return {
        strengths: filterStringList(input.strengths, ruleRefs, skipLogoMentions),
        weaknesses: filterStringList(input.weaknesses, ruleRefs, skipLogoMentions),
        suggestions: filterStringList(input.suggestions, ruleRefs, skipLogoMentions),
        toneAnalysis: filterToneAnalysis(input.toneAnalysis, ruleRefs, skipLogoMentions),
    };
}
