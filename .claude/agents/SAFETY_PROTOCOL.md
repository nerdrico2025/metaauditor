# 🚨 PROTOCOLO DE SEGURANÇA — OBRIGATÓRIO EM TODA SESSÃO

> Este protocolo é INJETADO em CADA prompt de CADA agente.
> Violar qualquer regra aqui é MOTIVO DE PARADA IMEDIATA.
> Estas regras existem porque um agente já deletou tabelas de produção
> e quebrou a autenticação de um projeto inteiro. NUNCA MAIS.

---

## ⛔ LISTA DE AÇÕES PROIBIDAS (JAMAIS EXECUTE)

### 1. NUNCA DELETE TABELAS OU COLUNAS
```sql
-- ❌ PROIBIDO — JAMAIS execute estes comandos:
DROP TABLE ...
DROP SCHEMA ...
ALTER TABLE ... DROP COLUMN ...
TRUNCATE TABLE ...
DELETE FROM ... (sem WHERE extremamente específico)

-- ✅ Se precisar "remover" algo:
-- Renomeie com prefixo _deprecated_
ALTER TABLE old_table RENAME TO _deprecated_old_table;
-- OU adicione coluna is_deleted (soft delete)
ALTER TABLE x ADD COLUMN is_deleted BOOLEAN DEFAULT false;
```

### 2. NUNCA DELETE CÓDIGO QUE FUNCIONA
```
❌ PROIBIDO:
- Deletar arquivos existentes
- Remover funções/componentes/hooks "que parecem não usados"
- Limpar imports "desnecessários" em arquivo que você não criou
- Remover comentários existentes
- Sobrescrever arquivo inteiro quando só precisa mudar 5 linhas

✅ PERMITIDO:
- Adicionar código novo
- Modificar linhas específicas (com comentário explicando)
- Criar arquivos novos
- Se REALMENTE precisa deprecar algo: renomeie com _old_ ou _deprecated_
```

### 3. NUNCA MUDE AUTENTICAÇÃO SEM APROVAÇÃO EXPLÍCITA
```
❌ PROIBIDO sem aprovação do ARCHITECT + GUARDIAN:
- Mudar método de autenticação (session → cookie, JWT → session, etc.)
- Alterar middleware de auth
- Modificar RLS policies existentes que FUNCIONAM
- Adicionar/remover providers de auth
- Mudar configuração de JWT/refresh tokens
- Desabilitar MFA ou qualquer camada de segurança

✅ PERMITIDO:
- ADICIONAR RLS policy nova (sem alterar as existentes)
- ADICIONAR middleware novo (sem alterar os existentes)
- Criar tabela nova COM RLS (seguindo padrão existente)
```

### 4. NUNCA EXECUTE MIGRATIONS DESTRUTIVAS
```
❌ PROIBIDO:
- DROP em qualquer coisa (TABLE, INDEX, COLUMN, FUNCTION, TRIGGER, TYPE)
- ALTER TYPE ... RENAME (pode quebrar dados existentes)
- UPDATE em massa sem WHERE
- DELETE em massa sem WHERE
- TRUNCATE
- ALTER TABLE ... ALTER COLUMN TYPE (pode perder dados)

✅ PERMITIDO:
- CREATE TABLE IF NOT EXISTS
- CREATE INDEX IF NOT EXISTS
- ALTER TABLE ADD COLUMN (com DEFAULT)
- CREATE OR REPLACE FUNCTION
- INSERT (dados novos)
- UPDATE com WHERE específico e LIMIT
```

### 5. NUNCA MODIFIQUE package.json SEM NECESSIDADE
```
❌ PROIBIDO:
- Remover dependências existentes
- Mudar versão major de dependências (react 18→19, etc.)
- Adicionar dependências pesadas sem justificativa
- Alterar scripts que funcionam
- Mudar configuração de build

✅ PERMITIDO:
- Adicionar dependência nova leve (com justificativa)
- Adicionar script novo (sem alterar os existentes)
```

