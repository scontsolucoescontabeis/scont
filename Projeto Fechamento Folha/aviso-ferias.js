// ──────────────────────────────────────────────
// ESTADO
// ──────────────────────────────────────────────
const state = {
    _arquivoSelecionado: null,
    pdfBytesOriginal: null,
    intervalo: '',
    grupos: [],        // [{ chave, nome_empresa, cnpj, empregados, paginas, codigo_empresa }]
    empresasCache: [],  // [{ codigo_empresa, nome_empresa, cnpj }]
    arquivosGerados: [] // [{ nomeArquivo, bytes }]
};

// ──────────────────────────────────────────────
// NAVEGAÇÃO ENTRE PASSOS
// ──────────────────────────────────────────────
function irParaStep(n) {
    [1, 2, 3].forEach(i => {
        document.getElementById(`step${i}`).style.display = (i === n) ? 'block' : 'none';
        document.getElementById(`circle${i}`).classList.toggle('active', i === n);
        document.getElementById(`circle${i}`).classList.toggle('done', i < n);
        document.getElementById(`text${i}`).classList.toggle('active', i === n);
        document.getElementById(`text${i}`).classList.toggle('done', i < n);
    });
    [1, 2].forEach(i => document.getElementById(`line${i}`).classList.toggle('done', i < n));
}

// ──────────────────────────────────────────────
// EMPRESAS (rh_empresas)
// ──────────────────────────────────────────────
async function carregarEmpresas() {
    const { data, error } = await supabaseClient
        .from('rh_empresas')
        .select('codigo_empresa, nome_empresa, cnpj')
        .order('nome_empresa');
    if (error) { console.error('Erro ao carregar rh_empresas:', error); return []; }
    return data || [];
}

function construirMapaCnpj(empresas) {
    const mapa = {};
    empresas.forEach(e => {
        if (e.cnpj) mapa[_normalizarCNPJ(e.cnpj)] = { codigo_empresa: e.codigo_empresa, nome_empresa: e.nome_empresa };
    });
    return mapa;
}

// ──────────────────────────────────────────────
// PARSING DO PDF (PDF.js + módulo puro aviso-ferias-parser.js)
// ──────────────────────────────────────────────
async function parsearPdfAvisoFerias(arrayBuffer) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const paginas = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const linhas = _reconstruirLinhasPagina(content.items);
        const tipo = _classificarTipoPagina(linhas);
        let dados = null;
        if (tipo === 'aviso') dados = _extrairDadosAviso(linhas);
        else if (tipo === 'abono') dados = _extrairDadosAbono(linhas);
        paginas.push({ numero: p, tipo, dados: dados || {} });
    }

    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    const grupos = _agruparPorEmpresa(registros);
    return { grupos, avisos, totalPaginas: pdf.numPages };
}

// ──────────────────────────────────────────────
// TELA DE REVISÃO (PASSO 2)
// ──────────────────────────────────────────────
function renderizarLinhaGrupo(grupo, index) {
    const badge = grupo.codigo_empresa
        ? `<span class="badge-ok">✓ ${grupo.codigo_empresa}</span>`
        : `<span class="badge-pendente">Pendente</span>`;

    const opcoes = state.empresasCache
        .map(e => `<option value="${e.codigo_empresa}" ${e.codigo_empresa === grupo.codigo_empresa ? 'selected' : ''}>${e.codigo_empresa} — ${e.nome_empresa}</option>`)
        .join('');

    return `
        <tr data-index="${index}">
            <td>${grupo.nome_empresa || '—'}</td>
            <td>${grupo.cnpj || '—'}</td>
            <td>${grupo.empregados.length}</td>
            <td>${grupo.paginas.length}</td>
            <td>
                ${badge}
                <select class="select-codigo-empresa" data-index="${index}">
                    <option value="">Selecionar…</option>
                    ${opcoes}
                </select>
            </td>
        </tr>`;
}

function atualizarBotaoGerar() {
    const todosResolvidos = state.grupos.length > 0 && state.grupos.every(g => !!g.codigo_empresa);
    document.getElementById('btnGerarPdfs').disabled = !todosResolvidos;
}

function renderizarTabelaEmpresas() {
    const corpo = document.getElementById('tabelaEmpresasBody');
    corpo.innerHTML = state.grupos.map((g, i) => renderizarLinhaGrupo(g, i)).join('');

    corpo.querySelectorAll('.select-codigo-empresa').forEach(select => {
        select.addEventListener('change', (ev) => {
            const idx = Number(ev.target.dataset.index);
            state.grupos[idx].codigo_empresa = ev.target.value || null;
            renderizarTabelaEmpresas();
            atualizarBotaoGerar();
        });
    });

    atualizarBotaoGerar();
}

// ──────────────────────────────────────────────
// PASSO 1 — UPLOAD
// ──────────────────────────────────────────────
document.getElementById('inputPdf').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    document.getElementById('nomeArquivoSelecionado').style.display = 'inline-block';
    document.getElementById('nomeArquivoSelecionado').textContent = file.name;
    document.getElementById('btnProcessar').disabled = false;
    state._arquivoSelecionado = file;
});

