/**
 * SCONT - Painel de Administração
 * Arquivo: admin.js
 */

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via admin.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESCOPO POR RESPONSÁVEL ---
// Usuários vinculados à empresa "Prestador de Serviço" (ver
// EMPRESA_OPTIONS em admin-dashboard.html) só devem enxergar, neste
// painel, as empresas atribuídas a eles em contabil_empresas_responsaveis
// (tela de Configurações do Departamento Contábil). Super-admins do
// portal (isAdmin=true) e usuários da SCONT Soluções Contábeis continuam
// vendo tudo, sem restrição — mesmo comportamento de hoje.
let _empresasPermitidas = null; // null = sem restrição (vê todas as empresas)

async function _resolverEscopoUsuario() {
    let auth = null;
    try { auth = JSON.parse(sessionStorage.getItem('userAuth') || 'null'); } catch (_) { auth = null; }
    if (!auth || auth.isAdmin) return; // super-admin do portal vê tudo

    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    if (empresaUsuario !== 'prestador de serviço') return; // SCONT (ou sem empresa vinculada) vê tudo

    try {
        const { data, error } = await supabaseClient
            .from('contabil_empresas_responsaveis')
            .select('codigo_empresa')
            .eq('usuario_id', auth.userId);
        if (error) throw error;
        _empresasPermitidas = new Set((data || []).map(r => r.codigo_empresa));
    } catch (erro) {
        console.error('Erro ao resolver empresas do responsável:', erro);
        _empresasPermitidas = new Set(); // falha ao carregar escopo: não mostra nenhuma empresa (mais seguro)
    }
}

/** Filtra uma lista de linhas com campo codigo_empresa pelo escopo do usuário atual. */
function _filtrarPorEscopo(linhas) {
    if (!_empresasPermitidas) return linhas || [];
    return (linhas || []).filter(l => _empresasPermitidas.has(l.codigo_empresa));
}

/** Aplica o escopo a uma query Supabase paginada/filtrada por codigo_empresa (usado em Rubricas). */
function _aplicarEscopoQuery(query) {
    if (!_empresasPermitidas) return query;
    return query.in('codigo_empresa', [..._empresasPermitidas]);
}

document.addEventListener('DOMContentLoaded', async () => {
    await _resolverEscopoUsuario();
    carregarEmpresas();
    carregarEmpregados();
    carregarFeriasInfo();
    carregarJornadaInfo();
    carregarSocios();
    carregarRubricas();
    carregarRegras();
    carregarMapeamentos();
    configurarUpload();
    _carregarTimestampsImportacao();
});

// --- NAVEGAÇÃO DE ABAS ---

