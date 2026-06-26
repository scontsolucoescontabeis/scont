/**
 * SCONT – Fechamento Folha de Pagamento
 * Empresa: SOUL TELECOM (código 114)
 *
 * Estrutura da planilha (Planilha de Apontamento):
 *   Linha 1: Razão Social + "PROVENTOS"
 *   Linha 2: CNPJ + cabeçalhos de rubrica (cols 2+)
 *   Linha 3: Competência
 *   Linha 4: "Código" / "Nome dos Empregados"
 *   Linha 5+: Dados dos empregados
 *   Última:  "TOTAL: N Colaboradores" (terminador)
 */

const CODIGO_EMPRESA      = '114';
const LINHA_CABECALHO     = 2;   // linha com nomes de rubrica (1-based)
const LINHA_DADOS_INI     = 5;   // primeira linha de dados (1-based)
const COL_NOME            = 1;   // nome do empregado (0-based)
const COL_REG             = 0;   // código do empregado (0-based, pode ser vazio)
const COL_RUBRICAS_START  = 2;   // primeira coluna de rubrica (0-based)

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado global
let planilhaData      = [];
let funcionariosMap   = {};
let rubricasConfig    = [];
let rhRubricasData    = [];
let linhasTxt         = [];
let tipoFolhaAtual    = '11';
let empregadosConfig  = {};
let rubricasIgnoradas = new Set();

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
    const dist = levenshtein(na, nb);
    return 1 - dist / Math.max(na.length, nb.length);
}

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

function parseMoney(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).replace(/R\$|\s/g, '').trim();
    if (!str) return 0;
    let num;
    if (str.includes(',')) {
        num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    } else {
        num = parseFloat(str.replace(/[^\d.]/g, ''));
    }
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
}

