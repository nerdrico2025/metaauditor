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
- Deduplicacao temporal de **24 horas** apenas em fluxos de **lote**; reanalise **individual** sem limite temporal (cache por fingerprint permanece)
- Sheet lateral para detalhe (nao pagina separada)

## ADDED (2026-06-01) — Plano B: Auditoria completa + Recomendacoes

### Persistencia `click_hero_recommendations`
- Tabela dedicada com RLS (`same_company` + `user_can_see_creative`)
- Populada automaticamente por `audit-creative` (plano de acao, violacoes perf/branding) e `recommend-account` (analise estrategica)
- Hook frontend: `useClickHeroRecommendations` — listar, marcar feita, dispensar
- UI: secao "Recomendacoes dos seus criativos" em `RecomendacoesView`

### `audit-creative` estendido
- Entrada: `rule_ids?`, `force_refresh?` (ignora cache por fingerprint)
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
- Reanalise **individual**: sem bloqueio por janela temporal (6h/24h)
- Reanalise em **lote**: deduplicacao de **24h** por `creative_id + company_id + audit_focus + policy_id` (nao bloqueia entre modulos)
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
- [ ] Dedup 24h em lote independente por `audit_focus`; individual sem limite temporal
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

- Edge: `_shared/entity-audit.ts`, `audit-campaign`, `audit-ad-set` (auth JWT, reanalise individual sempre completa, `audit_focus=performance`)
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
- **Listagens** (`/criativos`): default **apenas criativos ativos**; usuario pode alternar para ver todos os sincronizados via toggle na pagina.
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
- Empty state orienta para **Histórico → Reprovados** (`/anuncios?status=rejected`)

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
- **MODIFIED**: Branding sidebar **Histórico** → `/diagnosticos`; item separado **Anúncios** → `/anuncios` (grid de conformidade) *(substituído em 2026-06-10 — ver abaixo)*
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
- Deduplicacao backend (`audit-batch`, batch client-side Criativos) considera `policy_id` na janela **24h** — **requer deploy** das edge functions apos merge

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
- `CreativeAuditReportDialog`: filtra pontos fortes da IA que contradizem falha de logo nas regras *(ampliado em 2026-06-12 — ver seção Coerência logo)*
- Reanalise com `force: true` invalida cache por fingerprint em checks antigos

### MODIFIED (2026-06-12) — Coerência logo no relatório

- `src/lib/auditCoherence.ts`: classificação do status do logo (`ok`, `present_with_issues`, `absent`, `unknown`), filtro de pontos fortes conflitantes e deduplicação entre regras violadas e problemas
- `CreativeAuditReportDialog` (resumo Branding): banner **Status do logo** (verde / âmbar / vermelho) antes das regras violadas
- Filtro de pontos fortes ampliado: remove elogios à logo para **qualquer** falha de regra de logo (não só ausência)
- Problemas encontrados no resumo Branding: não duplica itens já listados em regras violadas (`dedupeRuleProblems`); falhas de regras de branding ficam apenas em **Regras de branding violadas**
- `audit-creative/prompts.ts`: reforço no Brand Guardian — presente com ressalva não entra em `strengths`

### MODIFIED (2026-06-10) — Histórico unificado (Branding)

- Sidebar Branding: único item **Histórico** → `/anuncios`; removido item `/diagnosticos` no Branding
- `/diagnosticos` no módulo Branding redireciona para `/anuncios` (Performance mantém `/diagnosticos`)
- **KEPT**: Campanhas > Anúncios → `/criativos`; Performance Histórico → `/diagnosticos`

### MODIFIED (2026-06-10) — Histórico Branding paridade Performance

- `/anuncios`: layout lista-only (paridade com `/diagnosticos` Performance) — título **Histórico de Análises**, busca, filtro por campanha, pills de status com contagem, cards horizontais via `AuditHistoryList`
- Removido grid de conformidade no topo; deep-link `?status=rejected|approved|pending` filtra status da auditoria IA (não compliance de regras)
- Batch **Analisar Criativos Ativos** + painel de regras de criativo no header da página; badge **Branding** nos cards; sem valor em R$ no metadata
- Conformidade por regra continua em `/criativos?compliance=…` e demais telas com `useBrandingCompliance`

