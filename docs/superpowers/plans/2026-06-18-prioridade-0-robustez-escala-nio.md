# Prioridade 0 — Robustez na escala da OI/NIO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o ClickAuditor confiável no volume de um anunciante telecom (centenas de campanhas, milhares de criativos) — sem truncar dados, sem travar batches, sem contas "morrendo" por token expirado.

**Architecture:** Mudanças cirúrgicas em 6 frentes independentes: (1) limite de contas monitoradas, (2) paginação Meta com aviso de truncamento, (3) orçamento de tempo + auto-continuação no `audit-batch`, (4) auto-refresh de token Meta via cron, (5) retry/backoff no cliente LLM, (6) timeout/fallback nas queries do Dashboard. Lógica pura é extraída para arquivos testáveis com Vitest; edge functions Deno e migrations SQL são verificadas com `deno check`/deploy/SQL.

**Tech Stack:** React 18 + Vite + TypeScript + Vitest (frontend), Supabase Edge Functions (Deno), PostgreSQL + pg_cron + pg_net (backend), Meta Graph API v21.0.

**Contexto de teste:** Frontend usa Vitest (`npm test` → `vitest run`); testes em `src/lib/*.test.ts`. Edge functions são Deno **sem harness de teste** — verificação por `deno check` + invocação manual. SQL é verificado por execução e `SELECT` de checagem. Sempre que houver lógica pura, ela é extraída para um arquivo importável pelo Vitest.

**Project ref Supabase:** `ejxlhstosdrryzrmfsbm` (usado nas URLs de cron).

---

### Task 1: Elevar o limite de contas monitoradas para a NIO

A OI tem muitas contas/BMs (regional + produtos). O limite hoje é `COALESCE(companies.max_integrations, 15)`, validado por trigger no banco e refletido no front via `company?.max_integrations ?? 15`. Basta elevar o valor da empresa NIO e o default da coluna; nenhuma lógica muda.

**Files:**
- Create: `supabase/migrations/20260618_raise_nio_integration_limit.sql`
- Reference (sem alterar): `supabase/migrations/20260602_team_max_integrations_15.sql` (trigger `enforce_integration_monitor_limit`), `src/pages/Integracoes.tsx:81`, `src/hooks/useCompany.ts:81`

- [ ] **Step 1: Escrever a migration**

```sql
-- 20260618_raise_nio_integration_limit.sql
-- A NIO (OI telecom) opera muitas contas Meta (regional + produtos).
-- O limite de 15 contas monitoradas vinha de COALESCE(max_integrations, 15).
-- Elevamos o teto para a empresa NIO e o default da coluna, sem tocar na trigger.

-- 1) Eleva o teto para a(s) empresa(s) NIO existente(s).
UPDATE public.companies
SET max_integrations = 200
WHERE lower(name) LIKE '%nio%';

-- 2) Eleva o default para novas empresas (mantém compatibilidade com a trigger,
--    que usa COALESCE(max_integrations, 15) — agora raramente cairá no fallback).
ALTER TABLE public.companies
ALTER COLUMN max_integrations SET DEFAULT 200;
```

- [ ] **Step 2: Aplicar e verificar**

Run (psql/SQL editor do Supabase):
```sql
\i supabase/migrations/20260618_raise_nio_integration_limit.sql
SELECT name, max_integrations FROM public.companies WHERE lower(name) LIKE '%nio%';
```
Expected: a linha da NIO retorna `max_integrations = 200`.

- [ ] **Step 3: Verificar reflexo no front (sem alterar código)**

Run: `npm run build`
Expected: build OK. O front já lê `company?.max_integrations` em `src/pages/Integracoes.tsx:81` e `useAccountHealth.ts:85`, então o novo teto aparece automaticamente em "Contas monitoradas pela equipe: N / 200".

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260618_raise_nio_integration_limit.sql
git commit -m "feat(integrations): eleva limite de contas monitoradas para a NIO (200)"
```

---

### Task 2: Paginação Meta — elevar cap e reportar truncamento ao time

Hoje `sync-meta-data` corta a paginação em `MAX_PAGES = 50` (limit=100 → ~5.000 entidades por endpoint). Para a OI isso **trunca dados silenciosamente** — só vira `console.warn`. Vamos (a) elevar o cap padrão e (b) registrar truncamento em `sync_errors`, que já alimenta o alerta horário (`sync-error-notify`).

**Files:**
- Modify: `supabase/functions/sync-meta-data/index.ts` (`MAX_PAGES` na linha 56; função `processPaginated` linhas ~62-119; chamadas de campanhas/adsets/ads ~281-516; fim do processamento por integração para gravar o erro)
- Create: `supabase/functions/_shared/truncation.ts` (helper puro)
- Create: `src/lib/truncation.test.ts` (teste Vitest do helper puro)

- [ ] **Step 1: Escrever o teste do helper puro de mensagem de truncamento**

```typescript
// src/lib/truncation.test.ts
import { describe, it, expect } from 'vitest';
import { buildTruncationError } from '../../supabase/functions/_shared/truncation';

