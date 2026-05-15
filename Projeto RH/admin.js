/**
 * SCONT - Painel de Administração
 * Arquivo: admin.js
 */

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via admin.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    carregarEmpresas();
    carregarEmpregados();
    carregarRubricas();
    carregarRegras();
    carregarMapeamentos();
    configurarUpload();
});

// --- NAVEGAÇÃO DE ABAS ---

function abrirAba(abaId) {
    document.querySelectorAll('.admin-tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(abaId).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
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
        _todasEmpresas = data || [];
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
            <td><button type="button" class="btn-delete" onclick="deletarEmpresa('${e.codigo_empresa}')">🗑</button></td>
        </tr>`;
    });

    paginacao.innerHTML = totalPags <= 1 ? '' : `
        <button onclick="mudarPaginaEmpresas(${_paginaEmpresas - 1})" ${_paginaEmpresas === 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="pag-info">Página <strong>${_paginaEmpresas}</strong> de <strong>${totalPags}</strong> — ${_empresasFiltradas.length} empresa(s)</span>
        <button onclick="mudarPaginaEmpresas(${_paginaEmpresas + 1})" ${_paginaEmpresas === totalPags ? 'disabled' : ''}>Próxima ›</button>
    `;
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

// --- EMPREGADOS ---

let _todosEmpregados = [];
let _empregadosFiltrados = [];
let _paginaEmpregados = 1;
const _porPaginaEmpregados = 50;

const _COLS_DEFAULT_EMP = ['codigo_empresa','codigo_empregado','nome_empregado','data_admissao','situacao','cpf'];
let _colsSelecionadas = new Set(_COLS_DEFAULT_EMP);
let _empresasSelecionadas = new Set(); // vazio = todas

const _TODAS_SITUACOES = [
    'Trabalhando','Demitido','Doença período superior a 15 dias',
    'Aposent. por invalid. exceto acid. trab. e doença profissional',
    'Aposent. por invalid. doença profissional','Novo afast. mesma doença'
];
let _situacoesSelecionadas = new Set(_TODAS_SITUACOES);

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
    { nome: 'Conselho', cols: ['nome_conselho','numero_conselho','expedicao_conselho','validade_conselho'] },
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
        _todosEmpregados = todos;
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
    else _colsSelecionadas.delete(cb.value);
    renderizarTabelaEmpregados();
}

function selecionarTodosCampos(marcar) {
    if (marcar) {
        _colsSelecionadas = new Set(_COLS_EMPREGADOS);
    } else {
        _colsSelecionadas = new Set(['codigo_empresa','codigo_empregado','nome_empregado']);
    }
    document.querySelectorAll('#camposSeletorEmp input[type=checkbox]').forEach(cb => {
        cb.checked = _colsSelecionadas.has(cb.value);
    });
    renderizarTabelaEmpregados();
}

function filtrarEmpregados() {
    const nome = (document.getElementById('filtroNomeEmp')?.value || '').toLowerCase().trim();
    const tipoEmp = document.getElementById('filtroTipoEmp')?.value || '';
    const totalEmpresas = document.querySelectorAll('#filtroEmpresaEmp input[type=checkbox]').length;
    const todasMarcadas = _empresasSelecionadas.size === totalEmpresas;
    const todasSituacoes = _situacoesSelecionadas.size === _TODAS_SITUACOES.length;
    _empregadosFiltrados = _todosEmpregados.filter(e => {
        if (!todasMarcadas && !_empresasSelecionadas.has(e.codigo_empresa)) return false;
        if (nome && !((e.nome_empregado || '').toLowerCase().includes(nome) || (e.codigo_empregado || '').toLowerCase().includes(nome))) return false;
        if (!todasSituacoes && _situacoesSelecionadas.size > 0 && !_situacoesSelecionadas.has(e.situacao || '')) return false;
        if (_situacoesSelecionadas.size === 0) return false;
        if (tipoEmp && (e.tipo_empregado || '') !== tipoEmp) return false;
        return true;
    });
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
        const ths = colsAtivas.map(c => `<th title="${_headerParaCol(c)}">${_headerParaCol(c)}</th>`).join('');
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
        return `<tr>${cells}<td><button type="button" class="btn-delete" onclick="deletarEmpregado(${e.id})">🗑</button></td></tr>`;
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

    @page { size: ${muitasCols ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }
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

async function deletarEmpregado(id) {
    if (!confirm('Tem certeza que deseja deletar este empregado?')) return;
    try {
        const { error } = await supabaseClient.from('rh_empregados').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusEmpregados', '✅ Empregado deletado com sucesso!', 'success');
        carregarEmpregados();
    } catch (erro) { mostrarStatus('statusEmpregados', 'Erro ao deletar empregado: ' + erro.message, 'error'); }
}

// --- RUBRICAS ---

const nomesEventos = {
    'horasTrabalhadas': 'Horas Trabalhadas',
    'horasExtras50': 'Horas Extras 50%',
    'horasExtras100': 'Horas Extras 100%',
    'horasNoturnaConvertida': 'Horas Noturnas Convertidas',
    'horasDevidas': 'Horas Devidas (Faltas/Atrasos)'
};

async function carregarRubricas() {
    try {
        const { data, error } = await supabaseClient.from('rh_rubricas').select('*').order('codigo_empresa', { ascending: true });
        if (error) throw error;
        renderizarTabelaRubricas(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar rubricas.'); }
}

function renderizarTabelaRubricas(rubricas) {
    const tbody = document.getElementById('rubricasTableBody');
    tbody.innerHTML = '';
    if (rubricas.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #95A5A6;">Nenhuma rubrica cadastrada</td></tr>'; return; }
    rubricas.forEach(rubrica => {
        const nomeEvento = nomesEventos[rubrica.evento] || rubrica.evento;
        tbody.innerHTML += `<tr><td><strong>${rubrica.codigo_empresa}</strong></td><td>${nomeEvento}</td><td>${rubrica.codigo_rubrica}</td><td><button type="button" class="btn-delete" onclick="deletarRubrica(${rubrica.id})">Deletar</button></td></tr>`;
    });
}

async function adicionarRubrica() {
    const codigoEmpresa = document.getElementById('rubricaEmpresaSelect').value;
    const evento = document.getElementById('rubricaEventoSelect').value;
    const codigoRubrica = document.getElementById('codigoRubrica').value.trim();
    
    if (!codigoEmpresa || !evento || !codigoRubrica) { mostrarStatus('statusRubricas', 'Preencha todos os campos', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_rubricas').upsert([{ 
            codigo_empresa: codigoEmpresa, 
            evento: evento, 
            codigo_rubrica: codigoRubrica 
        }], { onConflict: 'codigo_empresa, evento' });
        
        if (error) throw error;
        
        document.getElementById('codigoRubrica').value = '';
        mostrarStatus('statusRubricas', '✅ Rubrica salva com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao salvar rubrica: ' + erro.message, 'error'); }
}

async function deletarRubrica(id) {
    if (!confirm('Tem certeza que deseja deletar esta rubrica?')) return;
    try {
        const { error } = await supabaseClient.from('rh_rubricas').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRubricas', '✅ Rubrica deletada com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao deletar rubrica: ' + erro.message, 'error'); }
}

// --- REGRAS DE RENOMEAÇÃO ---

async function carregarRegras() {
    try {
        const { data, error } = await supabaseClient.from('rh_regras_renomeacao').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        renderizarTabelaRegras(data || []);
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
            <td><button type="button" class="btn-delete" onclick="deletarRegra(${regra.id})">Deletar</button></td>
        </tr>`;
    });
}