### 6. NUNCA ALTERE CONFIGURAÇÕES DE AMBIENTE
```
❌ PROIBIDO:
- Modificar .env existente (pode quebrar conexões)
- Alterar vite.config.ts / next.config.js sem necessidade
- Mudar tsconfig.json (pode quebrar tipos)
- Alterar configurações de CORS

✅ PERMITIDO:
- Adicionar variável de ambiente NOVA
- Criar .env.example com a nova variável
```

---

## 🛡️ MEDIDAS OBRIGATÓRIAS ANTES DE QUALQUER MUDANÇA

### Pre-Flight Check (EXECUTE ANTES DE CODAR)

```bash
# ===== OBRIGATÓRIO: Salvar estado atual =====

# 1. Verificar build ANTES
cd $PROJ_PATH
npm run build 2>&1 | tail -5
echo "PRE-BUILD: $?" > /tmp/devsquad_preflight.log

# 2. Verificar tipos ANTES
npx tsc --noEmit 2>&1 | tail -5
echo "PRE-TSC: $?" >> /tmp/devsquad_preflight.log

# 3. Guardar hash dos arquivos que vou tocar
echo "=== HASHES ===" >> /tmp/devsquad_preflight.log
for f in LISTA_DE_ARQUIVOS; do
  md5sum "$f" >> /tmp/devsquad_preflight.log 2>/dev/null
done

# 4. Contar registros de tabelas que vou tocar
echo "=== TABLE COUNTS ===" >> /tmp/devsquad_preflight.log
for t in LISTA_DE_TABELAS; do
  COUNT=$(curl -s "$PROJ_SUPA_URL/rest/v1/$t?select=count" \
    -H "apikey: $PROJ_SUPA_KEY" \
    -H "Authorization: Bearer $PROJ_SUPA_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep content-range)
  echo "$t: $COUNT" >> /tmp/devsquad_preflight.log
done

# 5. Se for tocar em auth/RLS, salvar policies atuais
echo "=== RLS POLICIES ===" >> /tmp/devsquad_preflight.log
curl -s "$PROJ_SUPA_URL/rest/v1/rpc/get_policies" \
  -H "apikey: $PROJ_SUPA_KEY" \
  -H "Authorization: Bearer $PROJ_SUPA_KEY" >> /tmp/devsquad_preflight.log 2>/dev/null

echo "✅ Pre-flight salvo em /tmp/devsquad_preflight.log"
```

### Post-Flight Check (EXECUTE DEPOIS DE CODAR)

```bash
# ===== OBRIGATÓRIO: Verificar que nada quebrou =====

# 1. Build DEPOIS
npm run build 2>&1 | tail -5
POST_BUILD=$?

# 2. Tipos DEPOIS
npx tsc --noEmit 2>&1 | tail -5
POST_TSC=$?

# 3. Comparar
PRE_BUILD=$(grep "PRE-BUILD" /tmp/devsquad_preflight.log | cut -d: -f2)
PRE_TSC=$(grep "PRE-TSC" /tmp/devsquad_preflight.log | cut -d: -f2)

if [ "$POST_BUILD" != "0" ] && [ "$PRE_BUILD" == " 0" ]; then
  echo "🔴 ALERTA: Build quebrou depois da mudança! DESFAÇA!"
fi

if [ "$POST_TSC" != "0" ] && [ "$PRE_TSC" == " 0" ]; then
  echo "🔴 ALERTA: TypeScript quebrou depois da mudança! DESFAÇA!"
fi

# 4. Verificar que tabelas não foram deletadas
echo "=== TABLE COUNTS PÓS ===" 
for t in LISTA_DE_TABELAS; do
  COUNT=$(curl -s "$PROJ_SUPA_URL/rest/v1/$t?select=count" \
    -H "apikey: $PROJ_SUPA_KEY" \
    -H "Authorization: Bearer $PROJ_SUPA_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep content-range)
  echo "$t: $COUNT"
done
# Se alguma tabela retornar 404 = FOI DELETADA → ALERTA VERMELHO
```

---

## 🔒 REGRA DE OURO: MODO SOMENTE-ADITIVO

> **SE ESTÁ EM DÚVIDA, ADICIONE. NUNCA REMOVA.**

