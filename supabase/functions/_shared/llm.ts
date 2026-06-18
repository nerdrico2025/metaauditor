// Cliente LLM centralizado para as auditorias de IA.
//
// Arquitetura de provedores:
// - RACIOCÍNIO TEXTUAL (análise profunda em JSON): roda no DeepSeek (API compatível
//   com OpenAI), que substitui o antigo modelo econômico (gpt-4o-mini) por uma
//   análise mais profunda. Cai de volta para a OpenAI se a chave do DeepSeek faltar
//   ou a chamada falhar.
// - VISÃO (entender a imagem do criativo): permanece na OpenAI, pois o DeepSeek não
//   possui capacidade multimodal. Ver `runVisionCompletion`.
//
// Variáveis de ambiente:
//   DEEPSEEK_API_KEY    chave da API DeepSeek (obrigatória para usar o DeepSeek)
//   DEEPSEEK_MODEL      modelo de raciocínio (default: 'deepseek-chat')
//   DEEPSEEK_BASE_URL   base da API (default: 'https://api.deepseek.com')
//   OPENAI_API_KEY      usada para visão e como fallback de raciocínio
//   OPENAI_REASONING_MODEL  modelo OpenAI de fallback (default: 'gpt-4o-mini')

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: unknown;
}

export interface ReasoningOptions {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
}

export interface LlmResult {
    ok: boolean;
    content: string;
    provider: 'deepseek' | 'openai' | 'none';
    model: string;
    status: number;
    error?: string;
}

const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';
const OPENAI_DEFAULT_REASONING_MODEL = 'gpt-4o-mini';
const OPENAI_VISION_MODEL = 'gpt-4o-mini';

function extractContent(data: unknown): string {
    const choice = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0];
    return choice?.message?.content ?? '';
}

/**
 * Executa a chamada de raciocínio textual (a "análise profunda").
 * Prefere o DeepSeek; cai para a OpenAI se a chave do DeepSeek faltar ou a chamada falhar.
 */
export async function runReasoningCompletion(opts: ReasoningOptions): Promise<LlmResult> {
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (deepseekKey) {
        const model = Deno.env.get('DEEPSEEK_MODEL') || DEEPSEEK_DEFAULT_MODEL;
        const baseUrl = (Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com').replace(/\/+$/, '');
        // O modelo de raciocínio (deepseek-reasoner) ignora temperature e não aceita response_format.
        const isReasoner = model.includes('reasoner');

        const body: Record<string, unknown> = {
            model,
            messages: opts.messages,
            max_tokens: opts.maxTokens ?? 4000,
        };
        if (!isReasoner) {
            body.temperature = opts.temperature ?? 0.4;
            if (opts.jsonResponse) body.response_format = { type: 'json_object' };
        }

        try {
            const resp = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (resp.ok) {
                const data = await resp.json();
                return { ok: true, content: extractContent(data), provider: 'deepseek', model, status: resp.status };
            }

            const errText = await resp.text().catch(() => '');
            console.error(`DeepSeek reasoning call failed (${resp.status}): ${errText.slice(0, 500)}`);
            if (!openaiKey) {
                return { ok: false, content: '', provider: 'deepseek', model, status: resp.status, error: errText.slice(0, 500) };
            }
            console.warn('Falling back to OpenAI for reasoning.');
        } catch (e) {
            console.error('DeepSeek reasoning call exception:', e);
            if (!openaiKey) {
                return { ok: false, content: '', provider: 'deepseek', model, status: 0, error: String(e) };
            }
            console.warn('Falling back to OpenAI for reasoning.');
        }
    }

    if (openaiKey) {
        const model = Deno.env.get('OPENAI_REASONING_MODEL') || OPENAI_DEFAULT_REASONING_MODEL;
        const body: Record<string, unknown> = {
            model,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.4,
            max_tokens: opts.maxTokens ?? 2000,
        };
        if (opts.jsonResponse) body.response_format = { type: 'json_object' };

        try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (resp.ok) {
                const data = await resp.json();
                return { ok: true, content: extractContent(data), provider: 'openai', model, status: resp.status };
            }
            return { ok: false, content: '', provider: 'openai', model, status: resp.status };
        } catch (e) {
            return { ok: false, content: '', provider: 'openai', model, status: 0, error: String(e) };
        }
    }

    return { ok: false, content: '', provider: 'none', model: '', status: 0, error: 'no_api_key' };
}

/**
 * Executa a chamada de VISÃO (entender a imagem). Roda na OpenAI — o DeepSeek não é multimodal.
 * `content` deve seguir o formato multimodal da OpenAI (array com {type:'text'} e {type:'image_url'}).
 */
export async function runVisionCompletion(opts: {
    systemPrompt: string;
    content: unknown;
    temperature?: number;
    maxTokens?: number;
}): Promise<LlmResult> {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
        return { ok: false, content: '', provider: 'none', model: '', status: 0, error: 'no_openai_key' };
    }
    const model = Deno.env.get('OPENAI_VISION_MODEL') || OPENAI_VISION_MODEL;
    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: opts.systemPrompt },
                    { role: 'user', content: opts.content },
                ],
                temperature: opts.temperature ?? 0.3,
                max_tokens: opts.maxTokens ?? 700,
            }),
        });
        if (resp.ok) {
            const data = await resp.json();
            return { ok: true, content: extractContent(data), provider: 'openai', model, status: resp.status };
        }
        return { ok: false, content: '', provider: 'openai', model, status: resp.status };
    } catch (e) {
        return { ok: false, content: '', provider: 'openai', model, status: 0, error: String(e) };
    }
}
