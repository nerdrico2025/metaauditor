# 🚀 PLANO DE IMPLEMENTAÇÃO — CLICKHERO / CLICK AUDITOR

## Análise de Mercado & Concorrência (2025/2026)

### Principais Concorrentes Analisados

| Ferramenta | Foco Principal | Preço Inicial | Ponto Forte |
|---|---|---|---|
| **Madgicx** | Automação Meta Ads + IA | $99/mês | AI Marketer (auditorias diárias automáticas) |
| **Bestever** | Análise criativa profunda | Custom | Score de criativos frame-a-frame, detecção de fadiga |
| **Motion** | Analytics de criativos | $29/mês | Dashboards visuais, tagging de elementos criativos |
| **AdAmigo.ai** | Agente IA autônomo Meta | $99-299/mês | Execução automática de otimizações aprovadas |
| **Marpipe** | Testes multivariados | Custom | Teste combinatório de centenas de variações |
| **AdCreative.ai** | Geração de criativos | $39/mês | Volume alto de criativos com IA |
| **Triple Whale** | Atribuição Shopify | $129/mês | Pixel proprietário + atribuição multi-touch |

### Gaps de Mercado = Nossas Oportunidades

1. **Nenhum concorrente combina auditoria de compliance + análise de performance + IA em uma só plataforma**
2. Ferramentas brasileiras no segmento são praticamente inexistentes
3. Maioria cobra em dólar — oportunidade de pricing em BRL
4. Nenhum tem sistema robusto de políticas de marca + auditoria automática integrada
5. Falta uma ferramenta que "ensine" o operador com explicações em português

---

## Arquitetura das Fases

```
FASE 1 (Base)          → Infraestrutura + Dashboard real + Integração Meta
FASE 2 (Core)          → Campanhas + Criativos + Gestão completa
FASE 3 (Diferencial)   → Motor de Auditoria com IA + Políticas
FASE 4 (Avançado)      → Analytics de IA + Chat IA + Automações
FASE 5 (Escala)        → Multi-plataforma + Relatórios + Billing
```

---

---

# FASE 1 — INFRAESTRUTURA + DASHBOARD REAL + INTEGRAÇÃO META

**Prioridade:** 🔴 CRÍTICA
**Estimativa:** 2-3 semanas

---

## 1.1 Integração OAuth com Meta (Facebook Ads)

### O que é
Fluxo completo de conexão da conta de anúncios do Facebook/Instagram do usuário com o ClickHero via OAuth 2.0 da Meta.

### Por que é prioridade
Sem isso, nenhuma funcionalidade real existe. Toda a plataforma depende de dados reais de anúncios.

### Detalhes técnicos para implementação

**Supabase Edge Function: `meta-oauth-callback`**
```
- Recebe o authorization code da Meta
- Troca por access_token + refresh_token
- Busca lista de ad_accounts do usuário via /me/adaccounts
- Salva na tabela `integrations` com company_id
- Salva sessão OAuth na tabela `oauth_sessions`
- Retorna success ao frontend
```

**Supabase Edge Function: `meta-refresh-token`**
```
- CRON job que roda a cada 30 dias
- Busca tokens próximos de expirar na tabela `integrations`
- Renova via Meta API (endpoint /oauth/access_token)
- Atualiza token_expires_at
```

**Frontend: Página `/integracoes`**
```
- Botão "Conectar Facebook Ads"
- Abre popup OAuth da Meta
- Callback salva e redireciona
- Lista de contas conectadas com status (ativo/expirado/erro)
- Botão reconectar / desconectar
- Mostra última sincronização
```

**Tabelas envolvidas:** `integrations`, `oauth_sessions`, `platform_settings`

**Permissões Meta necessárias:**
```
ads_read, ads_management, business_management,
pages_read_engagement, read_insights
```

---

## 1.2 Sincronização de Dados da Meta

### O que é
Engine que puxa campanhas, conjuntos de anúncios, criativos e métricas da Meta API e salva no Supabase.

### Detalhes técnicos

