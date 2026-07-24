# Controle de Fechamento da Folha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um módulo novo, `Projeto Fechamento Folha/controle.html` + `controle.js`, que mostra um Dashboard com todas as empresas configuradas (competência aberta, status, responsável, progresso das fases) e uma tela de Configuração (só admin) onde se monta o fluxo de fases de cada empresa.

**Architecture:** Página HTML/JS vanilla independente, seguindo exatamente o padrão de `quadrante.html`/`quadrante.js` (sidebar estático, `styles.css` compartilhado, `portal-auth-guard.js`, cliente Supabase próprio por arquivo). Duas "telas" (`#telaDashboardCF` / `#telaConfigCF`) alternadas por `navegarPara(modo)`, como em `quadrante.js`. Dados novos em 4 tabelas Supabase (projeto Portal): catálogo global de fases, config de fases por empresa, ciclo mensal por empresa e as fases de cada ciclo. Reaproveita `rh_empresas` (lista de empresas) e `usuarios` (responsáveis + `is_admin`) já existentes.

**Tech Stack:** HTML/CSS/JS estático, Supabase JS v2 (CDN), sem bundler nem framework. Não há suíte de testes automatizada neste projeto — a verificação de cada task usa `grep` (checagem estrutural determinística) e a task final é uma verificação manual no navegador.

## Global Constraints

- Módulo novo e separado — não alterar `fluxo.html`/`fluxo.js` nem seu estado em `localStorage`.
- Reaproveitar `rh_empresas` (`codigo_empresa`, `nome_empresa`) e `usuarios` (`id`, `nome`, `is_admin`) — não duplicar cadastro de empresas nem de usuários.
- RLS de todas as tabelas novas: `TO authenticated USING (TRUE) WITH CHECK (TRUE)` (mesmo padrão de `fechamento_rubricas_config`).
- Empresa só aparece no Dashboard depois de ter ao menos uma fase ativa em `fechamento_config_empresa_fase` (sem flag extra de "ativa no fechamento").
- Status do ciclo é **calculado**, nunca gravado como coluna: sem ciclo → "Não iniciada"; ciclo com fase pendente/andamento → "Em execução"; todas as fases concluídas → "Fechada" (grava/limpa `concluido_em` automaticamente na transição).
- Delegação de responsável é só por empresa/ciclo (campo `fechamento_ciclo.responsavel_id`) — sem delegação por fase.
- Tela de Configuração bloqueada por `auth.isAdmin` (retornado por `PortalAuthGuard.init`), com dupla checagem: nav item escondido + guarda dentro de `iniciarConfig()`.
- Competência é sempre o mês corrente no formato `'MM/AAAA'`, calculada em runtime — não há seletor de competências passadas nesta versão.
- Este agente só tem a chave `anon` do Supabase — não consegue rodar DDL. O arquivo `schema_controle_fechamento.sql` precisa ser executado manualmente pelo usuário no SQL Editor do Supabase (projeto Portal) antes do teste manual da Task 5.

---

### Task 1: Schema SQL — tabelas novas do Controle de Fechamento

**Files:**
- Create: `Projeto Fechamento Folha/schema_controle_fechamento.sql`

**Interfaces:**
- Produces: tabelas `fechamento_fases_catalogo`, `fechamento_config_empresa_fase`, `fechamento_ciclo`, `fechamento_ciclo_fase` — consumidas por `controle.js` (Task 3).

- [ ] **Step 1: Criar o arquivo de schema**

