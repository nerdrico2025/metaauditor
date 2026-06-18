# ClickHero — Architecture Spec

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript 5 |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| Estado/Fetch | TanStack React Query + React Hook Form + Zod |
| Backend/BaaS | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| UI Kit | Radix UI + lucide-react + recharts + sonner |
| Roteamento | React Router 6 |
| IA | OpenAI API (gpt-4o-mini) via Supabase Edge Functions |
| Integracao | Meta Graph API, Google Ads API (stub) |

## Estrutura de Pastas

```
src/
  components/     # Componentes UI por modulo
    ui/           # shadcn/ui base components
    layout/       # Sidebar, AppLayout
    dashboard/    # Charts, galleries, format battle
    settings/     # Forms de configuracao
    integrations/ # OAuth, modais de selecao
  pages/          # 1 arquivo por rota
  hooks/          # Custom hooks de negocio
  types/          # Tipos TypeScript centralizados
  integrations/   # Cliente Supabase e tipos gerados
  contexts/       # AuthContext, ThemeProvider, IntegrationFilter
  config/         # Constantes
  lib/            # Utilitarios (cn, formatCurrency, etc)
specs/            # SDD spec files (este diretorio)
supabase/
  functions/      # Edge Functions (Deno)
  migrations/     # SQL migrations
```

## Banco de Dados — Tabelas Principais

| Tabela | Escopo | Chave de Isolamento |
|--------|--------|-------------------|
| companies | Organizacoes | id |
| users | Usuarios | company_id |
| integrations | Contas Meta/Google | company_id |
| campaigns | Campanhas | company_id + integration_id |
| ad_sets | Conjuntos de anuncio | company_id + campaign_id |
| creatives | Criativos | company_id + campaign_id |
| campaign_metrics | Metricas diarias | company_id + campaign_id + date |
| ad_set_metrics | Metricas diarias adsets | company_id + ad_set_id + date |
| audits | Auditorias IA | company_id + creative_id |
| creative_rules | Regras customizaveis | company_id |
| creative_rule_checks | Verificacoes de regras | company_id + creative_id |
| policies | Politicas de compliance | company_id |
| ai_chat_history | Historico do chat IA | company_id |
| ai_suggestions | Sugestoes IA | company_id |
| sync_history | Log de sincronizacoes | company_id |

## Isolamento de Dados (Multi-Tenancy)

- TODA tabela tem `company_id` como filtro obrigatorio
- RLS (Row Level Security) ativo em todas as tabelas
- RLS usa `(select auth.uid())` para performance (nao `auth.uid()` per-row)
- Frontend filtra por `user.company_id` em todos os hooks

## Edge Functions (Supabase/Deno)

| Funcao | Modelo IA | Proposito |
|--------|----------|----------|
| ai-chat | gpt-4o-mini | Chat interativo sobre campanhas |
| ai-creative-suggestions | gpt-4o-mini | Sugestoes de copy/visual |
| audit-creative | gpt-4o-mini | Auditoria profunda (2 agentes: visual + marketing) |
| audit-batch | — | Orquestra audit-creative + check-rules em lote |
| audit-campaign | gpt-4o-mini | Auditoria a nivel de campanha |
| check-creative-rules | gpt-4o-mini | Verificacao de regras customizaveis |
| format-analysis | gpt-4o-mini | Analise Video vs Imagem |
| sync-meta-data | — | Sincroniza dados do Meta Graph API |
| meta-campaign-action | — | Pause/activate/update_budget via Meta API |
| meta-ad-action | — | Acoes em anuncios individuais |
| invite-user | — | Convite de usuarios para organizacao |

## Otimizacoes de Custo (OpenAI)

- Todos os modelos migraram de gpt-4o para gpt-4o-mini (85-90% reducao)
- Deduplicacao temporal: **24h** apenas em fluxos de **lote** (`audit-batch`, batch Criativos); reanalise **individual** sem janela temporal (cache por fingerprint permanece)
- Batch audit limitado a 50 criativos por vez (era 200)
- max_tokens reduzido em todas as funcoes

## Cache de dados (cliente)

O Supabase/PostgREST nao cacheia consultas no browser. O app usa camadas no cliente:

| Camada | Pacote | Escopo |
|--------|--------|--------|
| Memoria | TanStack Query (`src/lib/queryClient.ts`) | Default `staleTime` 2min, `gcTime` 30min, `refetchOnWindowFocus: false` |
| Persistencia | `@tanstack/react-query-persist-client` | **localStorage**: `auth-profile`, `company-integrations` (24h) |
| Escopo compartilhado | `useMonitoredCampaignScope` + `integrationIdsKey` | IDs de integracoes monitoradas + campanhas (10min, memoria). **Dashboard** chama uma vez e repassa `validCampaignIds` a `useCompanyMetrics`, `useCreativePerformance` e `useComplianceSummary` |
| Integracoes (filtro) | `useCompanyIntegrations` | Paginacao leve (`id`, `integration_id`, `spend` / `campaign_id`); `staleTime` 10min |
| Compliance resumo | `useComplianceSummary` | Filtra `creative_rule_checks` no servidor por `creative_id` (chunks 200); `keepPreviousData` ao trocar conta |
| Piloto helpers | `@supabase-cache-helpers/postgrest-react-query` | Ex.: `useAnunciosCampaigns` — keys automaticas + invalidacao em mutations |

**Nao persistir:** listas de criativos (`creatives`), audits, metricas — apenas memoria com `staleTime` (2–5min).

**Auth:** `useAuthProfile` + `AuthContext` com stale-while-revalidate (UI nao bloqueia se houver cache). `prefetchAuthProfile` so dispara quando nao ha entrada em cache; `fetchAuthProfile` via `queryClient.fetchQuery` (deduplica requests).

**Dashboard:** carregamento progressivo por secao — KPIs (`useCompanyMetrics`), criativos campeoes e branding/compliance com skeletons proprios; sem gate global de pagina inteira.

**Imagens:** `useCreativeImageCache` chama `onRefetch` local em vez de `invalidateQueries(['creatives'])` global.

## Padroes de Codigo

- Componentes: PascalCase, export default
- Hooks: camelCase com `use` prefix, centralizam useQuery/useMutation
- Feedback: toda acao do usuario tem toast (success/error)
- Invalidacao: mutations invalidam queries relacionadas
- Tipagem: sem `any` injustificado
