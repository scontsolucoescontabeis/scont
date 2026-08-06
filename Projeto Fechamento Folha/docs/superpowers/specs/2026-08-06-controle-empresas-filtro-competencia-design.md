# Controle de Fechamento — Seleção de competência em "Controle Empresas"

> **Revisão (2026-08-06, mesmo dia):** o filtro por texto (`MM/AAAA`) e a barra
> "Competência em execução" descritos abaixo foram substituídos por cards de
> mês clicáveis + navegação de ano, conforme pedido do usuário logo em seguida.
> Ver seção "Revisão: cards de mês/ano" ao final. O texto original abaixo é
> mantido como histórico da primeira iteração.

## Contexto

A tela Dashboard do módulo Controle de Fechamento (`controle.html`/`controle.js`, item "Controle Empresas" no sidebar) mostra o andamento do fechamento de cada empresa apenas para a "competência em execução" — um ponteiro global (`fechamento_config_geral.competencia_atual`), editável só por admin, que também é usado por outras telas (ex.: "Fluxo por Empresa"). Não existe forma de consultar o andamento de uma empresa em outra competência (passada ou futura) sem alterar esse ponteiro global.

## Objetivo

Permitir que qualquer usuário visualize o andamento por empresa em qualquer competência, sem afetar o ponteiro global usado pelas outras telas.

## Design

- Novo campo de texto `MM/AAAA` + botão "Ver" na tela Dashboard, abaixo da barra "Competência em execução" existente (que não muda).
- Estado em memória `competenciaFiltroDashboardCF` (string, não persiste no banco — reseta ao recarregar a página). Vazio = segue a competência em execução automaticamente (comportamento atual preservado).
- Nova função `competenciaExibida()` retorna `competenciaFiltroDashboardCF || competenciaAtual()`.
- `carregarDashboard()` passa a buscar `fechamento_ciclo` pela competência retornada por `competenciaExibida()`, em vez de `competenciaAtual()` direto.
- `iniciarCiclo(codigo_empresa)` passa a criar o ciclo na competência exibida (`competenciaExibida()`), permitindo abrir fechamento retroativo/futuro de uma empresa específica sem tocar no ponteiro global.
- Mesma validação de formato (`/^\d{2}\/\d{4}$/`) já usada em `salvarCompetenciaGeralCF()`.
- Quando a competência filtrada difere da competência em execução, exibe aviso ("Exibindo MM/AAAA — diferente da competência em execução") com link "Voltar para atual" que limpa o filtro e recarrega.
- Nenhuma tabela nova — reaproveita `fechamento_ciclo` / `fechamento_ciclo_fase` já existentes. Sem SQL pendente.

## Fora de escopo

- Persistir o filtro entre sessões/usuários.
- Visão de matriz empresa x múltiplas competências.
- Alterar o comportamento da barra "Competência em execução" existente.

## Revisão: cards de mês/ano

Pedido do usuário: substituir totalmente o filtro por texto e a barra "Competência
em execução" por cards de seleção de mês, com navegação de ano por setas. Decisões
(via clarificação com o usuário):

- **Cards simples**, sem indicador de status agregado (mais rápido, sem custo
  extra de carregar dados de todos os meses do ano de uma vez).
- **Navegação por ano com setas** (`‹ 2026 ›`) ao lado dos 12 cards Jan–Dez.
- A antiga config "Competência em execução" (`fechamento_config_geral.competencia_atual`)
  **sai da UI**, mas a coluna permanece no banco sem uso (sem migração necessária) —
  confirmado que nenhuma outra tela do módulo lê essa coluna.

**Implementação:** `anoSelecionadoCF` / `mesSelecionadoCF` (estado em memória,
default = mês/ano corrente, não persiste). `competenciaSelecionadaCF()` é a
única fonte de verdade lida por `carregarDashboard()` e `iniciarCiclo()`
(substituindo `competenciaAtual()`/`competenciaExibida()` da primeira
iteração, ambas removidas). Clicar num card (`selecionarMesCF`) ou nas setas
de ano (`mudarAnoCF`) atualiza o estado e recarrega a tabela de empresas —
"a competência na tabela vai mudando de forma dinâmica". O botão "Iniciar
fechamento" por empresa já existente cobre "dar a possibilidade de
preenchimento daquele mês" quando não há ciclo ainda.

