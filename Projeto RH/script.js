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
    jornadaSexta: '04:00',
    jornadaSextaAtiva: false,
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
    terceiroTurno: false,
    resultados: []
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const now = new Date();
    const heroBadge = document.getElementById('heroBadgeMonth');
    if (heroBadge) heroBadge.textContent = meses[now.getMonth()] + ' / ' + now.getFullYear();

    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = 'none';

    document.getElementById('competencia').addEventListener('input', (e) => {
        e.target.value = formatarCompetencia(e.target.value);
    });
    document.getElementById('jornada').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
    document.getElementById('jornadaSexta').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
    document.getElementById('jornadaSabado').addEventListener('input', (e) => {
        e.target.value = formatarHora(e.target.value);
    });
    document.getElementById('novaDataFeriado').addEventListener('input', (e) => {
        e.target.value = formatarData(e.target.value);
    });
    await carregarEmpresas();
    carregarFeriadosPadrao();
    inicializarEventos();
    state.terceiroTurno = localStorage.getItem('rh_terceiro_turno') === 'true';
    document.getElementById('terceiroTurno').checked = state.terceiroTurno;
});

window.toggleJornadaSexta = function(ativa) {
    document.getElementById('jornadaSextaContainer').style.display = ativa ? 'block' : 'none';
};

window.toggleJornadaSabado = function(ativa) {
    document.getElementById('jornadaSabadoContainer').style.display = ativa ? 'block' : 'none';
    if (ativa) {
        document.getElementById('sabadoSempreExtra').checked = false;
    }
};

window.toggleSabadoSempreExtra = function(ativa) {
    if (ativa) {
        document.getElementById('jornadaSabadoAtiva').checked = false;
        document.getElementById('jornadaSabadoContainer').style.display = 'none';
    }
};

// --- CARREGAMENTO DE DADOS (SUPABASE) ---
async function carregarEmpresas() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state.empresas = data || [];
    } catch (erro) {
        console.error('Erro ao carregar empresas:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empresas do servidor.');
    }
}

