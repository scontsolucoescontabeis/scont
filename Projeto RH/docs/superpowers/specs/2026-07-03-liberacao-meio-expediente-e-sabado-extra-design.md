# Design: Evento "Liberação Meio Expediente" e Flag "Sábado Sempre Extra"

**Data:** 2026-07-03
**Arquivos principais:** `index.html`, `script.js`

Este documento cobre duas funcionalidades independentes na ferramenta de Controle de Frequência, agrupadas por terem sido brainstormed na mesma sessão.

---

## Parte 1 — Evento "Liberação Meio Expediente"

### Problema

O dropdown "Folga/Falta" da tabela de frequência já tem "Atestado Médico" (dia todo desconsiderado) e "Atestado de Comparecimento" (isenta metade da jornada). Não existe uma opção para quando a empresa libera o empregado para trabalhar só meio expediente por motivos administrativos (não é atestado médico nem de comparecimento).

### Solução

Novo valor no mesmo dropdown: **"Liberação Meio Expediente"** (`value="liberacao_meio_expediente"`), com o **mesmo comportamento de cálculo** que "Atestado de Comparecimento":

- A jornada exigida no dia é reduzida pela metade: `metadeJornada = Math.floor(jornadaEfetiva / 2)`.
- Se as horas trabalhadas no dia (`minTrabalhados`) forem **≥** `metadeJornada` → nenhum desconto (`faltante = 0`).
- Se forem **<** `metadeJornada` → `faltante = metadeJornada - minTrabalhados` (soma em `totalFaltante`, em horas).
- Nunca gera "falta em dias" (`totalFaltas`) nem zera a jornada inteira.

A única diferença para "Atestado de Comparecimento" é o rótulo/motivo — para que apareça separado nos relatórios e na exportação (distinção administrativa: liberação vs. atestado).

### Visibilidade no dropdown

Sempre visível — igual às opções de atestado atuais (linhas 771-772 de `script.js`), inclusive em dias com batidas de ponto já registradas (cobre o caso de bater ponto de manhã e ser liberado à tarde).

### Mudanças

1. **`script.js` (renderização da tabela, ~linha 771-772):** novo `<option value="liberacao_meio_expediente">Liberação Meio Expediente</option>`.
2. **`calcularFolha` (~linha 1185-1250):**
   - Novo flag `flagLiberacaoMeioExpediente`.
   - `isLiberacaoMeioExpediente = flagFolgaData === 'liberacao_meio_expediente'`.
   - Tratado com a mesma lógica de `isAtestadoComp` (linha 1196-1202): isenção de metade da jornada.
   - Incluído no objeto retornado por dia (ao lado de `flagAtestadoComparecimento`).
3. **Badge na tabela de resumo (~linha 1491):** novo badge, ex: `"LIB. MEIO EXPEDIENTE"` com cor própria.
4. **Texto de export/impressão (~linha 1580):** `flagsStr += 'LIBERAÇÃO MEIO EXPEDIENTE '`.
5. **`_construirConteudoTXTExportacao` (~linha 2049-2056):** replicar o mesmo tratamento condicional (`isLiberacaoMeioExpedienteExp`), para consistência entre tela e exportação TXT.

### O que não muda

Cálculo de horas extras, DSR/feriado, demais flags (folga, falta, compensação, atestado médico, atestado de comparecimento).

---

## Parte 2 — Flag "Sábado Sempre Extra"

### Problema

Hoje a ferramenta só permite definir uma jornada normal diferenciada para o sábado (`jornadaSabadoAtiva` / `jornadaSabado`, ex: 04:00), mas ainda existe divisão entre horas normais e horas extras dentro do sábado. Algumas empresas tratam o sábado como dia sem jornada contratual: qualquer hora trabalhada nele é 100% extra, sem parte "normal".

### Solução

Novo checkbox **"Sábado sempre extra"**, mutuamente exclusivo com "Jornada diferenciada para o Sábado" (marcar um desmarca/oculta o outro). Quando ativo, a jornada de referência do sábado passa a ser `0` (em vez de `jornadaSabadoMinutos`), fazendo com que **todas** as horas trabalhadas no sábado caiam na lógica de hora extra já existente (primeiras 2h a 50%, resto a 100%, se `ruleExtra100Optional` estiver ativa; senão tudo a 50%). Sem parte normal, sem gerar `faltante` nesse dia.

Não altera feriado/DSR (que já tratam o dia inteiro como 100% extra) nem flags manuais (falta/folga/atestados/liberação).

Essa funcionalidade precisa existir **nas duas telas** que hoje duplicam a config de jornada de sábado:

### 2A — Tela de Lançamento (seção "⚙️ Configurações", `index.html` ~151-159)

- Novo checkbox `sabadoSempreExtra`, ao lado de `jornadaSabadoAtiva`.
- Ao marcar um, desmarca e oculta o outro (mutuamente exclusivos).
- Novo `state.sabadoSempreExtra` (boolean, default `false`).
- **`calcularFolha` (~linha 1167):**
  ```js
  const jornadaEfetiva = dia.diaSemana === 'Sab'
      ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
      : jornadaMinutos;
  ```
- **Persistência:** novo campo `sabado_sempre_extra` salvo junto com `jornada`, `jornada_sabado_ativa`, `rule_extra_100_opcional` no registro do lote (script.js ~1035-1038), e recarregado junto (~318-319, ~465-466).

### 2B — Modal "Configuração de Rubricas" (`index.html` ~707-716, por empresa)

- Novo checkbox `cfgSabadoSempreExtra`, ao lado de `cfgJornadaSabadoAtiva`, mesma exclusão mútua.
- **`salvarConfigRubricas` (~linha 1806-1810):** nova linha no `jornadaRows`:
  ```js
  { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra', codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0', tipo_valor: 'jornada' },
  ```
- **`_preencherCamposConfigRubricas` / `_limparCamposConfigRubricas` (~linha 1705-1740):** ler/limpar o novo checkbox do mesmo jeito que `jSabAtiva`.
- **`_construirConteudoTXTExportacao` (~linha 2024-2033):**
  ```js
  const sabadoSempreExtra = save.sabado_sempre_extra === '1' || save.sabado_sempre_extra === true;
  // ...
  const jornadaMinEfetiva = dia.diaSemana === 'Sab'
      ? (sabadoSempreExtra ? 0 : jornadaSabadoMin)
      : jornadaMin;
  ```

### O que não muda

Cálculo de horas extras em dias úteis, DSR/feriado, demais flags manuais, estrutura das duas telas além dos novos checkboxes.

---

## Arquivos Impactados

- `index.html` — novo `<option>` no dropdown de Folga/Falta; novo checkbox em "⚙️ Configurações" (tela de lançamento); novo checkbox no modal "Configuração de Rubricas".
- `script.js` — `calcularFolha`, renderização da tabela e badges, `salvarConfigRubricas`, `_preencherCamposConfigRubricas`, `_limparCamposConfigRubricas`, `_construirConteudoTXTExportacao`, carregamento/salvamento do lote (jornada state).
