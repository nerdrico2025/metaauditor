# Feature: Diagnosticos IA

## Status: Implementado

## Descricao

Modulo de analise profunda de criativos por IA. Permite varredura em lote (batch audit) de todos os criativos ativos, exibindo scores detalhados por framework de marketing, verificacao de regras, e acoes rapidas.

## Paginas

- `/diagnosticos` — Diagnosticos.tsx

## Hooks de Dados

- `useAudits()` — Lista de auditorias + funcao batchAudit + auditSingle
- `usePolicies()` — Politicas de compliance
- `useCreativeRuleCheck()` — Verificacao de regras
- `useCreativeRules()` — Lista de regras ativas
- `useCampaignAction()` — Acoes em campanhas (pausar, aumentar verba)

## Funcionalidades

1. **Varredura em lote** — Botao "Iniciar Varredura" dispara audit-batch para criativos **ativos** em campanhas **ativas** (integracoes monitoradas)
2. **Lista de auditorias** — Sidebar com historico, filtro por score
3. **Detalhe da auditoria** — Sheet lateral com:
   - Score geral (0-100)
   - Scores por framework: Hook, Value Prop, Persuasion, Visual, CTA, Social Proof, Urgency, Target
   - Pontos fortes e fracos
   - Gatilhos de persuasao encontrados/ausentes
   - Plano de acao (recomendacoes priorizadas)
4. **Verificacao de regras** — Accordion com regras ativas e status por criativo
5. **Acoes rapidas** — "Pausar Campanha" e "Aumentar Verba" dentro da analise

## Edge Functions Utilizadas

- `audit-batch` — Orquestra audit-creative + check-creative-rules em lote
- `audit-creative` — Analise individual (gpt-4o-mini, 2 agentes)
- `check-creative-rules` — Verificacao de regras (gpt-4o-mini)
- `meta-campaign-action` — Acoes na campanha

## Frameworks de Scoring

| Framework | Peso |
|-----------|------|
| Hook Power | 20% |
| Proposta de Valor | 20% |
| Mecanica de Persuasao | 15% |
| Qualidade Visual | 15% |
| CTA | 10% |
| Prova Social | 10% |
| Urgencia/Escassez | 5% |
| Alinhamento com Target | 5% |

## Decisoes de Design

- Batch audit limitado a 50 criativos por custo
- Scores < 50 = Critico (vermelho), 50-74 = Medio (amarelo), 75+ = Bom (verde)
- Deduplicacao de 6 horas em auditorias e verificacao de regras
- Sheet lateral para detalhe (nao pagina separada)

## ADDED (2026-06-01) — Plano B: Auditoria completa + Recomendacoes

### Persistencia `click_hero_recommendations`
- Tabela dedicada com RLS (`same_company` + `user_can_see_creative`)
- Populada automaticamente por `audit-creative` (plano de acao, violacoes perf/branding) e `recommend-account` (analise estrategica)
- Hook frontend: `useClickHeroRecommendations` — listar, marcar feita, dispensar
- UI: secao "Recomendacoes dos seus criativos" em `RecomendacoesView`

### `audit-creative` estendido
- Entrada: `rule_ids?`, `force_refresh?` (ignora cache 6h)
- Avaliacao server-side de `automation_rules` (metric_threshold) via `_shared/performance-eval.ts`
- Score unificado com `ai_analysis.score_breakdown` e `performance_rules_compliance`
- Agente marketing com `response_format: json_object` + campo `executive_summary`
- Falha de parse IA → status `pending`, nao aprova so por checks deterministicos

### UX CriativoDetalhe
- Componente `CreativeAuditReportDialog`: resumo compacto + botao "Relatorio Detalhado"
- Modal `max-w-2xl max-h-[min(90vh,800px)]`, mockup `aspect-video max-h-[360px]`
- Um unico botao de analise IA (superior); removido botao inferior duplicado
- Empty state discreto quando IA não retornou dados + reanalise com `force_refresh`

## ADDED (2026-05-31) — Auditoria IA por módulo (Performance vs Branding)

