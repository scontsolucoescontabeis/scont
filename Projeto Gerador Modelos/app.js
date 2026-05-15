/* ── Gerador de Modelos — app.js ─────────────────────────── */

let sb = null;

// ── Estado global ────────────────────────────────────────────
let currentUser = null;
let modelos = [];
let empresas = [];
let empregados = [];
let socios = [];
let rubricas = [];
let excelData = [];
let excelHeaders = [];

// Wizard
let wizardStep = 1;
let wizardEmpresasSelecionadas = [];
let wizardModeloSelecionado = null;
let wizardRegistros = [];
let wizardPreviewIndex = 0;
let wizardCabecalho = 'completo';

// Definição das variáveis disponíveis por fonte
const VARS_DEF = {
  empresas: {
    label: '🏢 Empresa',
    prefix: 'empresa',
    campos: [
      ['codigo_empresa','Código'],
      ['nome_empresa','Nome da Empresa'],
      ['cnpj','CNPJ'],
      ['regime_enquadramento','Regime'],
      ['inscricao_estadual','Insc. Estadual'],
      ['inscricao_municipal','Insc. Municipal'],
      ['municipio','Município'],
      ['status_situacao','Status'],
      ['data_cadastro','Dt. Cadastro'],
      ['endereco','Endereço'],
      ['cep','CEP'],
      ['cidade','Cidade'],
    ]
  },
  empregados: {
    label: '👤 Empregado',
    prefix: 'empregado',
    campos: [
      // Identificação
      ['codigo_empregado','Cód. Empregado'],
      ['nome_empregado','Nome'],
      ['nome_social','Nome Social'],
      ['cod_esocial','Cód. eSocial'],
      ['cpf','CPF'],
      ['pis','PIS'],
      ['rg','RG'],
      ['uf_rg','UF RG'],
      ['orgao_rg','Órgão RG'],
      ['expedicao_rg','Data Exp. RG'],
      ['data_nascimento','Data Nascimento'],
      ['cidade_nascimento','Cidade Nascimento'],
      ['uf_nascimento','UF Nasc.'],
      ['pais_nascimento','País Nascimento'],
      ['sexo','Sexo'],
      ['estado_civil','Estado Civil'],
      ['raca_cor','Raça/Cor'],
      ['nome_mae','Nome Mãe'],
      ['nome_pai','Nome Pai'],
      // Admissão
      ['data_admissao','Admissão'],
      ['fim_determinado','Fim Determinado'],
      ['fim_prorrogacao','Fim Prorrogação'],
      ['situacao','Situação'],
      ['data_demissao','Data Demissão'],
      ['motivo_demissao','Motivo Demissão'],
      ['tipo_empregado','Tipo Empregado'],
      // Cargo / função
      ['salario','Salário'],
      ['categoria','Categoria'],
      ['cod_cargo','Cód. Cargo'],
      ['desc_cargo','Descrição Cargo'],
      ['cbo','CBO'],
      ['cod_funcao','Cód. Função'],
      ['desc_funcao','Descrição Função'],
      ['cod_ccusto','Cód. C.Custo'],
      ['desc_ccusto','Descrição C.Custo'],
      ['cod_servico','Cód. Serviço'],
      ['desc_servico','Descrição Serviço'],
      ['cod_dpto','Cód. Dpto'],
      ['desc_dpto','Descrição Dpto'],
      ['cod_sind','Cód. Sindicato'],
      ['sindicato','Sindicato'],
      ['jornada','Jornada'],
      // Endereço
      ['endereco','Endereço'],
      ['numero_end','Número'],
      ['complemento','Complemento'],
      ['bairro','Bairro'],
      ['cep','CEP'],
      ['cidade','Cidade'],
      ['uf_endereco','UF End.'],
      // Contato
      ['telefone','Telefone'],
      ['celular','Celular'],
      ['email','E-mail'],
      // Dados bancários
      ['nome_banco','Banco'],
      ['tipo_conta','Tipo Conta'],
      ['agencia','Agência'],
      ['conta_bancaria','Conta'],
      // Documentos
      ['ctps','CTPS'],
      ['serie_ctps','Série CTPS'],
      ['uf_ctps','UF CTPS'],
      ['expedicao_ctps','Expedição CTPS'],
      ['titulo_eleitor','Título Eleitor'],
      ['zona_eleitoral','Zona'],
      ['secao_eleitoral','Seção'],
      ['reservista','Reservista'],
      ['cnh','CNH'],
      ['categoria_cnh','Categoria CNH'],
      ['expedicao_cnh','Expedição CNH'],
      ['vencimento_cnh','Vencimento CNH'],
      ['ric','RIC'],
      ['orgao_ric','Órgão RIC'],
      ['local_ric','Local RIC'],
      ['data_exp_ric','Data Exp. RIC'],
      ['validade_ric','Validade RIC'],
      ['passaporte','Passaporte'],
      ['uf_passaporte','UF Passaporte'],
      ['emissao_passaporte','Emissão Passaporte'],
      ['validade_passaporte','Validade Passaporte'],
      ['rne','RNE'],
      ['orgao_rne','Órgão RNE'],
      ['expedicao_rne','Expedição RNE'],
      // Educação / conselho
      ['grau_instrucao','Grau Instrução'],
      ['nome_conselho','Nome Conselho'],
      ['numero_conselho','Número Conselho'],
      ['expedicao_conselho','Expedição Conselho'],
      ['validade_conselho','Validade Conselho'],
      // Deficiência
      ['possui_deficiencia','Possui Deficiência'],
      ['deficiencia_fisica','Def. Física'],
      ['deficiencia_visual','Def. Visual'],
      ['deficiencia_auditiva','Def. Auditiva'],
      ['deficiencia_intelectual','Def. Intelectual'],
      ['deficiencia_mental','Def. Mental'],
      ['outra_deficiencia','Outra Deficiência'],
      ['reabilitado','Reabilitado(a)'],
      ['obs_deficiencia','Obs. Deficiência'],
      ['cota_deficiente','Cota Deficiente'],
      // Dependentes
      ['nom_dep_1','Nome Dep. 1'], ['nasc_dep_1','Nasc. Dep. 1'], ['cpf_dep_1','CPF Dep. 1'], ['parentesco_dep_1','Parentesco Dep. 1'],
      ['nom_dep_2','Nome Dep. 2'], ['nasc_dep_2','Nasc. Dep. 2'], ['cpf_dep_2','CPF Dep. 2'], ['parentesco_dep_2','Parentesco Dep. 2'],
      ['nom_dep_3','Nome Dep. 3'], ['nasc_dep_3','Nasc. Dep. 3'], ['cpf_dep_3','CPF Dep. 3'], ['parentesco_dep_3','Parentesco Dep. 3'],
      ['nom_dep_4','Nome Dep. 4'], ['nasc_dep_4','Nasc. Dep. 4'], ['cpf_dep_4','CPF Dep. 4'], ['parentesco_dep_4','Parentesco Dep. 4'],
      ['nom_dep_5','Nome Dep. 5'], ['nasc_dep_5','Nasc. Dep. 5'], ['cpf_dep_5','CPF Dep. 5'], ['parentesco_dep_5','Parentesco Dep. 5'],
      ['nom_dep_6','Nome Dep. 6'], ['nasc_dep_6','Nasc. Dep. 6'], ['cpf_dep_6','CPF Dep. 6'], ['parentesco_dep_6','Parentesco Dep. 6'],
      ['nom_dep_7','Nome Dep. 7'], ['nasc_dep_7','Nasc. Dep. 7'], ['cpf_dep_7','CPF Dep. 7'], ['parentesco_dep_7','Parentesco Dep. 7'],
    ]
  },
  socios: {
    label: '🤝 Sócio',
    prefix: 'socio',
    campos: [
      ['nome_socio','Nome'],
      ['cpf','CPF'],
      ['participacao','Participação (%)'],
      ['cargo','Cargo'],
      ['data_entrada','Data de Entrada'],
    ]
  },
  rubricas: {
    label: '💰 Rubrica',
    prefix: 'rubrica',
    campos: [
      ['evento','Evento'],
      ['codigo_rubrica','Código Rubrica'],
    ]
  },
  excel: {
    label: '📊 Planilha',
    prefix: 'excel',
    campos: [] // preenchido dinamicamente
  }
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const auth = await window.PortalAuthGuard.init(1, { returnAfterLogin: true });
  if (!auth) return;

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user ?? null;

  const nome  = auth?.userData?.nome ?? auth?.nome ?? session?.user?.email ?? auth?.email ?? '—';
  const email = session?.user?.email ?? auth?.email ?? auth?.userData?.email ?? '—';
  document.getElementById('sidebarNome').textContent  = nome;
  document.getElementById('sidebarEmail').textContent = email;

  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  // Mobile nav
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  });

  await Promise.all([carregarModelos(), carregarEmpresas(), carregarDashboard()]);
});

