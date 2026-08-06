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
let editandoIndexConfig = null;
let editandoCatalogoId = null;

// Empresas com Folha de Pagamento
let empresasFolhaCache = []; // empresasCache filtrado por status_situacao ativo
let folhaConfigPorEmpresa = {}; // { codigo_empresa: boolean } — ausente = false (padrão opt-in)
let responsaveisFolhaPorEmpresa = {}; // { codigo_empresa: Set<usuario_id> }

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
    if (modo === 'config') modo = 'config-fluxo'; // compatibilidade com links antigos (?tela=config)
    fecharSidebar();
    document.getElementById('navDashboardCF').classList.toggle('active', modo === 'dashboard');
    document.getElementById('navConfigFluxoCF').classList.toggle('active', modo === 'config-fluxo');
    document.getElementById('navConfigEmpresasCF').classList.toggle('active', modo === 'config-empresas');
    document.getElementById('telaDashboardCF').classList.toggle('active', modo === 'dashboard');
    document.getElementById('telaConfigFluxoCF').classList.toggle('active', modo === 'config-fluxo');
    document.getElementById('telaConfigEmpresasCF').classList.toggle('active', modo === 'config-empresas');
    if (modo === 'dashboard') carregarDashboard();
    if (modo === 'config-fluxo') iniciarConfig();
    if (modo === 'config-empresas') iniciarConfigEmpresas();
}

// ──────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;

    isAdminAtual = auth.isAdmin === true;
    document.getElementById('sectionConfigCF').style.display = isAdminAtual ? '' : 'none';
    document.getElementById('navConfigFluxoCF').style.display = isAdminAtual ? '' : 'none';
    document.getElementById('navConfigEmpresasCF').style.display = isAdminAtual ? '' : 'none';

    await carregarBase();

    const params = new URLSearchParams(window.location.search);
    const telaParam = params.get('tela');
    const telasAdmin = ['config', 'config-fluxo', 'config-empresas'];
    const telaInicial = (telasAdmin.includes(telaParam) && isAdminAtual) ? telaParam : 'dashboard';
    navegarPara(telaInicial);
});

async function carregarBase() {
    const [
        { data: empresas, error: errEmp },
        { data: usuarios, error: errUsu },
        { data: folhaConfig, error: errFolhaConfig },
        { data: folhaResp, error: errFolhaResp }
    ] = await Promise.all([
        supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa'),
        supabaseClient.from('usuarios').select('id, nome, email').order('nome'),
        supabaseClient.from('fechamento_empresas_config').select('codigo_empresa, possui_folha'),
        supabaseClient.from('fechamento_empresas_responsaveis').select('codigo_empresa, usuario_id')
    ]);
    if (errEmp) { mostrarMensagem('Erro', 'Falha ao carregar empresas: ' + errEmp.message); return; }
    if (errUsu) { mostrarMensagem('Erro', 'Falha ao carregar usuários: ' + errUsu.message); return; }
    // Tabelas novas (Empresas com Folha de Pagamento) — se a migração ainda não rodou,
    // não bloqueia o restante da tela; só avisa no console.
    if (errFolhaConfig) console.warn('fechamento_empresas_config indisponível:', errFolhaConfig.message);
    if (errFolhaResp) console.warn('fechamento_empresas_responsaveis indisponível:', errFolhaResp.message);

    empresasCache = empresas || [];
    usuariosCache = usuarios || [];

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresasFolhaCache = empresasCache.filter(e => ativa(e.status_situacao));

    folhaConfigPorEmpresa = {};
    (folhaConfig || []).forEach(c => { folhaConfigPorEmpresa[c.codigo_empresa] = c.possui_folha; });

    responsaveisFolhaPorEmpresa = {};
    (folhaResp || []).forEach(r => {
        if (!responsaveisFolhaPorEmpresa[r.codigo_empresa]) responsaveisFolhaPorEmpresa[r.codigo_empresa] = new Set();
        responsaveisFolhaPorEmpresa[r.codigo_empresa].add(r.usuario_id);
    });
}

