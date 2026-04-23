// ===== CONFIGURAÇÃO SUPABASE =====
let supabaseClient;
const SUPABASE_URL = 'https://graxaoomeffhsazuzkvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYXhhb29tZWZmaHNhenV6a3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTUxMDUsImV4cCI6MjA5MDI5MTEwNX0.ZpbVoNVS4momTyf7NME4mcYuI4oCQUvNFSDbORCHktI';

window.currentTypeFilter = ''; // Variável global para o filtro da sidebar

function initSupabase() {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inicializado com sucesso');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar Supabase:', error);
        showError('Erro ao conectar com Supabase');
        return false;
    }
}

// ==========================================
// 1. CARREGAMENTO E LISTAGEM (DASHBOARD)
// ==========================================
async function loadForms() {
    try {
        const container = document.getElementById('formsContainer');
        const emptyState = document.getElementById('emptyState');

        if (!container) return; // Evita erro se não estiver na index.html
        if (!supabaseClient) {
            showError('Supabase não inicializado');
            return;
        }

        let allForms = [];

        // Buscar da tabela: formularios
        try {
            const { data: forms, error } = await supabaseClient
                .from('formularios')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && forms) allForms = [...allForms, ...forms];
        } catch (e) { console.warn('⚠️ Tabela "formularios" vazia ou erro'); }

        // Buscar da tabela: empregados
        try {
            const { data: empregados, error } = await supabaseClient
                .from('empregados')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && empregados) {
                const empregadosFormatados = empregados.map(emp => ({
                    ...emp,
                    tipo_formulario: 'empregado',
                    nome_empresa: emp.nomeEmpresa || emp.nome_empresa || 'N/A',
                    nome_completo: emp.nome_completo || emp.nomeCompleto || 'N/A',
                    email_comercial: emp.email || emp.email_comercial,
                    telefone_comercial: emp.celular || emp.telefone_comercial
                }));
                allForms = [...allForms, ...empregadosFormatados];
            }
        } catch (e) { console.warn('⚠️ Tabela "empregados" vazia ou erro'); }

        // Remover duplicatas e ordenar por data mais recente
        const uniqueForms = Array.from(new Map(allForms.map(f => [f.id, f])).values());
        uniqueForms.sort((a, b) => new Date(b.created_at || b.data_preenchimento) - new Date(a.created_at || a.data_preenchimento));

        window.allForms = uniqueForms;
        filterForms(); // Aplica os filtros atuais e renderiza

    } catch (error) {
        console.error('❌ Erro ao carregar formulários:', error);
        showError('Erro ao carregar formulários: ' + error.message);
    }
}

