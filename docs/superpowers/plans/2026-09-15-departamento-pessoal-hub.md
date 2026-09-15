# Hub "Departamento Pessoal" + Configurações centralizadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar as 7 ferramentas de Departamento Pessoal num hub único no portal e mover toda tela de configuração hoje espalhada (VA/VT, Grupos de Empresas, Configuração por Empresa/Jornadas, Empresas/Empregados/Rubricas/Feriados/Sócios, Folha Contratada + Responsáveis) para uma única tela "Configurações" dentro desse hub — sem alterar nenhuma lógica de cálculo, processamento ou tratamento de dados.

**Architecture:** Reaproveita `Projeto Departamento Pessoal/` como pasta do hub, seguindo o padrão de navegação por link real (`<a href>`, sem iframe) já usado pela Central do Departamento Contábil (`Projeto Onboarding Contabil/index.html`). `Projeto RH/admin.html`+`admin.js` (ferramenta "Admin – Módulo RH", uso exclusivo confirmado) vira a base física da nova `configuracoes.html`/`configuracoes.js` — cada tela de edição hoje espalhada em `Projeto RH/script.js`/`index.html` e `Projeto Fechamento Folha/controle.js`/`controle.html` é fisicamente recortada (verbatim) desses arquivos e colada como aba adicional nesse shell, mantendo intocada toda função de LEITURA que o motor de cálculo de cada ferramenta consome.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2 (`../supabase-config.js` compartilhado, mesmo projeto em todas as ferramentas envolvidas — confirmado), sem framework/build step.

**Spec:** `docs/superpowers/specs/2026-09-15-departamento-pessoal-hub-design.md`

## Global Constraints

- Nenhuma lógica de cálculo, processamento ou tratamento de dados muda em nenhuma ferramenta — toda extração é recorte verbatim de código já existente, não reescrita.
- Nenhuma tabela nova é criada. Todas as telas continuam lendo/escrevendo exatamente as mesmas tabelas Supabase de hoje.
- Funções de LEITURA consumidas pelo motor de cálculo/workflow original (ex. `_buscarConfigRubricas`, `_buscarJornadas`, `possuiFolha`, `carregarBase`) NUNCA são removidas nem movidas — só a UI de edição sai do lugar original.
- Acesso ao hub é único (uma linha em `ferramentas`), sem permissão granular por sub-ferramenta — decisão já aprovada.
- Todo card/sub-ferramenta usa navegação real (`<a href>`), nunca iframe.

---

## Contexto detalhado (não repetir nos tasks)

Investigação prévia (ver spec) mapeou 4 blocos de configuração a mover, cada um com o mesmo padrão: uma tabela cujo **valor** é consumido por lógica de cálculo que **fica** no arquivo original; só a **UI de edição** migra, com sua própria leitura/gravação nova (mesma tabela, mesmas colunas, sem lógica nova).

| Bloco | Fica (não mexer) | Migra para Configurações |
|---|---|---|
| VA/VT | Todo o motor de cálculo/TXT de `script.js` que já lê `rh_valores_va_vt` via outras funções | Modal `#valoresVaVtModal` (`index.html:1458-1502`) + `#vvBuscaEmpresaResultados` (`index.html:1561-1571`) + `script.js:3265-3396` (6 funções) + botão sidebar (`index.html:49-51`) |
| Grupos de Empresas | `carregarGrupos`, `renderizarListaGrupos`, `selecionarGrupo`, estado `_grupos`/`_grupoAtual`, e todo bloco "Ações em Lote" (`script.js:2773-3131`) — o lote depende desses | Formulário de criar/editar/excluir grupo (dentro de `_renderGrupoDetalhe`, `script.js:2712-2771`) + `novoGrupo`, `salvarGrupo`, `excluirGrupo`, `_renderGrpEmpresasList`, `removerEmpresaGrupo`, `filtrarEmpresasGrupo`, `adicionarEmpresaGrupo` |
| Configuração por Empresa (Rubricas/Jornadas/E-mail responsável) | Todas as funções de leitura usadas pelo motor de TXT/recibo/PDF (`_buscarConfigRubricas`, `_buscarJornadas`, `_aplicarConfigRubricasNoCampos`, `_resolverPeriodoApuracao`, etc. — `script.js:1987-2150`, `2292-2314`) | Modal `#configRubricasModal` (`index.html:1090-1456`) + `#cfgBuscaEmpresaResultados` (`index.html:1549-1559`) + botão sidebar (`index.html:46-48`) + `script.js:3133-3263` + `script.js:2151-2211`, `2215-2219`, `2220-2284` + bloco Jornadas Extras `script.js:2286-2528` |
| Folha Contratada + Responsáveis | `carregarBase`, `possuiFolha`, estado `empresasFolhaCache`/`folhaConfigPorEmpresa`/`responsaveisFolhaPorEmpresa` (`controle.js:20-22,106-147`) — o dashboard de fases usa `possuiFolha` | View `#telaConfigEmpresasCF` (`controle.html:277-311`) + modais `#modalResponsaveisCF` (`316-327`) e `#modalResponsavelUsuarioCF` (`330-352`) + `controle.js:829-1235` (todo o resto do arquivo) |

Todas as 4 migrações seguem o mesmo método de execução (detalhado em cada task):
1. Ler o trecho fonte exato (linhas dadas acima).
2. Colar como nova aba dentro do shell de `configuracoes.html`/`.js` (mesmo padrão de `admin.js`: `<button class="sidebar-item" id="nav-X" onclick="abrirAba('X', this)">` + `<div id="X" class="admin-tab-content">`).
3. Prefixar/renomear qualquer id HTML que já exista em `configuracoes.html` (checar antes com grep).
4. **Não redeclarar** `supabaseClient` (já existe em `admin.js:7`) nem recriar `mostrarMensagem`/`messageModal` (já existem em `admin.js:4029` e no HTML de `admin.html`) — os trechos colados já chamam essas funções pelo nome, e vão funcionar sem alteração.
5. Trocar toda referência a `state.empresas` (existia só em `script.js`) pela lista já carregada em `configuracoes.js`: `_todasEmpresas` (populada por `carregarEmpresas()`, já presente em `admin.js`).
6. Apagar o trecho de origem (HTML + JS) e o gatilho (botão/link) que abria a UI antiga.
7. `grep` de verificação: nenhuma referência solta ao nome das funções/ids removidos no arquivo de origem.
8. Smoke test manual (descrito em cada task).

---

### Task 1: Renomear "Departamento Pessoal" (fluxos) para Fluxos Operacionais

**Files:**
- Modify (rename): `Projeto Departamento Pessoal/index.html` → `Projeto Departamento Pessoal/fluxos-operacionais.html`
- Modify (rename): `Projeto Departamento Pessoal/app.js` → `Projeto Departamento Pessoal/fluxos-operacionais.js`
- Keep: `Projeto Departamento Pessoal/data/rescisao.js` (sem alteração)

**Interfaces:**
- Produces: arquivo `fluxos-operacionais.html` navegável via link relativo `fluxos-operacionais.html` a partir do novo hub (Task 2).

- [ ] **Passo 1: Renomear os arquivos preservando histórico do git**

```bash
git mv "Projeto Departamento Pessoal/index.html" "Projeto Departamento Pessoal/fluxos-operacionais.html"
git mv "Projeto Departamento Pessoal/app.js" "Projeto Departamento Pessoal/fluxos-operacionais.js"
```

- [ ] **Passo 2: Atualizar a referência de script dentro do HTML renomeado**

