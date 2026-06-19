# Conversor de Folha de Ponto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `Projeto RH/conversor.html` + `conversor.js` — wizard de 4 etapas que converte qualquer folha de ponto (Excel, PDF, imagem) para o formato `.xlsx` exato esperado pelo `importarExcel` do Controle de Frequência.

**Architecture:** Página HTML standalone integrada ao sidebar do Projeto RH com autenticação existente. Wizard linear: Configuração → Upload → Tabela editável → Mapeamento + Download. Extração híbrida: SheetJS (Excel/CSV), PDF.js (PDF digital), Tesseract.js OCR (imagem / PDF escaneado). Sem persistência no Supabase — tudo client-side.

**Tech Stack:** Vanilla JS, HTML5, SheetJS 0.18.5 (existente), PDF.js 3.11.174 (CDN novo), Tesseract.js 5.x (CDN novo), Supabase JS 2.x (existente).

## Global Constraints

- Sem build tools, sem ES modules — vanilla JS com `<script src>` via CDN
- SheetJS 0.18.5 já usado em `script.js` e `admin.js`
- PDF.js 3.11.174 via CDNJS — define global `pdfjsLib`; worker no mesmo CDN
- Tesseract.js 5.x via jsDelivr — define global `Tesseract`; baixa modelo `por` automaticamente
- Autenticação: `PortalAuthGuard.init(1)` igual ao `index.html`
- Supabase: `SUPABASE_URL` e `SUPABASE_KEY` de `../supabase-config.js`
- Nome da aba Excel de saída: `{codigo} {nome}` ou `{nome}` — exato padrão de `importarExcel` em `script.js`
- Datas forçadas como texto `{ t: 's' }` — mesmo padrão de `gerarModeloExcel` em `script.js`
- Dia da Semana calculado pela ferramenta (`DD/MM/AAAA` → `Seg`/`Ter`/etc)
- Paleta: `#8B3A3A` (primary), `#6B2A2A` (dark) — igual `styles.css`

---

### Task 1: Scaffold — conversor.html completo + link no sidebar

**Files:**
- Create: `Projeto RH/conversor.html`
- Modify: `Projeto RH/index.html` (linha ~42, após botão Configurações)

**Interfaces:**
- Produces: page shell com `#step1` `#step2` `#step3` `#step4`; estilos inline wizard; CDN scripts carregados; `init()` chamado após auth; hamburger funcional

