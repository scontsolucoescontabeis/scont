// ===== STATE =====
const state = {
    sb: null,
    empresa: null,        // { codigo_empresa, nome_empresa }
    competencia: '',
    empregados: [],       // [{ codigo_empregado, nome_empregado }]
    headers: [],          // string[] — labels das colunas extraídas
    rawRows: [],          // Record<string,string>[] — dados da tabela editável
    mapping: { data: '', entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '' },
    terceiroTurno: false,
    empregado: null,      // { codigo_empregado, nome_empregado } | null
    codigoManual: ''
};

// ===== HELPERS =====
function mostrarMsg(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'msg-box ' + tipo;
    el.textContent = texto;
}
function ocultarMsg(elId) {
    const el = document.getElementById(elId);
    if (el) { el.className = 'msg-box'; el.textContent = ''; }
}

function mostrarEtapa(n) {
    document.querySelectorAll('.wizard-pane').forEach(p => p.classList.remove('ativo'));
    document.querySelectorAll('.wizard-step').forEach((s, i) => {
        s.classList.remove('ativo', 'feito');
        if (i + 1 < n) s.classList.add('feito');
        if (i + 1 === n) s.classList.add('ativo');
    });
    const pane = document.getElementById('step' + n);
    if (pane) pane.classList.add('ativo');
}

// ===== INIT =====
function init() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    state.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    carregarEmpresas();
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaEmpresa') && !e.target.closest('#listaEmpresas'))
            document.getElementById('listaEmpresas').style.display = 'none';
    });
}

// ===== ETAPA 1 — EMPRESA + COMPETÊNCIA =====
async function carregarEmpresas() {
    try {
        const { data, error } = await state.sb
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state._todasEmpresas = data || [];
    } catch (e) {
        mostrarMsg('msgStep2', 'erro', 'Erro ao carregar empresas: ' + e.message);
    }
}

window.filtrarEmpresas = function(termo) {
    const lista = document.getElementById('listaEmpresas');
    const norm = termo.trim().toLowerCase();
    const todas = state._todasEmpresas || [];
    const filtradas = norm
        ? todas.filter(e => e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
        : todas;
    if (!filtradas.length) { lista.style.display = 'none'; return; }
    lista.innerHTML = filtradas.map(e =>
        `<div class="autocomplete-item" onclick="selecionarEmpresa('${e.codigo_empresa}','${e.nome_empresa.replace(/'/g,"\\'")}')">
            <strong>${e.codigo_empresa}</strong> — ${e.nome_empresa}
         </div>`
    ).join('');
    lista.style.display = 'block';
};

window.selecionarEmpresa = async function(codigo, nome) {
    state.empresa = { codigo_empresa: codigo, nome_empresa: nome };
    document.getElementById('buscaEmpresa').value = `${codigo} — ${nome}`;
    document.getElementById('codigoEmpresaHidden').value = codigo;
    document.getElementById('listaEmpresas').style.display = 'none';
    atualizarBotaoProximo1();
    await carregarEmpregados(codigo);
};

async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await state.sb
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregados = data || [];
    } catch (e) {
        console.warn('Erro ao carregar empregados:', e.message);
    }
}

window.formatarCompetenciaInput = function(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
    el.value = v;
    state.competencia = el.value;
    atualizarBotaoProximo1();
};

function atualizarBotaoProximo1() {
    const ok = state.empresa && /^(0[1-9]|1[0-2])\/\d{4}$/.test(state.competencia);
    document.getElementById('btnProximo1').disabled = !ok;
}

window.avancarEtapa2 = function() {
    mostrarEtapa(2);
};

// ===== ETAPA 2 — UPLOAD + ROTEAMENTO =====
window.handleArquivo = async function(file) {
    if (!file) return;
    ocultarMsg('msgStep2');
    mostrarProgresso(5, 'Detectando tipo do arquivo...');

    try {
        const tipo = detectarTipo(file);
        let resultado;

        if (tipo === 'excel') {
            mostrarProgresso(30, 'Lendo planilha...');
            resultado = await extrairExcel(file);
        } else if (tipo === 'pdf') {
            mostrarProgresso(20, 'Lendo PDF...');
            resultado = await extrairPdf(file);
        } else if (tipo === 'imagem') {
            mostrarProgresso(20, 'Iniciando OCR (pode levar alguns segundos)...');
            resultado = await extrairImagem(file);
        } else {
            throw new Error('Formato não suportado: ' + file.name);
        }

        state.headers = resultado.headers;
        state.rawRows = resultado.rows;

        if (!state.rawRows.length) {
            ocultarProgresso();
            mostrarMsg('msgStep2', 'aviso', 'Nenhum dado detectado no arquivo. Verifique se o arquivo está correto.');
            return;
        }

        ocultarProgresso();
        mostrarEtapa(3);
        renderizarTabela();
    } catch (e) {
        ocultarProgresso();
        mostrarMsg('msgStep2', 'erro', 'Erro ao processar arquivo: ' + e.message);
        console.error(e);
    }
};

function detectarTipo(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'imagem';
    return 'desconhecido';
}

function mostrarProgresso(pct, label) {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'block';
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    const lbl = document.getElementById('progressLabel');
    if (lbl) lbl.textContent = label || 'Processando...';
}

function ocultarProgresso() {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'none';
}

// Stubs — substituídos nas Tasks 4, 5, 6
async function extrairExcel(file) { return { headers: [], rows: [] }; }
async function extrairPdf(file)   { return { headers: [], rows: [] }; }
async function extrairImagem(file){ return { headers: [], rows: [] }; }