Em `Projeto Departamento Pessoal/fluxos-operacionais.html`, trocar:
```html
<script src="data/rescisao.js"></script>
<script src="app.js"></script>
```
por:
```html
<script src="data/rescisao.js"></script>
<script src="fluxos-operacionais.js"></script>
```

- [ ] **Passo 3: Atualizar o título da página**

Em `Projeto Departamento Pessoal/fluxos-operacionais.html`, trocar `<title>Departamento Pessoal — Scont</title>` por `<title>Fluxos Operacionais — Scont</title>`.

- [ ] **Passo 4: Adicionar botão "Voltar ao Hub" (a página hoje só tem "Voltar ao Portal")**

No mesmo arquivo, dentro de `.sidebar-footer`, antes do botão existente:
```html
<div class="sidebar-footer">
  <button class="btn-voltar" onclick="window.location.href='index.html'">
    ⬅️ <span>Voltar ao Hub DP</span>
  </button>
  <button class="btn-voltar" onclick="window.location.href='../portal.html'">
    🏠 <span>Voltar ao Portal</span>
  </button>
</div>
```

- [ ] **Passo 5: Verificar que não sobrou nenhuma referência ao nome antigo de arquivo**

```bash
grep -rn "Projeto Departamento Pessoal/app\.js\|Projeto Departamento Pessoal/index\.html" --include=*.html --include=*.js .
```
Esperado: nenhuma ocorrência funcional (só pode aparecer em `docs/superpowers/specs/*.md` ou `Projeto Manual Programador/*`, que são documentação, não código executável — não precisam ser corrigidos nesta task).

- [ ] **Passo 6: Smoke test manual**

Abrir `Projeto Departamento Pessoal/fluxos-operacionais.html` direto no navegador (file:// ou servidor local) e confirmar que o fluxograma Mermaid de rescisão carrega normalmente, igual a antes da renomeação.

- [ ] **Passo 7: Commit**

```bash
git add "Projeto Departamento Pessoal/fluxos-operacionais.html" "Projeto Departamento Pessoal/fluxos-operacionais.js"
git commit -m "$(cat <<'EOF'
refactor(dp): renomeia ferramenta Departamento Pessoal para Fluxos Operacionais

Prepara o nome "Departamento Pessoal" para virar o hub que agrupa todas
as ferramentas de DP; o conteúdo atual (fluxogramas de processos) passa
a se chamar Fluxos Operacionais dentro desse hub.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Criar o hub `index.html` do Departamento Pessoal

**Files:**
- Create: `Projeto Departamento Pessoal/index.html`
- Modify: `Projeto Departamento Pessoal/styles.css`

**Interfaces:**
- Consumes: `fluxos-operacionais.html` (Task 1), `configuracoes.html` (Task 3), e as 6 ferramentas externas já existentes (`../Projeto RH/index.html`, `../Projeto RH/lancamentos.html`, `../Projeto Simulador Folha/index.html`, `../Projeto Fechamento Folha/index.html`, `../Projeto Validação Fechamento Folha/index.html`, `../Projeto Calendario Folha/index.html`).
- Produces: página `index.html` que é o novo `url_base` da ferramenta "Departamento Pessoal" no portal (Task 9).

- [ ] **Passo 1: Adicionar o CSS de cards ao `styles.css` da pasta**

Adicionar ao final de `Projeto Departamento Pessoal/styles.css` (verbatim, copiado do padrão já usado pela Central Contábil em `Projeto Onboarding Contabil/styles.css:546-571` — mesmas variáveis de cor, já confirmadas idênticas entre as duas pastas):

```css
.tool-picker{ max-width:840px; margin:40px auto 0; }
.tool-picker-header{
  margin-bottom:28px;
  background:var(--surface);
  padding:20px 24px;
  border-radius:var(--radius-sm);
  border-left:4px solid var(--brand);
  box-shadow:var(--shadow-soft);
}
.tool-picker-header h2{ font-size:1.6rem; color:var(--brand); margin:0 0 6px; }
.tool-picker-header p{ color:var(--muted); margin:0; }
.tool-cards{ display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:20px; }
.tool-card{
  display:block; padding:28px 24px; border-radius:var(--radius);
  background:var(--surface); border:1px solid var(--line-soft);
  box-shadow:var(--shadow-soft); text-decoration:none; color:inherit;
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.tool-card:hover{ transform:translateY(-3px); box-shadow:var(--shadow); border-color:var(--brand); }
.tool-card-icon{
  width:56px; height:56px; border-radius:14px; font-size:26px;
  display:flex; align-items:center; justify-content:center; margin-bottom:16px;
  background:linear-gradient(135deg, var(--brand-2), var(--brand)); color:#fff;
}
.tool-card h3{ font-size:1.05rem; margin:0 0 8px; color:var(--brand-strong); }
.tool-card p{ font-size:.88rem; color:var(--muted); margin:0; line-height:1.5; }
```

- [ ] **Passo 2: Criar `Projeto Departamento Pessoal/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Departamento Pessoal — Scont</title>
  <link rel="icon" type="image/x-icon" href="../assets/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="../assets/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon.png" />
  <link rel="stylesheet" href="styles.css" />
  <script src="../supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>
<!-- AUTH OVERLAY -->
<div id="authOverlay" style="position:fixed;inset:0;background:#F0F2F5;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
  <div style="font-size:40px;">🔐</div>
  <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
      <h1>Departamento Pessoal</h1>
      <p>Central de Ferramentas</p>
    </div>

    <div class="sidebar-footer">
      <button class="btn-voltar" onclick="window.location.href='../portal.html'">
        🏠 <span>Voltar ao Portal</span>
      </button>
    </div>
  </aside>

  <main class="main">
    <div class="tool-picker">
      <div class="tool-picker-header">
        <h2>Departamento Pessoal</h2>
        <p>Escolha uma ferramenta para continuar.</p>
      </div>

      <div class="tool-cards">
        <a class="tool-card" href="../Projeto RH/index.html">
          <div class="tool-card-icon">📋</div>
          <h3>Controle de Frequência - Ponto</h3>
          <p>Processamento de folha de ponto, benefícios e escala por competência.</p>
        </a>
        <a class="tool-card" href="../Projeto RH/lancamentos.html">
          <div class="tool-card-icon">💸</div>
          <h3>Lançamentos de Folha</h3>
          <p>Lançamentos adicionais por empregado a partir do catálogo de rubricas.</p>
        </a>
        <a class="tool-card" href="../Projeto Simulador Folha/index.html">
          <div class="tool-card-icon">🧮</div>
          <h3>Simulador de Folha de Pagamento</h3>
          <p>Simulação de cálculos de folha de pagamento.</p>
        </a>
        <a class="tool-card" href="../Projeto Fechamento Folha/index.html">
          <div class="tool-card-icon">💼</div>
          <h3>Fechamento Folha de Pagamento</h3>
          <p>Fechamento mensal por empresa, controle de ciclo e programação de férias.</p>
        </a>
        <a class="tool-card" href="../Projeto Validação Fechamento Folha/index.html">
          <div class="tool-card-icon">🔍</div>
          <h3>Validação de Fechamento de Folha</h3>
          <p>Conferência de extratos e competências do fechamento.</p>
        </a>
        <a class="tool-card" href="../Projeto Calendario Folha/index.html">
          <div class="tool-card-icon">🗓️</div>
          <h3>Calendário da Folha</h3>
          <p>Eventos e prazos do calendário único da folha de pagamento.</p>
        </a>
        <a class="tool-card" href="fluxos-operacionais.html">
          <div class="tool-card-icon">📤</div>
          <h3>Fluxos Operacionais</h3>
          <p>Passo a passo e fluxograma dos processos de rescisão, admissão e férias.</p>
        </a>
        <a class="tool-card" href="configuracoes.html" id="cardConfiguracoes">
          <div class="tool-card-icon">⚙️</div>
          <h3>Configurações</h3>
          <p>VA/VT, Grupos de Empresas, Empresas, Empregados, Rubricas, Feriados e Folha Contratada — tudo num só lugar.</p>
        </a>
      </div>
    </div>
  </main>
</div>

<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
  });
