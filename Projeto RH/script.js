/**
 * SCONT - Sistema de Gestão de Ponto e Folha de Pagamento
 * Arquivo: script.js (VERSÃO CORRIGIDA - Com campos reais do Supabase)
 */

// ===== CONFIGURAÇÃO SUPABASE =====
// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via index.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== ESTADO GLOBAL DA APLICAÇÃO =====
const state = {
    empresas: [],
    empregadosDisponiveis: [],
    empresaSelecionada: null,
    competencia: '',
    folhas: [], // Array de objetos: { empregadoId, nome, dados: [], dsrDias: [], flagsFolga: {} }
    abaAtivaIndex: 0,
    feriados: [],
    jornada: '08:00',
    ruleExtra100Optional: false,
    resultados: []
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('competencia').addEventListener('input', (e) => {
        e.target.value = formatarCompetencia(e.target.value);
    });
    document.getElementById('jornada').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
    document.getElementById('novaDataFeriado').addEventListener('input', (e) => {
        e.target.value = formatarData(e.target.value);
    });
    await carregarEmpresas();
    carregarFeriadosPadrao();
    inicializarEventos();
});

// --- CARREGAMENTO DE DADOS (SUPABASE) ---
async function carregarEmpresas() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state.empresas = data || [];
        const select = document.getElementById('codigoEmpresa');
        select.innerHTML = '<option value="">Selecione uma empresa...</option>';
        state.empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.codigo_empresa;
            option.textContent = `${emp.codigo_empresa} - ${emp.nome_empresa}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error('Erro ao carregar empresas:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empresas do servidor.');
    }
}

async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregadosDisponiveis = data || [];
    } catch (erro) {
        console.error('Erro ao carregar empregados:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empregados.');
    }
}

// --- EVENTOS PRINCIPAIS ---
function inicializarEventos() {
    document.getElementById('selectionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const comp = document.getElementById('competencia').value;
        const codEmp = document.getElementById('codigoEmpresa').value;
        if (!validarCompetencia(comp)) {
            mostrarMensagem('Erro', 'Competência inválida. Use o formato MM/AAAA.');
            return;
        }
        state.competencia = comp;
        state.empresaSelecionada = state.empresas.find(emp => emp.codigo_empresa === codEmp);
        await carregarEmpregados(codEmp);
        if (state.empregadosDisponiveis.length === 0) {
            mostrarMensagem('Aviso', 'Esta empresa não possui empregados cadastrados.');
            return;
        }
        await verificarPreenchimentosAnteriores(codEmp, comp);
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
        mostrarConfirmacao('Limpar Dados', 'Tem certeza que deseja limpar todos os dados preenchidos? Esta ação não pode ser desfeita.', () => {
            iniciarNovaFolhaEmBranco();
        });
    });
    document.getElementById('backToEditBtn').addEventListener('click', voltarParaEdicao);
    document.getElementById('exportXlsxBtn').addEventListener('click', exportarParaExcel);
    document.getElementById('openFeriadosBtn').addEventListener('click', () => document.getElementById('feriadosModal').classList.add('active'));
    document.getElementById('closeFeriadosBtn').addEventListener('click', () => document.getElementById('feriadosModal').classList.remove('active'));
    document.getElementById('closeFeriadosBtnTop').addEventListener('click', () => document.getElementById('feriadosModal').classList.remove('active'));
    document.getElementById('addFeriadoBtn').addEventListener('click', adicionarFeriado);
    document.getElementById('addTabBtn').addEventListener('click', adicionarNovaFolha);
}

// --- RETOMADA DE DADOS (SAVES) ---
async function verificarPreenchimentosAnteriores(codigoEmpresa, competencia) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_saves')
            .select('id, responsavel_alteracao, data_criacao, nome_trabalhador')
            .eq('empresa_codigo', codigoEmpresa)
            .eq('competencia', competencia)
            .order('data_criacao', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const agrupados = agruparSaves(data);
            mostrarModalRetomada(agrupados, codigoEmpresa, competencia);
        } else {
            iniciarNovaFolhaEmBranco();
        }
    } catch (erro) {
        console.error('Erro ao buscar saves:', erro);
        iniciarNovaFolhaEmBranco();
    }
}

function agruparSaves(registros) {
    const grupos = {};
    registros.forEach(reg => {
        const dataCurta = new Date(reg.data_criacao).toLocaleDateString('pt-BR');
        const responsavel = reg.responsavel_alteracao || 'Usuário Desconhecido';
        const chave = `${dataCurta}_${responsavel}`;
        
        if (!grupos[chave]) {
            grupos[chave] = {
                data: dataCurta,
                responsavel: responsavel,
                timestamp: reg.data_criacao,
                empregados: new Set()
            };
        }
        grupos[chave].empregados.add(reg.nome_trabalhador);
    });
    return Object.values(grupos);
}

function mostrarModalRetomada(agrupados, codigoEmpresa, competencia) {
    const container = document.getElementById('listaPreenchimentos');
    container.innerHTML = '';
    
    agrupados.forEach(grupo => {
        const dataHora = new Date(grupo.timestamp).toLocaleString('pt-BR');
        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
        div.innerHTML = `
            <div>
                <div style="font-weight: bold; color: var(--primary-color);">👤 ${grupo.responsavel}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Salvo em: ${dataHora}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${grupo.empregados.size} empregado(s) preenchido(s)</div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="carregarSaveEspecifico('${codigoEmpresa}', '${competencia}', '${grupo.timestamp}')">Retomar</button>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('btnNovoPreenchimento').onclick = () => {
        fecharModalPreenchimentos();
        iniciarNovaFolhaEmBranco();
    };
    
    document.getElementById('preenchimentosModal').classList.add('active');
}

function fecharModalPreenchimentos() {
    document.getElementById('preenchimentosModal').classList.remove('active');
}

async function carregarSaveEspecifico(codigoEmpresa, competencia, timestamp) {
    fecharModalPreenchimentos();
    mostrarMensagem('Carregando', 'Recuperando dados salvos...');
    
    try {
        const { data, error } = await supabaseClient
            .from('rh_saves')
            .select('*')
            .eq('empresa_codigo', codigoEmpresa)
            .eq('competencia', competencia)
            .lte('data_criacao', timestamp)
            .order('data_criacao', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Nenhum dado encontrado para esta empresa e competência.");
        }
        
        const ultimasVersoes = {};
        data.forEach(reg => {
            if (!ultimasVersoes[reg.nome_trabalhador]) {
                ultimasVersoes[reg.nome_trabalhador] = reg;
            }
        });
        
        const registrosParaCarregar = Object.values(ultimasVersoes);
        
        if (registrosParaCarregar.length > 0) {
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.ruleExtra100Optional = registrosParaCarregar[0].rule_extra_100_opcional || false;
            
            if (registrosParaCarregar[0].feriados_json) {
                try {
                    state.feriados = JSON.parse(registrosParaCarregar[0].feriados_json);
                } catch (e) {
                    console.warn('Erro ao fazer parse de feriados_json:', e);
                    state.feriados = [];
                }
                renderizarTabelaFeriados();
            }
            
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('ruleExtra100Optional').checked = state.ruleExtra100Optional;
            
            // ✅ Função auxiliar para parse seguro
            const parseJSONSeguro = (jsonString, defaultValue = null) => {
                if (!jsonString) return defaultValue;
                if (typeof jsonString !== 'string') return defaultValue;
                
                const trimmed = jsonString.trim();
                if (!trimmed || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
                    return defaultValue;
                }
                
                try {
                    return JSON.parse(trimmed);
                } catch (e) {
                    console.warn('Erro ao fazer parse de JSON:', jsonString, e);
                    return defaultValue;
                }
            };
            
            state.folhas = registrosParaCarregar.map(reg => {
                let dsrDias = parseJSONSeguro(reg.dsr_dias, []);
                let flagsFolga = parseJSONSeguro(reg.flags_folga, {});
                let dadosJson = parseJSONSeguro(reg.dados_json, []);
                
                if (!Array.isArray(dsrDias)) dsrDias = [];
                if (typeof flagsFolga !== 'object' || flagsFolga === null) flagsFolga = {};
                if (!Array.isArray(dadosJson)) dadosJson = [];
                
                return {
                    empregadoId: state.empregadosDisponiveis.find(e => e.nome_empregado === reg.nome_trabalhador)?.codigo_empregado || '',
                    nome: reg.nome_trabalhador,
                    dados: dadosJson,
                    dsrDias: dsrDias,
                    flagsFolga: flagsFolga
                };
            });
            
            state.abaAtivaIndex = 0;
            mostrarTela('mainScreen');
            renderizarAbas();
            fecharModalMensagem();
        } else {
            throw new Error("Nenhum dado válido encontrado no save.");
        }
    } catch (erro) {
        console.error('Erro ao carregar save:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar os dados salvos. Iniciando folha em branco.');
        setTimeout(iniciarNovaFolhaEmBranco, 2000);
    }
}

