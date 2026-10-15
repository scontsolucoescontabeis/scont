# Projeto PDI — Plano de Desenvolvimento Individual

Ferramenta do Portal Scont (apenas equipe Scont). Spec: `docs/superpowers/specs/2026-10-15-pdi-design.md`.

## Instalação (Supabase do portal, SQL Editor, nesta ordem)
1. `_sql/schema_pdi.sql` — tabelas `pdi_*`, RLS, triggers, bucket `pdi-relatorios`.
2. `_sql/seed_pdi.sql` — modelo "Assistente de Departamento Pessoal" + PDI de exemplo (Julia Costa Faria).
3. `_sql/add_ferramenta_pdi.sql` — registra a ferramenta; depois libere em Gerenciar Acessos.
4. Em Administração → "Sócios": vincule cada sócio (cadastro da empresa 48 em `rh_socios`) a um usuário.
5. Em Administração → PDIs: vincule os usuários do colaborador e do gestor.

Não há Edge Function nem cron nesta versão (alertas são calculados na abertura das telas).

## Papéis
Colaborador (por PDI), gestor (por PDI), sócio (global, via `pdi_socios`), admin (`usuarios.is_admin`).

## Testes
```
node tests/pdi-calculo.test.js; node tests/textos.test.js; node tests/alertas.test.js; node tests/fidelidade.test.js
psql -f tests/rls_pdi.sql          # Postgres descartável com stubs de auth/storage
DOCX_LIB=<node_modules/docx/build/index.cjs> node tests/docx.test.js
```
`tests/harness-visual.html` renderiza as telas com dados simulados (sem Supabase).
`tools/gerar-seed.js` regenera `_sql/seed_pdi.sql` a partir de `js/textos.js`.