function parseHoras(s) {
    if (!s && s !== 0) return 0;
    const str = String(s).trim();

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
    const compFmt     = compParts[1] + compParts[0];
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
    if (exato) {
        return { codigo_rubrica: exato.codigo_rubrica, tipo_valor: exato.tipo_valor, descricao: exato.descricao || header, fonte: 'config' };
    }

    const extrairPct = s => { const m = s.match(/\b(\d+)%/); return m ? m[1] : null; };
    const pctQuery   = extrairPct(normH);

    let melhorScore = 0, melhorCfg = null;
    for (const c of rubricasConfig) {
        const normCfg = normalizarNome(c.coluna_planilha);
        const pctCfg  = extrairPct(normCfg);
        if (pctQuery && pctCfg && pctQuery !== pctCfg) continue;
        const s1 = similaridade(normH, normCfg);
        const s2 = similaridade(normH, normalizarNome(c.descricao || ''));
        const s  = Math.max(s1, s2);
        if (s > melhorScore) { melhorScore = s; melhorCfg = c; }
    }
    if (melhorScore >= 0.80 && melhorCfg) {
        return { codigo_rubrica: melhorCfg.codigo_rubrica, tipo_valor: melhorCfg.tipo_valor, descricao: melhorCfg.descricao || header, fonte: 'config' };
    }

    melhorScore = 0; let melhorRh = null;
    for (const rh of rhRubricasData) {
        const s = similaridade(header, rh.descricao_rubrica || '');
        if (s > melhorScore) { melhorScore = s; melhorRh = rh; }
    }
    if (melhorScore >= 0.65 && melhorRh) {
        return { codigo_rubrica: melhorRh.codigo_rubrica, tipo_valor: 'monetario', descricao: header, fonte: 'rh_rubricas' };
    }

    return { codigo_rubrica: null, tipo_valor: null, descricao: header, fonte: null };
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
        await Promise.all([carregarFuncionarios(), carregarRubricas(), carregarEmpregadosConfig(), carregarRubricasIgnoradas()]);

        const buffer = await arquivoFolha.arrayBuffer();
        const wb     = XLSX.read(buffer, { type: 'array' });

        // Selecionar aba Planilha de Apontamento
        const sheetName = wb.SheetNames.find(s => s.toUpperCase().includes('APONTAMENTO')) || wb.SheetNames[0];
        const sheet     = wb.Sheets[sheetName];
        const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Linha LINHA_CABECALHO contém os nomes das rubricas (a partir de COL_RUBRICAS_START)
        const headers = rows[LINHA_CABECALHO - 1] || [];

        const colunasRubrica = [];
        headers.forEach((h, i) => {
            if (i < COL_RUBRICAS_START) return;
            const header = String(h || '').trim();
            if (!header) return;
            colunasRubrica.push({ idx: i, header, resolucao: resolverColuna(header) });
        });

        // Linhas de dados: a partir de LINHA_DADOS_INI até nome vazio ou linha "TOTAL:"
        planilhaData = [];
        for (let r = LINHA_DADOS_INI - 1; r < rows.length; r++) {
            const row  = rows[r];
            const nome = String(row[COL_NOME] || '').trim();
            if (!nome || /^total/i.test(nome)) break;

            const codEmpregadoSheet = String(row[COL_REG] || '').trim();
            const colunas = {};
            colunasRubrica.forEach(({ idx, header }) => {
                colunas[header] = String(row[idx] || '').trim();
            });

            planilhaData.push({
                nome,
                cargo: '',
                codEmpregadoSheet,
                colunas,
                colunasRubrica,
            });
        }

        tipoFolhaAtual = '11';
        construirRelatorio(comp);
        mostrarStep(2);

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
    let temSemMatch = false;

    const colunasRubrica = planilhaData.length ? planilhaData[0].colunasRubrica : [];

    planilhaData.forEach(func => {
        const codEmpregado = buscarCodigoEmpregado(func.nome);
        if (!codEmpregado) temSemMatch = true;

        colunasRubrica.forEach(({ header, resolucao }) => {
            const bruto = func.colunas[header] || '';
            if (!bruto) return;

            const tipoValor = resolucao.tipo_valor;
            const valorInt  = tipoValor && tipoValor !== 'booleano' ? valorParaTxt(bruto, tipoValor) : 0;

            linhasRelatorio.push({
                nome:          func.nome,
                codEmpregado,
                funcao:        func.cargo,
                coluna:        header,
                descricao:     header,
                codigoRubrica: resolucao.codigo_rubrica,
                fonteRubrica:  resolucao.fonte,
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

        const tr = document.createElement('tr');
        tr.id = `rel-row-${i}`;
        if (ignorada)          { tr.style.background = '#f5f5f5'; tr.style.opacity = '0.6'; }
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
            <td>${acaoBtns}</td>
        `;
        tbody.appendChild(tr);

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

        empregadosConfig[normalizarNome(nome)] = codigo;
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

    if (!codigo) {
        statusEl.textContent = '⚠ Informe o código.';
        statusEl.style.color = '#E74C3C';
        return;
    }

    const linha  = linhasRelatorio[idx];
    const coluna = linha.coluna;

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
                ativo:           true,
            }]);
        if (error) throw error;

        linhasRelatorio.forEach(l => {
            if (l.coluna !== coluna) return;
            l.codigoRubrica = codigo;
            l.tipoValor     = tipoValor;
            l.fonteRubrica  = 'config';
            l.valorInt      = tipoValor !== 'booleano' ? valorParaTxt(l.bruto, tipoValor) : 0;
        });

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
            l.valorInt  = novoTipo !== 'booleano' ? valorParaTxt(l.bruto, novoTipo) : 0;
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

    linhasTxt = [];
    linhasRelatorio.forEach(l => {
        if (l.codEmpregado && l.valorInt > 0 && !rubricasIgnoradas.has(normalizarNome(l.coluna))) {
            linhasTxt.push(
                gerarLinhaTxt(l.codEmpregado, comp, l.codigoRubrica, tipoProcesso, l.valorInt, CODIGO_EMPRESA)
            );
        }
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
    const comp     = document.getElementById('competencia').value.trim().replace('/', '-');
    const conteudo = linhasTxt.join('\n');
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Fechamento_SOUL_${comp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
// CONFIGURAÇÕES – ASSOCIAÇÕES DE RUBRICAS
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
            .select('id, codigo_empresa, descricao, codigo_rubrica, tipo_valor, ativo')
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
        tbody.innerHTML = lista.map(r => `
            <tr>
                <td><strong>${r.codigo_empresa}</strong></td>
                <td>${r.descricao || '–'}</td>
                <td style="font-family:monospace;font-weight:600;">${r.codigo_rubrica}</td>
                <td><span class="badge badge-${r.tipo_valor}">${tipoLabel[r.tipo_valor] || r.tipo_valor}</span></td>
                <td>${r.ativo ? '✅' : '❌'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-small" onclick="toggleAtivoRubrica('${r.id}',${r.ativo})"
                        style="margin-right:4px;">${r.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn btn-secondary btn-small" style="background:#E74C3C;border-color:#E74C3C;color:white;"
                        onclick="deletarRubricaConfig('${r.id}')">Excluir</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
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
// PAINEL DE ENVIOS
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
        container.innerHTML = '<div class="envios-vazio">Nenhum envio encontrado. Processe uma planilha para gerar o histórico.</div>';
        return;
    }

    container.innerHTML = data.map(env => {
        const tipoLabel = TIPO_FOLHA_LABELS[env.tipo_folha] || env.tipo_folha;
        const enviadoEm = new Date(env.enviado_em).toLocaleString('pt-BR');
        const badge     = '<div class="envio-badge processado">📊 Planilha</div>';
        return `
        <div class="envio-card">
            ${badge}
            <div class="envio-info">
                <div class="envio-info-title">Competência ${env.competencia} · ${env.tipo_folha} – ${tipoLabel}</div>
                <div class="envio-info-sub">Planilha · Enviado em ${enviadoEm} · SOUL TELECOM · 114</div>
            </div>
            <div class="envio-actions">
                <button class="btn-processar-envio processado" onclick="processarEnvio(${env.id})">↻ Recarregar</button>
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
        await recarregarPlanilha(data);
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
    document.getElementById('headerSubtitle').textContent = `SOUL TELECOM · 114 · ${label} · via Planilha`;
    document.getElementById('labelCompetencia2').textContent = 'Competência: ' + label;
    document.getElementById('labelCompetencia3').textContent = 'Competência: ' + label;

    linhasRelatorio = d.linhas || [];
    linhasTxt = [];

    const temSemMatch = linhasRelatorio.some(l => !l.codEmpregado);
    document.getElementById('alertaSemMatch').style.display = temSemMatch ? 'block' : 'none';
    renderizarRelatorio(linhasRelatorio);
    mostrarStep(2);
}