// ── Navegação ────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.getElementById('nav-' + name)?.classList.add('active');

  if (name === 'modelos') renderModelos();
  if (name === 'historico') carregarHistorico();
  if (name === 'gerar') iniciarWizard();
  if (name === 'dashboard') carregarDashboard();
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = '', 3000);
}

// ── Dashboard ─────────────────────────────────────────────────
async function carregarDashboard() {
  const [{ data: mods }, { data: gens }] = await Promise.all([
    sb.from('gm_modelos').select('id,nome,tipo,created_at').order('created_at', { ascending: false }),
    sb.from('gm_geracoes').select('id,modelo_nome,total_registros,created_at,empresas_ids,cabecalho_usado').order('created_at', { ascending: false })
  ]);

  const hoje = new Date().toDateString();
  const geracoesHoje = (gens || []).filter(g => new Date(g.created_at).toDateString() === hoje);
  const totalRegistros = (gens || []).reduce((s, g) => s + (g.total_registros || 0), 0);

  document.getElementById('stat-modelos').textContent = (mods || []).length;
  document.getElementById('stat-hoje').textContent = geracoesHoje.length;
  document.getElementById('stat-total').textContent = (gens || []).length;
  document.getElementById('stat-registros').textContent = totalRegistros;

  const dashMods = document.getElementById('dash-modelos');
  if (!mods?.length) {
    dashMods.innerHTML = '<div class="empty"><span class="empty-icon">📄</span><p>Nenhum modelo cadastrado</p></div>';
  } else {
    dashMods.innerHTML = mods.slice(0, 5).map(m => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-light)">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--primary)">${esc(m.nome)}</div>
          <div style="font-size:11px;color:var(--muted)">${fmtData(m.created_at)}</div>
        </div>
        <span class="badge badge-${m.tipo}">${m.tipo === 'por_registro' ? 'Por Registro' : 'Consolidado'}</span>
      </div>
    `).join('');
  }

  const dashHist = document.getElementById('dash-historico');
  if (!gens?.length) {
    dashHist.innerHTML = '<div class="empty"><span class="empty-icon">🕓</span><p>Nenhuma geração registrada</p></div>';
  } else {
    dashHist.innerHTML = gens.slice(0, 5).map(g => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-light)">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${esc(g.modelo_nome)}</div>
          <div style="font-size:11px;color:var(--muted)">${g.total_registros} registro(s) · ${fmtData(g.created_at)}</div>
        </div>
        <span style="font-size:12px;color:var(--muted)">${labelCabecalho(g.cabecalho_usado)}</span>
      </div>
    `).join('');
  }
}

