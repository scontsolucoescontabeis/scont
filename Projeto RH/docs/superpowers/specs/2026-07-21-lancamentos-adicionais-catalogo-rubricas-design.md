# Lançamentos Adicionais (Gerar TXT) consome catálogo rh_rubricas

Data: 2026-07-21
Arquivos afetados: `index.html`, `script.js`

## Contexto

Controle de Frequência → modal "Gerar TXT" (`txtRubricasModal`) → seção "Lançamentos Adicionais" permite adicionar lançamentos extras (ex: VT, VA) por empregado antes de baixar o TXT da folha. Hoje (`_adicionarLancamentoAdicional`, `script.js:4457`) o campo Rubrica de cada linha é um `<input type="text">` de digitação livre.

`rh_rubricas` (gerenciada em Administração) já é o catálogo de referência de rubricas por empresa (`codigo_rubrica`, `descricao_rubrica`, `tipo`), e já é consumida do mesmo jeito pela ferramenta Lançamentos (`lancamentos.js`). Este design estende o mesmo padrão para o Controle de Frequência, que processa uma única empresa por vez (`state.empresaSelecionada.codigo_empresa`) — mais simples que o caso de Lançamentos, que lida com lote multi-empresa.

## Mudanças

### 1. Busca do catálogo por empresa

Nova função em `script.js`, ao lado de `_buscarConfigRubricas` (linha ~1899), com o mesmo padrão de cache:

```js
let _cacheCatalogoRubricas = {};

async function _buscarCatalogoRubricas(codigoEmpresa) {
    if (!codigoEmpresa) return [];
    if (_cacheCatalogoRubricas[codigoEmpresa] !== undefined) return _cacheCatalogoRubricas[codigoEmpresa];
    try {
        const { data, error } = await supabaseClient
            .from('rh_rubricas')
            .select('codigo_rubrica, descricao_rubrica, tipo')
            .eq('codigo_empresa', codigoEmpresa)
            .order('descricao_rubrica');
        if (error) throw error;
        _cacheCatalogoRubricas[codigoEmpresa] = data || [];
        return data || [];
    } catch (e) {
        console.error('Erro ao buscar catálogo de rubricas:', e);
        return [];
    }
}
```

Erro nessa busca não bloqueia o fluxo — só deixa o catálogo vazio (o usuário ainda pode usar a opção "Outra rubrica").

### 2. Carregamento em `abrirModalTxtResultados`

Variável de módulo `let _catalogoRubricasAtual = [];`, ao lado de `_cacheConfigRubricas`.

`abrirModalTxtResultados()` (script.js:4433) passa a buscar o catálogo junto com `cfg`:

```js
const codEmp = state.empresaSelecionada?.codigo_empresa;
const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
_catalogoRubricasAtual = codEmp ? await _buscarCatalogoRubricas(codEmp) : [];
```

### 3. Select de rubrica em `_adicionarLancamentoAdicional`

Troca o `<input class="lanc-rubrica">` por:

- `<select class="lanc-rubrica">`: opção vazia "Selecione...", uma opção por item de `_catalogoRubricasAtual` (`value=codigo_rubrica`, texto `"${descricao_rubrica} (${codigo_rubrica})"`), e opção final `value="__manual__"` com texto "Outra rubrica (digitar código)".
- `<input class="lanc-rubrica-manual">`: mesmo input de texto atual (maxlength 9, só dígitos, placeholder "Ex: 000610"), oculto por padrão (`display:none`), com `grid-column: 1 / -1` para ocupar a linha inteira do grid quando visível (o container da linha já é `display:grid` com 5 colunas; um 6º filho cai automaticamente numa linha implícita nova).
- `onchange` do select alterna a visibilidade do input manual (`display: value === '__manual__' ? 'block' : 'none'`) e limpa o valor do manual quando oculta.

### 4. Leitura em `_construirLinhasAdicionais`

```js
const selRubrica = row.querySelector('.lanc-rubrica')?.value || '';
const rubrica = selRubrica === '__manual__'
    ? (row.querySelector('.lanc-rubrica-manual')?.value || '').trim()
    : selRubrica;
```

Resto da função (validação, formatação, montagem da linha do TXT) não muda.

### 5. Tipo do Valor

Continua com o `<select class="lanc-tipo">` manual existente (monetário/horas/dias) — `rh_rubricas.tipo` guarda provento/desconto/informativa, não o formato do valor. Mesma decisão já tomada em Lançamentos.

## Fora de escopo

- Sem mudança de schema em `rh_rubricas` ou `rh_config_rubricas_txt`.
- Sem mudança no layout binário do TXT gerado.
- Administração (`admin.html`/`admin.js`) não muda.
