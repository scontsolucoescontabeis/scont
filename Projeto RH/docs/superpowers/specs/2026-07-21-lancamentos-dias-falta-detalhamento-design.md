# Lançamentos: detalhamento de dias para rubricas "Dias Falta" / "Dias Falta DSR"

Data: 2026-07-21
Arquivos afetados: `lancamentos.js`, `lancamentos.html`

## Contexto

Na ferramenta Lançamentos (`lancamentos.html`/`lancamentos.js`), a grade Empregado x Rubrica trata todas as rubricas do mesmo jeito: uma célula de texto livre por empregado, convertida para inteiro conforme `tipoValor` (`horas`/`monetario`/`dias`) e virando uma única linha `10...` no TXT (`gerarConteudoTXT`).

No Controle de Frequência (`script.js`), ao lançar falta, além da linha de rubrica (`10...`) o sistema já gera uma linha informativa por dia de falta, no formato:

```
11 + data (AAAAMMDD) + flag (1 = não gera perda de DSR, 2 = gera perda de DSR)
```

(`_linhasFaltas`, `script.js`). Essa linha não carrega código de empregado/empresa — ela é posicionalmente associada à linha `10...` do empregado que vem logo acima dela no arquivo.

Este design estende o Lançamentos para gerar o mesmo tipo de linha informativa quando a rubrica lançada for "Dias Falta" ou "Dias Falta DSR", imediatamente abaixo da linha `10...` daquele empregado.

## Decisões (confirmadas com o usuário)

1. **Identificação da rubrica**: automática, por nome. A descrição da rubrica (normalizada: maiúsculas, sem ponto final) é comparada — se contém `"DIAS FALTAS"` e não contém `"DSR"` → tipo `normal`; se contém `"DIAS FALTAS"` e `"DSR"` → tipo `dsr`. Cobre as variações já vistas no catálogo (`DIAS FALTAS`, `DIAS FALTAS 1`, `DIAS FALTAS DSR`, `DIAS FALTAS DSR.`). Vale tanto para rubrica escolhida no catálogo quanto para código manual ("Outra rubrica"), desde que o código bata com alguma descrição já carregada no lote.
2. **Input do usuário**: continua uma única célula de texto por empregado x rubrica — só que para rubricas de falta o conteúdo esperado é uma lista de dias do mês da competência, separados por vírgula (ex: `5,12,20`), em vez de um número solto.
3. **Flag DSR**: fixo pela rubrica escolhida, aplicado a todas as datas daquele lançamento — rubrica "Dias Falta" → flag `1` para todas as datas; rubrica "Dias Falta DSR" → flag `2` para todas as datas. Não há mistura de flags dentro do mesmo lançamento.
4. **Quantidade de dias**: calculada automaticamente pela contagem de dias distintos informados na lista — não há campo de quantidade separado, elimina risco de divergência.

## Mudanças

### 1. Detecção da rubrica (`detectarFaltaTipo`)

```js
function _normalizarDescricaoRubrica(descricao) {
    return String(descricao || '').toUpperCase().trim().replace(/\.+$/, '').trim();
}

function detectarFaltaTipo(descricao) {
    const norm = _normalizarDescricaoRubrica(descricao);
    if (!norm.includes('DIAS FALTAS')) return null;
    return norm.includes('DSR') ? 'dsr' : 'normal';
}
```

Rodada em `adicionarRubricaGrade()` (a partir de `item.descricao` no caminho do catálogo, ou `catalogado.descricao_rubrica` no caminho manual) e guardada na coluna: `novaColuna.faltaTipo` (`'normal' | 'dsr' | null`).

Quando detectado, `tipoValor` da coluna é forçado para `'dias'` independente do que estava selecionado no formulário.

### 2. Trava do formulário ao selecionar a rubrica

