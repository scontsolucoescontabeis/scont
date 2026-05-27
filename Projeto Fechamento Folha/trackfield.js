/**
 * SCONT – Fechamento Folha de Pagamento
 * Empresa: Track & Field (código TF)
 *
 * Estrutura da planilha:
 *   Linha 1 (idx 0): "TRACK & FIELD"
 *   Linha 2 (idx 1): "VERIFICAR FERIADOS"
 *   Linha 3 (idx 2): Cabeçalhos — LOJA | CARGO | ADMISSÃO | COLABORADOR | SALÁRIO FIXO | ...
 *   Linha 4+ (idx 3+): Dados
 *
 * Coluna de nome do colaborador: índice 3 (COLABORADOR)
 * Colunas de rubrica: índices 4 a 12
 */

const CODIGO_EMPRESA  = 'TF';
const LINHA_CABECALHO = 3;

// Mapeamento loja → { codTxt: código numérico para o TXT, codDB: código no rh_empregados }
const LOJAS_TF = {
    'AEROPORTO':         { codTxt: '113', codDB: '113' },
    'CONJUNTO NACIONAL': { codTxt: '128', codDB: '128' },
    'PÁTIO BRASIL':      { codTxt: '126', codDB: '126' },
    'PATIO BRASIL':      { codTxt: '126', codDB: '126' },
    'DF PLAZA':          { codTxt: '115', codDB: '115' },
};

function _resolverLoja(loja) {
    const norm = (loja || '').trim().toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [chave, val] of Object.entries(LOJAS_TF)) {
        if (norm === chave.normalize('NFD').replace(/[̀-ͯ]/g, '')) return val;
    }
    return null;
}

// Código numérico usado no TXT e exibição
function codigoEmpresaPorLoja(loja) {
    return _resolverLoja(loja)?.codTxt || CODIGO_EMPRESA;
}

// Código usado para busca em rh_empregados
function codigoEmpresaDBPorLoja(loja) {
    return _resolverLoja(loja)?.codDB || null;
} // 1-based (índice 0-based = 2)
const LINHA_DADOS_INI = 4; // 1-based (índice 0-based = 3)
const COL_COLABORADOR = 3; // índice 0-based da coluna de nome
const COL_LOJA        = 0;
const COL_CARGO       = 1;
const COL_ADMISSAO    = 2;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado global
let planilhaData    = [];
let funcionariosMap = {};
let rubricasConfig  = [];
let rhRubricasData  = [];
let linhasTxt       = [];
let linhasRelatorio = [];
let tipoFolhaAtual  = '11';
let empregadosConfig  = {}; // codEmpresaDB → { nome_normalizado → codigo_empregado }
let rubricasIgnoradas = new Set(); // normalizarNome(coluna_planilha) → excluir do TXT

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
    [1,2,3].forEach(i => {
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

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp[i] = [i]; }
    for (let j = 0; j <= n; j++) { dp[0][j] = j; }
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}

function similaridade(a, b) {
    const na = normalizarNome(a), nb = normalizarNome(b);
    if (na === nb) return 1;
    if (!na || !nb) return 0;
    return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

function buscarCodigoEmpregado(nome, codEmpresaDB) {
    const norm = normalizarNome(nome);
    // 1. Tabela de config desta ferramenta (prioridade máxima)
    const mapaConfig = (codEmpresaDB && empregadosConfig[codEmpresaDB]) || {};
    if (mapaConfig[norm]) return mapaConfig[norm];
    // 2. rh_empregados exact + fuzzy
    const mapa = (codEmpresaDB && funcionariosMap[codEmpresaDB]) || {};
    if (mapa[norm]) return mapa[norm];
    let melhorScore = 0, melhorCod = null;
    for (const [chave, cod] of Object.entries(mapa)) {
        const s = similaridade(norm, chave);
        if (s > melhorScore) { melhorScore = s; melhorCod = cod; }
    }
    return melhorScore >= 0.75 ? melhorCod : null;
}

// Converte valor monetário para centavos inteiros.
// Suporta:
//   - Número puro do Excel: 2990.26
//   - Formato PT-BR: "2.990,26" ou "2990,26"
//   - Texto com múltiplos R$ (COMISSÃO DOMINGOS/FERIADOS): soma todos
function parseMoney(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).replace(/R\$|\s/g, '').trim();
    if (!str) return 0;

    // Tenta parse simples primeiro
    let num;
    if (str.includes(',') && !str.includes('\n') && !str.includes(';')) {
        num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(num) && num > 0) return Math.round(num * 100);
    } else if (!isNaN(parseFloat(str))) {
        num = parseFloat(str.replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) return Math.round(num * 100);
    }

    // Fallback: extrai e soma todos os valores R$ do texto (para COMISSÃO DOMINGOS/FERIADOS)
    const matches = String(s).match(/R\$\s*[\d.,]+/gi) || [];
    if (matches.length > 0) {
        let total = 0;
        matches.forEach(m => {
            const clean = m.replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.');
            total += parseFloat(clean) || 0;
        });
        return Math.round(total * 100);
    }

    return 0;
}

// Extrai número de dias de textos como "4 DIAS - 06, 10, 11 E 12/04" → 4
function parseDiasTexto(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).trim();
    // Tenta capturar "X DIA(S)"
    const m = str.match(/^(\d+)\s*DIA/i);
    if (m) return parseInt(m[1], 10);
    // Tenta número puro
    const n = parseInt(str, 10);
    return isNaN(n) || n <= 0 ? 0 : n;
}

// Converte "12:18:00", "04h:30M", "4h30m", "4h" → HHMM (ex: 1218, 430)
function parseHoras(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).trim();

    // Formatos "4h30m", "04h:30M", "4h30", "4h"
    const mH = str.match(/^(\d+)\s*h[:\.]?\s*(\d*)\s*m?$/i);
    if (mH) {
        const h = parseInt(mH[1], 10) || 0;
        const m = parseInt(mH[2] || '0', 10) || 0;
        return h * 100 + m;
    }

    if (str.includes(':')) {
        const partes = str.split(':');
        const h = parseInt(partes[0], 10) || 0;
        const m = parseInt(partes[1], 10) || 0;
        return h * 100 + m;
    }
    const n = parseFloat(str);
    if (isNaN(n) || n <= 0) return 0;
    const totalMin = Math.round(n * 24 * 60);
    return Math.floor(totalMin / 60) * 100 + (totalMin % 60);
}