document.getElementById('dropzone').addEventListener('dragover', (ev) => {
    ev.preventDefault();
    document.getElementById('dropzone').classList.add('drag-over');
});
document.getElementById('dropzone').addEventListener('dragleave', () => {
    document.getElementById('dropzone').classList.remove('drag-over');
});
document.getElementById('dropzone').addEventListener('drop', (ev) => {
    ev.preventDefault();
    document.getElementById('dropzone').classList.remove('drag-over');
    const file = ev.dataTransfer.files[0];
    if (file) {
        document.getElementById('inputPdf').files = ev.dataTransfer.files;
        document.getElementById('inputPdf').dispatchEvent(new Event('change'));
    }
});

document.getElementById('btnProcessar').addEventListener('click', async () => {
    const file = state._arquivoSelecionado;
    const intervalo = document.getElementById('inputIntervalo').value.trim();
    if (!file || !intervalo) { alert('Selecione um PDF e informe o intervalo.'); return; }

    const botao = document.getElementById('btnProcessar');
    botao.disabled = true;
    botao.textContent = 'Processando…';

    try {
        const buffer = await file.arrayBuffer();
        state.pdfBytesOriginal = new Uint8Array(buffer.slice(0));
        state.intervalo = intervalo;

        state.empresasCache = await carregarEmpresas();
        const mapaCnpj = construirMapaCnpj(state.empresasCache);

        const { grupos, avisos, totalPaginas } = await parsearPdfAvisoFerias(buffer);
        grupos.forEach(g => {
            const resolvido = _resolverCodigoEmpresa(g.cnpj, mapaCnpj);
            g.codigo_empresa = resolvido ? resolvido.codigo_empresa : null;
        });
        state.grupos = grupos;

        const paginasAgrupadas = grupos.reduce((soma, g) => soma + g.paginas.length, 0);
        const painelAvisos = document.getElementById('avisosParsing');
        const mensagens = avisos.map(a => a.motivo);
        if (paginasAgrupadas !== totalPaginas) {
            mensagens.push(`Total de páginas do PDF (${totalPaginas}) difere do total agrupado (${paginasAgrupadas}) — revise antes de gerar.`);
        }
        if (mensagens.length > 0) {
            painelAvisos.style.display = 'block';
            painelAvisos.innerHTML = '⚠️ ' + mensagens.join('<br>⚠️ ');
        } else {
            painelAvisos.style.display = 'none';
        }

        renderizarTabelaEmpresas();
        irParaStep(2);
    } finally {
        botao.disabled = false;
        botao.textContent = 'Processar PDF';
    }
});

document.getElementById('btnVoltarStep1').addEventListener('click', () => irParaStep(1));

// ──────────────────────────────────────────────
// GERAÇÃO DOS PDFs (PASSO 3) — pdf-lib
// ──────────────────────────────────────────────
const A4_LARGURA = 595.28;
const A4_ALTURA = 841.89;
const FAIXA_CABECALHO = 50;
const FAIXA_RODAPE = 24;

const COR_SECUNDARIA = PDFLib.rgb(0x2C / 255, 0x3E / 255, 0x50 / 255);
const COR_PRIMARIA = PDFLib.rgb(0x8B / 255, 0x3A / 255, 0x3A / 255);
const COR_BRANCA = PDFLib.rgb(1, 1, 1);

let _logoScontPngBytesCache = null;
async function obterLogoScontBytes() {
    if (_logoScontPngBytesCache !== null) return _logoScontPngBytesCache;
    try {
        const resp = await fetch('https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png');
        if (!resp.ok) throw new Error('fetch falhou');
        _logoScontPngBytesCache = new Uint8Array(await resp.arrayBuffer());
    } catch (e) {
        console.warn('Não foi possível baixar o logo SCONT, usando texto no cabeçalho:', e);
        _logoScontPngBytesCache = false;
    }
    return _logoScontPngBytesCache;
}

