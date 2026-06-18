# ClickHero — Constitution (Regras Inviolaveis)

Estas regras NAO podem ser quebradas sem permissao explicita do usuario.

## 1. Banco de Dados

- NUNCA executar DROP TABLE, TRUNCATE, ou alterar colunas estruturais ativas
- Preferir migracoes "soft" (adicionar colunas novas, migrar dados, depois remover antigas)
- TODA query deve filtrar por `company_id` — sem excecao
- RLS deve estar ativo em todas as tabelas publicas

## 2. Edge Functions

- NUNCA alterar a logica de chamada de Edge Functions sem permissao explicita
- NUNCA mudar assinaturas de request/response de funcoes existentes
- Ao modificar uma Edge Function, SEMPRE manter backwards compatibility
- Credenciais (OPENAI_API_KEY, tokens Meta) SEMPRE via `Deno.env.get()`, nunca hardcoded

## 3. Frontend

- NUNCA remover imports/chamadas que "parecem nao usados" sem verificar o repositorio inteiro
- NUNCA refatorar blocos gigantescos se a tarefa pede uma mudanca pontual
- Hardcode de credenciais PROIBIDO — sempre `import.meta.env`
- Toda operacao do usuario deve ter feedback visual (toast, loader)

## 4. Autenticacao e Seguranca

- NUNCA expor SUPABASE_SERVICE_ROLE_KEY no frontend
- NUNCA desabilitar email_confirmation sem motivo
- Operadores NAO podem acessar /settings, /integracoes, /empresa, /usuarios, /preferencias
- Senhas minimas: 8 caracteres

## 5. Custos de IA

- Modelo padrao: gpt-4o-mini (NAO gpt-4o, salvo necessidade de vision comprovada)
- Deduplicacao obrigatoria: verificar cache antes de chamar OpenAI
- Batch audit maximo: 50 criativos por vez
- max_tokens deve ser o minimo necessario para a resposta

## 6. Sincronizacao (Meta/Google)

- Sync altera APENAS dados da integracao sendo sincronizada
- NUNCA deletar dados de outras integracoes durante sync
- Exibir aviso no Dashboard quando dados tem mais de 2 dias sem sync
- Token de acesso Meta tem validade — verificar antes de usar

## 7. Visual/UX

- Light mode deve ter cards com bordas solidas e sombras leves (shadow-sm)
- PROIBIDO: glassmorphism (glass-card, backdrop-blur), glows neon, transparencias extremas
- Modo escuro e claro devem ser igualmente funcionais
- Componentes usam sistema de design shadcn/ui — nao criar componentes custom quando shadcn resolve