function valorParaTxt(bruto, tipoValor, header) {
    const h = normalizarNome(header);
    // Campo de comissão domingos/feriados sempre monetário com extração de soma
    if (h.includes('domingo') || h.includes('feriado')) {
        return parseMoney(bruto);
    }
    // Campos de atestados e faltas tratados como dias
    if (h.includes('atestado') || h.includes('falta')) {
        const dias = parseDiasTexto(bruto);
        return dias;
    }
    switch (tipoValor) {
        case 'monetario': return parseMoney(bruto);
        case 'minutos':   return parseHoras(bruto);
        case 'dias':      return parseDiasTexto(bruto);
        default:          return 0;
    }
}

function formatarValorExibicao(valorTxt, tipoValor) {
    if (valorTxt === 0) return '–';
    switch (tipoValor) {
        case 'monetario': return 'R$ ' + (valorTxt / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        case 'minutos': {
            const h = Math.floor(valorTxt / 100);
            const m = valorTxt % 100;
            return `${h}h${String(m).padStart(2,'0')}`;
        }
        case 'dias': return valorTxt + ' dias';
        default:     return valorTxt;
    }
}

function gerarLinhaTxt(codEmpregado, competencia, codigoRubrica, tipoProcesso, valorInt, codEmpresa) {
    const compParts  = competencia.split('/');
    const compFmt    = compParts[1] + compParts[0]; // AAAAMM
    const empFmt     = String(codEmpregado).padStart(10, '0');
    const rubFmt     = String(codigoRubrica).replace(/\D/g, '').padStart(9, '0');
    const tipoProcFmt = String(tipoProcesso).padStart(2, '0');
    const valFmt     = String(valorInt).padStart(9, '0');
    const empresaFmt = String(codEmpresa).padStart(10, '0');
    return `10${empFmt}${compFmt}${rubFmt}${tipoProcFmt}${valFmt}${empresaFmt}`;
}

// ──────────────────────────────────────────────
// SUPABASE
// ──────────────────────────────────────────────

async function carregarFuncionarios() {
    const { data, error } = await supabaseClient
        .from('rh_empregados')
        .select('nome_empregado, codigo_empregado, codigo_empresa')
        .in('codigo_empresa', ['113', '115', '126', '128']);
    if (error) throw error;
    // { codEmpresa: { nomeNormalizado: codigoEmpregado } }
    funcionariosMap = {};
    (data || []).forEach(f => {
        if (!funcionariosMap[f.codigo_empresa]) funcionariosMap[f.codigo_empresa] = {};
        funcionariosMap[f.codigo_empresa][normalizarNome(f.nome_empregado)] = f.codigo_empregado;
    });
}

async function carregarEmpregadosConfig() {
    const codigos = [...new Set(Object.values(LOJAS_TF).map(l => l.codDB))];
    const { data, error } = await supabaseClient
        .from('fechamento_empregados_config')
        .select('codigo_empresa, nome_planilha, codigo_empregado')
        .in('codigo_empresa', codigos);
    if (error) throw error;
    empregadosConfig = {};
    (data || []).forEach(e => {
        if (!empregadosConfig[e.codigo_empresa]) empregadosConfig[e.codigo_empresa] = {};
        empregadosConfig[e.codigo_empresa][normalizarNome(e.nome_planilha)] = e.codigo_empregado;
    });
}

async function carregarRubricasIgnoradas() {
    const { data, error } = await supabaseClient
        .from('fechamento_rubricas_ignoradas')
        .select('coluna_planilha')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    rubricasIgnoradas = new Set((data || []).map(r => normalizarNome(r.coluna_planilha)));
}

async function carregarRubricas() {
    const { data: cfgData, error: cfgErr } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao')
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('ativo', true);
    if (cfgErr) throw cfgErr;
    rubricasConfig = cfgData || [];

    const { data: rhData, error: rhErr } = await supabaseClient
        .from('rh_rubricas')
        .select('descricao_rubrica, codigo_rubrica')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (rhErr) throw rhErr;
    rhRubricasData = rhData || [];
}

function resolverColuna(header) {
    const normH = normalizarNome(header);

    const exato = rubricasConfig.find(c =>
        normalizarNome(c.coluna_planilha) === normH ||
        normalizarNome(c.descricao || '') === normH
    );
    if (exato) return { codigo_rubrica: exato.codigo_rubrica, tipo_valor: exato.tipo_valor, descricao: exato.descricao || header, fonte: 'config', tipo_processo: exato.tipo_processo };

    let melhorScore = 0, melhorCfg = null;
    for (const c of rubricasConfig) {
        const s = Math.max(
            similaridade(normH, normalizarNome(c.coluna_planilha)),
            similaridade(normH, normalizarNome(c.descricao || ''))
        );
        if (s > melhorScore) { melhorScore = s; melhorCfg = c; }
    }
    if (melhorScore >= 0.80 && melhorCfg) {
        return { codigo_rubrica: melhorCfg.codigo_rubrica, tipo_valor: melhorCfg.tipo_valor, descricao: melhorCfg.descricao || header, fonte: 'config', tipo_processo: melhorCfg.tipo_processo };
    }

    let melhorRhScore = 0, melhorRh = null;
    for (const rh of rhRubricasData) {
        const s = similaridade(header, rh.descricao_rubrica || '');
        if (s > melhorRhScore) { melhorRhScore = s; melhorRh = rh; }
    }
    if (melhorRhScore >= 0.65 && melhorRh) {
        return { codigo_rubrica: melhorRh.codigo_rubrica, tipo_valor: 'monetario', descricao: header, fonte: 'rh_rubricas', tipo_processo: '11' };
    }

    return { codigo_rubrica: null, tipo_valor: null, descricao: header, fonte: null, tipo_processo: null };
}

// ──────────────────────────────────────────────
// STEP 1 – PROCESSAR PLANILHA
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;

    document.getElementById('competencia').addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 6);
        e.target.value = v;
    });

    configurarUploadArea('uploadAreaFolha', 'inputFolha', 'filenameFolha', onFolhaSelecionada);
    carregarEnvios();
});

