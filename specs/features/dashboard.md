# Feature: Dashboard (Visao Geral)

## Status: Implementado

## Descricao

Pagina principal do app. Exibe metricas agregadas de todas as contas de anuncio do usuario, filtradas por periodo e conta. Possui duas abas: Performance e Branding.

## Paginas

- `/dashboard` — Dashboard.tsx

## Hooks de Dados

- `useCompanyMetrics(period, accountId, integrationIds)` — KPIs do periodo (spend, impressions, clicks, inline_link_clicks, CTR todos, CTR link, CPC, conversions, reach + reachIsApproximate, dailyData, topCampaigns, previousPeriod)
- `useCreativePerformance(period, accountId, integrationIds)` — Top criativos, format battle (video vs image)
- `useAccountHealth()` — Alertas de saude da conta
- `useComplianceSummary(integrationIds?)` — Resumo de conformidade (approved, warning, rejected, rules), escopado às integrações/campanhas do filtro global (mesmo padrão de `useBrandingCompliance`)
- `useCompanyIntegrations(companyId)` — Lista de integracoes para filtro de conta

## Filtros

| Filtro | Opcoes | Padrao |
|--------|--------|--------|
| Conta | Todas / conta especifica | Todas |
| Periodo | Ontem, 7d, 15d, 30d, 90d, custom | 30d |
| Aba | Performance / Branding | Performance |

## Aba Performance

1. **KPI Row** — 7 metricas em faixa unificada (gap-px grid):
   - Investido (trend invertido — queda e bom)
   - Impressoes
   - Cliques
   - Alcance (lido de account_period_reach para periodos preset; com tooltip "~" para custom ranges)
   - CTR (Todos) — todos os cliques / impressoes
   - CTR (Link) — inline_link_clicks / impressoes (padrao do Gerenciador Meta)
   - CPC Medio (trend invertido)
2. **Grafico de investimento diario** — AreaChart laranja
3. **Funil de conversao** — Barras horizontais (Impressoes → Cliques → Conversoes) com taxas
4. **Criativos campeoes** — Top 3 por conversoes, clicaveis
5. **Feedback do Click Auditor** — Analise automatica baseada nas metricas (rotulada como inteligencia do produto, nao "IA")

## Aba Branding

1. **Botão Análise de Branding** (header, só no módulo Branding) — dispara fluxo completo de conformidade
2. **KPI Row** — Analisados, Conformes, Nao conformes, Campanhas, Regras ativas
3. **Barra de conformidade** — Visual bar (verde/amarelo/vermelho)
4. **Campanhas ativas** — Lista clicavel com spend e resultados
5. **Saude da conta** — Score circular (0-100) com label (Boa/Regular/Critica)
6. **Regras** — Lista inline com contagem de violacoes

### MODIFIED: Filtro de conta + deep links na aba Branding (2026-06-01)

- `useComplianceSummary(effectiveIds)` — KPIs de conformidade consideram apenas criativos das campanhas ativas das integrações selecionadas no filtro global.
- **KPIs clicáveis** (`KpiStrip` com `onClick`):
  - Analisados → `/criativos`
  - Conformes → `/criativos?compliance=approved`
  - Não conformes → `/criativos?compliance=rejected`
  - Campanhas → `/campanhas`
  - Regras ativas → `/regras`
- Barra **Conformidade** → `/criativos` ou `/criativos?compliance=rejected` se houver reprovados/alertas.
- Linhas de regras violadas e criativos com problemas na saúde da conta → navegação para lista filtrada ou detalhe do criativo.
- `/criativos` lê `?compliance=approved|rejected|pending` para aplicar o filtro de status de branding na abertura.

### ADDED: Análise de Branding (2026-05-31)

Fluxo acionado pelo botão **Análise de Branding** no header (módulo Branding):

1. **BrandBriefingWizard** — se `ai_context.brand_briefing` incompleto (promessa + identidade visual + tom), wizard em 3 etapas salva em `companies.ai_context.brand_briefing`
2. **SelectRuleDialog** — escolha de regras ativas (vazio = todas)
3. **Batch paginado** — todos criativos `status=active` das integrações filtradas, via `check-creative-rules` (chunks internos de 25, progresso N/Total)
4. **ComplianceReportOverlay** — não conformes; toast se 100% conformes
5. Briefing editável depois em **Configurações → Contexto da IA** (seção Briefing de marca)

Hooks: `useBrandingAnalysis`, `useBatchCreativeRuleCheck.runPagedBatch`

Edge: `check-creative-rules` injeta `formatBrandBriefingForPrompt` + `formatAiContextForPrompt`

Pré-requisito: pelo menos uma regra de branding ativa em `/regras`

## Aviso de Sync

- Se dados tem 2+ dias sem sincronizar, exibe banner amarelo com botao "Sincronizar" que redireciona para /integracoes

## Decisoes de Design

