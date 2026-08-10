(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const NIVEIS = ['baixo', 'medio', 'alto', 'critico'];
  const NIVEL_LABELS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };
  const REGIME_LABELS = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' };
  const SITUACAO_LABELS = { regularizado: 'Regularizado', em_regularizacao: 'Em Regularização', pendente: 'Pendente', critico: 'Crítico' };
  const FINANCEIRO_LABELS = { interno: 'Interno', bpo_scont: 'BPO Scont', bpo_terceiro: 'BPO Terceiro', nao_possui: 'Não possui' };
  const PERIODICIDADE_LABELS = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' };

  const BANCOS_SUGERIDOS = ['Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Santander', 'Sicoob', 'Sicredi', 'Inter', 'Nubank'];
  const OBRIGACOES_SUGERIDAS = ['SPED Fiscal', 'SPED Contribuições', 'ECD', 'ECF', 'DCTF', 'DCTFWeb', 'EFD-Reinf', 'DAS', 'DEFIS', 'DIRF'];

  const ENTREGAVEIS_OPCOES = ['Folha de pagamento', 'Guias de impostos', 'Relatórios gerenciais', 'Balancete de verificação com análise vertical', 'Livro Diário', 'Livro Razão', 'Balanço Patrimonial', 'DFC', 'Outros'];
  const FORMA_ENVIO_OPCOES = ['Onvio', 'Outros'];
  const SISTEMAS_OPCOES = ['Domínio', 'Alterdata', 'Bling', 'Omie', 'Contmatic', 'SAP', 'Totvs', 'Conta Azul', 'Outros'];

  // campo de checkbox → coluna onde fica o texto livre quando "Outros" é marcado
  const CAMPOS_OUTROS_DETALHE = {
    forma_envio_documentos: 'forma_envio_documentos_outros_detalhe',
    entregaveis_esperados: 'entregaveis_esperados_outros_detalhe',
    sistemas_utilizados: 'sistemas_utilizados_outros_detalhe',
  };

  let empresas = [];          // [{ codigo_empresa, nome_empresa }]
  let mapeamentos = [];       // linhas de contabil_mapeamento
  let bancosPorMapeamento = {};     // { mapeamento_id: [bancos] }
  let contatoPorMapeamento = {};    // { mapeamento_id: {nome, telefone, email} }
  let relacionadasPorEmpresa = {};  // cache simples { codigo_empresa: [codigo_empresa_relacionada, ...] }
  let mapeamentoAtualId = null;     // codigo_empresa selecionado (null = dashboard)
  let mapeamentoAtual = null;       // linha de contabil_mapeamento selecionada
  let filtro = { nivel: null, regime: '', financeiro: '', busca: '' };

  // ─── ESCOPO: "Prestador de Serviço" só vê empresas onde é responsável ──
  // Mesma convenção client-side já usada no Diário Contábil (diario.js).
  // A edição do Mapeamento Estratégico é exclusiva da equipe Scont; demais
  // usuários (Prestador de Serviço) têm acesso somente de leitura.
  let _isAdmin = false;
  let _isScontTeam = false;
  let _podeEditar = false;
  let _restringirSeletor = false;
  let _meusResponsaveisSet = new Set();
  let _origemDiarioEmpresa = null; // codigo_empresa quando a navegação veio do Diário Contábil

  document.addEventListener('DOMContentLoaded', iniciar);

  async function _resolverEscopoUsuario(auth) {
    _isAdmin = !!auth.isAdmin;
    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    _isScontTeam = empresaUsuario === 'scont soluções contábeis';
    _podeEditar = _isAdmin || _isScontTeam;
    _restringirSeletor = !_isAdmin && empresaUsuario === 'prestador de serviço';

    if (!auth.userId) { _meusResponsaveisSet = new Set(); return; }
    const { data, error } = await supabaseClient
      .from('contabil_empresas_responsaveis')
      .select('codigo_empresa')
      .eq('usuario_id', auth.userId);
    if (error) { console.error(error); _meusResponsaveisSet = new Set(); return; }
    _meusResponsaveisSet = new Set((data || []).map((r) => r.codigo_empresa));
  }

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

    await _resolverEscopoUsuario(auth);

    document.getElementById('btnDashboard').addEventListener('click', () => {
      mapeamentoAtualId = null;
      mapeamentoAtual = null;
      document.getElementById('seletorEmpresa').value = '';
      renderDashboard();
    });
    document.getElementById('seletorEmpresa').addEventListener('change', (ev) => {
      if (ev.target.value) selecionarEmpresa(ev.target.value);
    });

    await carregarDados();
    renderDashboard();
    renderSeletorEmpresas();

    const params = new URLSearchParams(window.location.search);
    const empresaNaUrl = params.get('empresa');
    if (params.get('origem') === 'diario' && empresaNaUrl) _origemDiarioEmpresa = empresaNaUrl;
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresa(empresaNaUrl);
    }
  }

  async function carregarDados() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }, { data: dataConfig, error: errConfig }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);
    if (errConfig) console.error(errConfig);

    const configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });
    const possuiContabil = (codigo) => configPorEmpresa[codigo] !== false;

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao) && possuiContabil(e.codigo_empresa));
    if (_restringirSeletor) empresas = empresas.filter((e) => _meusResponsaveisSet.has(e.codigo_empresa));
    mapeamentos = dataMapeamentos || [];

    const ids = mapeamentos.map((m) => m.id);

    // Prestador de Serviço não pode ver dados bancários (nem em memória no
    // navegador) — só busca essa tabela para quem pode editar o Mapeamento.
    bancosPorMapeamento = {};
    if (ids.length && _podeEditar) {
      const { data: bancos, error: errBancos } = await supabaseClient
        .from('contabil_mapeamento_bancos')
        .select('*')
        .in('mapeamento_id', ids);
      if (errBancos) console.error(errBancos);
      (bancos || []).forEach((b) => {
        (bancosPorMapeamento[b.mapeamento_id] = bancosPorMapeamento[b.mapeamento_id] || []).push(b);
      });
    }

    // Mesma restrição do contato da empresa — Prestador de Serviço não pode
    // ver (nem a RLS de contabil_mapeamento_contatos deixaria a leitura
    // passar, mas evitamos buscar à toa).
    contatoPorMapeamento = {};
    if (ids.length && _podeEditar) {
      const { data: contatos, error: errContatos } = await supabaseClient
        .from('contabil_mapeamento_contatos')
        .select('*')
        .in('mapeamento_id', ids);
      if (errContatos) console.error(errContatos);
      (contatos || []).forEach((c) => { contatoPorMapeamento[c.mapeamento_id] = c; });
    }
  }

  function mapeamentoDe(codigoEmpresa) {
    return mapeamentos.find((m) => m.codigo_empresa === codigoEmpresa) || null;
  }

  function nivelDe(codigoEmpresa) {
    const m = mapeamentoDe(codigoEmpresa);
    return m ? (m.nivel_atencao || 'baixo') : 'baixo';
  }

  function empresaNome(codigoEmpresa) {
    const e = empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatarMesAno(dataStr) {
    const d = window.parseDataLocal(dataStr);
    return d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
  }

  function mostrarToast(msg, tipo) {
    let toast = document.getElementById('toastMsg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastMsg';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast show ${tipo === 'erro' ? 'erro' : tipo === 'sucesso' ? 'sucesso' : ''}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // Isola cada seção do perfil: se uma seção falhar ao renderizar (exceção
  // por dado inesperado), as demais continuam aparecendo em vez de o perfil
  // inteiro ficar com seções em branco sem nenhum aviso.
  function avisarErroSecao(nomeSecao, err) {
    console.error(`Erro ao renderizar a seção "${nomeSecao}" do Mapeamento Estratégico:`, err);
    mostrarToast(`Erro ao carregar "${nomeSecao}". Veja o console (F12) para detalhes.`, 'erro');
  }

  function renderizarSecaoComIsolamento(nomeSecao, fn) {
    try {
      const resultado = fn();
      if (resultado && typeof resultado.catch === 'function') {
        resultado.catch((err) => avisarErroSecao(nomeSecao, err));
      }
    } catch (err) {
      avisarErroSecao(nomeSecao, err);
    }
  }

  // ─── DASHBOARD ──────────────────────────────────────────────

  function empresasFiltradas() {
    const termoBusca = filtro.busca.trim().toLowerCase();
    return empresas.filter((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      if (termoBusca && !e.codigo_empresa.toLowerCase().includes(termoBusca) && !e.nome_empresa.toLowerCase().includes(termoBusca)) return false;
      if (filtro.nivel && nivelDe(e.codigo_empresa) !== filtro.nivel) return false;
      if (filtro.regime && (!m || m.regime_tributario !== filtro.regime)) return false;
      if (filtro.financeiro && (!m || m.financeiro_interno_bpo !== filtro.financeiro)) return false;
      return true;
    });
  }

  function linhasDashboardHtml() {
    const linhas = empresasFiltradas().map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.codigo_empresa)} - ${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? (REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td>${m && m.ultimo_mes_fechado ? formatarMesAno(m.ultimo_mes_fechado) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
        </tr>
      `;
    }).join('');
    return linhas || '<tr><td colspan="5">Nenhuma empresa encontrada.</td></tr>';
  }

  function ligarCliquesLinhasDashboard() {
    document.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
      tr.addEventListener('click', () => selecionarEmpresa(tr.getAttribute('data-codigo')));
    });
  }

  function renderDashboard() {
    const main = document.getElementById('main');
    const contagens = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    empresas.forEach((e) => { contagens[nivelDe(e.codigo_empresa)]++; });

    const cardsHtml = NIVEIS.map((n) => `
      <div class="mapa-count-card nivel-${n} ${filtro.nivel === n ? 'active' : ''}" data-nivel="${n}">
        <div class="num">${contagens[n]}</div>
        <div class="label">${NIVEL_LABELS[n]}</div>
      </div>
    `).join('');

    main.innerHTML = `
      <div class="mapa-dashboard-cards">${cardsHtml}</div>
      <div class="mapa-filtros">
        <input type="text" id="filtroBusca" value="${escapeHtml(filtro.busca)}" placeholder="Buscar por código ou nome...">
        <select id="filtroRegime">
          <option value="">Todos os regimes</option>
          ${Object.entries(REGIME_LABELS).map(([v, l]) => `<option value="${v}" ${filtro.regime === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select id="filtroFinanceiro">
          <option value="">Financeiro (todos)</option>
          ${Object.entries(FINANCEIRO_LABELS).map(([v, l]) => `<option value="${v}" ${filtro.financeiro === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <table class="mapa-table">
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Último mês fechado</th><th>Nível</th></tr></thead>
        <tbody id="tbodyDashboardMapeamento">${linhasDashboardHtml()}</tbody>
      </table>
    `;

    main.querySelectorAll('.mapa-count-card').forEach((card) => {
      card.addEventListener('click', () => {
        const n = card.getAttribute('data-nivel');
        filtro.nivel = filtro.nivel === n ? null : n;
        renderDashboard();
      });
    });
    document.getElementById('filtroBusca').addEventListener('input', (ev) => {
      filtro.busca = ev.target.value;
      document.getElementById('tbodyDashboardMapeamento').innerHTML = linhasDashboardHtml();
      ligarCliquesLinhasDashboard();
    });
    document.getElementById('filtroRegime').addEventListener('change', (ev) => { filtro.regime = ev.target.value; renderDashboard(); });
    document.getElementById('filtroFinanceiro').addEventListener('change', (ev) => { filtro.financeiro = ev.target.value; renderDashboard(); });
    ligarCliquesLinhasDashboard();
  }

  // ─── SIDEBAR: SELETOR DE EMPRESA ─────────────────────────────

  function renderSeletorEmpresas() {
    const select = document.getElementById('seletorEmpresa');
    const atual = select.value;
    select.innerHTML = '<option value="">Selecionar empresa...</option>' +
      empresas.map((e) => `<option value="${escapeHtml(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</option>`).join('');
    select.value = atual;
  }

  // ─── PERFIL DA EMPRESA ──────────────────────────────────────

  async function selecionarEmpresa(codigoEmpresa) {
    mapeamentoAtualId = codigoEmpresa;
    document.getElementById('seletorEmpresa').value = codigoEmpresa;
    let m = mapeamentoDe(codigoEmpresa);
    if (!m && _podeEditar) {
      // upsert (não insert puro): evita erro de chave duplicada se o
      // registro desta empresa já tiver sido criado nesse meio-tempo por
      // outra sessão (ex.: sincronização automática da tela de Configurações).
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento')
        .upsert({ codigo_empresa: codigoEmpresa }, { onConflict: 'codigo_empresa' })
        .select()
        .single();
      if (error) { console.error(error); mostrarToast('Erro ao carregar o perfil desta empresa. Veja o console (F12) para detalhes.', 'erro'); return; }
      m = data;
      mapeamentos.push(m);
    }
    // Usuário somente-leitura sem mapeamento ainda cadastrado: exibe um
    // perfil vazio sem persistir nada no banco.
    mapeamentoAtual = m || { codigo_empresa: codigoEmpresa };
    renderPerfil();
  }

  function renderPerfil() {
    const main = document.getElementById('main');
    const m = mapeamentoAtual;
    const RO = !_podeEditar;
    const contato = contatoPorMapeamento[m.id] || {};
    const voltarDiarioHtml = m.codigo_empresa === _origemDiarioEmpresa
      ? `<a class="btn btn-secondary" href="diario.html?empresa=${encodeURIComponent(m.codigo_empresa)}">← Voltar ao Diário</a>`
      : '';

    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>${escapeHtml(empresaNome(m.codigo_empresa))}</h2></div>
        <div class="onboarding-header-actions">
          ${voltarDiarioHtml}
          <button type="button" class="btn btn-primary" id="btnRelatorioPDF">📄 Gerar Relatório PDF</button>
        </div>
      </div>
      ${RO ? '<p class="mapa-somente-leitura-aviso">🔒 Somente leitura — a edição do Mapeamento Estratégico é exclusiva da equipe Scont.</p>' : ''}

      <div class="mapa-secao">
        <div class="mapa-secao-header">Execução</div>
        <div class="mapa-secao-body">
          <div><label>Periodicidade</label>
            <select data-campo="periodicidade">
              <option value="">Selecione...</option>
              <option value="mensal" ${m.periodicidade === 'mensal' ? 'selected' : ''}>Mensal</option>
              <option value="trimestral" ${m.periodicidade === 'trimestral' ? 'selected' : ''}>Trimestral</option>
              <option value="anual" ${m.periodicidade === 'anual' ? 'selected' : ''}>Anual</option>
            </select>
          </div>
          <div><label>Regime Tributário</label>
            <select data-campo="regime_tributario">
              <option value="">Selecione...</option>
              ${Object.entries(REGIME_LABELS).map(([v, l]) => `<option value="${v}" ${m.regime_tributario === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div><label>Responsável pela Execução</label><input type="text" data-campo="responsavel_execucao" value="${escapeHtml(m.responsavel_execucao || '')}"></div>
          <div><label>Último Mês Fechado</label><input type="month" data-campo="ultimo_mes_fechado" value="${m.ultimo_mes_fechado ? String(m.ultimo_mes_fechado).slice(0, 7) : ''}"></div>
          ${RO ? `
            <div class="full"><label>Contato</label><p class="mapa-empty">🔒 Contato da empresa visível apenas para a equipe Scont.</p></div>
          ` : `
            <div><label>Contato — Nome</label><input type="text" data-contato-campo="nome" value="${escapeHtml(contato.nome || '')}"></div>
            <div><label>Contato — Telefone</label><input type="text" data-contato-campo="telefone" value="${escapeHtml(contato.telefone || '')}"></div>
            <div><label>Contato — E-mail</label><input type="email" data-contato-campo="email" value="${escapeHtml(contato.email || '')}"></div>
          `}
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Situação de Fechamento</div>
        <div class="mapa-secao-body">
          ${renderSituacaoAno('2025', m)}
          ${renderSituacaoAno('2026', m)}
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Operação / Financeiro</div>
        <div class="mapa-secao-body">
          <div><label>Financeiro Interno ou BPO</label>
            <select data-campo="financeiro_interno_bpo">
              <option value="">Selecione...</option>
              ${Object.entries(FINANCEIRO_LABELS).map(([v, l]) => `<option value="${v}" ${m.financeiro_interno_bpo === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="full"><label><input type="checkbox" data-campo="acesso_bancario_leitura" ${m.acesso_bancario_leitura ? 'checked' : ''}> Possui acesso bancário de leitura</label></div>
          <div class="full">${renderCheckboxGroup('forma_envio_documentos', 'Forma de Envio dos Documentos', m.forma_envio_documentos, FORMA_ENVIO_OPCOES, m.forma_envio_documentos_outros_detalhe)}</div>
          <div class="full" id="secaoBancos"></div>
          <div class="full">${renderCheckboxGroup('sistemas_utilizados', 'Sistemas Utilizados', m.sistemas_utilizados, SISTEMAS_OPCOES, m.sistemas_utilizados_outros_detalhe)}</div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Entregáveis & Particularidades</div>
        <div class="mapa-secao-body">
          <div class="full">${renderCheckboxGroup('entregaveis_esperados', 'Entregáveis Esperados', m.entregaveis_esperados, ENTREGAVEIS_OPCOES, m.entregaveis_esperados_outros_detalhe)}</div>
          <div class="full">${renderTagsInput('obrigacoes_acessorias', 'Obrigações Acessórias', m.obrigacoes_acessorias, OBRIGACOES_SUGERIDAS)}</div>
          <div class="full"><label>Particularidades Contábeis</label><textarea data-campo="particularidades_contabeis" rows="3">${escapeHtml(m.particularidades_contabeis || '')}</textarea></div>
          <div class="full"><label>Particularidades Fiscais</label><textarea data-campo="particularidades_fiscais" rows="3">${escapeHtml(m.particularidades_fiscais || '')}</textarea></div>
          <div class="full"><label>Particularidades Societárias</label><textarea data-campo="particularidades_societarias" rows="3">${escapeHtml(m.particularidades_societarias || '')}</textarea></div>
        </div>
      </div>

      <div id="secaoNivelAtencao"></div>
      <div id="secaoRelacionadas"></div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Observações Gerais</div>
        <div class="mapa-secao-body">
          <div class="full"><textarea data-campo="observacoes_gerais" rows="4" placeholder="Observações gerais sobre a empresa...">${escapeHtml(m.observacoes_gerais || '')}</textarea></div>
        </div>
      </div>
    `;

    main.querySelectorAll('[data-campo]').forEach((el) => {
      el.disabled = RO;
      const evento = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'blur';
      el.addEventListener(evento, () => salvarCampo(el));
    });

    main.querySelectorAll('[data-contato-campo]').forEach((el) => {
      el.addEventListener('blur', () => salvarCampoContato(el));
    });

    main.querySelectorAll('[data-tag-input]').forEach((input) => {
      if (RO) { input.style.display = 'none'; return; }
      input.addEventListener('keydown', async (ev) => {
        if (ev.key !== 'Enter' || !input.value.trim()) return;
        ev.preventDefault();
        const campo = input.getAttribute('data-tag-input');
        const novoValor = input.value.trim();
        const atual = mapeamentoAtual[campo] || [];
        if (!atual.includes(novoValor)) {
          await salvarTags(campo, [...atual, novoValor]);
          renderPerfil();
        }
        input.value = '';
      });
    });
    main.querySelectorAll('[data-remover-tag]').forEach((btn) => {
      if (RO) { btn.style.display = 'none'; return; }
      btn.addEventListener('click', async () => {
        const campo = btn.getAttribute('data-remover-tag');
        const valor = btn.getAttribute('data-valor');
        const atual = (mapeamentoAtual[campo] || []).filter((v) => v !== valor);
        await salvarTags(campo, atual);
        renderPerfil();
      });
    });

    main.querySelectorAll('[data-checkbox-grupo]').forEach((chk) => {
      if (RO) { chk.disabled = true; return; }
      chk.addEventListener('change', async () => {
        const campo = chk.getAttribute('data-checkbox-grupo');
        const valor = chk.getAttribute('data-checkbox-valor');
        const atual = mapeamentoAtual[campo] || [];
        const novaLista = chk.checked ? [...atual, valor] : atual.filter((v) => v !== valor);
        await salvarTags(campo, novaLista);
        const campoDetalhe = CAMPOS_OUTROS_DETALHE[campo];
        if (valor === 'Outros' && campoDetalhe) {
          if (chk.checked) { renderPerfil(); abrirModalOutros(campoDetalhe, mapeamentoAtual[campoDetalhe] || ''); return; }
          await salvarCampoValor(campoDetalhe, null);
        }
        renderPerfil();
      });
    });
    main.querySelectorAll('[data-editar-outros]').forEach((btn) => {
      if (RO) { btn.style.display = 'none'; return; }
      btn.addEventListener('click', () => {
        abrirModalOutros(btn.getAttribute('data-editar-outros'), btn.getAttribute('data-outros-atual'));
      });
    });

    document.getElementById('btnRelatorioPDF').addEventListener('click', gerarRelatorioPDF);

    renderizarSecaoComIsolamento('Acessos Bancários', renderBancos);
    renderizarSecaoComIsolamento('Nível de Atenção', renderNivelAtencao);
    renderizarSecaoComIsolamento('Empresas Relacionadas', renderRelacionadas);
  }

  function renderSituacaoAno(ano, m) {
    const status = m[`situacao_${ano}_status`];
    const obs = m[`situacao_${ano}_obs`];
    return `
      <div><label>Situação de ${ano}</label>
        <select data-campo="situacao_${ano}_status">
          <option value="">Selecione...</option>
          ${Object.entries(SITUACAO_LABELS).map(([v, l]) => `<option value="${v}" ${status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div><label>Observação ${ano}</label><input type="text" data-campo="situacao_${ano}_obs" value="${escapeHtml(obs || '')}"></div>
    `;
  }

  function renderTagsInput(campo, label, valores, sugestoes) {
    valores = valores || [];
    const tagsHtml = valores.map((v) => `<span class="mapa-tag">${escapeHtml(v)}<button type="button" data-remover-tag="${campo}" data-valor="${escapeHtml(v)}">×</button></span>`).join('');
    const datalistId = `dl_${campo}`;
    return `
      <label>${label}</label>
      <div class="mapa-tags" data-tags-container="${campo}">${tagsHtml}</div>
      <input type="text" list="${datalistId}" placeholder="Adicionar e pressionar Enter" data-tag-input="${campo}">
      <datalist id="${datalistId}">${sugestoes.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
    `;
  }

  function renderCheckboxGroup(campo, label, valoresSelecionados, opcoes, detalheOutrosAtual) {
    valoresSelecionados = valoresSelecionados || [];
    const itensHtml = opcoes.map((op) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" data-checkbox-grupo="${campo}" data-checkbox-valor="${escapeHtml(op)}" ${valoresSelecionados.includes(op) ? 'checked' : ''}>
        ${escapeHtml(op)}
      </label>
    `).join('');
    const campoDetalhe = CAMPOS_OUTROS_DETALHE[campo];
    const detalheHtml = valoresSelecionados.includes('Outros')
      ? `<div class="mapa-checkbox-detalhe">Outros: ${detalheOutrosAtual ? escapeHtml(detalheOutrosAtual) : '<em>não especificado</em>'} <button type="button" data-editar-outros="${campoDetalhe}" data-outros-atual="${escapeHtml(detalheOutrosAtual || '')}">editar</button></div>`
      : '';
    return `
      <label>${label}</label>
      <div class="mapa-checkbox-grupo" data-checkbox-container="${campo}">${itensHtml}</div>
      ${detalheHtml}
    `;
  }

  function renderBancos() {
    const el = document.getElementById('secaoBancos');
    const m = mapeamentoAtual;
    const RO = !_podeEditar;

    // Dados bancários (incluindo senha em texto puro) são restritos à
    // equipe Scont — Prestador de Serviço não vê nem em modo leitura.
    if (RO) {
      el.innerHTML = `<label>Bancos Utilizados</label><p class="mapa-empty">🔒 Informações bancárias visíveis apenas para a equipe Scont.</p>`;
      return;
    }

    const bancos = bancosPorMapeamento[m.id] || [];
    const datalistId = 'dl_bancos_utilizados';

    const linhasHtml = bancos.map((b) => `
      <tr data-banco-id="${b.id}">
        <td>${escapeHtml(b.banco)}</td>
        <td><input type="text" data-banco-campo="agencia" value="${escapeHtml(b.agencia || '')}"></td>
        <td><input type="text" data-banco-campo="conta_corrente" value="${escapeHtml(b.conta_corrente || '')}"></td>
        <td><input type="text" data-banco-campo="operador_login" value="${escapeHtml(b.operador_login || '')}"></td>
        <td class="mapa-banco-senha">
          <input type="password" data-banco-campo="senha" value="${escapeHtml(b.senha || '')}">
          <button type="button" class="mapa-banco-olho" data-toggle-senha>👁</button>
        </td>
        <td><input type="text" data-banco-campo="observacoes" value="${escapeHtml(b.observacoes || '')}"></td>
        <td><button type="button" class="mapa-remover-banco" data-remover-banco="${b.id}">×</button></td>
      </tr>
    `).join('');

    el.innerHTML = `
      <label>Bancos Utilizados</label>
      <input type="text" list="${datalistId}" placeholder="Adicionar banco e pressionar Enter" id="inputNovoBanco">
      <datalist id="${datalistId}">${BANCOS_SUGERIDOS.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
      ${bancos.length ? `
        <table class="mapa-bancos-table">
          <thead><tr><th>Banco</th><th>Agência</th><th>Conta Corrente</th><th>Operador/Login</th><th>Senha</th><th>Observações</th><th></th></tr></thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      ` : '<p class="mapa-empty">Nenhum banco cadastrado.</p>'}
    `;

    el.querySelector('#inputNovoBanco').addEventListener('keydown', async (ev) => {
      if (ev.key !== 'Enter' || !ev.target.value.trim()) return;
      ev.preventDefault();
      const banco = ev.target.value.trim();
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento_bancos')
        .insert({ mapeamento_id: m.id, banco })
        .select()
        .single();
      if (error) { console.error(error); mostrarToast('Erro ao adicionar o banco. Veja o console (F12) para detalhes.', 'erro'); return; }
      (bancosPorMapeamento[m.id] = bancosPorMapeamento[m.id] || []).push(data);
      renderBancos();
    });

    el.querySelectorAll('[data-toggle-senha]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    el.querySelectorAll('[data-banco-campo]').forEach((input) => {
      input.addEventListener('blur', async () => {
        const tr = input.closest('tr');
        const bancoId = tr.getAttribute('data-banco-id');
        const campo = input.getAttribute('data-banco-campo');
        const valor = input.value.trim() || null;
        const { error } = await supabaseClient.from('contabil_mapeamento_bancos').update({ [campo]: valor }).eq('id', bancoId);
        if (error) { console.error(error); mostrarToast('Erro ao salvar o dado do banco. Veja o console (F12) para detalhes.', 'erro'); return; }
        const banco = (bancosPorMapeamento[m.id] || []).find((b) => b.id === bancoId);
        if (banco) banco[campo] = valor;
      });
    });

    el.querySelectorAll('[data-remover-banco]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bancoId = btn.getAttribute('data-remover-banco');
        const { error } = await supabaseClient.from('contabil_mapeamento_bancos').delete().eq('id', bancoId);
        if (error) { console.error(error); mostrarToast('Erro ao excluir o banco. Veja o console (F12) para detalhes.', 'erro'); return; }
        bancosPorMapeamento[m.id] = (bancosPorMapeamento[m.id] || []).filter((b) => b.id !== bancoId);
        renderBancos();
      });
    });
  }

  async function salvarCampo(el) {
    const campo = el.getAttribute('data-campo');
    let valor = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'month' && valor) valor = `${valor}-01`;
    if (el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'month' && valor === '') valor = null;

    mapeamentoAtual[campo] = valor;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: valor }).eq('id', mapeamentoAtual.id);
    if (error) { console.error(error); mostrarToast('Erro ao salvar. Veja o console (F12) para detalhes.', 'erro'); }
    if (campo.startsWith('situacao_') || campo === 'ultimo_mes_fechado' || campo === 'periodicidade') {
      atualizarSugestaoNivel();
    }
  }

  async function salvarCampoContato(el) {
    const campo = el.getAttribute('data-contato-campo');
    const valor = el.value.trim() || null;
    const m = mapeamentoAtual;
    const atual = { ...(contatoPorMapeamento[m.id] || {}), [campo]: valor };
    const { data, error } = await supabaseClient
      .from('contabil_mapeamento_contatos')
      .upsert({ mapeamento_id: m.id, nome: atual.nome || null, telefone: atual.telefone || null, email: atual.email || null }, { onConflict: 'mapeamento_id' })
      .select()
      .single();
    if (error) { console.error(error); mostrarToast('Erro ao salvar o contato. Veja o console (F12) para detalhes.', 'erro'); return; }
    contatoPorMapeamento[m.id] = data;
  }

  async function salvarCampoValor(campo, valor) {
    mapeamentoAtual[campo] = valor;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: valor }).eq('id', mapeamentoAtual.id);
    if (error) { console.error(error); mostrarToast('Erro ao salvar. Veja o console (F12) para detalhes.', 'erro'); }
  }

  async function salvarTags(campo, novaLista) {
    await salvarCampoValor(campo, novaLista);
  }

  // ─── MODAL: "OUTROS" (texto livre) ─────────────────────────

  let _outrosModalCampoDetalhe = null;

  function abrirModalOutros(campoDetalhe, valorAtual) {
    _outrosModalCampoDetalhe = campoDetalhe;
    let modal = document.getElementById('modalOutros');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalOutros';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Especifique "Outros"</h3>
            <button class="modal-close" id="fecharModalOutros">✕</button>
          </div>
          <div class="modal-body">
            <textarea id="outrosTexto" rows="4" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelarOutros">Cancelar</button>
            <button class="btn btn-primary" id="salvarOutros">Salvar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('fecharModalOutros').addEventListener('click', fecharModalOutros);
      document.getElementById('cancelarOutros').addEventListener('click', fecharModalOutros);
      document.getElementById('salvarOutros').addEventListener('click', salvarModalOutros);
    }
    document.getElementById('outrosTexto').value = valorAtual || '';
    modal.classList.add('active');
    document.getElementById('outrosTexto').focus();
  }

  function fecharModalOutros() {
    document.getElementById('modalOutros')?.classList.remove('active');
  }

  async function salvarModalOutros() {
    const texto = document.getElementById('outrosTexto').value.trim();
    await salvarCampoValor(_outrosModalCampoDetalhe, texto || null);
    fecharModalOutros();
    renderPerfil();
  }

  // ─── NÍVEL DE ATENÇÃO ───────────────────────────────────────

  function renderNivelAtencao() {
    const el = document.getElementById('secaoNivelAtencao');
    const m = mapeamentoAtual;
    const RO = !_podeEditar;
    // Pendências do Mapeamento foram descontinuadas (seção removida) — a
    // sugestão de nível agora considera só o atraso de fechamento.
    const sugestao = window.calcularNivelSugerido(m, [], new Date());

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Nível de Atenção</div>
        <div class="mapa-secao-body">
          <div><label>Nível Atual</label>
            <select data-manual-nivel="1" ${RO ? 'disabled' : ''}>
              ${NIVEIS.map((n) => `<option value="${n}" ${m.nivel_atencao === n ? 'selected' : ''}>${NIVEL_LABELS[n]}</option>`).join('')}
            </select>
          </div>
          <div><label>Sugestão do Sistema</label><span class="badge-nivel nivel-${sugestao}">Sugestão: ${NIVEL_LABELS[sugestao]}</span></div>
        </div>
      </div>
    `;

    if (!RO) {
      el.querySelector('[data-manual-nivel]').addEventListener('change', async (ev) => {
        const novoNivel = ev.target.value;
        const travado = novoNivel !== sugestao;
        mapeamentoAtual.nivel_atencao = novoNivel;
        mapeamentoAtual.nivel_atencao_travado = travado;
        const { error } = await supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: novoNivel, nivel_atencao_travado: travado }).eq('id', mapeamentoAtual.id);
        if (error) { console.error(error); mostrarToast('Erro ao salvar o nível de atenção. Veja o console (F12) para detalhes.', 'erro'); }
      });
    }
  }

  function atualizarSugestaoNivel() {
    if (!mapeamentoAtual || mapeamentoAtual.nivel_atencao_travado) { renderNivelAtencao(); return; }
    const sugestao = window.calcularNivelSugerido(mapeamentoAtual, [], new Date());
    if (sugestao !== mapeamentoAtual.nivel_atencao) {
      mapeamentoAtual.nivel_atencao = sugestao;
      supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: sugestao }).eq('id', mapeamentoAtual.id).then(({ error }) => { if (error) console.error(error); });
    }
    renderNivelAtencao();
  }

  // ─── EMPRESAS RELACIONADAS ──────────────────────────────────

  async function renderRelacionadas() {
    const el = document.getElementById('secaoRelacionadas');
    const m = mapeamentoAtual;
    const RO = !_podeEditar;

    const { data, error } = await supabaseClient
      .from('contabil_mapeamento_relacionadas')
      .select('codigo_empresa_relacionada')
      .eq('codigo_empresa', m.codigo_empresa);
    if (error) { console.error(error); mostrarToast('Erro ao carregar empresas relacionadas. Veja o console (F12) para detalhes.', 'erro'); }
    const relacionadas = (data || []).map((r) => r.codigo_empresa_relacionada);
    relacionadasPorEmpresa[m.codigo_empresa] = relacionadas;

    const opcoesDisponiveis = empresas.filter((e) => e.codigo_empresa !== m.codigo_empresa && !relacionadas.includes(e.codigo_empresa));

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas Relacionadas</div>
        <div class="mapa-secao-body">
          <div class="full">
            ${relacionadas.length
              ? `<div class="mapa-tags">${relacionadas.map((cod) => `<span class="mapa-tag">${escapeHtml(empresaNome(cod))}${RO ? '' : `<button type="button" data-desvincular="${cod}">×</button>`}</span>`).join('')}</div>`
              : '<p class="mapa-empty">Nenhuma empresa relacionada.</p>'}
          </div>
          ${RO ? '' : `
            <div class="full">
              <select id="selectRelacionada">
                <option value="">Vincular empresa...</option>
                ${opcoesDisponiveis.map((e) => `<option value="${e.codigo_empresa}">${escapeHtml(e.nome_empresa)}</option>`).join('')}
              </select>
            </div>
          `}
        </div>
      </div>
    `;

    if (RO) return;

    el.querySelectorAll('[data-desvincular]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const codRelacionada = btn.getAttribute('data-desvincular');
        const { error: err1 } = await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', m.codigo_empresa).eq('codigo_empresa_relacionada', codRelacionada);
        const { error: err2 } = await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', codRelacionada).eq('codigo_empresa_relacionada', m.codigo_empresa);
        if (err1 || err2) { console.error(err1 || err2); mostrarToast('Erro ao desvincular a empresa. Veja o console (F12) para detalhes.', 'erro'); return; }
        renderRelacionadas();
      });
    });

    el.querySelector('#selectRelacionada').addEventListener('change', async (ev) => {
      const codRelacionada = ev.target.value;
      if (!codRelacionada) return;
      const { error } = await supabaseClient.from('contabil_mapeamento_relacionadas').insert([
        { codigo_empresa: m.codigo_empresa, codigo_empresa_relacionada: codRelacionada },
        { codigo_empresa: codRelacionada, codigo_empresa_relacionada: m.codigo_empresa },
      ]);
      if (error) { console.error(error); mostrarToast('Erro ao vincular a empresa. Veja o console (F12) para detalhes.', 'erro'); return; }
      renderRelacionadas();
    });
  }

  // ─── RELATÓRIO PDF ──────────────────────────────────────────

  function secaoTabelaPdf(doc, titulo, linhas, startY, pageW, margem) {
    const pageH = doc.internal.pageSize.getHeight();
    if (startY > pageH - 35) { doc.addPage(); startY = margem; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 58, 58);
    doc.text(titulo, margem, startY);
    doc.autoTable({
      body: linhas,
      startY: startY + 3,
      margin: { left: margem, right: margem },
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: [44, 62, 80] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      theme: 'plain',
    });
    return doc.lastAutoTable.finalY + 8;
  }

  async function gerarRelatorioPDF() {
    const m = mapeamentoAtual;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const MARGEM = 10;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const nomeEmpresa = empresaNome(m.codigo_empresa);

    const texto = (v) => (v == null || v === '' ? '—' : String(v));
    const tags = (arr) => (arr && arr.length ? arr.join(', ') : '—');
    const tagsComOutros = (arr, detalhe) => {
      if (!arr || !arr.length) return '—';
      return arr.map((v) => (v === 'Outros' && detalhe ? `Outros (${detalhe})` : v)).join(', ');
    };

    doc.setFillColor(139, 58, 58);
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, 20, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(nomeEmpresa, MARGEM + 4, MARGEM + 8);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Mapeamento Estratégico — Departamento Contábil', MARGEM + 4, MARGEM + 15);
    doc.setFontSize(8);
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, MARGEM + 8, { align: 'right' });
    doc.text('Nível de atenção: ' + NIVEL_LABELS[m.nivel_atencao || 'baixo'], pageW - MARGEM - 4, MARGEM + 15, { align: 'right' });

    let y = MARGEM + 28;

    const linhasExecucao = [
      ['Periodicidade', m.periodicidade ? PERIODICIDADE_LABELS[m.periodicidade] : '—'],
      ['Regime Tributário', m.regime_tributario ? REGIME_LABELS[m.regime_tributario] : '—'],
      ['Responsável pela Execução', texto(m.responsavel_execucao)],
    ];
    // Contato não entra no PDF para quem não pode editar o Mapeamento
    // (Prestador de Serviço) — mesma restrição da tela e da RLS da tabela.
    if (_podeEditar) {
      const contato = contatoPorMapeamento[m.id] || {};
      linhasExecucao.push(['Contato', [contato.nome, contato.telefone, contato.email].filter(Boolean).join(' • ') || '—']);
    }
    y = secaoTabelaPdf(doc, 'Execução', linhasExecucao, y, pageW, MARGEM);

    y = secaoTabelaPdf(doc, 'Situação de Fechamento', [
      ['Último Mês Fechado', m.ultimo_mes_fechado ? formatarMesAno(m.ultimo_mes_fechado) : '—'],
      ['Situação 2025', (m.situacao_2025_status ? SITUACAO_LABELS[m.situacao_2025_status] : '—') + (m.situacao_2025_obs ? ' — ' + m.situacao_2025_obs : '')],
      ['Situação 2026', (m.situacao_2026_status ? SITUACAO_LABELS[m.situacao_2026_status] : '—') + (m.situacao_2026_obs ? ' — ' + m.situacao_2026_obs : '')],
    ], y, pageW, MARGEM);

    const linhasOperacao = [
      ['Financeiro Interno ou BPO', m.financeiro_interno_bpo ? FINANCEIRO_LABELS[m.financeiro_interno_bpo] : '—'],
      ['Acesso Bancário de Leitura', m.acesso_bancario_leitura ? 'Sim' : 'Não'],
      ['Forma de Envio dos Documentos', tagsComOutros(m.forma_envio_documentos, m.forma_envio_documentos_outros_detalhe)],
    ];
    // Dados bancários não entram no PDF para quem não pode editar o
    // Mapeamento (Prestador de Serviço) — mesma restrição da tela.
    if (_podeEditar) linhasOperacao.push(['Bancos Utilizados', tags((bancosPorMapeamento[m.id] || []).map((b) => b.banco))]);
    linhasOperacao.push(['Sistemas Utilizados', tagsComOutros(m.sistemas_utilizados, m.sistemas_utilizados_outros_detalhe)]);
    y = secaoTabelaPdf(doc, 'Operação / Financeiro', linhasOperacao, y, pageW, MARGEM);

    y = secaoTabelaPdf(doc, 'Entregáveis & Particularidades', [
      ['Entregáveis Esperados', tagsComOutros(m.entregaveis_esperados, m.entregaveis_esperados_outros_detalhe)],
      ['Obrigações Acessórias', tags(m.obrigacoes_acessorias)],
      ['Particularidades Contábeis', texto(m.particularidades_contabeis)],
      ['Particularidades Fiscais', texto(m.particularidades_fiscais)],
      ['Particularidades Societárias', texto(m.particularidades_societarias)],
    ], y, pageW, MARGEM);

    const { data: relData, error: relErr } = await supabaseClient
      .from('contabil_mapeamento_relacionadas')
      .select('codigo_empresa_relacionada')
      .eq('codigo_empresa', m.codigo_empresa);
    if (relErr) console.error(relErr);
    const relacionadas = (relData || []).map((r) => empresaNome(r.codigo_empresa_relacionada));

    if (y > pageH - 25) { doc.addPage(); y = MARGEM; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 58, 58);
    doc.text('Empresas Relacionadas', MARGEM, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 62, 80);
    const textoRelacionadas = relacionadas.length ? relacionadas.join(', ') : 'Nenhuma empresa relacionada.';
    const linhasRelacionadas = doc.splitTextToSize(textoRelacionadas, pageW - MARGEM * 2);
    doc.text(linhasRelacionadas, MARGEM, y + 6);
    y += 6 + linhasRelacionadas.length * 4.2 + 8;

    if (y > pageH - 25) { doc.addPage(); y = MARGEM; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 58, 58);
    doc.text('Observações Gerais', MARGEM, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 62, 80);
    const textoObs = m.observacoes_gerais && m.observacoes_gerais.trim() ? m.observacoes_gerais : 'Nenhuma observação registrada.';
    const linhasObs = doc.splitTextToSize(textoObs, pageW - MARGEM * 2);
    doc.text(linhasObs, MARGEM, y + 6);

    const nomeArquivoSeguro = nomeEmpresa
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    doc.save(`Mapeamento_Estrategico_${nomeArquivoSeguro}.pdf`);
  }
})();
