# Controle de Frequência: cálculo automático de DSR nas faltas

Data: 2026-07-21
Arquivos afetados: `script.js`, `index.html`

## Contexto

Mesma regra já implementada no Lançamentos (`docs/superpowers/specs/2026-07-21-lancamentos-dias-falta-detalhamento-design.md`, seção "Extensão"), agora aplicada ao Controle de Frequência.

O Controle de Frequência já calculava, por empregado, as datas exatas de falta (`dia.data`, formato `DD/MM/AAAA`) a partir do ponto processado — bem mais preciso que o Lançamentos, que depende de o usuário digitar os dias manualmente. Mas o campo `flagDSR` que já existia em `diasFaltaDetalhes` (usado por `_linhasFaltas`) era sempre `false` na prática: ele checava se o **próprio dia da falta** já era um dia de descanso (`isDSR = dsrDias.includes(dia.data)`), o que é logicamente impossível já que falta só é registrada quando `!isDiaDescanso`. Ou seja, a linha informativa `11...` sempre saía com flag `1`, e não existia nenhuma linha de rubrica separada para "DIAS FALTAS DSR" — o desconto de DSR por falta nunca foi de fato gerado.

## Regra de negócio (igual ao Lançamentos)

- Semana de referência: segunda a sábado. DSR perdido cai sempre no domingo seguinte.
- Faltas da mesma semana → uma única linha de DSR (dedup por empregado).
- Desconto (linha `10...`) sempre lançado na competência atual sendo processada; a linha informativa `11...` carrega a data real do domingo (pode estar no mês seguinte).
- Ativado por checkbox "Calcular DSR automaticamente", marcado por padrão, presente nas duas telas que geram TXT.

## Decisões específicas desta ferramenta

1. **Resolução da rubrica "DIAS FALTAS DSR"**: automática, pelo catálogo (`rh_rubricas`) da empresa — mesmo padrão do Lançamentos (`detectarFaltaTipo` por descrição). Não foi criado nenhum campo fixo novo na tela de configuração de rubricas (ao lado de "Falta"); a rubrica DSR não precisa estar configurada em `rh_config_rubricas_txt`.
2. **Escopo**: aplicado às duas telas que geram TXT no Controle de Frequência — "Resultados" (uma empresa, dados de ponto já processados) e "Exportação em lote" (várias empresas, a partir de `rh_saves`).
3. **Empresa sem a rubrica cadastrada no catálogo**: pula o cálculo de DSR só para essa empresa/empregados, sem bloquear o resto; avisa ao final (mensagem de sucesso).

## Mudanças

### 1. Helpers novos (compartilhados pelas duas telas)

Adicionados perto de `_linhasFaltas`/`_linhasTxt`:

- `_normalizarDescricaoRubrica(descricao)` / `detectarFaltaTipo(descricao)`: idêntico ao do Lançamentos.
- `proximoDomingo(data)`: dado um `Date`, retorna o `Date` do domingo seguinte.
- `_resolverCodigoRubricaDsr(catalogo)`: busca no catálogo (array de `rh_rubricas`) a rubrica cuja descrição é `dsr`.
- `_calcularDomingosDSR(diasFaltaDetalhes)`: a partir de um array `{ data: 'DD/MM/AAAA' }`, retorna os domingos únicos (deduplicados) em ordem crescente.
- `_formatarDataBR(data)`: `Date` → `'DD/MM/AAAA'`.
- `_linhaRubricaFaltaDSR(rubricaDSR, tipoProcesso, codEmp, compFmt, codEmpresa, domingos)`: monta a linha `10...` (quantidade = nº de domingos) seguida das linhas `11...` (uma por domingo, flag `2`), reaproveitando `_linhasFaltas`.

### 2. `_linhasFaltas` simplificada

Passa a receber um `flagChar` explícito (default `'1'`) em vez de ler `dia.flagDSR` (que nunca refletia a realidade). O campo `flagDSR` foi removido do objeto empurrado em `diasFaltaDetalhes.push({ data: dia.data })` (estava morto).

### 3. `_linhasTxt` ganha parâmetro `rubricaFaltaDSR`

Logo após a linha de `_linhasFaltas(diasFaltaDetalhes)` (que agora sempre sai com flag `1`, são as datas da rubrica de falta normal), é inserida a chamada:

```js
_linhaRubricaFaltaDSR(rubricaFaltaDSR, config.tipoProcesso, codEmp, compFmt, codEmpresa, _calcularDomingosDSR(diasFaltaDetalhes)),
```

Se `rubricaFaltaDSR` for `null` (checkbox desmarcado, ou empresa sem a rubrica no catálogo), a função retorna string vazia — sem efeito no TXT.

### 4. `_construirConteudoTXTResultados` (tela "Resultados", uma empresa)

- Novo checkbox `#resCalcularDsrAutomatico` no modal `txtRubricasModal` (`index.html`), logo abaixo da linha "Falta (em dias)".
- `rubricaFaltaDSR = calcularDsrAuto ? _resolverCodigoRubricaDsr(_catalogoRubricasAtual) : null` (catálogo já carregado em `abrirModalTxtResultados`).
- Se houver falta e a rubrica não for encontrada, marca `avisoDsrSemRubrica = true`, retornado junto com `conteudoTXT`; `_efetivarDownloadTXTResultados` acrescenta um aviso na mensagem de sucesso.

### 5. `_construirConteudoTXTExportacao` (tela "Exportação em lote", várias empresas)

- Novo checkbox `#expCalcularDsrAutomatico` no modal `exportTxtModal`, mesma posição.
- Catálogo de rubricas é buscado por empresa (`_buscarCatalogoRubricas`, já com cache) para todas as empresas selecionadas, via `Promise.all`, antes do loop de cálculo (que é síncrono).
- Empresas sem a rubrica DSR no catálogo são acumuladas em `empresasSemRubricaDsr` (Set), retornado junto com `conteudoTXT`; `gerarArquivoTXT` acrescenta os nomes na mensagem de sucesso.

## Fora de escopo

- Sem mudança de schema (`rh_rubricas`, `rh_config_rubricas_txt`, `rh_saves`).
- Não cobre a "Exportação em lote" quando duas empresas do lote usam rubrica DSR com códigos diferentes por engano de cadastro — cada empresa resolve seu próprio código independentemente, como já acontece com as demais rubricas configuradas.
- Não interage com o Lançamentos (`lancamentos.js`) — cálculo independente, mesma regra de negócio replicada.
