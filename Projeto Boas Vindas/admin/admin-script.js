// ===== CONFIGURAÇÃO =====
const API_URL = 'http://localhost:5000/api';

// ===== VARIÁVEIS GLOBAIS =====
let apresentacaoAtual = null;
let cnaePrincipalSelecionado = null;
let cnaesSecundariosSelecionados = [];
let todosCNAEs = [];
let modalCNAETipo = 'principal';
let cnaesListaCompleta = [];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    // Navegação entre seções
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            mudarSecao(section);
        });
    });

    // Formulário de criação
    const formCriar = document.getElementById('formCriarApresentacao');
    if (formCriar) {
        formCriar.addEventListener('submit', function(e) {
            e.preventDefault();
            criarApresentacao();
        });
    }

    // Carregar histórico
    carregarHistorico();

    // Carregar configurações
    carregarConfiguracoes();

    // Formulário de configurações
    const formConfig = document.getElementById('formConfiguracoes');
    if (formConfig) {
        formConfig.addEventListener('submit', function(e) {
            e.preventDefault();
            salvarConfiguracoes();
        });
    }
});

// ===== NAVEGAÇÃO ENTRE SEÇÕES =====
function mudarSecao(secao) {
    // Remover ativo de todos
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    // Adicionar ativo à seção selecionada
    const sectionElement = document.getElementById(secao);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    const navElement = document.querySelector(`[data-section="${secao}"]`);
    if (navElement) {
        navElement.classList.add('active');
    }
}

// ===== CRIAR APRESENTAÇÃO =====
async function criarApresentacao() {
    const form = document.getElementById('formCriarApresentacao');
    const btnSubmit = form.querySelector('button[type="submit"]');
    
    // ===== VALIDAÇÃO: CNAE PRINCIPAL É OBRIGATÓRIO =====
    if (!cnaePrincipalSelecionado) {
        alert('❌ Selecione um CNAE Principal obrigatoriamente');
        return;
    }
    
    // ===== PROTEÇÃO CONTRA MÚLTIPLOS CLIQUES =====
    if (btnSubmit.disabled) {
        return;
    }
    
    // Desabilitar botão
    btnSubmit.disabled = true;
    const textoBotaoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    
    const formData = new FormData(form);

    console.log('Dados do formulário:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }

    const dados = {
        razaoSocial: formData.get('razaoSocial'),
        cnpj: formData.get('cnpj'),
        inscricao: formData.get('inscricao'),
        regime: formData.get('regime'),
        porte: formData.get('porte'),
        ramo: formData.get('ramo'),
        nomeContato: formData.get('nomeContato'),
        emailCliente: formData.get('emailCliente'),
        telefone: formData.get('telefone'),
        cargo: formData.get('cargo'),
        mensagem: formData.get('mensagem'),
        cnaePrincipal: cnaePrincipalSelecionado.codigo,
        cnaesSecundarios: cnaesSecundariosSelecionados.map(c => c.codigo),
        enviarEmail: form.enviarEmail?.checked || false,
        enviarWhatsApp: form.enviarWhatsApp?.checked || false
    };

    console.log('Dados a enviar:', dados);

    try {
        const response = await fetch(`${API_URL}/criar-apresentacao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        console.log('Resposta da API:', resultado);

        if (resultado.sucesso) {
            apresentacaoAtual = resultado;
            exibirResultado(resultado);

            // Mostrar status de notificações
            if (resultado.notificacoes) {
                exibirStatusNotificacoes(resultado.notificacoes);
            }
            
            // ===== SUCESSO: Reabilitar botão após 3 segundos =====
            setTimeout(() => {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = textoBotaoOriginal;
            }, 3000);

            // Recarregar histórico
            carregarHistorico();
        } else {
            alert('❌ Erro: ' + resultado.mensagem);
            
            // ===== ERRO: Reabilitar botão imediatamente =====
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = textoBotaoOriginal;
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao criar apresentação: ' + error.message);
        
        // ===== ERRO: Reabilitar botão imediatamente =====
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = textoBotaoOriginal;
    }
}

// ===== EXIBIR RESULTADO =====
function exibirResultado(data) {
    const resultado = document.getElementById('resultado');
    if (!resultado) return;
    
    document.getElementById('resultadoCliente').textContent = data.nome_contato || 'N/A';
    document.getElementById('resultadoEmpresa').textContent = data.razao_social || 'N/A';
    document.getElementById('resultadoData').textContent = new Date().toLocaleDateString('pt-BR');
    
    const linkUnico = document.getElementById('linkUnico');
    if (linkUnico) {
        linkUnico.value = `${API_URL.replace('/api', '')}/index.html?id=${data.id}`;
    }
    
    const btnVisualizar = document.getElementById('btnVisualizarApresentacao');
    if (btnVisualizar) {
        btnVisualizar.href = `${API_URL.replace('/api', '')}/index.html?id=${data.id}`;
    }

    resultado.style.display = 'block';
    resultado.scrollIntoView({ behavior: 'smooth' });
}

// ===== EXIBIR STATUS DE NOTIFICAÇÕES =====
function exibirStatusNotificacoes(notificacoes) {
    let statusHTML = '<div class="notificacoes-status">';
    
    if (notificacoes.email) {
        const status = notificacoes.email.sucesso ? '✓' : '✗';
        const classe = notificacoes.email.sucesso ? 'sucesso' : 'erro';
        statusHTML += `<p class="${classe}"><i class="fas fa-envelope"></i> Email: ${status} ${notificacoes.email.mensagem}</p>`;
    }
    
    if (notificacoes.whatsapp) {
        const status = notificacoes.whatsapp.sucesso ? '✓' : '✗';
        const classe = notificacoes.whatsapp.sucesso ? 'sucesso' : 'erro';
        statusHTML += `<p class="${classe}"><i class="fas fa-whatsapp"></i> WhatsApp: ${status} ${notificacoes.whatsapp.mensagem}</p>`;
    }
    
    statusHTML += '</div>';
    
    const statusDiv = document.getElementById('statusNotificacoes');
    if (statusDiv) {
        statusDiv.innerHTML = statusHTML;
    }
}

// ===== COPIAR LINK =====
function copiarLink() {
    const link = document.getElementById('linkUnico');
    if (!link) return;
    
    link.select();
    document.execCommand('copy');
    alert('✓ Link copiado para a área de transferência!');
}

// ===== ENVIAR EMAIL MANUAL =====
function enviarEmailManual() {
    if (!apresentacaoAtual) return;

    const emailConfirmacao = document.getElementById('emailConfirmacao');
    if (emailConfirmacao) {
        emailConfirmacao.textContent = apresentacaoAtual.email_cliente;
    }
    
    const modal = document.getElementById('modalConfirmacao');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// ===== CONFIRMAR ENVIO =====
async function confirmarEnvio() {
    if (!apresentacaoAtual) return;

    try {
        const response = await fetch(`${API_URL}/reenviar-notificacoes/${apresentacaoAtual.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: true,
                whatsapp: false
            })
        });

        const resultado = await response.json();

        if (resultado.sucesso) {
            alert('✓ Email reenviado com sucesso!');
            fecharModal();
        } else {
            alert('❌ Erro: ' + resultado.mensagem);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao reenviar email');
    }
}