function agruparSaves(registros) {
    const grupos = {};
    registros.forEach(reg => {
        const dataCurta = new Date(reg.data_criacao).toLocaleDateString('pt-BR');
        const responsavel = reg.responsavel_alteracao || 'Usuário Desconhecido';
        const chave = `${dataCurta}_${responsavel}`;
        if (!grupos[chave]) {
            grupos[chave] = {
                data: dataCurta,
                responsavel: responsavel,
                timestamp: reg.data_criacao,
                empregados: new Set()
            };
        }
        grupos[chave].empregados.add(reg.nome_trabalhador);
    });
    return Object.values(grupos);
}

function mostrarModalRetomada(agrupados, codigoEmpresa, competencia) {
    const container = document.getElementById('listaPreenchimentos');
    container.innerHTML = '';
    agrupados.forEach(grupo => {
        const dataHora = new Date(grupo.timestamp).toLocaleString('pt-BR');
        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
        div.innerHTML = `
            <div>
                <div style="font-weight: bold; color: var(--primary-color);">👤 ${grupo.responsavel}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Salvo em: ${dataHora}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${grupo.empregados.size} empregado(s) preenchido(s)</div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="carregarSaveEspecifico('${codigoEmpresa}', '${competencia}', '${grupo.timestamp}')">Retomar</button>
        `;
        container.appendChild(div);
    });
    document.getElementById('btnNovoPreenchimento').onclick = () => {
        fecharModalPreenchimentos();
        iniciarNovaFolhaEmBranco();
    };
    document.getElementById('preenchimentosModal').classList.add('active');
}

function fecharModalPreenchimentos() {
    document.getElementById('preenchimentosModal').classList.remove('active');
}

async function carregarSaveEspecifico(codigoEmpresa, competencia, timestamp) {
    fecharModalPreenchimentos();
    mostrarMensagem('Carregando', 'Recuperando dados salvos...');
    
    try {
        const { data, error } = await supabaseClient
            .from('rh_saves')
            .select('*')
            .eq('empresa_codigo', codigoEmpresa)
            .eq('competencia', competencia)
            .lte('data_criacao', timestamp)
            .order('data_criacao', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Nenhum dado encontrado para esta empresa e competência.");
        }
        
        const ultimasVersoes = {};
        data.forEach(reg => {
            if (!ultimasVersoes[reg.nome_trabalhador]) {
                ultimasVersoes[reg.nome_trabalhador] = reg;
            }
        });
        
        const registrosParaCarregar = Object.values(ultimasVersoes);
        
        if (registrosParaCarregar.length > 0) {
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.ruleExtra100Optional = registrosParaCarregar[0].rule_extra_100_opcional || false;
            
            if (registrosParaCarregar[0].feriados_json) {
                try {
                    state.feriados = JSON.parse(registrosParaCarregar[0].feriados_json);
                } catch (e) {
                    console.warn('Erro ao fazer parse de feriados_json:', e);
                    state.feriados = [];
                }
                renderizarTabelaFeriados();
            }
            
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('ruleExtra100Optional').checked = state.ruleExtra100Optional;
            
            const parseJSONSeguro = (jsonString, defaultValue = null) => {
                if (!jsonString) return defaultValue;
                if (typeof jsonString !== 'string') return defaultValue;
                
                const trimmed = jsonString.trim();
                if (!trimmed || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
                    return defaultValue;
                }
                
                try {
                    return JSON.parse(trimmed);
                } catch (e) {
                    console.warn('Erro ao fazer parse de JSON:', jsonString, e);
                    return defaultValue;
                }
            };
            
            // ✅ CORRIGIDO: Validação rigorosa de tipos
            state.folhas = registrosParaCarregar.map(reg => {
                let dsrDias = parseJSONSeguro(reg.dsr_dias, []);
                let flagsFolga = parseJSONSeguro(reg.flags_folga, {});
                let dadosJson = parseJSONSeguro(reg.dados_json, []);
                
                // ✅ Garantir tipos corretos
                if (!Array.isArray(dsrDias)) {
                    console.warn('dsrDias não é array, convertendo:', dsrDias);
                    dsrDias = [];
                }
                
                if (typeof flagsFolga !== 'object' || flagsFolga === null || Array.isArray(flagsFolga)) {
                    console.warn('flagsFolga não é objeto válido, convertendo:', flagsFolga);
                    flagsFolga = {};
                }
                
                if (!Array.isArray(dadosJson)) {
                    console.warn('dadosJson não é array, convertendo:', dadosJson);
                    dadosJson = [];
                }
                
                console.log('Carregado com sucesso:', {
                    nome: reg.nome_trabalhador,
                    dsrDias: dsrDias,
                    dsrDiasType: Array.isArray(dsrDias) ? 'array' : typeof dsrDias,
                    flagsFolga: flagsFolga,
                    flagsFolgaType: typeof flagsFolga
                });
                
                return {
                    empregadoId: state.empregadosDisponiveis.find(e => e.nome_empregado === reg.nome_trabalhador)?.codigo_empregado || '',
                    nome: reg.nome_trabalhador,
                    dados: dadosJson,
                    dsrDias: dsrDias,
                    flagsFolga: flagsFolga
                };
            });
            
            state.abaAtivaIndex = 0;
            mostrarTela('mainScreen');
            renderizarAbas();
            fecharModalMensagem();
        } else {
            throw new Error("Nenhum dado válido encontrado no save.");
        }
    } catch (erro) {
        console.error('Erro ao carregar save:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar os dados salvos. Iniciando folha em branco.');
        setTimeout(iniciarNovaFolhaEmBranco, 2000);
    }
}

function iniciarNovaFolhaEmBranco() {
    state.folhas = [];
    state.abaAtivaIndex = 0;
    adicionarNovaFolha();
    mostrarTela('mainScreen');
}

// --- SISTEMA DE ABAS E RENDERIZAÇÃO ---
function adicionarNovaFolha() {
    const novaFolha = {
        empregadoId: '',
        nome: 'Novo Empregado',
        dados: gerarDiasDoMes(state.competencia),
        dsrDias: [], // ✅ CORRIGIDO: Inicializar como ARRAY vazio
        flagsFolga: {} // ✅ CORRIGIDO: Inicializar como OBJETO vazio
    };
    state.folhas.push(novaFolha);
    state.abaAtivaIndex = state.folhas.length - 1;
    renderizarAbas();
}
function removerFolha(index) {
    if (state.folhas.length <= 1) {
        mostrarMensagem('Aviso', 'Você precisa ter pelo menos uma folha.');
        return;
    }
    mostrarConfirmacao('Remover Folha', 'Tem certeza que deseja remover esta folha?', () => {
        state.folhas.splice(index, 1);
        state.abaAtivaIndex = Math.max(0, index - 1);
        renderizarAbas();
    });
}

