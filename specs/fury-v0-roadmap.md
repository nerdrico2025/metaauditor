# FURY v0 — Roadmap de Implementacao

> Algoritmo de otimizacao automatica do ClickHero Ads Analyzer.
> Versao deterministica (regras + historico 7d). ML real = Sprint 3.

---

## ESTADO ATUAL (Abril 2026)

### Infraestrutura existente
- `evaluate-performance-rules` edge function (threshold rules por campanha)
- `automation_rules` table (trigger_type=metric_threshold, action=pause/notify)
- Meta API actions: pause/activate/update_budget (campaign, adset, ad)
- `campaign_metrics` daily (90d), `ad_set_metrics` daily (90d)
- `creatives` com totais lifetime (spend, clicks, impressions, ctr, cpc)
- Creative audit via gpt-4o-mini (8 frameworks de scoring)
- Cooldown de 6h entre disparos

### Gaps criticos
1. Avalia snapshot instantaneo, nao tendencia historica
2. Nao tem regra de saturacao (frequencia), scaling, ou orcamento
3. Sem cron — depende de trigger manual do frontend
4. Sem feed de acoes (historico do que o FURY fez)
5. Sem undo (acoes sao one-way contra Meta API)
6. So avalia campaigns, nao adsets/ads individuais

---

## FASE 1: Fundacao (1-2 semanas)

### 1.1 — Tabela `fury_actions` (log + undo)
Nova tabela para registrar TODA acao do FURY:

```sql
CREATE TABLE fury_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id),
    rule_id UUID REFERENCES automation_rules(id),
    entity_type TEXT NOT NULL, -- 'campaign' | 'adset' | 'ad'
    entity_id UUID NOT NULL,
    entity_external_id TEXT,
    entity_name TEXT,
    action_type TEXT NOT NULL, -- 'pause' | 'activate' | 'update_budget' | 'notify' | 'flag_review'
    action_config JSONB, -- {old_status, new_status, old_budget, new_budget}
    trigger_metric TEXT, -- 'ctr' | 'cpc' | 'frequency' | etc
    trigger_value NUMERIC,
    trigger_threshold NUMERIC,
    trigger_window_days INT,
    status TEXT DEFAULT 'executed', -- 'executed' | 'undone' | 'failed' | 'pending_approval'
    undone_at TIMESTAMPTZ,
    undo_deadline TIMESTAMPTZ, -- 30min apos execucao
    executed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: company_id isolation
-- Index: company_id + executed_at DESC
```

**Por que isso primeiro:** sem log de acoes, todo o resto e invisivel. O feed, o undo, e a auditoria dependem disso.

### 1.2 — Mecanismo de Undo (30 min)
- Cada acao registra `action_config.old_status` / `action_config.old_budget`
- Endpoint `fury-undo-action`: reverte via Meta API se dentro do `undo_deadline`
- Frontend: botao "Desfazer" no feed (habilitado se < 30min)

### 1.3 — Expandir avaliacao para adsets e ads
Hoje `evaluate-performance-rules` so itera `campaigns`. Expandir para:
- Buscar `ad_sets` com metricas agregadas de `ad_set_metrics`
- Buscar `creatives` com metricas lifetime
- Cada regra define `applies_to`: 'campaign' | 'adset' | 'ad' | 'all'
- Adicionar coluna `applies_to` em `automation_rules`

---

## FASE 2: Regras Inteligentes (2-3 semanas)

### 2.1 — Motor de Historico 7 Dias
Refatorar `evaluate-performance-rules` para usar historico:

```
PARA CADA regra ativa:
  window = regra.window_days (padrao 7)
  PARA CADA entidade (campaign/adset/ad):
    metricas = buscar campaign_metrics/ad_set_metrics WHERE date >= hoje - window
    media_movel = SUM(metrica) / window
    tendencia = (ultimos_3d - primeiros_3d) / primeiros_3d * 100
    avaliar condicao contra media_movel (nao snapshot)
```

**Impacto:** regras baseadas em tendencia em vez de pico momentaneo. Evita false positives.

### 2.2 — Novas Regras Built-in

| Regra | Condicao | Acao | Window |
|-------|----------|------|--------|
| Saturacao | frequencia_media > 3.0 por 3d consecutivos | pausar ad | 3d |
| CAC Alto | CPA > threshold por 2d | pausar adset | 2d |
| CTR Baixo | CTR < 0.5% por 48h | flag para revisao | 2d |
| Orcamento Esgotado | spend/budget > 90% antes das 18h | alerta | 1d |
| Scaling | CPA < target * 0.8 por 3d | sugerir +15% budget | 3d |

Implementacao:
- Cada regra e um `rule_template` (pre-configurado, ativavel com 1 clique)
- Templates moram em `automation_rule_templates` (nao editaveis, atualizaveis por deploy)
- Tenant ativa e configura thresholds