function possuiFolha(codigoEmpresa) {
    return folhaConfigPorEmpresa[codigoEmpresa] === true;
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
        .select('id, codigo_empresa, competencia, responsavel_id, concluido_em, observacoes')
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

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderFasesLista(cod, entry) {
    const fases = entry.fases;
    const fasesHtml = fases.length
        ? fases.map(f => `
            <div class="fase-item">
                <label class="fase-checkbox">
                    <input type="checkbox" ${f.status === 'concluida' ? 'checked' : ''} onchange="atualizarStatusFase('${f.id}', '${cod}', this.checked)">
                    <span class="fase-nome">${f.ordem}. ${f.nome_fase}</span>
                </label>
            </div>
        `).join('')
        : '<em>Nenhuma fase configurada.</em>';

    return `
        <div class="fase-lista">${fasesHtml}</div>
        <div class="fase-observacoes">
            <label for="obs-${cod}">Observações gerais</label>
            <textarea id="obs-${cod}" rows="3" placeholder="Observações sobre o fechamento desta competência..."
                onblur="salvarObservacoesCiclo('${entry.ciclo.id}', '${cod}', this.value)">${escapeHtml(entry.ciclo.observacoes)}</textarea>
        </div>
    `;
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
            trFases.innerHTML = `<td colspan="6">${renderFasesLista(cod, entry)}</td>`;
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

async function atualizarStatusFase(fase_id, codigo_empresa, concluida) {
    const novoStatus = concluida ? 'concluida' : 'pendente';
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
            await notificarFechamentoConcluido(codigo_empresa, entry.ciclo.competencia);
        } else if (!todasConcluidas && jaConcluido) {
            await supabaseClient.from('fechamento_ciclo').update({ concluido_em: null }).eq('id', entry.ciclo.id);
        }
    }

    expandido[codigo_empresa] = true;
    await carregarDashboard();
}

async function salvarObservacoesCiclo(cicloId, codigoEmpresa, valor) {
    const { error } = await supabaseClient
        .from('fechamento_ciclo')
        .update({ observacoes: valor })
        .eq('id', cicloId);
    if (error) { mostrarMensagem('Erro', 'Falha ao salvar observações: ' + error.message); return; }
    const entry = ciclosCache[codigoEmpresa];
    if (entry && entry.ciclo) entry.ciclo.observacoes = valor;
    mostrarToastCF('Observações salvas.', 'sucesso');
}

// Notifica os responsáveis cadastrados em "Empresas com Folha de Pagamento"
// quando todas as fases do fluxo de uma empresa são concluídas — mesmo
// mecanismo (Edge Function enviar-email) usado pelo Diário Contábil.
async function notificarFechamentoConcluido(codigoEmpresa, competencia) {
    const ids = responsaveisFolhaPorEmpresa[codigoEmpresa];
    if (!ids || !ids.size) return; // nenhum responsável cadastrado para esta empresa

    const destinatarios = usuariosCache.filter(u => ids.has(u.id)).map(u => u.email).filter(Boolean);
    if (!destinatarios.length) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = nomeEmpresa(codigoEmpresa);
    const assunto = `✅ Fechamento de folha concluído — ${nomeEmp} — ${competencia}`;
    const params = {
        tipo: 'fechamento_folha_concluido',
        empresa: nomeEmp,
        competencia,
        portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(destinatarios.map(destinatario =>
        fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ destinatario, assunto, params }),
        }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }))
    ));

    if (resultados.some(r => !r.ok)) {
        mostrarToastCF('Fechamento concluído, mas houve falha ao notificar algum responsável por e-mail.', 'erro');
    }
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
    renderListaCatalogoConfig();
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

function renderListaCatalogoConfig() {
    const div = document.getElementById('listaCatalogoConfig');
    if (!catalogoCache.length) { div.innerHTML = '<em>Nenhuma fase cadastrada no catálogo.</em>'; return; }

    div.innerHTML = `<div class="fase-lista">${catalogoCache.map(c => {
        if (editandoCatalogoId === c.id) {
            return `
                <div class="fase-item">
                    <input type="text" id="inputEditCatalogo" value="${c.nome}" style="flex:1;">
                    <span class="fase-config-acoes">
                        <button class="btn btn-primary btn-small" onclick="salvarEdicaoFaseCatalogo('${c.id}')">Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="cancelarEdicaoFaseCatalogo()">Cancelar</button>
                    </span>
                </div>`;
        }
        return `
            <div class="fase-item">
                <span class="fase-nome">${c.nome}</span>
                <span class="fase-config-acoes">
                    <button class="btn btn-secondary btn-small" onclick="editarFaseCatalogo('${c.id}')">Editar</button>
                </span>
            </div>`;
    }).join('')}</div>`;
}

