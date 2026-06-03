# Plano de Implementação — Briefing Click Auditor (25/05/2026)

> **Documento mestre cross-session.** Para continuar em outra sessão, peça ao Claude: _"Continue o plano em `docs/PLANO-MELHORIAS.md` na Fase X"_.

## Status das Fases
- [x] **Fase A** — Fundação: Módulos Branding/Performance + Menu Dinâmico _(2026-05-29 — typecheck OK)_
- [x] **Fase B** — Módulo Branding (telas + regras) _(2026-05-29 — typecheck OK)_
  - [x] B1 — Hook `useBrandingCompliance` + componente `BrandingCounts`. Campanhas/Conjuntos modo branding: multi-select com checkbox, contadores aprovado/reprovado/pendente em vez de métricas financeiras, action bar com "Analisar em lote" via SelectRuleDialog + queue de CreativeRuleCheckModal
  - [x] B2 — Criativos modo branding: KPIs do topo trocam Volume Geral/Investimento por Aprovados/Reprovados; filtro de status (aprovado/reprovado/pendente/todos); cards com badge verde/vermelho substituindo score IA; botão "Diagnóstico IA" escondido; "Sincronizar Meta" escondido (Fase D); colunas financeiras da lista trocadas por badge de status
  - [x] B3 — Busca simplificada em Criativos
  - [x] B4 — Regras: removidos campos tom de voz e limite de caracteres; upload de logo; Fury escondido (rota admin-only); regras filtradas por módulo
  - [x] B5 — SelectRuleDialog (`src/components/branding/SelectRuleDialog.tsx`) integrado em Regras.tsx, Criativos.tsx, Campanhas.tsx, Conjuntos.tsx
  - ~~**Pendência operacional**: aplicar migration `20260529_creative_rules_logo_upload.sql`~~ ✅ **APLICADA EM PROD 2026-05-30** (coluna `logo_url` + bucket `rule-assets` + policies confirmados).
  - **Sub-item adiado**: filtro "por Regra específica" na tela de Criativos do briefing #5 — requer querying creative_rule_checks por rule_id; não implementado. Filtro por Status entrega o caso principal.
- [x] **Fase C** — Módulo Performance (filtro branding + Recomendações Click Hero) _(2026-05-29 — typecheck OK)_
  - [x] C1 — Filtro "Status de Branding" em Campanhas / Conjuntos / Criativos (modo performance). Tag visual verde/vermelha por linha. ~~Default = "Aprovados"~~ → **Default mudado para "Todos" em 2026-05-30**: o default "Aprovados" escondia toda campanha/conjunto ainda não auditado, deixando a tela principal vazia ("NENHUMA CAMPANHA ENCONTRADA"). Verificado no browser e corrigido nas 3 telas.
  - [x] C2 — Rota `/recomendacoes` registrada como alias de `/diagnosticos`; sidebar atualizado; título da página adapta via `useLocation`.
  - [x] C3 — Edge function `recommend-account` (escopo `account` ou `campaign`); hook `useAccountRecommendation`; componente `RecomendacoesView` renderizado quando o usuário entra em `/recomendacoes`. Prompt injeta contexto da empresa + métricas de 30d + top campanhas + compliance + regras mais violadas.
  - [x] **MODIFIED 2026-05-31** — `recommendation_focus` (`performance` | `branding`) via `ModuleContext`: prompts, snapshots e filtros de UI separados por módulo; UX do seletor de escopo com badge e copy explícita.
  - ~~**Pendência operacional**: deploy de `recommend-account` + setar `OPENAI_API_KEY`~~ ✅ **FEITO EM PROD 2026-05-30** (function version 1 ACTIVE; `OPENAI_API_KEY` já existia como secret).