### Parâmetro `audit_focus`
- Valores: `performance` (default) | `branding`
- Coluna `audits.audit_focus` + índice `(creative_id, audit_focus, created_at DESC)`
- Registros legados tratados como `performance`
- `ai_analysis.audit_focus` espelhado para leitura defensiva no frontend

### Histórico dual
- Cada criativo pode ter **duas auditorias independentes**: última de performance e última de branding
- Deduplicação de 6h por `creative_id + company_id + audit_focus` (não bloqueia entre módulos)
- Frontend filtra histórico por módulo ativo (`ModuleContext`)

### Prompts e scoring por foco
| Foco | Checks | Score principal |
|------|--------|-----------------|
| Branding | Políticas (marca), `creative_rules`, agente visual de identidade | `compliance_score` |
| Performance | Políticas (entrega), `automation_rules`, métricas CTR/CPC/spend | `performance_score` |

- Prompts em `supabase/functions/audit-creative/prompts.ts`
- Stub determinístico (`parse_failed`) preenche apenas campos do foco ativo
- `audit-batch` repassa `audit_focus` (sync pós-integração usa `performance`)
- `persist-recommendations`: categorias `branding` vs `performance`/`creative` conforme foco

### UI
- `CreativeAuditReportDialog`: prop `auditFocus`, KPIs e blocos condicionais
- `AuditHistorySheet`: badge Performance/Branding + score via `primaryAuditScore`
- `RecomendacoesView`: oculta recs `category === 'branding'` (módulo performance)

### MODIFIED (2026-05-31) — UX Relatório de Auditoria IA

#### Resumo vs Detalhado
- **Resumo**: KPIs em PT-BR → Composição do score → Insights de marketing (se IA respondeu) → Problemas encontrados → Pontos fortes → Oportunidades → Veredito → Plano de ação (top 3)
- **Detalhado**: tudo do resumo + Scores por framework + Psicologia/persuasão + Arquitetura visual + Diagnóstico de performance/escala + Regras expandidas + Plano completo + Fontes (rodapé)

#### REMOVED
- Banners técnicos ("Veredito narrativo da IA indisponível", "relatório narrativo")
- Labels em inglês/abreviados ("Issues", "Perf. OK")

#### Componentes reutilizáveis
- `src/lib/audit-scores.ts` — helpers de score/cor/escala
- `AuditFrameworkGrid`, `AuditPersuasionSection`, `AuditVisualSection`, `AuditMarketingSummary`

#### Empty states
- Sem dados de IA: veredito neutro baseado em regras; relatório detalhado usa heurísticas determinísticas (sem jargão de API)

### MODIFIED (2026-05-31) — Relatório Detalhado client-facing

#### Conteúdo exclusivo da camada Detalhado
1. **Perfil do criativo** — preview, headline, texto, CTA, métricas (performance)
2. Problemas → Fortes → Oportunidades → Veredito (mesma ordem do resumo)
3. **Diagnóstico do copy** — checks de texto, headline, CTA e mídia
4. **Como melhorar este criativo** — ações priorizadas (alta/média/baixa) via `audit-improvements.ts`
5. Frameworks / persuasão / visual (quando IA retornou scores)
6. Regras expandidas + plano de ação complementar
7. **Fontes da análise (técnico)** — collapsible fechado por padrão no rodapé

#### Novos artefatos
- `src/lib/audit-improvements.ts` — `buildCopyChecks`, `buildImprovementActions`, `hasFrameworkScores`, `hasNarrativeData`
- `AuditCreativeProfile`, `AuditCopyDiagnosis`, `AuditImprovementPlan`

## Aceite