</script>
</body>
</html>
```

- [ ] **Passo 3: Smoke test manual**

Abrir `Projeto Departamento Pessoal/index.html`, confirmar que os 8 cards aparecem, e que cada link (exceto `configuracoes.html`, que só existe após a Task 3) abre a página correta.

- [ ] **Passo 4: Commit**

```bash
git add "Projeto Departamento Pessoal/index.html" "Projeto Departamento Pessoal/styles.css"
git commit -m "$(cat <<'EOF'
feat(dp): cria hub Departamento Pessoal com cards para as 8 ferramentas

Segue o mesmo padrão visual/estrutural da Central do Departamento
Contábil (navegação por link real, sem iframe).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Mover "Admin – Módulo RH" inteiro para virar a base de `configuracoes.html`

**Files:**
- Modify (rename): `Projeto RH/admin.html` → `Projeto Departamento Pessoal/configuracoes.html`
- Modify (rename): `Projeto RH/admin.js` → `Projeto Departamento Pessoal/configuracoes.js`
- Modify: `Projeto RH/index.html:70-72` (remove link "Administração RH")

**Interfaces:**
- Produces: `configuracoes.html`/`configuracoes.js` com 8 abas já funcionando (Empresas, Empregados, Informações de Férias, Jornada de Trabalho, Sócios, Rubricas, Feriados, Renomear Arquivos, Importar Dados) — mesmas de antes, mesma lógica. Esta é a base sobre a qual as Tasks 4-7 vão colar as abas restantes.
- Consumes: nenhuma dependência de outra task além da Task 2 (pasta hub já existe).

- [ ] **Passo 1: Renomear os arquivos preservando histórico do git**

```bash
git mv "Projeto RH/admin.html" "Projeto Departamento Pessoal/configuracoes.html"
git mv "Projeto RH/admin.js" "Projeto Departamento Pessoal/configuracoes.js"
```

- [ ] **Passo 2: Corrigir caminhos relativos em `configuracoes.html`**

O arquivo mudou de profundidade relativa (antes em `Projeto RH/`, agora em `Projeto Departamento Pessoal/` — mesma profundidade a partir da raiz, então `../supabase-config.js`, `../assets/...` e `../portal.html` continuam corretos). Só precisa corrigir referências que apontavam para dentro da própria pasta `Projeto RH/`:

Trocar:
```html
<link rel="stylesheet" href="styles.css">
```
por (RH styles.css tem as classes `.sidebar-item`, `.admin-table`, `.modal`, `.form-group` etc. que todo o conteúdo desta página usa):
```html
<link rel="stylesheet" href="../Projeto RH/styles.css">
```

Trocar (no `sidebar-footer`, link que hoje volta para o Controle de Frequência):
```html
<a href="index.html" class="sidebar-item" style="border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; text-decoration: none;">
    <span class="sidebar-item-icon">📋</span> Controle de Frequência
</a>
```
por:
```html
<a href="index.html" class="sidebar-item" style="border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; text-decoration: none;">
    <span class="sidebar-item-icon">⬅️</span> Voltar ao Hub DP
</a>
<a href="../Projeto RH/index.html" class="sidebar-item" style="border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; text-decoration: none;">
    <span class="sidebar-item-icon">📋</span> Controle de Frequência
</a>
```

- [ ] **Passo 3: Atualizar título e cabeçalho da página**

Trocar `<title>Administração - Módulo RH · SCONT</title>` por `<title>Configurações — Departamento Pessoal · SCONT</title>`.

Trocar `<h2>Admin · Módulo RH</h2>` por `<h2>Configurações</h2>` e `<p>Gestão de dados</p>` por `<p>Departamento Pessoal</p>` (no bloco `.sidebar-brand`).

Trocar `<h1>⚙️ Administração — Módulo RH</h1>` por `<h1>⚙️ Configurações — Departamento Pessoal</h1>`.

- [ ] **Passo 4: Verificar que nenhuma outra página do projeto ainda referencia o caminho antigo**

```bash
grep -rln "Projeto RH/admin\.html\|Projeto RH/admin\.js" --include=*.html --include=*.js --include=*.sql .
```

Esperado nesta etapa: ainda vão aparecer `Projeto RH/index.html` (3 ocorrências, corrigidas na Task 6) e `_sql/add_ferramenta_dp.sql`/`schema.sql` (corrigidos na Task 9). Confirme que a lista bate com o esperado — se aparecer qualquer arquivo fora dessas duas tasks, pare e investigue antes de continuar.

- [ ] **Passo 5: Smoke test manual**

Abrir `Projeto Departamento Pessoal/configuracoes.html` direto, confirmar que as 8 abas (Empresas, Empregados, Informações de Férias, Jornada de Trabalho, Sócios, Rubricas, Feriados, Renomear Arquivos, Importar Dados) carregam dados normalmente, igual a antes — nenhuma mudança de comportamento esperada nesta task.

- [ ] **Passo 6: Commit**

```bash
git add -A "Projeto RH/admin.html" "Projeto RH/admin.js" "Projeto Departamento Pessoal/configuracoes.html" "Projeto Departamento Pessoal/configuracoes.js" "Projeto RH/index.html"
git commit -m "$(cat <<'EOF'
refactor(dp): move Admin - Modulo RH para virar a base de Configuracoes

Projeto RH/admin.html + admin.js viram Projeto Departamento
Pessoal/configuracoes.html + configuracoes.js, sem alterar nenhuma
logica das 8 abas existentes (Empresas, Empregados, Ferias, Jornada,
Socios, Rubricas, Feriados, Renomear Arquivos, Importar Dados).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Mover VA/VT para Configurações

**Files:**
- Modify: `Projeto RH/index.html:49-51,1458-1502,1561-1571` (remover botão sidebar + modal + floating div)
- Modify: `Projeto RH/script.js:3265-3396` (remover as 6 funções)
- Modify: `Projeto Departamento Pessoal/configuracoes.html` (adicionar aba + modal)
- Modify: `Projeto Departamento Pessoal/configuracoes.js` (adicionar as 6 funções + helper)

**Interfaces:**
- Consumes: `_todasEmpresas` (já existe em `configuracoes.js`, populada por `carregarEmpresas()`), `supabaseClient`, `mostrarMensagem` (já existem em `configuracoes.js`).
- Produces: aba "VA/VT" navegável via `abrirAba('vavt', this)` e via URL `configuracoes.html?tab=vavt&empresa=<codigo>` (deep-link usado pela Task 8).

- [ ] **Passo 1: Ler o trecho fonte exato**

Ler `Projeto RH/index.html:1458-1502` (modal `#valoresVaVtModal`) e `Projeto RH/index.html:1561-1571` (`#vvBuscaEmpresaResultados`), e `Projeto RH/script.js:3265-3396` (as 6 funções: `abrirModalValoresVaVt`, `fecharModalValoresVaVt`, `filtrarEmpresasValoresVaVt`, `selecionarEmpresaValoresVaVt`, `_carregarTabelaValoresVaVt`, `salvarValoresVaVt`).

