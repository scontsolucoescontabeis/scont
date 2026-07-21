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
    resultados: [],
    feriasCalculadas: {} // codigo_empregado -> [{ inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' }, ...]
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
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    await carregarEmpresas();
    await carregarFeriadosGlobais();
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
            .select('codigo_empresa, nome_empresa, status_situacao')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        // Só empresas ativas (mesmo critério da Administração: sem status = ativa por padrão)
        const isEmpresaAtiva = s => !s || String(s).trim().toLowerCase().startsWith('ativ');
        state.empresas = (data || []).filter(emp => isEmpresaAtiva(emp.status_situacao));
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

function _aplicarConfigEmpresaNaTelaEdicao(cfg) {
    const ruleExtra100El = document.getElementById('ruleExtra100Optional');
    const terceiroTurnoEl = document.getElementById('terceiroTurno');
    if (ruleExtra100El) ruleExtra100El.checked = cfg?.['rule_extra_100_opcional']?.cod === '1';
    if (terceiroTurnoEl) {
        const ativo = cfg?.['terceiro_turno']?.cod === '1';
        terceiroTurnoEl.checked = ativo;
        state.terceiroTurno = ativo;
    }
    const jDiaria       = document.getElementById('jornada');
    const jSexAtiva     = document.getElementById('jornadaSextaAtiva');
    const jSexCont      = document.getElementById('jornadaSextaContainer');
    const jSex          = document.getElementById('jornadaSexta');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
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
}

async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    _aplicarConfigEmpresaNaTelaEdicao(cfg);
    state.feriasCalculadas = await carregarFeriasCalculadas(codigo);
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
    atualizarBannerObservacoes();
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
    const grpBox   = document.getElementById('grpBuscaEmpresaResultados');
    const grpInput = document.getElementById('grpBuscaEmpresa');
    if (grpBox && grpInput && !grpBox.contains(e.target) && e.target !== grpInput) {
        grpBox.style.display = 'none';
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

// ✅ Mapa codigo_empregado -> períodos de férias, para exibição na Folha de Ponto
async function carregarFeriasCalculadas(codigoEmpresa) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_ferias_calculadas')
            .select('codigo_empregado, ferias_inicio, ferias_fim')
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        const mapa = {};
        (data || []).forEach(r => {
            if (!mapa[r.codigo_empregado]) mapa[r.codigo_empregado] = [];
            mapa[r.codigo_empregado].push({ inicio: r.ferias_inicio, fim: r.ferias_fim });
        });
        return mapa;
    } catch (erro) {
        console.error('Erro ao carregar férias calculadas:', erro);
        return {};
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
        const isFerias = _dataEmFerias(dia.data, folha.empregadoId);
        const infoExtra = isFeriado
            ? `<span style="color: var(--danger-color); font-size: 11px; display: block;">Feriado</span>`
            : '';

        const temEntrada = dia.entrada1 || dia.entrada2 || (state.terceiroTurno && dia.entrada3);
        const flagFolga = folha.flagsFolga[dia.data] || '';
        const colspanHorarios = state.terceiroTurno ? 6 : 4;

        html += `
            <tr class="${rowClass}"${isFerias ? ' style="background-color: #fffbeb;"' : ''}>
                <td>
                    <strong>${dia.data}</strong><br>
                    <span style="font-size: 12px; color: var(--text-secondary);">${dia.diaSemana}</span>
                    ${infoExtra}
                </td>
                <td style="text-align: center; font-size: 12px; color: #6c757d;">
                    ${isDSR ? '<span style="background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">DSR</span>' : ''}
                </td>
                ${isFerias ? `
                <td colspan="${colspanHorarios}" style="text-align: center; background-color: #fde68a; color: #78350f; font-weight: 700; font-size: 13px; letter-spacing: 0.3px; padding: 10px;">
                    🏖️ FÉRIAS — sem lançamento de horas
                </td>` : `
                <td><input type="text" class="time-input" value="${dia.entrada1}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada1', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida1}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida1', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.entrada2}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada2', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida2}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida2', this.value)" placeholder="00:00" maxlength="5"></td>
                ${state.terceiroTurno ? `
                <td><input type="text" class="time-input" value="${dia.entrada3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada3', this.value)" placeholder="00:00" maxlength="5"></td>
                <td><input type="text" class="time-input" value="${dia.saida3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida3', this.value)" placeholder="00:00" maxlength="5"></td>` : ''}`}
                <td style="text-align: center;">
                    ${isFerias
                        ? '<span style="color: #9ca3af; font-size: 12px;">—</span>'
                        : `<input type="checkbox" ${isDSR ? 'checked' : ''} onchange="atualizarDSRDia(${state.abaAtivaIndex}, '${dia.data}', this.checked)" style="cursor: pointer; width: 18px; height: 18px;">`}
                </td>
                <td style="text-align: center;">
                    ${isFerias ? '<span style="color: #9ca3af; font-size: 12px;">—</span>' : `
                    <select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
                        <option value="">-</option>
                        ${!temEntrada ? `<option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>` : ''}
                        ${!temEntrada ? `<option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>` : ''}
                        ${!temEntrada ? `<option value="compensacao" ${flagFolga === 'compensacao' ? 'selected' : ''}>Compensação</option>` : ''}
                        <option value="atestado" ${flagFolga === 'atestado' ? 'selected' : ''}>Atestado Médico</option>
                        <option value="atestado_comparecimento" ${flagFolga === 'atestado_comparecimento' ? 'selected' : ''}>Atestado de Comparecimento</option>
                        <option value="liberacao_meio_expediente" ${flagFolga === 'liberacao_meio_expediente' ? 'selected' : ''}>Liberação Meio Expediente</option>
                    </select>`}
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
async function carregarFeriadosGlobais() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_feriados')
            .select('id, data, descricao')
            .order('data', { ascending: true });
        if (error) throw error;
        state.feriados = (data || []).map(f => ({ id: f.id, data: f.data, descricao: f.descricao }));
    } catch (e) {
        console.warn('Erro ao carregar rh_feriados (a tabela existe? rode a migração schema_rh_feriados_globais.sql):', e);
        // Fallback: mesma lista fixa de antes, sem id (não editável até a migração rodar)
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
    }
    renderizarTabelaFeriados();
}

async function adicionarFeriado() {
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
    if (state.feriados.some(f => f.data === data)) {
        document.getElementById('novaDataFeriado').value = '';
        document.getElementById('novaDescricaoFeriado').value = '';
        return;
    }
    try {
        const { data: inserido, error } = await supabaseClient
            .from('rh_feriados')
            .insert({ data, descricao: desc })
            .select('id, data, descricao')
            .single();
        if (error) throw error;
        state.feriados.push({ id: inserido.id, data: inserido.data, descricao: inserido.descricao });
        state.feriados.sort((a, b) => {
            const [d1, m1, a1] = a.data.split('/');
            const [d2, m2, a2] = b.data.split('/');
            return new Date(a1, m1-1, d1) - new Date(a2, m2-1, d2);
        });
        renderizarTabelaFeriados();
        renderizarConteudoAba();
        document.getElementById('novaDataFeriado').value = '';
        document.getElementById('novaDescricaoFeriado').value = '';
    } catch (e) {
        console.error('Erro ao adicionar feriado:', e);
        mostrarMensagem('Erro', 'Não foi possível salvar o feriado. Verifique se a migração schema_rh_feriados_globais.sql já foi executada no Supabase.');
    }
}

window.removerFeriado = function(id, data) {
    // Feriados carregados de um snapshot antigo (feriados_json de uma folha já salva
    // antes desta funcionalidade existir) podem não ter id — nesse caso, remove só
    // localmente, sem tentar apagar nada do calendário global.
    if (!id) {
        state.feriados = state.feriados.filter(f => f.data !== data);
        renderizarTabelaFeriados();
        renderizarConteudoAba();
        return;
    }
    mostrarConfirmacao(
        'Remover Feriado',
        'Tem certeza que deseja remover este feriado? Ele será removido do calendário global, afetando todas as empresas.',
        async () => {
            try {
                const { error } = await supabaseClient
                    .from('rh_feriados')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                state.feriados = state.feriados.filter(f => f.id !== id);
                renderizarTabelaFeriados();
                renderizarConteudoAba();
            } catch (e) {
                console.error('Erro ao remover feriado:', e);
                mostrarMensagem('Erro', 'Não foi possível remover o feriado.');
            }
        }
    );
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
                    <button type="button" class="btn-icon" onclick="removerFeriado('${f.id || ''}', '${f.data}')" style="color: var(--danger-color);">🗑️</button>
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
        const flagFerias = _dataEmFerias(dia.data, folha.empregadoId);

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
                if (!flagFerias) {
                    flagSemRegistro = true;
                }
                // dia de férias sem flag manual: sem impacto em totais, mesmo tratamento de Folga
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
            flagCompensacao: flagCompensacao,
            flagFerias: flagFerias
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
            if (dia.flagFerias) {
                flags += '<span style="background: #fde68a; color: #78350f; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FÉRIAS</span>';
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
        if (dia.flagFerias) flagsStr += 'FÉRIAS ';
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
    { ev: 'descontoVT', sufRub: 'DescontoVT', defaultTipo: 'monetario' },
    { ev: 'descontoVA', sufRub: 'DescontoVA', defaultTipo: 'monetario' },
];

let _cacheConfigRubricas = {};
let _cacheCatalogoRubricas = {};
let _catalogoRubricasAtual = [];

async function _buscarCatalogoRubricas(codigoEmpresa) {
    if (!codigoEmpresa) return [];
    if (_cacheCatalogoRubricas[codigoEmpresa] !== undefined) return _cacheCatalogoRubricas[codigoEmpresa];
    try {
        const { data, error } = await supabaseClient
            .from('rh_rubricas')
            .select('codigo_rubrica, descricao_rubrica, tipo')
            .eq('codigo_empresa', codigoEmpresa)
            .order('descricao_rubrica');
        if (error) throw error;
        _cacheCatalogoRubricas[codigoEmpresa] = data || [];
        return data || [];
    } catch (e) {
        console.error('Erro ao buscar catálogo de rubricas:', e);
        return [];
    }
}

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

let _cacheValoresVaVt = {};

async function _buscarValoresVaVtEmpresa(codigoEmpresa) {
    if (!codigoEmpresa) return {};
    if (_cacheValoresVaVt[codigoEmpresa] !== undefined) return _cacheValoresVaVt[codigoEmpresa];
    try {
        const { data, error } = await supabaseClient
            .from('rh_valores_va_vt')
            .select('codigo_empregado, valor_vt, valor_va')
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        const mapa = {};
        (data || []).forEach(r => { mapa[r.codigo_empregado] = { vt: Number(r.valor_vt) || 0, va: Number(r.valor_va) || 0 }; });
        _cacheValoresVaVt[codigoEmpresa] = mapa;
        return mapa;
    } catch (e) {
        console.error('Erro ao buscar valores de VT/VA:', e);
        return {};
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
    const cRuleExtra100 = document.getElementById('cfgRuleExtra100');
    const cTerceiroT    = document.getElementById('cfgTerceiroTurno');
    const cNaoComp      = document.getElementById('cfgNaoCompensarDefault');
    if (cRuleExtra100) cRuleExtra100.checked = cfg['rule_extra_100_opcional']?.cod === '1';
    if (cTerceiroT)    cTerceiroT.checked    = cfg['terceiro_turno']?.cod === '1';
    if (cNaoComp)      cNaoComp.checked      = cfg['nao_compensar_extras']?.cod === '1';
    const cBenExcluirFeriados = document.getElementById('cfgBeneficiosExcluirFeriados');
    if (cBenExcluirFeriados) cBenExcluirFeriados.checked = cfg['beneficios_excluir_feriados']?.cod !== '0'; // default: excluir (true)
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
    const cRuleExtra100 = document.getElementById('cfgRuleExtra100');
    const cTerceiroT    = document.getElementById('cfgTerceiroTurno');
    const cNaoComp      = document.getElementById('cfgNaoCompensarDefault');
    if (cRuleExtra100) cRuleExtra100.checked = false;
    if (cTerceiroT)    cTerceiroT.checked    = false;
    if (cNaoComp)      cNaoComp.checked      = false;
    const cBenExcluirFeriados = document.getElementById('cfgBeneficiosExcluirFeriados');
    if (cBenExcluirFeriados) cBenExcluirFeriados.checked = true; // default: excluir feriados
}

// --- GRUPOS DE EMPRESAS ---
let _grupos = [];
let _grupoAtual = null;

async function carregarGrupos() {
    try {
        const { data: grupos, error: errG } = await supabaseClient
            .from('rh_grupos_empresas')
            .select('id, nome_grupo')
            .order('nome_grupo', { ascending: true });
        if (errG) throw errG;
        const { data: itens, error: errI } = await supabaseClient
            .from('rh_grupos_empresas_itens')
            .select('grupo_id, codigo_empresa');
        if (errI) throw errI;
        const contagem = {};
        (itens || []).forEach(it => { contagem[it.grupo_id] = (contagem[it.grupo_id] || 0) + 1; });
        _grupos = (grupos || []).map(g => ({ ...g, qtdEmpresas: contagem[g.id] || 0 }));
        renderizarListaGrupos();
    } catch (erro) {
        console.error('Erro ao carregar grupos:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar grupos de empresas.');
    }
}

function renderizarListaGrupos() {
    const container = document.getElementById('listaGrupos');
    if (!container) return;
    if (_grupos.length === 0) {
        container.innerHTML = '<div style="padding:14px; color: var(--text-secondary); font-size:13px;">Nenhum grupo cadastrado.</div>';
        return;
    }
    container.innerHTML = _grupos.map(g => `
        <div onclick="selecionarGrupo('${g.id}')"
            style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f0f0f0; ${_grupoAtual?.id === g.id ? 'background:#f5f5f5; font-weight:600;' : ''}">
            ${g.nome_grupo} <span style="color: var(--text-secondary);">(${g.qtdEmpresas})</span>
        </div>
    `).join('');
}

function novoGrupo() {
    _grupoAtual = { id: null, nome_grupo: '', observacoes: '', empresas: [] };
    renderizarListaGrupos();
    _renderGrupoDetalhe();
}

async function selecionarGrupo(id) {
    const grupo = _grupos.find(g => g.id === id);
    if (!grupo) return;
    try {
        const { data: grupoCompleto, error: errG } = await supabaseClient
            .from('rh_grupos_empresas')
            .select('id, nome_grupo, observacoes')
            .eq('id', id)
            .single();
        if (errG) throw errG;
        const { data: itens, error } = await supabaseClient
            .from('rh_grupos_empresas_itens')
            .select('codigo_empresa')
            .eq('grupo_id', id);
        if (error) throw error;
        const empresas = (itens || []).map(it => {
            const emp = state.empresas.find(e => e.codigo_empresa === it.codigo_empresa);
            return { codigo_empresa: it.codigo_empresa, nome_empresa: emp?.nome_empresa || it.codigo_empresa };
        });
        _grupoAtual = { id: grupoCompleto.id, nome_grupo: grupoCompleto.nome_grupo, observacoes: grupoCompleto.observacoes || '', empresas };
        renderizarListaGrupos();
        _renderGrupoDetalhe();
    } catch (erro) {
        console.error('Erro ao carregar empresas do grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar as empresas do grupo.');
    }
}

function _renderGrpEmpresasList() {
    const container = document.getElementById('grpEmpresasList');
    if (!container) return;
    if (_grupoAtual.empresas.length === 0) {
        container.innerHTML = '<div style="padding:10px; color: var(--text-secondary); font-size:13px;">Nenhuma empresa adicionada.</div>';
        return;
    }
    container.innerHTML = _grupoAtual.empresas.map(e => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid #f0f0f0; font-size:13px;">
            <span><strong>${e.codigo_empresa}</strong> - ${e.nome_empresa}</span>
            <button type="button" class="btn btn-danger btn-small" style="padding:2px 8px; font-size:11px;" onclick="removerEmpresaGrupo('${e.codigo_empresa}')">remover</button>
        </div>
    `).join('');
}

