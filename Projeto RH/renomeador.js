/**
 * SCONT - Renomeador em Lote (Upload + ZIP Duplo Destino)
 * Arquivo: renomeador.js
 */

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via renomeador.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let regrasCadastradas = [];
let empresasCadastradas = {};
let mapeamentosCadastrados = {};
let arquivosCarregados = []; 
let arquivosAnalisados = []; 

document.addEventListener('DOMContentLoaded', async () => {
    // Formatação do input de competência
    document.getElementById('renCompetencia').addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
        e.target.value = v;
    });

    configurarDragAndDrop();
    await carregarDadosBase();
});

function mostrarMensagem(titulo, mensagem) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent = mensagem;
    document.getElementById('messageModal').classList.add('active');
}

function fecharModalMensagem() { 
    document.getElementById('messageModal').classList.remove('active'); 
}

// --- CARREGAMENTO DE DADOS (SUPABASE) ---

async function carregarDadosBase() {
    try {
        const { data: regras } = await supabaseClient.from('rh_regras_renomeacao').select('*');
        regrasCadastradas = regras || [];

        const { data: empresas } = await supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa');
        (empresas || []).forEach(emp => {
            empresasCadastradas[emp.codigo_empresa] = emp.nome_empresa;
        });

        const { data: mapeamentos } = await supabaseClient.from('rh_mapeamento_nomes').select('nome_arquivo, nome_documento');
        (mapeamentos || []).forEach(map => {
            mapeamentosCadastrados[map.nome_arquivo] = map.nome_documento;
        });

    } catch (erro) {
        console.error("Erro ao carregar dados base:", erro);
        mostrarMensagem('Erro', 'Falha ao carregar regras, empresas e mapeamentos do banco de dados.');
    }
}

// --- UPLOAD DE ARQUIVOS ---

function configurarDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            adicionarArquivos(e.dataTransfer.files);
        }
    });
}

function handleFileSelect(event) {
    if (event.target.files.length > 0) {
        adicionarArquivos(event.target.files);
    }
}

function adicionarArquivos(files) {
    const novosArquivos = Array.from(files);
    arquivosCarregados = [...arquivosCarregados, ...novosArquivos];
    
    document.getElementById('fileCount').textContent = arquivosCarregados.length;
    document.getElementById('fileCountInfo').style.display = 'block';
    document.getElementById('btnAnalisar').disabled = false;
    document.getElementById('step3').style.display = 'none';
}

// --- MOTOR DE REGEX E ANÁLISE ---

function criarRegexDoPadrao(padraoDe) {
    let regexStr = padraoDe.replace(/[.*+?^$()|[\]\]/g, '\$&');
    regexStr = regexStr.replace(/{CODIGO_EMPRESA}/g, '(?<codigo>\d+)');
    regexStr = regexStr.replace(/{NOME_ARQUIVO}/g, '(?<nome>.+?)');
    regexStr = regexStr.replace(/{MM}/g, '(?<mes>\d{2})');
    regexStr = regexStr.replace(/{AAAA}/g, '(?<ano>\d{4})');
    regexStr = regexStr.replace(/{IGNORAR}/g, '.*?');
    return new RegExp('^' + regexStr + '$', 'i');
}

