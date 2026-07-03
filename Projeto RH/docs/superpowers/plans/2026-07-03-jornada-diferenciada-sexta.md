# Jornada Diferenciada para Sexta-feira Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicar, para sexta-feira, a lógica já existente de "Jornada diferenciada para o Sábado" — jornada normal reduzida configurável, sem o comportamento de "sempre extra".

**Architecture:** Todas as mudanças espelham exatamente o padrão já usado para `jornadaSabado`/`jornadaSabadoAtiva`, em todos os pontos onde esse padrão existe hoje: `state`, tela de lançamento, persistência (`rh_saves`), motor de cálculo (`calcularFolha` e `_construirConteudoTXTExportacao`), modal de Configuração de Rubricas (EAV) e pré-preenchimento por empresa (`selecionarEmpresa`).

**Tech Stack:** JavaScript vanilla, HTML inline, Supabase (Postgres) via `supabaseClient`. Sem build step, sem framework de testes.

## Global Constraints

- Novos campos: `state.jornadaSexta` (string "HH:MM", default `'04:00'`), `state.jornadaSextaAtiva` (boolean, default `false`).
- Persistência em `rh_saves`: colunas `jornada_sexta` (TEXT), `jornada_sexta_ativa` (BOOLEAN DEFAULT FALSE) — requer migração manual no Supabase.
- Modal de Configuração de Rubricas: novos eventos EAV `jornada_sexta_ativa`, `jornada_sexta` em `rh_config_rubricas_txt` — sem migração (tabela já é EAV).
- **Sem exclusão mútua** com o bloco de sábado (dias independentes) e **sem** um "Sexta sempre extra" (fora de escopo).
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar — não confie apenas no número da linha, pois tasks anteriores deste mesmo plano alteram o arquivo.

---

## Arquivos Impactados

- Criar: `Projeto RH/schema_rh_jornada_sexta.sql` (migração manual no Supabase)
- Modify: `Projeto RH/schema_rh.sql` (documentar as novas colunas)
- Modify: `Projeto RH/index.html`
  - Seção "⚙️ Configurações" da tela de lançamento (~linha 153-169): novo checkbox/campo "Jornada diferenciada para a Sexta"
  - Modal "Configuração de Rubricas" (~linha 706-733): novo checkbox/campo espelhado
- Modify: `Projeto RH/script.js`
  - `state` global (~linha 11-26): `jornadaSexta`, `jornadaSextaAtiva`
  - Inicialização (~linha 44): listener de formatação do novo campo de horas
  - Novo `window.toggleJornadaSexta` (perto de ~linha 57-62)
  - `selecionarEmpresa` (~linha 119-148): pré-preenchimento
  - Blocos de carregamento de lote (~linha 337-359 e ~486-508)
  - `iniciarSalvamento` (~linha 968-981) e payload de salvamento (~linha 1058-1074)
  - `calcularFolha` (~linha 1188-1198)
  - `_construirConteudoTXTExportacao` (~linha 2101-2114)
  - `_preencherCamposConfigRubricas` / `_limparCamposConfigRubricas` (~linha 1772-1816)
  - `salvarConfigRubricas` (~linha 1871-1888)

---

## Task 1: Migração de banco de dados

**Files:**
- Create: `Projeto RH/schema_rh_jornada_sexta.sql`
- Modify: `Projeto RH/schema_rh.sql`

### Passos

- [ ] **Step 1: Criar o arquivo de migração**

Criar `Projeto RH/schema_rh_jornada_sexta.sql`:

```sql
-- Migração: jornada diferenciada para Sexta-feira em rh_saves
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_saves
  ADD COLUMN IF NOT EXISTS jornada_sexta TEXT,
  ADD COLUMN IF NOT EXISTS jornada_sexta_ativa BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Documentar as colunas no schema principal**

Em `Projeto RH/schema_rh.sql`, localizar (a linha exata do bloco `jornada_sabado`/`sabado_sempre_extra`/`rule_extra_100_opcional` — busque por este texto):
```sql
    jornada_sabado              TEXT,               -- ex: "04:00" (jornada diferenciada do Sábado)
    jornada_sabado_ativa        BOOLEAN DEFAULT FALSE,
    sabado_sempre_extra         BOOLEAN DEFAULT FALSE, -- todas as horas do sábado contam como extra (exclusivo com jornada_sabado_ativa)
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,
```
Substituir por:
```sql
    jornada_sabado              TEXT,               -- ex: "04:00" (jornada diferenciada do Sábado)
    jornada_sabado_ativa        BOOLEAN DEFAULT FALSE,
    sabado_sempre_extra         BOOLEAN DEFAULT FALSE, -- todas as horas do sábado contam como extra (exclusivo com jornada_sabado_ativa)
    jornada_sexta               TEXT,               -- ex: "04:00" (jornada diferenciada da Sexta-feira)
    jornada_sexta_ativa         BOOLEAN DEFAULT FALSE,
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,
```

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/schema_rh_jornada_sexta.sql" "Projeto RH/schema_rh.sql"
git commit -m "chore: adicionar colunas jornada_sexta e jornada_sexta_ativa em rh_saves (migração)"
```

- [ ] **Step 4: Avisar o usuário**

Peça ao usuário para rodar o conteúdo de `Projeto RH/schema_rh_jornada_sexta.sql` no SQL Editor do Supabase (projeto correto) antes de testar o salvamento de lotes com o novo campo.

---

## Task 2: Checkbox/campo na tela de lançamento e cálculo

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o checkbox/campo em `index.html`**

Localizar (~linha 153-169):
```html
                    <div class="setting-card">
                        <h4>Jornada de Trabalho</h4>
                        <input type="text" id="jornada" value="08:00" maxlength="5" placeholder="HH:MM">
                        <small>Horas diárias de trabalho</small>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="jornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleJornadaSabado(this.checked)">
                            <label for="jornadaSabadoAtiva" style="font-size: 12px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="jornadaSabadoContainer" style="display: none; margin-top: 8px;">
                            <input type="text" id="jornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM">
                            <small>Horas no Sábado</small>
                        </div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleSabadoSempreExtra(this.checked)">
                            <label for="sabadoSempreExtra" style="font-size: 12px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
```
Substituir por:
```html
                    <div class="setting-card">
                        <h4>Jornada de Trabalho</h4>
                        <input type="text" id="jornada" value="08:00" maxlength="5" placeholder="HH:MM">
                        <small>Horas diárias de trabalho</small>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="jornadaSextaAtiva" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleJornadaSexta(this.checked)">
                            <label for="jornadaSextaAtiva" style="font-size: 12px; cursor: pointer; margin: 0;">Jornada diferenciada para a Sexta</label>
                        </div>
                        <div id="jornadaSextaContainer" style="display: none; margin-top: 8px;">
                            <input type="text" id="jornadaSexta" value="04:00" maxlength="5" placeholder="HH:MM">
                            <small>Horas na Sexta</small>
                        </div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="jornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleJornadaSabado(this.checked)">
                            <label for="jornadaSabadoAtiva" style="font-size: 12px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="jornadaSabadoContainer" style="display: none; margin-top: 8px;">
                            <input type="text" id="jornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM">
                            <small>Horas no Sábado</small>
                        </div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleSabadoSempreExtra(this.checked)">
                            <label for="sabadoSempreExtra" style="font-size: 12px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
```

- [ ] **Step 2: Novo campo no `state` global**

Em `script.js`, localizar (~linha 19-23):
```js
    jornada: '08:00',
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
```
Substituir por:
```js
    jornada: '08:00',
    jornadaSexta: '04:00',
    jornadaSextaAtiva: false,
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
```

- [ ] **Step 3: Listener de formatação do novo campo**

Localizar (~linha 44-46):
```js
    document.getElementById('jornadaSabado').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
```
Substituir por:
```js
    document.getElementById('jornadaSexta').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
    document.getElementById('jornadaSabado').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
```

- [ ] **Step 4: Nova função de toggle (sem exclusão mútua)**

