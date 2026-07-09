# Grupos de Empresas — Lote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar grupos de empresas nomeados e persistidos, com tela própria no menu lateral, e três ações em lote sobre o grupo: baixar modelos Excel (.zip), processar folhas via upload de Excels preenchidos e exportar TXT do grupo.

**Architecture:** Duas tabelas novas no Supabase (`rh_grupos_empresas`, `rh_grupos_empresas_itens`). Tela nova (`gruposScreen`) reaproveitando os padrões visuais e de busca de empresa já usados no projeto. O processamento em lote reaproveita `calcularFolha` e `gerarDiasDoMes` sem alterá-las, aplicando a configuração por empresa (jornada, regra 100%, 3 turnos) via mutação temporária de `state` a cada empresa do lote, com snapshot/restore. A exportação de TXT do grupo reaproveita o modal e a lógica de exportação já existentes, apenas pré-populando a lista de empresas.

**Tech Stack:** HTML/JS vanilla, Supabase JS client, SheetJS (`xlsx`, já presente), JSZip (nova dependência via CDN). Sem suite de testes automatizados.

## Global Constraints

- Não alterar o comportamento do fluxo single-empresa existente (`selecionarEmpresa`, `processarFolhaComSalvamento`, `gerarModeloExcel`, `abrirModalExportacaoTXT`) — todas as funções novas são aditivas.
- Flags de dia (folga/falta/atestado/compensação/DSR) **não** fazem parte do upload em lote — fora de escopo, documentado na spec.
- Booleans em `rh_config_rubricas_txt` já seguem o padrão `'1'`/`'0'` (spec anterior); reaproveitar as mesmas chaves de evento (`jornada_diaria`, `jornada_sexta_ativa`, `jornada_sexta`, `jornada_sabado_ativa`, `jornada_sabado`, `sabado_sempre_extra`, `rule_extra_100_opcional`, `terceiro_turno`).
- Validação via `node --check <arquivo>` após cada edição de `script.js`; verificação manual documentada em cada task (sem suite automatizada neste projeto).
- Nome de arquivo de modelo mantém o padrão existente: `Modelo_FolhaPonto_{codEmp}_{mm}-{aaaa}.xlsx`.

---

## Task 1: Banco de dados — tabelas de grupos

**Files:**
- Modify: `Projeto RH/schema_rh.sql` (inserir antes do comentário `-- 9. TABELA: rh_feriados`)

**Interfaces:**
- Produces: tabelas `rh_grupos_empresas (id, nome_grupo)` e `rh_grupos_empresas_itens (id, grupo_id, codigo_empresa)`, consumidas por todas as tasks seguintes via `supabaseClient.from(...)`.

- [ ] **Step 1: Adicionar as tabelas ao schema**

Localizar o comentário `-- 9. TABELA: rh_feriados` em `schema_rh.sql` e inserir imediatamente antes:

```sql
-- ============================================================
-- TABELA: rh_grupos_empresas
--    Grupos nomeados de empresas para operações em lote.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_grupo  TEXT NOT NULL UNIQUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_grupos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_grupos_empresas: leitura autenticado" ON public.rh_grupos_empresas;
DROP POLICY IF EXISTS "rh_grupos_empresas: escrita autenticado" ON public.rh_grupos_empresas;

CREATE POLICY "rh_grupos_empresas: leitura autenticado"
    ON public.rh_grupos_empresas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas: escrita autenticado"
    ON public.rh_grupos_empresas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- TABELA: rh_grupos_empresas_itens
--    Empresas pertencentes a cada grupo.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas_itens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id       UUID NOT NULL REFERENCES public.rh_grupos_empresas(id) ON DELETE CASCADE,
    codigo_empresa TEXT NOT NULL,
    CONSTRAINT rh_grupo_item_uniq UNIQUE (grupo_id, codigo_empresa)
);

CREATE INDEX IF NOT EXISTS idx_rh_grupo_itens_grupo ON public.rh_grupos_empresas_itens (grupo_id);

ALTER TABLE public.rh_grupos_empresas_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_grupos_empresas_itens: leitura autenticado" ON public.rh_grupos_empresas_itens;
DROP POLICY IF EXISTS "rh_grupos_empresas_itens: escrita autenticado" ON public.rh_grupos_empresas_itens;

CREATE POLICY "rh_grupos_empresas_itens: leitura autenticado"
    ON public.rh_grupos_empresas_itens FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas_itens: escrita autenticado"
    ON public.rh_grupos_empresas_itens FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

```

- [ ] **Step 2: Aplicar o schema no Supabase**

Executar o bloco SQL acima diretamente no SQL Editor do projeto Supabase correspondente ao Controle de Frequência (fora do escopo de comandos deste plano — ação manual do operador/uma vez, documentar no commit que a migration precisa ser aplicada).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/schema_rh.sql"
git commit -m "feat: adiciona tabelas de grupos de empresas ao schema"
```

---

## Task 2: Navegação — sidebar, tela `gruposScreen` (shell) e dependência JSZip

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js:2563-2582` (`mostrarTela`)

