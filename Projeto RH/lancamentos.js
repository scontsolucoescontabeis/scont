/**
 * SCONT - Lançamentos em Lote
 * Arquivo: lancamentos.js (Acesso Livre - Leitura do Supabase)
 * ✅ VERSÃO 2.0: Sistema de Múltiplas Parametrizações Acumuladas
 */

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via lancamentos.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ NOVO: Array que acumula todas as parametrizações da sessão
let parametrizacoesAcumuladas = [];

// ✅ NOVO: Referência aos empregados selecionados (mantém entre ciclos)
let empregadosSelecionadosAtual = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Formatação do campo de competência
    document.getElementById('lanCompetencia').addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
        e.target.value = v;
    });

    // Carrega a lista de empresas cadastradas pelo Admin logo ao iniciar
    carregarEmpresas();
});

// --- FUNÇÕES DE INTERFACE E UTILITÁRIOS ---

function mostrarMensagem(titulo, mensagem) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent = mensagem;
    document.getElementById('messageModal').classList.add('active');
}

function fecharModalMensagem() {
    document.getElementById('messageModal').classList.remove('active');
}

// ✅ CORRIGIDO: Função ativarStep com CSS inline override
function ativarStep(stepId) {
    // Remover todos os steps
    document.querySelectorAll('.step-card').forEach(card => {
        card.style.display = 'none';
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        card.classList.remove('active');
    });

    // Ativar apenas o step desejado
    const stepAtivo = document.getElementById(stepId);
    if (stepAtivo) {
        stepAtivo.style.display = 'block';
        stepAtivo.style.opacity = '1';
        stepAtivo.style.pointerEvents = 'auto';
        stepAtivo.classList.add('active');
        // Scroll para o step ativo
        stepAtivo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function filtrarLista(inputId, listId) {
    const termo = document.getElementById(inputId).value.toLowerCase();
    const itens = document.querySelectorAll(`#${listId} .checkbox-item`);
    itens.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(termo) ? 'flex' : 'none';
    });
}

function selecionarTodos(containerId, selecionar) {
    const itensVisiveis = Array.from(document.querySelectorAll(`#${containerId} .checkbox-item`))
                                   .filter(item => item.style.display !== 'none');
    itensVisiveis.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = selecionar;
    });
}

// --- LÓGICA DE DADOS (BUSCA NO SUPABASE) ---

async function carregarEmpresas() {
    const container = document.getElementById('listaEmpresas');
    container.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">Carregando empresas do banco de dados...</div>';
    try {
        // Busca as empresas cadastradas pelo Administrador
        const { data, error } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">Nenhuma empresa cadastrada no sistema.</div>';
            return;
        }

        data.forEach(emp => {
            container.innerHTML += `
                <div class="checkbox-item">
                    <input type="checkbox" id="emp_${emp.codigo_empresa}" value="${emp.codigo_empresa}">
                    <label for="emp_${emp.codigo_empresa}">${emp.codigo_empresa} - ${emp.nome_empresa}</label>
                </div>
            `;
        });
    } catch (erro) {
        console.error('Erro ao carregar empresas:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empresas do servidor.');
    }
}

