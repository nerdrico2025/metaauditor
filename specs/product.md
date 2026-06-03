# ClickHero Ads Analyzer — Product Spec

## Visao do Produto

ClickHero e uma plataforma de analise e gestao de anuncios pagos (Meta Ads, Google Ads) para agencias de trafego pago e gestores de performance. O objetivo e centralizar dados de multiplas contas de anuncio, fornecer diagnosticos inteligentes via IA, e permitir acoes rapidas (pausar campanhas, ajustar verbas) direto da plataforma.

## Publico-Alvo

- **Agencias de trafego pago** (principal): gerenciam 10-50+ contas de anuncio simultaneamente
- **Gestores de performance in-house**: monitoram campanhas internas
- **Estagiarios/residentes**: acesso limitado para aprendizado e execucao

## Proposta de Valor

1. **Visao unificada**: Dashboard centralizado com todas as contas Meta/Google
2. **Diagnostico IA**: Analise automatica de criativos com scores e recomendacoes acionaveis
3. **Multi-tenancy**: Cada organizacao tem dados isolados — empresas nao veem dados umas das outras
4. **Acoes rapidas**: Pausar campanhas e aumentar verbas diretamente da analise de IA
5. **Regras de conformidade**: Verificacao automatica de criativos contra regras customizaveis

## Modelo de Negocio

- Plano Free: 5 usuarios, 3 integracoes, 20 campanhas, 50 auditorias/mes
- Plano Starter/Pro/Enterprise: limites maiores (futuro)
- Trial: 14 dias para novas organizacoes

## Metricas de Sucesso

- Tempo medio de resposta para identificar criativos com problemas
- Numero de auditorias realizadas por mes
- Taxa de conformidade dos criativos (branding)
- Reducao de CPC/CPA apos recomendacoes da IA

## Organizacoes Ativas

| Organizacao | Tipo | Status |
|-------------|------|--------|
| Click Hero Admin | Agencia (interna) | Ativa — trial |
| Nio | Cliente | Ativa — trial |

## Usuarios e Roles

| Role | Permissoes |
|------|-----------|
| super_admin | Tudo, incluindo admin do sistema |
| company_admin | Tudo dentro da organizacao |
| operador | Tudo exceto Configuracoes e Integracoes |