describe('buildTruncationError', () => {
  it('descreve o endpoint e o cap atingido', () => {
    const e = buildTruncationError('campaigns', 200);
    expect(e.error_code).toBe('pagination_truncated');
    expect(e.error_message).toContain('campaigns');
    expect(e.error_message).toContain('200');
    expect(e.entity_type).toBe('campaigns');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- truncation`
Expected: FAIL — `Cannot find module '../../supabase/functions/_shared/truncation'`.

- [ ] **Step 3: Implementar o helper puro**

```typescript
// supabase/functions/_shared/truncation.ts
// Helper puro (sem Deno) para descrever um truncamento de paginação como linha de sync_errors.
export interface TruncationError {
  entity_type: string;
  error_code: 'pagination_truncated';
  error_message: string;
}

export function buildTruncationError(endpoint: string, pageCap: number): TruncationError {
  return {
    entity_type: endpoint,
    error_code: 'pagination_truncated',
    error_message:
      `Paginação truncada em ${endpoint}: o limite de ${pageCap} páginas foi atingido e ` +
      `ainda havia mais dados na Meta. Alguns registros podem estar faltando nesta conta.`,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- truncation`
Expected: PASS.

- [ ] **Step 5: Elevar o cap padrão no sync**

Em `supabase/functions/sync-meta-data/index.ts`, linha 56, trocar:
```typescript
const MAX_PAGES = 50;
```
por:
```typescript
const MAX_PAGES = 250; // OI/NIO: alto volume — evita truncar campanhas/adsets/ads silenciosamente
```

- [ ] **Step 6: Acumular truncamento e gravar em sync_errors**

No topo do handler por integração (onde `id`, `accessToken`, `integration` já existem, ~linha 233), adicionar um acumulador:
```typescript
const truncatedEndpoints = new Set<string>();
```

Tornar `processPaginated` ciente do endpoint: na assinatura (linha ~62) adicionar um parâmetro `endpointLabel`:
```typescript
async function processPaginated<T>(
    url: string,
    processFn: (data: T[]) => Promise<void>,
    logToDebug?: (msg: string) => void,
    maxPagesOverride?: number,
    endpointLabel?: string,
): Promise<{ truncated: boolean }> {
```
e no bloco de truncamento (linha ~112-116), além do `console.warn` existente, registrar o label:
```typescript
if (truncated) {
    const msg = `WARNING: Pagination cap (${pageCap} pages) reached but more data exists. Some records may be missing.`;
    if (logToDebug) logToDebug(msg);
    console.warn(`[processPaginated] ${msg} URL: ${url.substring(0, 120)}...`);
    if (endpointLabel) truncatedEndpoints.add(endpointLabel);
}
```
> Nota: `truncatedEndpoints` precisa estar no escopo de `processPaginated`. Se `processPaginated` for função de módulo (topo do arquivo), mova o `Set` para módulo (`const truncatedEndpoints = new Set<string>()` reinicializado por integração via `truncatedEndpoints.clear()` no início do loop da integração) OU passe o `Set` como parâmetro. Prefira passar como parâmetro para evitar estado global:
```typescript
//   ...maxPagesOverride?: number, endpointLabel?: string, sink?: Set<string>)
//   e no bloco truncado: if (endpointLabel && sink) sink.add(endpointLabel);
```

Passar o label/sink nas 3 chamadas principais (campanhas ~281, adsets ~341, ads ~419), ex.:
```typescript
await processPaginated(campaignsUrl, async (rows) => { /* ...existente... */ }, logToDebug, undefined, 'campaigns', truncatedEndpoints);
// idem 'ad_sets' e 'ads'
```

- [ ] **Step 7: Gravar a linha de sync_errors ao fim da integração**

Onde o resultado por integração é finalizado (antes do `results.push({ integration_id: id, status: "success", ... })`), inserir:
```typescript
if (truncatedEndpoints.size > 0) {
    const { buildTruncationError } = await import('../_shared/truncation.ts');
    const rows = Array.from(truncatedEndpoints).map((ep) => {
        const e = buildTruncationError(ep, MAX_PAGES);
        return {
            company_id: integration.company_id,
            integration_id: id,
            entity_type: e.entity_type,
            error_code: e.error_code,
            error_message: e.error_message,
            notified: false,
        };
    });
    await supabase.from('sync_errors').insert(rows);
}
```
> Use o mesmo `import` estático já presente no arquivo se preferir (mover para o topo): `import { buildTruncationError } from '../_shared/truncation.ts';`.

- [ ] **Step 8: Verificar tipos da edge function**

Run: `cd supabase/functions && deno check sync-meta-data/index.ts`
Expected: sem erros de tipo. (Se `deno` não estiver instalado, pular e confiar no deploy; registrar no commit que `deno check` não rodou.)

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/truncation.ts src/lib/truncation.test.ts supabase/functions/sync-meta-data/index.ts
git commit -m "feat(sync): eleva cap de paginacao Meta e registra truncamento em sync_errors"
```

---

### Task 3: `audit-batch` — orçamento de tempo + auto-continuação

`audit-batch` processa candidatos em chunks (`offset`/`nextOffset`) mas o loop principal (linhas ~447-506) **não tem checagem de tempo** e depende do timeout bruto do Edge Runtime. Com milhares de criativos, o chunk corrente pode estourar o limite e morrer no meio. Vamos adicionar um orçamento de tempo que encerra o chunk com segurança e reenfileira a continuação via `pg_net`/fetch para a própria função.

**Files:**
- Modify: `supabase/functions/audit-batch/index.ts` (constantes no topo; loop ~447-506; bloco de finalização do chunk ~356-360)
- Create: `supabase/functions/_shared/timeBudget.ts` (helper puro)
- Create: `src/lib/timeBudget.test.ts` (teste Vitest)

- [ ] **Step 1: Escrever o teste do orçamento de tempo**

```typescript
// src/lib/timeBudget.test.ts
import { describe, it, expect } from 'vitest';
import { makeTimeBudget } from '../../supabase/functions/_shared/timeBudget';

describe('makeTimeBudget', () => {
  it('não expira antes do limite', () => {
    const b = makeTimeBudget(1000, () => 0);
    expect(b.expired(0)).toBe(false);
    expect(b.expired(500)).toBe(false);
  });
  it('expira ao atingir o limite (com margem)', () => {
    const b = makeTimeBudget(1000, () => 0);
    expect(b.expired(1000)).toBe(true);
    expect(b.expired(1200)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- timeBudget`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o helper puro**

```typescript
// supabase/functions/_shared/timeBudget.ts
// Orçamento de tempo puro e testável para loops de edge functions.
// `now` é injetável para teste; em produção passe () => Date.now().
export interface TimeBudget {
  startedAt: number;
  budgetMs: number;
  expired: (nowMs: number) => boolean;
}

export function makeTimeBudget(budgetMs: number, now: () => number = () => Date.now()): TimeBudget {
  const startedAt = now();
  return {
    startedAt,
    budgetMs,
    expired: (nowMs: number) => nowMs - startedAt >= budgetMs,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- timeBudget`
Expected: PASS.

- [ ] **Step 5: Adicionar constante de orçamento e instanciar no handler**

No topo de `supabase/functions/audit-batch/index.ts` (junto às outras constantes):
```typescript
const BATCH_TIME_BUDGET_MS = 110000; // encerra o chunk antes do limite duro do Edge Runtime
```
No início do processamento do chunk (após resolver `supabase` e `job`, antes do loop ~447):
```typescript
import { makeTimeBudget } from '../_shared/timeBudget.ts'; // (mover para o topo do arquivo com os demais imports)
const budget = makeTimeBudget(BATCH_TIME_BUDGET_MS);
let stoppedForTime = false;
```

- [ ] **Step 6: Respeitar o orçamento dentro do loop**

No loop principal (linha ~447), antes de iniciar cada batch concorrente:
```typescript
for (let i = 0; i < toAudit.length; i += concurrency) {
    if (budget.expired(Date.now())) { stoppedForTime = true; break; }
    const batch = toAudit.slice(i, i + concurrency);
    // ...resto inalterado...
}
```

- [ ] **Step 7: Auto-continuar quando parar por tempo ou houver mais candidatos**

No bloco de finalização do chunk (após atualizar contadores do job, ~linha 356-360 onde `hasMoreCandidates` é conhecido), reenfileirar a própria função se o trabalho não acabou:
```typescript
const needsContinuation = stoppedForTime || hasMoreCandidates;
if (needsContinuation && job.status !== 'failed') {
    const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/audit-batch`;
    // dispara o próximo chunk sem bloquear a resposta atual
    fetch(selfUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: job.id, continue: true }),
    }).catch((e) => console.error('audit-batch self-continuation failed', e));
}
```
> Garantir que o handler aceite `{ job_id, continue: true }` retomando o job existente em vez de criar outro. Se o parsing atual já lê `job_id`, basta confirmar que o caminho "retomar job existente" é seguido quando `continue === true` (não recriar `batch_audit_jobs`).

- [ ] **Step 8: Verificar tipos**

Run: `cd supabase/functions && deno check audit-batch/index.ts`
Expected: sem erros de tipo (ou pular se `deno` ausente, anotando no commit).

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/timeBudget.ts src/lib/timeBudget.test.ts supabase/functions/audit-batch/index.ts
git commit -m "feat(audit-batch): orcamento de tempo por chunk com auto-continuacao para alto volume"
```

---

### Task 4: Auto-refresh de token Meta (cron diário)

Tokens longos da Meta expiram ~60d. Hoje **não há refresh** — só um aviso no front (`Integracoes.tsx:710-722`). Sem refresh, contas da OI param de sincronizar caladas. Vamos criar uma edge function que renova tokens prestes a expirar e um cron diário.

**Files:**
- Create: `supabase/functions/meta-refresh-tokens/index.ts`
- Create: `supabase/migrations/20260618_meta_token_refresh_cron.sql`
- Reference (sem alterar): `supabase/functions/meta-oauth-callback/index.ts:163-168` (padrão de troca `fb_exchange_token`), `supabase/functions/sync-meta-data/index.ts:233-240` (leitura do token)

- [ ] **Step 1: Implementar a edge function de refresh**

```typescript
// supabase/functions/meta-refresh-tokens/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    if (!META_APP_ID || !META_APP_SECRET) {
        return new Response(JSON.stringify({ error: 'missing_meta_app_credentials' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Renova tokens que expiram nos próximos 10 dias (margem de segurança).
    const cutoff = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('id, company_id, access_token, token_expires_at')
        .eq('platform', 'meta')
        .eq('status', 'active')
        .not('access_token', 'is', null)
        .or(`token_expires_at.is.null,token_expires_at.lt.${cutoff}`);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let refreshed = 0, failed = 0;
    for (const integ of integrations ?? []) {
        try {
            const url = `https://graph.facebook.com/v21.0/oauth/access_token`
                + `?grant_type=fb_exchange_token&client_id=${META_APP_ID}`
                + `&client_secret=${META_APP_SECRET}`
                + `&fb_exchange_token=${integ.access_token}`;
            const resp = await fetch(url);
            const json = await resp.json();
            if (!resp.ok || !json.access_token) {
                failed++;
                await supabase.from('sync_errors').insert({
                    company_id: integ.company_id,
                    integration_id: integ.id,
                    entity_type: 'token',
                    error_code: 'token_refresh_failed',
                    error_message: `Falha ao renovar token Meta: ${JSON.stringify(json).slice(0, 300)}`,
                    notified: false,
                });
                continue;
            }
            const expiresAt = json.expires_in
                ? new Date(Date.now() + json.expires_in * 1000).toISOString()
                : null;
            await supabase.from('integrations').update({
                access_token: json.access_token,
                token_expires_at: expiresAt,
            }).eq('id', integ.id);
            refreshed++;
        } catch (e) {
            failed++;
            console.error(`token refresh exception for ${integ.id}`, e);
        }
    }

    return new Response(JSON.stringify({ checked: integrations?.length ?? 0, refreshed, failed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
```

- [ ] **Step 2: Verificar tipos**

Run: `cd supabase/functions && deno check meta-refresh-tokens/index.ts`
Expected: sem erros (ou pular se `deno` ausente).

- [ ] **Step 3: Deploy da função**

Run: `npx supabase functions deploy meta-refresh-tokens`
Expected: deploy concluído.

- [ ] **Step 4: Escrever a migration do cron**

```sql
-- 20260618_meta_token_refresh_cron.sql
-- Renova tokens Meta prestes a expirar, diariamente às 04:30 UTC.
SELECT cron.unschedule('meta-token-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-token-refresh');

SELECT cron.schedule(
    'meta-token-refresh',
    '30 4 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-refresh-tokens',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{"cron": true}'::jsonb
    );
    $$
);
```
> Os crons existentes (`20260506_sync_meta_cron.sql`, `20260413_fury_cron.sql`) embutem a chave literal no SQL. Siga o mesmo padrão **do repositório** para consistência: se eles usam `'Bearer [SERVICE_ROLE_KEY]'` substituído no deploy, faça igual; caso contrário use `current_setting` como acima. Verifique `20260413_fury_cron.sql` e copie o formato de Authorization usado lá.

- [ ] **Step 5: Aplicar e verificar o agendamento**

Run (SQL):
```sql
\i supabase/migrations/20260618_meta_token_refresh_cron.sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'meta-token-refresh';
```
Expected: 1 linha com `schedule = '30 4 * * *'`.

- [ ] **Step 6: Smoke test manual da função**

Run:
```bash
curl -s -X POST "https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-refresh-tokens" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
```
Expected: JSON `{ "checked": N, "refreshed": X, "failed": Y }` sem erro 500.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/meta-refresh-tokens/index.ts supabase/migrations/20260618_meta_token_refresh_cron.sql
git commit -m "feat(meta): auto-refresh de token via cron diario para evitar contas dessincronizadas"
```

---

### Task 5: Retry com backoff no cliente LLM

`_shared/llm.ts` já cai de DeepSeek → OpenAI, mas **uma falha transitória** (429/5xx/timeout de rede) em ambos derruba a auditoria sem retry. Vamos extrair a decisão de retry/backoff (pura, testável) e aplicá-la nas chamadas de raciocínio e visão.

**Files:**
- Create: `supabase/functions/_shared/llmRetry.ts` (helper puro)
- Create: `src/lib/llmRetry.test.ts` (teste Vitest)
- Modify: `supabase/functions/_shared/llm.ts` (envolver os 3 `fetch`: DeepSeek ~73, OpenAI reasoning ~113, OpenAI vision ~150)

- [ ] **Step 1: Escrever o teste do helper de retry**

```typescript
// src/lib/llmRetry.test.ts
import { describe, it, expect } from 'vitest';
import { isRetryableStatus, backoffMs } from '../../supabase/functions/_shared/llmRetry';

describe('isRetryableStatus', () => {
  it('marca 429 e 5xx como retentáveis', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });
  it('não retenta 4xx de cliente (exceto 429)', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
  });
});

describe('backoffMs', () => {
  it('cresce exponencialmente por tentativa', () => {
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(2)).toBe(1000);
    expect(backoffMs(3)).toBe(2000);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- llmRetry`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o helper puro**

```typescript
// supabase/functions/_shared/llmRetry.ts
// Política de retry pura e testável para chamadas LLM.
const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE.has(status);
}

// 500ms, 1000ms, 2000ms... (attempt começa em 1)
export function backoffMs(attempt: number): number {
  return 500 * Math.pow(2, attempt - 1);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- llmRetry`
Expected: PASS.

- [ ] **Step 5: Aplicar retry na chamada de raciocínio DeepSeek**

Em `supabase/functions/_shared/llm.ts`, adicionar o import no topo:
```typescript
import { isRetryableStatus, backoffMs } from './llmRetry.ts';
```
e adicionar um utilitário de sleep próximo ao topo do arquivo (após os defaults, ~linha 41):
```typescript
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_LLM_ATTEMPTS = 3;
```
Envolver o `fetch` do DeepSeek (bloco `try` linha ~72-99) num laço de tentativas:
```typescript
        for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
            try {
                const resp = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    return { ok: true, content: extractContent(data), provider: 'deepseek', model, status: resp.status };
                }
                const errText = await resp.text().catch(() => '');
                console.error(`DeepSeek reasoning call failed (${resp.status}, attempt ${attempt}): ${errText.slice(0, 300)}`);
                if (isRetryableStatus(resp.status) && attempt < MAX_LLM_ATTEMPTS) {
                    await sleep(backoffMs(attempt));
                    continue;
                }
                if (!openaiKey) {
                    return { ok: false, content: '', provider: 'deepseek', model, status: resp.status, error: errText.slice(0, 500) };
                }
                console.warn('Falling back to OpenAI for reasoning.');
                break;
            } catch (e) {
                console.error(`DeepSeek reasoning exception (attempt ${attempt}):`, e);
                if (attempt < MAX_LLM_ATTEMPTS) { await sleep(backoffMs(attempt)); continue; }
                if (!openaiKey) {
                    return { ok: false, content: '', provider: 'deepseek', model, status: 0, error: String(e) };
                }
                console.warn('Falling back to OpenAI for reasoning.');
                break;
            }
        }
```

- [ ] **Step 6: Aplicar retry na chamada de raciocínio OpenAI (fallback)**

Envolver o `fetch` OpenAI de reasoning (bloco linha ~112-128) no mesmo padrão de laço:
```typescript
        for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
            try {
                const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    return { ok: true, content: extractContent(data), provider: 'openai', model, status: resp.status };
                }
                if (isRetryableStatus(resp.status) && attempt < MAX_LLM_ATTEMPTS) { await sleep(backoffMs(attempt)); continue; }
                return { ok: false, content: '', provider: 'openai', model, status: resp.status };
            } catch (e) {
                if (attempt < MAX_LLM_ATTEMPTS) { await sleep(backoffMs(attempt)); continue; }
                return { ok: false, content: '', provider: 'openai', model, status: 0, error: String(e) };
            }
        }
        return { ok: false, content: '', provider: 'openai', model, status: 0, error: 'exhausted' };
```

- [ ] **Step 7: Aplicar retry na chamada de visão OpenAI**

Envolver o `fetch` de `runVisionCompletion` (bloco linha ~149-173) no mesmo padrão, preservando os retornos `{ provider: 'openai' }`.

- [ ] **Step 8: Rodar a suíte e checar tipos**

Run: `npm test`
Expected: todos os testes passam (incluindo `llmRetry`).
Run: `cd supabase/functions && deno check _shared/llm.ts`
Expected: sem erros (ou pular se `deno` ausente).

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/llmRetry.ts src/lib/llmRetry.test.ts supabase/functions/_shared/llm.ts
git commit -m "feat(llm): retry com backoff em falhas transitorias antes de desistir/fazer fallback"
```

---

### Task 6: Timeout + estado de erro nas queries do Dashboard

O Dashboard já carrega por seção (skeletons independentes), mas **não há timeout**: se uma query travar, o skeleton fica infinito. React Query não aborta `fetch` por padrão. Vamos criar um wrapper de timeout e aplicá-lo às `queryFn` mais pesadas, convertendo travamento em erro tratável.

**Files:**
- Create: `src/lib/withQueryTimeout.ts` (helper puro)
- Create: `src/lib/withQueryTimeout.test.ts` (teste Vitest)
- Modify: `src/hooks/useCompanyMetrics.ts` e `src/hooks/useCreativePerformance.ts` (envolver a `queryFn`)
- Reference: `src/pages/Dashboard.tsx:115-136` (consumo dos hooks e gating de loading)

- [ ] **Step 1: Escrever o teste do wrapper de timeout**

```typescript
// src/lib/withQueryTimeout.test.ts
import { describe, it, expect } from 'vitest';
import { withQueryTimeout } from './withQueryTimeout';

describe('withQueryTimeout', () => {
  it('resolve quando a promise termina antes do limite', async () => {
    const r = await withQueryTimeout(Promise.resolve('ok'), 50, 'metrics');
    expect(r).toBe('ok');
  });
  it('rejeita com mensagem clara quando estoura o tempo', async () => {
    const slow = new Promise((res) => setTimeout(() => res('late'), 100));
    await expect(withQueryTimeout(slow, 10, 'metrics')).rejects.toThrow(/metrics.*tempo/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- withQueryTimeout`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o wrapper**

```typescript
// src/lib/withQueryTimeout.ts
// Garante que uma queryFn que trava vire erro tratável (em vez de skeleton infinito).
export function withQueryTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`A consulta "${label}" excedeu o tempo limite (${ms}ms). Tente novamente.`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- withQueryTimeout`
Expected: PASS.

- [ ] **Step 5: Aplicar o timeout em useCompanyMetrics**

Em `src/hooks/useCompanyMetrics.ts`, importar e envolver o corpo da `queryFn`. Padrão:
```typescript
import { withQueryTimeout } from '@/lib/withQueryTimeout';

// dentro de useQuery:
queryFn: () => withQueryTimeout((async () => {
    // ...corpo atual da queryFn inalterado...
})(), 20000, 'métricas da empresa'),
```

- [ ] **Step 6: Aplicar o timeout em useCreativePerformance**

Mesmo padrão em `src/hooks/useCreativePerformance.ts`, com label `'performance de criativos'` e 20000ms.

- [ ] **Step 7: Garantir estado de erro visível no Dashboard**

Em `src/pages/Dashboard.tsx`, onde os hooks são consumidos (~linhas 115-136), capturar `error` e renderizar um aviso por seção em vez de skeleton infinito. Para a seção de métricas (Performance), ajustar o gate (~linha 421):
```typescript
const { data: metrics, isLoading: metricsLoading, error: metricsError } = useCompanyMetrics(/* ...args... */);
// ...
{metricsError ? (
    <Card variant="elevated">
        <CardContent className="pt-5 text-sm text-muted-foreground">
            Não foi possível carregar as métricas. {metricsError.message}
        </CardContent>
    </Card>
) : metricsLoading && !m && module === 'performance' ? (
    <motion.div variants={fadeUpVariant}><KpiStrip columns={6} isLoading items={[]} /></motion.div>
) : null}
```
Aplicar o mesmo tratamento de `error` para a seção de criativos (`creativeError`) no gate ~linha 673.

- [ ] **Step 8: Rodar a suíte e o build**

Run: `npm test`
Expected: todos passam.
Run: `npm run build`
Expected: build OK, sem erros de tipo.

- [ ] **Step 9: Commit**

```bash
git add src/lib/withQueryTimeout.ts src/lib/withQueryTimeout.test.ts src/hooks/useCompanyMetrics.ts src/hooks/useCreativePerformance.ts src/pages/Dashboard.tsx
git commit -m "feat(dashboard): timeout e estado de erro por secao para evitar skeleton infinito"
```

---

## Self-Review

**Cobertura da spec (Prioridade 0 do roadmap-nio.md):**
- 0.1 paginação Meta → Task 2 ✅
- 0.2 fila resiliente p/ batch >100 criativos → Task 3 (orçamento + auto-continuação) ✅
- 0.3 auto-refresh de token Meta → Task 4 ✅
- 0.4 remover/elevar limite de 15 contas → Task 1 ✅
- 0.5 loading incremental + timeout/fallback → Task 6 (incremental já existe; adicionamos timeout/erro) ✅
- 0.6 fallback/retry de IA → Task 5 ✅
- App ID placeholder (`facebook.ts`) era listado como risco, **não** como item de P0 — é config de ambiente (`VITE_META_APP_ID`), não código; deixado fora do plano de propósito. Registrado aqui para não passar como esquecido.

**Placeholders:** nenhum "TODO/implementar depois"; todo passo de código traz o código. Onde dependo de um padrão do repo (formato de Authorization no cron, retomada de job no audit-batch), apontei o arquivo exato a conferir em vez de inventar.

**Consistência de tipos/nomes:** helpers puros (`buildTruncationError`, `makeTimeBudget`, `isRetryableStatus`/`backoffMs`, `withQueryTimeout`) têm assinatura única e são referenciados igual nos testes e nos call sites. Migrations usam datas `20260618_*`. Project ref `ejxlhstosdrryzrmfsbm` consistente com os crons existentes.

**Risco residual conhecido:** se `deno` não estiver na máquina de execução, os passos `deno check` devem ser pulados e a verificação recai sobre deploy + smoke test (anotar no commit). Os testes Vitest cobrem toda a lógica pura independente de Deno.
```