```sql
-- ============================================================
-- SCONT – CONTROLE DE FECHAMENTO DA FOLHA
-- Tabelas do módulo de controle de processo (dashboard + configuração)
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

-- Catálogo global de fases sugeridas (apoio de UI na tela de Configuração)
CREATE TABLE IF NOT EXISTS public.fechamento_fases_catalogo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL UNIQUE,
    ordem_padrao    INT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fechamento_fases_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_fases_catalogo: leitura autenticado" ON public.fechamento_fases_catalogo;
DROP POLICY IF EXISTS "fechamento_fases_catalogo: escrita autenticado"  ON public.fechamento_fases_catalogo;

CREATE POLICY "fechamento_fases_catalogo: leitura autenticado"
    ON public.fechamento_fases_catalogo FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_fases_catalogo: escrita autenticado"
    ON public.fechamento_fases_catalogo FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

INSERT INTO public.fechamento_fases_catalogo (nome, ordem_padrao) VALUES
    ('Apuração da Frequência',              1),
    ('Lançamento na Domínio',               2),
    ('Geração da Prévia',                   3),
    ('Validação Cliente',                   4),
    ('Fechamento eSocial e Relatórios',     5),
    ('Guia FGTS',                           6),
    ('Guia Previdenciária',                 7),
    ('Onvio - Gestta',                      8),
    ('Servidor',                            9),
    ('Geração dos Benefícios - VA e VT',   10)
ON CONFLICT (nome) DO NOTHING;


-- ============================================================
-- Fluxo de fases configurado por empresa (tela de Configuração)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_config_empresa_fase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    nome_fase       TEXT NOT NULL,
    ordem           INT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_config_empresa
    ON public.fechamento_config_empresa_fase (codigo_empresa);

ALTER TABLE public.fechamento_config_empresa_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_config_empresa_fase: leitura autenticado" ON public.fechamento_config_empresa_fase;
DROP POLICY IF EXISTS "fechamento_config_empresa_fase: escrita autenticado"  ON public.fechamento_config_empresa_fase;

CREATE POLICY "fechamento_config_empresa_fase: leitura autenticado"
    ON public.fechamento_config_empresa_fase FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_config_empresa_fase: escrita autenticado"
    ON public.fechamento_config_empresa_fase FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- Ciclo de fechamento: 1 linha por empresa x competência
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_ciclo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    competencia     TEXT NOT NULL, -- formato 'MM/AAAA'
    responsavel_id  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    iniciado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluido_em    TIMESTAMPTZ,

    CONSTRAINT fechamento_ciclo_unique UNIQUE (codigo_empresa, competencia)
);

CREATE INDEX IF NOT EXISTS idx_fechamento_ciclo_empresa
    ON public.fechamento_ciclo (codigo_empresa);

ALTER TABLE public.fechamento_ciclo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_ciclo: leitura autenticado" ON public.fechamento_ciclo;
DROP POLICY IF EXISTS "fechamento_ciclo: escrita autenticado"  ON public.fechamento_ciclo;

CREATE POLICY "fechamento_ciclo: leitura autenticado"
    ON public.fechamento_ciclo FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_ciclo: escrita autenticado"
    ON public.fechamento_ciclo FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- Fases do ciclo (instância mensal, geradas a partir da config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_ciclo_fase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id        UUID NOT NULL REFERENCES public.fechamento_ciclo(id) ON DELETE CASCADE,
    nome_fase       TEXT NOT NULL,
    ordem           INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'andamento', 'concluida')),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_ciclo_fase_ciclo
    ON public.fechamento_ciclo_fase (ciclo_id);

ALTER TABLE public.fechamento_ciclo_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_ciclo_fase: leitura autenticado" ON public.fechamento_ciclo_fase;
DROP POLICY IF EXISTS "fechamento_ciclo_fase: escrita autenticado"  ON public.fechamento_ciclo_fase;

CREATE POLICY "fechamento_ciclo_fase: leitura autenticado"
    ON public.fechamento_ciclo_fase FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_ciclo_fase: escrita autenticado"
    ON public.fechamento_ciclo_fase FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Step 2: Verificar**

Run:
```bash
grep -n "CREATE TABLE IF NOT EXISTS public.fechamento_" "Projeto Fechamento Folha/schema_controle_fechamento.sql"
```
Expected: 4 linhas, uma para cada tabela (`fechamento_fases_catalogo`, `fechamento_config_empresa_fase`, `fechamento_ciclo`, `fechamento_ciclo_fase`).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Fechamento Folha/schema_controle_fechamento.sql"
git commit -m "feat(controle-fechamento): schema das 4 tabelas do módulo"
```

---

### Task 2: HTML — `controle.html` (Dashboard + Configuração)

**Files:**
- Create: `Projeto Fechamento Folha/controle.html`

**Interfaces:**
- Consumes: `styles.css`, `../supabase-config.js`, `../portal-auth-guard.js` (já existentes).
- Produces: elementos DOM consumidos por `controle.js` (Task 3) — `hamburger`, `sidebar`, `sidebarOverlay`, `navDashboardCF`, `navConfigCF`, `telaDashboardCF`, `telaConfigCF`, `corpoDashboard`, `selectEmpresaConfig`, `listaFasesConfig`, `selectCatalogoAdd`, `inputNovaFase`, `messageModal`, `messageTitle`, `messageText`.

