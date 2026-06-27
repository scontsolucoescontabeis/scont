# Múltiplos Emails por Contato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada contato armazene múltiplos emails separados por vírgula, com suporte completo em formulário, importação, exibição, envio Brevo e links mailto.

**Architecture:** Sem alteração de schema — `email TEXT` passa a armazenar `"email1@x.com, email2@y.com"`. Três helpers centrais (`_normalizeEmails`, `_mailtoEmails`, `_renderEmails`) isolam toda a lógica multi-email. Deduplicação no import de grupo migra de query Supabase `.in()` para lookup client-side no array `contatos` já em memória.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2, XLSX.js

## Global Constraints

- Arquivo único: `index.html`
- Sem alteração de schema SQL
- Separador canônico: `", "` (vírgula + espaço) no armazenamento; aceita qualquer espaçamento na entrada
- Deduplicação por email: qualquer email do contato (não apenas o primeiro) serve como chave

---

### Task 1: Helpers `_normalizeEmails`, `_mailtoEmails`, `_renderEmails`

**Files:**
- Modify: `index.html` (bloco `// ── HELPERS` ~linha 5234)

**Interfaces:**
- Produces:
  - `_normalizeEmails(str: string|null) → string|null` — normaliza espaços, devolve `"em1, em2"` ou `null`
  - `_mailtoEmails(str: string|null) → string` — codifica cada email individualmente, join com `,` literal
  - `_renderEmails(emailStr: string|null) → string` — HTML com `<a href="mailto:...">` por email, separados por `<br>`

- [ ] **Step 1: Adicionar os três helpers após `esc`**

Localizar a linha:
```js
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }
```
Adicionar imediatamente após:
```js
  function _normalizeEmails(str) {
    if (!str) return null;
    const parts = String(str).split(',').map(e => e.trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  function _mailtoEmails(str) {
    return (str || '').split(',').map(e => encodeURIComponent(e.trim())).filter(Boolean).join(',');
  }
  function _renderEmails(emailStr) {
    if (!emailStr) return '—';
    return String(emailStr).split(',').map(e => e.trim()).filter(Boolean)
      .map(em => `<a href="mailto:${encodeURIComponent(em)}" style="color:var(--primary)">${esc(em)}</a>`)
      .join('<br>');
  }
```

- [ ] **Step 2: Verificar no console do browser**

Abrir DevTools → Console e testar:
```js
_normalizeEmails('a@x.com , b@y.com')  // "a@x.com, b@y.com"
_mailtoEmails('a@x.com, b@y.com')       // "a%40x.com,b%40y.com"
_renderEmails('a@x.com, b@y.com')       // dois <a href="mailto:...">
_normalizeEmails(null)                  // null
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: helpers _normalizeEmails, _mailtoEmails, _renderEmails"
```

---

### Task 2: Formulário de contato — aceitar múltiplos emails

**Files:**
- Modify: `index.html` (modal `modal-contato` ~linha 776; `salvarContato` ~linha 1782)

**Interfaces:**
- Consumes: `_normalizeEmails(str)`
- Produces: campo `cont-email` agora `type="text"` com hint

- [ ] **Step 1: Alterar o input de email no modal**

Localizar:
```html
            <input type="email" id="cont-email" class="form-control" placeholder="email@exemplo.com">
```
Substituir por:
```html
            <input type="text" id="cont-email" class="form-control" placeholder="email@exemplo.com">
            <div class="form-hint">Separe múltiplos emails com vírgula</div>
```

- [ ] **Step 2: Normalizar ao salvar — `salvarContato`**

Localizar:
```js
      email:    document.getElementById('cont-email').value.trim() || null,
```
Substituir por:
```js
      email:    _normalizeEmails(document.getElementById('cont-email').value) || null,
```

- [ ] **Step 3: Testar manualmente**

