(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const BUCKET = 'documentos';

  const NIVEL_LABELS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };
  const REGIME_LABELS = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' };
  const SITUACAO_LABELS = { regularizado: 'Regularizado', em_regularizacao: 'Em Regularização', pendente: 'Pendente', critico: 'Crítico' };
  const FINANCEIRO_LABELS = { interno: 'Interno', bpo_scont: 'BPO Scont', bpo_terceiro: 'BPO Terceiro', nao_possui: 'Não possui' };
  const PERIODICIDADE_LABELS = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' };

  let empresas = [];
  let mapeamentos = [];
  let bancosPorMapeamento = {};
  let statusMensalPorEmpresa = {}; // { codigo_empresa: { 'ano-mes': status } }
  let motivoPendenciaPorEmpresa = {}; // { codigo_empresa: { 'ano-mes': motivo|null } }
  let documentacaoPorEmpresa = {}; // { codigo_empresa: { 'ano-mes': disponivel(bool) } }
  let empresaAtualCodigo = null;
  let anoGradeAtual = new Date().getFullYear();

  // Filtros da Visão Geral (persistem entre re-renders da própria tela,
  // resetados só pelo botão "Limpar filtros" ou ao trocar de aba).
  let dashboardFiltroRegime = '';
  let dashboardFiltroResponsavel = '';
  let dashboardFiltroStatus = '';
  let dashboardFiltroDocumentacao = '';
  let dashboardFiltroMes; // undefined = ainda não inicializado (default: mês atual); null = "Todos os meses" (seleção explícita)
  let dashboardFiltroAno = null;

  // ─── ESCOPO / FLUXO DE FECHAMENTO ───────────────────────────
  // Ver docs/superpowers/specs/2026-08-01-diario-fechamento-validacao-design.md
  let _isAdmin = false;
  let _isScontTeam = false;
  let _podeEditarMapeamento = false; // edição do Mapeamento Estratégico é exclusiva da equipe Scont
  let _restringirSeletor = false; // true = "Prestador de Serviço" não-admin
  let _meusResponsaveisSet = new Set(); // empresas onde o usuário logado é responsável atribuído
  let fechamentos = []; // linhas cruas de contabil_diario_fechamentos
  let fechamentosPorChave = {}; // 'codigo|ano|mes' -> eventos (mais recente primeiro)

  // Modal de encerramento: quando quem encerra também pode validar (equipe
  // Scont/admin), o clique não envia direto — abre uma etapa de revisão
  // dentro do mesmo modal antes de confirmar o encerramento já aprovado.
  let _etapaEncerramento = 'form'; // 'form' | 'revisao'
  let _arquivoBalanceteSelecionado = null; // File escolhido, guardado entre os passos
  let _observacaoEncerramentoPendente = '';

  document.addEventListener('DOMContentLoaded', iniciar);

  function parseDataLocal(str) {
    if (str instanceof Date) return str;
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
    window.__contabilAuth = auth;

    await _resolverEscopoUsuario(auth);

    document.getElementById('btnDashboard').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      renderDashboardDiario();
    });
    document.getElementById('btnRelatorios').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioRelatorios.render(document.getElementById('main'));
    });
    document.getElementById('btnHistorico').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioHistorico.render(document.getElementById('main'));
    });
    document.getElementById('btnValidacoes').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioValidacoes.render(document.getElementById('main'));
    });
    inicializarBuscaEmpresa();

    await carregarDadosDiario();
    atualizarBadgeValidacoes();

    const empresaNaUrl = new URLSearchParams(window.location.search).get('empresa');
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresaDiario(empresaNaUrl);
    } else {
      renderDashboardDiario();
    }
  }

  // Mesmo padrão de escopo já usado em Projeto RH/admin.js: usuários
  // vinculados à empresa "Prestador de Serviço" só veem, no seletor geral
  // do Diário, as empresas atribuídas a eles em
  // contabil_empresas_responsaveis. Super-admins do portal e usuários da
  // SCONT Soluções Contábeis continuam vendo tudo. A mesma consulta
  // também alimenta quem pode "Encerrar" o mês de uma empresa (mesmo se
  // não for restrito no seletor — ex.: alguém da equipe Scont responsável
  // por uma empresa de financeiro interno).
  async function _resolverEscopoUsuario(auth) {
    _isAdmin = !!auth.isAdmin;
    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    _isScontTeam = empresaUsuario === 'scont soluções contábeis';
    _podeEditarMapeamento = _isAdmin || _isScontTeam;
    _restringirSeletor = !_isAdmin && empresaUsuario === 'prestador de serviço';

    if (!auth.userId) { _meusResponsaveisSet = new Set(); return; }
    const { data, error } = await supabaseClient
      .from('contabil_empresas_responsaveis')
      .select('codigo_empresa')
      .eq('usuario_id', auth.userId);
    if (error) { console.error(error); _meusResponsaveisSet = new Set(); return; }
    _meusResponsaveisSet = new Set((data || []).map((r) => r.codigo_empresa));
  }

  function podeEncerrar(codigoEmpresa) { return _isAdmin || _meusResponsaveisSet.has(codigoEmpresa); }
  function podeValidar() { return _isAdmin || _isScontTeam; }

  async function carregarDadosDiario() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }, { data: dataConfig, error: errConfig }, { data: dataFechamentos, error: errFechamentos }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
      supabaseClient.from('contabil_diario_fechamentos').select('*').order('created_at', { ascending: false }),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);
    if (errConfig) console.error(errConfig);
    if (errFechamentos) console.error(errFechamentos);

    const configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });
    const possuiContabil = (codigo) => configPorEmpresa[codigo] !== false;

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao) && possuiContabil(e.codigo_empresa));
    if (_restringirSeletor) empresas = empresas.filter((e) => _meusResponsaveisSet.has(e.codigo_empresa));
    mapeamentos = dataMapeamentos || [];

    fechamentos = dataFechamentos || []; // já vem ordenado created_at desc
    fechamentosPorChave = {};
    fechamentos.forEach((f) => {
      const chave = `${f.codigo_empresa}|${f.ano}|${f.mes}`;
      (fechamentosPorChave[chave] = fechamentosPorChave[chave] || []).push(f);
    });

    const ids = mapeamentos.map((m) => m.id);
    bancosPorMapeamento = {};
    if (ids.length) {
      const { data: bancos, error: errBancos } = await supabaseClient
        .from('contabil_mapeamento_bancos').select('*').in('mapeamento_id', ids);
      if (errBancos) console.error(errBancos);
      (bancos || []).forEach((b) => {
        (bancosPorMapeamento[b.mapeamento_id] = bancosPorMapeamento[b.mapeamento_id] || []).push(b);
      });
    }

    const [{ data: statusMensal, error: errStatus }, { data: documentacao, error: errDocumentacao }] = await Promise.all([
      supabaseClient.from('contabil_diario_status_mensal').select('*'),
      supabaseClient.from('contabil_diario_documentacao').select('*'),
    ]);
    if (errStatus) console.error(errStatus);
    if (errDocumentacao) console.error(errDocumentacao);
    statusMensalPorEmpresa = {};
    motivoPendenciaPorEmpresa = {};
    (statusMensal || []).forEach((s) => {
      const bucket = (statusMensalPorEmpresa[s.codigo_empresa] = statusMensalPorEmpresa[s.codigo_empresa] || {});
      bucket[`${s.ano}-${s.mes}`] = s.status;
      const motivoBucket = (motivoPendenciaPorEmpresa[s.codigo_empresa] = motivoPendenciaPorEmpresa[s.codigo_empresa] || {});
      motivoBucket[`${s.ano}-${s.mes}`] = s.motivo_pendencia || null;
    });
    documentacaoPorEmpresa = {};
    (documentacao || []).forEach((d) => {
      const bucket = (documentacaoPorEmpresa[d.codigo_empresa] = documentacaoPorEmpresa[d.codigo_empresa] || {});
      bucket[`${d.ano}-${d.mes}`] = !!d.disponivel;
    });

    window.__diarioContext = {
      supabaseClient,
      empresas,
      restringirPorResponsavel: _restringirSeletor,
      meusResponsaveisCodigos: Array.from(_meusResponsaveisSet),
      mapeamentos,
      bancosPorMapeamento,
      statusMensalPorEmpresa,
      documentacaoPorEmpresa,
      NIVEL_LABELS, REGIME_LABELS, SITUACAO_LABELS, FINANCEIRO_LABELS, PERIODICIDADE_LABELS,
      ASSUNTOS_LANCAMENTO,
      mapeamentoDe,
      escapeHtml,
      fechamentos,
      statusFechamentoDoMes,
      eventosFechamentoDoMes,
      podeEncerrar,
      podeValidar,
      criarEventoFechamento,
      selecionarEmpresaDiario,
      atualizarBadgeValidacoes,
      mostrarToast,
      buscarEventosStatusGrade,
      abrirBalancete,
    };
  }

  // ─── FECHAMENTO — STATUS DERIVADO E EVENTOS ─────────────────

  function eventosFechamentoDoMes(codigoEmpresa, ano, mes) {
    return fechamentosPorChave[`${codigoEmpresa}|${ano}|${mes}`] || [];
  }

  // Deriva o status a partir do evento mais recente — nunca armazenado
  // como coluna própria (ver spec §1.1).
  function statusFechamentoDoMes(codigoEmpresa, ano, mes) {
    const eventos = eventosFechamentoDoMes(codigoEmpresa, ano, mes);
    if (!eventos.length) return 'aberto';
    const ultimo = eventos[0].tipo_evento;
    if (ultimo === 'enviado') return 'aguardando_validacao';
    if (ultimo === 'aprovado') return 'aprovado';
    return 'aberto'; // rejeitado volta para aberto
  }

  // Balancete do mês (PDF) fica no bucket compartilhado "documentos" (mesmo
  // do Onboarding), num caminho próprio cuja leitura é restrita por RLS
  // (equipe Scont ou responsável pela empresa — ver
  // _sql/schema_contabil_diario_fechamentos_balancete.sql).
  function caminhoBalancete(codigoEmpresa, ano, mes, nomeArquivo) {
    const nomeSeguro = nomeArquivo.replace(/\s+/g, '_');
    return `diario-contabil-balancetes/${codigoEmpresa}/${ano}-${String(mes).padStart(2, '0')}/${Date.now()}_${nomeSeguro}`;
  }

  async function uploadBalancete(codigoEmpresa, ano, mes, file) {
    const caminho = caminhoBalancete(codigoEmpresa, ano, mes, file.name);
    const { error } = await supabaseClient.storage.from(BUCKET).upload(caminho, file, {
      contentType: file.type || 'application/pdf',
      cacheControl: '3600',
    });
    if (error) return { error };
    return { data: { url: caminho, nome: file.name } };
  }

  async function abrirBalancete(caminho) {
    if (!caminho) return;
    const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrl(caminho, 60);
    if (error) { console.error(error); mostrarToast('Erro ao abrir o balancete. Veja o console (F12) para detalhes.', 'erro'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function criarEventoFechamento(codigoEmpresa, ano, mes, tipoEvento, mensagem, balancete) {
    const auth = window.__contabilAuth || {};
    // Capturado ANTES do insert: quem enviou para validação é o autor do
    // evento 'enviado' mais recente (o que está prestes a ser substituído
    // por este aprovado/rejeitado), para notificá-lo por e-mail depois.
    const eventoEnviadoAnterior = tipoEvento !== 'enviado'
      ? (fechamentosPorChave[`${codigoEmpresa}|${ano}|${mes}`] || []).find((e) => e.tipo_evento === 'enviado')
      : null;

    const registro = {
      codigo_empresa: codigoEmpresa,
      ano,
      mes,
      tipo_evento: tipoEvento,
      mensagem: mensagem || null,
      usuario_id: auth.userId || null,
      usuario_nome: auth.userData?.nome || null,
      usuario_email: auth.email || null,
      balancete_url: balancete ? balancete.url : null,
      balancete_nome: balancete ? balancete.nome : null,
    };
    const { data, error } = await supabaseClient.from('contabil_diario_fechamentos').insert(registro).select().single();
    if (error) return { error };

    const chave = `${codigoEmpresa}|${ano}|${mes}`;
    (fechamentosPorChave[chave] = fechamentosPorChave[chave] || []).unshift(data);
    fechamentos.unshift(data);

    if (tipoEvento === 'enviado') {
      enviarAlertaValidacao(codigoEmpresa, ano, mes, auth).catch((e) => console.error('Erro ao enviar alerta de validação:', e));
    } else if ((tipoEvento === 'aprovado' || tipoEvento === 'rejeitado') && eventoEnviadoAnterior) {
      enviarNotificacaoPrestador(codigoEmpresa, ano, mes, tipoEvento, mensagem, eventoEnviadoAnterior).catch((e) => console.error('Erro ao notificar prestador:', e));
    }
    atualizarBadgeValidacoes();
    return { error: null };
  }

  async function enviarAlertaValidacao(codigoEmpresa, ano, mes, auth) {
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('email_alerta_validacao, notificar_validacao_fechamento')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }
    if (cfg?.notificar_validacao_fechamento === false) return; // desligado em Configurações

    const destinatarios = (cfg?.email_alerta_validacao || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!destinatarios.length) {
      mostrarToast('Fechamento enviado, mas nenhum e-mail de alerta está configurado (Configurações → Alertas por E-mail).', 'erro');
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = `🔔 Fechamento aguardando validação — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: 'validacao_fechamento',
      empresa: nomeEmp,
      mes_ano: mesAno,
      enviado_por: auth.userData?.nome || auth.email || 'Usuário',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(destinatarios.map((destinatario) =>
      fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ destinatario, assunto, params }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))
    ));

    if (resultados.some((r) => !r.ok)) {
      mostrarToast('Fechamento enviado, mas houve falha ao notificar por e-mail a equipe Scont.', 'erro');
    }
  }

  // Notifica quem enviou o fechamento (Prestador de Serviço) quando a
  // equipe Scont aprova ou rejeita. O e-mail é resolvido no servidor
  // (Edge Function, service role) a partir de solicitacoes_acesso pelo
  // usuario_id de quem enviou — nunca o e-mail informado neste
  // navegador — garantindo que vai sempre para o endereço cadastrado no
  // pedido de acesso ao Portal Scont, mesmo sem o aprovador ter permissão
  // de leitura direta sobre a solicitação de outro usuário (RLS).
  async function enviarNotificacaoPrestador(codigoEmpresa, ano, mes, tipoEvento, mensagem, eventoEnviadoAnterior) {
    if (!eventoEnviadoAnterior?.usuario_id) return; // evento sem autor identificável (ex.: importação legada)

    const aprovado = tipoEvento === 'aprovado';
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('notificar_fechamento_aprovado, notificar_fechamento_rejeitado')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }
    const notificarAtivo = aprovado ? cfg?.notificar_fechamento_aprovado : cfg?.notificar_fechamento_rejeitado;
    if (notificarAtivo === false) return; // desligado em Configurações

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = aprovado
      ? `✅ Fechamento aprovado — ${nomeEmp} — ${mesAno}`
      : `❌ Fechamento rejeitado — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: aprovado ? 'fechamento_aprovado' : 'fechamento_rejeitado',
      empresa: nomeEmp,
      mes_ano: mesAno,
      motivo: mensagem || '',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultado = await fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ usuarioId: eventoEnviadoAnterior.usuario_id, nomeDestinatario: eventoEnviadoAnterior.usuario_nome || undefined, assunto, params }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }));

    if (!resultado.ok) {
      mostrarToast(`Ação registrada, mas houve falha ao notificar o prestador por e-mail (${resultado.error || 'erro desconhecido'}).`, 'erro');
    }
  }

  function contarPendenciasUsuario() {
    let total = 0;
    Object.keys(fechamentosPorChave).forEach((chave) => {
      const eventos = fechamentosPorChave[chave];
      if (!eventos.length) return;
      const [codigo] = chave.split('|');
      const ultimo = eventos[0].tipo_evento;
      if (podeValidar() && ultimo === 'enviado') total++;
      else if (!podeValidar() && ultimo === 'rejeitado' && podeEncerrar(codigo)) total++;
    });
    return total;
  }

  function atualizarBadgeValidacoes() {
    const badge = document.getElementById('badgeValidacoes');
    if (!badge) return;
    const total = contarPendenciasUsuario();
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-block' : 'none';
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

  function mapeamentoDe(codigoEmpresa) {
    return mapeamentos.find((m) => m.codigo_empresa === codigoEmpresa) || null;
  }

  function nivelDe(codigoEmpresa) {
    const m = mapeamentoDe(codigoEmpresa);
    return m ? (m.nivel_atencao || 'baixo') : 'baixo';
  }

  // Conta quantos meses da grade (todos os anos) estão marcados como
  // "pendencia" para a empresa — substitui a antiga contagem de pendências
  // abertas do Mapeamento Estratégico (tabela contabil_mapeamento_pendencias,
  // descontinuada na tela do Mapeamento).
  function mesesComPendenciaDe(codigoEmpresa) {
    const bucket = statusMensalPorEmpresa[codigoEmpresa];
    if (!bucket) return 0;
    return Object.values(bucket).filter((status) => status === 'pendencia').length;
  }

  function statusDoMes(codigoEmpresa, ano, mes) {
    const bucket = statusMensalPorEmpresa[codigoEmpresa];
    return (bucket && bucket[`${ano}-${mes}`]) || 'nao_iniciado';
  }

  function motivoPendenciaDoMes(codigoEmpresa, ano, mes) {
    const bucket = motivoPendenciaPorEmpresa[codigoEmpresa];
    return (bucket && bucket[`${ano}-${mes}`]) || null;
  }

  function documentacaoDisponivelDoMes(codigoEmpresa, ano, mes) {
    const bucket = documentacaoPorEmpresa[codigoEmpresa];
    return !!(bucket && bucket[`${ano}-${mes}`]);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function empresaNome(codigoEmpresa) {
    const e = empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function inicializarBuscaEmpresa() {
    const input = document.getElementById('buscaEmpresa');
    const lista = document.getElementById('listaBuscaEmpresa');

    input.addEventListener('input', () => {
      const termo = input.value.trim().toLowerCase();
      if (!termo) { lista.innerHTML = ''; lista.classList.remove('aberta'); return; }
      const resultados = empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo)).slice(0, 20);
      if (!resultados.length) {
        lista.innerHTML = '<div class="combobox-item combobox-vazio">Nenhuma empresa encontrada.</div>';
      } else {
        lista.innerHTML = resultados.map((e) => `<div class="combobox-item" data-codigo="${escapeHtml(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</div>`).join('');
      }
      lista.classList.add('aberta');
    });

    lista.addEventListener('click', (ev) => {
      const item = ev.target.closest('.combobox-item[data-codigo]');
      if (!item) return;
      lista.innerHTML = '';
      lista.classList.remove('aberta');
      selecionarEmpresaDiario(item.getAttribute('data-codigo'));
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('#wrapBuscaEmpresa')) {
        lista.innerHTML = '';
        lista.classList.remove('aberta');
      }
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { lista.innerHTML = ''; lista.classList.remove('aberta'); }
    });
  }

  // ─── DASHBOARD ──────────────────────────────────────────────

  function miniGradeHtml(codigoEmpresa) {
    const anoAtual = new Date().getFullYear();
    const meses = Array.from({ length: 12 }, (_, idx) => ({ ano: anoAtual, mes: idx + 1 }));
    return `<span class="mapa-mini-grade">${meses.map(({ ano, mes }) => {
      const status = statusDoMes(codigoEmpresa, ano, mes);
      return `<span class="mini-quad status-${status}" title="${String(mes).padStart(2, '0')}/${ano}"></span>`;
    }).join('')}</span>`;
  }

  function miniGradeDocumentacaoHtml(codigoEmpresa) {
    const anoAtual = new Date().getFullYear();
    const meses = Array.from({ length: 12 }, (_, idx) => ({ ano: anoAtual, mes: idx + 1 }));
    return `<span class="mapa-mini-grade">${meses.map(({ ano, mes }) => {
      const disponivel = documentacaoDisponivelDoMes(codigoEmpresa, ano, mes);
      const classe = disponivel ? 'doc-sim' : 'doc-nao';
      const titulo = `${String(mes).padStart(2, '0')}/${ano} — Documentação ${disponivel ? '' : 'não '}disponível`;
      return `<span class="mini-quad ${classe}" title="${titulo}"></span>`;
    }).join('')}</span>`;
  }

  function responsaveisDistintosDashboard() {
    const nomes = new Set();
    mapeamentos.forEach((m) => { if (m.responsavel_execucao) nomes.add(m.responsavel_execucao); });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // dashboardFiltroMes === null significa "Todos os meses" (dentro do ano
  // escolhido) — verifica se QUALQUER mês do ano bate com o critério, em
  // vez de exigir um mês específico.
  function statusBateEmAlgumMes(codigoEmpresa, ano, statusAlvo) {
    for (let mes = 1; mes <= 12; mes++) {
      if (statusDoMes(codigoEmpresa, ano, mes) === statusAlvo) return true;
    }
    return false;
  }

  function documentacaoDisponivelEmAlgumMes(codigoEmpresa, ano) {
    for (let mes = 1; mes <= 12; mes++) {
      if (documentacaoDisponivelDoMes(codigoEmpresa, ano, mes)) return true;
    }
    return false;
  }

  // Status/Documentação são filtrados no mês/ano escolhidos (default: mês
  // atual, com opção "Todos os meses") — a mini-grade continua mostrando
  // o ano inteiro, o filtro só decide quais empresas aparecem na lista.
  function empresasFiltradasDashboard() {
    return empresas.filter((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      if (dashboardFiltroRegime && (!m || m.regime_tributario !== dashboardFiltroRegime)) return false;
      if (dashboardFiltroResponsavel && (!m || m.responsavel_execucao !== dashboardFiltroResponsavel)) return false;
      if (dashboardFiltroStatus) {
        const bate = dashboardFiltroMes === null
          ? statusBateEmAlgumMes(e.codigo_empresa, dashboardFiltroAno, dashboardFiltroStatus)
          : statusDoMes(e.codigo_empresa, dashboardFiltroAno, dashboardFiltroMes) === dashboardFiltroStatus;
        if (!bate) return false;
      }
      if (dashboardFiltroDocumentacao) {
        const disponivel = dashboardFiltroMes === null
          ? documentacaoDisponivelEmAlgumMes(e.codigo_empresa, dashboardFiltroAno)
          : documentacaoDisponivelDoMes(e.codigo_empresa, dashboardFiltroAno, dashboardFiltroMes);
        if (dashboardFiltroDocumentacao === 'sim' && !disponivel) return false;
        if (dashboardFiltroDocumentacao === 'nao' && disponivel) return false;
      }
      return true;
    });
  }

  function linhasDashboardHtml() {
    const linhas = empresasFiltradasDashboard().map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      const mesesPendencia = mesesComPendenciaDe(e.codigo_empresa);
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? (REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
          <td>${mesesPendencia}</td>
          <td>${miniGradeDocumentacaoHtml(e.codigo_empresa)}</td>
          <td>${miniGradeHtml(e.codigo_empresa)}</td>
        </tr>
      `;
    }).join('');
    return linhas || '<tr><td colspan="7">Nenhuma empresa encontrada com esses filtros.</td></tr>';
  }

  function renderDashboardDiario() {
    const main = document.getElementById('main');
    const hoje = new Date();
    if (dashboardFiltroMes === undefined) dashboardFiltroMes = hoje.getMonth() + 1;
    if (dashboardFiltroAno == null) dashboardFiltroAno = hoje.getFullYear();

    const responsaveis = responsaveisDistintosDashboard();

    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>Visão Geral</h2></div>
      </div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Filtros</div>
        <div class="mapa-secao-body">
          <div>
            <label>Regime Tributário</label>
            <select id="filtroDashRegime">
              <option value="">Todos</option>
              ${Object.entries(REGIME_LABELS).map(([v, l]) => `<option value="${v}" ${dashboardFiltroRegime === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Responsável</label>
            <select id="filtroDashResponsavel">
              <option value="">Todos</option>
              ${responsaveis.map((r) => `<option value="${escapeHtml(r)}" ${dashboardFiltroResponsavel === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
            </select>
          </div>
          <div class="full" style="display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
              <label>Status do Mês</label>
              <select id="filtroDashStatus">
                <option value="">Todos</option>
                ${Object.entries(STATUS_GRADE_LABELS).map(([v, l]) => `<option value="${v}" ${dashboardFiltroStatus === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div style="flex:1; min-width:200px;">
              <label>Documentação Disponível</label>
              <select id="filtroDashDocumentacao">
                <option value="">Todos</option>
                <option value="sim" ${dashboardFiltroDocumentacao === 'sim' ? 'selected' : ''}>Sim</option>
                <option value="nao" ${dashboardFiltroDocumentacao === 'nao' ? 'selected' : ''}>Não</option>
              </select>
            </div>
            <div>
              <label>Mês</label>
              <select id="filtroDashMes">
                <option value="" ${dashboardFiltroMes === null ? 'selected' : ''}>Todos os meses</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}" ${idx + 1 === dashboardFiltroMes ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Ano</label>
              <input type="number" id="filtroDashAno" value="${dashboardFiltroAno}" style="width:90px;">
            </div>
            <div>
              <button type="button" class="btn btn-secondary" id="btnLimparFiltrosDash">Limpar filtros</button>
            </div>
          </div>
        </div>
      </div>
      <table class="mapa-table">
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Nível</th><th>Pendências</th><th>Documentação — Ano Atual</th><th>Contabilidade — Ano Atual</th></tr></thead>
        <tbody id="tbodyDashboard">${linhasDashboardHtml()}</tbody>
      </table>
    `;

    function ligarCliquesLinhas() {
      main.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
        tr.addEventListener('click', () => selecionarEmpresaDiario(tr.getAttribute('data-codigo')));
      });
    }
    ligarCliquesLinhas();

    function atualizarTabelaDashboard() {
      document.getElementById('tbodyDashboard').innerHTML = linhasDashboardHtml();
      ligarCliquesLinhas();
    }

    document.getElementById('filtroDashRegime').addEventListener('change', (ev) => { dashboardFiltroRegime = ev.target.value; atualizarTabelaDashboard(); });
    document.getElementById('filtroDashResponsavel').addEventListener('change', (ev) => { dashboardFiltroResponsavel = ev.target.value; atualizarTabelaDashboard(); });
    document.getElementById('filtroDashStatus').addEventListener('change', (ev) => { dashboardFiltroStatus = ev.target.value; atualizarTabelaDashboard(); });
    document.getElementById('filtroDashDocumentacao').addEventListener('change', (ev) => { dashboardFiltroDocumentacao = ev.target.value; atualizarTabelaDashboard(); });
    document.getElementById('filtroDashMes').addEventListener('change', (ev) => { dashboardFiltroMes = ev.target.value === '' ? null : Number(ev.target.value); atualizarTabelaDashboard(); });
    document.getElementById('filtroDashAno').addEventListener('change', (ev) => { dashboardFiltroAno = Number(ev.target.value) || dashboardFiltroAno; atualizarTabelaDashboard(); });
    document.getElementById('btnLimparFiltrosDash').addEventListener('click', () => {
      dashboardFiltroRegime = '';
      dashboardFiltroResponsavel = '';
      dashboardFiltroStatus = '';
      dashboardFiltroDocumentacao = '';
      dashboardFiltroMes = hoje.getMonth() + 1;
      dashboardFiltroAno = hoje.getFullYear();
      renderDashboardDiario();
    });
  }

  // ─── PÁGINA DA EMPRESA ──────────────────────────────────────

  function selecionarEmpresaDiario(codigoEmpresa) {
    empresaAtualCodigo = codigoEmpresa;
    document.getElementById('buscaEmpresa').value = empresaNome(codigoEmpresa);
    anoGradeAtual = new Date().getFullYear();
    renderPaginaEmpresa();
  }

  function renderPaginaEmpresa() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>${escapeHtml(empresaNome(empresaAtualCodigo))}</h2></div>
      </div>
      <div id="secaoResumoMapeamento"></div>
      <div id="secaoGradeMensal"></div>
      <div id="secaoLancamentos"></div>
    `;
    renderResumoMapeamento();
    renderGradeMensal();
    renderLancamentos();
  }

  function renderResumoMapeamento() {
    const el = document.getElementById('secaoResumoMapeamento');
    const m = mapeamentoDe(empresaAtualCodigo);
    const hrefMapeamento = `mapeamento.html?empresa=${encodeURIComponent(empresaAtualCodigo)}&origem=diario`;
    const linkEditar = _podeEditarMapeamento
      ? `<a class="btn btn-primary" href="${hrefMapeamento}">✏️ Editar no Mapeamento Estratégico</a>`
      : `<a class="btn btn-secondary" href="${hrefMapeamento}">👁️ Ver Mapeamento Estratégico</a>`;

    if (!m) {
      el.innerHTML = `
        <div class="mapa-secao">
          <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
          <div class="mapa-secao-body">
            <p class="mapa-empty full">Nenhum mapeamento cadastrado ainda.</p>
            <div class="full">${linkEditar}</div>
          </div>
        </div>
      `;
      return;
    }

    const bancos = (bancosPorMapeamento[m.id] || []).map((b) => b.banco);
    const nivel = m.nivel_atencao || 'baixo';
    const anoAtual = String(new Date().getFullYear());
    const statusAno = m[`situacao_${anoAtual}_status`];

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
        <div class="mapa-secao-body">
          <div><label>Regime Tributário</label><span>${m.regime_tributario ? REGIME_LABELS[m.regime_tributario] : '—'}</span></div>
          <div><label>Periodicidade</label><span>${m.periodicidade ? PERIODICIDADE_LABELS[m.periodicidade] : '—'}</span></div>
          <div><label>Responsável pela Execução</label><span>${m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</span></div>
          <div><label>Contato</label><span>${[m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).map(escapeHtml).join(' • ') || '—'}</span></div>
          <div><label>Financeiro Interno/BPO</label><span>${m.financeiro_interno_bpo ? FINANCEIRO_LABELS[m.financeiro_interno_bpo] : '—'}</span></div>
          <div><label>Bancos Utilizados</label><span>${bancos.length ? bancos.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Sistemas Utilizados</label><span>${(m.sistemas_utilizados || []).length ? m.sistemas_utilizados.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Situação ${anoAtual}</label><span>${statusAno ? SITUACAO_LABELS[statusAno] : '—'}</span></div>
          <div><label>Nível de Atenção</label><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></div>
          <div class="full">${linkEditar}</div>
        </div>
      </div>
    `;
  }

  // ─── AUDITORIA ──────────────────────────────────────────────

  const STATUS_GRADE_LABELS = { nao_iniciado: 'Não Iniciado', em_andamento: 'Em Andamento', pendencia: 'Pendência', concluido: 'Concluído' };

  async function registrarAuditoria(codigoEmpresa, campo, valorAnterior, valorNovo, observacao) {
    const auth = window.__contabilAuth || {};
    const { error } = await supabaseClient.from('contabil_diario_auditoria').insert({
      codigo_empresa: codigoEmpresa,
      campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      observacao: observacao || null,
      usuario_nome: auth.userData?.nome || null,
      usuario_email: auth.email || null,
    });
    if (error) console.error(error);
  }

  async function buscarEventosStatusGrade(codigoEmpresa, ano, mes) {
    const campo = `Status Mensal — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const { data, error } = await supabaseClient
      .from('contabil_diario_auditoria')
      .select('valor_novo, created_at')
      .eq('codigo_empresa', codigoEmpresa)
      .eq('campo', campo)
      .order('created_at', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  // ─── GRADE MENSAL ───────────────────────────────────────────
  // Máquina de estados: (sem linha) -> em_andamento -> pendencia <->
  // em_andamento -> concluido. "pendencia" exige uma observação
  // obrigatória (o motivo). Cada transição vai para contabil_diario_
  // auditoria com created_at, o que permite calcular depois os tempos
  // do fechamento (ver calcularTemposFechamento em contabil-diario-util.js).

  // "nao_iniciado" nunca é gravado explicitamente em
  // contabil_diario_status_mensal — é o default implícito da ausência de
  // linha (statusDoMes cai pra 'nao_iniciado' quando não acha nada no
  // bucket) e a CHECK constraint da coluna só aceita
  // em_andamento/pendencia/concluido. Até aqui nenhum chamador tentava
  // gravar 'nao_iniciado' (só saía dele, via iniciarMes); o admin
  // pode agora voltar um mês pra 'nao_iniciado' livremente
  // (alterarStatusMesAdmin), então isso precisa apagar a linha em vez de
  // tentar um upsert que violaria a constraint.
  async function transicionarStatusMes(codigoEmpresa, ano, mes, statusAtual, statusNovo, motivo) {
    const { error } = statusNovo === 'nao_iniciado'
      ? await supabaseClient.from('contabil_diario_status_mensal').delete()
          .eq('codigo_empresa', codigoEmpresa).eq('ano', ano).eq('mes', mes)
      : await supabaseClient.from('contabil_diario_status_mensal')
          .upsert({ codigo_empresa: codigoEmpresa, ano, mes, status: statusNovo, motivo_pendencia: motivo || null, updated_at: new Date().toISOString() }, { onConflict: 'codigo_empresa,ano,mes' });
    if (error) { console.error(error); mostrarToast('Erro ao atualizar o status do mês.', 'erro'); return; }

    const bucket = (statusMensalPorEmpresa[codigoEmpresa] = statusMensalPorEmpresa[codigoEmpresa] || {});
    const motivoBucket = (motivoPendenciaPorEmpresa[codigoEmpresa] = motivoPendenciaPorEmpresa[codigoEmpresa] || {});
    if (statusNovo === 'nao_iniciado') {
      delete bucket[`${ano}-${mes}`];
      delete motivoBucket[`${ano}-${mes}`];
    } else {
      bucket[`${ano}-${mes}`] = statusNovo;
      motivoBucket[`${ano}-${mes}`] = motivo || null;
    }

    const campo = `Status Mensal — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    await registrarAuditoria(codigoEmpresa, campo, STATUS_GRADE_LABELS[statusAtual], STATUS_GRADE_LABELS[statusNovo], motivo);

    renderGradeMensal();
  }

  async function iniciarMes(codigoEmpresa, ano, mes) {
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, 'nao_iniciado', 'em_andamento', null);
  }

  // Selo "Documentação Disponível": só equipe Scont/Admin marca/desmarca,
  // só vale enquanto o mês estiver "Não Iniciado" (ver spec
  // docs/superpowers/specs/2026-08-07-diario-documentacao-disponivel-design.md).
  // Independente da máquina de estados de contabil_diario_status_mensal.
  async function alternarDocumentacaoDisponivel(codigoEmpresa, ano, mes) {
    if (!(_isAdmin || _isScontTeam)) return;
    const atual = documentacaoDisponivelDoMes(codigoEmpresa, ano, mes);
    const novo = !atual;
    const auth = window.__contabilAuth || {};
    const { error } = await supabaseClient
      .from('contabil_diario_documentacao')
      .upsert({
        codigo_empresa: codigoEmpresa, ano, mes, disponivel: novo,
        marcado_por_nome: auth.userData?.nome || null,
        marcado_por_email: auth.email || null,
        marcado_em: new Date().toISOString(),
      }, { onConflict: 'codigo_empresa,ano,mes' });
    if (error) { console.error(error); mostrarToast('Erro ao atualizar a documentação disponível.', 'erro'); return; }

    const bucket = (documentacaoPorEmpresa[codigoEmpresa] = documentacaoPorEmpresa[codigoEmpresa] || {});
    bucket[`${ano}-${mes}`] = novo;

    const campo = `Documentação Disponível — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    await registrarAuditoria(codigoEmpresa, campo, atual ? 'Sim' : 'Não', novo ? 'Sim' : 'Não', null);

    if (novo) {
      enviarAlertaDocumentacaoDisponivel(codigoEmpresa, ano, mes, auth).catch((e) => console.error('Erro ao enviar alerta de documentação disponível:', e));
    }

    renderGradeMensal();
  }

  // Ao marcar (nunca ao desmarcar) a documentação como disponível, avisa
  // por e-mail todos os responsáveis atribuídos à empresa em
  // contabil_empresas_responsaveis (mesma tabela que resolve
  // _meusResponsaveisSet/podeEncerrar) — ver
  // docs/superpowers/specs/2026-08-08-diario-documentacao-disponivel-email-design.md.
  async function enviarAlertaDocumentacaoDisponivel(codigoEmpresa, ano, mes, auth) {
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('notificar_documentacao_disponivel')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }
    if (cfg?.notificar_documentacao_disponivel === false) return; // desligado em Configurações

    const { data: responsaveis, error: errResp } = await supabaseClient
      .from('contabil_empresas_responsaveis')
      .select('usuario_id')
      .eq('codigo_empresa', codigoEmpresa);
    if (errResp) { console.error(errResp); return; }
    const usuarioIds = (responsaveis || []).map((r) => r.usuario_id).filter(Boolean);
    if (!usuarioIds.length) {
      mostrarToast('Documentação marcada como disponível, mas nenhum responsável está atribuído a esta empresa (Configurações → Responsáveis).', 'erro');
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = `📄 Documentação disponível — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: 'documentacao_disponivel',
      empresa: nomeEmp,
      mes_ano: mesAno,
      marcado_por: auth.userData?.nome || auth.email || 'Equipe Scont',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(usuarioIds.map((usuarioId) =>
      fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ usuarioId, assunto, params }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))
    ));

    if (resultados.some((r) => !r.ok)) {
      mostrarToast('Documentação marcada, mas houve falha ao notificar por e-mail um ou mais responsáveis.', 'erro');
    }
  }

  async function marcarPendencia(codigoEmpresa, ano, mes, motivo) {
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, 'em_andamento', 'pendencia', motivo);
    const auth = window.__contabilAuth || {};
    enviarAlertaPendencia(codigoEmpresa, ano, mes, motivo, auth).catch((e) => console.error('Erro ao enviar alerta de pendência:', e));
  }

  // Mesmo padrão de enviarAlertaValidacao: notifica os e-mails cadastrados
  // em Configurações → Alertas por E-mail (mesma lista, reaproveitada)
  // quando o Prestador de Serviço marca uma pendência de execução na grade.
  async function enviarAlertaPendencia(codigoEmpresa, ano, mes, motivo, auth) {
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('email_alerta_validacao, notificar_pendencia_execucao')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }
    if (cfg?.notificar_pendencia_execucao === false) return; // desligado em Configurações

    const destinatarios = (cfg?.email_alerta_validacao || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!destinatarios.length) return; // alerta de validação já avisa quando não há e-mail configurado

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = `🔴 Pendência de execução — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: 'pendencia_execucao',
      empresa: nomeEmp,
      mes_ano: mesAno,
      marcado_por: auth.userData?.nome || auth.email || 'Usuário',
      motivo: motivo || '',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(destinatarios.map((destinatario) =>
      fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ destinatario, assunto, params }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))
    ));

    if (resultados.some((r) => !r.ok)) {
      mostrarToast('Pendência registrada, mas houve falha ao notificar por e-mail a equipe Scont.', 'erro');
    }
  }

  async function resolverPendencia(codigoEmpresa, ano, mes) {
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, 'pendencia', 'em_andamento', null);
    const auth = window.__contabilAuth || {};
    enviarAlertaPendenciaResolvida(codigoEmpresa, ano, mes, auth).catch((e) => console.error('Erro ao enviar alerta de pendência sanada:', e));
  }

  // Mesmo padrão de enviarAlertaPendencia, para o evento inverso: notifica
  // os e-mails cadastrados em Configurações → Alertas por E-mail quando a
  // pendência de execução é sanada (mês volta de "pendencia" para
  // "em_andamento").
  async function enviarAlertaPendenciaResolvida(codigoEmpresa, ano, mes, auth) {
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('email_alerta_validacao, notificar_pendencia_resolvida')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }
    if (cfg?.notificar_pendencia_resolvida === false) return; // desligado em Configurações

    const destinatarios = (cfg?.email_alerta_validacao || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!destinatarios.length) return; // alerta de validação já avisa quando não há e-mail configurado

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = `🟢 Pendência sanada — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: 'pendencia_resolvida',
      empresa: nomeEmp,
      mes_ano: mesAno,
      resolvido_por: auth.userData?.nome || auth.email || 'Usuário',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(destinatarios.map((destinatario) =>
      fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ destinatario, assunto, params }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))
    ));

    if (resultados.some((r) => !r.ok)) {
      mostrarToast('Pendência sanada, mas houve falha ao notificar por e-mail a equipe Scont.', 'erro');
    }
  }

  async function marcarConcluido(codigoEmpresa, ano, mes) {
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, 'em_andamento', 'concluido', null);
  }

  async function reabrirMes(codigoEmpresa, ano, mes) {
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    if (!window.confirm('Reabrir este mês? Ele volta para "Em Andamento".')) return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, 'concluido', 'em_andamento', null);
  }

  // ─── POPOVER: escolha Pendência/Concluído a partir do amarelo ──

  function fecharPopoverGrade() {
    const pop = document.getElementById('popoverGrade');
    if (pop) pop.remove();
    document.removeEventListener('click', fecharPopoverGradeAoClicarFora);
    window.removeEventListener('scroll', fecharPopoverGrade, true);
  }

  function fecharPopoverGradeAoClicarFora(ev) {
    const pop = document.getElementById('popoverGrade');
    if (pop && !pop.contains(ev.target)) fecharPopoverGrade();
  }

  function abrirFormPendenciaNoPopover(pop, codigoEmpresa, ano, mes) {
    pop.innerHTML = `
      <label>Motivo da pendência (obrigatório)</label>
      <textarea id="popMotivoPendencia" rows="2" placeholder="Ex: falta disponibilização de documentação..."></textarea>
      <button type="button" class="btn btn-primary" id="popBtnConfirmarPendencia">Confirmar</button>
    `;
    pop.addEventListener('click', (ev) => ev.stopPropagation());
    pop.querySelector('#popBtnConfirmarPendencia').addEventListener('click', () => {
      const motivo = pop.querySelector('#popMotivoPendencia').value.trim();
      if (!motivo) { mostrarToast('Informe o motivo da pendência.', 'erro'); return; }
      fecharPopoverGrade();
      marcarPendencia(codigoEmpresa, ano, mes, motivo);
    });
  }

  function abrirPopoverGrade(cel, codigoEmpresa, ano, mes) {
    fecharPopoverGrade();
    const pop = document.createElement('div');
    pop.id = 'popoverGrade';
    pop.className = 'popover-grade';
    pop.innerHTML = `
      <button type="button" class="btn btn-secondary" id="popBtnPendencia">🔴 Marcar Pendência</button>
      <button type="button" class="btn btn-primary" id="popBtnConcluido">🟢 Marcar Concluído</button>
    `;
    pop.addEventListener('click', (ev) => ev.stopPropagation());
    document.body.appendChild(pop);

    const rect = cel.getBoundingClientRect();
    pop.style.top = `${rect.bottom + 6}px`;
    pop.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - 100, 8), window.innerWidth - 208)}px`;

    pop.querySelector('#popBtnConcluido').addEventListener('click', () => {
      fecharPopoverGrade();
      marcarConcluido(codigoEmpresa, ano, mes);
    });
    pop.querySelector('#popBtnPendencia').addEventListener('click', () => {
      abrirFormPendenciaNoPopover(pop, codigoEmpresa, ano, mes);
    });

    setTimeout(() => {
      document.addEventListener('click', fecharPopoverGradeAoClicarFora);
      window.addEventListener('scroll', fecharPopoverGrade, true);
    }, 0);
  }

  // ─── POPOVER: admin do portal muda o status livremente ──────
  // Só _isAdmin (super-admin do Portal Scont) — não _isScontTeam. Pula
  // pra qualquer status, sem seguir o pipeline normal
  // (nao_iniciado→em_andamento→pendencia/concluido). Bloqueado só pelo
  // lock de "aprovado" (validação de encerramento), igual a todo mundo —
  // ver docs/superpowers/specs/2026-08-08-diario-admin-status-livre-design.md.
  const OPCOES_STATUS_ADMIN = [
    { valor: 'nao_iniciado', label: '⚪ Não Iniciado' },
    { valor: 'em_andamento', label: '🟡 Em Andamento' },
    { valor: 'pendencia', label: '🔴 Pendência' },
    { valor: 'concluido', label: '🟢 Concluído' },
  ];

  async function alterarStatusMesAdmin(codigoEmpresa, ano, mes, statusAtual, statusNovo, motivo) {
    if (!_isAdmin) return;
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return;
    if (statusAtual === statusNovo) return;
    await transicionarStatusMes(codigoEmpresa, ano, mes, statusAtual, statusNovo, motivo);
  }

  function abrirFormPendenciaAdminNoPopover(pop, codigoEmpresa, ano, mes, statusAtual) {
    pop.innerHTML = `
      <label>Motivo da pendência (obrigatório)</label>
      <textarea id="popMotivoPendenciaAdmin" rows="2" placeholder="Ex: falta disponibilização de documentação..."></textarea>
      <button type="button" class="btn btn-primary" id="popBtnConfirmarPendenciaAdmin">Confirmar</button>
    `;
    pop.addEventListener('click', (ev) => ev.stopPropagation());
    pop.querySelector('#popBtnConfirmarPendenciaAdmin').addEventListener('click', () => {
      const motivo = pop.querySelector('#popMotivoPendenciaAdmin').value.trim();
      if (!motivo) { mostrarToast('Informe o motivo da pendência.', 'erro'); return; }
      fecharPopoverGrade();
      alterarStatusMesAdmin(codigoEmpresa, ano, mes, statusAtual, 'pendencia', motivo);
    });
  }

  function abrirPopoverStatusAdmin(cel, codigoEmpresa, ano, mes) {
    fecharPopoverGrade();
    const statusAtual = statusDoMes(codigoEmpresa, ano, mes);
    const pop = document.createElement('div');
    pop.id = 'popoverGrade';
    pop.className = 'popover-grade';
    pop.innerHTML = OPCOES_STATUS_ADMIN.map((o) => `
      <button type="button" class="btn btn-secondary" data-status-admin="${o.valor}" ${o.valor === statusAtual ? 'disabled' : ''}>${o.label}${o.valor === statusAtual ? ' (atual)' : ''}</button>
    `).join('');
    pop.addEventListener('click', (ev) => ev.stopPropagation());
    document.body.appendChild(pop);

    const rect = cel.getBoundingClientRect();
    pop.style.top = `${rect.bottom + 6}px`;
    pop.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - 100, 8), window.innerWidth - 208)}px`;

    pop.querySelectorAll('[data-status-admin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const statusNovo = btn.getAttribute('data-status-admin');
        if (statusNovo === 'pendencia') { abrirFormPendenciaAdminNoPopover(pop, codigoEmpresa, ano, mes, statusAtual); return; }
        fecharPopoverGrade();
        alterarStatusMesAdmin(codigoEmpresa, ano, mes, statusAtual, statusNovo, null);
      });
    });

    setTimeout(() => {
      document.addEventListener('click', fecharPopoverGradeAoClicarFora);
      window.addEventListener('scroll', fecharPopoverGrade, true);
    }, 0);
  }

  const ICONE_FECHAMENTO = {
    aberto: { icone: '📤', titulo: 'Encerrar mês contábil' },
    aguardando_validacao: { icone: '⏳', titulo: 'Aguardando validação' },
    aprovado: { icone: '✅', titulo: 'Fechamento aprovado' },
  };

  function iconeFechamentoHtml(mes, statusFech) {
    const info = ICONE_FECHAMENTO[statusFech];
    return `<button type="button" class="btn-icone-fechamento" data-mes-fechamento="${mes}" title="${info.titulo}">${info.icone}</button>`;
  }

  // Selo "Documentação Disponível": equipe Scont/Admin vê (e clica) sempre
  // que o mês está "Não Iniciado" (marcado ou não); demais usuários só veem
  // quando já está marcado — nada aparece no estado "não marcado" pra não
  // poluir a tela de quem não pode agir sobre isso.
  function iconeDocumentacaoHtml(mes, docDisponivel) {
    const podeMarcar = _isAdmin || _isScontTeam;
    if (!podeMarcar && !docDisponivel) return '';
    const classe = docDisponivel ? 'doc-disponivel' : 'doc-nao-marcado';
    const titulo = docDisponivel
      ? 'Documentação disponível' + (podeMarcar ? ' — clique para desmarcar' : '')
      : 'Marcar documentação disponível';
    const tag = podeMarcar ? 'button' : 'span';
    const atributoTipo = podeMarcar ? ' type="button"' : '';
    return `<${tag}${atributoTipo} class="btn-icone-doc ${classe}" data-mes-doc="${mes}" title="${titulo}">📄</${tag}>`;
  }

  function renderGradeMensal() {
    const el = document.getElementById('secaoGradeMensal');
    const meses = window.ContabilDiarioUtil.MESES_LABELS;

    const celulasHtml = meses.map((label, idx) => {
      const mes = idx + 1;
      const status = statusDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const statusFech = statusFechamentoDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const travada = statusFech === 'aprovado';
      const motivo = motivoPendenciaDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const docDisponivel = status === 'nao_iniciado' && documentacaoDisponivelDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const titulo = `${label}/${anoGradeAtual} — ${STATUS_GRADE_LABELS[status]}${travada ? ' (fechamento aprovado — travado)' : ''}${motivo ? ` — ${motivo}` : ''}${docDisponivel ? ' — Documentação disponível' : ''}`;
      return `
        <div class="mapa-grade-cel status-${status}${travada ? ' grade-travada' : ''}" data-mes="${mes}" title="${escapeHtml(titulo)}">
          <span class="mapa-grade-mes">${label}</span>
          ${status === 'concluido' ? iconeFechamentoHtml(mes, statusFech) : ''}
          ${status === 'nao_iniciado' ? iconeDocumentacaoHtml(mes, docDisponivel) : ''}
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Situação de Fechamento — Grade Mensal</div>
        <div class="mapa-secao-body">
          <div class="full mapa-grade-nav">
            <button type="button" id="btnAnoAnterior">‹</button>
            <strong>${anoGradeAtual}</strong>
            <button type="button" id="btnAnoSeguinte">›</button>
          </div>
          <div class="full mapa-grade-linha">${celulasHtml}</div>
        </div>
      </div>
    `;

    el.querySelector('#btnAnoAnterior').addEventListener('click', () => { anoGradeAtual -= 1; renderGradeMensal(); });
    el.querySelector('#btnAnoSeguinte').addEventListener('click', () => { anoGradeAtual += 1; renderGradeMensal(); });
    el.querySelectorAll('.mapa-grade-cel').forEach((cel) => {
      cel.addEventListener('click', () => {
        const mes = Number(cel.getAttribute('data-mes'));
        if (statusFechamentoDoMes(empresaAtualCodigo, anoGradeAtual, mes) === 'aprovado') return;
        if (_isAdmin) { abrirPopoverStatusAdmin(cel, empresaAtualCodigo, anoGradeAtual, mes); return; }
        const status = statusDoMes(empresaAtualCodigo, anoGradeAtual, mes);
        if (status === 'nao_iniciado') { iniciarMes(empresaAtualCodigo, anoGradeAtual, mes); return; }
        if (status === 'em_andamento') { abrirPopoverGrade(cel, empresaAtualCodigo, anoGradeAtual, mes); return; }
        if (status === 'pendencia') { resolverPendencia(empresaAtualCodigo, anoGradeAtual, mes); return; }
        if (status === 'concluido') { reabrirMes(empresaAtualCodigo, anoGradeAtual, mes); return; }
      });
    });
    el.querySelectorAll('.btn-icone-fechamento').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        abrirModalFechamento(empresaAtualCodigo, anoGradeAtual, Number(btn.getAttribute('data-mes-fechamento')));
      });
    });
    el.querySelectorAll('button.btn-icone-doc').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        alternarDocumentacaoDisponivel(empresaAtualCodigo, anoGradeAtual, Number(btn.getAttribute('data-mes-doc')));
      });
    });
  }

  // ─── MODAL: FECHAMENTO DO MÊS ───────────────────────────────

  const TIPO_EVENTO_LABEL = {
    enviado: '📤 Enviado para validação',
    aprovado: '✅ Aprovado',
    rejeitado: '❌ Rejeitado',
  };

  function formatarDataHoraFechamento(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function timelineFechamentoHtml(codigoEmpresa, ano, mes) {
    const eventos = eventosFechamentoDoMes(codigoEmpresa, ano, mes);
    if (!eventos.length) return '<p class="mapa-empty">Nenhum evento registrado ainda para este mês.</p>';
    return eventos.map((ev) => `
      <div class="fechamento-evento">
        <div><strong>${TIPO_EVENTO_LABEL[ev.tipo_evento] || ev.tipo_evento}</strong> — ${escapeHtml(ev.usuario_nome || ev.usuario_email || 'desconhecido')} <span class="mapa-empty">(${formatarDataHoraFechamento(ev.created_at)})</span></div>
        ${ev.mensagem ? `<div class="fechamento-evento-msg">${escapeHtml(ev.mensagem)}</div>` : ''}
        ${ev.balancete_url ? `<div><a href="#" class="arquivo-link" data-ver-balancete="${escapeHtml(ev.balancete_url)}">📄 ${escapeHtml(ev.balancete_nome || 'Balancete do mês')}</a></div>` : ''}
      </div>
    `).join('');
  }

  function abrirModalFechamento(codigoEmpresa, ano, mes) {
    let modal = document.getElementById('modalFechamento');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalFechamento';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modalFechamentoTitulo">Fechamento do Mês</h3>
            <button class="modal-close" id="fecharModalFechamento">✕</button>
          </div>
          <div class="modal-body" id="modalFechamentoBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="fecharModalFechamento2">Fechar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const fechar = () => modal.classList.remove('active');
      document.getElementById('fecharModalFechamento').addEventListener('click', fechar);
      document.getElementById('fecharModalFechamento2').addEventListener('click', fechar);
      modal.addEventListener('click', (ev) => { if (ev.target === modal) fechar(); });
    }

    document.getElementById('modalFechamentoTitulo').textContent =
      `Fechamento — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano} — ${empresaNome(codigoEmpresa)}`;
    _etapaEncerramento = 'form';
    _arquivoBalanceteSelecionado = null;
    _observacaoEncerramentoPendente = '';
    renderModalFechamentoBody(codigoEmpresa, ano, mes);
    modal.classList.add('active');
  }

  function temposFechamentoHtml(tempos) {
    if (!tempos) return '';
    const fmt = window.ContabilDiarioUtil.formatarDuracaoHumana;
    return `
      <div class="mapa-secao-header" style="margin:0 -20px 12px;padding-left:20px;">Tempos do Fechamento</div>
      <div class="mapa-secao-body" style="padding:0 0 16px;">
        <div><label>Tempo total</label><span>${fmt(tempos.totalMs)}</span></div>
        <div><label>Tempo em pendência</label><span>${fmt(tempos.pendenciaMs)}</span></div>
        <div><label>Tempo efetivamente trabalhado</label><span>${fmt(tempos.efetivoMs)}</span></div>
      </div>
    `;
  }

  function acaoEncerramentoFormHtml(autoAprovar) {
    return `
      <div class="mapa-secao-body" style="padding:0 0 16px;">
        <div class="full"><label>Balancete do Mês (PDF) — obrigatório</label><input type="file" id="fechBalanceteArquivo" accept="application/pdf,.pdf"></div>
        <div class="full"><label>Observação (opcional)</label><textarea id="fechObservacaoEnvio" rows="2" placeholder="Alguma observação para a equipe Scont...">${escapeHtml(_observacaoEncerramentoPendente)}</textarea></div>
        <div class="full"><button type="button" class="btn btn-primary" id="btnEncerrarMes">${autoAprovar ? 'Revisar e Encerrar' : 'Encerrar mês contábil'}</button></div>
      </div>
    `;
  }

  function acaoEncerramentoRevisaoHtml(codigoEmpresa, ano, mes) {
    return `
      <div class="mapa-secao-body" style="padding:0 0 16px;">
        <div class="full"><p class="mapa-empty" style="margin:0;">
          Revise antes de confirmar — ${escapeHtml(empresaNome(codigoEmpresa))},
          ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}.
        </p></div>
        <div class="full"><label>Balancete anexado</label><span>📄 ${escapeHtml(_arquivoBalanceteSelecionado ? _arquivoBalanceteSelecionado.name : '—')}</span></div>
        ${_observacaoEncerramentoPendente ? `<div class="full"><label>Observação</label><span>${escapeHtml(_observacaoEncerramentoPendente)}</span></div>` : ''}
        <div class="full"><p class="mapa-empty" style="margin:0;">
          Você faz parte da equipe Scont — este encerramento será aprovado diretamente,
          sem passar por validação. Tem certeza que deseja confirmar?
        </p></div>
        <div class="full" style="display:flex; gap:10px;">
          <button type="button" class="btn btn-secondary" id="btnVoltarEncerramento">Voltar</button>
          <button type="button" class="btn btn-primary" id="btnConfirmarEncerramento">Confirmar Encerramento</button>
        </div>
      </div>
    `;
  }

  async function renderModalFechamentoBody(codigoEmpresa, ano, mes) {
    const body = document.getElementById('modalFechamentoBody');
    const statusFech = statusFechamentoDoMes(codigoEmpresa, ano, mes);
    const ultimo = eventosFechamentoDoMes(codigoEmpresa, ano, mes)[0];
    const autoAprovar = podeValidar();

    let acaoHtml = '';
    if (statusFech === 'aberto' && podeEncerrar(codigoEmpresa)) {
      acaoHtml = _etapaEncerramento === 'revisao' && autoAprovar
        ? acaoEncerramentoRevisaoHtml(codigoEmpresa, ano, mes)
        : acaoEncerramentoFormHtml(autoAprovar);
    } else if (statusFech === 'aguardando_validacao') {
      if (podeValidar()) {
        acaoHtml = `
          <div class="mapa-secao-body" style="padding:0 0 16px;">
            ${ultimo && ultimo.balancete_url ? `<div class="full"><label>Balancete do Mês</label><a href="#" class="arquivo-link" data-ver-balancete="${escapeHtml(ultimo.balancete_url)}">📄 ${escapeHtml(ultimo.balancete_nome || 'ver balancete')}</a></div>` : ''}
            <div class="full"><button type="button" class="btn btn-primary" id="btnAprovarFechamento">Aprovar</button></div>
            <div class="full"><label>Motivo da rejeição (obrigatório para rejeitar)</label><textarea id="fechMotivoRejeicao" rows="2" placeholder="Explique o que precisa ser corrigido..."></textarea></div>
            <div class="full"><button type="button" class="btn btn-secondary" id="btnRejeitarFechamento">Rejeitar</button></div>
          </div>
        `;
      } else {
        acaoHtml = `<p class="mapa-empty">Aguardando validação da equipe Scont${ultimo ? ` (enviado por ${escapeHtml(ultimo.usuario_nome || ultimo.usuario_email || '—')})` : ''}.</p>`;
      }
    } else if (statusFech === 'aprovado') {
      acaoHtml = '<p class="mapa-empty status-aprovado">Fechamento aprovado — mês travado.</p>';
    }

    const eventosGrade = await buscarEventosStatusGrade(codigoEmpresa, ano, mes);
    const tempos = window.ContabilDiarioUtil.calcularTemposFechamento(eventosGrade);

    body.innerHTML = `
      ${acaoHtml}
      ${temposFechamentoHtml(tempos)}
      <div class="mapa-secao-header" style="margin:0 -20px 12px;padding-left:20px;">Linha do Tempo</div>
      <div id="fechTimeline">${timelineFechamentoHtml(codigoEmpresa, ano, mes)}</div>
    `;

    body.querySelectorAll('[data-ver-balancete]').forEach((link) => {
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        abrirBalancete(link.getAttribute('data-ver-balancete'));
      });
    });

    const btnEncerrar = document.getElementById('btnEncerrarMes');
    if (btnEncerrar) {
      btnEncerrar.addEventListener('click', async () => {
        const arquivo = document.getElementById('fechBalanceteArquivo').files[0];
        if (!arquivo) { mostrarToast('Anexe o balancete do mês em PDF antes de encerrar.', 'erro'); return; }
        const mensagem = document.getElementById('fechObservacaoEnvio').value.trim();

        if (autoAprovar) {
          _arquivoBalanceteSelecionado = arquivo;
          _observacaoEncerramentoPendente = mensagem;
          _etapaEncerramento = 'revisao';
          renderModalFechamentoBody(codigoEmpresa, ano, mes);
          return;
        }

        btnEncerrar.disabled = true;
        const { data: balancete, error: errUpload } = await uploadBalancete(codigoEmpresa, ano, mes, arquivo);
        if (errUpload) { console.error(errUpload); btnEncerrar.disabled = false; mostrarToast('Erro ao enviar o balancete.', 'erro'); return; }
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'enviado', mensagem, balancete);
        btnEncerrar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao encerrar o mês.', 'erro'); return; }
        mostrarToast('Mês encerrado e enviado para validação da equipe Scont.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }

    const btnVoltarEncerramento = document.getElementById('btnVoltarEncerramento');
    if (btnVoltarEncerramento) {
      btnVoltarEncerramento.addEventListener('click', () => {
        _etapaEncerramento = 'form';
        _arquivoBalanceteSelecionado = null;
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
      });
    }

    const btnConfirmarEncerramento = document.getElementById('btnConfirmarEncerramento');
    if (btnConfirmarEncerramento) {
      btnConfirmarEncerramento.addEventListener('click', async () => {
        btnConfirmarEncerramento.disabled = true;
        const { data: balancete, error: errUpload } = await uploadBalancete(codigoEmpresa, ano, mes, _arquivoBalanceteSelecionado);
        if (errUpload) { console.error(errUpload); btnConfirmarEncerramento.disabled = false; mostrarToast('Erro ao enviar o balancete.', 'erro'); return; }
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'aprovado', _observacaoEncerramentoPendente, balancete);
        btnConfirmarEncerramento.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao encerrar o mês.', 'erro'); return; }
        mostrarToast('Mês encerrado e aprovado diretamente pela equipe Scont.', 'sucesso');
        _etapaEncerramento = 'form';
        _arquivoBalanceteSelecionado = null;
        _observacaoEncerramentoPendente = '';
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }

    const btnAprovar = document.getElementById('btnAprovarFechamento');
    if (btnAprovar) {
      btnAprovar.addEventListener('click', async () => {
        btnAprovar.disabled = true;
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'aprovado', null);
        btnAprovar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao aprovar o fechamento.', 'erro'); return; }
        mostrarToast('Fechamento aprovado.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }

    const btnRejeitar = document.getElementById('btnRejeitarFechamento');
    if (btnRejeitar) {
      btnRejeitar.addEventListener('click', async () => {
        const motivo = document.getElementById('fechMotivoRejeicao').value.trim();
        if (!motivo) { mostrarToast('Informe o motivo da rejeição.', 'erro'); return; }
        btnRejeitar.disabled = true;
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'rejeitado', motivo);
        btnRejeitar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao rejeitar o fechamento.', 'erro'); return; }
        mostrarToast('Fechamento rejeitado — o mês voltou para aberto.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }
  }

  // ─── LANÇAMENTOS DO DIÁRIO ──────────────────────────────────

  // Assuntos macro pré-definidos pra padronizar o lançamento — lista
  // livre (não é enum no banco, coluna assunto é TEXT), campo opcional.
  const ASSUNTOS_LANCAMENTO = [
    'Escrituração Contábil',
    'Escrituração Fiscal',
    'Apuração de Impostos',
    'Obrigações Acessórias (SPED, DCTF, ECD, ECF...)',
    'Conciliação Bancária',
    'Fechamento Contábil / Balancete',
    'Documentação Pendente',
    'Folha de Pagamento',
    'Financeiro (Contas a Pagar/Receber)',
    'Atendimento ao Cliente',
    'Outros',
  ];

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function renderLancamentos() {
    const el = document.getElementById('secaoLancamentos');
    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Lançamentos do Diário</div>
        <div class="mapa-secao-body">
          <div><label>Data</label><input type="date" id="novoLancamentoData" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div>
            <label>Assunto (opcional)</label>
            <select id="novoLancamentoAssunto">
              <option value="">Não informado</option>
              ${ASSUNTOS_LANCAMENTO.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; gap:10px;">
            <div style="flex:1;">
              <label>Mês de referência (opcional)</label>
              <select id="novoLancamentoMesRef">
                <option value="">—</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}">${l}</option>`).join('')}
              </select>
            </div>
            <div style="width:100px;">
              <label>Ano ref.</label>
              <input type="number" id="novoLancamentoAnoRef" placeholder="Ano">
            </div>
          </div>
          <div class="full"><label>Registro</label><textarea id="novoLancamentoTexto" rows="2" placeholder="Ex: Enviado SPED Fiscal de junho, pendente confirmação do cliente."></textarea></div>
          <div><button type="button" class="btn-novo" id="btnAddLancamento">+ Adicionar Lançamento</button></div>
          <div class="full mapa-filtros mapa-filtros-lancamentos" style="margin-top:10px;border-top:1px solid var(--line-soft);padding-top:14px;">
            <div><label>De</label><input type="date" id="filtroLancamentoDe"></div>
            <div><label>Até</label><input type="date" id="filtroLancamentoAte"></div>
            <div>
              <label>Mês</label>
              <select id="filtroLancamentoMes">
                <option value="">Todos</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}">${l}</option>`).join('')}
              </select>
            </div>
            <div><label>Ano</label><input type="number" id="filtroLancamentoAno" placeholder="Ano" style="width:80px;"></div>
            <button type="button" class="btn btn-secondary" id="btnFiltroMesAtual">Mês atual</button>
            <button type="button" class="btn btn-secondary" id="btnFiltroAnoAtual">Ano atual</button>
            <button type="button" class="btn btn-secondary" id="btnFiltrarLancamentos">Filtrar</button>
            <button type="button" class="btn btn-secondary" id="btnLimparFiltroLancamentos">Limpar</button>
          </div>
          <div class="full mapa-filtros" style="margin-top:8px;">
            <div>
              <label>Mês de referência</label>
              <select id="filtroLancamentoRefMes">
                <option value="">Todos</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}">${l}</option>`).join('')}
              </select>
            </div>
            <div><label>Ano de referência</label><input type="number" id="filtroLancamentoRefAno" placeholder="Ano" style="width:80px;"></div>
            <div style="flex:1; min-width:220px;">
              <label>Assunto</label>
              <select id="filtroLancamentoAssunto">
                <option value="">Todos</option>
                ${ASSUNTOS_LANCAMENTO.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="full" id="listaLancamentos"><p class="mapa-empty">Carregando...</p></div>
        </div>
      </div>
    `;

    el.querySelector('#btnAddLancamento').addEventListener('click', async () => {
      const data = document.getElementById('novoLancamentoData').value;
      const texto = document.getElementById('novoLancamentoTexto').value.trim();
      if (!data || !texto) return;
      const mesRef = document.getElementById('novoLancamentoMesRef').value;
      const anoRef = document.getElementById('novoLancamentoAnoRef').value;
      const assunto = document.getElementById('novoLancamentoAssunto').value;
      const auth = window.__contabilAuth || {};
      const { error } = await supabaseClient.from('contabil_diario_lancamentos').insert({
        codigo_empresa: empresaAtualCodigo,
        data,
        texto,
        mes_referencia: mesRef ? Number(mesRef) : null,
        ano_referencia: anoRef ? Number(anoRef) : null,
        assunto: assunto || null,
        criado_por_nome: auth.userData?.nome || null,
        criado_por_email: auth.email || null,
      });
      if (error) { console.error(error); mostrarToast('Erro ao adicionar lançamento.', 'erro'); return; }
      document.getElementById('novoLancamentoTexto').value = '';
      document.getElementById('novoLancamentoMesRef').value = '';
      document.getElementById('novoLancamentoAnoRef').value = '';
      document.getElementById('novoLancamentoAssunto').value = '';
      carregarListaLancamentos();
    });

    el.querySelector('#btnFiltrarLancamentos').addEventListener('click', () => {
      const mes = document.getElementById('filtroLancamentoMes').value;
      const ano = document.getElementById('filtroLancamentoAno').value;
      if (ano) aplicarFiltroMesAno();
      else carregarListaLancamentos();
    });
    el.querySelector('#btnLimparFiltroLancamentos').addEventListener('click', () => {
      document.getElementById('filtroLancamentoDe').value = '';
      document.getElementById('filtroLancamentoAte').value = '';
      document.getElementById('filtroLancamentoMes').value = '';
      document.getElementById('filtroLancamentoAno').value = '';
      document.getElementById('filtroLancamentoRefMes').value = '';
      document.getElementById('filtroLancamentoRefAno').value = '';
      document.getElementById('filtroLancamentoAssunto').value = '';
      carregarListaLancamentos();
    });
    el.querySelector('#filtroLancamentoRefMes').addEventListener('change', () => carregarListaLancamentos());
    el.querySelector('#filtroLancamentoRefAno').addEventListener('change', () => carregarListaLancamentos());
    el.querySelector('#filtroLancamentoAssunto').addEventListener('change', () => carregarListaLancamentos());
    el.querySelector('#btnFiltroMesAtual').addEventListener('click', () => {
      const hoje = new Date();
      document.getElementById('filtroLancamentoMes').value = String(hoje.getMonth() + 1);
      document.getElementById('filtroLancamentoAno').value = String(hoje.getFullYear());
      aplicarFiltroMesAno();
    });
    el.querySelector('#btnFiltroAnoAtual').addEventListener('click', () => {
      const hoje = new Date();
      document.getElementById('filtroLancamentoMes').value = '';
      document.getElementById('filtroLancamentoAno').value = String(hoje.getFullYear());
      aplicarFiltroMesAno();
    });

    carregarListaLancamentos();
  }

  function aplicarFiltroMesAno() {
    const mes = document.getElementById('filtroLancamentoMes').value;
    const ano = document.getElementById('filtroLancamentoAno').value;
    if (!ano) return;
    const anoNum = Number(ano);

    if (mes) {
      const mesNum = Number(mes);
      const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
      document.getElementById('filtroLancamentoDe').value = `${anoNum}-${String(mesNum).padStart(2, '0')}-01`;
      document.getElementById('filtroLancamentoAte').value = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    } else {
      document.getElementById('filtroLancamentoDe').value = `${anoNum}-01-01`;
      document.getElementById('filtroLancamentoAte').value = `${anoNum}-12-31`;
    }

    carregarListaLancamentos();
  }

  async function carregarListaLancamentos() {
    const container = document.getElementById('listaLancamentos');
    const de = document.getElementById('filtroLancamentoDe')?.value || null;
    const ate = document.getElementById('filtroLancamentoAte')?.value || null;
    const refMes = document.getElementById('filtroLancamentoRefMes')?.value || null;
    const refAno = document.getElementById('filtroLancamentoRefAno')?.value || null;
    const assunto = document.getElementById('filtroLancamentoAssunto')?.value || null;

    let query = supabaseClient
      .from('contabil_diario_lancamentos')
      .select('*')
      .eq('codigo_empresa', empresaAtualCodigo);
    if (de) query = query.gte('data', de);
    if (ate) query = query.lte('data', ate);
    if (refMes) query = query.eq('mes_referencia', Number(refMes));
    if (refAno) query = query.eq('ano_referencia', Number(refAno));
    if (assunto) query = query.eq('assunto', assunto);

    const { data, error } = await query
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); container.innerHTML = '<p class="mapa-empty">Erro ao carregar lançamentos.</p>'; return; }

    if (!data || !data.length) {
      container.innerHTML = '<p class="mapa-empty">Nenhum lançamento registrado.</p>';
      return;
    }

    container.innerHTML = data.map((l) => {
      const tags = [];
      if (l.assunto) tags.push(`<span class="badge-nivel nivel-baixo">${escapeHtml(l.assunto)}</span>`);
      if (l.mes_referencia) tags.push(`<span class="badge-nivel nivel-baixo">Ref.: ${window.ContabilDiarioUtil.MESES_LABELS[l.mes_referencia - 1]}${l.ano_referencia ? '/' + l.ano_referencia : ''}</span>`);
      return `
      <div class="mapa-lancamento-item">
        <div class="mapa-lancamento-data">${parseDataLocal(l.data).toLocaleDateString('pt-BR')}</div>
        ${tags.length ? `<div class="mapa-lancamento-tags" style="display:flex; gap:6px; margin:4px 0;">${tags.join('')}</div>` : ''}
        <div class="mapa-lancamento-texto">${escapeHtml(l.texto)}</div>
        <div class="mapa-lancamento-autor">— ${escapeHtml(l.criado_por_nome || l.criado_por_email || 'desconhecido')} (${formatarDataHora(l.created_at)})</div>
      </div>
    `;
    }).join('');
  }
})();
