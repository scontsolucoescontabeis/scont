# Importar Planilha no Modal de Grupo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar seção de importação de planilha Excel ao modal Novo/Editar Grupo, inserindo contatos novos na base e vinculando todos ao grupo.

**Architecture:** Modificação única em `index.html` — HTML do `modal-grupo` recebe nova seção de import; três funções JS são adicionadas/modificadas. Reutiliza `_parseExcelFile`, `_renderPreviewExcel` e `baixarModeloExcel` já existentes.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2, XLSX.js (já carregado)

## Global Constraints

- Arquivo único: `index.html` — sem arquivos externos adicionais
- Deduplicação por e-mail (case-insensitive via `.toLowerCase()`)
- Contatos sem e-mail são sempre inseridos como novos
- No modo editar: additive (não remove contatos existentes do grupo)
- No modo criar: modal permanece aberto após salvar para permitir o import

---

### Task 1: HTML — seção de import no `modal-grupo`

**Files:**
- Modify: `index.html` (modal `modal-grupo`, linhas ~967-983)

**Interfaces:**
- Produces: `#grupo-excel-file` (input file), `#grupo-excel-preview` (div), `#grupo-import-hint` (div), `#grupo-import-resultado` (div), `#btn-import-grupo` (button)

- [ ] **Step 1: Adicionar seção de import ao modal**

Localizar o trecho abaixo (linha ~975) e adicionar a nova seção após o campo `grupo-descricao`:

```html
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="grupo-descricao" class="form-control" placeholder="Opcional">
        </div>
```

Adicionar imediatamente após:

```html
        <!-- Import via Planilha -->
        <div style="margin-top:20px;border-top:1px solid var(--border-light);padding-top:18px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">
            📥 Importar Contatos via Planilha
          </div>
          <div style="font-size:12px;color:var(--text-light);margin-bottom:10px">
            Colunas: <strong>nome</strong> (obrigatório), <code>email</code>, <code>telefone</code>, <code>empresa</code>, <code>cargo</code>
          </div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
            <input type="file" id="grupo-excel-file" accept=".xlsx,.xls" class="form-control" style="flex:1"
              onchange="previewExcelGrupo(this.files[0])">
            <button type="button" class="btn btn-secondary btn-sm" style="flex-shrink:0;white-space:nowrap"
              onclick="baixarModeloExcel('contatos')">⬇ Modelo</button>
          </div>
          <div id="grupo-excel-preview" style="margin-bottom:10px"></div>
          <div id="grupo-import-hint" style="display:none;font-size:12px;color:var(--muted);background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;padding:8px 12px;margin-bottom:10px">
            ⓘ Salve o grupo antes de importar contatos.
          </div>
          <div id="grupo-import-resultado" style="margin-bottom:10px"></div>
          <button type="button" id="btn-import-grupo" class="btn btn-primary btn-sm"
            onclick="importarContatosParaGrupo()" disabled>
            📥 Importar Contatos para o Grupo
          </button>
        </div>
```

- [ ] **Step 2: Verificar visualmente no browser**

Abrir `index.html`, ir para Grupos → "+ Novo Grupo". Confirmar que a nova seção aparece no modal com o botão desabilitado.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add import section HTML to modal-grupo"
```

---

### Task 2: JS — estado, `openModalGrupo` e `salvarGrupo`

**Files:**
- Modify: `index.html` (bloco de estado ~linha 1323, função `openModalGrupo` ~linha 2654, função `salvarGrupo` ~linha 2663)

**Interfaces:**
- Consumes: `#grupo-id`, `#grupo-excel-file`, `#grupo-excel-preview`, `#grupo-import-hint`, `#grupo-import-resultado`, `#btn-import-grupo`
- Produces: `excelGrupoRows` (array global), comportamento de modal-aberto pós-criação

- [ ] **Step 1: Adicionar variável de estado**

Na linha ~1323 (junto com `excelEnviosRows = [], excelContatosRows = []`), adicionar:

```js
let excelGrupoRows = [];
```

- [ ] **Step 2: Modificar `openModalGrupo`**

Substituir a função existente (linhas ~2654-2661):

```js
  function openModalGrupo(id) {
    const g = id ? grupos.find(x => x.id === id) : null;
    document.getElementById('grupo-id').value         = id || '';
    document.getElementById('modal-grupo-titulo').textContent = g ? 'Editar Grupo' : 'Novo Grupo';
    document.getElementById('grupo-nome').value       = g?.nome || '';
    document.getElementById('grupo-descricao').value  = g?.descricao || '';
    // reset import section
    excelGrupoRows = [];
    document.getElementById('grupo-excel-file').value       = '';
    document.getElementById('grupo-excel-preview').innerHTML = '';
    document.getElementById('grupo-import-resultado').innerHTML = '';
    const btn  = document.getElementById('btn-import-grupo');
    const hint = document.getElementById('grupo-import-hint');
    btn.disabled        = !id;
    hint.style.display  = id ? 'none' : 'block';
    openModal('modal-grupo');
  }
```

