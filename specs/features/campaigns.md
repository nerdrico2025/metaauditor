# Feature: Campanhas, Conjuntos e Criativos

## Status: Implementado

## Descricao

Modulo de navegacao pela hierarquia Meta Ads: Campanhas → Conjuntos (Ad Sets) → Criativos (Ads). Cada nivel mostra metricas e permite drill-down.

## Paginas

- `/campanhas` — Campanhas.tsx (lista de campanhas)
- `/campanhas/:id` — CampanhaDetalhe.tsx (detalhe com metricas + conjuntos)
- `/conjuntos` — Conjuntos.tsx (lista de ad sets)
- `/conjuntos/:id` — AdSetDetalhe.tsx (detalhe do ad set)
- `/criativos` — Criativos.tsx (grid de criativos)
- `/criativos/:id` — CriativoDetalhe.tsx (detalhe com preview + auditoria IA)

## Hooks de Dados

- `useCampaigns(companyId, integrationIds)` — Lista de campanhas com metricas
- `useCreatives(companyId, integrationIds)` — Lista de criativos com filtros
- `useAudits()` — Auditorias e funcao de executar audit
- `useCreativeRuleCheck()` — Verificacao de regras
- `useCampaignAction()` — Pausar/ativar campanhas e ajustar verba

## Campanhas (lista)

- Cards com: nome, status (badge), spend, impressions, clicks, CTR, CPC
- Filtros: busca por nome, filtro por status
- Click abre detalhe

## CampanhaDetalhe

- Metricas top: spend, impressions, clicks, CTR, CPC, conversions
- Lista de conjuntos dentro da campanha
- Painel de analise IA (chama audit-campaign Edge Function)
- Budget sidebar com progresso de gastos

## Criativos (grid)

- Grid de cards com preview de imagem/video
- Metricas: spend, impressions, clicks, CTR, conversions
- Filtros: busca, tipo (image/video), status
- **Default:** lista inicia filtrada por criativos **ativos** (`status=active`); toggle "Mostrar todos os criativos" remove o filtro
- Botao de auditoria individual

## CriativoDetalhe

- Preview estilo feed Meta (copy → midia → CTA) em `CreativeAdPreviewCard`; midia com `object-contain` sem scroll interno no card
- Preview de imagem/video em tamanho grande
- Metricas completas respeitando o filtro global de periodo (`DateFilterContext`): agregadas de `creative_metrics` via `fetchCreativePeriodMetrics`; card "Alcance Global" usa `reach` (nao impressoes)
- Sem linhas no periodo selecionado: se `creatives.*` (rolling 90d) tiver gasto/impressoes, exibe fallback com banner "Sem entrega no periodo selecionado"; se tudo zero e sync recente, banner "Sem entrega no periodo"; se sync > 24h e zero, banner "Metricas desatualizadas" + botao "Sincronizar agora" (admins)
- Fallback lifetime: colunas denormalizadas em `creatives.*` (rolling 90d espelhado pelo sync) quando `dateRange.isAll` ou quando periodo vazio mas lifetime > 0
- Auditoria IA com scores por framework (hook, value prop, persuasion, etc)
- Verificacao de regras customizaveis
- Botoes de acao: "Pausar Campanha" e "Aumentar Verba"
- Historico de auditorias

## Edge Functions Utilizadas

- `audit-creative` — Auditoria profunda com 2 agentes IA
- `check-creative-rules` — Verificacao contra regras customizaveis
- `audit-batch` — Auditoria em lote (max 50)
- `meta-campaign-action` — Pausar/ativar/update_budget

## Decisoes de Design

- Preview de criativos usa proxy de imagem (getProxiedImageUrl) para CORS
- Botoes "Pausar Campanha" e "Aumentar Verba" ficam na analise IA, nao no header
- Budget enviado em centavos para a Meta API
- Deduplicacao em lote: audit e rules check respeitam janela de 24h; reanalise individual ilimitada (ver `diagnostics.md`)

## ADDED: Conformidade de Branding (overlay + batch)

- **`CreativeCompliancePreview`**: mockup com overlay vermelho/âmbar semitransparente e blur na imagem quando `rejected` ou `warning`; badge de regras violadas.
- **`ComplianceReportOverlay`**: tela fullscreen apos verificacao em lote na pagina Regras (modulo Branding), listando apenas criativos nao conformes.
- **`useBatchCreativeRuleCheck`**: verificacao sequencial com progresso, limite de 25 criativos; lote respeita janela 24h, individual com `force: true` quando necessario
- **Regras (Branding)**: fluxo "Verificar Criativos com a IA" dispara batch automatico apos selecao de regras; overlay ao concluir se houver violacoes.
- **Criativos / CriativoDetalhe**: grid e preview grande mantem overlay de conformidade persistente apos analise.
- **`check-creative-rules`**: aceita `force`; inclui `logo_url` no prompt e payload multimodal para comparacao de logo.

## MODIFIED: Listagens em contas grandes (2026-06)

Contas com centenas de campanhas/conjuntos (ex.: Nio/Marina) nao devem carregar metricas aninhadas nem filtros `.in('campaign_id', [...])` com centenas de UUIDs.