- [ ] Auditoria branding não exibe blocos de performance no relatório
- [ ] Auditoria performance não exibe blocos de branding no relatório
- [ ] Dedup 6h independente por `audit_focus`
- [ ] Histórico dual por criativo (performance + branding)
- [ ] Scores detalhados por framework exibidos corretamente
- [ ] Verificacao de regras roda em paralelo com auditoria
- [ ] Acoes rapidas (pausar/aumentar verba) funcionam
- [ ] Historico de auditorias acessivel
- [ ] Recomendacoes de auditoria aparecem em Recomendacoes Click Hero
- [ ] RecomendacoesView exige confirmar escopo antes de carregar recs de criativos
- [ ] Relatorio em duas camadas (resumo + detalhado) cabe no viewport
- [ ] Regras de performance entram no score e no relatorio backend
- [ ] Resumo segue ordem: Problemas → Fortes → Oportunidades → Veredito
- [ ] Detalhado inclui perfil do criativo, diagnóstico de copy e plano "Como melhorar"
- [ ] Detalhado inclui frameworks, persuasão, visual quando IA retornou scores
- [ ] Fontes da análise ficam colapsadas no rodapé (não são o conteúdo principal)
- [ ] Sem mensagens de "veredito narrativo" ou falha de API na UI

## ADDED (2026-06-02) — Auditoria por campanha e conjunto (performance)

- Edge: `_shared/entity-audit.ts`, `audit-campaign`, `audit-ad-set` (auth JWT, dedup 6h, `audit_focus=performance`)
- UI: `useEntityAudit`, `PerformanceEntityAuditDialog`, `SelectAnalysisScopeDialog`, `EntityPerformanceAuditCard`
- Histórico por entidade: query `entity-audit` por `campaign_id` / `ad_set_id` + `audit_level`
- Lista global em Diagnósticos (performance): criativos + campanhas + conjuntos via `useEntityAuditsHistory`

## ADDED (2026-06-02) — Histórico no sidebar Performance

- Sidebar Performance: item **Histórico** → `/diagnosticos` (entre Campanhas e Recomendações)
- Branding mantém Histórico → `/anuncios`
- `/diagnosticos` (módulo Performance): título **Histórico de Análises**, filtro Todos/Anúncios/Campanhas/Conjuntos, drawer unificado com badges de nível
- Clique em campanha/conjunto abre `PerformanceEntityAuditDialog`; criativo mantém UI detalhada existente
- Hook `useEntityAuditsHistory` + `dedupeLatestEntityAudits` em `audit-focus.ts`

## ADDED (2026-06-01) — Escopo: campanhas ativas

### Regra global de analise
- Fluxos de **analise** (batch, auditoria manual, compliance, automacoes pos-sync, edge functions de IA) consideram apenas criativos com `status = active` cuja **campanha pai** esta ativa (`active` / `ACTIVE`).
- **Listagens** (grid de Criativos, etc.) continuam exibindo todos os criativos sincronizados.
- Auditoria manual em criativo de campanha pausada: **bloqueada** no frontend (`CriativoDetalhe`) e no backend (`audit-creative`, `check-creative-rules` → HTTP 422).

### Helpers centralizados
- Frontend: `src/lib/creativeScope.ts` — `isActiveCampaignStatus`, `getActiveCampaignIds` / `getScopedCampaignIds`
- Backend: `supabase/functions/_shared/activeCampaignScope.ts` — mesma regra para edge functions

## MODIFIED (2026-06-01) — Conformidade de branding vs auditoria IA

### Dois fluxos distintos
| Fluxo | Fonte | Onde aparece |
|-------|--------|--------------|
| **Branding / regras** | `creative_rule_checks.overall_status` | Dashboard, Campanhas, Criativos, Anúncios |
| **Auditoria IA** | tabela `audits` | Sheet **Histórico de Auditoria IA** em Criativos |

### Filtro de conformidade antes da paginação
- Helper `src/lib/brandingComplianceFilter.ts` — `creativeIdsForComplianceStatus`, `countByComplianceStatus`
- `useCreatives` aceita `restrictToCreativeIds` — paginação sobre IDs de status (não filtra client-side após buscar os 24 mais recentes)
- `/anuncios` pills Reprovados/Aprovados/Pendentes com contagem; deep-link `?status=rejected`
- `/criativos?compliance=rejected|approved|pending` usa o mesmo mapa completo de `useBrandingCompliance`