function editarFaseCatalogo(id) {
    editandoCatalogoId = id;
    renderListaCatalogoConfig();
}

function cancelarEdicaoFaseCatalogo() {
    editandoCatalogoId = null;
    renderListaCatalogoConfig();
}

async function salvarEdicaoFaseCatalogo(id) {
    const input = document.getElementById('inputEditCatalogo');
    const novoNome = input.value.trim();
    if (!novoNome) { mostrarMensagem('Atenção', 'O nome da fase não pode ficar vazio.'); return; }

    const { error } = await supabaseClient
        .from('fechamento_fases_catalogo')
        .update({ nome: novoNome })
        .eq('id', id);
    if (error) { mostrarMensagem('Erro', 'Falha ao editar fase do catálogo: ' + error.message); return; }

    editandoCatalogoId = null;
    await carregarCatalogo();
    renderListaCatalogoConfig();
    popularSelectCatalogoAdd();
}

function popularSelectEmpresaConfig() {
    const select = document.getElementById('selectEmpresaConfig');
    const disponiveis = empresasCache.filter(e => possuiFolha(e.codigo_empresa));
    select.innerHTML = disponiveis.length
        ? '<option value="">Selecione a empresa...</option>' + disponiveis.map(e => `<option value="${e.codigo_empresa}">${e.nome_empresa}</option>`).join('')
        : '<option value="">Nenhuma empresa marcada com folha de pagamento — configure em "Empresas com Folha de Pagamento"</option>';
}

async function onEmpresaConfigChange() {
    empresaConfigSelecionada = document.getElementById('selectEmpresaConfig').value;
    configFasesAtual = [];
    editandoIndexConfig = null;

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

    div.innerHTML = `<div class="fase-lista">${configFasesAtual.map((f, i) => {
        if (editandoIndexConfig === i) {
            return `
                <div class="fase-item">
                    <input type="text" id="inputEditFaseConfig" value="${f.nome_fase}" style="flex:1;">
                    <span class="fase-config-acoes">
                        <button class="btn btn-primary btn-small" onclick="salvarEdicaoFaseConfig(${i})">Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="cancelarEdicaoFaseConfig()">Cancelar</button>
                    </span>
                </div>`;
        }
        return `
            <div class="fase-item">
                <span class="fase-nome">${i + 1}. ${f.nome_fase}</span>
                <span class="fase-config-acoes">
                    <button class="btn btn-secondary btn-small" onclick="editarFaseConfig(${i})">Editar</button>
                    <button class="btn btn-secondary btn-small" onclick="moverFaseConfig(${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button class="btn btn-secondary btn-small" onclick="moverFaseConfig(${i}, 1)" ${i === configFasesAtual.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="btn btn-secondary btn-small" onclick="removerFaseConfig(${i})">Remover</button>
                </span>
            </div>`;
    }).join('')}</div>`;
}

function editarFaseConfig(i) {
    editandoIndexConfig = i;
    renderListaFasesConfig();
}

function cancelarEdicaoFaseConfig() {
    editandoIndexConfig = null;
    renderListaFasesConfig();
}