function renderizarAbas() {
    const nav = document.getElementById('tabsNav');
    nav.innerHTML = '';
    state.folhas.forEach((folha, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${index === state.abaAtivaIndex ? 'active' : ''}`;
        
        // ✅ CORRIGIDO: Nova fonte, tamanho e tipografia para as abas
        btn.style.cssText = `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.4px;
            padding: 12px 18px;
            border-radius: 6px 6px 0 0;
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #e5e7eb;
            border-bottom: none;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-right: 5px;
        `;
        
        // Estilo quando ativa
        if (index === state.abaAtivaIndex) {
            btn.style.cssText += `
                background: white;
                color: #800000;
                border-color: #800000;
                border-bottom: 3px solid #800000;
                font-weight: 700;
            `;
        }
        
        let nomeExibicao = folha.nome;
        
        btn.innerHTML = `
            ${nomeExibicao}
            <span class="tab-close" onclick="event.stopPropagation(); removerFolha(${index})" style="
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
            " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">×</span>
        `;
        
        btn.onclick = () => {
            state.abaAtivaIndex = index;
            renderizarAbas();
        };
        
        // Hover effect
        btn.onmouseover = () => {
            if (index !== state.abaAtivaIndex) {
                btn.style.background = '#e5e7eb';
                btn.style.color = '#1f2937';
            }
        };
        
        btn.onmouseout = () => {
            if (index !== state.abaAtivaIndex) {
                btn.style.background = '#f3f4f6';
                btn.style.color = '#374151';
            }
        };
        
        nav.appendChild(btn);
    });
    renderizarConteudoAba();
}

function renderizarConteudoAba() {
    const content = document.getElementById('tabsContent');
    const folha = state.folhas[state.abaAtivaIndex];
    if (!folha) return;
    
    let optionsEmpregados = '<option value="">Selecione o Empregado...</option>';
    state.empregadosDisponiveis.forEach(emp => {
        const selected = (folha.nome === emp.nome_empregado) ? 'selected' : '';
        optionsEmpregados += `<option value="${emp.codigo_empregado}|${emp.nome_empregado}" ${selected}>${emp.codigo_empregado} - ${emp.nome_empregado}</option>`;
    });
    
  let html = `
    <div style="margin-bottom: 25px; background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #800000; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 15px;">
                <div style="
    background-color: #ffffff; 
    color: #800000; 
    width: 45px; 
    height: 45px; 
    border-radius: 50%; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 22px; 
    border: 2px solid #800000; 
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
"> 
    👨‍💼 
</div>
                <div style="flex: 1;">
                        <label for="selectEmpregado" style="display: block; font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Empregado Selecionado *</label>
                <!-- ✅ CORRIGIDO: Dropdown com nova fonte e tamanho -->
                <select id="selectEmpregado" onchange="atualizarNomeEmpregado(this.value, ${state.abaAtivaIndex})" style="

-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    width: 100%; 
                    max-width: 500px; 
                    padding: 12px 15px; 
                    border: 2px solid #ced4da; 
                    border-radius: 6px; 
                    font-size: 12px; 
                    font-weight: 500; 
                    color: #495057; 
                    background-color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    letter-spacing: 0.3px;
                    transition: border-color 0.2s;
                ">
                    ${optionsEmpregados}

                    </select>
                </div>
            </div>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Dia</th>
                        <th>Entrada 1</th>
                        <th>Saída 1</th>
                        <th>Entrada 2</th>
                        <th>Saída 2</th>
                        <th>DSR</th>
                        <th>Folga/Falta</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    folha.dados.forEach((dia, diaIndex) => {
        const isFeriado = state.feriados.some(f => f.data === dia.data);
        const isDSR = folha.dsrDias.includes(dia.data);
        const rowClass = (isFeriado || isDSR) ? 'holiday-row' : '';
        const infoExtra = isFeriado ? `<span style="color: var(--danger-color); font-size: 11px; display: block;">Feriado</span>` : '';
        
        const temEntrada = dia.entrada1 || dia.entrada2;
        const flagFolga = folha.flagsFolga[dia.data] || '';
        
        html += `
            <tr class="${rowClass}">
                <td>
                    <strong>${dia.data}</strong><br>
                    <span style="font-size: 12px; color: var(--text-secondary);">${dia.diaSemana}</span>
                    ${infoExtra}
                </td>
                <td style="text-align: center; font-size: 12px; color: #6c757d;">
                    ${isDSR ? '<span style="background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">DSR</span>' : ''}
                </td>
                <td><input type="text" class="time-input" value="${dia.entrada1}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada1', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida1}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida1', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.entrada2}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada2', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida2}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida2', this.value)" placeholder="00:00" maxlength="5"></td>
                <td style="text-align: center;">
                    <input type="checkbox" ${isDSR ? 'checked' : ''} onchange="atualizarDSRDia(${state.abaAtivaIndex}, '${dia.data}', this.checked)" style="cursor: pointer; width: 18px; height: 18px;">
                </td>
                <td style="text-align: center;">
                    ${!temEntrada ? `
                        <select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
                            <option value="">-</option>
                            <option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>
                            <option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>
                        </select>
                    ` : '-'}
                </td>
                <td><button type="button" class="btn-icon" onclick="limparLinha(${state.abaAtivaIndex}, ${diaIndex})" title="Limpar linha">🗑️</button></td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    content.innerHTML = html;
    
    document.querySelectorAll('.time-input').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = formatarHora(e.target.value);
        });
    });
}
window.atualizarNomeEmpregado = function(valorSelect, folhaIndex) {
    if (!valorSelect) {
        state.folhas[folhaIndex].nome = 'Novo Empregado';
        state.folhas[folhaIndex].empregadoId = '';
    } else {
        const [id, nome] = valorSelect.split('|');
        
        // ✅ VALIDAÇÃO: Verificar se o empregado já existe em outra aba
        const empregadoJaExiste = state.folhas.some((folha, index) => 
            index !== folhaIndex && folha.empregadoId === id
        );
        
        if (empregadoJaExiste) {
            mostrarMensagem('Aviso', `O empregado ${nome} já foi adicionado nesta competência.`);
            // Reverter a seleção no select
            renderizarConteudoAba();
            return;
        }
        
        state.folhas[folhaIndex].nome = nome;
        state.folhas[folhaIndex].empregadoId = id;
    }
    renderizarAbas();
};

// ✅ Atualizar DSR (Dias de Descanso Semanal Remunerado)
// ✅ Atualizar DSR por data específica (não por dia da semana)
window.atualizarDSRDia = function(folhaIndex, data, isChecked) {
    const folha = state.folhas[folhaIndex];
    
    if (isChecked) {
        if (!folha.dsrDias.includes(data)) {
            folha.dsrDias.push(data);
        }
    } else {
        folha.dsrDias = folha.dsrDias.filter(d => d !== data);
    }
    
    renderizarConteudoAba();
};

// ✅ Atualizar Flag de Folga/Falta para dias não preenchidos
window.atualizarFlagFolga = function(folhaIndex, data, valor) {
    const folha = state.folhas[folhaIndex];
    
    if (valor) {
        folha.flagsFolga[data] = valor;
    } else {
        delete folha.flagsFolga[data];
    }
};


// ✅ Atualizar Flag de Folga/Falta para dias não preenchidos
window.atualizarFlagFolga = function(folhaIndex, data, valor) {
    const folha = state.folhas[folhaIndex];
    
    if (valor) {
        folha.flagsFolga[data] = valor;
    } else {
        delete folha.flagsFolga[data];
    }
};


window.atualizarDado = function(folhaIndex, diaIndex, campo, valor) {
    if (valor && !validarHora(valor)) {
        mostrarMensagem('Erro', 'Hora inválida. Use o formato HH:MM (00:00 a 23:59).');
        renderizarConteudoAba();
        return;
    }
    state.folhas[folhaIndex].dados[diaIndex][campo] = valor;
};

window.limparLinha = function(folhaIndex, diaIndex) {
    state.folhas[folhaIndex].dados[diaIndex].entrada1 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida1 = '';
    state.folhas[folhaIndex].dados[diaIndex].entrada2 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida2 = '';
    renderizarConteudoAba();
};

// --- GERENCIAMENTO DE FERIADOS ---
function carregarFeriadosPadrao() {
    const feriadosFixos = [
        { dia: '01/01', desc: 'Confraternização Universal' },
        { dia: '21/04', desc: 'Tiradentes' },
        { dia: '01/05', desc: 'Dia do Trabalho' },
        { dia: '07/09', desc: 'Independência do Brasil' },
        { dia: '12/10', desc: 'Nossa Senhora Aparecida' },
        { dia: '02/11', desc: 'Finados' },
        { dia: '20/11', desc: 'Consciência Negra' },
        { dia: '25/12', desc: 'Natal' }
    ];
    state.feriados = feriadosFixos.map(f => ({ data: f.dia, descricao: f.desc }));
    renderizarTabelaFeriados();
}

function adicionarFeriado() {
    const data = document.getElementById('novaDataFeriado').value;
    const desc = document.getElementById('novaDescricaoFeriado').value;
    if (!validarData(data)) {
        mostrarMensagem('Erro', 'Data inválida. Use DD/MM/AAAA.');
        return;
    }
    if (!desc) {
        mostrarMensagem('Erro', 'Informe uma descrição para o feriado.');
        return;
    }
    if (!state.feriados.some(f => f.data === data)) {
        state.feriados.push({ data, descricao: desc });
        state.feriados.sort((a, b) => {
            const [d1, m1, a1] = a.data.split('/');
            const [d2, m2, a2] = b.data.split('/');
            return new Date(a1, m1-1, d1) - new Date(a2, m2-1, d2);
        });
        renderizarTabelaFeriados();
        renderizarConteudoAba();
    }
    document.getElementById('novaDataFeriado').value = '';
    document.getElementById('novaDescricaoFeriado').value = '';
}

window.removerFeriado = function(data) {
    state.feriados = state.feriados.filter(f => f.data !== data);
    renderizarTabelaFeriados();
    renderizarConteudoAba();
};

function renderizarTabelaFeriados() {
    const tbody = document.getElementById('feriadosTbody');
    tbody.innerHTML = '';
    if (state.feriados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 10px; color: var(--text-secondary);">Nenhum feriado cadastrado.</td></tr>';
        return;
    }
    state.feriados.forEach(f => {
        tbody.innerHTML += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.data}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.descricao}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <button type="button" class="btn-icon" onclick="removerFeriado('${f.data}')" style="color: var(--danger-color);">🗑️</button>
                </td>
            </tr>
        `;
    });
}

// --- ✅ LÓGICA DE ASSINATURA E SALVAMENTO ---
function iniciarSalvamento() {
    state.jornada = document.getElementById('jornada').value;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
    if (!validarHora(state.jornada)) {
        mostrarMensagem('Erro', 'Jornada de trabalho inválida.');
        return;
    }
    let temErroEmpregado = false;
    state.folhas.forEach((f, i) => {
        if (f.nome === 'Novo Empregado' || !f.empregadoId) {
            temErroEmpregado = true;
            state.abaAtivaIndex = i;
        }
    });
    if (temErroEmpregado) {
        renderizarAbas();
        mostrarMensagem('Erro', 'Selecione um empregado válido em todas as folhas antes de processar.');
        return;
    }
    document.getElementById('signatureModal').classList.add('active');
    document.getElementById('nomeResponsavel').focus();
}

function fecharModalAssinatura() {
    document.getElementById('signatureModal').classList.remove('active');
    document.getElementById('nomeResponsavel').value = '';
}

async function confirmarSalvamentoComAssinatura() {
    const responsavel = document.getElementById('nomeResponsavel').value.trim();
    if (!responsavel) {
        alert('Por favor, informe seu nome ou e-mail para registrar a alteração.');
        return;
    }
    fecharModalAssinatura();
    await processarFolhaComSalvamento(responsavel);
}

async function processarFolhaComSalvamento(nomeResponsavel) {
    mostrarMensagem('Processando', 'Calculando horas e salvando no servidor...');
    try {
        state.resultados = state.folhas.map(folha => calcularFolha(folha));
        
        const usuarioUUID = '00000000-0000-0000-0000-000000000000';
        
        // ✅ CORRIGIDO: Garantir que dsr_dias e flags_folga sejam salvos corretamente
        const dadosParaSalvar = state.folhas.map(folha => {
            // ✅ Garantir que dsrDias é um ARRAY
            let dsrDiasArray = [];
            if (Array.isArray(folha.dsrDias)) {
                dsrDiasArray = folha.dsrDias;
            } else if (typeof folha.dsrDias === 'string') {
                try {
                    dsrDiasArray = JSON.parse(folha.dsrDias);
                    if (!Array.isArray(dsrDiasArray)) dsrDiasArray = [];
                } catch (e) {
                    dsrDiasArray = [];
                }
            }
            
            // ✅ Garantir que flagsFolga é um OBJETO
            let flagsFolgaObj = {};
            if (typeof folha.flagsFolga === 'object' && folha.flagsFolga !== null && !Array.isArray(folha.flagsFolga)) {
                flagsFolgaObj = folha.flagsFolga;
            } else if (typeof folha.flagsFolga === 'string') {
                try {
                    flagsFolgaObj = JSON.parse(folha.flagsFolga);
                    if (typeof flagsFolgaObj !== 'object' || flagsFolgaObj === null || Array.isArray(flagsFolgaObj)) {
                        flagsFolgaObj = {};
                    }
                } catch (e) {
                    flagsFolgaObj = {};
                }
            }
            
            console.log('Salvando folha:', {
                nome: folha.nome,
                dsrDias: dsrDiasArray,
                dsrDiasType: typeof dsrDiasArray,
                flagsFolga: flagsFolgaObj,
                flagsFolgaType: typeof flagsFolgaObj
            });
            
            return {
                usuario_id: usuarioUUID,
                empresa_codigo: state.empresaSelecionada.codigo_empresa,
                nome_trabalhador: folha.nome,
                competencia: state.competencia,
                jornada: state.jornada,
                rule_extra_100_opcional: state.ruleExtra100Optional,
                dados_json: JSON.stringify(folha.dados),
                feriados_json: JSON.stringify(state.feriados),
                dsr_dias: JSON.stringify(dsrDiasArray), // ✅ Sempre um ARRAY
                flags_folga: JSON.stringify(flagsFolgaObj), // ✅ Sempre um OBJETO
                responsavel_alteracao: nomeResponsavel,
                status: 'finalizado',
                criado_por: nomeResponsavel,
                atualizado_por: nomeResponsavel,
                nome_usuario: nomeResponsavel
            };
        });
        
        console.log('Primeiro registro a salvar:', dadosParaSalvar[0]);
        
        const { error } = await supabaseClient.from('rh_saves').upsert(dadosParaSalvar, {
            onConflict: 'empresa_codigo,nome_trabalhador,competencia'
        });
        if (error) throw error;
        
        fecharModalMensagem();
        mostrarTela('resultsScreen');
        renderizarConsolidado();
        renderizarTabelasDiarias();
        mostrarMensagem('Sucesso', 'Folha de ponto processada e salva com sucesso!');
    } catch (erro) {
        console.error('Erro no processamento/salvamento:', erro);
        mostrarMensagem('Erro', 'Falha ao processar ou salvar os dados: ' + erro.message);
    }
}

// ✅ Função para gerar UUID v4 determinístico baseado no nome
function gerarUUIDDoNome(nome) {
    // Usar hash SHA-1 simulado para gerar UUID consistente
    const hash = simpleHash(nome);
    
    // Formatar como UUID v4
    const uuid = [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16),  // v4
        ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
        hash.substring(20, 32)
    ].join('-');
    
    return uuid;
}

// ✅ Função hash simples (determinística)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Converter para inteiro 32-bit
    }
    
    // Converter para string hexadecimal de 32 caracteres
    let hex = Math.abs(hash).toString(16);
    
    // Repetir o hash para preencher 32 caracteres
    while (hex.length < 32) {
        hex += Math.abs(simpleHashAux(hex)).toString(16);
    }
    
    return hex.substring(0, 32);
}

