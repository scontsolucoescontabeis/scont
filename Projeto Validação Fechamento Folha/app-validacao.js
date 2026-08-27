const ExtratoParser = window.ExtratoParser;
const MatrizCompetencia = window.MatrizCompetencia;

function chaveEmpregado(emp) { return `${emp.tipo}:${emp.matricula}`; }

const state = {
    arquivo: null,
    competencias: [],
    competenciaAtual: null,
    empregadosSelecionados: new Set(),
    rubricasSelecionadas: new Set()
};

const els = {
    inputArquivo: document.getElementById('inputArquivo'),
    uploadArea: document.getElementById('uploadArea'),
    nomeArquivo: document.getElementById('nomeArquivo'),
    btnProcessar: document.getElementById('btnProcessar'),
    spinner: document.getElementById('spinner'),
    mensagemErro: document.getElementById('mensagemErro'),
    cardUpload: document.getElementById('cardUpload'),
    resultado: document.getElementById('resultado'),
    selectCompetencia: document.getElementById('selectCompetencia'),
    infoEmpresa: document.getElementById('infoEmpresa'),
    listaEmpregados: document.getElementById('listaEmpregados'),
    contagemEmpregados: document.getElementById('contagemEmpregados'),
    listaRubricas: document.getElementById('listaRubricas'),
    contagemRubricas: document.getElementById('contagemRubricas'),
    tabelaMatriz: document.getElementById('tabelaMatriz'),
    contagemMatriz: document.getElementById('contagemMatriz'),
    btnTodosEmpregados: document.getElementById('btnTodosEmpregados'),
    btnNenhumEmpregado: document.getElementById('btnNenhumEmpregado'),
    btnTodasRubricas: document.getElementById('btnTodasRubricas'),
    btnNenhumaRubrica: document.getElementById('btnNenhumaRubrica'),
    btnNovaValidacao: document.getElementById('btnNovaValidacao')
};

function formatarBRL(valor) {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarErro(msg) {
    els.mensagemErro.textContent = msg;
    els.mensagemErro.classList.add('visivel');
}
function limparErro() {
    els.mensagemErro.textContent = '';
    els.mensagemErro.classList.remove('visivel');
}

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

    els.selectCompetencia.addEventListener('change', () => {
        selecionarCompetencia(els.selectCompetencia.value);
    });

    els.btnTodosEmpregados.addEventListener('click', () => {
        state.competenciaAtual.empregados.forEach(e => state.empregadosSelecionados.add(chaveEmpregado(e)));
        renderizarListaEmpregados();
        renderizarMatriz();
    });
    els.btnNenhumEmpregado.addEventListener('click', () => {
        state.empregadosSelecionados.clear();
        renderizarListaEmpregados();
        renderizarMatriz();
    });
    els.btnTodasRubricas.addEventListener('click', () => {
        const { proventos, descontos } = MatrizCompetencia.construirRubricasDistintas(state.competenciaAtual.empregados);
        [...proventos, ...descontos].forEach(r => state.rubricasSelecionadas.add(r.codigo));
        renderizarListaRubricas();
        renderizarMatriz();
    });
    els.btnNenhumaRubrica.addEventListener('click', () => {
        state.rubricasSelecionadas.clear();
        renderizarListaRubricas();
        renderizarMatriz();
    });

    els.btnNovaValidacao.addEventListener('click', () => {
        els.resultado.classList.remove('visivel');
        els.cardUpload.style.display = '';
        els.inputArquivo.value = '';
        els.nomeArquivo.textContent = '';
        state.arquivo = null;
        state.competencias = [];
        state.competenciaAtual = null;
        state.empregadosSelecionados = new Set();
        state.rubricasSelecionadas = new Set();
        els.btnProcessar.disabled = true;
        limparErro();
    });
}

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

        state.competencias = competencias;
        popularSelectCompetencia(competencias);
        selecionarCompetencia(els.selectCompetencia.value);

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

function popularSelectCompetencia(competencias) {
    const ordenadas = competencias.slice().sort((a, b) => {
        const [ma, aa] = a.competencia.split('/').map(Number);
        const [mb, ab] = b.competencia.split('/').map(Number);
        return (ab * 100 + mb) - (aa * 100 + ma);
    });
    els.selectCompetencia.innerHTML = ordenadas.map(c => `<option value="${c.competencia}">${c.competencia}</option>`).join('');
}

function selecionarCompetencia(competenciaStr) {
    const competencia = state.competencias.find(c => c.competencia === competenciaStr) || state.competencias[0];
    state.competenciaAtual = competencia;
    els.selectCompetencia.value = competencia.competencia;
    els.infoEmpresa.textContent = competencia.empresaCodigo
        ? `${competencia.empresaCodigo} — ${competencia.empresaNome || ''}`
        : (competencia.empresaNome || '');

    state.empregadosSelecionados = new Set(competencia.empregados.map(chaveEmpregado));
    const { proventos, descontos } = MatrizCompetencia.construirRubricasDistintas(competencia.empregados);
    state.rubricasSelecionadas = new Set([...proventos, ...descontos].map(r => r.codigo));

    renderizarListaEmpregados();
    renderizarListaRubricas();
    renderizarMatriz();
}