**Supabase Edge Function: `sync-meta-data`**
```
Fluxo de sync:
1. Buscar campanhas: GET /{ad_account_id}/campaigns
   - Campos: name, objective, status, daily_budget, lifetime_budget,
     start_time, end_time, bid_strategy
   - Salvar em `campaigns` com external_id = campaign.id da Meta

2. Para cada campanha, buscar ad_sets: GET /{campaign_id}/adsets
   - Campos: name, status, targeting, daily_budget, bid_strategy,
     start_time, end_time
   - Salvar em `ad_sets` com external_id

3. Para cada ad_set, buscar ads (criativos): GET /{adset_id}/ads
   - Campos: name, status, creative{title, body, image_url,
     video_url, call_to_action_type, thumbnail_url}
   - Salvar em `creatives` com external_id
   - Detectar tipo de mídia (image/video/carousel)
   - Salvar URLs de imagem/vídeo

4. Buscar métricas (insights): GET /{ad_account_id}/insights
   - Breakdown: por campanha, por dia
   - Campos: impressions, clicks, spend, ctr, cpc, cpm,
     conversions, actions, cost_per_action_type
   - Salvar em `campaign_metrics` (uma row por campanha/dia)

5. Registrar na `sync_history`:
   - items_synced, items_failed, status, completed_at
```

**Frequência de sync:**
```
- Sync completa: 1x ao dia (CRON às 03:00 UTC)
- Sync de métricas: A cada 6 horas
- Sync manual: Botão "Sincronizar agora" no dashboard
```

**Tabelas envolvidas:** `campaigns`, `ad_sets`, `creatives`, `campaign_metrics`, `sync_history`

---

## 1.3 Dashboard Real (substituir dados mock)

### O que é
Transformar o dashboard de dados hardcoded para dados reais do Supabase, com gráficos interativos e filtros.

### Componentes a implementar

**1. KPI Cards (topo do dashboard)**
```
Dados reais de:
- Gasto total do período (SUM de campaign_metrics.spend)
- Impressões totais (SUM de campaign_metrics.impressions)
- Cliques totais (SUM de campaign_metrics.clicks)
- CTR médio (AVG de campaign_metrics.ctr)
- CPC médio (AVG de campaign_metrics.cpc)
- ROAS médio (AVG de campaign_metrics.roas)
- Conversões totais (SUM de campaign_metrics.conversions)

Cada card mostra:
- Valor atual
- Variação % vs período anterior (semana/mês)
- Seta de tendência (up/down/neutral)
- Sparkline mini-gráfico dos últimos 7 dias
```

**2. Gráfico de Performance (Recharts - já existe, adaptar)**
```
- Seletor de período: 7d / 14d / 30d / 90d / custom
- Métricas sobrepostas: Impressões, Cliques, Conversões, Gasto
- Toggle de métricas visíveis
- Tooltip com valores formatados em BRL
- Comparação com período anterior (linha tracejada)
```

**3. Tabela de Campanhas Ativas (substituir AdsTable.tsx)**
```
- Dados reais da tabela `campaigns` + `campaign_metrics`
- Colunas: Nome, Status, Objetivo, Gasto, Impressões, Cliques,
  CTR, CPC, ROAS, Conversões, Tendência
- Ordenação por qualquer coluna
- Filtro por status (ativo/pausado/finalizado)
- Paginação
- Click na row → vai para detalhe da campanha
```

**4. Widget "Saúde da Conta"**
```
Novo componente que mostra:
- Número de campanhas ativas vs limite do plano
- Última sincronização (timestamp)
- Status da integração Meta (conectado/erro/expirado)
- Alertas (ex: "3 campanhas com CTR abaixo da meta")
```

**5. Widget "Top 5 Criativos"**
```
- Os 5 criativos com melhor performance_score
- Thumbnail do criativo + nome + CTR + ROAS
- Badge de tendência
```

**Hooks React Query a criar:**
```typescript
useCompanyMetrics(period: '7d' | '14d' | '30d' | '90d')
useCampaigns(filters: CampaignFilters)
useTopCreatives(limit: number)
useAccountHealth()
useSyncStatus()
```

---

## 1.4 Gestão de Usuários e Empresa

### Página `/usuarios`

```
CRUD completo de usuários da empresa:
- Lista de usuários com: nome, email, role, status, último login
- Adicionar usuário (invite por email)
- Editar role (company_admin / operador)
- Ativar/desativar usuário
- Validar limite de usuários do plano (companies.max_users)

Permissões:
- super_admin: vê tudo, gerencia tudo
- company_admin: gerencia usuários da sua empresa
- operador: sem acesso a esta página
```

### Página `/empresa`

```
Configurações da empresa:
- Nome da empresa, slug
- Logo (upload para Supabase Storage)
- Cor primária (theme customization)
- Dados do plano atual (subscription_plan, limites)
- Período de trial / expiração
```

---

---