function removerEmpresaGrupo(codigo) {
    _grupoAtual.empresas = _grupoAtual.empresas.filter(e => e.codigo_empresa !== codigo);
    _renderGrpEmpresasList();
}

function filtrarEmpresasGrupo(termo) {
    const box   = document.getElementById('grpBuscaEmpresaResultados');
    const input = document.getElementById('grpBuscaEmpresa');
    if (!box || !input) return;
    const rect = input.getBoundingClientRect();
    box.style.top   = (rect.bottom + 2) + 'px';
    box.style.left  = rect.left + 'px';
    box.style.width = rect.width + 'px';
    const norm = termo.trim().toLowerCase();
    const lista = norm
        ? state.empresas.filter(e => e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
        : state.empresas;
    if (!lista.length) {
        box.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:13px;">Nenhuma empresa encontrada</div>';
        box.style.display = 'block';
        return;
    }
    box.innerHTML = lista.map(e => `
        <div onclick="adicionarEmpresaGrupo('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

function adicionarEmpresaGrupo(codigo, nome) {
    if (!_grupoAtual.empresas.some(e => e.codigo_empresa === codigo)) {
        _grupoAtual.empresas.push({ codigo_empresa: codigo, nome_empresa: nome });
    }
    document.getElementById('grpBuscaEmpresa').value = '';
    document.getElementById('grpBuscaEmpresaResultados').style.display = 'none';
    _renderGrpEmpresasList();
}

async function salvarGrupo() {
    const nome = (document.getElementById('grpNome')?.value || '').trim();
    if (!nome) { mostrarMensagem('Aviso', 'Informe o nome do grupo.'); return; }
    const observacoes = (document.getElementById('grpObservacoes')?.value || '').trim();
    try {
        let grupoId = _grupoAtual.id;
        if (grupoId) {
            const { error } = await supabaseClient.from('rh_grupos_empresas').update({ nome_grupo: nome, observacoes }).eq('id', grupoId);
            if (error) throw error;
        } else {
            const { data, error } = await supabaseClient.from('rh_grupos_empresas').insert({ nome_grupo: nome, observacoes }).select('id').single();
            if (error) throw error;
            grupoId = data.id;
        }
        const { error: errDel } = await supabaseClient.from('rh_grupos_empresas_itens').delete().eq('grupo_id', grupoId);
        if (errDel) throw errDel;
        if (_grupoAtual.empresas.length > 0) {
            const { error: errIns } = await supabaseClient.from('rh_grupos_empresas_itens')
                .insert(_grupoAtual.empresas.map(e => ({ grupo_id: grupoId, codigo_empresa: e.codigo_empresa })));
            if (errIns) throw errIns;
        }
        mostrarMensagem('Sucesso', '✅ Grupo salvo com sucesso!');
        await carregarGrupos();
        await selecionarGrupo(grupoId);
    } catch (erro) {
        console.error('Erro ao salvar grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao salvar o grupo: ' + erro.message);
    }
}

async function excluirGrupo() {
    if (!_grupoAtual?.id) return;
    if (!confirm(`Excluir o grupo "${_grupoAtual.nome_grupo}"?`)) return;
    try {
        const { error } = await supabaseClient.from('rh_grupos_empresas').delete().eq('id', _grupoAtual.id);
        if (error) throw error;
        _grupoAtual = null;
        await carregarGrupos();
        _renderGrupoDetalhe();
        mostrarMensagem('Sucesso', '✅ Grupo excluído com sucesso!');
    } catch (erro) {
        console.error('Erro ao excluir grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao excluir o grupo: ' + erro.message);
    }
}

function _renderGrupoDetalhe() {
    const container = document.getElementById('grupoDetalhe');
    if (!container) return;
    if (!_grupoAtual) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>';
        return;
    }
    container.innerHTML = `
        <div class="form-group" style="margin-bottom:14px;">
            <label>Nome do Grupo</label>
            <input type="text" id="grpNome" value="${_grupoAtual.nome_grupo.replace(/"/g, '&quot;')}" placeholder="Ex: Grupo Shopping X" style="width:100%; box-sizing:border-box;">
        </div>
        <div class="form-group" style="margin-bottom:8px;">
            <label>Empresas do Grupo</label>
            <input type="text" id="grpBuscaEmpresa" placeholder="Digite o nome ou código da empresa..." autocomplete="off"
                oninput="filtrarEmpresasGrupo(this.value)" onfocus="filtrarEmpresasGrupo(this.value)"
                style="width:100%; box-sizing:border-box; margin-top:4px;">
        </div>
        <div id="grpEmpresasList" style="border:1px solid var(--border-color); border-radius:8px; overflow:hidden; margin-bottom:14px;"></div>
        <div style="margin-bottom:18px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
            <div style="background: var(--background-color); padding: 8px 14px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">📝 Observações do Grupo</span>
            </div>
            <div style="padding: 14px;">
                <textarea id="grpObservacoes" rows="10" placeholder="Descreva aqui tudo o que for relevante sobre este grupo: particularidades das empresas, combinados com o cliente, exceções de processamento, prazos, etc. Não deixe nenhum detalhe de fora."
                    style="width:100%; box-sizing:border-box; padding:12px; border:1px solid #ced4da; border-radius:6px; font-size:15px; line-height:1.5; font-family:inherit; resize:vertical; min-height:180px;">${(_grupoAtual.observacoes || '').replace(/</g, '&lt;')}</textarea>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            ${_grupoAtual.id ? '<button type="button" class="btn btn-danger btn-small" onclick="excluirGrupo()">🗑 Excluir Grupo</button>' : '<span></span>'}
            <button type="button" class="btn btn-primary btn-small" onclick="salvarGrupo()">💾 Salvar Grupo</button>
        </div>
        ${_grupoAtual.id ? `
        <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
            <h4 style="margin:0 0 10px;">Ações em Lote</h4>
            <div class="form-group" style="max-width:160px;">
                <label>Competência</label>
                <input type="text" id="grpCompetencia" placeholder="MM/AAAA" maxlength="7">
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
                <button type="button" class="btn btn-secondary btn-small" onclick="baixarModelosGrupo()">📥 Baixar Modelos (.zip)</button>
                <button type="button" class="btn btn-secondary btn-small" onclick="document.getElementById('grpArquivosLote').click()">📤 Processar em Lote</button>
                <input type="file" id="grpArquivosLote" multiple accept=".xlsx" style="display:none;" onchange="processarLoteGrupo(this.files)">
                <button type="button" class="btn btn-secondary btn-small" onclick="abrirExportacaoTxtGrupo()">📄 Exportar TXT do Grupo</button>
            </div>
        </div>` : ''}
    `;
    _renderGrpEmpresasList();
    const compEl = document.getElementById('grpCompetencia');
    if (compEl) compEl.addEventListener('input', e => { e.target.value = formatarCompetencia(e.target.value); });
}

// --- AÇÕES EM LOTE: MODELOS ---
async function baixarModelosGrupo() {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de baixar os modelos.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de baixar os modelos.'); return; }
    if (_grupoAtual.empresas.length === 0) { mostrarMensagem('Aviso', 'O grupo não possui empresas.'); return; }

    mostrarMensagem('Aguarde', 'Gerando modelos do grupo...');
    const zip = new JSZip();
    const avisos = [];
    const diasDoMes = gerarDiasDoMes(comp);
    const [mm, aaaa] = comp.split('/');

    for (const empresa of _grupoAtual.empresas) {
        try {
            const { data: empregados, error } = await supabaseClient
                .from('rh_empregados')
                .select('codigo_empregado, nome_empregado')
                .eq('codigo_empresa', empresa.codigo_empresa)
                .order('nome_empregado', { ascending: true });
            if (error) throw error;
            if (!empregados || empregados.length === 0) {
                avisos.push(`${empresa.codigo_empresa} - ${empresa.nome_empresa}: sem empregados cadastrados.`);
                continue;
            }
            const cfg = await _buscarConfigRubricas(empresa.codigo_empresa);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';

            const wb = XLSX.utils.book_new();
            empregados.forEach(emp => {
                const nomeSheet = `${emp.codigo_empregado} ${emp.nome_empregado}`.substring(0, 31);
                const header = comTerceiroTurno
                    ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
                    : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
                const rows = [header, ...diasDoMes.map(d => comTerceiroTurno
                    ? [d.data, d.diaSemana, '', '', '', '', '', '']
                    : [d.data, d.diaSemana, '', '', '', ''])];
                const ws = XLSX.utils.aoa_to_sheet(rows);
                for (let r = 1; r < rows.length; r++) {
                    const addr = XLSX.utils.encode_cell({ r, c: 0 });
                    ws[addr] = { t: 's', v: rows[r][0] };
                }
                ws['!cols'] = comTerceiroTurno
                    ? [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
                    : [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
                XLSX.utils.book_append_sheet(wb, ws, nomeSheet);
            });

            const binario = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            zip.file(`Modelo_FolhaPonto_${empresa.codigo_empresa}_${mm}-${aaaa}.xlsx`, binario);
        } catch (erro) {
            console.error('Erro ao gerar modelo para', empresa.codigo_empresa, erro);
            avisos.push(`${empresa.codigo_empresa} - ${empresa.nome_empresa}: erro ao gerar modelo (${erro.message}).`);
        }
    }

    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Modelos_${_grupoAtual.nome_grupo}_${mm}-${aaaa}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalMensagem();
        if (avisos.length > 0) {
            mostrarMensagem('Concluído com avisos', 'Zip gerado. Empresas puladas:\n' + avisos.join('\n'));
        } else {
            mostrarMensagem('Sucesso', 'Modelos do grupo gerados e baixados com sucesso!');
        }
    } catch (erro) {
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar o arquivo zip: ' + erro.message);
    }
}

// --- AÇÕES EM LOTE: EXPORTAÇÃO TXT ---
async function buscarEmpresasParaExportacaoGrupo(codigosGrupo) {
    const comp = document.getElementById('exportCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Erro', 'Competência inválida.'); return; }
    try {
        const { data, error } = await supabaseClient.from('rh_saves').select('empresa_codigo').eq('competencia', comp);
        if (error) throw error;
        const codigosUnicos = [...new Set(data.map(item => item.empresa_codigo))].filter(c => codigosGrupo.includes(c));
        if (codigosUnicos.length === 0) { mostrarMensagem('Aviso', 'Nenhuma empresa do grupo possui dados processados para esta competência.'); return; }
        const empresasFiltradas = state.empresas.filter(emp => codigosUnicos.includes(emp.codigo_empresa));
        renderizarListaEmpresasExportacao(empresasFiltradas);
    } catch (erro) {
        console.error('Erro ao buscar empresas do grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao buscar empresas do grupo com dados processados.');
    }
}

async function _abrirExportacaoTxtLote(codigosEmpresas, competencia) {
    await abrirModalExportacaoTXT();
    document.getElementById('exportCompetencia').value = competencia;
    await buscarEmpresasParaExportacaoGrupo(codigosEmpresas);
}

async function abrirExportacaoTxtGrupo() {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de exportar o TXT.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de exportar o TXT do grupo.'); return; }
    await _abrirExportacaoTxtLote(_grupoAtual.empresas.map(e => e.codigo_empresa), comp);
}

// --- AÇÕES EM LOTE: PROCESSAMENTO (fila de revisão) ---
function _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, competencia) {
    const normalizeHora = (v) => {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number') {
            const total = Math.round(v * 24 * 60);
            const h = Math.floor(total / 60) % 24;
            const m2 = total % 60;
            return `${String(h).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
        }
        const s = String(v).trim();
        const match = s.match(/^(\d{1,2}):(\d{2})/);
        return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
    };
    const folhas = [];
    const avisosAbas = [];
    wb.SheetNames.forEach(sheetName => {
        const codEmpregado = sheetName.split(' ')[0].trim();
        const empregado = empregados.find(e => e.codigo_empregado === codEmpregado);
        if (!empregado) { avisosAbas.push(`aba "${sheetName}" sem correspondência`); return; }

        const folha = { empregadoId: empregado.codigo_empregado, nome: empregado.nome_empregado, dados: gerarDiasDoMes(competencia), dsrDias: [], flagsFolga: {} };
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        for (let r = 1; r < linhas.length; r++) {
            const row = linhas[r];
            if (!row || !row[0]) continue;
            const dataStr = String(row[0]).trim();
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) continue;
            const diaIdx = folha.dados.findIndex(d => d.data === dataStr);
            if (diaIdx === -1) continue;
            folha.dados[diaIdx].entrada1 = normalizeHora(row[2]);
            folha.dados[diaIdx].saida1   = normalizeHora(row[3]);
            folha.dados[diaIdx].entrada2 = normalizeHora(row[4]);
            folha.dados[diaIdx].saida2   = normalizeHora(row[5]);
            if (comTerceiroTurno) {
                folha.dados[diaIdx].entrada3 = normalizeHora(row[6]);
                folha.dados[diaIdx].saida3   = normalizeHora(row[7]);
            }
        }
        folhas.push(folha);
    });
    return { folhas, avisosAbas };
}

