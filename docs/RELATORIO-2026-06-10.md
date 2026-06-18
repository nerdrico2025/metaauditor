# Relatório Executivo — Entregas Click Auditor (20/05 a 10/06/2026)

> Período: **20/05/2026 a 10/06/2026** · **14 commits** em `main` · Repositório: [seckerIA/clickhero-ads-analyzer](https://github.com/seckerIA/clickhero-ads-analyzer)  
> Versão resumida para e-mail: [RELATORIO-2026-06-10-EMAIL.md](RELATORIO-2026-06-10-EMAIL.md)

---

## Resumo executivo

Nos últimos ~3 semanas o produto evoluiu de um analisador de criativos para uma **plataforma dual Performance + Branding**, com auditoria IA em múltiplos níveis (criativo, campanha, conjunto), histórico unificado, gestão de equipe e melhorias de estabilidade para contas Meta grandes.

### Principais entregas de valor

| Área | O que mudou para o usuário |
|------|---------------------------|
| **Produto** | Dois módulos (Performance e Branding) com navegação, KPIs e histórico separados |
| **IA / Diagnósticos** | Auditoria por criativo, campanha e conjunto; seleção de regras antes de analisar; detecção de logo |
| **Branding** | Conformidade de regras, histórico de análises em `/anuncios`, relatórios client-facing |
| **Performance** | Histórico em `/diagnosticos`, filtros por campanha/status, recomendações priorizadas |
| **Equipe** | Convites por e-mail (Resend), limite de 15 contas monitoradas por empresa |
| **Estabilidade** | Sync Meta em fases, queries paginadas, índices RLS, correção de timeouts e erros 400 |
| **UX** | Layout responsivo, remoção de scores numéricos confusos, foco em status qualitativo |

---

## Linha do tempo

| Data | Entrega |
|------|---------|
| 20/05 | KPI "Cliques" no dashboard usa link clicks; remove abreviações confusas |
| 28/05 | Sync Meta dividido em fase entidades + fase métricas (evita timeout do worker) |
| 31/05 | Rebrand Click Auditor + módulos Performance/Branding (maior entrega do período) |
| 01/06 | Convites Resend + limite 15 contas + UX branding em criativos |
| 02/06 | Performance em contas grandes, layout responsivo, auditoria campanha/conjunto, segurança |
| 05/06 | Histórico restaurado na página Performance + filtros por campanha |
| 09/06 | Seleção obrigatória de regras + detecção de logo |
| 10/06 | Histórico Branding paridade Performance + correção métricas Campanhas |

---

## 1. Rebrand e arquitetura de produto (31/05)

**Commit:** `fc14e27` — maior entrega do período (~139 arquivos)

### Módulos Performance vs Branding

- Seletor de módulo no app (`ModuleContext`, `ModuleSelector`)
- Sidebar adaptativa: rotas e labels diferentes por módulo
- Auditoria IA com foco `performance` ou `branding` (coluna `audits.audit_focus`)
- Históricos e recomendações filtrados pelo módulo ativo

### Dashboard e KPIs

- Novo `KpiStrip` com métricas por módulo
- Aba Branding no dashboard com análise de conformidade
- Filtro de conta + deep links na visão Branding

### Relatórios de auditoria IA (client-facing)

- `CreativeAuditReportDialog`: resumo narrativo + relatório detalhado
- Seções: marketing, persuasão, visual, plano de ação, regras violadas
- Remoção gradual de scores numéricos na UI (foco em aprovado/reprovado/pendente)

### Branding operacional

- `BrandBriefingWizard`, overlay de conformidade, preview de mídia
- Batch de verificação de regras (`useBatchCreativeRuleCheck`)
- Upload de logo de referência por regra (`creative_rules.logo_url`)

### Recomendações Click Hero

- Tabela `click_hero_recommendations` + edge function `recommend-account`
- UI em `RecomendacoesView` com ações (marcar feita, dispensar)

### Equipe e convites

- Convite de membros via `invite-user` + e-mail Resend
- Senha inicial + associação à empresa existente
- Limite configurável de usuários por empresa (`team_max_users`)

### Infraestrutura de sync

- Tabela `sync_errors` + notificação `sync-error-notify` (cron horário)
- Migrations de logo, audit focus, recomendações

**Arquivos-chave:** `src/contexts/ModuleContext.tsx`, `src/components/audits/CreativeAuditReportDialog.tsx`, `src/pages/Dashboard.tsx`, `supabase/functions/audit-creative/`

---

## 2. Equipe, integrações e UX de criativos (01/06)

**Commits:** `7d9e543`, `1f51452`

- **Escopo campanhas ativas:** auditorias e batch limitados a criativos em campanhas ativas monitoradas
- **Assistente IA:** correções de escopo e comportamento
- **Convites Resend:** fluxo completo de onboarding de equipe
- **Limite 15 contas Meta** monitoradas por empresa (trigger no banco + UI em Integrações)
- **UX Branding em criativos:** cards, conformidade e navegação aprimorados

---

## 3. Performance e estabilidade (02/06)

**Commits:** `96b2e4c`, `4495844`, `3782cbe`, `1eb3502`, `60723f7`

### Performance técnica

- Índices RLS + deduplicação de queries React Query
- Paginação Supabase (`supabasePaginate.ts`) para contas com milhares de criativos
- `listMetrics.ts` centralizado — métricas de período consistentes em listagens
- Correção de erros HTTP 400 em contas Meta grandes

### Layout responsivo

- Grids adaptativos (`responsiveGrids.ts`, `CreativeGridCard`)
- Layout consciente da sidebar colapsada em todas as páginas principais

### Auditoria multi-nível (Performance)

- Novas edge functions: `audit-campaign`, `audit-ad-set`
- Tabela `entity_audits` + migration
- UI: `EntityPerformanceAuditCard`, `PerformanceEntityAuditDialog`, `SelectAnalysisScopeDialog`
- Botões de análise em Campanhas, Conjuntos e páginas de detalhe

### Recomendações com escopo

- `RecomendacoesView` exige seleção de escopo antes de listar criativos
- Recomendações vinculadas ao contexto (conta/campanha)

### Segurança

- Remoção de secrets hardcoded em scripts de migration e documentação

---

## 4. Histórico de diagnósticos — Performance (05/06)

**Commit:** `9f2a3e3`

- **Página `/diagnosticos` reescrita:** lista full-width como conteúdo principal (não mais drawer lateral)
- Componente compartilhado `AuditHistoryList`
- Filtros: escopo (Campanhas/Conjuntos/Criativos), campanha, busca, pills de status
- Clique abre modal de relatório (`CreativeAuditReportDialog` ou `PerformanceEntityAuditDialog`)
- Filtro de período respeitado no Branding (`brandingDateScope.ts`)
- Melhorias em `check-creative-rules` e pipeline de imagem para IA (`creativeImageForAI.ts`)
- Ajustes no sync Meta para suportar novos fluxos

---

## 5. Regras, logo e filtros avançados (09/06)

**Commit:** `053d87b`

### Seleção obrigatória de regras

- Toda análise manual passa por `SelectRuleDialog` antes de executar
- Branding: `creative_rules` | Performance: `automation_rules`
- Batch jobs persistem `creative_rule_ids` e `performance_rule_ids` na tabela `batch_audit_jobs`

### Detecção de logo

- `check-creative-rules` envia imagem do criativo + logo de referência (multimodal)
- Prompt distingue logo ausente vs. presente mas fora do padrão (warning)
- Filtro no relatório para não contradizer falhas de logo

### Filtros no histórico Performance

- Novo `PerformanceHistoryFilters`
- Filtro Campanhas inclui audits de entidade + criativos da campanha
- Integração em Campanhas, Conjuntos, Criativos, CriativoDetalhe

---

## 6. Histórico Branding + correção de métricas (10/06)

**Commit:** `c8bf43d` (último push para GitHub)

### Histórico Branding (`/anuncios`)

- Página reescrita com **paridade visual** ao histórico Performance
- Novo `BrandingHistoryFilters`: busca, campanha, pills de status
- Batch "Analisar Criativos Ativos" + painel de regras
- Badge Branding nos cards; sem valores em R$ no metadata
- Deep-link `?status=rejected|approved|pending` preservado
- Grid de conformidade removido do topo (conformidade continua em `/criativos`)

### Correção Campanhas

- **Impressões e cliques zerados:** corrigido para usar `campaign.metrics` (mesma fonte de gasto/CTR)
- Modo Branding: ordenação padrão "mais recentes"; orçamento diário oculto

### Limpeza de UI

- Remoção de scores numéricos remanescentes em modais e seções de auditoria
- `FormatBattleChart` usa CTR real em vez de score IA

---

## Métricas do período (engenharia)

| Métrica | Valor aproximado |
|---------|------------------|
| Commits em `main` | 14 |
| Período | 20/05 – 10/06/2026 |
| Maior commit | `fc14e27` (~12k linhas, rebrand completo) |
| Edge functions novas/alteradas | `audit-campaign`, `audit-ad-set`, `recommend-account`, `sync-error-notify`, `check-creative-rules`, `audit-batch`, `audit-creative` |
| Migrations novas | audit focus, entity audits, batch rule ids, sync errors, team limits, recommendations, logo upload |

---

## Pendências conhecidas

Itens que **não** estão 100% fechados ou dependem de ação externa:

1. **Push para `clickhero2026/clickauditor`** — bloqueado por permissão Git (conta `seckerIA` sem write access); código já está em `seckerIA/clickhero-ads-analyzer`
2. **Secrets de alerta de sync** — `sync-error-notify` deployado, mas precisa `ADMIN_ALERT_EMAIL` + `RESEND_API_KEY` (e opcionalmente Twilio/WhatsApp)
3. **Deploy das edge functions** — mudanças em `audit-batch`, `check-creative-rules` e entity audits exigem deploy no Supabase para produção refletir 100%
4. **Decisões de produto abertas:** cores do seletor de módulo, rota `/fury`, canal de alerta preferido, export PDF de recomendações

---

## Referências

- Specs atualizadas: `specs/features/diagnostics.md`, `specs/features/campaigns.md`, `specs/features/dashboard.md`, `specs/features/auth.md`, `specs/features/integrations.md`
- Relatórios anteriores: [RELATORIO-2026-05-29.md](RELATORIO-2026-05-29.md), [RELATORIO-2026-05-30.md](RELATORIO-2026-05-30.md)
- Plano de melhorias: [PLANO-MELHORIAS.md](PLANO-MELHORIAS.md)