function analisarArquivos() {
    const competencia = document.getElementById('renCompetencia').value;
    const caminhoExpressRaw = document.getElementById('caminhoExpress').value.trim();
    const caminhoDinamicoRaw = document.getElementById('caminhoDinamico').value.trim();

    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(competencia)) { mostrarMensagem('Erro', 'Informe uma competência válida (MM/AAAA).'); return; }
    if (!caminhoExpressRaw) { mostrarMensagem('Erro', 'Informe o caminho lógico da pasta EXPRESS.'); return; }
    if (!caminhoDinamicoRaw) { mostrarMensagem('Erro', 'Informe o caminho Dinâmico.'); return; }
    if (arquivosCarregados.length === 0) { mostrarMensagem('Erro', 'Faça o upload de pelo menos um arquivo.'); return; }
    if (regrasCadastradas.length === 0) { mostrarMensagem('Erro', 'Nenhuma regra de renomeação cadastrada no sistema.'); return; }

    const [mesComp, anoComp] = competencia.split('/');
    
    arquivosAnalisados = [];
    let temErros = false;
    let temSucesso = false;

    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = '';
    document.getElementById('step3').style.display = 'block';

    arquivosCarregados.forEach(file => {
        const nomeOriginal = file.name;
        const lastDotIndex = nomeOriginal.lastIndexOf('.');
        const nomeSemExt = lastDotIndex !== -1 ? nomeOriginal.substring(0, lastDotIndex) : nomeOriginal;
        const extensao = lastDotIndex !== -1 ? nomeOriginal.substring(lastDotIndex) : '';

        let regraAplicada = null;
        let matchResult = null;

        for (const regra of regrasCadastradas) {
            const regex = criarRegexDoPadrao(regra.padrao_de);
            const match = nomeSemExt.match(regex);
            if (match) {
                regraAplicada = regra;
                matchResult = match.groups;
                break;
            }
        }

        let status = '';
        let classeStatus = '';
        let novoNomeFinal = '';
        let caminhoRelativoDinamico = '';
        let exibicaoExpress = '';
        let exibicaoDinamico = '';

        if (!regraAplicada) {
            status = 'Padrão não reconhecido';
            classeStatus = 'status-error';
            temErros = true;
        } else {
            const codigoExtraido = matchResult.codigo;
            const nomeArqExtraido = matchResult.nome || '';
            const nomeEmpresa = empresasCadastradas[codigoExtraido];
            const nomeDocumentoMapeado = mapeamentosCadastrados[nomeArqExtraido] || nomeArqExtraido;
            
            if (!nomeEmpresa) {
                status = `Empresa ${codigoExtraido} não encontrada`;
                classeStatus = 'status-warning';
                temErros = true;
            } else {
                // 1. Construir Novo Nome
                let novoNomeBase = regraAplicada.padrao_para;
                novoNomeBase = novoNomeBase.replace(/{CODIGO_EMPRESA}/g, codigoExtraido);
                novoNomeBase = novoNomeBase.replace(/{NOME_EMPRESA}/g, nomeEmpresa);
                novoNomeBase = novoNomeBase.replace(/{NOME_ARQUIVO}/g, nomeArqExtraido);
                novoNomeBase = novoNomeBase.replace(/{NOME_DOCUMENTO}/g, nomeDocumentoMapeado);
                novoNomeBase = novoNomeBase.replace(/{MM}/g, mesComp);
                novoNomeBase = novoNomeBase.replace(/{AAAA}/g, anoComp);
                novoNomeFinal = novoNomeBase + extensao;

                // 2. Construir Caminho Dinâmico (Relativo para o ZIP)
                caminhoRelativoDinamico = caminhoDinamicoRaw;
                caminhoRelativoDinamico = caminhoRelativoDinamico.replace(/{CODIGO_EMPRESA}/g, codigoExtraido);
                caminhoRelativoDinamico = caminhoRelativoDinamico.replace(/{NOME_EMPRESA}/g, nomeEmpresa);
                caminhoRelativoDinamico = caminhoRelativoDinamico.replace(/{MM}/g, mesComp);
                caminhoRelativoDinamico = caminhoRelativoDinamico.replace(/{AAAA}/g, anoComp);
                
                // Normaliza barras para o ZIP (sempre usar / internamente no ZIP)
                caminhoRelativoDinamico = caminhoRelativoDinamico.replace(/\/g, '/').replace(/^\/+|\/+$/g, '');

                // 3. Caminhos Absolutos apenas para exibição visual na tabela
                const separador = '\';
                const raizExpressLimpa = caminhoExpressRaw.replace(/[\/]+$/, '');
                
                exibicaoExpress = `${raizExpressLimpa}${separador}${novoNomeFinal}`;
                exibicaoDinamico = `${caminhoRelativoDinamico.replace(/\//g, separador)}${separador}${novoNomeFinal}`;

                status = 'Pronto';
                classeStatus = 'status-ok';
                temSucesso = true;
            }
        }

        arquivosAnalisados.push({
            arquivoOriginal: file,
            nomeOriginal: nomeOriginal,
            novoNome: novoNomeFinal,
            caminhoRelativoDinamico: caminhoRelativoDinamico,
            status: status,
            classeStatus: classeStatus,
            podeProcessar: classeStatus === 'status-ok'
        });

        // Adiciona linha na tabela
        tbody.innerHTML += `
            <tr>
                <td>${nomeOriginal}</td>
                <td style="font-weight: bold; color: #2C3E50;">${novoNomeFinal || '-'}</td>
                <td style="font-family: monospace; color: #8B3A3A;">${exibicaoExpress || '-'}</td>
                <td style="font-family: monospace; color: #2980B9;">${exibicaoDinamico || '-'}</td>
                <td><span class="status-badge ${classeStatus}">${status}</span></td>
            </tr>
        `;
    });

    document.getElementById('avisoErros').style.display = temErros ? 'block' : 'none';
    document.getElementById('btnGerarZip').style.display = temSucesso ? 'inline-flex' : 'none';
}

