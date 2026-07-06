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
// R$ 87,00 → tipo inteiro, valor 1 no TXT
const COL_87_DOMINGO  = 'COMISSÃO DOMINGOS/FERIADOS - DOMINGO - R87';
const COL_87_FERIADO  = 'COMISSÃO DOMINGOS/FERIADOS - FERIADO - R87';
// Demais valores → tipo monetário, valor em centavos no TXT
const COL_DOM         = 'COMISSÃO DOMINGOS/FERIADOS - DOMINGO';
const COL_FER         = 'COMISSÃO DOMINGOS/FERIADOS - FERIADO';
// Desconto manual de VT/VA por faltas/atestados (lançado ao gerar o TXT, não vem da planilha)
const COL_DESCONTO_VT = 'DESCONTO VALE TRANSPORTE (MANUAL)';
const COL_DESCONTO_VA = 'DESCONTO VALE ALIMENTAÇÃO (MANUAL)';

// Mapeamento loja → { codTxt: código numérico para o TXT, codDB: código no rh_empregados }
const LOJAS_TF = {
    'AEROPORTO':         { codTxt: '113', codDB: '113' },
    'CONJUNTO NACIONAL': { codTxt: '128', codDB: '128' },
    'TR CONJUNTO':       { codTxt: '128', codDB: '128' },
    'PÁTIO BRASIL':      { codTxt: '126', codDB: '126' },
    'PATIO BRASIL':      { codTxt: '126', codDB: '126' },
    'DF PLAZA':          { codTxt: '115', codDB: '115' },
    'TR CNB':            { codTxt: '464', codDB: '464' },
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
let envioAtualId    = null; // id do registro em quadrante_folha_envios para persistência
let empregadosConfig  = {}; // codEmpresaDB → { nome_normalizado → codigo_empregado }
let rubricasIgnoradas = new Set(); // normalizarNome(coluna_planilha) → excluir do TXT
let faltaDatasMap     = {}; // `${codEmpregado}::${normColuna}` → string raw de datas inseridas
let descontoPendentes    = []; // lançamentos manuais de desconto VT/VA antes de gerar o TXT
let tipoProcessoPendente = '11'; // tipo escolhido no modal, aguardando decisão de desconto VT/VA

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

function isColunaFalta(coluna) {
    return normalizarNome(coluna).includes('falta');
}

function registrarFaltaDatas(key, valor) {
    faltaDatasMap[key] = valor;
}

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
    const sStr = String(s);

    // Se contém R$, extrai diretamente — evita que prefixos de data corrompam o parse
    const rMatches = sStr.match(/R\$\s*[\d.,]+/gi) || [];
    if (rMatches.length > 0) {
        let total = 0;
        rMatches.forEach(m => {
            const clean = m.replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.');
            total += parseFloat(clean) || 0;
        });
        return Math.round(total * 100);
    }

    // Sem R$: parse numérico direto (número puro do Excel ou formato PT-BR)
    const str = sStr.replace(/\s/g, '').trim();
    if (!str) return 0;
    if (str.includes(',')) {
        const num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(num) && num > 0) return Math.round(num * 100);
    }
    const num = parseFloat(str.replace(/[^\d.]/g, ''));
    return (!isNaN(num) && num > 0) ? Math.round(num * 100) : 0;
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
    // Overrides por cabeçalho só se o tipo não for 'inteiro' (inteiro tem regra própria no switch)
    if (tipoValor !== 'inteiro') {
        if (h.includes('domingo') || h.includes('feriado')) {
            return parseMoney(bruto);
        }
        if (h.includes('atestado') || h.includes('falta')) {
            return parseDiasTexto(bruto);
        }
    }
    switch (tipoValor) {
        case 'monetario': return parseMoney(bruto);
        case 'minutos':   return parseHoras(bruto);
        case 'dias':      return parseDiasTexto(bruto);
        case 'inteiro':   return Math.round(parseMoney(bruto) / 8700) || parseDiasTexto(bruto);
        default:          return 0;
    }
}

function isDomingoFeriado(header) {
    const h = normalizarNome(header);
    return h.includes('domingo') || h.includes('feriado');
}

// Determina tipo e valor para qualquer entry de COMISSÃO DOMINGOS/FERIADOS:
// R$ 87,00 = 1 inteiro; demais valores = centavos monetário
function _tipoValorDomFer(bruto) {
    const centavos = parseMoney(String(bruto));
    if (centavos === 8700) return { tipoValor: 'inteiro', valorInt: 1 };
    return { tipoValor: 'monetario', valorInt: centavos };
}

// Converte centavos em item de expansão usando a mesma regra
function _itemExpansao(brutoStr, valorCentavos) {
    const { tipoValor, valorInt } = _tipoValorDomFer(brutoStr);
    return { bruto: brutoStr, valorInt, tipoValor };
}

