# Design: Relatório Líquido — seletor de empresa (multi-empresa)

**Data:** 2026-07-02
**Escopo:** O Step 6 (Relatório Líquido / Etiquetas Bancárias) do wizard `quadrante.html` deixa de estar preso à empresa Quadrante (código `453`, hardcoded) e passa a permitir gerar o relatório para **qualquer empresa cadastrada em `rh_empresas`**, com o cabeçalho do PDF (razão social, CNPJ, Inscrição, Endereço) montado a partir dos dados reais dessa empresa.

---

## 1. Contexto

Hoje, 4 pontos do código do Relatório Líquido em `quadrante.js` usam a constante global `CODIGO_EMPRESA = '453'` diretamente:
- `carregarDadosBancariosDB()` — linha 1589
- `sincronizarDadosBancarios()` — linha 1603 (campo `codigo_empresa` do upsert)
- `salvarTipoConta()` — linha 1808
- `salvarDadosBancariosManual()` — linha 1849

E o cabeçalho do PDF usa 4 constantes fixas (linhas 1890-1893): `QUADRANTE_RAZAO_SOCIAL`, `QUADRANTE_CNPJ`, `QUADRANTE_INSCRICAO`, `QUADRANTE_ENDERECO`.

A tabela `fechamento_dados_bancarios` (criada em trabalho anterior) já é multi-empresa por natureza — chave única `(codigo_empresa, codigo_empregado)` — então nenhuma mudança de schema é necessária ali.

A tabela `rh_empresas`, já consultada em outros pontos de `quadrante.js`/`ananke.js` (hoje só via `select('codigo_empresa, nome_empresa')`), **já possui** as colunas necessárias — adicionadas em migração anterior (`_sql/rh_importacao_campos.sql`): `cnpj`, `inscricao_estadual`, `endereco`, `cep`, `cidade`, `municipio`. Não é preciso criar tabela nem coluna nova.

## 2. Comportamento novo

Um seletor **"Empresa"** aparece no topo do painel de upload do Step 6, populado a partir de `rh_empresas` (código + nome + cnpj + inscrição + endereço + cidade + cep), pré-selecionado com a empresa da própria constante `CODIGO_EMPRESA` (Quadrante, 453) quando ela existir na lista. O usuário pode trocar para qualquer outra empresa cadastrada antes de importar a planilha.

Trocar a empresa selecionada **reseta o estado da importação atual** (arquivo escolhido, dados líquidos processados, grupos, pendências, exclusões) — evita misturar dados líquidos de uma competência/empresa com dados bancários de outra já carregados em memória. O painel volta a mostrar o estado de upload vazio.

`processarLiquido()` passa a validar também que uma empresa está selecionada, com a mesma mensagem de padrão já usada para competência/arquivo ausentes.

Os 4 pontos que hoje usam `CODIGO_EMPRESA` fixo passam a usar o código da empresa selecionada no seletor. O cabeçalho do PDF passa a ser montado dinamicamente:
- Razão social: `nome_empresa` da empresa selecionada.
- Linha CNPJ/Inscrição: só aparece se pelo menos um dos dois campos estiver preenchido na empresa; omite o que estiver vazio.
- Linha Endereço: monta `endereco` + `, cidade` (se preenchido) + ` - CEP cep` (se preenchido); a linha inteira só aparece se `endereco` não for vazio.
- A altura da barra colorida do cabeçalho passa a ser calculada dinamicamente pelo número de linhas efetivamente exibidas (2 a 4 linhas: razão social + período sempre, CNPJ/Inscrição e Endereço condicionais), em vez de fixa em 24mm.
- O nome do arquivo do PDF gerado passa a incluir o nome da empresa em vez de "Quadrante" fixo: `Relacao_Bancaria_<NomeEmpresa>_MM-AAAA.pdf` (nome da empresa normalizado — sem acentos/espaços — para um nome de arquivo seguro).

## 3. Dados e funções afetadas em `quadrante.js`

### Novo estado
```javascript
let empresaLiquido  = null;  // registro completo de rh_empresas da empresa selecionada no Step 6
let _empresasLiquido = [];   // cache da lista completa (codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade)
```

### Nova função de carregamento (mesmo padrão de `carregarEmpresasConfig`, linha 1010)
```javascript
async function carregarEmpresasLiquido() {
    if (_empresasLiquido.length) return;
    const { data, error } = await supabaseClient
        .from('rh_empresas')
        .select('codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade')
        .order('nome_empresa');
    if (error) { console.error('Erro ao carregar empresas (Relatório Líquido):', error); return; }
    _empresasLiquido = data || [];

    const sel = document.getElementById('selectEmpresaLiquido');
    sel.innerHTML = '<option value="">Selecione a empresa...</option>' +
        _empresasLiquido.map(e => `<option value="${e.codigo_empresa}">${e.codigo_empresa} — ${e.nome_empresa || ''}</option>`).join('');

    const padrao = _empresasLiquido.find(e => e.codigo_empresa === CODIGO_EMPRESA);
    if (padrao) {
        sel.value = padrao.codigo_empresa;
        empresaLiquido = padrao;
    }
}

function onEmpresaLiquidoAlterada() {
    const codigo = document.getElementById('selectEmpresaLiquido').value;
    empresaLiquido = _empresasLiquido.find(e => e.codigo_empresa === codigo) || null;

    // Troca de empresa invalida qualquer importação em memória
    arquivoLiquido    = null;
    dadosBancariosDB  = {};
    linhasLiquido     = [];
    gruposLiquido     = [];
    pendenciasLiquido = [];
    excluidosDoRelatorio.clear();
    document.getElementById('filenameLiquido').style.display = 'none';
    document.getElementById('inputLiquido').value = '';
    mostrarPainelLiquido('upload');
}
```

