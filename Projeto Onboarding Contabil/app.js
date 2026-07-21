(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const BUCKET = 'documentos';

  const REGIMES = [
    { valor: 'simples_nacional', label: 'Simples Nacional' },
    { valor: 'lucro_presumido', label: 'Lucro Presumido' },
    { valor: 'lucro_real', label: 'Lucro Real' },
  ];

  const GATILHOS = [
    { campo: 'tem_contabilidade_anterior', label: 'Possui contabilidade anterior?' },
    { campo: 'tem_empregados', label: 'Possui empregados?' },
    { campo: 'tem_estoque', label: 'Possui estoques?' },
    { campo: 'contribuinte_icms', label: 'É contribuinte de ICMS?' },
    { campo: 'prestador_servicos', label: 'É prestador de serviços?' },
    { campo: 'tem_emprestimos', label: 'Possui empréstimos/financiamentos?' },
  ];

  const STATUS_LABELS = {
    pendente: 'Pendente',
    enviado: 'Enviado',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    nao_aplicavel: 'Não aplicável',
  };
  const STATUS_CONCLUIDOS = ['aprovado', 'nao_aplicavel'];

  const SECAO_TITULOS = {};
  (window.CONTABIL_CATALOGO || []).forEach((s) => { SECAO_TITULOS[s.secao] = s.titulo; });

  let usuarioAtual = null;
  let empresas = [];
  let onboardings = []; // resumo (com itens já anexados para cálculo de progresso)
  let onboardingAtualId = null;
  let abaAtual = 'checklist';
  let itemObsAberto = null;

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    usuarioAtual = auth;
    document.getElementById('authOverlay')?.remove();

    document.getElementById('btnNovoOnboarding').addEventListener('click', abrirFormNovoOnboarding);
    document.getElementById('buscaOnboarding').addEventListener('input', renderListaOnboardings);

    await Promise.all([carregarEmpresas(), carregarOnboardings()]);
  }

  // ─── CARREGAMENTO ───────────────────────────────────────────

  async function carregarEmpresas() {
    const { data, error } = await supabaseClient
      .from('rh_empresas')
      .select('codigo_empresa, nome_empresa, cnpj, status_situacao')
      .order('nome_empresa', { ascending: true });
    if (error) { console.error(error); return; }
    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (data || []).filter((e) => ativa(e.status_situacao));
  }

  async function carregarOnboardings() {
    const nav = document.getElementById('listaOnboardings');
    nav.innerHTML = '<p class="nav-loading">Carregando...</p>';

    const { data: registros, error } = await supabaseClient
      .from('contabil_onboardings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); nav.innerHTML = '<p class="nav-empty">Erro ao carregar.</p>'; return; }

    const ids = (registros || []).map((r) => r.id);
    let itensPorOnboarding = {};
    if (ids.length) {
      const { data: itens, error: errItens } = await supabaseClient
        .from('contabil_onboarding_itens')
        .select('id, onboarding_id, status')
        .in('onboarding_id', ids);
      if (errItens) console.error(errItens);
      (itens || []).forEach((it) => {
        (itensPorOnboarding[it.onboarding_id] = itensPorOnboarding[it.onboarding_id] || []).push(it);
      });
    }

    onboardings = (registros || []).map((r) => ({ ...r, _itensResumo: itensPorOnboarding[r.id] || [] }));
    renderListaOnboardings();
  }

  function progressoDe(itensResumo) {
    const total = itensResumo.length;
    const concluidos = itensResumo.filter((i) => STATUS_CONCLUIDOS.includes(i.status)).length;
    return total ? Math.round((concluidos / total) * 100) : 0;
  }

  // ─── SIDEBAR: LISTA ─────────────────────────────────────────

  function renderListaOnboardings() {
    const nav = document.getElementById('listaOnboardings');
    const termo = (document.getElementById('buscaOnboarding').value || '').toLowerCase().trim();

    const filtrados = termo
      ? onboardings.filter((o) => (o.razao_social || '').toLowerCase().includes(termo) || (o.codigo_empresa || '').toLowerCase().includes(termo))
      : onboardings;

    if (!filtrados.length) {
      nav.innerHTML = '<p class="nav-empty">Nenhum onboarding encontrado.</p>';
      return;
    }

    nav.innerHTML = '';
    filtrados.forEach((o) => {
      const pct = progressoDe(o._itensResumo);
      const btn = document.createElement('button');
      btn.className = 'nav-onboarding-btn' + (o.id === onboardingAtualId ? ' active' : '') + (o.status === 'concluido' ? ' status-concluido' : '');
      btn.innerHTML = `
        <span class="nav-onboarding-empresa">${escapeHtml(o.razao_social)}</span>
        <div class="nav-onboarding-bar"><div class="nav-onboarding-bar-fill" style="width:${pct}%"></div></div>
        <span class="nav-onboarding-meta"><span>${escapeHtml(o.codigo_empresa)}</span><span>${pct}%</span></span>
      `;
      btn.addEventListener('click', () => selecionarOnboarding(o.id));
      nav.appendChild(btn);
    });
  }

  // ─── FORM: NOVO ONBOARDING ──────────────────────────────────

  function abrirFormNovoOnboarding() {
    onboardingAtualId = null;
    renderListaOnboardings();

    const main = document.getElementById('main');
    const opcoesRegime = REGIMES.map((r) => `<option value="${r.valor}">${r.label}</option>`).join('');
    const gatilhosHtml = GATILHOS.map((g) => `
      <div class="gatilho-item">
        <label for="gat_${g.campo}">${g.label}</label>
        <label class="switch">
          <input type="checkbox" id="gat_${g.campo}" data-campo="${g.campo}">
          <span class="slider"></span>
        </label>
      </div>
    `).join('');

    main.innerHTML = `
      <div class="onboarding-header">
        <div>
          <h2>Novo Onboarding</h2>
          <p class="meta">Levantamento de documentos e informações para o balanço inicial</p>
        </div>
      </div>

      <div class="card">
        <h3>Dados cadastrais</h3>
        <p class="card-sub" id="dadosCadastraisSub">Empresa deve já estar cadastrada em rh_empresas.</p>
        <div class="empresa-nova-toggle">
          <label class="switch">
            <input type="checkbox" id="chkEmpresaNova">
            <span class="slider"></span>
          </label>
          <span>Empresa nova (ainda não cadastrada em rh_empresas)</span>
        </div>
        <div class="form-grid">
          <div class="form-group" id="grupoEmpresa"></div>
          <div class="form-group">
            <label for="novoCnpj">CNPJ</label>
            <input type="text" id="novoCnpj" placeholder="00.000.000/0000-00">
          </div>
          <div class="form-group">
            <label for="novoDataCorte">Data de corte do balanço inicial</label>
            <input type="date" id="novoDataCorte">
          </div>
          <div class="form-group">
            <label for="novoRegime">Regime tributário</label>
            <select id="novoRegime">
              <option value="">Selecione...</option>
              ${opcoesRegime}
            </select>
          </div>
          <div class="form-group">
            <label for="novoResponsavel">Responsável SCONT</label>
            <input type="text" id="novoResponsavel" value="${escapeAttr(usuarioAtual?.userData?.nome || '')}">
          </div>
          <div class="form-group">
            <label for="novoDataInicio">Data de início do levantamento</label>
            <input type="date" id="novoDataInicio" value="${new Date().toISOString().slice(0, 10)}">
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Perguntas-gatilho</h3>
        <p class="card-sub">Definem quais seções e itens do checklist serão gerados (Anexo I).</p>
        <div class="gatilhos-grid">${gatilhosHtml}</div>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" id="btnCancelarNovo">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvarNovo">Gerar checklist</button>
      </div>
    `;

    renderGrupoEmpresa(false);
    document.getElementById('chkEmpresaNova').addEventListener('change', (e) => renderGrupoEmpresa(e.target.checked));

    document.getElementById('btnCancelarNovo').addEventListener('click', () => {
      document.getElementById('main').innerHTML = '';
      renderEmptyState();
    });
    document.getElementById('btnSalvarNovo').addEventListener('click', salvarNovoOnboarding);
  }

  function renderGrupoEmpresa(empresaNova) {
    const grupo = document.getElementById('grupoEmpresa');
    const sub = document.getElementById('dadosCadastraisSub');
    if (sub) {
      sub.textContent = empresaNova
        ? 'Empresa ainda não cadastrada — será criada em rh_empresas ao gerar o checklist.'
        : 'Empresa deve já estar cadastrada em rh_empresas.';
    }

    if (empresaNova) {
      grupo.classList.add('full');
      grupo.innerHTML = `
        <label>Empresa nova</label>
        <div class="empresa-nova-campos">
          <input type="text" id="novoCodigoEmpresa" class="campo-codigo" placeholder="Código">
          <input type="text" id="novoNomeEmpresa" placeholder="Nome da empresa (razão social)">
        </div>
      `;
    } else {
      grupo.classList.remove('full');
      const opcoesEmpresa = empresas.map((e) => `<option value="${escapeAttr(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</option>`).join('');
      grupo.innerHTML = `
        <label for="novoEmpresa">Empresa</label>
        <select id="novoEmpresa">
          <option value="">Selecione...</option>
          ${opcoesEmpresa}
        </select>
      `;
      document.getElementById('novoEmpresa').addEventListener('change', (e) => {
        const emp = empresas.find((x) => x.codigo_empresa === e.target.value);
        document.getElementById('novoCnpj').value = emp?.cnpj || '';
      });
    }
  }

  async function salvarNovoOnboarding() {
    const empresaNova = document.getElementById('chkEmpresaNova').checked;
    const regime = document.getElementById('novoRegime').value;
    if (!regime) { mostrarToast('Selecione o regime tributário.', 'erro'); return; }

    let codigoEmpresa, nomeEmpresa;
    if (empresaNova) {
      codigoEmpresa = document.getElementById('novoCodigoEmpresa').value.trim();
      nomeEmpresa = document.getElementById('novoNomeEmpresa').value.trim();
      if (!codigoEmpresa || !nomeEmpresa) { mostrarToast('Preencha o código e o nome da nova empresa.', 'erro'); return; }
      if (empresas.some((e) => e.codigo_empresa.toLowerCase() === codigoEmpresa.toLowerCase())) {
        mostrarToast('Já existe uma empresa com esse código. Desmarque "Empresa nova" e selecione-a na lista.', 'erro');
        return;
      }
    } else {
      codigoEmpresa = document.getElementById('novoEmpresa').value;
      if (!codigoEmpresa) { mostrarToast('Selecione a empresa.', 'erro'); return; }
      nomeEmpresa = (empresas.find((x) => x.codigo_empresa === codigoEmpresa) || {}).nome_empresa || codigoEmpresa;
    }

    const respostas = { regime_tributario: regime };
    GATILHOS.forEach((g) => { respostas[g.campo] = document.getElementById(`gat_${g.campo}`).checked; });
    const cnpjInformado = document.getElementById('novoCnpj').value || null;

    const btn = document.getElementById('btnSalvarNovo');
    btn.disabled = true;
    btn.textContent = 'Gerando...';

    try {
      if (empresaNova) {
        const { data: novaEmpresa, error: errEmpresa } = await supabaseClient
          .from('rh_empresas')
          .insert({ codigo_empresa: codigoEmpresa, nome_empresa: nomeEmpresa, cnpj: cnpjInformado, status_situacao: 'Ativo' })
          .select()
          .single();
        if (errEmpresa) throw errEmpresa;
        empresas.push(novaEmpresa);
        empresas.sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa));
      }

      const { data: onboarding, error } = await supabaseClient
        .from('contabil_onboardings')
        .insert({
          codigo_empresa: codigoEmpresa,
          razao_social: nomeEmpresa,
          cnpj: cnpjInformado,
          data_corte: document.getElementById('novoDataCorte').value || null,
          regime_tributario: regime,
          responsavel_scont: document.getElementById('novoResponsavel').value || null,
          data_inicio: document.getElementById('novoDataInicio').value || new Date().toISOString().slice(0, 10),
          ...respostas,
        })
        .select()
        .single();
      if (error) throw error;

      const itensGerados = window.gerarItensOnboarding(respostas).map((it) => ({
        onboarding_id: onboarding.id,
        ...it,
      }));
      if (itensGerados.length) {
        const { error: errItens } = await supabaseClient.from('contabil_onboarding_itens').insert(itensGerados);
        if (errItens) throw errItens;
      }

      mostrarToast('Onboarding criado com sucesso.', 'sucesso');
      await carregarOnboardings();
      selecionarOnboarding(onboarding.id);
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao criar onboarding: ' + err.message, 'erro');
      btn.disabled = false;
      btn.textContent = 'Gerar checklist';
    }
  }

  // ─── DETALHE: CHECKLIST + VALIDAÇÃO INTERNA ────────────────

  async function selecionarOnboarding(id) {
    onboardingAtualId = id;
    abaAtual = 'checklist';
    renderListaOnboardings();
    await renderDetalheOnboarding();
  }

  async function renderDetalheOnboarding() {
    const main = document.getElementById('main');
    main.innerHTML = '<p style="color:var(--muted)">Carregando...</p>';

    const { data: onboarding, error } = await supabaseClient
      .from('contabil_onboardings')
      .select('*')
      .eq('id', onboardingAtualId)
      .single();
    if (error) { console.error(error); mostrarToast('Erro ao carregar onboarding.', 'erro'); return; }

    const { data: itens, error: errItens } = await supabaseClient
      .from('contabil_onboarding_itens')
      .select('*')
      .eq('onboarding_id', onboardingAtualId)
      .order('item_codigo', { ascending: true });
    if (errItens) { console.error(errItens); mostrarToast('Erro ao carregar itens.', 'erro'); return; }

    const itensChecklist = itens.filter((i) => i.secao !== 'H');
    const itensInternos = itens.filter((i) => i.secao === 'H');
    const pctGeral = progressoDe(itens);
    const regimeLabel = (REGIMES.find((r) => r.valor === onboarding.regime_tributario) || {}).label || onboarding.regime_tributario;

    main.innerHTML = `
      <div class="onboarding-header">
        <div>
          <h2>${escapeHtml(onboarding.razao_social)}</h2>
          <span class="tag">${escapeHtml(regimeLabel || '')}</span>
          <span class="tag">${escapeHtml(onboarding.codigo_empresa)}</span>
          <p class="meta">Responsável: ${escapeHtml(onboarding.responsavel_scont || '—')} · Data de corte: ${formatarData(onboarding.data_corte)} · Início: ${formatarData(onboarding.data_inicio)}</p>
        </div>
        <div class="onboarding-header-actions">
          <div class="onboarding-progresso-geral">
            <small>Progresso geral</small>
            <span class="num">${pctGeral}%</span>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${pctGeral}%"></div></div>
          </div>
          <button class="btn btn-danger" id="btnExcluirOnboarding" title="Excluir onboarding">🗑 Excluir</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn ${abaAtual === 'checklist' ? 'active' : ''}" data-aba="checklist">Checklist (Seções A-G)</button>
        <button class="tab-btn ${abaAtual === 'interna' ? 'active' : ''}" data-aba="interna">Validação Interna (Seção H)</button>
      </div>

      <div id="abaConteudo"></div>
    `;

    main.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => {
      abaAtual = b.dataset.aba;
      main.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('active', x === b));
      renderConteudoAba(onboarding, abaAtual === 'checklist' ? itensChecklist : itensInternos);
    }));

    document.getElementById('btnExcluirOnboarding').addEventListener('click', () => excluirOnboarding(onboarding));

    renderConteudoAba(onboarding, abaAtual === 'checklist' ? itensChecklist : itensInternos);
  }

  async function excluirOnboarding(onboarding) {
    if (!confirm(`Excluir o onboarding de "${onboarding.razao_social}"? Esta ação não pode ser desfeita.`)) return;

    const { error } = await supabaseClient.from('contabil_onboardings').delete().eq('id', onboarding.id);
    if (error) { console.error(error); mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }

    mostrarToast('Onboarding excluído.', 'sucesso');
    onboardingAtualId = null;
    document.getElementById('main').innerHTML = '';
    renderEmptyState();
    await carregarOnboardings();
  }

  function renderConteudoAba(onboarding, itensDaAba) {
    const container = document.getElementById('abaConteudo');
    if (!itensDaAba.length) {
      container.innerHTML = '<p style="color:var(--muted)">Nenhum item nesta seção para as respostas informadas.</p>';
      return;
    }

    const porSecao = {};
    itensDaAba.forEach((it) => { (porSecao[it.secao] = porSecao[it.secao] || []).push(it); });

    container.innerHTML = Object.keys(porSecao).sort().map((secao) => {
      const itensSecao = porSecao[secao];
      const pct = progressoDe(itensSecao);
      const titulo = SECAO_TITULOS[secao] || `Seção ${secao}`;
      return `
        <div class="secao-bloco" data-secao="${secao}">
          <div class="secao-bloco-header">
            <h4>${escapeHtml(titulo)}</h4>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
              <span class="progress-label">${pct}%</span>
            </div>
          </div>
          <div class="itens-lista">
            ${itensSecao.map((it) => renderItemLinhaHtml(it, onboarding)).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-item-id]').forEach((el) => ligarEventosItem(el, onboarding));
  }

  function renderItemLinhaHtml(item, onboarding) {
    const semUpload = item.secao === 'H';
    return `
      <div class="item-linha" data-item-id="${item.id}" data-secao="${item.secao}" data-arquivo-url="${escapeAttr(item.arquivo_url || '')}">
        <div class="item-info">
          <div class="item-texto">${escapeHtml(item.item_texto)}</div>
          <div class="item-badges">
            <span class="badge badge-${item.exigencia}">${item.exigencia === 'obrigatorio' ? 'Obrigatório' : 'Condicional'}</span>
          </div>
          ${item.observacao_catalogo ? `<div class="item-ajuda">💡 ${escapeHtml(item.observacao_catalogo)}</div>` : ''}
        </div>
        <select class="status-select status-${item.status}" data-field="status">
          ${Object.keys(STATUS_LABELS).map((s) => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
        <div class="item-arquivo">
          ${semUpload ? '' : `
            <label class="btn-upload">
              📎 ${item.arquivo_nome ? 'Substituir' : 'Enviar arquivo'}
              <input type="file" data-field="upload" style="display:none">
            </label>
            ${item.arquivo_url ? `<a href="#" class="arquivo-link" data-field="ver-arquivo">${escapeHtml(item.arquivo_nome || 'ver arquivo')}</a>` : ''}
          `}
        </div>
        <button class="btn-obs ${item.observacao ? 'tem-obs' : ''}" data-field="observacao" data-obs-atual="${escapeAttr(item.observacao || '')}" title="Observação">📝</button>
      </div>
    `;
  }

  function ligarEventosItem(el, onboarding) {
    const itemId = el.dataset.itemId;

    el.querySelector('[data-field="status"]').addEventListener('change', (e) => {
      atualizarItem(itemId, { status: e.target.value });
    });

    const inputUpload = el.querySelector('[data-field="upload"]');
    if (inputUpload) {
      inputUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) fazerUploadItem(itemId, file, el, onboarding);
      });
    }

    const linkVer = el.querySelector('[data-field="ver-arquivo"]');
    if (linkVer) {
      linkVer.addEventListener('click', async (e) => {
        e.preventDefault();
        abrirArquivo(el.dataset.arquivoUrl);
      });
    }

    el.querySelector('[data-field="observacao"]').addEventListener('click', () => abrirModalObservacao(itemId));
  }

  async function fazerUploadItem(itemId, file, el, onboarding) {
    const btnLabel = el.querySelector('.btn-upload');
    const textoOriginal = btnLabel.innerHTML;
    btnLabel.innerHTML = 'Enviando...';

    try {
      const secao = el.dataset.secao;
      const nomeArquivo = `${itemId}_${file.name}`.replace(/\s+/g, '_');
      const caminho = `onboarding-contabil/${onboarding.codigo_empresa}/${secao}/${nomeArquivo}`;

      const { error: errUpload } = await supabaseClient.storage.from(BUCKET).upload(caminho, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: true,
      });
      if (errUpload) throw errUpload;

      await atualizarItem(itemId, {
        arquivo_url: caminho,
        arquivo_nome: file.name,
        status: 'enviado',
      });

      mostrarToast('Arquivo enviado.', 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao enviar arquivo: ' + err.message, 'erro');
    } finally {
      btnLabel.innerHTML = textoOriginal;
    }
  }

  async function abrirArquivo(caminho) {
    if (!caminho) return;
    const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrl(caminho, 60);
    if (error) { console.error(error); mostrarToast('Erro ao abrir arquivo.', 'erro'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function atualizarItem(itemId, campos) {
    const payload = {
      ...campos,
      atualizado_por: usuarioAtual?.userData?.nome || usuarioAtual?.email || null,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabaseClient.from('contabil_onboarding_itens').update(payload).eq('id', itemId);
    if (error) { console.error(error); mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }

    await Promise.all([carregarOnboardings(), recarregarAbaAtual()]);
  }

  async function recarregarAbaAtual() {
    if (!onboardingAtualId) return;
    const { data: onboarding } = await supabaseClient.from('contabil_onboardings').select('*').eq('id', onboardingAtualId).single();
    const { data: itens } = await supabaseClient.from('contabil_onboarding_itens').select('*').eq('onboarding_id', onboardingAtualId).order('item_codigo', { ascending: true });
    if (!onboarding || !itens) return;

    const pctGeral = progressoDe(itens);
    const numEl = document.querySelector('.onboarding-progresso-geral .num');
    const barEl = document.querySelector('.onboarding-progresso-geral .progress-bar-fill');
    if (numEl) numEl.textContent = `${pctGeral}%`;
    if (barEl) barEl.style.width = `${pctGeral}%`;

    const itensDaAba = itens.filter((i) => (abaAtual === 'checklist' ? i.secao !== 'H' : i.secao === 'H'));
    renderConteudoAba(onboarding, itensDaAba);
  }

  // ─── MODAL: OBSERVAÇÃO ──────────────────────────────────────

  function abrirModalObservacao(itemId) {
    itemObsAberto = itemId;
    let modal = document.getElementById('modalObservacao');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalObservacao';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Observação da equipe</h3>
            <button class="modal-close" id="fecharModalObs">✕</button>
          </div>
          <div class="modal-body">
            <textarea id="obsTexto" rows="5" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelarObs">Cancelar</button>
            <button class="btn btn-primary" id="salvarObs">Salvar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('fecharModalObs').addEventListener('click', fecharModalObservacao);
      document.getElementById('cancelarObs').addEventListener('click', fecharModalObservacao);
      document.getElementById('salvarObs').addEventListener('click', salvarObservacao);
    }

    const el = document.querySelector(`[data-item-id="${itemId}"]`);
    const btnObs = el?.querySelector('[data-field="observacao"]');
    document.getElementById('obsTexto').value = btnObs?.dataset.obsAtual || '';
    modal.classList.add('active');
  }

  function fecharModalObservacao() {
    document.getElementById('modalObservacao')?.classList.remove('active');
    itemObsAberto = null;
  }

  async function salvarObservacao() {
    const texto = document.getElementById('obsTexto').value.trim();
    await atualizarItem(itemObsAberto, { observacao: texto || null });
    fecharModalObservacao();
  }

  // ─── UTIL ───────────────────────────────────────────────────

  function renderEmptyState() {
    document.getElementById('main').innerHTML = `
      <div class="empty-state">
        <div class="emoji">🧾</div>
        <h2>Onboarding Contábil</h2>
        <p>Selecione um onboarding na lista ao lado, ou clique em "Novo Onboarding" para iniciar o levantamento de uma empresa.</p>
      </div>
    `;
  }

  function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return dia ? `${dia}/${mes}/${ano}` : iso;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

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
})();
