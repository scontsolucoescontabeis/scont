# Exclusão em Massa — Contatos e Grupo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar checkboxes e botão de exclusão/remoção em massa na tela Contatos e na tela Detalhe do Grupo.

**Architecture:** Modificação única em `index.html`. Dois Sets globais rastreiam seleções independentes (`_contatosSelecionados`, `_gcSelecionados`). Botões de ação em massa ficam no `page-header-actions` de cada seção, ocultos quando nada está selecionado. "Selecionar todos" age sobre os itens visíveis no momento (respeita filtro). Seleção persiste entre mudanças de filtro via comparação do Set com as linhas renderizadas.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2

## Global Constraints

- Arquivo único: `index.html` — sem arquivos externos adicionais
- Delete de contatos = soft delete (`ativo: false`), igual ao botão individual existente
- Remoção do grupo = delete de `mala_direta_grupo_contatos`, contatos não são apagados da base
- Seleção limpa ao navegar para outra seção

---

### Task 1: Estado global + botões no page-header-actions

**Files:**
- Modify: `index.html` (linha ~1349 para estado; linhas 260–263 para header Contatos; linhas 319–323 para header Grupo Detalhe)

**Interfaces:**
- Produces: `_contatosSelecionados: Set<string>`, `_gcSelecionados: Set<string>`, `#btn-excluir-contatos`, `#count-cont-sel`, `#btn-remover-gc`, `#count-gc-sel`

- [ ] **Step 1: Adicionar variáveis de estado após `excelEnviosRows`**

Localizar (linha ~1349):
```js
  let excelEnviosRows = [], excelContatosRows = [], excelGrupoRows = [];
```
Adicionar imediatamente após:
```js
  let _contatosSelecionados = new Set();
  let _gcSelecionados       = new Set();
```

- [ ] **Step 2: Adicionar botão de bulk delete no header de Contatos**

Localizar (linhas 260–263):
```html
          <div class="page-header-actions">
            <button class="btn btn-secondary" onclick="abrirImportarContatos()">📥 Importar Excel</button>
            <button class="btn btn-primary" onclick="openModalContato()">+ Novo Contato</button>
          </div>
```
Substituir por:
```html
          <div class="page-header-actions">
            <button class="btn btn-secondary" onclick="abrirImportarContatos()">📥 Importar Excel</button>
            <button id="btn-excluir-contatos" class="btn btn-danger" style="display:none" onclick="excluirContatosSelecionados()">🗑 Excluir selecionados (<span id="count-cont-sel">0</span>)</button>
            <button class="btn btn-primary" onclick="openModalContato()">+ Novo Contato</button>
          </div>
```

- [ ] **Step 3: Adicionar botão de bulk remove no header de Grupo Detalhe**

Localizar (linhas 319–323):
```html
          <div class="page-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="openModalGrupo(grupoAtualId)">Editar</button>
            <button class="btn btn-primary btn-sm" onclick="openModalAddGrupoContatos()">+ Adicionar Contatos</button>
            <button class="btn btn-danger btn-sm" onclick="deletarGrupoAtual()">Excluir Grupo</button>
          </div>
```
Substituir por:
```html
          <div class="page-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="openModalGrupo(grupoAtualId)">Editar</button>
            <button id="btn-remover-gc" class="btn btn-danger btn-sm" style="display:none" onclick="excluirGcSelecionados()">🗑 Remover selecionados (<span id="count-gc-sel">0</span>)</button>
            <button class="btn btn-primary btn-sm" onclick="openModalAddGrupoContatos()">+ Adicionar Contatos</button>
            <button class="btn btn-danger btn-sm" onclick="deletarGrupoAtual()">Excluir Grupo</button>
          </div>
```

- [ ] **Step 4: Atualizar colspan do estado vazio da tabela de Contatos (thead estático)**

Localizar (linhas 274–284):
```html
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Cargo</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="contatos-tbody">
                <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Carregando…</td></tr>
```
Substituir por:
```html
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" id="chk-all-cont" onchange="toggleTodosContatos(this.checked)" title="Selecionar todos"></th>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Cargo</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="contatos-tbody">
                <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Carregando…</td></tr>
```