let _filaLoteGrupo = null;

async function processarLoteGrupo(fileList) {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de processar em lote.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de processar em lote.'); return; }
    const arquivos = Array.from(fileList || []);
    if (arquivos.length === 0) return;

    const [compMM, compAAAA] = comp.split('/');
    const codigosGrupo = _grupoAtual.empresas.map(e => e.codigo_empresa);
    const nomesEmpresas = {};
    _grupoAtual.empresas.forEach(e => { nomesEmpresas[e.codigo_empresa] = e.nome_empresa; });

    const resultadosIniciais = [];
    const arquivosValidos = [];
    const codigosComArquivo = new Set();

    arquivos.forEach(file => {
        const m = file.name.match(/^Modelo_FolhaPonto_(.+)_(\d{2})-(\d{4})\.xlsx$/i);
        if (!m) {
            resultadosIniciais.push({ codigo: file.name, status: 'erro', detalhe: 'Nome de arquivo inválido.' });
            return;
        }
        const [, codEmp, mm, aaaa] = m;
        if (mm !== compMM || aaaa !== compAAAA) {
            resultadosIniciais.push({ codigo: codEmp, status: 'erro', detalhe: `Competência do arquivo (${mm}/${aaaa}) não confere com ${comp}.` });
            return;
        }
        if (!codigosGrupo.includes(codEmp)) {
            resultadosIniciais.push({ codigo: codEmp, status: 'erro', detalhe: 'Empresa não pertence ao grupo.' });
            return;
        }
        if (codigosComArquivo.has(codEmp)) {
            resultadosIniciais.push({ codigo: codEmp, status: 'erro', detalhe: 'Arquivo duplicado para esta empresa (ignorado).' });
            return;
        }
        codigosComArquivo.add(codEmp);
        arquivosValidos.push({ codigo: codEmp, file });
    });

    mostrarMensagem('Preparando', `Lendo ${arquivosValidos.length} arquivo(s)...`);

    const itensFila = [];
    for (const { codigo, file } of arquivosValidos) {
        try {
            const { data: empregados, error: errEmp } = await supabaseClient
                .from('rh_empregados')
                .select('codigo_empregado, nome_empregado')
                .eq('codigo_empresa', codigo);
            if (errEmp) throw errEmp;
            if (!empregados || empregados.length === 0) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: 'Empresa sem empregados cadastrados.' });
                continue;
            }

            const cfg = await _buscarConfigRubricas(codigo);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';
            const feriasCalculadas = await carregarFeriasCalculadas(codigo);

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
            const { folhas, avisosAbas } = _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, comp);

            if (folhas.length === 0) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: 'Nenhum empregado correspondente encontrado no arquivo.' });
                continue;
            }

            itensFila.push({ codigo_empresa: codigo, nome_empresa: nomesEmpresas[codigo] || codigo, folhas, avisosAbas, cfg, feriasCalculadas });
        } catch (erro) {
            console.error('Erro ao preparar empresa do lote', codigo, erro);
            resultadosIniciais.push({ codigo, status: 'erro', detalhe: erro.message || 'Erro desconhecido.' });
        }
    }

    codigosGrupo.forEach(codigo => {
        if (!codigosComArquivo.has(codigo)) {
            resultadosIniciais.push({ codigo, status: 'sem-arquivo', detalhe: '—' });
        }
    });

    fecharModalMensagem();
    const inputArquivos = document.getElementById('grpArquivosLote');
    if (inputArquivos) inputArquivos.value = '';

    if (itensFila.length === 0) {
        _mostrarResumoLote(resultadosIniciais, codigo => nomesEmpresas[codigo] || codigo);
        return;
    }

    _filaLoteGrupo = {
        itens: itensFila,
        indice: 0,
        competencia: comp,
        resultados: [],
        resultadosIniciais,
        nomesEmpresas
    };
    _carregarProximaEmpresaFila();
}

function _carregarProximaEmpresaFila() {
    const fila = _filaLoteGrupo;
    if (!fila) return;
    const item = fila.itens[fila.indice];

    state.empresaSelecionada = { codigo_empresa: item.codigo_empresa, nome_empresa: item.nome_empresa };
    state.competencia = fila.competencia;
    state.folhas = item.folhas;
    state.abaAtivaIndex = 0;
    state.resultados = [];
    state.feriasCalculadas = item.feriasCalculadas || {};

    _aplicarConfigEmpresaNaTelaEdicao(item.cfg);

    mostrarTela('mainScreen');
    renderizarAbas();
}

function _avancarFilaLoteGrupo() {
    const fila = _filaLoteGrupo;
    if (!fila) return;
    const item = fila.itens[fila.indice];
    const detalheAvisos = item.avisosAbas.length ? ` Avisos: ${item.avisosAbas.join('; ')}.` : '';
    fila.resultados.push({ codigo: item.codigo_empresa, status: 'ok', detalhe: `${item.folhas.length} empregado(s) processado(s).${detalheAvisos}` });
    fila.indice++;
    if (fila.indice >= fila.itens.length) {
        _finalizarFilaLoteGrupo();
    } else {
        _carregarProximaEmpresaFila();
    }
}

function _cancelarFilaLoteGrupo() {
    const fila = _filaLoteGrupo;
    if (!fila) return;
    if (!confirm('Cancelar o restante do lote? As empresas já processadas e salvas permanecem salvas; as demais ficam pendentes.')) return;
    for (let i = fila.indice; i < fila.itens.length; i++) {
        fila.resultados.push({ codigo: fila.itens[i].codigo_empresa, status: 'cancelado', detalhe: 'Cancelado pelo operador antes de processar.' });
    }
    _finalizarFilaLoteGrupo();
}

let _pendingExportTxtLote = null;

function _finalizarFilaLoteGrupo() {
    const fila = _filaLoteGrupo;
    _filaLoteGrupo = null;
    const banner = document.getElementById('filaLoteGrupoBanner');
    if (banner) banner.style.display = 'none';
    mostrarTela('gruposScreen');
    const codigosOk = fila.resultados.filter(r => r.status === 'ok').map(r => r.codigo);
    _pendingExportTxtLote = codigosOk.length > 0 ? { codigos: codigosOk, competencia: fila.competencia } : null;
    _mostrarResumoLote([...fila.resultadosIniciais, ...fila.resultados], codigo => fila.nomesEmpresas[codigo] || codigo);
}

function _fecharResumoLoteEAbrirExportacao() {
    document.getElementById('loteResumoModal').classList.remove('active');
    if (_pendingExportTxtLote) {
        const pendente = _pendingExportTxtLote;
        _pendingExportTxtLote = null;
        _abrirExportacaoTxtLote(pendente.codigos, pendente.competencia);
    }
}

function _atualizarBannerFilaLote(telaId) {
    const banner = document.getElementById('filaLoteGrupoBanner');
    if (!banner) return;
    if (!_filaLoteGrupo || (telaId !== 'mainScreen' && telaId !== 'resultsScreen')) {
        banner.style.display = 'none';
        return;
    }
    const fila = _filaLoteGrupo;
    const item = fila.itens[fila.indice];
    const posicao = `${fila.indice + 1}/${fila.itens.length}`;
    const texto = document.getElementById('filaLoteGrupoTexto');
    const btnAvancar = document.getElementById('filaLoteAvancarBtn');
    if (telaId === 'mainScreen') {
        if (texto) texto.textContent = `📦 Lote do grupo "${_grupoAtual?.nome_grupo || ''}" — empresa ${posicao}: ${item.codigo_empresa} - ${item.nome_empresa}. Revise faltas, atestados, DSR e demais flags antes de processar.`;
        if (btnAvancar) btnAvancar.style.display = 'none';
    } else {
        if (texto) texto.textContent = `✅ Empresa ${item.codigo_empresa} - ${item.nome_empresa} processada (${posicao}).`;
        if (btnAvancar) btnAvancar.style.display = 'inline-flex';
    }
    banner.style.display = 'flex';
}

