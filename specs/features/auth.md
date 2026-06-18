# Feature: Autenticacao e Multi-Tenancy

## Status: Implementado

## Descricao

Sistema de autenticacao com Supabase Auth, registro self-service com criacao automatica de organizacao (conta individual), convite de equipe (ate 5 membros alem do dono), e isolamento de dados por `company_id`.

## Paginas

- `/login` — Login.tsx
- `/register` — Register.tsx
- `/usuarios` — Usuarios.tsx (equipe; apenas `company_admin`)

## Contextos

- `AuthContext` — Fornece user, session, signIn, signUp, signOut, refreshUser
- `AuthUser` — Extends user com company info (id, name, slug, plan, status)

## Modelo de dados (conta = company)

| Tabela | Papel |
|--------|--------|
| `companies` | Organizacao / conta. Limites: `max_users` (default 6), `max_integrations`, etc. |
| `users` | Perfil app (`company_id`, `role`, `is_active`). 1 usuario = 1 org. |
| `auth.users` | Credenciais Supabase Auth + metadata de convite ou registro |
| Demais tabelas | Sempre com `company_id` (campanhas, criativos, integracoes, regras, auditorias...) |

## Fluxo de Registro (conta individual)

1. Usuario preenche: nome, sobrenome, email, senha, nome da empresa
2. `supabase.auth.signUp()` com metadata (`first_name`, `last_name`, `company_name`)
3. Trigger `handle_new_user` no banco:
   - Cria `companies` automaticamente (trial, 14 dias, plano free, `max_users = 6`)
   - Cria registro em `public.users` como `company_admin`
   - Gera slug unico para a company
4. Usuario confirma email (ou admin confirma via SQL)
5. Login funcional — dados isolados da nova org

## Fluxo de Convite (equipe)

1. Admin acessa `/usuarios` e convida por email + role (`operador` ou `company_admin`)
2. Edge Function `invite-user`:
   - Valida limite: `max_users` (6 = 1 dono + 5 convidados)
   - Bloqueia email ja vinculado a outra org (409)
   - Cria usuario via `auth.admin.createUser` com senha inicial `12345678` (secret `TEAM_INVITE_DEFAULT_PASSWORD`)
   - Metadata: `invited_company_id`, `invited_role`
3. Trigger `handle_new_user` associa ao `company_id` existente (nao cria nova company)
4. Membro faz login com email + senha inicial
5. E-mail de convite enviado via **Resend** (`RESEND_API_KEY`, helper `_shared/resend.ts`) com link de login, credenciais e instrucao para trocar senha
6. UI exibe senha inicial no toast apos convite (`email_sent` indica se o e-mail foi entregue)

## ADDED (2026-06-02) — Super admin operacional

- `rafael@clickhero.com.br` promovido via migration `20260602_promote_rafael_super_admin.sql` (`role = super_admin`)
- `super_admin` nao aparece no dropdown de convite/roles em `/usuarios` — apenas migration ou painel interno futuro

## ADDED (2026-06-06) — Painel Supervisor de Atividades

Ferramenta interna Click Hero para monitorar uso da plataforma (Marina, Maia e futuros usuarios), cross-tenant.

**Allowlist (nao promove a `super_admin` completo):**

- `filipesenna59@gmail.com`
- `denilson.oliveira@clickhero.com`
- `rafael@clickhero.com.br`

Funcao SQL `is_platform_supervisor()` + espelho client-side `useIsPlatformSupervisor()`.

**Rota:** `/supervisor` (guard em `AppLayout`; item "Supervisao" na Sidebar so para allowlist).

**Tabela:** `user_activity_events` — RLS: INSERT proprio (`user_id = auth.uid()`); SELECT apenas supervisores.

**Eventos MVP:**

| Tipo | Exemplos |
|------|----------|
| `login` / `logout` | AuthContext |
| `page_view` | `useActivityTracker` (debounce 500ms; ignora `/login`, `/register`) |
| `action` | `audit.creative`, `audit.batch`, `sync.meta`, `user.invite`, `user.role_change`, `integration.connect`, `integration.disconnect` |