function configurarUploadArea(areaId, inputId, filenameId, callback) {
    const area  = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    input.addEventListener('change', () => { if (input.files[0]) callback(input.files[0], filenameId); });
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
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
        await Promise.all([carregarFuncionarios(), carregarRubricas(), carregarEmpregadosConfig(), carregarRubricasIgnoradas()]);

        const buffer   = await arquivoFolha.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Linha 3 (índice 2) = cabeçalhos
        const headers = rows[LINHA_CABECALHO - 1] || [];

        // Colunas de rubrica: a partir do índice 4 (SALÁRIO FIXO em diante)
        const colunasRubrica = [];
        headers.forEach((h, i) => {
            if (i <= COL_COLABORADOR) return; // LOJA, CARGO, ADMISSÃO, COLABORADOR — não são rubricas
            const header = String(h || '').trim();
            if (!header) return;
            colunasRubrica.push({ idx: i, header, resolucao: resolverColuna(header) });
        });

        // Dados: a partir da linha 4 (índice 3)
        planilhaData = [];
        for (let r = LINHA_DADOS_INI - 1; r < rows.length; r++) {
            const row  = rows[r];
            const nome = String(row[COL_COLABORADOR] || '').trim();
            if (!nome) break; // linha vazia = fim dos dados

            const loja     = String(row[COL_LOJA]     || '').trim();
            const cargo    = String(row[COL_CARGO]    || '').trim();
            const admissao = String(row[COL_ADMISSAO] || '').trim();

            const colunas = {};
            colunasRubrica.forEach(({ idx, header }) => {
                const val = row[idx];
                // Células numéricas do Excel: converter para string formatada
                colunas[header] = (val === '' || val == null) ? '' : String(val).trim();
            });

            planilhaData.push({ nome, loja, cargo, admissao, colunas, colunasRubrica });
        }

        tipoFolhaAtual = '11';
        construirRelatorio(comp);
        mostrarStep(2);

        // Salvar histórico fire-and-forget
        supabaseClient.from('quadrante_folha_envios').insert({
            empresa_codigo: CODIGO_EMPRESA,
            competencia:    comp,
            tipo_folha:     tipoFolhaAtual,
            dados:          { fonte: 'planilha', competencia: comp, tipo_folha: tipoFolhaAtual, linhas: linhasRelatorio },
            processado:     true,
        }).then(({ error }) => {
            if (error) console.warn('Histórico planilha não salvo:', error.message);
            else carregarEnvios();
        });

    } catch (err) {
        console.error(err);
        mostrarMensagem('Erro', 'Falha ao processar a planilha: ' + err.message);
    }
}

// ──────────────────────────────────────────────
// STEP 2 – RELATÓRIO
// ──────────────────────────────────────────────

function construirRelatorio(comp) {
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + comp;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + comp;

    linhasTxt = [];
    linhasRelatorio = [];
    let temSemMatch = false;

    const colunasRubrica = planilhaData.length ? planilhaData[0].colunasRubrica : [];

    planilhaData.forEach(func => {
        const codEmpresa   = codigoEmpresaPorLoja(func.loja);
        const codEmpresaDB = codigoEmpresaDBPorLoja(func.loja);
        const codEmpregado = buscarCodigoEmpregado(func.nome, codEmpresaDB);
        if (!codEmpregado) temSemMatch = true;

        colunasRubrica.forEach(({ header, resolucao }) => {
            const bruto = func.colunas[header] || '';
            if (!bruto) return;

            const tipoValor = resolucao.tipo_valor;
            const valorInt  = tipoValor && tipoValor !== 'booleano'
                ? valorParaTxt(bruto, tipoValor, header)
                : 0;

            linhasRelatorio.push({
                nome:          func.nome,
                loja:          func.loja,
                cargo:         func.cargo,
                codEmpresa,
                codEmpregado,
                coluna:        header,
                descricao:     resolucao.descricao || header,
                codigoRubrica: resolucao.codigo_rubrica,
                fonteRubrica:  resolucao.fonte,
                tipoProcesso:  resolucao.tipo_processo || '11',
                tipoValor,
                bruto,
                valorInt,
            });
        });
    });

    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
}

