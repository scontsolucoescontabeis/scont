# rh_rubricas como Catálogo — Ajustes no Lançamentos

Data: 2026-07-14
Arquivos afetados: `lancamentos.html`, `lancamentos.js`, geração de um `.xlsx` de importação em massa (fora do código do site)

## Contexto

O mapeamento de rubricas extraído do relatório `Resumo Mensal_TODAS EMPRESAS.pdf` (ver `docs/rubricas-por-empresa.md`) vai popular a tabela `rh_rubricas`, já existente e gerenciada em Administração (`admin.html`/`admin.js`), que guarda por empresa: `codigo_rubrica`, `descricao_rubrica`, `tipo` (provento/desconto/informativa). `rh_rubricas` passa a ser o catálogo de referência de "quais rubricas existem em cada empresa" — as ferramentas de Controle de Frequência e Lançamentos devem ler dela em vez de exigir digitação livre de código.

A tabela `rh_config_rubricas_txt` (Controle de Frequência) continua existindo sem mudanças de schema — ela é quem guarda `tipo_valor` (horas/monetário/dias), informação que `rh_rubricas` não tem e que é necessária pra gerar o TXT de folha corretamente.

Este design cobre dois pontos, decorrentes de uma sessão de brainstorming anterior que já havia introduzido (e agora reverte parcialmente) a feature de "rubricas personalizadas" no Lançamentos:

1. **Inserção em massa** dos dados extraídos em `rh_rubricas`, reaproveitando o import já existente em Administração.
2. **Consumo do catálogo** pelo Lançamentos: remoção da criação de rubricas personalizadas (que duplicava `rh_rubricas`) e adição de busca no catálogo no seletor do Passo 3.

Controle de Frequência (`index.html`/`script.js`) fica fora de escopo nesta rodada — decisão explícita do usuário.

## Parte 1 — Inserção em massa em `rh_rubricas`

`admin.js` (`importarRubricasIndividual`, linha ~1876) já lê um arquivo com colunas fixas `['codigo_empresa','empresa','codigo_rubrica','descricao_rubrica','tipo']` (primeira linha ignorada como cabeçalho) e faz upsert em `rh_rubricas` por `(codigo_empresa, codigo_rubrica)` — ou substituição total por empresa, à escolha do usuário no momento do upload.

Ação: gerar um arquivo `.xlsx` com exatamente essas 5 colunas, uma linha por par (empresa, rubrica) já deduplicado em `docs/rubricas-por-empresa.md` (2.039 linhas), reaproveitando a mesma normalização de nome já aplicada lá (rubricas de desconto de consignado com número de contrato variável usam o nome sem o sufixo `N° <contrato>`). Campo `tipo` usa o vocabulário `Provento` / `Desconto` / `Informativa`, consistente com as seções do relatório-fonte.

Esse arquivo é gerado fora do código do site (script Python ad-hoc) e entregue para upload manual em Administração → aba Rubricas → Importar. Não há mudança de código em `admin.html`/`admin.js` — o import já suporta esse formato.

## Parte 2 — Lançamentos consome o catálogo

### 2.1 Remoção da seção "Rubricas Personalizadas" (modal de Configurações)

Remove de `lancamentos.html` (dentro de `configLancamentosModal`): o mini-formulário (`cfgLancNovoCodigo`, `cfgLancNovaDescricao`, `cfgLancNovoTipo`, botão "Adicionar") e a tabela `cfgLancTabelaPersonalizadas`.

Remove de `lancamentos.js`: as funções `adicionarRubricaPersonalizada` e `removerRubricaPersonalizada`. Simplifica `renderConfigLancamentos` para preencher só as duas seções que sobram (rubricas fixas + observações) — remove a lógica de filtrar/montar a lista de "personalizadas".

O modal de Configurações do Lançamentos passa a ter só: seletor de empresa + tabela somente-leitura de rubricas fixas do Controle de Frequência + observações somente-leitura. Nenhuma escrita acontece nesse modal a partir de agora (era o objetivo original antes da feature de personalizadas ter sido introduzida).