Localizar (~linha 57-62):
```js
window.toggleJornadaSabado = function(ativa) {
    document.getElementById('jornadaSabadoContainer').style.display = ativa ? 'block' : 'none';
    if (ativa) {
        document.getElementById('sabadoSempreExtra').checked = false;
    }
};
```
Substituir por (adicionando a nova função ANTES, sem alterar `toggleJornadaSabado`):
```js
window.toggleJornadaSexta = function(ativa) {
    document.getElementById('jornadaSextaContainer').style.display = ativa ? 'block' : 'none';
};

window.toggleJornadaSabado = function(ativa) {
    document.getElementById('jornadaSabadoContainer').style.display = ativa ? 'block' : 'none';
    if (ativa) {
        document.getElementById('sabadoSempreExtra').checked = false;
    }
};
```

- [ ] **Step 5: Cálculo em `calcularFolha`**

Localizar (~linha 1188-1198):
```js
function calcularFolha(folha) {
    const jornadaMinutos = converterHoraParaMinutos(state.jornada);
    const jornadaSabadoMinutos = (state.jornadaSabadoAtiva && state.jornadaSabado)
        ? converterHoraParaMinutos(state.jornadaSabado)
        : jornadaMinutos;
    let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0, totalFaltas = 0;

    const diasCalculados = folha.dados.map(dia => {
        const jornadaEfetiva = dia.diaSemana === 'Sab'
            ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
            : jornadaMinutos;
```
Substituir por:
```js
function calcularFolha(folha) {
    const jornadaMinutos = converterHoraParaMinutos(state.jornada);
    const jornadaSextaMinutos = (state.jornadaSextaAtiva && state.jornadaSexta)
        ? converterHoraParaMinutos(state.jornadaSexta)
        : jornadaMinutos;
    const jornadaSabadoMinutos = (state.jornadaSabadoAtiva && state.jornadaSabado)
        ? converterHoraParaMinutos(state.jornadaSabado)
        : jornadaMinutos;
    let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0, totalFaltas = 0;

    const diasCalculados = folha.dados.map(dia => {
        const jornadaEfetiva = dia.diaSemana === 'Sab'
            ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
            : dia.diaSemana === 'Sex'
                ? jornadaSextaMinutos
                : jornadaMinutos;
```

- [ ] **Step 6: Verificação manual**

No navegador, marcar "Jornada diferenciada para a Sexta" com 04:00, lançar uma sexta-feira com 3h trabalhadas (ex: 08:00-11:00) e processar. Confirmar que aparecem 3h em "Extra 50%" (jornada de referência da sexta = 4h, então 3h < 4h na verdade não gera extra — ajuste o teste para 6h trabalhadas: entrada 08:00, saída 14:00). Com 6h trabalhadas e jornada de sexta = 4h, confirmar 2h em "Extra 50%" e `00:00` em faltante. Confirmar que sábado e demais dias da semana continuam usando suas próprias regras, sem interferência.

