# Folga Pontual (Exceção do Dia) — Gerar Escala

## Problema

Na tela "Gerar Escala" (`index.html` / `script.js`, tela `escalaScreen`), a escala de
um empregado (`rh_escala_trabalho`) é uma configuração fixa/recorrente (fixa,
variável por datas ou variável por padrão de blocos). Às vezes, numa competência
específica, o usuário precisa marcar um dia pontual como folga — sem alterar a
escala do empregado, que deve continuar valendo normalmente nos demais dias e nas
competências seguintes.

## Escopo

Tela "Gerar Escala" (marcação da exceção) e "Gerar Benefícios" (consumo, já que hoje
usa `calcularResumoMes` para "Dias a Trabalhar" — [[project_rh_beneficios_vt_va]]).
Não altera `rh_escala_trabalho` nem os tipos de escala existentes.

## 1. Persistência: nova tabela `rh_escala_excecoes`

Uma linha por dia marcado como folga pontual, independente do tipo de escala:

```sql
CREATE TABLE public.rh_escala_excecoes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    data              DATE NOT NULL,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rh_escala_excecoes_uniq UNIQUE (codigo_empresa, codigo_empregado, data)
);
```

Mesmo padrão de RLS/índice de `rh_escala_trabalho` (leitura/escrita para
`authenticated`). Novo arquivo `schema_rh_escala_excecoes.sql`, a ser executado
manualmente no SQL Editor do Supabase — sem migração de dados existentes.

## 2. Núcleo: `calcularResumoMes` (escala-calculo.js)

Novo parâmetro opcional `datasExcecaoFolga` (array de datas ISO `AAAA-MM-DD`):

```js
function calcularResumoMes(escala, competencia, periodosFerias, diaInicio = null, diaFim = null, datasExcecaoFolga = null)
```

Um dia cuja data ISO está em `datasExcecaoFolga` sempre vira folga no resumo,
independente do que a escala diga para aquele dia. Prioridade: **férias > exceção >
escala** (férias já é a prioridade máxima hoje; exceção fica logo abaixo, sobrepondo
só a escala). O objeto de cada dia ganha um novo flag `excecao: true` (paralelo a
`ferias: true`), para diferenciar visualmente e permitir toggle na tela.

```js
const emFerias = _dataEmPeriodo(iso, periodosFerias);
const emExcecao = !emFerias && (datasExcecaoFolga || []).includes(iso);
return {
    data: d.data, diaSemana: d.diaSemana,
    tipo: (emFerias || emExcecao) ? 'folga' : calcularTipoDia(escala, d.data, d.diaSemana),
    ferias: emFerias,
    excecao: emExcecao
};
```

`totalTrabalho`/`totalFolga`/`totalFerias`/`totalDias` continuam calculados a partir
de `dias`, sem mudança de fórmula (a exceção já entra como folga em `tipo`).

## 3. `gerarEscala()` (script.js)

Busca também `rh_escala_excecoes` das empresas selecionadas (mesmo padrão de
`feriasData`), monta `excecoesMapa[codigo_empresa_codigo_empregado] = ['AAAA-MM-DD', ...]`
e passa para `calcularResumoMes(escala, comp, periodosFerias, null, null, datasExcecao)`
(os parâmetros de período de apuração ficam `null` — Gerar Escala não usa período
customizado, [[project_rh_periodo_apuracao_frequencia]]). A lista de exceções fica
guardada em `linha.excecoesFolga` para uso no toggle.

## 4. Interação: clicar no mini-calendário

`_renderizarMiniCalendarioEscala` ganha `onclick` por célula, conforme o estado do dia:

- **Férias**: não clicável (cursor padrão, sem `onclick`) — férias tem prioridade,
  marcar exceção não teria efeito.
- **Trabalho** (sem exceção): clique chama `_toggleExcecaoFolgaEscala(idx, dataBR)` →
  insere em `rh_escala_excecoes` (upsert, ignora conflito), recalcula
  `linha.resumo` com a nova lista, re-renderiza o calendário.
- **Exceção** (já marcada): clique remove a linha (`delete` por
  `codigo_empresa+codigo_empregado+data`), recalcula, re-renderiza.
- **Folga normal** (da própria escala, sem exceção): não clicável — já é folga, nada
  a marcar.

Nova cor para "folga marcada": `#8B5CF6` (roxo), distinta de folga normal
(`#B8860B`), trabalho (`#27AE60`) e férias (`#2C7BE5`). Tooltip do dia indica
"folga marcada manualmente (clique para desfazer)" quando `excecao === true`, e
"clique para marcar folga pontual" quando é um dia de trabalho clicável.

Toggle salva imediatamente no Supabase (sem botão "Salvar" separado, sem passar pelo
formulário de configuração de escala) — mesmo espírito de ação imediata já usado em
outros toggles pontuais do projeto.

## 5. Integração em `gerarPreviaBeneficios` (Gerar Benefícios)

Mesmo padrão de "Gerar Escala": busca `rh_escala_excecoes` das empresas
selecionadas, monta mapa por `codigo_empresa_codigo_empregado`, passa como
`datasExcecaoFolga` para `calcularResumoMes` ao montar `resumoEscala` de cada
empregado — reduzindo "Dias a Trabalhar" quando há exceção na competência (ou no
período customizado, se ativo — [[project_rh_beneficios_vt_va]]). Sem mudança na
consulta de "Dias a Descontar".

## Fora de escopo

- Motivo/observação por exceção (só a data, sem texto livre).
- Edição em lote / múltiplos dias de uma vez (um clique = um dia).
- Alterar `rh_escala_trabalho` ou qualquer tipo de escala existente.
- Gerar Escala e Gerar Benefícios continuam sem alimentar a Folha de Ponto.