function createFormCard(form) {
    const tipo = getTipoFormulario(form.tipo_formulario);
    const status = form.status || 'recebido';
    const dataFormatada = new Date(form.created_at || form.data_preenchimento || Date.now()).toLocaleDateString('pt-BR');
    
    const nome = form.nome_empresa || form.nome_completo || form.nomeEmpresa || form.nomeCompleto || 'Sem título';
    const email = form.email_comercial || form.email || form.emailComercial || '-';
    const telefone = form.telefone_comercial || form.celular || form.telefoneComercial || '-';

    let iconTipo = '📄';
    if (form.tipo_formulario === 'registro') iconTipo = '🏢';
    if (form.tipo_formulario === 'alteracao') iconTipo = '📝';
    if (form.tipo_formulario === 'empregado') iconTipo = '👤';

    return `
        <div class="form-card" onclick="openFormDetails('${form.id}')">
            <div class="form-card-header">
                <div class="form-card-title-wrapper">
                    <div class="form-card-title">${sanitizeOutput(nome)}</div>
                    <span class="form-card-status status-${status}">${status.toUpperCase()}</span>
                </div>
                <div class="form-card-badges">
                    <span class="form-card-type">${iconTipo} ${tipo}</span>
                </div>
            </div>
            
            <div class="form-card-info">
                <div class="form-card-info-row">
                    <span>📧 E-mail:</span>
                    <strong>${sanitizeOutput(email)}</strong>
                </div>
                <div class="form-card-info-row">
                    <span>📱 Telefone:</span>
                    <strong>${sanitizeOutput(telefone)}</strong>
                </div>
                <div class="form-card-info-row">
                    <span>📅 Data:</span>
                    <strong>${dataFormatada}</strong>
                </div>
            </div>
            
            <div class="form-card-actions">
                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); viewDocuments('${form.id}')">
                    📁 Docs
                </button>
                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openFormDetails('${form.id}')">
                    👁️ Ver
                </button>
                <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editFormCard('${form.id}')">
                    ✏️ Editar
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// 2. FILTROS (SIDEBAR E BUSCA)
// ==========================================
function filterByType(type, element) {
    // Previne o recarregamento da página ao clicar no link
    if (window.event) window.event.preventDefault();

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        el.classList.remove('active');
    });
    if (element) element.classList.add('active');

    const titles = {
        '': 'Todos os Formulários',
        'registro': 'Registro de Empresa',
        'alteracao': 'Alteração de Empresa',
        'empregado': 'Registro de Empregado'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[type] || 'Formulários';

    window.currentTypeFilter = type;
    filterForms();
}

function filterForms() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const status = statusFilter ? statusFilter.value : '';
    const type = window.currentTypeFilter;

    if (!window.allForms) return;

    const filtered = window.allForms.filter(form => {
        const nome = (form.nome_empresa || form.nome_completo || form.nomeEmpresa || form.nomeCompleto || '').toLowerCase();
        const email = (form.email_comercial || form.email || form.emailComercial || '').toLowerCase();
        const telefone = (form.telefone_comercial || form.celular || form.telefoneComercial || '').toLowerCase();
        const cpf = (form.cpf || '').toLowerCase();

        const matchSearch = !search || nome.includes(search) || email.includes(search) || telefone.includes(search) || cpf.includes(search);
        const matchStatus = !status || form.status === status;
        const matchType = !type || form.tipo_formulario === type;

        return matchSearch && matchStatus && matchType;
    });

    const container = document.getElementById('formsContainer');
    const emptyState = document.getElementById('emptyState');

    if (!container) return;

    if (filtered.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        container.innerHTML = filtered.map(form => createFormCard(form)).join('');
        container.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

// ==========================================
// 3. VISUALIZAÇÃO DE DETALHES (MODAL E PÁGINA)
// ==========================================
// ===== VISUALIZAÇÃO DE DETALHES (MODAL) =====
async function openFormDetails(formId) {
    try {
        const form = window.allForms.find(f => f.id === formId);
        if (!form) {
            showError('Formulário não encontrado');
            return;
        }

        const modal = document.getElementById('detailsModal');
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');

        // Mostrar loading enquanto busca os sócios
        modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Carregando detalhes e sócios...</p></div>';
        modal.style.display = 'flex';

        let sociosDoBanco = [];

        // Buscar sócios na tabela 'socios' se for registro ou alteração
        if (form.tipo_formulario === 'registro' || form.tipo_formulario === 'alteracao') {
            if (supabaseClient) {
                try {
                    const { data: socios, error } = await supabaseClient
                        .from('socios')
                        .select('*')
                        .eq('formulario_id', formId)
                        .order('numero_socio', { ascending: true });

                    if (!error && socios) {
                        sociosDoBanco = socios;
                    }
                } catch (e) {
                    console.warn('⚠️ Erro ao buscar sócios:', e);
                }
            }
        }

        const nome = form.nome_empresa || form.nome_completo || form.nomeEmpresa || form.nomeCompleto;
        modalTitle.textContent = `Detalhes - ${sanitizeOutput(nome)}`;
        
        // Passamos os sócios encontrados como segundo parâmetro
        modalBody.innerHTML = createDetailContent(form, sociosDoBanco);
        
        window.currentFormId = formId;
        window.currentForm = form;

    } catch (error) {
        console.error('❌ Erro ao abrir detalhes:', error);
        showError('Erro ao carregar detalhes');
        closeModal();
    }
}

// Função para a página detalhes.html (caso seja acessada diretamente)
async function loadFormDetails(formId) {
    try {
        const container = document.getElementById('formDetails');
        if (!container) return;

        if (!supabaseClient) return;

        let { data: form, error } = await supabaseClient.from('formularios').select('*').eq('id', formId).single();

        if (error || !form) {
            const { data: emp, error: empError } = await supabaseClient.from('empregados').select('*').eq('id', formId).single();
            if (!empError && emp) {
                form = { ...emp, tipo_formulario: 'empregado', nome_empresa: emp.nomeEmpresa || emp.nome_empresa, nome_completo: emp.nome_completo || emp.nomeCompleto };
            }
        }

        if (!form) {
            container.innerHTML = '<div class="empty-state"><h3>Formulário não encontrado</h3></div>';
            return;
        }

        window.currentFormId = formId;
        window.currentForm = form;
        
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = `Detalhes - ${sanitizeOutput(form.nome_empresa || form.nome_completo)}`;

        container.innerHTML = createDetailContent(form);

    } catch (error) {
        console.error('❌ Erro ao carregar detalhes:', error);
    }
}

function createDetailContent(form, sociosDoBanco = []) {
    const tipo = getTipoFormulario(form.tipo_formulario);
    const status = form.status || 'Recebido';
    const dataFormatada = new Date(form.created_at || form.data_preenchimento || Date.now()).toLocaleDateString('pt-BR');
    
    const nome = form.nome_empresa || form.nome_completo || form.nomeEmpresa || form.nomeCompleto || '-';
    const email = form.email_comercial || form.email || form.emailComercial || '-';
    const telefone = form.telefone_comercial || form.celular || form.telefoneComercial || '-';

    let conteudoAdicional = '';

    // ==========================================
    // 1. REGISTRO DE EMPRESA
    // ==========================================
    if (form.tipo_formulario === 'registro') {
        conteudoAdicional = `
            <div class="detail-section">
                <div class="detail-section-title">🏢 Informações da Empresa</div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Nome Fantasia</span>
                        <div class="detail-value">${sanitizeOutput(form.nome_fantasia || form.nomeFantasia || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Porte da Empresa</span>
                        <div class="detail-value">${sanitizeOutput(form.porte_empresa || form.porteEmpresa || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Capital Social</span>
                        <div class="detail-value">${formatCurrency(form.capital_social || form.capitalSocial || 0)}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Metragem</span>
                        <div class="detail-value">${sanitizeOutput(form.metragem || '-')} m²</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">📍 Sede do Estabelecimento</div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Endereço Completo</span>
                        <div class="detail-value">${sanitizeOutput(form.endereco || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">CEP</span>
                        <div class="detail-value">${sanitizeOutput(form.cep || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Inscrição IPTU</span>
                        <div class="detail-value">${sanitizeOutput(form.iptu || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Dias e Horário de Funcionamento</span>
                        <div class="detail-value">${sanitizeOutput(form.horario || '-')}</div>
                    </div>
                </div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Forma de Atuação</span>
                        <div class="detail-value">${sanitizeOutput(form.forma_atuacao || form.formaAtuacao || '-')}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">⚙️ Atividades</div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Atividade Principal</span>
                        <div class="detail-value">${sanitizeOutput(form.atividade_principal || form.atividadePrincipal || '-')}</div>
                    </div>
                </div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Atividades Secundárias</span>
                        <div class="detail-value" style="white-space: pre-line;">${sanitizeOutput(form.atividades_secundarias || form.atividadesSecundarias || '-')}</div>
                    </div>
                </div>
            </div>
        `;
    } 
    // ==========================================
    // 2. ALTERAÇÃO DE EMPRESA
    // ==========================================
    else if (form.tipo_formulario === 'alteracao') {
        conteudoAdicional = `
            <div class="detail-section">
                <div class="detail-section-title">📝 Alterações Solicitadas</div>
                
                ${form.alterar_nome ? `
                <div class="detail-row full">
                    <div class="detail-field" style="background: #FFF3E0; padding: 10px; border-left: 4px solid #2196F3;">
                        <span class="detail-label">Opções de Novo Nome</span>
                        <div class="detail-value">
                            1. ${sanitizeOutput(form.nome_opcao_1 || '-')}<br>
                            2. ${sanitizeOutput(form.nome_opcao_2 || '-')}<br>
                            3. ${sanitizeOutput(form.nome_opcao_3 || '-')}
                        </div>
                    </div>
                </div>` : ''}

                ${form.alterar_fantasia ? `
                <div class="detail-row full">
                    <div class="detail-field" style="background: #FFF3E0; padding: 10px; border-left: 4px solid #2196F3;">
                        <span class="detail-label">Novo Nome Fantasia</span>
                        <div class="detail-value">${sanitizeOutput(form.novo_nome_fantasia || '-')}</div>
                    </div>
                </div>` : ''}

                ${form.alterar_capital ? `
                <div class="detail-row full">
                    <div class="detail-field" style="background: #FFF3E0; padding: 10px; border-left: 4px solid #2196F3;">
                        <span class="detail-label">Novo Capital Social</span>
                        <div class="detail-value">${formatCurrency(form.novo_capital || 0)}</div>
                    </div>
                </div>` : ''}

                ${form.alterar_dados ? `
                <div class="detail-row full">
                    <div class="detail-field" style="background: #FFF3E0; padding: 10px; border-left: 4px solid #2196F3;">
                        <span class="detail-label">Novos Dados do Estabelecimento</span>
                        <div class="detail-value">
                            <strong>Endereço:</strong> ${sanitizeOutput(form.novo_endereco || '-')}<br>
                            <strong>CEP:</strong> ${sanitizeOutput(form.cep_novo || '-')}<br>
                            <strong>IPTU:</strong> ${sanitizeOutput(form.iptu_novo || '-')}<br>
                            <strong>Metragem:</strong> ${sanitizeOutput(form.metragem_nova || '-')} m²<br>
                            <strong>Horário:</strong> ${sanitizeOutput(form.horario_novo || '-')}<br>
                            <strong>E-mail:</strong> ${sanitizeOutput(form.email_comercial_novo || '-')}<br>
                            <strong>Telefone:</strong> ${sanitizeOutput(form.telefone_comercial_novo || '-')}
                        </div>
                    </div>
                </div>` : ''}

                ${form.alterar_atividades ? `
                <div class="detail-row full">
                    <div class="detail-field" style="background: #FFF3E0; padding: 10px; border-left: 4px solid #2196F3;">
                        <span class="detail-label">Novas Atividades</span>
                        <div class="detail-value">
                            <strong>Principal:</strong> ${sanitizeOutput(form.atividade_principal_nova || '-')}<br>
                            <strong>Secundárias:</strong><br>
                            <span style="white-space: pre-line;">${sanitizeOutput(form.atividades_secundarias_nova || '-')}</span>
                        </div>
                    </div>
                </div>` : ''}
            </div>
        `;
    } 
    // ==========================================
    // 3. REGISTRO DE EMPREGADO
    // ==========================================
    else if (form.tipo_formulario === 'empregado') {
        conteudoAdicional = `
            <div class="detail-section">
                <div class="detail-section-title">👤 Informações Pessoais</div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">CPF</span>
                        <div class="detail-value">${sanitizeOutput(form.cpf || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Estado Civil</span>
                        <div class="detail-value" style="text-transform: capitalize;">${sanitizeOutput(form.estado_civil || form.estadoCivil || '-')}</div>
                    </div>
                </div>
                
                ${(form.estado_civil === 'casado' || form.estado_civil === 'uniao_estavel') ? `
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Nome do Cônjuge</span>
                        <div class="detail-value">${sanitizeOutput(form.nome_conjuge || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Regime de Partilha</span>
                        <div class="detail-value">${sanitizeOutput(form.regime_partilha || '-')}</div>
                    </div>
                </div>` : ''}

                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Data de Nascimento</span>
                        <div class="detail-value">${sanitizeOutput(form.data_nascimento || form.dataNascimento || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Naturalidade</span>
                        <div class="detail-value">${sanitizeOutput(form.naturalidade || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Grau de Escolaridade</span>
                        <div class="detail-value">${sanitizeOutput(form.grau_escolaridade || form.grauEscolaridade || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Raça/Cor</span>
                        <div class="detail-value" style="text-transform: capitalize;">${sanitizeOutput(form.raca || '-')}</div>
                    </div>
                </div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Endereço Residencial</span>
                        <div class="detail-value">${sanitizeOutput(form.endereco || '-')} - CEP: ${sanitizeOutput(form.cep || '-')}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">👨‍👩‍👧‍👦 Informações Familiares</div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Tem Filhos?</span>
                        <div class="detail-value">${form.tem_filhos ? 'Sim' : 'Não'}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Quantidade de Filhos (&lt; 14 anos)</span>
                        <div class="detail-value">${form.quantidade_filhos || 0}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">🚌 Benefícios e Descontos</div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Optante pelo Vale Transporte?</span>
                        <div class="detail-value">${form.vale_transporte ? 'Sim' : 'Não'}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Descontar 6% para Transporte?</span>
                        <div class="detail-value">${form.desconto_vt ? 'Sim' : 'Não'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">💼 Dados Contratuais</div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Empresa Contratante</span>
                        <div class="detail-value">${sanitizeOutput(form.nome_empresa || form.nomeEmpresa || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Data de Admissão</span>
                        <div class="detail-value">${sanitizeOutput(form.data_admissao || form.dataAdmissao || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Cargo/Função</span>
                        <div class="detail-value">${sanitizeOutput(form.cargo || '-')}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Departamento</span>
                        <div class="detail-value">${sanitizeOutput(form.departamento || '-')}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <span class="detail-label">Salário Contratual</span>
                        <div class="detail-value">${formatCurrency(form.salario_contratual || form.salarioContratual || 0)}</div>
                    </div>
                    <div class="detail-field">
                        <span class="detail-label">Contrato de Experiência</span>
                        <div class="detail-value">${sanitizeOutput(form.contrato_experiencia || form.contratoExperiencia || '-').replace('_', ' ')}</div>
                    </div>
                </div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <span class="detail-label">Horário de Trabalho</span>
                        <div class="detail-value">${sanitizeOutput(form.horario_trabalho || form.horarioTrabalho || '-')}</div>
                    </div>
                </div>
            </div>
        `;
    }

       // ==========================================
    // RENDERIZAR SÓCIOS DO BANCO DE DADOS
    // ==========================================
    let sociosHtml = '';
    if (sociosDoBanco && sociosDoBanco.length > 0) {
        sociosHtml = `
            <div class="detail-section">
                <div class="detail-section-title">👥 Dados dos Sócios (${sociosDoBanco.length})</div>
                ${sociosDoBanco.map(socio => `
                    <div style="background: #f8f9fa; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 15px; margin-bottom: 15px;">
                        <h4 style="color: var(--primary-color); margin-bottom: 10px; border-bottom: 1px solid var(--gray-200); padding-bottom: 5px;">
                            Sócio #${socio.numero_socio || '?'}: ${sanitizeOutput(socio.nome || '-')}
                        </h4>
                        <div class="detail-row">
                            <div class="detail-field">
                                <span class="detail-label">Administrador</span>
                                <div class="detail-value" style="background: white;">${socio.administrador ? 'Sim' : 'Não'}</div>
                            </div>
                            <div class="detail-field">
                                <span class="detail-label">Responsável CNPJ</span>
                                <div class="detail-value" style="background: white;">${socio.responsavel_cnpj ? 'Sim' : 'Não'}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-field">
                                <span class="detail-label">Participação</span>
                                <div class="detail-value" style="background: white;">${socio.participacao || '0'}%</div>
                            </div>
                            <div class="detail-field">
                                <span class="detail-label">Profissão</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.profissao || '-')}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-field">
                                <span class="detail-label">Estado Civil</span>
                                <div class="detail-value" style="background: white; text-transform: capitalize;">${sanitizeOutput(socio.estado_civil || '-')}</div>
                            </div>
                            <div class="detail-field">
                                <span class="detail-label">Naturalidade</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.naturalidade || '-')}</div>
                            </div>
                        </div>
                        ${(socio.estado_civil === 'casado' || socio.estado_civil === 'uniao_estavel') ? `
                        <div class="detail-row full">
                            <div class="detail-field">
                                <span class="detail-label">Regime de Partilha</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.regime_partilha || '-')}</div>
                            </div>
                        </div>` : ''}
                        <div class="detail-row">
                            <div class="detail-field">
                                <span class="detail-label">E-mail</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.email || '-')}</div>
                            </div>
                            <div class="detail-field">
                                <span class="detail-label">Celular</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.celular || '-')}</div>
                            </div>
                        </div>
                        <div class="detail-row full">
                            <div class="detail-field">
                                <span class="detail-label">Endereço Residencial</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.endereco || '-')}</div>
                            </div>
				<div class="detail-field">
                                <span class="detail-label">CEP</span>
                                <div class="detail-value" style="background: white;">${sanitizeOutput(socio.CEP || '-')}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Retorna o cabeçalho padrão + o conteúdo específico + os sócios
    return `
        <div class="detail-section" style="background: #f8f9fa; border-left: 4px solid var(--primary-color);">
            <div class="detail-row">
                <div class="detail-field">
                    <span class="detail-label">Status Atual</span>
                    <div class="detail-value" style="font-weight: bold; color: var(--primary-color); background: transparent; border: none; padding: 0;">${status.toUpperCase()}</div>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Data de Envio</span>
                    <div class="detail-value" style="background: transparent; border: none; padding: 0;">${dataFormatada}</div>
                </div>
            </div>
            <div class="detail-row full" style="margin-bottom: 0;">
                <div class="detail-field">
                    <span class="detail-label">Nome Principal / Empresa</span>
                    <div class="detail-value" style="font-size: 18px; font-weight: bold; background: transparent; border: none; padding: 0;">${sanitizeOutput(nome)}</div>
                </div>
            </div>
            <div class="detail-row" style="margin-top: 16px; margin-bottom: 0;">
                <div class="detail-field">
                    <span class="detail-label">E-mail de Contato</span>
                    <div class="detail-value" style="background: transparent; border: none; padding: 0;">${sanitizeOutput(email)}</div>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Telefone / Celular</span>
                    <div class="detail-value" style="background: transparent; border: none; padding: 0;">${sanitizeOutput(telefone)}</div>
                </div>
            </div>
        </div>
        
        ${conteudoAdicional}
        
        ${sociosHtml}

        ${form.observacoes ? `
        <div class="detail-section">
            <div class="detail-section-title">📌 Observações Internas</div>
            <div class="detail-row full">
                <div class="detail-field">
                    <div class="detail-value" style="background: #FFF9C4; border-color: #FFE082;">${sanitizeOutput(form.observacoes)}</div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 4. EDIÇÃO DE FORMULÁRIO
// ==========================================
// ===== ABRIR MODAL DE EDIÇÃO =====
async function editFormCard(formId) {
    try {
        const form = window.allForms.find(f => f.id === formId);
        if (!form) return;

        const modal = document.getElementById('editModal');
        const modalBody = document.getElementById('editModalBody');
        
        // Mostrar loading
        modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Carregando formulário para edição...</p></div>';
        modal.style.display = 'flex';

        let sociosDoBanco = [];

        // Buscar sócios na tabela 'socios' se for registro ou alteração
        if (form.tipo_formulario === 'registro' || form.tipo_formulario === 'alteracao') {
            if (supabaseClient) {
                try {
                    const { data: socios, error } = await supabaseClient
                        .from('socios')
                        .select('*')
                        .eq('formulario_id', formId)
                        .order('numero_socio', { ascending: true });

                    if (!error && socios) {
                        sociosDoBanco = socios;
                    }
                } catch (e) {
                    console.warn('⚠️ Erro ao buscar sócios para edição:', e);
                }
            }
        }

        // Passa os sócios para a função que cria o formulário
        modalBody.innerHTML = createEditForm(form, sociosDoBanco);
        window.currentFormId = formId;
        window.currentForm = form;
        window.currentSocios = sociosDoBanco; // Salva os sócios na memória para usar no saveChanges

    } catch (error) {
        console.error('❌ Erro ao abrir edição:', error);
        showError('Erro ao carregar formulário para edição');
        closeEditModal();
    }
}

function createEditForm(form, sociosDoBanco = []) {
    const tipo = form.tipo_formulario || 'formulario';
    
    let camposEdicao = `
        <div class="detail-section">
            <div class="detail-section-title">Informações Gerais</div>
            <div class="detail-row">
                <div class="detail-field">
                    <label class="detail-label">Status</label>
                    <select id="editStatus" class="filter-select" style="padding: var(--spacing-md);">
                        <option value="recebido" ${form.status === 'recebido' ? 'selected' : ''}>Recebido</option>
                        <option value="validado" ${form.status === 'validado' ? 'selected' : ''}>Validado</option>
                        <option value="rejeitado" ${form.status === 'rejeitado' ? 'selected' : ''}>Rejeitado</option>
                    </select>
                </div>
                <div class="detail-field">
                    <label class="detail-label">Responsável</label>
                    <input type="text" id="editResponsavel" class="search-input" placeholder="Seu nome" style="padding: var(--spacing-md);" value="${localStorage.getItem('lastUser') ? JSON.parse(localStorage.getItem('lastUser')) : ''}">
                </div>
            </div>
        </div>
    `;

    // 1. EDIÇÃO: REGISTRO DE EMPRESA
    if (tipo === 'registro') {
        camposEdicao += `
            <div class="detail-section">
                <div class="detail-section-title">Informações da Empresa</div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">Nome da Empresa</label><input type="text" id="editNomeEmpresa" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.nome_empresa || form.nomeEmpresa || '')}"></div>
                    <div class="detail-field"><label class="detail-label">Nome Fantasia</label><input type="text" id="editNomeFantasia" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.nome_fantasia || form.nomeFantasia || '')}"></div>
                </div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">Capital Social</label><input type="number" id="editCapitalSocial" class="search-input" style="padding: var(--spacing-md);" value="${form.capital_social || form.capitalSocial || 0}" step="0.01"></div>
                    <div class="detail-field"><label class="detail-label">Metragem (m²)</label><input type="number" id="editMetragem" class="search-input" style="padding: var(--spacing-md);" value="${form.metragem || 0}" step="0.01"></div>
                </div>
                <div class="detail-row full"><div class="detail-field"><label class="detail-label">Endereço</label><input type="text" id="editEndereco" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.endereco || '')}"></div></div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">CEP</label><input type="text" id="editCep" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.cep || '')}"></div>
                    <div class="detail-field"><label class="detail-label">IPTU</label><input type="text" id="editIptu" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.iptu || '')}"></div>
                </div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">E-mail Comercial</label><input type="email" id="editEmailComercial" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.email_comercial || form.emailComercial || '')}"></div>
                    <div class="detail-field"><label class="detail-label">Telefone Comercial</label><input type="tel" id="editTelefoneComercial" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.telefone_comercial || form.telefoneComercial || '')}"></div>
                </div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">
                            Atividade Principal
                            <span class="help-icon" onclick="openCnaeModal('editAtividadePrincipal')" title="Ver lista de CNAEs">❓</span>
                        </label>
                        <input type="text" id="editAtividadePrincipal" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.atividade_principal || form.atividadePrincipal || '')}">
                    </div>
                </div>
            </div>
        `;
    } 
    // 2. EDIÇÃO: ALTERAÇÃO DE EMPRESA
    else if (tipo === 'alteracao') {
        camposEdicao += `
            <div class="detail-section">
                <div class="detail-section-title">Dados da Alteração</div>
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">Nome da Empresa Atual</label>
                        <input type="text" id="editNomeEmpresa" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.nome_empresa || form.nomeEmpresa || '')}">
                    </div>
                </div>
                
                ${form.alterar_nome ? `
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">Opção 1 de Novo Nome</label>
                        <input type="text" id="editNomeOpcao1" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.nome_opcao_1 || '')}">
                    </div>
                </div>` : ''}

                ${form.alterar_fantasia ? `
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">Novo Nome Fantasia</label>
                        <input type="text" id="editNovoNomeFantasia" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.novo_nome_fantasia || '')}">
                    </div>
                </div>` : ''}

                ${form.alterar_capital ? `
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">Novo Capital Social</label>
                        <input type="number" id="editNovoCapital" class="search-input" style="padding: var(--spacing-md);" value="${form.novo_capital || 0}" step="0.01">
                    </div>
                </div>` : ''}

                ${form.alterar_dados ? `
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">Novo Endereço</label>
                        <input type="text" id="editNovoEndereco" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.novo_endereco || '')}">
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-field">
                        <label class="detail-label">Novo CEP</label>
                        <input type="text" id="editCepNovo" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.cep_novo || '')}">
                    </div>
                    <div class="detail-field">
                        <label class="detail-label">Novo IPTU</label>
                        <input type="text" id="editIptuNovo" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.iptu_novo || '')}">
                    </div>
                </div>` : ''}

                ${form.alterar_atividades ? `
                <div class="detail-row full">
                    <div class="detail-field">
                        <label class="detail-label">
                            Nova Atividade Principal
                            <span class="help-icon" onclick="openCnaeModal('editAtividadePrincipalNova')" title="Ver lista de CNAEs">❓</span>
                        </label>
                        <input type="text" id="editAtividadePrincipalNova" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.atividade_principal_nova || '')}">
                    </div>
                </div>` : ''}
            </div>
        `;
    } 
    // 3. EDIÇÃO: REGISTRO DE EMPREGADO
    else if (tipo === 'empregado') {
        camposEdicao += `
            <div class="detail-section">
                <div class="detail-section-title">Informações Pessoais</div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">Nome Completo</label><input type="text" id="editNomeCompleto" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.nome_completo || form.nomeCompleto || '')}"></div>
                    <div class="detail-field"><label class="detail-label">CPF</label><input type="text" id="editCpf" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.cpf || '')}"></div>
                </div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">E-mail</label><input type="email" id="editEmail" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.email || '')}"></div>
                    <div class="detail-field"><label class="detail-label">Celular</label><input type="tel" id="editCelular" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.celular || '')}"></div>
                </div>
            </div>
            <div class="detail-section">
                <div class="detail-section-title">Dados Contratuais</div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">Cargo</label><input type="text" id="editCargo" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.cargo || '')}"></div>
                    <div class="detail-field"><label class="detail-label">Departamento</label><input type="text" id="editDepartamento" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.departamento || '')}"></div>
                </div>
                <div class="detail-row">
                    <div class="detail-field"><label class="detail-label">Salário</label><input type="number" id="editSalario" class="search-input" style="padding: var(--spacing-md);" value="${form.salario_contratual || form.salarioContratual || 0}" step="0.01"></div>
                    <div class="detail-field"><label class="detail-label">Horário de Trabalho</label><input type="text" id="editHorarioTrabalho" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(form.horario_trabalho || form.horarioTrabalho || '')}"></div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // RENDERIZAR SÓCIOS PARA EDIÇÃO
    // ==========================================
    if (sociosDoBanco && sociosDoBanco.length > 0) {
        camposEdicao += `
            <div class="detail-section">
                <div class="detail-section-title">👥 Editar Sócios (${sociosDoBanco.length})</div>
                ${sociosDoBanco.map(socio => `
                    <div style="background: #f8f9fa; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 15px; margin-bottom: 15px;">
                        <h4 style="color: var(--primary-color); margin-bottom: 10px;">Sócio #${socio.numero_socio || '?'}</h4>
                        
                        <!-- ID Oculto para saber qual sócio atualizar -->
                        <input type="hidden" id="editSocioId_${socio.id}" value="${socio.id}">
                        
                        <div class="detail-row full">
                            <div class="detail-field">
                                <label class="detail-label">Nome Completo</label>
                                <input type="text" id="editSocioNome_${socio.id}" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(socio.nome || '')}">
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-field">
                                <label class="detail-label">Administrador?</label>
                                <select id="editSocioAdmin_${socio.id}" class="filter-select" style="padding: var(--spacing-md);">
                                    <option value="true" ${socio.administrador ? 'selected' : ''}>Sim</option>
                                    <option value="false" ${!socio.administrador ? 'selected' : ''}>Não</option>
                                </select>
                            </div>
                            <div class="detail-field">
                                <label class="detail-label">Responsável CNPJ?</label>
                                <select id="editSocioRespCNPJ_${socio.id}" class="filter-select" style="padding: var(--spacing-md);">
                                    <option value="true" ${socio.responsavel_cnpj ? 'selected' : ''}>Sim</option>
                                    <option value="false" ${!socio.responsavel_cnpj ? 'selected' : ''}>Não</option>
                                </select>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-field">
                                <label class="detail-label">Participação (%)</label>
                                <input type="number" id="editSocioParticipacao_${socio.id}" class="search-input" style="padding: var(--spacing-md);" value="${socio.participacao || 0}" step="0.01">
                            </div>
                            <div class="detail-field">
                                <label class="detail-label">Profissão</label>
                                <input type="text" id="editSocioProfissao_${socio.id}" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(socio.profissao || '')}">
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-field">
                                <label class="detail-label">Estado Civil</label>
                                <select id="editSocioEstadoCivil_${socio.id}" class="filter-select" style="padding: var(--spacing-md);">
                                    <option value="solteiro" ${socio.estado_civil === 'solteiro' ? 'selected' : ''}>Solteiro(a)</option>
                                    <option value="casado" ${socio.estado_civil === 'casado' ? 'selected' : ''}>Casado(a)</option>
                                    <option value="divorciado" ${socio.estado_civil === 'divorciado' ? 'selected' : ''}>Divorciado(a)</option>
                                    <option value="viuvo" ${socio.estado_civil === 'viuvo' ? 'selected' : ''}>Viúvo(a)</option>
                                    <option value="uniao_estavel" ${socio.estado_civil === 'uniao_estavel' ? 'selected' : ''}>União Estável</option>
                                </select>
                            </div>
                            <div class="detail-field">
                                <label class="detail-label">Celular</label>
                                <input type="tel" id="editSocioCelular_${socio.id}" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(socio.celular || '')}">
                            </div>
                        </div>
                        <div class="detail-row full">
                            <div class="detail-field">
                                <label class="detail-label">Endereço Residencial</label>
                                <input type="text" id="editSocioEndereco_${socio.id}" class="search-input" style="padding: var(--spacing-md);" value="${sanitizeOutput(socio.endereco || '')}">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    camposEdicao += `
        <div class="detail-section">
            <div class="detail-section-title">Observações</div>
            <div class="detail-row full">
                <div class="detail-field">
                    <textarea id="editObservacoes" class="search-input" placeholder="Adicione observações..." style="padding: var(--spacing-md); min-height: 100px;">${form.observacoes || ''}</textarea>
                </div>
            </div>
        </div>
    `;

    return camposEdicao;
}

// ===== GERAR E ENVIAR PDF APÓS EDIÇÃO =====

// ===== GERAR E ENVIAR PDF APÓS EDIÇÃO =====
async function gerarEEnviarPDFAlterado(formOriginal, dadosAtualizados, sociosAtualizados, responsavel) {
    try {
        console.log('📄 Iniciando geração do PDF de alteração...');
        
        // 1. Inicializar jsPDF
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('Biblioteca jsPDF não encontrada. Adicione o script no index.html.');
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let yPosition = 20;
        const margin = 20;
        const lineHeight = 7;
        const pageWidth = doc.internal.pageSize.width;

        // 2. Mesclar dados antigos com os novos
        const form = { ...formOriginal, ...dadosAtualizados };

        // 3. Cabeçalho do PDF
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("FORMULÁRIO ATUALIZADO (EDIÇÃO)", pageWidth / 2, yPosition, { align: "center" });
        yPosition += 12;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dataAtual = new Date().toLocaleString('pt-BR');
        doc.text(`Data da Alteração: ${dataAtual}`, margin, yPosition);
        yPosition += lineHeight;
        doc.text(`Alterado por: ${responsavel}`, margin, yPosition);
        yPosition += lineHeight;
        doc.text(`Status Atual: ${form.status.toUpperCase()}`, margin, yPosition);
        yPosition += lineHeight * 2;

        // Função auxiliar para imprimir linhas no PDF
        function addLine(label, value) {
            if (yPosition > 280) {
                doc.addPage();
                yPosition = 20;
            }
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, margin, yPosition);
            doc.setFont("helvetica", "normal");
            
            const textLines = doc.splitTextToSize(String(value || '-'), pageWidth - margin - 60);
            doc.text(textLines, margin + 50, yPosition);
            yPosition += lineHeight * textLines.length;
        }

        // 4. Preencher dados
        if (form.tipo_formulario === 'registro' || form.tipo_formulario === 'alteracao') {
            addLine("Nome da Empresa", form.nome_empresa || form.nomeEmpresa);
            if (form.nome_fantasia) addLine("Nome Fantasia", form.nome_fantasia);
            if (form.capital_social) addLine("Capital Social", `R$ ${form.capital_social}`);
            if (form.endereco) addLine("Endereço", form.endereco);
            if (form.cep) addLine("CEP", form.cep);
            if (form.email_comercial) addLine("E-mail", form.email_comercial);
            if (form.telefone_comercial) addLine("Telefone", form.telefone_comercial);
            if (form.atividade_principal) addLine("Atividade Principal", form.atividade_principal);
            
            if (form.novo_endereco) addLine("Novo Endereço", form.novo_endereco);
            if (form.atividade_principal_nova) addLine("Nova Ativ. Principal", form.atividade_principal_nova);
        } else if (form.tipo_formulario === 'empregado') {
            addLine("Nome do Empregado", form.nome_completo);
            addLine("CPF", form.cpf);
            addLine("Cargo", form.cargo);
            addLine("Salário", `R$ ${form.salario_contratual}`);
        }

        if (form.observacoes) {
            yPosition += lineHeight;
            addLine("Observações", form.observacoes);
        }

        // 5. Preencher dados dos Sócios
        if (sociosAtualizados && sociosAtualizados.length > 0) {
            yPosition += lineHeight;
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("DADOS DOS SÓCIOS (ATUALIZADOS)", margin, yPosition);
            yPosition += lineHeight;
            doc.setFontSize(10);

            sociosAtualizados.forEach((socio, index) => {
                addLine(`Sócio #${index + 1}`, socio.nome);
                addLine("  Administrador", socio.administrador ? 'Sim' : 'Não');
                addLine("  Resp. CNPJ", socio.responsavel_cnpj ? 'Sim' : 'Não');
                addLine("  Participação", `${socio.participacao}%`);
                addLine("  Estado Civil", socio.estado_civil);
            });
        }

        // 6. Gerar o arquivo PDF (Blob)
        const pdfBlob = doc.output('blob');

        // 7. Montar o nome do arquivo e o caminho
        const sanitizarNomeArquivo = (nome) => {
            if (!nome) return 'documento_sem_nome';
            return nome
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/[^a-zA-Z0-9]/g, '_')   // Substitui caracteres especiais por underline
                .replace(/_+/g, '_')             // Remove underlines duplicados
                .toLowerCase();
        };

        const nomeBase = form.nome_empresa || form.nome_completo || form.nomeEmpresa || 'empresa';
        const nomePasta = sanitizarNomeArquivo(nomeBase);
        
        // Determinar a pasta raiz baseada no tipo de formulário
        let tipoPasta = 'Registro';
        if (form.tipo_formulario === 'alteracao') {
            tipoPasta = 'Alteracao';
        } else if (form.tipo_formulario === 'empregado') {
            tipoPasta = 'Empregado';
        }
        
        // Formatar data para o nome do arquivo (DD-MM-YYYY_HH-MM)
        const agora = new Date();
        const dataStr = `${String(agora.getDate()).padStart(2, '0')}-${String(agora.getMonth()+1).padStart(2, '0')}-${agora.getFullYear()}_${String(agora.getHours()).padStart(2, '0')}h${String(agora.getMinutes()).padStart(2, '0')}`;
        
        // Nome final do arquivo: Nome da empresa_data_Alterado por Responsavel.pdf
        const nomeArquivo = `${nomeBase}_${dataStr}_Alterado_por_${responsavel}.pdf`;
        
        // Caminho no bucket: {tipo de formulario}/Nome da empresa/formulario/nome_do_arquivo.pdf
        const caminhoCompleto = `${tipoPasta}/${nomePasta}/formulario/${nomeArquivo}`;

        console.log('📁 Caminho de destino no Storage:', caminhoCompleto);

        // 8. Fazer o upload para o Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('documentos')
            .upload(caminhoCompleto, pdfBlob, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Erro detalhado do Supabase Storage:', error);
            throw error;
        }

        console.log('✅ PDF atualizado salvo com sucesso no Storage!', data);
        return data;
        
    } catch (err) {
        console.error('❌ Falha crítica ao gerar/enviar PDF:', err);
        throw err;
    }
}

