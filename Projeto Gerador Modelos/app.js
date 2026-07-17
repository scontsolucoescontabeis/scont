/* ── Gerador de Modelos — app.js ─────────────────────────── */

let sb = null;

// ── Estado global ────────────────────────────────────────────
let currentUser = null;
let modelos = [];
let eventos = [];               // [{ id, nome, descricao, modelosOrdenados: [modelo,...] }]
let eventoModalSelecao = [];    // ids dos modelos escolhidos no modal de evento, em ordem
let empresas = [];
let empregados = [];
let socios = [];
let rubricas = [];
let excelData = [];
let excelHeaders = [];

// Wizard
let wizardStep = 1;
let savedEditorRange = null;
let wizardEmpresasSelecionadas = [];
let wizardModeloSelecionado = null;
let wizardRegistros = [];
let wizardPreviewIndex = 0;
let wizardCabecalho = 'completo';
let wizardCaberUmaPagina = false;
let wizardNomeEmpresaExcel = '';
let wizardColunaEmpresaExcel = '';       // header escolhido para agrupar por empresa, ou '' = "mesma empresa para todas"
let wizardColunaCodigoEmpresaExcel = ''; // header de código, auto-detectado, sem controle de UI
let wizardEventoAtivo = null;   // evento em uso na geração atual (null = modelo único)

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
      ['uf','UF'],
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
      ['descricao_rubrica','Descrição Rubrica'],
      ['codigo_rubrica','Código Rubrica'],
    ]
  },
  excel: {
    label: '📊 Planilha',
    prefix: 'excel',
    campos: [] // preenchido dinamicamente
  },
  sistema: {
    label: '📅 Sistema',
    prefix: 'sistema',
    campos: [
      ['data_atual','Data Atual'],
      ['data_atual_extenso','Data Atual (por extenso)'],
    ]
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

  await Promise.all([carregarModelos(), carregarEventos(), carregarEmpresas(), carregarDashboard()]);
});

// ── Navegação ────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.getElementById('nav-' + name)?.classList.add('active');

  if (name === 'modelos') renderModelos();
  if (name === 'eventos') renderEventos();
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

// ── Eventos CRUD ──────────────────────────────────────────────
async function carregarEventos() {
  // Busca os modelos de cada evento já embutidos na mesma consulta (via a FK
  // gm_eventos_modelos.modelo_id → gm_modelos.id), em vez de depender do array
  // global `modelos` — que é carregado por carregarModelos() em paralelo a esta
  // função na inicialização da página, sem ordem garantida entre as duas.
  const [{ data: evData, error: evErr }, { data: emData, error: emErr }] = await Promise.all([
    sb.from('gm_eventos').select('*').order('created_at', { ascending: false }),
    sb.from('gm_eventos_modelos').select('evento_id, ordem, gm_modelos(*)').order('ordem', { ascending: true }),
  ]);
  if (evErr) { console.error(evErr); return; }
  if (emErr) { console.error(emErr); return; }

  eventos = (evData || []).map(ev => {
    const itens = (emData || []).filter(it => it.evento_id === ev.id);
    const modelosOrdenados = itens.map(it => it.gm_modelos).filter(Boolean);
    return { ...ev, modelosOrdenados };
  });
}

function renderEventos() {
  const filtro = (document.getElementById('filtro-eventos')?.value || '').toLowerCase();
  const lista = eventos.filter(e => e.nome.toLowerCase().includes(filtro));
  const grid = document.getElementById('eventos-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty"><span class="empty-icon">🗂️</span><p>Nenhum evento encontrado</p></div>';
    return;
  }
  grid.innerHTML = lista.map(ev => `
    <div class="gm-card">
      <div class="gm-card-top">
        <div class="gm-card-icon">🗂️</div>
        <div class="gm-card-info">
          <div class="gm-card-name">${esc(ev.nome)}</div>
          <div class="gm-card-desc">${esc(ev.descricao || 'Sem descrição')}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="fonte-tag">${ev.modelosOrdenados.length} documento(s)</span>
      </div>
      <div class="gm-card-footer">
        <button class="btn btn-primary btn-sm" onclick="usarEvento('${ev.id}')" ${ev.modelosOrdenados.length ? '' : 'disabled'}>⚡ Gerar</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalEvento('${ev.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletarEvento('${ev.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

function openModalEvento(id) {
  const ev = id ? eventos.find(e => e.id === id) : null;
  document.getElementById('modal-evento-title').textContent = ev ? 'Editar Evento' : 'Novo Evento';
  document.getElementById('evento-id').value = ev?.id || '';
  document.getElementById('evento-nome').value = ev?.nome || '';
  document.getElementById('evento-descricao').value = ev?.descricao || '';
  eventoModalSelecao = ev ? ev.modelosOrdenados.map(m => m.id) : [];
  document.getElementById('filtro-evento-modelos-disp').value = '';
  renderEventoModelosDisponiveis();
  renderEventoModelosSelecionados();
  document.getElementById('modal-evento').classList.add('open');
}

function closeModalEvento() {
  document.getElementById('modal-evento').classList.remove('open');
}

function renderEventoModelosDisponiveis() {
  const filtro = (document.getElementById('filtro-evento-modelos-disp')?.value || '').toLowerCase();
  const div = document.getElementById('evento-modelos-disponiveis');
  const lista = modelos.filter(m => !eventoModalSelecao.includes(m.id) && m.nome.toLowerCase().includes(filtro));
  if (!lista.length) {
    div.innerHTML = '<div class="empty" style="padding:16px"><span style="font-size:12px;color:var(--muted)">Nenhum modelo disponível</span></div>';
    return;
  }
  div.innerHTML = lista.map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border);font-size:13px;">
      <span>${esc(m.nome)}</span>
      <button class="btn btn-secondary btn-sm" onclick="adicionarModeloEvento('${m.id}')">+ Adicionar</button>
    </div>
  `).join('');
}