**Interfaces:**
- Produces: elementos `#gruposScreen`, `#listaGrupos`, `#grupoDetalhe`, `#loteResumoModal`, `#loteResumoConteudo`, `#grpBuscaEmpresaResultados` — consumidos pelas Tasks 3-6.

- [ ] **Step 1: Adicionar script do JSZip**

Em `index.html`, logo após a linha do `xlsx.full.min.js`:

```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

- [ ] **Step 2: Adicionar item na sidebar**

Após o link "Conversor de Folha" (dentro de `<nav class="sidebar-nav">`):

```html
        <a class="sidebar-item" href="conversor.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📄</span> Conversor de Folha
        </a>
        <button class="sidebar-item" onclick="mostrarTela('gruposScreen')">
            <span class="sidebar-item-icon">👥</span> Grupos de Empresas
        </button>
    </nav>
```

- [ ] **Step 3: Adicionar a tela `gruposScreen`**

Após o fechamento de `resultsScreen` (`</div>` na linha 227) e antes do fechamento do `.container` (linha 229):

```html
        </div>

        <!-- TELA DE GRUPOS DE EMPRESAS -->
        <div id="gruposScreen" style="display: none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
                <h2 style="color: var(--primary-color); margin:0;">👥 Grupos de Empresas</h2>
                <button type="button" class="btn btn-primary btn-small" onclick="novoGrupo()">➕ Novo Grupo</button>
            </div>
            <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">
                <div style="flex: 0 0 260px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                    <div id="listaGrupos"></div>
                </div>
                <div style="flex: 1 1 420px; border:1px solid var(--border-color); border-radius:8px; padding:16px;" id="grupoDetalhe">
                    <p style="color: var(--text-secondary); font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>
                </div>
            </div>
        </div>

    </div>
```

(a linha `</div>` original que fechava o `.container` — reaproveitada no fim do bloco acima; remover a duplicata da linha original)

- [ ] **Step 4: Adicionar modal de resumo do lote**

Em qualquer ponto da seção `<!-- ================= MODAIS ================= -->` (ex.: logo após o fechamento do `valoresVaVtModal`):

```html
    <!-- MODAL: RESUMO DO PROCESSAMENTO EM LOTE -->
    <div id="loteResumoModal" class="modal">
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h3 style="margin:0;">📊 Resumo do Processamento em Lote</h3>
                <button type="button" class="modal-close" onclick="document.getElementById('loteResumoModal').classList.remove('active')">×</button>
            </div>
            <div class="modal-body" style="padding:20px;">
                <div id="loteResumoConteudo"></div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; padding:15px 20px; border-top:1px solid #eee;">
                <button type="button" class="btn btn-primary" onclick="document.getElementById('loteResumoModal').classList.remove('active')">Fechar</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 5: Adicionar dropdown de busca de empresa do grupo**

Junto aos demais dropdowns fixos (`buscaEmpresaResultados`, `cfgBuscaEmpresaResultados`, `vvBuscaEmpresaResultados`), antes de `<script src="script.js">`:

```html
    <div id="grpBuscaEmpresaResultados" style="
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

- [ ] **Step 6: Atualizar `mostrarTela` para incluir a nova tela**

Em `script.js`, localizar:

```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
```

Substituir por:

```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('gruposScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    if (telaId === 'gruposScreen') carregarGrupos();
```

(`carregarGrupos` é implementada na Task 3; a função ficará indefinida até lá — normal, será resolvida na mesma sessão de implementação antes de qualquer teste manual)

- [ ] **Step 7: Adicionar fechamento do dropdown do grupo ao handler de clique global**

Localizar em `script.js`:

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

Substituir por (adiciona o terceiro par):

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
    const grpBox   = document.getElementById('grpBuscaEmpresaResultados');
    const grpInput = document.getElementById('grpBuscaEmpresa');
    if (grpBox && grpInput && !grpBox.contains(e.target) && e.target !== grpInput) {
        grpBox.style.display = 'none';
    }
});
```

- [ ] **Step 8: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 9: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adiciona navegacao e shell da tela de grupos de empresas"
```

---

## Task 3: CRUD de grupos

**Files:**
- Modify: `Projeto RH/script.js` (novo bloco de funções, sugerido logo após `_limparCamposConfigRubricas` ou ao final do arquivo antes de `document.addEventListener('DOMContentLoaded', ...)`; qualquer ponto no escopo top-level do arquivo funciona em JS por hoisting de `function`)

**Interfaces:**
- Consumes: `state.empresas` (já carregado por `carregarEmpresas()` no `DOMContentLoaded`), `supabaseClient`, `mostrarMensagem`, `formatarCompetencia`.
- Produces: `_grupos` (array), `_grupoAtual` (objeto `{id, nome_grupo, empresas: [{codigo_empresa, nome_empresa}]}` ou `null`), funções `carregarGrupos()`, `novoGrupo()`, `selecionarGrupo(id)`, `salvarGrupo()`, `excluirGrupo()`, `_renderGrupoDetalhe()` — consumidos pelas Tasks 4-6.

- [ ] **Step 1: Adicionar o bloco de CRUD de grupos**

```js
// --- GRUPOS DE EMPRESAS ---
let _grupos = [];
let _grupoAtual = null;

async function carregarGrupos() {
    try {
        const { data: grupos, error: errG } = await supabaseClient
            .from('rh_grupos_empresas')
            .select('id, nome_grupo')
            .order('nome_grupo', { ascending: true });
        if (errG) throw errG;
        const { data: itens, error: errI } = await supabaseClient
            .from('rh_grupos_empresas_itens')
            .select('grupo_id, codigo_empresa');
        if (errI) throw errI;
        const contagem = {};
        (itens || []).forEach(it => { contagem[it.grupo_id] = (contagem[it.grupo_id] || 0) + 1; });
        _grupos = (grupos || []).map(g => ({ ...g, qtdEmpresas: contagem[g.id] || 0 }));
        renderizarListaGrupos();
    } catch (erro) {
        console.error('Erro ao carregar grupos:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar grupos de empresas.');
    }
}

function renderizarListaGrupos() {
    const container = document.getElementById('listaGrupos');
    if (!container) return;
    if (_grupos.length === 0) {
        container.innerHTML = '<div style="padding:14px; color: var(--text-secondary); font-size:13px;">Nenhum grupo cadastrado.</div>';
        return;
    }
    container.innerHTML = _grupos.map(g => `
        <div onclick="selecionarGrupo('${g.id}')"
            style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f0f0f0; ${_grupoAtual?.id === g.id ? 'background:#f5f5f5; font-weight:600;' : ''}">
            ${g.nome_grupo} <span style="color: var(--text-secondary);">(${g.qtdEmpresas})</span>
        </div>
    `).join('');
}

function novoGrupo() {
    _grupoAtual = { id: null, nome_grupo: '', empresas: [] };
    renderizarListaGrupos();
    _renderGrupoDetalhe();
}

async function selecionarGrupo(id) {
    const grupo = _grupos.find(g => g.id === id);
    if (!grupo) return;
    try {
        const { data: itens, error } = await supabaseClient
            .from('rh_grupos_empresas_itens')
            .select('codigo_empresa')
            .eq('grupo_id', id);
        if (error) throw error;
        const empresas = (itens || []).map(it => {
            const emp = state.empresas.find(e => e.codigo_empresa === it.codigo_empresa);
            return { codigo_empresa: it.codigo_empresa, nome_empresa: emp?.nome_empresa || it.codigo_empresa };
        });
        _grupoAtual = { id: grupo.id, nome_grupo: grupo.nome_grupo, empresas };
        renderizarListaGrupos();
        _renderGrupoDetalhe();
    } catch (erro) {
        console.error('Erro ao carregar empresas do grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar as empresas do grupo.');
    }
}

function _renderGrpEmpresasList() {
    const container = document.getElementById('grpEmpresasList');
    if (!container) return;
    if (_grupoAtual.empresas.length === 0) {
        container.innerHTML = '<div style="padding:10px; color: var(--text-secondary); font-size:13px;">Nenhuma empresa adicionada.</div>';
        return;
    }
    container.innerHTML = _grupoAtual.empresas.map(e => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid #f0f0f0; font-size:13px;">
            <span><strong>${e.codigo_empresa}</strong> - ${e.nome_empresa}</span>
            <button type="button" class="btn btn-danger btn-small" style="padding:2px 8px; font-size:11px;" onclick="removerEmpresaGrupo('${e.codigo_empresa}')">remover</button>
        </div>
    `).join('');
}

function removerEmpresaGrupo(codigo) {
    _grupoAtual.empresas = _grupoAtual.empresas.filter(e => e.codigo_empresa !== codigo);
    _renderGrpEmpresasList();
}

function filtrarEmpresasGrupo(termo) {
    const box   = document.getElementById('grpBuscaEmpresaResultados');
    const input = document.getElementById('grpBuscaEmpresa');
    if (!box || !input) return;
    const rect = input.getBoundingClientRect();
    box.style.top   = (rect.bottom + 2) + 'px';
    box.style.left  = rect.left + 'px';
    box.style.width = rect.width + 'px';
    const norm = termo.trim().toLowerCase();
    const lista = norm
        ? state.empresas.filter(e => e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
        : state.empresas;
    if (!lista.length) {
        box.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:13px;">Nenhuma empresa encontrada</div>';
        box.style.display = 'block';
        return;
    }
    box.innerHTML = lista.map(e => `
        <div onclick="adicionarEmpresaGrupo('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

function adicionarEmpresaGrupo(codigo, nome) {
    if (!_grupoAtual.empresas.some(e => e.codigo_empresa === codigo)) {
        _grupoAtual.empresas.push({ codigo_empresa: codigo, nome_empresa: nome });
    }
    document.getElementById('grpBuscaEmpresa').value = '';
    document.getElementById('grpBuscaEmpresaResultados').style.display = 'none';
    _renderGrpEmpresasList();
}

async function salvarGrupo() {
    const nome = (document.getElementById('grpNome')?.value || '').trim();
    if (!nome) { mostrarMensagem('Aviso', 'Informe o nome do grupo.'); return; }
    try {
        let grupoId = _grupoAtual.id;
        if (grupoId) {
            const { error } = await supabaseClient.from('rh_grupos_empresas').update({ nome_grupo: nome }).eq('id', grupoId);
            if (error) throw error;
        } else {
            const { data, error } = await supabaseClient.from('rh_grupos_empresas').insert({ nome_grupo: nome }).select('id').single();
            if (error) throw error;
            grupoId = data.id;
        }
        const { error: errDel } = await supabaseClient.from('rh_grupos_empresas_itens').delete().eq('grupo_id', grupoId);
        if (errDel) throw errDel;
        if (_grupoAtual.empresas.length > 0) {
            const { error: errIns } = await supabaseClient.from('rh_grupos_empresas_itens')
                .insert(_grupoAtual.empresas.map(e => ({ grupo_id: grupoId, codigo_empresa: e.codigo_empresa })));
            if (errIns) throw errIns;
        }
        mostrarMensagem('Sucesso', '✅ Grupo salvo com sucesso!');
        await carregarGrupos();
        await selecionarGrupo(grupoId);
    } catch (erro) {
        console.error('Erro ao salvar grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao salvar o grupo: ' + erro.message);
    }
}

async function excluirGrupo() {
    if (!_grupoAtual?.id) return;
    if (!confirm(`Excluir o grupo "${_grupoAtual.nome_grupo}"?`)) return;
    try {
        const { error } = await supabaseClient.from('rh_grupos_empresas').delete().eq('id', _grupoAtual.id);
        if (error) throw error;
        _grupoAtual = null;
        await carregarGrupos();
        _renderGrupoDetalhe();
        mostrarMensagem('Sucesso', '✅ Grupo excluído com sucesso!');
    } catch (erro) {
        console.error('Erro ao excluir grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao excluir o grupo: ' + erro.message);
    }
}

function _renderGrupoDetalhe() {
    const container = document.getElementById('grupoDetalhe');
    if (!container) return;
    if (!_grupoAtual) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>';
        return;
    }
    container.innerHTML = `
        <div class="form-group" style="margin-bottom:14px;">
            <label>Nome do Grupo</label>
            <input type="text" id="grpNome" value="${_grupoAtual.nome_grupo.replace(/"/g, '&quot;')}" placeholder="Ex: Grupo Shopping X" style="width:100%; box-sizing:border-box;">
        </div>
        <div class="form-group" style="margin-bottom:8px;">
            <label>Empresas do Grupo</label>
            <input type="text" id="grpBuscaEmpresa" placeholder="Digite o nome ou código da empresa..." autocomplete="off"
                oninput="filtrarEmpresasGrupo(this.value)" onfocus="filtrarEmpresasGrupo(this.value)"
                style="width:100%; box-sizing:border-box; margin-top:4px;">
        </div>
        <div id="grpEmpresasList" style="border:1px solid var(--border-color); border-radius:8px; overflow:hidden; margin-bottom:14px;"></div>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            ${_grupoAtual.id ? '<button type="button" class="btn btn-danger btn-small" onclick="excluirGrupo()">🗑 Excluir Grupo</button>' : '<span></span>'}
            <button type="button" class="btn btn-primary btn-small" onclick="salvarGrupo()">💾 Salvar Grupo</button>
        </div>
        ${_grupoAtual.id ? `
        <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
            <h4 style="margin:0 0 10px;">Ações em Lote</h4>
            <div class="form-group" style="max-width:160px;">
                <label>Competência</label>
                <input type="text" id="grpCompetencia" placeholder="MM/AAAA" maxlength="7">
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
                <button type="button" class="btn btn-secondary btn-small" onclick="baixarModelosGrupo()">📥 Baixar Modelos (.zip)</button>
                <button type="button" class="btn btn-secondary btn-small" onclick="document.getElementById('grpArquivosLote').click()">📤 Processar em Lote</button>
                <input type="file" id="grpArquivosLote" multiple accept=".xlsx" style="display:none;" onchange="processarLoteGrupo(this.files)">
                <button type="button" class="btn btn-secondary btn-small" onclick="abrirExportacaoTxtGrupo()">📄 Exportar TXT do Grupo</button>
            </div>
        </div>` : ''}
    `;
    _renderGrpEmpresasList();
    const compEl = document.getElementById('grpCompetencia');
    if (compEl) compEl.addEventListener('input', e => { e.target.value = formatarCompetencia(e.target.value); });
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 3: Verificação manual**

No navegador: ir em "Grupos de Empresas", clicar "Novo Grupo", dar um nome, adicionar 2-3 empresas via busca, salvar. Confirmar que o grupo aparece na lista à esquerda com a contagem correta. Reabrir o grupo (clicar nele) e confirmar que as empresas persistiram. Remover uma empresa e salvar novamente; confirmar que a contagem atualiza. Excluir o grupo e confirmar que some da lista.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: implementa CRUD de grupos de empresas"
```

---

## Task 4: Baixar Modelos do grupo (.zip)

**Files:**
- Modify: `Projeto RH/script.js` (novo bloco, após o CRUD de grupos)

**Interfaces:**
- Consumes: `_grupoAtual`, `_buscarConfigRubricas`, `gerarDiasDoMes`, `validarCompetencia`, `mostrarMensagem`, `fecharModalMensagem`, `JSZip` (global via CDN).
- Produces: `baixarModelosGrupo()`.

- [ ] **Step 1: Adicionar a função**

```js
// --- AÇÕES EM LOTE: MODELOS ---
async function baixarModelosGrupo() {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de baixar os modelos.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de baixar os modelos.'); return; }
    if (_grupoAtual.empresas.length === 0) { mostrarMensagem('Aviso', 'O grupo não possui empresas.'); return; }

    mostrarMensagem('Aguarde', 'Gerando modelos do grupo...');
    const zip = new JSZip();
    const avisos = [];
    const diasDoMes = gerarDiasDoMes(comp);
    const [mm, aaaa] = comp.split('/');

    for (const empresa of _grupoAtual.empresas) {
        try {
            const { data: empregados, error } = await supabaseClient
                .from('rh_empregados')
                .select('codigo_empregado, nome_empregado')
                .eq('codigo_empresa', empresa.codigo_empresa)
                .order('nome_empregado', { ascending: true });
            if (error) throw error;
            if (!empregados || empregados.length === 0) {
                avisos.push(`${empresa.codigo_empresa} - ${empresa.nome_empresa}: sem empregados cadastrados.`);
                continue;
            }
            const cfg = await _buscarConfigRubricas(empresa.codigo_empresa);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';

            const wb = XLSX.utils.book_new();
            empregados.forEach(emp => {
                const nomeSheet = `${emp.codigo_empregado} ${emp.nome_empregado}`.substring(0, 31);
                const header = comTerceiroTurno
                    ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
                    : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
                const rows = [header, ...diasDoMes.map(d => comTerceiroTurno
                    ? [d.data, d.diaSemana, '', '', '', '', '', '']
                    : [d.data, d.diaSemana, '', '', '', ''])];
                const ws = XLSX.utils.aoa_to_sheet(rows);
                for (let r = 1; r < rows.length; r++) {
                    const addr = XLSX.utils.encode_cell({ r, c: 0 });
                    ws[addr] = { t: 's', v: rows[r][0] };
                }
                ws['!cols'] = comTerceiroTurno
                    ? [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
                    : [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
                XLSX.utils.book_append_sheet(wb, ws, nomeSheet);
            });

            const binario = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            zip.file(`Modelo_FolhaPonto_${empresa.codigo_empresa}_${mm}-${aaaa}.xlsx`, binario);
        } catch (erro) {
            console.error('Erro ao gerar modelo para', empresa.codigo_empresa, erro);
            avisos.push(`${empresa.codigo_empresa} - ${empresa.nome_empresa}: erro ao gerar modelo (${erro.message}).`);
        }
    }

    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Modelos_${_grupoAtual.nome_grupo}_${mm}-${aaaa}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalMensagem();
        if (avisos.length > 0) {
            mostrarMensagem('Concluído com avisos', 'Zip gerado. Empresas puladas:\n' + avisos.join('\n'));
        } else {
            mostrarMensagem('Sucesso', 'Modelos do grupo gerados e baixados com sucesso!');
        }
    } catch (erro) {
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar o arquivo zip: ' + erro.message);
    }
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 3: Verificação manual**

No grupo criado na Task 3 (com empresas que tenham empregados cadastrados), informar competência e clicar "Baixar Modelos (.zip)". Confirmar que baixa um `.zip` contendo um `.xlsx` por empresa, com o nome no padrão `Modelo_FolhaPonto_{codEmp}_{mm}-{aaaa}.xlsx`, e que o layout de colunas respeita a config de 3 turnos de cada empresa (comparar com uma empresa configurada com 3 turnos na Parte 1, se disponível).

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adiciona download de modelos em lote (zip) para o grupo"
```

---

## Task 5: Exportar TXT do grupo

**Files:**
- Modify: `Projeto RH/script.js` (novo bloco, após a Task 4)

**Interfaces:**
- Consumes: `abrirModalExportacaoTXT` (existente, sem alteração de assinatura), `buscarEmpresasParaExportacao`/`renderizarListaEmpresasExportacao` (existentes), `validarCompetencia`, `state.empresas`.
- Produces: `buscarEmpresasParaExportacaoGrupo(codigosGrupo)`, `abrirExportacaoTxtGrupo()`.

- [ ] **Step 1: Adicionar as funções**

```js
// --- AÇÕES EM LOTE: EXPORTAÇÃO TXT ---
async function buscarEmpresasParaExportacaoGrupo(codigosGrupo) {
    const comp = document.getElementById('exportCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Erro', 'Competência inválida.'); return; }
    try {
        const { data, error } = await supabaseClient.from('rh_saves').select('empresa_codigo').eq('competencia', comp);
        if (error) throw error;
        const codigosUnicos = [...new Set(data.map(item => item.empresa_codigo))].filter(c => codigosGrupo.includes(c));
        if (codigosUnicos.length === 0) { mostrarMensagem('Aviso', 'Nenhuma empresa do grupo possui dados processados para esta competência.'); return; }
        const empresasFiltradas = state.empresas.filter(emp => codigosUnicos.includes(emp.codigo_empresa));
        renderizarListaEmpresasExportacao(empresasFiltradas);
    } catch (erro) {
        console.error('Erro ao buscar empresas do grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao buscar empresas do grupo com dados processados.');
    }
}

async function abrirExportacaoTxtGrupo() {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de exportar o TXT.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de exportar o TXT do grupo.'); return; }
    await abrirModalExportacaoTXT();
    document.getElementById('exportCompetencia').value = comp;
    const codigosGrupo = _grupoAtual.empresas.map(e => e.codigo_empresa);
    await buscarEmpresasParaExportacaoGrupo(codigosGrupo);
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 3: Verificação manual**

Pré-requisito: pelo menos uma empresa do grupo já ter dados processados para a competência informada (usar a tela single-empresa normal para processar uma folha de teste, ou aguardar a Task 6). Clicar "Exportar TXT do Grupo" e confirmar que o modal `exportTxtModal` abre com a lista de empresas já pré-marcada, restrita às empresas do grupo com dados na competência.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adiciona exportacao de TXT em lote para o grupo"
```

---

## Task 6: Processar em Lote (upload de Excels preenchidos)

**Files:**
- Modify: `Projeto RH/script.js` (novo bloco, após a Task 5)

**Interfaces:**
- Consumes: `_grupoAtual`, `_buscarConfigRubricas`, `gerarDiasDoMes`, `calcularFolha`, `validarCompetencia`, `mostrarMensagem`, `fecharModalMensagem`, `state` (mutado temporariamente e restaurado).
- Produces: `processarLoteGrupo(fileList)`, `_mostrarResumoLote(resultados, nomeEmpresaFn)`.

- [ ] **Step 1: Adicionar as funções**

```js
// --- AÇÕES EM LOTE: PROCESSAMENTO ---
async function processarLoteGrupo(fileList) {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de processar em lote.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de processar em lote.'); return; }
    const arquivos = Array.from(fileList || []);
    if (arquivos.length === 0) return;

    const [compMM, compAAAA] = comp.split('/');
    const codigosGrupo = _grupoAtual.empresas.map(e => e.codigo_empresa);
    const nomeEmpresa = codigo => _grupoAtual.empresas.find(e => e.codigo_empresa === codigo)?.nome_empresa || codigo;

    const resultados = [];
    const arquivosValidos = [];
    const codigosComArquivo = new Set();

    arquivos.forEach(file => {
        const m = file.name.match(/^Modelo_FolhaPonto_(.+)_(\d{2})-(\d{4})\.xlsx$/i);
        if (!m) {
            resultados.push({ codigo: file.name, status: 'erro', detalhe: 'Nome de arquivo inválido.' });
            return;
        }
        const [, codEmp, mm, aaaa] = m;
        if (mm !== compMM || aaaa !== compAAAA) {
            resultados.push({ codigo: codEmp, status: 'erro', detalhe: `Competência do arquivo (${mm}/${aaaa}) não confere com ${comp}.` });
            return;
        }
        if (!codigosGrupo.includes(codEmp)) {
            resultados.push({ codigo: codEmp, status: 'erro', detalhe: 'Empresa não pertence ao grupo.' });
            return;
        }
        if (codigosComArquivo.has(codEmp)) {
            resultados.push({ codigo: codEmp, status: 'erro', detalhe: 'Arquivo duplicado para esta empresa (ignorado).' });
            return;
        }
        codigosComArquivo.add(codEmp);
        arquivosValidos.push({ codigo: codEmp, file });
    });

    mostrarMensagem('Processando', `Processando ${arquivosValidos.length} empresa(s)...`);

    const normalizeHora = (v) => {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number') {
            const total = Math.round(v * 24 * 60);
            const h = Math.floor(total / 60) % 24;
            const m2 = total % 60;
            return `${String(h).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
        }
        const s = String(v).trim();
        const match = s.match(/^(\d{1,2}):(\d{2})/);
        return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
    };

    const snapshot = {
        jornada: state.jornada, jornadaSexta: state.jornadaSexta, jornadaSextaAtiva: state.jornadaSextaAtiva,
        jornadaSabado: state.jornadaSabado, jornadaSabadoAtiva: state.jornadaSabadoAtiva,
        sabadoSempreExtra: state.sabadoSempreExtra, ruleExtra100Optional: state.ruleExtra100Optional,
        terceiroTurno: state.terceiroTurno, folhas: state.folhas, competencia: state.competencia,
        empresaSelecionada: state.empresaSelecionada
    };
    state.competencia = comp;

    const usuarioUUID = '00000000-0000-0000-0000-000000000000';
    const nomeResponsavel = 'Processamento em Lote';

    for (const { codigo, file } of arquivosValidos) {
        try {
            const { data: empregados, error: errEmp } = await supabaseClient
                .from('rh_empregados')
                .select('codigo_empregado, nome_empregado')
                .eq('codigo_empresa', codigo);
            if (errEmp) throw errEmp;
            if (!empregados || empregados.length === 0) {
                resultados.push({ codigo, status: 'erro', detalhe: 'Empresa sem empregados cadastrados.' });
                continue;
            }

            const cfg = await _buscarConfigRubricas(codigo);
            state.jornada            = cfg?.['jornada_diaria']?.cod || '08:00';
            state.jornadaSextaAtiva  = cfg?.['jornada_sexta_ativa']?.cod === '1';
            state.jornadaSexta       = cfg?.['jornada_sexta']?.cod || '04:00';
            const sempreExtra        = cfg?.['sabado_sempre_extra']?.cod === '1';
            state.sabadoSempreExtra  = sempreExtra;
            state.jornadaSabadoAtiva = !sempreExtra && cfg?.['jornada_sabado_ativa']?.cod === '1';
            state.jornadaSabado      = cfg?.['jornada_sabado']?.cod || '04:00';
            state.ruleExtra100Optional = cfg?.['rule_extra_100_opcional']?.cod === '1';
            state.terceiroTurno      = cfg?.['terceiro_turno']?.cod === '1';

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

            const folhasEmpresa = [];
            const avisosAbas = [];
            wb.SheetNames.forEach(sheetName => {
                const codEmpregado = sheetName.split(' ')[0].trim();
                const empregado = empregados.find(e => e.codigo_empregado === codEmpregado);
                if (!empregado) { avisosAbas.push(`aba "${sheetName}" sem correspondência`); return; }

                const folha = { empregadoId: empregado.codigo_empregado, nome: empregado.nome_empregado, dados: gerarDiasDoMes(state.competencia), dsrDias: [], flagsFolga: {} };
                const linhas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
                for (let r = 1; r < linhas.length; r++) {
                    const row = linhas[r];
                    if (!row || !row[0]) continue;
                    const dataStr = String(row[0]).trim();
                    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) continue;
                    const diaIdx = folha.dados.findIndex(d => d.data === dataStr);
                    if (diaIdx === -1) continue;
                    folha.dados[diaIdx].entrada1 = normalizeHora(row[2]);
                    folha.dados[diaIdx].saida1   = normalizeHora(row[3]);
                    folha.dados[diaIdx].entrada2 = normalizeHora(row[4]);
                    folha.dados[diaIdx].saida2   = normalizeHora(row[5]);
                    if (state.terceiroTurno) {
                        folha.dados[diaIdx].entrada3 = normalizeHora(row[6]);
                        folha.dados[diaIdx].saida3   = normalizeHora(row[7]);
                    }
                }
                folhasEmpresa.push(folha);
            });

            if (folhasEmpresa.length === 0) {
                resultados.push({ codigo, status: 'erro', detalhe: 'Nenhum empregado correspondente encontrado no arquivo.' });
                continue;
            }

            const dadosParaSalvar = folhasEmpresa.map(folha => {
                calcularFolha(folha);
                return {
                    usuario_id: usuarioUUID,
                    empresa_codigo: codigo,
                    nome_trabalhador: folha.nome,
                    competencia: state.competencia,
                    jornada: state.jornada,
                    jornada_sexta: state.jornadaSextaAtiva ? state.jornadaSexta : null,
                    jornada_sexta_ativa: state.jornadaSextaAtiva,
                    jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                    jornada_sabado_ativa: state.jornadaSabadoAtiva,
                    sabado_sempre_extra: state.sabadoSempreExtra,
                    rule_extra_100_opcional: state.ruleExtra100Optional,
                    dados_json: JSON.stringify(folha.dados),
                    feriados_json: JSON.stringify(state.feriados),
                    dsr_dias: JSON.stringify(folha.dsrDias),
                    flags_folga: JSON.stringify(folha.flagsFolga),
                    responsavel_alteracao: nomeResponsavel,
                    status: 'finalizado',
                    criado_por: nomeResponsavel,
                    atualizado_por: nomeResponsavel,
                    nome_usuario: nomeResponsavel
                };
            });

            const { error: errSave } = await supabaseClient.from('rh_saves').upsert(dadosParaSalvar, { onConflict: 'empresa_codigo,nome_trabalhador,competencia' });
            if (errSave) throw errSave;

            const detalhe = avisosAbas.length > 0
                ? `${folhasEmpresa.length} empregado(s) processado(s). Avisos: ${avisosAbas.join('; ')}.`
                : `${folhasEmpresa.length} empregado(s) processado(s).`;
            resultados.push({ codigo, status: 'ok', detalhe });
        } catch (erro) {
            console.error('Erro ao processar empresa em lote', codigo, erro);
            resultados.push({ codigo, status: 'erro', detalhe: erro.message || 'Erro desconhecido.' });
        }
    }

    codigosGrupo.forEach(codigo => {
        if (!codigosComArquivo.has(codigo)) {
            resultados.push({ codigo, status: 'sem-arquivo', detalhe: '—' });
        }
    });

    Object.assign(state, snapshot);

    fecharModalMensagem();
    _mostrarResumoLote(resultados, nomeEmpresa);
}

function _mostrarResumoLote(resultados, nomeEmpresaFn) {
    const iconePorStatus = { ok: '✅', erro: '⚠️', 'sem-arquivo': '⬜' };
    const rotuloPorStatus = { ok: 'Processada', erro: 'Erro', 'sem-arquivo': 'Sem arquivo enviado' };
    const linhas = resultados.map(r => `
        <div style="display:grid; grid-template-columns: 1.4fr 1fr 2fr; gap:10px; padding:8px 0; border-bottom:1px solid #eee; font-size:13px;">
            <span>${nomeEmpresaFn(r.codigo)}</span>
            <span>${iconePorStatus[r.status]} ${rotuloPorStatus[r.status]}</span>
            <span style="color: var(--text-secondary);">${r.detalhe}</span>
        </div>
    `).join('');
    document.getElementById('loteResumoConteudo').innerHTML = linhas || '<p>Nenhum resultado.</p>';
    document.getElementById('loteResumoModal').classList.add('active');
    const inputArquivos = document.getElementById('grpArquivosLote');
    if (inputArquivos) inputArquivos.value = '';
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 3: Verificação manual**

Usando os modelos baixados na Task 4, preencher horários de pelo menos 2 empresas do grupo e testar os seguintes casos no upload em lote:
1. Todos os arquivos corretos → resumo mostra "✅ Processada" para cada uma, com a contagem certa de empregados.
2. Renomear um arquivo para um código de empresa fora do grupo → resumo mostra "⚠️ Erro: Empresa não pertence ao grupo".
3. Não enviar o arquivo de uma das empresas do grupo → resumo mostra "⬜ Sem arquivo enviado" para ela.
4. Após o processamento, abrir a tela single-empresa normal (fora do grupo) e confirmar que `state` voltou ao normal (jornada/turnos não ficaram "vazados" de alguma empresa do lote).
5. Confirmar no Supabase (`rh_saves`) que os dados das empresas processadas com sucesso foram salvos com os campos de jornada/regra 100%/turnos corretos para cada empresa.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adiciona processamento em lote via upload de excels para o grupo"
```

---

## Self-Review

**Spec coverage:**
- Grupo salvo e nomeado, gestão via tela própria no menu → Task 2, Task 3. ✅
- Baixar modelos do grupo em .zip → Task 4. ✅
- Processar em lote via upload de Excels preenchidos, com config por empresa aplicada automaticamente e resumo de status → Task 6. ✅
- Exportar TXT do grupo reaproveitando o modal existente → Task 5. ✅
- Flags de dia fora de escopo do lote → não implementado em nenhuma task (correto, por decisão explícita).

**Placeholder scan:** nenhum "TBD"/"TODO" — todo código está completo. A única ressalva documentada explicitamente (Task 2, Step 6) é a dependência de ordem de carregamento entre `mostrarTela` e `carregarGrupos`, resolvida na mesma sessão de implementação antes de qualquer teste.

**Type consistency:** `_grupoAtual.empresas` como `{codigo_empresa, nome_empresa}[]` usado de forma consistente entre Task 3 (criação/CRUD) e Tasks 4-6 (leitura). Status de resultado (`'ok' | 'erro' | 'sem-arquivo'`) usado de forma consistente entre `processarLoteGrupo` e `_mostrarResumoLote` (Task 6).