- [x] **Fase D** — Automação: Cron + admin-only sync _(2026-05-29 — typecheck OK)_
  - [x] D1 — Cron `sync-meta-hourly` (a cada 3h) já existia em [`20260506_sync_meta_cron.sql`](../supabase/migrations/20260506_sync_meta_cron.sql). Mantido.
  - [x] D2 — Botão "Sincronizar Meta" agora exige `role in ('company_admin', 'super_admin')` em Integracoes.tsx e Criativos.tsx. Banner "Dados desatualizados" no Dashboard também escondido para não-admin.
  - [x] D3 — Tabela `sync_errors` (migration [`20260529_sync_errors.sql`](../supabase/migrations/20260529_sync_errors.sql)) + `sync-meta-data` agora loga falhas + edge function `sync-error-notify` envia alerta via Resend (email) e/ou Twilio (WhatsApp).
  - **Pendências operacionais** _(atualizado 2026-05-30)_:
    - ~~aplicar `20260529_sync_errors.sql`~~ ✅ **APLICADA EM PROD** (corrigido bug: `public.profiles` → `public.users` + `auth.uid()::text` — a tabela `profiles` não existe neste projeto).
    - ~~deploy de `sync-error-notify`~~ ✅ **DEPLOYADA** (version 1 ACTIVE; smoke test 200 `{sent:0}`).
    - ~~agendar no `pg_cron`~~ ✅ **AGENDADO** via `20260530_sync_error_notify_cron.sql` (`sync-error-alerts`, `15 * * * *`, active).
    - ⏳ **PENDENTE (precisa dos valores)**: setar secrets `ADMIN_ALERT_EMAIL` + `RESEND_API_KEY` (email) e/ou `ADMIN_ALERT_WHATSAPP` + `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM` (WhatsApp). Até lá o worker faz no-op.
- [x] **Fase E** — Histórico de Anúncios _(2026-05-29 — typecheck OK)_
  - [x] E1 — Item de menu renomeado (i18n `creatives` agora = "Anúncios"); adicionado item "Histórico" no menu Branding.
  - [x] E2 — Nova página `/anuncios` ([Anuncios.tsx](../src/pages/Anuncios.tsx)) com filtros Campanha + Regra + Status (aprovado/reprovado/pendente/todos) + busca por nome. Grid visual-first. Distinção: fluxo Campanha → Conjunto → Criativo permanece (auditoria); `/anuncios` é consulta livre.

> Ao concluir uma fase, marcar `[x]` e anotar o commit: `[x] Fase A concluída — commit abc1234`.

---

## Contexto

Rafael Cruz e Denilson (Click Hero) entregaram um briefing com 12 pontos de melhoria para o ClickHero Ads Analyzer, organizados em 7 partes. O objetivo central é **separar o app em dois módulos independentes (Branding e Performance)** refletindo a divisão da equipe da Nio (cliente), remover ruído de métricas financeiras das telas de branding, automatizar a sincronização Meta e reposicionar o diagnóstico de IA como "Recomendações Click Hero" a nível de conta/campanha.

Hoje o app já tem **abas** Branding/Performance no Dashboard, mas a navegação é flat — todos os itens do menu lateral aparecem sempre. As telas de Campanhas/Conjuntos/Criativos misturam métricas financeiras com sinais de compliance. Não existe cron de sync. O Fury aparece explicitamente. Este plano organiza a entrega em **5 fases por dependência técnica**.

**Briefing original**: [public/Click Auditor - Briefing Felipe.docx](../public/Click%20Auditor%20-%20Briefing%20Felipe.docx)

---

## Estado atual relevante (mapa rápido)

