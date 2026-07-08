# Design: Configuração por Empresa — Regra de Hora Extra 100%, Turnos e Não Compensar

**Data:** 2026-07-08
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`, `Projeto RH/schema_rh.sql`

---

## Contexto

O Controle de Frequência hoje trata três configurações como estado manual/global, sem vínculo com a empresa:

- **Regra de hora extra 100% a partir da 3ª hora** (`ruleExtra100Optional`) — checkbox na tela de edição da folha, sempre nasce desmarcado, o operador marca manualmente a cada sessão.
- **Empresa com 3 turnos** (`terceiroTurno`) — checkbox na mesma tela, persistido em `localStorage` de forma global (não por empresa), o operador alterna manualmente conforme a empresa que está processando.
- **Não compensar horas extras com horas faltantes** — checkbox nos modais "Gerar TXT" (individual, `resNaoCompensar`) e "Exportar TXT" (lote, `expNaoCompensar`), sempre nasce desmarcado, sem persistência.

O sistema já resolve um problema parecido para jornada de trabalho, sábado sempre extra e observações: a tabela `rh_config_rubricas_txt` funciona como uma configuração genérica por empresa (chave `codigo_empresa` + `evento`), carregada automaticamente em `selecionarEmpresa()` quando o operador escolhe a empresa na tela inicial, e editável no modal **"⚙️ Configurar Rubricas por Empresa"**.

Este design estende o mesmo mecanismo para as três configurações acima, eliminando a necessidade de reconfiguração manual a cada folha processada.

---

## Banco de Dados

Nenhuma tabela nova. Três novos `evento` na tabela existente `rh_config_rubricas_txt`:

| evento | Valores | tipo_valor |
|---|---|---|
| `rule_extra_100_opcional` | `'1'` / `'0'` | `config` |
| `terceiro_turno` | `'1'` / `'0'` | `config` |
| `nao_compensar_extras` | `'1'` / `'0'` | `config` |

Upsert por `(codigo_empresa, evento)`, mesmo padrão já usado para os eventos de jornada (`onConflict: 'codigo_empresa,evento'`). Sem migration estrutural — nenhuma alteração de schema SQL é necessária além de nenhuma (a tabela já existe e é schema-less quanto a `evento`).

---

## Modal "Configurar Rubricas por Empresa"

### Nova seção: "Regras de Horas Extras e Turnos"

Inserida entre a seção "Jornada de Trabalho" e a seção "Observações" já existentes, seguindo o mesmo estilo visual (`border`, cabeçalho em uppercase):

```
┌ REGRAS DE HORAS EXTRAS E TURNOS ──────────────────┐
│ ☐ Aplicar Hora Extra 100% a partir da 3ª hora     │
│ ☐ Empresa com 3 turnos (Entrada 3 / Saída 3)      │
│ ☐ Não compensar horas extras com horas faltantes  │
│    (padrão ao gerar TXT)                          │
└────────────────────────────────────────────────────┘
```

IDs: `cfgRuleExtra100`, `cfgTerceiroTurno`, `cfgNaoCompensarDefault` (prefixo `cfg` consistente com os demais campos do modal).

### `salvarConfigRubricas()`

Adicionar ao array `jornadaRows` (ou um array irmão) as 3 novas linhas:

```js
{ codigo_empresa: codigoEmpresa, evento: 'rule_extra_100_opcional', codigo_rubrica: document.getElementById('cfgRuleExtra100')?.checked ? '1' : '0', tipo_valor: 'config' },
{ codigo_empresa: codigoEmpresa, evento: 'terceiro_turno',          codigo_rubrica: document.getElementById('cfgTerceiroTurno')?.checked ? '1' : '0', tipo_valor: 'config' },
{ codigo_empresa: codigoEmpresa, evento: 'nao_compensar_extras',    codigo_rubrica: document.getElementById('cfgNaoCompensarDefault')?.checked ? '1' : '0', tipo_valor: 'config' },
```

Incluídas no mesmo `upsert` já existente.

### `_limparCamposConfigRubricas()` / `_preencherCamposConfigRubricas(cfg)`

- Limpar: os 3 checkboxes voltam para desmarcado.
- Preencher: `checked = cfg?.['rule_extra_100_opcional']?.cod === '1'` (idem para os outros dois). Ausência de config (empresa nunca configurada) resulta em `false` para os três — mesmo comportamento hoje.

### `limparConfigRubricas()`

Sem mudança — já deleta todos os registros da empresa em `rh_config_rubricas_txt`, o que remove os 3 novos eventos junto com os demais.

---

## Aplicação dos defaults

### Tela inicial — `selecionarEmpresa(codigo, nome)`

Após buscar `cfg` (já feito hoje para jornada), adicionar:

```js
const ruleExtra100 = document.getElementById('ruleExtra100Optional');
const terceiroT    = document.getElementById('terceiroTurno');
if (ruleExtra100) ruleExtra100.checked = cfg?.['rule_extra_100_opcional']?.cod === '1';
if (terceiroT) {
    const ativo = cfg?.['terceiro_turno']?.cod === '1';
    terceiroT.checked = ativo;
    state.terceiroTurno = ativo; // mantém state sincronizado, igual a alternarTerceiroTurno
}
```

Continuam editáveis pelo operador durante a sessão (o mesmo padrão da jornada diária) — o toggle manual de `terceiroTurno` continua atualizando `localStorage['rh_terceiro_turno']` via `alternarTerceiroTurno`, sem mudança nesse comportamento. `ruleExtra100Optional` é lido diretamente do checkbox no momento do processamento (`processarFolhaComSalvamento`), então não precisa de sincronização adicional de `state`.

### Modal "Gerar TXT" individual — `abrirModalTxtResultados()`

Troca:
```js
document.getElementById('resNaoCompensar').checked = false;
```
por:
```js
const codEmpTxt = state.empresaSelecionada?.codigo_empresa;
const cfgTxt = codEmpTxt ? await _buscarConfigRubricas(codEmpTxt) : null; // cfg já é buscado logo em seguida; reaproveitar a mesma chamada
document.getElementById('resNaoCompensar').checked = cfgTxt?.['nao_compensar_extras']?.cod === '1';
```
Como a função já chama `_buscarConfigRubricas(codEmp)` para os campos de rubrica, o valor de `nao_compensar_extras` é lido do mesmo objeto `cfg`, sem chamada extra ao Supabase. Após setar `checked`, chamar a mesma lógica de troca de rótulo usada em `_toggleNaoCompensar('res')` (ou invocar a função diretamente) para que "Atraso" já apareça como "Horas Faltantes" quando o default vier marcado.

### Modal "Exportar TXT" em lote — `abrirModalExportacaoTXT()`

Mesmo tratamento, usando o `cfg` já buscado a partir de `state.empresaSelecionada?.codigo_empresa` (comportamento hoje já usado para pré-preencher os códigos de rubrica `exp*`):

```js
document.getElementById('expNaoCompensar').checked = cfg?.['nao_compensar_extras']?.cod === '1';
```

com a mesma chamada ao toggle de rótulo (`expLabelAtraso`). Igual ao pré-preenchimento de rubricas nesse modal, o default reflete a empresa atualmente selecionada na sessão — se o lote exportado incluir outras empresas com configuração diferente, o checkbox único do modal não captura isso (limitação pré-existente, não introduzida por este design).

---

## O que NÃO muda

- Lógica de cálculo de horas extras, turnos e compensação (`calcularFolha`, `_construirConteudoTXTResultados`, `_construirConteudoTXTExportacao`) — só a origem do valor inicial dos checkboxes.
- Estrutura de dados do terceiro turno (`entrada3`/`saida3`) e sua ativação condicional na renderização da tabela.
- O flag `terceiroTurno` continua sendo binário (com/sem 3º turno); não há suporte a granularidade adicional de "2 vs 3 turnos" além do que já existe.
- `localStorage['rh_terceiro_turno']` continua existindo como fallback/estado de sessão para alternância manual; não é removido.
- Nenhuma mudança em `rh_saves` ou nos dados já processados de folhas anteriores.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `index.html` | Nova seção "Regras de Horas Extras e Turnos" no modal `configRubricasModal` |
| `script.js` | `salvarConfigRubricas`, `_limparCamposConfigRubricas`, `_preencherCamposConfigRubricas`, `selecionarEmpresa`, `abrirModalTxtResultados`, `abrirModalExportacaoTXT` |
| `schema_rh.sql` | Nenhuma alteração estrutural (eventos são schema-less na tabela existente); opcionalmente documentar os 3 novos eventos no comentário de referência da tabela |

---

## Fora de escopo (tratado em spec separada)

Tratamento de um conjunto de empresas como "grupo" para gerar modelos de inserção de dados, processar folhas e gerar TXT de forma integrada para várias empresas de uma vez. Essa funcionalidade tem impacto mais profundo na navegação (hoje a tela de edição/processamento é estritamente de uma empresa por sessão) e será desenhada em um documento próprio.