// ✅ Função auxiliar para hash
function simpleHashAux(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
}

// Função para gerar UUID determinístico baseado no nome
function gerarUUIDDoNome(nome) {
    const NAMESPACE = '550e8400-e29b-41d4-a716-446655440000';
    const hash = simpleHash(NAMESPACE + nome);
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

// Função hash simples
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
}

// Função para gerar UUID v5 determinístico baseado no nome
function gerarUUIDDoNome(nome) {
    // Namespace UUID para SCONT
    const NAMESPACE = '550e8400-e29b-41d4-a716-446655440000';
    
    // Simular UUID v5 (SHA-1 hash do namespace + nome)
    // Para produção, use uma biblioteca como 'uuid' do npm
    const hash = simpleHash(NAMESPACE + nome);
    
    // Formatar como UUID
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

// Função hash simples (para desenvolvimento)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Converter para inteiro 32-bit
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
}


// --- MOTOR DE CÁLCULO ---
function calcularFolha(folha) {
    const jornadaMinutos = converterHoraParaMinutos(state.jornada);
    let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0;
    
    const diasCalculados = folha.dados.map(dia => {
        const isFeriado = state.feriados.some(f => f.data === dia.data);
        const isDSRCustomizado = folha.dsrDias.includes(dia.data);
        const isDiaDescanso = isFeriado || isDSRCustomizado;
        
        const minTrabalhados = calcularHorasTrabalhadas(dia.entrada1, dia.saida1) + calcularHorasTrabalhadas(dia.entrada2, dia.saida2);
        const minNoturnos = calcularHorasNoturnas(dia.entrada1, dia.saida1, dia.entrada2, dia.saida2);
        const minNoturnosConvertidos = Math.round(minNoturnos / 0.875);
        
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false;
        
        if (minTrabalhados > 0) {
            if (isDiaDescanso) {
                // ✅ DSR/Feriado: 100% sobre HORAS NOTURNAS CONVERTIDAS se houver noturno, senão sobre horas trabalhadas
                if (minNoturnos > 0) {
                    extra100 = minNoturnosConvertidos;
                } else {
                    extra100 = minTrabalhados;
                }
                flagDSR = true;
            } else {
                // ✅ CORRIGIDO: Usar HORAS NOTURNAS CONVERTIDAS para todos os cálculos se houver noturno
                const horasReferencia = (minNoturnos > 0) ? minNoturnosConvertidos : minTrabalhados;
                
                if (horasReferencia > jornadaMinutos) {
                    let minutosExtras = horasReferencia - jornadaMinutos;
                    
                    if (state.ruleExtra100Optional) {
                        // ✅ CORRIGIDO: 100% a partir da 3ª hora de 50%
                        // Primeiras 2h (120 min) = 50%, A partir da 3ª = 100%
                        if (minutosExtras <= 120) {
                            extra50 = minutosExtras;
                            extra100 = 0;
                        } else {
                            extra50 = 120;
                            extra100 = minutosExtras - 120;
                        }
                    } else {
                        // Sem flag: tudo é 50%
                        extra50 = minutosExtras;
                        extra100 = 0;
                    }
                } else if (horasReferencia < jornadaMinutos) {
                    // ✅ Faltante: Jornada - Horas de Referência
                    faltante = jornadaMinutos - horasReferencia;
                    if (faltante < 0) faltante = 0;
                }
            }
        } else if (!isDiaDescanso) {
            const flagFolgaData = folha.flagsFolga[dia.data];
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                faltante = jornadaMinutos;
                flagFalta = true;
            } else {
                faltante = jornadaMinutos;
                flagFalta = true;
            }
        }
        
        // ✅ Garantir que extras nunca sejam menores que 0
        extra50 = Math.max(0, extra50);
        extra100 = Math.max(0, extra100);
        faltante = Math.max(0, faltante);
        
        totalTrabalhado += minTrabalhados;
        totalExtra50 += extra50;
        totalExtra100 += extra100;
        totalNoturno += minNoturnos;
        totalNoturnoConvertido += minNoturnosConvertidos;
        totalFaltante += faltante;
        
        return {
            data: dia.data,
            diaSemana: dia.diaSemana,
            entrada1: dia.entrada1,
            saida1: dia.saida1,
            entrada2: dia.entrada2,
            saida2: dia.saida2,
            trabalhado: converterMinutosParaHora(minTrabalhados),
            extra50: converterMinutosParaHora(extra50),
            extra100: converterMinutosParaHora(extra100),
            noturno: converterMinutosParaHora(minNoturnos),
            noturnoConvertido: converterMinutosParaHora(minNoturnosConvertidos),
            faltante: converterMinutosParaHora(faltante),
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta
        };
    });
    
    // ✅ Manter totais ORIGINAIS para exibição
    const totalExtra50Original = totalExtra50;
    const totalExtra100Original = totalExtra100;
    
    // Cálculo de Horas Devidas
    let horasFaltantesMinutos = totalFaltante;
    let extra50Minutos = totalExtra50;
    let extra100Minutos = totalExtra100;
    let horasDevidasMinutos = 0;
    
    if (horasFaltantesMinutos > 0) {
        // Subtrair de Extra 50% primeiro
        if (extra50Minutos >= horasFaltantesMinutos) {
            extra50Minutos -= horasFaltantesMinutos;
            horasFaltantesMinutos = 0;
        } else {
            horasFaltantesMinutos -= extra50Minutos;
            extra50Minutos = 0;
            
            // Se ainda houver faltante, subtrair de Extra 100%
            if (horasFaltantesMinutos > 0 && extra100Minutos > 0) {
                if (extra100Minutos >= horasFaltantesMinutos) {
                    extra100Minutos -= horasFaltantesMinutos;
                    horasFaltantesMinutos = 0;
                } else {
                    horasFaltantesMinutos -= extra100Minutos;
                    extra100Minutos = 0;
                }
            }
        }
        
        horasDevidasMinutos = Math.max(0, horasFaltantesMinutos);
    }
    
    return {
        nome: folha.nome,
        empregadoId: folha.empregadoId,
        dias: diasCalculados,
        totais: {
            trabalhado: converterMinutosParaHora(totalTrabalhado),
            extra50: converterMinutosParaHora(totalExtra50Original),
            extra100: converterMinutosParaHora(totalExtra100Original),
            noturno: converterMinutosParaHora(totalNoturno),
            noturnoConvertido: converterMinutosParaHora(totalNoturnoConvertido),
            faltante: converterMinutosParaHora(totalFaltante),
            devidas: converterMinutosParaHora(horasDevidasMinutos)
        }
    };
}

