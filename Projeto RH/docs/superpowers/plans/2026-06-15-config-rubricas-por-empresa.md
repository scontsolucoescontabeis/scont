# Config Rubricas por Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tela de configurações de rubricas TXT por empresa (salva no Supabase), com pré-preenchimento automático ao abrir os dois modais de geração de TXT.

**Architecture:** Nova tabela `rh_config_rubricas_txt` com 6 linhas por empresa (uma por evento). Cache em memória `_cacheConfigRubricas` evita queries repetidas. Pré-preenchimento via `_aplicarConfigRubricasNoCampos` chamado no `abrirModal*` de TXT. Modal acessado por botão na tela inicial.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2 (já carregado), localStorage (mantido como fallback).

---

## Mapeamento de Arquivos

| Arquivo | Mudança |
|---|---|
| `schema_rh.sql` | Adicionar tabela `rh_config_rubricas_txt` + RLS |
| `index.html` | Botão na tela inicial + modal de config + dropdown auxiliar |
| `script.js` | Constante `_CFG_EVENTOS`, cache, funções do modal, pré-fill |

---

### Task 1: Schema SQL — tabela `rh_config_rubricas_txt`

**Files:**
- Modify: `schema_rh.sql` (antes do bloco `-- RESUMO DAS TABELAS`, linha ~243)

- [ ] **Step 1: Inserir definição da tabela em `schema_rh.sql`**

Localizar o comentário `-- ============================================================\n-- RESUMO DAS TABELAS` e inserir o bloco abaixo **antes** dele:

```sql
-- ============================================================
-- 8. TABELA: rh_config_rubricas_txt
--    Presets de rubricas TXT por empresa (6 eventos fixos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_config_rubricas_txt (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa TEXT NOT NULL,
    evento         TEXT NOT NULL,
    codigo_rubrica TEXT NOT NULL DEFAULT '',
    tipo_valor     TEXT NOT NULL DEFAULT 'horas',
    CONSTRAINT rh_config_rub_txt_uniq UNIQUE (codigo_empresa, evento)
);

CREATE INDEX IF NOT EXISTS idx_rh_cfg_rub_txt_empresa
    ON public.rh_config_rubricas_txt (codigo_empresa);

-- 8. RLS
ALTER TABLE public.rh_config_rubricas_txt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_config_rub_txt: leitura autenticado" ON public.rh_config_rubricas_txt;
DROP POLICY IF EXISTS "rh_config_rub_txt: escrita autenticado"  ON public.rh_config_rubricas_txt;

CREATE POLICY "rh_config_rub_txt: leitura autenticado"
    ON public.rh_config_rubricas_txt FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_config_rub_txt: escrita autenticado"
    ON public.rh_config_rubricas_txt FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Step 2: Atualizar comentário do RESUMO DAS TABELAS em `schema_rh.sql`**

Localizar a linha:
```
--  rh_saves             folhas de ponto (dados em JSONB)
```
e adicionar abaixo dela:
```
--  rh_config_rubricas_txt  presets de rubricas TXT por empresa
```

- [ ] **Step 3: Executar no Supabase SQL Editor**

Copiar todo o bloco do Step 1 e rodar no SQL Editor do projeto Supabase (o mesmo projeto do Portal SCONT configurado em `../supabase-config.js`). Confirmar que não retorna erro.

- [ ] **Step 4: Verificar criação da tabela**

No Supabase > Table Editor, confirmar que `rh_config_rubricas_txt` aparece com as colunas `id`, `codigo_empresa`, `evento`, `codigo_rubrica`, `tipo_valor`.

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/schema_rh.sql"
git commit -m "feat: adicionar tabela rh_config_rubricas_txt para presets de rubricas por empresa"
```

---

### Task 2: HTML — Botão na tela inicial

**Files:**
- Modify: `index.html` (dentro de `#selectionScreen`, bloco flex de botões, linha ~66-73)

