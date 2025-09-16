
# Relatório de Análise: Problemas na Análise de Criativos

## Resumo Executivo
A funcionalidade de análise de criativos apresenta múltiplos problemas críticos que impedem o funcionamento correto da auditoria automática. Este documento detalha os problemas identificados e apresenta um plano de correção.

## Problemas Identificados

### 1. Problema Crítico: Creative não encontrado na análise
**Arquivo:** `server/routes.ts` - linha 1021
**Erro:** `POST /api/creatives/c4dbd839-ded7-419d-82a2-a34163034e2f/analyze 404`

**Causa Raiz:** 
- Os criativos exibidos na página `/api/creatives` são transformações de dados da tabela `campaign_metrics` (Google Sheets)
- Eles não são armazenados na tabela `creatives` do banco de dados
- Quando a análise tenta buscar o criativo por ID, não encontra porque ele não existe na tabela correta

**Evidência no código:**
```typescript
// Em server/routes.ts linha ~588
const creatives = Array.from(uniqueAds.values())
  .slice(0, 50)
  .map(metric => ({
    id: metric.id, // ID da tabela campaign_metrics, não da tabela creatives
    userId: userId,
    campaignId: null, // NULL - não tem referência válida
    // ... outros campos transformados
  }));
```

### 2. Problema na Análise de Performance
**Arquivo:** `server/services/aiAnalysis.ts` - função `analyzeCreativePerformance`

**Problemas identificados:**
- A função não está comparando corretamente com os benchmarks definidos pelo usuário
- Lógica de fallback sempre retorna performance baixa sem análise real
- Não há validação se os benchmarks estão sendo aplicados corretamente

**Configuração do usuário vs Realidade:**
- Usuário definiu: CTR mínimo 2%, Conversões mínimas 5
- Criativo atual: CTR 0%, Conversões 0
- **Resultado esperado:** Falha na análise de performance
- **Resultado atual:** Aprovado (incorreto)

### 3. Problema na Análise de Compliance (Cores da Marca)
**Arquivo:** `server/services/aiAnalysis.ts` - função `analyzeCreativeCompliance`

**Problemas identificados:**
- A análise de cores depende da configuração "Exigir cores da marca"
- Quando desmarcada, a IA não verifica conformidade de cores
- Mesmo com cores definidas (#006ec2, #ffffff, #3dad00), não há verificação automática

**Configuração do usuário:**
- Cores definidas: Azul (#006ec2), Branco (#ffffff), Verde (#3dad00)
- "Exigir cores da marca": DESABILITADO
- **Comportamento atual:** Análise ignora cores completamente (correto conforme configuração)
- **Possível confusão:** Usuário esperava análise mesmo com opção desabilitada

### 4. Problema na Integração de Dados
**Arquivos:** `server/storage.ts` e `server/routes.ts`

**Problema:** 
- Dados dos criativos vêm do Google Sheets (`campaign_metrics`)
- Sistema de análise espera dados da tabela `creatives`
- Não há sincronização entre as duas fontes de dados

## Análise Técnica Detalhada

### Fluxo Atual (Problemático):
1. Usuário acessa `/creatives` → Dados vêm de `campaign_metrics`
2. Usuário clica "Analisar" → Sistema busca na tabela `creatives`
3. **FALHA:** Criativo não existe na tabela `creatives`
4. Retorna 404

### Fluxo de Análise (Quando funciona):
1. `analyzeCreativeCompliance()` - Verifica marca/conteúdo
2. `analyzeCreativePerformance()` - Verifica métricas vs benchmarks
3. Cria registro na tabela `audits`

### Configurações de Políticas:
- **Métricas de Referência:** CTR min 2%, CPC max R$2, Conversões min 5
- **Cores da Marca:** #006ec2, #ffffff, #3dad00
- **Exigir cores da marca:** DESABILITADO
- **Palavras obrigatórias:** ["Assine"]
- **Termos proibidos:** ["grátis"]

## Plano de Correção

### Fase 1: Correção Imediata (Crítico)
**Prioridade:** ALTA
**Tempo estimado:** 2-4 horas

1. **Modificar endpoint de análise** para trabalhar com dados de `campaign_metrics`
   - Alterar `POST /api/creatives/:id/analyze` para aceitar dados transformados
   - Passar o objeto completo do criativo em vez de buscar por ID

2. **Corrigir função de análise de performance**
   - Implementar comparação real com benchmarks
   - Corrigir lógica de fallback para usar valores reais

### Fase 2: Melhorias de UX (Importante)
**Prioridade:** MÉDIA
**Tempo estimado:** 1-2 horas

3. **Melhorar feedback para análise de cores**
   - Quando "Exigir cores da marca" estiver desabilitado, informar claramente na análise
   - Adicionar opção de análise informativa mesmo com opção desabilitada

4. **Aprimorar validação de palavras-chave**
   - Verificar se palavras obrigatórias/proibidas estão sendo aplicadas corretamente

### Fase 3: Otimização Estrutural (Opcional)
**Prioridade:** BAIXA
**Tempo estimado:** 4-8 horas

5. **Unificar fonte de dados**
   - Migrar dados de `campaign_metrics` para `creatives` durante sincronização
   - Manter referências consistentes entre tabelas

6. **Implementar cache de análises**
   - Evitar re-análises desnecessárias
   - Melhorar performance da aplicação

## Arquivos Que Precisam de Modificação

### Críticos (Fase 1):
1. `server/routes.ts` - Endpoint de análise (linha ~1021)
2. `server/services/aiAnalysis.ts` - Funções de análise
3. `client/src/components/Modals/CreativeAuditModal.tsx` - Modal de análise

### Importantes (Fase 2):
4. `server/storage.ts` - Métodos de busca de criativos
5. `client/src/pages/Creatives.tsx` - Interface de criativos

## Limitações Identificadas

### Impossibilidades Técnicas:
- **Análise de cores em imagens:** Requer processamento de imagem avançado, não disponível via OpenAI API text-only
- **Detecção automática de logo:** Mesma limitação de processamento visual

### Soluções Alternativas:
- Análise baseada em metadados da imagem (URL, nome do arquivo)
- Verificação de compliance baseada em texto e configurações

## Próximos Passos Recomendados

1. **Implementar correções da Fase 1** (crítico para funcionalidade básica)
2. **Testar cenários de análise** com diferentes configurações
3. **Validar benchmarks** estão sendo aplicados corretamente
4. **Documentar comportamento** para usuários finais
5. **Considerar implementação da Fase 2** para melhor UX

## Conclusão

Os problemas identificados são **tecnicamente solucionáveis** e não requerem ferramentas externas além das já disponíveis. O problema principal é arquitetural (incompatibilidade entre fontes de dados) e pode ser resolvido com as modificações propostas.

A análise de cores e logos tem limitações devido à natureza text-only da OpenAI API, mas pode ser implementada de forma alternativa baseada em configurações e metadados.

---
**Documento gerado em:** 16 de Setembro de 2025  
**Versão:** 1.0  
**Status:** Aguardando implementação
