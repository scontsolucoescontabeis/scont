# Visão Geral: mini-grades de "Documentação" e "Contabilidade" (ano atual)

## Contexto

A tela Visão Geral (`diario.js:renderDashboardDiario`) mostra, por empresa,
duas mini-grades lado a lado — `.mapa-mini-grade` de `.mini-quad` — uma pra
execução contábil (`miniGradeHtml`, existente) e uma nova pra "Documentação
Disponível" (`miniGradeDocumentacaoHtml`, pedida nesta rodada). O pedido
original era replicar exatamente o padrão da execução (janela deslizante de
6 meses, via `ultimosNMeses`) pra documentação.

**Revisão 1**: ao testar, um mês marcado como disponível em Janeiro/2026
não apareceu na tela em Agosto/2026 — não por bug, mas porque Janeiro ficou
fora da janela deslizante "março–agosto". Documentação normalmente é
marcada pro mês atual ou futuro (mês ainda "Não Iniciado"), então uma
janela só-passado não é a mais útil ali. Trocado pra
**ano-calendário corrente completo (Jan-Dez)**, sem depender da data de
hoje.

**Revisão 2**: pedido pra aplicar a mesma mudança (ano-calendário completo)
também na mini-grade de **execução** (`miniGradeHtml`), abandonando de vez
a janela deslizante de 6 meses — as duas mini-grades agora usam o mesmo
critério (Jan-Dez do ano corrente), só a fonte de dado difere
(`statusDoMes` vs. `documentacaoDisponivelDoMes`). Cabeçalhos renomeados
para "Documentação — Ano Atual" e "Contabilidade — Ano Atual".

## O que muda

1. `miniGradeHtml(codigoEmpresa)` e `miniGradeDocumentacaoHtml(codigoEmpresa)`
   em `diario.js`: ambas montam os 12 meses do ano corrente —
   `Array.from({length:12}, (_, idx) => ({ ano: anoAtual, mes: idx+1 }))` —
   em vez de `ultimosNMeses`. `miniGradeHtml` mapeia cada mês via
   `statusDoMes` (cores `status-concluido/pendencia/em_andamento/nao_iniciado`,
   como já era); `miniGradeDocumentacaoHtml` via
   `documentacaoDisponivelDoMes` (`mini-quad doc-sim`/`doc-nao`).
2. Colunas da tabela de Visão Geral, nesta ordem: Empresa, Regime,
   Responsável, Nível, Pendências, **Documentação — Ano Atual**,
   **Contabilidade — Ano Atual** (documentação antes de contabilidade,
   ordem pedida pelo usuário). Mesma visibilidade pra todos os perfis que
   acessam a tela (Scont/Admin/Prestador restrito), sem esconder nenhum
   estado.
3. CSS: `.mini-quad.doc-sim{ background:var(--brand); }` /
   `.mini-quad.doc-nao{ background:var(--line-soft); }` (mesma cor de marca
   já usada no selo `.doc-disponivel` da grade mensal); estados de
   `status-*` inalterados.

## Fora de escopo

- Não altera a lógica de quem pode marcar/desmarcar documentação ou
  transicionar status da grade (isso continua só na grade mensal da página
  da empresa).
- Sem novo filtro/ordenação na Visão Geral por essas colunas — só exibição.
- `ContabilDiarioUtil.ultimosNMeses` continua existindo (com teste próprio
  em `test-contabil-diario-util.js`) mesmo sem uso direto em `diario.js`
  agora — é utilitário genérico, não peculiar dessa tela.