// --- GERAÇÃO DO ARQUIVO ZIP DUPLO ---

async function gerarZip() {
    const arquivosParaProcessar = arquivosAnalisados.filter(a => a.podeProcessar);
    if (arquivosParaProcessar.length === 0) return;

    const btn = document.getElementById('btnGerarZip');
    btn.innerHTML = '⏳ Compactando arquivos...';
    btn.disabled = true;

    try {
        const zip = new JSZip();

        // Cria as duas pastas principais dentro do ZIP
        const pastaExpress = zip.folder("1_COPIAR_PARA_EXPRESS");
        const pastaDinamico = zip.folder("2_COPIAR_PARA_DINAMICO");

        // Adiciona um arquivo de instruções para o usuário
        const caminhoExpressRaw = document.getElementById('caminhoExpress').value.trim();
        const instrucoes = `INSTRUÇÕES DE USO:
        
1. Abra a pasta "1_COPIAR_PARA_EXPRESS" e copie todos os arquivos lá dentro.
2. Cole esses arquivos no seu caminho EXPRESS: ${caminhoExpressRaw}

3. Abra a pasta "2_COPIAR_PARA_DINAMICO" e copie as pastas que estão lá dentro.
4. Cole essas pastas na raiz do seu diretório dinâmico.`;
        
        zip.file("LEIA-ME_INSTRUCOES.txt", instrucoes);

        // Adiciona os arquivos nas respectivas pastas
        for (const arq of arquivosParaProcessar) {
            // Cópia 1: Solto na pasta EXPRESS
            pastaExpress.file(arq.novoNome, arq.arquivoOriginal);
            
            // Cópia 2: Dentro da estrutura de pastas na pasta DINAMICO
            const caminhoCompletoDinamico = `${arq.caminhoRelativoDinamico}/${arq.novoNome}`;
            pastaDinamico.file(caminhoCompletoDinamico, arq.arquivoOriginal);
        }

        // Gera o arquivo ZIP
        const content = await zip.generateAsync({ type: "blob" });
        
        // Cria o link de download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        
        const comp = document.getElementById('renCompetencia').value.replace('/', '-');
        a.download = `Arquivos_Renomeados_${comp}.zip`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        mostrarMensagem('Sucesso', 'Arquivo ZIP gerado com sucesso!\n\nAbra o arquivo baixado e leia o arquivo "LEIA-ME_INSTRUCOES.txt" para saber onde colar cada pasta.');

    } catch (erro) {
        console.error("Erro ao gerar ZIP:", erro);
        mostrarMensagem('Erro', 'Ocorreu um erro ao compactar os arquivos.');
    } finally {
        btn.innerHTML = '📦 Gerar e Baixar Arquivo .ZIP';
        btn.disabled = false;
    }
}