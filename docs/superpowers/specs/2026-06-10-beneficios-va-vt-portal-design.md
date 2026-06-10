# Design: Adicionar Benefícios VA/VT ao Portal SCONT

**Data:** 2026-06-10  
**Status:** Aprovado

## Objetivo

Registrar a ferramenta Benefícios VA/VT na tabela `ferramentas` do Supabase para que ela apareça no grid do portal, e migrar o controle de "abrir em nova aba" do código hardcoded para o banco de dados.

## Contexto

O portal (`portal.html`) carrega ferramentas dinamicamente da tabela `ferramentas` do Supabase. A decisão de abrir em nova aba hoje usa uma regex hardcoded (`/\/crm\b/`) em vez de um campo no banco — isso não escala. O SQL `_sql/add_beneficios_va_vt.sql` já existe parcialmente mas precisa do UPDATE do CRM.

## Arquivos Alterados

### 1. `_sql/add_beneficios_va_vt.sql`

Reescrever para conter três operações idempotentes:

1. `ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false`
2. `UPDATE ferramentas SET nova_aba = true WHERE url_base LIKE '%crm%'` — garante que CRM continue abrindo em nova aba após a migração
3. `INSERT INTO ferramentas (..., nova_aba) SELECT ..., false WHERE NOT EXISTS (...)` — insere Benefícios VA/VT com `ordem = 160`

### 2. `portal.html` — 3 pontos cirúrgicos

| Local | Mudança |
|---|---|
| Query admin (`select(...)`) | Adicionar `nova_aba` ao select |
| Query usuário (select aninhado em `usuario_ferramentas`) | Adicionar `nova_aba` ao select de `ferramentas(...)` |
| `criarCardFerramenta` | `const novaAba = !!f.nova_aba` (remove regex `/\/crm\b/`) |

## Comportamento Esperado

- Admin vê card "Benefícios VA/VT" automaticamente após SQL executado
- CRM continua abrindo em nova aba (controlado por `nova_aba = true` no banco)
- Benefícios abre na mesma aba (`nova_aba = false`)
- Ferramentas futuras controlam comportamento de aba pelo banco, sem tocar em código

## O que NÃO muda

- Layout do portal — nenhum estilo alterado
- Lógica de auth, RLS, ou ordem de carregamento
- O `portal-auth-guard.js` já está integrado ao `index.html` do Benefícios

## Execução do SQL

O arquivo SQL deve ser executado manualmente no SQL Editor do Supabase (projeto Portal SCONT) após o código do portal ser atualizado (ou em paralelo — o `DEFAULT false` garante compatibilidade retroativa).
