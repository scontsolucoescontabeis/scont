# Observações por Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário registre observações por empresa nas configurações e exibi-las como banner fixo na tela de lançamentos ao selecionar a empresa.

**Architecture:** Nova tabela `rh_beneficios_empresa_obs` no Supabase (uma linha por empresa). Nas configurações, nova aba "Observações" com textarea + salvar. Na tela de lançamentos, banner amarelo abaixo do cabeçalho que aparece/some conforme a empresa selecionada tenha ou não observação.

**Tech Stack:** HTML, JS vanilla, Supabase JS SDK (já em uso via `S.sb`)

---

### Task 1: Criar tabela no Supabase

**Files:**
- Modify: `schema_beneficios.sql`

- [ ] **Passo 1: Adicionar bloco da nova tabela em `schema_beneficios.sql`** após a definição de `rh_beneficios_lancamentos`:

```sql
-- Tabela 4: Observações por empresa
CREATE TABLE IF NOT EXISTS public.rh_beneficios_empresa_obs (
    codigo_empresa  TEXT PRIMARY KEY,
    observacoes     TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.rh_beneficios_empresa_obs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_ben_obs: autenticado" ON public.rh_beneficios_empresa_obs;

CREATE POLICY "rh_ben_obs: autenticado"
    ON public.rh_beneficios_empresa_obs FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Passo 2: Executar o SQL no painel do Supabase (SQL Editor)**

  Copie o bloco acima e rode no projeto correto. Verifique que a tabela aparece em Table Editor.

- [ ] **Passo 3: Commit**

```bash
git add schema_beneficios.sql
git commit -m "feat: tabela rh_beneficios_empresa_obs para observações por empresa"
```

---

### Task 2: Adicionar estado e funções load/save no script.js

**Files:**
- Modify: `script.js`

O estado global `S` já contém `S.lancamento` e `S.config` implícitos. Vamos adicionar `obs` em ambos os contextos via as funções de load/save.

- [ ] **Passo 1: Adicionar `obsEmpresa: ''` ao estado inicial de `S.lancamento` (linha ~16)**

  Localize:
  ```js
    filtroEmps: new Set(),
    filtroNenhum: false
  },
  ```
  Substitua por:
  ```js
    filtroEmps: new Set(),
    filtroNenhum: false,
    obsEmpresa: ''
  },
  ```

- [ ] **Passo 2: Adicionar função `loadObs(empresa)`** após `saveAllIndividuais` (busca em `rh_beneficios_empresa_obs`):

```js
async function loadObs(empresa) {
  if (!empresa) { S.lancamento.obsEmpresa = ''; return; }
  const { data } = await S.sb
    .from('rh_beneficios_empresa_obs')
    .select('observacoes')
    .eq('codigo_empresa', empresa)
    .maybeSingle();
  S.lancamento.obsEmpresa = data?.observacoes || '';
}
```

- [ ] **Passo 3: Adicionar função `saveObs(empresa)`** logo após `loadObs`:

```js
async function saveObs(empresa) {
  if (!empresa) return;
  const obs = $('cfgObs').value.trim();
  const { error } = await S.sb
    .from('rh_beneficios_empresa_obs')
    .upsert({ codigo_empresa: empresa, observacoes: obs }, { onConflict: 'codigo_empresa' });
  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  S.lancamento.obsEmpresa = obs;
  showToast('✅ Observações salvas!');
}
```

- [ ] **Passo 4: Commit**

```bash
git add script.js
git commit -m "feat: estado e funções loadObs/saveObs para observações por empresa"
```

---

### Task 3: Aba "Observações" na tela de configurações (HTML)

**Files:**
- Modify: `index.html`

- [ ] **Passo 1: Adicionar botão da aba** no grupo de abas de configurações.

  Localize o bloco de tabs de configuração (deve conter botões com `data-tab="padrao"` e `data-tab="individual"`). Adicione após o botão individual:

```html
<button class="tab-btn" data-tab="observacoes">📝 Observações</button>
```

- [ ] **Passo 2: Adicionar painel da aba** após `</div>` que fecha `cfgTabIndividual`:

```html
<!-- Tab: Observações -->
<div id="cfgTabObservacoes" class="hidden">
  <div class="info-box">
    📝 Observações sobre esta empresa serão exibidas como aviso na tela de lançamentos ao selecioná-la.
  </div>
  <div class="card">
    <h3 class="card-title">📝 Observações da Empresa</h3>
    <textarea id="cfgObs" rows="6"
      style="width:100%;box-sizing:border-box;padding:10px;font-size:13px;border:1px solid var(--border);border-radius:6px;resize:vertical;font-family:inherit"
      placeholder="Ex: Empresa utiliza VT apenas para empregados do setor operacional. Conferir escala antes de lançar."></textarea>
    <div style="margin-top:12px">
      <button id="btnSalvarObs" class="btn btn-primary">💾 Salvar Observações</button>
    </div>
  </div>