## Revisão: catálogo em cards + drag-and-drop no "Fluxo por Empresa"

Pedido do usuário, mesmo dia: na tela "Fluxo por Empresa", (1) o catálogo de
fases padrão deve virar cards (em vez da lista vertical com botão "Editar"),
e (2) a configuração do fluxo por empresa deve aceitar arrastar um card do
catálogo para montar o fluxo daquela empresa.

**Catálogo em cards:** `renderListaCatalogoConfig()` passou a gerar um grid
(`.fase-cards-catalogo`, `auto-fill minmax(160px,1fr)`) de `.fase-card-catalogo`,
cada um com o nome da fase + botão "✎" que mantém a edição inline já existente
(`editandoCatalogoId`) — o card em edição vira coluna (input + Salvar/Cancelar).
Cards não em edição ganham `draggable="true"`.

**Drag-and-drop para o fluxo:** `#listaFasesConfig` (o quadro do fluxo da
empresa selecionada) é o drop zone — recebe listeners `dragover`/`dragleave`/`drop`
uma única vez no `DOMContentLoaded` (o container em si não é recriado por
`innerHTML`, só seu conteúdo). `dragStartFaseCatalogo(event, catalogoId)` grava
o **nome** da fase (resolvido por id em `catalogoCache`, nunca embutido cru num
atributo inline) em `event.dataTransfer`. `dropFaseConfig` lê esse nome e chama
`adicionarFaseCatalogoPorNome(nome)` — nova função compartilhada que também
passou a ser usada pelo fluxo antigo (seletor + botão "+ Adicionar"), com duas
validações que antes só existiam implicitamente via filtro do `<select>`:
exige empresa selecionada e rejeita fase duplicada (toast de erro). O seletor
dropdown **não foi removido** — continua como alternativa ao drag-and-drop
(acessibilidade/touch). Reordenar dentro do fluxo continua pelos botões ↑/↓
existentes (não foi pedido drag-reorder).

Sem SQL novo, sem mudança de schema — é só reorganização de UI sobre o mesmo
`fechamento_config_empresa_fase`.

## Revisão: replicar fluxo para outras empresas

Pedido do usuário, mesmo dia: várias empresas compartilham o mesmo fluxo de
fechamento — precisa ser possível replicar o fluxo já configurado de uma
empresa para outras, em vez de montar cada uma manualmente.

Decisões (via clarificação): sobrescreve com confirmação as empresas de
destino que já tiverem fluxo próprio (aviso lista quais); sempre usa o
**fluxo salvo no banco** da empresa de origem (não o estado em edição na
tela) — se não houver nada salvo, pede pra salvar primeiro.

**Implementação:** novo botão "🔁 Replicar fluxo para outras empresas" ao
lado de "💾 Salvar configuração". `abrirModalReplicarFluxoCF()` busca (1) o
fluxo salvo da empresa selecionada (`fechamento_config_empresa_fase` por
`codigo_empresa`) e (2) todos os `codigo_empresa` que já têm algum fluxo
ativo (pra marcar "já configurada" na lista) — aborta com mensagem se a
origem não tiver nada salvo. Modal (`modalReplicarFluxoCF`, mesmo padrão dos
outros modais de seleção múltipla de empresa: busca + marcar/desmarcar
visíveis) lista as empresas com `possui_folha = true`, exceto a própria
origem. `confirmarReplicarFluxoCF()` monta uma mensagem de confirmação
(`window.confirm`) citando quantas serão sobrescritas, depois faz
`delete().in('codigo_empresa', codigos)` + `insert` em lote na tabela
`fechamento_config_empresa_fase` para todas as empresas marcadas. Sem SQL
novo.