function calcularHorasTrabalhadas(entrada, saida) {
    if (!entrada || !saida) return 0;
    let minEntrada = converterHoraParaMinutos(entrada);
    let minSaida = converterHoraParaMinutos(saida);
    if (minSaida < minEntrada) minSaida += 24 * 60;
    return minSaida - minEntrada;
}

function calcularHorasNoturnas(e1, s1, e2, s2) {
    const inicioNoturno = 22 * 60, fimNoturno = 5 * 60;
    let minNoturnos = 0;
    const calcularNoturnoIntervalo = (entrada, saida) => {
        if (!entrada || !saida) return 0;
        let minE = converterHoraParaMinutos(entrada);
        let minS = converterHoraParaMinutos(saida);
        if (minS < minE) minS += 24 * 60;
        let noturno = 0;
        if (minE < fimNoturno && minS > fimNoturno) noturno += fimNoturno - minE;
        if (minE < inicioNoturno && minS > inicioNoturno) noturno += minS - inicioNoturno;
        if (minE >= inicioNoturno || minS <= fimNoturno) {
            if (minE >= inicioNoturno) noturno += minS - minE;
            else if (minS <= fimNoturno) noturno += minS - minE;
        }
        return noturno;
    };
    minNoturnos += calcularNoturnoIntervalo(e1, s1);
    minNoturnos += calcularNoturnoIntervalo(e2, s2);
    return minNoturnos;
}