- [ ] **Passo 2: Colar em `configuracoes.html`, adaptado de modal para aba de tela cheia**

Adicionar um item de sidebar (junto aos outros `nav-*`):
```html
<button class="sidebar-item" id="nav-vavt" onclick="abrirAba('vavt', this)">
    <span class="sidebar-item-icon">💰</span> VA/VT
</button>
```

Adicionar, dentro de `#mainAdminContent`, uma nova aba (o conteúdo interno do modal original vira o corpo da aba — mesmos ids `vvBuscaEmpresa`, `vvCodigoEmpresa`, `vvSemEmpresa`, `vvConteudo`, `vvTabelaEmpregados`, `vvBtnSalvar`, mantidos idênticos ao original porque as funções JS coladas na Task seguinte já os referenciam por esses nomes; grep em `configuracoes.html` antes de colar para confirmar que nenhum desses ids já existe — não deve existir, são específicos do VA/VT):

```html
<div id="vavt" class="admin-tab-content">
    <div class="admin-section">
        <h2>💰 Valores de VT/VA por Empregado</h2>
        <div class="form-group" style="max-width:420px;">
            <label>Empresa</label>
            <input type="text" id="vvBuscaEmpresa"
                placeholder="Digite o nome ou código da empresa..."
                autocomplete="off"
                oninput="filtrarEmpresasValoresVaVt(this.value)"
                onfocus="filtrarEmpresasValoresVaVt(this.value)">
            <input type="hidden" id="vvCodigoEmpresa">
        </div>
        <div id="vvSemEmpresa" style="text-align: center; padding: 30px 0; color: #7F8C8D; font-size: 13px;">
            Selecione uma empresa para configurar os valores diários de VT e VA de cada empregado.
        </div>
        <div id="vvConteudo" style="display: none;">
            <div style="border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">
                <div style="background: #F5F5F5; padding: 8px 14px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
                    <span style="font-size: 11px; font-weight: 700; color: #7F8C8D; text-transform: uppercase; letter-spacing: 0.4px;">Empregado</span>
                    <span style="font-size: 11px; font-weight: 700; color: #7F8C8D; text-transform: uppercase; letter-spacing: 0.4px;">VT / dia (R$)</span>
                    <span style="font-size: 11px; font-weight: 700; color: #7F8C8D; text-transform: uppercase; letter-spacing: 0.4px;">VA / dia (R$)</span>
                </div>
                <div id="vvTabelaEmpregados" style="max-height: 420px; overflow-y: auto;"></div>
            </div>
            <p style="font-size: 11px; color: #7F8C8D; margin-top: 6px;">
                Valor diário de VT/VA a ser descontado do empregado em caso de falta ou atestado. Campos vazios equivalem a R$ 0,00.
            </p>
            <button type="button" class="btn-save" id="vvBtnSalvar" style="display: none; margin-top: 10px;" onclick="salvarValoresVaVt()">💾 Salvar</button>
        </div>
    </div>
</div>

<div id="vvBuscaEmpresaResultados" style="
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

- [ ] **Passo 3: Colar as 6 funções em `configuracoes.js`, adaptando `state.empresas` → `_todasEmpresas`**

Copiar as 6 funções de `script.js:3265-3396` verbatim, com UMA única mudança mecânica: toda ocorrência de `state.empresas` vira `_todasEmpresas` (variável já populada em `configuracoes.js`). Nenhuma outra linha muda. Adicionar também o helper puro do qual `_carregarTabelaValoresVaVt` depende (`script.js:218-223`, verbatim, sem adaptação):

```javascript
function _excluirContribuinte(lista) {
    return (lista || []).filter(e =>
        (e.tipo_empregado || '').trim() !== 'Contribuinte' &&
        (e.situacao || '').trim() !== 'Demitido'
    );
}
```

Na função `_carregarTabelaValoresVaVt` colada, remover a lógica de destaque `_pendentesConfigNovos` (essa variável só existe na sessão de processamento do Controle de Frequência, não faz sentido aqui — é só um realce visual, não lógica de cálculo): trocar

```javascript
const destaque = _pendentesConfigNovos.some(p => p.codigo_empresa === codigoEmpresa && p.codigo_empregado === emp.codigo_empregado);
```
por
```javascript
const destaque = false;
```

(mantém o resto do template literal idêntico, só o destaque deixa de acender — nenhum dado é perdido, é puramente cosmético).

- [ ] **Passo 4: Adicionar suporte a deep-link por querystring no `configuracoes.js`**

Em `configuracoes.js`, dentro do handler `document.addEventListener('DOMContentLoaded', ...)` já existente (que hoje só trata `location.hash`), adicionar tratamento de `?tab=` e `?empresa=` ANTES do tratamento de hash existente:

```javascript
    const params = new URLSearchParams(location.search);
    const tabQuery = params.get('tab');
    const empresaQuery = params.get('empresa');
    if (tabQuery) {
        const btnQuery = document.getElementById('nav-' + tabQuery);
        if (btnQuery) abrirAba(tabQuery, btnQuery);
        if (tabQuery === 'vavt' && empresaQuery) {
            document.getElementById('vvBuscaEmpresa').value = empresaQuery;
            filtrarEmpresasValoresVaVt(empresaQuery);
        }
    }
```

- [ ] **Passo 5: Remover o modal, o floating div e o botão de sidebar do `Projeto RH/index.html`**

Apagar `Projeto RH/index.html:49-51` (botão sidebar "💰 Valores VT/VA"), `Projeto RH/index.html:1458-1502` (modal `#valoresVaVtModal`) e `Projeto RH/index.html:1561-1571` (`#vvBuscaEmpresaResultados`).

- [ ] **Passo 6: Remover as 6 funções de `Projeto RH/script.js`**

Apagar `script.js:3265-3396`.

- [ ] **Passo 7: Corrigir o gatilho de "pendências" para navegar até a nova aba (em vez de abrir o modal local)**

Localizar `_irConfigurarValoresVaVtPendentes` em `Projeto RH/script.js` (por volta da linha 5513) e trocar a chamada que abria o modal local por uma navegação real:

```javascript
window.location.href = '../Projeto Departamento Pessoal/configuracoes.html?tab=vavt&empresa=' + encodeURIComponent(codigoEmpresaPendente);
```

(usar o mesmo nome de variável que a função já usa hoje para identificar a empresa pendente — ler a função completa antes de editar para pegar o nome exato da variável em escopo).

- [ ] **Passo 8: Verificação**

```bash
grep -n "abrirModalValoresVaVt\|valoresVaVtModal\|vvBuscaEmpresaResultados" "Projeto RH/index.html" "Projeto RH/script.js"
```
Esperado: zero ocorrências (a não ser dentro de comentários residuais, que devem ser removidos também).

- [ ] **Passo 9: Smoke test manual**

Em `Projeto Departamento Pessoal/configuracoes.html`, abrir a aba VA/VT, buscar uma empresa real, confirmar que a tabela de empregados carrega com os valores já salvos, editar um valor, salvar, e recarregar a página para confirmar que persistiu. Depois, em `Projeto RH/index.html`, processar uma folha de uma empresa com desconto de falta/atestado e confirmar que o valor de VT/VA usado no cálculo continua vindo de `rh_valores_va_vt` normalmente (o motor de cálculo não foi tocado).

