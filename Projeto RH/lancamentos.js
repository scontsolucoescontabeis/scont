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

// ✅ NOVO: Nome de exibição de cada empregado selecionado, para uso na grade e nos detalhes
let empregadosInfoAtual = {};

// ✅ NOVO: Grade Empregado x Rubrica (Passo 3)
let rubricasGrid = [];   // [{ id, codigo, tipoValor }]
let valoresGrid = {};    // valoresGrid[rubricaId][empregadoKey] = "valor digitado"

// Eventos fixos de rubrica (mesmos do Controle de Frequência)
const EVENTOS_FIXOS_RUBRICA = [
    { ev: 'horasTrab',  label: 'Horas Trabalhadas',  tipoValor: 'horas'     },
    { ev: 'he50',       label: 'Horas Extras 50%',   tipoValor: 'horas'     },
    { ev: 'he100',      label: 'Horas Extras 100%',  tipoValor: 'horas'     },
    { ev: 'noturno',    label: 'Adicional Noturno',  tipoValor: 'horas'     },
    { ev: 'atraso',     label: 'Atraso',              tipoValor: 'horas'     },
    { ev: 'falta',      label: 'Falta (dias)',       tipoValor: 'dias'      },
    { ev: 'descontoVT', label: 'Desconto VT',        tipoValor: 'monetario' },
    { ev: 'descontoVA', label: 'Desconto VA',        tipoValor: 'monetario' },
];

// Empresas cadastradas (preenchido em carregarEmpresas), reaproveitado pela grade e pelo modal de Configurações
let empresasCadastradas = [];

// Config de rubricas/observações por empresa do lote atual (Passo 3), sem cache entre levas
let configRubricasPorEmpresa = {};

// Rubricas disponíveis no seletor do Passo 3 (recalculado a cada avancarParaParametros)
let eventosRubricaDisponiveis = [];

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

        empresasCadastradas = data || [];

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

async function avancarParaParametros() {
    const checkboxesEmpregados = document.querySelectorAll('#listaEmpregados input[type="checkbox"]:checked');

    if (checkboxesEmpregados.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos um empregado para continuar.');
        return;
    }

    // ✅ NOVO: Armazenar empregados selecionados para uso posterior
    empregadosSelecionadosAtual = Array.from(checkboxesEmpregados).map(cb => cb.value);

    // ✅ NOVO: Guardar o nome de exibição de cada empregado (usado na grade e nos detalhes)
    empregadosInfoAtual = {};
    checkboxesEmpregados.forEach(cb => {
        const label = document.querySelector(`label[for="${cb.id}"]`);
        empregadosInfoAtual[cb.value] = label ? label.textContent.trim().replace(/\s+/g, ' ') : cb.value;
    });

    // ✅ NOVO: Reinicia a grade empregado x rubrica para esta leva
    rubricasGrid = [];
    valoresGrid = {};

    // ✅ CORRIGIDO: Usar ativarStep em vez de apenas adicionar classe
    ativarStep('step3');

    const gradeContainer = document.getElementById('gradeContainer');
    gradeContainer.innerHTML = '<div class="grade-empty-msg">Carregando rubricas configuradas...</div>';

    await carregarConfigRubricasLote(empresasDoLote());

    renderSeletorEventoRubrica();
    renderObservacoesLote();
    renderGrade();
}

function empresasDoLote() {
    const codigos = new Set();
    empregadosSelecionadosAtual.forEach(empKey => codigos.add(empKey.split('|')[0]));
    return Array.from(codigos);
}

function nomeEmpresaPorCodigo(codigoEmpresa) {
    const emp = empresasCadastradas.find(e => e.codigo_empresa === codigoEmpresa);
    return emp ? emp.nome_empresa : codigoEmpresa;
}

