# Design: Revisão de Flags (Falta/Atestado/DSR/Folga) no Processamento em Lote do Grupo

**Data:** 2026-07-09
**Status:** Aprovado
**Substitui:** a decisão "Flags de dia fora do escopo do upload em lote" do design [`2026-07-08-grupos-empresas-lote-design.md`](2026-07-08-grupos-empresas-lote-design.md)
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`

---

## Contexto

O processamento em lote do grupo (`processarLoteGrupo`), como implementado originalmente, importava os Excels e já calculava/salvava tudo automaticamente, sem permitir que o operador marcasse Falta, Atestado, DSR customizado, Folga ou Compensação — esses flags só existem na tela de edição individual (`mainScreen`), via `<select>` por dia.

O usuário pediu que o lote permita a mesma revisão de flags feita hoje no processo individual, empresa por empresa, antes de salvar.

---

## Decisão de design

Em vez de duplicar a UI de flags numa tela nova, o upload em lote passa a **reaproveitar a tela de edição individual já existente (`mainScreen`)**, numa fila sequencial: o sistema importa os arquivos de todas as empresas válidas do grupo (sem salvar nada ainda), e abre a `mainScreen` já preenchida com os dados da 1ª empresa da fila. O operador revisa/marca os flags normalmente e clica no mesmo botão "✅ Processar e Salvar Folha" que já existe — que já calcula e salva via `processarFolhaComSalvamento`, sem nenhuma alteração nessa função. Ao chegar em `resultsScreen` (sucesso), aparece um botão "▶️ Próxima Empresa do Grupo" que avança para a próxima empresa da fila, repetindo o ciclo até a última. Ao final, mostra o resumo por empresa (mesmo modal já existente, `loteResumoModal`).

Isso reaproveita 100% da lógica de cálculo, salvamento e UI de flags já validada no fluxo individual — nenhuma duplicação de lógica de negócio.

---

## Fluxo

1. Operador clica "📤 Processar em Lote" e seleciona os arquivos `.xlsx`.
2. **Fase de preparação** (sem salvar nada): mesma validação de nome de arquivo/competência/pertencimento ao grupo/duplicata já existente. Para cada arquivo válido: busca empregados da empresa, busca a config da empresa (jornada, regra 100%, 3 turnos), lê o Excel e monta os `folhas` (mesmo parser já existente, extraído para uma função reutilizável `_parseExcelParaFolhas`). Empresas sem empregados cadastrados ou sem nenhuma aba correspondente entram direto no resumo como erro, sem entrar na fila. Empresas do grupo sem arquivo entram como "sem arquivo enviado".
3. Se a fila de empresas prontas para revisão ficar vazia (tudo caiu em erro/sem-arquivo), mostra o resumo direto.
4. Caso contrário, inicia a fila: carrega a 1ª empresa da fila em `state` (`empresaSelecionada`, `competencia`, `folhas`) e nos campos da tela de edição (jornada, regra 100%, 3 turnos — mesma função usada por `selecionarEmpresa`, extraída para `_aplicarConfigEmpresaNaTelaEdicao`), renderiza as abas (`renderizarAbas`) e abre `mainScreen`.
5. Um banner fixo (`filaLoteGrupoBanner`), visível em `mainScreen` e `resultsScreen`, mostra "Lote do grupo X — empresa 2/5" e um botão "✖ Cancelar Lote".
6. Operador revisa os dias, marca Falta/Atestado/DSR/Folga/Compensação como faria normalmente, e clica "✅ Processar e Salvar Folha" (fluxo existente, sem alteração — inclui a assinatura com nome do responsável).
7. Ao chegar em `resultsScreen`, o banner passa a mostrar "✅ Empresa processada (2/5)" com o botão "▶️ Próxima Empresa do Grupo".
8. Clicar em avançar registra o resultado da empresa atual e carrega a próxima da fila (volta ao passo 4) ou, se era a última, finaliza.
9. "✖ Cancelar Lote" (disponível a qualquer momento durante a fila) pede confirmação, marca as empresas restantes como "canceladas" no resumo e finaliza — empresas já processadas e salvas permanecem salvas.
10. Ao finalizar (última empresa avançada ou cancelamento), volta para `gruposScreen` e mostra o resumo consolidado (`loteResumoModal`) com todas as empresas: sucesso, erro, sem arquivo ou cancelada.

---

## O que muda em relação ao design anterior

- `processarLoteGrupo` deixa de calcular/salvar diretamente (`calcularFolha` + `upsert` num loop headless). Passa a apenas **preparar** a fila (parse + validações) e delegar cálculo/salvamento para o fluxo individual já existente.
- Novo estado `_filaLoteGrupo` (fila em memória, não persistida) com os itens prontos para revisão, índice atual e resultados acumulados.
- `selecionarEmpresa` é refatorada para extrair a aplicação de config (jornada/regra 100%/3 turnos) numa função `_aplicarConfigEmpresaNaTelaEdicao(cfg)`, reaproveitada pela fila do lote — sem mudança de comportamento no fluxo individual.
- Novo banner fixo de fila (`filaLoteGrupoBanner`), posicionado fora das telas (entre o cabeçalho e o `.container`), controlado por `_atualizarBannerFilaLote(telaId)` chamado a partir de `mostrarTela`.
- `_mostrarResumoLote` ganha um novo status possível: `'cancelado'`.

## O que NÃO muda

- `processarFolhaComSalvamento`, `iniciarSalvamento`, `confirmarSalvamentoComAssinatura`, `calcularFolha`, os `<select>` de Folga/Falta/Atestado/Compensação/DSR na tabela de dias — tudo reaproveitado sem alteração.
- O fluxo individual normal (fora do contexto de lote) continua idêntico; a fila só existe quando `_filaLoteGrupo` está ativo.
- Baixar Modelos (.zip) e Exportar TXT do Grupo não são afetados por este design.
