/** Extracts the real error message from a Supabase Edge Function invoke response. */
export async function parseSupabaseFunctionError(
  error: { message?: string; context?: Response } | null | undefined,
  data?: { error?: string; success?: boolean } | null,
): Promise<string> {
  if (data?.error) return String(data.error);

  if (error) {
    let detail = error.message || 'Erro desconhecido';
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) detail = String(body.error);
      }
    } catch {
      /* keep generic message */
    }
    return detail;
  }

  return 'Erro desconhecido';
}

/** Turns raw backend/LLM errors into a message the user can act on. */
export function friendlyEdgeFunctionError(raw: string, fallback = 'Operação falhou. Tente novamente.'): string {
  if (/quota|exceeded your current|\b429\b/i.test(raw)) {
    return 'A conta da OpenAI está sem cota/crédito — regularize o billing na OpenAI e tente novamente.';
  }
  if (/OPENAI_API_KEY/i.test(raw)) {
    return 'A chave da OpenAI não está configurada no servidor (Supabase Secrets).';
  }
  if (/invalid_image|image_url|download.*image/i.test(raw)) {
    return 'Não foi possível analisar a imagem do criativo. Verifique se a URL da mídia está acessível.';
  }
  if (/batch job not found|missing job_id/i.test(raw)) {
    return 'Não foi possível acompanhar o progresso do lote. Inicie uma nova análise em lote.';
  }
  if (/batch_audit_jobs|relation .*batch_audit_jobs.* does not exist/i.test(raw)) {
    return 'A estrutura de jobs de auditoria ainda não foi aplicada no banco. Rode as migrations e tente novamente.';
  }
  if (/job de auditoria falhou|batch audit job failed/i.test(raw)) {
    return 'A varredura em lote foi interrompida. Aguarde alguns instantes e inicie uma nova análise.';
  }
  if (/retorno inválido do job|falha ao iniciar job/i.test(raw)) {
    return 'Não foi possível iniciar a varredura em lote. Tente novamente em instantes.';
  }
  if (/Campanha pausada|campanhas ativas|sem campanha ativa vinculada/i.test(raw)) {
    return raw.includes('sem campanha')
      ? 'Criativo sem campanha ativa vinculada — análise disponível apenas para campanhas ativas.'
      : 'Campanha pausada — análise disponível apenas para campanhas ativas.';
  }
  if (/non-2xx|edge function returned/i.test(raw)) {
    return 'Não foi possível concluir a análise. Verifique se a campanha está ativa e tente novamente.';
  }
  return raw || fallback;
}