async function carregarConfigRubricasLote(codigosEmpresa) {
    configRubricasPorEmpresa = {};
    if (!codigosEmpresa || codigosEmpresa.length === 0) return;

    const { data, error } = await supabaseClient
        .from('rh_config_rubricas_txt')
        .select('codigo_empresa, evento, codigo_rubrica, tipo_valor, descricao_rubrica')
        .in('codigo_empresa', codigosEmpresa);

    if (error) {
        console.error('Erro ao buscar config de rubricas do lote:', error);
        mostrarMensagem('Erro', 'Falha ao buscar rubricas configuradas: ' + error.message);
        return;
    }

    (data || []).forEach(row => {
        if (!configRubricasPorEmpresa[row.codigo_empresa]) configRubricasPorEmpresa[row.codigo_empresa] = {};
        configRubricasPorEmpresa[row.codigo_empresa][row.evento] = {
            codigo: row.codigo_rubrica,
            tipo: row.tipo_valor,
            descricao: row.descricao_rubrica
        };
    });
}

// --- ✅ NOVO: SISTEMA DE ACÚMULO DE PARAMETRIZAÇÕES ---

function encodeValorParaTipo(valor, tipoValor) {
    if (tipoValor === 'horas') {
        // Aceita HH:MM → converte para HHMM como inteiro (ex: "01:30" → 130)
        const partes = String(valor).replace(/[^\d:]/g, '').split(':');
        const h = parseInt(partes[0] || '0', 10);
        const m = parseInt(partes[1] || '0', 10);
        return h * 100 + m;
    }
    if (tipoValor === 'monetario') {
        // Aceita "150,50" ou "150.50" → remove separador → 15050
        const limpo = String(valor).replace(/[^\d]/g, '');
        return parseInt(limpo || '0', 10);
    }
    // dias: inteiro
    return parseInt(String(valor).replace(/\D/g, '') || '0', 10);
}

function infoTipoValor(tipo) {
    if (tipo === 'horas') {
        return { placeholder: 'Ex: 01:30', dica: 'Formato HH:MM (ex: 01:30 = 1 hora e 30 minutos)' };
    }
    if (tipo === 'monetario') {
        return { placeholder: 'Ex: 150,50', dica: 'Valor em reais com centavos (ex: 150,50)' };
    }
    return { placeholder: 'Ex: 3', dica: 'Número inteiro de dias' };
}

function atualizarPlaceholderValorPadrao() {
    const tipo = document.getElementById('gradeRubricaTipoValor').value;
    const input = document.getElementById('gradeRubricaValorPadrao');
    const dica = document.getElementById('gradeRubricaValorPadraoDica');
    const info = infoTipoValor(tipo);
    input.placeholder = info.placeholder;
    dica.textContent = info.dica;
}

function validarFormatoValor(valor, tipoValor) {
    const v = String(valor).trim();
    if (!v) return false;
    if (tipoValor === 'horas') {
        return /^\d{1,2}:\d{2}$/.test(v);
    }
    // monetário e dias: precisa ter ao menos um dígito
    return /\d/.test(v);
}

function gerarConteudoTXT(comp, tipoProcesso, rubrica, tipoValor, itens) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');
    const rubFormatada = String(rubrica).padStart(9, '0');

    let conteudo = '';
    itens.forEach(item => {
        const [codEmpresa, codEmpregado] = item.empregado.split('|');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');
        const valorInt = encodeValorParaTipo(item.valor, tipoValor);
        const valFormatado = String(valorInt).padStart(9, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
    });

    return conteudo;
}

