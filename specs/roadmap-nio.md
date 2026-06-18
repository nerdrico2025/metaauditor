# 📊 ClickAuditor — Roadmap de Funcionalidades & Próximos Passos (Cliente: NIO / OI)

> **Documento estratégico** — Atualizado em 2026-06-18
> **Contexto:** O ClickHero Ads Analyzer (ClickAuditor) terá **um único cliente: a NIO** (empresa que comprou a OI, gigante de telecom). Anunciante direto de grande escala, **usa apenas Meta (Facebook/Instagram)**. As 3 dores a resolver são simultâneas: compliance/branding, performance/budget e economia de tempo de análise manual.

---

## A tese do produto

O ClickAuditor **não é um SaaS de aquisição em massa**. É uma **ferramenta interna de profundidade para um anunciante telecom de altíssimo volume**.

Telecom como a OI significa:
- **Centenas de campanhas** (nacional + regional)
- **Milhares de criativos**
- **Budget enorme**
- **Exigência regulatória pesada** (Anatel, CDC, divulgação de preço/letra miúda, fidelidade, validade de promoção)

**Consequência prática:** não falta funcionalidade nova — falta **robustez na escala deles** e **profundidade nas 3 dores**. Adicionar Google Ads, billing ou onboarding de aquisição seria desperdício de energia.

---

## Estado atual da plataforma (diagnóstico)

| Pilar | Estado | Observação |
|-------|--------|-----------|
| Dashboard duplo (Performance + Branding) | ✅ Completo | KPIs, gráficos, funil, deep-links |
| Hierarquia Campanhas → Conjuntos → Criativos | ✅ Completo | Drill-down + auditorias por nível |
| Meta OAuth + Sync (cron 3h) | ✅ Completo | Dedup de conversões corrige inflação 2-3× |
| Auditoria IA dual-focus (DeepSeek + OpenAI vision) | ✅ Completo | Cache incremental por regra, batch até 50 |
| Multi-tenancy + RLS + roles | ✅ Completo | Isolamento por `company_id` |
| FURY (automação) | 🟡 Fase 1 de 5 | Tabela + undo existem; falta o motor completo |
| Google Ads | 🔴 Stub | **Fora do escopo NIO** |
| ML/preditivo | 🔴 Planejado | Hoje tudo determinístico |

O motor (sync, IA, compliance) é forte. As lacunas reais para a NIO são: **robustez em escala**, **profundidade regulatória** e **automação de ação (FURY)**.

---

## ❌ O que sai do roadmap (eram prioridades na tese errada de "SaaS")

- Google Ads (stub) e TikTok — **só Meta**.
- Billing, planos, limites de uso, trial.
- White-label / relatório agência→cliente — NIO é anunciante direto.
- Onboarding de aquisição em massa, fluxo de registro otimizado.
- Hardening genérico de multi-tenancy.

---

## 🔴 PRIORIDADE 0 — Robustez na escala da OI (semanas 1-4)

*Se quebrar no volume deles, nada mais importa. Os riscos técnicos viram bloqueadores reais.*

| # | Iniciativa | Por quê para a OI |
|---|-----------|-------------------|
| 0.1 | **Remover o teto de 50 páginas na paginação Meta** + paginação cursor completa | OI tem volume que **vai truncar dados** silenciosamente — relatório errado é pior que relatório nenhum |
| 0.2 | **Fila resiliente para batch >100 criativos** (resumível, sem timeout) | Hoje batch full dá timeout; a OI tem milhares de criativos |
| 0.3 | **Auto-refresh de token Meta (cron)** | Token expira ~60d → conta "morre" calada. Inaceitável num cliente único |
| 0.4 | **Remover o limite de 15 contas monitoradas** (ou elevar conforme a estrutura da OI) | OI provavelmente tem muitas contas/BMs (regional + produtos) |
| 0.5 | **Loading incremental + timeout/fallback** no Dashboard | Com muito dado, o "tudo ou nada" trava a tela |
| 0.6 | **Fallback de IA** além de DeepSeek+OpenAI e fila de retry da vision | Ponto único de falha; com 1 cliente, indisponibilidade = ferramenta inútil |

