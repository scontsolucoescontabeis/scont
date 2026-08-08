# Relatórios: filtrar por "Documentação Disponível" + layout em linha única

## Contexto

Relatórios já filtra por "Status da Grade Mensal" (`contabil_diario_status_mensal`,
com suporte a "todos os meses/anos" — spec 2026-08-08-diario-relatorios-filtro-todos-mes-ano-design.md).
Pedido: adicionar filtro por "Documentação Disponível"
(`contabil_diario_documentacao`) **dentro do mesmo dropdown** de Status da
Grade Mensal (não um filtro separado), e colocar Status/Mês/Ano na mesma
linha da tela.

## O que muda

1. **Dropdown único**: nova `<option value="documentacao_disponivel">📄
   Documentação Disponível</option>` no `<select id="filtroStatusGrade">`,
   junto dos 4 status normais. `filtros.statusGrade` passa a poder valer
   `'documentacao_disponivel'` — um sentinel distinto dos 4 valores reais de
   `contabil_diario_status_mensal.status`.
2. **`ocorrenciasDocumentacaoDisponivel(ctx, codigoEmpresa, filtros)`**
   (nova, espelha `ocorrenciasStatusGrade`): filtra
   `ctx.documentacaoPorEmpresa[codigo]` por `disponivel === true`,
   respeitando `gradeMes`/`gradeAno` (incluindo modo "todos", igual ao
   status). `ctx.documentacaoPorEmpresa` precisou ser exposto em
   `window.__diarioContext` (`diario.js`) — não existia antes porque só
   Relatórios precisa dele fora do módulo principal.
3. **`aplicarFiltros`**: quando `filtros.statusGrade ===
   'documentacao_disponivel'`, usa `ocorrenciasDocumentacaoDisponivel` em
   vez da lógica de status; senão, comportamento de status inalterado.
4. **Coluna "Status da Grade Mensal" do PDF**: mesma ramificação — em modo
   documentação, lista os meses/anos com documentação disponível
   (`Mar/2026, Jun/2026`) em vez do status.
5. **Layout**: "Status da Grade Mensal", "Mês" e "Ano" (+ checkbox "Todos
   os anos") viram uma única linha (`display:flex`) dentro de um `<div
   class="full">`, em vez de dois `<div>` separados fluindo no grid de 2
   colunas da seção de filtros. Rótulos "Mês" e "Ano" ficam
   individuais (antes era um único rótulo "Mês/Ano da Grade" cobrindo os
   dois).

## Fora de escopo

- Sem mudança em `qtdLancamentos`/`ultimoLancamento` (usam
  `periodoDe`/`periodoAte`, já independentes).
- Sem novo toggle "Todos os meses/anos" específico pra documentação — usa
  os mesmos campos `gradeMes`/`gradeAno` já existentes, compartilhados com
  o filtro de status.