function adicionarRubricaGrade() {
    const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
    const tipoValor = document.getElementById('gradeRubricaTipoValor').value;
    const valorPadrao = document.getElementById('gradeRubricaValorPadrao').value.trim();

    if (!codigo || !/^\d+$/.test(codigo)) {
        mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    const id = Date.now();
    rubricasGrid.push({ id, codigo, tipoValor });
    valoresGrid[id] = {};

    if (valorPadrao) {
        empregadosSelecionadosAtual.forEach(empKey => {
            valoresGrid[id][empKey] = valorPadrao;
        });
    }

    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';

    renderGrade();
}

function removerRubricaGrade(id) {
    const rubrica = rubricasGrid.find(r => r.id === id);
    if (!rubrica) return;

    const temValores = valoresGrid[id] && Object.values(valoresGrid[id]).some(v => v && v.trim());
    if (temValores && !confirm(`A rubrica ${rubrica.codigo} já tem valores preenchidos. Remover mesmo assim?`)) {
        return;
    }

    rubricasGrid = rubricasGrid.filter(r => r.id !== id);
    delete valoresGrid[id];
    renderGrade();
}

function atualizarValorCelula(rubricaId, empKey, valor) {
    if (!valoresGrid[rubricaId]) valoresGrid[rubricaId] = {};
    valoresGrid[rubricaId][empKey] = valor;
}

function renderGrade() {
    const chipsContainer = document.getElementById('chipsRubricas');
    const gradeContainer = document.getElementById('gradeContainer');
    if (!chipsContainer || !gradeContainer) return;

    // Chips das rubricas adicionadas
    chipsContainer.innerHTML = rubricasGrid.map(r => `
        <span class="chip-rubrica">
            Rubrica ${r.codigo} (${r.tipoValor})
            <span class="chip-remove" onclick="removerRubricaGrade(${r.id})">×</span>
        </span>
    `).join('');

    if (rubricasGrid.length === 0 || empregadosSelecionadosAtual.length === 0) {
        gradeContainer.innerHTML = '<div class="grade-empty-msg">Adicione ao menos uma rubrica acima para montar a grade.</div>';
        return;
    }

    let html = '<table class="grade-table"><thead><tr><th class="grade-emp-col">Empregado</th>';
    rubricasGrid.forEach(r => {
        html += `<th>Rubrica ${r.codigo}<br><small>${infoTipoValor(r.tipoValor).placeholder}</small></th>`;
    });
    html += '</tr></thead><tbody>';

    empregadosSelecionadosAtual.forEach(empKey => {
        const nome = empregadosInfoAtual[empKey] || empKey;
        const buscaAttr = nome.toLowerCase().replace(/"/g, '');
        html += `<tr data-emp-busca="${buscaAttr}"><td class="grade-emp-col">${nome}</td>`;
        rubricasGrid.forEach(r => {
            const valorAtual = (valoresGrid[r.id] && valoresGrid[r.id][empKey]) || '';
            html += `<td><input type="text" class="grade-input" placeholder="${infoTipoValor(r.tipoValor).placeholder}" value="${valorAtual}" onchange="atualizarValorCelula(${r.id}, '${empKey}', this.value)"></td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    gradeContainer.innerHTML = html;
}

function filtrarGrade() {
    const termo = document.getElementById('buscaEmpregadoGrade').value.toLowerCase();
    document.querySelectorAll('#gradeContainer tbody tr').forEach(row => {
        const alvo = row.getAttribute('data-emp-busca') || '';
        row.style.display = alvo.includes(termo) ? '' : 'none';
    });
}

function gerarParametrizacoes() {
    const comp = document.getElementById('lanCompetencia').value;
    const tipoProcesso = document.getElementById('lanTipoProcesso').value;

    if (!tipoProcesso) {
        mostrarMensagem('Atenção', 'Selecione o Tipo do Processo.');
        return;
    }

    if (rubricasGrid.length === 0) {
        mostrarMensagem('Atenção', 'Adicione ao menos uma rubrica à grade.');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    const novasParametrizacoes = [];
    const rubricasIgnoradas = [];

    for (const r of rubricasGrid) {
        const valoresColuna = valoresGrid[r.id] || {};
        const itens = [];

        for (const empKey of Object.keys(valoresColuna)) {
            const valor = valoresColuna[empKey];
            if (!valor || !valor.trim()) continue;

            if (!validarFormatoValor(valor, r.tipoValor)) {
                const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                mostrarMensagem('Atenção', `Valor inválido para "${nomeEmp}" na rubrica ${r.codigo}: "${valor}". Corrija antes de gerar.`);
                return;
            }

            itens.push({
                empregado: empKey,
                valor: valor.trim(),
                nomeEmpregado: empregadosInfoAtual[empKey] || empKey
            });
        }

        if (itens.length === 0) {
            rubricasIgnoradas.push(r.codigo);
            continue;
        }

        const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, r.codigo, r.tipoValor, itens);

        novasParametrizacoes.push({
            id: Date.now() + Math.random(),
            competencia: comp,
            tipoProcesso: tipoProcesso,
            rubrica: r.codigo,
            tipoValor: r.tipoValor,
            itens: itens,
            conteudoTXT: conteudoTXT,
            dataHora: new Date().toLocaleString('pt-BR')
        });
    }

    if (novasParametrizacoes.length === 0) {
        mostrarMensagem('Atenção', 'Nenhuma rubrica da grade tem valores preenchidos.');
        return;
    }

    parametrizacoesAcumuladas.push(...novasParametrizacoes);

    // ✅ Reinicia a grade para a próxima leva de rubricas
    rubricasGrid = [];
    valoresGrid = {};
    renderGrade();

    document.getElementById('previaTxt').textContent = novasParametrizacoes[novasParametrizacoes.length - 1].conteudoTXT;
    ativarStep('step3-5');
    atualizarListaParametrizacoes();

    let msg = `${novasParametrizacoes.length} parametrização(ões) adicionada(s)! Total: ${parametrizacoesAcumuladas.length}`;
    if (rubricasIgnoradas.length > 0) {
        msg += `\nRubricas ignoradas (sem valores): ${rubricasIgnoradas.join(', ')}`;
    }
    mostrarMensagem('Sucesso', msg);
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
                        <span class="parametrizacao-badge empregados">${param.itens.length} empr. com valor individual</span>
                    </div>
                </div>
                <button type="button" class="btn-remove" onclick="removerParametrizacao(${param.id})">
                    🗑️ Remover
                </button>
            </div>
            <div class="parametrizacao-info">
                ${param.dataHora} | Competência: <strong>${param.competencia}</strong> | Tipo: <strong>${param.tipoProcesso}</strong>
            </div>
            <div class="detalhes-toggle" onclick="alternarDetalhesParametrizacao(${param.id})">Ver detalhes ▾</div>
            <div id="detalhes_${param.id}" style="display: none;"></div>
        </div>
    `).join('');
}

function alternarDetalhesParametrizacao(id) {
    const container = document.getElementById(`detalhes_${id}`);
    if (!container) return;

    if (container.style.display === 'none') {
        const param = parametrizacoesAcumuladas.find(p => p.id === id);
        if (!param) return;

        container.innerHTML = `
            <table class="detalhes-table">
                <thead><tr><th>Empregado</th><th>Valor</th></tr></thead>
                <tbody>
                    ${param.itens.map(item => `
                        <tr>
                            <td>${item.nomeEmpregado}</td>
                            <td>${item.valor}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

function novaParametrizacao() {
    // Limpar formulário
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    document.getElementById('gradeRubricaTipoValor').value = 'horas';
    atualizarPlaceholderValorPadrao();

    // Voltar ao Step 1 para nova leva (nova seleção de empresas/empregados)
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
    empregadosInfoAtual = {};
    rubricasGrid = [];
    valoresGrid = {};
    mostrarMensagem('Sucesso', 'Arquivo TXT baixado com sucesso! Sessão reiniciada.');

    // Limpar formulários
    document.getElementById('lanCompetencia').value = '';
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    document.getElementById('gradeRubricaTipoValor').value = 'horas';
    document.getElementById('buscaEmpresa').value = '';
    document.getElementById('buscaEmpregado').value = '';
    atualizarPlaceholderValorPadrao();
    renderGrade();

    ativarStep('step1');
}