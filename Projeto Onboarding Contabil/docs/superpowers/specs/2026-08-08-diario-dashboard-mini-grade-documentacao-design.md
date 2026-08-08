# Visão Geral: mini-grade de "Documentação Disponível" (últimos 6 meses)

## Contexto

A tela Visão Geral (`diario.js:renderDashboardDiario`) já mostra, por
empresa, uma mini-grade dos últimos 6 meses da execução contábil
(`miniGradeHtml` → `.mapa-mini-grade` de `.mini-quad`, coloridos por
`status-concluido/pendencia/em_andamento/nao_iniciado`, usando
`ultimosNMeses` + `statusDoMes`). O pedido é replicar exatamente esse
padrão para "Documentação Disponível" — mesma janela de 6 meses, mesmo
componente visual, trocando a fonte de dado.

## O que muda

1. Nova função `miniGradeDocumentacaoHtml(codigoEmpresa)` em `diario.js`,
   espelhando `miniGradeHtml`: mesmo `ultimosNMeses(hoje, 6)`, mas cada
   quadradinho reflete `documentacaoDisponivelDoMes(codigoEmpresa, ano, mes)`
   em vez de `statusDoMes` — classe `mini-quad doc-sim` (disponível) ou
   `mini-quad doc-nao` (não disponível), com `title` indicando mês/ano e o
   estado por extenso.
2. Nova coluna na tabela de Visão Geral, "Documentação — Últimos 6 meses",
   ao lado de "Últimos 6 meses" (execução) — mesma visibilidade para todos
   os perfis que acessam a tela (Scont/Admin/Prestador restrito), sem
   esconder o estado "não disponível" — mesmo comportamento da mini-grade
   de execução, que também mostra todos os estados pra todo mundo.
3. CSS: `.mini-quad.doc-sim{ background:var(--brand); }` /
   `.mini-quad.doc-nao{ background:var(--line-soft); }` (mesma cor de marca
   já usada no selo `.doc-disponivel` da grade mensal).

## Fora de escopo

- Não altera a lógica de quem pode marcar/desmarcar documentação (isso
  continua só na grade mensal da página da empresa).
- Sem novo filtro/ordenação na Visão Geral por essa coluna — só exibição,
  espelhando a coluna de execução existente.