- Elevação sutil (`shadow-elevated`, `Card variant="elevated"`) e motion com spring permitidos; sem glassmorphism pesado ou glows exagerados no dashboard
- KPIs em faixa unificada (gap-px) via componente `KpiStrip` — hover sutil, stagger de entrada, skeleton composicional
- Fonte de dados: `campaign_metrics` para periodo (NAO creatives — creatives tem lifetime totals)
- Alcance vem de `account_period_reach` (uma chamada Meta /insights?level=account por preset no sync). Custom range cai em lower-bound `Σ max(reach por campanha)` com flag `reachIsApproximate`.
- CTR (Link) usa `inline_link_clicks` (sincronizado nos 3 niveis de insight). CTR (Todos) usa `clicks` (todos os cliques no anuncio).
- Conversões deduplicam action_types via `countResults()` no sync — agrupados por categoria (lead/purchase/messaging/...) e contando o primeiro action_type matching de cada grupo, evitando o overcount 2-3x que vinha de `lead` + `offsite_conversion.fb_pixel_lead` etc.
- "Ontem" usa D-1 porque Meta nao tem dados do dia atual

### MODIFIED: DateFilterContext e calendário (2026-06-01)

- Ao trocar preset (7d, 30d, etc.), `setPreset` **limpa** `customRange` do state e do `localStorage` — evita range stale ao voltar para "Personalizado"
- Preset `custom` sem range salvo: seed dos últimos 30 dias terminando **ontem** (alinhado ao fallback do contexto)
- `DatePickerWithRange`: bloqueia seleção de **hoje e futuro** (`disabled: after yesterday`) — Meta não entrega dados do dia corrente
- Ao fechar popover sem "Aplicar", o rascunho do calendário reverte para o range aplicado
- Estilo `day_today` no calendário: borda sutil (não fundo sólido) — "hoje" deixa de parecer selecionado

### MODIFIED: Layout responsivo (2026-06-02)

- KPIs (`KpiStrip`) escalam `2 → 3 → 4 → N` colunas em `sm/lg/xl/2xl` — nunca `md:grid-cols-5+` (sidebar `w-72` reduz área útil).
- Labels/valores com `truncate` + `title`; padding `p-3 xl:p-4`.
- `AppLayout` main: `min-w-0 overflow-x-hidden`; `SectionHeader` actions com `flex-wrap`.
- Mapas centralizados em `src/lib/responsiveGrids.ts`.

### MODIFIED: KPIs Branding respeitam filtro de período (2026-06-01)

- No **Dashboard Branding**, `useComplianceSummary(..., dateFilterRange)` e `useBrandingCompliance(dateFilterRange)` contam apenas verificações com `checked_at` dentro do intervalo global (`DateFilterContext`).
- Dedup: último check **por criativo dentro do período** (helper `src/lib/brandingDateScope.ts`). Criativos sem check no intervalo não entram em `total_checked`.
- KPI **Analisados** exibe o label do período (ex.: "Últimos 7 dias") como subtítulo.
- Empty state quando `total_checked === 0`: mensagem contextual sugerindo ampliar o intervalo ou executar Análise de Branding.
- **Listagens** (`/campanhas`, `/conjuntos`, `/criativos`) continuam com `useBrandingCompliance()` **sem** `dateRange` — status acumulado (último check global).
- Persistência de range personalizado: `YYYY-MM-DD` no `localStorage` (evita shift de timezone do `toISOString()`).

### MODIFIED: Separação Branding vs Performance (2026-06-01)

- KPI **Campanhas** (módulo Branding): conta campanhas monitoradas no escopo (`useMonitoredCampaignScope`), sem spend/conversões de `useCompanyMetrics`.
- KPI **Regras ativas**: usa `activeRulesCount` de `useBrandingAnalysis` (não `top_violated_rules`).
- Seção **Campanhas monitoradas**: lista com badges `BrandingCounts` via `useBrandingCompliance().byCampaign` — sem métricas financeiras.
- Aba Performance permanece isolada em `usePerformanceCompliance`; hooks de branding filtram criativos `status=active`.

## Aceite

- [ ] Filtros de periodo retornam dados corretos do campaign_metrics
- [ ] Aba Performance mostra KPIs, grafico, funil, top criativos, Feedback do Click Auditor
- [ ] Aba Branding mostra conformidade, campanhas, saude, regras (dados mudam ao trocar filtro de conta **e** filtro de período no dashboard)
- [ ] KPIs de branding no dashboard são clicáveis e levam à tela correspondente
- [ ] Dashboard Branding não exibe spend/CTR/conversões nos KPIs principais nem na lista de campanhas
- [ ] Botão Análise de Branding executa wizard + batch + overlay de conformidade
- [ ] Aviso de sync aparece quando dados > 2 dias
- [ ] Light mode e dark mode igualmente funcionais
- [ ] Trocar preset 7d → 30d → Personalizado não restaura range antigo com "hoje" selecionado
- [ ] Calendário personalizado não permite selecionar hoje ou datas futuras
