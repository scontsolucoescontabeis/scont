(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const NAO_EMPRESA = new Set(['MODELO', 'SPED', 'EXTRATOS', 'Acessos bancários', 'Empresas Novas', 'LISTAGEM', 'Planilha7']);
  const LEGENDA = new Set(['CONCLUÍDO', 'PENDÊNCIAS - "EM ABERTO"', 'SEM DOCUMENTAÇÃO', 'EMPRESA', 'EMPRESAS', 'DIÁRIO CONTÁBIL', 'DATA']);
  const SUFIXOS = ['LTDA ME', 'EIRELI ME', 'LTDA EPP', 'LTDA', 'EIRELI', ' ME ', ' EPP ', ' SA ', ' S A ', 'SOCIEDADE SIMPLES', ' SS ', 'MATRIZ', 'FILIAL'];

  let empresasRh = []; // [{ codigo_empresa, nome_empresa, _norm }]
  let resultadoLancamentos = []; // por aba
  let resultadoListagem = []; // por linha da LISTAGEM

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
    window.__migracaoAuth = auth;

    await carregarEmpresas();
    renderTela();
  }

  async function carregarEmpresas() {
    const { data, error } = await supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa').order('nome_empresa', { ascending: true });
    if (error) { console.error(error); mostrarToast('Erro ao carregar empresas.', 'erro'); return; }
    empresasRh = (data || []).map((e) => ({ ...e, _norm: normalizarNome(e.nome_empresa) }));
  }

  // ─── NORMALIZAÇÃO E MATCH ───────────────────────────────────

  function normalizarNome(str) {
    let s = String(str || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[.,/-]/g, ' ')
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    s = ' ' + s + ' ';
    SUFIXOS.forEach((suf) => { s = s.split(' ' + suf.trim() + ' ').join(' '); });
    return s.replace(/\s+/g, ' ').trim();
  }

  function encontrarEmpresa(nome) {
    const alvo = normalizarNome(nome);
    if (!alvo) return { tipo: 'sem_nome' };

    const exatos = empresasRh.filter((e) => e._norm === alvo);
    if (exatos.length === 1) return { tipo: 'exato', empresa: exatos[0] };
    if (exatos.length > 1) return { tipo: 'ambiguo', candidatos: exatos };

    const parciais = empresasRh.filter((e) => e._norm && Math.min(e._norm.length, alvo.length) >= 6 && (e._norm.includes(alvo) || alvo.includes(e._norm)));
    if (parciais.length === 1) return { tipo: 'aproximado', empresa: parciais[0] };
    if (parciais.length > 1) return { tipo: 'ambiguo', candidatos: parciais };

    return { tipo: 'nao_encontrado' };
  }

  // ─── EXTRAÇÃO DA PLANILHA ───────────────────────────────────

  function isoData(d) { return d.toISOString().slice(0, 10); }

  function pareceSerialExcel(v) {
    return typeof v === 'number' && v > 20000 && v < 60000;
  }

  function serialParaData(v) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }

  function extrairAba(sheet, nomeAba) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    let codigoInterno = null;
    let nomeInterno = null;
    let identidadeRow = -1;
    for (let i = 0; i < Math.min(8, rows.length); i++) {
      const [a, b] = rows[i];
      if (typeof b === 'string' && b.trim() && !LEGENDA.has(b.trim())) {
        nomeInterno = b.trim();
        if (typeof a === 'number') codigoInterno = a;
        identidadeRow = i;
        break;
      }
    }
    if (identidadeRow < 0) return { aba: nomeAba, codigoInterno: null, nomeInterno: null, lancamentos: [] };

    const inicio = identidadeRow + 1;
    const datasReais = [];
    for (let i = inicio; i < rows.length; i++) {
      const [a] = rows[i];
      if (a instanceof Date) datasReais.push(a);
      else if (pareceSerialExcel(a)) datasReais.push(serialParaData(a));
    }
    const menorData = datasReais.length ? new Date(Math.min(...datasReais.map((d) => d.getTime()))) : null;

    const lancamentos = [];
    for (let i = inicio; i < rows.length; i++) {
      const [a, b] = rows[i];
      if (String(a ?? '').trim() === 'DATA' && String(b ?? '').trim() === 'DIÁRIO CONTÁBIL') continue; // header opcional

      const texto = typeof b === 'string' ? b.trim() : (b === null || b === undefined ? '' : String(b).trim());
      if (!texto) continue;
      if (/^observa[cç][aã]o\s*:?$/i.test(texto)) continue;

      let data, prefixo = '';
      if (a instanceof Date) {
        data = isoData(a);
      } else if (pareceSerialExcel(a)) {
        data = isoData(serialParaData(a));
      } else {
        data = menorData ? isoData(menorData) : null;
        const marcador = a === null || a === undefined ? null : String(a).trim();
        if (marcador) prefixo = `[${marcador}] `;
      }
      if (!data) continue;

      lancamentos.push({ data, texto: prefixo + texto });
    }

    return { aba: nomeAba, codigoInterno, nomeInterno, lancamentos };
  }

  function extrairListagem(wb) {
    const sheet = wb.Sheets['LISTAGEM'];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const resultado = [];
    for (let i = 2; i < rows.length; i++) {
      const nome = rows[i][4];
      if (typeof nome === 'string' && nome.trim()) resultado.push({ linha: i, nome: nome.trim() });
    }
    return resultado;
  }

  // ─── PROCESSAMENTO DO ARQUIVO ────────────────────────────────

  async function handleArquivo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const status = document.getElementById('statusProcessamento');
    status.textContent = 'Lendo arquivo (pode levar até um minuto)...';

    const reader = new FileReader();
    reader.onload = (e) => {
      let wb;
      try {
        wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      } catch (err) {
        console.error(err);
        status.textContent = 'Erro ao ler o arquivo.';
        return;
      }

      status.textContent = 'Processando abas...';

      const nomesAbas = wb.SheetNames.filter((n) => !NAO_EMPRESA.has(n));
      resultadoLancamentos = nomesAbas.map((n) => {
        const r = extrairAba(wb.Sheets[n], n);
        const match = r.nomeInterno ? encontrarEmpresa(r.nomeInterno) : { tipo: 'sem_nome' };
        return { ...r, match };
      }).filter((r) => r.lancamentos.length > 0);

      const listagem = extrairListagem(wb);
      resultadoListagem = listagem.map((l) => ({ ...l, match: encontrarEmpresa(l.nome) }));

      status.textContent = '';
      renderPreview();
    };
    reader.onerror = () => { status.textContent = 'Erro ao ler o arquivo.'; };
    reader.readAsArrayBuffer(file);
  }

  // ─── TELA ───────────────────────────────────────────────────

  function renderTela() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Importar Excel Legado</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-body">
          <p class="full mapa-empty" style="margin-bottom:4px;">
            Selecione o arquivo <strong>DIÁRIO CONTÁBIL.xlsx</strong> para: (1) importar os lançamentos de cada
            aba de empresa para o Diário Contábil e (2) marcar como "possui contábil" na tela de Configurações
            todas as empresas que constam na aba LISTAGEM. O arquivo é lido só no seu navegador — nada é
            enviado a terceiros. Nenhuma gravação acontece até você conferir a prévia abaixo e clicar em
            "Confirmar Importação".
          </p>
          <div class="full">
            <input type="file" id="fileExcelLegado" accept=".xlsx,.xls">
          </div>
          <p class="full mapa-empty" id="statusProcessamento"></p>
        </div>
      </div>
      <div id="areaPreview"></div>
    `;
    document.getElementById('fileExcelLegado').addEventListener('change', handleArquivo);
  }

  function linhaLancamento(r) {
    const badge = r.match.tipo === 'exato' ? '<span class="badge-nivel nivel-baixo">match exato</span>'
      : r.match.tipo === 'aproximado' ? '<span class="badge-nivel nivel-medio">match aproximado</span>'
      : '';
    return `
      <tr>
        <td><input type="checkbox" class="chk-lote-lancamento" data-codigo="${escapeAttr(r.match.empresa.codigo_empresa)}" data-aba="${escapeAttr(r.aba)}" checked></td>
        <td>${escapeHtml(r.aba)}</td>
        <td>${escapeHtml(r.nomeInterno)}</td>
        <td>${escapeHtml(r.match.empresa.nome_empresa)} <span class="mapa-empty">(${escapeHtml(r.match.empresa.codigo_empresa)})</span></td>
        <td>${badge}</td>
        <td>${r.lancamentos.length}</td>
      </tr>
    `;
  }

  function linhaListagem(l) {
    const badge = l.match.tipo === 'exato' ? '<span class="badge-nivel nivel-baixo">match exato</span>'
      : l.match.tipo === 'aproximado' ? '<span class="badge-nivel nivel-medio">match aproximado</span>'
      : '';
    return `
      <tr>
        <td><input type="checkbox" class="chk-listagem" data-codigo="${escapeAttr(l.match.empresa.codigo_empresa)}" checked></td>
        <td>${escapeHtml(l.nome)}</td>
        <td>${escapeHtml(l.match.empresa.nome_empresa)} <span class="mapa-empty">(${escapeHtml(l.match.empresa.codigo_empresa)})</span></td>
        <td>${badge}</td>
      </tr>
    `;
  }

  function renderPreview() {
    const encontrados = resultadoLancamentos.filter((r) => r.match.tipo === 'exato' || r.match.tipo === 'aproximado');
    const naoEncontrados = resultadoLancamentos.filter((r) => r.match.tipo === 'nao_encontrado' || r.match.tipo === 'ambiguo' || r.match.tipo === 'sem_nome');
    const totalLancamentosEncontrados = encontrados.reduce((acc, r) => acc + r.lancamentos.length, 0);

    const listagemEncontrada = resultadoListagem.filter((l) => l.match.tipo === 'exato' || l.match.tipo === 'aproximado');
    const listagemNaoEncontrada = resultadoListagem.filter((l) => l.match.tipo !== 'exato' && l.match.tipo !== 'aproximado');

    const el = document.getElementById('areaPreview');
    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Lançamentos — Empresas encontradas (${encontrados.length} abas, ${totalLancamentosEncontrados} lançamentos)</div>
        <div class="mapa-secao-body">
          <table class="mapa-table full">
            <thead><tr><th>Importar</th><th>Aba</th><th>Nome na planilha</th><th>Empresa (rh_empresas)</th><th>Match</th><th>Qtd.</th></tr></thead>
            <tbody>${encontrados.length ? encontrados.map(linhaLancamento).join('') : '<tr><td colspan="6">Nenhuma.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Lançamentos — Abas não encontradas em rh_empresas (${naoEncontrados.length}) — não serão importadas</div>
        <div class="mapa-secao-body">
          <div class="full mapa-tags">${naoEncontrados.map((r) => `<span class="mapa-tag">${escapeHtml(r.aba)} (${r.lancamentos.length})</span>`).join('') || '<p class="mapa-empty">Nenhuma.</p>'}</div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Configurações — Empresas da LISTAGEM encontradas (${listagemEncontrada.length}) — serão marcadas "possui contábil"</div>
        <div class="mapa-secao-body">
          <table class="mapa-table full">
            <thead><tr><th>Marcar</th><th>Nome na LISTAGEM</th><th>Empresa (rh_empresas)</th><th>Match</th></tr></thead>
            <tbody>${listagemEncontrada.length ? listagemEncontrada.map(linhaListagem).join('') : '<tr><td colspan="4">Nenhuma.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Configurações — Empresas da LISTAGEM não encontradas (${listagemNaoEncontrada.length}) — não serão alteradas</div>
        <div class="mapa-secao-body">
          <div class="full mapa-tags">${listagemNaoEncontrada.map((l) => `<span class="mapa-tag">${escapeHtml(l.nome)}</span>`).join('') || '<p class="mapa-empty">Nenhuma.</p>'}</div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-body">
          <div class="full">
            <button type="button" class="btn-novo" id="btnConfirmarImportacao">Confirmar Importação</button>
            <span class="mapa-empty" id="statusImportacao" style="margin-left:12px;"></span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnConfirmarImportacao').addEventListener('click', confirmarImportacao);
  }

  // ─── GRAVAÇÃO ───────────────────────────────────────────────

  function chunk(arr, tamanho) {
    const partes = [];
    for (let i = 0; i < arr.length; i += tamanho) partes.push(arr.slice(i, i + tamanho));
    return partes;
  }

  async function confirmarImportacao() {
    const btn = document.getElementById('btnConfirmarImportacao');
    const status = document.getElementById('statusImportacao');
    btn.disabled = true;

    // 1. lançamentos marcados
    const abasMarcadas = new Set(Array.from(document.querySelectorAll('.chk-lote-lancamento:checked')).map((c) => c.getAttribute('data-aba')));
    const registrosLancamentos = [];
    resultadoLancamentos
      .filter((r) => (r.match.tipo === 'exato' || r.match.tipo === 'aproximado') && abasMarcadas.has(r.aba))
      .forEach((r) => {
        r.lancamentos.forEach((l) => {
          registrosLancamentos.push({
            codigo_empresa: r.match.empresa.codigo_empresa,
            data: l.data,
            texto: l.texto,
            criado_por_nome: 'Importação Excel',
            criado_por_email: null,
          });
        });
      });

    // dedup contra o que já existe no banco
    let paraInserir = registrosLancamentos;
    const codigosAfetados = Array.from(new Set(registrosLancamentos.map((r) => r.codigo_empresa)));
    if (codigosAfetados.length) {
      status.textContent = `Verificando duplicados (${registrosLancamentos.length} lançamentos)...`;
      const { data: existentes, error: errExistentes } = await supabaseClient
        .from('contabil_diario_lancamentos')
        .select('codigo_empresa, data, texto')
        .in('codigo_empresa', codigosAfetados);
      if (errExistentes) { console.error(errExistentes); }
      const chavesExistentes = new Set((existentes || []).map((e) => `${e.codigo_empresa}|${e.data}|${e.texto}`));
      paraInserir = registrosLancamentos.filter((r) => !chavesExistentes.has(`${r.codigo_empresa}|${r.data}|${r.texto}`));
    }

    let inseridos = 0;
    let erroInsercao = null;
    const lotes = chunk(paraInserir, 500);
    for (let i = 0; i < lotes.length; i++) {
      status.textContent = `Gravando lançamentos: lote ${i + 1}/${lotes.length}...`;
      const { error } = await supabaseClient.from('contabil_diario_lancamentos').insert(lotes[i]);
      if (error) { console.error(error); erroInsercao = error; break; }
      inseridos += lotes[i].length;
    }

    // 2. configurações (listagem)
    const listagemMarcada = new Set(Array.from(document.querySelectorAll('.chk-listagem:checked')).map((c) => c.getAttribute('data-codigo')));
    const registrosConfig = Array.from(listagemMarcada).map((codigo_empresa) => ({ codigo_empresa, possui_contabil: true }));
    let erroConfig = null;
    if (registrosConfig.length) {
      status.textContent = 'Atualizando Configurações...';
      const { error } = await supabaseClient.from('contabil_empresas_config').upsert(registrosConfig, { onConflict: 'codigo_empresa' });
      if (error) { console.error(error); erroConfig = error; }
    }

    btn.disabled = false;
    const ignoradosPorDuplicado = registrosLancamentos.length - paraInserir.length;
    const partes = [`${inseridos} lançamento(s) gravado(s)`];
    if (ignoradosPorDuplicado) partes.push(`${ignoradosPorDuplicado} ignorado(s) por já existir`);
    partes.push(`${registrosConfig.length - (erroConfig ? registrosConfig.length : 0)} empresa(s) marcada(s) com contábil`);
    status.textContent = partes.join(' · ');
    mostrarToast(erroInsercao || erroConfig ? 'Importação concluída com erros — veja o console.' : 'Importação concluída.', erroInsercao || erroConfig ? 'erro' : 'sucesso');
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