- [ ] **Passo 10: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js" "Projeto Departamento Pessoal/configuracoes.html" "Projeto Departamento Pessoal/configuracoes.js"
git commit -m "$(cat <<'EOF'
refactor(dp): move edicao de Valores VT/VA para Configuracoes centralizada

A UI de editar rh_valores_va_vt sai do Controle de Frequencia e passa a
viver só em Configuracoes; o motor de calculo que le essa tabela não
foi alterado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Mover edição de Grupos de Empresas para Configurações; simplificar tela antiga para somente leitura + lote

**Files:**
- Modify: `Projeto RH/index.html:269-283` (simplificar `#gruposScreen` para somente leitura)
- Modify: `Projeto RH/script.js:2712-2771` (`_renderGrupoDetalhe` perde o formulário de edição, mantém resumo + Ações em Lote)
- Modify: `Projeto RH/script.js` (remover `novoGrupo`, `salvarGrupo`, `excluirGrupo`, `_renderGrpEmpresasList`, `removerEmpresaGrupo`, `filtrarEmpresasGrupo`, `adicionarEmpresaGrupo`)
- Modify: `Projeto Departamento Pessoal/configuracoes.html` / `.js` (adicionar aba "Grupos de Empresas" com CRUD completo)

**Interfaces:**
- Consumes: `supabaseClient`, `mostrarMensagem`, `_todasEmpresas` (em `configuracoes.js`); tabelas `rh_grupos_empresas`, `rh_grupos_empresas_itens`.
- Produces: aba "Grupos de Empresas" em Configurações com CRUD completo (criar, editar nome/e-mail/observações/empresas do grupo, excluir). `Projeto RH/index.html`'s `#gruposScreen` continua existindo, mas só para consulta + ações em lote (o Controle de Frequência continua precisando listar/selecionar grupos para rodar exportação em lote).

⚠️ Este bloco tem acoplamento real (ver tabela de contexto): `carregarGrupos`, `renderizarListaGrupos`, `selecionarGrupo`, `_grupos`, `_grupoAtual` **ficam** em `script.js` porque o bloco de Ações em Lote (`script.js:2773-3131`, não tocado nesta task) depende deles. Só o formulário de edição sai.

- [ ] **Passo 1: Ler o estado atual antes de editar**

Ler `Projeto RH/script.js:2712-2771` (`_renderGrupoDetalhe`) por completo para identificar, dentro dessa função, exatamente onde termina o formulário de edição (campos `grpNome`, `grpEmailResponsavel`, `grpObservacoes`, lista de empresas do grupo com botão de remover, busca+adicionar empresa, botões "Salvar"/"Excluir") e onde começa o fragmento "Ações em Lote" (linhas ~2753-2766, com `baixarModelosGrupo()`, `processarLoteGrupo()`, `abrirExportacaoTxtGrupo()`).

- [ ] **Passo 2: Colar a UI de edição em `configuracoes.html`/`.js`**

Adicionar aba na sidebar de `configuracoes.html`:
```html
<button class="sidebar-item" id="nav-grupos" onclick="abrirAba('grupos', this)">
    <span class="sidebar-item-icon">👥</span> Grupos de Empresas
</button>
```

Adicionar o painel, reproduzindo a estrutura de lista + detalhe do `#gruposScreen` original (`index.html:269-283`) mas com o formulário de edição completo (o que hoje está dentro de `_renderGrupoDetalhe`, MENOS o fragmento de Ações em Lote):
```html
<div id="grupos" class="admin-tab-content">
    <div class="admin-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
            <h2 style="margin:0;">👥 Grupos de Empresas</h2>
            <button type="button" class="btn-save" onclick="novoGrupoCfg()">➕ Novo Grupo</button>
        </div>
        <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">
            <div style="flex: 0 0 260px; border:1px solid #E0E0E0; border-radius:8px; overflow:hidden;">
                <div id="listaGruposCfg"></div>
            </div>
            <div style="flex: 1 1 420px; border:1px solid #E0E0E0; border-radius:8px; padding:16px;" id="grupoDetalheCfg">
                <p style="color: #7F8C8D; font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>
            </div>
        </div>
    </div>
</div>
```

Em `configuracoes.js`, colar verbatim (com sufixo `Cfg` em toda função/variável/id para não colidir com nenhuma outra aba, e usando `_todasEmpresas` em vez de `state.empresas`):
- `carregarGrupos` → `carregarGruposCfg`
- `renderizarListaGrupos` → `renderizarListaGruposCfg`
- `novoGrupo` → `novoGrupoCfg`
- `selecionarGrupo` → `selecionarGrupoCfg`
- `salvarGrupo` → `salvarGrupoCfg`
- `excluirGrupo` → `excluirGrupoCfg`
- `_renderGrpEmpresasList` → `_renderGrpEmpresasListCfg`
- `removerEmpresaGrupo` → `removerEmpresaGrupoCfg`
- `filtrarEmpresasGrupo` → `filtrarEmpresasGrupoCfg`
- `adicionarEmpresaGrupo` → `adicionarEmpresaGrupoCfg`
- `_renderGrupoDetalhe` → `_renderGrupoDetalheCfg` (colar SEM o fragmento de Ações em Lote identificado no Passo 1)
- Estado local: `let _gruposCfg = []; let _grupoAtualCfg = null;`
- Todo id referenciado dentro dessas funções (`listaGrupos`, `grupoDetalhe`, `grpNome`, etc.) ganha o sufixo `Cfg` tanto no JS quanto no HTML do Passo acima, para não colidir com o `#gruposScreen` que continua em `Projeto RH/index.html`.

Chamar `carregarGruposCfg()` dentro do `DOMContentLoaded` já existente em `configuracoes.js`, junto às outras chamadas de `carregarX()`.

- [ ] **Passo 3: Simplificar `#gruposScreen` em `Projeto RH/index.html` para somente leitura + lote**

Trocar o botão "➕ Novo Grupo" (`index.html:273`) — remover (não existe mais criação ali). O painel de detalhe (`#grupoDetalhe`) passa a ser preenchido pela versão de `_renderGrupoDetalhe` que sobra em `script.js` depois do Passo 4 (resumo do grupo somente leitura + fragmento de Ações em Lote).

- [ ] **Passo 4: Editar `_renderGrupoDetalhe` em `script.js` para remover o formulário de edição**

Em `script.js:2712-2771`, remover todo o HTML/lógica de formulário (campos de nome/e-mail/observações/lista de empresas com remover/adicionar, botões salvar/excluir) identificados no Passo 1, substituindo por um resumo somente leitura (nome do grupo, quantidade de empresas, lista de códigos) seguido do fragmento de Ações em Lote (linhas ~2753-2766) que **permanece idêntico, sem alteração**. Adicionar uma linha de aviso no topo do resumo:
```javascript
`<p style="font-size:12px; color:#7F8C8D; margin-bottom:12px;">Para criar, editar ou excluir grupos, use <a href="../Projeto Departamento Pessoal/configuracoes.html?tab=grupos">Departamento Pessoal › Configurações</a>.</p>`
```

- [ ] **Passo 5: Remover as funções de edição de `script.js`**

Apagar `novoGrupo`, `salvarGrupo`, `excluirGrupo`, `_renderGrpEmpresasList`, `removerEmpresaGrupo`, `filtrarEmpresasGrupo`, `adicionarEmpresaGrupo` (mantendo `carregarGrupos`, `renderizarListaGrupos`, `selecionarGrupo`, `_grupos`, `_grupoAtual`, e todo o bloco de Ações em Lote intocados).

- [ ] **Passo 6: Verificação**