// ===== FECHAR MODAL =====
function fecharModal() {
    const modal = document.getElementById('modalConfirmacao');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== NOVA APRESENTAÇÃO =====
function novaApresentacao() {
    const form = document.getElementById('formCriarApresentacao');
    if (form) {
        form.reset();
    }
    
    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.style.display = 'none';
    }
    
    apresentacaoAtual = null;
    
    // Limpar CNAEs
    removerCnaePrincipal();
    cnaesSecundariosSelecionados = [];
    atualizarListaCnaesSecundarios();
}

// ===== CARREGAR HISTÓRICO =====
async function carregarHistorico() {
    try {
        const response = await fetch(`${API_URL}/historico?limite=50`);
        const data = await response.json();

        const tbody = document.getElementById('tabelaHistorico');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (data.sucesso && data.apresentacoes && data.apresentacoes.length > 0) {
            data.apresentacoes.forEach(item => {
                const row = document.createElement('tr');
                const dataFormatada = new Date(item.data_criacao).toLocaleDateString('pt-BR');
                row.innerHTML = `
                    <td>${item.razao_social}</td>
                    <td>${item.nome_contato}</td>
                    <td>${item.email_cliente}</td>
                    <td>${dataFormatada}</td>
                    <td>${item.acessos || 0}</td>
                    <td>
                        <a href="/index.html?id=${item.id}" target="_blank" class="btn btn-info btn-sm">
                            <i class="fas fa-eye"></i> Ver
                        </a>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma apresentação criada ainda</td></tr>';
        }
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// ===== CARREGAR CONFIGURAÇÕES =====
async function carregarConfiguracoes() {
    try {
        const response = await fetch(`${API_URL}/obter-configuracoes`);
        const data = await response.json();

        if (data.sucesso && data.configuracoes) {
            const emailRemetente = document.getElementById('emailRemetente');
            const nomeRemetente = document.getElementById('nomeRemetente');
            const assuntoEmail = document.getElementById('assuntoEmail');
            
            if (emailRemetente) emailRemetente.value = data.configuracoes.email_remetente || '';
            if (nomeRemetente) nomeRemetente.value = data.configuracoes.nome_remetente || '';
            if (assuntoEmail) assuntoEmail.value = data.configuracoes.assunto_email || '';
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

// ===== SALVAR CONFIGURAÇÕES =====
async function salvarConfiguracoes() {
    const form = document.getElementById('formConfiguracoes');
    if (!form) return;
    
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/salvar-configuracoes`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.sucesso) {
            alert('✓ Configurações salvas com sucesso!');
        } else {
            alert('❌ Erro: ' + data.mensagem);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao salvar configurações');
    }
}

// ===== ABRIR MODAL CNAE =====
function abrirModalCNAE(tipo) {
    modalCNAETipo = tipo;
    
    // Carregar CNAEs se não estiverem carregados
    if (window.CNAES_LISTA && window.CNAES_LISTA.length > 0) {
        cnaesListaCompleta = window.CNAES_LISTA;
        exibirTabelaCNAE(cnaesListaCompleta);
    } else {
        console.error('CNAEs não carregados');
        alert('❌ Erro ao carregar CNAEs');
        return;
    }
    
    // Abrir modal
    const modal = document.getElementById('modalCNAE');
    if (modal) {
        modal.classList.add('active');
    }
    
    const filtro = document.getElementById('filtroCNAE');
    if (filtro) {
        filtro.value = '';
        filtro.focus();
    }
    
    // Atualizar título
    const titulo = tipo === 'principal' ? 'Selecionar CNAE Principal' : 'Adicionar CNAE Secundário';
    const headerTitle = document.querySelector('.modal-cnae-header h2');
    if (headerTitle) {
        headerTitle.textContent = titulo;
    }
}

// ===== FECHAR MODAL CNAE =====
function fecharModalCNAE() {
    const modal = document.getElementById('modalCNAE');
    if (modal) {
        modal.classList.remove('active');
    }
    
    const filtro = document.getElementById('filtroCNAE');
    if (filtro) {
        filtro.value = '';
    }
}

// ===== FILTRAR TABELA CNAE =====
function filtrarTabelaCNAE() {
    const filtro = document.getElementById('filtroCNAE');
    if (!filtro) return;
    
    const termo = filtro.value.toLowerCase();
    
    let cnaesFiltratos;
    
    if (!termo || termo.length === 0) {
        cnaesFiltratos = cnaesListaCompleta;
    } else {
        cnaesFiltratos = cnaesListaCompleta.filter(cnae =>
            cnae.codigo.toLowerCase().includes(termo) ||
            cnae.atividade.toLowerCase().includes(termo)
        );
    }
    
    exibirTabelaCNAE(cnaesFiltratos);
}

// ===== EXIBIR TABELA CNAE =====
function exibirTabelaCNAE(cnaes) {
    const tbody = document.getElementById('tabelaCNAECorpo');
    const totalElement = document.getElementById('totalCNAEs');
    
    if (!tbody || !totalElement) return;
    
    totalElement.textContent = cnaes.length;
    
    if (cnaes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum CNAE encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = cnaes.map(cnae => `
        <tr>
            <td><strong>${cnae.codigo}</strong></td>
            <td>${cnae.atividade}</td>
            <td>
                <button 
                    type="button" 
                    class="btn btn-info btn-sm"
                    onclick="selecionarCNAE('${cnae.codigo}', '${cnae.atividade.replace(/'/g, "\'")}')"
                >
                    Selecionar
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== SELECIONAR CNAE =====
function selecionarCNAE(codigo, atividade) {
    if (modalCNAETipo === 'principal') {
        selecionarCnaePrincipal(codigo, atividade);
    } else if (modalCNAETipo === 'secundario') {
        adicionarCnaeSecundario(codigo, atividade);
    }
    
    fecharModalCNAE();
}

// ===== SELECIONAR CNAE PRINCIPAL =====
function selecionarCnaePrincipal(codigo, atividade) {
    cnaePrincipalSelecionado = { codigo, atividade };
    
    // Atualizar display
    const inputPrincipal = document.getElementById('cnaePrincipal');
    if (inputPrincipal) {
        inputPrincipal.value = `${codigo} - ${atividade}`;
    }
    
    const codigoElement = document.getElementById('cnaePrincipalCodigo');
    if (codigoElement) {
        codigoElement.textContent = codigo;
    }
    
    const atividadeElement = document.getElementById('cnaePrincipalAtividade');
    if (atividadeElement) {
        atividadeElement.textContent = atividade;
    }
    
    const infoDisplay = document.getElementById('cnaePrincipalInfo');
    if (infoDisplay) {
        infoDisplay.style.display = 'block';
    }
    
    // Mostrar grupo de secundários
    const grupoSecundarios = document.getElementById('grupoSecundarios');
    if (grupoSecundarios) {
        grupoSecundarios.style.display = 'block';
    }
    
    console.log('✓ CNAE Principal selecionado:', codigo);
}

// ===== REMOVER CNAE PRINCIPAL =====
function removerCnaePrincipal() {
    cnaePrincipalSelecionado = null;
    
    const inputPrincipal = document.getElementById('cnaePrincipal');
    if (inputPrincipal) {
        inputPrincipal.value = '';
    }
    
    const infoDisplay = document.getElementById('cnaePrincipalInfo');
    if (infoDisplay) {
        infoDisplay.style.display = 'none';
    }
    
    // NÃO ocultar grupo de secundários se houver secundários selecionados
    const grupoSecundarios = document.getElementById('grupoSecundarios');
    if (grupoSecundarios) {
        // Só ocultar se não houver secundários
        if (cnaesSecundariosSelecionados.length === 0) {
            grupoSecundarios.style.display = 'none';
        }
        // Se houver secundários, MANTER visível
    }
    
    // NÃO limpar secundários - mantém os dados
    // cnaesSecundariosSelecionados = [];
    // atualizarListaCnaesSecundarios();
    
    console.log('✓ CNAE Principal removido (secundários mantidos)');
}

// ===== ABRIR MODAL PARA ADICIONAR CNAE SECUNDÁRIO =====
function abrirModalAdicionarSecundario() {
    // Abrir modal com tipo 'secundario'
    abrirModalCNAE('secundario');
}

// ===== ADICIONAR CNAE SECUNDÁRIO =====
function adicionarCnaeSecundario(codigo, atividade) {
    // NÃO validar se CNAE Principal foi selecionado
    // Permite adicionar secundários mesmo sem principal
    
    // Validar se já existe
    if (cnaesSecundariosSelecionados.find(c => c.codigo === codigo)) {
        alert('⚠️ Este CNAE secundário já foi adicionado');
        return;
    }
    
    // Adicionar
    cnaesSecundariosSelecionados.push({ codigo, atividade });
    atualizarListaCnaesSecundarios();
    
    // Mostrar grupo de secundários mesmo sem principal
    const grupoSecundarios = document.getElementById('grupoSecundarios');
    if (grupoSecundarios) {
        grupoSecundarios.style.display = 'block';
    }
    
    console.log('✓ CNAE Secundário adicionado:', codigo);
}

// ===== ATUALIZAR LISTA CNAES SECUNDÁRIOS =====
function atualizarListaCnaesSecundarios() {
    const lista = document.getElementById('listaCnaesSecundarios');
    if (!lista) return;
    
    if (cnaesSecundariosSelecionados.length === 0) {
        lista.innerHTML = '<p class="text-muted">Nenhum CNAE secundário adicionado</p>';
        return;
    }
    
    lista.innerHTML = cnaesSecundariosSelecionados.map((cnae, index) => `
        <div class="cnae-secundario-item">
            <div class="cnae-secundario-info">
                <strong>${cnae.codigo}</strong>
                <span>${cnae.atividade}</span>
            </div>
            <div class="cnae-secundario-acoes">
                <button 
                    type="button" 
                    class="btn-remover-secundario"
                    onclick="removerCnaeSecundario(${index})"
                >
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
    `).join('');
}

// ===== REMOVER CNAE SECUNDÁRIO =====
function removerCnaeSecundario(index) {
    cnaesSecundariosSelecionados.splice(index, 1);
    atualizarListaCnaesSecundarios();
    console.log('✓ CNAE Secundário removido');
}

// ===== FECHAR MODAL AO CLICAR FORA =====
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalCNAE');
    if (modal && e.target === modal) {
        fecharModalCNAE();
    }
});