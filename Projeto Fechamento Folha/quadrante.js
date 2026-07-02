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
let funcionariosMap   = {}; // nome_normalizado → codigo_empregado
let rubricasConfig    = []; // [{coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao}]
let rhRubricasData    = []; // [{descricao_rubrica, codigo_rubrica}] — fallback de resolução
let linhasTxt         = []; // linhas válidas para o TXT
let tipoFolhaAtual    = '11'; // tipo_folha pré-selecionado no modal de TXT
let feriasData        = []; // dados brutos da planilha de férias
let feriasHeaders     = []; // cabeçalhos da planilha de férias
let feriasSorted      = []; // dados ordenados
let empregadosConfig  = {}; // nome_normalizado → codigo_empregado (config desta ferramenta)
let rubricasIgnoradas = new Set(); // normalizarNome(coluna_planilha) → excluir do TXT
let faltaDatasMap     = {}; // `${codEmpregado}::${normColuna}` → string raw de datas inseridas

let arquivoLiquido     = null;              // File selecionado no Step 6
let dadosBancariosDB   = {};                // codigo_empregado → registro de fechamento_dados_bancarios
let linhasLiquido      = [];                // [{codigo_empregado, cpf, nome, valorInt}] da aba Líquido do mês
let gruposLiquido      = [];                // [{bancoCodigo, bancoNome, linhas:[...], totalInt}]
let pendenciasLiquido  = [];                // linhas de linhasLiquido sem dados bancários
let excluidosDoRelatorio = new Set();       // codigo_empregado excluídos manualmente do relatório do mês

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
    [1,2,3,4,5,6].forEach(i => {
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
    const dist = levenshtein(na, nb);
    return 1 - dist / Math.max(na.length, nb.length);
}

// Retorna codigo_empregado: prioridade config da ferramenta > rh_empregados (exact > fuzzy 0.75)
function buscarCodigoEmpregado(nome) {
    const norm = normalizarNome(nome);
    if (empregadosConfig[norm]) return empregadosConfig[norm];
    if (funcionariosMap[norm]) return funcionariosMap[norm];
    let melhorScore = 0, melhorCod = null;
    for (const [chave, cod] of Object.entries(funcionariosMap)) {
        const s = similaridade(norm, chave);
        if (s > melhorScore) { melhorScore = s; melhorCod = cod; }
    }
    return melhorScore >= 0.75 ? melhorCod : null;
}

// Converte "R$ 2.990,26" ou 2990.26 (número do Excel) → 299026 (centavos inteiros)
function parseMoney(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).replace(/R\$|\s/g, '').trim();
    if (!str) return 0;
    let num;
    if (str.includes(',')) {
        // Formato brasileiro: 2.990,26 — ponto é milhar, vírgula é decimal
        num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    } else {
        // Número puro do Excel: 2990.26 — ponto é decimal
        num = parseFloat(str.replace(/[^\d.]/g, ''));
    }
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
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
    // Valor numérico direto (ex: Excel serial de hora)
    const n = parseFloat(str);
    if (isNaN(n) || n <= 0) return 0;
    const totalMin = Math.round(n * 24 * 60);
    return Math.floor(totalMin / 60) * 100 + (totalMin % 60);
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
        case 'booleano':
        case 'monetario': return 'R$ ' + (valorTxt / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        case 'minutos': {
            const h = Math.floor(valorTxt / 100);
            const m = valorTxt % 100;
            return `${h}h${String(m).padStart(2,'0')}`;
        }
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

async function carregarEmpregadosConfig() {
    const { data, error } = await supabaseClient
        .from('fechamento_empregados_config')
        .select('nome_planilha, codigo_empregado')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    empregadosConfig = {};
    (data || []).forEach(e => {
        empregadosConfig[normalizarNome(e.nome_planilha)] = e.codigo_empregado;
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
    // Fonte primária: fechamento_rubricas_config
    const { data: cfgData, error: cfgErr } = await supabaseClient
        .from('fechamento_rubricas_config')
        .select('coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao, valor_cota')
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('ativo', true);
    if (cfgErr) throw cfgErr;
    rubricasConfig = cfgData || [];

    // Fallback: rh_rubricas (somente para resolução fuzzy quando não há config)
    const { data: rhData, error: rhErr } = await supabaseClient
        .from('rh_rubricas')
        .select('descricao_rubrica, codigo_rubrica')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (rhErr) throw rhErr;
    rhRubricasData = rhData || [];
}

// Resolve rubrica para um cabeçalho de coluna do Excel
function resolverColuna(header) {
    const normH = normalizarNome(header);

    // 1. Exact match em fechamento_rubricas_config (coluna_planilha ou descricao)
    const exato = rubricasConfig.find(c =>
        normalizarNome(c.coluna_planilha) === normH ||
        normalizarNome(c.descricao || '') === normH
    );
    if (exato) {
        return { codigo_rubrica: exato.codigo_rubrica, tipo_valor: exato.tipo_valor, descricao: exato.descricao || header, fonte: 'config', valor_cota: exato.valor_cota || null };
    }

    // 2. Fuzzy match em fechamento_rubricas_config
    let melhorScore = 0, melhorCfg = null;
    for (const c of rubricasConfig) {
        const s1 = similaridade(normH, normalizarNome(c.coluna_planilha));
        const s2 = similaridade(normH, normalizarNome(c.descricao || ''));
        const s  = Math.max(s1, s2);
        if (s > melhorScore) { melhorScore = s; melhorCfg = c; }
    }
    if (melhorScore >= 0.80 && melhorCfg) {
        return { codigo_rubrica: melhorCfg.codigo_rubrica, tipo_valor: melhorCfg.tipo_valor, descricao: melhorCfg.descricao || header, fonte: 'config', valor_cota: melhorCfg.valor_cota || null };
    }

    // 3. Fuzzy match em rh_rubricas (fallback — tipo_valor desconhecido)
    melhorScore = 0; let melhorRh = null;
    for (const rh of rhRubricasData) {
        const s = similaridade(header, rh.descricao_rubrica || '');
        if (s > melhorScore) { melhorScore = s; melhorRh = rh; }
    }
    if (melhorScore >= 0.65 && melhorRh) {
        return { codigo_rubrica: melhorRh.codigo_rubrica, tipo_valor: 'monetario', descricao: header, fonte: 'rh_rubricas', valor_cota: null };
    }

    return { codigo_rubrica: null, tipo_valor: null, descricao: header, fonte: null, valor_cota: null };
}

// ──────────────────────────────────────────────
// STEP 1 – PROCESSAR PLANILHA
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;

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
    // Upload área – relatório líquido (etiquetas bancárias)
    configurarUploadArea('uploadAreaLiquido', 'inputLiquido', 'filenameLiquido', onLiquidoSelecionado);

    // Painel de envios do formulário
    carregarEnvios();
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
        await Promise.all([carregarFuncionarios(), carregarRubricas(), carregarEmpregadosConfig(), carregarRubricasIgnoradas()]);

        // Ler Excel
        const buffer   = await arquivoFolha.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Linha 4 (índice 3) = cabeçalhos
        const headers = rows[LINHA_CABECALHO - 1] || [];

        // Colunas de rubrica: todas a partir do índice 2 (A=nome, B=funcao), com cabeçalho não-vazio
        const colunasRubrica = []; // [{idx, header, resolucao}]
        headers.forEach((h, i) => {
            if (i < 2) return;
            const header = String(h || '').trim();
            if (!header) return;
            colunasRubrica.push({ idx: i, header, resolucao: resolverColuna(header) });
        });

        // Linhas de dados: a partir da linha 5 até linha vazia (sem nome)
        planilhaData = [];
        for (let r = LINHA_DADOS_INI - 1; r < rows.length; r++) {
            const row  = rows[r];
            const nome = String(row[0] || '').trim();
            if (!nome) break;

            const colunas = {};
            colunasRubrica.forEach(({ idx, header }) => {
                colunas[header] = String(row[idx] || '').trim();
            });

            planilhaData.push({ nome, funcao: String(row[1] || ''), colunas, colunasRubrica });
        }

        tipoFolhaAtual = '11'; // Excel não tem tipo definido — padrão Folha Mensal
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

let linhasRelatorio = [];

function construirRelatorio(comp) {
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + comp;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + comp;

    linhasTxt = [];
    linhasRelatorio = [];
    faltaDatasMap = {};
    let temSemMatch = false;

    // colunasRubrica vem do primeiro funcionário (todas têm o mesmo layout)
    const colunasRubrica = planilhaData.length ? planilhaData[0].colunasRubrica : [];

    planilhaData.forEach(func => {
        const codEmpregado = buscarCodigoEmpregado(func.nome);
        if (!codEmpregado) temSemMatch = true;

        colunasRubrica.forEach(({ header, resolucao }) => {
            const bruto = func.colunas[header] || '';
            if (!bruto) return; // célula vazia — ignorar

            const tipoValor = resolucao.tipo_valor;
            const valorCota = resolucao.valor_cota;
            let valorInt;
            if (tipoValor === 'booleano') {
                valorInt = String(bruto).trim().toLowerCase() === 'sim' && valorCota
                    ? Math.round(parseFloat(valorCota) * 100)
                    : 0;
            } else {
                valorInt = tipoValor ? valorParaTxt(bruto, tipoValor) : 0;
            }

            linhasRelatorio.push({
                nome:          func.nome,
                codEmpregado,
                funcao:        func.funcao,
                coluna:        header,
                descricao:     resolucao.descricao || header,
                codigoRubrica: resolucao.codigo_rubrica,
                fonteRubrica:  resolucao.fonte,
                tipoValor,
                valorCota,
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

        // Fonte badge
        const fonteTag = !semRubrica && !ignorada
            ? (l.fonteRubrica === 'associacao'
                ? '<span style="font-size:10px;color:var(--primary-color);margin-left:4px;" title="Associação da ferramenta">★</span>'
                : l.fonteRubrica === 'rh_rubricas'
                    ? '<span style="font-size:10px;color:#27AE60;margin-left:4px;" title="Código de rh_rubricas">●</span>'
                    : '<span style="font-size:10px;color:#E67E22;margin-left:4px;" title="Config da empresa">○</span>')
            : '';

        const tipoValorDisplay = !semRubrica && !ignorada
            ? `<select class="tipo-select" onchange="alterarTipoRubrica(${i}, this.value)" title="Alterar tipo do valor">
                <option value="monetario" ${l.tipoValor==='monetario'?'selected':''}>monetário</option>
                <option value="minutos"   ${l.tipoValor==='minutos'  ?'selected':''}>horas</option>
                <option value="dias"      ${l.tipoValor==='dias'     ?'selected':''}>dias</option>
                <option value="booleano"  ${l.tipoValor==='booleano' ?'selected':''}>booleano</option>
              </select>`
            : '<span class="badge" style="background:#eee;color:#999;">?</span>';

        const _valorFmt = l.tipoValor === 'minutos'
            ? String(l.valorInt).padStart(4, '0')
            : formatarValorExibicao(l.valorInt, l.tipoValor);
        const valorTxtDisplay = ignorada
            ? '<span style="color:#999;font-size:11px;">ignorada</span>'
            : l.valorInt > 0
                ? `<span style="font-family:monospace;font-weight:600;">${_valorFmt}</span>`
                : (semRubrica ? '<span style="color:#999;font-size:11px;">sem config</span>' : '–');

        const rubricaCell = semRubrica
            ? '<span class="sem-match">sem rubrica</span>'
            : ignorada
                ? `<s style="color:#bbb;">${l.codigoRubrica}</s>`
                : (l.codigoRubrica + fonteTag);

        const acaoBtns = [
            semFuncionario
                ? `<button class="btn btn-secondary btn-small" style="white-space:nowrap;"
                        onclick="abrirCadastroEmpregado(${i})">+ Definir código</button>`
                : '',
            semRubrica
                ? `<button class="btn btn-secondary btn-small" style="white-space:nowrap;"
                        onclick="abrirCadastroRubrica(${i})">+ Rubrica</button>`
                : '',
            !semRubrica && !ignorada
                ? `<button class="btn btn-secondary btn-small" style="white-space:nowrap;color:#999;"
                        onclick="ignorarRubrica(${i})" title="Excluir do TXT">⊘ Ignorar</button>`
                : '',
            ignorada
                ? `<button class="btn btn-secondary btn-small" style="white-space:nowrap;"
                        onclick="reativarRubrica(${i})" title="Voltar a incluir no TXT">↩ Reativar</button>`
                : '',
        ].filter(Boolean).join(' ');
        const acaoCell = acaoBtns;

        const tr = document.createElement('tr');
        tr.id = `rel-row-${i}`;
        if (ignorada)       { tr.style.background = '#f5f5f5'; tr.style.opacity = '0.6'; }
        else if (semFuncionario) tr.style.background = '#fff8f8';
        else if (semRubrica)     tr.style.background = '#fffbf0';

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td style="font-family:monospace;font-weight:600;">${CODIGO_EMPRESA}</td>
            <td>${l.nome}${semFuncionario ? ' <span class="sem-match">sem cadastro</span>' : ''}</td>
            <td>${l.codEmpregado || '–'}</td>
            <td>${l.descricao}</td>
            <td style="font-family:monospace;">${rubricaCell}</td>
            <td>${tipoValorDisplay}</td>
            <td>${l.bruto || '–'}</td>
            <td>${valorTxtDisplay}</td>
            <td>${acaoCell}</td>
        `;
        tbody.appendChild(tr);

        // Formulário inline de código do empregado (oculto inicialmente)
        if (semFuncionario) {
            const trEmp = document.createElement('tr');
            trEmp.id = `emp-form-${i}`;
            trEmp.style.display = 'none';
            trEmp.style.background = '#fff5f5';
            trEmp.innerHTML = `
                <td colspan="10">
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

        // Linha de cadastro inline (oculta inicialmente)
        if (semRubrica) {
            const trForm = document.createElement('tr');
            trForm.id = `rel-form-${i}`;
            trForm.style.display = 'none';
            trForm.style.background = '#fffdf5';
            trForm.innerHTML = `
                <td colspan="10">
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">Cadastrar rubrica para: <em>${l.coluna}</em></span>
                        <input type="text" id="inlineCode-${i}" placeholder="Código da rubrica"
                            style="width:140px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;font-family:monospace;">
                        <select id="inlineTipo-${i}" onchange="toggleInlineValorCota(${i})" style="padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                            <option value="monetario">Monetário (R$)</option>
                            <option value="minutos">Horas (HH:MM)</option>
                            <option value="dias">Dias</option>
                            <option value="booleano">Booleano (Sim/Não)</option>
                        </select>
                        <div id="inlineValorCotaWrap-${i}" style="display:none;">
                            <input type="number" id="inlineValorCota-${i}" placeholder="Valor da cota (R$)" step="0.01" min="0"
                                style="width:150px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        </div>
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
                <td colspan="10">
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

    document.getElementById('contadorLinhas').textContent = linhas.length + ' registros';
    construirTotais(linhas);
}

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

    const nome = linhasRelatorio[idx].nome;

    try {
        const { error } = await supabaseClient
            .from('fechamento_empregados_config')
            .upsert([{
                codigo_empresa:   CODIGO_EMPRESA,
                nome_planilha:    nome,
                codigo_empregado: codigo,
            }], { onConflict: 'codigo_empresa,nome_planilha' });
        if (error) throw error;

        // Atualizar em memória
        empregadosConfig[normalizarNome(nome)] = codigo;

        // Atualizar todas as linhas com esse nome
        const normNome = normalizarNome(nome);
        linhasRelatorio.forEach(l => {
            if (normalizarNome(l.nome) === normNome) l.codEmpregado = codigo;
        });

        renderizarRelatorio(linhasRelatorio);
    } catch (err) {
        statusEl.textContent = '❌ Erro: ' + err.message;
        statusEl.style.color = '#E74C3C';
    }
}

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
    const valorCota = tipoValor === 'booleano'
        ? (parseFloat(document.getElementById(`inlineValorCota-${idx}`)?.value) || null)
        : null;

    if (!codigo) {
        statusEl.textContent = '⚠ Informe o código.';
        statusEl.style.color = '#E74C3C';
        return;
    }
    if (tipoValor === 'booleano' && !valorCota) {
        statusEl.textContent = '⚠ Informe o Valor da Cota para o tipo Booleano.';
        statusEl.style.color = '#E74C3C';
        return;
    }

    const linha   = linhasRelatorio[idx];
    const coluna  = linha.coluna;

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .insert([{
                codigo_empresa:  CODIGO_EMPRESA,
                coluna_planilha: coluna,
                descricao:       coluna,
                codigo_rubrica:  codigo,
                tipo_processo:   '11',
                tipo_valor:      tipoValor,
                valor_cota:      valorCota,
                ativo:           true,
            }]);
        if (error) throw error;

        // Atualizar TODAS as linhas com essa mesma coluna
        linhasRelatorio.forEach(l => {
            if (l.coluna !== coluna) return;
            l.codigoRubrica = codigo;
            l.tipoValor     = tipoValor;
            l.valorCota     = valorCota;
            l.fonteRubrica  = 'config';
            if (tipoValor === 'booleano') {
                l.valorInt = String(l.bruto).trim().toLowerCase() === 'sim' && valorCota
                    ? Math.round(parseFloat(valorCota) * 100)
                    : 0;
            } else {
                l.valorInt = valorParaTxt(l.bruto, tipoValor);
            }
        });

        // Atualizar resolução para futuro (caso re-renderize)
        planilhaData.forEach(f => {
            f.colunasRubrica.forEach(cr => {
                if (cr.header === coluna) {
                    cr.resolucao = { codigo_rubrica: codigo, tipo_valor: tipoValor, descricao: coluna, fonte: 'config' };
                }
            });
        });

        renderizarRelatorio(linhasRelatorio);

    } catch (err) {
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
    construirTotais(linhasRelatorio);
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
    construirTotais(linhasRelatorio);
}

async function alterarTipoRubrica(idx, novoTipo) {
    const coluna = linhasRelatorio[idx].coluna;
    const codigo = linhasRelatorio[idx].codigoRubrica;

    try {
        const _valorCota = novoTipo === 'booleano' ? (linhasRelatorio[idx].valorCota || null) : null;

        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .upsert([{
                codigo_empresa:  CODIGO_EMPRESA,
                coluna_planilha: coluna,
                descricao:       linhasRelatorio[idx].descricao || coluna,
                codigo_rubrica:  codigo,
                tipo_processo:   linhasRelatorio[idx].tipoProcesso || '11',
                tipo_valor:      novoTipo,
                valor_cota:      _valorCota,
                ativo:           true,
            }], { onConflict: 'codigo_empresa,coluna_planilha' });
        if (error) throw error;

        // Atualizar todas as linhas com essa coluna
        linhasRelatorio.forEach(l => {
            if (l.coluna !== coluna) return;
            l.tipoValor = novoTipo;
            if (novoTipo === 'booleano') {
                l.valorInt = String(l.bruto).trim().toLowerCase() === 'sim' && _valorCota
                    ? Math.round(parseFloat(_valorCota) * 100)
                    : 0;
            } else {
                l.valorInt = valorParaTxt(l.bruto, novoTipo);
            }
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

function construirTotais(linhas) {
    const totais = {};
    linhas.forEach(l => {
        if (rubricasIgnoradas.has(normalizarNome(l.coluna))) return;
        if (!totais[l.descricao]) totais[l.descricao] = { tipo: l.tipoValor, soma: 0 };
        // Horas são armazenadas em HHMM (ex: 130 = 1h30). Acumular em minutos reais para somar corretamente.
        totais[l.descricao].soma += l.tipoValor === 'minutos'
            ? Math.floor(l.valorInt / 100) * 60 + (l.valorInt % 100)
            : l.valorInt;
    });

    let html = '<div style="margin-top:15px;">'
        + '<strong style="color:var(--primary-color);">Totais por Rubrica</strong>'
        + '<div class="table-wrapper" style="margin-top:8px;">'
        + '<table><thead><tr><th>Rubrica</th><th>Total</th></tr></thead><tbody>';
    Object.entries(totais).forEach(([desc, t]) => {
        let display;
        if (t.tipo === 'minutos') {
            const h = Math.floor(t.soma / 60), m = t.soma % 60;
            display = `${h}h${String(m).padStart(2, '0')}`;
        } else {
            display = formatarValorExibicao(t.soma, t.tipo);
        }
        html += `<tr class="total-row"><td>${desc}</td><td>${display}</td></tr>`;
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
    if (linhasRelatorio.filter(l => l.codEmpregado && l.valorInt > 0).length === 0) {
        mostrarMensagem('Atenção', 'Nenhuma linha válida para gerar o TXT. Verifique os cadastros e rubricas.');
        return;
    }
    // Pré-selecionar o tipo_folha vindo do formulário (ou '11' se vier do Excel)
    const radios = document.querySelectorAll('input[name="tipoProcesso"]');
    radios.forEach(r => { r.checked = r.value === tipoFolhaAtual; });
    document.getElementById('modalTipoProcesso').classList.add('active');
}

function fecharModalTipoProcesso() {
    document.getElementById('modalTipoProcesso').classList.remove('active');
}

function confirmarTipoProcesso() {
    const selecionado = document.querySelector('input[name="tipoProcesso"]:checked');
    if (!selecionado) {
        mostrarMensagem('Atenção', 'Selecione o tipo de processo antes de continuar.');
        return;
    }
    fecharModalTipoProcesso();
    const tipoProcesso = selecionado.value;
    const comp = document.getElementById('competencia').value.trim();

    // Regenerar TXT com o tipo de processo selecionado — agrupa por empregado para inserir registros de falta por data
    linhasTxt = [];
    const _ordCods = [];
    const _empData = {};

    linhasRelatorio.forEach(l => {
        if (!l.codEmpregado) return;
        if (!_empData[l.codEmpregado]) {
            _empData[l.codEmpregado] = { rubricas: [] };
            _ordCods.push(l.codEmpregado);
        }
        const _ign = rubricasIgnoradas.has(normalizarNome(l.coluna));
        if (!_ign && l.valorInt > 0) {
            _empData[l.codEmpregado].rubricas.push(
                gerarLinhaTxt(l.codEmpregado, comp, l.codigoRubrica, tipoProcesso, l.valorInt, CODIGO_EMPRESA)
            );
        }
        if (!_ign && isColunaFalta(l.coluna)) {
            const _tipo = normalizarNome(l.coluna).includes('dsr') ? '2' : '1';
            const _key  = `${l.codEmpregado}::${normalizarNome(l.coluna)}`;
            (faltaDatasMap[_key] || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).forEach(d => {
                const _m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (_m) _empData[l.codEmpregado].rubricas.push(`11${_m[3]}${_m[2]}${_m[1]}${_tipo}`);
            });
        }
    });

    _ordCods.forEach(cod => {
        linhasTxt.push(..._empData[cod].rubricas);
    });

    const nomeProcesso = {
        '11': 'Folha Mensal',
        '41': 'Adiantamento Salarial',
        '42': 'Folha Complementar',
        '51': 'Adiantamento de 13º Salário',
        '52': '13º Salário',
        '70': 'PLR'
    }[tipoProcesso] || tipoProcesso;

    document.getElementById('resumoTxt').textContent =
        `Processo: ${tipoProcesso} – ${nomeProcesso} · Total de linhas: ${linhasTxt.length}`;
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

function detectarCabecalhoFerias(rows) {
    // Procura a linha que contém "Código" ou "Empregado" (linha de dados do cabeçalho)
    for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        const textos = rows[r].map(c => String(c).trim());
        if (textos.some(t => /^c[oó]digo$/i.test(t) || /^empregado/i.test(t))) {
            // Combinar com a linha anterior (sub-cabeçalho) se existir
            const cabMerge = textos.map((t, i) => {
                if (t) return t;
                const anterior = rows[r - 1] ? String(rows[r - 1][i] || '').trim() : '';
                return anterior;
            });
            return { cabIdx: r, headers: cabMerge };
        }
    }
    // Fallback: primeira linha com 3+ células não-vazias
    for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        if (rows[r].filter(c => String(c).trim() !== '').length >= 3) {
            return { cabIdx: r, headers: rows[r].map(c => String(c).trim()) };
        }
    }
    return null;
}

async function preCarregarColunas(file) {
    try {
        const buffer   = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const resultado = detectarCabecalhoFerias(rows);
        if (!resultado) return;
        feriasHeaders = resultado.headers;

        const sel = document.getElementById('colunaOrdenacao');
        sel.innerHTML = '<option value="">— Detectar automaticamente —</option>';
        feriasHeaders.forEach((h, i) => {
            if (!h) return;
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = h;
            if (/gozo|in[ií]cio.*gozo|gozo.*fer/i.test(h)) opt.selected = true;
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

        // Detectar cabeçalho
        const deteccao = detectarCabecalhoFerias(rows);
        if (!deteccao) {
            mostrarMensagem('Atenção', 'Não foi possível detectar o cabeçalho da planilha de férias. Verifique o arquivo.');
            return;
        }
        const { cabIdx } = deteccao;
        feriasHeaders = deteccao.headers;

        // Dados: linhas após o cabeçalho, ignorar linhas totalmente vazias e placeholders
        feriasData = rows.slice(cabIdx + 1).filter(r =>
            Array.isArray(r) && r.some(c => {
                const s = String(c).trim();
                return s !== '' && !/^\.+$/.test(s); // ignora "...." e "..../..../......"
            })
        );

        // Coluna de ordenação: preferir "Início gozo férias" (col 22, índice base-0)
        let colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
        if (isNaN(colOrd)) {
            colOrd = feriasHeaders.findIndex(h => /gozo/i.test(h));
            if (colOrd < 0) colOrd = feriasHeaders.findIndex(h => /in[ií]cio/i.test(h));
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
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date(9999, 0) : val;
    const s = String(val).trim();
    if (!s || /^[.\/ ]+$/.test(s)) return new Date(9999, 0); // placeholder ..../..../......
    // DD/MM/AAAA
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // Número serial do Excel
    const n = parseFloat(s);
    if (!isNaN(n) && n > 1000) return new Date(Math.round((n - 25569) * 86400 * 1000));
    return new Date(9999, 0);
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

// ──────────────────────────────────────────────
// SIDEBAR + NAVEGAÇÃO
// ──────────────────────────────────────────────

let _modoAtual = 'processamento'; // 'processamento' | 'config'

// Hamburger para mobile
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
// CONFIGURAÇÕES – ASSOCIAÇÕES DE RUBRICAS
// ──────────────────────────────────────────────

let _assocEmpresas = []; // [{codigo_empresa, nome_empresa}]

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
            const prefix = id === 'cfgFiltroEmpresa' ? '<option value="">Todas as empresas</option>' : '<option value="">Selecione...</option>';
            sel.innerHTML = prefix + _assocEmpresas.map(e =>
                `<option value="${e.codigo_empresa}">${e.codigo_empresa} – ${e.nome_empresa || ''}</option>`
            ).join('');
            if (atual) sel.value = atual;
        };

        populaSelect('cfgEmpresa');
        populaSelect('cfgFiltroEmpresa');

        document.getElementById('cfgEmpresa').value = CODIGO_EMPRESA;

    } catch (err) {
        console.error('Erro ao carregar empresas config:', err);
    }
}


async function carregarRubricasConfig() {
    const tbody = document.getElementById('cfgTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Carregando...</td></tr>';

    const filtroEmp = document.getElementById('cfgFiltroEmpresa')?.value || '';

    try {
        let q = supabaseClient
            .from('fechamento_rubricas_config')
            .select('id, codigo_empresa, descricao, codigo_rubrica, tipo_valor, valor_cota, ativo')
            .order('codigo_empresa')
            .order('descricao');

        if (filtroEmp) q = q.eq('codigo_empresa', filtroEmp);

        const { data, error } = await q;
        if (error) throw error;

        const lista = data || [];
        document.getElementById('cfgTotal').textContent = lista.length + ' rubrica(s)';

        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="config-empty">Nenhuma rubrica cadastrada.</td></tr>';
            return;
        }

        const tipoLabel = { monetario: 'Monetário', minutos: 'Horas', dias: 'Dias', booleano: 'Booleano' };
        tbody.innerHTML = lista.map(r => {
            const cotaInfo = r.tipo_valor === 'booleano' && r.valor_cota
                ? `<br><small style="color:#555;font-size:11px;">Cota: R$ ${parseFloat(r.valor_cota).toLocaleString('pt-BR',{minimumFractionDigits:2})}</small>`
                : '';
            return `
            <tr>
                <td><strong>${r.codigo_empresa}</strong></td>
                <td>${r.descricao || '–'}</td>
                <td style="font-family:monospace;font-weight:600;">${r.codigo_rubrica}</td>
                <td><span class="badge badge-${r.tipo_valor}">${tipoLabel[r.tipo_valor] || r.tipo_valor}</span>${cotaInfo}</td>
                <td>${r.ativo ? '✅' : '❌'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-small" onclick="toggleAtivoRubrica('${r.id}',${r.ativo})"
                        style="margin-right:4px;">${r.ativo ? 'Desativar' : 'Ativar'}</button>
                    ${r.tipo_valor === 'booleano' ? `<button class="btn btn-secondary btn-small" onclick="abrirEditarCota('${r.id}', ${r.valor_cota || 0})"
                        style="margin-right:4px;">💰 Cota</button>` : ''}
                    <button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:white;"
                        onclick="deletarRubricaConfig('${r.id}')">Excluir</button>
                </td>
            </tr>
            ${r.tipo_valor === 'booleano' ? `
            <tr id="editCotaRow-${r.id}" style="display:none;background:#fafafa;">
                <td colspan="6">
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">Valor da Cota (R$) para <em>${r.descricao || r.codigo_rubrica}</em></span>
                        <input type="number" id="editCotaInput-${r.id}" value="${r.valor_cota || ''}" placeholder="Ex: 25.00" step="0.01" min="0"
                            style="width:160px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <button class="btn btn-primary btn-small" onclick="salvarValorCota('${r.id}')">💾 Salvar</button>
                        <button class="btn btn-secondary btn-small" onclick="fecharEditarCota('${r.id}')">Cancelar</button>
                        <span id="editCotaStatus-${r.id}" style="font-size:12px;"></span>
                    </div>
                </td>
            </tr>` : ''}
        `}).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="config-empty" style="color:#E74C3C;">Erro: ${err.message}</td></tr>`;
    }
}

async function salvarRubricaConfig() {
    const empresa   = document.getElementById('cfgEmpresa').value.trim();
    const descricao = document.getElementById('cfgDescricao').value.trim();
    const codigo    = document.getElementById('cfgCodigo').value.trim();
    const tipoValor = document.getElementById('cfgTipoValor').value;
    const valorCota = tipoValor === 'booleano'
        ? (parseFloat(document.getElementById('cfgValorCota').value) || null)
        : null;

    if (!empresa || !descricao || !codigo) {
        mostrarStatusConfig('Preencha os campos obrigatórios: Empresa, Descrição e Código.', 'error');
        return;
    }
    if (tipoValor === 'booleano' && !valorCota) {
        mostrarStatusConfig('Para tipo Booleano, informe o Valor da Cota.', 'error');
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
                valor_cota:      valorCota,
                ativo:           true,
            }]);
        if (error) throw error;

        document.getElementById('cfgDescricao').value = '';
        document.getElementById('cfgCodigo').value = '';
        document.getElementById('cfgValorCota').value = '';
        document.getElementById('cfgValorCotaWrap').style.display = 'none';
        mostrarStatusConfig('✅ Rubrica salva com sucesso!', 'success');
        carregarRubricasConfig();
    } catch (err) {
        mostrarStatusConfig('❌ Erro: ' + err.message, 'error');
    }
}

async function toggleAtivoRubrica(id, ativo) {
    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .update({ ativo: !ativo })
            .eq('id', id);
        if (error) throw error;
        carregarRubricasConfig();
    } catch (err) {
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
    } catch (err) {
        mostrarStatusConfig('❌ Erro: ' + err.message, 'error');
    }
}

function toggleCfgValorCota() {
    const tipo = document.getElementById('cfgTipoValor').value;
    const wrap = document.getElementById('cfgValorCotaWrap');
    if (wrap) wrap.style.display = tipo === 'booleano' ? '' : 'none';
}

function toggleInlineValorCota(idx) {
    const tipo = document.getElementById(`inlineTipo-${idx}`).value;
    const wrap = document.getElementById(`inlineValorCotaWrap-${idx}`);
    if (wrap) wrap.style.display = tipo === 'booleano' ? '' : 'none';
}

function abrirEditarCota(id, valorAtual) {
    document.getElementById(`editCotaRow-${id}`).style.display = '';
    const inp = document.getElementById(`editCotaInput-${id}`);
    if (inp) { inp.value = valorAtual > 0 ? valorAtual : ''; inp.focus(); }
}

function fecharEditarCota(id) {
    document.getElementById(`editCotaRow-${id}`).style.display = 'none';
}

async function salvarValorCota(id) {
    const inp    = document.getElementById(`editCotaInput-${id}`);
    const status = document.getElementById(`editCotaStatus-${id}`);
    const valor  = parseFloat(inp.value);

    if (!valor || valor <= 0) {
        status.textContent = '⚠ Informe um valor válido.';
        status.style.color = '#E74C3C';
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('fechamento_rubricas_config')
            .update({ valor_cota: valor })
            .eq('id', id);
        if (error) throw error;
        mostrarStatusConfig('✅ Valor da cota atualizado!', 'success');
        fecharEditarCota(id);
        carregarRubricasConfig();
    } catch (err) {
        status.textContent = '❌ Erro: ' + err.message;
        status.style.color = '#E74C3C';
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
        container.innerHTML = '<div class="envios-vazio">Nenhum envio encontrado. Use o formulário para enviar dados.</div>';
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
                <div class="envio-info-sub">Fonte: ${fonteLabel} · Enviado em ${enviadoEm} · Quadrante Etiquetas 453</div>
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
    } catch (err) {
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
    document.getElementById('headerSubtitle').textContent = `Código 453 · ${label} · via Planilha`;
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + label;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + label;

    linhasRelatorio = d.linhas || [];
    linhasTxt = [];

    const temSemMatch = linhasRelatorio.some(l => !l.codEmpregado);
    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
    mostrarStep(2);
}

async function processarDadosFormulario(envioRow) {
    const d           = envioRow.dados;
    const competencia = d.competencia || '';
    const tipoFolha   = d.tipo_folha  || '11';
    const tipoLabel   = TIPO_FOLHA_LABELS[tipoFolha] || tipoFolha;
    const label       = `${competencia} · ${tipoFolha} – ${tipoLabel}`;

    tipoFolhaAtual = tipoFolha; // pré-seleciona no modal de TXT
    document.getElementById('competencia').value = competencia;
    document.getElementById('headerSubtitle').textContent =
        `Código 453 · ${label} · via Formulário`;
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + label;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + label;

    // Mapa campo do formulário → header para resolverColuna (mesmos nomes do formulário)
    const campoParaHeader = {
        he65:      'HORAS EXTRAS 65%',
        he100:     'HORAS EXTRAS 100%',
        adicnot:   'ADICIONAL NOTURNO (AUTOM)',
        comissao:  'COMISSOES',
        premio:    'PREMIO',
        vt:        'VALE TRANSPORTE',
        faltas:    'DIAS FALTAS',
        faltasdsr: 'DIAS FALTAS DSR',
        atrasos:   'HORAS FALTAS',
        descaut:   'DESCONTOS AUTORIZADOS',
        plano:     'DESCONTO PLANO DE SAUDE',
    };

    // Resolver rubricas uma vez (igual ao que construirRelatorio faz com colunasRubrica)
    const colunasRubrica = Object.entries(campoParaHeader).map(([campo, header]) => ({
        campo,
        header,
        resolucao: resolverColuna(header) || { codigo_rubrica: null, tipo_valor: null, descricao: header, fonte: null },
    }));

    // Resolver rubrica do plano Unimed uma vez
    const resUnimed = resolverColuna('DESCONTO PLANO DE SAUDE');

    // Diagnóstico: logar nomes normalizados vs mapa de funcionários
    console.group('🔍 Diagnóstico — nomes do formulário vs rh_empregados');
    console.log('Funcionários no mapa:', Object.keys(funcionariosMap));

    // Montar linhasRelatorio — estrutura idêntica ao construirRelatorio()
    linhasRelatorio = [];
    linhasTxt       = [];
    faltaDatasMap   = {};
    let temSemMatch = false;

    (d.employees || []).forEach(emp => {
        const normNome = normalizarNome(emp.nome);
        let melhorScore = 0, melhorChave = null;
        for (const chave of Object.keys(funcionariosMap)) {
            const s = similaridade(normNome, chave);
            if (s > melhorScore) { melhorScore = s; melhorChave = chave; }
        }
        console.log(`"${emp.nome}" → norm:"${normNome}" | melhor:"${melhorChave}" score:${melhorScore.toFixed(3)}`);
        const codEmpregado = buscarCodigoEmpregado(emp.nome);
        if (!codEmpregado) temSemMatch = true;

        // Campos do formulário
        colunasRubrica.forEach(({ campo, header, resolucao }) => {
            const bruto = emp[campo];
            if (bruto === '' || bruto == null) return;

            const tipoValor = resolucao.tipo_valor;
            const valorCota = resolucao.valor_cota;
            let valorInt;
            if (tipoValor === 'booleano') {
                valorInt = String(bruto).trim().toLowerCase() === 'sim' && valorCota
                    ? Math.round(parseFloat(valorCota) * 100)
                    : 0;
            } else {
                valorInt = tipoValor ? valorParaTxt(String(bruto), tipoValor) : 0;
            }

            linhasRelatorio.push({
                nome:          emp.nome,
                codEmpregado,
                funcao:        emp.funcao || '',
                coluna:        header,
                descricao:     resolucao.descricao || header,
                codigoRubrica: resolucao.codigo_rubrica,
                fonteRubrica:  resolucao.fonte,
                tipoValor,
                valorCota,
                bruto,
                valorInt,
            });
        });

        // Plano Unimed: cada linha do convênio é um lançamento independente
        if (d.convenios) {
            Object.values(d.convenios).forEach(card => {
                card.linhas.forEach(linha => {
                    const val = parseFloat(linha.val) || 0;
                    if (!val) return;
                    // Associar ao funcionário pelo primeiro nome (Daniela/Milene)
                    const primeiroNomeLinha = normalizarNome(linha.nome || '').split(' ')[0];
                    const primeiroNomeEmp   = normalizarNome(emp.nome).split(' ')[0];
                    if (primeiroNomeLinha !== primeiroNomeEmp) return;

                    linhasRelatorio.push({
                        nome:          emp.nome,
                        codEmpregado,
                        funcao:        emp.funcao || '',
                        coluna:        'PLANO UNIMED',
                        descricao:     `Unimed – ${linha.nome}`,
                        codigoRubrica: resUnimed ? resUnimed.codigo_rubrica : null,
                        fonteRubrica:  resUnimed ? resUnimed.fonte : null,
                        tipoValor:     'monetario',
                        bruto:         val,
                        valorInt:      Math.round(val * 100),
                    });
                });
            });
        }
    });

    console.groupEnd();
    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';

    // Marcar como processado
    await supabaseClient.from('quadrante_folha_envios')
        .update({ processado: true }).eq('id', envioRow.id);

    // renderizarRelatorio chama construirTotais internamente — totais por tipo corretos
    renderizarRelatorio(linhasRelatorio);
    mostrarStep(2);
    carregarEnvios();
}

// carregarEnvios é chamado no DOMContentLoaded existente (linha ~239)

// ══════════════════════════════════════════════
// RELATÓRIO LÍQUIDO — ETIQUETAS BANCÁRIAS (STEP 6)
// ══════════════════════════════════════════════

// ── Mapa de bancos FEBRABAN ──────────────────────────────
const BANCOS_FEBRABAN = {
    '001': 'BANCO DO BRASIL', '033': 'BANCO SANTANDER', '077': 'BANCO INTER',
    '104': 'CAIXA ECONÔMICA FEDERAL', '208': 'BANCO BTG PACTUAL', '212': 'BANCO ORIGINAL',
    '237': 'BANCO BRADESCO', '260': 'NU PAGAMENTOS (NUBANK)', '318': 'BANCO BMG',
    '336': 'BANCO C6', '341': 'BANCO ITAÚ', '399': 'HSBC', '422': 'BANCO SAFRA',
    '623': 'BANCO PAN', '655': 'BANCO VOTORANTIM', '748': 'SICREDI', '756': 'SICOOB',
};

function nomeBanco(codigo) {
    const c = String(codigo || '').replace(/\D/g, '').padStart(3, '0');
    return BANCOS_FEBRABAN[c] || ('BANCO ' + c);
}

// ── Utilitários de texto/planilha ────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Normaliza cabeçalho de coluna para comparação robusta (remove pontuação, °/º etc.)
function chaveColuna(h) {
    return normalizarNome(h).replace(/[^a-z0-9 ]/g, '');
}

// "32.0" ou 32 (número do Excel) → "32"
function normalizarCodigo(v) {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    return isNaN(n) ? String(v).trim() : String(Math.trunc(n));
}

function formatarCpf(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (d.length !== 11) return digits || '';
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

// Encontra a aba do workbook cujo nome normalizado bate com um dos candidatos
function encontrarAba(workbook, candidatosNormalizados) {
    const nomeEncontrado = workbook.SheetNames.find(n => candidatosNormalizados.includes(normalizarNome(n)));
    return nomeEncontrado ? workbook.Sheets[nomeEncontrado] : null;
}

// Lê uma aba usando a primeira linha como cabeçalho, mapeando colunas por nome normalizado.
// mapaColunas: { chaveDestino: [candidatosNormalizadosViaChaveColuna] }
function lerAbaComoObjetos(sheet, mapaColunas) {
    const rows    = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = (rows[0] || []).map(chaveColuna);
    const idx = {};
    Object.entries(mapaColunas).forEach(([chave, candidatos]) => {
        idx[chave] = headers.findIndex(h => candidatos.includes(h));
    });

    const out = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === '')) continue;
        const obj = {};
        Object.entries(idx).forEach(([chave, i]) => { obj[chave] = i >= 0 ? row[i] : ''; });
        out.push(obj);
    }
    return out;
}

const MAPA_BANCARIA = {
    codigo:      ['codigo'],
    nome:        ['nome do empregado'],
    cargo:       ['cargo'],
    centroCusto: ['ccusto', 'centro de custo'],
    cpf:         ['cpf'],
    banco:       ['banco'],
    agencia:     ['agencia'],
    conta:       ['n conta', 'no conta'],
};

const MAPA_LIQUIDO = {
    codigo: ['codigo'],
    nome:   ['nome do empregado'],
    cpf:    ['cpf'],
    valor:  ['valor'],
};

// Deduplica linhas da aba bancária por código do empregado (última ocorrência vence)
function dedupeBancaria(linhas) {
    const map = {};
    linhas.forEach(l => {
        const cod = normalizarCodigo(l.codigo);
        if (!cod) return;
        map[cod] = {
            codigo_empregado: cod,
            cpf:              String(l.cpf || '').replace(/\D/g, ''),
            nome_empregado:   String(l.nome || '').trim(),
            cargo:            String(l.cargo || '').trim(),
            centro_custo:     String(l.centroCusto || '').trim(),
            banco_codigo:     l.banco === '' ? '' : String(Math.trunc(Number(l.banco))).padStart(3, '0'),
            agencia:          String(l.agencia || '').trim(),
            conta:            String(l.conta || '').trim(),
        };
    });
    return Object.values(map);
}

function onLiquidoSelecionado(file, filenameId) {
    arquivoLiquido = file;
    const el = document.getElementById(filenameId);
    el.textContent = '✔ ' + file.name;
    el.style.display = 'block';
}

async function carregarDadosBancariosDB() {
    const { data, error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .select('*')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    dadosBancariosDB = {};
    (data || []).forEach(r => { dadosBancariosDB[r.codigo_empregado] = r; });
}

// Faz upsert dos dados bancários da planilha preservando o tipo_conta já
// salvo (nunca sobrescrito pela importação), e recarrega o estado local.
async function sincronizarDadosBancarios(linhasPlanilha) {
    await carregarDadosBancariosDB();

    const upsertRows = linhasPlanilha.map(l => {
        const existente = dadosBancariosDB[l.codigo_empregado];
        return {
            codigo_empresa:   CODIGO_EMPRESA,
            codigo_empregado: l.codigo_empregado,
            cpf:              l.cpf,
            nome_empregado:   l.nome_empregado,
            cargo:            l.cargo,
            centro_custo:     l.centro_custo,
            banco_codigo:     l.banco_codigo,
            agencia:          l.agencia,
            conta:            l.conta,
            tipo_conta:       existente ? existente.tipo_conta : 'C.Corrente',
        };
    });

    if (upsertRows.length) {
        const { error } = await supabaseClient
            .from('fechamento_dados_bancarios')
            .upsert(upsertRows, { onConflict: 'codigo_empresa,codigo_empregado' });
        if (error) throw error;
    }

    await carregarDadosBancariosDB();
}

async function processarLiquido() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de gerar o Relatório Líquido.');
        return;
    }
    if (!arquivoLiquido) {
        mostrarMensagem('Atenção', 'Selecione a planilha de Informações Bancárias / Líquido.');
        return;
    }

    try {
        const buffer   = await arquivoLiquido.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        const sheetBancaria = encontrarAba(workbook, ['informacoes bancarias']);
        const sheetLiquido  = encontrarAba(workbook, ['liquido']);

        if (!sheetBancaria || !sheetLiquido) {
            mostrarMensagem('Erro', 'A planilha precisa conter as abas "Informações bancárias" e "Líquido".');
            return;
        }

        const linhasBancariaPlanilha = dedupeBancaria(lerAbaComoObjetos(sheetBancaria, MAPA_BANCARIA));
        const linhasLiquidoPlanilha  = lerAbaComoObjetos(sheetLiquido, MAPA_LIQUIDO);

        await sincronizarDadosBancarios(linhasBancariaPlanilha);

        linhasLiquido = linhasLiquidoPlanilha
            .map(l => ({
                codigo_empregado: normalizarCodigo(l.codigo),
                cpf:              String(l.cpf || '').replace(/\D/g, ''),
                nome:             String(l.nome || '').trim(),
                valorInt:         parseMoney(l.valor),
            }))
            .filter(l => l.codigo_empregado && l.valorInt > 0);

        excluidosDoRelatorio.clear();
        montarGruposLiquido();
        renderizarRevisaoLiquido();
        document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
        mostrarPainelLiquido('revisao');
    } catch (e) {
        console.error('Erro ao processar planilha do Relatório Líquido:', e);
        mostrarMensagem('Erro', 'Falha ao processar a planilha: ' + e.message);
    }
}

function buscarDadosBancarios(linha) {
    if (dadosBancariosDB[linha.codigo_empregado]) return dadosBancariosDB[linha.codigo_empregado];
    if (linha.cpf) {
        return Object.values(dadosBancariosDB).find(d => d.cpf === linha.cpf) || null;
    }
    return null;
}

function montarGruposLiquido() {
    const porBanco = {};
    pendenciasLiquido = [];

    linhasLiquido.forEach(linha => {
        if (excluidosDoRelatorio.has(linha.codigo_empregado)) return;

        const banco = buscarDadosBancarios(linha);
        if (!banco || !banco.banco_codigo) {
            pendenciasLiquido.push(linha);
            return;
        }

        if (!porBanco[banco.banco_codigo]) {
            porBanco[banco.banco_codigo] = {
                bancoCodigo: banco.banco_codigo,
                bancoNome:   nomeBanco(banco.banco_codigo),
                linhas:      [],
                totalInt:    0,
            };
        }
        porBanco[banco.banco_codigo].linhas.push({
            codigo_empregado: banco.codigo_empregado,
            nome:             banco.nome_empregado || linha.nome,
            cpf:              banco.cpf || linha.cpf,
            agencia:          banco.agencia,
            conta:            banco.conta,
            tipoConta:        banco.tipo_conta,
            valorInt:         linha.valorInt,
        });
        porBanco[banco.banco_codigo].totalInt += linha.valorInt;
    });

    gruposLiquido = Object.values(porBanco).sort((a, b) => a.bancoNome.localeCompare(b.bancoNome, 'pt-BR'));
    atualizarBotaoPdfLiquido();
}

function atualizarBotaoPdfLiquido() {
    const btn = document.getElementById('btnGerarPdfLiquido');
    if (!btn) return;
    btn.disabled = pendenciasLiquido.length > 0;
    btn.title = pendenciasLiquido.length > 0
        ? 'Complete ou exclua os empregados sem dados bancários antes de gerar o PDF'
        : '';
}

function renderizarRevisaoLiquido() {
    const tbody = document.getElementById('bodyLiquido');

    if (!gruposLiquido.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:16px;">Nenhum lançamento com dados bancários completos.</td></tr>';
    } else {
        tbody.innerHTML = gruposLiquido.map(g => {
            const linhasHtml = g.linhas.map(l => `
                <tr>
                    <td>${l.codigo_empregado}</td>
                    <td>${escHtml(l.nome)}</td>
                    <td>${formatarCpf(l.cpf)}</td>
                    <td>${escHtml(l.agencia)} / ${escHtml(l.conta)}</td>
                    <td>
                        <select class="tipo-select" data-codigo="${l.codigo_empregado}" onchange="salvarTipoConta(this)">
                            <option value="C.Corrente" ${l.tipoConta === 'C.Corrente' ? 'selected' : ''}>C.Corrente</option>
                            <option value="C.Salário" ${l.tipoConta === 'C.Salário' ? 'selected' : ''}>C.Salário</option>
                            <option value="Poupança" ${l.tipoConta === 'Poupança' ? 'selected' : ''}>Poupança</option>
                        </select>
                    </td>
                    <td>R$ ${(l.valorInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>`).join('');

            return `
                <tr class="banco-row"><td colspan="6">🏦 Banco: ${escHtml(g.bancoNome)}</td></tr>
                ${linhasHtml}
                <tr class="total-row">
                    <td colspan="5">Total ${escHtml(g.bancoNome)}</td>
                    <td>R$ ${(g.totalInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>`;
        }).join('');
    }

    const bloco     = document.getElementById('blocoPendenciasLiquido');
    const tbodyPend = document.getElementById('bodyPendenciasLiquido');

    if (!pendenciasLiquido.length) {
        bloco.style.display = 'none';
        tbodyPend.innerHTML = '';
    } else {
        bloco.style.display = 'block';
        tbodyPend.innerHTML = pendenciasLiquido.map(l => `
            <tr>
                <td>
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">
                            ${l.codigo_empregado} — ${escHtml(l.nome)} — sem dados bancários:
                        </span>
                        <input type="text" class="pend-banco" data-codigo="${l.codigo_empregado}" placeholder="Cód. Banco (ex: 341)"
                            style="width:130px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <input type="text" class="pend-agencia" data-codigo="${l.codigo_empregado}" placeholder="Agência"
                            style="width:90px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <input type="text" class="pend-conta" data-codigo="${l.codigo_empregado}" placeholder="Conta"
                            style="width:110px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <select class="pend-tipo tipo-select" data-codigo="${l.codigo_empregado}">
                            <option value="C.Corrente">C.Corrente</option>
                            <option value="C.Salário">C.Salário</option>
                            <option value="Poupança">Poupança</option>
                        </select>
                        <button class="btn btn-primary btn-small" onclick="salvarDadosBancariosManual('${l.codigo_empregado}')">💾 Salvar</button>
                        <label style="font-size:12px;display:flex;align-items:center;gap:4px;">
                            <input type="checkbox" onchange="marcarExcluido('${l.codigo_empregado}', this.checked)"> Excluir deste relatório
                        </label>
                    </div>
                </td>
            </tr>`).join('');
    }
}

async function salvarTipoConta(selectEl) {
    const codigo = selectEl.dataset.codigo;
    const tipo   = selectEl.value;

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .update({ tipo_conta: tipo, atualizado_em: new Date().toISOString() })
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('codigo_empregado', codigo);

    if (error) { mostrarMensagem('Erro', 'Falha ao salvar tipo de conta: ' + error.message); return; }

    if (dadosBancariosDB[codigo]) dadosBancariosDB[codigo].tipo_conta = tipo;
    gruposLiquido.forEach(g => g.linhas.forEach(l => { if (l.codigo_empregado === codigo) l.tipoConta = tipo; }));
}

function marcarExcluido(codigo, excluir) {
    if (excluir) excluidosDoRelatorio.add(codigo);
    else excluidosDoRelatorio.delete(codigo);
    montarGruposLiquido();
    renderizarRevisaoLiquido();
}

async function salvarDadosBancariosManual(codigo) {
    const bancoInput   = document.querySelector(`.pend-banco[data-codigo="${codigo}"]`);
    const agenciaInput = document.querySelector(`.pend-agencia[data-codigo="${codigo}"]`);
    const contaInput   = document.querySelector(`.pend-conta[data-codigo="${codigo}"]`);
    const tipoSelect   = document.querySelector(`.pend-tipo[data-codigo="${codigo}"]`);

    const bancoCodigo = String(bancoInput.value || '').replace(/\D/g, '').padStart(3, '0');
    const agencia      = agenciaInput.value.trim();
    const conta        = contaInput.value.trim();
    const tipoConta     = tipoSelect.value;

    if (!bancoCodigo || bancoCodigo === '000' || !agencia || !conta) {
        mostrarMensagem('Atenção', 'Preencha Banco, Agência e Conta antes de salvar.');
        return;
    }

    const linha = linhasLiquido.find(l => l.codigo_empregado === codigo);
    const registro = {
        codigo_empresa:   CODIGO_EMPRESA,
        codigo_empregado: codigo,
        cpf:              linha ? linha.cpf : '',
        nome_empregado:   linha ? linha.nome : '',
        cargo:            '',
        centro_custo:     '',
        banco_codigo:     bancoCodigo,
        agencia,
        conta,
        tipo_conta:       tipoConta,
    };

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .upsert(registro, { onConflict: 'codigo_empresa,codigo_empregado' });

    if (error) { mostrarMensagem('Erro', 'Falha ao salvar dados bancários: ' + error.message); return; }

    dadosBancariosDB[codigo] = registro;
    montarGruposLiquido();
    renderizarRevisaoLiquido();
}

function mostrarPainelLiquido(nome) {
    document.getElementById('painelUploadLiquido').style.display  = nome === 'upload'  ? 'block' : 'none';
    document.getElementById('painelRevisaoLiquido').style.display = nome === 'revisao' ? 'block' : 'none';
}

function voltarParaUploadLiquido() { mostrarPainelLiquido('upload'); }

function irStep6() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de acessar o Relatório Líquido.');
        return;
    }
    document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
    mostrarPainelLiquido('upload');
    mostrarStep(6);
}