- [ ] **Step 7: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adicionar jornada diferenciada para sexta-feira na tela de lançamento"
```

---

## Task 3: Persistência no lote (salvar e recarregar)

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Ler o checkbox/campo em `iniciarSalvamento`**

Localizar (~linha 968-973):
```js
function iniciarSalvamento() {
    state.jornada = document.getElementById('jornada').value;
    state.jornadaSabadoAtiva = document.getElementById('jornadaSabadoAtiva').checked;
    state.sabadoSempreExtra = document.getElementById('sabadoSempreExtra').checked;
    state.jornadaSabado = document.getElementById('jornadaSabado').value;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
```
Substituir por:
```js
function iniciarSalvamento() {
    state.jornada = document.getElementById('jornada').value;
    state.jornadaSextaAtiva = document.getElementById('jornadaSextaAtiva').checked;
    state.jornadaSexta = document.getElementById('jornadaSexta').value;
    state.jornadaSabadoAtiva = document.getElementById('jornadaSabadoAtiva').checked;
    state.sabadoSempreExtra = document.getElementById('sabadoSempreExtra').checked;
    state.jornadaSabado = document.getElementById('jornadaSabado').value;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
```

- [ ] **Step 2: Validar a hora da sexta (mesma regra do sábado)**

Logo abaixo, localizar (~linha 978-981):
```js
    if (state.jornadaSabadoAtiva && !validarHora(state.jornadaSabado)) {
        mostrarMensagem('Erro', 'Jornada do Sábado inválida.');
        return;
    }
```
Substituir por:
```js
    if (state.jornadaSextaAtiva && !validarHora(state.jornadaSexta)) {
        mostrarMensagem('Erro', 'Jornada da Sexta inválida.');
        return;
    }
    if (state.jornadaSabadoAtiva && !validarHora(state.jornadaSabado)) {
        mostrarMensagem('Erro', 'Jornada do Sábado inválida.');
        return;
    }
```

- [ ] **Step 3: Incluir no payload salvo em `rh_saves`**

Localizar (~linha 1063-1067):
```js
                jornada: state.jornada,
                jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                jornada_sabado_ativa: state.jornadaSabadoAtiva,
                sabado_sempre_extra: state.sabadoSempreExtra,
                rule_extra_100_opcional: state.ruleExtra100Optional,
```
Substituir por:
```js
                jornada: state.jornada,
                jornada_sexta: state.jornadaSextaAtiva ? state.jornadaSexta : null,
                jornada_sexta_ativa: state.jornadaSextaAtiva,
                jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                jornada_sabado_ativa: state.jornadaSabadoAtiva,
                sabado_sempre_extra: state.sabadoSempreExtra,
                rule_extra_100_opcional: state.ruleExtra100Optional,
```

- [ ] **Step 4: Recarregar nos dois pontos de carregamento de lote**

Este bloco aparece duas vezes no arquivo — repetir a mesma edição nas duas ocorrências.

Localizar (nas DUAS ocorrências, ~linha 338-341 e ~487-490):
```js
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.sabadoSempreExtra = registrosParaCarregar[0].sabado_sempre_extra || false;
```
Substituir por (nas DUAS ocorrências):
```js
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.jornadaSexta = registrosParaCarregar[0].jornada_sexta || '04:00';
            state.jornadaSextaAtiva = registrosParaCarregar[0].jornada_sexta_ativa || false;
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.sabadoSempreExtra = registrosParaCarregar[0].sabado_sempre_extra || false;
```

E logo abaixo, também nas duas ocorrências, localizar:
```js
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('sabadoSempreExtra').checked = state.sabadoSempreExtra;
```
Substituir por (nas DUAS ocorrências):
```js
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('jornadaSexta').value = state.jornadaSexta;
            document.getElementById('jornadaSextaAtiva').checked = state.jornadaSextaAtiva;
            document.getElementById('jornadaSextaContainer').style.display = state.jornadaSextaAtiva ? 'block' : 'none';
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('sabadoSempreExtra').checked = state.sabadoSempreExtra;
```

- [ ] **Step 5: Verificação manual**

**Pré-requisito:** as colunas `jornada_sexta`/`jornada_sexta_ativa` precisam existir em `rh_saves` (Task 1, Step 4) antes deste teste.

Marcar "Jornada diferenciada para a Sexta" com um valor customizado (ex: 05:00), processar e salvar um lote. Recarregar a página, selecionar a mesma empresa/competência e confirmar que o checkbox e o valor voltam corretamente preenchidos.

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: persistir jornada diferenciada da sexta-feira no lote salvo (rh_saves)"
```

---

## Task 4: Exportação TXT

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Replicar o cálculo em `_construirConteudoTXTExportacao`**

Localizar (~linha 2101-2114):
```js
        const jornadaMin = converterHoraParaMinutos(save.jornada || '08:00');
        const jornadaSabadoMin = (save.jornada_sabado_ativa && save.jornada_sabado)
            ? converterHoraParaMinutos(save.jornada_sabado)
            : jornadaMin;
        const sabadoSempreExtra = !!save.sabado_sempre_extra;
        const rule100    = save.rule_extra_100_opcional || false;
        const dados      = JSON.parse(save.dados_json || '[]');

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0;
        const diasFaltaDetalhes = [];
        dados.forEach(dia => {
            const jornadaMinEfetiva = dia.diaSemana === 'Sab'
                ? (sabadoSempreExtra ? 0 : jornadaSabadoMin)
                : jornadaMin;
```
Substituir por:
```js
        const jornadaMin = converterHoraParaMinutos(save.jornada || '08:00');
        const jornadaSextaMin = (save.jornada_sexta_ativa && save.jornada_sexta)
            ? converterHoraParaMinutos(save.jornada_sexta)
            : jornadaMin;
        const jornadaSabadoMin = (save.jornada_sabado_ativa && save.jornada_sabado)
            ? converterHoraParaMinutos(save.jornada_sabado)
            : jornadaMin;
        const sabadoSempreExtra = !!save.sabado_sempre_extra;
        const rule100    = save.rule_extra_100_opcional || false;
        const dados      = JSON.parse(save.dados_json || '[]');

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0;
        const diasFaltaDetalhes = [];
        dados.forEach(dia => {
            const jornadaMinEfetiva = dia.diaSemana === 'Sab'
                ? (sabadoSempreExtra ? 0 : jornadaSabadoMin)
                : dia.diaSemana === 'Sex'
                    ? jornadaSextaMin
                    : jornadaMin;
```

- [ ] **Step 2: Verificação manual**

Com o mesmo lote usado na Task 2/3 (sexta-feira com 6h trabalhadas e jornada de sexta = 4h), abrir o modal de exportação TXT, gerar a prévia e confirmar que o total de horas extras exportado bate com o mostrado em tela.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: replicar jornada diferenciada da sexta-feira na exportação TXT"
```

---

## Task 5: Modal "Configuração de Rubricas" (por empresa)

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o checkbox/campo no modal**

Em `index.html`, localizar (~linha 706-733):
```html
                <!-- Jornada de Trabalho -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Jornada de Trabalho</span>
                    </div>
                    <div style="padding: 14px 14px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas diárias</label>
                            <input type="text" id="cfgJornada" value="08:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="cfgJornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgJornadaSabadoContainer').style.display = this.checked ? 'flex' : 'none'; if (this.checked) { document.getElementById('cfgSabadoSempreExtra').checked = false; }">
                            <label for="cfgJornadaSabadoAtiva" style="font-size: 13px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgSabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="if (this.checked) { document.getElementById('cfgJornadaSabadoAtiva').checked = false; document.getElementById('cfgJornadaSabadoContainer').style.display = 'none'; }">
                            <label for="cfgSabadoSempreExtra" style="font-size: 13px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
                </div>
```
Substituir por:
```html
                <!-- Jornada de Trabalho -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Jornada de Trabalho</span>
                    </div>
                    <div style="padding: 14px 14px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas diárias</label>
                            <input type="text" id="cfgJornada" value="08:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="cfgJornadaSextaAtiva" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgJornadaSextaContainer').style.display = this.checked ? 'flex' : 'none';">
                            <label for="cfgJornadaSextaAtiva" style="font-size: 13px; cursor: pointer; margin: 0;">Jornada diferenciada para a Sexta</label>
                        </div>
                        <div id="cfgJornadaSextaContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas na Sexta</label>
                            <input type="text" id="cfgJornadaSexta" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgJornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgJornadaSabadoContainer').style.display = this.checked ? 'flex' : 'none'; if (this.checked) { document.getElementById('cfgSabadoSempreExtra').checked = false; }">
                            <label for="cfgJornadaSabadoAtiva" style="font-size: 13px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgSabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="if (this.checked) { document.getElementById('cfgJornadaSabadoAtiva').checked = false; document.getElementById('cfgJornadaSabadoContainer').style.display = 'none'; }">
                            <label for="cfgSabadoSempreExtra" style="font-size: 13px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 2: Salvar o novo evento em `salvarConfigRubricas`**

Em `script.js`, localizar (~linha 1882-1888):
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
    ];
```
Substituir por:
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSextaAtiva')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta',        codigo_rubrica: (document.getElementById('cfgJornadaSexta')?.value || '04:00').trim(),       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
    ];
```

- [ ] **Step 3: Preencher os campos ao abrir o modal para uma empresa**

Localizar (~linha 1772-1795):
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
    const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
}
```
Substituir por:
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSexAtiva     = document.getElementById('cfgJornadaSextaAtiva');
    const jSexCont      = document.getElementById('cfgJornadaSextaContainer');
    const jSex          = document.getElementById('cfgJornadaSexta');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sexAtiva = cfg['jornada_sexta_ativa']?.cod === '1';
    if (jSexAtiva) jSexAtiva.checked = sexAtiva;
    if (jSexCont)  jSexCont.style.display = sexAtiva ? 'flex' : 'none';
    if (jSex)      jSex.value = cfg['jornada_sexta']?.cod || '04:00';
    const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
    const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
}
```