function renderizarListaEmpregados() {
    const empregados = state.competenciaAtual.empregados;
    els.contagemEmpregados.textContent = `${state.empregadosSelecionados.size}/${empregados.length}`;
    els.listaEmpregados.innerHTML = empregados.map(emp => {
        const chave = chaveEmpregado(emp);
        const marcado = state.empregadosSelecionados.has(chave) ? 'checked' : '';
        return `
            <label class="selecao-item">
                <input type="checkbox" data-chave="${chave}" ${marcado}>
                <span>${emp.matricula} — ${emp.nome}</span>
            </label>
        `;
    }).join('');

    els.listaEmpregados.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', (ev) => {
            const chave = ev.target.dataset.chave;
            if (ev.target.checked) state.empregadosSelecionados.add(chave);
            else state.empregadosSelecionados.delete(chave);
            els.contagemEmpregados.textContent = `${state.empregadosSelecionados.size}/${empregados.length}`;
            renderizarMatriz();
        });
    });
}

function renderizarGrupoRubricas(rotulo, rubricas, classeTipo) {
    if (rubricas.length === 0) return '';
    const itens = rubricas.map(r => {
        const marcado = state.rubricasSelecionadas.has(r.codigo) ? 'checked' : '';
        return `
            <label class="selecao-item">
                <input type="checkbox" data-codigo="${r.codigo}" ${marcado}>
                <span>${r.codigo} — ${r.descricao}</span>
            </label>
        `;
    }).join('');
    return `<div class="selecao-grupo-rotulo ${classeTipo}">${rotulo}</div>${itens}`;
}

function renderizarListaRubricas() {
    const { proventos, descontos } = MatrizCompetencia.construirRubricasDistintas(state.competenciaAtual.empregados);
    const total = proventos.length + descontos.length;
    els.contagemRubricas.textContent = `${state.rubricasSelecionadas.size}/${total}`;

    els.listaRubricas.innerHTML =
        renderizarGrupoRubricas('Proventos', proventos, 'tipo-provento') +
        renderizarGrupoRubricas('Descontos', descontos, 'tipo-desconto');

    els.listaRubricas.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', (ev) => {
            const codigo = ev.target.dataset.codigo;
            if (ev.target.checked) state.rubricasSelecionadas.add(codigo);
            else state.rubricasSelecionadas.delete(codigo);
            els.contagemRubricas.textContent = `${state.rubricasSelecionadas.size}/${total}`;
            renderizarMatriz();
        });
    });
}

function renderizarMatriz() {
    const matriz = MatrizCompetencia.construirMatriz(
        state.competenciaAtual.empregados,
        state.rubricasSelecionadas,
        state.empregadosSelecionados,
        chaveEmpregado
    );

    els.contagemMatriz.textContent = `${matriz.linhas.length} empregado(s) × ${matriz.colunas.length} rubrica(s)`;

    if (matriz.colunas.length === 0 || matriz.linhas.length === 0) {
        els.tabelaMatriz.innerHTML = '<div class="vazio">Selecione ao menos um empregado e uma rubrica para montar a folha.</div>';
        return;
    }

    const nDescontos = matriz.colunas.length - matriz.nProventos;
    const cabecalhoGrupo = [
        matriz.nProventos > 0 ? `<th colspan="${matriz.nProventos}" class="grupo-provento">Proventos</th>` : '',
        nDescontos > 0 ? `<th colspan="${nDescontos}" class="grupo-desconto">Descontos</th>` : ''
    ].join('');

    const cabecalhoRubricas = matriz.colunas.map(col => `
        <th class="col-rubrica ${col.tipo === 'P' ? 'tipo-provento' : 'tipo-desconto'}" title="${col.descricao}">${col.codigo}</th>
    `).join('');

    const linhas = matriz.linhas.map(linha => `
        <tr>
            <td class="col-empregado">${linha.matricula} — ${linha.nome}</td>
            ${linha.valores.map(v => `<td class="valor">${v === null ? '—' : formatarBRL(v)}</td>`).join('')}
        </tr>
    `).join('');

    els.tabelaMatriz.innerHTML = `
        <table class="tabela-dados tabela-matriz">
            <thead>
                <tr class="linha-grupo"><th class="col-empregado" rowspan="2">Empregado</th>${cabecalhoGrupo}</tr>
                <tr>${cabecalhoRubricas}</tr>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    `;
}

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;
    configurarEventos();
});
