# Relatórios: filtrar "Todos os meses" / "Todos os anos"

## Contexto

O filtro "Status da Grade Mensal" em Relatórios (`diario-relatorios.js`)
hoje exige escolher exatamente 1 mês (`filtroGradeMes`) e 1 ano
(`filtroGradeAno`) — só dá pra checar, por empresa, o status daquele mês
específico. Para achar "todas as empresas que já tiveram Pendência alguma
vez" é preciso repetir a busca mês a mês, ano a ano.

## O que muda

1. **Mês** (`filtroGradeMes`): ganha uma opção extra "Todos os meses" no
   topo do `<select>` (`value=""`), antes dos 12 meses. Continua
   default = mês atual.
2. **Ano** (`filtroGradeAno`): ganha um checkbox "Todos os anos"
   (`chkGradeTodosAnos`) ao lado do input numérico; ao marcar, desabilita o
   input (`disabled`) — o valor do filtro passa a ser `null`.
3. **`lerFiltros()`**: `gradeMes = selectValue === '' ? null : Number(selectValue)`;
   `gradeAno = chkTodosAnos.checked ? null : Number(inputAno.value)`. Os dois
   são independentes — dá pra combinar "mês específico + todos os anos" ou
   "todos os meses + ano específico" também.
4. **Filtro de status (`aplicarFiltros`)**: quando `gradeMes` e/ou
   `gradeAno` é `null`, a checagem deixa de olhar uma chave única
   (`${ano}-${mes}`) e passa a percorrer todas as entradas do bucket de
   `contabil_diario_status_mensal` daquela empresa
   (`ctx.statusMensalPorEmpresa[codigo]`), aplicando as restrições que
   *estão* fixadas (mês OU ano específico, se só um dos dois for "todos") e
   aceitando a empresa se **qualquer** entrada bater o status escolhido.
5. **Coluna "Status da Grade Mensal" no PDF**: com "todos" ativo *e* um
   status escolhido no filtro, a coluna passa a listar os meses/anos que
   bateram aquele status (ex.: `Pendência: Jan/2026, Mar/2025`) em vez de
   um valor único. Sem status escolhido (filtro em branco) e modo "todos"
   ativo, mostra `—` — não há um único mês pra reportar nesse caso.

## Limitação conhecida (fora de escopo resolver)

`contabil_diario_status_mensal` só tem linha quando o mês sai de "Não
Iniciado" (é o *default* implícito da ausência de linha — ver spec
2026-08-07). Isso significa que o modo "todos os meses/anos" só enxerga
ocorrências **explícitas** no banco: funciona bem para caçar
Pendência/Em Andamento/Concluído, mas não tem como buscar "todos os meses
em que a empresa esteve Não Iniciado" (seria todo mês sem registro, incluindo
meses futuros e anteriores à existência do cliente — não é um conjunto
bem definido). Filtrar por "Não Iniciado" com "todos" ativo simplesmente não
vai encontrar nada, o que é o comportamento esperado dado o modelo de dados.

## Fora de escopo

- `qtdLancamentos`/`ultimoLancamento` já usam `periodoDe`/`periodoAte`
  (datas livres, sem essa limitação) — nenhuma mudança.
- Sem paginação/limite novo na consulta — o volume de linhas em
  `statusMensalPorEmpresa` por empresa é pequeno (no máximo 12 por ano
  operado), então iterar o bucket inteiro no client é barato.
