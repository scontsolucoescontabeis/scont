const ExtratoParser = window.ExtratoParser;
const ExtratoComparador = window.ExtratoComparador;

const state = { arquivo: null };

const els = {
    inputArquivo: document.getElementById('inputArquivo'),
    uploadArea: document.getElementById('uploadArea'),
    nomeArquivo: document.getElementById('nomeArquivo'),
    inputLimiar: document.getElementById('inputLimiar'),
    btnProcessar: document.getElementById('btnProcessar'),
    spinner: document.getElementById('spinner'),
    mensagemErro: document.getElementById('mensagemErro'),
    cardUpload: document.getElementById('cardUpload'),
    resultado: document.getElementById('resultado'),
    resumoCompetencias: document.getElementById('resumoCompetencias'),
    cardsTotais: document.getElementById('cardsTotais'),
    tabelaQuadro: document.getElementById('tabelaQuadro'),
    contagemQuadro: document.getElementById('contagemQuadro'),
    tabelaVariacao: document.getElementById('tabelaVariacao'),
    contagemVariacao: document.getElementById('contagemVariacao'),
    btnNovaValidacao: document.getElementById('btnNovaValidacao')
};

function formatarBRL(valor) {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPct(valor) {
    if (valor === null || valor === undefined) return '—';
    const sinal = valor > 0 ? '+' : '';
    return `${sinal}${valor.toFixed(1).replace('.', ',')}%`;
}

function classeDelta(valor) {
    if (valor === null || valor === undefined || valor === 0) return 'neutro';
    return valor > 0 ? 'positivo' : 'negativo';
}

function mostrarErro(msg) {
    els.mensagemErro.textContent = msg;
    els.mensagemErro.classList.add('visivel');
}
function limparErro() {
    els.mensagemErro.textContent = '';
    els.mensagemErro.classList.remove('visivel');
}

// ── upload ──
function configurarEventos() {
    els.uploadArea.addEventListener('dragover', (ev) => { ev.preventDefault(); els.uploadArea.classList.add('dragover'); });
    els.uploadArea.addEventListener('dragleave', () => els.uploadArea.classList.remove('dragover'));
    els.uploadArea.addEventListener('drop', (ev) => {
        ev.preventDefault();
        els.uploadArea.classList.remove('dragover');
        if (ev.dataTransfer.files.length > 0) {
            els.inputArquivo.files = ev.dataTransfer.files;
            onArquivoSelecionado();
        }
    });
    els.inputArquivo.addEventListener('change', onArquivoSelecionado);

    els.btnProcessar.addEventListener('click', processarArquivo);
    els.btnNovaValidacao.addEventListener('click', () => {
        els.resultado.classList.remove('visivel');
        els.cardUpload.style.display = '';
        els.inputArquivo.value = '';
        els.nomeArquivo.textContent = '';
        state.arquivo = null;
        els.btnProcessar.disabled = true;
        limparErro();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;
    configurarEventos();
});

function onArquivoSelecionado() {
    const arquivo = els.inputArquivo.files[0];
    limparErro();
    if (!arquivo) { state.arquivo = null; els.btnProcessar.disabled = true; return; }
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
        mostrarErro('Selecione um arquivo PDF.');
        state.arquivo = null;
        els.btnProcessar.disabled = true;
        return;
    }
    state.arquivo = arquivo;
    els.nomeArquivo.textContent = arquivo.name;
    els.btnProcessar.disabled = false;
}

async function processarArquivo() {
    limparErro();
    els.spinner.classList.add('visivel');
    els.btnProcessar.disabled = true;
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await state.arquivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let todasLinhas = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            todasLinhas = todasLinhas.concat(ExtratoParser._reconstruirLinhasPagina(content.items));
        }

        const competencias = ExtratoParser.parseExtratoMensal(todasLinhas);
        if (competencias.length === 0) {
            throw new Error('Não foi possível reconhecer nenhuma competência neste PDF. Confirme se é um "Extrato Mensal" do sistema de folha.');
        }

        const { anterior, atual } = ExtratoComparador.ordenarCompetencias(competencias);
        if (!anterior) {
            throw new Error(`O PDF contém apenas a competência ${atual.competencia}. Envie um PDF com a competência atual e a anterior (ex.: exporte um intervalo de 2 meses do sistema de folha).`);
        }

        const limiarPercentual = Number(els.inputLimiar.value) || 15;
        const resultado = ExtratoComparador.compararCompetencias(anterior, atual, { limiarPercentual });
        renderizarResultado(resultado, anterior, atual);

        els.cardUpload.style.display = 'none';
        els.resultado.classList.add('visivel');
    } catch (err) {
        console.error(err);
        mostrarErro(err.message || 'Erro ao processar o PDF.');
    } finally {
        els.spinner.classList.remove('visivel');
        els.btnProcessar.disabled = false;
    }
}