### REMOVED (2026-06-01) — Scores numéricos de auditoria IA na UI

- Exibição de scores 0–100 em relatórios, criativo (`CriativoDetalhe`), modais (`CreativeRuleCheckModal`, `CreativeAuditReportDialog`, `PerformanceEntityAuditDialog`, `AiDiagnosisModal`), seções do relatório (`AuditMarketingSummary`, `AuditVisualSection`, `AuditPersuasionSection`), cards de entidade, **Monitoramento** e **FormatBattleChart** (substituído por CTR real)
- Header "Score X%", bloco "Composição do score", grid de frameworks numéricos (`AuditFrameworkGrid` no dialog), barras de progresso por dimensão
- Ordenação do histórico em Diagnósticos por `primaryAuditScore` — fallback para `created_at` desc (Performance mantém desempate por spend quando aplicável)
- **Mantido**: status qualitativo (`approved` / `rejected` / `warning` / `pending`), contagem de regras pass/fail, problemas, pontos fortes, veredito narrativo; persistência de scores no Supabase e edge functions inalteradas
- **Fora de escopo**: métricas reais de ads (CTR, CPA, spend); círculo "Saúde da conta" no Dashboard

### REMOVED
- Painel neural inline full-page como view padrão do histórico (preview + veredito + psicologia + arquitetura visual na página)
- Auto-seleção do primeiro audit na carga da página
- Drawer `historySheetPanel` redundante em Diagnósticos

## ADDED (2026-06-04) — Cache incremental por regra

### Tabela `creative_rule_evaluations`
- Chave lógica `(creative_id, rule_id, rule_kind)` com `rule_kind` ∈ `branding` | `performance`
- Campos: `passed`, `reason`, `severity`, `result_json`, `input_fingerprint`, `evaluated_at`
- RLS: `same_company` + `user_can_see_creative`; service_role bypass
- Migration: `20260604_creative_rule_evaluations.sql`

### MODIFIED — Deduplicação 6h → cache por fingerprint
- **check-creative-rules**: carrega cache válido; roda IA só em regras stale; upsert por regra; merge cached+fresh em `creative_rule_checks.results`; retorna `{ cached_rules, evaluated_rules, merged }`
- **audit-creative**: skip LLM completo (`canSkipFullLlm`) somente com `batch_context: true` em lote
- **audit-batch**: skip por criativo somente se todas as regras do job estão cache-valid **e** existe audit recente na janela; contadores `skipped_cached`, `evaluated_delta`, `full_rerun` no job

### Fingerprints (invalidação)
- **Performance**: `rule.updated_at` + métricas (ctr, cpc, spend, impressions, clicks, conversions)
- **Branding**: `rule.updated_at` + `creative.updated_at` + assets/texto
- **Criativo (LLM)**: hash de assets + copy + métricas principais
- `force_refresh` / `force` ignora cache

### Frontend
- `useAudits.runAudit`: suporte `forceRefresh`; toast com regras reutilizadas vs analisadas
- `useCreativeRules.runCheck`: toast incremental; invalidação `creative-rule-evaluations`
- Helpers compartilhados: `src/lib/ruleEvaluationCache.ts` + testes Vitest

### Módulo Edge `_shared/ruleEvaluationCache.ts`
- `loadCachedEvaluations`, `upsertRuleEvaluations`, `mergeRuleResults`, `canSkipFullLlm`, `mergeAiAnalysis`

## MODIFIED (2026-06-01) — Logo binário e anti-repetição no relatório

### Detecção de logo (binária)
- `check-creative-rules`: logo = **presente** ou **ausente** apenas; tamanho, posição e legibilidade não reprovam
- Reasons padronizados: `"Logo presente"` / `"Logo ausente no criativo"`
- `audit-creative/prompts.ts`: Brand Guardian e agente visual alinhados; seção **ANTI-REPETIÇÃO** — narrativa não duplica `rules_compliance`