# FASE 2 — CAMPANHAS + CRIATIVOS + GESTÃO COMPLETA

**Prioridade:** 🟠 ALTA
**Estimativa:** 2-3 semanas

---

## 2.1 Página de Campanhas (`/campanhas`)

### O que é
Tela completa de gestão de todas as campanhas sincronizadas, com detalhamento, filtros avançados e ações.

### Componentes

**1. Lista de Campanhas**
```
Tabela avançada com:
- Checkbox para seleção múltipla
- Colunas: Nome, Plataforma, Status, Objetivo, Orçamento Diário,
  Gasto Total, Impressões, Cliques, CTR, CPC, ROAS, Conversões
- Filtros: status, objetivo, período, range de gasto
- Busca por nome
- Ordenação multi-coluna
- Paginação server-side
- Export CSV
```

**2. Detalhe da Campanha (modal ou nova rota `/campanhas/:id`)**
```
- Header com nome, status, objetivo
- KPI cards específicos da campanha
- Gráfico de performance temporal (métricas diárias)
- Lista de Ad Sets desta campanha
- Lista de Criativos desta campanha
- Botão "Auditar todos os criativos"
- Histórico de métricas (tabela campaign_metrics filtrada)
```

**3. Ações em Batch**
```
Selecionando múltiplas campanhas:
- Pausar selecionadas (via Meta API)
- Ativar selecionadas (via Meta API)
- Auditar selecionadas
- Export relatório das selecionadas
```

**Supabase Edge Function: `meta-campaign-action`**
```
- Recebe: campaign_external_id, action (PAUSE | ACTIVE)
- Faz POST na Meta API para atualizar status
- Atualiza status local na tabela campaigns
- Registra ação no log
```

---

## 2.2 Página de Criativos (`/criativos`)

### O que é
Galeria visual de todos os criativos/anúncios com preview, métricas e análise.

### Componentes

**1. Galeria de Criativos (Grid/List toggle)**
```
Modo Grid (default):
- Card com thumbnail do criativo (imagem ou frame do vídeo)
- Badge de tipo (imagem/vídeo/carousel)
- Nome do anúncio
- Status (ativo/pausado)
- Mini métricas: CTR, CPC, Conversões
- Badge de performance_score (escala de cores: vermelho→amarelo→verde)
- Badge de compliance (se auditado)

Modo Lista:
- Tabela com todas as colunas detalhadas
- Mesmos filtros da galeria
```

**2. Filtros Avançados**
```
- Por campanha
- Por ad set
- Por status
- Por tipo de mídia (image/video/carousel)
- Por range de CTR / CPC / ROAS
- Por performance_score (alto/médio/baixo)
- Por status de auditoria (auditado/pendente/com issues)
```

**3. Detalhe do Criativo (modal ou `/criativos/:id`)**
```
- Preview grande da imagem/vídeo
- Todos os campos de texto: headline, description, CTA
- Métricas completas em cards
- Gráfico de performance ao longo do tempo
- Resultado da última auditoria (se existir)
- Análise visual (color_analysis, visual_elements)
- Botão "Auditar este criativo"
- Botão "Ver anúncio original no Meta" (link externo)
```

---

## 2.3 Métricas Detalhadas por Campanha

### O que é
Tabela `campaign_metrics` populada corretamente, com gráficos temporais.

### Métricas rastreadas por dia

```
- impressions: número de vezes que o anúncio foi exibido
- clicks: cliques no anúncio
- spend: valor gasto em BRL
- ctr: click-through rate (clicks/impressions * 100)
- cpc: custo por clique (spend/clicks)
- cpm: custo por mil impressões (spend/impressions * 1000)
- conversions: ações de conversão configuradas
- roas: return on ad spend (revenue/spend)
```

### Componente de Gráfico Reutilizável

```typescript
<MetricChart
  campaignId={id}
  metrics={['impressions', 'clicks', 'ctr']}
  period="30d"
  comparison={true}  // mostra período anterior
  type="area" | "bar" | "line"
/>
```

---

---

# FASE 3 — MOTOR DE AUDITORIA COM IA + POLÍTICAS

**Prioridade:** 🟡 ALTA (DIFERENCIAL DO PRODUTO)
**Estimativa:** 3-4 semanas

---

## 3.1 Sistema de Políticas (`/politicas`)

### O que é
O coração do diferencial do ClickHero. Permite que a empresa defina regras/políticas que seus anúncios devem seguir. A IA audita cada criativo contra essas políticas.

### CRUD de Políticas

