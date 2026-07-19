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

// ===== ETAPA 2 — EMPRESA + COMPETÊNCIA =====
function prepararEtapa2() {
    const inputComp = document.getElementById('competencia');
    const msgOrigem = document.getElementById('competenciaOrigemMsg');
    if (state.competencia) {
        inputComp.value = state.competencia;
    }
    msgOrigem.textContent = state.competenciaAutoDetectada
        ? 'Competência detectada automaticamente a partir do PDF — confirme ou ajuste se necessário.'
        : 'Não foi possível detectar a competência no PDF — preencha manualmente.';
    atualizarBotaoProximo2();
}

async function carregarEmpresas() {
    try {
        const { data, error } = await state.sb
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state._todasEmpresas = data || [];
    } catch (e) {
        console.warn('Erro ao carregar empresas:', e.message);
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
        `<div class="autocomplete-item" onclick="selecionarEmpresa('${e.codigo_empresa}','${e.nome_empresa.replace(/'/g, "\\'")}')">
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
    atualizarBotaoProximo2();
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
        state.empregados = [];
    }
}

window.formatarCompetenciaInput = function(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
    el.value = v;
    state.competencia = el.value;
    atualizarBotaoProximo2();
};

function atualizarBotaoProximo2() {
    const ok = !!state.empresa && /^(0[1-9]|1[0-2])\/\d{4}$/.test(state.competencia);
    document.getElementById('btnProximo2').disabled = !ok;
}

window.avancarEtapa3 = function() {
    mostrarEtapa(3);
    prepararEtapa3();
};

// ===== ETAPA 3 — REVISÃO DE COLABORADORES =====
const VALOR_IGNORAR = '__ignorar__';

function prepararEtapa3() {
    ocultarMsg('msgStep3');
    state.vinculos = state.colaboradoresPdf.map(colab => {
        const sugestao = _melhorMatchEmpregado(colab.nome, state.empregados);
        return { empregado: sugestao || null, ignorar: false };
    });
    renderizarVinculos();
    atualizarBotaoProximo3();
}

function renderizarVinculos() {
    const container = document.getElementById('listaVinculos');

    container.innerHTML = state.colaboradoresPdf.map((colab, idx) => {
        const vinculo = state.vinculos[idx];
        const semSugestao = !vinculo.empregado && !vinculo.ignorar;
        const opcoesEmpregados = state.empregados.map(e => {
            const selecionado = vinculo.empregado && vinculo.empregado.codigo_empregado === e.codigo_empregado;
            return `<option value="${e.codigo_empregado}" ${selecionado ? 'selected' : ''}>${e.codigo_empregado} — ${e.nome_empregado}</option>`;
        }).join('');
        return `
        <div class="vinculo-grid">
            <div>
                <strong>${colab.nome}</strong><br>
                <span style="font-size:11px;color:#7F8C8D;">CPF: ${colab.cpf || '—'} · Função: ${colab.funcao || '—'}</span>
                ${semSugestao ? '<br><span style="font-size:11px;color:#C0392B;">Sem sugestão automática — selecione manualmente</span>' : ''}
            </div>
            <div>
                <select onchange="atualizarVinculo(${idx}, this.value)">
                    <option value="" ${!vinculo.empregado && !vinculo.ignorar ? 'selected' : ''}>-- Selecione --</option>
                    ${opcoesEmpregados}
                    <option value="${VALOR_IGNORAR}" ${vinculo.ignorar ? 'selected' : ''}>Não importar este colaborador</option>
                </select>
            </div>
        </div>`;
    }).join('');
}

window.atualizarVinculo = function(idx, valor) {
    if (valor === VALOR_IGNORAR) {
        state.vinculos[idx] = { empregado: null, ignorar: true };
    } else if (!valor) {
        state.vinculos[idx] = { empregado: null, ignorar: false };
    } else {
        const emp = state.empregados.find(e => e.codigo_empregado === valor);
        state.vinculos[idx] = { empregado: emp || null, ignorar: false };
    }
    atualizarBotaoProximo3();
};

function atualizarBotaoProximo3() {
    const todosDecididos = state.vinculos.length > 0 &&
        state.vinculos.every(v => v.ignorar || !!v.empregado);
    document.getElementById('btnProximo3').disabled = !todosDecididos;
    if (!todosDecididos) {
        mostrarMsg('msgStep3', 'aviso', 'Escolha um vínculo (ou "Não importar") para todos os colaboradores antes de continuar.');
    } else {
        ocultarMsg('msgStep3');
    }
}

window.avancarEtapa4 = function() {
    mostrarEtapa(4);
    prepararEtapa4();
};
