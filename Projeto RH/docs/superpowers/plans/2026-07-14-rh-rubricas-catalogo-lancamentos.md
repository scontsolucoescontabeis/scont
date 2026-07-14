# rh_rubricas como Catálogo — Ajustes no Lançamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar o arquivo de importação em massa para `rh_rubricas` a partir dos dados já extraídos do PDF, remover a feature de "rubricas personalizadas" do Lançamentos (substituída por `rh_rubricas`), e fazer o seletor de rubrica do Passo 3 buscar sugestões de código no catálogo `rh_rubricas`.

**Architecture:** `rh_rubricas` (Administração) vira o catálogo único de código+descrição+tipo(provento/desconto) por empresa. `rh_config_rubricas_txt` (Controle de Frequência) continua guardando só os 8 eventos fixos + observações, com `tipo_valor` (horas/monetário/dias) — sem mudança de schema. Lançamentos passa a ler `rh_rubricas` só para sugestão/autocomplete no modo manual do Passo 3; não escreve mais nele.

**Tech Stack:** HTML/JS puro, Supabase JS client v2, Python (pandas/openpyxl) para gerar o `.xlsx` de importação — fora do código do site, é um artefato de dados entregue para upload manual em Administração.

## Global Constraints

- Controle de Frequência (`index.html`/`script.js`) não muda nesta rodada.
- Sem migração de schema nova — `rh_config_rubricas_txt.descricao_rubrica` já foi aplicada e fica sem uso.
- Layout binário do TXT exportado não muda.
- O import de `rh_rubricas` deve usar exatamente o formato já suportado por `admin.js` (`importarRubricasIndividual`): colunas `codigo_empresa, empresa, codigo_rubrica, descricao_rubrica, tipo`, primeira linha da planilha é cabeçalho (ignorada no parse), upsert por `(codigo_empresa, codigo_rubrica)`.

---

### Task 1: Gerar o arquivo de importação em massa (`.xlsx`)

**Files:**
- Create (script ad-hoc, não faz parte do site): `scratchpad/gerar_xlsx_rubricas.py` (caminho do scratchpad da sessão)
- Create (saída): `docs/rh_rubricas_import.xlsx`

**Interfaces:**
- Consumes: `rubricas_raw.json` já gerado na sessão anterior (extração do PDF: lista de `{empresa_codigo, empresa_nome, competencia, rubrica_codigo, rubrica_nome, tipo}`), disponível no scratchpad.
- Produces: arquivo `.xlsx` com colunas `codigo_empresa, empresa, codigo_rubrica, descricao_rubrica, tipo`, uma linha por par (empresa, rubrica) deduplicado.

- [ ] **Step 1: Escrever o script de geração**

Criar o script Python reaproveitando a mesma normalização de nome (remover sufixo `N° <contrato>` variável) já usada em `docs/rubricas-por-empresa.md`:

```python
# -*- coding: utf-8 -*-
import json
import re
from collections import OrderedDict
import pandas as pd

IN_JSON = r"<caminho-do-scratchpad>/rubricas_raw.json"
OUT_XLSX = r"C:\Users\Herbert G L J\Desktop\Projetos HTML\Projeto Portal Scont\Projeto RH\docs\rh_rubricas_import.xlsx"

with open(IN_JSON, encoding='utf-8') as f:
    registros = json.load(f)

empresas = OrderedDict()
mapa = OrderedDict()  # (ec, rubrica) -> {'nomes': OrderedDict, 'tipos': OrderedDict}

for r in registros:
    ec, en = r['empresa_codigo'], r['empresa_nome']
    if ec not in empresas:
        empresas[ec] = en
    key = (ec, r['rubrica_codigo'])
    if key not in mapa:
        mapa[key] = {'nomes': OrderedDict(), 'tipos': OrderedDict()}
    mapa[key]['nomes'][r['rubrica_nome']] = mapa[key]['nomes'].get(r['rubrica_nome'], 0) + 1
    mapa[key]['tipos'][r['tipo']] = mapa[key]['tipos'].get(r['tipo'], 0) + 1

VAR_SUFFIX_RE = re.compile(r'\s+N[ºo°]?\s*\S+$', re.IGNORECASE)

def nome_final(nomes_dict):
    nomes = list(nomes_dict.keys())
    if len(nomes) == 1:
        return nomes[0]
    bases = set(VAR_SUFFIX_RE.sub('', n).strip() for n in nomes)
    if len(bases) == 1:
        return list(bases)[0]
    return ' / '.join(nomes)

def tipo_final(tipos_dict):
    tipos = list(tipos_dict.keys())
    return tipos[0] if len(tipos) == 1 else ' / '.join(tipos)

linhas = []
for (ec, rub), info in mapa.items():
    linhas.append({
        'codigo_empresa': ec,
        'empresa': empresas[ec],
        'codigo_rubrica': rub,
        'descricao_rubrica': nome_final(info['nomes']),
        'tipo': tipo_final(info['tipos']),
    })

df = pd.DataFrame(linhas, columns=['codigo_empresa', 'empresa', 'codigo_rubrica', 'descricao_rubrica', 'tipo'])
df.to_excel(OUT_XLSX, index=False, sheet_name='Rubricas')

print(f'Linhas geradas: {len(df)}')
print(f'Empresas distintas: {len(empresas)}')
print(f'Arquivo: {OUT_XLSX}')
```