// --- RENDERIZAÇÃO DE RESULTADOS ---
function renderizarConsolidado() {
    const container = document.getElementById('consolidadoContainer');
    let html = '<h3 style="color: #800000; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 20px;">📊 Consolidado Geral</h3>';
    
    state.resultados.forEach(res => {
        html += `
            <div class="card" style="margin-bottom: 25px; padding: 0; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(to right, #800000, #a52a2a); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px; background: rgba(255,255,255,0.2); width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">👨‍💼</span>
                        <div>
                            <span style="font-weight: 600; font-size: 14px; letter-spacing: 0.5px; display: block;">${res.nome}</span>
                            <span style="font-size: 12px; opacity: 0.9;">Matrícula: ${res.empregadoId}</span>
                        </div>
                    </div>
                </div>
                
                <!-- ✅ NOVO: Seção de Totais de Extras ANTES de Horas Devidas -->
                <div style="background: #f9fafb; padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 10px;">📊 Totais de Horas Extras</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                        <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Extras 50%</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1f2937; margin-top: 5px;">${res.totais.extra50}</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Extras 100%</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1f2937; margin-top: 5px;">${res.totais.extra100}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Resumo Geral -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: #e5e7eb;">
                    <div style="background: white; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Trabalhado</div>
                        <div style="font-size: 24px; font-weight: 800; color: #1f2937; margin-top: 8px;">${res.totais.trabalhado}</div>
                    </div>
                    <div style="background: white; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Adic. Noturno</div>
                        <div style="font-size: 24px; font-weight: 800; color: #1f2937; margin-top: 8px;">${res.totais.noturnoConvertido}</div>
                    </div>
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Faltantes</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltante}</div>
                    </div>
                    <div style="background: #fef3c7; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Devidas</div>
                        <div style="font-size: 24px; font-weight: 800; color: #92400e; margin-top: 8px;">${res.totais.devidas}</div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderizarTabelasDiarias() {
    const container = document.getElementById('tabelasContainer');
    let html = '<h3 style="color: #800000; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 20px;">📋 Detalhamento Diário</h3>';
    
    state.resultados.forEach(res => {
        let htmlTabela = `
            <div class="card" style="margin-bottom: 30px; padding: 0; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="background: #f3f4f6; color: #374151; padding: 12px 20px; font-weight: 600; font-size: 15px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 10px;">
                    <span style="color: #800000;">📅</span> ${res.nome}
                </div>
                <div class="table-container" style="margin: 0; border: none; border-radius: 0;">
                    <table class="data-table" style="font-size: 13px; width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #ffffff; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                                <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e5e7eb;">Data</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Entradas/Saídas</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Trabalhado</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Extra 50%</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Extra 100%</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Noturno</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Faltante</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">Flags</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        res.dias.forEach((dia, index) => {
            const isFeriado = state.feriados.some(f => f.data === dia.data);
            const isDescanso = dia.isDiaDescanso;
            
            let rowStyle = index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;';
            if (isDescanso) rowStyle = 'background-color: #fef2f2; color: #991b1b;';
            
            const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2].filter(v => v).join(' - ') || '-';
            
            // ✅ CORRIGIDO: Incluir DSR nos flags
            let flags = '';
            if (dia.flagDSR) {
                flags += '<span style="background: #4f46e5; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">DSR</span>';
            }
            if (dia.flagFolga) {
                flags += '<span style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FOLGA</span>';
            }
            if (dia.flagFalta) {
                flags += '<span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FALTA</span>';
            }
            if (isFeriado) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;">FERIADO</span>';
            }
            
            htmlTabela += `
                <tr style="${rowStyle} border-bottom: 1px solid #e5e7eb; transition: background-color 0.2s;">
                    <td style="padding: 10px 15px; font-weight: 500;">
                        ${dia.data} <span style="color: ${isDescanso ? '#991b1b' : '#9ca3af'}; font-weight: normal; font-size: 11px;">(${dia.diaSemana})</span>
                    </td>
                    <td style="padding: 10px 15px; text-align: center; color: ${isDescanso ? '#991b1b' : '#4b5563'};">${marcacoes}</td>
                    <td style="padding: 10px 15px; text-align: center; font-weight: 600; color: ${isDescanso ? '#991b1b' : '#1f2937'};">${dia.trabalhado !== '00:00' ? dia.trabalhado : '-'}</td>
                    <td style="padding: 10px 15px; text-align: center; color: ${isDescanso ? '#991b1b' : '#4b5563'};">${dia.extra50 !== '00:00' ? dia.extra50 : '-'}</td>
                    <td style="padding: 10px 15px; text-align: center; color: ${isDescanso ? '#991b1b' : '#4b5563'};">${dia.extra100 !== '00:00' ? dia.extra100 : '-'}</td>
                    <td style="padding: 10px 15px; text-align: center; color: ${isDescanso ? '#991b1b' : '#4b5563'};">${dia.noturnoConvertido !== '00:00' ? dia.noturnoConvertido : '-'}</td>
                    <td style="padding: 10px 15px; text-align: center; color: #991b1b; font-weight: 600;">${dia.faltante !== '00:00' ? dia.faltante : '-'}</td>
                    <td style="padding: 10px 15px; text-align: center;">${flags || '-'}</td>
                </tr>
            `;
        });
        
        htmlTabela += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        html += htmlTabela;
    });
    
    container.innerHTML = html;
}

