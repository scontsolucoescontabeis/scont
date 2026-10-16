(function () {
  'use strict';

  // BPO Financeiro — Monitor de Documentos Publicados.
  // A equipe sobe o relatório "Documentos Publicados" do Onvio; a tela interpreta o arquivo,
  // calcula o que cada empresa com BPO publicou e monta a fila de alertas (disparo assistido).
  // Tabelas: _sql/schema_bpo_documentos.sql · E-mails: edge function bpo-alertas.

  const U = window.BpoUtil;
  const esc = U.escapeHtml;
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  let usuarioEmail = '';
  let competencia = U.listaCompetencias(new Date(), 1)[0];
  let config = null;
  let tipos = [];
  let empresasCad = [];     // bpo_empresas
  let rhEmpresas = [];      // rh_empresas ativas
  let nomes = {};           // codigo -> nome
  let vinculos = [];        // bpo_vinculos
  let publicacoes = [];     // da competência
  let marcacoes = [];
  let alertas = [];
  let relatorios = [];
  let linhas = [];          // calcularStatus
  let filtroGrupo = '';
  let telaAtual = 'painel';
  let importacao = null;    // estado do upload em andamento

  document.addEventListener('DOMContentLoaded', iniciar);

  // ─── INFRA ──────────────────────────────────────────────────

  function toast(msg, tipo) {
    const el = $('bpoToast');
    el.textContent = msg;
    el.className = `bpo-toast show ${tipo || ''}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.className = 'bpo-toast'; }, 4500);
  }

  function abrirModal(titulo, corpoHtml, rodapeHtml) {
    $('bpoModalTitulo').textContent = titulo;
    $('bpoModalCorpo').innerHTML = corpoHtml;
    $('bpoModalRodape').innerHTML = rodapeHtml || '';
    $('bpoModal').classList.add('active');
  }
  function fecharModal() { $('bpoModal').classList.remove('active'); }

  // Lê todas as linhas de uma consulta (limite de 1000 por página do PostgREST).
  async function lerTudo(montar) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await montar().range(de, de + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  function hojeIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ─── INÍCIO ─────────────────────────────────────────────────

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    if (!auth.isAdmin && empresaUsuario === 'prestador de serviço') {
      window.location.href = '../Projeto Onboarding Contabil/diario.html';
      return;
    }
    $('authOverlay')?.remove();

    const { data: pode } = await supabaseClient.rpc('bpo_pode_gerir');
    if (pode !== true) {
      $('main').innerHTML = `<div class="empty-state"><div class="emoji">🔒</div><h2>Acesso restrito</h2>
        <p>O monitor de documentos do BPO é visível só para a equipe Scont e administradores.</p></div>`;
      return;
    }
    const { data: sess } = await supabaseClient.auth.getSession();
    usuarioEmail = sess?.session?.user?.email || '';

    const qs = new URLSearchParams(window.location.search);
    if (/^\d{4}-\d{2}$/.test(qs.get('competencia') || '')) competencia = qs.get('competencia');

    document.querySelectorAll('#bpoNav .sidebar-item[data-tela]').forEach((b) => {
      b.addEventListener('click', () => mostrarTela(b.getAttribute('data-tela')));
    });
    $('bpoModalFechar').addEventListener('click', fecharModal);
    $('bpoModal').addEventListener('click', (e) => { if (e.target.id === 'bpoModal') fecharModal(); });

    try {
      await carregarBase();
    } catch (e) {
      console.error(e);
      toast('Tabelas do BPO não encontradas — rode schema_bpo_documentos.sql no Supabase.', 'erro');
    }
    mostrarTela(qs.get('tela') || 'painel');
  }

  async function carregarBase() {
    const [cfg, tps, emps, rh, vinc] = await Promise.all([
      supabaseClient.from('bpo_config').select('*').eq('id', 1).maybeSingle(),
      supabaseClient.from('bpo_tipos_documento').select('*').order('ordem').order('nome'),
      supabaseClient.from('bpo_empresas').select('*'),
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, cnpj, status_situacao').order('nome_empresa'),
      supabaseClient.from('bpo_vinculos').select('*'),
    ]);
    [cfg, tps, emps, rh, vinc].forEach((r) => { if (r.error) throw r.error; });
    if (!cfg.data) throw new Error('bpo_config vazia');
    config = cfg.data;
    tipos = tps.data || [];
    empresasCad = emps.data || [];
    vinculos = vinc.data || [];
    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    rhEmpresas = (rh.data || []).filter((e) => ativa(e.status_situacao));
    nomes = {};
    (rh.data || []).forEach((e) => { nomes[e.codigo_empresa] = e.nome_empresa; });
  }

  async function carregarCompetencia() {
    const [pubs, marc, alr, rel] = await Promise.all([
      lerTudo(() => supabaseClient.from('bpo_publicacoes').select('*').eq('competencia', competencia).order('id')),
      supabaseClient.from('bpo_marcacoes').select('*').eq('competencia', competencia),
      supabaseClient.from('bpo_alertas').select('*').eq('competencia', competencia).order('enviado_em', { ascending: false }),
      supabaseClient.from('bpo_relatorios').select('*').order('importado_em', { ascending: false }).limit(5),
    ]);
    publicacoes = pubs;
    marcacoes = marc.data || [];
    alertas = alr.data || [];
    relatorios = rel.data || [];
    linhas = U.calcularStatus(empresasCad, tipos, publicacoes, marcacoes);
  }

  function mostrarTela(id) {
    telaAtual = ['painel', 'importar', 'fila', 'empresas', 'config'].includes(id) ? id : 'painel';
    document.querySelectorAll('#bpoNav .sidebar-item').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tela') === telaAtual));
    ({ painel: renderPainel, importar: renderImportar, fila: renderFila, empresas: renderEmpresas, config: renderConfig })[telaAtual]();
  }

  function abrirMain(titulo, acoes, corpo) {
    $('main').innerHTML = `
      <div class="onboarding-header"><div><h2>${esc(titulo)}</h2></div><div class="onboarding-header-actions">${acoes || ''}</div></div>
      ${corpo}`;
  }

  function seletorCompetencia() {
    const op = U.listaCompetencias(new Date(), 12);
    if (!op.includes(competencia)) op.unshift(competencia);
    return `<select id="selCompetencia" class="bpo-select">${op.map((o) =>
      `<option value="${o}" ${o === competencia ? 'selected' : ''}>${U.competenciaTextos(o).curta}</option>`).join('')}</select>`;
  }

  function ligarSeletorCompetencia(recarregar) {
    $('selCompetencia')?.addEventListener('change', (e) => {
      competencia = e.target.value; filtroGrupo = '';
      history.replaceState(null, '', `?competencia=${competencia}&tela=${telaAtual}`);
      recarregar();
    });
  }

  function avisoModoTeste() {
    return config?.modo_teste
      ? `<div class="bpo-aviso bpo-aviso-alerta">🧪 <strong>Modo teste ligado</strong> — todos os e-mails vão só para ${esc(config.email_teste || '(e-mail de teste não configurado)')}. Desligue em Regras e textos quando for valer.</div>`
      : '';
  }

  function avisoRelatorio() {
    if (!relatorios.length) {
      return `<div class="bpo-aviso bpo-aviso-alerta">📥 Nenhum relatório importado ainda. Vá em <strong>Importar relatório</strong>.</div>`;
    }
    const r = relatorios[0];
    const dias = r.emitido_em ? (Date.now() - new Date(r.emitido_em).getTime()) / 864e5 : Infinity;
    const antigo = dias > (config?.dias_relatorio_antigo ?? 2);
    return `<div class="bpo-aviso ${antigo ? 'bpo-aviso-alerta' : 'bpo-aviso-ok'}">📄 Último relatório: período
      <strong>${esc(U.dataBr(r.periodo_ini))} a ${esc(U.dataBr(r.periodo_fim))}</strong>,
      emitido em <strong>${esc(U.dataBr(r.emitido_em, true) || '—')}</strong> · ${r.total_arquivos} arquivos.
      ${antigo ? '<strong>Relatório antigo — suba um novo antes de cobrar os clientes.</strong>' : ''}</div>`;
  }

  // ─── PAINEL ─────────────────────────────────────────────────

  async function renderPainel() {
    $('main').innerHTML = '<p class="nav-loading">Carregando...</p>';
    try { await carregarCompetencia(); } catch (e) { console.error(e); toast('Erro ao carregar a competência.', 'erro'); return; }
    const c = U.contar(linhas);
    const cal = U.calendarioCompetencia(competencia, config);
    const atual = U.etapaAtual(cal, hojeIso());
    const tiposAtivos = tipos.filter((t) => t.ativo);

    abrirMain(`Painel — competência ${U.competenciaTextos(competencia).curta}`,
      `${seletorCompetencia()}<button type="button" class="btn btn-secondary" id="btnExportar">📊 Exportar Excel</button>`,
      `${avisoModoTeste()}${avisoRelatorio()}
       <div class="bpo-etapas">${cal.map((e) => `
         <div class="bpo-etapa ${!e.ativa ? 'inativa' : (atual && atual.etapa === e.etapa ? 'atual' : (e.data < hojeIso() ? 'passada' : ''))}" ${!e.ativa ? 'title="Antes do início dos ciclos — ignorada"' : ''}>
           <strong>${esc(e.etapa)} · ${esc(U.TIPOS_ETAPA[e.tipo] || e.tipo)}</strong>${esc(U.dataBr(e.data))}</div>`).join('')}</div>
       <div class="bpo-cards">
         ${cartao('total', 'Documentos esperados', c.total)}
         ${cartao('ok', 'Recebidos', c.ok)}
         ${cartao('pendente', 'Pendentes', c.PENDENTE)}
         ${cartao('dispensado', 'Dispensados', c.DISPENSADO)}
       </div>
       <div class="mapa-filtros" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
         <input type="text" id="buscaPainel" class="bpo-input" placeholder="Buscar empresa ou código..." style="flex:1;min-width:220px">
         <select id="filtroTipo" class="bpo-select"><option value="">Todos os documentos</option>
           ${tiposAtivos.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select>
       </div>
       <div class="bpo-tabela-wrap"><table class="mapa-table bpo-tabela">
         <thead><tr><th>Cód.</th><th>Empresa</th><th>Documento</th><th>Situação</th><th>Arquivos</th><th>Alertas</th><th style="text-align:right">Ações</th></tr></thead>
         <tbody id="corpoPainel"></tbody>
       </table></div>`);

    ligarSeletorCompetencia(renderPainel);
    $('btnExportar').addEventListener('click', exportarExcel);
    $('buscaPainel').addEventListener('input', desenharTabela);
    $('filtroTipo').addEventListener('change', desenharTabela);
    document.querySelectorAll('.bpo-card').forEach((el) => el.addEventListener('click', () => {
      const g = el.getAttribute('data-grupo');
      filtroGrupo = filtroGrupo === g ? '' : g;
      document.querySelectorAll('.bpo-card').forEach((x) => x.classList.toggle('active', x.getAttribute('data-grupo') === filtroGrupo));
      desenharTabela();
    }));
    desenharTabela();
  }

  function cartao(grupo, rotulo, n) {
    return `<div class="bpo-card bpo-card-${grupo} ${filtroGrupo === grupo ? 'active' : ''}" data-grupo="${grupo}">
      <div class="num">${n}</div><div class="label">${esc(rotulo)}</div></div>`;
  }

  function grupoDaLinha(l) {
    if (l.situacao === 'PENDENTE') return 'pendente';
    if (l.situacao === 'DISPENSADO') return 'dispensado';
    return 'ok';
  }

  function nomeTipo(id) { return (tipos.find((t) => t.id === id) || {}).nome || '—'; }

  function filtradas() {
    const busca = ($('buscaPainel')?.value || '').trim().toLowerCase();
    const tipo = $('filtroTipo')?.value || '';
    return linhas.filter((l) =>
      (!filtroGrupo || filtroGrupo === 'total' || grupoDaLinha(l) === filtroGrupo) &&
      (!tipo || l.tipoId === tipo) &&
      (!busca || (nomes[l.codigo] || '').toLowerCase().includes(busca) || l.codigo === busca));
  }

  function desenharTabela() {
    const corpo = $('corpoPainel');
    if (!corpo) return;
    const lista = filtradas().sort((a, b) => (nomes[a.codigo] || '').localeCompare(nomes[b.codigo] || '', 'pt-BR'));
    if (!lista.length) {
      corpo.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">
        ${empresasCad.some((e) => e.possui_bpo) ? 'Nenhuma linha para os filtros.' : 'Nenhuma empresa marcada com BPO — marque em <strong>Empresas e e-mails</strong>.'}</td></tr>`;
      return;
    }
    let anterior = null;
    corpo.innerHTML = lista.map((l) => {
      const novo = l.codigo !== anterior;
      anterior = l.codigo;
      const s = U.SITUACOES[l.situacao];
      const enviados = alertas.filter((a) => a.ok && a.codigo_empresa === l.codigo).length;
      const arq = l.arquivos.length
        ? `<strong>${l.arquivos.length}</strong> · <span class="bpo-arq-nome" title="${esc(l.arquivos.map((a) => a.arquivo).join('\n'))}">${esc(l.arquivos[0].arquivo)}${l.arquivos.length > 1 ? ` e mais ${l.arquivos.length - 1}` : ''}</span>`
        : (l.manual ? esc(l.manual.motivo || 'marcado manualmente') : '—');
      const acoes = l.manual
        ? `<button class="bpo-link" data-acao="desfazer" data-cod="${esc(l.codigo)}" data-tipo="${l.tipoId}">Desfazer</button>`
        : (l.situacao === 'PENDENTE'
          ? `<button class="bpo-link" data-acao="RECEBIDO_MANUAL" data-cod="${esc(l.codigo)}" data-tipo="${l.tipoId}">Marcar recebido</button>
             <button class="bpo-link" data-acao="DISPENSADO" data-cod="${esc(l.codigo)}" data-tipo="${l.tipoId}">Dispensar</button>` : '');
      return `<tr class="${novo ? 'bpo-grupo-ini' : ''}"><td>${novo ? esc(l.codigo) : ''}</td><td>${novo ? `<strong>${esc(nomes[l.codigo] || '(sem nome)')}</strong>` : ''}</td><td>${esc(nomeTipo(l.tipoId))}</td>
        <td><span class="bpo-pill ${s.classe}">${s.label}</span></td><td class="bpo-arquivos">${arq}</td>
        <td>${novo ? (enviados || '—') : ''}</td><td class="acoes">${acoes}</td></tr>`;
    }).join('');
    corpo.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', () =>
      marcar(b.getAttribute('data-cod'), b.getAttribute('data-tipo'), b.getAttribute('data-acao'))));
  }

  async function marcar(codigo, tipoId, acao) {
    if (acao === 'desfazer') {
      const { error } = await supabaseClient.from('bpo_marcacoes').delete()
        .eq('competencia', competencia).eq('codigo_empresa', codigo).eq('tipo_id', tipoId);
      if (error) { toast('Erro ao desfazer a marcação.', 'erro'); return; }
    } else {
      const motivo = window.prompt(acao === 'DISPENSADO' ? 'Motivo da dispensa (opcional):' : 'Como foi recebido? (ex.: WhatsApp, e-mail) — opcional:');
      if (motivo === null) return;
      const { error } = await supabaseClient.from('bpo_marcacoes').upsert({
        competencia, codigo_empresa: codigo, tipo_id: tipoId, situacao: acao, motivo: motivo.trim() || null,
        marcado_por: usuarioEmail, marcado_em: new Date().toISOString(),
      });
      if (error) { toast('Erro ao salvar a marcação.', 'erro'); return; }
    }
    await carregarCompetencia();
    renderPainel();
  }

  function exportarExcel() {
    const dados = filtradas().map((l) => ({
      'Código': l.codigo, 'Empresa': nomes[l.codigo] || '', 'Documento': nomeTipo(l.tipoId),
      'Situação': U.SITUACOES[l.situacao].label, 'Arquivos': l.arquivos.map((a) => a.arquivo).join(' | '),
      'Observação': l.manual ? l.manual.motivo : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BPO');
    XLSX.writeFile(wb, `bpo-documentos-${competencia}.xlsx`);
  }

  // ─── IMPORTAR ───────────────────────────────────────────────

  function renderImportar() {
    importacao = null;
    abrirMain('Importar relatório "Documentos Publicados"', '', `
      <div class="bpo-secao">
        <p style="margin-top:0">No Onvio, emita o relatório <strong>Documentos Publicados</strong> do período desejado, exporte para Excel
        e suba o arquivo aqui. A ferramenta identifica o que cada cliente publicou e atualiza o painel.</p>
        <label class="bpo-dropzone" id="dropzone" for="arquivoRelatorio">
          <div class="emoji">📥</div>
          <p><strong>Clique para escolher</strong> ou arraste o arquivo .xlsx aqui</p>
        </label>
        <input type="file" id="arquivoRelatorio" accept=".xlsx,.xls" style="display:none">
      </div>
      <div id="previaImportacao"></div>`);
    const input = $('arquivoRelatorio');
    input.addEventListener('change', () => { if (input.files[0]) lerArquivo(input.files[0]); });
    const dz = $('dropzone');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) lerArquivo(e.dataTransfer.files[0]); });
  }

  async function lerArquivo(arquivo) {
    const previa = $('previaImportacao');
    previa.innerHTML = '<p class="nav-loading">Lendo o relatório...</p>';
    try {
      const buf = await arquivo.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
      const rel = U.parseRelatorio(rows);
      if (!rel.clientes.length || !rel.periodo.ini) {
        previa.innerHTML = `<div class="bpo-aviso bpo-aviso-erro">❌ ${esc(rel.avisos.join(' ') || 'Arquivo não reconhecido.')}</div>`;
        return;
      }
      await carregarBase();
      const casamento = U.casarClientes(rel.clientes, rhEmpresas, vinculos);
      importacao = { rel, casamento, arquivoNome: arquivo.name, ligacoes: {}, competencia: U.competenciaSugerida(rel.periodo.fim) };
      desenharPrevia();
    } catch (e) {
      console.error(e);
      previa.innerHTML = '<div class="bpo-aviso bpo-aviso-erro">❌ Não foi possível ler o arquivo.</div>';
    }
  }

  function desenharPrevia() {
    const { rel, casamento } = importacao;
    const marcadas = new Set(empresasCad.filter((e) => e.possui_bpo).map((e) => e.codigo_empresa));
    const recBpo = casamento.reconhecidos.filter((r) => marcadas.has(r.codigo)).length;
    const aprox = casamento.reconhecidos.filter((r) => r.metodo === 'aproximado').length;
    const opcoesEmp = rhEmpresas.map((e) => `<option value="${esc(e.codigo_empresa)}">${esc(e.nome_empresa)} (${esc(e.codigo_empresa)})</option>`).join('');

    $('previaImportacao').innerHTML = `
      <div class="bpo-secao">
        <h3>Prévia da importação</h3>
        <p>Período <strong>${esc(U.dataBr(rel.periodo.ini))} a ${esc(U.dataBr(rel.periodo.fim))}</strong> ·
           emitido em <strong>${esc(U.dataBr(rel.emitidoEm, true) || '—')}</strong> ·
           ${rel.clientes.length} clientes · ${rel.totalArquivos} arquivos</p>
        <p>✅ ${casamento.reconhecidos.length} reconhecidos (${recBpo} com BPO${aprox ? `, ${aprox} por nome aproximado` : ''}) ·
           ⚠️ ${casamento.naoReconhecidos.length} não reconhecidos · 🚫 ${casamento.ignorados.length} ignorados</p>
        <p style="margin:6px 0 0"><strong>Competências identificadas</strong> (mês anterior à data de publicação de cada arquivo):</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${resumoCompetencias(casamento.reconhecidos)}</div>
        <small style="display:block;color:var(--muted);margin-top:8px">Importar de novo o mesmo cliente e período substitui só os arquivos dele; relatórios de outros clientes ou meses não são afetados.</small>
      </div>
      ${casamento.naoReconhecidos.length ? `
      <div class="bpo-secao">
        <h3>Nomes não reconhecidos (${casamento.naoReconhecidos.length})</h3>
        <p style="margin-top:0;color:var(--muted);font-size:.85rem">Vincule à empresa do cadastro ou ignore. O vínculo fica salvo para os próximos relatórios.
           Linhas em branco ficam de fora desta importação (e aparecem de novo no próximo relatório).</p>
        <datalist id="listaEmpresasRh">${opcoesEmp}</datalist>
        <div class="bpo-vinc-barra">
          <input type="text" id="buscaNaoRec" class="bpo-input" placeholder="Filtrar por nome..." style="flex:1;min-width:220px">
          <label style="font-size:.85rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="soMonitorados"> Só com arquivos em pastas monitoradas</label>
          <button type="button" class="btn btn-secondary" id="btnIgnorarVisiveis">Ignorar todos os visíveis</button>
        </div>
        <div class="bpo-scroll"><table class="mapa-table bpo-tabela"><thead><tr>
          <th>Nome no relatório</th><th style="text-align:right">Arquivos</th><th style="text-align:right" title="Arquivos nas pastas dos tipos de documento ativos">Monitorados</th><th>Vincular a</th><th>Ignorar</th></tr></thead><tbody id="corpoNaoRec">
        ${casamento.naoReconhecidos.map((c, i) => {
          const mon = c.arquivos.filter((a) => tipos.some((t) => t.ativo && U.arquivoCasaTipo({ pasta: a.pasta, arquivo: a.arquivo, excluidoEm: a.excluidoEm }, t))).length;
          const sug = casamento.sugestoes.get(c.nomeNormalizado) || [];
          const rotulo = (s) => `${s.nome} (${s.codigo})`;
          // pré-preenche só quando a melhor sugestão é forte e destacada das demais; o usuário ainda confirma
          const auto = sug[0] && sug[0].score >= 0.85 && (!sug[1] || sug[0].score - sug[1].score >= 0.1) ? sug[0] : null;
          const chips = sug.filter((s) => s !== auto).map((s) =>
            `<button type="button" class="vinc-sug" data-i="${i}" data-val="${esc(rotulo(s))}" title="Usar esta empresa" style="border:0;background:none;padding:0;color:var(--muted);font-size:.75rem;cursor:pointer;text-decoration:underline">${esc(rotulo(s))} · ${Math.round(s.score * 100)}%</button>`).join('<br>');
          return `<tr data-nome="${esc(c.nome.toLowerCase())}" data-mon="${mon}">
          <td>${esc(c.nome)}</td><td style="text-align:right">${c.arquivos.length}</td>
          <td style="text-align:right">${mon ? `<span class="bpo-monitorado">${mon}</span>` : '—'}</td>
          <td><input type="text" class="bpo-input vinc-emp" list="listaEmpresasRh" data-i="${i}" placeholder="Buscar empresa..." value="${auto ? esc(rotulo(auto)) : ''}">
            ${auto ? `<small style="color:var(--muted)">Sugerido (${Math.round(auto.score * 100)}%) — confira antes de confirmar</small>` : ''}${chips ? `<div>${chips}</div>` : ''}</td>
          <td style="text-align:center"><input type="checkbox" class="vinc-ign" data-i="${i}"></td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>` : ''}
      <div class="bpo-acoes-fixas">
        <span class="resumo">${rel.clientes.length} clientes · ${rel.totalArquivos} arquivos</span>
        <button class="btn btn-secondary" id="btnCancelarImport">Cancelar</button>
        <button class="btn btn-primary" id="btnConfirmarImport">Confirmar importação</button>
      </div>
      <div id="progressoImport"></div>`;
    $('btnCancelarImport').addEventListener('click', renderImportar);
    $('btnConfirmarImport').addEventListener('click', confirmarImportacao);
    if ($('corpoNaoRec')) {
      const filtrar = () => {
        const q = $('buscaNaoRec').value.trim().toLowerCase();
        const so = $('soMonitorados').checked;
        $('corpoNaoRec').querySelectorAll('tr').forEach((tr) => {
          const ok = (!q || tr.getAttribute('data-nome').includes(q)) && (!so || parseInt(tr.getAttribute('data-mon'), 10) > 0);
          tr.style.display = ok ? '' : 'none';
        });
      };
      $('corpoNaoRec').addEventListener('click', (ev) => {
        const b = ev.target.closest('.vinc-sug');
        if (b) document.querySelector(`.vinc-emp[data-i="${b.getAttribute('data-i')}"]`).value = b.getAttribute('data-val');
      });
      $('buscaNaoRec').addEventListener('input', filtrar);
      $('soMonitorados').addEventListener('change', filtrar);
      $('btnIgnorarVisiveis').addEventListener('click', () => {
        $('corpoNaoRec').querySelectorAll('tr').forEach((tr) => {
          if (tr.style.display !== 'none') tr.querySelector('.vinc-ign').checked = true;
        });
      });
    }
  }

  function resumoCompetencias(reconhecidos) {
    const por = {};
    reconhecidos.forEach((r) => r.cliente.arquivos.forEach((a) => {
      const c = U.competenciaDaPublicacao(a.publicadoEm) || importacao.competencia;
      por[c] = (por[c] || 0) + 1;
    }));
    const chaves = Object.keys(por).sort();
    if (!chaves.length) return '<span class="bpo-pill bpo-sit-neutro">nenhum arquivo de empresa reconhecida</span>';
    return chaves.map((c) => `<span class="bpo-pill bpo-sit-neutro">${esc(U.competenciaTextos(c).curta)} · ${por[c]} arquivo(s)</span>`).join('');
  }

  function codigoDeEntrada(texto) {
    const m = /\(([^()]+)\)\s*$/.exec(texto || '');
    return m ? m[1].trim() : null;
  }

  async function confirmarImportacao() {
    const btn = $('btnConfirmarImport');
    btn.disabled = true;
    const { rel, casamento } = importacao;
    const prog = $('progressoImport');
    const passo = (pct, t) => { prog.innerHTML = `<div class="bpo-progresso"><div style="width:${pct}%"></div></div><small>${esc(t)}</small>`; };
    try {
      // 1. vínculos escolhidos nos não reconhecidos
      const novosVinc = [];
      const extras = [];
      casamento.naoReconhecidos.forEach((cl, i) => {
        const ign = document.querySelector(`.vinc-ign[data-i="${i}"]`)?.checked;
        const cod = codigoDeEntrada(document.querySelector(`.vinc-emp[data-i="${i}"]`)?.value);
        if (ign) novosVinc.push({ nome_normalizado: cl.nomeNormalizado, nome_original: cl.nome, codigo_empresa: null, ignorar: true });
        else if (cod && nomes[cod]) {
          novosVinc.push({ nome_normalizado: cl.nomeNormalizado, nome_original: cl.nome, codigo_empresa: cod, ignorar: false });
          extras.push({ cliente: cl, codigo: cod });
        }
      });
      if (novosVinc.length) {
        passo(5, 'Salvando vínculos...');
        const { error } = await supabaseClient.from('bpo_vinculos').upsert(novosVinc);
        if (error) throw error;
      }
      const reconhecidos = casamento.reconhecidos.concat(extras);

      // 2. registra o relatório (histórico; nunca apaga relatórios anteriores)
      passo(10, 'Registrando o relatório...');
      const totalArq = reconhecidos.reduce((n, r) => n + r.cliente.arquivos.length, 0);
      const ins = await supabaseClient.from('bpo_relatorios').insert({
        periodo_ini: rel.periodo.ini, periodo_fim: rel.periodo.fim, emitido_em: rel.emitidoEm,
        competencia: importacao.competencia, arquivo_nome: importacao.arquivoNome,
        total_clientes: reconhecidos.length, total_arquivos: totalArq, importado_por: usuarioEmail,
      }).select('id').single();
      if (ins.error) throw ins.error;
      const relId = ins.data.id;

      // 3. remove só as publicações ANTERIORES das mesmas empresas dentro do período deste
      //    arquivo (reimportar o mesmo cliente/período substitui; outros clientes ficam intactos)
      passo(14, 'Substituindo publicações anteriores das mesmas empresas...');
      const codigos = Array.from(new Set(reconhecidos.map((r) => r.codigo)));
      for (let i = 0; i < codigos.length; i += 100) {
        const d = await supabaseClient.from('bpo_publicacoes').delete()
          .in('codigo_empresa', codigos.slice(i, i + 100))
          .gte('publicado_em', rel.periodo.ini + 'T00:00:00-03:00')
          .lte('publicado_em', rel.periodo.fim + 'T23:59:59-03:00');
        if (d.error) throw d.error;
      }

      // 4. publicações em lotes — competência por arquivo (mês anterior à data de publicação)
      const pubs = [];
      reconhecidos.forEach((r) => r.cliente.arquivos.forEach((a) => pubs.push({
        relatorio_id: relId,
        competencia: U.competenciaDaPublicacao(a.publicadoEm) || importacao.competencia,
        codigo_empresa: r.codigo,
        pasta: a.pasta, arquivo: a.arquivo, vencimento: a.vencimento, publicado_em: a.publicadoEm,
        publicado_por: a.publicadoPor, visualizado_em: a.visualizadoEm, excluido_em: a.excluidoEm,
      })));
      for (let i = 0; i < pubs.length; i += 500) {
        passo(15 + Math.round((i / Math.max(pubs.length, 1)) * 80), `Gravando publicações (${Math.min(i + 500, pubs.length)} de ${pubs.length})...`);
        const r = await supabaseClient.from('bpo_publicacoes').insert(pubs.slice(i, i + 500));
        if (r.error) throw r.error;
      }
      passo(100, 'Concluído.');
      toast(`Relatório importado: ${reconhecidos.length} clientes, ${pubs.length} arquivos.`, 'sucesso');
      // abre o painel na competência mais recente encontrada no arquivo
      const comps = pubs.map((p) => p.competencia).sort();
      competencia = comps.length ? comps[comps.length - 1] : importacao.competencia;
      await carregarBase();
      mostrarTela('painel');
    } catch (e) {
      console.error(e);
      toast('Erro ao importar: ' + (e.message || e), 'erro');
      btn.disabled = false;
    }
  }

  // ─── FILA DE ALERTAS ────────────────────────────────────────

  let etapaSelecionada = null;

  async function renderFila() {
    $('main').innerHTML = '<p class="nav-loading">Carregando...</p>';
    try { await carregarCompetencia(); } catch (e) { console.error(e); toast('Erro ao carregar.', 'erro'); return; }
    const cal = U.calendarioCompetencia(competencia, config);
    const atual = U.etapaAtual(cal, hojeIso());
    if (!etapaSelecionada || !cal.some((e) => e.etapa === etapaSelecionada)) {
      etapaSelecionada = (atual || cal[0] || {}).etapa || null;
    }
    const et = cal.find((e) => e.etapa === etapaSelecionada);
    const ehRelatorio = et && et.tipo === 'relatorio';
    const antesDoInicio = !!et && !et.ativa;
    const tipoTexto = ehRelatorio ? 'relatorio' : (et ? et.tipo : 'lembrete');

    const fila = (ehRelatorio || antesDoInicio) ? [] : U.montarFila(linhas, empresasCad, tipos, nomes, alertas, etapaSelecionada, config);
    const enviaveis = fila.filter((f) => !f.semEmail && !f.jaEnviado);
    const limite = U.dataLimite(cal);

    abrirMain(`Fila de alertas — competência ${U.competenciaTextos(competencia).curta}`,
      `${seletorCompetencia()}
       <select id="selEtapa" class="bpo-select">${cal.map((e) => `<option value="${esc(e.etapa)}" ${e.etapa === etapaSelecionada ? 'selected' : ''}>
         ${esc(e.etapa)} · ${esc(U.TIPOS_ETAPA[e.tipo] || e.tipo)} · ${esc(U.dataBr(e.data))}${atual && atual.etapa === e.etapa ? ' (atual)' : ''}${!e.ativa ? ' — antes do início' : ''}</option>`).join('')}</select>`,
      `${avisoModoTeste()}${avisoRelatorio()}
       <div class="bpo-aviso">📌 Alertas enviados em <strong>${esc(U.cicloTextos(competencia).mesCiclo)}</strong> cobram a <strong>competência ${esc(U.cicloTextos(competencia).competencia)}</strong> (sempre o mês anterior).</div>
       ${!atual ? '<div class="bpo-aviso">📅 O ciclo desta competência ainda não começou. Você pode antecipar escolhendo uma etapa acima.</div>' : ''}
       ${antesDoInicio ? `<div class="bpo-aviso bpo-aviso-alerta">⏳ Esta etapa é anterior ao <strong>início dos ciclos</strong> (${esc(U.dataBr(config.inicio_ciclos))}) e não gera alertas. Ajuste em Regras e textos ou escolha outra etapa.</div>` : (ehRelatorio ? blocoRelatorio() : blocoFila(fila, enviaveis, tipoTexto, limite))}`);

    ligarSeletorCompetencia(() => { etapaSelecionada = null; renderFila(); });
    $('selEtapa').addEventListener('change', (e) => { etapaSelecionada = e.target.value; renderFila(); });
    if (antesDoInicio) { /* nada a ligar */ } else if (ehRelatorio) $('btnEnviarRelatorio').addEventListener('click', enviarRelatorio);
    else {
      document.querySelectorAll('.chk-fila').forEach((c) => c.addEventListener('change', atualizarContadorFila));
      $('chkTodos')?.addEventListener('change', (e) => {
        document.querySelectorAll('.chk-fila:not(:disabled)').forEach((c) => { c.checked = e.target.checked; });
        atualizarContadorFila();
      });
      $('btnEnviarFila')?.addEventListener('click', () => enviarFila(fila, tipoTexto));
      atualizarContadorFila();
    }
  }

  function blocoFila(fila, enviaveis, tipoTexto, limite) {
    if (!tipos.some((t) => t.ativo)) return '<div class="bpo-aviso bpo-aviso-alerta">Nenhum tipo de documento ativo — configure em Regras e textos.</div>';
    if (!empresasCad.some((e) => e.possui_bpo)) return '<div class="bpo-aviso bpo-aviso-alerta">Nenhuma empresa marcada com BPO — marque em Empresas e e-mails.</div>';
    if (!fila.length) return '<div class="bpo-aviso bpo-aviso-ok">✅ Nenhuma empresa com documento pendente nesta competência.</div>';
    const vars = { cliente: '[Nome do cliente]', competencia: U.competenciaTextos(competencia).curta,
      competencia_extenso: U.competenciaTextos(competencia).extenso, data_limite: limite ? U.dataBr(limite) : 'o quanto antes',
      documentos: '- ' + (tipos.filter((t) => t.ativo).map((t) => t.nome).join('\n- ')) };
    const assunto = U.aplicarVariaveis(config['assunto_' + tipoTexto] || '', vars);
    const corpo = U.textoParaHtml(config['texto_' + tipoTexto] || '', vars);
    return `
      <div class="bpo-secao">
        <h3>Texto que será enviado (${esc(U.TIPOS_ETAPA[tipoTexto] || tipoTexto)})</h3>
        <p style="margin:0 0 8px"><strong>Assunto:</strong> ${esc(assunto)}</p>
        <iframe class="bpo-email-frame" title="Pré-visualização do e-mail" srcdoc="${esc(U.envelopeEmail('Scont Soluções Contábeis', U.tituloEmail(tipoTexto, vars.competencia) + corpo))}"></iframe>
      </div>
      <div class="bpo-secao">
        <h3>Empresas com pendência (${fila.length}) <small style="font-weight:400;color:var(--muted)">— ${enviaveis.length} podem receber agora</small></h3>
        <div class="bpo-tabela-wrap"><table class="mapa-table bpo-tabela">
          <thead><tr><th><input type="checkbox" id="chkTodos" checked></th><th>Empresa</th><th>Documentos pendentes</th><th>E-mails</th><th>Situação</th></tr></thead>
          <tbody>${fila.map((f, i) => {
            const bloqueado = f.semEmail || f.jaEnviado;
            return `<tr><td><input type="checkbox" class="chk-fila" data-i="${i}" ${bloqueado ? 'disabled' : 'checked'}></td>
              <td>${esc(f.nome)}<br><small style="color:var(--muted)">${esc(f.codigo)}</small></td>
              <td>${esc(f.documentos.join(', '))}</td>
              <td>${f.semEmail ? '—' : esc(f.para.join(', '))}</td>
              <td>${f.jaEnviado ? '<span class="bpo-pill bpo-sit-ok">Já enviado nesta etapa</span>'
                : (f.semEmail ? '<span class="bpo-pill bpo-sit-pend">Sem e-mail</span>' : '<span class="bpo-pill bpo-sit-neutro">Na fila</span>')}</td></tr>`;
          }).join('')}</tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:10px;flex-wrap:wrap">
          <small id="contadorFila" style="color:var(--muted)"></small>
          <button class="btn btn-primary" id="btnEnviarFila">✉️ Enviar selecionados</button>
        </div>
        <div id="progressoFila"></div>
      </div>`;
  }

  function atualizarContadorFila() {
    const n = document.querySelectorAll('.chk-fila:checked').length;
    const el = $('contadorFila');
    if (el) el.textContent = `${n} selecionada(s)`;
    const b = $('btnEnviarFila');
    if (b) b.disabled = n === 0;
  }

  async function chamarFuncao(body) {
    const { data, error } = await supabaseClient.functions.invoke('bpo-alertas', { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) { /* mantém msg */ }
      throw new Error(msg);
    }
    if (!data?.ok) throw new Error(data?.error || 'Falha no envio.');
    return data;
  }

  async function enviarFila(fila, tipoTexto) {
    const marcados = Array.from(document.querySelectorAll('.chk-fila:checked')).map((c) => fila[parseInt(c.getAttribute('data-i'), 10)]);
    if (!marcados.length) return;
    const aviso = config.modo_teste ? `Modo teste: os e-mails irão só para ${config.email_teste || '(não configurado)'}.` : 'Os e-mails serão enviados aos CLIENTES.';
    if (!window.confirm(`Enviar ${marcados.length} alerta(s)?\n\n${aviso}`)) return;
    $('btnEnviarFila').disabled = true;
    const prog = $('progressoFila');
    let ok = 0; const falhas = [];
    const cal = U.calendarioCompetencia(competencia, config);
    const limite = U.dataLimite(cal);
    for (let i = 0; i < marcados.length; i++) {
      const f = marcados[i];
      prog.innerHTML = `<div class="bpo-progresso"><div style="width:${Math.round((i / marcados.length) * 100)}%"></div></div><small>Enviando ${i + 1} de ${marcados.length}: ${esc(f.nome)}</small>`;
      try {
        await chamarFuncao({ acao: 'cobrar', competencia, codigo_empresa: f.codigo, etapa: etapaSelecionada,
          tipo_texto: tipoTexto, tipo_ids: f.tipoIds, data_limite: limite });
        ok += 1;
      } catch (e) { falhas.push(`${f.nome}: ${e.message}`); }
    }
    toast(`${ok} enviado(s)${falhas.length ? `, ${falhas.length} com falha` : ''}.`, falhas.length ? 'erro' : 'sucesso');
    if (falhas.length) abrirModal('Falhas no envio', `<ul>${falhas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, '');
    renderFila();
  }

  function blocoRelatorio() {
    const c = U.contar(linhas);
    const pend = linhas.filter((l) => l.situacao === 'PENDENTE');
    const semMail = new Set(pend.map((l) => l.codigo)).size;
    const jaEnviado = alertas.some((a) => a.ok && a.tipo_texto === 'relatorio');
    return `<div class="bpo-secao">
      <h3>Relatório para a chefe</h3>
      <p>Resumo da competência: <strong>${c.PENDENTE}</strong> documento(s) pendente(s) em <strong>${semMail}</strong> empresa(s);
         ${c.ok} recebido(s); ${c.DISPENSADO} dispensado(s).</p>
      <p style="color:var(--muted);font-size:.85rem">Destinatário: ${esc(config.email_chefe || '(e-mail da chefe não configurado)')}
         ${jaEnviado ? ' · <strong>já enviado nesta competência</strong>' : ''}</p>
      <button class="btn btn-primary" id="btnEnviarRelatorio">📋 Enviar relatório</button>
    </div>`;
  }

  async function enviarRelatorio() {
    if (!window.confirm('Enviar o relatório de pendências para a chefe?' + (config.modo_teste ? '\n\n(Modo teste: vai só para o e-mail de teste.)' : ''))) return;
    const itens = linhas.filter((l) => l.situacao === 'PENDENTE').map((l) => ({
      codigo: l.codigo, nome: nomes[l.codigo] || l.codigo, documento: nomeTipo(l.tipoId),
      alertas: alertas.filter((a) => a.ok && a.codigo_empresa === l.codigo).length,
    }));
    try {
      const r = await chamarFuncao({ acao: 'relatorio', competencia, etapa: etapaSelecionada, itens,
        resumo: U.contar(linhas), portal_url: window.location.origin + window.location.pathname });
      toast(`Relatório enviado${r.modo_teste ? ' (modo teste)' : ''}.`, 'sucesso');
      renderFila();
    } catch (e) { toast('Erro: ' + e.message, 'erro'); }
  }

  // ─── EMPRESAS ───────────────────────────────────────────────

  function cadDe(codigo) { return empresasCad.find((e) => e.codigo_empresa === codigo) || null; }

  function renderEmpresas() {
    abrirMain('Empresas e e-mails',
      '<span class="bpo-pill bpo-sit-neutro" id="contEmp"></span><button type="button" class="btn btn-secondary" id="btnPlanilhaEmp">📥 Importar planilha</button>', `
      <p style="color:var(--muted);margin-top:0">Marque as empresas que possuem <strong>BPO financeiro</strong>. Só elas são monitoradas
      e recebem alertas. Os e-mails (separados por vírgula) são usados nas cobranças.
      Para marcar várias de uma vez, filtre a lista e use os botões em massa, ou importe uma planilha Excel.</p>
      <div class="mapa-filtros" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <input type="text" id="buscaEmp" class="bpo-input" placeholder="Buscar empresa ou código..." style="flex:1;min-width:220px">
        <select id="filtroBpo" class="bpo-select"><option value="">Todas</option><option value="sim">Com BPO</option><option value="nao">Sem BPO</option></select>
      </div>
      <div class="bpo-massa">
        <span id="infoFiltro"></span>
        <button type="button" class="btn btn-secondary" id="btnMarcarTodos">✔ Marcar BPO nas filtradas</button>
        <button type="button" class="btn btn-secondary" id="btnDesmarcarTodos">✖ Remover BPO das filtradas</button>
      </div>
      <div class="bpo-scroll bpo-scroll-alto"><table class="mapa-table bpo-tabela">
        <thead><tr><th><input type="checkbox" id="chkTodosEmp" title="Marcar/desmarcar as empresas exibidas"></th><th>Cód.</th><th>Empresa</th><th>E-mails</th><th>Com cópia (CC)</th></tr></thead>
        <tbody id="corpoEmp"></tbody></table></div>`);
    const LIMITE = 400;
    const filtradas = () => {
      const busca = $('buscaEmp').value.trim().toLowerCase();
      const f = $('filtroBpo').value;
      return rhEmpresas.filter((e) => {
        const cad = cadDe(e.codigo_empresa);
        const bpo = !!(cad && cad.possui_bpo);
        return (!busca || e.nome_empresa.toLowerCase().includes(busca) || e.codigo_empresa === busca) &&
          (!f || (f === 'sim') === bpo);
      });
    };
    const atualizarContagens = () => {
      const n = empresasCad.filter((e) => e.possui_bpo).length;
      $('contEmp').textContent = `${n} com BPO · ${rhEmpresas.length} empresas ativas`;
      const total = filtradas().length;
      $('infoFiltro').textContent = `${total} empresa(s) no filtro${total > LIMITE ? ` · exibindo as ${LIMITE} primeiras` : ''}`;
      const vis = Array.from($('corpoEmp').querySelectorAll('.emp-bpo'));
      const marc = vis.filter((c) => c.checked).length;
      const chk = $('chkTodosEmp');
      chk.checked = vis.length > 0 && marc === vis.length;
      chk.indeterminate = marc > 0 && marc < vis.length;
    };
    const desenhar = () => {
      const lista = filtradas().slice(0, LIMITE);
      $('corpoEmp').innerHTML = lista.map((e) => {
        const cad = cadDe(e.codigo_empresa) || {};
        return `<tr data-cod="${esc(e.codigo_empresa)}" class="${cad.possui_bpo ? '' : 'bpo-sem'}">
          <td><input type="checkbox" class="emp-bpo" ${cad.possui_bpo ? 'checked' : ''}></td>
          <td>${esc(e.codigo_empresa)}</td><td>${esc(e.nome_empresa)}</td>
          <td><input type="text" class="bpo-input emp-emails" value="${esc((cad.emails || []).join(', '))}" placeholder="financeiro@cliente.com.br"></td>
          <td><input type="text" class="bpo-input emp-cc" value="${esc((cad.emails_cc || []).join(', '))}" placeholder="opcional"></td></tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Nada encontrado.</td></tr>';
      $('corpoEmp').querySelectorAll('tr[data-cod]').forEach((tr) => {
        tr.querySelectorAll('input').forEach((i) => i.addEventListener('change', async () => {
          await salvarEmpresa(tr);
          atualizarContagens();
        }));
      });
      atualizarContagens();
    };

    $('buscaEmp').addEventListener('input', desenhar);
    $('filtroBpo').addEventListener('change', desenhar);
    $('btnMarcarTodos').addEventListener('click', () => marcarEmMassa(filtradas(), true, desenhar));
    $('btnDesmarcarTodos').addEventListener('click', () => marcarEmMassa(filtradas(), false, desenhar));
    $('chkTodosEmp').addEventListener('change', (e) => {
      marcarEmMassa(filtradas().slice(0, LIMITE), e.target.checked, desenhar, true);
    });
    $('btnPlanilhaEmp').addEventListener('click', abrirImportacaoPlanilha);
    desenhar();
  }

  // Grava possui_bpo para uma lista de empresas (preserva e-mails já cadastrados), em lotes.
  async function marcarEmMassa(lista, valor, redesenhar, semConfirmar) {
    const alvo = lista.filter((e) => !!(cadDe(e.codigo_empresa) || {}).possui_bpo !== valor);
    if (!alvo.length) { toast('Nada a alterar no filtro atual.', 'sucesso'); redesenhar(); return; }
    if (!semConfirmar && !window.confirm(`${valor ? 'Marcar' : 'Remover'} BPO em ${alvo.length} empresa(s)?`)) { redesenhar(); return; }
    const regs = alvo.map((e) => {
      const cad = cadDe(e.codigo_empresa) || {};
      return { codigo_empresa: e.codigo_empresa, possui_bpo: valor, emails: cad.emails || [], emails_cc: cad.emails_cc || [], updated_por: usuarioEmail };
    });
    try {
      await gravarEmpresasEmLotes(regs);
      toast(`${regs.length} empresa(s) atualizada(s).`, 'sucesso');
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar em massa: ' + (e.message || e), 'erro');
    }
    redesenhar();
  }

  async function gravarEmpresasEmLotes(regs) {
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200);
      const { error } = await supabaseClient.from('bpo_empresas').upsert(lote);
      if (error) throw error;
      lote.forEach((r) => {
        const k = empresasCad.findIndex((e) => e.codigo_empresa === r.codigo_empresa);
        if (k >= 0) empresasCad[k] = { ...empresasCad[k], ...r }; else empresasCad.push(r);
      });
    }
  }

  // ─── IMPORTAÇÃO DE PLANILHA DE EMPRESAS ─────────────────────

  let planilhaEmpresas = null;

  function abrirImportacaoPlanilha() {
    planilhaEmpresas = null;
    abrirModal('Importar planilha de empresas com BPO', `
      <p style="margin-top:0">Suba uma planilha Excel com uma linha por empresa. Colunas aceitas (a 1ª linha é o cabeçalho):</p>
      <ul style="font-size:.88rem;color:var(--muted)">
        <li><strong>Código</strong> (código Domínio) <em>e/ou</em> <strong>Empresa</strong> (nome) — para identificar a empresa;</li>
        <li><strong>E-mails</strong> e <strong>CC</strong> (separados por vírgula ou ponto e vírgula) — opcionais;</li>
        <li><strong>Possui BPO</strong> (Sim/Não) — opcional; sem esta coluna, todas as linhas ficam com BPO.</li>
      </ul>
      <p><button type="button" class="btn btn-secondary" id="btnModeloPlanilha">⬇ Baixar modelo</button></p>
      <label class="bpo-dropzone" id="dropPlanilha" for="arquivoPlanilha"><div class="emoji">📥</div>
        <p><strong>Clique para escolher</strong> ou arraste a planilha (.xlsx) aqui</p></label>
      <input type="file" id="arquivoPlanilha" accept=".xlsx,.xls,.csv" style="display:none">
      <div id="previaPlanilha"></div>`, '<button class="btn btn-secondary" id="btnFecharPlanilha">Fechar</button>');
    $('btnFecharPlanilha').addEventListener('click', fecharModal);
    $('btnModeloPlanilha').addEventListener('click', baixarModeloPlanilha);
    const input = $('arquivoPlanilha');
    input.addEventListener('change', () => { if (input.files[0]) lerArquivoPlanilha(input.files[0]); });
    const dz = $('dropPlanilha');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) lerArquivoPlanilha(e.dataTransfer.files[0]); });
  }

  function baixarModeloPlanilha() {
    const exemplo = rhEmpresas.slice(0, 3).map((e) => ({
      'Código': e.codigo_empresa, 'Empresa': e.nome_empresa, 'E-mails': 'financeiro@cliente.com.br', 'CC': '', 'Possui BPO': 'Sim',
    }));
    const ws = XLSX.utils.json_to_sheet(exemplo.length ? exemplo : [{ 'Código': '', 'Empresa': '', 'E-mails': '', 'CC': '', 'Possui BPO': 'Sim' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas BPO');
    XLSX.writeFile(wb, 'modelo-empresas-bpo.xlsx');
  }

  function htmlNaoEncontrados(r) {
    if (!r.naoEncontrados.length) return '';
    return `<div class="bpo-aviso bpo-aviso-alerta">⚠️ <strong>${r.naoEncontrados.length}</strong> linha(s) não encontrada(s) no cadastro de empresas ativas (ficam de fora):
      <div style="max-height:110px;overflow:auto;font-size:.82rem;margin-top:6px">${r.naoEncontrados.slice(0, 50).map((n) => `linha ${n.linha}: ${esc(n.texto)}`).join('<br>')}
      ${r.naoEncontrados.length > 50 ? '<br>…' : ''}</div></div>`;
  }

  async function lerArquivoPlanilha(arquivo) {
    const previa = $('previaPlanilha');
    previa.innerHTML = '<p class="nav-loading">Lendo a planilha...</p>';
    try {
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      const r = U.lerPlanilhaEmpresas(rows, rhEmpresas);
      planilhaEmpresas = r;
      if (!r.itens.length) {
        previa.innerHTML = `<div class="bpo-aviso bpo-aviso-erro">❌ ${esc(r.avisos.join(' ') || 'Nenhuma empresa da planilha foi encontrada no cadastro.')}</div>${htmlNaoEncontrados(r)}`;
        return;
      }
      const jaTinham = r.itens.filter((i) => !!(cadDe(i.codigo) || {}).possui_bpo).length;
      const marcar = r.itens.filter((i) => i.possui_bpo).length;
      previa.innerHTML = `
        <div class="bpo-aviso bpo-aviso-ok">✅ <strong>${r.itens.length}</strong> empresa(s) reconhecida(s):
          <strong>${marcar}</strong> com BPO, ${r.itens.length - marcar} sem BPO ·
          ${jaTinham} já estavam marcadas${r.duplicados ? ` · ${r.duplicados} linha(s) repetida(s) ignorada(s)` : ''}.</div>
        ${htmlNaoEncontrados(r)}
        <div class="bpo-massa" style="flex-direction:column;align-items:flex-start">
          <label><input type="checkbox" id="plSomente"> Remover o BPO das empresas que <strong>não</strong> estão na planilha
            <small style="display:block;color:var(--muted)">A planilha passa a ser a lista completa de quem tem BPO.</small></label>
          <label><input type="checkbox" id="plSobrescrever"> Substituir e-mails já cadastrados pelos da planilha
            <small style="display:block;color:var(--muted)">Desmarcado: a planilha só preenche e-mails vazios.</small></label>
        </div>
        <div class="bpo-scroll" style="max-height:240px"><table class="mapa-table bpo-tabela"><thead><tr><th>Cód.</th><th>Empresa</th><th>BPO</th><th>E-mails</th></tr></thead><tbody>
          ${r.itens.slice(0, 100).map((i) => `<tr><td>${esc(i.codigo)}</td><td>${esc(i.nome)}</td>
            <td>${i.possui_bpo ? 'Sim' : 'Não'}</td><td>${esc(i.emails.join(', ') || '—')}</td></tr>`).join('')}
          ${r.itens.length > 100 ? `<tr><td colspan="4" style="color:var(--muted)">… e mais ${r.itens.length - 100}</td></tr>` : ''}
        </tbody></table></div>
        <div style="text-align:right;margin-top:12px"><button class="btn btn-primary" id="btnAplicarPlanilha">Aplicar planilha</button></div>`;
      $('btnAplicarPlanilha').addEventListener('click', aplicarPlanilhaEmpresas);
    } catch (e) {
      console.error(e);
      previa.innerHTML = '<div class="bpo-aviso bpo-aviso-erro">❌ Não foi possível ler a planilha.</div>';
    }
  }

  async function aplicarPlanilhaEmpresas() {
    const r = planilhaEmpresas;
    if (!r || !r.itens.length) return;
    const somente = $('plSomente').checked;
    const sobrescrever = $('plSobrescrever').checked;
    const naPlanilha = new Set(r.itens.map((i) => i.codigo));
    const regs = r.itens.map((i) => {
      const cad = cadDe(i.codigo) || {};
      return {
        codigo_empresa: i.codigo, possui_bpo: i.possui_bpo,
        emails: (sobrescrever || !(cad.emails || []).length) && i.emails.length ? i.emails : (cad.emails || []),
        emails_cc: (sobrescrever || !(cad.emails_cc || []).length) && i.emails_cc.length ? i.emails_cc : (cad.emails_cc || []),
        updated_por: usuarioEmail,
      };
    });
    let removidas = 0;
    if (somente) {
      empresasCad.filter((e) => e.possui_bpo && !naPlanilha.has(e.codigo_empresa)).forEach((e) => {
        regs.push({ codigo_empresa: e.codigo_empresa, possui_bpo: false, emails: e.emails || [], emails_cc: e.emails_cc || [], updated_por: usuarioEmail });
        removidas += 1;
      });
    }
    if (removidas && !window.confirm(`${removidas} empresa(s) que hoje têm BPO e não estão na planilha perderão a marcação. Continuar?`)) return;
    $('btnAplicarPlanilha').disabled = true;
    try {
      await gravarEmpresasEmLotes(regs);
      fecharModal();
      toast(`Planilha aplicada: ${r.itens.length} empresa(s)${removidas ? `, ${removidas} sem BPO` : ''}.`, 'sucesso');
      renderEmpresas();
    } catch (e) {
      console.error(e);
      toast('Erro ao aplicar a planilha: ' + (e.message || e), 'erro');
      $('btnAplicarPlanilha').disabled = false;
    }
  }

  async function salvarEmpresa(tr) {
    const codigo = tr.getAttribute('data-cod');
    const reg = {
      codigo_empresa: codigo,
      possui_bpo: tr.querySelector('.emp-bpo').checked,
      emails: U.parseEmails(tr.querySelector('.emp-emails').value),
      emails_cc: U.parseEmails(tr.querySelector('.emp-cc').value),
      updated_por: usuarioEmail,
    };
    const { error } = await supabaseClient.from('bpo_empresas').upsert(reg);
    if (error) { console.error(error); toast('Erro ao salvar a empresa.', 'erro'); return; }
    const i = empresasCad.findIndex((e) => e.codigo_empresa === codigo);
    if (i >= 0) empresasCad[i] = { ...empresasCad[i], ...reg }; else empresasCad.push(reg);
    tr.querySelector('.emp-emails').value = reg.emails.join(', ');
    tr.querySelector('.emp-cc').value = reg.emails_cc.join(', ');
    tr.classList.toggle('bpo-sem', !reg.possui_bpo);
    toast('Salvo.', 'sucesso');
  }

  // ─── REGRAS E TEXTOS ────────────────────────────────────────

  function renderConfig() {
    const c = config || {};
    const etapas = Array.isArray(c.etapas) ? c.etapas : [];
    const campoTexto = (tipo, rotulo) => `
      <div class="full"><label>${rotulo} — assunto</label><input type="text" id="cfg-assunto-${tipo}" value="${esc(c['assunto_' + tipo] || '')}"></div>
      ${tipo === 'relatorio' ? '' : `<div class="full"><label>${rotulo} — texto</label><textarea id="cfg-texto-${tipo}">${esc(c['texto_' + tipo] || '')}</textarea></div>`}
      <div class="full bpo-teste-linha"><button type="button" class="btn btn-secondary btn-teste-email" data-tipo="${tipo}">✉️ Enviar e-mail de teste</button>
        <small>Usa o texto acima (mesmo sem salvar), com dados fictícios, e envia só para o e-mail de teste.</small></div>`;

    abrirMain('Regras e textos', '<button class="btn btn-primary" id="btnSalvarCfg">💾 Salvar</button>', `
      <div class="bpo-secao"><h3>Destinatários e modo teste</h3><div class="bpo-form-grid">
        <div><label>E-mail da chefe (relatório)</label><input type="text" id="cfg-chefe" value="${esc(c.email_chefe || '')}"></div>
        <div><label>Com cópia no relatório</label><input type="text" id="cfg-copia" value="${esc((c.emails_copia_relatorio || []).join(', '))}"></div>
        <div><label>E-mail do operador</label><input type="text" id="cfg-operador" value="${esc(c.email_operador || '')}"></div>
        <div><label>Domínios ignorados nos e-mails dos clientes</label><input type="text" id="cfg-ign" value="${esc((c.ignorar_emails_dominio || []).join(', '))}"></div>
        <div><label>E-mail de teste</label>
          <input type="text" id="cfg-email-teste" value="${esc(c.email_teste || '')}" placeholder="e-mail que recebe tudo no modo teste">
          <label class="bpo-check"><input type="checkbox" id="cfg-teste" ${c.modo_teste ? 'checked' : ''}> Modo teste ligado</label>
          <small>Com o modo teste ligado, nenhum cliente recebe e-mail: tudo vai só para o e-mail de teste.</small></div>
      </div></div>

      <div class="bpo-secao"><h3>Calendário do ciclo</h3>
        <div class="bpo-aviso" id="cicloResumo"></div>
        <div class="bpo-form-grid">
          <div><label>Início dos ciclos</label>
            <input type="text" id="cfg-inicio" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="${esc(c.inicio_ciclos ? U.dataBr(c.inicio_ciclos) : '')}">
            <small>Etapas com data anterior a esta são ignoradas — nenhum alerta é montado para ciclos passados. Vazio = sem limite.</small></div>
          <div><label>Dia útil</label><label class="bpo-check"><input type="checkbox" id="cfg-util" ${c.ajustar_dia_util !== false ? 'checked' : ''}> Ajustar fim de semana/feriado para o próximo dia útil</label></div>
        </div>
        <div class="bpo-tabela-wrap"><table class="mapa-table bpo-tabela">
          <thead><tr><th>Etapa</th><th>Dia do mês</th><th>Data neste ciclo</th><th></th></tr></thead>
          <tbody id="cfgEtapas">${etapas.map((e, i) => linhaEtapa(e, i)).join('')}</tbody></table></div>
        <button class="btn btn-secondary" id="btnAddEtapa" type="button" style="margin-top:10px">+ Etapa</button>
        <div class="bpo-form-grid" style="margin-top:14px">
          <div><label>Feriados extras (DD/MM ou DD/MM/AAAA)</label>
            <input type="text" id="cfg-feriados" placeholder="24/12, 31/12, 15/11/2026" value="${esc(U.feriadosExtrasParaTexto(c.feriados_extras))}">
            <small>Nacionais e do DF já estão incluídos. Sem ano = vale todo ano.</small></div>
          <div><label>Relatório do Onvio é "antigo" após (dias)</label><input type="number" id="cfg-antigo" min="0" value="${c.dias_relatorio_antigo ?? 2}"></div>
        </div>
      </div>

      <div class="bpo-secao"><h3>Textos dos e-mails</h3>
        <p style="margin-top:0;color:var(--muted);font-size:.85rem">Variáveis: {cliente} {competencia} {competencia_extenso} {data_limite} {documentos}.
          Linha em branco = novo parágrafo · "- " = item de lista · **texto** = negrito.</p>
        <div class="bpo-form-grid">
          ${campoTexto('inicial', 'Solicitação')}${campoTexto('lembrete', 'Lembrete')}
          ${campoTexto('ultimo_aviso', 'Último aviso')}${campoTexto('relatorio', 'Relatório da chefe')}
        </div></div>

      <div class="bpo-secao"><h3>Tipos de documento monitorados</h3>
        <p style="margin-top:0;color:var(--muted);font-size:.85rem">A <strong>pasta</strong> é um trecho do nome da pasta no Onvio; a palavra-chave (opcional) filtra pelo nome do arquivo.</p>
        <div class="bpo-tabela-wrap"><table class="mapa-table bpo-tabela">
          <thead><tr><th>Ativo</th><th>Nome</th><th>Pasta no Onvio</th><th>Palavra-chave</th><th></th></tr></thead>
          <tbody id="corpoTipos">${tipos.map(linhaTipo).join('')}</tbody></table></div>
        <button class="btn btn-secondary" id="btnAddTipo" type="button" style="margin-top:10px">+ Tipo de documento</button>
      </div>
      <div class="bpo-acoes-fixas"><span class="resumo">Destinatários, calendário e textos são salvos juntos. Os tipos de documento salvam ao editar.</span>
        <button class="btn btn-primary" id="btnSalvarCfg2" type="button">💾 Salvar regras</button></div>`);

    $('btnSalvarCfg').addEventListener('click', salvarConfig);
    $('btnSalvarCfg2').addEventListener('click', salvarConfig);
    document.querySelectorAll('.btn-teste-email').forEach((b) => b.addEventListener('click', () => enviarEmailTeste(b)));
    $('btnAddEtapa').addEventListener('click', () => {
      $('cfgEtapas').insertAdjacentHTML('beforeend', linhaEtapa({ tipo: 'lembrete', dia: 5 }, Date.now()));
      ligarEtapas();
      atualizarPreviaCalendario();
    });
    $('cfg-inicio').addEventListener('input', (e) => {
      e.target.value = U.mascaraData(e.target.value);
      atualizarPreviaCalendario();
    });
    $('cfg-util').addEventListener('change', atualizarPreviaCalendario);
    $('cfg-feriados').addEventListener('input', atualizarPreviaCalendario);
    $('btnAddTipo').addEventListener('click', adicionarTipo);
    ligarEtapas();
    ligarTipos();
    atualizarPreviaCalendario();
  }

  function linhaEtapa(e, i) {
    return `<tr class="cfg-etapa" data-i="${i}">
      <td><select class="bpo-select et-tipo">${Object.keys(U.TIPOS_ETAPA).map((k) =>
        `<option value="${k}" ${e.tipo === k ? 'selected' : ''}>${U.TIPOS_ETAPA[k]}</option>`).join('')}</select></td>
      <td><input type="number" class="bpo-input et-dia" min="1" max="31" value="${esc(e.dia)}" style="width:90px"></td>
      <td class="et-data"></td>
      <td class="acoes"><button type="button" class="bpo-link et-rem">Remover</button></td></tr>`;
  }

  // Lê o formulário e devolve uma config temporária (para a prévia do calendário).
  function configDoFormulario() {
    return {
      etapas: Array.from(document.querySelectorAll('.cfg-etapa')).map((el) => ({
        tipo: el.querySelector('.et-tipo').value, dia: parseInt(el.querySelector('.et-dia').value, 10) || 1,
      })),
      ajustar_dia_util: $('cfg-util').checked,
      feriados_extras: U.textoParaFeriadosExtras($('cfg-feriados').value).lista,
      inicio_ciclos: U.dataBrValida($('cfg-inicio').value),
    };
  }

  function atualizarPreviaCalendario() {
    const cfgTmp = configDoFormulario();
    const comp = U.listaCompetencias(new Date(), 1)[0];
    const ciclo = U.cicloTextos(comp);
    $('cicloResumo').innerHTML = `📅 Ciclo atual: alertas enviados em <strong>${esc(ciclo.mesCiclo)}</strong> cobram a
      <strong>competência ${esc(ciclo.competencia)}</strong> (sempre o mês anterior ao do envio). ${cfgTmp.etapas.length} etapa(s) configurada(s).`;
    document.querySelectorAll('.cfg-etapa').forEach((tr) => {
      const e = { tipo: tr.querySelector('.et-tipo').value, dia: parseInt(tr.querySelector('.et-dia').value, 10) || 1 };
      const r = U.calendarioCompetencia(comp, { ...cfgTmp, etapas: [e] })[0];
      const alvo = tr.querySelector('.et-data');
      if (!r) { alvo.textContent = '—'; return; }
      alvo.innerHTML = `<strong>${esc(U.dataBr(r.data))}</strong> <span style="color:var(--muted)">${esc(r.diaSemana)}</span>`
        + (r.ajustada ? ` <span class="bpo-pill bpo-sit-neutro" title="Dia original ${esc(U.dataBr(r.dataOriginal))} caiu em fim de semana ou feriado">ajustada</span>` : '')
        + (!r.ativa ? ' <span class="bpo-pill bpo-sit-pend">antes do início</span>' : '');
    });
  }

  function ligarEtapas() {
    document.querySelectorAll('.et-rem').forEach((b) => {
      b.onclick = () => { b.closest('.cfg-etapa').remove(); atualizarPreviaCalendario(); };
    });
    document.querySelectorAll('.cfg-etapa input, .cfg-etapa select').forEach((i) => {
      i.oninput = atualizarPreviaCalendario;
      i.onchange = atualizarPreviaCalendario;
    });
  }

  function linhaTipo(t) {
    return `<tr data-id="${t.id}">
      <td><input type="checkbox" class="tp-ativo" ${t.ativo ? 'checked' : ''}></td>
      <td><input type="text" class="bpo-input tp-nome" value="${esc(t.nome)}" style="width:100%"></td>
      <td><input type="text" class="bpo-input tp-pasta" value="${esc(t.pasta)}" style="width:100%"></td>
      <td><input type="text" class="bpo-input tp-kw" value="${esc(t.palavra_chave || '')}" style="width:100%"></td>
      <td class="acoes"><button type="button" class="bpo-link tp-del">Excluir</button></td></tr>`;
  }

  function ligarTipos() {
    document.querySelectorAll('#corpoTipos tr[data-id]').forEach((tr) => {
      const id = tr.getAttribute('data-id');
      tr.querySelectorAll('input').forEach((i) => i.addEventListener('change', async () => {
        const reg = { ativo: tr.querySelector('.tp-ativo').checked, nome: tr.querySelector('.tp-nome').value.trim(),
          pasta: tr.querySelector('.tp-pasta').value.trim(), palavra_chave: tr.querySelector('.tp-kw').value.trim() || null };
        if (!reg.nome || !reg.pasta) { toast('Nome e pasta são obrigatórios.', 'erro'); return; }
        const { error } = await supabaseClient.from('bpo_tipos_documento').update(reg).eq('id', id);
        if (error) { toast('Erro ao salvar o tipo.', 'erro'); return; }
        const k = tipos.findIndex((t) => t.id === id);
        if (k >= 0) tipos[k] = { ...tipos[k], ...reg };
        toast('Salvo.', 'sucesso');
      }));
      tr.querySelector('.tp-del').addEventListener('click', async () => {
        if (!window.confirm('Excluir este tipo? As marcações manuais ligadas a ele também serão apagadas.')) return;
        const { error } = await supabaseClient.from('bpo_tipos_documento').delete().eq('id', id);
        if (error) { toast('Erro ao excluir.', 'erro'); return; }
        tipos = tipos.filter((t) => t.id !== id);
        tr.remove();
      });
    });
  }

  async function adicionarTipo() {
    const { data, error } = await supabaseClient.from('bpo_tipos_documento')
      .insert({ nome: 'Novo documento', pasta: 'Nome da pasta', ordem: tipos.length + 1 }).select('*').single();
    if (error) { toast('Erro ao criar o tipo.', 'erro'); return; }
    tipos.push(data);
    $('corpoTipos').insertAdjacentHTML('beforeend', linhaTipo(data));
    ligarTipos();
  }

  // E-mail de teste de um dos textos (usa o conteúdo do formulário, mesmo sem salvar).
  async function enviarEmailTeste(btn) {
    const tipo = btn.getAttribute('data-tipo');
    const comp = U.listaCompetencias(new Date(), 1)[0];
    const limite = U.dataLimite(U.calendarioCompetencia(comp, configDoFormulario()));
    const corpo = { acao: 'teste', competencia: comp, tipo_texto: tipo, assunto: $('cfg-assunto-' + tipo).value, data_limite: limite };
    if (tipo !== 'relatorio') corpo.texto = $('cfg-texto-' + tipo).value;
    const rotulo = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const r = await chamarFuncao(corpo);
      toast(`E-mail de teste enviado para ${(r.para || []).join(', ')}.`, 'sucesso');
    } catch (e) {
      const msg = /Ação desconhecida/.test(e.message)
        ? 'A função bpo-alertas no Supabase está desatualizada — publique a nova versão para usar o teste.'
        : e.message;
      toast('Falha no e-mail de teste: ' + msg, 'erro');
    } finally {
      btn.disabled = false;
      btn.textContent = rotulo;
    }
  }

  async function salvarConfig() {
    const etapas = Array.from(document.querySelectorAll('.cfg-etapa')).map((el) => ({
      tipo: el.querySelector('.et-tipo').value, dia: parseInt(el.querySelector('.et-dia').value, 10) || 0,
    }));
    if (!etapas.length) { toast('Defina ao menos uma etapa.', 'erro'); return; }
    if (etapas.some((e) => e.dia < 1 || e.dia > 31)) { toast('O dia de cada etapa deve estar entre 1 e 31.', 'erro'); return; }
    const inicioTxt = $('cfg-inicio').value.trim();
    const inicio = inicioTxt ? U.dataBrValida(inicioTxt) : null;
    if (inicioTxt && !inicio) { toast('Início dos ciclos inválido. Use DD/MM/AAAA.', 'erro'); return; }
    const fer = U.textoParaFeriadosExtras($('cfg-feriados').value);
    if (fer.invalidos.length) { toast('Feriados inválidos: ' + fer.invalidos.join(', ') + ' (use DD/MM ou DD/MM/AAAA).', 'erro'); return; }
    const reg = {
      email_chefe: $('cfg-chefe').value.trim() || null,
      emails_copia_relatorio: U.parseEmails($('cfg-copia').value),
      email_operador: $('cfg-operador').value.trim() || null,
      ignorar_emails_dominio: $('cfg-ign').value.split(/[;,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
      modo_teste: $('cfg-teste').checked,
      email_teste: $('cfg-email-teste').value.trim() || null,
      etapas,
      ajustar_dia_util: $('cfg-util').checked,
      feriados_extras: fer.lista,
      inicio_ciclos: inicio,
      dias_relatorio_antigo: parseInt($('cfg-antigo').value, 10) || 0,
      updated_por: usuarioEmail,
    };
    ['inicial', 'lembrete', 'ultimo_aviso', 'relatorio'].forEach((t) => {
      reg['assunto_' + t] = $('cfg-assunto-' + t).value;
      if (t !== 'relatorio') reg['texto_' + t] = $('cfg-texto-' + t).value;
    });
    if (reg.modo_teste && !reg.email_teste) { toast('Informe o e-mail de teste para usar o modo teste.', 'erro'); return; }
    let { error } = await supabaseClient.from('bpo_config').update(reg).eq('id', 1);
    let semColuna = false;
    if (error && /inicio_ciclos/.test(error.message || '')) {
      // banco ainda sem a coluna nova: salva o resto e avisa
      const { inicio_ciclos: _ignorada, ...resto } = reg;
      ({ error } = await supabaseClient.from('bpo_config').update(resto).eq('id', 1));
      semColuna = !error;
    }
    if (error) { console.error(error); toast('Erro ao salvar as regras.', 'erro'); return; }
    config = { ...config, ...reg };
    if (semColuna) toast('Regras salvas, mas o início dos ciclos NÃO foi gravado: rode o SQL atualizado (coluna inicio_ciclos) no Supabase.', 'erro');
    else toast('Regras salvas.', 'sucesso');
    atualizarPreviaCalendario();
  }
})();
