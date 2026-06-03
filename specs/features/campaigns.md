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
- Botao de auditoria individual

## CriativoDetalhe

- Preview de imagem/video em tamanho grande
- Metricas completas
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
- Deduplicacao: audit e rules check cacheia por 6h (verificacao manual em lote usa `force: true`)

## ADDED: Conformidade de Branding (overlay + batch)

- **`CreativeCompliancePreview`**: mockup com overlay vermelho/âmbar semitransparente e blur na imagem quando `rejected` ou `warning`; badge de regras violadas.
- **`ComplianceReportOverlay`**: tela fullscreen apos verificacao em lote na pagina Regras (modulo Branding), listando apenas criativos nao conformes.
- **`useBatchCreativeRuleCheck`**: verificacao sequencial com progresso, limite de 25 criativos, `force: true` para ignorar cache de 6h.
- **Regras (Branding)**: fluxo "Verificar Criativos com a IA" dispara batch automatico apos selecao de regras; overlay ao concluir se houver violacoes.
- **Criativos / CriativoDetalhe**: grid e preview grande mantem overlay de conformidade persistente apos analise.
- **`check-creative-rules`**: aceita `force`; inclui `logo_url` no prompt e payload multimodal para comparacao de logo.

## MODIFIED: Listagens em contas grandes (2026-06)

Contas com centenas de campanhas/conjuntos (ex.: Nio/Marina) nao devem carregar metricas aninhadas nem filtros `.in('campaign_id', [...])` com centenas de UUIDs.

- **Campanhas / Conjuntos**: listagem leve (sem embed de `campaign_metrics` / `ad_set_metrics`); metricas do periodo buscadas em query separada via `listMetrics.ts` (`fetchCampaignPeriodMetrics`, `fetchAdSetPeriodMetrics`) com chunking de IDs (`IN_FILTER_CHUNK = 150`).
- **Conjuntos**: escopo via join `ad_sets` + `campaigns!inner` filtrando `campaigns.integration_id` (elimina pre-busca de 683 campaign IDs).
- **Criativos / Anuncios (`useCreatives`)**: escopo por `campaigns.integration_id` quando nao ha `campaignId` especifico; paginacao server-side preservada.
- **Compliance hooks**: mesma estrategia de join por integracao; `companyId` com fallback `user?.company?.id ?? user?.company_id`.
- **UX**: `isError` + toast + botao "Tentar novamente" em Campanhas e Conjuntos (nao spinner eterno).

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