- [ ] **Step 1: Criar `Projeto RH/conversor.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversor de Folha de Ponto · SCONT</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        .wizard-bar{display:flex;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid #E0E0E0;}
        .wizard-step{flex:1;padding:12px 8px;text-align:center;background:#F5F5F5;color:#999;font-size:12px;font-weight:600;border:none;cursor:default;transition:all 0.2s;}
        .wizard-step.ativo{background:#8B3A3A;color:white;}
        .wizard-step.feito{background:#D4EDDA;color:#155724;cursor:pointer;}
        .wizard-pane{display:none;}
        .wizard-pane.ativo{display:block;}
        .dropzone{border:2px dashed #8B3A3A;border-radius:10px;padding:40px 20px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FAFAFA;}
        .dropzone:hover,.dropzone.over{background:#FFF5F5;border-color:#6B2A2A;}
        .edit-table{width:100%;border-collapse:collapse;font-size:12px;}
        .edit-table th{background:#8B3A3A;color:white;padding:8px 6px;text-align:left;font-size:11px;white-space:nowrap;}
        .edit-table td{border-bottom:1px solid #EEE;padding:2px;}
        .edit-table td input{width:100%;border:none;padding:5px 6px;font-size:12px;background:transparent;box-sizing:border-box;}
        .edit-table td input:focus{background:#FFF8F0;outline:1px solid #8B3A3A;border-radius:3px;}
        .edit-table td input.invalido{background:#FDECEA;outline:1px solid #E74C3C;}
        .mapa-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .mapa-item label{display:block;font-size:12px;font-weight:600;color:#2C3E50;margin-bottom:4px;}
        .mapa-item select{width:100%;padding:8px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;}
        .autocomplete-wrap{position:relative;}
        .autocomplete-list{position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #E0E0E0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;z-index:100;display:none;}
        .autocomplete-item{padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #F0F0F0;}
        .autocomplete-item:hover{background:#F5F5F5;}
        .msg-box{padding:12px 16px;border-radius:6px;margin-bottom:16px;display:none;font-size:13px;}
        .msg-box.info{background:#D1ECF1;color:#0C5460;border:1px solid #BEE5EB;display:block;}
        .msg-box.erro{background:#F8D7DA;color:#721C24;border:1px solid #F5C6CB;display:block;}
        .msg-box.aviso{background:#FFF3CD;color:#856404;border:1px solid #FFEEBA;display:block;}
        .msg-box.ok{background:#D4EDDA;color:#155724;border:1px solid #C3E6CB;display:block;}
        .progress-wrap{margin-top:16px;display:none;}
        .progress-bar-bg{background:#EEE;border-radius:4px;height:8px;overflow:hidden;margin-top:6px;}
        .progress-bar-fill{background:#8B3A3A;height:100%;width:0%;transition:width 0.3s;}
        .wizard-nav{display:flex;justify-content:space-between;margin-top:20px;}
        .btn-voltar{padding:10px 20px;border:1px solid #C0C0C0;border-radius:6px;background:white;cursor:pointer;font-weight:600;color:#555;}
        .btn-proximo{padding:10px 24px;border:none;border-radius:6px;background:#8B3A3A;color:white;cursor:pointer;font-weight:600;}
        .btn-proximo:disabled{background:#CCC;cursor:default;}
        .btn-gerar{padding:10px 24px;border:none;border-radius:6px;background:#27AE60;color:white;cursor:pointer;font-weight:700;font-size:14px;}
        .btn-gerar:disabled{background:#CCC;cursor:default;}
        .form-label{display:block;font-weight:600;color:#2C3E50;font-size:13px;margin-bottom:6px;}
        .form-input{width:100%;padding:10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;box-sizing:border-box;}
        .form-input:focus{outline:none;border-color:#8B3A3A;box-shadow:0 0 0 3px rgba(139,58,58,0.1);}
        .section-box{background:#F8F9FA;border:1px solid #DEE2E6;border-radius:8px;padding:20px;margin-bottom:20px;}
        .section-box h3{color:#2C3E50;font-size:15px;margin:0 0 16px;}
    </style>
</head>
<body>

<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
        <h2>Folha de Ponto</h2>
        <p>Controle de Frequência</p>
    </div>
    <nav class="sidebar-nav">
        <a class="sidebar-item" href="index.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📋</span> Folha de Ponto
        </a>
        <a class="sidebar-item active" href="conversor.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📄</span> Conversor de Folha
        </a>
    </nav>
    <div class="sidebar-footer">
        <a href="../portal.html" class="sidebar-item" style="border:1px solid rgba(255,255,255,0.18);border-radius:8px;text-decoration:none;">
            <span class="sidebar-item-icon">🏠</span> Voltar ao Portal
        </a>
        <div class="sidebar-footer-info"><strong>Conversor de Folha</strong> SCONT · RH</div>
    </div>
</aside>

<div class="main-content">
    <div class="page-header">
        <h1>📄 Conversor de Folha de Ponto</h1>
        <div class="page-header-sub">Converta qualquer folha de ponto para o formato do Controle de Frequência</div>
    </div>
    <div class="container">

        <div class="wizard-bar" id="wizardBar">
            <div class="wizard-step ativo" data-step="1">1 · Configuração</div>
            <div class="wizard-step" data-step="2">2 · Upload</div>
            <div class="wizard-step" data-step="3">3 · Revisão</div>
            <div class="wizard-step" data-step="4">4 · Mapeamento</div>
        </div>

        <!-- STEP 1 -->
        <div id="step1" class="wizard-pane ativo">
            <div class="section-box">
                <h3>Configuração</h3>
                <div style="margin-bottom:16px;">
                    <label class="form-label">Empresa *</label>
                    <div class="autocomplete-wrap">
                        <input type="text" id="buscaEmpresa" class="form-input" placeholder="Digite código ou nome..." oninput="filtrarEmpresas(this.value)" autocomplete="off">
                        <div class="autocomplete-list" id="listaEmpresas"></div>
                    </div>
                    <input type="hidden" id="codigoEmpresaHidden">
                </div>
                <div>
                    <label class="form-label">Competência *</label>
                    <input type="text" id="competencia" class="form-input" style="max-width:160px;" placeholder="MM/AAAA" maxlength="7" oninput="formatarCompetenciaInput(this)">
                </div>
            </div>
            <div class="wizard-nav" style="justify-content:flex-end;">
                <button class="btn-proximo" id="btnProximo1" onclick="avancarEtapa2()" disabled>Próximo →</button>
            </div>
        </div>

        <!-- STEP 2 -->
        <div id="step2" class="wizard-pane">
            <div class="section-box">
                <h3>Upload do Arquivo</h3>
                <div class="dropzone" id="dropzone"
                     onclick="document.getElementById('fileInput').click()"
                     ondragover="event.preventDefault();this.classList.add('over')"
                     ondragleave="this.classList.remove('over')"
                     ondrop="event.preventDefault();this.classList.remove('over');handleArquivo(event.dataTransfer.files[0])">
                    <div style="font-size:48px;margin-bottom:12px;">📂</div>
                    <p style="font-weight:600;color:#2C3E50;margin:0 0 8px;">Arraste o arquivo aqui ou clique para selecionar</p>
                    <p style="font-size:12px;color:#7F8C8D;margin:0;">Aceito: .xlsx · .xls · .csv · .pdf · .png · .jpg · .jpeg</p>
                </div>
                <input type="file" id="fileInput" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg" style="display:none" onchange="handleArquivo(this.files[0]);this.value=''">
                <div class="msg-box" id="msgStep2"></div>
                <div class="progress-wrap" id="progressWrap">
                    <p style="font-size:12px;color:#555;margin:0;" id="progressLabel">Processando...</p>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressFill"></div></div>
                </div>
            </div>
            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(1)">← Voltar</button>
            </div>
        </div>

        <!-- STEP 3 -->
        <div id="step3" class="wizard-pane">
            <div class="section-box">
                <h3>Revisão dos Dados Extraídos</h3>
                <p style="font-size:13px;color:#7F8C8D;margin:0 0 16px;">Edite as células se necessário. Remova linhas inválidas com ✕.</p>
                <div class="msg-box" id="msgStep3"></div>
                <div style="overflow-x:auto;border:1px solid #E0E0E0;border-radius:8px;">
                    <table class="edit-table">
                        <thead id="editThead"></thead>
                        <tbody id="editTbody"></tbody>
                    </table>
                </div>
                <button onclick="adicionarLinha()" style="margin-top:10px;padding:6px 14px;border:1px solid #8B3A3A;border-radius:6px;background:white;color:#8B3A3A;cursor:pointer;font-size:12px;font-weight:600;">+ Linha</button>
            </div>
            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(2)">← Voltar</button>
                <button class="btn-proximo" onclick="prepararEtapa4()">Próximo →</button>
            </div>
        </div>

        <!-- STEP 4 -->
        <div id="step4" class="wizard-pane">
            <div class="section-box">
                <h3>Mapeamento de Colunas</h3>
                <p style="font-size:12px;color:#7F8C8D;margin:0 0 12px;">Indique qual coluna da tabela corresponde a cada campo.</p>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:16px;">
                    <input type="checkbox" id="chkTerceiroTurno" onchange="toggleTerceiroTurno(this.checked)">
                    Habilitar 3º turno (Entrada 3 / Saída 3)
                </label>
                <div class="mapa-grid" id="mapaGrid"></div>
            </div>

            <div class="section-box">
                <h3>Empregado</h3>
                <div style="margin-bottom:14px;">
                    <label class="form-label">Nome *</label>
                    <div class="autocomplete-wrap">
                        <input type="text" id="buscaEmpregado" class="form-input" placeholder="Digite o nome do empregado..." oninput="filtrarEmpregados(this.value)" autocomplete="off">
                        <div class="autocomplete-list" id="listaEmpregados"></div>
                    </div>
                </div>
                <div>
                    <label class="form-label">Código <span style="font-weight:400;color:#7F8C8D;">(preenchido automaticamente — opcional)</span></label>
                    <input type="text" id="codigoEmpregadoOut" class="form-input" style="max-width:180px;" placeholder="Opcional" oninput="state.codigoManual=this.value">
                </div>
                <div class="msg-box" id="msgEmpregado"></div>
            </div>

            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(3)">← Voltar</button>
                <button class="btn-gerar" id="btnGerar" onclick="gerarExcel()">⬇️ Gerar Excel</button>
            </div>
        </div>

    </div>
</div>

<div id="portalAuthOverlay" style="position:fixed;inset:0;background:#F4F7F6;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
    <div style="font-size:40px;">🔐</div>
    <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<script src="../supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script src="../portal-auth-guard.js"></script>
<script src="conversor.js"></script>
<script>
(async () => {
    const ok = await window.PortalAuthGuard.init(1);
    if (!ok) return;
    document.getElementById('portalAuthOverlay').remove();
    init();
})();
(function() {
    const h = document.getElementById('hamburger');
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    h.addEventListener('click', () => { s.classList.toggle('open'); o.classList.toggle('active'); });
    o.addEventListener('click', () => { s.classList.remove('open'); o.classList.remove('active'); });
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Adicionar link ao sidebar de `index.html`**

Localizar o bloco `<nav class="sidebar-nav">` em `Projeto RH/index.html` (aproximadamente linha 37). Após o botão de Configurações, inserir:

```html
        <a class="sidebar-item" href="conversor.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📄</span> Conversor de Folha
        </a>