---

## 🟠 PRIORIDADE 1 — Compliance regulatório (o diferencial telecom) (semanas 3-8)

*Aqui mora o maior valor único para a OI. Marca grande + setor regulado = compliance é o killer feature, não apenas logo.*

| # | Iniciativa |
|---|-----------|
| 1.1 | **Biblioteca de regras de compliance telecom** prontas: divulgação de preço, "consulte condições", letra miúda legível, regras Anatel/CDC, prazo de fidelidade, validade de promoção |
| 1.2 | **Auditoria de texto legal no criativo** (não só logo): a vision já existe — estender prompts para detectar ausência de disclaimers obrigatórios |
| 1.3 | **Painel de risco de compliance por campanha/região** — "X criativos no ar sem aviso legal obrigatório" |
| 1.4 | **Reforçar o gate de branding** — bloquear veiculação de criativo não-conforme em escala, com aprovação por lote |

> Esse bloco é o que justifica a OI manter a ferramenta: nenhum dashboard genérico faz auditoria regulatória de criativo automaticamente.

---

## 🟡 PRIORIDADE 2 — FURY + eficiência do time (mês 2-3)

*"Otimizar budget" e "economizar tempo manual" — as outras 2 dores.*

| # | Iniciativa |
|---|-----------|
| 2.1 | **Completar FURY (Fases 2-5)**: média móvel 7d, regras (saturação/fadiga, CPA alto, CTR baixo, budget esgotado, escala), cron, feed `/fury`, **modo aprovação** (importante numa empresa grande — automação com gente no loop) |
| 2.2 | **Detecção de fadiga de criativo na UI** (edge function já existe) — telecom satura criativo rápido por alta frequência |
| 2.3 | **Alertas reais** (RESEND/Twilio — só falta configurar secrets) para o time interno: queda de performance, conta dessincronizada, criativo não-conforme |
| 2.4 | **Ações em lote + filtros visíveis + breadcrumbs** — com centenas de campanhas, navegação e operação em massa deixam de ser "nice to have" |
| 2.5 | **Relatórios agendados em PDF** para reporte interno executivo (não white-label) |

---

## 🔵 PRIORIDADE 3 — Profundidade analítica (mês 3+)

- Auditoria de **público/segmentação** e de **campanha/conjunto** (hoje rasas vs criativo).
- **Visão regional** (OI é nacional — comparar performance/compliance por praça).
- **Copiloto sobre os dados** (evolução do `ai-chat`): _"por que o CPA da campanha de fibra subiu em SP essa semana?"_.
- **ML preditivo** só depois que o determinístico estiver rodando estável.

---

## Riscos técnicos a vigiar (mapeados na pesquisa)

1. **Paginação Meta limitada a 50 páginas** → dados truncam em conta grande.
2. **Batch full mode dá timeout >100 criativos** → precisa de fila/resumo.
3. **Vision depende exclusivamente do OpenAI** (DeepSeek não é multimodal) → ponto único de falha.
4. **Sem fallback após DeepSeek+OpenAI** → se ambos caem, auditoria para.
5. **Animação de sync trava na conclusão** (bug conhecido de estado não atualizado).
6. **Facebook App ID ainda é placeholder** em `src/config/facebook.ts` → bloqueia OAuth se não configurado.

---

## Sequência recomendada

1. **Prioridade 0** — sem robustez na escala da OI, todo o resto trava ou mente nos números.
2. **Prioridade 1 (compliance)** — é o valor único que prende a OI.
3. **FURY + alertas** — budget e tempo.
4. **Profundidade analítica** — refino.

---

## Pergunta em aberto que afeta o detalhamento

**A OI opera com muitas contas Meta separadas por região/produto, ou é tudo numa BM só?**
Isso define quanto de trabalho vai para estrutura multi-conta (Prioridade 0.4) vs. visão regional dentro de uma conta (Prioridade 3).