```
Precisa mudar auth?
  → NÃO mude o auth existente
  → ADICIONE uma nova camada ao lado
  → Teste a nova camada
  → Só depois (com GUARDIAN aprovando) troque

Precisa mudar RLS?
  → NÃO altere a policy existente
  → CRIE uma policy nova com nome diferente
  → Teste a nova
  → Só depois desative a antiga (não delete)

Precisa mudar schema?
  → NÃO altere colunas existentes
  → ADICIONE colunas novas
  → Migre dados se necessário
  → Marque as antigas como deprecated

Precisa mudar componente?
  → NÃO sobrescreva o arquivo inteiro
  → MODIFIQUE apenas as linhas necessárias
  → Use str_replace cirúrgico, não rewrite completo
```

---

## 📊 ESCALA DE RISCO

Antes de fazer qualquer mudança, classifique:

```
🟢 RISCO BAIXO — Pode fazer direto:
  - Criar arquivo novo
  - Adicionar componente novo
  - Criar tabela nova (com RLS)
  - Adicionar coluna nova (com DEFAULT)
  - Criar índice novo
  - Criar hook/util novo
  - Adicionar rota nova

🟡 RISCO MÉDIO — Fazer com cuidado + pre/post flight:
  - Modificar componente existente
  - Alterar query em hook existente
  - Adicionar RLS policy nova
  - Modificar Edge Function existente
  - Adicionar dependência

🔴 RISCO ALTO — REQUER APROVAÇÃO DO ARCHITECT + GUARDIAN:
  - Qualquer mudança em auth/login
  - Alterar RLS policy existente
  - Modificar middleware
  - Alterar schema de tabela existente (tipo de coluna, constraints)
  - Alterar configuração de build

⛔ PROIBIDO — NUNCA FAÇA:
  - DROP qualquer coisa
  - DELETE em massa
  - Mudar método de autenticação
  - Remover dependências
  - Sobrescrever arquivo inteiro
  - Desabilitar RLS
```

---

## 🚑 SE VOCÊ PERCEBER QUE QUEBROU ALGO

**PARE IMEDIATAMENTE** e execute:

```bash
# 1. NÃO TENTE CONSERTAR SOZINHO
# 2. Documente o que fez e o que quebrou

supa "ds_messages" -X POST -d '{
  "from_agent": "AGENT",
  "to_agent": "architect",
  "msg_type": "alert",
  "content": "🚨 EMERGÊNCIA: [descreva o que quebrou]. Ações tomadas: [o que você fez]. Estado atual: [build quebrado / tabela sumiu / auth não funciona].",
  "metadata": {
    "severity": "critical",
    "files_changed": ["lista de arquivos que mexeu"],
    "pre_flight_log": "/tmp/devsquad_preflight.log",
    "needs_rollback": true
  }
}'

# 3. Se tem git, faça rollback
cd $PROJ_PATH
git stash  # Salva as mudanças
git checkout .  # Volta ao estado anterior

# 4. Se não tem git mas tem o pre-flight log
# Use os hashes salvos para identificar o que mudou
cat /tmp/devsquad_preflight.log
```

---

## 📝 EXEMPLOS REAIS DO QUE DÁ ERRADO

### Caso 1: "Vou melhorar a segurança adicionando cookies"
```
O QUE O AGENTE FEZ:
  - Mudou auth de JWT/session para cookies
  - Não manteve compatibilidade
  - Quebrou TODOS os endpoints que dependiam do JWT
  - Usuários não conseguiam mais logar
  - Demorou 4 dias para reverter

COMO DEVERIA TER FEITO:
  - NÃO mudar auth existente
  - Se cookies são necessários, ADICIONAR como camada extra
  - Manter JWT funcionando em paralelo
  - Testar extensivamente com CADA role
  - GUARDIAN aprovar ANTES de ir para produção
```