```

- [ ] **Step 3: Criar `Projeto RH/conversor.js` vazio (placeholder para próximas tasks)**

```javascript
// conversor.js — preenchido nas Tasks 2–10
```

- [ ] **Step 4: Verificação manual**

Abrir `Projeto RH/conversor.html` no browser (com servidor local ou diretamente).
Esperado: página carrega com sidebar, wizard bar mostrando "1 · Configuração" ativo, overlay de auth aparece e some após autenticação. Hamburger funciona no mobile.

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/conversor.html" "Projeto RH/conversor.js" "Projeto RH/index.html"
git commit -m "feat: scaffold Conversor de Folha de Ponto"
```

---

### Task 2: State + Etapa 1 — Empresa, Competência e Supabase

**Files:**
- Modify: `Projeto RH/conversor.js` (substituir placeholder)

**Interfaces:**
- Produces: `state` global; `init()`; `filtrarEmpresas(termo)`; `selecionarEmpresa(codigo, nome)`; `formatarCompetenciaInput(el)`; `avancarEtapa2()`; `mostrarEtapa(n)`; `mostrarMsg(elId, tipo, texto)` / `ocultarMsg(elId)`

- [ ] **Step 1: Escrever o conteúdo completo de `conversor.js`** (state + helpers + init + etapa 1)

```javascript
// ===== STATE =====
const state = {
    sb: null,
    empresa: null,        // { codigo_empresa, nome_empresa }
    competencia: '',
    empregados: [],       // [{ codigo_empregado, nome_empregado }]
    headers: [],          // string[] — labels das colunas extraídas
    rawRows: [],          // Record<string,string>[] — dados da tabela editável
    mapping: { data: '', entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '' },
    terceiroTurno: false,
    empregado: null,      // { codigo_empregado, nome_empregado } | null
    codigoManual: ''
};

// ===== HELPERS =====
function mostrarMsg(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'msg-box ' + tipo;
    el.textContent = texto;
}
function ocultarMsg(elId) {
    const el = document.getElementById(elId);
    if (el) { el.className = 'msg-box'; el.textContent = ''; }
}

function mostrarEtapa(n) {
    document.querySelectorAll('.wizard-pane').forEach(p => p.classList.remove('ativo'));
    document.querySelectorAll('.wizard-step').forEach((s, i) => {
        s.classList.remove('ativo', 'feito');
        if (i + 1 < n) s.classList.add('feito');
        if (i + 1 === n) s.classList.add('ativo');
    });
    const pane = document.getElementById('step' + n);
    if (pane) pane.classList.add('ativo');
}

// ===== INIT =====
function init() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    state.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    carregarEmpresas();
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaEmpresa') && !e.target.closest('#listaEmpresas'))
            document.getElementById('listaEmpresas').style.display = 'none';
    });
}

// ===== ETAPA 1 — EMPRESA + COMPETÊNCIA =====
async function carregarEmpresas() {
    try {
        const { data, error } = await state.sb
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state._todasEmpresas = data || [];
    } catch (e) {
        mostrarMsg('msgStep2', 'erro', 'Erro ao carregar empresas: ' + e.message);
    }
}

window.filtrarEmpresas = function(termo) {
    const lista = document.getElementById('listaEmpresas');
    const norm = termo.trim().toLowerCase();
    const todas = state._todasEmpresas || [];
    const filtradas = norm
        ? todas.filter(e => e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
        : todas;
    if (!filtradas.length) { lista.style.display = 'none'; return; }
    lista.innerHTML = filtradas.map(e =>
        `<div class="autocomplete-item" onclick="selecionarEmpresa('${e.codigo_empresa}','${e.nome_empresa.replace(/'/g,"\\'")}')">
            <strong>${e.codigo_empresa}</strong> — ${e.nome_empresa}
         </div>`
    ).join('');
    lista.style.display = 'block';
};

window.selecionarEmpresa = async function(codigo, nome) {
    state.empresa = { codigo_empresa: codigo, nome_empresa: nome };
    document.getElementById('buscaEmpresa').value = `${codigo} — ${nome}`;
    document.getElementById('codigoEmpresaHidden').value = codigo;
    document.getElementById('listaEmpresas').style.display = 'none';
    atualizarBotaoProximo1();
    await carregarEmpregados(codigo);
};

async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await state.sb
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregados = data || [];
    } catch (e) {
        console.warn('Erro ao carregar empregados:', e.message);
    }
}

window.formatarCompetenciaInput = function(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
    el.value = v;
    state.competencia = el.value;
    atualizarBotaoProximo1();
};

function atualizarBotaoProximo1() {
    const ok = state.empresa && /^(0[1-9]|1[0-2])\/\d{4}$/.test(state.competencia);
    document.getElementById('btnProximo1').disabled = !ok;
}

window.avancarEtapa2 = function() {
    mostrarEtapa(2);
};
```