### 2.3 — Metrica de Frequencia
Hoje `ad_set_metrics` ja tem `frequency`. Para ads individuais:
- Adicionar `frequency` e `reach` na query de ad-level insights do sync
- Calcular: `frequency = impressions / reach` quando reach > 0

---

## FASE 3: Automacao (1-2 semanas)

### 3.1 — Cron via Supabase pg_cron
Usar `pg_cron` (nativo do Supabase) em vez de BullMQ:

```sql
-- Avaliar regras a cada hora
SELECT cron.schedule(
    'fury-hourly-eval',
    '0 * * * *',
    $$
    SELECT net.http_post(
        'https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/evaluate-performance-rules',
        '{"cron": true}'::jsonb,
        headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
    );
    $$
);
```

**Por que pg_cron:** ja vem no Supabase, zero infra extra. BullMQ exigiria Redis + worker Node.js separado.

### 3.2 — Priorizar por investimento
No cron job, ordenar accounts por `spend DESC` (ultimas 24h) para que contas com mais investimento sejam avaliadas primeiro dentro do timeout.

### 3.3 — Auth para chamadas cron
Hoje `evaluate-performance-rules` exige JWT de usuario. Para cron:
- Adicionar modo `cron: true` no payload
- Usar `SUPABASE_SERVICE_ROLE_KEY` como auth
- Iterar TODOS os company_ids ativos (nao apenas 1 usuario)
- Deploy com `--no-verify-jwt`

---

## FASE 4: Frontend — Feed de Acoes (1 semana)

### 4.1 — Pagina "Central FURY"
Nova pagina `/fury` ou secao dentro de Dashboard:

```
+-----------------------------------------------+
| FURY - Central de Otimizacao                   |
|                                                |
| [Ativo] 12 regras | 47 acoes hoje | 3 undos   |
|                                                |
| Timeline:                                      |
| 14:32 - Pausou "PLANO B" (CTR 0.3% < 0.5%)   |
|         [Desfazer] (28min restantes)           |
| 13:01 - Alerta: Freq 3.8 em "CRIATIVO 12"     |
| 12:00 - Sugeriu +15% budget em "CAMPANHA OI"  |
|         CPA R$2.10 (target R$3.00) por 3d      |
|         [Aplicar] [Ignorar]                    |
+-----------------------------------------------+
```

### 4.2 — Componentes
- `FuryTimeline` — feed em tempo real (query fury_actions ORDER BY executed_at DESC)
- `FuryActionCard` — card com entidade, regra, metrica, acao, botao undo
- `FuryStats` — header com counters (regras ativas, acoes hoje, undos)
- Integrar no Dashboard tab "Performance" como widget colapsavel

### 4.3 — Notificacoes
- Toast quando FURY executa acao automatica
- Badge no sidebar "FURY" com contagem de acoes pendentes de aprovacao

---

## FASE 5: Modo Aprovacao (opcional, pos-MVP)

### 5.1 — Modo Sugestao vs Modo Automatico
Cada regra pode ter `execution_mode`:
- `auto` — FURY executa direto (atual)
- `suggest` — FURY registra como `status: 'pending_approval'`, usuario aprova

### 5.2 — Aprovacao em Lote
Pagina com lista de acoes pendentes:
- [Aprovar Todas] [Rejeitar Todas]
- Checkbox individual
- Contexto: grafico de tendencia da metrica que disparou

---

## METRICAS DE SUCESSO

| Metrica | Target v0 |
|---------|-----------|
| Regras executam corretamente | 100% dos casos testados |
| Cron roda sem falha | 48h consecutivas |
| Tempo medio de avaliacao | < 30s por conta |
| Feed atualiza em tempo real | < 2s de delay |
| Undo funciona | 100% dentro de 30min |
| False positive rate | < 10% (regras baseadas em media 7d) |

---

## DEPENDENCIAS

| Fase | Depende de |
|------|------------|
| Fase 1 | Migration SQL, refactor evaluate-performance-rules |
| Fase 2 | Fase 1 + dados de frequencia no sync |
| Fase 3 | Fase 2 + pg_cron habilitado no Supabase |
| Fase 4 | Fase 1 (fury_actions table) |
| Fase 5 | Fase 4 |

---

## DECISOES ARQUITETURAIS

1. **pg_cron > BullMQ** — Zero infra extra. BullMQ exige Redis + worker. pg_cron e nativo.
2. **Regras deterministicas > ML** — Validar hipoteses antes de investir em modelo. ML = Sprint 3.
3. **fury_actions > sync_history** — Tabela dedicada com undo, nao reuso de log generico.
4. **Edge Functions > Worker separado** — Manter stack unificada em Supabase/Deno.
5. **Avaliar media 7d > snapshot** — Reduz false positives drasticamente.
6. **Templates de regra > regras custom-only** — Onboarding rapido: ativar com 1 clique.