Ajustar `IN_JSON` para o caminho real de `rubricas_raw.json` no scratchpad da sessão.

- [ ] **Step 2: Rodar o script**

Run: `python gerar_xlsx_rubricas.py`
Expected: imprime `Linhas geradas: 2039`, `Empresas distintas: 168`, e confirma o caminho do `.xlsx` gerado.

- [ ] **Step 3: Validar o arquivo gerado**

Run:
```python
import pandas as pd
df = pd.read_excel(r"C:\Users\Herbert G L J\Desktop\Projetos HTML\Projeto Portal Scont\Projeto RH\docs\rh_rubricas_import.xlsx")
print(df.shape)
print(df.columns.tolist())
print(df.head(3))
print(df.isnull().sum())
```
Expected: `(2039, 5)`, colunas exatamente `['codigo_empresa', 'empresa', 'codigo_rubrica', 'descricao_rubrica', 'tipo']`, sem nulos em `codigo_empresa`/`codigo_rubrica`.

Este arquivo **não é importado automaticamente** — fica pronto em `docs/rh_rubricas_import.xlsx` para upload manual do usuário em Administração → aba Rubricas → Importar (modo upsert).

---

### Task 2: Remover a seção "Rubricas Personalizadas" do modal de Configurações

**Files:**
- Modify: `lancamentos.html:292-315` (bloco da seção dentro de `configLancamentosModal`)
- Modify: `lancamentos.js` (`renderConfigLancamentos`, remoção de `adicionarRubricaPersonalizada` e `removerRubricaPersonalizada`)

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: `renderConfigLancamentos(linhas)` passa a só popular `cfgLancTabelaFixas` e `cfgLancObservacoes` (mesma assinatura, corpo reduzido).

- [ ] **Step 1: Remover o bloco HTML da seção**

Em `lancamentos.html`, remover o bloco entre o `<h4>` "Rubricas Personalizadas (Lançamentos)" e o fechamento da tabela `cfgLancTabelaPersonalizadas` (linhas 292-315), ou seja, trocar:

```html
                    <h4 style="margin: 15px 0 8px; font-size: 14px; color: var(--primary-color);">Rubricas Personalizadas (Lançamentos)</h4>
                    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr auto; gap: 10px; align-items: end;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovoCodigo">Código</label>
                            <input type="text" id="cfgLancNovoCodigo" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovaDescricao">Descrição</label>
                            <input type="text" id="cfgLancNovaDescricao">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovoTipo">Tipo</label>
                            <select id="cfgLancNovoTipo">
                                <option value="horas">Horas</option>
                                <option value="monetario">Monetário</option>
                                <option value="dias">Dias</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="adicionarRubricaPersonalizada()">➕ Adicionar</button>
                    </div>
                    <table class="detalhes-table" id="cfgLancTabelaPersonalizadas" style="margin-top: 10px;">
                        <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th></th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
```

por:

```html
                </div>
```

(o restante do modal — busca de empresa, tabela de rubricas fixas, observações, rodapé — não muda.)

- [ ] **Step 2: Simplificar `renderConfigLancamentos`**

Em `lancamentos.js`, trocar a função inteira por:

```js
function renderConfigLancamentos(linhas) {
    const porEvento = {};
    linhas.forEach(l => { porEvento[l.evento] = l; });

    const tbodyFixas = document.querySelector('#cfgLancTabelaFixas tbody');
    tbodyFixas.innerHTML = EVENTOS_FIXOS_RUBRICA.map(evtDef => {
        const linha = porEvento[evtDef.ev];
        return `<tr><td>${evtDef.label}</td><td>${linha && linha.codigo_rubrica ? linha.codigo_rubrica : '—'}</td><td>${linha && linha.codigo_rubrica ? linha.tipo_valor : '—'}</td></tr>`;
    }).join('');

    const obs = porEvento['observacoes'];
    const textoObs = obs && obs.codigo_rubrica ? obs.codigo_rubrica.trim() : '';
    document.getElementById('cfgLancObservacoes').textContent = textoObs || 'Nenhuma observação cadastrada.';
}
```

- [ ] **Step 3: Remover `adicionarRubricaPersonalizada` e `removerRubricaPersonalizada`**

Em `lancamentos.js`, apagar as duas funções inteiras (de `async function adicionarRubricaPersonalizada() {` até o fechamento de `async function removerRubricaPersonalizada(id) { ... }`).

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 5: Commit**

```bash
git add lancamentos.html lancamentos.js
git commit -m "refactor(lancamentos): remove secao de rubricas personalizadas do modal de Configuracoes"
```

---

### Task 3: Remover o mecanismo de "eventos personalizados" do seletor do Passo 3

**Files:**
- Modify: `lancamentos.js` (`renderSeletorEventoRubrica`, remoção da constante `EVENTOS_CONFIG_GERAL_RESTRITOS`)

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: `renderSeletorEventoRubrica()` (mesma assinatura, monta `eventosRubricaDisponiveis` só a partir de `EVENTOS_FIXOS_RUBRICA`).

- [ ] **Step 1: Simplificar `renderSeletorEventoRubrica`**

Trocar a função inteira por:

```js
function renderSeletorEventoRubrica() {
    const select = document.getElementById('gradeRubricaEvento');
    const codigosEmpresasLote = empresasDoLote();
    eventosRubricaDisponiveis = [];

    EVENTOS_FIXOS_RUBRICA.forEach(evtDef => {
        const porEmpresa = {};
        codigosEmpresasLote.forEach(cod => {
            const cfg = configRubricasPorEmpresa[cod] && configRubricasPorEmpresa[cod][evtDef.ev];
            if (cfg && cfg.codigo) porEmpresa[cod] = cfg.codigo;
        });
        if (Object.keys(porEmpresa).length > 0) {
            eventosRubricaDisponiveis.push({ evento: evtDef.ev, label: evtDef.label, tipoValor: evtDef.tipoValor, codigosPorEmpresa: porEmpresa });
        }
    });

    let html = '<option value="">Selecione...</option>';
    eventosRubricaDisponiveis.forEach(item => {
        const codigosUnicos = [...new Set(Object.values(item.codigosPorEmpresa))];
        const detalhe = codigosUnicos.length === 1
            ? codigosUnicos[0]
            : Object.entries(item.codigosPorEmpresa).map(([cod, codigo]) => `${nomeEmpresaPorCodigo(cod)}: ${codigo}`).join(', ');
        html += `<option value="${item.evento}">${item.label} (${detalhe})</option>`;
    });
    html += '<option value="__manual__">Outra rubrica (buscar no catálogo ou digitar código)</option>';

    select.innerHTML = html;
    onEventoRubricaChange();
}
```

(diferença: removido o bloco `const vistos = new Set(); codigosEmpresasLote.forEach(...)` que montava eventos personalizados a partir de `configRubricasPorEmpresa`; texto da opção `__manual__` atualizado.)

- [ ] **Step 2: Remover a constante `EVENTOS_CONFIG_GERAL_RESTRITOS`**

Em `lancamentos.js`, apagar o bloco:

```js
// Eventos de jornada/turnos/regras gerais da empresa — configuráveis só no Controle de Frequência.
// A tela de Configurações do Lançamento não exibe nem edita esses eventos.
const EVENTOS_CONFIG_GERAL_RESTRITOS = [
    'jornada_diaria', 'jornada_sexta_ativa', 'jornada_sexta',
    'jornada_sabado_ativa', 'jornada_sabado', 'sabado_sempre_extra',
    'rule_extra_100_opcional', 'terceiro_turno', 'nao_compensar_extras',
];
```

(Sem consumidores após a Task 2 e este step — a tabela `renderConfigLancamentos` já não filtra mais "personalizadas", e este era o único outro uso.)

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 4: Commit**

```bash
git add lancamentos.js
git commit -m "refactor(lancamentos): remove mecanismo de eventos personalizados do seletor do Passo 3"
```

---

### Task 4: Busca no catálogo `rh_rubricas` no modo manual do Passo 3

**Files:**
- Modify: `lancamentos.html` (novo `<datalist>`, atributo `list` no input `gradeRubricaCodigo`)
- Modify: `lancamentos.js` (novo estado `catalogoRubricasLote`, nova função `carregarCatalogoRubricasLote`, nova função `renderCatalogoRubricasDatalist`, chamadas em `avancarParaParametros`, ajuste em `adicionarRubricaGrade`)

**Interfaces:**
- Consumes: `empresasDoLote()`, `nomeEmpresaPorCodigo()` (já existentes)
- Produces:
  - `catalogoRubricasLote: Array<{codigo_empresa, codigo_rubrica, descricao_rubrica, tipo}>`
  - `async function carregarCatalogoRubricasLote(codigosEmpresa: string[]): Promise<void>`
  - `function renderCatalogoRubricasDatalist(): void`

- [ ] **Step 1: Adicionar o `<datalist>` e o atributo `list` no HTML**

Em `lancamentos.html`, trocar:

```html
                    <div class="form-group" id="gradeRubricaManualFields" style="display: none; margin-bottom: 0;">
                        <label for="gradeRubricaCodigo">Código da Rubrica *</label>
                        <input type="text" id="gradeRubricaCodigo" placeholder="Ex: 1285" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                    </div>
```

por:

```html
                    <div class="form-group" id="gradeRubricaManualFields" style="display: none; margin-bottom: 0;">
                        <label for="gradeRubricaCodigo">Código da Rubrica *</label>
                        <input type="text" id="gradeRubricaCodigo" list="catalogoRubricasDatalist" placeholder="Ex: 1285 ou busque no catálogo" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                        <datalist id="catalogoRubricasDatalist"></datalist>
                    </div>
```

- [ ] **Step 2: Adicionar estado e função de busca do catálogo**

Em `lancamentos.js`, logo depois da declaração de `let eventosRubricaDisponiveis = [];`, adicionar:

```js

// Catálogo de rubricas (rh_rubricas) das empresas do lote — só sugestão no modo manual do Passo 3
let catalogoRubricasLote = [];
```

Logo depois do fechamento de `carregarConfigRubricasLote` (antes de `// --- ✅ NOVO: SISTEMA DE ACÚMULO DE PARAMETRIZAÇÕES ---`), adicionar:

```js
async function carregarCatalogoRubricasLote(codigosEmpresa) {
    catalogoRubricasLote = [];
    if (!codigosEmpresa || codigosEmpresa.length === 0) return;

    const { data, error } = await supabaseClient
        .from('rh_rubricas')
        .select('codigo_empresa, codigo_rubrica, descricao_rubrica, tipo')
        .in('codigo_empresa', codigosEmpresa);

    if (error) {
        console.error('Erro ao buscar catálogo de rubricas do lote:', error);
        return;
    }

    catalogoRubricasLote = data || [];
}
```

(Erro aqui não bloqueia o fluxo com `mostrarMensagem` — o catálogo é só uma sugestão; o código continua podendo ser digitado manualmente.)

- [ ] **Step 3: Adicionar `renderCatalogoRubricasDatalist`**

Logo depois de `renderObservacoesLote` (antes de `function validarFormatoValor`), adicionar:

```js
function renderCatalogoRubricasDatalist() {
    const datalist = document.getElementById('catalogoRubricasDatalist');
    datalist.innerHTML = catalogoRubricasLote.map(r => {
        const nomeEmp = nomeEmpresaPorCodigo(r.codigo_empresa);
        const desc = r.descricao_rubrica || '(sem descrição)';
        const tipo = r.tipo ? ` · ${r.tipo}` : '';
        return `<option value="${r.codigo_rubrica}">${desc} — ${nomeEmp}${tipo}</option>`;
    }).join('');
}
```

