(function () {
  'use strict';

  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#f5ecec',
        primaryTextColor: '#2C3E50',
        primaryBorderColor: '#8B3A3A',
        lineColor: '#8B3A3A',
        secondaryColor: '#eaf1ff',
        tertiaryColor: '#ffffff',
        fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: '14px'
      },
      flowchart: { curve: 'basis', htmlLabels: true }
    });
  }

  let fluxoAtivoId = null;
  let mermaidSeq = 0;

  function todosFluxos() {
    return (window.DP_CATEGORIAS || []).flatMap(function (cat) {
      return cat.fluxos.map(function (f) { return { categoria: cat, fluxo: f }; });
    });
  }

  function encontrarFluxo(id) {
    return todosFluxos().find(function (x) { return x.fluxo.id === id; });
  }

  function renderNavTree() {
    const nav = document.getElementById('navTree');
    nav.innerHTML = '';

    (window.DP_CATEGORIAS || []).forEach(function (cat, idx) {
      const wrap = document.createElement('div');
      wrap.className = 'nav-categoria' + (idx === 0 ? ' aberta' : '');
      wrap.dataset.categoriaId = cat.id;

      const btn = document.createElement('button');
      btn.className = 'nav-categoria-btn';
      btn.innerHTML =
        '<span>' + cat.icone + ' ' + cat.nome + '</span>' +
        '<span class="chevron">▶</span>';
      btn.addEventListener('click', function () {
        wrap.classList.toggle('aberta');
      });

      const lista = document.createElement('div');
      lista.className = 'nav-categoria-lista';

      cat.fluxos.forEach(function (fluxo) {
        const item = document.createElement('button');
        item.className = 'nav-fluxo-btn';
        item.textContent = fluxo.nome;
        item.dataset.fluxoId = fluxo.id;
        item.addEventListener('click', function () {
          selecionarFluxo(fluxo.id);
        });
        lista.appendChild(item);
      });

      wrap.appendChild(btn);
      wrap.appendChild(lista);
      nav.appendChild(wrap);
    });
  }

  function marcarAtivoNaSidebar(id) {
    document.querySelectorAll('.nav-fluxo-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.fluxoId === id);
    });
  }

  function etapaTemplate(etapa, idx) {
    const tarefasHtml = etapa.tarefas.map(function (t) {
      const detalhes = t.detalhes.map(function (d) { return '<li>' + d + '</li>'; }).join('');
      return (
        '<div class="tarefa">' +
          '<div class="tarefa-titulo">' + t.titulo + '</div>' +
          '<ul>' + detalhes + '</ul>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="etapa' + (idx === 0 ? ' aberta' : '') + '">' +
        '<button class="etapa-header" type="button">' +
          '<span>' + etapa.titulo + '</span>' +
          '<span class="chevron">▶</span>' +
        '</button>' +
        '<div class="etapa-body">' + tarefasHtml + '</div>' +
      '</div>'
    );
  }

  function selecionarFluxo(id) {
    const achado = encontrarFluxo(id);
    if (!achado) return;
    fluxoAtivoId = id;
    marcarAtivoNaSidebar(id);

    const fluxo = achado.fluxo;
    const categoria = achado.categoria;
    const main = document.getElementById('main');

    const resumo = fluxo.resumo || {};
    const observacoesHtml = (fluxo.observacoes && fluxo.observacoes.length)
      ? (
        '<div class="card">' +
          '<h3>Considerações legais e operacionais</h3>' +
          '<p class="card-sub">Pontos de atenção citados na documentação do processo.</p>' +
          '<ul class="observacoes">' +
            fluxo.observacoes.map(function (o) { return '<li>' + o + '</li>'; }).join('') +
          '</ul>' +
        '</div>'
      )
      : '';

    const documentosHtml = (fluxo.documentos && fluxo.documentos.length)
      ? (
        '<div class="card">' +
          '<h3>Checklist de documentos</h3>' +
          '<p class="card-sub">Documentos envolvidos neste tipo de rescisão.</p>' +
          '<ul class="checklist">' +
            fluxo.documentos.map(function (d) { return '<li>' + d + '</li>'; }).join('') +
          '</ul>' +
        '</div>'
      )
      : '';

    mermaidSeq += 1;
    const mermaidId = 'mermaid-' + mermaidSeq;

    main.innerHTML =
      '<div class="fluxo-header">' +
        '<span class="categoria-tag">' + categoria.nome + '</span>' +
        '<h2>' + fluxo.nome + '</h2>' +
      '</div>' +

      '<div class="resumo-grid">' +
        '<div class="resumo-card prazo"><small>Prazo de pagamento</small><p>' + (resumo.prazo || '—') + '</p></div>' +
        '<div class="resumo-card aviso"><small>Observação sobre o aviso prévio</small><p>' + (resumo.observacaoAvisoPrevio || '—') + '</p></div>' +
        '<div class="resumo-card legal"><small>Referências legais</small><p>' + (resumo.referenciasLegais || '—') + '</p></div>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Fluxograma do processo</h3>' +
        '<p class="card-sub">Visão geral das etapas — clique em uma etapa abaixo para ver o passo a passo detalhado.</p>' +
        '<div class="diagrama-wrap"><pre class="mermaid" id="' + mermaidId + '">' + fluxo.mermaid + '</pre></div>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Passo a passo</h3>' +
        '<p class="card-sub">Etapas e tarefas do processo, incluindo o caminho no sistema Domínio.</p>' +
        '<div class="etapas">' +
          fluxo.etapas.map(etapaTemplate).join('') +
        '</div>' +
      '</div>' +

      observacoesHtml +
      documentosHtml;

    main.querySelectorAll('.etapa-header').forEach(function (header) {
      header.addEventListener('click', function () {
        header.closest('.etapa').classList.toggle('aberta');
      });
    });

    if (window.mermaid) {
      const el = document.getElementById(mermaidId);
      mermaid.run({ nodes: [el] }).catch(function (err) {
        console.error('Erro ao renderizar fluxograma:', err);
      });
    }

    main.scrollTop = 0;
  }

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

    renderNavTree();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
