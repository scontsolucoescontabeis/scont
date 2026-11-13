/**
 * SCONT — Renomeador Electron
 * renderer.js — sem acesso a Node.js; toda I/O passa por window.electronAPI
 */

let regrasCadastradas      = [];
let empresasLista          = [];
let tagsCadastradas        = [];
let motor                  = null;
let mapeamentosCadastrados = {};
let arquivosCarregados     = [];
let arquivosAnalisados     = [];

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginSenha').addEventListener('keydown', e => {
        if (e.key === 'Enter') fazerLogin();
    });
    document.getElementById('renCompetencia').addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
        e.target.value = v;
    });
    configurarDragAndDrop();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const erroEl = document.getElementById('loginErro');
    const btn    = document.getElementById('btnLogin');

    erroEl.style.display = 'none';
    btn.textContent = 'Entrando...';
    btn.disabled = true;

    try {
        const user = await window.electronAPI.login(email, senha);

        document.getElementById('userLabel').textContent = user.email;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display   = 'block';

        await carregarDadosBase();
    } catch (e) {
        erroEl.textContent   = 'Erro: ' + e.message;
        erroEl.style.display = 'block';
    } finally {
        btn.textContent = 'Entrar';
        btn.disabled    = false;
    }
}

async function fazerLogout() {
    await window.electronAPI.logout();
    document.getElementById('appScreen').style.display  = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    arquivosCarregados = [];
    arquivosAnalisados = [];
    document.getElementById('step3').style.display          = 'none';
    document.getElementById('fileCountInfo').style.display  = 'none';
    document.getElementById('btnAnalisar').disabled         = true;
}

// ── DADOS BASE ────────────────────────────────────────────────────────────────

async function carregarDadosBase() {
    try {
        // Tags: se a tabela não existir/estiver vazia ou falhar, o motor usa o conjunto embutido.
        const [regras, empresas, mapeamentos, tags] = await Promise.all([
            window.electronAPI.carregarRegras(),
            window.electronAPI.carregarEmpresas(),
            window.electronAPI.carregarMapeamentos(),
            window.electronAPI.carregarTags().catch(() => []),
        ]);

        regrasCadastradas = regras;
        empresasLista = empresas;
        tagsCadastradas = tags;
        mapeamentosCadastrados = {};
        mapeamentos.forEach(m => { mapeamentosCadastrados[m.nome_arquivo] = m.nome_documento; });
        motor = RenomeadorEngine.criarMotor({ tags: tagsCadastradas, empresas: empresasLista, mapeamentos: mapeamentosCadastrados });
    } catch (e) {
        mostrarMensagem('Erro', 'Falha ao carregar dados do servidor:\n' + e.message);
    }
}

// ── BROWSE DE PASTA ───────────────────────────────────────────────────────────

async function browsePasta(inputId, manterTokens = false) {
    const pasta = await window.electronAPI.escolherPasta();
    if (!pasta) return;
    const input = document.getElementById(inputId);
    if (manterTokens) {
        const sufixo = input.value.match(/(\{[^}]+\}[^{]*)+$/)?.[0] || '{NOME_EMPRESA}\\{AAAA}\\{MM}';
        input.value = pasta + '\\' + sufixo;
    } else {
        input.value = pasta;
    }
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────

function configurarDragAndDrop() {
    const area = document.getElementById('uploadArea');
    area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) adicionarArquivos(e.dataTransfer.files);
    });
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) adicionarArquivos(e.target.files);
}

function adicionarArquivos(files) {
    arquivosCarregados = [...arquivosCarregados, ...Array.from(files)];
    document.getElementById('fileCount').textContent        = arquivosCarregados.length;
    document.getElementById('fileCountInfo').style.display  = 'block';
    document.getElementById('btnAnalisar').disabled         = false;
    document.getElementById('step3').style.display          = 'none';
}

// ── ANÁLISE ───────────────────────────────────────────────────────────────────