function _mostrarResumoLote(resultados, nomeEmpresaFn) {
    const iconePorStatus = { ok: '✅', erro: '⚠️', 'sem-arquivo': '⬜', cancelado: '🚫' };
    const rotuloPorStatus = { ok: 'Processada', erro: 'Erro', 'sem-arquivo': 'Sem arquivo enviado', cancelado: 'Cancelada' };
    const linhas = resultados.map(r => `
        <div style="display:grid; grid-template-columns: 1.4fr 1fr 2fr; gap:10px; padding:8px 0; border-bottom:1px solid #eee; font-size:13px;">
            <span>${nomeEmpresaFn(r.codigo)}</span>
            <span>${iconePorStatus[r.status]} ${rotuloPorStatus[r.status]}</span>
            <span style="color: var(--text-secondary);">${r.detalhe}</span>
        </div>
    `).join('');
    document.getElementById('loteResumoConteudo').innerHTML = linhas || '<p>Nenhum resultado.</p>';
    document.getElementById('loteResumoModal').classList.add('active');
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
        { codigo_empresa: codigoEmpresa, evento: 'rule_extra_100_opcional', codigo_rubrica: document.getElementById('cfgRuleExtra100')?.checked ? '1' : '0',          tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'terceiro_turno',          codigo_rubrica: document.getElementById('cfgTerceiroTurno')?.checked ? '1' : '0',         tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'nao_compensar_extras',    codigo_rubrica: document.getElementById('cfgNaoCompensarDefault')?.checked ? '1' : '0',   tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'beneficios_excluir_feriados', codigo_rubrica: document.getElementById('cfgBeneficiosExcluirFeriados')?.checked ? '1' : '0', tipo_valor: 'config' },
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

// --- VALORES DE VT/VA POR EMPREGADO ---

function abrirModalValoresVaVt() {
    document.getElementById('vvCodigoEmpresa').value = '';
    document.getElementById('vvBuscaEmpresa').value = '';
    document.getElementById('vvBuscaEmpresaResultados').style.display = 'none';
    document.getElementById('vvConteudo').style.display = 'none';
    document.getElementById('vvSemEmpresa').style.display = 'block';
    document.getElementById('vvBtnSalvar').style.display = 'none';
    document.getElementById('valoresVaVtModal').classList.add('active');
}

function fecharModalValoresVaVt() {
    document.getElementById('valoresVaVtModal').classList.remove('active');
    document.getElementById('vvBuscaEmpresaResultados').style.display = 'none';
}

function filtrarEmpresasValoresVaVt(termo) {
    const box   = document.getElementById('vvBuscaEmpresaResultados');
    const input = document.getElementById('vvBuscaEmpresa');
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
        <div onclick="selecionarEmpresaValoresVaVt('${e.codigo_empresa}', '${e.nome_empresa.replace(/'/g, "\\'")}')"
            style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <span style="font-family:monospace;font-weight:600;color:var(--primary-color);margin-right:8px;">${e.codigo_empresa}</span>${e.nome_empresa}
        </div>`).join('');
    box.style.display = 'block';
}

async function selecionarEmpresaValoresVaVt(codigo, nome) {
    document.getElementById('vvCodigoEmpresa').value = codigo;
    document.getElementById('vvBuscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('vvBuscaEmpresaResultados').style.display = 'none';
    await _carregarTabelaValoresVaVt(codigo);
}

async function _carregarTabelaValoresVaVt(codigoEmpresa) {
    document.getElementById('vvSemEmpresa').style.display = 'none';
    document.getElementById('vvConteudo').style.display = 'block';
    document.getElementById('vvBtnSalvar').style.display = 'none';
    const tabela = document.getElementById('vvTabelaEmpregados');
    tabela.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-secondary);font-size:13px;">Carregando...</div>';

    try {
        const [{ data: empregados, error: errEmp }, { data: valores, error: errVal }] = await Promise.all([
            supabaseClient.from('rh_empregados')
                .select('codigo_empregado, nome_empregado')
                .eq('codigo_empresa', codigoEmpresa)
                .order('nome_empregado', { ascending: true }),
            supabaseClient.from('rh_valores_va_vt')
                .select('codigo_empregado, valor_vt, valor_va')
                .eq('codigo_empresa', codigoEmpresa),
        ]);
        if (errEmp) throw errEmp;
        if (errVal) throw errVal;

        if (!empregados || empregados.length === 0) {
            tabela.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-secondary);font-size:13px;">Esta empresa não possui empregados cadastrados.</div>';
            return;
        }

        const mapaValores = {};
        (valores || []).forEach(v => { mapaValores[v.codigo_empregado] = v; });

        tabela.innerHTML = empregados.map(emp => {
            const v = mapaValores[emp.codigo_empregado] || {};
            return `
                <div style="padding: 8px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; align-items: center;">
                    <span style="font-size: 13px;">${emp.codigo_empregado} - ${emp.nome_empregado}</span>
                    <input type="number" step="0.01" min="0" data-codigo-empregado="${emp.codigo_empregado}" class="vv-input-vt" value="${v.valor_vt ?? ''}" placeholder="0,00" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    <input type="number" step="0.01" min="0" data-codigo-empregado="${emp.codigo_empregado}" class="vv-input-va" value="${v.valor_va ?? ''}" placeholder="0,00" style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                </div>
            `;
        }).join('');
        document.getElementById('vvBtnSalvar').style.display = 'inline-flex';
    } catch (e) {
        console.error('Erro ao carregar valores de VT/VA:', e);
        tabela.innerHTML = '<div style="padding:14px;text-align:center;color:var(--danger-color);font-size:13px;">Erro ao carregar dados.</div>';
    }
}

async function salvarValoresVaVt() {
    const codigoEmpresa = (document.getElementById('vvCodigoEmpresa')?.value || '').trim();
    if (!codigoEmpresa) { mostrarMensagem('Aviso', 'Selecione uma empresa antes de salvar.'); return; }

    const rows = Array.from(document.querySelectorAll('.vv-input-vt')).map(inputVT => {
        const codigoEmpregado = inputVT.dataset.codigoEmpregado;
        const inputVA = document.querySelector(`.vv-input-va[data-codigo-empregado="${codigoEmpregado}"]`);
        return {
            codigo_empresa: codigoEmpresa,
            codigo_empregado: codigoEmpregado,
            valor_vt: parseFloat(inputVT.value) || 0,
            valor_va: parseFloat(inputVA?.value) || 0,
            data_atualizacao: new Date().toISOString(),
        };
    });

    if (rows.length === 0) { mostrarMensagem('Aviso', 'Não há empregados para salvar.'); return; }

    try {
        const { error } = await supabaseClient
            .from('rh_valores_va_vt')
            .upsert(rows, { onConflict: 'codigo_empresa,codigo_empregado' });
        if (error) throw error;
        delete _cacheValoresVaVt[codigoEmpresa];
        mostrarMensagem('Sucesso', '✅ Valores de VT/VA salvos com sucesso!');
    } catch (e) {
        mostrarMensagem('Erro', 'Erro ao salvar valores de VT/VA: ' + e.message);
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
    setVal(`${prefixo}RubDescontoVT`,  c.rubDescontoVT);
    setOpt(`${prefixo}TipoDescontoVT`, c.tipoDescontoVT, 'monetario');
    setVal(`${prefixo}RubDescontoVA`,  c.rubDescontoVA);
    setOpt(`${prefixo}TipoDescontoVA`, c.tipoDescontoVA, 'monetario');
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
        rubDescontoVT:  g(`${prefixo}RubDescontoVT`).trim(),
        tipoDescontoVT: g(`${prefixo}TipoDescontoVT`) || 'monetario',
        rubDescontoVA:  g(`${prefixo}RubDescontoVA`).trim(),
        tipoDescontoVA: g(`${prefixo}TipoDescontoVA`) || 'monetario',
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

function _linhasTxt(config, codEmp, compFmt, codEmpresa, mins_trab, mins_he50, mins_he100, mins_not, mins_atr, dias_falta, dias_desconto_vavt = 0, valoresVaVtEmpregado = null, diasFaltaDetalhes = []) {
    const tp = String(config.tipoProcesso).padStart(2, '0');
    const empFmt = String(codEmp).padStart(10, '0');
    const empFmt2 = String(codEmpresa).padStart(10, '0');
    const base = `10${empFmt}${compFmt}`;
    const rub = r => String(r).replace(/\D/g, '').padStart(9, '0');
    const linha = (rubrica, valorInt) => {
        if (!rubrica || valorInt <= 0) return '';
        return `${base}${rub(rubrica)}${tp}${String(valorInt).padStart(9,'0')}${empFmt2}\n`;
    };
    const encDiasOuHoras = (tipo, dias) => tipo === 'dias' ? _encDias(dias) : _encMinutosParaTipo(dias * 480, tipo);
    const encDescontoVaVt = (tipo, valorDiario) => {
        if (tipo === 'monetario') return Math.round(dias_desconto_vavt * (valorDiario || 0) * 100);
        return encDiasOuHoras(tipo, dias_desconto_vavt);
    };
    const valoresVT = valoresVaVtEmpregado?.vt || 0;
    const valoresVA = valoresVaVtEmpregado?.va || 0;
    return [
        linha(config.rubHorasTrab, _encMinutosParaTipo(mins_trab,  config.tipoHorasTrab)),
        linha(config.rubHE50,      _encMinutosParaTipo(mins_he50,  config.tipoHE50)),
        linha(config.rubHE100,     _encMinutosParaTipo(mins_he100, config.tipoHE100)),
        linha(config.rubNoturno,   _encMinutosParaTipo(mins_not,   config.tipoNoturno)),
        linha(config.rubAtraso,    _encMinutosParaTipo(mins_atr,   config.tipoAtraso)),
        linha(config.rubFalta,     encDiasOuHoras(config.tipoFalta, dias_falta)),
        _linhasFaltas(diasFaltaDetalhes),
        linha(config.rubDescontoVT, encDescontoVaVt(config.tipoDescontoVT, valoresVT)),
        linha(config.rubDescontoVA, encDescontoVaVt(config.tipoDescontoVA, valoresVA)),
    ].join('');
}

async function abrirModalExportacaoTXT() {
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    document.getElementById('expNaoCompensar').checked = cfg?.['nao_compensar_extras']?.cod === '1';
    _toggleNaoCompensar('exp');
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
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

    const { data: valoresVaVtData, error: errValoresVaVt } = await supabaseClient
        .from('rh_valores_va_vt').select('codigo_empresa, codigo_empregado, valor_vt, valor_va')
        .in('codigo_empresa', empresasSelecionadas);
    if (errValoresVaVt) throw errValoresVaVt;
    const valoresVaVtMapa = {};
    (valoresVaVtData || []).forEach(v => {
        valoresVaVtMapa[`${v.codigo_empresa}_${v.codigo_empregado}`] = { vt: Number(v.valor_vt) || 0, va: Number(v.valor_va) || 0 };
    });

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

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0, tDiasDescontoVAVT = 0;
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
                tDiasDescontoVAVT++;
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
                    tDiasDescontoVAVT++;
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
            tFaltaDias,
            tDiasDescontoVAVT,
            valoresVaVtMapa[`${empCodigo}_${empInfo.codigo_empregado}`],
            diasFaltaDetalhes
        );
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

// ===== GERAR BENEFÍCIOS (VT/VA) =====

function _atualizarLabelMesPagamentoBeneficios() {
    const comp = document.getElementById('beneficiosCompetencia').value;
    const info = document.getElementById('beneficiosMesPagamentoInfo');
    if (!info) return;
    if (!validarCompetencia(comp)) { info.textContent = ''; return; }
    const [mes, ano] = comp.split('/').map(Number);
    const mesPag = mes === 12 ? 1 : mes + 1;
    const anoPag = mes === 12 ? ano + 1 : ano;
    info.textContent = `O benefício correspondente é pago em ${String(mesPag).padStart(2, '0')}/${anoPag}.`;
}

// Fonte única da seleção de empresas: sobrevive a filtros/re-renderizações da lista
// (checkboxes de empresas fora do filtro atual não existem no DOM, então não podem
// guardar o estado marcado/desmarcado sozinhos).
let _beneficiosEmpresasSelecionadas = new Set();

function _iniciarTelaBeneficios() {
    document.getElementById('beneficiosPreviaContainer').style.display = 'none';
    document.getElementById('beneficiosPreviaBody').innerHTML = '';
    document.getElementById('beneficiosBuscaEmpresa').value = '';
    _beneficiosEmpresasSelecionadas = new Set();
    _atualizarLabelMesPagamentoBeneficios();
    _renderizarListaEmpresasBeneficios(state.empresas);
    _atualizarResumoEmpresasSelecionadasBeneficios();
    _carregarGruposParaBeneficios();
}

let _gruposBeneficiosCache = [];       // [{ id, nome_grupo, qtdEmpresas }]
let _itensGruposBeneficiosCache = {};  // grupo_id -> Set(codigo_empresa)

async function _carregarGruposParaBeneficios() {
    try {
        const [{ data: grupos, error: errG }, { data: itens, error: errI }] = await Promise.all([
            supabaseClient.from('rh_grupos_empresas').select('id, nome_grupo').order('nome_grupo', { ascending: true }),
            supabaseClient.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
        ]);
        if (errG) throw errG;
        if (errI) throw errI;

        _itensGruposBeneficiosCache = {};
        (itens || []).forEach(it => {
            (_itensGruposBeneficiosCache[it.grupo_id] ??= new Set()).add(it.codigo_empresa);
        });
        _gruposBeneficiosCache = (grupos || []).map(g => ({
            id: g.id,
            nome_grupo: g.nome_grupo,
            qtdEmpresas: _itensGruposBeneficiosCache[g.id]?.size || 0,
        }));

        document.getElementById('beneficiosBuscaGrupo').value = '';
        _renderizarListaGruposBeneficios(_gruposBeneficiosCache);
    } catch (erro) {
        console.error('Erro ao carregar grupos de empresas:', erro);
    }
}

function _renderizarListaGruposBeneficios(grupos) {
    const container = document.getElementById('beneficiosListaGrupos');
    if (!container) return;
    if (!grupos || grupos.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhum grupo encontrado.</span>';
        return;
    }
    container.innerHTML = grupos.map(g => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="beneficios-grupo-check" value="${g.id}" onchange="_aplicarGruposBeneficios()">
            ${g.nome_grupo} <span style="color: var(--text-secondary);">(${g.qtdEmpresas})</span>
        </label>
    `).join('');
}

function _filtrarListaGruposBeneficios() {
    const termo = (document.getElementById('beneficiosBuscaGrupo').value || '').toLowerCase().trim();
    const marcados = new Set(Array.from(document.querySelectorAll('.beneficios-grupo-check:checked')).map(cb => cb.value));
    const lista = termo
        ? _gruposBeneficiosCache.filter(g => g.nome_grupo.toLowerCase().includes(termo))
        : _gruposBeneficiosCache;
    _renderizarListaGruposBeneficios(lista);
    marcados.forEach(id => {
        const cb = document.querySelector(`.beneficios-grupo-check[value="${id}"]`);
        if (cb) cb.checked = true;
    });
}

function _aplicarGruposBeneficios() {
    const idsMarcados = Array.from(document.querySelectorAll('.beneficios-grupo-check:checked')).map(cb => cb.value);
    if (idsMarcados.length === 0) return;

    idsMarcados.forEach(id => {
        (_itensGruposBeneficiosCache[id] || new Set()).forEach(codigo => _beneficiosEmpresasSelecionadas.add(codigo));
    });

    document.getElementById('beneficiosBuscaEmpresa').value = '';
    _renderizarListaEmpresasBeneficios(state.empresas);
    _atualizarResumoEmpresasSelecionadasBeneficios();
}