### Caso 2: "Vou limpar o schema removendo tabelas não usadas"
```
O QUE O AGENTE FEZ:
  - DROP TABLE em 3 tabelas "que pareciam não ser usadas"
  - Tabelas eram referenciadas por Edge Functions
  - Edge Functions quebraram com "relation does not exist"
  - Dados históricos perdidos permanentemente

COMO DEVERIA TER FEITO:
  - NUNCA fazer DROP TABLE
  - Se suspeita que tabela não é usada: perguntar ao ARCHITECT
  - Se realmente não é usada: RENOMEAR com _deprecated_ prefix
  - Esperar 30 dias para confirmar antes de cogitar deletar
```

### Caso 3: "Vou otimizar o código removendo imports não usados"
```
O QUE O AGENTE FEZ:
  - Removeu 20 imports "não usados"
  - 5 eram usados dinamicamente (lazy imports, type-only imports)
  - Build quebrou em produção (mas passava local)
  
COMO DEVERIA TER FEITO:
  - NÃO remover imports de arquivos que não criou
  - Se quer limpar: PEDIR ao SYSTEM para fazer com ESLint
  - ESLint sabe quais imports são realmente não usados
```

---

## ✅ CHECKLIST MENTAL (Antes de CADA Ação)

Antes de executar QUALQUER comando ou escrever QUALQUER código, pergunte:

```
1. Estou ADICIONANDO ou REMOVENDO?
   → Adicionando? ✅ Provavelmente seguro
   → Removendo? ⛔ PARE e reconsidere

2. Se eu errar, o que acontece?
   → Nada grave? ✅ Pode fazer
   → Dados perdidos? ⛔ PARE
   → Auth quebra? ⛔ PARE
   → Build quebra? 🟡 Fazer com pre/post flight

3. Eu PRECISO fazer isso para resolver a tarefa?
   → SIM, é necessário? ✅ Faça com cuidado
   → NÃO, é "melhoria" adicional? ⛔ NÃO FAÇA

4. Fiz o pre-flight check?
   → SIM? ✅ Continue
   → NÃO? ⛔ PARE e faça agora

5. Se der errado, consigo desfazer?
   → SIM (git stash, rollback)? ✅ Continue
   → NÃO? ⛔ PARE e pense em outra abordagem
```

---

## 🔄 PROTOCOLO DE AUTO-REVISÃO (OBRIGATÓRIO)

> **TODOS os agentes DEVEM executar 2-3 passadas antes de reportar tarefa como concluída.**
> Esta é a camada final de defesa contra bugs, code smells e problemas de qualidade.

### Por Que Auto-Revisão?

**Problema**: Agentes implementam features rapidamente mas às vezes:
- Esquecem edge cases
- Não testam cenários alternativos
- Introduzem re-renders desnecessários
- Deixam passar `any` types
- Não adicionam error handling

**Solução**: Sistema de 3 passadas obrigatórias onde o agente se auto-revisa antes de finalizar.

---

### PASSADA 1: Implementação Funcional

**Objetivo**: Fazer funcionar.

**Checklist**:
- [ ] Implementar solução conforme o plano
- [ ] Build funcionar (`npm run build` passa)
- [ ] Resolver TODOS os erros TypeScript (`npx tsc --noEmit`)
- [ ] Código compila sem warnings críticos
- [ ] Funcionalidade básica testada manualmente

**Quando passar para Passada 2**: Quando build verde + types corretos.

---

### PASSADA 2: Validação e Testes

**Objetivo**: Garantir qualidade e robustez.

**Checklist**:
- [ ] **Reler código linha por linha** (procurar erros óbvios)
- [ ] **Verificar padrões do CLAUDE.md**:
  - Segue convenções de nomenclatura?
  - Usa componentes shadcn-ui existentes?
  - React Query para dados remotos?
  - Zod para validação de formulários?
- [ ] **Testar manualmente 3+ cenários diferentes**:
  - Caso feliz (tudo certo)
  - Caso com erro (network failure, validation error)
  - Caso vazio (sem dados)
- [ ] **Verificar edge cases**:
  - Inputs vazios
  - Valores extremos (números muito grandes, strings muito longas)
  - Usuário sem permissão
  - Dados ausentes/null
  - Concurrent operations