- **Menu**: [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx) — array `menuGroups` hardcoded, sem contexto de módulo.
- **Dashboard**: [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx) — já tem abas `'performance' | 'branding'` (estado local).
- **Telas Ads**: `Campanhas.tsx`, `Conjuntos.tsx`, `Criativos.tsx`, `CampanhaDetalhe.tsx`, `AdSetDetalhe.tsx`, `CriativoDetalhe.tsx` — todas exibem métricas financeiras.
- **Regras**: [src/pages/Regras.tsx](../src/pages/Regras.tsx) — tela única; campos incluem tom de voz/limite de caracteres; Fury é página separada (`/fury`).
- **Diagnósticos**: [src/pages/Diagnosticos.tsx](../src/pages/Diagnosticos.tsx) — atua a nível de criativo (batch audit, 50 max), edge functions `audit-batch`, `audit-creative`.
- **Sync Meta**: botão em [src/pages/Integracoes.tsx](../src/pages/Integracoes.tsx); edge function `supabase/functions/sync-meta-data`; sem cron.
- **Tabelas chave**: `campaigns`, `ad_sets`, `creatives`, `creative_rules`, `audits`, `*_metrics`.

---

## Fase A — Fundação: Módulos Branding/Performance + Menu Dinâmico
**Cobre Briefing #1, #2** · Dependência: nenhuma · É pré-requisito de todas as demais fases.

### Entregas
1. **Seletor de módulo no Dashboard** (pós-login). Manter dashboard geral existente; adicionar dois cards/botões grandes: "Branding" e "Performance". Selecionar persiste em `localStorage` + Context.
2. **Contexto global `ModuleContext`** (`src/contexts/ModuleContext.tsx`): `module: 'branding' | 'performance' | null`, `setModule()`, hook `useModule()`.
3. **Menu lateral dinâmico** (`src/components/layout/Sidebar.tsx`): refatorar `menuGroups` para função `getMenuGroups(module)`:
   - `branding`: Dashboard, Regras de Branding, Campanhas, Anúncios (histórico), Configurações.
   - `performance`: Dashboard, Regras de Performance, Campanhas, Recomendações Click Hero, Configurações.
   - Sem módulo: visão geral (estado atual reduzido).
4. **Header**: badge "Modo: Branding/Performance" + botão "Trocar módulo".
5. **Route guard leve**: rotas exclusivas de um módulo redirecionam para o seletor se o módulo errado estiver ativo.

### Arquivos principais
- Novo: `src/contexts/ModuleContext.tsx`, `src/components/dashboard/ModuleSelector.tsx`.
- Editar: `src/App.tsx` (wrap com Provider), `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/pages/Dashboard.tsx`.

---

## Fase B — Módulo Branding (telas e regras)
**Cobre Briefing #3, #4, #5, #6, #7, #8** · Depende de Fase A.

### B1. Variante "Branding" das telas de listagem
Criar prop `mode?: 'branding' | 'performance'` (default `performance` para não quebrar) em:
- `Campanhas.tsx`, `Conjuntos.tsx`, `Criativos.tsx`.

Em modo branding:
- **Remover colunas/cards**: gasto, impressões, cliques, conversões, CTR, CPA, CPC, score percentual.
- **Manter/adicionar**: nome, total de criativos, total aprovados (badge verde), total reprovados (badge vermelho).
- **Multi-seleção**: checkbox por linha + ação "Analisar em lote" (já existe parcialmente em `Criativos.tsx`, expandir para campanhas/conjuntos).
- **Fluxo travado**: em modo branding, link de criativo só acessível via Campanha → Conjunto → Criativo. Tela `Criativos.tsx` direta vira **Anúncios (Histórico)** — ver Fase E.

### B2. Tela de Criativos (Branding) — visual-first
- Grid grande priorizando preview de imagem/vídeo (já tem grid toggle; tornar default no modo branding).
- Header da tela: contadores (total, vídeos, estáticos, aprovados, reprovados).
- Remover volume/investimento/percentual.
- Filtros: por **Regra** (dropdown alimentado por `creative_rules`) + por **Status** (aprovado / reprovado / pendente / todos).
- Sinal verde/vermelho por card.

### B3. Busca simplificada
- Campo único "Localizar criativo por nome".
- Remover busca por ID e por campanha em modo branding.