async function gerarPdfEmpresa(grupo, pdfOriginalDoc, logoBytes) {
    const novoDoc = await PDFLib.PDFDocument.create();
    const fontBold = await novoDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontRegular = await novoDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const logoEmbutido = logoBytes ? await novoDoc.embedPng(logoBytes) : null;

    const paginasOrigemTodas = pdfOriginalDoc.getPages();
    const paginasOriginais = await Promise.all(
        grupo.paginas.map(n => novoDoc.embedPage(paginasOrigemTodas[n - 1]))
    );

    const totalPaginas = paginasOriginais.length;
    for (let idx = 0; idx < totalPaginas; idx++) {
        const embutida = paginasOriginais[idx];
        const pagina = novoDoc.addPage([A4_LARGURA, A4_ALTURA]);

        const alturaDisponivel = A4_ALTURA - FAIXA_CABECALHO - FAIXA_RODAPE;
        const escala = Math.min(alturaDisponivel / embutida.height, A4_LARGURA / embutida.width);
        const larguraFinal = embutida.width * escala;
        const alturaFinal = embutida.height * escala;
        const offsetX = (A4_LARGURA - larguraFinal) / 2;
        const offsetY = FAIXA_RODAPE + (alturaDisponivel - alturaFinal) / 2;

        pagina.drawPage(embutida, { x: offsetX, y: offsetY, width: larguraFinal, height: alturaFinal });

        // Faixa de cabeçalho
        pagina.drawRectangle({ x: 0, y: A4_ALTURA - FAIXA_CABECALHO, width: A4_LARGURA, height: FAIXA_CABECALHO, color: COR_SECUNDARIA });
        let cursorX = 16;
        if (logoEmbutido) {
            const alturaLogo = 28;
            const larguraLogo = (logoEmbutido.width / logoEmbutido.height) * alturaLogo;
            pagina.drawImage(logoEmbutido, { x: cursorX, y: A4_ALTURA - FAIXA_CABECALHO / 2 - alturaLogo / 2, width: larguraLogo, height: alturaLogo });
            cursorX += larguraLogo + 12;
        } else {
            pagina.drawText('SCONT', { x: cursorX, y: A4_ALTURA - 32, size: 16, font: fontBold, color: COR_BRANCA });
            cursorX += 70;
        }
        const tituloDireita = `${grupo.codigo_empresa} · ${grupo.nome_empresa || ''}`;
        pagina.drawText(tituloDireita, { x: cursorX, y: A4_ALTURA - 24, size: 10, font: fontBold, color: COR_BRANCA });
        pagina.drawText('Aviso de Férias', { x: cursorX, y: A4_ALTURA - 38, size: 8, font: fontRegular, color: COR_BRANCA });

        // Faixa de rodapé
        pagina.drawRectangle({ x: 0, y: 0, width: A4_LARGURA, height: FAIXA_RODAPE, color: COR_PRIMARIA });
        pagina.drawText(`SCONT · Fechamento de Folha · Intervalo: ${state.intervalo}`, { x: 12, y: 8, size: 8, font: fontRegular, color: COR_BRANCA });
        const textoPagina = `Página ${idx + 1} de ${totalPaginas}`;
        const larguraTexto = fontRegular.widthOfTextAtSize(textoPagina, 8);
        pagina.drawText(textoPagina, { x: A4_LARGURA - larguraTexto - 12, y: 8, size: 8, font: fontRegular, color: COR_BRANCA });
    }

    return novoDoc.save();
}

async function gerarTodosPdfs() {
    const pdfOriginalDoc = await PDFLib.PDFDocument.load(state.pdfBytesOriginal);
    const logoBytes = await obterLogoScontBytes(); // Uint8Array ou false

    const gerados = [];
    for (const grupo of state.grupos) {
        const bytes = await gerarPdfEmpresa(grupo, pdfOriginalDoc, logoBytes || null);
        gerados.push({ nomeArquivo: _montarNomeArquivo(grupo.codigo_empresa, state.intervalo), bytes });
    }
    return gerados;
}

function baixarBlob(bytes, nomeArquivo) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function renderizarResultadoGeracao(gerados) {
    const container = document.getElementById('resultadoGeracao');
    container.innerHTML = gerados.map((g, i) => `
        <div class="cartao-empresa-gerada">
            <div>
                <strong>${g.nomeArquivo}</strong><br>
                <span style="font-size:12px;color:var(--text-secondary)">${state.grupos[i].empregados.length} empregado(s)</span>
            </div>
            <button class="btn btn-secondary btn-small" data-index="${i}">⬇️ Baixar</button>
        </div>
    `).join('');

    container.querySelectorAll('button[data-index]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const idx = Number(ev.currentTarget.dataset.index);
            baixarBlob(gerados[idx].bytes, gerados[idx].nomeArquivo);
        });
    });
}

document.getElementById('btnGerarPdfs').addEventListener('click', async () => {
    const botao = document.getElementById('btnGerarPdfs');
    botao.disabled = true;
    botao.textContent = 'Gerando…';
    try {
        const gerados = await gerarTodosPdfs();
        state.arquivosGerados = gerados;
        renderizarResultadoGeracao(gerados);
        irParaStep(3);
    } catch (e) {
        console.error('Erro ao gerar PDFs:', e);
        alert('Erro ao gerar os PDFs: ' + e.message);
    } finally {
        botao.disabled = false;
        botao.textContent = 'Gerar PDFs';
    }
});

document.getElementById('btnBaixarZip').addEventListener('click', async () => {
    const zip = new JSZip();
    (state.arquivosGerados || []).forEach(g => zip.file(g.nomeArquivo, g.bytes));
    const conteudo = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(conteudo);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AVISO DE FERIAS_${_sanitizarNomeArquivo(state.intervalo)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

document.getElementById('btnNovoLote').addEventListener('click', () => {
    location.reload();
});