function renderizarResultado(resultado, anterior, atual) {
    els.resumoCompetencias.innerHTML = `
        <span>${anterior.empresaCodigo ? anterior.empresaCodigo + ' — ' : ''}${atual.empresaNome || ''}</span>
        <strong>${resultado.competenciaAnterior}</strong>
        <span class="seta">→</span>
        <strong>${resultado.competenciaAtual}</strong>
        <span>· limiar de destaque: ${resultado.limiarPercentual}%</span>
    `;

    renderizarCardsTotais(resultado.totalGeral);
    renderizarTabelaQuadro(resultado.mudancasQuadro);
    renderizarTabelaVariacao(resultado.variacaoTotais);
}

function cardTotalHtml(titulo, comparativo) {
    return `
        <div class="card-total">
            <h3>${titulo}</h3>
            <div class="valores">
                <span class="valor-atual">${formatarBRL(comparativo.atual)}</span>
                <span class="valor-anterior">antes: ${formatarBRL(comparativo.anterior)}</span>
            </div>
            <div class="delta ${classeDelta(comparativo.deltaPercentual)}">
                ${comparativo.deltaAbsoluto >= 0 ? '+' : ''}${formatarBRL(comparativo.deltaAbsoluto)} (${formatarPct(comparativo.deltaPercentual)})
            </div>
        </div>
    `;
}

function renderizarCardsTotais(totalGeral) {
    els.cardsTotais.innerHTML =
        cardTotalHtml('Proventos', totalGeral.proventos) +
        cardTotalHtml('Descontos', totalGeral.descontos) +
        cardTotalHtml('Líquido', totalGeral.liquido);
}

const ROTULO_MUDANCA = {
    admissao: 'Admissão',
    saida: 'Saída',
    entrouFerias: 'Entrou de férias',
    voltouFerias: 'Voltou de férias',
    mudancaSituacao: 'Mudança de situação'
};

function detalheMudanca(m) {
    switch (m.tipo) {
        case 'admissao': return `Situação: ${m.situacao}`;
        case 'saida': return m.demissao ? `Demitido em ${m.demissao.data} — ${m.demissao.motivo}` : `Última situação: ${m.situacaoAnterior}`;
        case 'entrouFerias': return `${m.ferias.inicio} - ${m.ferias.fim}`;
        case 'voltouFerias': return `Estava de férias: ${m.feriasAnterior.inicio} - ${m.feriasAnterior.fim}`;
        case 'mudancaSituacao': return `${m.situacaoAnterior} → ${m.situacaoAtual}`;
        default: return '';
    }
}

function renderizarTabelaQuadro(mudancas) {
    els.contagemQuadro.textContent = mudancas.length;
    if (mudancas.length === 0) {
        els.tabelaQuadro.innerHTML = '<div class="vazio">Nenhuma mudança de quadro entre as duas competências.</div>';
        return;
    }
    const linhas = mudancas.map(m => `
        <tr>
            <td>${m.matricula}</td>
            <td>${m.nome}</td>
            <td><span class="badge-mudanca ${m.tipo}">${ROTULO_MUDANCA[m.tipo] || m.tipo}</span></td>
            <td>${detalheMudanca(m)}</td>
        </tr>
    `).join('');
    els.tabelaQuadro.innerHTML = `
        <table class="tabela-dados">
            <thead><tr><th>Matrícula</th><th>Nome</th><th>Mudança</th><th>Detalhe</th></tr></thead>
            <tbody>${linhas}</tbody>
        </table>
    `;
}

function renderizarTabelaVariacao(linhasVariacao) {
    els.contagemVariacao.textContent = linhasVariacao.length;
    if (linhasVariacao.length === 0) {
        els.tabelaVariacao.innerHTML = '<div class="vazio">Nenhum empregado em comum entre as duas competências.</div>';
        return;
    }
    const linhas = linhasVariacao.map(v => `
        <tr class="${v.acimaDoLimiar ? 'linha-alerta' : ''}">
            <td>${v.matricula}</td>
            <td>${v.nome}</td>
            <td>${formatarBRL(v.proventos.anterior)} → ${formatarBRL(v.proventos.atual)}</td>
            <td class="${classeDelta(v.proventos.deltaPercentual)}">${formatarPct(v.proventos.deltaPercentual)}</td>
            <td>${formatarBRL(v.descontos.anterior)} → ${formatarBRL(v.descontos.atual)}</td>
            <td class="${classeDelta(v.descontos.deltaPercentual)}">${formatarPct(v.descontos.deltaPercentual)}</td>
            <td>${formatarBRL(v.liquido.anterior)} → ${formatarBRL(v.liquido.atual)}</td>
            <td class="${classeDelta(v.liquido.deltaPercentual)}">${formatarPct(v.liquido.deltaPercentual)}</td>
        </tr>
    `).join('');
    els.tabelaVariacao.innerHTML = `
        <table class="tabela-dados">
            <thead><tr>
                <th>Matrícula</th><th>Nome</th>
                <th>Proventos</th><th>Δ%</th>
                <th>Descontos</th><th>Δ%</th>
                <th>Líquido</th><th>Δ%</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
        </table>
    `;
}