`onRubricaSelecaoChange()` (disparado no `<select id="gradeRubricaSelecao">`) e um novo handler `onCodigoManualInput()` (disparado no input de código manual) checam a descrição da rubrica selecionada/digitada e chamam `_aplicarTravaFaltaNoFormulario(faltaTipo)`:

- Se `faltaTipo` detectado: `<select id="gradeRubricaTipoValor">` vai para `dias` e fica `disabled`; a dica do campo "Valor Padrão" muda para explicar o formato de lista de dias.
- Caso contrário: campo reabilitado, dica volta ao padrão (`atualizarPlaceholderValorPadrao()`).

`lancamentos.html`: o input `#gradeRubricaCodigo` ganha a chamada a `onCodigoManualInput()` no `oninput` existente.

### 3. Placeholder/dica por coluna já na grade

Nova função `placeholderColuna(coluna)`, usada em `renderGrade()` (cabeçalho da coluna e placeholder/title de cada célula) no lugar de `infoTipoValor(coluna.tipoValor)` direto:

```js
function placeholderColuna(coluna) {
    if (coluna.faltaTipo) {
        return { placeholder: 'Ex: 5,12,20', dica: 'Dias do mês da competência com falta, separados por vírgula' };
    }
    return infoTipoValor(coluna.tipoValor);
}
```

Chip da rubrica na grade (`chipsContainer`) ganha sufixo indicando o tipo detectado (`· falta` / `· falta c/ DSR`).

### 4. Validação (`validarFormatoDiasFalta`)

```js
function parseDiasFalta(valor) {
    return [...new Set(String(valor).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)))].sort((a, b) => a - b);
}

function ultimoDiaDoMes(comp) {
    const [mes, ano] = comp.split('/').map(Number);
    return new Date(ano, mes, 0).getDate();
}

function validarFormatoDiasFalta(valor, comp) {
    const v = String(valor).trim();
    if (!v) return { ok: false, motivo: 'vazio' };
    if (!/^\d{1,2}(\s*,\s*\d{1,2})*$/.test(v)) return { ok: false, motivo: 'formato' };
    const ultimoDia = ultimoDiaDoMes(comp);
    const diaInvalido = parseDiasFalta(v).find(d => d < 1 || d > ultimoDia);
    if (diaInvalido !== undefined) return { ok: false, motivo: 'intervalo', diaInvalido, ultimoDia };
    return { ok: true };
}
```

Em `gerarParametrizacoes()`, para colunas com `faltaTipo`, a validação por item passa a usar `validarFormatoDiasFalta(valor, comp)` em vez de `validarFormatoValor`, com mensagem de erro específica (dia fora do intervalo do mês, ou formato inválido).

### 5. Geração do TXT (`gerarConteudoTXT`)

Para colunas com `faltaTipo`:
- O valor inteiro da linha `10...` passa a ser a contagem de dias distintos (`parseDiasFalta(item.valor).length`), em vez de `encodeValorParaTipo`.
- Logo após escrever a linha `10...` daquele empregado, uma linha `11...` é escrita para cada dia, na mesma ordem (crescente):

```js
if (coluna.faltaTipo && diasFalta.length > 0) {
    const flag = coluna.faltaTipo === 'dsr' ? '2' : '1';
    diasFalta.forEach(dia => {
        conteudo += `11${compFormatada}${String(dia).padStart(2, '0')}${flag}\n`;
    });
}
```

Isso garante que a(s) linha(s) informativa(s) do empregado fiquem imediatamente abaixo da linha de lançamento da rubrica dele, antes do próximo empregado do loop.

## Fora de escopo

- Sem mudança de schema (`rh_rubricas`, `rh_config_rubricas_txt`).
- Sem calendário visual — entrada continua sendo texto livre (lista de dias separados por vírgula).
- Não altera o Controle de Frequência (`script.js`) nem a Administração.
- Não cobre o caso de código manual cujo código não bate com nenhuma descrição já carregada no lote (nesse caso a rubrica se comporta como antes, sem detalhamento de dias).
