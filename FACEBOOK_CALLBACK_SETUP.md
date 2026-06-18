# ⚠️ ERRO: "Não é possível carregar o URL"

Este erro ocorre porque o **domínio do callback** não está registrado no Facebook App.

---

## 🎯 Solução: Adicionar Callback URL no Facebook

### Passo 1: Acessar Configurações do App

1. Acesse: https://developers.facebook.com/apps/1314312457392291/settings/basic/
2. Role até a seção **"App Domains"**

### Passo 2: Adicionar Domínio do Supabase

Em **"App Domains"**, adicione:
```
ejxlhstosdrryzrmfsbm.supabase.co
```

### Passo 3: Configurar Facebook Login

1. No menu lateral, clique em **"Facebook Login"** → **"Settings"**
2. Em **"Valid OAuth Redirect URIs"**, adicione:
   ```
   https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-oauth-callback
   ```

### Passo 4: Salvar Alterações

1. Clique em **"Save Changes"** no final da página
2. Aguarde alguns segundos para o Facebook processar

---

## 📸 Exemplo Visual

### App Domains (Configurações Básicas)
```
┌─────────────────────────────────────────┐
│ App Domains                              │
├─────────────────────────────────────────┤
│ ejxlhstosdrryzrmfsbm.supabase.co       │
└─────────────────────────────────────────┘
```

### Valid OAuth Redirect URIs (Facebook Login)
```
┌─────────────────────────────────────────────────────────────────┐
│ Valid OAuth Redirect URIs                                        │
├─────────────────────────────────────────────────────────────────┤
│ https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-... │
│                                                                  │
│ [+ Add Another Redirect URI]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Verificar se Funcionou

Após salvar no Facebook:

1. Aguarde ~30 segundos
2. Acesse: https://clickhero-ad-analyzer.lovable.app
3. Faça login
4. Vá em **Configurações** → **Integrações**
5. Clique em **"Adicionar Integração"** → **"Conectar"**
6. Deve redirecionar para o Facebook OAuth ✅

---

## 🐛 Troubleshooting

### Ainda mostra erro "Não é possível carregar o URL"

**Possíveis causas:**
1. URL não foi salva corretamente no Facebook
2. Você está usando URL errada
3. Facebook ainda está processando a mudança (aguarde 1 minuto)

**Solução:**
1. Verifique se a URL está **exatamente** assim:
   ```
   https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-oauth-callback
   ```
2. Sem espaços no início/fim
3. Sem barra `/` no final

### Erro "Invalid App ID"

**Causa:** App ID errado no código

**Solução:**
- Verifique em `src/config/facebook.ts` se o App ID é: `1314312457392291`

### Console do Browser mostra `redirect_uri=undefined`

**Causa:** `VITE_SUPABASE_URL` não configurada

**Solução (já implementada):**
- Agora usa fallback automático: `https://ejxlhstosdrryzrmfsbm.supabase.co`
- Aguarde o Lovable fazer redeploy (após último commit)

---

## 📋 Checklist Final

Antes de testar novamente:

- [ ] App Domain adicionado: `ejxlhstosdrryzrmfsbm.supabase.co`
- [ ] Valid OAuth Redirect URI adicionado: `https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-oauth-callback`
- [ ] Clicou em "Save Changes" no Facebook
- [ ] Aguardou 30-60 segundos
- [ ] Lovable fez redeploy do último commit (com fallback do Supabase URL)
- [ ] Testou novamente no Lovable

---

## 🚀 Próximo Passo

Após adicionar o callback URL no Facebook e aguardar o redeploy do Lovable, teste novamente!

**URL para testar:**
https://clickhero-ad-analyzer.lovable.app/settings (aba Integrações)

**O que esperar:**
1. Clica em "Conectar Facebook"
2. Redireciona para `https://www.facebook.com/v19.0/dialog/oauth?client_id=...`
3. Você faz login e autoriza permissões
4. Facebook redireciona para Supabase Edge Function
5. Edge Function processa e salva no banco
6. Você volta para o Lovable com toast de sucesso ✅
