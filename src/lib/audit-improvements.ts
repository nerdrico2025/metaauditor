import type { AiAnalysis } from '@/hooks/useAudits';
import type { AuditFocus } from '@/lib/audit-focus';

export type ImprovementPriority = 'alta' | 'media' | 'baixa';

export type CopyCheckStatus = 'ok' | 'warning' | 'error';

export interface CopyCheck {
    id: string;
    label: string;
    status: CopyCheckStatus;
    message: string;
}

export interface ImprovementAction {
    id: string;
    priority: ImprovementPriority;
    title: string;
    description: string;
    category: 'copy' | 'performance' | 'branding' | 'visual' | 'geral';
}

const GENERIC_CTAS = new Set([
    'BOOK_TRAVEL',
    'LEARN_MORE',
    'SHOP_NOW',
    'SIGN_UP',
    'SUBSCRIBE',
    'CONTACT_US',
    'GET_OFFER',
    'GET_QUOTE',
    'APPLY_NOW',
    'DOWNLOAD',
    'WATCH_MORE',
    'SEE_MORE',
    'NO_BUTTON',
]);

const PRIORITY_ORDER: Record<ImprovementPriority, number> = {
    alta: 0,
    media: 1,
    baixa: 2,
};

interface CreativeFields {
    text?: string | null;
    headline?: string | null;
    description?: string | null;
    call_to_action?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    creative_format?: string | null;
    type?: string | null;
    spend?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    ctr?: number | null;
    cpc?: number | null;
}

export interface BuildCopyChecksOptions {
    focus?: AuditFocus;
}

function isImageCreative(creative: CreativeFields | null | undefined): boolean {
    const format = (creative?.creative_format ?? creative?.type ?? 'image').toLowerCase();
    return format !== 'video';
}

function copyMayBeInArtwork(creative: CreativeFields | null | undefined, focus?: AuditFocus): boolean {
    return focus === 'branding' && isImageCreative(creative) && !!creative?.image_url;
}

interface ProblemInput {
    id: string;
    title: string;
    detail?: string;
    severity: 'error' | 'warning' | 'info';
}

interface PerfRow {
    rule_name: string;
    passed: boolean;
    reason: string;
}

interface BrandingRuleRow {
    rule_name: string;
    passed: boolean;
    reason: string;
}