### Mapa de compliance (`useBrandingCompliance`)
- Escopo alinhado à listagem: campanhas de integrações **monitoradas** via `loadMonitoredScope` (não só campanhas ativas)
- Checks carregados com `fetchAllPaginated` (evita limite ~1000 linhas do PostgREST)
- Fluxos de **análise** (batch, edge functions) continuam usando campanhas **ativas** — ver seção acima

### Histórico de auditoria IA
- Título: **Histórico de Auditoria IA** (não confundir com reprovados de branding)
- Empty state orienta para **Anúncios → Reprovados** (`/anuncios?status=rejected`)

### Candidatos de batch (`audit-batch`)
- `total_candidates` = criativos ativos em campanhas ativas de integracoes monitoradas
- IDs explicitos em `creative_ids` sao filtrados pelo mesmo escopo antes do processamento

### MODIFIED: Separação Branding vs Performance (2026-06-01)

- `useAudits(auditFocus?)`, `useRecentAudits`, `useIssuesWithHighPriority` filtram por `audit_focus` quando informado.
- Helpers em `src/lib/audit-focus.ts`: `moduleToAuditFocus`, `filterAuditsByFocus`, `dedupeLatestAudits` (chave `creative_id + audit_focus`).
- **Diagnósticos** (`/diagnosticos`): respeita `useModule()` — no Performance, histórico unificado (anúncio + campanha + conjunto); no Branding, criativos only; batch e scores isolados por foco; UI de performance (métricas, `automation_rules`, pausar/verba) só no módulo Performance; painel de regras de criativo só no módulo Branding.
- **AuditHistorySheet** e **Monitoramento**: histórico filtrado pelo módulo ativo.
- **audit-batch** skip recent: consulta recentes com `.eq('audit_focus', job.audit_focus)` — skips independentes entre módulos.
- `useBrandingCompliance` / `useComplianceSummary`: criativos escopados com `status=active` (alinhado a performance).

## MODIFIED (2026-06-02) — RecomendacoesView: escopo antes dos criativos

### Ordem e gating na UI (`/recomendacoes`)
1. **Selecionar escopo da análise** (Conta completa / Campanha) — sempre visível; Conta pré-selecionada visualmente
2. Botão **Continuar** — confirma escopo; habilitado quando Conta ou Campanha + campanha escolhida
3. **Recomendações de performance/branding dos criativos** — só renderiza e faz fetch após confirmação
4. **Gerar recomendações** — análise estratégica; só após escopo confirmado
5. Resultado estratégico + empty state tracejado (após confirmação, sem resultado ainda)

### Comportamento
- `useClickHeroRecommendations` aceita `{ enabled }` — fetch de `creative_audit` só com `scopeConfirmed && scopeReady`
- Trocar escopo ou campanha reseta `scopeConfirmed` e limpa resultado estratégico
- Modo **Campanha**: filtra recs persistidas por `campaign_id === campaignId` (recs legadas sem `campaign_id` não aparecem)
- Modo **Conta**: todas as recs do módulo (performance vs branding via `category`)

## MODIFIED (2026-06-01) — Histórico: lista na página + modal

### UX principal (`/diagnosticos`)
- **MODIFIED**: A lista de auditorias é o conteúdo principal da página (full-width), não um drawer lateral
- **MODIFIED**: Clique em criativo abre `CreativeAuditReportDialog` (resumo em cards + botão Relatório Detalhado)
- **MODIFIED**: Clique em campanha/conjunto (Performance) abre `PerformanceEntityAuditDialog`
- **MODIFIED**: Branding sidebar **Histórico** → `/diagnosticos`; item separado **Anúncios** → `/anuncios` (grid de conformidade)
- **MODIFIED**: `CreativeAuditReportDialog` resumo restaura cards narrativos (problemas, pontos fortes, veredito, plano top 3) além de regras violadas
- **ADDED**: Componente compartilhado `AuditHistoryList` — usado em `Diagnosticos.tsx` e `AuditHistorySheet`

### MODIFIED (2026-06-03) — Filtro Campanhas/Conjuntos no histórico (Performance)