- [ ] **Step 1: Localizar o bloco de botões em `index.html`**

Encontrar o trecho:
```html
<div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; display: flex; flex-direction: column; gap: 8px;">
    <button type="button" class="btn btn-secondary" onclick="perguntarTurnosModelo()" style="width: 100%; font-size: 13px;">
        📥 Baixar Modelo Excel (por empresa)
    </button>
    <button type="button" class="btn btn-secondary" onclick="abrirModalExportacaoTXT()" style="width: 100%; font-size: 13px;">
        📄 Exportar dados para lançamento na folha (TXT)
    </button>
</div>
```

- [ ] **Step 2: Adicionar botão "Configurar Rubricas"**

Substituir o `</div>` final do bloco acima para incluir o novo botão **após** o botão de exportar TXT:

```html
<div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; display: flex; flex-direction: column; gap: 8px;">
    <button type="button" class="btn btn-secondary" onclick="perguntarTurnosModelo()" style="width: 100%; font-size: 13px;">
        📥 Baixar Modelo Excel (por empresa)
    </button>
    <button type="button" class="btn btn-secondary" onclick="abrirModalExportacaoTXT()" style="width: 100%; font-size: 13px;">
        📄 Exportar dados para lançamento na folha (TXT)
    </button>
    <button type="button" class="btn btn-secondary" onclick="abrirModalConfigRubricas()" style="width: 100%; font-size: 13px;">
        ⚙️ Configurar Rubricas por Empresa
    </button>
</div>
```

- [ ] **Step 3: Commit parcial**

```bash
git add "Projeto RH/index.html"
git commit -m "feat: botão Configurar Rubricas na tela inicial"
```

---

### Task 3: HTML — Modal de configuração de rubricas

**Files:**
- Modify: `index.html` — inserir modal e dropdown auxiliar após o fechamento de `#txtRubricasModal` (linha ~553) e antes do `#buscaEmpresaResultados` (linha ~555)

- [ ] **Step 1: Inserir o modal `#configRubricasModal` em `index.html`**

Localizar o trecho exato:
```html
    </div>

    <!-- Dropdown de busca de empresa — fora de qualquer container para evitar clipping -->
```

Inserir entre eles:

```html
    <!-- MODAL: CONFIGURAR RUBRICAS POR EMPRESA -->
    <div id="configRubricasModal" class="modal">
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h3 style="color: var(--primary-color); margin: 0;">⚙️ Configurar Rubricas por Empresa</h3>
                <button type="button" class="modal-close" onclick="fecharModalConfigRubricas()">×</button>
            </div>
            <div class="modal-body" style="padding: 20px;">

                <!-- Busca de empresa -->
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Empresa</label>
                    <input type="text" id="cfgBuscaEmpresa"
                        placeholder="Digite o nome ou código da empresa..."
                        autocomplete="off"
                        oninput="filtrarEmpresasConfig(this.value)"
                        onfocus="filtrarEmpresasConfig(this.value)"
                        style="width: 100%; box-sizing: border-box; margin-top: 4px;">
                    <input type="hidden" id="cfgCodigoEmpresa">
                </div>

                <!-- Tabela de rubricas -->
                <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Evento</span>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Código da Rubrica</span>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Tipo de Valor</span>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Horas Trabalhadas</span>
                        <input type="text" id="cfgRub_horasTrab" maxlength="9" placeholder="Ex: 000001" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_horasTrab" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                            <option value="dias">Dias</option>
                        </select>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Horas Extras 50%</span>
                        <input type="text" id="cfgRub_he50" maxlength="9" placeholder="Ex: 000050" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_he50" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                            <option value="dias">Dias</option>
                        </select>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Horas Extras 100%</span>
                        <input type="text" id="cfgRub_he100" maxlength="9" placeholder="Ex: 000100" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_he100" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                            <option value="dias">Dias</option>
                        </select>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Adicional Noturno</span>
                        <input type="text" id="cfgRub_noturno" maxlength="9" placeholder="Ex: 000310" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_noturno" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                            <option value="dias">Dias</option>
                        </select>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Atraso</span>
                        <input type="text" id="cfgRub_atraso" maxlength="9" placeholder="Ex: 000410" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_atraso" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                            <option value="dias">Dias</option>
                        </select>
                    </div>
                    <div style="padding: 9px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1.6fr 1fr 1.3fr; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;">Falta (em dias)</span>
                        <input type="text" id="cfgRub_falta" maxlength="9" placeholder="Ex: 000510" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace;">
                        <select id="cfgTipo_falta" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
                            <option value="dias">Dias</option>
                            <option value="horas">Horas (HHMM)</option>
                            <option value="monetario">Monetário (R$)</option>
                        </select>
                    </div>
                </div>
                <p style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; margin-bottom: 0;">
                    Campos vazios = sem pré-preenchimento ao gerar TXT.
                </p>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-top: 1px solid #eee;">
                <button type="button" class="btn btn-danger btn-small" onclick="limparConfigRubricas()" style="font-size: 12px;">🗑 Limpar Empresa</button>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-secondary" onclick="fecharModalConfigRubricas()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="salvarConfigRubricas()">💾 Salvar</button>
                </div>
            </div>
        </div>
    </div>

```