- [ ] **Error handling presente**:
  - Try/catch em operações async
  - Tratamento de erros de API
  - Mensagens de erro claras ao usuário
  - Fallbacks adequados

**Quando passar para Passada 3**: Quando testes cobrem 3+ cenários + edge cases tratados.

---

### PASSADA 3: Refinamento e Polimento

**Objetivo**: Otimizar, acessar e documentar.

**Checklist**:
- [ ] **Performance**:
  - Queries otimizadas (usar CTEs se aplicável)
  - `staleTime` configurado no React Query
  - `AbortSignal` em queries longas (>2s esperado)
  - Nenhum re-render desnecessário (usar React DevTools)
  - Bundle size não aumentou significativamente (>100KB)
- [ ] **Comentários**:
  - Adicionar comentários onde lógica não é óbvia
  - JSDoc em funções complexas (>20 linhas)
  - Explicar "por quê" (não "o quê")
- [ ] **Acessibilidade**:
  - Labels em TODOS os inputs
  - ARIA attributes onde necessário
  - Navegação por teclado funciona
  - Focus states visíveis
  - Screen reader friendly
- [ ] **Responsividade**:
  - Mobile testado mentalmente (ou no DevTools)
  - Breakpoints adequados
  - Touch targets >= 44x44px
- [ ] **Testes finalizados**:
  - Funcionalidade completa testada
  - Happy path + error path + edge cases

**Quando marcar como concluído**: Quando TODAS as 3 passadas foram executadas e checklist final abaixo aprovada.

---

### CHECKLIST DE QUALIDADE UNIVERSAL

**Execute ANTES de marcar tarefa como concluída:**

#### 🏗️ Build & Tipos
- [ ] `npm run build` passa sem erros
- [ ] `npx tsc --noEmit` sem erros
- [ ] Nenhum `any` type introduzido (exceto em casos justificados)
- [ ] Imports corretos e sem circulares
- [ ] Nenhum import não usado

#### ⚙️ Funcionalidade
- [ ] Feature funciona como esperado
- [ ] Testado manualmente em 3+ cenários diferentes
- [ ] Loading states implementados (skeleton, spinner, etc.)
- [ ] Error handling implementado (try/catch, error boundaries)
- [ ] Empty states tratados (quando não há dados)
- [ ] Success states com feedback (toast, modal, etc.)

#### 🔒 Segurança (se aplicável)
- [ ] RLS policies revisadas (Captain America consultado se necessário)
- [ ] Input validation presente (Zod schema)
- [ ] Nenhum secret exposto no código
- [ ] XSS prevention (sanitização de inputs)
- [ ] CSRF protection (se formulários críticos)
- [ ] SQL injection impossível (usando Supabase client, não raw SQL)

#### ⚡ Performance
- [ ] Queries otimizadas (índices existem, CTEs usados se necessário)
- [ ] `staleTime` configurado no React Query (mínimo 2min para dados estáveis)
- [ ] `AbortSignal` em queries longas (>2s esperado)
- [ ] Nenhum re-render desnecessário (usar `useMemo`, `useCallback` se necessário)
- [ ] Lazy loading implementado (para componentes pesados)
- [ ] Debouncing/throttling em searches e inputs (300ms mínimo)

#### 🎨 UX (User Experience)
- [ ] Toast de feedback ao usuário em TODAS as ações importantes
- [ ] Mensagens de erro claras e acionáveis (não apenas "Erro")
- [ ] Responsivo mobile testado (ou DevTools mobile view)
- [ ] Acessível (labels, aria, keyboard navigation, focus states)
- [ ] Animações suaves (não muito rápidas, não muito lentas)
- [ ] Consistente com o design system existente

#### 📏 Padrões do Projeto
- [ ] Segue convenções do CLAUDE.md
- [ ] Usa componentes shadcn-ui existentes (não reinventar)
- [ ] React Query para dados remotos (não useState + useEffect)
- [ ] Zod para validação de formulários (não validação manual)
- [ ] Comentários inline onde necessário (lógica não-óbvia)
- [ ] Nomes descritivos (funções, variáveis, componentes)

