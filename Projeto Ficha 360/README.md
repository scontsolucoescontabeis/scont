# Ficha 360 do Cliente

Visão única de cada empresa da carteira para a equipe interna Scont.

- **Painel** (`index.html`): todas as empresas com semáforo, filtros e motivos.
- **Ficha** (`index.html?empresa=<codigo>`): Resumo, Cadastro, Vencimentos, DP, Contábil, Anotações, CRM.

## Arquitetura
- `js/fontes.js` busca (Supabase, paralelo, paginado; cada fonte falha isolada).
- `js/vinculos.js`, `js/regras.js`, `js/carteira.js` são puros e testados em Node.
- `js/painel.js`, `js/ficha.js`, `js/cadastro.js`, `js/anotacoes.js` renderizam.
- Reusa `Projeto RH/qsa-analise.js` e `Projeto Onboarding Contabil/contabil-diario-util.js` (não copiar).

## Banco
`_sql/schema_ficha360.sql` — `ficha360_empresa`, `ficha360_contatos`, `ficha360_anotacoes` + RLS + registro em `ferramentas`.
**Pendente de execução manual no SQL Editor do Supabase** — sem ele, as abas Cadastro e Anotações mostram "Configuração pendente" e o resto da ferramenta funciona normalmente.

## Regras do semáforo
Limites em `LIMITES` no topo de `js/regras.js`. Spec: `docs/superpowers/specs/2026-09-14-ficha-360-cliente-design.md`.

## Testes
```bash
for f in "Projeto Ficha 360"/tests/*.test.js; do node "$f"; done
```