// ── Modelos CRUD ──────────────────────────────────────────────
async function carregarModelos() {
  const { data, error } = await sb.from('gm_modelos').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  modelos = data || [];
}

function renderModelos() {
  const filtro = (document.getElementById('filtro-modelos')?.value || '').toLowerCase();
  const lista = modelos.filter(m => m.nome.toLowerCase().includes(filtro));
  const grid = document.getElementById('modelos-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty"><span class="empty-icon">📄</span><p>Nenhum modelo encontrado</p></div>';
    return;
  }
  grid.innerHTML = lista.map(m => `
    <div class="gm-card">
      <div class="gm-card-top">
        <div class="gm-card-icon">📄</div>
        <div class="gm-card-info">
          <div class="gm-card-name">${esc(m.nome)}</div>
          <div class="gm-card-desc">${esc(m.descricao || 'Sem descrição')}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-${m.tipo}">${m.tipo === 'por_registro' ? 'Por Registro' : 'Consolidado'}</span>
        ${(m.fontes || []).map(f => `<span class="fonte-tag">${f}</span>`).join('')}
      </div>
      <div class="gm-card-footer">
        <button class="btn btn-primary btn-sm" onclick="usarModelo('${m.id}')">⚡ Gerar</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalModelo('${m.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletarModelo('${m.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

function openModalModelo(id) {
  const el = document.getElementById('modal-modelo');
  el.classList.add('open');

  // Reset
  document.getElementById('modelo-id').value = '';
  document.getElementById('modelo-nome').value = '';
  document.getElementById('modelo-descricao').value = '';
  document.getElementById('modelo-tipo').value = 'por_registro';
  document.getElementById('modelo-cabecalho').value = 'completo';
  document.getElementById('modelo-template').innerHTML = '';
  document.querySelectorAll('.fonte-cb').forEach(cb => {
    cb.checked = cb.value === 'empresas' || cb.value === 'empregados';
  });

  if (id) {
    const m = modelos.find(x => x.id === id);
    if (!m) return;
    document.getElementById('modal-modelo-title').textContent = 'Editar Modelo';
    document.getElementById('modelo-id').value = m.id;
    document.getElementById('modelo-nome').value = m.nome;
    document.getElementById('modelo-descricao').value = m.descricao || '';
    document.getElementById('modelo-tipo').value = m.tipo;
    document.getElementById('modelo-cabecalho').value = m.cabecalho_padrao;
    // suporte a templates antigos (texto puro) e novos (HTML)
    const tpl = m.template || '';
    document.getElementById('modelo-template').innerHTML = tpl.includes('<') ? tpl : tpl.replace(/\n/g, '<br>');
    document.querySelectorAll('.fonte-cb').forEach(cb => {
      cb.checked = (m.fontes || []).includes(cb.value);
    });
  } else {
    document.getElementById('modal-modelo-title').textContent = 'Novo Modelo';
  }

  renderVarsPanel();
  document.querySelectorAll('.fonte-cb').forEach(cb => cb.addEventListener('change', renderVarsPanel));
}

function closeModalModelo() {
  document.getElementById('modal-modelo').classList.remove('open');
}

function renderVarsPanel() {
  const fontesAtivas = [...document.querySelectorAll('.fonte-cb:checked')].map(c => c.value);
  const hasExcel = excelHeaders.length > 0;
  const panel = document.getElementById('vars-panel-content');

  let html = '';
  for (const fonte of [...fontesAtivas, ...(hasExcel ? ['excel'] : [])]) {
    const def = VARS_DEF[fonte];
    if (!def) continue;
    const campos = fonte === 'excel'
      ? excelHeaders.map(h => [h, h])
      : def.campos;
    if (!campos.length) continue;
    html += `<div class="vars-group">
      <div class="vars-group-label">${def.label}</div>
      <div>
        ${campos.map(([campo]) => `<span class="var-chip" onclick="insertVar('{{${def.prefix}.${campo}}}')">{{${def.prefix}.${campo}}}</span>`).join('')}
      </div>
    </div>`;
  }
  panel.innerHTML = html || '<p style="font-size:12px;color:var(--muted)">Selecione pelo menos uma fonte acima.</p>';
}

function insertVar(varStr) {
  const editor = document.getElementById('modelo-template');
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    // verifica se o cursor está dentro do editor
    if (editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const node = document.createTextNode(varStr);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }
  // fallback: insere no final
  editor.innerHTML += varStr;
}

async function salvarModelo() {
  const nome = document.getElementById('modelo-nome').value.trim();
  if (!nome) { toast('Informe o nome do modelo.', 'error'); return; }
  const template = document.getElementById('modelo-template').innerHTML.trim();
  if (!template || template === '<br>') { toast('O template não pode ser vazio.', 'error'); return; }

  const fontes = [...document.querySelectorAll('.fonte-cb:checked')].map(c => c.value);
  const payload = {
    nome,
    descricao: document.getElementById('modelo-descricao').value.trim() || null,
    tipo: document.getElementById('modelo-tipo').value,
    cabecalho_padrao: document.getElementById('modelo-cabecalho').value,
    template,
    fontes,
    criado_por: currentUser?.id,
  };

  const id = document.getElementById('modelo-id').value;
  let error;
  if (id) {
    ({ error } = await sb.from('gm_modelos').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('gm_modelos').insert(payload));
  }

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }
  toast('Modelo salvo!', 'success');
  closeModalModelo();
  await carregarModelos();
  renderModelos();
  carregarDashboard();
}

async function deletarModelo(id) {
  if (!confirm('Excluir este modelo?')) return;
  const { error } = await sb.from('gm_modelos').delete().eq('id', id);
  if (error) { toast('Erro ao excluir.', 'error'); return; }
  toast('Modelo excluído.', 'success');
  await carregarModelos();
  renderModelos();
  carregarDashboard();
}

function usarModelo(id) {
  showSection('gerar');
  setTimeout(() => selecionarModeloWizard(id), 100);
}

// ── Empresas ──────────────────────────────────────────────────
async function carregarEmpresas() {
  const { data } = await sb.from('rh_empresas').select('id,codigo_empresa,nome_empresa').order('nome_empresa');
  empresas = data || [];
}

// ── Wizard — sequência dinâmica ───────────────────────────────
// Ordem fixa de painéis possíveis; a sequência ativa depende das fontes do modelo
const WIZARD_PANELS_ORDER = ['modelo', 'empresas', 'empregados', 'socios', 'rubricas', 'exportar'];
const WIZARD_PANEL_LABELS = {
  modelo:     'Modelo',
  empresas:   'Empresas',
  empregados: 'Empregados',
  socios:     'Sócios',
  rubricas:   'Rubricas',
  exportar:   'Exportar',
};

let wizardSequencia = ['modelo', 'empresas', 'exportar']; // recalculado ao selecionar modelo
let wizardPanelAtual = 'modelo';

// Dados brutos carregados após seleção de empresas
let _dbEmpregados = [];
let _dbSocios     = [];
let _dbRubricas   = [];

// Seleções do usuário em cada painel
let wizardEmpregadosSelecionados = []; // array de ids
let wizardSociosSelecionados     = []; // array de ids
let wizardRubricasSelecionados   = []; // array de ids

function calcularSequencia() {
  const fontes = wizardModeloSelecionado?.fontes || [];
  const seq = ['modelo', 'empresas'];
  if (fontes.includes('empregados')) seq.push('empregados');
  if (fontes.includes('socios'))     seq.push('socios');
  if (fontes.includes('rubricas'))   seq.push('rubricas');
  seq.push('exportar');
  return seq;
}

async function iniciarWizard() {
  wizardSequencia            = ['modelo', 'empresas', 'exportar'];
  wizardPanelAtual           = 'modelo';
  wizardModeloSelecionado    = null;
  wizardEmpresasSelecionadas  = [];
  wizardEmpregadosSelecionados = [];
  wizardSociosSelecionados    = [];
  wizardRubricasSelecionados  = [];
  wizardRegistros            = [];
  wizardPreviewIndex         = 0;
  wizardCabecalho            = 'completo';
  _dbEmpregados = []; _dbSocios = []; _dbRubricas = [];

  renderWizardBar();
  mostrarPainel('modelo');
  await carregarEmpresas();
  renderModelosWizard();
}

function renderWizardBar() {
  const bar = document.getElementById('wizard-steps-bar');
  bar.innerHTML = wizardSequencia.map((p, i) => {
    const idx    = wizardSequencia.indexOf(wizardPanelAtual);
    const isDone = i < idx;
    const isActive = p === wizardPanelAtual;
    return `<div class="wizard-step${isActive ? ' active' : isDone ? ' done' : ''}">
      <div class="step-num">${isDone ? '✓' : i + 1}</div>
      <span class="step-label">${WIZARD_PANEL_LABELS[p]}</span>
    </div>`;
  }).join('');
}

function mostrarPainel(panel) {
  WIZARD_PANELS_ORDER.forEach(p => {
    const el = document.getElementById('wpanel-' + p);
    if (el) el.className = 'wizard-panel' + (p === panel ? ' active' : '');
  });
  wizardPanelAtual = panel;
  renderWizardBar();
}

async function wizardAvançar() {
  const idx   = wizardSequencia.indexOf(wizardPanelAtual);
  const proximo = wizardSequencia[idx + 1];
  if (!proximo) return;

  // Validações por painel
  if (wizardPanelAtual === 'modelo' && !wizardModeloSelecionado) {
    toast('Selecione um modelo para continuar.', 'error'); return;
  }
  if (wizardPanelAtual === 'empresas') {
    if (!wizardEmpresasSelecionadas.length) {
      toast('Selecione pelo menos uma empresa.', 'error'); return;
    }
    // Carrega dados das tabelas ao avançar de empresas
    await carregarDadosDasEmpresas();
    if (proximo === 'empregados') renderEmpregadosWizard();
    if (proximo === 'socios')     renderSociosWizard();
    if (proximo === 'rubricas')   renderRubricasWizard();
  }
  if (wizardPanelAtual === 'empregados' && proximo === 'socios')   renderSociosWizard();
  if (wizardPanelAtual === 'empregados' && proximo === 'rubricas') renderRubricasWizard();
  if (wizardPanelAtual === 'socios'     && proximo === 'rubricas') renderRubricasWizard();

  if (proximo === 'empresas') renderEmpresasWizard();

  if (proximo === 'exportar') {
    construirRegistros();
    buildWizardResumo();
    renderPreview();
  }

  mostrarPainel(proximo);
}

function wizardVoltar() {
  const idx     = wizardSequencia.indexOf(wizardPanelAtual);
  const anterior = wizardSequencia[idx - 1];
  if (anterior) mostrarPainel(anterior);
}

// ── Modelo ────────────────────────────────────────────────────
function renderModelosWizard() {
  const filtro = (document.getElementById('filtro-modelos-wizard')?.value || '').toLowerCase();
  const lista  = modelos.filter(m => m.nome.toLowerCase().includes(filtro));
  const div    = document.getElementById('modelos-wizard-list');
  if (!lista.length) {
    div.innerHTML = '<div class="empty"><span class="empty-icon">📄</span><p>Nenhum modelo cadastrado. Crie um na seção Modelos.</p></div>';
    return;
  }
  div.innerHTML = lista.map(m => `
    <div class="gm-card" style="cursor:pointer;margin-bottom:12px;${wizardModeloSelecionado?.id === m.id ? 'border-color:var(--primary);background:rgba(139,58,58,0.03)' : ''}"
      onclick="selecionarModeloWizard('${m.id}')">
      <div class="gm-card-top">
        <div class="gm-card-icon">${wizardModeloSelecionado?.id === m.id ? '✅' : '📄'}</div>
        <div class="gm-card-info">
          <div class="gm-card-name">${esc(m.nome)}</div>
          <div class="gm-card-desc">${esc(m.descricao || '')}
            <span class="badge badge-${m.tipo}" style="font-size:10px;margin-left:4px">${m.tipo === 'por_registro' ? 'Por Registro' : 'Consolidado'}</span>
            ${(m.fontes||[]).map(f=>`<span class="fonte-tag" style="margin-left:4px">${f}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function selecionarModeloWizard(id) {
  wizardModeloSelecionado = modelos.find(m => m.id === id);
  if (!wizardModeloSelecionado) return;
  wizardSequencia = calcularSequencia();
  wizardCabecalho = wizardModeloSelecionado.cabecalho_padrao || 'completo';
  renderModelosWizard();
  renderWizardBar();
  toast(`Modelo "${wizardModeloSelecionado.nome}" selecionado.`, 'success');
}

// ── Empresas ──────────────────────────────────────────────────
function renderEmpresasWizard() {
  const filtro = (document.getElementById('filtro-empresas')?.value || '').toLowerCase();
  const lista  = empresas.filter(e => e.nome_empresa.toLowerCase().includes(filtro) || e.codigo_empresa.toLowerCase().includes(filtro));
  const div    = document.getElementById('empresas-wizard-list');
  if (!lista.length) {
    div.innerHTML = '<div class="empresa-item"><span style="color:var(--muted);font-size:13px">Nenhuma empresa encontrada</span></div>';
    return;
  }
  div.innerHTML = lista.map(e => `
    <label class="empresa-item">
      <input type="checkbox" value="${esc(e.codigo_empresa)}"
        style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0"
        ${wizardEmpresasSelecionadas.includes(e.codigo_empresa) ? 'checked' : ''}
        onchange="toggleEmpresaWizard('${esc(e.codigo_empresa)}', this.checked)">
      <div class="empresa-info">
        <strong>${esc(e.nome_empresa)}</strong>
        <span>${esc(e.codigo_empresa)}${e.cnpj ? ' · ' + esc(e.cnpj) : ''}</span>
      </div>
    </label>
  `).join('');
  atualizarContador('empresas-selected-count', wizardEmpresasSelecionadas.length, 'empresa');
}

function toggleEmpresaWizard(codigo, checked) {
  if (checked) { if (!wizardEmpresasSelecionadas.includes(codigo)) wizardEmpresasSelecionadas.push(codigo); }
  else wizardEmpresasSelecionadas = wizardEmpresasSelecionadas.filter(c => c !== codigo);
  atualizarContador('empresas-selected-count', wizardEmpresasSelecionadas.length, 'empresa');
}

// ── Carrega dados ao confirmar empresas ───────────────────────
async function carregarDadosDasEmpresas() {
  const codigos = wizardEmpresasSelecionadas;
  const [r1, r2, r3] = await Promise.all([
    sb.from('rh_empregados').select('*').in('codigo_empresa', codigos).order('nome_empregado'),
    sb.from('rh_socios').select('*').in('codigo_empresa', codigos).order('nome_socio'),
    sb.from('rh_rubricas').select('*').in('codigo_empresa', codigos).order('evento'),
  ]);
  _dbEmpregados = r1.data || [];
  _dbSocios     = r2.data || [];
  _dbRubricas   = r3.data || [];
  // Pré-seleciona todos por padrão
  wizardEmpregadosSelecionados = _dbEmpregados.map(e => e.id);
  wizardSociosSelecionados     = _dbSocios.map(s => s.id);
  wizardRubricasSelecionados   = _dbRubricas.map(r => r.id);
}

// ── Empregados ────────────────────────────────────────────────
function renderEmpregadosWizard() {
  const filtro = (document.getElementById('filtro-empregados-wizard')?.value || '').toLowerCase();
  const lista  = _dbEmpregados.filter(e =>
    e.nome_empregado?.toLowerCase().includes(filtro) ||
    e.codigo_empregado?.toLowerCase().includes(filtro));
  const div = document.getElementById('empregados-wizard-list');
  if (!lista.length) {
    div.innerHTML = '<div class="empresa-item"><span style="color:var(--muted);font-size:13px">Nenhum empregado encontrado</span></div>';
    atualizarContador('empregados-selected-count', 0, 'empregado'); return;
  }
  div.innerHTML = lista.map(e => `
    <label class="empresa-item">
      <input type="checkbox" value="${e.id}"
        style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0"
        ${wizardEmpregadosSelecionados.includes(e.id) ? 'checked' : ''}
        onchange="toggleItem(wizardEmpregadosSelecionados,'${e.id}',this.checked,'empregados-selected-count','empregado')">
      <div class="empresa-info">
        <strong>${esc(e.nome_empregado)}</strong>
        <span>${esc(e.codigo_empresa)} · ${esc(e.codigo_empregado)}${e.desc_cargo ? ' · ' + esc(e.desc_cargo) : ''}</span>
      </div>
    </label>
  `).join('');
  atualizarContador('empregados-selected-count', wizardEmpregadosSelecionados.length, 'empregado');
}

function selecionarTodosEmpregados(sel) {
  wizardEmpregadosSelecionados = sel ? _dbEmpregados.map(e => e.id) : [];
  renderEmpregadosWizard();
}

// ── Sócios ────────────────────────────────────────────────────
function renderSociosWizard() {
  const filtro = (document.getElementById('filtro-socios-wizard')?.value || '').toLowerCase();
  const lista  = _dbSocios.filter(s => s.nome_socio?.toLowerCase().includes(filtro));
  const div    = document.getElementById('socios-wizard-list');
  if (!lista.length) {
    div.innerHTML = '<div class="empresa-item"><span style="color:var(--muted);font-size:13px">Nenhum sócio encontrado</span></div>';
    atualizarContador('socios-selected-count', 0, 'sócio'); return;
  }
  div.innerHTML = lista.map(s => `
    <label class="empresa-item">
      <input type="checkbox" value="${s.id}"
        style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0"
        ${wizardSociosSelecionados.includes(s.id) ? 'checked' : ''}
        onchange="toggleItem(wizardSociosSelecionados,'${s.id}',this.checked,'socios-selected-count','sócio')">
      <div class="empresa-info">
        <strong>${esc(s.nome_socio)}</strong>
        <span>${esc(s.codigo_empresa)}${s.cargo ? ' · ' + esc(s.cargo) : ''}${s.participacao != null ? ' · ' + s.participacao + '%' : ''}</span>
      </div>
    </label>
  `).join('');
  atualizarContador('socios-selected-count', wizardSociosSelecionados.length, 'sócio');
}

function selecionarTodosSocios(sel) {
  wizardSociosSelecionados = sel ? _dbSocios.map(s => s.id) : [];
  renderSociosWizard();
}

// ── Rubricas ──────────────────────────────────────────────────
function renderRubricasWizard() {
  const filtro = (document.getElementById('filtro-rubricas-wizard')?.value || '').toLowerCase();
  const lista  = _dbRubricas.filter(r =>
    r.evento?.toLowerCase().includes(filtro) ||
    r.codigo_rubrica?.toLowerCase().includes(filtro));
  const div = document.getElementById('rubricas-wizard-list');
  if (!lista.length) {
    div.innerHTML = '<div class="empresa-item"><span style="color:var(--muted);font-size:13px">Nenhuma rubrica encontrada</span></div>';
    atualizarContador('rubricas-selected-count', 0, 'rubrica'); return;
  }
  div.innerHTML = lista.map(r => `
    <label class="empresa-item">
      <input type="checkbox" value="${r.id}"
        style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0"
        ${wizardRubricasSelecionados.includes(r.id) ? 'checked' : ''}
        onchange="toggleItem(wizardRubricasSelecionados,'${r.id}',this.checked,'rubricas-selected-count','rubrica')">
      <div class="empresa-info">
        <strong>${esc(r.evento)}</strong>
        <span>${esc(r.codigo_empresa)} · Cód. ${esc(r.codigo_rubrica)}</span>
      </div>
    </label>
  `).join('');
  atualizarContador('rubricas-selected-count', wizardRubricasSelecionados.length, 'rubrica');
}

function selecionarTodasRubricas(sel) {
  wizardRubricasSelecionados = sel ? _dbRubricas.map(r => r.id) : [];
  renderRubricasWizard();
}

// ── Toggle genérico ───────────────────────────────────────────
function toggleItem(arr, id, checked, counterId, label) {
  if (checked) { if (!arr.includes(id)) arr.push(id); }
  else { const i = arr.indexOf(id); if (i > -1) arr.splice(i, 1); }
  atualizarContador(counterId, arr.length, label);
}

function atualizarContador(id, n, label) {
  const el = document.getElementById(id);
  if (el) el.textContent = n === 0 ? `Nenhum ${label} selecionado` : `${n} ${label}(s) selecionado(s)`;
}

// ── Construir registros para geração ─────────────────────────
function construirRegistros() {
  const modelo   = wizardModeloSelecionado;
  const fontes   = modelo?.fontes || [];
  const empsSel  = _dbEmpregados.filter(e => wizardEmpregadosSelecionados.includes(e.id));
  const socsSel  = _dbSocios.filter(s => wizardSociosSelecionados.includes(s.id));
  const rubsSel  = _dbRubricas.filter(r => wizardRubricasSelecionados.includes(r.id));

  const empresaMap = {};
  empresas.forEach(e => { empresaMap[e.codigo_empresa] = e; });

  if (modelo.tipo === 'por_registro') {
    // Base: empregados (se selecionados), caso contrário uma linha por empresa
    const base = fontes.includes('empregados') && empsSel.length ? empsSel : null;
    if (base) {
      wizardRegistros = base.map(emp => {
        const empresa = empresaMap[emp.codigo_empresa] || {};
        const socio   = socsSel.find(s => s.codigo_empresa === emp.codigo_empresa) || {};
        const rubrica = rubsSel.find(r => r.codigo_empresa === emp.codigo_empresa) || {};
        return buildVarMap(empresa, emp, socio, rubrica, excelData[0] || {});
      });
    } else {
      wizardRegistros = wizardEmpresasSelecionadas.map(cod => {
        const empresa = empresaMap[cod] || {};
        const socio   = socsSel.find(s => s.codigo_empresa === cod) || {};
        const rubrica = rubsSel.find(r => r.codigo_empresa === cod) || {};
        return buildVarMap(empresa, {}, socio, rubrica, excelData[0] || {});
      });
    }
  } else {
    // Consolidado: um registro por empresa selecionada
    wizardRegistros = wizardEmpresasSelecionadas.map(cod => {
      const empresa = empresaMap[cod] || {};
      const emp     = empsSel.find(e => e.codigo_empresa === cod) || {};
      const socio   = socsSel.find(s => s.codigo_empresa === cod) || {};
      const rubrica = rubsSel.find(r => r.codigo_empresa === cod) || {};
      return buildVarMap(empresa, emp, socio, rubrica, excelData[0] || {});
    });
  }
  wizardPreviewIndex = 0;
}

function buildVarMap(empresa, empregado, socio, rubrica, excelRow) {
  const map = {};
  for (const [campo] of VARS_DEF.empresas.campos)   map[`empresa.${campo}`]   = empresa[campo]   ?? '';
  for (const [campo] of VARS_DEF.empregados.campos)  map[`empregado.${campo}`] = empregado[campo] ?? '';
  for (const [campo] of VARS_DEF.socios.campos)      map[`socio.${campo}`]     = socio[campo]     ?? '';
  for (const [campo] of VARS_DEF.rubricas.campos)    map[`rubrica.${campo}`]   = rubrica[campo]   ?? '';
  for (const h of excelHeaders)                       map[`excel.${h}`]         = excelRow[h]      ?? '';
  return map;
}

function substituirVars(template, varMap, highlight = false) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const val = varMap[key.trim()];
    if (val === undefined || val === null || val === '') {
      return highlight ? `<span class="var-missing">${esc(match)}</span>` : match;
    }
    return esc(String(val));
  });
}

// ── Preview ───────────────────────────────────────────────────
function renderPreview() {
  const area    = document.getElementById('preview-area');
  const counter = document.getElementById('preview-counter');
  if (!wizardModeloSelecionado || !wizardRegistros.length) {
    area.innerHTML = '<span style="color:var(--muted)">Nenhum registro para pré-visualizar.</span>';
    counter.textContent = '0 / 0'; return;
  }
  const total = wizardRegistros.length;
  wizardPreviewIndex = Math.max(0, Math.min(wizardPreviewIndex, total - 1));
  const varMap = wizardRegistros[wizardPreviewIndex];
  // template é HTML — substitui vars diretamente no HTML
  area.innerHTML = substituirVars(wizardModeloSelecionado.template, varMap, true);
  counter.textContent = `${wizardPreviewIndex + 1} / ${total}`;
}

function previewPrev() { wizardPreviewIndex = Math.max(0, wizardPreviewIndex - 1); renderPreview(); }
function previewNext() { wizardPreviewIndex = Math.min(wizardRegistros.length - 1, wizardPreviewIndex + 1); renderPreview(); }

// ── Exportar — cabeçalho ──────────────────────────────────────
function selectCabecalho(val) {
  wizardCabecalho = val;
  document.getElementById('cab-opt-completo').classList.toggle('selected', val === 'completo');
  document.getElementById('cab-opt-neutro').classList.toggle('selected', val === 'neutro');
}

function buildWizardResumo() {
  const m = wizardModeloSelecionado;
  if (!m) return;
  document.getElementById('res-modelo').textContent = m.nome;
  document.getElementById('res-tipo').textContent = m.tipo === 'por_registro' ? 'Por Registro' : 'Consolidado';
  const nomes = wizardEmpresasSelecionadas.map(c => empresas.find(x => x.codigo_empresa === c)?.nome_empresa || c);
  document.getElementById('res-empresas').textContent = nomes.join(', ') || '—';
  document.getElementById('res-registros').textContent = wizardRegistros.length;
  const primeiraEmpresa = empresas.find(e => e.codigo_empresa === wizardEmpresasSelecionadas[0]);
  document.getElementById('cab-neutro-empresa-name').textContent = primeiraEmpresa?.nome_empresa || 'Nome da Empresa';
  document.getElementById('cab-neutro-titulo').textContent = m.nome;
  // Aplica cabeçalho padrão do modelo
  selectCabecalho(wizardCabecalho);
  document.querySelector(`input[name=cabecalho][value="${wizardCabecalho}"]`)?.click();
}

// ── Exportar PDF ──────────────────────────────────────────────
async function exportarPDF() {
  if (!wizardModeloSelecionado || !wizardRegistros.length) {
    toast('Nenhum dado para exportar.', 'error'); return;
  }
  const modelo    = wizardModeloSelecionado;
  const printRoot = document.getElementById('print-root');

  const paginasHtml = wizardRegistros.map((varMap, idx) => {
    const corpo       = substituirVars(modelo.template, varMap, false);
    const isUltimo    = idx === wizardRegistros.length - 1;
    const pageClass   = modelo.tipo === 'por_registro' && !isUltimo ? 'print-page-break' : '';
    const cabecalho   = buildCabecalhoHtml(wizardCabecalho, varMap, modelo.nome);
    return `<div class="${pageClass}">${cabecalho}<div class="print-body">${corpo}</div></div>`;
  });

  printRoot.innerHTML = paginasHtml.join('');
  printRoot.style.display = 'block';
  await registrarGeracao();
  window.print();
  setTimeout(() => { printRoot.style.display = 'none'; }, 1000);
}

function buildCabecalhoHtml(tipo, varMap, tituloModelo) {
  const nomeEmpresa = varMap['empresa.nome_empresa'] || 'Empresa';
  if (tipo === 'completo') return `<div class="print-header-completo">
    <span class="ph-logo-text">SCONT</span><div class="ph-sep"></div>
    <div class="ph-texts"><strong class="ph-title">${esc(tituloModelo)}</strong>
    <span class="ph-sub">SCONT Soluções Contábeis — Gestão de RH</span></div></div>`;
  if (tipo === 'neutro') return `<div class="print-header-neutro">
    <div class="ph-texts"><strong class="ph-title">${esc(nomeEmpresa)}</strong>
    <span class="ph-sub">${esc(tituloModelo)}</span></div></div>`;
  return '';
}

// ── Exportar Excel ────────────────────────────────────────────
async function exportarExcel() {
  if (!wizardModeloSelecionado || !wizardRegistros.length) {
    toast('Nenhum dado para exportar.', 'error'); return;
  }
  const modelo = wizardModeloSelecionado;
  const chaves = wizardRegistros[0] ? Object.keys(wizardRegistros[0]) : [];
  const rows = wizardRegistros.map(varMap => {
    const row = {};
    for (const k of chaves) row[k] = varMap[k] ?? '';
    row['documento_gerado'] = substituirVars(modelo.template, varMap, false);
    return row;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...chaves, 'documento_gerado'] });
  XLSX.utils.book_append_sheet(wb, ws, modelo.nome.slice(0, 31));
  XLSX.writeFile(wb, `${modelo.nome}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
  await registrarGeracao();
  toast('Excel exportado!', 'success');
}

async function registrarGeracao() {
  if (!wizardModeloSelecionado) return;
  await sb.from('gm_geracoes').insert({
    modelo_id:       wizardModeloSelecionado.id,
    modelo_nome:     wizardModeloSelecionado.nome,
    empresas_ids:    wizardEmpresasSelecionadas,
    total_registros: wizardRegistros.length,
    cabecalho_usado: wizardCabecalho,
    criado_por:      currentUser?.id,
  });
}

function resetWizard() {
  excelData = []; excelHeaders = [];
  iniciarWizard();
}

// ── Excel Upload ──────────────────────────────────────────────
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb   = XLSX.read(e.target.result, { type: 'binary' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!json.length) { toast('Planilha vazia.', 'error'); return; }
    excelHeaders = Object.keys(json[0]);
    excelData    = json;
    renderVarsPanel();
    toast('Planilha carregada: ' + excelHeaders.length + ' colunas.', 'success');
  };
  reader.readAsBinaryString(file);
}

function removeExcel() {
  excelData = []; excelHeaders = [];
  renderVarsPanel();
}

// ── Histórico ─────────────────────────────────────────────────
async function carregarHistorico() {
  const { data, error } = await sb.from('gm_geracoes')
    .select('*, usuarios(nome, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('historico-tbody');
  if (error || !data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma geração registrada</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(g => `
    <tr>
      <td><strong>${esc(g.modelo_nome)}</strong></td>
      <td style="font-size:12px">${(g.empresas_ids || []).join(', ')}</td>
      <td>${g.total_registros}</td>
      <td>${labelCabecalho(g.cabecalho_usado)}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(g.usuarios?.nome || g.usuarios?.email || '—')}</td>
      <td style="font-size:12px;color:var(--muted)">${fmtData(g.created_at)}</td>
    </tr>
  `).join('');
}

// ── Helpers ────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function labelCabecalho(val) {
  return { completo: 'Completo', neutro: 'Neutro', nenhum: 'Sem cabeçalho' }[val] || val;
}


// ── Funções do editor rico ────────────────────────────────────
function aplicarTamanhoFonte(size) {
  if (!size) return;
  const editor = document.getElementById('modelo-template');
  editor.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const fragment = range.extractContents();
  const span = document.createElement('span');
  span.style.fontSize = size;
  span.appendChild(fragment);
  range.insertNode(span);
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
}

function aplicarFonte(family) {
  if (!family) return;
  document.getElementById('modelo-template').focus();
  document.execCommand('fontName', false, family);
}