function renderEventoModelosSelecionados() {
  const div = document.getElementById('evento-modelos-selecionados');
  if (!eventoModalSelecao.length) {
    div.innerHTML = '<div class="empty" style="padding:20px"><span style="font-size:12px;color:var(--muted)">Nenhum modelo adicionado ainda</span></div>';
    return;
  }
  const modelosPorId = {};
  modelos.forEach(m => { modelosPorId[m.id] = m; });
  div.innerHTML = eventoModalSelecao.map((id, i) => {
    const m = modelosPorId[id];
    if (!m) return '';
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border);font-size:13px;">
      <span><strong style="color:var(--muted);margin-right:6px;">${i + 1}.</strong>${esc(m.nome)}</span>
      <span style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-secondary btn-sm" onclick="moverModeloEvento('${id}',-1)" title="Mover para cima" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-secondary btn-sm" onclick="moverModeloEvento('${id}',1)" title="Mover para baixo" ${i === eventoModalSelecao.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-danger btn-sm" onclick="removerModeloEvento('${id}')" title="Remover">✕</button>
      </span>
    </div>`;
  }).join('');
}

function adicionarModeloEvento(modeloId) {
  if (eventoModalSelecao.includes(modeloId)) return;
  eventoModalSelecao.push(modeloId);
  renderEventoModelosDisponiveis();
  renderEventoModelosSelecionados();
}

function removerModeloEvento(modeloId) {
  eventoModalSelecao = eventoModalSelecao.filter(id => id !== modeloId);
  renderEventoModelosDisponiveis();
  renderEventoModelosSelecionados();
}

function moverModeloEvento(modeloId, direcao) {
  const i = eventoModalSelecao.indexOf(modeloId);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= eventoModalSelecao.length) return;
  [eventoModalSelecao[i], eventoModalSelecao[j]] = [eventoModalSelecao[j], eventoModalSelecao[i]];
  renderEventoModelosSelecionados();
}

async function salvarEvento() {
  const id        = document.getElementById('evento-id').value || null;
  const nome      = document.getElementById('evento-nome').value.trim();
  const descricao = document.getElementById('evento-descricao').value.trim();

  if (!nome) { toast('Informe o nome do evento.', 'error'); return; }
  if (!eventoModalSelecao.length) { toast('Adicione pelo menos um modelo ao evento.', 'error'); return; }

  try {
    let eventoId = id;
    if (eventoId) {
      const { error } = await sb.from('gm_eventos').update({ nome, descricao }).eq('id', eventoId);
      if (error) throw error;
      const { error: delErr } = await sb.from('gm_eventos_modelos').delete().eq('evento_id', eventoId);
      if (delErr) throw delErr;
    } else {
      const { data, error } = await sb.from('gm_eventos')
        .insert({ nome, descricao, criado_por: currentUser?.id }).select('id').single();
      if (error) throw error;
      eventoId = data.id;
    }

    const itens = eventoModalSelecao.map((modelo_id, ordem) => ({ evento_id: eventoId, modelo_id, ordem }));
    const { error: insErr } = await sb.from('gm_eventos_modelos').insert(itens);
    if (insErr) throw insErr;

    toast('Evento salvo com sucesso!', 'success');
    closeModalEvento();
    await carregarEventos();
    renderEventos();
  } catch (err) {
    console.error(err);
    toast('Erro ao salvar evento: ' + err.message, 'error');
  }
}

async function deletarEvento(id) {
  if (!confirm('Excluir este evento? Os modelos individuais não são afetados.')) return;
  const { error } = await sb.from('gm_eventos').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return; }
  await carregarEventos();
  renderEventos();
}

function openModalModelo(id) {
  const el = document.getElementById('modal-modelo');
  el.classList.add('open');

  // Reset excel ao abrir modal
  excelData = []; excelHeaders = [];
  const mef = document.getElementById('modal-excel-file');
  if (mef) mef.value = '';
  const mep = document.getElementById('modal-excel-preview');
  if (mep) mep.innerHTML = '';

  // Reset
  document.getElementById('modelo-id').value = '';
  document.getElementById('modelo-nome').value = '';
  document.getElementById('modelo-descricao').value = '';
  document.getElementById('modelo-tipo').value = 'por_registro';
  document.getElementById('modelo-cabecalho').value = 'completo';
  document.getElementById('modelo-template').innerHTML = '';
  // Sempre reabre no modo visual, mesmo que tenha ficado no modo HTML da vez anterior.
  modoHtmlAtivo = false;
  document.getElementById('modelo-template').style.display = '';
  document.getElementById('modelo-template-html').style.display = 'none';
  document.getElementById('modelo-template-html').value = '';
  document.getElementById('tb-visual-only').style.display = 'contents';
  document.getElementById('tb-btn-html').textContent = '</> Ver HTML';
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

  // Salva posição do cursor sempre que o editor perde foco
  const editor = document.getElementById('modelo-template');
  editor._blurHandler && editor.removeEventListener('blur', editor._blurHandler, true);
  editor._blurHandler = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (editor.contains(r.commonAncestorContainer)) {
        savedEditorRange = r.cloneRange();
      }
    }
  };
  editor.addEventListener('blur', editor._blurHandler, true);

  renderVarsPanel();
  document.querySelectorAll('.fonte-cb').forEach(cb => cb.addEventListener('change', renderVarsPanel));

  const cabSelect = document.getElementById('modelo-cabecalho');
  const nomeInput = document.getElementById('modelo-nome');
  cabSelect._hdrHandler && cabSelect.removeEventListener('change', cabSelect._hdrHandler);
  nomeInput._hdrHandler && nomeInput.removeEventListener('input', nomeInput._hdrHandler);
  cabSelect._hdrHandler = updateEditorHeaderPreview;
  nomeInput._hdrHandler = updateEditorHeaderPreview;
  cabSelect.addEventListener('change', updateEditorHeaderPreview);
  nomeInput.addEventListener('input', updateEditorHeaderPreview);
  updateEditorHeaderPreview();
}

function closeModalModelo() {
  document.getElementById('modal-modelo').classList.remove('open');
  excelData = []; excelHeaders = [];
  const mef = document.getElementById('modal-excel-file');
  if (mef) mef.value = '';
  const mep = document.getElementById('modal-excel-preview');
  if (mep) mep.innerHTML = '';
}

function renderVarsPanel() {
  const fontesAtivas = [...document.querySelectorAll('.fonte-cb:checked')].map(c => c.value);
  const hasExcel = excelHeaders.length > 0;
  const panel = document.getElementById('vars-panel-content');

  let html = '';
  for (const fonte of [...fontesAtivas, ...(hasExcel ? ['excel'] : []), 'sistema']) {
    const def = VARS_DEF[fonte];
    if (!def) continue;
    const campos = fonte === 'excel'
      ? excelHeaders.map(h => [h, h])
      : def.campos;
    if (!campos.length) continue;
    html += `<div class="vars-group">
      <div class="vars-group-label">${def.label}</div>
      <div>
        ${campos.map(([campo]) => {
          const safe = campo.replace(/'/g, '&#39;');
          const main = `<span class="var-chip" onmousedown="event.preventDefault()" onclick="insertVar('{{${def.prefix}.${safe}}}')">{{${def.prefix}.${campo}}}</span>`;
          const ext  = fonte === 'excel' ? `<span class="var-chip-ext" onmousedown="event.preventDefault()" onclick="insertVar('{{extenso:${def.prefix}.${safe}}}')">ext</span>` : '';
          return main + ext;
        }).join('')}
      </div>
    </div>`;
  }
  panel.innerHTML = html || '<p style="font-size:12px;color:var(--muted)">Selecione pelo menos uma fonte acima.</p>';
}

function insertVar(varStr) {
  const editor = document.getElementById('modelo-template');
  editor.focus();
  const sel = window.getSelection();

  // Tenta usar a seleção ativa; se não estiver no editor, usa o range salvo
  let range = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (editor.contains(r.commonAncestorContainer)) range = r;
  }
  if (!range && savedEditorRange) {
    range = savedEditorRange;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  if (range) {
    range.deleteContents();
    const node = document.createTextNode(varStr);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedEditorRange = range.cloneRange();
    return;
  }
  // fallback: insere no final
  const node = document.createTextNode(varStr);
  editor.appendChild(node);
}

// Alterna entre o editor visual (contenteditable) e a edição do HTML bruto —
// mesma string `template` por baixo, só duas formas de editá-la.
let modoHtmlAtivo = false;

function toggleModoHtml() {
  const editor     = document.getElementById('modelo-template');
  const textarea   = document.getElementById('modelo-template-html');
  const btn        = document.getElementById('tb-btn-html');
  const visualOnly = document.getElementById('tb-visual-only');

  if (!modoHtmlAtivo) {
    textarea.value = editor.innerHTML;
    editor.style.display = 'none';
    textarea.style.display = 'block';
    visualOnly.style.display = 'none';
    btn.textContent = '✎ Ver Visual';
    modoHtmlAtivo = true;
  } else {
    editor.innerHTML = textarea.value;
    textarea.style.display = 'none';
    editor.style.display = '';
    visualOnly.style.display = 'contents';
    btn.textContent = '</> Ver HTML';
    modoHtmlAtivo = false;
  }
}

async function salvarModelo() {
  // Se estiver no modo HTML, sincroniza o textarea de volta pro editor visual antes de ler.
  if (modoHtmlAtivo) {
    document.getElementById('modelo-template').innerHTML = document.getElementById('modelo-template-html').value;
  }
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

// Um Evento gera vários modelos de uma vez para o(s) mesmo(s) registro(s).
// Reaproveita toda a máquina do wizard (preview/exportar/registrarGeração)
// tratando o evento como um "modelo sintético" cujo template é a concatenação,
// na ordem configurada, dos templates dos modelos do evento — com quebra de
// página entre cada um. Só registrarGeracao() precisa saber diferenciar,
// para gravar uma linha de histórico por modelo real (não pelo sintético).
function usarEvento(id) {
  const evento = eventos.find(e => e.id === id);
  if (!evento || !evento.modelosOrdenados.length) {
    toast('Este evento não tem modelos configurados.', 'error');
    return;
  }
  showSection('gerar');
  setTimeout(() => _iniciarWizardComEvento(evento), 100);
}

function _iniciarWizardComEvento(evento) {
  const fontesUniao = new Set(['empregados']); // eventos sempre geram por empregado
  evento.modelosOrdenados.forEach(m => (m.fontes || []).forEach(f => fontesUniao.add(f)));

  // O cabeçalho de cada modelo é montado dinamicamente por-registro em
  // renderPreview()/exportarPDF() (precisa da empresa do registro, que só é
  // conhecida em tempo de geração) — aqui o `template` do sintético serve só
  // para calcularSequencia() detectar uso de variáveis de planilha ({{excel.*}}).
  wizardModeloSelecionado = {
    id: null,
    nome: evento.nome,
    tipo: 'por_registro',
    fontes: [...fontesUniao],
    template: evento.modelosOrdenados.map(m => m.template || '').join(''),
  };
  wizardEventoAtivo = evento;
  wizardCabecalho = 'completo';
  wizardCaberUmaPagina = false;
  wizardSequencia = calcularSequencia().filter(p => p !== 'modelo');
  renderWizardBar();
  mostrarPainel(wizardSequencia[0]);
  toast(`Evento "${evento.nome}" selecionado (${evento.modelosOrdenados.length} documento(s)).`, 'success');
}

// ── Empresas ──────────────────────────────────────────────────
async function carregarEmpresas() {
  const { data } = await sb.from('rh_empresas').select('*').order('nome_empresa');
  empresas = data || [];
}

// ── Wizard — sequência dinâmica ───────────────────────────────
// Ordem fixa de painéis possíveis; a sequência ativa depende das fontes do modelo
const WIZARD_PANELS_ORDER = ['modelo', 'empresas', 'empregados', 'socios', 'rubricas', 'planilha', 'exportar'];
const WIZARD_PANEL_LABELS = {
  modelo:     'Modelo',
  empresas:   'Empresas',
  empregados: 'Empregados',
  socios:     'Sócios',
  rubricas:   'Rubricas',
  planilha:   'Planilha',
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
  const fontes   = wizardModeloSelecionado?.fontes || [];
  const template = wizardModeloSelecionado?.template || '';

  // Usa Excel se estiver nas fontes OU se o template contiver variáveis {{excel.*}}
  const usaExcel = fontes.includes('excel') || template.includes('{{excel.');

  // Modo Excel puro: sem nenhuma fonte de banco de dados
  const temFonteDB = fontes.some(f => ['empresas','empregados','socios','rubricas'].includes(f));
  const soExcel    = usaExcel && !temFonteDB;

  const seq = ['modelo'];
  if (!soExcel) {
    seq.push('empresas');
    if (fontes.includes('empregados')) seq.push('empregados');
    if (fontes.includes('socios'))     seq.push('socios');
    if (fontes.includes('rubricas'))   seq.push('rubricas');
  }
  if (usaExcel) seq.push('planilha');
  seq.push('exportar');
  return seq;
}

async function iniciarWizard() {
  wizardSequencia            = ['modelo', 'empresas', 'exportar'];
  wizardPanelAtual           = 'modelo';
  wizardModeloSelecionado    = null;
  wizardEventoAtivo          = null;
  wizardEmpresasSelecionadas  = [];
  wizardEmpregadosSelecionados = [];
  wizardSociosSelecionados    = [];
  wizardRubricasSelecionados  = [];
  wizardRegistros            = [];
  wizardPreviewIndex         = 0;
  wizardCabecalho            = 'completo';
  wizardCaberUmaPagina       = false;
  wizardNomeEmpresaExcel     = '';
  wizardColunaEmpresaExcel       = '';
  wizardColunaCodigoEmpresaExcel = '';
  _dbEmpregados = []; _dbSocios = []; _dbRubricas = [];
  excelData = []; excelHeaders = [];
  _limparUIPlanilha();

  renderWizardBar();
  mostrarPainel('modelo');
  await carregarEmpresas();
  renderModelosWizard();
}

function _limparUIPlanilha() {
  const fi = document.getElementById('planilha-excel-file');
  if (fi) fi.value = '';
  const info = document.getElementById('planilha-excel-info');
  if (info) info.innerHTML = '';
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
    await carregarDadosDasEmpresas();
    if (proximo === 'empregados') renderEmpregadosWizard();
    if (proximo === 'socios')     renderSociosWizard();
    if (proximo === 'rubricas')   renderRubricasWizard();
  }
  if (wizardPanelAtual === 'planilha' && !excelData.length) {
    toast('Faça o upload da planilha Excel para continuar.', 'error'); return;
  }
  if (wizardPanelAtual === 'empregados' && proximo === 'socios')   renderSociosWizard();
  if (wizardPanelAtual === 'empregados' && proximo === 'rubricas') renderRubricasWizard();
  if (wizardPanelAtual === 'socios'     && proximo === 'rubricas') renderRubricasWizard();

  if (proximo === 'empresas') renderEmpresasWizard();

  if (proximo === 'exportar') {
    const fontes = wizardModeloSelecionado?.fontes || [];
    const template = wizardModeloSelecionado?.template || '';
    const usaExcel = fontes.includes('excel') || template.includes('{{excel.');
    const temFonteDB = fontes.some(f => ['empresas','empregados','socios','rubricas'].includes(f));
    const soExcel = usaExcel && !temFonteDB;
    if (soExcel && !wizardColunaEmpresaExcel && !wizardNomeEmpresaExcel) {
      abrirModalNomeEmpresaExcel(); return;
    }
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
  wizardCaberUmaPagina = false;
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
    sb.from('rh_rubricas').select('*').in('codigo_empresa', codigos).order('descricao_rubrica'),
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
    (r.descricao_rubrica || r.evento || '').toLowerCase().includes(filtro) ||
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
        <strong>${esc(r.descricao_rubrica || r.evento || '')}</strong>
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
  const template = modelo?.template || '';
  const usaExcel = fontes.includes('excel') || template.includes('{{excel.');
  const temFonteDB = fontes.some(f => ['empresas','empregados','socios','rubricas'].includes(f));
  const soExcel  = usaExcel && !temFonteDB;

  // Modo Excel puro: um documento por linha da planilha. Quando uma coluna
  // de empresa foi identificada, grava empresa.nome_empresa (e
  // empresa.codigo_empresa, se detectado) por linha para que
  // _agruparRegistrosPorEmpresa() separe a exportação em um PDF por empresa.
  if (soExcel) {
    wizardRegistros = excelData.map(row => {
      const map = {};
      for (const h of excelHeaders) map[`excel.${h}`] = row[h] ?? '';
      if (wizardColunaEmpresaExcel) {
        map['empresa.nome_empresa'] = row[wizardColunaEmpresaExcel] ?? '';
        if (wizardColunaCodigoEmpresaExcel) {
          map['empresa.codigo_empresa'] = row[wizardColunaCodigoEmpresaExcel] ?? '';
        }
      }
      return map;
    });
    wizardPreviewIndex = 0;
    return;
  }

  const empsSel  = _dbEmpregados.filter(e => wizardEmpregadosSelecionados.includes(e.id));
  const socsSel  = _dbSocios.filter(s => wizardSociosSelecionados.includes(s.id));
  const rubsSel  = _dbRubricas.filter(r => wizardRubricasSelecionados.includes(r.id));

  // Normaliza o código da empresa antes de cruzar rh_empregados × rh_empresas —
  // protege contra espaços em branco acidentais em uma das duas tabelas que
  // fariam o cruzamento falhar silenciosamente (empresa some do documento).
  const _normCod = (v) => String(v ?? '').trim();
  const empresaMap = {};
  empresas.forEach(e => { empresaMap[_normCod(e.codigo_empresa)] = e; });
  const buscarEmpresa = (cod) => {
    const found = empresaMap[_normCod(cod)];
    if (!found) console.warn('[Gerador de Modelos] Empresa não encontrada para codigo_empresa =', JSON.stringify(cod), '— confira se esse código existe em rh_empresas com o mesmo valor.');
    return found || {};
  };

  // Quando há Excel junto com DB, cada registro recebe a linha do Excel pelo índice
  // (ou a primeira linha se houver menos linhas que registros)
  const excelRow = (i) => excelData.length ? (excelData[i] || excelData[0]) : {};

  if (modelo.tipo === 'por_registro') {
    const base = fontes.includes('empregados') && empsSel.length ? empsSel : null;
    if (base) {
      wizardRegistros = base.map((emp, i) => {
        const empresa = buscarEmpresa(emp.codigo_empresa);
        const socio   = socsSel.find(s => s.codigo_empresa === emp.codigo_empresa) || {};
        const rubrica = rubsSel.find(r => r.codigo_empresa === emp.codigo_empresa) || {};
        return buildVarMap(empresa, emp, socio, rubrica, excelRow(i));
      });
    } else {
      wizardRegistros = wizardEmpresasSelecionadas.map((cod, i) => {
        const empresa = buscarEmpresa(cod);
        const socio   = socsSel.find(s => s.codigo_empresa === cod) || {};
        const rubrica = rubsSel.find(r => r.codigo_empresa === cod) || {};
        return buildVarMap(empresa, {}, socio, rubrica, excelRow(i));
      });
    }
  } else {
    wizardRegistros = wizardEmpresasSelecionadas.map((cod, i) => {
      const empresa = buscarEmpresa(cod);
      const emp     = empsSel.find(e => e.codigo_empresa === cod) || {};
      const socio   = socsSel.find(s => s.codigo_empresa === cod) || {};
      const rubrica = rubsSel.find(r => r.codigo_empresa === cod) || {};
      return buildVarMap(empresa, emp, socio, rubrica, excelRow(i));
    });
  }
  wizardPreviewIndex = 0;
}

const MESES_EXTENSO = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function _dataAtualExtenso() {
  const d = new Date();
  return `${d.getDate()} de ${MESES_EXTENSO[d.getMonth()]} de ${d.getFullYear()}`;
}

function buildVarMap(empresa, empregado, socio, rubrica, excelRow) {
  const map = {};
  for (const [campo] of VARS_DEF.empresas.campos)   map[`empresa.${campo}`]   = empresa[campo]   ?? '';
  for (const [campo] of VARS_DEF.empregados.campos)  map[`empregado.${campo}`] = empregado[campo] ?? '';
  for (const [campo] of VARS_DEF.socios.campos)      map[`socio.${campo}`]     = socio[campo]     ?? '';
  for (const [campo] of VARS_DEF.rubricas.campos)    map[`rubrica.${campo}`]   = rubrica[campo]   ?? '';
  for (const h of excelHeaders)                       map[`excel.${h}`]         = excelRow[h]      ?? '';
  map['sistema.data_atual']         = new Date().toLocaleDateString('pt-BR');
  map['sistema.data_atual_extenso'] = _dataAtualExtenso();
  return map;
}

// ── Por Extenso ───────────────────────────────────────────────
function _grupo(n) {
  const U = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove',
             'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const D = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const C = ['','cento','duzentos','trezentos','quatrocentos','quinhentos',
             'seiscentos','setecentos','oitocentos','novecentos'];
  if (n === 0) return '';
  if (n === 100) return 'cem';
  if (n < 20) return U[n];
  if (n < 100) { const d = Math.floor(n/10), u = n%10; return u ? D[d]+' e '+U[u] : D[d]; }
  const c = Math.floor(n/100), r = n%100;
  return C[c] + (r ? ' e '+_grupo(r) : '');
}

function _numExtenso(n) {
  if (n === 0) return 'zero';
  const p = [];
  const bi = Math.floor(n/1000000000); n %= 1000000000;
  if (bi) p.push(_grupo(bi) + (bi === 1 ? ' bilhão' : ' bilhões'));
  const mi = Math.floor(n/1000000); n %= 1000000;
  if (mi) p.push(_grupo(mi) + (mi === 1 ? ' milhão' : ' milhões'));
  const mil = Math.floor(n/1000); n %= 1000;
  if (mil) p.push(mil === 1 ? 'mil' : _grupo(mil)+' mil');
  if (n > 0) p.push(_grupo(n));
  return p.join(' e ');
}

function valorPorExtenso(valor) {
  let str = String(valor ?? '').trim().replace(/R\$\s*/g, '');
  if (/\d\.\d{3}(,|$)/.test(str)) str = str.replace(/\./g, '').replace(',', '.');
  else str = str.replace(',', '.');
  const num = parseFloat(str.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return String(valor);
  const inteiro  = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - inteiro) * 100);
  const pInt  = inteiro  === 0 ? '' : _numExtenso(inteiro)  + (inteiro  === 1 ? ' real'    : ' reais');
  const pCent = centavos === 0 ? '' : _numExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  if (!pInt && !pCent) return 'zero reais';
  if (!pInt)  return pCent;
  if (!pCent) return pInt;
  return pInt + ' e ' + pCent;
}

function substituirVars(template, varMap, highlight = false) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    key = key.trim();
    let extenso = false;
    if (key.startsWith('extenso:')) { extenso = true; key = key.slice(8).trim(); }
    const val = varMap[key];
    if (val === undefined || val === null || val === '') {
      return highlight ? `<span class="var-missing">${esc(match)}</span>` : match;
    }
    return esc(extenso ? valorPorExtenso(val) : String(val));
  });
}

// ── Preview ───────────────────────────────────────────────────
// Cabeçalho compartilhado por preview, exportação em PDF e prévia do editor.
// 'completo': Logo SCONT + nome da empresa cliente + título do modelo.
// 'neutro':   nome da empresa cliente + título do modelo, com
//             "SCONT Soluções Contábeis" no canto inferior direito do cabeçalho.
// 'nenhum'/outro: sem cabeçalho.
function _gerarCabecalhoModelo(modo, nomeEmpresaCliente, tituloModelo) {
  const hdr   = 'background:#8B3A3A;color:white;padding:12px 18px;display:flex;align-items:center;gap:14px;position:relative;';
  const logo  = 'font-size:18px;font-weight:900;letter-spacing:2px;color:white;border:2px solid rgba(255,255,255,.6);padding:2px 7px;border-radius:3px;flex-shrink:0';
  const sep   = 'width:1px;background:rgba(255,255,255,.4);height:30px;flex-shrink:0';
  const title = 'font-size:12px;font-weight:700;color:white;display:block;line-height:1.2';
  const sub   = 'font-size:10px;color:rgba(255,255,255,.8);display:block;margin-top:2px';
  const canto = 'position:absolute;right:18px;bottom:9px;font-size:9px;color:rgba(255,255,255,.75);letter-spacing:.3px;';

  if (modo === 'completo') {
    return `<div style="${hdr}">
      <span style="${logo}">SCONT</span><div style="${sep}"></div>
      <div><strong style="${title}">${esc(nomeEmpresaCliente)}</strong>
      <span style="${sub}">${esc(tituloModelo)}</span></div></div>`;
  }
  if (modo === 'neutro') {
    return `<div style="${hdr}">
      <div><strong style="${title}">${esc(nomeEmpresaCliente)}</strong>
      <span style="${sub}">${esc(tituloModelo)}</span></div>
      <span style="${canto}">SCONT Soluções Contábeis</span></div>`;
  }
  return '';
}

function renderPreview() {
  const area    = document.getElementById('preview-area');
  const counter = document.getElementById('preview-counter');
  if (!wizardModeloSelecionado || !wizardRegistros.length) {
    area.innerHTML = '<div style="padding:20px;color:var(--muted)">Nenhum registro para pré-visualizar.</div>';
    counter.textContent = '0 / 0'; return;
  }
  const total = wizardRegistros.length;
  wizardPreviewIndex = Math.max(0, Math.min(wizardPreviewIndex, total - 1));
  const varMap = wizardRegistros[wizardPreviewIndex];
  const bodyStyle = 'padding:16px 0;font-size:13px;line-height:1.8;background:#fff;';
  const nomeEmp = varMap['empresa.nome_empresa'] || wizardNomeEmpresaExcel || 'Empresa';

  let conteudo;
  if (wizardEventoAtivo) {
    // Um cabeçalho por modelo do evento, cada um com seu próprio título.
    conteudo = wizardEventoAtivo.modelosOrdenados.map(m => {
      const hdr   = _gerarCabecalhoModelo(wizardCabecalho, nomeEmp, m.nome);
      const corpo = substituirVars(m.template || '', varMap, true);
      return `${hdr}<div style="${bodyStyle}">${corpo}</div>`;
    }).join('<hr style="margin:18px 0;border:none;border-top:2px dashed #ddd;">');
  } else {
    const hdr   = _gerarCabecalhoModelo(wizardCabecalho, nomeEmp, wizardModeloSelecionado.nome);
    const corpo = substituirVars(wizardModeloSelecionado.template, varMap, true);
    conteudo = `${hdr}<div style="${bodyStyle}">${corpo}</div>`;
  }

  area.innerHTML = conteudo;
  counter.textContent = `${wizardPreviewIndex + 1} / ${total}`;
}

function previewPrev() { wizardPreviewIndex = Math.max(0, wizardPreviewIndex - 1); renderPreview(); }
function previewNext() { wizardPreviewIndex = Math.min(wizardRegistros.length - 1, wizardPreviewIndex + 1); renderPreview(); }

// ── Exportar — cabeçalho ──────────────────────────────────────
function selectCabecalho(val) {
  wizardCabecalho = val;
  document.getElementById('cab-opt-completo').classList.toggle('selected', val === 'completo');
  document.getElementById('cab-opt-neutro').classList.toggle('selected', val === 'neutro');
  document.getElementById('cab-opt-nenhum').classList.toggle('selected', val === 'nenhum');
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
  const nomeEmpresaPreview =
    primeiraEmpresa?.nome_empresa ||
    wizardRegistros[0]?.['empresa.nome_empresa'] ||
    wizardNomeEmpresaExcel ||
    'Nome da Empresa';
  document.getElementById('cab-completo-empresa-name').textContent = nomeEmpresaPreview;
  document.getElementById('cab-completo-titulo').textContent = m.nome;
  document.getElementById('cab-neutro-empresa-name').textContent = nomeEmpresaPreview;
  document.getElementById('cab-neutro-titulo').textContent = m.nome;
  // Aplica cabeçalho padrão do modelo
  selectCabecalho(wizardCabecalho);
  document.querySelector(`input[name=cabecalho][value="${wizardCabecalho}"]`)?.click();
  const chkCaber = document.getElementById('chk-caber-uma-pagina');
  if (chkCaber) chkCaber.checked = wizardCaberUmaPagina;
}

// ── Exportar PDF ──────────────────────────────────────────────
const _nomeEmpDe = (varMap) => varMap['empresa.nome_empresa'] || wizardNomeEmpresaExcel || 'Empresa';

// Agrupa os registros por empresa (codigo_empresa, com fallback pro nome) —
// cada grupo vira um arquivo/janela de impressão separado quando há mais de
// uma empresa envolvida na geração.
function _agruparRegistrosPorEmpresa(registros) {
  const grupos = [];
  const porChave = new Map();
  registros.forEach((varMap) => {
    const chave = varMap['empresa.codigo_empresa'] || varMap['empresa.nome_empresa'] || '__sem_empresa__';
    let grupo = porChave.get(chave);
    if (!grupo) {
      grupo = { nomeEmpresa: _nomeEmpDe(varMap), registros: [] };
      porChave.set(chave, grupo);
      grupos.push(grupo);
    }
    grupo.registros.push(varMap);
  });
  return grupos;
}

// Monta o HTML das páginas (um documento por registro, ou por modelo do
// evento) a partir de uma lista de registros — reaproveitado tanto para o
// arquivo único quanto para cada arquivo por empresa.
function _montarPaginasPDF(modelo, registros) {
  const bodyStyle = 'padding:16px 0;font-family:Segoe UI,Arial,sans-serif;font-size:11px;line-height:1.7;color:#2C3E50;';

  let paginas;
  if (wizardEventoAtivo) {
    // Um cabeçalho por modelo do evento — cada documento em folha própria,
    // tanto entre modelos de um mesmo registro quanto entre registros.
    const modelosEvento = wizardEventoAtivo.modelosOrdenados;
    const blocos = [];
    registros.forEach((varMap) => {
      modelosEvento.forEach((m) => {
        const hdr   = _gerarCabecalhoModelo(wizardCabecalho, _nomeEmpDe(varMap), m.nome);
        const corpo = substituirVars(m.template || '', varMap, false);
        blocos.push(`${hdr}<div style="${bodyStyle}">${corpo}</div>`);
      });
    });
    paginas = blocos.map((html, idx) => {
      const isUltimo = idx === blocos.length - 1;
      const pageBreak = !isUltimo ? 'page-break-after:always;break-after:page;' : '';
      return `<div class="pdf-fit-page" style="${pageBreak}"><div class="pdf-fit-inner">${html}</div></div>`;
    });
  } else {
    const porRegistro = modelo.tipo === 'por_registro';
    paginas = registros.map((varMap, idx) => {
      const hdr      = _gerarCabecalhoModelo(wizardCabecalho, _nomeEmpDe(varMap), modelo.nome);
      const corpo    = substituirVars(modelo.template, varMap, false);
      const isUltimo = idx === registros.length - 1;
      const pageBreak = porRegistro && !isUltimo
        ? 'page-break-after:always;break-after:page;'
        : '';
      return `<div class="pdf-fit-page" style="${pageBreak}"><div class="pdf-fit-inner">${hdr}<div style="${bodyStyle}">${corpo}</div></div></div>`;
    });
  }

  return paginas.join('');
}

// Abre uma janela de impressão com o HTML já montado. Retorna false se o
// navegador bloqueou o pop-up. `printDelayMs` escalona o disparo do
// diálogo de impressão dentro da janela (usado para não empilhar vários
// diálogos de impressão de uma vez quando há uma janela por empresa).
function _abrirJanelaImpressao(titulo, innerHtml, printDelayMs = 300, caberUmaPagina = false) {
  const printWin = window.open('', '_blank');
  if (!printWin) return false;

  const printCss = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.7;
      color: #2C3E50;
      background: #fff;
    }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${caberUmaPagina ? '.pdf-fit-page { width: 180mm; } .pdf-fit-inner { transform-origin: top left; }' : ''}
  `;

  // Quando "caber em 1 página" está ligado, mede a altura real de cada
  // documento (largura fixa em mm reproduz a largura de impressão) contra a
  // área útil da A4 (297mm - 12mm×2 de margem) e aplica um scale ≤ 1 —
  // nunca amplia, e só encolhe quem realmente estoura a página.
  const fitScript = caberUmaPagina ? `
      function _ajustarParaUmaPagina() {
        var pxPorMm = 96 / 25.4;
        var alturaDisponivel = 273 * pxPorMm;
        document.querySelectorAll('.pdf-fit-page').forEach(function (pagina) {
          var inner = pagina.querySelector('.pdf-fit-inner');
          if (!inner) return;
          var alturaNatural = inner.scrollHeight;
          var escala = Math.min(1, alturaDisponivel / alturaNatural);
          if (escala < 1) inner.style.transform = 'scale(' + escala + ')';
        });
      }
      _ajustarParaUmaPagina();` : '';

  printWin.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>${esc(titulo)}</title>
    <style>${printCss}</style>
  </head><body>
    ${innerHtml}
    <script>
      window.onload = function() {${fitScript}
        setTimeout(function() { window.print(); }, ${printDelayMs});
      };
    </script>
  </body></html>`);
  printWin.document.close();
  return true;
}

async function exportarPDF() {
  if (!wizardModeloSelecionado || !wizardRegistros.length) {
    toast('Nenhum dado para exportar.', 'error'); return;
  }

  const modelo = wizardModeloSelecionado;
  const grupos = _agruparRegistrosPorEmpresa(wizardRegistros);
  const multiplasEmpresas = grupos.length > 1;

  toast(multiplasEmpresas ? `Gerando ${grupos.length} PDFs — um por empresa…` : 'Gerando PDF…', '');

  // As janelas são abertas de forma síncrona, todas dentro do mesmo gesto de
  // clique — abrir pop-ups de dentro de um setTimeout costuma ser bloqueado
  // pelo navegador. O disparo do diálogo de impressão de cada janela (feito
  // internamente via window.onload) é escalonado para não empilhar vários
  // diálogos de impressão de uma vez.
  const bloqueadas = [];
  grupos.forEach((grupo, idx) => {
    const innerHtml = _montarPaginasPDF(modelo, grupo.registros);
    const titulo = multiplasEmpresas ? `${modelo.nome} — ${grupo.nomeEmpresa}` : modelo.nome;
    const ok = _abrirJanelaImpressao(titulo, innerHtml, 300 + idx * 700, wizardCaberUmaPagina);
    if (!ok) bloqueadas.push(grupo.nomeEmpresa);
  });

  await registrarGeracao();

  if (bloqueadas.length) {
    toast(`Permita pop-ups nesta página — ${bloqueadas.length} de ${grupos.length} PDF(s) não abriram (${bloqueadas.join(', ')}).`, 'error');
  } else {
    toast(multiplasEmpresas
      ? 'Diálogos de impressão abertos — um por empresa. Desmarque "Cabeçalhos e rodapés" para remover a data.'
      : 'Diálogo de impressão aberto — desmarque "Cabeçalhos e rodapés" para remover a data.', 'success');
  }
}

function abrirModalNomeEmpresaExcel() {
  document.getElementById('modal-nome-empresa-excel').classList.add('open');
  const inp = document.getElementById('input-nome-empresa-excel');
  inp.value = wizardNomeEmpresaExcel || '';
  setTimeout(() => inp.focus(), 100);
}

function confirmarNomeEmpresaExcel() {
  const val = document.getElementById('input-nome-empresa-excel').value.trim();
  if (!val) { toast('Informe o nome da empresa.', 'error'); return; }
  wizardNomeEmpresaExcel = val;
  document.getElementById('modal-nome-empresa-excel').classList.remove('open');
  construirRegistros();
  buildWizardResumo();
  renderPreview();
  mostrarPainel('exportar');
}

function fecharModalNomeEmpresaExcel() {
  document.getElementById('modal-nome-empresa-excel').classList.remove('open');
}

function buildCabecalhoHtml(tipo, varMap, tituloModelo) {
  const nomeEmpresa = varMap['empresa.nome_empresa'] || wizardNomeEmpresaExcel || 'Empresa';
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

  if (wizardEventoAtivo) {
    const linhas = wizardEventoAtivo.modelosOrdenados.map(m => ({
      modelo_id:       m.id,
      modelo_nome:     m.nome,
      empresas_ids:    wizardEmpresasSelecionadas,
      total_registros: wizardRegistros.length,
      cabecalho_usado: wizardCabecalho,
      criado_por:      currentUser?.id,
      evento_id:       wizardEventoAtivo.id,
    }));
    await sb.from('gm_geracoes').insert(linhas);
    return;
  }

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
  iniciarWizard();
}

// ── Excel Upload ──────────────────────────────────────────────
function _normalizeExcelData(json) {
  const rawHeaders = Object.keys(json[0]);
  const headers = rawHeaders.map(h => h.replace(/[\r\n]+/g, ' ').trim().replace(/\s+/g, ' '));
  const data = json.map(row => {
    const r = {};
    rawHeaders.forEach((raw, i) => { r[headers[i]] = row[raw] ?? ''; });
    return r;
  });
  return { headers, data };
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb   = XLSX.read(e.target.result, { type: 'binary' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!json.length) { toast('Planilha vazia.', 'error'); return; }
    const { headers, data } = _normalizeExcelData(json);
    excelHeaders = headers;
    excelData    = data;
    renderVarsPanel();
    _renderModalExcelPreview();
    toast('Planilha carregada: ' + excelHeaders.length + ' coluna(s).', 'success');
  };
  reader.readAsBinaryString(file);
}

function _renderModalExcelPreview() {
  const prev = document.getElementById('modal-excel-preview');
  if (!prev) return;
  if (!excelHeaders.length) { prev.innerHTML = ''; return; }
  prev.innerHTML = `
    <div style="font-size:12px;color:var(--success);font-weight:600;margin-bottom:6px">
      ✅ ${excelData.length} linha(s) · ${excelHeaders.length} coluna(s) disponíveis como variáveis:
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${excelHeaders.map(h => {
        const safe = h.replace(/'/g, '&#39;');
        return `<code style="background:var(--bg-light);border:1px solid var(--border-light);border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer" onmousedown="event.preventDefault()" onclick="insertVar('{{excel.${safe}}}')" title="Clique para inserir">{{excel.${h}}}</code><span class="var-chip-ext" onmousedown="event.preventDefault()" onclick="insertVar('{{extenso:excel.${safe}}}')">ext</span>`;
      }).join('')}
    </div>`;
}

function removeExcel() {
  excelData = []; excelHeaders = [];
  const mef = document.getElementById('modal-excel-file');
  if (mef) mef.value = '';
  const mep = document.getElementById('modal-excel-preview');
  if (mep) mep.innerHTML = '';
  renderVarsPanel();
}

// Candidatos de nome de cabeçalho (normalizados) que identificam a empresa
// de cada linha numa planilha Excel usada no modo "Excel puro" do wizard.
const _CANDIDATOS_COLUNA_EMPRESA = [
  'empresa', 'nome empresa', 'nome_empresa', 'cliente', 'razao social',
  'nome da empresa', 'nome fantasia'
];
const _CANDIDATOS_COLUNA_CODIGO_EMPRESA = [
  'codigo empresa', 'cod empresa', 'codigo_empresa', 'cod_empresa'
];

function _normalizarHeader(h) {
  return String(h ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

function _detectarColuna(headers, candidatos) {
  for (const h of headers) {
    if (candidatos.includes(_normalizarHeader(h))) return h;
  }
  return '';
}

function _detectarColunaEmpresa(headers) {
  return _detectarColuna(headers, _CANDIDATOS_COLUNA_EMPRESA);
}

function _detectarColunaCodigoEmpresa(headers) {
  return _detectarColuna(headers, _CANDIDATOS_COLUNA_CODIGO_EMPRESA);
}

function handleWizardExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb   = XLSX.read(e.target.result, { type: 'binary' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!json.length) { toast('Planilha vazia.', 'error'); return; }
    const { headers, data } = _normalizeExcelData(json);
    excelHeaders = headers;
    excelData    = data;
    wizardColunaEmpresaExcel       = _detectarColunaEmpresa(headers);
    wizardColunaCodigoEmpresaExcel = _detectarColunaCodigoEmpresa(headers);
    _renderPlanilhaInfo();
    toast(`Planilha carregada: ${excelData.length} linha(s), ${excelHeaders.length} coluna(s).`, 'success');
  };
  reader.readAsBinaryString(file);
}

function limparWizardExcel() {
  excelData = []; excelHeaders = [];
  wizardColunaEmpresaExcel = '';
  wizardColunaCodigoEmpresaExcel = '';
  _limparUIPlanilha();
}

function onChangeColunaEmpresaExcel(val) {
  wizardColunaEmpresaExcel = val;
  _renderPlanilhaInfo();
}

function _renderPlanilhaInfo() {
  const div = document.getElementById('planilha-excel-info');
  if (!div) return;
  if (!excelHeaders.length) { div.innerHTML = ''; return; }
  const preview = excelData.slice(0, 3);
  const cols = excelHeaders;

  const colunaSelect = `
    <div style="margin-bottom:14px">
      <label class="form-label">Coluna que identifica a empresa em cada linha</label>
      <select class="form-control" onchange="onChangeColunaEmpresaExcel(this.value)">
        <option value=""${wizardColunaEmpresaExcel ? '' : ' selected'}>— Mesma empresa para todas as linhas —</option>
        ${cols.map(h => `<option value="${esc(h)}"${wizardColunaEmpresaExcel === h ? ' selected' : ''}>${esc(h)}</option>`).join('')}
      </select>
    </div>`;

  let infoEmpresas = '';
  if (wizardColunaEmpresaExcel) {
    const n = new Set(excelData.map(r => r[wizardColunaEmpresaExcel])).size;
    infoEmpresas = `
      <div style="font-size:12px;color:var(--text-light);margin-bottom:8px">
        🏢 ${n} empresa${n === 1 ? '' : 's'} diferente${n === 1 ? '' : 's'} detectada${n === 1 ? '' : 's'}
        → ser${n === 1 ? 'á gerado 1 PDF' : 'ão gerados ' + n + ' PDFs separados'} ao exportar.
      </div>`;
  }

  div.innerHTML = `
    <div style="font-size:12px;color:var(--success);font-weight:600;margin-bottom:8px">
      ✅ ${excelData.length} linha(s) · ${excelHeaders.length} coluna(s)
    </div>
    ${colunaSelect}
    ${infoEmpresas}
    <div style="overflow-x:auto">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead>
          <tr>${cols.map(h => `<th style="padding:4px 8px;background:var(--bg-light);border:1px solid var(--border-light);text-align:left;white-space:nowrap">{{excel.${h}}}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${preview.map(row => `<tr>${cols.map(h => `<td style="padding:4px 8px;border:1px solid var(--border-light);color:var(--text-light)">${esc(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}
          ${excelData.length > 3 ? `<tr><td colspan="${cols.length}" style="padding:4px 8px;border:1px solid var(--border-light);color:var(--muted);text-align:center">… mais ${excelData.length - 3} linha(s)</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
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

// ── Table Picker ──────────────────────────────────────────────
let _tablePickerOpen = false;

function openTablePicker() {
  const editor = document.getElementById('modelo-template');
  const btn    = document.getElementById('tb-btn-tabela');
  const picker = document.getElementById('tb-table-picker');

  // Salva o range atual
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (editor.contains(r.commonAncestorContainer)) savedEditorRange = r.cloneRange();
  }

  // Monta o grid apenas uma vez
  if (!picker.querySelector('.tb-table-grid')) {
    const label = document.createElement('div');
    label.className = 'tb-table-label';
    label.id = 'tb-table-label';
    label.textContent = 'Selecione o tamanho';
    picker.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'tb-table-grid';
    for (let row = 1; row <= 6; row++) {
      for (let col = 1; col <= 8; col++) {
        const cell = document.createElement('div');
        cell.className = 'tb-table-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.addEventListener('mouseenter', () => highlightTableCells(row, col));
        cell.addEventListener('mouseleave', () => {});
        cell.addEventListener('click', () => { insertTable(row, col); closeTablePicker(); });
        grid.appendChild(cell);
      }
    }
    grid.addEventListener('mouseleave', () => highlightTableCells(0, 0));
    picker.appendChild(grid);
  }

  // Posiciona abaixo do botão
  const rect = btn.getBoundingClientRect();
  picker.style.top  = (rect.bottom + 4) + 'px';
  picker.style.left = rect.left + 'px';
  picker.classList.add('open');
  _tablePickerOpen = true;
}

function closeTablePicker() {
  document.getElementById('tb-table-picker').classList.remove('open');
  highlightTableCells(0, 0);
  _tablePickerOpen = false;
}

function highlightTableCells(rows, cols) {
  document.querySelectorAll('.tb-table-cell').forEach(cell => {
    cell.classList.toggle('hl', +cell.dataset.row <= rows && +cell.dataset.col <= cols);
  });
  const label = document.getElementById('tb-table-label');
  if (label) label.textContent = (rows && cols) ? `${rows} × ${cols}` : 'Selecione o tamanho';
}

function insertTable(rows, cols) {
  const editor = document.getElementById('modelo-template');
  editor.focus();

  const sel = window.getSelection();
  if (savedEditorRange) {
    sel.removeAllRanges();
    sel.addRange(savedEditorRange);
  }

  const thStyle   = 'background:#8B3A3A;color:white;padding:8px 10px;border:1px solid #6B2A2A;font-weight:700;text-align:left;font-size:11px;';
  const tdOdd     = 'padding:8px 10px;border:1px solid #ddd;background:#fff;font-size:11px;';
  const tdEven    = 'padding:8px 10px;border:1px solid #ddd;background:#f8f9fa;font-size:11px;';

  let html = '<table style="width:100%;border-collapse:collapse;font-family:inherit;font-size:11px;margin:8px 0"><tbody>';

  // Linha de cabeçalho
  html += '<tr>' + Array.from({length: cols}, () => `<th style="${thStyle}">&nbsp;</th>`).join('') + '</tr>';

  // Linhas de dados
  for (let r = 1; r < rows; r++) {
    const td = r % 2 === 0 ? tdEven : tdOdd;
    html += '<tr>' + Array.from({length: cols}, () => `<td style="${td}">&nbsp;</td>`).join('') + '</tr>';
  }

  html += '</tbody></table>';

  const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  if (range && editor.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    let last;
    while (temp.firstChild) { last = temp.firstChild; frag.appendChild(last); }
    range.insertNode(frag);
    if (last) {
      const newRange = document.createRange();
      newRange.setStartAfter(last);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedEditorRange = newRange.cloneRange();
    }
  } else {
    editor.insertAdjacentHTML('beforeend', html);
  }
}

// Fecha ao clicar fora ou pressionar Esc
document.addEventListener('mousedown', e => {
  if (_tablePickerOpen && !e.target.closest('#tb-table-picker') && !e.target.closest('#tb-btn-tabela')) {
    closeTablePicker();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _tablePickerOpen) closeTablePicker();
});

function updateEditorHeaderPreview() {
  const tipo = document.getElementById('modelo-cabecalho')?.value || 'completo';
  const nome = document.getElementById('modelo-nome')?.value.trim() || 'Nome do Modelo';
  const el = document.getElementById('editor-hdr-preview');
  if (!el) return;

  if (tipo === 'nenhum') {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';
  el.style.position = 'relative';
  const logoStyle  = 'background:rgba(255,255,255,0.22);border-radius:3px;padding:2px 8px;font-size:11px;font-weight:800;letter-spacing:1.5px;border:1.5px solid rgba(255,255,255,.45);flex-shrink:0;color:white';
  const sepStyle   = 'width:1px;height:28px;background:rgba(255,255,255,0.3);flex-shrink:0';
  const titleStyle = 'display:block;font-size:12px;font-weight:700;line-height:1.2;color:white';
  const subStyle   = 'font-size:10px;opacity:0.75;color:white;display:block;margin-top:2px';
  const cantoStyle = 'position:absolute;right:14px;bottom:8px;font-size:9px;color:rgba(255,255,255,.75);';

  // Placeholder: no editor não há uma empresa cliente real ainda, só o nome do modelo.
  if (tipo === 'completo') {
    el.innerHTML = `
      <span style="${logoStyle}">SCONT</span>
      <div style="${sepStyle}"></div>
      <div>
        <strong style="${titleStyle}">Nome da Empresa Cliente</strong>
        <span style="${subStyle}">${esc(nome)}</span>
      </div>`;
  } else {
    el.innerHTML = `
      <div>
        <strong style="${titleStyle}">Nome da Empresa Cliente</strong>
        <span style="${subStyle}">${esc(nome)}</span>
      </div>
      <span style="${cantoStyle}">SCONT Soluções Contábeis</span>`;
  }
}

function toggleFitZoom() {
  const editor = document.getElementById('modelo-template');
  const btn = document.getElementById('tb-fit-zoom');
  if (editor.style.zoom && editor.style.zoom !== '1') {
    editor.style.zoom = '';
    btn.textContent = '⛶ Ajustar';
    return;
  }
  const factor = editor.clientWidth / editor.scrollWidth;
  if (factor >= 1) {
    toast('Conteúdo já cabe na janela.', '');
    return;
  }
  editor.style.zoom = factor;
  btn.textContent = '⛶ 100%';
}