```bash
grep -n "function novoGrupo\b\|function salvarGrupo\b\|function excluirGrupo\b\|function filtrarEmpresasGrupo\b\|function adicionarEmpresaGrupo\b" "Projeto RH/script.js"
```
Esperado: zero ocorrências.

```bash
grep -n "novoGrupo(\|salvarGrupo(\|excluirGrupo(\|filtrarEmpresasGrupo(\|adicionarEmpresaGrupo(" "Projeto RH/index.html" "Projeto RH/script.js"
```
Esperado: zero ocorrências (nenhum `onclick` ainda chamando as funções removidas).

- [ ] **Passo 7: Smoke test manual**

Em Configurações, criar um grupo novo, adicionar 2 empresas, salvar, editar o nome, excluir o grupo — tudo deve funcionar. Em `Projeto RH/index.html`, abrir "Grupos de Empresas", confirmar que a lista aparece, selecionar um grupo e confirmar que o botão de exportação em lote/baixar modelos continua funcionando exatamente como antes.

- [ ] **Passo 8: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js" "Projeto Departamento Pessoal/configuracoes.html" "Projeto Departamento Pessoal/configuracoes.js"
git commit -m "$(cat <<'EOF'
refactor(dp): move CRUD de Grupos de Empresas para Configuracoes

Criar/editar/excluir grupo agora só existe em Configuracoes; o
Controle de Frequencia mantém a tela de Grupos apenas para consulta e
para a ferramenta de exportação em lote, que depende do mesmo estado
carregado ali e não foi tocada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Mover "Configuração por Empresa" (Rubricas/Jornadas/E-mail Responsável) para Configurações

**Files:**
- Modify: `Projeto RH/index.html:46-48,1090-1456,1549-1559` (remover botão sidebar + modal + floating div)
- Modify: `Projeto RH/script.js` (remover os trechos listados abaixo)
- Modify: `Projeto Departamento Pessoal/configuracoes.html` / `.js` (adicionar aba)

**Interfaces:**
- Consumes: `supabaseClient`, `mostrarMensagem`, `_todasEmpresas` (em `configuracoes.js`); tabelas `rh_config_rubricas_txt`, `rh_jornadas`, `rh_empregados.jornada_id`, `rh_empresas.email_responsavel`.
- Produces: aba "Configuração por Empresa" em Configurações.

⚠️ **NÃO mover** (ficam em `script.js` porque o motor de cálculo/exportação de TXT/recibo/PDF as chama diretamente): `_buscarCatalogoRubricas` (1987-2004), `_buscarConfigRubricas` (2005-2029), `_resolverPeriodoApuracao` (2030-2039), `_resolverPeriodoBeneficios` (2059-2076), `_competenciaMesSeguinte` (2077-2083), `_pdfIndividualAtivo` (2084-2087), `_textoPeriodoApuracao` (2104-2112), `_labelPeriodoFolhaPonto` (2113-2119), `_buscarValoresVaVtEmpresa` (2122-2140), `_aplicarConfigRubricasNoCampos` (2141-2150), `_buscarJornadas` (2292-2310), `_invalidarCacheJornadas` (2311-2314), e a constante `_CFG_EVENTOS` (1970-1982, usada por `_aplicarConfigRubricasNoCampos` — **copiar**, não mover, para dentro de `configuracoes.js` também).

- [ ] **Passo 1: Ler os trechos fonte exatos**

Ler, em `Projeto RH/index.html`: `46-48` (botão sidebar), `1090-1456` (modal `#configRubricasModal`), `1549-1559` (`#cfgBuscaEmpresaResultados`).

Ler, em `Projeto RH/script.js`: `1970-1982` (`_CFG_EVENTOS`, copiar), `2151-2211` (`_preencherCamposConfigRubricas`), `2215-2219` (`_preencherEmailResponsavelConfig`), `2220-2284` (`_limparCamposConfigRubricas`), `2286-2528` (bloco inteiro de Jornadas Extras: `_carregarSecaoJornadasConfig`, `_renderizarListaJornadasConfig`, `abrirFormNovaJornada`, `cancelarFormJornada`, `editarJornadaConfig`, `salvarJornadaConfig`, `excluirJornadaConfig`, `_carregarEmpregadosConfigAssociacao`, `_renderizarAssociacaoEmpregadosConfig`, `salvarAssociacoesJornadaEmpregados`, e o estado `_jornadasConfigAtual`/`_empregadosConfigAtual`), `3133-3263` (`abrirModalConfigRubricas`, `fecharModalConfigRubricas`, `filtrarEmpresasConfig`, `selecionarEmpresaConfig`, `salvarConfigRubricas`, `limparConfigRubricas`).

- [ ] **Passo 2: Colar em `configuracoes.html`**

Adicionar aba na sidebar:
```html
<button class="sidebar-item" id="nav-configEmpresa" onclick="abrirAba('configEmpresa', this)">
    <span class="sidebar-item-icon">🏷️</span> Configuração por Empresa
</button>
```

Colar o conteúdo de `index.html:1090-1456` como corpo de uma nova `<div id="configEmpresa" class="admin-tab-content">` em vez de `<div id="configRubricasModal" class="modal">` (ou seja: remove o wrapper `.modal`/`.modal-content`/`.modal-header`/`.modal-close`/botão "×", mantém tudo o que está dentro do `.modal-body` como conteúdo direto da aba, e move os botões do `.modal-footer` — "🗑 Limpar Empresa", "💾 Salvar" — para o final do corpo da aba, como botões normais). Todos os ids internos (`cfgCodigoEmpresa`, `cfgBuscaEmpresa`, os campos de rubrica/jornada/e-mail/observações) permanecem exatamente iguais, pois o JS colado no próximo passo os referencia por esses nomes.

Colar `index.html:1549-1559` (`#cfgBuscaEmpresaResultados`) como elemento solto no final do `<body>`, igual ao padrão já usado para `#vvBuscaEmpresaResultados` na Task 4.

- [ ] **Passo 3: Colar em `configuracoes.js`**

Colar, nesta ordem, verbatim (nenhuma renomeação necessária — nenhum desses nomes existe hoje em `configuracoes.js`, confirmar com grep antes de colar):
1. `_CFG_EVENTOS` (constante, copiada de `script.js:1970-1982`).
2. `script.js:2151-2284` (`_preencherCamposConfigRubricas`, `_preencherEmailResponsavelConfig`, `_limparCamposConfigRubricas`).
3. `script.js:2286-2528` (bloco de Jornadas Extras completo).
4. `script.js:3133-3263` (as 6 funções do modal).

Em toda ocorrência de `state.empresas` dentro desses trechos, trocar por `_todasEmpresas` (mesma adaptação mecânica da Task 4).

- [ ] **Passo 4: Remover do `Projeto RH/index.html`**

Apagar `46-48` (botão sidebar "⚙️ Configurações"), `1090-1456` (modal), `1549-1559` (floating div).

- [ ] **Passo 5: Remover de `Projeto RH/script.js`**

Apagar `1970-1982`, `2151-2284`, `2286-2528`, `3133-3263`. **Não apagar** nada fora dessas 4 faixas — em especial não tocar `1987-2150` nem `2292-2314` do bloco de leitura, que ficam intocados (a faixa 2286-2528 do bloco de Jornadas Extras a apagar termina exatamente onde começa o próximo trecho a manter; ao editar, conferir contra a lista de "NÃO mover" acima antes de apagar cada faixa).

- [ ] **Passo 6: Verificação**