```
Criar/editar política com campos:

IDENTIDADE DA MARCA:
- brand_name: nome da marca
- primary_color, secondary_color, accent_color (hex)
- logo_url: logo obrigatória
- requires_brand_colors: boolean
- requires_logo: boolean
- brand_guidelines: texto livre com guidelines

REGRAS DE TEXTO:
- min_text_length: mínimo de caracteres no copy
- max_text_length: máximo de caracteres no copy
- required_keywords: palavras que DEVEM aparecer (JSON array)
- prohibited_keywords: palavras PROIBIDAS (JSON array)
- required_phrases: frases obrigatórias
- prohibited_phrases: frases proibidas

METAS DE PERFORMANCE:
- ctr_min: CTR mínimo aceitável (ex: 1.5%)
- ctr_target: CTR alvo (ex: 3%)
- cpc_max: CPC máximo aceitável
- cpc_target: CPC alvo
- conversions_min: mínimo de conversões
- conversions_target: alvo de conversões

ESCOPO:
- scope: "all" | "specific_campaigns"
- campaign_ids: array de IDs (se scope = specific_campaigns)
- is_default: se é a política padrão da empresa
- status: "active" | "draft" | "archived"
```

### UI da Página `/politicas`

```
- Lista de políticas existentes com status
- Botão "Criar Nova Política"
- Template de políticas pré-definidas (e-commerce, lead gen, branding)
- Wizard guiado para criar política passo a passo
- Preview de como a política será aplicada
- Indicador: "X criativos vinculados a esta política"
```

---

## 3.2 Motor de Auditoria com OpenAI (`/auditorias`)

### O que é
Sistema automático que analisa cada criativo contra as políticas definidas, usando a API da OpenAI para análise profunda de texto, imagem e compliance.

### Supabase Edge Function: `audit-creative`

```
INPUT:
- creative_id
- policy_id (ou usar política default)

FLUXO:

1. BUSCAR DADOS
   - Buscar criativo completo (textos, imagens, métricas)
   - Buscar política aplicável
   - Buscar brand_configuration da empresa

2. ANÁLISE DE COMPLIANCE (regras determinísticas)
   Verificar:
   ✓ Texto dentro do min/max length
   ✓ Keywords obrigatórias presentes
   ✓ Keywords proibidas ausentes
   ✓ Frases obrigatórias presentes
   ✓ Frases proibidas ausentes
   → Gerar compliance_score (0-100)
   → Listar issues encontradas

3. ANÁLISE DE PERFORMANCE (dados numéricos)
   Verificar:
   ✓ CTR vs ctr_min e ctr_target
   ✓ CPC vs cpc_max e cpc_target
   ✓ Conversões vs metas
   → Gerar performance_score (0-100)
   → Classificar: "acima da meta" / "na meta" / "abaixo da meta"

4. ANÁLISE DE IA (OpenAI GPT-4o)

   PROMPT para análise de TEXTO:
   """
   Você é um especialista em marketing digital e Facebook Ads.
   Analise o seguinte anúncio:

   Headline: {headline}
   Descrição: {description}
   CTA: {call_to_action}

   Política da marca:
   - Nome: {brand_name}
   - Guidelines: {brand_guidelines}
   - Keywords obrigatórias: {required_keywords}
   - Keywords proibidas: {prohibited_keywords}

   Avalie de 0-100 nos seguintes critérios:
   1. Clareza da mensagem
   2. Persuasão/CTA effectiveness
   3. Alinhamento com a marca
   4. Tom de voz adequado
   5. Compliance com guidelines
   6. Potencial de engajamento

   Retorne JSON:
   {
     "scores": { "clareza": N, "persuasao": N, ... },
     "overall_score": N,
     "issues": ["issue 1", "issue 2"],
     "recommendations": ["rec 1", "rec 2"],
     "improved_headline": "sugestão melhorada",
     "improved_description": "sugestão melhorada"
   }
   """

   PROMPT para análise de IMAGEM (Vision API):
   """
   Analise esta imagem de anúncio para Facebook/Instagram.

   Marca: {brand_name}
   Cores da marca: {primary_color}, {secondary_color}
   Logo obrigatória: {requires_logo}

   Avalie:
   1. A logo da marca está presente e visível?
   2. As cores da marca estão sendo usadas?
   3. O texto na imagem é legível?
   4. A composição visual é profissional?
   5. A imagem é adequada para a plataforma?
   6. Há elementos que violam políticas do Meta?

   Retorne JSON:
   {
     "visual_score": N,
     "has_logo": boolean,
     "brand_colors_used": boolean,
     "text_readability": N,
     "composition_score": N,
     "issues": [],
     "recommendations": [],
     "detected_elements": ["produto", "pessoa", "texto"]
   }
   """

5. SALVAR RESULTADO
   - Inserir na tabela `audits`:
     - compliance_score (da análise determinística)
     - performance_score (dos dados numéricos)
     - ai_analysis (JSON completo da resposta da OpenAI)
     - issues (array consolidado)
     - recommendations (array consolidado)
     - status: "completed"
   - Atualizar creatives.performance_score
   - Criar notificação se houver violations

6. RETORNAR RESULTADO ao frontend
```

