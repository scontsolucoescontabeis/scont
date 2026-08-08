# Visão Geral: mini-grade de "Documentação Disponível" (ano atual)

## Contexto

A tela Visão Geral (`diario.js:renderDashboardDiario`) já mostra, por
empresa, uma mini-grade dos últimos 6 meses da execução contábil
(`miniGradeHtml` → `.mapa-mini-grade` de `.mini-quad`, coloridos por
`status-concluido/pendencia/em_andamento/nao_iniciado`, usando
`ultimosNMeses` + `statusDoMes`). O pedido original era replicar esse
padrão para "Documentação Disponível".

**Revisão**: a primeira versão usou a mesma janela deslizante de 6 meses
(`ultimosNMeses(hoje, 6)`, olhando pra trás a partir do mês atual). Ao
testar, um mês marcado como disponível em Janeiro/2026 não apareceu na
tela em Agosto/2026 — não por bug, mas porque Janeiro ficou fora da janela
"março–agosto". Diferente da execução (que é sobre desempenho passado,
faz sentido olhar pra trás), documentação normalmente é marcada pro mês
atual ou futuro (mês ainda "Não Iniciado"), então uma janela só-passado não
é a mais útil. Trocado para **ano-calendário corrente completo (Jan-Dez)**
em vez de janela relativa a hoje.

## O que muda

1. `miniGradeDocumentacaoHtml(codigoEmpresa)` em `diario.js`: em vez de
   `ultimosNMeses`, monta os 12 meses do ano corrente
   (`Array.from({length:12}, (_, idx) => ({ ano: anoAtual, mes: idx+1 }))`).
   Cada quadradinho reflete `documentacaoDisponivelDoMes(codigoEmpresa, ano, mes)`
   — classe `mini-quad doc-sim` (disponível) ou `mini-quad doc-nao` (não
   disponível), com `title` indicando mês/ano e o estado por extenso.
2. Coluna "Documentação — Ano Atual" na tabela de Visão Geral, **antes**
   da coluna "Últimos 6 meses" (execução) — ordem pedida pelo usuário.
   Mesma visibilidade para todos os perfis que acessam a tela
   (Scont/Admin/Prestador restrito), sem esconder o estado "não
   disponível".
3. CSS: `.mini-quad.doc-sim{ background:var(--brand); }` /
   `.mini-quad.doc-nao{ background:var(--line-soft); }` (mesma cor de marca
   já usada no selo `.doc-disponivel` da grade mensal).

## Fora de escopo

- Não altera a lógica de quem pode marcar/desmarcar documentação (isso
  continua só na grade mensal da página da empresa).
- Sem novo filtro/ordenação na Visão Geral por essa coluna — só exibição.
- Mini-grade de execução (`miniGradeHtml`) continua com a janela deslizante
  de 6 meses — não foi pedido mudar esse comportamento.