</div>
```

- [ ] **Passo 3: Commit**

```bash
git add index.html
git commit -m "feat: aba Observações na tela de configurações"
```

---

### Task 4: Lógica da aba Observações no script.js

**Files:**
- Modify: `script.js`

- [ ] **Passo 1: Registrar a nova aba no toggle de tabs**

  Localize onde as tabs de configuração são controladas (deve haver algo como `$('cfgTabPadrao').classList.toggle('hidden', tab !== 'padrao')`). Adicione a linha equivalente para a nova aba:

```js
$('cfgTabObservacoes').classList.toggle('hidden', tab !== 'observacoes');
```

- [ ] **Passo 2: Registrar listener do botão salvar**

  Localize onde `$('btnSalvarConfig')` e `$('btnSalvarTodosInd')` têm seus listeners registrados. Adicione:

```js
$('btnSalvarObs').addEventListener('click', () => saveObs($('cfgEmpresa').value));
```

- [ ] **Passo 3: Carregar observações ao trocar de empresa nas configurações**

  Localize o listener do seletor `cfgEmpresa` (que dispara `loadConfig`, `loadEmpregados`, `loadIndividuais`). Após essas chamadas, adicione:

```js
const obsData = await S.sb
  .from('rh_beneficios_empresa_obs')
  .select('observacoes')
  .eq('codigo_empresa', $('cfgEmpresa').value)
  .maybeSingle();
$('cfgObs').value = obsData.data?.observacoes || '';
```

- [ ] **Passo 4: Commit**

```bash
git add script.js
git commit -m "feat: lógica da aba Observações — load ao trocar empresa, save ao clicar botão"
```

---

### Task 5: Banner de observações na tela de lançamentos (HTML + CSS)

**Files:**
- Modify: `index.html`

- [ ] **Passo 1: Adicionar o banner no HTML da seção de lançamentos**

  Localize o início do conteúdo da seção de lançamentos (após o cabeçalho com seletor de empresa, competência etc.). Adicione o banner logo antes da grade ou dos filtros:

```html
<div id="bannerObsEmpresa" class="hidden"
  style="display:flex;align-items:flex-start;gap:10px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.5">
  <span style="font-size:16px;flex-shrink:0">⚠️</span>
  <span id="bannerObsTexto"></span>
</div>
```

- [ ] **Passo 2: Commit**

```bash
git add index.html
git commit -m "feat: banner HTML para observações de empresa na tela de lançamentos"
```

---

### Task 6: Exibir banner ao selecionar empresa em lançamentos

**Files:**
- Modify: `script.js`

- [ ] **Passo 1: Adicionar função `renderBannerObs()`** que lê `S.lancamento.obsEmpresa` e mostra/oculta o banner:

```js
function renderBannerObs() {
  const banner = $('bannerObsEmpresa');
  const texto  = S.lancamento.obsEmpresa.trim();
  if (texto) {
    $('bannerObsTexto').textContent = texto;
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  } else {
    banner.classList.add('hidden');
    banner.style.display = '';
  }
}
```

- [ ] **Passo 2: Chamar `loadObs` e `renderBannerObs` ao trocar empresa em lançamentos**

  Localize o listener do seletor de empresa na tela de lançamentos (onde chama `loadConfig`, `loadEmpregados`, `loadIndividuais`, e faz `S.lancamento.filtroEmps.clear()`). Adicione ao final desse bloco:

```js
await loadObs($('lancEmpresa').value);
renderBannerObs();
```

  > Nota: o ID do seletor de empresa em lançamentos pode ser `lancEmpresa` ou similar — confirme no HTML antes de editar.

- [ ] **Passo 3: Garantir que o banner some ao limpar a empresa**

  No mesmo listener, se houver um caso onde empresa fica vazia (ex: usuário seleciona `""`), `loadObs('')` já zera `S.lancamento.obsEmpresa`, então `renderBannerObs()` vai ocultar o banner automaticamente.

- [ ] **Passo 4: Commit**

```bash
git add script.js
git commit -m "feat: exibir banner de observações ao selecionar empresa em lançamentos"
```

---

### Task 7: Teste manual e ajustes finais

- [ ] Abrir a ferramenta no browser

- [ ] Ir em Configurações → selecionar uma empresa → aba "Observações" → digitar texto → "Salvar Observações" → confirmar toast ✅

- [ ] Trocar de empresa nas configurações → confirmar que o campo carrega a observação correta (vazia para empresa sem obs)

- [ ] Ir em Lançamentos → selecionar a empresa com observação → confirmar que banner amarelo aparece com o texto correto

- [ ] Selecionar empresa sem observação → confirmar que banner some

- [ ] Limpar o campo de observações, salvar → confirmar que banner some em lançamentos

- [ ] Commit final se houver ajustes:

```bash
git add index.html script.js
git commit -m "fix: ajustes finais no banner de observações"
```
