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

// Catálogo de rubricas (rh_rubricas) das empresas do lote — sugestão no modo manual do Passo 3
let catalogoRubricasLote = [];

// Catálogo agrupado por descrição (mesma rubrica em empresas diferentes, códigos possivelmente distintos)
let rubricasCatalogoAgrupadas = []; // [{ descricao, codigosPorEmpresa: {codEmpresa: codigo} }]

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
            .select('codigo_empresa, nome_empresa, status_situacao')
            .order('nome_empresa', { ascending: true });

        if (error) throw error;

        // Só empresas ativas (mesmo critério da Administração: sem status = ativa por padrão)
        const isEmpresaAtiva = s => !s || String(s).trim().toLowerCase().startsWith('ativ');
        empresasCadastradas = (data || []).filter(emp => isEmpresaAtiva(emp.status_situacao));

        container.innerHTML = '';
        if (empresasCadastradas.length === 0) {
            container.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">Nenhuma empresa ativa cadastrada no sistema.</div>';
            return;
        }

        empresasCadastradas.forEach(emp => {
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

    const codigosEmpresasLote = empresasDoLote();
    await Promise.all([
        carregarConfigRubricasLote(codigosEmpresasLote),
        carregarCatalogoRubricasLote(codigosEmpresasLote),
    ]);

    renderObservacoesLote();
    renderSeletorRubricaCatalogo();
    renderCatalogoRubricasDatalist();
    atualizarPlaceholderValorPadrao();
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

async function carregarCatalogoRubricasLote(codigosEmpresa) {
    catalogoRubricasLote = [];
    if (!codigosEmpresa || codigosEmpresa.length === 0) return;

    const { data, error } = await supabaseClient
        .from('rh_rubricas')
        .select('codigo_empresa, codigo_rubrica, descricao_rubrica, tipo')
        .in('codigo_empresa', codigosEmpresa);

    if (error) {
        console.error('Erro ao buscar catálogo de rubricas do lote:', error);
        return;
    }

    catalogoRubricasLote = data || [];
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

// --- Detecção e tratamento de rubricas "Dias Falta" / "Dias Falta DSR" ---

function _normalizarDescricaoRubrica(descricao) {
    return String(descricao || '').toUpperCase().trim().replace(/\.+$/, '').trim();
}

function detectarFaltaTipo(descricao) {
    const norm = _normalizarDescricaoRubrica(descricao);
    if (!norm.includes('DIAS FALTAS')) return null;
    return norm.includes('DSR') ? 'dsr' : 'normal';
}

function placeholderColuna(coluna) {
    if (coluna.faltaTipo) {
        return { placeholder: 'Ex: 5,12,20', dica: 'Dias do mês da competência com falta, separados por vírgula' };
    }
    return infoTipoValor(coluna.tipoValor);
}

function parseDiasFalta(valor) {
    return [...new Set(String(valor).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)))].sort((a, b) => a - b);
}

function ultimoDiaDoMes(comp) {
    const [mes, ano] = comp.split('/').map(Number);
    return new Date(ano, mes, 0).getDate();
}

function validarFormatoDiasFalta(valor, comp) {
    const v = String(valor).trim();
    if (!v) return { ok: false, motivo: 'vazio' };
    if (!/^\d{1,2}(\s*,\s*\d{1,2})*$/.test(v)) return { ok: false, motivo: 'formato' };
    const ultimoDia = ultimoDiaDoMes(comp);
    const diaInvalido = parseDiasFalta(v).find(d => d < 1 || d > ultimoDia);
    if (diaInvalido !== undefined) return { ok: false, motivo: 'intervalo', diaInvalido, ultimoDia };
    return { ok: true };
}

function _aplicarTravaFaltaNoFormulario(faltaTipo) {
    const tipoSelect = document.getElementById('gradeRubricaTipoValor');
    const valorPadraoInput = document.getElementById('gradeRubricaValorPadrao');
    const dica = document.getElementById('gradeRubricaValorPadraoDica');

    if (faltaTipo) {
        tipoSelect.value = 'dias';
        tipoSelect.disabled = true;
        valorPadraoInput.placeholder = 'Ex: 5,12,20';
        dica.textContent = 'Detectado como rubrica de Dias de Falta' + (faltaTipo === 'dsr' ? ' (com perda de DSR)' : '') +
            ' — informe os dias do mês separados por vírgula (aplica a todos; edite depois por empregado).';
    } else {
        tipoSelect.disabled = false;
        atualizarPlaceholderValorPadrao();
    }
}

function onCodigoManualInput() {
    const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
    const catalogado = catalogoRubricasLote.find(r => r.codigo_rubrica === codigo);
    const faltaTipo = catalogado ? detectarFaltaTipo(catalogado.descricao_rubrica) : null;
    _aplicarTravaFaltaNoFormulario(faltaTipo);
}

function atualizarPlaceholderValorPadrao() {
    const tipo = document.getElementById('gradeRubricaTipoValor').value;
    const input = document.getElementById('gradeRubricaValorPadrao');
    const dica = document.getElementById('gradeRubricaValorPadraoDica');
    const info = infoTipoValor(tipo);
    input.placeholder = info.placeholder;
    dica.textContent = info.dica;
}

function renderObservacoesLote() {
    const container = document.getElementById('obsEmpresasLote');
    const codigosEmpresasLote = empresasDoLote();

    const linhas = codigosEmpresasLote
        .map(cod => {
            const cfg = configRubricasPorEmpresa[cod] && configRubricasPorEmpresa[cod]['observacoes'];
            const texto = cfg && cfg.codigo ? cfg.codigo.trim() : '';
            return texto ? `<strong>${nomeEmpresaPorCodigo(cod)}:</strong> ${texto}` : null;
        })
        .filter(Boolean);

    if (linhas.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.innerHTML = linhas.map(l => `<div style="margin-bottom: 6px;">${l}</div>`).join('');
    container.style.display = 'block';
}

function renderCatalogoRubricasDatalist() {
    const datalist = document.getElementById('catalogoRubricasDatalist');
    datalist.innerHTML = catalogoRubricasLote.map(r => {
        const nomeEmp = nomeEmpresaPorCodigo(r.codigo_empresa);
        const desc = r.descricao_rubrica || '(sem descrição)';
        const tipo = r.tipo ? ` · ${r.tipo}` : '';
        return `<option value="${r.codigo_rubrica}">${desc} — ${nomeEmp}${tipo}</option>`;
    }).join('');
}

function renderSeletorRubricaCatalogo() {
    const select = document.getElementById('gradeRubricaSelecao');

    const grupos = new Map();
    catalogoRubricasLote.forEach(r => {
        const desc = (r.descricao_rubrica || '').trim();
        if (!desc) return;
        const chave = desc.toLowerCase();
        if (!grupos.has(chave)) grupos.set(chave, { descricao: desc, codigosPorEmpresa: {}, tipos: new Set() });
        grupos.get(chave).codigosPorEmpresa[r.codigo_empresa] = r.codigo_rubrica;
        if (r.tipo) grupos.get(chave).tipos.add(r.tipo);
    });

    rubricasCatalogoAgrupadas = Array.from(grupos.values())
        .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));

    let html = '<option value="">Selecione...</option>';
    rubricasCatalogoAgrupadas.forEach((item, idx) => {
        const codigosUnicos = [...new Set(Object.values(item.codigosPorEmpresa))];
        const detalhe = codigosUnicos.length === 1
            ? codigosUnicos[0]
            : Object.entries(item.codigosPorEmpresa).map(([cod, codigo]) => `${nomeEmpresaPorCodigo(cod)}: ${codigo}`).join(', ');
        const tipo = item.tipos.size > 0 ? ` — ${[...item.tipos].join('/')}` : '';
        html += `<option value="${idx}">${item.descricao}${tipo} (${detalhe})</option>`;
    });
    html += '<option value="__manual__">Outra rubrica (digitar código)</option>';

    select.innerHTML = html;
    onRubricaSelecaoChange();
}

