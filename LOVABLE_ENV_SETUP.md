# Configuração de Variáveis de Ambiente no Lovable

Este guia explica como configurar as variáveis de ambiente no Lovable para que o OAuth do Facebook funcione corretamente.

---

## 🚨 Problema

O arquivo `.env` **não é commitado** no GitHub (e nem deve ser por segurança), então o Lovable não tem acesso às variáveis de ambiente locais.

**Resultado**: Você verá o erro:
```
Configuração pendente
O App ID do Facebook ainda não foi configurado.
```

---

## ✅ Solução A: Configurar Environment Variables no Lovable (Ideal)

**Se o Lovable suportar Environment Variables:**

### Passo 1: Acessar Configurações do Projeto

1. Acesse: https://lovable.dev/projects/clickhero-ad-analyzer
2. Clique em **Settings** (ícone de engrenagem)
3. Vá na aba **Environment Variables**

### Passo 2: Adicionar Variáveis

Adicione as seguintes variáveis:

#### **Facebook OAuth**
```bash
VITE_META_APP_ID=<seu-meta-app-id>
VITE_META_APP_SECRET=<seu-meta-app-secret>
```

#### **Supabase** (se ainda não estiver configurado)
```bash
VITE_SUPABASE_URL=<sua-url-supabase>
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

#### **OpenAI** (opcional - para análise de IA)
```bash
OPENAI_API_KEY=<sua-openai-api-key>
```

### Passo 3: Salvar e Redeploy

1. Clique em **Save**
2. Clique em **Redeploy** para aplicar as mudanças
3. Aguarde o deploy completar (~1-2 minutos)

---

## ✅ Solução B: Configuração no Código (Fallback - Atual)

**Se o Lovable NÃO suportar Environment Variables**, já implementamos uma solução alternativa:

### Arquivo já configurado: `src/config/facebook.ts`

O App ID já está configurado como fallback no código:

```typescript
const META_APP_ID_FALLBACK = "1314312457392291";
```

**Como funciona:**
1. Primeiro tenta pegar `VITE_META_APP_ID` do ambiente (Lovable ou .env)
2. Se não encontrar, usa o fallback hardcoded
3. Funciona tanto em desenvolvimento quanto em produção

**Segurança:**
- ✅ App ID é **público** por natureza (aparece na URL do OAuth)
- ✅ Não há risco em expor no código
- ❌ `META_APP_SECRET` continua seguro no Supabase Secrets (nunca exposto)

**Vantagem:** Funciona imediatamente, sem configuração adicional no Lovable! 🎉

---

## 🔍 Como Verificar se Funcionou

### Teste 1: Console do Browser

1. Acesse: https://clickhero-ad-analyzer.lovable.app
2. Abra o DevTools (F12)
3. No console, digite:
   ```javascript
   console.log(import.meta.env.VITE_META_APP_ID);
   ```
4. Deve mostrar: `1314312457392291`

### Teste 2: Botão de Conexão

1. Faça login no app
2. Vá em **Configurações** → **Integrações**
3. Clique em **Adicionar Integração**
4. Clique em **Conectar** no card do Facebook

**Se configurado corretamente**: Você será redirecionado para o Facebook OAuth

**Se não configurado**: Verá o erro vermelho:
```
Configuração pendente
O App ID do Facebook ainda não foi configurado.
```

---

## 📦 Diferença: .env Local vs Lovable

| Aspecto | `.env` Local | Lovable Environment Variables |
|---------|--------------|------------------------------|
| **Onde está** | Seu computador | Servidor do Lovable |
| **Quem acessa** | `npm run dev` local | Build/deploy do Lovable |
| **Commitado no Git?** | ❌ Não (no `.gitignore`) | N/A (configurado no dashboard) |
| **Usado quando** | Desenvolvimento local | Produção (clickhero-ad-analyzer.lovable.app) |

---

## ⚠️ Importante

1. **Nunca commite o `.env`** no GitHub
   - Ele já está no `.gitignore`
   - Contém secrets sensíveis

2. **Configure em 3 locais diferentes**:
   - ✅ `.env` local (para `npm run dev`)
   - ✅ Lovable Environment Variables (para produção)
   - ✅ Supabase Secrets (para Edge Functions)

3. **Variáveis que começam com `VITE_`**:
   - São expostas no frontend (bundle JavaScript)
   - Não coloque secrets super sensíveis aqui
   - `META_APP_SECRET` **não deve** ser usada no frontend (só no backend/Edge Function)

---

## 🔒 Segurança: META_APP_SECRET

**⚠️ ATENÇÃO**: Embora `VITE_META_APP_SECRET` esteja no `.env`, ela **NÃO É USADA** no frontend!

A Edge Function usa `META_APP_SECRET` (sem o prefixo `VITE_`), que está configurada como Supabase Secret (muito mais seguro).

**Configuração correta:**
- **Frontend** (`VITE_META_APP_ID`): Pode ser exposta, é apenas o ID público do app
- **Backend** (`META_APP_SECRET`): Configurada no Supabase Secrets, nunca exposta

Você pode até **remover** `VITE_META_APP_SECRET` do `.env` se quiser, pois ela não é usada no código frontend.

---

## 📝 Checklist de Configuração

- [ ] Variáveis adicionadas no Lovable Dashboard
- [ ] Deploy feito com sucesso
- [ ] Teste no console do browser passou (`import.meta.env.VITE_META_APP_ID` mostra o ID)
- [ ] Botão "Conectar Facebook" não mostra erro de configuração
- [ ] Callback URL adicionado no Facebook App: `https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/meta-oauth-callback`
- [ ] Supabase Secrets configurados: `META_APP_ID` e `META_APP_SECRET`

---

## 🚀 Próximos Passos

Após configurar tudo:

1. Teste o fluxo OAuth completo
2. Verifique se as integrações aparecem no banco (tabela `integrations`)
3. Confirme que o Business Manager ID foi capturado

Se tudo funcionar, você está pronto para começar a usar a integração! 🎉
