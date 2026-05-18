/**
 * SCONT – Fechamento Folha de Pagamento
 * Empresa: Quadrante Etiquetas (código 453)
 */

const CODIGO_EMPRESA = '453';
const LINHA_CABECALHO = 4; // linha do Excel (1-based) com os nomes das colunas
const LINHA_DADOS_INI = 5; // primeira linha de dados

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado global
let planilhaData      = []; // [{nome, funcao, colunas: {colNome: valorBruto}}]
let funcionariosMap   = {}; // nome_normalizado → {codigo_empregado}
let rubricasConfig    = []; // [{coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao}]
let linhasTxt         = []; // linhas válidas para o TXT
let feriasData        = []; // dados brutos da planilha de férias
let feriasHeaders     = []; // cabeçalhos da planilha de férias
let feriasSorted      = []; // dados ordenados

// ──────────────────────────────────────────────
// UTILITÁRIOS
// ──────────────────────────────────────────────

function mostrarMensagem(titulo, texto) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent  = texto;
    document.getElementById('messageModal').classList.add('active');
}

function fecharModal() {
    document.getElementById('messageModal').classList.remove('active');
}

function mostrarStep(n) {
    [1,2,3,4,5].forEach(i => {
        const el = document.getElementById('step' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarStep(n) { mostrarStep(n); }

function normalizarNome(s) {
    return (s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ');
}

// Converte "R$ 2.990,26" → 299026 (centavos inteiros)
function parseMoney(s) {
    if (!s || typeof s !== 'string') return 0;
    const limpo = s.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
}

// Converte "12:18:00" → 738 (minutos)
function parseHoras(s) {
    if (!s || typeof s !== 'string') return 0;
    const partes = s.trim().split(':');
    if (partes.length < 2) return 0;
    const h = parseInt(partes[0], 10) || 0;
    const m = parseInt(partes[1], 10) || 0;
    return h * 60 + m;
}

// Converte número de dias (texto) → inteiro
function parseDias(s) {
    if (!s && s !== 0) return 0;
    const n = parseInt(String(s).trim(), 10);
    return isNaN(n) || n <= 0 ? 0 : n;
}

function valorParaTxt(bruto, tipoValor) {
    switch (tipoValor) {
        case 'monetario': return parseMoney(bruto);
        case 'minutos':   return parseHoras(bruto);
        case 'dias':      return parseDias(bruto);
        default:          return 0;
    }
}

function formatarValorExibicao(valorTxt, tipoValor) {
    if (valorTxt === 0) return '–';
    switch (tipoValor) {
        case 'monetario': return 'R$ ' + (valorTxt / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        case 'minutos':   return valorTxt + ' min';
        case 'dias':      return valorTxt + ' dias';
        default:          return valorTxt;
    }
}

function gerarLinhaTxt(codEmpregado, competencia, codigoRubrica, tipoProcesso, valorInt, codEmpresa) {
    const compParts   = competencia.split('/');
    const compFmt     = compParts[1] + compParts[0]; // AAAAMM
    const empFmt      = String(codEmpregado).padStart(10, '0');
    const rubFmt      = String(codigoRubrica).replace(/\D/g, '').padStart(9, '0');
    const tipoProcFmt = String(tipoProcesso).padStart(2, '0');
    const valFmt      = String(valorInt).padStart(9, '0');
    const empresaFmt  = String(codEmpresa).padStart(10, '0');
    return `10${empFmt}${compFmt}${rubFmt}${tipoProcFmt}${valFmt}${empresaFmt}`;
}

// ──────────────────────────────────────────────
// SUPABASE
// ──────────────────────────────────────────────

async function carregarFuncionarios() {
    const { data, error } = await supabaseClient
        .from('rh_empregados')
        .select('nome_empregado, codigo_empregado')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    funcionariosMap = {};
    (data || []).forEach(f => {
        funcionariosMap[normalizarNome(f.nome_empregado)] = f.codigo_empregado;
    });
}

async function carregarRubricas() {
    const { data, error } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao')
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('ativo', true);
    if (error) throw error;
    rubricasConfig = data || [];
}

// ──────────────────────────────────────────────
// STEP 1 – PROCESSAR PLANILHA
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Máscara competência
    document.getElementById('competencia').addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 6);
        e.target.value = v;
    });

    // Upload área – drag and drop folha
    configurarUploadArea('uploadAreaFolha', 'inputFolha', 'filenameFolha', onFolhaSelecionada);
    // Upload área – férias
    configurarUploadArea('uploadAreaFerias', 'inputFerias', 'filenameFerias', onFeriasSelecionada);
});

function configurarUploadArea(areaId, inputId, filenameId, callback) {
    const area  = document.getElementById(areaId);
    const input = document.getElementById(inputId);

    input.addEventListener('change', () => {
        if (input.files[0]) callback(input.files[0], filenameId);
    });
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', ()  => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) { input.files = e.dataTransfer.files; callback(f, filenameId); }
    });
}

