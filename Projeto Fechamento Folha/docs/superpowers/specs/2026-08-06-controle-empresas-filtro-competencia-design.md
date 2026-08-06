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