function abrirAba(abaId, btn) {
    document.querySelectorAll('.admin-tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    document.getElementById(abaId).classList.add('active');
    if (btn) btn.classList.add('active');
}

// --- EMPRESAS ---

let _todasEmpresas = [];
let _empresasFiltradas = [];
let _paginaEmpresas = 1;
const _porPaginaEmpresas = 50;

async function carregarEmpresas() {
    try {
        const { data, error } = await supabaseClient.from('rh_empresas').select('*').order('nome_empresa', { ascending: true });
        if (error) throw error;
        _todasEmpresas = _filtrarPorEscopo(data);
        _empresasFiltradas = [..._todasEmpresas];
        _paginaEmpresas = 1;
        renderizarTabelaEmpresas();
        atualizarSelectEmpresas(_todasEmpresas);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar empresas.'); }
}

function filtrarEmpresas() {
    const texto = (document.getElementById('filtroEmpresasTexto')?.value || '').toLowerCase().trim();
    const status = document.getElementById('filtroEmpresasStatus')?.value || '';
    _empresasFiltradas = _todasEmpresas.filter(e => {
        if (texto && !(
            (e.codigo_empresa || '').toLowerCase().includes(texto) ||
            (e.nome_empresa || '').toLowerCase().includes(texto) ||
            (e.cnpj || '').toLowerCase().includes(texto) ||
            (e.municipio || '').toLowerCase().includes(texto) ||
            (e.cidade || '').toLowerCase().includes(texto)
        )) return false;
        if (status) {
            const sEmp = String(e.status_situacao || '').trim().toLowerCase();
            const sFiltro = status.trim().toLowerCase();
            // compara pelo prefixo: "ativ" cobre Ativo/Ativa, "inativ" cobre Inativo/Inativa
            const prefixo = sFiltro.startsWith('inativ') ? 'inativ' : 'ativ';
            const empAtivo = !sEmp || sEmp.startsWith('ativ');
            if (prefixo === 'inativ' && empAtivo) return false;
            if (prefixo === 'ativ'   && !empAtivo) return false;
        }
        return true;
    });
    _paginaEmpresas = 1;
    renderizarTabelaEmpresas();
}

function renderizarTabelaEmpresas() {
    const tbody = document.getElementById('empresasTableBody');
    const paginacao = document.getElementById('paginacaoEmpresas');
    const info = document.getElementById('infoEmpresas');
    tbody.innerHTML = '';

    if (_empresasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#95A5A6;padding:20px;">Nenhuma empresa encontrada</td></tr>';
        paginacao.innerHTML = '';
        if (info) info.textContent = '';
        return;
    }

    const totalPags = Math.ceil(_empresasFiltradas.length / _porPaginaEmpresas);
    const inicio    = (_paginaEmpresas - 1) * _porPaginaEmpresas;
    const pagina    = _empresasFiltradas.slice(inicio, inicio + _porPaginaEmpresas);

    if (info) info.textContent = _empresasFiltradas.length < _todasEmpresas.length
        ? `${_empresasFiltradas.length} de ${_todasEmpresas.length} empresa(s)`
        : `${_todasEmpresas.length} empresa(s)`;

    const fmt = v => v ? String(v) : '<span style="color:#C0C0C0;">—</span>';
    const fmtData = v => {
        if (!v) return '<span style="color:#C0C0C0;">—</span>';
        const d = new Date(v + 'T00:00:00');
        return isNaN(d) ? v : d.toLocaleDateString('pt-BR');
    };
    const fmtCnpj = v => {
        if (!v) return '<span style="color:#C0C0C0;">—</span>';
        const s = String(v).replace(/\D/g, '');
        return s.length === 14
            ? `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`
            : v;
    };
    const isAtivo = s => !s || String(s).trim().toLowerCase().startsWith('ativ');
    const isInativo = s => String(s || '').trim().toLowerCase().startsWith('inativ');
    const statusBadge = s => {
        const cor = isInativo(s) ? '#E74C3C' : '#27AE60';
        return `<span style="background:${cor};color:white;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;">${s || 'Ativo'}</span>`;
    };

    pagina.forEach(e => {
        tbody.innerHTML += `<tr>
            <td title="${e.codigo_empresa}"><strong>${e.codigo_empresa}</strong></td>
            <td title="${e.nome_empresa}">${e.nome_empresa}</td>
            <td title="${e.cnpj||''}" style="font-family:monospace;">${fmtCnpj(e.cnpj)}</td>
            <td title="${e.regime_enquadramento||''}">${fmt(e.regime_enquadramento)}</td>
            <td title="${e.inscricao_estadual||''}">${fmt(e.inscricao_estadual)}</td>
            <td title="${e.inscricao_municipal||''}">${fmt(e.inscricao_municipal)}</td>
            <td title="${e.municipio||''}">${fmt(e.municipio)}</td>
            <td>${statusBadge(e.status_situacao)}</td>
            <td>${fmtData(e.data_cadastro)}</td>
            <td title="${e.endereco||''}">${fmt(e.endereco)}</td>
            <td title="${e.cep||''}">${fmt(e.cep)}</td>
            <td title="${e.cidade||''}">${fmt(e.cidade)}</td>
            <td title="${e.uf||''}">${fmt(e.uf)}</td>
            <td>
                <input type="text" value="${(e.email_responsavel || '').replace(/"/g, '&quot;')}"
                    placeholder="e-mail(is) separados por vírgula" style="width:180px; font-size:12px; padding:3px 6px;"
                    onblur="salvarEmailResponsavelEmpresa('${e.codigo_empresa}', this.value)">
            </td>
        </tr>`;
    });

    paginacao.innerHTML = totalPags <= 1 ? '' : `
        <button onclick="mudarPaginaEmpresas(${_paginaEmpresas - 1})" ${_paginaEmpresas === 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="pag-info">Página <strong>${_paginaEmpresas}</strong> de <strong>${totalPags}</strong> — ${_empresasFiltradas.length} empresa(s)</span>
        <button onclick="mudarPaginaEmpresas(${_paginaEmpresas + 1})" ${_paginaEmpresas === totalPags ? 'disabled' : ''}>Próxima ›</button>
    `;
}

function exportarEmpresasExcel() {
    if (!_empresasFiltradas.length) {
        mostrarStatus('statusEmpresas', 'Nenhuma empresa para exportar com os filtros atuais.', 'error');
        return;
    }
    const fmtCnpjExport = v => {
        if (!v) return '';
        const s = String(v).replace(/\D/g, '');
        return s.length === 14
            ? `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`
            : v;
    };
    const fmtDataExport = v => {
        if (!v) return '';
        const d = new Date(v + 'T00:00:00');
        return isNaN(d) ? v : d.toLocaleDateString('pt-BR');
    };

    const headers = ['Cód.', 'Empresa', 'CNPJ', 'Regime', 'Insc. Estadual', 'Insc. Municipal', 'Município', 'Status', 'Dt. Cadastro', 'Endereço', 'CEP', 'Cidade', 'UF', 'E-mail Responsável'];
    const rows = _empresasFiltradas.map(e => [
        e.codigo_empresa || '',
        e.nome_empresa || '',
        fmtCnpjExport(e.cnpj),
        e.regime_enquadramento || '',
        e.inscricao_estadual || '',
        e.inscricao_municipal || '',
        e.municipio || '',
        e.status_situacao || 'Ativo',
        fmtDataExport(e.data_cadastro),
        e.endereco || '',
        e.cep || '',
        e.cidade || '',
        e.uf || '',
        e.email_responsavel || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    const hoje = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `empresas_export_${hoje}.xlsx`);
}

function mudarPaginaEmpresas(pag) {
    const totalPags = Math.ceil(_empresasFiltradas.length / _porPaginaEmpresas);
    if (pag < 1 || pag > totalPags) return;
    _paginaEmpresas = pag;
    renderizarTabelaEmpresas();
    document.getElementById('empresas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function atualizarSelectEmpresas(empresas) {
    const selectEmp = document.getElementById('empresaSelect');
    const selectRub = document.getElementById('rubricaEmpresaSelect');
    const options = '<option value="">Selecione uma empresa...</option>' + empresas.map(e => `<option value="${e.codigo_empresa}">${e.codigo_empresa} - ${e.nome_empresa}</option>`).join('');
    selectEmp.innerHTML = options;
    selectRub.innerHTML = options;
}

async function adicionarEmpresa() {
    const codigo = document.getElementById('codigoEmpresa').value.trim();
    const nome = document.getElementById('nomeEmpresa').value.trim();
    if (!codigo || !nome) { mostrarStatus('statusEmpresas', 'Preencha todos os campos', 'error'); return; }
    try {
        const { error } = await supabaseClient.from('rh_empresas').insert([{ codigo_empresa: codigo, nome_empresa: nome }]);
        if (error) throw error;
        document.getElementById('codigoEmpresa').value = ''; document.getElementById('nomeEmpresa').value = '';
        mostrarStatus('statusEmpresas', '✅ Empresa adicionada com sucesso!', 'success');
        carregarEmpresas();
    } catch (erro) { mostrarStatus('statusEmpresas', 'Erro ao adicionar empresa: ' + erro.message, 'error'); }
}

async function deletarEmpresa(codigo) {
    if (!confirm('Tem certeza que deseja deletar esta empresa?')) return;
    try {
        const { error } = await supabaseClient.from('rh_empresas').delete().eq('codigo_empresa', codigo);
        if (error) throw error;
        mostrarStatus('statusEmpresas', '✅ Empresa deletada com sucesso!', 'success');
        carregarEmpresas();
    } catch (erro) { mostrarStatus('statusEmpresas', 'Erro ao deletar empresa: ' + erro.message, 'error'); }
}

async function salvarEmailResponsavelEmpresa(codigo, valor) {
    const emailResponsavel = valor.trim() || null;
    try {
        const { error } = await supabaseClient.from('rh_empresas').update({ email_responsavel: emailResponsavel }).eq('codigo_empresa', codigo);
        if (error) throw error;
        const emp = _todasEmpresas.find(e => e.codigo_empresa === codigo);
        if (emp) emp.email_responsavel = emailResponsavel;
        mostrarStatus('statusEmpresas', '✅ E-mail responsável salvo.', 'success');
    } catch (erro) {
        mostrarStatus('statusEmpresas', 'Erro ao salvar e-mail responsável: ' + erro.message, 'error');
    }
}

// --- EMPREGADOS ---

let _todosEmpregados = [];
let _empregadosFiltrados = [];
let _paginaEmpregados = 1;
const _porPaginaEmpregados = 50;

const _COLS_DEFAULT_EMP = ['codigo_empresa','codigo_empregado','nome_empregado','data_admissao','situacao','cpf','tipo_empregado'];
let _colsSelecionadas = new Set(_COLS_DEFAULT_EMP);
let _empresasSelecionadas = new Set(); // vazio = todas

const _TODAS_SITUACOES = [
    'Trabalhando','Demitido','Doença período superior a 15 dias',
    'Aposent. por invalid. exceto acid. trab. e doença profissional',
    'Aposent. por invalid. doença profissional','Novo afast. mesma doença'
];
let _situacoesSelecionadas = new Set(_TODAS_SITUACOES);

// Filtros por coluna (estilo Excel): { [coluna]: { tipo: 'valores'|'data', selecionados: Set<string> } }
let _filtrosColuna = {};
const _MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function toggleSituacaoFiltro() {
    _situacoesSelecionadas = new Set(
        [...document.querySelectorAll('#filtroSituacaoEmp input[type=checkbox]:checked')].map(cb => cb.value)
    );
    filtrarEmpregados();
}

function selecionarTodasSituacoes(marcar) {
    document.querySelectorAll('#filtroSituacaoEmp input[type=checkbox]').forEach(cb => cb.checked = marcar);
    _situacoesSelecionadas = marcar ? new Set(_TODAS_SITUACOES) : new Set();
    filtrarEmpregados();
}

const _GRUPOS_CAMPOS = [
    { nome: 'Dados Contratuais', cols: ['codigo_empresa','codigo_empregado','nome_empregado','cod_esocial','data_admissao','fim_determinado','fim_prorrogacao','salario','categoria'] },
    { nome: 'Cargo / Função', cols: ['cod_cargo','desc_cargo','cbo','cod_funcao','desc_funcao','cod_ccusto','desc_ccusto','cod_servico','desc_servico','cod_dpto','desc_dpto','cod_sind','sindicato','jornada'] },
    { nome: 'Documentos', cols: ['cpf','pis','rg','uf_rg','orgao_rg','expedicao_rg','ric','orgao_ric','local_ric','data_exp_ric','validade_ric','passaporte','uf_passaporte','emissao_passaporte','validade_passaporte','rne','orgao_rne','expedicao_rne','cnh','categoria_cnh','expedicao_cnh','vencimento_cnh','reservista','titulo_eleitor','zona_eleitoral','secao_eleitoral','ctps','serie_ctps','uf_ctps','expedicao_ctps'] },
    { nome: 'Dados Pessoais', cols: ['data_nascimento','cidade_nascimento','uf_nascimento','pais_nascimento','nome_mae','nome_pai','sexo','estado_civil','raca_cor','nome_social','grau_instrucao'] },
    { nome: 'Endereço / Contato', cols: ['endereco','numero_end','complemento','bairro','cep','cidade','uf_endereco','telefone','celular','email'] },
    { nome: 'Situação Trabalhista', cols: ['situacao','data_demissao','motivo_demissao','tipo_empregado'] },
    { nome: 'Dados Bancários', cols: ['nome_banco','tipo_conta','agencia','conta_bancaria'] },
    { nome: 'Deficiência', cols: ['possui_deficiencia','deficiencia_fisica','deficiencia_visual','deficiencia_auditiva','deficiencia_intelectual','deficiencia_mental','outra_deficiencia','reabilitado','obs_deficiencia','cota_deficiente'] },
    { nome: 'Dependentes', cols: ['nom_dep_1','nasc_dep_1','cpf_dep_1','parentesco_dep_1','nom_dep_2','nasc_dep_2','cpf_dep_2','parentesco_dep_2','nom_dep_3','nasc_dep_3','cpf_dep_3','parentesco_dep_3','nom_dep_4','nasc_dep_4','cpf_dep_4','parentesco_dep_4','nom_dep_5','nasc_dep_5','cpf_dep_5','parentesco_dep_5','nom_dep_6','nasc_dep_6','cpf_dep_6','parentesco_dep_6','nom_dep_7','nasc_dep_7','cpf_dep_7','parentesco_dep_7'] },
];

function _headerParaCol(col) {
    const idx = _COLS_EMPREGADOS.indexOf(col);
    return idx >= 0 ? _HEADERS_EMPREGADOS[idx] : col;
}

async function carregarEmpregados() {
    try {
        // Busca paginada para superar o limite de 1000 linhas do Supabase
        let todos = [];
        let from = 0;
        const PAGE = 1000;
        while (true) {
            const { data, error } = await supabaseClient
                .from('rh_empregados')
                .select('*')
                .order('nome_empregado', { ascending: true })
                .range(from, from + PAGE - 1);
            if (error) throw error;
            todos = todos.concat(data || []);
            if (!data || data.length < PAGE) break;
            from += PAGE;
        }
        _todosEmpregados = _filtrarPorEscopo(todos);
        _empregadosFiltrados = [..._todosEmpregados];
        _paginaEmpregados = 1;
        _inicializarSeletorCampos();
        _atualizarFiltroEmpresasEmp();
        renderizarTabelaEmpregados();
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar empregados.'); }
}

function _inicializarSeletorCampos() {
    const container = document.getElementById('camposSeletorEmp');
    if (!container) return;
    let html = '';
    _GRUPOS_CAMPOS.forEach(grupo => {
        html += `<div style="grid-column:1/-1;margin-top:10px;margin-bottom:2px;font-weight:700;color:#555;font-size:11px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px;">${grupo.nome}</div>`;
        grupo.cols.forEach(col => {
            const checked = _colsSelecionadas.has(col) ? 'checked' : '';
            html += `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:2px 0;">
                <input type="checkbox" value="${col}" ${checked} onchange="toggleCampoEmp(this)"> ${_headerParaCol(col)}
            </label>`;
        });
    });
    container.innerHTML = html;
}

function _nomeEmpresa(cod) {
    const emp = _todasEmpresas.find(e => e.codigo_empresa === cod);
    return emp ? emp.nome_empresa : '';
}

function _atualizarFiltroEmpresasEmp() {
    const container = document.getElementById('filtroEmpresaEmp');
    if (!container) return;
    const codigos = [...new Set(_todosEmpregados.map(e => e.codigo_empresa).filter(Boolean))].sort();
    // Inicializa _empresasSelecionadas com todas marcadas
    _empresasSelecionadas = new Set(codigos);
    container.innerHTML = codigos.map(cod => {
        const nome = _nomeEmpresa(cod);
        const label = nome ? `<strong>${cod}</strong> — ${nome}` : `<strong>${cod}</strong>`;
        return `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" value="${cod}" checked onchange="toggleEmpresaFiltro(this)"> ${label}
        </label>`;
    }).join('');
    _atualizarQtdEmpresasFiltro(codigos.length, codigos.length);
}

function filtrarListaEmpresasCheckbox() {
    const busca = (document.getElementById('buscaEmpresaFiltro')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#filtroEmpresaEmp label').forEach(label => {
        const texto = label.textContent.toLowerCase();
        label.style.display = (!busca || texto.includes(busca)) ? '' : 'none';
    });
}

function toggleEmpresaFiltro(cb) {
    if (cb.checked) _empresasSelecionadas.add(cb.value);
    else _empresasSelecionadas.delete(cb.value);
    const total = document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').length;
    _atualizarQtdEmpresasFiltro(_empresasSelecionadas.size, total);
    filtrarEmpregados();
}

function selecionarTodasEmpresas(marcar) {
    document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').forEach(cb => {
        cb.checked = marcar;
        if (marcar) _empresasSelecionadas.add(cb.value);
        else _empresasSelecionadas.delete(cb.value);
    });
    const total = document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').length;
    _atualizarQtdEmpresasFiltro(_empresasSelecionadas.size, total);
    filtrarEmpregados();
}

function _atualizarQtdEmpresasFiltro(selecionadas, total) {
    const span = document.getElementById('qtdEmpresasFiltro');
    if (span) span.textContent = selecionadas === total ? `(todas — ${total})` : `(${selecionadas} de ${total})`;
}

function toggleCampoEmp(cb) {
    if (cb.checked) _colsSelecionadas.add(cb.value);
    else {
        _colsSelecionadas.delete(cb.value);
        delete _filtrosColuna[cb.value];
    }
    filtrarEmpregados();
}

function selecionarTodosCampos(marcar) {
    if (marcar) {
        _colsSelecionadas = new Set(_COLS_EMPREGADOS);
    } else {
        _colsSelecionadas = new Set(['codigo_empresa','codigo_empregado','nome_empregado']);
        Object.keys(_filtrosColuna).forEach(col => {
            if (!_colsSelecionadas.has(col)) delete _filtrosColuna[col];
        });
    }
    document.querySelectorAll('#camposSeletorEmp input[type=checkbox]').forEach(cb => {
        cb.checked = _colsSelecionadas.has(cb.value);
    });
    filtrarEmpregados();
}

function limparTodosFiltrosColuna() {
    _filtrosColuna = {};
    filtrarEmpregados();
}

function _condicoesFiltroBaseEmp() {
    const nome = (document.getElementById('filtroNomeEmp')?.value || '').toLowerCase().trim();
    const tipoEmp = document.getElementById('filtroTipoEmp')?.value || '';
    const totalEmpresas = document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').length;
    const todasMarcadas = _empresasSelecionadas.size === totalEmpresas;
    const todasSituacoes = _situacoesSelecionadas.size === _TODAS_SITUACOES.length;
    return { nome, tipoEmp, todasMarcadas, todasSituacoes };
}

function _empregadoPassaFiltroBase(e, cond) {
    const { nome, tipoEmp, todasMarcadas, todasSituacoes } = cond;
    if (!todasMarcadas && !_empresasSelecionadas.has(e.codigo_empresa)) return false;
    if (nome && !((e.nome_empregado || '').toLowerCase().includes(nome) || (e.codigo_empregado || '').toLowerCase().includes(nome))) return false;
    if (!todasSituacoes && _situacoesSelecionadas.size > 0 && !_situacoesSelecionadas.has(e.situacao || '')) return false;
    if (_situacoesSelecionadas.size === 0) return false;
    if (tipoEmp === 'EMP_ESTAG') {
        if (!['Empregado', 'Estágiario'].includes(e.tipo_empregado || '')) return false;
    } else if (tipoEmp && (e.tipo_empregado || '') !== tipoEmp) return false;
    return true;
}

function _chaveAnoMesColuna(v) {
    if (!v) return '__BLANK__';
    const d = new Date(v + 'T00:00:00');
    if (isNaN(d)) return '__BLANK__';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _chaveValorColuna(v) {
    return (v === null || v === undefined || v === '') ? '__BLANK__' : String(v);
}

function _empregadoPassaFiltrosColuna(e, colExcluida) {
    for (const col in _filtrosColuna) {
        if (col === colExcluida) continue;
        const filtro = _filtrosColuna[col];
        if (!filtro || !filtro.selecionados || filtro.selecionados.size === 0) continue;
        const chave = filtro.tipo === 'data' ? _chaveAnoMesColuna(e[col]) : _chaveValorColuna(e[col]);
        if (!filtro.selecionados.has(chave)) return false;
    }
    return true;
}

function _empregadosComFiltroBase(colExcluida) {
    const cond = _condicoesFiltroBaseEmp();
    return _todosEmpregados.filter(e => _empregadoPassaFiltroBase(e, cond) && _empregadoPassaFiltrosColuna(e, colExcluida));
}

function filtrarEmpregados() {
    _empregadosFiltrados = _empregadosComFiltroBase(null);
    _paginaEmpregados = 1;
    renderizarTabelaEmpregados();
}

function renderizarTabelaEmpregados() {
    const thead = document.getElementById('empregadosThead');
    const tbody = document.getElementById('empregadosTableBody');
    const paginacao = document.getElementById('paginacaoEmpregados');
    const info = document.getElementById('infoEmpregados');
    if (!tbody) return;

    const colsAtivas = _COLS_EMPREGADOS.filter(c => _colsSelecionadas.has(c));

    if (_empregadosFiltrados.length === 0) {
        if (thead) thead.innerHTML = '<tr><th>Empresa</th><th>Código</th><th>Nome</th></tr>';
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#95A5A6;padding:20px;">Nenhum empregado encontrado</td></tr>';
        if (paginacao) paginacao.innerHTML = '';
        if (info) info.textContent = '0 empregados';
        return;
    }

    const totalPags = Math.ceil(_empregadosFiltrados.length / _porPaginaEmpregados);
    const inicio = (_paginaEmpregados - 1) * _porPaginaEmpregados;
    const pagina = _empregadosFiltrados.slice(inicio, inicio + _porPaginaEmpregados);

    if (thead) {
        const ths = colsAtivas.map(c => {
            const ativo = _filtrosColuna[c] ? ' filtro-col-ativo' : '';
            return `<th title="${_headerParaCol(c)}">
                <span style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <span>${_headerParaCol(c)}</span>
                    <span class="filtro-col-icone${ativo}" onclick="abrirFiltroColuna(event, '${c}')" title="Filtrar ${_headerParaCol(c)}">▾</span>
                </span>
            </th>`;
        }).join('');
        thead.innerHTML = `<tr>${ths}<th>Ações</th></tr>`;
    }

    const fmtDate = v => {
        if (!v) return '<span style="color:#C0C0C0;">—</span>';
        const d = new Date(v + 'T00:00:00');
        return isNaN(d) ? v : d.toLocaleDateString('pt-BR');
    };
    const fmtSalario = v => {
        const n = parseFloat(v);
        if (isNaN(n)) return '<span style="color:#C0C0C0;">—</span>';
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const fmtCpf = v => {
        if (!v) return '<span style="color:#C0C0C0;">—</span>';
        const s = String(v).replace(/\D/g, '').padStart(11, '0');
        return s.length === 11 ? `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}` : String(v);
    };
    const fmt = v => (v !== null && v !== undefined && v !== '') ? String(v) : '<span style="color:#C0C0C0;">—</span>';

    tbody.innerHTML = pagina.map(e => {
        const cells = colsAtivas.map(c => {
            const v = e[c];
            let display;
            if (_DATE_COLS_EMPREGADOS.has(c)) display = fmtDate(v);
            else if (c === 'salario')          display = fmtSalario(v);
            else if (c === 'cpf')              display = fmtCpf(v);
            else                               display = fmt(v);
            const title = (v !== null && v !== undefined && v !== '') ? ` title="${String(v).replace(/"/g, '&quot;')}"` : '';
            return `<td${title}>${display}</td>`;
        }).join('');
        return `<tr>${cells}<td><button type="button" class="btn-delete" onclick="deletarEmpregado('${e.codigo_empresa}','${e.codigo_empregado}')">🗑</button></td></tr>`;
    }).join('');

    if (info) info.textContent = `${_empregadosFiltrados.length} empregado(s) encontrado(s)`;

    if (paginacao) {
        paginacao.innerHTML = totalPags <= 1 ? '' : `
            <button onclick="mudarPaginaEmpregados(${_paginaEmpregados - 1})" ${_paginaEmpregados === 1 ? 'disabled' : ''}>‹ Anterior</button>
            <span class="pag-info">Página <strong>${_paginaEmpregados}</strong> de <strong>${totalPags}</strong> — ${_empregadosFiltrados.length} empregado(s)</span>
            <button onclick="mudarPaginaEmpregados(${_paginaEmpregados + 1})" ${_paginaEmpregados === totalPags ? 'disabled' : ''}>Próxima ›</button>
        `;
    }
}

// --- FILTRO DE COLUNA (estilo Excel) ---

function _fmtValorFiltroColuna(col, v) {
    if (v === null || v === undefined || v === '') return '(Vazios)';
    if (col === 'salario') {
        const n = parseFloat(v);
        return isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (col === 'cpf') {
        const s = String(v).replace(/\D/g, '').padStart(11, '0');
        return s.length === 11 ? `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}` : String(v);
    }
    return String(v);
}

function abrirFiltroColuna(ev, col) {
    ev.stopPropagation();
    _fecharFiltroColunaDropdown();

    const icone = ev.currentTarget;
    const rect = icone.getBoundingClientRect();
    const baseRows = _empregadosComFiltroBase(col);
    const filtroAtual = _filtrosColuna[col];
    const isData = _DATE_COLS_EMPREGADOS.has(col);

    const painel = document.createElement('div');
    painel.id = 'filtroColunaDropdown';
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 280));
    painel.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${left}px;width:260px;max-height:360px;background:white;border:1px solid #C0C0C0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:100000;display:flex;flex-direction:column;font-size:12px;`;
    painel.innerHTML = `
        <div style="padding:8px;border-bottom:1px solid #EEE;">
            <input type="text" id="buscaFiltroColuna" placeholder="Buscar..." oninput="_buscarFiltroColunaLista()" style="width:100%;padding:5px 7px;border:1px solid #DEE2E6;border-radius:5px;font-size:12px;box-sizing:border-box;">
        </div>
        <div style="padding:6px 8px;border-bottom:1px solid #EEE;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;">
                <input type="checkbox" id="filtroColunaSelecionarTudo" checked onchange="_toggleSelecionarTudoFiltroColuna(this.checked)"> Selecionar tudo
            </label>
        </div>
        <div id="filtroColunaLista" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:2px;"></div>
        <div style="padding:8px;border-top:1px solid #EEE;display:flex;justify-content:space-between;gap:8px;">
            <button type="button" onclick="_limparFiltroColuna('${col}')" style="padding:5px 10px;border:1px solid #C0C0C0;border-radius:5px;background:white;cursor:pointer;font-size:11px;">Limpar filtro</button>
            <button type="button" onclick="_aplicarFiltroColunaOk('${col}')" style="padding:5px 14px;border:none;border-radius:5px;background:#8B3A3A;color:white;cursor:pointer;font-size:11px;font-weight:600;">OK</button>
        </div>
    `;
    document.body.appendChild(painel);

    const lista = painel.querySelector('#filtroColunaLista');
    if (isData) _renderizarFiltroColunaData(col, lista, baseRows, filtroAtual);
    else _renderizarFiltroColunaValores(col, lista, baseRows, filtroAtual);

    _atualizarSelecionarTudoFiltroColuna();

    setTimeout(() => document.addEventListener('mousedown', _cliqueForaFiltroColuna), 0);
}

function _cliqueForaFiltroColuna(ev) {
    const painel = document.getElementById('filtroColunaDropdown');
    if (painel && !painel.contains(ev.target)) _fecharFiltroColunaDropdown();
}

function _fecharFiltroColunaDropdown() {
    const painel = document.getElementById('filtroColunaDropdown');
    if (painel) painel.remove();
    document.removeEventListener('mousedown', _cliqueForaFiltroColuna);
}

function _renderizarFiltroColunaValores(col, container, baseRows, filtroAtual) {
    const chaves = new Map(); // chave -> label
    baseRows.forEach(e => {
        const chave = _chaveValorColuna(e[col]);
        if (!chaves.has(chave)) chaves.set(chave, _fmtValorFiltroColuna(col, e[col]));
    });
    const ordenadas = [...chaves.entries()].sort((a, b) => {
        if (a[0] === '__BLANK__') return 1;
        if (b[0] === '__BLANK__') return -1;
        return a[1].localeCompare(b[1], 'pt-BR');
    });
    container.innerHTML = ordenadas.map(([chave, label]) => {
        const checked = filtroAtual ? filtroAtual.selecionados.has(chave) : true;
        const escapado = chave.replace(/"/g, '&quot;');
        return `<label class="filtro-col-item" data-texto="${label.toLowerCase()}" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;">
            <input type="checkbox" class="filtro-col-check" value="${escapado}" ${checked ? 'checked' : ''} onchange="_atualizarSelecionarTudoFiltroColuna()"> <span style="white-space:normal;">${label}</span>
        </label>`;
    }).join('') || '<div style="color:#95A5A6;padding:6px 0;">Nenhum valor</div>';
}

function _renderizarFiltroColunaData(col, container, baseRows, filtroAtual) {
    const mapa = {}; // ano -> Set(mes)
    let temVazio = false;
    baseRows.forEach(e => {
        const v = e[col];
        if (!v) { temVazio = true; return; }
        const d = new Date(v + 'T00:00:00');
        if (isNaN(d)) { temVazio = true; return; }
        const ano = d.getFullYear();
        const mes = d.getMonth() + 1;
        if (!mapa[ano]) mapa[ano] = new Set();
        mapa[ano].add(mes);
    });
    const anos = Object.keys(mapa).map(Number).sort((a, b) => b - a);
    const checkKey = chave => filtroAtual ? filtroAtual.selecionados.has(chave) : true;

    let html = '';
    anos.forEach(ano => {
        const meses = [...mapa[ano]].sort((a, b) => a - b);
        const todosChecados = meses.every(m => checkKey(`${ano}-${String(m).padStart(2, '0')}`));
        const algumChecado = meses.some(m => checkKey(`${ano}-${String(m).padStart(2, '0')}`));
        html += `<div class="filtro-col-item" data-texto="${ano}">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;padding:2px 0;">
                <input type="checkbox" class="filtro-col-check-ano" data-ano="${ano}" ${todosChecados ? 'checked' : ''} ${(!todosChecados && algumChecado) ? 'data-indeterminate="1"' : ''} onchange="_toggleAnoFiltroColuna(${ano}, this.checked)"> ${ano}
            </label>
            <div style="padding-left:18px;display:flex;flex-direction:column;gap:1px;">
                ${meses.map(m => {
                    const chave = `${ano}-${String(m).padStart(2, '0')}`;
                    return `<label class="filtro-col-item" data-texto="${_MESES_ABREV[m - 1].toLowerCase()} ${ano}" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:1px 0;">
                        <input type="checkbox" class="filtro-col-check filtro-col-check-mes" data-ano="${ano}" value="${chave}" ${checkKey(chave) ? 'checked' : ''} onchange="_atualizarEstadoAnoFiltroColuna(${ano}); _atualizarSelecionarTudoFiltroColuna();"> ${_MESES_ABREV[m - 1]}
                    </label>`;
                }).join('')}
            </div>
        </div>`;
    });
    if (temVazio) {
        html += `<label class="filtro-col-item" data-texto="vazios" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;">
            <input type="checkbox" class="filtro-col-check" value="__BLANK__" ${checkKey('__BLANK__') ? 'checked' : ''} onchange="_atualizarSelecionarTudoFiltroColuna()"> (Vazios)
        </label>`;
    }
    container.innerHTML = html || '<div style="color:#95A5A6;padding:6px 0;">Nenhum valor</div>';
    container.querySelectorAll('.filtro-col-check-ano').forEach(cb => {
        if (cb.dataset.indeterminate === '1') cb.indeterminate = true;
    });
}

function _toggleAnoFiltroColuna(ano, marcar) {
    document.querySelectorAll(`#filtroColunaLista .filtro-col-check-mes[data-ano="${ano}"]`).forEach(cb => cb.checked = marcar);
    _atualizarSelecionarTudoFiltroColuna();
}

function _atualizarEstadoAnoFiltroColuna(ano) {
    const meses = [...document.querySelectorAll(`#filtroColunaLista .filtro-col-check-mes[data-ano="${ano}"]`)];
    const anoCb = document.querySelector(`#filtroColunaLista .filtro-col-check-ano[data-ano="${ano}"]`);
    if (!anoCb) return;
    const todos = meses.every(cb => cb.checked);
    const nenhum = meses.every(cb => !cb.checked);
    anoCb.checked = todos;
    anoCb.indeterminate = !todos && !nenhum;
}

function _toggleSelecionarTudoFiltroColuna(marcar) {
    document.querySelectorAll('#filtroColunaLista input[type=checkbox]').forEach(cb => {
        cb.checked = marcar;
        cb.indeterminate = false;
    });
}

function _atualizarSelecionarTudoFiltroColuna() {
    const master = document.getElementById('filtroColunaSelecionarTudo');
    if (!master) return;
    const folhas = [...document.querySelectorAll('#filtroColunaLista .filtro-col-check')];
    if (folhas.length === 0) { master.checked = true; master.indeterminate = false; return; }
    const todos = folhas.every(cb => cb.checked);
    const nenhum = folhas.every(cb => !cb.checked);
    master.checked = todos;
    master.indeterminate = !todos && !nenhum;
}

function _buscarFiltroColunaLista() {
    const busca = (document.getElementById('buscaFiltroColuna')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#filtroColunaLista .filtro-col-item').forEach(item => {
        const texto = item.getAttribute('data-texto') || '';
        item.style.display = (!busca || texto.includes(busca)) ? '' : 'none';
    });
}

function _limparFiltroColuna(col) {
    delete _filtrosColuna[col];
    _fecharFiltroColunaDropdown();
    filtrarEmpregados();
}

function _aplicarFiltroColunaOk(col) {
    const isData = _DATE_COLS_EMPREGADOS.has(col);
    const folhas = [...document.querySelectorAll('#filtroColunaLista .filtro-col-check')];
    const selecionados = new Set(folhas.filter(cb => cb.checked).map(cb => cb.value));

    // Se a seleção cobre todos os valores possíveis da coluna (dataset completo, sem
    // considerar outros filtros), equivale a "sem filtro" — removemos em vez de armazenar.
    const todosPossiveis = new Set();
    _todosEmpregados.forEach(e => {
        todosPossiveis.add(isData ? _chaveAnoMesColuna(e[col]) : _chaveValorColuna(e[col]));
    });
    const cobreTudo = selecionados.size === todosPossiveis.size && [...todosPossiveis].every(k => selecionados.has(k));

    if (cobreTudo) delete _filtrosColuna[col];
    else _filtrosColuna[col] = { tipo: isData ? 'data' : 'valores', selecionados };

    _fecharFiltroColunaDropdown();
    filtrarEmpregados();
}

function mudarPaginaEmpregados(pag) {
    const totalPags = Math.ceil(_empregadosFiltrados.length / _porPaginaEmpregados);
    if (pag < 1 || pag > totalPags) return;
    _paginaEmpregados = pag;
    renderizarTabelaEmpregados();
    document.getElementById('empregados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportarRelatorioEmpregados() {
    const colsAtivas = _COLS_EMPREGADOS.filter(c => _colsSelecionadas.has(c));
    if (colsAtivas.length === 0) { alert('Selecione pelo menos um campo para exportar.'); return; }
    const headers = colsAtivas.map(c => _headerParaCol(c));
    const rows = _empregadosFiltrados.map(e => colsAtivas.map(c => {
        const v = e[c];
        if (_DATE_COLS_EMPREGADOS.has(c) && v) {
            const d = new Date(v + 'T00:00:00');
            return isNaN(d) ? (v || '') : d.toLocaleDateString('pt-BR');
        }
        if (c === 'salario' && v !== null && v !== undefined && v !== '') {
            const n = parseFloat(v);
            return isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (c === 'cpf' && v) {
            const s = String(v).replace(/\D/g, '').padStart(11, '0');
            return s.length === 11 ? `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}` : String(v);
        }
        return (v !== null && v !== undefined) ? v : '';
    }));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empregados');
    XLSX.writeFile(wb, 'relatorio_empregados.xlsx');
}

function gerarRelatorioPDFEmpregados() {
    const colsAtivas = _COLS_EMPREGADOS.filter(c => _colsSelecionadas.has(c));
    if (colsAtivas.length === 0) { alert('Selecione pelo menos um campo para gerar o relatório.'); return; }
    if (_empregadosFiltrados.length === 0) { alert('Nenhum empregado no filtro atual.'); return; }

    const headers = colsAtivas.map(c => _headerParaCol(c));
    const fmtDate = v => {
        if (!v) return '';
        const d = new Date(v + 'T00:00:00');
        return isNaN(d) ? v : d.toLocaleDateString('pt-BR');
    };
    const fmtSalarioPdf = v => {
        const n = parseFloat(v);
        return isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const fmtCpfPdf = v => {
        if (!v) return '';
        const s = String(v).replace(/\D/g, '').padStart(11, '0');
        return s.length === 11 ? `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}` : String(v);
    };
    const fmt = v => (v !== null && v !== undefined && v !== '') ? String(v) : '';

    // Informação de empresa(s)
    const codsAtivos = [..._empresasSelecionadas].sort();
    const totalEmpresas = document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').length;
    const todasMarcadas = _empresasSelecionadas.size === totalEmpresas;
    let infoEmpresas = '';
    if (todasMarcadas || codsAtivos.length === 0) {
        infoEmpresas = '<span style="color:#555;">Todas as empresas</span>';
    } else if (codsAtivos.length === 1) {
        const emp = _todasEmpresas.find(e => e.codigo_empresa === codsAtivos[0]);
        const nome = emp ? emp.nome_empresa : codsAtivos[0];
        const cnpj = emp?.cnpj ? emp.cnpj : '—';
        infoEmpresas = `
            <div style="display:flex;gap:40px;align-items:flex-start;">
                <div><span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Empresa</span><br><strong style="font-size:14px;">${nome}</strong></div>
                <div><span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">CNPJ</span><br><strong style="font-size:14px;">${cnpj}</strong></div>
            </div>`;
    } else {
        const lista = codsAtivos.map(cod => {
            const emp = _todasEmpresas.find(e => e.codigo_empresa === cod);
            return emp ? `${cod} — ${emp.nome_empresa}` : cod;
        }).join('<br>');
        infoEmpresas = `<div><span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Empresas (${codsAtivos.length})</span><br><span style="font-size:12px;line-height:1.8;">${lista}</span></div>`;
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const muitasCols = colsAtivas.length > 8;

    const linhas = _empregadosFiltrados.map(e => {
        const cells = colsAtivas.map(c => {
            const v = e[c];
            let txt;
            if (_DATE_COLS_EMPREGADOS.has(c)) txt = fmtDate(v);
            else if (c === 'salario')          txt = fmtSalarioPdf(v);
            else if (c === 'cpf')              txt = fmtCpfPdf(v);
            else                               txt = fmt(v);
            return `<td>${txt || '&nbsp;'}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Empregados — SCONT</title>
<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #2C3E50; background: white; }

    /* Cabeçalho */
    .report-header {
        background: linear-gradient(135deg, #8B3A3A 0%, #6B2A2A 100%);
        color: white;
        padding: 20px 30px;
        display: flex;
        align-items: center;
        gap: 24px;
        border-radius: 0;
    }
    .report-header img { height: 48px; filter: brightness(0) invert(1); }
    .report-header-text { flex: 1; }
    .report-header-text h1 { font-size: 18px; font-weight: 700; letter-spacing: .5px; }
    .report-header-text p { font-size: 12px; opacity: .8; margin-top: 2px; }

    /* Info empresa */
    .empresa-info {
        background: #F8F9FA;
        border-bottom: 2px solid #E0E0E0;
        padding: 14px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
    }
    .empresa-info .data-geracao { font-size: 11px; color: #888; }

    /* Tabela */
    .table-wrap { padding: 16px 30px 30px; }
    table { width: 100%; border-collapse: collapse; font-size: ${muitasCols ? '9px' : '11px'}; }
    thead tr { background: linear-gradient(135deg, #8B3A3A 0%, #6B2A2A 100%); color: white; }
    th { padding: ${muitasCols ? '6px 5px' : '8px 10px'}; text-align: left; font-weight: 600; white-space: nowrap; }
    td { padding: ${muitasCols ? '5px 5px' : '7px 10px'}; border-bottom: 1px solid #EEEEEE; vertical-align: top; word-break: break-word; }
    tbody tr:nth-child(even) { background: #F9F4F4; }
    tbody tr:hover { background: #F2EAEA; }

    /* Rodapé */
    .report-footer {
        border-top: 2px solid #8B3A3A;
        padding: 10px 30px;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #888;
    }

    @page { size: A4 landscape; margin: 10mm; }
    @media print {
        .report-header { border-radius: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
</head>
<body>

<div class="report-header">
    <img src="https://scontdf.com.br/wp-content/uploads/elementor/thumbs/LogoScont-peic298y16fua1mv1zkur66kgxw0v6rzhu846yyg3k.png" alt="SCONT">
    <div class="report-header-text">
        <h1>Relatório de Empregados</h1>
        <p>SCONT Soluções Contábeis — Gestão de RH</p>
    </div>
</div>

<div class="empresa-info">
    <div>${infoEmpresas}</div>
    <div class="data-geracao">Gerado em: <strong>${dataGeracao}</strong><br>${_empregadosFiltrados.length} empregado(s)</div>
</div>

<div class="table-wrap">
    <table>
        <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${linhas}
        </tbody>
    </table>
</div>

<div class="report-footer">
    <span>SCONT Soluções Contábeis — Relatório gerado automaticamente pelo Portal SCONT</span>
    <span>${dataGeracao}</span>
</div>

<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
}

async function adicionarEmpregado() {
    const codigoEmpresa = document.getElementById('empresaSelect').value;
    const codigoEmpregado = document.getElementById('codigoEmpregado').value.trim();
    const nomeEmpregado = document.getElementById('nomeEmpregado').value.trim();
    if (!codigoEmpresa || !codigoEmpregado || !nomeEmpregado) { mostrarStatus('statusEmpregados', 'Preencha todos os campos', 'error'); return; }
    try {
        const { error } = await supabaseClient.from('rh_empregados').insert([{ codigo_empresa: codigoEmpresa, codigo_empregado: codigoEmpregado, nome_empregado: nomeEmpregado }]);
        if (error) throw error;
        document.getElementById('codigoEmpregado').value = ''; document.getElementById('nomeEmpregado').value = '';
        mostrarStatus('statusEmpregados', '✅ Empregado adicionado com sucesso!', 'success');
        carregarEmpregados();
    } catch (erro) { mostrarStatus('statusEmpregados', 'Erro ao adicionar empregado: ' + erro.message, 'error'); }
}

async function deletarEmpregado(codigoEmpresa, codigoEmpregado) {
    if (!confirm('Tem certeza que deseja deletar este empregado?')) return;
    try {
        const { error } = await supabaseClient.from('rh_empregados').delete()
            .eq('codigo_empresa', codigoEmpresa)
            .eq('codigo_empregado', codigoEmpregado);
        if (error) throw error;
        mostrarStatus('statusEmpregados', '✅ Empregado deletado com sucesso!', 'success');
        carregarEmpregados();
    } catch (erro) { mostrarStatus('statusEmpregados', 'Erro ao deletar empregado: ' + erro.message, 'error'); }
}

// --- VISÃO GERENCIAL DE EMPREGADOS ---

let _vgEmpresasSelecionadas = new Set(); // vazio até inicializar
let _vgLinhasExpandidas = new Set();

function abrirVisaoGerencial() {
    const hoje = new Date();
    const selMes = document.getElementById('vgMes');
    const inpAno = document.getElementById('vgAno');
    if (selMes && !selMes.dataset.inicializado) {
        selMes.value = String(hoje.getMonth() + 1);
        selMes.dataset.inicializado = '1';
    }
    if (inpAno && !inpAno.value) {
        inpAno.value = String(hoje.getFullYear());
    }
    // Padrão da série histórica: últimos 6 meses até o mês atual
    const seisAntes = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    const selMesDe = document.getElementById('vgMesDe');
    const inpAnoDe = document.getElementById('vgAnoDe');
    const selMesAte = document.getElementById('vgMesAte');
    const inpAnoAte = document.getElementById('vgAnoAte');
    if (selMesDe && !selMesDe.dataset.inicializado) {
        selMesDe.value = String(seisAntes.getMonth() + 1);
        selMesDe.dataset.inicializado = '1';
    }
    if (inpAnoDe && !inpAnoDe.value) inpAnoDe.value = String(seisAntes.getFullYear());
    if (selMesAte && !selMesAte.dataset.inicializado) {
        selMesAte.value = String(hoje.getMonth() + 1);
        selMesAte.dataset.inicializado = '1';
    }
    if (inpAnoAte && !inpAnoAte.value) inpAnoAte.value = String(hoje.getFullYear());

    _vgInicializarFiltroEmpresas();
    _vgInicializarFiltroSituacoes();
    document.getElementById('modalVisaoGerencial').classList.add('active');
    atualizarVisaoGerencial();
}

function fecharVisaoGerencial() {
    document.getElementById('modalVisaoGerencial').classList.remove('active');
}

function _vgMudarModo() {
    const modo = document.querySelector('input[name="vgModo"]:checked')?.value || 'unico';
    const camposUnico = document.getElementById('vgCamposUnico');
    const camposSerie = document.getElementById('vgCamposSerie');
    if (camposUnico) camposUnico.style.display = modo === 'unico' ? 'flex' : 'none';
    if (camposSerie) camposSerie.style.display = modo === 'serie' ? 'flex' : 'none';
    const colPrincipal = document.getElementById('vgColPrincipal');
    if (colPrincipal) colPrincipal.textContent = modo === 'unico' ? 'Empresa' : 'Mês/Ano';
    _vgLinhasExpandidas.clear();
    atualizarVisaoGerencial();
}

function _vgInicializarFiltroEmpresas() {
    const container = document.getElementById('vgFiltroEmpresas');
    if (!container) return;
    const codigos = [...new Set(_todosEmpregados.map(e => e.codigo_empresa).filter(Boolean))].sort();
    if (_vgEmpresasSelecionadas.size === 0) _vgEmpresasSelecionadas = new Set(codigos);
    container.innerHTML = codigos.map(cod => {
        const nome = _nomeEmpresa(cod);
        const label = nome ? `<strong>${cod}</strong> — ${nome}` : `<strong>${cod}</strong>`;
        const checked = _vgEmpresasSelecionadas.has(cod) ? 'checked' : '';
        return `<label title="${cod}${nome ? ' — ' + nome : ''}" style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <input type="checkbox" value="${cod}" ${checked} onchange="_vgToggleEmpresa(this)" style="flex:0 0 auto;"> <span style="overflow:hidden;text-overflow:ellipsis;">${label}</span>
        </label>`;
    }).join('');
    _vgAtualizarQtdEmpresas(codigos.length);
}

function _vgToggleEmpresa(cb) {
    if (cb.checked) _vgEmpresasSelecionadas.add(cb.value);
    else _vgEmpresasSelecionadas.delete(cb.value);
    _vgAtualizarQtdEmpresas(document.querySelectorAll('#vgFiltroEmpresas input[type=checkbox]').length);
    atualizarVisaoGerencial();
}

function _vgFiltrarListaEmpresas() {
    const busca = (document.getElementById('vgBuscaEmpresa')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#vgFiltroEmpresas label').forEach(label => {
        const texto = label.textContent.toLowerCase();
        label.style.display = (!busca || texto.includes(busca)) ? '' : 'none';
    });
}

function vgSelecionarTodasEmpresas(marcar) {
    document.querySelectorAll('#vgFiltroEmpresas input[type=checkbox]').forEach(cb => {
        cb.checked = marcar;
        if (marcar) _vgEmpresasSelecionadas.add(cb.value);
        else _vgEmpresasSelecionadas.delete(cb.value);
    });
    _vgAtualizarQtdEmpresas(document.querySelectorAll('#vgFiltroEmpresas input[type=checkbox]').length);
    atualizarVisaoGerencial();
}

function _vgAtualizarQtdEmpresas(total) {
    const span = document.getElementById('vgQtdEmpresas');
    if (span) span.textContent = _vgEmpresasSelecionadas.size === total ? `(todas — ${total})` : `(${_vgEmpresasSelecionadas.size} de ${total})`;
}

let _vgSituacoesSelecionadas = new Set(_TODAS_SITUACOES);

function _vgInicializarFiltroSituacoes() {
    const container = document.getElementById('vgFiltroSituacao');
    if (!container || container.dataset.inicializado) return;
    container.innerHTML = _TODAS_SITUACOES.map(sit => `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" value="${sit}" checked onchange="_vgToggleSituacao(this)"> <span>${sit}</span>
        </label>`).join('');
    container.dataset.inicializado = '1';
}

function _vgToggleSituacao(cb) {
    if (cb.checked) _vgSituacoesSelecionadas.add(cb.value);
    else _vgSituacoesSelecionadas.delete(cb.value);
    atualizarVisaoGerencial();
}

function vgSelecionarTodasSituacoes(marcar) {
    document.querySelectorAll('#vgFiltroSituacao input[type=checkbox]').forEach(cb => {
        cb.checked = marcar;
        if (marcar) _vgSituacoesSelecionadas.add(cb.value);
        else _vgSituacoesSelecionadas.delete(cb.value);
    });
    atualizarVisaoGerencial();
}

const _VG_TIPOS = ['Empregado', 'Estágiario', 'Contribuinte'];

/** Empregado conta no mês se admitido até o fim do mês e (sem demissão ou demitido depois do fim do mês). */
function _vgContaNoMes(empregado, inicioMes, fimMes) {
    if (!empregado.data_admissao) return false;
    const admissao = new Date(empregado.data_admissao + 'T00:00:00');
    if (isNaN(admissao) || admissao > fimMes) return false;
    if (empregado.data_demissao) {
        const demissao = new Date(empregado.data_demissao + 'T00:00:00');
        if (!isNaN(demissao) && demissao <= fimMes) return false;
    }
    return true;
}

const _VG_NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/** Calcula, para um mês/ano e um conjunto de empresas, a contagem de vínculos ativos por empresa/tipo/situação. */
function _vgCalcularContagem(mes, ano, empresasConsideradas) {
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59);

    // { codigo_empresa: { nome, total, porTipo:{}, porSituacao:{ situacao: { total, porTipo:{} } } } }
    const porEmpresa = {};
    empresasConsideradas.forEach(cod => {
        porEmpresa[cod] = { nome: _nomeEmpresa(cod) || cod, total: 0, porTipo: {}, porSituacao: {} };
    });

    const todasSituacoes = _vgSituacoesSelecionadas.size === _TODAS_SITUACOES.length;

    _todosEmpregados.forEach(e => {
        const cod = e.codigo_empresa;
        if (!porEmpresa[cod]) return;
        if (!_vgContaNoMes(e, inicioMes, fimMes)) return;
        if (!todasSituacoes) {
            if (_vgSituacoesSelecionadas.size === 0) return;
            if (!_vgSituacoesSelecionadas.has(e.situacao || '')) return;
        }

        const tipo = _VG_TIPOS.includes(e.tipo_empregado) ? e.tipo_empregado : 'Outros';
        const situacao = e.situacao || 'Não informado';

        const registro = porEmpresa[cod];
        registro.total++;
        registro.porTipo[tipo] = (registro.porTipo[tipo] || 0) + 1;

        if (!registro.porSituacao[situacao]) registro.porSituacao[situacao] = { total: 0, porTipo: {} };
        registro.porSituacao[situacao].total++;
        registro.porSituacao[situacao].porTipo[tipo] = (registro.porSituacao[situacao].porTipo[tipo] || 0) + 1;
    });

    return porEmpresa;
}

function atualizarVisaoGerencial() {
    const modo = document.querySelector('input[name="vgModo"]:checked')?.value || 'unico';
    if (modo === 'serie') _vgAtualizarSerie();
    else _vgAtualizarUnico();
}

function _vgAtualizarUnico() {
    const mes = parseInt(document.getElementById('vgMes')?.value, 10);
    const ano = parseInt(document.getElementById('vgAno')?.value, 10);
    const tbody = document.getElementById('vgTableBody');
    const resumo = document.getElementById('vgResumo');
    if (!tbody || !mes || !ano) return;

    const empresasConsideradas = [..._vgEmpresasSelecionadas];
    if (empresasConsideradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;padding:20px;">Nenhuma empresa selecionada.</td></tr>';
        if (resumo) resumo.textContent = '';
        return;
    }

    _vgOcultarGrafico();

    const porEmpresa = _vgCalcularContagem(mes, ano, empresasConsideradas);
    _vgRenderizarTabela(porEmpresa);

    const totalGeral = Object.values(porEmpresa).reduce((s, r) => s + r.total, 0);
    if (resumo) resumo.textContent = `${totalGeral} vínculo(s) ativo(s) em ${String(mes).padStart(2, '0')}/${ano} nas ${empresasConsideradas.length} empresa(s) selecionada(s).`;
}

function _vgAtualizarSerie() {
    const mesDe = parseInt(document.getElementById('vgMesDe')?.value, 10);
    const anoDe = parseInt(document.getElementById('vgAnoDe')?.value, 10);
    const mesAte = parseInt(document.getElementById('vgMesAte')?.value, 10);
    const anoAte = parseInt(document.getElementById('vgAnoAte')?.value, 10);
    const tbody = document.getElementById('vgTableBody');
    const resumo = document.getElementById('vgResumo');
    if (!tbody || !mesDe || !anoDe || !mesAte || !anoAte) return;

    const empresasConsideradas = [..._vgEmpresasSelecionadas];
    if (empresasConsideradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;padding:20px;">Nenhuma empresa selecionada.</td></tr>';
        if (resumo) resumo.textContent = '';
        return;
    }

    let chaveInicio = anoDe * 12 + (mesDe - 1);
    let chaveFim = anoAte * 12 + (mesAte - 1);
    if (chaveInicio > chaveFim) { const tmp = chaveInicio; chaveInicio = chaveFim; chaveFim = tmp; }

    const periodos = [];
    for (let c = chaveInicio; c <= chaveFim; c++) {
        periodos.push({ ano: Math.floor(c / 12), mes: (c % 12) + 1, chave: String(c) });
    }

    const dados = periodos.map(p => ({ ...p, porEmpresa: _vgCalcularContagem(p.mes, p.ano, empresasConsideradas) }));

    _vgRenderizarTabelaSerie(dados);
    _vgRenderizarGrafico(dados);

    const primeiro = periodos[0], ultimo = periodos[periodos.length - 1];
    if (resumo) resumo.textContent = `Série de ${periodos.length} mês(es), de ${_VG_NOMES_MES[primeiro.mes - 1]}/${primeiro.ano} até ${_VG_NOMES_MES[ultimo.mes - 1]}/${ultimo.ano}, em ${empresasConsideradas.length} empresa(s) selecionada(s).`;
}

let _vgChartInstance = null;

/** Desenha o gráfico de barras empilhadas (Empregados/Estagiários/Contribuintes) por mês da série histórica. */
function _vgRenderizarGrafico(dados) {
    const container = document.getElementById('vgGraficoContainer');
    const canvas = document.getElementById('vgChartSerie');
    if (!container || !canvas || typeof Chart === 'undefined') return;
    container.style.display = 'block';

    const labels = dados.map(p => `${_VG_NOMES_MES[p.mes - 1].slice(0, 3)}/${String(p.ano).slice(-2)}`);
    const somaPorTipo = (p, tipo) => Object.values(p.porEmpresa).reduce((s, r) => s + (r.porTipo[tipo] || 0), 0);

    const datasets = [
        { label: 'Empregados', data: dados.map(p => somaPorTipo(p, 'Empregado')), backgroundColor: '#8B3A3A' },
        { label: 'Estagiários', data: dados.map(p => somaPorTipo(p, 'Estágiario')), backgroundColor: '#E67E22' },
        { label: 'Contribuintes', data: dados.map(p => somaPorTipo(p, 'Contribuinte')), backgroundColor: '#17A2B8' }
    ];

    if (_vgChartInstance) _vgChartInstance.destroy();
    _vgChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
                x: { stacked: true, ticks: { font: { size: 11 } } },
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

function _vgOcultarGrafico() {
    const container = document.getElementById('vgGraficoContainer');
    if (container) container.style.display = 'none';
    if (_vgChartInstance) { _vgChartInstance.destroy(); _vgChartInstance = null; }
}

function _vgRenderizarTabela(porEmpresa) {
    const tbody = document.getElementById('vgTableBody');
    const linhas = Object.entries(porEmpresa).sort((a, b) => a[1].nome.localeCompare(b[1].nome));

    if (linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;padding:20px;">Nenhuma empresa selecionada.</td></tr>';
        return;
    }

    let totalGeral = 0;
    const totalPorTipo = {};

    let html = linhas.map(([cod, r]) => {
        totalGeral += r.total;
        _VG_TIPOS.forEach(t => { totalPorTipo[t] = (totalPorTipo[t] || 0) + (r.porTipo[t] || 0); });

        const expandido = _vgLinhasExpandidas.has(cod);
        const situacoes = Object.entries(r.porSituacao).sort((a, b) => b[1].total - a[1].total);

        let linhaDetalhe = '';
        if (expandido) {
            const linhasSituacao = situacoes.map(([situacao, s]) => `
                <div class="vg-detalhe-grid vg-detalhe-row">
                    <span>${situacao}</span>
                    <span>${s.total}</span>
                    <span>${s.porTipo['Empregado'] || 0}</span>
                    <span>${s.porTipo['Estágiario'] || 0}</span>
                    <span>${s.porTipo['Contribuinte'] || 0}</span>
                </div>`).join('');
            linhaDetalhe = `<tr id="vgDetalhe-${cod}"><td colspan="6" style="padding:0;border:none;background:#FCFAF9;">
                <div style="padding:6px 16px 14px 46px;">
                    <div class="vg-detalhe-grid vg-detalhe-head">
                        <span>Situação</span><span>Total</span><span>Empregados</span><span>Estagiários</span><span>Contribuintes</span>
                    </div>
                    ${linhasSituacao || '<div class="vg-empty">Sem vínculos no período.</div>'}
                </div>
            </td></tr>`;
        }

        return `<tr class="vg-empresa-row${expandido ? ' expandida' : ''}" onclick="_vgToggleLinha('${cod}')">
            <td style="text-align:center;"><span class="vg-arrow${expandido ? ' expandido' : ''}">▶</span></td>
            <td><strong>${cod}</strong> — ${r.nome}</td>
            <td>${r.total}</td>
            <td>${r.porTipo['Empregado'] || 0}</td>
            <td>${r.porTipo['Estágiario'] || 0}</td>
            <td>${r.porTipo['Contribuinte'] || 0}</td>
        </tr>${linhaDetalhe}`;
    }).join('');

    html += `<tr style="font-weight:700;background:#F0F0F0;">
        <td></td>
        <td>Total Geral</td>
        <td>${totalGeral}</td>
        <td>${totalPorTipo['Empregado'] || 0}</td>
        <td>${totalPorTipo['Estágiario'] || 0}</td>
        <td>${totalPorTipo['Contribuinte'] || 0}</td>
    </tr>`;

    tbody.innerHTML = html;
}

function _vgToggleLinha(chave) {
    if (_vgLinhasExpandidas.has(chave)) _vgLinhasExpandidas.delete(chave);
    else _vgLinhasExpandidas.add(chave);
    atualizarVisaoGerencial();
}

/** Alterna, dentro do detalhamento de um mês da série histórica, o detalhamento por situação de uma empresa específica. */
function _vgToggleLinhaSerieEmpresa(chaveMes, cod) {
    const chave = `${chaveMes}|${cod}`;
    if (_vgLinhasExpandidas.has(chave)) _vgLinhasExpandidas.delete(chave);
    else _vgLinhasExpandidas.add(chave);
    atualizarVisaoGerencial();
}

/** Renderiza a série histórica: uma linha por mês/ano, expansível para o detalhamento por empresa daquele mês. */
function _vgRenderizarTabelaSerie(dados) {
    const tbody = document.getElementById('vgTableBody');

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;padding:20px;">Nenhum período no intervalo selecionado.</td></tr>';
        return;
    }

    const html = dados.map(p => {
        const registrosEmpresa = Object.entries(p.porEmpresa).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
        const total = registrosEmpresa.reduce((s, [, r]) => s + r.total, 0);
        const porTipo = {};
        _VG_TIPOS.forEach(t => { porTipo[t] = registrosEmpresa.reduce((s, [, r]) => s + (r.porTipo[t] || 0), 0); });

        const expandido = _vgLinhasExpandidas.has(p.chave);

        let linhaDetalhe = '';
        if (expandido) {
            const linhasEmpresa = registrosEmpresa.map(([cod, r]) => {
                const chaveEmpresa = `${p.chave}|${cod}`;
                const expandidoEmpresa = _vgLinhasExpandidas.has(chaveEmpresa);
                const situacoes = Object.entries(r.porSituacao).sort((a, b) => b[1].total - a[1].total);

                let detalheSituacao = '';
                if (expandidoEmpresa) {
                    const linhasSituacao = situacoes.map(([situacao, s]) => `
                        <div class="vg-detalhe-grid vg-detalhe-row">
                            <span>${situacao}</span>
                            <span>${s.total}</span>
                            <span>${s.porTipo['Empregado'] || 0}</span>
                            <span>${s.porTipo['Estágiario'] || 0}</span>
                            <span>${s.porTipo['Contribuinte'] || 0}</span>
                        </div>`).join('');
                    detalheSituacao = `<div class="vg-detalhe-sub">
                        <div class="vg-detalhe-grid vg-detalhe-head">
                            <span>Situação</span><span>Total</span><span>Empregados</span><span>Estagiários</span><span>Contribuintes</span>
                        </div>
                        ${linhasSituacao || '<div class="vg-empty">Sem vínculos no período.</div>'}
                    </div>`;
                }

                return `<div class="vg-detalhe-grid vg-detalhe-row vg-detalhe-row--clicavel" onclick="_vgToggleLinhaSerieEmpresa('${p.chave}','${cod}')">
                    <span><span class="vg-arrow-mini${expandidoEmpresa ? ' expandido' : ''}">▶</span><strong>${cod}</strong> — ${r.nome}</span>
                    <span>${r.total}</span>
                    <span>${r.porTipo['Empregado'] || 0}</span>
                    <span>${r.porTipo['Estágiario'] || 0}</span>
                    <span>${r.porTipo['Contribuinte'] || 0}</span>
                </div>${detalheSituacao}`;
            }).join('');
            linhaDetalhe = `<tr id="vgDetalheSerie-${p.chave}"><td colspan="6" style="padding:0;border:none;background:#FCFAF9;">
                <div style="padding:6px 16px 14px 46px;">
                    <div class="vg-detalhe-grid vg-detalhe-head">
                        <span>Empresa</span><span>Total</span><span>Empregados</span><span>Estagiários</span><span>Contribuintes</span>
                    </div>
                    ${linhasEmpresa || '<div class="vg-empty">Sem vínculos no período.</div>'}
                </div>
            </td></tr>`;
        }

        return `<tr class="vg-empresa-row${expandido ? ' expandida' : ''}" onclick="_vgToggleLinha('${p.chave}')">
            <td style="text-align:center;"><span class="vg-arrow${expandido ? ' expandido' : ''}">▶</span></td>
            <td><strong>${_VG_NOMES_MES[p.mes - 1]}/${p.ano}</strong></td>
            <td>${total}</td>
            <td>${porTipo['Empregado'] || 0}</td>
            <td>${porTipo['Estágiario'] || 0}</td>
            <td>${porTipo['Contribuinte'] || 0}</td>
        </tr>${linhaDetalhe}`;
    }).join('');

    tbody.innerHTML = html;
}

/** Exporta para Excel o recorte atual da Visão Gerencial (empresas/situações/período selecionados), com resumo + detalhamento por Situação. */
function exportarVisaoGerencialExcel() {
    const modo = document.querySelector('input[name="vgModo"]:checked')?.value || 'unico';
    const empresasConsideradas = [..._vgEmpresasSelecionadas];
    if (empresasConsideradas.length === 0) { alert('Nenhuma empresa selecionada.'); return; }

    const situacoesOrdenadas = r => Object.entries(r.porSituacao).sort((a, b) => b[1].total - a[1].total);
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

    let headers, rows = [], nomeArquivo;

    if (modo === 'unico') {
        const mes = parseInt(document.getElementById('vgMes')?.value, 10);
        const ano = parseInt(document.getElementById('vgAno')?.value, 10);
        if (!mes || !ano) { alert('Informe mês e ano.'); return; }

        headers = ['Empresa', 'Situação', 'Total', 'Empregados', 'Estagiários', 'Contribuintes'];
        const porEmpresa = _vgCalcularContagem(mes, ano, empresasConsideradas);
        const linhasEmpresa = Object.entries(porEmpresa).sort((a, b) => a[1].nome.localeCompare(b[1].nome));

        let totalGeral = 0;
        const totalPorTipo = {};
        linhasEmpresa.forEach(([cod, r]) => {
            totalGeral += r.total;
            _VG_TIPOS.forEach(t => { totalPorTipo[t] = (totalPorTipo[t] || 0) + (r.porTipo[t] || 0); });
            const empresaLabel = `${cod} — ${r.nome}`;
            rows.push([empresaLabel, '', r.total, r.porTipo['Empregado'] || 0, r.porTipo['Estágiario'] || 0, r.porTipo['Contribuinte'] || 0]);
            situacoesOrdenadas(r).forEach(([situacao, s]) => {
                rows.push([empresaLabel, situacao, s.total, s.porTipo['Empregado'] || 0, s.porTipo['Estágiario'] || 0, s.porTipo['Contribuinte'] || 0]);
            });
        });
        rows.push(['Total Geral', '', totalGeral, totalPorTipo['Empregado'] || 0, totalPorTipo['Estágiario'] || 0, totalPorTipo['Contribuinte'] || 0]);

        nomeArquivo = `visao_gerencial_empregados_${hoje}.xlsx`;
    } else {
        const mesDe = parseInt(document.getElementById('vgMesDe')?.value, 10);
        const anoDe = parseInt(document.getElementById('vgAnoDe')?.value, 10);
        const mesAte = parseInt(document.getElementById('vgMesAte')?.value, 10);
        const anoAte = parseInt(document.getElementById('vgAnoAte')?.value, 10);
        if (!mesDe || !anoDe || !mesAte || !anoAte) { alert('Informe o período (De/Até).'); return; }

        let chaveInicio = anoDe * 12 + (mesDe - 1);
        let chaveFim = anoAte * 12 + (mesAte - 1);
        if (chaveInicio > chaveFim) { const tmp = chaveInicio; chaveInicio = chaveFim; chaveFim = tmp; }

        const periodos = [];
        for (let c = chaveInicio; c <= chaveFim; c++) periodos.push({ ano: Math.floor(c / 12), mes: (c % 12) + 1 });

        headers = ['Mês/Ano', 'Empresa', 'Situação', 'Total', 'Empregados', 'Estagiários', 'Contribuintes'];

        periodos.forEach(p => {
            const porEmpresa = _vgCalcularContagem(p.mes, p.ano, empresasConsideradas);
            const linhasEmpresa = Object.entries(porEmpresa).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
            const mesAno = `${_VG_NOMES_MES[p.mes - 1]}/${p.ano}`;

            let totalMes = 0;
            const totalPorTipoMes = {};
            linhasEmpresa.forEach(([, r]) => {
                totalMes += r.total;
                _VG_TIPOS.forEach(t => { totalPorTipoMes[t] = (totalPorTipoMes[t] || 0) + (r.porTipo[t] || 0); });
            });
            rows.push([mesAno, '', '', totalMes, totalPorTipoMes['Empregado'] || 0, totalPorTipoMes['Estágiario'] || 0, totalPorTipoMes['Contribuinte'] || 0]);

            linhasEmpresa.forEach(([cod, r]) => {
                const empresaLabel = `${cod} — ${r.nome}`;
                rows.push([mesAno, empresaLabel, '', r.total, r.porTipo['Empregado'] || 0, r.porTipo['Estágiario'] || 0, r.porTipo['Contribuinte'] || 0]);
                situacoesOrdenadas(r).forEach(([situacao, s]) => {
                    rows.push([mesAno, empresaLabel, situacao, s.total, s.porTipo['Empregado'] || 0, s.porTipo['Estágiario'] || 0, s.porTipo['Contribuinte'] || 0]);
                });
            });
        });

        nomeArquivo = `visao_gerencial_empregados_serie_${hoje}.xlsx`;
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visão Gerencial');
    XLSX.writeFile(wb, nomeArquivo);
}

// --- FÉRIAS (INFORMAÇÕES) ---

let _todasFeriasInfo = [];
let _feriasInfoFiltradas = [];
let _paginaFeriasInfo = 1;
const _porPaginaFeriasInfo = 50;

async function carregarFeriasInfo() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_ferias_calculadas')
            .select('*')
            .order('codigo_empresa', { ascending: true })
            .order('ferias_inicio', { ascending: false });
        if (error) throw error;
        _todasFeriasInfo = _filtrarPorEscopo(data);
        _feriasInfoFiltradas = [..._todasFeriasInfo];
        _paginaFeriasInfo = 1;
        renderizarTabelaFeriasInfo();
    } catch (erro) { mostrarStatus('statusFeriasInfo', 'Erro ao carregar informações de férias.', 'error'); }
}

function filtrarFeriasInfo() {
    const texto = (document.getElementById('filtroFeriasTexto')?.value || '').toLowerCase().trim();
    _feriasInfoFiltradas = _todasFeriasInfo.filter(f => {
        if (!texto) return true;
        return (
            (f.codigo_empresa || '').toLowerCase().includes(texto) ||
            (f.nome_empresa || '').toLowerCase().includes(texto) ||
            (f.codigo_empregado || '').toLowerCase().includes(texto) ||
            (f.nome_empregado || '').toLowerCase().includes(texto)
        );
    });
    _paginaFeriasInfo = 1;
    renderizarTabelaFeriasInfo();
}

function renderizarTabelaFeriasInfo() {
    const tbody = document.getElementById('feriasInfoTableBody');
    const paginacao = document.getElementById('paginacaoFeriasInfo');
    const info = document.getElementById('infoFeriasInfo');
    tbody.innerHTML = '';

    if (_feriasInfoFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#95A5A6;padding:20px;">Nenhum período de férias encontrado</td></tr>';
        paginacao.innerHTML = '';
        if (info) info.textContent = '';
        return;
    }

    const totalPags = Math.ceil(_feriasInfoFiltradas.length / _porPaginaFeriasInfo);
    const inicio    = (_paginaFeriasInfo - 1) * _porPaginaFeriasInfo;
    const pagina    = _feriasInfoFiltradas.slice(inicio, inicio + _porPaginaFeriasInfo);

    if (info) info.textContent = _feriasInfoFiltradas.length < _todasFeriasInfo.length
        ? `${_feriasInfoFiltradas.length} de ${_todasFeriasInfo.length} período(s)`
        : `${_todasFeriasInfo.length} período(s)`;

    const fmtData = v => {
        if (!v) return '<span style="color:#C0C0C0;">—</span>';
        const d = new Date(v + 'T00:00:00');
        return isNaN(d) ? v : d.toLocaleDateString('pt-BR');
    };

    pagina.forEach(f => {
        tbody.innerHTML += `<tr>
            <td><strong>${f.codigo_empresa}</strong></td>
            <td>${f.nome_empresa || ''}</td>
            <td>${f.codigo_empregado}</td>
            <td>${f.nome_empregado || ''}</td>
            <td>${fmtData(f.aquisitivo_inicio)}</td>
            <td>${fmtData(f.aquisitivo_fim)}</td>
            <td>${fmtData(f.ferias_inicio)}</td>
            <td>${fmtData(f.ferias_fim)}</td>
        </tr>`;
    });

    paginacao.innerHTML = totalPags <= 1 ? '' : `
        <button onclick="mudarPaginaFeriasInfo(${_paginaFeriasInfo - 1})" ${_paginaFeriasInfo === 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="pag-info">Página <strong>${_paginaFeriasInfo}</strong> de <strong>${totalPags}</strong> — ${_feriasInfoFiltradas.length} período(s)</span>
        <button onclick="mudarPaginaFeriasInfo(${_paginaFeriasInfo + 1})" ${_paginaFeriasInfo === totalPags ? 'disabled' : ''}>Próxima ›</button>
    `;
}

function mudarPaginaFeriasInfo(pag) {
    const totalPags = Math.ceil(_feriasInfoFiltradas.length / _porPaginaFeriasInfo);
    if (pag < 1 || pag > totalPags) return;
    _paginaFeriasInfo = pag;
    renderizarTabelaFeriasInfo();
    document.getElementById('ferias')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- SÓCIOS ---

let _todosSocios = [];
let _sociosFiltrados = [];
const _porPaginaSocios = 50;
let _pagSocios = 1;

async function carregarSocios() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_socios')
            .select('*')
            .order('nome_socio', { ascending: true });
        if (error) throw error;
        _todosSocios = _filtrarPorEscopo(data);

        // Popula selects de empresa nos filtros e formulário
        const empresas = [...new Set(_todosSocios.map(s => s.codigo_empresa))].sort();
        const filtroSelect = document.getElementById('filtroSociosEmpresa');
        const formSelect   = document.getElementById('socioEmpresa');
        if (filtroSelect) {
            filtroSelect.innerHTML = '<option value="">Todas</option>' +
                empresas.map(cod => {
                    const emp = _todasEmpresas.find(e => e.codigo_empresa === cod);
                    const label = emp ? `${emp.nome_empresa} (${cod})` : cod;
                    return `<option value="${cod}">${label}</option>`;
                }).join('');
        }
        if (formSelect) {
            const emps = _todasEmpresas.length ? _todasEmpresas : _filtrarPorEscopo((await supabaseClient.from('rh_empresas').select('codigo_empresa,nome_empresa').order('nome_empresa')).data || []);
            formSelect.innerHTML = '<option value="">Selecione a empresa…</option>' +
                emps.map(e => `<option value="${e.codigo_empresa}">${e.nome_empresa} (${e.codigo_empresa})</option>`).join('');
        }

        filtrarSocios();
    } catch (err) {
        mostrarStatus('statusSocios', 'Erro ao carregar sócios: ' + err.message, 'error');
    }
}

function filtrarSocios() {
    const texto    = (document.getElementById('filtroSociosTexto')?.value || '').toLowerCase();
    const empresa  = document.getElementById('filtroSociosEmpresa')?.value || '';
    const situacao = document.getElementById('filtroSociosSituacaoEmp')?.value || '';
    _sociosFiltrados = _todosSocios.filter(s => {
        const matchTexto = !texto || s.nome_socio?.toLowerCase().includes(texto) || s.codigo_empresa?.toLowerCase().includes(texto) || s.cpf?.includes(texto);
        const matchEmp   = !empresa || s.codigo_empresa === empresa;
        if (!matchTexto || !matchEmp) return false;
        if (situacao) {
            const emp = _todasEmpresas.find(e => e.codigo_empresa === s.codigo_empresa);
            const sit = emp?.status_situacao || '';
            if (situacao === 'Ativo'   && !sit.toLowerCase().includes('ativ'))   return false;
            if (situacao === 'Inativo' && !sit.toLowerCase().includes('inativ')) return false;
        }
        return true;
    });
    _pagSocios = 1;
    renderSocios();
}

function renderSocios() {
    const tbody = document.getElementById('sociosTableBody');
    const info  = document.getElementById('infoSocios');
    const total = _sociosFiltrados.length;
    const inicio = (_pagSocios - 1) * _porPaginaSocios;
    const pagina = _sociosFiltrados.slice(inicio, inicio + _porPaginaSocios);

    if (info) info.textContent = `${total} sócio(s)`;

    if (!pagina.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#95A5A6;padding:24px">Nenhum sócio encontrado</td></tr>';
        document.getElementById('paginacaoSocios').innerHTML = '';
        return;
    }

    const fmtData = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    tbody.innerHTML = pagina.map(s => {
        const emp = _todasEmpresas.find(e => e.codigo_empresa === s.codigo_empresa);
        const nomeEmp = emp ? esc(emp.nome_empresa) : '—';
        const cnpj    = emp?.cnpj ? esc(emp.cnpj) : '—';
        const sit     = emp?.status_situacao || '—';
        const sitCor  = sit.toLowerCase().includes('ativ') && !sit.toLowerCase().includes('inativ') ? '#27AE60' : '#E74C3C';
        return `
        <tr>
            <td><strong>${esc(s.codigo_empresa)}</strong><br><span style="font-size:11px;color:#555">${nomeEmp}</span></td>
            <td style="font-size:12px">${cnpj}</td>
            <td><span style="color:${sitCor};font-weight:600;font-size:12px">${esc(sit)}</span></td>
            <td><strong>${esc(s.nome_socio)}</strong></td>
            <td style="font-size:12px">${esc(s.cpf) || '—'}</td>
            <td>${s.participacao != null ? s.participacao + '%' : '—'}</td>
            <td>${esc(s.cargo) || '—'}</td>
            <td style="font-size:12px">${fmtData(s.data_entrada)}</td>
            <td style="font-size:12px">${fmtData(s.data_saida)}</td>
            <td style="font-size:12px">${esc(s.email_socio) || '—'}</td>
        </tr>`;
    }).join('');

    renderPaginacaoSocios(total);
}

function renderPaginacaoSocios(total) {
    const pag = document.getElementById('paginacaoSocios');
    const totalPags = Math.ceil(total / _porPaginaSocios);
    if (totalPags <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `
        <button onclick="_pagSocios=Math.max(1,_pagSocios-1);renderSocios()" ${_pagSocios===1?'disabled':''}>‹ Anterior</button>
        <span class="pag-info">Página ${_pagSocios} de ${totalPags}</span>
        <button onclick="_pagSocios=Math.min(${totalPags},_pagSocios+1);renderSocios()" ${_pagSocios===totalPags?'disabled':''}>Próxima ›</button>
    `;
}

// --- ANÁLISE DO QSA × rh_empregados ---
//
// Verifica, para cada sócio cadastrado (rh_socios), se a mesma pessoa
// esteve registrada como empregado (rh_empregados) num período que se
// sobrepõe ao período em que foi sócio. Match principal por CPF; quando
// o sócio não tem CPF, tenta por nome normalizado (menor confiança).
// A análise usa _todosSocios e _todosEmpregados já carregados em memória
// (paginados e respeitando o escopo do usuário).

let _resultadoQSA = [];

function _soDigitos(v) { return String(v ?? '').replace(/\D/g, ''); }

function _normalizarNome(v) {
    return String(v ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Sobreposição de dois intervalos, tratando datas ausentes como
 * limite aberto (−∞ para início, +∞ para fim). Retorna true se há
 * qualquer dia em comum.
 */
function _periodosSobrepoem(ini1, fim1, ini2, fim2) {
    const MIN = -8.64e15, MAX = 8.64e15;
    const t = (d, fallback) => {
        if (!d) return fallback;
        const ms = new Date(d + 'T00:00:00').getTime();
        return isNaN(ms) ? fallback : ms;
    };
    const a1 = t(ini1, MIN), b1 = t(fim1, MAX);
    const a2 = t(ini2, MIN), b2 = t(fim2, MAX);
    return a1 <= b2 && a2 <= b1;
}

function analisarQSA() {
    const painel = document.getElementById('painelQSA');
    const conteudo = document.getElementById('conteudoQSA');
    const resumo = document.getElementById('resumoQSA');
    painel.style.display = '';

    if (!_todosSocios.length) {
        _resultadoQSA = [];
        resumo.textContent = '';
        conteudo.innerHTML = '<p style="color:#95A5A6;margin:0">Nenhum sócio cadastrado para analisar.</p>';
        document.getElementById('btnExportarQSA').style.display = 'none';
        return;
    }
    if (!_todosEmpregados.length) {
        _resultadoQSA = [];
        resumo.textContent = '';
        conteudo.innerHTML = '<p style="color:#95A5A6;margin:0">Cadastro de empregados ainda carregando. Aguarde alguns segundos e tente novamente.</p>';
        document.getElementById('btnExportarQSA').style.display = 'none';
        return;
    }

    // Índices de empregados por CPF e por nome normalizado.
    // Só entram vínculos com tipo_empregado = "Empregado" (a sobreposição
    // considera admissão × demissão desse tipo de vínculo).
    const porCpf = new Map();
    const porNome = new Map();
    for (const e of _todosEmpregados) {
        if ((e.tipo_empregado || '').trim() !== 'Empregado') continue;
        const cpf = _soDigitos(e.cpf);
        if (cpf.length === 11) {
            if (!porCpf.has(cpf)) porCpf.set(cpf, []);
            porCpf.get(cpf).push(e);
        }
        const nome = _normalizarNome(e.nome_empregado);
        if (nome) {
            if (!porNome.has(nome)) porNome.set(nome, []);
            porNome.get(nome).push(e);
        }
    }

    const empNome = cod => {
        const emp = _todasEmpresas.find(x => x.codigo_empresa === cod);
        return emp ? emp.nome_empresa : '';
    };

    const ocorrencias = [];
    for (const s of _todosSocios) {
        const cpfSocio = _soDigitos(s.cpf);
        let candidatos, tipoMatch;
        if (cpfSocio.length === 11) {
            candidatos = porCpf.get(cpfSocio) || [];
            tipoMatch = 'CPF';
        } else {
            const nomeSocio = _normalizarNome(s.nome_socio);
            candidatos = nomeSocio ? (porNome.get(nomeSocio) || []) : [];
            tipoMatch = 'Nome (possível)';
        }

        for (const e of candidatos) {
            // Só interessa quando sócio e empregado são da MESMA empresa
            if ((e.codigo_empresa || '') !== (s.codigo_empresa || '')) continue;
            if (!_periodosSobrepoem(s.data_entrada, s.data_saida, e.data_admissao, e.data_demissao)) continue;
            const obs = [];
            if (!s.data_entrada && !s.data_saida) obs.push('período do sócio indefinido');
            else if (!s.data_entrada || !s.data_saida) obs.push('período do sócio parcialmente indefinido');
            ocorrencias.push({
                nome_socio:      s.nome_socio || '',
                cpf:             s.cpf || '',
                empresa:         s.codigo_empresa || '',
                empresa_nome:    empNome(s.codigo_empresa),
                socio_entrada:   s.data_entrada || null,
                socio_saida:     s.data_saida || null,
                codigo_empregado: e.codigo_empregado || '',
                nome_empregado:  e.nome_empregado || '',
                vinculo_admissao: e.data_admissao || null,
                vinculo_demissao: e.data_demissao || null,
                tipo_match:      tipoMatch,
                observacao:      obs.join('; ')
            });
        }
    }

    ocorrencias.sort((a, b) =>
        (a.nome_socio || '').localeCompare(b.nome_socio || '', 'pt-BR') ||
        (a.empresa || '').localeCompare(b.empresa || ''));
    _resultadoQSA = ocorrencias;

    renderResultadoQSA();
}

function renderResultadoQSA() {
    const conteudo = document.getElementById('conteudoQSA');
    const resumo = document.getElementById('resumoQSA');
    const btnExp = document.getElementById('btnExportarQSA');

    const nSocios = _todosSocios.length;
    resumo.textContent = `${nSocios} sócio(s) analisado(s) · ${_resultadoQSA.length} ocorrência(s) de sobreposição`;

    if (!_resultadoQSA.length) {
        btnExp.style.display = 'none';
        conteudo.innerHTML = '<p style="color:#1E7E34;font-weight:600;margin:0">✅ Nenhum sócio esteve cadastrado como empregado (tipo "Empregado") da mesma empresa em período sobreposto.</p>';
        return;
    }
    btnExp.style.display = '';

    const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const per = (i, f) => `${fmt(i)} → ${fmt(f)}`;

    const linhas = _resultadoQSA.map(o => {
        const possivel = o.tipo_match !== 'CPF';
        return `
        <tr${possivel ? ' style="background:#FFF8E1"' : ''}>
            <td><strong>${esc(o.nome_socio)}</strong></td>
            <td style="font-size:12px">${esc(o.cpf) || '—'}</td>
            <td style="font-size:12px">${esc(o.empresa)}<br><span style="font-size:11px;color:#555">${esc(o.empresa_nome)}</span></td>
            <td style="font-size:12px">${per(o.socio_entrada, o.socio_saida)}</td>
            <td style="font-size:12px">${esc(o.codigo_empregado) || '—'}</td>
            <td style="font-size:12px">${per(o.vinculo_admissao, o.vinculo_demissao)}</td>
            <td style="font-size:12px">${esc(o.tipo_match)}</td>
            <td style="font-size:12px;color:#7F8C8D">${esc(o.observacao) || '—'}</td>
        </tr>`;
    }).join('');

    conteudo.innerHTML = `
    <div class="table-container">
        <table class="admin-table">
            <thead><tr>
                <th>Sócio</th><th>CPF</th><th>Empresa</th><th>Período como sócio</th>
                <th>Cód. Empregado</th><th>Período do vínculo</th>
                <th>Match</th><th>Observação</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
        </table>
    </div>
    <p style="font-size:11px;color:#95A5A6;margin:8px 0 0">Considera apenas vínculos com tipo "Empregado", pela sobreposição entre admissão→demissão e o período como sócio, na mesma empresa. Linhas em amarelo: match por nome (sócio sem CPF cadastrado) — confirmar manualmente.</p>`;
}

function exportarQSAExcel() {
    if (!_resultadoQSA.length) { mostrarStatus('statusSocios', 'Nada para exportar.', 'error'); return; }
    const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';
    const aoa = [[
        'SÓCIO', 'CPF', 'CÓD. EMPRESA', 'EMPRESA', 'INGRESSO SÓCIO', 'SAÍDA SÓCIO',
        'CÓD. EMPREGADO', 'NOME NO CADASTRO DE EMPREGADO',
        'ADMISSÃO', 'DEMISSÃO', 'TIPO DE MATCH', 'OBSERVAÇÃO'
    ]];
    for (const o of _resultadoQSA) {
        aoa.push([
            o.nome_socio, o.cpf, o.empresa, o.empresa_nome, fmt(o.socio_entrada), fmt(o.socio_saida),
            o.codigo_empregado, o.nome_empregado,
            fmt(o.vinculo_admissao), fmt(o.vinculo_demissao), o.tipo_match, o.observacao
        ]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [32, 16, 12, 28, 14, 14, 14, 32, 12, 12, 16, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Analise QSA');
    const hoje = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `analise_qsa_${hoje}.xlsx`);
}

async function salvarSocio() {
    const id      = document.getElementById('socioEditId').value;
    const empresa = document.getElementById('socioEmpresa').value.trim();
    const nome    = document.getElementById('socioNome').value.trim();
    if (!empresa || !nome) { mostrarStatus('statusSocios', 'Empresa e nome são obrigatórios.', 'error'); return; }

    const payload = {
        codigo_empresa: empresa,
        nome_socio:     nome,
        cpf:            document.getElementById('socioCpf').value.trim() || null,
        participacao:   parseFloat(document.getElementById('socioParticipacao').value) || null,
        cargo:          document.getElementById('socioCargo').value.trim() || null,
        email_socio:    document.getElementById('socioEmailSocio').value.trim() || null,
        data_entrada:   document.getElementById('socioDataEntrada').value || null,
        data_saida:     document.getElementById('socioDataSaida').value || null,
    };

    try {
        let error;
        if (id) {
            ({ error } = await supabaseClient.from('rh_socios').update(payload).eq('id', id));
        } else {
            ({ error } = await supabaseClient.from('rh_socios').insert(payload));
        }
        if (error) throw error;
        mostrarStatus('statusSocios', id ? '✅ Sócio atualizado!' : '✅ Sócio adicionado!', 'success');
        cancelarEdicaoSocio();
        await carregarSocios();
    } catch (err) {
        mostrarStatus('statusSocios', 'Erro: ' + err.message, 'error');
    }
}

function editarSocio(id) {
    const s = _todosSocios.find(x => x.id === id);
    if (!s) return;
    document.getElementById('socioEditId').value       = s.id;
    document.getElementById('socioEmpresa').value      = s.codigo_empresa;
    document.getElementById('socioNome').value         = s.nome_socio;
    document.getElementById('socioCpf').value          = s.cpf || '';
    document.getElementById('socioParticipacao').value = s.participacao ?? '';
    document.getElementById('socioCargo').value        = s.cargo || '';
    document.getElementById('socioEmailSocio').value   = s.email_socio || '';
    document.getElementById('socioDataEntrada').value  = s.data_entrada || '';
    document.getElementById('socioDataSaida').value    = s.data_saida || '';
    document.getElementById('socioFormTitulo').textContent = 'Editar Sócio';
    document.getElementById('sociosBtnCancelar').style.display = '';
    document.getElementById('socios').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoSocio() {
    document.getElementById('socioEditId').value       = '';
    document.getElementById('socioEmpresa').value      = '';
    document.getElementById('socioNome').value         = '';
    document.getElementById('socioCpf').value          = '';
    document.getElementById('socioParticipacao').value = '';
    document.getElementById('socioCargo').value        = '';
    document.getElementById('socioEmailSocio').value   = '';
    document.getElementById('socioDataEntrada').value  = '';
    document.getElementById('socioDataSaida').value    = '';
    document.getElementById('socioFormTitulo').textContent = 'Adicionar Sócio';
    document.getElementById('sociosBtnCancelar').style.display = 'none';
}

async function deletarSocio(id) {
    if (!confirm('Excluir este sócio?')) return;
    try {
        const { error } = await supabaseClient.from('rh_socios').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusSocios', '✅ Sócio excluído.', 'success');
        await carregarSocios();
    } catch (err) {
        mostrarStatus('statusSocios', 'Erro: ' + err.message, 'error');
    }
}

// --- RUBRICAS ---

const RUBRICAS_POR_PAG = 100;
let _paginaRubricas = 1;
let _totalRubricas = 0;
let _filtroRubricasEmpresa = '';
let _filtroRubricasTexto = '';
let _filtroRubricasTipo = '';

async function carregarRubricas() {
    await Promise.all([carregarFiltroEmpresasRubricas(), carregarFiltroTiposRubricas(), buscarRubricas()]);
}

async function carregarFiltroEmpresasRubricas() {
    const sel = document.getElementById('filtroRubricasEmpresa');
    if (!sel || sel.options.length > 1) return;
    try {
        const { data } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('codigo_empresa', { ascending: true });
        _filtrarPorEscopo(data).forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.codigo_empresa;
            opt.textContent = `${e.codigo_empresa} – ${e.nome_empresa || e.codigo_empresa}`;
            sel.appendChild(opt);
        });
    } catch (_) {}
}

async function carregarFiltroTiposRubricas() {
    const sel = document.getElementById('filtroRubricasTipo');
    if (!sel || sel.options.length > 1) return;
    try {
        const { data } = await supabaseClient
            .from('rh_rubricas')
            .select('tipo')
            .not('tipo', 'is', null)
            .not('tipo', 'eq', '');
        const tipos = [...new Set((data || []).map(r => r.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        tipos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            sel.appendChild(opt);
        });
    } catch (_) {}
}

async function buscarRubricas() {
    const tbody = document.getElementById('rubricasTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;">Carregando...</td></tr>';

    if (_empresasPermitidas && !_empresasPermitidas.size) {
        _totalRubricas = 0;
        document.getElementById('infoRubricas').textContent = '0 rubrica(s)';
        renderizarTabelaRubricas([]);
        renderizarPaginacaoRubricas();
        return;
    }

    const ini = (_paginaRubricas - 1) * RUBRICAS_POR_PAG;
    const fim = ini + RUBRICAS_POR_PAG - 1;

    try {
        let q = supabaseClient
            .from('rh_rubricas')
            .select('*', { count: 'exact' })
            .order('codigo_empresa', { ascending: true })
            .order('codigo_rubrica', { ascending: true })
            .range(ini, fim);

        if (_filtroRubricasEmpresa) q = q.eq('codigo_empresa', _filtroRubricasEmpresa);
        if (_filtroRubricasTexto)   q = q.or(`codigo_rubrica.ilike.%${_filtroRubricasTexto}%,descricao_rubrica.ilike.%${_filtroRubricasTexto}%,empresa.ilike.%${_filtroRubricasTexto}%`);
        if (_filtroRubricasTipo)    q = q.eq('tipo', _filtroRubricasTipo);
        q = _aplicarEscopoQuery(q);

        const { data, error, count } = await q;
        if (error) throw error;

        _totalRubricas = count || 0;
        document.getElementById('infoRubricas').textContent = _totalRubricas.toLocaleString('pt-BR') + ' rubrica(s)';
        renderizarTabelaRubricas(data || []);
        renderizarPaginacaoRubricas();
    } catch (erro) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#E74C3C;">Erro: ' + erro.message + '</td></tr>';
    }
}

function filtrarRubricas() {
    _filtroRubricasEmpresa = document.getElementById('filtroRubricasEmpresa')?.value || '';
    _filtroRubricasTexto   = (document.getElementById('filtroRubricasTexto')?.value || '').trim();
    _filtroRubricasTipo    = document.getElementById('filtroRubricasTipo')?.value || '';
    _paginaRubricas = 1;
    buscarRubricas();
}

async function exportarRubricasExcel() {
    if (_empresasPermitidas && !_empresasPermitidas.size) {
        mostrarStatus('statusRubricas', 'Nenhuma rubrica para exportar com os filtros atuais.', 'error');
        return;
    }
    try {
        let q = supabaseClient
            .from('rh_rubricas')
            .select('*')
            .order('codigo_empresa', { ascending: true })
            .order('codigo_rubrica', { ascending: true });

        if (_filtroRubricasEmpresa) q = q.eq('codigo_empresa', _filtroRubricasEmpresa);
        if (_filtroRubricasTexto)   q = q.or(`codigo_rubrica.ilike.%${_filtroRubricasTexto}%,descricao_rubrica.ilike.%${_filtroRubricasTexto}%,empresa.ilike.%${_filtroRubricasTexto}%`);
        if (_filtroRubricasTipo)    q = q.eq('tipo', _filtroRubricasTipo);
        q = _aplicarEscopoQuery(q);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || !data.length) { mostrarStatus('statusRubricas', 'Nenhuma rubrica para exportar com os filtros atuais.', 'error'); return; }

        const headers = ['Cód. Empresa', 'Empresa', 'Cód. Rubrica', 'Descrição Rubrica', 'Tipo'];
        const rows = data.map(r => [
            r.codigo_empresa,
            r.empresa || '',
            r.codigo_rubrica,
            r.descricao_rubrica || '',
            r.tipo || '',
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = headers.map(() => ({ wch: 22 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rubricas');
        const hoje = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `rubricas_export_${hoje}.xlsx`);
    } catch (erro) {
        mostrarStatus('statusRubricas', 'Erro ao exportar: ' + erro.message, 'error');
    }
}

function renderizarPaginacaoRubricas() {
    const div = document.getElementById('paginacaoRubricas');
    if (!div) return;
    const totalPags = Math.max(1, Math.ceil(_totalRubricas / RUBRICAS_POR_PAG));
    div.innerHTML = '';
    if (totalPags <= 1) return;
    const btn = (txt, pg, dis) => {
        const b = document.createElement('button');
        b.textContent = txt; b.disabled = dis;
        b.onclick = () => { _paginaRubricas = pg; buscarRubricas(); };
        return b;
    };
    div.appendChild(btn('«', 1, _paginaRubricas === 1));
    div.appendChild(btn('‹', _paginaRubricas - 1, _paginaRubricas === 1));
    const info = document.createElement('span');
    info.className = 'pag-info';
    info.textContent = `Página ${_paginaRubricas} de ${totalPags}`;
    div.appendChild(info);
    div.appendChild(btn('›', _paginaRubricas + 1, _paginaRubricas === totalPags));
    div.appendChild(btn('»', totalPags, _paginaRubricas === totalPags));
}

function renderizarTabelaRubricas(rubricas, total) {
    const tbody = document.getElementById('rubricasTableBody');
    tbody.innerHTML = '';
    if (!rubricas.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95A5A6;">Nenhuma rubrica encontrada</td></tr>';
        return;
    }
    rubricas.forEach(r => {
        const desc = r.descricao_rubrica || r.evento || '–';
        tbody.innerHTML += `<tr>
            <td><strong>${r.codigo_empresa}</strong></td>
            <td>${r.empresa || '–'}</td>
            <td style="font-family:monospace;">${r.codigo_rubrica}</td>
            <td>${desc}</td>
            <td>${r.tipo || '–'}</td>
            <td><button type="button" class="btn-delete" onclick="deletarRubrica('${r.id}')">Deletar</button></td>
        </tr>`;
    });
}

async function adicionarRubrica() {
    const codigoEmpresa  = document.getElementById('rubricaEmpresaSelect').value;
    const codigoRubrica  = document.getElementById('codigoRubrica').value.trim();
    const descricao      = document.getElementById('descricaoRubrica').value.trim();

    if (!codigoEmpresa || !codigoRubrica || !descricao) {
        mostrarStatus('statusRubricas', 'Preencha Empresa, Código e Descrição', 'error'); return;
    }

    // Buscar nome da empresa
    const empresaObj = _todasEmpresas.find(e => String(e.codigo_empresa) === String(codigoEmpresa));

    const row = {
        codigo_empresa:    codigoEmpresa,
        empresa:           empresaObj ? empresaObj.nome_empresa : '',
        codigo_rubrica:    codigoRubrica,
        descricao_rubrica: descricao,
        tipo:              document.getElementById('tipoRubrica').value.trim() || null,
    };

    try {
        const { error } = await supabaseClient
            .from('rh_rubricas')
            .upsert([row], { onConflict: 'codigo_empresa,codigo_rubrica' });
        if (error) throw error;
        ['codigoRubrica','descricaoRubrica','tipoRubrica'].forEach(id => document.getElementById(id).value = '');
        mostrarStatus('statusRubricas', '✅ Rubrica salva com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao salvar: ' + erro.message, 'error'); }
}

async function deletarRubrica(id) {
    if (!confirm('Tem certeza que deseja deletar esta rubrica?')) return;
    try {
        const { error } = await supabaseClient.from('rh_rubricas').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRubricas', '✅ Rubrica deletada com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao deletar: ' + erro.message, 'error'); }
}

// --- REGRAS DE RENOMEAÇÃO ---

let _todasRegras = [];
let _regraEditandoId = null;

async function carregarRegras() {
    try {
        const { data, error } = await supabaseClient.from('rh_regras_renomeacao').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        _todasRegras = data || [];
        renderizarTabelaRegras(_todasRegras);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar regras de renomeação.'); }
}

function renderizarTabelaRegras(regras) {
    const tbody = document.getElementById('regrasTableBody');
    tbody.innerHTML = '';
    if (regras.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #95A5A6;">Nenhuma regra cadastrada</td></tr>'; return; }
    regras.forEach(regra => {
        tbody.innerHTML += `<tr>
            <td style="font-family: monospace; font-size: 12px;">${regra.padrao_de}</td>
            <td style="font-family: monospace; font-size: 12px; color: #8B3A3A;">${regra.padrao_para}</td>
            <td style="display:flex;gap:6px;">
                <button type="button" class="btn-edit" onclick="editarRegra('${regra.id}')">Editar</button>
                <button type="button" class="btn-delete" onclick="deletarRegra('${regra.id}')">Deletar</button>
            </td>
        </tr>`;
    });
}

function editarRegra(id) {
    const regra = _todasRegras.find(r => String(r.id) === String(id));
    if (!regra) return;
    _regraEditandoId = id;
    document.getElementById('padraoDe').value = regra.padrao_de;
    document.getElementById('padraoPara').value = regra.padrao_para;
    document.getElementById('btnSalvarRegra').textContent = '💾 Atualizar Padrão';
    document.getElementById('btnCancelarRegra').style.display = '';
    document.getElementById('regrasRenomeacao').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelarEdicaoRegra() {
    _regraEditandoId = null;
    document.getElementById('padraoDe').value = '';
    document.getElementById('padraoPara').value = '';
    document.getElementById('btnSalvarRegra').textContent = '➕ Salvar Padrão';
    document.getElementById('btnCancelarRegra').style.display = 'none';
}

async function adicionarRegra() {
    const padraoDe = document.getElementById('padraoDe').value.trim();
    const padraoPara = document.getElementById('padraoPara').value.trim();

    if (!padraoDe || !padraoPara) { mostrarStatus('statusRegras', 'Preencha ambos os padrões.', 'error'); return; }

    try {
        if (_regraEditandoId) {
            const { error } = await supabaseClient.from('rh_regras_renomeacao').update({ padrao_de: padraoDe, padrao_para: padraoPara }).eq('id', _regraEditandoId);
            if (error) throw error;
            mostrarStatus('statusRegras', '✅ Regra atualizada com sucesso!', 'success');
            cancelarEdicaoRegra();
        } else {
            const { error } = await supabaseClient.from('rh_regras_renomeacao').insert([{ padrao_de: padraoDe, padrao_para: padraoPara }]);
            if (error) throw error;
            document.getElementById('padraoDe').value = '';
            document.getElementById('padraoPara').value = '';
            mostrarStatus('statusRegras', '✅ Regra salva com sucesso!', 'success');
        }
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar regra: ' + erro.message, 'error'); }
}

async function deletarRegra(id) {
    if (!confirm('Tem certeza que deseja deletar esta regra?')) return;
    try {
        const { error } = await supabaseClient.from('rh_regras_renomeacao').delete().eq('id', id);
        if (error) throw error;
        if (String(_regraEditandoId) === String(id)) cancelarEdicaoRegra();
        mostrarStatus('statusRegras', '✅ Regra deletada com sucesso!', 'success');
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar regra: ' + erro.message, 'error'); }
}

// --- MAPEAMENTO DE NOMES DE DOCUMENTOS ---

let _todosMapeamentos = [];
let _mapeamentoEditandoId = null;

async function carregarMapeamentos() {
    try {
        const { data, error } = await supabaseClient.from('rh_mapeamento_nomes').select('*').order('nome_arquivo', { ascending: true });
        if (error) throw error;
        _todosMapeamentos = data || [];
        renderizarTabelaMapeamentos(_todosMapeamentos);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar mapeamentos.'); }
}

function renderizarTabelaMapeamentos(mapeamentos) {
    const tbody = document.getElementById('mapeamentoTableBody');
    tbody.innerHTML = '';
    if (mapeamentos.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #95A5A6;">Nenhum mapeamento cadastrado</td></tr>'; return; }
    mapeamentos.forEach(map => {
        tbody.innerHTML += `<tr>
            <td>${map.nome_arquivo}</td>
            <td style="color: #8B3A3A; font-weight: bold;">${map.nome_documento}</td>
            <td style="display:flex;gap:6px;">
                <button type="button" class="btn-edit" onclick="editarMapeamento('${map.id}')">Editar</button>
                <button type="button" class="btn-delete" onclick="deletarMapeamento('${map.id}')">Deletar</button>
            </td>
        </tr>`;
    });
}

function editarMapeamento(id) {
    const map = _todosMapeamentos.find(m => String(m.id) === String(id));
    if (!map) return;
    _mapeamentoEditandoId = id;
    document.getElementById('mapNomeArquivo').value = map.nome_arquivo;
    document.getElementById('mapNomeDocumento').value = map.nome_documento;
    document.getElementById('btnSalvarMapeamento').textContent = '💾 Atualizar Mapeamento';
    document.getElementById('btnCancelarMapeamento').style.display = '';
    document.getElementById('mapNomeArquivo').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicaoMapeamento() {
    _mapeamentoEditandoId = null;
    document.getElementById('mapNomeArquivo').value = '';
    document.getElementById('mapNomeDocumento').value = '';
    document.getElementById('btnSalvarMapeamento').textContent = '➕ Salvar Mapeamento';
    document.getElementById('btnCancelarMapeamento').style.display = 'none';
}

async function adicionarMapeamento() {
    const nomeArquivo = document.getElementById('mapNomeArquivo').value.trim();
    const nomeDocumento = document.getElementById('mapNomeDocumento').value.trim();

    if (!nomeArquivo || !nomeDocumento) { mostrarStatus('statusRegras', 'Preencha ambos os campos do mapeamento.', 'error'); return; }

    try {
        if (_mapeamentoEditandoId) {
            const { error } = await supabaseClient.from('rh_mapeamento_nomes').update({ nome_arquivo: nomeArquivo, nome_documento: nomeDocumento }).eq('id', _mapeamentoEditandoId);
            if (error) throw error;
            mostrarStatus('statusRegras', '✅ Mapeamento atualizado com sucesso!', 'success');
            cancelarEdicaoMapeamento();
        } else {
            const { error } = await supabaseClient.from('rh_mapeamento_nomes').upsert([{
                nome_arquivo: nomeArquivo,
                nome_documento: nomeDocumento
            }], { onConflict: 'nome_arquivo' });
            if (error) throw error;
            document.getElementById('mapNomeArquivo').value = '';
            document.getElementById('mapNomeDocumento').value = '';
            mostrarStatus('statusRegras', '✅ Mapeamento salvo com sucesso!', 'success');
        }
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar mapeamento: ' + erro.message, 'error'); }
}

async function deletarMapeamento(id) {
    if (!confirm('Tem certeza que deseja deletar este mapeamento?')) return;
    try {
        const { error } = await supabaseClient.from('rh_mapeamento_nomes').delete().eq('id', id);
        if (error) throw error;
        if (String(_mapeamentoEditandoId) === String(id)) cancelarEdicaoMapeamento();
        mostrarStatus('statusRegras', '✅ Mapeamento deletado com sucesso!', 'success');
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar mapeamento: ' + erro.message, 'error'); }
}

// --- IMPORTAÇÃO DE DADOS (EXCEL) ---

function configurarUpload() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return; // tela foi refatorada para uploads por seção; este elemento não existe mais
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); const files = e.dataTransfer.files; if (files.length > 0) processarArquivo(files[0]); });
}

function handleFileSelect(event) { const files = event.target.files; if (files.length > 0) processarArquivo(files[0]); }

// ============================================================
// IMPORTAÇÃO INDIVIDUALIZADA
// ============================================================

function setProgresso(entidade, pct) {
    const bar = document.getElementById('progressBar' + entidade);
    const box = document.getElementById('progress' + entidade);
    if (box) box.style.display = pct === null ? 'none' : 'block';
    if (bar) bar.style.width = (pct ?? 0) + '%';
}

function setStatusImport(entidade, msg, tipo) {
    mostrarStatus('statusImportar' + entidade, msg, tipo);
}

function lerPlanilha(file, colunas, range = 1) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                if (!sheet) {
                    throw new Error('Não foi possível ler o conteúdo deste arquivo .xls — o navegador reconheceu a aba mas não conseguiu extrair as células (arquivo gerado em formato não padrão pelo sistema de origem). Abra o arquivo no Excel ou LibreOffice Calc, use "Salvar como" → .xlsx, e importe o arquivo convertido.');
                }
                const rows = XLSX.utils.sheet_to_json(sheet, { header: colunas, defval: '', range });
                resolve(rows);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function limparInput(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
}

// ── EMPRESAS ─────────────────────────────────────────────────

// ── MODAL MODO IMPORTAÇÃO ─────────────────────────────────────

const _tabelaParaSupabase = {
    'Empresas':  'rh_empresas',
    'Empregados':'rh_empregados',
    'Rubricas':  'rh_rubricas',
    'Sócios':    'rh_socios',
};

async function confirmarModoImportacao(entidade, qtd) {
    // Verificar se já há dados na tabela — se vazia, importa direto sem perguntar
    try {
        const tabela = _tabelaParaSupabase[entidade];
        if (tabela) {
            const { count } = await supabaseClient
                .from(tabela)
                .select('*', { count: 'exact', head: true });
            if ((count || 0) === 0) return 'acrescentar';
        }
    } catch (_) {}

    return new Promise(resolve => {
        const modal = document.getElementById('modalImportMode');
        document.getElementById('modalImportTitle').textContent = `Importar ${entidade}`;
        document.getElementById('modalImportMsg').textContent =
            `${qtd} registro(s) encontrado(s) no arquivo. O que deseja fazer com os dados já existentes?`;

        const fechar = resultado => {
            modal.style.display = 'none';
            resolve(resultado);
        };

        document.getElementById('modalBtnSubstituir').onclick  = () => fechar('substituir');
        document.getElementById('modalBtnAcrescentar').onclick = () => fechar('acrescentar');
        document.getElementById('modalBtnCancelar').onclick    = () => fechar(null);

        modal.style.display = 'flex';
    });
}

// ─────────────────────────────────────────────────────────────

// ── TIMESTAMP DE IMPORTAÇÃO ───────────────────────────────────

function _salvarTimestampImportacao(tipo) {
    const iso = new Date().toISOString();
    localStorage.setItem(`rh_ultima_importacao_${tipo}`, iso);
    _exibirTimestampImportacao(tipo, iso);
}

function _exibirTimestampImportacao(tipo, iso) {
    const el = document.getElementById(`ultimaImportacao${tipo}`);
    if (!el) return;
    const d = new Date(iso);
    const fmt = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    el.querySelector('span').textContent = fmt;
    el.style.display = 'block';
}

function _carregarTimestampsImportacao() {
    ['Empresas', 'Empregados', 'Ferias', 'Jornada', 'Rubricas', 'Socios'].forEach(tipo => {
        const iso = localStorage.getItem(`rh_ultima_importacao_${tipo}`);
        if (iso) _exibirTimestampImportacao(tipo, iso);
    });
}

// ── UF a partir do CEP (API ViaCEP + fallback por faixa) ──────

const _FAIXAS_CEP_UF = [
    { min:  1000000, max: 19999999, uf: 'SP' },
    { min: 20000000, max: 28999999, uf: 'RJ' },
    { min: 29000000, max: 29999999, uf: 'ES' },
    { min: 30000000, max: 39999999, uf: 'MG' },
    { min: 40000000, max: 48999999, uf: 'BA' },
    { min: 49000000, max: 49999999, uf: 'SE' },
    { min: 50000000, max: 56999999, uf: 'PE' },
    { min: 57000000, max: 57999999, uf: 'AL' },
    { min: 58000000, max: 58999999, uf: 'PB' },
    { min: 59000000, max: 59999999, uf: 'RN' },
    { min: 60000000, max: 63999999, uf: 'CE' },
    { min: 64000000, max: 64999999, uf: 'PI' },
    { min: 65000000, max: 65999999, uf: 'MA' },
    { min: 66000000, max: 68899999, uf: 'PA' },
    { min: 68900000, max: 68999999, uf: 'AP' },
    { min: 69000000, max: 69299999, uf: 'AM' },
    { min: 69300000, max: 69399999, uf: 'RR' },
    { min: 69400000, max: 69899999, uf: 'AM' },
    { min: 69900000, max: 69999999, uf: 'AC' },
    { min: 70000000, max: 72799999, uf: 'DF' },
    { min: 72800000, max: 72999999, uf: 'GO' },
    { min: 73000000, max: 73699999, uf: 'DF' },
    { min: 73700000, max: 76799999, uf: 'GO' },
    { min: 76800000, max: 76999999, uf: 'RO' },
    { min: 77000000, max: 77999999, uf: 'TO' },
    { min: 78000000, max: 78899999, uf: 'MT' },
    { min: 78900000, max: 78999999, uf: 'RO' },
    { min: 79000000, max: 79999999, uf: 'MS' },
    { min: 80000000, max: 87999999, uf: 'PR' },
    { min: 88000000, max: 89999999, uf: 'SC' },
    { min: 90000000, max: 99999999, uf: 'RS' },
];

function _buscarUFPorFaixaCep(cepNumerico) {
    const faixa = _FAIXAS_CEP_UF.find(f => cepNumerico >= f.min && cepNumerico <= f.max);
    return faixa ? faixa.uf : null;
}

async function buscarUFPorCep(cep) {
    const digitos = String(cep || '').replace(/\D/g, '');
    if (digitos.length !== 8) return null;

    try {
        const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
        if (resp.ok) {
            const dados = await resp.json();
            if (dados && !dados.erro && dados.uf) return dados.uf;
        }
    } catch (_) { /* API indisponível — cai no fallback local */ }

    return _buscarUFPorFaixaCep(Number(digitos));
}

async function _buscarUFsEmLotes(itens, obterCep, aoResolver, onProgresso) {
    const TAMANHO_LOTE = 5;
    for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
        const lote = itens.slice(i, i + TAMANHO_LOTE);
        await Promise.all(lote.map(async item => {
            const uf = await buscarUFPorCep(obterCep(item));
            aoResolver(item, uf);
        }));
        if (onProgresso) onProgresso(Math.min(i + TAMANHO_LOTE, itens.length), itens.length);
        if (i + TAMANHO_LOTE < itens.length) await new Promise(r => setTimeout(r, 200));
    }
}

async function preencherUFPendentes() {
    const ENT = 'Empresas';
    const pendentes = _todasEmpresas.filter(e => e.cep && !e.uf);
    if (!pendentes.length) {
        setStatusImport(ENT, 'Nenhuma empresa pendente de UF (todas já têm UF ou não têm CEP cadastrado).', 'info');
        return;
    }

    setStatusImport(ENT, `Buscando UF de ${pendentes.length} empresa(s)...`, 'info');
    setProgresso(ENT, 0);

    let falhas = 0;
    await _buscarUFsEmLotes(
        pendentes,
        e => e.cep,
        async (empresa, uf) => {
            if (!uf) { falhas++; return; }
            const { error } = await supabaseClient.from('rh_empresas').update({ uf }).eq('codigo_empresa', empresa.codigo_empresa);
            if (error) falhas++;
        },
        (feitos, total) => setProgresso(ENT, Math.round(feitos / total * 100))
    );

    setProgresso(ENT, null);
    const sucesso = pendentes.length - falhas;
    setStatusImport(ENT, `✅ UF preenchida para ${sucesso} empresa(s)${falhas ? ` (${falhas} não resolvida(s))` : ''}.`, falhas ? 'info' : 'success');
    carregarEmpresas();
}

function handleImportarEmpresas(event) {
    const file = event.target.files?.[0];
    if (file) importarEmpresas(file);
}

async function importarEmpresas(file) {
    const ENT = 'Empresas';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        // Relatório "Relação de Empresas" exportado do ERP: 7 linhas de título/paginação
        // antes dos dados, colunas intercaladas com colunas em branco (resquício de
        // células mescladas do relatório). Mapeamento posicional validado contra o arquivo real.
        const colunas = [
            'codigo_empresa','_s1','nome_empresa','_s3','cnpj','regime_enquadramento',
            'inscricao_estadual','inscricao_municipal','municipio','status_situacao','_s10',
            'data_cadastro','_s12','_s13','_s14','endereco','_s16','cep','_s18','cidade','_s20',
            '_s21_data_encerramento','_s22','_s23_codigo_interno','_s24','_s25_codigo_interno','_s26',
            'razao_social','_s28','_s29','email','_s31'
        ];

        const rows = (await lerPlanilha(file, colunas, 7))
            .map(r => ({ ...r, nome_empresa: r.razao_social || r.nome_empresa }))
            .filter(r => r.codigo_empresa && r.nome_empresa)
            .map(r => ({
                codigo_empresa:       String(r.codigo_empresa).trim(),
                nome_empresa:         String(r.nome_empresa).trim(),
                cnpj:                 r.cnpj ? String(r.cnpj).trim() : null,
                regime_enquadramento: r.regime_enquadramento ? String(r.regime_enquadramento).trim() : null,
                inscricao_estadual:   r.inscricao_estadual ? String(r.inscricao_estadual).trim() : null,
                inscricao_municipal:  r.inscricao_municipal ? String(r.inscricao_municipal).trim() : null,
                municipio:            r.municipio ? String(r.municipio).trim() : null,
                status_situacao:      r.status_situacao ? String(r.status_situacao).trim() : 'Ativo',
                data_cadastro:        r.data_cadastro instanceof Date
                                        ? r.data_cadastro.toISOString().split('T')[0]
                                        : (r.data_cadastro ? String(r.data_cadastro).trim() : null),
                endereco:             r.endereco ? String(r.endereco).trim() : null,
                cep:                  r.cep ? String(r.cep).trim() : null,
                cidade:               r.cidade ? String(r.cidade).trim() : null,
                email:                r.email ? String(r.email).trim() : null,
            }));

        if (!rows.length) throw new Error('Nenhuma linha válida encontrada. Verifique se o arquivo segue o modelo.');

        const modo = await confirmarModoImportacao('Empresas', rows.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

        const rowsComCep = rows.filter(r => r.cep);
        if (rowsComCep.length) {
            setStatusImport(ENT, `Buscando UF de ${rowsComCep.length} empresa(s) pelo CEP...`, 'info');
            await _buscarUFsEmLotes(
                rowsComCep,
                r => r.cep,
                (row, uf) => { row.uf = uf; },
                (feitos, total) => setProgresso(ENT, 10 + Math.round(feitos / total * 40))
            );
            // No modo "acrescentar", não sobrescrever UF já salva quando a busca desta linha falhou.
            if (modo === 'acrescentar') {
                rowsComCep.forEach(r => { if (!r.uf) delete r.uf; });
            }
        }

        setProgresso(ENT, 50);
        setStatusImport(ENT, `Salvando ${rows.length} empresa(s)...`, 'info');

        // codigo_empresa é UNIQUE em rh_empresas (uma linha por empresa), então "substituir"
        // e "acrescentar" resultam na mesma linha final — não há necessidade de delete antes
        // do insert (que quebraria FKs de outras tabelas, ex.: contabil_onboardings.codigo_empresa).
        // A única diferença entre os modos é o tratamento de UF quando a busca falha (abaixo).
        const { error } = await supabaseClient.from('rh_empresas').upsert(rows, { onConflict: 'codigo_empresa' });
        if (error) throw error;

        setProgresso(ENT, null);
        setStatusImport(ENT, `✅ ${rows.length} empresa(s) importada(s) com sucesso!`, 'success');
        _salvarTimestampImportacao('Empresas');
        carregarEmpresas();
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileEmpresas');
    }
}

// ── FÉRIAS (PDF) ──────────────────────────────────────────────

function handleImportarFerias(event) {
    const file = event.target.files?.[0];
    if (file) processarPdfFerias(file);
}

async function processarPdfFerias(file) {
    const ENT = 'Ferias';
    document.getElementById('resumoImportarFerias').innerHTML = '';
    try {
        setStatusImport(ENT, 'Lendo o PDF de férias calculadas...', 'info');
        setProgresso(ENT, 10);

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        let todasLinhas = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            todasLinhas = todasLinhas.concat(_reconstruirLinhasPagina(content.items));
            setProgresso(ENT, 10 + Math.round((p / pdf.numPages) * 40));
        }

        const { registros, avisos } = _parsearLinhasFerias(todasLinhas);

        if (registros.length === 0) {
            setProgresso(ENT, null);
            setStatusImport(ENT, 'Nenhum registro de férias foi reconhecido neste PDF.', 'error');
            return;
        }

        setStatusImport(ENT, `Salvando ${registros.length} registro(s)...`, 'info');
        setProgresso(ENT, 60);
        await _salvarFeriasCalculadas(ENT, registros, avisos);
        setProgresso(ENT, null);
        _salvarTimestampImportacao('Ferias');
        carregarFeriasInfo();
    } catch (erro) {
        console.error('Erro ao processar PDF de férias:', erro);
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ Falha ao processar o PDF. Verifique se o arquivo é válido.', 'error');
    } finally {
        limparInput('fileFerias');
    }
}

async function _salvarFeriasCalculadas(ENT, registros, avisos) {
    const codigosEmpresas = [...new Set(registros.map(r => r.codigo_empresa))];

    const { data: existentesData, error: errExistentes } = await supabaseClient
        .from('rh_ferias_calculadas')
        .select('codigo_empresa, codigo_empregado, ferias_inicio')
        .in('codigo_empresa', codigosEmpresas);
    if (errExistentes) {
        setStatusImport(ENT, 'Falha ao consultar registros existentes antes de salvar.', 'error');
        return;
    }
    const chavesExistentes = new Set(
        (existentesData || []).map(r => `${r.codigo_empresa}|${r.codigo_empregado}|${r.ferias_inicio}`)
    );

    const porEmpresa = {}; // codigo_empresa -> { nome, novos, atualizados }
    registros.forEach(r => {
        if (!porEmpresa[r.codigo_empresa]) {
            porEmpresa[r.codigo_empresa] = { nome: r.nome_empresa, novos: 0, atualizados: 0 };
        }
        const chave = `${r.codigo_empresa}|${r.codigo_empregado}|${r.ferias_inicio}`;
        if (chavesExistentes.has(chave)) {
            porEmpresa[r.codigo_empresa].atualizados++;
        } else {
            porEmpresa[r.codigo_empresa].novos++;
        }
    });

    const registrosParaSalvar = registros.map(r => ({
        codigo_empresa: r.codigo_empresa,
        nome_empresa: r.nome_empresa,
        codigo_empregado: r.codigo_empregado,
        nome_empregado: r.nome_empregado,
        aquisitivo_inicio: r.aquisitivo_inicio,
        aquisitivo_fim: r.aquisitivo_fim,
        ferias_inicio: r.ferias_inicio,
        ferias_fim: r.ferias_fim
    }));

    const LOTE = 200;
    for (let i = 0; i < registrosParaSalvar.length; i += LOTE) {
        const pedaco = registrosParaSalvar.slice(i, i + LOTE);
        const { error } = await supabaseClient
            .from('rh_ferias_calculadas')
            .upsert(pedaco, { onConflict: 'codigo_empresa,codigo_empregado,ferias_inicio' });
        if (error) {
            console.error('Erro ao salvar férias calculadas:', error);
            setStatusImport(ENT, `Falha ao salvar registros no banco: ${error.message}`, 'error');
            return;
        }
    }

    const totalNovos = Object.values(porEmpresa).reduce((s, e) => s + e.novos, 0);
    const totalAtualizados = Object.values(porEmpresa).reduce((s, e) => s + e.atualizados, 0);
    setStatusImport(ENT, `✅ ${registros.length} registro(s) salvos (${totalNovos} novo(s), ${totalAtualizados} atualizado(s))`, 'success');
    _renderizarResumoImportacaoFerias(porEmpresa, avisos);
}

function _renderizarResumoImportacaoFerias(porEmpresa, avisos) {
    const container = document.getElementById('resumoImportarFerias');
    let html = `<div style="margin-top:8px;">
        <strong>Empresa(s) atualizada(s):</strong>
        <ul style="margin:6px 0 0; padding-left:18px;">
            ${Object.entries(porEmpresa).map(([codigo, info]) => `<li>${codigo} - ${info.nome}: ${info.novos} novo(s), ${info.atualizados} atualizado(s)</li>`).join('')}
        </ul>
    </div>`;

    if (avisos.length > 0) {
        html += `
            <details style="margin-top:8px;">
                <summary style="cursor:pointer; color:#92400e; font-weight:600;">⚠️ ${avisos.length} linha(s) não reconhecida(s)</summary>
                <ul style="margin-top:6px; padding-left:18px; color:#78350f;">
                    ${avisos.map(a => `<li><strong>${a.motivo}:</strong> ${a.linha}</li>`).join('')}
                </ul>
            </details>
        `;
    }

    container.innerHTML = html;
}

// ── JORNADA DE TRABALHO ──────────────────────────────────────────

function handleImportarJornada(event) {
    const file = event.target.files?.[0];
    if (file) processarPdfJornada(file);
}

async function processarPdfJornada(file) {
    const ENT = 'Jornada';
    document.getElementById('resumoImportarJornada').innerHTML = '';
    try {
        setStatusImport(ENT, 'Lendo o PDF de jornada de trabalho...', 'info');
        setProgresso(ENT, 10);

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        let todasLinhas = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            todasLinhas = todasLinhas.concat(_agruparItensPorLinha(content.items));
            setProgresso(ENT, 10 + Math.round((p / pdf.numPages) * 40));
        }

        const { registros, avisos } = _parsearLinhasJornada(todasLinhas);

        if (registros.length === 0) {
            setProgresso(ENT, null);
            setStatusImport(ENT, 'Nenhum registro de jornada foi reconhecido neste PDF.', 'error');
            return;
        }

        setStatusImport(ENT, `Salvando ${registros.length} registro(s)...`, 'info');
        setProgresso(ENT, 60);
        await _salvarJornadaTrabalho(ENT, registros, avisos);
        setProgresso(ENT, null);
        _salvarTimestampImportacao('Jornada');
        carregarJornadaInfo();
    } catch (erro) {
        console.error('Erro ao processar PDF de jornada de trabalho:', erro);
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ Falha ao processar o PDF. Verifique se o arquivo é válido.', 'error');
    } finally {
        limparInput('fileJornada');
    }
}

async function _salvarJornadaTrabalho(ENT, registros, avisos) {
    // Snapshot completo: cada import reflete o estado atual da jornada de
    // todos os empregados. Uma chave duplicada (mesma empresa+empregado+dia)
    // dentro do próprio arquivo mantém só a última ocorrência.
    const porChave = new Map();
    let duplicatasNoArquivo = 0;
    for (const r of registros) {
        const chave = `${r.codigo_empresa}|${r.codigo_empregado}|${r.dia_semana}`;
        if (porChave.has(chave)) duplicatasNoArquivo++;
        porChave.set(chave, r);
    }
    const registrosParaSalvar = [...porChave.values()];

    const { error: errDelete } = await supabaseClient.from('rh_jornada_trabalho').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errDelete) {
        setStatusImport(ENT, 'Falha ao limpar os dados existentes antes de salvar.', 'error');
        return;
    }

    const LOTE = 500;
    for (let i = 0; i < registrosParaSalvar.length; i += LOTE) {
        const pedaco = registrosParaSalvar.slice(i, i + LOTE);
        const { error } = await supabaseClient.from('rh_jornada_trabalho').insert(pedaco);
        if (error) {
            console.error('Erro ao salvar jornada de trabalho:', error);
            setStatusImport(ENT, `Falha ao salvar registros no banco: ${error.message}`, 'error');
            return;
        }
    }

    const empresas = new Set(registrosParaSalvar.map(r => r.codigo_empresa));
    const empregados = new Set(registrosParaSalvar.map(r => `${r.codigo_empresa}|${r.codigo_empregado}`));
    setStatusImport(ENT, `✅ ${registrosParaSalvar.length} registro(s) salvos — ${empregados.size} empregado(s) em ${empresas.size} empresa(s)`, 'success');
    _renderizarResumoImportacaoJornada(empresas.size, empregados.size, duplicatasNoArquivo, avisos);
}

function _renderizarResumoImportacaoJornada(qtdEmpresas, qtdEmpregados, duplicatasNoArquivo, avisos) {
    const container = document.getElementById('resumoImportarJornada');
    let html = `<div style="margin-top:8px;">${qtdEmpregados} empregado(s) em ${qtdEmpresas} empresa(s) atualizado(s).</div>`;

    if (duplicatasNoArquivo > 0) {
        html += `<div style="margin-top:6px;color:#92400e;">⚠️ ${duplicatasNoArquivo} linha(s) duplicada(s) no arquivo (mesma empresa/empregado/dia) — mantida a última ocorrência.</div>`;
    }

    if (avisos.length > 0) {
        html += `
            <details style="margin-top:8px;">
                <summary style="cursor:pointer; color:#92400e; font-weight:600;">⚠️ ${avisos.length} linha(s) não reconhecida(s)</summary>
                <ul style="margin-top:6px; padding-left:18px; color:#78350f;">
                    ${avisos.map(a => `<li><strong>${a.motivo}:</strong> ${a.linha}</li>`).join('')}
                </ul>
            </details>
        `;
    }

    container.innerHTML = html;
}

let _todaJornadaInfo = [];
let _jornadaInfoFiltrada = [];
let _paginaJornadaInfo = 1;
const _porPaginaJornadaInfo = 50;
const _DIAS_SEMANA_ORDEM = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

async function carregarJornadaInfo() {
    try {
        const linhas = await _buscarTodasLinhasJornada();
        const agrupados = _agruparJornadaPorEmpregado(linhas);
        agrupados.sort((a, b) =>
            a.codigo_empresa.localeCompare(b.codigo_empresa, 'pt-BR', { numeric: true }) ||
            (a.nome_empregado || '').localeCompare(b.nome_empregado || '', 'pt-BR')
        );
        _todaJornadaInfo = _filtrarPorEscopo(agrupados);
        _jornadaInfoFiltrada = [..._todaJornadaInfo];
        _paginaJornadaInfo = 1;
        renderizarTabelaJornadaInfo();
    } catch (erro) { mostrarStatus('statusJornadaInfo', 'Erro ao carregar informações de jornada de trabalho.', 'error'); }
}

// O Supabase/PostgREST limita a quantidade de linhas por requisição (padrão:
// 1000) — com >14 mil linhas em rh_jornada_trabalho, uma única .select('*')
// traz só a primeira página. Busca em blocos com .range() até esgotar os dados.
async function _buscarTodasLinhasJornada() {
    const TAMANHO_BLOCO = 1000;
    let todas = [];
    let inicio = 0;
    while (true) {
        const { data, error } = await supabaseClient
            .from('rh_jornada_trabalho')
            .select('*')
            .range(inicio, inicio + TAMANHO_BLOCO - 1);
        if (error) throw error;
        todas = todas.concat(data || []);
        if (!data || data.length < TAMANHO_BLOCO) break;
        inicio += TAMANHO_BLOCO;
    }
    return todas;
}

function _agruparJornadaPorEmpregado(linhas) {
    const porEmpregado = new Map();
    for (const l of linhas) {
        const chave = `${l.codigo_empresa}|${l.codigo_empregado}`;
        if (!porEmpregado.has(chave)) {
            porEmpregado.set(chave, {
                codigo_empresa: l.codigo_empresa,
                nome_empresa: l.nome_empresa,
                codigo_empregado: l.codigo_empregado,
                nome_empregado: l.nome_empregado,
                dias: {}
            });
        }
        porEmpregado.get(chave).dias[l.dia_semana] = l;
    }
    return [...porEmpregado.values()];
}

function filtrarJornadaInfo() {
    const texto = (document.getElementById('filtroJornadaTexto')?.value || '').toLowerCase().trim();
    _jornadaInfoFiltrada = _todaJornadaInfo.filter(j => {
        if (!texto) return true;
        return (
            (j.codigo_empresa || '').toLowerCase().includes(texto) ||
            (j.nome_empresa || '').toLowerCase().includes(texto) ||
            (j.codigo_empregado || '').toLowerCase().includes(texto) ||
            (j.nome_empregado || '').toLowerCase().includes(texto)
        );
    });
    _paginaJornadaInfo = 1;
    renderizarTabelaJornadaInfo();
}

function _fmtHorarioDia(dia) {
    if (!dia) return '<span style="color:#C0C0C0;">—</span>';
    if (dia.intervalo_inicio && dia.intervalo_fim) {
        return `${dia.entrada}-${dia.intervalo_inicio} / ${dia.intervalo_fim}-${dia.saida}`;
    }
    return `${dia.entrada}-${dia.saida}`;
}

function renderizarTabelaJornadaInfo() {
    const tbody = document.getElementById('jornadaInfoTableBody');
    const paginacao = document.getElementById('paginacaoJornadaInfo');
    const info = document.getElementById('infoJornadaInfo');
    tbody.innerHTML = '';

    if (_jornadaInfoFiltrada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#95A5A6;padding:20px;">Nenhum empregado encontrado</td></tr>';
        paginacao.innerHTML = '';
        if (info) info.textContent = '';
        return;
    }

    const totalPags = Math.ceil(_jornadaInfoFiltrada.length / _porPaginaJornadaInfo);
    const inicio    = (_paginaJornadaInfo - 1) * _porPaginaJornadaInfo;
    const pagina    = _jornadaInfoFiltrada.slice(inicio, inicio + _porPaginaJornadaInfo);

    if (info) info.textContent = _jornadaInfoFiltrada.length < _todaJornadaInfo.length
        ? `${_jornadaInfoFiltrada.length} de ${_todaJornadaInfo.length} empregado(s)`
        : `${_todaJornadaInfo.length} empregado(s)`;

    pagina.forEach(j => {
        tbody.innerHTML += `<tr>
            <td><strong>${j.codigo_empresa}</strong></td>
            <td>${j.nome_empresa || ''}</td>
            <td>${j.codigo_empregado}</td>
            <td>${j.nome_empregado || ''}</td>
            ${_DIAS_SEMANA_ORDEM.map(d => `<td>${_fmtHorarioDia(j.dias[d])}</td>`).join('')}
            <td><button type="button" onclick="abrirModalEditarJornada('${j.codigo_empresa}','${j.codigo_empregado}')" style="padding:6px 10px;border:1px solid #C0C0C0;border-radius:6px;background:white;cursor:pointer;font-size:12px;">✏️ Editar</button></td>
        </tr>`;
    });

    paginacao.innerHTML = totalPags <= 1 ? '' : `
        <button onclick="mudarPaginaJornadaInfo(${_paginaJornadaInfo - 1})" ${_paginaJornadaInfo === 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="pag-info">Página <strong>${_paginaJornadaInfo}</strong> de <strong>${totalPags}</strong> — ${_jornadaInfoFiltrada.length} empregado(s)</span>
        <button onclick="mudarPaginaJornadaInfo(${_paginaJornadaInfo + 1})" ${_paginaJornadaInfo === totalPags ? 'disabled' : ''}>Próxima ›</button>
    `;
}

function mudarPaginaJornadaInfo(pag) {
    const totalPags = Math.ceil(_jornadaInfoFiltrada.length / _porPaginaJornadaInfo);
    if (pag < 1 || pag > totalPags) return;
    _paginaJornadaInfo = pag;
    renderizarTabelaJornadaInfo();
    document.getElementById('jornada')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const _DIAS_SEMANA_LABEL = {
    segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira',
    quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado', domingo: 'Domingo'
};

function abrirModalEditarJornada(codigoEmpresa, codigoEmpregado) {
    const registro = _todaJornadaInfo.find(j => j.codigo_empresa === codigoEmpresa && j.codigo_empregado === codigoEmpregado);
    if (!registro) return;

    document.getElementById('jornadaEditEmpresa').value = codigoEmpresa;
    document.getElementById('jornadaEditEmpregado').value = codigoEmpregado;
    document.getElementById('jornadaEditTitulo').textContent =
        `Editar Jornada — ${registro.nome_empregado || ''} (${codigoEmpregado}) — ${registro.nome_empresa || codigoEmpresa}`;
    document.getElementById('statusJornadaEdit').innerHTML = '';

    const tbody = document.getElementById('jornadaEditTableBody');
    tbody.innerHTML = _DIAS_SEMANA_ORDEM.map(dia => {
        const d = registro.dias[dia];
        const trabalha = !!d;
        return `<tr data-dia="${dia}">
            <td><input type="checkbox" id="jeTrabalha_${dia}" ${trabalha ? 'checked' : ''} onchange="_toggleDiaJornadaEdit('${dia}')"></td>
            <td>${_DIAS_SEMANA_LABEL[dia]}</td>
            <td><input type="time" id="jeEntrada_${dia}" value="${d?.entrada || ''}" ${trabalha ? '' : 'disabled'}></td>
            <td><input type="time" id="jeIntIni_${dia}" value="${d?.intervalo_inicio || ''}" ${trabalha ? '' : 'disabled'}></td>
            <td><input type="time" id="jeIntFim_${dia}" value="${d?.intervalo_fim || ''}" ${trabalha ? '' : 'disabled'}></td>
            <td><input type="time" id="jeSaida_${dia}" value="${d?.saida || ''}" ${trabalha ? '' : 'disabled'}></td>
        </tr>`;
    }).join('');

    document.getElementById('modalJornadaEdit').classList.add('active');
}

function _toggleDiaJornadaEdit(dia) {
    const trabalha = document.getElementById(`jeTrabalha_${dia}`).checked;
    ['jeEntrada_', 'jeIntIni_', 'jeIntFim_', 'jeSaida_'].forEach(prefixo => {
        document.getElementById(`${prefixo}${dia}`).disabled = !trabalha;
    });
}

function fecharModalJornadaEdit() {
    document.getElementById('modalJornadaEdit').classList.remove('active');
}

async function salvarJornadaEdit() {
    const codigoEmpresa = document.getElementById('jornadaEditEmpresa').value;
    const codigoEmpregado = document.getElementById('jornadaEditEmpregado').value;
    const registro = _todaJornadaInfo.find(j => j.codigo_empresa === codigoEmpresa && j.codigo_empregado === codigoEmpregado);
    if (!registro) return;

    const paraSalvar = [];
    const diasParaExcluir = [];

    for (const dia of _DIAS_SEMANA_ORDEM) {
        const trabalha = document.getElementById(`jeTrabalha_${dia}`).checked;
        const existiaAntes = !!registro.dias[dia];

        if (!trabalha) {
            if (existiaAntes) diasParaExcluir.push(dia);
            continue;
        }

        const entrada = document.getElementById(`jeEntrada_${dia}`).value;
        const saida = document.getElementById(`jeSaida_${dia}`).value;
        const intervaloInicio = document.getElementById(`jeIntIni_${dia}`).value;
        const intervaloFim = document.getElementById(`jeIntFim_${dia}`).value;

        if (!entrada || !saida) {
            mostrarStatus('statusJornadaEdit', `${_DIAS_SEMANA_LABEL[dia]}: entrada e saída são obrigatórias.`, 'error');
            return;
        }
        if (entrada >= saida) {
            mostrarStatus('statusJornadaEdit', `${_DIAS_SEMANA_LABEL[dia]}: entrada deve ser antes da saída.`, 'error');
            return;
        }
        if ((intervaloInicio && !intervaloFim) || (!intervaloInicio && intervaloFim)) {
            mostrarStatus('statusJornadaEdit', `${_DIAS_SEMANA_LABEL[dia]}: preencha início e fim do intervalo, ou deixe os dois em branco.`, 'error');
            return;
        }

        paraSalvar.push({
            codigo_empresa: codigoEmpresa,
            nome_empresa: registro.nome_empresa,
            codigo_empregado: codigoEmpregado,
            nome_empregado: registro.nome_empregado,
            dia_semana: dia,
            entrada,
            intervalo_inicio: intervaloInicio || null,
            intervalo_fim: intervaloFim || null,
            saida
        });
    }

    try {
        if (diasParaExcluir.length > 0) {
            const { error } = await supabaseClient
                .from('rh_jornada_trabalho')
                .delete()
                .eq('codigo_empresa', codigoEmpresa)
                .eq('codigo_empregado', codigoEmpregado)
                .in('dia_semana', diasParaExcluir);
            if (error) throw error;
        }
        if (paraSalvar.length > 0) {
            const { error } = await supabaseClient
                .from('rh_jornada_trabalho')
                .upsert(paraSalvar, { onConflict: 'codigo_empresa,codigo_empregado,dia_semana' });
            if (error) throw error;
        }
        fecharModalJornadaEdit();
        mostrarStatus('statusJornadaInfo', '✅ Jornada atualizada!', 'success');
        await carregarJornadaInfo();
    } catch (err) {
        mostrarStatus('statusJornadaEdit', 'Erro ao salvar: ' + err.message, 'error');
    }
}

// ── EMPREGADOS ────────────────────────────────────────────────

const _COLS_EMPREGADOS = [
    'codigo_empresa','codigo_empregado','nome_empregado','cod_esocial',
    'data_admissao','fim_determinado','fim_prorrogacao','salario','categoria',
    'cod_cargo','desc_cargo','cbo','cod_funcao','desc_funcao',
    'cod_ccusto','desc_ccusto','cod_servico','desc_servico','cod_dpto','desc_dpto',
    'cod_sind','sindicato','cpf','pis','rg','uf_rg','orgao_rg','expedicao_rg',
    'data_nascimento','cidade_nascimento','uf_nascimento','pais_nascimento',
    'endereco','numero_end','complemento','bairro','cep','cidade','uf_endereco',
    'telefone','celular','email',
    'ric','orgao_ric','local_ric','data_exp_ric','validade_ric',
    'passaporte','uf_passaporte','emissao_passaporte','validade_passaporte',
    'rne','orgao_rne','expedicao_rne',
    'cnh','categoria_cnh','expedicao_cnh','vencimento_cnh',
    'reservista','titulo_eleitor','zona_eleitoral','secao_eleitoral',
    'ctps','serie_ctps','uf_ctps','expedicao_ctps',
    'nome_mae','nome_pai','sexo','estado_civil','raca_cor','jornada',
    'nome_banco','tipo_conta','agencia','conta_bancaria','nome_social',
    'grau_instrucao','situacao','data_demissao','motivo_demissao','tipo_empregado',
    'possui_deficiencia','deficiencia_fisica','deficiencia_visual','deficiencia_auditiva',
    'deficiencia_intelectual','deficiencia_mental','outra_deficiencia','reabilitado',
    'obs_deficiencia','cota_deficiente',
    'nom_dep_1','nasc_dep_1','cpf_dep_1','parentesco_dep_1',
    'nom_dep_2','nasc_dep_2','cpf_dep_2','parentesco_dep_2',
    'nom_dep_3','nasc_dep_3','cpf_dep_3','parentesco_dep_3',
    'nom_dep_4','nasc_dep_4','cpf_dep_4','parentesco_dep_4',
    'nom_dep_5','nasc_dep_5','cpf_dep_5','parentesco_dep_5',
    'nom_dep_6','nasc_dep_6','cpf_dep_6','parentesco_dep_6',
    'nom_dep_7','nasc_dep_7','cpf_dep_7','parentesco_dep_7'
];

const _HEADERS_EMPREGADOS = [
    'Cód Emp','Cód Epr','Nome','Cód eSocial',
    'Admissão','Fim Determinado','Fim Prorrogação','Salário','Categoria',
    'Cód Cargo','Descrição cargo','CBO','Cód Função','Descrição Função',
    'Cód Ccusto','Descrição Ccusto','Cód Serviço','Descrição Serviço','Cód Dpto','Descrição Dpto',
    'Cód Sind','Sindicato','CPF','PIS','RG','UF RG','Orgão RG','Data EX',
    'Data nascimento','Cidade nascimento','UF Nasc.','Pais nascimento',
    'Endereço','Numero','Complemento','Bairro','Cep','Cidade','UF End',
    'Telefone','Celular','Email',
    'RIC','Orgão RIC','Local RIC','Data Exp Ric','Validade Ric',
    'Passaporte','UF Pass.','Emissão Pass.','Validade Pass',
    'RNE','Orgão RNE','Expedição RNE',
    'CNH','Categoria','Expedição CNH','Vencimento',
    'Reservista','Titulo','Zona','Seção',
    'CTPS','Serie CTPS','UF CTPS','Expedição CTPS',
    'Nome Mãe','Nome Pai','Sexo','Estado Civil','Raça/Cor','Jornada',
    'Nome Banco','Tipo Conta','Agencia','Conta','Nome Social',
    'Grau instrução','Situação','Data Demissão','Motivo Demissão','Tipo Empregado',
    'Possui deficiência','Deficiência física','Deficiência visual','Deficiência auditiva',
    'Deficiência intelectual','Deficiência mental','Outra deficiência','Reabilitado(a)',
    'Observação deficiência','Cota deficiente',
    'Nome Dependente 1','Nascimento Dependente 1','CPF Dependente 1','Parentesco Dependente 1',
    'Nome Dependente 2','Nascimento Dependente 2','CPF Dependente 2','Parentesco Dependente 2',
    'Nome Dependente 3','Nascimento Dependente 3','CPF Dependente 3','Parentesco Dependente 3',
    'Nome Dependente 4','Nascimento Dependente 4','CPF Dependente 4','Parentesco Dependente 4',
    'Nome Dependente 5','Nascimento Dependente 5','CPF Dependente 5','Parentesco Dependente 5',
    'Nome Dependente 6','Nascimento Dependente 6','CPF Dependente 6','Parentesco Dependente 6',
    'Nome Dependente 7','Nascimento Dependente 7','CPF Dependente 7','Parentesco Dependente 7'
];

const _DATE_COLS_EMPREGADOS = new Set([
    'data_admissao','fim_determinado','fim_prorrogacao','expedicao_rg',
    'data_nascimento','data_exp_ric','validade_ric','emissao_passaporte',
    'validade_passaporte','expedicao_rne','expedicao_cnh','vencimento_cnh',
    'expedicao_ctps','data_demissao',
    'nasc_dep_1','nasc_dep_2','nasc_dep_3','nasc_dep_4',
    'nasc_dep_5','nasc_dep_6','nasc_dep_7'
]);

function _fmtDateCell(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString().split('T')[0];
    if (typeof v === 'number') {
        // Excel serial date
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
    const s = String(v).trim();
    if (!s) return null;
    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return s;
}

function baixarModeloEmpregados() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([_HEADERS_EMPREGADOS]);
    ws['!cols'] = _HEADERS_EMPREGADOS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Empregados');
    XLSX.writeFile(wb, 'modelo_empregados.xlsx');
}

// O relatório de "Todas as empresas" (Apenas Ativos) repete a linha de
// cabeçalho a cada troca de empresa, e alguns campos (ex.: Agência/Conta)
// vêm em ordem diferente dependendo da empresa. Por isso a leitura é feita
// por NOME da coluna (a cada linha de cabeçalho encontrada) em vez de por
// posição fixa — assim cada bloco de empresa é remapeado corretamente e
// linhas de cabeçalho repetidas não viram "empregados" fantasmas.

function _pareceLinhaCabecalhoEmpregados(linha) {
    return String(linha?.[0] ?? '').trim() === _HEADERS_EMPREGADOS[0];
}

function _construirMapaColunasEmpregados(linhaCabecalho) {
    const indicesPorRotulo = {};
    _HEADERS_EMPREGADOS.forEach((rotulo, i) => {
        const chave = rotulo.trim();
        (indicesPorRotulo[chave] ||= []).push(i);
    });

    const usados = {};
    const mapa = {}; // índice da coluna no arquivo -> chave interna (_COLS_EMPREGADOS)
    linhaCabecalho.forEach((celula, idxArquivo) => {
        const rotulo = String(celula ?? '').trim();
        if (!rotulo) return; // coluna em branco/sem nome no arquivo — ignorada
        const ocorrencias = indicesPorRotulo[rotulo];
        if (!ocorrencias) return; // rótulo não reconhecido — ignorado

        // Rótulos duplicados no modelo (ex.: "Categoria" para categoria do
        // empregado e categoria da CNH) são resolvidos pela ordem de
        // aparição: a N-ésima ocorrência no arquivo mapeia para a N-ésima
        // ocorrência no modelo canônico.
        const n = usados[rotulo] || 0;
        const idxCanonico = ocorrencias[Math.min(n, ocorrencias.length - 1)];
        usados[rotulo] = n + 1;
        mapa[idxArquivo] = _COLS_EMPREGADOS[idxCanonico];
    });
    return mapa;
}

function lerPlanilhaEmpregados(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                if (!sheet) {
                    throw new Error('Não foi possível ler o conteúdo deste arquivo .xls — o navegador reconheceu a aba mas não conseguiu extrair as células (arquivo gerado em formato não padrão pelo sistema de origem). Abra o arquivo no Excel ou LibreOffice Calc, use "Salvar como" → .xlsx, e importe o arquivo convertido.');
                }
                const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                const registros = [];
                let mapaAtual = null;
                for (const linha of linhas) {
                    if (_pareceLinhaCabecalhoEmpregados(linha)) {
                        mapaAtual = _construirMapaColunasEmpregados(linha);
                        continue;
                    }
                    if (!mapaAtual) continue; // linha antes do primeiro cabeçalho reconhecido
                    const obj = {};
                    Object.entries(mapaAtual).forEach(([idxArquivo, chave]) => {
                        obj[chave] = linha[idxArquivo];
                    });
                    registros.push(obj);
                }
                resolve(registros);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function handleImportarEmpregados(event) {
    const file = event.target.files?.[0];
    if (file) importarEmpregadosIndividual(file);
}

async function importarEmpregadosIndividual(file) {
    const ENT = 'Empregados';
    const resumoEl = document.getElementById('resumoImportarEmpregados');
    if (resumoEl) resumoEl.innerHTML = '';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const raw = await lerPlanilhaEmpregados(file);

        if (!raw.length) throw new Error('Arquivo vazio ou sem dados reconhecíveis.');

        setProgresso(ENT, 20);
        setStatusImport(ENT, 'Processando linhas...', 'info');

        const rows = raw
            .filter(r => r.codigo_empresa && r.codigo_empregado && r.nome_empregado)
            .map(r => {
                const obj = {};
                _COLS_EMPREGADOS.forEach(col => {
                    const v = r[col];
                    if (_DATE_COLS_EMPREGADOS.has(col)) {
                        obj[col] = _fmtDateCell(v);
                    } else if (col === 'salario') {
                        const n = parseFloat(String(v ?? '').replace(',', '.'));
                        obj[col] = isNaN(n) ? null : n;
                    } else {
                        const s = v !== undefined && v !== null ? String(v).trim() : null;
                        obj[col] = s || null;
                    }
                });
                return obj;
            });

        if (!rows.length) throw new Error(`Nenhuma linha válida encontrada (${raw.length} linhas lidas). Verifique se o arquivo segue o modelo — as 3 primeiras colunas devem ser Cód. Empresa, Cód. Empregado e Nome.`);

        setStatusImport(ENT, 'Comparando com a listagem atual...', 'info');
        const comparacao = await _compararListagemEmpregados(rows);
        const totalDivergencias = comparacao.novos.length + comparacao.situacaoAlterada.length + comparacao.sumidos.length;
        if (totalDivergencias > 0) {
            const prosseguir = await _mostrarModalComparacaoEmpregados(comparacao);
            if (!prosseguir) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }
        }

        // Mostra o modal com total bruto do arquivo
        const modo = await confirmarModoImportacao('Empregados', raw.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

        setProgresso(ENT, 40);
        setStatusImport(ENT, `Salvando ${rows.length} empregado(s)...`, 'info');

        if (modo === 'substituir') {
            const codigos = [...new Set(rows.map(r => r.codigo_empresa))];
            const { error: delErr } = await supabaseClient.from('rh_empregados').delete().in('codigo_empresa', codigos);
            if (delErr) throw delErr;
        }

        const LOTE = 200;
        for (let i = 0; i < rows.length; i += LOTE) {
            const { error } = await supabaseClient
                .from('rh_empregados')
                .upsert(rows.slice(i, i + LOTE), { onConflict: 'codigo_empresa,codigo_empregado' });
            if (error) throw error;
            setProgresso(ENT, 40 + Math.round(((i + LOTE) / rows.length) * 55));
        }

        setProgresso(ENT, null);
        setStatusImport(ENT, `✅ ${rows.length} empregado(s) importado(s) com sucesso!`, 'success');
        _salvarTimestampImportacao('Empregados');
        carregarEmpregados();

        if (comparacao.novos.length > 0) _salvarPendentesConfigNovos(comparacao.novos);
        _renderizarResumoImportacaoEmpregados(comparacao);
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileEmpregados');
    }
}

// ── COMPARAÇÃO COM A LISTAGEM ATUAL (EMPREGADOS) ─────────────────
// Compara a listagem importada com o que já está em rh_empregados para as
// mesmas empresas, para destacar empregados novos, mudança de situação e
// empregados que sumiram do arquivo (sem presumir o motivo).

async function _compararListagemEmpregados(rows) {
    const dedup = new Map();
    rows.forEach(r => dedup.set(`${r.codigo_empresa}|${r.codigo_empregado}`, r));
    const linhas = [...dedup.values()];

    const empresasEnvolvidas = [...new Set(linhas.map(r => r.codigo_empresa))];
    // Busca paginada para superar o limite de 1000 linhas do Supabase (mesmo
    // motivo de carregarEmpregados/_buscarTodasLinhasJornada) — sem isso,
    // empresas com mais de 1000 empregados tinham o excedente tratado como
    // "novo" no diff, por não aparecer em atualMap.
    let atuais = [];
    {
        const PAGE = 1000;
        let from = 0;
        while (true) {
            const { data, error } = await supabaseClient
                .from('rh_empregados')
                .select('codigo_empresa, codigo_empregado, nome_empregado, situacao')
                .in('codigo_empresa', empresasEnvolvidas)
                .range(from, from + PAGE - 1);
            if (error) throw error;
            atuais = atuais.concat(data || []);
            if (!data || data.length < PAGE) break;
            from += PAGE;
        }
    }

    const atualMap = new Map();
    (atuais || []).forEach(e => atualMap.set(`${e.codigo_empresa}|${e.codigo_empregado}`, e));

    const novoKeys = new Set();
    const novos = [];
    const situacaoAlterada = [];
    linhas.forEach(r => {
        const chave = `${r.codigo_empresa}|${r.codigo_empregado}`;
        novoKeys.add(chave);
        const atual = atualMap.get(chave);
        if (!atual) {
            novos.push({ codigo_empresa: r.codigo_empresa, codigo_empregado: r.codigo_empregado, nome_empregado: r.nome_empregado });
        } else {
            const situacaoAntiga = (atual.situacao || '').trim();
            const situacaoNova = (r.situacao || '').trim();
            if (situacaoAntiga !== situacaoNova) {
                situacaoAlterada.push({
                    codigo_empresa: r.codigo_empresa,
                    codigo_empregado: r.codigo_empregado,
                    nome_empregado: r.nome_empregado,
                    situacaoAntiga: situacaoAntiga || '(vazio)',
                    situacaoNova: situacaoNova || '(vazio)',
                });
            }
        }
    });

    const sumidos = [];
    atualMap.forEach((e, chave) => {
        if (!novoKeys.has(chave)) {
            sumidos.push({
                codigo_empresa: e.codigo_empresa,
                codigo_empregado: e.codigo_empregado,
                nome_empregado: e.nome_empregado,
                situacaoAtual: (e.situacao || '').trim() || '(vazio)',
            });
        }
    });

    return { novos, situacaoAlterada, sumidos, empresasEnvolvidas };
}

function _linhaComparacaoEmpregados(item, extraHtml) {
    return `
        <div style="padding:6px 10px;border-bottom:1px solid #f2f2f2;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <span><strong>${item.codigo_empregado}</strong> - ${item.nome_empregado} <span style="color:#999;">(${item.codigo_empresa})</span></span>
            ${extraHtml || ''}
        </div>`;
}

function _secaoComparacaoEmpregados(titulo, cor, itens, montarExtra) {
    if (!itens.length) return '';
    return `
        <details open style="margin-bottom:12px;">
            <summary style="cursor:pointer;font-weight:700;color:${cor};font-size:13px;">${titulo} (${itens.length})</summary>
            <div style="max-height:220px;overflow-y:auto;margin-top:8px;border:1px solid #eee;border-radius:6px;">
                ${itens.map(item => _linhaComparacaoEmpregados(item, montarExtra ? montarExtra(item) : '')).join('')}
            </div>
        </details>`;
}

function _mostrarModalComparacaoEmpregados(comparacao) {
    return new Promise(resolve => {
        const modal = document.getElementById('modalComparacaoEmpregados');
        const conteudo = document.getElementById('comparacaoEmpregadosConteudo');
        conteudo.innerHTML = [
            _secaoComparacaoEmpregados('🆕 Novos', '#1E8449', comparacao.novos),
            _secaoComparacaoEmpregados('🔄 Situação alterada', '#B8860B', comparacao.situacaoAlterada,
                item => `<span style="color:#B8860B;white-space:nowrap;">${item.situacaoAntiga} → ${item.situacaoNova}</span>`),
            _secaoComparacaoEmpregados('⚠️ Sumiram da lista', '#C0392B', comparacao.sumidos,
                item => `<span style="color:#999;white-space:nowrap;">situação atual: ${item.situacaoAtual}</span>`),
        ].join('');

        const fechar = resultado => { modal.style.display = 'none'; resolve(resultado); };
        document.getElementById('comparacaoBtnCancelar').onclick  = () => fechar(false);
        document.getElementById('comparacaoBtnContinuar').onclick = () => fechar(true);
        modal.style.display = 'flex';
    });
}

// ── PENDÊNCIA DE CONFIGURAÇÃO (ESCALA/VT-VA) PARA EMPREGADOS NOVOS ──
// Hand-off pro Controle de Frequência (index.html), que tem as telas de
// Escala e Valores VT/VA. Mesmo padrão de localStorage já usado pra
// timestamps de importação — sem tabela nova.

const _PENDENTES_CONFIG_NOVOS_KEY = 'rh_pendentes_config_novos';

function _salvarPendentesConfigNovos(novos) {
    let atuais = [];
    try { atuais = JSON.parse(localStorage.getItem(_PENDENTES_CONFIG_NOVOS_KEY) || '[]'); } catch (_) { atuais = []; }
    if (!Array.isArray(atuais)) atuais = [];

    const chaves = new Set(atuais.map(p => `${p.codigo_empresa}|${p.codigo_empregado}`));
    const agora = new Date().toISOString();
    novos.forEach(n => {
        const chave = `${n.codigo_empresa}|${n.codigo_empregado}`;
        if (!chaves.has(chave)) {
            atuais.push({ codigo_empresa: n.codigo_empresa, codigo_empregado: n.codigo_empregado, nome_empregado: n.nome_empregado, criado_em: agora });
            chaves.add(chave);
        }
    });
    localStorage.setItem(_PENDENTES_CONFIG_NOVOS_KEY, JSON.stringify(atuais));
}

function _renderizarResumoImportacaoEmpregados(comparacao) {
    const container = document.getElementById('resumoImportarEmpregados');
    if (!container) return;

    let html = '';
    if (comparacao.novos.length > 0) {
        html += `
            <div style="margin-top:8px;padding:10px 12px;background:#EAF7EE;border-left:3px solid #27AE60;border-radius:4px;">
                🆕 <strong>${comparacao.novos.length} empregado(s) novo(s)</strong> precisam de configuração de escala e valores de VT/VA.
                <div style="margin-top:6px;">
                    <a href="index.html" style="display:inline-block;padding:6px 12px;background:#27AE60;color:white;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px;">Configurar agora →</a>
                </div>
            </div>`;
    }
    if (comparacao.situacaoAlterada.length > 0 || comparacao.sumidos.length > 0) {
        const partes = [];
        if (comparacao.situacaoAlterada.length) partes.push(`🔄 ${comparacao.situacaoAlterada.length} com situação alterada`);
        if (comparacao.sumidos.length) partes.push(`⚠️ ${comparacao.sumidos.length} sumiram da lista`);
        html += `<div style="margin-top:8px;">${partes.join(' · ')}</div>`;
    }
    container.innerHTML = html;
}

// ── RUBRICAS ──────────────────────────────────────────────────

function baixarModeloRubricas() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['Cód. Empresa', 'Empresa', 'Cód. Rubrica', 'Descrição Rubrica', 'Tipo'],
    ]);
    ws['!cols'] = [14, 30, 14, 35, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Rubricas');
    XLSX.writeFile(wb, 'modelo_rubricas.xlsx');
}

function handleImportarRubricas(event) {
    const file = event.target.files?.[0];
    if (file) importarRubricasIndividual(file);
}

async function importarRubricasIndividual(file) {
    const ENT = 'Rubricas';
    // Pode vir de dois inputs diferentes (aba Importar ou aba Rubricas)
    const statusEl = document.getElementById('statusImportarRubricasTab');
    const setStatus = (msg, tipo) => {
        setStatusImport(ENT, msg, tipo);
        if (statusEl) { statusEl.textContent = msg; statusEl.className = 'status-message ' + tipo; statusEl.style.display = msg ? 'block' : 'none'; }
    };
    try {
        setStatus('Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const cols = ['codigo_empresa','empresa','codigo_rubrica','descricao_rubrica','tipo'];
        const rows = (await lerPlanilha(file, cols))
            .filter(r => r.codigo_empresa && r.codigo_rubrica)
            .map(r => ({
                codigo_empresa:    String(r.codigo_empresa || '').trim(),
                empresa:           String(r.empresa || '').trim() || null,
                codigo_rubrica:    String(r.codigo_rubrica || '').trim(),
                descricao_rubrica: String(r.descricao_rubrica || '').trim() || null,
                tipo:              String(r.tipo || '').trim() || null,
            }));

        if (!rows.length) throw new Error('Nenhuma linha válida. Verifique se o arquivo segue o modelo.');

        const modo = await confirmarModoImportacao('Rubricas', rows.length);
        if (!modo) { setStatus('', ''); setProgresso(ENT, null); return; }

        setProgresso(ENT, 50);
        setStatus(`Salvando ${rows.length} rubrica(s)...`, 'info');

        if (modo === 'substituir') {
            const codigos = [...new Set(rows.map(r => r.codigo_empresa))];
            const { error: delErr } = await supabaseClient.from('rh_rubricas').delete().in('codigo_empresa', codigos);
            if (delErr) throw delErr;
            const { error } = await supabaseClient.from('rh_rubricas').insert(rows);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('rh_rubricas').upsert(rows, { onConflict: 'codigo_empresa,codigo_rubrica' });
            if (error) throw error;
        }

        setProgresso(ENT, null);
        setStatus(`✅ ${rows.length} rubrica(s) importada(s) com sucesso!`, 'success');
        _salvarTimestampImportacao('Rubricas');
        carregarRubricas();
    } catch (err) {
        setProgresso(ENT, null);
        setStatus('❌ ' + err.message, 'error');
    } finally {
        limparInput('fileRubricas');
        limparInput('fileRubricasTab');
    }
}

// ── SÓCIOS (PDF) ──────────────────────────────────────────────

function handleImportarSocios(event) {
    const file = event.target.files?.[0];
    if (file) processarPdfSocios(file);
}

async function processarPdfSocios(file) {
    const ENT = 'Socios';
    const resumo = document.getElementById('resumoImportarSocios');
    if (resumo) resumo.innerHTML = '';
    try {
        setStatusImport(ENT, 'Lendo o PDF "Sócios Vinculados nas Empresas"...', 'info');
        setProgresso(ENT, 10);

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        let todasLinhas = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            todasLinhas = todasLinhas.concat(_reconstruirLinhasPagina(content.items));
            setProgresso(ENT, 10 + Math.round((p / pdf.numPages) * 40));
        }

        const { registros, avisos } = _parsearLinhasSocios(todasLinhas);

        if (registros.length === 0) {
            setProgresso(ENT, null);
            setStatusImport(ENT, 'Nenhum sócio foi reconhecido neste PDF. Verifique se o arquivo é o "Sócios Vinculados nas Empresas".', 'error');
            return;
        }

        setStatusImport(ENT, `Salvando ${registros.length} sócio(s)...`, 'info');
        setProgresso(ENT, 60);
        await _salvarSociosSnapshot(ENT, registros, avisos);
        setProgresso(ENT, null);
        _salvarTimestampImportacao('Socios');
        carregarSocios();
    } catch (erro) {
        console.error('Erro ao processar PDF de sócios:', erro);
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ Falha ao processar o PDF. Verifique se o arquivo é válido.', 'error');
    } finally {
        limparInput('fileSocios');
    }
}

async function _salvarSociosSnapshot(ENT, registros, avisos) {
    // Snapshot completo: o PDF traz todas as empresas de uma vez, então cada
    // importação substitui todo o conteúdo de rh_socios. Uma chave duplicada
    // (mesma empresa + nome do sócio) no próprio arquivo mantém a última.
    const porChave = new Map();
    let duplicatasNoArquivo = 0;
    for (const r of registros) {
        const chave = `${r.codigo_empresa}|${r.nome_socio}`;
        if (porChave.has(chave)) duplicatasNoArquivo++;
        porChave.set(chave, r);
    }
    const registrosParaSalvar = [...porChave.values()];

    const { error: errDelete } = await supabaseClient.from('rh_socios').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errDelete) {
        setStatusImport(ENT, 'Falha ao limpar os dados existentes antes de salvar.', 'error');
        return;
    }

    const LOTE = 500;
    for (let i = 0; i < registrosParaSalvar.length; i += LOTE) {
        const pedaco = registrosParaSalvar.slice(i, i + LOTE);
        const { error } = await supabaseClient.from('rh_socios').insert(pedaco);
        if (error) {
            console.error('Erro ao salvar sócios:', error);
            setStatusImport(ENT, `Falha ao salvar registros no banco: ${error.message}`, 'error');
            return;
        }
    }

    const empresas = new Set(registrosParaSalvar.map(r => r.codigo_empresa));
    setStatusImport(ENT, `✅ ${registrosParaSalvar.length} sócio(s) salvos em ${empresas.size} empresa(s)`, 'success');
    _renderizarResumoImportacaoSocios(registrosParaSalvar.length, empresas.size, duplicatasNoArquivo, avisos);
}

function _renderizarResumoImportacaoSocios(qtdSocios, qtdEmpresas, duplicatasNoArquivo, avisos) {
    const container = document.getElementById('resumoImportarSocios');
    if (!container) return;
    let html = `<div style="margin-top:8px;">${qtdSocios} sócio(s) em ${qtdEmpresas} empresa(s) — toda a tabela de sócios foi substituída pelo conteúdo do PDF.</div>`;

    if (duplicatasNoArquivo > 0) {
        html += `<div style="margin-top:6px;color:#92400e;">⚠️ ${duplicatasNoArquivo} linha(s) duplicada(s) no arquivo (mesma empresa/nome) — mantida a última ocorrência.</div>`;
    }

    if (avisos.length > 0) {
        html += `
            <details style="margin-top:8px;">
                <summary style="cursor:pointer; color:#92400e; font-weight:600;">⚠️ ${avisos.length} linha(s) não reconhecida(s) — cadastre manualmente</summary>
                <ul style="margin-top:6px; padding-left:18px; color:#78350f;">
                    ${avisos.map(a => `<li><strong>${a.motivo}:</strong> ${a.linha}</li>`).join('')}
                </ul>
            </details>
        `;
    }

    container.innerHTML = html;
}








async function processarArquivo(file) {
    try {
        mostrarStatus('statusImportar', 'Lendo arquivo...', 'info'); 
        document.getElementById('importProgress').style.display = 'block';
        
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        
        // ===== EMPRESAS =====
        const empresasSheet = workbook.Sheets['Empresas']; 
        if (!empresasSheet) throw new Error('Aba "Empresas" não encontrada');
        
        const empresasData = XLSX.utils.sheet_to_json(empresasSheet, { 
            header: ['codigo_empresa', 'nome_empresa'], 
            defval: '' 
        }).filter(row => row.codigo_empresa && row.nome_empresa)
         .map(row => ({
            codigo_empresa: String(row.codigo_empresa).trim(),
            nome_empresa: String(row.nome_empresa).trim()
        }));
        
        console.log('📊 Empresas lidas:', empresasData);
        
        // ===== EMPREGADOS =====
        const empregadosSheet = workbook.Sheets['Empregados']; 
        if (!empregadosSheet) throw new Error('Aba "Empregados" não encontrada');
        
        let empregadosData = XLSX.utils.sheet_to_json(empregadosSheet, { 
            header: ['codigo_empresa', 'codigo_empregado', 'nome_empregado'], 
            defval: '' 
        }).filter(row => row.codigo_empresa && row.codigo_empregado && row.nome_empregado)
         .map(row => ({
            codigo_empresa: String(row.codigo_empresa).trim(),
            codigo_empregado: String(row.codigo_empregado).trim(),
            nome_empregado: String(row.nome_empregado).trim()
        }));
        
        console.log('👥 Empregados lidos:', empregadosData);
        
        // VALIDAÇÃO: Verificar se todos os codigo_empresa dos empregados existem nas empresas
        const codigosEmpresasValidos = new Set(empresasData.map(e => e.codigo_empresa));
        const empregadosComErro = empregadosData.filter(emp => !codigosEmpresasValidos.has(emp.codigo_empresa));
        
        if (empregadosComErro.length > 0) {
            console.error('❌ Empregados com empresa inexistente:', empregadosComErro);
            
            // MENSAGEM DETALHADA COM NOME DO EMPREGADO
            const detalhesErro = empregadosComErro.map(e => 
                `\n🔴 Nome: ${e.nome_empregado}\n   Empresa: ${e.codigo_empresa}\n   Código: ${e.codigo_empregado}`
            ).join('\n');
            
            throw new Error(`❌ ERRO: ${empregadosComErro.length} empregado(s) com empresa inválida!\n\nDELETE ESSAS LINHAS DA ABA "EMPREGADOS":${detalhesErro}\n\nEssas linhas têm valores de placeholder (CÓDIGO DA EMPRESA, CODIGO DO EMPREGADO, etc) em vez de dados reais.`);
        }
        
        // VALIDAÇÃO: Remover duplicatas
        const empregadosUnicos = [];
        const chavesVistas = new Set();
        let duplicatasRemovidas = 0;
        
        empregadosData.forEach(row => {
            const chaveUnica = `${row.codigo_empresa}|${row.codigo_empregado}`;
            
            if (!chavesVistas.has(chaveUnica)) {
                chavesVistas.add(chaveUnica);
                empregadosUnicos.push(row);
            } else {
                duplicatasRemovidas++;
                console.warn(`⚠️ Duplicata removida: Empresa ${row.codigo_empresa}, Empregado ${row.codigo_empregado}`);
            }
        });
        
        // ===== RUBRICAS =====
        const rubricasSheet = workbook.Sheets['Rubricas'];
        let rubricasData = [];
        if (rubricasSheet) {
            rubricasData = XLSX.utils.sheet_to_json(rubricasSheet, {
                header: ['codigo_empresa','empresa','codigo_rubrica','descricao_rubrica','tipo'],
                defval: ''
            }).filter(row => row.codigo_empresa && row.codigo_rubrica)
             .map(row => ({
                codigo_empresa:    String(row.codigo_empresa).trim(),
                empresa:           String(row.empresa || '').trim() || null,
                codigo_rubrica:    String(row.codigo_rubrica).trim(),
                descricao_rubrica: String(row.descricao_rubrica || '').trim() || null,
                tipo:              String(row.tipo || '').trim() || null,
            }));
            
            console.log('📋 Rubricas lidas:', rubricasData);
        }
        
        // ===== LIMPEZA =====
        mostrarStatus('statusImportar', 'Limpando dados existentes...', 'info'); 
        document.getElementById('progressBar').style.width = '20%';
        
        await supabaseClient.from('rh_rubricas').delete().neq('id', 0);
        await supabaseClient.from('rh_empregados').delete().neq('id', 0);
        await supabaseClient.from('rh_empresas').delete().neq('id', 0);
        
        // ===== INSERÇÃO =====
        
        // 1. EMPRESAS
        mostrarStatus('statusImportar', 'Importando empresas...', 'info'); 
        document.getElementById('progressBar').style.width = '40%';
        
        if (empresasData.length > 0) { 
            const { error } = await supabaseClient.from('rh_empresas').insert(empresasData); 
            if (error) {
                console.error('❌ Erro ao inserir empresas:', error);
                throw error;
            }
        }
        
        // 2. EMPREGADOS
        mostrarStatus('statusImportar', 'Importando empregados...', 'info'); 
        document.getElementById('progressBar').style.width = '60%';
        
        if (empregadosUnicos.length > 0) { 
            console.log('📤 Enviando empregados:', empregadosUnicos);
            const { error } = await supabaseClient.from('rh_empregados').insert(empregadosUnicos); 
            if (error) {
                console.error('❌ Erro ao inserir empregados:', error);
                console.error('Dados que causaram erro:', empregadosUnicos);
                throw error;
            }
        }
        
        // 3. RUBRICAS
        mostrarStatus('statusImportar', 'Importando rubricas...', 'info'); 
        document.getElementById('progressBar').style.width = '80%';
        
        if (rubricasData.length > 0) { 
            const { error } = await supabaseClient.from('rh_rubricas').insert(rubricasData); 
            if (error) {
                console.error('❌ Erro ao inserir rubricas:', error);
                throw error;
            }
        }
        
        // ===== SUCESSO =====
        document.getElementById('progressBar').style.width = '100%';
        
        setTimeout(() => {
            document.getElementById('importProgress').style.display = 'none';
            
            const mensagem = `✅ Importação concluída!\n` +
                `${empresasData.length} empresas\n` +
                `${empregadosUnicos.length} empregados${duplicatasRemovidas > 0 ? ` (${duplicatasRemovidas} duplicatas removidas)` : ''}\n` +
                `${rubricasData.length} rubricas`;
            
            mostrarStatus('statusImportar', mensagem, 'success');
            
            carregarEmpresas(); 
            carregarEmpregados(); 
            carregarRubricas(); 
            
            document.getElementById('fileInput').value = '';
        }, 1000);
        
    } catch (erro) { 
        document.getElementById('importProgress').style.display = 'none'; 
        console.error('🔴 ERRO COMPLETO:', erro);
        mostrarStatus('statusImportar', '❌ Erro ao importar: ' + erro.message, 'error'); 
    }
}












// --- UTILITÁRIOS ---

function mostrarStatus(elementId, mensagem, tipo) { 
    const el = document.getElementById(elementId); 
    el.textContent = mensagem; 
    el.className = 'status-message ' + tipo; 
}

function mostrarMensagem(titulo, mensagem) { 
    document.getElementById('messageTitle').textContent = titulo; 
    document.getElementById('messageText').textContent = mensagem; 
    document.getElementById('messageModal').classList.add('active'); 
}

function fecharModalMensagem() { 
    document.getElementById('messageModal').classList.remove('active'); 
}