### Relatório (`CreativeAuditReportDialog`)
- Banner **Status do logo**: `ok` (presente) | `absent` (ausente) — removido `present_with_issues`
- Resumo Branding: regras de logo excluídas de **Regras violadas** (cobertas pelo banner)
- `src/lib/auditReportDedup.ts`: `filterNarrativeAgainstRules` remove strengths/weaknesses/suggestions/veredito que repetem regras ou logo
- `buildImprovementActions`: não duplica ações por regra de branding (já visíveis em **Regras de branding**)

### Coerência e merge
- `src/lib/auditCoherence.ts`: veredito binário; `excludeLogoRulesFromSummary`
- `mergeAiAnalysis`: dedupe normalizado (trim + lowercase) em arrays; `executive_summary` / `tone_analysis` preferem valor fresh

## MODIFIED (2026-06-01) — Janelas de reanalise: lote 24h vs individual ilimitado

### Lote (24h)
- Constante `BATCH_SKIP_RECENT_HOURS = 24` em `src/config/auditConstants.ts` e `_shared/auditConstants.ts`
- `audit-batch`, Diagnósticos, Anúncios, `useEntityAudit` (batch de criativos em campanha/conjunto): `skip_recent_hours: 24`
- Batch client-side em **Criativos** (`filterCreativesForBatchAudit`): pula criativos com audit nas últimas 24h; toast com contagem de pulados

### Individual (sem limite temporal)
- **check-creative-rules**: removido atalho de retorno de check das últimas 6h; sempre persiste novo registro quando solicitado (cache por fingerprint permanece)
- **audit-campaign** / **audit-ad-set**: removido short-circuit `findRecentEntityAudit` (6h)
- **audit-creative**: `canSkipFullLlm` apenas quando `batch_context: true` (enviado por `audit-batch`); chamadas da UI sempre elegíveis a LLM completo

### Frontend
- `src/lib/batchAuditSkip.ts` + testes Vitest

## ADDED (2026-06-01) — Indicador cross-focus (Branding ↔ Performance)

### Comportamento
- Em **Performance**, criativos com sinal no setor **Branding** exibem chip/card: *Aprovado em Branding*, *Reprovado em Branding* ou *Com ressalvas em Branding*
- Em **Branding**, o inverso para **Performance**
- Oculto quando o setor oposto não tem auditoria IA nem verificação de regras

### Fonte de status (prioridade)
1. Última linha em `audits` com `audit_focus` oposto (`approved` / `rejected` / `warning`)
2. Fallback Branding: `creative_rule_checks` (`resolveBrandingCheckStatus`)
3. Fallback Performance: `usePerformanceCompliance` → `byCreative`

### Código
- `src/lib/crossFocusAudit.ts` + testes Vitest
- Hooks: `useCrossFocusStatusMap` (listas), `useCrossFocusStatus` (detalhe)
- UI: `CrossFocusStatusBadge`, `CrossFocusStatusCard`
- Integração: Criativos (grid/lista), CriativoDetalhe, AuditHistoryList, Diagnósticos, Anúncios, Monitoramento, AuditHistorySheet
- `useCreativeRuleChecksBatch` habilitado também em Performance (para status branding no mapa cross-focus)

---

## ADDED — Gate Branding → Performance

Análise de **Performance** (individual ou em lote sobre criativos) exige conformidade de Branding **aprovada** antes de iniciar.

### Critério de elegibilidade

| Status branding (`CrossFocusDisplayStatus`) | Performance permitida? |
|---------------------------------------------|------------------------|
| `approved` | Sim |
| `rejected` | Não |
| `warning` (ressalvas) | Não |
| `none` (pendente / não analisado) | Não |

Fonte do status: `resolveCrossFocusStatus` com foco oposto `branding` (última audit IA de branding > rule check > nada).

### Análise individual

- **CriativoDetalhe** e **Criativos**: ao tentar diagnóstico Performance, se branding ≠ `approved` → toast de bloqueio; botão desabilitado com tooltip.
- **ADDED (2026-06-01)** — Aviso visível em **CriativoDetalhe** (módulo Performance): banner `BrandingPerformanceGateAlert` com título, status de Branding e CTA **Analisar/Revisar em Branding** (alterna módulo via sidebar). Badge **Branding pendente** na lista de criativos quando status oposto é `none`.
- Modo Branding: sem alteração.