### B4. Tela de Regras — ajustes
- Filtrar `creative_rules` por `module = 'branding'` quando contexto for branding (adicionar coluna `module` se ainda não existir — migration).
- **Adicionar**: upload de logotipo (campo file → Supabase Storage bucket `rule-assets`, salvar URL em `creative_rules.logo_url`).
- **Remover campos da UI**: tom de voz, limite de caracteres.
- **Esconder Fury**: remover item de menu, remover qualquer label visível ("powered by Fury", etc). Página `/fury` pode permanecer acessível só para admin via rota direta — confirmar com Rafael se mantém ou deleta.

### B5. Seleção de regra antes da análise
- Antes de disparar `audit-batch` / `audit-creative`, abrir modal `SelectRuleDialog` com a lista de regras do módulo atual.
- Passar `rule_ids: string[]` na payload das edge functions.
- Edge functions (`audit-batch`, `audit-creative`, `check-creative-rules`): aceitar filtro `rule_ids` opcional; quando ausente, aplicar todas (compat).

### Arquivos principais
- Editar: `src/pages/Campanhas.tsx`, `Conjuntos.tsx`, `Criativos.tsx`, `Regras.tsx`.
- Novo: `src/components/branding/SelectRuleDialog.tsx`, `src/components/branding/BrandingBadge.tsx`.
- Migration: `supabase/migrations/<timestamp>_rules_module_and_logo.sql` (colunas `module text`, `logo_url text`).
- Edge functions: `supabase/functions/audit-batch/index.ts`, `audit-creative/index.ts`, `check-creative-rules/index.ts`.

---

## Fase C — Módulo Performance (filtro de branding + Recomendações)
**Cobre Briefing #9, #12** · Depende de Fase A e B (precisa do status branding pronto).

### C1. Filtro de status de branding nas telas Performance
- Em `Campanhas.tsx`, `Conjuntos.tsx`, `Criativos.tsx` modo performance:
  - Adicionar filtro **"Status de Branding"**: `aprovados` (default) | `todos` | `reprovados`.
  - Tag visual (verde/vermelho) por linha mostrando status agregado de branding.
- Padronizar cores e fontes do bloco de filtros (briefing comentou desproporção). Usar `Select` shadcn + `text-sm` consistente.

### C2. Renomear "Diagnóstico de IA" → "Recomendações Click Hero"
- Renomear rota `/diagnosticos` → `/recomendacoes` (manter redirect 6 meses).
- Renomear arquivo: `src/pages/Diagnosticos.tsx` → `Recomendacoes.tsx`.
- Mover item de menu para módulo **Performance** apenas.
- Reescopar análise: **conta inteira** ou **campanha** (não criativo individual).
  - Novo seletor no topo: "Analisar conta completa" | "Analisar campanha [X]".
  - Nova edge function `recommend-account` (ou parâmetro `scope: 'account'|'campaign'` em `audit-batch`).
- Output: recomendações estratégicas (textuais + acionáveis) — não scores por criativo.

### C3. Personalização da IA
- Tabela `ai_account_context` (já parcial via "AI context onboarding" no Dashboard) — garantir que `recommend-account` injete: histórico de auditoria, contexto da conta, regras aplicadas, métricas dos últimos 30d.
- System prompt enfatiza "voz Click Hero" (não respostas genéricas estilo ChatGPT).

### Arquivos principais
- Editar: `Campanhas.tsx`, `Conjuntos.tsx`, `Criativos.tsx`, `App.tsx` (rota).
- Renomear: `Diagnosticos.tsx` → `Recomendacoes.tsx`.
- Novo: `supabase/functions/recommend-account/index.ts`.
- Atualizar: `specs/features/diagnostics.md` → renomear/atualizar como `recomendacoes.md`.

---

## Fase D — Automação: Cron de Sincronização
**Cobre Briefing #10** · Independente de A/B/C; pode rodar em paralelo.

