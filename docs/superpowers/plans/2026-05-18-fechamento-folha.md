# Fechamento Folha de Pagamento – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar ferramenta "Fechamento Folha de Pagamento" iniciando pela empresa Quadrante (cód. 453), que processa planilha Excel de fechamento gerando relatório de rubricas, TXT de lançamentos e relatório de férias ordenado.

**Architecture:** Módulo independente em `Projeto Fechamento Folha/` com index por empresa. Reutiliza tabela `rh_empregados` do Supabase para match de funcionários. Nova tabela `fechamento_rubricas_config` para mapeamento coluna → rubrica.

**Tech Stack:** HTML5, CSS3, JavaScript (ES6+), SheetJS (XLSX), Supabase JS v2, portal-auth-guard.js

---

## Arquivos

| Arquivo | Status |
|---|---|
| `Projeto Fechamento Folha/schema_fechamento.sql` | ✅ criado |
| `Projeto Fechamento Folha/styles.css` | ✅ criado |
| `Projeto Fechamento Folha/index.html` | ✅ criado |
| `Projeto Fechamento Folha/quadrante.html` | ✅ criado |
| `Projeto Fechamento Folha/quadrante.js` | ✅ criado |

## Próximos passos

- [ ] Executar `schema_fechamento.sql` no Supabase
- [ ] Cadastrar funcionários da Quadrante em `rh_empregados` (código_empresa = '453')
- [ ] Ajustar códigos de rubrica na tabela `fechamento_rubricas_config`
- [ ] Adicionar link para `Projeto Fechamento Folha/index.html` no portal principal
- [ ] Testar com planilha real de fechamento
- [ ] Adicionar arquivo de férias quando disponível
