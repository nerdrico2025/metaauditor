# Feature: Configuracoes

## Status: Implementado

## Descricao

Modulo de configuracoes da conta do usuario e da organizacao. Apenas company_admin e super_admin tem acesso.

## Paginas

- `/settings` — Settings.tsx (perfil do usuario)
- `/empresa` — Empresa.tsx (dados da empresa)
- `/usuarios` — Usuarios.tsx (equipe)
- `/preferencias` — Preferencias.tsx (tema, idioma)
- `/regras` — Regras.tsx (regras de criativos)

## Navegacao

- `SettingsNav` — Menu lateral com links: Perfil, Equipe, Integracoes, Preferencias
- Operadores nao veem este menu no Sidebar
- Rota bloqueada no AppLayout para role === 'operador'

## Settings (Perfil)

- Editar nome completo
- Upload de avatar (Supabase Storage)
- Email (read-only)

## Empresa

- Nome da empresa
- Logo
- Cor primaria
- Plano e status da assinatura

## Usuarios (Equipe)

- Lista de usuarios da organizacao
- Convidar novo membro (email + role)
- Editar role de membros existentes
- Desativar/ativar membros

## Preferencias

- Toggle dark/light mode
- Selecao de idioma (pt-BR / en-US)

## Regras de Criativos

- CRUD de regras customizaveis
- Campos: nome, definicao, tipo (conteudo/visual/performance), severidade (error/warning/info), aplica_a (all/image/video)
- Toggle ativar/desativar regra
- Regras ativas sao verificadas na proxima auditoria IA

## Decisoes de Design

- SettingsNav usa destaque laranja (text-ch-orange) no item ativo
- Regras usam Switch do shadcn para toggle
- Convite de usuarios via Edge Function invite-user
- Convite dispara e-mail via Resend (assunto/link/senha inicial); toast confirma envio e repete senha
- Avatar upload usa Supabase Storage bucket

## Aceite

- [ ] Perfil editavel e salva corretamente
- [ ] Empresa editavel com logo
- [ ] Convite de usuarios funciona
- [ ] Regras criadas aparecem na auditoria IA
- [ ] Operadores nao conseguem acessar nenhuma dessas paginas
