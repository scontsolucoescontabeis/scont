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
