/**
 * SCONT - Painel de Administração
 * Arquivo: admin.js
 */

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via admin.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    carregarEmpresas();
    carregarEmpregados();
    carregarRubricas();
    carregarRegras();
    carregarMapeamentos();
    configurarUpload();
});

// --- NAVEGAÇÃO DE ABAS ---

function abrirAba(abaId) {
    document.querySelectorAll('.admin-tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(abaId).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
}

// --- EMPRESAS ---

async function carregarEmpresas() {
    try {
        const { data, error } = await supabaseClient.from('rh_empresas').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        renderizarTabelaEmpresas(data || []);
        atualizarSelectEmpresas(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar empresas.'); }
}

function renderizarTabelaEmpresas(empresas) {
    const tbody = document.getElementById('empresasTableBody');
    tbody.innerHTML = '';
    if (empresas.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #95A5A6;">Nenhuma empresa cadastrada</td></tr>'; return; }
    empresas.forEach(empresa => {
        const dataCriacao = new Date(empresa.data_criacao).toLocaleDateString('pt-BR');
        tbody.innerHTML += `<tr><td><strong>${empresa.codigo_empresa}</strong></td><td>${empresa.nome_empresa}</td><td>${dataCriacao}</td><td><button type="button" class="btn-delete" onclick="deletarEmpresa('${empresa.codigo_empresa}')">Deletar</button></td></tr>`;
    });
}

function atualizarSelectEmpresas(empresas) {
    const selectEmp = document.getElementById('empresaSelect');
    const selectRub = document.getElementById('rubricaEmpresaSelect');
    const options = '<option value="">Selecione uma empresa...</option>' + empresas.map(e => `<option value="${e.codigo_empresa}">${e.codigo_empresa} - ${e.nome_empresa}</option>`).join('');
    selectEmp.innerHTML = options;
    selectRub.innerHTML = options;
}

async function adicionarEmpresa() {
    const codigo = document.getElementById('codigoEmpresa').value.trim();
    const nome = document.getElementById('nomeEmpresa').value.trim();
    if (!codigo || !nome) { mostrarStatus('statusEmpresas', 'Preencha todos os campos', 'error'); return; }
    try {
        const { error } = await supabaseClient.from('rh_empresas').insert([{ codigo_empresa: codigo, nome_empresa: nome }]);
        if (error) throw error;
        document.getElementById('codigoEmpresa').value = ''; document.getElementById('nomeEmpresa').value = '';
        mostrarStatus('statusEmpresas', '✅ Empresa adicionada com sucesso!', 'success');
        carregarEmpresas();
    } catch (erro) { mostrarStatus('statusEmpresas', 'Erro ao adicionar empresa: ' + erro.message, 'error'); }
}

async function deletarEmpresa(codigo) {
    if (!confirm('Tem certeza que deseja deletar esta empresa?')) return;
    try {
        const { error } = await supabaseClient.from('rh_empresas').delete().eq('codigo_empresa', codigo);
        if (error) throw error;
        mostrarStatus('statusEmpresas', '✅ Empresa deletada com sucesso!', 'success');
        carregarEmpresas();
    } catch (erro) { mostrarStatus('statusEmpresas', 'Erro ao deletar empresa: ' + erro.message, 'error'); }
}

// --- EMPREGADOS ---

async function carregarEmpregados() {
    try {
        const { data, error } = await supabaseClient.from('rh_empregados').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        renderizarTabelaEmpregados(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar empregados.'); }
}

function renderizarTabelaEmpregados(empregados) {
    const tbody = document.getElementById('empregadosTableBody');
    tbody.innerHTML = '';
    if (empregados.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #95A5A6;">Nenhum empregado cadastrado</td></tr>'; return; }
    empregados.forEach(empregado => {
        const dataCriacao = new Date(empregado.data_criacao).toLocaleDateString('pt-BR');
        tbody.innerHTML += `<tr><td><strong>${empregado.codigo_empresa}</strong></td><td>${empregado.codigo_empregado}</td><td>${empregado.nome_empregado}</td><td>${dataCriacao}</td><td><button type="button" class="btn-delete" onclick="deletarEmpregado(${empregado.id})">Deletar</button></td></tr>`;
    });
}

async function adicionarEmpregado() {
    const codigoEmpresa = document.getElementById('empresaSelect').value;
    const codigoEmpregado = document.getElementById('codigoEmpregado').value.trim();
    const nomeEmpregado = document.getElementById('nomeEmpregado').value.trim();
    if (!codigoEmpresa || !codigoEmpregado || !nomeEmpregado) { mostrarStatus('statusEmpregados', 'Preencha todos os campos', 'error'); return; }
    try {
        const { error } = await supabaseClient.from('rh_empregados').insert([{ codigo_empresa: codigoEmpresa, codigo_empregado: codigoEmpregado, nome_empregado: nomeEmpregado }]);
        if (error) throw error;
        document.getElementById('codigoEmpregado').value = ''; document.getElementById('nomeEmpregado').value = '';
        mostrarStatus('statusEmpregados', '✅ Empregado adicionado com sucesso!', 'success');
        carregarEmpregados();
    } catch (erro) { mostrarStatus('statusEmpregados', 'Erro ao adicionar empregado: ' + erro.message, 'error'); }
}

async function deletarEmpregado(id) {
    if (!confirm('Tem certeza que deseja deletar este empregado?')) return;
    try {
        const { error } = await supabaseClient.from('rh_empregados').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusEmpregados', '✅ Empregado deletado com sucesso!', 'success');
        carregarEmpregados();
    } catch (erro) { mostrarStatus('statusEmpregados', 'Erro ao deletar empregado: ' + erro.message, 'error'); }
}

// --- RUBRICAS ---

const nomesEventos = {
    'horasTrabalhadas': 'Horas Trabalhadas',
    'horasExtras50': 'Horas Extras 50%',
    'horasExtras100': 'Horas Extras 100%',
    'horasNoturnaConvertida': 'Horas Noturnas Convertidas',
    'horasDevidas': 'Horas Devidas (Faltas/Atrasos)'
};

async function carregarRubricas() {
    try {
        const { data, error } = await supabaseClient.from('rh_rubricas').select('*').order('codigo_empresa', { ascending: true });
        if (error) throw error;
        renderizarTabelaRubricas(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar rubricas.'); }
}

function renderizarTabelaRubricas(rubricas) {
    const tbody = document.getElementById('rubricasTableBody');
    tbody.innerHTML = '';
    if (rubricas.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #95A5A6;">Nenhuma rubrica cadastrada</td></tr>'; return; }
    rubricas.forEach(rubrica => {
        const nomeEvento = nomesEventos[rubrica.evento] || rubrica.evento;
        tbody.innerHTML += `<tr><td><strong>${rubrica.codigo_empresa}</strong></td><td>${nomeEvento}</td><td>${rubrica.codigo_rubrica}</td><td><button type="button" class="btn-delete" onclick="deletarRubrica(${rubrica.id})">Deletar</button></td></tr>`;
    });
}

async function adicionarRubrica() {
    const codigoEmpresa = document.getElementById('rubricaEmpresaSelect').value;
    const evento = document.getElementById('rubricaEventoSelect').value;
    const codigoRubrica = document.getElementById('codigoRubrica').value.trim();
    
    if (!codigoEmpresa || !evento || !codigoRubrica) { mostrarStatus('statusRubricas', 'Preencha todos os campos', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_rubricas').upsert([{ 
            codigo_empresa: codigoEmpresa, 
            evento: evento, 
            codigo_rubrica: codigoRubrica 
        }], { onConflict: 'codigo_empresa, evento' });
        
        if (error) throw error;
        
        document.getElementById('codigoRubrica').value = '';
        mostrarStatus('statusRubricas', '✅ Rubrica salva com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao salvar rubrica: ' + erro.message, 'error'); }
}

async function deletarRubrica(id) {
    if (!confirm('Tem certeza que deseja deletar esta rubrica?')) return;
    try {
        const { error } = await supabaseClient.from('rh_rubricas').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRubricas', '✅ Rubrica deletada com sucesso!', 'success');
        carregarRubricas();
    } catch (erro) { mostrarStatus('statusRubricas', 'Erro ao deletar rubrica: ' + erro.message, 'error'); }
}

// --- REGRAS DE RENOMEAÇÃO ---

async function carregarRegras() {
    try {
        const { data, error } = await supabaseClient.from('rh_regras_renomeacao').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        renderizarTabelaRegras(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar regras de renomeação.'); }
}

function renderizarTabelaRegras(regras) {
    const tbody = document.getElementById('regrasTableBody');
    tbody.innerHTML = '';
    if (regras.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #95A5A6;">Nenhuma regra cadastrada</td></tr>'; return; }
    regras.forEach(regra => {
        tbody.innerHTML += `<tr>
            <td style="font-family: monospace; font-size: 12px;">${regra.padrao_de}</td>
            <td style="font-family: monospace; font-size: 12px; color: #8B3A3A;">${regra.padrao_para}</td>
            <td><button type="button" class="btn-delete" onclick="deletarRegra(${regra.id})">Deletar</button></td>
        </tr>`;
    });
}

async function adicionarRegra() {
    const padraoDe = document.getElementById('padraoDe').value.trim();
    const padraoPara = document.getElementById('padraoPara').value.trim();
    
    if (!padraoDe || !padraoPara) { mostrarStatus('statusRegras', 'Preencha ambos os padrões.', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_regras_renomeacao').insert([{ padrao_de: padraoDe, padrao_para: padraoPara }]);
        if (error) throw error;
        
        document.getElementById('padraoDe').value = '';
        document.getElementById('padraoPara').value = '';
        mostrarStatus('statusRegras', '✅ Regra salva com sucesso!', 'success');
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar regra: ' + erro.message, 'error'); }
}

async function deletarRegra(id) {
    if (!confirm('Tem certeza que deseja deletar esta regra?')) return;
    try {
        const { error } = await supabaseClient.from('rh_regras_renomeacao').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRegras', '✅ Regra deletada com sucesso!', 'success');
        carregarRegras();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar regra: ' + erro.message, 'error'); }
}

// --- MAPEAMENTO DE NOMES DE DOCUMENTOS ---

async function carregarMapeamentos() {
    try {
        const { data, error } = await supabaseClient.from('rh_mapeamento_nomes').select('*').order('nome_arquivo', { ascending: true });
        if (error) throw error;
        renderizarTabelaMapeamentos(data || []);
    } catch (erro) { mostrarMensagem('Erro', 'Erro ao carregar mapeamentos.'); }
}

function renderizarTabelaMapeamentos(mapeamentos) {
    const tbody = document.getElementById('mapeamentoTableBody');
    tbody.innerHTML = '';
    if (mapeamentos.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #95A5A6;">Nenhum mapeamento cadastrado</td></tr>'; return; }
    mapeamentos.forEach(map => {
        tbody.innerHTML += `<tr>
            <td>${map.nome_arquivo}</td>
            <td style="color: #8B3A3A; font-weight: bold;">${map.nome_documento}</td>
            <td><button type="button" class="btn-delete" onclick="deletarMapeamento(${map.id})">Deletar</button></td>
        </tr>`;
    });
}

async function adicionarMapeamento() {
    const nomeArquivo = document.getElementById('mapNomeArquivo').value.trim();
    const nomeDocumento = document.getElementById('mapNomeDocumento').value.trim();
    
    if (!nomeArquivo || !nomeDocumento) { mostrarStatus('statusRegras', 'Preencha ambos os campos do mapeamento.', 'error'); return; }
    
    try {
        const { error } = await supabaseClient.from('rh_mapeamento_nomes').upsert([{ 
            nome_arquivo: nomeArquivo, 
            nome_documento: nomeDocumento 
        }], { onConflict: 'nome_arquivo' });
        
        if (error) throw error;
        
        document.getElementById('mapNomeArquivo').value = '';
        document.getElementById('mapNomeDocumento').value = '';
        mostrarStatus('statusRegras', '✅ Mapeamento salvo com sucesso!', 'success');
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao salvar mapeamento: ' + erro.message, 'error'); }
}

async function deletarMapeamento(id) {
    if (!confirm('Tem certeza que deseja deletar este mapeamento?')) return;
    try {
        const { error } = await supabaseClient.from('rh_mapeamento_nomes').delete().eq('id', id);
        if (error) throw error;
        mostrarStatus('statusRegras', '✅ Mapeamento deletado com sucesso!', 'success');
        carregarMapeamentos();
    } catch (erro) { mostrarStatus('statusRegras', 'Erro ao deletar mapeamento: ' + erro.message, 'error'); }
}

// --- IMPORTAÇÃO DE DADOS (EXCEL) ---

function configurarUpload() {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); const files = e.dataTransfer.files; if (files.length > 0) processarArquivo(files[0]); });
}

function handleFileSelect(event) { const files = event.target.files; if (files.length > 0) processarArquivo(files[0]); }








async function processarArquivo(file) {
    try {
        mostrarStatus('statusImportar', 'Lendo arquivo...', 'info'); 
        document.getElementById('importProgress').style.display = 'block';
        
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        
        // ===== EMPRESAS =====
        const empresasSheet = workbook.Sheets['Empresas']; 
        if (!empresasSheet) throw new Error('Aba "Empresas" não encontrada');
        
        const empresasData = XLSX.utils.sheet_to_json(empresasSheet, { 
            header: ['codigo_empresa', 'nome_empresa'], 
            defval: '' 
        }).filter(row => row.codigo_empresa && row.nome_empresa)
         .map(row => ({
            codigo_empresa: String(row.codigo_empresa).trim(),
            nome_empresa: String(row.nome_empresa).trim()
        }));
        
        console.log('📊 Empresas lidas:', empresasData);
        
        // ===== EMPREGADOS =====
        const empregadosSheet = workbook.Sheets['Empregados']; 
        if (!empregadosSheet) throw new Error('Aba "Empregados" não encontrada');
        
        let empregadosData = XLSX.utils.sheet_to_json(empregadosSheet, { 
            header: ['codigo_empresa', 'codigo_empregado', 'nome_empregado'], 
            defval: '' 
        }).filter(row => row.codigo_empresa && row.codigo_empregado && row.nome_empregado)
         .map(row => ({
            codigo_empresa: String(row.codigo_empresa).trim(),
            codigo_empregado: String(row.codigo_empregado).trim(),
            nome_empregado: String(row.nome_empregado).trim()
        }));
        
        console.log('👥 Empregados lidos:', empregadosData);
        
        // VALIDAÇÃO: Verificar se todos os codigo_empresa dos empregados existem nas empresas
        const codigosEmpresasValidos = new Set(empresasData.map(e => e.codigo_empresa));
        const empregadosComErro = empregadosData.filter(emp => !codigosEmpresasValidos.has(emp.codigo_empresa));
        
        if (empregadosComErro.length > 0) {
            console.error('❌ Empregados com empresa inexistente:', empregadosComErro);
            
            // MENSAGEM DETALHADA COM NOME DO EMPREGADO
            const detalhesErro = empregadosComErro.map(e => 
                `\n🔴 Nome: ${e.nome_empregado}\n   Empresa: ${e.codigo_empresa}\n   Código: ${e.codigo_empregado}`
            ).join('\n');
            
            throw new Error(`❌ ERRO: ${empregadosComErro.length} empregado(s) com empresa inválida!\n\nDELETE ESSAS LINHAS DA ABA "EMPREGADOS":${detalhesErro}\n\nEssas linhas têm valores de placeholder (CÓDIGO DA EMPRESA, CODIGO DO EMPREGADO, etc) em vez de dados reais.`);
        }
        
        // VALIDAÇÃO: Remover duplicatas
        const empregadosUnicos = [];
        const chavesVistas = new Set();
        let duplicatasRemovidas = 0;
        
        empregadosData.forEach(row => {
            const chaveUnica = `${row.codigo_empresa}|${row.codigo_empregado}`;
            
            if (!chavesVistas.has(chaveUnica)) {
                chavesVistas.add(chaveUnica);
                empregadosUnicos.push(row);
            } else {
                duplicatasRemovidas++;
                console.warn(`⚠️ Duplicata removida: Empresa ${row.codigo_empresa}, Empregado ${row.codigo_empregado}`);
            }
        });
        
        // ===== RUBRICAS =====
        const rubricasSheet = workbook.Sheets['Rubricas'];
        let rubricasData = [];
        if (rubricasSheet) {
            rubricasData = XLSX.utils.sheet_to_json(rubricasSheet, { 
                header: ['codigo_empresa', 'codigo_rubrica', 'evento'], 
                defval: '' 
            }).filter(row => row.codigo_empresa && row.codigo_rubrica && row.evento)
             .map(row => ({
                codigo_empresa: String(row.codigo_empresa).trim(),
                codigo_rubrica: String(row.codigo_rubrica).trim(),
                evento: String(row.evento).trim()
            }));
            
            console.log('📋 Rubricas lidas:', rubricasData);
        }
        
        // ===== LIMPEZA =====
        mostrarStatus('statusImportar', 'Limpando dados existentes...', 'info'); 
        document.getElementById('progressBar').style.width = '20%';
        
        await supabaseClient.from('rh_rubricas').delete().neq('id', 0);
        await supabaseClient.from('rh_empregados').delete().neq('id', 0);
        await supabaseClient.from('rh_empresas').delete().neq('id', 0);
        
        // ===== INSERÇÃO =====
        
        // 1. EMPRESAS
        mostrarStatus('statusImportar', 'Importando empresas...', 'info'); 
        document.getElementById('progressBar').style.width = '40%';
        
        if (empresasData.length > 0) { 
            const { error } = await supabaseClient.from('rh_empresas').insert(empresasData); 
            if (error) {
                console.error('❌ Erro ao inserir empresas:', error);
                throw error;
            }
        }
        
        // 2. EMPREGADOS
        mostrarStatus('statusImportar', 'Importando empregados...', 'info'); 
        document.getElementById('progressBar').style.width = '60%';
        
        if (empregadosUnicos.length > 0) { 
            console.log('📤 Enviando empregados:', empregadosUnicos);
            const { error } = await supabaseClient.from('rh_empregados').insert(empregadosUnicos); 
            if (error) {
                console.error('❌ Erro ao inserir empregados:', error);
                console.error('Dados que causaram erro:', empregadosUnicos);
                throw error;
            }
        }
        
        // 3. RUBRICAS
        mostrarStatus('statusImportar', 'Importando rubricas...', 'info'); 
        document.getElementById('progressBar').style.width = '80%';
        
        if (rubricasData.length > 0) { 
            const { error } = await supabaseClient.from('rh_rubricas').insert(rubricasData); 
            if (error) {
                console.error('❌ Erro ao inserir rubricas:', error);
                throw error;
            }
        }
        
        // ===== SUCESSO =====
        document.getElementById('progressBar').style.width = '100%';
        
        setTimeout(() => {
            document.getElementById('importProgress').style.display = 'none';
            
            const mensagem = `✅ Importação concluída!\n` +
                `${empresasData.length} empresas\n` +
                `${empregadosUnicos.length} empregados${duplicatasRemovidas > 0 ? ` (${duplicatasRemovidas} duplicatas removidas)` : ''}\n` +
                `${rubricasData.length} rubricas`;
            
            mostrarStatus('statusImportar', mensagem, 'success');
            
            carregarEmpresas(); 
            carregarEmpregados(); 
            carregarRubricas(); 
            
            document.getElementById('fileInput').value = '';
        }, 1000);
        
    } catch (erro) { 
        document.getElementById('importProgress').style.display = 'none'; 
        console.error('🔴 ERRO COMPLETO:', erro);
        mostrarStatus('statusImportar', '❌ Erro ao importar: ' + erro.message, 'error'); 
    }
}












// --- UTILITÁRIOS ---

function mostrarStatus(elementId, mensagem, tipo) { 
    const el = document.getElementById(elementId); 
    el.textContent = mensagem; 
    el.className = 'status-message ' + tipo; 
}

function mostrarMensagem(titulo, mensagem) { 
    document.getElementById('messageTitle').textContent = titulo; 
    document.getElementById('messageText').textContent = mensagem; 
    document.getElementById('messageModal').classList.add('active'); 
}

function fecharModalMensagem() { 
    document.getElementById('messageModal').classList.remove('active'); 
}