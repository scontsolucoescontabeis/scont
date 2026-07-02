# Grade de Empregados × Rubricas com Valores Individualizados — Lançamentos em Lote

Data: 2026-07-02
Arquivos afetados: `lancamentos.html`, `lancamentos.js`

## Contexto

A ferramenta de Lançamentos em Lote (`lancamentos.html` / `lancamentos.js`) hoje monta cada "parametrização" no Passo 3 com **uma rubrica e um valor único**, aplicado automaticamente a **todos** os empregados marcados no Passo 2, sem possibilidade de excluir alguém ou dar um valor diferente por pessoa. Isso obriga o usuário a criar parametrizações separadas (repetindo a seleção de empregados) sempre que os valores variam de pessoa para pessoa — o caso mais comum na prática (ex: horas extras, adicional noturno, comissões).

O pedido é permitir, dentro do Passo 3, selecionar quais empregados e quais rubricas participam daquele lançamento, com valor individualizável por empregado.

## Modelo de dados

Estado novo em `lancamentos.js` (substitui o fluxo de "um valor por parametrização"):

```js
let rubricasGrid = [];   // [{ id, codigo, tipoValor }]  — colunas da grade
let valoresGrid = {};    // valoresGrid[rubricaId][empregadoKey] = "valor digitado" (string)
```

`empregadosSelecionadosAtual` (já existente, preenchido em `avancarParaParametros()`) continua sendo a fonte das linhas da grade — não muda.

Cada parametrização acumulada (`parametrizacoesAcumuladas`) passa a guardar valores por empregado em vez de um valor único:

```js
{
  id,
  competencia,
  tipoProcesso,
  rubrica,
  tipoValor,
  itens: [ { empregado: "codEmpresa|codEmpregado", valor: "01:30" }, ... ],
  conteudoTXT,
  dataHora
}
```

Célula vazia na grade = aquele empregado não recebe aquela rubrica nesta leva. Não há checkbox de inclusão separado — a presença de um valor preenchido é a própria seleção.

## Passo 3 — nova interação

Layout do card (substitui o formulário atual de rubrica/valor único):

1. **Tipo do Processo** — continua único, no topo do passo, aplicado a toda a grade (todas as rubricas adicionadas nesta leva usam o mesmo tipo de processo).
2. **Adicionar Rubrica** — mini-formulário: Código da Rubrica + Tipo do Valor (horas/monetário/dias) + Valor padrão (opcional). Botão "+ Adicionar Rubrica à Grade":
   - Cria uma nova coluna (`rubricasGrid.push(...)`).
   - Se "valor padrão" foi informado, preenche `valoresGrid[novaId][empKey]` para todos os empregados do Passo 2 (bulk-fill).
   - Pode ser clicado várias vezes para adicionar mais de uma rubrica à mesma grade.
   - Cada coluna tem um chip com código + tipo + botão remover (×). Remover uma coluna apaga `rubricasGrid` e `valoresGrid` daquela rubrica (com `confirm()` simples, sem undo).
3. **Grade** — tabela renderizada dinamicamente:
   - Campo de busca acima da tabela (reaproveita o padrão de `filtrarLista`, adaptado para linhas da tabela) filtrando por código/nome do empregado. Filtrar apenas esconde linhas (`style.display`), não apaga valores digitados.
   - Linhas = empregados de `empregadosSelecionadosAtual` (código empresa + código + nome, mesmo formato exibido hoje no Passo 2).
   - Colunas = `rubricasGrid`, cabeçalho mostra código da rubrica e tipo do valor.
   - Célula = `<input>` texto, `oninput` grava direto em `valoresGrid[rubricaId][empKey]`. Placeholder conforme tipo do valor da coluna (reaproveita a lógica de `atualizarPlaceholderValor`, adaptada por coluna em vez de campo único global).
4. Botão final **"✅ Gerar Parametrizações"** substitui o atual "Adicionar Parametrização":
   - Valida que há pelo menos uma coluna em `rubricasGrid` — senão avisa e não avança.
   - Para cada coluna: monta `itens` a partir de `valoresGrid[rubricaId]` filtrando apenas empregados com valor preenchido; valida formato do valor conforme `tipoValor` da coluna (reaproveita `encodeValorParaTipo`), apontando empregado + rubrica no erro se algo for inválido.
   - Coluna sem nenhum valor preenchido é ignorada, com aviso ao usuário (não bloqueia as demais).
   - Gera `conteudoTXT` por rubrica (uma linha por item, mesmo layout fixo de posições/paddings de hoje) e empilha uma parametrização por coluna em `parametrizacoesAcumuladas` (push de N entradas de uma vez, uma por rubrica da grade).
   - Limpa `rubricasGrid` e `valoresGrid`, avança para o Passo 3.5.

## Passo 3.5 — revisão

O card de cada parametrização hoje mostra um badge único de valor (ex: "R$ 150,50"), que não faz mais sentido com valores individualizados. Passa a mostrar:

- Badge "Rubrica: X" (mantém).
- Badge "N empregados" com valor individual (substitui o badge de valor único).
- Toggle "Ver detalhes ▾" que expande uma tabela simples empregado → valor dentro do próprio card, para conferência antes da exportação final. Colapsado por padrão.

Remoção de parametrização (`removerParametrizacao`) e fluxo de "Adicionar Nova Parametrização" / exportação final (`avancarParaExportacao`, `baixarTXT`) não mudam de comportamento — continuam operando sobre a lista `parametrizacoesAcumuladas`, que já concatena `conteudoTXT` de cada entrada.

## Geração do TXT

`gerarConteudoTXT(comp, tipoProcesso, rubrica, valor, tipoValor, empregados)` muda de assinatura para:

```js
gerarConteudoTXT(comp, tipoProcesso, rubrica, tipoValor, itens)
// itens: [{ empregado: "codEmpresa|codEmpregado", valor: "..." }]
```

Uma linha de TXT por item, usando o `valor` daquele item específico em vez de um valor único repetido para todos. Layout fixo de posições (`fixo`, `codEmpregadoFormatado`, `compFormatada`, `rubFormatada`, `tipoProcFormatado`, `valFormatado`, `codEmpresaFormatada`) permanece idêntico ao atual.

## Validações / edge cases

- Nenhuma rubrica adicionada à grade → aviso "Adicione ao menos uma rubrica à grade.", não avança.
- Rubrica adicionada mas nenhuma célula preenchida ao gerar → aviso informativo, coluna ignorada, demais colunas válidas seguem normalmente.
- Valor de célula em formato inválido (ex: horas fora de `HH:MM`, monetário/dias com caracteres não numéricos após limpeza) → aviso apontando empregado + rubrica específicos, não avança até corrigir ou limpar a célula.
- Remover coluna de rubrica com valores já digitados → `confirm()` de segurança antes de descartar.
- Passo 2 inalterado: continua controlando o universo de empregados (linhas) que aparecem na grade do Passo 3.

## Fora de escopo

- Não altera o layout binário do arquivo TXT exportado (posições/paddings).
- Não adiciona persistência entre sessões (a grade e as parametrizações continuam vivendo em memória, como hoje).
- Não muda o Passo 1 (competência/empresas) nem o Passo 2 (seleção de empregados).