### Análise em lote (criativos)

1. Carregar status branding por criativo (`fetchBrandingGateStatuses`).
2. Particionar aprovados vs bloqueados (`partitionCreativesForPerformanceGate`).
3. **Todos aprovados** → batch segue automaticamente com todos os IDs.
4. **Nenhum aprovado** → toast; batch não inicia.
5. **Mix** → `BrandingBatchGateDialog` com listas de aprovados e não elegíveis; ao confirmar, batch só com `approvedIds` (`creative_ids` no body de `audit-batch`).

Páginas integradas: **Criativos**, **Diagnósticos**, **Campanhas** / **Conjuntos** (escopo criativos em batch performance). Auditoria agregada de campanha/conjunto continua permitida; o gate aplica-se aos criativos filhos quando o escopo é criativos.

### Código

- `src/lib/brandingPerformanceGate.ts`, `src/lib/fetchBrandingGateStatuses.ts`
- `src/components/audits/BrandingBatchGateDialog.tsx`, `src/components/audits/BrandingPerformanceGateAlert.tsx`
- `src/hooks/useBrandingPerformanceGate.ts`, `src/hooks/useBrandingGateBatchFlow.ts`
- `runBatchAudit` / `runCreativesBatch`: parâmetro opcional `creativeIds` → `creative_ids`

### Fora de escopo (follow-up)

- Validação server-side em `audit-batch` / `audit-creative` (defesa em profundidade)

## MODIFIED (2026-06-01) — Batch IA em Criativos: overlay de progresso

### Comportamento
- **Criativos** (`/criativos`): fluxos **IA em lote** (esta página + top 50 ativos) exibem `SyncLikeOverlay` fullscreen com steps `AUDIT_STEPS`, barra de progresso e contadores (processados, auditados, pulados, falhas).
- Toast Sonner permanece apenas para **sucesso/erro final** — não substitui o overlay durante a execução.
- Casos sem candidatos ou todos pulados (24h): overlay mostra estado concluído com mensagem explicativa antes de fechar (~800ms).
- Top 50: fase inicial com step "Buscando criativos ativos por investimento…" enquanto monta a fila.
- Mecanismo batch **client-side** (`audit-creative` paralelo) mantido; alinhado visualmente a Anúncios/Diagnósticos.

### Código
- `src/pages/Criativos.tsx` — estados de progresso, `executeBatchAudit`, `SyncLikeOverlay` com `theme="audit"`

## MODIFIED (2026-06-01) — Headline e CTA na auditoria de Branding

### Regras de placement
- **Headline (imagem)**: válida dentro da arte; campos Meta vazios não reprovam automaticamente.
- **Headline (vídeo)**: válida no caption Meta (`text`, `headline`, `description`) ou overlays visíveis.
- **CTA**: válido no botão Meta, texto do anúncio **ou** na imagem/vídeo (botão gráfico, frase imperativa).

### Backend
- Guidance compartilhada: `supabase/functions/_shared/creativeCopyPlacement.ts`
- Prompts: `audit-creative/prompts.ts` (agente visual estrutura headline/CTA na imagem; Brand Guardian inclui placement)
- `audit-creative/index.ts`: remove PENALIZE por campos Meta vazios; injeta `formatMetaCopyContext`
- `check-creative-rules/index.ts`: hints por regra headline/CTA + guidance no system prompt
- `sync-meta-data`: popula coluna `text` a partir de `link_data.message` / `body`
- Cache: `BRANDING_EVAL_VERSION` em `computeBrandingFingerprint` invalida avaliações antigas

### Frontend
- `Regras.tsx`: definições de novas regras CTA/headline mencionam copy na mídia
- `audit-improvements.ts` / `AuditCopyDiagnosis`: em Branding + imagem, campos Meta vazios não marcam headline/CTA como erro

### Verificação manual
- Criativo estático com headline/CTA na arte → regras CTA e Headline devem **passar**
- Criativo sem copy em lugar nenhum → continua **reprovando**
- Vídeo com headline só no caption Meta (após sync) → headline **passa**