function renderizarRelatorio(linhas) {
    const tbody = document.getElementById('bodyRelatorio');
    tbody.innerHTML = '';

    linhas.forEach((l, i) => {
        const semFuncionario = !l.codEmpregado;
        const semRubrica     = !l.codigoRubrica;
        const ignorada       = !semRubrica && rubricasIgnoradas.has(normalizarNome(l.coluna));

        const fonteTag = !semRubrica && !ignorada
            ? (l.fonteRubrica === 'config'
                ? '<span style="font-size:10px;color:var(--primary-color);margin-left:4px;" title="Associação da ferramenta">★</span>'
                : '<span style="font-size:10px;color:#7F8C8D;margin-left:4px;" title="rh_rubricas (fallback)">◎</span>')
            : '';

        const rubricaCell = semRubrica
            ? '—'
            : ignorada
                ? `<s style="color:#bbb;">${l.codigoRubrica}</s>`
                : (l.codigoRubrica + fonteTag);

        const _valorFmt = l.tipoValor === 'minutos'
            ? String(l.valorInt).padStart(4, '0')
            : formatarValorExibicao(l.valorInt, l.tipoValor);
        const valorExib = ignorada
            ? '<span style="color:#999;font-size:11px;">ignorada</span>'
            : l.tipoValor
                ? _valorFmt
                : `<em style="color:#95a5a6">${l.bruto}</em>`;

        const acaoBtns = [
            semFuncionario
                ? `<button class="btn btn-secondary btn-small"
                    onclick="abrirCadastroEmpregado(${i})"
                    title="Configurar código do empregado">+ Definir código</button>`
                : '',
            semRubrica
                ? `<button class="btn btn-secondary btn-small"
                    onclick="abrirCadastroRubrica(${i})"
                    title="Cadastrar rubrica">+ Rubrica</button>`
                : '',
            !semRubrica && !ignorada
                ? `<button class="btn btn-secondary btn-small" style="color:#999;"
                    onclick="ignorarRubrica(${i})" title="Excluir do TXT">⊘ Ignorar</button>`
                : '',
            ignorada
                ? `<button class="btn btn-secondary btn-small"
                    onclick="reativarRubrica(${i})" title="Voltar a incluir no TXT">↩ Reativar</button>`
                : '',
        ].filter(Boolean).join(' ');
        const acaoHtml = acaoBtns;

        const trStyle = ignorada
            ? 'background:#f5f5f5;opacity:0.6;'
            : (semFuncionario ? 'background:#fff5f5;' : '') + (semRubrica ? 'background:#fffbf0;' : '');

        const tr = document.createElement('tr');
        tr.id = `rel-row-${i}`;
        tr.style.cssText = trStyle;
        tr.innerHTML = `
            <td style="color:var(--text-secondary);">${i+1}</td>
            <td style="font-family:monospace;font-weight:600;">${l.codEmpresa || CODIGO_EMPRESA}</td>
            <td>${l.loja || '—'}</td>
            <td style="${semFuncionario ? 'color:#e74c3c;font-weight:600;' : ''}">${l.nome}</td>
            <td style="font-family:monospace;">${l.codEmpregado || '<em style="color:#e74c3c">Não encontrado</em>'}</td>
            <td>${l.descricao || l.coluna}${fonteTag}</td>
            <td style="font-family:monospace;${semRubrica?'color:#e74c3c;':''}">${rubricaCell}</td>
            <td>${!semRubrica && !ignorada
                ? `<select class="tipo-select" onchange="alterarTipoRubrica(${i}, this.value)" title="Alterar tipo do valor">
                    <option value="monetario" ${l.tipoValor==='monetario'?'selected':''}>monetário</option>
                    <option value="minutos"   ${l.tipoValor==='minutos'  ?'selected':''}>horas</option>
                    <option value="dias"      ${l.tipoValor==='dias'     ?'selected':''}>dias</option>
                    <option value="booleano"  ${l.tipoValor==='booleano' ?'selected':''}>booleano</option>
                   </select>`
                : '<span class="badge" style="background:#eee;color:#999;">?</span>'}</td>
            <td style="text-align:right;">${l.bruto}</td>
            <td style="text-align:right;font-weight:600;">${valorExib}</td>
            <td>${acaoHtml}</td>
        `;
        tbody.appendChild(tr);

        if (semFuncionario) {
            const trEmp = document.createElement('tr');
            trEmp.id = `emp-form-${i}`;
            trEmp.style.display = 'none';
            trEmp.style.background = '#fff5f5';
            trEmp.innerHTML = `
                <td colspan="11">
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">Configurar código do empregado: <em>${l.nome}</em></span>
                        <input type="text" id="empCode-${i}" placeholder="Código do empregado"
                            style="width:160px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;font-family:monospace;">
                        <button class="btn btn-primary btn-small" onclick="salvarEmpregadoInline(${i})">💾 Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="fecharCadastroEmpregado(${i})">Cancelar</button>
                        <span id="empStatus-${i}" style="font-size:12px;"></span>
                    </div>
                </td>
            `;
            tbody.appendChild(trEmp);
        }

        if (semRubrica) {
            const trForm = document.createElement('tr');
            trForm.id = `rel-form-${i}`;
            trForm.style.display = 'none';
            trForm.style.background = '#fffdf5';
            trForm.innerHTML = `
                <td colspan="11">
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">Cadastrar rubrica para: <em>${l.coluna}</em></span>
                        <input type="text" id="inlineCode-${i}" placeholder="Código da rubrica"
                            style="width:140px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;font-family:monospace;">
                        <select id="inlineTipo-${i}" style="padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                            <option value="monetario">Monetário (R$)</option>
                            <option value="minutos">Horas (HH:MM)</option>
                            <option value="dias">Dias</option>
                            <option value="booleano">Booleano</option>
                        </select>
                        <button class="btn btn-primary btn-small" onclick="salvarRubricaInline(${i})">💾 Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="fecharCadastroRubrica(${i})">Cancelar</button>
                        <span id="inlineStatus-${i}" style="font-size:12px;"></span>
                    </div>
                </td>
            `;
            tbody.appendChild(trForm);
        }
    });

    // Totais por rubrica
    const totaisPorRubrica = {};
    linhas.forEach(l => {
        if (!l.codigoRubrica || !l.valorInt) return;
        if (rubricasIgnoradas.has(normalizarNome(l.coluna))) return;
        const key = l.codigoRubrica + '|' + l.descricao;
        if (!totaisPorRubrica[key]) totaisPorRubrica[key] = { descricao: l.descricao, tipo: l.tipoValor, total: 0, count: 0 };
        // Horas armazenadas em HHMM: acumular em minutos reais para somar corretamente
        totaisPorRubrica[key].total += l.tipoValor === 'minutos'
            ? Math.floor(l.valorInt / 100) * 60 + (l.valorInt % 100)
            : l.valorInt;
        totaisPorRubrica[key].count++;
    });

    const totaisHtml = Object.values(totaisPorRubrica).map(t => {
        let totalDisplay;
        if (t.tipo === 'minutos') {
            const h = Math.floor(t.total / 60), m = t.total % 60;
            totalDisplay = `${h}h${String(m).padStart(2, '0')}`;
        } else {
            totalDisplay = formatarValorExibicao(t.total, t.tipo);
        }
        return `<span style="display:inline-block;margin:4px 8px 4px 0;padding:4px 10px;background:#f0f0f0;border-radius:6px;font-size:12px;">
            <strong>${t.descricao}</strong>: ${totalDisplay}
            <span style="font-size:10px;color:#7F8C8D;">(${t.count} lançamentos)</span>
        </span>`;
    }).join('');

    const semRubrica = linhas.filter(l => !l.codigoRubrica).length;
    document.getElementById('totaisRelatorio').innerHTML = `
        <div style="margin-bottom:8px;">${totaisHtml || '<em style="color:#95a5a6">Nenhuma rubrica mapeada</em>'}</div>
        ${semRubrica ? `<div class="alert alert-warning" style="font-size:12px;">⚠️ ${semRubrica} lançamento(s) sem rubrica associada — não serão incluídos no TXT.</div>` : ''}`;

    const cont = document.getElementById('contadorLinhas');
    if (cont) cont.textContent = linhas.length + ' lançamento(s)';
}

