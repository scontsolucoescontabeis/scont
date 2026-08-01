# Diário Contábil — Mapeamento sai do hub, busca de empresa e Relatórios

## Contexto

Após o Diário Contábil entrar como 3ª sub-ferramenta da Central do
Departamento Contábil (ver
`2026-07-31-diario-contabil-design.md`), o usuário decidiu reorganizar a
navegação: o Mapeamento Estratégico deixa de ter card próprio no hub e passa
a ser acessado só de dentro do Diário, por empresa. Além disso, o seletor de
empresa do Diário precisa de busca por nome, e a ferramenta ganha uma tela de
Relatórios que gera um PDF tabular multi-empresa com filtros e colunas
configuráveis.

Esta spec cobre três mudanças independentes, todas dentro de
`Projeto Onboarding Contabil`:

1. **Remoção do card do Mapeamento no hub** (§1).
2. **Seletor de empresa com busca, no Diário** (§2).
3. **Tela de Relatórios no Diário** (§3).

## 1. Mapeamento Estratégico sai do hub

- `index.html`: remove o `<a class="tool-card" href="mapeamento.html">...`.
  Hub volta a ter 2 cards: Onboarding e Diário Contábil.
- `mapeamento.html` e `mapeamento.js` **não mudam** — continuam existindo e
  funcionando exatamente como hoje (dashboard próprio, perfil por empresa,
  relatório PDF individual). Só deixam de ter entrada direta no hub.
- Único caminho de acesso: dentro da página da empresa no Diário, o card
  "Resumo do Mapeamento Estratégico" (já existe) com o botão "✏️ Editar no
  Mapeamento Estratégico", que já aponta para `mapeamento.html?empresa=X`
  (suporte já implementado). Nenhuma mudança de código é necessária aqui além
  da remoção do card no hub.

## 2. Seletor de empresa com busca (só no Diário)

O `<select id="seletorEmpresa">` do sidebar de `diario.html` é substituído
por um combobox simples:

```html
<div class="seletor-empresa-wrap">
  <label for="buscaEmpresa">Empresa</label>
  <input type="text" id="buscaEmpresa" placeholder="Buscar empresa..." autocomplete="off">
  <div id="listaBuscaEmpresa" class="combobox-lista"></div>
</div>
```

Comportamento (`diario.js`):
- Ao digitar, filtra `empresas` por `nome_empresa` contendo o texto digitado
  (case-insensitive, sem acento — reaproveita comparação simples via
  `.toLowerCase()`, sem normalizar acentos, consistente com o resto do
  projeto).
- Mostra até 20 resultados na lista suspensa (`#listaBuscaEmpresa`), cada um
  como uma linha clicável.
- Clique num resultado: preenche o campo com o nome da empresa, fecha a
  lista, chama `selecionarEmpresaDiario(codigo)`.
- Clique fora do combobox ou tecla `Escape`: fecha a lista sem selecionar.
- Ao selecionar uma empresa (inclusive via `?empresa=` na URL ou clique na
  tabela do dashboard), o campo de texto é atualizado com o nome da empresa
  selecionada.
- `mapeamento.html` **não muda** — mantém o `<select>` simples que já tem.

CSS novo (`styles.css`): `.combobox-lista` (lista suspensa posicionada
abaixo do input, com scroll se passar de ~20 itens) e `.combobox-item`
(linha clicável, hover destacado).

## 3. Tela de Relatórios (novo item no sidebar do Diário)

### 3.1 Navegação

