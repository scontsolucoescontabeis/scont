// ===== STATE =====
const state = {
    sb: null,
    empresa: null,          // { codigo_empresa, nome_empresa }
    competencia: '',
    competenciaAutoDetectada: false,
    empregados: [],         // [{ codigo_empregado, nome_empregado }] da empresa selecionada
    colaboradoresPdf: [],   // [{ nome, cpf, admissao, funcao, codigo, competencia, dias:[...] }]
    vinculos: [],           // paralelo a colaboradoresPdf: { empregado: {codigo_empregado,nome_empregado}|null, ignorar: bool }
    terceiroTurno: false,
    abaAtivaEtapa4: 0
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

// ===== INIT =====
function init() {
    state.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    carregarEmpresas();
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaEmpresa') && !e.target.closest('#listaEmpresas')) {
            const lista = document.getElementById('listaEmpresas');
            if (lista) lista.style.display = 'none';
        }
    });
}

// ===== ETAPA 1 — UPLOAD + PARSING =====
window.handleArquivo = async function(file) {
    if (!file) return;
    ocultarMsg('msgStep1');

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        mostrarMsg('msgStep1', 'erro', 'Selecione um arquivo .pdf.');
        return;
    }

    mostrarProgresso(5, 'Lendo PDF...');

    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

        const paginasTexto = [];
        const colaboradores = [];
        const anoFallback = new Date().getFullYear();

        for (let p = 1; p <= pdf.numPages; p++) {
            mostrarProgresso(5 + Math.round((p / pdf.numPages) * 85), `Lendo página ${p}/${pdf.numPages}...`);
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const linhas = _linhasDaPagina(content.items);
            paginasTexto.push(linhas.join('\n'));
        }

        const textoCompleto = paginasTexto.join('\n');
        if (!_pareceSolides(textoCompleto)) {
            ocultarProgresso();
            mostrarMsg('msgStep1', 'erro', 'Arquivo não reconhecido como Folha de Ponto do Sólides. Verifique se o PDF é o export correto (uma página por colaborador, com as seções "DADOS DO COLABORADOR" e "PONTOS").');
            return;
        }

        for (let p = 0; p < pdf.numPages; p++) {
            const page = await pdf.getPage(p + 1);
            const content = await page.getTextContent();
            const colaborador = _parsearPaginaColaborador(content.items, anoFallback);
            if (colaborador.nome) colaboradores.push(colaborador);
        }

        if (!colaboradores.length) {
            ocultarProgresso();
            mostrarMsg('msgStep1', 'aviso', 'Nenhum colaborador foi reconhecido neste PDF.');
            return;
        }

        state.colaboradoresPdf = colaboradores;

        const comColaboradorComCompetencia = colaboradores.find(c => c.competencia);
        const competenciaExtraida = comColaboradorComCompetencia ? comColaboradorComCompetencia.competencia : '';
        if (competenciaExtraida) {
            state.competencia = competenciaExtraida;
            state.competenciaAutoDetectada = true;
        }

        ocultarProgresso();
        mostrarEtapa(2);
        prepararEtapa2();
    } catch (e) {
        ocultarProgresso();
        mostrarMsg('msgStep1', 'erro', 'Erro ao processar o PDF: ' + e.message);
        console.error(e);
    }
};