function filtrarEmpresas(termo) {
    const box   = document.getElementById('buscaEmpresaResultados');
    const input = document.getElementById('buscaEmpresa');
    if (!box || !input) return;

    // Posiciona o dropdown alinhado ao input
    const rect = input.getBoundingClientRect();
    box.style.top    = (rect.bottom + 2) + 'px';
    box.style.left   = rect.left + 'px';
    box.style.width  = rect.width + 'px';

    const norm = termo.trim().toLowerCase();
    const lista = norm
        ? state.empresas.filter(e =>
            e.nome_empresa.toLowerCase().includes(norm) ||
            e.codigo_empresa.toLowerCase().includes(norm))
        : state.empresas;

    if (!lista.length) {
        box.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:13px;">Nenhuma empresa encontrada</div>';
        box.style.display = 'block';
        return;
    }

    box.innerHTML = lista.map(e => `
        <div onclick="selecionarEmpresa('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSexAtiva     = document.getElementById('jornadaSextaAtiva');
    const jSexCont      = document.getElementById('jornadaSextaContainer');
    const jSex          = document.getElementById('jornadaSexta');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sexAtiva = cfg['jornada_sexta_ativa']?.cod === '1';
        if (jSexAtiva) jSexAtiva.checked = sexAtiva;
        if (jSexCont)  jSexCont.style.display = sexAtiva ? 'block' : 'none';
        if (jSex)      jSex.value = cfg['jornada_sexta']?.cod || '04:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSexAtiva) jSexAtiva.checked = false;
        if (jSexCont)  jSexCont.style.display = 'none';
        if (jSex)      jSex.value       = '04:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
    }
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
}

document.addEventListener('click', e => {
    const box   = document.getElementById('buscaEmpresaResultados');
    const input = document.getElementById('buscaEmpresa');
    if (box && input && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
    }
    const cfgBox   = document.getElementById('cfgBuscaEmpresaResultados');
    const cfgInput = document.getElementById('cfgBuscaEmpresa');
    if (cfgBox && cfgInput && !cfgBox.contains(e.target) && e.target !== cfgInput) {
        cfgBox.style.display = 'none';
    }
});

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
function alternarTerceiroTurno(checked) {
    state.terceiroTurno = checked;
    localStorage.setItem('rh_terceiro_turno', checked);
    renderizarConteudoAba();
}

function inicializarEventos() {
    document.getElementById('selectionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const comp = document.getElementById('competencia').value;
        const codEmp = document.getElementById('codigoEmpresa').value;
        if (!validarCompetencia(comp)) {
            mostrarMensagem('Erro', 'Competência inválida. Use o formato MM/AAAA.');
            return;
        }
        if (!codEmp) {
            mostrarMensagem('Erro', 'Selecione uma empresa antes de continuar.');
            document.getElementById('buscaEmpresa').focus();
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

    document.getElementById('importarExcelInput').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importarExcel(e.target.files[0]);
            e.target.value = '';
        }
    });
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
            state.jornadaSexta = registrosParaCarregar[0].jornada_sexta || '04:00';
            state.jornadaSextaAtiva = registrosParaCarregar[0].jornada_sexta_ativa || false;
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.sabadoSempreExtra = registrosParaCarregar[0].sabado_sempre_extra || false;
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
            document.getElementById('jornadaSexta').value = state.jornadaSexta;
            document.getElementById('jornadaSextaAtiva').checked = state.jornadaSextaAtiva;
            document.getElementById('jornadaSextaContainer').style.display = state.jornadaSextaAtiva ? 'block' : 'none';
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('sabadoSempreExtra').checked = state.sabadoSempreExtra;
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
            state.jornadaSexta = registrosParaCarregar[0].jornada_sexta || '04:00';
            state.jornadaSextaAtiva = registrosParaCarregar[0].jornada_sexta_ativa || false;
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.sabadoSempreExtra = registrosParaCarregar[0].sabado_sempre_extra || false;
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
            document.getElementById('jornadaSexta').value = state.jornadaSexta;
            document.getElementById('jornadaSextaAtiva').checked = state.jornadaSextaAtiva;
            document.getElementById('jornadaSextaContainer').style.display = state.jornadaSextaAtiva ? 'block' : 'none';
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('sabadoSempreExtra').checked = state.sabadoSempreExtra;
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
                        ${state.terceiroTurno ? '<th>Entrada 3</th><th>Saída 3</th>' : ''}
                        <th>DSR</th>
                        <th>Folga/Falta</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    folha.dados.forEach((dia, diaIndex) => {
        const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
        const isDSR = folha.dsrDias.includes(dia.data);
        const rowClass = (isFeriado || isDSR) ? 'holiday-row' : '';
        const infoExtra = isFeriado ? `<span style="color: var(--danger-color); font-size: 11px; display: block;">Feriado</span>` : '';
        
        const temEntrada = dia.entrada1 || dia.entrada2 || (state.terceiroTurno && dia.entrada3);
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
                ${state.terceiroTurno ? `
                <td><input type="text" class="time-input" value="${dia.entrada3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada3', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida3', this.value)" placeholder="00:00" maxlength="5"></td>` : ''}
                <td style="text-align: center;">
                    <input type="checkbox" ${isDSR ? 'checked' : ''} onchange="atualizarDSRDia(${state.abaAtivaIndex}, '${dia.data}', this.checked)" style="cursor: pointer; width: 18px; height: 18px;">
                </td>
                <td style="text-align: center;">
                    <select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
                        <option value="">-</option>
                        ${!temEntrada ? `<option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>` : ''}
                        ${!temEntrada ? `<option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>` : ''}
                        ${!temEntrada ? `<option value="compensacao" ${flagFolga === 'compensacao' ? 'selected' : ''}>Compensação</option>` : ''}
                        <option value="atestado" ${flagFolga === 'atestado' ? 'selected' : ''}>Atestado Médico</option>
                        <option value="atestado_comparecimento" ${flagFolga === 'atestado_comparecimento' ? 'selected' : ''}>Atestado de Comparecimento</option>
                        <option value="liberacao_meio_expediente" ${flagFolga === 'liberacao_meio_expediente' ? 'selected' : ''}>Liberação Meio Expediente</option>
                    </select>
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
    state.folhas[folhaIndex].dados[diaIndex].entrada3 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida3 = '';
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
    state.jornadaSextaAtiva = document.getElementById('jornadaSextaAtiva').checked;
    state.jornadaSexta = document.getElementById('jornadaSexta').value;
    state.jornadaSabadoAtiva = document.getElementById('jornadaSabadoAtiva').checked;
    state.sabadoSempreExtra = document.getElementById('sabadoSempreExtra').checked;
    state.jornadaSabado = document.getElementById('jornadaSabado').value;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
    if (!validarHora(state.jornada)) {
        mostrarMensagem('Erro', 'Jornada de trabalho inválida.');
        return;
    }
    if (state.jornadaSextaAtiva && !validarHora(state.jornadaSexta)) {
        mostrarMensagem('Erro', 'Jornada da Sexta inválida.');
        return;
    }
    if (state.jornadaSabadoAtiva && !validarHora(state.jornadaSabado)) {
        mostrarMensagem('Erro', 'Jornada do Sábado inválida.');
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
                jornada_sexta: state.jornadaSextaAtiva ? state.jornadaSexta : null,
                jornada_sexta_ativa: state.jornadaSextaAtiva,
                jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                jornada_sabado_ativa: state.jornadaSabadoAtiva,
                sabado_sempre_extra: state.sabadoSempreExtra,
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
    const jornadaSextaMinutos = (state.jornadaSextaAtiva && state.jornadaSexta)
        ? converterHoraParaMinutos(state.jornadaSexta)
        : jornadaMinutos;
    const jornadaSabadoMinutos = (state.jornadaSabadoAtiva && state.jornadaSabado)
        ? converterHoraParaMinutos(state.jornadaSabado)
        : jornadaMinutos;
    let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0, totalFaltas = 0;

    const diasCalculados = folha.dados.map(dia => {
        const jornadaEfetiva = dia.diaSemana === 'Sab'
            ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
            : dia.diaSemana === 'Sex'
                ? jornadaSextaMinutos
                : jornadaMinutos;
        const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
        const isDSRCustomizado = folha.dsrDias.includes(dia.data);
        const isDiaDescanso = isFeriado || isDSRCustomizado;
        
        const [[e1n, s1n], [e2n, s2n], [e3n, s3n]] = normalizarEntradasSaidas(
            dia.entrada1, dia.saida1, dia.entrada2, dia.saida2,
            dia.entrada3, dia.saida3, state.terceiroTurno
        );
        const minTrabalhados = calcularHorasTrabalhadas(e1n, s1n)
            + calcularHorasTrabalhadas(e2n, s2n)
            + (state.terceiroTurno ? calcularHorasTrabalhadas(e3n, s3n) : 0);
        const minNoturnos = calcularHorasNoturnas(
            e1n, s1n,
            e2n, s2n,
            state.terceiroTurno ? e3n : null,
            state.terceiroTurno ? s3n : null
        );
        const minNoturnosConvertidos = Math.round(minNoturnos / 0.875);
        
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false, flagAtestado = false, flagAtestadoComparecimento = false, flagLiberacaoMeioExpediente = false, flagSemRegistro = false, flagCompensacao = false;

        const flagFolgaData = folha.flagsFolga[dia.data];
        const isAtestadoMedico = flagFolgaData === 'atestado';
        const isAtestadoComp   = flagFolgaData === 'atestado_comparecimento';
        const isLiberacaoMeioExpediente = flagFolgaData === 'liberacao_meio_expediente';
        const isAtestado = isAtestadoMedico || isAtestadoComp || isLiberacaoMeioExpediente;
        if (isAtestadoMedico) flagAtestado = true;
        if (isAtestadoComp)   flagAtestadoComparecimento = true;
        if (isLiberacaoMeioExpediente) flagLiberacaoMeioExpediente = true;

        if (isAtestadoMedico) {
            // dia totalmente desconsiderado
        } else if (isAtestadoComp || isLiberacaoMeioExpediente) {
            // isenção de metade da jornada: só conta faltante abaixo de jornada/2
            const metadeJornada = Math.floor(jornadaEfetiva / 2);
            const horasRef = minTrabalhados;
            if (horasRef < metadeJornada) {
                faltante = metadeJornada - horasRef;
            }
            totalTrabalhado += minTrabalhados;
        } else if (minTrabalhados > 0) {
            if (isDiaDescanso) {
                // DSR/Feriado: todas as horas trabalhadas são 100% extra.
                // O adicional noturno é acumulado separadamente em totalNoturnoConvertido.
                extra100 = minTrabalhados;
                flagDSR = true;
            } else {
                const horasReferencia = minTrabalhados;
                
                if (horasReferencia > jornadaEfetiva) {
                    let minutosExtras = horasReferencia - jornadaEfetiva;
                    
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
                } else if (horasReferencia < jornadaEfetiva) {
                    // ✅ Faltante: Jornada - Horas de Referência
                    faltante = jornadaEfetiva - horasReferencia;
                    if (faltante < 0) faltante = 0;
                }
            }
        } else if (!isDiaDescanso) {
            // atestados e liberação já tratados acima; aqui só dias sem horas e sem atestado
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                flagFalta = true;
                totalFaltas += 1;
            } else if (flagFolgaData === 'compensacao') {
                flagCompensacao = true;
                faltante = jornadaEfetiva;
            } else if (!isAtestado) {
                flagSemRegistro = true;
            }
        }
        
        // ✅ Garantir que extras nunca sejam menores que 0
        extra50 = Math.max(0, extra50);
        extra100 = Math.max(0, extra100);
        faltante = Math.max(0, faltante);
        
        totalTrabalhado += isAtestadoMedico ? 0 : minTrabalhados;
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
            entrada3: dia.entrada3 || '',
            saida3: dia.saida3 || '',
            trabalhado: converterMinutosParaHora(minTrabalhados),
            normais: converterMinutosParaHora(Math.max(0, minTrabalhados - extra50 - extra100)),
            extra50: converterMinutosParaHora(extra50),
            extra100: converterMinutosParaHora(extra100),
            noturno: converterMinutosParaHora(minNoturnos),
            noturnoConvertido: converterMinutosParaHora(minNoturnosConvertidos),
            faltante: converterMinutosParaHora(faltante),
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta,
            flagAtestado: flagAtestado,
            flagAtestadoComparecimento: flagAtestadoComparecimento,
            flagLiberacaoMeioExpediente: flagLiberacaoMeioExpediente,
            flagSemRegistro: flagSemRegistro,
            flagCompensacao: flagCompensacao
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
            normais: converterMinutosParaHora(Math.max(0, totalTrabalhado - totalExtra50Original - totalExtra100Original)),
            extra50: converterMinutosParaHora(totalExtra50Original),
            extra100: converterMinutosParaHora(totalExtra100Original),
            noturno: converterMinutosParaHora(totalNoturno),
            noturnoConvertido: converterMinutosParaHora(totalNoturnoConvertido),
            faltante: converterMinutosParaHora(totalFaltante),
            faltas: totalFaltas,
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

function calcularHorasNoturnas(e1, s1, e2, s2, e3, s3) {
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
    minNoturnos += calcularNoturnoIntervalo(e3, s3);
    return minNoturnos;
}

// ✅ Quando a saída de um turno e a entrada do turno seguinte estão ambas em
// branco (mas o turno atual tem entrada e o seguinte tem saída), o empregado
// trabalhou de forma ininterrupta entre os dois — sem isso, calcularHorasTrabalhadas
// e calcularHorasNoturnas descartavam o intervalo inteiro por faltar a metade de cada par.
function normalizarEntradasSaidas(entrada1, saida1, entrada2, saida2, entrada3, saida3, terceiroTurno) {
    const pares = [[entrada1 || '', saida1 || ''], [entrada2 || '', saida2 || '']];
    if (terceiroTurno) pares.push([entrada3 || '', saida3 || '']);

    const normalizados = [];
    let i = 0;
    while (i < pares.length) {
        const [entrada, saida] = pares[i];
        const proximo = pares[i + 1];
        if (entrada && !saida && proximo && !proximo[0] && proximo[1]) {
            normalizados.push([entrada, proximo[1]]);
            i += 2;
        } else {
            normalizados.push([entrada, saida]);
            i += 1;
        }
    }
    while (normalizados.length < 3) normalizados.push(['', '']);
    return normalizados;
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
                    <div style="background: #f0fdf4; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Normais</div>
                        <div style="font-size: 24px; font-weight: 800; color: #166534; margin-top: 8px;">${res.totais.normais}</div>
                    </div>
                    <div style="background: white; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Adic. Noturno</div>
                        <div style="font-size: 24px; font-weight: 800; color: #1f2937; margin-top: 8px;">${res.totais.noturnoConvertido}</div>
                    </div>
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Faltantes</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltante}</div>
                    </div>
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Faltas</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltas} ${res.totais.faltas === 1 ? 'dia' : 'dias'}</div>
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
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb;">H. Normais</th>
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
            const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
            const isDescanso = dia.isDiaDescanso;
            
            let rowStyle = index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;';
            if (isDescanso) rowStyle = 'background-color: #fef2f2; color: #991b1b;';
            
            const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2, dia.entrada3, dia.saida3].filter(v => v).join(' - ') || '-';
            
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
            if (dia.flagAtestado) {
                flags += '<span style="background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">ATESTADO</span>';
            }
            if (dia.flagAtestadoComparecimento) {
                flags += '<span style="background: #ede9fe; color: #5b21b6; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">AT. COMPARECIMENTO</span>';
            }
            if (dia.flagLiberacaoMeioExpediente) {
                flags += '<span style="background: #fce7f3; color: #9d174d; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">LIB. MEIO EXPEDIENTE</span>';
            }
            if (dia.flagCompensacao) {
                flags += '<span style="background: #ffedd5; color: #9a3412; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">COMPENSAÇÃO</span>';
            }
            if (dia.flagSemRegistro) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">SEM REGISTRO</span>';
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
                    <td style="padding: 10px 15px; text-align: center; font-weight: 600; color: ${isDescanso ? '#991b1b' : '#166534'};">${dia.normais !== '00:00' ? dia.normais : '-'}</td>
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
        'Horas Normais': res.totais.normais,
        'Horas Extras 50%': res.totais.extra50,
        'Horas Extras 100%': res.totais.extra100,
        'Adicional Noturno': res.totais.noturnoConvertido,
        'Horas Faltantes': res.totais.faltante,
        'Horas Devidas': res.totais.devidas
    });

    // Preparar dados da aba individual
    const dadosAbaIndividual = [
        { 'Data': infoCabecalho, 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'H. Normais': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' },
        { 'Data': '', 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'H. Normais': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' },
        { 'Data': 'Data', 'Dia da Semana': 'Dia da Semana', 'Entradas/Saídas': 'Entradas/Saídas', 'Trabalhado': 'Trabalhado', 'H. Normais': 'H. Normais', 'Extra 50%': 'Extra 50%', 'Extra 100%': 'Extra 100%', 'Noturno': 'Noturno', 'Faltante': 'Faltante', 'Flags': 'Flags' }
    ];

    // Adicionar dias
    res.dias.forEach(dia => {
        const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
        const tipoDia = isFeriado ? 'Feriado' : dia.diaSemana;
        const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2].filter(v => v).join(' - ') || '-';
        
        let flagsStr = '';
        if (dia.flagDSR) flagsStr += 'DSR ';
        if (dia.flagFolga) flagsStr += 'FOLGA ';
        if (dia.flagFalta) flagsStr += 'FALTA ';
        if (dia.flagAtestado) flagsStr += 'ATESTADO MÉDICO ';
        if (dia.flagAtestadoComparecimento) flagsStr += 'ATESTADO DE COMPARECIMENTO ';
        if (dia.flagLiberacaoMeioExpediente) flagsStr += 'LIBERAÇÃO MEIO EXPEDIENTE ';
        if (dia.flagSemRegistro) flagsStr += 'SEM REGISTRO ';
        if (isFeriado) flagsStr += 'FERIADO ';

dadosAbaIndividual.push({
    'Data': dia.data,
    'Dia da Semana': tipoDia,
    'Entradas/Saídas': marcacoes,
    'Trabalhado': dia.trabalhado !== '00:00' ? dia.trabalhado : '-',
    'H. Normais': dia.normais !== '00:00' ? dia.normais : '-',
    'Extra 50%': dia.extra50 !== '00:00' ? dia.extra50 : '-',
    'Extra 100%': dia.extra100 !== '00:00' ? dia.extra100 : '-',
    'Noturno': dia.noturnoConvertido !== '00:00' ? dia.noturnoConvertido : '-',
    'Faltante': dia.faltante !== '00:00' ? dia.faltante : '-',
    'Flags': flagsStr.trim()
});
    });

    // Adicionar totais no final da aba individual
    dadosAbaIndividual.push({ 'Data': '', 'Dia da Semana': '', 'Entradas/Saídas': '', 'Trabalhado': '', 'H. Normais': '', 'Extra 50%': '', 'Extra 100%': '', 'Noturno': '', 'Faltante': '', 'Flags': '' });
    dadosAbaIndividual.push({
        'Data': 'TOTAIS',
        'Dia da Semana': '',
        'Entradas/Saídas': '',
        'Trabalhado': res.totais.trabalhado,
        'H. Normais': res.totais.normais,
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
        { wch: 12 }, // H. Normais
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

// --- CONFIG RUBRICAS POR EMPRESA ---

const _CFG_EVENTOS = [
    { ev: 'horasTrab', sufRub: 'HorasTrab', defaultTipo: 'horas' },
    { ev: 'he50',      sufRub: 'HE50',      defaultTipo: 'horas' },
    { ev: 'he100',     sufRub: 'HE100',     defaultTipo: 'horas' },
    { ev: 'noturno',   sufRub: 'Noturno',   defaultTipo: 'horas' },
    { ev: 'atraso',    sufRub: 'Atraso',    defaultTipo: 'horas' },
    { ev: 'falta',     sufRub: 'Falta',     defaultTipo: 'dias'  },
];

let _cacheConfigRubricas = {};

async function _buscarConfigRubricas(codigoEmpresa) {
    if (!codigoEmpresa) return null;
    if (_cacheConfigRubricas[codigoEmpresa] !== undefined) return _cacheConfigRubricas[codigoEmpresa];
    try {
        const { data, error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .select('evento, codigo_rubrica, tipo_valor')
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        if (!data || data.length === 0) {
            _cacheConfigRubricas[codigoEmpresa] = null;
            return null;
        }
        const cfg = {};
        data.forEach(r => { cfg[r.evento] = { cod: r.codigo_rubrica, tipo: r.tipo_valor }; });
        _cacheConfigRubricas[codigoEmpresa] = cfg;
        return cfg;
    } catch (e) {
        console.error('Erro ao buscar config rubricas:', e);
        return null;
    }
}

function _aplicarConfigRubricasNoCampos(prefixo, cfg) {
    _CFG_EVENTOS.forEach(def => {
        const v = cfg ? (cfg[def.ev] || {}) : {};
        const rubEl  = document.getElementById(`${prefixo}Rub${def.sufRub}`);
        const tipoEl = document.getElementById(`${prefixo}Tipo${def.sufRub}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
}

function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSexAtiva     = document.getElementById('cfgJornadaSextaAtiva');
    const jSexCont      = document.getElementById('cfgJornadaSextaContainer');
    const jSex          = document.getElementById('cfgJornadaSexta');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sexAtiva = cfg['jornada_sexta_ativa']?.cod === '1';
    if (jSexAtiva) jSexAtiva.checked = sexAtiva;
    if (jSexCont)  jSexCont.style.display = sexAtiva ? 'flex' : 'none';
    if (jSex)      jSex.value = cfg['jornada_sexta']?.cod || '04:00';
    const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
    const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
}

