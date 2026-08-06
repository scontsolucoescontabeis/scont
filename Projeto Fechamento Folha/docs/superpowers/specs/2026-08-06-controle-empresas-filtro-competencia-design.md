# Controle de Fechamento — Filtro de competência em "Controle Empresas"

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