// Retorna [{bruto, valorInt, tipoValor}, ...] quando a célula contém múltiplos dias, ou null para valor único
function expandirDomingosFeriados(rawBruto) {
    const str = String(rawBruto).trim();
    if (!str) return null;

    // Tenta separar por quebras de linha ou ponto-e-vírgula (preserva contexto do dia no bruto)
    const linhasRaw = str.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
    if (linhasRaw.length > 1) {
        const resultados = [];
        linhasRaw.forEach(linha => {
            const m = linha.match(/R\$\s*[\d.,]+/i);
            if (!m) return;
            const clean = m[0].replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.');
            const centavos = Math.round((parseFloat(clean) || 0) * 100);
            if (centavos > 0) resultados.push(_itemExpansao(linha, centavos));
        });
        if (resultados.length > 1) return resultados;
    }

    // Fallback: múltiplos R$ na mesma linha
    const matches = str.match(/R\$\s*[\d.,]+/gi) || [];
    if (matches.length > 1) {
        return matches.map(m => {
            const clean = m.replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.');
            const centavos = Math.round((parseFloat(clean) || 0) * 100);
            return _itemExpansao(m.trim(), centavos);
        }).filter(item => item.valorInt > 0);
    }

    return null;
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
        case 'dias':    return valorTxt + ' dias';
        case 'inteiro': return String(valorTxt);
        default:        return valorTxt;
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
        .in('codigo_empresa', ['113', '115', '126', '128', '464']);
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

function _codigosTF() {
    // Códigos reais das lojas + CODIGO_EMPRESA ('TF') para retrocompatibilidade
    return [...new Set([...Object.values(LOJAS_TF).map(l => l.codTxt), CODIGO_EMPRESA])];
}

async function carregarRubricas() {
    const codigos = _codigosTF();

    const { data: cfgData, error: cfgErr } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao, codigo_empresa')
        .in('codigo_empresa', codigos)
        .eq('ativo', true);
    if (cfgErr) throw cfgErr;
    rubricasConfig = cfgData || [];

    rhRubricasData = []; // carregado apenas na tela de configurações, não durante o processamento
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

        // Salvar histórico e capturar id para persistência posterior
        supabaseClient.from('quadrante_folha_envios').insert({
            empresa_codigo: CODIGO_EMPRESA,
            competencia:    comp,
            tipo_folha:     tipoFolhaAtual,
            dados:          { fonte: 'planilha', competencia: comp, tipo_folha: tipoFolhaAtual, linhas: linhasRelatorio },
            processado:     true,
        }).select('id').single().then(({ data, error }) => {
            if (error) console.warn('Histórico planilha não salvo:', error.message);
            else { envioAtualId = data?.id; carregarEnvios(); }
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
    faltaDatasMap = {};
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

            // Expande célula com múltiplos dias em linhas individuais
            if (isDomingoFeriado(header)) {
                const itens = expandirDomingosFeriados(bruto);
                if (itens && itens.length > 0) {
                    itens.forEach(item => {
                        const entry = {
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
                            tipoValor:     item.tipoValor,
                            bruto:         item.bruto,
                            valorInt:      item.valorInt,
                        };
                        entry.tipo87 = null; // toda entry dom/fer exige classificação
                        linhasRelatorio.push(entry);
                    });
                    return;
                }
            }

            const tipoValor = resolucao.tipo_valor;
            const valorInt  = tipoValor && tipoValor !== 'booleano'
                ? valorParaTxt(bruto, tipoValor, header)
                : 0;

            const entryNormal = {
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
            };
            if (isDomingoFeriado(header)) {
                const tv = _tipoValorDomFer(bruto);
                entryNormal.tipo87    = null;
                entryNormal.tipoValor = tv.tipoValor;
                entryNormal.valorInt  = tv.valorInt;
            }
            linhasRelatorio.push(entryNormal);
        });
    });

    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
}