- [ ] **Step 2: Inserir dropdown auxiliar do config modal**

Logo após o fechamento do `#buscaEmpresaResultados` div (linha ~566), antes de `<script src="script.js">`, adicionar:

```html
    <div id="cfgBuscaEmpresaResultados" style="
        display: none;
        position: fixed;
        background: #fff;
        border: 1px solid #ced4da;
        border-radius: 6px;
        max-height: 240px;
        overflow-y: auto;
        z-index: 9000;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    "></div>
```

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/index.html"
git commit -m "feat: modal de configuração de rubricas por empresa"
```

---

### Task 4: JS — Constante `_CFG_EVENTOS`, cache e funções auxiliares

**Files:**
- Modify: `script.js` — inserir bloco logo antes da linha `// --- EXPORTAÇÃO TXT ---` (linha ~1628)

- [ ] **Step 1: Inserir constante, cache e funções auxiliares em `script.js`**

Localizar o trecho exato:
```js
// --- EXPORTAÇÃO TXT ---

const TXT_RUBRICAS_KEY = 'rh_txt_rubricas';
```

Inserir **antes** desse trecho:

```js
// --- CONFIG RUBRICAS POR EMPRESA ---

const _CFG_EVENTOS = [
    { ev: 'horasTrab', sufRub: 'HorasTrab', defaultTipo: 'horas' },
    { ev: 'he50',      sufRub: 'HE50',      defaultTipo: 'horas' },
    { ev: 'he100',     sufRub: 'HE100',     defaultTipo: 'horas' },
    { ev: 'noturno',   sufRub: 'Noturno',   defaultTipo: 'horas' },
    { ev: 'atraso',    sufRub: 'Atraso',    defaultTipo: 'horas' },
    { ev: 'falta',     sufRub: 'Falta',     defaultTipo: 'dias'  },
];

let _cacheConfigRubricas = {};

async function _buscarConfigRubricas(codigoEmpresa) {
    if (!codigoEmpresa) return null;
    if (_cacheConfigRubricas[codigoEmpresa] !== undefined) return _cacheConfigRubricas[codigoEmpresa];
    try {
        const { data, error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .select('evento, codigo_rubrica, tipo_valor')
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        if (!data || data.length === 0) {
            _cacheConfigRubricas[codigoEmpresa] = null;
            return null;
        }
        const cfg = {};
        data.forEach(r => { cfg[r.evento] = { cod: r.codigo_rubrica, tipo: r.tipo_valor }; });
        _cacheConfigRubricas[codigoEmpresa] = cfg;
        return cfg;
    } catch (e) {
        console.error('Erro ao buscar config rubricas:', e);
        return null;
    }
}

function _aplicarConfigRubricasNoCampos(prefixo, cfg) {
    if (!cfg) return;
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`${prefixo}Rub${def.sufRub}`);
        const tipoEl = document.getElementById(`${prefixo}Tipo${def.sufRub}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
}