- [ ] **Step 1: Criar o arquivo**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Controle de Fechamento – SCONT</title>
    <link rel="stylesheet" href="styles.css">
    <script src="../supabase-config.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="../portal-auth-guard.js"></script>
    <style>
        #telaDashboardCF, #telaConfigCF { display: none; }
        #telaDashboardCF.active, #telaConfigCF.active { display: block; }

        .badge-nao-iniciada { background: #eceff1; color: #455a64; }
        .badge-em-execucao  { background: #fff3e0; color: #e65100; }
        .badge-fechada      { background: #e8f5e9; color: #2e7d32; }

        .expand-toggle { cursor: pointer; display: inline-block; margin-right: 6px; user-select: none; }

        .fase-lista { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; }
        .fase-item {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 8px 12px; background: var(--background-color);
            border-radius: 6px; font-size: 13px;
        }
        .fase-nome { font-weight: 600; }
        .fase-config-acoes { display: flex; gap: 6px; }
        .config-add-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin: 16px 0; }
        .config-add-row .form-group { margin-bottom: 0; flex: 1; min-width: 220px; }
    </style>
</head>
<body>

<!-- HAMBURGER (mobile) -->
<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- SIDEBAR ESTÁTICO -->
<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
        <h2>Fechamento Folha</h2>
        <p>Controle de Fechamento</p>
    </div>

    <nav class="sidebar-nav">
        <div class="sidebar-section">Controle de Fechamento</div>

        <button class="sidebar-item active" id="navDashboardCF" onclick="navegarPara('dashboard')">
            <span class="sidebar-item-icon">📊</span> Dashboard
        </button>
        <button class="sidebar-item" id="navConfigCF" onclick="navegarPara('config')" style="display:none;">
            <span class="sidebar-item-icon">⚙️</span> Configuração
        </button>

        <div class="sidebar-divider"></div>

        <div class="sidebar-section">Navegação</div>
        <a href="index.html" class="sidebar-item">
            <span class="sidebar-item-icon">🏠</span> Início
        </a>
        <a href="../portal.html" class="sidebar-item">
            <span class="sidebar-item-icon">🌐</span> Portal SCONT
        </a>
    </nav>

    <div class="sidebar-footer">
        <div class="sidebar-footer-info">
            <strong>Fechamento Folha</strong>
            SCONT · Módulo de Folha
        </div>
    </div>
</aside>

<!-- CONTEÚDO PRINCIPAL -->
<div class="main-content">

    <div class="page-header">
        <div>
            <h1>Controle de Fechamento</h1>
            <div class="page-header-sub">Acompanhe o fechamento da folha por empresa, fase e responsável</div>
        </div>
    </div>

    <!-- TELA DASHBOARD -->
    <div id="telaDashboardCF" class="active">
        <div class="container">
            <div class="section-header">
                <h2>Empresas</h2>
                <p>Status do fechamento da competência aberta de cada empresa configurada</p>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Empresa</th>
                            <th>Competência</th>
                            <th>Status</th>
                            <th>Responsável</th>
                            <th>Progresso</th>
                            <th>Ação</th>
                        </tr>
                    </thead>
                    <tbody id="corpoDashboard">
                        <tr><td colspan="6">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- TELA CONFIGURAÇÃO -->
    <div id="telaConfigCF">
        <div class="container">
            <div class="section-header">
                <h2>Configuração do fluxo por empresa</h2>
                <p>Escolha as fases e a ordem do processo de fechamento de cada empresa</p>
            </div>

            <div class="form-group" style="max-width:320px;">
                <label for="selectEmpresaConfig">Empresa</label>
                <select id="selectEmpresaConfig" onchange="onEmpresaConfigChange()">
                    <option value="">Selecione a empresa...</option>
                </select>
            </div>

            <div id="listaFasesConfig">
                <em>Selecione uma empresa para configurar.</em>
            </div>

            <div class="config-add-row">
                <div class="form-group">
                    <label for="selectCatalogoAdd">Adicionar fase do catálogo</label>
                    <select id="selectCatalogoAdd">
                        <option value="">Selecione uma fase do catálogo...</option>
                    </select>
                </div>
                <button class="btn btn-secondary" onclick="adicionarFaseCatalogo()">+ Adicionar</button>
            </div>

            <div class="config-add-row">
                <div class="form-group">
                    <label for="inputNovaFase">Nova fase personalizada</label>
                    <input type="text" id="inputNovaFase" placeholder="Nome da fase">
                </div>
                <button class="btn btn-secondary" onclick="adicionarFaseCustom()">+ Nova fase</button>
            </div>

            <div class="btn-group">
                <button class="btn btn-primary" onclick="salvarConfig()">💾 Salvar configuração</button>
            </div>
        </div>
    </div>

</div><!-- /main-content -->

<!-- MODAL MENSAGEM -->
<div class="modal" id="messageModal">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="messageTitle">Aviso</h3>
            <button class="modal-close" onclick="fecharModal()">×</button>
        </div>
        <div class="modal-body">
            <p id="messageText"></p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary btn-small" onclick="fecharModal()">OK</button>
        </div>
    </div>
</div>

<script src="controle.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificar**

Run:
```bash
grep -n "id=\"telaDashboardCF\"\|id=\"telaConfigCF\"\|id=\"navConfigCF\"\|id=\"corpoDashboard\"\|id=\"selectEmpresaConfig\"\|id=\"messageModal\"" "Projeto Fechamento Folha/controle.html"
```
Expected: uma ocorrência de cada um dos 6 ids.

- [ ] **Step 3: Commit**

```bash
git add "Projeto Fechamento Folha/controle.html"
git commit -m "feat(controle-fechamento): markup do Dashboard e da Configuração"
```

---

### Task 3: JS — `controle.js` (auth, Dashboard e Configuração)

**Files:**
- Create: `Projeto Fechamento Folha/controle.js`

**Interfaces:**
- Consumes: `window.PortalAuthGuard.init`, `window.supabase.createClient`, `window.SUPABASE_URL`/`SUPABASE_KEY`, tabelas `rh_empresas`, `usuarios`, e as 4 tabelas da Task 1. Elementos DOM da Task 2.
- Produces: `navegarPara(modo)`, `iniciarCiclo(codigo_empresa)`, `atualizarResponsavel(ciclo_id, usuario_id)`, `atualizarStatusFase(fase_id, codigo_empresa, novoStatus)`, `toggleExpandir(codigo_empresa)`, `onEmpresaConfigChange()`, `adicionarFaseCatalogo()`, `adicionarFaseCustom()`, `moverFaseConfig(i, dir)`, `removerFaseConfig(i)`, `salvarConfig()`, `fecharModal()` — todos referenciados via `onclick` inline no HTML da Task 2.

- [ ] **Step 1: Criar o arquivo**

```js
/**
 * SCONT – Controle de Fechamento da Folha
 * Dashboard e configuração do fluxo de fases por empresa e competência.
 */

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdminAtual = false;
let empresasCache = [];
let usuariosCache = [];
let catalogoCache = [];
let ciclosCache = {};
let expandido = {};
let configFasesAtual = [];
let empresaConfigSelecionada = '';

const STATUS_CICLO_LABEL = { nao_iniciada: 'Não iniciada', em_execucao: 'Em execução', fechada: 'Fechada' };
const STATUS_CICLO_BADGE = { nao_iniciada: 'badge-nao-iniciada', em_execucao: 'badge-em-execucao', fechada: 'badge-fechada' };

// ──────────────────────────────────────────────
// MENSAGENS
// ──────────────────────────────────────────────
function mostrarMensagem(titulo, texto) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent = texto;
    document.getElementById('messageModal').classList.add('active');
}
function fecharModal() {
    document.getElementById('messageModal').classList.remove('active');
}

// ──────────────────────────────────────────────
// SIDEBAR
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebarOverlay');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
    }
    if (overlay) overlay.addEventListener('click', fecharSidebar);
});

function fecharSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function navegarPara(modo) {
    fecharSidebar();
    document.getElementById('navDashboardCF').classList.toggle('active', modo === 'dashboard');
    document.getElementById('navConfigCF').classList.toggle('active', modo === 'config');
    document.getElementById('telaDashboardCF').classList.toggle('active', modo === 'dashboard');
    document.getElementById('telaConfigCF').classList.toggle('active', modo === 'config');
    if (modo === 'dashboard') carregarDashboard();
    if (modo === 'config') iniciarConfig();
}

// ──────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;

    isAdminAtual = auth.isAdmin === true;
    document.getElementById('navConfigCF').style.display = isAdminAtual ? '' : 'none';

    await carregarBase();

    const params = new URLSearchParams(window.location.search);
    const telaInicial = (params.get('tela') === 'config' && isAdminAtual) ? 'config' : 'dashboard';
    navegarPara(telaInicial);
});

async function carregarBase() {
    const [{ data: empresas, error: errEmp }, { data: usuarios, error: errUsu }] = await Promise.all([
        supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa').order('nome_empresa'),
        supabaseClient.from('usuarios').select('id, nome').order('nome')
    ]);
    if (errEmp) { mostrarMensagem('Erro', 'Falha ao carregar empresas: ' + errEmp.message); return; }
    if (errUsu) { mostrarMensagem('Erro', 'Falha ao carregar usuários: ' + errUsu.message); return; }
    empresasCache = empresas || [];
    usuariosCache = usuarios || [];
}

function nomeEmpresa(codigo) {
    const emp = empresasCache.find(e => e.codigo_empresa === codigo);
    return emp ? emp.nome_empresa : codigo;
}

function competenciaAtual() {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
async function buscarEmpresasConfiguradas() {
    const { data, error } = await supabaseClient
        .from('fechamento_config_empresa_fase')
        .select('codigo_empresa')
        .eq('ativo', true);
    if (error) { mostrarMensagem('Erro', 'Falha ao carregar configuração: ' + error.message); return []; }
    return [...new Set((data || []).map(r => r.codigo_empresa))];
}

async function carregarDashboard() {
    const comp = competenciaAtual();
    const corpo = document.getElementById('corpoDashboard');
    const codigos = await buscarEmpresasConfiguradas();

    if (!codigos.length) {
        corpo.innerHTML = '<tr><td colspan="6">Nenhuma empresa configurada ainda. Peça a um administrador para configurar o fluxo em "Configuração".</td></tr>';
        return;
    }

    const { data: ciclos, error: errCiclos } = await supabaseClient
        .from('fechamento_ciclo')
        .select('id, codigo_empresa, competencia, responsavel_id, concluido_em')
        .eq('competencia', comp)
        .in('codigo_empresa', codigos);
    if (errCiclos) { mostrarMensagem('Erro', 'Falha ao carregar ciclos: ' + errCiclos.message); return; }

    const cicloIds = (ciclos || []).map(c => c.id);
    let fases = [];
    if (cicloIds.length) {
        const { data: fasesData, error: errFases } = await supabaseClient
            .from('fechamento_ciclo_fase')
            .select('id, ciclo_id, nome_fase, ordem, status')
            .in('ciclo_id', cicloIds)
            .order('ordem');
        if (errFases) { mostrarMensagem('Erro', 'Falha ao carregar fases: ' + errFases.message); return; }
        fases = fasesData || [];
    }

    ciclosCache = {};
    codigos.forEach(cod => {
        const ciclo = (ciclos || []).find(c => c.codigo_empresa === cod) || null;
        const fasesCiclo = ciclo ? fases.filter(f => f.ciclo_id === ciclo.id) : [];
        ciclosCache[cod] = { ciclo, fases: fasesCiclo };
    });

    renderDashboard(codigos, comp);
}

function statusCiclo(entry) {
    if (!entry.ciclo) return 'nao_iniciada';
    if (entry.fases.length && entry.fases.every(f => f.status === 'concluida')) return 'fechada';
    return 'em_execucao';
}

function renderResponsavelCell(entry) {
    if (!entry.ciclo) return '—';
    const opcoes = usuariosCache.map(u =>
        `<option value="${u.id}" ${u.id === entry.ciclo.responsavel_id ? 'selected' : ''}>${u.nome}</option>`
    ).join('');
    return `<select onchange="atualizarResponsavel('${entry.ciclo.id}', this.value)">
        <option value="">Sem responsável</option>${opcoes}
    </select>`;
}

function renderFasesLista(cod, fases) {
    if (!fases.length) return '<em>Nenhuma fase configurada.</em>';
    const linhas = fases.map(f => `
        <div class="fase-item">
            <span class="fase-nome">${f.ordem}. ${f.nome_fase}</span>
            <select onchange="atualizarStatusFase('${f.id}', '${cod}', this.value)">
                <option value="pendente" ${f.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                <option value="andamento" ${f.status === 'andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="concluida" ${f.status === 'concluida' ? 'selected' : ''}>Concluída</option>
            </select>
        </div>
    `).join('');
    return `<div class="fase-lista">${linhas}</div>`;
}

function renderDashboard(codigos, comp) {
    const corpo = document.getElementById('corpoDashboard');
    corpo.innerHTML = '';
    const ordenados = [...codigos].sort((a, b) => nomeEmpresa(a).localeCompare(nomeEmpresa(b)));

    ordenados.forEach(cod => {
        const entry = ciclosCache[cod];
        const status = statusCiclo(entry);
        const concluidas = entry.fases.filter(f => f.status === 'concluida').length;
        const total = entry.fases.length;

        const trPrincipal = document.createElement('tr');
        trPrincipal.innerHTML = `
            <td>${entry.ciclo ? `<span class="expand-toggle" onclick="toggleExpandir('${cod}')">▸</span> ` : ''}${nomeEmpresa(cod)}</td>
            <td>${entry.ciclo ? comp : '—'}</td>
            <td><span class="badge ${STATUS_CICLO_BADGE[status]}">${STATUS_CICLO_LABEL[status]}</span></td>
            <td>${renderResponsavelCell(entry)}</td>
            <td>${entry.ciclo ? `${concluidas}/${total}` : '—'}</td>
            <td>${entry.ciclo ? '' : `<button class="btn btn-primary btn-small" onclick="iniciarCiclo('${cod}')">▶ Iniciar fechamento de ${comp}</button>`}</td>
        `;
        corpo.appendChild(trPrincipal);

        if (entry.ciclo) {
            const trFases = document.createElement('tr');
            trFases.id = 'fases-' + cod;
            trFases.style.display = expandido[cod] ? '' : 'none';
            trFases.innerHTML = `<td colspan="6">${renderFasesLista(cod, entry.fases)}</td>`;
            corpo.appendChild(trFases);
        }
    });
}

function toggleExpandir(cod) {
    expandido[cod] = !expandido[cod];
    const tr = document.getElementById('fases-' + cod);
    if (tr) tr.style.display = expandido[cod] ? '' : 'none';
}

async function iniciarCiclo(codigo_empresa) {
    const comp = competenciaAtual();

    const { data: config, error: errConfig } = await supabaseClient
        .from('fechamento_config_empresa_fase')
        .select('nome_fase, ordem')
        .eq('codigo_empresa', codigo_empresa)
        .eq('ativo', true)
        .order('ordem');
    if (errConfig) { mostrarMensagem('Erro', 'Falha ao carregar configuração da empresa: ' + errConfig.message); return; }
    if (!config || !config.length) { mostrarMensagem('Atenção', 'Esta empresa não tem fases configuradas.'); return; }

    const { data: ciclo, error: errCiclo } = await supabaseClient
        .from('fechamento_ciclo')
        .insert({ codigo_empresa, competencia: comp })
        .select('id')
        .single();
    if (errCiclo) { mostrarMensagem('Erro', 'Falha ao iniciar fechamento: ' + errCiclo.message); return; }

    const fasesIniciais = config.map(c => ({ ciclo_id: ciclo.id, nome_fase: c.nome_fase, ordem: c.ordem, status: 'pendente' }));
    const { error: errFases } = await supabaseClient.from('fechamento_ciclo_fase').insert(fasesIniciais);
    if (errFases) { mostrarMensagem('Erro', 'Falha ao criar as fases do ciclo: ' + errFases.message); return; }

    await carregarDashboard();
}

async function atualizarResponsavel(ciclo_id, usuario_id) {
    const { error } = await supabaseClient
        .from('fechamento_ciclo')
        .update({ responsavel_id: usuario_id || null })
        .eq('id', ciclo_id);
    if (error) { mostrarMensagem('Erro', 'Falha ao atualizar responsável: ' + error.message); return; }
    await carregarDashboard();
}

async function atualizarStatusFase(fase_id, codigo_empresa, novoStatus) {
    const { error } = await supabaseClient
        .from('fechamento_ciclo_fase')
        .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
        .eq('id', fase_id);
    if (error) { mostrarMensagem('Erro', 'Falha ao atualizar status da fase: ' + error.message); return; }

    const entry = ciclosCache[codigo_empresa];
    if (entry && entry.ciclo) {
        const fase = entry.fases.find(f => f.id === fase_id);
        if (fase) fase.status = novoStatus;
        const todasConcluidas = entry.fases.length > 0 && entry.fases.every(f => f.status === 'concluida');
        const jaConcluido = !!entry.ciclo.concluido_em;
        if (todasConcluidas && !jaConcluido) {
            await supabaseClient.from('fechamento_ciclo').update({ concluido_em: new Date().toISOString() }).eq('id', entry.ciclo.id);
        } else if (!todasConcluidas && jaConcluido) {
            await supabaseClient.from('fechamento_ciclo').update({ concluido_em: null }).eq('id', entry.ciclo.id);
        }
    }

    expandido[codigo_empresa] = true;
    await carregarDashboard();
}

// ──────────────────────────────────────────────
// CONFIGURAÇÃO
// ──────────────────────────────────────────────
async function iniciarConfig() {
    if (!isAdminAtual) {
        mostrarMensagem('Acesso restrito', 'Somente administradores podem configurar o fluxo de fechamento.');
        navegarPara('dashboard');
        return;
    }
    await carregarCatalogo();
    popularSelectEmpresaConfig();
    renderListaFasesConfig();
}

async function carregarCatalogo() {
    const { data, error } = await supabaseClient
        .from('fechamento_fases_catalogo')
        .select('id, nome, ordem_padrao')
        .eq('ativo', true)
        .order('ordem_padrao');
    if (error) { mostrarMensagem('Erro', 'Falha ao carregar catálogo de fases: ' + error.message); return; }
    catalogoCache = data || [];
}

function popularSelectEmpresaConfig() {
    const select = document.getElementById('selectEmpresaConfig');
    select.innerHTML = '<option value="">Selecione a empresa...</option>' +
        empresasCache.map(e => `<option value="${e.codigo_empresa}">${e.nome_empresa}</option>`).join('');
}

async function onEmpresaConfigChange() {
    empresaConfigSelecionada = document.getElementById('selectEmpresaConfig').value;
    configFasesAtual = [];

    if (!empresaConfigSelecionada) {
        renderListaFasesConfig();
        popularSelectCatalogoAdd();
        return;
    }

    const { data, error } = await supabaseClient
        .from('fechamento_config_empresa_fase')
        .select('nome_fase, ordem')
        .eq('codigo_empresa', empresaConfigSelecionada)
        .eq('ativo', true)
        .order('ordem');
    if (error) { mostrarMensagem('Erro', 'Falha ao carregar fases da empresa: ' + error.message); return; }

    configFasesAtual = (data || []).map(f => ({ nome_fase: f.nome_fase }));
    renderListaFasesConfig();
    popularSelectCatalogoAdd();
}

function renderListaFasesConfig() {
    const div = document.getElementById('listaFasesConfig');
    if (!empresaConfigSelecionada) { div.innerHTML = '<em>Selecione uma empresa para configurar.</em>'; return; }
    if (!configFasesAtual.length) { div.innerHTML = '<em>Nenhuma fase adicionada ainda.</em>'; return; }

    div.innerHTML = `<div class="fase-lista">${configFasesAtual.map((f, i) => `
        <div class="fase-item">
            <span class="fase-nome">${i + 1}. ${f.nome_fase}</span>
            <span class="fase-config-acoes">
                <button class="btn btn-secondary btn-small" onclick="moverFaseConfig(${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn btn-secondary btn-small" onclick="moverFaseConfig(${i}, 1)" ${i === configFasesAtual.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn btn-secondary btn-small" onclick="removerFaseConfig(${i})">Remover</button>
            </span>
        </div>
    `).join('')}</div>`;
}

function popularSelectCatalogoAdd() {
    const select = document.getElementById('selectCatalogoAdd');
    const usados = new Set(configFasesAtual.map(f => f.nome_fase));
    const disponiveis = catalogoCache.filter(c => !usados.has(c.nome));
    select.innerHTML = '<option value="">Selecione uma fase do catálogo...</option>' +
        disponiveis.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
}

function adicionarFaseCatalogo() {
    if (!empresaConfigSelecionada) { mostrarMensagem('Atenção', 'Selecione uma empresa antes de adicionar fases.'); return; }
    const select = document.getElementById('selectCatalogoAdd');
    if (!select.value) return;
    configFasesAtual.push({ nome_fase: select.value });
    renderListaFasesConfig();
    popularSelectCatalogoAdd();
}

function adicionarFaseCustom() {
    if (!empresaConfigSelecionada) { mostrarMensagem('Atenção', 'Selecione uma empresa antes de adicionar fases.'); return; }
    const input = document.getElementById('inputNovaFase');
    const nome = input.value.trim();
    if (!nome) return;
    configFasesAtual.push({ nome_fase: nome });
    input.value = '';
    renderListaFasesConfig();
    popularSelectCatalogoAdd();
}

function moverFaseConfig(i, dir) {
    const ni = i + dir;
    if (ni < 0 || ni >= configFasesAtual.length) return;
    [configFasesAtual[i], configFasesAtual[ni]] = [configFasesAtual[ni], configFasesAtual[i]];
    renderListaFasesConfig();
}

function removerFaseConfig(i) {
    configFasesAtual.splice(i, 1);
    renderListaFasesConfig();
    popularSelectCatalogoAdd();
}

async function salvarConfig() {
    if (!empresaConfigSelecionada) { mostrarMensagem('Atenção', 'Selecione uma empresa antes de salvar.'); return; }
    if (!configFasesAtual.length) { mostrarMensagem('Atenção', 'Adicione ao menos uma fase antes de salvar.'); return; }

    const { error: errDel } = await supabaseClient
        .from('fechamento_config_empresa_fase')
        .delete()
        .eq('codigo_empresa', empresaConfigSelecionada);
    if (errDel) { mostrarMensagem('Erro', 'Falha ao limpar configuração anterior: ' + errDel.message); return; }

    const novasLinhas = configFasesAtual.map((f, i) => ({
        codigo_empresa: empresaConfigSelecionada, nome_fase: f.nome_fase, ordem: i + 1, ativo: true
    }));
    const { error: errIns } = await supabaseClient.from('fechamento_config_empresa_fase').insert(novasLinhas);
    if (errIns) { mostrarMensagem('Erro', 'Falha ao salvar nova configuração: ' + errIns.message); return; }

    mostrarMensagem('Sucesso', 'Configuração salva para ' + nomeEmpresa(empresaConfigSelecionada) + '.');
}
```

- [ ] **Step 2: Verificar**

Run:
```bash
grep -n "^function navegarPara\|^async function iniciarCiclo\|^async function atualizarResponsavel\|^async function atualizarStatusFase\|^function toggleExpandir\|^async function onEmpresaConfigChange\|^function adicionarFaseCatalogo\|^function adicionarFaseCustom\|^function moverFaseConfig\|^function removerFaseConfig\|^async function salvarConfig\|^function fecharModal" "Projeto Fechamento Folha/controle.js"
```
Expected: uma ocorrência de cada uma das 12 funções (todas as referenciadas via `onclick` no HTML da Task 2).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Fechamento Folha/controle.js"
git commit -m "feat(controle-fechamento): logica do Dashboard e da Configuracao"
```

---

### Task 4: Integração no `index.html` do módulo

**Files:**
- Modify: `Projeto Fechamento Folha/index.html:82-88` (sidebar, seção "Ferramentas")
- Modify: `Projeto Fechamento Folha/index.html:154-165` (grid "Ferramentas" da tela inicial)

**Interfaces:**
- Consumes: `Projeto Fechamento Folha/controle.html` (Tasks 2-3).

- [ ] **Step 1: Adicionar o item no sidebar**

Localizar:

```html
        <div class="sidebar-section">Ferramentas</div>
        <a href="fluxo.html" class="sidebar-item">
            <span class="sidebar-item-icon">📋</span> Fluxo de Fechamento
        </a>
        <a href="ferias.html" class="sidebar-item">
            <span class="sidebar-item-icon">🏖️</span> Programação de Férias
        </a>
```

Substituir por:

```html
        <div class="sidebar-section">Ferramentas</div>
        <a href="fluxo.html" class="sidebar-item">
            <span class="sidebar-item-icon">📋</span> Fluxo de Fechamento
        </a>
        <a href="ferias.html" class="sidebar-item">
            <span class="sidebar-item-icon">🏖️</span> Programação de Férias
        </a>
        <a href="controle.html" class="sidebar-item">
            <span class="sidebar-item-icon">🗂️</span> Controle de Fechamento
        </a>
```

- [ ] **Step 2: Adicionar o card no grid da tela inicial**

Localizar:

```html
            <div class="empresa-grid">
                <a href="fluxo.html" class="empresa-card">
                    <div class="card-icon">📋</div>
                    <h3>Fluxo de Fechamento</h3>
                    <p>Acompanhe o progresso e o calendário do fechamento da folha</p>
                </a>
                <a href="ferias.html" class="empresa-card">
                    <div class="card-icon">🏖️</div>
                    <h3>Programação de Férias</h3>
                    <p>Importe o PDF, configure colunas e gere o relatório</p>
                </a>
            </div>
```

Substituir por:

```html
            <div class="empresa-grid">
                <a href="fluxo.html" class="empresa-card">
                    <div class="card-icon">📋</div>
                    <h3>Fluxo de Fechamento</h3>
                    <p>Acompanhe o progresso e o calendário do fechamento da folha</p>
                </a>
                <a href="ferias.html" class="empresa-card">
                    <div class="card-icon">🏖️</div>
                    <h3>Programação de Férias</h3>
                    <p>Importe o PDF, configure colunas e gere o relatório</p>
                </a>
                <a href="controle.html" class="empresa-card">
                    <div class="card-icon">🗂️</div>
                    <h3>Controle de Fechamento</h3>
                    <p>Empresas, fases, responsáveis e status do fechamento do mês</p>
                </a>
            </div>
```

- [ ] **Step 3: Verificar**

Run:
```bash
grep -n "controle.html" "Projeto Fechamento Folha/index.html"
```
Expected: 2 ocorrências (sidebar + card do grid).

- [ ] **Step 4: Commit**

```bash
git add "Projeto Fechamento Folha/index.html"
git commit -m "feat(controle-fechamento): link no index do modulo Fechamento Folha"
```

---

### Task 5: Verificação manual end-to-end

**Files:** nenhum (task de verificação)

**Interfaces:**
- Consumes: build completo das Tasks 1-4.

- [ ] **Step 1: Pré-requisito — rodar o SQL manualmente**

Abrir o SQL Editor do Supabase (projeto Portal) e executar `Projeto Fechamento Folha/schema_controle_fechamento.sql` na íntegra (este agente só tem a chave anon e não consegue rodar DDL). Confirmar que as 4 tabelas foram criadas e que `fechamento_fases_catalogo` tem 10 linhas.

- [ ] **Step 2: Configurar o fluxo de uma empresa**

Logar como admin, abrir `Projeto Fechamento Folha/controle.html`, ir em "Configuração". Selecionar uma empresa (ex: Quadrante Etiquetas), adicionar 3-4 fases do catálogo, reordenar com ↑/↓, adicionar uma fase personalizada, clicar "💾 Salvar configuração".
Confirmar: modal "Sucesso" aparece; recarregando a página e reselecionando a mesma empresa, a lista salva aparece na mesma ordem.

- [ ] **Step 3: Dashboard sem ciclo aberto**

Ir em "Dashboard". Confirmar: a empresa configurada aparece na tabela com status "Não iniciada", competência "—", progresso "—" e botão "▶ Iniciar fechamento de MM/AAAA" (mês corrente).

- [ ] **Step 4: Iniciar o fechamento**

Clicar no botão "Iniciar fechamento". Confirmar: status muda para "Em execução", competência mostra o mês corrente, progresso mostra `0/N` (N = número de fases configuradas), e a linha expande mostrando a lista de fases todas como "Pendente".

- [ ] **Step 5: Atualizar responsável e status das fases**

No dropdown "Responsável" da empresa, selecionar um usuário. Confirmar: seleção persiste após recarregar a página.
Na lista de fases expandida, mudar uma fase para "Em andamento" e depois para "Concluída". Confirmar: progresso incrementa (ex: `1/N`), status da empresa continua "Em execução" enquanto houver fase não concluída.

- [ ] **Step 6: Fechar todas as fases**

Marcar todas as fases da empresa como "Concluída". Confirmar: status muda automaticamente para "Fechada".
Voltar uma fase para "Pendente". Confirmar: status volta para "Em execução" (reabertura automática).

- [ ] **Step 7: Acesso restrito à Configuração**

Logar com um usuário sem `is_admin`. Confirmar: item "Configuração" não aparece no sidebar, e acessar `controle.html?tela=config` diretamente pela URL não abre a tela de configuração (cai no Dashboard).

- [ ] **Step 8: Relatar resultado**

Se todos os passos acima passarem, marcar esta task como concluída. Se algum passo falhar, anotar o passo exato e o comportamento observado antes de prosseguir.

---

### Task 6: Push para o remoto

**Files:** nenhum

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Verificar**

```bash
git status
```
Expected: `Your branch is up to date with 'origin/main'.` e working tree limpo (fora de arquivos não relacionados a este plano, já presentes antes do início).
