(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let empresas = []; // [{ codigo_empresa, nome_empresa }]
  let configPorEmpresa = {}; // { codigo_empresa: boolean } — espelha o que já está salvo no banco
  let usuariosAprovados = []; // [{ id, nome, email, empresa }]
  let responsaveisPorEmpresa = {}; // { codigo_empresa: Set<usuario_id> }

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

    await carregarDados();
    renderTela();
  }

  async function carregarDados() {
    const [
      { data: dataEmpresas, error: errEmpresas },
      { data: dataConfig, error: errConfig },
      { data: dataUsuarios, error: errUsuarios },
      { data: dataResponsaveis, error: errResponsaveis },
    ] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
      supabaseClient.rpc('contabil_listar_usuarios_aprovados'),
      supabaseClient.from('contabil_empresas_responsaveis').select('codigo_empresa, usuario_id'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errConfig) console.error(errConfig);
    if (errUsuarios) console.error(errUsuarios);
    if (errResponsaveis) console.error(errResponsaveis);

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao));

    configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });

    usuariosAprovados = dataUsuarios || [];

    responsaveisPorEmpresa = {};
    (dataResponsaveis || []).forEach((r) => {
      if (!responsaveisPorEmpresa[r.codigo_empresa]) responsaveisPorEmpresa[r.codigo_empresa] = new Set();
      responsaveisPorEmpresa[r.codigo_empresa].add(r.usuario_id);
    });
  }

  function possuiContabil(codigoEmpresa) {
    return configPorEmpresa[codigoEmpresa] !== false;
  }

  function responsaveisDe(codigoEmpresa) {
    const ids = responsaveisPorEmpresa[codigoEmpresa];
    if (!ids || !ids.size) return [];
    return usuariosAprovados.filter((u) => ids.has(u.id));
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
    return { error: null };
  }

  // ─── TELA ───────────────────────────────────────────────────

  function renderTela() {
    const main = document.getElementById('main');
    main.classList.add('main-full');
    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Configurações</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas com Contábil</div>
        <div class="mapa-secao-body">
          <p class="full mapa-empty" style="margin-bottom:4px;">Marque as empresas que possuem contábil na Scont. Somente as marcadas aqui aparecem nos seletores e filtros do Onboarding e do Diário Contábil. As alterações são salvas automaticamente.</p>
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
        </div>
      </div>
    `;

    document.getElementById('buscaEmpresaConfig').addEventListener('input', renderTabela);
    document.getElementById('btnMarcarTodas').addEventListener('click', () => alternarVisiveis(true));
    document.getElementById('btnDesmarcarTodas').addEventListener('click', () => alternarVisiveis(false));
    document.getElementById('btnImportarPlanilha').addEventListener('click', () => document.getElementById('fileImportarConfig').click());
    document.getElementById('fileImportarConfig').addEventListener('change', handleImportarPlanilha);
    document.getElementById('btnResponsavelPorUsuario').addEventListener('click', abrirModalResponsavelPorUsuario);

    renderTabela();
  }

  function empresasVisiveis() {
    const termo = (document.getElementById('buscaEmpresaConfig').value || '').trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo));
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
          <td>${escapeHtml(e.codigo_empresa)}</td>
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${toggleHtml(e.codigo_empresa)}</td>
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
        const empresa = empresas.find((e) => e.codigo_empresa === codigo);
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
    if (!termo) return empresas;
    return empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo));
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
          <span>${escapeHtml(e.nome_empresa)} <small>(${escapeHtml(e.codigo_empresa)})</small></span>
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