- [ ] **Step 2: Verificação manual**

Abrir `conversor.html`. Digitar empresa no campo — lista aparece. Selecionar empresa — campo exibe `{codigo} — {nome}`. Digitar competência `06/2026` — botão "Próximo" habilita. Clicar Próximo — etapa 2 aparece com dropzone. Clicar Voltar — volta à etapa 1.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor etapa 1 — empresa e competência"
```

---

### Task 3: Etapa 2 — Upload, detecção de tipo e roteamento

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.headers`, `state.rawRows` (escrito pelos extratores)
- Produces: `handleArquivo(file)`; `detectarTipo(file)` → string; `mostrarProgresso(pct, label)`; `ocultarProgresso()`; após extração bem-sucedida chama `mostrarEtapa(3)` e `renderizarTabela()`

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 2 — UPLOAD + ROTEAMENTO =====
window.handleArquivo = async function(file) {
    if (!file) return;
    ocultarMsg('msgStep2');
    mostrarProgresso(5, 'Detectando tipo do arquivo...');

    try {
        const tipo = detectarTipo(file);
        let resultado;

        if (tipo === 'excel') {
            mostrarProgresso(30, 'Lendo planilha...');
            resultado = await extrairExcel(file);
        } else if (tipo === 'pdf') {
            mostrarProgresso(20, 'Lendo PDF...');
            resultado = await extrairPdf(file);
        } else if (tipo === 'imagem') {
            mostrarProgresso(20, 'Iniciando OCR (pode levar alguns segundos)...');
            resultado = await extrairImagem(file);
        } else {
            throw new Error('Formato não suportado: ' + file.name);
        }

        state.headers = resultado.headers;
        state.rawRows = resultado.rows;

        if (!state.rawRows.length) {
            ocultarProgresso();
            mostrarMsg('msgStep2', 'aviso', 'Nenhum dado detectado no arquivo. Verifique se o arquivo está correto.');
            return;
        }

        ocultarProgresso();
        mostrarEtapa(3);
        renderizarTabela();
    } catch (e) {
        ocultarProgresso();
        mostrarMsg('msgStep2', 'erro', 'Erro ao processar arquivo: ' + e.message);
        console.error(e);
    }
};

function detectarTipo(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'imagem';
    return 'desconhecido';
}

function mostrarProgresso(pct, label) {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'block';
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    const lbl = document.getElementById('progressLabel');
    if (lbl) lbl.textContent = label || 'Processando...';
}

function ocultarProgresso() {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'none';
}

// Stubs — substituídos nas Tasks 4, 5, 6
async function extrairExcel(file) { return { headers: [], rows: [] }; }
async function extrairPdf(file)   { return { headers: [], rows: [] }; }
async function extrairImagem(file){ return { headers: [], rows: [] }; }
```

- [ ] **Step 2: Verificação manual**

Selecionar um arquivo `.xlsx` qualquer. Esperado: barra de progresso aparece, "Lendo planilha..." exibido, depois etapa 3 aparece (vazia por ora — renderizarTabela ainda não implementada). Selecionar arquivo `.pdf` — fluxo entra em `extrairPdf`. Selecionar `.jpg` — entra em `extrairImagem`. Formato inválido — mensagem de erro aparece.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor etapa 2 — roteamento de arquivo"
```

---

### Task 4: Extrator Excel/CSV

**Files:**
- Modify: `Projeto RH/conversor.js` (substituir stub `extrairExcel`)

**Interfaces:**
- Produces: `extrairExcel(file)` → `Promise<{ headers: string[], rows: Record<string,string>[] }>`
- `rows` exemplo: `[{ 'Data': '01/06/2026', 'Entrada 1': '08:00', 'Saída 1': '12:00' }]`

- [ ] **Step 1: Substituir o stub `extrairExcel` em `conversor.js`**

```javascript
async function extrairExcel(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Encontra a linha de cabeçalho (primeira linha não-vazia)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
        if (raw[i].some(c => String(c).trim())) { headerIdx = i; break; }
    }

    const headers = raw[headerIdx].map((h, i) => String(h).trim() || ('Col' + i));
    const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => String(c).trim()));

    const rows = dataRows.map(r =>
        Object.fromEntries(headers.map((h, i) => [h, normalizarCelula(h, r[i])]))
    );

    return { headers, rows };
}

function normalizarCelula(header, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    // Detecta se é um serial de tempo do Excel (fração de 24h, < 1)
    if (typeof valor === 'number' && valor < 1 && valor >= 0) {
        const total = Math.round(valor * 24 * 60);
        const h = Math.floor(total / 60) % 24;
        const m = total % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    // Serial de data do Excel (inteiro >= 1)
    if (typeof valor === 'number' && valor >= 1) {
        try {
            const parsed = XLSX.SSF.parse_date_code(valor);
            const d = String(parsed.d).padStart(2,'0');
            const mo = String(parsed.m).padStart(2,'0');
            return `${d}/${mo}/${parsed.y}`;
        } catch { return String(valor); }
    }
    const s = String(valor).trim();
    // Normaliza hora HH:MM
    const mHora = s.match(/^(\d{1,2}):(\d{2})/);
    if (mHora) return `${mHora[1].padStart(2,'0')}:${mHora[2]}`;
    return s;
}
```

