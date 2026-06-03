# ClickHero Ads Analyzer — CLAUDE.md

Bem-vindo ao repositório do **ClickHero Ads Analyzer**. Este documento define a arquitetura, stack, padrões de código, e o **Sistema de Agentes Multi-Agente (Avengers)** adotado pelo projeto. 

**LEIA ESTE DOCUMENTO ANTES DE INICIAR QUALQUER TAREFA.**

---

## 📋 SPEC-DRIVEN DEVELOPMENT (SDD)

Este projeto usa **Spec-Driven Development**. Antes de implementar qualquer feature, leia a spec correspondente:

| Spec | Caminho | Conteudo |
|------|---------|---------|
| Produto | `specs/product.md` | Visao do produto, publico, modelo de negocio |
| Arquitetura | `specs/architecture.md` | Stack, banco, Edge Functions, padroes |
| Constituicao | `specs/constitution.md` | Regras INVIOLAVEIS do projeto |
| Dashboard | `specs/features/dashboard.md` | Visao Geral (Performance + Branding) |
| Campanhas | `specs/features/campaigns.md` | Campanhas, Conjuntos, Criativos |
| Diagnosticos | `specs/features/diagnostics.md` | Auditoria IA, varredura em lote |
| Integracoes | `specs/features/integrations.md` | Meta OAuth, sync, gestao de contas |
| Auth | `specs/features/auth.md` | Login, registro, multi-tenancy, roles |
| Settings | `specs/features/settings.md` | Configuracoes, equipe, regras |

**Workflow SDD:**
1. Antes de codar: leia a spec da feature
2. Durante: implemente conforme a spec
3. Depois: atualize a spec com mudancas (ADDED/MODIFIED/REMOVED)

---

## 🏗️ ARQUITETURA E STACK

- **Frontend**: React 18 + Vite + TypeScript 5
- **Styling**: Tailwind CSS + shadcn-ui + Framer Motion
- **Estado/Data Fetching**: TanStack React Query + React Hook Form + Zod
- **Backend/BaaS**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **UI Kit**: Radix UI + lucide-react + recharts + sonner (toasts)
- **Roteamento**: React Router 6

---

## 📁 ESTRUTURA DE PASTAS E MÓDULOS

```
src/
├── components/          # Componentes UI (organizados por módulo)
│   ├── ui/              # Componentes base (shadcn-ui - button, card, etc.)
│   ├── layout/          # Layout principal (Header, Sidebar)
│   ├── dashboard/       # Métricas, gráficos e resumos
│   ├── campaign-wizard/ # Criação guiada de campanhas
│   ├── google-ads/      # Integração específica do Google Ads
│   ├── settings/        # Configurações do usuário/empresa
│   ├── tags/            # Gerenciamento de tags e eventos
│   └── integrations/    # Telas de configurações de integração
├── pages/               # Páginas roteadas (1 arquivo por rota principal)
│   ├── [Módulo Ads]: Campanhas, Conjuntos, Criativos, AdSetDetalhe, CriativoDetalhe
│   ├── [Módulo Stats]: Dashboard, Diagnosticos, Monitoramento, Relatorios
│   ├── [Módulo Settings]: Empresa, Tags, Integracoes, Settings, Usuarios
│   └── [Módulo Auth]: Login, Register
├── hooks/               # Custom hooks de negócio e state
├── types/               # Tipos TypeScript centralizados
├── integrations/        # Integração Supabase e chamadas de API genéricas
├── config/              # Constantes e configurações
├── lib/                 # Utilitários globais (cn para tailwind-merge, etc)
└── contexts/            # Contextos React (Themes, Auth, etc)
```

---

## 📐 CONVENÇÕES DE NOMENCLATURA

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Componentes | PascalCase | `MetricCard.tsx`, `Dashboard.tsx` |
| Hooks | camelCase com `use` | `useCampaigns()`, `useAuth()` |
| Constantes | UPPER_SNAKE_CASE | `API_ENDPOINTS`, `STATUS_LABELS` |
| Tipos/Interfaces | PascalCase | `CampaignModel`, `UserSession` |
| Páginas | PascalCase | `Campanhas.tsx`, `Conjuntos.tsx` |
| Arquivos TS | kebab-case / camelCase | `supabase.ts`, `utils.ts` |
| Query Keys | kebab-case em array | `['campaign-details', campaignId]` |

---

## 🔧 PADRÃO DE CÓDIGO (OBRIGATÓRIO)

### 1. Componentes

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
// Outros imports

interface Props {
  // tipagem restrita, evite 'any'
}

