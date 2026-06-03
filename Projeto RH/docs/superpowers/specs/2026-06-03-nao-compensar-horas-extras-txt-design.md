# Design: Opção de Não Compensação de Horas Extras na Geração do TXT

**Data:** 2026-06-03  
**Status:** Aprovado

## Contexto

Na geração do TXT para folha de pagamento, o sistema atualmente compensa horas faltantes com horas extras antes de gerar os valores. O usuário precisa da opção de gerar o TXT com os valores brutos (sem compensação), enviando extras e faltantes como rubricas independentes.

## Escopo

Afeta dois modais:
- `txtRubricasModal` — geração individual (a partir dos resultados da folha de ponto processada)
- `exportTxtModal` — exportação em lote por competência/empresa

## UI

### Checkbox em cada modal

Logo abaixo do título "Configuração de Rubricas" em ambos os modais, adicionar:

```
☐  Não compensar horas extras com horas faltantes
```

- ID individual: `resNaoCompensar`
- ID exportação: `expNaoCompensar`
- Padrão: desmarcado ao abrir o modal (sem persistência no localStorage)
- Ao marcar: label "Atraso" na tabela de rubricas muda para "Horas Faltantes"
- Ao desmarcar: label volta para "Atraso"

### Label dinâmico

O `<span>` do label "Atraso" em cada modal recebe um ID para atualização via JS:
- Individual: `resLabelAtraso`
- Exportação: `expLabelAtraso`

## Lógica

### Modal individual (`_construirConteudoTXTResultados`)

**Modo compensação (padrão):** comportamento atual — abate50/abate100 reduzem he50/he100, e `res.totais.devidas` é usado como `mins_atr`.

**Modo não compensação (checkbox marcado):**
- `he50 = converterHoraParaMinutos(res.totais.extra50)` sem abate
- `he100 = converterHoraParaMinutos(res.totais.extra100)` sem abate
- `mins_atr = converterHoraParaMinutos(res.totais.faltante)` (bruto, pré-compensação)

### Modal de exportação (`_construirConteudoTXTExportacao`)

**Modo compensação (padrão):** comportamento atual — bloco "Compensar devidas com extras" reduz `tEx50`/`tEx100` e recalcula `tDev`.

**Modo não compensação (checkbox marcado):**
- Pular o bloco de compensação inteiro
- `tEx50`, `tEx100` e `tDev` mantêm os valores acumulados brutos dia a dia

## Sem alterações necessárias em

- `_linhasTxt` — recebe os valores já corretos, sem distinção de modo
- `_linhasFaltas` — não afetado
- localStorage — preferência não é persistida
