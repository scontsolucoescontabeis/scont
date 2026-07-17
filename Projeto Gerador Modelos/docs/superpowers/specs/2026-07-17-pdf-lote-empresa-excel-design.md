# Gerador de Modelos — PDF em lote por empresa no modo Excel puro

## Contexto

No wizard do Gerador de Modelos, quando um modelo usa apenas variáveis
`{{excel.*}}` (sem fontes `empresas`/`empregados`/`socios`/`rubricas` — o
"modo Excel puro", `soExcel` em `construirRegistros()`), o app pede um nome
de empresa único via modal (`modal-nome-empresa-excel`) e gera **um PDF
único** com todas as linhas da planilha, uma por página.

Isso ignora o fato de a planilha poder conter várias empresas diferentes.
Confirmado no arquivo de exemplo `SORVEMILK_VT E VA.xlsx`: colunas `EMPRESA`
e `CODIGO EMPRESA` com múltiplos valores distintos entre as linhas (ex.:
"SORVETES SORVEMILK LTDA", "ATACADAO DO SORVETE PEROLA LTDA").

O mecanismo de gerar um PDF por empresa já existe desde
[[2026-07-16-pdf-por-empresa-design]] (`_agruparRegistrosPorEmpresa()` +
`exportarPDF()`), mas ele agrupa por `varMap['empresa.codigo_empresa']` /
`varMap['empresa.nome_empresa']` — chaves que o modo Excel puro nunca
preenche hoje (`construirRegistros()` só grava `excel.*` nesse modo). Por
isso todas as linhas caem no grupo `__sem_empresa__` e saem num arquivo só.

## Requisito

Quando a planilha carregada no modo Excel puro tiver uma coluna que
identifica a empresa de cada linha, o app deve gerar um PDF por empresa
(mesmo agrupamento/nomeação já usado pelo fluxo multi-empresa existente),
em vez de um único arquivo com todas as linhas misturadas.

## Abordagem

### 1. Auto-detecção de coluna (ao carregar a planilha)

Nova função `_detectarColunaEmpresa(headers)`: normaliza cada cabeçalho
(lowercase, sem acento, trim) e compara contra uma lista de candidatos de
nome de empresa:

```
['empresa', 'nome empresa', 'nome_empresa', 'cliente', 'razao social',
 'nome da empresa', 'nome fantasia']
```

Retorna o primeiro header original que bater (comparação exata do valor
normalizado), ou `''` se nenhum bater.

Uma segunda função `_detectarColunaCodigoEmpresa(headers)` faz o mesmo para
candidatos de código, usada só como chave de agrupamento mais precisa (não
tem UI própria):

```
['codigo empresa', 'código empresa', 'cod empresa', 'codigo_empresa']
```

Ambas rodam em `handleWizardExcel()` logo após popular `excelHeaders`.

### 2. Novo estado do wizard

```js
let wizardColunaEmpresaExcel = '';       // header escolhido, ou '' = "mesma empresa para todas"
let wizardColunaCodigoEmpresaExcel = ''; // auto, sem controle de UI
```

Resetados em `limparWizardExcel()` e na inicialização do wizard (mesmo
ponto onde `wizardNomeEmpresaExcel` já é resetado).

`handleWizardExcel()` chama os dois detectores e pré-popula
`wizardColunaEmpresaExcel` / `wizardColunaCodigoEmpresaExcel` com o
resultado (`''` se não achou nada).

### 3. UI — painel "Planilha"

Em `_renderPlanilhaInfo()`, depois da tabela de prévia, adicionar um
`<select>`:

- Label: "Coluna que identifica a empresa em cada linha"
- Opções: `— Mesma empresa para todas as linhas —` (value `''`) + uma opção
  por header de `excelHeaders`.
- Valor inicial = `wizardColunaEmpresaExcel` (já detectado).
- `onchange` grava em `wizardColunaEmpresaExcel` e re-renderiza a linha de
  contagem (item 5).

Isso substitui, nesse ponto do fluxo, a necessidade de abrir o modal — mas
o modal continua existindo para o caso "mesma empresa para todas".