function filtrarRelatorio() {
    const termo = normalizarNome(document.getElementById('buscaRelatorio').value);
    if (!termo) { renderizarRelatorio(linhasRelatorio); return; }
    const filtradas = linhasRelatorio.filter(l =>
        normalizarNome(l.nome).includes(termo) ||
        normalizarNome(l.descricao).includes(termo) ||
        normalizarNome(l.loja).includes(termo)
    );
    renderizarRelatorio(filtradas);
}

// Configuração inline de código do empregado
function abrirCadastroEmpregado(idx) {
    document.getElementById(`emp-form-${idx}`).style.display = '';
    document.getElementById(`empCode-${idx}`).focus();
}

function fecharCadastroEmpregado(idx) {
    document.getElementById(`emp-form-${idx}`).style.display = 'none';
}

async function salvarEmpregadoInline(idx) {
    const codigo   = (document.getElementById(`empCode-${idx}`).value || '').trim();
    const statusEl = document.getElementById(`empStatus-${idx}`);

    if (!codigo) {
        statusEl.textContent = '⚠ Informe o código.';
        statusEl.style.color = '#E74C3C';
        return;
    }

    const linha        = linhasRelatorio[idx];
    const nome         = linha.nome;
    const codEmpresaDB = codigoEmpresaDBPorLoja(linha.loja);

    try {
        const { error } = await supabaseClient
            .from('fechamento_empregados_config')
            .upsert([{
                codigo_empresa:   codEmpresaDB || CODIGO_EMPRESA,
                nome_planilha:    nome,
                codigo_empregado: codigo,
            }], { onConflict: 'codigo_empresa,nome_planilha' });
        if (error) throw error;

        // Atualizar em memória
        const codEmpKey = codEmpresaDB || CODIGO_EMPRESA;
        if (!empregadosConfig[codEmpKey]) empregadosConfig[codEmpKey] = {};
        empregadosConfig[codEmpKey][normalizarNome(nome)] = codigo;

        // Atualizar todas as linhas com esse nome e mesma loja
        const normNome = normalizarNome(nome);
        linhasRelatorio.forEach(l => {
            if (normalizarNome(l.nome) === normNome && l.loja === linha.loja) {
                l.codEmpregado = codigo;
            }
        });

        renderizarRelatorio(linhasRelatorio);
    } catch (err) {
        statusEl.textContent = '❌ Erro: ' + err.message;
        statusEl.style.color = '#E74C3C';
    }
}

// Cadastro inline de rubrica
function abrirCadastroRubrica(idx) {
    document.getElementById(`rel-form-${idx}`).style.display = '';
    document.getElementById(`inlineCode-${idx}`).focus();
}

function fecharCadastroRubrica(idx) {
    document.getElementById(`rel-form-${idx}`).style.display = 'none';
}

async function salvarRubricaInline(idx) {
    const codigo    = (document.getElementById(`inlineCode-${idx}`).value || '').trim();
    const tipoValor = document.getElementById(`inlineTipo-${idx}`).value;
    const statusEl  = document.getElementById(`inlineStatus-${idx}`);

    if (!codigo) {
        statusEl.textContent = '⚠ Informe o código.';
        statusEl.style.color = '#E74C3C';
        return;
    }

    const coluna = linhasRelatorio[idx].coluna;

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .upsert([{
                codigo_empresa:  CODIGO_EMPRESA,
                coluna_planilha: coluna,
                descricao:       coluna,
                codigo_rubrica:  codigo,
                tipo_processo:   '11',
                tipo_valor:      tipoValor,
                ativo:           true,
            }], { onConflict: 'codigo_empresa,coluna_planilha' });
        if (error) throw error;

        // Atualizar todas as linhas com essa mesma coluna
        linhasRelatorio.forEach(l => {
            if (l.coluna !== coluna) return;
            l.codigoRubrica = codigo;
            l.tipoValor     = tipoValor;
            l.fonteRubrica  = 'config';
            l.valorInt      = tipoValor !== 'booleano' ? valorParaTxt(l.bruto, tipoValor, coluna) : 0;
        });

        // Atualizar resolução em planilhaData para re-renders futuros
        planilhaData.forEach(f => {
            f.colunasRubrica.forEach(cr => {
                if (cr.header === coluna) {
                    cr.resolucao = { codigo_rubrica: codigo, tipo_valor: tipoValor, descricao: coluna, fonte: 'config' };
                }
            });
        });

        renderizarRelatorio(linhasRelatorio);
    } catch(err) {
        statusEl.textContent = '❌ Erro: ' + err.message;
        statusEl.style.color = '#E74C3C';
    }
}

async function ignorarRubrica(idx) {
    const l = linhasRelatorio[idx];
    const { error } = await supabaseClient
        .from('fechamento_rubricas_ignoradas')
        .upsert({ codigo_empresa: CODIGO_EMPRESA, coluna_planilha: l.coluna },
                 { onConflict: 'codigo_empresa,coluna_planilha' });
    if (error) { mostrarMensagem('Erro', 'Não foi possível ignorar a rubrica: ' + error.message); return; }
    rubricasIgnoradas.add(normalizarNome(l.coluna));
    renderizarRelatorio(linhasRelatorio);
}