### Auditoria em Batch

```
Supabase Edge Function: `audit-batch`
- Recebe: campaign_id OU array de creative_ids
- Enfileira auditorias individuais
- Atualiza progresso (X de Y concluídas)
- Notifica ao concluir todas
```

### UI da Página `/auditorias`

```
1. LISTA DE AUDITORIAS
   - Tabela com: criativo, data, compliance_score, performance_score,
     status, nº de issues
   - Filtros: por campanha, por range de score, por status
   - Cores: verde (>80), amarelo (50-80), vermelho (<50)

2. DETALHE DA AUDITORIA (modal ou página)
   - Header: criativo + scores visuais (gauge charts)
   - Seção "Compliance": lista de checks (✓/✗)
   - Seção "Performance": métricas vs metas (barras comparativas)
   - Seção "Análise de IA":
     - Scores por critério (radar chart)
     - Issues encontradas (lista com severidade)
     - Recomendações (lista acionável)
     - Sugestões de melhoria do texto (diff view)
   - Seção "Visual" (se analisou imagem):
     - Thumbnail com anotações
     - Checklist visual (logo, cores, composição)
   - Botões de ação:
     - "Pausar este anúncio" (via Meta API)
     - "Re-auditar"
     - "Marcar como resolvido"

3. DASHBOARD DE AUDITORIAS
   - Score médio da conta
   - Distribuição de scores (histogram)
   - Top issues mais comuns
   - Criativos que precisam de atenção urgente
   - Tendência de compliance ao longo do tempo
```

---

## 3.3 Critérios de Conteúdo (`content_criteria`)

### O que é
Regras granulares de conteúdo, complementares às políticas. Focadas em checagem automática sem IA.

```
CRUD na tabela content_criteria:
- name: "Padrão E-commerce"
- min_text_length / max_text_length
- required_keywords / prohibited_keywords
- required_phrases / prohibited_phrases
- requires_brand_colors / requires_logo

Usado pelo motor de auditoria na etapa 2 (compliance determinístico)
```

---

## 3.4 Keyword Rules (`keyword_rules`)

### O que é
Sistema avançado de regras de palavras-chave para monitoramento e compliance.

```
Tipos:
- "blocked": palavra proibida (ex: "grátis" se for misleading)
- "required": palavra obrigatória (ex: nome da marca)
- "warning": palavra que gera alerta mas não bloqueia

Match types:
- "exact": match exato
- "contains": contém a palavra
- "regex": expressão regular

Tags: categorização das regras (ex: "compliance", "brand", "legal")
Priority: ordem de avaliação (1 = mais alta)
```

---

---

# FASE 4 — ANALYTICS DE IA + CHAT + AUTOMAÇÕES

**Prioridade:** 🟢 DIFERENCIAL COMPETITIVO
**Estimativa:** 3-4 semanas

---

## 4.1 AI Chat — "Assistente ClickHero"

### O que é
Chat interativo dentro da plataforma onde o usuário pode perguntar em linguagem natural sobre seus anúncios. Similar ao AI Chat do Madgicx, mas em português.

### Como funciona

```
Componente: <AIChatPanel /> (sidebar ou modal)

Fluxo:
1. Usuário digita pergunta em português:
   "Por que meu ROAS caiu ontem?"
   "Quais criativos estão com fadiga?"
   "Me sugira melhorias para a campanha Black Friday"

2. Frontend envia para Edge Function: `ai-chat`

3. Edge Function:
   a. Interpreta a intenção com GPT-4o
   b. Busca dados relevantes no Supabase:
      - Métricas recentes
      - Criativos em questão
      - Resultados de auditorias
      - Políticas ativas
   c. Monta prompt com contexto real dos dados
   d. Envia para OpenAI com system prompt especializado
   e. Retorna resposta formatada

System Prompt do Chat:
"""
Você é o assistente de marketing digital do ClickHero.
Você tem acesso aos dados reais de anúncios do usuário.
Sempre responda em português do Brasil.
Seja direto, prático e acionável.
Quando sugerir ações, seja específico (qual campanha, qual criativo).
Use dados numéricos para embasar suas análises.
Formate com markdown quando apropriado.
"""

4. Frontend renderiza resposta com:
   - Markdown formatado
   - Cards de métricas inline
   - Links para campanhas/criativos mencionados
   - Botões de ação sugeridos ("Pausar campanha X")
```