function renderizarRelatorio(linhas) {
    const tbody = document.getElementById('bodyRelatorio');
    tbody.innerHTML = '';

    linhas.forEach((l, i) => {
        const semFuncionario       = !l.codEmpregado;
        const semRubrica           = !l.codigoRubrica;
        const ignorada             = !semRubrica && rubricasIgnoradas.has(normalizarNome(l.coluna));
        const precisaClassificar87 = ('tipo87' in l) && l.tipo87 === null;

        const fonteTag = !semRubrica && !ignorada
            ? (l.fonteRubrica === 'config'
                ? '<span style="font-size:10px;color:var(--primary-color);margin-left:4px;" title="Associação da ferramenta">★</span>'
                : '<span style="font-size:10px;color:#7F8C8D;margin-left:4px;" title="rh_rubricas (fallback)">◎</span>')
            : '';

        const tipo87Badge = ('tipo87' in l) && l.tipo87
            ? `<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:600;background:${l.tipo87==='domingo'?'#FFF3CD':'#D1ECF1'};color:${l.tipo87==='domingo'?'#856404':'#0C5460'};">${l.tipo87==='domingo'?'☀ Dom':'📅 Fer'}</span>`
            : '';

        const rubricaCell = precisaClassificar87
            ? '<em style="color:#7F8C8D;font-size:12px;">↓ classificar</em>'
            : semRubrica
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
            precisaClassificar87
                ? `<button class="btn btn-secondary btn-small" style="background:#FFF3CD;border-color:#FFEAA7;color:#856404;"
                    onclick="classificar87(${i},'domingo')" title="Lançar como comissão de domingo">☀ Domingo</button>
                   <button class="btn btn-secondary btn-small" style="background:#D1ECF1;border-color:#BEE5EB;color:#0C5460;"
                    onclick="classificar87(${i},'feriado')" title="Lançar como comissão de feriado">📅 Feriado</button>`
                : semRubrica
                    ? `<button class="btn btn-secondary btn-small"
                        onclick="abrirCadastroRubrica(${i})"
                        title="Cadastrar rubrica">+ Rubrica</button>`
                    : '',
            !precisaClassificar87 && !semRubrica && !ignorada
                ? `<button class="btn btn-secondary btn-small" style="color:#999;"
                    onclick="ignorarRubrica(${i})" title="Excluir do TXT">⊘ Ignorar</button>`
                : '',
            ignorada
                ? `<button class="btn btn-secondary btn-small"
                    onclick="reativarRubrica(${i})" title="Voltar a incluir no TXT">↩ Reativar</button>`
                : '',
            ('tipo87' in l) && l.tipo87
                ? `<button class="btn btn-secondary btn-small" style="color:#aaa;font-size:10px;"
                    onclick="classificar87(${i},null)" title="Reclassificar">↺</button>`
                : '',
        ].filter(Boolean).join(' ');
        const acaoHtml = acaoBtns;

        const trStyle = ignorada
            ? 'background:#f5f5f5;opacity:0.6;'
            : precisaClassificar87
                ? 'background:#FFFDE7;'
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
            <td>${l.descricao || l.coluna}${tipo87Badge}${fonteTag}</td>
            <td style="font-family:monospace;${semRubrica?'color:#e74c3c;':''}">${rubricaCell}</td>
            <td>${('tipo87' in l)
                ? `<span class="badge" style="background:${l.tipoValor==='inteiro'?'#FFF3CD':'#e3f2fd'};color:${l.tipoValor==='inteiro'?'#856404':'#1565C0'};padding:3px 8px;border-radius:4px;font-size:11px;" title="Tipo definido pelo valor">${l.tipoValor}</span>`
                : !semRubrica && !ignorada
                    ? `<select class="tipo-select" onchange="alterarTipoRubrica(${i}, this.value)" title="Alterar tipo do valor">
                        <option value="monetario" ${l.tipoValor==='monetario'?'selected':''}>monetário</option>
                        <option value="minutos"   ${l.tipoValor==='minutos'  ?'selected':''}>horas</option>
                        <option value="dias"      ${l.tipoValor==='dias'     ?'selected':''}>dias</option>
                        <option value="inteiro"   ${l.tipoValor==='inteiro'  ?'selected':''}>inteiro</option>
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

        if (semRubrica && !precisaClassificar87) {
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
                            <option value="monetario" ${l.tipoValor==='monetario'?'selected':''}>Monetário (R$)</option>
                            <option value="minutos"   ${l.tipoValor==='minutos'  ?'selected':''}>Horas (HH:MM)</option>
                            <option value="dias"      ${l.tipoValor==='dias'     ?'selected':''}>Dias</option>
                            <option value="inteiro"   ${l.tipoValor==='inteiro'  ?'selected':''}>Inteiro</option>
                            <option value="booleano"  ${l.tipoValor==='booleano' ?'selected':''}>Booleano</option>
                        </select>
                        <button class="btn btn-primary btn-small" onclick="salvarRubricaInline(${i})">💾 Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="fecharCadastroRubrica(${i})">Cancelar</button>
                        <span id="inlineStatus-${i}" style="font-size:12px;"></span>
                    </div>
                </td>
            `;
            tbody.appendChild(trForm);
        }

        // Input de datas para rubricas de falta
        if (!semRubrica && !ignorada && isColunaFalta(l.coluna) && l.codEmpregado) {
            const _tipo     = normalizarNome(l.coluna).includes('dsr') ? '2' : '1';
            const _faltaKey = `${l.codEmpregado}::${normalizarNome(l.coluna)}`;
            const _valAtual = (faltaDatasMap[_faltaKey] || '').replace(/"/g, '&quot;');
            const _tipoLabel = _tipo === '2' ? 'DSR' : 'Normal';

            const trFaltaDatas = document.createElement('tr');
            trFaltaDatas.style.background = '#EFF6FF';
            trFaltaDatas.innerHTML = `
                <td colspan="11">
                    <div style="padding:5px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:11px;font-weight:600;color:#1D4ED8;white-space:nowrap;">
                            📅 Datas falta ${_tipoLabel} — ${l.nome}:
                        </span>
                        <input type="text"
                            data-falta-key="${_faltaKey.replace(/"/g, '&quot;')}"
                            oninput="registrarFaltaDatas(this.dataset.faltaKey, this.value)"
                            placeholder="DD/MM/AAAA, DD/MM/AAAA, ..."
                            value="${_valAtual}"
                            style="flex:1;min-width:240px;padding:4px 8px;border:1px solid #93C5FD;border-radius:4px;font-size:12px;font-family:monospace;">
                        <span style="font-size:11px;color:#6B7280;">separadas por vírgula</span>
                    </div>
                </td>
            `;
            tbody.appendChild(trFaltaDatas);
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

function persistirLinhas() {
    if (!envioAtualId) return;
    const comp = document.getElementById('competencia').value.trim();
    supabaseClient.from('quadrante_folha_envios')
        .update({ dados: { fonte: 'planilha', competencia: comp, tipo_folha: tipoFolhaAtual, linhas: linhasRelatorio } })
        .eq('id', envioAtualId)
        .then(({ error }) => { if (error) console.warn('Erro ao persistir linhas:', error.message); });
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

function classificar87(idx, tipo) {
    const l = linhasRelatorio[idx];
    if (!('tipo87' in l)) return;

    if (tipo === null) {
        l.tipo87 = null;
        l.coluna        = 'COMISSÃO DOMINGOS/FERIADOS';
        l.descricao     = 'COMISSÃO DOMINGOS/FERIADOS';
        l.codigoRubrica = null;
        l.fonteRubrica  = null;
        renderizarRelatorio(linhasRelatorio);
        persistirLinhas();
        return;
    }

    l.tipo87 = tipo;
    // R$ 87,00 (inteiro) → rubrica específica; demais valores → rubrica geral
    const novaColuna = l.tipoValor === 'inteiro'
        ? (tipo === 'domingo' ? COL_87_DOMINGO : COL_87_FERIADO)
        : (tipo === 'domingo' ? COL_DOM        : COL_FER);
    l.coluna = novaColuna;

    // Lookup EXATO com preferência pela empresa da linha — evita retornar entrada antiga de 'TF'
    const normCol    = normalizarNome(novaColuna);
    const empresaLinha = l.codEmpresa || CODIGO_EMPRESA;
    const cfg = rubricasConfig.find(c => normalizarNome(c.coluna_planilha) === normCol && c.codigo_empresa === empresaLinha)
             || rubricasConfig.find(c => normalizarNome(c.coluna_planilha) === normCol);
    l.codigoRubrica = cfg?.codigo_rubrica || null;
    l.fonteRubrica  = cfg ? 'config' : null;
    l.descricao     = cfg?.descricao || novaColuna;
    l.tipoProcesso  = cfg?.tipo_processo || '11';
    // tipoValor e valorInt preservados conforme _tipoValorDomFer (87,00→inteiro/1; outros→monetario/centavos)

    renderizarRelatorio(linhasRelatorio);
    persistirLinhas();
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

        const codEmpKey = codEmpresaDB || CODIGO_EMPRESA;
        if (!empregadosConfig[codEmpKey]) empregadosConfig[codEmpKey] = {};
        empregadosConfig[codEmpKey][normalizarNome(nome)] = codigo;

        const normNome = normalizarNome(nome);
        linhasRelatorio.forEach(l => {
            if (normalizarNome(l.nome) === normNome && l.loja === linha.loja) {
                l.codEmpregado = codigo;
            }
        });

        renderizarRelatorio(linhasRelatorio);
        persistirLinhas();
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
            l.fonteRubrica  = 'config';
            // Linhas tipo87 mantêm tipoValor/valorInt definidos por _tipoValorDomFer
            if (!('tipo87' in l)) {
                l.tipoValor = tipoValor;
                l.valorInt  = tipoValor !== 'booleano' ? valorParaTxt(l.bruto, tipoValor, coluna) : 0;
            }
        });

        planilhaData.forEach(f => {
            f.colunasRubrica.forEach(cr => {
                if (cr.header === coluna) {
                    cr.resolucao = { codigo_rubrica: codigo, tipo_valor: tipoValor, descricao: coluna, fonte: 'config' };
                }
            });
        });

        renderizarRelatorio(linhasRelatorio);
        persistirLinhas();
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
            if ('tipo87' in l) return; // tipo87 preserva tipoValor/valorInt do _tipoValorDomFer
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
    tipoProcessoPendente = tipo;
    document.getElementById('modalDescontoPergunta').classList.add('active');
}

// ──────────────────────────────────────────────
// DESCONTO MANUAL DE VT/VA (FALTAS/ATESTADOS)
// ──────────────────────────────────────────────

function construirDescontoConfigMap() {
    const mapa = {};
    rubricasConfig.forEach(c => {
        if (c.coluna_planilha !== COL_DESCONTO_VT && c.coluna_planilha !== COL_DESCONTO_VA) return;
        if (!mapa[c.codigo_empresa]) mapa[c.codigo_empresa] = { vt: null, va: null };
        if (c.coluna_planilha === COL_DESCONTO_VT) mapa[c.codigo_empresa].vt = c.codigo_rubrica;
        else mapa[c.codigo_empresa].va = c.codigo_rubrica;
    });
    return mapa;
}

function fecharModalDescontoPergunta() {
    document.getElementById('modalDescontoPergunta').classList.remove('active');
}

function descontoNaoInformar() {
    fecharModalDescontoPergunta();
    gerarTxt(tipoProcessoPendente);
    mostrarStep(3);
}

function descontoAbrirForm() {
    fecharModalDescontoPergunta();
    descontoPendentes = [];
    renderizarDescontoPendentes();
    popularSelectDescontoEmpresa();
    document.getElementById('descValorVT').value = '';
    document.getElementById('descValorVA').value = '';
    document.getElementById('descStatus').style.display = 'none';
    document.getElementById('modalDescontoForm').classList.add('active');
}

function fecharModalDescontoForm() {
    document.getElementById('modalDescontoForm').classList.remove('active');
}

function popularSelectDescontoEmpresa() {
    const codigosPresentes = [...new Set(planilhaData.map(f => codigoEmpresaPorLoja(f.loja)))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const sel = document.getElementById('descEmpresa');
    sel.innerHTML = '<option value="">Selecione...</option>' + codigosPresentes.map(cod => {
        const label = _assocEmpresas.find(e => e.codigo_empresa === cod)?.nome_empresa || '';
        return `<option value="${cod}">${cod} – ${label}</option>`;
    }).join('');
    popularSelectDescontoEmpregado();
}

function popularSelectDescontoEmpregado() {
    const cod = document.getElementById('descEmpresa').value;
    const sel = document.getElementById('descEmpregado');
    if (!cod) { sel.innerHTML = '<option value="">Selecione a empresa primeiro</option>'; return; }
    const empregados = planilhaData
        .filter(f => codigoEmpresaPorLoja(f.loja) === cod)
        .map(f => ({ nome: f.nome, codigo: buscarCodigoEmpregado(f.nome, codigoEmpresaDBPorLoja(f.loja)) }))
        .filter((e, i, arr) => arr.findIndex(x => x.nome === e.nome) === i)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    sel.innerHTML = empregados.map(e =>
        `<option value="${e.codigo || ''}" data-nome="${e.nome}">${e.nome}${e.codigo ? '' : ' (sem código cadastrado)'}</option>`
    ).join('');
}

function mostrarStatusDesconto(msg, tipo) {
    const el = document.getElementById('descStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = tipo === 'success' ? '#D4EDDA' : '#F8D7DA';
    el.style.color       = tipo === 'success' ? '#155724' : '#721C24';
    el.style.border      = '1px solid ' + (tipo === 'success' ? '#C3E6CB' : '#F5C6CB');
}

function adicionarDescontoLinha() {
    const selEmpresa    = document.getElementById('descEmpresa');
    const selEmpregado  = document.getElementById('descEmpregado');
    const codEmpresa    = selEmpresa.value;
    const codEmpregado  = selEmpregado.value;
    const nomeEmpregado = selEmpregado.selectedOptions[0]?.dataset.nome || '';
    const valorVT = parseFloat((document.getElementById('descValorVT').value || '').replace(',', '.')) || 0;
    const valorVA = parseFloat((document.getElementById('descValorVA').value || '').replace(',', '.')) || 0;

    if (!codEmpresa) { mostrarStatusDesconto('⚠ Selecione a empresa.', 'error'); return; }
    if (!codEmpregado) { mostrarStatusDesconto('⚠ Selecione um empregado com código cadastrado.', 'error'); return; }
    if (valorVT <= 0 && valorVA <= 0) { mostrarStatusDesconto('⚠ Informe ao menos um valor de desconto (VT ou VA).', 'error'); return; }

    const cfg = construirDescontoConfigMap()[codEmpresa] || {};
    if (valorVT > 0 && !cfg.vt) {
        mostrarStatusDesconto(`⚠ Cadastre o código da rubrica de Vale Transporte para a empresa ${codEmpresa} em Configurações antes de lançar este desconto.`, 'error');
        return;
    }
    if (valorVA > 0 && !cfg.va) {
        mostrarStatusDesconto(`⚠ Cadastre o código da rubrica de Vale Alimentação para a empresa ${codEmpresa} em Configurações antes de lançar este desconto.`, 'error');
        return;
    }

    descontoPendentes.push({ codEmpresa, codEmpregado, nomeEmpregado, valorVT, valorVA });
    renderizarDescontoPendentes();

    document.getElementById('descValorVT').value = '';
    document.getElementById('descValorVA').value = '';
    document.getElementById('descStatus').style.display = 'none';
}

function removerDescontoLinha(i) {
    descontoPendentes.splice(i, 1);
    renderizarDescontoPendentes();
}

function renderizarDescontoPendentes() {
    const tbody = document.getElementById('descontoPendentesBody');
    if (!tbody) return;
    if (!descontoPendentes.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="config-empty">Nenhum lançamento adicionado.</td></tr>';
        return;
    }
    tbody.innerHTML = descontoPendentes.map((d, i) => `
        <tr>
            <td><strong>${d.codEmpresa}</strong></td>
            <td>${d.nomeEmpregado}<span style="font-family:monospace;color:#999;font-size:11px;margin-left:6px;">${d.codEmpregado}</span></td>
            <td style="text-align:right;">${d.valorVT > 0 ? 'R$ ' + d.valorVT.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—'}</td>
            <td style="text-align:right;">${d.valorVA > 0 ? 'R$ ' + d.valorVA.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—'}</td>
            <td><button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:#fff;" onclick="removerDescontoLinha(${i})">✕</button></td>
        </tr>
    `).join('');
}

function confirmarDescontosEGerarTxt() {
    if (!descontoPendentes.length) {
        mostrarStatusDesconto('⚠ Adicione ao menos um lançamento antes de continuar.', 'error');
        return;
    }
    const tipo = tipoProcessoPendente;
    const cfgMap = construirDescontoConfigMap();
    const originalLen = linhasRelatorio.length;

    descontoPendentes.forEach(d => {
        const cfg = cfgMap[d.codEmpresa] || {};
        if (d.valorVT > 0 && cfg.vt) {
            linhasRelatorio.push({
                nome: d.nomeEmpregado, loja: '', cargo: '',
                codEmpresa: d.codEmpresa, codEmpregado: d.codEmpregado,
                coluna: COL_DESCONTO_VT, descricao: 'Desconto Vale Transporte',
                codigoRubrica: cfg.vt, fonteRubrica: 'manual',
                tipoProcesso: tipo, tipoValor: 'monetario',
                bruto: d.valorVT, valorInt: Math.round(d.valorVT * 100),
            });
        }
        if (d.valorVA > 0 && cfg.va) {
            linhasRelatorio.push({
                nome: d.nomeEmpregado, loja: '', cargo: '',
                codEmpresa: d.codEmpresa, codEmpregado: d.codEmpregado,
                coluna: COL_DESCONTO_VA, descricao: 'Desconto Vale Alimentação',
                codigoRubrica: cfg.va, fonteRubrica: 'manual',
                tipoProcesso: tipo, tipoValor: 'monetario',
                bruto: d.valorVA, valorInt: Math.round(d.valorVA * 100),
            });
        }
    });

    gerarTxt(tipo);
    linhasRelatorio.length = originalLen;

    fecharModalDescontoForm();
    descontoPendentes = [];
    mostrarStep(3);
}

function gerarTxt(tipoProcesso) {
    const comp = document.getElementById('competencia').value.trim();
    linhasTxt = [];

    // Consolida: soma valores por (empregado + rubrica + empresa + tipoProcesso)
    const mapa = new Map();
    linhasRelatorio.forEach(l => {
        if (!l.codEmpregado || !l.codigoRubrica || !l.valorInt) return;
        if (rubricasIgnoradas.has(normalizarNome(l.coluna))) return;
        const tp     = l.tipoProcesso || tipoProcesso || '11';
        const codEmp = l.codEmpresa || CODIGO_EMPRESA;
        const chave  = `${l.codEmpregado}|${l.codigoRubrica}|${codEmp}|${tp}`;
        if (!mapa.has(chave)) {
            mapa.set(chave, { codEmpregado: l.codEmpregado, nomeEmpregado: l.nome,
                              codigoRubrica: l.codigoRubrica, descricaoRubrica: l.descricao || l.coluna,
                              codEmpresa: codEmp, tp, tipoValor: l.tipoValor,
                              totalMin: 0, totalVal: 0, qtdLancamentos: 0 });
        }
        const e = mapa.get(chave);
        e.qtdLancamentos++;
        if (l.tipoValor === 'minutos') {
            e.totalMin += Math.floor(l.valorInt / 100) * 60 + (l.valorInt % 100);
        } else {
            e.totalVal += l.valorInt;
        }
    });

    // Mapear codigoRubrica → tipo de falta ('1'=faltas, '2'=DSR) por empregado
    const _rubricaFaltaTipo = {}; // `${codEmpregado}|${codigoRubrica}` → '1' ou '2'
    linhasRelatorio.forEach(l => {
        if (!l.codEmpregado || !l.codigoRubrica) return;
        if (!isColunaFalta(l.coluna)) return;
        const _tipo = normalizarNome(l.coluna).includes('dsr') ? '2' : '1';
        _rubricaFaltaTipo[`${l.codEmpregado}|${l.codigoRubrica}`] = _tipo;
    });

    // Coletar datas de falta por empregado, separadas por tipo
    const _faltaDatasEmp = {}; // codEmpregado → { '1': [...], '2': [...] }
    linhasRelatorio.forEach(l => {
        if (!l.codEmpregado || rubricasIgnoradas.has(normalizarNome(l.coluna))) return;
        if (!isColunaFalta(l.coluna)) return;
        const _tipo = normalizarNome(l.coluna).includes('dsr') ? '2' : '1';
        const _key  = `${l.codEmpregado}::${normalizarNome(l.coluna)}`;
        if (!_faltaDatasEmp[l.codEmpregado]) _faltaDatasEmp[l.codEmpregado] = { '1': [], '2': [] };
        (faltaDatasMap[_key] || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).forEach(d => {
            const _m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (_m) _faltaDatasEmp[l.codEmpregado][_tipo].push(`11${_m[3]}${_m[2]}${_m[1]}${_tipo}`);
        });
    });

    // Agrupar linhas de rubrica por empregado preservando ordem de aparição
    // Cada item: { linha: string, codigoRubrica: string }
    const _ordCods = [];
    const _rubPorEmp = {};
    mapa.forEach(e => {
        const valorFinal = e.tipoValor === 'minutos'
            ? Math.floor(e.totalMin / 60) * 100 + (e.totalMin % 60)
            : e.totalVal;
        if (!valorFinal) return;
        e.valorFinal = valorFinal;
        if (!_rubPorEmp[e.codEmpregado]) {
            _rubPorEmp[e.codEmpregado] = [];
            _ordCods.push(e.codEmpregado);
        }
        _rubPorEmp[e.codEmpregado].push({
            linha: gerarLinhaTxt(e.codEmpregado, comp, e.codigoRubrica, e.tp, valorFinal, e.codEmpresa),
            codigoRubrica: e.codigoRubrica,
            codEmpregado: e.codEmpregado,
        });
    });

    // Montar TXT: após cada rubrica de falta/DSR, inserir imediatamente as datas correspondentes
    _ordCods.forEach(cod => {
        (_rubPorEmp[cod] || []).forEach(item => {
            linhasTxt.push(item.linha);
            const tipoFalta = _rubricaFaltaTipo[`${cod}|${item.codigoRubrica}`];
            if (tipoFalta && _faltaDatasEmp[cod]) {
                (_faltaDatasEmp[cod][tipoFalta] || []).forEach(l => linhasTxt.push(l));
            }
        });
    });

    // Resumo consolidado
    const entradas = [...mapa.values()].filter(e => e.valorFinal);
    const divResumo = document.getElementById('resumoConsolidado');
    if (divResumo) {
        if (!entradas.length) {
            divResumo.innerHTML = '';
        } else {
            const linhasTabela = entradas.map(e => {
                const valorExib = e.tipoValor === 'minutos'
                    ? (() => { const h = Math.floor(e.valorFinal / 100), m = e.valorFinal % 100; return `${h}h${String(m).padStart(2,'0')}`; })()
                    : formatarValorExibicao(e.valorFinal, e.tipoValor || 'monetario');
                const tag = e.qtdLancamentos > 1
                    ? `<span style="font-size:10px;background:#e3f2fd;color:#1565C0;padding:1px 6px;border-radius:4px;margin-left:4px;">${e.qtdLancamentos} lanç.</span>`
                    : '';
                return `<tr>
                    <td style="font-family:monospace;font-weight:600;">${e.codEmpresa}</td>
                    <td>${e.nomeEmpregado}<span style="font-family:monospace;color:#999;font-size:11px;margin-left:6px;">${e.codEmpregado}</span></td>
                    <td>${e.descricaoRubrica}<span style="font-family:monospace;color:#999;font-size:11px;margin-left:6px;">${e.codigoRubrica}</span></td>
                    <td style="text-align:right;font-weight:600;">${valorExib}${tag}</td>
                </tr>`;
            }).join('');

            divResumo.innerHTML = `
                <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">
                    Consolidado — ${entradas.length} linha(s) no TXT
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#f5f5f5;color:var(--text-secondary);font-size:11px;text-transform:uppercase;">
                            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #E0E0E0;">Empresa</th>
                            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #E0E0E0;">Empregado</th>
                            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #E0E0E0;">Rubrica</th>
                            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #E0E0E0;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>${linhasTabela}</tbody>
                </table>`;
        }
    }

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

    envioAtualId    = envioRow.id;
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

            // Expande célula com múltiplos dias em linhas individuais
            if (isDomingoFeriado(header)) {
                const itens = expandirDomingosFeriados(String(bruto));
                if (itens && itens.length > 0) {
                    itens.forEach(item => {
                        const entry = {
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
                            tipoValor:     item.tipoValor,
                            bruto:         item.bruto,
                            valorInt:      item.valorInt,
                        };
                        entry.tipo87 = null;
                        linhasRelatorio.push(entry);
                    });
                    return;
                }
            }

            const tipoValor = resolucao.tipo_valor;
            const valorInt  = tipoValor && tipoValor !== 'booleano'
                ? valorParaTxt(String(bruto), tipoValor, header)
                : 0;

            const entryNormal = {
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
            };
            if (isDomingoFeriado(header)) {
                const tv = _tipoValorDomFer(String(bruto));
                entryNormal.tipo87    = null;
                entryNormal.tipoValor = tv.tipoValor;
                entryNormal.valorInt  = tv.valorInt;
            }
            linhasRelatorio.push(entryNormal);
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

    envioAtualId = envioRow.id;

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
    await Promise.all([carregarRubricasConfig(), carregar87Config(), carregarDescontoConfig()]);
}

async function carregarEmpresasConfig() {
    if (_assocEmpresas.length) return;

    // Usa os códigos reais das lojas TF — CODIGO_EMPRESA ('TF') não existe em rh_empresas
    const lojasPorCod = {};
    Object.entries(LOJAS_TF).forEach(([nome, val]) => {
        if (!lojasPorCod[val.codTxt]) lojasPorCod[val.codTxt] = [];
        lojasPorCod[val.codTxt].push(nome);
    });
    const codigos = Object.keys(lojasPorCod).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );
    _assocEmpresas = codigos.map(cod => ({
        codigo_empresa: cod,
        nome_empresa: lojasPorCod[cod].join(' / '),
    }));

    const populaSelect = (id, comTodos) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prefix = comTodos ? '<option value="">Todas as lojas</option>' : '';
        sel.innerHTML = prefix + _assocEmpresas.map(e =>
            `<option value="${e.codigo_empresa}">${e.codigo_empresa} – ${e.nome_empresa}</option>`
        ).join('');
    };
    populaSelect('cfgEmpresa', false);
    populaSelect('cfg87Empresa', false);
    populaSelect('cfgDescEmpresa', false);
    populaSelect('cfgFiltroEmpresa', true);
    const sel = document.getElementById('cfgEmpresa');
    if (sel && codigos.length) sel.value = codigos[0];
    const sel87 = document.getElementById('cfg87Empresa');
    if (sel87 && codigos.length) sel87.value = codigos[0];
    const selDesc = document.getElementById('cfgDescEmpresa');
    if (selDesc && codigos.length) selDesc.value = codigos[0];
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
        if (filtroEmp) {
            q = q.eq('codigo_empresa', filtroEmp);
        } else {
            q = q.in('codigo_empresa', _codigosTF());
        }

        const { data, error } = await q;
        if (error) throw error;

        const lista = data || [];
        document.getElementById('cfgTotal').textContent = lista.length + ' rubrica(s)';

        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Nenhuma rubrica cadastrada.</td></tr>';
            return;
        }

        const tipoLabel = { monetario:'Monetário', minutos:'Horas', dias:'Dias', inteiro:'Inteiro', booleano:'Booleano' };
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

// ──────────────────────────────────────────────
// CONFIGURAÇÕES – RUBRICA R$ 87,00 DOM/FER
// ──────────────────────────────────────────────

async function carregar87Config() {
    const codigos = [...new Set(Object.values(LOJAS_TF).map(l => l.codTxt))];
    const tbody = document.getElementById('cfg87TableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Carregando...</td></tr>';

    const { data, error } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('id, codigo_empresa, coluna_planilha, codigo_rubrica')
        .in('codigo_empresa', codigos)
        .in('coluna_planilha', [COL_87_DOMINGO, COL_87_FERIADO, COL_DOM, COL_FER]);

    if (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="config-empty" style="color:#E74C3C;">Erro: ${error.message}</td></tr>`;
        return;
    }

    const mapa = {};
    codigos.forEach(cod => { mapa[cod] = { dom87: null, fer87: null, dom: null, fer: null }; });
    (data || []).forEach(r => {
        if      (r.coluna_planilha === COL_87_DOMINGO) mapa[r.codigo_empresa].dom87 = r;
        else if (r.coluna_planilha === COL_87_FERIADO) mapa[r.codigo_empresa].fer87 = r;
        else if (r.coluna_planilha === COL_DOM)        mapa[r.codigo_empresa].dom   = r;
        else if (r.coluna_planilha === COL_FER)        mapa[r.codigo_empresa].fer   = r;
    });

    const cell = (reg) => reg
        ? `<span style="font-family:monospace;font-weight:600;">${reg.codigo_rubrica}</span>
           <button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:#fff;margin-left:4px;"
               onclick="deletar87Config('${reg.id}')">✕</button>`
        : '<em style="color:#bbb;font-size:12px;">—</em>';

    if (tbody) {
        tbody.innerHTML = codigos.map(cod => {
            const m = mapa[cod];
            const lojaLabel = (_assocEmpresas.find(e => e.codigo_empresa === cod)?.nome_empresa || '');
            return `<tr>
                <td><strong>${cod}</strong> <span style="color:#7F8C8D;font-size:12px;">${lojaLabel}</span></td>
                <td>${cell(m.dom87)}</td>
                <td>${cell(m.fer87)}</td>
                <td>${cell(m.dom)}</td>
                <td>${cell(m.fer)}</td>
                <td>
                    <button class="btn btn-secondary btn-small"
                        onclick="preencherEditar87('${cod}','${m.dom87?.codigo_rubrica||''}','${m.fer87?.codigo_rubrica||''}','${m.dom?.codigo_rubrica||''}','${m.fer?.codigo_rubrica||''}')">
                        ✏ Editar
                    </button>
                </td>
            </tr>`;
        }).join('');
    }
}

async function salvar87Config() {
    const empresa      = document.getElementById('cfg87Empresa').value;
    const codDom87     = document.getElementById('cfg87CodDomingo87').value.trim();
    const codFer87     = document.getElementById('cfg87CodFeriado87').value.trim();
    const codDomOutros = document.getElementById('cfg87CodDomingoOutros').value.trim();
    const codFerOutros = document.getElementById('cfg87CodFeriadoOutros').value.trim();

    if (!empresa) { mostrarStatusConfig87('⚠ Selecione a empresa.', 'error'); return; }
    if (!codDom87 && !codFer87 && !codDomOutros && !codFerOutros) {
        mostrarStatusConfig87('⚠ Informe ao menos um código.', 'error'); return;
    }

    const reg = (col, cod, tipo) => ({
        codigo_empresa: empresa, coluna_planilha: col,
        descricao: col, codigo_rubrica: cod,
        tipo_processo: '11', tipo_valor: tipo, ativo: true,
    });

    const registros = [
        codDom87     && reg(COL_87_DOMINGO, codDom87,     'inteiro'),
        codFer87     && reg(COL_87_FERIADO, codFer87,     'inteiro'),
        codDomOutros && reg(COL_DOM,        codDomOutros, 'monetario'),
        codFerOutros && reg(COL_FER,        codFerOutros, 'monetario'),
    ].filter(Boolean);

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .upsert(registros, { onConflict: 'codigo_empresa,coluna_planilha' });
        if (error) throw error;

        ['cfg87CodDomingo87','cfg87CodFeriado87','cfg87CodDomingoOutros','cfg87CodFeriadoOutros']
            .forEach(id => { document.getElementById(id).value = ''; });
        mostrarStatusConfig87('✅ Salvo com sucesso!', 'success');
        carregar87Config();
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfig87('❌ Erro: ' + err.message, 'error');
    }
}

async function deletar87Config(id) {
    if (!confirm('Remover esta rubrica?')) return;
    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .delete().eq('id', id);
        if (error) throw error;
        carregar87Config();
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfig87('❌ Erro ao excluir: ' + err.message, 'error');
    }
}

function preencherEditar87(empresa, codDom87, codFer87, codDomOutros, codFerOutros) {
    document.getElementById('cfg87Empresa').value           = empresa;
    document.getElementById('cfg87CodDomingo87').value      = codDom87;
    document.getElementById('cfg87CodFeriado87').value      = codFer87;
    document.getElementById('cfg87CodDomingoOutros').value  = codDomOutros;
    document.getElementById('cfg87CodFeriadoOutros').value  = codFerOutros;
    document.getElementById('cfg87CodDomingo87').focus();
}

function mostrarStatusConfig87(msg, tipo) {
    const el = document.getElementById('statusConfig87');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = tipo === 'success' ? '#D4EDDA' : '#F8D7DA';
    el.style.color       = tipo === 'success' ? '#155724' : '#721C24';
    el.style.border      = '1px solid ' + (tipo === 'success' ? '#C3E6CB' : '#F5C6CB');
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ──────────────────────────────────────────────
// CONFIGURAÇÕES – DESCONTO VT/VA (FALTAS/ATESTADOS)
// ──────────────────────────────────────────────

async function carregarDescontoConfig() {
    const codigos = [...new Set(Object.values(LOJAS_TF).map(l => l.codTxt))];
    const tbody = document.getElementById('cfgDescTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="config-empty">Carregando...</td></tr>';

    const { data, error } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('id, codigo_empresa, coluna_planilha, codigo_rubrica')
        .in('codigo_empresa', codigos)
        .in('coluna_planilha', [COL_DESCONTO_VT, COL_DESCONTO_VA]);

    if (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="config-empty" style="color:#E74C3C;">Erro: ${error.message}</td></tr>`;
        return;
    }

    const mapa = {};
    codigos.forEach(cod => { mapa[cod] = { vt: null, va: null }; });
    (data || []).forEach(r => {
        if      (r.coluna_planilha === COL_DESCONTO_VT) mapa[r.codigo_empresa].vt = r;
        else if (r.coluna_planilha === COL_DESCONTO_VA) mapa[r.codigo_empresa].va = r;
    });

    const cell = (reg) => reg
        ? `<span style="font-family:monospace;font-weight:600;">${reg.codigo_rubrica}</span>
           <button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:#fff;margin-left:4px;"
               onclick="deletarDescontoConfig('${reg.id}')">✕</button>`
        : '<em style="color:#bbb;font-size:12px;">—</em>';

    if (tbody) {
        tbody.innerHTML = codigos.map(cod => {
            const m = mapa[cod];
            const lojaLabel = (_assocEmpresas.find(e => e.codigo_empresa === cod)?.nome_empresa || '');
            return `<tr>
                <td><strong>${cod}</strong> <span style="color:#7F8C8D;font-size:12px;">${lojaLabel}</span></td>
                <td>${cell(m.vt)}</td>
                <td>${cell(m.va)}</td>
                <td>
                    <button class="btn btn-secondary btn-small"
                        onclick="preencherEditarDesconto('${cod}','${m.vt?.codigo_rubrica||''}','${m.va?.codigo_rubrica||''}')">
                        ✏ Editar
                    </button>
                </td>
            </tr>`;
        }).join('');
    }
}

async function salvarDescontoConfig() {
    const empresa = document.getElementById('cfgDescEmpresa').value;
    const codVT   = document.getElementById('cfgDescCodVT').value.trim();
    const codVA   = document.getElementById('cfgDescCodVA').value.trim();

    if (!empresa) { mostrarStatusConfigDesconto('⚠ Selecione a empresa.', 'error'); return; }
    if (!codVT && !codVA) { mostrarStatusConfigDesconto('⚠ Informe ao menos um código.', 'error'); return; }

    const reg = (col, cod) => ({
        codigo_empresa: empresa, coluna_planilha: col,
        descricao: col, codigo_rubrica: cod,
        tipo_processo: '11', tipo_valor: 'monetario', ativo: true,
    });

    const registros = [
        codVT && reg(COL_DESCONTO_VT, codVT),
        codVA && reg(COL_DESCONTO_VA, codVA),
    ].filter(Boolean);

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .upsert(registros, { onConflict: 'codigo_empresa,coluna_planilha' });
        if (error) throw error;

        document.getElementById('cfgDescCodVT').value = '';
        document.getElementById('cfgDescCodVA').value = '';
        mostrarStatusConfigDesconto('✅ Salvo com sucesso!', 'success');
        carregarDescontoConfig();
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfigDesconto('❌ Erro: ' + err.message, 'error');
    }
}

async function deletarDescontoConfig(id) {
    if (!confirm('Remover esta rubrica?')) return;
    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .delete().eq('id', id);
        if (error) throw error;
        carregarDescontoConfig();
        carregarRubricasConfig();
    } catch(err) {
        mostrarStatusConfigDesconto('❌ Erro ao excluir: ' + err.message, 'error');
    }
}

function preencherEditarDesconto(empresa, codVT, codVA) {
    document.getElementById('cfgDescEmpresa').value = empresa;
    document.getElementById('cfgDescCodVT').value    = codVT;
    document.getElementById('cfgDescCodVA').value    = codVA;
    document.getElementById('cfgDescCodVT').focus();
}

function mostrarStatusConfigDesconto(msg, tipo) {
    const el = document.getElementById('statusConfigDesconto');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = tipo === 'success' ? '#D4EDDA' : '#F8D7DA';
    el.style.color       = tipo === 'success' ? '#155724' : '#721C24';
    el.style.border      = '1px solid ' + (tipo === 'success' ? '#C3E6CB' : '#F5C6CB');
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
