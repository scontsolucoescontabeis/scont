# Relatórios: coluna automática de meses + filtros no título do PDF

## Contexto

Extensão do filtro "Documentação Disponível" adicionado no dropdown de
Status da Grade Mensal (spec 2026-08-08-diario-relatorios-filtro-documentacao-disponivel-design.md).
Dois problemas apontados depois de usar: (1) a coluna que lista os meses
batidos (`statusGrade`, com a lógica de `ocorrenciasDocumentacaoDisponivel`
já implementada) é opcional — se o usuário não marcar o checkbox em
"Colunas do Relatório", o PDF não mostra quais meses bateram o filtro; (2)
o PDF não deixa registrado quais filtros geraram aquele relatório.

## O que muda

1. **Coluna automática**: em `renderResultados`, quando
   `filtros.statusGrade === 'documentacao_disponivel'`, o checkbox da
   coluna `statusGrade` vem **pré-marcado** (mas não travado — o usuário
   ainda pode desmarcar) e com rótulo trocado pra "Meses com Documentação
   Disponível" em vez de "Status da Grade Mensal" — mais claro nesse modo.
   Mesma troca de rótulo no cabeçalho da tabela do PDF
   (`gerarPdfRelatorio`), condicionada ao mesmo `filtros.statusGrade`.
   Reaproveita a lógica de listagem de meses já existente no `case
   'statusGrade'` — nenhuma coluna nova criada.
2. **Resumo de filtros no PDF**: nova função `resumoFiltrosTexto(ctx,
   filtros)`, monta uma linha só com os filtros **de fato ativos**
   (arrays vazios e campos em branco são omitidos) — Nível de Atenção,
   Situação do Ano, Status da Grade Mensal (com mês/ano ou "todos"),
   Banco, Regime Tributário, Financeiro Interno/BPO, período de
   Lançamentos. Sem nenhum filtro ativo, mostra "Sem filtros aplicados".
   Impressa logo abaixo da barra de título do PDF, quebrando linha via
   `doc.splitTextToSize` quando não cabe na largura da página — a tabela
   (`doc.autoTable`) começa depois dessas linhas (`startY` calculado
   dinamicamente pela quantidade de linhas do resumo, em vez do valor fixo
   `MARGEM + 22` de antes).

## Fora de escopo

- Sem mudança nos filtros em si — só o que já é mostrado/impresso.
- Resumo de filtros não aparece na tela (só no PDF gerado) — a tela de
  filtros já mostra o que está selecionado nos próprios campos.