**`users.last_login_at`:** atualizado no `SIGNED_IN` via frontend.

**Privacidade:** dados de atividade nao expostos a `company_admin` comum; `metadata` sem PII sensivel. Retencao 90 dias sugerida (cron follow-up).

**Pre-requisito:** Denilson precisa de conta ativa com e-mail `denilson.oliveira@clickhero.com`.

## Mapa: tabelas x frontend x backend

### Frontend

| Area | Arquivo | Escopo |
|------|---------|--------|
| Sessao | `AuthContext.tsx` | `users` JOIN `companies` |
| Equipe | `Usuarios.tsx`, `useUsers.ts` | `company_id` do usuario logado |
| Dashboard / Branding | `Dashboard.tsx`, hooks de analise | `user.company_id` |
| Campanhas / Criativos | `useCreatives`, `useCampaigns`, etc. | `company_id` + RLS |
| Integracoes | `Integracoes.tsx` | `integrations.company_id` |
| Settings guard | `AppLayout.tsx` | `operador` sem rotas admin |

### Edge Functions (padrao)

1. `auth.getUser()` via header Authorization
2. `SELECT company_id FROM users WHERE id = auth.uid()`
3. Queries com `.eq('company_id', companyId)`

Excepcao: `invite-user` usa service role para criar usuarios em Auth.

## Roles

| Role | Sidebar | Settings | Integracoes | Dashboard | Campanhas | Diagnosticos |
|------|---------|----------|-------------|-----------|-----------|-------------|
| super_admin | Tudo | Sim | Sim | Sim | Sim | Sim |
| company_admin | Tudo | Sim | Sim | Sim | Sim | Sim |
| operador | Sem Settings | Nao | Nao | Sim | Sim | Sim |

## Isolamento de Dados

- TODA tabela filtra por `company_id`
- RLS ativo com `same_company(company_id)`
- Frontend: hooks usam `user.company_id`
- Edge Functions: verificam `company_id` do usuario autenticado
- Branding, briefing, sync e metricas: sempre scoped pela org do usuario logado

## Profile Fetch

- Apos login, AuthContext busca `users` JOIN `companies` via `useAuthProfile` (React Query)
- **ADDED (2026-06-01):** Bootstrap de auth nao bloqueia em `fetchQuery` — `getSession()` libera `authReady` imediatamente; perfil carrega em background (`prefetchQuery`)
- Cache persistido (`auth-profile`, 24h) permite stale-while-revalidate: UI abre com perfil em cache sem esperar rede
- Timeout de 10s no fetch do perfil + 1 retry; falha redireciona para login via `AppLayout`
- Listener de auth state change evita double-fetch durante init (`initialLoadDone`)

## ADDED (2026-06-05) — Perfil sem password_hash na rede

- `useAuthProfile` usa select explícito de colunas; `password_hash` **nunca** trafega no REST
- Bundle **não** contém fallback de URL/anon key do Supabase — app falha na inicialização sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

## Decisoes de Design

- Logout limpa state local ANTES de `supabase.auth.signOut()`
- Logout chama `queryClient.clear()` — nenhum dado tenant permanece em cache React Query
- Conta individual por cadastro; convite nao cria nova org
- Senha inicial de convidados: `12345678` (configuravel via secret)
- Um email nao pode pertencer a duas orgs simultaneamente
- `max_users = 6` no provisionamento (1 admin + 5 convidados)
- Convite: e-mail Resend + toast com senha inicial (`TEAM_INVITE_DEFAULT_PASSWORD` opcional)

## Aceite

- [ ] Registro cria company + user automaticamente
- [ ] Login funciona com email confirmado
- [ ] Admin convida ate 5 membros; 6o convite retorna erro de limite
- [ ] Convidado entra com senha inicial e ve apenas dados da org
- [ ] Email de outra org e bloqueado no convite
- [ ] Operadores nao acessam paginas de Settings
- [ ] Dados de uma organizacao nao vazam para outra