```bash
grep -n "function abrirModalConfigRubricas\|function salvarConfigRubricas\|function _carregarSecaoJornadasConfig\|function salvarJornadaConfig" "Projeto RH/script.js"
```
Esperado: zero ocorrências.

```bash
grep -n "function _buscarConfigRubricas\|function _buscarJornadas\|function _aplicarConfigRubricasNoCampos" "Projeto RH/script.js"
```
Esperado: as 3 funções continuam presentes (não foram tocadas).

- [ ] **Passo 7: Smoke test manual**

Em Configurações, abrir "Configuração por Empresa", buscar uma empresa, confirmar que os campos de rubrica/jornada/e-mail carregam os valores já salvos, editar e salvar, recarregar e confirmar persistência. Testar também criar uma jornada extra e associá-la a um empregado. Depois, em `Projeto RH/index.html`, gerar um TXT de folha de ponto de uma empresa com config de rubrica customizada e confirmar que o TXT sai exatamente igual a antes (usa `_buscarConfigRubricas`, que não foi alterado).

- [ ] **Passo 8: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js" "Projeto Departamento Pessoal/configuracoes.html" "Projeto Departamento Pessoal/configuracoes.js"
git commit -m "$(cat <<'EOF'
refactor(dp): move Configuracao por Empresa (rubricas/jornadas/e-mail) para Configuracoes

A UI de edição de rh_config_rubricas_txt, jornadas extras e e-mail do
responsável sai do Controle de Frequência; as funções de leitura
usadas pelo motor de calculo/exportação de TXT continuam em script.js
sem alteração.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Mover "Folha Contratada + Responsáveis" para Configurações

**Files:**
- Modify: `Projeto Fechamento Folha/controle.html:152-165,277-352` (remover itens de sidebar + view + modais)
- Modify: `Projeto Fechamento Folha/controle.js` (remover linhas 829-1235)
- Modify: `Projeto Departamento Pessoal/configuracoes.html` / `.js` (adicionar aba)

**Interfaces:**
- Consumes: `supabaseClient`, `mostrarMensagem` (já existem em `configuracoes.js`); precisa carregar `empresasCache`/`usuariosCache` de forma própria (nova leitura, mesmas tabelas que `controle.js` usa via `carregarBase()` — provavelmente `rh_empresas` e uma tabela de usuários do portal; ler `controle.js:106-143` antes de escrever essa parte para replicar exatamente as mesmas 2-3 queries).
- Produces: aba "Folha Contratada" em Configurações.

⚠️ **NÃO mover**: `carregarBase` (106-143), `possuiFolha` (145-147), `nomeEmpresa` (149-155), e o estado `empresasFolhaCache`/`folhaConfigPorEmpresa`/`responsaveisFolhaPorEmpresa` (20-22) — usados por `popularSelectEmpresaConfig` (594) e `abrirModalReplicarFluxoCF` (763), que ficam no dashboard/fluxo de fechamento.

- [ ] **Passo 1: Ler os trechos fonte exatos**

Ler `Projeto Fechamento Folha/controle.html:277-311` (`#telaConfigEmpresasCF`), `316-327` (`#modalResponsaveisCF`), `330-352` (`#modalResponsavelUsuarioCF`), e `Projeto Fechamento Folha/controle.js:829-1235` (todo o bloco final do arquivo). Ler também `controle.js:106-143` (`carregarBase`) só para identificar exatamente como `empresasCache`/`usuariosCache` são populados (não copiar essa função — replicar as mesmas queries numa função nova e independente em `configuracoes.js`).

- [ ] **Passo 2: Colar em `configuracoes.html`**

Adicionar aba na sidebar:
```html
<button class="sidebar-item" id="nav-folhaContratada" onclick="abrirAba('folhaContratada', this)">
    <span class="sidebar-item-icon">🏢</span> Folha Contratada
</button>
```

Colar o conteúdo de `controle.html:277-311` (`#telaConfigEmpresasCF`) como corpo de `<div id="folhaContratada" class="admin-tab-content">` (removendo qualquer classe/atributo específico do sistema de `navegarPara` do `controle.html` que não exista em `configuracoes.html`, como `style="display:none;"` controlado por aquele roteador — a visibilidade agora é só via `.admin-tab-content.active`, igual às outras abas). Colar `controle.html:316-327` (`#modalResponsaveisCF`) e `330-352` (`#modalResponsavelUsuarioCF`) como elementos soltos antes do fechamento de `</body>`, mantendo a classe `.modal` (já suportada pelo `Projeto RH/styles.css` linkado em `configuracoes.html` desde a Task 3 — confirmar que `.modal`/`.modal-content`/`.modal-header` de `Projeto RH/styles.css` e `Projeto Fechamento Folha/styles.css` não conflitam de forma que quebre a exibição; se o modal não abrir/estilizar corretamente no smoke test do Passo 6, adicionar também `<link rel="stylesheet" href="../Projeto Fechamento Folha/styles.css">` em `configuracoes.html`).

- [ ] **Passo 3: Colar em `configuracoes.js`**

Colar `controle.js:829-1235` verbatim. Antes de colar, adicionar as 3 declarações de estado que esse bloco usa (copiadas de `controle.js:20-22`, com nomes idênticos — são exclusivas deste bloco, não colidem com nada em `configuracoes.js`):
```javascript
let empresasFolhaCache = [];
let folhaConfigPorEmpresa = {};
let responsaveisFolhaPorEmpresa = {};
```

Adicionar uma função nova (não existe no original — é a substituição local e independente de `carregarBase()`, replicando exatamente as mesmas queries que populavam `empresasCache`/`usuariosCache`/`folhaConfigPorEmpresa`/`responsaveisFolhaPorEmpresa` em `controle.js:106-143`; escrever essa função lendo o texto exato dessas linhas no momento da implementação e mantendo as mesmas tabelas/campos/filtros — só o nome da função muda, para não colidir): `async function carregarBaseFolhaContratada() { /* mesmas queries de controle.js:106-143, restritas às tabelas que este bloco usa */ }`. Chamar essa função dentro do `DOMContentLoaded` de `configuracoes.js`.

Se `escapeHtml` não existir ainda em `configuracoes.js` (`grep -n "function escapeHtml" "Projeto Departamento Pessoal/configuracoes.js"`), copiar verbatim de `controle.js:262-264`.

- [ ] **Passo 4: Remover de `Projeto Fechamento Folha/controle.html`**

Apagar os itens de sidebar `157-165` (`navConfigFluxoCF` fica, só `navConfigEmpresasCF` — linhas 160-162 — é removido), a view `277-311`, e os modais `316-327` e `330-352`.

- [ ] **Passo 5: Remover de `Projeto Fechamento Folha/controle.js`**

Apagar `829-1235` (até o fim do arquivo).

- [ ] **Passo 6: Verificação**

```bash
grep -n "function iniciarConfigEmpresas\|function toggleFolhaHtml\|function salvarFolhaLote\|navConfigEmpresasCF" "Projeto Fechamento Folha/controle.html" "Projeto Fechamento Folha/controle.js"
```
Esperado: zero ocorrências.

```bash
grep -n "function possuiFolha\|function carregarBase\b" "Projeto Fechamento Folha/controle.js"
```
Esperado: as 2 funções continuam presentes.

- [ ] **Passo 7: Smoke test manual**

Em Configurações, abrir "Folha Contratada", marcar/desmarcar "possui folha" para uma empresa de teste, definir um responsável, salvar. Depois, em `Projeto Fechamento Folha/controle.html`, abrir "Fluxo por Empresa" e confirmar que só aparecem as empresas marcadas como "possui folha" (mesmo comportamento de antes, lido por `possuiFolha()` que não foi tocado).