export default function ComponentName({ prop }: Props) {
  // 1. Hooks (Contextos, Navegação)
  // 2. Data Fetching (React Query)
  // 3. Estado local e Handlers

  if (isLoading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;

  return (
    <div className="flex flex-col gap-4">
      {/* Renderização principal */}
    </div>
  );
}
```

### 2. React Query e Supabase (Hooks)

- Centralizar `useQuery` e `useMutation` em Custom Hooks.
- Tratamento de Sucesso/Erro com Toasts.
- Invalidação de Cache após Mutações.

```typescript
export function useFeature(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['feature', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select().eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('table').insert(payload).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature'] });
      toast.success('Pronto!');
    }
  });

  return { ...query, mutate: mutation.mutateAsync };
}
```

### 3. Tratamento de Erros de Interação

Toda operação do usuário (salvar, apagar, recarregar) deve ter feedback:

```typescript
try {
  await handleAction();
  toast.success("Sucesso!");
} catch (error) {
  console.error(error);
  toast.error("Ocorreu um erro. Tente novamente.");
}
```

---

## 🦸 SISTEMA DE AGENTES (AVENGERS PROTOCOL)

Você, como LLM codificando no projeto, deve atuar como parte desta equipe. Respeite as regras de cada persona que ativar.

**Hierarquia:**

1. **Nick Fury (ARCHITECT)** — Supervisor Geral / Planejador
2. **J.A.R.V.I.S. (SAFETY_PROTOCOL)** — Guardião das restrições e segurança
3. **Professor X (GUARDIAN)** — QA Master / Aprovação Final

**Equipe Core:**
- **Iron Man (SYSTEM)** — Infra do projeto, Dependências, Configurações de Build (Vite/TSconfig)
- **Captain America (SECURITY)** — Supabase RLS (Row Level Security), Políticas, Contexto de Auth
- **Thor (BACKEND)** — Tipos de Supabase, Migrations de DB, Regras de Banco / Database Design
- **Black Widow (DETECTIVE)** — Troubleshooting avançado, descobrir fluxos de erros silenciosos
- **Hulk (FIXER)** — Correções cirúrgicas de estado ou console errors difíceis
- **Hawkeye (WATCHER)** — Monitoramento de timeouts, Performance React, Otimização de Renders
- **Vision (FRONTEND)** — Criação de Telas, shadcn-ui, Componentização Reutilizável
- **Dr. Strange (RESEARCHER)** — Busca e mapeamento em documentação ou na codebase

**Especialistas de Domínio (Específicos deste Repositório):**
- **Star-Lord (ADS_MANAGER)** — Lida com regras de Campanhas, Conjuntos, Criativos, Forms do Wizard e integrações de Plataforma de Ads.
- **Gamora (ANALYTICS_EXPERT)** — Responsável pelo Dashboard, MetricsCards, Integração com Recharts, Agrupamento e Filtragem de Relatórios.

---

## ✅ PROTOCOLO DE AUTO-REVISÃO (3 PASSADAS) - **MANDATÓRIO**

Antes de marcar uma tarefa como "pronto":

1. **Passada 1 — Implementação & Tipagem**
   - Verificar se o TS reclamará (nenhum `any` implícito/explícito injustificado).
   - Componentes exportados corretamente.
2. **Passada 2 — Regras / Limites**
   - Confirmar se feedback UI (toasts e loaders) foram incluídos.
   - Variáveis CSS / Tailwind seguem o padrão central de cores (`bg-primary`, `text-muted-foreground`, etc).
3. **Passada 3 — Integridade / Efeitos Colaterais**
   - A rota quebra caso os dados voltem `null`? Se não houver itens, aparece Empty State?
   - Os Custom Hooks estão invalidando as Queries necessárias?

---

## 🚫 SAFETY PROTOCOL (PROIBIÇÕES ABSOLUTAS)

Não quebrar as seguintes regras sob NENHUMA hipótese sem permissão direta do usuário:

1. **Banco / Auth:** NUNCA force `DROP TABLE`, `TRUNCATE`, ou alterar colunas estruturais ativas que impliquem perda de dados.
2. **Delete Sem Volta:** Não remova chamadas/imports do núcleo do projeto que "parecem não usados" se você não verificou o repositório inteiro.
3. **Arquivos Inteiros:** Não refatore de ponta a ponta blocos gigantescos de código se a tarefa demandava "Mudar cor do botão". Altere o estritamente necessário.
4. **Hardcode de Credenciais:** Supabase Keys, etc. sempre em variáveis de ambiente (`import.meta.env`).

**Para os Agentes:** Sempre assumam que estamos lidando com código em Produção. Preferir migrações "Soft" (adicionar colunas novas e depois migrar dados) a Hard (dropar colunas existentes).