### Exemplos de perguntas que o chat deve suportar

```
ANÁLISE:
- "Qual minha campanha com melhor ROAS?"
- "Quais criativos têm CTR abaixo de 1%?"
- "Compare a performance desta semana com a anterior"
- "Quais anúncios estão gastando mais sem converter?"

DIAGNÓSTICO:
- "Por que o CPC da campanha X subiu?"
- "Meus anúncios estão com fadiga criativa?"
- "Algum criativo está violando minhas políticas?"

RECOMENDAÇÕES:
- "O que posso melhorar na campanha X?"
- "Me sugira um novo headline para este anúncio"
- "Qual o melhor horário para meus anúncios?"
- "Devo aumentar ou diminuir o orçamento?"

AÇÕES:
- "Pause todos os criativos com CTR abaixo de 0.5%"
- "Audite todos os criativos da campanha X"
```

---

## 4.2 Detecção de Fadiga Criativa

### O que é
Sistema automático que analisa tendências de performance para detectar quando um criativo está "cansando" a audiência. Este é um recurso que o Bestever e Motion têm e que é altamente valorizado.

### Como funciona

```
Supabase Edge Function: `detect-creative-fatigue` (CRON diário)

Para cada criativo ativo:
1. Buscar métricas dos últimos 14 dias
2. Calcular tendência de:
   - CTR (está caindo?)
   - CPC (está subindo?)
   - Frequência/impressões (audiência saturada?)
   - Conversões (estão diminuindo?)

3. Algoritmo de detecção:
   IF CTR caiu mais de 20% nos últimos 7 dias
   AND CPC subiu mais de 15%
   AND impressões estão estáveis ou crescendo
   → CRIATIVO COM FADIGA

4. Classificar severidade:
   - "leve": declínio de 10-20%
   - "moderada": declínio de 20-40%
   - "crítica": declínio de 40%+

5. Salvar em `creative_patterns`:
   - patterns: { fatigue_level, trend_data, affected_metrics }
   - recommendations: ["Testar novo hook", "Trocar imagem", ...]

6. Gerar notificação para o usuário
7. Mostrar badge de "fadiga" no card do criativo
```

### UI

```
- Badge no card do criativo: "⚠️ Fadiga Detectada"
- Tooltip com detalhes: "CTR caiu 25% nos últimos 7 dias"
- Widget no dashboard: "Criativos com fadiga" (lista)
- Gráfico de tendência no detalhe do criativo (linha vermelha = fadiga)
```

---

## 4.3 Sugestões Automáticas de Melhoria com IA

### O que é
Geração automática de sugestões de copy, headlines e descrições melhoradas usando OpenAI.

### Edge Function: `ai-creative-suggestions`

```
INPUT: creative_id

1. Buscar criativo atual (headline, description, CTA, métricas)
2. Buscar melhores criativos da mesma campanha (top performers)
3. Buscar política aplicável

4. Enviar para OpenAI:
   """
   Com base nestes dados de performance:
   - Criativo atual: {headline}, CTR: {ctr}, CPC: {cpc}
   - Melhores criativos da campanha: {top_performers}
   - Política da marca: {policy}

   Gere 3 variações melhoradas de:
   1. Headline (max 40 chars)
   2. Descrição (max 125 chars)
   3. CTA sugerido

   Para cada variação, explique o raciocínio.
   Retorne em JSON.
   """

5. Retornar sugestões ao frontend

UI no detalhe do criativo:
- Seção "Sugestões de IA"
- 3 cards com variações sugeridas
- Botão "Copiar" para cada sugestão
- Explicação do raciocínio de cada sugestão
```

---

## 4.4 Performance Benchmarks

### O que é
Comparar as métricas do usuário com benchmarks da indústria.

