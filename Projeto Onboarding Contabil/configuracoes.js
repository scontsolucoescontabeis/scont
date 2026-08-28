(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let empresas = []; // [{ codigo_empresa, nome_empresa }] — TODAS as ativas (o editor de grupos precisa da lista completa)
  let unidadesContabil = []; // empresas avulsas + uma entrada por grupo contábil ('grupo-<id>') — usada na tabela "Empresas com Contábil" e no vínculo de responsáveis
  let configPorEmpresa = {}; // { codigo_empresa: boolean } — espelha o que já está salvo no banco
  let usuariosAprovados = []; // [{ id, nome, email, empresa }]
  let responsaveisPorEmpresa = {}; // { codigo_empresa: Set<usuario_id> }
  let emailAlertaValidacao = '';
  let notificacoesEventos = {}; // { <coluna>: boolean } — ver EVENTOS_EMAIL

  // Eventos do Diário Contábil que hoje disparam e-mail, com o toggle
  // correspondente em contabil_config_geral (todas as colunas default TRUE).
  const EVENTOS_EMAIL = [
    { coluna: 'notificar_validacao_fechamento', label: 'Fechamento enviado para validação' },
    { coluna: 'notificar_fechamento_aprovado', label: 'Fechamento aprovado' },
    { coluna: 'notificar_fechamento_rejeitado', label: 'Fechamento rejeitado' },
    { coluna: 'notificar_pendencia_execucao', label: 'Pendência de execução criada' },
    { coluna: 'notificar_pendencia_resolvida', label: 'Pendência de execução sanada' },
    { coluna: 'notificar_documentacao_disponivel', label: 'Documentação disponível marcada' },
  ];

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;

    // Tela de Configurações não é visível para "Prestador de Serviço" —
    // ele só tem acesso ao Diário Contábil.
    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    if (!auth.isAdmin && empresaUsuario === 'prestador de serviço') {
      window.location.href = 'diario.html';
      return;
    }

    document.getElementById('authOverlay')?.remove();

    await carregarDados();
    document.querySelectorAll('#configNav .sidebar-item[data-tela]').forEach((btn) => {
      btn.addEventListener('click', () => mostrarTela(btn.getAttribute('data-tela')));
    });
    mostrarTela('empresas');
    sincronizarMapeamentoTodasEmpresas();
  }

  async function carregarDados() {
    const [
      { data: dataEmpresas, error: errEmpresas },
      { data: dataConfig, error: errConfig },
      { data: dataUsuarios, error: errUsuarios },
      { data: dataResponsaveis, error: errResponsaveis },
      { data: dataConfigGeral, error: errConfigGeral },
    ] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao, regime_enquadramento').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
      supabaseClient.rpc('contabil_listar_usuarios_aprovados'),
      supabaseClient.from('contabil_empresas_responsaveis').select('codigo_empresa, usuario_id'),
      supabaseClient.from('contabil_config_geral').select(`email_alerta_validacao, ${EVENTOS_EMAIL.map((ev) => ev.coluna).join(', ')}`).eq('id', 1).maybeSingle(),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errConfig) console.error(errConfig);
    if (errUsuarios) console.error(errUsuarios);
    if (errResponsaveis) console.error(errResponsaveis);
    if (errConfigGeral) console.error(errConfigGeral);

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao));
    await window.ContabilGrupos.carregar(supabaseClient);
    unidadesContabil = window.ContabilGrupos.montarUnidades(empresas, empresas);

    configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });

    usuariosAprovados = dataUsuarios || [];

    responsaveisPorEmpresa = {};
    (dataResponsaveis || []).forEach((r) => {
      if (!responsaveisPorEmpresa[r.codigo_empresa]) responsaveisPorEmpresa[r.codigo_empresa] = new Set();
      responsaveisPorEmpresa[r.codigo_empresa].add(r.usuario_id);
    });

    emailAlertaValidacao = dataConfigGeral?.email_alerta_validacao || '';
    notificacoesEventos = {};
    EVENTOS_EMAIL.forEach((ev) => { notificacoesEventos[ev.coluna] = dataConfigGeral?.[ev.coluna] !== false; });
  }

  async function salvarEmailAlertaValidacao(valor) {
    const { error } = await supabaseClient
      .from('contabil_config_geral')
      .upsert({ id: 1, email_alerta_validacao: valor, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (!error) emailAlertaValidacao = valor;
    return { error };
  }

  async function salvarToggleEvento(coluna, valor) {
    const { error } = await supabaseClient
      .from('contabil_config_geral')
      .upsert({ id: 1, [coluna]: valor, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (!error) notificacoesEventos[coluna] = valor;
    return { error };
  }

  function possuiContabil(codigoEmpresa) {
    return configPorEmpresa[codigoEmpresa] !== false;
  }

  function responsaveisDe(codigoEmpresa) {
    const ids = responsaveisPorEmpresa[codigoEmpresa];
    if (!ids || !ids.size) return [];
    return usuariosAprovados.filter((u) => ids.has(u.id));
  }

  function nomesResponsaveisTexto(codigoEmpresa) {
    return responsaveisDe(codigoEmpresa).map((u) => u.nome).join(', ');
  }

  // ─── SINCRONIZAÇÃO COM O MAPEAMENTO ESTRATÉGICO ─────────────
  // O responsável (daqui) e o regime tributário (de rh_empresas) são
  // replicados para contabil_mapeamento.responsavel_execucao /
  // .regime_tributario, sempre sobrescrevendo — Configurações é a fonte da
  // verdade para os dois campos. Se alguém editar esses 2 campos direto no
  // Mapeamento Estratégico, a próxima sincronização (responsável mudar aqui,
  // ou esta tela recarregar) sobrescreve de novo — comportamento esperado,
  // não um bug.

  function normalizarRegimeTributario(textoLivre) {
    const v = String(textoLivre ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    if (!v) return null;
    if (v.includes('simples')) return 'simples_nacional';
    if (v.includes('presumido')) return 'lucro_presumido';
    if (v.includes('real')) return 'lucro_real';
    // Nesta base, MEI costuma estar cadastrado em rh_empresas como "Microempresa".
    if (v.includes('mei') || v.includes('microempresa')) return 'mei';
    return null;
  }

  async function syncMapeamentoEmpresa(codigoEmpresa) {
    const empresa = empresas.find((e) => e.codigo_empresa === codigoEmpresa)
      || unidadesContabil.find((e) => e.codigo_empresa === codigoEmpresa);
    const payload = { codigo_empresa: codigoEmpresa, responsavel_execucao: nomesResponsaveisTexto(codigoEmpresa) };
    const regime = normalizarRegimeTributario(empresa?.regime_enquadramento);
    if (regime) payload.regime_tributario = regime;
    const { error } = await supabaseClient
      .from('contabil_mapeamento')
      .upsert(payload, { onConflict: 'codigo_empresa' });
    if (error) console.error('Erro ao sincronizar Mapeamento Estratégico:', error);
  }

  async function sincronizarMapeamentoTodasEmpresas() {
    const comRegime = [];
    const semRegime = [];
    unidadesContabil.forEach((e) => {
      const regime = normalizarRegimeTributario(e.regime_enquadramento);
      const responsavel_execucao = nomesResponsaveisTexto(e.codigo_empresa);
      if (regime) comRegime.push({ codigo_empresa: e.codigo_empresa, regime_tributario: regime, responsavel_execucao });
      else semRegime.push({ codigo_empresa: e.codigo_empresa, responsavel_execucao });
    });

    if (comRegime.length) {
      const { error } = await supabaseClient.from('contabil_mapeamento').upsert(comRegime, { onConflict: 'codigo_empresa' });
      if (error) console.error('Erro ao sincronizar regime tributário no Mapeamento Estratégico:', error);
    }
    if (semRegime.length) {
      const { error } = await supabaseClient.from('contabil_mapeamento').upsert(semRegime, { onConflict: 'codigo_empresa' });
      if (error) console.error('Erro ao sincronizar responsável de execução no Mapeamento Estratégico:', error);
    }
  }

  // ─── PERSISTÊNCIA ───────────────────────────────────────────

  async function salvarLote(registros) {
    if (!registros.length) return { error: null };
    const { error } = await supabaseClient
      .from('contabil_empresas_config')
      .upsert(registros, { onConflict: 'codigo_empresa' });
    if (!error) registros.forEach((r) => { configPorEmpresa[r.codigo_empresa] = r.possui_contabil; });
    return { error };
  }

  async function salvarResponsavel(codigoEmpresa, usuarioId, marcado) {
    if (marcado) {
      const { error } = await supabaseClient
        .from('contabil_empresas_responsaveis')
        .insert([{ codigo_empresa: codigoEmpresa, usuario_id: usuarioId }]);
      if (error) return { error };
      if (!responsaveisPorEmpresa[codigoEmpresa]) responsaveisPorEmpresa[codigoEmpresa] = new Set();
      responsaveisPorEmpresa[codigoEmpresa].add(usuarioId);
    } else {
      const { error } = await supabaseClient
        .from('contabil_empresas_responsaveis')
        .delete()
        .eq('codigo_empresa', codigoEmpresa)
        .eq('usuario_id', usuarioId);
      if (error) return { error };
      responsaveisPorEmpresa[codigoEmpresa]?.delete(usuarioId);
    }
    syncMapeamentoEmpresa(codigoEmpresa);
    return { error: null };
  }

  // ─── NAVEGAÇÃO ENTRE TELAS ──────────────────────────────────
  // O sidebar tem 3 telas independentes; cada uma renderiza só o seu
  // conteúdo em #main e liga os próprios eventos. Modais (responsáveis,
  // atribuir por usuário) vivem no <body> e sobrevivem à troca de tela.

  let telaAtual = 'empresas';

  function mostrarTela(id) {
    telaAtual = id;
    document.querySelectorAll('#configNav .sidebar-item[data-tela]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tela') === id);
    });
    if (id === 'email') renderTelaEmail();
    else if (id === 'grupos') renderTelaGrupos();
    else renderTelaEmpresas();
  }

  function abrirMain(titulo, corpoHtml) {
    const main = document.getElementById('main');
    main.classList.add('main-full');
    main.innerHTML = `
      <div class="onboarding-header"><div><h2>${escapeHtml(titulo)}</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-body">${corpoHtml}</div>
      </div>
    `;
  }

  // ─── TELA: ALERTAS POR E-MAIL ───────────────────────────────

  function renderTelaEmail() {
    abrirMain('Alertas por E-mail', `
      <p class="full mapa-empty" style="margin-bottom:4px;">E-mail(is) que recebem um alerta sempre que um fechamento mensal é enviado para validação no Diário Contábil. Separe vários e-mails por vírgula.</p>
      <div class="full mapa-filtros">
        <input type="text" id="inputEmailAlertaValidacao" placeholder="ex: herbertscont@gmail.com" style="flex:1;min-width:260px;" value="${escapeAttr(emailAlertaValidacao)}">
        <button type="button" class="btn btn-primary" id="btnSalvarEmailAlerta">Salvar</button>
      </div>
      <p class="full mapa-empty" style="margin:16px 0 4px;">Escolha quais desses eventos disparam e-mail. Desmarcar um evento não afeta os demais; a alteração é salva ao clicar.</p>
      <div class="full" id="listaEventosEmail">
        ${EVENTOS_EMAIL.map((ev) => `
          <label class="responsavel-check-item">
            <input type="checkbox" class="chk-evento-email" data-coluna="${escapeAttr(ev.coluna)}" ${notificacoesEventos[ev.coluna] !== false ? 'checked' : ''}>
            <span>${escapeHtml(ev.label)}</span>
          </label>
        `).join('')}
      </div>
    `);

    document.getElementById('btnSalvarEmailAlerta').addEventListener('click', async () => {
      const btn = document.getElementById('btnSalvarEmailAlerta');
      const valor = document.getElementById('inputEmailAlertaValidacao').value.trim();
      btn.disabled = true;
      const { error } = await salvarEmailAlertaValidacao(valor);
      btn.disabled = false;
      if (error) { console.error(error); mostrarToast('Erro ao salvar o e-mail de alerta.', 'erro'); return; }
      mostrarToast('E-mail de alerta salvo.', 'sucesso');
    });

    document.getElementById('listaEventosEmail').querySelectorAll('.chk-evento-email').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const coluna = chk.getAttribute('data-coluna');
        const valor = chk.checked;
        chk.disabled = true;
        const { error } = await salvarToggleEvento(coluna, valor);
        chk.disabled = false;
        if (error) {
          console.error(error);
          chk.checked = !valor;
          mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
          return;
        }
        mostrarToast('Configuração de e-mail salva.', 'sucesso');
      });
    });
  }

  // ─── TELA: EMPRESAS COM CONTÁBIL ────────────────────────────

  function renderTelaEmpresas() {
    // Reflete alterações de composição de grupos feitas na subtela ao lado.
    unidadesContabil = window.ContabilGrupos.montarUnidades(empresas, empresas);
    abrirMain('Empresas com Contábil', `
      <p class="full mapa-empty" style="margin-bottom:4px;">Marque as empresas que possuem contábil na Scont. Somente as marcadas aqui aparecem nos seletores e filtros do Onboarding e do Diário Contábil. As alterações são salvas automaticamente. Grupos marcados em "Grupos de Empresas" aparecem como uma linha só (👥) e são tratados como uma unidade no Diário.</p>
      <div class="full mapa-filtros">
        <input type="text" id="buscaEmpresaConfig" placeholder="Buscar empresa...">
        <button type="button" class="btn btn-secondary" id="btnMarcarTodas">Marcar todas</button>
        <button type="button" class="btn btn-secondary" id="btnDesmarcarTodas">Desmarcar todas</button>
        <button type="button" class="btn btn-secondary" id="btnImportarPlanilha">📊 Importar planilha</button>
        <button type="button" class="btn btn-secondary" id="btnResponsavelPorUsuario">👤 Atribuir por usuário</button>
        <input type="file" id="fileImportarConfig" accept=".xlsx,.xls,.csv" style="display:none">
      </div>
      <p class="full mapa-empty" id="contadorEmpresasConfig"></p>
      <table class="mapa-table full">
        <thead><tr><th>Código Empresa</th><th>Nome Empresa</th><th>Contabilidade</th><th>Responsável(is)</th></tr></thead>
        <tbody id="corpoTabelaConfig"></tbody>
      </table>
    `);

    document.getElementById('buscaEmpresaConfig').addEventListener('input', renderTabela);
    document.getElementById('btnMarcarTodas').addEventListener('click', () => alternarVisiveis(true));
    document.getElementById('btnDesmarcarTodas').addEventListener('click', () => alternarVisiveis(false));
    document.getElementById('btnImportarPlanilha').addEventListener('click', () => document.getElementById('fileImportarConfig').click());
    document.getElementById('fileImportarConfig').addEventListener('change', handleImportarPlanilha);
    document.getElementById('btnResponsavelPorUsuario').addEventListener('click', abrirModalResponsavelPorUsuario);

    renderTabela();
  }

  // ─── TELA: GRUPOS DE EMPRESAS ───────────────────────────────

  function renderTelaGrupos() {
    abrirMain('Grupos de Empresas', `
      <p class="full mapa-empty" style="margin-bottom:4px;">Grupos de empresas compartilhados com o Controle de Frequência do RH — criar ou editar aqui reflete lá. Marque "Utilizar este grupo no Departamento Contábil" nos grupos que devem aparecer como filtro no Mapeamento Estratégico, nos Relatórios, na Visão Geral do Diário e no Onboarding.</p>
      <div class="full" style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-primary" id="btnNovoGrupoConfig">➕ Novo Grupo</button>
      </div>
      <div class="full" style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;">
        <div style="flex:0 0 240px; border:1px solid var(--line-soft); border-radius:8px; overflow:hidden;">
          <div id="listaGruposConfig"></div>
        </div>
        <div style="flex:1 1 380px; border:1px solid var(--line-soft); border-radius:8px; padding:14px;" id="grupoDetalheConfig"></div>
      </div>
    `);

    document.getElementById('btnNovoGrupoConfig').addEventListener('click', novoGrupoConfig);

    renderListaGruposConfig();
    renderGrupoDetalheConfig();
  }

  // ─── GRUPOS DE EMPRESAS ─────────────────────────────────────
  // Tabela compartilhada com o Controle de Frequência do RH
  // (rh_grupos_empresas / rh_grupos_empresas_itens). O flag por grupo
  // "usar no contábil" fica em contabil_grupos_config (via ContabilGrupos).

  let grupoConfigAtual = null; // { id, nome_grupo, observacoes, email_responsavel, usarContabil, empresas:[{codigo_empresa, nome_empresa}] }
  let _listenerFechaResultadosGrupo = false;

  function nomeEmpresaPorCodigo(codigo) {
    const e = empresas.find((x) => x.codigo_empresa === codigo);
    return e ? e.nome_empresa : codigo;
  }

  function renderListaGruposConfig() {
    const container = document.getElementById('listaGruposConfig');
    if (!container) return;
    const grupos = window.ContabilGrupos.todos();
    if (!grupos.length) {
      container.innerHTML = '<div style="padding:12px; color:var(--muted); font-size:13px;">Nenhum grupo cadastrado.</div>';
      return;
    }
    container.innerHTML = grupos.map((g) => `
      <div data-grupo-id="${escapeAttr(g.id)}"
        style="padding:9px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--line-soft); display:flex; justify-content:space-between; gap:6px; ${grupoConfigAtual && grupoConfigAtual.id === g.id ? 'background:var(--surface-2); font-weight:600;' : ''}">
        <span>${escapeHtml(g.nome_grupo)}${g.usarContabil ? ' <span title="Utilizado no Departamento Contábil">✅</span>' : ''}</span>
        <span style="color:var(--muted);">(${g.empresas.size})</span>
      </div>
    `).join('');
    container.querySelectorAll('[data-grupo-id]').forEach((el) => {
      el.addEventListener('click', () => selecionarGrupoConfig(el.getAttribute('data-grupo-id')));
    });
  }

  function novoGrupoConfig() {
    grupoConfigAtual = { id: null, nome_grupo: '', observacoes: '', email_responsavel: '', usarContabil: false, empresas: [] };
    renderListaGruposConfig();
    renderGrupoDetalheConfig();
  }

  function selecionarGrupoConfig(id) {
    const g = window.ContabilGrupos.porId(id);
    if (!g) return;
    grupoConfigAtual = {
      id: g.id,
      nome_grupo: g.nome_grupo,
      observacoes: g.observacoes,
      email_responsavel: g.email_responsavel,
      usarContabil: g.usarContabil,
      empresas: Array.from(g.empresas).map((codigo) => ({ codigo_empresa: codigo, nome_empresa: nomeEmpresaPorCodigo(codigo) })),
    };
    renderListaGruposConfig();
    renderGrupoDetalheConfig();
  }

  function renderGrupoDetalheConfig() {
    const container = document.getElementById('grupoDetalheConfig');
    if (!container) return;
    if (!grupoConfigAtual) {
      container.innerHTML = '<p class="mapa-empty">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>';
      return;
    }
    const g = grupoConfigAtual;
    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <label>Nome do Grupo</label>
        <input type="text" id="grpNomeConfig" value="${escapeAttr(g.nome_grupo)}" placeholder="Ex: Grupo Shopping X">
      </div>
      <label class="responsavel-check-item" style="border:none; padding:0 0 12px;">
        <input type="checkbox" id="grpUsarContabil" ${g.usarContabil ? 'checked' : ''} ${g.id ? '' : 'disabled'}>
        <span>Utilizar este grupo no Departamento Contábil${g.id ? '' : ' <small>(salve o grupo primeiro)</small>'}</span>
      </label>
      <div style="margin-bottom:12px;">
        <label>E-mail(is) do Responsável pelo Grupo</label>
        <input type="text" id="grpEmailRespConfig" value="${escapeAttr(g.email_responsavel)}" placeholder="ex: financeiro@empresa.com, contabil@empresa.com">
      </div>
      <div style="margin-bottom:6px;">
        <label>Empresas do Grupo</label>
        <input type="text" id="grpBuscaEmpresaConfig" placeholder="Digite o nome ou código da empresa..." autocomplete="off">
      </div>
      <div id="grpResultadosConfig" style="border:1px solid var(--line-soft); border-radius:8px; margin-bottom:10px; max-height:160px; overflow-y:auto; display:none;"></div>
      <div id="grpEmpresasListConfig" style="border:1px solid var(--line-soft); border-radius:8px; overflow:hidden; margin-bottom:12px;"></div>
      <div style="margin-bottom:12px;">
        <label>Observações do Grupo</label>
        <textarea id="grpObsConfig" rows="5" placeholder="Particularidades das empresas, combinados com o cliente, exceções, prazos, etc.">${escapeHtml(g.observacoes)}</textarea>
      </div>
      <div style="display:flex; justify-content:space-between; gap:10px;">
        ${g.id ? '<button type="button" class="btn btn-secondary" id="btnExcluirGrupoConfig">🗑 Excluir Grupo</button>' : '<span></span>'}
        <button type="button" class="btn btn-primary" id="btnSalvarGrupoConfig">💾 Salvar Grupo</button>
      </div>
    `;

    document.getElementById('grpNomeConfig').addEventListener('input', (e) => { g.nome_grupo = e.target.value; });
    document.getElementById('grpEmailRespConfig').addEventListener('input', (e) => { g.email_responsavel = e.target.value; });
    document.getElementById('grpObsConfig').addEventListener('input', (e) => { g.observacoes = e.target.value; });

    const chkUsar = document.getElementById('grpUsarContabil');
    chkUsar.addEventListener('change', async () => {
      if (!g.id) return;
      const valor = chkUsar.checked;
      if (valor) {
        const conflitos = window.ContabilGrupos.gruposContabilComConflito(Array.from(g.empresas || []).map((x) => x.codigo_empresa || x), g.id);
        if (conflitos.length) {
          chkUsar.checked = false;
          mostrarToast(`Não é possível: empresa(s) deste grupo já estão no grupo contábil "${conflitos[0].nome_grupo}". Uma empresa só pode estar em um grupo contábil.`, 'erro');
          return;
        }
      }
      chkUsar.disabled = true;
      const { error } = await window.ContabilGrupos.definirUsarContabil(g.id, valor);
      chkUsar.disabled = false;
      if (error) {
        console.error(error);
        chkUsar.checked = !valor;
        mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
        return;
      }
      g.usarContabil = valor;
      renderListaGruposConfig();
      mostrarToast('Configuração do grupo salva.', 'sucesso');
    });

    const busca = document.getElementById('grpBuscaEmpresaConfig');
    busca.addEventListener('input', () => filtrarEmpresasGrupoConfig(busca.value));
    busca.addEventListener('focus', () => filtrarEmpresasGrupoConfig(busca.value));
    if (!_listenerFechaResultadosGrupo) {
      document.addEventListener('click', fecharResultadosGrupoConfigForaDoCampo);
      _listenerFechaResultadosGrupo = true;
    }

    document.getElementById('btnSalvarGrupoConfig').addEventListener('click', salvarGrupoConfig);
    const btnExcluir = document.getElementById('btnExcluirGrupoConfig');
    if (btnExcluir) btnExcluir.addEventListener('click', excluirGrupoConfig);

    renderEmpresasListGrupoConfig();
  }

  function fecharResultadosGrupoConfigForaDoCampo(ev) {
    const box = document.getElementById('grpResultadosConfig');
    const input = document.getElementById('grpBuscaEmpresaConfig');
    if (!box || !input) return;
    if (ev.target !== input && !box.contains(ev.target)) box.style.display = 'none';
  }

  function renderEmpresasListGrupoConfig() {
    const container = document.getElementById('grpEmpresasListConfig');
    if (!container) return;
    if (!grupoConfigAtual.empresas.length) {
      container.innerHTML = '<div style="padding:9px 12px; color:var(--muted); font-size:13px;">Nenhuma empresa adicionada.</div>';
      return;
    }
    container.innerHTML = grupoConfigAtual.empresas.map((e) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border-bottom:1px solid var(--line-soft); font-size:13px;">
        <span><strong>${escapeHtml(e.codigo_empresa)}</strong> — ${escapeHtml(e.nome_empresa)}</span>
        <button type="button" class="btn btn-secondary" style="padding:2px 8px; font-size:11px;" data-remover-empresa="${escapeAttr(e.codigo_empresa)}">remover</button>
      </div>
    `).join('');
    container.querySelectorAll('[data-remover-empresa]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const codigo = btn.getAttribute('data-remover-empresa');
        grupoConfigAtual.empresas = grupoConfigAtual.empresas.filter((x) => x.codigo_empresa !== codigo);
        renderEmpresasListGrupoConfig();
      });
    });
  }

  function filtrarEmpresasGrupoConfig(termo) {
    const box = document.getElementById('grpResultadosConfig');
    if (!box) return;
    const norm = (termo || '').trim().toLowerCase();
    const jaNoGrupo = new Set(grupoConfigAtual.empresas.map((e) => e.codigo_empresa));
    const lista = empresas
      .filter((e) => !jaNoGrupo.has(e.codigo_empresa))
      .filter((e) => !norm || e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
      .slice(0, 50);
    if (!lista.length) {
      box.innerHTML = '<div style="padding:9px 12px; color:var(--muted); font-size:13px;">Nenhuma empresa encontrada.</div>';
      box.style.display = 'block';
      return;
    }
    box.innerHTML = lista.map((e) => `
      <div data-add-empresa="${escapeAttr(e.codigo_empresa)}" style="padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--line-soft);">
        <span style="font-family:monospace; font-weight:600; color:var(--brand); margin-right:8px;">${escapeHtml(e.codigo_empresa)}</span>${escapeHtml(e.nome_empresa)}
      </div>
    `).join('');
    box.querySelectorAll('[data-add-empresa]').forEach((el) => {
      el.addEventListener('click', () => {
        const codigo = el.getAttribute('data-add-empresa');
        if (!grupoConfigAtual.empresas.some((x) => x.codigo_empresa === codigo)) {
          grupoConfigAtual.empresas.push({ codigo_empresa: codigo, nome_empresa: nomeEmpresaPorCodigo(codigo) });
        }
        document.getElementById('grpBuscaEmpresaConfig').value = '';
        box.style.display = 'none';
        renderEmpresasListGrupoConfig();
      });
    });
    box.style.display = 'block';
  }

  async function salvarGrupoConfig() {
    const g = grupoConfigAtual;
    if (!g || !(g.nome_grupo || '').trim()) { mostrarToast('Informe o nome do grupo.', 'erro'); return; }
    // Se o grupo é (ou está prestes a virar) contábil, nenhuma empresa dele
    // pode já estar em outro grupo contábil.
    if (g.usarContabil) {
      const conflitos = window.ContabilGrupos.gruposContabilComConflito(g.empresas.map((e) => e.codigo_empresa), g.id);
      if (conflitos.length) {
        mostrarToast(`Empresa(s) deste grupo já estão no grupo contábil "${conflitos[0].nome_grupo}". Uma empresa só pode estar em um grupo contábil.`, 'erro');
        return;
      }
    }
    const btn = document.getElementById('btnSalvarGrupoConfig');
    btn.disabled = true;
    const { id, error } = await window.ContabilGrupos.salvarGrupo({
      id: g.id,
      nome_grupo: g.nome_grupo,
      observacoes: g.observacoes,
      email_responsavel: g.email_responsavel,
      empresas: g.empresas.map((e) => e.codigo_empresa),
    });
    btn.disabled = false;
    if (error) {
      console.error(error);
      mostrarToast('Falha ao salvar o grupo: ' + error.message, 'erro');
      return;
    }
    mostrarToast('Grupo salvo.', 'sucesso');
    selecionarGrupoConfig(id);
  }

  async function excluirGrupoConfig() {
    const g = grupoConfigAtual;
    if (!g || !g.id) return;
    if (!confirm(`Excluir o grupo "${g.nome_grupo}"? Isso também remove o grupo do Controle de Frequência do RH.`)) return;
    const { error } = await window.ContabilGrupos.excluirGrupo(g.id);
    if (error) {
      console.error(error);
      mostrarToast('Falha ao excluir o grupo: ' + error.message, 'erro');
      return;
    }
    grupoConfigAtual = null;
    renderListaGruposConfig();
    renderGrupoDetalheConfig();
    mostrarToast('Grupo excluído.', 'sucesso');
  }

  function empresasVisiveis() {
    const termo = (document.getElementById('buscaEmpresaConfig').value || '').trim().toLowerCase();
    if (!termo) return unidadesContabil;
    return unidadesContabil.filter((e) => e.nome_empresa.toLowerCase().includes(termo)
      || e.codigo_empresa.toLowerCase().includes(termo)
      || (e.membros_nomes || '').toLowerCase().includes(termo));
  }

  function toggleHtml(codigoEmpresa) {
    const sim = possuiContabil(codigoEmpresa);
    return `<button type="button" class="contabil-toggle ${sim ? 'contabil-sim' : 'contabil-nao'}" data-empresa-codigo="${escapeAttr(codigoEmpresa)}" data-value="${sim}">${sim ? 'Sim' : 'Não'}</button>`;
  }

  function responsavelHtml(codigoEmpresa) {
    const nomes = responsaveisDe(codigoEmpresa).map((u) => u.nome).join(', ');
    return `
      <div class="responsavel-cel">
        <span class="responsavel-nomes">${nomes ? escapeHtml(nomes) : '—'}</span>
        <button type="button" class="btn-editar-responsavel" data-empresa-codigo="${escapeAttr(codigoEmpresa)}" title="Editar responsável(is)">✎</button>
      </div>
    `;
  }

  function renderTabela() {
    const corpo = document.getElementById('corpoTabelaConfig');
    const visiveis = empresasVisiveis();

    corpo.innerHTML = visiveis.length
      ? visiveis.map((e) => `
        <tr>
          <td>${e.is_grupo ? '👥' : escapeHtml(e.codigo_empresa)}</td>
          <td>${escapeHtml(e.nome_empresa)}${e.is_grupo ? ` <span class="mapa-empty">(grupo — ${escapeHtml(e.membros_nomes || '')})</span>` : ''}</td>
          <td>${e.is_grupo ? '<span class="contabil-badge-grupo" title="Composição definida em Grupos de Empresas">👥 Grupo</span>' : toggleHtml(e.codigo_empresa)}</td>
          <td>${responsavelHtml(e.codigo_empresa)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4">Nenhuma empresa encontrada.</td></tr>';

    corpo.querySelectorAll('.contabil-toggle').forEach((btn) => {
      btn.addEventListener('click', () => alternarUma(btn));
    });
    corpo.querySelectorAll('.btn-editar-responsavel').forEach((btn) => {
      btn.addEventListener('click', () => {
        const codigo = btn.getAttribute('data-empresa-codigo');
        const empresa = unidadesContabil.find((e) => e.codigo_empresa === codigo);
        abrirModalResponsaveis(codigo, empresa ? empresa.nome_empresa : codigo);
      });
    });

    atualizarContador();
  }

  // ─── MODAL: RESPONSÁVEIS ────────────────────────────────────

  function abrirModalResponsaveis(codigoEmpresa, nomeEmpresa) {
    let modal = document.getElementById('modalResponsaveis');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalResponsaveis';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modalResponsaveisTitulo">Responsável(is)</h3>
            <button class="modal-close" id="fecharModalResponsaveis">✕</button>
          </div>
          <div class="modal-body" id="modalResponsaveisBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="fecharModalResponsaveis2">Fechar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const fechar = () => modal.classList.remove('active');
      document.getElementById('fecharModalResponsaveis').addEventListener('click', fechar);
      document.getElementById('fecharModalResponsaveis2').addEventListener('click', fechar);
      modal.addEventListener('click', (ev) => { if (ev.target === modal) fechar(); });
    }

    document.getElementById('modalResponsaveisTitulo').textContent = `Responsável(is) — ${nomeEmpresa}`;
    renderCorpoModalResponsaveis(codigoEmpresa);
    modal.classList.add('active');
  }

  function renderCorpoModalResponsaveis(codigoEmpresa) {
    const body = document.getElementById('modalResponsaveisBody');
    if (!usuariosAprovados.length) {
      body.innerHTML = '<p class="mapa-empty">Nenhum usuário aprovado no portal.</p>';
      return;
    }
    const atuais = responsaveisPorEmpresa[codigoEmpresa] || new Set();
    body.innerHTML = usuariosAprovados.map((u) => `
      <label class="responsavel-check-item">
        <input type="checkbox" class="chk-responsavel" value="${escapeAttr(u.id)}" ${atuais.has(u.id) ? 'checked' : ''}>
        <span>${escapeHtml(u.nome)}${u.empresa ? ` <small>(${escapeHtml(u.empresa)})</small>` : ''}</span>
      </label>
    `).join('');

    body.querySelectorAll('.chk-responsavel').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const usuarioId = chk.value;
        const marcado = chk.checked;
        chk.disabled = true;
        const { error } = await salvarResponsavel(codigoEmpresa, usuarioId, marcado);
        chk.disabled = false;
        if (error) {
          console.error(error);
          chk.checked = !marcado;
          mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
          return;
        }
        renderTabela();
      });
    });
  }

  // ─── MODAL: RESPONSÁVEL POR USUÁRIO (várias empresas de uma vez) ──

  function abrirModalResponsavelPorUsuario() {
    if (!usuariosAprovados.length) {
      mostrarToast('Nenhum usuário aprovado no portal.', 'erro');
      return;
    }

    let modal = document.getElementById('modalResponsavelUsuario');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalResponsavelUsuario';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content large">
          <div class="modal-header">
            <h3>Atribuir responsável a várias empresas</h3>
            <button class="modal-close" id="fecharModalResponsavelUsuario">✕</button>
          </div>
          <div class="modal-body">
            <p class="mapa-empty" style="margin-bottom:8px;">Escolha um usuário e marque todas as empresas pelas quais ele é responsável. As alterações são salvas automaticamente.</p>
            <select id="selectUsuarioResponsavel" class="full" style="margin-bottom:10px;"></select>
            <div class="mapa-filtros" style="margin-bottom:8px;">
              <input type="text" id="buscaEmpresaModalUsuario" placeholder="Buscar empresa...">
              <button type="button" class="btn btn-secondary" id="btnMarcarTodasModalUsuario">Marcar visíveis</button>
              <button type="button" class="btn btn-secondary" id="btnDesmarcarTodasModalUsuario">Desmarcar visíveis</button>
            </div>
            <div id="modalResponsavelUsuarioBody"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="fecharModalResponsavelUsuario2">Fechar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const fechar = () => modal.classList.remove('active');
      document.getElementById('fecharModalResponsavelUsuario').addEventListener('click', fechar);
      document.getElementById('fecharModalResponsavelUsuario2').addEventListener('click', fechar);
      modal.addEventListener('click', (ev) => { if (ev.target === modal) fechar(); });

      document.getElementById('selectUsuarioResponsavel').addEventListener('change', () => renderCorpoModalResponsavelUsuario());
      document.getElementById('buscaEmpresaModalUsuario').addEventListener('input', () => renderCorpoModalResponsavelUsuario());
      document.getElementById('btnMarcarTodasModalUsuario').addEventListener('click', () => alternarTodasModalUsuario(true));
      document.getElementById('btnDesmarcarTodasModalUsuario').addEventListener('click', () => alternarTodasModalUsuario(false));
    }

    const select = document.getElementById('selectUsuarioResponsavel');
    const usuarioAtual = select.value;
    select.innerHTML = usuariosAprovados.map((u) => `<option value="${escapeAttr(u.id)}">${escapeHtml(u.nome)}${u.empresa ? ` (${escapeHtml(u.empresa)})` : ''}</option>`).join('');
    if (usuarioAtual && usuariosAprovados.some((u) => u.id === usuarioAtual)) select.value = usuarioAtual;

    document.getElementById('buscaEmpresaModalUsuario').value = '';
    renderCorpoModalResponsavelUsuario();
    modal.classList.add('active');
  }

  function empresasVisiveisModalUsuario() {
    const termo = (document.getElementById('buscaEmpresaModalUsuario').value || '').trim().toLowerCase();
    if (!termo) return unidadesContabil;
    return unidadesContabil.filter((e) => e.nome_empresa.toLowerCase().includes(termo)
      || e.codigo_empresa.toLowerCase().includes(termo)
      || (e.membros_nomes || '').toLowerCase().includes(termo));
  }

  function renderCorpoModalResponsavelUsuario() {
    const usuarioId = document.getElementById('selectUsuarioResponsavel').value;
    const body = document.getElementById('modalResponsavelUsuarioBody');
    const visiveis = empresasVisiveisModalUsuario();

    if (!visiveis.length) {
      body.innerHTML = '<p class="mapa-empty">Nenhuma empresa encontrada.</p>';
      return;
    }

    body.innerHTML = visiveis.map((e) => {
      const marcado = (responsaveisPorEmpresa[e.codigo_empresa] || new Set()).has(usuarioId);
      return `
        <label class="responsavel-check-item">
          <input type="checkbox" class="chk-responsavel-usuario" value="${escapeAttr(e.codigo_empresa)}" ${marcado ? 'checked' : ''}>
          <span>${e.is_grupo ? '👥 ' : ''}${escapeHtml(e.nome_empresa)} <small>(${e.is_grupo ? 'grupo' : escapeHtml(e.codigo_empresa)})</small></span>
        </label>
      `;
    }).join('');

    body.querySelectorAll('.chk-responsavel-usuario').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const codigo = chk.value;
        const marcado = chk.checked;
        chk.disabled = true;
        const { error } = await salvarResponsavel(codigo, usuarioId, marcado);
        chk.disabled = false;
        if (error) {
          console.error(error);
          chk.checked = !marcado;
          mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
          return;
        }
        renderTabela();
      });
    });
  }

  async function alternarTodasModalUsuario(marcar) {
    const usuarioId = document.getElementById('selectUsuarioResponsavel').value;
    const checkboxes = Array.from(document.querySelectorAll('#modalResponsavelUsuarioBody .chk-responsavel-usuario'));
    const paraSalvar = checkboxes.filter((chk) => chk.checked !== marcar);
    if (!paraSalvar.length) return;

    paraSalvar.forEach((chk) => { chk.disabled = true; });
    const codigos = paraSalvar.map((chk) => chk.value);

    let error;
    if (marcar) {
      ({ error } = await supabaseClient
        .from('contabil_empresas_responsaveis')
        .insert(codigos.map((codigo_empresa) => ({ codigo_empresa, usuario_id: usuarioId }))));
    } else {
      ({ error } = await supabaseClient
        .from('contabil_empresas_responsaveis')
        .delete()
        .eq('usuario_id', usuarioId)
        .in('codigo_empresa', codigos));
    }

    paraSalvar.forEach((chk) => { chk.disabled = false; });

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar as alterações.', 'erro');
      return;
    }

    codigos.forEach((codigo) => {
      if (!responsaveisPorEmpresa[codigo]) responsaveisPorEmpresa[codigo] = new Set();
      if (marcar) responsaveisPorEmpresa[codigo].add(usuarioId);
      else responsaveisPorEmpresa[codigo].delete(usuarioId);
    });
    codigos.forEach((codigo) => syncMapeamentoEmpresa(codigo));
    paraSalvar.forEach((chk) => { chk.checked = marcar; });
    renderTabela();
  }

  function definirValor(btn, valor) {
    btn.setAttribute('data-value', String(valor));
    btn.textContent = valor ? 'Sim' : 'Não';
    btn.classList.toggle('contabil-sim', valor);
    btn.classList.toggle('contabil-nao', !valor);
  }

  async function alternarUma(btn) {
    const codigo = btn.getAttribute('data-empresa-codigo');
    const anterior = btn.getAttribute('data-value') === 'true';
    const novo = !anterior;

    definirValor(btn, novo);
    btn.disabled = true;
    atualizarContador();

    const { error } = await salvarLote([{ codigo_empresa: codigo, possui_contabil: novo }]);

    btn.disabled = false;
    if (error) {
      console.error(error);
      definirValor(btn, anterior);
      atualizarContador();
      mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
    }
  }

  function atualizarContador() {
    const todos = document.querySelectorAll('#corpoTabelaConfig .contabil-toggle');
    const marcados = document.querySelectorAll('#corpoTabelaConfig .contabil-toggle[data-value="true"]');
    document.getElementById('contadorEmpresasConfig').textContent = `${marcados.length} de ${todos.length} com contábil (${empresas.length} no total)`;
  }

  async function alternarVisiveis(marcar) {
    const botoes = Array.from(document.querySelectorAll('#corpoTabelaConfig .contabil-toggle'));
    const paraSalvar = botoes.filter((b) => (b.getAttribute('data-value') === 'true') !== marcar);
    if (!paraSalvar.length) return;

    paraSalvar.forEach((b) => { b.disabled = true; });

    const registros = paraSalvar.map((b) => ({ codigo_empresa: b.getAttribute('data-empresa-codigo'), possui_contabil: marcar }));
    const { error } = await salvarLote(registros);

    paraSalvar.forEach((b) => { b.disabled = false; });

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar as alterações.', 'erro');
      return;
    }

    paraSalvar.forEach((b) => definirValor(b, marcar));
    atualizarContador();
  }

  // ─── IMPORTAÇÃO EM MASSA ────────────────────────────────────

  function normalizarChave(str) {
    return String(str ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const ALIASES_CODIGO = ['codigoempresa', 'codigo', 'codempresa', 'codemp'];
  const ALIASES_CONTABILIDADE = ['contabilidade', 'possuicontabil', 'contabil', 'temcontabilidade'];

  function interpretarSimNao(valor) {
    if (valor === null || valor === undefined) return null;
    const v = normalizarChave(valor);
    if (!v) return null;
    if (['sim', 's', 'true', '1', 'yes', 'y'].includes(v)) return true;
    if (['nao', 'n', 'false', '0', 'no'].includes(v)) return false;
    return null;
  }

  function lerPlanilhaConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          if (!sheet) throw new Error('Não foi possível ler o conteúdo deste arquivo.');
          const linhas = XLSX.utils.sheet_to_json(sheet, { defval: null });
          resolve(linhas);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleImportarPlanilha(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let linhas;
    try {
      linhas = await lerPlanilhaConfig(file);
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao ler a planilha.', 'erro');
      return;
    }

    if (!linhas.length) { mostrarToast('Planilha vazia.', 'erro'); return; }

    const cabecalhos = Object.keys(linhas[0]);
    const chaveCodigo = cabecalhos.find((h) => ALIASES_CODIGO.includes(normalizarChave(h)));
    const chaveContabilidade = cabecalhos.find((h) => ALIASES_CONTABILIDADE.includes(normalizarChave(h)));

    if (!chaveCodigo || !chaveContabilidade) {
      mostrarToast('Planilha inválida: são necessárias as colunas "Código Empresa" e "Contabilidade".', 'erro');
      return;
    }

    const empresasPorCodigo = {};
    empresas.forEach((e) => { empresasPorCodigo[e.codigo_empresa] = e; });

    const registrosPorCodigo = {};
    let naoEncontradas = 0;
    let ignoradas = 0;

    linhas.forEach((linha) => {
      const codigo = String(linha[chaveCodigo] ?? '').trim();
      if (!codigo) return;

      const valor = interpretarSimNao(linha[chaveContabilidade]);
      if (valor === null) { ignoradas++; return; }

      if (!empresasPorCodigo[codigo]) { naoEncontradas++; return; }

      registrosPorCodigo[codigo] = valor; // linha repetida: prevalece a última ocorrência
    });

    const registros = Object.entries(registrosPorCodigo).map(([codigo_empresa, possui_contabil]) => ({ codigo_empresa, possui_contabil }));

    if (!registros.length) {
      const partes = ['Nenhuma alteração aplicável encontrada na planilha.'];
      if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) na base.`);
      if (ignoradas) partes.push(`${ignoradas} linha(s) com valor de contabilidade inválido.`);
      mostrarToast(partes.join(' '), 'erro');
      return;
    }

    const btnImportar = document.getElementById('btnImportarPlanilha');
    btnImportar.disabled = true;
    btnImportar.textContent = 'Importando...';

    const { error } = await salvarLote(registros);

    btnImportar.disabled = false;
    btnImportar.textContent = '📊 Importar planilha';

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar as alterações importadas.', 'erro');
      return;
    }

    renderTabela();

    const partes = [`${registros.length} empresa(s) salva(s) no banco.`];
    if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) na base.`);
    if (ignoradas) partes.push(`${ignoradas} linha(s) com valor de contabilidade inválido.`);
    mostrarToast(partes.join(' '), 'sucesso');
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