function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSexAtiva     = document.getElementById('cfgJornadaSextaAtiva');
    const jSexCont      = document.getElementById('cfgJornadaSextaContainer');
    const jSex          = document.getElementById('cfgJornadaSexta');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSexAtiva) jSexAtiva.checked = false;
    if (jSexCont)  jSexCont.style.display = 'none';
    if (jSex)      jSex.value       = '04:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
}

function abrirModalConfigRubricas() {
    document.getElementById('cfgCodigoEmpresa').value = '';
    document.getElementById('cfgBuscaEmpresa').value = '';
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
    _limparCamposConfigRubricas();
    document.getElementById('configRubricasModal').classList.add('active');
}

function fecharModalConfigRubricas() {
    document.getElementById('configRubricasModal').classList.remove('active');
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
}

function filtrarEmpresasConfig(termo) {
    const box   = document.getElementById('cfgBuscaEmpresaResultados');
    const input = document.getElementById('cfgBuscaEmpresa');
    if (!box || !input) return;

    const rect = input.getBoundingClientRect();
    box.style.top   = (rect.bottom + 2) + 'px';
    box.style.left  = rect.left + 'px';
    box.style.width = rect.width + 'px';

    const norm = termo.trim().toLowerCase();
    const lista = norm
        ? state.empresas.filter(e =>
            e.nome_empresa.toLowerCase().includes(norm) ||
            e.codigo_empresa.toLowerCase().includes(norm))
        : state.empresas;

    if (!lista.length) {
        box.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:13px;">Nenhuma empresa encontrada</div>';
        box.style.display = 'block';
        return;
    }

    box.innerHTML = lista.map(e => `
        <div onclick="selecionarEmpresaConfig('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

async function selecionarEmpresaConfig(codigo, nome) {
    document.getElementById('cfgCodigoEmpresa').value = codigo;
    document.getElementById('cfgBuscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('cfgBuscaEmpresaResultados').style.display = 'none';
    const cfg = await _buscarConfigRubricas(codigo);
    _preencherCamposConfigRubricas(cfg);
}

async function salvarConfigRubricas() {
    const codigoEmpresa = (document.getElementById('cfgCodigoEmpresa')?.value || '').trim();
    if (!codigoEmpresa) { mostrarMensagem('Aviso', 'Selecione uma empresa antes de salvar.'); return; }

    const rows = _CFG_EVENTOS.map(def => ({
        codigo_empresa: codigoEmpresa,
        evento:         def.ev,
        codigo_rubrica: (document.getElementById(`cfgRub_${def.ev}`)?.value || '').trim(),
        tipo_valor:     document.getElementById(`cfgTipo_${def.ev}`)?.value || def.defaultTipo,
    }));

    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSextaAtiva')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta',        codigo_rubrica: (document.getElementById('cfgJornadaSexta')?.value || '04:00').trim(),       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
    ];

    try {
        const { error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .upsert([...rows, ...jornadaRows], { onConflict: 'codigo_empresa,evento' });
        if (error) throw error;
        delete _cacheConfigRubricas[codigoEmpresa];
        fecharModalConfigRubricas();
        mostrarMensagem('Sucesso', '✅ Configuração de rubricas salva com sucesso!');
    } catch (e) {
        mostrarMensagem('Erro', 'Erro ao salvar configuração: ' + e.message);
    }
}

async function limparConfigRubricas() {
    const codigoEmpresa = (document.getElementById('cfgCodigoEmpresa')?.value || '').trim();
    if (!codigoEmpresa) { mostrarMensagem('Aviso', 'Selecione uma empresa.'); return; }
    if (!confirm(`Remover todas as configurações de rubricas da empresa ${codigoEmpresa}?`)) return;

    try {
        const { error } = await supabaseClient
            .from('rh_config_rubricas_txt')
            .delete()
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        delete _cacheConfigRubricas[codigoEmpresa];
        fecharModalConfigRubricas();
        mostrarMensagem('Sucesso', '✅ Configuração removida com sucesso!');
    } catch (e) {
        mostrarMensagem('Erro', 'Erro ao limpar configuração: ' + e.message);
    }
}

// --- EXPORTAÇÃO TXT ---

const TXT_RUBRICAS_KEY = 'rh_txt_rubricas';

function _carregarConfigNoCampos(prefixo, c) {
    const f = id => document.getElementById(id);
    const setVal = (id, val) => { const el = f(id); if (el) el.value = val || ''; };
    const setOpt = (id, val, def) => { const el = f(id); if (el) el.value = val || def; };
    setVal(`${prefixo}RubHorasTrab`,  c.rubHorasTrab);
    setOpt(`${prefixo}TipoHorasTrab`, c.tipoHorasTrab, 'horas');
    setVal(`${prefixo}RubHE50`,    c.rubHE50);
    setOpt(`${prefixo}TipoHE50`,   c.tipoHE50,   'horas');
    setVal(`${prefixo}RubHE100`,   c.rubHE100);
    setOpt(`${prefixo}TipoHE100`,  c.tipoHE100,  'horas');
    setVal(`${prefixo}RubNoturno`, c.rubNoturno);
    setOpt(`${prefixo}TipoNoturno`,c.tipoNoturno,'horas');
    setVal(`${prefixo}RubAtraso`,  c.rubAtraso);
    setOpt(`${prefixo}TipoAtraso`, c.tipoAtraso, 'horas');
    setVal(`${prefixo}RubFalta`,   c.rubFalta);
    setOpt(`${prefixo}TipoFalta`,  c.tipoFalta,  'dias');
}

function _lerCamposConfig(prefixo, radioName) {
    const g = id => (document.getElementById(id) || {}).value || '';
    return {
        tipoProcesso:   document.querySelector(`input[name="${radioName}"]:checked`)?.value || '11',
        rubHorasTrab:   g(`${prefixo}RubHorasTrab`).trim(),
        tipoHorasTrab:  g(`${prefixo}TipoHorasTrab`) || 'horas',
        rubHE50:    g(`${prefixo}RubHE50`).trim(),
        tipoHE50:   g(`${prefixo}TipoHE50`)   || 'horas',
        rubHE100:   g(`${prefixo}RubHE100`).trim(),
        tipoHE100:  g(`${prefixo}TipoHE100`)  || 'horas',
        rubNoturno: g(`${prefixo}RubNoturno`).trim(),
        tipoNoturno:g(`${prefixo}TipoNoturno`)|| 'horas',
        rubAtraso:  g(`${prefixo}RubAtraso`).trim(),
        tipoAtraso: g(`${prefixo}TipoAtraso`) || 'horas',
        rubFalta:   g(`${prefixo}RubFalta`).trim(),
        tipoFalta:  g(`${prefixo}TipoFalta`)  || 'dias',
    };
}

function _encMinutosParaTipo(mins, tipo) {
    if (mins <= 0) return 0;
    if (tipo === 'horas') {
        const hhmm = converterMinutosParaHora(mins); // "HH:MM"
        const [h, m] = hhmm.split(':').map(Number);
        return h * 100 + m; // HHMM: "01:30" → 130
    }
    if (tipo === 'dias') return Math.round(mins / 60);
    return 0;
}
function _encDias(count) {
    return count > 0 ? Math.round(count) : 0;
}
function _linhasFaltas(diasFalta) {
    // diasFalta: array de objetos { data: 'DD/MM/AAAA', flagDSR: bool }
    return diasFalta.map(dia => {
        const p = dia.data.split('/');
        const dataFmt = p[2] + p[1] + p[0]; // AAAAMMDD
        const tipo = dia.flagDSR ? '2' : '1';
        return `11${dataFmt}${tipo}\n`;
    }).join('');
}

function _toggleNaoCompensar(prefix) {
    const checked = document.getElementById(prefix + 'NaoCompensar')?.checked ?? false;
    const label = document.getElementById(prefix + 'LabelAtraso');
    if (label) label.textContent = checked ? 'Horas Faltantes' : 'Atraso';
}

function _linhasTxt(config, codEmp, compFmt, codEmpresa, mins_trab, mins_he50, mins_he100, mins_not, mins_atr, dias_falta) {
    const tp = String(config.tipoProcesso).padStart(2, '0');
    const empFmt = String(codEmp).padStart(10, '0');
    const empFmt2 = String(codEmpresa).padStart(10, '0');
    const base = `10${empFmt}${compFmt}`;
    const rub = r => String(r).replace(/\D/g, '').padStart(9, '0');
    const linha = (rubrica, valorInt) => {
        if (!rubrica || valorInt <= 0) return '';
        return `${base}${rub(rubrica)}${tp}${String(valorInt).padStart(9,'0')}${empFmt2}\n`;
    };
    return [
        linha(config.rubHorasTrab, _encMinutosParaTipo(mins_trab,  config.tipoHorasTrab)),
        linha(config.rubHE50,      _encMinutosParaTipo(mins_he50,  config.tipoHE50)),
        linha(config.rubHE100,     _encMinutosParaTipo(mins_he100, config.tipoHE100)),
        linha(config.rubNoturno,   _encMinutosParaTipo(mins_not,   config.tipoNoturno)),
        linha(config.rubAtraso,    _encMinutosParaTipo(mins_atr,   config.tipoAtraso)),
        linha(config.rubFalta,     config.tipoFalta === 'dias' ? _encDias(dias_falta) : _encMinutosParaTipo(dias_falta * 480, config.tipoFalta)),
    ].join('');
}

async function abrirModalExportacaoTXT() {
    document.getElementById('expNaoCompensar').checked = false;
    document.getElementById('expLabelAtraso').textContent = 'Atraso';
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    _aplicarConfigRubricasNoCampos('exp', cfg);
}

function fecharModalExportacaoTXT() {
    document.getElementById('exportTxtModal').classList.remove('active');
}

async function buscarEmpresasParaExportacao() {
    const comp = document.getElementById('exportCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Erro', 'Competência inválida.'); return; }
    try {
        const { data, error } = await supabaseClient.from('rh_saves').select('empresa_codigo').eq('competencia', comp);
        if (error) throw error;
        const codigosUnicos = [...new Set(data.map(item => item.empresa_codigo))];
        if (codigosUnicos.length === 0) { mostrarMensagem('Aviso', 'Nenhum dado processado encontrado para esta competência.'); return; }
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
    document.getElementById('btnPreviewTXT').style.display = 'inline-flex';
    document.getElementById('btnGerarTXT').style.display = 'block';
}

async function _construirConteudoTXTExportacao() {
    const comp = document.getElementById('exportCompetencia').value;
    if (!validarCompetencia(comp)) throw new Error('Competência inválida.');
    const config = _lerCamposConfig('exp', 'exportTipoProcesso');
    const checkboxes = document.querySelectorAll('#exportEmpresasList input[type="checkbox"]:checked');
    const empresasSelecionadas = Array.from(checkboxes).map(cb => cb.value);
    if (empresasSelecionadas.length === 0) throw new Error('Selecione pelo menos uma empresa.');

    const { data: savesData, error: errSaves } = await supabaseClient
        .from('rh_saves').select('*')
        .in('empresa_codigo', empresasSelecionadas).eq('competencia', comp)
        .order('data_criacao', { ascending: false });
    if (errSaves) throw errSaves;

    const ultimasVersoes = {};
    savesData.forEach(reg => {
        const chave = `${reg.empresa_codigo}_${reg.nome_trabalhador}`;
        if (!ultimasVersoes[chave]) ultimasVersoes[chave] = reg;
    });

    const { data: empregadosData, error: errEmpregados } = await supabaseClient
        .from('rh_empregados').select('codigo_empresa, codigo_empregado, nome_empregado')
        .in('codigo_empresa', empresasSelecionadas);
    if (errEmpregados) throw errEmpregados;

    const compParts = comp.split('/');
    const compFmt = compParts[1] + compParts[0]; // AAAAMM
    let conteudoTXT = '';
    const naoCompensar = document.getElementById('expNaoCompensar')?.checked ?? false;

    Object.values(ultimasVersoes).forEach(save => {
        const empCodigo = save.empresa_codigo;
        const nomeTrab  = save.nome_trabalhador;
        const empInfo   = empregadosData.find(e => e.codigo_empresa === empCodigo && e.nome_empregado === nomeTrab);
        if (!empInfo) return;

        const feriados   = JSON.parse(save.feriados_json || '[]');
        const dsrDias    = JSON.parse(save.dsr_dias    || '[]');
        const flagsFolga = JSON.parse(save.flags_folga || '{}');
        const jornadaMin = converterHoraParaMinutos(save.jornada || '08:00');
        const jornadaSextaMin = (save.jornada_sexta_ativa && save.jornada_sexta)
            ? converterHoraParaMinutos(save.jornada_sexta)
            : jornadaMin;
        const jornadaSabadoMin = (save.jornada_sabado_ativa && save.jornada_sabado)
            ? converterHoraParaMinutos(save.jornada_sabado)
            : jornadaMin;
        const sabadoSempreExtra = !!save.sabado_sempre_extra;
        const rule100    = save.rule_extra_100_opcional || false;
        const dados      = JSON.parse(save.dados_json || '[]');

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0;
        const diasFaltaDetalhes = [];
        dados.forEach(dia => {
            const jornadaMinEfetiva = dia.diaSemana === 'Sab'
                ? (sabadoSempreExtra ? 0 : jornadaSabadoMin)
                : dia.diaSemana === 'Sex'
                    ? jornadaSextaMin
                    : jornadaMin;
            const isFeriado    = feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
            const isDSR        = dsrDias.includes(dia.data);
            const isDiaDescanso = isFeriado || isDSR;
            const [[e1n, s1n], [e2n, s2n], [e3n, s3n]] = normalizarEntradasSaidas(
                dia.entrada1, dia.saida1, dia.entrada2, dia.saida2,
                dia.entrada3, dia.saida3, state.terceiroTurno
            );
            const minTrab = calcularHorasTrabalhadas(e1n, s1n)
                + calcularHorasTrabalhadas(e2n, s2n)
                + (state.terceiroTurno ? calcularHorasTrabalhadas(e3n, s3n) : 0);
            const minNot  = calcularHorasNoturnas(
                e1n, s1n,
                e2n, s2n,
                state.terceiroTurno ? e3n : null,
                state.terceiroTurno ? s3n : null
            );
            const minNotConv = Math.round(minNot / 0.875);
            let ex50 = 0, ex100 = 0, dev = 0;
            const flag = flagsFolga[dia.data];
            const isAtestadoMedicoExp = flag === 'atestado';
            const isAtestadoCompExp   = flag === 'atestado_comparecimento';
            const isLiberacaoMeioExpedienteExp = flag === 'liberacao_meio_expediente';
            if (isAtestadoMedicoExp) {
                // dia totalmente desconsiderado
            } else if (isAtestadoCompExp || isLiberacaoMeioExpedienteExp) {
                // isenção de metade da jornada
                const metade = Math.floor(jornadaMinEfetiva / 2);
                if (minTrab < metade) dev = metade - minTrab;
            } else if (minTrab > 0) {
                if (isDiaDescanso) {
                    ex100 = minTrab;
                } else {
                    if (minTrab > jornadaMinEfetiva) {
                        const extra = minTrab - jornadaMinEfetiva;
                        if (rule100) { ex50 = Math.min(extra, 120); ex100 = Math.max(0, extra - 120); }
                        else { ex50 = extra; }
                    } else {
                        dev = jornadaMinEfetiva - minTrab;
                    }
                }
            } else if (!isDiaDescanso) {
                if (flag === 'falta') {
                    tFaltaDias++;
                    diasFaltaDetalhes.push({ data: dia.data, flagDSR: isDSR });
                } else if (flag === 'compensacao') {
                    dev = jornadaMinEfetiva;
                }
                // folga, atestado, liberação meio expediente e sem registro não geram horas devidas nem faltas
            }
            tTrab  += minTrab;
            tEx50  += ex50;
            tEx100 += ex100;
            tNot   += minNotConv;
            tDev   += dev;
        });

        // Compensar devidas com extras
        if (!naoCompensar) {
            let devidasRestantes = tDev;
            if (devidasRestantes > 0) {
                const abate50  = Math.min(tEx50,  devidasRestantes); tEx50  -= abate50;  devidasRestantes -= abate50;
                const abate100 = Math.min(tEx100, devidasRestantes); tEx100 -= abate100; devidasRestantes -= abate100;
                tDev = Math.max(0, devidasRestantes);
            }
        }

        const tNorm = Math.max(0, tTrab - tEx50 - tEx100);
        conteudoTXT += _linhasTxt(
            config,
            empInfo.codigo_empregado,
            compFmt,
            empCodigo,
            tNorm,
            tEx50,
            tEx100,
            tNot,
            tDev,
            tFaltaDias
        );
        conteudoTXT += _linhasFaltas(diasFaltaDetalhes);
    });

    localStorage.setItem(TXT_RUBRICAS_KEY, JSON.stringify(_lerCamposConfig('exp', 'exportTipoProcesso')));
    return { conteudoTXT, compFmt, comp };
}

async function gerarPreviewTXTExportacao() {
    mostrarMensagem('Aguarde', 'Gerando prévia...');
    try {
        const { conteudoTXT } = await _construirConteudoTXTExportacao();
        fecharModalMensagem();
        _mostrarPrevia('expTxtPrevia', 'expTxtPreviaConteudo', 'expTxtPreviaInfo', '#exportTxtModal', conteudoTXT);
    } catch (erro) {
        fecharModalMensagem();
        mostrarMensagem('Erro', erro.message || 'Falha ao gerar prévia.');
    }
}

async function gerarArquivoTXT() {
    mostrarMensagem('Aguarde', 'Gerando arquivo TXT...');
    try {
        const { conteudoTXT, compFmt } = await _construirConteudoTXTExportacao();
        fecharModalMensagem();
        if (!conteudoTXT.trim()) { mostrarMensagem('Aviso', 'Nenhum valor positivo encontrado para as rubricas configuradas.'); return; }
        const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `Lancamentos_${compFmt}_${Date.now()}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalExportacaoTXT();
        mostrarMensagem('Sucesso', 'Arquivo TXT gerado e baixado com sucesso!');
    } catch (erro) {
        fecharModalMensagem();
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

    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = telaId === 'selectionScreen' ? 'none' : 'block';

    const sub = document.getElementById('pageHeaderSub');
    if (sub) {
        if (telaId !== 'selectionScreen' && state.empresaSelecionada) {
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}`;
        } else {
            sub.textContent = 'Selecione a competência e empresa para começar';
        }
    }

    const obsBanner = document.getElementById('empresaObservacoesBanner');
    if (obsBanner) {
        obsBanner.style.display = (telaId !== 'selectionScreen' && obsBanner.dataset.temObservacao === '1')
            ? 'flex'
            : 'none';
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
            saida2: '',
            entrada3: '',
            saida3: ''
        });
    }
    return dias;
}

// ===== MODELO EXCEL / IMPORTAÇÃO =====

function perguntarTurnosModelo() {
    const comp   = document.getElementById('competencia').value;
    const codEmp = document.getElementById('codigoEmpresa').value;
    if (!validarCompetencia(comp)) {
        mostrarMensagem('Aviso', 'Preencha a competência antes de baixar o modelo.');
        return;
    }
    if (!codEmp) {
        mostrarMensagem('Aviso', 'Selecione a empresa antes de baixar o modelo.');
        return;
    }
    document.getElementById('modeloTurnosModal').classList.add('active');
}

function fecharModalModeloTurnos() {
    document.getElementById('modeloTurnosModal').classList.remove('active');
}

async function gerarModeloExcel(comTerceiroTurno = false) {
    const comp   = document.getElementById('competencia').value;
    const codEmp = document.getElementById('codigoEmpresa').value;

    if (!validarCompetencia(comp)) {
        mostrarMensagem('Aviso', 'Preencha a competência antes de baixar o modelo.');
        return;
    }
    if (!codEmp) {
        mostrarMensagem('Aviso', 'Selecione a empresa antes de baixar o modelo.');
        return;
    }

    mostrarMensagem('Aguarde', 'Gerando modelo Excel...');

    try {
        const { data: empregados, error } = await supabaseClient
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codEmp)
            .order('nome_empregado', { ascending: true });

        if (error) throw error;
        if (!empregados || empregados.length === 0) {
            fecharModalMensagem();
            mostrarMensagem('Aviso', 'Esta empresa não possui empregados cadastrados.');
            return;
        }

        const diasDoMes = gerarDiasDoMes(comp);
        const wb = XLSX.utils.book_new();

        empregados.forEach(emp => {
            const nomeSheet = `${emp.codigo_empregado} ${emp.nome_empregado}`.substring(0, 31);
            const header = comTerceiroTurno
                ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
                : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
            const rows   = [header, ...diasDoMes.map(d => comTerceiroTurno
                ? [d.data, d.diaSemana, '', '', '', '', '', '']
                : [d.data, d.diaSemana, '', '', '', ''])];
            const ws     = XLSX.utils.aoa_to_sheet(rows);

            // Forçar coluna Data como texto para evitar auto-conversão do Excel
            for (let r = 1; r < rows.length; r++) {
                const addr = XLSX.utils.encode_cell({ r, c: 0 });
                ws[addr] = { t: 's', v: rows[r][0] };
            }

            ws['!cols'] = comTerceiroTurno
                ? [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
                : [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

            XLSX.utils.book_append_sheet(wb, ws, nomeSheet);
        });

        const [mm, aaaa] = comp.split('/');
        XLSX.writeFile(wb, `Modelo_FolhaPonto_${codEmp}_${mm}-${aaaa}.xlsx`);
        fecharModalMensagem();
    } catch (erro) {
        console.error('Erro ao gerar modelo:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar o modelo: ' + erro.message);
    }
}

async function importarExcel(file) {
    if (!file) return;
    mostrarMensagem('Importando', 'Processando o arquivo Excel...');

    try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

        const normalizeHora = (v) => {
            if (v === null || v === undefined || v === '') return '';
            if (typeof v === 'number') {
                // Serial de tempo do Excel: fração de 24h
                const total = Math.round(v * 24 * 60);
                const h = Math.floor(total / 60) % 24;
                const m = total % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            const s = String(v).trim();
            const match = s.match(/^(\d{1,2}):(\d{2})/);
            return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
        };

        let importados = 0;
        let detectouTerceiroTurno = false;
        const avisos = [];

        wb.SheetNames.forEach(sheetName => {
            const codEmp   = sheetName.split(' ')[0].trim();
            const empregado = state.empregadosDisponiveis.find(e => e.codigo_empregado === codEmp);

            if (!empregado) {
                avisos.push(`Aba "${sheetName}": código "${codEmp}" não encontrado na empresa.`);
                return;
            }

            let folhaIdx = state.folhas.findIndex(f => f.empregadoId === empregado.codigo_empregado);
            if (folhaIdx === -1) {
                state.folhas.push({
                    empregadoId: empregado.codigo_empregado,
                    nome: empregado.nome_empregado,
                    dados: gerarDiasDoMes(state.competencia),
                    dsrDias: [],
                    flagsFolga: {}
                });
                folhaIdx = state.folhas.length - 1;
            } else {
                state.folhas[folhaIdx].nome       = empregado.nome_empregado;
                state.folhas[folhaIdx].empregadoId = empregado.codigo_empregado;
            }

            const linhas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

            // Detecta 3º turno pelo cabeçalho: coluna 6 presente e não-vazia
            const cabecalho = linhas[0] || [];
            const abaTemTerceiroTurno = !!String(cabecalho[6] || '').trim();
            if (abaTemTerceiroTurno) detectouTerceiroTurno = true;

            for (let r = 1; r < linhas.length; r++) {
                const row = linhas[r];
                if (!row || !row[0]) continue;
                const dataStr = String(row[0]).trim();
                if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) continue;

                const diaIdx = state.folhas[folhaIdx].dados.findIndex(d => d.data === dataStr);
                if (diaIdx === -1) continue;

                state.folhas[folhaIdx].dados[diaIdx].entrada1 = normalizeHora(row[2]);
                state.folhas[folhaIdx].dados[diaIdx].saida1   = normalizeHora(row[3]);
                state.folhas[folhaIdx].dados[diaIdx].entrada2 = normalizeHora(row[4]);
                state.folhas[folhaIdx].dados[diaIdx].saida2   = normalizeHora(row[5]);
                if (abaTemTerceiroTurno) {
                    state.folhas[folhaIdx].dados[diaIdx].entrada3 = normalizeHora(row[6]);
                    state.folhas[folhaIdx].dados[diaIdx].saida3   = normalizeHora(row[7]);
                }
            }
            importados++;
        });

        // Ativa flag de 3º turno automaticamente se o arquivo trouxer esse modelo
        if (detectouTerceiroTurno && !state.terceiroTurno) {
            state.terceiroTurno = true;
            localStorage.setItem('rh_terceiro_turno', 'true');
            const cb = document.getElementById('terceiroTurno');
            if (cb) cb.checked = true;
        }

        state.abaAtivaIndex = 0;
        renderizarAbas();
        fecharModalMensagem();

        const msg = avisos.length > 0
            ? `${importados} folha(s) importada(s).\n\nAvisos:\n${avisos.join('\n')}`
            : `${importados} folha(s) importada(s) com sucesso.`;
        mostrarMensagem(avisos.length > 0 ? 'Importação concluída' : 'Sucesso', msg);
    } catch (erro) {
        console.error('Erro ao importar Excel:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao ler o arquivo: ' + erro.message);
    }
}

// ===== GERAÇÃO DE TXT A PARTIR DOS RESULTADOS =====

async function abrirModalTxtResultados() {
    if (!state.resultados || state.resultados.length === 0) {
        mostrarMensagem('Aviso', 'Não há dados processados para gerar o TXT.');
        return;
    }
    document.getElementById('resNaoCompensar').checked = false;
    document.getElementById('resLabelAtraso').textContent = 'Atraso';
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    _aplicarConfigRubricasNoCampos('res', cfg);
    document.getElementById('resTxtPrevia').style.display = 'none';
    const _laCont = document.getElementById('lancamentosAdicionaisContainer');
    if (_laCont) _laCont.innerHTML = '';
    const _laHdr = document.getElementById('lancamentosAdicionaisHeader');
    if (_laHdr) _laHdr.style.display = 'none';
    document.getElementById('txtRubricasModal').classList.add('active');
}

function fecharModalTxtResultados() {
    document.getElementById('txtRubricasModal').classList.remove('active');
}

// ===== LANÇAMENTOS ADICIONAIS =====

function _adicionarLancamentoAdicional() {
    const container = document.getElementById('lancamentosAdicionaisContainer');
    const header = document.getElementById('lancamentosAdicionaisHeader');

    const row = document.createElement('div');
    row.className = 'lanc-adicional-row';
    row.style.cssText = 'display:grid;grid-template-columns:2fr 0.9fr 1.1fr 0.9fr auto;gap:6px;align-items:center;background:#f8f9fa;padding:8px 10px;border-radius:6px;border:1px solid #e9ecef;margin-bottom:6px;';

    const sel = document.createElement('select');
    sel.className = 'lanc-empregado';
    sel.style.cssText = 'padding:5px 6px;border:1px solid #ced4da;border-radius:4px;font-size:12px;width:100%;';
    (state.resultados || []).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.empregadoId;
        opt.textContent = `${r.nome} (${r.empregadoId})`;
        sel.appendChild(opt);
    });

    const rubInput = document.createElement('input');
    rubInput.type = 'text';
    rubInput.className = 'lanc-rubrica';
    rubInput.maxLength = 9;
    rubInput.placeholder = 'Ex: 000610';
    rubInput.style.cssText = 'padding:5px 6px;border:1px solid #ced4da;border-radius:4px;font-size:12px;font-family:monospace;width:100%;box-sizing:border-box;';

    const tipoSel = document.createElement('select');
    tipoSel.className = 'lanc-tipo';
    tipoSel.style.cssText = 'padding:5px;border:1px solid #ced4da;border-radius:4px;font-size:12px;width:100%;';
    [['monetario','R$ (inteiro)'],['horas','Horas (HH:MM)'],['dias','Dias']].forEach(([v,t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        tipoSel.appendChild(o);
    });

    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'lanc-valor';
    valInput.maxLength = 9;
    valInput.placeholder = 'Ex: 500,00';
    valInput.style.cssText = 'padding:5px 6px;border:1px solid #ced4da;border-radius:4px;font-size:12px;font-family:monospace;width:100%;box-sizing:border-box;';

    tipoSel.onchange = function() {
        const placeholders = { monetario: 'Ex: 500,00', horas: 'Ex: 01:30', dias: 'Ex: 22' };
        valInput.placeholder = placeholders[this.value] || 'Valor';
    };

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remover';
    removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#dc3545;font-size:18px;padding:2px 6px;line-height:1;';
    removeBtn.onclick = function() {
        row.remove();
        if (!container.querySelector('.lanc-adicional-row') && header) header.style.display = 'none';
    };

    row.appendChild(sel);
    row.appendChild(rubInput);
    row.appendChild(tipoSel);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    container.appendChild(row);

    if (header) header.style.display = 'grid';
}

function _construirLinhasAdicionais(compFmt, codEmpresa, tipoProcesso) {
    const container = document.getElementById('lancamentosAdicionaisContainer');
    if (!container) return '';
    const rows = container.querySelectorAll('.lanc-adicional-row');
    if (!rows.length) return '';

    const empFmt2 = String(codEmpresa).padStart(10, '0');
    const tp = String(tipoProcesso).padStart(2, '0');
    const rub = r => String(r).replace(/\D/g, '').padStart(9, '0');
    let linhas = '';

    rows.forEach(row => {
        const codEmp  = (row.querySelector('.lanc-empregado')?.value || '').trim();
        const rubrica = (row.querySelector('.lanc-rubrica')?.value  || '').trim();
        const tipo    = row.querySelector('.lanc-tipo')?.value || 'monetario';
        const valorStr= (row.querySelector('.lanc-valor')?.value    || '').trim();

        if (!codEmp || !rubrica || !valorStr) return;

        let valorInt = 0;
        if (tipo === 'horas') {
            const parts = valorStr.match(/^(\d{1,3}):(\d{2})$/);
            valorInt = parts ? parseInt(parts[1]) * 100 + parseInt(parts[2]) : (parseInt(valorStr) || 0);
        } else if (tipo === 'monetario') {
            valorInt = parseInt(valorStr.replace(',', '')) || 0;
        } else {
            valorInt = parseInt(valorStr) || 0;
        }
        if (valorInt <= 0) return;

        const empFmt = String(codEmp).padStart(10, '0');
        linhas += `10${empFmt}${compFmt}${rub(rubrica)}${tp}${String(valorInt).padStart(9, '0')}${empFmt2}\n`;
    });

    return linhas;
}

function _construirConteudoTXTResultados(salvar = false) {
    const config = _lerCamposConfig('res', 'resTipoProcesso');
    if (![config.rubHorasTrab, config.rubHE50, config.rubHE100, config.rubNoturno, config.rubAtraso, config.rubFalta].some(r => r)) {
        throw new Error('Preencha ao menos uma rubrica para gerar o TXT.');
    }
    if (salvar) localStorage.setItem(TXT_RUBRICAS_KEY, JSON.stringify(config));

    const compParts = state.competencia.split('/');
    const compFmt = compParts[1] + compParts[0];
    const codEmpresa = state.empresaSelecionada.codigo_empresa;
    let conteudoTXT = '';

    const naoCompensar = document.getElementById('resNaoCompensar')?.checked ?? false;

    state.resultados.forEach(res => {
        let he50 = converterHoraParaMinutos(res.totais.extra50);
        let he100 = converterHoraParaMinutos(res.totais.extra100);
        let minsAtr;
        if (naoCompensar) {
            minsAtr = converterHoraParaMinutos(res.totais.faltante);
        } else {
            let devRest = converterHoraParaMinutos(res.totais.faltante);
            const abate50 = Math.min(he50, devRest); he50 -= abate50; devRest -= abate50;
            const abate100 = Math.min(he100, devRest); he100 -= abate100;
            minsAtr = converterHoraParaMinutos(res.totais.devidas);
        }
        const minsNorm = Math.max(0, converterHoraParaMinutos(res.totais.trabalhado) - he50 - he100);
        const diasFaltaRes = res.dias.filter(d => d.flagFalta);
        conteudoTXT += _linhasTxt(
            config,
            res.empregadoId,
            compFmt,
            codEmpresa,
            minsNorm,
            he50,
            he100,
            converterHoraParaMinutos(res.totais.noturnoConvertido),
            minsAtr,
            diasFaltaRes.length
        );
        conteudoTXT += _linhasFaltas(diasFaltaRes);
    });

    conteudoTXT += _construirLinhasAdicionais(compFmt, codEmpresa, config.tipoProcesso);

    return { conteudoTXT, compFmt };
}

function _mostrarPrevia(previaId, previaConteudoId, previaInfoId, modalBodySelector, conteudoTXT) {
    if (!conteudoTXT.trim()) {
        mostrarMensagem('Aviso', 'Nenhum valor positivo encontrado para as rubricas configuradas (todos os totais estão zerados).');
        return;
    }
    const linhas = conteudoTXT.trimEnd().split('\n');
    document.getElementById(previaConteudoId).textContent =
        linhas.slice(0, 20).join('\n') + (linhas.length > 20 ? `\n... (+${linhas.length - 20} linhas)` : '');
    document.getElementById(previaInfoId).textContent = `Total: ${linhas.length} linha(s)`;
    const previaEl = document.getElementById(previaId);
    previaEl.style.display = 'block';
    // scroll modal-body para mostrar a prévia
    const modalBody = document.querySelector(`${modalBodySelector} .modal-body`);
    if (modalBody) setTimeout(() => { modalBody.scrollTop = modalBody.scrollHeight; }, 50);
}

function gerarPreviewTXTResultados() {
    try {
        const { conteudoTXT } = _construirConteudoTXTResultados(false);
        _mostrarPrevia('resTxtPrevia', 'resTxtPreviaConteudo', 'resTxtPreviaInfo', '#txtRubricasModal', conteudoTXT);
    } catch (erro) {
        mostrarMensagem('Aviso', erro.message);
    }
}

function gerarTXTResultados() {
    try {
        const { conteudoTXT } = _construirConteudoTXTResultados(true);
        if (!conteudoTXT.trim()) { mostrarMensagem('Aviso', 'Nenhum valor positivo encontrado para as rubricas configuradas.'); return; }
        const [mm, aaaa] = state.competencia.split('/');
        const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `Lancamentos_${state.empresaSelecionada.codigo_empresa}_${mm}-${aaaa}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalTxtResultados();
        mostrarMensagem('Sucesso', 'Arquivo TXT gerado com sucesso!');
    } catch (erro) {
        mostrarMensagem('Aviso', erro.message);
    }
}