- [ ] **Step 4: Limpar os campos junto com os demais**

Localizar (~linha 1797-1816):
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
}
```
Substituir por:
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSexAtiva     = document.getElementById('cfgJornadaSextaAtiva');
    const jSexCont      = document.getElementById('cfgJornadaSextaContainer');
    const jSex          = document.getElementById('cfgJornadaSexta');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSexAtiva) jSexAtiva.checked = false;
    if (jSexCont)  jSexCont.style.display = 'none';
    if (jSex)      jSex.value       = '04:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
}
```

- [ ] **Step 5: Verificação manual**

Abrir o modal "Configuração de Rubricas", buscar uma empresa, marcar "Jornada diferenciada para a Sexta" com um valor customizado e salvar. Reabrir o modal para a mesma empresa e confirmar que volta preenchido. Testar "Limpar Empresa" e confirmar que os campos de sexta voltam ao padrão (desmarcado, 04:00).

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adicionar jornada diferenciada da sexta-feira no modal de Configuração de Rubricas"
```

---

## Task 6: Pré-preenchimento automático por empresa

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Ler o config de sexta em `selecionarEmpresa`**

Localizar (~linha 119-148):
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
    }
```
Substituir por:
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSexAtiva     = document.getElementById('jornadaSextaAtiva');
    const jSexCont      = document.getElementById('jornadaSextaContainer');
    const jSex          = document.getElementById('jornadaSexta');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sexAtiva = cfg['jornada_sexta_ativa']?.cod === '1';
        if (jSexAtiva) jSexAtiva.checked = sexAtiva;
        if (jSexCont)  jSexCont.style.display = sexAtiva ? 'block' : 'none';
        if (jSex)      jSex.value = cfg['jornada_sexta']?.cod || '04:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSexAtiva) jSexAtiva.checked = false;
        if (jSexCont)  jSexCont.style.display = 'none';
        if (jSex)      jSex.value       = '04:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
    }
