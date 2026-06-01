# Design: Separação de Faltas (Dias) e Horas Faltantes na Folha de Ponto

**Data:** 2026-06-01  
**Arquivo principal:** `script.js` — função `calcularFolha`

---

## Problema

Atualmente, a função `calcularFolha` trata faltas (dias inteiros sem registro) e horas faltantes (dias trabalhados com jornada incompleta) da mesma forma: ambas somam em `totalFaltante` (em horas). Isso impede o operador de distinguir quantos dias o funcionário faltou versus quantas horas ficou abaixo da jornada.

---

## Solução

Separar os dois conceitos em contadores distintos, com lógica de classificação por dia claramente definida.

---

## Lógica de Classificação por Dia

Cada dia de trabalho cai em exatamente um dos seguintes estados:

| Condição | Estado | Impacto |
|---|---|---|
| Dia com horas > jornada | Hora extra | `extra50` / `extra100` (como hoje) |
| Dia com horas < jornada | Horas faltantes | `faltante` em horas → soma `totalFaltante` |
| Sem horas + flag "falta" (manual) | Falta | `flagFalta = true` → soma `totalFaltas` (+1 dia) |
| Sem horas + flag "folga" | Folga | `flagFolga = true` (sem impacto em totais) |
| Sem horas + flag "atestado" | Atestado Médico | `flagAtestado = true` (sem impacto em totais — mesmo comportamento da folga) |
| Sem horas + sem flag | Sem registro | `flagSemRegistro = true` (sem impacto em totais) |
| DSR / Feriado | Descanso | Lógica existente de extra 100% se trabalhado |

**Regra:** dias com horas parciais nunca podem ser classificados como "Falta em dias". Falta em dias é exclusivamente manual e exclusivamente para dias sem nenhum registro de horas.

---

## Mudanças na Função `calcularFolha`

### Por dia (objeto retornado no `map`)

Adicionar campos:
- `flagSemRegistro: boolean` — true quando sem horas e sem flag explícito
- `flagAtestado: boolean` — true quando marcado manualmente como atestado médico

Alterar comportamento:
- `flagFalta = true` + flag manual → `faltante = 0` (não soma em horas faltantes)
- `flagAtestado = true` → `faltante = 0` (mesmo comportamento da folga)
- Sem horas + sem flag → `faltante = 0`, `flagSemRegistro = true`

### Totalizadores

Adicionar:
- `totalFaltas` — contador de dias inteiros de falta (número inteiro)

Sem mudança:
- `totalFaltante` — permanece apenas para horas parciais
- `horasDevidasMinutos` — calculado exclusivamente sobre `totalFaltante`, faltas em dias não entram

---

## Exibição por Dia (Tabela)

| Situação | Badge |
|---|---|
| Falta | Vermelho — "FALTA" (existente) |
| Folga | Cinza — "FOLGA" (existente) |
| Atestado Médico | Azul — "ATESTADO" (novo) |
| Sem Registro | Amarelo/laranja — "SEM REGISTRO" (novo) |
| Horas faltantes | Coluna `faltante` com valor HH:MM (existente) |

O badge "SEM REGISTRO" é puramente informativo — sinaliza ao operador que o dia precisa de atenção.

---

## Resumo da Folha (Totalizadores)

| Campo | Formato | Fonte |
|---|---|---|
| Horas Faltantes | HH:MM | `totalFaltante` — dias com horas parciais |
| Faltas | N dias | `totalFaltas` — dias marcados manualmente como falta |
| Horas Devidas | HH:MM | Calculado sobre `totalFaltante` apenas (sem mudança) |

---

## O que NÃO muda

- Lógica de horas extras (50% e 100%)
- Lógica de horas noturnas e conversão
- Cálculo de horas devidas (compensação entre extras e faltantes)
- Flag de folga e DSR
- Estrutura do banco de dados (flags existentes `folga/falta` são reutilizados; `atestado` é novo valor no mesmo campo)

---

## Arquivos Impactados

- `script.js` — função `calcularFolha` e renderização da tabela de dias
- `index.html` ou arquivo de template da tabela — badge "SEM REGISTRO" e linha de "Faltas" no resumo