async function reativarRubrica(idx) {
    const l = linhasRelatorio[idx];
    const { error } = await supabaseClient
        .from('fechamento_rubricas_ignoradas')
        .delete()
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('coluna_planilha', l.coluna);
    if (error) { mostrarMensagem('Erro', 'Não foi possível reativar a rubrica: ' + error.message); return; }
    rubricasIgnoradas.delete(normalizarNome(l.coluna));
    renderizarRelatorio(linhasRelatorio);
}

async function alterarTipoRubrica(idx, novoTipo) {
    const coluna = linhasRelatorio[idx].coluna;
    const codigo = linhasRelatorio[idx].codigoRubrica;

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .upsert([{
                codigo_empresa:  CODIGO_EMPRESA,
                coluna_planilha: coluna,
                descricao:       linhasRelatorio[idx].descricao || coluna,
                codigo_rubrica:  codigo,
                tipo_processo:   linhasRelatorio[idx].tipoProcesso || '11',
                tipo_valor:      novoTipo,
                ativo:           true,
            }], { onConflict: 'codigo_empresa,coluna_planilha' });
        if (error) throw error;

        linhasRelatorio.forEach(l => {
            if (l.coluna !== coluna) return;
            l.tipoValor = novoTipo;
            l.valorInt  = novoTipo !== 'booleano' ? valorParaTxt(l.bruto, novoTipo, coluna) : 0;
        });
        planilhaData.forEach(f => {
            f.colunasRubrica.forEach(cr => {
                if (cr.header === coluna) cr.resolucao.tipo_valor = novoTipo;
            });
        });

        renderizarRelatorio(linhasRelatorio);
    } catch(err) {
        mostrarMensagem('Erro', 'Não foi possível salvar o tipo: ' + err.message);
    }
}

// ──────────────────────────────────────────────
// STEP 3 – GERAR TXT
// ──────────────────────────────────────────────

function irStep3() {
    // Mostrar modal de tipo de processo
    const modalEl = document.getElementById('modalTipoProcesso');
    if (modalEl) {
        // Pré-selecionar tipo atual
        const radios = modalEl.querySelectorAll('input[type=radio]');
        radios.forEach(r => { r.checked = (r.value === tipoFolhaAtual); });
        if (!Array.from(radios).some(r => r.checked)) radios[0].checked = true;
        modalEl.classList.add('active');
    } else {
        // Sem modal: gerar diretamente com tipo 11
        gerarTxt('11');
    }
}

function fecharModalTipoProcesso() {
    document.getElementById('modalTipoProcesso').classList.remove('active');
}

function confirmarTipoProcesso() {
    const sel = document.querySelector('#modalTipoProcesso input[type=radio]:checked');
    const tipo = sel ? sel.value : '11';
    fecharModalTipoProcesso();
    tipoFolhaAtual = tipo;
    gerarTxt(tipo);
    mostrarStep(3);
}

function gerarTxt(tipoProcesso) {
    const comp = document.getElementById('competencia').value.trim();
    linhasTxt = [];

    linhasRelatorio.forEach(l => {
        if (!l.codEmpregado || !l.codigoRubrica || !l.valorInt) return;
        if (rubricasIgnoradas.has(normalizarNome(l.coluna))) return;
        const tp      = l.tipoProcesso || tipoProcesso || '11';
        const codEmp  = l.codEmpresa || CODIGO_EMPRESA;
        linhasTxt.push(gerarLinhaTxt(l.codEmpregado, comp, l.codigoRubrica, tp, l.valorInt, codEmp));
    });

    const preview = document.getElementById('previaTxt');
    if (!linhasTxt.length) {
        preview.textContent = '(nenhuma linha gerada — verifique se há colaboradores e rubricas mapeados)';
    } else {
        preview.textContent = linhasTxt.join('\n');
    }

    document.getElementById('resumoTxt').textContent =
        `${linhasTxt.length} linha(s) gerada(s) · Competência ${comp} · Tipo ${tipoProcesso}`;
}

function baixarTXT() {
    const comp = document.getElementById('competencia').value.trim() || 'sem-data';
    const blob  = new Blob([linhasTxt.join('\n')], {type:'text/plain;charset=utf-8;'});
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `Fechamento_TrackField_${tipoFolhaAtual}_${comp.replace('/','_')}.txt`,
    });
    a.click(); URL.revokeObjectURL(a.href);
}

// ──────────────────────────────────────────────
// PAINEL DE ENVIOS DO FORMULÁRIO
// ──────────────────────────────────────────────

const TIPO_FOLHA_LABELS = {
    '11':'Folha Mensal','41':'Adiantamento Salarial','42':'Folha Complementar',
    '51':'Adiantamento de 13º Salário','52':'13º Salário (integral ou 2ª parcela)',
    '70':'PLR (Participação nos Lucros e Resultados)'
};