A constante `EVENTOS_CONFIG_GERAL_RESTRITOS` e seu uso dentro de `renderSeletorEventoRubrica` (loop que descobria "eventos personalizados" a partir de `configRubricasPorEmpresa`) são removidos junto — esse mecanismo existia só para suportar a feature de personalizadas que está sendo revertida.

### 2.2 Busca no catálogo no seletor do Passo 3

Novo estado:

```js
let catalogoRubricasLote = []; // [{codigo_empresa, codigo_rubrica, descricao_rubrica, tipo}]
```

Nova função, chamada em `avancarParaParametros()` junto com `carregarConfigRubricasLote`:

```js
async function carregarCatalogoRubricasLote(codigosEmpresa) {
    catalogoRubricasLote = [];
    if (!codigosEmpresa || codigosEmpresa.length === 0) return;
    const { data, error } = await supabaseClient
        .from('rh_rubricas')
        .select('codigo_empresa, codigo_rubrica, descricao_rubrica, tipo')
        .in('codigo_empresa', codigosEmpresa);
    if (error) {
        console.error('Erro ao buscar catálogo de rubricas do lote:', error);
        return;
    }
    catalogoRubricasLote = data || [];
}
```

Erro nessa busca não bloqueia o fluxo (a busca de eventos fixos, essa sim crítica, já tem seu próprio tratamento de erro) — só deixa o catálogo/datalist vazio, já que a rubrica ainda pode ser digitada manualmente.

Novo elemento `<datalist id="catalogoRubricasDatalist">` em `lancamentos.html`, populado por:

```js
function renderCatalogoRubricasDatalist() {
    const datalist = document.getElementById('catalogoRubricasDatalist');
    datalist.innerHTML = catalogoRubricasLote.map(r => {
        const nomeEmp = nomeEmpresaPorCodigo(r.codigo_empresa);
        const desc = r.descricao_rubrica || '(sem descrição)';
        const tipo = r.tipo ? ` · ${r.tipo}` : '';
        return `<option value="${r.codigo_rubrica}">${desc} — ${nomeEmp}${tipo}</option>`;
    }).join('');
}
```

Chamada junto com `renderSeletorEventoRubrica()`/`renderObservacoesLote()` em `avancarParaParametros()`.

O input `gradeRubricaCodigo` (modo "Outra rubrica") ganha o atributo `list="catalogoRubricasDatalist"` — passa a sugerir entradas do catálogo enquanto o usuário digita, mas continua aceitando qualquer código digitado manualmente (datalist não restringe o valor).

`adicionarRubricaGrade()`, no branch manual, passa a tentar um rótulo melhor cruzando o código digitado com o catálogo carregado:

```js
        const catalogado = catalogoRubricasLote.find(r => r.codigo_rubrica === codigo);
        const label = catalogado ? `${catalogado.descricao_rubrica} (${codigo})` : `Rubrica ${codigo}`;

        novaColuna = { id: Date.now(), evento: null, label, tipoValor, codigo };
```

(Antes era sempre `Rubrica ${codigo}`.) O Tipo do Valor continua sendo escolhido manualmente nesse modo — `rh_rubricas` não guarda essa informação.

O rótulo do `<option value="__manual__">` do seletor de evento é atualizado para deixar claro que agora dá pra buscar: `"Outra rubrica (buscar no catálogo ou digitar código)"`.

## Fora de escopo

- Controle de Frequência (`index.html`/`script.js`) não muda nesta rodada.
- Sem migração de schema nova — `descricao_rubrica` em `rh_config_rubricas_txt` já foi aplicada anteriormente e fica sem uso, sem necessidade de reverter.
- O catálogo buscado no Passo 3 não tenta resolver "a mesma rubrica" entre empresas diferentes do lote (como acontece com os eventos fixos via `codigosPorEmpresa`) — cada item do catálogo pertence a uma empresa específica; ao escolher um código pelo datalist, ele é aplicado como código único da coluna (mesmo comportamento que "Outra rubrica" já tinha antes, sem regressão).