1. Abrir Contatos → "+ Novo Contato"
2. Preencher nome e campo email com `"a@teste.com , b@teste.com"`
3. Salvar → observar no Supabase que `email = "a@teste.com, b@teste.com"` (espaços normalizados)
4. Abrir Editar → campo mostra os dois emails

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: campo email do contato aceita múltiplos valores separados por vírgula"
```

---

### Task 3: Exibição na tabela de Contatos e no Detalhe do Grupo

**Files:**
- Modify: `index.html` (`renderContatos` ~linha 1826; `renderGrupoContatos` ~linha 2664)

**Interfaces:**
- Consumes: `_renderEmails(emailStr)`

- [ ] **Step 1: Alterar `renderContatos`**

Localizar (único):
```js
        <td>${c.email ? `<a href="mailto:${esc(c.email)}" style="color:var(--primary)">${esc(c.email)}</a>` : '—'}</td>
```
Substituir por:
```js
        <td>${_renderEmails(c.email)}</td>
```

- [ ] **Step 2: Alterar `renderGrupoContatos`**

Localizar (único — dentro de `grupoContatosAtual.map`):
```js
        <td>${c.email ? `<a href="mailto:${esc(c.email)}" style="color:var(--primary)">${esc(c.email)}</a>` : '—'}</td>
```
Substituir por:
```js
        <td>${_renderEmails(c.email)}</td>
```

- [ ] **Step 3: Verificar visualmente**

Abrir Contatos: contato com dois emails deve mostrar dois links clicáveis (um por linha).
Abrir Grupos → Detalhe do grupo: mesmo comportamento.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: exibir múltiplos emails como links separados na tabela de contatos e grupo"
```

---

### Task 4: Envio Brevo — suporte a múltiplos destinatários

**Files:**
- Modify: `index.html` (`executarEnvioBrevo` ~linhas 4987–5003)

**Interfaces:**
- Consumes: `e.email` (string com um ou mais emails separados por vírgula)

- [ ] **Step 1: Substituir lógica de email único por multi-email**

Localizar o bloco:
```js
      document.getElementById('brevo-pb-current').textContent = `→ ${e.nome || ''} <${e.email}>`;

      try {
        const emailDest = (e.email || '').trim().toLowerCase();
        if (!emailDest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDest)) {
          throw new Error(`Email inválido: "${e.email}"`);
        }
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': cfg.key },
          body: JSON.stringify({
            sender:      { name: cfg.nome, email: cfg.email.trim() },
            to:          [{ email: emailDest, name: (e.nome || '').trim() }],
```
Substituir por:
```js
      const emailsList = (e.email || '').split(',')
        .map(em => em.trim().toLowerCase())
        .filter(em => em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
      document.getElementById('brevo-pb-current').textContent = `→ ${e.nome || ''} <${emailsList.join(', ')}>`;

      try {
        if (!emailsList.length) throw new Error(`Email inválido: "${e.email}"`);
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': cfg.key },
          body: JSON.stringify({
            sender:      { name: cfg.nome, email: cfg.email.trim() },
            to:          emailsList.map(em => ({ email: em, name: (e.nome || '').trim() })),
```

- [ ] **Step 2: Verificar no console (sem enviar de verdade)**

No console do browser, simular com um objeto `e`:
```js
const email = 'a@x.com, b@y.com';
const emailsList = email.split(',').map(em => em.trim().toLowerCase())
  .filter(em => em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
console.log(emailsList); // ["a@x.com", "b@y.com"]
console.log(emailsList.map(em => ({ email: em, name: 'Teste' }))); // [{email:"a@x.com",...}, {email:"b@y.com",...}]
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: envio Brevo suporta múltiplos emails por destinatário"
```

---

### Task 5: Links `mailto:` — todos os pontos de envio Outlook

**Files:**
- Modify: `index.html` (5 ocorrências em `_copiarHtmlEAbrirOutlook`, `enviarEmail`, `_dispararEmailItem`, `er_enviarEmail`, `_openMailto`)

**Interfaces:**
- Consumes: `_mailtoEmails(str)`

- [ ] **Step 1: `_copiarHtmlEAbrirOutlook` (~linha 2526)**

Localizar:
```js
    window.open(`mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(assunto)}`);
```
Substituir por:
```js
    window.open(`mailto:${_mailtoEmails(dest)}?subject=${encodeURIComponent(assunto)}`);
```

- [ ] **Step 2: `enviarEmail` (~linha 2546)**

