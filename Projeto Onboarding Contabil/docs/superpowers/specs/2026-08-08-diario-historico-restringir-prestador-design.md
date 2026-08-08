# Restringir Histórico por responsável (Prestador de Serviço)

## Contexto

O Diário Contábil já restringe, para usuários vinculados à empresa
"Prestador de Serviço" (não-admin), quais empresas aparecem no seletor
geral e na grade — `_restringirSeletor` filtra o array `empresas` por
`_meusResponsaveisSet` (`contabil_empresas_responsaveis`) em
`carregarDadosDiario` (`diario.js:126`). A aba **Relatórios** já herda essa
restrição de graça, porque monta sua lista de empresas a partir de
`ctx.empresas` (o mesmo array já filtrado) — nenhuma mudança necessária ali,
confirmado com o usuário.

A aba **Histórico** (`diario-historico.js`) não herda nada: consulta
`contabil_diario_lancamentos` e `contabil_diario_auditoria` diretamente, sem
nenhum filtro de empresa, então hoje qualquer usuário autenticado — inclusive
um Prestador restrito — vê alterações de todas as empresas do sistema. RLS
nessas tabelas é `authenticated: true` (mesmo padrão client-side-gating do
resto do módulo), então o gating precisa acontecer no client, como em todo o
resto do Diário.

## O que muda

1. **Contexto compartilhado** (`diario.js:174`, `window.__diarioContext`):
   expõe dois novos campos, lidos de variáveis que já existem no módulo —
   - `restringirPorResponsavel: _restringirSeletor`
   - `meusResponsaveisCodigos: Array.from(_meusResponsaveisSet)`
2. **`diario-historico.js` → `buscar(ctx)`**: quando
   `ctx.restringirPorResponsavel` é `true`,
   - se `ctx.meusResponsaveisCodigos` estiver vazio, não consulta nada —
     mostra direto o estado vazio ("Nenhuma empresa atribuída a você.",
     reaproveitando o bloco de "Nenhuma alteração encontrada" já existente
     em `renderResultados`, com o texto trocado);
   - senão, adiciona `.in('codigo_empresa', ctx.meusResponsaveisCodigos)`
     em **ambas** as queries (`contabil_diario_lancamentos` e
     `contabil_diario_auditoria`) **antes** do `.limit(LIMITE)` já
     existente. Filtrar na query (não depois do fetch, como o campo de
     busca por texto já faz) evita que as `LIMITE` linhas mais recentes do
     sistema sejam dominadas por empresas fora da responsabilidade do
     usuário, escondendo alterações recentes das empresas dele.
3. **Sem mudança de UI**: mesmos filtros (empresa/data), mesma tabela de
   resultado — só o universo de dados consultado muda para quem é
   restrito. Admin e equipe Scont continuam vendo tudo (comportamento atual
   preservado).

## Fora de escopo

- Relatórios: já correto via `ctx.empresas`, nenhuma mudança.
- RLS real no banco: continua client-side gating, mesmo padrão do resto do
  módulo — mudar para RLS de verdade seria uma revisão maior, não pedida
  aqui.
- Nenhuma mudança de schema/SQL.
