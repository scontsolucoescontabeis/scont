# Informações Bancárias em Configurações + Modelo de Planilha — Quadrante

**Data:** 2026-07-06
**Escopo:** `quadrante.html`, `quadrante.js` (Quadrante Etiquetas)

## Problema

1. Os dados bancários usados no Relatório Líquido (Step 6) só podem ser
   cadastrados/corrigidos durante o fluxo de importação da planilha (upload →
   revisão → preencher pendência). Não há como consultar, editar ou excluir
   um registro já salvo em `fechamento_dados_bancarios` fora desse fluxo, nem
   cadastrar um novo registro sem passar por uma importação.
2. Não existe um modelo de planilha para o usuário baixar e preencher — ele
   precisa descobrir sozinho o nome das abas e das colunas esperadas.

## Objetivo

Na tela Configurações, além do card de Rubricas já existente, apresentar os
dados bancários cadastrados (por empresa), com edição e exclusão diretas.
No Step 6, oferecer o download de um modelo de planilha já no formato aceito
pelo processamento.

## Design

### 1. Card "💳 Informações Bancárias" em Configurações

Novo `.config-card` em `#telaConfig`, logo abaixo do card de Rubricas.
Reaproveita a tabela já existente `fechamento_dados_bancarios` (sem migração
de banco) e os padrões visuais/técnicos já usados no card de Rubricas
(`carregarRubricasConfig`/`salvarRubricaConfig`/`deletarRubricaConfig`/
`abrirEditarCota`).

**Formulário de adição** (`bancEmpresa`, `bancCodigo`, `bancNome`, `bancCpf`,
`bancCargo`, `bancCentroCusto`, `bancBanco`, `bancAgencia`, `bancConta`,
`bancTipoConta`):
- Obrigatórios: Empresa, Código do Empregado, Nome, Banco, Agência, Conta.
- Opcionais: CPF, Cargo, Centro de Custo.
- Tipo de Conta: select com C.Corrente / C.Salário / Poupança (padrão
  C.Corrente), mesmas opções já usadas no formulário de pendência do Step 6.
- Botão "➕ Adicionar" → `salvarBancarioConfig()`: valida obrigatórios, monta
  o registro e faz `upsert` em `fechamento_dados_bancarios` com
  `onConflict: 'codigo_empresa,codigo_empregado'` (mesma estratégia de
  `sincronizarDadosBancarios`/`salvarDadosBancariosManual` — evita erro de
  chave duplicada e permite usar o mesmo formulário para corrigir um
  registro pelo código).

**Filtro por empresa** (`bancFiltroEmpresa`, mesmo padrão de
`cfgFiltroEmpresa`) + tabela (`bancTableBody`) com colunas: Empresa, Código,
Nome, CPF, Cargo, C.Custo, Banco, Agência, Conta, Tipo de Conta, Ações.
Tabela larga → dentro de `.config-table-wrap` (scroll horizontal já
suportado pelo CSS existente).

**Editar** (`abrirEditarBancario(id)`): mesmo padrão da linha inline de
"💰 Cota" das Rubricas — abre uma `<tr>` abaixo do registro com todos os
campos preenchidos e editáveis, botões Salvar (`salvarEdicaoBancario(id)`,
faz `update` por `id`) / Cancelar (`fecharEditarBancario(id)`).

**Excluir** (`deletarBancarioConfig(id)`): `confirm()` + `delete` por `id`,
mesmo padrão de `deletarRubricaConfig`.

`iniciarConfig()` passa a chamar também `carregarBancariosConfig()`. O select
de empresa desse card (`bancEmpresa`) e o filtro (`bancFiltroEmpresa`) são
populados pela mesma `carregarEmpresasConfig()`/`_assocEmpresas` já usada
pelo card de Rubricas (mesma lista de `rh_empresas`).

### 2. Botão "📥 Baixar modelo" no Step 6

Novo botão no painel de upload do Relatório Líquido (`#painelUploadLiquido`),
ao lado da área de upload, chamando `baixarModeloLiquido()`. Gera um `.xlsx`
inteiramente no navegador via SheetJS (já carregado para leitura), com as
duas abas que o processamento já reconhece:

- **Aba "Informações Bancárias"** — cabeçalhos: `Código`, `Nome do
  Empregado`, `Cargo`, `Ccusto`, `CPF`, `Banco`, `Agência`, `Nº Conta`; mais
  1 linha de exemplo (`000123`, `João da Silva (exemplo)`, `Vendedor`, `01`,
  `12345678900`, `341`, `1234`, `56789-0`).
- **Aba "Líquido"** — cabeçalhos: `Código`, `Nome do Empregado`, `CPF`,
  `Valor`; mais 1 linha de exemplo com o mesmo código/nome/CPF
  (`000123`, `João da Silva (exemplo)`, `12345678900`, `1500`).

Nomes de aba e cabeçalhos foram conferidos contra `encontrarAba` (usa
`normalizarNome`) e `MAPA_BANCARIA`/`MAPA_LIQUIDO` (usam `chaveColuna`, que
remove acentos e caracteres como `º`) — "Informações Bancárias" normaliza
para `informacoes bancarias`, "Nº Conta" normaliza para `n conta`, ambos já
aceitos pelo parser existente. Nenhuma mudança no parser, só a geração do
arquivo de exemplo.

Arquivo baixado: `Modelo_Liquido_Bancarios.xlsx` via
`XLSX.utils.book_new()` + `aoa_to_sheet` + `book_append_sheet` +
`XLSX.writeFile()`.

### Fora de escopo

- Migração do Step 6 para tela própria no sidebar (proposta em spec anterior
  de 2026-07-02) — não foi implementada e não faz parte desta mudança;
  Step 6 continua dentro do wizard como está hoje.
- `trackfield.html`/`.js` e `ananke.html`/`.js` não são alterados.
- Nenhuma mudança no schema do Supabase.

## Teste / Verificação

1. Abrir Configurações → confirmar que o novo card "Informações Bancárias"
   aparece abaixo do card de Rubricas, com a tabela populada (dados já
   existentes de importações anteriores do Relatório Líquido).
2. Adicionar um registro manualmente (empresa + código + nome + banco +
   agência + conta) → confirmar que aparece na tabela e que, ao selecionar
   essa empresa no Step 6 e importar uma planilha "Líquido" com esse mesmo
   código, o registro é usado (sem cair em pendência).
3. Editar um registro existente (qualquer campo) → salvar → confirmar
   atualização na tabela e no Supabase.
4. Excluir um registro → confirmar remoção da tabela e que, ao reimportar a
   planilha Líquido para esse empregado sem a aba bancária, ele agora cai
   em pendência (registro realmente foi removido).
5. No Step 6, clicar em "📥 Baixar modelo" → abrir o `.xlsx` gerado e
   conferir as duas abas, cabeçalhos e linha de exemplo.
6. Preencher o modelo baixado com um empregado real (substituindo a linha
   de exemplo) e importá-lo no Step 6 → confirmar que é processado
   normalmente (prova de que os cabeçalhos gerados batem com o parser).