Localizar:
```js
      window.open(`mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```
Substituir por:
```js
      window.open(`mailto:${_mailtoEmails(e.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```

- [ ] **Step 3: `_dispararEmailItem` (~linha 2421)**

Localizar:
```js
      window.open(`mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```
Substituir por:
```js
      window.open(`mailto:${_mailtoEmails(dest)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```

- [ ] **Step 4: `er_enviarEmail` (~linha 2296)**

Localizar:
```js
      window.open(`mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```
Substituir por:
```js
      window.open(`mailto:${_mailtoEmails(e.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`);
```

- [ ] **Step 5: `_openMailto` (~linha 5143)**

Localizar:
```js
    a.href = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
```
Substituir por:
```js
    a.href = `mailto:${_mailtoEmails(dest)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
```

- [ ] **Step 6: Verificar no console**

```js
`mailto:${_mailtoEmails('a@x.com, b@y.com')}?subject=Teste`
// "mailto:a%40x.com,b%40y.com?subject=Teste"
```

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "fix: mailto: suporta múltiplos emails (encodeURIComponent por email, join com vírgula literal)"
```

---

### Task 6: Import planilha → grupo — deduplicação client-side + normalização

**Files:**
- Modify: `index.html` (`importarContatosParaGrupo` ~linhas 3143–3172; `confirmarImportContatos` ~linha 3085)

**Interfaces:**
- Consumes: `contatos` (array global já carregado), `_normalizeEmails(str)`

- [ ] **Step 1: Substituir lookup DB por mapa client-side em `importarContatosParaGrupo`**

Localizar o bloco:
```js
      // 2. Lookup em lote por email (case-insensitive via lowercase)
      const emailsUnicos = [...new Set(
        excelGrupoRows.filter(r => r.email?.trim()).map(r => r.email.trim().toLowerCase())
      )];
      let emailToId = {};
      if (emailsUnicos.length) {
        const { data: found } = await sb.from('mala_direta_contatos')
          .select('id,email').in('email', emailsUnicos);
        (found || []).forEach(c => { emailToId[c.email.toLowerCase()] = c.id; });
      }

      // 3. Resolver ou inserir cada contato individualmente
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
          if (emailKey) emailToId[emailKey] = ins.id; // evita re-inserir mesmo email
          novos++;
        }
      }
```
Substituir por:
```js
      // 2. Mapa email→id client-side (suporta múltiplos emails por contato)
      const emailToId = {};
      for (const c of contatos) {
        if (!c.email) continue;
        for (const em of c.email.split(',')) {
          const key = em.trim().toLowerCase();
          if (key) emailToId[key] = c.id;
        }
      }

      // 3. Resolver ou inserir cada contato individualmente
      const contactIds = [];
      let novos = 0, existentes = 0;
      for (const row of excelGrupoRows) {
        const rowEmails = (row.email || '').split(',').map(em => em.trim().toLowerCase()).filter(Boolean);
        const foundId   = rowEmails.map(em => emailToId[em]).find(Boolean) || null;
        if (foundId) {
          contactIds.push(foundId);
          existentes++;
        } else {
          const emailNorm = _normalizeEmails(row.email) || null;
          const { data: ins, error: eIns } = await sb.from('mala_direta_contatos')
            .insert({ nome: row.nome, email: emailNorm,
                      telefone: row.telefone || null, empresa: row.empresa || null,
                      cargo: row.cargo || null, ativo: true })
            .select('id').single();
          if (eIns) throw eIns;
          contactIds.push(ins.id);
          rowEmails.forEach(em => { emailToId[em] = ins.id; }); // evita re-inserir mesmos emails
          novos++;
        }
      }
```

- [ ] **Step 2: Normalizar email em `confirmarImportContatos`**

Localizar:
```js
      email:    r.email    || null,
```
Substituir por:
```js
      email:    _normalizeEmails(r.email) || null,
```

- [ ] **Step 3: Testar import de grupo com contato já existente na base com dois emails**

1. Contato "Ana" já existe com `email = "ana@x.com, ana@trabalho.com"`
2. Planilha tem linha com `email = "ana@trabalho.com"`
3. Importar para grupo → resultado deve mostrar "1 contato já existente reutilizado" (não cria duplicata)

- [ ] **Step 4: Commit final**

```bash
git add index.html
git commit -m "feat: deduplicação client-side no import de grupo; normaliza email na importação de contatos"
```