- [ ] **Step 2: Verificação manual**

Usar a planilha modelo gerada pelo próprio Controle de Frequência (`Modelo_FolhaPonto_*.xlsx`). Selecionar o arquivo — etapa 3 deve aparecer com tabela mostrando colunas `Data | Dia da Semana | Entrada 1 | Saída 1 | Entrada 2 | Saída 2` e as datas do mês corretas. Horários em branco — ok. Testar também com `.csv` exportado do Excel.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor — extrator Excel/CSV com normalização de hora e data"
```

---

### Task 5: Extrator PDF digital

**Files:**
- Modify: `Projeto RH/conversor.js` (substituir stub `extrairPdf`)

**Interfaces:**
- Produces: `extrairPdf(file)` → `Promise<{headers, rows}>`; `parsearTextoPDF(texto)` → `{headers, rows}`; se PDF escaneado (`ehEscaneado`), delega para `extrairPdfOCR(arrayBuffer)` (stub implementado na Task 6)

- [ ] **Step 1: Substituir o stub `extrairPdf` em `conversor.js`**

```javascript
async function extrairPdf(file) {
    const buffer = await file.arrayBuffer();
    mostrarProgresso(30, 'Extraindo texto do PDF...');

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    let textoTotal = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const linhaPorY = {};
        content.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            linhaPorY[y] = (linhaPorY[y] || []);
            linhaPorY[y].push({ x: item.transform[4], str: item.str });
        });
        const linhasOrdenadas = Object.keys(linhaPorY)
            .sort((a, b) => b - a)
            .map(y => linhaPorY[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' '));
        textoTotal += linhasOrdenadas.join('\n') + '\n';
        mostrarProgresso(30 + Math.round((p / pdf.numPages) * 40), `Lendo página ${p}/${pdf.numPages}...`);
    }

    const charsPerPage = textoTotal.replace(/\s/g, '').length / pdf.numPages;
    if (charsPerPage < 30) {
        mostrarProgresso(70, 'PDF escaneado — iniciando OCR...');
        return extrairPdfOCR(buffer);
    }

    return parsearTextoPDF(textoTotal);
}