- [ ] **Passo 8: Commit**

```bash
git add "Projeto Fechamento Folha/controle.html" "Projeto Fechamento Folha/controle.js" "Projeto Departamento Pessoal/configuracoes.html" "Projeto Departamento Pessoal/configuracoes.js"
git commit -m "$(cat <<'EOF'
refactor(dp): move UI de Folha Contratada + Responsaveis para Configuracoes

fechamento_empresas_config e fechamento_empresas_responsaveis passam a
ser editados só em Configuracoes; o dashboard de fases do Fechamento
Folha continua lendo possuiFolha()/carregarBase() sem alteração.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Corrigir os links de feriados que apontavam para `admin.html#feriados`

**Files:**
- Modify: `Projeto RH/index.html:637,656`

**Interfaces:**
- Consumes: roteamento por hash já existente em `configuracoes.js` (`admin.js:65-68`, preservado nas Tasks anteriores).

- [ ] **Passo 1: Atualizar os 2 links**

Em `Projeto RH/index.html`, trocar as duas ocorrências de:
```html
<a href="admin.html#feriados" target="_blank" rel="noopener">
```
por:
```html
<a href="../Projeto Departamento Pessoal/configuracoes.html#feriados" target="_blank" rel="noopener">
```
(linhas 637 e 656 — uma é um link de texto, outra é `class="btn btn-primary btn-small"`, manter o restante de cada tag como está, só trocar o `href`).

- [ ] **Passo 2: Verificação**

```bash
grep -n "admin.html" "Projeto RH/index.html"
```
Esperado: zero ocorrências.

- [ ] **Passo 3: Smoke test manual**

No Controle de Frequência, clicar em "➕ Gerenciar feriados" (perto da tela de Gerar Escala) e confirmar que abre `configuracoes.html` já na aba Feriados.

- [ ] **Passo 4: Commit**

```bash
git add "Projeto RH/index.html"
git commit -m "$(cat <<'EOF'
fix(dp): corrige links de feriados para apontar para Configuracoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: SQL — repontar o card "Departamento Pessoal" e desativar os cards que entraram no hub

**Files:**
- Create: `_sql/reorganizar_ferramentas_dp.sql`

**Interfaces:**
- Consumes: tabela `public.ferramentas` (colunas `id, nome, descricao, icone, url_base, ativa, ordem` — já existentes, ver `schema.sql`).

- [ ] **Passo 1: Confirmar os nomes exatos das linhas em produção antes de escrever o UPDATE definitivo**

Rodar (via `supabase db query --linked` ou painel):
```sql
select nome, url_base, ativa from public.ferramentas
where nome ilike '%folha%' or nome ilike '%frequência%' or nome ilike '%frequencia%'
   or nome ilike '%simulador%' or nome ilike '%validação%' or nome ilike '%validacao%'
   or nome ilike '%calendário%' or nome ilike '%calendario%' or nome ilike '%departamento pessoal%'
   or nome ilike '%admin%rh%' or nome ilike '%módulo rh%' or nome ilike '%modulo rh%';
```
Usar os nomes exatos retornados para preencher o script abaixo (os nomes usados aqui são os documentados na spec, mas PRECISAM ser confirmados contra produção antes de rodar o UPDATE — nomes divergentes silenciosamente não afetam nenhuma linha).

- [ ] **Passo 2: Escrever o script**

```sql
-- Reorganiza as ferramentas de Departamento Pessoal num hub único.
-- Idempotente: pode ser rodado mais de uma vez sem efeito colateral.

-- 1. O card "Departamento Pessoal" passa a apontar para o novo hub.
update public.ferramentas
set url_base = './Projeto Departamento Pessoal/index.html',
    descricao = 'Hub com todas as ferramentas de Departamento Pessoal: Controle de Frequência, Lançamentos, Simulador, Fechamento, Validação, Calendário, Fluxos Operacionais e Configurações.'
where nome = 'Departamento Pessoal';

-- 2. As ferramentas que entraram como cards dentro do hub saem da tela
--    principal do portal (soft-deactivate, não delete — preserva
--    usuario_ferramentas e permite reverter facilmente).
update public.ferramentas
set ativa = false
where nome in (
    'Folha de Ponto',                        -- Controle de Frequência - Ponto
    'Lançamentos de Folha',
    'Simulador de Folha de Pagamento',
    'Fechamento Folha de Pagamento',
    'Validação de Fechamento de Folha',
    'Calendário da Folha',
    'Admin – Módulo RH'
);
```

- [ ] **Passo 3: Rodar o script contra o Supabase (requer aprovação e credencial do usuário)**

```bash
supabase db query --linked --file "_sql/reorganizar_ferramentas_dp.sql"
```

- [ ] **Passo 4: Verificar o resultado**

```sql
select nome, url_base, ativa from public.ferramentas
where nome in ('Departamento Pessoal', 'Folha de Ponto', 'Lançamentos de Folha',
  'Simulador de Folha de Pagamento', 'Fechamento Folha de Pagamento',
  'Validação de Fechamento de Folha', 'Calendário da Folha', 'Admin – Módulo RH');
```
Esperado: `Departamento Pessoal` com `ativa=true` e o novo `url_base`; as outras 6 (ou 7, se "Calendário da Folha" existir com esse nome exato) com `ativa=false`.

- [ ] **Passo 5: Smoke test manual**

Logar no portal com um usuário comum (não-admin) que já tinha acesso a "Departamento Pessoal" antes da mudança e confirmar que: (a) ele ainda vê o card e consegue entrar sem erro de permissão; (b) os outros 6-7 cards não aparecem mais para nenhum usuário na tela principal.

- [ ] **Passo 6: Commit**

```bash
git add "_sql/reorganizar_ferramentas_dp.sql"
git commit -m "$(cat <<'EOF'
feat(dp): SQL para repontar Departamento Pessoal ao novo hub e desativar cards antigos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Cobertura da spec:** hub com 8 cards (Task 2), Fluxos Operacionais renomeado (Task 1), Configurações única reunindo VA/VT (Task 4), Grupos de Empresas (Task 5), Configuração por Empresa/Rubricas/Jornadas — achado durante a investigação, fora do escopo original da spec mas do mesmo tipo de config global por empresa (Task 6), Empresas/Empregados/Rubricas/Feriados/Sócios via Admin RH (Task 3), Folha Contratada + Responsáveis (Task 7), links de feriados corrigidos (Task 8), portal repontado (Task 9). Nenhum requisito da spec ficou sem task correspondente.

**Placeholders:** nenhum "TBD"/"implementar depois" — todas as migrações de código grande usam recorte por linha exata (método documentado na seção de Contexto) em vez de reprodução integral, o que é a forma correta de planejar relocação verbatim de ~2000 linhas de código legado sem transcrever manualmente todo o conteúdo (que já está no repositório e será lido diretamente pelo executor).

**Consistência de nomes:** conferido que os sufixos `Cfg` (Task 5) e a ausência de sufixo nas Tasks 4/6/7 (nomes originais, sem colisão confirmada por grep prévio) são usados de forma consistente entre as tasks — nenhuma task posterior referencia um nome de função definido diferente numa task anterior.

**Risco aceito e documentado:** possível conflito visual leve entre `Projeto RH/styles.css` e `Projeto Fechamento Folha/styles.css` linkados juntos em `configuracoes.html` (Task 7) — mitigação já descrita no próprio passo (checar no smoke test, linkar a segunda folha de estilo só se necessário).