let arquivoFolha = null;

function onFolhaSelecionada(file, filenameId) {
    arquivoFolha = file;
    const el = document.getElementById(filenameId);
    el.textContent = '✔ ' + file.name;
    el.style.display = 'block';
}

async function processarPlanilha() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Informe a competência no formato MM/AAAA.');
        return;
    }
    if (!arquivoFolha) {
        mostrarMensagem('Atenção', 'Selecione a planilha de fechamento.');
        return;
    }

    try {
        // Carregar dados do Supabase em paralelo
        await Promise.all([carregarFuncionarios(), carregarRubricas()]);

        // Ler Excel
        const buffer   = await arquivoFolha.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Linha 4 (índice 3) = cabeçalhos
        const headers = rows[LINHA_CABECALHO - 1] || [];

        // Mapeia nome da coluna → índice
        const colIdx = {};
        headers.forEach((h, i) => { colIdx[h] = i; });

        // Linhas de dados: a partir da linha 5 até linha vazia (sem nome)
        planilhaData = [];
        for (let r = LINHA_DADOS_INI - 1; r < rows.length; r++) {
            const row  = rows[r];
            const nome = String(row[0] || '').trim();
            if (!nome) break; // fim dos dados

            const colunas = {};
            rubricasConfig.forEach(cfg => {
                const idx = colIdx[cfg.coluna_planilha];
                colunas[cfg.coluna_planilha] = (idx !== undefined) ? String(row[idx] || '') : '';
            });

            planilhaData.push({ nome, funcao: String(row[1] || ''), colunas });
        }

        construirRelatorio(comp);
        mostrarStep(2);

    } catch (err) {
        console.error(err);
        mostrarMensagem('Erro', 'Falha ao processar a planilha: ' + err.message);
    }
}

// ──────────────────────────────────────────────
// STEP 2 – RELATÓRIO
// ──────────────────────────────────────────────

let linhasRelatorio = [];

function construirRelatorio(comp) {
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + comp;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + comp;

    linhasTxt = [];
    linhasRelatorio = [];
    let temSemMatch = false;

    planilhaData.forEach(func => {
        const nomeNorm = normalizarNome(func.nome);
        const codEmpregado = funcionariosMap[nomeNorm] || null;
        if (!codEmpregado) temSemMatch = true;

        rubricasConfig.forEach(cfg => {
            if (cfg.tipo_valor === 'booleano') return; // Cota Sindicato – exibir mas não gerar TXT
            const bruto   = func.colunas[cfg.coluna_planilha] || '';
            const valorInt = valorParaTxt(bruto, cfg.tipo_valor);
            if (!bruto && valorInt === 0) return; // coluna vazia

            const linha = {
                nome: func.nome,
                codEmpregado,
                funcao: func.funcao,
                descricao: cfg.descricao || cfg.coluna_planilha.trim(),
                codigoRubrica: cfg.codigo_rubrica,
                tipoProcesso: cfg.tipo_processo,
                tipoValor: cfg.tipo_valor,
                bruto,
                valorInt,
            };
            linhasRelatorio.push(linha);

            if (codEmpregado && valorInt > 0) {
                linhasTxt.push(
                    gerarLinhaTxt(codEmpregado, comp, cfg.codigo_rubrica, cfg.tipo_processo, valorInt, CODIGO_EMPRESA)
                );
            }
        });
    });

    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
}

