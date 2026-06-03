# Feature: Integracoes (Sync Meta/Google)

## Status: Implementado (Meta), Stub (Google)

## Descricao

Modulo de conexao com plataformas de anuncio. Permite conectar contas Meta Ads via OAuth, selecionar contas de anuncio (ad accounts) dentro de Business Managers, e sincronizar dados (campanhas, criativos, metricas).

## Paginas

- `/integracoes` — Integracoes.tsx (acessivel apenas para company_admin e super_admin)

## Hooks de Dados

- `useCompanyIntegrations(companyId)` — Lista de integracoes com metricas

## Fluxo OAuth Meta

1. Usuario clica "Conectar Meta Ads"
2. FacebookOAuthButton abre popup OAuth do Facebook
3. Callback redireciona para `meta-oauth-callback` Edge Function
4. Edge Function troca code por access_token + long-lived token
5. `meta-fetch-asset-tree` busca Business Managers e Ad Accounts
6. Usuario seleciona quais contas monitorar (AssetSelectionModal)
7. Integracoes salvas com `is_monitored = true/false`

## Sincronizacao

- Edge Function `sync-meta-data` puxa dados do Meta Graph API:
  - Campanhas (campaigns)
  - Conjuntos (ad sets)
  - Criativos (creatives) com metricas de performance
  - Campaign metrics diarios (campaign_metrics)
  - AdSet metrics diarios (ad_set_metrics)
- Sync por conta individual ou em lote
- Overlay animado mostra progresso da sincronizacao

## Gestao de Integracoes

- Ativar/desativar monitoramento (is_monitored toggle)
- Remover integracao
- Reconectar token expirado
- Filtro por status (todos, ativos, desconectados, erro)

## ADDED (2026-06-02) — Limite de contas monitoradas (equipe)

- Maximo **15** contas Meta com `is_monitored = true` por `company_id` (toda a equipe compartilha o pool)
- `companies.max_integrations` default/backfill = 15
- Trigger `enforce_integration_monitor_limit` bloqueia ativar a 16a conta
- UI em Integracoes: contador `X / 15`, switch desabilitado no limite, toast de erro

## Edge Functions Utilizadas

- `meta-oauth-callback` — Troca code por token
- `meta-fetch-asset-tree` — Lista BMs e Ad Accounts
- `sync-meta-data` — Sincroniza dados completos
- `meta-list-pages` — Lista pages do Facebook

## Dados Sincronizados

| Dado | Tabela | Frequencia |
|------|--------|-----------|
| Campanhas | campaigns | A cada sync |
| Conjuntos | ad_sets | A cada sync |
| Criativos | creatives (lifetime totals) | A cada sync |
| Metricas diarias campanha | campaign_metrics | A cada sync (ultimos 30 dias) |
| Metricas diarias adset | ad_set_metrics | A cada sync |

## Decisoes de Design

- Token Meta tem validade (~60 dias para long-lived) — verificar token_expires_at
- Aviso no Dashboard quando sync > 2 dias desatualizado
- Overlay de sync tem animacao de passos (steps) com progresso
- Bug conhecido: animacao pode travar se sync completa mas state nao atualiza (investigar)
- Operadores NAO podem acessar esta pagina

## Aceite

- [ ] OAuth Meta conecta e salva token corretamente
- [ ] Selecao de contas permite escolher quais monitorar
- [ ] Sync puxa campanhas, criativos e metricas diarias
- [ ] Toggle is_monitored funciona
- [ ] Overlay de sync mostra progresso e fecha ao terminar
- [ ] Token expirado mostra aviso e permite reconexao