async function buscarEmpregados() {
    const comp = document.getElementById('lanCompetencia').value;

    // ✅ CORRIGIDO: Validar competência
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Informe uma competência válida (MM/AAAA).');
        return;
    }

    // ✅ CORRIGIDO: Validar seleção de empresas
    const checkboxesEmpresas = document.querySelectorAll('#listaEmpresas input[type="checkbox"]:checked');
    const empresasSelecionadas = Array.from(checkboxesEmpresas).map(cb => cb.value);

    if (empresasSelecionadas.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos uma empresa.');
        return;
    }

    const container = document.getElementById('listaEmpregados');

    // ✅ CORRIGIDO: Verificar se o container existe
    if (!container) {
        console.error('Container #listaEmpregados não encontrado no HTML!');
        mostrarMensagem('Erro', 'Elemento listaEmpregados não encontrado no HTML.');
        return;
    }

    container.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">Buscando empregados vinculados...</div>';

    try {
        console.log('Empresas selecionadas:', empresasSelecionadas);
        const { data, error } = await supabaseClient
            .from('rh_empregados')
            .select('*')
            .in('codigo_empresa', empresasSelecionadas)
            .order('codigo_empresa', { ascending: true })
            .order('nome_empregado', { ascending: true });

        console.log('Resposta do Supabase:', { data, error });

        if (error) {
            console.error('Erro na query:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<div style="padding: 10px; text-align: center; color: #666;">
                Nenhum empregado encontrado para as empresas selecionadas.
                <br><small style="color: #999;">Empresas buscadas: ${empresasSelecionadas.join(', ')}</small>
            </div>`;
            console.log('Nenhum empregado encontrado');
            return;
        }

        console.log('Empregados encontrados:', data.length);
        let htmlContent = '';

        data.forEach((emp, index) => {
            const codEmpresa = emp.codigo_empresa;
            const codEmpregado = emp.codigo_empregado;
            const nomeEmpregado = emp.nome_empregado;

            console.log(`Empregado ${index + 1}:`, { codEmpresa, codEmpregado, nomeEmpregado });

            if (!codEmpresa || !codEmpregado || !nomeEmpregado) {
                console.warn('Campos incompletos no registro:', emp);
                return;
            }

            const valorCheckbox = `${codEmpresa}|${codEmpregado}`;
            const idCheckbox = `empr_${codEmpregado}_${codEmpresa}`;

            htmlContent += `
                <div class="checkbox-item" style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                    <input type="checkbox" id="${idCheckbox}" value="${valorCheckbox}" checked style="margin-right: 10px;">
                    <label for="${idCheckbox}" style="cursor: pointer; flex: 1; margin: 0;">
                        <span style="color: #8B3A3A; font-weight: bold; margin-right: 5px;">[Emp: ${codEmpresa}]</span> 
                        ${codEmpregado} - ${nomeEmpregado}
                    </label>
                </div>
            `;
        });

        // ✅ CORRIGIDO: Limpar e atribuir conteúdo
        container.innerHTML = '';
        container.innerHTML = htmlContent;

        // ✅ CORRIGIDO: Garantir que o container está visível
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';

        // ✅ NOVO: Ativar step2 APÓS carregar os empregados com sucesso
        ativarStep('step2');
        console.log('HTML renderizado com sucesso. Total de itens:', data.length);

    } catch (erro) {
        console.error('Erro ao buscar empregados:', erro);
        container.innerHTML = `<div style="padding: 10px; text-align: center; color: #d32f2f;">
            <strong>Erro ao buscar empregados:</strong><br>
            ${erro.message}
        </div>`;
        mostrarMensagem('Erro', `Falha ao buscar empregados: ${erro.message}`);
    }
}

function avancarParaParametros() {
    const checkboxesEmpregados = document.querySelectorAll('#listaEmpregados input[type="checkbox"]:checked');

    if (checkboxesEmpregados.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos um empregado para continuar.');
        return;
    }

    // ✅ NOVO: Armazenar empregados selecionados para uso posterior
    empregadosSelecionadosAtual = Array.from(checkboxesEmpregados).map(cb => cb.value);

    // ✅ CORRIGIDO: Usar ativarStep em vez de apenas adicionar classe
    ativarStep('step3');
}

// --- ✅ NOVO: SISTEMA DE ACÚMULO DE PARAMETRIZAÇÕES ---

function gerarConteudoTXT(comp, tipoProcesso, rubrica, valor, empregados) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');
    const rubFormatada = String(rubrica).padStart(9, '0');
    const valFormatado = String(valor).padStart(9, '0');

    let conteudo = '';
    empregados.forEach(empData => {
        const [codEmpresa, codEmpregado] = empData.split('|');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
    });

    return conteudo;
}

function gerarPrevia() {
    const comp = document.getElementById('lanCompetencia').value;
    const tipoProcesso = document.getElementById('lanTipoProcesso').value;
    const rubrica = document.getElementById('lanRubrica').value.trim();
    const valor = document.getElementById('lanValor').value.trim();

    // Validações
    if (!tipoProcesso) {
        mostrarMensagem('Atenção', 'Selecione o Tipo do Processo.');
        return;
    }

    if (!rubrica || !/^\d+$/.test(rubrica)) {
        mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
        return;
    }

    if (!valor || !/^\d+$/.test(valor)) {
        mostrarMensagem('Atenção', 'Informe um Valor válido (apenas números inteiros).');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    // ✅ NOVO: Gerar TXT para esta parametrização
    const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, rubrica, valor, empregadosSelecionadosAtual);

    // ✅ NOVO: Armazenar parametrização
    const parametrizacao = {
        id: Date.now(),
        competencia: comp,
        tipoProcesso: tipoProcesso,
        rubrica: rubrica,
        valor: valor,
        empregados: empregadosSelecionadosAtual,
        conteudoTXT: conteudoTXT,
        dataHora: new Date().toLocaleString('pt-BR')
    };

    parametrizacoesAcumuladas.push(parametrizacao);

    // ✅ NOVO: Mostrar prévia e opções
    document.getElementById('previaTxt').textContent = conteudoTXT;
    ativarStep('step3-5');
    atualizarListaParametrizacoes();

    // Feedback visual
    mostrarMensagem('Sucesso', `Parametrização adicionada! Total: ${parametrizacoesAcumuladas.length}`);
}

function atualizarListaParametrizacoes() {
    const container = document.getElementById('listaParametrizacoes');
    const totalSpan = document.getElementById('totalParametrizacoes');

    totalSpan.textContent = parametrizacoesAcumuladas.length;

    if (parametrizacoesAcumuladas.length === 0) {
        container.innerHTML = '<div class="parametrizacao-empty">Nenhuma parametrização adicionada ainda.</div>';
        return;
    }

    container.innerHTML = parametrizacoesAcumuladas.map((param, index) => `
        <div class="parametrizacao-item">
            <div class="parametrizacao-header">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div class="parametrizacao-counter">${index + 1}</div>
                    <div>
                        <span class="parametrizacao-badge rubrica">Rubrica: ${param.rubrica}</span>
                        <span class="parametrizacao-badge valor">R$ ${param.valor}</span>
                        <span class="parametrizacao-badge empregados">${param.empregados.length} empr.</span>
                    </div>
                </div>
                <button type="button" class="btn-remove" onclick="removerParametrizacao(${param.id})">
                    🗑️ Remover
                </button>
            </div>
            <div class="parametrizacao-info">
                ${param.dataHora} | Competência: <strong>${param.competencia}</strong> | Tipo: <strong>${param.tipoProcesso}</strong>
            </div>
        </div>
    `).join('');
}

function novaParametrizacao() {
    // Limpar formulário
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('lanRubrica').value = '';
    document.getElementById('lanValor').value = '';

    // Voltar ao Step 3 para nova parametrização
    ativarStep('step1');
}

function removerParametrizacao(id) {
    parametrizacoesAcumuladas = parametrizacoesAcumuladas.filter(p => p.id !== id);
    atualizarListaParametrizacoes();

    if (parametrizacoesAcumuladas.length === 0) {
        ativarStep('step3');
    } else {
        mostrarMensagem('Sucesso', `Parametrização removida! Total: ${parametrizacoesAcumuladas.length}`);
    }
}

function avancarParaExportacao() {
    if (parametrizacoesAcumuladas.length === 0) {
        mostrarMensagem('Atenção', 'Adicione pelo menos uma parametrização antes de exportar.');
        return;
    }

    // Concatenar todos os TXTs
    const conteudoFinal = parametrizacoesAcumuladas.map(p => p.conteudoTXT).join('');
    document.getElementById('previaTxt').textContent = conteudoFinal;

    ativarStep('step4');
}

function voltarParaEdicao() {
    ativarStep('step3-5');
}

function baixarTXT() {
    if (parametrizacoesAcumuladas.length === 0) {
        mostrarMensagem('Erro', 'Nenhuma parametrização para exportar.');
        return;
    }

    const conteudoFinal = parametrizacoesAcumuladas.map(p => p.conteudoTXT).join('');
    const blob = new Blob([conteudoFinal], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lancamento_Lote_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // ✅ NOVO: Limpar após exportação e reiniciar
    parametrizacoesAcumuladas = [];
    empregadosSelecionadosAtual = [];
    mostrarMensagem('Sucesso', 'Arquivo TXT baixado com sucesso! Sessão reiniciada.');
    
    // Limpar formulários
    document.getElementById('lanCompetencia').value = '';
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('lanRubrica').value = '';
    document.getElementById('lanValor').value = '';
    document.getElementById('buscaEmpresa').value = '';
    document.getElementById('buscaEmpregado').value = '';
    
    ativarStep('step1');
}