- [ ] **Step 4: Chamar as novas funções em `avancarParaParametros`**

Em `avancarParaParametros`, trocar:

```js
    await carregarConfigRubricasLote(empresasDoLote());

    renderSeletorEventoRubrica();
    renderObservacoesLote();
    renderGrade();
```

por:

```js
    const codigosEmpresasLote = empresasDoLote();
    await Promise.all([
        carregarConfigRubricasLote(codigosEmpresasLote),
        carregarCatalogoRubricasLote(codigosEmpresasLote),
    ]);

    renderSeletorEventoRubrica();
    renderObservacoesLote();
    renderCatalogoRubricasDatalist();
    renderGrade();
```

- [ ] **Step 5: Melhorar o rótulo no modo manual de `adicionarRubricaGrade`**

Trocar:

```js
    if (select.value === '__manual__') {
        const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
        const tipoValor = document.getElementById('gradeRubricaTipoValor').value;

        if (!codigo || !/^\d+$/.test(codigo)) {
            mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
            return;
        }

        novaColuna = { id: Date.now(), evento: null, label: `Rubrica ${codigo}`, tipoValor, codigo };
    } else {
```

por:

```js
    if (select.value === '__manual__') {
        const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
        const tipoValor = document.getElementById('gradeRubricaTipoValor').value;

        if (!codigo || !/^\d+$/.test(codigo)) {
            mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
            return;
        }

        const catalogado = catalogoRubricasLote.find(r => r.codigo_rubrica === codigo);
        const label = catalogado ? `${catalogado.descricao_rubrica} (${codigo})` : `Rubrica ${codigo}`;

        novaColuna = { id: Date.now(), evento: null, label, tipoValor, codigo };
    } else {
```

- [ ] **Step 6: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 7: Commit**

```bash
git add lancamentos.html lancamentos.js
git commit -m "feat(lancamentos): busca no catalogo rh_rubricas como sugestao no modo manual do Passo 3"
```

---

### Task 5: Verificação final e push

- [ ] **Step 1: Checar sintaxe final**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 2: Checar IDs duplicados no HTML**

Run: `grep -oE 'id="[^"]+"' lancamentos.html | sort | uniq -d`
Expected: sem saída.

- [ ] **Step 3: Checar handlers órfãos**

Run:
```bash
for fn in $(grep -oE 'on(click|change|keyup)="[a-zA-Z_][a-zA-Z0-9_]*\(' lancamentos.html | sed -E 's/.*="//; s/\($//' | sort -u); do
  grep -qE "function[[:space:]]+$fn\b" lancamentos.js || echo "MISSING: $fn"
done
```
Expected: sem saída `MISSING:` (confirma que `adicionarRubricaPersonalizada`/`removerRubricaPersonalizada` não são mais referenciados em nenhum `onclick`).

- [ ] **Step 4: Push**

```bash
git push
```

- [ ] **Step 5: Lembrete final pro usuário**

Nenhum comando — só reportar que `docs/rh_rubricas_import.xlsx` está pronto pra upload manual em Administração → aba Rubricas → Importar (modo upsert recomendado, pra não apagar rubricas já cadastradas manualmente).

---

## Self-Review

**Cobertura da spec:**
- Inserção em massa em `rh_rubricas` → Task 1.
- Remoção da seção de rubricas personalizadas (modal Configurações) → Task 2.
- Remoção do mecanismo de eventos personalizados (seletor Passo 3) → Task 3.
- Busca no catálogo `rh_rubricas` no modo manual do Passo 3 → Task 4.
- Controle de Frequência inalterado → nenhuma task toca `index.html`/`script.js`.

**Placeholders:** nenhum — todo passo tem código completo.

**Consistência de tipos:** `catalogoRubricasLote` usa sempre `{codigo_empresa, codigo_rubrica, descricao_rubrica, tipo}` nas Tasks 4; `renderConfigLancamentos(linhas)` mantém a mesma assinatura usada pelos chamadores existentes (`selecionarEmpresaConfigLancamentos`) mesmo com corpo reduzido.
