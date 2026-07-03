# Design: Jornada Diferenciada para Sexta-feira

**Data:** 2026-07-03
**Arquivos principais:** `index.html`, `script.js`, migração SQL

---

## Problema

A ferramenta já permite configurar uma jornada normal diferenciada (reduzida) para o sábado (`jornadaSabadoAtiva`/`jornadaSabado`), usada em `calcularFolha` para separar horas normais de horas extras nesse dia. Não existe equivalente para sexta-feira, que algumas empresas também tratam com jornada reduzida.

---

## Solução

Replicar, ponto a ponto, a lógica já existente de "Jornada diferenciada para o Sábado" para sexta-feira — **não** a lógica de "Sábado sempre extra" (que é um recurso distinto, não solicitado para sexta).

### 1. Tela de lançamento (seção "⚙️ Configurações")

Novo checkbox "Jornada diferenciada para a Sexta" + campo de horas, ao lado do bloco já existente de sábado. Novo estado:
- `state.jornadaSextaAtiva` (boolean, default `false`)
- `state.jornadaSexta` (string "HH:MM", default `'04:00'`, mesmo padrão do sábado)

Sem exclusão mútua com o bloco de sábado — são dias independentes.

### 2. Cálculo (`calcularFolha` e `_construirConteudoTXTExportacao`)

Hoje:
```js
const jornadaSabadoMinutos = (state.jornadaSabadoAtiva && state.jornadaSabado)
    ? converterHoraParaMinutos(state.jornadaSabado)
    : jornadaMinutos;
...
const jornadaEfetiva = dia.diaSemana === 'Sab'
    ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
    : jornadaMinutos;
```

Passa a existir, analogamente:
```js
const jornadaSextaMinutos = (state.jornadaSextaAtiva && state.jornadaSexta)
    ? converterHoraParaMinutos(state.jornadaSexta)
    : jornadaMinutos;
...
const jornadaEfetiva = dia.diaSemana === 'Sab'
    ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
    : dia.diaSemana === 'Sex'
        ? jornadaSextaMinutos
        : jornadaMinutos;
```

Mesma mudança replicada em `_construirConteudoTXTExportacao`, que hoje computa `jornadaSabadoMin`/`jornadaMinEfetiva` de forma equivalente (motor de cálculo duplicado, já existente no projeto).

### 3. Persistência (`rh_saves`)

Novos campos, salvos e recarregados exatamente como `jornada_sabado`/`jornada_sabado_ativa` já são hoje:
- `jornada_sexta` (TEXT)
- `jornada_sexta_ativa` (BOOLEAN DEFAULT FALSE)

Requer migração SQL manual no Supabase (mesmo padrão da migração de `sabado_sempre_extra`).

### 4. Modal "Configuração de Rubricas" (por empresa)

Novo checkbox + campo espelhando `cfgJornadaSabadoAtiva`/`cfgJornadaSabado`, salvo como novo evento na tabela EAV `rh_config_rubricas_txt` (`evento: 'jornada_sexta_ativa'`, `evento: 'jornada_sexta'`) — sem migração de banco necessária (tabela já suporta eventos arbitrários).

### 5. Pré-preenchimento por empresa

`selecionarEmpresa()` passa a também ler `cfg['jornada_sexta_ativa']`/`cfg['jornada_sexta']` e pré-preencher os novos campos da tela de lançamento, do mesmo jeito que já faz para sábado.

---

## O que NÃO muda

- "Sábado sempre extra" e "Jornada diferenciada para o Sábado" continuam exatamente como estão, sem nenhuma interação com o novo recurso de sexta.
- Nenhum recurso "Sexta sempre extra" é adicionado (fora do escopo pedido).
- Cálculo de horas extras, DSR/feriado, demais flags manuais.

---

## Arquivos Impactados

- Criar: migração SQL (`schema_rh_jornada_sexta.sql`) — nova coluna em `rh_saves`.
- Modify: `schema_rh.sql` (documentar a nova coluna).
- Modify: `index.html` — checkbox/campo na tela de lançamento e no modal de Configuração de Rubricas.
- Modify: `script.js` — `state`, `calcularFolha`, `_construirConteudoTXTExportacao`, persistência (salvar/carregar lote), modal (`salvarConfigRubricas`, `_preencherCamposConfigRubricas`, `_limparCamposConfigRubricas`), `selecionarEmpresa`.