function _renderizarListaEmpresasBeneficios(empresas) {
    const container = document.getElementById('beneficiosListaEmpresas');
    if (!empresas || empresas.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhuma empresa encontrada.</span>';
        return;
    }
    container.innerHTML = empresas.map(e => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="beneficios-emp-check" value="${e.codigo_empresa}" ${_beneficiosEmpresasSelecionadas.has(e.codigo_empresa) ? 'checked' : ''} onchange="_toggleEmpresaBeneficios('${e.codigo_empresa}', this.checked)">
            <span style="font-family:monospace; color:var(--primary-color); font-weight:600;">${e.codigo_empresa}</span> ${e.nome_empresa}
        </label>
    `).join('');
}

function _toggleEmpresaBeneficios(codigoEmpresa, marcado) {
    if (marcado) _beneficiosEmpresasSelecionadas.add(codigoEmpresa);
    else _beneficiosEmpresasSelecionadas.delete(codigoEmpresa);
    _atualizarResumoEmpresasSelecionadasBeneficios();
}

function _filtrarListaEmpresasBeneficios() {
    const termo = (document.getElementById('beneficiosBuscaEmpresa').value || '').toLowerCase().trim();
    const lista = termo
        ? state.empresas.filter(e => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo))
        : state.empresas;
    _renderizarListaEmpresasBeneficios(lista);
}

function _selecionarTodasEmpresasBeneficios(marcar) {
    if (marcar) state.empresas.forEach(e => _beneficiosEmpresasSelecionadas.add(e.codigo_empresa));
    else _beneficiosEmpresasSelecionadas.clear();
    _filtrarListaEmpresasBeneficios();
    _atualizarResumoEmpresasSelecionadasBeneficios();
}

function _atualizarResumoEmpresasSelecionadasBeneficios() {
    const info = document.getElementById('beneficiosEmpresasSelecionadasInfo');
    if (!info) return;
    if (_beneficiosEmpresasSelecionadas.size === 0) {
        info.textContent = 'Nenhuma empresa selecionada.';
        return;
    }
    const nomes = Array.from(_beneficiosEmpresasSelecionadas).map(codigo => {
        const emp = state.empresas.find(e => e.codigo_empresa === codigo);
        return `${codigo} - ${emp?.nome_empresa || codigo}`;
    });
    info.textContent = `${nomes.length} empresa(s) selecionada(s): ${nomes.join(', ')}`;
}

function _isFeriadoNoDia(dataBR) {
    return state.feriados.some(f => f.data === dataBR || f.data === dataBR.substring(0, 5));
}

function _isoParaBR(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}

// Retorna o texto do(s) período(s) de férias que sobrepõem a competência ('' se nenhum).
function _periodosFeriasNoMesTexto(periodos, competencia) {
    if (!periodos || periodos.length === 0) return '';
    const [mes, ano] = competencia.split('/');
    const inicioMes = `${ano}-${mes}-01`;
    const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
    const fimMes = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;
    return periodos
        .filter(p => p.inicio <= fimMes && p.fim >= inicioMes)
        .map(p => `${_isoParaBR(p.inicio)} a ${_isoParaBR(p.fim)}`)
        .join('; ');
}

// Conta só os dias de falta/atestado integral sobre uma Folha de Ponto já salva
// (mesmo critério de desconto usado em _construirConteudoTXTExportacao). "Dias a
// Trabalhar" NÃO vem daqui — é sempre a estimativa de dias úteis (5x2), já que o
// DSR salvo na folha marca só folgas específicas, não o padrão semanal, e não é
// um indicador confiável de fim de semana/dia útil.
function _calcularDiasDescontarFolhaSalva(save) {
    const flagsFolga = JSON.parse(save.flags_folga || '{}');
    return Object.values(flagsFolga).filter(flag => flag === 'falta' || flag === 'atestado').length;
}

async function gerarPreviaBeneficios() {
    const comp = document.getElementById('beneficiosCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe uma competência válida (MM/AAAA).'); return; }
    const codigosEmpresas = Array.from(_beneficiosEmpresasSelecionadas);
    if (codigosEmpresas.length === 0) { mostrarMensagem('Aviso', 'Selecione pelo menos uma empresa.'); return; }

    mostrarMensagem('Aguarde', 'Calculando prévia de benefícios...');
    try {
        const [
            { data: empresasData, error: errEmp },
            { data: empregadosData, error: errFunc },
            { data: valoresData, error: errVal },
            { data: feriasData, error: errFer },
            { data: savesData, error: errSaves },
            { data: escalasData, error: errEsc },
        ] = await Promise.all([
            supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, cnpj').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_empregados').select('codigo_empresa, codigo_empregado, nome_empregado, desc_cargo, situacao, tipo_empregado').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_valores_va_vt').select('codigo_empresa, codigo_empregado, valor_vt, valor_va').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_ferias_calculadas').select('codigo_empresa, codigo_empregado, ferias_inicio, ferias_fim').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_saves').select('*').in('empresa_codigo', codigosEmpresas).eq('competencia', comp).order('data_criacao', { ascending: false }),
            supabaseClient.from('rh_escala_trabalho').select('*').in('codigo_empresa', codigosEmpresas),
        ]);
        if (errEmp) throw errEmp;
        if (errFunc) throw errFunc;
        if (errVal) throw errVal;
        if (errFer) throw errFer;
        if (errSaves) throw errSaves;
        if (errEsc) throw errEsc;

        const empresasMapa = {};
        (empresasData || []).forEach(e => { empresasMapa[e.codigo_empresa] = e; });

        const valoresMapa = {};
        (valoresData || []).forEach(v => {
            valoresMapa[`${v.codigo_empresa}_${v.codigo_empregado}`] = { vt: Number(v.valor_vt) || 0, va: Number(v.valor_va) || 0 };
        });

        const feriasMapa = {};
        (feriasData || []).forEach(f => {
            const chave = `${f.codigo_empresa}_${f.codigo_empregado}`;
            (feriasMapa[chave] ??= []).push({ inicio: f.ferias_inicio, fim: f.ferias_fim });
        });

        // última versão salva por (empresa, nome do trabalhador) — mesmo critério da Exportação TXT
        const savesMapa = {};
        (savesData || []).forEach(s => {
            const chave = `${s.empresa_codigo}_${s.nome_trabalhador}`;
            if (!savesMapa[chave]) savesMapa[chave] = s;
        });

        const escalasMapa = {};
        (escalasData || []).forEach(e => { escalasMapa[`${e.codigo_empresa}_${e.codigo_empregado}`] = _parsearCamposEscala(e); });

        // Config por empresa: se deve excluir feriados nacionais do cálculo de "Dias a Trabalhar"
        // (a escala em si não considera feriados — ver [[project_rh_escala_trabalho]]).
        const excluirFeriadosPorEmpresa = {};
        await Promise.all(codigosEmpresas.map(async cod => {
            const cfg = await _buscarConfigRubricas(cod);
            excluirFeriadosPorEmpresa[cod] = cfg?.['beneficios_excluir_feriados']?.cod !== '0'; // default: excluir (true)
        }));

        const empregadosFiltrados = (empregadosData || []).filter(e =>
            (e.situacao || '').trim() === 'Trabalhando' && (e.tipo_empregado || '').trim() === 'Empregado'
        );

        if (empregadosFiltrados.length === 0) {
            fecharModalMensagem();
            mostrarMensagem('Aviso', 'Nenhum empregado (situação "Trabalhando") encontrado para as empresas selecionadas.');
            document.getElementById('beneficiosPreviaContainer').style.display = 'none';
            return;
        }

        const linhas = empregadosFiltrados.map(emp => {
            const save = savesMapa[`${emp.codigo_empresa}_${emp.nome_empregado}`];
            const periodos = feriasMapa[`${emp.codigo_empresa}_${emp.codigo_empregado}`];
            const escala = escalasMapa[`${emp.codigo_empresa}_${emp.codigo_empregado}`] || null;
            const excluirFeriados = excluirFeriadosPorEmpresa[emp.codigo_empresa];
            const resumoEscala = calcularResumoMes(escala, comp, periodos);
            const diasTrabalhar = resumoEscala.dias.filter(d =>
                d.tipo === 'trabalho' && !(excluirFeriados && _isFeriadoNoDia(d.data))
            ).length;
            const diasDescontar = save ? _calcularDiasDescontarFolhaSalva(save) : 0;
            const valores = valoresMapa[`${emp.codigo_empresa}_${emp.codigo_empregado}`] || { vt: 0, va: 0 };
            const empresa = empresasMapa[emp.codigo_empresa] || { nome_empresa: emp.codigo_empresa, cnpj: '' };
            return {
                codigo_empresa: emp.codigo_empresa,
                nome_empresa: empresa.nome_empresa,
                cnpj: empresa.cnpj || '',
                codigo_empregado: emp.codigo_empregado,
                nome_empregado: emp.nome_empregado,
                desc_cargo: emp.desc_cargo || '',
                feriasTexto: _periodosFeriasNoMesTexto(periodos, comp),
                diasTrabalhar,
                diasDescontar,
                vtDiario: valores.vt,
                vaDiario: valores.va,
            };
        });

        linhas.sort((a, b) => (a.nome_empresa + a.nome_empregado).localeCompare(b.nome_empresa + b.nome_empregado));

        fecharModalMensagem();
        state._beneficiosLinhas = linhas;
        _renderizarPreviaBeneficios(linhas);
    } catch (erro) {
        console.error('Erro ao gerar prévia de benefícios:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar a prévia: ' + erro.message);
    }
}

function _renderizarPreviaBeneficios(linhas) {
    const tbody = document.getElementById('beneficiosPreviaBody');
    const container = document.getElementById('beneficiosPreviaContainer');
    const info = document.getElementById('beneficiosPreviaInfo');

    info.textContent = `${linhas.length} empregado(s)`;
    tbody.innerHTML = linhas.map((l, i) => {
        const diasPagar = Math.max(0, l.diasTrabalhar - l.diasDescontar);
        return `
        <tr data-idx="${i}">
            <td style="padding:6px 8px;">${l.codigo_empresa} - ${l.nome_empresa}</td>
            <td style="padding:6px 8px;">${l.codigo_empregado} - ${l.nome_empregado}</td>
            <td style="padding:6px 8px;">${l.desc_cargo}</td>
            <td style="padding:6px 8px; text-align:center; white-space:normal;">${l.feriasTexto ? `🏖️ ${l.feriasTexto}` : ''}</td>
            <td style="padding:6px 8px; text-align:center;"><input type="number" min="0" class="ben-dias-trabalhar" value="${l.diasTrabalhar}" style="width:60px;" oninput="_recalcularLinhaBeneficios(${i})"></td>
            <td style="padding:6px 8px; text-align:center;"><input type="number" min="0" class="ben-dias-descontar" value="${l.diasDescontar}" style="width:60px;" oninput="_recalcularLinhaBeneficios(${i})"></td>
            <td style="padding:6px 8px; text-align:center;" class="ben-dias-pagar">${diasPagar}</td>
            <td style="padding:6px 8px; text-align:center;">${l.vtDiario ? l.vtDiario.toFixed(2).replace('.', ',') : ''}</td>
            <td style="padding:6px 8px; text-align:center;">${l.vaDiario ? l.vaDiario.toFixed(2).replace('.', ',') : ''}</td>
            <td style="padding:6px 8px; text-align:center;" class="ben-vt-mensal">${(diasPagar * l.vtDiario).toFixed(2).replace('.', ',')}</td>
            <td style="padding:6px 8px; text-align:center;" class="ben-va-mensal">${(diasPagar * l.vaDiario).toFixed(2).replace('.', ',')}</td>
        </tr>`;
    }).join('');
    container.style.display = 'block';
}

function _recalcularLinhaBeneficios(idx) {
    const tr = document.querySelector(`#beneficiosPreviaBody tr[data-idx="${idx}"]`);
    const linha = state._beneficiosLinhas?.[idx];
    if (!tr || !linha) return;
    const diasTrabalhar = parseInt(tr.querySelector('.ben-dias-trabalhar').value, 10) || 0;
    const diasDescontar = parseInt(tr.querySelector('.ben-dias-descontar').value, 10) || 0;
    const diasPagar = Math.max(0, diasTrabalhar - diasDescontar);
    linha.diasTrabalhar = diasTrabalhar;
    linha.diasDescontar = diasDescontar;
    tr.querySelector('.ben-dias-pagar').textContent = diasPagar;
    tr.querySelector('.ben-vt-mensal').textContent = (diasPagar * linha.vtDiario).toFixed(2).replace('.', ',');
    tr.querySelector('.ben-va-mensal').textContent = (diasPagar * linha.vaDiario).toFixed(2).replace('.', ',');
}

function exportarBeneficiosExcel() {
    const linhas = state._beneficiosLinhas || [];
    if (linhas.length === 0) { mostrarMensagem('Aviso', 'Gere a prévia antes de exportar.'); return; }

    const cabecalho = ['Cód Emp', 'NOME', 'CNPJ', 'Cód Epr', 'Nome', 'Descrição cargo', 'DIAS', 'DESCONTAR', 'DIAS A PAGAR', 'VT DIARIO', 'VA DIARIO', 'VT MENSAL', 'VA MENSAL'];
    // VT/VA (diário e mensal) saem como texto com 2 casas decimais (não número),
    // conforme exigido para importação em outros sistemas.
    const linhasExcel = linhas.map(l => {
        const diasPagar = Math.max(0, l.diasTrabalhar - l.diasDescontar);
        const vtDiario = l.vtDiario || 0;
        const vaDiario = l.vaDiario || 0;
        return [
            l.codigo_empresa, l.nome_empresa, l.cnpj, l.codigo_empregado, l.nome_empregado, l.desc_cargo,
            l.diasTrabalhar, l.diasDescontar, diasPagar,
            l.vtDiario ? vtDiario.toFixed(2).replace('.', ',') : '',
            l.vaDiario ? vaDiario.toFixed(2).replace('.', ',') : '',
            (diasPagar * vtDiario).toFixed(2).replace('.', ','),
            (diasPagar * vaDiario).toFixed(2).replace('.', ',')
        ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhasExcel]);
    ws['!cols'] = [10, 28, 20, 10, 28, 22, 8, 10, 12, 10, 10, 12, 12].map(w => ({ wch: w }));
    // Garante que VT/VA (colunas 9 a 12: diário e mensal) fiquem como texto no
    // arquivo, mesmo que o Excel tente reinterpretar o conteúdo como número.
    const COLS_VALOR_TEXTO = [9, 10, 11, 12];
    for (let r = 1; r < linhasExcel.length + 1; r++) {
        COLS_VALOR_TEXTO.forEach(c => {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr]) ws[addr].t = 's';
        });
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Empregados');

    const comp = document.getElementById('beneficiosCompetencia').value;
    const [mes, ano] = comp.split('/').map(Number);
    const mesPag = mes === 12 ? 1 : mes + 1;
    const anoPag = mes === 12 ? ano + 1 : ano;
    XLSX.writeFile(wb, `Beneficios_VT_VA_${String(mesPag).padStart(2, '0')}${anoPag}_${Date.now()}.xlsx`);
}

// ===== RECIBOS DE BENEFÍCIOS (VT/VA) =====

const _EXTENSO_UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const _EXTENSO_DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const _EXTENSO_DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const _EXTENSO_CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

// Converte 0-999 para extenso.
function _extensoGrupo(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const partes = [];
    const c = Math.floor(n / 100);
    const r = n % 100;
    if (c > 0) partes.push(_EXTENSO_CENTENAS[c]);
    if (r > 0) {
        if (r < 10) partes.push(_EXTENSO_UNIDADES[r]);
        else if (r < 20) partes.push(_EXTENSO_DEZ_A_DEZENOVE[r - 10]);
        else {
            const d = Math.floor(r / 10);
            const u = r % 10;
            partes.push(u > 0 ? `${_EXTENSO_DEZENAS[d]} e ${_EXTENSO_UNIDADES[u]}` : _EXTENSO_DEZENAS[d]);
        }
    }
    return partes.join(' e ');
}

// Converte um inteiro não-negativo para extenso (suporta milhares).
function _extensoInteiro(n) {
    if (n === 0) return 'zero';
    const milhar = Math.floor(n / 1000);
    const resto = n % 1000;
    const partes = [];
    if (milhar > 0) partes.push(milhar === 1 ? 'mil' : `${_extensoGrupo(milhar)} mil`);
    if (resto > 0) partes.push((milhar > 0 && resto < 100 ? 'e ' : '') + _extensoGrupo(resto));
    return partes.join(' ');
}

// Valor monetário (R$) por extenso, com singular/plural de real e centavo.
function _valorPorExtenso(valor) {
    const valorArred = Math.round((valor || 0) * 100) / 100;
    const reais = Math.floor(valorArred);
    const centavos = Math.round((valorArred - reais) * 100);
    const textoReais = reais > 0 ? `${_extensoInteiro(reais)} ${reais === 1 ? 'real' : 'reais'}` : '';
    const textoCentavos = centavos > 0 ? `${_extensoInteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : '';
    if (textoReais && textoCentavos) return `${textoReais} e ${textoCentavos}`;
    return textoReais || textoCentavos || 'zero reais';
}

function _fmtMoedaRecibo(v) {
    return (v || 0).toFixed(2).replace('.', ',');
}

const _RECIBO_BENEFICIO_CSS = `
  .gm-recibo-va * { box-sizing: border-box; }
  .gm-recibo-va {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
    background-color: #f4f1f0;
    padding: 16px 0;
  }
  .gm-recibo-va .sheet { max-width: 950px; margin: 0 auto; padding: 0 16px; }
  .gm-recibo-va .via-block {
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    margin-bottom: 14px;
  }
  .gm-recibo-va .header {
    background-color: #7a1e1e;
    padding: 20px 44px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-recibo-va .header .logo { font-family: 'DM Sans', Arial, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #ffffff; }
  .gm-recibo-va .header .via-tag { font-family: 'DM Mono', 'Courier New', monospace; font-size: 11px; color: #e8cfcf; text-transform: uppercase; letter-spacing: 1px; }
  .gm-recibo-va .title-block { padding: 20px 44px 4px 44px; }
  .gm-recibo-va .title-block .eyebrow { margin: 0; font-family: 'DM Mono', 'Courier New', monospace; font-size: 11px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: #7a1e1e; }
  .gm-recibo-va .title-block h1 { margin: 6px 0 0 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 19px; font-weight: 700; color: #2a2422; line-height: 1.35; }
  .gm-recibo-va .body-content { padding: 16px 44px 6px 44px; font-size: 13px; line-height: 1.85; }
  .gm-recibo-va .info-grid { display: flex; gap: 40px; margin-bottom: 18px; }
  .gm-recibo-va .info-grid .col { flex: 1; }
  .gm-recibo-va .info-label { font-family: 'DM Mono', 'Courier New', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; color: #9a8f8a; margin: 0 0 3px 0; }
  .gm-recibo-va .info-value { font-size: 14px; font-weight: 700; color: #2a2422; margin: 0 0 12px 0; }
  .gm-recibo-va .body-content p.paragraph { margin: 0 0 16px 0; text-align: justify; }
  .gm-recibo-va .highlight { color: #7a1e1e; font-weight: 700; }
  .gm-recibo-va .calc-box { background-color: #f7efef; border-left: 4px solid #7a1e1e; border-radius: 4px; padding: 14px 18px; margin: 0 0 18px 0; }
  .gm-recibo-va .calc-box .label { margin: 0 0 6px 0; font-family: 'DM Mono', 'Courier New', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: #7a1e1e; }
  .gm-recibo-va .calc-box .value { margin: 0; font-size: 14.5px; font-weight: 700; color: #2a2422; line-height: 1.6; }
  .gm-recibo-va .signature-area { padding: 10px 44px 0 44px; }
  .gm-recibo-va .signature-date { margin: 0 0 34px 0; font-size: 13px; text-align: center; }
  .gm-recibo-va .signature-row { display: flex; justify-content: center; margin-bottom: 8px; }
  .gm-recibo-va .signature-col { flex: 0 0 55%; text-align: center; }
  .gm-recibo-va .signature-line { border-top: 1px solid #2a2422; padding-top: 8px; font-size: 12px; font-weight: 500; color: #2a2422; }
  .gm-recibo-va .footer { padding: 14px 44px 20px 44px; }
  .gm-recibo-va .footer-inner { border-top: 1px solid #ece6e4; padding-top: 12px; font-family: 'DM Mono', 'Courier New', monospace; font-size: 9.5px; line-height: 1.6; color: #9a8f8a; text-align: center; }
  .gm-recibo-va .cut-line { display: flex; align-items: center; gap: 10px; margin: 6px 0 14px 0; color: #b3a9a4; font-family: 'DM Mono', 'Courier New', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .gm-recibo-va .cut-line::before, .gm-recibo-va .cut-line::after { content: ""; flex: 1; border-top: 1px dashed #c9beb9; }

  @media print {
    @page { size: A4; margin: 8mm 10mm; }
    html, body { background-color: #ffffff; height: auto; }
    .gm-recibo-va { background-color: #ffffff; padding: 0; }
    .gm-recibo-va .sheet { max-width: 100%; padding: 0; }
    .gm-recibo-va .via-block { box-shadow: none; border: 1px solid #ece6e4; border-radius: 0; margin-bottom: 0; page-break-inside: avoid; }
    .gm-recibo-va .header { padding: 12px 28px; }
    .gm-recibo-va .header .logo { font-size: 16px; }
    .gm-recibo-va .title-block { padding: 12px 28px 2px 28px; }
    .gm-recibo-va .title-block h1 { font-size: 15px; }
    .gm-recibo-va .body-content { padding: 10px 28px 2px 28px; font-size: 11.5px; line-height: 1.65; }
    .gm-recibo-va .info-grid { gap: 30px; margin-bottom: 12px; }
    .gm-recibo-va .info-value { font-size: 12px; margin-bottom: 8px; }
    .gm-recibo-va .body-content p.paragraph { margin-bottom: 10px; }
    .gm-recibo-va .calc-box { padding: 10px 14px; margin-bottom: 12px; }
    .gm-recibo-va .calc-box .value { font-size: 13px; }
    .gm-recibo-va .signature-area { padding: 6px 28px 0 28px; }
    .gm-recibo-va .signature-date { margin-bottom: 20px; }
    .gm-recibo-va .footer { padding: 8px 28px 12px 28px; }
    .gm-recibo-va .cut-line { margin: 2px 0 8px 0; }
    #reciboBatch > .gm-recibo-va:not(:last-child) { page-break-after: always; }
  }
`;

function _reciboViaHTML(d) {
    return `
    <div class="via-block">
      <div class="header">
        <div class="logo">${d.nomeEmpresa}</div>
        <div class="via-tag">${d.viaTag}</div>
      </div>
      <div class="title-block">
        <p class="eyebrow">Departamento Pessoal · Benefícios</p>
        <h1>Recibo de Entrega de ${d.tituloBeneficio}</h1>
      </div>
      <div class="body-content">
        <div class="info-grid">
          <div class="col">
            <p class="info-label">Empresa</p>
            <p class="info-value">${d.nomeEmpresa}</p>
            <p class="info-label">CNPJ</p>
            <p class="info-value">${d.cnpj || '—'}</p>
          </div>
          <div class="col">
            <p class="info-label">Empregado</p>
            <p class="info-value">${d.nomeEmpregado}</p>
            <p class="info-label">Função</p>
            <p class="info-value">${d.cargo || '—'}</p>
          </div>
        </div>
        <p class="paragraph">
          Recebi da empresa <span class="highlight">${d.nomeEmpresa}</span> o equivalente a
          R$ ${_fmtMoedaRecibo(d.mensalValor)} (${_valorPorExtenso(d.mensalValor)}) em ${d.pluralDesc}, na quantidade
          abaixo discriminada, para minha utilização no período de ${d.periodoTexto}.
        </p>
        <div class="calc-box">
          <p class="label">Composição do benefício</p>
          <p class="value">${d.diasPagar} vales × R$ ${_fmtMoedaRecibo(d.diarioValor)} (${_valorPorExtenso(d.diarioValor)}) = R$ ${_fmtMoedaRecibo(d.mensalValor)} (${_valorPorExtenso(d.mensalValor)})</p>
        </div>
      </div>
      <div class="signature-area">
        <p class="signature-date">Brasília, &nbsp;&nbsp;&nbsp;&nbsp; de &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; de &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.</p>
        <div class="signature-row">
          <div class="signature-col">
            <div class="signature-line">Assinatura do Empregado</div>
          </div>
        </div>
      </div>
      ${d.footerTexto ? `<div class="footer"><div class="footer-inner">${d.footerTexto}</div></div>` : ''}
    </div>`;
}

function _reciboSheetHTML(tipo, linha, periodoTexto) {
    const diasPagar = Math.max(0, linha.diasTrabalhar - linha.diasDescontar);
    const cfg = tipo === 'va'
        ? { tituloBeneficio: 'Vale Alimentação', pluralDesc: 'vales alimentação', diarioValor: linha.vaDiario, mensalValor: diasPagar * linha.vaDiario, comFooter: false }
        : { tituloBeneficio: 'Vale Transporte', pluralDesc: 'vales transporte', diarioValor: linha.vtDiario, mensalValor: diasPagar * linha.vtDiario, comFooter: true };

    const base = {
        nomeEmpresa: linha.nome_empresa, cnpj: linha.cnpj, nomeEmpregado: linha.nome_empregado, cargo: linha.desc_cargo,
        tituloBeneficio: cfg.tituloBeneficio, pluralDesc: cfg.pluralDesc, periodoTexto, diasPagar,
        diarioValor: cfg.diarioValor, mensalValor: cfg.mensalValor,
    };

    const via1 = _reciboViaHTML({ ...base, viaTag: '1ª Via · Empresa', footerTexto: cfg.comFooter ? 'SCONT Soluções Contábeis · Departamento Pessoal — via para arquivo da empresa' : '' });
    const via2 = _reciboViaHTML({ ...base, viaTag: '2ª Via · Empregado', footerTexto: cfg.comFooter ? 'SCONT Soluções Contábeis · Departamento Pessoal — via do empregado' : '' });

    return `<div class="gm-recibo-va"><div class="sheet">${via1}<div class="cut-line">Recorte aqui</div>${via2}</div></div>`;
}

function _abrirJanelaRecibos(tituloJanela, sheetsHtml) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${tituloJanela}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${_RECIBO_BENEFICIO_CSS}</style>
</head>
<body>
<div id="reciboBatch">${sheetsHtml}</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { mostrarMensagem('Aviso', 'Permita pop-ups para gerar os recibos.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
}

function gerarRecibosBeneficios() {
    const linhas = state._beneficiosLinhas || [];
    if (linhas.length === 0) { mostrarMensagem('Aviso', 'Gere a prévia antes de gerar os recibos.'); return; }

    const comp = document.getElementById('beneficiosCompetencia').value;
    const [mes, ano] = comp.split('/').map(Number);
    const mesPag = mes === 12 ? 1 : mes + 1;
    const anoPag = mes === 12 ? ano + 1 : ano;
    const ultimoDia = new Date(anoPag, mesPag, 0).getDate();
    const mesPagFmt = String(mesPag).padStart(2, '0');
    const periodoTexto = `01/${mesPagFmt}/${anoPag} a ${String(ultimoDia).padStart(2, '0')}/${mesPagFmt}/${anoPag}`;

    const porEmpresa = new Map();
    linhas.forEach(l => {
        if (!porEmpresa.has(l.codigo_empresa)) porEmpresa.set(l.codigo_empresa, { nomeEmpresa: l.nome_empresa, linhas: [] });
        porEmpresa.get(l.codigo_empresa).linhas.push(l);
    });

    let algumGerado = false;
    porEmpresa.forEach(grupo => {
        [['va', 'Vale Alimentação'], ['vt', 'Vale Transporte']].forEach(([tipo, label]) => {
            const elegiveis = grupo.linhas.filter(l => {
                const diasPagar = Math.max(0, l.diasTrabalhar - l.diasDescontar);
                const diario = tipo === 'va' ? l.vaDiario : l.vtDiario;
                return diasPagar * (diario || 0) > 0;
            });
            if (elegiveis.length === 0) return;
            const sheetsHtml = elegiveis.map(l => _reciboSheetHTML(tipo, l, periodoTexto)).join('');
            _abrirJanelaRecibos(`Recibos de ${label} — ${grupo.nomeEmpresa}`, sheetsHtml);
            algumGerado = true;
        });
    });

    if (!algumGerado) mostrarMensagem('Aviso', 'Nenhum recibo gerado — todos os valores de VT/VA estão zerados ou em branco.');
}

// ===== GERAR ESCALA =====

function _iniciarTelaEscala() {
    document.getElementById('escalaResultadoContainer').style.display = 'none';
    document.getElementById('escalaListaEmpregados').innerHTML = '';
    document.getElementById('escalaBuscaEmpresa').value = '';
    _renderizarListaEmpresasEscala(state.empresas);
    _atualizarResumoEmpresasSelecionadasEscala();
    _carregarGruposParaEscala();
}

let _gruposEscalaCache = [];
let _itensGruposEscalaCache = {};

async function _carregarGruposParaEscala() {
    try {
        const [{ data: grupos, error: errG }, { data: itens, error: errI }] = await Promise.all([
            supabaseClient.from('rh_grupos_empresas').select('id, nome_grupo').order('nome_grupo', { ascending: true }),
            supabaseClient.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
        ]);
        if (errG) throw errG;
        if (errI) throw errI;

        _itensGruposEscalaCache = {};
        (itens || []).forEach(it => {
            (_itensGruposEscalaCache[it.grupo_id] ??= new Set()).add(it.codigo_empresa);
        });
        _gruposEscalaCache = (grupos || []).map(g => ({
            id: g.id,
            nome_grupo: g.nome_grupo,
            qtdEmpresas: _itensGruposEscalaCache[g.id]?.size || 0,
        }));

        document.getElementById('escalaBuscaGrupo').value = '';
        _renderizarListaGruposEscala(_gruposEscalaCache);
    } catch (erro) {
        console.error('Erro ao carregar grupos de empresas:', erro);
    }
}

function _renderizarListaGruposEscala(grupos) {
    const container = document.getElementById('escalaListaGrupos');
    if (!container) return;
    if (!grupos || grupos.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhum grupo encontrado.</span>';
        return;
    }
    container.innerHTML = grupos.map(g => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="escala-grupo-check" value="${g.id}" onchange="_aplicarGruposEscala()">
            ${g.nome_grupo} <span style="color: var(--text-secondary);">(${g.qtdEmpresas})</span>
        </label>
    `).join('');
}

function _filtrarListaGruposEscala() {
    const termo = (document.getElementById('escalaBuscaGrupo').value || '').toLowerCase().trim();
    const marcados = new Set(Array.from(document.querySelectorAll('.escala-grupo-check:checked')).map(cb => cb.value));
    const lista = termo
        ? _gruposEscalaCache.filter(g => g.nome_grupo.toLowerCase().includes(termo))
        : _gruposEscalaCache;
    _renderizarListaGruposEscala(lista);
    marcados.forEach(id => {
        const cb = document.querySelector(`.escala-grupo-check[value="${id}"]`);
        if (cb) cb.checked = true;
    });
}

function _aplicarGruposEscala() {
    const idsMarcados = Array.from(document.querySelectorAll('.escala-grupo-check:checked')).map(cb => cb.value);
    if (idsMarcados.length === 0) return;

    const codigosParaMarcar = new Set(
        Array.from(document.querySelectorAll('.escala-emp-check:checked')).map(cb => cb.value)
    );
    idsMarcados.forEach(id => {
        (_itensGruposEscalaCache[id] || new Set()).forEach(codigo => codigosParaMarcar.add(codigo));
    });

    document.getElementById('escalaBuscaEmpresa').value = '';
    _renderizarListaEmpresasEscala(state.empresas);
    document.querySelectorAll('.escala-emp-check').forEach(cb => {
        cb.checked = codigosParaMarcar.has(cb.value);
    });
    _atualizarResumoEmpresasSelecionadasEscala();
}

function _renderizarListaEmpresasEscala(empresas) {
    const container = document.getElementById('escalaListaEmpresas');
    if (!empresas || empresas.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhuma empresa encontrada.</span>';
        return;
    }
    container.innerHTML = empresas.map(e => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="escala-emp-check" value="${e.codigo_empresa}" onchange="_atualizarResumoEmpresasSelecionadasEscala()">
            <span style="font-family:monospace; color:var(--primary-color); font-weight:600;">${e.codigo_empresa}</span> ${e.nome_empresa}
        </label>
    `).join('');
}

function _filtrarListaEmpresasEscala() {
    const termo = (document.getElementById('escalaBuscaEmpresa').value || '').toLowerCase().trim();
    const marcados = new Set(Array.from(document.querySelectorAll('.escala-emp-check:checked')).map(cb => cb.value));
    const lista = termo
        ? state.empresas.filter(e => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo))
        : state.empresas;
    _renderizarListaEmpresasEscala(lista);
    marcados.forEach(codigo => {
        const cb = document.querySelector(`.escala-emp-check[value="${codigo}"]`);
        if (cb) cb.checked = true;
    });
}

function _selecionarTodasEmpresasEscala(marcar) {
    document.querySelectorAll('.escala-emp-check').forEach(cb => { cb.checked = marcar; });
    _atualizarResumoEmpresasSelecionadasEscala();
}

function _atualizarResumoEmpresasSelecionadasEscala() {
    const info = document.getElementById('escalaEmpresasSelecionadasInfo');
    if (!info) return;
    const marcados = Array.from(document.querySelectorAll('.escala-emp-check:checked'));
    if (marcados.length === 0) {
        info.textContent = 'Nenhuma empresa selecionada.';
        return;
    }
    const nomes = marcados.map(cb => {
        const emp = state.empresas.find(e => e.codigo_empresa === cb.value);
        return `${cb.value} - ${emp?.nome_empresa || cb.value}`;
    });
    info.textContent = `${marcados.length} empresa(s) selecionada(s): ${nomes.join(', ')}`;
}

// Os campos JSONB de rh_escala_trabalho são gravados via JSON.stringify (mesmo
// padrão de rh_saves.flags_folga/dsr_dias) e por isso precisam de JSON.parse na leitura.
function _parsearCamposEscala(row) {
    if (!row) return row;
    return {
        ...row,
        dias_semana: row.dias_semana ? JSON.parse(row.dias_semana) : null,
        datas_folga: row.datas_folga ? JSON.parse(row.datas_folga) : null,
        padrao_blocos: row.padrao_blocos ? JSON.parse(row.padrao_blocos) : null,
    };
}

const DIAS_SEMANA_ESCALA = [
    { chave: 'segunda', label: 'Seg' }, { chave: 'terca', label: 'Ter' }, { chave: 'quarta', label: 'Qua' },
    { chave: 'quinta', label: 'Qui' }, { chave: 'sexta', label: 'Sex' }, { chave: 'sabado', label: 'Sáb' },
    { chave: 'domingo', label: 'Dom' }
];

async function gerarEscala() {
    const comp = document.getElementById('escalaCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe uma competência válida (MM/AAAA).'); return; }
    const codigosEmpresas = Array.from(document.querySelectorAll('.escala-emp-check:checked')).map(cb => cb.value);
    if (codigosEmpresas.length === 0) { mostrarMensagem('Aviso', 'Selecione pelo menos uma empresa.'); return; }

    mostrarMensagem('Aguarde', 'Calculando escala...');
    try {
        const [
            { data: empregadosData, error: errFunc },
            { data: escalasData, error: errEsc },
            { data: feriasData, error: errFer },
        ] = await Promise.all([
            supabaseClient.from('rh_empregados').select('codigo_empresa, codigo_empregado, nome_empregado, situacao, tipo_empregado').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_escala_trabalho').select('*').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_ferias_calculadas').select('codigo_empresa, codigo_empregado, ferias_inicio, ferias_fim').in('codigo_empresa', codigosEmpresas),
        ]);
        if (errFunc) throw errFunc;
        if (errEsc) throw errEsc;
        if (errFer) throw errFer;

        const escalasMapa = {};
        (escalasData || []).forEach(e => { escalasMapa[`${e.codigo_empresa}_${e.codigo_empregado}`] = _parsearCamposEscala(e); });

        const feriasMapa = {};
        (feriasData || []).forEach(f => {
            const chave = `${f.codigo_empresa}_${f.codigo_empregado}`;
            (feriasMapa[chave] ??= []).push({ inicio: f.ferias_inicio, fim: f.ferias_fim });
        });

        const empregadosFiltrados = (empregadosData || []).filter(e =>
            (e.situacao || '').trim() === 'Trabalhando' && (e.tipo_empregado || '').trim() === 'Empregado'
        );

        if (empregadosFiltrados.length === 0) {
            fecharModalMensagem();
            mostrarMensagem('Aviso', 'Nenhum empregado (situação "Trabalhando") encontrado para as empresas selecionadas.');
            document.getElementById('escalaResultadoContainer').style.display = 'none';
            return;
        }

        const linhas = empregadosFiltrados.map(emp => {
            const escala = escalasMapa[`${emp.codigo_empresa}_${emp.codigo_empregado}`] || null;
            const empresa = state.empresas.find(e => e.codigo_empresa === emp.codigo_empresa);
            const periodosFerias = feriasMapa[`${emp.codigo_empresa}_${emp.codigo_empregado}`];
            return {
                codigo_empresa: emp.codigo_empresa,
                nome_empresa: empresa?.nome_empresa || emp.codigo_empresa,
                codigo_empregado: emp.codigo_empregado,
                nome_empregado: emp.nome_empregado,
                escala,
                periodosFerias,
                feriasTexto: _periodosFeriasNoMesTexto(periodosFerias, comp),
                resumo: calcularResumoMes(escala, comp, periodosFerias),
                expandido: false
            };
        });

        linhas.sort((a, b) => (a.nome_empresa + a.nome_empregado).localeCompare(b.nome_empresa + b.nome_empregado));

        fecharModalMensagem();
        state._escalaLinhas = linhas;
        state._escalaCompetencia = comp;
        _renderizarListaEscala();
    } catch (erro) {
        console.error('Erro ao gerar escala:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar a escala: ' + erro.message);
    }
}

function _badgeTipoEscala(escala) {
    if (!escala) return '<span style="color:#B8860B;">⚠️ Sem escala — padrão 5x2</span>';
    if (escala.tipo_escala === 'fixa') return '<span style="color:var(--success-color);">Fixa</span>';
    if (escala.tipo_escala === 'variavel_datas') return '<span style="color:var(--primary-color);">Variável — datas de folga</span>';
    if (escala.tipo_escala === 'variavel_padrao') return '<span style="color:var(--primary-color);">Variável — padrão de repetição</span>';
    return '';
}

function _renderizarListaEscala() {
    const linhas = state._escalaLinhas || [];
    const container = document.getElementById('escalaListaEmpregados');
    const info = document.getElementById('escalaResultadoInfo');
    info.textContent = `${linhas.length} empregado(s)`;

    container.innerHTML = linhas.map((l, i) => `
        <div class="escala-linha" data-idx="${i}" style="border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; flex-wrap:wrap; gap:8px; cursor:pointer;" onclick="_toggleExpandirEscala(${i})">
                <div>
                    <strong>${l.codigo_empregado} - ${l.nome_empregado}</strong>
                    <div style="font-size:12px; color:var(--text-secondary);">${l.codigo_empresa} - ${l.nome_empresa}</div>
                    ${l.feriasTexto ? `<div style="font-size:12px; color:#2C7BE5; margin-top:2px;">🏖️ Férias: ${l.feriasTexto}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:16px; font-size:13px;">
                    <span>${_badgeTipoEscala(l.escala)}</span>
                    <span>✅ ${l.resumo.totalTrabalho} trabalho</span>
                    <span>🌴 ${l.resumo.totalFolga} folga${l.resumo.totalFerias ? ` (${l.resumo.totalFerias} de férias)` : ''}</span>
                    <span style="font-size:16px;">${l.expandido ? '▲' : '▼'}</span>
                </div>
            </div>
            <div class="escala-detalhe" style="display:${l.expandido ? 'block' : 'none'}; border-top:1px solid var(--border-color); padding:14px; background:var(--background-color);">
                ${l.expandido ? _renderizarDetalheEscala(l, i) : ''}
            </div>
        </div>
    `).join('');

    document.getElementById('escalaResultadoContainer').style.display = 'block';
}

// Preenche os campos _form* a partir da escala salva de uma linha. Só sobrescreve
// campos ainda não inicializados, a menos que forcar=true (usado logo após salvar,
// quando o form precisa refletir o que acabou de ir para o banco).
function _inicializarFormEscala(linha, forcar) {
    const semEscala = !linha.escala;
    if (forcar || linha._formTipo === undefined) {
        linha._formTipo = semEscala ? 'fixa' : (linha.escala.tipo_escala === 'fixa' ? 'fixa' : 'variavel');
    }
    if (forcar || linha._formSubtipoVariavel === undefined) {
        linha._formSubtipoVariavel = (!semEscala && linha.escala.tipo_escala === 'variavel_padrao') ? 'padrao' : 'datas';
    }
    if (forcar || linha._formDiasSemana === undefined) {
        linha._formDiasSemana = linha.escala?.dias_semana ? linha.escala.dias_semana.slice() : [];
    }
    if (forcar || linha._formDatasFolga === undefined) {
        linha._formDatasFolga = linha.escala?.datas_folga ? linha.escala.datas_folga.slice() : [];
    }
    if (forcar || linha._formAncora === undefined) {
        linha._formAncora = linha.escala?.padrao_ancora || '';
    }
    if (forcar || linha._formBlocos === undefined) {
        linha._formBlocos = linha.escala?.padrao_blocos ? linha.escala.padrao_blocos.map(b => ({ ...b })) : [];
    }
}

function _toggleExpandirEscala(idx) {
    const linha = state._escalaLinhas[idx];
    linha.expandido = !linha.expandido;
    _inicializarFormEscala(linha, false);
    _renderizarListaEscala();
}

function _renderizarDetalheEscala(linha, idx) {
    return `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items:start;">
            <div>
                <h4 style="margin:0 0 10px; font-size:13px; color:var(--text-primary);">Configurar Escala</h4>
                ${_renderizarFormConfigEscala(linha, idx)}
            </div>
            <div>
                <h4 style="margin:0 0 10px; font-size:13px; color:var(--text-primary);">Calendário — ${state._escalaCompetencia}</h4>
                ${_renderizarMiniCalendarioEscala(linha)}
            </div>
        </div>
    `;
}

function _renderizarMiniCalendarioEscala(linha) {
    const primeiroDiaSemana = { Dom: 0, Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, Sab: 6 }[linha.resumo.dias[0].diaSemana];
    const celulasVazias = Array.from({ length: primeiroDiaSemana }, () => '<div></div>').join('');
    const celulasDias = linha.resumo.dias.map(d => {
        const cor = d.ferias ? '#2C7BE5' : (d.tipo === 'trabalho' ? '#27AE60' : '#B8860B');
        const rotulo = d.ferias ? 'férias' : d.tipo;
        const dia = d.data.split('/')[0];
        return `<div title="${d.data} — ${rotulo}" style="text-align:center; padding:4px 2px; border-radius:4px; background:${cor}22; color:${cor}; font-weight:600; font-size:12px;">${dia}</div>`;
    }).join('');
    return `
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px; font-size:11px;">
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">D</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">S</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">T</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">Q</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">Q</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">S</div>
            <div style="text-align:center; font-weight:700; color:var(--text-secondary);">S</div>
            ${celulasVazias}${celulasDias}
        </div>
    `;
}

function _renderizarFormConfigEscala(linha, idx) {
    const tipo = linha._formTipo;
    const subtipo = linha._formSubtipoVariavel;
    return `
        <div style="display:flex; gap:14px; margin-bottom:10px; font-size:13px;">
            <label style="cursor:pointer;"><input type="radio" name="escalaTipo${idx}" value="fixa" ${tipo === 'fixa' ? 'checked' : ''} onchange="_alternarTipoEscalaForm(${idx}, 'fixa')"> Fixa</label>
            <label style="cursor:pointer;"><input type="radio" name="escalaTipo${idx}" value="variavel" ${tipo === 'variavel' ? 'checked' : ''} onchange="_alternarTipoEscalaForm(${idx}, 'variavel')"> Variável</label>
        </div>
        <div id="escalaFormFixa${idx}" style="display:${tipo === 'fixa' ? 'block' : 'none'};">
            <button type="button" class="btn btn-secondary btn-small" style="margin-bottom:8px;" onclick="_marcarDiasUteisFixa(${idx})">Dias úteis (Seg-Sex)</button>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${DIAS_SEMANA_ESCALA.map(d => `
                    <label style="display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" class="escala-dia-semana-check-${idx}" value="${d.chave}" ${linha._formDiasSemana.includes(d.chave) ? 'checked' : ''}>
                        ${d.label}
                    </label>
                `).join('')}
            </div>
        </div>
        <div id="escalaFormVariavel${idx}" style="display:${tipo === 'variavel' ? 'block' : 'none'};">
            <div style="display:flex; gap:14px; margin-bottom:10px; font-size:13px;">
                <label style="cursor:pointer;"><input type="radio" name="escalaSubtipo${idx}" value="datas" ${subtipo === 'datas' ? 'checked' : ''} onchange="_alternarSubtipoVariavelEscalaForm(${idx}, 'datas')"> Dias de folga específicos</label>
                <label style="cursor:pointer;"><input type="radio" name="escalaSubtipo${idx}" value="padrao" ${subtipo === 'padrao' ? 'checked' : ''} onchange="_alternarSubtipoVariavelEscalaForm(${idx}, 'padrao')"> Padrão de repetição</label>
            </div>
            <div id="escalaSubDatas${idx}" style="display:${subtipo === 'datas' ? 'block' : 'none'};">
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <input type="date" id="escalaNovaDataFolga${idx}" style="flex:1;">
                    <button type="button" class="btn btn-secondary btn-small" onclick="_adicionarDataFolgaEscala(${idx})">➕ Adicionar</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${linha._formDatasFolga.map(data => `
                        <span style="background:#eee; border-radius:12px; padding:3px 10px; font-size:12px; display:flex; align-items:center; gap:6px;">
                            ${_isoParaBR(data)}
                            <span style="cursor:pointer; font-weight:700;" onclick="_removerDataFolgaEscala(${idx}, '${data}')">×</span>
                        </span>
                    `).join('') || '<span style="font-size:12px; color:var(--text-secondary);">Nenhuma data de folga adicionada.</span>'}
                </div>
            </div>
            <div id="escalaSubPadrao${idx}" style="display:${subtipo === 'padrao' ? 'block' : 'none'};">
                <div class="form-group" style="max-width:220px; margin-bottom:10px;">
                    <label>Data âncora (início do 1º bloco)</label>
                    <input type="date" id="escalaAncora${idx}" value="${linha._formAncora}" onchange="_atualizarAncoraEscala(${idx})">
                </div>
                <div id="escalaBlocosLista${idx}">
                    ${linha._formBlocos.map((b, bi) => `
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                            <select id="escalaBlocoTipo${idx}_${bi}" onchange="_atualizarBlocoEscala(${idx}, ${bi})" style="flex:1;">
                                <option value="trabalho" ${b.tipo === 'trabalho' ? 'selected' : ''}>Trabalha</option>
                                <option value="folga" ${b.tipo === 'folga' ? 'selected' : ''}>Folga</option>
                            </select>
                            <input type="number" min="1" id="escalaBlocoDias${idx}_${bi}" value="${b.dias}" oninput="_atualizarBlocoEscala(${idx}, ${bi})" style="width:70px;"> dias
                            <span style="cursor:pointer; font-weight:700; color:var(--danger-color);" onclick="_removerBlocoEscala(${idx}, ${bi})">×</span>
                        </div>
                    `).join('') || '<span style="font-size:12px; color:var(--text-secondary);">Nenhum bloco adicionado.</span>'}
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="_adicionarBlocoEscala(${idx})">➕ Adicionar Bloco</button>
            </div>
        </div>
        <button type="button" class="btn btn-primary btn-small" style="margin-top:14px;" onclick="_salvarEscalaEmpregado(${idx})">💾 Salvar Escala</button>
    `;
}

function _alternarTipoEscalaForm(idx, tipo) {
    state._escalaLinhas[idx]._formTipo = tipo;
    _renderizarListaEscala();
}

function _alternarSubtipoVariavelEscalaForm(idx, subtipo) {
    state._escalaLinhas[idx]._formSubtipoVariavel = subtipo;
    _renderizarListaEscala();
}

function _marcarDiasUteisFixa(idx) {
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
    _renderizarListaEscala();
}

function _lerDiasSemanaFormAtual(idx) {
    return Array.from(document.querySelectorAll(`.escala-dia-semana-check-${idx}:checked`)).map(cb => cb.value);
}

function _adicionarDataFolgaEscala(idx) {
    const input = document.getElementById(`escalaNovaDataFolga${idx}`);
    if (!input.value) return;
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = _lerDiasSemanaFormAtual(idx); // preserva seleção da aba Fixa ao re-renderizar
    if (!linha._formDatasFolga.includes(input.value)) {
        linha._formDatasFolga.push(input.value);
        linha._formDatasFolga.sort();
    }
    _renderizarListaEscala();
}

function _removerDataFolgaEscala(idx, data) {
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = _lerDiasSemanaFormAtual(idx);
    linha._formDatasFolga = linha._formDatasFolga.filter(d => d !== data);
    _renderizarListaEscala();
}

function _atualizarAncoraEscala(idx) {
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = _lerDiasSemanaFormAtual(idx);
    linha._formAncora = document.getElementById(`escalaAncora${idx}`).value;
}

function _adicionarBlocoEscala(idx) {
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = _lerDiasSemanaFormAtual(idx);
    linha._formAncora = document.getElementById(`escalaAncora${idx}`)?.value || linha._formAncora;
    linha._formBlocos.push({ tipo: 'trabalho', dias: 1 });
    _renderizarListaEscala();
}

function _removerBlocoEscala(idx, blocoIdx) {
    const linha = state._escalaLinhas[idx];
    linha._formDiasSemana = _lerDiasSemanaFormAtual(idx);
    linha._formAncora = document.getElementById(`escalaAncora${idx}`)?.value || linha._formAncora;
    linha._formBlocos.splice(blocoIdx, 1);
    _renderizarListaEscala();
}

function _atualizarBlocoEscala(idx, blocoIdx) {
    const linha = state._escalaLinhas[idx];
    const tipo = document.getElementById(`escalaBlocoTipo${idx}_${blocoIdx}`).value;
    const dias = parseInt(document.getElementById(`escalaBlocoDias${idx}_${blocoIdx}`).value, 10) || 1;
    linha._formBlocos[blocoIdx] = { tipo, dias };
}

async function _salvarEscalaEmpregado(idx) {
    const linha = state._escalaLinhas[idx];
    const tipo = linha._formTipo;

    let escala;
    if (tipo === 'fixa') {
        escala = { tipo_escala: 'fixa', dias_semana: _lerDiasSemanaFormAtual(idx) };
    } else if (linha._formSubtipoVariavel === 'datas') {
        escala = { tipo_escala: 'variavel_datas', datas_folga: linha._formDatasFolga };
    } else {
        escala = {
            tipo_escala: 'variavel_padrao',
            padrao_ancora: document.getElementById(`escalaAncora${idx}`)?.value || linha._formAncora,
            padrao_blocos: linha._formBlocos
        };
    }

    const validacao = validarConfigEscala(escala);
    if (!validacao.ok) { mostrarMensagem('Aviso', validacao.erro); return; }

    mostrarMensagem('Aguarde', 'Salvando escala...');
    try {
        const registro = {
            codigo_empresa: linha.codigo_empresa,
            nome_empresa: linha.nome_empresa,
            codigo_empregado: linha.codigo_empregado,
            nome_empregado: linha.nome_empregado,
            tipo_escala: escala.tipo_escala,
            dias_semana: escala.dias_semana ? JSON.stringify(escala.dias_semana) : null,
            datas_folga: escala.datas_folga ? JSON.stringify(escala.datas_folga) : null,
            padrao_ancora: escala.padrao_ancora || null,
            padrao_blocos: escala.padrao_blocos ? JSON.stringify(escala.padrao_blocos) : null,
            atualizado_em: new Date().toISOString()
        };
        const { data, error } = await supabaseClient
            .from('rh_escala_trabalho')
            .upsert(registro, { onConflict: 'codigo_empresa,codigo_empregado' })
            .select()
            .single();
        if (error) throw error;

        linha.escala = _parsearCamposEscala(data);
        linha.resumo = calcularResumoMes(linha.escala, state._escalaCompetencia, linha.periodosFerias);
        // A linha pode continuar expandida após salvar — o form precisa refletir
        // o que acabou de ir para o banco, por isso forcar=true aqui.
        _inicializarFormEscala(linha, true);

        fecharModalMensagem();
        _renderizarListaEscala();
    } catch (erro) {
        console.error('Erro ao salvar escala:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao salvar a escala: ' + erro.message);
    }
}

// --- NAVEGAÇÃO E UTILITÁRIOS ---
function atualizarBannerObservacoes() {
    const obsBanner = document.getElementById('empresaObservacoesBanner');
    if (obsBanner) {
        obsBanner.style.display = obsBanner.dataset.temObservacao === '1' ? 'flex' : 'none';
    }
}

function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('gruposScreen').style.display = 'none';
    document.getElementById('beneficiosScreen').style.display = 'none';
    document.getElementById('escalaScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    if (telaId === 'gruposScreen') carregarGrupos();
    if (telaId === 'beneficiosScreen') _iniciarTelaBeneficios();
    if (telaId === 'escalaScreen') _iniciarTelaEscala();

    const telasSemHeaderPadrao = ['selectionScreen', 'gruposScreen', 'beneficiosScreen', 'escalaScreen'];

    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = telasSemHeaderPadrao.includes(telaId) ? 'none' : 'block';

    const sub = document.getElementById('pageHeaderSub');
    if (sub) {
        if (!telasSemHeaderPadrao.includes(telaId) && state.empresaSelecionada) {
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}`;
        } else {
            sub.textContent = 'Selecione a competência e empresa para começar';
        }
    }

    atualizarBannerObservacoes();
    if (telasSemHeaderPadrao.includes(telaId) && telaId !== 'selectionScreen') {
        const obsBanner = document.getElementById('empresaObservacoesBanner');
        if (obsBanner) obsBanner.style.display = 'none';
    }
    _atualizarBannerFilaLote(telaId);
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

// ===== FÉRIAS CALCULADAS =====

function _dataEmFerias(dataBR, empregadoId) {
    const periodos = state.feriasCalculadas[empregadoId];
    if (!periodos || periodos.length === 0) return false;
    const [d, m, a] = dataBR.split('/');
    const iso = `${a}-${m}-${d}`;
    return periodos.some(p => iso >= p.inicio && iso <= p.fim);
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
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    _catalogoRubricasAtual = codEmp ? await _buscarCatalogoRubricas(codEmp) : [];
    document.getElementById('resNaoCompensar').checked = cfg?.['nao_compensar_extras']?.cod === '1';
    _toggleNaoCompensar('res');
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

    const rubSel = document.createElement('select');
    rubSel.className = 'lanc-rubrica';
    rubSel.style.cssText = 'padding:5px 6px;border:1px solid #ced4da;border-radius:4px;font-size:12px;width:100%;';
    let rubOptsHtml = '<option value="">Selecione...</option>';
    _catalogoRubricasAtual.forEach(r => {
        const desc = r.descricao_rubrica || '(sem descrição)';
        rubOptsHtml += `<option value="${r.codigo_rubrica}">${desc} (${r.codigo_rubrica})</option>`;
    });
    rubOptsHtml += '<option value="__manual__">Outra rubrica (digitar código)</option>';
    rubSel.innerHTML = rubOptsHtml;

    const rubManual = document.createElement('input');
    rubManual.type = 'text';
    rubManual.className = 'lanc-rubrica-manual';
    rubManual.maxLength = 9;
    rubManual.placeholder = 'Ex: 000610';
    rubManual.style.cssText = 'display:none;grid-column:1 / -1;padding:5px 6px;border:1px solid #ced4da;border-radius:4px;font-size:12px;font-family:monospace;width:100%;box-sizing:border-box;margin-top:6px;';
    rubManual.oninput = function() { this.value = this.value.replace(/\D/g, ''); };

    rubSel.onchange = function() {
        const manual = this.value === '__manual__';
        rubManual.style.display = manual ? 'block' : 'none';
        if (!manual) rubManual.value = '';
    };

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
    row.appendChild(rubSel);
    row.appendChild(tipoSel);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    row.appendChild(rubManual);
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
        const codEmp = (row.querySelector('.lanc-empregado')?.value || '').trim();
        const rubricaSel = row.querySelector('.lanc-rubrica')?.value || '';
        const rubrica = rubricaSel === '__manual__'
            ? (row.querySelector('.lanc-rubrica-manual')?.value || '').trim()
            : rubricaSel;
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

function _calcularDiasDescontoVAVT(resultados, valoresVaVtMapa = {}) {
    return (resultados || [])
        .map(res => {
            const dias = (res.dias || []).filter(d => d.flagFalta || d.flagAtestado).length;
            const valores = valoresVaVtMapa[res.empregadoId] || {};
            const valorVT = valores.vt || 0;
            const valorVA = valores.va || 0;
            return {
                nome: res.nome,
                empregadoId: res.empregadoId,
                dias,
                valorVT,
                valorVA,
                totalVT: dias * valorVT,
                totalVA: dias * valorVA,
            };
        })
        .filter(item => item.dias > 0);
}

function _formatarMoeda(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function _construirConteudoTXTResultados(salvar = false) {
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
    const valoresVaVtMapa = await _buscarValoresVaVtEmpresa(codEmpresa);

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
        const diasDescontoVAVT = res.dias.filter(d => d.flagFalta || d.flagAtestado).length;
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
            diasFaltaRes.length,
            diasDescontoVAVT,
            valoresVaVtMapa[res.empregadoId],
            diasFaltaRes
        );
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

async function gerarPreviewTXTResultados() {
    try {
        const { conteudoTXT } = await _construirConteudoTXTResultados(false);
        _mostrarPrevia('resTxtPrevia', 'resTxtPreviaConteudo', 'resTxtPreviaInfo', '#txtRubricasModal', conteudoTXT);
    } catch (erro) {
        mostrarMensagem('Aviso', erro.message);
    }
}

async function gerarTXTResultados() {
    const codEmpresa = state.empresaSelecionada?.codigo_empresa;
    const valoresVaVtMapa = await _buscarValoresVaVtEmpresa(codEmpresa);
    const listaDesconto = _calcularDiasDescontoVAVT(state.resultados, valoresVaVtMapa);
    if (listaDesconto.length > 0) {
        _abrirModalAvisoDescontos(listaDesconto);
        return;
    }
    _efetivarDownloadTXTResultados();
}

function _abrirModalAvisoDescontos(lista) {
    const tbody = document.getElementById('avisoDescontosTbody');
    tbody.innerHTML = lista.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nome}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.dias}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${_formatarMoeda(item.valorVT)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${_formatarMoeda(item.totalVT)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${_formatarMoeda(item.valorVA)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${_formatarMoeda(item.totalVA)}</td>
        </tr>
    `).join('');
    document.getElementById('avisoDescontosModal').classList.add('active');
}

function _fecharModalAvisoDescontos() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
}

function _continuarDownloadAposAviso() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
    _efetivarDownloadTXTResultados();
}

async function _efetivarDownloadTXTResultados() {
    try {
        const { conteudoTXT } = await _construirConteudoTXTResultados(true);
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