function parsearTextoPDF(texto) {
    const DATA_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
    const HORA_RE = /\b(\d{1,2}:\d{2})\b/g;
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
    const rows = [];

    for (const linha of linhas) {
        const dataMatch = linha.match(DATA_RE);
        const horas = [...linha.matchAll(HORA_RE)].map(m =>
            m[1].padStart(5, '0').replace(/^(\d):/, '0$1:')
        );
        if (!dataMatch && !horas.length) continue;
        const row = { 'Data': dataMatch ? dataMatch[1] : '' };
        ['H1','H2','H3','H4','H5','H6'].forEach((k, i) => { row[k] = horas[i] || ''; });
        rows.push(row);
    }

    const headers = ['Data', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    return { headers, rows: rows.filter(r => r['Data'] || r['H1']) };
}
```

- [ ] **Step 2: Verificação manual**

Usar um PDF digital de folha de ponto (exportado de sistema). Selecionar arquivo — progresso mostra páginas sendo lidas. Etapa 3 aparece com tabela contendo coluna `Data` e `H1`–`H6` preenchidas com os horários detectados. Datas no formato `DD/MM/AAAA`. PDFs com texto muito escasso devem delegar ao OCR (stub por ora — verifica no console `extrairPdfOCR called`).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor — extrator PDF digital com PDF.js"
```

---

### Task 6: Extrator OCR (imagem + PDF escaneado)

**Files:**
- Modify: `Projeto RH/conversor.js` (substituir stubs `extrairImagem` e `extrairPdfOCR`)

**Interfaces:**
- Consumes: `parsearTextoPDF(texto)` da Task 5
- Produces: `extrairImagem(file)` → `Promise<{headers,rows}>`; `extrairPdfOCR(arrayBuffer)` → `Promise<{headers,rows}>`

- [ ] **Step 1: Substituir os stubs em `conversor.js`**

```javascript
async function extrairImagem(file) {
    mostrarProgresso(20, 'Reconhecendo texto (OCR)...');
    const texto = await rodarOCR(file);
    return parsearTextoPDF(texto);
}

async function extrairPdfOCR(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let textoTotal = '';

    for (let p = 1; p <= pdf.numPages; p++) {
        mostrarProgresso(20 + Math.round((p / pdf.numPages) * 60), `OCR página ${p}/${pdf.numPages}...`);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        textoTotal += await rodarOCR(canvas) + '\n';
    }

    return parsearTextoPDF(textoTotal);
}

async function rodarOCR(fonte) {
    const { data: { text } } = await Tesseract.recognize(fonte, 'por', {
        logger: m => {
            if (m.status === 'recognizing text') {
                mostrarProgresso(
                    20 + Math.round(m.progress * 70),
                    `OCR: ${Math.round(m.progress * 100)}%`
                );
            }
        }
    });
    return text;
}
```

- [ ] **Step 2: Verificação manual**

Tirar uma foto de uma folha de ponto impressa (ou usar a imagem do PDF gerada em print screen). Selecionar a imagem — barra de progresso mostra percentual do OCR. Após alguns segundos, etapa 3 aparece com o que foi reconhecido. Espera-se que datas e horários impressos sejam detectados; texto manuscrito aparece com erros que o usuário corrige na tabela.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor — extrator OCR com Tesseract.js (imagem + PDF escaneado)"
```

---

### Task 7: Etapa 3 — Tabela editável

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.headers`, `state.rawRows`
- Produces: `renderizarTabela()`; `adicionarLinha()`; mutações em `state.rawRows` a cada edição de célula

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 3 — TABELA EDITÁVEL =====
window.renderizarTabela = function renderizarTabela() {
    const thead = document.getElementById('editThead');
    const tbody = document.getElementById('editTbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '<tr>' +
        '<th style="width:30px;"></th>' +
        state.headers.map(h => `<th>${h}</th>`).join('') +
        '</tr>';

    tbody.innerHTML = '';
    state.rawRows.forEach((row, ri) => {
        tbody.appendChild(criarLinhaTabela(row, ri));
    });
};

function criarLinhaTabela(row, ri) {
    const tr = document.createElement('tr');
    const tdDel = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del-row';
    btnDel.textContent = '✕';
    btnDel.onclick = () => removerLinha(ri);
    tdDel.appendChild(btnDel);
    tr.appendChild(tdDel);

    state.headers.forEach(h => {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = row[h] || '';
        inp.dataset.row = ri;
        inp.dataset.col = h;
        inp.oninput = function() {
            state.rawRows[this.dataset.row][this.dataset.col] = this.value;
        };
        td.appendChild(inp);
        tr.appendChild(td);
    });

    return tr;
}

function removerLinha(ri) {
    state.rawRows.splice(ri, 1);
    renderizarTabela();
}

window.adicionarLinha = function() {
    const linhaVazia = Object.fromEntries(state.headers.map(h => [h, '']));
    state.rawRows.push(linhaVazia);
    renderizarTabela();
    // Focar no primeiro campo da nova linha
    const tbody = document.getElementById('editTbody');
    const ultimaLinha = tbody.lastElementChild;
    if (ultimaLinha) {
        const primeiro = ultimaLinha.querySelector('input');
        if (primeiro) primeiro.focus();
    }
};

window.prepararEtapa4 = function() {
    mostrarEtapa(4);
    renderizarMapeamento();
    renderizarBuscaEmpregado();
};
```

- [ ] **Step 2: Verificação manual**

Carregar um Excel — etapa 3 exibe tabela com células editáveis. Editar um valor — `state.rawRows` atualizado (checar no console: `state.rawRows[0]`). Clicar ✕ em uma linha — linha removida. Clicar "+ Linha" — nova linha vazia adicionada com foco no primeiro campo. Clicar "Próximo" — etapa 4 carrega.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor etapa 3 — tabela editável com add/remove linha"
```

---

### Task 8: Etapa 4 — Mapeamento de colunas

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.headers`, `state.mapping`, `state.terceiroTurno`
- Produces: `renderizarMapeamento()`; `detectarMapeamento(headers)`; `toggleTerceiroTurno(checked)`; `state.mapping` atualizado

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 4 — MAPEAMENTO DE COLUNAS =====
const FUZZY_VARS = {
    data:     ['data','dt','dia','date'],
    entrada1: ['entrada1','entrada','e1','in1','batida1','batidaentrada','horariodeentrada'],
    saida1:   ['saida1','saida','s1','out1','batida2','batidasaida','horariodesaida'],
    entrada2: ['entrada2','e2','in2','batida3','h1'],
    saida2:   ['saida2','s2','out2','batida4','h2'],
    entrada3: ['entrada3','e3','in3','batida5','h3'],
    saida3:   ['saida3','s3','out3','batida6','h4']
};

function normFuzzy(s) {
    return String(s).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function detectarMapeamento(headers) {
    const mapping = { data:'', entrada1:'', saida1:'', entrada2:'', saida2:'', entrada3:'', saida3:'' };
    const usados = new Set();
    for (const [campo, vars] of Object.entries(FUZZY_VARS)) {
        for (const h of headers) {
            if (usados.has(h)) continue;
            const hn = normFuzzy(h);
            if (vars.some(v => hn.includes(v))) {
                mapping[campo] = h;
                usados.add(h);
                break;
            }
        }
    }
    return mapping;
}

const CAMPOS_LABEL = {
    data:     'Data *',
    entrada1: 'Entrada 1 *',
    saida1:   'Saída 1 *',
    entrada2: 'Entrada 2',
    saida2:   'Saída 2',
    entrada3: 'Entrada 3',
    saida3:   'Saída 3'
};

window.renderizarMapeamento = function() {
    state.mapping = detectarMapeamento(state.headers);
    const grid = document.getElementById('mapaGrid');
    if (!grid) return;

    const campos = state.terceiroTurno
        ? ['data','entrada1','saida1','entrada2','saida2','entrada3','saida3']
        : ['data','entrada1','saida1','entrada2','saida2'];

    const opcoes = ['(não usar)', ...state.headers]
        .map(h => `<option value="${h}">${h}</option>`).join('');

    grid.innerHTML = campos.map(campo => {
        const selecionado = state.mapping[campo] || '(não usar)';
        const opcoesComSel = ['(não usar)', ...state.headers]
            .map(h => `<option value="${h}" ${h === selecionado ? 'selected' : ''}>${h}</option>`)
            .join('');
        return `<div class="mapa-item">
            <label>${CAMPOS_LABEL[campo]}</label>
            <select onchange="state.mapping['${campo}']=this.value==='(não usar)'?'':this.value">
                ${opcoesComSel}
            </select>
        </div>`;
    }).join('');
};

window.toggleTerceiroTurno = function(checked) {
    state.terceiroTurno = checked;
    renderizarMapeamento();
};
```

- [ ] **Step 2: Verificação manual**

Após etapa 3, avançar para etapa 4. Esperado: selects aparecem pré-preenchidos com sugestões automáticas (ex: coluna "Entrada 1" do Excel → mapeada para "Entrada 1"). Alterar um select manualmente — `state.mapping` atualizado (verificar no console). Ativar "3º turno" — aparecimento dos selects "Entrada 3" e "Saída 3".

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor etapa 4 — mapeamento de colunas com fuzzy detect"
```

---

### Task 9: Etapa 4 — Atribuição de empregado

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.empregados` (carregado na Task 2)
- Produces: `renderizarBuscaEmpregado()`; `filtrarEmpregados(termo)`; `selecionarEmpregado(codigo, nome)`; `state.empregado` e `state.codigoManual` atualizados

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 4 — EMPREGADO =====
window.renderizarBuscaEmpregado = function() {
    ocultarMsg('msgEmpregado');
    document.getElementById('buscaEmpregado').value =
        state.empregado ? state.empregado.nome_empregado : '';
    document.getElementById('codigoEmpregadoOut').value =
        state.empregado ? (state.empregado.codigo_empregado || '') : (state.codigoManual || '');
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaEmpregado') && !e.target.closest('#listaEmpregados'))
            document.getElementById('listaEmpregados').style.display = 'none';
    }, { once: false });
};

