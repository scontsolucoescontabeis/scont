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

// ===== EXTRATOR IMAGEM (OCR) =====
async function extrairImagem(file) {
    mostrarProgresso(20, 'Reconhecendo texto (OCR)...');
    const texto = await rodarOCR(file);
    return parsearTextoPDF(texto);
}

async function extrairPdfOCR(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let textoTotal = '';

    for (let p = 1; p <= pdf.numPages; p++) {
        mostrarProgresso(20 + Math.round((p / pdf.numPages) * 60), `OCR página ${p}/${pdf.numPages}...`);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        textoTotal += await rodarOCR(canvas) + '\n';
    }

    return parsearTextoPDF(textoTotal);
}

async function rodarOCR(fonte) {
    const { data: { text } } = await Tesseract.recognize(fonte, 'por', {
        logger: m => {
            if (m.status === 'recognizing text') {
                mostrarProgresso(
                    20 + Math.round(m.progress * 70),
                    `OCR: ${Math.round(m.progress * 100)}%`
                );
            }
        }
    });
    return text;
}

// ===== EXTRATOR PDF DIGITAL =====
async function extrairPdf(file) {
    const buffer = await file.arrayBuffer();
    mostrarProgresso(30, 'Extraindo texto do PDF...');

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    let textoTotal = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const linhaPorY = {};
        content.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            linhaPorY[y] = (linhaPorY[y] || []);
            linhaPorY[y].push({ x: item.transform[4], str: item.str });
        });
        const linhasOrdenadas = Object.keys(linhaPorY)
            .sort((a, b) => b - a)
            .map(y => linhaPorY[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' '));
        textoTotal += linhasOrdenadas.join('\n') + '\n';
        mostrarProgresso(30 + Math.round((p / pdf.numPages) * 40), `Lendo página ${p}/${pdf.numPages}...`);
    }

    const charsPerPage = textoTotal.replace(/\s/g, '').length / pdf.numPages;
    if (charsPerPage < 30) {
        mostrarProgresso(70, 'PDF escaneado — iniciando OCR...');
        return extrairPdfOCR(buffer);
    }

    return parsearTextoPDF(textoTotal);
}

function parsearTextoPDF(texto) {
    const DATA_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
    const HORA_RE = /\b(\d{1,2}:\d{2})\b/g;
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
    const rows = [];

    for (const linha of linhas) {
        const dataMatch = linha.match(DATA_RE);
        const horas = [...linha.matchAll(HORA_RE)].map(m =>
            m[1].padStart(5, '0').replace(/^(\d):/, '0$1:')
        );
        if (!dataMatch && !horas.length) continue;
        const row = { 'Data': dataMatch ? dataMatch[1] : '' };
        ['H1','H2','H3','H4','H5','H6'].forEach((k, i) => { row[k] = horas[i] || ''; });
        rows.push(row);
    }

    const headers = ['Data', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    return { headers, rows: rows.filter(r => r['Data'] || r['H1']) };
}

// ===== EXTRATOR EXCEL/CSV =====
function normalizarCelula(header, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    // Detecta se é um serial de tempo do Excel (fração de 24h, < 1)
    if (typeof valor === 'number' && valor < 1 && valor >= 0) {
        const total = Math.round(valor * 24 * 60);
        const h = Math.floor(total / 60) % 24;
        const m = total % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    // Serial de data do Excel (inteiro >= 1)
    if (typeof valor === 'number' && valor >= 1) {
        try {
            const parsed = XLSX.SSF.parse_date_code(valor);
            const d = String(parsed.d).padStart(2,'0');
            const mo = String(parsed.m).padStart(2,'0');
            return `${d}/${mo}/${parsed.y}`;
        } catch { return String(valor); }
    }
    const s = String(valor).trim();
    // Normaliza hora HH:MM
    const mHora = s.match(/^(\d{1,2}):(\d{2})/);
    if (mHora) return `${mHora[1].padStart(2,'0')}:${mHora[2]}`;
    return s;
}

async function extrairExcel(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Encontra a linha de cabeçalho (primeira linha não-vazia)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
        if (raw[i].some(c => String(c).trim())) { headerIdx = i; break; }
    }

    const headers = raw[headerIdx].map((h, i) => String(h).trim() || ('Col' + i));
    const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => String(c).trim()));

    const rows = dataRows.map(r =>
        Object.fromEntries(headers.map((h, i) => [h, normalizarCelula(h, r[i])]))
    );

    return { headers, rows };
}