- Escopo **Campanhas**: diagnósticos de entidade (`audit_level = campaign`) **e** análises de anúncios vinculados à campanha
- Escopo **Conjuntos**: diagnósticos de entidade (`audit_level = ad_set`) **e** análises de anúncios com `ad_set_id`
- Filtro secundário **Todas as campanhas** / campanha específica quando escopo = Campanhas (derivado dos audits carregados)
- Empty state contextual quando o filtro ativo retorna zero itens mas o histórico geral tem dados
- `useAudits`: join `ad_sets`, filtro explícito `audit_level = creative`, fallback `company_id` alinhado a `useEntityAuditsHistory`

### MODIFIED (2026-06-01) — Filtros protocolo + status no Histórico (Performance)

- Barra de filtros **sempre visível** no módulo Performance (inclui empty state sem histórico), abaixo do header — paridade visual com `/anuncios`
- Componente `PerformanceHistoryFilters`: escopo, campanha (quando Campanhas), busca por nome, pills de status
- Pills de status com contagem: **Todos · Aprovados · Reprovados · Pendentes** (`src/lib/auditHistoryFilters.ts`)
- Batch **Analisar Criativos Ativos** usa automaticamente a política padrão (`is_default`) sem escolha manual na UI
- Deduplicação backend (`audit-batch`, `audit-creative`) considera `policy_id` no skip recent / cache 6h — **requer deploy** das edge functions após merge

### REMOVED (2026-06-01) — Seletor de protocolo no histórico

- Select de protocolo/política no **header** de Diagnósticos (Branding e Performance)
- Select de protocolo em `PerformanceHistoryFilters`
- Filtro de histórico por `policy_id` e toast "Analisando com protocolo: …" no batch
- Gestão de políticas permanece em `/politicas`

### ADDED (2026-06-03) — Seleção obrigatória de regras antes de analisar

- Toda **análise manual** (Branding ou Performance) exige passagem pelo `SelectRuleDialog` antes de executar
- Variante **branding**: `creative_rules` via `useCreativeRules()`; envia `rule_ids` / `creative_rule_ids`
- Variante **performance**: `automation_rules` ativas via `useRules()`; envia `performance_rule_ids`
- Array vazio na confirmação = todas as regras ativas (comportamento existente do dialog)
- Pontos cobertos: IA em lote e diagnóstico expresso em **Criativos**; batch em **Diagnósticos**; lote Performance em **Campanhas/Conjuntos**; card `EntityPerformanceAuditCard`; botão principal em **CriativoDetalhe**
- Automações silenciosas (ex.: pós-sync em Integrações) **fora do escopo**

### MODIFIED (2026-06-03) — Batch jobs com rule ids

- Tabela `batch_audit_jobs`: colunas `creative_rule_ids uuid[]`, `performance_rule_ids uuid[]`
- `audit-batch` persiste e repassa ids para `audit-creative` e `check-creative-rules` no loop
- `audit-campaign` e `audit-ad-set` filtram `automation_rules` por `performance_rule_ids` quando informado
- Hooks `useAudits` e `useEntityAudit` propagam os parâmetros ao chamar edge functions

### ADDED (2026-06-03) — Detecção de logo na verificação de regras

- `check-creative-rules`: conteúdo multimodal rotulado (criativo vs logo de referência por regra) via `_shared/creativeImageForAI.buildLabeledVisionContent`
- Prompt distingue logo **presente** (mesmo pequeno/discreto) de logo **ausente**; falha de tamanho/posição usa severity `warning`, não mensagem de ausência
- `audit-creative/prompts.ts`: critérios alinhados no agente visual e Brand Guardian
- `CreativeAuditReportDialog`: filtra pontos fortes da IA que contradizem falha de logo nas regras
- Reanalise com `force: true` necessária para invalidar cache de 6h em checks antigos

### REMOVED
- Painel neural inline full-page como view padrão do histórico (preview + veredito + psicologia + arquitetura visual na página)
- Auto-seleção do primeiro audit na carga da página
- Drawer `historySheetPanel` redundante em Diagnósticos