function salvarEdicaoFaseConfig(i) {
    const input = document.getElementById('inputEditFaseConfig');
    const novoNome = input.value.trim();
    if (!novoNome) { mostrarMensagem('Atenção', 'O nome da fase não pode ficar vazio.'); return; }
    configFasesAtual[i].nome_fase = novoNome;
    editandoIndexConfig = null;
    renderListaFasesConfig();
    popularSelectCatalogoAdd();
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

// ──────────────────────────────────────────────
// EMPRESAS COM FOLHA DE PAGAMENTO
// ──────────────────────────────────────────────
function mostrarToastCF(msg, tipo) {
    const toast = document.getElementById('toastCF');
    toast.textContent = msg;
    toast.className = 'toast-cf show' + (tipo === 'erro' ? ' erro' : tipo === 'sucesso' ? ' sucesso' : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function iniciarConfigEmpresas() {
    if (!isAdminAtual) {
        mostrarMensagem('Acesso restrito', 'Somente administradores podem configurar as empresas com folha de pagamento.');
        navegarPara('dashboard');
        return;
    }
    document.getElementById('buscaEmpresaFolhaCF').value = '';
    renderTabelaEmpresasFolha();
}

function empresasFolhaVisiveis() {
    const termo = (document.getElementById('buscaEmpresaFolhaCF').value || '').trim().toLowerCase();
    if (!termo) return empresasFolhaCache;
    return empresasFolhaCache.filter(e =>
        e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo));
}

function toggleFolhaHtml(codigoEmpresa) {
    const sim = possuiFolha(codigoEmpresa);
    return `<button type="button" class="folha-toggle ${sim ? 'folha-sim' : 'folha-nao'}" data-empresa-codigo="${codigoEmpresa}" data-value="${sim}">${sim ? 'Sim' : 'Não'}</button>`;
}

function responsavelFolhaHtml(codigoEmpresa) {
    const ids = responsaveisFolhaPorEmpresa[codigoEmpresa];
    const nomes = ids && ids.size ? usuariosCache.filter(u => ids.has(u.id)).map(u => u.nome).join(', ') : '';
    return `
        <div class="responsavel-cel">
            <span class="responsavel-nomes">${nomes || '—'}</span>
            <button type="button" class="btn-editar-responsavel" onclick="abrirModalResponsaveisCF('${codigoEmpresa}')" title="Editar responsável(is)">✎</button>
        </div>
    `;
}

function renderTabelaEmpresasFolha() {
    const corpo = document.getElementById('corpoTabelaEmpresasFolhaCF');
    const visiveis = empresasFolhaVisiveis();

    corpo.innerHTML = visiveis.length
        ? visiveis.map(e => `
            <tr>
                <td>${e.codigo_empresa}</td>
                <td>${e.nome_empresa}</td>
                <td>${toggleFolhaHtml(e.codigo_empresa)}</td>
                <td>${responsavelFolhaHtml(e.codigo_empresa)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4">Nenhuma empresa encontrada.</td></tr>';

    corpo.querySelectorAll('.folha-toggle').forEach(btn => {
        btn.addEventListener('click', () => alternarFolhaUma(btn));
    });

    atualizarContadorFolha();
}

function atualizarContadorFolha() {
    const todos = document.querySelectorAll('#corpoTabelaEmpresasFolhaCF .folha-toggle');
    const marcados = document.querySelectorAll('#corpoTabelaEmpresasFolhaCF .folha-toggle[data-value="true"]');
    document.getElementById('contadorEmpresasFolhaCF').textContent =
        `${marcados.length} de ${todos.length} com folha de pagamento (${empresasFolhaCache.length} empresas ativas no total)`;
}

function definirValorFolha(btn, valor) {
    btn.setAttribute('data-value', String(valor));
    btn.textContent = valor ? 'Sim' : 'Não';
    btn.classList.toggle('folha-sim', valor);
    btn.classList.toggle('folha-nao', !valor);
}

async function salvarFolhaLote(registros) {
    if (!registros.length) return { error: null };
    const payload = registros.map(r => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await supabaseClient.from('fechamento_empresas_config').upsert(payload, { onConflict: 'codigo_empresa' });
    if (!error) registros.forEach(r => { folhaConfigPorEmpresa[r.codigo_empresa] = r.possui_folha; });
    return { error };
}

async function alternarFolhaUma(btn) {
    const codigo = btn.getAttribute('data-empresa-codigo');
    const anterior = btn.getAttribute('data-value') === 'true';
    const novo = !anterior;

    definirValorFolha(btn, novo);
    btn.disabled = true;
    atualizarContadorFolha();

    const { error } = await salvarFolhaLote([{ codigo_empresa: codigo, possui_folha: novo }]);

    btn.disabled = false;
    if (error) {
        console.error(error);
        definirValorFolha(btn, anterior);
        atualizarContadorFolha();
        mostrarToastCF('Erro ao salvar. Alteração desfeita.', 'erro');
        return;
    }
    mostrarToastCF('Configuração salva.', 'sucesso');
}

async function alternarVisiveisFolha(marcar) {
    const botoes = Array.from(document.querySelectorAll('#corpoTabelaEmpresasFolhaCF .folha-toggle'));
    const paraSalvar = botoes.filter(b => (b.getAttribute('data-value') === 'true') !== marcar);
    if (!paraSalvar.length) return;

    paraSalvar.forEach(b => { b.disabled = true; });
    const registros = paraSalvar.map(b => ({ codigo_empresa: b.getAttribute('data-empresa-codigo'), possui_folha: marcar }));
    const { error } = await salvarFolhaLote(registros);
    paraSalvar.forEach(b => { b.disabled = false; });

    if (error) {
        console.error(error);
        mostrarToastCF('Erro ao salvar as alterações.', 'erro');
        return;
    }

    paraSalvar.forEach(b => definirValorFolha(b, marcar));
    atualizarContadorFolha();
    mostrarToastCF('Configuração salva.', 'sucesso');
}

async function salvarResponsavelFolha(codigoEmpresa, usuarioId, marcado) {
    if (marcado) {
        const { error } = await supabaseClient
            .from('fechamento_empresas_responsaveis')
            .insert([{ codigo_empresa: codigoEmpresa, usuario_id: usuarioId }]);
        if (error) return { error };
        if (!responsaveisFolhaPorEmpresa[codigoEmpresa]) responsaveisFolhaPorEmpresa[codigoEmpresa] = new Set();
        responsaveisFolhaPorEmpresa[codigoEmpresa].add(usuarioId);
    } else {
        const { error } = await supabaseClient
            .from('fechamento_empresas_responsaveis')
            .delete()
            .eq('codigo_empresa', codigoEmpresa)
            .eq('usuario_id', usuarioId);
        if (error) return { error };
        responsaveisFolhaPorEmpresa[codigoEmpresa]?.delete(usuarioId);
    }
    return { error: null };
}

// ─── MODAL: RESPONSÁVEIS (por empresa) ──────────────────────
function abrirModalResponsaveisCF(codigoEmpresa) {
    document.getElementById('modalResponsaveisCFTitulo').textContent = `Responsável(is) — ${nomeEmpresa(codigoEmpresa)}`;
    renderCorpoModalResponsaveisCF(codigoEmpresa);
    document.getElementById('modalResponsaveisCF').classList.add('active');
}

function fecharModalResponsaveisCF() {
    document.getElementById('modalResponsaveisCF').classList.remove('active');
}

function renderCorpoModalResponsaveisCF(codigoEmpresa) {
    const body = document.getElementById('modalResponsaveisCFBody');
    if (!usuariosCache.length) {
        body.innerHTML = '<p><em>Nenhum usuário cadastrado no portal.</em></p>';
        return;
    }
    const atuais = responsaveisFolhaPorEmpresa[codigoEmpresa] || new Set();
    body.innerHTML = usuariosCache.map(u => `
        <label class="responsavel-check-item">
            <input type="checkbox" class="chk-responsavel-cf" value="${u.id}" ${atuais.has(u.id) ? 'checked' : ''}>
            <span>${u.nome}</span>
        </label>
    `).join('');

    body.querySelectorAll('.chk-responsavel-cf').forEach(chk => {
        chk.addEventListener('change', async () => {
            const usuarioId = chk.value;
            const marcado = chk.checked;
            chk.disabled = true;
            const { error } = await salvarResponsavelFolha(codigoEmpresa, usuarioId, marcado);
            chk.disabled = false;
            if (error) {
                console.error(error);
                chk.checked = !marcado;
                mostrarToastCF('Erro ao salvar. Alteração desfeita.', 'erro');
                return;
            }
            renderTabelaEmpresasFolha();
        });
    });
}

// ─── MODAL: ATRIBUIR RESPONSÁVEL POR USUÁRIO (várias empresas) ──
function abrirModalResponsavelPorUsuarioCF() {
    if (!usuariosCache.length) { mostrarToastCF('Nenhum usuário cadastrado no portal.', 'erro'); return; }

    const select = document.getElementById('selectUsuarioResponsavelCF');
    const usuarioAtual = select.value;
    select.innerHTML = usuariosCache.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');
    if (usuarioAtual && usuariosCache.some(u => u.id === usuarioAtual)) select.value = usuarioAtual;

    document.getElementById('buscaEmpresaModalUsuarioCF').value = '';
    renderCorpoModalResponsavelUsuarioCF();
    document.getElementById('modalResponsavelUsuarioCF').classList.add('active');
}

function fecharModalResponsavelUsuarioCF() {
    document.getElementById('modalResponsavelUsuarioCF').classList.remove('active');
}

function empresasFolhaVisiveisModalUsuario() {
    const termo = (document.getElementById('buscaEmpresaModalUsuarioCF').value || '').trim().toLowerCase();
    if (!termo) return empresasFolhaCache;
    return empresasFolhaCache.filter(e =>
        e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo));
}

function renderCorpoModalResponsavelUsuarioCF() {
    const usuarioId = document.getElementById('selectUsuarioResponsavelCF').value;
    const body = document.getElementById('modalResponsavelUsuarioCFBody');
    const visiveis = empresasFolhaVisiveisModalUsuario();

    if (!visiveis.length) {
        body.innerHTML = '<p><em>Nenhuma empresa encontrada.</em></p>';
        return;
    }

    body.innerHTML = visiveis.map(e => {
        const marcado = (responsaveisFolhaPorEmpresa[e.codigo_empresa] || new Set()).has(usuarioId);
        return `
            <label class="responsavel-check-item">
                <input type="checkbox" class="chk-responsavel-usuario-cf" value="${e.codigo_empresa}" ${marcado ? 'checked' : ''}>
                <span>${e.nome_empresa} <small>(${e.codigo_empresa})</small></span>
            </label>
        `;
    }).join('');

    body.querySelectorAll('.chk-responsavel-usuario-cf').forEach(chk => {
        chk.addEventListener('change', async () => {
            const codigo = chk.value;
            const marcado = chk.checked;
            chk.disabled = true;
            const { error } = await salvarResponsavelFolha(codigo, usuarioId, marcado);
            chk.disabled = false;
            if (error) {
                console.error(error);
                chk.checked = !marcado;
                mostrarToastCF('Erro ao salvar. Alteração desfeita.', 'erro');
                return;
            }
            renderTabelaEmpresasFolha();
        });
    });
}

async function alternarTodasModalUsuarioCF(marcar) {
    const usuarioId = document.getElementById('selectUsuarioResponsavelCF').value;
    const checkboxes = Array.from(document.querySelectorAll('#modalResponsavelUsuarioCFBody .chk-responsavel-usuario-cf'));
    const paraSalvar = checkboxes.filter(chk => chk.checked !== marcar);
    if (!paraSalvar.length) return;

    paraSalvar.forEach(chk => { chk.disabled = true; });
    const codigos = paraSalvar.map(chk => chk.value);

    let error;
    if (marcar) {
        ({ error } = await supabaseClient
            .from('fechamento_empresas_responsaveis')
            .insert(codigos.map(codigo_empresa => ({ codigo_empresa, usuario_id: usuarioId }))));
    } else {
        ({ error } = await supabaseClient
            .from('fechamento_empresas_responsaveis')
            .delete()
            .eq('usuario_id', usuarioId)
            .in('codigo_empresa', codigos));
    }

    paraSalvar.forEach(chk => { chk.disabled = false; });

    if (error) {
        console.error(error);
        mostrarToastCF('Erro ao salvar as alterações.', 'erro');
        return;
    }

    codigos.forEach(codigo => {
        if (!responsaveisFolhaPorEmpresa[codigo]) responsaveisFolhaPorEmpresa[codigo] = new Set();
        if (marcar) responsaveisFolhaPorEmpresa[codigo].add(usuarioId);
        else responsaveisFolhaPorEmpresa[codigo].delete(usuarioId);
    });
    paraSalvar.forEach(chk => { chk.checked = marcar; });
    renderTabelaEmpresasFolha();
}

function baixarModeloEmpresasFolhaCF() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['Código Empresa', 'Folha de Pagamento'],
    ]);
    ws['!cols'] = [18, 20].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    XLSX.writeFile(wb, 'modelo_empresas_folha_pagamento.xlsx');
}

// ─── IMPORTAÇÃO EM MASSA (planilha) ─────────────────────────
function normalizarChaveCF(str) {
    return String(str ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

const ALIASES_CODIGO_CF = ['codigoempresa', 'codigo', 'codempresa', 'codemp'];
const ALIASES_FOLHA_CF = ['folhadepagamento', 'folha', 'possuifolha', 'temfolha', 'temfolhadepagamento'];

function interpretarSimNaoCF(valor) {
    if (valor === null || valor === undefined) return null;
    const v = normalizarChaveCF(valor);
    if (!v) return null;
    if (['sim', 's', 'true', '1', 'yes', 'y'].includes(v)) return true;
    if (['nao', 'n', 'false', '0', 'no'].includes(v)) return false;
    return null;
}

function lerPlanilhaFolhaCF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                if (!sheet) throw new Error('Não foi possível ler o conteúdo deste arquivo.');
                resolve(XLSX.utils.sheet_to_json(sheet, { defval: null }));
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileImportarFolhaCF');
    if (fileInput) fileInput.addEventListener('change', handleImportarPlanilhaFolhaCF);
    const busca = document.getElementById('buscaEmpresaFolhaCF');
    if (busca) busca.addEventListener('input', renderTabelaEmpresasFolha);
});

async function handleImportarPlanilhaFolhaCF(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let linhas;
    try {
        linhas = await lerPlanilhaFolhaCF(file);
    } catch (err) {
        console.error(err);
        mostrarToastCF('Erro ao ler a planilha.', 'erro');
        return;
    }

    if (!linhas.length) { mostrarToastCF('Planilha vazia.', 'erro'); return; }

    const cabecalhos = Object.keys(linhas[0]);
    const chaveCodigo = cabecalhos.find(h => ALIASES_CODIGO_CF.includes(normalizarChaveCF(h)));
    const chaveFolha = cabecalhos.find(h => ALIASES_FOLHA_CF.includes(normalizarChaveCF(h)));

    if (!chaveCodigo || !chaveFolha) {
        mostrarToastCF('Planilha inválida: são necessárias as colunas "Código Empresa" e "Folha de Pagamento".', 'erro');
        return;
    }

    const empresasPorCodigo = {};
    empresasFolhaCache.forEach(e => { empresasPorCodigo[e.codigo_empresa] = e; });

    const registrosPorCodigo = {};
    let naoEncontradas = 0;
    let ignoradas = 0;

    linhas.forEach(linha => {
        const codigo = String(linha[chaveCodigo] ?? '').trim();
        if (!codigo) return;

        const valor = interpretarSimNaoCF(linha[chaveFolha]);
        if (valor === null) { ignoradas++; return; }

        if (!empresasPorCodigo[codigo]) { naoEncontradas++; return; }

        registrosPorCodigo[codigo] = valor; // linha repetida: prevalece a última ocorrência
    });

    const registros = Object.entries(registrosPorCodigo).map(([codigo_empresa, possui_folha]) => ({ codigo_empresa, possui_folha }));

    if (!registros.length) {
        const partes = ['Nenhuma alteração aplicável encontrada na planilha.'];
        if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) entre as empresas ativas.`);
        if (ignoradas) partes.push(`${ignoradas} linha(s) com valor inválido.`);
        mostrarToastCF(partes.join(' '), 'erro');
        return;
    }

    const { error } = await salvarFolhaLote(registros);

    if (error) {
        console.error(error);
        mostrarToastCF('Erro ao salvar as alterações importadas.', 'erro');
        return;
    }

    renderTabelaEmpresasFolha();

    const partes = [`${registros.length} empresa(s) salva(s) no banco.`];
    if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) entre as empresas ativas.`);
    if (ignoradas) partes.push(`${ignoradas} linha(s) com valor inválido.`);
    mostrarToastCF(partes.join(' '), 'sucesso');
}
