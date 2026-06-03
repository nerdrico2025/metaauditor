# Guia de Configuração - OAuth do Facebook Business Manager

Este guia explica como configurar e testar a integração OAuth do Facebook no projeto ClickHero.

---

## 📋 Pré-requisitos

Antes de começar, você precisa:

1. **Conta Facebook Business Manager** ativa
2. **Facebook App** criado no [Facebook Developers](https://developers.facebook.com/apps/)
3. **Acesso ao Supabase Dashboard** do projeto

---

## 🔧 Passo 1: Configurar Facebook App

### 1.1 Criar Facebook App (se ainda não tiver)

1. Acesse: https://developers.facebook.com/apps/
2. Clique em "Create App"
3. Escolha o tipo: **Business**
4. Preencha:
   - **App Name**: ClickHero (ou nome da sua empresa)
   - **App Contact Email**: seu email
5. Clique em "Create App"

### 1.2 Configurar OAuth Settings

1. No painel do app, vá para **Settings** → **Basic**
2. Anote:
   - **App ID** (você usará como `VITE_META_APP_ID`)
   - **App Secret** (você usará como `META_APP_SECRET`)

3. Adicione **Valid OAuth Redirect URIs**:
   ```
   https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-oauth-callback
   ```
   ⚠️ **Importante**: Substitua `ejxlhstosdrryzrmfsbm` pelo ID do seu projeto Supabase

### 1.3 Adicionar Produtos

1. No painel do app, clique em **Add Product**
2. Adicione: **Facebook Login**
3. Configure Facebook Login:
   - **Valid OAuth Redirect URIs**: mesma URL acima
   - **Client OAuth Login**: Yes
   - **Web OAuth Login**: Yes

### 1.4 Solicitar Permissões Avançadas

Para acessar Business Manager, você precisa solicitar permissões:

1. No painel do app, vá para **App Review** → **Permissions and Features**
2. Solicite as seguintes permissões:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_read_engagement`
   - `read_insights`

3. Para cada permissão:
   - Clique em "Request Advanced Access"
   - Preencha o formulário explicando como você usará a permissão
   - Aguarde aprovação do Facebook (pode levar alguns dias)

⚠️ **Nota**: Enquanto aguarda aprovação, use o app em **Development Mode** com Test Users

### 1.5 Modo Development vs Live

- **Development Mode**: Funciona apenas com test users e admins do app
- **Live Mode**: Disponível após aprovação das permissões

Para testar agora, mantenha em Development Mode e use sua conta como admin.

---

## 🔐 Passo 2: Configurar Variáveis de Ambiente

### 2.1 Frontend (.env)

Abra o arquivo `.env` na raiz do projeto e substitua:

```bash
# Facebook/Meta OAuth Configuration
VITE_META_APP_ID="SEU_APP_ID_AQUI"           # Ex: 1234567890123456
VITE_META_APP_SECRET="SEU_APP_SECRET_AQUI"   # Ex: a1b2c3d4e5f6...
```

### 2.2 Backend (Supabase Secrets)

As Edge Functions do Supabase usam secrets para segurança:

1. Acesse: https://supabase.com/dashboard/project/ejxlhstosdrryzrmfsbm/settings/functions
   (Substitua `ejxlhstosdrryzrmfsbm` pelo seu ID)

2. Vá para **Edge Functions** → **Secrets**

3. Adicione os seguintes secrets:
   ```
   META_APP_ID = seu_app_id_aqui
   META_APP_SECRET = seu_app_secret_aqui
   ```

4. Clique em "Save"

⚠️ **Importante**:
- Nunca commite o `META_APP_SECRET` no código
- Mantenha sempre no Supabase Secrets ou variáveis de ambiente seguras

---

## 🚀 Passo 3: Deploy das Edge Functions

As Edge Functions já estão no código, mas você pode precisar fazer deploy:

```bash
# Se você usar Supabase CLI
supabase functions deploy meta-oauth-callback

# Ou faça deploy via Supabase Dashboard
# Dashboard → Edge Functions → Deploy
```

---

## ✅ Passo 4: Testar a Integração

### Teste 1: Fluxo na Página Integrações

1. **Inicie o projeto**:
   ```bash
   npm run dev
   ```

2. **Faça login** no ClickHero

3. **Acesse a página de Integrações**:
   - Menu lateral → ou acesse `/integracoes`

4. **Clique em "Ativar Integração"** no card do Facebook

5. **Autorize no Facebook**:
   - Você será redirecionado para o Facebook
   - Faça login (se necessário)
   - Autorize as permissões solicitadas
   - Selecione as contas de anúncios que deseja conectar

6. **Verifique o resultado**:
   - Você será redirecionado de volta para `/integracoes`
   - Deve ver um toast de sucesso
   - As contas conectadas devem aparecer na lista

### Teste 2: Fluxo na Página Configurações

1. **Acesse** `/configuracoes` (ou clique em Configurações no menu)

2. **Clique na aba "Integrações"**

3. **Clique em "Adicionar Integração"**

4. **No modal, clique em "Conectar"** no card do Facebook Business Manager

5. **Complete o fluxo OAuth** (mesmo do Teste 1)

### Teste 3: Fluxo na Página Empresa

1. **Acesse** `/empresa`

2. **Role até a seção "Integrações Conectadas"**

3. **Clique em "Adicionar Integração"**

4. **No modal, clique em "Conectar"** no card do Facebook

5. **Complete o fluxo OAuth** (mesmo do Teste 1)

### Teste 4: Verificar Dados no Banco

Verifique se os dados foram salvos corretamente:

```sql
-- No Supabase SQL Editor:
SELECT
  id,
  account_name,
  account_id,
  status,
  token_expires_at,
  permissions->>'business_manager_name' as bm_name,
  permissions->>'business_manager_id' as bm_id,
  permissions->'granted_permissions' as granted_perms
FROM integrations
WHERE platform = 'meta'
ORDER BY created_at DESC;
```

Você deve ver:
- ✅ `account_name`: Nome da conta de anúncios
- ✅ `account_id`: ID da conta
- ✅ `bm_name`: Nome do Business Manager
- ✅ `bm_id`: ID do Business Manager
- ✅ `granted_perms`: Array de permissões concedidas

### Teste 5: Renovação de Token

1. **Simule token expirando** (opcional):
   ```sql
   -- Defina token para expirar em 5 dias
   UPDATE integrations
   SET token_expires_at = NOW() + INTERVAL '5 days'
   WHERE platform = 'meta';
   ```

2. **Recarregue** `/integracoes`

3. **Verifique**:
   - Badge deve mostrar "Expira em 5d"
   - Deve aparecer card amarelo com botão "Renovar Token"

4. **Clique em "Renovar Token"**:
   - Inicia novo fluxo OAuth
   - Atualiza o token existente (não cria duplicata)

---

## 🐛 Troubleshooting

### Erro: "META_APP_ID não configurado"

**Causa**: Variável de ambiente não foi definida ou está com valor padrão

**Solução**:
```bash
# Verifique o .env
cat .env | grep VITE_META_APP_ID

# Deve mostrar seu App ID real, não "your_facebook_app_id_here"
```

### Erro: "Invalid OAuth Redirect URI"

**Causa**: A URL de callback não está registrada no Facebook App

**Solução**:
1. Acesse Facebook App → Settings → Basic
2. Adicione a URL: `https://SEU_PROJETO.supabase.co/functions/v1/meta-oauth-callback`
3. Salve as configurações

### Erro: "Permissions not granted"

**Causa**: Facebook App está em Development Mode ou permissões não foram aprovadas

**Solução Temporária**:
1. Use sua conta (admin do app) para testar
2. Ou crie Test Users no Facebook App Dashboard

**Solução Definitiva**:
1. Submeta o app para App Review
2. Aguarde aprovação das permissões

### Erro: "Failed to fetch businesses"

**Causa**: A permissão `business_management` não foi concedida

**Solução**:
1. Verifique se você solicitou `business_management` no App Review
2. Enquanto aguarda, o Business Manager ID ficará `null` (ok para testes)

### Token não renova automaticamente

**Causa**: Cron job de renovação automática não foi implementado (Fase 7 - opcional)

**Solução**:
- Use o botão "Renovar Token" manualmente
- Ou implemente a Edge Function `refresh-facebook-tokens` (ver plano)

---

## 📊 Dados Armazenados

Após OAuth bem-sucedido, o sistema armazena:

### Tabela: `integrations`
```typescript
{
  id: UUID,
  company_id: UUID,
  user_id: UUID,
  platform: "meta",
  account_id: "act_123456789",
  account_name: "Minha Conta de Anúncios",
  access_token: "EAAx...", // Long-lived token (60 dias)
  token_expires_at: "2026-04-15T10:30:00Z",
  status: "active" | "inactive",
  permissions: {
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    account_status: 1,
    business_manager_id: "123456789",
    business_manager_name: "Meu Business Manager",
    facebook_user_id: "987654321",
    granted_permissions: [
      "ads_read",
      "ads_management",
      "business_management",
      "pages_read_engagement",
      "read_insights"
    ]
  }
}
```

### Tabela: `oauth_sessions`
```typescript
{
  id: UUID,
  user_id: UUID,
  access_token: "EAAx...",
  accounts: [
    { id: "act_123", name: "Conta 1" },
    { id: "act_456", name: "Conta 2" }
  ],
  expires_at: "2026-04-15T10:30:00Z"
}
```

---

## 🎯 Próximos Passos

Após configurar e testar:

1. **Submeta o Facebook App para revisão**:
   - App Review → Request Advanced Access
   - Inclua screencast mostrando como você usa as permissões
   - Aguarde aprovação (1-7 dias)

2. **Configure renovação automática** (opcional):
   - Implemente Edge Function `refresh-facebook-tokens`
   - Configure Supabase Cron Job para executar diariamente

3. **Teste em produção**:
   - Mude o app para Live Mode após aprovação
   - Teste com usuários reais

---

## 📚 Recursos Adicionais

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Facebook Marketing API](https://developers.facebook.com/docs/marketing-apis/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OAuth 2.0 Specification](https://oauth.net/2/)

---

## ✨ Integração Implementada!

Você agora tem:

- ✅ OAuth do Facebook configurado
- ✅ Captura de Business Manager ID
- ✅ Validação de permissões
- ✅ Renovação manual de tokens
- ✅ UI em 3 locais (Integrações + Empresa + Configurações)
- ✅ Tokens seguros no banco de dados

**Bom trabalho!** 🎉