async function adicionarRegra() {
    const padraoDe = document.getElementById('padraoDe').value.trim();
    const padraoPara = document.getElementById('padraoPara').value.trim();
    
    if (!padraoDe || !padraoPara) { mostrarStatus('statusRegras', 'Preencha ambos os padrões.', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_regras_renomeacao').insert([{ padrao_de: padraoDe, padrao_para: padraoPara }]);
        if (error) throw error;
        
        document.getElementById('padraoDe').value = '';
        document.getElementById('padraoPara').value = '';
        mostrarStatus('statusRegras', '✅ Regra salva com sucesso!', 'success');
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar regra: ' + erro.message, 'error'); }
}

async function deletarRegra(id) {
    if (!confirm('Tem certeza que deseja deletar esta regra?')) return;
    try {
        const { error } = await supabaseClient.from('rh_regras_renomeacao').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRegras', '✅ Regra deletada com sucesso!', 'success');
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar regra: ' + erro.message, 'error'); }
}

// --- MAPEAMENTO DE NOMES DE DOCUMENTOS ---

async function carregarMapeamentos() {
    try {
        const { data, error } = await supabaseClient.from('rh_mapeamento_nomes').select('*').order('nome_arquivo', { ascending: true });
        if (error) throw error;
        renderizarTabelaMapeamentos(data || []);
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
            <td><button type="button" class="btn-delete" onclick="deletarMapeamento(${map.id})">Deletar</button></td>
        </tr>`;
    });
}

async function adicionarMapeamento() {
    const nomeArquivo = document.getElementById('mapNomeArquivo').value.trim();
    const nomeDocumento = document.getElementById('mapNomeDocumento').value.trim();
    
    if (!nomeArquivo || !nomeDocumento) { mostrarStatus('statusRegras', 'Preencha ambos os campos do mapeamento.', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_mapeamento_nomes').upsert([{ 
            nome_arquivo: nomeArquivo, 
            nome_documento: nomeDocumento 
        }], { onConflict: 'nome_arquivo' });
        
        if (error) throw error;
        
        document.getElementById('mapNomeArquivo').value = '';
        document.getElementById('mapNomeDocumento').value = '';
        mostrarStatus('statusRegras', '✅ Mapeamento salvo com sucesso!', 'success');
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar mapeamento: ' + erro.message, 'error'); }
}

async function deletarMapeamento(id) {
    if (!confirm('Tem certeza que deseja deletar este mapeamento?')) return;
    try {
        const { error } = await supabaseClient.from('rh_mapeamento_nomes').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRegras', '✅ Mapeamento deletado com sucesso!', 'success');
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar mapeamento: ' + erro.message, 'error'); }
}

// --- IMPORTAÇÃO DE DADOS (EXCEL) ---

function configurarUpload() {
    const uploadArea = document.getElementById('uploadArea');
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

function lerPlanilha(file, colunas) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: colunas, defval: '', range: 1 });
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

function baixarModeloEmpresas() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[
        'Cód.', 'Empresa', 'CNPJ', 'Regime Enquadramento',
        'Inscrição Estadual', 'Inscrição Municipal', 'Municipio',
        'Status/Situação', 'Data de Cadastro', 'Endereço', 'CEP', 'Cidade'
    ]]);
    ws['!cols'] = [8,30,18,22,18,18,20,14,16,30,10,20].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    XLSX.writeFile(wb, 'modelo_empresas.xlsx');
}

// ── MODAL MODO IMPORTAÇÃO ─────────────────────────────────────

function confirmarModoImportacao(entidade, qtd) {
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

function handleImportarEmpresas(event) {
    const file = event.target.files?.[0];
    if (file) importarEmpresas(file);
}

async function importarEmpresas(file) {
    const ENT = 'Empresas';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const colunas = ['codigo_empresa','nome_empresa','cnpj','regime_enquadramento',
                         'inscricao_estadual','inscricao_municipal','municipio',
                         'status_situacao','data_cadastro','endereco','cep','cidade'];

        const rows = (await lerPlanilha(file, colunas))
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
            }));

        if (!rows.length) throw new Error('Nenhuma linha válida encontrada. Verifique se o arquivo segue o modelo.');

        const modo = await confirmarModoImportacao('Empresas', rows.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

        setProgresso(ENT, 50);
        setStatusImport(ENT, `Salvando ${rows.length} empresa(s)...`, 'info');

        if (modo === 'substituir') {
            const codigos = [...new Set(rows.map(r => r.codigo_empresa))];
            const { error: delErr } = await supabaseClient.from('rh_empresas').delete().in('codigo_empresa', codigos);
            if (delErr) throw delErr;
            const { error } = await supabaseClient.from('rh_empresas').insert(rows);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('rh_empresas').upsert(rows, { onConflict: 'codigo_empresa' });
            if (error) throw error;
        }

        setProgresso(ENT, null);
        setStatusImport(ENT, `✅ ${rows.length} empresa(s) importada(s) com sucesso!`, 'success');
        carregarEmpresas();
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileEmpresas');
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
    'nome_conselho','numero_conselho','expedicao_conselho','validade_conselho',
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
    'Nome Conselho','Numero Conselho','Expedição Conselho','Validade Conselho',
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
    'expedicao_ctps','data_demissao','expedicao_conselho','validade_conselho',
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

function handleImportarEmpregados(event) {
    const file = event.target.files?.[0];
    if (file) importarEmpregadosIndividual(file);
}

async function importarEmpregadosIndividual(file) {
    const ENT = 'Empregados';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const raw = await lerPlanilha(file, _COLS_EMPREGADOS);

        if (!raw.length) throw new Error('Arquivo vazio ou sem dados reconhecíveis.');

        // Mostra o modal com total bruto do arquivo
        const modo = await confirmarModoImportacao('Empregados', raw.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

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
        carregarEmpregados();
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileEmpregados');
    }
}

// ── RUBRICAS ──────────────────────────────────────────────────

function baixarModeloRubricas() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['Cód. Empresa', 'Cód. Rubrica', 'Evento'],
        ['', '', 'horasTrabalhadas'],
        ['', '', 'horasExtras50'],
        ['', '', 'horasExtras100'],
        ['', '', 'horasNoturnaConvertida'],
        ['', '', 'horasDevidas'],
    ]);
    ws['!cols'] = [14, 14, 24].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Rubricas');
    XLSX.writeFile(wb, 'modelo_rubricas.xlsx');
}

function handleImportarRubricas(event) {
    const file = event.target.files?.[0];
    if (file) importarRubricasIndividual(file);
}

async function importarRubricasIndividual(file) {
    const ENT = 'Rubricas';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const rows = (await lerPlanilha(file, ['codigo_empresa','codigo_rubrica','evento']))
            .filter(r => r.codigo_empresa && r.codigo_rubrica && r.evento)
            .map(r => ({
                codigo_empresa:  String(r.codigo_empresa).trim(),
                codigo_rubrica:  String(r.codigo_rubrica).trim(),
                evento:          String(r.evento).trim(),
            }));

        if (!rows.length) throw new Error('Nenhuma linha válida encontrada. Verifique se o arquivo segue o modelo.');

        const modo = await confirmarModoImportacao('Rubricas', rows.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

        setProgresso(ENT, 50);
        setStatusImport(ENT, `Salvando ${rows.length} rubrica(s)...`, 'info');

        if (modo === 'substituir') {
            const codigos = [...new Set(rows.map(r => r.codigo_empresa))];
            const { error: delErr } = await supabaseClient.from('rh_rubricas').delete().in('codigo_empresa', codigos);
            if (delErr) throw delErr;
            const { error } = await supabaseClient.from('rh_rubricas').insert(rows);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('rh_rubricas').upsert(rows, { onConflict: 'codigo_empresa,evento' });
            if (error) throw error;
        }

        setProgresso(ENT, null);
        setStatusImport(ENT, `✅ ${rows.length} rubrica(s) importada(s) com sucesso!`, 'success');
        carregarRubricas();
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileRubricas');
    }
}

// ── SÓCIOS ────────────────────────────────────────────────────

function baixarModeloSocios() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[
        'Cód. Empresa', 'Nome do Sócio', 'CPF', 'Participação (%)', 'Cargo', 'Data de Entrada'
    ]]);
    ws['!cols'] = [14, 35, 14, 14, 20, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Socios');
    XLSX.writeFile(wb, 'modelo_socios.xlsx');
}

function handleImportarSocios(event) {
    const file = event.target.files?.[0];
    if (file) importarSocios(file);
}

async function importarSocios(file) {
    const ENT = 'Socios';
    try {
        setStatusImport(ENT, 'Lendo arquivo...', 'info');
        setProgresso(ENT, 10);

        const rows = (await lerPlanilha(file, ['codigo_empresa','nome_socio','cpf','participacao','cargo','data_entrada']))
            .filter(r => r.codigo_empresa && r.nome_socio)
            .map(r => ({
                codigo_empresa: String(r.codigo_empresa).trim(),
                nome_socio:     String(r.nome_socio).trim(),
                cpf:            r.cpf ? String(r.cpf).trim() : null,
                participacao:   r.participacao !== '' ? parseFloat(String(r.participacao).replace(',', '.')) || null : null,
                cargo:          r.cargo ? String(r.cargo).trim() : null,
                data_entrada:   r.data_entrada instanceof Date
                                    ? r.data_entrada.toISOString().split('T')[0]
                                    : (r.data_entrada ? String(r.data_entrada).trim() : null),
            }));

        if (!rows.length) throw new Error('Nenhuma linha válida encontrada. Verifique se o arquivo segue o modelo.');

        const modo = await confirmarModoImportacao('Sócios', rows.length);
        if (!modo) { setStatusImport(ENT, '', ''); setProgresso(ENT, null); return; }

        setProgresso(ENT, 50);
        setStatusImport(ENT, `Salvando ${rows.length} sócio(s)...`, 'info');

        if (modo === 'substituir') {
            const codigos = [...new Set(rows.map(r => r.codigo_empresa))];
            const { error: delErr } = await supabaseClient.from('rh_socios').delete().in('codigo_empresa', codigos);
            if (delErr) throw delErr;
            const { error } = await supabaseClient.from('rh_socios').insert(rows);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('rh_socios').upsert(rows, { onConflict: 'codigo_empresa,nome_socio' });
            if (error) throw error;
        }

        setProgresso(ENT, null);
        setStatusImport(ENT, `✅ ${rows.length} sócio(s) importado(s) com sucesso!`, 'success');
    } catch (err) {
        setProgresso(ENT, null);
        setStatusImport(ENT, '❌ ' + err.message, 'error');
    } finally {
        limparInput('fileSocios');
    }
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
                header: ['codigo_empresa', 'codigo_rubrica', 'evento'], 
                defval: '' 
            }).filter(row => row.codigo_empresa && row.codigo_rubrica && row.evento)
             .map(row => ({
                codigo_empresa: String(row.codigo_empresa).trim(),
                codigo_rubrica: String(row.codigo_rubrica).trim(),
                evento: String(row.evento).trim()
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