- [ ] **Step 3: Modificar `salvarGrupo`**

Substituir a função existente (linhas ~2663-2689):

```js
  async function salvarGrupo() {
    const id   = document.getElementById('grupo-id').value;
    const nome = document.getElementById('grupo-nome').value.trim();
    if (!nome) { toast('Nome é obrigatório', 'error'); return; }

    const payload = {
      nome,
      descricao: document.getElementById('grupo-descricao').value.trim() || null,
    };

    if (id) {
      const { error } = await sb.from('mala_direta_grupos').update(payload).eq('id', id);
      if (error) { toast('Erro: ' + error.message, 'error'); return; }
      toast('Grupo atualizado!', 'success');
      closeModal('modal-grupo');
    } else {
      const { data: novo, error } = await sb.from('mala_direta_grupos')
        .insert(payload).select('id').single();
      if (error) { toast('Erro: ' + error.message, 'error'); return; }
      // Mantém modal aberto para importação
      document.getElementById('grupo-id').value = novo.id;
      document.getElementById('modal-grupo-titulo').textContent = 'Editar Grupo';
      document.getElementById('btn-import-grupo').disabled = false;
      document.getElementById('grupo-import-hint').style.display = 'none';
      toast('Grupo criado! Agora você pode importar contatos via planilha.', 'success');
    }

    await loadGrupos();
    if (grupoAtualId === id) {
      grupoAtual = grupos.find(g => g.id === id);
      document.getElementById('gdet-nome').textContent = grupoAtual.nome;
      document.getElementById('gdet-meta').textContent = grupoAtual.descricao || '';
    }
    renderGrupos();
  }
```

- [ ] **Step 4: Testar manualmente**