```
Tabela `performance_benchmarks`:
- Populada com dados de mercado (inicialmente hardcoded, depois atualizado)
- Métricas por indústria e plataforma

Benchmarks 2025 Meta Ads (dados de mercado):
- CTR médio geral: ~1.5-2.5%
- CPC médio geral: R$ 0.50 - R$ 2.50
- ROAS médio e-commerce: 2.0-4.0x
- ROAS médio B2B SaaS: 1.3-1.8x
- CPM médio: R$ 15-40

UI:
- No dashboard, mostrar "Seu CTR vs Média do Mercado"
- No detalhe da campanha, comparar cada métrica com benchmark
- Cores: verde (acima), amarelo (na média), vermelho (abaixo)
```

---

## 4.5 Automações (Rules Engine)

### O que é
Sistema de regras automáticas tipo "se X acontecer, faça Y". Similar às automated rules do Meta Ads Manager, mas com mais inteligência.

```
Nova tabela: `automation_rules`
- company_id
- name: "Pausar criativos ruins"
- trigger_type: "metric_threshold" | "schedule" | "fatigue_detected"
- conditions: JSON
  Ex: { "metric": "ctr", "operator": "<", "value": 0.5, "period": "7d" }
- action: "pause_ad" | "notify" | "audit" | "increase_budget" | "decrease_budget"
- action_params: JSON
- is_active: boolean
- last_triggered_at: timestamp

Exemplos de regras:
1. "Se CTR < 0.5% por 3 dias → Pausar anúncio e notificar"
2. "Se CPC > R$ 5.00 → Diminuir orçamento em 20%"
3. "Se fadiga detectada → Auditar e sugerir melhorias"
4. "Todo domingo → Gerar relatório semanal"

UI:
- Lista de regras ativas
- Builder visual de condições (dropdowns encadeados)
- Histórico de execuções
- Toggle ativo/inativo
```

---

---

# FASE 5 — ESCALA + RELATÓRIOS + BILLING

**Prioridade:** 🔵 EXPANSÃO
**Estimativa:** 2-3 semanas

---

## 5.1 Sistema de Relatórios

### O que é
Geração de relatórios PDF/Excel profissionais para download ou envio por email.

```
Tipos de relatório:
1. Relatório de Performance (semanal/mensal)
   - KPIs do período
   - Top campanhas
   - Gráficos de tendência
   - Comparação com período anterior

2. Relatório de Auditoria
   - Resumo de compliance da conta
   - Criativos com issues
   - Recomendações prioritárias
   - Score médio e distribuição

3. Relatório de Criativos
   - Galeria dos melhores/piores
   - Análise de fadiga
   - Sugestões de melhoria

Geração:
- Edge Function que gera HTML → PDF (Puppeteer ou similar)
- Agendamento automático (semanal/mensal)
- Download direto ou envio por email
- Template white-label com logo da empresa
```

---

## 5.2 Notificações

### O que é
Sistema completo de notificações in-app, email e push.

```
Usar tabela `notifications` existente.

Tipos (enum notification_type):
- audit_completed: "Auditoria da campanha X concluída"
- audit_failed: "Falha na auditoria do criativo Y"
- policy_violation: "Criativo Z viola política de marca"
- sync_completed: "Sincronização concluída: 45 itens"
- sync_failed: "Erro na sincronização com Meta"
- system_alert: "Seu token Meta expira em 3 dias"
- welcome: "Bem-vindo ao ClickHero!"

UI:
- Ícone de sino no header com badge de contagem
- Dropdown com últimas notificações
- Página /notificacoes com histórico completo
- Marcar como lida / marcar todas como lidas
- Configurações: quais notificações receber
```

---

## 5.3 Billing e Planos

### O que é
Controle de assinaturas e limites dos planos.

```
Usar tabela `subscription_plans` existente.

Planos sugeridos:
- Free: 1 integração, 5 campanhas, 10 auditorias/mês, 1 usuário
- Starter (R$ 97/mês): 2 integrações, 25 campanhas, 50 auditorias/mês, 3 usuários
- Professional (R$ 297/mês): 5 integrações, ilimitado, 200 auditorias/mês, 10 usuários, AI Chat
- Enterprise (R$ 697/mês): ilimitado, API access, suporte prioritário

Implementar:
- Página de planos/pricing
- Controle de limites (middleware que valida antes de cada ação)
- Upgrade/downgrade flow
- Integração com Stripe ou similar para pagamento
- Trial de 14 dias para Professional
```

---

## 5.4 Google Sheets Export