- **Campanhas / Conjuntos**: listagem leve (sem embed de `campaign_metrics` / `ad_set_metrics`); metricas do periodo buscadas em query separada via `listMetrics.ts` (`fetchCampaignPeriodMetrics`, `fetchAdSetPeriodMetrics`) com chunking de IDs (`IN_FILTER_CHUNK = 150`).
- **Conjuntos**: escopo via join `ad_sets` + `campaigns!inner` filtrando `campaigns.integration_id` (elimina pre-busca de 683 campaign IDs).
- **Criativos / Anuncios (`useCreatives`)**: escopo por `campaigns.integration_id` quando nao ha `campaignId` especifico; paginacao server-side preservada.
- **Sync Meta (`sync-meta-data`)**: ad-level insights particionados por chunks de `campaign.id` (30 campanhas/chunk) para evitar truncamento de paginacao em contas grandes; resposta inclui `metrics_warnings` quando houver skips ou cap de paginas.
- **Sync Meta (2026-06)**: removido filtro `ad.effective_status IN [ACTIVE, PAUSED]` nos insights de anuncio — ads com `CAMPAIGN_PAUSED` / `ADSET_PAUSED` ainda recebem metricas historicas; warning quando N creatives locais nao retornam linhas de insights em 90d.
- **useCreatives**: com filtro de data, fallback para colunas denormalizadas quando `creative_metrics` vazio no periodo.
- **Compliance hooks**: mesma estrategia de join por integracao; `companyId` com fallback `user?.company?.id ?? user?.company_id`.
- **UX**: `isError` + toast + botao "Tentar novamente" em Campanhas e Conjuntos (nao spinner eterno).

## MODIFIED: Páginas de detalhe no módulo Branding (2026-06)

Quando `module === 'branding'`, as páginas de detalhe exibem apenas conformidade de branding e metadados criativos — sem KPIs financeiros, filtros de período de performance, auditoria de entidade de performance nem ações de orçamento.

- **Campanhas / Conjuntos (lista)**: cards exibem status + `BrandingCounts`; **sem** orçamento diário (`R$ / dia`) nem grid de KPIs (spend, CTR, impressões, etc.); ordenação padrão `recent` (não por gasto).
- **CampanhaDetalhe**: oculta `DateRangeFilter`, badge "Performance Ativa", grids de spend/CTR/CPC/CPA, sidebar de orçamento, `EntityPerformanceAuditCard` e menu "Calibrar Orçamento"; exibe `BrandingCounts` da campanha e conformidade por conjunto na lista.
- **AdSetDetalhe**: oculta `DateRangeFilter`, snapshot de métricas (impressões, CTR, investimento), nota sobre filtro de datas, `EntityPerformanceAuditCard`, sidebar "Parâmetros Financeiros" e "Calibrar Orçamento"; exibe `BrandingCounts` do conjunto; lista de criativos mostra status de branding (aprovado/reprovado) em vez de CTR e custo.
- **CriativoDetalhe**: oculta banners de sync/período, grid de métricas, investimento total, CPA; substitui CPA por conformidade de branding; oculta botões "Aumentar verba" e dialog de orçamento no relatório IA; queries de métricas de período desabilitadas em branding.

## MODIFIED: Layout responsivo (2026-06-02)

- **Criativos**: grid `CreativeGridCard` com overlays proporcionais; ações em menu compacto `<lg` e hover em desktop; KPIs topo via `statsGridCols`.
- **Campanhas / Conjuntos**: rows empilham em `<xl`; métricas inline `grid-cols-2 md:grid-cols-3 xl:grid-cols-6` com `min-w-0` (sem coluna fixa 650px).
- **Anúncios / Diagnósticos / Detalhe campanha**: grids alinhados a `responsiveGrids.ts`.
- Regra: breakpoints consideram sidebar aberta (~288px) — colunas densas só a partir de `xl`.

## Aceite

- [ ] Lista de campanhas filtra por integracoes monitoradas
- [ ] Drill-down Campanha → Conjuntos → Criativos funciona
- [ ] Auditoria IA retorna scores e recomendacoes
- [ ] Botoes Pausar/Aumentar Verba executam acoes reais via Meta API
- [ ] Verificacao de regras funciona em paralelo com auditoria

## ADDED (2026-06-02) — Análise de performance multi-nível

### Níveis
| Nível | Edge function | `audit_level` | UI |
|-------|---------------|---------------|-----|
| Campanha | `audit-campaign` | `campaign` | Campanhas (performance), CampanhaDetalhe |
| Conjunto | `audit-ad-set` | `ad_set` | Conjuntos (performance), AdSetDetalhe |
| Criativo | `audit-creative` | `creative` | Criativos / CriativoDetalhe (existente) |

### Schema `audits`
- Colunas: `audit_level`, `campaign_id`, `ad_set_id`; `creative_id` nullable para entidades
- CHECK coerente por nível; RLS por `user_owns_campaign` / `user_can_see_ad_set`

### Batch performance (Campanhas / Conjuntos)
- Seleção múltipla no módulo performance
- `SelectAnalysisScopeDialog`: analisar entidades | criativos filhos | ambos
- Criativos: `audit-batch` com filtro `campaign_id` ou `ad_set_id`

### Regras
- Entidade: métricas **agregadas** do período (`DateFilterContext`) + rollup de violações por criativo filho
- Sem reintroduzir `applies_to=campaign` na UI de Regras