function onRubricaSelecaoChange() {
    const select = document.getElementById('gradeRubricaSelecao');
    const isManual = select.value === '__manual__';
    document.getElementById('gradeRubricaManualFields').style.display = isManual ? 'block' : 'none';

    if (isManual) {
        onCodigoManualInput();
        return;
    }

    const item = rubricasCatalogoAgrupadas[Number(select.value)];
    _aplicarTravaFaltaNoFormulario(item ? detectarFaltaTipo(item.descricao) : null);
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

function resolverCodigoRubrica(coluna, codEmpresa) {
    if (coluna.codigo) return coluna.codigo;
    return coluna.codigosPorEmpresa ? coluna.codigosPorEmpresa[codEmpresa] : undefined;
}

function gerarConteudoTXT(comp, tipoProcesso, coluna, itens) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');

    let conteudo = '';
    itens.forEach(item => {
        const [codEmpresa, codEmpregado] = item.empregado.split('|');
        const codigoRubrica = resolverCodigoRubrica(coluna, codEmpresa);
        const rubFormatada = String(codigoRubrica).padStart(9, '0');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');

        const diasFalta = coluna.faltaTipo ? parseDiasFalta(item.valor) : null;
        const valorInt = coluna.faltaTipo ? diasFalta.length : encodeValorParaTipo(item.valor, coluna.tipoValor);
        const valFormatado = String(valorInt).padStart(9, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;

        if (coluna.faltaTipo && diasFalta.length > 0) {
            const flag = coluna.faltaTipo === 'dsr' ? '2' : '1';
            diasFalta.forEach(dia => {
                conteudo += `11${compFormatada}${String(dia).padStart(2, '0')}${flag}\n`;
            });
        }
    });

    return conteudo;
}

function adicionarRubricaGrade() {
    const select = document.getElementById('gradeRubricaSelecao');
    const tipoValorSelecionado = document.getElementById('gradeRubricaTipoValor').value;
    const valorPadrao = document.getElementById('gradeRubricaValorPadrao').value.trim();

    if (!select.value) {
        mostrarMensagem('Atenção', 'Selecione uma rubrica.');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    let novaColuna;

    if (select.value === '__manual__') {
        const codigo = document.getElementById('gradeRubricaCodigo').value.trim();

        if (!codigo || !/^\d+$/.test(codigo)) {
            mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
            return;
        }

        const catalogado = catalogoRubricasLote.find(r => r.codigo_rubrica === codigo);
        const label = catalogado ? `${catalogado.descricao_rubrica} (${codigo})` : `Rubrica ${codigo}`;
        const faltaTipo = catalogado ? detectarFaltaTipo(catalogado.descricao_rubrica) : null;

        novaColuna = { id: Date.now(), label, tipoValor: faltaTipo ? 'dias' : tipoValorSelecionado, codigo, faltaTipo };
    } else {
        const item = rubricasCatalogoAgrupadas[Number(select.value)];
        if (!item) {
            mostrarMensagem('Atenção', 'Rubrica inválida. Selecione novamente.');
            return;
        }
        const faltaTipo = detectarFaltaTipo(item.descricao);
        novaColuna = { id: Date.now(), label: item.descricao, tipoValor: faltaTipo ? 'dias' : tipoValorSelecionado, codigosPorEmpresa: { ...item.codigosPorEmpresa }, faltaTipo };
    }

    rubricasGrid.push(novaColuna);
    valoresGrid[novaColuna.id] = {};

    if (valorPadrao) {
        empregadosSelecionadosAtual.forEach(empKey => {
            valoresGrid[novaColuna.id][empKey] = valorPadrao;
        });
    }

    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    document.getElementById('gradeRubricaTipoValor').disabled = false;
    select.value = '';
    onRubricaSelecaoChange();

    renderGrade();
}

function removerRubricaGrade(id) {
    const rubrica = rubricasGrid.find(r => r.id === id);
    if (!rubrica) return;

    const temValores = valoresGrid[id] && Object.values(valoresGrid[id]).some(v => v && v.trim());
    if (temValores && !confirm(`A rubrica ${rubrica.label} já tem valores preenchidos. Remover mesmo assim?`)) {
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
    chipsContainer.innerHTML = rubricasGrid.map(r => {
        const sufixoFalta = r.faltaTipo === 'dsr' ? ' · falta c/ DSR' : (r.faltaTipo === 'normal' ? ' · falta' : '');
        return `
        <span class="chip-rubrica">
            ${r.label} (${r.tipoValor}${sufixoFalta})
            <span class="chip-remove" onclick="removerRubricaGrade(${r.id})">×</span>
        </span>
    `;
    }).join('');

    if (rubricasGrid.length === 0 || empregadosSelecionadosAtual.length === 0) {
        gradeContainer.innerHTML = '<div class="grade-empty-msg">Adicione ao menos uma rubrica acima para montar a grade.</div>';
        return;
    }

    let html = '<table class="grade-table"><thead><tr><th class="grade-emp-col">Empregado</th>';
    rubricasGrid.forEach(r => {
        html += `<th>${r.label}<br><small>${placeholderColuna(r).placeholder}</small></th>`;
    });
    html += '</tr></thead><tbody>';

    empregadosSelecionadosAtual.forEach(empKey => {
        const nome = empregadosInfoAtual[empKey] || empKey;
        const buscaAttr = nome.toLowerCase().replace(/"/g, '');
        html += `<tr data-emp-busca="${buscaAttr}"><td class="grade-emp-col">${nome}</td>`;
        rubricasGrid.forEach(r => {
            const valorAtual = (valoresGrid[r.id] && valoresGrid[r.id][empKey]) || '';
            const info = placeholderColuna(r);
            html += `<td><input type="text" class="grade-input" placeholder="${info.placeholder}" title="${info.dica}" value="${valorAtual}" onchange="atualizarValorCelula(${r.id}, '${empKey}', this.value)"></td>`;
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

            if (r.faltaTipo) {
                const validacao = validarFormatoDiasFalta(valor, comp);
                if (!validacao.ok) {
                    const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                    const detalhe = validacao.motivo === 'intervalo'
                        ? `dia ${validacao.diaInvalido} não existe na competência ${comp} (máx: ${validacao.ultimoDia})`
                        : 'use os dias do mês separados por vírgula (ex: 5,12,20)';
                    mostrarMensagem('Atenção', `Dias de falta inválidos para "${nomeEmp}" na rubrica ${r.label}: "${valor}" (${detalhe}).`);
                    return;
                }
            } else if (!validarFormatoValor(valor, r.tipoValor)) {
                const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                mostrarMensagem('Atenção', `Valor inválido para "${nomeEmp}" na rubrica ${r.label}: "${valor}". Corrija antes de gerar.`);
                return;
            }

            const [codEmpresaItem] = empKey.split('|');
            if (!resolverCodigoRubrica(r, codEmpresaItem)) {
                const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                mostrarMensagem('Atenção', `Empregado "${nomeEmp}" (empresa ${nomeEmpresaPorCodigo(codEmpresaItem)}): a rubrica "${r.label}" não está cadastrada no catálogo dessa empresa.`);
                return;
            }

            itens.push({
                empregado: empKey,
                valor: valor.trim(),
                nomeEmpregado: empregadosInfoAtual[empKey] || empKey
            });
        }

        if (itens.length === 0) {
            rubricasIgnoradas.push(r.label);
            continue;
        }

        const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, r, itens);

        novasParametrizacoes.push({
            id: Date.now() + Math.random(),
            competencia: comp,
            tipoProcesso: tipoProcesso,
            rubrica: r.label,
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
    document.getElementById('gradeRubricaTipoValor').disabled = false;
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
    document.getElementById('gradeRubricaTipoValor').disabled = false;
    document.getElementById('buscaEmpresa').value = '';
    document.getElementById('buscaEmpregado').value = '';
    atualizarPlaceholderValorPadrao();
    renderGrade();

    ativarStep('step1');
}

// --- ✅ NOVO: TELA DE CONFIGURAÇÕES DO LANÇAMENTO ---

let _cfgLancEmpresaAtual = null;

function abrirModalConfigLancamentos() {
    document.getElementById('cfgLancEmpresaBusca').value = '';
    document.getElementById('cfgLancConteudo').style.display = 'none';
    _cfgLancEmpresaAtual = null;
    renderListaEmpresasConfigLancamentos(empresasCadastradas);
    document.getElementById('configLancamentosModal').classList.add('active');
}

function fecharModalConfigLancamentos() {
    document.getElementById('configLancamentosModal').classList.remove('active');
}

function renderListaEmpresasConfigLancamentos(lista) {
    const container = document.getElementById('cfgLancListaEmpresas');
    container.innerHTML = lista.map(emp => `
        <div class="checkbox-item" style="cursor: pointer;" onclick="selecionarEmpresaConfigLancamentos('${emp.codigo_empresa}')">
            <label style="cursor: pointer; margin: 0;">${emp.codigo_empresa} - ${emp.nome_empresa}</label>
        </div>
    `).join('');
}

function filtrarEmpresaConfigLancamentos() {
    const termo = document.getElementById('cfgLancEmpresaBusca').value.toLowerCase();
    const filtradas = empresasCadastradas.filter(emp =>
        `${emp.codigo_empresa} ${emp.nome_empresa}`.toLowerCase().includes(termo)
    );
    renderListaEmpresasConfigLancamentos(filtradas);
}

async function _buscarLinhasConfigRubricas(codigoEmpresa) {
    const { data, error } = await supabaseClient
        .from('rh_config_rubricas_txt')
        .select('id, evento, codigo_rubrica, tipo_valor, descricao_rubrica')
        .eq('codigo_empresa', codigoEmpresa);

    if (error) {
        mostrarMensagem('Erro', 'Falha ao buscar configuração da empresa: ' + error.message);
        return [];
    }
    return data || [];
}

async function selecionarEmpresaConfigLancamentos(codigoEmpresa) {
    _cfgLancEmpresaAtual = codigoEmpresa;
    document.getElementById('cfgLancEmpresaBusca').value = `${codigoEmpresa} - ${nomeEmpresaPorCodigo(codigoEmpresa)}`;

    const linhas = await _buscarLinhasConfigRubricas(codigoEmpresa);
    renderConfigLancamentos(linhas);
    document.getElementById('cfgLancConteudo').style.display = 'block';
}

function renderConfigLancamentos(linhas) {
    const porEvento = {};
    linhas.forEach(l => { porEvento[l.evento] = l; });

    const tbodyFixas = document.querySelector('#cfgLancTabelaFixas tbody');
    tbodyFixas.innerHTML = EVENTOS_FIXOS_RUBRICA.map(evtDef => {
        const linha = porEvento[evtDef.ev];
        return `<tr><td>${evtDef.label}</td><td>${linha && linha.codigo_rubrica ? linha.codigo_rubrica : '—'}</td><td>${linha && linha.codigo_rubrica ? linha.tipo_valor : '—'}</td></tr>`;
    }).join('');

    const obs = porEvento['observacoes'];
    const textoObs = obs && obs.codigo_rubrica ? obs.codigo_rubrica.trim() : '';
    document.getElementById('cfgLancObservacoes').textContent = textoObs || 'Nenhuma observação cadastrada.';
}