async function saveChanges() {
    try {
        const formId = window.currentFormId;
        const newStatus = document.getElementById('editStatus').value;
        const responsavel = document.getElementById('editResponsavel').value || 'Sistema';
        const observacoes = document.getElementById('editObservacoes').value;

        if (!supabaseClient) return showError('Supabase não inicializado');

        localStorage.setItem('lastUser', JSON.stringify(responsavel));

        const form = window.currentForm;
        const tipo = form.tipo_formulario;
        const tableName = tipo === 'empregado' ? 'empregados' : 'formularios';

        const updateData = {
            status: newStatus,
            observacoes: observacoes,
            updated_at: new Date().toISOString()
        };

        // Salvar campos baseados no tipo de formulário
        if (tipo === 'registro') {
            if (document.getElementById('editNomeEmpresa')) updateData.nome_empresa = document.getElementById('editNomeEmpresa').value;
            if (document.getElementById('editNomeFantasia')) updateData.nome_fantasia = document.getElementById('editNomeFantasia').value;
            if (document.getElementById('editCapitalSocial')) updateData.capital_social = parseFloat(document.getElementById('editCapitalSocial').value) || 0;
            if (document.getElementById('editMetragem')) updateData.metragem = parseFloat(document.getElementById('editMetragem').value) || 0;
            if (document.getElementById('editEndereco')) updateData.endereco = document.getElementById('editEndereco').value;
            if (document.getElementById('editCep')) updateData.cep = document.getElementById('editCep').value;
            if (document.getElementById('editIptu')) updateData.iptu = document.getElementById('editIptu').value;
            if (document.getElementById('editEmailComercial')) updateData.email_comercial = document.getElementById('editEmailComercial').value;
            if (document.getElementById('editTelefoneComercial')) updateData.telefone_comercial = document.getElementById('editTelefoneComercial').value;
            if (document.getElementById('editAtividadePrincipal')) updateData.atividade_principal = document.getElementById('editAtividadePrincipal').value;
        } 
        else if (tipo === 'alteracao') {
            if (document.getElementById('editNomeEmpresa')) updateData.nome_empresa = document.getElementById('editNomeEmpresa').value;
            if (document.getElementById('editNomeOpcao1')) updateData.nome_opcao_1 = document.getElementById('editNomeOpcao1').value;
            if (document.getElementById('editNovoNomeFantasia')) updateData.novo_nome_fantasia = document.getElementById('editNovoNomeFantasia').value;
            if (document.getElementById('editNovoCapital')) updateData.novo_capital = parseFloat(document.getElementById('editNovoCapital').value) || 0;
            if (document.getElementById('editNovoEndereco')) updateData.novo_endereco = document.getElementById('editNovoEndereco').value;
            if (document.getElementById('editCepNovo')) updateData.cep_novo = document.getElementById('editCepNovo').value;
            if (document.getElementById('editIptuNovo')) updateData.iptu_novo = document.getElementById('editIptuNovo').value;
            if (document.getElementById('editAtividadePrincipalNova')) updateData.atividade_principal_nova = document.getElementById('editAtividadePrincipalNova').value;
        } 
        else if (tipo === 'empregado') {
            if (document.getElementById('editNomeCompleto')) updateData.nome_completo = document.getElementById('editNomeCompleto').value;
            if (document.getElementById('editCpf')) updateData.cpf = document.getElementById('editCpf').value;
            if (document.getElementById('editEmail')) updateData.email = document.getElementById('editEmail').value;
            if (document.getElementById('editCelular')) updateData.celular = document.getElementById('editCelular').value;
            if (document.getElementById('editCargo')) updateData.cargo = document.getElementById('editCargo').value;
            if (document.getElementById('editDepartamento')) updateData.departamento = document.getElementById('editDepartamento').value;
            if (document.getElementById('editSalario')) updateData.salario_contratual = parseFloat(document.getElementById('editSalario').value) || 0;
            if (document.getElementById('editHorarioTrabalho')) updateData.horario_trabalho = document.getElementById('editHorarioTrabalho').value;
        }

        // 1. Atualiza o formulário principal
        const { error: updateError } = await supabaseClient.from(tableName).update(updateData).eq('id', formId);
        if (updateError) throw updateError;

        // 2. Atualiza os sócios e guarda os dados para o PDF
        let sociosAtualizados = [];
        if (window.currentSocios && window.currentSocios.length > 0) {
            for (const socio of window.currentSocios) {
                const socioId = socio.id;
                
                if (document.getElementById(`editSocioNome_${socioId}`)) {
                    const socioUpdateData = {
                        nome: document.getElementById(`editSocioNome_${socioId}`).value,
                        administrador: document.getElementById(`editSocioAdmin_${socioId}`).value === 'true',
                        responsavel_cnpj: document.getElementById(`editSocioRespCNPJ_${socioId}`).value === 'true',
                        participacao: parseFloat(document.getElementById(`editSocioParticipacao_${socioId}`).value) || 0,
                        profissao: document.getElementById(`editSocioProfissao_${socioId}`).value,
                        estado_civil: document.getElementById(`editSocioEstadoCivil_${socioId}`).value,
                        celular: document.getElementById(`editSocioCelular_${socioId}`).value,
                        endereco: document.getElementById(`editSocioEndereco_${socioId}`).value
                    };

                    sociosAtualizados.push(socioUpdateData);

                    const { error: socioError } = await supabaseClient
                        .from('socios')
                        .update(socioUpdateData)
                        .eq('id', socioId);
                        
                    if (socioError) console.error(`Erro ao atualizar sócio ${socioId}:`, socioError);
                } else {
                    sociosAtualizados.push(socio); // Mantém o original se não foi editado
                }
            }
        }

        // 3. Registra no histórico
        try {
            await supabaseClient.from('historico_edicoes').insert([{
                formulario_id: formId,
                responsavel: responsavel,
                campo_editado: 'status/dados',
                valor_anterior: form.status || 'N/A',
                valor_novo: newStatus,
                data_edicao: new Date().toISOString()
            }]);
        } catch (e) { console.warn('⚠️ Histórico não registrado'); }

        // 4. GERAR E ENVIAR PDF ATUALIZADO
        try {
            // Muda o texto do botão para dar feedback visual
            const btnSalvar = document.querySelector('#editModal .btn-primary');
            const textoOriginal = btnSalvar.innerText;
            btnSalvar.innerText = 'Gerando PDF...';
            btnSalvar.disabled = true;

            await gerarEEnviarPDFAlterado(form, updateData, sociosAtualizados, responsavel);
            
            btnSalvar.innerText = textoOriginal;
            btnSalvar.disabled = false;
        } catch (pdfError) {
            console.error('Erro ao gerar/enviar PDF:', pdfError);
            // Não interrompe o fluxo se o PDF falhar, pois os dados já foram salvos
        }

        showSuccess('Formulário atualizado e PDF gerado com sucesso!');
        closeEditModal();
        closeModal();
        loadForms();

    } catch (error) {
        console.error('❌ Erro ao salvar alterações:', error);
        showError('Erro ao salvar alterações: ' + error.message);
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 5. DOCUMENTOS (LEITOR INTEGRADO)
// ==========================================
async function viewDocuments(formId) {
    try {
        const form = window.allForms.find(f => f.id === formId);
        if (!form) return showError('Formulário não encontrado');

        const modal = document.getElementById('documentsModal');
        const title = document.getElementById('documentsTitle');
        const body = document.getElementById('documentsBody');

        const nomeEmpresa = form.nome_empresa || form.nomeEmpresa || 'Empresa';
        const tipo = form.tipo_formulario || 'formulario';
        
        title.textContent = `📁 Documentos - ${sanitizeOutput(nomeEmpresa)}`;
        body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Carregando documentos...</p></div>';
        modal.style.display = 'flex';

        let caminhos = [];
        if (tipo === 'registro') {
            caminhos = [`Registro/${sanitizeFileName(nomeEmpresa)}/formulario/`, `Registro/${sanitizeFileName(nomeEmpresa)}/documento/`];
        } else if (tipo === 'alteracao') {
            caminhos = [`Alteracao/${sanitizeFileName(nomeEmpresa)}/formulario/`, `Alteracao/${sanitizeFileName(nomeEmpresa)}/documento/`];
        } else if (tipo === 'empregado') {
            const nomeEmpregado = form.nome_completo || form.nomeCompleto || 'Empregado';
            caminhos = [`Novos Empregados/${sanitizeFileName(nomeEmpresa)}/${sanitizeFileName(nomeEmpregado)}/`];
        }

        let todosDocumentos = [];
        for (const caminho of caminhos) {
            try {
                const { data, error } = await supabaseClient.storage.from('documentos').list(caminho, { limit: 1000 });
                if (!error && data) {
                    const documentos = data.filter(item => !item.id.includes('/')).map(item => ({
                        name: item.name, path: caminho + item.name, size: item.metadata?.size || 0, created_at: item.created_at
                    }));
                    todosDocumentos = [...todosDocumentos, ...documentos];
                }
            } catch (e) { console.warn(`Caminho não encontrado: ${caminho}`); }
        }

        if (todosDocumentos.length === 0) {
            body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>Nenhum documento encontrado</h3><p>Este formulário ainda não possui documentos anexados.</p></div>`;
            return;
        }

        body.innerHTML = `
            <div class="documents-list">
                ${todosDocumentos.map(doc => `
                    <div class="document-item">
                        <div class="document-info">
                            <span class="document-icon">${getFileIcon(doc.name)}</span>
                            <div class="document-details">
                                <div class="document-name">${doc.name}</div>
                                <div class="document-meta">${formatFileSize(doc.size)} • ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                        </div>
                        <div class="document-actions">
                            <button class="btn btn-small btn-secondary" onclick="previewDocument('${doc.path}', '${doc.name}')">👁️ Visualizar</button>
                            <button class="btn btn-small btn-primary" onclick="downloadDocument('${doc.path}', '${doc.name}')">📥 Download</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('❌ Erro ao carregar documentos:', error);
        showError('Erro ao carregar documentos');
    }
}

function closeDocumentsModal() {
    const modal = document.getElementById('documentsModal');
    if (modal) modal.style.display = 'none';
}

async function previewDocument(filePath, fileName) {
    try {
        const { data, error } = await supabaseClient.storage.from('documentos').createSignedUrl(filePath, 60);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (error) {
        showError('Erro ao visualizar documento');
    }
}

async function downloadDocument(filePath, fileName) {
    try {
        const { data, error } = await supabaseClient.storage.from('documentos').download(filePath);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Download iniciado!');
    } catch (error) {
        showError('Erro ao baixar documento');
    }
}

// ==========================================
// 6. HISTÓRICO DE EDIÇÕES
// ==========================================
async function loadHistory() {
    try {
        const tableBody = document.getElementById('historyTableBody');
        const emptyState = document.getElementById('emptyHistoryState');
        if (!tableBody) return;

        if (!supabaseClient) return showError('Supabase não inicializado');

        const { data: history, error } = await supabaseClient.from('historico_edicoes').select('*').order('data_edicao', { ascending: false });

        if (error || !history || history.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        tableBody.innerHTML = history.map(item => `
            <tr>
                <td>${new Date(item.data_edicao).toLocaleString('pt-BR')}</td>
                <td>${sanitizeOutput(item.responsavel)}</td>
                <td>ID: ${item.formulario_id}</td>
                <td><strong>${sanitizeOutput(item.campo_editado)}</strong></td>
                <td>${sanitizeOutput(item.valor_anterior)}</td>
                <td>${sanitizeOutput(item.valor_novo)}</td>
                <td><button class="btn btn-secondary btn-small" onclick="alert('ID: ${item.id}')">Ver</button></td>
            </tr>
        `).join('');

        emptyState.style.display = 'none';
        window.allHistory = history;

    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
    }
}

function filterHistory() {
    const search = document.getElementById('searchHistory').value.toLowerCase();
    const date = document.getElementById('dateFilter').value;
    if (!window.allHistory) return;

    const filtered = window.allHistory.filter(item => {
        const matchSearch = !search || (item.responsavel && item.responsavel.toLowerCase().includes(search)) || (item.campo_editado && item.campo_editado.toLowerCase().includes(search));
        const matchDate = !date || new Date(item.data_edicao).toISOString().split('T')[0] === date;
        return matchSearch && matchDate;
    });

    const tableBody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('emptyHistoryState');

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
    } else {
        tableBody.innerHTML = filtered.map(item => `
            <tr>
                <td>${new Date(item.data_edicao).toLocaleString('pt-BR')}</td>
                <td>${sanitizeOutput(item.responsavel)}</td>
                <td>ID: ${item.formulario_id}</td>
                <td><strong>${sanitizeOutput(item.campo_editado)}</strong></td>
                <td>${sanitizeOutput(item.valor_anterior)}</td>
                <td>${sanitizeOutput(item.valor_novo)}</td>
                <td><button class="btn btn-secondary btn-small" onclick="alert('ID: ${item.id}')">Ver</button></td>
            </tr>
        `).join('');
        emptyState.style.display = 'none';
    }
}

// ==========================================
// 7. UTILITÁRIOS
// ==========================================
async function syncSupabase() {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = '⏳ Sincronizando...';
        await loadForms();
        btn.disabled = false;
        btn.textContent = '🔄 Sincronizar';
        showSuccess('Sincronização concluída!');
    } catch (error) {
        showError('Erro ao sincronizar');
    }
}

function sanitizeOutput(text) {
    if (!text) return '-';
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getTipoFormulario(tipo) {
    const tipos = { 'registro': 'Registro de Empresa', 'alteracao': 'Alteração de Empresa', 'empregado': 'Registro de Empregado' };
    return tipos[tipo] || tipo || 'Formulário';
}

function formatCurrency(value) {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function sanitizeFileName(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', csv: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', txt: '📃', zip: '🗜️', rar: '🗜️' };
    return icons[ext] || '📦';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 2000; animation: slideIn 0.3s ease;`;
    notification.textContent = '✅ ' + message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease'; setTimeout(() => notification.remove(), 300); }, 3000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: #F44336; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 2000; animation: slideIn 0.3s ease;`;
    notification.textContent = '❌ ' + message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease'; setTimeout(() => notification.remove(), 300); }, 3000);
}

// Variáveis globais para os CNAEs
window.allCnaes = [];
window.targetCnaeInputId = '';

// ===== ABRIR MODAL DE CNAEs =====
async function openCnaeModal(targetInputId) {
    window.targetCnaeInputId = targetInputId;
    const modal = document.getElementById('cnaeModal');
    modal.style.display = 'flex';

    // Carregar os CNAEs apenas na primeira vez
    if (window.allCnaes.length === 0) {
        await loadCnaesFromExcel();
    } else {
        renderCnaeTable(window.allCnaes);
    }
}

function closeCnaeModal() {
    document.getElementById('cnaeModal').style.display = 'none';
    document.getElementById('searchCnaeInput').value = ''; // Limpa a busca
}

// ===== CARREGAR CNAEs DO EXCEL =====
async function loadCnaesFromExcel() {
    try {
        // Caminho para o seu arquivo Excel (ajuste se necessário)
        const response = await fetch('CNAE.xlsx'); 
        const arrayBuffer = await response.arrayBuffer();
        
        // Ler o arquivo com SheetJS
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converter para JSON (assumindo que a primeira linha tem os cabeçalhos)
        // Ajuste os nomes das colunas ('Código' e 'Descrição') conforme o seu arquivo real
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Mapear os dados para um formato padrão
        window.allCnaes = jsonData.map(row => {
            // Tenta encontrar as colunas de código e descrição (ajuste os nomes se necessário)
            const keys = Object.keys(row);
            const codigo = row[keys[0]] || ''; // Assume que a primeira coluna é o código
            const descricao = row[keys[1]] || ''; // Assume que a segunda coluna é a descrição
            
            return {
                codigo: String(codigo).trim(),
                descricao: String(descricao).trim()
            };
        }).filter(cnae => cnae.codigo && cnae.descricao); // Remove linhas vazias

        renderCnaeTable(window.allCnaes);

    } catch (error) {
        console.error('❌ Erro ao carregar CNAEs:', error);
        document.getElementById('cnaeTableBody').innerHTML = `
            <tr>
                <td colspan="3" class="text-center" style="color: var(--danger-color);">
                    Erro ao carregar o arquivo CNAE.xlsx. Verifique se ele está na mesma pasta.
                </td>
            </tr>
        `;
    }
}

// ===== RENDERIZAR TABELA DE CNAEs =====
function renderCnaeTable(cnaes) {
    const tbody = document.getElementById('cnaeTableBody');
    
    if (cnaes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum CNAE encontrado.</td></tr>';
        return;
    }

    // Limita a renderização inicial para não travar o navegador se a lista for muito grande
    const cnaesToRender = cnaes.slice(0, 100); 

    tbody.innerHTML = cnaesToRender.map(cnae => `
        <tr>
            <td style="font-weight: bold;">${cnae.codigo}</td>
            <td>${cnae.descricao}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="selectCnae('${cnae.codigo}', '${cnae.descricao.replace(/'/g, "\'")}')">
                    Selecionar
                </button>
            </td>
        </tr>
    `).join('');
    
    if (cnaes.length > 100) {
        tbody.innerHTML += `<tr><td colspan="3" class="text-center" style="color: var(--gray-500); font-size: 12px;">Mostrando os primeiros 100 resultados. Use a busca para encontrar mais.</td></tr>`;
    }
}

// ===== FILTRAR CNAEs =====
function filterCnaes() {
    const searchTerm = document.getElementById('searchCnaeInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderCnaeTable(window.allCnaes);
        return;
    }

    const filtered = window.allCnaes.filter(cnae => 
        cnae.codigo.toLowerCase().includes(searchTerm) || 
        cnae.descricao.toLowerCase().includes(searchTerm)
    );

    renderCnaeTable(filtered);
}

// ===== SELECIONAR CNAE =====
function selectCnae(codigo, descricao) {
    const input = document.getElementById(window.targetCnaeInputId);
    if (input) {
        // Formata como "CÓDIGO - Descrição"
        input.value = `${codigo} - ${descricao}`;
    }
    closeCnaeModal();
}

// ==========================================
// 8. BUSCA DE CNAEs (Lendo da variável global)
// ==========================================
window.allCnaes = [];
window.targetCnaeInputId = '';

async function openCnaeModal(targetInputId) {
    // Se targetInputId for vazio (''), significa que abriu pela sidebar (apenas consulta)
    window.targetCnaeInputId = targetInputId;
    const modal = document.getElementById('cnaeModal');
    modal.style.display = 'flex';

    if (window.allCnaes.length === 0) {
        loadCnaesFromVariable();
    } else {
        renderCnaeTable(window.allCnaes);
    }
}

function closeCnaeModal() {
    document.getElementById('cnaeModal').style.display = 'none';
    document.getElementById('searchCnaeInput').value = '';
}

function loadCnaesFromVariable() {
    try {
        // Verifica se a variável global existe (carregada do cnaes.js)
        if (!window.CNAE_DATA) {
            throw new Error('Dados não encontrados. Verifique se o arquivo cnaes.js foi importado no HTML.');
        }
        
        // Lê o texto que está na variável
        const lines = window.CNAE_DATA.split('\n');
        const cnaes = [];
        
        // Pula o cabeçalho (i=1)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // O seu arquivo usa ponto e vírgula como separador
            const parts = line.split(';');
            
            // A estrutura do seu arquivo é:
            // [0]Seção ; [1]Divisão ; [2]Grupo ; [3]Classe ; [4]Subclasse ; [5]Denominação
            
            // Só queremos as linhas que têm a Subclasse preenchida (que é o CNAE final de 7 dígitos)
            // A Subclasse está no índice 4 (quinta coluna) e a Denominação no índice 5 (sexta coluna)
            if (parts.length >= 6) {
                const subclasse = parts[4].replace(/"/g, '').trim();
                const denominacao = parts[5].replace(/"/g, '').trim();
                
                // Se a subclasse não estiver vazia, é um CNAE válido que podemos usar
                if (subclasse !== '') {
                    cnaes.push({ 
                        codigo: subclasse, 
                        descricao: denominacao 
                    });
                }
            }
        }
        
        window.allCnaes = cnaes;
        renderCnaeTable(window.allCnaes);

    } catch (error) {
        console.error('❌ Erro ao carregar CNAEs:', error);
        document.getElementById('cnaeTableBody').innerHTML = `
            <tr>
                <td colspan="3" class="text-center" style="color: var(--danger-color); padding: 20px;">
                    <strong>Erro ao carregar a lista de CNAEs.</strong><br><br>
                    ${error.message}
                </td>
            </tr>
        `;
    }
}

function renderCnaeTable(cnaes) {
    const tbody = document.getElementById('cnaeTableBody');
    
    if (cnaes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum CNAE encontrado.</td></tr>';
        return;
    }

    const cnaesToRender = cnaes.slice(0, 100); 

    tbody.innerHTML = cnaesToRender.map(cnae => `
        <tr>
            <td style="font-weight: bold; white-space: nowrap;">${sanitizeOutput(cnae.codigo)}</td>
            <td>${sanitizeOutput(cnae.descricao)}</td>
            <td style="text-align: right;">
                <button class="btn btn-primary btn-small" onclick="selectCnae('${sanitizeOutput(cnae.codigo)}', '${sanitizeOutput(cnae.descricao).replace(/'/g, "\'")}')">
                    ${window.targetCnaeInputId ? 'Selecionar' : 'Copiar'}
                </button>
            </td>
        </tr>
    `).join('');
    
    if (cnaes.length > 100) {
        tbody.innerHTML += `<tr><td colspan="3" class="text-center" style="color: var(--gray-500); font-size: 12px; padding: 10px;">Mostrando os primeiros 100 resultados. Use a busca para encontrar mais.</td></tr>`;
    }
}

function filterCnaes() {
    const searchTerm = document.getElementById('searchCnaeInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderCnaeTable(window.allCnaes);
        return;
    }

    const filtered = window.allCnaes.filter(cnae => 
        cnae.codigo.toLowerCase().includes(searchTerm) || 
        cnae.descricao.toLowerCase().includes(searchTerm)
    );

    renderCnaeTable(filtered);
}

function selectCnae(codigo, descricao) {
    // Se foi aberto a partir de um input de edição, preenche o input
    if (window.targetCnaeInputId) {
        const input = document.getElementById(window.targetCnaeInputId);
        if (input) {
            input.value = `${codigo} - ${descricao}`;
        }
        closeCnaeModal();
    } else {
        // Se foi aberto pela sidebar (apenas consulta), copia para a área de transferência
        const textoCopiar = `${codigo} - ${descricao}`;
        navigator.clipboard.writeText(textoCopiar).then(() => {
            showSuccess('CNAE copiado para a área de transferência!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
        });
    }
}