function renderizarRelatorio(linhas) {
    const tbody = document.getElementById('bodyRelatorio');
    tbody.innerHTML = '';

    linhas.forEach((l, i) => {
        const tr = document.createElement('tr');
        const semMatch = !l.codEmpregado;
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${l.nome}${semMatch ? ' <span class="sem-match">sem cadastro</span>' : ''}</td>
            <td>${l.codEmpregado || '–'}</td>
            <td>${l.descricao}</td>
            <td style="font-family:monospace;">${l.codigoRubrica}</td>
            <td><span class="badge badge-${l.tipoValor}">${l.tipoValor}</span></td>
            <td>${l.bruto || '–'}</td>
            <td style="font-family:monospace; font-weight:600;">${l.valorInt > 0 ? l.valorInt : '–'}</td>
        `;
        if (semMatch) tr.style.background = '#fff8f8';
        tbody.appendChild(tr);
    });

    document.getElementById('contadorLinhas').textContent = linhas.length + ' registros';
    construirTotais(linhas);
}

function construirTotais(linhas) {
    const totais = {};
    linhas.forEach(l => {
        if (!totais[l.descricao]) totais[l.descricao] = { tipo: l.tipoValor, soma: 0 };
        totais[l.descricao].soma += l.valorInt;
    });

    let html = '<div style="margin-top:15px;">'
        + '<strong style="color:var(--primary-color);">Totais por Rubrica</strong>'
        + '<div class="table-wrapper" style="margin-top:8px;">'
        + '<table><thead><tr><th>Rubrica</th><th>Total</th></tr></thead><tbody>';
    Object.entries(totais).forEach(([desc, t]) => {
        html += `<tr class="total-row"><td>${desc}</td><td>${formatarValorExibicao(t.soma, t.tipo)}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    document.getElementById('totaisRelatorio').innerHTML = html;
}

function filtrarRelatorio() {
    const termo = normalizarNome(document.getElementById('buscaRelatorio').value);
    const filtradas = termo
        ? linhasRelatorio.filter(l =>
            normalizarNome(l.nome).includes(termo) ||
            normalizarNome(l.descricao).includes(termo))
        : linhasRelatorio;
    renderizarRelatorio(filtradas);
}

// ──────────────────────────────────────────────
// STEP 3 – TXT
// ──────────────────────────────────────────────

function irStep3() {
    const comp = document.getElementById('competencia').value.trim();
    if (linhasTxt.length === 0) {
        mostrarMensagem('Atenção', 'Nenhuma linha válida para gerar o TXT. Verifique os cadastros e rubricas.');
        return;
    }
    document.getElementById('resumoTxt').textContent =
        `Total de linhas no TXT: ${linhasTxt.length}`;
    document.getElementById('previaTxt').textContent = linhasTxt.join('\n');
    mostrarStep(3);
}

function baixarTXT() {
    if (linhasTxt.length === 0) { mostrarMensagem('Erro', 'Nenhuma linha para exportar.'); return; }
    const comp    = document.getElementById('competencia').value.trim().replace('/', '-');
    const conteudo = linhasTxt.join('\n');
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Fechamento_Quadrante_${comp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// STEP 4 – UPLOAD FÉRIAS
// ──────────────────────────────────────────────

let arquivoFerias = null;

function irStep4() { mostrarStep(4); }

function onFeriasSelecionada(file, filenameId) {
    arquivoFerias = file;
    const el = document.getElementById(filenameId);
    el.textContent = '✔ ' + file.name;
    el.style.display = 'block';
    preCarregarColunas(file);
}

async function preCarregarColunas(file) {
    try {
        const buffer   = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Detectar linha de cabeçalho: primeira linha com ao menos 2 células não-vazias
        let cabRow = rows[0] || [];
        for (let r = 0; r < Math.min(5, rows.length); r++) {
            const naoVazias = rows[r].filter(c => String(c).trim() !== '');
            if (naoVazias.length >= 2) { cabRow = rows[r]; break; }
        }

        feriasHeaders = cabRow.map(c => String(c).trim());
        const sel = document.getElementById('colunaOrdenacao');
        sel.innerHTML = '<option value="">— Detectar automaticamente —</option>';
        feriasHeaders.forEach((h, i) => {
            if (!h) return;
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = h;
            // Pré-selecionar coluna com "gozo" ou "inicio" no nome
            if (/gozo|in[ií]cio|ini[çc]/i.test(h)) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Pré-carga colunas férias:', err);
    }
}

async function processarFerias() {
    if (!arquivoFerias) {
        mostrarMensagem('Atenção', 'Selecione a planilha de programação de férias.');
        return;
    }

    try {
        const buffer   = await arquivoFerias.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Detectar linha de cabeçalho
        let cabIdx = 0;
        for (let r = 0; r < Math.min(5, rows.length); r++) {
            const naoVazias = rows[r].filter(c => String(c).trim() !== '');
            if (naoVazias.length >= 2) { cabIdx = r; break; }
        }

        feriasHeaders = rows[cabIdx].map(c => String(c).trim());
        feriasData    = rows.slice(cabIdx + 1).filter(r => r.some(c => String(c).trim() !== ''));

        // Coluna de ordenação
        let colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
        if (isNaN(colOrd)) {
            // Auto-detectar
            colOrd = feriasHeaders.findIndex(h => /gozo|in[ií]cio|ini[çc]/i.test(h));
            if (colOrd < 0) colOrd = 0;
        }

        // Ordenar
        feriasSorted = [...feriasData].sort((a, b) => {
            const va = parseDataFerias(a[colOrd]);
            const vb = parseDataFerias(b[colOrd]);
            return va - vb;
        });

        renderizarFerias();
        mostrarStep(5);

    } catch (err) {
        console.error(err);
        mostrarMensagem('Erro', 'Falha ao processar férias: ' + err.message);
    }
}

function parseDataFerias(val) {
    if (!val) return new Date(9999, 0);
    if (val instanceof Date) return val;
    const s = String(val).trim();
    // Tenta DD/MM/AAAA
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // Tenta timestamp Excel (número)
    const n = parseFloat(s);
    if (!isNaN(n)) return new Date(Math.round((n - 25569) * 86400 * 1000));
    return new Date(val);
}

function formatarDataFerias(val) {
    const d = parseDataFerias(val);
    if (!d || isNaN(d.getTime()) || d.getFullYear() > 9000) return String(val || '–');
    return d.toLocaleDateString('pt-BR');
}

function renderizarFerias() {
    // Header
    const thead = document.getElementById('headFerias');
    thead.innerHTML = '<tr>' + feriasHeaders.map(h => `<th>${h}</th>`).join('') + '</tr>';

    // Detectar índices de colunas de data para formatar
    const colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
    const idxDatas = new Set();
    feriasHeaders.forEach((h, i) => {
        if (/data|gozo|in[ií]cio|fim|per[ií]odo/i.test(h)) idxDatas.add(i);
    });
    if (!isNaN(colOrd)) idxDatas.add(colOrd);

    renderizarBodyFerias(feriasSorted, idxDatas);

    // Stats
    const total = feriasSorted.length;
    const anos  = new Set(feriasSorted.map(r => parseDataFerias(r[isNaN(colOrd) ? 0 : colOrd]).getFullYear())).size;
    document.getElementById('feriasStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Programações</div>
        </div>`;
}

function renderizarBodyFerias(dados, idxDatas) {
    const tbody = document.getElementById('bodyFerias');
    tbody.innerHTML = '';
    dados.forEach(row => {
        const td = feriasHeaders.map((_, i) => {
            const val = row[i];
            const txt = idxDatas.has(i) ? formatarDataFerias(val) : (val !== undefined ? val : '–');
            return `<td>${txt}</td>`;
        }).join('');
        tbody.innerHTML += `<tr>${td}</tr>`;
    });
}

function filtrarFerias() {
    const termo = normalizarNome(document.getElementById('buscaFerias').value);
    const colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
    const idxDatas = new Set(feriasHeaders.reduce((acc, h, i) => {
        if (/data|gozo|in[ií]cio|fim|per[ií]odo/i.test(h)) acc.push(i);
        return acc;
    }, []));
    if (!isNaN(colOrd)) idxDatas.add(colOrd);

    const filtrados = termo
        ? feriasSorted.filter(r => r.some(c => normalizarNome(String(c)).includes(termo)))
        : feriasSorted;
    renderizarBodyFerias(filtrados, idxDatas);
}

function imprimirFerias() {
    window.print();
}