### `irStep6()` — passa a carregar as empresas
```javascript
async function irStep6() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de acessar o Relatório Líquido.');
        return;
    }
    document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
    await carregarEmpresasLiquido();
    mostrarPainelLiquido('upload');
    mostrarStep(6);
}
```
(Muda de `function` para `async function` — os dois `onclick="irStep6()"` no HTML continuam funcionando sem alteração, já que `onclick` não precisa de `await` no chamador.)

### `processarLiquido()` — nova validação
Adiciona, junto às validações existentes de competência e arquivo:
```javascript
    if (!empresaLiquido) {
        mostrarMensagem('Atenção', 'Selecione a empresa antes de processar a planilha.');
        return;
    }
```

### As 4 substituições de `CODIGO_EMPRESA` → `empresaLiquido.codigo_empresa`
Em `carregarDadosBancariosDB`, `sincronizarDadosBancarios`, `salvarTipoConta`, `salvarDadosBancariosManual` — cada ocorrência de `CODIGO_EMPRESA` dentro dessas 4 funções (e só dentro delas) é substituída por `empresaLiquido.codigo_empresa`. Nenhuma outra função do arquivo (pertencentes ao fluxo de folha/TXT, alheias ao Relatório Líquido) é tocada.

### Cabeçalho do PDF — `gerarPDFLiquido()`
As 4 constantes `QUADRANTE_*` são removidas. Uma nova função auxiliar monta o endereço formatado:
```javascript
function formatarEnderecoEmpresa(empresa) {
    if (!empresa.endereco) return '';
    let end = empresa.endereco;
    if (empresa.cidade) end += ', ' + empresa.cidade;
    if (empresa.cep) end += ' - CEP ' + empresa.cep;
    return end;
}
```
E o bloco de desenho do cabeçalho em `gerarPDFLiquido()` passa a montar uma lista de linhas dinamicamente (razão social e período sempre presentes; CNPJ/Inscrição e Endereço condicionais), calculando a altura da barra e o `startY` da tabela a partir do número de linhas — a spec deixa a implementação exata dessa parte para o plano, já que envolve iteração sobre um array de linhas com posições Y calculadas, não uma substituição de valor fixo.

O nome do arquivo salvo passa a ser:
```javascript
const nomeArquivoSeguro = (empresaLiquido.nome_empresa || empresaLiquido.codigo_empresa)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
doc.save(`Relacao_Bancaria_${nomeArquivoSeguro}_${comp.replace('/', '-')}.pdf`);
```

## 4. HTML (`quadrante.html`)

Novo bloco no topo do `#painelUploadLiquido`, antes da área de upload:
```html
<div class="form-group" style="max-width:320px;">
    <label for="selectEmpresaLiquido">Empresa *</label>
    <select id="selectEmpresaLiquido" onchange="onEmpresaLiquidoAlterada()">
        <option value="">Selecione a empresa...</option>
    </select>
</div>
```

## 5. Casos de borda

| Caso | Tratamento |
|---|---|
| Empresa selecionada não tem `cnpj` nem `inscricao_estadual` preenchidos | A linha inteira de CNPJ/Inscrição some do PDF (não aparece "CNPJ: " em branco) |
| Empresa selecionada não tem `endereco` preenchido | A linha de endereço some do PDF |
| Empresa selecionada não tem `nome_empresa` preenchido (não deveria acontecer, `rh_empresas.nome_empresa` é `NOT NULL`) | Usa `codigo_empresa` como razão social, evitando `undefined`/vazio no cabeçalho |
| Usuário troca a empresa no meio de uma revisão já processada | Estado da importação é limpo e a tela volta para o painel de upload (seção 3, `onEmpresaLiquidoAlterada`) |
| Nenhuma empresa selecionada e usuário clica "Processar Planilha" | Bloqueado com mensagem, mesmo padrão das validações de competência/arquivo já existentes |
| `_empresasLiquido` já carregado (usuário volta ao Step 6 depois de já ter estado nele) | `carregarEmpresasLiquido()` faz cache-guard (`if (_empresasLiquido.length) return`) — não recarrega do Supabase toda vez, mesmo padrão de `carregarEmpresasConfig` |

## 6. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `Projeto Fechamento Folha/quadrante.js` | Novo estado (`empresaLiquido`, `_empresasLiquido`), nova função `carregarEmpresasLiquido()`, nova função `onEmpresaLiquidoAlterada()`, `irStep6()` vira `async` e chama o loader, `processarLiquido()` ganha validação de empresa, 4 funções trocam `CODIGO_EMPRESA` por `empresaLiquido.codigo_empresa`, `gerarPDFLiquido()` monta cabeçalho e nome de arquivo dinamicamente, nova função `formatarEnderecoEmpresa()`, remoção das 4 constantes `QUADRANTE_*` |
| `Projeto Fechamento Folha/quadrante.html` | Novo `<select id="selectEmpresaLiquido">` no painel de upload do Step 6 |

Nenhuma mudança de schema Supabase é necessária (`rh_empresas` já tem as colunas; `fechamento_dados_bancarios` já é multi-empresa).