### 4. Gate ao avançar para "Exportar" (`wizardAvançar`, painel `planilha`→`exportar`)

Condição atual:
```js
if (soExcel && !wizardNomeEmpresaExcel) { abrirModalNomeEmpresaExcel(); return; }
```

Nova condição:
```js
if (soExcel && !wizardColunaEmpresaExcel && !wizardNomeEmpresaExcel) {
  abrirModalNomeEmpresaExcel(); return;
}
```

Ou seja: se uma coluna de empresa foi selecionada (auto ou manual), pula o
modal direto. Só pede o nome único quando o usuário deixou/selecionou
"— Mesma empresa para todas as linhas —".

### 5. `construirRegistros()` — branch `soExcel`

```js
if (soExcel) {
  wizardRegistros = excelData.map(row => {
    const map = {};
    for (const h of excelHeaders) map[`excel.${h}`] = row[h] ?? '';
    if (wizardColunaEmpresaExcel) {
      map['empresa.nome_empresa'] = row[wizardColunaEmpresaExcel] ?? '';
      if (wizardColunaCodigoEmpresaExcel) {
        map['empresa.codigo_empresa'] = row[wizardColunaCodigoEmpresaExcel] ?? '';
      }
    }
    return map;
  });
  wizardPreviewIndex = 0;
  return;
}
```

Com isso, `_agruparRegistrosPorEmpresa()` e `exportarPDF()` (inalterados)
passam a agrupar corretamente linha a linha, sem nenhuma mudança na lógica
de exportação em si.

### 6. Feedback de quantas empresas serão geradas

Em `_renderPlanilhaInfo()`, quando `wizardColunaEmpresaExcel` está setada,
calcular `new Set(excelData.map(r => r[wizardColunaEmpresaExcel])).size` e
mostrar uma linha: *"X empresa(s) diferente(s) detectada(s) → serão gerados
X PDFs separados ao exportar."* (singular quando X === 1).

### 7. Resumo (`buildWizardResumo`)

`nomeEmpresaPreview` (linha ~1340) ganha mais um fallback antes do
`wizardNomeEmpresaExcel`, usando a primeira linha de `wizardRegistros`:

```js
const nomeEmpresaPreview =
  primeiraEmpresa?.nome_empresa ||
  wizardRegistros[0]?.['empresa.nome_empresa'] ||
  wizardNomeEmpresaExcel ||
  'Nome da Empresa';
```

Só afeta o texto de prévia do cabeçalho no resumo — não muda a geração.

## Fora do escopo

- Preview (`renderPreview`), exportação para Excel (`exportarExcel`) e o
  mecanismo de impressão (`window.print`) não mudam — a mudança fica isolada
  em `handleWizardExcel`, `_renderPlanilhaInfo`, `wizardAvançar` e
  `construirRegistros`.
- Não adiciona suporte a coluna de empresa no modo "Excel + DB" (quando o
  modelo já combina fontes do banco com planilha) — nesse modo a empresa já
  vem de `wizardEmpresasSelecionadas`/`rh_empresas`, cenário já coberto pelo
  agrupamento existente.
- Não valida/normaliza o texto da coluna de empresa (ex. trim, case) além do
  que já é feito hoje em `_agruparRegistrosPorEmpresa` — inconsistências de
  digitação na planilha (ex. "Sorvemilk Ltda" vs "SORVEMILK LTDA") vão gerar
  grupos separados, igual seria com CNPJ divergente no fluxo de banco.

## Edge cases

- Linha com célula de empresa vazia na coluna selecionada cai no grupo
  `__sem_empresa__` já existente (não é descartada nem misturada com outra
  empresa).
- Planilha sem nenhuma coluna candidata detectada: `wizardColunaEmpresaExcel`
  fica `''`, comportamento idêntico ao atual (modal de nome único, 1 PDF).
- Usuário troca a planilha depois de já ter escolhido uma coluna: o reset em
  `handleWizardExcel()` roda a auto-detecção de novo do zero (não mantém a
  escolha da planilha anterior, já que os headers podem ser outros).
