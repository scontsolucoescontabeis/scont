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
  const SISTEMAS_SUGERIDOS = ['Domínio', 'Alterdata', 'Bling', 'Omie', 'Contmatic', 'SAP', 'Totvs'];
  const ENTREGAVEIS_SUGERIDOS = ['Balancete', 'DRE', 'Folha de Pagamento', 'Guias de Impostos', 'Relatório Gerencial'];
  const OBRIGACOES_SUGERIDAS = ['SPED Fiscal', 'SPED Contribuições', 'ECD', 'ECF', 'DCTF', 'DCTFWeb', 'EFD-Reinf', 'DAS', 'DEFIS', 'DIRF'];
  const FORMA_ENVIO_SUGERIDA = ['E-mail', 'WhatsApp', 'Google Drive', 'Sistema próprio'];

  let empresas = [];          // [{ codigo_empresa, nome_empresa }]
  let mapeamentos = [];       // linhas de contabil_mapeamento
  let pendenciasPorMapeamento = {}; // { mapeamento_id: [pendencias] }
  let relacionadasPorEmpresa = {};  // cache simples { codigo_empresa: [codigo_empresa_relacionada, ...] }
  let mapeamentoAtualId = null;     // codigo_empresa selecionado (null = dashboard)
  let mapeamentoAtual = null;       // linha de contabil_mapeamento selecionada
  let filtro = { nivel: null, regime: '', financeiro: '' };

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

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
  }

  async function carregarDados() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao));
    mapeamentos = dataMapeamentos || [];

    const ids = mapeamentos.map((m) => m.id);
    pendenciasPorMapeamento = {};
    if (ids.length) {
      const { data: pendencias, error: errPend } = await supabaseClient
        .from('contabil_mapeamento_pendencias')
        .select('*')
        .in('mapeamento_id', ids);
      if (errPend) console.error(errPend);
      (pendencias || []).forEach((p) => {
        (pendenciasPorMapeamento[p.mapeamento_id] = pendenciasPorMapeamento[p.mapeamento_id] || []).push(p);
      });
    }
  }

  function mapeamentoDe(codigoEmpresa) {
    return mapeamentos.find((m) => m.codigo_empresa === codigoEmpresa) || null;
  }

  function nivelDe(codigoEmpresa) {
    const m = mapeamentoDe(codigoEmpresa);
    return m ? (m.nivel_atencao || 'baixo') : 'baixo';
  }

  function pendenciasAbertasDe(mapeamentoId) {
    return (pendenciasPorMapeamento[mapeamentoId] || []).filter((p) => p.status === 'aberta');
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

  function formatarData(dataStr) {
    const d = window.parseDataLocal(dataStr);
    return d.toLocaleDateString('pt-BR');
  }

  // ─── DASHBOARD ──────────────────────────────────────────────

  function empresasFiltradas() {
    return empresas.filter((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      if (filtro.nivel && nivelDe(e.codigo_empresa) !== filtro.nivel) return false;
      if (filtro.regime && (!m || m.regime_tributario !== filtro.regime)) return false;
      if (filtro.financeiro && (!m || m.financeiro_interno_bpo !== filtro.financeiro)) return false;
      return true;
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

    const linhas = empresasFiltradas().map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      const abertas = m ? pendenciasAbertasDe(m.id).length : 0;
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? (REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td>${m && m.ultimo_mes_fechado ? formatarMesAno(m.ultimo_mes_fechado) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
          <td>${abertas}</td>
        </tr>
      `;
    }).join('');

    main.innerHTML = `
      <div class="mapa-dashboard-cards">${cardsHtml}</div>
      <div class="mapa-filtros">
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
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Último mês fechado</th><th>Nível</th><th>Pendências</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Nenhuma empresa encontrada.</td></tr>'}</tbody>
      </table>
    `;

    main.querySelectorAll('.mapa-count-card').forEach((card) => {
      card.addEventListener('click', () => {
        const n = card.getAttribute('data-nivel');
        filtro.nivel = filtro.nivel === n ? null : n;
        renderDashboard();
      });
    });
    document.getElementById('filtroRegime').addEventListener('change', (ev) => { filtro.regime = ev.target.value; renderDashboard(); });
    document.getElementById('filtroFinanceiro').addEventListener('change', (ev) => { filtro.financeiro = ev.target.value; renderDashboard(); });
    main.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
      tr.addEventListener('click', () => selecionarEmpresa(tr.getAttribute('data-codigo')));
    });
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
    if (!m) {
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento')
        .insert({ codigo_empresa: codigoEmpresa })
        .select()
        .single();
      if (error) { console.error(error); return; }
      m = data;
      mapeamentos.push(m);
    }
    mapeamentoAtual = m;
    renderPerfil();
  }

  function renderPerfil() {
    const main = document.getElementById('main');
    const m = mapeamentoAtual;

    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>${escapeHtml(empresaNome(m.codigo_empresa))}</h2></div>
        <div class="onboarding-header-actions">
          <button type="button" class="btn btn-primary" id="btnRelatorioPDF">📄 Gerar Relatório PDF</button>
        </div>
      </div>

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
          <div><label>Contato — Nome</label><input type="text" data-campo="contato_nome" value="${escapeHtml(m.contato_nome || '')}"></div>
          <div><label>Contato — Telefone</label><input type="text" data-campo="contato_telefone" value="${escapeHtml(m.contato_telefone || '')}"></div>
          <div><label>Contato — E-mail</label><input type="email" data-campo="contato_email" value="${escapeHtml(m.contato_email || '')}"></div>
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
          <div class="full" style="display:flex;align-items:center;gap:8px;"><label style="margin:0;"><input type="checkbox" data-campo="acesso_bancario_leitura" ${m.acesso_bancario_leitura ? 'checked' : ''}> Possui acesso bancário de leitura</label></div>
          <div class="full">${renderTagsInput('forma_envio_documentos', 'Forma de Envio dos Documentos', m.forma_envio_documentos, FORMA_ENVIO_SUGERIDA)}</div>
          <div class="full">${renderTagsInput('bancos_utilizados', 'Bancos Utilizados', m.bancos_utilizados, BANCOS_SUGERIDOS)}</div>
          <div class="full">${renderTagsInput('sistemas_utilizados', 'Sistemas Utilizados', m.sistemas_utilizados, SISTEMAS_SUGERIDOS)}</div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Entregáveis & Particularidades</div>
        <div class="mapa-secao-body">
          <div class="full">${renderTagsInput('entregaveis_esperados', 'Entregáveis Esperados', m.entregaveis_esperados, ENTREGAVEIS_SUGERIDOS)}</div>
          <div class="full">${renderTagsInput('obrigacoes_acessorias', 'Obrigações Acessórias', m.obrigacoes_acessorias, OBRIGACOES_SUGERIDAS)}</div>
          <div class="full"><label>Particularidades Contábeis</label><textarea data-campo="particularidades_contabeis" rows="3">${escapeHtml(m.particularidades_contabeis || '')}</textarea></div>
          <div class="full"><label>Particularidades Fiscais</label><textarea data-campo="particularidades_fiscais" rows="3">${escapeHtml(m.particularidades_fiscais || '')}</textarea></div>
          <div class="full"><label>Particularidades Societárias</label><textarea data-campo="particularidades_societarias" rows="3">${escapeHtml(m.particularidades_societarias || '')}</textarea></div>
        </div>
      </div>

      <div id="secaoNivelAtencao"></div>
      <div id="secaoPendencias"></div>
      <div id="secaoRelacionadas"></div>
    `;

    main.querySelectorAll('[data-campo]').forEach((el) => {
      const evento = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'blur';
      el.addEventListener(evento, () => salvarCampo(el));
    });

    main.querySelectorAll('[data-tag-input]').forEach((input) => {
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
      btn.addEventListener('click', async () => {
        const campo = btn.getAttribute('data-remover-tag');
        const valor = btn.getAttribute('data-valor');
        const atual = (mapeamentoAtual[campo] || []).filter((v) => v !== valor);
        await salvarTags(campo, atual);
        renderPerfil();
      });
    });

    document.getElementById('btnRelatorioPDF').addEventListener('click', gerarRelatorioPDF);

    renderNivelAtencao();
    renderPendencias();
    renderRelacionadas();
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

  async function salvarCampo(el) {
    const campo = el.getAttribute('data-campo');
    let valor = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'month' && valor) valor = `${valor}-01`;
    if (el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'month' && valor === '') valor = null;

    mapeamentoAtual[campo] = valor;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: valor }).eq('id', mapeamentoAtual.id);
    if (error) console.error(error);
    if (campo.startsWith('situacao_') || campo === 'ultimo_mes_fechado' || campo === 'periodicidade') {
      atualizarSugestaoNivel();
    }
  }

  async function salvarTags(campo, novaLista) {
    mapeamentoAtual[campo] = novaLista;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: novaLista }).eq('id', mapeamentoAtual.id);
    if (error) console.error(error);
  }

  // ─── NÍVEL DE ATENÇÃO ───────────────────────────────────────

  function renderNivelAtencao() {
    const el = document.getElementById('secaoNivelAtencao');
    const m = mapeamentoAtual;
    const pendencias = pendenciasPorMapeamento[m.id] || [];
    const sugestao = window.calcularNivelSugerido(m, pendencias, new Date());

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Nível de Atenção</div>
        <div class="mapa-secao-body">
          <div><label>Nível Atual</label>
            <select data-manual-nivel="1">
              ${NIVEIS.map((n) => `<option value="${n}" ${m.nivel_atencao === n ? 'selected' : ''}>${NIVEL_LABELS[n]}</option>`).join('')}
            </select>
          </div>
          <div><label>Sugestão do Sistema</label><span class="badge-nivel nivel-${sugestao}">Sugestão: ${NIVEL_LABELS[sugestao]}</span></div>
        </div>
      </div>
    `;

    el.querySelector('[data-manual-nivel]').addEventListener('change', async (ev) => {
      const novoNivel = ev.target.value;
      const travado = novoNivel !== sugestao;
      mapeamentoAtual.nivel_atencao = novoNivel;
      mapeamentoAtual.nivel_atencao_travado = travado;
      const { error } = await supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: novoNivel, nivel_atencao_travado: travado }).eq('id', mapeamentoAtual.id);
      if (error) console.error(error);
    });
  }

  function atualizarSugestaoNivel() {
    if (!mapeamentoAtual || mapeamentoAtual.nivel_atencao_travado) { renderNivelAtencao(); return; }
    const pendencias = pendenciasPorMapeamento[mapeamentoAtual.id] || [];
    const sugestao = window.calcularNivelSugerido(mapeamentoAtual, pendencias, new Date());
    if (sugestao !== mapeamentoAtual.nivel_atencao) {
      mapeamentoAtual.nivel_atencao = sugestao;
      supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: sugestao }).eq('id', mapeamentoAtual.id).then(({ error }) => { if (error) console.error(error); });
    }
    renderNivelAtencao();
  }

  // ─── PENDÊNCIAS ─────────────────────────────────────────────

  function renderPendencias() {
    const el = document.getElementById('secaoPendencias');
    const m = mapeamentoAtual;
    const pendencias = (pendenciasPorMapeamento[m.id] || []).slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'aberta' ? -1 : 1));
    const hoje = new Date();

    const itensHtml = pendencias.map((p) => {
      const vencida = p.status === 'aberta' && p.prazo && window.parseDataLocal(p.prazo) < hoje;
      return `
        <div class="mapa-pendencia-item ${vencida ? 'vencida' : ''} ${p.status === 'resolvida' ? 'resolvida' : ''}">
          <span class="desc">${escapeHtml(p.descricao)}${p.responsavel ? ` — <em>${escapeHtml(p.responsavel)}</em>` : ''}${p.prazo ? ` (prazo: ${formatarData(p.prazo)})` : ''}</span>
          <span class="acoes">
            ${p.status === 'aberta' ? `<button type="button" data-resolver="${p.id}">Resolver</button>` : ''}
            <button type="button" class="btn-excluir-pendencia" data-excluir="${p.id}">Excluir</button>
          </span>
        </div>
      `;
    }).join('') || '<p class="nav-empty">Nenhuma pendência registrada.</p>';

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Pendências</div>
        <div class="mapa-secao-body">
          <div class="full">${itensHtml}</div>
          <div><label>Descrição</label><input type="text" id="novaPendenciaDesc" placeholder="Ex: Enviar guia DAS de junho"></div>
          <div><label>Responsável</label><input type="text" id="novaPendenciaResp" placeholder="Nome do responsável"></div>
          <div><label>Prazo</label><input type="date" id="novaPendenciaPrazo"></div>
          <div style="align-self:end;"><button type="button" id="btnAddPendencia" class="btn-novo">+ Adicionar Pendência</button></div>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-resolver]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-resolver');
        const { error } = await supabaseClient.from('contabil_mapeamento_pendencias').update({ status: 'resolvida', resolvido_em: new Date().toISOString() }).eq('id', id);
        if (error) { console.error(error); return; }
        const item = (pendenciasPorMapeamento[m.id] || []).find((p) => p.id === id);
        if (item) { item.status = 'resolvida'; item.resolvido_em = new Date().toISOString(); }
        atualizarSugestaoNivel();
        renderPendencias();
      });
    });

    el.querySelectorAll('[data-excluir]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-excluir');
        if (!window.confirm('Excluir esta pendência? Essa ação não pode ser desfeita.')) return;
        const { error } = await supabaseClient.from('contabil_mapeamento_pendencias').delete().eq('id', id);
        if (error) { console.error(error); return; }
        pendenciasPorMapeamento[m.id] = (pendenciasPorMapeamento[m.id] || []).filter((p) => p.id !== id);
        atualizarSugestaoNivel();
        renderPendencias();
      });
    });

    el.querySelector('#btnAddPendencia').addEventListener('click', async () => {
      const descricao = document.getElementById('novaPendenciaDesc').value.trim();
      if (!descricao) return;
      const responsavel = document.getElementById('novaPendenciaResp').value.trim() || null;
      const prazo = document.getElementById('novaPendenciaPrazo').value || null;
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento_pendencias')
        .insert({ mapeamento_id: m.id, descricao, responsavel, prazo, status: 'aberta' })
        .select()
        .single();
      if (error) { console.error(error); return; }
      (pendenciasPorMapeamento[m.id] = pendenciasPorMapeamento[m.id] || []).push(data);
      atualizarSugestaoNivel();
      renderPendencias();
    });
  }

  // ─── EMPRESAS RELACIONADAS ──────────────────────────────────

  async function renderRelacionadas() {
    const el = document.getElementById('secaoRelacionadas');
    const m = mapeamentoAtual;

    const { data, error } = await supabaseClient
      .from('contabil_mapeamento_relacionadas')
      .select('codigo_empresa_relacionada')
      .eq('codigo_empresa', m.codigo_empresa);
    if (error) console.error(error);
    const relacionadas = (data || []).map((r) => r.codigo_empresa_relacionada);
    relacionadasPorEmpresa[m.codigo_empresa] = relacionadas;

    const opcoesDisponiveis = empresas.filter((e) => e.codigo_empresa !== m.codigo_empresa && !relacionadas.includes(e.codigo_empresa));

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas Relacionadas</div>
        <div class="mapa-secao-body">
          <div class="full">
            ${relacionadas.length
              ? `<div class="mapa-tags">${relacionadas.map((cod) => `<span class="mapa-tag">${escapeHtml(empresaNome(cod))}<button type="button" data-desvincular="${cod}">×</button></span>`).join('')}</div>`
              : '<p class="nav-empty">Nenhuma empresa relacionada.</p>'}
          </div>
          <div class="full">
            <select id="selectRelacionada">
              <option value="">Vincular empresa...</option>
              ${opcoesDisponiveis.map((e) => `<option value="${e.codigo_empresa}">${escapeHtml(e.nome_empresa)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-desvincular]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const codRelacionada = btn.getAttribute('data-desvincular');
        await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', m.codigo_empresa).eq('codigo_empresa_relacionada', codRelacionada);
        await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', codRelacionada).eq('codigo_empresa_relacionada', m.codigo_empresa);
        renderRelacionadas();
      });
    });

    el.querySelector('#selectRelacionada').addEventListener('change', async (ev) => {
      const codRelacionada = ev.target.value;
      if (!codRelacionada) return;
      await supabaseClient.from('contabil_mapeamento_relacionadas').insert([
        { codigo_empresa: m.codigo_empresa, codigo_empresa_relacionada: codRelacionada },
        { codigo_empresa: codRelacionada, codigo_empresa_relacionada: m.codigo_empresa },
      ]);
      renderRelacionadas();
    });
  }

  // ─── RELATÓRIO PDF ──────────────────────────────────────────

  function secaoTabelaPdf(doc, titulo, linhas, startY, pageW, margem) {
    if (startY > 260) { doc.addPage(); startY = margem; }
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
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const MARGEM = 10;
    const pageW = doc.internal.pageSize.getWidth();
    const nomeEmpresa = empresaNome(m.codigo_empresa);

    const texto = (v) => (v == null || v === '' ? '—' : String(v));
    const tags = (arr) => (arr && arr.length ? arr.join(', ') : '—');

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

    y = secaoTabelaPdf(doc, 'Execução', [
      ['Periodicidade', m.periodicidade ? PERIODICIDADE_LABELS[m.periodicidade] : '—'],
      ['Regime Tributário', m.regime_tributario ? REGIME_LABELS[m.regime_tributario] : '—'],
      ['Responsável pela Execução', texto(m.responsavel_execucao)],
      ['Contato', [m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).join(' • ') || '—'],
    ], y, pageW, MARGEM);

    y = secaoTabelaPdf(doc, 'Situação de Fechamento', [
      ['Último Mês Fechado', m.ultimo_mes_fechado ? formatarMesAno(m.ultimo_mes_fechado) : '—'],
      ['Situação 2025', (m.situacao_2025_status ? SITUACAO_LABELS[m.situacao_2025_status] : '—') + (m.situacao_2025_obs ? ' — ' + m.situacao_2025_obs : '')],
      ['Situação 2026', (m.situacao_2026_status ? SITUACAO_LABELS[m.situacao_2026_status] : '—') + (m.situacao_2026_obs ? ' — ' + m.situacao_2026_obs : '')],
    ], y, pageW, MARGEM);

    y = secaoTabelaPdf(doc, 'Operação / Financeiro', [
      ['Financeiro Interno ou BPO', m.financeiro_interno_bpo ? FINANCEIRO_LABELS[m.financeiro_interno_bpo] : '—'],
      ['Acesso Bancário de Leitura', m.acesso_bancario_leitura ? 'Sim' : 'Não'],
      ['Forma de Envio dos Documentos', tags(m.forma_envio_documentos)],
      ['Bancos Utilizados', tags(m.bancos_utilizados)],
      ['Sistemas Utilizados', tags(m.sistemas_utilizados)],
    ], y, pageW, MARGEM);

    y = secaoTabelaPdf(doc, 'Entregáveis & Particularidades', [
      ['Entregáveis Esperados', tags(m.entregaveis_esperados)],
      ['Obrigações Acessórias', tags(m.obrigacoes_acessorias)],
      ['Particularidades Contábeis', texto(m.particularidades_contabeis)],
      ['Particularidades Fiscais', texto(m.particularidades_fiscais)],
      ['Particularidades Societárias', texto(m.particularidades_societarias)],
    ], y, pageW, MARGEM);

    const pendencias = pendenciasPorMapeamento[m.id] || [];
    if (y > 250) { doc.addPage(); y = MARGEM; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 58, 58);
    doc.text('Pendências', MARGEM, y);
    y += 3;
    if (pendencias.length) {
      doc.autoTable({
        head: [['Descrição', 'Responsável', 'Prazo', 'Status']],
        body: pendencias.map((p) => [p.descricao, p.responsavel || '—', p.prazo ? formatarData(p.prazo) : '—', p.status === 'aberta' ? 'Aberta' : 'Resolvida']),
        startY: y,
        margin: { left: MARGEM, right: MARGEM },
        styles: { fontSize: 8, cellPadding: 1.6 },
        headStyles: { fillColor: [139, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      y = doc.lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 108, 125);
      doc.text('Nenhuma pendência registrada.', MARGEM, y + 3);
      y += 12;
    }

    const { data: relData, error: relErr } = await supabaseClient
      .from('contabil_mapeamento_relacionadas')
      .select('codigo_empresa_relacionada')
      .eq('codigo_empresa', m.codigo_empresa);
    if (relErr) console.error(relErr);
    const relacionadas = (relData || []).map((r) => empresaNome(r.codigo_empresa_relacionada));

    if (y > 270) { doc.addPage(); y = MARGEM; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 58, 58);
    doc.text('Empresas Relacionadas', MARGEM, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 62, 80);
    doc.text(relacionadas.length ? relacionadas.join(', ') : 'Nenhuma empresa relacionada.', MARGEM, y + 6, { maxWidth: pageW - MARGEM * 2 });

    const nomeArquivoSeguro = nomeEmpresa
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    doc.save(`Mapeamento_Estrategico_${nomeArquivoSeguro}.pdf`);
  }
})();