window.filtrarEmpregados = function(termo) {
    const lista = document.getElementById('listaEmpregados');
    const norm = termo.trim().toLowerCase();
    const filtrados = norm
        ? state.empregados.filter(e =>
            e.nome_empregado.toLowerCase().includes(norm) ||
            (e.codigo_empregado || '').toLowerCase().includes(norm))
        : state.empregados.slice(0, 20);
    if (!filtrados.length) { lista.style.display = 'none'; return; }
    lista.innerHTML = filtrados.map(e =>
        `<div class="autocomplete-item"
              onclick="selecionarEmpregado('${e.codigo_empregado}','${e.nome_empregado.replace(/'/g,"\\'")}')">
            ${e.codigo_empregado ? '<strong>' + e.codigo_empregado + '</strong> — ' : ''}${e.nome_empregado}
         </div>`
    ).join('');
    lista.style.display = 'block';
};

window.selecionarEmpregado = function(codigo, nome) {
    state.empregado = { codigo_empregado: codigo, nome_empregado: nome };
    state.codigoManual = codigo;
    document.getElementById('buscaEmpregado').value = nome;
    document.getElementById('codigoEmpregadoOut').value = codigo;
    document.getElementById('listaEmpregados').style.display = 'none';
    ocultarMsg('msgEmpregado');
    if (!codigo) {
        mostrarMsg('msgEmpregado', 'aviso',
            'Este empregado não tem código cadastrado. O Controle de Frequência pode não reconhecê-lo na importação automática.');
    }
};
```

- [ ] **Step 2: Verificação manual**

Na etapa 4, digitar parte do nome de um empregado — lista aparece. Selecionar — campo nome e código preenchidos. Se empregado sem código — aviso amarelo aparece. Digitar nome que não existe na lista — campo fica editável (usuário pode digitar nome livre). `state.empregado` acessível no console.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor etapa 4 — atribuição de empregado com autocomplete"
```

---

### Task 10: Geração do Excel e download

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.rawRows`, `state.mapping`, `state.empregado`, `state.codigoManual`, `state.competencia`, `state.terceiroTurno`
- Produces: `gerarExcel()` — valida, monta planilha SheetJS, chama `XLSX.writeFile`

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== GERAÇÃO EXCEL =====
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

function calcularDiaSemana(dataStr) {
    const partes = dataStr.split('/');
    if (partes.length !== 3) return '';
    const [d, m, y] = partes.map(Number);
    if (!d || !m || !y) return '';
    return DIAS_SEMANA[new Date(y, m - 1, d).getDay()] || '';
}

function validarHora(v) {
    return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
}

function validarData(v) {
    return !v || /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(v);
}

window.gerarExcel = function() {
    // 1. Validar mapeamento mínimo
    if (!state.mapping.data) {
        mostrarMsg('msgEmpregado', 'erro', 'Mapeie a coluna "Data" antes de gerar o Excel.');
        return;
    }
    if (!state.mapping.entrada1 || !state.mapping.saida1) {
        mostrarMsg('msgEmpregado', 'erro', 'Mapeie pelo menos "Entrada 1" e "Saída 1".');
        return;
    }

    // 2. Validar empregado
    const nomeEmp = state.empregado?.nome_empregado || document.getElementById('buscaEmpregado').value.trim();
    if (!nomeEmp) {
        mostrarMsg('msgEmpregado', 'erro', 'Informe o nome do empregado.');
        return;
    }
    const codigoEmp = state.empregado?.codigo_empregado || state.codigoManual || '';

    // 3. Montar linhas validadas
    const camposDestino = state.terceiroTurno
        ? ['data','entrada1','saida1','entrada2','saida2','entrada3','saida3']
        : ['data','entrada1','saida1','entrada2','saida2'];

    const erros = [];
    const linhasValidas = [];

    state.rawRows.forEach((row, ri) => {
        const dataVal = row[state.mapping.data] || '';
        if (!dataVal) return; // pula linhas sem data

        const obj = { data: dataVal };
        camposDestino.slice(1).forEach(c => {
            obj[c] = state.mapping[c] ? (row[state.mapping[c]] || '') : '';
        });

        if (!validarData(obj.data)) erros.push(`Linha ${ri + 1}: data inválida "${obj.data}"`);
        ['entrada1','saida1','entrada2','saida2','entrada3','saida3'].forEach(c => {
            if (obj[c] && !validarHora(obj[c]))
                erros.push(`Linha ${ri + 1}: horário inválido em ${c} "${obj[c]}"`);
        });

        linhasValidas.push(obj);
    });

    if (erros.length) {
        mostrarMsg('msgEmpregado', 'erro', 'Corrija os erros na tabela antes de exportar:\n• ' + erros.slice(0, 5).join('\n• '));
        // Marcar células inválidas na tabela
        destacarCelulasInvalidas(erros);
        return;
    }

    if (!linhasValidas.length) {
        mostrarMsg('msgEmpregado', 'erro', 'Nenhuma linha com data válida encontrada.');
        return;
    }

    // 4. Construir cabeçalho do Excel de saída
    const header = state.terceiroTurno
        ? ['Data','Dia da Semana','Entrada 1','Saída 1','Entrada 2','Saída 2','Entrada 3','Saída 3']
        : ['Data','Dia da Semana','Entrada 1','Saída 1','Entrada 2','Saída 2'];

    // 5. Construir linhas de dados
    const aoa = [header, ...linhasValidas.map(obj => {
        const base = [
            obj.data,
            calcularDiaSemana(obj.data),
            obj.entrada1 || '',
            obj.saida1   || '',
            obj.entrada2 || '',
            obj.saida2   || ''
        ];
        if (state.terceiroTurno) { base.push(obj.entrada3 || ''); base.push(obj.saida3 || ''); }
        return base;
    })];

    // 6. Criar workbook SheetJS
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Forçar coluna Data (col 0) como texto
    for (let r = 1; r < aoa.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: 0 });
        ws[addr] = { t: 's', v: aoa[r][0] };
    }

    const larguras = state.terceiroTurno
        ? [{wch:13},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}]
        : [{wch:13},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12}];
    ws['!cols'] = larguras;

    // Nome da aba: "{codigo} {nome}" ou "{nome}"
    const nomeAba = (codigoEmp ? codigoEmp + ' ' + nomeEmp : nomeEmp).substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);

    // 7. Gerar nome do arquivo
    const [mm, aaaa] = state.competencia.split('/');
    const nomeArq = `FolhaPonto_${codigoEmp || nomeEmp.replace(/\s/g,'_')}_${mm}-${aaaa}.xlsx`;
    XLSX.writeFile(wb, nomeArq);

    mostrarMsg('msgEmpregado', 'ok', `✓ "${nomeArq}" gerado com ${linhasValidas.length} linha(s). Importe no Controle de Frequência usando "Acrescentar".`);
};

function destacarCelulasInvalidas(erros) {
    // Highlight células com erro na tabela editável
    document.querySelectorAll('#editTbody input').forEach(inp => inp.classList.remove('invalido'));
    erros.forEach(msg => {
        const m = msg.match(/Linha (\d+)/);
        if (!m) return;
        const ri = parseInt(m[1]) - 1;
        const tr = document.querySelectorAll('#editTbody tr')[ri];
        if (tr) tr.querySelectorAll('input').forEach(i => i.classList.add('invalido'));
    });
    mostrarEtapa(3);
}
```