async function carregarEnvios() {
    const container = document.getElementById('listaEnvios');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:10px 0;">Carregando...</div>';

    const { data, error } = await supabaseClient
        .from('quadrante_folha_envios')
        .select('id, competencia, tipo_folha, enviado_em, processado, dados')
        .eq('empresa_codigo', CODIGO_EMPRESA)
        .order('enviado_em', { ascending: false })
        .limit(20);

    if (error || !data?.length) {
        container.innerHTML = '<div class="envios-vazio">Nenhum envio encontrado. Use o formulário para enviar dados de fechamento.</div>';
        return;
    }

    container.innerHTML = data.map(env => {
        const tipoLabel  = TIPO_FOLHA_LABELS[env.tipo_folha] || env.tipo_folha;
        const enviadoEm  = new Date(env.enviado_em).toLocaleString('pt-BR');
        const proc       = env.processado;
        const isPlanilha = env.dados?.fonte === 'planilha';
        const fonteLabel = isPlanilha ? 'Planilha' : 'Formulário';
        const badge      = isPlanilha
            ? '<div class="envio-badge processado">📊 Planilha</div>'
            : `<div class="envio-badge ${proc ? 'processado' : ''}">📝 Formulário</div>`;
        const btnLabel   = isPlanilha ? '↻ Recarregar' : (proc ? '↻ Reprocessar' : '▶ Processar');
        return `
        <div class="envio-card">
            ${badge}
            <div class="envio-info">
                <div class="envio-info-title">Competência ${env.competencia} · ${env.tipo_folha} – ${tipoLabel}</div>
                <div class="envio-info-sub">Fonte: ${fonteLabel} · Enviado em ${enviadoEm} · Track &amp; Field · TF</div>
            </div>
            <div class="envio-actions">
                <button class="btn-processar-envio ${proc || isPlanilha ? 'processado' : ''}"
                    onclick="processarEnvio(${env.id})">
                    ${btnLabel}
                </button>
            </div>
        </div>`;
    }).join('');
}

async function processarEnvio(id) {
    const { data, error } = await supabaseClient
        .from('quadrante_folha_envios')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) { mostrarMensagem('Erro', 'Não foi possível carregar o envio.'); return; }

    try {
        await Promise.all([carregarFuncionarios(), carregarRubricas(), carregarEmpregadosConfig(), carregarRubricasIgnoradas()]);
        if (data.dados?.fonte === 'planilha') {
            await recarregarPlanilha(data);
        } else {
            await processarDadosFormulario(data);
        }
    } catch(err) {
        mostrarMensagem('Erro', 'Falha ao processar o envio: ' + err.message);
    }
}

async function recarregarPlanilha(envioRow) {
    const d           = envioRow.dados;
    const competencia = d.competencia || '';
    const tipoFolha   = d.tipo_folha  || '11';
    const tipoLabel   = TIPO_FOLHA_LABELS[tipoFolha] || tipoFolha;
    const label       = `${competencia} · ${tipoFolha} – ${tipoLabel}`;

    tipoFolhaAtual = tipoFolha;
    document.getElementById('competencia').value = competencia;
    document.getElementById('headerSubtitle').textContent = `Track & Field · TF · ${label} · via Planilha`;
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + label;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + label;

    linhasRelatorio = d.linhas || [];
    linhasTxt = [];

    const temSemMatch = linhasRelatorio.some(l => !l.codEmpregado);
    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
    mostrarStep(2);
}

// Mapa: campo do formulário Track & Field → cabeçalho de rubrica na planilha/config
const CAMPO_PARA_HEADER = {
    salario:    'SALÁRIO FIXO',
    comissao:   'COMISSÃO / QUEBRA DE CAIXA',
    comdoming:  'COMISSÃO DOMINGOS/FERIADOS',
    vt:         'VALE TRANSPORTE',
    gratvr:     'GRATIFICAÇÃO VR / QUEBRA DE CAIXA',
    premiacao:  'PREMIAÇÃO META BATIDA',
    atestados:  'ATESTADOS',
    faltas:     'FALTAS',
};

async function processarDadosFormulario(envioRow) {
    const d           = envioRow.dados;
    const competencia = d.competencia || '';
    const tipoFolha   = d.tipo_folha  || '11';
    const tipoLabel   = TIPO_FOLHA_LABELS[tipoFolha] || tipoFolha;
    const label       = `${competencia} · ${tipoFolha} – ${tipoLabel}`;

    tipoFolhaAtual = tipoFolha;
    document.getElementById('competencia').value = competencia;
    document.getElementById('headerSubtitle').textContent =
        `Track & Field · TF · ${label} · via Formulário`;
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + label;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + label;

    const colunasRubrica = Object.entries(CAMPO_PARA_HEADER).map(([campo, header]) => ({
        campo,
        header,
        resolucao: resolverColuna(header) || { codigo_rubrica: null, tipo_valor: null, descricao: header, fonte: null, tipo_processo: null },
    }));

    linhasRelatorio = [];
    linhasTxt       = [];
    let temSemMatch = false;

    (d.employees || []).forEach(emp => {
        const codEmpresa   = codigoEmpresaPorLoja(emp.loja || '');
        const codEmpresaDB = codigoEmpresaDBPorLoja(emp.loja || '');
        const codEmpregado = buscarCodigoEmpregado(emp.colaborador || emp.nome || '', codEmpresaDB);
        if (!codEmpregado) temSemMatch = true;

        colunasRubrica.forEach(({ campo, header, resolucao }) => {
            const bruto = emp[campo];
            if (bruto === '' || bruto == null) return;

            const tipoValor = resolucao.tipo_valor;
            const valorInt  = tipoValor && tipoValor !== 'booleano'
                ? valorParaTxt(String(bruto), tipoValor, header)
                : 0;

            linhasRelatorio.push({
                nome:          emp.colaborador || emp.nome || '',
                loja:          emp.loja || '',
                cargo:         emp.cargo || '',
                codEmpresa,
                codEmpregado,
                coluna:        header,
                descricao:     resolucao.descricao || header,
                codigoRubrica: resolucao.codigo_rubrica,
                fonteRubrica:  resolucao.fonte,
                tipoProcesso:  resolucao.tipo_processo || tipoFolha,
                tipoValor,
                bruto,
                valorInt,
            });
        });

        // Campos de texto extra (observacoes) como informativos, se houver rubrica mapeada
        if (emp.observacoes) {
            const resObs = resolverColuna('OBSERVAÇÕES');
            if (resObs?.codigo_rubrica) {
                linhasRelatorio.push({
                    nome:          emp.colaborador || emp.nome || '',
                    loja:          emp.loja || '',
                    cargo:         emp.cargo || '',
                    codEmpresa,
                    codEmpregado,
                    coluna:        'OBSERVAÇÕES',
                    descricao:     resObs.descricao || 'Observações',
                    codigoRubrica: resObs.codigo_rubrica,
                    fonteRubrica:  resObs.fonte,
                    tipoProcesso:  resObs.tipo_processo || tipoFolha,
                    tipoValor:     resObs.tipo_valor,
                    bruto:         emp.observacoes,
                    valorInt:      0,
                });
            }
        }
    });

    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';

    await supabaseClient.from('quadrante_folha_envios')
        .update({ processado: true }).eq('id', envioRow.id);

    renderizarRelatorio(linhasRelatorio);
    mostrarStep(2);
    carregarEnvios();
}