// --- EXPORTAÇÃO EXCEL ---
function exportarParaExcel() {
    if (state.resultados.length === 0) {
        mostrarMensagem('Erro', 'Não há dados processados para exportar.');
        return;
    }

    const wb = XLSX.utils.book_new();
    const compFormatada = state.competencia.replace('/', '-');
    const infoCabecalho = `Empresa: ${state.empresaSelecionada.codigo_empresa} - ${state.empresaSelecionada.nome_empresa} | Competência: ${state.competencia}`;

// 1. Criar array para o Consolidado Geral
const dadosConsolidadoGeral = [];

// 2. Gerar abas individuais para cada empregado
state.resultados.forEach(res => {
    // Adicionar ao Consolidado Geral
    dadosConsolidadoGeral.push({
        'Matrícula': res.empregadoId,
        'Empregado': res.nome,
        'Horas Trabalhadas': res.totais.trabalhado,
        'Horas Extras 50%': res.totais.extra50,
        'Horas Extras 100%': res.totais.extra100,
        'Adicional Noturno': res.totais.noturnoConvertido,
        'Horas Faltantes': res.totais.faltante,
        'Horas Devidas': res.totais.devidas
    });

    // Preparar dados da aba individual
    const dadosAbaIndividual = [
        { 'Data': infoCabecalho, 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' },
        { 'Data': '', 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' },
        { 'Data': 'Data', 'Dia da Semana': 'Dia da Semana', 'Entradas/Saídas': 'Entradas/Saídas', 'Trabalhado': 'Trabalhado', 'Extra 50%': 'Extra 50%', 'Extra 100%': 'Extra 100%', 'Noturno': 'Noturno', 'Faltante': 'Faltante', 'Flags': 'Flags' }
    ];

    // Adicionar dias
    res.dias.forEach(dia => {
        const isFeriado = state.feriados.some(f => f.data === dia.data);
        const tipoDia = isFeriado ? 'Feriado' : dia.diaSemana;
        const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2].filter(v => v).join(' - ') || '-';
        
     // ✅ NOVO: Gerar string de flags com DSR
// ✅ NOVO: Gerar string de flags com DSR
let flagsStr = '';
if (dia.flagDSR) flagsStr += 'DSR '; // ✅ Verificar flagDSR
if (dia.flagFolga) flagsStr += 'FOLGA ';
if (dia.flagFalta) flagsStr += 'FALTA ';
if (isFeriado) flagsStr += 'FERIADO ';

dadosAbaIndividual.push({
    'Data': dia.data,
    'Dia da Semana': tipoDia,
    'Entradas/Saídas': marcacoes,
    'Trabalhado': dia.trabalhado !== '00:00' ? dia.trabalhado : '-',
    'Extra 50%': dia.extra50 !== '00:00' ? dia.extra50 : '-',
    'Extra 100%': dia.extra100 !== '00:00' ? dia.extra100 : '-',
    'Noturno': dia.noturnoConvertido !== '00:00' ? dia.noturnoConvertido : '-',
    'Faltante': dia.faltante !== '00:00' ? dia.faltante : '-',
    'Flags': flagsStr.trim()
});
    });

    // Adicionar totais no final da aba individual
    dadosAbaIndividual.push({ 'Data': '', 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' });
    dadosAbaIndividual.push({
        'Data': 'TOTAIS',
        'Dia da Semana': '',
        'Entradas/Saídas': '',
        'Trabalhado': res.totais.trabalhado,
        'Extra 50%': res.totais.extra50,
        'Extra 100%': res.totais.extra100,
        'Noturno': res.totais.noturnoConvertido,
        'Faltante': res.totais.faltante,
        'Flags': ''
    });

    const wsDiario = XLSX.utils.json_to_sheet(dadosAbaIndividual, { skipHeader: true });
    
    wsDiario['!cols'] = [
        { wch: 12 }, // Data
        { wch: 15 }, // Dia da Semana
        { wch: 25 }, // Entradas/Saídas
        { wch: 12 }, // Trabalhado
        { wch: 12 }, // Extra 50%
        { wch: 12 }, // Extra 100%
        { wch: 12 }, // Noturno
        { wch: 12 }, // Faltante
        { wch: 20 }  // Flags
    ];

    let nomeAba = res.nome.substring(0, 31).replace(/[\/?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, wsDiario, nomeAba);
});

// 3. Criar aba Consolidado Geral
const dadosConsolidadoComCabecalho = [
    { 'Matrícula': infoCabecalho, 'Empregado': '', 'Horas Trabalhadas': '', 'Horas Extras 50%': '', 'Horas Extras 100%': '', 'Adicional Noturno': '', 'Horas Faltantes': '', 'Horas Devidas': '' },
    { 'Matrícula': '', 'Empregado': '', 'Horas Trabalhadas': '', 'Horas Extras 50%': '', 'Horas Extras 100%': '', 'Adicional Noturno': '', 'Horas Faltantes': '', 'Horas Devidas': '' },
    { 'Matrícula': 'Matrícula', 'Empregado': 'Empregado', 'Horas Trabalhadas': 'Horas Trabalhadas', 'Horas Extras 50%': 'Horas Extras 50%', 'Horas Extras 100%': 'Horas Extras 100%', 'Adicional Noturno': 'Adicional Noturno', 'Horas Faltantes': 'Horas Faltantes', 'Horas Devidas': 'Horas Devidas' },
    ...dadosConsolidadoGeral
];

const wsConsolidado = XLSX.utils.json_to_sheet(dadosConsolidadoComCabecalho, { skipHeader: true });

wsConsolidado['!cols'] = [
    { wch: 15 }, // Matrícula
    { wch: 40 }, // Empregado
    { wch: 18 }, // Horas Trabalhadas
    { wch: 18 }, // Horas Extras 50%
    { wch: 18 }, // Horas Extras 100%
    { wch: 18 }, // Adicional Noturno
    { wch: 18 }, // Horas Faltantes
    { wch: 18 }  // Horas Devidas
];

XLSX.utils.book_append_sheet(wb, wsConsolidado, "Consolidado Geral");

    // 4. Salvar arquivo
    XLSX.writeFile(wb, `Folha_Ponto_${state.empresaSelecionada.codigo_empresa}_${compFormatada}.xlsx`);
}

// --- EXPORTAÇÃO TXT ---
function abrirModalExportacaoTXT() {
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
}

function fecharModalExportacaoTXT() {
    document.getElementById('exportTxtModal').classList.remove('active');
}

async function buscarEmpresasParaExportacao() {
    const comp = document.getElementById('exportCompetencia').value;
    if (!validarCompetencia(comp)) {
        mostrarMensagem('Erro', 'Competência inválida.');
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('rh_saves')
            .select('empresa_codigo')
            .eq('competencia', comp);
        if (error) throw error;
        const codigosUnicos = [...new Set(data.map(item => item.empresa_codigo))];
        if (codigosUnicos.length === 0) {
            mostrarMensagem('Aviso', 'Nenhum dado processado encontrado para esta competência.');
            return;
        }
        const empresasFiltradas = state.empresas.filter(emp => codigosUnicos.includes(emp.codigo_empresa));
        renderizarListaEmpresasExportacao(empresasFiltradas);
    } catch (erro) {
        console.error('Erro ao buscar empresas:', erro);
        mostrarMensagem('Erro', 'Falha ao buscar empresas com dados processados.');
    }
}

function renderizarListaEmpresasExportacao(empresas) {
    const container = document.getElementById('exportEmpresasList');
    container.innerHTML = '';
    empresas.forEach(emp => {
        container.innerHTML += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid #eee;">
                <input type="checkbox" id="exp_emp_${emp.codigo_empresa}" value="${emp.codigo_empresa}" checked>
                <label for="exp_emp_${emp.codigo_empresa}" style="font-size: 13px; cursor: pointer; margin: 0;">${emp.codigo_empresa} - ${emp.nome_empresa}</label>
            </div>
        `;
    });
    document.getElementById('exportEmpresasContainer').style.display = 'block';
    document.getElementById('btnGerarTXT').style.display = 'block';
}

async function gerarArquivoTXT() {
    const comp = document.getElementById('exportCompetencia').value;
    const tipoProcesso = document.getElementById('exportTipoProcesso').value;
    const checkboxes = document.querySelectorAll('#exportEmpresasList input[type="checkbox"]:checked');
    const empresasSelecionadas = Array.from(checkboxes).map(cb => cb.value);
    if (empresasSelecionadas.length === 0) {
        mostrarMensagem('Erro', 'Selecione pelo menos uma empresa.');
        return;
    }
    try {
        const { data: savesData, error: errSaves } = await supabaseClient
            .from('rh_saves')
            .select('*')
            .in('empresa_codigo', empresasSelecionadas)
            .eq('competencia', comp)
            .order('data_criacao', { ascending: false });
        if (errSaves) throw errSaves;
        const ultimasVersoes = {};
        savesData.forEach(reg => {
            const chave = `${reg.empresa_codigo}_${reg.nome_trabalhador}`;
            if (!ultimasVersoes[chave]) ultimasVersoes[chave] = reg;
        });
        const { data: empregadosData, error: errEmpregados } = await supabaseClient
            .from('rh_empregados')
            .select('codigo_empresa, codigo_empregado, nome_empregado')
            .in('codigo_empresa', empresasSelecionadas);
        if (errEmpregados) throw errEmpregados;
        let conteudoTXT = '';
        const fixo = "10";
        const compParts = comp.split('/');
        const compFormatada = compParts[1] + compParts[0];
        const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');
        Object.values(ultimasVersoes).forEach(save => {
            const empCodigo = save.empresa_codigo;
            const nomeTrab = save.nome_trabalhador;
            const empregadoInfo = empregadosData.find(e => e.codigo_empresa === empCodigo && e.nome_empregado === nomeTrab);
            if (!empregadoInfo) return;
            const codEmpregadoFormatado = String(empregadoInfo.codigo_empregado).padStart(10, '0');
            const codEmpresaFormatada = String(empCodigo).padStart(10, '0');
            const folhaTemp = { nome: nomeTrab, empregadoId: empregadoInfo.codigo_empregado, dados: JSON.parse(save.dados_json) };
            const stateTemp = { jornada: save.jornada, ruleExtra100Optional: save.rule_extra_100_opcional, feriados: JSON.parse(save.feriados_json) };
            const jornadaMinutos = converterHoraParaMinutos(stateTemp.jornada);
            let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0;
            folhaTemp.dados.forEach(dia => {
                const isFeriado = stateTemp.feriados.some(f => f.data === dia.data);
                const isDomingo = dia.diaSemana === 'Dom';
                const isDiaDescanso = isFeriado || isDomingo;
                const minTrab = calcularHorasTrabalhadas(dia.entrada1, dia.saida1) + calcularHorasTrabalhadas(dia.entrada2, dia.saida2);
                const minNot = calcularHorasNoturnas(dia.entrada1, dia.saida1, dia.entrada2, dia.saida2);
                let ex50 = 0, ex100 = 0, dev = 0;
                if (minTrab > 0) {
                    if (isDiaDescanso) {
                        ex100 = minTrab;
                    } else {
                        if (minTrab > jornadaMinutos) {
                            const minEx = minTrab - jornadaMinutos;
                            if (stateTemp.ruleExtra100Optional) {
                                if (minEx <= 120) ex50 = minEx;
                                else { ex50 = 120; ex100 = minEx - 120; }
                            } else {
                                ex50 = minEx;
                            }
                        } else if (minTrab < jornadaMinutos) {
                            dev = jornadaMinutos - minTrab;
                        }
                    }
                } else if (!isDiaDescanso) {
                    dev = jornadaMinutos;
                }
                tTrab += minTrab;
                tEx50 += ex50;
                tEx100 += ex100;
                tNot += minNot;
                tDev += dev;
            });
            const gerarLinha = (eventoNome, valorMinutos) => {
                if (valorMinutos <= 0) return;
                const horasDecimais = (valorMinutos / 60).toFixed(2);
                const valorLimpo = horasDecimais.replace('.', '');
                const valFormatado = String(valorLimpo).padStart(9, '0');
                conteudoTXT += `${fixo}${codEmpregadoFormatado}${compFormatada}0000000000${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
            };
            gerarLinha('horasTrabalhadas', tTrab);
            gerarLinha('horasExtras50', tEx50);
            gerarLinha('horasExtras100', tEx100);
            gerarLinha('horasNoturnaConvertida', tNot);
            gerarLinha('horasDevidas', tDev);
        });
        if (!conteudoTXT) {
            mostrarMensagem('Aviso', 'Nenhum dado gerado.');
            return;
        }
        const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Exportacao_Folha_${compFormatada}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalExportacaoTXT();
        mostrarMensagem('Sucesso', 'Arquivo TXT gerado e baixado com sucesso!');
    } catch (erro) {
        console.error('Erro ao gerar TXT:', erro);
        mostrarMensagem('Erro', 'Falha ao gerar o arquivo TXT: ' + erro.message);
    }
}

// --- NAVEGAÇÃO E UTILITÁRIOS ---
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    
    // ✅ NOVO: Exibir informações da empresa em todas as telas (exceto seleção)
    if (telaId !== 'selectionScreen' && state.empresaSelecionada) {
        const headerActions = document.getElementById('headerActions');
        if (headerActions) {
            // Remover informação anterior se existir
            const infoEmpresa = document.getElementById('empresaInfo');
            if (infoEmpresa) infoEmpresa.remove();
            
            // Adicionar nova informação
            const div = document.createElement('div');
            div.id = 'empresaInfo';
            div.style.cssText = `
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 10px 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 6px;
                color: white;
                font-size: 13px;
                font-weight: 500;
            `;
            div.innerHTML = `
                <span>🏢 ${state.empresaSelecionada.codigo_empresa} - ${state.empresaSelecionada.nome_empresa}</span>
                <span style="opacity: 0.7;">|</span>
                <span>📅 ${state.competencia}</span>
            `;
            headerActions.insertBefore(div, headerActions.firstChild);
        }
    }
}

function voltarParaEdicao() {
    mostrarTela('mainScreen');
}

function mostrarMensagem(titulo, mensagem) {
    document.getElementById('messageTitle').textContent = titulo;
    document.getElementById('messageText').textContent = mensagem;
    document.getElementById('messageModal').classList.add('active');
}

function fecharModalMensagem() {
    document.getElementById('messageModal').classList.remove('active');
}

let confirmCallback = null;
function mostrarConfirmacao(titulo, mensagem, callback) {
    document.getElementById('confirmTitle').textContent = titulo;
    document.getElementById('confirmMessage').textContent = mensagem;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.add('active');
}

function confirmarAcao() {
    document.getElementById('confirmModal').classList.remove('active');
    if (confirmCallback) confirmCallback();
}

function fecharModalConfirmacao() {
    document.getElementById('confirmModal').classList.remove('active');
    confirmCallback = null;
}

// --- FORMATADORES ---
function formatarCompetencia(valor) {
    let v = valor.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
    return v;
}

function formatarHora(valor) {
    let v = valor.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + ':' + v.substring(2, 4);
    return v;
}

function formatarData(valor) {
    let v = valor.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    if (v.length >= 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
    return v;
}

function validarCompetencia(competencia) {
    return /^(0[1-9]|1[0-2])\/\d{4}$/.test(competencia);
}

function validarHora(hora) {
    if (!hora) return true;
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(hora);
}

function validarData(data) {
    return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(data);
}

function converterHoraParaMinutos(hora) {
    if (!hora) return 0;
    const [h, m] = hora.split(':').map(Number);
    return (h * 60) + m;
}

function converterMinutosParaHora(minutos) {
    if (minutos === 0) return '00:00';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function gerarDiasDoMes(competencia) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const mesStr = String(mesInt).padStart(2, '0');
    const anoStr = String(anoInt);
    const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
        const data = new Date(anoInt, mesInt - 1, i);
        dias.push({
            data: `${String(i).padStart(2, '0')}/${mesStr}/${anoStr}`,
            diaSemana: diasSemana[data.getDay()],
            entrada1: '',
            saida1: '',
            entrada2: '',
            saida2: ''
        });
    }
    return dias;
}