function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
}

function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
}

```

- [ ] **Step 2: Verificar no console que não há erros de sintaxe**

Abrir `index.html` no navegador, abrir DevTools > Console. Não devem aparecer erros JavaScript.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: constante _CFG_EVENTOS, cache e funções auxiliares de config de rubricas"
```

---

### Task 5: JS — Funções do modal de configuração

**Files:**
- Modify: `script.js` — inserir logo após o bloco adicionado na Task 4 (ainda antes de `// --- EXPORTAÇÃO TXT ---`)

- [ ] **Step 1: Inserir funções do modal de config em `script.js`**

Localizar o trecho exato adicionado na Task 4:
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
}
```

Inserir **após** esse bloco (e ainda antes de `// --- EXPORTAÇÃO TXT ---`):

```js
function abrirModalConfigRubricas() {
    document.getElementById('cfgCodigoEmpresa').value = '';
    document.getElementById('cfgBuscaEmpresa').value = '';
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
    _limparCamposConfigRubricas();
    document.getElementById('configRubricasModal').classList.add('active');
}

function fecharModalConfigRubricas() {
    document.getElementById('configRubricasModal').classList.remove('active');
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
}

function filtrarEmpresasConfig(termo) {
    const box   = document.getElementById('cfgBuscaEmpresaResultados');
    const input = document.getElementById('cfgBuscaEmpresa');
    if (!box || !input) return;

    const rect = input.getBoundingClientRect();
    box.style.top   = (rect.bottom + 2) + 'px';
    box.style.left  = rect.left + 'px';
    box.style.width = rect.width + 'px';

    const norm = termo.trim().toLowerCase();
    const lista = norm
        ? state.empresas.filter(e =>
            e.nome_empresa.toLowerCase().includes(norm) ||
            e.codigo_empresa.toLowerCase().includes(norm))
        : state.empresas;

    if (!lista.length) {
        box.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:13px;">Nenhuma empresa encontrada</div>';
        box.style.display = 'block';
        return;
    }

    box.innerHTML = lista.map(e => `
        <div onclick="selecionarEmpresaConfig('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