- [ ] **Step 2: Verificação manual — fluxo completo**

1. Carregar o modelo Excel do Controle de Frequência (`Modelo_FolhaPonto_*.xlsx`) — preencher alguns horários manualmente antes
2. Percorrer as 4 etapas: selecionar empresa, competência, carregar arquivo, revisar tabela, mapear colunas, selecionar empregado
3. Clicar "Gerar Excel" — arquivo baixado com nome `FolhaPonto_{codigo}_{nome}_{MM}-{AAAA}.xlsx`
4. Abrir o Controle de Frequência → botão "Importar Excel" → selecionar o arquivo gerado → "Acrescentar"
5. Verificar que os horários aparecem corretamente nas células da folha de ponto

- [ ] **Step 3: Teste com data inválida**

Na etapa 3, editar uma célula de data para `99/13/2026`. Avançar para etapa 4 e tentar gerar. Esperado: mensagem de erro lista a linha inválida, ferramenta volta para etapa 3 com célula destacada em vermelho.

- [ ] **Step 4: Teste sem código de empregado**

Selecionar empregado pelo nome sem código cadastrado. Gerar Excel — arquivo baixado com aba nomeada só pelo nome. Aviso amarelo exibido sobre importação automática.

- [ ] **Step 5: Commit final**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat: conversor — geração Excel + download + validações"
```

---

## Self-Review

**Cobertura do spec:**
- ✓ Wizard 4 etapas
- ✓ Empresa + competência com Supabase
- ✓ Upload com drag-drop
- ✓ Detecção automática de tipo (Excel, PDF digital, PDF escaneado, imagem)
- ✓ SheetJS para Excel/CSV com normalização de seriais de data/hora
- ✓ PDF.js para PDF digital com agrupamento por posição Y
- ✓ Tesseract.js para OCR com português
- ✓ Tabela HTML editável com add/remove linha
- ✓ Mapeamento de colunas com fuzzy detect
- ✓ Toggle 3º turno
- ✓ Empregado por nome (código opcional)
- ✓ Aviso quando sem código
- ✓ Validação de data (DD/MM/AAAA) e hora (HH:MM)
- ✓ Células inválidas destacadas em vermelho com retorno à etapa 3
- ✓ Geração Excel com SheetJS: aba nomeada `{codigo} {nome}`, datas como texto, larguras de coluna
- ✓ Dia da Semana calculado pela ferramenta
- ✓ Nome do arquivo `FolhaPonto_{codigo}_{nome}_{MM}-{AAAA}.xlsx`
- ✓ Link no sidebar de `index.html`
- ✓ Autenticação `PortalAuthGuard.init(1)`

**Consistência de tipos:**
- `state.rawRows` é `Record<string,string>[]` — usado consistentemente em Tasks 4–10
- `state.mapping` usa labels (strings) não índices — consistente em Tasks 8 e 10
- `parsearTextoPDF` (Task 5) retorna `{headers: string[], rows}` — consumido por Tasks 5 e 6
- `renderizarTabela` (Task 7) usa `state.headers` e `state.rawRows` — escritos pelas Tasks 4/5/6

**Sem placeholders:** todas as funções têm implementação completa.
