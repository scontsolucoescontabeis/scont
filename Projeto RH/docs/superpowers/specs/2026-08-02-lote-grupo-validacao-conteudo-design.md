# Design: Processamento em Lote (Grupo de Empresas) — Validação por Conteúdo

**Data:** 2026-08-02
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/script.js`

---

## Contexto

Hoje, `processarLoteGrupo` (script.js) identifica a qual empresa cada arquivo do lote pertence exclusivamente pelo **nome do arquivo**, via regex `^Modelo_FolhaPonto_(.+)_(\d{2})-(\d{4})\.xlsx$`. O nome também é usado para conferir se a competência do arquivo bate com a informada. Isso permite que um arquivo renomeado (por engano ou não) seja aceito como se fosse de outra empresa/competência, mesmo que o conteúdo não corresponda ao modelo que seria gerado para aquela empresa.

Este design substitui essa validação por identificação e verificação baseadas no **conteúdo real da planilha**, reaproveitando as mesmas fontes de verdade já usadas para gerar o modelo (`baixarModelosGrupo`): lista de empregados ativos por empresa (`_excluirContribuinte`), configuração de 3º turno (`_buscarConfigRubricas`) e período de apuração (`_resolverPeriodoApuracao` + `gerarDiasDoMes`).

---

## Escopo confirmado com o usuário

- O nome do arquivo deixa de ter qualquer papel na identificação da empresa/competência ou na decisão de aceitar/rejeitar. É usado só como rótulo nas mensagens de erro, para o operador localizar o arquivo.
- Empresa é identificada pelo conteúdo: código do empregado (primeiro token do nome da aba) **+** prefixo do nome do empregado (resto do nome da aba), comparado contra os empregados ativos de cada empresa do grupo.
- Cobertura mínima para considerar uma empresa "candidata": **80%** dos empregados ativos dela aparecem no arquivo.
- 0 candidatas → erro (não identificado). 2+ candidatas → erro (ambíguo). Nunca tenta adivinhar por maioria nesses casos.
- Duas ou mais arquivos do lote resolvendo para a mesma empresa → erro de duplicidade nos dois (nenhum processado).
- Compatibilidade de modelo, além da cobertura de empregados, inclui: cabeçalho de colunas (bate com 3º turno configurado) e datas dentro do período de apuração da competência/empresa.
- Abas que não correspondem a nenhum empregado da empresa já identificada continuam como aviso (não erro) — comportamento herdado, não muda.

---

## Algoritmo

### 1. Pré-carga (uma vez por lote)

```js
const { data } = await supabaseClient
    .from('rh_empregados')
    .select('codigo_empresa, codigo_empregado, nome_empregado, tipo_empregado, situacao')
    .in('codigo_empresa', codigosGrupo);
const empregadosPorEmpresa = {}; // codigo_empresa -> empregados ativos (_excluirContribuinte)
```

### 2. Para cada arquivo: identificar empresa por conteúdo

Para cada aba do workbook:
- `codAba = sheetName.split(' ')[0].trim()`
- `restoAba = sheetName.slice(codAba.length).trim().toLowerCase()` (pode estar truncado em 31 chars — comparar como prefixo)

Para cada empresa do grupo, contar abas que correspondem a um empregado dela: `emp.codigo_empregado === codAba` **e** `emp.nome_empregado.toLowerCase().startsWith(restoAba)` (ou vice-versa, já que a aba pode estar truncada).

```
cobertura(empresa) = abasCorrespondentes(empresa) / empregadosAtivos(empresa).length
candidatas = empresas do grupo com cobertura >= 0.8
```

- `candidatas.length === 0` → resultado erro: `Arquivo "{nome}": não foi possível identificar a empresa pelo conteúdo (nenhuma empresa do grupo atingiu 80% de correspondência de empregados).`
- `candidatas.length > 1` → resultado erro: `Arquivo "{nome}": conteúdo ambíguo — corresponde a mais de uma empresa do grupo ({lista de códigos}).`
- `candidatas.length === 1` → segue para o passo 3 com `empresaIdentificada = candidatas[0]`.

### 3. Duplicidade

Depois de resolver todos os arquivos do lote, agrupar por `empresaIdentificada`. Qualquer empresa com 2+ arquivos apontando para ela: todos esses arquivos viram erro:
`Arquivo "{nome}": duplicidade — mais de um arquivo do lote corresponde à empresa {codigo}. Nenhum foi processado; revise e reenvie.`

### 4. Compatibilidade com o modelo (arquivos com empresa única resolvida)

Para `empresaIdentificada`, buscar config (`_buscarConfigRubricas`) e período (`_resolverPeriodoApuracao`), gerar `diasEsperados = gerarDiasDoMes(comp, diaInicio, diaFim)`.

- **Colunas:** header da primeira aba com conteúdo deve bater exatamente com:
  - sem 3º turno: `['Data','Dia da Semana','Entrada 1','Saída 1','Entrada 2','Saída 2']`
  - com 3º turno: as 6 acima + `['Entrada 3','Saída 3']`
  - Divergência → erro: `Arquivo "{nome}": colunas não correspondem ao modelo esperado para {empresa} (3º turno {ativo/inativo}).`
- **Datas dentro do período:** qualquer linha com data preenchida cujo valor não esteja em `diasEsperados` → erro: `Arquivo "{nome}": contém datas fora do período de apuração de {competência} para {empresa}.`
- **Cobertura de empregados:** já calculada no passo 2 (reaproveitada, não recalculada).

Qualquer uma dessas falhas rejeita o arquivo inteiro (empresa não entra na fila de revisão).

### 5. O que não muda

- Fila de revisão empresa-por-empresa (`_filaLoteGrupo`, `_carregarProximaEmpresaFila`, `_avancarFilaLoteGrupo`), snapshot/restauração de `state`, resumo final (`_mostrarResumoLote`), abas órfãs dentro de uma empresa já identificada continuam como aviso.
- `_parseExcelParaFolhas` continua sendo usado para montar as folhas da empresa identificada, sem mudança de assinatura.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `script.js` | `processarLoteGrupo`: substitui a extração por regex de nome por identificação/validação por conteúdo (nova função auxiliar `_identificarEmpresaPorConteudo` ou similar); pré-carga de empregados do grupo inteiro; novas checagens de header e datas. |

Nenhuma mudança de banco de dados.