async function selecionarEmpresaConfig(codigo, nome) {
    document.getElementById('cfgCodigoEmpresa').value = codigo;
    document.getElementById('cfgBuscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
    const cfg = await _buscarConfigRubricas(codigo);
    _preencherCamposConfigRubricas(cfg);
}

async function salvarConfigRubricas() {
    const codigoEmpresa = (document.getElementById('cfgCodigoEmpresa')?.value || '').trim();
    if (!codigoEmpresa) { mostrarMensagem('Aviso', 'Selecione uma empresa antes de salvar.'); return; }

    const rows = _CFG_EVENTOS.map(def => ({
        codigo_empresa: codigoEmpresa,
        evento:         def.ev,
        codigo_rubrica: (document.getElementById(`cfgRub_${def.ev}`)?.value || '').trim(),
        tipo_valor:     document.getElementById(`cfgTipo_${def.ev}`)?.value || def.defaultTipo,
    }));

    try {
        const { error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .upsert(rows, { onConflict: 'codigo_empresa,evento' });
        if (error) throw error;
        delete _cacheConfigRubricas[codigoEmpresa];
        mostrarMensagem('Sucesso', '✅ Configuração de rubricas salva com sucesso!');
    } catch (e) {
        mostrarMensagem('Erro', 'Erro ao salvar configuração: ' + e.message);
    }
}

async function limparConfigRubricas() {
    const codigoEmpresa = (document.getElementById('cfgCodigoEmpresa')?.value || '').trim();
    if (!codigoEmpresa) { mostrarMensagem('Aviso', 'Selecione uma empresa.'); return; }
    if (!confirm(`Remover todas as configurações de rubricas da empresa ${codigoEmpresa}?`)) return;

    try {
        const { error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .delete()
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        delete _cacheConfigRubricas[codigoEmpresa];
        _limparCamposConfigRubricas();
        mostrarMensagem('Sucesso', '✅ Configuração removida com sucesso!');
    } catch (e) {
        mostrarMensagem('Erro', 'Erro ao limpar configuração: ' + e.message);
    }
}

```

- [ ] **Step 2: Adicionar fechar dropdown ao clicar fora**

Localizar o listener existente (linha ~108):
```js
document.addEventListener('click', e => {
    const box   = document.getElementById('buscaEmpresaResultados');
    const input = document.getElementById('buscaEmpresa');
    if (box && input && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
    }
});
```

Substituir por:
```js
document.addEventListener('click', e => {
    const box   = document.getElementById('buscaEmpresaResultados');
    const input = document.getElementById('buscaEmpresa');
    if (box && input && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
    }
    const cfgBox   = document.getElementById('cfgBuscaEmpresaResultados');
    const cfgInput = document.getElementById('cfgBuscaEmpresa');
    if (cfgBox && cfgInput && !cfgBox.contains(e.target) && e.target !== cfgInput) {
        cfgBox.style.display = 'none';
    }
});
```

- [ ] **Step 3: Verificar no console que não há erros**

Abrir `index.html` no navegador, abrir DevTools > Console. Não devem aparecer erros JavaScript.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: funções do modal de configuração de rubricas por empresa"
```

---

### Task 6: JS — Pré-fill nos modais de TXT

**Files:**
- Modify: `script.js` — funções `abrirModalExportacaoTXT` (linha ~1719) e `abrirModalTxtResultados` (linha ~2265)

- [ ] **Step 1: Tornar `abrirModalExportacaoTXT` assíncrona com pré-fill**

Localizar o trecho exato:
```js
function abrirModalExportacaoTXT() {
    document.getElementById('expNaoCompensar').checked = false;
    document.getElementById('expLabelAtraso').textContent = 'Atraso';
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
    const saved = localStorage.getItem(TXT_RUBRICAS_KEY);
    if (saved) { try { _carregarConfigNoCampos('exp', JSON.parse(saved)); } catch(e) {} }
}
```

Substituir por:
```js
async function abrirModalExportacaoTXT() {
    document.getElementById('expNaoCompensar').checked = false;
    document.getElementById('expLabelAtraso').textContent = 'Atraso';
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
    const saved = localStorage.getItem(TXT_RUBRICAS_KEY);
    if (saved) { try { _carregarConfigNoCampos('exp', JSON.parse(saved)); } catch(e) {} }
    if (state.codigoEmpresa) {
        const cfg = await _buscarConfigRubricas(state.codigoEmpresa);
        _aplicarConfigRubricasNoCampos('exp', cfg);
    }
}
```

- [ ] **Step 2: Tornar `abrirModalTxtResultados` assíncrona com pré-fill**

Localizar o trecho exato:
```js
function abrirModalTxtResultados() {
    if (!state.resultados || state.resultados.length === 0) {
        mostrarMensagem('Aviso', 'Não há dados processados para gerar o TXT.');
        return;
    }
    document.getElementById('resNaoCompensar').checked = false;
    document.getElementById('resLabelAtraso').textContent = 'Atraso';
    const saved = localStorage.getItem(TXT_RUBRICAS_KEY);
    if (saved) { try { _carregarConfigNoCampos('res', JSON.parse(saved)); } catch(e) {} }
    document.getElementById('resTxtPrevia').style.display = 'none';
    const _laCont = document.getElementById('lancamentosAdicionaisContainer');
    if (_laCont) _laCont.innerHTML = '';
    const _laHdr = document.getElementById('lancamentosAdicionaisHeader');
    if (_laHdr) _laHdr.style.display = 'none';
    document.getElementById('txtRubricasModal').classList.add('active');
}
```

Substituir por:
```js
async function abrirModalTxtResultados() {
    if (!state.resultados || state.resultados.length === 0) {
        mostrarMensagem('Aviso', 'Não há dados processados para gerar o TXT.');
        return;
    }
    document.getElementById('resNaoCompensar').checked = false;
    document.getElementById('resLabelAtraso').textContent = 'Atraso';
    const saved = localStorage.getItem(TXT_RUBRICAS_KEY);
    if (saved) { try { _carregarConfigNoCampos('res', JSON.parse(saved)); } catch(e) {} }
    const cfg = await _buscarConfigRubricas(state.codigoEmpresa);
    _aplicarConfigRubricasNoCampos('res', cfg);
    document.getElementById('resTxtPrevia').style.display = 'none';
    const _laCont = document.getElementById('lancamentosAdicionaisContainer');
    if (_laCont) _laCont.innerHTML = '';
    const _laHdr = document.getElementById('lancamentosAdicionaisHeader');
    if (_laHdr) _laHdr.style.display = 'none';
    document.getElementById('txtRubricasModal').classList.add('active');
}
```

- [ ] **Step 3: Verificar no console que não há erros**

Abrir `index.html` no navegador. Confirmar sem erros no Console.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: pré-preenchimento de rubricas por empresa nos modais de TXT"
```

---

### Task 7: Teste manual end-to-end

- [ ] **Step 1: Testar fluxo de configuração**

1. Abrir `index.html` no navegador
2. Clicar em "⚙️ Configurar Rubricas por Empresa"
3. Digitar nome/código de uma empresa no campo de busca → dropdown deve aparecer
4. Selecionar empresa → campos devem ficar vazios (primeira vez) ou preenchidos (se já houver config)
5. Preencher alguns códigos de rubrica (ex: Horas Extras 50% = `000050`, Falta = `000510`)
6. Clicar "💾 Salvar" → mensagem "✅ Configuração de rubricas salva com sucesso!"
7. Fechar modal

- [ ] **Step 2: Verificar no Supabase**

No Supabase > Table Editor > `rh_config_rubricas_txt`: confirmar que existem 6 linhas para a empresa salva, com os valores corretos.

- [ ] **Step 3: Testar pré-fill no modal "Exportar TXT"**

1. Na tela inicial, ter a empresa já selecionada (`codigoEmpresa` preenchido via formulário de seleção)
2. Clicar "📄 Exportar dados para lançamento na folha (TXT)"
3. Os campos de rubrica devem vir pré-preenchidos com os valores salvos
4. Confirmar que os campos são editáveis

- [ ] **Step 4: Testar pré-fill no modal "Gerar TXT" (resultados)**

1. Selecionar empresa e competência, processar folha, ir para tela de resultados
2. Clicar "📄 Gerar TXT"
3. Os campos de rubrica devem vir pré-preenchidos
4. Confirmar que os campos são editáveis

- [ ] **Step 5: Testar empresa sem configuração**

1. No modal de config, selecionar empresa diferente (sem config salva)
2. Campos devem ficar vazios
3. Abrir modal "Gerar TXT" com essa empresa selecionada
4. Campos devem ficar com valores do localStorage (fallback) ou vazios

- [ ] **Step 6: Testar "Limpar Empresa"**

1. Abrir modal de config, selecionar empresa que tem config
2. Clicar "🗑 Limpar Empresa", confirmar o prompt
3. Campos devem ficar vazios
4. Verificar no Supabase que as linhas foram removidas

- [ ] **Step 7: Commit final**

```bash
git add "Projeto RH/schema_rh.sql" "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: configuração de rubricas TXT por empresa com pré-preenchimento automático"
```