function normalizeKey(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isGenericCta(cta: string): boolean {
    const upper = cta.toUpperCase().replace(/\s+/g, '_');
    return GENERIC_CTAS.has(upper) || upper.length <= 3;
}

function addAction(
    actions: ImprovementAction[],
    seen: Set<string>,
    action: Omit<ImprovementAction, 'id'> & { id?: string },
) {
    const key = normalizeKey(`${action.title}|${action.description}`);
    if (seen.has(key)) return;
    seen.add(key);
    actions.push({
        id: action.id ?? `action-${actions.length}`,
        ...action,
    });
}

export function buildCopyChecks(
    creative: CreativeFields | null | undefined,
    options?: BuildCopyChecksOptions,
): CopyCheck[] {
    const checks: CopyCheck[] = [];
    const focus = options?.focus;
    const artworkCopy = copyMayBeInArtwork(creative, focus);
    const text = (creative?.text ?? '').trim();
    const headline = (creative?.headline ?? '').trim();
    const description = (creative?.description ?? '').trim();
    const cta = (creative?.call_to_action ?? '').trim();

    if (!text) {
        if (artworkCopy) {
            checks.push({
                id: 'text-empty',
                label: 'Texto principal',
                status: 'ok',
                message: 'Campo Meta vazio — em criativos de imagem o copy pode estar na arte. Consulte as regras de branding.',
            });
        } else {
            checks.push({
                id: 'text-empty',
                label: 'Texto principal',
                status: 'error',
                message: 'O texto principal está vazio. Anúncios sem copy perdem clareza e reduzem a taxa de cliques.',
            });
        }
    } else if (text.length < 40) {
        checks.push({
            id: 'text-short',
            label: 'Texto principal',
            status: 'warning',
            message: `Texto curto (${text.length} caracteres). Expanda com benefício, prova social ou diferencial.`,
        });
    } else {
        checks.push({
            id: 'text-ok',
            label: 'Texto principal',
            status: 'ok',
            message: `Texto presente com ${text.length} caracteres.`,
        });
    }

    if (!headline) {
        if (artworkCopy) {
            checks.push({
                id: 'headline-empty',
                label: 'Headline',
                status: 'ok',
                message: 'Campo Meta vazio — headline pode estar na imagem. Verifique o resultado das regras de branding.',
            });
        } else {
            checks.push({
                id: 'headline-empty',
                label: 'Headline',
                status: 'warning',
                message: 'Sem headline definida. Adicione um título objetivo que comunique o benefício principal.',
            });
        }
    } else if (headline.length < 15) {
        checks.push({
            id: 'headline-short',
            label: 'Headline',
            status: 'warning',
            message: 'Headline curta demais. Inclua benefício específico ou resultado esperado.',
        });
    } else {
        checks.push({
            id: 'headline-ok',
            label: 'Headline',
            status: 'ok',
            message: `"${headline.length > 60 ? `${headline.slice(0, 60)}…` : headline}"`,
        });
    }

    if (!cta) {
        if (artworkCopy) {
            checks.push({
                id: 'cta-empty',
                label: 'Call to action',
                status: 'ok',
                message: 'Botão Meta vazio — CTA pode estar na arte (ex.: botão gráfico ou frase imperativa). Verifique regras de branding.',
            });
        } else {
            checks.push({
                id: 'cta-empty',
                label: 'Call to action',
                status: 'error',
                message: 'Nenhum CTA configurado. Defina uma ação clara (ex.: Agendar consulta, Saiba mais).',
            });
        }
    } else if (isGenericCta(cta)) {
        checks.push({
            id: 'cta-generic',
            label: 'Call to action',
            status: 'warning',
            message: `CTA genérico ("${cta}"). Use um botão alinhado à oferta, como "Agendar consulta" ou "Falar no WhatsApp".`,
        });
    } else {
        checks.push({
            id: 'cta-ok',
            label: 'Call to action',
            status: 'ok',
            message: `CTA configurado: ${cta}`,
        });
    }

    if (description) {
        checks.push({
            id: 'description-ok',
            label: 'Descrição',
            status: 'ok',
            message: `Descrição presente (${description.length} caracteres).`,
        });
    }

    const hasVisual = !!(creative?.image_url || creative?.video_url);
    if (!hasVisual) {
        checks.push({
            id: 'visual-missing',
            label: 'Mídia',
            status: 'warning',
            message: 'Sem imagem ou vídeo associado. Criativos visuais tendem a performar melhor.',
        });
    } else if (creative?.video_url && !text) {
        checks.push({
            id: 'video-no-caption',
            label: 'Vídeo',
            status: 'warning',
            message: 'Vídeo sem texto de apoio. Adicione legenda ou copy reforçando a mensagem do vídeo.',
        });
    }

    return checks;
}

export function buildImprovementActions(input: {
    creative: CreativeFields | null | undefined;
    problems: ProblemInput[];
    perfResults: PerfRow[];
    brandingResults: BrandingRuleRow[];
    suggestions: string[];
    recommendations?: string[] | null;
    auditFocus: AuditFocus;
}): ImprovementAction[] {
    const { creative, problems, perfResults, brandingResults, suggestions, recommendations, auditFocus } = input;
    const isBranding = auditFocus === 'branding';
    const actions: ImprovementAction[] = [];
    const seen = new Set<string>();

    const copyChecks = buildCopyChecks(creative, { focus: auditFocus });
    for (const check of copyChecks) {
        if (check.status === 'ok') continue;
        addAction(actions, seen, {
            id: check.id,
            priority: check.status === 'error' ? 'alta' : 'media',
            title: check.label,
            description: check.message,
            category: 'copy',
        });
    }

    for (const problem of problems) {
        addAction(actions, seen, {
            id: problem.id,
            priority: problem.severity === 'error' ? 'alta' : problem.severity === 'warning' ? 'media' : 'baixa',
            title: problem.title,
            description: problem.detail ?? problem.title,
            category: isBranding ? 'branding' : 'performance',
        });
    }

    if (!isBranding) {
        const impressions = Number(creative?.impressions) || 0;
        const ctr = Number(creative?.ctr) || 0;

        if (impressions > 0 && impressions < 100) {
            addAction(actions, seen, {
                id: 'low-impressions',
                priority: 'media',
                title: 'Volume de impressões baixo',
                description: `Apenas ${impressions.toLocaleString('pt-BR')} impressões. Aguarde fase de aprendizado ou revise público, lance e orçamento da campanha.`,
                category: 'performance',
            });
        }

        const failedCtrRule = perfResults.find(
            r => !r.passed && /ctr/i.test(r.rule_name),
        );
        if (failedCtrRule || (impressions >= 50 && ctr < 1)) {
            addAction(actions, seen, {
                id: 'improve-ctr',
                priority: 'alta',
                title: 'Melhorar taxa de cliques (CTR)',
                description: failedCtrRule?.reason
                    ? `${failedCtrRule.reason} Teste novos hooks na headline, troque a thumbnail e revise se o público está alinhado à oferta.`
                    : `CTR em ${ctr.toFixed(2)}%. Teste variações de copy, imagem de destaque e segmentação para aumentar o interesse.`,
                category: 'performance',
            });
        }

        const failedCpcRule = perfResults.find(
            r => !r.passed && /cpc/i.test(r.rule_name),
        );
        if (failedCpcRule) {
            addAction(actions, seen, {
                id: 'reduce-cpc',
                priority: 'alta',
                title: 'Reduzir custo por clique (CPC)',
                description: `${failedCpcRule.reason} Revise lances, qualidade do criativo e relevância do público-alvo.`,
                category: 'performance',
            });
        }
    }

    for (const suggestion of [...suggestions, ...(recommendations ?? [])]) {
        if (!suggestion?.trim()) continue;
        addAction(actions, seen, {
            priority: 'media',
            title: 'Recomendação',
            description: suggestion.trim(),
            category: 'geral',
        });
    }

    return actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function hasFrameworkScores(ai: AiAnalysis): boolean {
    const scoreKeys = [
        'overall_score',
        'hook_score',
        'value_proposition_score',
        'persuasion_score',
        'visual_score',
        'cta_score',
        'social_proof_score',
        'urgency_score',
        'target_alignment_score',
    ] as const;
    return scoreKeys.some(key => typeof ai[key] === 'number');
}

export function hasNarrativeData(
    ai: AiAnalysis,
    analysis: {
        strengths: string[];
        opportunities: string[];
        suggestions: string[];
        tone_analysis: string;
    },
): boolean {
    return (
        (ai.strengths?.length ?? 0) > 0 ||
        (ai.weaknesses?.length ?? 0) > 0 ||
        (ai.suggestions?.length ?? 0) > 0 ||
        (ai.action_plan?.length ?? 0) > 0 ||
        !!ai.executive_summary ||
        !!ai.tone_analysis ||
        analysis.strengths.length > 0 ||
        analysis.opportunities.length > 0 ||
        analysis.suggestions.length > 0 ||
        !!analysis.tone_analysis
    );
}

export function getCtaStatus(cta: string | null | undefined): 'ok' | 'empty' | 'generic' {
    const trimmed = (cta ?? '').trim();
    if (!trimmed) return 'empty';
    if (isGenericCta(trimmed)) return 'generic';
    return 'ok';
}