#### 📚 Documentação
- [ ] CLAUDE.md atualizado (se nova tabela Supabase, novo módulo, ou novo padrão)
- [ ] Comentários explicativos adicionados
- [ ] Types exportados se necessário (em arquivos .ts dedicados)
- [ ] JSDoc em funções públicas complexas

---

### COMO IMPLEMENTAR NOS AGENTES

**Adicionar ao final de CADA arquivo `.md` de agente:**

```markdown
---

## 🔄 PROTOCOLO DE AUTO-REVISÃO (OBRIGATÓRIO)

Execute 2-3 passadas antes de reportar tarefa como concluída:

**PASSADA 1: Implementação**
- Fazer funcionar
- Build verde
- Types corretos

**PASSADA 2: Validação**
- Reler código linha por linha
- Verificar padrões (CLAUDE.md)
- Testar 3+ cenários (happy, error, empty)
- Edge cases tratados
- Error handling presente

**PASSADA 3: Refinamento**
- Performance otimizada
- Comentários adicionados
- Acessibilidade verificada
- Responsividade testada
- Testes finalizados

**Checklist Final**: Execute TODA a checklist de qualidade em `SAFETY_PROTOCOL.md`.

**Se QUALQUER item falhar** → NÃO reportar concluído. Corrigir primeiro.
```

---

### EXEMPLO PRÁTICO

**Tarefa**: "Adicionar campo CPF no formulário de contato CRM"

#### Passada 1 (Implementação)
```
✅ Adicionei campo CPF no ContactForm.tsx
✅ Adicionei validação Zod: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
✅ npm run build: OK
✅ npx tsc --noEmit: OK
✅ Testei criar contato com CPF: funciona
```

#### Passada 2 (Validação)
```
✅ Reli código: encontrei que máscara não estava aplicada
✅ Adicionei máscara: formatCPF(value) no onChange
✅ Testei 3 cenários:
   - CPF válido: 123.456.789-00 → aceita
   - CPF inválido: 12345 → erro de validação
   - CPF vazio: → aceita (campo opcional)
✅ Edge case: CPF com letras → máscara bloqueia
✅ Error handling: toast.error quando API falha
```

#### Passada 3 (Refinamento)
```
✅ Performance: campo não causa re-render desnecessário
✅ Comentário adicionado: // Validação CPF formato brasileiro
✅ Acessibilidade: <label> associado ao input, aria-invalid quando erro
✅ Responsividade: testado mobile (DevTools) - OK
✅ Toast de feedback: "Contato salvo com sucesso!"
```

#### Checklist Final
```
✅ Build passa
✅ Types corretos
✅ Validação Zod presente
✅ Máscara aplicada
✅ Loading state (botão desabilitado durante save)
✅ Error handling
✅ Toast de feedback
✅ Acessível
✅ Responsivo
```

**Resultado**: Feature aprovada para marcar como concluída! ✅

---

### QUANDO PULAR PASSADAS?

**NUNCA.**

Mesmo para mudanças "pequenas" (ex: adicionar um comentário), execute pelo menos Passada 1 + checklist rápida.

**Por quê?**
- "Mudanças pequenas" frequentemente têm bugs inesperados
- 5 minutos de auto-revisão economiza horas de debugging depois
- Qualidade consistente em TODA a codebase

---

### MÉTRICAS DE SUCESSO

Após implementar protocolo de auto-revisão, esperamos:

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Bugs em produção | 15/mês | <5/mês | 67% ↓ |
| PRs rejeitadas | 30% | <10% | 67% ↓ |
| Tempo de review | 30min | 10min | 67% ↓ |
| Retrabalho | 20% | <5% | 75% ↓ |

---

## ⚠️ IMPORTANTE

**Este protocolo NÃO é opcional.** Todos os agentes (Core, Especialistas, Apoio) DEVEM seguir.

**Se um agente reportar tarefa concluída SEM executar as 3 passadas**:
1. Professor X (GUARDIAN) detectará na validação final
2. Tarefa será rejeitada
3. Agente deverá refazer com protocolo completo

**Melhor fazer certo da primeira vez. 🎯**