- [ ] **Step 5: Atualizar colspan do estado vazio da tabela de Grupo Detalhe (thead estático)**

Localizar (linhas 330–340):
```html
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="grupo-contatos-tbody">
                <tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Carregando…</td></tr>
```
Substituir por:
```html
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" id="chk-all-gc" onchange="toggleTodosGc(this.checked)" title="Selecionar todos"></th>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="grupo-contatos-tbody">
                <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Carregando…</td></tr>
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: estado e HTML para exclusão em massa de contatos e grupo"
```

---

### Task 2: renderContatos() + funções de seleção de contatos

**Files:**
- Modify: `index.html` (`renderContatos` ~linha 1811; adicionar funções logo após)

**Interfaces:**
- Consumes: `_contatosSelecionados: Set<string>`, `#btn-excluir-contatos`, `#count-cont-sel`, `#chk-all-cont`
- Produces: `toggleTodosContatos(checked)`, `onSelContato()`, `_atualizarBtnExcluirContatos()`, `excluirContatosSelecionados()`

- [ ] **Step 1: Atualizar `renderContatos()` para incluir coluna de checkbox**

Localizar a função completa (linhas 1811–1837):
```js
  function renderContatos() {
    const filtro = (document.getElementById('filtro-contatos')?.value || '').toLowerCase();
    const lista  = filtro
      ? contatos.filter(c => c.nome.toLowerCase().includes(filtro) || (c.empresa||'').toLowerCase().includes(filtro))
      : contatos;
    const tbody = document.getElementById('contatos-tbody');

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--muted)">Nenhum contato cadastrado</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(c => `
      <tr>
        <td><strong style="color:var(--primary)">${esc(c.nome)}</strong></td>
        <td>${esc(c.empresa||'—')}</td>
        <td>${esc(c.cargo||'—')}</td>
        <td>${_renderEmails(c.email)}</td>
        <td>${c.telefone ? esc(c.telefone) : '—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="openModalContato('${c.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deletarContato('${c.id}')">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
```
Substituir por:
```js
  function renderContatos() {
    const filtro = (document.getElementById('filtro-contatos')?.value || '').toLowerCase();
    const lista  = filtro
      ? contatos.filter(c => c.nome.toLowerCase().includes(filtro) || (c.empresa||'').toLowerCase().includes(filtro))
      : contatos;
    const tbody = document.getElementById('contatos-tbody');

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--muted)">Nenhum contato cadastrado</td></tr>';
      _atualizarBtnExcluirContatos();
      return;
    }
    tbody.innerHTML = lista.map(c => `
      <tr>
        <td><input type="checkbox" name="sel-cont" value="${c.id}" onchange="onSelContato()" ${_contatosSelecionados.has(c.id) ? 'checked' : ''}></td>
        <td><strong style="color:var(--primary)">${esc(c.nome)}</strong></td>
        <td>${esc(c.empresa||'—')}</td>
        <td>${esc(c.cargo||'—')}</td>
        <td>${_renderEmails(c.email)}</td>
        <td>${c.telefone ? esc(c.telefone) : '—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="openModalContato('${c.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deletarContato('${c.id}')">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
    // sincronizar estado do checkbox "selecionar todos"
    const visiveisIds = lista.map(c => c.id);
    const todosSelecionados = visiveisIds.length > 0 && visiveisIds.every(id => _contatosSelecionados.has(id));
    const chkAll = document.getElementById('chk-all-cont');
    if (chkAll) chkAll.checked = todosSelecionados;
    _atualizarBtnExcluirContatos();
  }
```

- [ ] **Step 2: Adicionar funções de seleção e bulk delete de contatos — após `renderContatos()`**

Localizar a linha após o fechamento de `renderContatos` (linha ~1838, início de `// ── DESTINATÁRIOS`):
```js
  // ── DESTINATÁRIOS ─────────────────────────────────────────────
```
Inserir as funções ANTES dessa linha:
```js
  function toggleTodosContatos(checked) {
    document.querySelectorAll('input[name="sel-cont"]').forEach(cb => {
      cb.checked = checked;
      if (checked) _contatosSelecionados.add(cb.value);
      else _contatosSelecionados.delete(cb.value);
    });
    _atualizarBtnExcluirContatos();
  }

  function onSelContato() {
    _contatosSelecionados = new Set(
      [...document.querySelectorAll('input[name="sel-cont"]:checked')].map(cb => cb.value)
    );
    const total = document.querySelectorAll('input[name="sel-cont"]').length;
    const chkAll = document.getElementById('chk-all-cont');
    if (chkAll) chkAll.checked = total > 0 && _contatosSelecionados.size === total;
    _atualizarBtnExcluirContatos();
  }

  function _atualizarBtnExcluirContatos() {
    const n = _contatosSelecionados.size;
    const btn = document.getElementById('btn-excluir-contatos');
    const cnt = document.getElementById('count-cont-sel');
    if (btn) btn.style.display = n > 0 ? '' : 'none';
    if (cnt) cnt.textContent = n;
  }

  async function excluirContatosSelecionados() {
    const ids = [..._contatosSelecionados];
    if (!ids.length) return;
    if (!confirm(`Desativar ${ids.length} contato(s)? Eles não aparecerão mais na lista.`)) return;
    const { error } = await sb.from('mala_direta_contatos').update({ ativo: false }).in('id', ids);
    if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return; }
    toast(`✅ ${ids.length} contato(s) removido(s)`, 'success');
    _contatosSelecionados.clear();
    await loadContatos();
    renderContatos();
  }

```

- [ ] **Step 3: Verificar visualmente**

1. Abrir tela Contatos — nova coluna de checkboxes aparece à esquerda
2. Marcar 2 contatos → botão "🗑 Excluir selecionados (2)" aparece no header
3. Desmarcar todos → botão some
4. Marcar todos via checkbox do `<th>` → todos marcados
5. Aplicar filtro → checkbox "selecionar todos" reflete apenas os visíveis
6. Excluir selecionados → confirmação → contatos somem da lista

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: exclusão em massa de contatos com checkboxes"
```

---

### Task 3: renderGrupoContatos() + funções de seleção + limpeza na navegação

**Files:**
- Modify: `index.html` (`renderGrupoContatos` ~linha 2653; adicionar funções após; `voltarGrupos` ~linha 2674)

**Interfaces:**
- Consumes: `_gcSelecionados: Set<string>`, `#btn-remover-gc`, `#count-gc-sel`, `#chk-all-gc`, `grupoAtualId`
- Produces: `toggleTodosGc(checked)`, `onSelGc()`, `_atualizarBtnRemoverGc()`, `excluirGcSelecionados()`

- [ ] **Step 1: Atualizar `renderGrupoContatos()` para incluir coluna de checkbox**

Localizar a função completa (linhas 2653–2672):
```js
  function renderGrupoContatos() {
    const total = grupoContatosAtual.length;
    document.getElementById('gdet-card-title').textContent = `Contatos do Grupo (${total})`;
    const tbody = document.getElementById('grupo-contatos-tbody');
    if (!grupoContatosAtual.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Nenhum contato neste grupo. Clique em "+ Adicionar Contatos".</td></tr>';
      return;
    }
    tbody.innerHTML = grupoContatosAtual.map(c => `
      <tr>
        <td><strong style="color:var(--primary)">${esc(c.nome)}</strong></td>
        <td>${esc(c.empresa||'—')}</td>
        <td>${_renderEmails(c.email)}</td>
        <td>${c.telefone || '—'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="removerContatoDoGrupo('${c.id}')">Remover</button>
        </td>
      </tr>
    `).join('');
  }
```
Substituir por:
```js
  function renderGrupoContatos() {
    const total = grupoContatosAtual.length;
    document.getElementById('gdet-card-title').textContent = `Contatos do Grupo (${total})`;
    const tbody = document.getElementById('grupo-contatos-tbody');
    if (!grupoContatosAtual.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Nenhum contato neste grupo. Clique em "+ Adicionar Contatos".</td></tr>';
      _atualizarBtnRemoverGc();
      return;
    }
    tbody.innerHTML = grupoContatosAtual.map(c => `
      <tr>
        <td><input type="checkbox" name="sel-gc" value="${c.id}" onchange="onSelGc()" ${_gcSelecionados.has(c.id) ? 'checked' : ''}></td>
        <td><strong style="color:var(--primary)">${esc(c.nome)}</strong></td>
        <td>${esc(c.empresa||'—')}</td>
        <td>${_renderEmails(c.email)}</td>
        <td>${c.telefone || '—'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="removerContatoDoGrupo('${c.id}')">Remover</button>
        </td>
      </tr>
    `).join('');
    const todosSelecionados = grupoContatosAtual.length > 0 && grupoContatosAtual.every(c => _gcSelecionados.has(c.id));
    const chkAll = document.getElementById('chk-all-gc');
    if (chkAll) chkAll.checked = todosSelecionados;
    _atualizarBtnRemoverGc();
  }
```

- [ ] **Step 2: Adicionar funções de seleção e bulk remove — após `renderGrupoContatos()`**

Localizar a linha após o fechamento de `renderGrupoContatos` (linha ~2673, `function voltarGrupos`):
```js
  function voltarGrupos() {
```
Inserir ANTES:
```js
  function toggleTodosGc(checked) {
    document.querySelectorAll('input[name="sel-gc"]').forEach(cb => {
      cb.checked = checked;
      if (checked) _gcSelecionados.add(cb.value);
      else _gcSelecionados.delete(cb.value);
    });
    _atualizarBtnRemoverGc();
  }

  function onSelGc() {
    _gcSelecionados = new Set(
      [...document.querySelectorAll('input[name="sel-gc"]:checked')].map(cb => cb.value)
    );
    const total = document.querySelectorAll('input[name="sel-gc"]').length;
    const chkAll = document.getElementById('chk-all-gc');
    if (chkAll) chkAll.checked = total > 0 && _gcSelecionados.size === total;
    _atualizarBtnRemoverGc();
  }

  function _atualizarBtnRemoverGc() {
    const n = _gcSelecionados.size;
    const btn = document.getElementById('btn-remover-gc');
    const cnt = document.getElementById('count-gc-sel');
    if (btn) btn.style.display = n > 0 ? '' : 'none';
    if (cnt) cnt.textContent = n;
  }

  async function excluirGcSelecionados() {
    const ids = [..._gcSelecionados];
    if (!ids.length) return;
    if (!confirm(`Remover ${ids.length} contato(s) do grupo?`)) return;
    const { error } = await sb.from('mala_direta_grupo_contatos')
      .delete().eq('grupo_id', grupoAtualId).in('contato_id', ids);
    if (error) { toast('Erro ao remover: ' + error.message, 'error'); return; }
    toast(`✅ ${ids.length} contato(s) removido(s) do grupo`, 'success');
    _gcSelecionados.clear();
    await loadGrupoContatosAtual();
  }

```

- [ ] **Step 3: Limpar seleção ao sair do detalhe do grupo**

Localizar `voltarGrupos` (linha ~2674):
```js
  function voltarGrupos() {
    grupoAtualId = null; grupoAtual = null; grupoContatosAtual = [];
    showSection('grupos');
  }
```
Substituir por:
```js
  function voltarGrupos() {
    grupoAtualId = null; grupoAtual = null; grupoContatosAtual = [];
    _gcSelecionados.clear();
    showSection('grupos');
  }
```

- [ ] **Step 4: Verificar visualmente**

1. Abrir Grupos → entrar num grupo com contatos
2. Nova coluna de checkboxes aparece à esquerda de cada linha
3. Marcar 2 contatos → botão "🗑 Remover selecionados (2)" aparece
4. Confirmar → contatos sumem do grupo mas ainda existem em Contatos
5. Clicar "← Voltar" → ir para outro grupo → seleção limpa

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: remoção em massa de contatos do grupo com checkboxes"
```
