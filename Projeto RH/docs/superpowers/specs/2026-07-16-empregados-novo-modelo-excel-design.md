# Design: Novo Modelo de Excel para Importação de Empregados

**Data:** 2026-07-16
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/admin.js`, `Projeto RH/admin.html`

---

## Contexto

O modelo de Excel usado para importar empregados (`_COLS_EMPREGADOS` / `_HEADERS_EMPREGADOS`, 124 colunas) muda: os 4 campos de Conselho (`Nome Conselho`, `Numero Conselho`, `Expedição Conselho`, `Validade Conselho`) deixam de existir no novo modelo. As demais informações continuam as mesmas.

Analisando o arquivo real fornecido como referência do novo modelo (`Empregados em Excel - Apenas Ativos_16072026.xls`, exportação com todas as empresas ativas — 1211 linhas, 219 empresas), além da remoção do Conselho foram encontrados dois problemas estruturais que a importação por posição fixa não suportava:

1. **Cabeçalho repetido por empresa.** O relatório traz uma nova linha de cabeçalho (`Cód Emp`, `Cód Epr`, ...) a cada troca de empresa dentro do mesmo arquivo. A leitura antiga (`XLSX.utils.sheet_to_json(sheet, { header: colunas, range: 1 })`) só pula a primeira linha — cada cabeçalho repetido viraria um "empregado" fantasma com `codigo_empresa = 'Cód Emp'`.
2. **Colunas de banco fora de ordem conforme a empresa.** Em 176 das 219 empresas a ordem é `Tipo Conta, Agência, Conta`; em 43 delas é `Tipo Conta, Conta, Agência` (com uma coluna sem nome, sempre vazia, logo depois). Leitura por posição fixa trocaria Agência↔Conta para ~20% das empresas.

---

## Decisão

Import de Empregados passa a ler pelo **nome da coluna**, remapeando a cada linha de cabeçalho encontrada — em vez de por posição fixa. Os demais importadores (Empresas, Rubricas, Sócios, Mapeamentos) continuam usando `lerPlanilha()` por posição, sem mudança — não têm esse problema de cabeçalho repetido/reordenado.

### `_pareceLinhaCabecalhoEmpregados(linha)`

Reconhece uma linha de cabeçalho quando a primeira célula é exatamente `'Cód Emp'` (primeiro rótulo do modelo).

### `_construirMapaColunasEmpregados(linhaCabecalho)`

A partir de uma linha de cabeçalho, monta um mapa `índice da coluna no arquivo → chave interna` comparando cada célula com `_HEADERS_EMPREGADOS`. Colunas em branco ou com rótulo desconhecido são ignoradas (não geram dado).

Rótulos duplicados no modelo (`Categoria` aparece para categoria do empregado e para categoria da CNH) são resolvidos pela ordem de aparição: a N-ésima ocorrência de um rótulo no arquivo mapeia para a N-ésima ocorrência desse mesmo rótulo no modelo canônico — resolve corretamente porque as duas ocorrências de "Categoria" nunca trocam de ordem relativa entre si.

### `lerPlanilhaEmpregados(file)`

Lê a planilha inteira como array de arrays (`header: 1`). Para cada linha: se for cabeçalho, reconstrói o mapa de colunas e não gera registro; caso contrário, usa o mapa vigente para montar o objeto do empregado. Linhas antes do primeiro cabeçalho reconhecido são ignoradas.

Substitui a chamada antiga `lerPlanilha(file, _COLS_EMPREGADOS)` dentro de `importarEmpregadosIndividual`. O restante do fluxo (filtro de linhas válidas, formatação de datas/salário/CPF, upsert em lotes) não muda.

---

## Campos removidos

`nome_conselho`, `numero_conselho`, `expedicao_conselho`, `validade_conselho` — removidos de `_COLS_EMPREGADOS`, `_HEADERS_EMPREGADOS`, `_DATE_COLS_EMPREGADOS` e do grupo "Conselho" em `_GRUPOS_CAMPOS` (seleção de colunas para relatório/exportação). Texto descritivo do card "Empregados" em Importar Dados atualizado.

Colunas `nome_conselho` etc. permanecem no banco (`rh_empregados`) sem migração — dados antigos não são apagados, só deixam de ser alimentados por novas importações.

---

## Validação

Testado com o arquivo real (Node + biblioteca `xlsx`, fora do navegador): 1211 linhas → 219 cabeçalhos reconhecidos e pulados → 992 registros de empregados, nenhum registro fantasma, `categoria`/`categoria_cnh` corretamente distinguidos, e Agência/Conta corretos em empresas com as duas ordens diferentes de coluna.

## O que NÃO muda

- `lerPlanilha()` genérico (usado por Empresas, Rubricas, Sócios, Mapeamentos).
- Fluxo de `importarEmpregadosIndividual` após a leitura (validação, upsert, modo substituir/acrescentar).
- Schema do banco (`rh_empregados`) — nenhuma coluna removida.