```

Manter o restante da função (leitura da observação e fechamento) inalterado.

- [ ] **Step 2: Verificação manual**

Selecionar, na tela de lançamento, uma empresa cujo config no modal (Task 5) tenha "Jornada diferenciada para a Sexta" marcado — confirmar que o checkbox e o valor da tela de lançamento vêm preenchidos automaticamente.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: pré-preencher jornada diferenciada da sexta-feira por empresa"
```

---

## Task 7: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual cobrindo os cenários que não mudaram:

- [ ] **Step 1:** Um dia útil normal (segunda a quinta) continua usando `state.jornada` sem nenhuma interferência do novo campo.
- [ ] **Step 2:** Sábado com "Jornada diferenciada para o Sábado" ou "Sábado sempre extra" continua funcionando exatamente como antes — nenhuma das duas lógicas foi tocada além da adição do `else if` para sexta.
- [ ] **Step 3:** Feriado/DSR em uma sexta-feira continua gerando 100% extra independentemente da jornada diferenciada da sexta (a checagem de `isDiaDescanso` acontece antes da comparação com `jornadaEfetiva`).
- [ ] **Step 4:** Exportação TXT de um lote antigo (salvo antes desta mudança, sem `jornada_sexta_ativa` preenchido) não quebra — `registrosParaCarregar[0].jornada_sexta_ativa || false` e `save.jornada_sexta_ativa` (undefined) resultam em `false`, caindo no `jornadaMin` padrão.
- [ ] **Step 5:** "Limpar Empresa" no modal remove também a configuração de sexta (mesma query `.delete().eq('codigo_empresa', ...)`, sem filtro por evento).

Nenhum commit necessário neste task — é só verificação.
