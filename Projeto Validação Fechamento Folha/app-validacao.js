const ExtratoParser = window.ExtratoParser;
const MatrizCompetencia = window.MatrizCompetencia;

function chaveEmpregado(emp) { return `${emp.tipo}:${emp.matricula}`; }

const state = {
    arquivo: null,
    competencias: [],
    competenciaAtual: null,
    empregadosSelecionados: new Set(),
    rubricasSelecionadas: new Set(),
    matrizAtual: null,
    mostrarQuantidade: true,
    mostrarValor: true
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
    btnNovaValidacao: document.getElementById('btnNovaValidacao'),
    btnGerarPdf: document.getElementById('btnGerarPdf'),
    chkMostrarQuantidade: document.getElementById('chkMostrarQuantidade'),
    chkMostrarValor: document.getElementById('chkMostrarValor')
};

function formatarBRL(valor) {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escaparHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

    els.btnGerarPdf.addEventListener('click', gerarPDF);

    els.chkMostrarQuantidade.addEventListener('change', () => {
        if (!els.chkMostrarQuantidade.checked && !els.chkMostrarValor.checked) {
            els.chkMostrarQuantidade.checked = true;
            return;
        }
        state.mostrarQuantidade = els.chkMostrarQuantidade.checked;
        renderizarMatriz();
    });
    els.chkMostrarValor.addEventListener('change', () => {
        if (!els.chkMostrarValor.checked && !els.chkMostrarQuantidade.checked) {
            els.chkMostrarValor.checked = true;
            return;
        }
        state.mostrarValor = els.chkMostrarValor.checked;
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
        state.matrizAtual = null;
        state.mostrarQuantidade = true;
        state.mostrarValor = true;
        els.chkMostrarQuantidade.checked = true;
        els.chkMostrarValor.checked = true;
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
    els.selectCompetencia.innerHTML = ordenadas.map(c => `<option value="${escaparHTML(c.competencia)}">${escaparHTML(c.competencia)}</option>`).join('');
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
                <input type="checkbox" data-chave="${escaparHTML(chave)}" ${marcado}>
                <span>${escaparHTML(emp.matricula)} — ${escaparHTML(emp.nome)}</span>
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
                <input type="checkbox" data-codigo="${escaparHTML(r.codigo)}" ${marcado}>
                <span>${escaparHTML(r.codigo)} — ${escaparHTML(r.descricao)}</span>
            </label>
        `;
    }).join('');
    return `<div class="selecao-grupo-rotulo ${classeTipo}">${escaparHTML(rotulo)}</div>${itens}`;
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
    state.matrizAtual = matriz;

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
        <th class="col-rubrica ${col.tipo === 'P' ? 'tipo-provento' : 'tipo-desconto'}" title="${escaparHTML(col.codigo)} — ${escaparHTML(col.descricao)}">${escaparHTML(col.descricao)}</th>
    `).join('');

    const linhas = matriz.linhas.map(linha => `
        <tr>
            <td class="col-empregado">${escaparHTML(linha.matricula)} — ${escaparHTML(linha.nome)}</td>
            ${linha.valores.map((v, i) => {
                if (v === null) return '<td class="valor">—</td>';
                const tipoClasse = matriz.colunas[i].tipo === 'P' ? 'tipo-provento' : 'tipo-desconto';
                const partes = [];
                if (state.mostrarQuantidade) partes.push(`<span class="celula-referencia">${escaparHTML(v.referencia)}</span>`);
                if (state.mostrarValor) partes.push(`<span class="celula-valor ${tipoClasse}">${formatarBRL(v.valor)}</span>`);
                return `<td class="valor"><div class="celula-matriz">${partes.join('')}</div></td>`;
            }).join('')}
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

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    };
}

function sanitizarNomeArquivo(str) {
    return String(str).replace(/[/\\:*?"<>|]/g, '_');
}

// ── PDF — jsPDF + AutoTable, mesmo padrão de cabeçalho do relatório de
// Programação de Férias (Fechamento Folha): barra colorida com
// empresa/CNPJ à esquerda e título/data à direita, paisagem com
// largura dinâmica conforme o número de colunas. ──
function gerarPDF() {
    limparErro();
    const matriz = state.matrizAtual;
    if (!matriz || matriz.colunas.length === 0 || matriz.linhas.length === 0) {
        mostrarErro('Selecione ao menos um empregado e uma rubrica antes de gerar o PDF.');
        return;
    }
    const competencia = state.competenciaAtual;

    const head = [['Empregado', ...matriz.colunas.map(c => c.descricao)]];
    const body = matriz.linhas.map(linha => [
        `${linha.matricula} — ${linha.nome}`,
        ...linha.valores.map(v => {
            if (v === null) return '—';
            const partes = [];
            if (state.mostrarQuantidade) partes.push(v.referencia);
            if (state.mostrarValor) partes.push(formatarBRL(v.valor));
            return partes.join('\n') || '—';
        })
    ]);

    const MM_PER_COL = 16;
    const COL_EMPREGADO_MM = 55;
    const MARGEM = 10;
    const pageW = Math.max(297, COL_EMPREGADO_MM + matriz.colunas.length * MM_PER_COL + MARGEM * 2);
    const pageH = 210;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: 'landscape' });

    const rgb = hexToRgb('#8B3A3A');
    const empresa = competencia.empresaCodigo
        ? `${competencia.empresaCodigo} — ${competencia.empresaNome || ''}`
        : (competencia.empresaNome || '');
    const titulo = `Validação Competência — ${competencia.competencia}`;
    const dataGer = new Date().toLocaleDateString('pt-BR');

    const barH = competencia.cnpj ? 18 : 13;
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, barH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    if (empresa) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(empresa, MARGEM + 4, MARGEM + 6);
    }
    if (competencia.cnpj) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text('CNPJ: ' + competencia.cnpj, MARGEM + 4, MARGEM + 12);
    }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(titulo, pageW - MARGEM - 4, MARGEM + 6, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em ${dataGer} · ${matriz.linhas.length} empregado(s) × ${matriz.colunas.length} rubrica(s)`,
        pageW - MARGEM - 4, MARGEM + 12, { align: 'right' });
    const startY = MARGEM + barH + 4;

    doc.autoTable({
        head, body, startY,
        margin: { left: MARGEM, right: MARGEM },
        tableWidth: pageW - MARGEM * 2,
        styles: { fontSize: 6.5, cellPadding: 1.8, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 0: { cellWidth: COL_EMPREGADO_MM, halign: 'left' } },
        bodyStyles: { halign: 'right' }
    });

    doc.save(sanitizarNomeArquivo(titulo) + '.pdf');
}

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
    if (!auth) return;
    configurarEventos();
});