### Entregas
1. **Edge function `sync-meta-cron`**: itera todas as integrações ativas, chama `sync-meta-data` com flag `incremental: true` (só busca dias faltantes desde `last_synced_at`).
2. **Agendamento**: `supabase/config.toml` → cron `0 4 * * *` UTC (01:00 BRT). Alternativa: `pg_cron` via migration.
3. **Remover botão "Sincronizar Meta"** de `Integracoes.tsx` para usuários comuns.
4. **Botão admin-only**: visível apenas se `user.role === 'admin'`, em seção "Configurações avançadas".
5. **Notificação de falha**:
   - Tabela `sync_errors` (timestamp, integration_id, error).
   - Edge function envia e-mail (Resend) ou WhatsApp (Twilio) para Rafael Cruz quando `error_count >= 1` em um run.
   - Variável de ambiente `ADMIN_ALERT_EMAIL`, `ADMIN_ALERT_WHATSAPP`.

### Arquivos principais
- Novo: `supabase/functions/sync-meta-cron/index.ts`.
- Editar: `supabase/functions/sync-meta-data/index.ts` (flag `incremental`).
- Editar: `src/pages/Integracoes.tsx`, `src/pages/Settings.tsx` (mover botão).
- Migration: `supabase/migrations/<ts>_sync_errors_and_cron.sql`.

---

## Fase E — Histórico de Anúncios
**Cobre Briefing #11** · Depende de Fase B (precisa do status de branding por criativo).

### Entregas
1. **Renomear item de menu** "Criativos" → "Anúncios" (em ambos os módulos).
2. **Página `Anuncios.tsx`** (pode reaproveitar `Criativos.tsx` atual em modo "histórico"):
   - Acesso direto pelo sidebar — sem precisar de campanha/conjunto.
   - Filtros: Campanha, Regra, Status (aprovado/reprovado/pendente/todos), busca por nome.
   - Lista todos os criativos já analisados.
3. **Distinção clara**:
   - Fluxo de análise = Campanha → Conjunto → Anúncio (mantém em modo branding, Fase B).
   - Consulta histórica = `/anuncios` direto (esta fase).

### Arquivos principais
- Renomear/copiar: `src/pages/Criativos.tsx` → `Anuncios.tsx` (ou refatorar com prop `variant: 'flow'|'history'`).
- Editar: `src/App.tsx`, `Sidebar.tsx`.

---

## Verificação (fase a fase)

**Após cada fase**:
1. `npm run typecheck && npm run lint` (sem warnings novos).
2. Subir `npm run dev`, logar, validar fluxo principal da fase no browser.
3. Conferir auto-revisão de 3 passadas (CLAUDE.md): tipagem, feedback UI/toasts, empty states + invalidação de cache.

**Verificações específicas**:
- **Fase A**: trocar módulo no header re-renderiza sidebar sem reload; refresh mantém escolha.
- **Fase B**: rodar audit em lote com 1 regra selecionada → confirmar que só essa regra dispara no banco; nenhum valor financeiro visível em telas branding.
- **Fase C**: filtro "Apenas reprovados" em Performance só lista anúncios com `branding_status='reprovado'`; rota `/recomendacoes` retorna recomendações de conta.
- **Fase D**: invocar `sync-meta-cron` manualmente via `supabase functions invoke` — confirmar idempotência (rodar 2x não duplica dados); forçar erro e validar alerta.
- **Fase E**: `/anuncios` acessível sem passar por campanha; filtros combinados funcionam.

---

## Pontos para confirmar com Rafael/Denilson antes de cada fase
- **Fase A**: copy exato dos cards "Branding/Performance" e ícones.
- **Fase B**: deletar página `/fury` completamente ou manter como rota oculta admin?
- **Fase D**: canal preferido do alerta (e-mail ou WhatsApp); se WhatsApp, conta Twilio ou WhatsApp Cloud API?
- **Fase C**: textura/estilo das "Recomendações Click Hero" — formato (lista priorizada? cards? PDF exportável?).