function analisarArquivos() {
    const competencia        = document.getElementById('renCompetencia').value;
    const caminhoExpressRaw  = document.getElementById('caminhoExpress').value.trim();
    const caminhoDinamicoRaw = document.getElementById('caminhoDinamico').value.trim();

    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(competencia)) { mostrarMensagem('Erro', 'Informe uma competência válida (MM/AAAA).'); return; }
    if (!caminhoExpressRaw)              { mostrarMensagem('Erro', 'Informe o caminho EXPRESS.'); return; }
    if (!caminhoDinamicoRaw)             { mostrarMensagem('Erro', 'Informe o Caminho Dinâmico.'); return; }
    if (arquivosCarregados.length === 0) { mostrarMensagem('Erro', 'Faça o upload de pelo menos um arquivo.'); return; }
    if (regrasCadastradas.length === 0)  { mostrarMensagem('Erro', 'Nenhuma regra cadastrada. Verifique a conexão.'); return; }

    const [mesComp, anoComp] = competencia.split('/');
    arquivosAnalisados = [];
    let temErros = false, temSucesso = false;

    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = '';
    document.getElementById('step3').style.display = 'block';

    if (!motor) motor = RenomeadorEngine.criarMotor({ empresas: empresasLista, mapeamentos: mapeamentosCadastrados });

    arquivosCarregados.forEach(file => {
        const nomeOriginal = file.name;
        const lastDot      = nomeOriginal.lastIndexOf('.');
        const nomeSemExt   = lastDot !== -1 ? nomeOriginal.substring(0, lastDot) : nomeOriginal;
        const extensao     = lastDot !== -1 ? nomeOriginal.substring(lastDot)    : '';

        let status, classeStatus, novoNomeFinal = '', pathExpress = '', pathDinamico = '';

        const resultado = motor.processar(nomeSemExt, regrasCadastradas, { mes: mesComp, ano: anoComp }, caminhoDinamicoRaw);

        if (resultado.reconhecido === false) {
            status = 'Padrão não reconhecido'; classeStatus = 'status-error'; temErros = true;
        } else if (resultado.erro) {
            status = resultado.erro; classeStatus = 'status-warning'; temErros = true;
        } else {
            novoNomeFinal = resultado.novoNomeBase + extensao;
            pathExpress   = caminhoExpressRaw.replace(/[\/\\]+$/, '');
            pathDinamico  = resultado.caminhoDinamico.replace(/[\/\\]+$/, '');
            status = 'Pronto'; classeStatus = 'status-ok'; temSucesso = true;
        }

        arquivosAnalisados.push({
            arquivoOriginal: file, nomeOriginal, novoNome: novoNomeFinal,
            pathExpress, pathDinamico, status, classeStatus,
            podeProcessar: classeStatus === 'status-ok',
        });

        tbody.innerHTML += `
            <tr>
                <td>${nomeOriginal}</td>
                <td style="font-weight:bold;">${novoNomeFinal || '—'}</td>
                <td style="font-family:monospace;color:#8B3A3A;font-size:11px;">${pathExpress  ? pathExpress  + '\\' + novoNomeFinal : '—'}</td>
                <td style="font-family:monospace;color:#2980B9;font-size:11px;">${pathDinamico ? pathDinamico + '\\' + novoNomeFinal : '—'}</td>
                <td><span class="status-badge ${classeStatus}">${status}</span></td>
            </tr>`;
    });

    document.getElementById('avisoErros').style.display = temErros   ? 'block'        : 'none';
    document.getElementById('btnSalvar').style.display  = temSucesso ? 'inline-flex'  : 'none';
}

// ── SALVAR (IPC → main.js → Node.js fs) ──────────────────────────────────────

async function salvarNosDestinos() {
    const paraProcessar = arquivosAnalisados.filter(a => a.podeProcessar);
    if (paraProcessar.length === 0) return;

    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;
    btn.innerHTML = '⏳ Salvando arquivos...';

    try {
        const payload = await Promise.all(paraProcessar.map(async arq => {
            const buf  = await arq.arquivoOriginal.arrayBuffer();
            const u8   = new Uint8Array(buf);
            // Converte para base64 em chunks para evitar stack overflow em arquivos grandes
            let b64 = '';
            const chunkSize = 8192;
            for (let i = 0; i < u8.length; i += chunkSize) {
                b64 += String.fromCharCode(...u8.subarray(i, i + chunkSize));
            }
            return {
                novoNome:     arq.novoNome,
                bufferBase64: btoa(b64),
                pathExpress:  arq.pathExpress,
                pathDinamico: arq.pathDinamico,
            };
        }));

        const { salvos, erros } = await window.electronAPI.salvarArquivos(payload);

        let msg = `${salvos} arquivo(s) salvo(s) com sucesso.`;
        if (erros.length > 0) msg += `\n\nErros:\n${erros.join('\n')}`;
        mostrarMensagem(erros.length === 0 ? '✅ Concluído' : '⚠️ Concluído com avisos', msg);
    } catch (e) {
        mostrarMensagem('Erro', 'Falha ao salvar: ' + e.message);
    } finally {
        btn.innerHTML = '💾 Salvar nos Destinos';
        btn.disabled  = false;
    }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────

function mostrarMensagem(titulo, mensagem) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent  = mensagem;
    document.getElementById('messageModal').classList.add('active');
}

function fecharModalMensagem() {
    document.getElementById('messageModal').classList.remove('active');
}
