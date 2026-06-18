/**
 * Guidance for where headline and CTA may appear in Meta ads (image vs video).
 * Used by audit-creative and check-creative-rules prompts.
 */

export const BRANDING_EVAL_VERSION = 'copy-placement-v1';

export const CREATIVE_COPY_PLACEMENT_GUIDANCE = `
REGRAS DE LOCALIZAÇÃO DE HEADLINE E CTA (aplicam-se a regras de conteúdo):

## Headline
- **Criativo de IMAGEM (estático)**: headline válida se estiver DENTRO DA ARTE (texto dominante/hook principal transcrito na análise visual).
- **Criativo de VÍDEO**: headline válida no texto/caption Meta abaixo do anúncio (campos text, headline ou description). Se esses campos estiverem vazios, use overlays/legendas visíveis na thumbnail ou no vídeo.
- **Nunca reprove** só porque o campo Meta "headline" está vazio se a headline estiver claramente visível na mídia (imagem) ou nos campos Meta alternativos (vídeo).

## CTA (Call to Action)
- Válido em QUALQUER uma destas fontes:
  1. Botão Meta configurado (call_to_action)
  2. Texto principal/caption do anúncio (text, description)
  3. Texto ou botão gráfico VISÍVEL na imagem/vídeo (ex.: "CONSULTE SUA COBERTURA", "Saiba mais" em botão na arte)
- **Nunca reprove** só porque call_to_action Meta está vazio se houver CTA imperativo visível na mídia ou no copy do anúncio.

## Avaliação
- Cruze SEMPRE: campos Meta + análise visual (transcrição) + formato (image vs video).
- Em rules_compliance.reason, cite a FONTE: ex. "Headline na imagem: 'PREÇO CONGELADO ATÉ 2028'" ou "CTA na imagem: 'CONSULTE SUA COBERTURA'".
- Campos Meta vazios são NEUTROS — não implicam violação automática.`;

export type HeadlineOrCtaRuleKind = 'headline' | 'cta';

export function isHeadlineOrCtaRule(ruleDefinition: string): HeadlineOrCtaRuleKind | null {
    const def = ruleDefinition.toUpperCase();
    if (def.includes('HEADLINE OBRIGAT') || def.includes('HEADLINE OBRIGATOR')) {
        return 'headline';
    }
    if (def.includes('CTA OBRIGAT') || def.includes('CALL TO ACTION')) {
        return 'cta';
    }
    return null;
}

export function getCopyPlacementRuleHint(kind: HeadlineOrCtaRuleKind, creativeFormat: string): string {
    const isVideo = creativeFormat.toLowerCase() === 'video';
    if (kind === 'headline') {
        return isVideo
            ? '\n- HEADLINE: Verifique text/headline/description Meta E overlays na thumbnail. Campos Meta vazios não reprovam se headline estiver na mídia.'
            : '\n- HEADLINE: Verifique campos Meta E texto dominante na IMAGEM (arte). Headline na arte = CUMPRE mesmo com headline Meta vazio.';
    }
    return '\n- CTA: Verifique botão Meta, texto do anúncio E frase/botão imperativo na imagem ou vídeo. CTA na arte = CUMPRE mesmo com call_to_action Meta vazio.';
}

interface CreativeCopyFields {
    text?: string | null;
    headline?: string | null;
    description?: string | null;
    call_to_action?: string | null;
    creative_format?: string | null;
    type?: string | null;
}

function emptyLabel(value: string | null | undefined): string {
    return value?.trim() ? value.trim() : '(vazio no banco — verificar também na mídia)';
}

export function formatMetaCopyContext(creative: CreativeCopyFields, formatOverride?: string): string {
    const format = (formatOverride ?? creative.creative_format ?? creative.type ?? 'image').toLowerCase();
    const isVideo = format === 'video';

    return `--- COPY META (campos do anúncio; vazios são neutros) ---
Formato: ${format}
Texto principal (Meta): ${emptyLabel(creative.text)}
Headline (Meta): ${emptyLabel(creative.headline)}
Descrição (Meta): ${emptyLabel(creative.description)}
CTA botão (Meta): ${emptyLabel(creative.call_to_action)}
Nota: Para ${isVideo ? 'vídeo, headline preferencialmente no caption Meta' : 'imagem, headline e CTA podem estar dentro da arte'}. Use a análise visual para confirmar copy na mídia.`;
}