// ──────────────────────────────────────────────
// SIDEBAR + NAVEGAÇÃO
// ──────────────────────────────────────────────

let _modoAtual = 'processamento';

(function() {
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
    });
})();

function fecharSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function navegarPara(modo) {
    _modoAtual = modo;
    fecharSidebar();

    document.getElementById('navProcessamento').classList.toggle('active', modo === 'processamento');
    document.getElementById('navConfig').classList.toggle('active', modo === 'config');

    const telaProc   = document.getElementById('telaProcessamento');
    const telaConfig = document.getElementById('telaConfig');

    if (modo === 'config') {
        if (telaProc) telaProc.style.display = 'none';
        telaConfig.classList.add('active');
        iniciarConfig();
    } else {
        if (telaProc) telaProc.style.display = '';
        telaConfig.classList.remove('active');
    }
}

// ──────────────────────────────────────────────
// CONFIGURAÇÕES – RUBRICAS
// ──────────────────────────────────────────────

let _assocEmpresas = [];

async function iniciarConfig() {
    await carregarEmpresasConfig();
    await carregarRubricasConfig();
}

async function carregarEmpresasConfig() {
    if (_assocEmpresas.length) return;
    try {
        const { data } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa');
        _assocEmpresas = data || [];

        const populaSelect = id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const atual = sel.value;
            const prefix = id === 'cfgFiltroEmpresa'
                ? '<option value="">Todas as empresas</option>'
                : '<option value="">Selecione...</option>';
            sel.innerHTML = prefix + _assocEmpresas.map(e =>
                `<option value="${e.codigo_empresa}">${e.codigo_empresa} – ${e.nome_empresa || ''}</option>`
            ).join('');
            if (atual) sel.value = atual;
        };
        populaSelect('cfgEmpresa');
        populaSelect('cfgFiltroEmpresa');
        document.getElementById('cfgEmpresa').value = CODIGO_EMPRESA;
    } catch(err) {
        console.error('Erro ao carregar empresas:', err);
    }
}

async function carregarRubricasConfig() {
    const tbody = document.getElementById('cfgTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Carregando...</td></tr>';
    const filtroEmp = document.getElementById('cfgFiltroEmpresa')?.value || '';

    try {
        let q = supabaseClient
            .from('fechamento_rubricas_config')
            .select('id, codigo_empresa, descricao, codigo_rubrica, tipo_valor, ativo')
            .order('codigo_empresa').order('descricao');
        if (filtroEmp) q = q.eq('codigo_empresa', filtroEmp);

        const { data, error } = await q;
        if (error) throw error;

        const lista = data || [];
        document.getElementById('cfgTotal').textContent = lista.length + ' rubrica(s)';

        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Nenhuma rubrica cadastrada.</td></tr>';
            return;
        }

        const tipoLabel = { monetario:'Monetário', minutos:'Horas', dias:'Dias', booleano:'Booleano' };
        tbody.innerHTML = lista.map(r => `
            <tr>
                <td><strong>${r.codigo_empresa}</strong></td>
                <td>${r.descricao || '–'}</td>
                <td style="font-family:monospace;font-weight:600;">${r.codigo_rubrica}</td>
                <td>${tipoLabel[r.tipo_valor] || r.tipo_valor}</td>
                <td>${r.ativo ? '✅' : '❌'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-small" onclick="toggleAtivoRubrica('${r.id}',${r.ativo})"
                        style="margin-right:4px;">${r.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:white;"
                        onclick="deletarRubricaConfig('${r.id}')">Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="6" class="config-empty" style="color:#E74C3C;">Erro: ${err.message}</td></tr>`;
    }
}

async function salvarRubricaConfig() {
    const empresa   = document.getElementById('cfgEmpresa').value.trim();
    const descricao = document.getElementById('cfgDescricao').value.trim();
    const codigo    = document.getElementById('cfgCodigo').value.trim();
    const tipoValor = document.getElementById('cfgTipoValor').value;

    if (!empresa || !descricao || !codigo) {
        mostrarStatusConfig('Preencha os campos obrigatórios: Empresa, Descrição e Código.', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .insert([{
                codigo_empresa:  empresa,
                coluna_planilha: descricao,
                descricao:       descricao,
                codigo_rubrica:  codigo,
                tipo_processo:   '11',
                tipo_valor:      tipoValor,
                ativo:           true,
            }]);
        if (error) throw error;

        document.getElementById('cfgDescricao').value = '';
        document.getElementById('cfgCodigo').value = '';
        mostrarStatusConfig('✅ Rubrica salva com sucesso!', 'success');
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfig('❌ Erro: ' + err.message, 'error');
    }
}

async function toggleAtivoRubrica(id, ativo) {
    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .update({ ativo: !ativo }).eq('id', id);
        if (error) throw error;
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfig('❌ Erro: ' + err.message, 'error');
    }
}

async function deletarRubricaConfig(id) {
    if (!confirm('Excluir esta rubrica?')) return;
    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .delete().eq('id', id);
        if (error) throw error;
        mostrarStatusConfig('✅ Rubrica excluída.', 'success');
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfig('❌ Erro: ' + err.message, 'error');
    }
}

function mostrarStatusConfig(msg, tipo) {
    const el = document.getElementById('statusConfig');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = tipo === 'success' ? '#D4EDDA' : '#F8D7DA';
    el.style.color       = tipo === 'success' ? '#155724' : '#721C24';
    el.style.border      = '1px solid ' + (tipo === 'success' ? '#C3E6CB' : '#F5C6CB');
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