1. Criar novo grupo → clicar "Salvar Grupo" → modal permanece aberto com título "Editar Grupo" e botão "Importar" habilitado
2. Editar grupo existente → modal abre com botão habilitado imediatamente
3. Abrir novo grupo sem salvar → botão desabilitado + hint exibido

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: update openModalGrupo and salvarGrupo for import flow"
```

---

### Task 3: JS — `previewExcelGrupo` e `importarContatosParaGrupo`

**Files:**
- Modify: `index.html` (após `confirmarImportContatos` ~linha 3064)

**Interfaces:**
- Consumes: `excelGrupoRows`, `_parseExcelFile()`, `_renderPreviewExcel()`, `sb` (Supabase client), `grupoAtualId`, `loadContatos()`, `loadGrupoContatosAtual()`
- Produces: contatos inseridos em `mala_direta_contatos`, vínculos em `mala_direta_grupo_contatos`

- [ ] **Step 1: Adicionar funções após `confirmarImportContatos`**

Logo após o fechamento da função `confirmarImportContatos` (linha ~3064), adicionar:

```js
  async function previewExcelGrupo(file) {
    if (!file) return;
    const prev = document.getElementById('grupo-excel-preview');
    prev.innerHTML = '<div style="color:var(--muted);font-size:13px">Lendo planilha…</div>';
    excelGrupoRows = [];
    document.getElementById('grupo-import-resultado').innerHTML = '';
    try {
      const rows = await _parseExcelFile(file);
      if (!rows.length) {
        prev.innerHTML = '<div style="color:var(--danger);font-size:13px">Nenhuma linha válida. Verifique se a coluna <strong>nome</strong> existe.</div>';
        return;
      }
      excelGrupoRows = rows;
      prev.innerHTML = _renderPreviewExcel(rows);
    } catch(e) {
      prev.innerHTML = `<div style="color:var(--danger);font-size:13px">Erro ao ler o arquivo: ${esc(e.message)}</div>`;
    }
  }

  async function importarContatosParaGrupo() {
    const grupoId = document.getElementById('grupo-id').value;
    if (!grupoId) { toast('Salve o grupo antes de importar.', 'error'); return; }
    if (!excelGrupoRows.length) { toast('Selecione uma planilha primeiro.', 'error'); return; }

    const btn = document.getElementById('btn-import-grupo');
    btn.disabled    = true;
    btn.textContent = 'Importando…';
    document.getElementById('grupo-import-resultado').innerHTML = '';

    try {
      // 1. Contatos já no grupo
      const { data: gcRows } = await sb.from('mala_direta_grupo_contatos')
        .select('contato_id').eq('grupo_id', grupoId);
      const jaNoGrupoSet = new Set((gcRows || []).map(r => r.contato_id));

      // 2. Lookup em lote por email
      const emailsUnicos = [...new Set(
        excelGrupoRows.filter(r => r.email?.trim()).map(r => r.email.trim().toLowerCase())
      )];
      let emailToId = {};
      if (emailsUnicos.length) {
        const { data: found } = await sb.from('mala_direta_contatos')
          .select('id,email').in('email', emailsUnicos);
        (found || []).forEach(c => { emailToId[c.email.toLowerCase()] = c.id; });
      }

      // 3. Resolver ou inserir cada contato
      const contactIds = [];
      let novos = 0, existentes = 0;
      for (const row of excelGrupoRows) {
        const emailKey = row.email?.trim().toLowerCase();
        if (emailKey && emailToId[emailKey]) {
          contactIds.push(emailToId[emailKey]);
          existentes++;
        } else {
          const { data: ins, error: eIns } = await sb.from('mala_direta_contatos')
            .insert({ nome: row.nome, email: row.email?.trim() || null,
                      telefone: row.telefone || null, empresa: row.empresa || null,
                      cargo: row.cargo || null, ativo: true })
            .select('id').single();
          if (eIns) throw eIns;
          contactIds.push(ins.id);
          if (emailKey) emailToId[emailKey] = ins.id;
          novos++;
        }
      }

      // 4. Vincular ao grupo (somente os que ainda não estão)
      let jaNoGrupoCount = 0;
      const toLink = [...new Set(contactIds)].filter(id => {
        if (jaNoGrupoSet.has(id)) { jaNoGrupoCount++; return false; }
        return true;
      });
      if (toLink.length) {
        const { error: eLnk } = await sb.from('mala_direta_grupo_contatos')
          .insert(toLink.map(cid => ({ grupo_id: grupoId, contato_id: cid })));
        if (eLnk) throw eLnk;
      }

      // 5. Exibir sumário
      const adicionados = toLink.length;
      const linhas = [
        novos      > 0 ? `• ${novos} contato(s) novo(s) criado(s) na base` : '',
        existentes > 0 ? `• ${existentes} contato(s) já existentes reutilizados` : '',
        jaNoGrupoCount > 0 ? `• ${jaNoGrupoCount} já estavam no grupo (ignorados)` : '',
        `• <strong>${adicionados} contato(s) adicionado(s) ao grupo</strong>`,
      ].filter(Boolean).join('<br>');
      document.getElementById('grupo-import-resultado').innerHTML = `
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 14px;font-size:12px;line-height:1.9;color:#15803D">
          <strong>✅ Importação concluída</strong><br>${linhas}
        </div>`;

      // 6. Limpar planilha + recarregar dados
      excelGrupoRows = [];
      document.getElementById('grupo-excel-file').value       = '';
      document.getElementById('grupo-excel-preview').innerHTML = '';
      await loadContatos();
      if (grupoAtualId === grupoId) await loadGrupoContatosAtual();

    } catch(e) {
      toast('Erro ao importar: ' + (e.message || 'erro desconhecido'), 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '📥 Importar Contatos para o Grupo';
    }
  }
```

- [ ] **Step 2: Testar cenário completo — novo grupo + import**

1. Criar novo grupo "Teste Import" → Salvar → modal permanece aberto
2. Upload de planilha com 3 contatos (2 com e-mail, 1 sem)
3. Preview aparece com 3 linhas
4. Clicar "Importar Contatos para o Grupo"
5. Sumário exibe contagem correta
6. Ir para o detalhe do grupo → confirmar 3 contatos listados
7. Ir para Contatos → confirmar que os 3 aparecem na base

- [ ] **Step 3: Testar cenário — grupo existente + deduplicação**

1. Abrir editar do grupo "Teste Import"
2. Subir a mesma planilha novamente
3. Resultado deve mostrar "2 já estavam no grupo (ignorados)" + "0 adicionados" (para os de email)
4. Os sem e-mail serão reinseridos como novos (comportamento esperado por design)

- [ ] **Step 4: Testar planilha com contatos mistos**

1. Planilha com: 1 contato cujo e-mail existe na base de Contatos mas não está no grupo, 1 contato novo
2. Resultado deve mostrar: 1 reutilizado + 1 novo + 2 adicionados ao grupo

- [ ] **Step 5: Commit final**

```bash
git add index.html
git commit -m "feat: importar planilha de contatos direto no modal de grupo"
```
