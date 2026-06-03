

## Correcao dos Erros de Build

### 1. `useCompanyIntegrations.ts` - Import inexistente

O arquivo importa `Integration` de `@/integrations/supabase/types`, mas esse tipo nao e exportado de la. Solucao: remover o import e usar o tipo inferido do Supabase diretamente, ou definir o tipo inline.

### 2. `Empresa.tsx` - Variante "warning" invalida no Badge

O componente `Badge` nao aceita a variante `"warning"`. Solucao: substituir `"warning"` por `"secondary"` ou `"destructive"` conforme o contexto.

### 3. `Index.tsx` - Propriedade `data` obrigatoria no `PerformanceChart`

O componente `PerformanceChart` exige uma prop `data` que nao esta sendo passada. Solucao: passar dados mock ou tornar a prop opcional.

### 4. `inspect_creatives.ts` - Modulo `dotenv` nao encontrado

Script utilitario que importa `dotenv` (nao instalado). Solucao: deletar o arquivo pois e um script de debug que nao faz parte do app.

### 5. Edge Functions - Erro de resolucao `npm:openai`

O `@supabase/functions-js` tenta resolver `openai` no ambiente de tipos. Solucao: adicionar `"nodeModulesDir": "auto"` ao `deno.json` ou ignorar (nao afeta o runtime).

---

### Detalhes tecnicos

**Arquivos modificados:**
- `src/hooks/useCompanyIntegrations.ts` - Remover import de `Integration`, usar tipo inferido
- `src/pages/Empresa.tsx` - Trocar variante `"warning"` por `"secondary"`
- `src/pages/Index.tsx` - Passar prop `data` ao `PerformanceChart`
- `src/scripts/inspect_creatives.ts` - Deletar arquivo
- `src/components/PerformanceChart.tsx` - Verificar se `data` pode ser opcional