```
Usar tabela `google_sheets_config` existente.

- Conectar Google Sheets via OAuth
- Exportar métricas automaticamente para planilha
- Configurar frequência de atualização
- Templates de planilha pré-formatados
```

---

## 5.5 Brand Configurations

```
Usar tabela `brand_configurations` existente.

- CRUD de configurações de marca
- Upload de logo, definição de cores, font, guidelines
- Usado automaticamente pelo motor de auditoria
- Múltiplas marcas por empresa (para agências)
```

---

---

# DIFERENCIAIS COMPETITIVOS DO CLICKHERO

| Feature | Madgicx | Bestever | Motion | **ClickHero** |
|---|---|---|---|---|
| Dashboard de métricas | ✅ | ❌ | ✅ | ✅ |
| Auditoria de compliance | ❌ | Parcial | ❌ | ✅ **Full** |
| Análise de criativos com IA | Básico | ✅ | ✅ | ✅ **GPT-4o** |
| Sistema de políticas de marca | ❌ | ❌ | ❌ | ✅ **Único** |
| Detecção de fadiga criativa | ❌ | ✅ | ✅ | ✅ |
| Chat IA em português | ❌ | ❌ | ❌ | ✅ **Único** |
| Sugestões de copy com IA | ❌ | ✅ | ❌ | ✅ |
| Automações/regras | ✅ | ❌ | ❌ | ✅ |
| Preço em BRL | ❌ | ❌ | ❌ | ✅ |
| Interface em português | ❌ | ❌ | ❌ | ✅ |
| Multi-tenant (agências) | ✅ | ❌ | ✅ | ✅ |
| Análise visual de imagem | ❌ | ✅ | Básico | ✅ **Vision API** |
| Relatórios automatizados | ✅ | ❌ | ✅ | ✅ |
| Keyword rules engine | ❌ | ❌ | ❌ | ✅ **Único** |

### Nossos 4 Diferenciais Únicos:
1. **Sistema de Políticas + Auditoria Automática** — ninguém combina regras de marca com verificação automática por IA
2. **Chat IA em Português** — assistente que entende o contexto da conta e responde em PT-BR
3. **Keyword Rules Engine** — controle granular de vocabulário permitido/proibido nos anúncios
4. **Preço em BRL focado no mercado brasileiro** — sem fricção cambial

---

# ORDEM DE IMPLEMENTAÇÃO (PARA O CURSOR)

```
SPRINT 1 (Semana 1-2):
  ├── 1.1 Edge Function meta-oauth-callback
  ├── 1.2 Edge Function sync-meta-data
  ├── 1.3 Página /integracoes (conectar Meta)
  └── 1.3 Dashboard real (substituir mocks)

SPRINT 2 (Semana 3-4):
  ├── 1.4 Página /usuarios (CRUD)
  ├── 1.4 Página /empresa (config)
  ├── 2.1 Página /campanhas (lista + detalhe)
  └── 2.2 Página /criativos (galeria + detalhe)

SPRINT 3 (Semana 5-7):
  ├── 3.1 Página /politicas (CRUD)
  ├── 3.2 Edge Function audit-creative (OpenAI)
  ├── 3.2 Página /auditorias (lista + detalhe)
  └── 3.3 Keyword Rules UI

SPRINT 4 (Semana 8-10):
  ├── 4.1 AI Chat (assistente)
  ├── 4.2 Detecção de fadiga criativa
  ├── 4.3 Sugestões de melhoria com IA
  └── 4.4 Performance benchmarks

SPRINT 5 (Semana 11-13):
  ├── 4.5 Automações/rules engine
  ├── 5.1 Sistema de relatórios PDF
  ├── 5.2 Notificações completas
  └── 5.3 Billing + planos
```

---

# NOTAS PARA O CLAUDE NO CURSOR

1. **Todas as Edge Functions** devem ser em Deno (Supabase Edge Functions)
2. **A chave da OpenAI** deve ficar como env var na Edge Function, nunca no frontend
3. **Usar `ai_settings`** table para configurar model, temperature, max_tokens dinamicamente
4. **RLS (Row Level Security)** deve estar ativo em todas as tabelas com filtro por `company_id`
5. **React Query** para todos os fetches, com cache e invalidation
6. **Zod** para validação de forms no frontend
7. **Manter o design system** existente (ch-black, ch-orange, glass, etc.)
8. **Toast/Sonner** para feedback de ações
9. **Loading states** em tudo (Skeleton, Spinner)
10. **Error boundaries** em todas as páginas
