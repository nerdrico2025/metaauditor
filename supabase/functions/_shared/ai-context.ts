// Loads each company's `ai_context` (set in Settings → Contexto da IA) and
// formats it as a prompt fragment to inject into LLM calls. Without this,
// the AI gives generic feedback that doesn't reflect the advertiser's
// actual business, audience, offers, and benchmarks.

export interface BrandBriefing {
    completed_at?: string;
    brand_promise?: string;
    brand_personality?: string;
    visual_identity?: string;
    logo_usage?: string;
    tone_in_ads?: string;
    mandatory_elements?: string;
    forbidden_practices?: string;
    audience_perception?: string;
    reference_notes?: string;
}

export interface CompanyAiContext {
    business_description?: string;
    target_audience?: string;
    tone_of_voice?: string;
    key_offers?: string;
    dos_and_donts?: string;
    target_metrics?: { ctr_min?: number; cpc_max?: number; cpa_target?: number };
    extra_context?: string;
    brand_briefing?: BrandBriefing;
}

export async function loadCompanyAiContext(supabase: any, companyId: string): Promise<CompanyAiContext | null> {
    if (!companyId) return null;
    const { data, error } = await supabase
        .from('companies')
        .select('ai_context')
        .eq('id', companyId)
        .single();
    if (error || !data?.ai_context) return null;
    return data.ai_context as CompanyAiContext;
}

export function formatBrandBriefingForPrompt(briefing: BrandBriefing | null | undefined): string {
    if (!briefing) return '';
    const lines: string[] = [];
    if (briefing.brand_promise) lines.push(`Promessa de marca: ${briefing.brand_promise}`);
    if (briefing.brand_personality) lines.push(`Personalidade da marca: ${briefing.brand_personality}`);
    if (briefing.visual_identity) lines.push(`Identidade visual: ${briefing.visual_identity}`);
    if (briefing.logo_usage) lines.push(`Uso de logo / elementos visuais: ${briefing.logo_usage}`);
    if (briefing.tone_in_ads) lines.push(`Tom de voz em anúncios: ${briefing.tone_in_ads}`);
    if (briefing.mandatory_elements) lines.push(`Elementos obrigatórios nos criativos:\n${briefing.mandatory_elements}`);
    if (briefing.forbidden_practices) lines.push(`Práticas proibidas:\n${briefing.forbidden_practices}`);
    if (briefing.audience_perception) lines.push(`Percepção desejada pelo público: ${briefing.audience_perception}`);
    if (briefing.reference_notes) lines.push(`Referências / o que evitar parecer: ${briefing.reference_notes}`);
    if (lines.length === 0) return '';
    return `\n--- BRIEFING DE MARCA ---\n${lines.join('\n')}\n\nUse este briefing como referência principal para avaliar se o criativo está alinhado com a identidade da marca, além das regras individuais listadas.\n`;
}

export function formatAiContextForPrompt(ctx: CompanyAiContext | null): string {
    if (!ctx) return '';
    const lines: string[] = [];
    if (ctx.business_description) lines.push(`Negócio: ${ctx.business_description}`);
    if (ctx.target_audience) lines.push(`Público-alvo: ${ctx.target_audience}`);
    if (ctx.tone_of_voice) lines.push(`Tom de voz: ${ctx.tone_of_voice}`);
    if (ctx.key_offers) lines.push(`Ofertas / produtos: ${ctx.key_offers}`);
    if (ctx.dos_and_donts) lines.push(`Diretrizes obrigatórias:\n${ctx.dos_and_donts}`);
    const tm = ctx.target_metrics;
    if (tm && (tm.ctr_min != null || tm.cpc_max != null || tm.cpa_target != null)) {
        const parts: string[] = [];
        if (tm.ctr_min != null) parts.push(`CTR ≥ ${tm.ctr_min}%`);
        if (tm.cpc_max != null) parts.push(`CPC ≤ R$${tm.cpc_max}`);
        if (tm.cpa_target != null) parts.push(`CPA alvo R$${tm.cpa_target}`);
        if (parts.length) lines.push(`Metas de performance do anunciante: ${parts.join(', ')}`);
    }
    if (ctx.extra_context) lines.push(`Contexto extra: ${ctx.extra_context}`);
    if (lines.length === 0) return '';
    return `\n--- CONTEXTO DO ANUNCIANTE ---\n${lines.join('\n')}\n\nUse estas informações como base para todas as recomendações. Compare métricas observadas contra as metas do anunciante (não use médias genéricas de mercado). Respeite tom de voz e diretrizes obrigatórias. Evite respostas genéricas — referencie ofertas e público específicos quando relevante.\n`;
}
