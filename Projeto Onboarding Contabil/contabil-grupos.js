// ============================================================
// contabil-grupos.js — camada compartilhada de "Grupos de Empresas"
// para o módulo Departamento Contábil.
//
// Os grupos ficam nas MESMAS tabelas usadas pelo Controle de
// Frequência do Projeto RH (rh_grupos_empresas / rh_grupos_empresas_itens),
// no mesmo projeto Supabase. Criar/editar aqui reflete lá e vice-versa.
//
// contabil_grupos_config guarda, por grupo, se ele é usado como filtro
// nas ferramentas do Departamento Contábil (opt-in: sem linha = false).
// ============================================================

(function (root) {
  'use strict';

  // ─── Helpers puros (testáveis em Node) ───────────────────────

  // Junta as linhas cruas das 3 tabelas numa estrutura pronta para a UI:
  // [{ id, nome_grupo, observacoes, email_responsavel, empresas:Set<codigo>, usarContabil }]
  // ordenada por nome_grupo (locale pt-BR).
  function montarGrupos(gruposRows, itensRows, configRows) {
    const itensPorGrupo = {};
    (itensRows || []).forEach((it) => {
      (itensPorGrupo[it.grupo_id] = itensPorGrupo[it.grupo_id] || new Set()).add(it.codigo_empresa);
    });
    const usarPorGrupo = {};
    (configRows || []).forEach((c) => { usarPorGrupo[c.grupo_id] = c.usar_contabil === true; });

    return (gruposRows || [])
      .map((g) => ({
        id: g.id,
        nome_grupo: g.nome_grupo,
        observacoes: g.observacoes || '',
        email_responsavel: g.email_responsavel || '',
        empresas: itensPorGrupo[g.id] || new Set(),
        usarContabil: usarPorGrupo[g.id] === true,
      }))
      .sort((a, b) => a.nome_grupo.localeCompare(b.nome_grupo, 'pt-BR'));
  }

  // Interseção de uma lista com o conjunto de códigos de um grupo.
  // codigosSet falsy (nenhum grupo escolhido) => devolve a lista original
  // (mesma referência, sem custo).
  function filtrarPorGrupo(lista, codigosSet, getCodigo) {
    if (!codigosSet) return lista;
    return (lista || []).filter((item) => codigosSet.has(getCodigo(item)));
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { montarGrupos, filtrarPorGrupo };
    return;
  }

  // ─── Camada browser: window.ContabilGrupos ───────────────────

  let _client = null;
  let _grupos = [];      // saída de montarGrupos
  let _carregado = false;

  async function carregar(supabaseClient) {
    _client = supabaseClient || _client;
    const [
      { data: gruposRows, error: errG },
      { data: itensRows, error: errI },
      { data: configRows, error: errC },
    ] = await Promise.all([
      _client.from('rh_grupos_empresas').select('id, nome_grupo, observacoes, email_responsavel'),
      _client.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
      _client.from('contabil_grupos_config').select('grupo_id, usar_contabil'),
    ]);
    if (errG) console.error('ContabilGrupos: erro ao carregar grupos', errG);
    if (errI) console.error('ContabilGrupos: erro ao carregar itens de grupos', errI);
    if (errC) console.error('ContabilGrupos: erro ao carregar contabil_grupos_config', errC);

    _grupos = montarGrupos(gruposRows, itensRows, configRows);
    _carregado = true;
    return _grupos;
  }

  function todos() {
    return _grupos.slice();
  }

  function contabil() {
    return _grupos.filter((g) => g.usarContabil);
  }

  function porId(id) {
    return _grupos.find((g) => g.id === id) || null;
  }

  function codigosDoGrupo(id) {
    const g = porId(id);
    return g ? g.empresas : new Set();
  }

  // Wrapper de conveniência: resolve o Set do grupo e delega ao helper puro.
  function filtrarLista(lista, grupoId, getCodigo) {
    if (!grupoId) return lista;
    return filtrarPorGrupo(lista, codigosDoGrupo(grupoId), getCodigo);
  }

  // <option>s prontos para um <select> de filtro (só grupos marcados p/ contábil).
  function opcoesSelectContabil(selecionadoId) {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
    const opts = ['<option value="">(todos os grupos)</option>'];
    contabil().forEach((g) => {
      opts.push(`<option value="${esc(g.id)}" ${selecionadoId === g.id ? 'selected' : ''}>${esc(g.nome_grupo)}</option>`);
    });
    return opts.join('');
  }

  // ─── CRUD (espelha o comportamento do Projeto RH/script.js) ───

  async function salvarGrupo({ id, nome_grupo, observacoes, email_responsavel, empresas }) {
    const nome = (nome_grupo || '').trim();
    const payload = {
      nome_grupo: nome,
      observacoes: (observacoes || '').trim(),
      email_responsavel: (email_responsavel || '').trim(),
    };
    let grupoId = id || null;

    if (grupoId) {
      const { error } = await _client.from('rh_grupos_empresas').update(payload).eq('id', grupoId);
      if (error) return { id: grupoId, error };
    } else {
      const { data, error } = await _client.from('rh_grupos_empresas').insert(payload).select('id').single();
      if (error) return { id: null, error };
      grupoId = data.id;
    }

    const { error: errDel } = await _client.from('rh_grupos_empresas_itens').delete().eq('grupo_id', grupoId);
    if (errDel) return { id: grupoId, error: errDel };

    const codigos = Array.from(new Set(empresas || []));
    if (codigos.length) {
      const { error: errIns } = await _client.from('rh_grupos_empresas_itens')
        .insert(codigos.map((codigo_empresa) => ({ grupo_id: grupoId, codigo_empresa })));
      if (errIns) return { id: grupoId, error: errIns };
    }

    await carregar();
    return { id: grupoId, error: null };
  }

  async function excluirGrupo(id) {
    if (!id) return { error: null };
    const { error } = await _client.from('rh_grupos_empresas').delete().eq('id', id);
    if (!error) await carregar();
    return { error };
  }

  async function definirUsarContabil(grupoId, valor) {
    const { error } = await _client
      .from('contabil_grupos_config')
      .upsert({ grupo_id: grupoId, usar_contabil: !!valor, updated_at: new Date().toISOString() }, { onConflict: 'grupo_id' });
    if (!error) {
      const g = porId(grupoId);
      if (g) g.usarContabil = !!valor;
    }
    return { error };
  }

  root.ContabilGrupos = {
    carregar,
    estaCarregado: () => _carregado,
    todos,
    contabil,
    porId,
    codigosDoGrupo,
    filtrarPorGrupo,   // helper puro (lista, Set, getCodigo)
    filtrarLista,      // wrapper (lista, grupoId, getCodigo)
    opcoesSelectContabil,
    salvarGrupo,
    excluirGrupo,
    definirUsarContabil,
  };
})(typeof window !== 'undefined' ? window : this);