Sidebar de `diario.html` ganha um segundo botão, ao lado de "📊 Visão Geral":
"📄 Relatórios". Clique chama `renderRelatorios()` (nova função, em arquivo
separado `diario-relatorios.js` — `diario.js` já está grande o suficiente
para justificar a divisão; o arquivo novo é carregado só em `diario.html`,
depois de `diario.js`, e expõe `window.DiarioRelatorios.render(main)`,
recebendo o elemento `#main` para renderizar dentro dele. Os dados
compartilhados (`empresas`, `mapeamentos`, `bancosPorMapeamento`,
`statusMensalPorEmpresa`) são expostos por `diario.js` através de um objeto
`window.__diarioContext` (populado ao fim de `carregarDadosDiario()`), já
que `diario-relatorios.js` não tem acesso às variáveis de módulo de
`diario.js` (cada arquivo é sua própria IIFE).

### 3.2 Filtros

Todos combináveis (AND entre grupos; dentro de um grupo multi-select, OR):

| Filtro | Tipo | Fonte |
|---|---|---|
| Nível de Atenção | multi-select (baixo/médio/alto/crítico) | `contabil_mapeamento.nivel_atencao` |
| Situação do ano corrente | multi-select (regularizado/em_regularizacao/pendente/critico) | `contabil_mapeamento.situacao_<ano_atual>_status` |
| Status da Grade Mensal | select (sem_documentacao/pendencias/concluido) + seletor Mês/Ano | `contabil_diario_status_mensal` |
| Banco | multi-select (lista de bancos distintos já cadastrados) | `contabil_mapeamento_bancos.banco` |
| Regime Tributário | multi-select | `contabil_mapeamento.regime_tributario` |
| Financeiro Interno/BPO | multi-select | `contabil_mapeamento.financeiro_interno_bpo` |
| Período (lançamentos) | date de / date até | `contabil_diario_lancamentos.data` |

Se "Status da Grade Mensal" for usado sem escolher Mês/Ano, assume o mês/ano
atual. Se "Período" não for preenchido, a coluna "Quantidade de Lançamentos"
e "Último Lançamento" (se marcadas) consideram todo o histórico da empresa.

### 3.3 Fluxo

1. Usuário ajusta os filtros e clica **"Buscar"**.
2. Sistema calcula a lista de empresas que atendem a todos os filtros
   preenchidos (client-side, sobre os dados já carregados por
   `carregarDadosDiario()` + uma busca pontual em
   `contabil_diario_lancamentos` filtrada pelo período, feita só neste
   momento — não precisa estar pré-carregada para todas as empresas o tempo
   todo).
3. Aparece uma lista com checkbox por empresa (todas pré-marcadas). Usuário
   pode desmarcar antes de gerar.
4. Usuário marca as colunas desejadas (checkboxes agrupados "Do Mapeamento" /
   "Do Diário", com "Empresa" sempre marcada e desabilitada — não pode ser
   removida).
5. Clique em **"Gerar PDF"** monta o relatório.

### 3.4 Colunas selecionáveis

Pré-marcadas por padrão: Empresa (fixa), Regime Tributário, Nível de
Atenção, Responsável pela Execução.

**Do Mapeamento** (fonte: `contabil_mapeamento` + `contabil_mapeamento_bancos`):
- Regime Tributário
- Periodicidade
- Responsável pela Execução
- Contato (nome/telefone/email concatenados)
- Financeiro Interno/BPO
- Bancos Utilizados (nomes separados por vírgula)
- Sistemas Utilizados (separados por vírgula)
- Situação do Ano Corrente
- Nível de Atenção
- Entregáveis Esperados (separados por vírgula)
- Obrigações Acessórias (separadas por vírgula)
- Particularidades Contábeis
- Particularidades Fiscais
- Particularidades Societárias

**Do Diário** (fonte: `contabil_diario_status_mensal` + `contabil_diario_lancamentos`):
- Status da Grade Mensal (do mês/ano filtrado, ou mês atual se não filtrado)
- Quantidade de Lançamentos no Período
- Último Lançamento (data + texto resumido a 80 caracteres + autor)

### 3.5 Geração do PDF

jsPDF + AutoTable (mesma stack/CDN já usada em `mapeamento.js`), uma tabela
só, 1 linha por empresa selecionada, colunas na ordem fixa acima (a ordem de
exibição não é customizável, só a inclusão/exclusão). Orientação: paisagem
se 5 ou mais colunas estiverem marcadas (incluindo "Empresa"), retrato caso
contrário. Cabeçalho do PDF segue o padrão visual já usado no relatório do
Mapeamento (faixa `--brand` no topo, título + data de geração).

## 4. Fora de escopo

- Ordenação/reordenar colunas do relatório.
- Exportar em outro formato além de PDF (CSV, Excel).
- Salvar filtros/configuração de colunas para reuso futuro.
- Autocomplete com navegação por teclado (setas) no combobox de empresa —
  só clique do mouse na lista suspensa.
- Alterar `mapeamento.html` — segue com o `<select>` simples e sem tela de
  Relatórios própria.
